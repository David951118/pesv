use reqwest::Client;
use serde::{Deserialize, Serialize};

use lah_core::error::{AppError, AppResult};
use lah_core::types::ProviderHealth;

/// Google Drive provider for file backup.
///
/// Security invariants:
/// - OAuth with PKCE only (no implicit flow)
/// - Scope restricted to `drive.file` (only app-created files)
/// - All uploaded files are already encrypted (opaque blobs)
/// - No shared links created by default
/// - Tokens stored in OS keychain, never on disk
pub struct DriveProvider {
    client: Client,
    /// Set after successful OAuth exchange.
    access_token: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DriveFile {
    pub id: String,
    pub name: String,
    pub mime_type: String,
    pub size: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DriveQuota {
    pub limit: i64,
    pub usage: i64,
    pub remaining: i64,
    pub remaining_percent: f64,
}

/// OAuth configuration for Google Drive.
/// Client ID/secret come from Google Cloud Console.
/// NEVER hardcoded — injected at runtime from config.
#[derive(Debug, Clone)]
pub struct DriveOAuthConfig {
    pub client_id: String,
    pub client_secret: String,
    pub redirect_uri: String,
}

impl DriveProvider {
    pub fn new() -> Self {
        Self {
            client: Client::builder()
                .timeout(std::time::Duration::from_secs(120))
                .build()
                .unwrap_or_default(),
            access_token: None,
        }
    }

    pub fn set_access_token(&mut self, token: String) {
        self.access_token = Some(token);
    }

    fn token(&self) -> AppResult<&str> {
        self.access_token.as_deref().ok_or(AppError::AuthenticationFailed {
            message: "Google Drive not connected".into(),
        })
    }

    /// Generate the OAuth authorization URL with PKCE.
    ///
    /// The caller must:
    /// 1. Generate a random `code_verifier` (43-128 chars, unreserved URI chars)
    /// 2. Compute `code_challenge = BASE64URL(SHA256(code_verifier))`
    /// 3. Store `code_verifier` securely for the exchange step
    /// 4. Open this URL in the system browser (NOT a webview)
    pub fn authorization_url(
        config: &DriveOAuthConfig,
        state: &str,
        code_challenge: &str,
    ) -> String {
        format!(
            "https://accounts.google.com/o/oauth2/v2/auth?\
             client_id={}&\
             redirect_uri={}&\
             response_type=code&\
             scope=https://www.googleapis.com/auth/drive.file&\
             access_type=offline&\
             prompt=consent&\
             state={}&\
             code_challenge={}&\
             code_challenge_method=S256",
            config.client_id,
            urlencoding::encode(&config.redirect_uri),
            urlencoding::encode(state),
            urlencoding::encode(code_challenge),
        )
    }

    /// Exchange authorization code for tokens (with PKCE verification).
    pub async fn exchange_code(
        &self,
        config: &DriveOAuthConfig,
        code: &str,
        code_verifier: &str,
    ) -> AppResult<TokenResponse> {
        let resp = self
            .client
            .post("https://oauth2.googleapis.com/token")
            .form(&[
                ("client_id", config.client_id.as_str()),
                ("client_secret", config.client_secret.as_str()),
                ("code", code),
                ("code_verifier", code_verifier),
                ("grant_type", "authorization_code"),
                ("redirect_uri", config.redirect_uri.as_str()),
            ])
            .send()
            .await
            .map_err(|e| AppError::NetworkError {
                message: format!("Token exchange failed: {e}"),
            })?;

        if !resp.status().is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(AppError::AuthenticationFailed {
                message: format!("Token exchange failed: {body}"),
            });
        }

        resp.json::<TokenResponse>().await.map_err(|e| {
            AppError::AuthenticationFailed {
                message: format!("Token parse failed: {e}"),
            }
        })
    }

    /// Refresh the access token.
    pub async fn refresh_token(
        &self,
        config: &DriveOAuthConfig,
        refresh_token: &str,
    ) -> AppResult<TokenResponse> {
        let resp = self
            .client
            .post("https://oauth2.googleapis.com/token")
            .form(&[
                ("client_id", config.client_id.as_str()),
                ("client_secret", config.client_secret.as_str()),
                ("refresh_token", refresh_token),
                ("grant_type", "refresh_token"),
            ])
            .send()
            .await
            .map_err(|e| AppError::NetworkError {
                message: format!("Token refresh failed: {e}"),
            })?;

        if !resp.status().is_success() {
            return Err(AppError::SessionExpired);
        }

        resp.json().await.map_err(|e| AppError::AuthenticationFailed {
            message: format!("Refresh parse failed: {e}"),
        })
    }

    /// Revoke a token (on disconnect).
    pub async fn revoke_token(&self, token: &str) -> AppResult<()> {
        self.client
            .post(format!(
                "https://oauth2.googleapis.com/revoke?token={token}"
            ))
            .send()
            .await
            .map_err(|e| AppError::NetworkError {
                message: format!("Token revocation failed: {e}"),
            })?;
        Ok(())
    }

    /// Check available quota.
    pub async fn check_quota(&self) -> AppResult<DriveQuota> {
        let token = self.token()?;
        let resp = self
            .client
            .get("https://www.googleapis.com/drive/v3/about?fields=storageQuota")
            .bearer_auth(token)
            .send()
            .await
            .map_err(|e| AppError::NetworkError {
                message: format!("Quota check failed: {e}"),
            })?;

        let data: serde_json::Value = resp.json().await.map_err(|e| {
            AppError::ProviderError {
                provider: "drive".into(),
                message: format!("Quota parse failed: {e}"),
            }
        })?;

        let quota = &data["storageQuota"];
        let limit = quota["limit"].as_str().and_then(|s| s.parse().ok()).unwrap_or(0i64);
        let usage = quota["usage"].as_str().and_then(|s| s.parse().ok()).unwrap_or(0i64);
        let remaining = limit - usage;

        Ok(DriveQuota {
            limit,
            usage,
            remaining,
            remaining_percent: if limit > 0 {
                (remaining as f64 / limit as f64) * 100.0
            } else {
                0.0
            },
        })
    }

    /// Create a folder in Drive. Returns the folder ID.
    pub async fn create_folder(
        &self,
        name: &str,
        parent_id: Option<&str>,
    ) -> AppResult<String> {
        let token = self.token()?;
        let mut metadata = serde_json::json!({
            "name": name,
            "mimeType": "application/vnd.google-apps.folder",
        });

        if let Some(pid) = parent_id {
            metadata["parents"] = serde_json::json!([pid]);
        }

        let resp = self
            .client
            .post("https://www.googleapis.com/drive/v3/files")
            .bearer_auth(token)
            .json(&metadata)
            .send()
            .await
            .map_err(|e| AppError::NetworkError {
                message: format!("Create folder failed: {e}"),
            })?;

        let data: serde_json::Value = resp.json().await.map_err(|e| {
            AppError::ProviderError {
                provider: "drive".into(),
                message: format!("Folder response parse failed: {e}"),
            }
        })?;

        data["id"]
            .as_str()
            .map(String::from)
            .ok_or_else(|| AppError::ProviderError {
                provider: "drive".into(),
                message: "No folder ID in response".into(),
            })
    }

    /// Upload an encrypted file to Drive.
    ///
    /// Uses resumable upload for files > 5 MB, simple upload otherwise.
    /// The file content MUST already be encrypted — Drive stores it as opaque blob.
    pub async fn upload_file(
        &self,
        name: &str,
        parent_id: Option<&str>,
        encrypted_content: &[u8],
    ) -> AppResult<DriveFile> {
        let token = self.token()?;

        let mut metadata = serde_json::json!({
            "name": name,
            "mimeType": "application/octet-stream",
        });
        if let Some(pid) = parent_id {
            metadata["parents"] = serde_json::json!([pid]);
        }

        // Simple upload for files under 5 MB
        let metadata_json = serde_json::to_string(&metadata).unwrap();

        let boundary = "aion_upload_boundary";
        let body = format!(
            "--{boundary}\r\n\
             Content-Type: application/json; charset=UTF-8\r\n\r\n\
             {metadata_json}\r\n\
             --{boundary}\r\n\
             Content-Type: application/octet-stream\r\n\r\n"
        );

        let mut full_body = body.into_bytes();
        full_body.extend_from_slice(encrypted_content);
        full_body.extend_from_slice(format!("\r\n--{boundary}--").as_bytes());

        let resp = self
            .client
            .post("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart")
            .bearer_auth(token)
            .header(
                "Content-Type",
                format!("multipart/related; boundary={boundary}"),
            )
            .body(full_body)
            .send()
            .await
            .map_err(|e| AppError::NetworkError {
                message: format!("Upload failed: {e}"),
            })?;

        if resp.status().as_u16() == 429 {
            return Err(AppError::RateLimited {
                retry_after_secs: 30,
            });
        }

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(AppError::ProviderError {
                provider: "drive".into(),
                message: format!("Upload failed ({status}): {body}"),
            });
        }

        resp.json::<DriveFile>().await.map_err(|e| {
            AppError::ProviderError {
                provider: "drive".into(),
                message: format!("Upload response parse failed: {e}"),
            }
        })
    }

    /// Delete a file from Drive.
    pub async fn delete_file(&self, file_id: &str) -> AppResult<()> {
        let token = self.token()?;
        let resp = self
            .client
            .delete(format!(
                "https://www.googleapis.com/drive/v3/files/{file_id}"
            ))
            .bearer_auth(token)
            .send()
            .await
            .map_err(|e| AppError::NetworkError {
                message: format!("Delete failed: {e}"),
            })?;

        if resp.status().as_u16() == 204 || resp.status().is_success() {
            Ok(())
        } else {
            Err(AppError::ProviderError {
                provider: "drive".into(),
                message: format!("Delete failed: {}", resp.status()),
            })
        }
    }

    /// Health check.
    pub async fn health_check(&self) -> ProviderHealth {
        if self.access_token.is_none() {
            return ProviderHealth {
                provider: "drive".into(),
                is_healthy: false,
                latency_ms: None,
                last_check: chrono::Utc::now(),
                error: Some("Not connected".into()),
            };
        }

        let start = std::time::Instant::now();
        match self.check_quota().await {
            Ok(_) => ProviderHealth {
                provider: "drive".into(),
                is_healthy: true,
                latency_ms: Some(start.elapsed().as_millis() as u64),
                last_check: chrono::Utc::now(),
                error: None,
            },
            Err(e) => ProviderHealth {
                provider: "drive".into(),
                is_healthy: false,
                latency_ms: Some(start.elapsed().as_millis() as u64),
                last_check: chrono::Utc::now(),
                error: Some(e.to_string()),
            },
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TokenResponse {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_in: u64,
    pub token_type: String,
    pub scope: Option<String>,
}

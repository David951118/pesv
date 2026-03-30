use async_trait::async_trait;
use reqwest::Client;
use serde_json::json;

use lah_core::error::{AppError, AppResult};
use lah_core::types::{ProviderHealth, Session, TenantId, UserId, UserRole};

/// Supabase provider for authentication and database operations.
///
/// Security invariants:
/// - ONLY uses `anon_key` (public) — service_role_key is NEVER present
/// - All queries go through PostgREST with JWT, so RLS is enforced
/// - Token refresh is handled proactively before expiration
pub struct SupabaseProvider {
    client: Client,
    url: String,
    anon_key: String,
}

impl SupabaseProvider {
    pub fn new(url: &str, anon_key: &str) -> Self {
        Self {
            client: Client::builder()
                .timeout(std::time::Duration::from_secs(30))
                .build()
                .unwrap_or_default(),
            url: url.trim_end_matches('/').to_string(),
            anon_key: anon_key.to_string(),
        }
    }

    fn auth_url(&self, path: &str) -> String {
        format!("{}/auth/v1{}", self.url, path)
    }

    fn rest_url(&self, path: &str) -> String {
        format!("{}/rest/v1{}", self.url, path)
    }

    fn base_headers(&self) -> reqwest::header::HeaderMap {
        let mut headers = reqwest::header::HeaderMap::new();
        headers.insert("apikey", self.anon_key.parse().unwrap());
        headers.insert("Content-Type", "application/json".parse().unwrap());
        headers
    }

    fn auth_headers(&self, access_token: &str) -> reqwest::header::HeaderMap {
        let mut headers = self.base_headers();
        headers.insert(
            "Authorization",
            format!("Bearer {access_token}").parse().unwrap(),
        );
        headers
    }

    /// Sign in with email and password.
    pub async fn sign_in(&self, email: &str, password: &str) -> AppResult<Session> {
        let resp = self
            .client
            .post(self.auth_url("/token?grant_type=password"))
            .headers(self.base_headers())
            .json(&json!({
                "email": email,
                "password": password,
            }))
            .send()
            .await
            .map_err(|e| AppError::NetworkError {
                message: format!("Supabase auth request failed: {e}"),
            })?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(AppError::AuthenticationFailed {
                message: format!("Login failed ({status}): {body}"),
            });
        }

        let data: serde_json::Value = resp.json().await.map_err(|e| {
            AppError::AuthenticationFailed {
                message: format!("Invalid auth response: {e}"),
            }
        })?;

        Self::parse_session(&data)
    }

    /// Refresh the access token using a refresh token.
    pub async fn refresh_session(&self, refresh_token: &str) -> AppResult<Session> {
        let resp = self
            .client
            .post(self.auth_url("/token?grant_type=refresh_token"))
            .headers(self.base_headers())
            .json(&json!({ "refresh_token": refresh_token }))
            .send()
            .await
            .map_err(|e| AppError::NetworkError {
                message: format!("Token refresh failed: {e}"),
            })?;

        if !resp.status().is_success() {
            return Err(AppError::SessionExpired);
        }

        let data: serde_json::Value = resp.json().await.map_err(|e| {
            AppError::AuthenticationFailed {
                message: format!("Invalid refresh response: {e}"),
            }
        })?;

        Self::parse_session(&data)
    }

    /// Sign out (invalidate the token server-side).
    pub async fn sign_out(&self, access_token: &str) -> AppResult<()> {
        self.client
            .post(self.auth_url("/logout"))
            .headers(self.auth_headers(access_token))
            .send()
            .await
            .map_err(|e| AppError::NetworkError {
                message: format!("Logout request failed: {e}"),
            })?;
        Ok(())
    }

    /// Query a table via PostgREST (RLS enforced by JWT).
    pub async fn query(
        &self,
        access_token: &str,
        table: &str,
        select: &str,
        filters: &[(&str, &str)],
        limit: Option<u32>,
    ) -> AppResult<serde_json::Value> {
        let mut url = format!("{}?select={}", self.rest_url(&format!("/{table}")), select);
        for (key, value) in filters {
            url.push_str(&format!("&{key}=eq.{value}"));
        }
        if let Some(lim) = limit {
            url.push_str(&format!("&limit={lim}"));
        }

        let resp = self
            .client
            .get(&url)
            .headers(self.auth_headers(access_token))
            .send()
            .await
            .map_err(|e| AppError::NetworkError {
                message: format!("Query failed: {e}"),
            })?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(AppError::ProviderError {
                provider: "supabase".into(),
                message: format!("Query failed ({status}): {body}"),
            });
        }

        resp.json().await.map_err(|e| AppError::ProviderError {
            provider: "supabase".into(),
            message: format!("Response parse failed: {e}"),
        })
    }

    /// Invoke a Supabase Edge Function.
    pub async fn invoke_function(
        &self,
        access_token: &str,
        function_name: &str,
        body: serde_json::Value,
    ) -> AppResult<serde_json::Value> {
        let url = format!("{}/functions/v1/{}", self.url, function_name);

        let resp = self
            .client
            .post(&url)
            .headers(self.auth_headers(access_token))
            .json(&body)
            .send()
            .await
            .map_err(|e| AppError::NetworkError {
                message: format!("Edge function invocation failed: {e}"),
            })?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(AppError::ProviderError {
                provider: "supabase".into(),
                message: format!("Function {function_name} failed ({status}): {body}"),
            });
        }

        resp.json().await.map_err(|e| AppError::ProviderError {
            provider: "supabase".into(),
            message: format!("Function response parse failed: {e}"),
        })
    }

    /// Health check: ping the Supabase endpoint.
    pub async fn health_check(&self) -> ProviderHealth {
        let start = std::time::Instant::now();
        let result = self
            .client
            .get(format!("{}/rest/v1/", self.url))
            .headers(self.base_headers())
            .send()
            .await;

        match result {
            Ok(resp) => ProviderHealth {
                provider: "supabase".into(),
                is_healthy: resp.status().is_success() || resp.status().as_u16() == 400,
                latency_ms: Some(start.elapsed().as_millis() as u64),
                last_check: chrono::Utc::now(),
                error: None,
            },
            Err(e) => ProviderHealth {
                provider: "supabase".into(),
                is_healthy: false,
                latency_ms: Some(start.elapsed().as_millis() as u64),
                last_check: chrono::Utc::now(),
                error: Some(e.to_string()),
            },
        }
    }

    fn parse_session(data: &serde_json::Value) -> AppResult<Session> {
        let access_token = data["access_token"]
            .as_str()
            .ok_or_else(|| AppError::AuthenticationFailed {
                message: "Missing access_token".into(),
            })?
            .to_string();

        let refresh_token = data["refresh_token"]
            .as_str()
            .unwrap_or_default()
            .to_string();

        let expires_in = data["expires_in"].as_i64().unwrap_or(3600);
        let expires_at = chrono::Utc::now() + chrono::Duration::seconds(expires_in);

        let user = &data["user"];
        let user_id = user["id"].as_str().unwrap_or_default().to_string();
        let email = user["email"].as_str().unwrap_or_default().to_string();

        // Extract role from app_metadata or user_metadata
        let role_str = user["app_metadata"]["role"]
            .as_str()
            .or_else(|| user["user_metadata"]["role"].as_str())
            .unwrap_or("viewer");

        let role = match role_str {
            "admin" => UserRole::Admin,
            "operator" => UserRole::Operator,
            "conductor" => UserRole::Conductor,
            _ => UserRole::Viewer,
        };

        let tenant_id = user["app_metadata"]["tenant_id"]
            .as_str()
            .or_else(|| user["user_metadata"]["tenant_id"].as_str())
            .unwrap_or("default")
            .to_string();

        Ok(Session {
            user_id: UserId(user_id),
            tenant_id: TenantId(tenant_id),
            email,
            role,
            access_token,
            refresh_token,
            expires_at,
        })
    }
}

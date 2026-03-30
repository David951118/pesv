use reqwest::Client;
use serde::{Deserialize, Serialize};

use lah_core::error::{AppError, AppResult};
use lah_core::types::ProviderHealth;

/// GitHub App provider for repository operations.
///
/// Uses GitHub App authentication (not OAuth App) for:
/// - Granular per-repo permissions
/// - Short-lived installation tokens (~1 hour)
/// - Bot identity (not impersonating the user)
///
/// The GitHub App's private key is NOT stored in the desktop app.
/// Instead, installation tokens are obtained via a Supabase Edge Function
/// that holds the private key server-side.
///
/// Alternatively, the user can provide a Personal Access Token (PAT)
/// with limited scopes as a simpler auth method.
pub struct GitHubProvider {
    client: Client,
    /// Installation token (short-lived) or PAT.
    token: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubRepo {
    pub id: u64,
    pub full_name: String,
    pub name: String,
    pub owner: RepoOwner,
    pub default_branch: String,
    pub private: bool,
    pub clone_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RepoOwner {
    pub login: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubIssue {
    pub number: u64,
    pub title: String,
    pub body: Option<String>,
    pub state: String,
    pub html_url: String,
}

impl GitHubProvider {
    pub fn new() -> Self {
        Self {
            client: Client::builder()
                .user_agent("AIONDefensaPredictiva/1.0")
                .timeout(std::time::Duration::from_secs(30))
                .build()
                .unwrap_or_default(),
            token: None,
        }
    }

    pub fn set_token(&mut self, token: String) {
        self.token = Some(token);
    }

    fn token(&self) -> AppResult<&str> {
        self.token.as_deref().ok_or(AppError::AuthenticationFailed {
            message: "GitHub not connected".into(),
        })
    }

    /// List repositories accessible to the authenticated user/installation.
    pub async fn list_repos(&self) -> AppResult<Vec<GitHubRepo>> {
        let token = self.token()?;
        let resp = self
            .client
            .get("https://api.github.com/user/repos?per_page=100&sort=updated")
            .bearer_auth(token)
            .send()
            .await
            .map_err(|e| AppError::NetworkError {
                message: format!("GitHub list repos failed: {e}"),
            })?;

        if !resp.status().is_success() {
            return Err(AppError::ProviderError {
                provider: "github".into(),
                message: format!("List repos failed: {}", resp.status()),
            });
        }

        resp.json().await.map_err(|e| AppError::ProviderError {
            provider: "github".into(),
            message: format!("Parse failed: {e}"),
        })
    }

    /// Create an issue in a repository.
    pub async fn create_issue(
        &self,
        owner: &str,
        repo: &str,
        title: &str,
        body: &str,
        labels: &[String],
    ) -> AppResult<GitHubIssue> {
        let token = self.token()?;
        let resp = self
            .client
            .post(format!("https://api.github.com/repos/{owner}/{repo}/issues"))
            .bearer_auth(token)
            .json(&serde_json::json!({
                "title": title,
                "body": body,
                "labels": labels,
            }))
            .send()
            .await
            .map_err(|e| AppError::NetworkError {
                message: format!("Create issue failed: {e}"),
            })?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(AppError::ProviderError {
                provider: "github".into(),
                message: format!("Create issue failed ({status}): {body}"),
            });
        }

        resp.json().await.map_err(|e| AppError::ProviderError {
            provider: "github".into(),
            message: format!("Parse issue failed: {e}"),
        })
    }

    /// List issues in a repository.
    pub async fn list_issues(
        &self,
        owner: &str,
        repo: &str,
        state: &str,
    ) -> AppResult<Vec<GitHubIssue>> {
        let token = self.token()?;
        let resp = self
            .client
            .get(format!(
                "https://api.github.com/repos/{owner}/{repo}/issues?state={state}&per_page=30"
            ))
            .bearer_auth(token)
            .send()
            .await
            .map_err(|e| AppError::NetworkError {
                message: format!("List issues failed: {e}"),
            })?;

        if !resp.status().is_success() {
            return Err(AppError::ProviderError {
                provider: "github".into(),
                message: format!("List issues failed: {}", resp.status()),
            });
        }

        resp.json().await.map_err(|e| AppError::ProviderError {
            provider: "github".into(),
            message: format!("Parse failed: {e}"),
        })
    }

    pub async fn health_check(&self) -> ProviderHealth {
        if self.token.is_none() {
            return ProviderHealth {
                provider: "github".into(),
                is_healthy: false,
                latency_ms: None,
                last_check: chrono::Utc::now(),
                error: Some("Not connected".into()),
            };
        }

        let start = std::time::Instant::now();
        let token = self.token.as_deref().unwrap_or_default();
        match self
            .client
            .get("https://api.github.com/rate_limit")
            .bearer_auth(token)
            .send()
            .await
        {
            Ok(resp) => ProviderHealth {
                provider: "github".into(),
                is_healthy: resp.status().is_success(),
                latency_ms: Some(start.elapsed().as_millis() as u64),
                last_check: chrono::Utc::now(),
                error: None,
            },
            Err(e) => ProviderHealth {
                provider: "github".into(),
                is_healthy: false,
                latency_ms: Some(start.elapsed().as_millis() as u64),
                last_check: chrono::Utc::now(),
                error: Some(e.to_string()),
            },
        }
    }
}

use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::Duration;

use lah_core::error::{AppError, AppResult};
use lah_core::types::ProviderHealth;

/// AION API provider (generic REST client).
///
/// The AION API contract is not yet fully specified. This provider
/// implements a generic REST adapter that can be configured with:
/// - Base URL
/// - Authentication method (Bearer token)
/// - Default timeout and retry policy
///
/// When the AION API is finalized, update the concrete methods
/// without changing the provider interface.
pub struct AIONProvider {
    client: Client,
    base_url: String,
    token: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIONRequest {
    pub method: String,
    pub path: String,
    pub body: Option<serde_json::Value>,
    pub query: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIONResponse {
    pub status: u16,
    pub body: serde_json::Value,
}

impl AIONProvider {
    pub fn new(base_url: &str) -> Self {
        Self {
            client: Client::builder()
                .timeout(Duration::from_secs(30))
                .build()
                .unwrap_or_default(),
            base_url: base_url.trim_end_matches('/').to_string(),
            token: None,
        }
    }

    pub fn set_token(&mut self, token: String) {
        self.token = Some(token);
    }

    /// Execute a generic REST request to the AION API.
    pub async fn execute(&self, req: &AIONRequest) -> AppResult<AIONResponse> {
        let url = format!("{}{}", self.base_url, req.path);

        let mut builder = match req.method.to_uppercase().as_str() {
            "GET" => self.client.get(&url),
            "POST" => self.client.post(&url),
            "PUT" => self.client.put(&url),
            "PATCH" => self.client.patch(&url),
            "DELETE" => self.client.delete(&url),
            other => {
                return Err(AppError::ProviderError {
                    provider: "aion".into(),
                    message: format!("Unsupported HTTP method: {other}"),
                });
            }
        };

        // Add auth if available
        if let Some(token) = &self.token {
            builder = builder.bearer_auth(token);
        }

        // Add query params
        if !req.query.is_empty() {
            builder = builder.query(&req.query);
        }

        // Add body
        if let Some(body) = &req.body {
            builder = builder.json(body);
        }

        let resp = builder.send().await.map_err(|e| AppError::NetworkError {
            message: format!("AION request failed: {e}"),
        })?;

        let status = resp.status().as_u16();

        if status == 429 {
            return Err(AppError::RateLimited {
                retry_after_secs: 30,
            });
        }

        let body: serde_json::Value = resp.json().await.unwrap_or(serde_json::json!(null));

        if status >= 400 {
            return Err(AppError::ProviderError {
                provider: "aion".into(),
                message: format!("Request failed ({status}): {body}"),
            });
        }

        Ok(AIONResponse { status, body })
    }

    pub async fn health_check(&self) -> ProviderHealth {
        let start = std::time::Instant::now();
        // Attempt a lightweight request
        let result = self
            .execute(&AIONRequest {
                method: "GET".into(),
                path: "/health".into(),
                body: None,
                query: HashMap::new(),
            })
            .await;

        match result {
            Ok(resp) => ProviderHealth {
                provider: "aion".into(),
                is_healthy: resp.status < 400,
                latency_ms: Some(start.elapsed().as_millis() as u64),
                last_check: chrono::Utc::now(),
                error: None,
            },
            Err(e) => ProviderHealth {
                provider: "aion".into(),
                is_healthy: false,
                latency_ms: Some(start.elapsed().as_millis() as u64),
                last_check: chrono::Utc::now(),
                error: Some(e.to_string()),
            },
        }
    }
}

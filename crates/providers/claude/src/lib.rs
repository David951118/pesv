use reqwest::Client;
use serde::Deserialize;

use lah_core::error::{AppError, AppResult};
use lah_core::types::{AIMessage, AIRequest, AIResponse, AIRole, ProviderHealth};

/// Claude (Anthropic) provider implementing the AIProvider interface.
///
/// Assumes the Anthropic Messages API. If "Claude Code" is a different
/// service, this adapter can be swapped via the provider interface.
///
/// Security invariants: same as OpenAI provider (see openai/src/lib.rs).
pub struct ClaudeProvider {
    client: Client,
    api_key: String,
    default_model: String,
}

impl ClaudeProvider {
    pub fn new(api_key: &str) -> Self {
        Self {
            client: Client::builder()
                .timeout(std::time::Duration::from_secs(120))
                .build()
                .unwrap_or_default(),
            api_key: api_key.to_string(),
            default_model: "claude-sonnet-4-5-20250929".to_string(),
        }
    }

    pub async fn complete(&self, request: &AIRequest) -> AppResult<AIResponse> {
        let mut system_prompt = String::new();
        let mut messages = Vec::new();

        for msg in &request.messages {
            match msg.role {
                AIRole::System => {
                    system_prompt.push_str(&msg.content);
                }
                AIRole::User => {
                    messages.push(serde_json::json!({
                        "role": "user",
                        "content": msg.content,
                    }));
                }
                AIRole::Assistant => {
                    messages.push(serde_json::json!({
                        "role": "assistant",
                        "content": msg.content,
                    }));
                }
            }
        }

        let mut body = serde_json::json!({
            "model": self.default_model,
            "messages": messages,
            "max_tokens": request.max_tokens.unwrap_or(4096),
        });

        if !system_prompt.is_empty() {
            body["system"] = serde_json::json!(system_prompt);
        }

        if let Some(temp) = request.temperature {
            body["temperature"] = serde_json::json!(temp);
        }

        let resp = self
            .client
            .post("https://api.anthropic.com/v1/messages")
            .header("x-api-key", &self.api_key)
            .header("anthropic-version", "2023-06-01")
            .header("content-type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| AppError::NetworkError {
                message: format!("Claude request failed: {e}"),
            })?;

        if resp.status().as_u16() == 429 {
            let retry_after = resp
                .headers()
                .get("retry-after")
                .and_then(|v| v.to_str().ok())
                .and_then(|s| s.parse().ok())
                .unwrap_or(60);
            return Err(AppError::RateLimited {
                retry_after_secs: retry_after,
            });
        }

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(AppError::ProviderError {
                provider: "claude".into(),
                message: format!("Request failed ({status}): {body}"),
            });
        }

        let data: ClaudeResponse = resp.json().await.map_err(|e| {
            AppError::ProviderError {
                provider: "claude".into(),
                message: format!("Response parse failed: {e}"),
            }
        })?;

        let content = data
            .content
            .iter()
            .filter_map(|c| {
                if c.content_type == "text" {
                    Some(c.text.as_deref().unwrap_or_default())
                } else {
                    None
                }
            })
            .collect::<Vec<_>>()
            .join("");

        let input_tokens = data.usage.input_tokens;
        let output_tokens = data.usage.output_tokens;
        let cost = Self::estimate_cost(&data.model, input_tokens, output_tokens);

        tracing::info!(
            model = data.model.as_str(),
            input_tokens = input_tokens,
            output_tokens = output_tokens,
            cost_usd = cost,
            purpose = request.purpose.as_str(),
            "Claude completion"
        );

        Ok(AIResponse {
            content,
            model: data.model,
            input_tokens,
            output_tokens,
            estimated_cost_usd: cost,
            finish_reason: data.stop_reason.unwrap_or_default(),
        })
    }

    fn estimate_cost(model: &str, input_tokens: u32, output_tokens: u32) -> f64 {
        let (input_price, output_price) = match model {
            m if m.contains("opus") => (15.0 / 1_000_000.0, 75.0 / 1_000_000.0),
            m if m.contains("sonnet") => (3.0 / 1_000_000.0, 15.0 / 1_000_000.0),
            m if m.contains("haiku") => (0.25 / 1_000_000.0, 1.25 / 1_000_000.0),
            _ => (3.0 / 1_000_000.0, 15.0 / 1_000_000.0),
        };
        (input_tokens as f64 * input_price) + (output_tokens as f64 * output_price)
    }

    pub async fn health_check(&self) -> ProviderHealth {
        // Simple ping — Claude doesn't have a /models endpoint like OpenAI
        let start = std::time::Instant::now();
        let result = self
            .client
            .post("https://api.anthropic.com/v1/messages")
            .header("x-api-key", &self.api_key)
            .header("anthropic-version", "2023-06-01")
            .json(&serde_json::json!({
                "model": "claude-haiku-4-5-20251001",
                "messages": [{"role": "user", "content": "ping"}],
                "max_tokens": 1,
            }))
            .send()
            .await;

        match result {
            Ok(resp) => ProviderHealth {
                provider: "claude".into(),
                is_healthy: resp.status().is_success(),
                latency_ms: Some(start.elapsed().as_millis() as u64),
                last_check: chrono::Utc::now(),
                error: None,
            },
            Err(e) => ProviderHealth {
                provider: "claude".into(),
                is_healthy: false,
                latency_ms: Some(start.elapsed().as_millis() as u64),
                last_check: chrono::Utc::now(),
                error: Some(e.to_string()),
            },
        }
    }
}

#[derive(Debug, Deserialize)]
struct ClaudeResponse {
    model: String,
    content: Vec<ContentBlock>,
    stop_reason: Option<String>,
    usage: ClaudeUsage,
}

#[derive(Debug, Deserialize)]
struct ContentBlock {
    #[serde(rename = "type")]
    content_type: String,
    text: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ClaudeUsage {
    input_tokens: u32,
    output_tokens: u32,
}

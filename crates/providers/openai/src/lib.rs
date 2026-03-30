use reqwest::Client;
use serde::{Deserialize, Serialize};

use lah_core::error::{AppError, AppResult};
use lah_core::types::{AIMessage, AIRequest, AIResponse, AIRole, AIUsage, ProviderHealth};

/// OpenAI provider implementing the AIProvider interface.
///
/// Security invariants:
/// - API key obtained from OS keychain at runtime, never hardcoded
/// - All prompts are pre-scanned by DLP engine before sending
/// - Rate limiting and budget controls enforced
/// - Request/response metadata logged (NOT content)
pub struct OpenAIProvider {
    client: Client,
    api_key: String,
    default_model: String,
}

impl OpenAIProvider {
    pub fn new(api_key: &str) -> Self {
        Self {
            client: Client::builder()
                .timeout(std::time::Duration::from_secs(120))
                .build()
                .unwrap_or_default(),
            api_key: api_key.to_string(),
            default_model: "gpt-4o".to_string(),
        }
    }

    /// Send a completion request.
    pub async fn complete(&self, request: &AIRequest) -> AppResult<AIResponse> {
        let messages: Vec<serde_json::Value> = request
            .messages
            .iter()
            .map(|m| {
                serde_json::json!({
                    "role": match m.role {
                        AIRole::System => "system",
                        AIRole::User => "user",
                        AIRole::Assistant => "assistant",
                    },
                    "content": m.content,
                })
            })
            .collect();

        let body = serde_json::json!({
            "model": self.default_model,
            "messages": messages,
            "max_tokens": request.max_tokens.unwrap_or(4096),
            "temperature": request.temperature.unwrap_or(0.7),
        });

        let resp = self
            .client
            .post("https://api.openai.com/v1/chat/completions")
            .bearer_auth(&self.api_key)
            .json(&body)
            .send()
            .await
            .map_err(|e| AppError::NetworkError {
                message: format!("OpenAI request failed: {e}"),
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
                provider: "openai".into(),
                message: format!("Request failed ({status}): {body}"),
            });
        }

        let data: OpenAIResponse = resp.json().await.map_err(|e| {
            AppError::ProviderError {
                provider: "openai".into(),
                message: format!("Response parse failed: {e}"),
            }
        })?;

        let choice = data.choices.first().ok_or_else(|| AppError::ProviderError {
            provider: "openai".into(),
            message: "No choices in response".into(),
        })?;

        let input_tokens = data.usage.prompt_tokens;
        let output_tokens = data.usage.completion_tokens;
        let cost = Self::estimate_cost(&data.model, input_tokens, output_tokens);

        tracing::info!(
            model = data.model.as_str(),
            input_tokens = input_tokens,
            output_tokens = output_tokens,
            cost_usd = cost,
            purpose = request.purpose.as_str(),
            "OpenAI completion"
        );

        Ok(AIResponse {
            content: choice.message.content.clone().unwrap_or_default(),
            model: data.model,
            input_tokens,
            output_tokens,
            estimated_cost_usd: cost,
            finish_reason: choice.finish_reason.clone().unwrap_or_default(),
        })
    }

    /// Estimate cost based on model and token counts.
    fn estimate_cost(model: &str, input_tokens: u32, output_tokens: u32) -> f64 {
        let (input_price, output_price) = match model {
            m if m.starts_with("gpt-4o") => (2.50 / 1_000_000.0, 10.0 / 1_000_000.0),
            m if m.starts_with("gpt-4") => (30.0 / 1_000_000.0, 60.0 / 1_000_000.0),
            m if m.starts_with("gpt-3.5") => (0.5 / 1_000_000.0, 1.5 / 1_000_000.0),
            _ => (5.0 / 1_000_000.0, 15.0 / 1_000_000.0),
        };
        (input_tokens as f64 * input_price) + (output_tokens as f64 * output_price)
    }

    pub async fn health_check(&self) -> ProviderHealth {
        let start = std::time::Instant::now();
        let result = self
            .client
            .get("https://api.openai.com/v1/models")
            .bearer_auth(&self.api_key)
            .send()
            .await;

        match result {
            Ok(resp) => ProviderHealth {
                provider: "openai".into(),
                is_healthy: resp.status().is_success(),
                latency_ms: Some(start.elapsed().as_millis() as u64),
                last_check: chrono::Utc::now(),
                error: if !resp.status().is_success() {
                    Some(format!("Status: {}", resp.status()))
                } else {
                    None
                },
            },
            Err(e) => ProviderHealth {
                provider: "openai".into(),
                is_healthy: false,
                latency_ms: Some(start.elapsed().as_millis() as u64),
                last_check: chrono::Utc::now(),
                error: Some(e.to_string()),
            },
        }
    }
}

#[derive(Debug, Deserialize)]
struct OpenAIResponse {
    model: String,
    choices: Vec<OpenAIChoice>,
    usage: OpenAIUsage,
}

#[derive(Debug, Deserialize)]
struct OpenAIChoice {
    message: OpenAIMessage,
    finish_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
struct OpenAIMessage {
    content: Option<String>,
}

#[derive(Debug, Deserialize)]
struct OpenAIUsage {
    prompt_tokens: u32,
    completion_tokens: u32,
}

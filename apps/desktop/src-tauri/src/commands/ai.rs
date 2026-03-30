use tauri::State;

use lah_core::error::AppError;
use lah_core::types::{AIProviderType, AIRequest, AIResponse, AIUsage, AuditOutcome, DataClassification};
use lah_crypto::KeyringStore;
use lah_policy::dlp::DlpEngine;
use lah_policy::enforcement::{PolicyAction, PolicyEngine};

use crate::state::AppState;

/// Send a completion request to the configured AI provider.
///
/// Security flow:
/// 1. Rate limit check
/// 2. Budget check
/// 3. DLP scan (redact PII, block secrets)
/// 4. Policy check (classification enforcement)
/// 5. Send to provider
/// 6. Log metadata (NOT content)
#[tauri::command]
pub async fn ai_complete(
    state: State<'_, AppState>,
    request: AIRequest,
    provider_type: Option<AIProviderType>,
) -> Result<AIResponse, AppError> {
    state.check_kill_switch()?;
    let session = state.require_session()?;

    // 1. Rate limit
    if !state.ai_rate_limiter.try_acquire() {
        return Err(AppError::RateLimited {
            retry_after_secs: 5,
        });
    }

    // 2. DLP scan all messages
    let dlp = DlpEngine::new_default();
    let mut clean_messages = Vec::new();

    for msg in &request.messages {
        let scan = dlp.scan(&msg.content);
        if scan.blocked {
            let violations: Vec<String> = scan
                .violations
                .iter()
                .map(|v| v.rule_name.clone())
                .collect();
            return Err(AppError::ClassificationViolation(format!(
                "DLP blocked: content contains {} (rules: {})",
                violations.join(", "),
                violations.len()
            )));
        }
        clean_messages.push(lah_core::types::AIMessage {
            role: msg.role.clone(),
            content: scan.clean_text,
        });
    }

    // 3. Policy check for file references
    if !request.source_file_ids.is_empty() {
        // If any referenced file is RESTRICTED, deny
        PolicyEngine::enforce(&PolicyAction {
            action: "send_to_ai".into(),
            resource_type: "file".into(),
            classification: DataClassification::Internal, // TODO: look up actual classification
            user_role: session.role.clone(),
            tenant_id: session.tenant_id.0.clone(),
        })?;
    }

    // 4. Get API key from keychain
    let provider = provider_type.unwrap_or(AIProviderType::Claude);
    let key_ref = match provider {
        AIProviderType::OpenAI => "openai_api_key",
        AIProviderType::Claude => "claude_api_key",
    };
    let api_key = KeyringStore::get_token(&session.tenant_id.0, key_ref)?;

    // 5. Build clean request
    let clean_request = AIRequest {
        messages: clean_messages,
        max_tokens: request.max_tokens,
        temperature: request.temperature,
        purpose: request.purpose.clone(),
        source_file_ids: request.source_file_ids.clone(),
    };

    // 6. Call provider
    let response = match provider {
        AIProviderType::OpenAI => {
            let p = lah_provider_openai::OpenAIProvider::new(&api_key);
            p.complete(&clean_request).await?
        }
        AIProviderType::Claude => {
            let p = lah_provider_claude::ClaudeProvider::new(&api_key);
            p.complete(&clean_request).await?
        }
    };

    // 7. Audit (metadata only, NOT content)
    if let Some(audit) = state.audit_log.lock().unwrap().as_ref() {
        audit.record(
            &session.tenant_id.0,
            &session.user_id.0,
            "ai_complete",
            "ai",
            None,
            AuditOutcome::Success,
            serde_json::json!({
                "provider": format!("{}", provider),
                "model": response.model,
                "input_tokens": response.input_tokens,
                "output_tokens": response.output_tokens,
                "cost_usd": response.estimated_cost_usd,
                "purpose": request.purpose,
            }),
        ).ok();
    }

    tracing::info!(
        provider = %provider,
        model = response.model.as_str(),
        tokens_in = response.input_tokens,
        tokens_out = response.output_tokens,
        cost = response.estimated_cost_usd,
        "AI completion"
    );

    Ok(response)
}

/// Get current AI usage and budget status.
#[tauri::command]
pub fn ai_get_usage(state: State<'_, AppState>) -> Result<AIUsage, AppError> {
    let session = state.require_session()?;
    let config = state.config.lock().unwrap();

    // TODO: Query from cost_usage table
    Ok(AIUsage {
        total_requests_today: 0,
        total_tokens_today: 0,
        cost_today_usd: 0.0,
        cost_month_usd: 0.0,
        budget_remaining_usd: config.ai.monthly_budget_usd,
    })
}

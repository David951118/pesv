use tauri::State;

use lah_core::error::AppError;
use lah_core::types::{ApprovalRequest, AuditEvent, AuditOutcome};
use lah_crypto::SecretRedactor;

use crate::state::AppState;

/// List pending approval requests for the current tenant.
#[tauri::command]
pub fn list_approvals(state: State<'_, AppState>) -> Result<Vec<ApprovalRequest>, AppError> {
    let session = state.require_session()?;
    let mgr = state.approval_manager.lock().unwrap();
    match mgr.as_ref() {
        Some(m) => m.list_pending(&session.tenant_id.0),
        None => Ok(vec![]),
    }
}

/// Approve a pending request (admin only).
#[tauri::command]
pub fn approve_request(
    state: State<'_, AppState>,
    approval_id: String,
    reason: String,
) -> Result<(), AppError> {
    let session = state.require_session()?;

    // Only admins can approve
    if session.role != lah_core::types::UserRole::Admin {
        return Err(AppError::Unauthorized {
            action: "approve".into(),
            resource: "approval".into(),
        });
    }

    let mgr = state.approval_manager.lock().unwrap();
    if let Some(m) = mgr.as_ref() {
        m.approve(&approval_id, &session.user_id.0, &reason)?;

        // Audit
        if let Some(audit) = state.audit_log.lock().unwrap().as_ref() {
            audit.record(
                &session.tenant_id.0,
                &session.user_id.0,
                "approve_request",
                "approval",
                Some(&approval_id),
                AuditOutcome::Success,
                serde_json::json!({"reason": reason}),
            ).ok();
        }
    }
    Ok(())
}

/// Deny a pending request (admin only).
#[tauri::command]
pub fn deny_request(
    state: State<'_, AppState>,
    approval_id: String,
    reason: String,
) -> Result<(), AppError> {
    let session = state.require_session()?;

    if session.role != lah_core::types::UserRole::Admin {
        return Err(AppError::Unauthorized {
            action: "deny".into(),
            resource: "approval".into(),
        });
    }

    let mgr = state.approval_manager.lock().unwrap();
    if let Some(m) = mgr.as_ref() {
        m.deny(&approval_id, &session.user_id.0, &reason)?;
    }
    Ok(())
}

/// Query audit events for the current tenant.
#[tauri::command]
pub fn query_audit_events(
    state: State<'_, AppState>,
    action_filter: Option<String>,
    limit: Option<u32>,
    offset: Option<u32>,
) -> Result<Vec<AuditEvent>, AppError> {
    let session = state.require_session()?;
    let audit = state.audit_log.lock().unwrap();
    match audit.as_ref() {
        Some(log) => log.query_events(
            &session.tenant_id.0,
            action_filter.as_deref(),
            limit.unwrap_or(50),
            offset.unwrap_or(0),
        ),
        None => Ok(vec![]),
    }
}

/// Verify audit chain integrity.
#[tauri::command]
pub fn verify_audit_chain(state: State<'_, AppState>) -> Result<AuditChainResult, AppError> {
    let audit = state.audit_log.lock().unwrap();
    match audit.as_ref() {
        Some(log) => {
            let count = log.verify_chain()?;
            Ok(AuditChainResult {
                verified: true,
                event_count: count,
                error: None,
            })
        }
        None => Ok(AuditChainResult {
            verified: false,
            event_count: 0,
            error: Some("Audit log not initialized".into()),
        }),
    }
}

/// Export diagnostic logs (secrets are redacted automatically).
#[tauri::command]
pub fn export_diagnostics(state: State<'_, AppState>) -> Result<DiagnosticExport, AppError> {
    let session = state.require_session()?;
    let config = state.config.lock().unwrap().clone();

    // Build diagnostic info (all secrets are redacted)
    let config_json = serde_json::to_value(&config).unwrap_or_default();
    let redacted_config = SecretRedactor::redact_json(&config_json);

    let circuit_state = state.circuit_breaker.state_name();
    let drive_tokens = state.drive_rate_limiter.available_tokens();
    let ai_tokens = state.ai_rate_limiter.available_tokens();

    // Audit
    if let Some(audit) = state.audit_log.lock().unwrap().as_ref() {
        audit.record(
            &session.tenant_id.0,
            &session.user_id.0,
            "export_diagnostics",
            "system",
            None,
            AuditOutcome::Success,
            serde_json::json!({}),
        ).ok();
    }

    Ok(DiagnosticExport {
        config: redacted_config,
        circuit_breaker_state: circuit_state.to_string(),
        drive_rate_limiter_tokens: drive_tokens,
        ai_rate_limiter_tokens: ai_tokens,
        kill_switch_active: *state.kill_switch.lock().unwrap(),
    })
}

#[derive(Debug, serde::Serialize)]
pub struct AuditChainResult {
    pub verified: bool,
    pub event_count: u64,
    pub error: Option<String>,
}

#[derive(Debug, serde::Serialize)]
pub struct DiagnosticExport {
    pub config: serde_json::Value,
    pub circuit_breaker_state: String,
    pub drive_rate_limiter_tokens: f64,
    pub ai_rate_limiter_tokens: f64,
    pub kill_switch_active: bool,
}

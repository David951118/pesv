use tauri::State;

use lah_core::error::AppError;
use lah_core::types::AuditOutcome;
use lah_crypto::KeyringStore;
use lah_provider_supabase::SupabaseProvider;

use crate::state::AppState;

/// Sign in with email and password.
///
/// Tokens are stored in OS keychain immediately, never exposed to the UI.
#[tauri::command]
pub async fn sign_in(
    state: State<'_, AppState>,
    email: String,
    password: String,
) -> Result<SessionInfo, AppError> {
    state.check_kill_switch()?;

    let config = state.config.lock().unwrap().clone();

    let provider = SupabaseProvider::new(&config.supabase.url, &config.supabase.anon_key);
    let session = provider.sign_in(&email, &password).await?;

    // Store tokens in keychain — NEVER in memory longer than needed
    KeyringStore::store_token(&session.tenant_id.0, "supabase_access", &session.access_token)?;
    KeyringStore::store_token(&session.tenant_id.0, "supabase_refresh", &session.refresh_token)?;

    // Initialize tenant-specific resources
    let data_dir = config.tenant_data_dir(&session.tenant_id.0);
    std::fs::create_dir_all(&data_dir).ok();

    let db_path = config.db_path(&session.tenant_id.0);
    if let Ok(queue) = lah_sync::JobQueue::open(&db_path) {
        *state.job_queue.lock().unwrap() = Some(queue);
    }

    let audit_path = data_dir.join("audit.db");
    if let Ok(audit) = lah_audit::AuditLog::open(&audit_path) {
        audit.record(
            &session.tenant_id.0,
            &session.user_id.0,
            "sign_in",
            "session",
            None,
            AuditOutcome::Success,
            serde_json::json!({"email": email}),
        ).ok();
        *state.audit_log.lock().unwrap() = Some(audit);
    }

    let info = SessionInfo {
        user_id: session.user_id.0.clone(),
        tenant_id: session.tenant_id.0.clone(),
        email: session.email.clone(),
        role: format!("{:?}", session.role),
        expires_at: session.expires_at.to_rfc3339(),
    };

    *state.supabase.lock().unwrap() = Some(provider);
    *state.session.lock().unwrap() = Some(session);

    tracing::info!(email = info.email.as_str(), "User signed in");
    Ok(info)
}

/// Sign out and revoke tokens.
#[tauri::command]
pub async fn sign_out(state: State<'_, AppState>) -> Result<(), AppError> {
    let session = state.session.lock().unwrap().take();

    if let Some(session) = session {
        // Revoke server-side
        if let Some(provider) = state.supabase.lock().unwrap().as_ref() {
            provider.sign_out(&session.access_token).await.ok();
        }

        // Remove from keychain
        KeyringStore::delete_token(&session.tenant_id.0, "supabase_access").ok();
        KeyringStore::delete_token(&session.tenant_id.0, "supabase_refresh").ok();

        // Audit
        if let Some(audit) = state.audit_log.lock().unwrap().as_ref() {
            audit.record(
                &session.tenant_id.0,
                &session.user_id.0,
                "sign_out",
                "session",
                None,
                AuditOutcome::Success,
                serde_json::json!({}),
            ).ok();
        }

        tracing::info!(user = session.email, "User signed out");
    }

    *state.supabase.lock().unwrap() = None;
    Ok(())
}

/// Get current session info (no tokens exposed).
#[tauri::command]
pub fn get_session(state: State<'_, AppState>) -> Result<Option<SessionInfo>, AppError> {
    let session = state.session.lock().unwrap();
    Ok(session.as_ref().map(|s| SessionInfo {
        user_id: s.user_id.0.clone(),
        tenant_id: s.tenant_id.0.clone(),
        email: s.email.clone(),
        role: format!("{:?}", s.role),
        expires_at: s.expires_at.to_rfc3339(),
    }))
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct SessionInfo {
    pub user_id: String,
    pub tenant_id: String,
    pub email: String,
    pub role: String,
    pub expires_at: String,
}

mod commands;
mod state;

use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize structured logging with secret redaction
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .json()
        .init();

    tracing::info!("AION Defensa Predictiva Desktop starting");

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            // Auth
            commands::auth::sign_in,
            commands::auth::sign_out,
            commands::auth::get_session,
            // Files
            commands::files::upload_file,
            commands::files::get_sync_status,
            // AI
            commands::ai::ai_complete,
            commands::ai::ai_get_usage,
            // Config
            commands::config::get_config,
            commands::config::update_config,
            commands::config::test_supabase_connection,
            commands::config::get_health_status,
            // Sync
            commands::sync_cmd::get_queue_stats,
            commands::sync_cmd::retry_dead_letter_job,
            // Admin
            commands::admin::list_approvals,
            commands::admin::approve_request,
            commands::admin::deny_request,
            commands::admin::query_audit_events,
            commands::admin::verify_audit_chain,
            commands::admin::export_diagnostics,
        ])
        .run(tauri::generate_context!())
        .expect("error running AION Defensa Predictiva");
}

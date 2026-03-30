use tauri::State;

use lah_core::config::AppConfig;
use lah_core::error::AppError;
use lah_core::types::ProviderHealth;

use crate::state::AppState;

/// Get current app configuration (no secrets).
#[tauri::command]
pub fn get_config(state: State<'_, AppState>) -> Result<AppConfig, AppError> {
    Ok(state.config.lock().unwrap().clone())
}

/// Update app configuration.
#[tauri::command]
pub fn update_config(
    state: State<'_, AppState>,
    config: AppConfig,
) -> Result<(), AppError> {
    *state.config.lock().unwrap() = config;
    tracing::info!("Configuration updated");
    Ok(())
}

/// Test Supabase connection with provided URL and anon key.
#[tauri::command]
pub async fn test_supabase_connection(
    url: String,
    anon_key: String,
) -> Result<bool, AppError> {
    let provider = lah_provider_supabase::SupabaseProvider::new(&url, &anon_key);
    let health = provider.health_check().await;
    Ok(health.is_healthy)
}

/// Get health status of all providers.
#[tauri::command]
pub async fn get_health_status(
    state: State<'_, AppState>,
) -> Result<Vec<ProviderHealth>, AppError> {
    let mut results = Vec::new();

    // Supabase
    if let Some(sb) = state.supabase.lock().unwrap().as_ref() {
        results.push(sb.health_check().await);
    }

    // Add circuit breaker status
    results.push(ProviderHealth {
        provider: "sync_circuit_breaker".into(),
        is_healthy: !state.circuit_breaker.is_open(),
        latency_ms: None,
        last_check: chrono::Utc::now(),
        error: if state.circuit_breaker.is_open() {
            Some(format!("Circuit breaker is {}", state.circuit_breaker.state_name()))
        } else {
            None
        },
    });

    Ok(results)
}

use tauri::State;

use lah_core::error::AppError;
use lah_sync::queue::QueueStats;

use crate::state::AppState;

/// Get queue statistics for the current tenant.
#[tauri::command]
pub fn get_queue_stats(state: State<'_, AppState>) -> Result<QueueStats, AppError> {
    let session = state.require_session()?;
    let queue = state.job_queue.lock().unwrap();
    match queue.as_ref() {
        Some(q) => q.stats(&session.tenant_id.0),
        None => Ok(QueueStats {
            queued: 0,
            in_progress: 0,
            completed: 0,
            failed: 0,
            dead_letter: 0,
        }),
    }
}

/// Retry a dead-letter job.
#[tauri::command]
pub fn retry_dead_letter_job(
    state: State<'_, AppState>,
    job_id: String,
) -> Result<(), AppError> {
    state.require_session()?;
    let queue = state.job_queue.lock().unwrap();
    if let Some(q) = queue.as_ref() {
        q.retry_dead_letter(&job_id)?;
    }
    Ok(())
}

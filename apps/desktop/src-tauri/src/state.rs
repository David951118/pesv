use std::sync::Mutex;

use lah_audit::AuditLog;
use lah_core::config::AppConfig;
use lah_core::types::Session;
use lah_policy::ApprovalManager;
use lah_provider_supabase::SupabaseProvider;
use lah_sync::circuit_breaker::CircuitBreaker;
use lah_sync::queue::JobQueue;
use lah_sync::rate_limiter::TokenBucket;

/// Application state shared across all Tauri commands.
///
/// All mutable state is behind Mutex for thread safety.
/// Tokens are NOT stored here — they live in Keychain/DPAPI.
pub struct AppState {
    pub config: Mutex<AppConfig>,
    pub session: Mutex<Option<Session>>,
    pub supabase: Mutex<Option<SupabaseProvider>>,
    pub job_queue: Mutex<Option<JobQueue>>,
    pub audit_log: Mutex<Option<AuditLog>>,
    pub approval_manager: Mutex<Option<ApprovalManager>>,
    pub circuit_breaker: CircuitBreaker,
    pub drive_rate_limiter: TokenBucket,
    pub ai_rate_limiter: TokenBucket,
    pub kill_switch: Mutex<bool>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            config: Mutex::new(AppConfig::default()),
            session: Mutex::new(None),
            supabase: Mutex::new(None),
            job_queue: Mutex::new(None),
            audit_log: Mutex::new(None),
            approval_manager: Mutex::new(None),
            circuit_breaker: CircuitBreaker::new(
                "sync",
                5,
                std::time::Duration::from_secs(60),
            ),
            drive_rate_limiter: TokenBucket::new("drive", 3, 1.0),
            ai_rate_limiter: TokenBucket::new("ai", 20, 0.33), // 20 burst, ~20/min
            kill_switch: Mutex::new(false),
        }
    }

    /// Get the current session, or return an error.
    pub fn require_session(&self) -> Result<Session, lah_core::error::AppError> {
        self.session
            .lock()
            .unwrap()
            .clone()
            .ok_or(lah_core::error::AppError::SessionExpired)
    }

    /// Check kill switch.
    pub fn check_kill_switch(&self) -> Result<(), lah_core::error::AppError> {
        if *self.kill_switch.lock().unwrap() {
            Err(lah_core::error::AppError::KillSwitchActive)
        } else {
            Ok(())
        }
    }
}

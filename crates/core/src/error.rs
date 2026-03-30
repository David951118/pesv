use thiserror::Error;

pub type AppResult<T> = Result<T, AppError>;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("Authentication failed: {message}")]
    AuthenticationFailed { message: String },

    #[error("Session expired")]
    SessionExpired,

    #[error("Unauthorized: {action} on {resource}")]
    Unauthorized { action: String, resource: String },

    #[error("Tenant isolation violation: {0}")]
    TenantViolation(String),

    #[error("Rate limited: retry after {retry_after_secs}s")]
    RateLimited { retry_after_secs: u64 },

    #[error("Quota exceeded for {resource}")]
    QuotaExceeded { resource: String },

    #[error("Budget exceeded: {provider} (used ${used:.2} of ${limit:.2})")]
    BudgetExceeded {
        provider: String,
        used: f64,
        limit: f64,
    },

    #[error("Network error: {message}")]
    NetworkError { message: String },

    #[error("Not found: {resource} {id}")]
    NotFound { resource: String, id: String },

    #[error("Crypto error: {0}")]
    CryptoError(String),

    #[error("Storage error: {0}")]
    StorageError(String),

    #[error("Sync error: {0}")]
    SyncError(String),

    #[error("Policy denied: {action} — {reason}")]
    PolicyDenied { action: String, reason: String },

    #[error("Approval required for: {action}")]
    ApprovalRequired { action: String },

    #[error("Data classification violation: {0}")]
    ClassificationViolation(String),

    #[error("Path traversal detected: {0}")]
    PathTraversal(String),

    #[error("Integrity check failed: {0}")]
    IntegrityError(String),

    #[error("Configuration error: {0}")]
    ConfigError(String),

    #[error("Provider error ({provider}): {message}")]
    ProviderError { provider: String, message: String },

    #[error("Circuit breaker open for {service}")]
    CircuitOpen { service: String },

    #[error("Kill switch active")]
    KillSwitchActive,

    #[error("Legal hold active: cannot delete {resource}")]
    LegalHold { resource: String },

    #[error("Encryption failsafe: {0}")]
    EncryptionFailsafe(String),

    #[error("Internal error: {0}")]
    Internal(String),

    #[error(transparent)]
    Io(#[from] std::io::Error),
}

impl serde::Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        use serde::ser::SerializeStruct;
        let mut state = serializer.serialize_struct("AppError", 2)?;
        state.serialize_field("code", &self.error_code())?;
        state.serialize_field("message", &self.to_string())?;
        state.end()
    }
}

impl AppError {
    pub fn error_code(&self) -> &'static str {
        match self {
            Self::AuthenticationFailed { .. } => "AUTH_FAILED",
            Self::SessionExpired => "SESSION_EXPIRED",
            Self::Unauthorized { .. } => "UNAUTHORIZED",
            Self::TenantViolation(_) => "TENANT_VIOLATION",
            Self::RateLimited { .. } => "RATE_LIMITED",
            Self::QuotaExceeded { .. } => "QUOTA_EXCEEDED",
            Self::BudgetExceeded { .. } => "BUDGET_EXCEEDED",
            Self::NetworkError { .. } => "NETWORK_ERROR",
            Self::NotFound { .. } => "NOT_FOUND",
            Self::CryptoError(_) => "CRYPTO_ERROR",
            Self::StorageError(_) => "STORAGE_ERROR",
            Self::SyncError(_) => "SYNC_ERROR",
            Self::PolicyDenied { .. } => "POLICY_DENIED",
            Self::ApprovalRequired { .. } => "APPROVAL_REQUIRED",
            Self::ClassificationViolation(_) => "CLASSIFICATION_VIOLATION",
            Self::PathTraversal(_) => "PATH_TRAVERSAL",
            Self::IntegrityError(_) => "INTEGRITY_ERROR",
            Self::ConfigError(_) => "CONFIG_ERROR",
            Self::ProviderError { .. } => "PROVIDER_ERROR",
            Self::CircuitOpen { .. } => "CIRCUIT_OPEN",
            Self::KillSwitchActive => "KILL_SWITCH",
            Self::LegalHold { .. } => "LEGAL_HOLD",
            Self::EncryptionFailsafe(_) => "ENCRYPTION_FAILSAFE",
            Self::Internal(_) => "INTERNAL_ERROR",
            Self::Io(_) => "IO_ERROR",
        }
    }
}

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

// ── Tenant & User ───────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TenantId(pub String);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserId(pub String);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    pub user_id: UserId,
    pub tenant_id: TenantId,
    pub email: String,
    pub role: UserRole,
    pub access_token: String,
    pub refresh_token: String,
    pub expires_at: DateTime<Utc>,
}

impl Session {
    pub fn is_expired(&self) -> bool {
        Utc::now() >= self.expires_at
    }
    pub fn needs_refresh(&self) -> bool {
        Utc::now() >= self.expires_at - chrono::Duration::minutes(5)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum UserRole {
    Admin,
    Operator,
    Viewer,
    Conductor,
}

// ── Data Classification ─────────────────────────────────────────────────────

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, PartialOrd)]
pub enum DataClassification {
    Public = 0,
    Internal = 1,
    Confidential = 2,
    Restricted = 3,
}

impl std::fmt::Display for DataClassification {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Public => write!(f, "PUBLIC"),
            Self::Internal => write!(f, "INTERNAL"),
            Self::Confidential => write!(f, "CONFIDENTIAL"),
            Self::Restricted => write!(f, "RESTRICTED"),
        }
    }
}

// ── Files ───────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileRecord {
    pub id: String,
    pub tenant_id: String,
    pub user_id: String,
    pub original_name: String,
    pub mime_type: Option<String>,
    pub size_bytes: i64,
    pub blake3_hash: String,
    pub enc_blake3_hash: String,
    pub encryption_key_id: String,
    pub wrapped_dek: String,
    pub nonce: String,
    pub version: i32,
    pub classification: DataClassification,
    pub tags: Vec<String>,
    pub sync_status: SyncStatus,
    pub drive_file_id: Option<String>,
    pub drive_sync_at: Option<DateTime<Utc>>,
    pub legal_hold: bool,
    pub retention_until: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum SyncStatus {
    Pending,
    Syncing,
    Synced,
    Error,
    Conflict,
}

impl std::fmt::Display for SyncStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Pending => write!(f, "pending"),
            Self::Syncing => write!(f, "syncing"),
            Self::Synced => write!(f, "synced"),
            Self::Error => write!(f, "error"),
            Self::Conflict => write!(f, "conflict"),
        }
    }
}

// ── Sync Jobs ───────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncJob {
    pub id: String,
    pub file_id: String,
    pub tenant_id: String,
    pub job_type: JobType,
    pub status: JobStatus,
    pub attempts: i32,
    pub max_attempts: i32,
    pub next_retry_at: Option<DateTime<Utc>>,
    pub last_error: Option<String>,
    pub created_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum JobType {
    UploadDrive,
    DeleteDrive,
    UploadSupabase,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum JobStatus {
    Queued,
    InProgress,
    Completed,
    Failed,
    DeadLetter,
}

impl std::fmt::Display for JobStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Queued => write!(f, "queued"),
            Self::InProgress => write!(f, "in_progress"),
            Self::Completed => write!(f, "completed"),
            Self::Failed => write!(f, "failed"),
            Self::DeadLetter => write!(f, "dead_letter"),
        }
    }
}

// ── Audit ───────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditEvent {
    pub id: String,
    pub tenant_id: String,
    pub user_id: String,
    pub action: String,
    pub resource_type: String,
    pub resource_id: Option<String>,
    pub outcome: AuditOutcome,
    pub details: serde_json::Value,
    pub prev_hash: String,
    pub event_hash: String,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AuditOutcome {
    Success,
    Denied,
    Error,
}

// ── Approvals ───────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApprovalRequest {
    pub id: String,
    pub tenant_id: String,
    pub requester_id: String,
    pub action: String,
    pub resource_type: String,
    pub resource_id: String,
    pub justification: String,
    pub status: ApprovalStatus,
    pub decided_by: Option<String>,
    pub decided_at: Option<DateTime<Utc>>,
    pub decision_reason: Option<String>,
    pub created_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ApprovalStatus {
    Pending,
    Approved,
    Denied,
    Expired,
}

// ── AI ──────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AIProviderType {
    OpenAI,
    Claude,
}

impl std::fmt::Display for AIProviderType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::OpenAI => write!(f, "openai"),
            Self::Claude => write!(f, "claude"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIMessage {
    pub role: AIRole,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AIRole {
    System,
    User,
    Assistant,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIRequest {
    pub messages: Vec<AIMessage>,
    pub max_tokens: Option<u32>,
    pub temperature: Option<f32>,
    pub purpose: String,
    pub source_file_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIResponse {
    pub content: String,
    pub model: String,
    pub input_tokens: u32,
    pub output_tokens: u32,
    pub estimated_cost_usd: f64,
    pub finish_reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIUsage {
    pub total_requests_today: u32,
    pub total_tokens_today: u64,
    pub cost_today_usd: f64,
    pub cost_month_usd: f64,
    pub budget_remaining_usd: f64,
}

// ── Provider Health ─────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderHealth {
    pub provider: String,
    pub is_healthy: bool,
    pub latency_ms: Option<u64>,
    pub last_check: DateTime<Utc>,
    pub error: Option<String>,
}

// ── Config ──────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncStatusSummary {
    pub total_files: u64,
    pub synced: u64,
    pub pending: u64,
    pub syncing: u64,
    pub errors: u64,
    pub dead_letter: u64,
    pub last_sync_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CostUsage {
    pub tenant_id: String,
    pub provider: String,
    pub period: String,
    pub requests: u32,
    pub tokens: u64,
    pub cost_usd: f64,
    pub budget_usd: f64,
}

pub fn new_id() -> String {
    Uuid::now_v7().to_string()
}

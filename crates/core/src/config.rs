use serde::{Deserialize, Serialize};
use std::path::PathBuf;

use crate::types::AIProviderType;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub environment: Environment,
    pub supabase: SupabaseConfig,
    pub features: FeatureFlags,
    pub storage: StorageConfig,
    pub sync: SyncConfig,
    pub ai: AIConfig,
    pub logging: LoggingConfig,
    pub retention: RetentionConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Environment {
    Development,
    Staging,
    Production,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SupabaseConfig {
    pub url: String,
    pub anon_key: String,
    // service_role_key: NEVER stored in client
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FeatureFlags {
    pub ai_enabled: bool,
    pub drive_backup_enabled: bool,
    pub github_enabled: bool,
    pub aion_enabled: bool,
    pub offline_mode: bool,
    pub approval_workflow_enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageConfig {
    pub data_dir: PathBuf,
    pub max_local_storage_gb: u64,
    pub max_file_size_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncConfig {
    pub batch_interval_secs: u64,
    pub max_batch_size: usize,
    pub max_concurrent_uploads: usize,
    pub retry_max_attempts: i32,
    pub retry_base_delay_ms: u64,
    pub circuit_breaker_threshold: u32,
    pub circuit_breaker_recovery_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIConfig {
    pub default_provider: AIProviderType,
    pub max_tokens_per_request: u32,
    pub monthly_budget_usd: f64,
    pub daily_budget_usd: f64,
    pub cache_ttl_secs: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoggingConfig {
    pub level: String,
    pub diagnostic_mode: bool,
    pub max_log_file_mb: u64,
    pub log_retention_days: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RetentionConfig {
    pub default_retention_days: u32,
    pub legal_hold_enabled: bool,
    pub backup_retention_days: u32,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            environment: Environment::Production,
            supabase: SupabaseConfig {
                url: String::new(),
                anon_key: String::new(),
            },
            features: FeatureFlags {
                ai_enabled: false,
                drive_backup_enabled: false,
                github_enabled: false,
                aion_enabled: false,
                offline_mode: false,
                approval_workflow_enabled: true,
            },
            storage: StorageConfig {
                data_dir: dirs::data_local_dir()
                    .unwrap_or_else(|| PathBuf::from("."))
                    .join("AIONDefensaPredictiva"),
                max_local_storage_gb: 50,
                max_file_size_bytes: 500 * 1024 * 1024, // 500 MB
            },
            sync: SyncConfig {
                batch_interval_secs: 300,
                max_batch_size: 10,
                max_concurrent_uploads: 3,
                retry_max_attempts: 8,
                retry_base_delay_ms: 2000,
                circuit_breaker_threshold: 5,
                circuit_breaker_recovery_ms: 60_000,
            },
            ai: AIConfig {
                default_provider: AIProviderType::Claude,
                max_tokens_per_request: 4096,
                monthly_budget_usd: 100.0,
                daily_budget_usd: 10.0,
                cache_ttl_secs: 3600,
            },
            logging: LoggingConfig {
                level: "info".to_string(),
                diagnostic_mode: false,
                max_log_file_mb: 50,
                log_retention_days: 30,
            },
            retention: RetentionConfig {
                default_retention_days: 365,
                legal_hold_enabled: false,
                backup_retention_days: 365,
            },
        }
    }
}

impl AppConfig {
    pub fn tenant_data_dir(&self, tenant_id: &str) -> PathBuf {
        self.storage.data_dir.join("tenants").join(tenant_id)
    }

    pub fn user_files_dir(&self, tenant_id: &str, user_id: &str) -> PathBuf {
        self.tenant_data_dir(tenant_id)
            .join("users")
            .join(user_id)
            .join("files")
    }

    pub fn logs_dir(&self) -> PathBuf {
        self.storage.data_dir.join("logs")
    }

    pub fn db_path(&self, tenant_id: &str) -> PathBuf {
        self.tenant_data_dir(tenant_id).join("metadata.db")
    }
}

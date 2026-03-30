use chrono::{Duration, Utc};
use rusqlite::{params, Connection};

use lah_core::error::{AppError, AppResult};

/// Retention and legal hold manager.
///
/// Enforces data retention policies per tenant:
/// - Files are retained for a configurable period (default 365 days)
/// - Legal hold prevents deletion regardless of retention policy
/// - Expired files are marked for deletion but not auto-deleted
///   (deletion requires explicit action after retention expires)
pub struct RetentionManager;

impl RetentionManager {
    /// Check if a file can be deleted based on retention policy and legal hold.
    pub fn can_delete(
        conn: &Connection,
        file_id: &str,
        tenant_id: &str,
    ) -> AppResult<RetentionCheck> {
        let row: (bool, Option<String>) = conn
            .query_row(
                "SELECT legal_hold, retention_until FROM files WHERE id = ?1 AND tenant_id = ?2",
                params![file_id, tenant_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .map_err(|e| AppError::NotFound {
                resource: "file".into(),
                id: file_id.into(),
            })?;

        let (legal_hold, retention_until) = row;

        if legal_hold {
            return Ok(RetentionCheck::Blocked {
                reason: "File is under legal hold and cannot be deleted".into(),
            });
        }

        if let Some(until_str) = retention_until {
            if let Ok(until) = chrono::DateTime::parse_from_rfc3339(&until_str) {
                if Utc::now() < until.with_timezone(&Utc) {
                    return Ok(RetentionCheck::Blocked {
                        reason: format!(
                            "File is under retention until {}",
                            until.format("%Y-%m-%d")
                        ),
                    });
                }
            }
        }

        Ok(RetentionCheck::Allowed)
    }

    /// Set legal hold on a file.
    pub fn set_legal_hold(
        conn: &Connection,
        file_id: &str,
        tenant_id: &str,
        hold: bool,
    ) -> AppResult<()> {
        conn.execute(
            "UPDATE files SET legal_hold = ?1, updated_at = ?2 WHERE id = ?3 AND tenant_id = ?4",
            params![hold, Utc::now().to_rfc3339(), file_id, tenant_id],
        )
        .map_err(|e| AppError::StorageError(format!("Set legal hold failed: {e}")))?;

        tracing::info!(
            file_id = file_id,
            legal_hold = hold,
            "Legal hold updated"
        );
        Ok(())
    }

    /// Set retention period for a file.
    pub fn set_retention(
        conn: &Connection,
        file_id: &str,
        tenant_id: &str,
        retention_days: u32,
    ) -> AppResult<()> {
        let until = Utc::now() + Duration::days(retention_days as i64);
        conn.execute(
            "UPDATE files SET retention_until = ?1, updated_at = ?2 WHERE id = ?3 AND tenant_id = ?4",
            params![until.to_rfc3339(), Utc::now().to_rfc3339(), file_id, tenant_id],
        )
        .map_err(|e| AppError::StorageError(format!("Set retention failed: {e}")))?;

        Ok(())
    }

    /// Find files that have exceeded their retention period and are not under legal hold.
    pub fn find_expired(conn: &Connection, tenant_id: &str) -> AppResult<Vec<String>> {
        let now = Utc::now().to_rfc3339();
        let mut stmt = conn
            .prepare(
                "SELECT id FROM files
                 WHERE tenant_id = ?1 AND legal_hold = 0
                 AND retention_until IS NOT NULL AND retention_until < ?2
                 AND deleted_at IS NULL",
            )
            .map_err(|e| AppError::StorageError(format!("Query failed: {e}")))?;

        let rows = stmt
            .query_map(params![tenant_id, now], |row| row.get(0))
            .map_err(|e| AppError::StorageError(format!("Query map failed: {e}")))?;

        let mut ids = Vec::new();
        for row in rows {
            ids.push(row.map_err(|e| AppError::StorageError(e.to_string()))?);
        }
        Ok(ids)
    }
}

#[derive(Debug)]
pub enum RetentionCheck {
    Allowed,
    Blocked { reason: String },
}

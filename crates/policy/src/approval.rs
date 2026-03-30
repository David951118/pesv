use chrono::{Duration, Utc};
use rusqlite::{params, Connection};

use lah_core::error::{AppError, AppResult};
use lah_core::types::{ApprovalRequest, ApprovalStatus};

/// Approval workflow for sensitive actions.
///
/// When PolicyEngine decides an action requires approval, an ApprovalRequest
/// is created and must be approved by an admin before the action proceeds.
pub struct ApprovalManager {
    conn: Connection,
}

impl ApprovalManager {
    pub fn open(db_path: &std::path::Path) -> AppResult<Self> {
        let conn = Connection::open(db_path)
            .map_err(|e| AppError::StorageError(format!("Approval DB open failed: {e}")))?;

        conn.execute_batch(
            "
            PRAGMA journal_mode = WAL;

            CREATE TABLE IF NOT EXISTS approvals (
                id              TEXT PRIMARY KEY,
                tenant_id       TEXT NOT NULL,
                requester_id    TEXT NOT NULL,
                action          TEXT NOT NULL,
                resource_type   TEXT NOT NULL,
                resource_id     TEXT NOT NULL,
                justification   TEXT NOT NULL DEFAULT '',
                status          TEXT NOT NULL DEFAULT 'pending',
                decided_by      TEXT,
                decided_at      TEXT,
                decision_reason TEXT,
                created_at      TEXT NOT NULL,
                expires_at      TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_approvals_tenant
                ON approvals(tenant_id, status);
            CREATE INDEX IF NOT EXISTS idx_approvals_requester
                ON approvals(requester_id, status);
            ",
        )
        .map_err(|e| AppError::StorageError(format!("Approval DB init failed: {e}")))?;

        Ok(Self { conn })
    }

    /// Create a new approval request. Expires after 24 hours by default.
    pub fn request(
        &self,
        tenant_id: &str,
        requester_id: &str,
        action: &str,
        resource_type: &str,
        resource_id: &str,
        justification: &str,
    ) -> AppResult<ApprovalRequest> {
        let id = lah_core::new_id();
        let now = Utc::now();
        let expires = now + Duration::hours(24);

        let request = ApprovalRequest {
            id: id.clone(),
            tenant_id: tenant_id.into(),
            requester_id: requester_id.into(),
            action: action.into(),
            resource_type: resource_type.into(),
            resource_id: resource_id.into(),
            justification: justification.into(),
            status: ApprovalStatus::Pending,
            decided_by: None,
            decided_at: None,
            decision_reason: None,
            created_at: now,
            expires_at: expires,
        };

        self.conn
            .execute(
                "INSERT INTO approvals (id, tenant_id, requester_id, action, resource_type, resource_id, justification, status, created_at, expires_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'pending', ?8, ?9)",
                params![
                    id, tenant_id, requester_id, action, resource_type, resource_id,
                    justification, now.to_rfc3339(), expires.to_rfc3339(),
                ],
            )
            .map_err(|e| AppError::StorageError(format!("Approval insert failed: {e}")))?;

        tracing::info!(
            approval_id = id.as_str(),
            action = action,
            requester = requester_id,
            "Approval request created"
        );

        Ok(request)
    }

    /// Approve a pending request.
    pub fn approve(
        &self,
        approval_id: &str,
        admin_id: &str,
        reason: &str,
    ) -> AppResult<()> {
        self.decide(approval_id, admin_id, ApprovalStatus::Approved, reason)
    }

    /// Deny a pending request.
    pub fn deny(
        &self,
        approval_id: &str,
        admin_id: &str,
        reason: &str,
    ) -> AppResult<()> {
        self.decide(approval_id, admin_id, ApprovalStatus::Denied, reason)
    }

    fn decide(
        &self,
        approval_id: &str,
        admin_id: &str,
        status: ApprovalStatus,
        reason: &str,
    ) -> AppResult<()> {
        let status_str = match status {
            ApprovalStatus::Approved => "approved",
            ApprovalStatus::Denied => "denied",
            _ => return Err(AppError::Internal("Invalid decision status".into())),
        };

        // Verify it's still pending and not expired
        let current_status: String = self
            .conn
            .query_row(
                "SELECT status FROM approvals WHERE id = ?1",
                params![approval_id],
                |row| row.get(0),
            )
            .map_err(|_| AppError::NotFound {
                resource: "approval".into(),
                id: approval_id.into(),
            })?;

        if current_status != "pending" {
            return Err(AppError::PolicyDenied {
                action: "decide_approval".into(),
                reason: format!("Approval is already {current_status}"),
            });
        }

        self.conn
            .execute(
                "UPDATE approvals SET status = ?1, decided_by = ?2, decided_at = ?3, decision_reason = ?4
                 WHERE id = ?5 AND status = 'pending'",
                params![
                    status_str,
                    admin_id,
                    Utc::now().to_rfc3339(),
                    reason,
                    approval_id,
                ],
            )
            .map_err(|e| AppError::StorageError(format!("Approval update failed: {e}")))?;

        tracing::info!(
            approval_id = approval_id,
            decision = status_str,
            admin = admin_id,
            "Approval decided"
        );

        Ok(())
    }

    /// Check if a specific action has been approved for a resource.
    pub fn is_approved(
        &self,
        tenant_id: &str,
        action: &str,
        resource_id: &str,
    ) -> AppResult<bool> {
        let count: i32 = self
            .conn
            .query_row(
                "SELECT COUNT(*) FROM approvals
                 WHERE tenant_id = ?1 AND action = ?2 AND resource_id = ?3
                 AND status = 'approved' AND expires_at > ?4",
                params![tenant_id, action, resource_id, Utc::now().to_rfc3339()],
                |row| row.get(0),
            )
            .map_err(|e| AppError::StorageError(format!("Approval check failed: {e}")))?;

        Ok(count > 0)
    }

    /// List pending approvals for a tenant.
    pub fn list_pending(&self, tenant_id: &str) -> AppResult<Vec<ApprovalRequest>> {
        // Expire stale requests first
        self.conn
            .execute(
                "UPDATE approvals SET status = 'expired' WHERE status = 'pending' AND expires_at < ?1",
                params![Utc::now().to_rfc3339()],
            )
            .ok();

        let mut stmt = self
            .conn
            .prepare(
                "SELECT id, tenant_id, requester_id, action, resource_type, resource_id,
                        justification, status, decided_by, decided_at, decision_reason,
                        created_at, expires_at
                 FROM approvals WHERE tenant_id = ?1 AND status = 'pending'
                 ORDER BY created_at DESC",
            )
            .map_err(|e| AppError::StorageError(format!("Query failed: {e}")))?;

        let rows = stmt
            .query_map(params![tenant_id], |row| {
                Ok(ApprovalRequest {
                    id: row.get(0)?,
                    tenant_id: row.get(1)?,
                    requester_id: row.get(2)?,
                    action: row.get(3)?,
                    resource_type: row.get(4)?,
                    resource_id: row.get(5)?,
                    justification: row.get(6)?,
                    status: ApprovalStatus::Pending,
                    decided_by: row.get(8)?,
                    decided_at: row.get(9)?,
                    decision_reason: row.get(10)?,
                    created_at: row.get(11)?,
                    expires_at: row.get(12)?,
                })
            })
            .map_err(|e| AppError::StorageError(format!("Query map failed: {e}")))?;

        let mut results = Vec::new();
        for row in rows {
            results.push(row.map_err(|e| AppError::StorageError(e.to_string()))?);
        }
        Ok(results)
    }
}

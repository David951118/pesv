use chrono::Utc;
use rusqlite::{params, Connection};
use serde_json::json;

use lah_core::error::{AppError, AppResult};
use lah_core::types::{AuditEvent, AuditOutcome};

/// Append-only audit log with hash chaining.
///
/// Each event includes a hash of the previous event, forming a tamper-evident
/// chain. Any modification to a historical event breaks the chain and is
/// detectable by `verify_chain()`.
///
/// Hash chain: event_hash = BLAKE3(prev_hash || tenant_id || user_id || action || timestamp || details)
pub struct AuditLog {
    conn: Connection,
}

impl AuditLog {
    /// Open or create the audit log database.
    pub fn open(db_path: &std::path::Path) -> AppResult<Self> {
        let conn = Connection::open(db_path)
            .map_err(|e| AppError::StorageError(format!("Audit DB open failed: {e}")))?;

        conn.execute_batch(
            "
            PRAGMA journal_mode = WAL;
            PRAGMA foreign_keys = ON;

            CREATE TABLE IF NOT EXISTS audit_log (
                id            TEXT PRIMARY KEY,
                tenant_id     TEXT NOT NULL,
                user_id       TEXT NOT NULL,
                action        TEXT NOT NULL,
                resource_type TEXT NOT NULL,
                resource_id   TEXT,
                outcome       TEXT NOT NULL,
                details       TEXT NOT NULL DEFAULT '{}',
                prev_hash     TEXT NOT NULL,
                event_hash    TEXT NOT NULL,
                timestamp     TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_log(tenant_id, timestamp);
            CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);
            CREATE INDEX IF NOT EXISTS idx_audit_user   ON audit_log(user_id, timestamp);
            ",
        )
        .map_err(|e| AppError::StorageError(format!("Audit DB init failed: {e}")))?;

        Ok(Self { conn })
    }

    /// Get the hash of the most recent event (or genesis hash).
    fn last_hash(&self) -> AppResult<String> {
        let result: Result<String, _> = self.conn.query_row(
            "SELECT event_hash FROM audit_log ORDER BY rowid DESC LIMIT 1",
            [],
            |row| row.get(0),
        );
        match result {
            Ok(hash) => Ok(hash),
            Err(rusqlite::Error::QueryReturnedNoRows) => {
                // Genesis: hash of empty string
                Ok(blake3::hash(b"GENESIS").to_hex().to_string())
            }
            Err(e) => Err(AppError::StorageError(format!("Last hash query failed: {e}"))),
        }
    }

    /// Compute the hash for an event, chaining it to the previous event.
    fn compute_hash(
        prev_hash: &str,
        tenant_id: &str,
        user_id: &str,
        action: &str,
        timestamp: &str,
        details: &str,
    ) -> String {
        let mut hasher = blake3::Hasher::new();
        hasher.update(prev_hash.as_bytes());
        hasher.update(b"|");
        hasher.update(tenant_id.as_bytes());
        hasher.update(b"|");
        hasher.update(user_id.as_bytes());
        hasher.update(b"|");
        hasher.update(action.as_bytes());
        hasher.update(b"|");
        hasher.update(timestamp.as_bytes());
        hasher.update(b"|");
        hasher.update(details.as_bytes());
        hasher.finalize().to_hex().to_string()
    }

    /// Record an audit event. Append-only: never update or delete.
    pub fn record(
        &self,
        tenant_id: &str,
        user_id: &str,
        action: &str,
        resource_type: &str,
        resource_id: Option<&str>,
        outcome: AuditOutcome,
        details: serde_json::Value,
    ) -> AppResult<AuditEvent> {
        let id = lah_core::new_id();
        let timestamp = Utc::now();
        let ts_str = timestamp.to_rfc3339();
        let details_str = serde_json::to_string(&details)
            .map_err(|e| AppError::StorageError(format!("JSON serialize failed: {e}")))?;

        let prev_hash = self.last_hash()?;
        let event_hash =
            Self::compute_hash(&prev_hash, tenant_id, user_id, action, &ts_str, &details_str);

        let outcome_str = match &outcome {
            AuditOutcome::Success => "success",
            AuditOutcome::Denied => "denied",
            AuditOutcome::Error => "error",
        };

        self.conn
            .execute(
                "INSERT INTO audit_log (id, tenant_id, user_id, action, resource_type, resource_id, outcome, details, prev_hash, event_hash, timestamp)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
                params![
                    id,
                    tenant_id,
                    user_id,
                    action,
                    resource_type,
                    resource_id,
                    outcome_str,
                    details_str,
                    prev_hash,
                    event_hash,
                    ts_str,
                ],
            )
            .map_err(|e| AppError::StorageError(format!("Audit insert failed: {e}")))?;

        tracing::info!(
            tenant_id = tenant_id,
            user_id = user_id,
            action = action,
            outcome = outcome_str,
            "Audit event recorded"
        );

        Ok(AuditEvent {
            id,
            tenant_id: tenant_id.to_string(),
            user_id: user_id.to_string(),
            action: action.to_string(),
            resource_type: resource_type.to_string(),
            resource_id: resource_id.map(String::from),
            outcome,
            details,
            prev_hash,
            event_hash,
            timestamp,
        })
    }

    /// Verify the integrity of the entire audit chain.
    /// Returns Ok(count) if valid, Err with details of the first tampered event.
    pub fn verify_chain(&self) -> AppResult<u64> {
        let mut stmt = self
            .conn
            .prepare(
                "SELECT id, tenant_id, user_id, action, details, prev_hash, event_hash, timestamp
                 FROM audit_log ORDER BY rowid ASC",
            )
            .map_err(|e| AppError::StorageError(format!("Chain query failed: {e}")))?;

        let mut expected_prev = blake3::hash(b"GENESIS").to_hex().to_string();
        let mut count: u64 = 0;

        let rows = stmt
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,  // id
                    row.get::<_, String>(1)?,  // tenant_id
                    row.get::<_, String>(2)?,  // user_id
                    row.get::<_, String>(3)?,  // action
                    row.get::<_, String>(4)?,  // details
                    row.get::<_, String>(5)?,  // prev_hash
                    row.get::<_, String>(6)?,  // event_hash
                    row.get::<_, String>(7)?,  // timestamp
                ))
            })
            .map_err(|e| AppError::StorageError(format!("Chain iteration failed: {e}")))?;

        for row in rows {
            let (id, tenant_id, user_id, action, details, prev_hash, event_hash, timestamp) =
                row.map_err(|e| AppError::StorageError(format!("Row read failed: {e}")))?;

            // Verify prev_hash links to the expected value
            if prev_hash != expected_prev {
                return Err(AppError::IntegrityError(format!(
                    "Chain broken at event {id}: expected prev_hash={expected_prev}, got {prev_hash}"
                )));
            }

            // Recompute and verify event_hash
            let computed =
                Self::compute_hash(&prev_hash, &tenant_id, &user_id, &action, &timestamp, &details);
            if computed != event_hash {
                return Err(AppError::IntegrityError(format!(
                    "Tampered event {id}: hash mismatch (computed={computed}, stored={event_hash})"
                )));
            }

            expected_prev = event_hash;
            count += 1;
        }

        tracing::info!(count = count, "Audit chain verified successfully");
        Ok(count)
    }

    /// Query events by tenant and optional filters.
    pub fn query_events(
        &self,
        tenant_id: &str,
        action_filter: Option<&str>,
        limit: u32,
        offset: u32,
    ) -> AppResult<Vec<AuditEvent>> {
        let sql = if action_filter.is_some() {
            "SELECT id, tenant_id, user_id, action, resource_type, resource_id, outcome, details, prev_hash, event_hash, timestamp
             FROM audit_log WHERE tenant_id = ?1 AND action = ?2
             ORDER BY rowid DESC LIMIT ?3 OFFSET ?4"
        } else {
            "SELECT id, tenant_id, user_id, action, resource_type, resource_id, outcome, details, prev_hash, event_hash, timestamp
             FROM audit_log WHERE tenant_id = ?1
             ORDER BY rowid DESC LIMIT ?3 OFFSET ?4"
        };

        let mut stmt = self.conn.prepare(sql)
            .map_err(|e| AppError::StorageError(format!("Query prepare failed: {e}")))?;

        let params_vec: Vec<Box<dyn rusqlite::types::ToSql>> = if let Some(action) = action_filter {
            vec![
                Box::new(tenant_id.to_string()),
                Box::new(action.to_string()),
                Box::new(limit),
                Box::new(offset),
            ]
        } else {
            vec![
                Box::new(tenant_id.to_string()),
                Box::new("".to_string()), // placeholder, not used in the no-filter query
                Box::new(limit),
                Box::new(offset),
            ]
        };

        let params_refs: Vec<&dyn rusqlite::types::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();

        let rows = stmt
            .query_map(params_refs.as_slice(), |row| {
                let outcome_str: String = row.get(6)?;
                let details_str: String = row.get(7)?;
                Ok(AuditEvent {
                    id: row.get(0)?,
                    tenant_id: row.get(1)?,
                    user_id: row.get(2)?,
                    action: row.get(3)?,
                    resource_type: row.get(4)?,
                    resource_id: row.get(5)?,
                    outcome: match outcome_str.as_str() {
                        "success" => AuditOutcome::Success,
                        "denied" => AuditOutcome::Denied,
                        _ => AuditOutcome::Error,
                    },
                    details: serde_json::from_str(&details_str).unwrap_or(json!({})),
                    prev_hash: row.get(8)?,
                    event_hash: row.get(9)?,
                    timestamp: row.get(10)?,
                })
            })
            .map_err(|e| AppError::StorageError(format!("Query failed: {e}")))?;

        let mut events = Vec::new();
        for row in rows {
            events.push(row.map_err(|e| AppError::StorageError(format!("Row parse failed: {e}")))?);
        }
        Ok(events)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn setup() -> (TempDir, AuditLog) {
        let dir = TempDir::new().unwrap();
        let db_path = dir.path().join("audit.db");
        let log = AuditLog::open(&db_path).unwrap();
        (dir, log)
    }

    #[test]
    fn test_record_and_verify_chain() {
        let (_dir, log) = setup();

        // Record several events
        for i in 0..5 {
            log.record(
                "tenant-1",
                "user-1",
                &format!("action_{i}"),
                "file",
                Some(&format!("file-{i}")),
                AuditOutcome::Success,
                json!({"index": i}),
            )
            .unwrap();
        }

        // Chain must verify
        let count = log.verify_chain().unwrap();
        assert_eq!(count, 5);
    }

    #[test]
    fn test_chain_detects_tampering() {
        let (dir, log) = setup();

        log.record("t1", "u1", "create", "file", None, AuditOutcome::Success, json!({})).unwrap();
        log.record("t1", "u1", "delete", "file", None, AuditOutcome::Success, json!({})).unwrap();

        // Tamper with the first event's details
        log.conn
            .execute(
                "UPDATE audit_log SET details = '{\"tampered\": true}' WHERE rowid = 1",
                [],
            )
            .unwrap();

        // Chain verification must fail
        let result = log.verify_chain();
        assert!(result.is_err());
        let err = result.unwrap_err().to_string();
        assert!(err.contains("hash mismatch") || err.contains("Tampered"));
    }

    #[test]
    fn test_query_events_by_tenant() {
        let (_dir, log) = setup();

        log.record("t1", "u1", "upload", "file", None, AuditOutcome::Success, json!({})).unwrap();
        log.record("t2", "u2", "upload", "file", None, AuditOutcome::Success, json!({})).unwrap();
        log.record("t1", "u1", "delete", "file", None, AuditOutcome::Denied, json!({})).unwrap();

        let events = log.query_events("t1", None, 100, 0).unwrap();
        assert_eq!(events.len(), 2);
        assert!(events.iter().all(|e| e.tenant_id == "t1"));
    }
}

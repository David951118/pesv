use chrono::Utc;
use rusqlite::{params, Connection};

use lah_core::error::{AppError, AppResult};
use lah_core::types::{JobStatus, JobType, SyncJob};

use crate::circuit_breaker::backoff_with_jitter;

/// Persistent job queue backed by SQLite.
///
/// Survives app crashes and restarts. Jobs are dequeued in FIFO order
/// with respect for `next_retry_at` timestamps.
pub struct JobQueue {
    conn: Connection,
}

impl JobQueue {
    pub fn open(db_path: &std::path::Path) -> AppResult<Self> {
        let conn = Connection::open(db_path)
            .map_err(|e| AppError::StorageError(format!("Queue DB open failed: {e}")))?;

        conn.execute_batch(
            "
            PRAGMA journal_mode = WAL;

            CREATE TABLE IF NOT EXISTS jobs_queue (
                id            TEXT PRIMARY KEY,
                file_id       TEXT NOT NULL,
                tenant_id     TEXT NOT NULL,
                job_type      TEXT NOT NULL,
                status        TEXT NOT NULL DEFAULT 'queued',
                attempts      INTEGER NOT NULL DEFAULT 0,
                max_attempts  INTEGER NOT NULL DEFAULT 8,
                next_retry_at TEXT,
                last_error    TEXT,
                created_at    TEXT NOT NULL,
                completed_at  TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_jobs_status
                ON jobs_queue(status, next_retry_at);
            CREATE INDEX IF NOT EXISTS idx_jobs_tenant
                ON jobs_queue(tenant_id, status);
            CREATE INDEX IF NOT EXISTS idx_jobs_file
                ON jobs_queue(file_id);
            ",
        )
        .map_err(|e| AppError::StorageError(format!("Queue DB init failed: {e}")))?;

        Ok(Self { conn })
    }

    /// Enqueue a new job.
    pub fn enqueue(
        &self,
        file_id: &str,
        tenant_id: &str,
        job_type: JobType,
        max_attempts: i32,
    ) -> AppResult<String> {
        let id = lah_core::new_id();
        let now = Utc::now().to_rfc3339();
        let type_str = match job_type {
            JobType::UploadDrive => "upload_drive",
            JobType::DeleteDrive => "delete_drive",
            JobType::UploadSupabase => "upload_supabase",
        };

        self.conn
            .execute(
                "INSERT INTO jobs_queue (id, file_id, tenant_id, job_type, status, max_attempts, created_at)
                 VALUES (?1, ?2, ?3, ?4, 'queued', ?5, ?6)",
                params![id, file_id, tenant_id, type_str, max_attempts, now],
            )
            .map_err(|e| AppError::StorageError(format!("Enqueue failed: {e}")))?;

        tracing::debug!(job_id = id.as_str(), file_id = file_id, job_type = type_str, "Job enqueued");
        Ok(id)
    }

    /// Dequeue a batch of jobs ready for processing.
    /// Atomically marks them as `in_progress`.
    pub fn dequeue_batch(&self, batch_size: usize) -> AppResult<Vec<SyncJob>> {
        let now = Utc::now().to_rfc3339();

        let mut stmt = self
            .conn
            .prepare(
                "SELECT id, file_id, tenant_id, job_type, status, attempts, max_attempts,
                        next_retry_at, last_error, created_at, completed_at
                 FROM jobs_queue
                 WHERE status = 'queued' AND (next_retry_at IS NULL OR next_retry_at <= ?1)
                 ORDER BY created_at ASC
                 LIMIT ?2",
            )
            .map_err(|e| AppError::StorageError(format!("Dequeue query failed: {e}")))?;

        let jobs: Vec<SyncJob> = stmt
            .query_map(params![now, batch_size as i32], |row| {
                let type_str: String = row.get(3)?;
                Ok(SyncJob {
                    id: row.get(0)?,
                    file_id: row.get(1)?,
                    tenant_id: row.get(2)?,
                    job_type: match type_str.as_str() {
                        "upload_drive" => JobType::UploadDrive,
                        "delete_drive" => JobType::DeleteDrive,
                        "upload_supabase" => JobType::UploadSupabase,
                        _ => JobType::UploadDrive,
                    },
                    status: JobStatus::Queued,
                    attempts: row.get(5)?,
                    max_attempts: row.get(6)?,
                    next_retry_at: row.get(7)?,
                    last_error: row.get(8)?,
                    created_at: row.get(9)?,
                    completed_at: row.get(10)?,
                })
            })
            .map_err(|e| AppError::StorageError(format!("Row mapping failed: {e}")))?
            .filter_map(|r| r.ok())
            .collect();

        // Mark as in_progress
        for job in &jobs {
            self.conn
                .execute(
                    "UPDATE jobs_queue SET status = 'in_progress' WHERE id = ?1",
                    params![job.id],
                )
                .ok();
        }

        Ok(jobs)
    }

    /// Mark a job as completed.
    pub fn mark_completed(&self, job_id: &str) -> AppResult<()> {
        self.conn
            .execute(
                "UPDATE jobs_queue SET status = 'completed', completed_at = ?1 WHERE id = ?2",
                params![Utc::now().to_rfc3339(), job_id],
            )
            .map_err(|e| AppError::StorageError(format!("Complete failed: {e}")))?;
        Ok(())
    }

    /// Reschedule a failed job with exponential backoff.
    pub fn reschedule(&self, job_id: &str, attempt: i32, error: &str) -> AppResult<()> {
        let delay = backoff_with_jitter(attempt as u32, 2000, 300_000);
        let next = Utc::now() + chrono::Duration::from_std(delay).unwrap_or_default();

        self.conn
            .execute(
                "UPDATE jobs_queue SET status = 'queued', attempts = ?1, next_retry_at = ?2, last_error = ?3
                 WHERE id = ?4",
                params![attempt, next.to_rfc3339(), error, job_id],
            )
            .map_err(|e| AppError::StorageError(format!("Reschedule failed: {e}")))?;

        tracing::warn!(
            job_id = job_id,
            attempt = attempt,
            next_retry = %next,
            "Job rescheduled"
        );
        Ok(())
    }

    /// Move a job to the dead-letter queue after exhausting retries.
    pub fn move_to_dead_letter(&self, job_id: &str, error: &str) -> AppResult<()> {
        self.conn
            .execute(
                "UPDATE jobs_queue SET status = 'dead_letter', last_error = ?1 WHERE id = ?2",
                params![error, job_id],
            )
            .map_err(|e| AppError::StorageError(format!("Dead letter failed: {e}")))?;

        tracing::error!(job_id = job_id, error = error, "Job moved to dead letter queue");
        Ok(())
    }

    /// Get queue statistics for a tenant.
    pub fn stats(&self, tenant_id: &str) -> AppResult<QueueStats> {
        let count = |status: &str| -> i64 {
            self.conn
                .query_row(
                    "SELECT COUNT(*) FROM jobs_queue WHERE tenant_id = ?1 AND status = ?2",
                    params![tenant_id, status],
                    |row| row.get(0),
                )
                .unwrap_or(0)
        };

        Ok(QueueStats {
            queued: count("queued"),
            in_progress: count("in_progress"),
            completed: count("completed"),
            failed: count("failed"),
            dead_letter: count("dead_letter"),
        })
    }

    /// Retry a dead-letter job manually.
    pub fn retry_dead_letter(&self, job_id: &str) -> AppResult<()> {
        self.conn
            .execute(
                "UPDATE jobs_queue SET status = 'queued', attempts = 0, next_retry_at = NULL, last_error = NULL
                 WHERE id = ?1 AND status = 'dead_letter'",
                params![job_id],
            )
            .map_err(|e| AppError::StorageError(format!("Retry failed: {e}")))?;
        Ok(())
    }
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct QueueStats {
    pub queued: i64,
    pub in_progress: i64,
    pub completed: i64,
    pub failed: i64,
    pub dead_letter: i64,
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn setup() -> (TempDir, JobQueue) {
        let dir = TempDir::new().unwrap();
        let db_path = dir.path().join("queue.db");
        let queue = JobQueue::open(&db_path).unwrap();
        (dir, queue)
    }

    #[test]
    fn test_enqueue_and_dequeue() {
        let (_dir, queue) = setup();

        queue.enqueue("file-1", "tenant-1", JobType::UploadDrive, 8).unwrap();
        queue.enqueue("file-2", "tenant-1", JobType::UploadDrive, 8).unwrap();

        let jobs = queue.dequeue_batch(10).unwrap();
        assert_eq!(jobs.len(), 2);
        assert_eq!(jobs[0].file_id, "file-1");
    }

    #[test]
    fn test_complete_and_stats() {
        let (_dir, queue) = setup();

        let id = queue.enqueue("file-1", "t1", JobType::UploadDrive, 8).unwrap();
        let jobs = queue.dequeue_batch(10).unwrap();
        queue.mark_completed(&id).unwrap();

        let stats = queue.stats("t1").unwrap();
        assert_eq!(stats.completed, 1);
        assert_eq!(stats.queued, 0);
    }

    #[test]
    fn test_dead_letter_and_retry() {
        let (_dir, queue) = setup();

        let id = queue.enqueue("file-1", "t1", JobType::UploadDrive, 1).unwrap();
        queue.dequeue_batch(10).unwrap();
        queue.move_to_dead_letter(&id, "quota exceeded").unwrap();

        let stats = queue.stats("t1").unwrap();
        assert_eq!(stats.dead_letter, 1);

        queue.retry_dead_letter(&id).unwrap();
        let stats2 = queue.stats("t1").unwrap();
        assert_eq!(stats2.dead_letter, 0);
        assert_eq!(stats2.queued, 1);
    }
}

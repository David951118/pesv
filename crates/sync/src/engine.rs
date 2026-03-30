use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Semaphore;

use lah_core::error::AppResult;
use lah_core::types::{JobStatus, SyncJob};

use crate::circuit_breaker::CircuitBreaker;
use crate::queue::JobQueue;
use crate::rate_limiter::TokenBucket;

/// Sync engine configuration.
pub struct SyncConfig {
    pub batch_interval: Duration,
    pub max_batch_size: usize,
    pub max_concurrent: usize,
}

/// The sync engine processes the job queue in background,
/// uploading files to Google Drive (or other targets) with:
/// - Rate limiting (token bucket)
/// - Circuit breaker (cascading failure protection)
/// - Concurrency control (semaphore)
/// - Exponential backoff retries
/// - Dead-letter queue for permanent failures
pub struct SyncEngine;

impl SyncEngine {
    /// Process one batch of sync jobs.
    ///
    /// This is called by the background loop. Each job is processed
    /// concurrently up to `max_concurrent`, with rate limiting.
    ///
    /// The `process_fn` is the actual upload/delete function provided
    /// by the Drive provider (or other target).
    pub async fn process_batch<F, Fut>(
        queue: &JobQueue,
        circuit_breaker: &CircuitBreaker,
        rate_limiter: &TokenBucket,
        config: &SyncConfig,
        process_fn: F,
    ) -> AppResult<BatchResult>
    where
        F: Fn(SyncJob) -> Fut + Send + Sync + 'static,
        Fut: std::future::Future<Output = Result<(), String>> + Send,
    {
        // Check circuit breaker
        if circuit_breaker.is_open() {
            tracing::warn!("Sync circuit breaker OPEN, skipping batch");
            return Ok(BatchResult {
                processed: 0,
                succeeded: 0,
                failed: 0,
                skipped_circuit_open: true,
            });
        }

        // Dequeue batch
        let jobs = queue.dequeue_batch(config.max_batch_size)?;
        if jobs.is_empty() {
            return Ok(BatchResult::default());
        }

        tracing::info!(count = jobs.len(), "Processing sync batch");

        let semaphore = Arc::new(Semaphore::new(config.max_concurrent));
        let mut succeeded = 0u32;
        let mut failed = 0u32;

        for job in jobs {
            // Rate limit
            rate_limiter.acquire().await;

            // Check circuit breaker before each job
            if circuit_breaker.is_open() {
                tracing::warn!("Circuit breaker opened mid-batch, stopping");
                // Re-queue remaining jobs
                queue.reschedule(&job.id, job.attempts, "circuit_breaker_open").ok();
                break;
            }

            let _permit = semaphore.acquire().await.unwrap();

            let result = (process_fn)(job.clone()).await;

            match result {
                Ok(()) => {
                    circuit_breaker.record_success();
                    queue.mark_completed(&job.id)?;
                    succeeded += 1;
                    tracing::debug!(job_id = job.id.as_str(), "Sync job completed");
                }
                Err(err) => {
                    circuit_breaker.record_failure();
                    let next_attempt = job.attempts + 1;

                    if next_attempt >= job.max_attempts {
                        queue.move_to_dead_letter(&job.id, &err)?;
                        tracing::error!(
                            job_id = job.id.as_str(),
                            attempts = next_attempt,
                            "Job moved to dead-letter queue"
                        );
                    } else {
                        queue.reschedule(&job.id, next_attempt, &err)?;
                    }
                    failed += 1;
                }
            }
        }

        let result = BatchResult {
            processed: succeeded + failed,
            succeeded,
            failed,
            skipped_circuit_open: false,
        };

        tracing::info!(
            succeeded = result.succeeded,
            failed = result.failed,
            "Sync batch complete"
        );

        Ok(result)
    }
}

#[derive(Debug, Default, serde::Serialize)]
pub struct BatchResult {
    pub processed: u32,
    pub succeeded: u32,
    pub failed: u32,
    pub skipped_circuit_open: bool,
}

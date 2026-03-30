use std::sync::Mutex;
use std::time::{Duration, Instant};

/// Token bucket rate limiter.
///
/// Allows a burst of `capacity` requests, then refills at `refill_rate`
/// tokens per second. Used to respect API rate limits for Google Drive,
/// AI providers, and other external services.
pub struct TokenBucket {
    inner: Mutex<BucketInner>,
    name: String,
}

struct BucketInner {
    tokens: f64,
    capacity: f64,
    refill_rate: f64,
    last_refill: Instant,
}

impl TokenBucket {
    /// Create a new token bucket.
    ///
    /// - `capacity`: Maximum burst size
    /// - `refill_rate`: Tokens added per second
    pub fn new(name: &str, capacity: u32, refill_rate: f64) -> Self {
        Self {
            inner: Mutex::new(BucketInner {
                tokens: capacity as f64,
                capacity: capacity as f64,
                refill_rate,
                last_refill: Instant::now(),
            }),
            name: name.to_string(),
        }
    }

    /// Try to acquire a token. Returns true if allowed, false if rate limited.
    pub fn try_acquire(&self) -> bool {
        let mut inner = self.inner.lock().unwrap();
        inner.refill();

        if inner.tokens >= 1.0 {
            inner.tokens -= 1.0;
            true
        } else {
            tracing::debug!(
                bucket = self.name.as_str(),
                tokens = inner.tokens,
                "Rate limited"
            );
            false
        }
    }

    /// Acquire a token, waiting if necessary. Returns the wait duration.
    pub async fn acquire(&self) -> Duration {
        loop {
            {
                let mut inner = self.inner.lock().unwrap();
                inner.refill();

                if inner.tokens >= 1.0 {
                    inner.tokens -= 1.0;
                    return Duration::ZERO;
                }
            }
            // Wait for a token to become available
            tokio::time::sleep(Duration::from_millis(100)).await;
        }
    }

    /// Get current token count (for diagnostics).
    pub fn available_tokens(&self) -> f64 {
        let mut inner = self.inner.lock().unwrap();
        inner.refill();
        inner.tokens
    }
}

impl BucketInner {
    fn refill(&mut self) {
        let now = Instant::now();
        let elapsed = now.duration_since(self.last_refill).as_secs_f64();
        self.tokens = (self.tokens + elapsed * self.refill_rate).min(self.capacity);
        self.last_refill = now;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_bucket_allows_burst() {
        let bucket = TokenBucket::new("test", 5, 1.0);
        for _ in 0..5 {
            assert!(bucket.try_acquire());
        }
        // 6th should fail
        assert!(!bucket.try_acquire());
    }

    #[test]
    fn test_bucket_refills() {
        let bucket = TokenBucket::new("test", 2, 1000.0); // Fast refill for test
        assert!(bucket.try_acquire());
        assert!(bucket.try_acquire());
        // Wait briefly for refill
        std::thread::sleep(Duration::from_millis(10));
        assert!(bucket.try_acquire()); // Should have refilled
    }
}

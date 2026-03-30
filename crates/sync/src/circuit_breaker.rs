use std::sync::Mutex;
use std::time::{Duration, Instant};

/// Circuit breaker to protect against cascading failures.
///
/// States:
///   CLOSED    → Normal operation, counting failures
///   OPEN      → Blocking all operations, waiting for recovery
///   HALF_OPEN → Allowing one probe request
///
/// Transition diagram:
///   CLOSED --[failures >= threshold]--> OPEN
///   OPEN   --[recovery timeout]--> HALF_OPEN
///   HALF_OPEN --[probe success]--> CLOSED
///   HALF_OPEN --[probe failure]--> OPEN
pub struct CircuitBreaker {
    state: Mutex<CircuitState>,
    threshold: u32,
    recovery_timeout: Duration,
    name: String,
}

enum CircuitState {
    Closed { failure_count: u32 },
    Open { opened_at: Instant, forced_duration: Option<Duration> },
    HalfOpen,
}

impl CircuitBreaker {
    pub fn new(name: &str, threshold: u32, recovery_timeout: Duration) -> Self {
        Self {
            state: Mutex::new(CircuitState::Closed { failure_count: 0 }),
            threshold,
            recovery_timeout,
            name: name.to_string(),
        }
    }

    /// Check if the circuit is open (blocking operations).
    pub fn is_open(&self) -> bool {
        let mut state = self.state.lock().unwrap();
        match *state {
            CircuitState::Closed { .. } => false,
            CircuitState::Open { opened_at, forced_duration } => {
                let timeout = forced_duration.unwrap_or(self.recovery_timeout);
                if opened_at.elapsed() >= timeout {
                    *state = CircuitState::HalfOpen;
                    tracing::info!(circuit = self.name.as_str(), "Circuit breaker: OPEN → HALF_OPEN");
                    false
                } else {
                    true
                }
            }
            CircuitState::HalfOpen => false,
        }
    }

    /// Record a successful operation.
    pub fn record_success(&self) {
        let mut state = self.state.lock().unwrap();
        match *state {
            CircuitState::HalfOpen => {
                *state = CircuitState::Closed { failure_count: 0 };
                tracing::info!(circuit = self.name.as_str(), "Circuit breaker: HALF_OPEN → CLOSED");
            }
            CircuitState::Closed { ref mut failure_count } => {
                *failure_count = 0;
            }
            _ => {}
        }
    }

    /// Record a failed operation.
    pub fn record_failure(&self) {
        let mut state = self.state.lock().unwrap();
        match *state {
            CircuitState::Closed { ref mut failure_count } => {
                *failure_count += 1;
                if *failure_count >= self.threshold {
                    tracing::warn!(
                        circuit = self.name.as_str(),
                        failures = self.threshold,
                        "Circuit breaker: CLOSED → OPEN"
                    );
                    *state = CircuitState::Open {
                        opened_at: Instant::now(),
                        forced_duration: None,
                    };
                }
            }
            CircuitState::HalfOpen => {
                tracing::warn!(circuit = self.name.as_str(), "Circuit breaker: HALF_OPEN → OPEN (probe failed)");
                *state = CircuitState::Open {
                    opened_at: Instant::now(),
                    forced_duration: None,
                };
            }
            _ => {}
        }
    }

    /// Force the circuit open for a specific duration.
    pub fn force_open(&self, duration: Duration) {
        let mut state = self.state.lock().unwrap();
        *state = CircuitState::Open {
            opened_at: Instant::now(),
            forced_duration: Some(duration),
        };
        tracing::warn!(
            circuit = self.name.as_str(),
            duration_secs = duration.as_secs(),
            "Circuit breaker: FORCED OPEN"
        );
    }

    /// Get the current state as a string (for diagnostics).
    pub fn state_name(&self) -> &'static str {
        let state = self.state.lock().unwrap();
        match *state {
            CircuitState::Closed { .. } => "CLOSED",
            CircuitState::Open { .. } => "OPEN",
            CircuitState::HalfOpen => "HALF_OPEN",
        }
    }
}

/// Compute exponential backoff delay with jitter.
///
/// Formula: min(base_ms * 2^attempt + random_jitter, max_ms)
pub fn backoff_with_jitter(attempt: u32, base_ms: u64, max_ms: u64) -> Duration {
    use rand::Rng;
    let exp_delay = base_ms.saturating_mul(2u64.saturating_pow(attempt));
    let capped = exp_delay.min(max_ms);
    let jitter = rand::thread_rng().gen_range(0..=(capped / 2));
    Duration::from_millis((capped + jitter).min(max_ms))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_circuit_starts_closed() {
        let cb = CircuitBreaker::new("test", 3, Duration::from_secs(5));
        assert!(!cb.is_open());
        assert_eq!(cb.state_name(), "CLOSED");
    }

    #[test]
    fn test_circuit_opens_after_threshold() {
        let cb = CircuitBreaker::new("test", 3, Duration::from_secs(5));
        cb.record_failure();
        cb.record_failure();
        assert!(!cb.is_open());
        cb.record_failure(); // 3rd failure = threshold
        assert!(cb.is_open());
        assert_eq!(cb.state_name(), "OPEN");
    }

    #[test]
    fn test_success_resets_failures() {
        let cb = CircuitBreaker::new("test", 3, Duration::from_secs(5));
        cb.record_failure();
        cb.record_failure();
        cb.record_success(); // Reset
        cb.record_failure(); // Only 1 failure now
        assert!(!cb.is_open());
    }

    #[test]
    fn test_backoff_increases() {
        let d0 = backoff_with_jitter(0, 1000, 60000);
        let d3 = backoff_with_jitter(3, 1000, 60000);
        // d3 should generally be larger (with jitter, not guaranteed, but base is 8x)
        assert!(d3.as_millis() >= 4000); // At least base * 2^3 = 8000, minus jitter
    }
}

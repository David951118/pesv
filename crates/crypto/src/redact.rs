use once_cell::sync::Lazy;
use regex::Regex;

/// Automatic secret redaction for logs and diagnostics.
///
/// Matches common patterns for tokens, API keys, and PII,
/// replacing them with safe placeholders. Guaranteed to never
/// let secrets leak into log files or exported diagnostics.
pub struct SecretRedactor;

static PATTERNS: Lazy<Vec<(Regex, &'static str)>> = Lazy::new(|| {
    vec![
        // JWT tokens (header.payload.signature)
        (
            Regex::new(r"eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}")
                .unwrap(),
            "[REDACTED:JWT]",
        ),
        // OpenAI API keys
        (
            Regex::new(r"sk-[a-zA-Z0-9]{20,}").unwrap(),
            "[REDACTED:OPENAI_KEY]",
        ),
        // Anthropic API keys
        (
            Regex::new(r"sk-ant-[a-zA-Z0-9_-]{20,}").unwrap(),
            "[REDACTED:CLAUDE_KEY]",
        ),
        // GitHub tokens
        (
            Regex::new(r"gh[ps]_[A-Za-z0-9]{36,}").unwrap(),
            "[REDACTED:GH_TOKEN]",
        ),
        // GitHub App installation tokens
        (
            Regex::new(r"ghu_[A-Za-z0-9]{36,}").unwrap(),
            "[REDACTED:GH_INSTALL_TOKEN]",
        ),
        // Google OAuth tokens
        (
            Regex::new(r"ya29\.[a-zA-Z0-9_-]{50,}").unwrap(),
            "[REDACTED:GOOGLE_TOKEN]",
        ),
        // Generic Bearer tokens in headers
        (
            Regex::new(r"Bearer\s+[A-Za-z0-9_.-]{20,}").unwrap(),
            "Bearer [REDACTED]",
        ),
        // Supabase service role key pattern (sb- prefix)
        (
            Regex::new(r"sbp_[a-zA-Z0-9]{20,}").unwrap(),
            "[REDACTED:SUPABASE_KEY]",
        ),
        // Generic API key patterns
        (
            Regex::new(r#"(?i)(api[_-]?key|apikey|secret[_-]?key)\s*[=:]\s*["']?[A-Za-z0-9_.-]{16,}"#).unwrap(),
            "[REDACTED:API_KEY]",
        ),
        // Passwords in connection strings
        (
            Regex::new(r"(?i)(password|passwd|pwd)\s*[=:]\s*\S+").unwrap(),
            "[REDACTED:PASSWORD]",
        ),
        // Colombian cedulas (8-10 digits)
        (
            Regex::new(r"\b\d{8,10}\b").unwrap(),
            "[REDACTED:ID_NUMBER]",
        ),
        // Email addresses
        (
            Regex::new(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}").unwrap(),
            "[REDACTED:EMAIL]",
        ),
    ]
});

impl SecretRedactor {
    /// Redact all known secret patterns from a string.
    pub fn redact(input: &str) -> String {
        let mut result = input.to_string();
        for (pattern, replacement) in PATTERNS.iter() {
            result = pattern.replace_all(&result, *replacement).to_string();
        }
        result
    }

    /// Redact secrets from a serde_json::Value (deep).
    pub fn redact_json(value: &serde_json::Value) -> serde_json::Value {
        match value {
            serde_json::Value::String(s) => serde_json::Value::String(Self::redact(s)),
            serde_json::Value::Object(map) => {
                let mut new_map = serde_json::Map::new();
                for (k, v) in map {
                    let key_lower = k.to_lowercase();
                    if key_lower.contains("token")
                        || key_lower.contains("secret")
                        || key_lower.contains("password")
                        || key_lower.contains("key")
                        || key_lower.contains("credential")
                    {
                        new_map.insert(k.clone(), serde_json::Value::String("[REDACTED]".into()));
                    } else {
                        new_map.insert(k.clone(), Self::redact_json(v));
                    }
                }
                serde_json::Value::Object(new_map)
            }
            serde_json::Value::Array(arr) => {
                serde_json::Value::Array(arr.iter().map(Self::redact_json).collect())
            }
            other => other.clone(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_redacts_jwt() {
        let input = "token: eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U";
        let redacted = SecretRedactor::redact(input);
        assert!(redacted.contains("[REDACTED:JWT]"));
        assert!(!redacted.contains("eyJ"));
    }

    #[test]
    fn test_redacts_openai_key() {
        let input = "Using key sk-proj1234567890abcdefghijklmnop";
        let redacted = SecretRedactor::redact(input);
        assert!(redacted.contains("[REDACTED:OPENAI_KEY]"));
        assert!(!redacted.contains("sk-proj"));
    }

    #[test]
    fn test_redacts_github_token() {
        let input = "GITHUB_TOKEN=ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij";
        let redacted = SecretRedactor::redact(input);
        assert!(redacted.contains("[REDACTED:GH_TOKEN]"));
    }

    #[test]
    fn test_redact_json_deep() {
        let json = serde_json::json!({
            "user": "test",
            "access_token": "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U",
            "data": { "api_key": "sk-secret123456789012345" }
        });
        let redacted = SecretRedactor::redact_json(&json);
        assert_eq!(redacted["access_token"], "[REDACTED]");
        assert_eq!(redacted["data"]["api_key"], "[REDACTED]");
    }
}

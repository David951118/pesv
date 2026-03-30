use regex::Regex;

/// Data Loss Prevention engine.
///
/// Scans text before it's sent to external services (AI, logs, exports)
/// and redacts or blocks content that violates DLP rules.
pub struct DlpEngine {
    rules: Vec<DlpRule>,
}

struct DlpRule {
    name: String,
    pattern: Regex,
    action: DlpAction,
    replacement: String,
}

#[derive(Debug, Clone, PartialEq)]
pub enum DlpAction {
    /// Replace matched content with placeholder.
    Redact,
    /// Block the entire operation.
    Block,
    /// Allow but log a warning.
    Warn,
}

/// Result of scanning text through DLP rules.
#[derive(Debug)]
pub struct DlpScanResult {
    pub clean_text: String,
    pub violations: Vec<DlpViolation>,
    pub blocked: bool,
}

#[derive(Debug, Clone)]
pub struct DlpViolation {
    pub rule_name: String,
    pub action: DlpAction,
    pub match_count: usize,
}

impl DlpEngine {
    /// Create a DLP engine with default rules for Colombian transportation context.
    pub fn new_default() -> Self {
        let rules = vec![
            DlpRule {
                name: "cedula_colombiana".into(),
                pattern: Regex::new(r"(?i)(c\.?c\.?|cedula|c[eé]dula)\s*:?\s*\d{6,10}").unwrap(),
                action: DlpAction::Redact,
                replacement: "[REDACTED:CEDULA]".into(),
            },
            DlpRule {
                name: "nit".into(),
                pattern: Regex::new(r"(?i)nit\s*:?\s*\d{9,10}(-\d)?").unwrap(),
                action: DlpAction::Redact,
                replacement: "[REDACTED:NIT]".into(),
            },
            DlpRule {
                name: "phone_colombia".into(),
                pattern: Regex::new(r"\+?57\s?\d{10}").unwrap(),
                action: DlpAction::Redact,
                replacement: "[REDACTED:PHONE]".into(),
            },
            DlpRule {
                name: "email".into(),
                pattern: Regex::new(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}").unwrap(),
                action: DlpAction::Redact,
                replacement: "[REDACTED:EMAIL]".into(),
            },
            DlpRule {
                name: "bank_account".into(),
                pattern: Regex::new(r"(?i)(cuenta\s*(bancaria|de\s*ahorros|corriente))\s*:?\s*\d{8,20}").unwrap(),
                action: DlpAction::Block,
                replacement: "[BLOCKED:BANK_ACCOUNT]".into(),
            },
            DlpRule {
                name: "credit_card".into(),
                pattern: Regex::new(r"\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b").unwrap(),
                action: DlpAction::Block,
                replacement: "[BLOCKED:CREDIT_CARD]".into(),
            },
            DlpRule {
                name: "api_key".into(),
                pattern: Regex::new(r"(?i)(sk-[a-zA-Z0-9]{20,}|ghp_[A-Za-z0-9]{36,}|ya29\.[a-zA-Z0-9_-]{50,})").unwrap(),
                action: DlpAction::Block,
                replacement: "[BLOCKED:API_KEY]".into(),
            },
            DlpRule {
                name: "jwt_token".into(),
                pattern: Regex::new(r"eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}").unwrap(),
                action: DlpAction::Block,
                replacement: "[BLOCKED:JWT]".into(),
            },
            DlpRule {
                name: "password_field".into(),
                pattern: Regex::new(r#"(?i)(password|contraseña|passwd|pwd)\s*[=:]\s*\S+"#).unwrap(),
                action: DlpAction::Block,
                replacement: "[BLOCKED:PASSWORD]".into(),
            },
        ];

        Self { rules }
    }

    /// Scan text and apply DLP rules.
    pub fn scan(&self, text: &str) -> DlpScanResult {
        let mut clean = text.to_string();
        let mut violations = Vec::new();
        let mut blocked = false;

        for rule in &self.rules {
            let matches: Vec<_> = rule.pattern.find_iter(&clean).collect();
            if matches.is_empty() {
                continue;
            }

            let violation = DlpViolation {
                rule_name: rule.name.clone(),
                action: rule.action.clone(),
                match_count: matches.len(),
            };

            match rule.action {
                DlpAction::Block => {
                    blocked = true;
                    clean = rule.pattern.replace_all(&clean, &rule.replacement).to_string();
                }
                DlpAction::Redact => {
                    clean = rule.pattern.replace_all(&clean, &rule.replacement).to_string();
                }
                DlpAction::Warn => {
                    tracing::warn!(
                        rule = rule.name.as_str(),
                        matches = matches.len(),
                        "DLP warning: sensitive content detected"
                    );
                }
            }

            violations.push(violation);
        }

        DlpScanResult {
            clean_text: clean,
            violations,
            blocked,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_redacts_cedula() {
        let engine = DlpEngine::new_default();
        let result = engine.scan("El conductor con C.C. 1234567890 presentó documentos.");
        assert!(!result.blocked);
        assert!(result.clean_text.contains("[REDACTED:CEDULA]"));
        assert!(!result.clean_text.contains("1234567890"));
    }

    #[test]
    fn test_blocks_api_key() {
        let engine = DlpEngine::new_default();
        let result = engine.scan("La API key es sk-proj1234567890abcdefghijklmnop");
        assert!(result.blocked);
        assert!(result.clean_text.contains("[BLOCKED:API_KEY]"));
    }

    #[test]
    fn test_blocks_credit_card() {
        let engine = DlpEngine::new_default();
        let result = engine.scan("Tarjeta: 4111 1111 1111 1111");
        assert!(result.blocked);
    }

    #[test]
    fn test_clean_text_passes() {
        let engine = DlpEngine::new_default();
        let result = engine.scan("El vehículo ABC123 completó la ruta asignada.");
        assert!(!result.blocked);
        assert!(result.violations.is_empty());
    }
}

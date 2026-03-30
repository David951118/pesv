use lah_core::types::DataClassification;

/// Classify data based on content analysis and metadata.
///
/// Classification levels:
/// - PUBLIC: No restrictions. May be sent to AI, shared externally.
/// - INTERNAL: Company internal. May be sent to AI with logging.
/// - CONFIDENTIAL: Sensitive. Requires explicit consent for AI; double confirmation for export.
/// - RESTRICTED: Regulated/PII. NEVER sent to AI. Requires approval for any external action.
pub struct DataClassifier;

impl DataClassifier {
    /// Classify a file based on filename, tags, and optional content scan.
    pub fn classify(
        filename: &str,
        tags: &[String],
        content_sample: Option<&str>,
    ) -> DataClassification {
        // Check explicit tags first
        for tag in tags {
            match tag.to_lowercase().as_str() {
                "restricted" | "pii" | "regulated" => return DataClassification::Restricted,
                "confidential" | "sensitive" | "secret" => return DataClassification::Confidential,
                "internal" => return DataClassification::Internal,
                "public" => return DataClassification::Public,
                _ => {}
            }
        }

        // Check filename patterns
        let name_lower = filename.to_lowercase();
        if name_lower.contains("cedula")
            || name_lower.contains("contrato")
            || name_lower.contains("salario")
            || name_lower.contains("nomina")
            || name_lower.contains("medico")
            || name_lower.contains("examen")
            || name_lower.contains("password")
            || name_lower.contains("credential")
        {
            return DataClassification::Restricted;
        }

        if name_lower.contains("financiero")
            || name_lower.contains("factura")
            || name_lower.contains("balance")
            || name_lower.contains("confidencial")
        {
            return DataClassification::Confidential;
        }

        // Check content if provided
        if let Some(content) = content_sample {
            if Self::contains_pii(content) {
                return DataClassification::Restricted;
            }
            if Self::contains_financial(content) {
                return DataClassification::Confidential;
            }
        }

        // Default
        DataClassification::Internal
    }

    /// Check if content contains PII patterns (Colombian context).
    fn contains_pii(content: &str) -> bool {
        lazy_static::lazy_static! {
            static ref PII_PATTERNS: Vec<regex::Regex> = vec![
                // Colombian cedula (8-10 digits preceded by CC/C.C./Cedula)
                regex::Regex::new(r"(?i)(c\.?c\.?|cedula|c[eé]dula)\s*:?\s*\d{6,10}").unwrap(),
                // NIT (tax ID)
                regex::Regex::new(r"(?i)nit\s*:?\s*\d{9,10}").unwrap(),
                // Phone numbers
                regex::Regex::new(r"\+?57\s?\d{10}").unwrap(),
                // Dates of birth pattern
                regex::Regex::new(r"(?i)fecha\s*de?\s*nacimiento").unwrap(),
            ];
        }
        PII_PATTERNS.iter().any(|p| p.is_match(content))
    }

    /// Check if content contains financial data patterns.
    fn contains_financial(content: &str) -> bool {
        let lower = content.to_lowercase();
        lower.contains("cuenta bancaria")
            || lower.contains("tarjeta de cr")
            || lower.contains("numero de cuenta")
            || lower.contains("swift")
            || lower.contains("iban")
    }

    /// Check if a classification level allows sending data to AI providers.
    pub fn allows_ai(classification: DataClassification) -> bool {
        matches!(
            classification,
            DataClassification::Public | DataClassification::Internal
        )
    }

    /// Check if a classification level requires double confirmation for export.
    pub fn requires_confirmation(classification: DataClassification) -> bool {
        matches!(
            classification,
            DataClassification::Confidential | DataClassification::Restricted
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_explicit_tag_overrides() {
        assert_eq!(
            DataClassifier::classify("report.pdf", &["restricted".into()], None),
            DataClassification::Restricted
        );
        assert_eq!(
            DataClassifier::classify("report.pdf", &["public".into()], None),
            DataClassification::Public
        );
    }

    #[test]
    fn test_filename_classification() {
        assert_eq!(
            DataClassifier::classify("contrato_conductor.pdf", &[], None),
            DataClassification::Restricted
        );
        assert_eq!(
            DataClassifier::classify("factura_2026.pdf", &[], None),
            DataClassification::Confidential
        );
    }

    #[test]
    fn test_ai_permissions() {
        assert!(DataClassifier::allows_ai(DataClassification::Public));
        assert!(DataClassifier::allows_ai(DataClassification::Internal));
        assert!(!DataClassifier::allows_ai(DataClassification::Confidential));
        assert!(!DataClassifier::allows_ai(DataClassification::Restricted));
    }
}

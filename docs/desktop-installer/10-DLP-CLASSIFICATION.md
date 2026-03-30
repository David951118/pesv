# 10 — DLP & Data Classification Engine

## Overview

The Data Loss Prevention (DLP) engine and Data Classification system work together to prevent sensitive data from leaving the desktop application without proper authorization.

## Data Classification Levels

| Level | Label | Description | AI Allowed | External Sync | Retention |
|-------|-------|-------------|------------|---------------|-----------|
| 0 | PUBLIC | Non-sensitive, shareable freely | Yes | Yes | 1 year |
| 1 | INTERNAL | Business data, not regulated | Yes (with audit) | Yes | 3 years |
| 2 | CONFIDENTIAL | PII, contracts, financials | Confirmation required | Encrypted only | 7 years |
| 3 | RESTRICTED | Cedulas, NIT, medical, legal | **Blocked** | **Blocked** | 10 years + legal hold |

## Classification Rules

### Filename-Based (Fast Path)

```
contrato*, convenio*, acuerdo*     → RESTRICTED
factura*, cuenta*, nomina*         → CONFIDENTIAL
informe*, reporte*                 → INTERNAL
*.pdf (default)                    → INTERNAL
*.jpg, *.png (default)             → PUBLIC
```

### Content-Based (Deep Scan)

Triggered when a file is classified INTERNAL or lower but content analysis detects:

| Pattern | Regex | Escalation |
|---------|-------|------------|
| Colombian Cédula | `\b\d{6,10}\b` (near "cedula"/"CC") | → RESTRICTED |
| NIT | `\b\d{9}-\d\b` | → RESTRICTED |
| Date of Birth | `fecha.*nacimiento` | → CONFIDENTIAL |
| Bank Account | `\b\d{10,16}\b` (near "cuenta"/"banco") | → CONFIDENTIAL |
| Phone Number | `(\+57\|0)\d{10}` | → CONFIDENTIAL |

### Tag Override

Administrators can override classification via tags:

```rust
classifier.set_override("file-uuid", DataClassification::Restricted);
```

Overrides are audited and persist in SQLite.

## DLP Engine

### Scan Pipeline

```
User Input → DLP Scan → Classification Check → Policy Engine → Action
```

### DLP Rules (Colombian Context)

| ID | Name | Pattern | Action |
|----|------|---------|--------|
| DLP-001 | Colombian Cédula | `\b[0-9]{6,10}\b` near CC/cedula | Block |
| DLP-002 | NIT Number | `\b\d{9}-\d\b` | Block |
| DLP-003 | Phone (CO) | `(\+57\|0)[0-9]{10}` | Block |
| DLP-004 | Email Address | standard email regex | Warn |
| DLP-005 | Bank Account | `\b\d{10,16}\b` near cuenta/banco | Block |
| DLP-006 | Credit Card | Luhn-validated 13-19 digits | Block |
| DLP-007 | API Key | `(sk-\|key-\|token-)[\w]{20,}` | Block |
| DLP-008 | JWT Token | `eyJ[\w-]+\.eyJ[\w-]+\.[\w-]+` | Block |
| DLP-009 | Password | `(password\|contraseña\|clave)[:=]\s*\S+` | Block |

### Scan Output

```rust
pub struct DlpScanResult {
    pub clean_text: String,        // Redacted version
    pub violations: Vec<DlpViolation>,
    pub blocked: bool,             // Any BLOCK rule triggered
    pub scanned_at: DateTime<Utc>,
}
```

### Integration Points

1. **AI Requests**: All messages scanned before sending to OpenAI/Claude
2. **File Uploads**: Content scanned during classification
3. **Diagnostic Exports**: Output scrubbed before display
4. **Audit Log Queries**: Results redacted based on viewer role

## Policy Engine Integration

```
Classification + Action + Role → PolicyDecision
```

| Scenario | Decision |
|----------|----------|
| RESTRICTED + AI call | **Deny** |
| CONFIDENTIAL + AI call | AllowWithConfirmation |
| INTERNAL + AI call | Allow (audited) |
| Any + Viewer + write | **Deny** |
| Any + destructive action | RequiresApproval |

## Audit Trail

Every DLP scan generates an audit event:

```json
{
  "event_type": "dlp_scan",
  "details": {
    "context": "ai_request",
    "violations_count": 2,
    "blocked": true,
    "rules_triggered": ["DLP-001", "DLP-007"]
  }
}
```

## Configuration

In `policies/dlp-rules.yml`:

```yaml
rules:
  - id: DLP-001
    name: Colombian Cédula
    pattern: '\b[0-9]{6,10}\b'
    context_required: 'cedula|CC|documento'
    action: block
    severity: critical
```

## Testing

```bash
# Run DLP unit tests
cargo test -p lah-policy --lib dlp

# Run classification tests
cargo test -p lah-policy --lib classification
```

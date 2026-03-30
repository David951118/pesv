# 11 — Retention Policy & Legal Hold

## Overview

The retention system enforces data lifecycle rules and supports legal hold to prevent deletion of evidence during investigations or regulatory audits.

## Retention Periods

| Classification | Default Retention | Regulatory Basis |
|---------------|-------------------|-----------------|
| PUBLIC | 1 year | Internal policy |
| INTERNAL | 3 years | Colombian commercial law (Código de Comercio Art. 60) |
| CONFIDENTIAL | 7 years | Tax records (DIAN), labor law |
| RESTRICTED | 10 years | Personal data (Ley 1581 de 2012), contracts |

## Retention Engine

### Core Logic

```rust
pub struct RetentionManager { /* SQLite-backed */ }

impl RetentionManager {
    /// Check if a file can be deleted
    pub fn can_delete(&self, file_id: &str) -> AppResult<bool> {
        // 1. Check legal hold — if active, NEVER delete
        // 2. Check retention_until — if in future, deny
        // 3. Otherwise, allow deletion
    }

    /// Find files past their retention period (candidates for cleanup)
    pub fn find_expired(&self, tenant_id: &str) -> AppResult<Vec<String>> {
        // Returns file IDs where:
        //   retention_until < NOW() AND legal_hold = false
    }
}
```

### Retention Assignment

Retention periods are automatically assigned based on classification at upload time:

```sql
-- In 001_initial.sql
retention_until DATETIME,
legal_hold BOOLEAN NOT NULL DEFAULT 0,
```

The upload command sets `retention_until`:

```rust
let retention = match classification {
    Public => Duration::days(365),
    Internal => Duration::days(365 * 3),
    Confidential => Duration::days(365 * 7),
    Restricted => Duration::days(365 * 10),
};
file.retention_until = Utc::now() + retention;
```

## Legal Hold

### What Is Legal Hold?

A legal hold freezes all deletion and modification of specific files, regardless of retention period expiration. Used during:

- Regulatory investigations (Superintendencia de Transporte)
- Legal disputes
- Internal compliance audits
- Law enforcement requests

### Activation

```rust
// Admin-only action, requires approval workflow
retention_manager.set_legal_hold(file_id, true)?;
```

### Rules

1. **Immutable while active**: File cannot be deleted, modified, or re-classified
2. **Admin-only toggle**: Only users with `admin` role can set/remove legal hold
3. **Audit trail**: Every hold activation/deactivation is logged
4. **No expiration**: Legal hold remains until explicitly removed
5. **Overrides retention**: Even if retention period expires, file is preserved

### Audit Event

```json
{
  "event_type": "legal_hold_set",
  "details": {
    "file_id": "uuid",
    "hold_active": true,
    "reason": "Investigación ST-2024-0456"
  }
}
```

## Cleanup Process

### Automated Cleanup (Future)

```
1. find_expired(tenant_id) → list of file IDs
2. For each file:
   a. Verify can_delete() returns true (double-check)
   b. Secure-delete encrypted file from disk
   c. Remove file record from SQLite
   d. Log deletion audit event
3. Report cleanup summary
```

### Manual Cleanup

Admins can trigger cleanup from the UI, but individual files must pass `can_delete()` checks.

## Configuration

In `policies/retention-defaults.yml`:

```yaml
retention:
  public_days: 365
  internal_days: 1095
  confidential_days: 2555
  restricted_days: 3650

legal_hold:
  require_approval: true
  approval_timeout_hours: 24
  notify_on_activation: true
```

## Colombian Regulatory Context

| Regulation | Requirement | Implementation |
|-----------|-------------|----------------|
| Ley 1581 de 2012 | Personal data protection | RESTRICTED classification + 10yr retention |
| Código de Comercio Art. 60 | Commercial records 10 years | INTERNAL/CONFIDENTIAL 3-7yr |
| DIAN regulations | Tax records 5+ years | CONFIDENTIAL 7yr covers this |
| Resolución 315 de 2013 | Transport document retention | FUEC/preoperativa → CONFIDENTIAL |
| Ley 527 de 1999 | Electronic document validity | Hash-chain audit provides integrity proof |

## Integration with Other Systems

### Policy Engine

```
DELETE request → can_delete() check → PolicyDecision
```

If `can_delete()` returns false, the policy engine returns `Deny` with reason.

### Audit Log

All retention-related actions are hash-chained:
- File retention period set
- Legal hold activated/deactivated
- Expired file deleted
- Retention policy updated

### Sync Engine

Files under legal hold are never removed from Google Drive backup, even if local cleanup runs.

## Testing

```bash
# Run retention tests
cargo test -p lah-policy --lib retention

# Verify legal hold prevents deletion
cargo test -p lah-policy retention_legal_hold_blocks_delete
```

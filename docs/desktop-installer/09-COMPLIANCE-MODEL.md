# Enterprise Compliance Model — AION Defensa Predictiva S.A.S Desktop Installer

## Version: 1.0 | Fecha: 2026-02-08 | Clasificación: CONFIDENCIAL

---

## 1. Overview

This document defines the role-based access control (RBAC) model, separation of duties matrix, approval workflows, and governance framework for the AION Defensa Predictiva S.A.S desktop installer. The model is designed for Colombian fleet management companies operating under Ministerio de Transporte regulations, with specific attention to FUEC (Formato Unico de Extracto del Contrato), RNDC (Registro Nacional de Despacho de Carga), and pre-operational inspection requirements.

---

## 2. Role Definitions

### 2.1 Admin

**Persona**: Fleet manager or company owner. Responsible for system configuration, user management, and regulatory compliance.

| Attribute | Value |
|---|---|
| JWT claim | `app_metadata.user_role = "admin"` |
| Supabase RLS scope | All data within their tenant |
| Tauri capabilities | `default.json` + `admin.json` |
| Can create users | Yes |
| Can modify config | Yes |
| Can view all files | Yes |
| Can delete files | Yes |
| Can manage integrations | Yes (GitHub, Drive, AI) |
| Can export diagnostic logs | Yes |
| Can revoke devices | Yes |

### 2.2 Operator

**Persona**: Dispatching coordinator or office staff. Manages daily operations like vehicle assignments, document generation, and inspection reviews.

| Attribute | Value |
|---|---|
| JWT claim | `app_metadata.user_role = "operator"` |
| Supabase RLS scope | All data within their tenant (read); write scoped to operational tables |
| Tauri capabilities | `default.json` (subset — no GitHub, no AION API) |
| Can create users | No |
| Can modify config | No |
| Can view all files | Yes (within tenant) |
| Can delete files | Yes (operational files only, not regulatory) |
| Can manage integrations | No |
| Can create FUEC | Yes |
| Can assign vehicles to drivers | Yes |
| Can review pre-operational inspections | Yes |

### 2.3 Viewer

**Persona**: External auditor, regulatory inspector, or read-only stakeholder.

| Attribute | Value |
|---|---|
| JWT claim | `app_metadata.user_role = "viewer"` |
| Supabase RLS scope | Read-only access to all tenant data |
| Tauri capabilities | `default.json` (read-only subset) |
| Can create anything | No |
| Can modify anything | No |
| Can view all files | Yes (read-only, within tenant) |
| Can export reports | Yes (read-only export) |
| Can use AI | Yes (read-only queries) |

### 2.4 Conductor (Driver)

**Persona**: Truck or taxi driver. Limited to their own records, vehicle inspections, and assigned FUEC documents.

| Attribute | Value |
|---|---|
| JWT claim | `app_metadata.user_role = "conductor"` |
| Supabase RLS scope | Only their own records |
| Tauri capabilities | `default.json` (personal files only) |
| Can view their own files | Yes |
| Can create pre-operational inspections | Yes (for their assigned vehicle) |
| Can view FUEC assigned to them | Yes |
| Can view other drivers' data | No |
| Can modify config | No |
| Can use AI | Yes (limited to own context) |

---

## 3. Separation of Duties Matrix

The separation of duties (SoD) matrix prevents any single individual from having unchecked control over sensitive operations. Conflicts are marked with a red indicator.

### 3.1 Function-to-Role Matrix

| Function | Admin | Operator | Viewer | Conductor |
|---|---|---|---|---|
| Create user accounts | Execute | - | - | - |
| Assign roles to users | Execute | - | - | - |
| Configure system settings | Execute | - | - | - |
| Create FUEC documents | Approve | Execute | - | - |
| Generate RNDC manifests | Approve | Execute | - | - |
| Create pre-operational inspections | Review | Review | - | Execute |
| Review pre-operational inspections | Approve | Execute | View | - |
| Upload regulatory documents | Execute | Execute | - | - |
| Delete regulatory documents | Execute | - | - | - |
| View audit logs | Execute | - | View | - |
| Export data | Execute | Execute (limited) | View | - |
| Manage Drive backup | Execute | - | - | - |
| Manage GitHub integration | Execute | - | - | - |
| Rotate encryption keys | Execute | - | - | - |
| Revoke user devices | Execute | - | - | - |

### 3.2 Conflict Pairs

These role combinations on the same person represent a Separation of Duties conflict:

| Conflict | Roles | Risk | Mitigation |
|---|---|---|---|
| User creation + Role assignment | Admin only (acceptable for small fleet companies) | Admin could create a phantom user with admin role | Audit log tracks all user creation; quarterly review |
| FUEC creation + FUEC approval | Operator creates, Admin approves | Operator could fabricate FUEC without oversight | Require Admin countersignature on FUEC |
| Inspection creation + Inspection approval | Conductor creates, Operator/Admin reviews | Conductor could self-approve a passing inspection | RLS enforces that creator != approver |
| Config change + Audit log access | Admin has both | Admin could modify config and hide evidence | Audit logs are append-only; replicated to Supabase |
| Key rotation + File access | Admin has both | Admin could rotate keys to lock out others, then exfiltrate | Key rotation requires re-authentication; logged |

### 3.3 Enforcement

SoD is enforced at three levels:

1. **Supabase RLS**: Database-level policies prevent unauthorized data access regardless of client behavior.
2. **Tauri capabilities**: IPC-level restrictions limit which commands each role can invoke.
3. **Business logic**: Rust command handlers verify role claims before executing operations.

```rust
// Example: FUEC approval requires different user than creator
#[tauri::command]
async fn approve_fuec(
    state: tauri::State<'_, AppState>,
    fuec_id: String,
) -> Result<(), CommandError> {
    let session = state.require_role_any(&["admin"])?;

    let fuec = state.fuec_manager.get(&fuec_id).await?;

    // SoD check: approver must be different from creator
    if fuec.created_by == session.user_id {
        return Err(CommandError::SeparationOfDuties {
            action: "approve_fuec".to_string(),
            reason: "Creator cannot approve their own FUEC".to_string(),
        });
    }

    state.fuec_manager.approve(&session, &fuec_id).await?;
    Ok(())
}
```

---

## 4. Approval Workflows

### 4.1 FUEC Document Workflow

FUEC (Formato Unico de Extracto del Contrato) is a regulatory document required by the Colombian Ministerio de Transporte for each transportation service.

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ Operator │───>│  Draft   │───>│  Admin   │───>│  Active  │
│ creates  │    │  FUEC    │    │ approves │    │  FUEC    │
│          │    │          │    │          │    │ (issued) │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
                     │                               │
                     v                               v
                ┌──────────┐                    ┌──────────┐
                │ Rejected │                    │ Archived │
                │ (reason  │                    │ (after   │
                │  noted)  │                    │  expiry) │
                └──────────┘                    └──────────┘
```

**States**: `draft` → `pending_approval` → `approved` / `rejected` → `archived`

**Rules**:
- Operator creates and fills in FUEC details (vehicle, driver, route, dates).
- System validates: vehicle documents are current, driver license is valid, insurance is active.
- Admin reviews and approves or rejects with a reason.
- Approved FUEC is assigned a consecutive number per resolution requirements.
- Rejected FUEC returns to operator with correction notes.
- FUEC cannot be modified after approval (immutable for regulatory compliance).

### 4.2 Pre-Operational Inspection Workflow

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│Conductor │───>│  Submit  │───>│ Operator │───>│ Approved │
│ completes│    │  inspec. │    │ reviews  │    │ (vehicle │
│  form    │    │          │    │          │    │  cleared)│
└──────────┘    └──────────┘    └──────────┘    └──────────┘
                                     │
                                     v
                                ┌──────────┐
                                │ Flagged  │
                                │ (defects │
                                │  found)  │
                                └──────────┘
                                     │
                                     v
                                ┌──────────┐
                                │ Vehicle  │
                                │ grounded │
                                │ until fix│
                                └──────────┘
```

**Rules**:
- Conductor fills out the inspection checklist before each trip.
- If any critical item fails (brakes, tires, lights), the system automatically flags the vehicle.
- Operator reviews flagged inspections and decides: ground the vehicle or override with justification.
- Admin override is required to clear a grounded vehicle.
- All overrides are logged with the justifier's identity and reason.

### 4.3 Sensitive Configuration Changes

Changes to system configuration require step-up verification:

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Admin   │───>│ Re-auth  │───>│ Confirm  │───>│ Applied  │
│ requests │    │ (password │    │ (show    │    │ (logged) │
│ change   │    │  entry)  │    │  diff)   │    │          │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
```

**Sensitive config changes requiring step-up**:
- Changing Supabase URL or anon key
- Enabling/disabling encryption
- Modifying retention policies
- Changing AI provider or budget
- Rotating encryption keys
- Revoking a user's device

---

## 5. Step-Up Verification Requirements

Certain actions require additional verification beyond the existing session, even for admins. This protects against session hijacking.

### 5.1 Actions Requiring Step-Up

| Action | Step-Up Method | Timeout |
|---|---|---|
| Change system configuration | Password re-entry | 5 minutes |
| Rotate encryption keys | Password re-entry | 5 minutes |
| Revoke a user's device | Password re-entry | 5 minutes |
| Export all data | Password re-entry | 5 minutes |
| Change own email | Password re-entry + email confirmation | 10 minutes |
| Change own password | Current password + new password | 5 minutes |
| Delete regulatory documents (FUEC) | Password re-entry + confirmation dialog | 5 minutes |
| Connect/disconnect integrations | Password re-entry | 5 minutes |

### 5.2 Step-Up Implementation

```rust
use std::time::{Instant, Duration};

struct StepUpVerification {
    /// Timestamp of last successful step-up
    verified_at: Option<Instant>,
    /// How long the step-up remains valid
    validity_duration: Duration,
}

impl StepUpVerification {
    fn new() -> Self {
        Self {
            verified_at: None,
            validity_duration: Duration::from_secs(300), // 5 minutes
        }
    }

    fn is_verified(&self) -> bool {
        match self.verified_at {
            Some(at) => at.elapsed() < self.validity_duration,
            None => false,
        }
    }

    async fn verify_password(
        &mut self,
        supabase: &SupabaseProvider,
        email: &str,
        password: &str,
    ) -> Result<(), StepUpError> {
        // Re-authenticate with Supabase
        supabase.sign_in_with_password(email, password).await
            .map_err(|_| StepUpError::InvalidPassword)?;

        self.verified_at = Some(Instant::now());
        Ok(())
    }
}

// Usage in a command handler:
#[tauri::command]
async fn rotate_encryption_keys(
    state: tauri::State<'_, AppState>,
) -> Result<(), CommandError> {
    let session = state.require_admin_role()?;

    // Require step-up verification
    if !state.step_up.lock().await.is_verified() {
        return Err(CommandError::StepUpRequired {
            action: "rotate_encryption_keys".to_string(),
        });
    }

    state.crypto_engine.rotate_master_key(&session.tenant_id).await?;

    log::info!(
        "Encryption keys rotated by admin user_id={} tenant_id={}",
        session.user_id,
        session.tenant_id
    );

    Ok(())
}
```

---

## 6. Governance Model

### 6.1 Access Reviews

| Review Type | Frequency | Responsible | Actions |
|---|---|---|---|
| User access review | Monthly | Admin | Verify each user's role is still appropriate; deactivate departed employees |
| Integration token review | Monthly | Admin | Verify GitHub/Drive/AI integrations are still needed; revoke unused |
| Admin role review | Quarterly | Company owner | Verify admin privileges are justified; apply least-privilege |
| Regulatory compliance check | Quarterly | Admin + External auditor | Verify FUEC numbering, inspection records, RNDC compliance |
| Encryption key audit | Quarterly | Admin | Verify key rotation has occurred; check for expired keys |

### 6.2 Audit Trail

Every significant action is logged to an append-only audit trail stored in both local SQLite and Supabase:

```sql
CREATE TABLE audit_log (
    id          TEXT PRIMARY KEY,   -- UUID v7 (time-ordered)
    tenant_id   TEXT NOT NULL,
    user_id     TEXT NOT NULL,
    user_email  TEXT NOT NULL,
    user_role   TEXT NOT NULL,
    action      TEXT NOT NULL,      -- e.g., 'fuec.approve', 'config.update', 'user.create'
    resource    TEXT,               -- e.g., 'fuec:uuid-123', 'config:ai.budget'
    details     JSONB,             -- Action-specific metadata (no PII in keys)
    ip_address  TEXT,              -- Client IP (if available)
    device_id   TEXT NOT NULL,
    result      TEXT NOT NULL,      -- 'success', 'failure', 'denied'
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Append-only: no UPDATE or DELETE policies
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_insert_policy" ON audit_log
  FOR INSERT
  WITH CHECK (tenant_id = public.get_tenant_id());

CREATE POLICY "audit_log_select_policy" ON audit_log
  FOR SELECT
  USING (
    tenant_id = public.get_tenant_id()
    AND public.get_user_role() IN ('admin', 'viewer')
  );

-- No UPDATE or DELETE policies = immutable for non-service-role
```

### 6.3 Audit Events

| Event Category | Events Logged |
|---|---|
| Authentication | `auth.sign_in`, `auth.sign_out`, `auth.sign_in_failed`, `auth.session_refresh` |
| User management | `user.create`, `user.update_role`, `user.deactivate`, `device.revoke` |
| Files | `file.upload`, `file.delete`, `file.decrypt_and_open`, `file.sync_to_drive` |
| FUEC | `fuec.create`, `fuec.approve`, `fuec.reject`, `fuec.archive` |
| Inspections | `inspection.submit`, `inspection.approve`, `inspection.flag`, `vehicle.ground`, `vehicle.clear` |
| Configuration | `config.update`, `config.key_rotation`, `config.integration_connect`, `config.integration_disconnect` |
| AI | `ai.request` (with token count and cost, NOT prompt content) |
| Security | `security.step_up_success`, `security.step_up_failed`, `security.rate_limit_hit` |

### 6.4 Regulatory Context (Colombian Law)

| Regulation | Requirement | How We Comply |
|---|---|---|
| **Ley 1581 de 2012** (Data Protection) | Personal data must be protected; consent required | AES-256-GCM encryption; role-based access; audit trail |
| **Decreto 1079 de 2015** (Transportation) | FUEC required for contracted transportation | FUEC workflow with approval chain; immutable after issuance |
| **Resolución 315 de 2013** | Pre-operational inspection before each trip | Inspection workflow with automatic flagging |
| **RNDC** (National Cargo Registry) | Cargo manifests must be registered | Integration point for manifest generation |
| **Habeas Data** (Ley 1266 de 2008) | Individuals can request their data; rectification rights | Profile self-service; data export capability |
| **SIC** (Superintendencia de Industria y Comercio) | Data breach notification within 15 business days | Incident response procedure; audit trail preservation |

### 6.5 Data Retention for Compliance

| Data Type | Minimum Retention | Basis |
|---|---|---|
| FUEC documents | 5 years after expiry | Decreto 1079 de 2015 |
| Pre-operational inspections | 2 years | Resolución 315 de 2013 |
| Audit logs | 5 years | Ley 1581 de 2012 |
| Driver personal data (cedula, license) | Duration of employment + 2 years | Ley 1581 de 2012 |
| GPS tracking data | 6 months (configurable) | Internal policy; privacy consideration |
| AI interaction logs (metadata only) | 1 year | Internal policy |

---

## 7. Emergency Procedures

### 7.1 Compromised Admin Account

1. Any other admin (or company owner via Supabase Dashboard) immediately deactivates the compromised account.
2. Revoke all devices associated with the account.
3. Rotate all integration tokens (GitHub, Drive, AI).
4. Review audit log for actions taken by the compromised account.
5. Notify affected users if data exposure is suspected.
6. Change Supabase JWT secret if the compromise is severe (forces all users to re-authenticate).

### 7.2 Regulatory Audit Request

1. Admin generates a compliance report from the desktop app.
2. Report includes: FUEC registry with consecutive numbers, inspection records, vehicle documentation status.
3. Export in PDF format with digital timestamps.
4. Audit logs are exported separately as evidence of process integrity.
5. Viewer role can be assigned temporarily to the auditor for read-only access.

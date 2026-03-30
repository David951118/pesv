# 12 — Operational Runbooks

## RB-01: First-Time Setup

### Prerequisites
- macOS 12+ or Windows 10+ (64-bit)
- Internet connection
- Supabase project URL and anon key
- Admin credentials (email/password)

### Steps

1. **Install the application**
   - macOS: Open `.dmg`, drag to Applications
   - Windows: Run `.exe` installer (NSIS), follow wizard

2. **Launch and configure**
   - App opens to Setup Wizard (4 steps)
   - Step 1: Enter Supabase URL and anon key → "Test Connection"
   - Step 2: Review storage defaults (auto-configured)
   - Step 3: Review integration info
   - Step 4: Review and complete

3. **Sign in**
   - Enter admin email and password
   - Tokens stored automatically in OS Keychain

4. **Verify**
   - Dashboard loads with 5 tabs
   - Connections panel shows Supabase as "Healthy"
   - Security panel shows encryption as "Active"

---

## RB-02: Encryption Key Rotation

### When to Rotate
- Suspected key compromise
- Employee with key access departs
- Scheduled rotation (recommended: quarterly)

### Procedure

1. **Ensure no active sync jobs**
   ```
   Dashboard → Files tab → verify queue is empty
   ```

2. **Trigger rotation**
   ```
   Dashboard → Security tab → "Rotate Encryption Keys"
   ```

3. **What happens internally**
   - New master key generated via CSPRNG
   - Old master key retrieved from Keychain
   - All file DEKs re-wrapped with new master key
   - Old master key zeroized from memory
   - New master key stored in Keychain
   - Audit event recorded

4. **Verify**
   - Open a previously encrypted file — should decrypt normally
   - Check audit log for `key_rotation` event

### Rollback
- If rotation fails mid-process, the old key remains in Keychain
- Re-attempt rotation after investigating the failure

---

## RB-03: Kill Switch Activation

### When to Use
- Active security breach detected
- Compromised credentials suspected
- Regulatory order to cease operations

### Procedure

1. **Activate kill switch** (from Supabase dashboard)
   ```sql
   UPDATE kill_switch SET active = true, activated_at = NOW()
   WHERE id = 'singleton';
   ```

2. **Effect on desktop app**
   - All API calls return `KillSwitchActive` error
   - UI shows red banner: "System suspended by administrator"
   - No file operations, sync, or AI calls permitted
   - Existing session remains (for audit log access)

3. **Deactivate** (after incident resolution)
   ```sql
   UPDATE kill_switch SET active = false WHERE id = 'singleton';
   ```

4. **Post-incident**
   - Export audit logs for the incident period
   - Verify audit chain integrity
   - Document in incident report

---

## RB-04: Circuit Breaker Recovery

### Symptoms
- Sync operations failing repeatedly
- Connections panel showing provider as "Unhealthy"
- Circuit breaker state: OPEN

### Diagnosis

1. **Check provider health**
   ```
   Dashboard → Connections tab → check status indicators
   ```

2. **Check circuit breaker state**
   ```
   Dashboard → Security tab → Circuit breaker status
   ```

### Recovery

1. **Wait for automatic recovery**
   - Circuit breaker auto-transitions to HALF_OPEN after recovery timeout (60s default)
   - Next request is a probe — if successful, circuit CLOSES

2. **If provider is down**
   - Check provider status pages (Supabase, Google, GitHub)
   - Wait for provider recovery
   - Circuit breaker will auto-recover on next successful probe

3. **If persistent**
   - Check network connectivity
   - Verify API keys/tokens haven't expired
   - Check rate limiter token count in Security panel

---

## RB-05: Dead Letter Queue Management

### Symptoms
- Sync status showing failed jobs
- Queue stats with dead_letter_count > 0

### Procedure

1. **View queue stats**
   ```
   Dashboard → Files tab → Queue Statistics section
   ```

2. **Investigate failures**
   - Check audit log for sync_failed events
   - Common causes: auth token expired, file too large, quota exceeded

3. **Retry individual jobs**
   ```
   Dashboard → Files tab → "Retry" button on dead letter jobs
   ```

4. **If retry fails**
   - Check provider connectivity
   - Verify OAuth tokens are valid
   - Check Google Drive quota
   - Re-authenticate if tokens expired

---

## RB-06: Legal Hold Management

### Activating Legal Hold

1. **Identify files** requiring hold (by investigation reference)

2. **Set legal hold** via Compliance panel
   - Requires admin role
   - Requires approval from another admin (separation of duties)

3. **Verify**
   - File shows "Legal Hold" badge in Files panel
   - Attempt to delete → should be denied
   - Audit log shows `legal_hold_set` event

### Releasing Legal Hold

1. **Obtain authorization** (legal department or regulatory body)
2. **Remove hold** via Compliance panel
3. **Verify** audit log shows `legal_hold_released` event
4. **Note**: File now subject to normal retention rules again

---

## RB-07: Audit Chain Verification

### Routine Verification (Weekly Recommended)

1. **Navigate to Audit tab**
2. **Click "Verify Chain Integrity"**
3. **Expected result**: "Chain integrity verified — N events, all hashes valid"
4. **If verification fails**:
   - DO NOT modify the audit database
   - Export current audit data immediately
   - Contact security team
   - Investigate potential tampering

### Evidence Export

1. **Navigate to Security tab**
2. **Click "Export Diagnostics"**
3. **Output**: JSON with all audit events, integrity hashes, no secrets
4. **Use for**: regulatory submissions, incident investigations

---

## RB-08: Google Drive Reconnection

### When OAuth Token Expires

1. **Symptoms**: Sync jobs failing, Drive status "Unhealthy"

2. **Re-authenticate**
   ```
   Dashboard → Connections tab → Google Drive → "Connect"
   ```

3. **OAuth flow**
   - Browser opens Google consent screen
   - Authorize with `drive.file` scope only
   - Tokens stored in OS Keychain automatically

4. **Verify**
   - Drive status changes to "Healthy"
   - Retry any dead letter jobs

---

## RB-09: Application Update

### Auto-Update (Default)

1. App checks for updates on launch
2. If update available: notification displayed
3. User confirms → download + verify Ed25519 signature
4. Install and restart

### Manual Update

1. Download latest release from GitHub Releases
2. Verify signature (macOS: Gatekeeper; Windows: Authenticode)
3. Install over existing version
4. Launch — data and config preserved (SQLite + Keychain untouched)

### Rollback

1. Download previous version from GitHub Releases
2. Install over current version
3. SQLite migrations are forward-only — may need to restore from backup if schema changed

---

## RB-10: Incident Response

### Severity Levels

| Level | Description | Response Time | Escalation |
|-------|-------------|---------------|------------|
| P1 — Critical | Data breach, key compromise | Immediate | Kill switch + security team |
| P2 — High | Auth failure, sync outage | 1 hour | Engineering lead |
| P3 — Medium | Performance degradation | 4 hours | On-call engineer |
| P4 — Low | UI bug, cosmetic issue | Next business day | Backlog |

### P1 Response Checklist

1. [ ] Activate kill switch (RB-03)
2. [ ] Export audit logs immediately
3. [ ] Verify audit chain integrity (RB-07)
4. [ ] Rotate all encryption keys (RB-02)
5. [ ] Revoke all OAuth tokens
6. [ ] Notify affected users
7. [ ] Document timeline in incident report
8. [ ] Engage legal if PII involved (Colombian Ley 1581)
9. [ ] Report to Superintendencia de Transporte if transport data affected
10. [ ] Post-mortem within 48 hours

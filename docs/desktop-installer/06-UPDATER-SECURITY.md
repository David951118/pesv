# Auto-Update Security Specification — AION Defensa Predictiva S.A.S Desktop Installer

## Version: 1.0 | Fecha: 2026-02-08 | Clasificación: CONFIDENCIAL

---

## 1. Overview

The auto-updater is the single highest-risk component in the desktop application. A compromised updater enables Remote Code Execution (RCE) on every client machine that applies the update. This document specifies the security architecture to prevent this.

### Threat Scenario

1. Attacker compromises the update distribution channel (GitHub Releases, CDN, or DNS).
2. Attacker publishes a malicious update binary.
3. All desktop clients that auto-update execute the attacker's payload.
4. Payload can: exfiltrate files, steal tokens, deploy ransomware, establish persistence.

**Blast radius**: Every active installation in every fleet operator's network.

---

## 2. Ed25519 Signature Flow

### 2.1 Key Generation (One-Time Setup)

Generate an Ed25519 keypair. The private key is stored in a hardware security module (HSM) or encrypted vault. The public key is embedded in the application binary at compile time.

```bash
# Generate keypair using Tauri CLI
npx tauri signer generate -w ~/.tauri/aion-defensa-predictiva.key

# Output:
# Private key saved to: ~/.tauri/aion-defensa-predictiva.key
# Public key: dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk...
```

### 2.2 Key Storage

| Key | Storage Location | Access |
|---|---|---|
| **Primary private key** | CI secret (`TAURI_SIGNING_PRIVATE_KEY`) in GitHub Actions encrypted secrets | Only the release workflow |
| **Secondary private key** (human signer) | Hardware token (YubiKey) or 1Password vault | Release manager only |
| **Public key** | Embedded in `tauri.conf.json` → compiled into binary | Everyone (public) |

The private key password is stored separately as `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.

### 2.3 Signing During Build

The CI release pipeline signs the update bundle automatically:

```yaml
# .github/workflows/release.yml
env:
  TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
  TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}

steps:
  - name: Build and sign
    run: npx tauri build
    # Tauri CLI automatically signs the update bundle with Ed25519
    # Output: target/release/bundle/msi/AIONDefensaPredictiva_x.y.z_x64.msi.sig
```

### 2.4 Verification at Update Time

```
┌──────────────┐     HTTPS + Cert Pin     ┌─────────────────┐
│  Desktop App │ ──────────────────────── >│  Update Server  │
│              │                           │  (GitHub Rel.)  │
│              │< ──────────────────────── │                 │
│              │     update manifest       │                 │
└──────┬───────┘     (JSON + sig)         └─────────────────┘
       │
       v
  1. Fetch manifest.json
  2. Verify manifest signature (Ed25519)
  3. Parse version, URL, SHA-256
  4. Check version > current (anti-downgrade)
  5. Download binary from manifest URL
  6. Verify SHA-256 of downloaded binary
  7. Verify Ed25519 signature of binary (.sig file)
  8. Prompt user for confirmation
  9. Create rollback snapshot
 10. Apply update
 11. Post-start health check (60s window)
```

**Rust pseudocode for verification**:

```rust
use ed25519_dalek::{VerifyingKey, Signature, Verifier};

const EMBEDDED_PUBLIC_KEY: &str = "dW50cnVzdGVkIGNvbW1lbnQ..."; // compiled in

fn verify_update_signature(payload: &[u8], signature_b64: &str) -> Result<(), UpdateError> {
    let pubkey_bytes = base64::decode(EMBEDDED_PUBLIC_KEY)
        .map_err(|_| UpdateError::InvalidPublicKey)?;
    let verifying_key = VerifyingKey::from_bytes(
        &pubkey_bytes.try_into().map_err(|_| UpdateError::InvalidPublicKey)?
    ).map_err(|_| UpdateError::InvalidPublicKey)?;

    let sig_bytes = base64::decode(signature_b64)
        .map_err(|_| UpdateError::InvalidSignature)?;
    let signature = Signature::from_bytes(
        &sig_bytes.try_into().map_err(|_| UpdateError::InvalidSignature)?
    );

    verifying_key.verify(payload, &signature)
        .map_err(|_| UpdateError::SignatureVerificationFailed)?;

    Ok(())
}
```

---

## 3. Anti-Downgrade Protection

### Why It Matters

A downgrade attack forces the app to install an older version with known vulnerabilities. The attacker then exploits those vulnerabilities.

### Implementation

```rust
use semver::Version;

fn check_version_progression(
    current: &str,
    proposed: &str,
) -> Result<(), UpdateError> {
    let current_ver = Version::parse(current)
        .map_err(|_| UpdateError::InvalidVersion)?;
    let proposed_ver = Version::parse(proposed)
        .map_err(|_| UpdateError::InvalidVersion)?;

    if proposed_ver <= current_ver {
        log::warn!(
            "Downgrade attempt blocked: current={}, proposed={}",
            current_ver, proposed_ver
        );
        return Err(UpdateError::DowngradeAttempt {
            current: current.to_string(),
            proposed: proposed.to_string(),
        });
    }

    Ok(())
}
```

### Additional Rules

- **Minimum version floor**: The update manifest can specify a `min_version` field. If the client's current version is below this floor, it forces an update (for critical security patches).
- **Version is read from the compiled binary**, not from a config file that could be tampered with.
- Pre-release versions (`1.2.3-beta.1`) follow semver ordering and cannot downgrade to a lower pre-release.

---

## 4. Certificate Pinning

### Purpose

Even with Ed25519 signature verification, an attacker who compromises a Certificate Authority could perform a MITM attack to serve a different manifest. Certificate pinning adds a second layer of trust.

### Implementation

Pin the TLS certificate (or the SPKI hash) of the update server:

```rust
use reqwest::tls::Certificate;

const PINNED_CERT_SPKI_SHA256: &str =
    "sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

fn create_pinned_http_client() -> reqwest::Client {
    reqwest::Client::builder()
        .tls_built_in_root_certs(true)
        // Pin to the specific certificate of the update server
        .add_root_certificate(
            Certificate::from_pem(include_bytes!("../certs/update-server.pem")).unwrap()
        )
        .https_only(true)
        .min_tls_version(reqwest::tls::Version::TLS_1_2)
        .build()
        .expect("Failed to build pinned HTTP client")
}
```

### Pin Rotation

- Maintain **two pinned certificates**: the current one and the next one (pre-provisioned).
- When the current cert is rotated, the app already trusts the new one.
- Publish the new cert pin in an update **before** rotating the actual certificate.
- If both pins fail, fall back to standard TLS verification but **refuse to apply the update** and alert the user.

---

## 5. Rollback Mechanism

### Pre-Update Snapshot

Before applying any update, the app creates a rollback snapshot:

```
{app_data_dir}/
├── updates/
│   ├── current/                    # Symlink to active version
│   ├── rollback/
│   │   ├── version.txt            # e.g., "1.2.3"
│   │   ├── binary_backup/         # Copy of current executable + libs
│   │   └── config_backup/         # Copy of config at time of update
│   └── pending/
│       └── AIONDefensaPredictiva_1.3.0.msi  # Downloaded, verified, not yet applied
```

### Post-Start Health Check

After applying an update, the new version runs a self-health-check:

```rust
const HEALTH_CHECK_TIMEOUT_SECS: u64 = 60;

fn post_update_health_check() -> Result<(), UpdateError> {
    let checks = vec![
        ("supabase_connection", check_supabase_connectivity()),
        ("local_db_integrity", check_sqlite_integrity()),
        ("keychain_access", check_keychain_accessible()),
        ("config_valid", check_config_parseable()),
    ];

    for (name, result) in checks {
        if result.is_err() {
            log::error!("Post-update health check failed: {}", name);
            return Err(UpdateError::HealthCheckFailed {
                check: name.to_string(),
            });
        }
    }

    // Mark update as successful
    mark_update_complete()?;
    delete_rollback_snapshot()?;

    Ok(())
}
```

### Automatic Rollback Trigger

- If the app crashes within 60 seconds of starting after an update.
- If any health check fails.
- If the app fails to start at all (detected by a launcher/watchdog process).

Rollback process:
1. Restore the binary from `rollback/binary_backup/`.
2. Restore the config from `rollback/config_backup/`.
3. Start the previous version.
4. Report the failed update to telemetry (no PII, just version numbers and error codes).
5. Do NOT retry the same update automatically. Wait for a new version.

---

## 6. Dual-Key Signing

### Why Two Keys

Single-key signing has a single point of failure: if the CI signing key is compromised, the attacker can sign malicious updates. Dual-key signing requires both the automated CI key AND a human operator's key.

### Flow

```
┌──────────┐    Build + Sign     ┌────────────────┐
│  CI/CD   │ ──────────────────> │  Update Bundle │
│  Runner  │    (CI private key) │  .sig (CI)     │
└──────────┘                     └───────┬────────┘
                                         │
                                         v
                                 ┌────────────────┐
                                 │  Release Mgr   │
                                 │  reviews +     │
                                 │  counter-signs │
                                 │  (human key)   │
                                 └───────┬────────┘
                                         │
                                         v
                                 ┌────────────────┐
                                 │  Final Bundle  │
                                 │  .sig (CI)     │
                                 │  .sig2 (human) │
                                 └────────────────┘
```

### Verification Logic

```rust
fn verify_dual_signature(
    payload: &[u8],
    ci_signature: &str,
    human_signature: &str,
) -> Result<(), UpdateError> {
    // Both signatures must be valid
    verify_ed25519(payload, ci_signature, &CI_PUBLIC_KEY)?;
    verify_ed25519(payload, human_signature, &HUMAN_PUBLIC_KEY)?;

    Ok(())
}
```

### Emergency Override

In case the human signer is unavailable (emergency security patch), the system supports an **m-of-n** scheme: any 2 of 3 designated signers can authorize a release. This requires pre-distributing 3 public keys and requiring any 2 valid signatures.

---

## 7. Update Manifest Format

The update manifest is a JSON document hosted at a well-known URL (e.g., `https://releases.aiondefensapredictiva.com/updates/latest.json`). It is also published as a GitHub Release asset.

```json
{
  "version": "1.3.0",
  "pub_date": "2026-02-08T12:00:00Z",
  "min_supported_version": "1.1.0",
  "notes": "Security patch: fixes CVE-2026-XXXX in OAuth callback handler.",
  "release_type": "security",
  "staged_rollout_percent": 100,
  "platforms": {
    "darwin-aarch64": {
      "url": "https://github.com/org/repo/releases/download/v1.3.0/AIONDefensaPredictiva_1.3.0_aarch64.app.tar.gz",
      "signature": "dW50cnVzdGVkIGNvbW1lbnQ6...",
      "signature_human": "c2lnbmF0dXJlIGZyb20gaH...",
      "sha256": "a1b2c3d4e5f6...64_hex_chars...",
      "size_bytes": 12345678
    },
    "darwin-x86_64": {
      "url": "https://github.com/org/repo/releases/download/v1.3.0/AIONDefensaPredictiva_1.3.0_x64.app.tar.gz",
      "signature": "dW50cnVzdGVkIGNvbW1lbnQ6...",
      "signature_human": "c2lnbmF0dXJlIGZyb20gaH...",
      "sha256": "f6e5d4c3b2a1...64_hex_chars...",
      "size_bytes": 12845678
    },
    "windows-x86_64": {
      "url": "https://github.com/org/repo/releases/download/v1.3.0/AIONDefensaPredictiva_1.3.0_x64-setup.nsis.zip",
      "signature": "dW50cnVzdGVkIGNvbW1lbnQ6...",
      "signature_human": "c2lnbmF0dXJlIGZyb20gaH...",
      "sha256": "1a2b3c4d5e6f...64_hex_chars...",
      "size_bytes": 15234567
    }
  },
  "kill_switch": false,
  "force_rollback_to": null,
  "manifest_signature": "ZW50aXJlIG1hbmlmZXN0IH..."
}
```

### Field Descriptions

| Field | Type | Description |
|---|---|---|
| `version` | semver string | Target version |
| `pub_date` | ISO 8601 | Publication timestamp |
| `min_supported_version` | semver string | Versions below this MUST update |
| `notes` | string | Human-readable changelog |
| `release_type` | enum | `feature`, `bugfix`, `security`, `emergency` |
| `staged_rollout_percent` | integer 0-100 | Percentage of clients that should receive this update |
| `platforms.<target>.url` | URL | Download URL for the platform-specific bundle |
| `platforms.<target>.signature` | base64 | Ed25519 signature from CI key |
| `platforms.<target>.signature_human` | base64 | Ed25519 signature from human key |
| `platforms.<target>.sha256` | hex string | SHA-256 hash of the download |
| `platforms.<target>.size_bytes` | integer | Expected download size (pre-check) |
| `kill_switch` | boolean | If true, app disables itself and shows maintenance message |
| `force_rollback_to` | semver or null | If set, forces rollback to this version (emergency) |
| `manifest_signature` | base64 | Ed25519 signature of the entire manifest (minus this field) |

### Tauri Configuration

```json
// tauri.conf.json (relevant section)
{
  "plugins": {
    "updater": {
      "active": true,
      "dialog": true,
      "pubkey": "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk...",
      "endpoints": [
        "https://releases.aiondefensapredictiva.com/updates/{{target}}/{{arch}}/{{current_version}}"
      ],
      "windows": {
        "installMode": "passive"
      }
    }
  }
}
```

---

## 8. Staged Rollout

### Mechanism

The `staged_rollout_percent` field in the manifest controls gradual deployment:

1. Client computes `hash(device_id) % 100` to get a deterministic bucket (0-99).
2. If bucket < `staged_rollout_percent`, the client is eligible for the update.
3. If not eligible, the client checks again on next poll interval.

```rust
fn is_eligible_for_staged_rollout(
    device_id: &str,
    rollout_percent: u8,
) -> bool {
    let hash = sha256(device_id.as_bytes());
    let bucket = hash[0] as u8 % 100; // first byte mod 100
    bucket < rollout_percent
}
```

### Typical Rollout Schedule

| Phase | Percent | Duration | Action if Issues |
|---|---|---|---|
| Canary | 5% | 24 hours | Halt, investigate |
| Early adopters | 25% | 48 hours | Halt, investigate |
| General availability | 100% | Immediate | Roll forward with fix |

For `security` or `emergency` release types, go directly to 100%.

---

## 9. Kill Switch

### Activation

If a severe vulnerability is discovered in a released version, the kill switch forces all clients to a safe state:

1. Set `kill_switch: true` in the update manifest.
2. Optionally set `force_rollback_to: "1.2.3"` to force downgrade to a known-safe version.
3. Push the updated manifest to the release endpoint.

### Client Behavior When Kill Switch is Active

```
┌─────────────────────────────────────────────┐
│         MAINTENANCE MODE                      │
│                                               │
│  AION Defensa Predictiva S.A.S has been temporarily       │
│  disabled for a critical security update.     │
│                                               │
│  Please contact your administrator.           │
│                                               │
│  Status: https://status.aiondefensapredictiva.com  │
│                                               │
│  [Retry]                                      │
└─────────────────────────────────────────────┘
```

- The app checks the manifest on every launch and every 15 minutes while running.
- When kill switch is active, all data operations are suspended.
- Local encrypted files remain intact (not deleted, not decrypted).
- The app displays only the maintenance screen.

---

## 10. Verification Checklist

### Pre-Release Verification

| # | Test | Expected Result | Method |
|---|---|---|---|
| 1 | Submit update with **invalid** Ed25519 signature | Rejected, update not applied | Tamper with .sig file |
| 2 | Submit update with **wrong key** signature | Rejected, update not applied | Sign with different keypair |
| 3 | Submit update with **missing** signature | Rejected, update not applied | Delete .sig file |
| 4 | Submit update for a **lower** version | Rejected as downgrade | Set version < current |
| 5 | Submit update for **same** version | Rejected as downgrade | Set version = current |
| 6 | MITM the update endpoint with proxy | Connection refused (cert pin) | Use mitmproxy |
| 7 | Corrupt the downloaded binary | SHA-256 mismatch, rejected | Flip one byte in download |
| 8 | Kill switch activation | App enters maintenance mode | Set kill_switch=true |
| 9 | Force rollback via manifest | App downgrades to specified version | Set force_rollback_to |
| 10 | Staged rollout at 0% | No clients receive update | Set staged_rollout_percent=0 |
| 11 | Post-update crash within 60s | Automatic rollback to previous version | Force crash in new version |
| 12 | Health check failure after update | Automatic rollback | Break Supabase connectivity |
| 13 | Dual-key: CI sig valid, human sig invalid | Rejected | Tamper with human .sig |
| 14 | Dual-key: CI sig invalid, human sig valid | Rejected | Tamper with CI .sig |
| 15 | Update with `min_supported_version` | Versions below floor are force-updated | Test with old client |

### Ongoing Monitoring

- Alert on: update download failures > 5% of clients.
- Alert on: rollbacks > 1% of clients.
- Alert on: signature verification failures (any = potential attack).
- Log all update attempts with: `device_id`, `current_version`, `proposed_version`, `result` (applied/rejected/rolled_back), `error_code`.

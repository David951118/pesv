# Google Drive OAuth Implementation — AION Defensa Predictiva S.A.S Desktop Installer

## Version: 1.0 | Fecha: 2026-02-08 | Clasificación: CONFIDENCIAL

---

## 1. Overview

The desktop app uses Google Drive as an encrypted backup destination for fleet management files (pre-operational inspections, FUEC documents, vehicle records). Files are uploaded **already encrypted** (AES-256-GCM) — Google Drive is treated as opaque blob storage.

### Scope Justification

**Requested scope**: `https://www.googleapis.com/auth/drive.file`

This is the **most restrictive** Drive scope that allows file upload/download. It grants access **only** to files created by the application. The app cannot read, modify, or delete any other file in the user's Drive.

| Scope | What It Allows | Our Decision |
|---|---|---|
| `drive` | Full read/write to ALL files | **PROHIBITED** — excessive |
| `drive.readonly` | Read ALL files | **PROHIBITED** — unnecessary |
| `drive.file` | Read/write only files created by the app | **APPROVED** — minimum necessary |
| `drive.appdata` | Hidden app folder only | Too restrictive — we need user-visible backup folder |
| `drive.metadata.readonly` | Read metadata of all files | **PROHIBITED** — unnecessary |

**Why not `drive.appdata`?** Fleet operators need to verify that backups exist by browsing their Drive folder. `drive.appdata` hides files completely, which conflicts with the auditability requirement.

---

## 2. PKCE Flow Step-by-Step

The app uses the Authorization Code flow with PKCE (Proof Key for Code Exchange, RFC 7636). PKCE prevents authorization code interception attacks, which are especially relevant for desktop apps where the redirect URI is `localhost`.

### Step 1: Generate PKCE Parameters

```rust
use rand::RngCore;
use sha2::{Sha256, Digest};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};

fn generate_pkce() -> (String, String) {
    // code_verifier: 43-128 chars, [A-Z, a-z, 0-9, -, ., _, ~]
    let mut verifier_bytes = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut verifier_bytes);
    let code_verifier = URL_SAFE_NO_PAD.encode(verifier_bytes);

    // code_challenge: SHA-256 hash of verifier, base64url-encoded
    let mut hasher = Sha256::new();
    hasher.update(code_verifier.as_bytes());
    let code_challenge = URL_SAFE_NO_PAD.encode(hasher.finalize());

    (code_verifier, code_challenge)
}

fn generate_state() -> String {
    let mut state_bytes = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut state_bytes);
    URL_SAFE_NO_PAD.encode(state_bytes)
}
```

### Step 2: Start Local HTTP Server

```rust
use std::net::TcpListener;

fn start_callback_server() -> (TcpListener, u16) {
    // Bind to random high port on localhost ONLY
    let listener = TcpListener::bind("127.0.0.1:0")
        .expect("Failed to bind callback server");
    let port = listener.local_addr().unwrap().port();

    // Verify port is in ephemeral range
    assert!(port >= 49152, "Port should be in ephemeral range");

    (listener, port)
}
```

### Step 3: Open Browser with Authorization URL

```rust
fn build_authorization_url(
    client_id: &str,
    redirect_port: u16,
    code_challenge: &str,
    state: &str,
) -> String {
    format!(
        "https://accounts.google.com/o/oauth2/v2/auth?\
         client_id={}&\
         redirect_uri=http://localhost:{}/oauth/google/callback&\
         response_type=code&\
         scope=https://www.googleapis.com/auth/drive.file&\
         code_challenge={}&\
         code_challenge_method=S256&\
         state={}&\
         access_type=offline&\
         prompt=consent",
        client_id, redirect_port, code_challenge, state
    )
}

// Open in the system's default browser (NOT a webview)
fn open_browser(url: &str) -> Result<(), Box<dyn std::error::Error>> {
    open::that(url)?;
    Ok(())
}
```

**Important**: We use the system browser, not an embedded webview. This prevents the app from having access to the user's Google credentials and follows Google's OAuth security best practices for desktop apps.

### Step 4: Receive Callback

```rust
use std::io::{Read, Write};
use std::time::Duration;

fn wait_for_callback(
    listener: &TcpListener,
    expected_state: &str,
    timeout: Duration,
) -> Result<String, OAuthError> {
    listener.set_nonblocking(false);
    // Set timeout for the entire operation
    let deadline = std::time::Instant::now() + timeout;

    loop {
        if std::time::Instant::now() > deadline {
            return Err(OAuthError::Timeout);
        }

        let (mut stream, _addr) = listener.accept()
            .map_err(|_| OAuthError::CallbackFailed)?;

        let mut buffer = [0u8; 4096];
        let n = stream.read(&mut buffer)?;
        let request = String::from_utf8_lossy(&buffer[..n]);

        // Parse query parameters from GET request
        let params = parse_callback_params(&request)?;

        // CRITICAL: Verify state parameter matches
        let received_state = params.get("state")
            .ok_or(OAuthError::MissingState)?;
        if received_state != expected_state {
            log::error!("OAuth state mismatch: possible CSRF attack");
            return Err(OAuthError::StateMismatch);
        }

        // Check for error response
        if let Some(error) = params.get("error") {
            let desc = params.get("error_description")
                .cloned()
                .unwrap_or_default();
            return Err(OAuthError::ProviderError {
                error: error.clone(),
                description: desc,
            });
        }

        // Extract authorization code
        let code = params.get("code")
            .ok_or(OAuthError::MissingCode)?
            .clone();

        // Respond to the browser with a success page
        let response = "HTTP/1.1 200 OK\r\n\
            Content-Type: text/html\r\n\r\n\
            <html><body>\
            <h2>Authorized successfully</h2>\
            <p>You can close this window and return to the AION Defensa Predictiva S.A.S app.</p>\
            <script>window.close();</script>\
            </body></html>";
        stream.write_all(response.as_bytes())?;

        // Shutdown the listener immediately
        drop(stream);

        return Ok(code);
    }
}
```

### Step 5: Exchange Code for Tokens

```rust
async fn exchange_code_for_tokens(
    client_id: &str,
    client_secret: &str,
    code: &str,
    code_verifier: &str,
    redirect_port: u16,
) -> Result<DriveTokens, OAuthError> {
    let client = reqwest::Client::new();

    let response = client
        .post("https://oauth2.googleapis.com/token")
        .form(&[
            ("client_id", client_id),
            ("client_secret", client_secret),
            ("code", code),
            ("code_verifier", code_verifier),
            ("redirect_uri", &format!("http://localhost:{}/oauth/google/callback", redirect_port)),
            ("grant_type", "authorization_code"),
        ])
        .send()
        .await?;

    if !response.status().is_success() {
        let error_body = response.text().await?;
        log::error!("Token exchange failed: {}", error_body);
        return Err(OAuthError::TokenExchangeFailed);
    }

    let token_response: GoogleTokenResponse = response.json().await?;

    Ok(DriveTokens {
        access_token: token_response.access_token,
        refresh_token: token_response.refresh_token
            .ok_or(OAuthError::NoRefreshToken)?,
        expires_at: Utc::now() + chrono::Duration::seconds(
            token_response.expires_in as i64
        ),
        scopes: token_response.scope.split(' ').map(String::from).collect(),
    })
}
```

### Step 6: Store Tokens in Keychain/DPAPI

```rust
fn store_drive_tokens(tokens: &DriveTokens) -> Result<(), StorageError> {
    let entry_access = keyring::Entry::new(
        "com.aiondefensa.admin-hub",
        "google_drive_access_token",
    )?;
    entry_access.set_password(&tokens.access_token)?;

    let entry_refresh = keyring::Entry::new(
        "com.aiondefensa.admin-hub",
        "google_drive_refresh_token",
    )?;
    entry_refresh.set_password(&tokens.refresh_token)?;

    // Store expiration in config (not sensitive)
    config::set("google_drive.expires_at", &tokens.expires_at.to_rfc3339())?;

    Ok(())
}
```

---

## 3. Localhost Callback Security

### Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Port hijacking by malware | Malware steals auth code | PKCE makes stolen code useless without `code_verifier` |
| Bind to 0.0.0.0 | Network-adjacent attacker captures callback | Bind exclusively to `127.0.0.1` |
| Predictable port | Malware pre-binds the port | Use OS-assigned random ephemeral port |
| Long-lived server | Increases attack window | Shut down immediately after receiving callback |
| Callback replay | Reuse of authorization code | Codes are single-use (Google enforces this) |

### Implementation Requirements

1. **Bind only to `127.0.0.1`** — never `0.0.0.0` or `::`.
2. **Ephemeral port**: Let the OS assign a port (port 0 in bind). Verify it is >= 49152.
3. **Timeout**: Close the server after 120 seconds if no callback arrives.
4. **Single request**: Accept exactly one connection, process it, then shut down.
5. **State verification**: Compare the `state` parameter in the callback against the one generated in Step 1. Reject mismatches.
6. **PKCE enforcement**: Even if an attacker intercepts the code, they cannot exchange it without the `code_verifier` (which never leaves the Rust process).

---

## 4. Token Lifecycle

### 4.1 Token Storage

| Token | Storage | Lifetime |
|---|---|---|
| `access_token` | Keychain/DPAPI | ~1 hour (Google default) |
| `refresh_token` | Keychain/DPAPI | Until revoked or 6 months of inactivity |
| `code_verifier` | In-memory only (Rust stack) | Duration of OAuth flow only |
| `state` | In-memory only (Rust stack) | Duration of OAuth flow only |

### 4.2 Token Refresh

Refresh proactively **5 minutes before expiration**:

```rust
async fn ensure_valid_access_token(&self) -> Result<String, OAuthError> {
    let expires_at = self.get_token_expiry()?;
    let now = Utc::now();
    let buffer = chrono::Duration::minutes(5);

    if now + buffer >= expires_at {
        log::info!("Drive access token expires soon, refreshing");
        let refresh_token = self.get_refresh_token_from_keychain()?;
        let new_tokens = self.refresh_access_token(&refresh_token).await?;
        self.store_drive_tokens(&new_tokens)?;
        Ok(new_tokens.access_token)
    } else {
        self.get_access_token_from_keychain()
    }
}

async fn refresh_access_token(
    &self,
    refresh_token: &str,
) -> Result<DriveTokens, OAuthError> {
    let response = self.http_client
        .post("https://oauth2.googleapis.com/token")
        .form(&[
            ("client_id", &self.client_id),
            ("client_secret", &self.client_secret),
            ("refresh_token", refresh_token),
            ("grant_type", "refresh_token"),
        ])
        .send()
        .await?;

    if response.status() == 401 || response.status() == 400 {
        // Refresh token has been revoked or expired
        log::warn!("Drive refresh token invalid; user must re-authorize");
        self.clear_drive_tokens()?;
        return Err(OAuthError::RefreshTokenRevoked);
    }

    let token_response: GoogleTokenResponse = response.json().await?;

    Ok(DriveTokens {
        access_token: token_response.access_token,
        // Google may or may not return a new refresh token
        refresh_token: token_response.refresh_token
            .unwrap_or_else(|| refresh_token.to_string()),
        expires_at: Utc::now() + chrono::Duration::seconds(
            token_response.expires_in as i64
        ),
        scopes: token_response.scope.split(' ').map(String::from).collect(),
    })
}
```

### 4.3 Token Revocation

When the user disconnects Google Drive from the app, explicitly revoke the token:

```rust
async fn revoke_drive_access(&self) -> Result<(), OAuthError> {
    // Revoke with Google's endpoint
    let token = self.get_access_token_from_keychain()?;

    let response = self.http_client
        .post("https://oauth2.googleapis.com/revoke")
        .form(&[("token", &token)])
        .send()
        .await;

    // Even if revocation fails (network error), clear local tokens
    match response {
        Ok(resp) if resp.status().is_success() => {
            log::info!("Drive token revoked successfully with Google");
        }
        Ok(resp) => {
            log::warn!("Drive token revocation returned {}", resp.status());
        }
        Err(e) => {
            log::warn!("Drive token revocation network error: {}", e);
        }
    }

    // ALWAYS clear local tokens regardless of revocation result
    self.clear_drive_tokens()?;

    log::info!("Drive tokens cleared from Keychain");
    Ok(())
}

fn clear_drive_tokens(&self) -> Result<(), StorageError> {
    let _ = keyring::Entry::new("com.aiondefensa.admin-hub", "google_drive_access_token")
        .and_then(|e| e.delete_credential());
    let _ = keyring::Entry::new("com.aiondefensa.admin-hub", "google_drive_refresh_token")
        .and_then(|e| e.delete_credential());
    config::remove("google_drive.expires_at")?;
    Ok(())
}
```

---

## 5. Quota Management

### Pre-Upload Check

Before every upload batch, check remaining quota:

```rust
async fn check_drive_quota(&self) -> Result<DriveQuota, OAuthError> {
    let response = self.authed_request(
        reqwest::Method::GET,
        "https://www.googleapis.com/drive/v3/about?fields=storageQuota"
    ).await?;

    let about: GoogleAboutResponse = response.json().await?;
    let quota = about.storage_quota;

    let total = quota.limit.parse::<i64>().unwrap_or(0);
    let used = quota.usage.parse::<i64>().unwrap_or(0);
    let remaining = total - used;
    let remaining_percent = if total > 0 {
        (remaining as f64 / total as f64) * 100.0
    } else {
        0.0
    };

    Ok(DriveQuota {
        total_bytes: total,
        used_bytes: used,
        remaining_bytes: remaining,
        remaining_percent,
    })
}
```

### Quota Thresholds

| Remaining | Action |
|---|---|
| > 20% | Normal operation |
| 10-20% | Log warning, notify user in UI |
| 5-10% | Pause automatic backups, alert user prominently |
| < 5% | Stop all uploads, display critical alert |

### Per-Tenant Limits

In addition to Google's quota, enforce per-tenant limits:

```toml
# config.toml
[drive_backup]
max_total_bytes = 5368709120    # 5 GB per tenant
max_file_bytes = 104857600       # 100 MB per file
warn_at_percent = 80
```

---

## 6. Error Handling for Rate Limits

### Google Drive API Quotas

| Quota | Default Limit | Our Target |
|---|---|---|
| Queries per day | 1,000,000,000 | Not a concern |
| Queries per 100 seconds per user | 100 | Enforce with token bucket |
| Uploads per day per user | 750 per day (shared drives) | Track and respect |
| File size | 5 TB | Our limit: 100 MB |

### Rate Limit Response Handling

```rust
async fn handle_drive_response<T: serde::de::DeserializeOwned>(
    response: reqwest::Response,
) -> Result<T, DriveError> {
    match response.status() {
        status if status.is_success() => {
            Ok(response.json().await?)
        }

        // Rate limited
        reqwest::StatusCode::TOO_MANY_REQUESTS => {
            let retry_after = response.headers()
                .get("Retry-After")
                .and_then(|v| v.to_str().ok())
                .and_then(|v| v.parse::<u64>().ok())
                .unwrap_or(30);

            log::warn!("Drive API rate limited. Retry after {}s", retry_after);

            Err(DriveError::RateLimited {
                retry_after_secs: retry_after,
            })
        }

        // User rate limit exceeded (403 with specific reason)
        reqwest::StatusCode::FORBIDDEN => {
            let body: serde_json::Value = response.json().await?;
            let reason = body["error"]["errors"][0]["reason"]
                .as_str()
                .unwrap_or("unknown");

            match reason {
                "userRateLimitExceeded" | "rateLimitExceeded" => {
                    log::warn!("Drive user rate limit exceeded");
                    Err(DriveError::RateLimited { retry_after_secs: 60 })
                }
                "storageQuotaExceeded" => {
                    log::error!("Drive storage quota exceeded");
                    Err(DriveError::QuotaExceeded)
                }
                _ => {
                    log::error!("Drive forbidden: {}", reason);
                    Err(DriveError::PermissionDenied { reason: reason.to_string() })
                }
            }
        }

        // Auth error — token may need refresh
        reqwest::StatusCode::UNAUTHORIZED => {
            log::warn!("Drive auth error — attempting token refresh");
            Err(DriveError::AuthExpired)
        }

        // Server error — retryable
        status if status.is_server_error() => {
            log::warn!("Drive server error: {}", status);
            Err(DriveError::ServerError { status: status.as_u16() })
        }

        // Other errors
        status => {
            let body = response.text().await.unwrap_or_default();
            log::error!("Drive unexpected error {}: {}", status, body);
            Err(DriveError::Unexpected {
                status: status.as_u16(),
                body,
            })
        }
    }
}
```

### Client-Side Rate Limiter

```rust
use governor::{Quota, RateLimiter};
use std::num::NonZeroU32;

fn create_drive_rate_limiter() -> RateLimiter</* ... */> {
    // 80 requests per 100 seconds (with buffer below Google's 100/100s limit)
    let quota = Quota::per_second(NonZeroU32::new(1).unwrap())
        .allow_burst(NonZeroU32::new(80).unwrap());

    RateLimiter::direct(quota)
}
```

### Retry Strategy

```
Attempt 1: immediate
Attempt 2: 2s + jitter(0-1s)
Attempt 3: 4s + jitter(0-2s)
Attempt 4: 8s + jitter(0-4s)
Attempt 5: 16s + jitter(0-8s)
Attempt 6: 32s + jitter(0-16s)
Attempt 7: 60s + jitter(0-30s)
Attempt 8: 300s (5 min) + jitter(0-60s)
After 8 failures: move to dead-letter queue, alert user
```

For 429 responses, use the server-provided `Retry-After` header instead of the calculated backoff.

---

## 7. Folder Structure in Google Drive

### Hierarchy

```
My Drive/
└── AIONDefensaPredictiva/                         # App root folder (created once)
    └── {tenant_display_name}/               # Per-tenant folder
        └── backups/                         # Backup container
            ├── 2026-01/                     # Monthly partition
            │   ├── preoperativa_abc123.enc  # Encrypted file
            │   ├── fuec_def456.enc
            │   └── vehiculo_ghi789.enc
            ├── 2026-02/
            │   └── ...
            └── _metadata/
                ├── manifest_2026-01.json    # Monthly manifest
                └── manifest_2026-02.json
```

### Folder Creation Logic

```rust
async fn ensure_folder_structure(
    &self,
    tenant_name: &str,
) -> Result<FolderIds, DriveError> {
    // 1. Find or create root folder
    let root_id = self
        .find_or_create_folder("AIONDefensaPredictiva", None)
        .await?;

    // 2. Find or create tenant folder
    let tenant_id = self
        .find_or_create_folder(tenant_name, Some(&root_id))
        .await?;

    // 3. Find or create backups folder
    let backups_id = self
        .find_or_create_folder("backups", Some(&tenant_id))
        .await?;

    // 4. Find or create current month folder
    let month_str = Utc::now().format("%Y-%m").to_string();
    let month_id = self
        .find_or_create_folder(&month_str, Some(&backups_id))
        .await?;

    // 5. Find or create metadata folder
    let metadata_id = self
        .find_or_create_folder("_metadata", Some(&backups_id))
        .await?;

    Ok(FolderIds {
        root: root_id,
        tenant: tenant_id,
        backups: backups_id,
        current_month: month_id,
        metadata: metadata_id,
    })
}

async fn find_or_create_folder(
    &self,
    name: &str,
    parent_id: Option<&str>,
) -> Result<String, DriveError> {
    // Search for existing folder
    let mut query = format!(
        "name = '{}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
        name.replace('\'', "\\'")
    );
    if let Some(parent) = parent_id {
        query.push_str(&format!(" and '{}' in parents", parent));
    }

    let response = self.authed_request(
        reqwest::Method::GET,
        &format!(
            "https://www.googleapis.com/drive/v3/files?q={}&fields=files(id,name)",
            urlencoding::encode(&query)
        ),
    ).await?;

    let result: DriveFileList = response.json().await?;

    if let Some(existing) = result.files.first() {
        return Ok(existing.id.clone());
    }

    // Create the folder
    let mut metadata = serde_json::json!({
        "name": name,
        "mimeType": "application/vnd.google-apps.folder"
    });
    if let Some(parent) = parent_id {
        metadata["parents"] = serde_json::json!([parent]);
    }

    let response = self.authed_request(
        reqwest::Method::POST,
        "https://www.googleapis.com/drive/v3/files"
    )
    .json(&metadata)
    .send()
    .await?;

    let created: DriveFileResponse = response.json().await?;
    Ok(created.id)
}
```

### Monthly Manifest

Each month, a manifest file is uploaded to `_metadata/` containing an inventory of all backups for that month:

```json
{
  "tenant_id": "tenant-001",
  "month": "2026-02",
  "generated_at": "2026-02-28T23:59:00Z",
  "files": [
    {
      "drive_file_id": "1ABC...",
      "original_name": "preoperativa_20260215.pdf",
      "local_file_id": "uuid-123",
      "sha256_original": "a1b2c3...",
      "sha256_encrypted": "d4e5f6...",
      "size_bytes": 245678,
      "uploaded_at": "2026-02-15T10:30:00Z",
      "encryption_key_id": "key-456"
    }
  ],
  "total_files": 42,
  "total_bytes": 15678900
}
```

### File Naming Convention

Files in Drive use a sanitized name format to avoid path traversal and encoding issues:

```
{document_type}_{short_uuid}.enc
```

Examples:
- `preoperativa_abc123.enc`
- `fuec_def456.enc`
- `contrato_ghi789.enc`

The original filename and metadata are stored in the local SQLite database and the monthly manifest, not in the Drive filename itself. This prevents leaking business information via Drive filenames visible in sharing logs.

---

## 8. Security Constraints Summary

| Constraint | Implementation |
|---|---|
| Scope: `drive.file` only | Configured in Google Cloud Console; verified in OAuth URL |
| PKCE mandatory | `code_challenge_method=S256` in auth URL; `code_verifier` in token exchange |
| System browser (not webview) | `open::that(url)` opens default browser |
| Localhost only | Bind to `127.0.0.1`, never `0.0.0.0` |
| Ephemeral port | Port 0 in bind, verify >= 49152 |
| State parameter | Cryptographically random, verified on callback |
| Tokens in Keychain/DPAPI | Never on disk, never in logs |
| Proactive refresh | 5 minutes before expiry |
| Explicit revocation | Called on disconnect; local tokens always cleared |
| Files uploaded encrypted | AES-256-GCM encryption happens before upload |
| No shared links | Files remain private; never create shared links |
| Rate limiting | Client-side token bucket; respect `Retry-After` headers |
| Quota checks | Pre-upload verification; alerts at thresholds |

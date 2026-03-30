# Tauri IPC Security — AION Defensa Predictiva S.A.S Desktop Installer

## Version: 1.0 | Fecha: 2026-02-08 | Clasificación: CONFIDENCIAL

---

## 1. Overview

Tauri 2 uses a **deny-by-default** permission model for IPC (Inter-Process Communication) between the frontend WebView and the Rust backend. No command is accessible to the frontend unless explicitly granted via a **capability** file. This is a fundamental security advantage over Electron, where all Node.js APIs are available unless explicitly restricted.

### Architecture

```
┌─────────────────────────────────────────────────────┐
│                  WebView (React/TS)                   │
│                                                       │
│  invoke('upload_file', { request })                  │
│       │                                               │
│       v                                               │
│  ┌──────────────────────────────────────────┐        │
│  │  Tauri IPC Layer                          │        │
│  │  1. Check capability (is command allowed?) │        │
│  │  2. Check rate limit                       │        │
│  │  3. Deserialize + validate input           │        │
│  │  4. Route to Rust command handler          │        │
│  └──────────────────────────────────────────┘        │
│       │                                               │
├───────┼───────────────────────────────────────────────┤
│       v                                               │
│  ┌──────────────────────────────────────────┐        │
│  │  Rust Command Handler                     │        │
│  │  1. Verify authentication state           │        │
│  │  2. Verify authorization (role check)     │        │
│  │  3. Validate input (business rules)       │        │
│  │  4. Execute operation                     │        │
│  │  5. Return typed response                 │        │
│  └──────────────────────────────────────────┘        │
│                  Rust Core                             │
└─────────────────────────────────────────────────────┘
```

---

## 2. Deny-by-Default Principle

### How It Works

In Tauri 2, the `capabilities/` directory contains JSON files that define which IPC commands the WebView can invoke. If a command is not listed in any capability file, invoking it from the frontend results in a permission error.

```
src-tauri/
├── capabilities/
│   ├── default.json       # Base capabilities for all users
│   └── admin.json         # Additional capabilities for admin users
├── src/
│   └── commands/
│       ├── auth.rs
│       ├── files.rs
│       ├── sync.rs
│       ├── config.rs
│       └── ai.rs
└── tauri.conf.json
```

### What This Prevents

- **XSS to RCE escalation**: Even if an attacker achieves XSS in the WebView, they can only call commands that are explicitly permitted. Without filesystem read/write capabilities, XSS cannot directly access local files.
- **Scope creep**: New commands added by developers are not accessible until explicitly added to a capability file, forcing a security review.
- **Privilege escalation**: Admin-only commands are in a separate capability that is only loaded for admin sessions.

---

## 3. Capability Definitions

### 3.1 Default Capabilities (All Authenticated Users)

```json
// src-tauri/capabilities/default.json
{
  "identifier": "default",
  "description": "Base capabilities for all authenticated users",
  "windows": ["main"],
  "permissions": [
    // Auth commands — always available
    "aion:allow-sign-in",
    "aion:allow-sign-in-magic-link",
    "aion:allow-sign-out",
    "aion:allow-get-session",
    "aion:allow-refresh-session",

    // File commands — user can manage their own files
    "aion:allow-upload-file",
    "aion:allow-list-files",
    "aion:allow-get-file",
    "aion:allow-delete-file",
    "aion:allow-decrypt-and-open",
    "aion:allow-get-sync-status",

    // Drive commands — connect/disconnect/status
    "aion:allow-connect-drive",
    "aion:allow-disconnect-drive",
    "aion:allow-get-drive-status",
    "aion:allow-force-sync-file",

    // AI commands — basic usage
    "aion:allow-ai-complete",
    "aion:allow-ai-get-usage",
    "aion:allow-ai-get-capabilities",

    // Config commands — read-only for non-admins
    "aion:allow-get-config",
    "aion:allow-get-setup-steps",
    "aion:allow-test-supabase-connection",

    // Diagnostics — health check only
    "aion:allow-get-health-status"
  ]
}
```

### 3.2 Admin Capabilities (Admin Role Only)

```json
// src-tauri/capabilities/admin.json
{
  "identifier": "admin",
  "description": "Additional capabilities for admin users. Loaded dynamically after role verification.",
  "windows": ["main"],
  "permissions": [
    // Config modification — admin only
    "aion:allow-update-config",

    // GitHub commands — admin only (repo management)
    "aion:allow-list-repos",
    "aion:allow-clone-repo",
    "aion:allow-create-issue",
    "aion:allow-create-pull-request",

    // AION API — admin only
    "aion:allow-aion-execute",

    // Diagnostics — full export
    "aion:allow-export-diagnostic-logs",

    // User management (via Edge Function)
    "aion:allow-admin-create-user",
    "aion:allow-admin-list-users",
    "aion:allow-admin-update-user-role",
    "aion:allow-admin-revoke-device"
  ]
}
```

### 3.3 Permission Definitions

Each permission maps to a `#[tauri::command]` function:

```json
// src-tauri/permissions/aion/default.toml (or JSON equivalent)
[[permission]]
identifier = "allow-sign-in"
description = "Allow the sign_in command"
commands.allow = ["sign_in"]

[[permission]]
identifier = "allow-upload-file"
description = "Allow the upload_file command"
commands.allow = ["upload_file"]

[[permission]]
identifier = "allow-update-config"
description = "Allow the update_config command (admin only)"
commands.allow = ["update_config"]

// ... one entry per command
```

---

## 4. Rate Limiting Per Command

### Implementation

Rate limiting is enforced in the Rust backend before command execution. Each command category has different limits reflecting its risk and expected usage pattern.

```rust
use governor::{Quota, RateLimiter, clock::DefaultClock, state::keyed::DashMapStateStore};
use std::num::NonZeroU32;
use std::sync::Arc;

pub struct CommandRateLimiter {
    limiters: HashMap<String, Arc<RateLimiter<String, DashMapStateStore<String>, DefaultClock>>>,
}

impl CommandRateLimiter {
    pub fn new() -> Self {
        let mut limiters = HashMap::new();

        // Auth commands: 5 per minute (brute force protection)
        limiters.insert(
            "auth".to_string(),
            Arc::new(RateLimiter::keyed(
                Quota::per_minute(NonZeroU32::new(5).unwrap())
            )),
        );

        // File operations: 30 per minute
        limiters.insert(
            "files".to_string(),
            Arc::new(RateLimiter::keyed(
                Quota::per_minute(NonZeroU32::new(30).unwrap())
            )),
        );

        // AI completions: 20 per minute
        limiters.insert(
            "ai".to_string(),
            Arc::new(RateLimiter::keyed(
                Quota::per_minute(NonZeroU32::new(20).unwrap())
            )),
        );

        // Config changes: 5 per minute
        limiters.insert(
            "config".to_string(),
            Arc::new(RateLimiter::keyed(
                Quota::per_minute(NonZeroU32::new(5).unwrap())
            )),
        );

        // Drive operations: 10 per minute
        limiters.insert(
            "drive".to_string(),
            Arc::new(RateLimiter::keyed(
                Quota::per_minute(NonZeroU32::new(10).unwrap())
            )),
        );

        // GitHub operations: 10 per minute
        limiters.insert(
            "github".to_string(),
            Arc::new(RateLimiter::keyed(
                Quota::per_minute(NonZeroU32::new(10).unwrap())
            )),
        );

        // Admin commands: 10 per minute
        limiters.insert(
            "admin".to_string(),
            Arc::new(RateLimiter::keyed(
                Quota::per_minute(NonZeroU32::new(10).unwrap())
            )),
        );

        // Diagnostics: 2 per minute
        limiters.insert(
            "diagnostics".to_string(),
            Arc::new(RateLimiter::keyed(
                Quota::per_minute(NonZeroU32::new(2).unwrap())
            )),
        );

        Self { limiters }
    }

    pub fn check(&self, category: &str, user_id: &str) -> Result<(), RateLimitError> {
        if let Some(limiter) = self.limiters.get(category) {
            limiter.check_key(&user_id.to_string())
                .map_err(|_| RateLimitError::TooManyRequests {
                    category: category.to_string(),
                })?;
        }
        Ok(())
    }
}
```

### Rate Limits Summary

| Category | Limit | Rationale |
|---|---|---|
| `auth` | 5/min | Prevent brute force login attempts |
| `files` | 30/min | Normal file browsing + uploads |
| `ai` | 20/min | Cost control + API rate limit respect |
| `config` | 5/min | Config changes are rare, high-impact |
| `drive` | 10/min | Respect Google API quotas |
| `github` | 10/min | Respect GitHub API quotas |
| `admin` | 10/min | Administrative operations |
| `diagnostics` | 2/min | Expensive operations (log export) |

---

## 5. Input Validation Requirements

Every Tauri command handler **must** validate its inputs before processing. The WebView is an **untrusted** source — treat all inputs as potentially malicious.

### Validation Rules by Type

```rust
use validator::Validate;

#[derive(Debug, Deserialize, Validate)]
pub struct FileUploadInput {
    #[validate(length(min = 1, max = 255))]
    #[validate(custom(function = "validate_filename"))]
    pub file_name: String,

    #[validate(length(min = 1, max = 4096))]
    pub file_path: String,

    #[validate(length(max = 10))]
    pub tags: Vec<String>,
}

fn validate_filename(name: &str) -> Result<(), validator::ValidationError> {
    // No path separators
    if name.contains('/') || name.contains('\\') {
        return Err(validator::ValidationError::new("invalid_filename"));
    }
    // No path traversal
    if name.contains("..") {
        return Err(validator::ValidationError::new("path_traversal"));
    }
    // No null bytes
    if name.contains('\0') {
        return Err(validator::ValidationError::new("null_byte"));
    }
    // No control characters
    if name.chars().any(|c| c.is_control()) {
        return Err(validator::ValidationError::new("control_chars"));
    }
    Ok(())
}

fn validate_path_within_app_dir(
    path: &str,
    app_data_dir: &Path,
) -> Result<PathBuf, ValidationError> {
    let canonical = std::fs::canonicalize(path)
        .map_err(|_| ValidationError::InvalidPath)?;

    if !canonical.starts_with(app_data_dir) {
        log::error!(
            "Path traversal attempt: {} resolved to {} which is outside {}",
            path,
            canonical.display(),
            app_data_dir.display()
        );
        return Err(ValidationError::PathTraversal);
    }

    Ok(canonical)
}
```

### Validation Checklist (Applied to Every Command)

| Input Type | Validations |
|---|---|
| **Strings** | Max length, no null bytes, no control chars, charset whitelist |
| **File names** | No `/`, `\`, `..`, null bytes; max 255 chars |
| **File paths** | Canonicalize, verify within `app_data_dir` |
| **UUIDs** | Parse with `Uuid::parse_str()`, reject invalid |
| **Emails** | Regex validation, max 320 chars |
| **Numbers** | Range check (positive, within bounds) |
| **JSON payloads** | Schema validation, max depth, max size |
| **URLs** | Parse with `url::Url`, verify scheme is HTTPS |
| **Tags/labels** | Alphanumeric + hyphens only, max 50 chars each, max 10 per entity |
| **AI prompts** | Max 10,000 chars, strip known injection patterns |

### Example: Command with Full Validation

```rust
#[tauri::command]
async fn upload_file(
    state: tauri::State<'_, AppState>,
    request: FileUploadInput,
) -> Result<FileRecord, CommandError> {
    // 1. Rate limit
    state.rate_limiter.check("files", &state.current_user_id()?)?;

    // 2. Authentication
    let session = state.require_authenticated_session()?;

    // 3. Input validation
    request.validate()
        .map_err(|e| CommandError::InvalidInput(format!("{}", e)))?;

    // 4. Path validation
    let safe_path = validate_path_within_app_dir(
        &request.file_path,
        &state.app_data_dir,
    )?;

    // 5. Business logic
    let record = state.file_manager
        .upload(&session, &safe_path, &request.file_name, &request.tags)
        .await?;

    Ok(record)
}
```

---

## 6. Commands Requiring Authentication

**Every command except the following requires an active, valid Supabase session**:

### Commands Available Without Authentication

| Command | Reason |
|---|---|
| `sign_in` | Initiating login |
| `sign_in_magic_link` | Initiating magic link login |
| `test_supabase_connection` | Setup wizard (pre-login) |
| `get_setup_steps` | Setup wizard (pre-login) |

### Authentication Enforcement

```rust
impl AppState {
    /// Returns the current session or errors if not authenticated.
    /// Validates JWT expiration and refreshes proactively.
    fn require_authenticated_session(&self) -> Result<SupabaseSession, CommandError> {
        let session = self.session_store.get_current()
            .ok_or(CommandError::NotAuthenticated)?;

        // Check if JWT is expired
        if session.expires_at <= Utc::now() {
            // Try to refresh
            match self.try_refresh_session_sync() {
                Ok(new_session) => return Ok(new_session),
                Err(_) => return Err(CommandError::SessionExpired),
            }
        }

        // Check if JWT is about to expire (proactive refresh)
        let buffer = chrono::Duration::minutes(5);
        if session.expires_at <= Utc::now() + buffer {
            // Fire-and-forget refresh (don't block this request)
            let _ = self.schedule_session_refresh();
        }

        Ok(session)
    }
}
```

---

## 7. Commands Requiring Admin Role

These commands check both authentication AND the `admin` role claim from the JWT:

| Command | Role Required | Reason |
|---|---|---|
| `update_config` | admin | Modifies app configuration for all users |
| `list_repos` | admin | GitHub repo access is admin-managed |
| `clone_repo` | admin | Downloads code to local machine |
| `create_issue` | admin | Creates issues on behalf of the organization |
| `create_pull_request` | admin | Creates PRs on behalf of the organization |
| `aion_execute` | admin | Executes arbitrary AION API calls |
| `export_diagnostic_logs` | admin | Contains potentially sensitive operational data |
| `admin_create_user` | admin | User management |
| `admin_list_users` | admin | User management |
| `admin_update_user_role` | admin | Role management |
| `admin_revoke_device` | admin | Device revocation |

### Role Enforcement

```rust
impl AppState {
    fn require_admin_role(&self) -> Result<SupabaseSession, CommandError> {
        let session = self.require_authenticated_session()?;

        if session.role != "admin" {
            log::warn!(
                "Non-admin user {} attempted admin command",
                session.user_id
            );
            return Err(CommandError::InsufficientPermissions {
                required: "admin".to_string(),
                actual: session.role.clone(),
            });
        }

        Ok(session)
    }
}

// Usage in admin commands:
#[tauri::command]
async fn update_config(
    state: tauri::State<'_, AppState>,
    config: PartialAppConfig,
) -> Result<(), CommandError> {
    state.rate_limiter.check("config", &state.current_user_id()?)?;

    let session = state.require_admin_role()?;

    config.validate()?;

    state.config_manager.update(&session, config).await?;

    log::info!(
        "Config updated by admin user_id={} tenant_id={}",
        session.user_id,
        session.tenant_id
    );

    Ok(())
}
```

---

## 8. CSP Configuration

Content Security Policy restricts what the WebView can load and execute, providing defense-in-depth against XSS.

### Configuration in `tauri.conf.json`

```json
{
  "app": {
    "security": {
      "csp": {
        "default-src": ["'self'"],
        "script-src": ["'self'"],
        "style-src": ["'self'", "'unsafe-inline'"],
        "img-src": ["'self'", "data:", "blob:"],
        "font-src": ["'self'", "data:"],
        "connect-src": [
          "'self'",
          "https://*.supabase.co",
          "ipc://localhost"
        ],
        "frame-src": ["'none'"],
        "object-src": ["'none'"],
        "base-uri": ["'self'"],
        "form-action": ["'self'"],
        "frame-ancestors": ["'none'"]
      },
      "dangerousDisableAssetCspModification": false
    }
  }
}
```

### CSP Directive Breakdown

| Directive | Value | Rationale |
|---|---|---|
| `default-src` | `'self'` | Block everything not explicitly allowed |
| `script-src` | `'self'` | No inline scripts, no eval, no external scripts. This blocks most XSS payloads. |
| `style-src` | `'self' 'unsafe-inline'` | Tailwind/shadcn require inline styles. Acceptable risk. |
| `img-src` | `'self' data: blob:` | Allow local images and data URIs (for inline icons). |
| `font-src` | `'self' data:` | Allow bundled fonts. |
| `connect-src` | `'self' https://*.supabase.co ipc://localhost` | Allow Supabase API calls and Tauri IPC. No other network destinations. |
| `frame-src` | `'none'` | No iframes (prevents clickjacking). |
| `object-src` | `'none'` | No plugins (Flash, Java). |
| `base-uri` | `'self'` | Prevent `<base>` tag injection. |
| `form-action` | `'self'` | Prevent form submission to external URLs. |
| `frame-ancestors` | `'none'` | Cannot be embedded in iframes (defense in depth). |

### What CSP Does NOT Allow

- **No `'unsafe-eval'`**: No `eval()`, no `new Function()`, no `setTimeout('string')`.
- **No `'unsafe-inline'` for scripts**: Even if XSS injects a `<script>` tag, CSP blocks it.
- **No external script sources**: Cannot load scripts from CDNs or attacker-controlled domains.
- **No connections to unlisted domains**: Cannot exfiltrate data to attacker servers.

### Verification

1. Open Tauri DevTools (Ctrl+Shift+I in dev mode).
2. Check the Console for CSP violation reports.
3. Attempt to inject `<script>alert(1)</script>` via a file name or API response — should be blocked.
4. Attempt to load an external script `<script src="https://evil.com/x.js">` — should be blocked.
5. Verify `Content-Security-Policy` header in the Network tab.

---

## 9. Command Registry

Complete list of IPC commands with their security properties:

| Command | Auth Required | Role | Rate Category | Input Validation |
|---|---|---|---|---|
| `sign_in` | No | any | auth (5/min) | email format, password length |
| `sign_in_magic_link` | No | any | auth (5/min) | email format |
| `sign_out` | Yes | any | auth (5/min) | none |
| `get_session` | Yes | any | auth (5/min) | none |
| `refresh_session` | Yes | any | auth (5/min) | none |
| `upload_file` | Yes | any | files (30/min) | filename, path, tags |
| `list_files` | Yes | any | files (30/min) | page (int), limit (int, max 100) |
| `get_file` | Yes | any | files (30/min) | file_id (UUID) |
| `delete_file` | Yes | any | files (30/min) | file_id (UUID) |
| `decrypt_and_open` | Yes | any | files (30/min) | file_id (UUID) |
| `get_sync_status` | Yes | any | files (30/min) | none |
| `connect_drive` | Yes | any | drive (10/min) | none |
| `disconnect_drive` | Yes | any | drive (10/min) | none |
| `get_drive_status` | Yes | any | drive (10/min) | none |
| `force_sync_file` | Yes | any | drive (10/min) | file_id (UUID) |
| `ai_complete` | Yes | any | ai (20/min) | messages, max_tokens, temperature |
| `ai_get_usage` | Yes | any | ai (20/min) | none |
| `ai_get_capabilities` | Yes | any | ai (20/min) | provider enum |
| `get_config` | Yes | any | config (5/min) | none |
| `get_setup_steps` | No | any | config (5/min) | none |
| `test_supabase_connection` | No | any | config (5/min) | URL, anon_key |
| `update_config` | Yes | **admin** | config (5/min) | partial config schema |
| `list_repos` | Yes | **admin** | github (10/min) | none |
| `clone_repo` | Yes | **admin** | github (10/min) | repo object, local_path |
| `create_issue` | Yes | **admin** | github (10/min) | repo, title, body, labels |
| `create_pull_request` | Yes | **admin** | github (10/min) | repo, title, body, head, base |
| `aion_execute` | Yes | **admin** | admin (10/min) | request object |
| `get_health_status` | Yes | any | diagnostics (2/min) | none |
| `export_diagnostic_logs` | Yes | **admin** | diagnostics (2/min) | none |
| `admin_create_user` | Yes | **admin** | admin (10/min) | email, role, tenant_id |
| `admin_list_users` | Yes | **admin** | admin (10/min) | tenant_id |
| `admin_update_user_role` | Yes | **admin** | admin (10/min) | user_id, new_role |
| `admin_revoke_device` | Yes | **admin** | admin (10/min) | device_id |

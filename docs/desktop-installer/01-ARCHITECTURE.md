# AION Defensa Predictiva S.A.S - Desktop Installer Architecture

## Version: 1.0 | Fecha: 2026-02-08

---

## 1. Decisión de Stack

### Recomendación principal: **Tauri 2.x + Rust + TypeScript/React**

### Alternativa: Electron + Node.js + TypeScript + React

| Criterio | Tauri 2.x | Electron |
|---|---|---|
| **Tamaño instalador** | ~8-15 MB | ~150-250 MB |
| **Consumo RAM** | ~30-80 MB | ~150-400 MB |
| **Seguridad** | Rust backend, sin Node en runtime, IPC estricto | Node completo expuesto, `nodeIntegration` riesgoso |
| **Acceso nativo** | Rust FFI directo a Keychain/DPAPI | Requiere addons nativos (N-API) |
| **Cifrado AES-256** | `ring` / `aes-gcm` nativas en Rust (~10x más rápido) | `crypto` de Node (aceptable) |
| **Auto-update** | Tauri Updater con firma Ed25519 integrada | electron-updater (funcional pero más superficie) |
| **macOS notarización** | Soporte nativo en tauri-cli | electron-builder (maduro, más configs) |
| **Ecosistema** | Creciendo rápido, Tauri 2.x estable | Maduro, enorme ecosistema |
| **Curva aprendizaje** | Rust requerido para backend | Solo JS/TS |

### Justificación

1. **Seguridad**: Rust elimina clases enteras de vulnerabilidades (buffer overflow, use-after-free). El modelo IPC de Tauri es allowlist-based (deny-by-default), vs Electron donde hay que desactivar cosas.
2. **Tamaño**: Un instalador de 10 MB vs 200 MB importa para despliegue empresarial en flotas con conexión limitada (contexto: transporte colombiano, zonas rurales).
3. **Rendimiento**: Cifrado AES-256 de archivos grandes en Rust es significativamente más eficiente.
4. **Acceso a Keychain/DPAPI**: Rust tiene crates maduros (`keyring`, `security-framework` para macOS, `windows-credentials` para Windows).

### Cuándo elegir Electron en su lugar

- Equipo sin experiencia en Rust y timeline < 3 meses.
- Se necesitan plugins Electron específicos ya maduros.
- Prioridad es velocidad de desarrollo sobre seguridad/rendimiento.

---

## 2. Arquitectura por Capas

```
┌─────────────────────────────────────────────────────────────────┐
│                         UI LAYER (React + TS)                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐   │
│  │  Setup   │ │Dashboard │ │  Files   │ │   AI Assistant   │   │
│  │  Wizard  │ │  Views   │ │ Manager  │ │     Panel        │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              Tauri IPC Bridge (invoke / events)          │    │
│  └─────────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────────┤
│                     CORE LAYER (Rust)                            │
│  ┌───────────┐ ┌────────────┐ ┌──────────┐ ┌──────────────┐   │
│  │  Auth     │ │  File      │ │  Sync    │ │  Config      │   │
│  │  Manager  │ │  Manager   │ │  Engine  │ │  Manager     │   │
│  └───────────┘ └────────────┘ └──────────┘ └──────────────┘   │
│  ┌───────────┐ ┌────────────┐ ┌──────────┐                    │
│  │  Crypto   │ │  Task      │ │  Logger  │                    │
│  │  Engine   │ │  Queue     │ │  Engine  │                    │
│  └───────────┘ └────────────┘ └──────────┘                    │
├─────────────────────────────────────────────────────────────────┤
│                  INTEGRATION LAYER (Rust)                        │
│  ┌───────────┐ ┌────────────┐ ┌──────────┐ ┌──────────────┐   │
│  │ Supabase  │ │  GitHub    │ │  Google  │ │   AION    │   │
│  │ Provider  │ │  Provider  │ │  Drive   │ │   Provider   │   │
│  └───────────┘ └────────────┘ └──────────┘ └──────────────┘   │
│  ┌───────────┐ ┌────────────┐                                   │
│  │  Claude   │ │  OpenAI    │                                   │
│  │ Provider  │ │  Provider  │                                   │
│  └───────────┘ └────────────┘                                   │
├─────────────────────────────────────────────────────────────────┤
│                   STORAGE LAYER (Rust)                           │
│  ┌───────────────────┐ ┌────────────────────┐                   │
│  │  Local FS          │ │  SQLite (metadata) │                   │
│  │  (AES-256-GCM)    │ │  (sqlx / rusqlite) │                   │
│  └───────────────────┘ └────────────────────┘                   │
│  ┌───────────────────┐ ┌────────────────────┐                   │
│  │  Keychain/DPAPI   │ │  Config Store      │                   │
│  │  (keyring crate)  │ │  (toml/encrypted)  │                   │
│  └───────────────────┘ └────────────────────┘                   │
└─────────────────────────────────────────────────────────────────┘
```

### 2.1 UI Layer (TypeScript + React)

- **Framework**: React 18+ con el mismo stack del proyecto web existente (shadcn/ui, Tailwind, Radix).
- **Comunicación con backend**: Exclusivamente vía `@tauri-apps/api` (invoke commands + event listeners).
- **Estado**: TanStack Query para cache de datos remotos, Zustand para estado local de UI.
- **SIN acceso directo a filesystem, red, ni cripto** — todo delegado al backend Rust vía IPC.

### 2.2 Core Layer (Rust)

| Módulo | Responsabilidad |
|---|---|
| `auth_manager` | Orquesta flujos OAuth, gestiona sesiones, almacena/rota tokens |
| `file_manager` | Upload, cifrado, metadatos, verificación de integridad |
| `sync_engine` | Cola de tareas, deduplicación, reintentos, resolución de conflictos |
| `config_manager` | Lectura/escritura de configuración per-tenant, validación de esquema |
| `crypto_engine` | AES-256-GCM, derivación de llaves (Argon2id), rotación |
| `task_queue` | Cola persistente (SQLite-backed), prioridades, dead-letter |
| `logger_engine` | Structured logging, redacción automática de secretos, rotación |

### 2.3 Integration Layer (Rust)

Cada integración implementa un trait `Provider` que define el contrato. Ver sección de interfaces.

### 2.4 Storage Layer

- **Archivos**: `{app_data_dir}/{tenant_id}/{user_id}/files/` — cifrados con AES-256-GCM.
- **Metadatos**: SQLite local con WAL mode para concurrencia.
- **Secretos**: Keychain (macOS) / Credential Manager vía DPAPI (Windows).
- **Config**: TOML cifrado con llave derivada de Keychain/DPAPI.

### 2.5 Sync Engine

```
┌─────────┐     ┌──────────┐     ┌────────────┐     ┌──────────┐
│  File    │────>│  Task    │────>│  Executor  │────>│  Remote  │
│  Event   │     │  Queue   │     │  (workers) │     │  (Drive/ │
│          │     │ (SQLite) │     │            │     │  Supabase)│
└─────────┘     └──────────┘     └────────────┘     └──────────┘
                     │                  │
                     │            ┌─────┴─────┐
                     │            │  Circuit   │
                     └───────────>│  Breaker   │
                                  └───────────┘
```

- **Cola persistente**: Tareas serializadas en SQLite. Sobrevive crashes/reinicios.
- **Deduplicación**: Por hash SHA-256 del archivo + tenant_id + user_id.
- **Checksum**: Verificación post-transfer con SHA-256.
- **Reintentos**: Exponential backoff con jitter (base 2s, max 5min, max 8 intentos).
- **Circuit breaker**: Abre tras 5 fallos consecutivos, half-open tras 60s.
- **Control de versiones**: Cada archivo tiene `version_id` incremental. Se mantienen últimas N versiones según política de retención.
- **Backpressure**: Máximo 3 uploads simultáneos a Drive, rate limiter token-bucket para APIs de IA.

---

## 3. Flujo de Autenticación

### 3.1 Supabase Auth

```
┌──────────┐   ┌──────────────┐   ┌──────────────┐
│  Desktop │──>│  Supabase    │──>│  Postgres    │
│  App     │   │  Auth        │   │  (profiles,  │
│          │<──│  (GoTrue)    │<──│  user_roles) │
└──────────┘   └──────────────┘   └──────────────┘
```

- **Método primario**: Email/password (existente en el proyecto).
- **Método secundario**: Magic link (email).
- **SSO**: Preparar interfaz, implementar en v2 si se requiere (SAML via Supabase).
- **Tokens**: JWT de Supabase almacenado en Keychain/DPAPI. Refresh automático 5 min antes de expiración.
- **Sesión offline**: Token cacheado localmente permite operaciones offline. Al reconectar, revalida.

### 3.2 GitHub: Recomendación GitHub App (no OAuth App)

| Criterio | GitHub App | OAuth App |
|---|---|---|
| Permisos granulares | Por repo, por permiso | Scopes amplios |
| Rate limits | 5000 req/h por instalación | 5000 req/h por usuario |
| Actúa como | Bot (instalación) | Usuario |
| Webhooks | Nativos | Requiere config manual |
| Seguridad | JWT + installation token (corta vida) | Personal access token (larga vida) |

**Recomendación: GitHub App** porque:
1. Permisos granulares (solo `contents:read`, `issues:write`, `pull_requests:write` por repo).
2. Tokens de instalación expiran en 1 hora (vs PAT que vive hasta que se revoca).
3. Actúa como bot, no como usuario — mejor auditoría.

**Flujo**:
1. Admin instala la GitHub App en su org/repo.
2. Desktop app recibe `installation_id` vía callback.
3. Backend Rust genera JWT (firmado con private key de la App) → pide installation token.
4. Installation token (1h TTL) se usa para operaciones.
5. Se renueva automáticamente antes de expiración.
6. Private key de la GitHub App: **NUNCA en el instalador**. Se obtiene de Supabase (cifrada, solo para admins autorizados) o se genera per-installation.

### 3.3 Google OAuth para Drive

**Scopes mínimos**:
```
https://www.googleapis.com/auth/drive.file
```

Este scope solo permite acceso a archivos **creados por la app**. No accede a ningún otro archivo del usuario.

**NO usar**:
- `drive` (acceso completo — prohibido)
- `drive.readonly` (innecesario y excesivo)

**Flujo**:
1. Usuario hace clic en "Conectar Google Drive".
2. App abre navegador del sistema (no webview) con authorization URL.
3. Callback a `http://localhost:{random_port}/oauth/google/callback`.
4. Se intercambia code por access_token + refresh_token.
5. Tokens almacenados en Keychain/DPAPI.
6. Refresh automático. Si refresh falla (token revocado), notificar al usuario.

**Puerto local**: Aleatorio en rango alto (49152-65535), bind a 127.0.0.1 exclusivamente.

### 3.4 Manejo de Tokens — Ciclo de Vida

```
┌─────────┐   ┌──────────┐   ┌────────────┐   ┌──────────────┐
│ Obtain  │──>│  Store   │──>│  Use       │──>│  Refresh     │
│ (OAuth) │   │ (Keychn/ │   │  (attach   │   │  (before     │
│         │   │  DPAPI)  │   │   to req)  │   │   expiry)    │
└─────────┘   └──────────┘   └────────────┘   └──────────────┘
                                                      │
                                                      v
                                               ┌──────────────┐
                                               │  Revoke      │
                                               │  (on logout/ │
                                               │   disconnect)│
                                               └──────────────┘
```

- **Nunca en memoria más de lo necesario**: Los tokens se leen de Keychain/DPAPI para cada operación y se dropean inmediatamente.
- **Refresh proactivo**: 5 minutos antes de expiración.
- **Revocación explícita**: Al desconectar cuenta, se llama al endpoint de revocación del proveedor Y se elimina de Keychain/DPAPI.
- **Logging**: Los tokens NUNCA aparecen en logs. Se loguea `token_type`, `expires_at`, `provider`, `scopes`.

---

## 4. Modelo de Configuración

### 4.1 Pantalla de Setup Inicial

```
┌─────────────────────────────────────────────┐
│        AION Defensa Predictiva S.A.S - Setup            │
│                                              │
│  Paso 1/4: Conexión Supabase               │
│  ┌────────────────────────────────────┐     │
│  │ URL Supabase:    [____________]   │     │
│  │ Anon Key:        [____________]   │     │
│  │ Región:          [dropdown___]    │     │
│  │                                    │     │
│  │ [Probar conexión]  [Siguiente →]  │     │
│  └────────────────────────────────────┘     │
│                                              │
│  Paso 2/4: Autenticación                    │
│  Paso 3/4: Integraciones opcionales         │
│  Paso 4/4: Almacenamiento local             │
└─────────────────────────────────────────────┘
```

**Paso 1**: URL de Supabase + anon key (público, no es secreto).
**Paso 2**: Login con email/password de Supabase Auth.
**Paso 3**: Conectar GitHub (opcional), Google Drive (opcional), configurar IA (opcional).
**Paso 4**: Elegir carpeta local para archivos, passphrase opcional, política de retención.

### 4.2 Variables por Entorno

```toml
# config.toml (cifrado en reposo)
[environment]
name = "production"  # dev | staging | production

[supabase]
url = "https://xxxx.supabase.co"
anon_key = "eyJ..."  # anon key (público)
# service_role_key NUNCA se almacena en el cliente

[features]
ai_enabled = true
drive_backup_enabled = true
github_enabled = false
offline_mode = false

[storage]
local_path = "/Users/admin/AIONDefensaPredictiva/data"
max_local_storage_gb = 50
retention_days = 365
encryption_algorithm = "AES-256-GCM"

[sync]
max_concurrent_uploads = 3
retry_max_attempts = 8
retry_base_delay_ms = 2000
circuit_breaker_threshold = 5
circuit_breaker_recovery_ms = 60000

[ai]
default_provider = "claude"  # claude | openai
max_tokens_per_request = 4096
monthly_budget_usd = 100.0
cache_ttl_seconds = 3600

[logging]
level = "info"  # debug | info | warn | error
diagnostic_mode = false
max_log_file_mb = 50
retention_days = 30
```

### 4.3 Multi-Tenant

```
{app_data_dir}/
├── global_config.toml.enc        # Config global cifrada
├── tenants/
│   ├── {tenant_id_1}/
│   │   ├── config.toml.enc       # Config de tenant
│   │   ├── metadata.db           # SQLite de metadatos
│   │   ├── users/
│   │   │   ├── {user_id_a}/
│   │   │   │   ├── files/        # Archivos cifrados
│   │   │   │   └── cache/        # Cache de AI, etc.
│   │   │   └── {user_id_b}/
│   │   └── logs/
│   └── {tenant_id_2}/
└── logs/                          # Logs globales
```

---

## 5. Estructura del Repositorio y CI/CD

### 5.1 Estructura del Repositorio

```
aion-defensa-predictiva-desktop/
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                 # Lint + test + build check
│   │   ├── release.yml            # Build + sign + notarize + publish
│   │   └── security-audit.yml     # cargo audit + npm audit + SAST
│   └── CODEOWNERS
├── src-tauri/                     # Rust backend
│   ├── Cargo.toml
│   ├── Cargo.lock
│   ├── tauri.conf.json
│   ├── capabilities/              # Tauri 2 permissions
│   │   ├── default.json
│   │   └── admin.json
│   ├── src/
│   │   ├── main.rs
│   │   ├── lib.rs
│   │   ├── commands/              # IPC command handlers
│   │   │   ├── mod.rs
│   │   │   ├── auth.rs
│   │   │   ├── files.rs
│   │   │   ├── sync.rs
│   │   │   ├── config.rs
│   │   │   └── ai.rs
│   │   ├── core/                  # Business logic
│   │   │   ├── mod.rs
│   │   │   ├── auth_manager.rs
│   │   │   ├── file_manager.rs
│   │   │   ├── sync_engine.rs
│   │   │   ├── config_manager.rs
│   │   │   ├── crypto_engine.rs
│   │   │   ├── task_queue.rs
│   │   │   └── logger.rs
│   │   ├── providers/             # External integrations
│   │   │   ├── mod.rs
│   │   │   ├── traits.rs          # Provider traits
│   │   │   ├── supabase.rs
│   │   │   ├── github.rs
│   │   │   ├── google_drive.rs
│   │   │   ├── aion.rs
│   │   │   ├── claude.rs
│   │   │   └── openai.rs
│   │   ├── storage/               # Local storage
│   │   │   ├── mod.rs
│   │   │   ├── encrypted_fs.rs
│   │   │   ├── metadata_db.rs
│   │   │   └── keyring.rs
│   │   ├── models/                # Data structures
│   │   │   ├── mod.rs
│   │   │   ├── auth.rs
│   │   │   ├── file.rs
│   │   │   ├── sync.rs
│   │   │   ├── config.rs
│   │   │   └── ai.rs
│   │   └── utils/
│   │       ├── mod.rs
│   │       ├── retry.rs
│   │       ├── circuit_breaker.rs
│   │       └── redact.rs
│   ├── migrations/                # SQLite migrations
│   │   └── 001_initial.sql
│   └── tests/
│       ├── integration/
│       └── unit/
├── src/                           # Frontend (React + TS)
│   ├── main.tsx
│   ├── App.tsx
│   ├── components/
│   │   ├── ui/                    # shadcn/ui (reutilizar del web)
│   │   ├── setup/
│   │   │   ├── SetupWizard.tsx
│   │   │   ├── SupabaseStep.tsx
│   │   │   ├── AuthStep.tsx
│   │   │   ├── IntegrationsStep.tsx
│   │   │   └── StorageStep.tsx
│   │   ├── dashboard/
│   │   ├── files/
│   │   │   ├── FileManager.tsx
│   │   │   ├── FileUploader.tsx
│   │   │   ├── SyncStatus.tsx
│   │   │   └── FileList.tsx
│   │   ├── ai/
│   │   │   ├── AIPanel.tsx
│   │   │   ├── ProviderSelector.tsx
│   │   │   └── ChatInterface.tsx
│   │   ├── settings/
│   │   │   ├── GeneralSettings.tsx
│   │   │   ├── SecuritySettings.tsx
│   │   │   ├── IntegrationSettings.tsx
│   │   │   └── DiagnosticPanel.tsx
│   │   └── layout/
│   ├── hooks/
│   │   ├── useTauriCommand.ts
│   │   ├── useAuth.ts
│   │   ├── useFiles.ts
│   │   ├── useSyncStatus.ts
│   │   └── useAI.ts
│   ├── lib/
│   │   ├── tauri-bridge.ts        # Typed IPC wrappers
│   │   ├── types.ts
│   │   └── utils.ts
│   └── stores/
│       ├── auth-store.ts
│       └── ui-store.ts
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
├── .env.example                   # Solo variables no-secretas
├── .gitignore
├── LICENSE
└── README.md
```

### 5.2 CI/CD Strategy

**CI Pipeline** (`ci.yml`):
```yaml
# Triggers: push to main, PRs
jobs:
  lint-and-test:
    - cargo fmt --check
    - cargo clippy -- -D warnings
    - cargo test
    - npm run lint
    - npm run test
    - npm run type-check

  security-audit:
    - cargo audit
    - npm audit --audit-level=high
    - cargo deny check licenses
```

**Release Pipeline** (`release.yml`):
```yaml
# Trigger: tag push (v*)
jobs:
  build-macos:
    runs-on: macos-latest
    steps:
      - Build universal binary (x86_64 + aarch64)
      - Sign with Developer ID certificate
      - Notarize with Apple notarytool
      - Create .dmg
      - Upload artifact

  build-windows:
    runs-on: windows-latest
    steps:
      - Build x86_64 .msi and .exe (NSIS)
      - Sign with EV code signing certificate (via Azure SignTool)
      - Upload artifact

  publish:
    needs: [build-macos, build-windows]
    steps:
      - Create GitHub Release
      - Upload signed installers
      - Update update manifest (tauri updater endpoint)
      - Compute and publish SHA-256 checksums
```

### 5.3 Firma de Código y Notarización

**macOS**:
- Apple Developer ID Application certificate (requiere cuenta de pago).
- `tauri-cli` maneja signing automáticamente con env vars:
  - `APPLE_CERTIFICATE` (base64)
  - `APPLE_CERTIFICATE_PASSWORD`
  - `APPLE_SIGNING_IDENTITY`
- Notarización con `notarytool` (reemplaza `altool`):
  - `APPLE_API_KEY`, `APPLE_API_ISSUER`, `APPLE_API_KEY_PATH`
- El `.dmg` final incluye stapled notarization ticket.

**Windows**:
- EV Code Signing Certificate (USB token o cloud HSM).
- Azure Trusted Signing o DigiCert KeyLocker recomendado.
- Sign tanto el `.exe` como el `.msi`.
- Timestamp con RFC 3161 TSA (DigiCert, Sectigo).

### 5.4 Auto-Update Seguro

```
┌──────────┐    HTTPS     ┌───────────────┐
│ Desktop  │──────────────>│  Update       │
│ App      │               │  Server       │
│          │<──────────────│  (GitHub      │
│          │   manifest    │   Releases)   │
└──────────┘   + sig       └───────────────┘
     │
     v
  Verify Ed25519 signature
     │
     v
  Download update bundle
     │
     v
  Verify SHA-256 checksum
     │
     v
  Apply update (with rollback on failure)
```

- **Tauri Updater**: Firma Ed25519 por defecto.
- **Manifest**: JSON con version, URL, signature, pub_date.
- **Verificación**: La public key Ed25519 está embebida en el binario.
- **Rollback**: Si la nueva versión no arranca en 30s, restaurar anterior.
- **Certificate pinning**: TLS certificate pinning para el endpoint de update.
- **Sin downgrade**: Verificar que `new_version > current_version`.

---

## 6. Almacenamiento de Archivos

### 6.1 Estructura Local

```
{app_data_dir}/tenants/{tenant_id}/users/{user_id}/files/
├── {file_uuid_1}.enc             # Archivo cifrado
├── {file_uuid_2}.enc
└── .versions/
    ├── {file_uuid_1}/
    │   ├── v1.enc
    │   └── v2.enc
    └── {file_uuid_2}/
        └── v1.enc
```

### 6.2 Metadatos (SQLite)

```sql
CREATE TABLE files (
    id              TEXT PRIMARY KEY,  -- UUID v7
    tenant_id       TEXT NOT NULL,
    user_id         TEXT NOT NULL,
    original_name   TEXT NOT NULL,
    mime_type       TEXT,
    size_bytes      INTEGER NOT NULL,
    sha256_hash     TEXT NOT NULL,     -- Hash del archivo ORIGINAL (antes de cifrar)
    enc_sha256_hash TEXT NOT NULL,     -- Hash del archivo cifrado
    encryption_key_id TEXT NOT NULL,   -- Referencia a la llave usada
    version         INTEGER NOT NULL DEFAULT 1,
    tags            TEXT,              -- JSON array
    sync_status     TEXT NOT NULL DEFAULT 'pending',
        -- pending | syncing | synced | error | conflict
    drive_file_id   TEXT,             -- Google Drive file ID (null si no synced)
    drive_sync_at   TEXT,             -- ISO 8601
    supabase_path   TEXT,             -- Path en Supabase Storage (si aplica)
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at      TEXT              -- Soft delete
);

CREATE INDEX idx_files_tenant_user ON files(tenant_id, user_id);
CREATE INDEX idx_files_sync_status ON files(sync_status);
CREATE INDEX idx_files_hash ON files(sha256_hash);

CREATE TABLE encryption_keys (
    id              TEXT PRIMARY KEY,
    tenant_id       TEXT NOT NULL,
    algorithm       TEXT NOT NULL DEFAULT 'AES-256-GCM',
    created_at      TEXT NOT NULL,
    rotated_at      TEXT,
    status          TEXT NOT NULL DEFAULT 'active',
        -- active | rotated | revoked
    keychain_ref    TEXT NOT NULL     -- Referencia en Keychain/DPAPI
);

CREATE TABLE sync_tasks (
    id              TEXT PRIMARY KEY,
    file_id         TEXT NOT NULL REFERENCES files(id),
    task_type       TEXT NOT NULL,    -- upload_drive | upload_supabase | delete_remote
    status          TEXT NOT NULL DEFAULT 'queued',
        -- queued | in_progress | completed | failed | dead_letter
    attempts        INTEGER NOT NULL DEFAULT 0,
    max_attempts    INTEGER NOT NULL DEFAULT 8,
    next_retry_at   TEXT,
    last_error      TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at    TEXT
);

CREATE INDEX idx_sync_tasks_status ON sync_tasks(status, next_retry_at);
```

### 6.3 Cifrado

```
                   ┌────────────────────┐
                   │  User Passphrase   │ (opcional)
                   │  (si configurada)  │
                   └────────┬───────────┘
                            │ Argon2id
                            v
┌─────────────┐    ┌────────────────┐    ┌────────────────┐
│  Keychain/  │───>│  Master Key    │───>│  Envelope      │
│  DPAPI      │    │  (DEK wrapper) │    │  Encryption    │
└─────────────┘    └────────────────┘    └────────┬───────┘
                                                   │
                    ┌──────────────────────────────┘
                    v
            ┌───────────────┐
            │  Per-file     │    AES-256-GCM
            │  Data Key     │──────────────────> archivo.enc
            │  (DEK)        │    (unique IV per file)
            └───────────────┘
```

- **Envelope encryption**: Cada archivo tiene su propia DEK (Data Encryption Key).
- **DEK** se cifra con la Master Key (almacenada en Keychain/DPAPI).
- **Si hay passphrase**: Master Key = HKDF(Keychain_key, Argon2id(passphrase, salt)).
- **IV/Nonce**: 96 bits, generado con CSPRNG, único por archivo+versión.
- **Auth tag**: GCM proporciona autenticación integrada.
- **Rotación**: Al rotar, se re-cifran las DEKs (no los archivos). Se marca la key anterior como `rotated`.
- **Recuperación**: Con acceso a Keychain/DPAPI + passphrase (si configurada), se pueden descifrar todas las DEKs.

---

## 7. Respaldo a Google Drive

### 7.1 Estructura en Drive

```
My Drive/
└── AIONDefensaPredictiva/               # Carpeta raíz de la app
    └── {tenant_name}/
        └── backups/
            ├── {YYYY-MM}/         # Agrupado por mes
            │   ├── {original_name}_{file_uuid_short}.enc
            │   └── ...
            └── _metadata/
                └── manifest_{YYYY-MM}.json
```

- Los archivos se suben **cifrados** (el mismo `.enc` local). Drive es solo almacenamiento opaco.
- El `manifest.json` mensual lista archivos, hashes, y versiones para verificación.

### 7.2 Políticas

| Política | Valor default | Configurable |
|---|---|---|
| Retención en Drive | 365 días | Sí |
| Max archivo individual | 100 MB | Sí |
| Max storage total | 5 GB | Sí (respeta cuota Drive) |
| Frecuencia de sync | Cada 5 min (batch) | Sí |
| Archivos por batch | 10 | Sí |
| Reintentos por archivo | 8 | Sí |
| Backoff base | 2s (exponencial con jitter) | Sí |

### 7.3 Manejo de Errores y Backpressure

```
┌──────────┐    ┌──────────┐    ┌────────────┐    ┌──────────┐
│  File    │───>│  Batch   │───>│  Rate      │───>│  Google  │
│  Queue   │    │  Window  │    │  Limiter   │    │  Drive   │
│          │    │  (5 min) │    │  (3 conc.) │    │  API     │
└──────────┘    └──────────┘    └────────────┘    └──────────┘
                                      │
                              ┌───────┴───────┐
                              │  Backpressure │
                              │  Controller   │
                              └───────────────┘
```

- **Rate limiter**: Token bucket, 3 uploads simultáneos, 100 req/100s (Drive API limit).
- **Backpressure**: Si Drive responde 429 (rate limit), reducir concurrencia a 1 y backoff 30s.
- **Cuota**: Pre-check con `about.get` para cuota restante. Si < 10% libre, alertar usuario.
- **Red**: Detectar tipo de conexión. En metered/slow, reducir concurrencia a 1 y batch size a 3.
- **Circuit breaker**: 5 fallos consecutivos → pausa 5 minutos → retry 1 archivo → si OK, reabrir.
- **Dead letter queue**: Tras 8 intentos, mover a dead-letter. Alertar al usuario. Retry manual.

---

## 8. Integración con IA (GPT + Claude Code)

### 8.1 Patrón Provider Interface

```
┌──────────┐
│  AI      │    trait AIProvider
│  Router  │──────────┐
│          │          │
└──────────┘    ┌─────┴──────┐
                │            │
         ┌──────┴──┐  ┌─────┴───┐
         │ Claude  │  │ OpenAI  │   (+ futuro: Gemini, local LLM)
         │Provider │  │Provider │
         └─────────┘  └─────────┘
```

- **Selección de provider**: Configurable por usuario. Default Claude, fallback OpenAI.
- **Cambio transparente**: El core nunca sabe qué provider se usa.
- **Feature parity check**: Al arrancar, cada provider reporta capabilities.

### 8.2 Rate Limiting y Cost Control

```toml
[ai.limits]
max_requests_per_minute = 20
max_tokens_per_request = 4096
max_tokens_per_day = 100000
monthly_budget_usd = 100.00
cache_ttl_seconds = 3600
```

- **Token counting**: Pre-conteo con `tiktoken` (OpenAI) o estimación conservadora (Claude).
- **Presupuesto**: Al alcanzar 80%, alertar. Al alcanzar 100%, bloquear con override manual.
- **Cache**: Respuestas cacheadas por hash de (prompt + context). LRU cache con TTL.
- **Redacción automática**: Antes de enviar a cualquier API de IA:
  1. Eliminar tokens, API keys, passwords (regex patterns).
  2. Reemplazar emails/teléfonos con placeholders.
  3. No enviar archivos completos sin aprobación explícita del usuario.
  4. Truncar contexto a máximo necesario.

### 8.3 Guardrails

| Regla | Implementación |
|---|---|
| Nunca enviar secretos | Regex pre-filter + allowlist de campos |
| Nunca enviar archivos completos | Solo metadata + snippet (primeras 500 líneas) sin aprobación |
| Logging de prompts | Se loguea hash del prompt, modelo, tokens, costo, NO el contenido |
| Prompt injection defense | System prompt fijo + user input sanitizado + output validation |
| Data classification | Archivos marcados como `confidential` NUNCA se envían a IA |

### Supuestos sobre APIs ambiguas

**API de AION**: Se asume REST con auth via API key o Bearer token. Interfaz genérica:
- `POST /api/v1/actions` — ejecutar acciones de negocio.
- `GET /api/v1/resources/{id}` — consultar recursos.
- Aislamiento: `AIONProvider` implementa `ExternalAPIProvider` trait. Si la API cambia, solo se modifica el provider.

**Claude Code API**: Se asume API REST compatible con Anthropic Messages API. Si es un servicio local (CLI), se envuelve como subprocess. Interfaz:
- Si REST: `POST /v1/messages` con model, messages, max_tokens.
- Si CLI: spawn process, communicate via stdin/stdout.
- Aislamiento: `ClaudeProvider` implementa `AIProvider` trait.

---

## 9. Amenazas y Mitigaciones (ver documento 02-SECURITY-AUDIT.md)

Resumen rápido aquí, detalle completo en el documento de seguridad.

| Amenaza | Impacto | Mitigación |
|---|---|---|
| Robo de token (laptop robada) | Critical | Keychain/DPAPI + cifrado + sesión timeout |
| Manipulación del updater | Critical | Ed25519 signature verification + cert pinning |
| Exfiltración de archivos | High | AES-256-GCM + permisos FS + DLP en IA |
| MITM | High | Certificate pinning + HSTS |
| Permisos OAuth excesivos | Medium | Scopes mínimos + revisión periódica |
| Logging con secretos | Medium | Redacción automática + regex filter |
| DLL hijacking (Windows) | High | Absolute paths + DLL search order hardening |
| Prompt injection | Medium | Input sanitization + system prompt hardening |

---

## 10. Plan por Fases

### Fase 1: MVP (Semanas 1-8)

**Objetivo**: App funcional con autenticación, archivos locales cifrados y vista de dashboard.

| Hito | Entregable | Riesgo | Validación |
|---|---|---|---|
| M1: Scaffolding | Tauri project + CI pipeline | Curva Rust | Build exitoso en CI |
| M2: Auth | Supabase login + Keychain storage | Flujo OAuth complejo | Login/logout sin leak tokens |
| M3: Files | Upload + cifrado local + metadata DB | Performance cifrado | Upload 100MB < 5s |
| M4: Dashboard | Vista básica de archivos + sync status | - | UI funcional |
| M5: Installers | Builds firmados macOS + Windows | Notarización | Instalar en máquina limpia |

**Criterio de éxito MVP**: Un usuario puede instalar la app, loguearse, subir archivos que se cifran localmente, y ver su estado.

### Fase 2: v1.0 (Semanas 9-16)

| Hito | Entregable | Riesgo | Validación |
|---|---|---|---|
| M6: Google Drive | Backup automático + políticas | Cuotas API | Sync 50 archivos sin error |
| M7: GitHub | Clonar repos + crear issues | GitHub App setup | Clone + create issue E2E |
| M8: Auto-update | Updater firmado con rollback | Notarización en CI | Update sin romper app |
| M9: Multi-tenant | Soporte N tenants en 1 app | Aislamiento datos | Datos tenant A invisible para B |
| M10: Offline mode | Operaciones offline + sync al reconectar | Conflictos | Operar 1h offline + sync |

**Criterio de éxito v1**: Todos los flujos core funcionan, auto-update seguro, multi-tenant.

### Fase 3: v2.0 (Semanas 17-24)

| Hito | Entregable | Riesgo | Validación |
|---|---|---|---|
| M11: AI Integration | Claude + GPT providers | Costos, data leaks | Guardrails verificados |
| M12: AION API | Integración bidireccional | API inestable | E2E con mock server |
| M13: SSO | SAML/OIDC via Supabase | Configuración compleja | Login SSO corporativo |
| M14: Audit | Logging avanzado + export | Volumen de logs | Audit trail 30 días |
| M15: Hardening | Pen test + remediación | Hallazgos críticos | Pen test limpio |

**Criterio de éxito v2**: Feature complete, pen test sin hallazgos críticos, listo para producción.

# AION Defensa Predictiva S.A.S

Fleet management and transportation compliance platform for Colombian trucking and taxi operations.

**Defensa Predictiva 24/7**

## Architecture

```
aion-defensa-predictiva/
├── src/                          # Web app (React + Vite + Supabase)
├── apps/desktop/                 # Desktop installer (Tauri 2 + React)
│   ├── src/                      # Desktop UI (React + TypeScript)
│   └── src-tauri/                # Rust backend
│       ├── src/commands/         # IPC command handlers
│       ├── migrations/           # SQLite schema
│       └── capabilities/         # Deny-by-default permissions
├── crates/                       # Shared Rust crates
│   ├── core/                     # Types, config, errors
│   ├── crypto/                   # AES-256-GCM envelope encryption
│   ├── audit/                    # Hash-chained audit log (BLAKE3)
│   ├── policy/                   # DLP, classification, approval, retention
│   ├── sync/                     # Circuit breaker, rate limiter, job queue
│   └── providers/                # External service integrations
│       ├── supabase/             # Auth + PostgREST
│       ├── github/               # GitHub App
│       ├── drive/                # Google Drive OAuth + PKCE
│       ├── openai/               # GPT completions
│       ├── claude/               # Anthropic completions
│       └── aion/                 # AION API adapter
├── docs/                         # Architecture, security & operational docs
├── policies/                     # YAML policy definitions
├── scripts/                      # Build, sign, notarize scripts
└── .github/workflows/            # CI/CD pipelines
```

## Web App

The web application is built with React 18 + TypeScript + Vite + shadcn/ui + Tailwind CSS, backed by Supabase (Auth, Postgres, Edge Functions).

### Setup

```bash
npm install
npm run dev
```

### Key Features
- Real-time GPS tracking (Traccar integration + MapLibre GL)
- Pre-operational vehicle inspections
- FUEC document management
- RNDC registry integration
- Role-based access (Admin / Conductor)

## Desktop App

The desktop installer adds offline-capable, security-hardened functionality via Tauri 2 + Rust.

### Prerequisites

- Rust 1.75+ with `cargo`
- Node.js 20+ with `npm`
- Platform SDK (Xcode CLT for macOS, VS Build Tools for Windows)

### Development

```bash
# Install frontend dependencies
cd apps/desktop && npm install

# Run in development mode
cd src-tauri && cargo tauri dev
```

### Build

```bash
# macOS
./scripts/build-macos.sh

# Windows (PowerShell)
./scripts/build-windows.ps1
```

### Security Features

- AES-256-GCM envelope encryption (per-file DEK, master key in OS Keychain)
- BLAKE3 hash-chained audit log with tamper detection
- DLP engine for Colombian PII (cedulas, NIT, phone numbers)
- 4-level data classification (PUBLIC -> RESTRICTED)
- Deny-by-default IPC permissions
- Kill switch for emergency suspension
- Ed25519 signed auto-updates

See `SECURITY.md` for the complete security policy and `COMPLIANCE.md` for regulatory compliance details.

## Documentation

| Doc | Topic |
|-----|-------|
| [01-ARCHITECTURE](docs/desktop-installer/01-ARCHITECTURE.md) | System architecture & stack decision |
| [02-SECURITY-AUDIT](docs/desktop-installer/02-SECURITY-AUDIT.md) | Threat model & security findings |
| [03-PSEUDOCODE](docs/desktop-installer/03-PSEUDOCODE.md) | Core algorithm pseudocode |
| [04-INTERFACES](docs/desktop-installer/04-INTERFACES.md) | Rust traits & TypeScript types |
| [05-SUPABASE-RLS](docs/desktop-installer/05-SUPABASE-RLS.md) | Row-level security policies |
| [06-UPDATER-SECURITY](docs/desktop-installer/06-UPDATER-SECURITY.md) | Auto-update signature verification |
| [07-DRIVE-OAUTH](docs/desktop-installer/07-DRIVE-OAUTH.md) | Google Drive OAuth + PKCE flow |
| [08-IPC-CAPABILITIES](docs/desktop-installer/08-IPC-CAPABILITIES.md) | Tauri capability model |
| [09-COMPLIANCE-MODEL](docs/desktop-installer/09-COMPLIANCE-MODEL.md) | Colombian regulatory compliance |
| [10-DLP-CLASSIFICATION](docs/desktop-installer/10-DLP-CLASSIFICATION.md) | DLP rules & data classification |
| [11-RETENTION-LEGAL-HOLD](docs/desktop-installer/11-RETENTION-LEGAL-HOLD.md) | Retention policies & legal hold |
| [12-RUNBOOKS](docs/desktop-installer/12-RUNBOOKS.md) | Operational runbooks (RB-01 to RB-10) |

### Operational Docs

| Doc | Topic |
|-----|-------|
| [SUPABASE_SETUP](docs/deployment/SUPABASE_SETUP.md) | Connect to real Supabase database |
| [RUN_MAC_WINDOWS](docs/deployment/RUN_MAC_WINDOWS.md) | Run on macOS / Windows |
| [LOCAL_STORAGE](docs/operations/LOCAL_STORAGE.md) | Local HDD storage options |
| [BACKUP_DRIVE](docs/operations/BACKUP_DRIVE.md) | Google Drive backup architecture |
| [GO_NO_GO](docs/security/GO_NO_GO.md) | Release security checklist |

## Configuration

Copy `.env.example` and fill in your credentials:

```bash
cp .env.example .env
```

Required values:
- `SUPABASE_URL` and `SUPABASE_ANON_KEY` — from your Supabase project
- OAuth client IDs for Google Drive and GitHub (optional, for integrations)
- AI API keys for OpenAI/Anthropic (optional, for AI features)

See `.env.example` for all available configuration options.

## License

MIT

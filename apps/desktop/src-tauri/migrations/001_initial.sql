-- AION Defensa Predictiva — Local SQLite Schema
-- This schema manages local file metadata, sync jobs, and configuration.
-- The audit log is in a separate database for integrity isolation.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ── Tenants ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tenants (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    supabase_url    TEXT NOT NULL,
    config_json     TEXT NOT NULL DEFAULT '{}',
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Users ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
    id              TEXT PRIMARY KEY,
    tenant_id       TEXT NOT NULL REFERENCES tenants(id),
    email           TEXT NOT NULL,
    role            TEXT NOT NULL DEFAULT 'viewer',
    last_login_at   TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);

-- ── Auth Links (connected integrations) ─────────────────────────────────

CREATE TABLE IF NOT EXISTS auth_links (
    id              TEXT PRIMARY KEY,
    tenant_id       TEXT NOT NULL REFERENCES tenants(id),
    user_id         TEXT NOT NULL REFERENCES users(id),
    provider        TEXT NOT NULL,   -- 'supabase', 'github', 'drive', 'openai', 'claude', 'aion'
    connected_at    TEXT NOT NULL DEFAULT (datetime('now')),
    scopes          TEXT,            -- JSON array of scopes
    expires_at      TEXT,
    -- Tokens are in Keychain/DPAPI, NOT in this table
    UNIQUE(tenant_id, user_id, provider)
);

-- ── Files ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS files (
    id                TEXT PRIMARY KEY,
    tenant_id         TEXT NOT NULL REFERENCES tenants(id),
    user_id           TEXT NOT NULL REFERENCES users(id),
    original_name     TEXT NOT NULL,
    mime_type         TEXT,
    size_bytes        INTEGER NOT NULL,
    blake3_hash       TEXT NOT NULL,
    enc_blake3_hash   TEXT NOT NULL,
    encryption_key_id TEXT NOT NULL,
    wrapped_dek       TEXT NOT NULL,   -- Base64-encoded wrapped DEK
    nonce             TEXT NOT NULL,   -- Base64-encoded nonce
    version           INTEGER NOT NULL DEFAULT 1,
    classification    TEXT NOT NULL DEFAULT 'INTERNAL',
    tags              TEXT NOT NULL DEFAULT '[]',
    sync_status       TEXT NOT NULL DEFAULT 'pending',
    drive_file_id     TEXT,
    drive_sync_at     TEXT,
    legal_hold        INTEGER NOT NULL DEFAULT 0,
    retention_until   TEXT,
    created_at        TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at        TEXT
);

CREATE INDEX IF NOT EXISTS idx_files_tenant_user ON files(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_files_sync ON files(sync_status);
CREATE INDEX IF NOT EXISTS idx_files_hash ON files(blake3_hash);
CREATE INDEX IF NOT EXISTS idx_files_classification ON files(classification);

-- ── Sync Jobs Queue ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS jobs_queue (
    id              TEXT PRIMARY KEY,
    file_id         TEXT NOT NULL REFERENCES files(id),
    tenant_id       TEXT NOT NULL REFERENCES tenants(id),
    job_type        TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'queued',
    attempts        INTEGER NOT NULL DEFAULT 0,
    max_attempts    INTEGER NOT NULL DEFAULT 8,
    next_retry_at   TEXT,
    last_error      TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at    TEXT
);

CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs_queue(status, next_retry_at);
CREATE INDEX IF NOT EXISTS idx_jobs_tenant ON jobs_queue(tenant_id, status);

-- ── Cost Usage Tracking (AI) ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cost_usage (
    id              TEXT PRIMARY KEY,
    tenant_id       TEXT NOT NULL REFERENCES tenants(id),
    provider        TEXT NOT NULL,   -- 'openai', 'claude'
    period          TEXT NOT NULL,   -- 'YYYY-MM-DD' for daily, 'YYYY-MM' for monthly
    requests        INTEGER NOT NULL DEFAULT 0,
    tokens_in       INTEGER NOT NULL DEFAULT 0,
    tokens_out      INTEGER NOT NULL DEFAULT 0,
    cost_usd        REAL NOT NULL DEFAULT 0.0,
    budget_usd      REAL NOT NULL DEFAULT 0.0,
    updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(tenant_id, provider, period)
);

-- ── Encryption Keys Registry ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS encryption_keys (
    id              TEXT PRIMARY KEY,
    tenant_id       TEXT NOT NULL REFERENCES tenants(id),
    algorithm       TEXT NOT NULL DEFAULT 'AES-256-GCM',
    status          TEXT NOT NULL DEFAULT 'active',  -- active, rotated, revoked
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    rotated_at      TEXT,
    keychain_ref    TEXT NOT NULL   -- Reference identifier in Keychain/DPAPI
);

CREATE INDEX IF NOT EXISTS idx_enckeys_tenant ON encryption_keys(tenant_id, status);

-- ── Policy State ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS policy_state (
    id              TEXT PRIMARY KEY,
    tenant_id       TEXT NOT NULL REFERENCES tenants(id),
    policy_type     TEXT NOT NULL,   -- 'retention', 'dlp', 'classification', 'budget'
    config_json     TEXT NOT NULL DEFAULT '{}',
    enabled         INTEGER NOT NULL DEFAULT 1,
    updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(tenant_id, policy_type)
);

-- ── Kill Switch ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kill_switch (
    id              INTEGER PRIMARY KEY CHECK (id = 1),  -- Singleton
    active          INTEGER NOT NULL DEFAULT 0,
    reason          TEXT,
    activated_at    TEXT,
    activated_by    TEXT
);

INSERT OR IGNORE INTO kill_switch (id, active) VALUES (1, 0);

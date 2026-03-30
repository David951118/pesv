# Interfaces — Provider Contracts

## Stack Dual: Rust Traits + TypeScript Types

Cada provider tiene:
1. Un **Rust trait** (backend, donde ocurre la lógica real).
2. Un **TypeScript type** (frontend, para tipado del IPC bridge).

---

## Rust Traits (src-tauri/src/providers/traits.rs)

```rust
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use chrono::{DateTime, Utc};

// ============================================================================
// Common Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderHealth {
    pub provider: String,
    pub is_healthy: bool,
    pub latency_ms: Option<u64>,
    pub last_check: DateTime<Utc>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ProviderError {
    AuthenticationFailed { message: String },
    RateLimited { retry_after_secs: u64 },
    QuotaExceeded { resource: String },
    NetworkError { message: String },
    NotFound { resource: String, id: String },
    PermissionDenied { action: String, resource: String },
    InvalidInput { field: String, message: String },
    InternalError { message: String },
}

// ============================================================================
// SupabaseProvider
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SupabaseConfig {
    pub url: String,
    pub anon_key: String,
    // NOTA: service_role_key NUNCA aquí. Solo anon_key.
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SupabaseSession {
    pub access_token: String,  // JWT
    pub refresh_token: String,
    pub expires_at: DateTime<Utc>,
    pub user_id: String,
    pub email: String,
    pub role: String,
    pub tenant_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SupabaseUser {
    pub id: String,
    pub email: String,
    pub role: String,
    pub tenant_id: String,
    pub created_at: DateTime<Utc>,
}

#[async_trait]
pub trait SupabaseProvider: Send + Sync {
    /// Inicializar conexión con Supabase.
    async fn initialize(&self, config: &SupabaseConfig) -> Result<(), ProviderError>;

    /// Login con email/password.
    async fn sign_in_with_password(
        &self,
        email: &str,
        password: &str,
    ) -> Result<SupabaseSession, ProviderError>;

    /// Login con magic link (envía email).
    async fn sign_in_with_magic_link(&self, email: &str) -> Result<(), ProviderError>;

    /// Refrescar sesión.
    async fn refresh_session(
        &self,
        refresh_token: &str,
    ) -> Result<SupabaseSession, ProviderError>;

    /// Cerrar sesión (invalidar token server-side).
    async fn sign_out(&self, access_token: &str) -> Result<(), ProviderError>;

    /// Obtener perfil del usuario autenticado.
    async fn get_user(&self, access_token: &str) -> Result<SupabaseUser, ProviderError>;

    /// Ejecutar query genérica (select) con RLS.
    async fn query(
        &self,
        access_token: &str,
        table: &str,
        filters: HashMap<String, String>,
        select: Option<&str>,
        limit: Option<u32>,
    ) -> Result<serde_json::Value, ProviderError>;

    /// Insertar registro.
    async fn insert(
        &self,
        access_token: &str,
        table: &str,
        data: serde_json::Value,
    ) -> Result<serde_json::Value, ProviderError>;

    /// Llamar Edge Function.
    async fn invoke_function(
        &self,
        access_token: &str,
        function_name: &str,
        body: serde_json::Value,
    ) -> Result<serde_json::Value, ProviderError>;

    /// Health check.
    async fn health_check(&self) -> ProviderHealth;
}

// ============================================================================
// GitHubProvider
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubAppConfig {
    pub app_id: u64,
    pub installation_id: u64,
    // private_key: NUNCA aquí. Se obtiene de Keychain/Supabase Edge Function.
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubRepo {
    pub owner: String,
    pub name: String,
    pub full_name: String,
    pub default_branch: String,
    pub clone_url: String,
    pub is_private: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubIssue {
    pub number: u64,
    pub title: String,
    pub body: String,
    pub state: String,
    pub labels: Vec<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubPullRequest {
    pub number: u64,
    pub title: String,
    pub body: String,
    pub head_branch: String,
    pub base_branch: String,
    pub state: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateIssueRequest {
    pub title: String,
    pub body: String,
    pub labels: Vec<String>,
    pub assignees: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreatePRRequest {
    pub title: String,
    pub body: String,
    pub head: String,
    pub base: String,
}

#[async_trait]
pub trait GitHubProvider: Send + Sync {
    /// Obtener installation token (corta vida, ~1h).
    async fn get_installation_token(&self) -> Result<String, ProviderError>;

    /// Listar repos accesibles por la instalación.
    async fn list_repos(&self) -> Result<Vec<GitHubRepo>, ProviderError>;

    /// Clonar o actualizar repo local.
    async fn clone_or_pull(
        &self,
        repo: &GitHubRepo,
        local_path: &std::path::Path,
    ) -> Result<(), ProviderError>;

    /// Crear issue.
    async fn create_issue(
        &self,
        repo: &GitHubRepo,
        request: CreateIssueRequest,
    ) -> Result<GitHubIssue, ProviderError>;

    /// Crear pull request.
    async fn create_pull_request(
        &self,
        repo: &GitHubRepo,
        request: CreatePRRequest,
    ) -> Result<GitHubPullRequest, ProviderError>;

    /// Listar issues.
    async fn list_issues(
        &self,
        repo: &GitHubRepo,
        state: Option<&str>,
        limit: Option<u32>,
    ) -> Result<Vec<GitHubIssue>, ProviderError>;

    /// Health check.
    async fn health_check(&self) -> ProviderHealth;
}

// ============================================================================
// GoogleDriveProvider
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DriveTokens {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_at: DateTime<Utc>,
    pub scopes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DriveFile {
    pub id: String,
    pub name: String,
    pub mime_type: String,
    pub size_bytes: i64,
    pub parent_id: Option<String>,
    pub created_time: DateTime<Utc>,
    pub modified_time: DateTime<Utc>,
    pub md5_checksum: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DriveQuota {
    pub total_bytes: i64,
    pub used_bytes: i64,
    pub remaining_bytes: i64,
    pub remaining_percent: f64,
}

#[async_trait]
pub trait GoogleDriveProvider: Send + Sync {
    /// Iniciar flujo OAuth (devuelve URL de autorización).
    fn get_authorization_url(&self, state: &str) -> String;

    /// Intercambiar authorization code por tokens (con PKCE).
    async fn exchange_code(
        &self,
        code: &str,
        code_verifier: &str,
    ) -> Result<DriveTokens, ProviderError>;

    /// Refrescar access token.
    async fn refresh_token(
        &self,
        refresh_token: &str,
    ) -> Result<DriveTokens, ProviderError>;

    /// Revocar tokens (al desconectar).
    async fn revoke_token(&self, token: &str) -> Result<(), ProviderError>;

    /// Verificar cuota disponible.
    async fn check_quota(&self) -> Result<DriveQuota, ProviderError>;

    /// Crear carpeta (si no existe). Devuelve folder ID.
    async fn create_folder(
        &self,
        name: &str,
        parent_id: Option<&str>,
    ) -> Result<String, ProviderError>;

    /// Subir archivo. Los bytes deben estar ya cifrados.
    async fn upload_file(
        &self,
        path: &str,           // path virtual (carpeta/nombre en Drive)
        content: &[u8],       // bytes cifrados
        mime_type: &str,
    ) -> Result<DriveFile, ProviderError>;

    /// Descargar archivo.
    async fn download_file(
        &self,
        file_id: &str,
    ) -> Result<Vec<u8>, ProviderError>;

    /// Eliminar archivo.
    async fn delete_file(&self, file_id: &str) -> Result<(), ProviderError>;

    /// Listar archivos en una carpeta.
    async fn list_files(
        &self,
        folder_id: &str,
        page_token: Option<&str>,
    ) -> Result<(Vec<DriveFile>, Option<String>), ProviderError>;

    /// Health check.
    async fn health_check(&self) -> ProviderHealth;
}

// ============================================================================
// AIProvider (Claude + OpenAI)
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIConfig {
    pub provider: AIProviderType,
    pub model: String,
    pub max_tokens: u32,
    pub temperature: f32,
    pub api_key_ref: String,  // Referencia en Keychain, NUNCA la key misma
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AIProviderType {
    Claude,
    OpenAI,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIMessage {
    pub role: AIRole,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AIRole {
    System,
    User,
    Assistant,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIRequest {
    pub messages: Vec<AIMessage>,
    pub max_tokens: Option<u32>,
    pub temperature: Option<f32>,
    pub stop_sequences: Vec<String>,
    /// Metadata para auditoría (NO se envía al modelo).
    pub audit: AIRequestAudit,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIRequestAudit {
    pub user_id: String,
    pub tenant_id: String,
    pub purpose: String,  // "file_analysis", "chat", "code_review", etc.
    pub source_file_ids: Vec<String>,  // IDs de archivos involucrados (para trazabilidad)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIResponse {
    pub content: String,
    pub model: String,
    pub input_tokens: u32,
    pub output_tokens: u32,
    pub estimated_cost_usd: f64,
    pub finish_reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AICapabilities {
    pub max_context_tokens: u32,
    pub supports_streaming: bool,
    pub supports_function_calling: bool,
    pub supports_vision: bool,
    pub models: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIUsage {
    pub total_requests_today: u32,
    pub total_tokens_today: u64,
    pub estimated_cost_today_usd: f64,
    pub estimated_cost_month_usd: f64,
    pub budget_remaining_usd: f64,
}

#[async_trait]
pub trait AIProvider: Send + Sync {
    /// Obtener capabilities del provider.
    fn capabilities(&self) -> AICapabilities;

    /// Enviar request de completado. El contenido DEBE estar pre-sanitizado.
    async fn complete(&self, request: AIRequest) -> Result<AIResponse, ProviderError>;

    /// Enviar request de completado con streaming.
    async fn complete_stream(
        &self,
        request: AIRequest,
        on_chunk: Box<dyn Fn(String) + Send>,
    ) -> Result<AIResponse, ProviderError>;

    /// Obtener uso actual (para cost control).
    async fn get_usage(&self) -> Result<AIUsage, ProviderError>;

    /// Health check.
    async fn health_check(&self) -> ProviderHealth;
}

// ============================================================================
// AIONProvider (API de negocio — interfaz genérica)
// ============================================================================

/// Supuestos sobre la API de AION:
/// - REST con autenticación Bearer token.
/// - Endpoints para acciones de negocio (definidos por el equipo de AION).
/// - Interfaz genérica para aislar cambios futuros.

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIONConfig {
    pub base_url: String,
    pub api_version: String,
    pub token_ref: String,  // Referencia en Keychain
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIONRequest {
    pub method: HttpMethod,
    pub path: String,
    pub body: Option<serde_json::Value>,
    pub query_params: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum HttpMethod {
    Get,
    Post,
    Put,
    Patch,
    Delete,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIONResponse {
    pub status: u16,
    pub body: serde_json::Value,
    pub headers: HashMap<String, String>,
}

#[async_trait]
pub trait AIONProvider: Send + Sync {
    /// Ejecutar request genérico a la API de AION.
    async fn execute(&self, request: AIONRequest) -> Result<AIONResponse, ProviderError>;

    /// Verificar autenticación con la API.
    async fn verify_auth(&self) -> Result<bool, ProviderError>;

    /// Health check.
    async fn health_check(&self) -> ProviderHealth;
}

// ============================================================================
// CryptoEngine (no es un "provider" externo, pero define contrato interno)
// ============================================================================

pub trait CryptoEngine: Send + Sync {
    /// Generar nueva Data Encryption Key (DEK).
    fn generate_dek(&self) -> Result<zeroize::Zeroizing<Vec<u8>>, ProviderError>;

    /// Generar nonce criptográficamente seguro.
    fn generate_nonce(&self) -> Result<Vec<u8>, ProviderError>;

    /// Cifrar datos con AES-256-GCM.
    fn encrypt_aes256gcm(
        &self,
        plaintext: &[u8],
        key: &[u8],
        nonce: &[u8],
    ) -> Result<Vec<u8>, ProviderError>;

    /// Descifrar datos con AES-256-GCM.
    fn decrypt_aes256gcm(
        &self,
        ciphertext: &[u8],
        key: &[u8],
        nonce: &[u8],
    ) -> Result<Vec<u8>, ProviderError>;

    /// Envelope encryption: cifrar DEK con master key.
    fn wrap_key(
        &self,
        dek: &[u8],
        master_key: &EncryptionKey,
    ) -> Result<Vec<u8>, ProviderError>;

    /// Envelope decryption: descifrar DEK con master key.
    fn unwrap_key(
        &self,
        wrapped_dek: &[u8],
        master_key: &EncryptionKey,
    ) -> Result<zeroize::Zeroizing<Vec<u8>>, ProviderError>;

    /// Obtener llave activa del tenant (de Keychain/DPAPI).
    fn get_active_key(&self, tenant_id: &str) -> Result<EncryptionKey, ProviderError>;

    /// Rotar master key: generar nueva, re-wrap todas las DEKs.
    fn rotate_master_key(&self, tenant_id: &str) -> Result<EncryptionKey, ProviderError>;

    /// Calcular SHA-256.
    fn sha256(&self, data: &[u8]) -> String;

    /// Derivar llave desde passphrase con Argon2id.
    fn derive_key_from_passphrase(
        &self,
        passphrase: &str,
        salt: &[u8],
    ) -> Result<zeroize::Zeroizing<Vec<u8>>, ProviderError>;
}

#[derive(Debug, Clone)]
pub struct EncryptionKey {
    pub id: String,
    pub raw: zeroize::Zeroizing<Vec<u8>>,
    pub algorithm: String,
    pub created_at: DateTime<Utc>,
    pub status: KeyStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum KeyStatus {
    Active,
    Rotated,
    Revoked,
}
```

---

## TypeScript Types (src/lib/types.ts)

```typescript
// ============================================================================
// Common Types (Frontend — para IPC con Tauri)
// ============================================================================

export interface ProviderHealth {
  provider: string;
  isHealthy: boolean;
  latencyMs: number | null;
  lastCheck: string; // ISO 8601
  error: string | null;
}

export type ProviderErrorType =
  | { type: 'AuthenticationFailed'; message: string }
  | { type: 'RateLimited'; retryAfterSecs: number }
  | { type: 'QuotaExceeded'; resource: string }
  | { type: 'NetworkError'; message: string }
  | { type: 'NotFound'; resource: string; id: string }
  | { type: 'PermissionDenied'; action: string; resource: string }
  | { type: 'InvalidInput'; field: string; message: string }
  | { type: 'InternalError'; message: string };

// ============================================================================
// Supabase Types
// ============================================================================

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  // NOTA: serviceRoleKey NUNCA en el frontend
}

export interface SupabaseSession {
  accessToken: string; // Nota: solo se usa para mostrar estado, el token real está en Keychain
  expiresAt: string;
  userId: string;
  email: string;
  role: string;
  tenantId: string;
}

export interface SupabaseUser {
  id: string;
  email: string;
  role: string;
  tenantId: string;
  createdAt: string;
}

// ============================================================================
// GitHub Types
// ============================================================================

export interface GitHubRepo {
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  cloneUrl: string;
  isPrivate: boolean;
}

export interface GitHubIssue {
  number: number;
  title: string;
  body: string;
  state: string;
  labels: string[];
  createdAt: string;
}

export interface GitHubPullRequest {
  number: number;
  title: string;
  body: string;
  headBranch: string;
  baseBranch: string;
  state: string;
  createdAt: string;
}

export interface CreateIssueRequest {
  title: string;
  body: string;
  labels: string[];
  assignees: string[];
}

export interface CreatePRRequest {
  title: string;
  body: string;
  head: string;
  base: string;
}

// ============================================================================
// Google Drive Types
// ============================================================================

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  parentId: string | null;
  createdTime: string;
  modifiedTime: string;
  md5Checksum: string | null;
}

export interface DriveQuota {
  totalBytes: number;
  usedBytes: number;
  remainingBytes: number;
  remainingPercent: number;
}

export type DriveConnectionStatus =
  | { status: 'disconnected' }
  | { status: 'connecting' }
  | { status: 'connected'; email: string; quota: DriveQuota }
  | { status: 'error'; message: string };

// ============================================================================
// AI Types
// ============================================================================

export type AIProviderType = 'claude' | 'openai';

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIRequest {
  messages: AIMessage[];
  maxTokens?: number;
  temperature?: number;
  stopSequences?: string[];
  purpose: string;
  sourceFileIds?: string[];
}

export interface AIResponse {
  content: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  finishReason: string;
}

export interface AICapabilities {
  maxContextTokens: number;
  supportsStreaming: boolean;
  supportsFunctionCalling: boolean;
  supportsVision: boolean;
  models: string[];
}

export interface AIUsage {
  totalRequestsToday: number;
  totalTokensToday: number;
  estimatedCostTodayUsd: number;
  estimatedCostMonthUsd: number;
  budgetRemainingUsd: number;
}

// ============================================================================
// AION API Types
// ============================================================================

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface AIONRequest {
  method: HttpMethod;
  path: string;
  body?: Record<string, unknown>;
  queryParams?: Record<string, string>;
}

export interface AIONResponse {
  status: number;
  body: unknown;
  headers: Record<string, string>;
}

// ============================================================================
// File Management Types
// ============================================================================

export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'error' | 'conflict';

export interface FileRecord {
  id: string;
  tenantId: string;
  userId: string;
  originalName: string;
  mimeType: string | null;
  sizeBytes: number;
  sha256Hash: string;
  version: number;
  tags: string[];
  syncStatus: SyncStatus;
  driveFileId: string | null;
  driveSyncAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FileUploadRequest {
  filePath: string;
  fileName: string;
  tags: string[];
}

export interface FileUploadProgress {
  fileId: string;
  phase: 'encrypting' | 'writing' | 'registering' | 'queuing_sync' | 'complete';
  progressPercent: number;
}

export interface SyncStatusSummary {
  totalFiles: number;
  synced: number;
  pending: number;
  syncing: number;
  errors: number;
  lastSyncAt: string | null;
}

// ============================================================================
// Config Types
// ============================================================================

export type Environment = 'development' | 'staging' | 'production';

export interface AppConfig {
  environment: Environment;
  supabase: SupabaseConfig;
  features: {
    aiEnabled: boolean;
    driveBackupEnabled: boolean;
    githubEnabled: boolean;
    offlineMode: boolean;
  };
  storage: {
    localPath: string;
    maxLocalStorageGb: number;
    retentionDays: number;
  };
  ai: {
    defaultProvider: AIProviderType;
    maxTokensPerRequest: number;
    monthlyBudgetUsd: number;
  };
}

export interface SetupStep {
  id: string;
  title: string;
  description: string;
  isComplete: boolean;
  isOptional: boolean;
}

// ============================================================================
// IPC Command Types (Tauri invoke wrappers)
// ============================================================================

/**
 * Typed wrappers para Tauri IPC commands.
 * Cada función corresponde a un #[tauri::command] en Rust.
 *
 * Uso:
 *   import { commands } from '@/lib/tauri-bridge';
 *   const session = await commands.signIn(email, password);
 */
export interface TauriCommands {
  // Auth
  signIn(email: string, password: string): Promise<SupabaseSession>;
  signInMagicLink(email: string): Promise<void>;
  signOut(): Promise<void>;
  getSession(): Promise<SupabaseSession | null>;
  refreshSession(): Promise<SupabaseSession>;

  // Files
  uploadFile(request: FileUploadRequest): Promise<FileRecord>;
  listFiles(page?: number, limit?: number): Promise<FileRecord[]>;
  getFile(fileId: string): Promise<FileRecord>;
  deleteFile(fileId: string): Promise<void>;
  decryptAndOpen(fileId: string): Promise<string>; // devuelve temp path
  getSyncStatus(): Promise<SyncStatusSummary>;

  // Drive
  connectDrive(): Promise<void>; // Abre browser para OAuth
  disconnectDrive(): Promise<void>;
  getDriveStatus(): Promise<DriveConnectionStatus>;
  forceSyncFile(fileId: string): Promise<void>;

  // GitHub
  listRepos(): Promise<GitHubRepo[]>;
  cloneRepo(repo: GitHubRepo, localPath: string): Promise<void>;
  createIssue(repo: GitHubRepo, request: CreateIssueRequest): Promise<GitHubIssue>;
  createPullRequest(repo: GitHubRepo, request: CreatePRRequest): Promise<GitHubPullRequest>;

  // AI
  aiComplete(request: AIRequest): Promise<AIResponse>;
  aiGetUsage(): Promise<AIUsage>;
  aiGetCapabilities(provider: AIProviderType): Promise<AICapabilities>;

  // AION
  aionExecute(request: AIONRequest): Promise<AIONResponse>;

  // Config
  getConfig(): Promise<AppConfig>;
  updateConfig(config: Partial<AppConfig>): Promise<void>;
  getSetupSteps(): Promise<SetupStep[]>;
  testSupabaseConnection(url: string, anonKey: string): Promise<boolean>;

  // Diagnostics
  getHealthStatus(): Promise<ProviderHealth[]>;
  exportDiagnosticLogs(): Promise<string>; // devuelve path al ZIP
}
```

---

## Ejemplo de Tauri Bridge (src/lib/tauri-bridge.ts)

```typescript
import { invoke } from '@tauri-apps/api/core';
import type {
  TauriCommands,
  SupabaseSession,
  FileRecord,
  FileUploadRequest,
  AIRequest,
  AIResponse,
} from './types';

/**
 * Bridge tipado entre React y Tauri.
 * Cada método llama a invoke() con el nombre del command Rust.
 *
 * SEGURIDAD: Ningún token se maneja aquí. Todos los tokens están
 * en Keychain/DPAPI y son usados directamente por Rust.
 */
export const commands: TauriCommands = {
  // Auth
  signIn: (email, password) =>
    invoke<SupabaseSession>('sign_in', { email, password }),

  signInMagicLink: (email) =>
    invoke<void>('sign_in_magic_link', { email }),

  signOut: () =>
    invoke<void>('sign_out'),

  getSession: () =>
    invoke<SupabaseSession | null>('get_session'),

  refreshSession: () =>
    invoke<SupabaseSession>('refresh_session'),

  // Files
  uploadFile: (request) =>
    invoke<FileRecord>('upload_file', { request }),

  listFiles: (page, limit) =>
    invoke<FileRecord[]>('list_files', { page: page ?? 1, limit: limit ?? 50 }),

  getFile: (fileId) =>
    invoke<FileRecord>('get_file', { fileId }),

  deleteFile: (fileId) =>
    invoke<void>('delete_file', { fileId }),

  decryptAndOpen: (fileId) =>
    invoke<string>('decrypt_and_open', { fileId }),

  getSyncStatus: () =>
    invoke('get_sync_status'),

  // Drive
  connectDrive: () =>
    invoke<void>('connect_drive'),

  disconnectDrive: () =>
    invoke<void>('disconnect_drive'),

  getDriveStatus: () =>
    invoke('get_drive_status'),

  forceSyncFile: (fileId) =>
    invoke<void>('force_sync_file', { fileId }),

  // GitHub
  listRepos: () =>
    invoke('list_repos'),

  cloneRepo: (repo, localPath) =>
    invoke<void>('clone_repo', { repo, localPath }),

  createIssue: (repo, request) =>
    invoke('create_issue', { repo, request }),

  createPullRequest: (repo, request) =>
    invoke('create_pull_request', { repo, request }),

  // AI
  aiComplete: (request) =>
    invoke<AIResponse>('ai_complete', { request }),

  aiGetUsage: () =>
    invoke('ai_get_usage'),

  aiGetCapabilities: (provider) =>
    invoke('ai_get_capabilities', { provider }),

  // AION
  aionExecute: (request) =>
    invoke('aion_execute', { request }),

  // Config
  getConfig: () =>
    invoke('get_config'),

  updateConfig: (config) =>
    invoke<void>('update_config', { config }),

  getSetupSteps: () =>
    invoke('get_setup_steps'),

  testSupabaseConnection: (url, anonKey) =>
    invoke<boolean>('test_supabase_connection', { url, anonKey }),

  // Diagnostics
  getHealthStatus: () =>
    invoke('get_health_status'),

  exportDiagnosticLogs: () =>
    invoke<string>('export_diagnostic_logs'),
};
```

---

## Rust Crates Recomendados

| Funcionalidad | Crate | Versión sugerida |
|---|---|---|
| HTTP client | `reqwest` | 0.12+ |
| Async runtime | `tokio` | 1.x |
| JSON | `serde` + `serde_json` | 1.x |
| SQLite | `rusqlite` o `sqlx` (sqlite) | latest |
| Cifrado AES-GCM | `aes-gcm` | 0.10+ |
| Hashing SHA-256 | `sha2` | 0.10+ |
| Argon2id KDF | `argon2` | 0.5+ |
| Ed25519 | `ed25519-dalek` | 2.x |
| Keychain/DPAPI | `keyring` | 3.x |
| Zeroize secrets | `zeroize` | 1.x |
| UUID v7 | `uuid` (con feature v7) | 1.x |
| Logging | `tracing` + `tracing-subscriber` | 0.1+ |
| Date/time | `chrono` | 0.4+ |
| Async traits | `async-trait` | 0.1+ |
| Rate limiting | `governor` | 0.6+ |
| Retry | `backon` o manual | - |
| CSPRNG | `rand` | 0.8+ |
| Base64 | `base64` | 0.22+ |
| MIME detection | `infer` | 0.16+ |
| Git operations | `git2` | 0.19+ |
| OAuth2 | `oauth2` | 4.x |

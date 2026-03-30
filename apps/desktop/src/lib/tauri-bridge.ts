import { invoke } from "@tauri-apps/api/core";
import type {
  SessionInfo,
  FileRecord,
  SyncStatusSummary,
  QueueStats,
  AIRequest,
  AIResponse,
  AIUsage,
  AIProviderType,
  AuditEvent,
  AuditChainResult,
  ApprovalRequest,
  AppConfig,
  ProviderHealth,
  DiagnosticExport,
} from "./types";

/**
 * Typed IPC bridge to Tauri backend.
 *
 * SECURITY: No tokens are handled here. All secrets stay in
 * Keychain/DPAPI and are used directly by the Rust backend.
 */
export const commands = {
  // ── Auth ────────────────────────────────────────────────────────────────
  signIn: (email: string, password: string) =>
    invoke<SessionInfo>("sign_in", { email, password }),

  signOut: () => invoke<void>("sign_out"),

  getSession: () => invoke<SessionInfo | null>("get_session"),

  // ── Files ───────────────────────────────────────────────────────────────
  uploadFile: (filePath: string, fileName: string, tags: string[]) =>
    invoke<FileRecord>("upload_file", { filePath, fileName, tags }),

  getSyncStatus: () => invoke<SyncStatusSummary>("get_sync_status"),

  // ── Sync Queue ──────────────────────────────────────────────────────────
  getQueueStats: () => invoke<QueueStats>("get_queue_stats"),

  retryDeadLetterJob: (jobId: string) =>
    invoke<void>("retry_dead_letter_job", { jobId }),

  // ── AI ──────────────────────────────────────────────────────────────────
  aiComplete: (request: AIRequest, providerType?: AIProviderType) =>
    invoke<AIResponse>("ai_complete", { request, providerType }),

  aiGetUsage: () => invoke<AIUsage>("ai_get_usage"),

  // ── Config ──────────────────────────────────────────────────────────────
  getConfig: () => invoke<AppConfig>("get_config"),

  updateConfig: (config: AppConfig) =>
    invoke<void>("update_config", { config }),

  testSupabaseConnection: (url: string, anonKey: string) =>
    invoke<boolean>("test_supabase_connection", { url, anonKey }),

  getHealthStatus: () => invoke<ProviderHealth[]>("get_health_status"),

  // ── Admin ───────────────────────────────────────────────────────────────
  listApprovals: () => invoke<ApprovalRequest[]>("list_approvals"),

  approveRequest: (approvalId: string, reason: string) =>
    invoke<void>("approve_request", { approvalId, reason }),

  denyRequest: (approvalId: string, reason: string) =>
    invoke<void>("deny_request", { approvalId, reason }),

  queryAuditEvents: (actionFilter?: string, limit?: number, offset?: number) =>
    invoke<AuditEvent[]>("query_audit_events", { actionFilter, limit, offset }),

  verifyAuditChain: () => invoke<AuditChainResult>("verify_audit_chain"),

  exportDiagnostics: () => invoke<DiagnosticExport>("export_diagnostics"),
};

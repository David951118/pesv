// ── Session & Auth ──────────────────────────────────────────────────────────

export interface SessionInfo {
  userId: string;
  tenantId: string;
  email: string;
  role: string;
  expiresAt: string;
}

// ── Data Classification ─────────────────────────────────────────────────────

export type DataClassification = "Public" | "Internal" | "Confidential" | "Restricted";

// ── Files ───────────────────────────────────────────────────────────────────

export type SyncStatus = "Pending" | "Syncing" | "Synced" | "Error" | "Conflict";

export interface FileRecord {
  id: string;
  tenantId: string;
  userId: string;
  originalName: string;
  mimeType: string | null;
  sizeBytes: number;
  blake3Hash: string;
  version: number;
  classification: DataClassification;
  tags: string[];
  syncStatus: SyncStatus;
  driveFileId: string | null;
  driveSyncAt: string | null;
  legalHold: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SyncStatusSummary {
  totalFiles: number;
  synced: number;
  pending: number;
  syncing: number;
  errors: number;
  deadLetter: number;
  lastSyncAt: string | null;
}

export interface QueueStats {
  queued: number;
  inProgress: number;
  completed: number;
  failed: number;
  deadLetter: number;
}

// ── AI ──────────────────────────────────────────────────────────────────────

export type AIProviderType = "OpenAI" | "Claude";

export interface AIMessage {
  role: "System" | "User" | "Assistant";
  content: string;
}

export interface AIRequest {
  messages: AIMessage[];
  maxTokens?: number;
  temperature?: number;
  purpose: string;
  sourceFileIds: string[];
}

export interface AIResponse {
  content: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  finishReason: string;
}

export interface AIUsage {
  totalRequestsToday: number;
  totalTokensToday: number;
  costTodayUsd: number;
  costMonthUsd: number;
  budgetRemainingUsd: number;
}

// ── Audit ───────────────────────────────────────────────────────────────────

export interface AuditEvent {
  id: string;
  tenantId: string;
  userId: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  outcome: "Success" | "Denied" | "Error";
  details: Record<string, unknown>;
  prevHash: string;
  eventHash: string;
  timestamp: string;
}

export interface AuditChainResult {
  verified: boolean;
  eventCount: number;
  error: string | null;
}

// ── Approvals ───────────────────────────────────────────────────────────────

export interface ApprovalRequest {
  id: string;
  tenantId: string;
  requesterId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  justification: string;
  status: "Pending" | "Approved" | "Denied" | "Expired";
  decidedBy: string | null;
  decidedAt: string | null;
  decisionReason: string | null;
  createdAt: string;
  expiresAt: string;
}

// ── Config ──────────────────────────────────────────────────────────────────

export interface AppConfig {
  environment: "Development" | "Staging" | "Production";
  supabase: { url: string; anonKey: string };
  features: {
    aiEnabled: boolean;
    driveBackupEnabled: boolean;
    githubEnabled: boolean;
    aionEnabled: boolean;
    offlineMode: boolean;
    approvalWorkflowEnabled: boolean;
  };
  storage: {
    dataDir: string;
    maxLocalStorageGb: number;
    maxFileSizeBytes: number;
  };
  sync: {
    batchIntervalSecs: number;
    maxBatchSize: number;
    maxConcurrentUploads: number;
    retryMaxAttempts: number;
  };
  ai: {
    defaultProvider: AIProviderType;
    maxTokensPerRequest: number;
    monthlyBudgetUsd: number;
    dailyBudgetUsd: number;
  };
}

// ── Provider Health ─────────────────────────────────────────────────────────

export interface ProviderHealth {
  provider: string;
  isHealthy: boolean;
  latencyMs: number | null;
  lastCheck: string;
  error: string | null;
}

// ── Diagnostics ─────────────────────────────────────────────────────────────

export interface DiagnosticExport {
  config: Record<string, unknown>;
  circuitBreakerState: string;
  driveRateLimiterTokens: number;
  aiRateLimiterTokens: number;
  killSwitchActive: boolean;
}

// ── Setup ───────────────────────────────────────────────────────────────────

export interface SetupStep {
  id: string;
  title: string;
  description: string;
  isComplete: boolean;
  isOptional: boolean;
}

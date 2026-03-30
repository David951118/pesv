import { useState } from "react";
import { commands } from "@/lib/tauri-bridge";
import type { DiagnosticExport } from "@/lib/types";

export function SecurityPanel() {
  const [diagnostics, setDiagnostics] = useState<DiagnosticExport | null>(null);
  const [exporting, setExporting] = useState(false);

  const exportDiagnostics = async () => {
    setExporting(true);
    try {
      const data = await commands.exportDiagnostics();
      setDiagnostics(data);
    } catch (e) {
      console.error("Export failed:", e);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Security</h2>

      {/* Security Status */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
          <h3 className="text-sm font-medium text-gray-300 mb-3">Encryption</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Algorithm</span>
              <span className="font-mono">AES-256-GCM</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Key storage</span>
              <span>OS Keychain</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Envelope encryption</span>
              <span className="text-green-400">Active</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Hash algorithm</span>
              <span className="font-mono">BLAKE3</span>
            </div>
          </div>
        </div>

        <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
          <h3 className="text-sm font-medium text-gray-300 mb-3">System Status</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Circuit breaker</span>
              <span className={diagnostics?.circuitBreakerState === "CLOSED" ? "text-green-400" : "text-yellow-400"}>
                {diagnostics?.circuitBreakerState ?? "Unknown"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Kill switch</span>
              <span className={diagnostics?.killSwitchActive ? "text-red-400" : "text-green-400"}>
                {diagnostics?.killSwitchActive ? "ACTIVE" : "Inactive"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Drive rate limiter</span>
              <span>{diagnostics?.driveRateLimiterTokens.toFixed(1) ?? "—"} tokens</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">AI rate limiter</span>
              <span>{diagnostics?.aiRateLimiterTokens.toFixed(1) ?? "—"} tokens</span>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
        <h3 className="text-sm font-medium text-gray-300 mb-3">Actions</h3>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={exportDiagnostics}
            disabled={exporting}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm disabled:opacity-50"
          >
            {exporting ? "Exporting..." : "Export Diagnostics"}
          </button>
          <button className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm">
            Rotate Encryption Keys
          </button>
          <button className="px-4 py-2 bg-red-900 hover:bg-red-800 rounded text-sm">
            Revoke All Tokens
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Diagnostic exports are automatically scrubbed of all secrets, tokens, and API keys.
        </p>
      </div>

      {/* Diagnostics Output */}
      {diagnostics && (
        <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
          <h3 className="text-sm font-medium text-gray-300 mb-2">Diagnostic Export (Redacted)</h3>
          <pre className="text-xs font-mono text-gray-400 bg-gray-950 rounded p-3 overflow-auto max-h-64">
            {JSON.stringify(diagnostics, null, 2)}
          </pre>
        </div>
      )}

      {/* Controls Info */}
      <div className="bg-gray-900 rounded-lg border border-gray-800 p-4 text-sm">
        <h3 className="font-medium text-gray-300 mb-2">Non-Negotiable Controls</h3>
        <ul className="space-y-1 text-gray-400">
          <li>No secrets in logs (automatic redaction)</li>
          <li>Service role key never in client</li>
          <li>Tokens only in OS keychain (Keychain / DPAPI)</li>
          <li>All files encrypted before disk write</li>
          <li>PKCE required for all OAuth flows</li>
          <li>Audit chain with BLAKE3 hash linking</li>
          <li>DLP scan before any external AI call</li>
          <li>Ed25519 signature on auto-updates</li>
        </ul>
      </div>
    </div>
  );
}

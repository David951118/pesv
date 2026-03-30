import { useState, useEffect } from "react";
import { commands } from "@/lib/tauri-bridge";
import type { AuditEvent } from "@/lib/types";

export function AuditPanel() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    loadEvents();
  }, [filter]);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const data = await commands.queryAuditEvents(
        filter || undefined,
        100,
        0
      );
      setEvents(data);
    } catch (e) {
      console.error("Failed to load audit events:", e);
    } finally {
      setLoading(false);
    }
  };

  const verifyChain = async () => {
    try {
      const result = await commands.verifyAuditChain();
      alert(
        result.verified
          ? `Chain verified: ${result.eventCount} events, no tampering detected.`
          : `Chain verification failed: ${result.error}`
      );
    } catch (e) {
      alert(`Verification error: ${e}`);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Audit Log</h2>
        <div className="flex gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm"
          >
            <option value="">All actions</option>
            <option value="sign_in">Sign in</option>
            <option value="sign_out">Sign out</option>
            <option value="upload_file">Upload file</option>
            <option value="ai_complete">AI completion</option>
            <option value="approve_request">Approval</option>
            <option value="export_diagnostics">Diagnostics export</option>
          </select>
          <button
            onClick={verifyChain}
            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm"
          >
            Verify Chain
          </button>
        </div>
      </div>

      <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-left text-gray-400">
              <th className="px-4 py-2">Timestamp</th>
              <th className="px-4 py-2">Action</th>
              <th className="px-4 py-2">Resource</th>
              <th className="px-4 py-2">Outcome</th>
              <th className="px-4 py-2">User</th>
              <th className="px-4 py-2">Hash</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  Loading events...
                </td>
              </tr>
            ) : events.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  No audit events found
                </td>
              </tr>
            ) : (
              events.map((e) => (
                <tr key={e.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="px-4 py-2 text-gray-300 font-mono text-xs">
                    {new Date(e.timestamp).toLocaleString()}
                  </td>
                  <td className="px-4 py-2 font-medium">{e.action}</td>
                  <td className="px-4 py-2 text-gray-400">
                    {e.resourceType}
                    {e.resourceId && <span className="text-gray-600">/{e.resourceId.slice(0, 8)}</span>}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`px-1.5 py-0.5 rounded text-xs ${
                        e.outcome === "Success"
                          ? "bg-green-900/50 text-green-300"
                          : e.outcome === "Denied"
                          ? "bg-red-900/50 text-red-300"
                          : "bg-yellow-900/50 text-yellow-300"
                      }`}
                    >
                      {e.outcome}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-400 text-xs">{e.userId.slice(0, 8)}...</td>
                  <td className="px-4 py-2 font-mono text-xs text-gray-600">
                    {e.eventHash.slice(0, 12)}...
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-600">
        Audit log is append-only with BLAKE3 hash chaining. Any modification to historical
        events breaks the chain and is detectable via "Verify Chain".
      </p>
    </div>
  );
}

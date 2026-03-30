import { useState, useEffect } from "react";
import { commands } from "@/lib/tauri-bridge";
import type { SessionInfo, ApprovalRequest, AIUsage } from "@/lib/types";

interface Props {
  session: SessionInfo;
}

export function CompliancePanel({ session }: Props) {
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [aiUsage, setAiUsage] = useState<AIUsage | null>(null);
  const [chainResult, setChainResult] = useState<{ verified: boolean; count: number } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [apprs, usage, chain] = await Promise.all([
        commands.listApprovals(),
        commands.aiGetUsage(),
        commands.verifyAuditChain(),
      ]);
      setApprovals(apprs);
      setAiUsage(usage);
      setChainResult({ verified: chain.verified, count: chain.eventCount });
    } catch (e) {
      console.error("Failed to load compliance data:", e);
    }
  };

  const handleApproval = async (id: string, approve: boolean) => {
    try {
      if (approve) {
        await commands.approveRequest(id, "Approved via compliance panel");
      } else {
        await commands.denyRequest(id, "Denied via compliance panel");
      }
      loadData();
    } catch (e) {
      console.error("Approval action failed:", e);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Compliance & Risk</h2>

      {/* Status Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className={`w-2 h-2 rounded-full ${chainResult?.verified ? "bg-green-400" : "bg-red-400"}`} />
            <p className="text-sm font-medium">Audit Chain</p>
          </div>
          <p className="text-2xl font-bold">{chainResult?.count ?? "—"}</p>
          <p className="text-xs text-gray-400">
            {chainResult?.verified ? "Verified — no tampering detected" : "Verification pending"}
          </p>
        </div>

        <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
          <p className="text-sm font-medium mb-1">Pending Approvals</p>
          <p className="text-2xl font-bold text-yellow-400">{approvals.length}</p>
          <p className="text-xs text-gray-400">Requires admin action</p>
        </div>

        <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
          <p className="text-sm font-medium mb-1">AI Budget (Monthly)</p>
          <p className="text-2xl font-bold">
            ${aiUsage?.costMonthUsd.toFixed(2) ?? "0.00"}
          </p>
          <p className="text-xs text-gray-400">
            ${aiUsage?.budgetRemainingUsd.toFixed(2) ?? "—"} remaining
          </p>
        </div>
      </div>

      {/* Pending Approvals */}
      {approvals.length > 0 && (
        <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
          <h3 className="text-sm font-medium text-gray-300 mb-3">Pending Approvals</h3>
          <div className="space-y-3">
            {approvals.map((a) => (
              <div key={a.id} className="flex items-center justify-between bg-gray-800 rounded p-3">
                <div>
                  <p className="font-medium text-sm">{a.action}</p>
                  <p className="text-xs text-gray-400">
                    {a.resourceType}/{a.resourceId} — by {a.requesterId}
                  </p>
                  {a.justification && (
                    <p className="text-xs text-gray-500 mt-1">"{a.justification}"</p>
                  )}
                </div>
                {session.role === "Admin" && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApproval(a.id, true)}
                      className="px-3 py-1 bg-green-700 hover:bg-green-600 rounded text-xs"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleApproval(a.id, false)}
                      className="px-3 py-1 bg-red-700 hover:bg-red-600 rounded text-xs"
                    >
                      Deny
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Policy Summary */}
      <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
        <h3 className="text-sm font-medium text-gray-300 mb-3">Active Policies</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400" />
            <span>Data classification enforcement</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400" />
            <span>DLP redaction (PII/secrets)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400" />
            <span>AI budget controls</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400" />
            <span>Audit chain integrity</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400" />
            <span>Encryption at rest (AES-256-GCM)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400" />
            <span>Approval workflow</span>
          </div>
        </div>
      </div>
    </div>
  );
}

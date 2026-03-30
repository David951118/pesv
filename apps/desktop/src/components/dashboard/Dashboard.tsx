import { useState } from "react";
import type { SessionInfo } from "@/lib/types";
import { FilesPanel } from "@/components/files/FilesPanel";
import { CompliancePanel } from "@/components/compliance/CompliancePanel";
import { AuditPanel } from "@/components/audit/AuditPanel";
import { ConnectionsPanel } from "@/components/connections/ConnectionsPanel";
import { SecurityPanel } from "@/components/security/SecurityPanel";

type Tab = "files" | "compliance" | "audit" | "connections" | "security";

interface Props {
  session: SessionInfo;
  onLogout: () => void;
}

export function Dashboard({ session, onLogout }: Props) {
  const [tab, setTab] = useState<Tab>("files");

  const tabs: { id: Tab; label: string }[] = [
    { id: "files", label: "Files" },
    { id: "compliance", label: "Compliance" },
    { id: "audit", label: "Audit Log" },
    { id: "connections", label: "Connections" },
    { id: "security", label: "Security" },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold">AION Defensa Predictiva</h1>
          <span className="text-xs bg-gray-800 px-2 py-0.5 rounded text-gray-400">
            {session.role}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">{session.email}</span>
          <button
            onClick={onLogout}
            className="text-sm text-gray-400 hover:text-white px-3 py-1 rounded border border-gray-700 hover:border-gray-500"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Nav */}
      <nav className="border-b border-gray-800 px-6">
        <div className="flex gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? "border-blue-500 text-white"
                  : "border-transparent text-gray-400 hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Content */}
      <main className="flex-1 p-6 overflow-auto">
        {tab === "files" && <FilesPanel session={session} />}
        {tab === "compliance" && <CompliancePanel session={session} />}
        {tab === "audit" && <AuditPanel />}
        {tab === "connections" && <ConnectionsPanel />}
        {tab === "security" && <SecurityPanel />}
      </main>
    </div>
  );
}

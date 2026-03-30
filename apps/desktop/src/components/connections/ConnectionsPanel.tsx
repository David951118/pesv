import { useState, useEffect } from "react";
import { commands } from "@/lib/tauri-bridge";
import type { ProviderHealth } from "@/lib/types";

export function ConnectionsPanel() {
  const [health, setHealth] = useState<ProviderHealth[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHealth();
  }, []);

  const loadHealth = async () => {
    try {
      const data = await commands.getHealthStatus();
      setHealth(data);
    } catch (e) {
      console.error("Health check failed:", e);
    } finally {
      setLoading(false);
    }
  };

  const integrations = [
    {
      id: "supabase",
      name: "Supabase",
      description: "Authentication & database (required)",
      scopes: "anon key + user JWT (RLS enforced)",
      required: true,
    },
    {
      id: "drive",
      name: "Google Drive",
      description: "Encrypted file backups",
      scopes: "drive.file only (app-created files)",
      required: false,
    },
    {
      id: "github",
      name: "GitHub",
      description: "Repository operations via GitHub App",
      scopes: "contents:read, issues:write, pull_requests:write",
      required: false,
    },
    {
      id: "openai",
      name: "OpenAI (GPT)",
      description: "AI assistance with DLP guardrails",
      scopes: "API key stored in OS keychain",
      required: false,
    },
    {
      id: "claude",
      name: "Claude (Anthropic)",
      description: "AI assistance with DLP guardrails",
      scopes: "API key stored in OS keychain",
      required: false,
    },
    {
      id: "aion",
      name: "AION API",
      description: "Business logic integration",
      scopes: "Bearer token (configurable)",
      required: false,
    },
  ];

  const getHealthForProvider = (id: string) =>
    health.find((h) => h.provider === id);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Connections</h2>

      <div className="space-y-3">
        {integrations.map((intg) => {
          const h = getHealthForProvider(intg.id);
          return (
            <div key={intg.id} className="bg-gray-900 rounded-lg border border-gray-800 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      h?.isHealthy ? "bg-green-400" : h ? "bg-red-400" : "bg-gray-600"
                    }`}
                  />
                  <div>
                    <p className="font-medium">
                      {intg.name}
                      {intg.required && (
                        <span className="ml-2 text-xs bg-blue-900/50 text-blue-300 px-1.5 py-0.5 rounded">
                          Required
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-gray-400">{intg.description}</p>
                  </div>
                </div>
                <div className="text-right">
                  {h ? (
                    <div>
                      <p className={`text-sm ${h.isHealthy ? "text-green-400" : "text-red-400"}`}>
                        {h.isHealthy ? "Connected" : "Error"}
                      </p>
                      {h.latencyMs && (
                        <p className="text-xs text-gray-500">{h.latencyMs}ms</p>
                      )}
                    </div>
                  ) : (
                    <button className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm">
                      Connect
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-gray-500">Scopes:</span>
                <span className="text-xs text-gray-400 font-mono">{intg.scopes}</span>
              </div>
              {h?.error && (
                <p className="mt-2 text-xs text-red-400 bg-red-900/20 rounded p-2">
                  {h.error}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="bg-yellow-900/20 border border-yellow-800 rounded p-3 text-sm text-yellow-200">
        All tokens are stored in your OS keychain (macOS Keychain / Windows Credential Manager).
        No credentials are ever saved to disk or included in logs.
      </div>
    </div>
  );
}

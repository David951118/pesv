import { useState } from "react";
import { commands } from "@/lib/tauri-bridge";

interface Props {
  onComplete: () => void;
}

type Step = "supabase" | "storage" | "integrations" | "review";

export function SetupWizard({ onComplete }: Props) {
  const [step, setStep] = useState<Step>("supabase");
  const [url, setUrl] = useState("");
  const [anonKey, setAnonKey] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<boolean | null>(null);
  const [error, setError] = useState("");

  const testConnection = async () => {
    setTesting(true);
    setError("");
    try {
      const ok = await commands.testSupabaseConnection(url, anonKey);
      setTestResult(ok);
      if (!ok) setError("Connection failed. Check URL and anon key.");
    } catch (e) {
      setError(String(e));
      setTestResult(false);
    } finally {
      setTesting(false);
    }
  };

  const saveConfig = async () => {
    try {
      const config = await commands.getConfig();
      config.supabase = { url, anonKey };
      await commands.updateConfig(config);
      onComplete();
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-8">
      <div className="w-full max-w-xl">
        <h1 className="text-3xl font-bold mb-2">AION Defensa Predictiva</h1>
        <p className="text-gray-400 mb-8">Setup Wizard — Configure your desktop app</p>

        {/* Progress */}
        <div className="flex gap-2 mb-8">
          {(["supabase", "storage", "integrations", "review"] as Step[]).map((s, i) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded ${
                s === step ? "bg-blue-500" : i < ["supabase", "storage", "integrations", "review"].indexOf(step) ? "bg-blue-700" : "bg-gray-700"
              }`}
            />
          ))}
        </div>

        {step === "supabase" && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Step 1: Supabase Connection</h2>
            <p className="text-gray-400 text-sm">
              Enter your Supabase project URL and anon key. These are public values
              (not secrets) found in your Supabase dashboard.
            </p>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Supabase URL</label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://xxxxx.supabase.co"
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Anon Key</label>
              <input
                type="text"
                value={anonKey}
                onChange={(e) => setAnonKey(e.target.value)}
                placeholder="eyJ..."
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white font-mono text-sm"
              />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            {testResult === true && (
              <p className="text-green-400 text-sm">Connection successful!</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={testConnection}
                disabled={!url || !anonKey || testing}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded disabled:opacity-50"
              >
                {testing ? "Testing..." : "Test Connection"}
              </button>
              <button
                onClick={() => setStep("storage")}
                disabled={testResult !== true}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded disabled:opacity-50"
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {step === "storage" && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Step 2: Local Storage</h2>
            <p className="text-gray-400 text-sm">
              All files are encrypted locally using AES-256-GCM. The encryption key
              is stored in your OS keychain (macOS Keychain / Windows Credential Manager).
            </p>
            <div className="bg-gray-800 rounded p-4 text-sm">
              <p className="text-gray-300">Encryption: AES-256-GCM (envelope encryption)</p>
              <p className="text-gray-300">Key storage: OS Keychain / DPAPI</p>
              <p className="text-gray-300">Hash algorithm: BLAKE3</p>
              <p className="text-gray-300">Default max storage: 50 GB</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep("supabase")} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded">
                ← Back
              </button>
              <button onClick={() => setStep("integrations")} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded">
                Next →
              </button>
            </div>
          </div>
        )}

        {step === "integrations" && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Step 3: Integrations (Optional)</h2>
            <p className="text-gray-400 text-sm">
              You can connect these later from Settings. All integrations use OAuth
              with minimal scopes and tokens stored in your OS keychain.
            </p>
            <div className="space-y-3">
              {[
                { name: "Google Drive", desc: "Automatic encrypted backups (scope: drive.file only)", icon: "☁️" },
                { name: "GitHub", desc: "Repository operations via GitHub App", icon: "🐙" },
                { name: "AI (GPT / Claude)", desc: "AI assistance with DLP guardrails", icon: "🤖" },
                { name: "AION API", desc: "Business logic integration", icon: "🛡️" },
              ].map((item) => (
                <div key={item.name} className="flex items-center justify-between bg-gray-800 rounded p-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{item.icon}</span>
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-gray-400 text-xs">{item.desc}</p>
                    </div>
                  </div>
                  <span className="text-gray-500 text-sm">Configure later</span>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep("storage")} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded">
                ← Back
              </button>
              <button onClick={() => setStep("review")} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded">
                Next →
              </button>
            </div>
          </div>
        )}

        {step === "review" && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Step 4: Review & Complete</h2>
            <div className="bg-gray-800 rounded p-4 space-y-2 text-sm">
              <p><span className="text-gray-400">Supabase URL:</span> {url}</p>
              <p><span className="text-gray-400">Encryption:</span> AES-256-GCM + OS Keychain</p>
              <p><span className="text-gray-400">Integrations:</span> Configure after setup</p>
            </div>
            <div className="bg-yellow-900/30 border border-yellow-700 rounded p-3 text-sm text-yellow-200">
              Your anon key is NOT a secret — it's safe to store in config.
              Service role keys are NEVER stored in this app.
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep("integrations")} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded">
                ← Back
              </button>
              <button
                onClick={saveConfig}
                className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded font-medium"
              >
                Complete Setup
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

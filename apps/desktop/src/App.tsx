import { useState, useEffect } from "react";
import { commands } from "@/lib/tauri-bridge";
import type { SessionInfo } from "@/lib/types";

import { SetupWizard } from "@/components/setup/SetupWizard";
import { LoginScreen } from "@/components/setup/LoginScreen";
import { Dashboard } from "@/components/dashboard/Dashboard";

export default function App() {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      try {
        const config = await commands.getConfig();
        if (config.supabase.url && config.supabase.anonKey) {
          setConfigured(true);
          const existing = await commands.getSession();
          if (existing) setSession(existing);
        }
      } catch (e) {
        console.error("Init failed:", e);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-950 text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto mb-4" />
          <p className="text-gray-400">Initializing AION Defensa Predictiva...</p>
        </div>
      </div>
    );
  }

  if (!configured) {
    return <SetupWizard onComplete={() => setConfigured(true)} />;
  }

  if (!session) {
    return <LoginScreen onLogin={setSession} />;
  }

  return (
    <Dashboard
      session={session}
      onLogout={() => {
        commands.signOut();
        setSession(null);
      }}
    />
  );
}

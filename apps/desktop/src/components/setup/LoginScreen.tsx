import { useState } from "react";
import { commands } from "@/lib/tauri-bridge";
import type { SessionInfo } from "@/lib/types";

interface Props {
  onLogin: (session: SessionInfo) => void;
}

export function LoginScreen({ onLogin }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const session = await commands.signIn(email, password);
      onLogin(session);
    } catch (err) {
      setError(typeof err === "object" && err !== null && "message" in err
        ? String((err as { message: string }).message)
        : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-8">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-1">AION Defensa Predictiva</h1>
        <p className="text-gray-400 mb-6">Sign in to continue</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-300 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
            />
          </div>
          {error && (
            <p className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded p-2">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full py-2 bg-blue-600 hover:bg-blue-500 rounded font-medium disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="text-gray-500 text-xs mt-6 text-center">
          Tokens are stored securely in your OS keychain.
          <br />
          No credentials are saved to disk.
        </p>
      </div>
    </div>
  );
}

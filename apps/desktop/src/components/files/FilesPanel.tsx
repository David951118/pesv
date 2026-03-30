import { useState, useEffect } from "react";
import { commands } from "@/lib/tauri-bridge";
import type { SessionInfo, SyncStatusSummary, QueueStats } from "@/lib/types";

interface Props {
  session: SessionInfo;
}

export function FilesPanel({ session }: Props) {
  const [syncStatus, setSyncStatus] = useState<SyncStatusSummary | null>(null);
  const [queueStats, setQueueStats] = useState<QueueStats | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<string>("");

  useEffect(() => {
    loadStatus();
    const interval = setInterval(loadStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadStatus = async () => {
    try {
      const [sync, queue] = await Promise.all([
        commands.getSyncStatus(),
        commands.getQueueStats(),
      ]);
      setSyncStatus(sync);
      setQueueStats(queue);
    } catch (e) {
      console.error("Failed to load status:", e);
    }
  };

  const handleUpload = async () => {
    // In production, this would use Tauri's file dialog
    // For now, show the flow
    setUploading(true);
    setUploadResult("");
    try {
      // TODO: Integrate with tauri-plugin-dialog for file picker
      setUploadResult("Use the file dialog to select a file (requires tauri-plugin-dialog)");
    } catch (e) {
      setUploadResult(`Error: ${e}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">File Manager</h2>
        <button
          onClick={handleUpload}
          disabled={uploading}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm font-medium disabled:opacity-50"
        >
          {uploading ? "Uploading..." : "Upload File"}
        </button>
      </div>

      {uploadResult && (
        <div className="bg-gray-800 rounded p-3 text-sm">{uploadResult}</div>
      )}

      {/* Sync Status Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatusCard label="Total Files" value={syncStatus?.totalFiles ?? 0} />
        <StatusCard label="Synced" value={syncStatus?.synced ?? 0} color="green" />
        <StatusCard label="Pending" value={syncStatus?.pending ?? 0} color="yellow" />
        <StatusCard label="Errors" value={syncStatus?.errors ?? 0} color="red" />
      </div>

      {/* Queue Stats */}
      {queueStats && (
        <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
          <h3 className="text-sm font-medium text-gray-300 mb-3">Sync Queue</h3>
          <div className="grid grid-cols-5 gap-4 text-center text-sm">
            <div>
              <p className="text-2xl font-bold">{queueStats.queued}</p>
              <p className="text-gray-400">Queued</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-400">{queueStats.inProgress}</p>
              <p className="text-gray-400">In Progress</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-400">{queueStats.completed}</p>
              <p className="text-gray-400">Completed</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-yellow-400">{queueStats.failed}</p>
              <p className="text-gray-400">Failed</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-400">{queueStats.deadLetter}</p>
              <p className="text-gray-400">Dead Letter</p>
            </div>
          </div>
        </div>
      )}

      {/* Security Info */}
      <div className="bg-gray-900 rounded-lg border border-gray-800 p-4 text-sm text-gray-400">
        <p>All files are encrypted with AES-256-GCM before being stored locally.</p>
        <p>Encryption keys are managed by your OS keychain — never stored on disk.</p>
        <p>Drive backups contain encrypted blobs only — Google cannot read your files.</p>
      </div>
    </div>
  );
}

function StatusCard({ label, value, color }: { label: string; value: number; color?: string }) {
  const colorClass = {
    green: "text-green-400",
    yellow: "text-yellow-400",
    red: "text-red-400",
  }[color ?? ""] ?? "text-white";

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
      <p className={`text-2xl font-bold ${colorClass}`}>{value}</p>
      <p className="text-sm text-gray-400">{label}</p>
    </div>
  );
}

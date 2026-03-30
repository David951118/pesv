use std::path::Path;

use lah_core::error::{AppError, AppResult};

use crate::AuditLog;

/// Export an evidence pack: a JSON file containing all audit events
/// for a tenant, with chain verification proof.
///
/// The export is signed with a local BLAKE3 hash so its integrity
/// can be verified later. NO secrets are included.
pub struct EvidenceExporter;

impl EvidenceExporter {
    /// Export audit events for a tenant as a signed evidence pack.
    pub fn export(
        audit_log: &AuditLog,
        tenant_id: &str,
        output_path: &Path,
    ) -> AppResult<ExportResult> {
        // 1. Verify chain integrity first
        let chain_count = audit_log.verify_chain()?;

        // 2. Query all events for this tenant
        let events = audit_log.query_events(tenant_id, None, u32::MAX, 0)?;

        // 3. Build the evidence pack
        let pack = serde_json::json!({
            "evidence_pack": {
                "version": "1.0",
                "exported_at": chrono::Utc::now().to_rfc3339(),
                "tenant_id": tenant_id,
                "chain_verified": true,
                "total_chain_events": chain_count,
                "exported_events": events.len(),
                "events": events,
            }
        });

        let pack_json = serde_json::to_string_pretty(&pack)
            .map_err(|e| AppError::StorageError(format!("JSON serialize failed: {e}")))?;

        // 4. Compute integrity hash of the export
        let export_hash = blake3::hash(pack_json.as_bytes()).to_hex().to_string();

        // 5. Write the pack with its hash
        let final_output = serde_json::json!({
            "integrity_hash": export_hash,
            "hash_algorithm": "BLAKE3",
            "data": pack,
        });

        let final_json = serde_json::to_string_pretty(&final_output)
            .map_err(|e| AppError::StorageError(format!("JSON serialize failed: {e}")))?;

        std::fs::write(output_path, &final_json)?;

        tracing::info!(
            tenant_id = tenant_id,
            events = events.len(),
            path = %output_path.display(),
            "Evidence pack exported"
        );

        Ok(ExportResult {
            path: output_path.to_path_buf(),
            event_count: events.len() as u64,
            integrity_hash: export_hash,
        })
    }
}

#[derive(Debug)]
pub struct ExportResult {
    pub path: std::path::PathBuf,
    pub event_count: u64,
    pub integrity_hash: String,
}

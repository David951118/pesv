use std::path::PathBuf;
use tauri::State;

use lah_core::error::AppError;
use lah_core::types::{AuditOutcome, DataClassification, FileRecord, JobType, SyncStatus};
use lah_crypto::{CryptoEngine, KeyringStore, SecureFs};
use lah_policy::{DataClassifier, PolicyEngine};
use lah_policy::enforcement::PolicyAction;

use crate::state::AppState;

/// Upload a file: encrypt locally + register metadata + enqueue Drive sync.
#[tauri::command]
pub async fn upload_file(
    state: State<'_, AppState>,
    file_path: String,
    file_name: String,
    tags: Vec<String>,
) -> Result<FileRecord, AppError> {
    state.check_kill_switch()?;
    let session = state.require_session()?;
    let config = state.config.lock().unwrap().clone();

    // 1. Validate filename
    SecureFs::validate_filename(&file_name)?;

    // 2. Read source file
    let source = PathBuf::from(&file_path);
    if !source.exists() {
        return Err(AppError::NotFound {
            resource: "file".into(),
            id: file_path,
        });
    }
    let plaintext = std::fs::read(&source)?;

    if plaintext.is_empty() {
        return Err(AppError::StorageError("Empty file".into()));
    }
    if plaintext.len() as u64 > config.storage.max_file_size_bytes {
        return Err(AppError::QuotaExceeded {
            resource: format!("File size exceeds {} MB limit",
                config.storage.max_file_size_bytes / (1024 * 1024)),
        });
    }

    // 3. Classify data
    let classification = DataClassifier::classify(&file_name, &tags, None);

    // 4. Policy check
    PolicyEngine::enforce(&PolicyAction {
        action: "upload".into(),
        resource_type: "file".into(),
        classification,
        user_role: session.role.clone(),
        tenant_id: session.tenant_id.0.clone(),
    })?;

    // 5. Get master key from keychain
    let master_key = KeyringStore::get_or_create_master_key(&session.tenant_id.0)?;

    // 6. Encrypt file
    let file_id = lah_core::new_id();
    let enc_result = CryptoEngine::encrypt_file(&plaintext, &master_key, &file_id)?;

    // 7. Failsafe: verify ciphertext doesn't look like plaintext
    SecureFs::verify_not_plaintext(&enc_result.ciphertext)?;

    // 8. Write encrypted file atomically
    let dest_dir = config.user_files_dir(&session.tenant_id.0, &session.user_id.0);
    std::fs::create_dir_all(&dest_dir)?;
    let dest_path = dest_dir.join(format!("{file_id}.enc"));

    SecureFs::validate_path(&dest_path, &config.storage.data_dir)?;
    SecureFs::atomic_write(&dest_path, &enc_result.ciphertext)?;

    // 9. Verify post-write integrity
    let written = std::fs::read(&dest_path)?;
    let written_hash = CryptoEngine::hash(&written);
    if written_hash != enc_result.ciphertext_hash {
        std::fs::remove_file(&dest_path).ok();
        return Err(AppError::IntegrityError(
            "Post-write integrity check failed".into(),
        ));
    }

    // 10. Build record
    let record = FileRecord {
        id: file_id.clone(),
        tenant_id: session.tenant_id.0.clone(),
        user_id: session.user_id.0.clone(),
        original_name: file_name.clone(),
        mime_type: None,
        size_bytes: plaintext.len() as i64,
        blake3_hash: enc_result.plaintext_hash,
        enc_blake3_hash: enc_result.ciphertext_hash,
        encryption_key_id: "active".into(),
        wrapped_dek: base64::Engine::encode(
            &base64::engine::general_purpose::STANDARD,
            &enc_result.wrapped_dek,
        ),
        nonce: base64::Engine::encode(
            &base64::engine::general_purpose::STANDARD,
            &enc_result.nonce,
        ),
        version: 1,
        classification,
        tags: tags.clone(),
        sync_status: SyncStatus::Pending,
        drive_file_id: None,
        drive_sync_at: None,
        legal_hold: false,
        retention_until: None,
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
        deleted_at: None,
    };

    // 11. Enqueue Drive backup if enabled
    if config.features.drive_backup_enabled {
        if let Some(queue) = state.job_queue.lock().unwrap().as_ref() {
            queue.enqueue(
                &file_id,
                &session.tenant_id.0,
                JobType::UploadDrive,
                config.sync.retry_max_attempts,
            )?;
        }
    }

    // 12. Audit
    if let Some(audit) = state.audit_log.lock().unwrap().as_ref() {
        audit.record(
            &session.tenant_id.0,
            &session.user_id.0,
            "upload_file",
            "file",
            Some(&file_id),
            AuditOutcome::Success,
            serde_json::json!({
                "name": file_name,
                "size": plaintext.len(),
                "classification": format!("{}", classification),
                "hash_prefix": &record.blake3_hash[..16],
            }),
        ).ok();
    }

    tracing::info!(
        file_id = file_id.as_str(),
        size = plaintext.len(),
        classification = %classification,
        "File uploaded and encrypted"
    );

    Ok(record)
}

/// Get sync status summary.
#[tauri::command]
pub fn get_sync_status(
    state: State<'_, AppState>,
) -> Result<lah_core::types::SyncStatusSummary, AppError> {
    let session = state.require_session()?;

    let stats = state
        .job_queue
        .lock()
        .unwrap()
        .as_ref()
        .map(|q| q.stats(&session.tenant_id.0))
        .transpose()?;

    Ok(lah_core::types::SyncStatusSummary {
        total_files: 0, // TODO: query from files table
        synced: stats.as_ref().map(|s| s.completed as u64).unwrap_or(0),
        pending: stats.as_ref().map(|s| s.queued as u64).unwrap_or(0),
        syncing: stats.as_ref().map(|s| s.in_progress as u64).unwrap_or(0),
        errors: stats.as_ref().map(|s| s.failed as u64).unwrap_or(0),
        dead_letter: stats.as_ref().map(|s| s.dead_letter as u64).unwrap_or(0),
        last_sync_at: None,
    })
}

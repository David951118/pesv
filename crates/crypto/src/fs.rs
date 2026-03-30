use std::fs;
use std::path::{Path, PathBuf};

use lah_core::error::{AppError, AppResult};

/// Secure filesystem operations with anti-traversal, anti-symlink,
/// and atomic-write protections.
pub struct SecureFs;

/// Known plaintext file magic bytes to detect encryption failures.
const KNOWN_MAGIC: &[&[u8]] = &[
    b"%PDF",                       // PDF
    &[0xFF, 0xD8, 0xFF],          // JPEG
    &[0x89, 0x50, 0x4E, 0x47],   // PNG
    &[0x50, 0x4B, 0x03, 0x04],   // ZIP / DOCX / XLSX
    &[0xD0, 0xCF, 0x11, 0xE0],   // OLE (DOC / XLS)
    b"<!DOCTYPE",                  // HTML
    b"<html",                      // HTML
    b"PK",                         // ZIP
];

impl SecureFs {
    /// Validate that `target` resolves to a path inside `base_dir`.
    /// Rejects symlinks and path traversal attempts.
    pub fn validate_path(target: &Path, base_dir: &Path) -> AppResult<PathBuf> {
        // Reject explicit traversal components
        for component in target.components() {
            if let std::path::Component::ParentDir = component {
                return Err(AppError::PathTraversal(format!(
                    "Path contains '..': {}",
                    target.display()
                )));
            }
        }

        // Check for symlinks in the path
        if target.exists() {
            let metadata = fs::symlink_metadata(target)
                .map_err(|e| AppError::PathTraversal(format!("Cannot read metadata: {e}")))?;
            if metadata.file_type().is_symlink() {
                return Err(AppError::PathTraversal(format!(
                    "Path is a symlink: {}",
                    target.display()
                )));
            }
        }

        // Canonicalize base (must exist)
        let canonical_base = base_dir.canonicalize().map_err(|e| {
            AppError::PathTraversal(format!("Cannot canonicalize base: {e}"))
        })?;

        // For existing files, canonicalize and compare
        if target.exists() {
            let canonical_target = target.canonicalize().map_err(|e| {
                AppError::PathTraversal(format!("Cannot canonicalize target: {e}"))
            })?;
            if !canonical_target.starts_with(&canonical_base) {
                return Err(AppError::PathTraversal(format!(
                    "Path escapes base directory: {} is not under {}",
                    canonical_target.display(),
                    canonical_base.display()
                )));
            }
            Ok(canonical_target)
        } else {
            // For new files, verify the parent exists and is inside base
            if let Some(parent) = target.parent() {
                if parent.exists() {
                    let canonical_parent = parent.canonicalize().map_err(|e| {
                        AppError::PathTraversal(format!("Cannot canonicalize parent: {e}"))
                    })?;
                    if !canonical_parent.starts_with(&canonical_base) {
                        return Err(AppError::PathTraversal(format!(
                            "Parent escapes base: {} not under {}",
                            canonical_parent.display(),
                            canonical_base.display()
                        )));
                    }
                }
            }
            Ok(target.to_path_buf())
        }
    }

    /// Atomic write: write to temp file, fsync, then rename.
    /// Ensures no partial writes survive crashes.
    pub fn atomic_write(target: &Path, data: &[u8]) -> AppResult<()> {
        let parent = target.parent().ok_or_else(|| {
            AppError::StorageError("Target has no parent directory".into())
        })?;
        fs::create_dir_all(parent)?;

        let temp_name = format!(
            ".tmp_{}_{}",
            target
                .file_name()
                .unwrap_or_default()
                .to_string_lossy(),
            uuid::Uuid::now_v7()
        );
        let temp_path = parent.join(temp_name);

        // Write to temp file
        fs::write(&temp_path, data).map_err(|e| {
            AppError::StorageError(format!("Failed to write temp file: {e}"))
        })?;

        // fsync the temp file
        let file = fs::File::open(&temp_path)?;
        file.sync_all().map_err(|e| {
            let _ = fs::remove_file(&temp_path);
            AppError::StorageError(format!("fsync failed: {e}"))
        })?;
        drop(file);

        // Rename (atomic on most filesystems)
        fs::rename(&temp_path, target).map_err(|e| {
            let _ = fs::remove_file(&temp_path);
            AppError::StorageError(format!("Rename failed: {e}"))
        })?;

        // fsync the directory to persist the rename
        if let Ok(dir) = fs::File::open(parent) {
            let _ = dir.sync_all();
        }

        Ok(())
    }

    /// Failsafe: verify that ciphertext does NOT look like a known plaintext format.
    /// Catches encryption bugs before they reach disk.
    pub fn verify_not_plaintext(data: &[u8]) -> AppResult<()> {
        if data.len() < 4 {
            return Ok(());
        }
        for magic in KNOWN_MAGIC {
            if data.starts_with(magic) {
                return Err(AppError::EncryptionFailsafe(
                    "Ciphertext matches known plaintext magic bytes — encryption may have failed"
                        .into(),
                ));
            }
        }
        Ok(())
    }

    /// Secure delete: overwrite with zeros then delete.
    /// Best-effort on modern SSDs with wear leveling.
    pub fn secure_delete(path: &Path) -> AppResult<()> {
        if !path.exists() {
            return Ok(());
        }

        let metadata = fs::metadata(path)?;
        let size = metadata.len() as usize;

        // Overwrite with zeros
        if size > 0 {
            let zeros = vec![0u8; size.min(1024 * 1024)]; // 1 MB chunks
            let file = fs::OpenOptions::new().write(true).open(path)?;
            use std::io::Write;
            let mut writer = std::io::BufWriter::new(file);
            let mut remaining = size;
            while remaining > 0 {
                let chunk = remaining.min(zeros.len());
                writer.write_all(&zeros[..chunk])?;
                remaining -= chunk;
            }
            writer.flush()?;
            writer.get_ref().sync_all()?;
        }

        fs::remove_file(path)?;
        Ok(())
    }

    /// Validate a filename: no path separators, no special components.
    pub fn validate_filename(name: &str) -> AppResult<()> {
        if name.is_empty() {
            return Err(AppError::PathTraversal("Empty filename".into()));
        }
        if name.contains('/') || name.contains('\\') || name.contains('\0') {
            return Err(AppError::PathTraversal(format!(
                "Invalid characters in filename: {name}"
            )));
        }
        if name == "." || name == ".." {
            return Err(AppError::PathTraversal(format!(
                "Reserved filename: {name}"
            )));
        }
        if name.len() > 255 {
            return Err(AppError::PathTraversal("Filename too long".into()));
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_atomic_write_creates_file() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("test.enc");
        SecureFs::atomic_write(&path, b"encrypted data").unwrap();
        assert!(path.exists());
        assert_eq!(fs::read(&path).unwrap(), b"encrypted data");
    }

    #[test]
    fn test_validate_path_rejects_traversal() {
        let dir = TempDir::new().unwrap();
        let evil = dir.path().join("../../../etc/passwd");
        let result = SecureFs::validate_path(&evil, dir.path());
        assert!(result.is_err());
    }

    #[test]
    fn test_validate_filename_rejects_slashes() {
        assert!(SecureFs::validate_filename("../evil").is_err());
        assert!(SecureFs::validate_filename("foo/bar").is_err());
        assert!(SecureFs::validate_filename("..").is_err());
        assert!(SecureFs::validate_filename("").is_err());
        assert!(SecureFs::validate_filename("normal.pdf").is_ok());
    }

    #[test]
    fn test_verify_not_plaintext_rejects_pdf() {
        let pdf_header = b"%PDF-1.5 some content here";
        assert!(SecureFs::verify_not_plaintext(pdf_header).is_err());
    }

    #[test]
    fn test_verify_not_plaintext_accepts_random() {
        let random = [0xAB, 0xCD, 0xEF, 0x12, 0x34];
        assert!(SecureFs::verify_not_plaintext(&random).is_ok());
    }

    #[test]
    fn test_secure_delete() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("secret.txt");
        fs::write(&path, b"secret data").unwrap();
        SecureFs::secure_delete(&path).unwrap();
        assert!(!path.exists());
    }
}

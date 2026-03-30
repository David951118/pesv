use keyring::Entry;
use zeroize::Zeroizing;

use lah_core::error::{AppError, AppResult};

const SERVICE: &str = "com.aiondefensa.admin-hub";

/// Secure token and key storage using OS keychain.
///
/// - macOS: Keychain Services (access group limited to this app)
/// - Windows: Credential Manager (DPAPI-backed)
///
/// Tokens are stored as individual entries identified by a composite key
/// of `{tenant_id}:{purpose}` to ensure tenant isolation.
pub struct KeyringStore;

impl KeyringStore {
    /// Store a secret in the OS keychain.
    pub fn store(tenant_id: &str, purpose: &str, secret: &[u8]) -> AppResult<()> {
        let account = format!("{tenant_id}:{purpose}");
        let encoded = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, secret);

        let entry = Entry::new(SERVICE, &account)
            .map_err(|e| AppError::CryptoError(format!("Keyring entry creation failed: {e}")))?;
        entry
            .set_password(&encoded)
            .map_err(|e| AppError::CryptoError(format!("Keyring store failed: {e}")))?;

        tracing::info!(
            tenant_id = tenant_id,
            purpose = purpose,
            "Secret stored in keyring"
        );
        Ok(())
    }

    /// Retrieve a secret from the OS keychain.
    pub fn retrieve(tenant_id: &str, purpose: &str) -> AppResult<Zeroizing<Vec<u8>>> {
        let account = format!("{tenant_id}:{purpose}");

        let entry = Entry::new(SERVICE, &account)
            .map_err(|e| AppError::CryptoError(format!("Keyring entry access failed: {e}")))?;
        let encoded = entry
            .get_password()
            .map_err(|e| AppError::CryptoError(format!("Keyring retrieve failed: {e}")))?;

        let decoded = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, &encoded)
            .map_err(|e| AppError::CryptoError(format!("Base64 decode failed: {e}")))?;

        Ok(Zeroizing::new(decoded))
    }

    /// Delete a secret from the OS keychain.
    pub fn delete(tenant_id: &str, purpose: &str) -> AppResult<()> {
        let account = format!("{tenant_id}:{purpose}");

        let entry = Entry::new(SERVICE, &account)
            .map_err(|e| AppError::CryptoError(format!("Keyring entry access failed: {e}")))?;
        entry
            .delete_credential()
            .map_err(|e| AppError::CryptoError(format!("Keyring delete failed: {e}")))?;

        tracing::info!(
            tenant_id = tenant_id,
            purpose = purpose,
            "Secret deleted from keyring"
        );
        Ok(())
    }

    /// Check if a secret exists in the keychain.
    pub fn exists(tenant_id: &str, purpose: &str) -> bool {
        let account = format!("{tenant_id}:{purpose}");
        Entry::new(SERVICE, &account)
            .and_then(|e| e.get_password())
            .is_ok()
    }

    // ── Convenience methods for specific secret types ───────────────────

    /// Store or retrieve the master encryption key for a tenant.
    pub fn get_or_create_master_key(tenant_id: &str) -> AppResult<Zeroizing<Vec<u8>>> {
        let purpose = "master_key";
        if Self::exists(tenant_id, purpose) {
            Self::retrieve(tenant_id, purpose)
        } else {
            let key = super::CryptoEngine::generate_dek()?;
            Self::store(tenant_id, purpose, &key)?;
            Ok(key)
        }
    }

    /// Store an OAuth token.
    pub fn store_token(tenant_id: &str, provider: &str, token: &str) -> AppResult<()> {
        let purpose = format!("token:{provider}");
        Self::store(tenant_id, &purpose, token.as_bytes())
    }

    /// Retrieve an OAuth token.
    pub fn get_token(tenant_id: &str, provider: &str) -> AppResult<String> {
        let purpose = format!("token:{provider}");
        let bytes = Self::retrieve(tenant_id, &purpose)?;
        String::from_utf8(bytes.to_vec())
            .map_err(|e| AppError::CryptoError(format!("Token decode failed: {e}")))
    }

    /// Delete an OAuth token (on disconnect/revoke).
    pub fn delete_token(tenant_id: &str, provider: &str) -> AppResult<()> {
        let purpose = format!("token:{provider}");
        Self::delete(tenant_id, &purpose)
    }

    /// Rotate master key: generate new, return old for re-wrapping DEKs.
    pub fn rotate_master_key(tenant_id: &str) -> AppResult<(Zeroizing<Vec<u8>>, Zeroizing<Vec<u8>>)>
    {
        let old_key = Self::retrieve(tenant_id, "master_key")?;
        let new_key = super::CryptoEngine::generate_dek()?;

        // Store the new key
        Self::store(tenant_id, "master_key", &new_key)?;

        // Also keep old key temporarily for re-wrapping
        Self::store(tenant_id, "master_key_prev", &old_key)?;

        tracing::warn!(
            tenant_id = tenant_id,
            "Master key rotated — DEK re-wrapping required"
        );

        Ok((old_key, new_key))
    }
}

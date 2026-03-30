use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, Nonce,
};
use rand::RngCore;
use zeroize::Zeroizing;

use lah_core::error::{AppError, AppResult};

/// DEK size in bytes (256-bit for AES-256-GCM).
const DEK_SIZE: usize = 32;
/// Nonce size for AES-256-GCM (96-bit / 12 bytes).
const NONCE_SIZE: usize = 12;

/// Envelope encryption engine.
///
/// Uses per-file Data Encryption Keys (DEKs) wrapped by a master key
/// stored in the OS keychain (macOS Keychain / Windows DPAPI).
///
/// Security properties:
/// - Each file gets a unique DEK + nonce pair (never reused)
/// - DEKs are wrapped (encrypted) by the master key for storage
/// - Master key never leaves the keychain in plaintext longer than needed
/// - All sensitive material is zeroized on drop
pub struct CryptoEngine;

/// Result of encrypting a file.
#[derive(Debug)]
pub struct EncryptResult {
    /// The encrypted bytes (ciphertext + auth tag).
    pub ciphertext: Vec<u8>,
    /// The DEK used, wrapped (encrypted) with the master key.
    pub wrapped_dek: Vec<u8>,
    /// The nonce used for this encryption.
    pub nonce: Vec<u8>,
    /// BLAKE3 hash of the original plaintext.
    pub plaintext_hash: String,
    /// BLAKE3 hash of the ciphertext.
    pub ciphertext_hash: String,
}

impl CryptoEngine {
    /// Generate a cryptographically secure random DEK.
    pub fn generate_dek() -> AppResult<Zeroizing<Vec<u8>>> {
        let mut dek = Zeroizing::new(vec![0u8; DEK_SIZE]);
        OsRng.fill_bytes(&mut dek);
        Ok(dek)
    }

    /// Generate a cryptographically secure random nonce.
    pub fn generate_nonce() -> AppResult<Vec<u8>> {
        let mut nonce = vec![0u8; NONCE_SIZE];
        OsRng.fill_bytes(&mut nonce);
        Ok(nonce)
    }

    /// Encrypt plaintext using AES-256-GCM.
    ///
    /// `aad` (Additional Authenticated Data) binds metadata to the ciphertext
    /// so tampering with metadata is detected during decryption.
    pub fn encrypt(
        plaintext: &[u8],
        key: &[u8],
        nonce_bytes: &[u8],
        aad: &[u8],
    ) -> AppResult<Vec<u8>> {
        if key.len() != DEK_SIZE {
            return Err(AppError::CryptoError(format!(
                "Invalid key size: expected {DEK_SIZE}, got {}",
                key.len()
            )));
        }
        if nonce_bytes.len() != NONCE_SIZE {
            return Err(AppError::CryptoError(format!(
                "Invalid nonce size: expected {NONCE_SIZE}, got {}",
                nonce_bytes.len()
            )));
        }

        let cipher = Aes256Gcm::new_from_slice(key)
            .map_err(|e| AppError::CryptoError(format!("Cipher init failed: {e}")))?;
        let nonce = Nonce::from_slice(nonce_bytes);

        // Construct payload with AAD for authenticated encryption
        let payload = aes_gcm::aead::Payload {
            msg: plaintext,
            aad,
        };

        cipher
            .encrypt(nonce, payload)
            .map_err(|e| AppError::CryptoError(format!("Encryption failed: {e}")))
    }

    /// Decrypt ciphertext using AES-256-GCM.
    pub fn decrypt(
        ciphertext: &[u8],
        key: &[u8],
        nonce_bytes: &[u8],
        aad: &[u8],
    ) -> AppResult<Vec<u8>> {
        if key.len() != DEK_SIZE {
            return Err(AppError::CryptoError("Invalid key size".into()));
        }

        let cipher = Aes256Gcm::new_from_slice(key)
            .map_err(|e| AppError::CryptoError(format!("Cipher init failed: {e}")))?;
        let nonce = Nonce::from_slice(nonce_bytes);

        let payload = aes_gcm::aead::Payload {
            msg: ciphertext,
            aad,
        };

        cipher
            .decrypt(nonce, payload)
            .map_err(|e| AppError::CryptoError(format!("Decryption failed: {e}")))
    }

    /// Wrap (encrypt) a DEK using the master key.
    ///
    /// The wrapped DEK is safe to store on disk because it can only be
    /// unwrapped with the master key from the OS keychain.
    pub fn wrap_dek(dek: &[u8], master_key: &[u8]) -> AppResult<Vec<u8>> {
        let nonce_bytes = Self::generate_nonce()?;
        let mut wrapped = nonce_bytes.clone();
        let ciphertext = Self::encrypt(dek, master_key, &nonce_bytes, b"dek-wrap")?;
        wrapped.extend(ciphertext);
        Ok(wrapped)
    }

    /// Unwrap (decrypt) a DEK using the master key.
    pub fn unwrap_dek(wrapped: &[u8], master_key: &[u8]) -> AppResult<Zeroizing<Vec<u8>>> {
        if wrapped.len() < NONCE_SIZE + 16 {
            // minimum: nonce + AES-GCM tag
            return Err(AppError::CryptoError("Wrapped DEK too short".into()));
        }
        let nonce_bytes = &wrapped[..NONCE_SIZE];
        let ciphertext = &wrapped[NONCE_SIZE..];
        let plaintext = Self::decrypt(ciphertext, master_key, nonce_bytes, b"dek-wrap")?;
        Ok(Zeroizing::new(plaintext))
    }

    /// Encrypt a file's contents with envelope encryption.
    ///
    /// 1. Generates a unique DEK for this file
    /// 2. Encrypts the file with the DEK (AES-256-GCM)
    /// 3. Wraps the DEK with the master key
    /// 4. Returns everything needed to store and later decrypt
    pub fn encrypt_file(
        plaintext: &[u8],
        master_key: &[u8],
        file_id: &str,
    ) -> AppResult<EncryptResult> {
        let dek = Self::generate_dek()?;
        let nonce = Self::generate_nonce()?;

        // AAD binds the file_id to the ciphertext
        let aad = file_id.as_bytes();

        let plaintext_hash = blake3::hash(plaintext).to_hex().to_string();
        let ciphertext = Self::encrypt(plaintext, &dek, &nonce, aad)?;
        let ciphertext_hash = blake3::hash(&ciphertext).to_hex().to_string();
        let wrapped_dek = Self::wrap_dek(&dek, master_key)?;

        Ok(EncryptResult {
            ciphertext,
            wrapped_dek,
            nonce,
            plaintext_hash,
            ciphertext_hash,
        })
    }

    /// Decrypt a file using its wrapped DEK and nonce.
    pub fn decrypt_file(
        ciphertext: &[u8],
        wrapped_dek: &[u8],
        nonce: &[u8],
        master_key: &[u8],
        file_id: &str,
    ) -> AppResult<Vec<u8>> {
        let dek = Self::unwrap_dek(wrapped_dek, master_key)?;
        Self::decrypt(ciphertext, &dek, nonce, file_id.as_bytes())
    }

    /// Compute BLAKE3 hash.
    pub fn hash(data: &[u8]) -> String {
        blake3::hash(data).to_hex().to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encrypt_decrypt_roundtrip() {
        let master_key = CryptoEngine::generate_dek().unwrap();
        let plaintext = b"Hello, this is a test file for AION Defensa Predictiva.";
        let file_id = "test-file-001";

        let result = CryptoEngine::encrypt_file(plaintext, &master_key, file_id).unwrap();

        // Ciphertext must differ from plaintext
        assert_ne!(result.ciphertext, plaintext.as_slice());

        // Ciphertext must not start with plaintext bytes (failsafe)
        assert_ne!(&result.ciphertext[..5], &plaintext[..5]);

        // Decrypt must recover original plaintext
        let decrypted = CryptoEngine::decrypt_file(
            &result.ciphertext,
            &result.wrapped_dek,
            &result.nonce,
            &master_key,
            file_id,
        )
        .unwrap();
        assert_eq!(decrypted, plaintext.as_slice());
    }

    #[test]
    fn test_wrong_master_key_fails() {
        let master_key = CryptoEngine::generate_dek().unwrap();
        let wrong_key = CryptoEngine::generate_dek().unwrap();
        let plaintext = b"Secret data";
        let file_id = "file-002";

        let result = CryptoEngine::encrypt_file(plaintext, &master_key, file_id).unwrap();

        let decrypt_result = CryptoEngine::decrypt_file(
            &result.ciphertext,
            &result.wrapped_dek,
            &result.nonce,
            &wrong_key,
            file_id,
        );
        assert!(decrypt_result.is_err());
    }

    #[test]
    fn test_wrong_file_id_aad_fails() {
        let master_key = CryptoEngine::generate_dek().unwrap();
        let plaintext = b"AAD-bound data";
        let file_id = "file-003";

        let result = CryptoEngine::encrypt_file(plaintext, &master_key, file_id).unwrap();

        let decrypt_result = CryptoEngine::decrypt_file(
            &result.ciphertext,
            &result.wrapped_dek,
            &result.nonce,
            &master_key,
            "wrong-file-id",
        );
        assert!(decrypt_result.is_err());
    }

    #[test]
    fn test_tampered_ciphertext_fails() {
        let master_key = CryptoEngine::generate_dek().unwrap();
        let plaintext = b"Integrity check";
        let file_id = "file-004";

        let mut result = CryptoEngine::encrypt_file(plaintext, &master_key, file_id).unwrap();

        // Tamper with ciphertext
        if let Some(byte) = result.ciphertext.get_mut(5) {
            *byte ^= 0xFF;
        }

        let decrypt_result = CryptoEngine::decrypt_file(
            &result.ciphertext,
            &result.wrapped_dek,
            &result.nonce,
            &master_key,
            file_id,
        );
        assert!(decrypt_result.is_err());
    }

    #[test]
    fn test_blake3_hash_deterministic() {
        let data = b"test data";
        let h1 = CryptoEngine::hash(data);
        let h2 = CryptoEngine::hash(data);
        assert_eq!(h1, h2);
        assert_eq!(h1.len(), 64); // BLAKE3 hex output is 64 chars
    }
}

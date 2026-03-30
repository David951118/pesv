# Pseudocódigo — Operaciones Core

## a) Upload Local + Cifrado + Registro en Metadata DB

```rust
/// Upload de archivo con cifrado y registro en metadata.
/// Flujo: validar → generar DEK → cifrar → escribir disco → registrar metadata → encolar sync.
async fn upload_file(
    tenant_id: &str,
    user_id: &str,
    source_path: &Path,        // Ruta temporal del archivo subido por el usuario
    original_name: &str,
    tags: Vec<String>,
    config: &AppConfig,
    crypto: &CryptoEngine,
    db: &MetadataDb,
    queue: &TaskQueue,
) -> Result<FileRecord, UploadError> {

    // 1. Validar archivo
    let file_size = fs::metadata(source_path)?.len();
    if file_size > config.max_file_size_bytes {
        return Err(UploadError::FileTooLarge { max: config.max_file_size_bytes, actual: file_size });
    }
    if file_size == 0 {
        return Err(UploadError::EmptyFile);
    }

    // 2. Leer archivo y calcular hash del original
    let file_bytes = fs::read(source_path)?;
    let original_hash = sha256_hex(&file_bytes);

    // 3. Deduplicación: verificar si ya existe un archivo con el mismo hash para este usuario
    if let Some(existing) = db.find_by_hash(tenant_id, user_id, &original_hash).await? {
        if existing.deleted_at.is_none() {
            return Err(UploadError::DuplicateFile { existing_id: existing.id });
        }
        // Si estaba soft-deleted, permitir re-upload
    }

    // 4. Obtener o crear llave de cifrado activa para el tenant
    let enc_key = crypto.get_active_key(tenant_id)?;
    // enc_key.id = referencia en Keychain/DPAPI
    // enc_key.raw = bytes de la DEK (nunca persiste en disco)

    // 5. Generar DEK única para este archivo
    let file_dek = crypto.generate_dek()?; // 256 bits, CSPRNG
    let nonce = crypto.generate_nonce()?;   // 96 bits, CSPRNG

    // 6. Cifrar archivo con AES-256-GCM
    let encrypted_bytes = crypto.encrypt_aes256gcm(
        &file_bytes,
        &file_dek,
        &nonce,
    )?;

    // 7. Cifrar la DEK con la master key (envelope encryption)
    let wrapped_dek = crypto.wrap_key(&file_dek, &enc_key)?;

    // 8. Calcular hash del cifrado (para verificación de integridad post-write)
    let enc_hash = sha256_hex(&encrypted_bytes);

    // 9. Construir ruta destino
    let file_id = uuid_v7();
    let dest_dir = config.data_dir
        .join("tenants").join(tenant_id)
        .join("users").join(user_id)
        .join("files");
    fs::create_dir_all(&dest_dir)?;
    let dest_path = dest_dir.join(format!("{}.enc", file_id));

    // 10. Verificar que dest_path está dentro del directorio permitido (anti-traversal)
    let canonical_dest = dest_path.canonicalize_or_create()?;
    let canonical_base = config.data_dir.canonicalize()?;
    if !canonical_dest.starts_with(&canonical_base) {
        return Err(UploadError::PathTraversal);
    }

    // 11. Escribir archivo cifrado a disco (atomic write via temp file + rename)
    let temp_path = dest_dir.join(format!("{}.tmp", file_id));
    fs::write(&temp_path, &encrypted_bytes)?;

    // 12. Verificar integridad post-write
    let written_bytes = fs::read(&temp_path)?;
    let written_hash = sha256_hex(&written_bytes);
    if written_hash != enc_hash {
        fs::remove_file(&temp_path)?;
        return Err(UploadError::IntegrityCheckFailed);
    }

    // 13. Verificar que NO es texto plano (anti-bug: asegurar que el cifrado funcionó)
    if looks_like_known_format(&written_bytes) {
        fs::remove_file(&temp_path)?;
        return Err(UploadError::EncryptionFailsafe {
            msg: "Encrypted file matches known plaintext magic bytes".into()
        });
    }

    // 14. Rename atómico
    fs::rename(&temp_path, &dest_path)?;

    // 15. Limpiar datos sensibles de memoria
    file_dek.zeroize();
    // file_bytes ya fue dropeado al salir de scope si usamos Zeroizing<Vec<u8>>

    // 16. Registrar en metadata DB
    let record = FileRecord {
        id: file_id.clone(),
        tenant_id: tenant_id.to_string(),
        user_id: user_id.to_string(),
        original_name: original_name.to_string(),
        mime_type: detect_mime(original_name),
        size_bytes: file_size as i64,
        sha256_hash: original_hash,
        enc_sha256_hash: enc_hash,
        encryption_key_id: enc_key.id.clone(),
        wrapped_dek: base64_encode(&wrapped_dek),
        nonce: base64_encode(&nonce),
        version: 1,
        tags: serde_json::to_string(&tags)?,
        sync_status: SyncStatus::Pending,
        drive_file_id: None,
        drive_sync_at: None,
        created_at: Utc::now(),
        updated_at: Utc::now(),
        deleted_at: None,
    };
    db.insert_file(&record).await?;

    // 17. Eliminar archivo fuente temporal (si aplica)
    if source_path.starts_with(config.temp_dir()) {
        fs::remove_file(source_path)?;
    }

    // 18. Encolar tarea de sync a Google Drive (si habilitado)
    if config.drive_backup_enabled {
        queue.enqueue(SyncTask {
            id: uuid_v7(),
            file_id: file_id.clone(),
            task_type: TaskType::UploadDrive,
            status: TaskStatus::Queued,
            attempts: 0,
            max_attempts: config.sync.retry_max_attempts,
            next_retry_at: None,
            created_at: Utc::now(),
        }).await?;
    }

    // 19. Log (sin datos sensibles)
    log::info!(
        "File uploaded: id={}, tenant={}, user={}, size={}, hash_prefix={}...",
        file_id, tenant_id, user_id, file_size, &original_hash[..8]
    );

    Ok(record)
}

/// Detectar si los primeros bytes coinciden con formatos conocidos (failsafe anti-bug)
fn looks_like_known_format(bytes: &[u8]) -> bool {
    if bytes.len() < 4 { return false; }
    let magic = &bytes[..4];
    matches!(magic,
        b"%PDF"                          |  // PDF
        [0xFF, 0xD8, 0xFF, _]           |  // JPEG
        [0x89, 0x50, 0x4E, 0x47]        |  // PNG
        [0x50, 0x4B, 0x03, 0x04]        |  // ZIP/DOCX/XLSX
        [0xD0, 0xCF, 0x11, 0xE0]           // OLE (DOC/XLS)
    )
}
```

---

## b) Encolado de Backup a Google Drive

```rust
/// Motor de sync que procesa la cola de tareas pendientes.
/// Se ejecuta como background task con intervalo configurable.
async fn sync_engine_loop(
    config: &AppConfig,
    db: &MetadataDb,
    queue: &TaskQueue,
    drive: &GoogleDriveProvider,
    circuit_breaker: &CircuitBreaker,
) {
    let mut interval = tokio::time::interval(Duration::from_secs(config.sync.batch_interval_secs));

    loop {
        interval.tick().await;

        // 1. Verificar circuit breaker
        if circuit_breaker.is_open() {
            log::warn!("Circuit breaker OPEN, skipping sync cycle");
            continue;
        }

        // 2. Verificar conectividad
        if !network::is_online().await {
            log::info!("Offline, skipping sync cycle");
            continue;
        }

        // 3. Verificar cuota de Drive
        match drive.check_quota().await {
            Ok(quota) if quota.remaining_percent < 10.0 => {
                log::warn!("Drive quota low: {}% remaining", quota.remaining_percent);
                emit_event("drive_quota_low", &quota);
                // Continuar pero con batch reducido
            }
            Err(e) => {
                log::error!("Failed to check Drive quota: {}", e);
                circuit_breaker.record_failure();
                continue;
            }
            _ => {}
        }

        // 4. Obtener batch de tareas pendientes
        let tasks = queue.dequeue_batch(
            config.sync.max_batch_size,
            TaskType::UploadDrive,
        ).await;

        if tasks.is_empty() {
            continue;
        }

        log::info!("Processing {} sync tasks", tasks.len());

        // 5. Procesar con concurrencia limitada
        let semaphore = Arc::new(Semaphore::new(config.sync.max_concurrent_uploads));

        let results = futures::future::join_all(
            tasks.into_iter().map(|task| {
                let sem = semaphore.clone();
                let drive = drive.clone();
                let db = db.clone();
                let queue = queue.clone();
                let cb = circuit_breaker.clone();

                async move {
                    let _permit = sem.acquire().await;
                    process_sync_task(&task, &drive, &db, &queue, &cb).await
                }
            })
        ).await;

        // 6. Reportar resultados
        let succeeded = results.iter().filter(|r| r.is_ok()).count();
        let failed = results.iter().filter(|r| r.is_err()).count();
        log::info!("Sync cycle complete: {} succeeded, {} failed", succeeded, failed);
    }
}

/// Procesar una tarea de sync individual.
async fn process_sync_task(
    task: &SyncTask,
    drive: &GoogleDriveProvider,
    db: &MetadataDb,
    queue: &TaskQueue,
    circuit_breaker: &CircuitBreaker,
) -> Result<(), SyncError> {

    // 1. Obtener metadata del archivo
    let file = db.get_file(&task.file_id).await?
        .ok_or(SyncError::FileNotFound)?;

    // 2. Leer archivo cifrado del disco
    let enc_path = file.local_path();
    let enc_bytes = fs::read(&enc_path)?;

    // 3. Verificar integridad antes de subir
    let actual_hash = sha256_hex(&enc_bytes);
    if actual_hash != file.enc_sha256_hash {
        log::error!("Integrity check failed for file {}", file.id);
        queue.mark_failed(task, "Local file integrity mismatch").await?;
        return Err(SyncError::IntegrityMismatch);
    }

    // 4. Construir ruta en Drive
    let drive_path = format!(
        "AIONDefensaPredictiva/{}/backups/{}/{}_{}.enc",
        file.tenant_id,
        Utc::now().format("%Y-%m"),
        sanitize_filename(&file.original_name),
        &file.id[..8],
    );

    // 5. Upload a Drive
    match drive.upload_file(
        &drive_path,
        &enc_bytes,
        "application/octet-stream",
    ).await {
        Ok(drive_file) => {
            // 6a. Éxito: actualizar metadata
            circuit_breaker.record_success();
            db.update_file_sync_status(
                &file.id,
                SyncStatus::Synced,
                Some(&drive_file.id),
                Some(Utc::now()),
            ).await?;
            queue.mark_completed(task).await?;

            log::info!(
                "File synced to Drive: file_id={}, drive_id={}",
                file.id, drive_file.id
            );
            Ok(())
        }
        Err(DriveError::RateLimited { retry_after }) => {
            // 6b. Rate limited: respetar Retry-After
            log::warn!("Drive rate limited, retry after {}s", retry_after.as_secs());
            circuit_breaker.record_failure();
            queue.reschedule(task, Utc::now() + retry_after).await?;
            Err(SyncError::RateLimited)
        }
        Err(DriveError::QuotaExceeded) => {
            // 6c. Cuota excedida: pausar toda la cola
            log::error!("Drive quota exceeded, pausing sync");
            circuit_breaker.force_open(Duration::from_secs(3600)); // 1 hora
            emit_event("drive_quota_exceeded", &());
            queue.reschedule(task, Utc::now() + Duration::from_secs(3600)).await?;
            Err(SyncError::QuotaExceeded)
        }
        Err(e) => {
            // 6d. Otro error: retry con backoff
            circuit_breaker.record_failure();
            let next_attempt = task.attempts + 1;

            if next_attempt >= task.max_attempts {
                log::error!(
                    "File sync DEAD LETTER after {} attempts: file_id={}, error={}",
                    next_attempt, file.id, e
                );
                queue.move_to_dead_letter(task, &e.to_string()).await?;
                emit_event("sync_dead_letter", &file.id);
            } else {
                let delay = exponential_backoff_with_jitter(next_attempt);
                log::warn!(
                    "File sync failed (attempt {}/{}): file_id={}, retry in {}s, error={}",
                    next_attempt, task.max_attempts, file.id, delay.as_secs(), e
                );
                queue.reschedule_with_attempt(task, next_attempt, Utc::now() + delay).await?;
            }

            Err(SyncError::UploadFailed(e.to_string()))
        }
    }
}
```

---

## c) Reintentos con Backoff Exponencial y Circuit Breaker

```rust
use std::time::Duration;
use rand::Rng;

/// Calcula delay de backoff exponencial con jitter.
///
/// Formula: min(base * 2^attempt + jitter, max_delay)
/// Jitter: random entre 0 y 50% del delay calculado
///
/// Ejemplo para base=2s, max=300s:
///   Attempt 0: ~2s    (2 * 2^0 = 2s + jitter)
///   Attempt 1: ~4s    (2 * 2^1 = 4s + jitter)
///   Attempt 2: ~8s    (2 * 2^2 = 8s + jitter)
///   Attempt 3: ~16s
///   Attempt 4: ~32s
///   Attempt 5: ~64s
///   Attempt 6: ~128s
///   Attempt 7: ~256s
///   Attempt 8+: 300s (capped)
fn exponential_backoff_with_jitter(attempt: u32) -> Duration {
    let base_ms: u64 = 2000;     // 2 segundos
    let max_ms: u64 = 300_000;   // 5 minutos

    let exp_delay = base_ms.saturating_mul(2u64.saturating_pow(attempt));
    let capped_delay = exp_delay.min(max_ms);

    // Jitter: 0% a 50% del delay
    let jitter = rand::thread_rng().gen_range(0..=(capped_delay / 2));
    let total = capped_delay + jitter;

    Duration::from_millis(total.min(max_ms))
}

/// Circuit Breaker — Patrón de protección contra fallos en cascada.
///
/// Estados:
///   CLOSED  → operación normal, cuenta fallos
///   OPEN    → bloquea todas las operaciones, timer de recuperación
///   HALF_OPEN → permite 1 operación de prueba
///
///   ┌────────┐  failure >= threshold  ┌────────┐
///   │ CLOSED │───────────────────────>│  OPEN  │
///   │        │<───────────────────────│        │
///   └────────┘  success in half_open  └────┬───┘
///       ^                                   │
///       │                     recovery_time │
///       │         ┌───────────┐             │
///       └─────────│ HALF_OPEN │<────────────┘
///        success  │           │  failure
///                 └───────────┘──────────> OPEN
struct CircuitBreaker {
    state: Mutex<CircuitState>,
    failure_threshold: u32,
    recovery_timeout: Duration,
}

enum CircuitState {
    Closed {
        failure_count: u32,
    },
    Open {
        opened_at: Instant,
        forced_duration: Option<Duration>,
    },
    HalfOpen,
}

impl CircuitBreaker {
    fn new(failure_threshold: u32, recovery_timeout: Duration) -> Self {
        Self {
            state: Mutex::new(CircuitState::Closed { failure_count: 0 }),
            failure_threshold,
            recovery_timeout,
        }
    }

    /// Verificar si se puede intentar una operación.
    fn is_open(&self) -> bool {
        let mut state = self.state.lock();
        match *state {
            CircuitState::Closed { .. } => false,
            CircuitState::Open { opened_at, forced_duration } => {
                let timeout = forced_duration.unwrap_or(self.recovery_timeout);
                if opened_at.elapsed() >= timeout {
                    // Transición a HalfOpen
                    *state = CircuitState::HalfOpen;
                    log::info!("Circuit breaker: OPEN → HALF_OPEN");
                    false // Permitir 1 intento
                } else {
                    true // Todavía abierto
                }
            }
            CircuitState::HalfOpen => false, // Permitir el intento de prueba
        }
    }

    /// Registrar un éxito.
    fn record_success(&self) {
        let mut state = self.state.lock();
        match *state {
            CircuitState::HalfOpen => {
                *state = CircuitState::Closed { failure_count: 0 };
                log::info!("Circuit breaker: HALF_OPEN → CLOSED (success)");
            }
            CircuitState::Closed { ref mut failure_count } => {
                *failure_count = 0;
            }
            _ => {}
        }
    }

    /// Registrar un fallo.
    fn record_failure(&self) {
        let mut state = self.state.lock();
        match *state {
            CircuitState::Closed { ref mut failure_count } => {
                *failure_count += 1;
                if *failure_count >= self.failure_threshold {
                    *state = CircuitState::Open {
                        opened_at: Instant::now(),
                        forced_duration: None,
                    };
                    log::warn!(
                        "Circuit breaker: CLOSED → OPEN (failures: {})",
                        self.failure_threshold
                    );
                }
            }
            CircuitState::HalfOpen => {
                *state = CircuitState::Open {
                    opened_at: Instant::now(),
                    forced_duration: None,
                };
                log::warn!("Circuit breaker: HALF_OPEN → OPEN (probe failed)");
            }
            _ => {}
        }
    }

    /// Forzar apertura por duración específica (ej: cuota excedida → 1 hora).
    fn force_open(&self, duration: Duration) {
        let mut state = self.state.lock();
        *state = CircuitState::Open {
            opened_at: Instant::now(),
            forced_duration: Some(duration),
        };
        log::warn!("Circuit breaker: FORCED OPEN for {}s", duration.as_secs());
    }
}

/// Wrapper genérico para ejecutar operaciones con retry + circuit breaker.
async fn execute_with_retry<F, Fut, T, E>(
    operation_name: &str,
    max_attempts: u32,
    circuit_breaker: &CircuitBreaker,
    operation: F,
) -> Result<T, RetryError<E>>
where
    F: Fn() -> Fut,
    Fut: Future<Output = Result<T, E>>,
    E: std::fmt::Display,
{
    if circuit_breaker.is_open() {
        return Err(RetryError::CircuitOpen);
    }

    for attempt in 0..max_attempts {
        match operation().await {
            Ok(result) => {
                circuit_breaker.record_success();
                if attempt > 0 {
                    log::info!(
                        "{}: succeeded after {} retries",
                        operation_name, attempt
                    );
                }
                return Ok(result);
            }
            Err(e) => {
                circuit_breaker.record_failure();

                if attempt + 1 >= max_attempts {
                    log::error!(
                        "{}: FAILED after {} attempts. Last error: {}",
                        operation_name, max_attempts, e
                    );
                    return Err(RetryError::MaxAttemptsExceeded {
                        attempts: max_attempts,
                        last_error: e,
                    });
                }

                if circuit_breaker.is_open() {
                    log::warn!(
                        "{}: circuit breaker opened during retries at attempt {}",
                        operation_name, attempt + 1
                    );
                    return Err(RetryError::CircuitOpen);
                }

                let delay = exponential_backoff_with_jitter(attempt);
                log::warn!(
                    "{}: attempt {}/{} failed ({}), retrying in {}ms",
                    operation_name, attempt + 1, max_attempts, e, delay.as_millis()
                );

                tokio::time::sleep(delay).await;
            }
        }
    }

    unreachable!()
}

enum RetryError<E> {
    CircuitOpen,
    MaxAttemptsExceeded { attempts: u32, last_error: E },
}
```

---

## Ejemplo de Uso Completo

```rust
// En un Tauri command handler:

#[tauri::command]
async fn upload_user_file(
    state: State<'_, AppState>,
    tenant_id: String,
    file_path: String,
    file_name: String,
    tags: Vec<String>,
) -> Result<FileResponse, AppError> {
    // Validar sesión
    let session = state.auth_manager.get_current_session()?;
    if session.is_expired() {
        return Err(AppError::SessionExpired);
    }

    // Validar que el usuario pertenece al tenant
    if session.tenant_id != tenant_id {
        log::warn!(
            "Tenant mismatch: user {} tried to access tenant {}",
            session.user_id, tenant_id
        );
        return Err(AppError::Unauthorized);
    }

    // Ejecutar upload
    let record = upload_file(
        &tenant_id,
        &session.user_id,
        Path::new(&file_path),
        &file_name,
        tags,
        &state.config,
        &state.crypto_engine,
        &state.metadata_db,
        &state.task_queue,
    ).await?;

    // Emitir evento para la UI
    state.app_handle.emit_all("file_uploaded", &FileEvent {
        file_id: record.id.clone(),
        name: record.original_name.clone(),
        sync_status: record.sync_status.clone(),
    })?;

    Ok(record.into())
}
```

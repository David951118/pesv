# Security Audit — AION Defensa Predictiva S.A.S Desktop Installer

## Version: 1.0 | Fecha: 2026-02-08 | Clasificación: CONFIDENCIAL

---

## Executive Summary (10 Bullets)

1. **Tauri sobre Electron es la decisión correcta para seguridad**: Rust elimina memory-safety bugs, el IPC es deny-by-default, no hay Node runtime expuesto.
2. **El riesgo #1 es el robo de tokens en laptop perdida/robada**: Sin protección adicional (passphrase, disk encryption), un atacante con acceso físico puede extraer tokens de Keychain/DPAPI si tiene la sesión del OS abierta.
3. **El auto-updater es un vector de ataque crítico**: Si se compromete, permite RCE en todos los clientes. La firma Ed25519 + certificate pinning son no negociables.
4. **Las integraciones de IA (GPT/Claude) son un vector de exfiltración de datos**: Sin guardrails, un prompt injection puede exfiltrar datos del usuario hacia el modelo.
5. **Google Drive OAuth con scope `drive.file` es correcto**. Usar `drive` (full access) sería un hallazgo Critical.
6. **GitHub App es mejor que OAuth App para este caso de uso**: Permisos granulares y tokens de corta vida reducen blast radius.
7. **DLL hijacking en Windows es un riesgo real para apps Tauri/Electron**: Requiere hardening explícito del search path.
8. **Los logs son una mina de oro para atacantes si contienen tokens**: Redacción automática es obligatoria, no opcional.
9. **Supabase RLS debe ser la línea de defensa primaria en el backend**: El cliente NO debe confiar en que el frontend valide acceso. El `service_role_key` NUNCA debe estar en el cliente.
10. **La cadena de suministro (supply chain) es el riesgo más difícil de mitigar**: Cargo crates + npm packages + CI runners requieren vigilancia continua.

---

## 1. Threat Model

### 1.1 Actores

| Actor | Motivación | Capacidad | Ejemplos |
|---|---|---|---|
| **Externo no autenticado** | Oportunista | Script kiddie, phishing | Robar instalador, MITM en WiFi público |
| **Externo autenticado** (usuario legítimo malicioso) | Exfiltración, abuso | Conoce el sistema por dentro | Abuso de cuotas AI, acceso a datos de otros tenants |
| **Insider** (empleado de la empresa) | Venganza, lucro | Acceso a código, CI, secrets | Backdoor en build, robar service_role_key |
| **Atacante con acceso físico** | Robo de datos | Laptop robada/decomisada | Extraer tokens, archivos cifrados |
| **Malware local** | Espionaje, ransomware | Keylogger, file stealer | Interceptar tokens en memoria, robar archivos |
| **Supply chain attacker** | Distribución masiva | Compromiso de dependencia | Typosquatting crate/npm, CI compromise |

### 1.2 Activos (ordenados por valor)

1. **Archivos de usuario** (documentos de flota, contratos, datos personales de conductores)
2. **Tokens de acceso** (Supabase JWT, GitHub installation token, Google OAuth tokens)
3. **Llaves de cifrado** (Master key, DEKs)
4. **Credenciales de usuario** (passwords hasheados en Supabase, pero el token JWT permite actuar como el usuario)
5. **Metadatos** (quién accedió qué, cuándo, estructura de archivos)
6. **Configuración** (URLs de Supabase, tenant IDs — permite targeting)
7. **Código fuente** de repos clonados via GitHub
8. **Prompts y respuestas de IA** (pueden contener datos sensibles)

### 1.3 Trust Boundaries

```
┌─────────────────────────────────────────────────────────────────────┐
│                    USER'S MACHINE (Trust Zone 1)                     │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────┐       │
│  │              TAURI APP (Trust Zone 2)                     │       │
│  │                                                           │       │
│  │  ┌─────────────┐  ══IPC══  ┌───────────────────┐        │       │
│  │  │  WebView    │  BOUNDARY  │   Rust Core      │        │       │
│  │  │  (React UI) │◄═════════►│   (commands,      │        │       │
│  │  │  Trust: LOW │           │   crypto, storage)│        │       │
│  │  │             │           │   Trust: HIGH     │        │       │
│  │  └─────────────┘           └───────┬───────────┘        │       │
│  │                                     │                    │       │
│  └─────────────────────────────────────┼────────────────────┘       │
│                                        │                             │
│  ┌─────────────────┐   ┌──────────────┴──────────────┐              │
│  │  Local Files    │   │  Keychain / DPAPI           │              │
│  │  (encrypted)    │   │  (tokens, master key)       │              │
│  │  Trust: MEDIUM  │   │  Trust: HIGH (OS-managed)   │              │
│  └─────────────────┘   └─────────────────────────────┘              │
│                                                                      │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │
                          NETWORK BOUNDARY
                          ═════════╪═════════
                                   │
┌──────────────────────────────────┼──────────────────────────────────┐
│                    EXTERNAL SERVICES (Trust Zone 3)                   │
│                                                                      │
│  ┌───────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ ┌──────────┐  │
│  │ Supabase  │ │  GitHub  │ │  Google  │ │ Claude │ │  OpenAI  │  │
│  │ (Auth+DB) │ │  (repos) │ │  Drive   │ │  API   │ │  API     │  │
│  │           │ │          │ │          │ │        │ │          │  │
│  └───────────┘ └──────────┘ └──────────┘ └────────┘ └──────────┘  │
│                                                                      │
│  ┌───────────┐ ┌──────────────────────────────────────────────┐     │
│  │  AION  │ │  Update Server (GitHub Releases)             │     │
│  │  API      │ │  Trust: CRITICAL (distributes binaries)      │     │
│  └───────────┘ └──────────────────────────────────────────────┘     │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.4 Superficies de Ataque

| Superficie | Componentes | Riesgo |
|---|---|---|
| **IPC Bridge** | Tauri commands expuestos al WebView | Medium — Tauri capabilities limitan, pero un XSS en WebView podría invocar commands |
| **Network** | HTTPS a 6+ servicios externos | High — MITM, DNS hijacking, certificate trust |
| **Local filesystem** | Archivos cifrados, SQLite, config, logs | High — Acceso físico o malware local |
| **Keychain/DPAPI** | Tokens, llaves de cifrado | High — Depende de protección del OS |
| **OAuth callbacks** | Servidor HTTP local temporal | Medium — Port hijacking en localhost |
| **Auto-updater** | Descarga y ejecución de binarios | Critical — RCE si se compromete |
| **AI APIs** | Datos enviados a modelos externos | High — Exfiltración de datos vía prompts |
| **Clipboard** | Copiar tokens, passwords | Low — Malware clipboard sniffer |
| **Process memory** | Tokens y llaves en RAM | Medium — Memory dump, cold boot |

---

## 2. Hallazgos Priorizados

### CRITICAL-01: Compromiso del Auto-Updater = RCE en Toda la Flota

- **Riesgo**: Impacto CRITICAL × Probabilidad MEDIUM = **CRITICAL**
- **Escenario**:
  1. Atacante compromete el servidor de updates (o hace MITM).
  2. Publica un update malicioso con payload de ransomware.
  3. Todos los clientes que auto-update ejecutan el payload.
  4. Ransomware cifra archivos locales (ya están cifrados, pero el malware puede robar la sesión y exfiltrar).
- **Señales en logs**: Update descargado desde URL inusual, firma no verificada (si se omite por error), crash post-update.
- **Mitigación**:
  - Ed25519 signature verification OBLIGATORIA. Si la firma no valida, abortar silenciosamente.
  - TLS certificate pinning al dominio de updates.
  - Verificar `new_version > current_version` (no permitir downgrade).
  - Rollback automático si la nueva versión crashea en los primeros 60 segundos.
  - Dual-key signing: firma del CI + firma de un maintainer humano (m-of-n scheme).
  - No auto-update silencioso: siempre pedir confirmación al usuario (opción "Aplazar 24h").
  - Publicar checksums SHA-256 en un canal separado (página web, DNS TXT record).
- **Verificación**:
  - Probar con un update con firma inválida → debe rechazar.
  - Probar con downgrade → debe rechazar.
  - Probar con firma de un key diferente → debe rechazar.
  - Probar MITM en update endpoint → debe fallar por cert pinning.

### CRITICAL-02: Service Role Key de Supabase en el Cliente

- **Riesgo**: Impacto CRITICAL × Probabilidad HIGH = **CRITICAL**
- **Escenario**:
  1. Desarrollador por error incluye `SUPABASE_SERVICE_ROLE_KEY` en el binario o config.
  2. Atacante extrae el string del binario (strings, decompiler).
  3. Con service role key, bypasa ALL RLS policies.
  4. Acceso directo a TODOS los datos de TODOS los tenants.
- **Señales en logs**: Queries sin JWT de usuario, acceso cross-tenant.
- **Mitigación**:
  - **JAMÁS** incluir service role key en el cliente. Ni en código, ni en config, ni en env.
  - CI check: `grep -r "service_role" src-tauri/ src/` debe dar 0 resultados.
  - El cliente solo usa `anon_key` (público) + JWT del usuario autenticado.
  - Operaciones privilegiadas via Supabase Edge Functions (que sí tienen service role internamente).
  - RLS policies que SIEMPRE filtran por `auth.uid()` y `tenant_id`.
- **Verificación**:
  - `strings` sobre el binario compilado → no debe contener nada que parezca un service role key.
  - Intentar llamar a Supabase sin JWT → debe fallar con 401.
  - Intentar acceder a datos de otro tenant con JWT válido → debe fallar con RLS.

### CRITICAL-03: Archivos Sensibles sin Cifrar en Disco (si falla el cifrado)

- **Riesgo**: Impacto CRITICAL × Probabilidad LOW = **HIGH**
- **Escenario**:
  1. Bug en `crypto_engine` hace que archivos se escriban en claro.
  2. Laptop robada → acceso directo a documentos de flota, datos personales de conductores.
  3. Violación de habeas data (ley colombiana de protección de datos).
- **Mitigación**:
  - Test unitario que verifica que TODOS los archivos en `files/` tienen magic bytes de AES-GCM (no los del formato original).
  - Verificación post-write: leer los primeros bytes del archivo cifrado y confirmar que NO son el magic number del formato original (PDF header `%PDF`, JPEG `FFD8`, etc.).
  - Health check periódico que verifica integridad de archivos cifrados.
  - **Failsafe**: Si el cifrado falla, NO escribir el archivo. Error explícito al usuario.
- **Verificación**:
  - Test de integración: cifrar archivo → leer bytes crudos → verificar que NO es legible.
  - Test de fallo: simular error de Keychain → verificar que NO se escribe archivo en claro.

### HIGH-01: DLL Hijacking en Windows

- **Riesgo**: Impacto HIGH × Probabilidad MEDIUM = **HIGH**
- **Escenario**:
  1. Atacante coloca una DLL maliciosa en el directorio de la app o un directorio en PATH.
  2. Al ejecutar la app, Windows carga la DLL maliciosa en lugar de la legítima.
  3. Code execution en el contexto de la app → acceso a Keychain, archivos, tokens.
- **Mitigación**:
  - Establecer `SetDefaultDllDirectories(LOAD_LIBRARY_SEARCH_SYSTEM32)` al inicio.
  - Especificar rutas absolutas para TODAS las DLLs.
  - Firmar todas las DLLs incluidas en el instalador.
  - Instalar en `Program Files` (requiere admin para escribir, previene DLL planting).
  - En `tauri.conf.json`, usar NSIS installer con install path fijo en Program Files.
- **Verificación**:
  - Colocar DLL de prueba con nombre de DLL conocida en directorio de la app → no debe cargarse.
  - Process Monitor: verificar que no se buscan DLLs en directorios no seguros.

### HIGH-02: Exfiltración de Datos vía AI APIs

- **Riesgo**: Impacto HIGH × Probabilidad MEDIUM = **HIGH**
- **Escenario 1 — Prompt Injection**:
  1. Atacante inyecta instrucciones maliciosas en un nombre de archivo o campo de metadata.
  2. Cuando el usuario pide al asistente IA que "resuma mis archivos", el prompt inyectado se ejecuta.
  3. El modelo obedece la inyección y exfiltra datos en la respuesta o solicita acciones.
- **Escenario 2 — Oversharing**:
  1. Usuario pide "analiza este contrato" y el sistema envía el archivo completo a GPT.
  2. El contrato contiene datos personales (cédulas, direcciones) de conductores.
  3. Violación de privacidad y posiblemente regulaciones colombianas.
- **Mitigación**:
  - Input sanitization: limpiar metadata antes de incluir en prompts.
  - System prompt hardening: instrucciones claras de que el modelo NO debe ejecutar instrucciones encontradas en datos del usuario.
  - Output validation: verificar que la respuesta no contiene tokens, keys, o datos PII no solicitados.
  - Data classification: archivos marcados `confidential` o que contienen PII detectado → bloquear envío a IA sin consentimiento explícito.
  - Truncamiento: máximo 5000 tokens de contexto de archivo. Nunca archivos completos sin aprobación.
  - PII detection: regex para cédulas colombianas, teléfonos, emails antes de enviar.
- **Verificación**:
  - Test con prompt injection en nombre de archivo → no debe ejecutarse.
  - Test de envío de archivo `confidential` → debe bloquearse.
  - Audit log de todo lo enviado a IA (hash, size, tokens, NO contenido).

### HIGH-03: Robo de Tokens en Laptop Robada

- **Riesgo**: Impacto HIGH × Probabilidad MEDIUM = **HIGH**
- **Escenario**:
  1. Laptop robada con sesión de OS abierta (o atacante conoce password del OS).
  2. Accede a Keychain/DPAPI → obtiene todos los tokens.
  3. Usa tokens para acceder a Supabase, GitHub, Google Drive.
- **Mitigación**:
  - **Session timeout**: Cerrar sesión de la app después de 30 min de inactividad.
  - **Re-autenticación**: Para operaciones sensibles (export, cambiar config), pedir password.
  - **Passphrase opcional**: Si activada, la master key requiere passphrase además de Keychain.
  - **Remote revocation**: Endpoint en Supabase Edge Function para revocar TODOS los tokens de un dispositivo.
  - **Device registration**: Cada instalación tiene un `device_id`. Admin puede desautorizar dispositivos remotamente.
  - Recomendación al usuario: activar FileVault (macOS) / BitLocker (Windows).
- **Verificación**:
  - Test timeout: dejar app inactiva 30 min → debe cerrar sesión.
  - Test revocación: revocar desde admin → app debe cerrar sesión en < 5 min.

### HIGH-04: Port Hijacking en OAuth Callback

- **Riesgo**: Impacto HIGH × Probabilidad LOW = **MEDIUM**
- **Escenario**:
  1. App levanta servidor HTTP en `localhost:PORT` para recibir OAuth callback.
  2. Malware local intercepta el puerto ANTES que la app y captura el authorization code.
  3. Malware intercambia code por tokens.
- **Mitigación**:
  - Usar puerto aleatorio en rango efímero (49152-65535).
  - Bind explícito a `127.0.0.1` (no `0.0.0.0`).
  - Usar PKCE (Proof Key for Code Exchange) → el code es inútil sin el `code_verifier`.
  - `state` parameter único por request, verificado en callback.
  - Cerrar servidor HTTP inmediatamente después de recibir el callback.
  - Timeout de 120s: si no llega callback, cerrar servidor.
- **Verificación**:
  - Intentar replay del authorization code → debe fallar (PKCE).
  - Intentar callback con `state` diferente → debe rechazar.

### HIGH-05: XSS en WebView → IPC Abuse

- **Riesgo**: Impacto HIGH × Probabilidad LOW = **MEDIUM**
- **Escenario**:
  1. XSS inyectado via contenido dinámico (nombre de archivo con `<script>`, respuesta de API malformada).
  2. Script malicioso ejecuta `invoke()` de Tauri para llamar commands.
  3. Exfiltra archivos, tokens, o ejecuta acciones como el usuario.
- **Mitigación**:
  - Tauri 2 capabilities: solo exponer commands necesarios al WebView.
  - CSP estricto en `tauri.conf.json`:
    ```json
    "security": {
      "csp": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://*.supabase.co"
    }
    ```
  - Sanitizar TODA la salida de APIs externas antes de renderizar.
  - No usar `dangerouslySetInnerHTML`.
  - Validar parámetros en CADA Tauri command en el lado Rust (no confiar en la UI).
- **Verificación**:
  - Test XSS: inyectar `<img src=x onerror=invoke('read_file',{path:'/etc/passwd'})>` en nombre de archivo → no debe ejecutarse.
  - Verificar CSP headers en DevTools.

### MEDIUM-01: Symlink / Path Traversal Attacks

- **Riesgo**: Impacto MEDIUM × Probabilidad MEDIUM = **MEDIUM**
- **Escenario**:
  1. Atacante (o malware) crea un symlink dentro del directorio de datos de la app.
  2. `files/{tenant}/users/{user}/files/evil.enc → /etc/passwd` (o similar).
  3. App sigue el symlink y lee/escribe fuera de su directorio.
- **Mitigación**:
  - Resolver ruta canónica (`fs::canonicalize()` en Rust) antes de CUALQUIER operación de archivo.
  - Verificar que la ruta resuelta está DENTRO del directorio de datos de la app.
  - No seguir symlinks: `OpenOptions::new().follow(false)` o equivalente.
  - Validar nombres de archivo: no permitir `..`, `/`, `\`, null bytes.
- **Verificación**:
  - Crear symlink dentro del directorio de datos → app debe rechazar la operación.
  - Intentar path `../../etc/passwd` → debe fallar.

### MEDIUM-02: SQLite Injection en Metadata DB

- **Riesgo**: Impacto MEDIUM × Probabilidad LOW = **MEDIUM**
- **Escenario**:
  1. Nombre de archivo malicioso: `test'; DROP TABLE files;--`
  2. Si se usa string interpolation en queries SQLite...
- **Mitigación**:
  - SIEMPRE usar prepared statements / parameterized queries.
  - `sqlx` y `rusqlite` en Rust usan parámetros por defecto. NUNCA `format!()` para queries.
  - Read-only mode para queries de consulta.
- **Verificación**:
  - Test: insertar archivo con nombre `'; DROP TABLE files;--` → tabla debe seguir intacta.

### MEDIUM-03: Logging de Secretos

- **Riesgo**: Impacto MEDIUM × Probabilidad HIGH = **HIGH** (frecuencia de ocurrencia)
- **Escenario**:
  1. Desarrollador agrega `log::debug!("Token: {}", token)` durante desarrollo.
  2. Se pasa a producción con `debug` level activado.
  3. Logs con tokens accesibles a soporte/admins.
- **Mitigación**:
  - Redacción automática en el logger: regex que detecta y reemplaza patrones de tokens:
    - JWT: `eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+` → `[REDACTED:JWT]`
    - API keys: `sk-[a-zA-Z0-9]+` → `[REDACTED:API_KEY]`
    - GitHub tokens: `ghs_[a-zA-Z0-9]+` → `[REDACTED:GH_TOKEN]`
    - OAuth tokens: `ya29\.[a-zA-Z0-9_-]+` → `[REDACTED:GOOGLE_TOKEN]`
  - CI lint: grep for `log::.*token|log::.*key|log::.*password|log::.*secret` → fail si se encuentra.
  - Production log level: `INFO` mínimo. `DEBUG` solo con flag explícito y advertencia.
  - Logs en modo diagnóstico: extra verbose pero con redacción reforzada.
- **Verificación**:
  - Test: loguear un JWT → verificar que aparece como `[REDACTED:JWT]` en el archivo de log.
  - `grep -r "token\|secret\|password\|key" *.log` → 0 resultados de valores reales.

### MEDIUM-04: Abuso de Cuotas de IA → Costos Descontrolados

- **Riesgo**: Impacto MEDIUM (financiero) × Probabilidad HIGH = **HIGH**
- **Escenario**:
  1. Usuario (o script) envía requests masivos a la API de IA.
  2. Sin rate limiting, se agotan $1000 en GPT-4 en horas.
  3. O bien, un atacante con tokens robados hace lo mismo.
- **Mitigación**:
  - Rate limiting en el cliente: 20 req/min, 100K tokens/día.
  - Presupuesto mensual con alertas al 80% y bloqueo al 100%.
  - Server-side enforcement vía Supabase Edge Function proxy (no direct API calls from client).
  - Logging de cada request: modelo, tokens_in, tokens_out, costo estimado.
- **Verificación**:
  - Test: enviar 25 requests en 1 minuto → 5 deben ser rechazados.
  - Test: exceder presupuesto mensual → requests bloqueados con mensaje claro.

### LOW-01: Clipboard Snooping

- **Riesgo**: Impacto LOW × Probabilidad LOW = **LOW**
- **Escenario**: Malware monitorea clipboard. Usuario copia token o password de la app.
- **Mitigación**:
  - No copiar tokens al clipboard automáticamente.
  - Limpiar clipboard después de 30 segundos si la app puso algo sensible.
  - Preferir mostrar información sensible in-situ, no como copiable.

---

## 3. Controles No Negociables Antes de Producción

### Obligatorios (Go/No-Go)

| # | Control | Verificación |
|---|---|---|
| 1 | **Service role key AUSENTE del binario y config** | `strings binary \| grep service_role` = vacío |
| 2 | **Auto-updater verifica firma Ed25519** | Test con firma inválida → rechazo |
| 3 | **Archivos cifrados AES-256-GCM en reposo** | Magic bytes ≠ formato original |
| 4 | **Tokens en Keychain/DPAPI, NO en archivos planos** | `find` en data dir no encuentra tokens |
| 5 | **PKCE en todos los flujos OAuth** | Replay de auth code → falla |
| 6 | **CSP restrictivo en WebView** | `script-src 'self'` verificado |
| 7 | **Prepared statements para TODA query SQLite** | SQL injection test → falla |
| 8 | **Redacción automática de secretos en logs** | JWT en log → `[REDACTED]` |
| 9 | **Certificate pinning en updater endpoint** | MITM proxy → connection refused |
| 10 | **No downgrade attacks en updater** | Ofrecer versión inferior → rechazo |
| 11 | **Rate limiting en AI API calls** | Burst test → throttled |
| 12 | **Path traversal protection** | `../../etc/passwd` → rechazo |
| 13 | **Binarios firmados (macOS + Windows)** | Signature verification succeeds |
| 14 | **macOS notarization** | Gatekeeper no bloquea |
| 15 | **Dependency audit clean** | `cargo audit` + `npm audit` = 0 critical/high |
| 16 | **Session timeout** | 30 min inactividad → logout |
| 17 | **Google Drive scope = `drive.file` SOLO** | Verificar en Google Cloud Console |
| 18 | **GitHub App permissions mínimos** | Solo `contents:read`, `issues:write`, `pull_requests:write` |

---

## 4. Recomendaciones de Hardening

### 4.1 Instalador y Supply Chain

```
SUPPLY CHAIN ATTACK SURFACE:

  ┌──────────┐    ┌───────────┐    ┌──────────┐    ┌──────────┐
  │  Source   │───>│   CI/CD   │───>│  Build   │───>│  Signed  │
  │  Code     │    │  (GitHub  │    │  Output  │    │  Install │
  │  (crates, │    │   Actions)│    │          │    │  .dmg/.msi│
  │   npm)    │    │           │    │          │    │          │
  └──────────┘    └───────────┘    └──────────┘    └──────────┘
       ▲               ▲               ▲               ▲
    Typosquat      Compromised      Inject          Unsigned
    crate/pkg      runner/action    malicious       binary
                                   artifact
```

**Controles**:
- `Cargo.lock` y `package-lock.json` commiteados y verificados.
- `cargo deny` para verificar licencias y advisories.
- `cargo vet` para auditoría de crates (si disponible).
- GitHub Actions: usar SHA pinning para actions (`actions/checkout@SHA` no `@v4`).
- Runners: usar self-hosted para builds de release, o ephemeral GitHub-hosted.
- Reproducible builds: verificar que el mismo commit produce el mismo hash.
- SBOM (Software Bill of Materials): generar con cada release.
- Dependabot habilitado para PRs de actualización.

### 4.2 Auto-Update

```rust
// Pseudocódigo de verificación de update
fn verify_update(manifest: UpdateManifest) -> Result<(), UpdateError> {
    // 1. Verificar firma del manifest
    if !ed25519_verify(&manifest.signature, &manifest.payload, &EMBEDDED_PUBLIC_KEY) {
        log::error!("Update manifest signature INVALID");
        return Err(UpdateError::InvalidSignature);
    }

    // 2. Verificar no-downgrade
    if manifest.version <= current_version() {
        log::error!("Update version {} <= current {}", manifest.version, current_version());
        return Err(UpdateError::DowngradeAttempt);
    }

    // 3. Descargar binario
    let binary = download_with_cert_pinning(&manifest.url)?;

    // 4. Verificar checksum
    let actual_hash = sha256(&binary);
    if actual_hash != manifest.sha256 {
        log::error!("Update checksum mismatch");
        return Err(UpdateError::ChecksumMismatch);
    }

    // 5. Crear checkpoint para rollback
    create_rollback_snapshot()?;

    // 6. Aplicar
    apply_update(binary)?;

    // 7. Verificar que la nueva versión arranca
    // (el launcher verifica post-start; si crash en <60s, rollback automático)

    Ok(())
}
```

- **Rollback**: Mantener la versión anterior completa. Si nueva versión no arranca en 60s, restaurar.
- **Dual signing**: CI firma + release manager firma manualmente los releases tagged.
- **Staged rollout**: Opción de desplegar a 10% → 50% → 100% de clientes.
- **Kill switch**: Si se detecta una versión comprometida, poder forzar rollback via manifest.

### 4.3 Almacenamiento Local y Manejo de Llaves

**macOS Keychain**:
```rust
// Usar `security-framework` crate
use security_framework::passwords::{set_generic_password, get_generic_password, delete_generic_password};

const SERVICE: &str = "com.aiondefensa.admin-hub";

fn store_token(account: &str, token: &[u8]) -> Result<()> {
    set_generic_password(SERVICE, account, token)?;
    Ok(())
}

fn get_token(account: &str) -> Result<Vec<u8>> {
    get_generic_password(SERVICE, account)
        .map_err(|e| Error::KeychainAccess(e))
}
```

**Windows Credential Manager (DPAPI)**:
```rust
// Usar `keyring` crate (cross-platform) o `windows-credentials` directamente
use keyring::Entry;

fn store_token(service: &str, user: &str, token: &str) -> Result<()> {
    let entry = Entry::new(service, user)?;
    entry.set_password(token)?;
    Ok(())
}
```

**Hardening**:
- Keychain access group limitado a la app.
- `kSecAttrAccessibleWhenUnlockedThisDeviceOnly` en macOS (no migrable a otro dispositivo).
- DPAPI con `CRYPTPROTECT_LOCAL_MACHINE` flag en Windows si se requiere acceso sin login de usuario (para servicios).
- Master key nunca en memoria más de lo necesario: cargar → usar → zeroize (`zeroize` crate).
- `SecureString` / `Zeroizing<Vec<u8>>` para datos sensibles en memoria.

### 4.4 OAuth Tokens

| Aspecto | Implementación |
|---|---|
| Storage | Keychain/DPAPI, NUNCA archivos |
| Refresh | 5 min antes de expiración |
| Revocación | Al desconectar, llamar endpoint de revoke del proveedor |
| Scope | Mínimo necesario (`drive.file`, no `drive`) |
| PKCE | OBLIGATORIO en todos los flujos |
| State | Random, verificado en callback |
| Token en memoria | `Zeroizing<String>`, drop explícito |
| Logging | Solo `provider`, `expires_at`, `scopes`, NUNCA el token |

### 4.5 Supabase

- **RLS SIEMPRE activado** en todas las tablas. Sin excepciones.
- **Policies** deben filtrar por `auth.uid()` y verificar `tenant_id` de la sesión.
- **JWT verification**: Verificar `exp`, `iss`, `aud` en el cliente. No confiar solo en Supabase.
- **Anon key**: Público, incluirlo en el cliente está OK. Pero NO el service role key.
- **Edge Functions**: Para operaciones privilegiadas (admin, cross-tenant). Validar JWT internamente.
- **Rate limiting**: Configurar en Supabase Dashboard o via middleware.
- **Postgrest config**: Deshabilitar esquemas innecesarios en el API expose.

### 4.6 Integraciones de IA

- **Proxy via Supabase Edge Function**: El cliente NO debe llamar directamente a OpenAI/Claude. El Edge Function:
  1. Valida JWT del usuario.
  2. Verifica rate limits y presupuesto.
  3. Redacta PII del prompt.
  4. Llama a la API de IA.
  5. Loguea metadata (tokens, costo).
  6. Retorna respuesta al cliente.
- **Si se llama directo** (offline mode): API key obtenida de Keychain, rate limits en cliente, redacción local.
- **Prompt injection defense**: System prompt fijo + sanitización de input + output validation.
- **Data retention**: Verificar que las APIs están configuradas con data retention = 0 (zero data retention en OpenAI).

### 4.7 Google Drive Backup

- **Scope**: `drive.file` únicamente. Verificar en Google Cloud Console.
- **Link sharing**: NUNCA crear links compartidos automáticamente. Archivos son `private` por defecto.
- **Exfiltración por links**: Monitorear si algún archivo de backup tiene permisos public. Alertar.
- **Quota**: Pre-check antes de upload. Si cuota < 10%, alertar y pausar backups.
- **Encriptado**: Subir archivos `.enc`. Google Drive no puede leer el contenido.
- **Metadata en Drive**: Solo nombre genérico + UUID. NO incluir metadata de negocio en propiedades del archivo de Drive.

---

## 5. Plan de Pruebas de Seguridad

### 5.1 SAST / DAST / Dependency Scanning

| Herramienta | Qué detecta | Cuándo |
|---|---|---|
| `cargo audit` | Vulnerabilidades en crates | Cada commit (CI) |
| `cargo clippy` | Code smells, unsafe patterns | Cada commit (CI) |
| `cargo deny` | Licencias, advisories, duplicados | Cada commit (CI) |
| `npm audit` | Vulnerabilidades en npm packages | Cada commit (CI) |
| `eslint-plugin-security` | Patrones inseguros en JS/TS | Cada commit (CI) |
| Semgrep (SAST) | SQL injection, XSS, path traversal | Semanal + PRs |
| OWASP ZAP (DAST) | Vulnerabilidades en endpoints HTTP | Pre-release |
| Snyk / Socket.dev | Supply chain analysis | Semanal |
| Trivy | Container/binary scanning | Pre-release |

### 5.2 Pruebas Manuales

| Test | Procedimiento | Resultado esperado |
|---|---|---|
| OAuth token theft | Interceptar callback con proxy → replay code | PKCE previene replay |
| MITM en updates | Proxy entre app y update server | Cert pinning rechaza |
| Downgrade attack | Modificar manifest para versión anterior | App rechaza |
| DLL hijacking | Colocar DLL maliciosa en app dir (Windows) | No se carga |
| Path traversal | Crear archivo con nombre `../../etc/passwd` | Rechazado |
| Symlink attack | Symlink en data dir apuntando fuera | Rechazado |
| Token en logs | Activar debug mode, buscar tokens en logs | Redactados |
| XSS en WebView | Inyectar `<script>` en nombre de archivo | CSP bloquea |
| SQLite injection | Nombre de archivo con SQL | Parameterized query previene |
| Session hijacking | Copiar SQLite de metadata a otra máquina | Sin Keychain/DPAPI, tokens inutilizables |
| Local priv escalation | Crear archivo SUID en data dir (macOS/Linux) | Permisos de directorio lo previenen |
| Force-kill during write | Kill app durante cifrado de archivo | Archivo temp, no corrupto. Cleanup al reiniciar |

### 5.3 Red Team Scenarios

**Escenario 1: Laptop Robada**
1. Atacante obtiene laptop con sesión de OS abierta.
2. Intenta extraer tokens de Keychain (requiere password de OS o biometrics si configurado).
3. Intenta copiar archivos `.enc` → inútiles sin master key.
4. Intenta acceder a SQLite → metadata visible, pero archivos cifrados.
5. Si hay passphrase configurada → ni siquiera con Keychain puede descifrar.
6. **Mitigación adicional**: Remote wipe via admin panel → marcar device como revocado → al conectar revoca todos los tokens.

**Escenario 2: Usuario Interno Malicioso**
1. Usuario legítimo con acceso a su tenant.
2. Intenta acceder a datos de otro tenant → RLS lo bloquea.
3. Intenta enviar archivos confidenciales a IA → clasificación de datos lo bloquea (si marcado confidencial).
4. Intenta exfiltrar archivos masivamente vía Google Drive → rate limiter + alertas por volumen inusual.
5. Intenta escalar privilegios → el JWT solo tiene claims de su rol. Edge Functions validan.
6. **Mitigación adicional**: Audit log de TODAS las acciones. Alertas por comportamiento anómalo.

**Escenario 3: Malware Local**
1. Malware tiene acceso de lectura al filesystem del usuario.
2. Lee archivos `.enc` → cifrados, inútiles.
3. Intenta leer Keychain → requiere aprobación del usuario (popup en macOS) o password.
4. Intenta inyectar DLL → hardening de DLL search order lo previene.
5. Intenta interceptar IPC de Tauri → IPC es in-process, no basado en red.
6. Keylogger captura passphrase → **riesgo residual**. Mitigación: 2FA para operaciones críticas.

**Escenario 4: Insider (Desarrollador Malicioso)**
1. Introduce backdoor en código → code review + firma dual mitiga.
2. Incluye service role key en un commit → CI grep check lo detecta.
3. Modifica CI para exfiltrar secrets → CODEOWNERS para `.github/workflows/`, protección de branch rules.
4. **Mitigación**: Branch protection, required reviews, signed commits, audit log de CI.

---

## 6. Políticas

### 6.1 Logging

```
POLÍTICA: LOGGING SIN SECRETOS

- NUNCA loguear: tokens, API keys, passwords, PII (cédulas, emails si no es necesario).
- SIEMPRE redactar automáticamente con regex patterns (ver MEDIUM-03).
- Formato: structured JSON (timestamp, level, module, message, correlation_id).
- Retención: 30 días local, 90 días si se exportan a sistema centralizado.
- Rotación: Max 50 MB por archivo, max 10 archivos.
- Modo diagnóstico: Activa tracing detallado pero con redacción REFORZADA.
- Acceso a logs: Solo el usuario local y admins con permiso explícito.
```

Ejemplo de log entry:
```json
{
  "ts": "2026-02-08T14:30:00.123Z",
  "level": "INFO",
  "module": "sync_engine",
  "msg": "File upload to Drive completed",
  "correlation_id": "abc-123",
  "file_id": "uuid-456",
  "drive_file_id": "drive-789",
  "size_bytes": 1048576,
  "duration_ms": 3200,
  "tenant_id": "tenant-001"
}
```

### 6.2 Permisos Mínimos

| Recurso | Permiso | Justificación |
|---|---|---|
| Supabase | Anon key + user JWT | Solo acceso a datos del usuario autenticado |
| GitHub | `contents:read`, `issues:write`, `pull_requests:write` por repo instalado | Solo los repos que el admin autorizó |
| Google Drive | `drive.file` | Solo archivos creados por la app |
| Claude API | Per-request, sin persistencia | Cada llamada autenticada individualmente |
| OpenAI API | Per-request, sin persistencia | Idem |
| AION API | Bearer token con scope mínimo (definir con proveedor) | Solo acciones de negocio autorizadas |
| Filesystem | Solo `{app_data_dir}` | NO acceso arbitrario al filesystem |
| Network | Solo dominios allowlisted | CSP + firewall rules en Tauri |

### 6.3 Gestión de Incidentes

```
INCIDENT RESPONSE PLAN

1. DETECCIÓN
   - Alerta de comportamiento anómalo (volumen inusual, acceso fuera de horario)
   - Reporte de usuario (token comprometido, laptop robada)
   - Alerta de seguridad de proveedor (GitHub, Google, Supabase)

2. CONTENCIÓN (< 15 minutos)
   - Revocar TODOS los tokens del dispositivo afectado via admin panel
   - Desautorizar device_id en Supabase
   - Si token de Supabase comprometido: rotar JWT secret (afecta a todos — último recurso)
   - Si GitHub App comprometida: revocar installation tokens
   - Si Google OAuth comprometido: revocar refresh token via Google API
   - Si API key de IA comprometida: rotar en dashboard del proveedor

3. ERRADICACIÓN
   - Identificar vector de entrada (análisis forense de logs)
   - Parchear vulnerabilidad
   - Push de actualización urgente (firmada)

4. RECUPERACIÓN
   - Re-autenticar usuarios afectados
   - Verificar integridad de archivos cifrados (checksums)
   - Restaurar desde backup de Drive si necesario

5. POST-MORTEM
   - Documentar timeline
   - Actualizar threat model
   - Implementar controles adicionales
```

**Kill Switch**: Endpoint en Supabase que la app consulta al arrancar. Si `kill_switch = true`, la app muestra mensaje y se desactiva. Para emergencias donde hay una vulnerabilidad activa y no se puede parchear inmediatamente.

### 6.4 Clasificación de Datos — Qué NO Enviar a IA

```
DATOS PROHIBIDOS PARA ENVÍO A GPT/CLAUDE:

- NUNCA: Tokens de acceso, API keys, passwords, secretos de cualquier tipo
- NUNCA: Cédulas de ciudadanía / números de identificación personal
- NUNCA: Archivos marcados como "confidencial" o "restringido"
- NUNCA: Contratos completos sin consentimiento explícito del usuario
- NUNCA: Datos financieros (cuentas bancarias, tarjetas)
- NUNCA: Datos de salud (exámenes médicos de conductores)
- NUNCA: Archivos de más de 5000 tokens sin aprobación

DATOS PERMITIDOS (con consentimiento):
- Resúmenes de documentos (truncados, anonimizados)
- Preguntas genéricas sobre procedimientos
- Código fuente (si el usuario lo solicita)
- Metadata de archivos (nombre, tipo, tamaño — sin PII)
```

---

## Go/No-Go Checklist para Release

| # | Control | Estado | Responsable |
|---|---|---|---|
| 1 | Binarios firmados y notarizados | ☐ | Release Engineer |
| 2 | Auto-updater verificación de firma funcional | ☐ | Security Lead |
| 3 | `service_role_key` ausente del binario | ☐ | Security Lead |
| 4 | Cifrado AES-256-GCM verificado en archivos locales | ☐ | Security Lead |
| 5 | OAuth PKCE implementado en todos los flujos | ☐ | Dev Lead |
| 6 | CSP restrictivo verificado | ☐ | Frontend Lead |
| 7 | Rate limiting en IA configurado y testeado | ☐ | Backend Lead |
| 8 | Google Drive scope = `drive.file` verificado | ☐ | Security Lead |
| 9 | Logs sin secretos verificados | ☐ | QA |
| 10 | Path traversal tests pasados | ☐ | QA |
| 11 | DLL hijacking tests pasados (Windows) | ☐ | QA |
| 12 | `cargo audit` + `npm audit` = 0 critical | ☐ | CI |
| 13 | Penetration test completado | ☐ | External Auditor |
| 14 | Session timeout funcional | ☐ | QA |
| 15 | Kill switch funcional | ☐ | Ops |
| 16 | Incident response plan documentado | ☐ | Security Lead |
| 17 | Data classification enforced en IA calls | ☐ | Dev Lead |
| 18 | Backup/restore de archivos verificado | ☐ | QA |
| 19 | Multi-tenant isolation verificado | ☐ | Security Lead |
| 20 | SBOM generado y archivado | ☐ | Release Engineer |

**Regla**: Si CUALQUIER item Critical o High está ☐, el release es **NO-GO**.

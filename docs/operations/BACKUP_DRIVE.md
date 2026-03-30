# Respaldo en Google Drive — AION Defensa Predictiva S.A.S

> Arquitectura e implementacion del sistema de respaldo automatico de datos de la plataforma AION hacia Google Drive, incluyendo gestion de OAuth, estructura de carpetas, reintentos y politicas de retencion.

---

## 1. Vision General

El sistema de respaldo a Google Drive permite a las empresas de transporte almacenar copias de seguridad de sus datos criticos (vehiculos, conductores, documentos, preoperativas, FUEC, etc.) en su propia cuenta de Google Drive.

### Principios de diseno

- **Principio de minimo privilegio**: Solo se solicita el scope `drive.file` (acceso unicamente a archivos creados por la aplicacion).
- **Aislamiento por tenant**: Cada empresa tiene su propia carpeta de respaldos.
- **Backend-first**: La logica de respaldo se ejecuta en el servidor (Edge Function o Cloud Run), no en el navegador del cliente.
- **Idempotencia**: Los respaldos se pueden reintentar sin generar duplicados.

---

## 2. Arquitectura Recomendada: Backend (Supabase Edge Function)

### Flujo de respaldo

```
  Usuario                  Frontend (SPA)               Edge Function              Google Drive
    |                           |                             |                          |
    |  1. Click "Respaldar"     |                             |                          |
    |-------------------------->|                             |                          |
    |                           |  2. POST /backup-drive      |                          |
    |                           |---------------------------->|                          |
    |                           |                             |  3. Obtener token OAuth   |
    |                           |                             |  (refresh_token guardado) |
    |                           |                             |                          |
    |                           |                             |  4. Consultar datos       |
    |                           |                             |  de Supabase (service_role)|
    |                           |                             |                          |
    |                           |                             |  5. Crear carpeta         |
    |                           |                             |  AION/Backups/{tenant}/   |
    |                           |                             |------------------------->|
    |                           |                             |                          |
    |                           |                             |  6. Subir archivos        |
    |                           |                             |------------------------->|
    |                           |                             |                          |
    |                           |                             |  7. Registrar respaldo    |
    |                           |                             |  en tabla audit_backups   |
    |                           |                             |                          |
    |                           |  8. Respuesta (exito/error) |                          |
    |                           |<----------------------------|                          |
    |  9. Notificacion          |                             |                          |
    |<--------------------------|                             |                          |
```

### Ventajas del enfoque backend

- El `refresh_token` de Google **nunca** llega al navegador del usuario.
- Se puede usar la `service_role key` de Supabase para extraer datos completos.
- Control total sobre reintentos, timeouts y manejo de errores.
- Se puede programar via cron (Supabase `pg_cron` o cron externo).

---

## 3. Configuracion de OAuth con Google

### 3.1 Crear credenciales en Google Cloud Console

1. Ir a [Google Cloud Console](https://console.cloud.google.com/).
2. Crear un proyecto (o usar uno existente): `AION Defensa Predictiva`.
3. Habilitar la API: **Google Drive API**.
4. Ir a **Credenciales** → **Crear credenciales** → **ID de cliente OAuth 2.0**.
5. Tipo de aplicacion: **Aplicacion web**.
6. URIs de redireccion autorizados:
   - `https://<tu-dominio>/auth/google/callback`
   - `https://<tu-proyecto>.supabase.co/functions/v1/google-oauth-callback`
7. Guardar el `Client ID` y `Client Secret`.

### 3.2 Scope de OAuth

```
https://www.googleapis.com/auth/drive.file
```

**Importante**: Se usa `drive.file` y NO `drive` (acceso completo). El scope `drive.file` limita el acceso a:

- Archivos creados por la aplicacion.
- Archivos abiertos explicitamente por el usuario a traves de la aplicacion.

Esto significa que AION **nunca** podra ver ni modificar los archivos personales del usuario en Google Drive.

### 3.3 Almacenar tokens de forma segura

```bash
# Guardar credenciales como secretos de la Edge Function
supabase secrets set \
  GOOGLE_CLIENT_ID="tu-client-id.apps.googleusercontent.com" \
  GOOGLE_CLIENT_SECRET="tu-client-secret"
```

Los `refresh_token` de cada empresa se almacenan cifrados en la tabla `tenant_integrations`:

```sql
CREATE TABLE tenant_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) NOT NULL,
  provider TEXT NOT NULL DEFAULT 'google_drive',
  encrypted_refresh_token TEXT NOT NULL,
  scopes TEXT[] DEFAULT ARRAY['drive.file'],
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, provider)
);

-- RLS: solo el admin del tenant puede ver/modificar
ALTER TABLE tenant_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_admin_only" ON tenant_integrations
  USING (tenant_id = auth.jwt() ->> 'tenant_id' AND auth.jwt() ->> 'role' = 'admin');
```

---

## 4. Estructura de Carpetas en Google Drive

```
Mi Drive/
  AION/
    Backups/
      {nombre_empresa}/                    # Ej: "TransColombia SAS"
        2026-02-08/                         # Fecha del respaldo
          vehiculos.json                    # Datos de vehiculos
          conductores.json                  # Datos de conductores
          documentos.json                   # Metadata de documentos
          preoperativas.json                # Inspecciones preoperativas
          fuec.json                         # Formatos FUEC generados
          mantenimientos.json               # Historial de mantenimiento
          metadata.json                     # Info del respaldo (timestamp, version, checksums)
        2026-02-07/
          ...
        2026-02-06/
          ...
```

### Archivo metadata.json

Cada respaldo incluye un archivo `metadata.json` con informacion del respaldo:

```json
{
  "version": "1.0",
  "tenant_id": "uuid-de-la-empresa",
  "tenant_name": "TransColombia SAS",
  "timestamp": "2026-02-08T03:00:00.000Z",
  "timezone": "America/Bogota",
  "tables_included": [
    "vehiculos",
    "conductores",
    "documentos",
    "preoperativas",
    "fuec",
    "mantenimientos"
  ],
  "record_counts": {
    "vehiculos": 45,
    "conductores": 32,
    "documentos": 128,
    "preoperativas": 890,
    "fuec": 234,
    "mantenimientos": 67
  },
  "checksums": {
    "vehiculos.json": "sha256:abc123...",
    "conductores.json": "sha256:def456..."
  },
  "backup_duration_ms": 4523,
  "initiated_by": "admin@transcolombia.com"
}
```

---

## 5. Implementacion de la Edge Function

### 5.1 Estructura del archivo

```
supabase/functions/backup-drive/
  index.ts          # Punto de entrada
  google-auth.ts    # Manejo de tokens OAuth
  drive-client.ts   # Operaciones con Google Drive API
  data-export.ts    # Extraccion de datos de Supabase
```

### 5.2 Ejemplo: Punto de entrada (index.ts)

```typescript
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getAccessToken } from './google-auth.ts';
import { createFolderIfNotExists, uploadFile } from './drive-client.ts';
import { exportTenantData } from './data-export.ts';

serve(async (req) => {
  try {
    // 1. Autenticar al usuario
    const authHeader = req.headers.get('Authorization');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader?.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
    }

    // 2. Verificar rol admin
    const tenantId = user.user_metadata.tenant_id;
    const role = user.user_metadata.role;

    if (role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Solo administradores pueden crear respaldos' }),
        { status: 403 }
      );
    }

    // 3. Obtener access_token de Google
    const accessToken = await getAccessToken(supabase, tenantId);

    // 4. Exportar datos del tenant
    const exportedData = await exportTenantData(supabase, tenantId);

    // 5. Crear estructura de carpetas en Drive
    const fecha = new Date().toISOString().split('T')[0];
    const tenantName = user.user_metadata.empresa_nombre || tenantId;
    const folderId = await createFolderIfNotExists(
      accessToken,
      `AION/Backups/${tenantName}/${fecha}`
    );

    // 6. Subir archivos con reintentos
    const results = [];
    for (const [tabla, datos] of Object.entries(exportedData)) {
      const result = await uploadWithRetry(
        accessToken,
        folderId,
        `${tabla}.json`,
        JSON.stringify(datos, null, 2),
        3 // max reintentos
      );
      results.push({ tabla, success: result.success, fileId: result.fileId });
    }

    // 7. Registrar en audit_backups
    await supabase.from('audit_backups').insert({
      tenant_id: tenantId,
      initiated_by: user.id,
      destination: 'google_drive',
      status: 'success',
      details: results,
    });

    return new Response(JSON.stringify({ success: true, results }), { status: 200 });

  } catch (error) {
    console.error('Error en backup:', error);
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500 }
    );
  }
});
```

---

## 6. Alternativa: Enfoque Frontend-Only

En caso de no poder implementar el enfoque backend, existe una alternativa puramente frontend. Sin embargo, tiene **limitaciones importantes**.

### Flujo

1. El usuario inicia sesion con Google desde el navegador (OAuth popup).
2. La SPA obtiene un `access_token` de corta duracion.
3. La SPA descarga los datos de Supabase.
4. La SPA sube los archivos a Google Drive usando la API REST directamente.

### Implementacion

```typescript
// Autenticacion con Google (frontend)
async function autenticarConGoogle(): Promise<string> {
  // Usar google-auth-library o gapi para obtener access_token
  // con scope drive.file
  return accessToken;
}

// Subir archivo a Drive (frontend)
async function subirADrive(
  accessToken: string,
  nombreArchivo: string,
  contenido: string,
  folderId: string
) {
  const metadata = {
    name: nombreArchivo,
    parents: [folderId],
    mimeType: 'application/json',
  };

  const formData = new FormData();
  formData.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' })
  );
  formData.append(
    'file',
    new Blob([contenido], { type: 'application/json' })
  );

  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
    }
  );

  return response.json();
}
```

### Limitaciones del enfoque frontend

| Aspecto                    | Backend (recomendado)     | Frontend-only           |
| -------------------------- | ------------------------- | ----------------------- |
| Token de Google            | Servidor (seguro)         | Navegador (expuesto)    |
| Respaldos automaticos      | Si (via cron)             | No                      |
| Cantidad de datos          | Sin limite practico       | Limitado por memoria    |
| Service role key           | Disponible (server)       | No disponible           |
| Ejecucion en background    | Si                        | Solo si el tab esta abierto |
| Fiabilidad                 | Alta                      | Baja                    |

> **Recomendacion**: Usar el enfoque frontend-only unicamente como solucion temporal mientras se implementa el backend.

---

## 7. Logica de Reintentos (Retry Logic)

Todas las operaciones con Google Drive API deben implementar reintentos con backoff exponencial.

### Estrategia

```typescript
async function uploadWithRetry(
  accessToken: string,
  folderId: string,
  fileName: string,
  content: string,
  maxRetries: number = 3
): Promise<{ success: boolean; fileId?: string; error?: string }> {
  let lastError: Error | null = null;

  for (let intento = 0; intento < maxRetries; intento++) {
    try {
      const result = await subirArchivo(accessToken, folderId, fileName, content);
      return { success: true, fileId: result.id };
    } catch (error) {
      lastError = error as Error;

      // No reintentar errores de autenticacion (401) o permisos (403)
      if (error.status === 401 || error.status === 403) {
        break;
      }

      // Backoff exponencial: 1s, 2s, 4s, 8s...
      const delay = Math.pow(2, intento) * 1000;
      console.warn(
        `Reintento ${intento + 1}/${maxRetries} para ${fileName}. ` +
        `Esperando ${delay}ms. Error: ${error.message}`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  return { success: false, error: lastError?.message || 'Max reintentos alcanzados' };
}
```

### Codigos HTTP y comportamiento

| Codigo HTTP | Significado                    | Reintentar? |
| ----------- | ------------------------------ | ----------- |
| 200-299     | Exito                          | No          |
| 401         | Token expirado/invalido        | No (renovar token y reintentar una vez) |
| 403         | Sin permisos                   | No          |
| 404         | Carpeta no encontrada          | No (recrear carpeta) |
| 429         | Rate limit excedido            | Si (con backoff) |
| 500         | Error interno de Google        | Si          |
| 503         | Servicio no disponible         | Si          |

---

## 8. Politica de Retencion

### Configuracion recomendada

```json
{
  "retention_policy": {
    "daily_backups_keep_days": 30,
    "weekly_backups_keep_weeks": 12,
    "monthly_backups_keep_months": 12,
    "max_storage_per_tenant_gb": 10
  }
}
```

### Reglas

1. **Respaldos diarios**: Se conservan los ultimos 30 dias.
2. **Respaldos semanales**: Se conserva uno por semana de las ultimas 12 semanas (el del domingo).
3. **Respaldos mensuales**: Se conserva uno por mes de los ultimos 12 meses (el del dia 1).
4. **Limite de almacenamiento**: Si un tenant excede 10 GB, se eliminan los respaldos mas antiguos primero.

### Implementacion de limpieza

La limpieza se ejecuta como una Edge Function programada (o Cloud Run con cron):

```typescript
async function limpiarRespaldosAntiguos(
  accessToken: string,
  tenantFolderId: string,
  retentionDays: number = 30
) {
  const fechaLimite = new Date();
  fechaLimite.setDate(fechaLimite.getDate() - retentionDays);

  // Listar carpetas de respaldo del tenant
  const carpetas = await listarCarpetasDrive(accessToken, tenantFolderId);

  for (const carpeta of carpetas) {
    const fechaCarpeta = new Date(carpeta.name); // formato: YYYY-MM-DD
    if (fechaCarpeta < fechaLimite && !esRespaldoProtegido(fechaCarpeta)) {
      await eliminarCarpetaDrive(accessToken, carpeta.id);
      console.log(`Eliminada carpeta de respaldo: ${carpeta.name}`);
    }
  }
}

function esRespaldoProtegido(fecha: Date): boolean {
  // Proteger respaldos semanales (domingos) de las ultimas 12 semanas
  const hoy = new Date();
  const semanasDiferencia = Math.floor(
    (hoy.getTime() - fecha.getTime()) / (7 * 24 * 60 * 60 * 1000)
  );
  if (fecha.getDay() === 0 && semanasDiferencia <= 12) return true;

  // Proteger respaldos mensuales (dia 1) de los ultimos 12 meses
  const mesesDiferencia =
    (hoy.getFullYear() - fecha.getFullYear()) * 12 +
    (hoy.getMonth() - fecha.getMonth());
  if (fecha.getDate() === 1 && mesesDiferencia <= 12) return true;

  return false;
}
```

---

## 9. Manejo de Errores

### Errores comunes y acciones

| Error                                      | Causa probable                          | Accion                                     |
| ------------------------------------------ | --------------------------------------- | ------------------------------------------ |
| `invalid_grant`                            | Refresh token revocado por el usuario   | Solicitar nueva autorizacion OAuth          |
| `storageQuotaExceeded`                     | Google Drive del usuario esta lleno     | Notificar al admin, ejecutar limpieza      |
| `notFound` (carpeta padre)                 | Carpeta AION/Backups fue eliminada      | Recrear estructura de carpetas             |
| `rateLimitExceeded`                        | Demasiadas solicitudes por segundo      | Aplicar backoff exponencial                |
| `insufficientPermissions`                  | Scope incorrecto o permisos revocados   | Solicitar nueva autorizacion con scope correcto |
| Timeout de la Edge Function (> 150s)       | Demasiados datos para una sola ejecucion| Dividir en lotes (batch) por tabla          |

### Notificaciones

Cuando un respaldo falla, el sistema debe:

1. Registrar el error en la tabla `audit_backups` con status `failed`.
2. Enviar una notificacion al administrador del tenant (email o notificacion in-app).
3. Programar un reintento automatico en 1 hora (maximo 3 reintentos por dia).

```sql
-- Tabla para auditar respaldos
CREATE TABLE audit_backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) NOT NULL,
  initiated_by UUID REFERENCES auth.users(id),
  destination TEXT NOT NULL, -- 'google_drive', 'local', etc.
  status TEXT NOT NULL, -- 'pending', 'in_progress', 'success', 'failed'
  error_message TEXT,
  details JSONB,
  retry_count INTEGER DEFAULT 0,
  file_count INTEGER,
  total_size_bytes BIGINT,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE audit_backups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_members_read" ON audit_backups
  FOR SELECT USING (tenant_id = auth.jwt() ->> 'tenant_id');

CREATE POLICY "service_role_write" ON audit_backups
  FOR ALL USING (auth.role() = 'service_role');
```

---

## 10. Programacion Automatica de Respaldos

### Opcion A: pg_cron (dentro de Supabase)

```sql
-- Ejecutar respaldo diario a las 2:00 AM hora Colombia (UTC-5 = 7:00 UTC)
SELECT cron.schedule(
  'backup-diario',
  '0 7 * * *',
  $$
    SELECT net.http_post(
      url := 'https://<tu-proyecto>.supabase.co/functions/v1/backup-drive',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object('mode', 'scheduled')
    );
  $$
);
```

### Opcion B: Cron externo (Cloud Scheduler, GitHub Actions)

```yaml
# .github/workflows/backup-cron.yml
name: Respaldo diario a Google Drive
on:
  schedule:
    - cron: '0 7 * * *'  # 2:00 AM Colombia
jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - name: Invocar Edge Function de respaldo
        run: |
          curl -X POST \
            "${{ secrets.SUPABASE_URL }}/functions/v1/backup-drive" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            -H "Content-Type: application/json" \
            -d '{"mode": "scheduled"}'
```

---

*Documento interno — AION Defensa Predictiva S.A.S — Ultima actualizacion: 2026-02*

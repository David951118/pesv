# Almacenamiento Local (HDD) — AION Defensa Predictiva S.A.S

> Opciones para almacenar datos localmente desde la plataforma AION, incluyendo limitaciones de la version web y capacidades de la version de escritorio.

---

## 1. Contexto: Limitaciones de una SPA

AION es una **Single Page Application (SPA)** que se ejecuta dentro del navegador web. Por razones de seguridad, los navegadores modernos imponen restricciones estrictas sobre el acceso al sistema de archivos del usuario:

- **No hay acceso directo al disco duro** desde JavaScript en el navegador.
- El almacenamiento disponible es efimero (localStorage, sessionStorage, IndexedDB) y limitado en capacidad.
- La unica forma estandar de escribir un archivo en disco es mediante **descargas** iniciadas por el usuario.

Para persistencia de datos de la plataforma, el almacenamiento principal es **Supabase** (PostgreSQL + Supabase Storage). El almacenamiento local es complementario y se usa principalmente para:

- Exportar reportes y documentos.
- Crear respaldos offline.
- Almacenar archivos grandes que no se quieren subir a la nube.

---

## 2. Opcion A: Descargas y Exportaciones via Navegador

### Descripcion

La forma mas sencilla y compatible de guardar archivos en el HDD del usuario. La aplicacion genera el archivo en memoria y lo entrega al navegador como una descarga.

### Implementacion tipica

```typescript
// Ejemplo: exportar datos a CSV
function exportarCSV(datos: any[], nombreArchivo: string) {
  const csv = convertirACSV(datos);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = nombreArchivo;
  link.click();

  URL.revokeObjectURL(url);
}
```

### Para archivos persistentes: Supabase Storage

Los archivos que necesitan persistir (documentos de vehiculos, FUEC firmados, fotografias de preoperativas) se almacenan en **Supabase Storage** y se pueden descargar bajo demanda:

```typescript
// Descargar un archivo desde Supabase Storage
const { data } = await supabase.storage
  .from('documentos')
  .download('vehiculos/ABC123/soat_2026.pdf');

// Convertir a descarga del navegador
const url = URL.createObjectURL(data);
const link = document.createElement('a');
link.href = url;
link.download = 'soat_2026.pdf';
link.click();
```

### Ventajas

- Funciona en **todos** los navegadores modernos.
- No requiere permisos especiales.
- El usuario controla donde se guarda el archivo.

### Limitaciones

- Requiere interaccion manual del usuario para cada descarga.
- No se puede escribir en una ruta especifica del disco sin que el usuario la seleccione.
- No es viable para respaldos automaticos o sincronizacion continua.

---

## 3. Opcion B: File System Access API (Experimental)

### Descripcion

La [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API) permite a las aplicaciones web leer y escribir archivos directamente en el sistema de archivos del usuario, previa autorizacion.

### Compatibilidad

| Navegador        | Soporte          |
| ---------------- | ---------------- |
| Chrome 86+       | Si               |
| Edge 86+         | Si               |
| Opera 72+        | Si               |
| Firefox          | No               |
| Safari           | No               |

> **Advertencia**: Esta API es experimental y no esta disponible en todos los navegadores. No se recomienda como solucion principal.

### Implementacion tipica

```typescript
// Solicitar acceso a un directorio del sistema de archivos
async function seleccionarCarpetaRespaldo() {
  const dirHandle = await window.showDirectoryPicker({
    mode: 'readwrite',
    startIn: 'documents',
  });

  return dirHandle;
}

// Escribir un archivo en la carpeta seleccionada
async function escribirArchivo(
  dirHandle: FileSystemDirectoryHandle,
  nombre: string,
  contenido: string
) {
  const fileHandle = await dirHandle.getFileHandle(nombre, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(contenido);
  await writable.close();
}

// Ejemplo de uso
async function respaldarDatos() {
  const carpeta = await seleccionarCarpetaRespaldo();
  const datos = await obtenerDatosParaRespaldar();
  const json = JSON.stringify(datos, null, 2);

  await escribirArchivo(carpeta, `respaldo_aion_${Date.now()}.json`, json);
}
```

### Ventajas

- Permite acceso de lectura/escritura al sistema de archivos.
- El usuario autoriza el acceso una sola vez por sesion.
- Puede manejar directorios completos.

### Limitaciones

- **Solo funciona en Chrome y Edge**. No es una solucion universal.
- El usuario debe otorgar permiso explicitamente.
- Los permisos se pierden al cerrar el navegador (a menos que se use la API de permisos persistentes).
- Comportamiento inconsistente entre versiones de navegadores.

### Recomendacion

Usar esta opcion **unicamente** como mejora progresiva para usuarios de Chrome/Edge que necesiten exportaciones frecuentes. No depender de ella como flujo principal.

---

## 4. Opcion C: Aplicacion de Escritorio via Tauri (Recomendada)

### Descripcion

La ruta profesional para acceso completo al sistema de archivos. [Tauri](https://tauri.app/) permite empaquetar la SPA de AION como una aplicacion de escritorio nativa con un backend en Rust que tiene acceso total al sistema operativo.

### Arquitectura

```
+--------------------------------------------------+
|  Ventana de Escritorio (WebView)                  |
|                                                   |
|  +--------------------------------------------+  |
|  |  SPA de AION (React + TypeScript)           |  |
|  |  - Misma UI que la version web              |  |
|  |  - Llama a comandos Tauri para I/O          |  |
|  +--------------------------------------------+  |
|                                                   |
|  +--------------------------------------------+  |
|  |  Backend Rust (Tauri Core)                  |  |
|  |  - Acceso completo al filesystem            |  |
|  |  - Lectura/escritura sin restricciones      |  |
|  |  - Cifrado de archivos locales              |  |
|  |  - Respaldos automaticos programados        |  |
|  +--------------------------------------------+  |
+--------------------------------------------------+
```

### Ejemplo: Guardar respaldo en HDD

```rust
// Backend Rust — comando Tauri
#[tauri::command]
fn guardar_respaldo(ruta: String, datos: String) -> Result<(), String> {
    let ruta_completa = std::path::Path::new(&ruta);

    // Crear directorios intermedios si no existen
    if let Some(padre) = ruta_completa.parent() {
        std::fs::create_dir_all(padre).map_err(|e| e.to_string())?;
    }

    std::fs::write(ruta_completa, datos).map_err(|e| e.to_string())?;
    Ok(())
}
```

```typescript
// Frontend — invocar el comando Tauri
import { invoke } from '@tauri-apps/api/tauri';

async function respaldarEnDisco() {
  const datos = await obtenerDatosParaRespaldar();
  const ruta = `D:/AION/Respaldos/respaldo_${Date.now()}.json`;

  await invoke('guardar_respaldo', {
    ruta,
    datos: JSON.stringify(datos),
  });
}
```

### Capacidades de la version desktop

| Capacidad                           | Web (SPA) | Desktop (Tauri) |
| ----------------------------------- | --------- | --------------- |
| Descargas manuales                  | Si        | Si              |
| Escritura directa en disco          | No        | Si              |
| Lectura de archivos sin prompt      | No        | Si              |
| Respaldos automaticos programados   | No        | Si              |
| Cifrado AES-256 local               | Limitado  | Si              |
| Monitoreo de directorio (watcher)   | No        | Si              |
| Acceso a drives USB/externos        | No        | Si              |

### Ventajas

- **Acceso completo al filesystem** sin restricciones del navegador.
- **Cifrado nativo** con librerias de Rust (ring, aes-gcm).
- **Respaldos automaticos** programados via tareas en segundo plano.
- **Sin dependencia de internet** para operaciones locales.
- La UI es identica a la version web.

### Limitaciones

- Requiere que el usuario instale la aplicacion.
- Mayor complejidad de desarrollo (Rust + TypeScript).
- Requiere actualizaciones de la aplicacion (se puede automatizar con Tauri Updater).

---

## 5. Resumen de Recomendaciones por Escenario

| Escenario                                          | Opcion recomendada      |
| -------------------------------------------------- | ----------------------- |
| Exportar reportes PDF/CSV ocasionalmente           | **Opcion A** (descarga) |
| Guardar documentos de vehiculos en la nube         | **Supabase Storage**    |
| Exportaciones frecuentes en Chrome/Edge            | **Opcion B** (FSAA)     |
| Respaldos automaticos en HDD                       | **Opcion C** (Tauri)    |
| Sincronizacion offline de datos                    | **Opcion C** (Tauri)    |
| Cifrado local de archivos sensibles                | **Opcion C** (Tauri)    |
| Almacenamiento en USB/disco externo                | **Opcion C** (Tauri)    |

---

## 6. Nota sobre Respaldos en HDD

Para un verdadero sistema de respaldo automatico en disco duro local — que guarde archivos periodicamente, los cifre y los organice por fecha — la **opcion profesional y recomendada es la aplicacion de escritorio con Tauri**.

La version web puede complementar con:

1. Exportaciones manuales a CSV/PDF/JSON.
2. Almacenamiento en Supabase Storage como fuente principal.
3. Integracion con Google Drive para respaldos en la nube (ver `docs/operations/BACKUP_DRIVE.md`).

Pero **solo la version de escritorio** puede ofrecer:

- Escritura directa y silenciosa en el disco duro.
- Respaldos programados sin intervencion del usuario.
- Cifrado AES-256-GCM en reposo.
- Monitoreo de integridad de archivos.

---

*Documento interno — AION Defensa Predictiva S.A.S — Ultima actualizacion: 2026-02*

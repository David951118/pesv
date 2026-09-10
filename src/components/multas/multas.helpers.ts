import { getPresignedUrl } from "@/services/apirndc";
import type {
  ApiRndcArchivo,
  ApiRndcInmovilizacionEstado,
  ApiRndcMulta,
  ApiRndcMultaEstado,
  ApiRndcMultaResponsable,
} from "@/services/apirndc/apirndc.types";
import { uploadFileToS3, type UploadProgress } from "@/lib/uploadToS3";

export { formatCOP, formatFecha, formatFechaHora } from "@/components/mantenimiento/mantenimiento.helpers";

// ─── Estados de la multa (pago) ───

export const MULTA_ESTADOS: ApiRndcMultaEstado[] = ["PENDIENTE", "PAGADA", "IMPUGNADA", "ANULADA"];

export const MULTA_ESTADO_LABELS: Record<ApiRndcMultaEstado, string> = {
  PENDIENTE: "Pendiente",
  PAGADA: "Pagada",
  IMPUGNADA: "Impugnada",
  ANULADA: "Anulada",
};

export const MULTA_ESTADO_BADGE_CLASS: Record<ApiRndcMultaEstado, string> = {
  PENDIENTE: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  PAGADA: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  IMPUGNADA: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
  ANULADA: "bg-muted text-muted-foreground border-border",
};

// ─── Estados de la inmovilización ───

export const INMOVILIZACION_ESTADO_LABELS: Record<ApiRndcInmovilizacionEstado, string> = {
  NO_APLICA: "Sin inmovilización",
  INMOVILIZADO: "Inmovilizado",
  CORRECCION_SUBIDA: "Corrección subida",
  LEVANTADA: "Levantada",
};

/** Texto largo para banners / detalle */
export const INMOVILIZACION_ESTADO_DESCRIPCION: Record<ApiRndcInmovilizacionEstado, string> = {
  NO_APLICA: "El vehículo no fue inmovilizado",
  INMOVILIZADO: "Esperando corrección",
  CORRECCION_SUBIDA: "Corrección subida, pendiente de validar",
  LEVANTADA: "Inmovilización levantada, vehículo en operación",
};

export const INMOVILIZACION_ESTADO_BADGE_CLASS: Record<ApiRndcInmovilizacionEstado, string> = {
  NO_APLICA: "bg-muted text-muted-foreground border-border",
  INMOVILIZADO: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
  CORRECCION_SUBIDA: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  LEVANTADA: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
};

/** true si la inmovilización mantiene al vehículo fuera de operación */
export function inmovilizacionVigente(multa: Pick<ApiRndcMulta, "inmovilizacion" | "estado">): boolean {
  return (
    !!multa.inmovilizacion?.aplica &&
    ["INMOVILIZADO", "CORRECCION_SUBIDA"].includes(multa.inmovilizacion.estado) &&
    multa.estado !== "ANULADA"
  );
}

// ─── Responsable del pago ───

export const MULTA_RESPONSABLES: ApiRndcMultaResponsable[] = ["EMPRESA", "CONDUCTOR", "PROPIETARIO"];

export const MULTA_RESPONSABLE_LABELS: Record<ApiRndcMultaResponsable, string> = {
  EMPRESA: "Empresa",
  CONDUCTOR: "Conductor",
  PROPIETARIO: "Propietario",
};

// ─── Autoridades frecuentes (el campo acepta texto libre) ───

export const AUTORIDADES_SUGERIDAS = [
  "Secretaría de Movilidad",
  "Policía de Tránsito",
  "Agente de tránsito municipal",
  "Fotodetección / cámara",
  "Superintendencia de Transporte",
];

export const TIPOS_ID_CONDUCTOR = ["CC", "CE", "PASAPORTE", "PEP"];

// ─── Historial ───

export const HISTORIAL_ACCION_LABELS: Record<string, string> = {
  REGISTRADA: "Multa registrada",
  ACTUALIZADA: "Datos actualizados",
  INMOVILIZADO: "Vehículo inmovilizado",
  CORRECCION_SUBIDA: "Corrección subida",
  INMOVILIZACION_LEVANTADA: "Inmovilización levantada",
  PAGADA: "Pago registrado",
  IMPUGNADA: "Multa impugnada",
  ANULADA: "Multa anulada",
  FOTO_AGREGADA: "Fotos agregadas",
  FOTO_ELIMINADA: "Foto eliminada",
  ELIMINADA: "Enviada a la papelera",
  RESTAURADA: "Restaurada de la papelera",
};

export function labelAccionHistorial(accion: string): string {
  return HISTORIAL_ACCION_LABELS[accion] || accion.replace(/_/g, " ");
}

// ─── Conductor ───

/** Nombre del conductor multado (registrado o no) */
export function getConductorMultaNombre(multa: Pick<ApiRndcMulta, "conductor" | "conductorNoRegistrado">): string {
  if (multa.conductor) {
    const n = [multa.conductor.nombres, multa.conductor.apellidos].filter(Boolean).join(" ").trim();
    return n || multa.conductor.identificacion || "—";
  }
  const nr = multa.conductorNoRegistrado;
  if (nr) {
    const n = [nr.nombres, nr.apellidos].filter(Boolean).join(" ").trim();
    return n || nr.identificacion || "—";
  }
  return "—";
}

export function getConductorMultaIdentificacion(multa: Pick<ApiRndcMulta, "conductor" | "conductorNoRegistrado">): string {
  if (multa.conductor) {
    return [multa.conductor.tipoId, multa.conductor.identificacion].filter(Boolean).join(" ");
  }
  const nr = multa.conductorNoRegistrado;
  if (nr) return [nr.tipoId, nr.identificacion].filter(Boolean).join(" ");
  return "";
}

/** true si la multa tiene algún dato de conductor (registrado o suelto) */
export function tieneConductor(multa: Pick<ApiRndcMulta, "conductor" | "conductorNoRegistrado">): boolean {
  if (multa.conductor) return true;
  const nr = multa.conductorNoRegistrado;
  return !!(nr && (nr.nombres || nr.apellidos || nr.identificacion));
}

// ─── Archivos (fotos, evidencias, comprobante) ───

export const MULTA_ARCHIVO_TIPOS_PERMITIDOS = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];
export const MULTA_ARCHIVO_MAX_BYTES = 10 * 1024 * 1024;
export const MULTA_ARCHIVO_ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp";

export const MULTA_S3_FOLDER_FOTOS = "multas";
export const MULTA_S3_FOLDER_CORRECCIONES = "multas/correcciones";
export const MULTA_S3_FOLDER_COMPROBANTES = "multas/comprobantes";

export function validarArchivoMulta(file: File): string | null {
  if (!MULTA_ARCHIVO_TIPOS_PERMITIDOS.includes(file.type)) {
    return `${file.name}: debe ser PDF o imagen (JPG, PNG o WebP)`;
  }
  if (file.size > MULTA_ARCHIVO_MAX_BYTES) {
    return `${file.name}: no puede superar 10 MB`;
  }
  return null;
}

/**
 * Sube un archivo directo a S3 con presigned URL y devuelve los metadatos que
 * espera el backend (url, key, nombre, mimeType, tamano).
 */
export async function subirArchivoMulta(
  file: File,
  folder: string = MULTA_S3_FOLDER_FOTOS,
  onProgress?: (p: UploadProgress) => void,
): Promise<ApiRndcArchivo> {
  const error = validarArchivoMulta(file);
  if (error) throw new Error(error);
  const res = await getPresignedUrl({
    fileName: file.name,
    mimeType: file.type,
    folder,
  });
  const { uploadUrl, key, publicUrl } = res.data;
  await uploadFileToS3(uploadUrl, file, onProgress);
  return {
    url: publicUrl,
    key,
    nombre: file.name,
    mimeType: file.type,
    tamano: file.size,
  };
}

/**
 * Sube varios archivos en secuencia, reportando el progreso global (0-100).
 */
export async function subirArchivosMulta(
  files: File[],
  folder: string,
  onProgress?: (percent: number) => void,
): Promise<ApiRndcArchivo[]> {
  const subidos: ApiRndcArchivo[] = [];
  for (let i = 0; i < files.length; i++) {
    const archivo = await subirArchivoMulta(files[i], folder, (p) => {
      if (onProgress) {
        onProgress(Math.round(((i + p.percent / 100) / files.length) * 100));
      }
    });
    subidos.push(archivo);
  }
  if (onProgress) onProgress(100);
  return subidos;
}

export function esImagen(archivo: Pick<ApiRndcArchivo, "mimeType" | "url">): boolean {
  if (archivo.mimeType) return archivo.mimeType.startsWith("image/");
  return /\.(jpe?g|png|webp|gif)$/i.test(archivo.url || "");
}

export function formatBytes(bytes?: number | null): string {
  if (bytes === undefined || bytes === null || Number.isNaN(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Fechas para inputs ───

/** ISO → valor para <input type="datetime-local"> (hora local) */
export function toDatetimeLocal(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** ISO → valor para <input type="date"> */
export function toDateInput(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Valor de datetime-local / date → ISO (o undefined si vacío) */
export function inputToISO(value: string): string | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

import { useRef } from "react";
import { toast } from "sonner";
import { ExternalLink, FileText, Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { getPresignedUrl } from "@/services/apirndc";
import type { ApiRndcOtFactura } from "@/services/apirndc/apirndc.types";
import { uploadFileToS3, type UploadProgress } from "@/lib/uploadToS3";
import { formatFechaHora } from "./mantenimiento.helpers";

/**
 * Factura opcional de una orden de trabajo.
 * El archivo se sube directo a S3 (carpeta mantenimiento/facturas) con una
 * presigned URL y al backend solo viajan los metadatos (url, key, nombre...).
 */

export const FACTURA_TIPOS_PERMITIDOS = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];
export const FACTURA_MAX_BYTES = 10 * 1024 * 1024;
export const FACTURA_ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp";
const FACTURA_S3_FOLDER = "mantenimiento/facturas";

export function validarArchivoFactura(file: File): string | null {
  if (!FACTURA_TIPOS_PERMITIDOS.includes(file.type)) {
    return "La factura debe ser un PDF o una imagen (JPG, PNG o WebP)";
  }
  if (file.size > FACTURA_MAX_BYTES) {
    return "La factura no puede superar 10 MB";
  }
  return null;
}

export async function subirFacturaOt(
  file: File,
  onProgress?: (p: UploadProgress) => void,
): Promise<ApiRndcOtFactura> {
  const error = validarArchivoFactura(file);
  if (error) throw new Error(error);
  const res = await getPresignedUrl({
    fileName: file.name,
    mimeType: file.type,
    folder: FACTURA_S3_FOLDER,
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

export function formatBytes(bytes?: number | null): string {
  if (bytes === undefined || bytes === null || Number.isNaN(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface FacturaOtFieldProps {
  file: File | null;
  onChange: (file: File | null) => void;
  disabled?: boolean;
  /** Porcentaje de subida en curso; null/undefined cuando no hay subida */
  progress?: number | null;
  label?: string | null;
  hint?: string;
}

/** Selector de archivo para la factura (crear / cerrar / reemplazar) */
export function FacturaOtField({
  file,
  onChange,
  disabled,
  progress,
  label = "Factura (opcional)",
  hint,
}: FacturaOtFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const subiendo = typeof progress === "number";

  return (
    <div className="space-y-2">
      {label && <Label>{label}</Label>}
      <input
        ref={inputRef}
        type="file"
        accept={FACTURA_ACCEPT}
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          const seleccionado = e.target.files?.[0] ?? null;
          e.target.value = "";
          if (!seleccionado) return;
          const error = validarArchivoFactura(seleccionado);
          if (error) {
            toast.error(error);
            return;
          }
          onChange(seleccionado);
        }}
      />
      {file ? (
        <div className="flex items-center gap-2 border rounded-lg px-3 py-2 bg-muted/20 text-sm">
          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate flex-1" title={file.name}>{file.name}</span>
          <span className="text-xs text-muted-foreground shrink-0">{formatBytes(file.size)}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            disabled={disabled || subiendo}
            onClick={() => onChange(null)}
            title="Quitar archivo"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          <Paperclip className="h-4 w-4 mr-1" />
          Adjuntar factura
        </Button>
      )}
      {subiendo && (
        <div className="space-y-1">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground">Subiendo factura... {progress}%</p>
        </div>
      )}
      <p className="text-xs text-muted-foreground">{hint ?? "PDF o imagen, máximo 10 MB."}</p>
    </div>
  );
}

/** Tarjeta de una factura ya adjunta, con enlace para verla o descargarla */
export function FacturaOtResumen({
  factura,
  children,
}: {
  factura: ApiRndcOtFactura;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 border rounded-lg px-3 py-2.5 bg-muted/20 text-sm">
      <FileText className="h-5 w-5 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="font-medium truncate" title={factura.nombre || factura.key}>
          {factura.nombre || "Factura"}
        </p>
        <p className="text-xs text-muted-foreground">
          {[
            formatBytes(factura.tamano),
            factura.fecha ? `subida el ${formatFechaHora(factura.fecha)}` : null,
            factura.subidoPor ? `por ${factura.subidoPor}` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      <Button asChild type="button" variant="outline" size="sm">
        <a href={factura.url} target="_blank" rel="noopener noreferrer">
          <ExternalLink className="h-4 w-4 mr-1" />
          Ver
        </a>
      </Button>
      {children}
    </div>
  );
}

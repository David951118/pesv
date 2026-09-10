import { useRef } from "react";
import { toast } from "sonner";
import { ExternalLink, FileText, Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import type { ApiRndcArchivo } from "@/services/apirndc/apirndc.types";
import {
  MULTA_ARCHIVO_ACCEPT,
  esImagen,
  formatBytes,
  validarArchivoMulta,
} from "./multas.helpers";

interface ArchivosMultaFieldProps {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
  /** Porcentaje de subida en curso; null/undefined cuando no hay subida */
  progress?: number | null;
  label?: string | null;
  hint?: string;
  multiple?: boolean;
  buttonText?: string;
}

/**
 * Selector de uno o varios archivos (PDF / imagen) que se suben a S3 al
 * guardar. Muestra previsualización de imágenes y progreso de subida.
 */
export function ArchivosMultaField({
  files,
  onChange,
  disabled,
  progress,
  label = "Fotos / evidencia (opcional)",
  hint,
  multiple = true,
  buttonText = "Adjuntar archivos",
}: ArchivosMultaFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const subiendo = typeof progress === "number";

  return (
    <div className="space-y-2">
      {label && <Label>{label}</Label>}
      <input
        ref={inputRef}
        type="file"
        accept={MULTA_ARCHIVO_ACCEPT}
        multiple={multiple}
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          const seleccionados = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (!seleccionados.length) return;
          const validos: File[] = [];
          for (const f of seleccionados) {
            const error = validarArchivoMulta(f);
            if (error) {
              toast.error(error);
              continue;
            }
            validos.push(f);
          }
          if (!validos.length) return;
          onChange(multiple ? [...files, ...validos] : [validos[0]]);
        }}
      />

      {files.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {files.map((file, idx) => {
            const isImg = file.type.startsWith("image/");
            const previewUrl = isImg ? URL.createObjectURL(file) : null;
            return (
              <div
                key={`${file.name}-${idx}`}
                className="relative border rounded-lg overflow-hidden bg-muted/20"
              >
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt={file.name}
                    className="w-full h-24 object-cover"
                    onLoad={() => URL.revokeObjectURL(previewUrl)}
                  />
                ) : (
                  <div className="w-full h-24 flex items-center justify-center">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                <div className="px-2 py-1 text-xs">
                  <p className="truncate" title={file.name}>{file.name}</p>
                  <p className="text-muted-foreground">{formatBytes(file.size)}</p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="absolute top-1 right-1 h-6 w-6"
                  disabled={disabled || subiendo}
                  onClick={() => onChange(files.filter((_, i) => i !== idx))}
                  title="Quitar archivo"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {(multiple || files.length === 0) && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || subiendo}
          onClick={() => inputRef.current?.click()}
        >
          <Paperclip className="h-4 w-4 mr-1" />
          {buttonText}
        </Button>
      )}

      {subiendo && (
        <div className="space-y-1">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground">Subiendo archivos... {progress}%</p>
        </div>
      )}
      <p className="text-xs text-muted-foreground">{hint ?? "PDF o imagen (JPG, PNG, WebP), máximo 10 MB por archivo."}</p>
    </div>
  );
}

interface GaleriaArchivosProps {
  archivos: ApiRndcArchivo[];
  onEliminar?: (archivo: ApiRndcArchivo) => void;
  eliminando?: string | null;
  emptyText?: string;
}

/** Galería de archivos ya subidos (miniaturas clicables, PDFs como enlace) */
export function GaleriaArchivos({ archivos, onEliminar, eliminando, emptyText }: GaleriaArchivosProps) {
  if (!archivos.length) {
    return <p className="text-sm text-muted-foreground">{emptyText ?? "Sin archivos adjuntos"}</p>;
  }
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
      {archivos.map((a, idx) => {
        const key = a._id || `${a.key}-${idx}`;
        const img = esImagen(a);
        return (
          <div key={key} className="relative border rounded-lg overflow-hidden bg-muted/20 group">
            <a href={a.url} target="_blank" rel="noopener noreferrer" className="block" title={a.nombre || a.key}>
              {img ? (
                <img src={a.url} alt={a.nombre || "Archivo"} className="w-full h-28 object-cover" />
              ) : (
                <div className="w-full h-28 flex flex-col items-center justify-center gap-1 text-muted-foreground">
                  <FileText className="h-8 w-8" />
                  <span className="text-[10px] uppercase">{a.mimeType === "application/pdf" ? "PDF" : "Archivo"}</span>
                </div>
              )}
              <div className="px-2 py-1 text-xs flex items-center gap-1">
                <span className="truncate flex-1">{a.nombre || "Archivo"}</span>
                <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
              </div>
            </a>
            {onEliminar && (
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="absolute top-1 right-1 h-6 w-6 opacity-80 hover:opacity-100"
                disabled={!!eliminando}
                onClick={() => onEliminar(a)}
                title="Quitar archivo"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}

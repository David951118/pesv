import { Download, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ApiRndcDocumento } from "@/services/apirndc/apirndc.types";

function getEstadoBadgeVariant(estado: string): "default" | "secondary" | "outline" | "destructive" {
  switch (estado) {
    case "VIGENTE": return "default";
    case "POR_VENCER": return "secondary";
    case "VENCIDO": return "destructive";
    case "HISTORICO": return "outline";
    case "RECHAZADO": return "destructive";
    default: return "secondary";
  }
}

function formatDate(date?: string) {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" });
}

function formatBytes(bytes?: number) {
  if (!bytes) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageMime(mime?: string) {
  return mime?.startsWith("image/");
}

interface DocumentoDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documento: ApiRndcDocumento | null;
}

export function DocumentoDetailDialog({ open, onOpenChange, documento }: DocumentoDetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl w-[95vw]">
        {documento ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                Detalle del Documento
                <Badge variant={getEstadoBadgeVariant(documento.estado)}>
                  {documento.estado?.replace("_", " ")}
                </Badge>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3">
              {[
                { label: "Tipo Documento", value: documento.tipoDocumento?.replace(/_/g, " ") },
                { label: "Entidad", value: documento.entidadModelo },
                { label: "ID Entidad", value: typeof documento.entidadId === "object" ? (documento.entidadId as Record<string, string>)._id : documento.entidadId },
                { label: "Numero", value: documento.numero || "-" },
                { label: "Entidad Emisora", value: documento.entidadEmisora || "-" },
                { label: "Fecha Expedicion", value: formatDate(documento.fechaExpedicion) },
                { label: "Fecha Vencimiento", value: formatDate(documento.fechaVencimiento) },
                { label: "Observaciones", value: documento.observaciones || "-" },
                { label: "Subido Por", value: documento.subidoPor || "-" },
                { label: "Creado", value: formatDate(documento.createdAt) },
                { label: "Actualizado", value: formatDate(documento.updatedAt) },
              ].map((f) => (
                <div key={f.label} className="flex justify-between items-start py-2 border-b border-border last:border-0">
                  <span className="text-sm text-muted-foreground">{f.label}</span>
                  <span className="text-sm font-medium text-foreground text-right max-w-[60%]">{f.value}</span>
                </div>
              ))}

              {documento.archivo?.url && (
                <div className="pt-3 border-t">
                  <p className="text-sm text-muted-foreground mb-2">Archivo adjunto</p>

                  {isImageMime(documento.archivo.mimeType) && (
                    <div className="mb-3 rounded-lg overflow-hidden border">
                      <img
                        src={documento.archivo.url}
                        alt={documento.archivo.nombreOriginal || "Documento"}
                        className="w-full max-h-[400px] object-contain bg-muted/30"
                      />
                    </div>
                  )}

                  {documento.archivo.mimeType === "application/pdf" && (
                    <div className="mb-3 rounded-lg overflow-hidden border">
                      <object
                        data={documento.archivo.url}
                        type="application/pdf"
                        className="w-full h-[400px]"
                      >
                        <p className="p-4 text-sm text-muted-foreground">
                          No se puede mostrar el PDF.{" "}
                          <a href={documento.archivo.url} target="_blank" rel="noopener noreferrer" className="text-primary underline">Descargar</a>
                        </p>
                      </object>
                    </div>
                  )}

                  <div className="bg-muted/50 rounded-lg p-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{documento.archivo.nombreOriginal || "Archivo"}</p>
                      <p className="text-xs text-muted-foreground">
                        {documento.archivo.mimeType} - {formatBytes(documento.archivo.pesoBytes)}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button variant="outline" size="sm" asChild>
                        <a href={documento.archivo.url} target="_blank" rel="noopener noreferrer">
                          <Eye className="h-4 w-4 mr-1" />
                          Ver
                        </a>
                      </Button>
                      <Button variant="outline" size="sm" asChild>
                        <a href={documento.archivo.url} download={documento.archivo.nombreOriginal}>
                          <Download className="h-4 w-4 mr-1" />
                          Descargar
                        </a>
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Archivo reverso */}
              {(documento as unknown as Record<string, unknown>).archivoReverso && (() => {
                const rev = (documento as unknown as Record<string, unknown>).archivoReverso as { url: string; mimeType: string; nombreOriginal?: string; pesoBytes?: number };
                return (
                  <div className="pt-3">
                    <p className="text-muted-foreground mb-2">Reverso</p>
                    {rev.mimeType?.startsWith("image/") && (
                      <div className="mb-3 rounded-lg overflow-hidden border">
                        <img src={rev.url} alt={rev.nombreOriginal || "Reverso"} className="w-full max-h-[400px] object-contain bg-muted/30" />
                      </div>
                    )}
                    {rev.mimeType === "application/pdf" && (
                      <div className="mb-3 rounded-lg overflow-hidden border">
                        <object data={rev.url} type="application/pdf" className="w-full h-[400px]">
                          <p className="p-4 text-sm text-muted-foreground">
                            No se puede mostrar el PDF.{" "}
                            <a href={rev.url} target="_blank" rel="noopener noreferrer" className="text-primary underline">Descargar</a>
                          </p>
                        </object>
                      </div>
                    )}
                    <div className="bg-muted/50 rounded-lg p-3 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{rev.nombreOriginal || "Reverso"}</p>
                        <p className="text-xs text-muted-foreground">{rev.mimeType} - {formatBytes(rev.pesoBytes)}</p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button variant="outline" size="sm" asChild>
                          <a href={rev.url} target="_blank" rel="noopener noreferrer">
                            <Eye className="h-4 w-4 mr-1" />
                            Ver
                          </a>
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                          <a href={rev.url} download={rev.nombreOriginal}>
                            <Download className="h-4 w-4 mr-1" />
                            Descargar
                          </a>
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </>
        ) : (
          <div className="py-8 text-center text-muted-foreground">Cargando...</div>
        )}
      </DialogContent>
    </Dialog>
  );
}

import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { getApiRndcBaseUrl } from "@/services/apirndc/apirndc.config";
import { uploadFileToS3 } from "@/lib/uploadToS3";
import { ConductorLayout } from "@/components/layout/ConductorLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FolderOpen,
  Loader2,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Car,
  ArrowLeft,
  Upload,
  Camera,
  FileText,
  Download,
  Clock,
  ShieldCheck,
  ShieldX,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";

// ── Types ──

interface VehiculoInfo {
  _id: string;
  placa: string;
  marca: string;
  linea: string;
  modelo: string;
  cellviId: number;
  found: true;
}

interface VehiculoNotFound {
  cellviId: number;
  placa: string;
  found: false;
}

type VehiculoResult = VehiculoInfo | VehiculoNotFound;

interface Documento {
  _id: string;
  tipoDocumento: string;
  numero?: string;
  entidadEmisora?: string;
  fechaExpedicion?: string;
  fechaVencimiento?: string;
  estado: string;
  archivo?: {
    url?: string;
    key?: string;
    mimeType?: string;
    nombreOriginal?: string;
    pesoBytes?: number;
  };
  archivoReverso?: {
    url?: string;
    key?: string;
    mimeType?: string;
    nombreOriginal?: string;
    pesoBytes?: number;
  };
  createdAt: string;
}

// ── Document type config ──

const DOC_TYPES = [
  { key: "SOAT", label: "SOAT", requiresExpiry: true },
  { key: "TECNOMECANICA", label: "Tecnomecánica", requiresExpiry: true },
  { key: "TARJETA_OPERACION", label: "Tarjeta de Operación", requiresExpiry: true },
  { key: "RCE", label: "RCE (Resp. Civil Extracontractual)", requiresExpiry: true },
  { key: "RCC", label: "RCC (Resp. Civil Contractual)", requiresExpiry: true },
  { key: "LICENCIA_TRANSITO", label: "Licencia de Tránsito", requiresExpiry: false },
  { key: "TARJETA_PROPIEDAD", label: "Tarjeta de Propiedad", requiresExpiry: false },
];

function getEstadoConfig(estado: string) {
  switch (estado) {
    case "VIGENTE": return { color: "bg-green-500", borderColor: "border-green-200 dark:border-green-800", bgCard: "bg-green-50/50 dark:bg-green-950/10", textColor: "text-green-700 dark:text-green-400", icon: ShieldCheck, label: "Vigente" };
    case "POR_VENCER": return { color: "bg-amber-500", borderColor: "border-amber-200 dark:border-amber-800", bgCard: "bg-amber-50/50 dark:bg-amber-950/10", textColor: "text-amber-700 dark:text-amber-400", icon: Clock, label: "Por vencer" };
    case "VENCIDO": return { color: "bg-red-500", borderColor: "border-red-300 dark:border-red-800", bgCard: "bg-red-50/50 dark:bg-red-950/10", textColor: "text-red-700 dark:text-red-400", icon: ShieldX, label: "Vencido" };
    default: return { color: "bg-orange-500", borderColor: "border-orange-300 dark:border-orange-800", bgCard: "bg-orange-50/50 dark:bg-orange-950/10", textColor: "text-orange-700 dark:text-orange-400", icon: AlertTriangle, label: "Pendiente" };
  }
}

function formatDate(date?: string) {
  if (!date) return "—";
  return format(new Date(date), "dd MMM yyyy", { locale: es });
}

// ── Component ──

export default function ConductorDocumentos() {
  const { user, bearerToken, conductorId } = useAuth();
  const queryClient = useQueryClient();
  const cellviVehiculos = user?.vehiculos || [];

  const [selectedVehiculo, setSelectedVehiculo] = useState<VehiculoInfo | null>(null);
  const [viewingDoc, setViewingDoc] = useState<Documento | null>(null);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null); // doc type key

  // ── Fetch vehicles ──
  const { data: vehiculosResults, isLoading: loadingVehiculos } = useQuery({
    queryKey: ["conductor-vehiculos-docs", cellviVehiculos.map((v) => v.id)],
    queryFn: async (): Promise<VehiculoResult[]> => {
      if (!bearerToken || cellviVehiculos.length === 0) return [];
      const results = await Promise.all(
        cellviVehiculos.map(async (v) => {
          try {
            const res = await fetch(`${getApiRndcBaseUrl()}/api/vehiculos/cellvi/${v.id}`, {
              headers: { Authorization: `Bearer ${bearerToken}` },
            });
            if (!res.ok) return { cellviId: v.id, placa: v.placa, found: false } as VehiculoNotFound;
            const data = await res.json();
            const rawVeh = Array.isArray(data.data) ? data.data[0] : (data.data || data);
            if (!rawVeh?._id) return { cellviId: v.id, placa: v.placa, found: false } as VehiculoNotFound;
            return {
              _id: String(rawVeh._id),
              placa: rawVeh.placa || v.placa,
              marca: rawVeh.marca || "",
              linea: rawVeh.linea || "",
              modelo: rawVeh.modelo || "",
              cellviId: v.id,
              found: true,
            } as VehiculoInfo;
          } catch {
            return { cellviId: v.id, placa: v.placa, found: false } as VehiculoNotFound;
          }
        })
      );
      return results;
    },
    enabled: !!bearerToken && cellviVehiculos.length > 0,
  });

  // ── Fetch documents for selected vehicle ──
  const { data: documentos, isLoading: loadingDocs } = useQuery({
    queryKey: ["conductor-vehiculo-docs", selectedVehiculo?._id],
    queryFn: async () => {
      const res = await fetch(
        `${getApiRndcBaseUrl()}/api/documentos?entidadId=${selectedVehiculo!._id}&entidadModelo=Vehiculo`,
        { headers: { Authorization: `Bearer ${bearerToken}` } }
      );
      if (!res.ok) throw new Error("Error al cargar documentos");
      const json = await res.json();
      const list = json.data || json;
      return (Array.isArray(list) ? list : []) as Documento[];
    },
    enabled: !!bearerToken && !!selectedVehiculo,
  });

  // Build a map of doc type -> most recent document
  const docMap = new Map<string, Documento>();
  if (documentos) {
    for (const doc of documentos) {
      const existing = docMap.get(doc.tipoDocumento);
      if (!existing || new Date(doc.createdAt) > new Date(existing.createdAt)) {
        docMap.set(doc.tipoDocumento, doc);
      }
    }
  }

  // ── Vehicle detail view ──
  if (selectedVehiculo) {
    return (
      <ConductorLayout>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => { setSelectedVehiculo(null); setUploadingFor(null); }} className="gap-1">
              <ArrowLeft className="h-4 w-4" /> Volver
            </Button>
            <div>
              <h1 className="text-lg font-bold">Documentos del Vehículo</h1>
              <p className="text-sm text-muted-foreground">
                {selectedVehiculo.placa} - {selectedVehiculo.marca} {selectedVehiculo.linea}
              </p>
            </div>
          </div>

          {loadingDocs ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-3">
              {DOC_TYPES.map((docType) => {
                const doc = docMap.get(docType.key);
                const config = doc ? getEstadoConfig(doc.estado) : getEstadoConfig("");
                const StatusIcon = config.icon;

                return (
                  <div
                    key={docType.key}
                    className={`border rounded-lg overflow-hidden ${config.borderColor} ${config.bgCard}`}
                  >
                    {/* Color indicator bar */}
                    <div className={`h-1.5 ${config.color}`} />

                    <div className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <StatusIcon className={`h-5 w-5 ${config.textColor}`} />
                          <h3 className="font-semibold text-sm">{docType.label}</h3>
                        </div>
                        <Badge
                          variant={
                            doc?.estado === "VIGENTE" ? "default" :
                            doc?.estado === "POR_VENCER" ? "secondary" :
                            doc?.estado === "VENCIDO" ? "destructive" : "outline"
                          }
                          className={`text-xs ${!doc ? "border-orange-400 text-orange-700 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30" : ""}`}
                        >
                          {config.label}
                        </Badge>
                      </div>

                      {doc ? (
                        <div className="space-y-1 text-sm text-muted-foreground">
                          {doc.numero && <p>N°: <span className="text-foreground">{doc.numero}</span></p>}
                          {doc.fechaExpedicion && <p>Expedición: <span className="text-foreground">{formatDate(doc.fechaExpedicion)}</span></p>}
                          {doc.fechaVencimiento && <p>Vencimiento: <span className="text-foreground">{formatDate(doc.fechaVencimiento)}</span></p>}
                        </div>
                      ) : (
                        <p className="text-sm font-medium text-orange-600 dark:text-orange-400">
                          Sin documento registrado — debe subirse
                        </p>
                      )}

                      <div className="flex gap-2 mt-3">
                        {doc && doc.archivo?.url && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setViewingDoc(doc)}
                            className="gap-1.5 flex-1"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Ver
                          </Button>
                        )}
                        <Button
                          variant={doc ? "outline" : "default"}
                          size="sm"
                          onClick={() => setUploadingFor(docType.key)}
                          className="gap-1.5 flex-1"
                        >
                          <Upload className="h-3.5 w-3.5" />
                          {doc ? "Actualizar" : "Subir"}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Upload Dialog */}
        {uploadingFor && (
          <UploadDocDialog
            docTypeKey={uploadingFor}
            docTypeLabel={DOC_TYPES.find((d) => d.key === uploadingFor)?.label || uploadingFor}
            requiresExpiry={DOC_TYPES.find((d) => d.key === uploadingFor)?.requiresExpiry ?? true}
            vehiculoId={selectedVehiculo._id}
            onClose={() => setUploadingFor(null)}
            onSuccess={() => {
              setUploadingFor(null);
              queryClient.invalidateQueries({ queryKey: ["conductor-vehiculo-docs"] });
            }}
          />
        )}

        {/* View Document Dialog */}
        {viewingDoc && (
          <ViewDocDialog doc={viewingDoc} onClose={() => setViewingDoc(null)} />
        )}
      </ConductorLayout>
    );
  }

  // ── Vehicle selector ──
  return (
    <ConductorLayout>
      <div className="space-y-4">
        <div className="text-center">
          <h1 className="text-xl font-bold text-foreground">Documentos</h1>
          <p className="text-sm text-muted-foreground">
            Selecciona un vehículo para ver el estado de sus documentos
          </p>
        </div>

        {loadingVehiculos ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !vehiculosResults || vehiculosResults.length === 0 ? (
          <div className="text-center py-8 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <AlertTriangle className="h-10 w-10 text-yellow-600 mx-auto mb-3" />
            <p className="text-sm text-yellow-600 dark:text-yellow-500">
              No tiene vehículos asignados. Contacte al administrador.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {vehiculosResults.map((v) => {
              if (!v.found) {
                return (
                  <div key={v.cellviId} className="bg-card border border-red-200 dark:border-red-800 rounded-lg p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-lg bg-red-100 dark:bg-red-900/30">
                        <Car className="h-5 w-5 text-red-600 dark:text-red-400" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold">{v.placa}</p>
                        <p className="text-xs text-red-600 dark:text-red-400">No registrado en el sistema</p>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={v.cellviId}
                  className="bg-card border border-border hover:border-primary/40 rounded-lg p-4 transition-colors"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2.5 rounded-lg bg-primary/10">
                      <Car className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold">{v.placa}</p>
                      <p className="text-xs text-muted-foreground">{v.marca} {v.linea} {v.modelo}</p>
                    </div>
                  </div>
                  <Button onClick={() => setSelectedVehiculo(v)} className="w-full gap-2">
                    <FolderOpen className="h-4 w-4" />
                    Ver Documentos
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </ConductorLayout>
  );
}

// ════════════════════════════════════════════════════
// Upload Document Dialog
// ════════════════════════════════════════════════════

interface UploadDocDialogProps {
  docTypeKey: string;
  docTypeLabel: string;
  requiresExpiry: boolean;
  vehiculoId: string;
  onClose: () => void;
  onSuccess: () => void;
}

function UploadDocDialog({ docTypeKey, docTypeLabel, requiresExpiry, vehiculoId, onClose, onSuccess }: UploadDocDialogProps) {
  const { bearerToken } = useAuth();
  const [numero, setNumero] = useState("");
  const [entidadEmisora, setEntidadEmisora] = useState("");
  const [fechaExpedicion, setFechaExpedicion] = useState("");
  const [fechaVencimiento, setFechaVencimiento] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileReverso, setFileReverso] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileReversoRef = useRef<HTMLInputElement>(null);

  const dateError = fechaExpedicion && fechaVencimiento && new Date(fechaVencimiento) < new Date(fechaExpedicion)
    ? "La fecha de vencimiento no puede ser anterior a la de expedición"
    : "";

  const isValid = file && (!requiresExpiry || (fechaExpedicion && fechaVencimiento && !dateError));

  const handleSubmit = async () => {
    if (!isValid || !file) return;
    if (!bearerToken) {
      toast.error("Sesión expirada. Recargue la página.");
      return;
    }
    setUploading(true);
    setUploadProgress(0);

    try {
      // 1. Get presigned URL for front file
      const presignedRes = await fetch(`${getApiRndcBaseUrl()}/api/documentos/presigned-url`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${bearerToken}`,
        },
        body: JSON.stringify({ fileName: file.name, mimeType: file.type }),
      });
      const presignedJson = await presignedRes.json();
      if (!presignedRes.ok) throw new Error(presignedJson.error || presignedJson.message || "Error al obtener URL de subida");
      const { uploadUrl, key, publicUrl } = presignedJson.data;

      // 2. Upload front file to S3
      await uploadFileToS3(uploadUrl, file, (p) => setUploadProgress(p.percent));

      // 3. Upload reverso if present
      let archivoReverso: Record<string, unknown> | undefined;
      if (fileReverso) {
        const presRes2 = await fetch(`${getApiRndcBaseUrl()}/api/documentos/presigned-url`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${bearerToken}`,
          },
          body: JSON.stringify({ fileName: fileReverso.name, mimeType: fileReverso.type }),
        });
        const presJson2 = await presRes2.json();
        await uploadFileToS3(presJson2.data.uploadUrl, fileReverso);
        archivoReverso = {
          url: presJson2.data.publicUrl,
          key: presJson2.data.key,
          mimeType: fileReverso.type,
          nombreOriginal: fileReverso.name,
          pesoBytes: fileReverso.size,
        };
      }

      // 4. Create document in backend
      const body: Record<string, unknown> = {
        tipoDocumento: docTypeKey,
        entidadId: vehiculoId,
        entidadModelo: "Vehiculo",
        numero: numero || undefined,
        entidadEmisora: entidadEmisora || undefined,
        fechaExpedicion: fechaExpedicion || undefined,
        fechaVencimiento: fechaVencimiento || undefined,
        archivo: {
          url: publicUrl,
          key,
          mimeType: file.type,
          nombreOriginal: file.name,
          pesoBytes: file.size,
        },
      };
      if (archivoReverso) body.archivoReverso = archivoReverso;

      const createRes = await fetch(`${getApiRndcBaseUrl()}/api/documentos`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${bearerToken}`,
        },
        body: JSON.stringify(body),
      });

      if (!createRes.ok) {
        const err = await createRes.json().catch(() => null);
        throw new Error(err?.message || "Error al crear documento");
      }

      toast.success(`${docTypeLabel} subido exitosamente`);
      onSuccess();
    } catch (e: any) {
      toast.error(e.message || "Error al subir documento");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open onOpenChange={() => !uploading && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto w-[95vw] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Subir {docTypeLabel}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Doc type - locked */}
          <div>
            <Label className="text-sm">Tipo de Documento</Label>
            <Input value={docTypeLabel} disabled className="mt-1 bg-muted" />
          </div>

          {/* Numero */}
          <div>
            <Label className="text-sm">Número del documento</Label>
            <Input
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              placeholder="Ej: 123456789"
              className="mt-1"
            />
          </div>

          {/* Entidad emisora */}
          <div>
            <Label className="text-sm">Entidad emisora</Label>
            <Input
              value={entidadEmisora}
              onChange={(e) => setEntidadEmisora(e.target.value)}
              placeholder="Ej: Seguros Bolívar"
              className="mt-1"
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm">Fecha expedición {requiresExpiry && "*"}</Label>
              <Input
                type="date"
                value={fechaExpedicion}
                onChange={(e) => setFechaExpedicion(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-sm">Fecha vencimiento {requiresExpiry && "*"}</Label>
              <Input
                type="date"
                value={fechaVencimiento}
                onChange={(e) => setFechaVencimiento(e.target.value)}
                min={fechaExpedicion || undefined}
                className="mt-1"
              />
            </div>
          </div>
          {dateError && (
            <p className="text-xs text-destructive">{dateError}</p>
          )}

          {/* Front file */}
          <div>
            <Label className="text-sm">Documento (frente) *</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              capture="environment"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <Button
              type="button"
              variant={file ? "default" : "outline"}
              className="w-full mt-1 gap-2"
              onClick={() => fileInputRef.current?.click()}
            >
              <Camera className="h-4 w-4" />
              {file ? file.name.substring(0, 30) + (file.name.length > 30 ? "..." : "") : "Capturar o seleccionar"}
            </Button>
          </div>

          {/* Reverse file (optional) */}
          <div>
            <Label className="text-sm">Reverso (opcional)</Label>
            <input
              ref={fileReversoRef}
              type="file"
              accept="image/*,application/pdf"
              capture="environment"
              className="hidden"
              onChange={(e) => setFileReverso(e.target.files?.[0] || null)}
            />
            <Button
              type="button"
              variant={fileReverso ? "default" : "outline"}
              className="w-full mt-1 gap-2"
              onClick={() => fileReversoRef.current?.click()}
            >
              <Camera className="h-4 w-4" />
              {fileReverso ? fileReverso.name.substring(0, 30) + (fileReverso.name.length > 30 ? "..." : "") : "Capturar reverso"}
            </Button>
          </div>

          {/* Upload progress */}
          {uploading && (
            <div className="space-y-1">
              <div className="w-full bg-muted rounded-full h-2">
                <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
              </div>
              <p className="text-xs text-muted-foreground text-center">Subiendo... {uploadProgress}%</p>
            </div>
          )}

          {/* Submit */}
          <Button
            onClick={handleSubmit}
            disabled={!isValid || uploading}
            className="w-full gap-2"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {uploading ? "Subiendo..." : "Subir Documento"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ════════════════════════════════════════════════════
// View Document Dialog
// ════════════════════════════════════════════════════

function ViewDocDialog({ doc, onClose }: { doc: Documento; onClose: () => void }) {
  const isImage = doc.archivo?.mimeType?.startsWith("image/");
  const isPdf = doc.archivo?.mimeType === "application/pdf";
  const isReversoImage = doc.archivoReverso?.mimeType?.startsWith("image/");

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto w-[95vw] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            {doc.tipoDocumento?.replace(/_/g, " ")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {doc.numero && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Número</span>
              <span className="font-medium">{doc.numero}</span>
            </div>
          )}
          {doc.entidadEmisora && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Emisora</span>
              <span className="font-medium">{doc.entidadEmisora}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Estado</span>
            <Badge
              variant={
                doc.estado === "VIGENTE" ? "default" :
                doc.estado === "POR_VENCER" ? "secondary" : "destructive"
              }
            >
              {doc.estado?.replace("_", " ")}
            </Badge>
          </div>
          {doc.fechaExpedicion && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Expedición</span>
              <span className="font-medium">{formatDate(doc.fechaExpedicion)}</span>
            </div>
          )}
          {doc.fechaVencimiento && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Vencimiento</span>
              <span className="font-medium">{formatDate(doc.fechaVencimiento)}</span>
            </div>
          )}

          {/* Front file preview */}
          {doc.archivo?.url && (
            <div className="border rounded-lg overflow-hidden">
              <p className="text-xs font-semibold text-muted-foreground px-3 pt-2">Frente</p>
              {isImage && (
                <img src={doc.archivo.url} alt="Documento frente" className="w-full max-h-[300px] object-contain p-2" />
              )}
              {isPdf && (
                <object data={doc.archivo.url} type="application/pdf" className="w-full h-[300px]">
                  <p className="p-4 text-sm text-muted-foreground">
                    No se puede mostrar el PDF.{" "}
                    <a href={doc.archivo.url} target="_blank" rel="noopener noreferrer" className="text-primary underline">Descargar</a>
                  </p>
                </object>
              )}
              <div className="p-2">
                <Button variant="outline" size="sm" asChild className="w-full gap-1.5">
                  <a href={doc.archivo.url} target="_blank" rel="noopener noreferrer" download>
                    <Download className="h-3.5 w-3.5" /> Descargar
                  </a>
                </Button>
              </div>
            </div>
          )}

          {/* Reverse file preview */}
          {doc.archivoReverso?.url && (
            <div className="border rounded-lg overflow-hidden">
              <p className="text-xs font-semibold text-muted-foreground px-3 pt-2">Reverso</p>
              {isReversoImage && (
                <img src={doc.archivoReverso.url} alt="Documento reverso" className="w-full max-h-[300px] object-contain p-2" />
              )}
              <div className="p-2">
                <Button variant="outline" size="sm" asChild className="w-full gap-1.5">
                  <a href={doc.archivoReverso.url} target="_blank" rel="noopener noreferrer" download>
                    <Download className="h-3.5 w-3.5" /> Descargar reverso
                  </a>
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

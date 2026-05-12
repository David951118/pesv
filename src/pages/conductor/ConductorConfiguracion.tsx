import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { getApiRndcBaseUrl } from "@/services/apirndc/apirndc.config";
import { uploadFileToS3 } from "@/lib/uploadToS3";
import { ConductorLayout } from "@/components/layout/ConductorLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  UserCircle,
  Building2,
  Phone,
  Mail,
  MapPin,
  IdCard,
  Droplets,
  Car,
  Loader2,
  FolderOpen,
  ShieldCheck,
  ShieldX,
  Clock,
  AlertTriangle,
  Upload,
  Camera,
  Check,
  Download,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";

// ── Types ──

interface TerceroData {
  _id: string;
  identificacion: string;
  tipoId: string;
  nombres?: string;
  apellidos?: string;
  roles: string[];
  estado: string;
  contacto?: {
    direccion?: string;
    ciudad?: string;
    telefono?: string;
    email?: string;
  };
  datosConductor?: { tipoSangre?: string };
  empresa?: string | { _id: string; nit: string; razonSocial: string; nombreComercial?: string; estado: string; contacto?: { direccion?: string; ciudad?: string; telefono?: string; email?: string } };
}

interface DocPersonal {
  _id: string;
  tipoDocumento: string;
  numero?: string;
  entidadEmisora?: string;
  fechaExpedicion?: string;
  fechaVencimiento?: string;
  estado: string;
  archivo?: { url?: string; key?: string; mimeType?: string; nombreOriginal?: string; pesoBytes?: number };
  archivoReverso?: { url?: string; key?: string; mimeType?: string; nombreOriginal?: string; pesoBytes?: number };
  createdAt: string;
}

// ── Personal document types ──

const PERSONAL_DOC_TYPES = [
  { key: "LICENCIA_CONDUCCION", label: "Licencia de Conducción", requiresExpiry: true },
  { key: "CEDULA", label: "Cédula de Ciudadanía", requiresExpiry: false },
  { key: "EXAMEN_MEDICO", label: "Examen Médico", requiresExpiry: true },
  { key: "ANTECEDENTES", label: "Antecedentes Judiciales", requiresExpiry: false },
];

// ── Helpers ──

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

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-2.5">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground break-words">{value}</p>
      </div>
    </div>
  );
}

// ── Main component ──

export default function ConductorConfiguracion() {
  const { user, bearerToken, conductorId } = useAuth();
  const queryClient = useQueryClient();
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [viewingDoc, setViewingDoc] = useState<DocPersonal | null>(null);

  // Fallback: conductorId solo se setea cuando role === "conductor"; para supervisor/cliente-admin
  // usar terceroId del user directamente para que el perfil y los documentos personales funcionen.
  const terceroIdEffective = conductorId || user?.terceroId || null;

  // Si intentan abrir el diálogo sin tercero identificado, avisar y cerrar.
  useEffect(() => {
    if (uploadingFor && !terceroIdEffective) {
      toast.error("No se encontró tu registro de tercero. Contacta al administrador.");
      setUploadingFor(null);
    }
  }, [uploadingFor, terceroIdEffective]);

  const { data: tercero, isLoading } = useQuery({
    queryKey: ["conductor-perfil", terceroIdEffective],
    queryFn: async () => {
      const res = await fetch(`${getApiRndcBaseUrl()}/api/terceros/${terceroIdEffective}`, {
        headers: { Authorization: `Bearer ${bearerToken}` },
      });
      if (!res.ok) throw new Error("Error al cargar perfil");
      const json = await res.json();
      return (json.data || json) as TerceroData;
    },
    enabled: !!bearerToken && !!terceroIdEffective,
  });

  const { data: docsPersonales, isLoading: loadingDocs } = useQuery({
    queryKey: ["conductor-docs-personales", terceroIdEffective],
    queryFn: async () => {
      const res = await fetch(
        `${getApiRndcBaseUrl()}/api/documentos?entidadId=${terceroIdEffective}&entidadModelo=Tercero`,
        { headers: { Authorization: `Bearer ${bearerToken}` } }
      );
      if (!res.ok) return [];
      const json = await res.json();
      const list = json.data || json;
      return (Array.isArray(list) ? list : []) as DocPersonal[];
    },
    enabled: !!bearerToken && !!terceroIdEffective,
  });

  // Most recent doc per type
  const docMap = new Map<string, DocPersonal>();
  if (docsPersonales) {
    for (const doc of docsPersonales) {
      const existing = docMap.get(doc.tipoDocumento);
      if (!existing || new Date(doc.createdAt) > new Date(existing.createdAt)) {
        docMap.set(doc.tipoDocumento, doc);
      }
    }
  }

  const empresa = tercero?.empresa && typeof tercero.empresa === "object" ? tercero.empresa : null;
  const empresaIdStr = tercero?.empresa && typeof tercero.empresa === "string" ? tercero.empresa : null;
  const { data: empresaFetched } = useQuery({
    queryKey: ["empresa-detail", empresaIdStr],
    queryFn: async () => {
      const res = await fetch(`${getApiRndcBaseUrl()}/api/empresas/${empresaIdStr}`, {
        headers: { Authorization: `Bearer ${bearerToken}` },
      });
      if (!res.ok) return null;
      const json = await res.json();
      return (json.data ?? json) as { razonSocial: string; nit?: string } | null;
    },
    enabled: !!bearerToken && !!empresaIdStr && !empresa,
  });

  return (
    <ConductorLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-primary/10">
            <UserCircle className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-xl font-bold">Mi Perfil</h1>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Conductor info */}
            <div className="bg-card border rounded-lg overflow-hidden">
              <div className="bg-primary/5 px-4 py-3 border-b">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <UserCircle className="h-4 w-4" />
                  Información Personal
                </h2>
              </div>
              <div className="px-4 divide-y divide-border">
                <InfoRow
                  icon={UserCircle}
                  label="Nombre completo"
                  value={tercero ? `${tercero.nombres || ""} ${tercero.apellidos || ""}`.trim() || user?.persona : user?.persona || user?.username}
                />
                <InfoRow
                  icon={IdCard}
                  label={`Identificación (${tercero?.tipoId || "CC"})`}
                  value={tercero?.identificacion}
                />
                <InfoRow icon={Mail} label="Correo electrónico" value={tercero?.contacto?.email} />
                <InfoRow icon={Phone} label="Teléfono" value={tercero?.contacto?.telefono} />
                <InfoRow
                  icon={MapPin}
                  label="Dirección"
                  value={tercero?.contacto?.direccion ? `${tercero.contacto.direccion}${tercero.contacto.ciudad ? `, ${tercero.contacto.ciudad}` : ""}` : undefined}
                />
                <InfoRow icon={Droplets} label="Tipo de sangre" value={tercero?.datosConductor?.tipoSangre} />
                <div className="flex items-center justify-between py-3">
                  <div className="flex gap-2 flex-wrap">
                    {tercero?.roles?.map((role) => (
                      <Badge key={role} variant="secondary" className="text-xs">{role}</Badge>
                    ))}
                  </div>
                  {tercero?.estado && (
                    <Badge variant={tercero.estado === "ACTIVO" ? "default" : "destructive"} className="text-xs">
                      {tercero.estado}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* ── Documentos Personales ── */}
            <div className="bg-card border rounded-lg overflow-hidden">
              <div className="bg-primary/5 px-4 py-3 border-b">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <FolderOpen className="h-4 w-4" />
                  Documentos Personales
                </h2>
              </div>

              {loadingDocs ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : (
                <div className="p-3 space-y-2">
                  {PERSONAL_DOC_TYPES.map((docType) => {
                    const doc = docMap.get(docType.key);
                    const config = doc ? getEstadoConfig(doc.estado) : getEstadoConfig("");
                    const StatusIcon = config.icon;

                    return (
                      <div
                        key={docType.key}
                        className={`border rounded-lg overflow-hidden ${config.borderColor} ${config.bgCard}`}
                      >
                        <div className={`h-1 ${config.color}`} />
                        <div className="p-3">
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              <StatusIcon className={`h-4 w-4 ${config.textColor}`} />
                              <span className="font-semibold text-sm">{docType.label}</span>
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
                            <div className="text-xs text-muted-foreground space-y-0.5">
                              {doc.numero && <p>N°: <span className="text-foreground">{doc.numero}</span></p>}
                              {doc.fechaVencimiento && (
                                <p>Vence: <span className="text-foreground">{formatDate(doc.fechaVencimiento)}</span></p>
                              )}
                            </div>
                          ) : (
                            <p className="text-xs text-orange-600 dark:text-orange-400 font-medium">Sin documento — debe subirse</p>
                          )}

                          <div className="flex gap-2 mt-2">
                            {doc?.archivo?.url && (
                              <Button variant="outline" size="sm" onClick={() => setViewingDoc(doc)} className="gap-1 flex-1 h-7 text-xs">
                                <Eye className="h-3 w-3" /> Ver
                              </Button>
                            )}
                            <Button
                              variant={doc ? "outline" : "default"}
                              size="sm"
                              onClick={() => setUploadingFor(docType.key)}
                              className="gap-1 flex-1 h-7 text-xs"
                            >
                              <Upload className="h-3 w-3" />
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

            {/* Vehículos asignados */}
            {user?.vehiculos && user.vehiculos.length > 0 && (
              <div className="bg-card border rounded-lg overflow-hidden">
                <div className="bg-primary/5 px-4 py-3 border-b">
                  <h2 className="text-sm font-semibold flex items-center gap-2">
                    <Car className="h-4 w-4" />
                    Vehículos Asignados
                  </h2>
                </div>
                <div className="px-4 divide-y divide-border">
                  {user.vehiculos.map((v) => (
                    <div key={v.id} className="flex items-center gap-3 py-3">
                      <div className="p-2 rounded-lg bg-muted">
                        <Car className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <span className="font-mono font-semibold text-sm">{v.placa}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empresa */}
            {empresa && (
              <div className="bg-card border rounded-lg overflow-hidden">
                <div className="bg-primary/5 px-4 py-3 border-b">
                  <h2 className="text-sm font-semibold flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Empresa
                  </h2>
                </div>
                <div className="px-4 divide-y divide-border">
                  <InfoRow icon={Building2} label="Razón Social" value={empresa.razonSocial} />
                  {empresa.nombreComercial && (
                    <InfoRow icon={Building2} label="Nombre Comercial" value={empresa.nombreComercial} />
                  )}
                  <InfoRow icon={IdCard} label="NIT" value={empresa.nit} />
                  <InfoRow icon={Phone} label="Teléfono" value={empresa.contacto?.telefono} />
                  <InfoRow icon={Mail} label="Email" value={empresa.contacto?.email} />
                  <InfoRow
                    icon={MapPin}
                    label="Dirección"
                    value={empresa.contacto?.direccion ? `${empresa.contacto.direccion}${empresa.contacto.ciudad ? `, ${empresa.contacto.ciudad}` : ""}` : undefined}
                  />
                  <div className="py-3">
                    <Badge variant={empresa.estado === "ACTIVA" ? "default" : "destructive"} className="text-xs">
                      {empresa.estado}
                    </Badge>
                  </div>
                </div>
              </div>
            )}

            {!empresa && empresaIdStr && (
              <div className="bg-card border rounded-lg p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Building2 className="h-4 w-4" />
                  <span>Empresa: <span className="font-medium text-foreground">{empresaFetched?.razonSocial || "Cargando..."}</span></span>
                  {empresaFetched?.nit && <span className="text-xs">NIT: {empresaFetched.nit}</span>}
                </div>
              </div>
            )}

            {/* User account info */}
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-xs text-muted-foreground mb-1">Cuenta</p>
              <p className="text-sm font-medium">{user?.username}</p>
            </div>
          </>
        )}
      </div>

      {/* Upload dialog */}
      {uploadingFor && terceroIdEffective && (
        <UploadPersonalDocDialog
          docTypeKey={uploadingFor}
          docTypeLabel={PERSONAL_DOC_TYPES.find((d) => d.key === uploadingFor)?.label || uploadingFor}
          requiresExpiry={PERSONAL_DOC_TYPES.find((d) => d.key === uploadingFor)?.requiresExpiry ?? false}
          conductorId={terceroIdEffective}
          onClose={() => setUploadingFor(null)}
          onSuccess={() => {
            setUploadingFor(null);
            queryClient.invalidateQueries({ queryKey: ["conductor-docs-personales"] });
          }}
        />
      )}

      {/* View dialog */}
      {viewingDoc && (
        <ViewPersonalDocDialog doc={viewingDoc} onClose={() => setViewingDoc(null)} />
      )}
    </ConductorLayout>
  );
}

// ════════════════════════════════════════════════════
// Upload Personal Doc Dialog
// ════════════════════════════════════════════════════

interface UploadPersonalDocDialogProps {
  docTypeKey: string;
  docTypeLabel: string;
  requiresExpiry: boolean;
  conductorId: string;
  onClose: () => void;
  onSuccess: () => void;
}

function UploadPersonalDocDialog({ docTypeKey, docTypeLabel, requiresExpiry, conductorId, onClose, onSuccess }: UploadPersonalDocDialogProps) {
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
      // 1. Presigned URL for front file
      const presignedRes = await fetch(`${getApiRndcBaseUrl()}/api/documentos/presigned-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${bearerToken}` },
        body: JSON.stringify({ fileName: file.name, mimeType: file.type }),
      });
      const presignedJson = await presignedRes.json();
      if (!presignedRes.ok) throw new Error(presignedJson.error || presignedJson.message || "Error al obtener URL");
      const { uploadUrl, key, publicUrl } = presignedJson.data;

      // 2. Upload to S3
      await uploadFileToS3(uploadUrl, file, (p) => setUploadProgress(p.percent));

      // 3. Reverso (optional)
      let archivoReverso: Record<string, unknown> | undefined;
      if (fileReverso) {
        const presRes2 = await fetch(`${getApiRndcBaseUrl()}/api/documentos/presigned-url`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${bearerToken}` },
          body: JSON.stringify({ fileName: fileReverso.name, mimeType: fileReverso.type }),
        });
        const presJson2 = await presRes2.json();
        if (!presRes2.ok) throw new Error(presJson2.error || "Error al obtener URL reverso");
        await uploadFileToS3(presJson2.data.uploadUrl, fileReverso);
        archivoReverso = {
          url: presJson2.data.publicUrl,
          key: presJson2.data.key,
          mimeType: fileReverso.type,
          nombreOriginal: fileReverso.name,
          pesoBytes: fileReverso.size,
        };
      }

      // 4. Create document
      const body: Record<string, unknown> = {
        tipoDocumento: docTypeKey,
        entidadId: conductorId,
        entidadModelo: "Tercero",
        numero: numero || undefined,
        entidadEmisora: entidadEmisora || undefined,
        fechaExpedicion: fechaExpedicion || undefined,
        fechaVencimiento: fechaVencimiento || undefined,
        archivo: { url: publicUrl, key, mimeType: file.type, nombreOriginal: file.name, pesoBytes: file.size },
      };
      if (archivoReverso) body.archivoReverso = archivoReverso;

      const createRes = await fetch(`${getApiRndcBaseUrl()}/api/documentos`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${bearerToken}` },
        body: JSON.stringify(body),
      });
      if (!createRes.ok) {
        const err = await createRes.json().catch(() => null);
        throw new Error(err?.message || err?.error || "Error al crear documento");
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
          <div>
            <Label className="text-sm">Tipo de Documento</Label>
            <Input value={docTypeLabel} disabled className="mt-1 bg-muted" />
          </div>

          <div>
            <Label className="text-sm">Número del documento</Label>
            <Input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="Ej: 123456789" className="mt-1" />
          </div>

          <div>
            <Label className="text-sm">Entidad emisora</Label>
            <Input value={entidadEmisora} onChange={(e) => setEntidadEmisora(e.target.value)} placeholder="Ej: Ministerio de Transporte" className="mt-1" />
          </div>

          <div className={requiresExpiry ? "grid grid-cols-2 gap-3" : ""}>
            <div>
              <Label className="text-sm">Fecha expedición</Label>
              <Input type="date" value={fechaExpedicion} onChange={(e) => setFechaExpedicion(e.target.value)} className="mt-1" />
            </div>
            {requiresExpiry && (
              <div>
                <Label className="text-sm">Fecha vencimiento *</Label>
                <Input type="date" value={fechaVencimiento} onChange={(e) => setFechaVencimiento(e.target.value)} min={fechaExpedicion || undefined} className="mt-1" />
              </div>
            )}
          </div>
          {requiresExpiry && dateError && <p className="text-xs text-destructive">{dateError}</p>}

          {/* Front file */}
          <div>
            <Label className="text-sm">Documento (frente) *</Label>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onClick={(e) => { (e.target as HTMLInputElement).value = ''; }} onChange={(e) => setFile(e.target.files?.[0] || null)} />
            <Button type="button" variant={file ? "default" : "outline"} className="w-full mt-1 gap-2" onClick={() => fileInputRef.current?.click()}>
              <Camera className="h-4 w-4" />
              {file ? file.name.substring(0, 30) + (file.name.length > 30 ? "..." : "") : "Capturar o seleccionar"}
            </Button>
          </div>

          {/* Reverso */}
          <div>
            <Label className="text-sm">Reverso (opcional)</Label>
            <input ref={fileReversoRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onClick={(e) => { (e.target as HTMLInputElement).value = ''; }} onChange={(e) => setFileReverso(e.target.files?.[0] || null)} />
            <Button type="button" variant={fileReverso ? "default" : "outline"} className="w-full mt-1 gap-2" onClick={() => fileReversoRef.current?.click()}>
              <Camera className="h-4 w-4" />
              {fileReverso ? fileReverso.name.substring(0, 30) + (fileReverso.name.length > 30 ? "..." : "") : "Capturar reverso"}
            </Button>
          </div>

          {uploading && (
            <div className="space-y-1">
              <div className="w-full bg-muted rounded-full h-2">
                <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
              </div>
              <p className="text-xs text-muted-foreground text-center">Subiendo... {uploadProgress}%</p>
            </div>
          )}

          <Button onClick={handleSubmit} disabled={!isValid || uploading} className="w-full gap-2">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {uploading ? "Subiendo..." : "Subir Documento"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ════════════════════════════════════════════════════
// View Personal Doc Dialog
// ════════════════════════════════════════════════════

function ViewPersonalDocDialog({ doc, onClose }: { doc: DocPersonal; onClose: () => void }) {
  const isImage = doc.archivo?.mimeType?.startsWith("image/");
  const isPdf = doc.archivo?.mimeType === "application/pdf";
  const isReversoImage = doc.archivoReverso?.mimeType?.startsWith("image/");

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto w-[95vw] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IdCard className="h-5 w-5 text-primary" />
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
            <Badge variant={doc.estado === "VIGENTE" ? "default" : doc.estado === "POR_VENCER" ? "secondary" : "destructive"}>
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

          {doc.archivo?.url && (
            <div className="border rounded-lg overflow-hidden">
              <p className="text-xs font-semibold text-muted-foreground px-3 pt-2">Frente</p>
              {isImage && <img src={doc.archivo.url} alt="Documento frente" className="w-full max-h-[300px] object-contain p-2" />}
              {isPdf && (
                <object data={doc.archivo.url} type="application/pdf" className="w-full h-[300px]">
                  <p className="p-4 text-sm text-muted-foreground">No se puede mostrar el PDF. <a href={doc.archivo.url} target="_blank" rel="noopener noreferrer" className="text-primary underline">Descargar</a></p>
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

          {doc.archivoReverso?.url && (
            <div className="border rounded-lg overflow-hidden">
              <p className="text-xs font-semibold text-muted-foreground px-3 pt-2">Reverso</p>
              {isReversoImage && <img src={doc.archivoReverso.url} alt="Reverso" className="w-full max-h-[300px] object-contain p-2" />}
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

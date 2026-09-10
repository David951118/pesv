import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { getApiRndcBaseUrl } from "@/services/apirndc/apirndc.config";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Car, Loader2, FileText, Download, Eye, Plus, Pencil, Trash2 } from "lucide-react";
import type { ApiRndcDocumento } from "@/services/apirndc/apirndc.types";
import { DocumentoFormDialog } from "./DocumentoFormDialog";

interface VehiculoDetailProps {
  vehiculoId: string;
  onBack: () => void;
}

interface VehiculoData {
  _id: string;
  placa: string;
  numeroInterno: string;
  idCellvi: string;
  marca: string;
  linea: string;
  modelo: number;
  color: string;
  claseVehiculo: string;
  carroceria: string;
  modalidad: string;
  combustible: string;
  motor: string;
  chasis: string;
  cilindraje: string;
  capacidadPasajeros: number;
  fechaMatricula: string;
  propietario: string | { _id: string; nombres: string; apellidos: string };
  empresaAfiliadora: string;
  fechaAfiliacion: string;
  estado: string;
  kilometrajeActual: number;
}

// Document types relevant for vehicles
const DOC_TYPES = [
  { key: "SOAT", label: "SOAT" },
  { key: "TECNOMECANICA", label: "Tecnomecánica" },
  { key: "TARJETA_OPERACION", label: "Tarjeta Operación" },
  { key: "TARJETA_PROPIEDAD", label: "Tarjeta Propiedad" },
  { key: "REVISION_PREVENTIVA", label: "Revisión Preventiva" },
  { key: "POLIZA_RCE", label: "Póliza RCE" },
  { key: "POLIZA_RCC", label: "Póliza RCC" },
];

function getPropietarioName(prop: VehiculoData["propietario"]): string {
  if (!prop) return "-";
  if (typeof prop === "string") return prop;
  return `${prop.nombres} ${prop.apellidos}`;
}

function getEstadoBadgeVariant(estado: string) {
  switch (estado) {
    case "ACTIVO": return "default";
    case "MANTENIMIENTO": return "secondary";
    case "INACTIVO": return "outline";
    case "RETIRADO": return "destructive";
    case "INMOVILIZADO": return "destructive";
    default: return "secondary";
  }
}

function getDocStatusColor(estado?: string): string {
  switch (estado) {
    case "VIGENTE": return "border-green-500 bg-green-500/10 text-green-700 dark:text-green-400";
    case "POR_VENCER": return "border-yellow-500 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400";
    case "VENCIDO": return "border-red-500 bg-red-500/10 text-red-700 dark:text-red-400";
    case "RECHAZADO": return "border-red-500 bg-red-500/10 text-red-700 dark:text-red-400";
    default: return "border-muted bg-muted/30 text-muted-foreground";
  }
}

function getDocStatusLabel(estado?: string): string {
  switch (estado) {
    case "VIGENTE": return "Vigente";
    case "POR_VENCER": return "Por vencer";
    case "VENCIDO": return "Vencido";
    case "HISTORICO": return "Histórico";
    case "RECHAZADO": return "Rechazado";
    default: return "Sin documento";
  }
}

function formatDate(date?: string) {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("es-CO", { year: "numeric", month: "short", day: "numeric" });
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

export function VehiculoDetail({ vehiculoId, onBack }: VehiculoDetailProps) {
  const { bearerToken } = useAuth();
  const [selectedDoc, setSelectedDoc] = useState<ApiRndcDocumento | null>(null);
  const [createDocType, setCreateDocType] = useState<string | null>(null);
  const [editingDoc, setEditingDoc] = useState<ApiRndcDocumento | null>(null);
  const queryClient = useQueryClient();

  // Eliminar documento (papelera)
  const deleteDocMutation = useMutation({
    mutationFn: async (docId: string) => {
      const res = await fetch(`${getApiRndcBaseUrl()}/api/documentos/${docId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${bearerToken}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || `Error al eliminar (${res.status})`);
      }
    },
    onSuccess: () => {
      toast.success("Documento enviado a la papelera");
      queryClient.invalidateQueries({ queryKey: ["vehiculo-docs", vehiculoId] });
      queryClient.invalidateQueries({ queryKey: ["apirndc-documentos"] });
      setSelectedDoc(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Fetch vehicle
  const { data: vehiculo, isLoading } = useQuery({
    queryKey: ["vehiculo-detail", vehiculoId],
    queryFn: async () => {
      if (!bearerToken) throw new Error("No autenticado");
      const res = await fetch(`${getApiRndcBaseUrl()}/api/vehiculos/${vehiculoId}`, {
        headers: { Authorization: `Bearer ${bearerToken}` },
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Error al cargar vehículo");
      return (result.data ?? result) as VehiculoData;
    },
    enabled: !!bearerToken && !!vehiculoId,
  });

  // Fetch documents for this vehicle
  const { data: documentos = [] } = useQuery({
    queryKey: ["vehiculo-docs", vehiculoId],
    queryFn: async () => {
      if (!bearerToken) return [];
      const res = await fetch(
        `${getApiRndcBaseUrl()}/api/documentos/entidad/${vehiculoId}`,
        { headers: { Authorization: `Bearer ${bearerToken}` } },
      );
      if (!res.ok) return [];
      const json = await res.json();
      return (json.data ?? json ?? []) as ApiRndcDocumento[];
    },
    enabled: !!bearerToken && !!vehiculoId,
  });

  // Map: tipoDocumento → most recent document
  const docMap = new Map<string, ApiRndcDocumento>();
  for (const doc of documentos) {
    const existing = docMap.get(doc.tipoDocumento);
    if (!existing || new Date(doc.createdAt) > new Date(existing.createdAt)) {
      docMap.set(doc.tipoDocumento, doc);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!vehiculo) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Vehículo no encontrado</p>
        <Button variant="link" onClick={onBack}>Volver</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={onBack} className="gap-2">
        <ArrowLeft className="h-4 w-4" />
        Volver a vehículos
      </Button>

      {/* Header */}
      <div className="bg-card border rounded-lg p-6">
        <div className="flex items-start gap-4">
          <div className="p-4 rounded-lg bg-primary/10">
            <Car className="h-10 w-10 text-primary" />
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-foreground">{vehiculo.placa}</h1>
            <p className="text-lg text-muted-foreground">
              {vehiculo.marca} {vehiculo.linea} - {vehiculo.modelo}
            </p>
            <div className="flex gap-2 mt-2">
              <Badge variant={getEstadoBadgeVariant(vehiculo.estado) as "default" | "secondary" | "outline" | "destructive"}>
                {vehiculo.estado}
              </Badge>
              {vehiculo.claseVehiculo && (
                <Badge variant="outline">{vehiculo.claseVehiculo}</Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Document Status Cards */}
      <div>
        <h2 className="font-semibold text-lg mb-3 flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          Estado de Documentos
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {DOC_TYPES.map(({ key, label }) => {
            const doc = docMap.get(key);
            const color = getDocStatusColor(doc?.estado);
            return (
              <button
                key={key}
                onClick={() => doc ? setSelectedDoc(doc) : setCreateDocType(key)}
                className={`border-2 rounded-lg p-3 text-left transition-all ${color} cursor-pointer hover:shadow-md hover:scale-[1.02]`}
              >
                <p className="text-xs font-medium opacity-75">{label}</p>
                <p className="text-sm font-bold mt-1">
                  {doc ? getDocStatusLabel(doc.estado) : (
                    <span className="flex items-center gap-1">
                      <Plus className="h-3 w-3" /> Crear
                    </span>
                  )}
                </p>
                {doc?.fechaVencimiento && (
                  <p className="text-xs mt-1 opacity-75">
                    Vence: {formatDate(doc.fechaVencimiento)}
                  </p>
                )}
                {doc?.numero && (
                  <p className="text-xs mt-0.5 opacity-60 truncate">#{doc.numero}</p>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Información General */}
        <div className="bg-card border rounded-lg p-6">
          <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <Car className="h-5 w-5 text-primary" />
            Información General
          </h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Placa</p>
              <p className="font-medium">{vehiculo.placa}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Número Interno</p>
              <p className="font-medium">{vehiculo.numeroInterno || "-"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">ID Cellvi</p>
              <p className="font-medium">{vehiculo.idCellvi || "-"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Color</p>
              <p className="font-medium">{vehiculo.color || "-"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Carrocería</p>
              <p className="font-medium">{vehiculo.carroceria || "-"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Modalidad</p>
              <p className="font-medium">{vehiculo.modalidad || "-"}</p>
            </div>
          </div>
        </div>

        {/* Datos Técnicos */}
        <div className="bg-card border rounded-lg p-6">
          <h2 className="font-semibold text-lg mb-4">Datos Técnicos</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Combustible</p>
              <p className="font-medium">{vehiculo.combustible || "-"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Motor</p>
              <p className="font-medium">{vehiculo.motor || "-"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Chasis</p>
              <p className="font-medium">{vehiculo.chasis || "-"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Cilindraje</p>
              <p className="font-medium">{vehiculo.cilindraje || "-"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Capacidad Pasajeros</p>
              <p className="font-medium">{vehiculo.capacidadPasajeros || "-"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Kilometraje Actual</p>
              <p className="font-medium">{vehiculo.kilometrajeActual?.toLocaleString() || "-"}</p>
            </div>
          </div>
        </div>

        {/* Propietario y Afiliación */}
        <div className="bg-card border rounded-lg p-6 lg:col-span-2">
          <h2 className="font-semibold text-lg mb-4">Propietario y Afiliación</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Propietario</p>
              <p className="font-medium">{getPropietarioName(vehiculo.propietario)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Fecha Matrícula</p>
              <p className="font-medium">{vehiculo.fechaMatricula ? (() => { try { return format(new Date(vehiculo.fechaMatricula), "dd MMM yyyy", { locale: es }); } catch { return vehiculo.fechaMatricula; } })() : "-"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Fecha Afiliación</p>
              <p className="font-medium">{vehiculo.fechaAfiliacion ? (() => { try { return format(new Date(vehiculo.fechaAfiliacion), "dd MMM yyyy", { locale: es }); } catch { return vehiculo.fechaAfiliacion; } })() : "-"}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Create Document Dialog */}
      <DocumentoFormDialog
        open={!!createDocType}
        onOpenChange={(v) => !v && setCreateDocType(null)}
        defaultTipoDocumento={createDocType ?? undefined}
        defaultEntidadModelo="Vehiculo"
        defaultEntidadId={vehiculoId}
        onSuccess={() => {
          setCreateDocType(null);
          queryClient.invalidateQueries({ queryKey: ["vehiculo-docs", vehiculoId] });
        }}
      />

      {/* Edit Document Dialog */}
      <DocumentoFormDialog
        open={!!editingDoc}
        onOpenChange={(v) => !v && setEditingDoc(null)}
        documento={editingDoc}
        onSuccess={() => {
          setEditingDoc(null);
          queryClient.invalidateQueries({ queryKey: ["vehiculo-docs", vehiculoId] });
        }}
      />

      {/* Document Detail Dialog */}
      <Dialog open={!!selectedDoc} onOpenChange={(v) => !v && setSelectedDoc(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto overflow-x-hidden sm:max-w-2xl w-[95vw]">
          {selectedDoc && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between gap-3">
                  <DialogTitle className="flex items-center gap-3 flex-wrap">
                    {selectedDoc.tipoDocumento?.replace(/_/g, " ")}
                    <Badge
                      variant={
                        selectedDoc.estado === "VIGENTE" ? "default"
                          : selectedDoc.estado === "VENCIDO" || selectedDoc.estado === "RECHAZADO" ? "destructive"
                          : "secondary"
                      }
                    >
                      {getDocStatusLabel(selectedDoc.estado)}
                    </Badge>
                  </DialogTitle>
                  <div className="flex items-center gap-1 mr-6 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingDoc(selectedDoc);
                        setSelectedDoc(null);
                      }}
                      className="gap-1.5"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Editar
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-1.5 text-destructive hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                          Eliminar
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Eliminar documento</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta acción enviará el documento a la papelera. Podrá restaurarlo posteriormente.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteDocMutation.mutate(selectedDoc._id)}
                            disabled={deleteDocMutation.isPending}
                          >
                            {deleteDocMutation.isPending ? "Eliminando..." : "Eliminar"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-3 text-sm min-w-0 max-w-full">
                {selectedDoc.numero && (
                  <div className="flex justify-between py-2 border-b border-border">
                    <span className="text-muted-foreground">Número</span>
                    <span className="font-medium">{selectedDoc.numero}</span>
                  </div>
                )}
                {selectedDoc.entidadEmisora && (
                  <div className="flex justify-between py-2 border-b border-border">
                    <span className="text-muted-foreground">Entidad Emisora</span>
                    <span className="font-medium">{selectedDoc.entidadEmisora}</span>
                  </div>
                )}
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Expedición</span>
                  <span className="font-medium">{formatDate(selectedDoc.fechaExpedicion)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Vencimiento</span>
                  <span className="font-medium">{formatDate(selectedDoc.fechaVencimiento)}</span>
                </div>
                {selectedDoc.observaciones && (
                  <div className="py-2 border-b border-border">
                    <span className="text-muted-foreground">Observaciones</span>
                    <p className="font-medium mt-1">{selectedDoc.observaciones}</p>
                  </div>
                )}

                {/* File preview / download */}
                {selectedDoc.archivo?.url && (
                  <div className="pt-3">
                    <p className="text-muted-foreground mb-2">Archivo adjunto</p>

                    {/* Image preview */}
                    {isImageMime(selectedDoc.archivo.mimeType) && (
                      <div className="mb-3 rounded-lg overflow-hidden border">
                        <img
                          src={selectedDoc.archivo.url}
                          alt={selectedDoc.archivo.nombreOriginal || "Documento"}
                          className="w-full max-h-[400px] object-contain bg-muted/30"
                        />
                      </div>
                    )}

                    {/* PDF embed */}
                    {selectedDoc.archivo.mimeType === "application/pdf" && (
                      <div className="mb-3 rounded-lg overflow-hidden border">
                        <object
                          data={selectedDoc.archivo.url}
                          type="application/pdf"
                          className="w-full max-w-full h-[400px]"
                        >
                          <p className="p-4 text-sm text-muted-foreground">
                            No se puede mostrar el PDF.{" "}
                            <a href={selectedDoc.archivo.url} target="_blank" rel="noopener noreferrer" className="text-primary underline">Descargar</a>
                          </p>
                        </object>
                      </div>
                    )}

                    <div className="bg-muted/50 rounded-lg p-3 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{selectedDoc.archivo.nombreOriginal || "Archivo"}</p>
                        <p className="text-xs text-muted-foreground">
                          {selectedDoc.archivo.mimeType} - {formatBytes(selectedDoc.archivo.pesoBytes)}
                        </p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button variant="outline" size="sm" asChild>
                          <a href={selectedDoc.archivo.url} target="_blank" rel="noopener noreferrer">
                            <Eye className="h-4 w-4 mr-1" />
                            Ver
                          </a>
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                          <a href={selectedDoc.archivo.url} download={selectedDoc.archivo.nombreOriginal}>
                            <Download className="h-4 w-4 mr-1" />
                            Descargar
                          </a>
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Archivo reverso */}
                {selectedDoc.archivoReverso?.url && (() => {
                  const rev = selectedDoc.archivoReverso as { url: string; mimeType: string; nombreOriginal?: string; pesoBytes?: number };
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
                          <object data={rev.url} type="application/pdf" className="w-full max-w-full h-[400px]">
                            <p className="p-4 text-sm text-muted-foreground">
                              No se puede mostrar.{" "}
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
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

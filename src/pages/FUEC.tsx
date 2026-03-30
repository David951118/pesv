import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { getApiRndcBaseUrl } from "@/services/apirndc/apirndc.config";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { ModuleHeader } from "@/components/layout/ModuleHeader";
import { ContentCard } from "@/components/layout/ContentCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import {
  FileText,
  Search,
  Filter,
  Loader2,
  Eye,
  Pencil,
  Trash2,
  Plus,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  MapPin,
  Truck,
  User,
  Calendar,
  QrCode,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { QRShareModal } from "@/components/preoperativas/QRShareModal";

// ── Types ──

interface ContratoFUEC {
  _id: string;
  consecutivo: number;
  anio: number;
  numeroFUEC: string;
  contratante?: any;
  vehiculo?: any;
  conductorPrincipal?: any;
  conductoresAuxiliares?: string[];
  ruta?: string;
  objetoContrato?: string;
  origen?: string;
  destino?: string;
  recorridoEspecifico?: string;
  vigenciaInicio?: string;
  vigenciaFin?: string;
  codigoPublico?: string;
  estado: string;
  pdfUrl?: string;
  datosSnapshot?: {
    soat?: { numero: string; vigencia: string; aseguradora: string };
    tecnomecanica?: { numero: string; vigencia: string; cda: string };
    rce?: { numero: string; vigencia: string; aseguradora: string };
    rcc?: { numero: string; vigencia: string; aseguradora: string };
    tarjetaOperacion?: { numero: string; vigencia: string };
    licenciaConductor?: { numero: string; vigencia: string; categoria: string };
  };
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface TerceroOption {
  _id: string;
  nombres?: string;
  apellidos?: string;
  razonSocial?: string;
  identificacion?: string;
  roles?: string[];
}

interface VehiculoOption {
  _id: string;
  placa: string;
  marca?: string;
  linea?: string;
}

// ── Helpers ──

function formatDate(date?: string) {
  if (!date) return "—";
  return format(new Date(date), "dd MMM yyyy", { locale: es });
}

function getLabel(obj: any, fallback = "—"): string {
  if (!obj) return fallback;
  if (typeof obj === "string") return obj;
  return obj.placa || obj.razonSocial || (obj.nombres ? `${obj.nombres} ${obj.apellidos || ""}`.trim() : obj.nombre || obj._id || fallback);
}

function getEstadoVariant(estado: string): "default" | "secondary" | "outline" | "destructive" {
  switch (estado) {
    case "ACTIVO": return "default";
    case "GENERADO": return "secondary";
    case "FINALIZADO": return "outline";
    case "ANULADO": return "destructive";
    default: return "secondary";
  }
}

function getTerceroLabel(t: TerceroOption): string {
  if (t.razonSocial) return t.razonSocial;
  return `${t.nombres || ""} ${t.apellidos || ""}`.trim() || t.identificacion || t._id;
}

const ITEMS_PER_PAGE = 15;

// ── Main Component ──

export default function FUEC() {
  const { bearerToken, role, empresaId } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = role === "admin";

  const [search, setSearch] = useState("");
  const [estadoFilter, setEstadoFilter] = useState("todos");
  const [page, setPage] = useState(1);

  const [viewingContrato, setViewingContrato] = useState<ContratoFUEC | null>(null);
  const [editingContrato, setEditingContrato] = useState<ContratoFUEC | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [qrData, setQrData] = useState<{ open: boolean; codigoPublico: string; label: string; placa: string; fecha?: string } | null>(null);
  const [loadingQr, setLoadingQr] = useState<string | null>(null);

  const handleOpenQR = async (c: ContratoFUEC) => {
    // If codigoPublico already in the object, use it directly
    if (c.codigoPublico) {
      setQrData({
        open: true,
        codigoPublico: c.codigoPublico,
        label: c.numeroFUEC || `${c.consecutivo}-${c.anio}`,
        placa: getLabel(c.vehiculo),
        fecha: c.createdAt ? format(new Date(c.createdAt), "dd MMM yyyy", { locale: es }) : undefined,
      });
      return;
    }
    // Fetch QR data from /api/contratos/:id/qr
    setLoadingQr(c._id);
    try {
      const res = await fetch(`${getApiRndcBaseUrl()}/api/contratos/${c._id}/qr`, {
        headers: { Authorization: `Bearer ${bearerToken}` },
      });
      if (!res.ok) throw new Error("No se pudo obtener QR");
      const json = await res.json();
      const d = json.data ?? json;
      // Extract codigoPublico from multiple possible shapes
      const codigo = d.codigoPublico || d.qrCodeData?.codigoPublico || (d.qrVerificationUrl ? d.qrVerificationUrl.split("/").pop() : null);
      if (!codigo) throw new Error("Código QR no disponible");
      setQrData({
        open: true,
        codigoPublico: codigo,
        label: c.numeroFUEC || `${c.consecutivo}-${c.anio}`,
        placa: getLabel(c.vehiculo),
        fecha: c.createdAt ? format(new Date(c.createdAt), "dd MMM yyyy", { locale: es }) : undefined,
      });
    } catch (e: any) {
      toast.error(e.message || "Error al obtener QR");
    } finally {
      setLoadingQr(null);
    }
  };

  // ── Fetch contratos ──
  const { data, isLoading } = useQuery({
    queryKey: ["fuec-contratos", page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: String(ITEMS_PER_PAGE) });
      if (empresaId) params.set("empresaId", empresaId);
      const res = await fetch(`${getApiRndcBaseUrl()}/api/contratos?${params}`, {
        headers: { Authorization: `Bearer ${bearerToken}` },
      });
      if (!res.ok) throw new Error("Error al cargar contratos");
      const json = await res.json();
      return {
        items: (Array.isArray(json.data) ? json.data : []) as ContratoFUEC[],
        pagination: json.pagination || { page, total: 0, pages: 1 },
      };
    },
    enabled: !!bearerToken,
  });

  // ── Fetch terceros & vehiculos for create/edit forms ──
  const { data: tercerosList } = useQuery({
    queryKey: ["fuec-terceros"],
    queryFn: async () => {
      const url = isAdmin
        ? `${getApiRndcBaseUrl()}/api/terceros/list`
        : `${getApiRndcBaseUrl()}/api/terceros/empresa/${empresaId}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${bearerToken}` } });
      if (!res.ok) return [];
      const json = await res.json();
      return (json.data ?? json) as TerceroOption[];
    },
    enabled: !!bearerToken && (isAdmin || !!empresaId),
  });

  const { data: vehiculosList } = useQuery({
    queryKey: ["fuec-vehiculos"],
    queryFn: async () => {
      const url = isAdmin
        ? `${getApiRndcBaseUrl()}/api/vehiculos/list`
        : `${getApiRndcBaseUrl()}/api/vehiculos?empresaId=${empresaId}&limit=200`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${bearerToken}` } });
      if (!res.ok) return [];
      const json = await res.json();
      return (json.data ?? json) as VehiculoOption[];
    },
    enabled: !!bearerToken && (isAdmin || !!empresaId),
  });

  // ── Delete mutation ──
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${getApiRndcBaseUrl()}/api/contratos/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${bearerToken}` },
      });
      if (!res.ok) throw new Error("Error al eliminar contrato");
    },
    onSuccess: () => {
      toast.success("Contrato eliminado");
      queryClient.invalidateQueries({ queryKey: ["fuec-contratos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const contratos = data?.items || [];
  const pagination = data?.pagination;

  const filtered = contratos.filter((c) => {
    const s = search.toLowerCase();
    const matchSearch =
      !s ||
      c.numeroFUEC?.toLowerCase().includes(s) ||
      getLabel(c.contratante).toLowerCase().includes(s) ||
      getLabel(c.vehiculo).toLowerCase().includes(s) ||
      c.origen?.toLowerCase().includes(s) ||
      c.destino?.toLowerCase().includes(s) ||
      c.ruta?.toLowerCase().includes(s);
    const matchEstado = estadoFilter === "todos" || c.estado === estadoFilter;
    return matchSearch && matchEstado;
  });

  return (
    <DashboardLayout>
      <PageContainer>
        <ModuleHeader
          title="Contratos FUEC"
          description="Formato Único de Extracto del Contrato"
          icon={FileText}
          iconVariant="primary"
        >
          <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Nuevo Contrato
          </Button>
        </ModuleHeader>

        <ContentCard>
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por FUEC, contratante, vehículo, ruta..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={estadoFilter} onValueChange={setEstadoFilter}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="GENERADO">Generado</SelectItem>
                  <SelectItem value="ACTIVO">Activo</SelectItem>
                  <SelectItem value="FINALIZADO">Finalizado</SelectItem>
                  <SelectItem value="ANULADO">Anulado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No se encontraron contratos FUEC</p>
            </div>
          ) : (
            <>
              <div className="border rounded-lg overflow-hidden overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>N° FUEC</TableHead>
                      <TableHead>Contratante</TableHead>
                      <TableHead>Vehículo</TableHead>
                      <TableHead>Conductor</TableHead>
                      <TableHead>Ruta</TableHead>
                      <TableHead>Vigencia</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((c) => (
                      <TableRow key={c._id}>
                        <TableCell className="font-mono font-medium text-sm">
                          {c.numeroFUEC || `${c.consecutivo}-${c.anio}`}
                        </TableCell>
                        <TableCell className="text-sm">{getLabel(c.contratante)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-sm">{getLabel(c.vehiculo)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-sm">{getLabel(c.conductorPrincipal)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">
                          {c.origen && c.destino ? `${c.origen} → ${c.destino}` : c.ruta || "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {formatDate(c.vigenciaInicio)} - {formatDate(c.vigenciaFin)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getEstadoVariant(c.estado)}>{c.estado}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleOpenQR(c)} title="Compartir QR" disabled={loadingQr === c._id}>
                              {loadingQr === c._id ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4 text-primary" />}
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setViewingContrato(c)} title="Ver detalle">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setEditingContrato(c)} title="Editar">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {c.pdfUrl && (
                              <Button variant="ghost" size="icon" asChild title="Ver PDF">
                                <a href={c.pdfUrl} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              </Button>
                            )}
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" title="Eliminar">
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Eliminar contrato FUEC</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    ¿Está seguro de eliminar el contrato {c.numeroFUEC}? Esta acción enviará el contrato a la papelera.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteMutation.mutate(c._id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Eliminar
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {pagination && pagination.pages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Página {pagination.page} de {pagination.pages} ({pagination.total} contratos)
                  </p>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                      <ChevronLeft className="h-4 w-4" /> Anterior
                    </Button>
                    <Button variant="outline" size="sm" disabled={page >= pagination.pages} onClick={() => setPage(page + 1)}>
                      Siguiente <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </ContentCard>

        {/* View Dialog */}
        {viewingContrato && (
          <FuecDetailDialog contrato={viewingContrato} onClose={() => setViewingContrato(null)} />
        )}

        {/* Create Dialog */}
        {showCreateDialog && (
          <FuecFormDialog
            bearerToken={bearerToken!}
            empresaId={empresaId}
            terceros={tercerosList || []}
            vehiculos={vehiculosList || []}
            onClose={() => setShowCreateDialog(false)}
            onSuccess={() => {
              setShowCreateDialog(false);
              queryClient.invalidateQueries({ queryKey: ["fuec-contratos"] });
            }}
            onTercerosRefresh={() => queryClient.invalidateQueries({ queryKey: ["fuec-terceros"] })}
          />
        )}

        {/* Edit Dialog */}
        {editingContrato && (
          <FuecFormDialog
            contrato={editingContrato}
            bearerToken={bearerToken!}
            empresaId={empresaId}
            terceros={tercerosList || []}
            vehiculos={vehiculosList || []}
            onClose={() => setEditingContrato(null)}
            onSuccess={() => {
              setEditingContrato(null);
              queryClient.invalidateQueries({ queryKey: ["fuec-contratos"] });
            }}
            onTercerosRefresh={() => queryClient.invalidateQueries({ queryKey: ["fuec-terceros"] })}
          />
        )}

        {/* QR Share Modal */}
        {qrData?.open && (
          <QRShareModal
            open
            onClose={() => setQrData(null)}
            codigoPublico={qrData.codigoPublico}
            tipo="contrato"
            label={qrData.label}
            placa={qrData.placa}
            fecha={qrData.fecha}
          />
        )}
      </PageContainer>
    </DashboardLayout>
  );
}

// ════════════════════════════════════════════════════
// Detail Dialog
// ════════════════════════════════════════════════════

function FuecDetailDialog({ contrato, onClose }: { contrato: ContratoFUEC; onClose: () => void }) {
  const fields = [
    { label: "N° FUEC", value: contrato.numeroFUEC },
    { label: "Consecutivo", value: `${contrato.consecutivo} / ${contrato.anio}` },
    { label: "Estado", value: contrato.estado, badge: true },
    { label: "Contratante", value: getLabel(contrato.contratante) },
    { label: "Vehículo", value: getLabel(contrato.vehiculo) },
    { label: "Conductor Principal", value: getLabel(contrato.conductorPrincipal) },
    { label: "Objeto del Contrato", value: contrato.objetoContrato || "—" },
    { label: "Ruta", value: contrato.ruta || "—" },
    { label: "Origen", value: contrato.origen || "—" },
    { label: "Destino", value: contrato.destino || "—" },
    { label: "Recorrido Específico", value: contrato.recorridoEspecifico || "—" },
    { label: "Vigencia Inicio", value: formatDate(contrato.vigenciaInicio) },
    { label: "Vigencia Fin", value: formatDate(contrato.vigenciaFin) },
    { label: "Creado", value: contrato.createdAt ? format(new Date(contrato.createdAt), "dd MMM yyyy HH:mm", { locale: es }) : "—" },
  ];

  const snapshot = contrato.datosSnapshot;

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl w-[95vw]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-primary" />
            Contrato FUEC — {contrato.numeroFUEC}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {fields.map((f) => (
            <div key={f.label} className="flex justify-between items-start py-2 border-b border-border last:border-0">
              <span className="text-sm text-muted-foreground">{f.label}</span>
              {f.badge ? (
                <Badge variant={getEstadoVariant(String(f.value))}>{f.value}</Badge>
              ) : (
                <span className="text-sm font-medium text-foreground text-right max-w-[60%]">{f.value}</span>
              )}
            </div>
          ))}

          {/* Snapshot */}
          {snapshot && (
            <div className="pt-3 border-t">
              <p className="text-sm font-semibold mb-3">Documentos del Vehículo (Snapshot)</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {snapshot.soat && (
                  <SnapshotCard title="SOAT" numero={snapshot.soat.numero} extra={`Vence: ${snapshot.soat.vigencia} — ${snapshot.soat.aseguradora}`} />
                )}
                {snapshot.tecnomecanica && (
                  <SnapshotCard title="Tecnomecánica" numero={snapshot.tecnomecanica.numero} extra={`Vence: ${snapshot.tecnomecanica.vigencia} — ${snapshot.tecnomecanica.cda}`} />
                )}
                {snapshot.rce && (
                  <SnapshotCard title="RCE" numero={snapshot.rce.numero} extra={`Vence: ${snapshot.rce.vigencia}`} />
                )}
                {snapshot.rcc && (
                  <SnapshotCard title="RCC" numero={snapshot.rcc.numero} extra={`Vence: ${snapshot.rcc.vigencia}`} />
                )}
                {snapshot.tarjetaOperacion && (
                  <SnapshotCard title="Tarjeta Operación" numero={snapshot.tarjetaOperacion.numero} extra={`Vence: ${snapshot.tarjetaOperacion.vigencia}`} />
                )}
                {snapshot.licenciaConductor && (
                  <SnapshotCard title="Licencia Conductor" numero={`${snapshot.licenciaConductor.numero} (${snapshot.licenciaConductor.categoria})`} extra={`Vence: ${snapshot.licenciaConductor.vigencia}`} />
                )}
              </div>
            </div>
          )}

          {contrato.pdfUrl && (
            <div className="pt-3 border-t">
              <Button variant="outline" asChild className="w-full">
                <a href={contrato.pdfUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Ver PDF del FUEC
                </a>
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SnapshotCard({ title, numero, extra }: { title: string; numero: string; extra: string }) {
  return (
    <div className="bg-muted/30 rounded-lg p-3">
      <p className="text-xs font-semibold text-muted-foreground">{title}</p>
      <p className="text-sm">{numero}</p>
      <p className="text-xs text-muted-foreground">{extra}</p>
    </div>
  );
}

// ════════════════════════════════════════════════════
// Create/Edit Form Dialog
// ════════════════════════════════════════════════════

interface FuecFormDialogProps {
  contrato?: ContratoFUEC;
  bearerToken: string;
  empresaId?: string;
  terceros: TerceroOption[];
  vehiculos: VehiculoOption[];
  onClose: () => void;
  onSuccess: () => void;
  onTercerosRefresh: () => void;
}

function FuecFormDialog({ contrato, bearerToken, empresaId, terceros, vehiculos, onClose, onSuccess, onTercerosRefresh }: FuecFormDialogProps) {
  const isEdit = !!contrato;

  const getInitialId = (field: any) => {
    if (!field) return "";
    if (typeof field === "string") return field;
    return field._id || "";
  };

  const [form, setForm] = useState({
    contratante: getInitialId(contrato?.contratante),
    vehiculo: getInitialId(contrato?.vehiculo),
    conductorPrincipal: getInitialId(contrato?.conductorPrincipal),
    objetoContrato: contrato?.objetoContrato || "",
    origen: contrato?.origen || "",
    destino: contrato?.destino || "",
    recorridoEspecifico: contrato?.recorridoEspecifico || "",
    vigenciaInicio: contrato?.vigenciaInicio?.split("T")[0] || "",
    vigenciaFin: contrato?.vigenciaFin?.split("T")[0] || "",
    consecutivo: contrato?.consecutivo?.toString() || "",
    estado: contrato?.estado || "GENERADO",
  });

  const [submitting, setSubmitting] = useState(false);
  const [consecutivoCheck, setConsecutivoCheck] = useState<{ checking: boolean; existe: boolean; estado?: string }>({ checking: false, existe: false });

  // Debounced consecutivo validation
  const consecutivoTimer = useState<ReturnType<typeof setTimeout> | null>(null);
  const checkConsecutivo = (val: string) => {
    updateField("consecutivo", val);
    setConsecutivoCheck({ checking: false, existe: false });
    if (consecutivoTimer[0]) clearTimeout(consecutivoTimer[0]);
    const num = Number(val);
    if (!val || isNaN(num) || num <= 0) return;
    // Skip check when editing and consecutivo hasn't changed
    if (isEdit && Number(val) === contrato?.consecutivo) return;
    consecutivoTimer[0] = setTimeout(async () => {
      setConsecutivoCheck({ checking: true, existe: false });
      try {
        const res = await fetch(`${getApiRndcBaseUrl()}/api/contratos/verificar-consecutivo/${num}`, {
          headers: { Authorization: `Bearer ${bearerToken}` },
        });
        if (res.ok) {
          const json = await res.json();
          setConsecutivoCheck({ checking: false, existe: json.existe, estado: json.data?.estado });
        } else {
          setConsecutivoCheck({ checking: false, existe: false });
        }
      } catch {
        setConsecutivoCheck({ checking: false, existe: false });
      }
    }, 600);
  };

  const [showNewContratante, setShowNewContratante] = useState(false);
  const [creatingContratante, setCreatingContratante] = useState(false);
  const [newContratante, setNewContratante] = useState({
    tipoId: "NIT",
    identificacion: "",
    razonSocial: "",
    nombres: "",
    apellidos: "",
    telefono: "",
    email: "",
    rol: "CLIENTE" as "CLIENTE" | "PROVEEDOR",
  });

  // Filter: only CLIENTE or PROVEEDOR for contratante
  const contratanteOptions = terceros.filter((t) => {
    if (!t.roles || t.roles.length === 0) return true; // show if no roles info
    return t.roles.some((r) => ["CLIENTE", "PROVEEDOR"].includes(r.toUpperCase()));
  });

  const handleCreateContratante = async () => {
    if (!newContratante.identificacion) {
      toast.error("Identificación es requerida");
      return;
    }
    const hasName = newContratante.razonSocial || (newContratante.nombres && newContratante.apellidos);
    if (!hasName) {
      toast.error("Ingrese razón social o nombres y apellidos");
      return;
    }

    setCreatingContratante(true);
    try {
      const body: Record<string, unknown> = {
        tipoId: newContratante.tipoId,
        identificacion: newContratante.identificacion,
        roles: [newContratante.rol],
        empresa: empresaId || undefined,
        contacto: {
          telefono: newContratante.telefono || undefined,
          email: newContratante.email || undefined,
        },
      };
      if (newContratante.tipoId === "NIT") {
        body.razonSocial = newContratante.razonSocial;
      } else {
        body.nombres = newContratante.nombres;
        body.apellidos = newContratante.apellidos;
      }

      const res = await fetch(`${getApiRndcBaseUrl()}/api/terceros`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${bearerToken}`,
        },
        body: JSON.stringify(body),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || result.message || "Error al crear contratante");

      const newId = result.data?._id || result._id;
      if (newId) {
        updateField("contratante", newId);
      }
      toast.success("Contratante creado exitosamente");
      setShowNewContratante(false);
      setNewContratante({ tipoId: "NIT", identificacion: "", razonSocial: "", nombres: "", apellidos: "", telefono: "", email: "", rol: "CLIENTE" });
      onTercerosRefresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCreatingContratante(false);
    }
  };

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const dateError = form.vigenciaInicio && form.vigenciaFin && new Date(form.vigenciaFin) < new Date(form.vigenciaInicio)
    ? "La fecha fin no puede ser anterior a la de inicio"
    : "";

  const isValid = form.contratante && form.vehiculo && form.conductorPrincipal && form.consecutivo && form.vigenciaInicio && form.vigenciaFin && !dateError && !consecutivoCheck.existe && !consecutivoCheck.checking;

  const handleSubmit = async () => {
    if (!isValid) return;
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        contratante: form.contratante,
        vehiculo: form.vehiculo,
        conductorPrincipal: form.conductorPrincipal,
        objetoContrato: form.objetoContrato || undefined,
        origen: form.origen || undefined,
        destino: form.destino || undefined,
        vigenciaInicio: form.vigenciaInicio,
        vigenciaFin: form.vigenciaFin,
        consecutivo: form.consecutivo ? Number(form.consecutivo) : undefined,
        anio: new Date().getFullYear(),
      };

      // ruta as inline object { origen, destino, recorrido }
      if (form.origen || form.destino || form.recorridoEspecifico) {
        body.ruta = {
          origen: form.origen || "",
          destino: form.destino || "",
          recorrido: form.recorridoEspecifico || "",
        };
      }

      if (isEdit) {
        body.estado = form.estado;
      }

      const url = isEdit
        ? `${getApiRndcBaseUrl()}/api/contratos/${contrato!._id}`
        : `${getApiRndcBaseUrl()}/api/contratos`;

      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${bearerToken}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || err?.error || `Error al ${isEdit ? "actualizar" : "crear"} contrato`);
      }

      toast.success(`Contrato ${isEdit ? "actualizado" : "creado"} exitosamente`);
      onSuccess();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered conductores (only those with CONDUCTOR role, or all if no roles info)
  const conductores = terceros.filter((t) => {
    if (!t.roles || t.roles.length === 0) return true;
    return t.roles.some((r) => r.toUpperCase() === "CONDUCTOR");
  });

  return (
    <Dialog open onOpenChange={() => !submitting && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl w-[95vw]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            {isEdit ? "Editar Contrato FUEC" : "Nuevo Contrato FUEC"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Contratante */}
          <div>
            <div className="flex items-center justify-between">
              <Label>Contratante * <span className="text-xs text-muted-foreground">(Cliente o Proveedor)</span></Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs gap-1 h-7"
                onClick={() => setShowNewContratante(!showNewContratante)}
              >
                <Plus className="h-3 w-3" />
                {showNewContratante ? "Cancelar" : "Crear nuevo"}
              </Button>
            </div>

            {!showNewContratante ? (
              <Select value={form.contratante} onValueChange={(v) => updateField("contratante", v)}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Seleccionar contratante" />
                </SelectTrigger>
                <SelectContent>
                  {contratanteOptions.map((t) => (
                    <SelectItem key={t._id} value={t._id}>
                      {getTerceroLabel(t)}
                      {t.roles && <span className="text-muted-foreground ml-1 text-xs">({t.roles.join(", ")})</span>}
                    </SelectItem>
                  ))}
                  {contratanteOptions.length === 0 && (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      No hay contratantes disponibles. Cree uno nuevo.
                    </div>
                  )}
                </SelectContent>
              </Select>
            ) : (
              <div className="mt-2 border rounded-lg p-3 bg-muted/20 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground">Nuevo Contratante</p>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Tipo</Label>
                    <Select value={newContratante.rol} onValueChange={(v) => setNewContratante((p) => ({ ...p, rol: v as "CLIENTE" | "PROVEEDOR" }))}>
                      <SelectTrigger className="mt-0.5 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CLIENTE">Cliente</SelectItem>
                        <SelectItem value="PROVEEDOR">Proveedor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Tipo ID</Label>
                    <Select value={newContratante.tipoId} onValueChange={(v) => setNewContratante((p) => ({ ...p, tipoId: v }))}>
                      <SelectTrigger className="mt-0.5 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NIT">NIT</SelectItem>
                        <SelectItem value="CC">CC</SelectItem>
                        <SelectItem value="CE">CE</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Identificación *</Label>
                  <Input
                    value={newContratante.identificacion}
                    onChange={(e) => setNewContratante((p) => ({ ...p, identificacion: e.target.value }))}
                    placeholder="900123456-1"
                    className="mt-0.5 h-8 text-sm"
                  />
                </div>

                {newContratante.tipoId === "NIT" ? (
                  <div>
                    <Label className="text-xs">Razón Social *</Label>
                    <Input
                      value={newContratante.razonSocial}
                      onChange={(e) => setNewContratante((p) => ({ ...p, razonSocial: e.target.value }))}
                      placeholder="Mi Empresa S.A.S."
                      className="mt-0.5 h-8 text-sm"
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Nombres *</Label>
                      <Input
                        value={newContratante.nombres}
                        onChange={(e) => setNewContratante((p) => ({ ...p, nombres: e.target.value }))}
                        className="mt-0.5 h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Apellidos *</Label>
                      <Input
                        value={newContratante.apellidos}
                        onChange={(e) => setNewContratante((p) => ({ ...p, apellidos: e.target.value }))}
                        className="mt-0.5 h-8 text-sm"
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Teléfono</Label>
                    <Input
                      value={newContratante.telefono}
                      onChange={(e) => setNewContratante((p) => ({ ...p, telefono: e.target.value }))}
                      placeholder="3001234567"
                      className="mt-0.5 h-8 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Email</Label>
                    <Input
                      type="email"
                      value={newContratante.email}
                      onChange={(e) => setNewContratante((p) => ({ ...p, email: e.target.value }))}
                      placeholder="contacto@empresa.com"
                      className="mt-0.5 h-8 text-sm"
                    />
                  </div>
                </div>

                <Button
                  type="button"
                  size="sm"
                  className="w-full gap-1"
                  onClick={handleCreateContratante}
                  disabled={creatingContratante}
                >
                  {creatingContratante ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                  Crear y Seleccionar
                </Button>
              </div>
            )}
          </div>

          {/* Vehículo */}
          <div>
            <Label>Vehículo *</Label>
            <Select value={form.vehiculo} onValueChange={(v) => updateField("vehiculo", v)}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Seleccionar vehículo" />
              </SelectTrigger>
              <SelectContent>
                {vehiculos.map((v) => (
                  <SelectItem key={v._id} value={v._id}>
                    {v.placa} {v.marca ? `— ${v.marca} ${v.linea || ""}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Conductor Principal */}
          <div>
            <Label>Conductor Principal *</Label>
            <Select value={form.conductorPrincipal} onValueChange={(v) => updateField("conductorPrincipal", v)}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Seleccionar conductor" />
              </SelectTrigger>
              <SelectContent>
                {conductores.map((t) => (
                  <SelectItem key={t._id} value={t._id}>{getTerceroLabel(t)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Objeto del contrato */}
          <div>
            <Label>Objeto del Contrato</Label>
            <Textarea
              value={form.objetoContrato}
              onChange={(e) => updateField("objetoContrato", e.target.value)}
              placeholder="Descripción del servicio contratado"
              className="mt-1"
              rows={2}
            />
          </div>

          {/* Consecutivo */}
          <div>
            <Label>Consecutivo *</Label>
            <div className="relative mt-1">
              <Input
                type="number"
                value={form.consecutivo}
                onChange={(e) => checkConsecutivo(e.target.value)}
                placeholder="450001"
                className={consecutivoCheck.existe ? "border-destructive pr-10" : "pr-10"}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {consecutivoCheck.checking && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                {!consecutivoCheck.checking && form.consecutivo && !consecutivoCheck.existe && (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                )}
                {consecutivoCheck.existe && <AlertTriangle className="h-4 w-4 text-destructive" />}
              </div>
            </div>
            {consecutivoCheck.existe && (
              <p className="text-xs text-destructive mt-1">
                El consecutivo {form.consecutivo} ya existe (estado: {consecutivoCheck.estado || "—"})
              </p>
            )}
          </div>

          {/* Ruta: Origen / Destino / Recorrido */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Origen</Label>
              <Input value={form.origen} onChange={(e) => updateField("origen", e.target.value)} placeholder="Ciudad de origen" className="mt-1" />
            </div>
            <div>
              <Label>Destino</Label>
              <Input value={form.destino} onChange={(e) => updateField("destino", e.target.value)} placeholder="Ciudad de destino" className="mt-1" />
            </div>
          </div>

          <div>
            <Label>Recorrido Específico</Label>
            <Textarea
              value={form.recorridoEspecifico}
              onChange={(e) => updateField("recorridoEspecifico", e.target.value)}
              placeholder="Detalle del recorrido (ej: Bogotá - Tunja - Duitama - Sogamoso)"
              className="mt-1"
              rows={2}
            />
          </div>

          {/* Vigencia */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Vigencia Inicio *</Label>
              <Input type="date" value={form.vigenciaInicio} onChange={(e) => updateField("vigenciaInicio", e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Vigencia Fin *</Label>
              <Input type="date" value={form.vigenciaFin} onChange={(e) => updateField("vigenciaFin", e.target.value)} min={form.vigenciaInicio || undefined} className="mt-1" />
            </div>
          </div>
          {dateError && <p className="text-xs text-destructive">{dateError}</p>}

          {/* Estado (solo en edición) */}
          {isEdit && (
            <div>
              <Label>Estado</Label>
              <Select value={form.estado} onValueChange={(v) => updateField("estado", v)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GENERADO">Generado</SelectItem>
                  <SelectItem value="ACTIVO">Activo</SelectItem>
                  <SelectItem value="FINALIZADO">Finalizado</SelectItem>
                  <SelectItem value="ANULADO">Anulado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Submit */}
          <Button onClick={handleSubmit} disabled={!isValid || submitting} className="w-full gap-2">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            {isEdit ? "Actualizar Contrato" : "Crear Contrato"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

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
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  ClipboardList,
  Search,
  Filter,
  Loader2,
  Eye,
  Pencil,
  Trash2,
  FileText,
  ClipboardCheck,
  CheckCircle,
  XCircle,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  MapPin,
  Calendar,
  Truck,
  User,
  QrCode,
} from "lucide-react";
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

interface PreoperacionalAPI {
  _id: string;
  codigoPublico?: string;
  vehiculo: any;
  conductor: any;
  kilometraje: number;
  estadoGeneral: string;
  firmadoCheck: boolean;
  firmaConductorUrl?: string;
  observaciones?: string;
  seccionDelantera: Record<string, { estado: string; observaciones: string; fotoUrl: string }>;
  seccionMedia: Record<string, { estado: string; observaciones: string; fotoUrl: string }>;
  seccionTrasera: Record<string, { estado: string; observaciones: string; fotoUrl: string }>;
  deletedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

// ── Helpers ──

function formatDate(date?: string) {
  if (!date) return "—";
  return format(new Date(date), "dd MMM yyyy", { locale: es });
}

function formatDateTime(date?: string) {
  if (!date) return "—";
  return format(new Date(date), "dd MMM yyyy HH:mm", { locale: es });
}

function getContratoLabel(obj: any, fallback: string): string {
  if (!obj) return fallback;
  if (typeof obj === "string") return obj;
  return obj.placa || obj.razonSocial || (obj.nombres ? `${obj.nombres} ${obj.apellidos || ""}`.trim() : obj.nombre || obj._id || fallback);
}

function getEstadoFuecVariant(estado: string): "default" | "secondary" | "outline" | "destructive" {
  switch (estado) {
    case "ACTIVO": return "default";
    case "GENERADO": return "secondary";
    case "FINALIZADO": return "outline";
    case "ANULADO": return "destructive";
    default: return "secondary";
  }
}

function getEstadoPreopVariant(estado: string): "default" | "secondary" | "destructive" {
  switch (estado) {
    case "APROBADO": return "default";
    case "CON_NOVEDAD": return "secondary";
    case "RECHAZADO": return "destructive";
    default: return "secondary";
  }
}

const ITEM_LABELS: Record<string, string> = {
  luces: "Luces",
  direccionalesDelanteros: "Direccionales Delanteros",
  limpiabrisas: "Limpiabrisas",
  espejosRetrovisores: "Espejos Retrovisores",
  liquidos: "Líquidos",
  llantaDelanteraDerecha: "Llanta Delantera Derecha",
  llantaDelanteraIzquierda: "Llanta Delantera Izquierda",
  bocina: "Bocina",
  frenos: "Frenos",
  tablero: "Tablero",
  timon: "Timón",
  cinturones: "Cinturones",
  pedales: "Pedales",
  frenoMano: "Freno de Mano",
  bateria: "Batería",
  kitCarretera: "Kit de Carretera",
  reflectivos: "Reflectivos",
  stop: "Stop",
  llantasRepuesto: "Llantas de Repuesto",
  equipoCarretera: "Equipo de Carretera",
  llantaTraseraDerecha: "Llanta Trasera Derecha",
  llantaTraseraIzquierda: "Llanta Trasera Izquierda",
  direccionalesTraseros: "Direccionales Traseros",
  placa: "Placa",
};

const ITEMS_PER_PAGE = 10;

// ── Main Component ──

export default function Auditoria() {
  const { bearerToken, role } = useAuth();
  const isAdmin = role === "admin";
  const queryClient = useQueryClient();

  return (
    <DashboardLayout>
      <PageContainer>
        <ModuleHeader
          title="Auditoría"
          description="Gestión de contratos FUEC e inspecciones preoperacionales"
          icon={ClipboardList}
          iconVariant="primary"
        />

        <Tabs defaultValue="fuec" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="fuec" className="gap-2">
              <FileText className="h-4 w-4" />
              Contratos FUEC
            </TabsTrigger>
            <TabsTrigger value="preoperativas" className="gap-2">
              <ClipboardCheck className="h-4 w-4" />
              Preoperativas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="fuec">
            <FuecSection bearerToken={bearerToken} isAdmin={isAdmin} queryClient={queryClient} />
          </TabsContent>

          <TabsContent value="preoperativas">
            <PreoperativasSection bearerToken={bearerToken} isAdmin={isAdmin} queryClient={queryClient} />
          </TabsContent>
        </Tabs>
      </PageContainer>
    </DashboardLayout>
  );
}

// ════════════════════════════════════════════════════
// FUEC Section
// ════════════════════════════════════════════════════

function FuecSection({ bearerToken, isAdmin, queryClient }: { bearerToken: string | null; isAdmin: boolean; queryClient: any }) {
  const [search, setSearch] = useState("");
  const [estadoFilter, setEstadoFilter] = useState("todos");
  const [page, setPage] = useState(1);
  const [viewingContrato, setViewingContrato] = useState<ContratoFUEC | null>(null);
  const [qrData, setQrData] = useState<{ open: boolean; codigoPublico: string; label: string; placa: string; fecha?: string } | null>(null);
  const [loadingQr, setLoadingQr] = useState<string | null>(null);

  const handleOpenQR = async (c: ContratoFUEC) => {
    if (c.codigoPublico) {
      setQrData({
        open: true,
        codigoPublico: c.codigoPublico,
        label: c.numeroFUEC || `${c.consecutivo}-${c.anio}`,
        placa: getContratoLabel(c.vehiculo, "—"),
        fecha: c.createdAt ? format(new Date(c.createdAt), "dd MMM yyyy", { locale: es }) : undefined,
      });
      return;
    }
    setLoadingQr(c._id);
    try {
      const res = await fetch(`${getApiRndcBaseUrl()}/api/contratos/${c._id}/qr`, {
        headers: { Authorization: `Bearer ${bearerToken}` },
      });
      if (!res.ok) throw new Error("No se pudo obtener QR");
      const json = await res.json();
      const d = json.data ?? json;
      const codigo = d.codigoPublico || d.qrCodeData?.codigoPublico || (d.qrVerificationUrl ? d.qrVerificationUrl.split("/").pop() : null);
      if (!codigo) throw new Error("Código QR no disponible");
      setQrData({
        open: true,
        codigoPublico: codigo,
        label: c.numeroFUEC || `${c.consecutivo}-${c.anio}`,
        placa: getContratoLabel(c.vehiculo, "—"),
        fecha: c.createdAt ? format(new Date(c.createdAt), "dd MMM yyyy", { locale: es }) : undefined,
      });
    } catch (e: any) {
      toast.error(e.message || "Error al obtener QR");
    } finally {
      setLoadingQr(null);
    }
  };

  const { data, isLoading } = useQuery({
    queryKey: ["auditoria-fuec", page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: String(ITEMS_PER_PAGE) });
      const res = await fetch(`${getApiRndcBaseUrl()}/api/contratos?${params}`, {
        headers: { Authorization: `Bearer ${bearerToken}` },
      });
      if (!res.ok) throw new Error("Error al cargar contratos");
      const json = await res.json();
      return {
        items: (json.data || json) as ContratoFUEC[],
        pagination: json.pagination || { page, total: 0, pages: 1 },
      };
    },
    enabled: !!bearerToken,
  });

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
      queryClient.invalidateQueries({ queryKey: ["auditoria-fuec"] });
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
      getContratoLabel(c.contratante, "").toLowerCase().includes(s) ||
      getContratoLabel(c.vehiculo, "").toLowerCase().includes(s) ||
      c.origen?.toLowerCase().includes(s) ||
      c.destino?.toLowerCase().includes(s);
    const matchEstado = estadoFilter === "todos" || c.estado === estadoFilter;
    return matchSearch && matchEstado;
  });

  return (
    <ContentCard>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por FUEC, contratante, vehículo, origen..."
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
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N° FUEC</TableHead>
                  <TableHead>Contratante</TableHead>
                  <TableHead>Vehículo</TableHead>
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
                    <TableCell className="text-sm">
                      {getContratoLabel(c.contratante, "—")}
                    </TableCell>
                    <TableCell className="text-sm">
                      {getContratoLabel(c.vehiculo, "—")}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.origen && c.destino ? `${c.origen} → ${c.destino}` : c.ruta || "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(c.vigenciaInicio)} - {formatDate(c.vigenciaFin)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getEstadoFuecVariant(c.estado)}>{c.estado}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenQR(c)} title="Compartir QR" disabled={loadingQr === c._id}>
                          {loadingQr === c._id ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4 text-primary" />}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setViewingContrato(c)} title="Ver detalle">
                          <Eye className="h-4 w-4" />
                        </Button>
                        {c.pdfUrl && (
                          <Button variant="ghost" size="icon" asChild title="Ver PDF">
                            <a href={c.pdfUrl} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                        {isAdmin && (
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
                        )}
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

      {/* Detail Dialog */}
      <FuecDetailDialog contrato={viewingContrato} onClose={() => setViewingContrato(null)} />

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
    </ContentCard>
  );
}

// ── FUEC Detail Dialog ──

function FuecDetailDialog({ contrato, onClose }: { contrato: ContratoFUEC | null; onClose: () => void }) {
  if (!contrato) return null;

  const fields = [
    { label: "N° FUEC", value: contrato.numeroFUEC },
    { label: "Consecutivo", value: `${contrato.consecutivo} / ${contrato.anio}` },
    { label: "Estado", value: contrato.estado, badge: true },
    { label: "Contratante", value: getContratoLabel(contrato.contratante, "—") },
    { label: "Vehículo", value: getContratoLabel(contrato.vehiculo, "—") },
    { label: "Conductor Principal", value: getContratoLabel(contrato.conductorPrincipal, "—") },
    { label: "Objeto del Contrato", value: contrato.objetoContrato || "—" },
    { label: "Ruta", value: contrato.ruta || "—" },
    { label: "Origen", value: contrato.origen || "—" },
    { label: "Destino", value: contrato.destino || "—" },
    { label: "Recorrido Específico", value: contrato.recorridoEspecifico || "—" },
    { label: "Vigencia Inicio", value: formatDate(contrato.vigenciaInicio) },
    { label: "Vigencia Fin", value: formatDate(contrato.vigenciaFin) },
    { label: "Creado", value: formatDateTime(contrato.createdAt) },
  ];

  const snapshot = contrato.datosSnapshot;

  return (
    <Dialog open={!!contrato} onOpenChange={() => onClose()}>
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
                <Badge variant={getEstadoFuecVariant(String(f.value))}>{f.value}</Badge>
              ) : (
                <span className="text-sm font-medium text-foreground text-right max-w-[60%]">{f.value}</span>
              )}
            </div>
          ))}

          {/* Datos Snapshot */}
          {snapshot && (
            <div className="pt-3 border-t">
              <p className="text-sm font-semibold text-foreground mb-3">Documentos del Vehículo (Snapshot)</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {snapshot.soat && (
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-xs font-semibold text-muted-foreground">SOAT</p>
                    <p className="text-sm">{snapshot.soat.numero}</p>
                    <p className="text-xs text-muted-foreground">Vence: {snapshot.soat.vigencia} — {snapshot.soat.aseguradora}</p>
                  </div>
                )}
                {snapshot.tecnomecanica && (
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-xs font-semibold text-muted-foreground">Tecnomecánica</p>
                    <p className="text-sm">{snapshot.tecnomecanica.numero}</p>
                    <p className="text-xs text-muted-foreground">Vence: {snapshot.tecnomecanica.vigencia} — {snapshot.tecnomecanica.cda}</p>
                  </div>
                )}
                {snapshot.rce && (
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-xs font-semibold text-muted-foreground">RCE</p>
                    <p className="text-sm">{snapshot.rce.numero}</p>
                    <p className="text-xs text-muted-foreground">Vence: {snapshot.rce.vigencia}</p>
                  </div>
                )}
                {snapshot.rcc && (
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-xs font-semibold text-muted-foreground">RCC</p>
                    <p className="text-sm">{snapshot.rcc.numero}</p>
                    <p className="text-xs text-muted-foreground">Vence: {snapshot.rcc.vigencia}</p>
                  </div>
                )}
                {snapshot.tarjetaOperacion && (
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-xs font-semibold text-muted-foreground">Tarjeta Operación</p>
                    <p className="text-sm">{snapshot.tarjetaOperacion.numero}</p>
                    <p className="text-xs text-muted-foreground">Vence: {snapshot.tarjetaOperacion.vigencia}</p>
                  </div>
                )}
                {snapshot.licenciaConductor && (
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-xs font-semibold text-muted-foreground">Licencia Conductor</p>
                    <p className="text-sm">{snapshot.licenciaConductor.numero} ({snapshot.licenciaConductor.categoria})</p>
                    <p className="text-xs text-muted-foreground">Vence: {snapshot.licenciaConductor.vigencia}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* PDF Link */}
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

// ════════════════════════════════════════════════════
// Preoperativas Section
// ════════════════════════════════════════════════════

function PreoperativasSection({ bearerToken, isAdmin, queryClient }: { bearerToken: string | null; isAdmin: boolean; queryClient: any }) {
  const [search, setSearch] = useState("");
  const [estadoFilter, setEstadoFilter] = useState("todos");
  const [viewingPreop, setViewingPreop] = useState<PreoperacionalAPI | null>(null);
  const [qrPreop, setQrPreop] = useState<PreoperacionalAPI | null>(null);

  const { data: preoperacionales, isLoading } = useQuery({
    queryKey: ["auditoria-preoperativas"],
    queryFn: async () => {
      const res = await fetch(`${getApiRndcBaseUrl()}/api/preoperacionales`, {
        headers: { Authorization: `Bearer ${bearerToken}` },
      });
      if (!res.ok) throw new Error("Error al cargar preoperacionales");
      const json = await res.json();
      const list = json.data || json;
      return (Array.isArray(list) ? list : []) as PreoperacionalAPI[];
    },
    enabled: !!bearerToken,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${getApiRndcBaseUrl()}/api/preoperacionales/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${bearerToken}` },
      });
      if (!res.ok) throw new Error("Error al eliminar preoperacional");
    },
    onSuccess: () => {
      toast.success("Preoperacional eliminado");
      queryClient.invalidateQueries({ queryKey: ["auditoria-preoperativas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = preoperacionales?.filter((p) => {
    const s = search.toLowerCase();
    const placa = typeof p.vehiculo === "object" ? p.vehiculo?.placa || "" : "";
    const conductor = typeof p.conductor === "object"
      ? (p.conductor?.nombres ? `${p.conductor.nombres} ${p.conductor.apellidos || ""}` : p.conductor?.nombre || p.conductor?.persona || "")
      : "";
    const matchSearch = !s || placa.toLowerCase().includes(s) || conductor.toLowerCase().includes(s);
    const matchEstado = estadoFilter === "todos" || p.estadoGeneral === estadoFilter;
    return matchSearch && matchEstado;
  }) || [];

  return (
    <ContentCard>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por placa o conductor..."
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
              <SelectItem value="APROBADO">Aprobado</SelectItem>
              <SelectItem value="CON_NOVEDAD">Con Novedad</SelectItem>
              <SelectItem value="RECHAZADO">Rechazado</SelectItem>
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
          <ClipboardCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No se encontraron preoperacionales</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vehículo</TableHead>
                <TableHead>Conductor</TableHead>
                <TableHead>Kilometraje</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Firmado</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => {
                const placa = typeof p.vehiculo === "object" ? p.vehiculo?.placa : p.vehiculo;
                const conductor = typeof p.conductor === "object"
                  ? (p.conductor?.nombres ? `${p.conductor.nombres} ${p.conductor.apellidos || ""}`.trim() : p.conductor?.nombre || p.conductor?.persona)
                  : p.conductor;

                return (
                  <TableRow key={p._id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Truck className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{placa || "—"}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{conductor || "—"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {p.kilometraje?.toLocaleString() || "—"} km
                    </TableCell>
                    <TableCell>
                      <Badge variant={getEstadoPreopVariant(p.estadoGeneral)}>
                        {p.estadoGeneral?.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {p.firmadoCheck ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateTime(p.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {p.codigoPublico && (
                          <Button variant="ghost" size="icon" onClick={() => setQrPreop(p)} title="Compartir QR">
                            <QrCode className="h-4 w-4 text-primary" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => setViewingPreop(p)} title="Ver detalle">
                          <Eye className="h-4 w-4" />
                        </Button>
                        {isAdmin && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" title="Eliminar">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Eliminar preoperacional</AlertDialogTitle>
                                <AlertDialogDescription>
                                  ¿Está seguro de eliminar esta inspección preoperacional? Esta acción enviará el registro a la papelera.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteMutation.mutate(p._id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Eliminar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Detail Dialog */}
      <PreopDetailDialog preop={viewingPreop} onClose={() => setViewingPreop(null)} />

      {/* QR Modal */}
      {qrPreop?.codigoPublico && (
        <QRShareModal
          open={!!qrPreop}
          onClose={() => setQrPreop(null)}
          codigoPublico={qrPreop.codigoPublico}
          placa={typeof qrPreop.vehiculo === "object" ? qrPreop.vehiculo?.placa : qrPreop.vehiculo}
          fecha={formatDateTime(qrPreop.createdAt)}
        />
      )}
    </ContentCard>
  );
}

// ── Preoperativa Detail Dialog ──

function PreopDetailDialog({ preop, onClose }: { preop: PreoperacionalAPI | null; onClose: () => void }) {
  if (!preop) return null;

  const placa = typeof preop.vehiculo === "object" ? preop.vehiculo?.placa : preop.vehiculo;
  const conductor = typeof preop.conductor === "object"
    ? (preop.conductor?.nombres ? `${preop.conductor.nombres} ${preop.conductor.apellidos || ""}`.trim() : preop.conductor?.nombre || preop.conductor?.persona)
    : preop.conductor;

  const renderSection = (
    section: Record<string, { estado: string; observaciones: string; fotoUrl: string }> | undefined,
    title: string
  ) => {
    if (!section) return null;
    const entries = Object.entries(section);
    const fallas = entries.filter(([, v]) => v.estado === "FALLA").length;

    return (
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold">{title}</h4>
          <span className="text-xs text-muted-foreground">
            {entries.length - fallas}/{entries.length} OK
            {fallas > 0 && <span className="text-destructive ml-1">({fallas} fallas)</span>}
          </span>
        </div>
        <div className="space-y-1">
          {entries.map(([key, val]) => (
            <div
              key={key}
              className={`flex items-start gap-2 p-2 rounded-md text-sm ${
                val.estado === "FALLA"
                  ? "bg-red-50 dark:bg-red-900/15 border border-red-200 dark:border-red-800"
                  : "bg-muted/30"
              }`}
            >
              {val.estado === "FALLA" ? (
                <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
              ) : (
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <span className="font-medium">{ITEM_LABELS[key] || key}</span>
                {val.estado === "FALLA" && val.observaciones && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">{val.observaciones}</p>
                )}
              </div>
              <Badge variant={val.estado === "FALLA" ? "destructive" : "default"} className="text-xs shrink-0">
                {val.estado}
              </Badge>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={!!preop} onOpenChange={() => onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl w-[95vw]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            Inspección Preoperacional
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Vehículo</p>
              <p className="font-semibold">{placa || "—"}</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Conductor</p>
              <p className="font-semibold text-sm">{conductor || "—"}</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Kilometraje</p>
              <p className="font-semibold">{preop.kilometraje?.toLocaleString() || "—"} km</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Estado</p>
              <Badge variant={getEstadoPreopVariant(preop.estadoGeneral)} className="mt-1">
                {preop.estadoGeneral?.replace("_", " ")}
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>Firmado: <strong className="text-foreground">{preop.firmadoCheck ? "Sí" : "No"}</strong></span>
            <span>Fecha: <strong className="text-foreground">{formatDateTime(preop.createdAt)}</strong></span>
          </div>

          {preop.firmaConductorUrl && (
            <div className="border rounded-lg overflow-hidden">
              <p className="text-xs font-semibold text-muted-foreground px-3 pt-2 pb-1">Firma del Conductor</p>
              <div className="bg-white dark:bg-gray-950 p-2">
                <img
                  src={preop.firmaConductorUrl}
                  alt="Firma del conductor"
                  className="max-h-32 object-contain mx-auto"
                />
              </div>
            </div>
          )}

          {preop.observaciones && (
            <div className="bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
              <p className="text-sm font-medium">Observaciones</p>
              <p className="text-sm text-muted-foreground mt-1">{preop.observaciones}</p>
            </div>
          )}

          {/* Sections */}
          <div className="space-y-4 pt-2 border-t">
            {renderSection(preop.seccionDelantera, "Sección Delantera")}
            {renderSection(preop.seccionMedia, "Sección Media")}
            {renderSection(preop.seccionTrasera, "Sección Trasera")}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

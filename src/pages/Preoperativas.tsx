import { useState, useMemo } from "react";
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
  Search,
  Filter,
  ClipboardCheck,
  Loader2,
  CheckCircle,
  XCircle,
  Eye,
  List,
  Truck,
  ChevronDown,
  ChevronRight,
  Calendar,
  QrCode,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { QRShareModal } from "@/components/preoperativas/QRShareModal";

// ── Types ──

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
  createdAt?: string;
}

type ViewMode = "lista" | "vehiculo";

// ── Helpers ──

const ITEM_LABELS: Record<string, string> = {
  luces: "Luces", direccionalesDelanteros: "Direccionales Delanteros", limpiabrisas: "Limpiabrisas",
  espejosRetrovisores: "Espejos Retrovisores", liquidos: "Líquidos", llantaDelanteraDerecha: "Llanta Del. Derecha",
  llantaDelanteraIzquierda: "Llanta Del. Izquierda", bocina: "Bocina", frenos: "Frenos", tablero: "Tablero",
  timon: "Timón", cinturones: "Cinturones", pedales: "Pedales", frenoMano: "Freno de Mano", bateria: "Batería",
  kitCarretera: "Kit de Carretera", reflectivos: "Reflectivos", stop: "Stop", llantasRepuesto: "Llantas de Repuesto",
  equipoCarretera: "Equipo de Carretera", llantaTraseraDerecha: "Llanta Tras. Derecha",
  llantaTraseraIzquierda: "Llanta Tras. Izquierda", direccionalesTraseros: "Direccionales Traseros", placa: "Placa",
};

function getPlaca(p: PreoperacionalAPI): string {
  return (typeof p.vehiculo === "object" ? p.vehiculo?.placa : p.vehiculo) || "—";
}

function getConductor(p: PreoperacionalAPI): string {
  if (typeof p.conductor !== "object" || !p.conductor) return String(p.conductor || "—");
  if (p.conductor.nombres) return `${p.conductor.nombres} ${p.conductor.apellidos || ""}`.trim();
  return p.conductor.nombre || p.conductor.persona || "—";
}

function getEstadoBadge(estado: string) {
  const v = estado === "APROBADO" ? "default" : estado === "CON_NOVEDAD" ? "secondary" : "destructive";
  return <Badge variant={v}>{estado?.replace("_", " ")}</Badge>;
}

function formatDateTime(date?: string) {
  if (!date) return "—";
  return format(new Date(date), "dd MMM yyyy HH:mm", { locale: es });
}

function formatDateShort(date?: string) {
  if (!date) return "";
  return format(new Date(date), "yyyy-MM-dd");
}

function countFallas(section?: Record<string, { estado: string }>): number {
  if (!section) return 0;
  return Object.values(section).filter((v) => v.estado === "FALLA").length;
}

// ── Main Component ──

export default function Preoperativas() {
  const { bearerToken } = useAuth();
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<ViewMode>("lista");
  const [searchTerm, setSearchTerm] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [viewingPreop, setViewingPreop] = useState<PreoperacionalAPI | null>(null);
  const [expandedVehiculo, setExpandedVehiculo] = useState<string | null>(null);
  const [qrPreop, setQrPreop] = useState<PreoperacionalAPI | null>(null);

  const { data: preoperacionales, isLoading } = useQuery({
    queryKey: ["preoperacionales-admin"],
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
      toast.success("Preoperacional eliminada");
      queryClient.invalidateQueries({ queryKey: ["preoperacionales-admin"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Filter
  const filtered = useMemo(() => {
    if (!preoperacionales) return [];
    return preoperacionales.filter((p) => {
      const s = searchTerm.toLowerCase();
      const placa = getPlaca(p).toLowerCase();
      const conductor = getConductor(p).toLowerCase();
      const matchSearch = !s || placa.includes(s) || conductor.includes(s);
      const matchEstado = filtroEstado === "todos" || p.estadoGeneral === filtroEstado;

      let matchFecha = true;
      if (fechaDesde || fechaHasta) {
        const pDate = formatDateShort(p.createdAt);
        if (fechaDesde && pDate < fechaDesde) matchFecha = false;
        if (fechaHasta && pDate > fechaHasta) matchFecha = false;
      }

      return matchSearch && matchEstado && matchFecha;
    });
  }, [preoperacionales, searchTerm, filtroEstado, fechaDesde, fechaHasta]);

  // Group by vehiculo for "por vehículo" view
  const groupedByVehiculo = useMemo(() => {
    const map = new Map<string, { placa: string; items: PreoperacionalAPI[] }>();
    for (const p of filtered) {
      const placa = getPlaca(p);
      const key = typeof p.vehiculo === "object" ? p.vehiculo?._id || placa : placa;
      if (!map.has(key)) map.set(key, { placa, items: [] });
      map.get(key)!.items.push(p);
    }
    // Sort by placa
    return Array.from(map.entries()).sort((a, b) => a[1].placa.localeCompare(b[1].placa));
  }, [filtered]);

  return (
    <DashboardLayout>
      <PageContainer>
        <ModuleHeader
          title="Preoperacionales"
          description={`${filtered.length} inspecciones registradas`}
          icon={ClipboardCheck}
          iconVariant="primary"
        />

        {/* Filters */}
        <ContentCard>
          <div className="flex flex-col gap-4">
            {/* Row 1: search + view toggle */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por placa o conductor..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant={viewMode === "lista" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode("lista")}
                  className="gap-1.5"
                >
                  <List className="h-4 w-4" />
                  Lista
                </Button>
                <Button
                  variant={viewMode === "vehiculo" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode("vehiculo")}
                  className="gap-1.5"
                >
                  <Truck className="h-4 w-4" />
                  Por Vehículo
                </Button>
              </div>
            </div>

            {/* Row 2: filters */}
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={filtroEstado} onValueChange={setFiltroEstado}>
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
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={fechaDesde}
                  onChange={(e) => setFechaDesde(e.target.value)}
                  className="w-40"
                  placeholder="Desde"
                />
                <span className="text-muted-foreground text-sm">—</span>
                <Input
                  type="date"
                  value={fechaHasta}
                  onChange={(e) => setFechaHasta(e.target.value)}
                  className="w-40"
                />
              </div>
              {(fechaDesde || fechaHasta || filtroEstado !== "todos" || searchTerm) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setSearchTerm(""); setFiltroEstado("todos"); setFechaDesde(""); setFechaHasta(""); }}
                >
                  Limpiar filtros
                </Button>
              )}
            </div>
          </div>
        </ContentCard>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <ContentCard padding="lg">
            <div className="text-center py-8">
              <ClipboardCheck className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground font-medium">No se encontraron preoperacionales</p>
              <p className="text-sm text-muted-foreground mt-1">Intenta con otros criterios de búsqueda</p>
            </div>
          </ContentCard>
        ) : viewMode === "lista" ? (
          <ListView items={filtered} onView={setViewingPreop} onShareQR={setQrPreop} onDelete={(id) => deleteMutation.mutate(id)} />
        ) : (
          <VehiculoView groups={groupedByVehiculo} onView={setViewingPreop} onShareQR={setQrPreop} onDelete={(id) => deleteMutation.mutate(id)} expandedVehiculo={expandedVehiculo} setExpandedVehiculo={setExpandedVehiculo} />
        )}

        {/* Detail dialog */}
        <PreopDetailDialog preop={viewingPreop} onClose={() => setViewingPreop(null)} />

        {/* QR Modal */}
        {qrPreop?.codigoPublico && (
          <QRShareModal
            open={!!qrPreop}
            onClose={() => setQrPreop(null)}
            codigoPublico={qrPreop.codigoPublico}
            placa={getPlaca(qrPreop)}
            fecha={formatDateTime(qrPreop.createdAt)}
          />
        )}
      </PageContainer>
    </DashboardLayout>
  );
}

// ════════════════════════════════════════
// Lista View
// ════════════════════════════════════════

function ListView({ items, onView, onShareQR, onDelete }: { items: PreoperacionalAPI[]; onView: (p: PreoperacionalAPI) => void; onShareQR: (p: PreoperacionalAPI) => void; onDelete: (id: string) => void }) {
  return (
    <div className="bg-card border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Placa</TableHead>
            <TableHead>Conductor</TableHead>
            <TableHead>Km</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Fallas</TableHead>
            <TableHead>Firmado</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((p) => {
            const totalFallas = countFallas(p.seccionDelantera) + countFallas(p.seccionMedia) + countFallas(p.seccionTrasera);
            return (
              <TableRow key={p._id} className="hover:bg-muted/50">
                <TableCell className="font-semibold">{getPlaca(p)}</TableCell>
                <TableCell className="text-sm">{getConductor(p)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{p.kilometraje?.toLocaleString() || "—"}</TableCell>
                <TableCell>{getEstadoBadge(p.estadoGeneral)}</TableCell>
                <TableCell>
                  {totalFallas > 0 ? (
                    <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 text-sm font-medium">
                      <XCircle className="h-3.5 w-3.5" />
                      {totalFallas}
                    </span>
                  ) : (
                    <span className="text-green-600 dark:text-green-400 text-sm">
                      <CheckCircle className="h-3.5 w-3.5 inline" />
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  {p.firmadoCheck ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{formatDateTime(p.createdAt)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {p.codigoPublico && (
                      <Button variant="ghost" size="icon" onClick={() => onShareQR(p)} title="Compartir QR">
                        <QrCode className="h-4 w-4 text-primary" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => onView(p)} title="Ver detalle">
                      <Eye className="h-4 w-4" />
                    </Button>
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
                            ¿Está seguro de eliminar esta inspección de {getPlaca(p)}? Se enviará a la papelera.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => onDelete(p._id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Eliminar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// ════════════════════════════════════════
// Vehículo View (grouped)
// ════════════════════════════════════════

function VehiculoView({
  groups,
  onView,
  onShareQR,
  onDelete,
  expandedVehiculo,
  setExpandedVehiculo,
}: {
  groups: [string, { placa: string; items: PreoperacionalAPI[] }][];
  onView: (p: PreoperacionalAPI) => void;
  onShareQR: (p: PreoperacionalAPI) => void;
  onDelete: (id: string) => void;
  expandedVehiculo: string | null;
  setExpandedVehiculo: (v: string | null) => void;
}) {
  return (
    <div className="space-y-3">
      {groups.map(([key, { placa, items }]) => {
        const isExpanded = expandedVehiculo === key;
        const aprobados = items.filter((i) => i.estadoGeneral === "APROBADO").length;
        const novedades = items.filter((i) => i.estadoGeneral === "CON_NOVEDAD").length;
        const rechazados = items.filter((i) => i.estadoGeneral === "RECHAZADO").length;

        return (
          <div key={key} className="bg-card border rounded-lg overflow-hidden">
            {/* Vehicle header */}
            <button
              type="button"
              onClick={() => setExpandedVehiculo(isExpanded ? null : key)}
              className="w-full px-5 py-4 flex items-center justify-between hover:bg-muted/30 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                <div className="p-2 rounded-lg bg-primary/10">
                  <Truck className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">{placa}</p>
                  <p className="text-xs text-muted-foreground">{items.length} inspecciones</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {aprobados > 0 && (
                  <span className="inline-flex items-center gap-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium px-2 py-1 rounded-full">
                    {aprobados} aprobados
                  </span>
                )}
                {novedades > 0 && (
                  <span className="inline-flex items-center gap-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-medium px-2 py-1 rounded-full">
                    {novedades} novedades
                  </span>
                )}
                {rechazados > 0 && (
                  <span className="inline-flex items-center gap-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-medium px-2 py-1 rounded-full">
                    {rechazados} rechazados
                  </span>
                )}
              </div>
            </button>

            {/* Inspections list */}
            {isExpanded && (
              <div className="border-t">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Conductor</TableHead>
                      <TableHead>Km</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Fallas</TableHead>
                      <TableHead>Firmado</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((p) => {
                      const totalFallas = countFallas(p.seccionDelantera) + countFallas(p.seccionMedia) + countFallas(p.seccionTrasera);
                      return (
                        <TableRow key={p._id}>
                          <TableCell className="text-sm">{getConductor(p)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{p.kilometraje?.toLocaleString() || "—"}</TableCell>
                          <TableCell>{getEstadoBadge(p.estadoGeneral)}</TableCell>
                          <TableCell>
                            {totalFallas > 0 ? (
                              <span className="text-red-600 dark:text-red-400 text-sm font-medium">{totalFallas}</span>
                            ) : (
                              <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                            )}
                          </TableCell>
                          <TableCell>
                            {p.firmadoCheck ? <CheckCircle className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-red-500" />}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{formatDateTime(p.createdAt)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {p.codigoPublico && (
                                <Button variant="ghost" size="icon" onClick={() => onShareQR(p)} title="Compartir QR">
                                  <QrCode className="h-4 w-4 text-primary" />
                                </Button>
                              )}
                              <Button variant="ghost" size="icon" onClick={() => onView(p)} title="Ver detalle">
                                <Eye className="h-4 w-4" />
                              </Button>
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
                                      ¿Está seguro de eliminar esta inspección de {getPlaca(p)}? Se enviará a la papelera.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => onDelete(p._id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                      Eliminar
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ════════════════════════════════════════
// Detail Dialog
// ════════════════════════════════════════

function PreopDetailDialog({ preop, onClose }: { preop: PreoperacionalAPI | null; onClose: () => void }) {
  if (!preop) return null;

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
            Inspección — {getPlaca(preop)}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Vehículo</p>
              <p className="font-semibold">{getPlaca(preop)}</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Conductor</p>
              <p className="font-semibold text-sm">{getConductor(preop)}</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Kilometraje</p>
              <p className="font-semibold">{preop.kilometraje?.toLocaleString() || "—"} km</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Estado</p>
              <div className="mt-1">{getEstadoBadge(preop.estadoGeneral)}</div>
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

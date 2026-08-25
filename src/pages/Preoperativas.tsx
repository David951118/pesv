import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { getApiRndcBaseUrl } from "@/services/apirndc/apirndc.config";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { ModuleHeader } from "@/components/layout/ModuleHeader";
import { ContentCard } from "@/components/layout/ContentCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  Download,
  FileSpreadsheet,
  Plus,
  FileText,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { QRShareModal } from "@/components/preoperativas/QRShareModal";
import { PreopSeguimiento } from "@/components/preoperativas/PreopSeguimiento";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ExcelJS from "exceljs";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { labelForItem } from "@/lib/preopItems";

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
  seccionAseo?: Record<string, { estado: string; observaciones: string; fotoUrl: string }>;
  seccionConductor?: {
    horasSueno: number;
    estadoSalud: string;
    estadoSaludObservaciones?: string;
    tomaMedicamentos: boolean;
    medicamentosDetalle?: string;
    consumoSustancias: boolean;
    sustanciasDetalle?: string;
    selfieUrl?: string;
  };
  novedades?: Array<{
    _id: string;
    item: string;
    seccion: string;
    descripcion?: string;
    estado: string;
    fechaLimite?: string;
  }>;
  createdAt?: string;
}

type ViewMode = "lista" | "vehiculo";

// ── Helpers ──


function getPlaca(p: PreoperacionalAPI): string {
  return (typeof p.vehiculo === "object" ? p.vehiculo?.placa : p.vehiculo) || "—";
}

function getConductor(p: PreoperacionalAPI): string {
  if (typeof p.conductor !== "object" || !p.conductor) return String(p.conductor || "—");
  if (p.conductor.nombres) return `${p.conductor.nombres} ${p.conductor.apellidos || ""}`.trim();
  return p.conductor.nombre || p.conductor.persona || "—";
}

function getEstadoBadge(estado: string) {
  const v = estado === "APROBADO" ? "default" : estado === "NOVEDAD" ? "secondary" : "destructive";
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
  return Object.values(section).filter((v) => v.estado === "MALO").length;
}

// ── Main Component ──

export default function Preoperativas() {
  const { bearerToken, role } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  // El mecánico consulta novedades pero no crea ni habilita preoperacionales
  const puedeGestionar = role !== "mecanico";
  const [viewMode, setViewMode] = useState<ViewMode>("lista");
  const [searchTerm, setSearchTerm] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [viewingPreop, setViewingPreop] = useState<PreoperacionalAPI | null>(null);
  const [expandedVehiculo, setExpandedVehiculo] = useState<string | null>(null);

  // Export dialog state
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportType, setExportType] = useState<"excel" | "pdf">("excel");
  const [exportPlaca, setExportPlaca] = useState("todos");
  const [exportFechaDesde, setExportFechaDesde] = useState("");
  const [exportFechaHasta, setExportFechaHasta] = useState("");
  const [qrPreop, setQrPreop] = useState<PreoperacionalAPI | null>(null);

  // Habilitar extra state
  const [showHabilitarDialog, setShowHabilitarDialog] = useState(false);
  const [extraVehiculoId, setExtraVehiculoId] = useState("");
  const [extraMotivo, setExtraMotivo] = useState("");

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

  const habilitarExtraMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${getApiRndcBaseUrl()}/api/preoperacionales/habilitar-extra/${extraVehiculoId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${bearerToken}` },
        body: JSON.stringify({ motivo: extraMotivo || undefined }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.message || "Error al habilitar preop extra");
      }
      return res.json();
    },
    onSuccess: (data: any) => {
      toast.success(data?.message || "Preop extra habilitada");
      setShowHabilitarDialog(false);
      setExtraVehiculoId("");
      setExtraMotivo("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Today's vehicles for habilitar extra
  const todayVehiculos = useMemo(() => {
    if (!preoperacionales) return [];
    const today = new Date().toISOString().slice(0, 10);
    const seen = new Map<string, string>();
    for (const p of preoperacionales) {
      const pDate = formatDateShort(p.createdAt);
      if (pDate !== today) continue;
      const vId = typeof p.vehiculo === "object" ? p.vehiculo?._id : p.vehiculo;
      const placa = getPlaca(p);
      if (vId && !seen.has(vId)) seen.set(vId, placa);
    }
    return Array.from(seen.entries()).map(([id, placa]) => ({ id, placa }));
  }, [preoperacionales]);

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

  // ── Unique placas for export filter ──
  const uniquePlacas = useMemo(() => {
    const set = new Set<string>();
    for (const p of preoperacionales || []) set.add(getPlaca(p));
    return Array.from(set).sort();
  }, [preoperacionales]);

  // ── Filtered data for export ──
  const getExportData = () => {
    let data = filtered;
    if (exportPlaca !== "todos") {
      data = data.filter((p) => getPlaca(p) === exportPlaca);
    }
    if (exportFechaDesde || exportFechaHasta) {
      data = data.filter((p) => {
        const pDate = formatDateShort(p.createdAt);
        if (exportFechaDesde && pDate < exportFechaDesde) return false;
        if (exportFechaHasta && pDate > exportFechaHasta) return false;
        return true;
      });
    }
    return data;
  };

  // ── Helper to build export rows ──
  const buildExportRows = (items?: PreoperacionalAPI[]) => {
    return (items || filtered).map((p) => {
      const conductor = getConductor(p);
      const identificacion = typeof p.conductor === "object" && p.conductor
        ? (p.conductor.tipoId ? `${p.conductor.tipoId} ${p.conductor.identificacion}` : p.conductor.identificacion || "—")
        : "—";
      const totalFallas = countFallas(p.seccionDelantera) + countFallas(p.seccionMedia) + countFallas(p.seccionTrasera);
      return {
        fecha: p.createdAt ? format(new Date(p.createdAt), "dd/MM/yyyy HH:mm") : "—",
        placa: getPlaca(p),
        conductor,
        identificacion,
        personaVerificacion: conductor,
        identificacionVerificador: identificacion,
        cargo: "Conductor",
        estado: p.estadoGeneral?.replace("_", " ") || "—",
        kilometraje: p.kilometraje?.toLocaleString() || "—",
        totalFallas: String(totalFallas),
      };
    });
  };

  const EXPORT_HEADERS = [
    "Fecha",
    "Placa",
    "Conductor",
    "Identificación del Conductor",
    "Persona que verificó",
    "Identificación verificador",
    "Cargo",
    "Estado",
    "Kilometraje",
    "Total Fallas",
  ];

  // ── Excel export ──
  const handleExportExcel = async () => {
    const exportData = getExportData();
    const rows = buildExportRows(exportData);
    if (rows.length === 0) {
      toast.error("No hay datos para exportar");
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Preoperacionales");

    // Header row
    const headerRow = sheet.addRow(EXPORT_HEADERS);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E79" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
    });

    // Data rows
    for (const r of rows) {
      sheet.addRow([
        r.fecha,
        r.placa,
        r.conductor,
        r.identificacion,
        r.personaVerificacion,
        r.identificacionVerificador,
        r.cargo,
        r.estado,
        r.kilometraje,
        r.totalFallas,
      ]);
    }

    // Auto-width columns
    sheet.columns.forEach((col) => {
      let maxLen = 12;
      col.eachCell?.({ includeEmpty: true }, (cell) => {
        const len = cell.value ? String(cell.value).length + 2 : 10;
        if (len > maxLen) maxLen = len;
      });
      col.width = Math.min(maxLen, 40);
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `preoperacionales_${format(new Date(), "yyyy-MM-dd")}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exportadas ${rows.length} inspecciones a Excel`);
  };

  // ── PDF export ──
  const handleExportPDF = () => {
    const exportData = getExportData();
    const rows = buildExportRows(exportData);
    if (rows.length === 0) {
      toast.error("No hay datos para exportar");
      return;
    }

    const doc = new jsPDF({ orientation: "landscape" });

    // Title
    doc.setFontSize(16);
    doc.text("Reporte de Inspecciones Preoperacionales", 14, 18);
    doc.setFontSize(10);
    doc.text(`Fecha de generación: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, 26);
    doc.text(`Total registros: ${rows.length}`, 14, 32);

    // Table
    autoTable(doc, {
      startY: 38,
      head: [EXPORT_HEADERS],
      body: rows.map((r) => [
        r.fecha,
        r.placa,
        r.conductor,
        r.identificacion,
        r.personaVerificacion,
        r.identificacionVerificador,
        r.cargo,
        r.estado,
        r.kilometraje,
        r.totalFallas,
      ]),
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [31, 78, 121], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [240, 245, 250] },
    });

    doc.save(`preoperacionales_${format(new Date(), "yyyy-MM-dd")}.pdf`);
    toast.success(`Exportadas ${rows.length} inspecciones a PDF`);
  };

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
                <div className="border-l mx-1" />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setExportType("excel"); setShowExportDialog(true); }}
                  className="gap-1.5"
                  disabled={filtered.length === 0}
                >
                  <FileSpreadsheet className="h-4 w-4 text-green-600" />
                  Exportar Excel
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setExportType("pdf"); setShowExportDialog(true); }}
                  className="gap-1.5"
                  disabled={filtered.length === 0}
                >
                  <FileText className="h-4 w-4 text-red-600" />
                  Exportar PDF
                </Button>
                {puedeGestionar && (
                  <>
                    <div className="border-l mx-1" />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowHabilitarDialog(true)}
                      className="gap-1.5"
                    >
                      <Plus className="h-4 w-4 text-blue-600" />
                      Preop Extra
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => navigate("/preoperativas/nueva")}
                      className="gap-1.5"
                    >
                      <Plus className="h-4 w-4" />
                      Nueva Preoperacional
                    </Button>
                  </>
                )}
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
                    <SelectItem value="NOVEDAD">Con Novedad</SelectItem>
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
        {/* Export Dialog */}
        <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {exportType === "excel" ? <FileSpreadsheet className="h-5 w-5 text-green-600" /> : <FileText className="h-5 w-5 text-red-600" />}
                Exportar {exportType === "excel" ? "Excel" : "PDF"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Vehículo</label>
                <Select value={exportPlaca} onValueChange={setExportPlaca}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos los vehículos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los vehículos</SelectItem>
                    {uniquePlacas.map((placa) => (
                      <SelectItem key={placa} value={placa}>{placa}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Fecha desde</label>
                  <Input
                    type="date"
                    value={exportFechaDesde}
                    onChange={(e) => setExportFechaDesde(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Fecha hasta</label>
                  <Input
                    type="date"
                    value={exportFechaHasta}
                    onChange={(e) => setExportFechaHasta(e.target.value)}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {getExportData().length} registros para exportar
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowExportDialog(false)}>Cancelar</Button>
              <Button
                onClick={() => {
                  if (exportType === "excel") handleExportExcel();
                  else handleExportPDF();
                  setShowExportDialog(false);
                  setExportPlaca("todos");
                  setExportFechaDesde("");
                  setExportFechaHasta("");
                }}
                disabled={getExportData().length === 0}
              >
                Exportar
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Habilitar Preop Extra Dialog */}
        <Dialog open={showHabilitarDialog} onOpenChange={setShowHabilitarDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Habilitar Preoperacional Extra</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Vehículo con preop hoy *</label>
                <Select value={extraVehiculoId} onValueChange={setExtraVehiculoId}>
                  <SelectTrigger><SelectValue placeholder="Seleccione vehículo" /></SelectTrigger>
                  <SelectContent>
                    {todayVehiculos.map((v) => (
                      <SelectItem key={v.id} value={v.id}>{v.placa}</SelectItem>
                    ))}
                    {todayVehiculos.length === 0 && (
                      <div className="px-3 py-2 text-sm text-muted-foreground">No hay vehículos con preop hoy</div>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Motivo (opcional)</label>
                <Input value={extraMotivo} onChange={(e) => setExtraMotivo(e.target.value)} placeholder="Ej: Cambio de conductor" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowHabilitarDialog(false)}>Cancelar</Button>
              <Button onClick={() => habilitarExtraMutation.mutate()} disabled={!extraVehiculoId || habilitarExtraMutation.isPending}>
                {habilitarExtraMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Habilitar
              </Button>
            </div>
          </DialogContent>
        </Dialog>

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
        const novedades = items.filter((i) => i.estadoGeneral === "NOVEDAD").length;
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
  const { bearerToken, apiRoles } = useAuth();
  const queryClient = useQueryClient();
  const [extenderNovedadId, setExtenderNovedadId] = useState<string | null>(null);
  const [extenderDias, setExtenderDias] = useState("15");
  const [extenderMotivo, setExtenderMotivo] = useState("");
  const [showAprobar, setShowAprobar] = useState(false);
  const [aprobarObs, setAprobarObs] = useState("");

  // Solo ADMIN/CLIENTE_ADMIN pueden aprobar de todos modos (AUDITOR es solo lectura).
  const puedeAprobar = (apiRoles ?? []).some((r) =>
    ["ROLE_ADMIN", "ROLE_SUPER_ADMIN", "ROLE_CLIENTE_ADMIN"].includes(r),
  );

  const aprobarMutation = useMutation({
    mutationFn: async (observaciones: string) => {
      const res = await fetch(`${getApiRndcBaseUrl()}/api/preoperacionales/${preop?._id}/aprobar-forzado`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${bearerToken}` },
        body: JSON.stringify({ observaciones }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.message || "Error al aprobar la preoperacional");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Preoperacional aprobada");
      setShowAprobar(false);
      setAprobarObs("");
      queryClient.invalidateQueries({ queryKey: ["preoperacionales-admin"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const extenderMutation = useMutation({
    mutationFn: async ({ novedadId, diasExtra, motivo }: { novedadId: string; diasExtra: number; motivo: string }) => {
      const res = await fetch(`${getApiRndcBaseUrl()}/api/preoperacionales/${preop?._id}/novedades/${novedadId}/extender`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${bearerToken}` },
        body: JSON.stringify({ diasExtra, motivo }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.message || "Error al extender plazo");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Plazo extendido exitosamente");
      setExtenderNovedadId(null);
      setExtenderDias("15");
      setExtenderMotivo("");
      queryClient.invalidateQueries({ queryKey: ["preoperacionales-admin"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!preop) return null;

  const renderSection = (
    section: Record<string, { estado: string; observaciones: string; fotoUrl: string }> | undefined,
    title: string
  ) => {
    if (!section) return null;
    const entries = Object.entries(section);
    const fallas = entries.filter(([, v]) => v.estado === "MALO").length;
    const fotoItems = entries.filter(([, v]) => v.estado === "MALO" && v.fotoUrl);

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
                val.estado === "MALO"
                  ? "bg-red-50 dark:bg-red-900/15 border border-red-200 dark:border-red-800"
                  : val.estado === "REGULAR"
                  ? "bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-800"
                  : "bg-muted/30"
              }`}
            >
              {val.estado === "MALO" ? (
                <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
              ) : val.estado === "REGULAR" ? (
                <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              ) : (
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <span className="font-medium">{labelForItem(key)}</span>
                {(val.estado === "MALO" || val.estado === "REGULAR") && val.observaciones && (
                  <p className={`text-xs mt-0.5 ${val.estado === "MALO" ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}`}>{val.observaciones}</p>
                )}
              </div>
              <Badge variant={val.estado === "MALO" ? "destructive" : val.estado === "REGULAR" ? "secondary" : "default"} className="text-xs shrink-0">
                {val.estado}
              </Badge>
            </div>
          ))}
        </div>

        {/* Fotos de evidencia de fallas */}
        {fotoItems.length > 0 && (
          <div className="mt-3 p-3 bg-red-50/50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-xs font-bold text-red-700 dark:text-red-400 mb-2 uppercase tracking-wide">Evidencias fotográficas</p>
            <div className="flex flex-wrap gap-3">
              {fotoItems.map(([key, val]) => (
                <a key={key} href={val.fotoUrl} target="_blank" rel="noreferrer" className="block">
                  <img
                    src={val.fotoUrl}
                    alt={`Evidencia ${labelForItem(key)}`}
                    className="h-28 w-40 object-cover rounded-lg border-2 border-red-200 dark:border-red-800 shadow-sm hover:scale-105 transition-transform"
                  />
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1 font-medium text-center max-w-[10rem] truncate">{labelForItem(key)}</p>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={!!preop} onOpenChange={() => onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl w-[95vw]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-3">
              <ClipboardCheck className="h-5 w-5 text-primary" />
              Inspección — {getPlaca(preop)}
            </DialogTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                let codigo = preop.codigoPublico;
                // Si no hay código público, intentar obtenerlo del detalle completo
                if (!codigo) {
                  try {
                    toast.loading("Obteniendo datos...");
                    const res = await fetch(`${getApiRndcBaseUrl()}/api/preoperacionales/${preop._id}`, {
                      headers: { Authorization: `Bearer ${bearerToken}` },
                    });
                    if (res.ok) {
                      const json = await res.json();
                      const detail = json.data ?? json;
                      codigo = detail.codigoPublico;
                    }
                    toast.dismiss();
                  } catch {
                    toast.dismiss();
                  }
                }
                if (!codigo) {
                  toast.error("No se puede descargar sin código público");
                  return;
                }
                // Abrimos la vista publica en una pestana nueva con ?print=1.
                // La vista hace window.print() cuando terminan de cargar las imagenes.
                const win = window.open(`/verificar/preoperacional/${codigo}?print=1`, "_blank");
                if (!win) {
                  toast.error("Permita las ventanas emergentes para descargar el PDF");
                  return;
                }
                toast.success("Preparando PDF...");
              }}
              className="gap-1.5 mr-6"
            >
              <Download className="h-4 w-4" />
              Descargar PDF
            </Button>
          </div>
        </DialogHeader>

        <Tabs defaultValue="detalle" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-3">
            <TabsTrigger value="detalle">Detalle</TabsTrigger>
            <TabsTrigger value="seguimiento">Seguimiento</TabsTrigger>
          </TabsList>

          <TabsContent value="detalle" className="space-y-4 mt-0">
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

          {/* Aprobar de todos modos (resuelve novedades no corregibles: salud/sueño/sustancias) */}
          {puedeAprobar && preop.estadoGeneral !== "APROBADO" && (
            <div className="border rounded-lg p-3 bg-muted/20 space-y-2">
              {!showAprobar ? (
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">
                    ¿La novedad ya fue atendida? Puede aprobar la preoperacional de todos modos (deja registro).
                  </p>
                  <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={() => setShowAprobar(true)}>
                    <CheckCircle className="h-4 w-4" />
                    Aprobar de todos modos
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Aprobar de todos modos</p>
                  <Textarea
                    value={aprobarObs}
                    onChange={(e) => setAprobarObs(e.target.value)}
                    placeholder="Motivo / observación de la aprobación (obligatorio, mín. 5 caracteres)"
                    rows={2}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={aprobarMutation.isPending || aprobarObs.trim().length < 5}
                      onClick={() => aprobarMutation.mutate(aprobarObs.trim())}
                    >
                      {aprobarMutation.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                      Confirmar aprobación
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setShowAprobar(false); setAprobarObs(""); }}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

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

          {/* Salud del Conductor */}
          {preop.seccionConductor && (
            <div className="bg-muted/30 rounded-lg p-4 space-y-3">
              <h4 className="text-sm font-semibold">Salud del Conductor</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Horas de Sueño</p>
                  <p className={`font-medium ${(preop.seccionConductor.horasSueno ?? 8) < 8 ? "text-destructive" : ""}`}>
                    {preop.seccionConductor.horasSueno}h
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Estado de Salud</p>
                  <Badge variant={preop.seccionConductor.estadoSalud === "BUENO" ? "default" : preop.seccionConductor.estadoSalud === "REGULAR" ? "secondary" : "destructive"}>
                    {preop.seccionConductor.estadoSalud}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Medicamentos</p>
                  <p className="font-medium">{preop.seccionConductor.tomaMedicamentos ? "Sí" : "No"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Sustancias</p>
                  <p className={`font-medium ${preop.seccionConductor.consumoSustancias ? "text-destructive" : ""}`}>
                    {preop.seccionConductor.consumoSustancias ? "Sí" : "No"}
                  </p>
                </div>
              </div>

              {/* Detalles / observaciones de salud */}
              {preop.seccionConductor.estadoSaludObservaciones && (
                <div>
                  <p className="text-xs text-muted-foreground">Observaciones de salud</p>
                  <p className="text-sm">{preop.seccionConductor.estadoSaludObservaciones}</p>
                </div>
              )}
              {preop.seccionConductor.tomaMedicamentos && preop.seccionConductor.medicamentosDetalle && (
                <div>
                  <p className="text-xs text-muted-foreground">Detalle de medicamentos</p>
                  <p className="text-sm">{preop.seccionConductor.medicamentosDetalle}</p>
                </div>
              )}
              {preop.seccionConductor.consumoSustancias && preop.seccionConductor.sustanciasDetalle && (
                <div>
                  <p className="text-xs text-muted-foreground">Detalle de sustancias</p>
                  <p className="text-sm">{preop.seccionConductor.sustanciasDetalle}</p>
                </div>
              )}

              {preop.seccionConductor.selfieUrl && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Selfie del conductor</p>
                  <a href={preop.seccionConductor.selfieUrl} target="_blank" rel="noreferrer">
                    <img src={preop.seccionConductor.selfieUrl} alt="Selfie conductor" className="h-24 w-24 rounded-lg object-cover border" />
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Sections */}
          <div className="space-y-4 pt-2 border-t">
            {renderSection(preop.seccionDelantera, "Sección Delantera")}
            {renderSection(preop.seccionMedia, "Sección Media")}
            {renderSection(preop.seccionTrasera, "Sección Trasera")}
            {renderSection(preop.seccionAseo, "Sección Aseo")}
          </div>

          {/* Novedades */}
          {preop.novedades && preop.novedades.length > 0 && (
            <div className="space-y-3 pt-2 border-t">
              <h4 className="text-sm font-semibold">Novedades</h4>
              {preop.novedades.map((nov) => (
                <div key={nov._id} className="bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-800 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{labelForItem(nov.item)} — {nov.seccion}</p>
                      {nov.descripcion && <p className="text-xs text-muted-foreground">{nov.descripcion}</p>}
                    </div>
                    <Badge variant={nov.estado === "RESUELTA" ? "default" : "secondary"}>{nov.estado}</Badge>
                  </div>
                  {nov.fechaLimite && (
                    <p className="text-xs text-muted-foreground">Fecha límite: {formatDateTime(nov.fechaLimite)}</p>
                  )}
                  {nov.estado !== "RESUELTA" && puedeAprobar && (
                    <>
                      {extenderNovedadId === nov._id ? (
                        <div className="flex flex-col gap-2 bg-white dark:bg-gray-900 rounded-md p-3 border">
                          <div className="flex gap-2">
                            <Input
                              type="number"
                              min="1"
                              value={extenderDias}
                              onChange={(e) => setExtenderDias(e.target.value)}
                              placeholder="Días extra"
                              className="w-24"
                            />
                            <Input
                              value={extenderMotivo}
                              onChange={(e) => setExtenderMotivo(e.target.value)}
                              placeholder="Motivo (ej: Repuesto en camino)"
                              className="flex-1"
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              disabled={extenderMutation.isPending || !extenderMotivo}
                              onClick={() => extenderMutation.mutate({ novedadId: nov._id, diasExtra: Number(extenderDias), motivo: extenderMotivo })}
                            >
                              {extenderMutation.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                              Confirmar
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setExtenderNovedadId(null)}>Cancelar</Button>
                          </div>
                        </div>
                      ) : (
                        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setExtenderNovedadId(nov._id)}>
                          <Calendar className="h-3 w-3" />
                          Extender Plazo
                        </Button>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
          </TabsContent>

          <TabsContent value="seguimiento" className="mt-0">
            <PreopSeguimiento
              preopId={preop._id}
              onUpdate={() => queryClient.invalidateQueries({ queryKey: ["preoperacionales-admin"] })}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

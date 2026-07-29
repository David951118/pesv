import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { getApiRndcBaseUrl } from "@/services/apirndc/apirndc.config";
import { getKpisGerenciales } from "@/services/apirndc";
import { formatCOP, formatKm } from "@/components/mantenimiento/mantenimiento.helpers";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { ModuleHeader } from "@/components/layout/ModuleHeader";
import { ContentCard } from "@/components/layout/ContentCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  PieChart as PieIcon,
  TrendingUp,
  Moon,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Calendar,
  Gauge,
  Activity,
  DollarSign,
  Wallet,
  Trophy,
} from "lucide-react";
import type { ApiRndcKpisGerenciales } from "@/services/apirndc/apirndc.types";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";

// ── Types ──

interface ResumenData {
  total: number;
  aprobadas: number;
  conNovedad: number;
  rechazadas: number;
}

interface FalloItem {
  item: string;
  tipo: string;
  total: number;
  resueltas: number;
  pendientes: number;
}

interface PorMes {
  _id: { anio: number; mes: number; estado: string };
  total: number;
}

interface SuenoData {
  totalNovedadesSueno: number;
  promedio: number;
  minimo: number;
  maximo: number;
}

interface VehiculoFalla {
  placa: string;
  numeroInterno: string;
  totalNovedades: number;
}

interface AnotacionesData {
  total: number;
  porTipo: Record<string, number>;
}

interface CorreccionesData {
  pendientes: number;
  enRevision: number;
  validadas: number;
  rechazadas: number;
}

interface EstadisticasData {
  resumen: ResumenData;
  fallosPorItem: FalloItem[];
  porMes: PorMes[];
  sueno: SuenoData;
  vehiculosConMasFallas: VehiculoFalla[];
  anotaciones: AnotacionesData;
  correcciones: CorreccionesData;
}

interface VehiculoOption {
  _id: string;
  placa: string;
  numeroInterno?: string;
}

interface TerceroOption {
  _id: string;
  nombres?: string;
  apellidos?: string;
  nombreCompleto?: string;
  rol?: string;
  tipo?: string;
  roles?: string[];
}

// ── Item labels ──
const ITEM_LABELS: Record<string, string> = {
  luces: "Luces",
  direccionalesDelanteros: "Direccionales Delanteros",
  limpiabrisas: "Limpiabrisas",
  parabrisas: "Parabrisas",
  espejosRetrovisores: "Espejos Retrovisores",
  liquidos: "Líquidos",
  llantaDelanteraDerecha: "Llanta Del. Derecha",
  llantaDelanteraIzquierda: "Llanta Del. Izquierda",
  bocina: "Bocina",
  frenos: "Frenos",
  tablero: "Tablero",
  timon: "Timón",
  cinturones: "Cinturones",
  pedales: "Pedales",
  frenoMano: "Freno de Mano",
  bateria: "Batería",
  kitPrimerosAuxilios: "Kit Primeros Auxilios",
  reflectivos: "Reflectivos",
  stop: "Stop",
  llantasRepuesto: "Llantas de Repuesto",
  equipoCarretera: "Equipo de Carretera",
  llantaTraseraDerecha: "Llanta Tras. Derecha",
  llantaTraseraIzquierda: "Llanta Tras. Izquierda",
  direccionalesTraseros: "Direccionales Traseros",
  placa: "Placa",
  extintor: "Extintor",
  herramienta: "Herramienta",
};

function labelForItem(raw: string): string {
  if (!raw) return "";
  const parts = raw.split(".");
  const last = parts[parts.length - 1];
  return ITEM_LABELS[last] || last;
}

// ── Colors ──
const COLOR_APROBADO = "#22c55e"; // green-500 (vibrant)
const COLOR_NOVEDAD = "#fbbf24"; // amber-400 (vibrant)
const COLOR_RECHAZADO = "#ef4444"; // red-500 (vibrant)
const COLOR_PRIMARY = "#3b82f6"; // blue-500 (vibrant)
const COLOR_PURPLE = "#a855f7"; // purple-500
const COLOR_CYAN = "#06b6d4"; // cyan-500
const COLOR_PINK = "#ec4899"; // pink-500
const COLOR_INFO = "#0ea5e9"; // sky-500
const COLOR_GRAY = "#64748b";

const CORRECCIONES_COLORS: Record<string, string> = {
  pendientes: COLOR_NOVEDAD,
  enRevision: COLOR_INFO,
  validadas: COLOR_APROBADO,
  rechazadas: COLOR_RECHAZADO,
};

const ANOTACIONES_COLORS: Record<string, string> = {
  GENERAL: COLOR_PRIMARY,
  VALIDACION: COLOR_APROBADO,
  REVISION: COLOR_PURPLE,
};

type ChartType = "pie" | "fallos" | "mensual" | "stacked";

// ── Component ──

export default function Estadisticas() {
  const { bearerToken } = useAuth();
  // Detect dark mode for chart axis colors
  const [isDark, setIsDark] = useState(() => typeof document !== "undefined" && document.documentElement.classList.contains("dark"));
  useEffect(() => {
    const obs = new MutationObserver(() => setIsDark(document.documentElement.classList.contains("dark")));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  const axisColor = isDark ? "#cbd5e1" : "#475569"; // slate-300 / slate-600
  const gridColor = isDark ? "#334155" : "#e2e8f0"; // slate-700 / slate-200
  const tooltipBg = isDark ? "#1e293b" : "#ffffff"; // slate-800 / white
  const tooltipBorder = isDark ? "#334155" : "#e2e8f0";

  // Filters
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [vehiculoId, setVehiculoId] = useState<string>("all");
  const [conductorId, setConductorId] = useState<string>("all");
  const [chartType, setChartType] = useState<ChartType>("pie");

  // Filtros del tab gerencial (rango opcional, por defecto histórico completo)
  const [kpiDesde, setKpiDesde] = useState("");
  const [kpiHasta, setKpiHasta] = useState("");

  const clearFilters = () => {
    setFechaDesde("");
    setFechaHasta("");
    setVehiculoId("all");
    setConductorId("all");
  };

  // Fetch vehiculos
  const { data: vehiculos = [] } = useQuery({
    queryKey: ["estadisticas-vehiculos"],
    queryFn: async () => {
      const res = await fetch(`${getApiRndcBaseUrl()}/api/vehiculos`, {
        headers: { Authorization: `Bearer ${bearerToken}` },
      });
      if (!res.ok) throw new Error("Error al cargar vehículos");
      const json = await res.json();
      return (json.data ?? json) as VehiculoOption[];
    },
    enabled: !!bearerToken,
  });

  // Fetch conductores (terceros)
  const { data: terceros = [] } = useQuery({
    queryKey: ["estadisticas-terceros"],
    queryFn: async () => {
      const res = await fetch(`${getApiRndcBaseUrl()}/api/terceros`, {
        headers: { Authorization: `Bearer ${bearerToken}` },
      });
      if (!res.ok) throw new Error("Error al cargar terceros");
      const json = await res.json();
      return (json.data ?? json) as TerceroOption[];
    },
    enabled: !!bearerToken,
  });

  const conductores = useMemo(() => {
    return terceros.filter((t) => {
      const rol = (t.rol || t.tipo || "").toString().toUpperCase();
      const roles = (t.roles || []).map((r) => r.toString().toUpperCase());
      return rol.includes("CONDUCTOR") || roles.includes("CONDUCTOR");
    });
  }, [terceros]);

  // Fetch estadisticas
  const { data: estadisticas, isLoading } = useQuery({
    queryKey: [
      "estadisticas-preoperacionales",
      fechaDesde,
      fechaHasta,
      vehiculoId,
      conductorId,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (fechaDesde) params.set("fechaDesde", fechaDesde);
      if (fechaHasta) params.set("fechaHasta", fechaHasta);
      if (vehiculoId && vehiculoId !== "all") params.set("vehiculoId", vehiculoId);
      if (conductorId && conductorId !== "all") params.set("conductorId", conductorId);
      const qs = params.toString();
      const res = await fetch(
        `${getApiRndcBaseUrl()}/api/preoperacionales/estadisticas${qs ? `?${qs}` : ""}`,
        { headers: { Authorization: `Bearer ${bearerToken}` } }
      );
      if (!res.ok) throw new Error("Error al cargar estadísticas");
      const json = await res.json();
      return (json.data ?? json) as EstadisticasData;
    },
    enabled: !!bearerToken,
  });

  // Pie data — estado general
  const pieData = useMemo(() => {
    const r = estadisticas?.resumen;
    if (!r) return [];
    return [
      { name: "Aprobadas", value: r.aprobadas, color: COLOR_APROBADO },
      { name: "Con Novedad", value: r.conNovedad, color: COLOR_NOVEDAD },
      { name: "Rechazadas", value: r.rechazadas, color: COLOR_RECHAZADO },
    ].filter((d) => d.value > 0);
  }, [estadisticas]);

  // Fallos por item (top 10)
  const fallosBarData = useMemo(() => {
    if (!estadisticas?.fallosPorItem) return [];
    return [...estadisticas.fallosPorItem]
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)
      .map((f) => ({
        name: labelForItem(f.item),
        total: f.total,
        resueltas: f.resueltas,
        pendientes: f.pendientes,
      }));
  }, [estadisticas]);

  // Mensual
  const mensualData = useMemo(() => {
    if (!estadisticas?.porMes) return [];
    const map = new Map<
      string,
      { mes: string; APROBADO: number; NOVEDAD: number; RECHAZADO: number }
    >();
    estadisticas.porMes.forEach((p) => {
      const key = `${p._id.anio}-${String(p._id.mes).padStart(2, "0")}`;
      if (!map.has(key)) {
        map.set(key, { mes: key, APROBADO: 0, NOVEDAD: 0, RECHAZADO: 0 });
      }
      const entry = map.get(key)!;
      const estado = (p._id.estado || "").toUpperCase();
      if (estado.includes("APROBADO")) entry.APROBADO += p.total;
      else if (estado.includes("RECHAZADO")) entry.RECHAZADO += p.total;
      else entry.NOVEDAD += p.total;
    });
    return Array.from(map.values()).sort((a, b) => a.mes.localeCompare(b.mes));
  }, [estadisticas]);

  // Correcciones pie
  const correccionesData = useMemo(() => {
    const c = estadisticas?.correcciones;
    if (!c) return [];
    return [
      { name: "Pendientes", value: c.pendientes, color: CORRECCIONES_COLORS.pendientes },
      { name: "En Revisión", value: c.enRevision, color: CORRECCIONES_COLORS.enRevision },
      { name: "Validadas", value: c.validadas, color: CORRECCIONES_COLORS.validadas },
      { name: "Rechazadas", value: c.rechazadas, color: CORRECCIONES_COLORS.rechazadas },
    ].filter((d) => d.value > 0);
  }, [estadisticas]);

  // Anotaciones pie
  const anotacionesData = useMemo(() => {
    const a = estadisticas?.anotaciones;
    if (!a?.porTipo) return [];
    return Object.entries(a.porTipo)
      .map(([k, v]) => ({
        name: k,
        value: v,
        color: ANOTACIONES_COLORS[k] || COLOR_GRAY,
      }))
      .filter((d) => d.value > 0);
  }, [estadisticas]);

  // ── KPIs Gerenciales ──
  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ["kpis-gerenciales", { desde: kpiDesde, hasta: kpiHasta }],
    queryFn: async ({ signal }) => {
      const params: { desde?: string; hasta?: string } = {};
      if (kpiDesde) params.desde = kpiDesde;
      if (kpiHasta) params.hasta = kpiHasta;
      const res = await getKpisGerenciales(params, signal);
      return (res.data ?? null) as ApiRndcKpisGerenciales | null;
    },
    enabled: !!bearerToken,
  });

  // Pie Preventivo vs Correctivo
  const kpiPieData = useMemo(() => {
    const m = kpis?.mantenimiento;
    if (!m) return [];
    return [
      { name: "Preventivo", value: m.preventivos, color: COLOR_PRIMARY },
      { name: "Correctivo", value: m.correctivos, color: COLOR_RECHAZADO },
    ].filter((d) => d.value > 0);
  }, [kpis]);

  // Top 10 vehículos más costosos (barras apiladas)
  const kpiBarData = useMemo(() => {
    if (!kpis?.rankingVehiculos) return [];
    return kpis.rankingVehiculos.slice(0, 10).map((v) => ({
      placa: v.placa,
      costoMantenimiento: v.costoMantenimiento,
      costoCombustible: v.costoCombustible,
    }));
  }, [kpis]);

  const renderChart = () => {
    switch (chartType) {
      case "pie":
        return (
          <ResponsiveContainer width="100%" height={360}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={120}
                label={(e: any) => `${e.name}: ${e.value}`}
              >
                {pieData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8, color: axisColor }} />
              <Legend wrapperStyle={{ color: axisColor }} />
            </PieChart>
          </ResponsiveContainer>
        );
      case "fallos":
        return (
          <ResponsiveContainer width="100%" height={360}>
            <BarChart data={fallosBarData}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="name" angle={-25} textAnchor="end" interval={0} height={80} fontSize={11} stroke={axisColor} tick={{ fill: axisColor }} />
              <YAxis stroke={axisColor} tick={{ fill: axisColor }} />
              <Tooltip contentStyle={{ backgroundColor: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8, color: axisColor }} />
              <Legend wrapperStyle={{ color: axisColor }} />
              <Bar dataKey="total" fill={COLOR_PRIMARY} name="Total" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );
      case "mensual":
        return (
          <ResponsiveContainer width="100%" height={360}>
            <LineChart data={mensualData}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="mes" stroke={axisColor} tick={{ fill: axisColor }} />
              <YAxis stroke={axisColor} tick={{ fill: axisColor }} />
              <Tooltip contentStyle={{ backgroundColor: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8, color: axisColor }} />
              <Legend wrapperStyle={{ color: axisColor }} />
              <Line type="monotone" dataKey="APROBADO" stroke={COLOR_APROBADO} strokeWidth={3} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="NOVEDAD" stroke={COLOR_NOVEDAD} strokeWidth={3} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="RECHAZADO" stroke={COLOR_RECHAZADO} strokeWidth={3} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        );
      case "stacked":
        return (
          <ResponsiveContainer width="100%" height={360}>
            <BarChart data={fallosBarData}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="name" angle={-25} textAnchor="end" interval={0} height={80} fontSize={11} stroke={axisColor} tick={{ fill: axisColor }} />
              <YAxis stroke={axisColor} tick={{ fill: axisColor }} />
              <Tooltip contentStyle={{ backgroundColor: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8, color: axisColor }} />
              <Legend wrapperStyle={{ color: axisColor }} />
              <Bar dataKey="resueltas" stackId="a" fill={COLOR_APROBADO} name="Resueltas" />
              <Bar dataKey="pendientes" stackId="a" fill={COLOR_RECHAZADO} name="Pendientes" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );
    }
  };

  const chartButtons: { key: ChartType; label: string; icon: typeof PieIcon }[] = [
    { key: "pie", label: "Estado general", icon: PieIcon },
    { key: "fallos", label: "Fallos por ítem", icon: BarChart3 },
    { key: "mensual", label: "Evolución mensual", icon: TrendingUp },
    { key: "stacked", label: "Pendientes vs Resueltas", icon: BarChart3 },
  ];

  const resumen = estadisticas?.resumen;
  const sueno = estadisticas?.sueno;

  return (
    <DashboardLayout>
      <PageContainer>
        <ModuleHeader
          title="Estadísticas"
          description="Métricas e indicadores de la flota"
          icon={BarChart3}
        />

        <Tabs defaultValue="preoperacionales" className="mt-6">
          <TabsList>
            <TabsTrigger value="preoperacionales">Preoperacionales</TabsTrigger>
            <TabsTrigger value="gerencial">Gerencial (KPIs)</TabsTrigger>
          </TabsList>

          <TabsContent value="preoperacionales">

        {/* Filtros */}
        <ContentCard className="mt-6" header={{ title: "Filtros", icon: <Calendar className="h-4 w-4" /> }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Fecha desde</label>
              <Input
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Fecha hasta</label>
              <Input
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Vehículo</label>
              <Select value={vehiculoId} onValueChange={setVehiculoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {vehiculos.map((v) => (
                    <SelectItem key={v._id} value={v._id}>
                      {v.placa}
                      {v.numeroInterno ? ` — #${v.numeroInterno}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Conductor</label>
              <Select value={conductorId} onValueChange={setConductorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {conductores.map((c) => {
                    const nombre =
                      c.nombreCompleto ||
                      `${c.nombres || ""} ${c.apellidos || ""}`.trim() ||
                      c._id;
                    return (
                      <SelectItem key={c._id} value={c._id}>
                        {nombre}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button variant="outline" onClick={clearFilters} className="w-full">
                Limpiar filtros
              </Button>
            </div>
          </div>
        </ContentCard>

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          <ContentCard>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-3xl font-bold">{resumen?.total ?? 0}</p>
              </div>
              <div className="p-3 rounded-lg bg-primary/10 text-primary">
                <BarChart3 className="h-6 w-6" />
              </div>
            </div>
          </ContentCard>
          <ContentCard className="border-l-4 border-l-green-600">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Aprobadas</p>
                <p className="text-3xl font-bold text-green-600">
                  {resumen?.aprobadas ?? 0}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-green-100 text-green-600">
                <CheckCircle className="h-6 w-6" />
              </div>
            </div>
          </ContentCard>
          <ContentCard className="border-l-4 border-l-amber-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Con Novedad</p>
                <p className="text-3xl font-bold text-amber-600">
                  {resumen?.conNovedad ?? 0}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-amber-100 text-amber-600">
                <AlertTriangle className="h-6 w-6" />
              </div>
            </div>
          </ContentCard>
          <ContentCard className="border-l-4 border-l-red-600">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Rechazadas</p>
                <p className="text-3xl font-bold text-red-600">
                  {resumen?.rechazadas ?? 0}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-red-100 text-red-600">
                <XCircle className="h-6 w-6" />
              </div>
            </div>
          </ContentCard>
        </div>

        {/* Selectable charts */}
        <ContentCard
          className="mt-6"
          header={{
            title: "Gráficos",
            subtitle: "Selecciona el tipo de gráfico",
            icon: <BarChart3 className="h-4 w-4" />,
          }}
        >
          <div className="flex flex-wrap gap-2 mb-4">
            {chartButtons.map((btn) => {
              const Icon = btn.icon;
              const active = chartType === btn.key;
              return (
                <Button
                  key={btn.key}
                  size="sm"
                  variant={active ? "default" : "outline"}
                  onClick={() => setChartType(btn.key)}
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {btn.label}
                </Button>
              );
            })}
          </div>
          {isLoading ? (
            <div className="h-[360px] flex items-center justify-center text-muted-foreground">
              Cargando...
            </div>
          ) : (
            renderChart()
          )}
        </ContentCard>

        {/* Sueño + Correcciones + Anotaciones */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          <ContentCard
            header={{
              title: "Estadísticas de sueño",
              icon: <Moon className="h-4 w-4" />,
            }}
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-muted/40">
                <p className="text-xs text-muted-foreground">Promedio</p>
                <p className="text-2xl font-bold">
                  {sueno?.promedio?.toFixed?.(1) ?? "0.0"}
                  <span className="text-sm font-normal text-muted-foreground ml-1">h</span>
                </p>
              </div>
              <div className="p-3 rounded-lg bg-muted/40">
                <p className="text-xs text-muted-foreground">Novedades sueño</p>
                <p className="text-2xl font-bold text-amber-600">
                  {sueno?.totalNovedadesSueno ?? 0}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-muted/40">
                <p className="text-xs text-muted-foreground">Mínimo</p>
                <p className="text-2xl font-bold text-red-600">
                  {sueno?.minimo ?? 0}
                  <span className="text-sm font-normal text-muted-foreground ml-1">h</span>
                </p>
              </div>
              <div className="p-3 rounded-lg bg-muted/40">
                <p className="text-xs text-muted-foreground">Máximo</p>
                <p className="text-2xl font-bold text-green-600">
                  {sueno?.maximo ?? 0}
                  <span className="text-sm font-normal text-muted-foreground ml-1">h</span>
                </p>
              </div>
            </div>
          </ContentCard>

          <ContentCard
            header={{
              title: "Correcciones",
              icon: <PieIcon className="h-4 w-4" />,
            }}
          >
            {correccionesData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={correccionesData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={(e: any) => e.value}
                  >
                    {correccionesData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8, color: axisColor }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[240px] flex items-center justify-center text-muted-foreground text-sm">
                Sin datos
              </div>
            )}
          </ContentCard>

          <ContentCard
            header={{
              title: "Anotaciones",
              subtitle: `Total: ${estadisticas?.anotaciones?.total ?? 0}`,
              icon: <PieIcon className="h-4 w-4" />,
            }}
          >
            {anotacionesData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={anotacionesData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={(e: any) => e.value}
                  >
                    {anotacionesData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8, color: axisColor }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[240px] flex items-center justify-center text-muted-foreground text-sm">
                Sin datos
              </div>
            )}
          </ContentCard>
        </div>

        {/* Top vehiculos con más fallas */}
        <ContentCard
          className="mt-6"
          header={{
            title: "Top vehículos con más fallas",
            icon: <AlertTriangle className="h-4 w-4" />,
          }}
        >
          {estadisticas?.vehiculosConMasFallas?.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Placa</TableHead>
                  <TableHead>N° Interno</TableHead>
                  <TableHead className="text-right">Total novedades</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {estadisticas.vehiculosConMasFallas.map((v, i) => (
                  <TableRow key={`${v.placa}-${i}`}>
                    <TableCell className="font-medium">{v.placa}</TableCell>
                    <TableCell>{v.numeroInterno || "—"}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="destructive">{v.totalNovedades}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">Sin datos</p>
          )}
        </ContentCard>

        {/* Fallos por item detallado */}
        <ContentCard
          className="mt-6 mb-6"
          header={{
            title: "Fallos por ítem — detalle",
            icon: <BarChart3 className="h-4 w-4" />,
          }}
        >
          {estadisticas?.fallosPorItem?.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ítem</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Resueltas</TableHead>
                  <TableHead className="text-right">Pendientes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...estadisticas.fallosPorItem]
                  .sort((a, b) => b.total - a.total)
                  .map((f, i) => (
                    <TableRow key={`${f.item}-${f.tipo}-${i}`}>
                      <TableCell className="font-medium">{labelForItem(f.item)}</TableCell>
                      <TableCell>
                        <Badge
                          variant={f.tipo === "MALO" ? "destructive" : "secondary"}
                        >
                          {f.tipo}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{f.total}</TableCell>
                      <TableCell className="text-right text-green-600">
                        {f.resueltas}
                      </TableCell>
                      <TableCell className="text-right text-red-600">
                        {f.pendientes}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">Sin datos</p>
          )}
        </ContentCard>

          </TabsContent>

          {/* ── Tab Gerencial (KPIs) ── */}
          <TabsContent value="gerencial">
            {/* Filtro de rango de fechas (opcional) */}
            <ContentCard
              className="mt-6"
              header={{ title: "Filtros", subtitle: "Rango opcional — por defecto histórico completo", icon: <Calendar className="h-4 w-4" /> }}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Desde</label>
                  <Input type="date" value={kpiDesde} onChange={(e) => setKpiDesde(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Hasta</label>
                  <Input type="date" value={kpiHasta} onChange={(e) => setKpiHasta(e.target.value)} />
                </div>
                <div className="flex items-end">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setKpiDesde("");
                      setKpiHasta("");
                    }}
                    className="w-full"
                  >
                    Limpiar rango
                  </Button>
                </div>
              </div>
            </ContentCard>

            {kpisLoading ? (
              <div className="mt-6 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-28 w-full rounded-lg" />
                  ))}
                </div>
                <Skeleton className="h-[320px] w-full rounded-lg" />
                <Skeleton className="h-[360px] w-full rounded-lg" />
              </div>
            ) : !kpis ? (
              <ContentCard className="mt-6">
                <p className="text-sm text-muted-foreground text-center py-10">
                  Sin datos para el periodo
                </p>
              </ContentCard>
            ) : (
              <>
                {/* KPI cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
                  <ContentCard className="border-l-4 border-l-green-600">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">Disponibilidad de flota</p>
                        <p className="text-3xl font-bold text-green-600">
                          {kpis.flota.disponibilidad !== null
                            ? `${kpis.flota.disponibilidad.toFixed(1)}%`
                            : "—"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {kpis.flota.disponibles}/{kpis.flota.total} disponibles
                        </p>
                      </div>
                      <div className="p-3 rounded-lg bg-green-100 text-green-600">
                        <Gauge className="h-6 w-6" />
                      </div>
                    </div>
                  </ContentCard>

                  <ContentCard className="border-l-4 border-l-blue-600">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">Preventivo / Correctivo</p>
                        <p className="text-3xl font-bold text-blue-600">
                          {kpis.mantenimiento.pctPreventivo !== null && kpis.mantenimiento.pctCorrectivo !== null
                            ? `${Math.round(kpis.mantenimiento.pctPreventivo)}% / ${Math.round(kpis.mantenimiento.pctCorrectivo)}%`
                            : "—"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {kpis.mantenimiento.totalOrdenes} órdenes
                        </p>
                      </div>
                      <div className="p-3 rounded-lg bg-blue-100 text-blue-600">
                        <Activity className="h-6 w-6" />
                      </div>
                    </div>
                  </ContentCard>

                  <ContentCard className="border-l-4 border-l-purple-600">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">Costo por km</p>
                        <p className="text-3xl font-bold text-purple-600">
                          {kpis.costos.costoPorKmGlobal !== null
                            ? formatCOP(kpis.costos.costoPorKmGlobal)
                            : "—"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatKm(kpis.costos.kmTotalFlota)} totales
                        </p>
                      </div>
                      <div className="p-3 rounded-lg bg-purple-100 text-purple-600">
                        <DollarSign className="h-6 w-6" />
                      </div>
                    </div>
                  </ContentCard>

                  <ContentCard className="border-l-4 border-l-red-600">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">Costo total de flota</p>
                        <p className="text-2xl font-bold text-red-600">
                          {formatCOP(kpis.costos.costoTotalFlota)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {kpis.flota.enMantenimiento} en mantenimiento
                        </p>
                      </div>
                      <div className="p-3 rounded-lg bg-red-100 text-red-600">
                        <Wallet className="h-6 w-6" />
                      </div>
                    </div>
                  </ContentCard>
                </div>

                {/* Gráficos */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                  <ContentCard
                    header={{ title: "Preventivo vs Correctivo", icon: <PieIcon className="h-4 w-4" /> }}
                  >
                    {kpiPieData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={kpiPieData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={70}
                            outerRadius={110}
                            label={(e: any) => `${e.name}: ${e.value}`}
                          >
                            {kpiPieData.map((entry, idx) => (
                              <Cell key={idx} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ backgroundColor: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8, color: axisColor }} />
                          <Legend wrapperStyle={{ color: axisColor }} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">
                        Sin datos para el periodo
                      </div>
                    )}
                  </ContentCard>

                  <ContentCard
                    header={{ title: "Top 10 vehículos más costosos", icon: <BarChart3 className="h-4 w-4" /> }}
                  >
                    {kpiBarData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={kpiBarData}>
                          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                          <XAxis dataKey="placa" angle={-25} textAnchor="end" interval={0} height={70} fontSize={11} stroke={axisColor} tick={{ fill: axisColor }} />
                          <YAxis stroke={axisColor} tick={{ fill: axisColor }} tickFormatter={(v: number) => formatCOP(v)} width={90} />
                          <Tooltip
                            formatter={(value: any) => formatCOP(Number(value))}
                            contentStyle={{ backgroundColor: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8, color: axisColor }}
                          />
                          <Legend wrapperStyle={{ color: axisColor }} />
                          <Bar dataKey="costoMantenimiento" stackId="a" fill={COLOR_PRIMARY} name="Mantenimiento" />
                          <Bar dataKey="costoCombustible" stackId="a" fill={COLOR_PURPLE} name="Combustible" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">
                        Sin datos para el periodo
                      </div>
                    )}
                  </ContentCard>
                </div>

                {/* Ranking de vehículos más costosos */}
                <ContentCard
                  className="mt-6 mb-6"
                  header={{ title: "Ranking de vehículos más costosos", icon: <Trophy className="h-4 w-4" /> }}
                >
                  {kpis.rankingVehiculos.length > 0 ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Placa</TableHead>
                            <TableHead>Marca / Línea</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead className="text-right">Órdenes (P/C)</TableHead>
                            <TableHead className="text-right">Mantenimiento</TableHead>
                            <TableHead className="text-right">Combustible</TableHead>
                            <TableHead className="text-right">Costo total</TableHead>
                            <TableHead className="text-right">Km recorridos</TableHead>
                            <TableHead className="text-right">Costo/km</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {kpis.rankingVehiculos.map((v, i) => (
                            <TableRow key={`${v.placa}-${i}`}>
                              <TableCell className="font-medium">{v.placa}</TableCell>
                              <TableCell>
                                {[v.marca, v.linea].filter(Boolean).join(" / ") || "—"}
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary">{v.estado || "—"}</Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                {v.ordenes}{" "}
                                <span className="text-xs text-muted-foreground">
                                  ({v.preventivos}/{v.correctivos})
                                </span>
                              </TableCell>
                              <TableCell className="text-right">{formatCOP(v.costoMantenimiento)}</TableCell>
                              <TableCell className="text-right">{formatCOP(v.costoCombustible)}</TableCell>
                              <TableCell className="text-right font-bold">{formatCOP(v.costoTotal)}</TableCell>
                              <TableCell className="text-right">{formatKm(v.kmRecorridos)}</TableCell>
                              <TableCell className="text-right">
                                {v.costoPorKm !== null ? formatCOP(v.costoPorKm) : "—"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      Sin datos para el periodo
                    </p>
                  )}
                </ContentCard>
              </>
            )}
          </TabsContent>
        </Tabs>
      </PageContainer>
    </DashboardLayout>
  );
}

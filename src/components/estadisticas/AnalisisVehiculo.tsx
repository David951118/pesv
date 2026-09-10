import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { getApiRndcBaseUrl } from "@/services/apirndc/apirndc.config";
import { formatCOP, formatKm } from "@/components/mantenimiento/mantenimiento.helpers";
import { ContentCard } from "@/components/layout/ContentCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Car,
  ClipboardCheck,
  Fuel,
  Wrench,
  Gauge,
  DollarSign,
  Search,
  Gavel,
} from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";

// ── Types del endpoint /api/estadisticas/vehiculo/:id ──

interface VehiculoOption {
  _id: string;
  placa: string;
  numeroInterno?: string;
}

interface SnapshotKm {
  fecha: string;
  kilometraje: number;
  fuente: string;
}

interface ResumenVehiculo {
  vehiculo: {
    _id: string;
    placa: string;
    marca?: string;
    linea?: string;
    modelo?: string;
    numeroInterno?: string;
  };
  rango: { desde: string; hasta: string; diasRango: number };
  preoperativas: {
    total: number;
    porEstado: Record<string, number>;
    diasConPreop: number;
    diasRango: number;
    cumplimientoDias: number;
    novedadesPendientes: number;
    detalle: {
      _id: string;
      fecha: string;
      estadoGeneral: string;
      kilometraje?: number;
      conductor?: { nombres?: string; apellidos?: string };
    }[];
  };
  tanqueos: {
    total: number;
    galones: number;
    costoTotal: number;
    rendimientoPromedio: number | null;
    detalle: {
      _id: string;
      fecha: string;
      kmTanqueo?: number;
      galones: number;
      costoTotal: number;
      estacion?: string;
      rendimientoTramo?: number;
    }[];
  };
  mantenimientos: {
    total: number;
    cerradas: number;
    costoTotal: number;
    detalle: {
      _id: string;
      numero?: string;
      estado: string;
      descripcion?: string;
      planItemNombre?: string;
      kilometraje?: number;
      costoTotal?: number;
      createdAt: string;
      fechaCierre?: string;
    }[];
  };
  multas?: {
    total: number;
    pendientes: number;
    inmovilizaciones: number;
    costoTotal: number;
    detalle: {
      _id: string;
      numero?: string;
      fecha: string;
      codigoInfraccion?: string;
      descripcion?: string;
      autoridad?: string;
      valor: number;
      costoTotal?: number;
      estado: string;
      responsable?: string;
      inmovilizacion?: {
        aplica?: boolean;
        estado?: string;
        fechaInicio?: string | null;
        fechaLevantamiento?: string | null;
      };
      conductor?: { nombres?: string; apellidos?: string } | null;
      conductorNoRegistrado?: { nombres?: string; apellidos?: string } | null;
    }[];
  };
  kilometraje: {
    dias: number;
    kmInicio: number | null;
    kmFin: number | null;
    recorridoKm: number;
    snapshots: SnapshotKm[];
    nota?: string | null;
  };
  costos: {
    combustible: number;
    mantenimiento: number;
    /** valor + grúa + patios de las multas del periodo (sin anuladas) */
    multas?: number;
    total: number;
    costoPorKm: number | null;
  };
}

// ── Helpers de fechas (mes corrido por defecto) ──

function aISO(fecha: Date): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

function primerDiaMesActual(): string {
  const hoy = new Date();
  return aISO(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
}

function hoyISO(): string {
  return aISO(new Date());
}

const COLOR_APROBADO = "#22c55e";
const COLOR_NOVEDAD = "#fbbf24";
const COLOR_RECHAZADO = "#ef4444";

const ESTADO_MULTA_BADGE: Record<string, string> = {
  PENDIENTE: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  IMPUGNADA: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  PAGADA: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  ANULADA: "bg-muted text-muted-foreground",
};

const INMOVILIZACION_LABEL: Record<string, string> = {
  NO_APLICA: "—",
  INMOVILIZADO: "Inmovilizado",
  CORRECCION_SUBIDA: "Corrección subida",
  LEVANTADA: "Levantada",
};

const INMOVILIZACION_BADGE: Record<string, string> = {
  INMOVILIZADO: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  CORRECCION_SUBIDA: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  LEVANTADA: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};

function nombreConductorMulta(m: {
  conductor?: { nombres?: string; apellidos?: string } | null;
  conductorNoRegistrado?: { nombres?: string; apellidos?: string } | null;
}): string {
  const c = m.conductor;
  if (c && (c.nombres || c.apellidos)) return [c.nombres, c.apellidos].filter(Boolean).join(" ");
  const n = m.conductorNoRegistrado;
  if (n && (n.nombres || n.apellidos)) return `${[n.nombres, n.apellidos].filter(Boolean).join(" ")} (no registrado)`;
  return "—";
}

const ESTADO_OT_BADGE: Record<string, string> = {
  ABIERTA: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  ASIGNADA: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  EN_PROCESO: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  CERRADA: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};

interface Props {
  vehiculos: VehiculoOption[];
  isDark?: boolean;
}

/**
 * Sección "Análisis por vehículo" del tab de KPIs.
 * Selecciona un carro + rango (por defecto el mes corrido) y abre un popup con
 * preoperativas, tanqueos, mantenimientos, costos y recorrido real (odómetro).
 */
export function AnalisisVehiculo({ vehiculos, isDark = false }: Props) {
  const { bearerToken } = useAuth();

  const [vehiculoId, setVehiculoId] = useState<string>("");
  const [desde, setDesde] = useState(primerDiaMesActual);
  const [hasta, setHasta] = useState(hoyISO);
  const [open, setOpen] = useState(false);

  const axisColor = isDark ? "#cbd5e1" : "#475569";
  const gridColor = isDark ? "#334155" : "#e2e8f0";
  const tooltipBg = isDark ? "#1e293b" : "#ffffff";
  const tooltipBorder = isDark ? "#334155" : "#e2e8f0";

  const { data, isLoading } = useQuery({
    queryKey: ["analisis-vehiculo", vehiculoId, desde, hasta],
    queryFn: async (): Promise<ResumenVehiculo> => {
      const params = new URLSearchParams();
      if (desde) params.set("desde", desde);
      if (hasta) params.set("hasta", hasta);
      const res = await fetch(
        `${getApiRndcBaseUrl()}/api/estadisticas/vehiculo/${vehiculoId}?${params.toString()}`,
        { headers: { Authorization: `Bearer ${bearerToken}` } },
      );
      if (!res.ok) throw new Error("Error al cargar el análisis del vehículo");
      const json = await res.json();
      return json.data as ResumenVehiculo;
    },
    enabled: !!bearerToken && !!vehiculoId && open,
  });

  const pieData = useMemo(() => {
    const e = data?.preoperativas.porEstado || {};
    return [
      { name: "Aprobadas", value: e.APROBADO || 0, color: COLOR_APROBADO },
      { name: "Con novedad", value: e.NOVEDAD || 0, color: COLOR_NOVEDAD },
      { name: "Rechazadas", value: e.RECHAZADO || 0, color: COLOR_RECHAZADO },
    ].filter((d) => d.value > 0);
  }, [data]);

  const kmData = useMemo(
    () =>
      (data?.kilometraje.snapshots || []).map((s) => ({
        fecha: s.fecha.slice(5), // MM-DD
        km: s.kilometraje,
      })),
    [data],
  );

  const vehiculoSel = vehiculos.find((v) => v._id === vehiculoId);

  return (
    <>
      <ContentCard
        header={{
          title: "Análisis por vehículo",
          subtitle: "Seleccione un carro y un rango (por defecto el mes corrido) para ver su detalle completo",
          icon: <Car className="h-5 w-5 text-primary" />,
        }}
      >
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1 min-w-[190px]">
            <label className="text-xs font-medium text-muted-foreground">Vehículo</label>
            <Select value={vehiculoId} onValueChange={setVehiculoId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccione un vehículo" />
              </SelectTrigger>
              <SelectContent>
                {vehiculos.map((v) => (
                  <SelectItem key={v._id} value={v._id}>
                    {v.placa}
                    {v.numeroInterno ? ` · ${v.numeroInterno}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Desde</label>
            <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="w-[150px]" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Hasta</label>
            <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="w-[150px]" />
          </div>
          <Button
            onClick={() => setOpen(true)}
            disabled={!vehiculoId}
            className="gap-2"
          >
            <Search className="h-4 w-4" />
            Ver análisis
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setDesde(primerDiaMesActual());
              setHasta(hoyISO());
            }}
          >
            Mes corrido
          </Button>
        </div>
      </ContentCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Car className="h-5 w-5 text-primary" />
              {data?.vehiculo
                ? `${data.vehiculo.placa} — ${[data.vehiculo.marca, data.vehiculo.linea, data.vehiculo.modelo].filter(Boolean).join(" ")}`
                : vehiculoSel?.placa || "Vehículo"}
              <span className="text-sm font-normal text-muted-foreground ml-2">
                {desde} → {hasta}
              </span>
            </DialogTitle>
          </DialogHeader>

          {isLoading || !data ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : (
            <div className="space-y-5">
              {/* KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                <KpiMini
                  icon={ClipboardCheck}
                  label="Preoperativas"
                  value={String(data.preoperativas.total)}
                  hint={`${data.preoperativas.cumplimientoDias}% de los días`}
                />
                <KpiMini
                  icon={ClipboardCheck}
                  label="Novedades pend."
                  value={String(data.preoperativas.novedadesPendientes)}
                  alerta={data.preoperativas.novedadesPendientes > 0}
                />
                <KpiMini
                  icon={Fuel}
                  label="Combustible"
                  value={formatCOP(data.costos.combustible)}
                  hint={`${data.tanqueos.total} tanqueos · ${data.tanqueos.galones} gal`}
                />
                <KpiMini
                  icon={Wrench}
                  label="Mantenimiento"
                  value={formatCOP(data.costos.mantenimiento)}
                  hint={`${data.mantenimientos.total} OTs (${data.mantenimientos.cerradas} cerradas)`}
                />
                <KpiMini
                  icon={Gavel}
                  label="Multas"
                  value={formatCOP(data.costos.multas ?? data.multas?.costoTotal ?? 0)}
                  hint={`${data.multas?.total ?? 0} multas · ${data.multas?.pendientes ?? 0} pendientes${(data.multas?.inmovilizaciones ?? 0) > 0 ? ` · ${data.multas?.inmovilizaciones} inmov.` : ""}`}
                  alerta={(data.multas?.pendientes ?? 0) > 0}
                />
                <KpiMini
                  icon={Gauge}
                  label="Recorrido real"
                  value={data.kilometraje.recorridoKm > 0 ? formatKm(data.kilometraje.recorridoKm) : "—"}
                  hint={
                    data.kilometraje.kmInicio != null && data.kilometraje.kmFin != null
                      ? `${formatKm(data.kilometraje.kmInicio)} → ${formatKm(data.kilometraje.kmFin)}`
                      : "sin snapshots"
                  }
                />
                <KpiMini
                  icon={DollarSign}
                  label="Costo total"
                  value={formatCOP(data.costos.total)}
                  hint={`Comb. + mant. + multas${data.costos.costoPorKm != null ? ` · ${formatCOP(data.costos.costoPorKm)}/km` : ""}`}
                />
              </div>

              {/* Gráficas: preoperativas + odómetro */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="border border-border rounded-lg p-4">
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <ClipboardCheck className="h-4 w-4 text-primary" />
                    Preoperativas del período
                  </h4>
                  {pieData.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-10">
                      Sin preoperativas en el período
                    </p>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={80}
                          label={(p) => `${p.name}: ${p.value}`}
                        >
                          {pieData.map((d) => (
                            <Cell key={d.name} fill={d.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: tooltipBg,
                            border: `1px solid ${tooltipBorder}`,
                            borderRadius: 8,
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {data.preoperativas.diasConPreop} de {data.preoperativas.diasRango} días con
                    preoperativa ({data.preoperativas.cumplimientoDias}%)
                  </p>
                </div>

                <div className="border border-border rounded-lg p-4">
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <Gauge className="h-4 w-4 text-primary" />
                    Odómetro diario (Cellvi)
                  </h4>
                  {kmData.length < 2 ? (
                    <p className="text-sm text-muted-foreground text-center py-10">
                      {data.kilometraje.nota || "Sin datos de kilometraje diario en el período"}
                    </p>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={kmData}>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                        <XAxis dataKey="fecha" stroke={axisColor} fontSize={11} />
                        <YAxis
                          stroke={axisColor}
                          fontSize={11}
                          domain={["dataMin", "dataMax"]}
                          tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
                        />
                        <Tooltip
                          formatter={(v: number) => [formatKm(v), "Odómetro"]}
                          contentStyle={{
                            backgroundColor: tooltipBg,
                            border: `1px solid ${tooltipBorder}`,
                            borderRadius: 8,
                          }}
                        />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="km"
                          name="Odómetro (km)"
                          stroke="#3b82f6"
                          strokeWidth={2}
                          dot={{ r: 2 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    Recorrido real consolidado del rango:{" "}
                    <span className="font-semibold text-foreground">
                      {data.kilometraje.recorridoKm > 0 ? formatKm(data.kilometraje.recorridoKm) : "—"}
                    </span>{" "}
                    (incluye movimientos por fuera de rutas)
                  </p>
                </div>
              </div>

              {/* Tanqueos */}
              <div className="border border-border rounded-lg p-4">
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Fuel className="h-4 w-4 text-primary" />
                  Histórico de tanqueos
                  <span className="text-xs font-normal text-muted-foreground">
                    {data.tanqueos.total} registros · {data.tanqueos.galones} gal ·{" "}
                    {formatCOP(data.tanqueos.costoTotal)}
                    {data.tanqueos.rendimientoPromedio != null &&
                      ` · ${data.tanqueos.rendimientoPromedio} km/gal prom.`}
                  </span>
                </h4>
                {data.tanqueos.detalle.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Sin tanqueos en el período
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fecha</TableHead>
                          <TableHead className="text-right">Km</TableHead>
                          <TableHead className="text-right">Galones</TableHead>
                          <TableHead className="text-right">Costo</TableHead>
                          <TableHead>Estación</TableHead>
                          <TableHead className="text-right">Rend. (km/gal)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.tanqueos.detalle.map((t) => (
                          <TableRow key={t._id}>
                            <TableCell>{t.fecha?.slice(0, 10)}</TableCell>
                            <TableCell className="text-right">
                              {t.kmTanqueo != null ? formatKm(t.kmTanqueo) : "—"}
                            </TableCell>
                            <TableCell className="text-right">{t.galones}</TableCell>
                            <TableCell className="text-right">{formatCOP(t.costoTotal)}</TableCell>
                            <TableCell>{t.estacion || "—"}</TableCell>
                            <TableCell className="text-right">
                              {t.rendimientoTramo != null ? t.rendimientoTramo.toFixed(1) : "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              {/* Mantenimientos */}
              <div className="border border-border rounded-lg p-4">
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-primary" />
                  Mantenimientos del período
                  <span className="text-xs font-normal text-muted-foreground">
                    {data.mantenimientos.total} OTs · {formatCOP(data.mantenimientos.costoTotal)}
                  </span>
                </h4>
                {data.mantenimientos.detalle.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Sin órdenes de trabajo en el período
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>OT</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead>Descripción</TableHead>
                          <TableHead className="text-right">Km</TableHead>
                          <TableHead className="text-right">Costo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.mantenimientos.detalle.map((o) => (
                          <TableRow key={o._id}>
                            <TableCell className="font-medium">{o.numero || "—"}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={ESTADO_OT_BADGE[o.estado] || ""}>
                                {o.estado}
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-[280px] truncate">
                              {o.planItemNombre || o.descripcion || "—"}
                            </TableCell>
                            <TableCell className="text-right">
                              {o.kilometraje != null ? formatKm(o.kilometraje) : "—"}
                            </TableCell>
                            <TableCell className="text-right">{formatCOP(o.costoTotal || 0)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              {/* Multas / comparendos */}
              <div className="border border-border rounded-lg p-4">
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Gavel className="h-4 w-4 text-primary" />
                  Multas del período
                  <span className="text-xs font-normal text-muted-foreground">
                    {data.multas?.total ?? 0} multas · {formatCOP(data.multas?.costoTotal ?? 0)}
                    {(data.multas?.pendientes ?? 0) > 0 && ` · ${data.multas?.pendientes} pendientes`}
                  </span>
                </h4>
                {!data.multas || data.multas.detalle.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Sin multas en el período
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nº</TableHead>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Infracción</TableHead>
                          <TableHead>Conductor</TableHead>
                          <TableHead>Autoridad</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead className="text-right">Costo total</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead>Inmovilización</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.multas.detalle.map((m) => (
                          <TableRow key={m._id}>
                            <TableCell className="font-medium whitespace-nowrap">{m.numero || "—"}</TableCell>
                            <TableCell className="whitespace-nowrap">{m.fecha?.slice(0, 10)}</TableCell>
                            <TableCell className="max-w-[260px] truncate" title={m.descripcion}>
                              {m.codigoInfraccion ? `${m.codigoInfraccion} · ` : ""}
                              {m.descripcion || "—"}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">{nombreConductorMulta(m)}</TableCell>
                            <TableCell>{m.autoridad || "—"}</TableCell>
                            <TableCell className="text-right">{formatCOP(m.valor)}</TableCell>
                            <TableCell className="text-right">{formatCOP(m.costoTotal ?? m.valor)}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={ESTADO_MULTA_BADGE[m.estado] || ""}>
                                {m.estado}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {m.inmovilizacion?.aplica ? (
                                <Badge
                                  variant="outline"
                                  className={INMOVILIZACION_BADGE[m.inmovilizacion.estado || ""] || ""}
                                >
                                  {INMOVILIZACION_LABEL[m.inmovilizacion.estado || ""] || m.inmovilizacion.estado}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function KpiMini({
  icon: Icon,
  label,
  value,
  hint,
  alerta,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
  alerta?: boolean;
}) {
  return (
    <div className={`border rounded-lg p-3 ${alerta ? "border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-900/10" : "border-border bg-card"}`}>
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[11px] font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-base font-bold text-foreground leading-tight">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  );
}

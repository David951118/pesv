import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { getApiRndcBaseUrl } from "@/services/apirndc/apirndc.config";
import { formatKm } from "@/components/mantenimiento/mantenimiento.helpers";
import { labelForItem } from "@/lib/preopItems";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { ModuleHeader } from "@/components/layout/ModuleHeader";
import { ContentCard } from "@/components/layout/ContentCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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
  Bell,
  Wrench,
  ClipboardCheck,
  FileWarning,
  RefreshCw,
  AlertTriangle,
  Search,
} from "lucide-react";

// ── Types ──

interface AlertaMantenimiento {
  vehiculo: { id: string; placa: string; numeroInterno?: string };
  plan?: string;
  item: string;
  estado: "VENCIDO" | "PROXIMO" | "SIN_HISTORIAL" | "OK";
  kmActual?: number | null;
  proximoKm?: number | null;
  kmRestantes?: number | null;
  diasRestantes?: number | null;
  intervaloKm?: number | null;
  intervaloDias?: number | null;
  ultimoServicio?: { fecha?: string; kilometraje?: number; ot?: string } | null;
}

interface PreopNovedad {
  _id: string;
  fecha: string;
  fechaLimiteNovedades?: string;
  diasRestantes?: number;
  vehiculo?: { placa?: string; numeroInterno?: string };
  conductor?: { nombres?: string; apellidos?: string };
  novedadesPendientes?: { item?: string; tipo?: string; estadoCorreccion?: string }[];
  totalPendientes?: number;
  totalResueltas?: number;
}

interface DocumentoAlerta {
  _id: string;
  tipoDocumento?: string;
  entidadModelo?: string;
  entidadId?: { placa?: string; nombres?: string; apellidos?: string; razonSocial?: string } | string;
  numeroDocumento?: string;
  fechaVencimiento?: string;
  estado?: string;
}

const ESTADO_MANT_BADGE: Record<string, string> = {
  VENCIDO: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  PROXIMO: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  SIN_HISTORIAL: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  OK: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};

function nombreEntidad(doc: DocumentoAlerta): string {
  const e = doc.entidadId;
  if (!e) return "—";
  if (typeof e === "string") return e;
  if (e.placa) return e.placa;
  if (e.razonSocial) return e.razonSocial;
  return `${e.nombres || ""} ${e.apellidos || ""}`.trim() || "—";
}

function fmtFecha(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("es-CO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

/**
 * Visor de alertas detallado — solo administradores.
 * Consolida en una sola vista, con filtros y detalle completo:
 *  - Alertas de mantenimiento preventivo (vencidos / próximos / sin historial)
 *  - Preoperativas con novedades pendientes de corrección
 *  - Documentos vencidos y por vencer
 */
export default function AlertasAdmin() {
  const { bearerToken } = useAuth();
  const navigate = useNavigate();

  const [consultarGps, setConsultarGps] = useState(false);
  const [filtroMant, setFiltroMant] = useState<string>("accionables");
  const [busqueda, setBusqueda] = useState("");

  const base = getApiRndcBaseUrl();
  const headers = { Authorization: `Bearer ${bearerToken}` };

  // ── Mantenimiento ──
  const {
    data: mantenimiento,
    isLoading: loadingMant,
    refetch: refetchMant,
    isFetching: fetchingMant,
  } = useQuery({
    queryKey: ["alertas-admin-mantenimiento", consultarGps],
    queryFn: async (): Promise<{ resumen: Record<string, number>; data: AlertaMantenimiento[] }> => {
      const params = new URLSearchParams({ todas: "true" });
      if (!consultarGps) params.set("rapido", "true");
      const res = await fetch(`${base}/api/mantenimiento/alertas?${params.toString()}`, { headers });
      if (!res.ok) throw new Error("Error al cargar alertas de mantenimiento");
      const json = await res.json();
      return { resumen: json.resumen || {}, data: json.data || [] };
    },
    enabled: !!bearerToken,
    refetchInterval: 5 * 60_000,
  });

  // ── Novedades de preoperativas ──
  const { data: novedades = [], isLoading: loadingNov } = useQuery({
    queryKey: ["alertas-admin-novedades"],
    queryFn: async (): Promise<PreopNovedad[]> => {
      const res = await fetch(`${base}/api/preoperacionales/novedades?limit=100`, { headers });
      if (!res.ok) throw new Error("Error al cargar novedades");
      const json = await res.json();
      return Array.isArray(json.data) ? json.data : [];
    },
    enabled: !!bearerToken,
    refetchInterval: 5 * 60_000,
  });

  // ── Documentos vencidos / por vencer ──
  const { data: docsVencidos = [], isLoading: loadingDocsV } = useQuery({
    queryKey: ["alertas-admin-docs-vencidos"],
    queryFn: async (): Promise<DocumentoAlerta[]> => {
      const res = await fetch(`${base}/api/documentos?estado=VENCIDO&limit=100`, { headers });
      if (!res.ok) throw new Error("Error al cargar documentos vencidos");
      const json = await res.json();
      return Array.isArray(json.data) ? json.data : [];
    },
    enabled: !!bearerToken,
    refetchInterval: 5 * 60_000,
  });

  const { data: docsPorVencer = [], isLoading: loadingDocsP } = useQuery({
    queryKey: ["alertas-admin-docs-porvencer"],
    queryFn: async (): Promise<DocumentoAlerta[]> => {
      const res = await fetch(`${base}/api/documentos?estado=POR_VENCER&limit=100`, { headers });
      if (!res.ok) throw new Error("Error al cargar documentos por vencer");
      const json = await res.json();
      return Array.isArray(json.data) ? json.data : [];
    },
    enabled: !!bearerToken,
    refetchInterval: 5 * 60_000,
  });

  // ── Filtros locales ──
  const q = busqueda.trim().toUpperCase();

  const alertasMant = useMemo(() => {
    let lista = mantenimiento?.data || [];
    if (filtroMant === "accionables") {
      lista = lista.filter((a) => a.estado === "VENCIDO" || a.estado === "PROXIMO");
    } else if (filtroMant !== "todas") {
      lista = lista.filter((a) => a.estado === filtroMant);
    }
    if (q) lista = lista.filter((a) => (a.vehiculo?.placa || "").toUpperCase().includes(q));
    const orden = { VENCIDO: 0, PROXIMO: 1, SIN_HISTORIAL: 2, OK: 3 };
    return [...lista].sort((a, b) => (orden[a.estado] ?? 9) - (orden[b.estado] ?? 9));
  }, [mantenimiento, filtroMant, q]);

  const novedadesFiltradas = useMemo(() => {
    if (!q) return novedades;
    return novedades.filter((n) => (n.vehiculo?.placa || "").toUpperCase().includes(q));
  }, [novedades, q]);

  const docs = useMemo(() => {
    const todos = [
      ...docsVencidos.map((d) => ({ ...d, estado: d.estado || "VENCIDO" })),
      ...docsPorVencer.map((d) => ({ ...d, estado: d.estado || "POR_VENCER" })),
    ];
    if (!q) return todos;
    return todos.filter((d) => nombreEntidad(d).toUpperCase().includes(q));
  }, [docsVencidos, docsPorVencer, q]);

  const totalVencidosMant = mantenimiento?.resumen?.vencidos ?? 0;
  const totalProximosMant = mantenimiento?.resumen?.proximos ?? 0;

  return (
    <DashboardLayout>
      <PageContainer>
        <ModuleHeader
          title="Visor de alertas"
          description="Vista detallada de todas las alarmas del sistema — solo administradores"
          icon={Bell}
          iconVariant="warning"
        />

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
          <KpiCard
            icon={Wrench}
            label="Mant. vencidos"
            value={totalVencidosMant}
            tone={totalVencidosMant > 0 ? "danger" : "ok"}
          />
          <KpiCard
            icon={Wrench}
            label="Mant. próximos"
            value={totalProximosMant}
            tone={totalProximosMant > 0 ? "warn" : "ok"}
          />
          <KpiCard
            icon={ClipboardCheck}
            label="Preop. con novedad"
            value={novedades.length}
            tone={novedades.length > 0 ? "warn" : "ok"}
          />
          <KpiCard
            icon={FileWarning}
            label="Docs. vencidos"
            value={docsVencidos.length}
            tone={docsVencidos.length > 0 ? "danger" : "ok"}
          />
          <KpiCard
            icon={FileWarning}
            label="Docs. por vencer"
            value={docsPorVencer.length}
            tone={docsPorVencer.length > 0 ? "warn" : "ok"}
          />
        </div>

        {/* Búsqueda global por placa/entidad */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Filtrar por placa o entidad…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
        </div>

        <Tabs defaultValue="mantenimiento">
          <TabsList>
            <TabsTrigger value="mantenimiento" className="gap-1.5">
              <Wrench className="h-4 w-4" />
              Mantenimiento
              {totalVencidosMant > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 px-1.5">{totalVencidosMant}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="preoperativas" className="gap-1.5">
              <ClipboardCheck className="h-4 w-4" />
              Preoperativas
              {novedades.length > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 px-1.5">{novedades.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="documentos" className="gap-1.5">
              <FileWarning className="h-4 w-4" />
              Documentos
              {docsVencidos.length > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 px-1.5">{docsVencidos.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── Mantenimiento ── */}
          <TabsContent value="mantenimiento">
            <ContentCard
              header={{
                title: "Alertas de mantenimiento preventivo",
                subtitle: consultarGps
                  ? "Kilometraje consultado en vivo (Cellvi GPS)"
                  : "Kilometraje del último dato conocido (modo rápido)",
                actions: (
                  <div className="flex items-center gap-2">
                    <Select value={filtroMant} onValueChange={setFiltroMant}>
                      <SelectTrigger className="w-[170px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="accionables">Vencidos + próximos</SelectItem>
                        <SelectItem value="VENCIDO">Solo vencidos</SelectItem>
                        <SelectItem value="PROXIMO">Solo próximos</SelectItem>
                        <SelectItem value="SIN_HISTORIAL">Sin historial</SelectItem>
                        <SelectItem value="todas">Todas</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => {
                        setConsultarGps(true);
                        setTimeout(() => refetchMant(), 0);
                      }}
                      disabled={fetchingMant}
                    >
                      <RefreshCw className={`h-4 w-4 ${fetchingMant ? "animate-spin" : ""}`} />
                      Consultar GPS
                    </Button>
                  </div>
                ),
              }}
            >
              {loadingMant ? (
                <Skeleton className="h-48 w-full" />
              ) : alertasMant.length === 0 ? (
                <EmptyMsg texto="Sin alertas de mantenimiento para el filtro seleccionado" />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Vehículo</TableHead>
                        <TableHead>Ítem</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Km actual</TableHead>
                        <TableHead className="text-right">Próximo</TableHead>
                        <TableHead className="text-right">Restante</TableHead>
                        <TableHead>Último servicio</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {alertasMant.map((a, i) => (
                        <TableRow key={`${a.vehiculo?.id}-${a.item}-${i}`}>
                          <TableCell className="font-medium">
                            {a.vehiculo?.placa || "—"}
                            {a.vehiculo?.numeroInterno && (
                              <span className="text-xs text-muted-foreground ml-1">
                                · {a.vehiculo.numeroInterno}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>{a.item}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={ESTADO_MANT_BADGE[a.estado] || ""}>
                              {a.estado === "SIN_HISTORIAL" ? "SIN HISTORIAL" : a.estado}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {a.kmActual != null ? formatKm(a.kmActual) : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            {a.proximoKm != null ? formatKm(a.proximoKm) : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            {a.kmRestantes != null ? (
                              <span className={a.kmRestantes < 0 ? "text-red-600 font-semibold" : ""}>
                                {formatKm(a.kmRestantes)}
                              </span>
                            ) : a.diasRestantes != null ? (
                              <span className={a.diasRestantes < 0 ? "text-red-600 font-semibold" : ""}>
                                {a.diasRestantes} días
                              </span>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {a.ultimoServicio
                              ? `${a.ultimoServicio.ot || ""} ${fmtFecha(a.ultimoServicio.fecha)}`.trim()
                              : "Nunca"}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate("/mantenimiento")}
                            >
                              Ver
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </ContentCard>
          </TabsContent>

          {/* ── Preoperativas ── */}
          <TabsContent value="preoperativas">
            <ContentCard
              header={{
                title: "Preoperativas con novedades pendientes",
                subtitle: "Ordenadas por urgencia (fecha límite de corrección)",
              }}
            >
              {loadingNov ? (
                <Skeleton className="h-48 w-full" />
              ) : novedadesFiltradas.length === 0 ? (
                <EmptyMsg texto="No hay preoperativas con novedades pendientes" />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Vehículo</TableHead>
                        <TableHead>Conductor</TableHead>
                        <TableHead>Fecha preop.</TableHead>
                        <TableHead>Límite corrección</TableHead>
                        <TableHead className="text-right">Pendientes</TableHead>
                        <TableHead>Ítems</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {novedadesFiltradas.map((n) => {
                        const dias = n.diasRestantes ?? 0;
                        return (
                          <TableRow key={n._id}>
                            <TableCell className="font-medium">
                              {n.vehiculo?.placa || "—"}
                            </TableCell>
                            <TableCell>
                              {`${n.conductor?.nombres || ""} ${n.conductor?.apellidos || ""}`.trim() || "—"}
                            </TableCell>
                            <TableCell>{fmtFecha(n.fecha)}</TableCell>
                            <TableCell>
                              <span className={dias < 0 ? "text-red-600 font-semibold" : dias <= 2 ? "text-amber-600 font-medium" : ""}>
                                {fmtFecha(n.fechaLimiteNovedades)}
                                {n.fechaLimiteNovedades && ` (${dias < 0 ? `vencida hace ${-dias} d` : `${dias} d`})`}
                              </span>
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              {n.totalPendientes ?? n.novedadesPendientes?.length ?? 0}
                            </TableCell>
                            <TableCell className="max-w-[320px]">
                              <div className="flex flex-wrap gap-1">
                                {(n.novedadesPendientes || []).slice(0, 4).map((nov, i) => (
                                  <Badge key={i} variant="outline" className="text-[11px]">
                                    {nov.item ? labelForItem(nov.item) : nov.tipo || "novedad"}
                                  </Badge>
                                ))}
                                {(n.novedadesPendientes || []).length > 4 && (
                                  <Badge variant="outline" className="text-[11px]">
                                    +{(n.novedadesPendientes || []).length - 4}
                                  </Badge>
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
            </ContentCard>
          </TabsContent>

          {/* ── Documentos ── */}
          <TabsContent value="documentos">
            <ContentCard
              header={{
                title: "Documentos vencidos y por vencer",
                subtitle: "Vehículos, conductores y empresa",
              }}
            >
              {loadingDocsV || loadingDocsP ? (
                <Skeleton className="h-48 w-full" />
              ) : docs.length === 0 ? (
                <EmptyMsg texto="No hay documentos vencidos ni por vencer" />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Documento</TableHead>
                        <TableHead>Entidad</TableHead>
                        <TableHead>Tipo entidad</TableHead>
                        <TableHead>Vence</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {docs.map((d) => (
                        <TableRow key={d._id}>
                          <TableCell className="font-medium">
                            {d.tipoDocumento || "—"}
                            {d.numeroDocumento && (
                              <span className="text-xs text-muted-foreground ml-1">
                                · {d.numeroDocumento}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>{nombreEntidad(d)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {d.entidadModelo || "—"}
                          </TableCell>
                          <TableCell>{fmtFecha(d.fechaVencimiento)}</TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                d.estado === "VENCIDO"
                                  ? ESTADO_MANT_BADGE.VENCIDO
                                  : ESTADO_MANT_BADGE.PROXIMO
                              }
                            >
                              {d.estado === "VENCIDO" ? "VENCIDO" : "POR VENCER"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" onClick={() => navigate("/documentos")}>
                              Ver
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </ContentCard>
          </TabsContent>
        </Tabs>
      </PageContainer>
    </DashboardLayout>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone: "danger" | "warn" | "ok";
}) {
  const tones = {
    danger: "border-red-300 dark:border-red-800 bg-red-50/60 dark:bg-red-900/10 text-red-700 dark:text-red-400",
    warn: "border-amber-300 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-900/10 text-amber-700 dark:text-amber-400",
    ok: "border-border bg-card text-muted-foreground",
  };
  return (
    <div className={`border rounded-lg p-3 ${tones[tone]}`}>
      <div className="flex items-center gap-1.5 mb-1">
        {tone !== "ok" && <AlertTriangle className="h-3.5 w-3.5" />}
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[11px] font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-xl font-bold text-foreground">{value}</p>
    </div>
  );
}

function EmptyMsg({ texto }: { texto: string }) {
  return (
    <p className="text-sm text-muted-foreground text-center py-8">{texto}</p>
  );
}

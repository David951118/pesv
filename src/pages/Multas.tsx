import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  DollarSign,
  Eye,
  Gavel,
  Loader2,
  Lock,
  Pencil,
  Plus,
  Trash2,
  Wallet,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { ModuleHeader } from "@/components/layout/ModuleHeader";
import { ContentCard } from "@/components/layout/ContentCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { useAuth } from "@/hooks/useAuth";
import {
  deleteMulta,
  getMultaById,
  getMultas,
  getMultasResumen,
  getVehiculosList,
} from "@/services/apirndc";
import type { ApiRndcMultasParams } from "@/services/apirndc/apirndc.api";
import type { ApiRndcMulta } from "@/services/apirndc/apirndc.types";
import { MultaFormDialog } from "@/components/multas/MultaFormDialog";
import { MultaDetalleDialog } from "@/components/multas/MultaDetalleDialog";
import {
  INMOVILIZACION_ESTADO_BADGE_CLASS,
  INMOVILIZACION_ESTADO_DESCRIPCION,
  INMOVILIZACION_ESTADO_LABELS,
  MULTA_ESTADOS,
  MULTA_ESTADO_BADGE_CLASS,
  MULTA_ESTADO_LABELS,
  formatCOP,
  formatFecha,
  formatFechaHora,
  getConductorMultaNombre,
  inmovilizacionVigente,
  tieneConductor,
} from "@/components/multas/multas.helpers";

const ITEMS_PER_PAGE = 20;

type FiltroInmovilizacion = "all" | "true" | "aplica" | "false";

export default function Multas() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Gestión (crear/editar/pagar/anular/levantar/eliminar): ADMIN y CLIENTE_ADMIN.
  // Se revisan los roles reales de la API para dejar a AUDITOR en solo lectura.
  const apiRolesNorm = (user?.apiRoles ?? []).map((r) => r.replace(/^ROLE_/, "").toUpperCase());
  const canGestionar = apiRolesNorm.some((r) => ["ADMIN", "SUPER_ADMIN", "CLIENTE_ADMIN"].includes(r));

  // Filtros
  const [vehiculoFilter, setVehiculoFilter] = useState("all");
  const [estadoFilter, setEstadoFilter] = useState("all");
  const [inmFilter, setInmFilter] = useState<FiltroInmovilizacion>("all");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [page, setPage] = useState(1);

  // Diálogos
  const [formOpen, setFormOpen] = useState(false);
  const [editMulta, setEditMulta] = useState<ApiRndcMulta | null>(null);
  const [detalle, setDetalle] = useState<ApiRndcMulta | null>(null);
  const [eliminar, setEliminar] = useState<ApiRndcMulta | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState<string | null>(null);

  const { data: vehiculosRes } = useQuery({
    queryKey: ["apirndc-vehiculos-list"],
    queryFn: ({ signal }) => getVehiculosList(signal),
    staleTime: 5 * 60_000,
  });
  const vehiculos = vehiculosRes?.data ?? [];

  const params = useMemo<ApiRndcMultasParams>(
    () => ({
      vehiculo: vehiculoFilter !== "all" ? vehiculoFilter : undefined,
      estado: estadoFilter !== "all" ? estadoFilter : undefined,
      inmovilizado: inmFilter !== "all" ? inmFilter : undefined,
      desde: desde || undefined,
      hasta: hasta || undefined,
      page,
      limit: ITEMS_PER_PAGE,
    }),
    [vehiculoFilter, estadoFilter, inmFilter, desde, hasta, page],
  );

  const { data, isLoading, error } = useQuery({
    queryKey: ["multas", params],
    queryFn: ({ signal }) => getMultas(params, signal),
  });
  const multas = data?.data ?? [];
  const totalPages = Math.max(1, data?.pages ?? 1);

  const { data: resumenRes } = useQuery({
    queryKey: ["multas-resumen", { desde, hasta }],
    queryFn: ({ signal }) => getMultasResumen({ desde: desde || undefined, hasta: hasta || undefined }, signal),
  });
  const resumen = resumenRes?.data ?? null;

  const deleteMutation = useMutation({
    mutationFn: async (m: ApiRndcMulta) => deleteMulta(m._id),
    onSuccess: (res, m) => {
      toast.success(`Multa ${m.numero} enviada a la papelera`);
      if (res.vehiculoLiberado) toast.info(`El vehículo ${m.placa} vuelve a operación`);
      queryClient.invalidateQueries({ queryKey: ["multas"] });
      queryClient.invalidateQueries({ queryKey: ["multas-resumen"] });
      queryClient.invalidateQueries({ queryKey: ["kpis-gerenciales"] });
      queryClient.invalidateQueries({ queryKey: ["apirndc-vehiculos-list"] });
      setEliminar(null);
      if (detalle?._id === m._id) setDetalle(null);
    },
    onError: (e: Error) => toast.error(e.message || "Error al eliminar la multa"),
  });

  const abrirDetallePorId = async (id: string) => {
    setCargandoDetalle(id);
    try {
      const res = await getMultaById(id);
      setDetalle(res.data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al cargar la multa");
    } finally {
      setCargandoDetalle(null);
    }
  };

  const abrirEditar = (m: ApiRndcMulta) => {
    setEditMulta(m);
    setFormOpen(true);
  };

  const hayFiltros = vehiculoFilter !== "all" || estadoFilter !== "all" || inmFilter !== "all" || desde || hasta;

  return (
    <DashboardLayout>
      <PageContainer>
        <ModuleHeader
          title="Multas"
          description="Comparendos, inmovilizaciones y su impacto en los gastos de la flota"
          icon={Gavel}
          iconVariant="warning"
          actions={
            canGestionar ? (
              <Button
                onClick={() => {
                  setEditMulta(null);
                  setFormOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Registrar multa
              </Button>
            ) : undefined
          }
        />

        {/* Tarjetas resumen */}
        {resumen && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <ContentCard className="border-l-4 border-l-primary">
              <p className="text-xs text-muted-foreground">Multas registradas</p>
              <p className="text-3xl font-bold">{resumen.total}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {resumen.pagadas} pagadas · {resumen.anuladas} anuladas
              </p>
            </ContentCard>
            <ContentCard className="border-l-4 border-l-amber-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Valor por pagar</p>
                  <p className="text-2xl font-bold text-amber-600">{formatCOP(resumen.porPagar)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {resumen.pendientes} pendientes · {resumen.impugnadas} impugnadas
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-amber-100 text-amber-600">
                  <DollarSign className="h-6 w-6" />
                </div>
              </div>
            </ContentCard>
            <ContentCard className="border-l-4 border-l-red-600">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Costo total (multas + grúa + patios)</p>
                  <p className="text-2xl font-bold text-red-600">{formatCOP(resumen.costoTotal)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{formatCOP(resumen.pagado)} pagado</p>
                </div>
                <div className="p-3 rounded-lg bg-red-100 text-red-600">
                  <Wallet className="h-6 w-6" />
                </div>
              </div>
            </ContentCard>
            <ContentCard className={`border-l-4 ${resumen.vehiculosInmovilizados > 0 ? "border-l-red-600" : "border-l-emerald-600"}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Vehículos inmovilizados ahora</p>
                  <p className={`text-3xl font-bold ${resumen.vehiculosInmovilizados > 0 ? "text-red-600" : "text-emerald-600"}`}>
                    {resumen.vehiculosInmovilizados}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {resumen.conInmovilizacion} multas con inmovilización en el periodo
                  </p>
                </div>
                <div className={`p-3 rounded-lg ${resumen.vehiculosInmovilizados > 0 ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-600"}`}>
                  <Lock className="h-6 w-6" />
                </div>
              </div>
            </ContentCard>
          </div>
        )}

        {/* Banner de vehículos fuera de operación */}
        {resumen && resumen.inmovilizadas.length > 0 && (
          <div className="rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
              <h3 className="font-semibold text-red-700 dark:text-red-400">
                Vehículos fuera de operación ({resumen.inmovilizadas.length})
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {resumen.inmovilizadas.map((i) => (
                <div
                  key={i._id}
                  className="flex items-center justify-between gap-3 rounded-md bg-card border px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {i.vehiculo?.placa || i.placa}
                      <span className="text-muted-foreground font-normal"> · {i.numero}</span>
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      Desde {formatFechaHora(i.inmovilizacion.fechaInicio || i.fecha)}
                      {i.inmovilizacion.patio ? ` · ${i.inmovilizacion.patio}` : ""}
                    </p>
                    <Badge variant="outline" className={`mt-1 ${INMOVILIZACION_ESTADO_BADGE_CLASS[i.inmovilizacion.estado]}`}>
                      {INMOVILIZACION_ESTADO_DESCRIPCION[i.inmovilizacion.estado]}
                    </Badge>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => abrirDetallePorId(i._id)}
                    disabled={cargandoDetalle === i._id}
                  >
                    {cargandoDetalle === i._id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4 mr-1" />}
                    Ver
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        <ContentCard>
          {/* Filtros */}
          <div className="flex flex-col lg:flex-row lg:items-end gap-3 mb-6">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Placa</label>
              <Select
                value={vehiculoFilter}
                onValueChange={(v) => {
                  setVehiculoFilter(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[170px]">
                  <SelectValue placeholder="Placa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las placas</SelectItem>
                  {vehiculos.map((v) => (
                    <SelectItem key={v._id} value={v._id}>{v.placa}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Estado</label>
              <Select
                value={estadoFilter}
                onValueChange={(v) => {
                  setEstadoFilter(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {MULTA_ESTADOS.map((e) => (
                    <SelectItem key={e} value={e}>{MULTA_ESTADO_LABELS[e]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Inmovilización</label>
              <Select
                value={inmFilter}
                onValueChange={(v) => {
                  setInmFilter(v as FiltroInmovilizacion);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[190px]">
                  <SelectValue placeholder="Inmovilización" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="true">Vigentes (fuera de operación)</SelectItem>
                  <SelectItem value="aplica">Con inmovilización</SelectItem>
                  <SelectItem value="false">Sin inmovilización vigente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Desde</label>
              <Input
                type="date"
                value={desde}
                onChange={(e) => {
                  setDesde(e.target.value);
                  setPage(1);
                }}
                className="w-[160px]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Hasta</label>
              <Input
                type="date"
                value={hasta}
                onChange={(e) => {
                  setHasta(e.target.value);
                  setPage(1);
                }}
                className="w-[160px]"
              />
            </div>
            {hayFiltros && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setVehiculoFilter("all");
                  setEstadoFilter("all");
                  setInmFilter("all");
                  setDesde("");
                  setHasta("");
                  setPage(1);
                }}
              >
                Limpiar
              </Button>
            )}
          </div>

          {/* Tabla */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : error ? (
            <div className="text-center py-12 text-destructive">
              Error al cargar multas: {(error as Error).message}
            </div>
          ) : (
            <>
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nº</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Placa</TableHead>
                      <TableHead>Conductor</TableHead>
                      <TableHead>Infracción</TableHead>
                      <TableHead>Autoridad</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Inmovilización</TableHead>
                      <TableHead className="text-center">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {multas.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-10 text-muted-foreground">
                          <Gavel className="h-10 w-10 mx-auto mb-3 opacity-30" />
                          No hay multas registradas{hayFiltros ? " con estos filtros" : ""}
                        </TableCell>
                      </TableRow>
                    ) : (
                      multas.map((m) => {
                        const inm = m.inmovilizacion || { aplica: false, estado: "NO_APLICA" as const };
                        const vigente = inmovilizacionVigente(m);
                        return (
                          <TableRow key={m._id} className={vigente ? "bg-red-50/40 dark:bg-red-900/10" : undefined}>
                            <TableCell className="font-medium whitespace-nowrap">{m.numero}</TableCell>
                            <TableCell className="text-sm whitespace-nowrap">{formatFecha(m.fecha)}</TableCell>
                            <TableCell className="font-semibold">{m.vehiculo?.placa || m.placa}</TableCell>
                            <TableCell>
                              {tieneConductor(m) ? (
                                <div className="flex flex-col">
                                  <span className="text-sm">{getConductorMultaNombre(m)}</span>
                                  {!m.conductor && (
                                    <Badge variant="outline" className="w-fit text-[10px] mt-0.5">No registrado</Badge>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="max-w-[260px]">
                              <div className="text-sm truncate" title={m.descripcion}>
                                {m.codigoInfraccion && <span className="font-mono font-semibold mr-1">{m.codigoInfraccion}</span>}
                                {m.descripcion}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground max-w-[160px] truncate" title={m.autoridad}>
                              {m.autoridad || "—"}
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap">
                              <div>{formatCOP(m.valor)}</div>
                              {m.costoTotal > m.valor && (
                                <div className="text-xs text-muted-foreground" title="Incluye grúa y patios">
                                  Total {formatCOP(m.costoTotal)}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={MULTA_ESTADO_BADGE_CLASS[m.estado]}>
                                {MULTA_ESTADO_LABELS[m.estado]}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {inm.aplica ? (
                                <Badge variant="outline" className={INMOVILIZACION_ESTADO_BADGE_CLASS[inm.estado]}>
                                  {inm.estado === "INMOVILIZADO" && <Lock className="h-3 w-3 mr-1" />}
                                  {INMOVILIZACION_ESTADO_LABELS[inm.estado]}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center justify-center gap-1">
                                <Button variant="ghost" size="icon" onClick={() => setDetalle(m)} title="Ver detalle">
                                  <Eye className="h-4 w-4" />
                                </Button>
                                {canGestionar && m.estado !== "ANULADA" && (
                                  <Button variant="ghost" size="icon" onClick={() => abrirEditar(m)} title="Editar">
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                )}
                                {canGestionar && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setEliminar(m)}
                                    title="Eliminar (papelera)"
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Paginación */}
              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Página {page} de {totalPages} — {data?.total ?? 0} multas
                  </span>
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          className={page === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationNext
                          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                          className={page === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          )}
        </ContentCard>

        {/* Diálogos */}
        <MultaFormDialog
          open={formOpen}
          onOpenChange={(v) => {
            setFormOpen(v);
            if (!v) setEditMulta(null);
          }}
          multa={editMulta}
          onSaved={(m) => {
            // Si se editó desde el detalle, refrescarlo con los datos nuevos
            if (detalle && detalle._id === m._id) setDetalle(m);
          }}
        />

        <MultaDetalleDialog
          multa={detalle}
          onClose={() => setDetalle(null)}
          canGestionar={canGestionar}
          onEditar={(m) => abrirEditar(m)}
          onUpdated={(m) => setDetalle(m)}
        />

        <AlertDialog open={!!eliminar} onOpenChange={(v) => { if (!v && !deleteMutation.isPending) setEliminar(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Eliminar multa {eliminar?.numero}</AlertDialogTitle>
              <AlertDialogDescription>
                La multa se enviará a la papelera y dejará de sumar en los gastos.
                {eliminar && inmovilizacionVigente(eliminar)
                  ? ` Tiene una inmovilización vigente: el vehículo ${eliminar.placa} volverá a operación.`
                  : ""}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  if (eliminar) deleteMutation.mutate(eliminar);
                }}
                disabled={deleteMutation.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </PageContainer>
    </DashboardLayout>
  );
}

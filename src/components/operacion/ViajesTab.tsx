import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Ban,
  CheckCircle2,
  Eye,
  Gauge,
  Loader2,
  Pencil,
  Play,
  Plus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ContentCard } from "@/components/layout/ContentCard";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  getViajes,
  getVehiculosList,
  getVehiculoKilometraje,
  iniciarViaje,
  finalizarViaje,
  cancelarViaje,
} from "@/services/apirndc";
import type { ApiRndcViaje } from "@/services/apirndc/apirndc.types";
import { CellviPlacaCombobox } from "@/components/documentos/CellviPlacaCombobox";
import {
  formatFechaSolo,
  formatKm,
  getConductorNombre,
  getRutaTexto,
  VIAJE_ESTADOS,
  VIAJE_ESTADO_BADGE_CLASS,
  VIAJE_ESTADO_LABELS,
} from "./operacion.helpers";
import { ViajeDetalleDialog } from "./ViajeDetalleDialog";
import { ViajeFormDialog } from "./ViajeFormDialog";

const ITEMS_PER_PAGE = 10;

// ─── Diálogo: Iniciar ───

function IniciarDialog({ viaje, onClose }: { viaje: ApiRndcViaje | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [kmInicio, setKmInicio] = useState("");
  const [fechaSalida, setFechaSalida] = useState("");
  const [loadingKm, setLoadingKm] = useState(false);

  useEffect(() => {
    if (viaje) {
      setKmInicio(viaje.kmInicio !== undefined && viaje.kmInicio !== null ? String(viaje.kmInicio) : "");
      setFechaSalida("");
    }
  }, [viaje]);

  const handleConsultarKm = async () => {
    if (!viaje?.vehiculo?._id) return;
    setLoadingKm(true);
    try {
      const res = await getVehiculoKilometraje(viaje.vehiculo._id);
      if (res.data?.kilometraje !== null && res.data?.kilometraje !== undefined) {
        setKmInicio(String(res.data.kilometraje));
      } else {
        toast.info("Sin kilometraje disponible para este vehículo");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al consultar el kilometraje");
    } finally {
      setLoadingKm(false);
    }
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const payload: { kmInicio?: number; fechaSalida?: string } = {};
      if (kmInicio) payload.kmInicio = Number(kmInicio);
      if (fechaSalida) payload.fechaSalida = fechaSalida;
      return iniciarViaje(viaje!._id, payload);
    },
    onSuccess: () => {
      toast.success("Viaje iniciado");
      queryClient.invalidateQueries({ queryKey: ["op-viajes"] });
      onClose();
    },
    onError: (error: Error) => toast.error(error.message || "Error al iniciar el viaje"),
  });

  return (
    <Dialog open={!!viaje} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Iniciar Viaje {viaje?.numero}</DialogTitle>
          <DialogDescription>Registre el kilometraje de inicio y la fecha de salida.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Km inicio</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                value={kmInicio}
                onChange={(e) => setKmInicio(e.target.value)}
                placeholder="0"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0"
                title="Consultar kilometraje actual"
                disabled={!viaje?.vehiculo?._id || loadingKm}
                onClick={handleConsultarKm}
              >
                {loadingKm ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gauge className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Fecha de salida</Label>
            <Input type="datetime-local" value={fechaSalida} onChange={(e) => setFechaSalida(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Iniciar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Diálogo: Finalizar ───

function FinalizarDialog({ viaje, onClose }: { viaje: ApiRndcViaje | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [kmFin, setKmFin] = useState("");
  const [fechaLlegada, setFechaLlegada] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [loadingKm, setLoadingKm] = useState(false);

  useEffect(() => {
    if (viaje) {
      setKmFin("");
      setFechaLlegada("");
      setObservaciones("");
    }
  }, [viaje]);

  const handleConsultarKm = async () => {
    if (!viaje?.vehiculo?._id) return;
    setLoadingKm(true);
    try {
      const res = await getVehiculoKilometraje(viaje.vehiculo._id);
      if (res.data?.kilometraje !== null && res.data?.kilometraje !== undefined) {
        setKmFin(String(res.data.kilometraje));
      } else {
        toast.info("Sin kilometraje disponible para este vehículo");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al consultar el kilometraje");
    } finally {
      setLoadingKm(false);
    }
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const payload: {
        kmFin: number;
        fechaLlegada?: string;
        observaciones?: string;
      } = {
        kmFin: Number(kmFin),
      };
      if (fechaLlegada) payload.fechaLlegada = fechaLlegada;
      if (observaciones.trim()) payload.observaciones = observaciones.trim();
      return finalizarViaje(viaje!._id, payload);
    },
    onSuccess: () => {
      toast.success("Viaje finalizado");
      queryClient.invalidateQueries({ queryKey: ["op-viajes"] });
      queryClient.invalidateQueries({ queryKey: ["op-rendimiento"] });
      onClose();
    },
    onError: (error: Error) => toast.error(error.message || "Error al finalizar el viaje"),
  });

  const canSubmit = kmFin !== "" && !Number.isNaN(Number(kmFin));

  return (
    <Dialog open={!!viaje} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Finalizar Viaje {viaje?.numero}</DialogTitle>
          <DialogDescription>
            Registre el kilometraje final (obligatorio) para cerrar el viaje.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Km fin *</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={kmFin}
                  onChange={(e) => setKmFin(e.target.value)}
                  placeholder="0"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  title="Consultar kilometraje actual"
                  disabled={!viaje?.vehiculo?._id || loadingKm}
                  onClick={handleConsultarKm}
                >
                  {loadingKm ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gauge className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Fecha de llegada</Label>
              <Input
                type="datetime-local"
                value={fechaLlegada}
                onChange={(e) => setFechaLlegada(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Observaciones</Label>
            <Textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Observaciones del cierre del viaje"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => mutation.mutate()} disabled={!canSubmit || mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Finalizar Viaje
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Diálogo: Cancelar ───

function CancelarDialog({ viaje, onClose }: { viaje: ApiRndcViaje | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [motivo, setMotivo] = useState("");

  useEffect(() => {
    if (viaje) setMotivo("");
  }, [viaje]);

  const mutation = useMutation({
    mutationFn: async () => cancelarViaje(viaje!._id, motivo.trim() ? { motivo: motivo.trim() } : undefined),
    onSuccess: () => {
      toast.success("Viaje cancelado");
      queryClient.invalidateQueries({ queryKey: ["op-viajes"] });
      onClose();
    },
    onError: (error: Error) => toast.error(error.message || "Error al cancelar el viaje"),
  });

  return (
    <Dialog open={!!viaje} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cancelar Viaje {viaje?.numero}</DialogTitle>
          <DialogDescription>
            ¿Está seguro de cancelar este viaje? Esta acción no se puede deshacer.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Motivo (opcional)</Label>
          <Textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Motivo de la cancelación"
            rows={3}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Volver</Button>
          <Button variant="destructive" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Cancelar Viaje
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Tab de Viajes ───

export function ViajesTab() {
  const [estadoFilter, setEstadoFilter] = useState("all");
  const [vehiculoFilter, setVehiculoFilter] = useState("all");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [page, setPage] = useState(1);

  const [detalleViaje, setDetalleViaje] = useState<ApiRndcViaje | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editViaje, setEditViaje] = useState<ApiRndcViaje | null>(null);
  const [iniciarVj, setIniciarVj] = useState<ApiRndcViaje | null>(null);
  const [finalizarVj, setFinalizarVj] = useState<ApiRndcViaje | null>(null);
  const [cancelarVj, setCancelarVj] = useState<ApiRndcViaje | null>(null);

  const { data: vehiculosRes } = useQuery({
    queryKey: ["apirndc-vehiculos-list"],
    queryFn: ({ signal }) => getVehiculosList(signal),
    staleTime: 5 * 60_000,
  });
  const vehiculos = vehiculosRes?.data ?? [];
  // Opciones del filtro de placa con buscador ("all" = sin filtro)
  const placaOptions = useMemo(
    () => [
      { id: "all", placa: "Todos los vehículos" },
      ...vehiculos.map((v) => ({ id: v._id, placa: v.placa })),
    ],
    [vehiculos],
  );

  const { data, isLoading, error } = useQuery({
    queryKey: ["op-viajes", estadoFilter, vehiculoFilter, desde, hasta, page],
    queryFn: ({ signal }) =>
      getViajes(
        {
          estado: estadoFilter !== "all" ? estadoFilter : undefined,
          vehiculo: vehiculoFilter !== "all" ? vehiculoFilter : undefined,
          desde: desde || undefined,
          hasta: hasta || undefined,
          page,
          limit: ITEMS_PER_PAGE,
        },
        signal,
      ),
  });

  const viajes = data?.data ?? [];
  const totalPages = data?.pages ?? 1;

  return (
    <ContentCard>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-end gap-3 mb-6">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Estado</label>
          <Select
            value={estadoFilter}
            onValueChange={(value) => {
              setEstadoFilter(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[170px]">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              {VIAJE_ESTADOS.map((e) => (
                <SelectItem key={e} value={e}>{VIAJE_ESTADO_LABELS[e]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Vehículo</label>
          {/* Desplegable con buscador: la flota puede tener muchas placas */}
          <div className="w-[190px]">
            <CellviPlacaCombobox
              options={placaOptions}
              value={vehiculoFilter}
              onSelect={(id) => {
                setVehiculoFilter(id);
                setPage(1);
              }}
              placeholder="Vehículo"
            />
          </div>
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
        <div className="flex-1" />
        <Button
          onClick={() => {
            setEditViaje(null);
            setFormOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Nuevo viaje
        </Button>
      </div>

      {/* Tabla */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="text-center py-12 text-destructive">
          Error al cargar viajes: {(error as Error).message}
        </div>
      ) : (
        <>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Vehículo</TableHead>
                  <TableHead>Conductor</TableHead>
                  <TableHead>Ruta</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha programada</TableHead>
                  <TableHead className="text-right">Km recorrido</TableHead>
                  <TableHead>Carga</TableHead>
                  <TableHead className="text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {viajes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      No se encontraron viajes
                    </TableCell>
                  </TableRow>
                ) : (
                  viajes.map((viaje) => {
                    const puedeIniciar = viaje.estado === "PROGRAMADO";
                    const puedeFinalizar = viaje.estado === "EN_CURSO";
                    // Un viaje FINALIZADO también se puede corregir (solo roles de
                    // gestión; el backend lo verifica). CANCELADO no se edita.
                    const puedeEditar =
                      viaje.estado === "PROGRAMADO" ||
                      viaje.estado === "EN_CURSO" ||
                      viaje.estado === "FINALIZADO";
                    const puedeCancelar = viaje.estado === "PROGRAMADO" || viaje.estado === "EN_CURSO";
                    return (
                      <TableRow key={viaje._id}>
                        <TableCell className="font-medium">{viaje.numero}</TableCell>
                        <TableCell>{viaje.vehiculo?.placa || viaje.placa || "-"}</TableCell>
                        <TableCell>
                          <span className="text-sm">{getConductorNombre(viaje.conductor)}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{getRutaTexto(viaje)}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={VIAJE_ESTADO_BADGE_CLASS[viaje.estado]}>
                            {VIAJE_ESTADO_LABELS[viaje.estado] ?? viaje.estado}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{formatFechaSolo(viaje.fechaProgramada)}</span>
                        </TableCell>
                        <TableCell className="text-right">{formatKm(viaje.kmRecorrido)}</TableCell>
                        <TableCell>
                          {viaje.carga?.pesoKg !== undefined && viaje.carga?.pesoKg !== null ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm">{viaje.carga.pesoKg.toLocaleString("es-CO")} kg</span>
                              {viaje.carga.sobrecarga && (
                                <Badge
                                  variant="outline"
                                  className="bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30"
                                >
                                  Sobrecarga
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title="Ver detalle"
                              onClick={() => setDetalleViaje(viaje)}
                            >
                              <Eye className="h-4 w-4" />
                              <span className="sr-only">Ver detalle</span>
                            </Button>
                            {puedeIniciar && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                title="Iniciar"
                                onClick={() => setIniciarVj(viaje)}
                              >
                                <Play className="h-4 w-4" />
                                <span className="sr-only">Iniciar</span>
                              </Button>
                            )}
                            {puedeFinalizar && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                title="Finalizar"
                                onClick={() => setFinalizarVj(viaje)}
                              >
                                <CheckCircle2 className="h-4 w-4" />
                                <span className="sr-only">Finalizar</span>
                              </Button>
                            )}
                            {puedeEditar && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                title={viaje.estado === "FINALIZADO" ? "Corregir datos del viaje" : "Editar"}
                                onClick={() => {
                                  setEditViaje(viaje);
                                  setFormOpen(true);
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                                <span className="sr-only">Editar</span>
                              </Button>
                            )}
                            {puedeCancelar && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                title="Cancelar"
                                onClick={() => setCancelarVj(viaje)}
                              >
                                <Ban className="h-4 w-4" />
                                <span className="sr-only">Cancelar</span>
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
                Página {page} de {totalPages} — {data?.total ?? 0} viajes
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

      {/* Diálogos */}
      <ViajeDetalleDialog viaje={detalleViaje} onClose={() => setDetalleViaje(null)} />
      <ViajeFormDialog open={formOpen} onOpenChange={setFormOpen} viaje={editViaje} />
      <IniciarDialog viaje={iniciarVj} onClose={() => setIniciarVj(null)} />
      <FinalizarDialog viaje={finalizarVj} onClose={() => setFinalizarVj(null)} />
      <CancelarDialog viaje={cancelarVj} onClose={() => setCancelarVj(null)} />
    </ContentCard>
  );
}

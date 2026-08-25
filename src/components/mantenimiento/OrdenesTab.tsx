import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  Ban,
  Eye,
  Loader2,
  MoreHorizontal,
  Play,
  Plus,
  Search,
  Trash2,
  UserCheck,
  CheckCircle2,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  getOrdenesTrabajo,
  asignarOrdenTrabajo,
  iniciarOrdenTrabajo,
  cerrarOrdenTrabajo,
  anularOrdenTrabajo,
  eliminarOrdenTrabajo,
} from "@/services/apirndc";
import type {
  ApiRndcOrdenTrabajo,
  ApiRndcOrdenTrabajoCerrarPayload,
} from "@/services/apirndc/apirndc.types";
import {
  formatCOP,
  formatFecha,
  getMecanicoNombre,
  OT_ESTADOS,
  OT_ESTADO_BADGE_CLASS,
  OT_ESTADO_LABELS,
  OT_PRIORIDAD_BADGE_CLASS,
  OT_PRIORIDAD_LABELS,
  OT_TIPOS,
  OT_TIPO_LABELS,
  useMecanicos,
} from "./mantenimiento.helpers";
import { OrdenDetalleDialog } from "./OrdenDetalleDialog";

const ITEMS_PER_PAGE = 10;

interface OrdenesTabProps {
  onNuevaOt: () => void;
}

// ─── Diálogo: Asignar ───

function AsignarDialog({ orden, onClose }: { orden: ApiRndcOrdenTrabajo | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { data: mecanicos = [], isLoading: loadingMecanicos } = useMecanicos();
  const [mecanico, setMecanico] = useState("");
  const [taller, setTaller] = useState("");
  const [fechaProgramada, setFechaProgramada] = useState("");

  useEffect(() => {
    if (orden) {
      setMecanico(orden.mecanico?._id ?? "");
      setTaller(orden.taller ?? "");
      setFechaProgramada(orden.fechaProgramada ? orden.fechaProgramada.substring(0, 10) : "");
    }
  }, [orden]);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload: { mecanico?: string; taller?: string; fechaProgramada?: string } = {};
      if (mecanico) payload.mecanico = mecanico;
      if (taller.trim()) payload.taller = taller.trim();
      if (fechaProgramada) payload.fechaProgramada = fechaProgramada;
      return asignarOrdenTrabajo(orden!._id, payload);
    },
    onSuccess: () => {
      toast.success("Orden asignada exitosamente");
      queryClient.invalidateQueries({ queryKey: ["mant-ordenes"] });
      onClose();
    },
    onError: (error: Error) => toast.error(error.message || "Error al asignar la orden"),
  });

  return (
    <Dialog open={!!orden} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Asignar Orden {orden?.numero}</DialogTitle>
          <DialogDescription>Asigne un mecánico, taller y fecha programada.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Mecánico</Label>
            <Select value={mecanico} onValueChange={setMecanico}>
              <SelectTrigger>
                <SelectValue placeholder={loadingMecanicos ? "Cargando..." : "Seleccione un mecánico"} />
              </SelectTrigger>
              <SelectContent>
                {mecanicos.map((m) => (
                  <SelectItem key={m._id} value={m._id}>
                    {[m.nombres, m.apellidos].filter(Boolean).join(" ") || m.identificacion}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Taller</Label>
            <Input value={taller} onChange={(e) => setTaller(e.target.value)} placeholder="Nombre del taller" />
          </div>
          <div className="space-y-2">
            <Label>Fecha programada</Label>
            <Input type="date" value={fechaProgramada} onChange={(e) => setFechaProgramada(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Asignar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Diálogo: Cerrar ───

interface RepuestoForm {
  nombre: string;
  cantidad: string;
  costoUnitario: string;
}

function CerrarDialog({ orden, onClose }: { orden: ApiRndcOrdenTrabajo | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [kilometraje, setKilometraje] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [taller, setTaller] = useState("");
  const [repuestos, setRepuestos] = useState<RepuestoForm[]>([]);
  const [horas, setHoras] = useState("");
  const [costoManoDeObra, setCostoManoDeObra] = useState("");

  useEffect(() => {
    if (orden) {
      setKilometraje(orden.kilometraje !== undefined && orden.kilometraje !== null ? String(orden.kilometraje) : "");
      setObservaciones("");
      setTaller(orden.taller ?? "");
      setRepuestos(
        (orden.repuestos ?? []).map((r) => ({
          nombre: r.nombre,
          cantidad: String(r.cantidad),
          costoUnitario: String(r.costoUnitario),
        })),
      );
      setHoras(orden.manoDeObra?.horas !== undefined ? String(orden.manoDeObra.horas) : "");
      setCostoManoDeObra(orden.manoDeObra?.costo !== undefined ? String(orden.manoDeObra.costo) : "");
    }
  }, [orden]);

  const totalRepuestos = repuestos.reduce(
    (sum, r) => sum + (Number(r.cantidad) || 0) * (Number(r.costoUnitario) || 0),
    0,
  );
  const total = totalRepuestos + (Number(costoManoDeObra) || 0);

  const kilometrajeRequerido = orden ? orden.kilometraje === undefined || orden.kilometraje === null : false;
  const canSubmit = !kilometrajeRequerido || !!kilometraje;

  const mutation = useMutation({
    mutationFn: async () => {
      const payload: ApiRndcOrdenTrabajoCerrarPayload = {};
      if (kilometraje) payload.kilometraje = Number(kilometraje);
      if (observaciones.trim()) payload.observacionesCierre = observaciones.trim();
      if (taller.trim()) payload.taller = taller.trim();
      const repuestosLimpios = repuestos
        .filter((r) => r.nombre.trim())
        .map((r) => ({
          nombre: r.nombre.trim(),
          cantidad: Number(r.cantidad) || 1,
          costoUnitario: Number(r.costoUnitario) || 0,
        }));
      if (repuestosLimpios.length > 0) payload.repuestos = repuestosLimpios;
      if (horas || costoManoDeObra) {
        payload.manoDeObra = {
          horas: Number(horas) || 0,
          costo: Number(costoManoDeObra) || 0,
        };
      }
      return cerrarOrdenTrabajo(orden!._id, payload);
    },
    onSuccess: () => {
      toast.success("Orden cerrada exitosamente");
      queryClient.invalidateQueries({ queryKey: ["mant-ordenes"] });
      queryClient.invalidateQueries({ queryKey: ["mant-alertas"] });
      onClose();
    },
    onError: (error: Error) => toast.error(error.message || "Error al cerrar la orden"),
  });

  return (
    <Dialog open={!!orden} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Cerrar Orden {orden?.numero}</DialogTitle>
          <DialogDescription>
            Registre los datos de cierre: kilometraje, repuestos y mano de obra.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Kilometraje {kilometrajeRequerido ? "*" : ""}</Label>
              <Input
                type="number"
                value={kilometraje}
                onChange={(e) => setKilometraje(e.target.value)}
                placeholder="0"
              />
              {kilometrajeRequerido && (
                <p className="text-xs text-muted-foreground">
                  La orden no tiene kilometraje registrado, es obligatorio para cerrarla.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Taller</Label>
              <Input value={taller} onChange={(e) => setTaller(e.target.value)} placeholder="Nombre del taller" />
            </div>
          </div>

          {/* Repuestos */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Repuestos</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setRepuestos([...repuestos, { nombre: "", cantidad: "1", costoUnitario: "" }])}
              >
                <Plus className="h-4 w-4 mr-1" />
                Agregar
              </Button>
            </div>
            {repuestos.length === 0 && (
              <p className="text-sm text-muted-foreground">Sin repuestos registrados.</p>
            )}
            {repuestos.map((rep, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_80px_120px_auto] gap-2 items-center">
                <Input
                  value={rep.nombre}
                  onChange={(e) => {
                    const next = [...repuestos];
                    next[idx] = { ...next[idx], nombre: e.target.value };
                    setRepuestos(next);
                  }}
                  placeholder="Nombre del repuesto"
                />
                <Input
                  type="number"
                  min={1}
                  value={rep.cantidad}
                  onChange={(e) => {
                    const next = [...repuestos];
                    next[idx] = { ...next[idx], cantidad: e.target.value };
                    setRepuestos(next);
                  }}
                  placeholder="Cant."
                />
                <Input
                  type="number"
                  min={0}
                  value={rep.costoUnitario}
                  onChange={(e) => {
                    const next = [...repuestos];
                    next[idx] = { ...next[idx], costoUnitario: e.target.value };
                    setRepuestos(next);
                  }}
                  placeholder="Costo unit."
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setRepuestos(repuestos.filter((_, i) => i !== idx))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          {/* Mano de obra */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Mano de obra (horas)</Label>
              <Input type="number" min={0} value={horas} onChange={(e) => setHoras(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-2">
              <Label>Mano de obra (costo)</Label>
              <Input
                type="number"
                min={0}
                value={costoManoDeObra}
                onChange={(e) => setCostoManoDeObra(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          <div className="bg-muted/30 border rounded-lg p-3 text-sm flex justify-between">
            <span className="text-muted-foreground">Costo total estimado</span>
            <span className="font-semibold">{formatCOP(total)}</span>
          </div>

          <div className="space-y-2">
            <Label>Observaciones de cierre</Label>
            <Textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Observaciones del trabajo realizado"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => mutation.mutate()} disabled={!canSubmit || mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Cerrar Orden
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Diálogo: Anular ───

function AnularDialog({ orden, onClose }: { orden: ApiRndcOrdenTrabajo | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [motivo, setMotivo] = useState("");

  useEffect(() => {
    if (orden) setMotivo("");
  }, [orden]);

  const mutation = useMutation({
    mutationFn: async () => anularOrdenTrabajo(orden!._id, motivo.trim() ? { motivo: motivo.trim() } : undefined),
    onSuccess: () => {
      toast.success("Orden anulada");
      queryClient.invalidateQueries({ queryKey: ["mant-ordenes"] });
      queryClient.invalidateQueries({ queryKey: ["mant-alertas"] });
      onClose();
    },
    onError: (error: Error) => toast.error(error.message || "Error al anular la orden"),
  });

  return (
    <Dialog open={!!orden} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Anular Orden {orden?.numero}</DialogTitle>
          <DialogDescription>
            ¿Está seguro de anular esta orden de trabajo? Esta acción no se puede deshacer.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Motivo (opcional)</Label>
          <Textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Motivo de la anulación"
            rows={3}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button variant="destructive" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Anular Orden
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Diálogo: Eliminar (solo ADMIN de la plataforma) ───

function EliminarDialog({ orden, onClose }: { orden: ApiRndcOrdenTrabajo | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [motivo, setMotivo] = useState("");

  useEffect(() => {
    if (orden) setMotivo("");
  }, [orden]);

  const mutation = useMutation({
    mutationFn: async () =>
      eliminarOrdenTrabajo(orden!._id, motivo.trim() ? { motivo: motivo.trim() } : undefined),
    onSuccess: () => {
      toast.success("Orden de trabajo eliminada");
      queryClient.invalidateQueries({ queryKey: ["mant-ordenes"] });
      queryClient.invalidateQueries({ queryKey: ["mant-alertas"] });
      onClose();
    },
    onError: (error: Error) => toast.error(error.message || "Error al eliminar la orden"),
  });

  return (
    <Dialog open={!!orden} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Eliminar Orden {orden?.numero}</DialogTitle>
          <DialogDescription>
            La orden saldrá del módulo de mantenimiento junto con su historial. Si
            solo quiere dejarla sin efecto conservándola a la vista, use Anular.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Motivo (opcional)</Label>
          <Textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Por qué se elimina esta orden"
            rows={3}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button variant="destructive" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Eliminar Orden
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Tab de Órdenes ───

export function OrdenesTab({ onNuevaOt }: OrdenesTabProps) {
  const queryClient = useQueryClient();
  const { role } = useAuth();
  // Asignar/anular son de gestión (backend las restringe a admin/cliente_admin)
  const esGestor = role !== "mecanico";
  // Borrar es exclusivo del ADMIN de la plataforma; el cliente admin solo anula
  const esAdminPlataforma = role === "admin";
  const [estadoFilter, setEstadoFilter] = useState("all");
  const [tipoFilter, setTipoFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [detalleOrden, setDetalleOrden] = useState<ApiRndcOrdenTrabajo | null>(null);
  const [asignarOrden, setAsignarOrden] = useState<ApiRndcOrdenTrabajo | null>(null);
  const [cerrarOrden, setCerrarOrden] = useState<ApiRndcOrdenTrabajo | null>(null);
  const [anularOrden, setAnularOrden] = useState<ApiRndcOrdenTrabajo | null>(null);
  const [eliminarOrden, setEliminarOrden] = useState<ApiRndcOrdenTrabajo | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["mant-ordenes", estadoFilter, tipoFilter, page],
    queryFn: ({ signal }) =>
      getOrdenesTrabajo(
        {
          estado: estadoFilter !== "all" ? estadoFilter : undefined,
          tipo: tipoFilter !== "all" ? tipoFilter : undefined,
          page,
          limit: ITEMS_PER_PAGE,
        },
        signal,
      ),
  });

  const ordenes = data?.data ?? [];
  const totalPages = data?.pages ?? 1;

  // Búsqueda por placa: se filtra sobre la página actual
  const filteredOrdenes = search
    ? ordenes.filter((o) => (o.vehiculo?.placa || o.placa || "").toLowerCase().includes(search.toLowerCase()))
    : ordenes;

  const iniciarMutation = useMutation({
    mutationFn: (id: string) => iniciarOrdenTrabajo(id),
    onSuccess: () => {
      toast.success("Orden iniciada");
      queryClient.invalidateQueries({ queryKey: ["mant-ordenes"] });
    },
    onError: (err: Error) => toast.error(err.message || "Error al iniciar la orden"),
  });

  return (
    <ContentCard>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por placa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
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
            {OT_ESTADOS.map((e) => (
              <SelectItem key={e} value={e}>{OT_ESTADO_LABELS[e]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={tipoFilter}
          onValueChange={(value) => {
            setTipoFilter(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            {OT_TIPOS.map((t) => (
              <SelectItem key={t} value={t}>{OT_TIPO_LABELS[t]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={onNuevaOt}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva OT
        </Button>
      </div>

      {/* Tabla */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="text-center py-12 text-destructive">
          Error al cargar órdenes: {(error as Error).message}
        </div>
      ) : (
        <>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Vehículo</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Prioridad</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Mecánico</TableHead>
                  <TableHead className="text-right">Costo total</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrdenes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      No se encontraron órdenes de trabajo
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOrdenes.map((orden) => {
                    const puedeAsignar = esGestor && (orden.estado === "ABIERTA" || orden.estado === "ASIGNADA");
                    const puedeIniciar = orden.estado === "ABIERTA" || orden.estado === "ASIGNADA";
                    const puedeCerrar = ["ABIERTA", "ASIGNADA", "EN_PROCESO"].includes(orden.estado);
                    const puedeAnular = esGestor && orden.estado !== "CERRADA" && orden.estado !== "ANULADA";
                    return (
                      <TableRow key={orden._id}>
                        <TableCell className="font-medium">{orden.numero}</TableCell>
                        <TableCell>{orden.vehiculo?.placa || orden.placa || "-"}</TableCell>
                        <TableCell>
                          <span className="text-sm">{OT_TIPO_LABELS[orden.tipo] ?? orden.tipo}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={OT_PRIORIDAD_BADGE_CLASS[orden.prioridad]}>
                            {OT_PRIORIDAD_LABELS[orden.prioridad] ?? orden.prioridad}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={OT_ESTADO_BADGE_CLASS[orden.estado]}>
                            {OT_ESTADO_LABELS[orden.estado] ?? orden.estado}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">{getMecanicoNombre(orden.mecanico)}</span>
                        </TableCell>
                        <TableCell className="text-right">{formatCOP(orden.costoTotal)}</TableCell>
                        <TableCell>
                          <span className="text-sm">{formatFecha(orden.fechaProgramada || orden.createdAt)}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Acciones</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setDetalleOrden(orden)}>
                                <Eye className="h-4 w-4 mr-2" />
                                Ver detalle
                              </DropdownMenuItem>
                              {puedeAsignar && (
                                <DropdownMenuItem onClick={() => setAsignarOrden(orden)}>
                                  <UserCheck className="h-4 w-4 mr-2" />
                                  Asignar
                                </DropdownMenuItem>
                              )}
                              {puedeIniciar && (
                                <DropdownMenuItem
                                  onClick={() => iniciarMutation.mutate(orden._id)}
                                  disabled={iniciarMutation.isPending}
                                >
                                  <Play className="h-4 w-4 mr-2" />
                                  Iniciar
                                </DropdownMenuItem>
                              )}
                              {puedeCerrar && (
                                <DropdownMenuItem onClick={() => setCerrarOrden(orden)}>
                                  <CheckCircle2 className="h-4 w-4 mr-2" />
                                  Cerrar
                                </DropdownMenuItem>
                              )}
                              {(puedeAnular || esAdminPlataforma) && <DropdownMenuSeparator />}
                              {puedeAnular && (
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => setAnularOrden(orden)}
                                >
                                  <Ban className="h-4 w-4 mr-2" />
                                  Anular
                                </DropdownMenuItem>
                              )}
                              {esAdminPlataforma && (
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => setEliminarOrden(orden)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Eliminar
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
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
                Página {page} de {totalPages} — {data?.total ?? 0} órdenes
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
      <OrdenDetalleDialog orden={detalleOrden} onClose={() => setDetalleOrden(null)} />
      <AsignarDialog orden={asignarOrden} onClose={() => setAsignarOrden(null)} />
      <CerrarDialog orden={cerrarOrden} onClose={() => setCerrarOrden(null)} />
      <AnularDialog orden={anularOrden} onClose={() => setAnularOrden(null)} />
      <EliminarDialog orden={eliminarOrden} onClose={() => setEliminarOrden(null)} />
    </ContentCard>
  );
}

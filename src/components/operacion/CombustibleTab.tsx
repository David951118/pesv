import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Gauge, Loader2, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { useAuth } from "@/hooks/useAuth";
import {
  getTanqueos,
  getVehiculosList,
  getVehiculoKilometraje,
  createTanqueo,
  updateTanqueo,
  deleteTanqueo,
} from "@/services/apirndc";
import type {
  ApiRndcTanqueo,
  ApiRndcTanqueoCreatePayload,
  ApiRndcTipoCombustible,
} from "@/services/apirndc/apirndc.types";
import {
  formatCOP,
  formatFecha,
  formatGalones,
  formatKm,
  formatRendimiento,
  getConductorNombre,
  KM_FUENTE_LABELS,
  parseDecimal,
  recalcCombustible,
  TIPO_COMBUSTIBLE,
  TIPO_COMBUSTIBLE_LABELS,
  useConductores,
} from "./operacion.helpers";

const ITEMS_PER_PAGE = 10;

// ─── Diálogo: Registrar tanqueo ───

interface TanqueoForm {
  vehiculo: string;
  kmTanqueo: string;
  galones: string;
  costoTotal: string;
  costoPorGalon: string;
  tipoCombustible: ApiRndcTipoCombustible;
  estacion: string;
  tanqueLleno: boolean;
  conductor: string;
  fecha: string;
}

const initialForm: TanqueoForm = {
  vehiculo: "",
  kmTanqueo: "",
  galones: "",
  costoTotal: "",
  costoPorGalon: "",
  tipoCombustible: "DIESEL",
  estacion: "",
  tanqueLleno: true,
  conductor: "",
  fecha: "",
};

function TanqueoFormDialog({
  open,
  onOpenChange,
  tanqueo,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Tanqueo a editar; si es null se crea uno nuevo. */
  tanqueo?: ApiRndcTanqueo | null;
}) {
  const queryClient = useQueryClient();
  const isEdit = !!tanqueo;
  const [form, setForm] = useState<TanqueoForm>(initialForm);
  const [loadingKm, setLoadingKm] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (tanqueo) {
      setForm({
        vehiculo: tanqueo.vehiculo?._id ?? "",
        kmTanqueo: tanqueo.kmTanqueo !== undefined && tanqueo.kmTanqueo !== null ? String(tanqueo.kmTanqueo) : "",
        galones: tanqueo.galones !== undefined && tanqueo.galones !== null ? String(tanqueo.galones) : "",
        costoTotal: tanqueo.costoTotal !== undefined && tanqueo.costoTotal !== null ? String(tanqueo.costoTotal) : "",
        costoPorGalon:
          tanqueo.costoPorGalon !== undefined && tanqueo.costoPorGalon !== null ? String(tanqueo.costoPorGalon) : "",
        tipoCombustible: tanqueo.tipoCombustible ?? "DIESEL",
        estacion: tanqueo.estacion ?? "",
        tanqueLleno: tanqueo.tanqueLleno ?? true,
        conductor: tanqueo.conductor?._id ?? "",
        fecha: tanqueo.fecha ? tanqueo.fecha.substring(0, 10) : "",
      });
    } else {
      setForm(initialForm);
    }
  }, [open, tanqueo]);

  const { data: vehiculosRes, isLoading: loadingVehiculos } = useQuery({
    queryKey: ["apirndc-vehiculos-list"],
    queryFn: ({ signal }) => getVehiculosList(signal),
    enabled: open,
    staleTime: 5 * 60_000,
  });
  const vehiculos = vehiculosRes?.data ?? [];

  const { data: conductores = [], isLoading: loadingConductores } = useConductores();

  const handleConsultarKm = async () => {
    if (!form.vehiculo) return;
    setLoadingKm(true);
    try {
      const res = await getVehiculoKilometraje(form.vehiculo);
      if (res.data?.kilometraje !== null && res.data?.kilometraje !== undefined) {
        setForm((f) => ({ ...f, kmTanqueo: String(res.data.kilometraje) }));
        toast.info(
          `Km actual: ${res.data.kilometraje.toLocaleString("es-CO")} (${KM_FUENTE_LABELS[res.data.fuente] ?? res.data.fuente})`,
        );
      } else {
        toast.info("Sin kilometraje disponible para este vehículo");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al consultar el kilometraje");
    } finally {
      setLoadingKm(false);
    }
  };

  /**
   * Maneja los campos galones / costoTotal / costoPorGalon recalculando el tercer valor
   * a partir de la relación: costoTotal = galones × costoPorGalon.
   * El campo que el usuario está editando se mantiene; se recalcula el complementario
   * según qué datos hay disponibles.
   */
  const handleNumChange = (field: "galones" | "costoTotal" | "costoPorGalon", raw: string) => {
    setForm((f) => recalcCombustible(f, field, raw));
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const payload: ApiRndcTanqueoCreatePayload = {
        vehiculo: form.vehiculo,
        kmTanqueo: Number(parseDecimal(form.kmTanqueo) ?? 0),
        galones: Number(parseDecimal(form.galones) ?? 0),
        tipoCombustible: form.tipoCombustible,
        tanqueLleno: form.tanqueLleno,
      };
      const totalNum = parseDecimal(form.costoTotal);
      const cpgNum = parseDecimal(form.costoPorGalon);
      payload.costoTotal = totalNum !== null ? totalNum : undefined;
      payload.costoPorGalon = cpgNum !== null ? cpgNum : undefined;
      payload.estacion = form.estacion.trim() || undefined;
      payload.conductor = form.conductor || undefined;
      if (form.fecha) payload.fecha = form.fecha;
      if (isEdit) {
        // El vehículo no se edita; el backend lo ignora.
        const { vehiculo: _vehiculo, ...rest } = payload;
        return updateTanqueo(tanqueo!._id, rest);
      }
      return createTanqueo(payload);
    },
    onSuccess: () => {
      toast.success(isEdit ? "Tanqueo actualizado exitosamente" : "Tanqueo registrado exitosamente");
      queryClient.invalidateQueries({ queryKey: ["op-combustible"] });
      queryClient.invalidateQueries({ queryKey: ["op-rendimiento"] });
      onOpenChange(false);
    },
    onError: (error: Error) =>
      toast.error(error.message || (isEdit ? "Error al actualizar el tanqueo" : "Error al registrar el tanqueo")),
  });

  const canSubmit =
    !!form.vehiculo && form.kmTanqueo !== "" && form.galones !== "" && (parseDecimal(form.galones) ?? 0) > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Tanqueo" : "Registrar Tanqueo"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Modifique los datos del abastecimiento. El vehículo no se puede cambiar."
              : "Registre un abastecimiento de combustible para un vehículo."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Vehículo *</Label>
            <Select
              value={form.vehiculo}
              onValueChange={(value) => setForm({ ...form, vehiculo: value })}
              disabled={isEdit}
            >
              <SelectTrigger>
                <SelectValue placeholder={loadingVehiculos ? "Cargando..." : "Seleccione un vehículo"} />
              </SelectTrigger>
              <SelectContent>
                {vehiculos.map((v) => (
                  <SelectItem key={v._id} value={v._id}>
                    {v.placa}{v.marca ? ` - ${v.marca}${v.linea ? ` ${v.linea}` : ""}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Km tanqueo *</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={form.kmTanqueo}
                  onChange={(e) => setForm({ ...form, kmTanqueo: e.target.value })}
                  placeholder="0"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  title="Consultar kilometraje actual"
                  disabled={!form.vehiculo || loadingKm}
                  onClick={handleConsultarKm}
                >
                  {loadingKm ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gauge className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Galones *</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={form.galones}
                onChange={(e) => handleNumChange("galones", e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Costo total</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={form.costoTotal}
                onChange={(e) => handleNumChange("costoTotal", e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label>Costo por galón</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={form.costoPorGalon}
                onChange={(e) => handleNumChange("costoPorGalon", e.target.value)}
                placeholder="0"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground -mt-2">
            Indique el costo total o el costo por galón; el otro valor se calcula automáticamente.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tipo de combustible</Label>
              <Select
                value={form.tipoCombustible}
                onValueChange={(value) => setForm({ ...form, tipoCombustible: value as ApiRndcTipoCombustible })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPO_COMBUSTIBLE.map((t) => (
                    <SelectItem key={t} value={t}>{TIPO_COMBUSTIBLE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Estación</Label>
              <Input
                value={form.estacion}
                onChange={(e) => setForm({ ...form, estacion: e.target.value })}
                placeholder="Nombre de la estación"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Conductor (opcional)</Label>
              <Select
                value={form.conductor || "none"}
                onValueChange={(value) => setForm({ ...form, conductor: value === "none" ? "" : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingConductores ? "Cargando..." : "Sin conductor"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin conductor</SelectItem>
                  {conductores.map((c) => (
                    <SelectItem key={c._id} value={c._id}>
                      {[c.nombres, c.apellidos].filter(Boolean).join(" ") || c.identificacion}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fecha</Label>
              <Input
                type="date"
                value={form.fecha}
                onChange={(e) => setForm({ ...form, fecha: e.target.value })}
              />
            </div>
          </div>

          <div className="flex items-center justify-between bg-muted/30 border rounded-lg p-3">
            <div>
              <Label className="cursor-pointer">Tanque lleno</Label>
              <p className="text-xs text-muted-foreground">
                Necesario para calcular el rendimiento del tramo.
              </p>
            </div>
            <Switch
              checked={form.tanqueLleno}
              onCheckedChange={(checked) => setForm({ ...form, tanqueLleno: checked })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => mutation.mutate()} disabled={!canSubmit || mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEdit ? "Guardar cambios" : "Registrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Diálogo: Eliminar ───

function EliminarDialog({ tanqueo, onClose }: { tanqueo: ApiRndcTanqueo | null; onClose: () => void }) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => deleteTanqueo(tanqueo!._id),
    onSuccess: () => {
      toast.success("Tanqueo eliminado");
      queryClient.invalidateQueries({ queryKey: ["op-combustible"] });
      queryClient.invalidateQueries({ queryKey: ["op-rendimiento"] });
      onClose();
    },
    onError: (error: Error) => toast.error(error.message || "Error al eliminar el tanqueo"),
  });

  return (
    <Dialog open={!!tanqueo} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Eliminar tanqueo</DialogTitle>
          <DialogDescription>
            ¿Está seguro de eliminar este registro de tanqueo? Esta acción no se puede deshacer.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button variant="destructive" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Eliminar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Tab de Combustible ───

export function CombustibleTab() {
  const { role, user } = useAuth();
  const isAdmin = role === "admin"; // Editar/eliminar tanqueos sigue siendo exclusivo del admin (backend: ADMIN_COMBUSTIBLE)
  // Registrar tanqueo: lo permite el backend (REGISTRO_TANQUEO) a admin y CLIENTE_ADMIN.
  // Verificamos el rol real de la API (no el "role" colapsado) para no habilitarlo a AUDITOR (solo lectura).
  const apiRolesNorm = (user?.apiRoles ?? []).map((r) => r.replace(/^ROLE_/, "").toUpperCase());
  const canRegistrar = apiRolesNorm.some((r) => ["ADMIN", "SUPER_ADMIN", "CLIENTE_ADMIN"].includes(r));
  const [vehiculoFilter, setVehiculoFilter] = useState("all");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editTanqueo, setEditTanqueo] = useState<ApiRndcTanqueo | null>(null);
  const [eliminarTanqueo, setEliminarTanqueo] = useState<ApiRndcTanqueo | null>(null);

  const { data: vehiculosRes } = useQuery({
    queryKey: ["apirndc-vehiculos-list"],
    queryFn: ({ signal }) => getVehiculosList(signal),
    staleTime: 5 * 60_000,
  });
  const vehiculos = vehiculosRes?.data ?? [];

  const { data, isLoading, error } = useQuery({
    queryKey: ["op-combustible", vehiculoFilter, desde, hasta, page],
    queryFn: ({ signal }) =>
      getTanqueos(
        {
          vehiculo: vehiculoFilter !== "all" ? vehiculoFilter : undefined,
          desde: desde || undefined,
          hasta: hasta || undefined,
          page,
          limit: ITEMS_PER_PAGE,
        },
        signal,
      ),
  });

  const tanqueos = data?.data ?? [];
  const totalPages = data?.pages ?? 1;

  return (
    <ContentCard>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-end gap-3 mb-6">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Vehículo</label>
          <Select
            value={vehiculoFilter}
            onValueChange={(value) => {
              setVehiculoFilter(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[170px]">
              <SelectValue placeholder="Vehículo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los vehículos</SelectItem>
              {vehiculos.map((v) => (
                <SelectItem key={v._id} value={v._id}>{v.placa}</SelectItem>
              ))}
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
        <div className="flex-1" />
        {canRegistrar && (
          <Button
            onClick={() => {
              setEditTanqueo(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Registrar tanqueo
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
          Error al cargar tanqueos: {(error as Error).message}
        </div>
      ) : (
        <>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Vehículo</TableHead>
                  <TableHead>Conductor</TableHead>
                  <TableHead className="text-right">Km tanqueo</TableHead>
                  <TableHead className="text-right">Galones</TableHead>
                  <TableHead className="text-right">Costo total</TableHead>
                  <TableHead className="text-right">Costo/galón</TableHead>
                  <TableHead className="text-right">Rendimiento tramo</TableHead>
                  <TableHead>Estación</TableHead>
                  <TableHead className="text-center">Tanque lleno</TableHead>
                  <TableHead className="text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tanqueos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                      No se encontraron tanqueos
                    </TableCell>
                  </TableRow>
                ) : (
                  tanqueos.map((t) => (
                    <TableRow key={t._id}>
                      <TableCell className="text-sm whitespace-nowrap">{formatFecha(t.fecha)}</TableCell>
                      <TableCell>{t.vehiculo?.placa || t.placa || "-"}</TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">{getConductorNombre(t.conductor)}</span>
                      </TableCell>
                      <TableCell className="text-right">{formatKm(t.kmTanqueo)}</TableCell>
                      <TableCell className="text-right">{formatGalones(t.galones)}</TableCell>
                      <TableCell className="text-right">{formatCOP(t.costoTotal)}</TableCell>
                      <TableCell className="text-right">{formatCOP(t.costoPorGalon)}</TableCell>
                      <TableCell className="text-right">{formatRendimiento(t.rendimientoTramo)}</TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">{t.estacion || "-"}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        {t.tanqueLleno ? (
                          <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400 inline" />
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {isAdmin ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Acciones</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => {
                                  setEditTanqueo(t);
                                  setFormOpen(true);
                                }}
                              >
                                <Pencil className="h-4 w-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => setEliminarTanqueo(t)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Eliminar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Página {page} de {totalPages} — {data?.total ?? 0} tanqueos
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
      <TanqueoFormDialog open={formOpen} onOpenChange={setFormOpen} tanqueo={editTanqueo} />
      <EliminarDialog tanqueo={eliminarTanqueo} onClose={() => setEliminarTanqueo(null)} />
    </ContentCard>
  );
}

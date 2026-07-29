import { useEffect, useState } from "react";
import { useQuery, useQueries, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ContentCard } from "@/components/layout/ContentCard";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresasList } from "@/hooks/useEmpresasList";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getPlanesMantenimiento,
  createPlanMantenimiento,
  updatePlanMantenimiento,
  deletePlanMantenimiento,
  getVehiculosList,
  getVehiculoKilometraje,
} from "@/services/apirndc";
import type {
  ApiRndcPlanMantenimiento,
  ApiRndcPlanMantenimientoPayload,
} from "@/services/apirndc/apirndc.types";

type Alcance = "todos" | "clase" | "vehiculos";

interface PlanItemForm {
  nombre: string;
  intervaloKm: string;
  intervaloDias: string;
  umbralAlertaKm: string;
  umbralAlertaDias: string;
  unaVez: boolean;
  kmObjetivo: string;
  // Modo único con alcance por vehículos: un km objetivo distinto por vehículo (vehiculoId → km)
  kmObjetivoPorVehiculo: Record<string, string>;
}

const emptyItem: PlanItemForm = {
  nombre: "",
  intervaloKm: "",
  intervaloDias: "",
  umbralAlertaKm: "",
  umbralAlertaDias: "",
  unaVez: false,
  kmObjetivo: "",
  kmObjetivoPorVehiculo: {},
};

const EMPRESA_GLOBAL = "__global__";

function getAlcanceLabel(plan: ApiRndcPlanMantenimiento): string {
  if (plan.aplicaTodos) return "Toda la flota";
  if (plan.claseVehiculo) return `Clase: ${plan.claseVehiculo}`;
  if (plan.vehiculos && plan.vehiculos.length > 0) {
    return plan.vehiculos.map((v) => v.placa).join(", ");
  }
  return "-";
}

// ─── Diálogo de creación / edición ───

function PlanFormDialog({
  open,
  onOpenChange,
  plan,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: ApiRndcPlanMantenimiento | null;
}) {
  const queryClient = useQueryClient();
  const { role } = useAuth();
  const isPlatformAdmin = role === "admin";
  const { data: empresas = [] } = useEmpresasList();
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [alcance, setAlcance] = useState<Alcance>("todos");
  const [claseVehiculo, setClaseVehiculo] = useState("");
  const [vehiculosSel, setVehiculosSel] = useState<string[]>([]);
  const [empresaSel, setEmpresaSel] = useState<string>(EMPRESA_GLOBAL);
  const [items, setItems] = useState<PlanItemForm[]>([{ ...emptyItem }]);

  useEffect(() => {
    if (open) {
      if (plan) {
        setNombre(plan.nombre);
        setDescripcion(plan.descripcion ?? "");
        setAlcance(plan.aplicaTodos ? "todos" : plan.claseVehiculo ? "clase" : "vehiculos");
        setClaseVehiculo(plan.claseVehiculo ?? "");
        setVehiculosSel((plan.vehiculos ?? []).map((v) => v._id));
        setEmpresaSel(
          typeof plan.empresa === "string" && plan.empresa ? plan.empresa : EMPRESA_GLOBAL,
        );
        setItems(
          plan.items.length > 0
            ? plan.items.map((it) => ({
                nombre: it.nombre,
                intervaloKm: it.intervaloKm !== undefined && it.intervaloKm !== null ? String(it.intervaloKm) : "",
                intervaloDias: it.intervaloDias !== undefined && it.intervaloDias !== null ? String(it.intervaloDias) : "",
                umbralAlertaKm: it.umbralAlertaKm !== undefined && it.umbralAlertaKm !== null ? String(it.umbralAlertaKm) : "",
                umbralAlertaDias: it.umbralAlertaDias !== undefined && it.umbralAlertaDias !== null ? String(it.umbralAlertaDias) : "",
                unaVez: !!it.unaVez,
                kmObjetivo: it.kmObjetivo !== undefined && it.kmObjetivo !== null ? String(it.kmObjetivo) : "",
                kmObjetivoPorVehiculo: {},
              }))
            : [{ ...emptyItem }],
        );
      } else {
        setNombre("");
        setDescripcion("");
        setAlcance("todos");
        setClaseVehiculo("");
        setVehiculosSel([]);
        setEmpresaSel(EMPRESA_GLOBAL);
        setItems([{ ...emptyItem }]);
      }
    }
  }, [open, plan]);

  const { data: vehiculosRes, isLoading: loadingVehiculos } = useQuery({
    queryKey: ["apirndc-vehiculos-list"],
    queryFn: ({ signal }) => getVehiculosList(signal),
    enabled: open,
    staleTime: 5 * 60_000,
  });
  const vehiculos = vehiculosRes?.data ?? [];

  // Modo "mantenimiento único a km objetivo": cuando el alcance son vehículos
  // específicos, traemos el km ACTUAL de cada vehículo seleccionado para que el
  // usuario fije un km objetivo distinto por vehículo.
  const anyUnaVez = items.some((it) => it.unaVez);
  const perVehiculoUnaVez = anyUnaVez && alcance === "vehiculos" && vehiculosSel.length > 0;

  const kmQueries = useQueries({
    queries: (perVehiculoUnaVez ? vehiculosSel : []).map((id) => {
      const v = vehiculos.find((x) => x._id === id);
      return {
        queryKey: ["veh-km", id],
        queryFn: ({ signal }: { signal?: AbortSignal }) =>
          getVehiculoKilometraje(v?.placa ?? id, undefined, signal),
        enabled: open && perVehiculoUnaVez && !!v,
        staleTime: 60_000,
      };
    }),
  });
  const kmByVeh: Record<string, { km: number | null; fuente: string | null; loading: boolean }> = {};
  (perVehiculoUnaVez ? vehiculosSel : []).forEach((id, i) => {
    const q = kmQueries[i];
    kmByVeh[id] = {
      km: q?.data?.data?.kilometraje ?? null,
      fuente: q?.data?.data?.fuente ?? null,
      loading: q?.isLoading ?? false,
    };
  });

  const itemEsValido = (it: PlanItemForm) => {
    if (!it.nombre.trim()) return false;
    if (!it.unaVez) return !!(it.intervaloKm || it.intervaloDias);
    // Modo único: por vehículo requiere un km objetivo para cada vehículo seleccionado;
    // con alcance todos/clase usa un único km objetivo.
    if (perVehiculoUnaVez) return vehiculosSel.every((id) => !!it.kmObjetivoPorVehiculo[id]);
    return !!it.kmObjetivo;
  };
  const itemsValidos = items.filter(itemEsValido);
  const alcanceValido =
    alcance === "todos" ||
    (alcance === "clase" && !!claseVehiculo.trim()) ||
    (alcance === "vehiculos" && vehiculosSel.length > 0);
  const canSubmit = !!nombre.trim() && itemsValidos.length > 0 && alcanceValido;

  const buildItemPayload = (it: PlanItemForm, kmObjetivoOverride?: number) =>
    it.unaVez
      ? {
          nombre: it.nombre.trim(),
          unaVez: true,
          kmObjetivo:
            kmObjetivoOverride ?? (it.kmObjetivo ? Number(it.kmObjetivo) : undefined),
          umbralAlertaKm: it.umbralAlertaKm ? Number(it.umbralAlertaKm) : undefined,
        }
      : {
          nombre: it.nombre.trim(),
          intervaloKm: it.intervaloKm ? Number(it.intervaloKm) : undefined,
          intervaloDias: it.intervaloDias ? Number(it.intervaloDias) : undefined,
          umbralAlertaKm: it.umbralAlertaKm ? Number(it.umbralAlertaKm) : undefined,
          umbralAlertaDias: it.umbralAlertaDias ? Number(it.umbralAlertaDias) : undefined,
        };

  const withEmpresa = (p: ApiRndcPlanMantenimientoPayload) => {
    // Solo el ADMIN de plataforma puede fijar la empresa. EMPRESA_GLOBAL → null.
    if (isPlatformAdmin) p.empresa = empresaSel === EMPRESA_GLOBAL ? null : empresaSel;
    return p;
  };

  const buildPayloads = (): ApiRndcPlanMantenimientoPayload[] => {
    // Modo único por vehículo (solo al CREAR): un plan por vehículo, cada uno con su km.
    if (!plan && perVehiculoUnaVez) {
      const multi = vehiculosSel.length > 1;
      return vehiculosSel.map((vehId) => {
        const veh = vehiculos.find((v) => v._id === vehId);
        const placa = veh?.placa ?? "";
        const payload: ApiRndcPlanMantenimientoPayload = {
          nombre: multi && placa ? `${nombre.trim()} — ${placa}` : nombre.trim(),
          items: itemsValidos.map((it) =>
            it.unaVez
              ? buildItemPayload(it, Number(it.kmObjetivoPorVehiculo[vehId]))
              : buildItemPayload(it),
          ),
          aplicaTodos: false,
          vehiculos: [vehId],
        };
        if (descripcion.trim()) payload.descripcion = descripcion.trim();
        return withEmpresa(payload);
      });
    }

    // Modo normal: un solo plan.
    const payload: ApiRndcPlanMantenimientoPayload = {
      nombre: nombre.trim(),
      items: itemsValidos.map((it) => buildItemPayload(it)),
      aplicaTodos: alcance === "todos",
    };
    if (descripcion.trim()) payload.descripcion = descripcion.trim();
    if (alcance === "clase") payload.claseVehiculo = claseVehiculo.trim();
    if (alcance === "vehiculos") payload.vehiculos = vehiculosSel;
    return [withEmpresa(payload)];
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const payloads = buildPayloads();
      if (plan) return updatePlanMantenimiento(plan._id, payloads[0]);
      return Promise.all(payloads.map((p) => createPlanMantenimiento(p)));
    },
    onSuccess: () => {
      toast.success(plan ? "Plan actualizado exitosamente" : "Plan(es) creado(s) exitosamente");
      queryClient.invalidateQueries({ queryKey: ["mant-planes"] });
      queryClient.invalidateQueries({ queryKey: ["mant-alertas"] });
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message || "Error al guardar el plan"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{plan ? "Editar Plan" : "Nuevo Plan de Mantenimiento"}</DialogTitle>
          <DialogDescription>
            Defina el alcance y los ítems de mantenimiento con sus intervalos.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nombre *</Label>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre del plan" />
          </div>
          <div className="space-y-2">
            <Label>Descripción</Label>
            <Textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Descripción del plan"
              rows={2}
            />
          </div>

          {/* Empresa (solo ADMIN de plataforma) */}
          {isPlatformAdmin && (
            <div className="space-y-2">
              <Label>Empresa</Label>
              <Select value={empresaSel} onValueChange={setEmpresaSel}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione empresa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={EMPRESA_GLOBAL}>
                    Global (todas las empresas)
                  </SelectItem>
                  {empresas.map((e) => (
                    <SelectItem key={e._id} value={e._id}>
                      {e.razonSocial}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Limite el plan a una empresa, o déjelo global para toda la flota de todas las empresas.
              </p>
            </div>
          )}

          {/* Alcance */}
          <div className="space-y-2">
            <Label>Alcance *</Label>
            <RadioGroup value={alcance} onValueChange={(value) => setAlcance(value as Alcance)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="todos" id="alcance-todos" />
                <Label htmlFor="alcance-todos" className="font-normal cursor-pointer">Toda la flota</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="clase" id="alcance-clase" />
                <Label htmlFor="alcance-clase" className="font-normal cursor-pointer">Clase de vehículo</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="vehiculos" id="alcance-vehiculos" />
                <Label htmlFor="alcance-vehiculos" className="font-normal cursor-pointer">Vehículos específicos</Label>
              </div>
            </RadioGroup>
          </div>

          {alcance === "clase" && (
            <div className="space-y-2">
              <Label>Clase de vehículo *</Label>
              <Input
                value={claseVehiculo}
                onChange={(e) => setClaseVehiculo(e.target.value)}
                placeholder="Ej: CAMIONETA, BUS, MICROBUS"
              />
            </div>
          )}

          {alcance === "vehiculos" && (
            <div className="space-y-2">
              <Label>Vehículos *</Label>
              {loadingVehiculos ? (
                <div className="flex items-center gap-2 py-2">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Cargando vehículos...</span>
                </div>
              ) : (
                <div className="border rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
                  {vehiculos.map((v) => (
                    <div key={v._id} className="flex items-center gap-2">
                      <Checkbox
                        id={`veh-${v._id}`}
                        checked={vehiculosSel.includes(v._id)}
                        onCheckedChange={(checked) => {
                          setVehiculosSel((prev) =>
                            checked ? [...prev, v._id] : prev.filter((id) => id !== v._id),
                          );
                        }}
                      />
                      <Label htmlFor={`veh-${v._id}`} className="font-normal cursor-pointer text-sm">
                        {v.placa}{v.marca ? ` - ${v.marca}${v.linea ? ` ${v.linea}` : ""}` : ""}
                      </Label>
                    </div>
                  ))}
                  {vehiculos.length === 0 && (
                    <p className="text-sm text-muted-foreground">No hay vehículos disponibles.</p>
                  )}
                </div>
              )}
              <p className="text-xs text-muted-foreground">{vehiculosSel.length} vehículo(s) seleccionado(s)</p>
            </div>
          )}

          {/* Ítems */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Ítems de mantenimiento *</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setItems([...items, { ...emptyItem }])}
              >
                <Plus className="h-4 w-4 mr-1" />
                Agregar ítem
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Cada ítem requiere un intervalo en kilómetros o en días, o un kilometraje objetivo (mantenimiento único).
            </p>
            {items.map((item, idx) => (
              <div key={idx} className="border rounded-lg p-3 space-y-3">
                <div className="flex gap-2">
                  <Input
                    value={item.nombre}
                    onChange={(e) => {
                      const next = [...items];
                      next[idx] = { ...next[idx], nombre: e.target.value };
                      setItems(next);
                    }}
                    placeholder="Nombre del ítem (ej: Cambio de aceite)"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-destructive hover:text-destructive"
                    disabled={items.length === 1}
                    onClick={() => setItems(items.filter((_, i) => i !== idx))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2">
                  <div>
                    <Label className="text-sm cursor-pointer" htmlFor={`unavez-${idx}`}>
                      Mantenimiento único (a un km objetivo)
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Un solo servicio a un kilometraje puntual (ej: este vehículo a los 27.000 km). No se repite.
                    </p>
                  </div>
                  <Switch
                    id={`unavez-${idx}`}
                    checked={item.unaVez}
                    onCheckedChange={(checked) => {
                      const next = [...items];
                      next[idx] = { ...next[idx], unaVez: checked };
                      setItems(next);
                    }}
                  />
                </div>

                {item.unaVez ? (
                  <div className="space-y-3">
                    {perVehiculoUnaVez ? (
                      <div className="space-y-2">
                        <Label className="text-xs">Kilometraje objetivo por vehículo *</Label>
                        <div className="border rounded-lg divide-y">
                          {vehiculosSel.map((vehId) => {
                            const veh = vehiculos.find((v) => v._id === vehId);
                            const info = kmByVeh[vehId];
                            return (
                              <div key={vehId} className="flex items-center gap-3 p-2">
                                <p className="w-20 shrink-0 text-sm font-medium">{veh?.placa ?? vehId}</p>
                                <div className="flex-1 text-xs text-muted-foreground">
                                  Km actual:{" "}
                                  <span className="font-semibold text-foreground">
                                    {info?.loading ? "…" : info?.km != null ? `${info.km.toLocaleString()} km` : "—"}
                                  </span>
                                  {info?.fuente ? ` (${info.fuente})` : ""}
                                </div>
                                <Input
                                  type="number"
                                  min={0}
                                  className="w-32 shrink-0"
                                  value={item.kmObjetivoPorVehiculo[vehId] ?? ""}
                                  onChange={(e) => {
                                    const next = [...items];
                                    next[idx] = {
                                      ...next[idx],
                                      kmObjetivoPorVehiculo: {
                                        ...next[idx].kmObjetivoPorVehiculo,
                                        [vehId]: e.target.value,
                                      },
                                    };
                                    setItems(next);
                                  }}
                                  placeholder="Km objetivo"
                                />
                              </div>
                            );
                          })}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Se creará un plan de mantenimiento único por cada vehículo, cada uno con su propio km objetivo.
                        </p>
                        <div className="w-40 space-y-1">
                          <Label className="text-xs">Umbral alerta (km)</Label>
                          <Input
                            type="number"
                            min={0}
                            value={item.umbralAlertaKm}
                            onChange={(e) => {
                              const next = [...items];
                              next[idx] = { ...next[idx], umbralAlertaKm: e.target.value };
                              setItems(next);
                            }}
                            placeholder="500"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Kilometraje objetivo *</Label>
                          <Input
                            type="number"
                            min={0}
                            value={item.kmObjetivo}
                            onChange={(e) => {
                              const next = [...items];
                              next[idx] = { ...next[idx], kmObjetivo: e.target.value };
                              setItems(next);
                            }}
                            placeholder="27000"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Umbral alerta (km)</Label>
                          <Input
                            type="number"
                            min={0}
                            value={item.umbralAlertaKm}
                            onChange={(e) => {
                              const next = [...items];
                              next[idx] = { ...next[idx], umbralAlertaKm: e.target.value };
                              setItems(next);
                            }}
                            placeholder="500"
                          />
                        </div>
                        <p className="col-span-2 text-xs text-muted-foreground">
                          Para fijar un km objetivo distinto por vehículo, elija el alcance "Vehículos específicos".
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Intervalo (km)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={item.intervaloKm}
                      onChange={(e) => {
                        const next = [...items];
                        next[idx] = { ...next[idx], intervaloKm: e.target.value };
                        setItems(next);
                      }}
                      placeholder="5000"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Intervalo (días)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={item.intervaloDias}
                      onChange={(e) => {
                        const next = [...items];
                        next[idx] = { ...next[idx], intervaloDias: e.target.value };
                        setItems(next);
                      }}
                      placeholder="180"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Umbral alerta (km)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={item.umbralAlertaKm}
                      onChange={(e) => {
                        const next = [...items];
                        next[idx] = { ...next[idx], umbralAlertaKm: e.target.value };
                        setItems(next);
                      }}
                      placeholder="500"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Umbral alerta (días)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={item.umbralAlertaDias}
                      onChange={(e) => {
                        const next = [...items];
                        next[idx] = { ...next[idx], umbralAlertaDias: e.target.value };
                        setItems(next);
                      }}
                      placeholder="15"
                    />
                  </div>
                </div>
                )}
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => mutation.mutate()} disabled={!canSubmit || mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {plan ? "Guardar Cambios" : "Crear Plan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Tab de Planes ───

export function PlanesTab() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<ApiRndcPlanMantenimiento | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["mant-planes"],
    queryFn: ({ signal }) => getPlanesMantenimiento(signal),
  });
  const planes = data?.data ?? [];

  const toggleActivoMutation = useMutation({
    mutationFn: ({ id, activo }: { id: string; activo: boolean }) =>
      updatePlanMantenimiento(id, { activo }),
    onSuccess: (_res, vars) => {
      toast.success(vars.activo ? "Plan activado" : "Plan desactivado");
      queryClient.invalidateQueries({ queryKey: ["mant-planes"] });
      queryClient.invalidateQueries({ queryKey: ["mant-alertas"] });
    },
    onError: (err: Error) => toast.error(err.message || "Error al actualizar el plan"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deletePlanMantenimiento(id),
    onSuccess: () => {
      toast.success("Plan eliminado exitosamente");
      queryClient.invalidateQueries({ queryKey: ["mant-planes"] });
      queryClient.invalidateQueries({ queryKey: ["mant-alertas"] });
    },
    onError: (err: Error) => toast.error(err.message || "Error al eliminar el plan"),
  });

  const handleNuevo = () => {
    setEditingPlan(null);
    setFormOpen(true);
  };

  const handleEditar = (plan: ApiRndcPlanMantenimiento) => {
    setEditingPlan(plan);
    setFormOpen(true);
  };

  return (
    <ContentCard>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-semibold">Planes de mantenimiento</h3>
          <p className="text-sm text-muted-foreground">
            Defina intervalos de mantenimiento preventivo por vehículo, clase o toda la flota.
          </p>
        </div>
        <Button onClick={handleNuevo}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Plan
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="text-center py-12 text-destructive">
          Error al cargar planes: {(error as Error).message}
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Alcance</TableHead>
                <TableHead className="text-center">Ítems</TableHead>
                <TableHead className="text-center">Activo</TableHead>
                <TableHead className="text-center">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {planes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No hay planes de mantenimiento registrados
                  </TableCell>
                </TableRow>
              ) : (
                planes.map((plan) => (
                  <TableRow key={plan._id}>
                    <TableCell>
                      <p className="font-medium">{plan.nombre}</p>
                      {plan.descripcion && (
                        <p className="text-xs text-muted-foreground">{plan.descripcion}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{getAlcanceLabel(plan)}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{plan.items?.length ?? 0}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={plan.activo}
                        disabled={toggleActivoMutation.isPending}
                        onCheckedChange={(checked) =>
                          toggleActivoMutation.mutate({ id: plan._id, activo: checked })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleEditar(plan)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Eliminar plan</AlertDialogTitle>
                              <AlertDialogDescription>
                                ¿Está seguro de eliminar el plan "{plan.nombre}"? Esta acción no se puede deshacer.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteMutation.mutate(plan._id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Eliminar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <PlanFormDialog open={formOpen} onOpenChange={setFormOpen} plan={editingPlan} />
    </ContentCard>
  );
}

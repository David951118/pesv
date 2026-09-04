import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  getVehiculosList,
  getVehiculoKilometraje,
  getPlanesMantenimiento,
  createOrdenTrabajo,
} from "@/services/apirndc";
import type {
  ApiRndcKilometraje,
  ApiRndcOrdenTrabajoCreatePayload,
  ApiRndcOtManoDeObra,
  ApiRndcOtPrioridad,
  ApiRndcOtTipo,
} from "@/services/apirndc/apirndc.types";
import {
  KM_FUENTE_LABELS,
  OT_PRIORIDADES,
  OT_PRIORIDAD_LABELS,
  OT_TIPOS,
  OT_TIPO_LABELS,
  useMecanicos,
} from "./mantenimiento.helpers";
import { FacturaOtField, subirFacturaOt } from "./FacturaOtField";

export interface OrdenPrefill {
  vehiculoId?: string;
  tipo?: ApiRndcOtTipo;
  descripcion?: string;
  plan?: string;
  planItemNombre?: string;
}

interface OrdenFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefill?: OrdenPrefill | null;
}

interface RepuestoForm {
  nombre: string;
  cantidad: string;
  costoUnitario: string;
}

interface OrdenForm {
  vehiculo: string;
  tipo: ApiRndcOtTipo;
  descripcion: string;
  prioridad: ApiRndcOtPrioridad;
  kilometraje: string;
  mecanico: string;
  taller: string;
  fechaProgramada: string;
  plan: string;
  planItems: string[];
  actividades: string[];
  repuestos: RepuestoForm[];
  manoDeObraHoras: string;
  manoDeObraCosto: string;
}

const initialForm: OrdenForm = {
  vehiculo: "",
  tipo: "CORRECTIVO",
  descripcion: "",
  prioridad: "MEDIA",
  kilometraje: "",
  mecanico: "",
  taller: "",
  fechaProgramada: "",
  plan: "",
  planItems: [],
  actividades: [],
  repuestos: [],
  manoDeObraHoras: "",
  manoDeObraCosto: "",
};

const formatCOP = (value: number) =>
  value.toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });

export function OrdenFormDialog({ open, onOpenChange, prefill }: OrdenFormDialogProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<OrdenForm>(initialForm);
  const [kmInfo, setKmInfo] = useState<ApiRndcKilometraje | null>(null);
  const [loadingKm, setLoadingKm] = useState(false);
  const [facturaFile, setFacturaFile] = useState<File | null>(null);
  const [facturaProgress, setFacturaProgress] = useState<number | null>(null);

  // Reset / prefill when the dialog opens
  useEffect(() => {
    if (open) {
      setForm({
        ...initialForm,
        vehiculo: prefill?.vehiculoId ?? "",
        tipo: prefill?.tipo ?? "CORRECTIVO",
        descripcion: prefill?.descripcion ?? "",
        plan: prefill?.plan ?? "",
        planItems: prefill?.planItemNombre ? [prefill.planItemNombre] : [],
      });
      setKmInfo(null);
      setFacturaFile(null);
      setFacturaProgress(null);
    }
  }, [open, prefill]);

  const { data: vehiculosRes, isLoading: loadingVehiculos } = useQuery({
    queryKey: ["apirndc-vehiculos-list"],
    queryFn: ({ signal }) => getVehiculosList(signal),
    enabled: open,
    staleTime: 5 * 60_000,
  });
  const vehiculos = vehiculosRes?.data ?? [];

  const { data: planesRes } = useQuery({
    queryKey: ["mant-planes"],
    queryFn: ({ signal }) => getPlanesMantenimiento(signal),
    enabled: open,
    staleTime: 5 * 60_000,
  });
  const planes = (planesRes?.data ?? []).filter((p) => p.activo);
  const planSeleccionado = planes.find((p) => p._id === form.plan) ?? null;

  const { data: mecanicos = [], isLoading: loadingMecanicos } = useMecanicos();

  const togglePlanItem = (nombre: string) => {
    setForm((f) => ({
      ...f,
      planItems: f.planItems.includes(nombre)
        ? f.planItems.filter((n) => n !== nombre)
        : [...f.planItems, nombre],
    }));
  };

  const handleConsultarKm = async () => {
    if (!form.vehiculo) return;
    setLoadingKm(true);
    try {
      const res = await getVehiculoKilometraje(form.vehiculo);
      setKmInfo(res.data);
      if (res.data?.kilometraje !== null && res.data?.kilometraje !== undefined) {
        setForm((f) => ({ ...f, kilometraje: String(res.data.kilometraje) }));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al consultar el kilometraje");
    } finally {
      setLoadingKm(false);
    }
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload: ApiRndcOrdenTrabajoCreatePayload = {
        vehiculo: form.vehiculo,
        tipo: form.tipo,
        descripcion: form.descripcion.trim(),
        prioridad: form.prioridad,
      };
      if (form.kilometraje) payload.kilometraje = Number(form.kilometraje);
      if (form.mecanico) payload.mecanico = form.mecanico;
      if (form.taller.trim()) payload.taller = form.taller.trim();
      if (form.fechaProgramada) payload.fechaProgramada = form.fechaProgramada;
      // Las actividades = mantenimientos del plan seleccionados + actividades manuales.
      const manuales = form.actividades.map((a) => a.trim()).filter(Boolean);
      const actividades = [...form.planItems, ...manuales].filter(
        (descripcion, i, arr) => descripcion && arr.indexOf(descripcion) === i,
      );
      if (actividades.length > 0) {
        payload.actividades = actividades.map((descripcion) => ({ descripcion, completada: false }));
      }
      const repuestos = form.repuestos
        .map((r) => ({
          nombre: r.nombre.trim(),
          cantidad: Number(r.cantidad) || 0,
          costoUnitario: Number(r.costoUnitario) || 0,
        }))
        .filter((r) => r.nombre);
      if (repuestos.length > 0) payload.repuestos = repuestos;
      const manoDeObra: ApiRndcOtManoDeObra = {};
      if (form.manoDeObraHoras && !Number.isNaN(Number(form.manoDeObraHoras))) {
        manoDeObra.horas = Number(form.manoDeObraHoras);
      }
      if (form.manoDeObraCosto && !Number.isNaN(Number(form.manoDeObraCosto))) {
        manoDeObra.costo = Number(form.manoDeObraCosto);
      }
      if (manoDeObra.horas !== undefined || manoDeObra.costo !== undefined) {
        payload.manoDeObra = manoDeObra;
      }
      if (form.plan) payload.plan = form.plan;
      // El alert engine reinicia el ítem del plan por su nombre al cerrar la OT.
      if (form.planItems.length > 0) payload.planItemNombre = form.planItems[0];
      // La factura se sube a S3 primero; al API solo van los metadatos.
      if (facturaFile) {
        setFacturaProgress(0);
        try {
          payload.factura = await subirFacturaOt(facturaFile, (p) => setFacturaProgress(p.percent));
        } finally {
          setFacturaProgress(null);
        }
      }
      return createOrdenTrabajo(payload);
    },
    onSuccess: (res) => {
      toast.success(`Orden de trabajo ${res.data?.numero ?? ""} creada exitosamente`);
      queryClient.invalidateQueries({ queryKey: ["mant-ordenes"] });
      queryClient.invalidateQueries({ queryKey: ["mant-alertas"] });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Error al crear la orden de trabajo");
    },
  });

  const canSubmit = !!form.vehiculo && !!form.tipo && !!form.descripcion.trim();

  const totalRepuestos = form.repuestos.reduce(
    (sum, r) => sum + (Number(r.cantidad) || 0) * (Number(r.costoUnitario) || 0),
    0,
  );
  const totalManoObra = Number(form.manoDeObraCosto) || 0;
  const totalEstimado = totalRepuestos + totalManoObra;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nueva Orden de Trabajo</DialogTitle>
          <DialogDescription>
            Registre una orden de mantenimiento para un vehículo de la flota.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Vehículo *</Label>
              <Select
                value={form.vehiculo}
                onValueChange={(value) => {
                  setForm({ ...form, vehiculo: value });
                  setKmInfo(null);
                }}
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
            <div className="space-y-2">
              <Label>Tipo *</Label>
              <Select
                value={form.tipo}
                onValueChange={(value) => setForm({ ...form, tipo: value as ApiRndcOtTipo })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OT_TIPOS.map((t) => (
                    <SelectItem key={t} value={t}>{OT_TIPO_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Plan de mantenimiento + ítems a cumplir */}
          <div className="space-y-2">
            <Label>Plan de mantenimiento (opcional)</Label>
            <Select
              value={form.plan || "none"}
              onValueChange={(value) =>
                setForm({ ...form, plan: value === "none" ? "" : value, planItems: [] })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Sin plan (orden libre)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin plan</SelectItem>
                {planes.map((p) => (
                  <SelectItem key={p._id} value={p._id}>{p.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {planSeleccionado && (
              <div className="border rounded-lg p-3 space-y-2 bg-muted/20">
                <p className="text-xs text-muted-foreground">
                  Seleccione los mantenimientos a cumplir en esta orden:
                </p>
                {planSeleccionado.items.map((item) => (
                  <label
                    key={item._id ?? item.nombre}
                    className="flex items-start gap-2 cursor-pointer"
                  >
                    <Checkbox
                      checked={form.planItems.includes(item.nombre)}
                      onCheckedChange={() => togglePlanItem(item.nombre)}
                      className="mt-0.5"
                    />
                    <span className="text-sm">
                      <span className="font-medium">{item.nombre}</span>
                      {(item.intervaloKm || item.intervaloDias) && (
                        <span className="text-xs text-muted-foreground">
                          {" "}
                          (cada
                          {item.intervaloKm ? ` ${item.intervaloKm.toLocaleString("es-CO")} km` : ""}
                          {item.intervaloKm && item.intervaloDias ? " /" : ""}
                          {item.intervaloDias ? ` ${item.intervaloDias} días` : ""})
                        </span>
                      )}
                    </span>
                  </label>
                ))}
                {planSeleccionado.items.length === 0 && (
                  <p className="text-sm text-muted-foreground">El plan no tiene ítems.</p>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Descripción *</Label>
            <Textarea
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              placeholder="Describa el trabajo a realizar"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Prioridad</Label>
              <Select
                value={form.prioridad}
                onValueChange={(value) => setForm({ ...form, prioridad: value as ApiRndcOtPrioridad })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OT_PRIORIDADES.map((p) => (
                    <SelectItem key={p} value={p}>{OT_PRIORIDAD_LABELS[p]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Kilometraje</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={form.kilometraje}
                  onChange={(e) => setForm({ ...form, kilometraje: e.target.value })}
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
              {kmInfo && (
                <p className="text-xs text-muted-foreground">
                  {kmInfo.kilometraje !== null && kmInfo.kilometraje !== undefined
                    ? `Km actual: ${kmInfo.kilometraje.toLocaleString("es-CO")} (${KM_FUENTE_LABELS[kmInfo.fuente] ?? kmInfo.fuente})`
                    : "Sin kilometraje disponible para este vehículo"}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Mecánico</Label>
              <Select
                value={form.mecanico}
                onValueChange={(value) => setForm({ ...form, mecanico: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingMecanicos ? "Cargando..." : "Seleccione (opcional)"} />
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
              <Input
                value={form.taller}
                onChange={(e) => setForm({ ...form, taller: e.target.value })}
                placeholder="Nombre del taller"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Fecha programada</Label>
              <Input
                type="date"
                value={form.fechaProgramada}
                onChange={(e) => setForm({ ...form, fechaProgramada: e.target.value })}
              />
            </div>
          </div>

          {/* Actividades dinámicas */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Actividades</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setForm({ ...form, actividades: [...form.actividades, ""] })}
              >
                <Plus className="h-4 w-4 mr-1" />
                Agregar
              </Button>
            </div>
            {form.actividades.length === 0 && (
              <p className="text-sm text-muted-foreground">Sin actividades registradas.</p>
            )}
            {form.actividades.map((actividad, idx) => (
              <div key={idx} className="flex gap-2">
                <Input
                  value={actividad}
                  onChange={(e) => {
                    const actividades = [...form.actividades];
                    actividades[idx] = e.target.value;
                    setForm({ ...form, actividades });
                  }}
                  placeholder={`Actividad ${idx + 1}`}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-destructive hover:text-destructive"
                  onClick={() => setForm({ ...form, actividades: form.actividades.filter((_, i) => i !== idx) })}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          {/* Repuestos */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Repuestos</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setForm({
                    ...form,
                    repuestos: [...form.repuestos, { nombre: "", cantidad: "1", costoUnitario: "" }],
                  })
                }
              >
                <Plus className="h-4 w-4 mr-1" />
                Agregar
              </Button>
            </div>
            {form.repuestos.length === 0 && (
              <p className="text-sm text-muted-foreground">Sin repuestos registrados.</p>
            )}
            {form.repuestos.map((repuesto, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_70px_120px_auto] gap-2 items-center">
                <Input
                  value={repuesto.nombre}
                  onChange={(e) => {
                    const repuestos = [...form.repuestos];
                    repuestos[idx] = { ...repuestos[idx], nombre: e.target.value };
                    setForm({ ...form, repuestos });
                  }}
                  placeholder={`Repuesto ${idx + 1}`}
                />
                <Input
                  type="number"
                  min={0}
                  value={repuesto.cantidad}
                  onChange={(e) => {
                    const repuestos = [...form.repuestos];
                    repuestos[idx] = { ...repuestos[idx], cantidad: e.target.value };
                    setForm({ ...form, repuestos });
                  }}
                  placeholder="Cant."
                />
                <Input
                  type="number"
                  min={0}
                  value={repuesto.costoUnitario}
                  onChange={(e) => {
                    const repuestos = [...form.repuestos];
                    repuestos[idx] = { ...repuestos[idx], costoUnitario: e.target.value };
                    setForm({ ...form, repuestos });
                  }}
                  placeholder="Costo unit."
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-destructive hover:text-destructive"
                  onClick={() => setForm({ ...form, repuestos: form.repuestos.filter((_, i) => i !== idx) })}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          {/* Mano de obra */}
          <div className="space-y-2">
            <Label>Mano de obra</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Horas</span>
                <Input
                  type="number"
                  min={0}
                  value={form.manoDeObraHoras}
                  onChange={(e) => setForm({ ...form, manoDeObraHoras: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Costo</span>
                <Input
                  type="number"
                  min={0}
                  value={form.manoDeObraCosto}
                  onChange={(e) => setForm({ ...form, manoDeObraCosto: e.target.value })}
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          {/* Factura (opcional) */}
          <FacturaOtField
            file={facturaFile}
            onChange={setFacturaFile}
            disabled={createMutation.isPending}
            progress={facturaProgress}
          />

          {/* Total estimado */}
          {totalEstimado > 0 && (
            <div className="flex items-center justify-between border rounded-lg bg-muted/30 px-4 py-3">
              <span className="text-sm text-muted-foreground">Costo total estimado</span>
              <span className="text-base font-semibold">{formatCOP(totalEstimado)}</span>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => createMutation.mutate()} disabled={!canSubmit || createMutation.isPending}>
            {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Crear Orden
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

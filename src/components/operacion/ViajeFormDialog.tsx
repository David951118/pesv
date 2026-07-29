import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Gauge } from "lucide-react";
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
import {
  getVehiculosList,
  getVehiculoKilometraje,
  createViaje,
  updateViaje,
} from "@/services/apirndc";
import type {
  ApiRndcKilometraje,
  ApiRndcViaje,
  ApiRndcViajeCreatePayload,
} from "@/services/apirndc/apirndc.types";
import { KM_FUENTE_LABELS, useConductores, useRutas } from "./operacion.helpers";

interface ViajeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Viaje a editar; si es null se crea uno nuevo. */
  viaje?: ApiRndcViaje | null;
}

interface ViajeForm {
  vehiculo: string;
  conductor: string;
  ruta: string;
  origen: string;
  destino: string;
  fechaProgramada: string;
  kmInicio: string;
  pesoKg: string;
  cargaDescripcion: string;
  observaciones: string;
}

const initialForm: ViajeForm = {
  vehiculo: "",
  conductor: "",
  ruta: "",
  origen: "",
  destino: "",
  fechaProgramada: "",
  kmInicio: "",
  pesoKg: "",
  cargaDescripcion: "",
  observaciones: "",
};

export function ViajeFormDialog({ open, onOpenChange, viaje }: ViajeFormDialogProps) {
  const queryClient = useQueryClient();
  const isEdit = !!viaje;
  const [form, setForm] = useState<ViajeForm>(initialForm);
  const [kmInfo, setKmInfo] = useState<ApiRndcKilometraje | null>(null);
  const [loadingKm, setLoadingKm] = useState(false);

  useEffect(() => {
    if (open) {
      if (viaje) {
        setForm({
          vehiculo: viaje.vehiculo?._id ?? "",
          conductor: viaje.conductor?._id ?? "",
          ruta: viaje.ruta?._id ?? "",
          origen: viaje.origen ?? "",
          destino: viaje.destino ?? "",
          fechaProgramada: viaje.fechaProgramada ? viaje.fechaProgramada.substring(0, 10) : "",
          kmInicio: viaje.kmInicio !== undefined && viaje.kmInicio !== null ? String(viaje.kmInicio) : "",
          pesoKg: viaje.carga?.pesoKg !== undefined && viaje.carga?.pesoKg !== null ? String(viaje.carga.pesoKg) : "",
          cargaDescripcion: viaje.carga?.descripcion ?? "",
          observaciones: viaje.observaciones ?? "",
        });
      } else {
        setForm(initialForm);
      }
      setKmInfo(null);
    }
  }, [open, viaje]);

  const { data: vehiculosRes, isLoading: loadingVehiculos } = useQuery({
    queryKey: ["apirndc-vehiculos-list"],
    queryFn: ({ signal }) => getVehiculosList(signal),
    enabled: open,
    staleTime: 5 * 60_000,
  });
  const vehiculos = vehiculosRes?.data ?? [];

  const { data: conductores = [], isLoading: loadingConductores } = useConductores();
  const { data: rutas = [], isLoading: loadingRutas } = useRutas();

  const handleConsultarKm = async () => {
    if (!form.vehiculo) return;
    setLoadingKm(true);
    try {
      const res = await getVehiculoKilometraje(form.vehiculo);
      setKmInfo(res.data);
      if (res.data?.kilometraje !== null && res.data?.kilometraje !== undefined) {
        setForm((f) => ({ ...f, kmInicio: String(res.data.kilometraje) }));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al consultar el kilometraje");
    } finally {
      setLoadingKm(false);
    }
  };

  const buildPayload = (): ApiRndcViajeCreatePayload => {
    const payload: ApiRndcViajeCreatePayload = {
      vehiculo: form.vehiculo,
      conductor: form.conductor,
    };
    if (form.ruta) payload.ruta = form.ruta;
    if (form.origen.trim()) payload.origen = form.origen.trim();
    if (form.destino.trim()) payload.destino = form.destino.trim();
    if (form.fechaProgramada) payload.fechaProgramada = form.fechaProgramada;
    if (form.kmInicio) payload.kmInicio = Number(form.kmInicio);
    const carga: { pesoKg?: number; descripcion?: string } = {};
    if (form.pesoKg) carga.pesoKg = Number(form.pesoKg);
    if (form.cargaDescripcion.trim()) carga.descripcion = form.cargaDescripcion.trim();
    if (carga.pesoKg !== undefined || carga.descripcion) payload.carga = carga;
    if (form.observaciones.trim()) payload.observaciones = form.observaciones.trim();
    return payload;
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = buildPayload();
      return isEdit ? updateViaje(viaje!._id, payload) : createViaje(payload);
    },
    onSuccess: (res) => {
      if (isEdit) {
        toast.success("Viaje actualizado exitosamente");
      } else {
        toast.success(`Viaje ${res.data?.numero ?? ""} creado exitosamente`);
      }
      if (res.alertaSobrecarga) {
        toast.warning("⚠️ Sobrecarga: el peso supera el límite del vehículo");
      }
      queryClient.invalidateQueries({ queryKey: ["op-viajes"] });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || (isEdit ? "Error al actualizar el viaje" : "Error al crear el viaje"));
    },
  });

  const canSubmit = !!form.vehiculo && !!form.conductor;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Editar Viaje ${viaje?.numero ?? ""}` : "Nuevo Viaje"}</DialogTitle>
          <DialogDescription>
            Asigne un vehículo, conductor y ruta. Indique la carga para validar sobrecarga.
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
              <Label>Conductor *</Label>
              <Select
                value={form.conductor}
                onValueChange={(value) => setForm({ ...form, conductor: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingConductores ? "Cargando..." : "Seleccione un conductor"} />
                </SelectTrigger>
                <SelectContent>
                  {conductores.map((c) => (
                    <SelectItem key={c._id} value={c._id}>
                      {[c.nombres, c.apellidos].filter(Boolean).join(" ") || c.identificacion}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Ruta (opcional)</Label>
            <Select
              value={form.ruta || "none"}
              onValueChange={(value) => setForm({ ...form, ruta: value === "none" ? "" : value })}
            >
              <SelectTrigger>
                <SelectValue placeholder={loadingRutas ? "Cargando..." : "Sin ruta (use origen/destino)"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin ruta</SelectItem>
                {rutas.map((r) => (
                  <SelectItem key={r._id} value={r._id}>
                    {r.favorita ? "★ " : ""}
                    {r.nombre}
                    {r.puntos?.length
                      ? ` (${r.puntos.length} puntos)`
                      : [r.origen, r.destino].filter(Boolean).length
                        ? ` (${[r.origen, r.destino].filter(Boolean).join(" → ")})`
                        : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.ruta && (() => {
              const r = rutas.find((x) => x._id === form.ruta);
              if (!r?.puntos?.length) return null;
              return (
                <p className="text-xs text-muted-foreground">
                  {r.puntos.map((p) => p.nombre).join("  →  ")}
                </p>
              );
            })()}
          </div>

          {!form.ruta && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Origen</Label>
                <Input
                  value={form.origen}
                  onChange={(e) => setForm({ ...form, origen: e.target.value })}
                  placeholder="Ciudad / lugar de origen"
                />
              </div>
              <div className="space-y-2">
                <Label>Destino</Label>
                <Input
                  value={form.destino}
                  onChange={(e) => setForm({ ...form, destino: e.target.value })}
                  placeholder="Ciudad / lugar de destino"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Fecha programada</Label>
              <Input
                type="date"
                value={form.fechaProgramada}
                onChange={(e) => setForm({ ...form, fechaProgramada: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Km inicio</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={form.kmInicio}
                  onChange={(e) => setForm({ ...form, kmInicio: e.target.value })}
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

          {/* Carga */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Carga: peso (kg)</Label>
              <Input
                type="number"
                min={0}
                value={form.pesoKg}
                onChange={(e) => setForm({ ...form, pesoKg: e.target.value })}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label>Carga: descripción</Label>
              <Input
                value={form.cargaDescripcion}
                onChange={(e) => setForm({ ...form, cargaDescripcion: e.target.value })}
                placeholder="Descripción de la carga"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Observaciones</Label>
            <Textarea
              value={form.observaciones}
              onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
              placeholder="Observaciones del viaje"
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={!canSubmit || mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEdit ? "Guardar cambios" : "Crear Viaje"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

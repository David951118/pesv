import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Gauge } from "lucide-react";
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
  ApiRndcViajeOdometroAjuste,
  ApiRndcViajeUpdatePayload,
} from "@/services/apirndc/apirndc.types";
import {
  KM_FUENTE_LABELS,
  formatDuracion,
  formatKm,
  useConductores,
  useRutas,
} from "./operacion.helpers";

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
  // Datos de ejecución: solo se editan en viajes EN_CURSO (salida) o FINALIZADOS
  fechaSalida: string; // datetime-local
  fechaLlegada: string; // datetime-local
  kmFin: string;
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
  fechaSalida: "",
  fechaLlegada: "",
  kmFin: "",
};

/** ISO → valor para un <input type="datetime-local"> en la hora local del navegador. */
function toDatetimeLocal(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** datetime-local → ISO con zona (evita depender de la zona horaria del servidor). */
function fromDatetimeLocal(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

const numOrNull = (value: string): number | null =>
  value.trim() === "" || Number.isNaN(Number(value)) ? null : Number(value);

export function ViajeFormDialog({ open, onOpenChange, viaje }: ViajeFormDialogProps) {
  const queryClient = useQueryClient();
  const isEdit = !!viaje;
  const esFinalizado = isEdit && viaje?.estado === "FINALIZADO";
  const esEnCurso = isEdit && viaje?.estado === "EN_CURSO";
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
          fechaSalida: toDatetimeLocal(viaje.fechaSalida),
          fechaLlegada: toDatetimeLocal(viaje.fechaLlegada),
          kmFin: viaje.kmFin !== undefined && viaje.kmFin !== null ? String(viaje.kmFin) : "",
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

  const buildCreatePayload = (): ApiRndcViajeCreatePayload => {
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

  // Al editar se envían los campos completos (incluso vacíos) para poder LIMPIAR
  // un dato: ruta, fecha, km, carga u observaciones. El vehículo no se envía
  // porque el backend no permite cambiarlo.
  const buildUpdatePayload = (): ApiRndcViajeUpdatePayload => {
    const payload: ApiRndcViajeUpdatePayload = {
      conductor: form.conductor,
      ruta: form.ruta || null,
      origen: form.origen.trim(),
      destino: form.destino.trim(),
      fechaProgramada: form.fechaProgramada || null,
      kmInicio: numOrNull(form.kmInicio),
      carga: {
        pesoKg: numOrNull(form.pesoKg),
        descripcion: form.cargaDescripcion.trim(),
      },
      observaciones: form.observaciones.trim(),
    };
    if (esEnCurso && form.fechaSalida) {
      payload.fechaSalida = fromDatetimeLocal(form.fechaSalida);
    }
    if (esFinalizado) {
      payload.fechaSalida = fromDatetimeLocal(form.fechaSalida);
      payload.fechaLlegada = fromDatetimeLocal(form.fechaLlegada);
      payload.kmFin = numOrNull(form.kmFin);
    }
    return payload;
  };

  const mutation = useMutation({
    mutationFn: async () =>
      isEdit ? updateViaje(viaje!._id, buildUpdatePayload()) : createViaje(buildCreatePayload()),
    onSuccess: (res) => {
      if (isEdit) {
        toast.success(esFinalizado ? "Viaje corregido exitosamente" : "Viaje actualizado exitosamente");
      } else {
        toast.success(`Viaje ${res.data?.numero ?? ""} creado exitosamente`);
      }
      if (res.alertaSobrecarga) {
        toast.warning("⚠️ Sobrecarga: el peso supera el límite del vehículo");
      }
      const odometro: ApiRndcViajeOdometroAjuste | null | undefined =
        "odometro" in res ? (res.odometro as ApiRndcViajeOdometroAjuste | null | undefined) : null;
      if (odometro) {
        const placa = viaje?.vehiculo?.placa || viaje?.placa || "vehículo";
        toast.info(
          `Odómetro de ${placa} ajustado: ${formatKm(odometro.anterior)} → ${formatKm(odometro.nuevo)}`,
        );
      }
      queryClient.invalidateQueries({ queryKey: ["op-viajes"] });
      if (esFinalizado) {
        // Los km de viajes finalizados alimentan rendimiento y KPIs
        queryClient.invalidateQueries({ queryKey: ["op-rendimiento"] });
        queryClient.invalidateQueries({ queryKey: ["kpis-gerenciales"] });
      }
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || (isEdit ? "Error al actualizar el viaje" : "Error al crear el viaje"));
    },
  });

  // Validaciones en vivo de los datos de ejecución (el backend las repite)
  const kmInicioNum = numOrNull(form.kmInicio);
  const kmFinNum = numOrNull(form.kmFin);
  const salidaMs = form.fechaSalida ? new Date(form.fechaSalida).getTime() : null;
  const llegadaMs = form.fechaLlegada ? new Date(form.fechaLlegada).getTime() : null;

  const errorEjecucion = useMemo(() => {
    if (!esFinalizado) return null;
    if (kmFinNum === null) return "El kilometraje final es obligatorio en un viaje finalizado";
    if (kmInicioNum !== null && kmFinNum < kmInicioNum)
      return "El kilometraje final no puede ser menor al inicial";
    if (!form.fechaSalida || !form.fechaLlegada)
      return "Las fechas de salida y llegada son obligatorias en un viaje finalizado";
    if (salidaMs !== null && llegadaMs !== null && llegadaMs < salidaMs)
      return "La fecha de llegada no puede ser anterior a la de salida";
    return null;
  }, [esFinalizado, kmFinNum, kmInicioNum, form.fechaSalida, form.fechaLlegada, salidaMs, llegadaMs]);

  const kmRecorridoPreview =
    kmInicioNum !== null && kmFinNum !== null ? Math.max(0, kmFinNum - kmInicioNum) : null;
  const duracionPreview =
    salidaMs !== null && llegadaMs !== null ? Math.max(0, Math.round((llegadaMs - salidaMs) / 60000)) : null;

  const canSubmit = !!form.vehiculo && !!form.conductor && !errorEjecucion;

  const titulo = !isEdit
    ? "Nuevo Viaje"
    : esFinalizado
      ? `Corregir Viaje ${viaje?.numero ?? ""}`
      : `Editar Viaje ${viaje?.numero ?? ""}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>
            {esFinalizado
              ? "Corrija los datos registrados del viaje. El km recorrido y la duración se recalculan al guardar."
              : "Asigne un vehículo, conductor y ruta. Indique la carga para validar sobrecarga."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {esFinalizado && (
            <div className="flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <p>
                Este viaje ya está <strong>finalizado</strong>. Los cambios quedan en el historial del
                viaje y afectan los indicadores (km recorridos, rendimiento). Si corrige el km final,
                el odómetro del vehículo se ajusta cuando corresponde.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Vehículo *</Label>
              <Select
                value={form.vehiculo}
                disabled={isEdit}
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
              {isEdit && (
                <p className="text-xs text-muted-foreground">
                  El vehículo no se cambia en un viaje existente.
                </p>
              )}
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

          {/* Datos de ejecución: salida (EN_CURSO / FINALIZADO), llegada y km fin (FINALIZADO) */}
          {(esEnCurso || esFinalizado) && (
            <div className="space-y-3 rounded-md border p-3">
              <p className="text-sm font-medium">Datos de ejecución</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Fecha y hora de salida{esFinalizado ? " *" : ""}</Label>
                  <Input
                    type="datetime-local"
                    value={form.fechaSalida}
                    onChange={(e) => setForm({ ...form, fechaSalida: e.target.value })}
                  />
                </div>
                {esFinalizado && (
                  <div className="space-y-2">
                    <Label>Fecha y hora de llegada *</Label>
                    <Input
                      type="datetime-local"
                      value={form.fechaLlegada}
                      onChange={(e) => setForm({ ...form, fechaLlegada: e.target.value })}
                    />
                  </div>
                )}
              </div>
              {esFinalizado && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Km fin *</Label>
                    <Input
                      type="number"
                      min={0}
                      value={form.kmFin}
                      onChange={(e) => setForm({ ...form, kmFin: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Resultado</Label>
                    <p className="text-sm pt-2">
                      Km recorrido: <strong>{formatKm(kmRecorridoPreview)}</strong>
                      {" · "}
                      Duración: <strong>{formatDuracion(duracionPreview)}</strong>
                    </p>
                  </div>
                </div>
              )}
              {errorEjecucion && (
                <p className="text-xs text-destructive">{errorEjecucion}</p>
              )}
            </div>
          )}

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

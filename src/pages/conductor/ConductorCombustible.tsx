import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Car, Check, Fuel, Gauge, Loader2, Plus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getApiRndcBaseUrl } from "@/services/apirndc/apirndc.config";
import { ConductorLayout } from "@/components/layout/ConductorLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createTanqueo,
  getTanqueos,
  getVehiculoKilometraje,
} from "@/services/apirndc";
import type {
  ApiRndcTanqueoCreatePayload,
  ApiRndcTipoCombustible,
} from "@/services/apirndc/apirndc.types";
import {
  formatCOP,
  formatFecha,
  formatGalones,
  formatKm,
  formatRendimiento,
  KM_FUENTE_LABELS,
  parseDecimal,
  recalcCombustible,
  TIPO_COMBUSTIBLE,
  TIPO_COMBUSTIBLE_LABELS,
} from "@/components/operacion/operacion.helpers";

interface VehiculoResuelto {
  _id: string;
  placa: string;
  marca: string;
  linea: string;
}

interface TanqueoForm {
  kmTanqueo: string;
  galones: string;
  costoTotal: string;
  costoPorGalon: string;
  tipoCombustible: ApiRndcTipoCombustible;
  estacion: string;
  tanqueLleno: boolean;
  fecha: string;
}

const initialForm: TanqueoForm = {
  kmTanqueo: "",
  galones: "",
  costoTotal: "",
  costoPorGalon: "",
  tipoCombustible: "DIESEL",
  estacion: "",
  tanqueLleno: true,
  fecha: "",
};

export default function ConductorCombustible() {
  const { user, bearerToken, conductorId } = useAuth();
  const queryClient = useQueryClient();
  const cellviVehiculos = useMemo(() => user?.vehiculos ?? [], [user?.vehiculos]);

  const [selected, setSelected] = useState<VehiculoResuelto | null>(null);
  const [form, setForm] = useState<TanqueoForm>(initialForm);
  const [loadingKm, setLoadingKm] = useState(false);

  // ── Resolver vehículos Cellvi → _id Mongo ──
  const { data: vehiculos = [], isLoading: loadingVehiculos } = useQuery({
    queryKey: ["conductor-comb-vehiculos", cellviVehiculos.map((v) => v.id)],
    queryFn: async (): Promise<VehiculoResuelto[]> => {
      if (!bearerToken || cellviVehiculos.length === 0) return [];
      const base = getApiRndcBaseUrl();
      const results = await Promise.all(
        cellviVehiculos.map(async (v) => {
          try {
            const res = await fetch(`${base}/api/vehiculos/cellvi/${v.id}`, {
              headers: { Authorization: `Bearer ${bearerToken}` },
            });
            if (!res.ok) return null;
            const json = await res.json();
            const raw = Array.isArray(json.data) ? json.data[0] : json.data;
            if (!raw?._id) return null;
            return {
              _id: String(raw._id),
              placa: raw.placa || v.placa,
              marca: raw.marca || "",
              linea: raw.linea || "",
            } as VehiculoResuelto;
          } catch {
            return null;
          }
        }),
      );
      return results.filter((v): v is VehiculoResuelto => v !== null);
    },
    enabled: !!bearerToken && cellviVehiculos.length > 0,
  });

  // Autoseleccionar si solo hay un vehículo
  useEffect(() => {
    if (!selected && vehiculos.length === 1) setSelected(vehiculos[0]);
  }, [vehiculos, selected]);

  // Limpiar formulario al cambiar de vehículo
  useEffect(() => {
    setForm(initialForm);
  }, [selected?._id]);

  // ── Historial de tanqueos del vehículo seleccionado (solo lectura) ──
  const { data: recientesRes, isLoading: loadingRecientes } = useQuery({
    queryKey: ["conductor-comb-recientes", selected?._id],
    queryFn: ({ signal }) =>
      getTanqueos({ vehiculo: selected!._id, limit: 20 }, signal),
    enabled: !!selected?._id,
  });
  const recientes = recientesRes?.data ?? [];

  const handleConsultarKm = async () => {
    if (!selected?._id) return;
    setLoadingKm(true);
    try {
      const res = await getVehiculoKilometraje(selected._id);
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

  const handleNumChange = (field: "galones" | "costoTotal" | "costoPorGalon", raw: string) => {
    setForm((f) => recalcCombustible(f, field, raw));
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const payload: ApiRndcTanqueoCreatePayload = {
        vehiculo: selected!._id,
        kmTanqueo: Number(parseDecimal(form.kmTanqueo) ?? 0),
        galones: Number(parseDecimal(form.galones) ?? 0),
        tipoCombustible: form.tipoCombustible,
        tanqueLleno: form.tanqueLleno,
      };
      const totalNum = parseDecimal(form.costoTotal);
      const cpgNum = parseDecimal(form.costoPorGalon);
      if (totalNum !== null) payload.costoTotal = totalNum;
      if (cpgNum !== null) payload.costoPorGalon = cpgNum;
      if (form.estacion.trim()) payload.estacion = form.estacion.trim();
      if (conductorId) payload.conductor = conductorId;
      if (form.fecha) payload.fecha = form.fecha;
      return createTanqueo(payload);
    },
    onSuccess: () => {
      toast.success("Tanqueo registrado exitosamente");
      setForm(initialForm);
      queryClient.invalidateQueries({ queryKey: ["conductor-comb-recientes", selected?._id] });
    },
    onError: (error: Error) => toast.error(error.message || "Error al registrar el tanqueo"),
  });

  const canSubmit =
    !!selected && form.kmTanqueo !== "" && form.galones !== "" && (parseDecimal(form.galones) ?? 0) > 0;

  return (
    <ConductorLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Fuel className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold">Combustible</h1>
            <p className="text-sm text-muted-foreground">Registre los tanqueos de su vehículo</p>
          </div>
        </div>

        {/* Selección de vehículo */}
        {loadingVehiculos ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : vehiculos.length === 0 ? (
          <div className="text-center py-12 bg-card border rounded-lg">
            <Car className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium text-muted-foreground">No tiene vehículos asignados</p>
            <p className="text-sm text-muted-foreground mt-1">Contacte al administrador</p>
          </div>
        ) : (
          <>
            {vehiculos.length > 1 && (
              <div className="space-y-1">
                <Label className="text-sm">Vehículo</Label>
                <Select
                  value={selected?._id ?? ""}
                  onValueChange={(id) => setSelected(vehiculos.find((v) => v._id === id) ?? null)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione su vehículo" />
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
            )}

            {selected && (
              <>
                {vehiculos.length === 1 && (
                  <div className="bg-card border rounded-lg p-3 flex items-center gap-2">
                    <Car className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold">{selected.placa}</span>
                    <span className="text-sm text-muted-foreground">
                      {selected.marca} {selected.linea}
                    </span>
                  </div>
                )}

                {/* Formulario */}
                <div className="bg-card border rounded-lg p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Km tanqueo *</Label>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          inputMode="numeric"
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
                          disabled={loadingKm}
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
                    Indique el costo total o el costo por galón; el otro se calcula solo.
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Tipo de combustible</Label>
                      <Select
                        value={form.tipoCombustible}
                        onValueChange={(value) =>
                          setForm({ ...form, tipoCombustible: value as ApiRndcTipoCombustible })
                        }
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
                      <Label>Fecha</Label>
                      <Input
                        type="date"
                        value={form.fecha}
                        onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Estación</Label>
                    <Input
                      value={form.estacion}
                      onChange={(e) => setForm({ ...form, estacion: e.target.value })}
                      placeholder="Nombre de la estación"
                    />
                  </div>

                  <div className="flex items-center justify-between bg-muted/30 border rounded-lg p-3">
                    <div>
                      <Label className="cursor-pointer">Tanque lleno</Label>
                      <p className="text-xs text-muted-foreground">
                        Necesario para calcular el rendimiento.
                      </p>
                    </div>
                    <Switch
                      checked={form.tanqueLleno}
                      onCheckedChange={(checked) => setForm({ ...form, tanqueLleno: checked })}
                    />
                  </div>

                  <Button
                    onClick={() => mutation.mutate()}
                    disabled={!canSubmit || mutation.isPending}
                    className="w-full gap-2 py-6 text-base"
                  >
                    {mutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
                    Registrar tanqueo
                  </Button>
                </div>

                {/* Historial de tanqueos (solo lectura) */}
                <div className="bg-card border rounded-lg overflow-hidden">
                  <div className="px-4 py-2.5 border-b bg-muted/40 flex items-center justify-between">
                    <span className="text-sm font-semibold">Historial de tanqueos</span>
                    {recientes.length > 0 && (
                      <span className="text-xs text-muted-foreground">{recientes.length} registro(s)</span>
                    )}
                  </div>
                  {loadingRecientes ? (
                    <div className="flex justify-center py-6">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : recientes.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      Aún no hay tanqueos registrados para este vehículo.
                    </p>
                  ) : (
                    <div className="divide-y">
                      {recientes.map((t) => (
                        <div key={t._id} className="px-4 py-3 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium">
                              {formatGalones(t.galones)}
                              {t.rendimientoTramo != null && (
                                <span className="text-xs font-normal text-muted-foreground">
                                  {" "}· {formatRendimiento(t.rendimientoTramo)}
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatFecha(t.fecha)} · {formatKm(t.kmTanqueo)}
                              {t.estacion ? ` · ${t.estacion}` : ""}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm">{formatCOP(t.costoTotal)}</p>
                            {t.tanqueLleno && (
                              <span className="inline-flex items-center text-xs text-emerald-600 dark:text-emerald-400">
                                <Check className="h-3 w-3 mr-1" /> Lleno
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </ConductorLayout>
  );
}

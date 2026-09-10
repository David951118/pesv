import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
  agregarFotosMulta,
  createMulta,
  getVehiculosList,
  updateMulta,
} from "@/services/apirndc";
import type {
  ApiRndcMulta,
  ApiRndcMultaCreatePayload,
  ApiRndcMultaResponsable,
  ApiRndcMultaUpdatePayload,
} from "@/services/apirndc/apirndc.types";
import { parseDecimal, useConductores } from "@/components/operacion/operacion.helpers";
import { ArchivosMultaField } from "./ArchivosMultaField";
import {
  AUTORIDADES_SUGERIDAS,
  MULTA_RESPONSABLES,
  MULTA_RESPONSABLE_LABELS,
  MULTA_S3_FOLDER_FOTOS,
  TIPOS_ID_CONDUCTOR,
  inmovilizacionVigente,
  inputToISO,
  subirArchivosMulta,
  toDateInput,
  toDatetimeLocal,
} from "./multas.helpers";

interface MultaForm {
  vehiculo: string;
  conductorRegistrado: boolean;
  conductor: string;
  nrNombres: string;
  nrApellidos: string;
  nrTipoId: string;
  nrIdentificacion: string;
  nrTelefono: string;
  nrLicencia: string;
  fecha: string; // datetime-local
  numeroComparendo: string;
  codigoInfraccion: string;
  descripcion: string;
  autoridad: string;
  agente: string;
  ciudad: string;
  lugar: string;
  valor: string;
  fechaLimitePago: string; // date
  responsable: ApiRndcMultaResponsable;
  observaciones: string;
  inmAplica: boolean;
  inmFechaInicio: string; // datetime-local
  inmPatio: string;
  inmMotivo: string;
  inmCostoGrua: string;
  inmCostoPatios: string;
}

const initialForm: MultaForm = {
  vehiculo: "",
  conductorRegistrado: true,
  conductor: "",
  nrNombres: "",
  nrApellidos: "",
  nrTipoId: "CC",
  nrIdentificacion: "",
  nrTelefono: "",
  nrLicencia: "",
  fecha: "",
  numeroComparendo: "",
  codigoInfraccion: "",
  descripcion: "",
  autoridad: "",
  agente: "",
  ciudad: "",
  lugar: "",
  valor: "",
  fechaLimitePago: "",
  responsable: "EMPRESA",
  observaciones: "",
  inmAplica: false,
  inmFechaInicio: "",
  inmPatio: "",
  inmMotivo: "",
  inmCostoGrua: "",
  inmCostoPatios: "",
};

function formDesdeMulta(m: ApiRndcMulta): MultaForm {
  const nr = m.conductorNoRegistrado || {};
  const inm = m.inmovilizacion || { aplica: false, estado: "NO_APLICA" as const };
  return {
    vehiculo: m.vehiculo?._id ?? "",
    conductorRegistrado: !!m.conductor || !(nr.nombres || nr.apellidos || nr.identificacion),
    conductor: m.conductor?._id ?? "",
    nrNombres: nr.nombres ?? "",
    nrApellidos: nr.apellidos ?? "",
    nrTipoId: nr.tipoId || "CC",
    nrIdentificacion: nr.identificacion ?? "",
    nrTelefono: nr.telefono ?? "",
    nrLicencia: nr.licencia ?? "",
    fecha: toDatetimeLocal(m.fecha),
    numeroComparendo: m.numeroComparendo ?? "",
    codigoInfraccion: m.codigoInfraccion ?? "",
    descripcion: m.descripcion ?? "",
    autoridad: m.autoridad ?? "",
    agente: m.agente ?? "",
    ciudad: m.ciudad ?? "",
    lugar: m.lugar ?? "",
    valor: m.valor !== undefined && m.valor !== null ? String(m.valor) : "",
    fechaLimitePago: toDateInput(m.fechaLimitePago),
    responsable: m.responsable || "EMPRESA",
    observaciones: m.observaciones ?? "",
    inmAplica: !!inm.aplica,
    inmFechaInicio: toDatetimeLocal(inm.fechaInicio),
    inmPatio: inm.patio ?? "",
    inmMotivo: inm.motivo ?? "",
    inmCostoGrua: inm.costoGrua ? String(inm.costoGrua) : "",
    inmCostoPatios: inm.costoPatios ? String(inm.costoPatios) : "",
  };
}

interface MultaFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Multa a editar; null/undefined para crear una nueva */
  multa?: ApiRndcMulta | null;
  onSaved?: (multa: ApiRndcMulta) => void;
}

export function MultaFormDialog({ open, onOpenChange, multa, onSaved }: MultaFormDialogProps) {
  const queryClient = useQueryClient();
  const isEdit = !!multa;
  const [form, setForm] = useState<MultaForm>(initialForm);
  const [fotos, setFotos] = useState<File[]>([]);
  const [progress, setProgress] = useState<number | null>(null);

  // Al editar una multa cuya inmovilización sigue vigente (o ya fue levantada),
  // el ciclo se gestiona desde el detalle; aquí solo se puede ACTIVAR una
  // inmovilización que no existía.
  const inmBloqueada =
    isEdit && !!multa && (inmovilizacionVigente(multa) || multa.inmovilizacion?.estado === "LEVANTADA");

  useEffect(() => {
    if (!open) return;
    setFotos([]);
    setProgress(null);
    setForm(multa ? formDesdeMulta(multa) : initialForm);
  }, [open, multa]);

  const { data: vehiculosRes, isLoading: loadingVehiculos } = useQuery({
    queryKey: ["apirndc-vehiculos-list"],
    queryFn: ({ signal }) => getVehiculosList(signal),
    enabled: open,
    staleTime: 5 * 60_000,
  });
  const vehiculos = vehiculosRes?.data ?? [];

  const { data: conductores = [], isLoading: loadingConductores } = useConductores();

  const set = <K extends keyof MultaForm>(campo: K, valor: MultaForm[K]) =>
    setForm((f) => ({ ...f, [campo]: valor }));

  const mutation = useMutation({
    mutationFn: async () => {
      const valorNum = parseDecimal(form.valor);
      if (valorNum === null || valorNum < 0) throw new Error("Indique el valor de la multa");
      const fechaISO = inputToISO(form.fecha);
      if (!fechaISO) throw new Error("Indique la fecha de la infracción");

      const conductorNoRegistrado = form.conductorRegistrado
        ? null
        : {
            nombres: form.nrNombres.trim() || undefined,
            apellidos: form.nrApellidos.trim() || undefined,
            tipoId: form.nrTipoId || undefined,
            identificacion: form.nrIdentificacion.trim() || undefined,
            telefono: form.nrTelefono.trim() || undefined,
            licencia: form.nrLicencia.trim() || undefined,
          };

      const inmovilizacion = {
        aplica: form.inmAplica,
        fechaInicio: form.inmAplica ? inputToISO(form.inmFechaInicio) ?? null : null,
        patio: form.inmPatio.trim() || undefined,
        motivo: form.inmMotivo.trim() || undefined,
        costoGrua: parseDecimal(form.inmCostoGrua) ?? undefined,
        costoPatios: parseDecimal(form.inmCostoPatios) ?? undefined,
      };

      const base = {
        conductor: form.conductorRegistrado ? form.conductor || null : null,
        conductorNoRegistrado,
        fecha: fechaISO,
        numeroComparendo: form.numeroComparendo.trim() || undefined,
        codigoInfraccion: form.codigoInfraccion.trim().toUpperCase() || undefined,
        descripcion: form.descripcion.trim(),
        autoridad: form.autoridad.trim() || undefined,
        agente: form.agente.trim() || undefined,
        ciudad: form.ciudad.trim() || undefined,
        lugar: form.lugar.trim() || undefined,
        valor: valorNum,
        fechaLimitePago: form.fechaLimitePago ? inputToISO(form.fechaLimitePago) ?? null : null,
        responsable: form.responsable,
        observaciones: form.observaciones.trim() || undefined,
      };

      let subidas = [] as Awaited<ReturnType<typeof subirArchivosMulta>>;
      if (fotos.length) {
        setProgress(0);
        try {
          subidas = await subirArchivosMulta(fotos, MULTA_S3_FOLDER_FOTOS, setProgress);
        } finally {
          setProgress(null);
        }
      }

      if (isEdit && multa) {
        const payload: ApiRndcMultaUpdatePayload = { ...base };
        // Solo se envía la inmovilización si se puede modificar (no vigente / no levantada)
        if (!inmBloqueada) {
          payload.inmovilizacion = inmovilizacion;
        } else {
          // Datos informativos (patio, motivo, costos) sí se pueden corregir
          payload.inmovilizacion = {
            aplica: true,
            patio: inmovilizacion.patio,
            motivo: inmovilizacion.motivo,
            costoGrua: inmovilizacion.costoGrua,
            costoPatios: inmovilizacion.costoPatios,
            fechaInicio: inputToISO(form.inmFechaInicio) ?? null,
          };
        }
        const res = await updateMulta(multa._id, payload);
        let actualizada = res.data;
        if (subidas.length) {
          const r2 = await agregarFotosMulta(multa._id, subidas);
          actualizada = r2.data;
        }
        return actualizada;
      }

      const payload: ApiRndcMultaCreatePayload = {
        vehiculo: form.vehiculo,
        ...base,
        fotos: subidas,
        inmovilizacion,
      };
      const res = await createMulta(payload);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(isEdit ? "Multa actualizada" : "Multa registrada");
      if (!isEdit && data?.inmovilizacion?.aplica && data.inmovilizacion.estado === "INMOVILIZADO") {
        toast.warning(`El vehículo ${data.placa} quedó fuera de operación hasta levantar la inmovilización`);
      }
      queryClient.invalidateQueries({ queryKey: ["multas"] });
      queryClient.invalidateQueries({ queryKey: ["multas-resumen"] });
      queryClient.invalidateQueries({ queryKey: ["kpis-gerenciales"] });
      queryClient.invalidateQueries({ queryKey: ["apirndc-vehiculos-list"] });
      onSaved?.(data);
      onOpenChange(false);
    },
    onError: (error: Error) =>
      toast.error(error.message || (isEdit ? "Error al actualizar la multa" : "Error al registrar la multa")),
  });

  const canSubmit =
    !!form.vehiculo &&
    !!form.fecha &&
    form.descripcion.trim().length > 0 &&
    form.valor !== "" &&
    (parseDecimal(form.valor) ?? -1) >= 0;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!mutation.isPending) onOpenChange(v); }}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Editar multa ${multa?.numero ?? ""}` : "Registrar multa"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Modifique los datos de la infracción. El vehículo no se puede cambiar."
              : "Registre un comparendo o multa de tránsito impuesta a un vehículo de la flota."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* ── Vehículo y conductor ── */}
          <section className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Vehículo y conductor</h4>
            <div className="space-y-2">
              <Label>Vehículo *</Label>
              <Select
                value={form.vehiculo}
                onValueChange={(v) => set("vehiculo", v)}
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
                  {isEdit && multa?.vehiculo && !vehiculos.some((v) => v._id === multa.vehiculo?._id) && (
                    <SelectItem value={multa.vehiculo._id}>{multa.vehiculo.placa}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between bg-muted/30 border rounded-lg p-3">
              <div>
                <Label className="cursor-pointer">¿El conductor está registrado en la plataforma?</Label>
                <p className="text-xs text-muted-foreground">
                  Si no está registrado, digite sus datos para dejar la trazabilidad.
                </p>
              </div>
              <Switch
                checked={form.conductorRegistrado}
                onCheckedChange={(checked) => set("conductorRegistrado", checked)}
              />
            </div>

            {form.conductorRegistrado ? (
              <div className="space-y-2">
                <Label>Conductor</Label>
                <Select
                  value={form.conductor || "none"}
                  onValueChange={(v) => set("conductor", v === "none" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={loadingConductores ? "Cargando..." : "Sin conductor identificado"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin conductor identificado</SelectItem>
                    {conductores.map((c) => (
                      <SelectItem key={c._id} value={c._id}>
                        {[c.nombres, c.apellidos].filter(Boolean).join(" ") || c.identificacion}
                        {c.identificacion ? ` · ${c.identificacion}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Nombres</Label>
                  <Input value={form.nrNombres} onChange={(e) => set("nrNombres", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Apellidos</Label>
                  <Input value={form.nrApellidos} onChange={(e) => set("nrApellidos", e.target.value)} />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select value={form.nrTipoId} onValueChange={(v) => set("nrTipoId", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TIPOS_ID_CONDUCTOR.map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label>Identificación</Label>
                    <Input value={form.nrIdentificacion} onChange={(e) => set("nrIdentificacion", e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Teléfono</Label>
                  <Input value={form.nrTelefono} onChange={(e) => set("nrTelefono", e.target.value)} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Nº licencia de conducción</Label>
                  <Input value={form.nrLicencia} onChange={(e) => set("nrLicencia", e.target.value)} />
                </div>
              </div>
            )}
          </section>

          {/* ── Infracción ── */}
          <section className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Infracción</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Fecha y hora *</Label>
                <Input
                  type="datetime-local"
                  value={form.fecha}
                  onChange={(e) => set("fecha", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Nº comparendo</Label>
                <Input
                  value={form.numeroComparendo}
                  onChange={(e) => set("numeroComparendo", e.target.value)}
                  placeholder="Ej. 11001000000012345678"
                />
              </div>
              <div className="space-y-2">
                <Label>Código infracción</Label>
                <Input
                  value={form.codigoInfraccion}
                  onChange={(e) => set("codigoInfraccion", e.target.value.toUpperCase())}
                  placeholder="Ej. C02, D02"
                  maxLength={10}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descripción de la infracción *</Label>
              <Textarea
                value={form.descripcion}
                onChange={(e) => set("descripcion", e.target.value)}
                placeholder="Ej. Estacionar en sitio prohibido / Exceso de velocidad / No portar SOAT..."
                rows={2}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Autoridad</Label>
                <Input
                  list="multa-autoridades"
                  value={form.autoridad}
                  onChange={(e) => set("autoridad", e.target.value)}
                  placeholder="Secretaría de Movilidad, Policía de Tránsito..."
                />
                <datalist id="multa-autoridades">
                  {AUTORIDADES_SUGERIDAS.map((a) => (
                    <option key={a} value={a} />
                  ))}
                </datalist>
              </div>
              <div className="space-y-2">
                <Label>Agente / placa del agente</Label>
                <Input value={form.agente} onChange={(e) => set("agente", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Ciudad</Label>
                <Input value={form.ciudad} onChange={(e) => set("ciudad", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Lugar / dirección</Label>
                <Input value={form.lugar} onChange={(e) => set("lugar", e.target.value)} />
              </div>
            </div>
          </section>

          {/* ── Dinero ── */}
          <section className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Valor y pago</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Valor de la multa *</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={form.valor}
                  onChange={(e) => set("valor", e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label>Fecha límite de pago</Label>
                <Input
                  type="date"
                  value={form.fechaLimitePago}
                  onChange={(e) => set("fechaLimitePago", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Responsable del pago</Label>
                <Select
                  value={form.responsable}
                  onValueChange={(v) => set("responsable", v as ApiRndcMultaResponsable)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MULTA_RESPONSABLES.map((r) => (
                      <SelectItem key={r} value={r}>{MULTA_RESPONSABLE_LABELS[r]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          {/* ── Inmovilización ── */}
          <section className="space-y-3 border rounded-lg p-3 bg-muted/20">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label className="cursor-pointer text-sm font-semibold">El vehículo fue inmovilizado</Label>
                <p className="text-xs text-muted-foreground">
                  {inmBloqueada
                    ? "La inmovilización de esta multa se gestiona desde el detalle (corrección y levantamiento)."
                    : "Al guardar, el vehículo saldrá de operación (no podrá hacer preoperacionales ni viajes) hasta que se suba la corrección y administración levante la inmovilización."}
                </p>
              </div>
              <Switch
                checked={form.inmAplica}
                onCheckedChange={(checked) => set("inmAplica", checked)}
                disabled={inmBloqueada}
              />
            </div>
            {form.inmAplica && (
              <>
                {!isEdit && (
                  <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md p-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>
                      El vehículo pasará a estado <strong>INMOVILIZADO</strong> y dejará de contar como disponible en los KPIs.
                    </span>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Fecha de inmovilización</Label>
                    <Input
                      type="datetime-local"
                      value={form.inmFechaInicio}
                      onChange={(e) => set("inmFechaInicio", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Patio / parqueadero</Label>
                    <Input
                      value={form.inmPatio}
                      onChange={(e) => set("inmPatio", e.target.value)}
                      placeholder="Dónde quedó el vehículo"
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Motivo de la inmovilización</Label>
                    <Input
                      value={form.inmMotivo}
                      onChange={(e) => set("inmMotivo", e.target.value)}
                      placeholder="Ej. Sin tarjeta de operación vigente"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Costo grúa</Label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={form.inmCostoGrua}
                      onChange={(e) => set("inmCostoGrua", e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Costo patios</Label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={form.inmCostoPatios}
                      onChange={(e) => set("inmCostoPatios", e.target.value)}
                      placeholder="0"
                    />
                  </div>
                </div>
              </>
            )}
          </section>

          {/* ── Fotos y observaciones ── */}
          <section className="space-y-3">
            <ArchivosMultaField
              files={fotos}
              onChange={setFotos}
              progress={progress}
              disabled={mutation.isPending}
              label={isEdit ? "Agregar fotos / evidencia" : "Fotos / evidencia (comparendo, vehículo)"}
            />
            <div className="space-y-2">
              <Label>Observaciones</Label>
              <Textarea
                value={form.observaciones}
                onChange={(e) => set("observaciones", e.target.value)}
                rows={2}
              />
            </div>
          </section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={!canSubmit || mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEdit ? "Guardar cambios" : "Registrar multa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

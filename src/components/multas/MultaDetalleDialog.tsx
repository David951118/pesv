import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  Ban,
  Car,
  CheckCircle2,
  DollarSign,
  ExternalLink,
  FileText,
  Gavel,
  History,
  ImagePlus,
  Loader2,
  Lock,
  Pencil,
  Scale,
  Unlock,
  Upload,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  agregarFotosMulta,
  anularMulta,
  eliminarFotoMulta,
  impugnarMulta,
  levantarInmovilizacionMulta,
  pagarMulta,
  subirCorreccionMulta,
} from "@/services/apirndc";
import type { ApiRndcArchivo, ApiRndcMulta } from "@/services/apirndc/apirndc.types";
import { parseDecimal } from "@/components/operacion/operacion.helpers";
import { ArchivosMultaField, GaleriaArchivos } from "./ArchivosMultaField";
import {
  INMOVILIZACION_ESTADO_BADGE_CLASS,
  INMOVILIZACION_ESTADO_DESCRIPCION,
  INMOVILIZACION_ESTADO_LABELS,
  MULTA_ESTADO_BADGE_CLASS,
  MULTA_ESTADO_LABELS,
  MULTA_RESPONSABLE_LABELS,
  MULTA_S3_FOLDER_COMPROBANTES,
  MULTA_S3_FOLDER_CORRECCIONES,
  MULTA_S3_FOLDER_FOTOS,
  formatCOP,
  formatFecha,
  formatFechaHora,
  getConductorMultaIdentificacion,
  getConductorMultaNombre,
  inmovilizacionVigente,
  inputToISO,
  labelAccionHistorial,
  subirArchivosMulta,
  tieneConductor,
  toDateInput,
} from "./multas.helpers";

interface MultaDetalleDialogProps {
  multa: ApiRndcMulta | null;
  onClose: () => void;
  /** true si el usuario puede gestionar (pagar, anular, levantar, editar…) */
  canGestionar: boolean;
  onEditar?: (multa: ApiRndcMulta) => void;
  /** Se llama con la multa actualizada tras cada acción */
  onUpdated?: (multa: ApiRndcMulta) => void;
}

type SubDialogo = "pagar" | "impugnar" | "anular" | "correccion" | "levantar" | "fotos" | null;

function Campo({ label, value, className }: { label: string; value?: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium break-words">{value === undefined || value === null || value === "" ? "—" : value}</p>
    </div>
  );
}

function Seccion({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="border rounded-lg p-4 space-y-3">
      <h4 className="text-sm font-semibold flex items-center gap-2">
        <span className="text-primary">{icon}</span>
        {title}
      </h4>
      {children}
    </section>
  );
}

export function MultaDetalleDialog({ multa, onClose, canGestionar, onEditar, onUpdated }: MultaDetalleDialogProps) {
  const queryClient = useQueryClient();
  const [actual, setActual] = useState<ApiRndcMulta | null>(multa);
  const [sub, setSub] = useState<SubDialogo>(null);

  // Estado de los sub-diálogos
  const [pagoValor, setPagoValor] = useState("");
  const [pagoFecha, setPagoFecha] = useState("");
  const [pagoObs, setPagoObs] = useState("");
  const [pagoComprobante, setPagoComprobante] = useState<File[]>([]);
  const [motivo, setMotivo] = useState("");
  const [corrDescripcion, setCorrDescripcion] = useState("");
  const [corrEvidencias, setCorrEvidencias] = useState<File[]>([]);
  const [levObs, setLevObs] = useState("");
  const [levForzar, setLevForzar] = useState(false);
  const [nuevasFotos, setNuevasFotos] = useState<File[]>([]);
  const [progress, setProgress] = useState<number | null>(null);
  const [eliminandoFoto, setEliminandoFoto] = useState<string | null>(null);

  useEffect(() => {
    setActual(multa);
    setSub(null);
  }, [multa]);

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: ["multas"] });
    queryClient.invalidateQueries({ queryKey: ["multas-resumen"] });
    queryClient.invalidateQueries({ queryKey: ["kpis-gerenciales"] });
    queryClient.invalidateQueries({ queryKey: ["apirndc-vehiculos-list"] });
  };

  const aplicar = (m: ApiRndcMulta, msg: string) => {
    setActual(m);
    onUpdated?.(m);
    invalidar();
    toast.success(msg);
    setSub(null);
  };

  const abrir = (d: SubDialogo) => {
    if (!actual) return;
    setProgress(null);
    if (d === "pagar") {
      setPagoValor(String(actual.pago?.valorPagado || actual.valor || ""));
      setPagoFecha(toDateInput(new Date().toISOString()));
      setPagoObs("");
      setPagoComprobante([]);
    }
    if (d === "impugnar" || d === "anular") setMotivo("");
    if (d === "correccion") {
      setCorrDescripcion("");
      setCorrEvidencias([]);
    }
    if (d === "levantar") {
      setLevObs("");
      setLevForzar(false);
    }
    if (d === "fotos") setNuevasFotos([]);
    setSub(d);
  };

  const pagarMutation = useMutation({
    mutationFn: async () => {
      const valor = parseDecimal(pagoValor);
      if (valor === null || valor < 0) throw new Error("Indique el valor pagado");
      let comprobante: ApiRndcArchivo | null = null;
      if (pagoComprobante.length) {
        setProgress(0);
        try {
          [comprobante] = await subirArchivosMulta(pagoComprobante, MULTA_S3_FOLDER_COMPROBANTES, setProgress);
        } finally {
          setProgress(null);
        }
      }
      const res = await pagarMulta(actual!._id, {
        valorPagado: valor,
        fechaPago: pagoFecha ? inputToISO(pagoFecha) ?? null : null,
        comprobante,
        observaciones: pagoObs.trim() || undefined,
      });
      return res.data;
    },
    onSuccess: (m) => aplicar(m, "Pago registrado"),
    onError: (e: Error) => toast.error(e.message || "Error al registrar el pago"),
  });

  const impugnarMutation = useMutation({
    mutationFn: async () => (await impugnarMulta(actual!._id, motivo.trim() || undefined)).data,
    onSuccess: (m) => aplicar(m, "Multa marcada como impugnada"),
    onError: (e: Error) => toast.error(e.message || "Error al impugnar la multa"),
  });

  const anularMutation = useMutation({
    mutationFn: async () => anularMulta(actual!._id, motivo.trim() || undefined),
    onSuccess: (res) => {
      aplicar(res.data, "Multa anulada");
      if (res.vehiculoLiberado) toast.info(`El vehículo ${res.data.placa} vuelve a operación`);
    },
    onError: (e: Error) => toast.error(e.message || "Error al anular la multa"),
  });

  const correccionMutation = useMutation({
    mutationFn: async () => {
      if (!corrDescripcion.trim() && !corrEvidencias.length) {
        throw new Error("Indique una descripción de la corrección o adjunte al menos una evidencia");
      }
      let evidencias: ApiRndcArchivo[] = [];
      if (corrEvidencias.length) {
        setProgress(0);
        try {
          evidencias = await subirArchivosMulta(corrEvidencias, MULTA_S3_FOLDER_CORRECCIONES, setProgress);
        } finally {
          setProgress(null);
        }
      }
      const res = await subirCorreccionMulta(actual!._id, {
        descripcion: corrDescripcion.trim() || undefined,
        evidencias,
      });
      return res.data;
    },
    onSuccess: (m) => aplicar(m, "Corrección subida. Pendiente de validación por administración."),
    onError: (e: Error) => toast.error(e.message || "Error al subir la corrección"),
  });

  const levantarMutation = useMutation({
    mutationFn: async () =>
      levantarInmovilizacionMulta(actual!._id, {
        observaciones: levObs.trim() || undefined,
        forzar: levForzar,
      }),
    onSuccess: (res) => {
      aplicar(res.data, "Inmovilización levantada");
      if (res.vehiculoLiberado) toast.info(`El vehículo ${res.data.placa} vuelve a operación`);
    },
    onError: (e: Error) => toast.error(e.message || "Error al levantar la inmovilización"),
  });

  const fotosMutation = useMutation({
    mutationFn: async () => {
      if (!nuevasFotos.length) throw new Error("Seleccione al menos un archivo");
      setProgress(0);
      let subidas: ApiRndcArchivo[] = [];
      try {
        subidas = await subirArchivosMulta(nuevasFotos, MULTA_S3_FOLDER_FOTOS, setProgress);
      } finally {
        setProgress(null);
      }
      return (await agregarFotosMulta(actual!._id, subidas)).data;
    },
    onSuccess: (m) => aplicar(m, "Fotos agregadas"),
    onError: (e: Error) => toast.error(e.message || "Error al agregar fotos"),
  });

  const eliminarFoto = async (foto: ApiRndcArchivo) => {
    if (!actual || !foto._id) return;
    setEliminandoFoto(foto._id);
    try {
      const res = await eliminarFotoMulta(actual._id, foto._id);
      setActual(res.data);
      onUpdated?.(res.data);
      invalidar();
      toast.success("Foto eliminada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al eliminar la foto");
    } finally {
      setEliminandoFoto(null);
    }
  };

  if (!actual) return null;

  const m = actual;
  const inm = m.inmovilizacion || { aplica: false, estado: "NO_APLICA" as const };
  const vigente = inmovilizacionVigente(m);
  const corr = inm.correccion;
  const extras = (inm.costoGrua || 0) + (inm.costoPatios || 0);
  const anulada = m.estado === "ANULADA";
  const pendienteMutando =
    pagarMutation.isPending ||
    impugnarMutation.isPending ||
    anularMutation.isPending ||
    correccionMutation.isPending ||
    levantarMutation.isPending ||
    fotosMutation.isPending;

  return (
    <>
      <Dialog open={!!multa} onOpenChange={(v) => { if (!v) onClose(); }}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2">
              <Gavel className="h-5 w-5 text-primary" />
              Multa {m.numero}
              <Badge variant="outline" className={MULTA_ESTADO_BADGE_CLASS[m.estado]}>
                {MULTA_ESTADO_LABELS[m.estado]}
              </Badge>
              {inm.aplica && (
                <Badge variant="outline" className={INMOVILIZACION_ESTADO_BADGE_CLASS[inm.estado]}>
                  {inm.estado === "INMOVILIZADO" && <Lock className="h-3 w-3 mr-1" />}
                  {INMOVILIZACION_ESTADO_LABELS[inm.estado]}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              Registrada el {formatFechaHora(m.createdAt)}
              {m.registradoPorNombre || m.registradoPor ? ` por ${m.registradoPorNombre || m.registradoPor}` : ""}
            </DialogDescription>
          </DialogHeader>

          {/* Banner de inmovilización vigente */}
          {vigente && (
            <div className="flex items-start gap-3 rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 text-sm">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-700 dark:text-red-400">
                  Vehículo {m.placa} fuera de operación
                </p>
                <p className="text-red-700/90 dark:text-red-300/90">
                  {INMOVILIZACION_ESTADO_DESCRIPCION[inm.estado]}. No admite preoperacionales ni viajes hasta que
                  administración levante la inmovilización.
                </p>
              </div>
            </div>
          )}

          {/* Acciones */}
          {canGestionar && (
            <div className="flex flex-wrap gap-2">
              {["PENDIENTE", "IMPUGNADA"].includes(m.estado) && (
                <Button size="sm" onClick={() => abrir("pagar")} disabled={pendienteMutando}>
                  <DollarSign className="h-4 w-4 mr-1" /> Registrar pago
                </Button>
              )}
              {m.estado === "PENDIENTE" && (
                <Button size="sm" variant="outline" onClick={() => abrir("impugnar")} disabled={pendienteMutando}>
                  <Scale className="h-4 w-4 mr-1" /> Impugnar
                </Button>
              )}
              {vigente && (
                <>
                  <Button size="sm" variant="outline" onClick={() => abrir("correccion")} disabled={pendienteMutando}>
                    <Upload className="h-4 w-4 mr-1" /> Subir corrección
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-emerald-700 dark:text-emerald-400"
                    onClick={() => abrir("levantar")}
                    disabled={pendienteMutando}
                  >
                    <Unlock className="h-4 w-4 mr-1" /> Levantar inmovilización
                  </Button>
                </>
              )}
              {!anulada && onEditar && (
                <Button size="sm" variant="outline" onClick={() => onEditar(m)} disabled={pendienteMutando}>
                  <Pencil className="h-4 w-4 mr-1" /> Editar
                </Button>
              )}
              {!anulada && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  onClick={() => abrir("anular")}
                  disabled={pendienteMutando}
                >
                  <Ban className="h-4 w-4 mr-1" /> Anular
                </Button>
              )}
            </div>
          )}
          {!canGestionar && vigente && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => abrir("correccion")} disabled={pendienteMutando}>
                <Upload className="h-4 w-4 mr-1" /> Subir corrección
              </Button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Seccion icon={<Car className="h-4 w-4" />} title="Vehículo">
              <div className="grid grid-cols-2 gap-3">
                <Campo label="Placa" value={m.vehiculo?.placa || m.placa} />
                <Campo label="Nº interno" value={m.vehiculo?.numeroInterno} />
                <Campo
                  label="Marca / línea"
                  value={[m.vehiculo?.marca, m.vehiculo?.linea, m.vehiculo?.modelo].filter(Boolean).join(" ")}
                />
                <Campo label="Estado actual" value={m.vehiculo?.estado} />
              </div>
            </Seccion>

            <Seccion icon={<User className="h-4 w-4" />} title="Conductor">
              {tieneConductor(m) ? (
                <div className="grid grid-cols-2 gap-3">
                  <Campo
                    label="Nombre"
                    value={
                      <span className="flex flex-wrap items-center gap-1">
                        {getConductorMultaNombre(m)}
                        {!m.conductor && (
                          <Badge variant="outline" className="text-[10px]">No registrado</Badge>
                        )}
                      </span>
                    }
                  />
                  <Campo label="Identificación" value={getConductorMultaIdentificacion(m)} />
                  <Campo label="Teléfono" value={m.conductor?.contacto?.telefono || m.conductorNoRegistrado?.telefono} />
                  {!m.conductor && <Campo label="Licencia" value={m.conductorNoRegistrado?.licencia} />}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Sin conductor identificado</p>
              )}
            </Seccion>

            <Seccion icon={<FileText className="h-4 w-4" />} title="Infracción">
              <div className="grid grid-cols-2 gap-3">
                <Campo label="Fecha y hora" value={formatFechaHora(m.fecha)} />
                <Campo label="Nº comparendo" value={m.numeroComparendo} />
                <Campo label="Código" value={m.codigoInfraccion} />
                <Campo label="Autoridad" value={m.autoridad} />
                <Campo label="Descripción" value={m.descripcion} className="col-span-2" />
                <Campo label="Agente" value={m.agente} />
                <Campo label="Ciudad" value={m.ciudad} />
                <Campo label="Lugar" value={m.lugar} className="col-span-2" />
                {m.observaciones && <Campo label="Observaciones" value={m.observaciones} className="col-span-2" />}
              </div>
            </Seccion>

            <Seccion icon={<DollarSign className="h-4 w-4" />} title="Valor y pago">
              <div className="grid grid-cols-2 gap-3">
                <Campo label="Valor de la multa" value={formatCOP(m.valor)} />
                <Campo label="Responsable" value={MULTA_RESPONSABLE_LABELS[m.responsable] || m.responsable} />
                {inm.aplica && (
                  <>
                    <Campo label="Grúa" value={formatCOP(inm.costoGrua || 0)} />
                    <Campo label="Patios" value={formatCOP(inm.costoPatios || 0)} />
                  </>
                )}
                <Campo
                  label="Costo total"
                  value={<span className="font-bold">{formatCOP(m.costoTotal)}</span>}
                />
                <Campo label="Fecha límite de pago" value={formatFecha(m.fechaLimitePago)} />
                {m.estado === "PAGADA" && (
                  <>
                    <Campo label="Valor pagado" value={formatCOP(m.pago?.valorPagado ?? 0)} />
                    <Campo label="Fecha de pago" value={formatFecha(m.pago?.fechaPago)} />
                    {m.pago?.comprobante?.url && (
                      <Campo
                        label="Comprobante"
                        value={
                          <a
                            href={m.pago.comprobante.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary underline inline-flex items-center gap-1"
                          >
                            {m.pago.comprobante.nombre || "Ver comprobante"}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        }
                      />
                    )}
                    {m.pago?.observaciones && (
                      <Campo label="Observaciones del pago" value={m.pago.observaciones} className="col-span-2" />
                    )}
                  </>
                )}
                {m.estado === "IMPUGNADA" && (
                  <>
                    <Campo label="Impugnada el" value={formatFechaHora(m.impugnacion?.fecha)} />
                    <Campo label="Motivo" value={m.impugnacion?.motivo} />
                  </>
                )}
                {m.estado === "ANULADA" && (
                  <>
                    <Campo label="Anulada el" value={formatFechaHora(m.anulacion?.fecha)} />
                    <Campo label="Motivo" value={m.anulacion?.motivo} />
                  </>
                )}
                {extras > 0 && !inm.aplica && (
                  <Campo label="Costos adicionales" value={formatCOP(extras)} />
                )}
              </div>
            </Seccion>
          </div>

          {/* Fotos */}
          <Seccion icon={<ImagePlus className="h-4 w-4" />} title={`Fotos / evidencia (${m.fotos?.length || 0})`}>
            <GaleriaArchivos
              archivos={m.fotos || []}
              onEliminar={canGestionar && !anulada ? eliminarFoto : undefined}
              eliminando={eliminandoFoto}
              emptyText="Sin fotos adjuntas"
            />
            {canGestionar && !anulada && (
              <Button size="sm" variant="outline" onClick={() => abrir("fotos")} disabled={pendienteMutando}>
                <ImagePlus className="h-4 w-4 mr-1" /> Agregar fotos
              </Button>
            )}
          </Seccion>

          {/* Inmovilización */}
          {inm.aplica && (
            <Seccion icon={<Lock className="h-4 w-4" />} title="Inmovilización del vehículo">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Campo
                  label="Estado"
                  value={
                    <Badge variant="outline" className={INMOVILIZACION_ESTADO_BADGE_CLASS[inm.estado]}>
                      {INMOVILIZACION_ESTADO_LABELS[inm.estado]}
                    </Badge>
                  }
                />
                <Campo label="Desde" value={formatFechaHora(inm.fechaInicio)} />
                <Campo label="Patio / parqueadero" value={inm.patio} />
                <Campo label="Motivo" value={inm.motivo} className="col-span-2 sm:col-span-3" />
                <Campo label="Costo grúa" value={formatCOP(inm.costoGrua || 0)} />
                <Campo label="Costo patios" value={formatCOP(inm.costoPatios || 0)} />
                <Campo label="Estado previo del vehículo" value={inm.estadoVehiculoAnterior} />
              </div>

              <div className="border-t pt-3 space-y-2">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Corrección</p>
                {corr && (corr.descripcion || (corr.evidencias && corr.evidencias.length)) ? (
                  <>
                    {corr.descripcion && <p className="text-sm">{corr.descripcion}</p>}
                    <GaleriaArchivos archivos={corr.evidencias || []} emptyText="Sin evidencias" />
                    <p className="text-xs text-muted-foreground">
                      Subida el {formatFechaHora(corr.fecha)}
                      {corr.subidoPorNombre || corr.subidoPor ? ` por ${corr.subidoPorNombre || corr.subidoPor}` : ""}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {inm.estado === "LEVANTADA" ? "Se levantó sin corrección." : "Aún no se ha subido la corrección."}
                  </p>
                )}
              </div>

              {inm.estado === "LEVANTADA" && (
                <div className="border-t pt-3 space-y-1">
                  <p className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Levantamiento
                    {inm.levantadaForzada && (
                      <Badge variant="outline" className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30">
                        Sin corrección (forzado)
                      </Badge>
                    )}
                  </p>
                  <p className="text-sm">
                    {formatFechaHora(inm.fechaLevantamiento)}
                    {inm.levantadaPor ? ` · por ${inm.levantadaPor}` : ""}
                  </p>
                  {inm.observacionesLevantamiento && (
                    <p className="text-sm text-muted-foreground">{inm.observacionesLevantamiento}</p>
                  )}
                </div>
              )}
            </Seccion>
          )}

          {/* Historial */}
          <Seccion icon={<History className="h-4 w-4" />} title="Historial">
            {m.historial?.length ? (
              <ol className="space-y-2">
                {[...m.historial].reverse().map((h, idx) => (
                  <li key={`${h.fecha}-${idx}`} className="flex gap-3 text-sm">
                    <span className="text-xs text-muted-foreground whitespace-nowrap w-32 shrink-0">
                      {formatFechaHora(h.fecha)}
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium">
                        {labelAccionHistorial(h.accion)}
                        {h.usuario && <span className="text-muted-foreground font-normal"> · {h.usuario}</span>}
                      </p>
                      {h.detalle && <p className="text-muted-foreground break-words">{h.detalle}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted-foreground">Sin historial</p>
            )}
          </Seccion>
        </DialogContent>
      </Dialog>

      {/* ── Registrar pago ── */}
      <Dialog open={sub === "pagar"} onOpenChange={(v) => { if (!v && !pagarMutation.isPending) setSub(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar pago</DialogTitle>
            <DialogDescription>Multa {m.numero} · valor {formatCOP(m.valor)}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Valor pagado *</Label>
                <Input type="text" inputMode="decimal" value={pagoValor} onChange={(e) => setPagoValor(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Fecha de pago</Label>
                <Input type="date" value={pagoFecha} onChange={(e) => setPagoFecha(e.target.value)} />
              </div>
            </div>
            <ArchivosMultaField
              files={pagoComprobante}
              onChange={setPagoComprobante}
              multiple={false}
              label="Comprobante (opcional)"
              buttonText="Adjuntar comprobante"
              progress={progress}
              disabled={pagarMutation.isPending}
            />
            <div className="space-y-2">
              <Label>Observaciones</Label>
              <Textarea value={pagoObs} onChange={(e) => setPagoObs(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSub(null)} disabled={pagarMutation.isPending}>Cancelar</Button>
            <Button onClick={() => pagarMutation.mutate()} disabled={pagarMutation.isPending || pagoValor === ""}>
              {pagarMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Registrar pago
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Impugnar ── */}
      <Dialog open={sub === "impugnar"} onOpenChange={(v) => { if (!v && !impugnarMutation.isPending) setSub(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Impugnar multa</DialogTitle>
            <DialogDescription>
              La multa quedará como impugnada mientras se resuelve el recurso. Luego podrá registrar el pago o anularla.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Motivo</Label>
            <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} placeholder="Argumento del recurso..." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSub(null)} disabled={impugnarMutation.isPending}>Cancelar</Button>
            <Button onClick={() => impugnarMutation.mutate()} disabled={impugnarMutation.isPending}>
              {impugnarMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Impugnar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Anular ── */}
      <AlertDialog open={sub === "anular"} onOpenChange={(v) => { if (!v && !anularMutation.isPending) setSub(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Anular multa {m.numero}</AlertDialogTitle>
            <AlertDialogDescription>
              La multa dejará de sumar en los gastos y KPIs.
              {vigente ? ` Como tiene una inmovilización vigente, el vehículo ${m.placa} volverá a operación.` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label>Motivo</Label>
            <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={anularMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); anularMutation.mutate(); }}
              disabled={anularMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {anularMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Anular
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Subir corrección ── */}
      <Dialog open={sub === "correccion"} onOpenChange={(v) => { if (!v && !correccionMutation.isPending) setSub(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Subir corrección</DialogTitle>
            <DialogDescription>
              Evidencie que la causa de la inmovilización quedó resuelta. Administración validará y levantará la inmovilización.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Descripción de la corrección</Label>
              <Textarea
                value={corrDescripcion}
                onChange={(e) => setCorrDescripcion(e.target.value)}
                rows={3}
                placeholder="Ej. Se renovó la tarjeta de operación y se retiró el vehículo de patios"
              />
            </div>
            <ArchivosMultaField
              files={corrEvidencias}
              onChange={setCorrEvidencias}
              label="Evidencias (fotos / documentos)"
              buttonText="Adjuntar evidencias"
              progress={progress}
              disabled={correccionMutation.isPending}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSub(null)} disabled={correccionMutation.isPending}>Cancelar</Button>
            <Button
              onClick={() => correccionMutation.mutate()}
              disabled={correccionMutation.isPending || (!corrDescripcion.trim() && corrEvidencias.length === 0)}
            >
              {correccionMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Subir corrección
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Levantar inmovilización ── */}
      <Dialog open={sub === "levantar"} onOpenChange={(v) => { if (!v && !levantarMutation.isPending) setSub(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Levantar inmovilización</DialogTitle>
            <DialogDescription>
              El vehículo {m.placa} volverá a su estado anterior ({inm.estadoVehiculoAnterior || "ACTIVO"}) y podrá operar de nuevo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {inm.estado === "INMOVILIZADO" ? (
              <div className="flex items-start gap-2 rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3 text-sm">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <p className="text-amber-800 dark:text-amber-300">
                    Aún no se ha subido la corrección. Lo recomendado es subirla primero.
                  </p>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={levForzar} onCheckedChange={(c) => setLevForzar(c === true)} />
                    <span>Levantar sin corrección (quedará registrado)</span>
                  </label>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Corrección subida el {formatFechaHora(corr?.fecha)}
                {corr?.subidoPorNombre || corr?.subidoPor ? ` por ${corr?.subidoPorNombre || corr?.subidoPor}` : ""}.
                Al levantar se da por validada.
              </p>
            )}
            <div className="space-y-2">
              <Label>Observaciones</Label>
              <Textarea value={levObs} onChange={(e) => setLevObs(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSub(null)} disabled={levantarMutation.isPending}>Cancelar</Button>
            <Button
              onClick={() => levantarMutation.mutate()}
              disabled={levantarMutation.isPending || (inm.estado === "INMOVILIZADO" && !levForzar)}
            >
              {levantarMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Unlock className="h-4 w-4 mr-1" /> Levantar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Agregar fotos ── */}
      <Dialog open={sub === "fotos"} onOpenChange={(v) => { if (!v && !fotosMutation.isPending) setSub(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Agregar fotos / evidencia</DialogTitle>
            <DialogDescription>Multa {m.numero}</DialogDescription>
          </DialogHeader>
          <ArchivosMultaField
            files={nuevasFotos}
            onChange={setNuevasFotos}
            label={null}
            progress={progress}
            disabled={fotosMutation.isPending}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setSub(null)} disabled={fotosMutation.isPending}>Cancelar</Button>
            <Button onClick={() => fotosMutation.mutate()} disabled={fotosMutation.isPending || nuevasFotos.length === 0}>
              {fotosMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Subir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

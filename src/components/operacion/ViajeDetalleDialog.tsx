import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ApiRndcViaje } from "@/services/apirndc/apirndc.types";
import {
  formatDuracion,
  formatFecha,
  formatFechaSolo,
  formatFechaHora,
  formatKm,
  getConductorNombre,
  getRutaTexto,
  INCIDENCIA_TIPO_LABELS,
  VIAJE_ESTADO_BADGE_CLASS,
  VIAJE_ESTADO_LABELS,
} from "./operacion.helpers";

interface ViajeDetalleDialogProps {
  viaje: ApiRndcViaje | null;
  onClose: () => void;
}

function InfoItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-muted/30 border rounded-lg p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

export function ViajeDetalleDialog({ viaje, onClose }: ViajeDetalleDialogProps) {
  if (!viaje) return null;

  const carga = viaje.carga;
  const incidencias = viaje.incidencias ?? [];
  const historial = viaje.historial ?? [];

  return (
    <Dialog open={!!viaje} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 flex-wrap">
            <span>{viaje.numero}</span>
            <Badge variant="outline" className={VIAJE_ESTADO_BADGE_CLASS[viaje.estado]}>
              {VIAJE_ESTADO_LABELS[viaje.estado]}
            </Badge>
            {carga?.sobrecarga && (
              <Badge variant="outline" className="bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30">
                Sobrecarga
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>{getRutaTexto(viaje)}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Información general */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <InfoItem label="Vehículo" value={viaje.vehiculo?.placa || viaje.placa || "-"} />
            <InfoItem label="Conductor" value={getConductorNombre(viaje.conductor)} />
            <InfoItem label="Ruta" value={getRutaTexto(viaje)} />
            <InfoItem label="Fecha programada" value={formatFechaSolo(viaje.fechaProgramada)} />
            <InfoItem label="Fecha de salida" value={formatFechaHora(viaje.fechaSalida)} />
            <InfoItem label="Fecha de llegada" value={formatFechaHora(viaje.fechaLlegada)} />
            <InfoItem label="Km inicio" value={formatKm(viaje.kmInicio)} />
            <InfoItem label="Km fin" value={formatKm(viaje.kmFin)} />
            <InfoItem label="Km recorrido" value={formatKm(viaje.kmRecorrido)} />
            <InfoItem label="Duración" value={formatDuracion(viaje.duracionMinutos)} />
            <InfoItem label="Creado" value={formatFecha(viaje.createdAt)} />
          </div>

          {/* Carga */}
          {carga && (carga.pesoKg !== undefined || carga.descripcion) && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Carga</h4>
              <div
                className={
                  carga.sobrecarga
                    ? "border rounded-lg p-4 space-y-1.5 text-sm bg-red-500/10 border-red-500/30"
                    : "bg-muted/30 border rounded-lg p-4 space-y-1.5 text-sm"
                }
              >
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Peso</span>
                  <span className="font-medium">
                    {carga.pesoKg !== undefined && carga.pesoKg !== null
                      ? `${carga.pesoKg.toLocaleString("es-CO")} kg`
                      : "-"}
                  </span>
                </div>
                {carga.descripcion && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Descripción</span>
                    <span>{carga.descripcion}</span>
                  </div>
                )}
                {carga.sobrecarga && (
                  <div className="flex items-center gap-2 text-red-700 dark:text-red-400 pt-1">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span className="font-medium">
                      Sobrecarga: el peso supera el límite del vehículo
                      {carga.excesoKg ? ` (exceso de ${carga.excesoKg.toLocaleString("es-CO")} kg)` : ""}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Incidencias */}
          {incidencias.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Incidencias</h4>
              <div className="space-y-3">
                {incidencias.map((inc, idx) => (
                  <div key={inc._id ?? idx} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="h-2.5 w-2.5 rounded-full bg-amber-500 mt-1.5" />
                      {idx < incidencias.length - 1 && <div className="w-px flex-1 bg-border" />}
                    </div>
                    <div className="pb-3">
                      <p className="text-sm font-medium">{INCIDENCIA_TIPO_LABELS[inc.tipo] ?? inc.tipo}</p>
                      {inc.descripcion && <p className="text-sm text-muted-foreground">{inc.descripcion}</p>}
                      {inc.hora && <p className="text-xs text-muted-foreground">{inc.hora}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Observaciones */}
          {viaje.observaciones && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Observaciones</h4>
              <p className="text-sm text-muted-foreground bg-muted/30 border rounded-lg p-3">
                {viaje.observaciones}
              </p>
            </div>
          )}

          {/* Historial */}
          {historial.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Historial</h4>
              <div className="space-y-3">
                {historial.map((entry, idx) => (
                  <div key={idx} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="h-2.5 w-2.5 rounded-full bg-primary mt-1.5" />
                      {idx < historial.length - 1 && <div className="w-px flex-1 bg-border" />}
                    </div>
                    <div className="pb-3">
                      <p className="text-sm font-medium">{entry.accion}</p>
                      {entry.detalle && <p className="text-sm text-muted-foreground">{entry.detalle}</p>}
                      <p className="text-xs text-muted-foreground">
                        {formatFechaHora(entry.fecha)}{entry.usuario ? ` · ${entry.usuario}` : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

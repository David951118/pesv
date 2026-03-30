import { useMemo } from "react";
import { isToday, isBefore } from "date-fns";
import { AlertTriangle, Clock, XCircle, ClipboardList } from "lucide-react";

interface Preoperativa {
  id: string;
  fecha_hora: string;
  estado: string;
  kilometraje?: string | number | null;
  firma_url?: string | null;
  tipo_operacion?: string | null;
  velocidad_max_kmh?: number | null;
  viaje?: { fecha_salida?: string; hora_salida?: string } | null;
}

function isCompleta(p: Preoperativa): boolean {
  return p.kilometraje != null && p.firma_url != null;
}

function getLimiteVencimiento(p: Preoperativa): Date {
  if (p.viaje?.fecha_salida && p.viaje?.hora_salida) {
    const hora = p.viaje.hora_salida.slice(0, 5);
    return new Date(`${p.viaje.fecha_salida}T${hora}:00`);
  } else if (p.viaje?.fecha_salida) {
    return new Date(`${p.viaje.fecha_salida}T23:59:59`);
  }
  return new Date(p.fecha_hora);
}

interface Props {
  preoperativas: Preoperativa[];
}

export function PreoperativaSummaryBanners({ preoperativas }: Props) {
  const { vencidas, sinRealizar, pendientesHoy, futuras } = useMemo(() => {
    const now = new Date();
    let vencidas = 0;
    let sinRealizar = 0;
    let pendientesHoy = 0;
    let futuras = 0;

    for (const p of preoperativas) {
      const isPendiente = p.estado?.toLowerCase() === "pendiente";
      if (!isPendiente) continue;

      const completa = isCompleta(p);
      const limite = getLimiteVencimiento(p);

      if (!completa && isBefore(limite, now)) {
        // Hora de salida del viaje ya pasó y no se completó = VENCIDA
        vencidas++;
      } else if (!completa && isToday(limite)) {
        // Sale hoy, aún tiene tiempo
        pendientesHoy++;
      } else if (!completa && !isBefore(limite, now)) {
        // Fecha futura, sin completar
        futuras++;
      } else if (completa) {
        // Completada pero sin aprobar/rechazar
        sinRealizar++;
      }
    }

    return { vencidas, sinRealizar, pendientesHoy, futuras };
  }, [preoperativas]);

  if (vencidas === 0 && sinRealizar === 0 && pendientesHoy === 0 && futuras === 0) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
      {vencidas > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg border border-red-200 bg-red-50/60 dark:border-red-800 dark:bg-red-900/15">
          <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/40">
            <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-red-700 dark:text-red-300">
              {vencidas} vencida{vencidas > 1 ? "s" : ""}
            </p>
            <p className="text-xs text-red-600/80 dark:text-red-400/80">
              Hora de salida del viaje ya pasó
            </p>
          </div>
        </div>
      )}

      {sinRealizar > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg border border-blue-200 bg-blue-50/60 dark:border-blue-800 dark:bg-blue-900/15">
          <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/40">
            <ClipboardList className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">
              {sinRealizar} sin revisar
            </p>
            <p className="text-xs text-blue-600/80 dark:text-blue-400/80">
              Completadas, pendientes de aprobación
            </p>
          </div>
        </div>
      )}

      {pendientesHoy > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg border border-amber-200 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-900/15">
          <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900/40">
            <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
              {pendientesHoy} pendiente{pendientesHoy > 1 ? "s" : ""} hoy
            </p>
            <p className="text-xs text-amber-600/80 dark:text-amber-400/80">
              Aún tienen tiempo para completarse
            </p>
          </div>
        </div>
      )}

      {futuras > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 bg-gray-50/60 dark:border-gray-700 dark:bg-gray-800/15">
          <div className="p-2 rounded-full bg-gray-100 dark:bg-gray-800/40">
            <AlertTriangle className="h-4 w-4 text-gray-500 dark:text-gray-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              {futuras} futura{futuras > 1 ? "s" : ""}
            </p>
            <p className="text-xs text-gray-500/80 dark:text-gray-400/80">
              Programadas, sin llenar aún
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

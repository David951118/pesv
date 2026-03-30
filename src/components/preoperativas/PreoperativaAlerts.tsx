import { useMemo } from "react";
import { format, isToday, isBefore, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { AlertCircle, ClipboardCheck } from "lucide-react";

interface Preoperativa {
  id: string;
  fecha_hora: string;
  fecha_asignada?: string | null;
  estado: string;
  conductor_id: string;
  kilometraje?: string | null;
  firma_url?: string | null;
  tipo_operacion?: string | null;
  velocidad_max_kmh?: number | null;
  fecha_completada?: string | null;
  vehiculos?: { placa: string; interno: string | null } | null;
  conductores?: { nombre: string } | null;
  viaje?: { fecha_salida?: string; hora_salida?: string } | null;
}

function isCompleta(p: Preoperativa): boolean {
  return p.kilometraje != null && p.firma_url != null;
}

interface PreoperativaAlertsProps {
  preoperativas: Preoperativa[];
}

export function PreoperativaAlerts({ preoperativas }: PreoperativaAlertsProps) {
  const { vencidas, pendientesRevisar } = useMemo(() => {
    const now = new Date();
    const todayStart = startOfDay(now);

    const vencidas: { nombre: string; placa: string; fecha: string }[] = [];
    const pendientesRevisar: { nombre: string; placa: string; fecha: string }[] = [];

    for (const p of preoperativas) {
      if (p.estado?.toLowerCase() !== "pendiente") continue;

      const fechaProgramada = new Date(p.fecha_hora);
      const completa = isCompleta(p);

      // Determinar el límite de vencimiento: hora de salida del viaje si existe
      let limiteVencimiento: Date;
      if (p.viaje?.fecha_salida && p.viaje?.hora_salida) {
        const hora = p.viaje.hora_salida.slice(0, 5);
        limiteVencimiento = new Date(`${p.viaje.fecha_salida}T${hora}:00`);
      } else if (p.viaje?.fecha_salida) {
        limiteVencimiento = new Date(`${p.viaje.fecha_salida}T23:59:59`);
      } else {
        limiteVencimiento = fechaProgramada;
      }

      if (completa) {
        // Realizada pero sin aprobar/rechazar
        pendientesRevisar.push({
          nombre: p.conductores?.nombre || "Sin nombre",
          placa: p.vehiculos?.placa || "Sin placa",
          fecha: p.fecha_completada
            ? format(new Date(p.fecha_completada), "dd MMM yyyy", { locale: es })
            : format(fechaProgramada, "dd MMM yyyy", { locale: es }),
        });
      } else if (isBefore(limiteVencimiento, now)) {
        // La hora de salida del viaje ya pasó y no se completó
        vencidas.push({
          nombre: p.conductores?.nombre || "Sin nombre",
          placa: p.vehiculos?.placa || "Sin placa",
          fecha: format(limiteVencimiento, "dd MMM yyyy HH:mm", { locale: es }),
        });
      }
    }

    return { vencidas, pendientesRevisar };
  }, [preoperativas]);

  if (vencidas.length === 0 && pendientesRevisar.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
      {/* Banner: Pendientes por revisar */}
      {pendientesRevisar.length > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-lg border border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-900/10">
          <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/30">
            <ClipboardCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-blue-700 dark:text-blue-400">
              Pendientes por revisar
            </p>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-300">{pendientesRevisar.length}</p>
            <ul className="mt-1 space-y-0.5">
              {pendientesRevisar.slice(0, 5).map((v, i) => (
                <li key={i} className="text-xs text-blue-700/80 dark:text-blue-400/80 flex justify-between gap-2">
                  <span className="truncate">{v.nombre}</span>
                  <span className="font-medium shrink-0">{v.placa} · {v.fecha}</span>
                </li>
              ))}
              {pendientesRevisar.length > 5 && (
                <li className="text-xs text-blue-600 font-medium">+{pendientesRevisar.length - 5} más</li>
              )}
            </ul>
          </div>
        </div>
      )}

      {/* Banner: Vencidas sin realizar */}
      {vencidas.length > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-lg border border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-900/10">
          <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/30">
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-700 dark:text-red-400">
              No realizadas en fecha programada
            </p>
            <p className="text-2xl font-bold text-red-600 dark:text-red-300">{vencidas.length}</p>
            <ul className="mt-1 space-y-0.5">
              {vencidas.slice(0, 5).map((v, i) => (
                <li key={i} className="text-xs text-red-700/80 dark:text-red-400/80 flex justify-between gap-2">
                  <span className="truncate">{v.nombre}</span>
                  <span className="font-medium shrink-0">{v.placa} · {v.fecha}</span>
                </li>
              ))}
              {vencidas.length > 5 && (
                <li className="text-xs text-red-600 font-medium">+{vencidas.length - 5} más</li>
              )}
            </ul>
          </div>
        </div>
      )}

    </div>
  );
}

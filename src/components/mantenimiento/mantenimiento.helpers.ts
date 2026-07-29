import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { getTerceros } from "@/services/apirndc";
import type {
  ApiRndcAlertaEstado,
  ApiRndcOrdenTrabajo,
  ApiRndcOtEstado,
  ApiRndcOtPrioridad,
  ApiRndcOtTipo,
} from "@/services/apirndc/apirndc.types";

// ─── Formato ───

export function formatCOP(value?: number | null): string {
  if (value === undefined || value === null) return "-";
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatKm(value?: number | null): string {
  if (value === undefined || value === null) return "-";
  return `${value.toLocaleString("es-CO")} km`;
}

export function formatFecha(fecha?: string | null): string {
  if (!fecha) return "-";
  try {
    return format(new Date(fecha), "dd MMM yyyy", { locale: es });
  } catch {
    return fecha;
  }
}

export function formatFechaHora(fecha?: string | null): string {
  if (!fecha) return "-";
  try {
    return format(new Date(fecha), "dd MMM yyyy HH:mm", { locale: es });
  } catch {
    return fecha;
  }
}

// ─── Órdenes de trabajo ───

export const OT_ESTADOS: ApiRndcOtEstado[] = ["ABIERTA", "ASIGNADA", "EN_PROCESO", "CERRADA", "ANULADA"];
export const OT_TIPOS: ApiRndcOtTipo[] = ["PREVENTIVO", "CORRECTIVO"];
export const OT_PRIORIDADES: ApiRndcOtPrioridad[] = ["BAJA", "MEDIA", "ALTA", "URGENTE"];

export const OT_ESTADO_LABELS: Record<ApiRndcOtEstado, string> = {
  ABIERTA: "Abierta",
  ASIGNADA: "Asignada",
  EN_PROCESO: "En proceso",
  CERRADA: "Cerrada",
  ANULADA: "Anulada",
};

export const OT_ESTADO_BADGE_CLASS: Record<ApiRndcOtEstado, string> = {
  ABIERTA: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
  ASIGNADA: "bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-500/30",
  EN_PROCESO: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  CERRADA: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  ANULADA: "bg-muted text-muted-foreground border-border",
};

export const OT_TIPO_LABELS: Record<ApiRndcOtTipo, string> = {
  PREVENTIVO: "Preventivo",
  CORRECTIVO: "Correctivo",
};

export const OT_PRIORIDAD_LABELS: Record<ApiRndcOtPrioridad, string> = {
  BAJA: "Baja",
  MEDIA: "Media",
  ALTA: "Alta",
  URGENTE: "Urgente",
};

export const OT_PRIORIDAD_BADGE_CLASS: Record<ApiRndcOtPrioridad, string> = {
  BAJA: "bg-muted text-muted-foreground border-border",
  MEDIA: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
  ALTA: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  URGENTE: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
};

// ─── Alertas ───

export const ALERTA_ESTADO_LABELS: Record<ApiRndcAlertaEstado, string> = {
  VENCIDO: "Vencido",
  PROXIMO: "Próximo",
  SIN_HISTORIAL: "Sin historial",
  OK: "Al día",
};

export const ALERTA_ESTADO_BADGE_CLASS: Record<ApiRndcAlertaEstado, string> = {
  VENCIDO: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
  PROXIMO: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  SIN_HISTORIAL: "bg-muted text-muted-foreground border-border",
  OK: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
};

// ─── Kilometraje ───

export const KM_FUENTE_LABELS: Record<string, string> = {
  CELLVI_GPS: "GPS Cellvi",
  PREOPERACIONAL: "Preoperacional",
  MANUAL: "Manual",
};

// ─── Nombres ───

export function getMecanicoNombre(mecanico: ApiRndcOrdenTrabajo["mecanico"]): string {
  if (!mecanico) return "-";
  const nombre = [mecanico.nombres, mecanico.apellidos].filter(Boolean).join(" ");
  return nombre || "-";
}

// ─── Mecánicos (terceros con rol MECANICO) ───

export function useMecanicos() {
  return useQuery({
    queryKey: ["mant-mecanicos"],
    queryFn: async ({ signal }) => {
      const res = await getTerceros({ rol: "MECANICO", limit: 200 }, signal);
      const terceros = res.data ?? [];
      // Filtro defensivo por si el endpoint no soporta el parámetro rol
      return terceros.filter((t) => !Array.isArray(t.roles) || t.roles.length === 0 || t.roles.includes("MECANICO"));
    },
    staleTime: 5 * 60_000,
  });
}

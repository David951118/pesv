import { useQuery } from "@tanstack/react-query";
import { getTerceros, getRutas } from "@/services/apirndc";
import type {
  ApiRndcViaje,
  ApiRndcViajeEstado,
  ApiRndcEntregaEstado,
  ApiRndcIncidenciaTipo,
  ApiRndcTipoCombustible,
} from "@/services/apirndc/apirndc.types";

// Reutilizamos los helpers de formato del módulo de mantenimiento.
export { formatCOP, formatFecha, formatFechaSolo, formatFechaHora, formatKm } from "@/components/mantenimiento/mantenimiento.helpers";

// ─── Viajes: estados ───

export const VIAJE_ESTADOS: ApiRndcViajeEstado[] = ["PROGRAMADO", "EN_CURSO", "FINALIZADO", "CANCELADO"];

export const VIAJE_ESTADO_LABELS: Record<ApiRndcViajeEstado, string> = {
  PROGRAMADO: "Programado",
  EN_CURSO: "En curso",
  FINALIZADO: "Finalizado",
  CANCELADO: "Cancelado",
};

export const VIAJE_ESTADO_BADGE_CLASS: Record<ApiRndcViajeEstado, string> = {
  PROGRAMADO: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
  EN_CURSO: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  FINALIZADO: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  CANCELADO: "bg-muted text-muted-foreground border-border",
};

// ─── Entregas ───

export const ENTREGA_ESTADOS: ApiRndcEntregaEstado[] = ["PENDIENTE", "ENTREGADA", "FALLIDA", "PARCIAL"];

export const ENTREGA_ESTADO_LABELS: Record<ApiRndcEntregaEstado, string> = {
  PENDIENTE: "Pendiente",
  ENTREGADA: "Entregada",
  FALLIDA: "Fallida",
  PARCIAL: "Parcial",
};

export const ENTREGA_ESTADO_BADGE_CLASS: Record<ApiRndcEntregaEstado, string> = {
  PENDIENTE: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
  ENTREGADA: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  FALLIDA: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
  PARCIAL: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
};

// ─── Incidencias ───

export const INCIDENCIA_TIPOS: ApiRndcIncidenciaTipo[] = [
  "MECANICA",
  "TRAFICO",
  "ACCIDENTE",
  "CLIMA",
  "SEGURIDAD",
  "OTRO",
];

export const INCIDENCIA_TIPO_LABELS: Record<ApiRndcIncidenciaTipo, string> = {
  MECANICA: "Mecánica",
  TRAFICO: "Tráfico",
  ACCIDENTE: "Accidente",
  CLIMA: "Clima",
  SEGURIDAD: "Seguridad",
  OTRO: "Otro",
};

// ─── Combustible: helpers numéricos (aceptan coma o punto como decimal) ───

/** Convierte un string del input (con coma o punto) a número. Devuelve null si no es válido. */
export function parseDecimal(value: string | null | undefined): number | null {
  if (value == null) return null;
  const normalized = String(value).trim().replace(",", ".");
  if (normalized === "" || normalized === ".") return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

/**
 * Sanitiza lo que el usuario escribe: conserva dígitos y un único separador decimal
 * (acepta indistintamente coma o punto y respeta el que el usuario digitó).
 */
export function sanitizeDecimalInput(value: string): string {
  const cleaned = value.replace(/[^\d.,]/g, "");
  const match = cleaned.match(/^(\d*)([.,]?)(\d*)/);
  if (!match) return "";
  const [, intPart, sep, decPart] = match;
  return intPart + sep + decPart;
}

/** Formatea un número calculado a string con punto decimal, sin ceros sobrantes (máx 4 decimales). */
export function formatComputed(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "";
  return String(Math.round(n * 10000) / 10000);
}

type CombustibleNums = { galones: string; costoTotal: string; costoPorGalon: string };

/**
 * Recalcula galones / costoTotal / costoPorGalon a partir de la relación
 * costoTotal = galones × costoPorGalon. Mantiene el campo que el usuario edita
 * y recalcula el complementario según los datos disponibles.
 */
export function recalcCombustible<T extends CombustibleNums>(
  current: T,
  field: keyof CombustibleNums,
  rawValue: string,
): T {
  const value = sanitizeDecimalInput(rawValue);
  const next = { ...current, [field]: value };
  const g = parseDecimal(field === "galones" ? value : current.galones);
  const total = parseDecimal(field === "costoTotal" ? value : current.costoTotal);
  const cpg = parseDecimal(field === "costoPorGalon" ? value : current.costoPorGalon);

  if (field === "galones") {
    if (g && cpg) next.costoTotal = formatComputed(g * cpg);
    else if (g && total) next.costoPorGalon = formatComputed(total / g);
  } else if (field === "costoPorGalon") {
    if (g && cpg) next.costoTotal = formatComputed(g * cpg);
    else if (cpg && total) next.galones = formatComputed(total / cpg);
  } else if (field === "costoTotal") {
    if (g && total) next.costoPorGalon = formatComputed(total / g);
    else if (cpg && total) next.galones = formatComputed(total / cpg);
  }
  return next;
}

// ─── Combustible ───

export const TIPO_COMBUSTIBLE: ApiRndcTipoCombustible[] = ["GASOLINA", "DIESEL", "GAS"];

export const TIPO_COMBUSTIBLE_LABELS: Record<ApiRndcTipoCombustible, string> = {
  GASOLINA: "Gasolina",
  DIESEL: "Diésel",
  GAS: "Gas",
};

// ─── Kilometraje (fuente) ───

export const KM_FUENTE_LABELS: Record<string, string> = {
  CELLVI_GPS: "GPS Cellvi",
  PREOPERACIONAL: "Preoperacional",
  MANUAL: "Manual",
};

// ─── Formato ───

export function formatDuracion(minutos?: number | null): string {
  if (minutos === undefined || minutos === null) return "-";
  const horas = Math.floor(minutos / 60);
  const mins = Math.round(minutos % 60);
  if (horas <= 0) return `${mins}m`;
  return `${horas}h ${mins}m`;
}

export function formatGalones(value?: number | null): string {
  if (value === undefined || value === null) return "-";
  return `${value.toLocaleString("es-CO", { maximumFractionDigits: 2 })} gal`;
}

export function formatRendimiento(value?: number | null): string {
  if (value === undefined || value === null) return "—";
  return `${value.toLocaleString("es-CO", { maximumFractionDigits: 2 })} km/gal`;
}

// ─── Nombres ───

export function getConductorNombre(conductor: ApiRndcViaje["conductor"]): string {
  if (!conductor) return "-";
  const nombre = [conductor.nombres, conductor.apellidos].filter(Boolean).join(" ");
  return nombre || "-";
}

export function getRutaTexto(viaje: Pick<ApiRndcViaje, "ruta" | "origen" | "destino">): string {
  if (viaje.ruta) {
    const od = [viaje.ruta.origen, viaje.ruta.destino].filter(Boolean).join(" → ");
    return od ? `${viaje.ruta.nombre} (${od})` : viaje.ruta.nombre;
  }
  const od = [viaje.origen, viaje.destino].filter(Boolean).join(" → ");
  return od || "-";
}

// ─── Conductores (terceros con rol CONDUCTOR) ───

export function useConductores() {
  return useQuery({
    queryKey: ["op-conductores"],
    queryFn: async ({ signal }) => {
      const res = await getTerceros({ rol: "CONDUCTOR", limit: 200 }, signal);
      const terceros = res.data ?? [];
      // Filtro defensivo por si el endpoint no soporta el parámetro rol
      return terceros.filter(
        (t) => !Array.isArray(t.roles) || t.roles.length === 0 || t.roles.includes("CONDUCTOR"),
      );
    },
    staleTime: 5 * 60_000,
  });
}

// ─── Rutas ───

export function useRutas() {
  return useQuery({
    queryKey: ["op-rutas"],
    queryFn: async ({ signal }) => {
      const res = await getRutas(undefined, signal);
      return res.data ?? [];
    },
    staleTime: 5 * 60_000,
  });
}

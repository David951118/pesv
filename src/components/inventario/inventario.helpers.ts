import { useQuery } from "@tanstack/react-query";
import { getTerceros } from "@/services/apirndc";
import type {
  ApiRndcMovimientoTipo,
  ApiRndcRepuesto,
} from "@/services/apirndc/apirndc.types";

// Reutilizamos los helpers de formato del módulo de mantenimiento.
export { formatCOP, formatFecha, formatFechaHora } from "@/components/mantenimiento/mantenimiento.helpers";

// ─── Movimientos ───

export const MOVIMIENTO_TIPOS: ApiRndcMovimientoTipo[] = ["ENTRADA", "SALIDA", "AJUSTE"];

export const MOVIMIENTO_TIPO_LABELS: Record<ApiRndcMovimientoTipo, string> = {
  ENTRADA: "Entrada",
  SALIDA: "Salida",
  AJUSTE: "Ajuste",
};

export const MOVIMIENTO_TIPO_BADGE_CLASS: Record<ApiRndcMovimientoTipo, string> = {
  ENTRADA: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  SALIDA: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
  AJUSTE: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
};

// ─── Repuestos ───

export function isBajoStock(repuesto: Pick<ApiRndcRepuesto, "stock" | "stockMinimo">): boolean {
  return repuesto.stock <= repuesto.stockMinimo;
}

export function getProveedorNombre(proveedor: ApiRndcRepuesto["proveedor"]): string {
  if (!proveedor) return "-";
  if (proveedor.razonSocial) return proveedor.razonSocial;
  const nombre = [proveedor.nombres, proveedor.apellidos].filter(Boolean).join(" ");
  return nombre || "-";
}

// ─── Proveedores (terceros con rol PROVEEDOR) ───

export function useProveedores() {
  return useQuery({
    queryKey: ["inv-proveedores"],
    queryFn: async ({ signal }) => {
      const res = await getTerceros({ rol: "PROVEEDOR", limit: 200 }, signal);
      const terceros = res.data ?? [];
      // Filtro defensivo por si el endpoint no soporta el parámetro rol
      return terceros.filter(
        (t) => !Array.isArray(t.roles) || t.roles.length === 0 || t.roles.includes("PROVEEDOR"),
      );
    },
    staleTime: 5 * 60_000,
  });
}

export function getTerceroNombre(t: { nombres?: string; apellidos?: string; razonSocial?: string; identificacion: string }): string {
  if (t.razonSocial) return t.razonSocial;
  const nombre = [t.nombres, t.apellidos].filter(Boolean).join(" ");
  return nombre || t.identificacion;
}

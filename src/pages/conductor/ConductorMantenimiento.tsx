import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Clock, Loader2, Wrench } from "lucide-react";
import { ConductorLayout } from "@/components/layout/ConductorLayout";
import { Badge } from "@/components/ui/badge";
import { getAlertasMantenimiento, getOrdenesTrabajo } from "@/services/apirndc";
import type { ApiRndcOrdenTrabajo } from "@/services/apirndc/apirndc.types";
import {
  ALERTA_ESTADO_BADGE_CLASS,
  ALERTA_ESTADO_LABELS,
  formatFecha,
  formatKm,
} from "@/components/mantenimiento/mantenimiento.helpers";

const OT_ESTADO_LABELS: Record<string, string> = {
  ABIERTA: "Abierta",
  ASIGNADA: "Asignada",
  EN_PROCESO: "En proceso",
  CERRADA: "Cerrada",
  ANULADA: "Anulada",
};

const OT_ESTADO_BADGE: Record<string, string> = {
  ABIERTA: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
  ASIGNADA: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-500/30",
  EN_PROCESO: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  CERRADA: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  ANULADA: "bg-muted text-muted-foreground border-border",
};

function restanteTexto(km?: number | null, dias?: number | null): string {
  const p: string[] = [];
  if (km != null) p.push(`${km.toLocaleString("es-CO")} km`);
  if (dias != null) p.push(`${dias} días`);
  return p.length ? p.join(" / ") : "-";
}

export default function ConductorMantenimiento() {
  // Sin `rapido` para resolver el km real del vehículo (necesario para estimar lo
  // que falta cuando el ítem aún no tiene historial).
  const { data: alertasRes, isLoading: loadingAlertas } = useQuery({
    queryKey: ["conductor-mant-alertas"],
    queryFn: ({ signal }) => getAlertasMantenimiento(undefined, signal),
  });
  const alertas = alertasRes?.data ?? [];

  const intervaloText = (km?: number | null, dias?: number | null): string => {
    const p: string[] = [];
    if (km) p.push(`${km.toLocaleString("es-CO")} km`);
    if (dias) p.push(`${dias} días`);
    return p.length ? `cada ${p.join(" / ")}` : "";
  };

  const { data: ordenesRes, isLoading: loadingOrdenes } = useQuery({
    queryKey: ["conductor-mant-ordenes"],
    queryFn: ({ signal }) => getOrdenesTrabajo({ limit: 100 }, signal),
  });
  const ordenes = useMemo(() => ordenesRes?.data ?? [], [ordenesRes]);

  const enProceso = ordenes.filter((o) =>
    ["ABIERTA", "ASIGNADA", "EN_PROCESO"].includes(o.estado),
  );
  const realizadas = ordenes.filter((o) => o.estado === "CERRADA");

  const otTitulo = (o: ApiRndcOrdenTrabajo) =>
    `${o.numero} · ${o.vehiculo?.placa || o.placa || ""}`;

  return (
    <ConductorLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Wrench className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold">Mantenimiento</h1>
            <p className="text-sm text-muted-foreground">
              Mantenimientos por hacer y realizados de sus vehículos
            </p>
          </div>
        </div>

        {/* Programados / pendientes (alertas) */}
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <h2 className="font-semibold">Por hacer</h2>
          </div>
          {loadingAlertas ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : alertas.length === 0 ? (
            <div className="text-center py-6 bg-card border rounded-lg">
              <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Sin mantenimientos pendientes</p>
            </div>
          ) : (
            <div className="space-y-2">
              {alertas.map((a, i) => (
                <div key={`${a.vehiculo.id}-${a.item}-${i}`} className="bg-card border rounded-lg p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{a.item}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {a.vehiculo.placa} · {a.plan.nombre}
                        {intervaloText(a.intervaloKm, a.intervaloDias)
                          ? ` · ${intervaloText(a.intervaloKm, a.intervaloDias)}`
                          : ""}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Restante: {restanteTexto(a.kmRestantes, a.diasRestantes)}
                        {a.estimado ? " (estimado)" : ""}
                        {a.ultimoServicio
                          ? ` · Último: ${formatFecha(a.ultimoServicio.fecha)}`
                          : ""}
                      </p>
                    </div>
                    <Badge variant="outline" className={ALERTA_ESTADO_BADGE_CLASS[a.estado]}>
                      {ALERTA_ESTADO_LABELS[a.estado]}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Órdenes en proceso */}
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-600" />
            <h2 className="font-semibold">En proceso</h2>
          </div>
          {loadingOrdenes ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : enProceso.length === 0 ? (
            <p className="text-sm text-muted-foreground px-1">Sin órdenes en proceso.</p>
          ) : (
            <div className="space-y-2">
              {enProceso.map((o) => (
                <div key={o._id} className="bg-card border rounded-lg p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{otTitulo(o)}</p>
                      <p className="text-xs text-muted-foreground truncate">{o.descripcion}</p>
                      {o.fechaProgramada && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Programada: {formatFecha(o.fechaProgramada)}
                        </p>
                      )}
                    </div>
                    <Badge variant="outline" className={OT_ESTADO_BADGE[o.estado]}>
                      {OT_ESTADO_LABELS[o.estado] ?? o.estado}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Realizadas */}
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <h2 className="font-semibold">Realizados</h2>
          </div>
          {loadingOrdenes ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : realizadas.length === 0 ? (
            <p className="text-sm text-muted-foreground px-1">Aún no hay mantenimientos realizados.</p>
          ) : (
            <div className="space-y-2">
              {realizadas.map((o) => (
                <div key={o._id} className="bg-card border rounded-lg p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{otTitulo(o)}</p>
                      <p className="text-xs text-muted-foreground truncate">{o.descripcion}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {o.fechaCierre ? `Cerrada: ${formatFecha(o.fechaCierre)}` : ""}
                        {o.kilometraje ? ` · ${formatKm(o.kilometraje)}` : ""}
                      </p>
                    </div>
                    <Badge variant="outline" className={OT_ESTADO_BADGE.CERRADA}>
                      {OT_ESTADO_LABELS.CERRADA}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </ConductorLayout>
  );
}

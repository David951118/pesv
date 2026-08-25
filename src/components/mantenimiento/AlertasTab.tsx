import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Clock, HelpCircle, Loader2, Plus, Satellite } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ContentCard } from "@/components/layout/ContentCard";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAlertasMantenimiento } from "@/services/apirndc";
import type { ApiRndcAlertaMantenimiento } from "@/services/apirndc/apirndc.types";
import {
  ALERTA_ESTADO_BADGE_CLASS,
  ALERTA_ESTADO_LABELS,
  formatFecha,
  formatKm,
} from "./mantenimiento.helpers";
import type { OrdenPrefill } from "./OrdenFormDialog";

interface AlertasTabProps {
  onCrearOt: (prefill: OrdenPrefill) => void;
}

function ResumenCard({
  label,
  value,
  icon: Icon,
  className,
}: {
  label: string;
  value: number;
  icon: typeof AlertTriangle;
  className: string;
}) {
  return (
    <div className="bg-card border rounded-lg p-4 flex items-center gap-3 shadow-corporate">
      <div className={`p-2.5 rounded-lg ${className}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-bold leading-tight">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function getRestanteText(alerta: ApiRndcAlertaMantenimiento): string {
  const partes: string[] = [];
  if (alerta.kmRestantes !== null && alerta.kmRestantes !== undefined) {
    partes.push(`${alerta.kmRestantes.toLocaleString("es-CO")} km`);
  }
  if (alerta.diasRestantes !== null && alerta.diasRestantes !== undefined) {
    partes.push(`${alerta.diasRestantes} días`);
  }
  return partes.length > 0 ? partes.join(" / ") : "-";
}

export function getIntervaloText(alerta: ApiRndcAlertaMantenimiento): string {
  const partes: string[] = [];
  if (alerta.intervaloKm) partes.push(`${alerta.intervaloKm.toLocaleString("es-CO")} km`);
  if (alerta.intervaloDias) partes.push(`${alerta.intervaloDias} días`);
  return partes.length > 0 ? `cada ${partes.join(" / ")}` : "";
}

export function AlertasTab({ onCrearOt }: AlertasTabProps) {
  // Por defecto se usa el modo rápido (sin consultar Cellvi por vehículo)
  const [conGps, setConGps] = useState(false);

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["mant-alertas", conGps],
    queryFn: ({ signal }) =>
      getAlertasMantenimiento(conGps ? undefined : { rapido: true }, signal),
  });

  const alertas = data?.data ?? [];
  const resumen = data?.resumen ?? { vencidos: 0, proximos: 0, sinHistorial: 0 };
  const actualizandoGps = isFetching && conGps;

  const handleActualizarGps = () => {
    if (conGps) {
      refetch();
    } else {
      setConGps(true);
    }
  };

  return (
    <div className="space-y-6">
      {/* Resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <ResumenCard
          label="Vencidos"
          value={resumen.vencidos}
          icon={AlertTriangle}
          className="bg-red-500/15 text-red-600"
        />
        <ResumenCard
          label="Próximos"
          value={resumen.proximos}
          icon={Clock}
          className="bg-amber-500/15 text-amber-600"
        />
        <ResumenCard
          label="Sin historial"
          value={resumen.sinHistorial}
          icon={HelpCircle}
          className="bg-muted text-muted-foreground"
        />
      </div>

      <ContentCard>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h3 className="font-semibold">Alertas de mantenimiento</h3>
            <p className="text-sm text-muted-foreground">
              {conGps
                ? "Kilometrajes actualizados desde GPS"
                : "Modo rápido — use el botón para actualizar desde GPS"}
            </p>
          </div>
          <Button variant="outline" onClick={handleActualizarGps} disabled={actualizandoGps}>
            {actualizandoGps ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Satellite className="h-4 w-4 mr-2" />
            )}
            {actualizandoGps ? "Consultando GPS..." : "Actualizar desde GPS"}
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="text-center py-12 text-destructive">
            Error al cargar alertas: {(error as Error).message}
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vehículo</TableHead>
                  <TableHead>Ítem</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Último servicio</TableHead>
                  <TableHead>Km actual</TableHead>
                  <TableHead>Próximo servicio</TableHead>
                  <TableHead>Restante</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-center">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alertas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      No hay alertas de mantenimiento
                    </TableCell>
                  </TableRow>
                ) : (
                  alertas.map((alerta, idx) => (
                    <TableRow key={`${alerta.vehiculo.id}-${alerta.plan.id}-${alerta.item}-${idx}`}>
                      <TableCell className="font-medium">{alerta.vehiculo.placa}</TableCell>
                      <TableCell>
                        <div>
                          <p>{alerta.item}</p>
                          {getIntervaloText(alerta) && (
                            <p className="text-xs text-muted-foreground">{getIntervaloText(alerta)}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">{alerta.plan.nombre}</span>
                      </TableCell>
                      <TableCell>
                        {alerta.ultimoServicio ? (
                          <div className="text-sm">
                            <p>{formatFecha(alerta.ultimoServicio.fecha)}</p>
                            <p className="text-xs text-muted-foreground">
                              {alerta.ultimoServicio.kilometraje !== undefined && alerta.ultimoServicio.kilometraje !== null
                                ? formatKm(alerta.ultimoServicio.kilometraje)
                                : ""}
                              {alerta.ultimoServicio.ot ? ` · ${alerta.ultimoServicio.ot}` : ""}
                            </p>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">Sin registro</span>
                        )}
                      </TableCell>
                      <TableCell>{formatKm(alerta.kmActual)}</TableCell>
                      <TableCell>
                        {alerta.proximoKm !== null && alerta.proximoKm !== undefined ? (
                          <div>
                            <span className="font-medium">{formatKm(alerta.proximoKm)}</span>
                            {(alerta.ciclosVencidos ?? 0) > 0 && (
                              <span className="block text-xs text-destructive">
                                {alerta.ciclosVencidos} servicio
                                {alerta.ciclosVencidos === 1 ? "" : "s"} sin hacer
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            {alerta.kmActual == null
                              ? "Falta el kilometraje del vehículo"
                              : "-"}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {getRestanteText(alerta)}
                        {alerta.estimado && (
                          <span className="block text-xs text-muted-foreground">estimado</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={ALERTA_ESTADO_BADGE_CLASS[alerta.estado]}>
                          {ALERTA_ESTADO_LABELS[alerta.estado]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            onCrearOt({
                              vehiculoId: alerta.vehiculo.id,
                              tipo: "PREVENTIVO",
                              descripcion: alerta.item,
                              plan: alerta.plan.id,
                              planItemNombre: alerta.item,
                            })
                          }
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Crear OT
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </ContentCard>
    </div>
  );
}

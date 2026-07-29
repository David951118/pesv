import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ApiRndcOrdenTrabajo } from "@/services/apirndc/apirndc.types";
import {
  formatCOP,
  formatFecha,
  formatFechaHora,
  formatKm,
  getMecanicoNombre,
  OT_ESTADO_BADGE_CLASS,
  OT_ESTADO_LABELS,
  OT_PRIORIDAD_BADGE_CLASS,
  OT_PRIORIDAD_LABELS,
  OT_TIPO_LABELS,
} from "./mantenimiento.helpers";

interface OrdenDetalleDialogProps {
  orden: ApiRndcOrdenTrabajo | null;
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

export function OrdenDetalleDialog({ orden, onClose }: OrdenDetalleDialogProps) {
  if (!orden) return null;

  const costoManoDeObra = orden.manoDeObra?.costo ?? 0;

  return (
    <Dialog open={!!orden} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 flex-wrap">
            <span>{orden.numero}</span>
            <Badge variant="outline" className={OT_ESTADO_BADGE_CLASS[orden.estado]}>
              {OT_ESTADO_LABELS[orden.estado]}
            </Badge>
            <Badge variant="outline" className={OT_PRIORIDAD_BADGE_CLASS[orden.prioridad]}>
              {OT_PRIORIDAD_LABELS[orden.prioridad]}
            </Badge>
          </DialogTitle>
          <DialogDescription>{orden.descripcion}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Información general */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <InfoItem label="Vehículo" value={orden.vehiculo?.placa || orden.placa || "-"} />
            <InfoItem label="Tipo" value={OT_TIPO_LABELS[orden.tipo] ?? orden.tipo} />
            <InfoItem label="Kilometraje" value={formatKm(orden.kilometraje)} />
            <InfoItem label="Mecánico" value={getMecanicoNombre(orden.mecanico)} />
            <InfoItem label="Taller" value={orden.taller || "-"} />
            <InfoItem label="Origen" value={orden.origen || "-"} />
            <InfoItem label="Fecha programada" value={formatFecha(orden.fechaProgramada)} />
            <InfoItem label="Fecha de cierre" value={formatFecha(orden.fechaCierre)} />
            <InfoItem label="Creada" value={formatFecha(orden.createdAt)} />
          </div>

          {/* Actividades */}
          {orden.actividades && orden.actividades.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Actividades</h4>
              <div className="space-y-1.5">
                {orden.actividades.map((act, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={act.completada} disabled />
                    <span className={act.completada ? "line-through text-muted-foreground" : ""}>
                      {act.descripcion}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Repuestos */}
          {orden.repuestos && orden.repuestos.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Repuestos</h4>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Repuesto</TableHead>
                      <TableHead className="text-right">Cantidad</TableHead>
                      <TableHead className="text-right">Costo unitario</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orden.repuestos.map((rep, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{rep.nombre}</TableCell>
                        <TableCell className="text-right">{rep.cantidad}</TableCell>
                        <TableCell className="text-right">{formatCOP(rep.costoUnitario)}</TableCell>
                        <TableCell className="text-right">{formatCOP(rep.cantidad * rep.costoUnitario)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Costos */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Costos</h4>
            <div className="bg-muted/30 border rounded-lg p-4 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Mano de obra{orden.manoDeObra?.horas ? ` (${orden.manoDeObra.horas} h)` : ""}
                </span>
                <span>{formatCOP(costoManoDeObra)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Repuestos</span>
                <span>{formatCOP(orden.costoRepuestos ?? 0)}</span>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span>{formatCOP(orden.costoTotal ?? costoManoDeObra + (orden.costoRepuestos ?? 0))}</span>
              </div>
            </div>
          </div>

          {/* Observaciones de cierre */}
          {orden.observacionesCierre && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Observaciones de cierre</h4>
              <p className="text-sm text-muted-foreground bg-muted/30 border rounded-lg p-3">
                {orden.observacionesCierre}
              </p>
            </div>
          )}

          {/* Historial */}
          {orden.historial && orden.historial.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Historial</h4>
              <div className="space-y-3">
                {orden.historial.map((entry, idx) => (
                  <div key={idx} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="h-2.5 w-2.5 rounded-full bg-primary mt-1.5" />
                      {idx < orden.historial!.length - 1 && <div className="w-px flex-1 bg-border" />}
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

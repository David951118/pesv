import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, RefreshCw, Trash2, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  adjuntarFacturaOrdenTrabajo,
  eliminarFacturaOrdenTrabajo,
} from "@/services/apirndc";
import type {
  ApiRndcOrdenTrabajo,
  ApiRndcOtFactura,
} from "@/services/apirndc/apirndc.types";
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
import { FacturaOtField, FacturaOtResumen, subirFacturaOt } from "./FacturaOtField";

interface OrdenDetalleDialogProps {
  orden: ApiRndcOrdenTrabajo | null;
  onClose: () => void;
  /** Permite adjuntar, reemplazar o quitar la factura (gestión y mecánico) */
  puedeEditarFactura?: boolean;
}

const HISTORIAL_ACCION_LABELS: Record<string, string> = {
  FACTURA_ADJUNTADA: "Factura adjuntada",
  FACTURA_REEMPLAZADA: "Factura reemplazada",
  FACTURA_ELIMINADA: "Factura eliminada",
};

function InfoItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-muted/30 border rounded-lg p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

/**
 * Sección de factura: muestra la actual (si hay) y, si el usuario puede editar,
 * permite subir una nueva, reemplazarla o quitarla sin salir del detalle.
 * Tiene hooks propios, por eso vive en un componente aparte y se remonta
 * (key) cada vez que cambia la orden abierta.
 */
function FacturaSection({
  orden,
  puedeEditar,
}: {
  orden: ApiRndcOrdenTrabajo;
  puedeEditar: boolean;
}) {
  const queryClient = useQueryClient();
  const [factura, setFactura] = useState<ApiRndcOtFactura | null>(orden.factura ?? null);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [reemplazando, setReemplazando] = useState(false);
  const [confirmarQuitar, setConfirmarQuitar] = useState(false);

  const editable = puedeEditar && orden.estado !== "ANULADA";

  const subirMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Seleccione el archivo de la factura");
      setProgress(0);
      try {
        const meta = await subirFacturaOt(file, (p) => setProgress(p.percent));
        return adjuntarFacturaOrdenTrabajo(orden._id, meta);
      } finally {
        setProgress(null);
      }
    },
    onSuccess: (res) => {
      toast.success(factura ? "Factura reemplazada" : "Factura adjuntada");
      setFactura(res.data?.factura ?? null);
      setFile(null);
      setReemplazando(false);
      queryClient.invalidateQueries({ queryKey: ["mant-ordenes"] });
    },
    onError: (error: Error) => toast.error(error.message || "Error al subir la factura"),
  });

  const quitarMutation = useMutation({
    mutationFn: () => eliminarFacturaOrdenTrabajo(orden._id),
    onSuccess: () => {
      toast.success("Factura eliminada");
      setFactura(null);
      setConfirmarQuitar(false);
      queryClient.invalidateQueries({ queryKey: ["mant-ordenes"] });
    },
    onError: (error: Error) => toast.error(error.message || "Error al eliminar la factura"),
  });

  const ocupado = subirMutation.isPending || quitarMutation.isPending;
  const mostrarSelector = editable && (!factura || reemplazando);

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold">Factura</h4>

      {factura && (
        <FacturaOtResumen factura={factura}>
          {editable && !confirmarQuitar && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={ocupado}
                onClick={() => {
                  setReemplazando((v) => !v);
                  setFile(null);
                }}
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                {reemplazando ? "Cancelar" : "Reemplazar"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                disabled={ocupado}
                onClick={() => setConfirmarQuitar(true)}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Quitar
              </Button>
            </>
          )}
          {editable && confirmarQuitar && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">¿Quitar la factura? El archivo se borra.</span>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={ocupado}
                onClick={() => quitarMutation.mutate()}
              >
                {quitarMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Sí, quitar
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={ocupado}
                onClick={() => setConfirmarQuitar(false)}
              >
                No
              </Button>
            </div>
          )}
        </FacturaOtResumen>
      )}

      {!factura && !editable && (
        <p className="text-sm text-muted-foreground">Sin factura adjunta.</p>
      )}

      {mostrarSelector && (
        <div className="space-y-2">
          <FacturaOtField
            label={null}
            file={file}
            onChange={setFile}
            disabled={ocupado}
            progress={progress}
            hint={
              factura
                ? "El nuevo archivo reemplaza la factura actual. PDF o imagen, máximo 10 MB."
                : undefined
            }
          />
          {file && (
            <Button
              type="button"
              size="sm"
              disabled={ocupado}
              onClick={() => subirMutation.mutate()}
            >
              {subirMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-1" />
              )}
              {factura ? "Subir y reemplazar" : "Subir factura"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export function OrdenDetalleDialog({
  orden,
  onClose,
  puedeEditarFactura = false,
}: OrdenDetalleDialogProps) {
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

          {/* Factura (opcional) */}
          <FacturaSection key={orden._id} orden={orden} puedeEditar={puedeEditarFactura} />

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
                      <p className="text-sm font-medium">
                        {HISTORIAL_ACCION_LABELS[entry.accion] ?? entry.accion}
                      </p>
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

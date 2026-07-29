import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getRepuestos,
  getVehiculosList,
  createMovimientoInventario,
} from "@/services/apirndc";
import type {
  ApiRndcMovimientoInventarioCreatePayload,
  ApiRndcMovimientoTipo,
} from "@/services/apirndc/apirndc.types";
import {
  MOVIMIENTO_TIPOS,
  MOVIMIENTO_TIPO_LABELS,
} from "./inventario.helpers";

export interface MovimientoPrefill {
  repuestoId?: string;
  repuestoNombre?: string;
  tipo?: ApiRndcMovimientoTipo;
}

interface MovimientoFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefill?: MovimientoPrefill | null;
}

interface MovimientoForm {
  repuesto: string;
  tipo: ApiRndcMovimientoTipo;
  cantidad: string;
  costoUnitario: string;
  vehiculo: string;
  ordenTrabajo: string;
  motivo: string;
}

const initialForm: MovimientoForm = {
  repuesto: "",
  tipo: "ENTRADA",
  cantidad: "",
  costoUnitario: "",
  vehiculo: "",
  ordenTrabajo: "",
  motivo: "",
};

export function MovimientoFormDialog({ open, onOpenChange, prefill }: MovimientoFormDialogProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<MovimientoForm>(initialForm);

  useEffect(() => {
    if (open) {
      setForm({
        ...initialForm,
        repuesto: prefill?.repuestoId ?? "",
        tipo: prefill?.tipo ?? "ENTRADA",
      });
    }
  }, [open, prefill]);

  const { data: repuestosRes, isLoading: loadingRepuestos } = useQuery({
    queryKey: ["inv-repuestos-list"],
    queryFn: ({ signal }) => getRepuestos({ activo: true, limit: 500 }, signal),
    enabled: open,
    staleTime: 60_000,
  });
  const repuestos = repuestosRes?.data ?? [];

  const { data: vehiculosRes, isLoading: loadingVehiculos } = useQuery({
    queryKey: ["apirndc-vehiculos-list"],
    queryFn: ({ signal }) => getVehiculosList(signal),
    enabled: open,
    staleTime: 5 * 60_000,
  });
  const vehiculos = vehiculosRes?.data ?? [];

  const mutation = useMutation({
    mutationFn: async () => {
      const payload: ApiRndcMovimientoInventarioCreatePayload = {
        repuesto: form.repuesto,
        tipo: form.tipo,
        cantidad: Number(form.cantidad) || 0,
      };
      if (form.costoUnitario) payload.costoUnitario = Number(form.costoUnitario);
      if (form.vehiculo) payload.vehiculo = form.vehiculo;
      if (form.ordenTrabajo.trim()) payload.ordenTrabajo = form.ordenTrabajo.trim();
      if (form.motivo.trim()) payload.motivo = form.motivo.trim();
      return createMovimientoInventario(payload);
    },
    onSuccess: () => {
      toast.success("Movimiento registrado exitosamente");
      queryClient.invalidateQueries({ queryKey: ["inv-repuestos"] });
      queryClient.invalidateQueries({ queryKey: ["inv-movimientos"] });
      queryClient.invalidateQueries({ queryKey: ["inv-alertas-stock"] });
      queryClient.invalidateQueries({ queryKey: ["inv-consumos"] });
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message || "Error al registrar el movimiento"),
  });

  const cantidadNum = Number(form.cantidad);
  const canSubmit = !!form.repuesto && !!form.tipo && form.cantidad !== "" && cantidadNum >= 0;

  const ayudaTipo: Record<ApiRndcMovimientoTipo, string> = {
    ENTRADA: "Suma la cantidad al stock disponible.",
    SALIDA: "Descuenta la cantidad del stock disponible.",
    AJUSTE: "Fija el stock al valor exacto indicado.",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Registrar Movimiento</DialogTitle>
          <DialogDescription>
            Registre una entrada, salida o ajuste de inventario para un repuesto.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Repuesto *</Label>
            <Select
              value={form.repuesto}
              onValueChange={(value) => setForm({ ...form, repuesto: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder={loadingRepuestos ? "Cargando..." : "Seleccione un repuesto"} />
              </SelectTrigger>
              <SelectContent>
                {repuestos.map((r) => (
                  <SelectItem key={r._id} value={r._id}>
                    {r.codigo ? `${r.codigo} — ` : ""}{r.nombre} (stock: {r.stock})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tipo *</Label>
              <Select
                value={form.tipo}
                onValueChange={(value) => setForm({ ...form, tipo: value as ApiRndcMovimientoTipo })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MOVIMIENTO_TIPOS.map((t) => (
                    <SelectItem key={t} value={t}>{MOVIMIENTO_TIPO_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{ayudaTipo[form.tipo]}</p>
            </div>
            <div className="space-y-2">
              <Label>Cantidad *</Label>
              <Input
                type="number"
                min={0}
                value={form.cantidad}
                onChange={(e) => setForm({ ...form, cantidad: e.target.value })}
                placeholder="0"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Costo unitario</Label>
              <Input
                type="number"
                min={0}
                value={form.costoUnitario}
                onChange={(e) => setForm({ ...form, costoUnitario: e.target.value })}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label>Vehículo (opcional)</Label>
              <Select
                value={form.vehiculo || "none"}
                onValueChange={(value) => setForm({ ...form, vehiculo: value === "none" ? "" : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingVehiculos ? "Cargando..." : "Sin vehículo"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin vehículo</SelectItem>
                  {vehiculos.map((v) => (
                    <SelectItem key={v._id} value={v._id}>
                      {v.placa}{v.marca ? ` - ${v.marca}${v.linea ? ` ${v.linea}` : ""}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Orden de trabajo (ID, opcional)</Label>
            <Input
              value={form.ordenTrabajo}
              onChange={(e) => setForm({ ...form, ordenTrabajo: e.target.value })}
              placeholder="ID de la orden de trabajo asociada"
            />
          </div>

          <div className="space-y-2">
            <Label>Motivo</Label>
            <Textarea
              value={form.motivo}
              onChange={(e) => setForm({ ...form, motivo: e.target.value })}
              placeholder="Motivo del movimiento"
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => mutation.mutate()} disabled={!canSubmit || mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

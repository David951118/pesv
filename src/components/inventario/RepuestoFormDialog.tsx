import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { createRepuesto, updateRepuesto } from "@/services/apirndc";
import type {
  ApiRndcRepuesto,
  ApiRndcRepuestoCreatePayload,
  ApiRndcRepuestoUpdatePayload,
} from "@/services/apirndc/apirndc.types";
import { getTerceroNombre, useProveedores } from "./inventario.helpers";

interface RepuestoFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repuesto: ApiRndcRepuesto | null;
}

interface RepuestoForm {
  nombre: string;
  codigo: string;
  categoria: string;
  unidad: string;
  stockInicial: string;
  stockMinimo: string;
  costoUnitario: string;
  proveedor: string;
  descripcion: string;
  activo: boolean;
}

const initialForm: RepuestoForm = {
  nombre: "",
  codigo: "",
  categoria: "",
  unidad: "",
  stockInicial: "",
  stockMinimo: "",
  costoUnitario: "",
  proveedor: "",
  descripcion: "",
  activo: true,
};

export function RepuestoFormDialog({ open, onOpenChange, repuesto }: RepuestoFormDialogProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<RepuestoForm>(initialForm);
  const { data: proveedores = [], isLoading: loadingProveedores } = useProveedores();

  useEffect(() => {
    if (open) {
      if (repuesto) {
        setForm({
          nombre: repuesto.nombre,
          codigo: repuesto.codigo ?? "",
          categoria: repuesto.categoria ?? "",
          unidad: repuesto.unidad ?? "",
          stockInicial: "",
          stockMinimo: repuesto.stockMinimo !== undefined && repuesto.stockMinimo !== null ? String(repuesto.stockMinimo) : "",
          costoUnitario: repuesto.costoUnitario !== undefined && repuesto.costoUnitario !== null ? String(repuesto.costoUnitario) : "",
          proveedor: repuesto.proveedor?._id ?? "",
          descripcion: repuesto.descripcion ?? "",
          activo: repuesto.activo,
        });
      } else {
        setForm(initialForm);
      }
    }
  }, [open, repuesto]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (repuesto) {
        const payload: ApiRndcRepuestoUpdatePayload = {
          nombre: form.nombre.trim(),
          activo: form.activo,
        };
        payload.codigo = form.codigo.trim();
        payload.categoria = form.categoria.trim();
        payload.unidad = form.unidad.trim();
        payload.descripcion = form.descripcion.trim();
        if (form.stockMinimo) payload.stockMinimo = Number(form.stockMinimo);
        if (form.costoUnitario) payload.costoUnitario = Number(form.costoUnitario);
        payload.proveedor = form.proveedor || undefined;
        return updateRepuesto(repuesto._id, payload);
      }
      const payload: ApiRndcRepuestoCreatePayload = {
        nombre: form.nombre.trim(),
        activo: form.activo,
      };
      if (form.codigo.trim()) payload.codigo = form.codigo.trim();
      if (form.categoria.trim()) payload.categoria = form.categoria.trim();
      if (form.unidad.trim()) payload.unidad = form.unidad.trim();
      if (form.descripcion.trim()) payload.descripcion = form.descripcion.trim();
      if (form.stockInicial) payload.stockInicial = Number(form.stockInicial);
      if (form.stockMinimo) payload.stockMinimo = Number(form.stockMinimo);
      if (form.costoUnitario) payload.costoUnitario = Number(form.costoUnitario);
      if (form.proveedor) payload.proveedor = form.proveedor;
      return createRepuesto(payload);
    },
    onSuccess: () => {
      toast.success(repuesto ? "Repuesto actualizado exitosamente" : "Repuesto creado exitosamente");
      queryClient.invalidateQueries({ queryKey: ["inv-repuestos"] });
      queryClient.invalidateQueries({ queryKey: ["inv-alertas-stock"] });
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message || "Error al guardar el repuesto"),
  });

  const canSubmit = !!form.nombre.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{repuesto ? "Editar Repuesto" : "Nuevo Repuesto"}</DialogTitle>
          <DialogDescription>
            {repuesto
              ? "Actualice los datos del repuesto. El stock solo se modifica mediante movimientos."
              : "Registre un nuevo repuesto en el catálogo de inventario."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Nombre del repuesto"
              />
            </div>
            <div className="space-y-2">
              <Label>Código</Label>
              <Input
                value={form.codigo}
                onChange={(e) => setForm({ ...form, codigo: e.target.value })}
                placeholder="Código / SKU"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Categoría</Label>
              <Input
                value={form.categoria}
                onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                placeholder="Ej: Filtros, Frenos, Aceites"
              />
            </div>
            <div className="space-y-2">
              <Label>Unidad</Label>
              <Input
                value={form.unidad}
                onChange={(e) => setForm({ ...form, unidad: e.target.value })}
                placeholder="Ej: unidad, litro, kit"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {!repuesto && (
              <div className="space-y-2">
                <Label>Stock inicial</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.stockInicial}
                  onChange={(e) => setForm({ ...form, stockInicial: e.target.value })}
                  placeholder="0"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>Stock mínimo</Label>
              <Input
                type="number"
                min={0}
                value={form.stockMinimo}
                onChange={(e) => setForm({ ...form, stockMinimo: e.target.value })}
                placeholder="0"
              />
            </div>
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
          </div>

          <div className="space-y-2">
            <Label>Proveedor</Label>
            <Select
              value={form.proveedor || "none"}
              onValueChange={(value) => setForm({ ...form, proveedor: value === "none" ? "" : value })}
            >
              <SelectTrigger>
                <SelectValue placeholder={loadingProveedores ? "Cargando..." : "Seleccione (opcional)"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin proveedor</SelectItem>
                {proveedores.map((p) => (
                  <SelectItem key={p._id} value={p._id}>{getTerceroNombre(p)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Descripción</Label>
            <Textarea
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              placeholder="Descripción del repuesto"
              rows={2}
            />
          </div>

          <div className="flex items-center justify-between border rounded-lg p-3">
            <div>
              <Label>Activo</Label>
              <p className="text-xs text-muted-foreground">Los repuestos inactivos no aparecen en las alertas de stock.</p>
            </div>
            <Switch
              checked={form.activo}
              onCheckedChange={(checked) => setForm({ ...form, activo: checked })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => mutation.mutate()} disabled={!canSubmit || mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {repuesto ? "Guardar Cambios" : "Crear Repuesto"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

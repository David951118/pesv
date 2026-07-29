import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ContentCard } from "@/components/layout/ContentCard";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getConsumosInventario } from "@/services/apirndc";
import { formatCOP } from "./inventario.helpers";

export function ConsumosTab() {
  const [anio, setAnio] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["inv-consumos", anio],
    queryFn: ({ signal }) =>
      getConsumosInventario({ anio: anio ? Number(anio) : undefined }, signal),
  });

  const consumos = [...(data?.data ?? [])].sort((a, b) => b.costoTotal - a.costoTotal);

  return (
    <ContentCard>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
        <div>
          <h3 className="font-semibold">Consumo de repuestos por vehículo</h3>
          <p className="text-sm text-muted-foreground">
            Costos de repuestos (salidas) agrupados por vehículo y año.
          </p>
        </div>
        <div className="space-y-1">
          <Label htmlFor="anio" className="text-xs text-muted-foreground">Año</Label>
          <Input
            id="anio"
            type="number"
            value={anio}
            onChange={(e) => setAnio(e.target.value)}
            placeholder="Todos los años"
            className="w-[180px]"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="text-center py-12 text-destructive">
          Error al cargar consumos: {(error as Error).message}
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Placa</TableHead>
                <TableHead className="text-center">Año</TableHead>
                <TableHead className="text-right">Movimientos</TableHead>
                <TableHead className="text-right">Cantidad total</TableHead>
                <TableHead className="text-right">Costo total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {consumos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No hay consumos registrados
                  </TableCell>
                </TableRow>
              ) : (
                consumos.map((c, idx) => (
                  <TableRow key={`${c.vehiculo ?? c.placa}-${c.anio}-${idx}`}>
                    <TableCell className="font-medium">{c.placa || "-"}</TableCell>
                    <TableCell className="text-center">{c.anio}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{c.movimientos}</TableCell>
                    <TableCell className="text-right">{c.cantidadTotal}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCOP(c.costoTotal)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </ContentCard>
  );
}

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ContentCard } from "@/components/layout/ContentCard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getRendimientoCombustible, getVehiculosList } from "@/services/apirndc";
import { formatCOP, formatGalones, formatKm, formatRendimiento } from "./operacion.helpers";

export function RendimientoTab() {
  const [vehiculoFilter, setVehiculoFilter] = useState("all");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  const { data: vehiculosRes } = useQuery({
    queryKey: ["apirndc-vehiculos-list"],
    queryFn: ({ signal }) => getVehiculosList(signal),
    staleTime: 5 * 60_000,
  });
  const vehiculos = vehiculosRes?.data ?? [];

  const { data, isLoading, error } = useQuery({
    queryKey: ["op-rendimiento", vehiculoFilter, desde, hasta],
    queryFn: ({ signal }) =>
      getRendimientoCombustible(
        {
          vehiculo: vehiculoFilter !== "all" ? vehiculoFilter : undefined,
          desde: desde || undefined,
          hasta: hasta || undefined,
        },
        signal,
      ),
  });

  const rendimientos = [...(data?.data ?? [])].sort(
    (a, b) => (b.rendimientoPromedio ?? -1) - (a.rendimientoPromedio ?? -1),
  );

  return (
    <ContentCard>
      <div className="flex flex-col sm:flex-row sm:items-end gap-3 mb-6">
        <div>
          <h3 className="font-semibold">Consumo de combustible: rendimiento por vehículo</h3>
          <p className="text-sm text-muted-foreground">
            Galones, costos y rendimiento promedio (km/galón) agrupados por vehículo.
          </p>
        </div>
        <div className="flex-1" />
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Vehículo</label>
          <Select value={vehiculoFilter} onValueChange={setVehiculoFilter}>
            <SelectTrigger className="w-[170px]">
              <SelectValue placeholder="Vehículo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los vehículos</SelectItem>
              {vehiculos.map((v) => (
                <SelectItem key={v._id} value={v._id}>{v.placa}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Desde</label>
          <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="w-[160px]" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Hasta</label>
          <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="w-[160px]" />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="text-center py-12 text-destructive">
          Error al cargar el rendimiento: {(error as Error).message}
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vehículo</TableHead>
                <TableHead className="text-right">Tanqueos</TableHead>
                <TableHead className="text-right">Galones total</TableHead>
                <TableHead className="text-right">Costo total</TableHead>
                <TableHead className="text-right">Km recorridos</TableHead>
                <TableHead className="text-right">Rendimiento promedio</TableHead>
                <TableHead className="text-right">Costo/km</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rendimientos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No hay datos de rendimiento
                  </TableCell>
                </TableRow>
              ) : (
                rendimientos.map((r, idx) => (
                  <TableRow key={`${r.vehiculo ?? r.placa}-${idx}`}>
                    <TableCell className="font-medium">{r.placa || "-"}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{r.tanqueos}</TableCell>
                    <TableCell className="text-right">{formatGalones(r.galonesTotal)}</TableCell>
                    <TableCell className="text-right">{formatCOP(r.costoTotal)}</TableCell>
                    <TableCell className="text-right">{formatKm(r.kmRecorridos)}</TableCell>
                    <TableCell className="text-right">
                      {r.rendimientoPromedio !== null ? (
                        <Badge
                          variant="outline"
                          className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                        >
                          {formatRendimiento(r.rendimientoPromedio)}
                        </Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-semibold">{formatCOP(r.costoPorKm)}</TableCell>
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

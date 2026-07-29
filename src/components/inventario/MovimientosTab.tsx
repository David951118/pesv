import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { getMovimientosInventario } from "@/services/apirndc";
import {
  formatCOP,
  formatFechaHora,
  MOVIMIENTO_TIPOS,
  MOVIMIENTO_TIPO_BADGE_CLASS,
  MOVIMIENTO_TIPO_LABELS,
} from "./inventario.helpers";

const ITEMS_PER_PAGE = 10;

export interface MovimientosFilter {
  repuestoId: string;
  repuestoNombre: string;
}

interface MovimientosTabProps {
  onRegistrar: () => void;
  repuestoFilter: MovimientosFilter | null;
  onClearRepuestoFilter: () => void;
}

export function MovimientosTab({ onRegistrar, repuestoFilter, onClearRepuestoFilter }: MovimientosTabProps) {
  const [tipoFilter, setTipoFilter] = useState("all");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ["inv-movimientos", tipoFilter, desde, hasta, repuestoFilter?.repuestoId ?? "", page],
    queryFn: ({ signal }) =>
      getMovimientosInventario(
        {
          repuesto: repuestoFilter?.repuestoId || undefined,
          tipo: tipoFilter !== "all" ? tipoFilter : undefined,
          desde: desde || undefined,
          hasta: hasta || undefined,
          page,
          limit: ITEMS_PER_PAGE,
        },
        signal,
      ),
  });

  const movimientos = data?.data ?? [];
  const totalPages = data?.pages ?? 1;

  return (
    <ContentCard>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-end gap-3 mb-6">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Tipo</label>
          <Select
            value={tipoFilter}
            onValueChange={(value) => {
              setTipoFilter(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              {MOVIMIENTO_TIPOS.map((t) => (
                <SelectItem key={t} value={t}>{MOVIMIENTO_TIPO_LABELS[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Desde</label>
          <Input
            type="date"
            value={desde}
            onChange={(e) => {
              setDesde(e.target.value);
              setPage(1);
            }}
            className="w-[160px]"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Hasta</label>
          <Input
            type="date"
            value={hasta}
            onChange={(e) => {
              setHasta(e.target.value);
              setPage(1);
            }}
            className="w-[160px]"
          />
        </div>
        <div className="flex-1" />
        <Button onClick={onRegistrar}>
          <Plus className="h-4 w-4 mr-2" />
          Registrar movimiento
        </Button>
      </div>

      {repuestoFilter && (
        <div className="mb-4 flex items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            Kardex: {repuestoFilter.repuestoNombre}
            <button onClick={onClearRepuestoFilter} className="ml-1" aria-label="Quitar filtro">
              <X className="h-3 w-3" />
            </button>
          </Badge>
        </div>
      )}

      {/* Tabla */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="text-center py-12 text-destructive">
          Error al cargar movimientos: {(error as Error).message}
        </div>
      ) : (
        <>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Repuesto</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead className="text-right">Costo unit.</TableHead>
                  <TableHead className="text-center">Stock</TableHead>
                  <TableHead>OT</TableHead>
                  <TableHead>Vehículo</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Usuario</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movimientos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      No se encontraron movimientos
                    </TableCell>
                  </TableRow>
                ) : (
                  movimientos.map((mov) => (
                    <TableRow key={mov._id}>
                      <TableCell className="text-sm whitespace-nowrap">{formatFechaHora(mov.createdAt)}</TableCell>
                      <TableCell>
                        <p className="font-medium">{mov.repuesto?.nombre ?? "-"}</p>
                        {mov.repuesto?.codigo && (
                          <p className="text-xs text-muted-foreground">{mov.repuesto.codigo}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={MOVIMIENTO_TIPO_BADGE_CLASS[mov.tipo]}>
                          {MOVIMIENTO_TIPO_LABELS[mov.tipo] ?? mov.tipo}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">{mov.cantidad}</TableCell>
                      <TableCell className="text-right">{formatCOP(mov.costoUnitario)}</TableCell>
                      <TableCell className="text-center text-sm whitespace-nowrap">
                        <span className="text-muted-foreground">{mov.stockAnterior}</span>
                        {" → "}
                        <span className="font-medium">{mov.stockNuevo}</span>
                      </TableCell>
                      <TableCell>
                        {mov.ordenTrabajo ? (
                          <Badge variant="secondary">{mov.ordenTrabajo.numero}</Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{mov.vehiculo?.placa || mov.placa || "-"}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">{mov.motivo || "-"}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">{mov.usuario || "-"}</span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Página {page} de {totalPages} — {data?.total ?? 0} movimientos
              </span>
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className={page === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationNext
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      className={page === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </>
      )}
    </ContentCard>
  );
}

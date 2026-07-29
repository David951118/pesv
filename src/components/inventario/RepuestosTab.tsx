import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  History,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Scale,
  Search,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ContentCard } from "@/components/layout/ContentCard";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { getRepuestos, deleteRepuesto } from "@/services/apirndc";
import type { ApiRndcRepuesto, ApiRndcMovimientoTipo } from "@/services/apirndc/apirndc.types";
import { formatCOP, getProveedorNombre, isBajoStock } from "./inventario.helpers";
import { RepuestoFormDialog } from "./RepuestoFormDialog";
import { MovimientoFormDialog, type MovimientoPrefill } from "./MovimientoFormDialog";

const ITEMS_PER_PAGE = 10;

interface RepuestosTabProps {
  onVerKardex: (repuesto: ApiRndcRepuesto) => void;
}

export function RepuestosTab({ onVerKardex }: RepuestosTabProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [categoria, setCategoria] = useState("");
  const [bajoStock, setBajoStock] = useState(false);
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editingRepuesto, setEditingRepuesto] = useState<ApiRndcRepuesto | null>(null);

  const [movDialogOpen, setMovDialogOpen] = useState(false);
  const [movPrefill, setMovPrefill] = useState<MovimientoPrefill | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<ApiRndcRepuesto | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["inv-repuestos", search, categoria, bajoStock, page],
    queryFn: ({ signal }) =>
      getRepuestos(
        {
          q: search.trim() || undefined,
          categoria: categoria.trim() || undefined,
          bajoStock: bajoStock ? true : undefined,
          page,
          limit: ITEMS_PER_PAGE,
        },
        signal,
      ),
  });

  const repuestos = data?.data ?? [];
  const totalPages = data?.pages ?? 1;

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteRepuesto(id),
    onSuccess: () => {
      toast.success("Repuesto eliminado exitosamente");
      queryClient.invalidateQueries({ queryKey: ["inv-repuestos"] });
      queryClient.invalidateQueries({ queryKey: ["inv-alertas-stock"] });
      setDeleteTarget(null);
    },
    onError: (err: Error) => {
      toast.error(err.message || "Error al eliminar el repuesto");
      setDeleteTarget(null);
    },
  });

  const handleNuevo = () => {
    setEditingRepuesto(null);
    setFormOpen(true);
  };

  const handleEditar = (repuesto: ApiRndcRepuesto) => {
    setEditingRepuesto(repuesto);
    setFormOpen(true);
  };

  const handleMovimiento = (repuesto: ApiRndcRepuesto, tipo: ApiRndcMovimientoTipo) => {
    setMovPrefill({ repuestoId: repuesto._id, repuestoNombre: repuesto.nombre, tipo });
    setMovDialogOpen(true);
  };

  return (
    <ContentCard>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o código..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-10"
          />
        </div>
        <Input
          placeholder="Categoría"
          value={categoria}
          onChange={(e) => {
            setCategoria(e.target.value);
            setPage(1);
          }}
          className="w-full sm:w-[180px]"
        />
        <div className="flex items-center gap-2 px-1">
          <Switch
            id="bajo-stock"
            checked={bajoStock}
            onCheckedChange={(checked) => {
              setBajoStock(checked);
              setPage(1);
            }}
          />
          <Label htmlFor="bajo-stock" className="text-sm whitespace-nowrap cursor-pointer">
            Solo bajo stock
          </Label>
        </div>
        <Button onClick={handleNuevo}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo repuesto
        </Button>
      </div>

      {/* Tabla */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="text-center py-12 text-destructive">
          Error al cargar repuestos: {(error as Error).message}
        </div>
      ) : (
        <>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">Mínimo</TableHead>
                  <TableHead>Unidad</TableHead>
                  <TableHead className="text-right">Costo unit.</TableHead>
                  <TableHead className="text-right">Valor total</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead className="text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {repuestos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      No se encontraron repuestos
                    </TableCell>
                  </TableRow>
                ) : (
                  repuestos.map((rep) => {
                    const bajo = isBajoStock(rep);
                    return (
                      <TableRow key={rep._id}>
                        <TableCell className="font-medium">{rep.codigo || "-"}</TableCell>
                        <TableCell>
                          <p className="font-medium">{rep.nombre}</p>
                          {!rep.activo && (
                            <Badge variant="outline" className="bg-muted text-muted-foreground border-border mt-1">
                              Inactivo
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">{rep.categoria || "-"}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={bajo ? "font-semibold text-red-600 dark:text-red-400" : "font-medium"}>
                            {rep.stock}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">{rep.stockMinimo}</TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">{rep.unidad || "-"}</span>
                        </TableCell>
                        <TableCell className="text-right">{formatCOP(rep.costoUnitario)}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCOP((rep.stock || 0) * (rep.costoUnitario || 0))}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">{getProveedorNombre(rep.proveedor)}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Acciones</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleMovimiento(rep, "ENTRADA")}>
                                <ArrowUpCircle className="h-4 w-4 mr-2 text-emerald-600" />
                                Entrada
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleMovimiento(rep, "SALIDA")}>
                                <ArrowDownCircle className="h-4 w-4 mr-2 text-red-600" />
                                Salida
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleMovimiento(rep, "AJUSTE")}>
                                <Scale className="h-4 w-4 mr-2 text-blue-600" />
                                Ajuste
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => onVerKardex(rep)}>
                                <History className="h-4 w-4 mr-2" />
                                Ver kardex
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEditar(rep)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => setDeleteTarget(rep)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Eliminar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Página {page} de {totalPages} — {data?.total ?? 0} repuestos
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

      {/* Diálogos */}
      <RepuestoFormDialog open={formOpen} onOpenChange={setFormOpen} repuesto={editingRepuesto} />
      <MovimientoFormDialog open={movDialogOpen} onOpenChange={setMovDialogOpen} prefill={movPrefill} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar repuesto</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Está seguro de eliminar el repuesto "{deleteTarget?.nombre}"? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget._id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ContentCard>
  );
}

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, MapPinned, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ContentCard } from "@/components/layout/ContentCard";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { getRutas, toggleRutaFavorita, deleteRuta } from "@/services/apirndc";
import type { ApiRndcRuta } from "@/services/apirndc/apirndc.types";
import { RutaBuilder } from "@/components/rutas/RutaBuilder";

export function RutasTab() {
  const queryClient = useQueryClient();
  const { role } = useAuth();
  const isAdmin = role === "admin"; // ADMIN / SUPER_ADMIN de plataforma

  const [builderOpen, setBuilderOpen] = useState(false);
  const [editRuta, setEditRuta] = useState<ApiRndcRuta | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ApiRndcRuta | null>(null);

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: ["op-rutas-list"] });
    queryClient.invalidateQueries({ queryKey: ["op-rutas"] });
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ["op-rutas-list"],
    queryFn: ({ signal }) => getRutas(undefined, signal),
  });
  const rutas = data?.data ?? [];

  const favMutation = useMutation({
    mutationFn: (r: ApiRndcRuta) => toggleRutaFavorita(r._id, !r.favorita),
    onSuccess: invalidar,
    onError: (e: Error) => toast.error(e.message || "Error al actualizar favorita"),
  });

  const delMutation = useMutation({
    mutationFn: (id: string) => deleteRuta(id),
    onSuccess: () => {
      toast.success("Ruta enviada a la papelera");
      invalidar();
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast.error(e.message || "Error al eliminar la ruta"),
  });

  const recorridoTexto = (r: ApiRndcRuta) =>
    r.puntos && r.puntos.length > 0
      ? r.puntos.map((p) => p.nombre).join("  →  ")
      : [r.origen, r.destino].filter(Boolean).join("  →  ") || "-";

  return (
    <ContentCard>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <p className="text-sm text-muted-foreground">
          Catálogo de rutas multipunto para asignar a los viajes.
          {isAdmin && " Las eliminadas se recuperan desde la Papelera."}
        </p>
        <Button
          onClick={() => {
            setEditRuta(null);
            setBuilderOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Nueva ruta
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="text-center py-12 text-destructive">
          Error al cargar rutas: {(error as Error).message}
        </div>
      ) : rutas.length === 0 ? (
        <div className="text-center py-12">
          <MapPinned className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium text-muted-foreground">No hay rutas registradas</p>
          <p className="text-sm text-muted-foreground mt-1">Cree una con “Nueva ruta”.</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Recorrido</TableHead>
                <TableHead className="text-center">Puntos</TableHead>
                <TableHead className="text-right">Distancia</TableHead>
                <TableHead className="text-center">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rutas.map((r) => (
                <TableRow key={r._id}>
                  <TableCell>
                    <button
                      type="button"
                      title={r.favorita ? "Quitar de favoritas" : "Marcar favorita"}
                      onClick={() => favMutation.mutate(r)}
                      disabled={favMutation.isPending}
                    >
                      <Star
                        className={
                          r.favorita
                            ? "h-4 w-4 fill-amber-400 text-amber-400"
                            : "h-4 w-4 text-muted-foreground"
                        }
                      />
                    </button>
                  </TableCell>
                  <TableCell className="font-medium">{r.nombre}</TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">{recorridoTexto(r)}</span>
                  </TableCell>
                  <TableCell className="text-center">{r.puntos?.length ?? 0}</TableCell>
                  <TableCell className="text-right">
                    {r.distanciaKm ? `${r.distanciaKm} km` : "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Editar"
                        onClick={() => {
                          setEditRuta(r);
                          setBuilderOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          title="Eliminar"
                          onClick={() => setDeleteTarget(r)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <RutaBuilder open={builderOpen} onOpenChange={setBuilderOpen} ruta={editRuta} />

      {/* Confirmar envío a papelera */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar ruta</DialogTitle>
            <DialogDescription>
              ¿Enviar “{deleteTarget?.nombre}” a la papelera? Podrá restaurarla desde la
              sección Papelera.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={delMutation.isPending}
              onClick={() => deleteTarget && delMutation.mutate(deleteTarget._id)}
            >
              {delMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ContentCard>
  );
}

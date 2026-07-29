import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRight, Loader2, Plus, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createRuta, updateRuta } from "@/services/apirndc";
import type {
  ApiRndcRuta,
  ApiRndcRutaCoord,
  ApiRndcRutaPayload,
  ApiRndcRutaTramo,
} from "@/services/apirndc/apirndc.types";
import { PlaceAutocomplete, geocodePlace, type PlaceResult } from "./PlaceAutocomplete";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Ruta a editar; si es null se crea una nueva. */
  ruta?: ApiRndcRuta | null;
}

function placeToCoord(p: PlaceResult): ApiRndcRutaCoord {
  return { nombre: p.nombre, lat: p.lat, lng: p.lng };
}

export function RutaBuilder({ open, onOpenChange, ruta }: Props) {
  const queryClient = useQueryClient();
  const isEdit = !!ruta;
  const [nombre, setNombre] = useState("");
  const [favorita, setFavorita] = useState(false);
  const [tramos, setTramos] = useState<ApiRndcRutaTramo[]>([]);

  // Borrador del tramo en construcción
  const [draftOrigen, setDraftOrigen] = useState<ApiRndcRutaCoord | null>(null);
  const [draftDestino, setDraftDestino] = useState<ApiRndcRutaCoord | null>(null);
  const [draftDist, setDraftDist] = useState("");

  useEffect(() => {
    if (!open) return;
    if (ruta) {
      setNombre(ruta.nombre ?? "");
      setFavorita(!!ruta.favorita);
      setTramos(ruta.tramos?.length ? ruta.tramos : []);
    } else {
      setNombre("");
      setFavorita(false);
      setTramos([]);
    }
    setDraftOrigen(null);
    setDraftDestino(null);
    setDraftDist("");
  }, [open, ruta]);

  // El origen del próximo tramo es el destino del último (rutas encadenadas).
  const origenFijo: ApiRndcRutaCoord | null =
    tramos.length > 0 ? tramos[tramos.length - 1].destino : null;
  const origenActual = origenFijo ?? draftOrigen;

  // Tramo en construcción que aún no se ha "agregado" pero está completo.
  const tramoPendiente: ApiRndcRutaTramo | null =
    origenActual && draftDestino
      ? {
          orden: tramos.length + 1,
          origen: origenActual,
          destino: draftDestino,
          distanciaKm: draftDist ? Number(draftDist) : null,
        }
      : null;

  // Lo que realmente se guardará: los tramos agregados + el pendiente (si lo hay).
  const tramosFinal = tramoPendiente ? [...tramos, tramoPendiente] : tramos;

  const totalKm = useMemo(
    () => tramosFinal.reduce((sum, t) => sum + (t.distanciaKm ?? 0), 0),
    [tramosFinal],
  );

  const addTramo = () => {
    if (!origenActual || !draftDestino) return;
    setTramos((prev) => [
      ...prev,
      {
        orden: prev.length + 1,
        origen: origenActual,
        destino: draftDestino,
        distanciaKm: draftDist ? Number(draftDist) : null,
      },
    ]);
    setDraftOrigen(null); // a partir de ahora el origen se encadena
    setDraftDestino(null);
    setDraftDist("");
  };

  // Solo se quita el último tramo para no romper el encadenamiento (origen = destino anterior).
  const removeUltimoTramo = () => {
    setTramos((prev) => prev.slice(0, -1));
    setDraftOrigen(null);
    setDraftDestino(null);
    setDraftDist("");
  };

  // Resuelve lat/lng de un extremo si quedó sin coordenadas (ingresado como texto).
  const resolverCoord = async (
    c: ApiRndcRutaCoord,
    bias: { lat: number; lng: number } | null,
  ): Promise<ApiRndcRutaCoord> => {
    if (c.lat != null && c.lng != null) return c;
    const geo = await geocodePlace(c.nombre, bias);
    return geo ? { ...c, lat: geo.lat, lng: geo.lng } : c;
  };

  const mutation = useMutation({
    mutationFn: async () => {
      // Antes de guardar, completar coordenadas faltantes con el geocodificador.
      const tramosConCoord: ApiRndcRutaTramo[] = [];
      let prev: ApiRndcRutaCoord | null = null;
      for (const t of tramosFinal) {
        const origen = await resolverCoord(
          t.origen,
          prev && prev.lat != null && prev.lng != null
            ? { lat: prev.lat, lng: prev.lng }
            : null,
        );
        const destino = await resolverCoord(
          t.destino,
          origen.lat != null && origen.lng != null
            ? { lat: origen.lat, lng: origen.lng }
            : null,
        );
        tramosConCoord.push({ ...t, origen, destino });
        prev = destino;
      }

      // Avisar si algún extremo no se pudo ubicar (quedó sin coordenadas).
      const sinCoord = tramosConCoord.reduce((n, t) => {
        let c = 0;
        if (t.origen.lat == null || t.origen.lng == null) c++;
        if (t.destino.lat == null || t.destino.lng == null) c++;
        return n + c;
      }, 0);
      if (sinCoord > 0) {
        toast.warning(
          `${sinCoord} punto(s) se guardarán sin coordenadas (no se ubicaron en el mapa).`,
        );
      }

      const payload: ApiRndcRutaPayload = {
        tramos: tramosConCoord.map((t, i) => ({ ...t, orden: i + 1 })),
        favorita,
      };
      if (nombre.trim()) payload.nombre = nombre.trim();
      return isEdit ? updateRuta(ruta!._id, payload) : createRuta(payload);
    },
    onSuccess: () => {
      toast.success(isEdit ? "Ruta actualizada" : "Ruta creada");
      queryClient.invalidateQueries({ queryKey: ["op-rutas"] });
      queryClient.invalidateQueries({ queryKey: ["op-rutas-list"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message || "Error al guardar la ruta"),
  });

  const canSubmit = tramosFinal.length >= 1;
  const biasDestino =
    origenActual?.lat != null && origenActual?.lng != null
      ? { lat: origenActual.lat, lng: origenActual.lng }
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar ruta" : "Nueva ruta"}</DialogTitle>
          <DialogDescription>
            Agregue los tramos de la ruta (ej. Pasto → Ipiales, Ipiales → Túquerres) con su
            distancia aproximada. El destino de un tramo es el origen del siguiente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Tramos ya agregados */}
          {tramos.length > 0 && (
            <div className="border rounded-lg divide-y">
              {tramos.map((t, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium flex items-center gap-1.5 truncate">
                      <span className="truncate">{t.origen.nombre}</span>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate">{t.destino.nombre}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t.distanciaKm != null ? `${t.distanciaKm} km` : "sin distancia"}
                    </p>
                  </div>
                  {i === tramos.length - 1 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                      title="Quitar último tramo"
                      onClick={removeUltimoTramo}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  ) : (
                    <span className="w-7 shrink-0" />
                  )}
                </div>
              ))}
              <div className="flex items-center justify-between px-3 py-2 bg-muted/40">
                <span className="text-sm font-medium">Distancia total</span>
                <span className="text-sm font-semibold">{totalKm.toLocaleString("es-CO")} km</span>
              </div>
            </div>
          )}

          {/* Nuevo tramo */}
          <div className="border rounded-lg p-3 space-y-3 bg-muted/20">
            <p className="text-sm font-semibold">
              {tramos.length === 0 ? "Primer tramo" : `Tramo ${tramos.length + 1}`}
            </p>

            {/* Origen */}
            <div className="space-y-1.5">
              <Label className="text-xs">Origen</Label>
              {origenFijo ? (
                <div className="text-sm font-medium px-3 py-2 rounded-md border bg-background">
                  {origenFijo.nombre}{" "}
                  <span className="text-xs text-muted-foreground">(viene del tramo anterior)</span>
                </div>
              ) : draftOrigen ? (
                <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-md border bg-background">
                  <span className="text-sm font-medium truncate">{draftOrigen.nombre}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setDraftOrigen(null)}
                  >
                    Cambiar
                  </Button>
                </div>
              ) : (
                <PlaceAutocomplete
                  placeholder="Origen (ej. Pasto, Nariño)"
                  onSelect={(p) => setDraftOrigen(placeToCoord(p))}
                />
              )}
            </div>

            {/* Destino */}
            <div className="space-y-1.5">
              <Label className="text-xs">Destino</Label>
              {draftDestino ? (
                <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-md border bg-background">
                  <span className="text-sm font-medium truncate">{draftDestino.nombre}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setDraftDestino(null)}
                  >
                    Cambiar
                  </Button>
                </div>
              ) : (
                <PlaceAutocomplete
                  placeholder="Destino (ej. Ipiales, Nariño)"
                  bias={biasDestino}
                  onSelect={(p) => setDraftDestino(placeToCoord(p))}
                />
              )}
            </div>

            {/* Distancia */}
            <div className="space-y-1.5">
              <Label className="text-xs">Distancia aproximada (km)</Label>
              <Input
                type="number"
                min={0}
                value={draftDist}
                onChange={(e) => setDraftDist(e.target.value)}
                placeholder="Ej. 80"
              />
            </div>

            <Button
              type="button"
              variant="secondary"
              className="w-full"
              disabled={!origenActual || !draftDestino}
              onClick={addTramo}
            >
              <Plus className="h-4 w-4 mr-1" />
              Agregar tramo
            </Button>
          </div>

          {/* Datos de la ruta */}
          <div className="space-y-2">
            <Label>Nombre (opcional)</Label>
            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Se genera del origen → destino"
            />
          </div>

          <button
            type="button"
            onClick={() => setFavorita((v) => !v)}
            className="flex items-center gap-2 text-sm"
          >
            <Star
              className={
                favorita
                  ? "h-5 w-5 fill-amber-400 text-amber-400"
                  : "h-5 w-5 text-muted-foreground"
              }
            />
            {favorita ? "Marcada como favorita" : "Marcar como favorita"}
          </button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={!canSubmit || mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEdit ? "Guardar cambios" : "Guardar ruta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { FleetMap, MapMarker } from "@/components/mapa/FleetMap";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  RefreshCw,
  Loader2,
  Wifi,
  WifiOff,
  Navigation,
  Map as MapIcon,
  Search,
  Car,
  X,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

// ── Types ──

interface CellviVehicleRaw {
  id: number;
  placa: string;
  modelo: number;
  servicio: string;
  monitoreado: boolean;
  ignicion: boolean;
  tipoVehiculo?: { nombre: string };
  color?: { nombre: string };
  linea?: { linea: string };
  conductores?: any[];
  eventoActual?: { id: number; vehiculo: number };
  eventoAnterior?: { id: number; vehiculo: number };
  eventoMovimiento?: { id: number; vehiculo: number };
}

interface CellviPositionRaw {
  id: string;
  latitud: number;
  longitud: number;
  velocidad: number;
  momento: string;
  sentido: number;
  variables?: string;
  evento?: {
    tipoEvento?: { codigo: string; nombre: string };
  } | null;
}

interface VehicleWithPosition {
  vehicleId: number;
  placa: string;
  modelo: number;
  tipoVehiculo: string;
  color: string;
  linea: string;
  ignicion: boolean;
  monitoreado: boolean;
  lat: number;
  lon: number;
  speed: number;
  course: number;
  deviceStatus: "online" | "offline";
  updatedAt: string;
}

// ── Component ──

export default function Mapa() {
  const { cellviToken } = useAuth();
  const [vehicles, setVehicles] = useState<VehicleWithPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    if (!cellviToken) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // 1. Fetch all assigned vehicles
      const vehRes = await fetch("/cellviapi/cellvi/vehiculo/get_vehiculos_asignados", {
        headers: { Authorization: `Bearer ${cellviToken}` },
        signal: controller.signal,
      });
      if (!vehRes.ok) throw new Error("Error al obtener vehículos");
      const rawVehicles: CellviVehicleRaw[] = await vehRes.json();

      if (controller.signal.aborted) return;

      // 2. Fetch positions for each vehicle
      const withPositions: VehicleWithPosition[] = [];

      const positionPromises = rawVehicles.map(async (v) => {
        try {
          const posRes = await fetch(`/cellviapi/cellvi/vehiculo/v2/${v.id}/get_last_position`, {
            headers: {
              Authorization: `Bearer ${cellviToken}`,
            },
            signal: controller.signal,
          });
          if (!posRes.ok) return null;
          const pos: CellviPositionRaw = await posRes.json();

          if (!pos.latitud || !pos.longitud) return null;

          // Determine device status based on recency
          let deviceStatus: "online" | "offline" = "offline";
          try {
            const posTime = new Date(pos.momento.replace(" ", "T"));
            const diffMs = Date.now() - posTime.getTime();
            deviceStatus = diffMs < 5 * 60 * 1000 ? "online" : "offline";
          } catch {}

          return {
            vehicleId: v.id,
            placa: v.placa,
            modelo: v.modelo,
            tipoVehiculo: v.tipoVehiculo?.nombre || "",
            color: v.color?.nombre || "",
            linea: v.linea?.linea || "",
            ignicion: v.ignicion,
            monitoreado: v.monitoreado,
            lat: pos.latitud,
            lon: pos.longitud,
            speed: pos.velocidad,
            course: pos.sentido >= 0 ? pos.sentido : 0,
            deviceStatus,
            updatedAt: pos.momento,
          } as VehicleWithPosition;
        } catch {
          return null;
        }
      });

      const results = await Promise.all(positionPromises);
      if (controller.signal.aborted) return;

      for (const r of results) {
        if (r) withPositions.push(r);
      }

      setVehicles(withPositions);
      setLastSync(new Date());
    } catch (err) {
      if (controller.signal.aborted) return;
      console.error("[Mapa] Error:", err);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [cellviToken]);

  // Initial fetch
  useEffect(() => {
    fetchData();
    return () => abortRef.current?.abort();
  }, [fetchData]);

  // Auto-refresh every 30s
  useEffect(() => {
    if (!cellviToken) return;
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [cellviToken, fetchData]);

  // ── Derived data ──
  const onlineCount = vehicles.filter((v) => v.deviceStatus === "online").length;
  const movingCount = vehicles.filter((v) => v.speed > 2).length;

  const markers: MapMarker[] = useMemo(
    () =>
      vehicles.map((v) => ({
        id: `cellvi_${v.vehicleId}`,
        lat: v.lat,
        lon: v.lon,
        label: v.placa,
        speed: v.speed,
        course: v.course,
        ignition: v.ignicion,
        status: v.deviceStatus,
        vehicleClass: v.tipoVehiculo || "MICROBUS",
      })),
    [vehicles]
  );

  const mapCenter: [number, number] = vehicles.length > 0
    ? [vehicles[0].lon, vehicles[0].lat]
    : [-77.2811, 1.2136]; // Pasto

  const filteredVehicles = useMemo(() => {
    if (!searchTerm) return vehicles;
    const s = searchTerm.toLowerCase();
    return vehicles.filter(
      (v) =>
        v.placa.toLowerCase().includes(s) ||
        v.tipoVehiculo.toLowerCase().includes(s)
    );
  }, [vehicles, searchTerm]);

  const selectedCellviId = selectedVehicleId ? `cellvi_${selectedVehicleId}` : null;

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-8rem)] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-primary/10">
              <MapIcon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Mapa de Flota</h1>
              <p className="text-sm text-muted-foreground">
                Monitoreo GPS en tiempo real
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 bg-muted/50 rounded-lg p-1.5 border border-border">
              <Badge
                variant="outline"
                className="h-7 px-3 gap-1.5 bg-card border-success/30 whitespace-nowrap inline-flex items-center justify-center"
              >
                <Wifi className="h-3.5 w-3.5 text-success flex-shrink-0" />
                <span className="font-semibold">{onlineCount}</span>
                <span className="text-muted-foreground">online</span>
              </Badge>
              <Badge
                variant="outline"
                className="h-7 px-3 gap-1.5 bg-card border-primary/30 whitespace-nowrap inline-flex items-center justify-center"
              >
                <Navigation className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                <span className="font-semibold">{movingCount}</span>
                <span className="text-muted-foreground">en movimiento</span>
              </Badge>
              <Badge
                variant="outline"
                className="h-7 px-3 gap-1.5 bg-card border-destructive/30 whitespace-nowrap inline-flex items-center justify-center"
              >
                <WifiOff className="h-3.5 w-3.5 text-destructive flex-shrink-0" />
                <span className="font-semibold">{vehicles.length - onlineCount}</span>
                <span className="text-muted-foreground">offline</span>
              </Badge>
            </div>

            {lastSync && (
              <span className="text-xs text-muted-foreground hidden sm:block">
                Actualizado {formatDistanceToNow(lastSync, { addSuffix: true, locale: es })}
              </span>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => { setLoading(true); fetchData(); }}
              disabled={loading}
              className="bg-card"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Sincronizar
            </Button>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex rounded-lg overflow-hidden border border-border bg-card shadow-corporate">
          {/* Sidebar */}
          <div className="hidden md:flex w-80 border-r border-border flex-shrink-0 flex-col bg-card">
            {/* Search */}
            <div className="p-3 border-b border-border">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar placa..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-9 text-sm"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {vehicles.length} vehículos | {onlineCount} en línea
              </p>
            </div>

            {/* Vehicle list */}
            <div className="flex-1 overflow-auto">
              {filteredVehicles.map((v) => {
                const isSelected = selectedVehicleId === v.vehicleId;
                const isMoving = v.speed > 2;
                return (
                  <button
                    key={v.vehicleId}
                    type="button"
                    onClick={() => setSelectedVehicleId(isSelected ? null : v.vehicleId)}
                    className={`w-full text-left px-3 py-2.5 border-b border-border transition-colors ${
                      isSelected
                        ? "bg-primary/10 border-l-2 border-l-primary"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`p-1.5 rounded-md ${
                          v.deviceStatus === "online"
                            ? isMoving
                              ? "bg-primary/15"
                              : "bg-success/15"
                            : "bg-muted"
                        }`}
                      >
                        <Car
                          className={`h-4 w-4 ${
                            v.deviceStatus === "online"
                              ? isMoving
                                ? "text-primary"
                                : "text-success"
                              : "text-muted-foreground"
                          }`}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{v.placa}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {v.tipoVehiculo} {v.linea && `- ${v.linea}`}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        {v.deviceStatus === "online" ? (
                          <span className="text-xs font-medium text-success">
                            {isMoving ? `${v.speed.toFixed(0)} km/h` : "Detenido"}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Offline</span>
                        )}
                        {v.ignicion && (
                          <p className="text-[10px] text-amber-600">Motor enc.</p>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Map */}
          <div className="flex-1 relative">
            {loading && vehicles.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center bg-muted">
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Cargando posiciones...</span>
                </div>
              </div>
            ) : (
              <FleetMap
                markers={markers}
                selectedId={selectedCellviId}
                onMarkerClick={(id) => {
                  const numId = parseInt(id.replace("cellvi_", ""), 10);
                  setSelectedVehicleId(numId === selectedVehicleId ? null : numId);
                }}
                center={mapCenter}
              />
            )}

            {/* Selected vehicle info overlay */}
            {selectedVehicleId && (() => {
              const v = vehicles.find((v) => v.vehicleId === selectedVehicleId);
              if (!v) return null;
              return (
                <div className="absolute bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-card/95 backdrop-blur border border-border rounded-lg shadow-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-lg">{v.placa}</h3>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setSelectedVehicleId(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Tipo:</span>
                      <p className="font-medium">{v.tipoVehiculo || "-"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Velocidad:</span>
                      <p className="font-medium">{v.speed.toFixed(1)} km/h</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Estado:</span>
                      <p className={`font-medium ${v.deviceStatus === "online" ? "text-success" : "text-muted-foreground"}`}>
                        {v.deviceStatus === "online"
                          ? v.speed > 2
                            ? "En movimiento"
                            : v.ignicion
                            ? "Detenido (motor enc.)"
                            : "Motor apagado"
                          : "Offline"}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Modelo:</span>
                      <p className="font-medium">{v.modelo}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Color:</span>
                      <p className="font-medium">{v.color || "-"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Línea:</span>
                      <p className="font-medium">{v.linea || "-"}</p>
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t text-xs text-muted-foreground">
                    Lat: {v.lat.toFixed(5)}, Lon: {v.lon.toFixed(5)} | Rumbo: {v.course}°
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

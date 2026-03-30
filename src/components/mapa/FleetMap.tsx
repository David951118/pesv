import { useEffect, useRef, useState, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { getVehicleMarkerSVG } from "./VehicleMarkerAion";
import { Button } from "@/components/ui/button";
import { Map, Satellite, Mountain, Moon, ZoomIn, ZoomOut, Locate } from "lucide-react";

export interface MapMarker {
  id: string;
  lat: number;
  lon: number;
  label?: string;
  color?: string;
  speed?: number;
  course?: number;
  ignition?: boolean | null;
  status?: string;
  vehicleClass?: string;
  operationalStatus?: Record<string, unknown>;
}

interface FleetMapProps {
  markers: MapMarker[];
  selectedId?: string | null;
  onMarkerClick?: (id: string) => void;
  center?: [number, number];
  zoom?: number;
}

type MapStyleType = "streets" | "satellite" | "terrain" | "dark";

const MAP_STYLES: Record<MapStyleType, maplibregl.StyleSpecification> = {
  streets: {
    version: 8,
    sources: {
      osm: {
        type: "raster",
        tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
        tileSize: 256,
        attribution: "© OpenStreetMap contributors",
      },
    },
    layers: [{ id: "osm", type: "raster", source: "osm" }],
  },
  satellite: {
    version: 8,
    sources: {
      satellite: {
        type: "raster",
        tiles: [
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        ],
        tileSize: 256,
        attribution: "© Esri, Maxar",
      },
    },
    layers: [{ id: "satellite", type: "raster", source: "satellite" }],
  },
  terrain: {
    version: 8,
    sources: {
      terrain: {
        type: "raster",
        tiles: ["https://tile.opentopomap.org/{z}/{x}/{y}.png"],
        tileSize: 256,
        attribution: "© OpenTopoMap",
      },
    },
    layers: [{ id: "terrain", type: "raster", source: "terrain" }],
  },
  dark: {
    version: 8,
    sources: {
      dark: {
        type: "raster",
        tiles: ["https://cartodb-basemaps-a.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png"],
        tileSize: 256,
        attribution: "© CARTO",
      },
    },
    layers: [{ id: "dark", type: "raster", source: "dark" }],
  },
};

export function FleetMap({
  markers,
  selectedId,
  onMarkerClick,
  center = [-77.2811, 1.2136],
  zoom = 11,
}: FleetMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<globalThis.Map<string, maplibregl.Marker>>(new globalThis.Map());
  const [mapLoaded, setMapLoaded] = useState(false);
  const [currentStyle, setCurrentStyle] = useState<MapStyleType>("streets");

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: MAP_STYLES.streets,
      center,
      zoom,
      pitch: 0,
      bearing: 0,
    });

    map.current.addControl(new maplibregl.NavigationControl({ showCompass: true }), "bottom-right");
    map.current.addControl(new maplibregl.ScaleControl(), "bottom-left");

    map.current.on("load", () => {
      setMapLoaded(true);
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Change map style
  const changeMapStyle = useCallback((style: MapStyleType) => {
    if (!map.current) return;
    
    // Store current view
    const currentCenter = map.current.getCenter();
    const currentZoom = map.current.getZoom();
    const currentPitch = map.current.getPitch();
    const currentBearing = map.current.getBearing();

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current.clear();

    // Set new style
    map.current.setStyle(MAP_STYLES[style]);
    setCurrentStyle(style);

    // Restore view after style loads
    map.current.once("styledata", () => {
      map.current?.setCenter(currentCenter);
      map.current?.setZoom(currentZoom);
      map.current?.setPitch(currentPitch);
      map.current?.setBearing(currentBearing);
      setMapLoaded(true);
    });
  }, []);

  // Toggle 3D terrain
  const toggle3D = useCallback(() => {
    if (!map.current) return;
    const currentPitch = map.current.getPitch();
    map.current.easeTo({
      pitch: currentPitch > 0 ? 0 : 60,
      bearing: currentPitch > 0 ? 0 : -20,
      duration: 1000,
    });
  }, []);

  // Fit to all markers
  const fitToMarkers = useCallback(() => {
    if (!map.current || markers.length === 0) return;
    const bounds = new maplibregl.LngLatBounds();
    markers.forEach((m) => bounds.extend([m.lon, m.lat]));
    map.current.fitBounds(bounds, { padding: 80, maxZoom: 14 });
  }, [markers]);

  // Update markers
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const currentIds = new Set(markers.map((m) => m.id));

    // Remove markers that no longer exist
    markersRef.current.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    });

    // Add or update markers
    markers.forEach((m) => {
      const existingMarker = markersRef.current.get(m.id);

      if (existingMarker) {
        // Update position smoothly
        existingMarker.setLngLat([m.lon, m.lat]);
        
        // Update marker element
        const el = existingMarker.getElement();
        el.innerHTML = getVehicleMarkerSVG({
          speed: m.speed || 0,
          course: m.course || 0,
          ignition: m.ignition,
          status: m.status || "offline",
          operationalStatus: m.operationalStatus,
          isSelected: m.id === selectedId,
          vehicleClass: m.vehicleClass,
          placa: m.label,
        });
      } else {
        // Create new marker
        const el = document.createElement("div");
        el.className = "fleet-marker fleet-marker-aion";
        el.style.width = "52px";
        el.style.height = "65px";
        el.style.cursor = "pointer";
        el.style.transition = "transform 0.3s ease";

        el.innerHTML = getVehicleMarkerSVG({
          speed: m.speed || 0,
          course: m.course || 0,
          ignition: m.ignition,
          status: m.status || "offline",
          operationalStatus: m.operationalStatus,
          isSelected: m.id === selectedId,
          vehicleClass: m.vehicleClass,
          placa: m.label,
        });

        const marker = new maplibregl.Marker({ element: el, anchor: "bottom" })
          .setLngLat([m.lon, m.lat])
          .addTo(map.current!);

        el.addEventListener("click", () => {
          onMarkerClick?.(m.id);
        });

        // Popup with vehicle info
        const isMoving = (m.speed || 0) > 2;
        const statusText = isMoving ? "En movimiento" : m.ignition ? "Detenido (motor enc.)" : "Motor apagado";
        
        const popup = new maplibregl.Popup({ 
          offset: [0, -45], 
          closeButton: false,
          className: "fleet-popup"
        });

        const popupEl = document.createElement('div');
        popupEl.style.cssText = 'padding: 8px; min-width: 160px; font-family: system-ui;';

        const placaDiv = document.createElement('div');
        placaDiv.style.cssText = 'font-weight: 600; font-size: 14px; margin-bottom: 4px;';
        placaDiv.textContent = m.label || "Sin placa";
        popupEl.appendChild(placaDiv);

        const statusDiv = document.createElement('div');
        statusDiv.style.cssText = 'font-size: 12px; color: #666; margin-bottom: 4px;';
        statusDiv.textContent = statusText;
        popupEl.appendChild(statusDiv);

        const speedDiv = document.createElement('div');
        speedDiv.style.cssText = 'display: flex; justify-content: space-between; font-size: 11px;';
        const speedSpan = document.createElement('span');
        speedSpan.textContent = `🚀 ${m.speed?.toFixed(1) || 0} km/h`;
        const courseSpan = document.createElement('span');
        courseSpan.textContent = `🧭 ${Math.round(m.course || 0)}°`;
        speedDiv.appendChild(speedSpan);
        speedDiv.appendChild(courseSpan);
        popupEl.appendChild(speedDiv);

        if (m.vehicleClass) {
          const classDiv = document.createElement('div');
          classDiv.style.cssText = 'font-size: 10px; color: #999; margin-top: 4px;';
          classDiv.textContent = m.vehicleClass;
          popupEl.appendChild(classDiv);
        }

        popup.setDOMContent(popupEl);

        marker.setPopup(popup);
        markersRef.current.set(m.id, marker);
      }

      // Fly to selected
      if (m.id === selectedId && map.current) {
        map.current.flyTo({
          center: [m.lon, m.lat],
          zoom: 16,
          duration: 1000,
        });
      }
    });
  }, [markers, mapLoaded, selectedId, onMarkerClick]);

  // Fit bounds on initial load
  useEffect(() => {
    if (!map.current || !mapLoaded || markers.length === 0) return;
    if (markers.length > 1 && !selectedId) {
      const bounds = new maplibregl.LngLatBounds();
      markers.forEach((m) => bounds.extend([m.lon, m.lat]));
      map.current.fitBounds(bounds, { padding: 50, maxZoom: 14 });
    }
  }, [markers.length, mapLoaded, selectedId]);

  return (
    <div className="relative w-full h-full">
      <div
        ref={mapContainer}
        className="w-full h-full min-h-[400px] rounded-lg overflow-hidden"
        style={{ background: "hsl(var(--muted))" }}
      />

      {/* Map Style Controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2">
        <div className="bg-background/95 backdrop-blur rounded-lg shadow-lg p-1 flex flex-col gap-1">
          <Button
            variant={currentStyle === "streets" ? "default" : "ghost"}
            size="icon"
            className="h-8 w-8"
            onClick={() => changeMapStyle("streets")}
            title="Vista de Calles"
          >
            <Map className="h-4 w-4" />
          </Button>
          <Button
            variant={currentStyle === "satellite" ? "default" : "ghost"}
            size="icon"
            className="h-8 w-8"
            onClick={() => changeMapStyle("satellite")}
            title="Vista Satelital"
          >
            <Satellite className="h-4 w-4" />
          </Button>
          <Button
            variant={currentStyle === "terrain" ? "default" : "ghost"}
            size="icon"
            className="h-8 w-8"
            onClick={() => changeMapStyle("terrain")}
            title="Vista Terreno"
          >
            <Mountain className="h-4 w-4" />
          </Button>
          <Button
            variant={currentStyle === "dark" ? "default" : "ghost"}
            size="icon"
            className="h-8 w-8"
            onClick={() => changeMapStyle("dark")}
            title="Modo Oscuro"
          >
            <Moon className="h-4 w-4" />
          </Button>
        </div>

        <div className="bg-background/95 backdrop-blur rounded-lg shadow-lg p-1 flex flex-col gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => map.current?.zoomIn()}
            title="Acercar"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => map.current?.zoomOut()}
            title="Alejar"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={fitToMarkers}
            title="Ver todos"
          >
            <Locate className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 3D Toggle */}
      <Button
        variant="outline"
        size="sm"
        className="absolute bottom-4 right-4 bg-background/95 backdrop-blur"
        onClick={toggle3D}
      >
        Vista 3D
      </Button>
    </div>
  );
}

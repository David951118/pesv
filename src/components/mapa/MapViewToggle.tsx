import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Map, Mountain, Satellite, Layers } from "lucide-react";

export type MapStyle = "streets" | "satellite" | "terrain" | "dark";

interface MapViewToggleProps {
  currentStyle: MapStyle;
  onStyleChange: (style: MapStyle) => void;
}

const MAP_STYLES: { id: MapStyle; label: string; icon: React.ReactNode; description: string }[] = [
  { 
    id: "streets", 
    label: "Calles 2D", 
    icon: <Map className="h-4 w-4" />,
    description: "Vista clásica de calles"
  },
  { 
    id: "satellite", 
    label: "Satélite", 
    icon: <Satellite className="h-4 w-4" />,
    description: "Imágenes satelitales"
  },
  { 
    id: "terrain", 
    label: "Terreno 3D", 
    icon: <Mountain className="h-4 w-4" />,
    description: "Relieve y elevación"
  },
  { 
    id: "dark", 
    label: "Modo Oscuro", 
    icon: <Layers className="h-4 w-4" />,
    description: "Tema oscuro para noche"
  },
];

export function MapViewToggle({ currentStyle, onStyleChange }: MapViewToggleProps) {
  const currentStyleInfo = MAP_STYLES.find(s => s.id === currentStyle) || MAP_STYLES[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          {currentStyleInfo.icon}
          <span className="hidden sm:inline">{currentStyleInfo.label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {MAP_STYLES.map((style) => (
          <DropdownMenuItem
            key={style.id}
            onClick={() => onStyleChange(style.id)}
            className={currentStyle === style.id ? "bg-accent" : ""}
          >
            <div className="flex items-center gap-2 w-full">
              {style.icon}
              <div className="flex-1">
                <p className="text-sm font-medium">{style.label}</p>
                <p className="text-xs text-muted-foreground">{style.description}</p>
              </div>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Map style configurations
export const MAP_STYLE_CONFIGS: Record<MapStyle, object> = {
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
        attribution: "© Esri, Maxar, Earthstar Geographics",
      },
    },
    layers: [{ id: "satellite", type: "raster", source: "satellite" }],
  },
  terrain: {
    version: 8,
    sources: {
      terrain: {
        type: "raster",
        tiles: [
          "https://tile.opentopomap.org/{z}/{x}/{y}.png",
        ],
        tileSize: 256,
        attribution: "© OpenTopoMap contributors",
      },
    },
    layers: [{ id: "terrain", type: "raster", source: "terrain" }],
  },
  dark: {
    version: 8,
    sources: {
      dark: {
        type: "raster",
        tiles: [
          "https://cartodb-basemaps-a.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png",
        ],
        tileSize: 256,
        attribution: "© CARTO",
      },
    },
    layers: [{ id: "dark", type: "raster", source: "dark" }],
  },
};

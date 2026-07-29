import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface PlaceResult {
  nombre: string;
  lat: number | null;
  lng: number | null;
}

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    name?: string;
    street?: string;
    city?: string;
    county?: string;
    state?: string;
    country?: string;
    countrycode?: string;
    osm_value?: string;
  };
}

/**
 * Autocompletado de lugares usando Photon (OpenStreetMap), API pública gratuita
 * sin API key. https://photon.komoot.io
 * - Sesga los resultados a Colombia y, si se pasa `bias`, a las coordenadas del origen.
 */
function buildLabel(f: PhotonFeature): string {
  const p = f.properties ?? {};
  const partes = [
    p.name,
    p.street && p.street !== p.name ? p.street : null,
    p.city,
    p.county && p.county !== p.city ? p.county : null,
    p.state,
  ].filter(Boolean);
  // Evitar duplicados consecutivos
  const limpio: string[] = [];
  for (const x of partes as string[]) {
    if (limpio[limpio.length - 1] !== x) limpio.push(x);
  }
  return limpio.join(", ") || p.name || "Lugar";
}

/**
 * Geocodifica un nombre de lugar a lat/lng usando Photon (OSM). Devuelve null si
 * no encuentra nada. Útil para resolver coordenadas de puntos ingresados como texto.
 */
export async function geocodePlace(
  nombre: string,
  bias?: { lat: number; lng: number } | null,
): Promise<{ lat: number; lng: number } | null> {
  const q = nombre.trim();
  if (!q) return null;
  try {
    const params = new URLSearchParams({ q, lang: "es", limit: "1" });
    params.set("lat", String(bias?.lat ?? 4.5709));
    params.set("lon", String(bias?.lng ?? -74.2973));
    const res = await fetch(`https://photon.komoot.io/api/?${params.toString()}`);
    if (!res.ok) return null;
    const json = await res.json();
    const coords = json.features?.[0]?.geometry?.coordinates;
    return coords ? { lat: coords[1], lng: coords[0] } : null;
  } catch {
    return null;
  }
}

interface Props {
  onSelect: (place: PlaceResult) => void;
  placeholder?: string;
  /** Sesga la búsqueda cerca de estas coordenadas (ej. el origen de la ruta). */
  bias?: { lat: number; lng: number } | null;
  disabled?: boolean;
  /** Permite usar el texto escrito aunque el buscador no traiga sugerencias. */
  allowFreeText?: boolean;
}

export function PlaceAutocomplete({
  onSelect,
  placeholder,
  bias,
  disabled,
  allowFreeText = true,
}: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PhotonFeature[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Cerrar al hacer click afuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Búsqueda con debounce
  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const params = new URLSearchParams({ q, lang: "es", limit: "6" });
        // Sesgo geográfico: cerca del origen si existe, si no centro de Colombia.
        const lat = bias?.lat ?? 4.5709;
        const lng = bias?.lng ?? -74.2973;
        params.set("lat", String(lat));
        params.set("lon", String(lng));
        const res = await fetch(`https://photon.komoot.io/api/?${params.toString()}`, {
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error("photon");
        const json = await res.json();
        const feats: PhotonFeature[] = json.features ?? [];
        // Priorizar Colombia pero no excluir (por si buscan algo fronterizo)
        feats.sort((a, b) => {
          const ca = a.properties?.countrycode === "CO" ? 0 : 1;
          const cb = b.properties?.countrycode === "CO" ? 0 : 1;
          return ca - cb;
        });
        setResults(feats);
        setHighlight(0);
        setOpen(true);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [query, bias?.lat, bias?.lng]);

  const choose = (f: PhotonFeature) => {
    const coords = f.geometry?.coordinates;
    onSelect({
      nombre: buildLabel(f),
      lat: coords ? coords[1] : null,
      lng: coords ? coords[0] : null,
    });
    setQuery("");
    setResults([]);
    setOpen(false);
  };

  const chooseFreeText = () => {
    const nombre = query.trim();
    if (!nombre) return;
    onSelect({ nombre, lat: null, lng: null });
    setQuery("");
    setResults([]);
    setOpen(false);
  };

  const showFreeText = allowFreeText && query.trim().length >= 2;

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          value={query}
          disabled={disabled}
          placeholder={placeholder ?? "Buscar lugar (ej. Pasto, Nariño)"}
          className="pl-9 pr-9"
          onChange={(e) => {
            setQuery(e.target.value);
            if (e.target.value.trim().length >= 2) setOpen(true);
          }}
          onFocus={() => (results.length || showFreeText) && setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (open && results[highlight]) choose(results[highlight]);
              else if (showFreeText) chooseFreeText();
              return;
            }
            if (!open) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHighlight((h) => Math.min(results.length - 1, h + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlight((h) => Math.max(0, h - 1));
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {open && (results.length > 0 || showFreeText) && (
        <div className="absolute z-50 mt-1 w-full bg-popover border rounded-md shadow-lg max-h-64 overflow-y-auto">
          {results.map((f, i) => (
            <button
              key={i}
              type="button"
              onClick={() => choose(f)}
              onMouseEnter={() => setHighlight(i)}
              className={cn(
                "w-full flex items-start gap-2 px-3 py-2 text-left text-sm transition-colors",
                i === highlight ? "bg-accent" : "hover:bg-accent/50",
              )}
            >
              <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="font-medium truncate">{buildLabel(f)}</p>
                {f.properties?.country && (
                  <p className="text-xs text-muted-foreground truncate">{f.properties.country}</p>
                )}
              </div>
            </button>
          ))}
          {showFreeText && (
            <button
              type="button"
              onClick={chooseFreeText}
              className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm border-t hover:bg-accent/50"
            >
              <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">
                Usar “<span className="font-medium">{query.trim()}</span>” (se ubicará al guardar)
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

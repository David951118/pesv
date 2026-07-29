import { useAuth } from "@/hooks/useAuth";
import { getApiRndcBaseUrl } from "@/services/apirndc/apirndc.config";
import { useQuery } from "@tanstack/react-query";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Bell, FileWarning, Clock, Wrench, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ScrollArea } from "@/components/ui/scroll-area";

interface DocStats {
  total: number;
  vigentes: number;
  porVencer: number;
  vencidos: number;
}

interface Novedad {
  id?: number;
  _id?: string;
  descripcion?: string;
  placa?: string;
  conductor?: string | { nombres?: string; apellidos?: string; nombre?: string };
  vehiculo?: string | { placa?: string };
  fecha?: string;
  createdAt?: string;
  estado?: string;
  estadoGeneral?: string;
}

function getNovedadPlaca(nov: Novedad): string {
  if (nov.placa) return nov.placa;
  if (typeof nov.vehiculo === "object" && nov.vehiculo?.placa) return nov.vehiculo.placa;
  if (typeof nov.vehiculo === "string") return nov.vehiculo;
  return "";
}

function getNovedadConductor(nov: Novedad): string {
  if (typeof nov.conductor === "string") return nov.conductor;
  if (typeof nov.conductor === "object" && nov.conductor) {
    if (nov.conductor.nombres) return `${nov.conductor.nombres} ${nov.conductor.apellidos || ""}`.trim();
    return nov.conductor.nombre || "";
  }
  return "";
}

export function AlertsPopup({
  className = "text-nav-foreground hover:bg-nav-hover",
}: { className?: string } = {}) {
  const { bearerToken } = useAuth();
  const navigate = useNavigate();

  // Fetch document stats (counts only)
  const { data: docStats, isLoading: loadingDocs, isError: errorDocs } = useQuery<DocStats>({
    queryKey: ["alertas-doc-stats"],
    queryFn: async () => {
      const base = getApiRndcBaseUrl();
      const res = await fetch(`${base}/api/estadisticas/documentos`, {
        headers: { Authorization: `Bearer ${bearerToken}` },
      });
      if (!res.ok) throw new Error("Error fetching document stats");
      const json = await res.json();
      const d = json.data ?? json;
      return {
        total: d.total ?? 0,
        vigentes: d.vigentes ?? 0,
        porVencer: d.porVencer ?? 0,
        vencidos: d.vencidos ?? 0,
      };
    },
    enabled: !!bearerToken,
    refetchInterval: 5 * 60_000,
    staleTime: 2 * 60_000,
    retry: 1,
  });

  // Fetch novedades from preoperacionales
  const { data: novedades, isLoading: loadingNov, isError: errorNov } = useQuery<Novedad[]>({
    queryKey: ["alertas-novedades"],
    queryFn: async () => {
      const base = getApiRndcBaseUrl();
      const res = await fetch(`${base}/api/preoperacionales/novedades`, {
        headers: { Authorization: `Bearer ${bearerToken}` },
      });
      if (!res.ok) throw new Error("Error fetching novedades");
      const json = await res.json();
      const raw = json.data ?? json;
      return Array.isArray(raw) ? raw : [];
    },
    enabled: !!bearerToken,
    refetchInterval: 5 * 60_000,
    staleTime: 2 * 60_000,
    retry: 1,
  });

  const vencidos = docStats?.vencidos ?? 0;
  const porVencer = docStats?.porVencer ?? 0;
  const novedadesCount = Array.isArray(novedades) ? novedades.length : 0;
  const totalAlerts = vencidos + porVencer + novedadesCount;

  const isLoading = loadingDocs || loadingNov;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`relative ${className}`}
        >
          <Bell className="h-5 w-5" />
          {totalAlerts > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
              {totalAlerts > 99 ? "99+" : totalAlerts}
            </span>
          )}
          <span className="sr-only">Alertas</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="p-4 border-b">
          <h3 className="font-semibold text-foreground">Alertas</h3>
          <p className="text-xs text-muted-foreground">
            {isLoading
              ? "Cargando alertas..."
              : totalAlerts > 0
                ? `${totalAlerts} alerta${totalAlerts !== 1 ? "s" : ""} pendiente${totalAlerts !== 1 ? "s" : ""}`
                : "No hay alertas"}
          </p>
        </div>

        <ScrollArea className="max-h-[400px]">
          {/* Loading state */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin mb-2 opacity-50" />
              <p className="text-sm">Cargando alertas...</p>
            </div>
          )}

          {/* Error state for documents */}
          {!isLoading && errorDocs && (
            <div className="px-4 py-3 text-xs text-red-600 bg-red-50 dark:bg-red-900/10 border-b">
              No se pudieron cargar las alertas de documentos.
            </div>
          )}

          {/* Error state for novedades */}
          {!isLoading && errorNov && (
            <div className="px-4 py-3 text-xs text-blue-600 bg-blue-50 dark:bg-blue-900/10 border-b">
              No se pudieron cargar las novedades preoperacionales.
            </div>
          )}

          {/* Documentos Vencidos */}
          {!isLoading && vencidos > 0 && (
            <div>
              <button
                onClick={() => navigate("/documentos")}
                className="w-full flex items-center gap-3 px-4 py-3 bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors border-b border-red-100 dark:border-red-900/20"
              >
                <div className="flex items-center justify-center h-9 w-9 rounded-full bg-red-100 dark:bg-red-900/30 shrink-0">
                  <FileWarning className="h-4 w-4 text-red-600 dark:text-red-400" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-semibold text-red-700 dark:text-red-400">
                    {vencidos} documento{vencidos !== 1 ? "s" : ""} vencido{vencidos !== 1 ? "s" : ""}
                  </p>
                  <p className="text-xs text-red-600/70 dark:text-red-400/70">
                    Requieren atenci&oacute;n inmediata &mdash; Ver documentos
                  </p>
                </div>
              </button>
            </div>
          )}

          {/* Documentos por Vencer */}
          {!isLoading && porVencer > 0 && (
            <div>
              <button
                onClick={() => navigate("/documentos")}
                className="w-full flex items-center gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-900/10 hover:bg-amber-100 dark:hover:bg-amber-900/20 transition-colors border-b border-amber-100 dark:border-amber-900/20"
              >
                <div className="flex items-center justify-center h-9 w-9 rounded-full bg-amber-100 dark:bg-amber-900/30 shrink-0">
                  <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                    {porVencer} documento{porVencer !== 1 ? "s" : ""} por vencer
                  </p>
                  <p className="text-xs text-amber-600/70 dark:text-amber-400/70">
                    Pr&oacute;ximos a expirar &mdash; Ver documentos
                  </p>
                </div>
              </button>
            </div>
          )}

          {/* Correcciones Pendientes (novedades) */}
          {!isLoading && novedadesCount > 0 && (
            <div>
              <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/10 border-b border-blue-100 dark:border-blue-900/20">
                <Wrench className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">
                  Correcciones Pendientes ({novedadesCount})
                </span>
              </div>
              <div className="divide-y divide-border">
                {(novedades ?? []).slice(0, 5).map((nov, idx) => {
                  const placa = getNovedadPlaca(nov);
                  const conductor = getNovedadConductor(nov);
                  return (
                    <button
                      key={nov._id || nov.id || `novedad-${idx}`}
                      onClick={() => navigate("/preoperativas")}
                      className="w-full text-left px-4 py-2.5 hover:bg-muted/50 transition-colors"
                    >
                      <p className="text-sm font-medium text-foreground truncate">
                        {nov.descripcion || "Novedad preoperacional"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {conductor && <span>{conductor} &middot; </span>}
                        {placa && <span>{placa}</span>}
                      </p>
                    </button>
                  );
                })}
                {novedadesCount > 5 && (
                  <button
                    onClick={() => navigate("/preoperativas")}
                    className="w-full px-4 py-2 text-xs text-blue-600 font-medium hover:bg-muted/50"
                  >
                    +{novedadesCount - 5} m&aacute;s &mdash; Ver todos
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Empty state */}
          {!isLoading && totalAlerts === 0 && !errorDocs && !errorNov && (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Bell className="h-10 w-10 mb-2 opacity-30" />
              <p className="text-sm">Todo en orden</p>
              <p className="text-xs">No hay alertas pendientes</p>
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

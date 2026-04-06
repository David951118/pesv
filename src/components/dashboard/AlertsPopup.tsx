import { useAuth } from "@/hooks/useAuth";
import { getApiRndcBaseUrl } from "@/services/apirndc/apirndc.config";
import { useQuery } from "@tanstack/react-query";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, FileWarning, Clock, Wrench } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ScrollArea } from "@/components/ui/scroll-area";

interface DocumentoAlerta {
  id: number;
  tipo: string;
  nombre?: string;
  entidad?: string;
  placa?: string;
  fechaVencimiento?: string;
  estado?: string;
}

interface DocumentosResponse {
  vencidos: number;
  porVencer: number;
  documentos: DocumentoAlerta[];
}

interface Novedad {
  id: number;
  descripcion?: string;
  placa?: string;
  conductor?: string;
  fecha?: string;
  estado?: string;
}

export function AlertsPopup() {
  const { bearerToken } = useAuth();
  const navigate = useNavigate();

  const { data: docData } = useQuery<DocumentosResponse>({
    queryKey: ["alertas-documentos"],
    queryFn: async () => {
      const base = getApiRndcBaseUrl();
      const res = await fetch(`${base}/api/estadisticas/documentos`, {
        headers: { Authorization: `Bearer ${bearerToken}` },
      });
      if (!res.ok) throw new Error("Error fetching document alerts");
      const json = await res.json();
      return json.data ?? json;
    },
    enabled: !!bearerToken,
    refetchInterval: 5 * 60_000,
    staleTime: 2 * 60_000,
  });

  const { data: novedades } = useQuery<Novedad[]>({
    queryKey: ["alertas-novedades"],
    queryFn: async () => {
      const base = getApiRndcBaseUrl();
      const res = await fetch(`${base}/api/preoperacionales/novedades`, {
        headers: { Authorization: `Bearer ${bearerToken}` },
      });
      if (!res.ok) throw new Error("Error fetching novedades");
      const json = await res.json();
      return json.data ?? json;
    },
    enabled: !!bearerToken,
    refetchInterval: 5 * 60_000,
    staleTime: 2 * 60_000,
  });

  const vencidos = docData?.vencidos ?? 0;
  const porVencer = docData?.porVencer ?? 0;
  const novedadesCount = Array.isArray(novedades) ? novedades.length : 0;
  const totalAlerts = vencidos + porVencer + novedadesCount;

  const docsVencidos = (docData?.documentos ?? []).filter(
    (d) => d.estado === "vencido" || d.estado === "VENCIDO"
  );
  const docsPorVencer = (docData?.documentos ?? []).filter(
    (d) => d.estado === "por_vencer" || d.estado === "POR_VENCER"
  );

  function formatFecha(fecha?: string) {
    if (!fecha) return "";
    try {
      return format(new Date(fecha), "dd MMM yyyy", { locale: es });
    } catch {
      return fecha;
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-nav-foreground hover:bg-nav-hover"
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
            {totalAlerts > 0
              ? `${totalAlerts} alerta${totalAlerts !== 1 ? "s" : ""} pendiente${totalAlerts !== 1 ? "s" : ""}`
              : "No hay alertas"}
          </p>
        </div>

        <ScrollArea className="max-h-[400px]">
          {/* Documentos Vencidos */}
          {vencidos > 0 && (
            <div>
              <div className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/10 border-b border-red-100 dark:border-red-900/20">
                <FileWarning className="h-4 w-4 text-red-600 dark:text-red-400" />
                <span className="text-xs font-semibold text-red-700 dark:text-red-400">
                  Documentos Vencidos ({vencidos})
                </span>
              </div>
              <div className="divide-y divide-border">
                {docsVencidos.slice(0, 5).map((doc) => (
                  <button
                    key={`vencido-${doc.id}`}
                    onClick={() => navigate("/documentos")}
                    className="w-full text-left px-4 py-2.5 hover:bg-muted/50 transition-colors"
                  >
                    <p className="text-sm font-medium text-foreground truncate">
                      {doc.nombre || doc.tipo}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {doc.placa && <span>{doc.placa} &middot; </span>}
                      {doc.entidad && <span>{doc.entidad} &middot; </span>}
                      <span className="text-red-600 dark:text-red-400 font-medium">
                        Venció {formatFecha(doc.fechaVencimiento)}
                      </span>
                    </p>
                  </button>
                ))}
                {docsVencidos.length > 5 && (
                  <button
                    onClick={() => navigate("/documentos")}
                    className="w-full px-4 py-2 text-xs text-red-600 font-medium hover:bg-muted/50"
                  >
                    +{docsVencidos.length - 5} más — Ver todos
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Documentos por Vencer */}
          {porVencer > 0 && (
            <div>
              <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-900/10 border-b border-amber-100 dark:border-amber-900/20">
                <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                  Documentos por Vencer ({porVencer})
                </span>
              </div>
              <div className="divide-y divide-border">
                {docsPorVencer.slice(0, 5).map((doc) => (
                  <button
                    key={`porvencer-${doc.id}`}
                    onClick={() => navigate("/documentos")}
                    className="w-full text-left px-4 py-2.5 hover:bg-muted/50 transition-colors"
                  >
                    <p className="text-sm font-medium text-foreground truncate">
                      {doc.nombre || doc.tipo}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {doc.placa && <span>{doc.placa} &middot; </span>}
                      {doc.entidad && <span>{doc.entidad} &middot; </span>}
                      <span className="text-amber-600 dark:text-amber-400 font-medium">
                        Vence {formatFecha(doc.fechaVencimiento)}
                      </span>
                    </p>
                  </button>
                ))}
                {docsPorVencer.length > 5 && (
                  <button
                    onClick={() => navigate("/documentos")}
                    className="w-full px-4 py-2 text-xs text-amber-600 font-medium hover:bg-muted/50"
                  >
                    +{docsPorVencer.length - 5} más — Ver todos
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Correcciones Pendientes */}
          {novedadesCount > 0 && (
            <div>
              <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/10 border-b border-blue-100 dark:border-blue-900/20">
                <Wrench className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">
                  Correcciones Pendientes ({novedadesCount})
                </span>
              </div>
              <div className="divide-y divide-border">
                {(novedades ?? []).slice(0, 5).map((nov) => (
                  <button
                    key={`novedad-${nov.id}`}
                    onClick={() => navigate("/preoperativas")}
                    className="w-full text-left px-4 py-2.5 hover:bg-muted/50 transition-colors"
                  >
                    <p className="text-sm font-medium text-foreground truncate">
                      {nov.descripcion || "Novedad preoperacional"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {nov.conductor && <span>{nov.conductor} &middot; </span>}
                      {nov.placa && <span>{nov.placa} &middot; </span>}
                      {nov.fecha && (
                        <span className="text-blue-600 dark:text-blue-400 font-medium">
                          {formatFecha(nov.fecha)}
                        </span>
                      )}
                    </p>
                  </button>
                ))}
                {novedadesCount > 5 && (
                  <button
                    onClick={() => navigate("/preoperativas")}
                    className="w-full px-4 py-2 text-xs text-blue-600 font-medium hover:bg-muted/50"
                  >
                    +{novedadesCount - 5} más — Ver todos
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Empty state */}
          {totalAlerts === 0 && (
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

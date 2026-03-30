import { useState } from "react";
import { useApiRndcManifiestos, useManifiestosEstadisticas } from "@/hooks/useApiRndc";
import { isApiRndcEnabled } from "@/services/apirndc/apirndc.config";
import { ContentCard } from "@/components/layout/ContentCard";
import { StatsGrid } from "@/components/layout/StatsGrid";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Loader2, Radio, FileText, CheckCircle2, AlertTriangle, WifiOff } from "lucide-react";
import type { ApiRndcManifiesto } from "@/services/apirndc/apirndc.types";

function getEstadoVariant(estado: string): "success" | "warning" | "danger" | "neutral" {
  switch (estado) {
    case "activo": return "warning";
    case "completado": return "success";
    case "anulado": return "danger";
    default: return "neutral";
  }
}

export function ManifiestosRNDC() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todos");

  const enabled = isApiRndcEnabled();
  const { data: manifiestos, isLoading, isError } = useApiRndcManifiestos(
    { placa: searchTerm || undefined, estado: filtroEstado !== "todos" ? filtroEstado : undefined },
  );
  const { data: statsData } = useManifiestosEstadisticas();

  if (!enabled) {
    return (
      <ContentCard title="Manifiestos RNDC">
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <WifiOff className="h-10 w-10 mb-3" />
          <p className="font-medium">Integración RNDC no habilitada</p>
          <p className="text-sm">Active VITE_APIRNDC_ENABLED en las variables de entorno</p>
        </div>
      </ContentCard>
    );
  }

  const stats = statsData?.data;
  const statsCards = stats
    ? [
        { title: "Total Manifiestos", value: stats.total?.toString() || "0", icon: FileText, iconVariant: "primary" as const },
        { title: "Activos", value: stats.activos?.toString() || "0", icon: Radio, iconVariant: "warning" as const },
        { title: "Monitoreables", value: stats.monitoreables?.toString() || "0", icon: CheckCircle2, iconVariant: "success" as const },
        { title: "No Monitoreables", value: (stats.noMonitoreables || 0).toString(), icon: AlertTriangle, iconVariant: "destructive" as const },
      ]
    : [];

  // Extract manifiestos array from response
  const list: ApiRndcManifiesto[] = Array.isArray(manifiestos)
    ? manifiestos
    : (manifiestos as any)?.data || (manifiestos as any)?.manifiestos || [];

  return (
    <div className="space-y-5">
      {statsCards.length > 0 && <StatsGrid stats={statsCards} columns={4} />}

      <ContentCard
        title="Manifiestos RNDC"
        subtitle="Datos sincronizados desde el sistema de monitoreo"
        headerAction={
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por placa..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-52"
              />
            </div>
            <Select value={filtroEstado} onValueChange={setFiltroEstado}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="activo">Activo</SelectItem>
                <SelectItem value="completado">Completado</SelectItem>
                <SelectItem value="anulado">Anulado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      >
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <WifiOff className="h-10 w-10 mb-3" />
            <p className="font-medium">No se pudo conectar con ApiRdnc</p>
            <p className="text-sm">Verifique que el backend esté corriendo</p>
          </div>
        ) : list.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="h-10 w-10 mx-auto mb-3" />
            <p>No se encontraron manifiestos</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N. Manifiesto</TableHead>
                  <TableHead>Placa</TableHead>
                  <TableHead>Fecha Expedición</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Monitoreable</TableHead>
                  <TableHead>Puntos Control</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((m) => (
                  <TableRow key={m._id || m.ingresoidManifiesto}>
                    <TableCell className="font-mono text-sm">
                      {m.numManifiesto || m.ingresoidManifiesto}
                    </TableCell>
                    <TableCell className="font-semibold">{m.placa}</TableCell>
                    <TableCell>
                      {m.fechaExpedicion
                        ? new Date(m.fechaExpedicion).toLocaleDateString("es-CO")
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={getEstadoVariant(m.estado)} label={m.estado} />
                    </TableCell>
                    <TableCell>
                      {m.esMonitoreable ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Sí
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          {m.motivoNoMonitoreable || "No"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {m.puntosControl?.length || 0}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </ContentCard>
    </div>
  );
}

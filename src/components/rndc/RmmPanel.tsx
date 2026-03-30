import { useState } from "react";
import { useApiRndcRmms, useRmmEstadisticas, useReintentarRmm } from "@/hooks/useApiRndc";
import { isApiRndcEnabled } from "@/services/apirndc/apirndc.config";
import { ContentCard } from "@/components/layout/ContentCard";
import { StatsGrid } from "@/components/layout/StatsGrid";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, RefreshCw, CheckCircle2, Clock, XCircle, AlertTriangle, WifiOff } from "lucide-react";
import { toast } from "sonner";

function getRmmStatusVariant(estado: string): "success" | "warning" | "danger" | "neutral" {
  switch (estado) {
    case "reportado": return "success";
    case "pendiente": case "enviando": return "warning";
    case "error": return "danger";
    case "vencido": return "danger";
    default: return "neutral";
  }
}

export function RmmPanel() {
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const enabled = isApiRndcEnabled();

  const { data: rmms, isLoading, isError } = useApiRndcRmms(
    { estado: filtroEstado !== "todos" ? filtroEstado : undefined },
  );
  const { data: statsData } = useRmmEstadisticas();
  const reintentarMutation = useReintentarRmm();

  if (!enabled) {
    return (
      <ContentCard title="Registros RMM">
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <WifiOff className="h-10 w-10 mb-3" />
          <p className="font-medium">Integración RNDC no habilitada</p>
        </div>
      </ContentCard>
    );
  }

  const stats = statsData?.data;
  const statsCards = stats
    ? [
        { title: "Total RMM", value: stats.total?.toString() || "0", icon: CheckCircle2, iconVariant: "primary" as const },
        { title: "Pendientes", value: stats.pendientes?.toString() || "0", icon: Clock, iconVariant: "warning" as const },
        { title: "Reportados", value: stats.reportados?.toString() || "0", icon: CheckCircle2, iconVariant: "success" as const },
        { title: "Errores", value: stats.errores?.toString() || "0", icon: XCircle, iconVariant: "destructive" as const },
      ]
    : [];

  const list = Array.isArray(rmms) ? rmms : (rmms as any)?.data?.rmms || [];

  const handleReintentar = (id: string) => {
    reintentarMutation.mutate(id, {
      onSuccess: () => toast.success("RMM marcado para reintento"),
      onError: (err: any) => toast.error("Error: " + err.message),
    });
  };

  return (
    <div className="space-y-5">
      {statsCards.length > 0 && <StatsGrid stats={statsCards} columns={4} />}

      <ContentCard
        title="Registros de Monitoreo (RMM)"
        subtitle="Reportes enviados al RNDC sobre puntos de control"
        headerAction={
          <Select value={filtroEstado} onValueChange={setFiltroEstado}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="pendiente">Pendiente</SelectItem>
              <SelectItem value="reportado">Reportado</SelectItem>
              <SelectItem value="error">Error</SelectItem>
              <SelectItem value="vencido">Vencido</SelectItem>
            </SelectContent>
          </Select>
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
          </div>
        ) : list.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <AlertTriangle className="h-10 w-10 mx-auto mb-3" />
            <p>No hay registros RMM</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Placa</TableHead>
                  <TableHead>Punto</TableHead>
                  <TableHead>Llegada</TableHead>
                  <TableHead>Salida</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Radicado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.slice(0, 50).map((rmm: any) => (
                  <TableRow key={rmm._id}>
                    <TableCell className="font-semibold">{rmm.numPlaca}</TableCell>
                    <TableCell className="text-center">{rmm.codigoPuntoControl}</TableCell>
                    <TableCell className="text-sm">
                      {rmm.fechaLlegada} {rmm.horaLlegada}
                    </TableCell>
                    <TableCell className="text-sm">
                      {rmm.fechaSalida} {rmm.horaSalida}
                      {rmm.salidaEstimada && (
                        <span className="ml-1 text-xs text-muted-foreground">(est.)</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={getRmmStatusVariant(rmm.estado)} label={rmm.estado} />
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {rmm.radicadoRNDC || "—"}
                    </TableCell>
                    <TableCell>
                      {rmm.estado === "error" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleReintentar(rmm._id)}
                          disabled={reintentarMutation.isPending}
                        >
                          <RefreshCw className="h-3.5 w-3.5 mr-1" />
                          Reintentar
                        </Button>
                      )}
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

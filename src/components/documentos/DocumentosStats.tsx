import { FileText, CheckCircle, Clock, AlertTriangle, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { getApiRndcBaseUrl } from "@/services/apirndc/apirndc.config";

export function DocumentosStats() {
  const { bearerToken } = useAuth();

  const { data: stats, isLoading } = useQuery({
    queryKey: ["estadisticas-documentos"],
    queryFn: async () => {
      if (!bearerToken) return null;
      const res = await fetch(`${getApiRndcBaseUrl()}/api/estadisticas/documentos`, {
        headers: { Authorization: `Bearer ${bearerToken}` },
      });
      if (!res.ok) return null;
      const json = await res.json();
      return json.data as { total: number; vigentes: number; porVencer: number; vencidos: number } | null;
    },
    enabled: !!bearerToken,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const total = stats?.total ?? 0;
  const vigentes = stats?.vigentes ?? 0;
  const porVencer = stats?.porVencer ?? 0;
  const vencidos = stats?.vencidos ?? 0;

  const cards = [
    { label: "Total Documentos", value: total, icon: FileText, color: "text-primary", bg: "bg-primary/10" },
    { label: "Vigentes", value: vigentes, icon: CheckCircle, color: "text-green-600", bg: "bg-green-600/10" },
    { label: "Por Vencer", value: porVencer, icon: Clock, color: "text-yellow-600", bg: "bg-yellow-600/10" },
    { label: "Vencidos", value: vencidos, icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div key={card.label} className="bg-card border rounded-lg p-4 flex items-center gap-3">
            <div className={`p-2 rounded-lg ${card.bg}`}>
              <Icon className={`h-5 w-5 ${card.color}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{card.value}</p>
              <p className="text-xs text-muted-foreground">{card.label}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

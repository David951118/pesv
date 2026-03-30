import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import { getApiRndcBaseUrl } from "@/services/apirndc/apirndc.config";

export interface EmpresaStatsData {
  empresa: { _id: string; razonSocial: string; nit: string };
  vehiculos: { total: number; porEstado: Record<string, number> };
  terceros: {
    total: number;
    conductores: number;
    propietarios: number;
    administrativos: number;
    porRol: Record<string, number>;
  };
  contratos: { total: number; vigentes: number; porEstado: Record<string, number> };
  preoperacionales: {
    total: number;
    aprobados: number;
    conNovedad: number;
    rechazados: number;
    esteMes: number;
  };
  documentos: {
    total: number;
    vencidos: number;
    porVencer: number;
    vigentes: number;
  };
  generadoEn: string;
}

export function useEmpresaStats() {
  const { bearerToken, empresaId } = useAuth();

  return useQuery<EmpresaStatsData>({
    queryKey: ["empresa-stats", empresaId],
    queryFn: async ({ signal }) => {
      const base = getApiRndcBaseUrl();
      const res = await fetch(`${base}/api/estadisticas/empresa/${empresaId}`, {
        headers: { Authorization: `Bearer ${bearerToken}` },
        signal,
      });
      if (!res.ok) throw new Error(`Stats fetch failed: ${res.status}`);
      const json = await res.json();
      if (!json.success) throw new Error("API error");
      return json.data;
    },
    enabled: !!empresaId && !!bearerToken,
    staleTime: 2 * 60_000,
    refetchInterval: 5 * 60_000,
  });
}

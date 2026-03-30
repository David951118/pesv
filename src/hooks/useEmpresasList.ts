import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import { getApiRndcBaseUrl } from "@/services/apirndc/apirndc.config";

export interface EmpresaListItem {
  _id: string;
  nit: string;
  razonSocial: string;
}

export function useEmpresasList() {
  const { bearerToken } = useAuth();

  return useQuery({
    queryKey: ["empresas-list"],
    queryFn: async () => {
      if (!bearerToken) return [];
      const res = await fetch(`${getApiRndcBaseUrl()}/api/empresas/list`, {
        headers: { Authorization: `Bearer ${bearerToken}` },
      });
      if (!res.ok) return [];
      const json = await res.json();
      return (json.data ?? []) as EmpresaListItem[];
    },
    enabled: !!bearerToken,
    staleTime: 5 * 60 * 1000,
  });
}

/** Helper: map empresaId (or populated object) to razonSocial */
export function getEmpresaName(empresas: EmpresaListItem[], idOrObj?: string | { _id: string; razonSocial?: string }): string {
  if (!idOrObj) return "—";
  if (typeof idOrObj === "object") return idOrObj.razonSocial || idOrObj._id;
  const empresa = empresas.find((e) => e._id === idOrObj);
  return empresa?.razonSocial ?? idOrObj;
}

/**
 * React Query hooks for ApiRdnc data.
 *
 * All data flows through the backend API via Vite proxy.
 * Hooks are disabled when ApiRdnc integration is turned off.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getVehiculos,
  getVehiculoById,
  getTerceros,
  getTerceroById,
  getEmpresas,
  getManifiestos,
  getManifiestoById,
  getManifiestosEstadisticas,
  getRmms,
  getRmmEstadisticas,
  reintentarRmm,
  getContratos,
  getDocumentos,
  getDocumentosByEntidad,
  getDocumentoById,
  createDocumento,
  updateDocumento,
  deleteDocumento,
  restoreDocumento,
  hardDeleteDocumento,
  getPreoperacionales,
  getGlobalStats,
  getApiRndcStatus,
  getPresignedUrl,
  getVehiculosList,
  getTercerosList,
  getEmpresasList,
} from '@/services/apirndc';
import { isApiRndcEnabled } from '@/services/apirndc/apirndc.config';

// ─── Health ───

export function useApiRndcStatus() {
  return useQuery({
    queryKey: ['apirndc-status'],
    queryFn: ({ signal }) => getApiRndcStatus(signal),
    enabled: isApiRndcEnabled(),
    refetchInterval: 60_000,
    retry: 1,
  });
}

// ─── Global Stats ───

export function useGlobalStats() {
  return useQuery({
    queryKey: ['apirndc-global-stats'],
    queryFn: ({ signal }) => getGlobalStats(signal),
    enabled: isApiRndcEnabled(),
    refetchInterval: 2 * 60_000,
    staleTime: 60_000,
  });
}

// ─── Vehiculos ───

export function useApiRndcVehiculos(params?: { placa?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['apirndc-vehiculos', params],
    queryFn: ({ signal }) => getVehiculos(params, signal),
    enabled: isApiRndcEnabled(),
  });
}

export function useApiRndcVehiculo(id: string | undefined) {
  return useQuery({
    queryKey: ['apirndc-vehiculo', id],
    queryFn: ({ signal }) => getVehiculoById(id!, signal),
    enabled: isApiRndcEnabled() && !!id,
  });
}

// ─── Terceros ───

export function useApiRndcTerceros(params?: { rol?: string; search?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['apirndc-terceros', params],
    queryFn: ({ signal }) => getTerceros(params, signal),
    enabled: isApiRndcEnabled(),
  });
}

export function useApiRndcTercero(id: string | undefined) {
  return useQuery({
    queryKey: ['apirndc-tercero', id],
    queryFn: ({ signal }) => getTerceroById(id!, signal),
    enabled: isApiRndcEnabled() && !!id,
  });
}

// ─── Empresas ───

export function useApiRndcEmpresas(params?: { search?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['apirndc-empresas', params],
    queryFn: ({ signal }) => getEmpresas(params, signal),
    enabled: isApiRndcEnabled(),
  });
}

// ─── Manifiestos ───

export function useApiRndcManifiestos(params?: { placa?: string; estado?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['apirndc-manifiestos', params],
    queryFn: ({ signal }) => getManifiestos(params, signal),
    enabled: isApiRndcEnabled(),
    refetchInterval: 5 * 60_000,
  });
}

export function useApiRndcManifiesto(id: string | undefined) {
  return useQuery({
    queryKey: ['apirndc-manifiesto', id],
    queryFn: ({ signal }) => getManifiestoById(id!, signal),
    enabled: isApiRndcEnabled() && !!id,
  });
}

export function useManifiestosEstadisticas() {
  return useQuery({
    queryKey: ['apirndc-manifiestos-stats'],
    queryFn: ({ signal }) => getManifiestosEstadisticas(signal),
    enabled: isApiRndcEnabled(),
    refetchInterval: 5 * 60_000,
  });
}

// ─── RMM ───

export function useApiRndcRmms(params?: { estado?: string; placa?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['apirndc-rmms', params],
    queryFn: ({ signal }) => getRmms(params, signal),
    enabled: isApiRndcEnabled(),
    refetchInterval: 60_000,
  });
}

export function useRmmEstadisticas() {
  return useQuery({
    queryKey: ['apirndc-rmm-stats'],
    queryFn: ({ signal }) => getRmmEstadisticas(signal),
    enabled: isApiRndcEnabled(),
    refetchInterval: 5 * 60_000,
  });
}

export function useReintentarRmm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => reintentarRmm(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apirndc-rmms'] });
      queryClient.invalidateQueries({ queryKey: ['apirndc-rmm-stats'] });
    },
  });
}

// ─── Contratos FUEC ───

export function useApiRndcContratos(params?: { estado?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['apirndc-contratos', params],
    queryFn: ({ signal }) => getContratos(params, signal),
    enabled: isApiRndcEnabled(),
  });
}

// ─── Documentos ───

export function useApiRndcDocumentos(params?: { entidadId?: string; entidadModelo?: string; tipoDocumento?: string; estado?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['apirndc-documentos', params],
    queryFn: ({ signal }) => getDocumentos(params, signal),
    enabled: isApiRndcEnabled(),
  });
}

export function useApiRndcDocumentosByEntidad(entidadId: string | undefined) {
  return useQuery({
    queryKey: ['apirndc-documentos-entidad', entidadId],
    queryFn: ({ signal }) => getDocumentosByEntidad(entidadId!, signal),
    enabled: isApiRndcEnabled() && !!entidadId,
  });
}

export function useApiRndcDocumento(id: string | undefined) {
  return useQuery({
    queryKey: ['apirndc-documento', id],
    queryFn: ({ signal }) => getDocumentoById(id!, signal),
    enabled: isApiRndcEnabled() && !!id,
  });
}

export function useCreateDocumento() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) => createDocumento(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apirndc-documentos'] });
      queryClient.invalidateQueries({ queryKey: ['apirndc-global-stats'] });
    },
  });
}

export function useUpdateDocumento() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      updateDocumento(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apirndc-documentos'] });
      queryClient.invalidateQueries({ queryKey: ['apirndc-documento'] });
      queryClient.invalidateQueries({ queryKey: ['apirndc-global-stats'] });
    },
  });
}

export function useDeleteDocumento() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteDocumento(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apirndc-documentos'] });
      queryClient.invalidateQueries({ queryKey: ['apirndc-global-stats'] });
    },
  });
}

export function useRestoreDocumento() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => restoreDocumento(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apirndc-documentos'] });
      queryClient.invalidateQueries({ queryKey: ['apirndc-global-stats'] });
    },
  });
}

export function useHardDeleteDocumento() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => hardDeleteDocumento(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apirndc-documentos'] });
      queryClient.invalidateQueries({ queryKey: ['apirndc-global-stats'] });
    },
  });
}

// ─── Preoperacionales ───

export function useApiRndcPreoperacionales(params?: { vehiculoId?: string; conductorId?: string; estadoGeneral?: string }) {
  return useQuery({
    queryKey: ['apirndc-preoperacionales', params],
    queryFn: ({ signal }) => getPreoperacionales(params, signal),
    enabled: isApiRndcEnabled(),
  });
}

// ─── Presigned URL (S3 upload) ───

export function usePresignedUrl() {
  return useMutation({
    mutationFn: (payload: { fileName: string; mimeType: string }) =>
      getPresignedUrl(payload),
  });
}

// ─── Lightweight List Endpoints ───

export function useVehiculosList() {
  return useQuery({
    queryKey: ['apirndc-vehiculos-list'],
    queryFn: ({ signal }) => getVehiculosList(signal),
    enabled: isApiRndcEnabled(),
    staleTime: 5 * 60_000,
  });
}

export function useTercerosList() {
  return useQuery({
    queryKey: ['apirndc-terceros-list'],
    queryFn: ({ signal }) => getTercerosList(signal),
    enabled: isApiRndcEnabled(),
    staleTime: 5 * 60_000,
  });
}

export function useEmpresasList() {
  return useQuery({
    queryKey: ['apirndc-empresas-list'],
    queryFn: ({ signal }) => getEmpresasList(signal),
    enabled: isApiRndcEnabled(),
    staleTime: 5 * 60_000,
  });
}

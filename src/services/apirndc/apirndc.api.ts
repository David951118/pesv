/**
 * High-level ApiRdnc API methods.
 *
 * All calls go through the backend API via Vite proxy.
 */
import { apirndcProxyCall } from './apirndc.client';
import type {
  ApiRndcVehiculo,
  ApiRndcTercero,
  ApiRndcEmpresa,
  ApiRndcManifiesto,
  ApiRndcRegistroRMM,
  ApiRndcContratoFUEC,
  ApiRndcDocumento,
  ApiRndcPreoperacional,
  GlobalStats,
  ApiRndcPaginatedResponse,
} from './apirndc.types';

// ─── Vehiculos ───

export async function getVehiculos(
  params?: { placa?: string; page?: number; limit?: number; includeDeleted?: boolean },
  signal?: AbortSignal,
) {
  return apirndcProxyCall<ApiRndcPaginatedResponse<ApiRndcVehiculo[]>>(
    'GET', '/vehiculos', params as Record<string, unknown>, signal,
  );
}

export async function getVehiculoById(id: string, signal?: AbortSignal) {
  return apirndcProxyCall<{ success: boolean; data: ApiRndcVehiculo }>(
    'GET', `/vehiculos/${id}`, undefined, signal,
  );
}

// ─── Terceros (conductores, propietarios, clientes) ───

export async function getTerceros(
  params?: { rol?: string; search?: string; page?: number; limit?: number },
  signal?: AbortSignal,
) {
  return apirndcProxyCall<ApiRndcPaginatedResponse<ApiRndcTercero[]>>(
    'GET', '/terceros', params as Record<string, unknown>, signal,
  );
}

export async function getTerceroById(id: string, signal?: AbortSignal) {
  return apirndcProxyCall<{ success: boolean; data: ApiRndcTercero }>(
    'GET', `/terceros/${id}`, undefined, signal,
  );
}

export async function getTercerosByEmpresa(empresaId: string, signal?: AbortSignal) {
  return apirndcProxyCall<ApiRndcPaginatedResponse<ApiRndcTercero[]>>(
    'GET', `/terceros/empresa/${empresaId}`, undefined, signal,
  );
}

// ─── Empresas ───

export async function getEmpresas(
  params?: { search?: string; page?: number; limit?: number },
  signal?: AbortSignal,
) {
  return apirndcProxyCall<ApiRndcPaginatedResponse<ApiRndcEmpresa[]>>(
    'GET', '/empresas', params as Record<string, unknown>, signal,
  );
}

export async function getEmpresaById(id: string, signal?: AbortSignal) {
  return apirndcProxyCall<{ success: boolean; data: ApiRndcEmpresa }>(
    'GET', `/empresas/${id}`, undefined, signal,
  );
}

// ─── Manifiestos ───

export async function getManifiestos(
  params?: { placa?: string; estado?: string; page?: number; limit?: number },
  signal?: AbortSignal,
) {
  return apirndcProxyCall<{ success: boolean; data: { manifiestos: ApiRndcManifiesto[] } }>(
    'GET', '/manifiestos', params as Record<string, unknown>, signal,
  );
}

export async function getManifiestoById(id: string, signal?: AbortSignal) {
  return apirndcProxyCall<{ success: boolean; data: { manifiesto: ApiRndcManifiesto; rmms: ApiRndcRegistroRMM[] } }>(
    'GET', `/manifiestos/${id}`, undefined, signal,
  );
}

export async function getManifiestosEstadisticas(signal?: AbortSignal) {
  return apirndcProxyCall<{ success: boolean; data: Record<string, unknown> }>(
    'GET', '/manifiestos/estadisticas', undefined, signal,
  );
}

// ─── RMM (Reportes de Monitoreo) ───

export async function getRmms(
  params?: { estado?: string; placa?: string; page?: number; limit?: number },
  signal?: AbortSignal,
) {
  return apirndcProxyCall<{ success: boolean; data: { rmms: ApiRndcRegistroRMM[]; pagination: Record<string, unknown> } }>(
    'GET', '/rmm', params as Record<string, unknown>, signal,
  );
}

export async function getRmmEstadisticas(signal?: AbortSignal) {
  return apirndcProxyCall<{ success: boolean; data: Record<string, unknown> }>(
    'GET', '/rmm/estadisticas', undefined, signal,
  );
}

export async function reintentarRmm(id: string, signal?: AbortSignal) {
  return apirndcProxyCall<{ success: boolean }>(
    'POST', `/rmm/${id}/reintentar`, undefined, signal,
  );
}

// ─── Contratos FUEC ───

export async function getContratos(
  params?: { estado?: string; page?: number; limit?: number },
  signal?: AbortSignal,
) {
  return apirndcProxyCall<ApiRndcPaginatedResponse<ApiRndcContratoFUEC[]>>(
    'GET', '/contratos', params as Record<string, unknown>, signal,
  );
}

export async function getContratoById(id: string, signal?: AbortSignal) {
  return apirndcProxyCall<{ success: boolean; data: ApiRndcContratoFUEC }>(
    'GET', `/contratos/${id}`, undefined, signal,
  );
}

// ─── Documentos ───

export async function getDocumentos(
  params?: { entidadId?: string; entidadModelo?: string; tipoDocumento?: string; estado?: string; page?: number; limit?: number },
  signal?: AbortSignal,
) {
  return apirndcProxyCall<ApiRndcPaginatedResponse<ApiRndcDocumento[]>>(
    'GET', '/documentos', params as Record<string, unknown>, signal,
  );
}

export async function getDocumentosByEntidad(entidadId: string, signal?: AbortSignal) {
  return apirndcProxyCall<{ success: boolean; data: ApiRndcDocumento[] }>(
    'GET', `/documentos/entidad/${entidadId}`, undefined, signal,
  );
}

export async function getDocumentoById(id: string, signal?: AbortSignal) {
  return apirndcProxyCall<{ success: boolean; data: ApiRndcDocumento }>(
    'GET', `/documentos/${id}`, undefined, signal,
  );
}

export async function createDocumento(
  payload: Record<string, unknown>,
  signal?: AbortSignal,
) {
  return apirndcProxyCall<{ success: boolean; data: ApiRndcDocumento }>(
    'POST', '/documentos', payload, signal,
  );
}

export async function updateDocumento(
  id: string,
  payload: Record<string, unknown>,
  signal?: AbortSignal,
) {
  return apirndcProxyCall<{ success: boolean; data: ApiRndcDocumento }>(
    'PUT', `/documentos/${id}`, payload, signal,
  );
}

export async function deleteDocumento(id: string, signal?: AbortSignal) {
  return apirndcProxyCall<{ success: boolean }>(
    'DELETE', `/documentos/${id}`, undefined, signal,
  );
}

export async function restoreDocumento(id: string, signal?: AbortSignal) {
  return apirndcProxyCall<{ success: boolean }>(
    'POST', `/documentos/${id}/restore`, undefined, signal,
  );
}

export async function hardDeleteDocumento(id: string, signal?: AbortSignal) {
  return apirndcProxyCall<{ success: boolean }>(
    'DELETE', `/documentos/${id}/hard`, undefined, signal,
  );
}

export async function getPresignedUrl(
  payload: { fileName: string; mimeType: string },
  signal?: AbortSignal,
) {
  return apirndcProxyCall<{ success: boolean; data: { uploadUrl: string; key: string; publicUrl: string } }>(
    'POST', '/documentos/presigned-url', payload as Record<string, unknown>, signal,
  );
}

// ─── Lightweight List Endpoints ───

export async function getVehiculosList(signal?: AbortSignal) {
  return apirndcProxyCall<{ success: boolean; data: { _id: string; placa: string; marca?: string; linea?: string }[] }>(
    'GET', '/vehiculos/list', undefined, signal,
  );
}

export async function getTercerosList(signal?: AbortSignal) {
  return apirndcProxyCall<{ success: boolean; data: { _id: string; nombres?: string; apellidos?: string; identificacion: string }[] }>(
    'GET', '/terceros/list', undefined, signal,
  );
}

export async function getEmpresasList(signal?: AbortSignal) {
  return apirndcProxyCall<{ success: boolean; data: { _id: string; razonSocial: string; nit: string }[] }>(
    'GET', '/empresas/list', undefined, signal,
  );
}

// ─── Preoperacionales ───

export async function getPreoperacionales(
  params?: { vehiculoId?: string; conductorId?: string; estadoGeneral?: string; page?: number; limit?: number },
  signal?: AbortSignal,
) {
  return apirndcProxyCall<ApiRndcPaginatedResponse<ApiRndcPreoperacional[]>>(
    'GET', '/preoperacionales', params as Record<string, unknown>, signal,
  );
}

// ─── Estadisticas Globales ───

export async function getGlobalStats(signal?: AbortSignal) {
  return apirndcProxyCall<{ success: boolean; data: GlobalStats }>(
    'GET', '/estadisticas/global', undefined, signal,
  );
}

export async function getEmpresaStats(empresaId: string, signal?: AbortSignal) {
  return apirndcProxyCall<{ success: boolean; data: Record<string, unknown> }>(
    'GET', `/estadisticas/empresa/${empresaId}`, undefined, signal,
  );
}

// ─── Health / Status ───

export async function getApiRndcStatus(signal?: AbortSignal) {
  return apirndcProxyCall<{ status: string; collections: Record<string, number> }>(
    'GET', '/status', undefined, signal,
  );
}

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
  ApiRndcKilometraje,
  ApiRndcPlanMantenimiento,
  ApiRndcPlanMantenimientoPayload,
  ApiRndcOrdenTrabajo,
  ApiRndcOrdenTrabajoCreatePayload,
  ApiRndcOrdenTrabajoCerrarPayload,
  ApiRndcOtActividad,
  ApiRndcOtRepuesto,
  ApiRndcOtManoDeObra,
  ApiRndcOtPrioridad,
  ApiRndcAlertasResponse,
  ApiRndcHistorialMantenimiento,
  ApiRndcRepuesto,
  ApiRndcRepuestoCreatePayload,
  ApiRndcRepuestoUpdatePayload,
  ApiRndcMovimientoInventario,
  ApiRndcMovimientoInventarioCreatePayload,
  ApiRndcConsumoInventario,
  ApiRndcRuta,
  ApiRndcRutaPayload,
  ApiRndcViaje,
  ApiRndcViajeCreatePayload,
  ApiRndcViajeIniciarPayload,
  ApiRndcViajeFinalizarPayload,
  ApiRndcTanqueo,
  ApiRndcTanqueoCreatePayload,
  ApiRndcRendimientoCombustible,
  ApiRndcKpisGerenciales,
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

export async function createVehiculo(payload: Record<string, unknown>) {
  return apirndcProxyCall<{ success: boolean; data: ApiRndcVehiculo }>(
    'POST', '/vehiculos', payload,
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

export async function getKpisGerenciales(
  params?: { desde?: string; hasta?: string; empresa?: string },
  signal?: AbortSignal,
) {
  return apirndcProxyCall<{ success: boolean; data: ApiRndcKpisGerenciales | null; generadoEn?: string }>(
    'GET', '/estadisticas/kpis', params as Record<string, unknown>, signal,
  );
}

// ─── Mantenimiento: Kilometraje ───

export async function getVehiculoKilometraje(
  idOrPlaca: string,
  params?: { actualizar?: boolean },
  signal?: AbortSignal,
) {
  return apirndcProxyCall<{ success: boolean; data: ApiRndcKilometraje }>(
    'GET', `/vehiculos/${idOrPlaca}/kilometraje`, params as Record<string, unknown>, signal,
  );
}

// ─── Mantenimiento: Planes ───

export async function getPlanesMantenimiento(signal?: AbortSignal) {
  return apirndcProxyCall<{ success: boolean; data: ApiRndcPlanMantenimiento[] }>(
    'GET', '/mantenimiento/planes', undefined, signal,
  );
}

export async function getPlanMantenimientoById(id: string, signal?: AbortSignal) {
  return apirndcProxyCall<{ success: boolean; data: ApiRndcPlanMantenimiento }>(
    'GET', `/mantenimiento/planes/${id}`, undefined, signal,
  );
}

export async function createPlanMantenimiento(
  payload: ApiRndcPlanMantenimientoPayload,
  signal?: AbortSignal,
) {
  return apirndcProxyCall<{ success: boolean; data: ApiRndcPlanMantenimiento }>(
    'POST', '/mantenimiento/planes', payload as unknown as Record<string, unknown>, signal,
  );
}

export async function updatePlanMantenimiento(
  id: string,
  payload: Partial<ApiRndcPlanMantenimientoPayload>,
  signal?: AbortSignal,
) {
  return apirndcProxyCall<{ success: boolean; data: ApiRndcPlanMantenimiento }>(
    'PUT', `/mantenimiento/planes/${id}`, payload as unknown as Record<string, unknown>, signal,
  );
}

export async function deletePlanMantenimiento(id: string, signal?: AbortSignal) {
  return apirndcProxyCall<{ success: boolean }>(
    'DELETE', `/mantenimiento/planes/${id}`, undefined, signal,
  );
}

// ─── Mantenimiento: Órdenes de Trabajo ───

export async function getOrdenesTrabajo(
  params?: { estado?: string; tipo?: string; vehiculo?: string; page?: number; limit?: number },
  signal?: AbortSignal,
) {
  return apirndcProxyCall<{ success: boolean; data: ApiRndcOrdenTrabajo[]; total: number; page: number; pages: number }>(
    'GET', '/mantenimiento/ordenes', params as Record<string, unknown>, signal,
  );
}

export async function getOrdenTrabajoById(id: string, signal?: AbortSignal) {
  return apirndcProxyCall<{ success: boolean; data: ApiRndcOrdenTrabajo }>(
    'GET', `/mantenimiento/ordenes/${id}`, undefined, signal,
  );
}

export async function createOrdenTrabajo(
  payload: ApiRndcOrdenTrabajoCreatePayload,
  signal?: AbortSignal,
) {
  return apirndcProxyCall<{ success: boolean; data: ApiRndcOrdenTrabajo }>(
    'POST', '/mantenimiento/ordenes', payload as unknown as Record<string, unknown>, signal,
  );
}

export async function updateOrdenTrabajo(
  id: string,
  payload: {
    descripcion?: string;
    prioridad?: ApiRndcOtPrioridad;
    taller?: string;
    fechaProgramada?: string;
    kilometraje?: number;
    actividades?: ApiRndcOtActividad[];
    repuestos?: ApiRndcOtRepuesto[];
    manoDeObra?: ApiRndcOtManoDeObra;
  },
  signal?: AbortSignal,
) {
  return apirndcProxyCall<{ success: boolean; data: ApiRndcOrdenTrabajo }>(
    'PUT', `/mantenimiento/ordenes/${id}`, payload as unknown as Record<string, unknown>, signal,
  );
}

export async function asignarOrdenTrabajo(
  id: string,
  payload: { mecanico?: string; taller?: string; fechaProgramada?: string },
  signal?: AbortSignal,
) {
  return apirndcProxyCall<{ success: boolean; data: ApiRndcOrdenTrabajo }>(
    'POST', `/mantenimiento/ordenes/${id}/asignar`, payload as Record<string, unknown>, signal,
  );
}

export async function iniciarOrdenTrabajo(id: string, signal?: AbortSignal) {
  return apirndcProxyCall<{ success: boolean; data: ApiRndcOrdenTrabajo }>(
    'POST', `/mantenimiento/ordenes/${id}/iniciar`, undefined, signal,
  );
}

export async function cerrarOrdenTrabajo(
  id: string,
  payload: ApiRndcOrdenTrabajoCerrarPayload,
  signal?: AbortSignal,
) {
  return apirndcProxyCall<{ success: boolean; data: ApiRndcOrdenTrabajo }>(
    'POST', `/mantenimiento/ordenes/${id}/cerrar`, payload as unknown as Record<string, unknown>, signal,
  );
}

export async function anularOrdenTrabajo(
  id: string,
  payload?: { motivo?: string },
  signal?: AbortSignal,
) {
  return apirndcProxyCall<{ success: boolean; data: ApiRndcOrdenTrabajo }>(
    'POST', `/mantenimiento/ordenes/${id}/anular`, payload as Record<string, unknown>, signal,
  );
}

/** Borra una orden de trabajo. El backend lo restringe a ROLE_ADMIN. */
export async function eliminarOrdenTrabajo(
  id: string,
  payload?: { motivo?: string },
  signal?: AbortSignal,
) {
  return apirndcProxyCall<{ success: boolean; message?: string }>(
    'DELETE', `/mantenimiento/ordenes/${id}`, payload as Record<string, unknown>, signal,
  );
}

// ─── Mantenimiento: Alertas ───

export async function getAlertasMantenimiento(
  params?: { rapido?: boolean; todas?: boolean; vehiculo?: string },
  signal?: AbortSignal,
) {
  return apirndcProxyCall<ApiRndcAlertasResponse>(
    'GET', '/mantenimiento/alertas', params as Record<string, unknown>, signal,
  );
}

// ─── Mantenimiento: Historial ───

export async function getHistorialMantenimiento(
  vehiculoId: string,
  params?: { anio?: number },
  signal?: AbortSignal,
) {
  return apirndcProxyCall<{ success: boolean; data: ApiRndcHistorialMantenimiento }>(
    'GET', `/mantenimiento/historial/${vehiculoId}`, params as Record<string, unknown>, signal,
  );
}

// ─── Inventario: Repuestos ───

export async function getRepuestos(
  params?: { q?: string; categoria?: string; bajoStock?: boolean; activo?: boolean; page?: number; limit?: number },
  signal?: AbortSignal,
) {
  return apirndcProxyCall<{ success: boolean; data: ApiRndcRepuesto[]; total: number; page: number; pages: number }>(
    'GET', '/inventario/repuestos', params as Record<string, unknown>, signal,
  );
}

export async function getRepuestoById(id: string, signal?: AbortSignal) {
  return apirndcProxyCall<{ success: boolean; data: ApiRndcRepuesto }>(
    'GET', `/inventario/repuestos/${id}`, undefined, signal,
  );
}

export async function createRepuesto(
  payload: ApiRndcRepuestoCreatePayload,
  signal?: AbortSignal,
) {
  return apirndcProxyCall<{ success: boolean; data: ApiRndcRepuesto }>(
    'POST', '/inventario/repuestos', payload as unknown as Record<string, unknown>, signal,
  );
}

export async function updateRepuesto(
  id: string,
  payload: ApiRndcRepuestoUpdatePayload,
  signal?: AbortSignal,
) {
  return apirndcProxyCall<{ success: boolean; data: ApiRndcRepuesto }>(
    'PUT', `/inventario/repuestos/${id}`, payload as unknown as Record<string, unknown>, signal,
  );
}

export async function deleteRepuesto(id: string, signal?: AbortSignal) {
  return apirndcProxyCall<{ success: boolean }>(
    'DELETE', `/inventario/repuestos/${id}`, undefined, signal,
  );
}

// ─── Inventario: Movimientos (kardex) ───

export async function getMovimientosInventario(
  params?: {
    repuesto?: string;
    tipo?: string;
    vehiculo?: string;
    ordenTrabajo?: string;
    desde?: string;
    hasta?: string;
    page?: number;
    limit?: number;
  },
  signal?: AbortSignal,
) {
  return apirndcProxyCall<{ success: boolean; data: ApiRndcMovimientoInventario[]; total: number; page: number; pages: number }>(
    'GET', '/inventario/movimientos', params as Record<string, unknown>, signal,
  );
}

export async function createMovimientoInventario(
  payload: ApiRndcMovimientoInventarioCreatePayload,
  signal?: AbortSignal,
) {
  return apirndcProxyCall<{ success: boolean; data: ApiRndcMovimientoInventario }>(
    'POST', '/inventario/movimientos', payload as unknown as Record<string, unknown>, signal,
  );
}

// ─── Inventario: Alertas de stock ───

export async function getAlertasStock(signal?: AbortSignal) {
  return apirndcProxyCall<{ success: boolean; total: number; data: ApiRndcRepuesto[] }>(
    'GET', '/inventario/alertas-stock', undefined, signal,
  );
}

// ─── Inventario: Consumos por vehículo ───

export async function getConsumosInventario(
  params?: { vehiculo?: string; anio?: number },
  signal?: AbortSignal,
) {
  return apirndcProxyCall<{ success: boolean; data: ApiRndcConsumoInventario[] }>(
    'GET', '/inventario/consumos', params as Record<string, unknown>, signal,
  );
}

// ─── Operación: Rutas ───

export async function getRutas(
  params?: { soloEliminadas?: boolean; search?: string },
  signal?: AbortSignal,
) {
  return apirndcProxyCall<{ success: boolean; data: ApiRndcRuta[] }>(
    'GET', '/rutas', params as Record<string, unknown> | undefined, signal,
  );
}

export async function createRuta(payload: ApiRndcRutaPayload, signal?: AbortSignal) {
  return apirndcProxyCall<{ success: boolean; data: ApiRndcRuta }>(
    'POST', '/rutas', payload as unknown as Record<string, unknown>, signal,
  );
}

export async function updateRuta(
  id: string,
  payload: ApiRndcRutaPayload,
  signal?: AbortSignal,
) {
  return apirndcProxyCall<{ success: boolean; data: ApiRndcRuta }>(
    'PUT', `/rutas/${id}`, payload as unknown as Record<string, unknown>, signal,
  );
}

export async function toggleRutaFavorita(
  id: string,
  favorita?: boolean,
  signal?: AbortSignal,
) {
  return apirndcProxyCall<{ success: boolean; data: ApiRndcRuta }>(
    'PATCH', `/rutas/${id}/favorita`,
    favorita === undefined ? undefined : { favorita },
    signal,
  );
}

export async function deleteRuta(id: string, signal?: AbortSignal) {
  return apirndcProxyCall<{ success: boolean }>(
    'DELETE', `/rutas/${id}`, undefined, signal,
  );
}

export async function restoreRuta(id: string, signal?: AbortSignal) {
  return apirndcProxyCall<{ success: boolean; data: ApiRndcRuta }>(
    'POST', `/rutas/${id}/restore`, undefined, signal,
  );
}

export async function hardDeleteRuta(id: string, signal?: AbortSignal) {
  return apirndcProxyCall<{ success: boolean }>(
    'DELETE', `/rutas/${id}/hard`, undefined, signal,
  );
}

// ─── Operación: Viajes ───

export async function getViajes(
  params?: {
    estado?: string;
    vehiculo?: string;
    conductor?: string;
    desde?: string;
    hasta?: string;
    page?: number;
    limit?: number;
  },
  signal?: AbortSignal,
) {
  return apirndcProxyCall<{ success: boolean; data: ApiRndcViaje[]; total: number; page: number; pages: number }>(
    'GET', '/operacion/viajes', params as Record<string, unknown>, signal,
  );
}

export async function getViajeById(id: string, signal?: AbortSignal) {
  return apirndcProxyCall<{ success: boolean; data: ApiRndcViaje }>(
    'GET', `/operacion/viajes/${id}`, undefined, signal,
  );
}

export async function createViaje(
  payload: ApiRndcViajeCreatePayload,
  signal?: AbortSignal,
) {
  return apirndcProxyCall<{ success: boolean; data: ApiRndcViaje; alertaSobrecarga?: boolean }>(
    'POST', '/operacion/viajes', payload as unknown as Record<string, unknown>, signal,
  );
}

export async function updateViaje(
  id: string,
  payload: Partial<ApiRndcViajeCreatePayload>,
  signal?: AbortSignal,
) {
  return apirndcProxyCall<{ success: boolean; data: ApiRndcViaje; alertaSobrecarga?: boolean }>(
    'PUT', `/operacion/viajes/${id}`, payload as unknown as Record<string, unknown>, signal,
  );
}

export async function iniciarViaje(
  id: string,
  payload?: ApiRndcViajeIniciarPayload,
  signal?: AbortSignal,
) {
  return apirndcProxyCall<{ success: boolean; data: ApiRndcViaje }>(
    'POST', `/operacion/viajes/${id}/iniciar`, payload as unknown as Record<string, unknown>, signal,
  );
}

export async function finalizarViaje(
  id: string,
  payload: ApiRndcViajeFinalizarPayload,
  signal?: AbortSignal,
) {
  return apirndcProxyCall<{ success: boolean; data: ApiRndcViaje }>(
    'POST', `/operacion/viajes/${id}/finalizar`, payload as unknown as Record<string, unknown>, signal,
  );
}

export async function cancelarViaje(
  id: string,
  payload?: { motivo?: string },
  signal?: AbortSignal,
) {
  return apirndcProxyCall<{ success: boolean; data: ApiRndcViaje }>(
    'POST', `/operacion/viajes/${id}/cancelar`, payload as Record<string, unknown>, signal,
  );
}

// ─── Operación: Combustible ───

export async function getTanqueos(
  params?: { vehiculo?: string; desde?: string; hasta?: string; page?: number; limit?: number },
  signal?: AbortSignal,
) {
  return apirndcProxyCall<{ success: boolean; data: ApiRndcTanqueo[]; total: number; page: number; pages: number }>(
    'GET', '/operacion/combustible', params as Record<string, unknown>, signal,
  );
}

export async function createTanqueo(
  payload: ApiRndcTanqueoCreatePayload,
  signal?: AbortSignal,
) {
  return apirndcProxyCall<{ success: boolean; data: ApiRndcTanqueo }>(
    'POST', '/operacion/combustible', payload as unknown as Record<string, unknown>, signal,
  );
}

export async function updateTanqueo(
  id: string,
  payload: Partial<ApiRndcTanqueoCreatePayload>,
  signal?: AbortSignal,
) {
  return apirndcProxyCall<{ success: boolean; data: ApiRndcTanqueo }>(
    'PUT', `/operacion/combustible/${id}`, payload as unknown as Record<string, unknown>, signal,
  );
}

export async function deleteTanqueo(id: string, signal?: AbortSignal) {
  return apirndcProxyCall<{ success: boolean }>(
    'DELETE', `/operacion/combustible/${id}`, undefined, signal,
  );
}

export async function getRendimientoCombustible(
  params?: { vehiculo?: string; desde?: string; hasta?: string },
  signal?: AbortSignal,
) {
  return apirndcProxyCall<{ success: boolean; data: ApiRndcRendimientoCombustible[] }>(
    'GET', '/operacion/combustible/rendimiento', params as Record<string, unknown>, signal,
  );
}

// ─── Health / Status ───

export async function getApiRndcStatus(signal?: AbortSignal) {
  return apirndcProxyCall<{ status: string; collections: Record<string, number> }>(
    'GET', '/status', undefined, signal,
  );
}

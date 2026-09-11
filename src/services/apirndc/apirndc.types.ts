// ─── ApiRdnc Response Types ───
// Maps to Mongoose models in ApiRdnc-main/src/models/

export interface ApiRndcVehiculo {
  _id: string;
  placa: string;
  numeroInterno?: string;
  marca?: string;
  linea?: string;
  modelo?: number;
  color?: string;
  idCellvi?: string;
  claseVehiculo?: string;
  edad?: number;
  modalidad?: string;
  combustible?: string;
  motor?: string;
  chasis?: string;
  cilindraje?: string;
  capacidadPasajeros?: number;
  fechaMatricula?: string;
  propietario?: string | ApiRndcTercero;
  empresaAfiliadora?: string | ApiRndcEmpresa;
  estado: 'ACTIVO' | 'MANTENIMIENTO' | 'INACTIVO' | 'RETIRADO' | 'INMOVILIZADO';
  kilometrajeActual?: number;
  ultimaActualizacionKm?: string;
  mantenimientos?: {
    fecha: string;
    tipo: string;
    descripcion: string;
    kilometraje: number;
    taller: string;
  }[];
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiRndcTercero {
  _id: string;
  identificacion: string;
  tipoId: 'CC' | 'NIT' | 'CE' | 'PEP' | 'PASAPORTE';
  nombres?: string;
  apellidos?: string;
  razonSocial?: string;
  fotoUrl?: string;
  roles: string[];
  rolesSistema?: string[];
  empresa?: string | ApiRndcEmpresa;
  usuarioCellvi?: string;
  estado: 'ACTIVO' | 'INACTIVO' | 'BLOQUEADO';
  contacto?: {
    direccion?: string;
    ciudad?: string;
    telefono?: string;
    email?: string;
  };
  datosConductor?: { tipoSangre?: string };
  datosPropietario?: { observaciones?: string };
  datosCliente?: { sector?: string };
  datosAdministrativo?: {
    celular?: string;
    cargo?: string;
    area?: string;
    fechaIngreso?: string;
  };
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiRndcEmpresa {
  _id: string;
  nit: string;
  razonSocial: string;
  nombreComercial?: string;
  contacto?: {
    direccion?: string;
    ciudad?: string;
    telefono?: string;
    email?: string;
    sitioWeb?: string;
  };
  representanteLegal?: {
    nombres?: string;
    apellidos?: string;
    cedula?: string;
  };
  estado: 'ACTIVA' | 'INACTIVA' | 'SUSPENDIDA';
  tipoEmpresa?: string;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiRndcPuntoControl {
  _id?: string;
  codigoPunto: number;
  codigoMunicipio?: string;
  direccion?: string;
  latitud: number;
  longitud: number;
  radio: number;
  fechaCita?: string;
  horaCita?: string;
  tiempoPactado?: number;
  estado: 'pendiente' | 'en_punto' | 'completado' | 'vencido';
  ajuste?: boolean;
  fechaHoraLlegada?: string;
  latitudLlegada?: number;
  longitudLlegada?: number;
  fechaHoraSalida?: string;
  latitudSalida?: number;
  longitudSalida?: number;
  sinSalida?: boolean;
  rmmId?: string;
  radicadoRNDC?: string;
}

export interface ApiRndcManifiesto {
  _id: string;
  ingresoidManifiesto: string;
  numManifiesto?: string;
  nitEmpresaTransporte?: string;
  placa: string;
  fechaExpedicion?: string;
  vehiculoAsignado: boolean;
  esMonitoreable: boolean;
  motivoNoMonitoreable?: string;
  estado: 'activo' | 'completado' | 'anulado';
  puntosControl: ApiRndcPuntoControl[];
  createdAt: string;
  updatedAt: string;
}

export interface ApiRndcRegistroRMM {
  _id: string;
  manifiestoId: string;
  ingresoidManifiesto: string;
  numPlaca: string;
  codigoPuntoControl: number;
  latitudLlegada?: number;
  longitudLlegada?: number;
  fechaLlegada?: string;
  horaLlegada?: string;
  latitudSalida?: number;
  longitudSalida?: number;
  fechaSalida?: string;
  horaSalida?: string;
  detectadoLlegada?: boolean;
  detectadoSalida?: boolean;
  salidaEstimada?: boolean;
  sinSalida?: boolean;
  estado: 'pendiente' | 'enviando' | 'reportado' | 'vencido' | 'error';
  fechaLimiteReporte?: string;
  intentos: number;
  ultimoIntento?: string;
  radicadoRNDC?: string;
  errorMensaje?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiRndcContratoFUEC {
  _id: string;
  consecutivo: number;
  anio: number;
  numeroFUEC: string;
  contratante?: string | ApiRndcTercero;
  vehiculo?: string | ApiRndcVehiculo;
  conductorPrincipal?: string | ApiRndcTercero;
  conductoresAuxiliares?: string[];
  ruta?: string;
  objetoContrato?: string;
  origen?: string;
  destino?: string;
  recorridoEspecifico?: string;
  vigenciaInicio?: string;
  vigenciaFin?: string;
  estado: 'GENERADO' | 'ACTIVO' | 'FINALIZADO' | 'ANULADO';
  pdfUrl?: string;
  datosSnapshot?: {
    soat?: { numero: string; vigencia: string; aseguradora: string };
    tecnomecanica?: { numero: string; vigencia: string; cda: string };
    rce?: { numero: string; vigencia: string; aseguradora: string };
    rcc?: { numero: string; vigencia: string; aseguradora: string };
    tarjetaOperacion?: { numero: string; vigencia: string };
    licenciaConductor?: { numero: string; vigencia: string; categoria: string };
  };
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiRndcDocumento {
  _id: string;
  entidadId: string;
  entidadModelo: 'Vehiculo' | 'Tercero' | 'Empresa';
  tipoDocumento: string;
  numero?: string;
  entidadEmisora?: string;
  fechaExpedicion?: string;
  fechaVencimiento?: string;
  archivo?: {
    url?: string;
    key?: string;
    mimeType?: string;
    nombreOriginal?: string;
    pesoBytes?: number;
  };
  archivoReverso?: {
    url?: string;
    key?: string;
    mimeType?: string;
    nombreOriginal?: string;
    pesoBytes?: number;
  };
  estado: 'VIGENTE' | 'POR_VENCER' | 'VENCIDO' | 'HISTORICO' | 'RECHAZADO';
  observaciones?: string;
  subidoPor?: string;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiRndcPreoperacional {
  _id: string;
  vehiculo: string | ApiRndcVehiculo;
  conductor: string | ApiRndcTercero;
  fecha: string;
  kilometraje?: number;
  estadoGeneral: 'APROBADO' | 'NOVEDAD' | 'RECHAZADO';
  observaciones?: string;
  firmadoCheck?: boolean;
  firmaConductorUrl?: string;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Statistics ───

export interface GlobalStats {
  manifiestos: { total: number; activos: number; monitoreables: number };
  rmm: { total: number; pendientes: number; reportados: number; errores: number };
  vehiculos: { total: number; activos: number };
  conductores: { total: number };
  contratos: { total: number; activos: number };
  preoperacionales: { total: number; esteMes: number };
  documentos: { total: number; vencidos: number; porVencer: number };
  timestamp: string;
}

// ─── Mantenimiento: Kilometraje ───

export interface ApiRndcKilometrajeFuenteCellvi {
  disponible: boolean;
  odometroRaw?: number;
  odometroKm?: number;
  unidadAsumida?: string;
  motivo?: string;
  momento?: string;
}

export interface ApiRndcKilometrajeFuenteRegistro {
  kilometraje: number;
  fecha?: string;
}

export interface ApiRndcKilometraje {
  placa: string;
  idCellvi?: string;
  kilometraje: number | null;
  fuente: 'CELLVI_GPS' | 'PREOPERACIONAL' | 'MANUAL';
  fecha?: string;
  fuentes: {
    cellvi: ApiRndcKilometrajeFuenteCellvi;
    preoperacional: ApiRndcKilometrajeFuenteRegistro | null;
    manual: ApiRndcKilometrajeFuenteRegistro | null;
  };
}

// ─── Mantenimiento: Planes ───

export interface ApiRndcPlanItem {
  _id?: string;
  nombre: string;
  descripcion?: string;
  intervaloKm?: number;
  intervaloDias?: number;
  umbralAlertaKm?: number;
  umbralAlertaDias?: number;
  // Mantenimiento único a un km objetivo (one-shot)
  unaVez?: boolean;
  kmObjetivo?: number;
}

export interface ApiRndcPlanMantenimiento {
  _id: string;
  nombre: string;
  descripcion?: string;
  vehiculos: { _id: string; placa: string; claseVehiculo?: string }[];
  claseVehiculo?: string;
  aplicaTodos?: boolean;
  items: ApiRndcPlanItem[];
  empresa?: string;
  activo: boolean;
  createdAt: string;
}

export interface ApiRndcPlanMantenimientoPayload {
  nombre: string;
  descripcion?: string;
  vehiculos?: string[];
  claseVehiculo?: string;
  aplicaTodos?: boolean;
  activo?: boolean;
  items: ApiRndcPlanItem[];
  // Empresa dueña del plan (solo ADMIN puede fijarla; null = global)
  empresa?: string | null;
}

// ─── Mantenimiento: Órdenes de Trabajo ───

export type ApiRndcOtTipo = 'PREVENTIVO' | 'CORRECTIVO';
export type ApiRndcOtEstado = 'ABIERTA' | 'ASIGNADA' | 'EN_PROCESO' | 'CERRADA' | 'ANULADA';
export type ApiRndcOtPrioridad = 'BAJA' | 'MEDIA' | 'ALTA' | 'URGENTE';

export interface ApiRndcOtActividad {
  descripcion: string;
  completada: boolean;
}

export interface ApiRndcOtRepuesto {
  nombre: string;
  cantidad: number;
  costoUnitario: number;
}

export interface ApiRndcOtManoDeObra {
  horas?: number;
  costo?: number;
}

/** Factura opcional de la OT: archivo (PDF/imagen) guardado en S3 */
export interface ApiRndcOtFactura {
  url: string;
  key: string;
  nombre?: string;
  mimeType?: string;
  tamano?: number | null;
  subidoPor?: string;
  fecha?: string;
}

export interface ApiRndcOtHistorialEntry {
  fecha: string;
  usuario?: string;
  accion: string;
  detalle?: string;
}

export interface ApiRndcOrdenTrabajo {
  _id: string;
  numero: string;
  vehiculo: { _id: string; placa: string; claseVehiculo?: string } | null;
  placa: string;
  tipo: ApiRndcOtTipo;
  origen?: string;
  estado: ApiRndcOtEstado;
  prioridad: ApiRndcOtPrioridad;
  descripcion: string;
  kilometraje?: number;
  mecanico: { _id: string; nombres?: string; apellidos?: string } | null;
  taller?: string;
  fechaProgramada?: string;
  fechaCierre?: string;
  actividades: ApiRndcOtActividad[];
  repuestos: ApiRndcOtRepuesto[];
  manoDeObra?: ApiRndcOtManoDeObra;
  costoRepuestos?: number;
  costoTotal?: number;
  observacionesCierre?: string;
  factura?: ApiRndcOtFactura | null;
  historial?: ApiRndcOtHistorialEntry[];
  createdAt: string;
}

export interface ApiRndcOrdenTrabajoCreatePayload {
  vehiculo: string;
  tipo: ApiRndcOtTipo;
  descripcion: string;
  prioridad?: ApiRndcOtPrioridad;
  kilometraje?: number;
  mecanico?: string;
  taller?: string;
  fechaProgramada?: string;
  actividades?: ApiRndcOtActividad[];
  repuestos?: ApiRndcOtRepuesto[];
  manoDeObra?: ApiRndcOtManoDeObra;
  plan?: string;
  planItemNombre?: string;
  factura?: ApiRndcOtFactura;
}

export interface ApiRndcOrdenTrabajoCerrarPayload {
  kilometraje?: number;
  observacionesCierre?: string;
  actividades?: ApiRndcOtActividad[];
  repuestos?: ApiRndcOtRepuesto[];
  manoDeObra?: ApiRndcOtManoDeObra;
  taller?: string;
  factura?: ApiRndcOtFactura;
}

// ─── Mantenimiento: Alertas ───

export type ApiRndcAlertaEstado = 'VENCIDO' | 'PROXIMO' | 'SIN_HISTORIAL' | 'OK';

export interface ApiRndcAlertaMantenimiento {
  plan: { id: string; nombre: string };
  vehiculo: { id: string; placa: string; claseVehiculo?: string };
  item: string;
  intervaloKm?: number;
  intervaloDias?: number;
  ultimoServicio: { fecha?: string; kilometraje?: number; ot?: string } | null;
  kmActual?: number | null;
  /** Kilometraje al que toca el proximo servicio (base + intervalo). */
  proximoKm?: number | null;
  kmRestantes?: number | null;
  diasRestantes?: number | null;
  /** Ciclos del intervalo que ya se pasaron sin hacer el mantenimiento. */
  ciclosVencidos?: number;
  sinHistorial?: boolean;
  estimado?: boolean;
  unaVez?: boolean;
  kmObjetivo?: number | null;
  estado: ApiRndcAlertaEstado;
}

export interface ApiRndcAlertasResponse {
  success: boolean;
  total: number;
  resumen: { vencidos: number; proximos: number; sinHistorial: number };
  data: ApiRndcAlertaMantenimiento[];
}

// ─── Mantenimiento: Historial ───

export interface ApiRndcCostosAnio {
  ordenes: number;
  preventivos: number;
  correctivos: number;
  costoManoDeObra: number;
  costoRepuestos: number;
  costoTotal: number;
}

export interface ApiRndcHistorialMantenimiento {
  ordenes: ApiRndcOrdenTrabajo[];
  costosPorAnio: Record<string, ApiRndcCostosAnio>;
}

// ─── Inventario: Repuestos ───

export interface ApiRndcRepuesto {
  _id: string;
  codigo?: string;
  nombre: string;
  descripcion?: string;
  categoria?: string;
  unidad?: string;
  stock: number;
  stockMinimo: number;
  costoUnitario: number;
  proveedor: { _id: string; nombres?: string; apellidos?: string; razonSocial?: string } | null;
  empresa?: string;
  activo: boolean;
  createdAt: string;
}

export interface ApiRndcRepuestoCreatePayload {
  nombre: string;
  codigo?: string;
  descripcion?: string;
  categoria?: string;
  unidad?: string;
  stockInicial?: number;
  stockMinimo?: number;
  costoUnitario?: number;
  proveedor?: string;
  activo?: boolean;
}

export interface ApiRndcRepuestoUpdatePayload {
  nombre?: string;
  codigo?: string;
  descripcion?: string;
  categoria?: string;
  unidad?: string;
  stockMinimo?: number;
  costoUnitario?: number;
  proveedor?: string;
  activo?: boolean;
}

// ─── Inventario: Movimientos (kardex) ───

export type ApiRndcMovimientoTipo = 'ENTRADA' | 'SALIDA' | 'AJUSTE';

export interface ApiRndcMovimientoInventario {
  _id: string;
  repuesto: { _id: string; nombre: string; codigo?: string; unidad?: string };
  tipo: ApiRndcMovimientoTipo;
  cantidad: number;
  costoUnitario?: number;
  stockAnterior: number;
  stockNuevo: number;
  ordenTrabajo: { _id: string; numero: string } | null;
  vehiculo: { _id: string; placa: string } | null;
  placa?: string;
  motivo?: string;
  usuario?: string;
  createdAt: string;
}

export interface ApiRndcMovimientoInventarioCreatePayload {
  repuesto: string;
  tipo: ApiRndcMovimientoTipo;
  cantidad: number;
  costoUnitario?: number;
  ordenTrabajo?: string;
  vehiculo?: string;
  placa?: string;
  motivo?: string;
}

// ─── Inventario: Consumos por vehículo ───

export interface ApiRndcConsumoInventario {
  vehiculo: string | null;
  placa: string;
  anio: number;
  movimientos: number;
  cantidadTotal: number;
  costoTotal: number;
}

// ─── Operación: Rutas ───

export interface ApiRndcRutaPunto {
  orden?: number;
  nombre: string;
  lat?: number | null;
  lng?: number | null;
}

export interface ApiRndcRutaCoord {
  nombre: string;
  lat?: number | null;
  lng?: number | null;
}

export interface ApiRndcRutaTramo {
  orden?: number;
  origen: ApiRndcRutaCoord;
  destino: ApiRndcRutaCoord;
  distanciaKm?: number | null;
}

export interface ApiRndcRuta {
  _id: string;
  nombre: string;
  origen?: string;
  destino?: string;
  tramos?: ApiRndcRutaTramo[];
  puntos?: ApiRndcRutaPunto[];
  recorrido?: string;
  distanciaKm?: number;
  favorita?: boolean;
}

export interface ApiRndcRutaPayload {
  nombre?: string;
  origen?: string;
  destino?: string;
  tramos?: ApiRndcRutaTramo[];
  puntos?: ApiRndcRutaPunto[];
  recorrido?: string;
  distanciaKm?: number;
  favorita?: boolean;
}

// ─── Operación: Viajes ───

export type ApiRndcViajeEstado = 'PROGRAMADO' | 'EN_CURSO' | 'FINALIZADO' | 'CANCELADO';
export type ApiRndcEntregaEstado = 'PENDIENTE' | 'ENTREGADA' | 'FALLIDA' | 'PARCIAL';
export type ApiRndcIncidenciaTipo = 'MECANICA' | 'TRAFICO' | 'ACCIDENTE' | 'CLIMA' | 'SEGURIDAD' | 'OTRO';

export interface ApiRndcViajeCarga {
  pesoKg?: number;
  descripcion?: string;
  sobrecarga?: boolean;
  excesoKg?: number;
}

export interface ApiRndcViajeEntrega {
  _id?: string;
  cliente?: string;
  direccion?: string;
  horaProgramada?: string;
  horaEntrega?: string;
  estado: ApiRndcEntregaEstado;
  observacion?: string;
}

export interface ApiRndcViajeIncidencia {
  _id?: string;
  tipo: ApiRndcIncidenciaTipo;
  descripcion?: string;
  hora?: string;
}

export interface ApiRndcViajeHistorialEntry {
  fecha: string;
  usuario?: string;
  accion: string;
  detalle?: string;
}

export interface ApiRndcViaje {
  _id: string;
  numero: string;
  vehiculo: { _id: string; placa: string } | null;
  placa: string;
  conductor: { _id: string; nombres?: string; apellidos?: string } | null;
  ruta: { _id: string; nombre: string; origen?: string; destino?: string } | null;
  origen?: string;
  destino?: string;
  estado: ApiRndcViajeEstado;
  fechaProgramada?: string;
  fechaSalida?: string;
  fechaLlegada?: string;
  duracionMinutos?: number | null;
  kmInicio?: number | null;
  kmFin?: number | null;
  kmRecorrido?: number | null;
  carga?: ApiRndcViajeCarga;
  entregas: ApiRndcViajeEntrega[];
  incidencias: ApiRndcViajeIncidencia[];
  observaciones?: string;
  historial?: ApiRndcViajeHistorialEntry[];
  createdAt: string;
}

export interface ApiRndcViajeCreatePayload {
  vehiculo: string;
  conductor: string;
  ruta?: string;
  origen?: string;
  destino?: string;
  fechaProgramada?: string;
  kmInicio?: number;
  carga?: { pesoKg?: number; descripcion?: string };
  entregas?: ApiRndcViajeEntrega[];
  incidencias?: ApiRndcViajeIncidencia[];
  observaciones?: string;
}

/**
 * Edición de un viaje existente. El vehículo nunca se cambia. fechaSalida solo
 * aplica a viajes EN_CURSO o FINALIZADOS; fechaLlegada y kmFin solo a FINALIZADOS
 * (el backend rechaza el campo en otro estado).
 */
export interface ApiRndcViajeUpdatePayload {
  conductor?: string;
  ruta?: string | null;
  origen?: string;
  destino?: string;
  fechaProgramada?: string | null;
  fechaSalida?: string | null;
  fechaLlegada?: string | null;
  kmInicio?: number | null;
  kmFin?: number | null;
  carga?: { pesoKg?: number | null; descripcion?: string };
  entregas?: ApiRndcViajeEntrega[];
  incidencias?: ApiRndcViajeIncidencia[];
  observaciones?: string;
}

/** Ajuste del odómetro del vehículo aplicado al corregir el km fin de un viaje finalizado. */
export interface ApiRndcViajeOdometroAjuste {
  anterior: number | null;
  nuevo: number;
}

export interface ApiRndcViajeIniciarPayload {
  kmInicio?: number;
  fechaSalida?: string;
}

export interface ApiRndcViajeFinalizarPayload {
  kmFin: number;
  fechaLlegada?: string;
  observaciones?: string;
  entregas?: ApiRndcViajeEntrega[];
}

// ─── Operación: Combustible ───

export type ApiRndcTipoCombustible = 'GASOLINA' | 'DIESEL' | 'GAS';

export interface ApiRndcTanqueo {
  _id: string;
  vehiculo: { _id: string; placa: string } | null;
  placa: string;
  conductor: { _id: string; nombres?: string; apellidos?: string } | null;
  viaje?: string | null;
  fecha: string;
  kmTanqueo: number;
  galones: number;
  costoTotal?: number;
  costoPorGalon?: number;
  tipoCombustible?: ApiRndcTipoCombustible;
  estacion?: string;
  tanqueLleno?: boolean;
  rendimientoTramo?: number | null;
  createdAt: string;
}

export interface ApiRndcTanqueoCreatePayload {
  vehiculo: string;
  kmTanqueo: number;
  galones: number;
  costoTotal?: number;
  costoPorGalon?: number;
  conductor?: string;
  viaje?: string;
  fecha?: string;
  tipoCombustible?: ApiRndcTipoCombustible;
  estacion?: string;
  tanqueLleno?: boolean;
}

export interface ApiRndcRendimientoCombustible {
  vehiculo: string | null;
  placa: string;
  tanqueos: number;
  galonesTotal: number;
  costoTotal: number;
  kmRecorridos: number;
  rendimientoPromedio: number | null;
  costoPorKm: number | null;
}

// ─── Estadísticas: KPIs Gerenciales ───

export interface ApiRndcRankingVehiculo {
  vehiculo: string | null;
  placa: string;
  marca?: string;
  linea?: string;
  estado?: string;
  costoMantenimiento: number;
  costoManoDeObra: number;
  costoRepuestos: number;
  costoCombustible: number;
  /** valor + grúa + patios de las multas del periodo (sin anuladas) */
  costoMultas: number;
  multas: number;
  inmovilizaciones: number;
  costoTotal: number;
  /** km según la fuente elegida (fuenteKm de la respuesta) */
  kmRecorridos: number;
  /** km de viajes finalizados del periodo */
  kmViajes?: number;
  /** recorrido real por snapshots diarios del odómetro */
  kmOdometro?: number;
  costoPorKm: number | null;
  ordenes: number;
  preventivos: number;
  correctivos: number;
}

/** Con qué kilometraje se calcula el costo por km en los KPIs. */
export type ApiRndcFuenteKm = 'VIAJES' | 'ODOMETRO';

export interface ApiRndcKpisGerenciales {
  fuenteKm?: ApiRndcFuenteKm;
  flota: {
    total: number;
    disponibles: number;
    enMantenimiento: number;
    /** vehículos retenidos por la autoridad (multa con inmovilización vigente) */
    inmovilizados: number;
    disponibilidad: number | null;
  };
  mantenimiento: {
    preventivos: number;
    correctivos: number;
    totalOrdenes: number;
    pctPreventivo: number | null;
    pctCorrectivo: number | null;
  };
  multas: {
    total: number;
    pendientes: number;
    impugnadas: number;
    pagadas: number;
    anuladas: number;
    valorPorPagar: number;
    costoTotal: number;
    inmovilizaciones: number;
    vehiculosInmovilizados: number;
  };
  costos: {
    costoTotalFlota: number;
    costoMantenimientoFlota: number;
    costoCombustibleFlota: number;
    costoMultasFlota: number;
    /** km totales según fuenteKm */
    kmTotalFlota: number;
    kmViajesFlota?: number;
    kmOdometroFlota?: number;
    costoPorKmGlobal: number | null;
  };
  rankingVehiculos: ApiRndcRankingVehiculo[];
}

// ─── Multas / comparendos ───

/** Archivo ya subido a S3 (metadatos que viajan al backend) */
export interface ApiRndcArchivo {
  _id?: string;
  url: string;
  key: string;
  nombre?: string;
  mimeType?: string;
  tamano?: number | null;
  subidoPor?: string;
  fecha?: string;
}

export type ApiRndcMultaEstado = 'PENDIENTE' | 'PAGADA' | 'IMPUGNADA' | 'ANULADA';
export type ApiRndcInmovilizacionEstado =
  | 'NO_APLICA'
  | 'INMOVILIZADO'
  | 'CORRECCION_SUBIDA'
  | 'LEVANTADA';
export type ApiRndcMultaResponsable = 'EMPRESA' | 'CONDUCTOR' | 'PROPIETARIO';

export interface ApiRndcMultaConductorNoRegistrado {
  nombres?: string;
  apellidos?: string;
  tipoId?: string;
  identificacion?: string;
  telefono?: string;
  licencia?: string;
}

export interface ApiRndcMultaInmovilizacion {
  aplica: boolean;
  estado: ApiRndcInmovilizacionEstado;
  fechaInicio?: string | null;
  patio?: string;
  motivo?: string;
  costoGrua?: number;
  costoPatios?: number;
  estadoVehiculoAnterior?: string;
  correccion?: {
    descripcion?: string;
    evidencias?: ApiRndcArchivo[];
    fecha?: string;
    subidoPor?: string;
    subidoPorNombre?: string;
  };
  fechaLevantamiento?: string | null;
  levantadaPor?: string;
  observacionesLevantamiento?: string;
  levantadaForzada?: boolean;
}

export interface ApiRndcMultaHistorialEntry {
  fecha: string;
  usuario?: string;
  accion: string;
  detalle?: string;
}

export interface ApiRndcMulta {
  _id: string;
  numero: string;
  vehiculo: {
    _id: string;
    placa: string;
    numeroInterno?: string;
    marca?: string;
    linea?: string;
    modelo?: number;
    estado?: string;
    empresaAfiliadora?: string;
  } | null;
  placa: string;
  empresa?: string | null;
  conductor: {
    _id: string;
    nombres?: string;
    apellidos?: string;
    identificacion?: string;
    tipoId?: string;
    contacto?: { telefono?: string; email?: string };
  } | null;
  conductorRegistrado: boolean;
  conductorNoRegistrado?: ApiRndcMultaConductorNoRegistrado;
  fecha: string;
  numeroComparendo?: string;
  codigoInfraccion?: string;
  descripcion: string;
  autoridad?: string;
  agente?: string;
  ciudad?: string;
  lugar?: string;
  valor: number;
  fechaLimitePago?: string | null;
  responsable: ApiRndcMultaResponsable;
  estado: ApiRndcMultaEstado;
  pago?: {
    valorPagado?: number;
    fechaPago?: string | null;
    comprobante?: ApiRndcArchivo | null;
    observaciones?: string;
    registradoPor?: string;
  };
  impugnacion?: { motivo?: string; fecha?: string; registradoPor?: string };
  anulacion?: { motivo?: string; fecha?: string; registradoPor?: string };
  fotos: ApiRndcArchivo[];
  inmovilizacion: ApiRndcMultaInmovilizacion;
  /** valor + grúa + patios */
  costoTotal: number;
  observaciones?: string;
  registradoPor?: string;
  registradoPorNombre?: string;
  historial: ApiRndcMultaHistorialEntry[];
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiRndcMultaCreatePayload {
  vehiculo: string;
  conductor?: string | null;
  conductorNoRegistrado?: ApiRndcMultaConductorNoRegistrado | null;
  fecha: string;
  numeroComparendo?: string;
  codigoInfraccion?: string;
  descripcion: string;
  autoridad?: string;
  agente?: string;
  ciudad?: string;
  lugar?: string;
  valor: number;
  fechaLimitePago?: string | null;
  responsable?: ApiRndcMultaResponsable;
  fotos?: ApiRndcArchivo[];
  inmovilizacion?: {
    aplica: boolean;
    fechaInicio?: string | null;
    patio?: string;
    motivo?: string;
    costoGrua?: number | null;
    costoPatios?: number | null;
  };
  observaciones?: string;
}

export type ApiRndcMultaUpdatePayload = Partial<Omit<ApiRndcMultaCreatePayload, 'vehiculo' | 'fotos'>>;

export interface ApiRndcMultaPagoPayload {
  valorPagado: number;
  fechaPago?: string | null;
  comprobante?: ApiRndcArchivo | null;
  observaciones?: string;
}

export interface ApiRndcMultaResumen {
  total: number;
  valorTotal: number;
  costoTotal: number;
  pagado: number;
  porPagar: number;
  pendientes: number;
  impugnadas: number;
  pagadas: number;
  anuladas: number;
  conInmovilizacion: number;
  inmovilizacionesActivas: number;
  vehiculosInmovilizados: number;
  inmovilizadas: Array<{
    _id: string;
    numero: string;
    placa: string;
    fecha: string;
    descripcion?: string;
    vehiculo: { _id: string; placa: string; numeroInterno?: string; marca?: string; linea?: string } | null;
    inmovilizacion: {
      estado: ApiRndcInmovilizacionEstado;
      fechaInicio?: string | null;
      patio?: string;
      motivo?: string;
    };
  }>;
}

// ─── Paginated Response ───

export interface ApiRndcPaginatedResponse<T> {
  success: boolean;
  data: T;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

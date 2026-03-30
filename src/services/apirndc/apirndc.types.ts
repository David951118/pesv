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
  estado: 'ACTIVO' | 'MANTENIMIENTO' | 'INACTIVO' | 'RETIRADO';
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
  estadoGeneral: 'APROBADO' | 'CON_NOVEDAD' | 'RECHAZADO';
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

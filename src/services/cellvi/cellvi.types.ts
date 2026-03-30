// ─── Cellvi API Response Types ───

export interface CellviLoginResponse {
  token: string;
  data: Record<string, unknown>;
}

export interface CellviTipoEvento {
  id: number;
  codigo: string;
  nombre: string;
  prioridad: number;
}

export interface CellviEvento {
  id: number;
  tipoEvento: CellviTipoEvento;
}

export interface CellviLastPositionResponse {
  id: string;
  evento: CellviEvento | null;
  latitud: number;
  longitud: number;
  velocidad: number;
  momento: string;
  variables: string;
  sentido: number;
}

export interface CellviVehicle {
  id: number;
  placa: string;
  marca?: string;
  linea?: string;
  color?: string;
  clase?: string;
  interno?: string;
  conductor_nombre?: string;
  [key: string]: unknown;
}

// ─── Parsed Variables ───

export interface CellviParsedVariables {
  equipo?: string;
  fecha?: string;
  latitud?: number;
  longitud?: number;
  velocidad?: number;
  kilometraje?: number;
  raw?: string;
  [key: string]: unknown;
}

// ─── Normalized Position (adapter to existing VehiclePosition shape) ───

export interface CellviNormalizedPosition {
  vehicle_id: string;
  lat: number;
  lon: number;
  speed: number;
  course: number;
  ignition: boolean | null;
  address: string | null;
  updated_at: string;
  device_time: string;
  attributes_json: Record<string, unknown>;
  vehiculo?: {
    placa: string;
    interno: string | null;
    marca: string | null;
    linea: string | null;
    color: string | null;
    clase: string | null;
    conductor_nombre: string | null;
  };
  device_link?: {
    device_status: string | null;
    last_ping_at: string | null;
  };
  source: 'cellvi';
  cellviEvento?: {
    id: number;
    codigo: string;
    nombre: string;
    prioridad: number;
  } | null;
}

export type DataSource = 'traccar' | 'cellvi' | 'mixed';

import type {
  CellviVehicle,
  CellviLastPositionResponse,
  CellviParsedVariables,
  CellviNormalizedPosition,
} from './cellvi.types';

// ─── Variable Parsing ───

const ODOMETER_KEYS = ['km', 'kilometraje', 'odometro', 'mileage', 'odo', 'totalDistance'];

/**
 * Parses the `variables` field from Cellvi.
 * It arrives as a doubly-escaped JSON string, e.g.:
 *   "\"{\\\"equipo\\\":\\\"864035051021401\\\",...}\""
 *
 * Strategy:
 * 1. Remove outer quotes if present
 * 2. Unescape backslashes
 * 3. JSON.parse with try/catch
 * 4. If parse fails, store raw string
 */
export function parseCellviVariables(raw: string | null | undefined): CellviParsedVariables {
  if (!raw) return {};

  try {
    let cleaned = raw;

    // Remove outer double-quotes if the string is wrapped: "\"...\""
    if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
      cleaned = cleaned.slice(1, -1);
    }

    // Unescape backslash-escaped quotes
    cleaned = cleaned.replace(/\\"/g, '"');
    // Unescape double backslashes
    cleaned = cleaned.replace(/\\\\/g, '\\');

    // If it's still wrapped in quotes (from double-encoding), strip again
    if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
      cleaned = cleaned.slice(1, -1);
      cleaned = cleaned.replace(/\\"/g, '"');
      cleaned = cleaned.replace(/\\\\/g, '\\');
    }

    const parsed = JSON.parse(cleaned);

    if (typeof parsed !== 'object' || parsed === null) {
      return { raw };
    }

    const result: CellviParsedVariables = { ...parsed };

    // Extract odometer from common key variants
    if (result.kilometraje === undefined) {
      for (const key of ODOMETER_KEYS) {
        const val = parsed[key];
        if (val !== undefined && val !== null) {
          const num = typeof val === 'number' ? val : parseFloat(String(val));
          if (!isNaN(num)) {
            result.kilometraje = num;
            break;
          }
        }
      }
    }

    return result;
  } catch {
    return { raw };
  }
}

// ─── Position Normalization ───

/**
 * Determines device status based on how recent the `momento` timestamp is.
 */
function inferDeviceStatus(momento: string): 'online' | 'offline' {
  try {
    const posTime = new Date(momento.replace(' ', 'T') + 'Z');
    const diffMs = Date.now() - posTime.getTime();
    // Consider "online" if position is less than 5 minutes old
    return diffMs < 5 * 60 * 1000 ? 'online' : 'offline';
  } catch {
    return 'offline';
  }
}

/**
 * Converts a Cellvi last-position + vehicle info into the normalized
 * VehiclePosition shape consumed by the map UI.
 */
export function normalizeLastPosition(
  position: CellviLastPositionResponse,
  vehicle: CellviVehicle,
): CellviNormalizedPosition {
  const variables = parseCellviVariables(position.variables);
  const deviceStatus = inferDeviceStatus(position.momento);

  // Build attributes_json from variables + event info
  const attributes: Record<string, unknown> = { ...variables };
  if (variables.kilometraje !== undefined) {
    attributes.totalDistance = variables.kilometraje;
  }
  if (position.evento) {
    attributes.cellviEventName = position.evento.tipoEvento.nombre;
    attributes.cellviEventCode = position.evento.tipoEvento.codigo;
    attributes.cellviEventPriority = position.evento.tipoEvento.prioridad;
  }

  // Normalize momento to ISO format
  const isoTimestamp = position.momento.includes('T')
    ? position.momento
    : position.momento.replace(' ', 'T');

  return {
    vehicle_id: `cellvi_${vehicle.id}`,
    lat: position.latitud,
    lon: position.longitud,
    speed: position.velocidad,
    course: position.sentido >= 0 ? position.sentido : 0,
    ignition: position.velocidad > 0 ? true : null,
    address: null,
    updated_at: isoTimestamp,
    device_time: isoTimestamp,
    attributes_json: attributes,
    vehiculo: {
      placa: vehicle.placa || 'Sin placa',
      interno: vehicle.interno || null,
      marca: vehicle.marca || null,
      linea: vehicle.linea || null,
      color: vehicle.color || null,
      clase: vehicle.clase || null,
      conductor_nombre: vehicle.conductor_nombre || null,
    },
    device_link: {
      device_status: deviceStatus,
      last_ping_at: isoTimestamp,
    },
    source: 'cellvi',
    cellviEvento: position.evento
      ? {
          id: position.evento.tipoEvento.id,
          codigo: position.evento.tipoEvento.codigo,
          nombre: position.evento.tipoEvento.nombre,
          prioridad: position.evento.tipoEvento.prioridad,
        }
      : null,
  };
}

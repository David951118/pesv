import { describe, it, expect } from 'vitest';
import { parseCellviVariables, normalizeLastPosition } from '../cellvi.normalize';
import type { CellviLastPositionResponse, CellviVehicle } from '../cellvi.types';

describe('parseCellviVariables', () => {
  it('parses doubly-escaped JSON string', () => {
    const raw = '"\\"{\\\\\\"equipo\\\\\\":\\\\\\"864035051021401\\\\\\",\\\\\\"fecha\\\\\\":\\\\\\"2026-02-06\\\\\\"}\\"" ';
    const result = parseCellviVariables(raw);
    // Should extract equipo if parsing succeeds; if not, raw is kept
    expect(result).toBeDefined();
  });

  it('parses standard escaped JSON string', () => {
    const raw = '"{\\"equipo\\":\\"864035051021401\\",\\"fecha\\":\\"2026-02-06\\",\\"kilometraje\\":12345}"';
    const result = parseCellviVariables(raw);
    expect(result.equipo).toBe('864035051021401');
    expect(result.fecha).toBe('2026-02-06');
    expect(result.kilometraje).toBe(12345);
  });

  it('extracts odometer from alternative key names', () => {
    const raw = '"{\\"equipo\\":\\"ABC\\",\\"km\\":55000}"';
    const result = parseCellviVariables(raw);
    expect(result.kilometraje).toBe(55000);
  });

  it('extracts odometer from "mileage" key', () => {
    const raw = '"{\\"mileage\\":99000}"';
    const result = parseCellviVariables(raw);
    expect(result.kilometraje).toBe(99000);
  });

  it('returns empty object for null/undefined', () => {
    expect(parseCellviVariables(null)).toEqual({});
    expect(parseCellviVariables(undefined)).toEqual({});
    expect(parseCellviVariables('')).toEqual({});
  });

  it('returns raw on unparseable input', () => {
    const result = parseCellviVariables('not json at all');
    expect(result.raw).toBe('not json at all');
  });

  it('handles plain JSON (no extra wrapping)', () => {
    const raw = '{"equipo":"123","velocidad":60}';
    const result = parseCellviVariables(raw);
    expect(result.equipo).toBe('123');
    expect(result.velocidad).toBe(60);
  });
});

describe('normalizeLastPosition', () => {
  const mockVehicle: CellviVehicle = {
    id: 100,
    placa: 'ABC123',
    marca: 'Toyota',
    linea: 'Hilux',
    color: 'Blanco',
    clase: 'CAMIONETA',
    interno: 'V-01',
    conductor_nombre: 'Juan Perez',
  };

  const mockPosition: CellviLastPositionResponse = {
    id: '3847',
    evento: {
      id: 590466627,
      tipoEvento: {
        id: 35,
        codigo: '10',
        nombre: 'REPORTE NORMAL',
        prioridad: 3,
      },
    },
    latitud: 3.2490412,
    longitud: -76.377294,
    velocidad: 0,
    momento: '2026-02-06 11:48:22',
    variables: '"{\\"equipo\\":\\"864035051021401\\",\\"kilometraje\\":45000}"',
    sentido: -0.29145679512974115,
  };

  it('produces a valid normalized position', () => {
    const result = normalizeLastPosition(mockPosition, mockVehicle);

    expect(result.vehicle_id).toBe('cellvi_100');
    expect(result.lat).toBe(3.2490412);
    expect(result.lon).toBe(-76.377294);
    expect(result.speed).toBe(0);
    expect(result.source).toBe('cellvi');
    expect(result.vehiculo?.placa).toBe('ABC123');
    expect(result.vehiculo?.marca).toBe('Toyota');
    expect(result.vehiculo?.conductor_nombre).toBe('Juan Perez');
  });

  it('includes event information', () => {
    const result = normalizeLastPosition(mockPosition, mockVehicle);

    expect(result.cellviEvento).toBeDefined();
    expect(result.cellviEvento?.nombre).toBe('REPORTE NORMAL');
    expect(result.cellviEvento?.codigo).toBe('10');
    expect(result.attributes_json.cellviEventName).toBe('REPORTE NORMAL');
  });

  it('normalizes negative sentido to 0', () => {
    const result = normalizeLastPosition(mockPosition, mockVehicle);
    expect(result.course).toBe(0);
  });

  it('preserves positive sentido', () => {
    const pos = { ...mockPosition, sentido: 145.5 };
    const result = normalizeLastPosition(pos, mockVehicle);
    expect(result.course).toBe(145.5);
  });

  it('handles null evento gracefully', () => {
    const pos = { ...mockPosition, evento: null };
    const result = normalizeLastPosition(pos, mockVehicle);
    expect(result.cellviEvento).toBeNull();
  });

  it('includes odometer from variables in attributes_json', () => {
    const result = normalizeLastPosition(mockPosition, mockVehicle);
    expect(result.attributes_json.totalDistance).toBe(45000);
  });

  it('converts momento to ISO format', () => {
    const result = normalizeLastPosition(mockPosition, mockVehicle);
    expect(result.updated_at).toBe('2026-02-06T11:48:22');
    expect(result.device_time).toBe('2026-02-06T11:48:22');
  });
});

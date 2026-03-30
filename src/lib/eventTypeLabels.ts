// Mapeo de códigos de eventos a nombres en español
export const EVENT_TYPE_LABELS: Record<string, { name: string; description: string }> = {
  // Seguridad
  PANIC: { name: "Botón de Pánico", description: "Activación manual o automática del botón de pánico" },
  SOS: { name: "Emergencia SOS", description: "Botón de emergencia activado" },
  POWER_CUT: { name: "Corte de Energía", description: "Batería principal desconectada" },
  JAMMING: { name: "Interferencia GPS", description: "Posible inhibidor de señal detectado" },
  OFF_HOURS_MOVE: { name: "Movimiento Fuera de Horario", description: "Vehículo en movimiento fuera del horario operativo" },
  ROUTE_DEVIATION: { name: "Desvío de Ruta", description: "El vehículo se ha desviado de la ruta programada" },
  FORBIDDEN_ZONE_ENTRY: { name: "Entrada Zona Prohibida", description: "El vehículo ingresó a una zona restringida" },
  HARSH_DRIVING: { name: "Conducción Agresiva", description: "Maniobras bruscas detectadas" },
  
  // Operacionales
  OVERSPEED: { name: "Exceso de Velocidad", description: "Vehículo superó el límite de velocidad" },
  IGNITION_ON: { name: "Encendido", description: "Motor encendido" },
  IGNITION_OFF: { name: "Apagado", description: "Motor apagado" },
  DEVICE_MOVING: { name: "En Movimiento", description: "Vehículo inició movimiento" },
  DEVICE_STOPPED: { name: "Detenido", description: "Vehículo se detuvo" },
  IDLE_EXTENDED: { name: "Ralentí Prolongado", description: "Vehículo encendido sin movimiento" },
  STOP_DURATION: { name: "Parada Prolongada", description: "Vehículo detenido más tiempo del permitido" },
  HARSH_BRAKING: { name: "Frenado Brusco", description: "Evento de frenado agresivo" },
  HARSH_ACCELERATION: { name: "Aceleración Brusca", description: "Evento de aceleración agresiva" },
  HIGH_RPM: { name: "Exceso de RPM", description: "Motor sobre límite de revoluciones" },
  MAINTENANCE: { name: "Alerta de Mantenimiento", description: "Recordatorio de mantenimiento programado" },
  LATE_ARRIVAL: { name: "Llegada Tarde", description: "Vehículo llegó tarde al destino" },
  FUEL_OVERCONSUMPTION: { name: "Consumo Excesivo Combustible", description: "Consumo supera el umbral normal" },
  EXCESSIVE_STOPS: { name: "Paradas Excesivas", description: "Más paradas de las programadas" },
  PREOP_REJECTED: { name: "Preoperativa Rechazada", description: "Inspección preoperativa no aprobada" },
  RNDC_TRIP_START: { name: "Viaje RNDC Iniciado", description: "Se inició un viaje registrado en RNDC" },
  
  // GPS
  DEVICE_ONLINE: { name: "Dispositivo Conectado", description: "Dispositivo volvió a conectarse" },
  DEVICE_OFFLINE: { name: "Dispositivo Desconectado", description: "Dispositivo perdió conexión" },
  LOW_BATTERY: { name: "Batería Baja", description: "Nivel de batería del dispositivo bajo" },
  NO_SIGNAL: { name: "Sin Señal GPS", description: "Dispositivo sin comunicación" },
  GEOFENCE_ENTER: { name: "Entrada a Geocerca", description: "Vehículo entró al área definida" },
  GEOFENCE_EXIT: { name: "Salida de Geocerca", description: "Vehículo salió del área permitida" },
  ENGINE_OVERHEAT: { name: "Sobrecalentamiento Motor", description: "Temperatura del motor alta" },
  
  // Cumplimiento
  COMPLIANCE_EXPIRED: { name: "Documento Vencido", description: "Un documento legal ha vencido" },
  COMPLIANCE_EXPIRING: { name: "Documento Por Vencer", description: "Un documento está próximo a vencer" },
  REST_VIOLATION: { name: "Violación Descanso Obligatorio", description: "Conductor excedió horas de conducción" },
};

export function getEventTypeLabel(code: string): { name: string; description: string } {
  return EVENT_TYPE_LABELS[code] || { name: code, description: "" };
}

// Categorías de eventos en español
export const EVENT_CATEGORIES: Record<string, string> = {
  security: "Seguridad",
  operational: "Operacional",
  gps: "GPS/Telemetría",
  compliance: "Cumplimiento",
  general: "General",
};

// Severidades en español
export const SEVERITY_LABELS: Record<string, { label: string; color: string }> = {
  CRITICAL: { label: "Crítico", color: "text-red-600 bg-red-100" },
  HIGH: { label: "Alto", color: "text-orange-600 bg-orange-100" },
  MEDIUM: { label: "Medio", color: "text-yellow-600 bg-yellow-100" },
  LOW: { label: "Bajo", color: "text-green-600 bg-green-100" },
};

// Estados de eventos en español
export const EVENT_STATUS_LABELS: Record<string, string> = {
  open: "Abierto",
  acknowledged: "Confirmado",
  resolved: "Resuelto",
  closed: "Cerrado",
};

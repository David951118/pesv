interface VehicleOperationalStatus {
  preoperativaStatus?: string;
  legalidadStatus?: string;
  hasFUECActivo?: boolean;
  documentosCompletos?: boolean;
  documentosPorVencer?: number;
  documentosFaltantes?: number;
}

interface VehicleMarkerAionProps {
  speed: number;
  course: number;
  ignition: boolean | null;
  status: string;
  operationalStatus?: VehicleOperationalStatus;
  isSelected?: boolean;
  vehicleClass?: string;
  placa?: string;
}

// Escape XML/SVG special characters to prevent XSS attacks
function escapeXML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Get status colors and icon based on vehicle state (Satrack-style tracking)
function getStatusConfig(speed: number, ignition: boolean | null, status: string) {
  const isMoving = speed > 2;
  const isOnline = status === "online";
  const isIgnitionOn = ignition === true;

  if (isOnline) {
    if (isMoving) {
      // EN MOVIMIENTO - Verde con flecha
      return {
        primary: "#22c55e", // Verde
        secondary: "#4ade80",
        glow: "rgba(34, 197, 94, 0.5)",
        statusText: "En movimiento",
        icon: "arrow", // Flecha
      };
    } else if (isIgnitionOn) {
      // EN PAUSA - Amarillo con símbolo pausa
      return {
        primary: "#f59e0b", // Amarillo
        secondary: "#fbbf24",
        glow: "rgba(245, 158, 11, 0.4)",
        statusText: "En pausa",
        icon: "pause", // Pausa
      };
    } else {
      // DETENIDO/APAGADO - Rojo con stop
      return {
        primary: "#ef4444", // Rojo
        secondary: "#f87171",
        glow: "rgba(239, 68, 68, 0.4)",
        statusText: "Detenido",
        icon: "stop", // Stop
      };
    }
  }
  
  // SIN CONEXIÓN - Gris
  return {
    primary: "#64748b",
    secondary: "#94a3b8",
    glow: "rgba(100, 116, 139, 0.4)",
    statusText: "Sin conexión",
    icon: "offline",
  };
}

// Generate status icon SVG based on state (scaled for smaller marker)
function getStatusIconSVG(icon: string, rotation: number): string {
  switch (icon) {
    case "arrow":
      // Flecha direccional (en movimiento) - rota según el curso
      return `
        <g transform="translate(26, 25) rotate(${rotation - 90})">
          <polygon points="0,-10 8,6 0,2 -8,6" fill="white" stroke="white" stroke-width="0.5"/>
        </g>
      `;
    case "pause":
      // Símbolo de pausa (motor encendido, detenido)
      return `
        <g transform="translate(26, 25)">
          <rect x="-6" y="-8" width="5" height="16" rx="1.5" fill="white"/>
          <rect x="1" y="-8" width="5" height="16" rx="1.5" fill="white"/>
        </g>
      `;
    case "stop":
      // Símbolo de stop/detenido (motor apagado)
      return `
        <g transform="translate(26, 25)">
          <rect x="-8" y="-8" width="16" height="16" rx="3" fill="white"/>
        </g>
      `;
    case "offline":
      // X para sin conexión
      return `
        <g transform="translate(26, 25)">
          <line x1="-6" y1="-6" x2="6" y2="6" stroke="white" stroke-width="3" stroke-linecap="round"/>
          <line x1="6" y1="-6" x2="-6" y2="6" stroke="white" stroke-width="3" stroke-linecap="round"/>
        </g>
      `;
    default:
      return "";
  }
}

// Get operational status indicator colors
function getOperationalColors(operationalStatus?: VehicleOperationalStatus) {
  const defaults = {
    preop: "#64748b",
    legal: "#64748b",
    fuec: "#64748b",
    docs: "#64748b",
  };

  if (!operationalStatus) return defaults;

  // Preoperativa
  if (operationalStatus.preoperativaStatus === "aprobada") {
    defaults.preop = "#22c55e";
  } else if (operationalStatus.preoperativaStatus === "rechazada") {
    defaults.preop = "#ef4444";
  } else if (operationalStatus.preoperativaStatus === "pendiente") {
    defaults.preop = "#f59e0b";
  }

  // Legalidad
  if (operationalStatus.legalidadStatus === "ok") {
    defaults.legal = "#22c55e";
  } else if (operationalStatus.legalidadStatus === "por_vencer") {
    defaults.legal = "#f59e0b";
  } else {
    defaults.legal = "#ef4444";
  }

  // FUEC
  defaults.fuec = operationalStatus.hasFUECActivo ? "#22c55e" : "#64748b";

  // Documentos
  if (operationalStatus.documentosCompletos) {
    defaults.docs = "#22c55e";
  } else if (operationalStatus.documentosPorVencer > 0) {
    defaults.docs = "#f59e0b";
  } else if (operationalStatus.documentosFaltantes > 0) {
    defaults.docs = "#ef4444";
  }

  return defaults;
}

export function getVehicleMarkerSVG({
  speed,
  course,
  ignition,
  status,
  operationalStatus,
  isSelected,
  placa,
}: VehicleMarkerAionProps): string {
  const isMoving = speed > 2;
  const statusConfig = getStatusConfig(speed, ignition, status);
  const opColors = getOperationalColors(operationalStatus);
  const rotation = course || 0;
  const uniqueId = Math.random().toString(36).substring(7);

  // Pulse animation for moving vehicles
  const pulseAnim = isMoving ? `
    <animate attributeName="opacity" values="0.6;1;0.6" dur="1.5s" repeatCount="indefinite"/>
  ` : "";

  // Get the status icon SVG
  const statusIcon = getStatusIconSVG(statusConfig.icon, rotation);

  return `
    <svg width="52" height="65" viewBox="0 0 52 65" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <!-- Gradients -->
        <linearGradient id="bodyGrad_${uniqueId}" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="${statusConfig.secondary}"/>
          <stop offset="100%" stop-color="${statusConfig.primary}"/>
        </linearGradient>
        
        <!-- Shadow filter -->
        <filter id="shadow_${uniqueId}" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.3"/>
        </filter>
        
        <!-- Glow for selected -->
        <filter id="glow_${uniqueId}" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="glow"/>
          <feMerge>
            <feMergeNode in="glow"/>
            <feMergeNode in="glow"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      
      <!-- Outer glow for moving vehicles -->
      ${isMoving ? `
        <circle cx="26" cy="25" r="22" fill="none" stroke="${statusConfig.glow}" stroke-width="3" opacity="0.6">
          ${pulseAnim}
        </circle>
      ` : ""}
      
      <!-- Selection ring -->
      ${isSelected ? `
        <circle cx="26" cy="25" r="24" fill="none" stroke="#8b5cf6" stroke-width="2" filter="url(#glow_${uniqueId})">
          <animate attributeName="stroke-dasharray" values="0,160;80,80;0,160" dur="2s" repeatCount="indefinite"/>
        </circle>
      ` : ""}
      
      <!-- Main circular background -->
      <g filter="url(#shadow_${uniqueId})">
        <circle cx="26" cy="25" r="21" fill="white"/>
        <circle cx="26" cy="25" r="19" fill="url(#bodyGrad_${uniqueId})"/>
        
        <!-- Status Icon (Satrack-style) -->
        ${statusIcon}
        
        <!-- Speed badge for moving vehicles -->
        ${isMoving ? `
          <g>
            <rect x="36" y="4" width="15" height="12" rx="3" fill="#1e293b" stroke="white" stroke-width="0.5"/>
            <text x="43.5" y="12" text-anchor="middle" fill="white" font-size="8" font-weight="bold" font-family="system-ui">${Math.round(speed)}</text>
          </g>
        ` : ""}
      </g>
      
      <!-- Pin pointer -->
      <g filter="url(#shadow_${uniqueId})">
        <path d="M26 44 L21 53 L26 49 L31 53 Z" fill="url(#bodyGrad_${uniqueId})" stroke="white" stroke-width="0.5"/>
      </g>
      
      <!-- Operational Status Pills (P, L, F, D) -->
      <g transform="translate(6, 54)">
        <!-- Preoperativa -->
        <g>
          <rect x="0" y="0" width="9" height="9" rx="2" fill="${opColors.preop}" stroke="white" stroke-width="0.5"/>
          <text x="4.5" y="7" text-anchor="middle" fill="white" font-size="6" font-weight="bold" font-family="system-ui">P</text>
        </g>
        
        <!-- Legalidad -->
        <g transform="translate(10, 0)">
          <rect x="0" y="0" width="9" height="9" rx="2" fill="${opColors.legal}" stroke="white" stroke-width="0.5"/>
          <text x="4.5" y="7" text-anchor="middle" fill="white" font-size="6" font-weight="bold" font-family="system-ui">L</text>
        </g>
        
        <!-- FUEC -->
        <g transform="translate(20, 0)">
          <rect x="0" y="0" width="9" height="9" rx="2" fill="${opColors.fuec}" stroke="white" stroke-width="0.5"/>
          <text x="4.5" y="7" text-anchor="middle" fill="white" font-size="6" font-weight="bold" font-family="system-ui">F</text>
        </g>
        
        <!-- Documentos -->
        <g transform="translate(30, 0)">
          <rect x="0" y="0" width="9" height="9" rx="2" fill="${opColors.docs}" stroke="white" stroke-width="0.5"/>
          <text x="4.5" y="7" text-anchor="middle" fill="white" font-size="6" font-weight="bold" font-family="system-ui">D</text>
        </g>
      </g>
    </svg>
  `;
}

export function VehicleMarkerAion(props: VehicleMarkerAionProps) {
  const svgContent = getVehicleMarkerSVG(props);
  
  return (
    <div
      dangerouslySetInnerHTML={{ __html: svgContent }}
      className="vehicle-marker-aion"
    />
  );
}

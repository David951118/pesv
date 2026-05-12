// Estructura de items de la preoperacional (alineada con el backend).
// Estados validos por item: BUENO | REGULAR | MALO | NO_APLICA.
// NO_APLICA no genera novedad.

export const SECCION_DELANTERA_ITEMS = [
  { key: "luces", label: "Luces" },
  { key: "direccionalesDelanteros", label: "Direccionales Delanteros" },
  { key: "limpiabrisas", label: "Limpiabrisas" },
  { key: "parabrisas", label: "Parabrisas" },
  { key: "llantaDelanteraDerecha", label: "Llanta Delantera Derecha" },
  { key: "llantaDelanteraIzquierda", label: "Llanta Delantera Izquierda" },
  { key: "bocina", label: "Bocina" },
  { key: "frenos", label: "Frenos" },
  { key: "nivelAceiteMotor", label: "Nivel de Aceite del Motor" },
  { key: "nivelLiquidoFrenos", label: "Nivel de Liquido de Frenos" },
  { key: "nivelAguaRadiador", label: "Nivel de Agua del Radiador" },
  { key: "estadoBateria", label: "Estado de la Bateria" },
  { key: "fugasLiquidos", label: "Fugas de Liquidos" },
] as const;

export const SECCION_MEDIA_ITEMS = [
  { key: "tablero", label: "Tablero" },
  { key: "timon", label: "Timon" },
  { key: "pedales", label: "Pedales" },
  { key: "frenoMano", label: "Freno de Mano" },
  { key: "kitPrimerosAuxilios", label: "Kit Primeros Auxilios" },
  { key: "reflectivos", label: "Reflectivos" },
  { key: "aireAcondicionado", label: "Aire Acondicionado" },
  { key: "silleteria", label: "Silleteria" },
  { key: "nivelCombustible", label: "Nivel de Combustible" },
  { key: "pito", label: "Pito" },
  { key: "cinturonesSeguridad", label: "Cinturones de Seguridad" },
  { key: "airbags", label: "Airbags" },
  { key: "vidrios", label: "Vidrios" },
  { key: "apoyacabezas", label: "Apoyacabezas" },
  { key: "espejoIzquierdo", label: "Espejo Izquierdo" },
  { key: "espejoDerecho", label: "Espejo Derecho" },
  { key: "espejoRetrovisor", label: "Espejo Retrovisor" },
  { key: "estadoDireccion", label: "Estado de la Direccion" },
  { key: "suspensionDelantera", label: "Suspension Delantera" },
  { key: "suspensionTrasera", label: "Suspension Trasera" },
  { key: "calcomanias", label: "Calcomanias" },
  { key: "puertas", label: "Puertas" },
] as const;

export const SECCION_TRASERA_ITEMS = [
  { key: "stop", label: "Stop" },
  { key: "llantasRepuesto", label: "Llantas de Repuesto" },
  { key: "equipoCarretera", label: "Equipo de Carretera" },
  { key: "llantaTraseraDerecha", label: "Llanta Trasera Derecha" },
  { key: "llantaTraseraIzquierda", label: "Llanta Trasera Izquierda" },
  { key: "direccionalesTraseros", label: "Direccionales Traseros" },
  { key: "placa", label: "Placa" },
  { key: "extintor", label: "Extintor" },
  { key: "herramienta", label: "Herramienta" },
] as const;

export const SECCION_ASEO_ITEMS = [
  { key: "aseoInterno", label: "Aseo Interno" },
  { key: "aseoExterno", label: "Aseo Externo" },
  { key: "latas", label: "Latas" },
  { key: "pintura", label: "Pintura" },
] as const;

export const ALL_PREOP_ITEMS = [
  ...SECCION_DELANTERA_ITEMS,
  ...SECCION_MEDIA_ITEMS,
  ...SECCION_TRASERA_ITEMS,
  ...SECCION_ASEO_ITEMS,
] as const;

export type PreopItemKey = (typeof ALL_PREOP_ITEMS)[number]["key"];

// Items con popup informativo (kits): al hacer click se muestra el contenido
// minimo requerido para que el conductor confirme antes de marcar el estado.
export const KIT_PRIMEROS_AUXILIOS_ITEMS = [
  "Gasas esteriles",
  "Vendas elasticas y de gasa",
  "Esparadrapo / cinta adhesiva medica",
  "Aposito o compresas estabilizadoras",
  "Antiseptico (yodo, alcohol o clorhexidina)",
  "Solucion salina para lavado de heridas",
  "Tijeras de punta roma",
  "Pinzas",
  "Guantes de latex desechables",
  "Mascara de RCP",
  "Termometro",
  "Inmovilizador cervical",
  "Manual de primeros auxilios",
] as const;

export const KIT_CARRETERA_ITEMS = [
  "Gato con capacidad correcta para el vehiculo",
  "Chaleco reflectivo",
  "Tacos para bloquear el vehiculo (x2)",
  "Senales de carretera triangulares reflectivas (x2)",
  "Guantes de trabajo",
  "Cruceta",
  "Cables para iniciar (cables de bateria)",
  "Extintor vigente",
  "Conos reflectivos (x2)",
  "Linterna recargable",
  "Caja de herramientas basicas",
] as const;

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Info, AlertTriangle, Camera, ClipboardCheck, Package, Flame, Wrench, StretchVertical, Award, GraduationCap } from "lucide-react";
import busTerciosImg from "@/assets/microbus.png";

interface PreoperativaInfoLegalProps {
  showImage?: boolean;
  variant?: "form" | "report";
}

/**
 * Componente con información legal y de instrucciones para la revisión preoperacional.
 * Se usa tanto en el formulario como en el reporte/PDF.
 * Optimizado para móvil con mejor legibilidad y espaciado.
 */
export function PreoperativaInfoLegal({ showImage = true, variant = "form" }: PreoperativaInfoLegalProps) {
  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Bloque 1: ¿Qué es la Revisión Pre Operacional? */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6 pt-3 sm:pt-6">
          <CardTitle className="text-sm sm:text-base flex items-center gap-2">
            <Info className="h-4 w-4 text-primary flex-shrink-0" />
            <span className="leading-tight">¿Qué es la Revisión Pre Operacional?</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
          <p className="text-xs sm:text-sm leading-relaxed text-foreground/90">
            La Revisión Pre operacional, consiste en una{" "}
            <strong className="text-foreground">inspección básica</strong> del vehículo,{" "}
            <strong className="text-foreground">labrado y presión de las llantas</strong>,{" "}
            funcionamiento de los{" "}
            <strong className="text-foreground">sistemas mecánicos y eléctricos</strong>,{" "}
            además de una revisión del estado del{" "}
            <strong className="text-foreground">limpiaparabrisas</strong>, entre otras.{" "}
            Parámetros que permiten verificar las condiciones de funcionamiento.
          </p>
        </CardContent>
      </Card>

      {/* Bloque 2: Recuerde Señor Conductor (Callout destacado) */}
      <Card className="border-amber-400 bg-amber-50 dark:bg-amber-950/30 border-2">
        <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6 pt-3 sm:pt-6">
          <CardTitle className="text-sm sm:text-base flex items-center gap-2 text-amber-800 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600 flex-shrink-0" />
            <span className="leading-tight">Recuerde Señor Conductor</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6 space-y-2 sm:space-y-3">
          <ol className="list-decimal list-outside ml-4 space-y-2 sm:space-y-3 text-xs sm:text-sm text-amber-900 dark:text-amber-100">
            <li className="leading-relaxed pl-1">
              La revisión pre operacional se realiza{" "}
              <strong className="text-amber-800 dark:text-amber-100">en frío</strong>, es decir,{" "}
              <strong className="text-amber-800 dark:text-amber-100">antes de encender</strong> el vehículo.
            </li>
            <li className="leading-relaxed pl-1">
              Debe seccionar el vehículo en{" "}
              <strong className="text-amber-800 dark:text-amber-100">tres tercios</strong> según la imagen anexa.
            </li>
            <li className="leading-relaxed pl-1">
              El presente formulario es{" "}
              <strong className="text-amber-800 dark:text-amber-100">válido para un trayecto</strong>,{" "}
              es decir que una vez emprenda su regreso debe realizar nuevamente la revisión.
            </li>
            <li className="leading-relaxed pl-1 space-y-1">
              <span>
                El formulario es válido si carga las fotografías de la revisión, las cuales deben detallar{" "}
                <strong className="text-amber-800 dark:text-amber-100">hora y fecha</strong>{" "}
                (descargar aplicación{" "}
                <strong className="text-amber-800 dark:text-amber-100">Timestamp Camera Free</strong>{" "}
                u otra aplicación que cumpla con la característica de registro).
              </span>
              <span className="flex items-center gap-1 text-[10px] sm:text-xs text-amber-700 dark:text-amber-300 mt-1">
                <Camera className="h-3 w-3 flex-shrink-0" />
                <span>Recomendación: Descargue "Timestamp Camera Free"</span>
              </span>
            </li>
          </ol>
        </CardContent>
      </Card>

      {/* Bloque 3: Imagen de los tres tercios */}
      {showImage && (
        <Card className="overflow-hidden">
          <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
            <CardTitle className="text-sm sm:text-base leading-tight">
              Seccionamiento del Vehículo (3 Tercios)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="w-full">
              <img
                src={busTerciosImg}
                alt="Seccionamiento del vehículo en tres tercios: Tercio Trasero, Tercio Medio y Tercio Frontal"
                className="w-full h-auto object-contain"
              />
            </div>
            <div className="p-2 sm:p-3 bg-muted/50 flex flex-wrap justify-around gap-1 text-[10px] sm:text-xs text-muted-foreground font-medium">
              <span>🔴 Tercio Trasero</span>
              <span>🟡 Tercio Medio</span>
              <span>🟢 Tercio Frontal</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bloque NUEVO: Elementos Obligatorios */}
      <Card className="border-green-400 dark:border-green-700 bg-green-50 dark:bg-green-950/30">
        <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6 pt-3 sm:pt-6">
          <CardTitle className="text-sm sm:text-base flex items-center gap-2 text-green-800 dark:text-green-200">
            <ClipboardCheck className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 flex-shrink-0" />
            <span className="leading-tight">Elementos Obligatorios — Verificación Visual</span>
          </CardTitle>
          <p className="text-[10px] sm:text-xs text-green-700 dark:text-green-300 mt-1">
            Confirma presencia y estado antes de iniciar
          </p>
        </CardHeader>
        <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6 space-y-2 sm:space-y-3">
          {/* A) Botiquín */}
          <div className="p-2 sm:p-3 bg-white dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2 mb-1 sm:mb-2">
              <Package className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-600 flex-shrink-0" />
              <span className="font-semibold text-xs sm:text-sm text-green-800 dark:text-green-100">A) BOTIQUÍN</span>
            </div>
            <p className="text-[10px] sm:text-xs text-green-700 dark:text-green-300 leading-relaxed">
              Gasas, vendas elásticas, apósitos, algodón, tijeras, curas, bajalenguas, guantes de látex, copitos, alcohol, agua destilada, inmovilizador de cuello preferible para niño, agua, Micropore, linterna.
            </p>
          </div>

          {/* B) Extintor */}
          <div className="p-2 sm:p-3 bg-white dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2 mb-1 sm:mb-2">
              <Flame className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-600 flex-shrink-0" />
              <span className="font-semibold text-xs sm:text-sm text-green-800 dark:text-green-100">B) EXTINTOR</span>
            </div>
            <p className="text-[10px] sm:text-xs text-green-700 dark:text-green-300 leading-relaxed mb-1 sm:mb-2">
              Extintor (Mínimo 10 libras de capacidad)
            </p>
            <p className="text-[10px] sm:text-xs text-green-600 dark:text-green-400 italic">
              Vigencia de recarga: Año ____ Mes ____
            </p>
          </div>

          {/* C) Equipo de Carretera */}
          <div className="p-2 sm:p-3 bg-white dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2 mb-1 sm:mb-2">
              <Wrench className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-600 flex-shrink-0" />
              <span className="font-semibold text-xs sm:text-sm text-green-800 dark:text-green-100">C) EQUIPO DE CARRETERA</span>
            </div>
            <p className="text-[10px] sm:text-xs text-green-700 dark:text-green-300 leading-relaxed">
              Alicate, destornillador, llave de expansión y fija, cruceta, gato, tacos, señales triangulares, chaleco reflectivo.
            </p>
          </div>

          {/* D, E, F en grid compacto para móvil */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {/* D) Franjas Alternas */}
            <div className="p-2 sm:p-3 bg-white dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2 mb-1">
                <StretchVertical className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
                <span className="font-semibold text-[10px] sm:text-xs text-green-800 dark:text-green-100">D) FRANJAS</span>
              </div>
              <p className="text-[10px] text-green-700 dark:text-green-300 leading-relaxed">
                Parte posterior, mín. 10 cm, amarillo y negro.
              </p>
            </div>

            {/* E) Logotipo Institucional */}
            <div className="p-2 sm:p-3 bg-white dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2 mb-1">
                <Award className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
                <span className="font-semibold text-[10px] sm:text-xs text-green-800 dark:text-green-100">E) LOGOTIPO</span>
              </div>
              <p className="text-[10px] text-green-700 dark:text-green-300 leading-relaxed">
                Partes traseras laterales con colores y tamaños correctos.
              </p>
            </div>

            {/* F) Leyenda Escolar */}
            <div className="p-2 sm:p-3 bg-white dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2 mb-1">
                <GraduationCap className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
                <span className="font-semibold text-[10px] sm:text-xs text-green-800 dark:text-green-100">F) LEYENDA</span>
              </div>
              <p className="text-[10px] text-green-700 dark:text-green-300 leading-relaxed">
                Delantera y trasera, mín. 10 cm de alto.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bloque 4: Soporte Legal */}
      <Card className="border-slate-300 dark:border-slate-700">
        <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6 pt-3 sm:pt-6">
          <CardTitle className="text-sm sm:text-base flex items-center gap-2">
            <span>📋</span>
            <span className="leading-tight">Soporte Legal – Revisión Pre Operacional</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
          <div className="text-xs sm:text-sm leading-relaxed text-muted-foreground space-y-2 sm:space-y-3">
            <p>
              De acuerdo con el <strong className="text-foreground">Decreto 1079 de 2015</strong> y la{" "}
              <strong className="text-foreground">Resolución 1223 de 2014</strong> del Ministerio de Transporte,
              las empresas de transporte especial están obligadas a implementar el Plan Estratégico de
              Seguridad Vial (PESV), dentro del cual se contempla la revisión pre operacional de los vehículos.
            </p>
            <p>
              La revisión pre operacional es un requisito obligatorio que debe realizarse{" "}
              <strong className="text-foreground">antes de cada servicio</strong> para verificar las condiciones
              mecánicas, eléctricas y de seguridad del vehículo, garantizando así la seguridad de los pasajeros,
              el conductor y demás actores viales.
            </p>
            <p className="text-[10px] sm:text-xs">
              El incumplimiento de esta obligación puede acarrear sanciones conforme a la normatividad vigente
              y generar responsabilidades civiles y penales en caso de accidentes de tránsito.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Export content for PDF generation
export const PREOPERATIVA_LEGAL_TEXT = {
  queEs: {
    titulo: "¿Qué es la Revisión Pre Operacional?",
    contenido: "La Revisión Pre operacional, consiste en una inspección básica del vehículo, labrado y presión de las llantas, funcionamiento de los sistemas mecánicos y eléctricos, además de una revisión del estado del limpiaparabrisas, entre otras. Parámetros que permiten verificar las condiciones de funcionamiento."
  },
  recordatorio: {
    titulo: "Recuerde Señor Conductor",
    puntos: [
      "1. La revisión pre operacional se realiza en frío, es decir, antes de encender el vehículo.",
      "2. Debe seccionar el vehículo en tres tercios según la imagen anexa.",
      "3. El presente formulario es válido para un trayecto, es decir que una vez emprenda su regreso debe realizar nuevamente la revisión.",
      "4. El formulario es válido si carga las fotografías de la revisión, las cuales deben detallar hora y fecha (descargar aplicación Timestamp Camera Free u otra aplicación que cumpla con la característica de registro), estas se deben registrar en el presente formulario."
    ]
  },
  elementosObligatorios: {
    titulo: "Elementos Obligatorios — Verificación Visual",
    subtitulo: "Confirma presencia y estado antes de iniciar",
    items: [
      { id: "A", nombre: "BOTIQUÍN", contenido: "Gasas, vendas elásticas, apósitos, algodón, tijeras, curas, bajalenguas, guantes de látex, copitos, alcohol, agua destilada, inmovilizador de cuello preferible para niño, agua, Micropore, linterna." },
      { id: "B", nombre: "EXTINTOR", contenido: "Extintor (Mínimo 10 libras de capacidad). Vigencia de recarga: Año ____ Mes ____" },
      { id: "C", nombre: "EQUIPO DE CARRETERA", contenido: "Alicate, destornillador, llave de expansión y fija, cruceta, gato, tacos, señales triangulares, chaleco reflectivo." },
      { id: "D", nombre: "FRANJAS ALTERNAS", contenido: "En parte posterior del vehículo, mín. 10 cm de ancho, colores amarillo y negro." },
      { id: "E", nombre: "LOGOTIPO INSTITUCIONAL", contenido: "En las partes traseras laterales del vehículo el logotipo institucional (con los colores y tamaños respectivos)." },
      { id: "F", nombre: "LEYENDA ESCOLAR", contenido: "En parte delantera y trasera de carrocería, mín. 10 cm de alto." }
    ]
  },
  soporteLegal: {
    titulo: "Soporte Legal – Revisión Pre Operacional",
    contenido: [
      "De acuerdo con el Decreto 1079 de 2015 y la Resolución 1223 de 2014 del Ministerio de Transporte, las empresas de transporte especial están obligadas a implementar el Plan Estratégico de Seguridad Vial (PESV), dentro del cual se contempla la revisión pre operacional de los vehículos.",
      "La revisión pre operacional es un requisito obligatorio que debe realizarse antes de cada servicio para verificar las condiciones mecánicas, eléctricas y de seguridad del vehículo, garantizando así la seguridad de los pasajeros, el conductor y demás actores viales.",
      "El incumplimiento de esta obligación puede acarrear sanciones conforme a la normatividad vigente y generar responsabilidades civiles y penales en caso de accidentes de tránsito."
    ]
  }
};

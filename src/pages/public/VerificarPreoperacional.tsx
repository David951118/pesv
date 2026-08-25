import { useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getApiRndcBaseUrl } from "@/services/apirndc/apirndc.config";
import { Loader2, CheckCircle, XCircle, MinusCircle, Download, ShieldCheck, AlertTriangle, Car, User, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { labelForItem } from "@/lib/preopItems";

// ── Ordered section keys (alineadas con backend) ──
const SECCION_DELANTERA = [
  "luces","direccionalesDelanteros","limpiabrisas","parabrisas",
  "llantaDelanteraDerecha","llantaDelanteraIzquierda","bocina","frenos",
  "nivelAceiteMotor","nivelLiquidoFrenos","nivelAguaRadiador","estadoBateria","fugasLiquidos",
];
const SECCION_MEDIA = [
  "tablero","timon","pedales","frenoMano","kitPrimerosAuxilios","reflectivos",
  "aireAcondicionado","silleteria","nivelCombustible","pito",
  "cinturonesSeguridad","airbags","vidrios","apoyacabezas",
  "espejoIzquierdo","espejoDerecho","espejoRetrovisor",
  "estadoDireccion","suspensionDelantera","suspensionTrasera",
  "calcomanias","puertas",
];
const SECCION_TRASERA = [
  "stop","llantasRepuesto","equipoCarretera","llantaTraseraDerecha",
  "llantaTraseraIzquierda","direccionalesTraseros","placa","extintor","herramienta",
];
const SECCION_ASEO = [
  "aseoInterno","aseoExterno","latas","pintura",
];


// ── Types ──
interface ItemData { estado: string; observaciones: string | null; fotoUrl: string | null }
type SectionMap = Record<string, ItemData>;

interface PreopVerificado {
  estadoGeneral: string;
  kilometraje: number;
  firmadoCheck: boolean;
  firmaConductorUrl?: string | null;
  observaciones?: string | null;
  creadoEn?: string;
  vehiculo?: { placa?: string; numeroInterno?: string; marca?: string; linea?: string; modelo?: string | number };
  conductor?: { nombres?: string; apellidos?: string; identificacion?: string; tipoId?: string; licencia?: string };
  empresa?: { razonSocial?: string; nit?: string };
  seccionConductor?: {
    horasSueno?: number;
    selfieUrl?: string | null;
    selfieFecha?: string;
    estadoSalud?: string;
    estadoSaludObservaciones?: string;
    tomaMedicamentos?: boolean;
    medicamentosDetalle?: string;
    consumoSustancias?: boolean;
    sustanciasDetalle?: string;
  };
  seccionDelantera?: SectionMap;
  seccionMedia?: SectionMap;
  seccionTrasera?: SectionMap;
  seccionAseo?: SectionMap;
  contadorQR?: number;
}

// ── Helpers ──
function getConductorName(c?: PreopVerificado["conductor"]) {
  if (!c) return "—";
  if (c.nombres) return `${c.nombres} ${c.apellidos || ""}`.trim();
  return "—";
}

function formatDateFull(d?: string) {
  if (!d) return "—";
  try { return format(new Date(d), "dd 'de' MMMM 'de' yyyy, HH:mm", { locale: es }); }
  catch { return d; }
}

function countSection(s?: SectionMap) {
  if (!s) return { ok: 0, fallas: 0, regular: 0, na: 0 };
  const vals = Object.values(s);
  const fallas = vals.filter(v => v.estado === "MALO").length;
  const regular = vals.filter(v => v.estado === "REGULAR").length;
  const na = vals.filter(v => v.estado === "NO_APLICA").length;
  return { ok: vals.length - fallas - regular - na, fallas, regular, na };
}

// ── Item badge ──
function ItemBadge({ estado }: { estado: string }) {
  if (estado === "MALO") return (
    <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200 shrink-0">
      <XCircle className="h-3 w-3" /> MALO
    </span>
  );
  if (estado === "REGULAR") return (
    <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 shrink-0">
      <AlertTriangle className="h-3 w-3" /> REGULAR
    </span>
  );
  if (estado === "NO_APLICA") return (
    <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
      <MinusCircle className="h-3 w-3" /> N/A
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200 shrink-0">
      <CheckCircle className="h-3 w-3" /> BUENO
    </span>
  );
}

// ── Section component ──
function InspeccionSeccion({ title, keys, data }: { title: string; keys: string[]; data?: SectionMap }) {
  if (!data) return null;
  const { ok, fallas, regular, na } = countSection(data);
  const fotoItems = keys.filter(k => data[k]?.estado === "MALO" && data[k]?.fotoUrl);

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center justify-between bg-gray-50 px-5 py-2.5 border-b border-gray-200">
        <span className="font-bold text-xs uppercase tracking-wider text-gray-500">{title}</span>
        <div className="flex items-center gap-3 text-xs font-semibold flex-wrap justify-end">
          <span className="text-green-700">{ok} OK</span>
          {fallas > 0 && <span className="text-red-600">{fallas} falla{fallas > 1 ? "s" : ""}</span>}
          {regular > 0 && <span className="text-amber-500">{regular} REGULAR</span>}
          {na > 0 && <span className="text-slate-500">{na} N/A</span>}
        </div>
      </div>

      {/* Items */}
      <div className="divide-y divide-gray-100">
        {keys.map((key) => {
          const item = data[key];
          if (!item) return null;
          const isFalla = item.estado === "MALO";
          return (
            <div key={key} className={`flex items-start gap-3 px-5 py-2.5 ${isFalla ? "bg-red-50" : ""}`}>
              <div className="flex-1 min-w-0">
                <span className={`text-sm font-medium ${isFalla ? "text-red-800" : "text-gray-700"}`}>
                  {labelForItem(key)}
                </span>
                {isFalla && item.observaciones && (
                  <p className="text-xs text-red-600 mt-0.5">{item.observaciones}</p>
                )}
              </div>
              <ItemBadge estado={item.estado} />
            </div>
          );
        })}
      </div>

      {/* Fault photos */}
      {fotoItems.length > 0 && (
        <div className="px-5 py-4 bg-red-50 border-t border-red-100">
          <p className="text-xs font-bold text-red-700 mb-3 uppercase tracking-wide">Evidencias fotográficas</p>
          <div className="flex flex-wrap gap-3">
            {fotoItems.map((key) => (
              <div key={key}>
                <img
                  src={data[key].fotoUrl!}
                  alt={`Evidencia ${labelForItem(key)}`}
                  className="h-32 w-44 object-cover rounded-lg border-2 border-red-200 shadow-sm"
                />
                <p className="text-xs text-red-600 mt-1 font-medium text-center">{labelForItem(key)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ──
export default function VerificarPreoperacional() {
  const { codigo } = useParams<{ codigo: string }>();
  const [searchParams] = useSearchParams();
  const autoPrint = searchParams.get("print") === "1";

  const { data, isLoading, isError } = useQuery({
    queryKey: ["verificar-preop", codigo],
    queryFn: async (): Promise<PreopVerificado> => {
      const res = await fetch(`${getApiRndcBaseUrl()}/api/verificar/preoperacional/${codigo}`);
      if (!res.ok) throw new Error("Registro no encontrado");
      const json = await res.json();
      return json.data ?? json;
    },
    enabled: !!codigo,
    retry: false,
  });

  // Auto-print cuando viene ?print=1. Esperamos a que todas las imagenes
  // (selfie, fotos de fallas) terminen de cargar antes de abrir el dialogo.
  useEffect(() => {
    if (!autoPrint || !data) return;
    let cancelled = false;
    const triggerPrint = () => {
      if (cancelled) return;
      const imgs = Array.from(document.images) as HTMLImageElement[];
      Promise.all(
        imgs.map((img) =>
          img.complete
            ? Promise.resolve()
            : new Promise<void>((resolve) => {
                img.addEventListener("load", () => resolve(), { once: true });
                img.addEventListener("error", () => resolve(), { once: true });
              }),
        ),
      ).then(() => {
        if (!cancelled) window.print();
      });
    };
    const t = setTimeout(triggerPrint, 500);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [autoPrint, data]);

  const totals = data ? {
    ok:
      countSection(data.seccionDelantera).ok +
      countSection(data.seccionMedia).ok +
      countSection(data.seccionTrasera).ok +
      countSection(data.seccionAseo).ok,
    fallas:
      countSection(data.seccionDelantera).fallas +
      countSection(data.seccionMedia).fallas +
      countSection(data.seccionTrasera).fallas +
      countSection(data.seccionAseo).fallas,
    total:
      Object.keys(data.seccionDelantera ?? {}).length +
      Object.keys(data.seccionMedia ?? {}).length +
      Object.keys(data.seccionTrasera ?? {}).length +
      Object.keys(data.seccionAseo ?? {}).length,
  } : { ok: 0, fallas: 0, total: 0 };

  const aprobado = data?.estadoGeneral === "APROBADO";

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print-bg { background-color: inherit !important; }
        }
        @page { size: A4; margin: 1cm 1.2cm; }
      `}</style>

      <div className="min-h-screen bg-gray-100">
        {/* Floating download */}
        <div className="no-print fixed bottom-6 right-6 z-50">
          <Button onClick={() => window.print()} className="gap-2 shadow-xl" disabled={!data} size="lg">
            <Download className="h-4 w-4" /> Descargar PDF
          </Button>
        </div>

        <div className="max-w-3xl mx-auto py-8 px-4">

          {isLoading && (
            <div className="flex flex-col items-center justify-center py-32 gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
              <p className="text-gray-500 font-medium">Verificando registro...</p>
            </div>
          )}

          {isError && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center">
              <AlertTriangle className="h-14 w-14 text-amber-400 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-800 mb-2">Registro no encontrado</h2>
              <p className="text-gray-500">El código QR es inválido o el registro fue eliminado del sistema.</p>
            </div>
          )}

          {data && (
            <div className="bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden">

              {/* ── HEADER ── */}
              <div className="bg-gradient-to-br from-[#0B5EA8] to-[#0A2E52] text-white px-6 py-6">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <ShieldCheck className="h-4 w-4 text-blue-300" />
                      <span className="font-bold text-sm tracking-tight text-blue-300">ASEGURAR</span>
                    </div>
                    {data.empresa?.razonSocial && (
                      <p className="font-black text-2xl tracking-tight text-white">
                        {data.empresa.razonSocial}
                      </p>
                    )}
                    {data.empresa?.nit && (
                      <p className="text-blue-200 text-xs mt-0.5">NIT {data.empresa.nit}</p>
                    )}
                    <p className="text-blue-300 text-sm font-medium mt-1">Registro de Inspección Preoperacional</p>
                  </div>
                  <div className="text-right">
                    <p className="text-blue-400 text-xs uppercase tracking-wider mb-0.5">Fecha de inspección</p>
                    <p className="text-white text-sm font-semibold">{formatDateFull(data.creadoEn)}</p>
                  </div>
                </div>
              </div>

              {/* ── ESTADO BANNER ── */}
              {aprobado ? (
                <div className="flex items-center gap-3 px-6 py-3 bg-green-600 text-white print-bg">
                  <CheckCircle className="h-5 w-5 shrink-0" />
                  <span className="font-bold tracking-wide">INSPECCIÓN APROBADA</span>
                  <span className="ml-auto text-green-200 text-sm font-medium">
                    {totals.ok}/{totals.total} ítems OK
                    {totals.fallas === 0 ? " · Sin fallas" : ` · ${totals.fallas} falla${totals.fallas > 1 ? "s" : ""}`}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-3 px-6 py-3 bg-amber-500 text-white print-bg">
                  <AlertTriangle className="h-5 w-5 shrink-0" />
                  <span className="font-bold tracking-wide">INSPECCIÓN CON NOVEDAD</span>
                  <span className="ml-auto text-amber-100 text-sm font-medium">
                    {totals.ok}/{totals.total} OK · {totals.fallas} falla{totals.fallas > 1 ? "s" : ""}
                  </span>
                </div>
              )}

              {/* ── DATOS VEHÍCULO + CONDUCTOR ── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-gray-200 border-b border-gray-200">
                {/* Vehículo */}
                <div className="px-6 py-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 bg-blue-50 rounded-lg">
                      <Car className="h-4 w-4 text-blue-600" />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Vehículo</span>
                  </div>
                  <p className="text-3xl font-black text-gray-800 tracking-wide mb-1">
                    {data.vehiculo?.placa ?? "—"}
                  </p>
                  {data.vehiculo?.numeroInterno && (
                    <p className="text-xs text-gray-400 mb-2">Interno #{data.vehiculo.numeroInterno}</p>
                  )}
                  <div className="space-y-1 text-sm">
                    {data.vehiculo?.marca && (
                      <div className="flex gap-2">
                        <span className="text-gray-400 w-14 shrink-0">Marca</span>
                        <span className="font-semibold text-gray-700">{data.vehiculo.marca}</span>
                      </div>
                    )}
                    {data.vehiculo?.linea && (
                      <div className="flex gap-2">
                        <span className="text-gray-400 w-14 shrink-0">Línea</span>
                        <span className="font-medium text-gray-700">{data.vehiculo.linea}</span>
                      </div>
                    )}
                    {data.vehiculo?.modelo && (
                      <div className="flex gap-2">
                        <span className="text-gray-400 w-14 shrink-0">Modelo</span>
                        <span className="font-medium text-gray-700">{data.vehiculo.modelo}</span>
                      </div>
                    )}
                  </div>
                  <div className="mt-3 inline-flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5 text-sm">
                    <span className="text-blue-500">Kilometraje:</span>
                    <span className="font-bold text-blue-800">{data.kilometraje?.toLocaleString() ?? "—"} km</span>
                  </div>
                </div>

                {/* Conductor */}
                <div className="px-6 py-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 bg-blue-50 rounded-lg">
                      <User className="h-4 w-4 text-blue-600" />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Conductor</span>
                  </div>
                  <p className="text-xl font-bold text-gray-800 mb-2 leading-tight">
                    {getConductorName(data.conductor)}
                  </p>
                  <div className="space-y-1.5 text-sm">
                    {data.conductor?.identificacion && (
                      <div className="flex gap-2">
                        <span className="text-gray-400 w-20 shrink-0">
                          {data.conductor.tipoId ?? "Identificación"}
                        </span>
                        <span className="font-semibold text-gray-700">{data.conductor.identificacion}</span>
                      </div>
                    )}
                    {data.conductor?.licencia && (
                      <div className="flex gap-2">
                        <span className="text-gray-400 w-20 shrink-0">Licencia</span>
                        <span className="font-medium text-gray-700">{data.conductor.licencia}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-gray-400 w-20 shrink-0">Declaración</span>
                      {data.firmadoCheck ? (
                        <span className="inline-flex items-center gap-1 text-green-700 bg-green-100 border border-green-200 rounded-full px-2 py-0.5 text-xs font-semibold">
                          <CheckCircle className="h-3 w-3" /> Firmada
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-700 bg-red-100 border border-red-200 rounded-full px-2 py-0.5 text-xs font-semibold">
                          <XCircle className="h-3 w-3" /> Sin firma
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* ── RESUMEN ── */}
              <div className="grid grid-cols-3 divide-x divide-gray-200 border-b border-gray-200 bg-gray-50">
                <div className="px-4 py-3 text-center">
                  <p className="text-2xl font-black text-gray-800">{totals.total}</p>
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mt-0.5">Ítems revisados</p>
                </div>
                <div className="px-4 py-3 text-center">
                  <p className="text-2xl font-black text-green-600">{totals.ok}</p>
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mt-0.5">En buen estado</p>
                </div>
                <div className="px-4 py-3 text-center">
                  <p className={`text-2xl font-black ${totals.fallas > 0 ? "text-red-600" : "text-gray-300"}`}>
                    {totals.fallas}
                  </p>
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mt-0.5">
                    {totals.fallas > 0 ? "Con falla" : "Sin fallas"}
                  </p>
                </div>
              </div>

              {/* ── SECCIÓN CONDUCTOR ── */}
              {data.seccionConductor && (
                <div className="border-b border-gray-200">
                  <div className="px-6 py-4 border-b border-gray-200 bg-blue-50">
                    <h2 className="text-sm font-bold text-blue-800 uppercase tracking-wide flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Estado del Conductor
                    </h2>
                  </div>
                  <div className="px-6 py-5">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Horas de Sueño</p>
                        <p className="text-2xl font-black text-gray-800">
                          {data.seccionConductor.horasSueno ?? "—"}
                          <span className="text-sm font-medium text-gray-400 ml-1">h</span>
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Estado Salud</p>
                        <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full border ${
                          data.seccionConductor.estadoSalud === "BUENO"
                            ? "bg-green-100 text-green-700 border-green-200"
                            : data.seccionConductor.estadoSalud === "REGULAR"
                            ? "bg-amber-100 text-amber-700 border-amber-200"
                            : "bg-red-100 text-red-700 border-red-200"
                        }`}>
                          {data.seccionConductor.estadoSalud === "BUENO" ? <CheckCircle className="h-3 w-3" /> :
                           data.seccionConductor.estadoSalud === "REGULAR" ? <AlertTriangle className="h-3 w-3" /> :
                           <XCircle className="h-3 w-3" />}
                          {data.seccionConductor.estadoSalud || "—"}
                        </span>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Medicamentos</p>
                        <p className="text-sm font-bold text-gray-800">
                          {data.seccionConductor.tomaMedicamentos ? "Sí" : "No"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Sustancias</p>
                        <p className="text-sm font-bold text-gray-800">
                          {data.seccionConductor.consumoSustancias ? "Sí" : "No"}
                        </p>
                      </div>
                    </div>

                    {data.seccionConductor.estadoSaludObservaciones && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
                        <p className="text-xs font-bold uppercase tracking-wider text-amber-700 mb-1">Observaciones de salud</p>
                        <p className="text-sm text-amber-900">{data.seccionConductor.estadoSaludObservaciones}</p>
                      </div>
                    )}

                    {data.seccionConductor.medicamentosDetalle && (
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-3">
                        <p className="text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">Detalle medicamentos</p>
                        <p className="text-sm text-gray-800">{data.seccionConductor.medicamentosDetalle}</p>
                      </div>
                    )}

                    {data.seccionConductor.sustanciasDetalle && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
                        <p className="text-xs font-bold uppercase tracking-wider text-red-700 mb-1">Detalle sustancias</p>
                        <p className="text-sm text-red-900">{data.seccionConductor.sustanciasDetalle}</p>
                      </div>
                    )}

                    {data.seccionConductor.selfieUrl && (
                      <div className="mt-3">
                        <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Selfie del conductor</p>
                        <img
                          src={data.seccionConductor.selfieUrl}
                          alt="Selfie conductor"
                          className="h-32 w-32 object-cover rounded-lg border-2 border-gray-200 shadow-sm"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── CHECKLIST ── */}
              <div>
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Checklist de Inspección</h2>
                </div>
                <div className="divide-y divide-gray-200">
                  <InspeccionSeccion title="Sección Delantera" keys={SECCION_DELANTERA} data={data.seccionDelantera} />
                  <InspeccionSeccion title="Sección Media" keys={SECCION_MEDIA} data={data.seccionMedia} />
                  <InspeccionSeccion title="Sección Trasera" keys={SECCION_TRASERA} data={data.seccionTrasera} />
                  <InspeccionSeccion title="Sección Aseo" keys={SECCION_ASEO} data={data.seccionAseo} />
                </div>
              </div>

              {/* ── OBSERVACIONES ── */}
              {data.observaciones && (
                <div className="px-6 py-4 border-t border-amber-200 bg-amber-50">
                  <p className="text-xs font-bold uppercase tracking-wider text-amber-600 mb-1">Observaciones Generales</p>
                  <p className="text-sm text-amber-900">{data.observaciones}</p>
                </div>
              )}

              {/* ── FIRMA ── */}
              {data.firmaConductorUrl && (
                <div className="px-6 py-5 border-t border-gray-200">
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Firma del Conductor</p>
                  <div className="inline-block bg-white border-2 border-gray-200 rounded-xl p-3 shadow-sm">
                    <img src={data.firmaConductorUrl} alt="Firma" className="h-24 object-contain" />
                  </div>
                  <p className="text-xs text-gray-500 mt-2 font-medium">{getConductorName(data.conductor)}</p>
                  {data.conductor?.identificacion && (
                    <p className="text-xs text-gray-400">{data.conductor.tipoId ?? "CC"} {data.conductor.identificacion}</p>
                  )}
                </div>
              )}

              {/* ── EMPRESA (si aplica) ── */}
              {data.empresa?.razonSocial && (
                <div className="px-6 py-4 border-t border-gray-200 flex items-center gap-3 bg-gray-50">
                  <Building2 className="h-4 w-4 text-gray-400 shrink-0" />
                  <div className="text-sm">
                    <span className="font-semibold text-gray-700">{data.empresa.razonSocial}</span>
                    {data.empresa.nit && <span className="text-gray-400 ml-2">NIT {data.empresa.nit}</span>}
                  </div>
                </div>
              )}

              {/* ── FOOTER LEGAL ── */}
              <div className="px-6 py-5 bg-[#0A2E52] text-white">
                <div className="flex items-center gap-2 mb-3">
                  <ShieldCheck className="h-4 w-4 text-blue-300 shrink-0" />
                  <span className="text-sm font-bold text-blue-200">Documento Verificado · ASEGURAR</span>
                </div>
                <div className="space-y-1.5 text-xs text-blue-300 leading-relaxed">
                  <p>
                    Este registro fue generado electrónicamente por la plataforma <strong className="text-white">ASEGURAR</strong> y
                    constituye constancia oficial de la inspección preoperacional realizada por el conductor indicado.
                  </p>
                  <p>
                    El conductor es responsable de la veracidad de la información aquí consignada. La empresa operadora
                    puede verificar la autenticidad de este documento mediante el código QR asociado.
                  </p>
                  <p className="text-blue-400 pt-2 border-t border-blue-800 mt-2">
                    © ASEGURAR — Todos los derechos reservados. Documento de uso interno y operativo.
                    Prohibida su reproducción o modificación sin autorización expresa.
                  </p>
                </div>
              </div>

            </div>
          )}
        </div>
      </div>
    </>
  );
}

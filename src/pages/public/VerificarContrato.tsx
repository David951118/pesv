import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getApiRndcBaseUrl } from "@/services/apirndc/apirndc.config";
import { Loader2, Download, ShieldCheck, AlertTriangle, FileText, Car, User, Building2, MapPin, Calendar, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface ContratoVerificado {
  consecutivo?: number;
  anio?: number;
  numeroFUEC?: string;
  estado?: string;
  objetoContrato?: string;
  origen?: string;
  destino?: string;
  recorridoEspecifico?: string;
  ruta?: string | { origen?: string; destino?: string; recorrido?: string };
  vigenciaInicio?: string;
  vigenciaFin?: string;
  creadoEn?: string;
  createdAt?: string;
  vehiculo?: { placa?: string; numeroInterno?: string; marca?: string; linea?: string; modelo?: string | number };
  conductor?: { nombres?: string; apellidos?: string; identificacion?: string; tipoId?: string; licencia?: string; categoria?: string };
  conductorPrincipal?: { nombres?: string; apellidos?: string; identificacion?: string; tipoId?: string; licencia?: string; categoria?: string };
  contratante?: { razonSocial?: string; nombres?: string; apellidos?: string; identificacion?: string; tipoId?: string };
  empresa?: { razonSocial?: string; nit?: string };
  datosSnapshot?: {
    soat?: { numero: string; vigencia: string; aseguradora: string };
    tecnomecanica?: { numero: string; vigencia: string; cda: string };
    rce?: { numero: string; vigencia: string; aseguradora?: string };
    rcc?: { numero: string; vigencia: string; aseguradora?: string };
    tarjetaOperacion?: { numero: string; vigencia: string };
    licenciaConductor?: { numero: string; vigencia: string; categoria: string };
  };
  contadorQR?: number;
}

function formatDateFull(d?: string) {
  if (!d) return "—";
  try { return format(new Date(d), "dd 'de' MMMM 'de' yyyy", { locale: es }); }
  catch { return d; }
}

function formatDateShort(d?: string) {
  if (!d) return "—";
  try { return format(new Date(d), "dd MMM yyyy", { locale: es }); }
  catch { return d; }
}

function getContratanteNombre(c?: ContratoVerificado["contratante"]) {
  if (!c) return "—";
  if (c.razonSocial) return c.razonSocial;
  if (c.nombres) return `${c.nombres} ${c.apellidos || ""}`.trim();
  return "—";
}

function getConductorData(data: ContratoVerificado) {
  return data.conductorPrincipal || data.conductor;
}

function getConductorNombre(data: ContratoVerificado) {
  const c = getConductorData(data);
  if (!c) return "—";
  if (c.nombres) return `${c.nombres} ${c.apellidos || ""}`.trim();
  return "—";
}

function getEstadoColor(estado?: string) {
  switch (estado) {
    case "ACTIVO": return { bg: "bg-green-600", text: "text-white" };
    case "GENERADO": return { bg: "bg-blue-600", text: "text-white" };
    case "FINALIZADO": return { bg: "bg-gray-500", text: "text-white" };
    case "ANULADO": return { bg: "bg-red-600", text: "text-white" };
    default: return { bg: "bg-gray-400", text: "text-white" };
  }
}

function getRuta(data: ContratoVerificado) {
  if (data.origen && data.destino) return { origen: data.origen, destino: data.destino, recorrido: data.recorridoEspecifico };
  if (data.ruta && typeof data.ruta === "object") return { origen: data.ruta.origen, destino: data.ruta.destino, recorrido: data.ruta.recorrido };
  if (typeof data.ruta === "string") return { origen: undefined, destino: undefined, recorrido: data.ruta };
  return null;
}

function SnapshotItem({ titulo, numero, vigencia, extra }: { titulo: string; numero: string; vigencia: string; extra?: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">{titulo}</p>
      <p className="text-sm font-semibold text-gray-800 mt-0.5">{numero}</p>
      <p className="text-xs text-gray-500">Vence: {formatDateShort(vigencia)}</p>
      {extra && <p className="text-xs text-gray-400">{extra}</p>}
    </div>
  );
}

export default function VerificarContrato() {
  const { codigo } = useParams<{ codigo: string }>();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["verificar-contrato", codigo],
    queryFn: async (): Promise<ContratoVerificado> => {
      const res = await fetch(`${getApiRndcBaseUrl()}/api/verificar/contrato/${codigo}`);
      if (!res.ok) throw new Error("Registro no encontrado");
      const json = await res.json();
      return json.data ?? json;
    },
    enabled: !!codigo,
    retry: false,
  });

  const estadoColor = getEstadoColor(data?.estado);
  const ruta = data ? getRuta(data) : null;
  const fecha = data?.creadoEn || data?.createdAt;
  const snapshot = data?.datosSnapshot;

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        @page { size: A4; margin: 1cm 1.2cm; }
      `}</style>

      <div className="min-h-screen bg-gray-100">
        <div className="no-print fixed bottom-6 right-6 z-50">
          <Button onClick={() => window.print()} className="gap-2 shadow-xl" disabled={!data} size="lg">
            <Download className="h-4 w-4" /> Descargar PDF
          </Button>
        </div>

        <div className="max-w-3xl mx-auto py-8 px-4">

          {isLoading && (
            <div className="flex flex-col items-center justify-center py-32 gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
              <p className="text-gray-500 font-medium">Verificando contrato...</p>
            </div>
          )}

          {isError && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center">
              <AlertTriangle className="h-14 w-14 text-amber-400 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-800 mb-2">Contrato no encontrado</h2>
              <p className="text-gray-500">El código QR es inválido o el contrato fue eliminado del sistema.</p>
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
                    <p className="text-blue-300 text-sm font-medium mt-1">Formato Único de Extracto del Contrato — FUEC</p>
                  </div>
                  <div className="text-right">
                    <p className="text-blue-400 text-xs uppercase tracking-wider mb-0.5">N° FUEC</p>
                    <p className="text-white text-lg font-black font-mono">
                      {data.numeroFUEC || `${data.consecutivo || "—"}-${data.anio || ""}`}
                    </p>
                    {fecha && (
                      <p className="text-blue-300 text-xs mt-1">{formatDateFull(fecha)}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* ── ESTADO BANNER ── */}
              <div className={`flex items-center gap-3 px-6 py-3 ${estadoColor.bg} ${estadoColor.text}`}>
                {data.estado === "ACTIVO" ? (
                  <CheckCircle className="h-5 w-5 shrink-0" />
                ) : (
                  <FileText className="h-5 w-5 shrink-0" />
                )}
                <span className="font-bold tracking-wide">CONTRATO {data.estado || "—"}</span>
                {data.consecutivo && (
                  <span className="ml-auto text-sm opacity-80">Consecutivo: {data.consecutivo}</span>
                )}
              </div>

              {/* ── DATOS PRINCIPALES ── */}
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
                </div>

                {/* Conductor */}
                <div className="px-6 py-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 bg-blue-50 rounded-lg">
                      <User className="h-4 w-4 text-blue-600" />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Conductor Principal</span>
                  </div>
                  {(() => { const c = getConductorData(data); return (<>
                  <p className="text-xl font-bold text-gray-800 mb-2 leading-tight">
                    {getConductorNombre(data)}
                  </p>
                  <div className="space-y-1.5 text-sm">
                    {c?.identificacion && (
                      <div className="flex gap-2">
                        <span className="text-gray-400 w-20 shrink-0">{c.tipoId ?? "Identificación"}</span>
                        <span className="font-semibold text-gray-700">{c.identificacion}</span>
                      </div>
                    )}
                    {(c?.licencia || c?.categoria) && (
                      <div className="flex gap-2">
                        <span className="text-gray-400 w-20 shrink-0">Licencia</span>
                        <span className="font-medium text-gray-700">
                          {c.licencia || "—"}{c.categoria ? ` (${c.categoria})` : ""}
                        </span>
                      </div>
                    )}
                  </div>
                  </>); })()}
                </div>
              </div>

              {/* ── CONTRATANTE ── */}
              {data.contratante && (
                <div className="px-6 py-4 border-b border-gray-200 flex items-start gap-3">
                  <div className="p-1.5 bg-amber-50 rounded-lg mt-0.5">
                    <Building2 className="h-4 w-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-0.5">Contratante</p>
                    <p className="text-sm font-bold text-gray-800">{getContratanteNombre(data.contratante)}</p>
                    {data.contratante.identificacion && (
                      <p className="text-xs text-gray-500">{data.contratante.tipoId ?? "ID"}: {data.contratante.identificacion}</p>
                    )}
                  </div>
                </div>
              )}

              {/* ── OBJETO DEL CONTRATO ── */}
              {data.objetoContrato && (
                <div className="px-6 py-4 border-b border-gray-200">
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Objeto del Contrato</p>
                  <p className="text-sm text-gray-700">{data.objetoContrato}</p>
                </div>
              )}

              {/* ── RUTA ── */}
              {ruta && (ruta.origen || ruta.destino || ruta.recorrido) && (
                <div className="px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center gap-2 mb-3">
                    <MapPin className="h-4 w-4 text-gray-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Ruta</span>
                  </div>
                  {ruta.origen && ruta.destino && (
                    <div className="flex items-center gap-3 mb-2">
                      <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5 text-sm font-semibold text-blue-800">
                        {ruta.origen}
                      </div>
                      <span className="text-gray-400 font-bold">&rarr;</span>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5 text-sm font-semibold text-blue-800">
                        {ruta.destino}
                      </div>
                    </div>
                  )}
                  {ruta.recorrido && (
                    <p className="text-xs text-gray-500">Recorrido: {ruta.recorrido}</p>
                  )}
                </div>
              )}

              {/* ── VIGENCIA ── */}
              {(data.vigenciaInicio || data.vigenciaFin) && (
                <div className="px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Vigencia del Contrato</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">
                      <span className="text-xs text-green-600 font-medium">Desde</span>
                      <p className="font-bold text-green-800">{formatDateShort(data.vigenciaInicio)}</p>
                    </div>
                    <span className="text-gray-400 font-bold">—</span>
                    <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
                      <span className="text-xs text-red-600 font-medium">Hasta</span>
                      <p className="font-bold text-red-800">{formatDateShort(data.vigenciaFin)}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* ── DOCUMENTOS SNAPSHOT ── */}
              {snapshot && (
                <div className="px-6 py-5 border-b border-gray-200">
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
                    Documentos Vigentes al Momento de la Emisión
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {snapshot.soat && (
                      <SnapshotItem titulo="SOAT" numero={snapshot.soat.numero} vigencia={snapshot.soat.vigencia} extra={snapshot.soat.aseguradora} />
                    )}
                    {snapshot.tecnomecanica && (
                      <SnapshotItem titulo="Tecnomecánica" numero={snapshot.tecnomecanica.numero} vigencia={snapshot.tecnomecanica.vigencia} extra={snapshot.tecnomecanica.cda} />
                    )}
                    {snapshot.rce && (
                      <SnapshotItem titulo="RCE" numero={snapshot.rce.numero} vigencia={snapshot.rce.vigencia} extra={snapshot.rce.aseguradora} />
                    )}
                    {snapshot.rcc && (
                      <SnapshotItem titulo="RCC" numero={snapshot.rcc.numero} vigencia={snapshot.rcc.vigencia} extra={snapshot.rcc.aseguradora} />
                    )}
                    {snapshot.tarjetaOperacion && (
                      <SnapshotItem titulo="Tarjeta de Operación" numero={snapshot.tarjetaOperacion.numero} vigencia={snapshot.tarjetaOperacion.vigencia} />
                    )}
                    {snapshot.licenciaConductor && (
                      <SnapshotItem titulo="Licencia de Conducción" numero={`${snapshot.licenciaConductor.numero} (${snapshot.licenciaConductor.categoria})`} vigencia={snapshot.licenciaConductor.vigencia} />
                    )}
                  </div>
                </div>
              )}

              {/* ── EMPRESA ── */}
              {data.empresa?.razonSocial && (
                <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-3 bg-gray-50">
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
                    Este Formato Único de Extracto del Contrato (FUEC) fue generado electrónicamente por la plataforma
                    <strong className="text-white"> ASEGURAR</strong> y constituye constancia oficial del contrato de servicio
                    de transporte especial celebrado entre las partes indicadas.
                  </p>
                  <p>
                    La empresa de transporte es responsable de la veracidad de la información aquí consignada.
                    La autenticidad de este documento puede ser verificada mediante el código QR asociado.
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

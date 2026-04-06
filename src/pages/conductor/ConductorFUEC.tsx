import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { getApiRndcBaseUrl } from "@/services/apirndc/apirndc.config";
import { ConductorLayout } from "@/components/layout/ConductorLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FileText,
  Search,
  Filter,
  Loader2,
  Eye,
  ExternalLink,
  MapPin,
  Truck,
  User,
  Calendar,
  QrCode,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { QRShareModal } from "@/components/preoperativas/QRShareModal";

// ── Types ──

interface ContratoFUEC {
  _id: string;
  consecutivo: number;
  anio?: number;
  numeroFUEC?: string;
  contratante?: any;
  vehiculo?: any;
  conductorPrincipal?: any;
  conductoresAuxiliares?: string[];
  ruta?: string;
  objetoContrato?: string;
  origen?: string;
  destino?: string;
  recorridoEspecifico?: string;
  vigenciaInicio?: string;
  vigenciaFin?: string;
  codigoPublico?: string;
  estado: string;
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
  createdAt?: string;
  updatedAt?: string;
}

// ── Helpers ──

function formatDate(date?: string) {
  if (!date) return "\u2014";
  return format(new Date(date), "dd MMM yyyy", { locale: es });
}

function getLabel(obj: any, fallback = "\u2014"): string {
  if (!obj) return fallback;
  if (typeof obj === "string") return obj;
  return (
    obj.placa ||
    obj.razonSocial ||
    (obj.nombres ? `${obj.nombres} ${obj.apellidos || ""}`.trim() : null) ||
    obj.nombre ||
    obj._id ||
    fallback
  );
}

function getEstadoVariant(
  estado: string
): "default" | "secondary" | "outline" | "destructive" {
  switch (estado) {
    case "ACTIVO":
      return "default";
    case "GENERADO":
      return "secondary";
    case "FINALIZADO":
      return "outline";
    case "ANULADO":
      return "destructive";
    default:
      return "secondary";
  }
}

const ITEMS_PER_PAGE = 15;

// ── Main Component ──

export default function ConductorFUEC() {
  const { bearerToken, conductorId } = useAuth();

  const [search, setSearch] = useState("");
  const [estadoFilter, setEstadoFilter] = useState("todos");
  const [page, setPage] = useState(1);

  const [viewingContrato, setViewingContrato] = useState<ContratoFUEC | null>(
    null
  );
  const [qrData, setQrData] = useState<{
    open: boolean;
    codigoPublico: string;
    label: string;
    placa: string;
    fecha?: string;
  } | null>(null);
  const [loadingQr, setLoadingQr] = useState<string | null>(null);

  // ── Fetch contratos for this conductor ──
  const { data, isLoading } = useQuery({
    queryKey: ["conductor-fuec-contratos", page, conductorId],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(ITEMS_PER_PAGE),
      });
      if (conductorId) params.set("conductorId", conductorId);
      const res = await fetch(
        `${getApiRndcBaseUrl()}/api/contratos?${params}`,
        {
          headers: { Authorization: `Bearer ${bearerToken}` },
        }
      );
      if (!res.ok) throw new Error("Error al cargar contratos");
      const json = await res.json();
      return {
        items: (Array.isArray(json.data) ? json.data : []) as ContratoFUEC[],
        pagination: json.pagination || { page, total: 0, pages: 1 },
      };
    },
    enabled: !!bearerToken && !!conductorId,
  });

  const contratos = data?.items || [];
  const pagination = data?.pagination;

  // ── Client-side filter ──
  const filtered = contratos.filter((c) => {
    const s = search.toLowerCase();
    const matchSearch =
      !s ||
      c.numeroFUEC?.toLowerCase().includes(s) ||
      String(c.consecutivo).includes(s) ||
      getLabel(c.contratante).toLowerCase().includes(s) ||
      getLabel(c.vehiculo).toLowerCase().includes(s) ||
      c.origen?.toLowerCase().includes(s) ||
      c.destino?.toLowerCase().includes(s) ||
      c.ruta?.toLowerCase().includes(s);
    const matchEstado = estadoFilter === "todos" || c.estado === estadoFilter;
    return matchSearch && matchEstado;
  });

  // ── QR handler ──
  const handleOpenQR = async (c: ContratoFUEC) => {
    if (c.codigoPublico) {
      setQrData({
        open: true,
        codigoPublico: c.codigoPublico,
        label: c.numeroFUEC || String(c.consecutivo),
        placa: getLabel(c.vehiculo),
        fecha: c.createdAt
          ? format(new Date(c.createdAt), "dd MMM yyyy", { locale: es })
          : undefined,
      });
      return;
    }
    setLoadingQr(c._id);
    try {
      const res = await fetch(
        `${getApiRndcBaseUrl()}/api/contratos/${c._id}/qr`,
        {
          headers: { Authorization: `Bearer ${bearerToken}` },
        }
      );
      if (!res.ok) throw new Error("No se pudo obtener QR");
      const json = await res.json();
      const d = json.data ?? json;
      const codigo =
        d.codigoPublico ||
        d.qrCodeData?.codigoPublico ||
        (d.qrVerificationUrl ? d.qrVerificationUrl.split("/").pop() : null);
      if (!codigo) throw new Error("Codigo QR no disponible");
      setQrData({
        open: true,
        codigoPublico: codigo,
        label: c.numeroFUEC || String(c.consecutivo),
        placa: getLabel(c.vehiculo),
        fecha: c.createdAt
          ? format(new Date(c.createdAt), "dd MMM yyyy", { locale: es })
          : undefined,
      });
    } catch (e: any) {
      toast.error(e.message || "Error al obtener QR");
    } finally {
      setLoadingQr(null);
    }
  };

  // ── Render ──
  return (
    <ConductorLayout>
      {viewingContrato ? (
        <ContratoDetailView
          contrato={viewingContrato}
          onBack={() => setViewingContrato(null)}
          onOpenQR={handleOpenQR}
          loadingQr={loadingQr}
        />
      ) : (
        <div className="space-y-4">
          {/* Header */}
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Mis Contratos FUEC
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Formato Unico de Extracto del Contrato
            </p>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por N. FUEC, contratante, ruta..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={estadoFilter} onValueChange={setEstadoFilter}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="GENERADO">Generado</SelectItem>
                  <SelectItem value="ACTIVO">Activo</SelectItem>
                  <SelectItem value="FINALIZADO">Finalizado</SelectItem>
                  <SelectItem value="ANULADO">Anulado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Content */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <div className="bg-card border border-border rounded-lg p-8 shadow-sm">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  {search || estadoFilter !== "todos"
                    ? "No se encontraron contratos con los filtros aplicados"
                    : "No tienes contratos FUEC asignados"}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((c) => (
                <div
                  key={c._id}
                  className="bg-card border border-border rounded-lg p-4 shadow-sm"
                >
                  {/* Card header */}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-mono font-semibold text-sm text-foreground">
                        FUEC {c.numeroFUEC || String(c.consecutivo)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {getLabel(c.contratante)}
                      </p>
                    </div>
                    <Badge variant={getEstadoVariant(c.estado)}>
                      {c.estado}
                    </Badge>
                  </div>

                  {/* Card body */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm mb-3">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Truck className="h-3.5 w-3.5 shrink-0" />
                      <span>{getLabel(c.vehiculo)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">
                        {c.origen && c.destino
                          ? `${c.origen} \u2192 ${c.destino}`
                          : c.ruta || "\u2014"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground sm:col-span-2">
                      <Calendar className="h-3.5 w-3.5 shrink-0" />
                      <span>
                        {formatDate(c.vigenciaInicio)} -{" "}
                        {formatDate(c.vigenciaFin)}
                      </span>
                    </div>
                  </div>

                  {/* Card actions */}
                  <div className="flex items-center gap-2 border-t border-border pt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => setViewingContrato(c)}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Ver detalle
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => handleOpenQR(c)}
                      disabled={loadingQr === c._id}
                    >
                      {loadingQr === c._id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <QrCode className="h-3.5 w-3.5" />
                      )}
                      QR
                    </Button>
                    {c.pdfUrl && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        asChild
                      >
                        <a
                          href={c.pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          PDF
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              ))}

              {/* Pagination */}
              {pagination && pagination.pages > 1 && (
                <div className="flex items-center justify-between pt-2">
                  <p className="text-sm text-muted-foreground">
                    Pagina {pagination.page} de {pagination.pages} (
                    {pagination.total} contratos)
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage(page - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" /> Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= pagination.pages}
                      onClick={() => setPage(page + 1)}
                    >
                      Siguiente <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* QR Share Modal */}
      {qrData?.open && (
        <QRShareModal
          open
          onClose={() => setQrData(null)}
          codigoPublico={qrData.codigoPublico}
          tipo="contrato"
          label={qrData.label}
          placa={qrData.placa}
          fecha={qrData.fecha}
        />
      )}
    </ConductorLayout>
  );
}

// ════════════════════════════════════════════════════
// Detail View (inline, not a dialog — mobile-friendly)
// ════════════════════════════════════════════════════

function ContratoDetailView({
  contrato,
  onBack,
  onOpenQR,
  loadingQr,
}: {
  contrato: ContratoFUEC;
  onBack: () => void;
  onOpenQR: (c: ContratoFUEC) => void;
  loadingQr: string | null;
}) {
  const fields = [
    { label: "N. FUEC", value: contrato.numeroFUEC || String(contrato.consecutivo) },
    { label: "Estado", value: contrato.estado, badge: true },
    { label: "Contratante", value: getLabel(contrato.contratante) },
    { label: "Vehiculo", value: getLabel(contrato.vehiculo) },
    { label: "Conductor Principal", value: getLabel(contrato.conductorPrincipal) },
    { label: "Objeto del Contrato", value: contrato.objetoContrato || "\u2014" },
    { label: "Ruta", value: contrato.origen && contrato.destino ? `${contrato.origen} → ${contrato.destino}` : (typeof contrato.ruta === "object" ? (contrato.ruta as any)?.recorrido || "—" : (contrato.ruta && contrato.ruta.length === 24 && /^[a-f0-9]+$/.test(contrato.ruta) ? "—" : contrato.ruta || "—")) },
    {
      label: "Recorrido Especifico",
      value: contrato.recorridoEspecifico || "\u2014",
    },
    { label: "Vigencia Inicio", value: formatDate(contrato.vigenciaInicio) },
    { label: "Vigencia Fin", value: formatDate(contrato.vigenciaFin) },
    {
      label: "Creado",
      value: contrato.createdAt
        ? format(new Date(contrato.createdAt), "dd MMM yyyy HH:mm", {
            locale: es,
          })
        : "\u2014",
    },
  ];

  const snapshot = contrato.datosSnapshot;

  return (
    <div className="space-y-4">
      {/* Back button & title */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            FUEC {contrato.numeroFUEC || contrato.consecutivo}
          </h2>
          <p className="text-xs text-muted-foreground">Detalle del contrato</p>
        </div>
      </div>

      {/* Contract info card */}
      <div className="bg-card border border-border rounded-lg p-4 shadow-sm space-y-2">
        {fields.map((f) => (
          <div
            key={f.label}
            className="flex justify-between items-start py-2 border-b border-border last:border-0"
          >
            <span className="text-sm text-muted-foreground">{f.label}</span>
            {f.badge ? (
              <Badge variant={getEstadoVariant(String(f.value))}>
                {f.value}
              </Badge>
            ) : (
              <span className="text-sm font-medium text-foreground text-right max-w-[60%]">
                {f.value}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Document snapshot */}
      {snapshot && Object.keys(snapshot).length > 0 && (
        <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
          <p className="text-sm font-semibold mb-3">
            Documentos del Vehiculo (Snapshot)
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {snapshot.soat && (
              <SnapshotCard
                title="SOAT"
                numero={snapshot.soat.numero}
                extra={`Vence: ${formatDate(snapshot.soat.vigencia)} — ${snapshot.soat.aseguradora}`}
              />
            )}
            {snapshot.tecnomecanica && (
              <SnapshotCard
                title="Tecnomecanica"
                numero={snapshot.tecnomecanica.numero}
                extra={`Vence: ${formatDate(snapshot.tecnomecanica.vigencia)} — ${snapshot.tecnomecanica.cda}`}
              />
            )}
            {snapshot.rce && (
              <SnapshotCard
                title="RCE"
                numero={snapshot.rce.numero}
                extra={`Vence: ${formatDate(snapshot.rce.vigencia)}`}
              />
            )}
            {snapshot.rcc && (
              <SnapshotCard
                title="RCC"
                numero={snapshot.rcc.numero}
                extra={`Vence: ${formatDate(snapshot.rcc.vigencia)}`}
              />
            )}
            {snapshot.tarjetaOperacion && (
              <SnapshotCard
                title="Tarjeta Operacion"
                numero={snapshot.tarjetaOperacion.numero}
                extra={`Vence: ${formatDate(snapshot.tarjetaOperacion.vigencia)}`}
              />
            )}
            {snapshot.licenciaConductor && (
              <SnapshotCard
                title="Licencia Conductor"
                numero={`${snapshot.licenciaConductor.numero} (${snapshot.licenciaConductor.categoria})`}
                extra={`Vence: ${formatDate(snapshot.licenciaConductor.vigencia)}`}
              />
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-2">
        <Button
          variant="outline"
          className="gap-2 flex-1"
          onClick={() => onOpenQR(contrato)}
          disabled={loadingQr === contrato._id}
        >
          {loadingQr === contrato._id ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <QrCode className="h-4 w-4" />
          )}
          Compartir QR
        </Button>
        {contrato.pdfUrl && (
          <Button variant="outline" className="gap-2 flex-1" asChild>
            <a
              href={contrato.pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="h-4 w-4" />
              Ver PDF del FUEC
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Snapshot Card ──

function SnapshotCard({
  title,
  numero,
  extra,
}: {
  title: string;
  numero: string;
  extra: string;
}) {
  return (
    <div className="bg-muted/30 rounded-lg p-3">
      <p className="text-xs font-semibold text-muted-foreground">{title}</p>
      <p className="text-sm">{numero}</p>
      <p className="text-xs text-muted-foreground">{extra}</p>
    </div>
  );
}

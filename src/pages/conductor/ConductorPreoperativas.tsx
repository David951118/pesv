import { useState, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { getApiRndcBaseUrl } from "@/services/apirndc/apirndc.config";
import { useSessionState } from "@/hooks/useSessionState";
import { ConductorLayout } from "@/components/layout/ConductorLayout";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  ClipboardCheck,
  Loader2,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Camera,
  Car,
  ArrowLeft,
  Send,
  ShieldAlert,
  FileWarning,
  History,
  QrCode,
} from "lucide-react";
import { toast } from "sonner";
import { SignaturePad } from "@/components/preoperativas/SignaturePad";
import { uploadFileToS3 } from "@/lib/uploadToS3";
import { QRShareModal } from "@/components/preoperativas/QRShareModal";
import { format } from "date-fns";
import { es } from "date-fns/locale";

// ── Section definitions ──

const SECCION_DELANTERA_ITEMS = [
  { key: "luces", label: "Luces" },
  { key: "direccionalesDelanteros", label: "Direccionales Delanteros" },
  { key: "limpiabrisas", label: "Limpiabrisas" },
  { key: "espejosRetrovisores", label: "Espejos Retrovisores" },
  { key: "liquidos", label: "Líquidos" },
  { key: "llantaDelanteraDerecha", label: "Llanta Delantera Derecha" },
  { key: "llantaDelanteraIzquierda", label: "Llanta Delantera Izquierda" },
  { key: "bocina", label: "Bocina" },
  { key: "frenos", label: "Frenos" },
] as const;

const SECCION_MEDIA_ITEMS = [
  { key: "tablero", label: "Tablero" },
  { key: "timon", label: "Timón" },
  { key: "cinturones", label: "Cinturones" },
  { key: "pedales", label: "Pedales" },
  { key: "frenoMano", label: "Freno de Mano" },
  { key: "bateria", label: "Batería" },
  { key: "kitCarretera", label: "Kit de Carretera" },
  { key: "reflectivos", label: "Reflectivos" },
] as const;

const SECCION_TRASERA_ITEMS = [
  { key: "stop", label: "Stop" },
  { key: "llantasRepuesto", label: "Llantas de Repuesto" },
  { key: "equipoCarretera", label: "Equipo de Carretera" },
  { key: "llantaTraseraDerecha", label: "Llanta Trasera Derecha" },
  { key: "llantaTraseraIzquierda", label: "Llanta Trasera Izquierda" },
  { key: "direccionalesTraseros", label: "Direccionales Traseros" },
  { key: "placa", label: "Placa" },
] as const;

const ALL_ITEMS = [
  ...SECCION_DELANTERA_ITEMS,
  ...SECCION_MEDIA_ITEMS,
  ...SECCION_TRASERA_ITEMS,
];

const TOTAL_ITEMS = ALL_ITEMS.length; // 24

// ── Types ──

interface PreopHistorialItem {
  _id: string;
  codigoPublico?: string;
  fechaCreacion?: string;
  createdAt?: string;
  vehiculo?: { placa?: string } | string;
  estadoGeneral?: string;
  seccionDelantera?: Record<string, { estado: string }>;
  seccionMedia?: Record<string, { estado: string }>;
  seccionTrasera?: Record<string, { estado: string }>;
}

type ItemEstado = "OK" | "FALLA" | null;

interface ItemState {
  estado: ItemEstado;
  observaciones: string;
  fotoCapturada: boolean;
}

type FormItems = Record<string, ItemState>;

interface VehiculoInfo {
  _id: string;
  placa: string;
  marca: string;
  linea: string;
  modelo: string;
  cellviId: number;
  found: true;
}

interface VehiculoNotFound {
  cellviId: number;
  placa: string;
  found: false;
}

type VehiculoResult = VehiculoInfo | VehiculoNotFound;

// ── Helper: default item state ──

function defaultItems(): FormItems {
  const items: FormItems = {};
  for (const item of ALL_ITEMS) {
    items[item.key] = { estado: null, observaciones: "", fotoCapturada: false };
  }
  return items;
}

// ── Component ──

interface ValidationResult {
  autorizado: boolean;
  errores: { campo: string; mensaje: string }[];
  alertas: { campo: string; mensaje: string }[];
}

export default function ConductorPreoperativas() {
  const { user, bearerToken, conductorId } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const cellviVehiculos = user?.vehiculos || [];

  // Vehicle selection state
  const [selectedVehiculo, setSelectedVehiculo] = useState<VehiculoInfo | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [validating, setValidating] = useState(false);

  // Historial state
  const [showHistorial, setShowHistorial] = useState(false);
  const [qrItem, setQrItem] = useState<PreopHistorialItem | null>(null);

  // Form state persisted in session
  const [formItems, setFormItems, clearFormItems] = useSessionState<FormItems>(
    "preop-form-items",
    defaultItems()
  );
  const [kilometraje, setKilometraje, clearKilometraje] = useSessionState<string>(
    "preop-form-km",
    ""
  );
  const [firmadoCheck, setFirmadoCheck, clearFirmadoCheck] = useSessionState<boolean>(
    "preop-form-firmado",
    false
  );
  const [firmaUrl, setFirmaUrl] = useState<string>("");
  const [uploadingFirma, setUploadingFirma] = useState(false);

  // Camera refs
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // ── Fetch vehicles from API ──
  const { data: vehiculosResults, isLoading: loadingVehiculos } = useQuery({
    queryKey: ["conductor-vehiculos-check", cellviVehiculos.map((v) => v.id)],
    queryFn: async (): Promise<VehiculoResult[]> => {
      if (!bearerToken || cellviVehiculos.length === 0) return [];

      const results = await Promise.all(
        cellviVehiculos.map(async (v) => {
          try {
            const res = await fetch(`${getApiRndcBaseUrl()}/api/vehiculos/cellvi/${v.id}`, {
              headers: { Authorization: `Bearer ${bearerToken}` },
            });
            if (!res.ok) {
              return { cellviId: v.id, placa: v.placa, found: false } as VehiculoNotFound;
            }
            const data = await res.json();
            // Response: { success, data: [ {...} ] } — data is an array
            const rawVeh = Array.isArray(data.data) ? data.data[0] : (data.data || data.vehiculo || data);
            if (!rawVeh) {
              return { cellviId: v.id, placa: v.placa, found: false } as VehiculoNotFound;
            }
            const vehiculoId = rawVeh._id || rawVeh.id || "";
            if (!vehiculoId) {
              console.warn("Vehiculo sin ID en respuesta:", data);
              return { cellviId: v.id, placa: v.placa, found: false } as VehiculoNotFound;
            }
            return {
              _id: String(vehiculoId),
              placa: rawVeh.placa || v.placa,
              marca: rawVeh.marca || "",
              linea: rawVeh.linea || "",
              modelo: rawVeh.modelo || "",
              cellviId: v.id,
              found: true,
            } as VehiculoInfo;
          } catch {
            return { cellviId: v.id, placa: v.placa, found: false } as VehiculoNotFound;
          }
        })
      );
      return results;
    },
    enabled: !!bearerToken && cellviVehiculos.length > 0,
  });

  // ── Check which vehicles already have a preop today ──
  const { data: preopHoyMap = {} } = useQuery({
    queryKey: ["conductor-preop-hoy", conductorId],
    queryFn: async (): Promise<Record<string, boolean>> => {
      if (!bearerToken || !conductorId) return {};
      const today = new Date().toISOString().split("T")[0];
      const res = await fetch(
        `${getApiRndcBaseUrl()}/api/preoperacionales?conductor=${conductorId}&fechaDesde=${today}T00:00:00.000Z&fechaHasta=${today}T23:59:59.999Z`,
        { headers: { Authorization: `Bearer ${bearerToken}` } }
      );
      if (!res.ok) return {};
      const json = await res.json();
      const list = (json.data || json.preoperacionales || []) as { vehiculo: string | { _id: string } }[];
      const map: Record<string, boolean> = {};
      for (const p of list) {
        const vid = typeof p.vehiculo === "object" ? (p.vehiculo as { _id: string })._id : p.vehiculo;
        if (vid) map[vid] = true;
      }
      return map;
    },
    enabled: !!bearerToken && !!conductorId,
  });

  // ── Fetch historial ──
  const { data: historial = [], isLoading: loadingHistorial } = useQuery({
    queryKey: ["conductor-preop-historial", conductorId],
    queryFn: async (): Promise<PreopHistorialItem[]> => {
      if (!bearerToken || !conductorId) return [];
      const res = await fetch(
        `${getApiRndcBaseUrl()}/api/preoperacionales?conductor=${conductorId}&limit=50`,
        { headers: { Authorization: `Bearer ${bearerToken}` } }
      );
      if (!res.ok) return [];
      const json = await res.json();
      return (json.data || json.preoperacionales || []) as PreopHistorialItem[];
    },
    enabled: !!bearerToken && !!conductorId && showHistorial,
  });

  // ── Computed form stats ──
  const { reviewed, fallas, isFormValid } = useMemo(() => {
    let reviewed = 0;
    let fallas = 0;
    let allValid = true;

    for (const item of ALL_ITEMS) {
      const s = formItems[item.key];
      if (s?.estado) {
        reviewed++;
        if (s.estado === "FALLA") {
          fallas++;
          if (!s.observaciones.trim() || !s.fotoCapturada) {
            allValid = false;
          }
        }
      }
    }

    const kmValid = Number(kilometraje) > 0;
    const complete = reviewed === TOTAL_ITEMS && allValid && kmValid && firmadoCheck;
    return { reviewed, fallas, isFormValid: complete };
  }, [formItems, kilometraje, firmadoCheck]);

  const estadoGeneral = fallas > 0 ? "CON_NOVEDAD" : "APROBADO";

  // ── Submit mutation ──
  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!selectedVehiculo || !bearerToken || !conductorId) {
        throw new Error("Datos incompletos");
      }
      if (!selectedVehiculo._id) {
        throw new Error("No se encontró el ID del vehículo. Vuelva a seleccionarlo.");
      }

      const buildSection = (items: readonly { key: string; label: string }[]) => {
        const section: Record<string, { estado: string; observaciones: string; fotoUrl: string }> = {};
        for (const item of items) {
          const s = formItems[item.key];
          section[item.key] = {
            estado: s?.estado || "OK",
            observaciones: s?.observaciones || "",
            fotoUrl: "",
          };
        }
        return section;
      };

      const body = {
        vehiculo: selectedVehiculo._id,
        conductor: conductorId,
        fecha: new Date().toISOString(),
        kilometraje: Number(kilometraje),
        estadoGeneral,
        firmadoCheck,
        firmaConductorUrl: firmaUrl || undefined,
        seccionDelantera: buildSection(SECCION_DELANTERA_ITEMS),
        seccionMedia: buildSection(SECCION_MEDIA_ITEMS),
        seccionTrasera: buildSection(SECCION_TRASERA_ITEMS),
      };

      const res = await fetch(`${getApiRndcBaseUrl()}/api/preoperacionales`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${bearerToken}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.message || "Error al enviar la preoperacional");
      }

      return res.json();
    },
    onSuccess: () => {
      toast.success("Preoperacional enviada exitosamente");
      clearFormItems();
      clearKilometraje();
      clearFirmadoCheck();
      setFirmaUrl("");
      setSelectedVehiculo(null);
      queryClient.invalidateQueries({ queryKey: ["conductor-preop-hoy"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // ── Upload signature to S3 ──
  const handleSignatureReady = async (blob: Blob) => {
    if (!bearerToken) return;
    setUploadingFirma(true);
    try {
      const fileName = `firma-conductor-${Date.now()}.png`;
      // 1. Get presigned URL
      const presRes = await fetch(`${getApiRndcBaseUrl()}/api/documentos/presigned-url`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${bearerToken}`,
        },
        body: JSON.stringify({ fileName, mimeType: "image/png" }),
      });
      if (!presRes.ok) throw new Error("Error al obtener URL de subida");
      const presJson = await presRes.json();
      const { uploadUrl, publicUrl } = presJson.data || presJson;

      // 2. Upload to S3
      const file = new File([blob], fileName, { type: "image/png" });
      await uploadFileToS3(uploadUrl, file);

      // 3. Save URL
      setFirmaUrl(publicUrl);
      setFirmadoCheck(true);
      toast.success("Firma capturada y subida exitosamente");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al subir la firma");
    } finally {
      setUploadingFirma(false);
    }
  };

  // ── Item handlers ──
  const setItemEstado = (key: string, estado: ItemEstado) => {
    setFormItems((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        estado,
        // If switching to OK, clear falla data
        ...(estado === "OK" ? { observaciones: "", fotoCapturada: false } : {}),
      },
    }));
  };

  const setItemObservaciones = (key: string, observaciones: string) => {
    setFormItems((prev) => ({
      ...prev,
      [key]: { ...prev[key], observaciones },
    }));
  };

  const handlePhotoCapture = (key: string) => {
    const input = fileInputRefs.current[key];
    if (input) input.click();
  };

  const onFileSelected = (key: string) => {
    const input = fileInputRefs.current[key];
    if (input?.files && input.files.length > 0) {
      setFormItems((prev) => ({
        ...prev,
        [key]: { ...prev[key], fotoCapturada: true },
      }));
      toast.success("Foto capturada");
    }
  };

  // ── Render: Item row ──
  const renderItem = (item: { key: string; label: string }) => {
    const s = formItems[item.key] || { estado: null, observaciones: "", fotoCapturada: false };
    return (
      <div key={item.key} className="border rounded-lg p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">{item.label}</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setItemEstado(item.key, "OK")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                s.estado === "OK"
                  ? "bg-green-600 text-white"
                  : "bg-muted text-muted-foreground hover:bg-green-100"
              }`}
            >
              <CheckCircle className="h-3.5 w-3.5 inline mr-1" />
              OK
            </button>
            <button
              type="button"
              onClick={() => setItemEstado(item.key, "FALLA")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                s.estado === "FALLA"
                  ? "bg-red-600 text-white"
                  : "bg-muted text-muted-foreground hover:bg-red-100"
              }`}
            >
              <XCircle className="h-3.5 w-3.5 inline mr-1" />
              FALLA
            </button>
          </div>
        </div>

        {s.estado === "FALLA" && (
          <div className="space-y-2 pt-2 border-t">
            <textarea
              placeholder="Describa la falla encontrada (obligatorio)"
              value={s.observaciones}
              onChange={(e) => setItemObservaciones(item.key, e.target.value)}
              className="w-full min-h-[60px] text-sm p-2 rounded-md border border-input bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="flex items-center gap-2">
              <input
                ref={(el) => { fileInputRefs.current[item.key] = el; }}
                type="file"
                accept="image/*"
                title="Capturar foto de evidencia"
                className="hidden"
                onChange={() => onFileSelected(item.key)}
              />
              <Button
                type="button"
                variant={s.fotoCapturada ? "default" : "outline"}
                size="sm"
                onClick={() => handlePhotoCapture(item.key)}
                className="gap-1.5"
              >
                <Camera className="h-3.5 w-3.5" />
                {s.fotoCapturada ? "Foto capturada" : "Capturar foto"}
              </Button>
              {!s.observaciones.trim() && (
                <span className="text-xs text-red-500">* Observaciones requeridas</span>
              )}
              {!s.fotoCapturada && (
                <span className="text-xs text-red-500">* Foto requerida</span>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── Render: Section badge counts ──
  const sectionBadge = (items: readonly { key: string; label: string }[]) => {
    let done = 0;
    let fail = 0;
    for (const item of items) {
      if (formItems[item.key]?.estado) done++;
      if (formItems[item.key]?.estado === "FALLA") fail++;
    }
    return (
      <span className="flex gap-1.5 ml-auto mr-2">
        <Badge variant={done === items.length ? "default" : "secondary"} className="text-xs">
          {done}/{items.length}
        </Badge>
        {fail > 0 && (
          <Badge variant="destructive" className="text-xs">
            {fail} falla{fail > 1 ? "s" : ""}
          </Badge>
        )}
      </span>
    );
  };

  // ── Render: Form view ──
  if (selectedVehiculo) {
    return (
      <ConductorLayout>
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedVehiculo(null)}
              className="gap-1"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver
            </Button>
            <div>
              <h1 className="text-lg font-bold">Preoperacional</h1>
              <p className="text-sm text-muted-foreground">
                {selectedVehiculo.placa} - {selectedVehiculo.marca} {selectedVehiculo.linea}
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="bg-card border rounded-lg p-3">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="font-medium">
                {reviewed}/{TOTAL_ITEMS} revisados
              </span>
              {fallas > 0 && (
                <span className="text-red-600 font-medium">
                  {fallas} con falla
                </span>
              )}
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  reviewed === TOTAL_ITEMS
                    ? fallas > 0
                      ? "bg-amber-500"
                      : "bg-green-500"
                    : "bg-primary"
                }`}
                style={{ width: `${(reviewed / TOTAL_ITEMS) * 100}%` }}
              />
            </div>
            {reviewed === TOTAL_ITEMS && (
              <div className="mt-2 text-sm">
                <span className="font-medium">Estado: </span>
                <Badge variant={estadoGeneral === "APROBADO" ? "default" : "secondary"}>
                  {estadoGeneral}
                </Badge>
              </div>
            )}
          </div>

          {/* Kilometraje */}
          <div className="bg-card border rounded-lg p-3">
            <label className="text-sm font-medium mb-1 block">Kilometraje actual</label>
            <Input
              type="number"
              placeholder="Ingrese el kilometraje"
              value={kilometraje}
              onChange={(e) => setKilometraje(e.target.value)}
              min={1}
            />
          </div>

          {/* Accordion sections */}
          <Accordion type="multiple" defaultValue={["delantera", "media", "trasera"]} className="space-y-2">
            <AccordionItem value="delantera" className="bg-card border rounded-lg px-3">
              <AccordionTrigger className="hover:no-underline">
                <span className="text-sm font-semibold">Sección Delantera</span>
                {sectionBadge(SECCION_DELANTERA_ITEMS)}
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2">
                  {SECCION_DELANTERA_ITEMS.map(renderItem)}
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="media" className="bg-card border rounded-lg px-3">
              <AccordionTrigger className="hover:no-underline">
                <span className="text-sm font-semibold">Sección Media</span>
                {sectionBadge(SECCION_MEDIA_ITEMS)}
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2">
                  {SECCION_MEDIA_ITEMS.map(renderItem)}
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="trasera" className="bg-card border rounded-lg px-3">
              <AccordionTrigger className="hover:no-underline">
                <span className="text-sm font-semibold">Sección Trasera</span>
                {sectionBadge(SECCION_TRASERA_ITEMS)}
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2">
                  {SECCION_TRASERA_ITEMS.map(renderItem)}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* Firma digital */}
          <SignaturePad
            onSignatureReady={handleSignatureReady}
            disabled={submitMutation.isPending}
            uploading={uploadingFirma}
            signed={!!firmaUrl}
          />

          {/* Declaración */}
          <div className="bg-card border rounded-lg p-3 flex items-start gap-3">
            <Checkbox
              id="firmadoCheck"
              checked={firmadoCheck}
              onCheckedChange={(checked) => setFirmadoCheck(checked === true)}
              disabled={!firmaUrl}
              className="mt-0.5"
            />
            <label htmlFor="firmadoCheck" className="text-sm cursor-pointer">
              Declaro que la información registrada es verídica y corresponde al estado actual del vehículo.
            </label>
          </div>

          {/* Submit */}
          <Button
            onClick={() => submitMutation.mutate()}
            disabled={!isFormValid || submitMutation.isPending}
            className="w-full gap-2 py-6 text-base"
          >
            {submitMutation.isPending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
            Enviar Preoperacional
          </Button>

          {!isFormValid && (
            <p className="text-xs text-muted-foreground text-center">
              {reviewed < TOTAL_ITEMS
                ? `Faltan ${TOTAL_ITEMS - reviewed} items por revisar`
                : !Number(kilometraje)
                ? "Ingrese el kilometraje"
                : !firmadoCheck
                ? "Debe firmar la declaración"
                : "Complete las observaciones y fotos de los items con falla"}
            </p>
          )}
        </div>
      </ConductorLayout>
    );
  }

  // ── Render: Historial view ──
  if (showHistorial) {
    return (
      <ConductorLayout>
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setShowHistorial(false)} className="gap-1">
              <ArrowLeft className="h-4 w-4" />
              Volver
            </Button>
            <div>
              <h1 className="text-lg font-bold">Historial de Preoperativas</h1>
              <p className="text-sm text-muted-foreground">Todas tus inspecciones registradas</p>
            </div>
          </div>

          {loadingHistorial ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : historial.length === 0 ? (
            <div className="text-center py-12 bg-card border rounded-lg">
              <ClipboardCheck className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="font-medium text-muted-foreground">No hay preoperativas registradas</p>
            </div>
          ) : (
            <div className="space-y-3">
              {historial.map((item) => {
                const fecha = item.fechaCreacion || item.createdAt;
                const placa = typeof item.vehiculo === "object" ? item.vehiculo?.placa : item.vehiculo;
                const fallas =
                  Object.values(item.seccionDelantera || {}).filter((v) => v.estado === "FALLA").length +
                  Object.values(item.seccionMedia || {}).filter((v) => v.estado === "FALLA").length +
                  Object.values(item.seccionTrasera || {}).filter((v) => v.estado === "FALLA").length;

                return (
                  <div key={item._id} className="bg-card border rounded-lg p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-foreground">{placa || "—"}</span>
                          {item.estadoGeneral && (
                            <Badge variant={item.estadoGeneral === "APROBADO" ? "default" : item.estadoGeneral === "CON_NOVEDAD" ? "secondary" : "destructive"}>
                              {item.estadoGeneral.replace("_", " ")}
                            </Badge>
                          )}
                          {fallas > 0 && (
                            <span className="inline-flex items-center gap-1 text-red-600 text-xs font-medium">
                              <XCircle className="h-3 w-3" />
                              {fallas} falla{fallas > 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {fecha ? format(new Date(fecha), "dd MMM yyyy, HH:mm", { locale: es }) : "—"}
                        </p>
                      </div>
                      {item.codigoPublico && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 shrink-0"
                          onClick={() => setQrItem(item)}
                        >
                          <QrCode className="h-3.5 w-3.5" />
                          QR
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* QR Modal */}
        {qrItem?.codigoPublico && (
          <QRShareModal
            open={!!qrItem}
            onClose={() => setQrItem(null)}
            codigoPublico={qrItem.codigoPublico}
            placa={typeof qrItem.vehiculo === "object" ? qrItem.vehiculo?.placa : qrItem.vehiculo}
            fecha={qrItem.fechaCreacion || qrItem.createdAt
              ? format(new Date((qrItem.fechaCreacion || qrItem.createdAt)!), "dd MMM yyyy", { locale: es })
              : undefined}
          />
        )}
      </ConductorLayout>
    );
  }

  // ── Render: Vehicle selector ──
  return (
    <ConductorLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="text-center flex-1">
            <h1 className="text-xl font-bold text-foreground">Preoperacional Diaria</h1>
            <p className="text-sm text-muted-foreground">
              Selecciona un vehículo para iniciar la inspección
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 shrink-0"
            onClick={() => setShowHistorial(true)}
          >
            <History className="h-4 w-4" />
            Historial
          </Button>
        </div>

        {loadingVehiculos ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !vehiculosResults || vehiculosResults.length === 0 ? (
          <div className="text-center py-8 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <AlertTriangle className="h-10 w-10 text-yellow-600 mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-yellow-700 dark:text-yellow-400 mb-1">
              Sin Vehículos Asignados
            </h2>
            <p className="text-sm text-yellow-600 dark:text-yellow-500">
              No tiene vehículos asignados. Contacte al administrador.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {vehiculosResults.map((v) => {
              if (!v.found) {
                return (
                  <div
                    key={v.cellviId}
                    className="bg-card border border-red-200 dark:border-red-800 rounded-lg p-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-lg bg-red-100 dark:bg-red-900/30">
                        <Car className="h-5 w-5 text-red-600 dark:text-red-400" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-foreground">{v.placa}</p>
                        <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                          Vehículo no registrado en el sistema. Contacte al administrador.
                        </p>
                      </div>
                      <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
                    </div>
                  </div>
                );
              }

              const yaHecha = preopHoyMap[v._id] === true;
              return (
                <div
                  key={v.cellviId}
                  className={`bg-card border rounded-lg p-4 transition-colors ${yaHecha ? "border-green-300 dark:border-green-700" : "border-border hover:border-primary/40"}`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`p-2.5 rounded-lg ${yaHecha ? "bg-green-100 dark:bg-green-900/30" : "bg-primary/10"}`}>
                      <Car className={`h-5 w-5 ${yaHecha ? "text-green-600 dark:text-green-400" : "text-primary"}`} />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-foreground">{v.placa}</p>
                      <p className="text-xs text-muted-foreground">
                        {v.marca} {v.linea} {v.modelo}
                      </p>
                    </div>
                    {yaHecha && (
                      <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
                    )}
                  </div>
                  {yaHecha ? (
                    <div className="w-full text-center py-2 rounded-md bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-sm font-medium text-green-700 dark:text-green-400">
                      Preoperacional completada hoy
                    </div>
                  ) : (
                    <Button
                      onClick={async () => {
                        if (!conductorId || !bearerToken) return;
                        setValidating(true);
                        setValidation(null);
                        try {
                          const res = await fetch(
                            `${getApiRndcBaseUrl()}/api/preoperacionales/validar/${v._id}/${conductorId}`,
                            { headers: { Authorization: `Bearer ${bearerToken}` } }
                          );
                          const json = await res.json();
                          const result = json.data as ValidationResult;
                          setValidation(result);

                          if (result.autorizado) {
                            clearFormItems();
                            clearKilometraje();
                            clearFirmadoCheck();
                            setSelectedVehiculo(v);
                          }
                        } catch {
                          toast.error("Error al validar documentos del vehículo");
                        } finally {
                          setValidating(false);
                        }
                      }}
                      disabled={validating}
                      className="w-full gap-2"
                    >
                      {validating ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ClipboardCheck className="h-4 w-4" />
                      )}
                      Nueva Preoperacional
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Validation Results */}
        {validation && !validation.autorizado && (
          <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-red-600" />
              <h3 className="font-semibold text-red-700 dark:text-red-400">
                No autorizado para preoperacional
              </h3>
            </div>

            {validation.errores.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-red-700 dark:text-red-400">Documentos con problemas:</p>
                {validation.errores.map((err, i) => (
                  <div key={i} className="flex items-start gap-2 bg-red-100 dark:bg-red-900/30 rounded-md p-2.5">
                    <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                    <div>
                      <span className="text-sm font-medium text-red-800 dark:text-red-300">{err.campo}</span>
                      <p className="text-xs text-red-600 dark:text-red-400">{err.mensaje}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Button
              onClick={() => navigate("/conductor/documentos")}
              className="w-full gap-2"
              variant="destructive"
            >
              <FileWarning className="h-4 w-4" />
              Ir a Documentos para corregir
            </Button>
          </div>
        )}

        {/* Validation Alerts (warnings) */}
        {validation && validation.autorizado && validation.alertas && validation.alertas.length > 0 && (
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <h3 className="font-semibold text-amber-700 dark:text-amber-400">Alertas</h3>
            </div>
            {validation.alertas.map((alerta, i) => (
              <div key={i} className="flex items-start gap-2 bg-amber-100 dark:bg-amber-900/30 rounded-md p-2.5">
                <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                <div>
                  <span className="text-sm font-medium text-amber-800 dark:text-amber-300">{alerta.campo}</span>
                  <p className="text-xs text-amber-600 dark:text-amber-400">{alerta.mensaje}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Reminder */}
        <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
          <p className="font-medium text-foreground mb-1">Recuerda:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Revisa cada ítem del checklist</li>
            <li>Toma fotos de las novedades</li>
            <li>Firma al finalizar la inspección</li>
          </ul>
        </div>
      </div>
    </ConductorLayout>
  );
}

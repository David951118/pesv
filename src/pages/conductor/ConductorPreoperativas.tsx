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
  Wrench,
  Clock,
  ImageIcon,
  Upload,
  User,
  Gauge,
} from "lucide-react";
import { getVehiculoKilometraje } from "@/services/apirndc/apirndc.api";
import { KM_FUENTE_LABELS } from "@/components/operacion/operacion.helpers";
import { toast } from "sonner";
import { SignaturePad } from "@/components/preoperativas/SignaturePad";
import { uploadFileToS3 } from "@/lib/uploadToS3";
import { QRShareModal } from "@/components/preoperativas/QRShareModal";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Download, Eye } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PreopSeguimiento } from "@/components/preoperativas/PreopSeguimiento";

// ── Section definitions ──

import {
  SECCION_DELANTERA_ITEMS,
  SECCION_MEDIA_ITEMS,
  SECCION_TRASERA_ITEMS,
  SECCION_ASEO_ITEMS,
  KIT_PRIMEROS_AUXILIOS_ITEMS,
  KIT_CARRETERA_ITEMS,
  labelForItem,
} from "@/lib/preopItems";
import { KitInfoDialog, type EstadoKit } from "@/components/preoperativas/KitInfoDialog";

const ALL_ITEMS = [
  ...SECCION_DELANTERA_ITEMS,
  ...SECCION_MEDIA_ITEMS,
  ...SECCION_TRASERA_ITEMS,
  ...SECCION_ASEO_ITEMS,
];

const TOTAL_ITEMS = ALL_ITEMS.length;

// ── Novedad types ──
interface NovedadItem {
  _id: string;
  item: string;
  descripcion: string;
  fotoFalla: string;
  fotoCorreccion: string | null;
  fechaLimite: string;
  resuelta: boolean;
  fechaResolucion: string | null;
}

interface PreopConNovedades {
  _id: string;
  vehiculo: { placa: string; marca: string; linea: string };
  novedades: NovedadItem[];
  resumenNovedades: { total: number; pendientes: number; resueltas: number; diasRestantes: number };
}

// ── Types ──

interface PreopHistorialItem {
  _id: string;
  codigoPublico?: string;
  fechaCreacion?: string;
  createdAt?: string;
  vehiculo?: { placa?: string; marca?: string; linea?: string } | string;
  conductor?: { nombres?: string; apellidos?: string; identificacion?: string } | string;
  kilometraje?: number;
  estadoGeneral?: string;
  firmadoCheck?: boolean;
  seccionConductor?: {
    horasSueno?: number;
    estadoSalud?: string;
    estadoSaludObservaciones?: string;
    tomaMedicamentos?: boolean;
    consumoSustancias?: boolean;
  };
  seccionDelantera?: Record<string, { estado: string; observaciones?: string }>;
  seccionMedia?: Record<string, { estado: string; observaciones?: string }>;
  seccionTrasera?: Record<string, { estado: string; observaciones?: string }>;
  seccionAseo?: Record<string, { estado: string; observaciones?: string }>;
}

type ItemEstado = "BUENO" | "REGULAR" | "MALO" | "NO_APLICA" | null;

interface ItemState {
  estado: ItemEstado;
  observaciones: string;
  fotoCapturada: boolean;
  fotoUrl: string;
  uploadingFoto: boolean;
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
    items[item.key] = { estado: null, observaciones: "", fotoCapturada: false, fotoUrl: "", uploadingFoto: false };
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
  const [viewingItem, setViewingItem] = useState<PreopHistorialItem | null>(null);

  // Novedades state
  const [showNovedades, setShowNovedades] = useState(false);
  const [enlargedPhoto, setEnlargedPhoto] = useState<string | null>(null);
  const [resolvingNovedadId, setResolvingNovedadId] = useState<string | null>(null);
  const [uploadingCorreccion, setUploadingCorreccion] = useState(false);
  const novedadFileInputRef = useRef<HTMLInputElement | null>(null);

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
  const [loadingKm, setLoadingKm] = useState(false);

  // Seccion Conductor state
  const [seccionConductor, setSeccionConductor, clearSeccionConductor] = useSessionState("preop-seccion-conductor", {
    horasSueno: "",
    selfieUrl: "",
    selfieFecha: "",
    estadoSalud: "" as "" | "BUENO" | "REGULAR" | "MALO",
    estadoSaludObservaciones: "",
    tomaMedicamentos: false,
    medicamentosDetalle: "",
    consumoSustancias: false,
    sustanciasDetalle: "",
  });

  // Selfie file input ref
  const selfieInputRef = useRef<HTMLInputElement>(null);
  const [uploadingSelfie, setUploadingSelfie] = useState(false);

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

  // ── Fetch ultimo kilometraje when vehicle selected ──
  const { data: ultimoKm } = useQuery({
    queryKey: ["ultimo-kilometraje", selectedVehiculo?._id],
    queryFn: async (): Promise<number | null> => {
      if (!bearerToken || !selectedVehiculo?._id) return null;
      const res = await fetch(
        `${getApiRndcBaseUrl()}/api/preoperacionales/ultimo-kilometraje/${selectedVehiculo._id}`,
        { headers: { Authorization: `Bearer ${bearerToken}` } }
      );
      if (!res.ok) return null;
      const json = await res.json();
      return json.data?.kilometraje ?? null;
    },
    enabled: !!bearerToken && !!selectedVehiculo?._id,
  });

  // ── Traer kilometraje actual desde Cellvi GPS ──
  const handleConsultarKm = async () => {
    if (!selectedVehiculo?._id) return;
    setLoadingKm(true);
    try {
      const res = await getVehiculoKilometraje(selectedVehiculo._id);
      if (res.data?.kilometraje !== null && res.data?.kilometraje !== undefined) {
        setKilometraje(String(res.data.kilometraje));
        toast.info(
          `Km actual: ${res.data.kilometraje.toLocaleString("es-CO")} (${KM_FUENTE_LABELS[res.data.fuente] ?? res.data.fuente})`
        );
      } else {
        toast.info("Sin kilometraje disponible para este vehículo");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al consultar el kilometraje");
    } finally {
      setLoadingKm(false);
    }
  };

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

  // ── Fetch novedades ──
  const { data: novedadesData = [], isLoading: loadingNovedades } = useQuery({
    queryKey: ["conductor-novedades"],
    queryFn: async (): Promise<PreopConNovedades[]> => {
      if (!bearerToken) return [];
      const res = await fetch(
        `${getApiRndcBaseUrl()}/api/preoperacionales/novedades`,
        { headers: { Authorization: `Bearer ${bearerToken}` } }
      );
      if (!res.ok) return [];
      const json = await res.json();
      return (json.data || json) as PreopConNovedades[];
    },
    enabled: !!bearerToken,
  });

  // Total pending novedades count (for badge)
  const totalPendientes = useMemo(() => {
    return novedadesData.reduce((sum, p) => sum + (p.resumenNovedades?.pendientes || 0), 0);
  }, [novedadesData]);

  // ── Resolve novedad handler ──
  // Acepta varias fotos: la primera resuelve la novedad y las siguientes se
  // anexan como evidencias adicionales de la misma corrección.
  const handleResolveNovedad = async (preopId: string, novedadId: string, files: File[]) => {
    if (!bearerToken || !files.length) return;
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${bearerToken}`,
    };
    setUploadingCorreccion(true);
    try {
      const subirAS3 = async (file: File, indice: number) => {
        const presRes = await fetch(`${getApiRndcBaseUrl()}/api/documentos/presigned-url`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            fileName: `correccion-${novedadId}-${Date.now()}-${indice}.${file.name.split(".").pop()}`,
            mimeType: file.type || "image/jpeg",
          }),
        });
        if (!presRes.ok) throw new Error("Error al obtener URL de subida");
        const presJson = await presRes.json();
        const { uploadUrl, publicUrl } = presJson.data || presJson;
        await uploadFileToS3(uploadUrl, file);
        return publicUrl as string;
      };

      const urls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        urls.push(await subirAS3(files[i], i));
      }

      // Primera foto → resuelve la novedad (queda EN_REVISION)
      const resolveRes = await fetch(
        `${getApiRndcBaseUrl()}/api/preoperacionales/${preopId}/novedades/${novedadId}/resolver`,
        {
          method: "PUT",
          headers,
          body: JSON.stringify({ fotoCorreccion: urls[0] }),
        }
      );
      if (!resolveRes.ok) {
        const errData = await resolveRes.json().catch(() => null);
        throw new Error(errData?.message || "Error al resolver la novedad");
      }

      // Fotos restantes → evidencias de la misma corrección
      for (const url of urls.slice(1)) {
        await fetch(
          `${getApiRndcBaseUrl()}/api/preoperacionales/${preopId}/novedades/${novedadId}/evidencias`,
          { method: "POST", headers, body: JSON.stringify({ fotoUrl: url }) }
        );
      }

      toast.success(
        urls.length > 1
          ? `Novedad resuelta con ${urls.length} fotos`
          : "Novedad resuelta exitosamente"
      );
      queryClient.invalidateQueries({ queryKey: ["conductor-novedades"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al resolver la novedad");
    } finally {
      setUploadingCorreccion(false);
      setResolvingNovedadId(null);
    }
  };

  // ── Computed form stats ──
  const { reviewed, fallas, isFormValid } = useMemo(() => {
    let reviewed = 0;
    let fallas = 0;
    let allValid = true;

    for (const item of ALL_ITEMS) {
      const s = formItems[item.key];
      if (s?.estado) {
        reviewed++;
        if (s.estado === "MALO") {
          fallas++;
          if (!s.observaciones.trim() || !s.fotoCapturada) {
            allValid = false;
          }
        }
      }
    }

    const kmValid = Number(kilometraje) > 0;
    const conductorValid =
      Number(seccionConductor.horasSueno) > 0 &&
      !!seccionConductor.estadoSalud;
    const complete = reviewed === TOTAL_ITEMS && allValid && kmValid && firmadoCheck && conductorValid;
    return { reviewed, fallas, isFormValid: complete };
  }, [formItems, kilometraje, firmadoCheck, seccionConductor]);

  const estadoGeneral = fallas > 0 ? "NOVEDAD" : "APROBADO";

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
            estado: s?.estado || "BUENO",
            observaciones: s?.observaciones || "",
            fotoUrl: s?.fotoUrl || "",
          };
        }
        return section;
      };

      const body = {
        vehiculo: selectedVehiculo._id,
        conductor: conductorId,
        fecha: new Date().toISOString(),
        kilometraje: Number(kilometraje),
        firmadoCheck,
        firmaConductorUrl: firmaUrl || undefined,
        seccionConductor: {
          horasSueno: Number(seccionConductor.horasSueno),
          selfieUrl: seccionConductor.selfieUrl || undefined,
          selfieFecha: seccionConductor.selfieFecha || undefined,
          estadoSalud: seccionConductor.estadoSalud || "BUENO",
          estadoSaludObservaciones: seccionConductor.estadoSaludObservaciones || undefined,
          tomaMedicamentos: seccionConductor.tomaMedicamentos,
          medicamentosDetalle: seccionConductor.medicamentosDetalle || undefined,
          consumoSustancias: seccionConductor.consumoSustancias,
          sustanciasDetalle: seccionConductor.sustanciasDetalle || undefined,
        },
        seccionDelantera: buildSection(SECCION_DELANTERA_ITEMS),
        seccionMedia: buildSection(SECCION_MEDIA_ITEMS),
        seccionTrasera: buildSection(SECCION_TRASERA_ITEMS),
        seccionAseo: buildSection(SECCION_ASEO_ITEMS),
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
        const error: any = new Error(errData?.message || "Error al enviar la preoperacional");
        error.status = res.status;
        throw error;
      }

      return res.json();
    },
    onSuccess: () => {
      toast.success("Preoperacional enviada exitosamente");
      clearFormItems();
      clearKilometraje();
      clearFirmadoCheck();
      clearSeccionConductor();
      setFirmaUrl("");
      setSelectedVehiculo(null);
      queryClient.invalidateQueries({ queryKey: ["conductor-preop-hoy"] });
    },
    onError: (error: any) => {
      if (error.status === 409) {
        toast.error("Ya existe una preoperacional para este vehículo hoy. Contacte al administrador para habilitar una extra.");
      } else {
        toast.error(error.message);
      }
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
        // Si pasa a BUENO o NO_APLICA, limpiar datos de falla
        ...(estado === "BUENO" || estado === "NO_APLICA"
          ? { observaciones: "", fotoCapturada: false, fotoUrl: "", uploadingFoto: false }
          : {}),
      },
    }));
  };

  // Estado del popup de kits (kitPrimerosAuxilios | equipoCarretera)
  const [kitDialog, setKitDialog] = useState<{
    open: boolean;
    itemKey: string;
    estado: EstadoKit;
    kit: "primerosAuxilios" | "carretera";
  } | null>(null);

  const handleKitEstadoClick = (itemKey: string, estado: EstadoKit) => {
    const kit = itemKey === "kitPrimerosAuxilios" ? "primerosAuxilios" : "carretera";
    setKitDialog({ open: true, itemKey, estado, kit });
  };

  const handleKitConfirm = () => {
    if (!kitDialog) return;
    setItemEstado(kitDialog.itemKey, kitDialog.estado);
    setKitDialog(null);
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

  const onFileSelected = async (key: string) => {
    const input = fileInputRefs.current[key];
    if (!input?.files || input.files.length === 0 || !bearerToken) return;

    const file = input.files[0];
    setFormItems((prev) => ({
      ...prev,
      [key]: { ...prev[key], uploadingFoto: true },
    }));

    try {
      // 1. Get presigned URL
      const presRes = await fetch(`${getApiRndcBaseUrl()}/api/documentos/presigned-url`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${bearerToken}`,
        },
        body: JSON.stringify({ fileName: `falla-${key}-${Date.now()}.${file.name.split(".").pop()}`, mimeType: file.type || "image/jpeg" }),
      });
      if (!presRes.ok) throw new Error("Error al obtener URL de subida");
      const presJson = await presRes.json();
      const { uploadUrl, publicUrl } = presJson.data || presJson;

      // 2. Upload to S3
      await uploadFileToS3(uploadUrl, file);

      // 3. Update state
      setFormItems((prev) => ({
        ...prev,
        [key]: { ...prev[key], fotoCapturada: true, fotoUrl: publicUrl, uploadingFoto: false },
      }));
      toast.success("Foto subida exitosamente");
    } catch (err) {
      setFormItems((prev) => ({
        ...prev,
        [key]: { ...prev[key], uploadingFoto: false },
      }));
      toast.error(err instanceof Error ? err.message : "Error al subir la foto");
    }
  };

  // ── Render: Item row ──
  const renderItem = (item: { key: string; label: string }) => {
    const s: ItemState = formItems[item.key] || { estado: null, observaciones: "", fotoCapturada: false, fotoUrl: "", uploadingFoto: false };
    const isKit = item.key === "kitPrimerosAuxilios" || item.key === "equipoCarretera";

    // Para kits, BUENO/REGULAR/MALO disparan el popup informativo.
    // NO_APLICA se aplica directo (no hay nada que confirmar si el item no aplica al vehiculo).
    const handleEstado = (estado: EstadoKit) => {
      if (isKit && estado !== "NO_APLICA") {
        handleKitEstadoClick(item.key, estado);
      } else {
        setItemEstado(item.key, estado);
      }
    };

    return (
      <div key={item.key} className="border rounded-lg p-3 space-y-2">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <span className="text-sm font-medium">{item.label}</span>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => handleEstado("BUENO")}
              className={`px-2 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                s.estado === "BUENO"
                  ? "bg-green-600 text-white"
                  : "bg-muted text-muted-foreground hover:bg-green-100"
              }`}
            >
              <CheckCircle className="h-3.5 w-3.5 inline mr-1" />
              BUENO
            </button>
            <button
              type="button"
              onClick={() => handleEstado("REGULAR")}
              className={`px-2 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                s.estado === "REGULAR"
                  ? "bg-amber-500 text-white"
                  : "bg-muted text-muted-foreground hover:bg-amber-100"
              }`}
            >
              <AlertTriangle className="h-3.5 w-3.5 inline mr-1" />
              REGULAR
            </button>
            <button
              type="button"
              onClick={() => handleEstado("MALO")}
              className={`px-2 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                s.estado === "MALO"
                  ? "bg-red-600 text-white"
                  : "bg-muted text-muted-foreground hover:bg-red-100"
              }`}
            >
              <XCircle className="h-3.5 w-3.5 inline mr-1" />
              MALO
            </button>
            <button
              type="button"
              onClick={() => handleEstado("NO_APLICA")}
              className={`px-2 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                s.estado === "NO_APLICA"
                  ? "bg-slate-600 text-white"
                  : "bg-muted text-muted-foreground hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              N/A
            </button>
          </div>
        </div>

        {s.estado === "REGULAR" && (
          <div className="space-y-2 pt-2 border-t">
            <textarea
              placeholder="Observaciones (opcional)"
              value={s.observaciones}
              onChange={(e) => setItemObservaciones(item.key, e.target.value)}
              className="w-full min-h-[40px] text-sm p-2 rounded-md border border-input bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        )}

        {s.estado === "MALO" && (
          <div className="space-y-2 pt-2 border-t">
            <textarea
              placeholder="Describa el problema encontrado (obligatorio)"
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
                onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
                onChange={() => onFileSelected(item.key)}
              />
              <Button
                type="button"
                variant={s.fotoCapturada ? "default" : "outline"}
                size="sm"
                onClick={() => handlePhotoCapture(item.key)}
                disabled={s.uploadingFoto}
                className="gap-1.5"
              >
                {s.uploadingFoto ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Camera className="h-3.5 w-3.5" />
                )}
                {s.uploadingFoto ? "Subiendo..." : s.fotoCapturada ? "Foto subida" : "Capturar foto"}
              </Button>
              {s.fotoUrl && (
                <img src={s.fotoUrl} alt="Evidencia" className="h-10 w-10 rounded object-cover border" />
              )}
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
      if (formItems[item.key]?.estado === "MALO") fail++;
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
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder={ultimoKm ? `Último: ${ultimoKm.toLocaleString("es-CO")} km` : "Ingrese el kilometraje"}
                value={kilometraje}
                onChange={(e) => setKilometraje(e.target.value)}
                min={1}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0"
                title="Traer kilometraje desde Cellvi GPS"
                disabled={loadingKm}
                onClick={handleConsultarKm}
              >
                {loadingKm ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gauge className="h-4 w-4" />}
              </Button>
            </div>
            {ultimoKm != null && (
              <p className="text-xs text-muted-foreground mt-1">
                Ultimo: {ultimoKm.toLocaleString("es-CO")} km
              </p>
            )}
          </div>

          {/* Accordion sections */}
          <Accordion type="multiple" defaultValue={["conductor", "aseo", "delantera", "media", "trasera"]} className="space-y-2">
            {/* Seccion Conductor */}
            <AccordionItem value="conductor" className="bg-card border rounded-lg px-3">
              <AccordionTrigger className="hover:no-underline">
                <span className="text-sm font-semibold flex items-center gap-1.5">
                  <User className="h-4 w-4" />
                  Seccion Conductor
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4">
                  {/* Horas de sueno */}
                  <div>
                    <label className="text-sm font-medium mb-1 block">Horas de sueno *</label>
                    <Input
                      type="number"
                      placeholder="Ej: 8"
                      value={seccionConductor.horasSueno}
                      onChange={(e) => setSeccionConductor((prev) => ({ ...prev, horasSueno: e.target.value }))}
                      min={0}
                      max={24}
                    />
                    {seccionConductor.horasSueno !== "" && Number(seccionConductor.horasSueno) <= 0 && (
                      <p className="text-xs text-red-500 mt-1">* Debe ser mayor a 0</p>
                    )}
                  </div>

                  {/* Selfie */}
                  <div>
                    <label className="text-sm font-medium mb-1 block">Selfie <span className="text-muted-foreground font-normal">(opcional)</span></label>
                    <input
                      ref={selfieInputRef}
                      type="file"
                      accept="image/*"
                      capture="user"
                      className="hidden"
                      onClick={(e) => { (e.target as HTMLInputElement).value = ""; }}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file || !bearerToken) return;
                        setUploadingSelfie(true);
                        try {
                          const presRes = await fetch(`${getApiRndcBaseUrl()}/api/documentos/presigned-url`, {
                            method: "POST",
                            headers: {
                              "Content-Type": "application/json",
                              Authorization: `Bearer ${bearerToken}`,
                            },
                            body: JSON.stringify({
                              fileName: `selfie-conductor-${Date.now()}.${file.name.split(".").pop()}`,
                              mimeType: file.type || "image/jpeg",
                            }),
                          });
                          if (!presRes.ok) throw new Error("Error al obtener URL de subida");
                          const presJson = await presRes.json();
                          const { uploadUrl, publicUrl } = presJson.data || presJson;
                          await uploadFileToS3(uploadUrl, file);
                          setSeccionConductor((prev) => ({
                            ...prev,
                            selfieUrl: publicUrl,
                            selfieFecha: new Date().toISOString(),
                          }));
                          toast.success("Selfie subida exitosamente");
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "Error al subir selfie");
                        } finally {
                          setUploadingSelfie(false);
                        }
                      }}
                    />
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant={seccionConductor.selfieUrl ? "default" : "outline"}
                        size="sm"
                        onClick={() => selfieInputRef.current?.click()}
                        disabled={uploadingSelfie}
                        className="gap-1.5"
                      >
                        {uploadingSelfie ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Camera className="h-3.5 w-3.5" />
                        )}
                        {uploadingSelfie ? "Subiendo..." : seccionConductor.selfieUrl ? "Selfie subida" : "Tomar selfie"}
                      </Button>
                      {seccionConductor.selfieUrl && (
                        <img src={seccionConductor.selfieUrl} alt="Selfie" className="h-10 w-10 rounded object-cover border" />
                      )}
                    </div>
                  </div>

                  {/* Estado de salud */}
                  <div>
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-3">
                      <p className="text-sm text-blue-900 dark:text-blue-100">
                        En la ejecución del presente documento digital (preoperacional),
                        manifiesto que mi estado de salud es:
                      </p>
                    </div>
                    <label className="text-sm font-medium mb-1 block">Estado de salud *</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setSeccionConductor((prev) => ({ ...prev, estadoSalud: "BUENO", estadoSaludObservaciones: "" }))}
                        className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                          seccionConductor.estadoSalud === "BUENO"
                            ? "bg-green-600 text-white"
                            : "bg-muted text-muted-foreground hover:bg-green-100"
                        }`}
                      >
                        <CheckCircle className="h-3.5 w-3.5 inline mr-1" />
                        BUENO
                      </button>
                      <button
                        type="button"
                        onClick={() => setSeccionConductor((prev) => ({ ...prev, estadoSalud: "REGULAR" }))}
                        className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                          seccionConductor.estadoSalud === "REGULAR"
                            ? "bg-amber-500 text-white"
                            : "bg-muted text-muted-foreground hover:bg-amber-100"
                        }`}
                      >
                        <AlertTriangle className="h-3.5 w-3.5 inline mr-1" />
                        REGULAR
                      </button>
                      <button
                        type="button"
                        onClick={() => setSeccionConductor((prev) => ({ ...prev, estadoSalud: "MALO" }))}
                        className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                          seccionConductor.estadoSalud === "MALO"
                            ? "bg-red-600 text-white"
                            : "bg-muted text-muted-foreground hover:bg-red-100"
                        }`}
                      >
                        <XCircle className="h-3.5 w-3.5 inline mr-1" />
                        MALO
                      </button>
                    </div>
                    {!seccionConductor.estadoSalud && (
                      <p className="text-xs text-red-500 mt-1">* Seleccione un estado</p>
                    )}
                  </div>

                  {/* Observaciones de salud (shown if REGULAR or MALO) */}
                  {(seccionConductor.estadoSalud === "REGULAR" || seccionConductor.estadoSalud === "MALO") && (
                    <div>
                      <label className="text-sm font-medium mb-1 block">
                        Sírvase explicar el porqué para la anotación *
                      </label>
                      <textarea
                        placeholder="Describa las razones de su estado de salud actual"
                        value={seccionConductor.estadoSaludObservaciones}
                        onChange={(e) => setSeccionConductor((prev) => ({ ...prev, estadoSaludObservaciones: e.target.value }))}
                        className="w-full min-h-[80px] text-sm p-2 rounded-md border border-input bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                  )}

                  {/* Toma medicamentos */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="tomaMedicamentos"
                        checked={seccionConductor.tomaMedicamentos}
                        onCheckedChange={(checked) =>
                          setSeccionConductor((prev) => ({
                            ...prev,
                            tomaMedicamentos: checked === true,
                            medicamentosDetalle: checked === true ? prev.medicamentosDetalle : "",
                          }))
                        }
                      />
                      <label htmlFor="tomaMedicamentos" className="text-sm font-medium cursor-pointer">
                        Toma medicamentos?
                      </label>
                    </div>
                    {seccionConductor.tomaMedicamentos && (
                      <textarea
                        placeholder="Detalle los medicamentos que toma"
                        value={seccionConductor.medicamentosDetalle}
                        onChange={(e) => setSeccionConductor((prev) => ({ ...prev, medicamentosDetalle: e.target.value }))}
                        className="w-full min-h-[60px] text-sm p-2 rounded-md border border-input bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    )}
                  </div>

                  {/* Consumo de sustancias */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="consumoSustancias"
                        checked={seccionConductor.consumoSustancias}
                        onCheckedChange={(checked) =>
                          setSeccionConductor((prev) => ({
                            ...prev,
                            consumoSustancias: checked === true,
                            sustanciasDetalle: checked === true ? prev.sustanciasDetalle : "",
                          }))
                        }
                      />
                      <label htmlFor="consumoSustancias" className="text-sm font-medium cursor-pointer">
                        Consumo de sustancias?
                      </label>
                    </div>
                    {seccionConductor.consumoSustancias && (
                      <textarea
                        placeholder="Detalle las sustancias consumidas"
                        value={seccionConductor.sustanciasDetalle}
                        onChange={(e) => setSeccionConductor((prev) => ({ ...prev, sustanciasDetalle: e.target.value }))}
                        className="w-full min-h-[60px] text-sm p-2 rounded-md border border-input bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    )}
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="aseo" className="bg-card border rounded-lg px-3">
              <AccordionTrigger className="hover:no-underline">
                <span className="text-sm font-semibold">Sección Aseo</span>
                {sectionBadge(SECCION_ASEO_ITEMS)}
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2">
                  {SECCION_ASEO_ITEMS.map(renderItem)}
                </div>
              </AccordionContent>
            </AccordionItem>

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

          {/* Declaración final previa a la firma */}
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 space-y-2">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
              Declaración de Responsabilidad
            </p>
            <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
              Declaro bajo la gravedad del juramento que la información consignada en el presente
              documento digital (preoperacional) es verídica y corresponde al estado real del
              vehículo y a mi estado físico y mental al momento de iniciar la operación. Asumo la
              responsabilidad total de los datos aquí registrados y entiendo que cualquier omisión
              o falsedad puede acarrear consecuencias disciplinarias, administrativas y legales
              conforme a la normatividad vigente en Colombia y a las políticas internas de la empresa.
            </p>
            <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
              Al firmar este documento, certifico que soy el conductor asignado al vehículo,
              que los datos biométricos y de identificación aquí registrados son míos, y que
              la firma capturada a continuación es auténtica y efectuada por mí de manera
              voluntaria y consciente.
            </p>
          </div>

          {/* Firma digital */}
          <SignaturePad
            onSignatureReady={handleSignatureReady}
            disabled={submitMutation.isPending}
            uploading={uploadingFirma}
            signed={!!firmaUrl}
          />

          {/* Declaración checkbox */}
          <div className="bg-card border rounded-lg p-3 flex items-start gap-3">
            <Checkbox
              id="firmadoCheck"
              checked={firmadoCheck}
              onCheckedChange={(checked) => setFirmadoCheck(checked === true)}
              disabled={!firmaUrl}
              className="mt-0.5"
            />
            <label htmlFor="firmadoCheck" className="text-sm cursor-pointer">
              He leído y acepto la declaración de responsabilidad. Confirmo que la información
              registrada es verídica y que soy el responsable directo de la firma.
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
              {!(Number(seccionConductor.horasSueno) > 0)
                ? "Ingrese las horas de sueño"
                : !seccionConductor.estadoSalud
                ? "Seleccione el estado de salud"
                : reviewed < TOTAL_ITEMS
                ? `Faltan ${TOTAL_ITEMS - reviewed} items por revisar`
                : !Number(kilometraje)
                ? "Ingrese el kilometraje"
                : !firmadoCheck
                ? "Debe firmar la declaracion"
                : "Complete las observaciones y fotos de los items con falla"}
            </p>
          )}
        </div>

        <KitInfoDialog
          open={!!kitDialog}
          onOpenChange={(v) => !v && setKitDialog(null)}
          estado={kitDialog?.estado ?? "BUENO"}
          kit={kitDialog?.kit ?? "primerosAuxilios"}
          items={(kitDialog?.kit ?? "primerosAuxilios") === "primerosAuxilios" ? KIT_PRIMEROS_AUXILIOS_ITEMS : KIT_CARRETERA_ITEMS}
          onConfirm={handleKitConfirm}
        />
      </ConductorLayout>
    );
  }

  // ── Render: Novedades view ──
  if (showNovedades) {
    return (
      <ConductorLayout>
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setShowNovedades(false)} className="gap-1">
              <ArrowLeft className="h-4 w-4" />
              Volver
            </Button>
            <div>
              <h1 className="text-lg font-bold">Novedades Pendientes</h1>
              <p className="text-sm text-muted-foreground">Correcciones por resolver</p>
            </div>
          </div>

          {loadingNovedades ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : novedadesData.length === 0 || totalPendientes === 0 ? (
            <div className="text-center py-12 bg-card border rounded-lg">
              <CheckCircle className="h-10 w-10 text-green-500 mx-auto mb-3" />
              <p className="font-medium text-muted-foreground">No hay novedades pendientes</p>
              <p className="text-sm text-muted-foreground mt-1">Todos los items estan al dia</p>
            </div>
          ) : (
            <div className="space-y-4">
              {novedadesData.map((preop) => {
                const pendientes = preop.novedades.filter((n) => !n.resuelta);
                if (pendientes.length === 0) return null;

                return (
                  <div key={preop._id} className="bg-card border rounded-lg overflow-hidden">
                    {/* Vehicle header */}
                    <div className="bg-muted/50 px-4 py-3 border-b flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Car className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold">{preop.vehiculo.placa}</span>
                        <span className="text-sm text-muted-foreground">
                          {preop.vehiculo.marca} {preop.vehiculo.linea}
                        </span>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {preop.resumenNovedades.pendientes} pendiente{preop.resumenNovedades.pendientes > 1 ? "s" : ""}
                      </Badge>
                    </div>

                    {/* Novedades list */}
                    <div className="divide-y">
                      {pendientes.map((novedad) => {
                        const diasRestantes = Math.ceil(
                          (new Date(novedad.fechaLimite).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                        );
                        const colorClass =
                          diasRestantes > 7
                            ? "text-green-600 bg-green-50 dark:bg-green-950/30"
                            : diasRestantes >= 3
                            ? "text-yellow-600 bg-yellow-50 dark:bg-yellow-950/30"
                            : "text-red-600 bg-red-50 dark:bg-red-950/30";

                        return (
                          <div key={novedad._id} className="p-4 space-y-3">
                            {/* Item name and deadline */}
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm">
                                  {labelForItem(novedad.item)}
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {novedad.descripcion}
                                </p>
                              </div>
                              <div className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium shrink-0 ${colorClass}`}>
                                <Clock className="h-3 w-3" />
                                {diasRestantes > 0 ? `${diasRestantes} dia${diasRestantes > 1 ? "s" : ""}` : "Vencida"}
                              </div>
                            </div>

                            {/* Fault photo */}
                            {novedad.fotoFalla && (
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setEnlargedPhoto(novedad.fotoFalla)}
                                  className="relative group"
                                >
                                  <img
                                    src={novedad.fotoFalla}
                                    alt="Foto de falla"
                                    className="h-16 w-16 rounded-md object-cover border cursor-pointer hover:opacity-80 transition-opacity"
                                  />
                                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30 rounded-md">
                                    <ImageIcon className="h-4 w-4 text-white" />
                                  </div>
                                </button>
                                <span className="text-xs text-muted-foreground">Foto de falla original</span>
                              </div>
                            )}

                            {/* Resolve button */}
                            <div>
                              <input
                                ref={(el) => {
                                  if (novedad._id === resolvingNovedadId) {
                                    novedadFileInputRef.current = el;
                                  }
                                }}
                                type="file"
                                accept="image/*"
                                multiple
                                className="hidden"
                                onChange={async (e) => {
                                  const files = Array.from(e.target.files || []);
                                  if (files.length) {
                                    await handleResolveNovedad(preop._id, novedad._id, files);
                                  }
                                  e.target.value = "";
                                }}
                              />
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full gap-2"
                                disabled={uploadingCorreccion && resolvingNovedadId === novedad._id}
                                onClick={() => {
                                  setResolvingNovedadId(novedad._id);
                                  // Need a slight delay so the ref is assigned
                                  setTimeout(() => {
                                    novedadFileInputRef.current?.click();
                                  }, 50);
                                }}
                              >
                                {uploadingCorreccion && resolvingNovedadId === novedad._id ? (
                                  <>
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    Subiendo...
                                  </>
                                ) : (
                                  <>
                                    <Upload className="h-3.5 w-3.5" />
                                    Subir fotos de correccion
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Enlarged photo modal */}
        {enlargedPhoto && (
          <div
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
            onClick={() => setEnlargedPhoto(null)}
          >
            <img
              src={enlargedPhoto}
              alt="Foto ampliada"
              className="max-w-full max-h-full rounded-lg object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
      </ConductorLayout>
    );
  }

  // ── Print individual historial PDF (QR public view con auto-print) ──
  const handlePrintHistorial = (item: PreopHistorialItem) => {
    if (!item.codigoPublico) {
      toast.error("No se puede descargar sin código público");
      return;
    }
    const win = window.open(`/verificar/preoperacional/${item.codigoPublico}?print=1`, "_blank");
    if (!win) {
      toast.error("Permita las ventanas emergentes para descargar el PDF");
      return;
    }
    toast.success("Preparando PDF...");
  };

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
                  Object.values(item.seccionDelantera || {}).filter((v) => v.estado === "MALO").length +
                  Object.values(item.seccionMedia || {}).filter((v) => v.estado === "MALO").length +
                  Object.values(item.seccionTrasera || {}).filter((v) => v.estado === "MALO").length;

                return (
                  <div key={item._id} className="bg-card border rounded-lg p-3 space-y-3">
                    {/* Top row: placa + estado */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-foreground text-base">{placa || "—"}</span>
                      {item.estadoGeneral && (
                        <Badge variant={item.estadoGeneral === "APROBADO" ? "default" : item.estadoGeneral === "NOVEDAD" ? "secondary" : "destructive"} className="text-[10px]">
                          {item.estadoGeneral.replace("_", " ")}
                        </Badge>
                      )}
                      {fallas > 0 && (
                        <span className="inline-flex items-center gap-1 text-red-600 text-xs font-medium">
                          <XCircle className="h-3 w-3" />
                          {fallas}
                        </span>
                      )}
                    </div>

                    {/* Date */}
                    <p className="text-xs text-muted-foreground">
                      {fecha ? format(new Date(fecha), "dd MMM yyyy, HH:mm", { locale: es }) : "—"}
                    </p>

                    {/* Actions: 3 buttons grid */}
                    <div className="grid grid-cols-3 gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 h-9 text-xs px-2"
                        onClick={() => setViewingItem(item)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Ver
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 h-9 text-xs px-2"
                        onClick={() => handlePrintHistorial(item)}
                      >
                        <Download className="h-3.5 w-3.5" />
                        PDF
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 h-9 text-xs px-2"
                        onClick={() => item.codigoPublico && setQrItem(item)}
                        disabled={!item.codigoPublico}
                      >
                        <QrCode className="h-3.5 w-3.5" />
                        QR
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* QR Modal */}
        {/* Detail Dialog — same format as admin view */}
        <Dialog open={!!viewingItem} onOpenChange={() => setViewingItem(null)}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl w-[95vw]">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <DialogTitle className="flex items-center gap-3">
                  <ClipboardCheck className="h-5 w-5 text-primary" />
                  Inspección — {!viewingItem ? "—" : typeof viewingItem.vehiculo === "object" ? viewingItem.vehiculo?.placa || "—" : viewingItem.vehiculo || "—"}
                </DialogTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => viewingItem && handlePrintHistorial(viewingItem)}
                  className="gap-1.5 mr-6"
                >
                  <Download className="h-4 w-4" />
                  PDF
                </Button>
              </div>
            </DialogHeader>

            {viewingItem && (
              <Tabs defaultValue="detalle" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="detalle">Detalle</TabsTrigger>
                  <TabsTrigger value="seguimiento">Seguimiento</TabsTrigger>
                </TabsList>
                <TabsContent value="detalle" className="space-y-4 mt-4">
                {/* Summary */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Vehículo</p>
                    <p className="font-semibold">{typeof viewingItem.vehiculo === "object" ? viewingItem.vehiculo?.placa : viewingItem.vehiculo || "—"}</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Conductor</p>
                    <p className="font-semibold text-sm">{user?.persona || user?.username || "—"}</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Kilometraje</p>
                    <p className="font-semibold">{viewingItem.kilometraje?.toLocaleString() || "—"} km</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Estado</p>
                    <div className="mt-1">
                      <Badge variant={viewingItem.estadoGeneral === "APROBADO" ? "default" : viewingItem.estadoGeneral === "NOVEDAD" ? "secondary" : "destructive"}>
                        {viewingItem.estadoGeneral?.replace("_", " ") || "—"}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>Firmado: <strong className="text-foreground">{viewingItem.firmadoCheck ? "Sí" : "No"}</strong></span>
                  <span>Fecha: <strong className="text-foreground">{(viewingItem.fechaCreacion || viewingItem.createdAt) ? format(new Date((viewingItem.fechaCreacion || viewingItem.createdAt)!), "dd MMM yyyy HH:mm", { locale: es }) : "—"}</strong></span>
                </div>

                {/* Sección Conductor */}
                {viewingItem.seccionConductor && (
                  <div className="bg-muted/30 rounded-lg p-4 space-y-2">
                    <h4 className="text-sm font-semibold">Sección Conductor</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Horas de Sueño</p>
                        <p className="font-medium">{viewingItem.seccionConductor.horasSueno}h</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Estado de Salud</p>
                        <Badge variant={viewingItem.seccionConductor.estadoSalud === "BUENO" ? "default" : viewingItem.seccionConductor.estadoSalud === "REGULAR" ? "secondary" : "destructive"}>
                          {viewingItem.seccionConductor.estadoSalud}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Medicamentos</p>
                        <p className="font-medium">{viewingItem.seccionConductor.tomaMedicamentos ? "Sí" : "No"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Sustancias</p>
                        <p className="font-medium">{viewingItem.seccionConductor.consumoSustancias ? "Sí" : "No"}</p>
                      </div>
                    </div>
                    {viewingItem.seccionConductor.estadoSaludObservaciones && (
                      <p className="text-xs text-muted-foreground mt-2">
                        <strong>Observaciones:</strong> {viewingItem.seccionConductor.estadoSaludObservaciones}
                      </p>
                    )}
                  </div>
                )}

                {/* Sections */}
                <div className="space-y-4 pt-2 border-t">
                  {([
                    { title: "Sección Delantera", data: viewingItem.seccionDelantera },
                    { title: "Sección Media", data: viewingItem.seccionMedia },
                    { title: "Sección Trasera", data: viewingItem.seccionTrasera },
                  ] as const).map(({ title, data }) => {
                    if (!data) return null;
                    const entries = Object.entries(data);
                    const fallas = entries.filter(([, v]) => v.estado === "MALO").length;
                    return (
                      <div key={title}>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-semibold">{title}</h4>
                          <span className="text-xs text-muted-foreground">
                            {entries.length - fallas}/{entries.length} OK
                            {fallas > 0 && <span className="text-destructive ml-1">({fallas} fallas)</span>}
                          </span>
                        </div>
                        <div className="space-y-1">
                          {entries.map(([key, val]) => (
                            <div
                              key={key}
                              className={`flex items-start gap-2 p-2 rounded-md text-sm ${
                                val.estado === "MALO"
                                  ? "bg-red-50 dark:bg-red-900/15 border border-red-200 dark:border-red-800"
                                  : "bg-muted/30"
                              }`}
                            >
                              {val.estado === "MALO" ? (
                                <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                              ) : (
                                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                              )}
                              <div className="flex-1 min-w-0">
                                <span className="font-medium">{labelForItem(key)}</span>
                                {val.estado === "MALO" && val.observaciones && (
                                  <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">{val.observaciones}</p>
                                )}
                              </div>
                              <Badge variant={val.estado === "MALO" ? "destructive" : "default"} className="text-xs shrink-0">
                                {val.estado}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
                </TabsContent>
                <TabsContent value="seguimiento" className="mt-4">
                  <PreopSeguimiento preopId={viewingItem._id} />
                </TabsContent>
              </Tabs>
            )}
          </DialogContent>
        </Dialog>

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
            onClick={() => setShowNovedades(true)}
          >
            <AlertTriangle className="h-4 w-4" />
            Novedades
            {totalPendientes > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 min-w-[20px] px-1 text-xs">{totalPendientes}</Badge>
            )}
          </Button>
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
                            clearSeccionConductor();
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

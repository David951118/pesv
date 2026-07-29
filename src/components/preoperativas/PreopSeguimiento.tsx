import { useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  MessageSquare,
  Clock,
  Pencil,
  Trash2,
  Send,
  ShieldCheck,
  Ban,
  Upload,
  Camera,
  History,
} from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { getApiRndcBaseUrl } from "@/services/apirndc/apirndc.config";
import { uploadFileToS3 } from "@/lib/uploadToS3";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// ── Types ──

type TipoAnotacion = "GENERAL" | "VALIDACION" | "REVISION";

interface Anotacion {
  _id: string;
  texto: string;
  tipo: TipoAnotacion;
  fotoFalla?: string;
  fotoCorreccion?: string;
  novedadOrigenId?: string;
  itemOrigen?: string;
  autor?: {
    _id?: string;
    userId?: string;
    nombres?: string;
    apellidos?: string;
    nombre?: string;
    rol?: string;
    role?: string;
  } | string;
  autorNombre?: string;
  autorRol?: string;
  rol?: string;
  fecha?: string;
  createdAt?: string;
}

interface HistorialEntry {
  accion: "CREADA" | "CORRECCION_SUBIDA" | "VALIDADA" | "RECHAZADA" | "PLAZO_EXTENDIDO" | string;
  fecha?: string;
  usuario?: any;
  observaciones?: string;
  motivo?: string;
  detalles?: string;
}

interface NovedadFull {
  _id: string;
  item: string;
  seccion?: string;
  descripcion?: string;
  estado: string;
  fechaLimite?: string;
  fotoFalla?: string;
  fotoCorreccion?: string;
  historial?: HistorialEntry[];
}

interface HistorialResponse {
  novedades?: NovedadFull[];
  historial?: HistorialEntry[];
  anotaciones?: Anotacion[];
}

interface PreopSeguimientoProps {
  preopId: string;
  onUpdate?: () => void;
}

// ── Helpers ──

const ITEM_LABELS: Record<string, string> = {
  luces: "Luces", direccionalesDelanteros: "Direccionales Delanteros", limpiabrisas: "Limpiabrisas",
  espejosRetrovisores: "Espejos Retrovisores", liquidos: "Líquidos", llantaDelanteraDerecha: "Llanta Del. Derecha",
  llantaDelanteraIzquierda: "Llanta Del. Izquierda", bocina: "Bocina", frenos: "Frenos", tablero: "Tablero",
  timon: "Timón", cinturones: "Cinturones", pedales: "Pedales", frenoMano: "Freno de Mano", bateria: "Batería",
  kitPrimerosAuxilios: "Kit Primeros Auxilios", reflectivos: "Reflectivos", stop: "Stop", llantasRepuesto: "Llantas de Repuesto",
  equipoCarretera: "Equipo de Carretera", llantaTraseraDerecha: "Llanta Tras. Derecha",
  llantaTraseraIzquierda: "Llanta Tras. Izquierda", direccionalesTraseros: "Direccionales Traseros", placa: "Placa",
  parabrisas: "Parabrisas", extintor: "Extintor", herramienta: "Herramienta",
};

function fmt(date?: string) {
  if (!date) return "—";
  try {
    return format(new Date(date), "dd MMM yyyy HH:mm", { locale: es });
  } catch {
    return date;
  }
}

function autorLabel(a: Anotacion["autor"], an?: Anotacion): string {
  if (an?.autorNombre) return an.autorNombre;
  if (!a) return "Sistema";
  if (typeof a === "string") return a;
  if (a.nombres) return `${a.nombres} ${a.apellidos || ""}`.trim();
  return a.nombre || a.userId || "Usuario";
}

function autorInitials(a: Anotacion["autor"]): string {
  const name = autorLabel(a);
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("") || "U";
}

function autorId(a: Anotacion["autor"]): string | undefined {
  if (!a || typeof a === "string") return undefined;
  return a._id || a.userId;
}

function autorRolLabel(an: Anotacion): string {
  if (an.autorRol) return an.autorRol;
  if (an.rol) return an.rol;
  if (typeof an.autor === "object" && an.autor) {
    return an.autor.rol || an.autor.role || "—";
  }
  return "—";
}

function tipoBadgeVariant(t: TipoAnotacion): "default" | "secondary" | "destructive" | "outline" {
  switch (t) {
    case "VALIDACION":
      return "default";
    case "REVISION":
      return "secondary";
    default:
      return "outline";
  }
}

function estadoNovedadBadge(estado: string) {
  const map: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
    CREADA: { variant: "secondary", label: "Creada" },
    PENDIENTE: { variant: "secondary", label: "Pendiente" },
    EN_REVISION: { variant: "outline", label: "En revisión" },
    VALIDADA: { variant: "default", label: "Validada" },
    RESUELTA: { variant: "default", label: "Resuelta" },
    RECHAZADA: { variant: "destructive", label: "Rechazada" },
  };
  const m = map[estado] || { variant: "outline" as const, label: estado };
  return <Badge variant={m.variant}>{m.label}</Badge>;
}

function accionMeta(accion: string): { color: string; label: string; icon: JSX.Element } {
  switch (accion) {
    case "CREADA":
      return {
        color: "bg-amber-500",
        label: "Novedad creada",
        icon: <AlertCircle className="h-3 w-3 text-white" />,
      };
    case "CORRECCION_SUBIDA":
      return {
        color: "bg-blue-500",
        label: "Corrección enviada",
        icon: <Clock className="h-3 w-3 text-white" />,
      };
    case "VALIDADA":
      return {
        color: "bg-green-500",
        label: "Validada",
        icon: <CheckCircle2 className="h-3 w-3 text-white" />,
      };
    case "RECHAZADA":
      return {
        color: "bg-red-500",
        label: "Rechazada",
        icon: <XCircle className="h-3 w-3 text-white" />,
      };
    case "PLAZO_EXTENDIDO":
      return {
        color: "bg-indigo-500",
        label: "Plazo extendido",
        icon: <Clock className="h-3 w-3 text-white" />,
      };
    default:
      return {
        color: "bg-gray-400",
        label: accion,
        icon: <AlertCircle className="h-3 w-3 text-white" />,
      };
  }
}

// ── Component ──

export function PreopSeguimiento({ preopId, onUpdate }: PreopSeguimientoProps) {
  const { bearerToken, role, user } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = role === "admin" || role === "supervisor";

  const [nuevoTexto, setNuevoTexto] = useState("");
  const [nuevoTipo, setNuevoTipo] = useState<TipoAnotacion>("GENERAL");
  const [nuevoFoto, setNuevoFoto] = useState<File | null>(null);
  const [subiendoAnotacion, setSubiendoAnotacion] = useState(false);
  const nuevoFotoInputRef = useRef<HTMLInputElement | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTexto, setEditingTexto] = useState("");

  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [validarNovedadId, setValidarNovedadId] = useState<string | null>(null);
  const [validarObs, setValidarObs] = useState("");
  const [rechazarNovedadId, setRechazarNovedadId] = useState<string | null>(null);
  const [rechazarMotivo, setRechazarMotivo] = useState("");
  const [uploadingNovedadId, setUploadingNovedadId] = useState<string | null>(null);
  const [showHistorialNovedadId, setShowHistorialNovedadId] = useState<string | null>(null);
  const [correccionNovedadId, setCorreccionNovedadId] = useState<string | null>(null);
  const [correccionObs, setCorreccionObs] = useState("");
  const [correccionFile, setCorreccionFile] = useState<File | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const base = getApiRndcBaseUrl();
  const authHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${bearerToken}` };

  // ── Queries ──

  const historialQuery = useQuery<HistorialResponse>({
    queryKey: ["preop-historial", preopId],
    enabled: !!preopId && !!bearerToken,
    queryFn: async () => {
      const res = await fetch(`${base}/api/preoperacionales/${preopId}/historial`, {
        headers: authHeaders,
      });
      if (!res.ok) throw new Error("Error al cargar historial");
      const json = await res.json();
      // Unwrap { success, data } or return direct
      return (json.data ?? json) as HistorialResponse;
    },
  });

  // Preop base: necesario para saber horasSueno y determinar si una novedad es incorregible.
  const preopQuery = useQuery({
    queryKey: ["preop-base", preopId],
    enabled: !!preopId && !!bearerToken,
    queryFn: async () => {
      const res = await fetch(`${base}/api/preoperacionales/${preopId}`, {
        headers: authHeaders,
      });
      if (!res.ok) return null;
      const json = await res.json();
      return (json.data ?? json) as { seccionConductor?: { horasSueno?: number } };
    },
  });

  const horasSueno = Number(preopQuery.data?.seccionConductor?.horasSueno ?? NaN);
  // Regla PESV: se requieren 8 horas de sueno. Menos de eso, no se corrige con foto.
  const sueñoInsuficiente = Number.isFinite(horasSueno) && horasSueno < 8;

  // Una novedad es "incorregible" si su item/seccion tiene que ver con horas de sueno y el conductor durmio <= 2 horas.
  const esNovedadSuenoIncorregible = (nov: NovedadFull): boolean => {
    if (!sueñoInsuficiente) return false;
    const tag = `${nov.item ?? ""} ${nov.seccion ?? ""}`.toLowerCase();
    return (
      tag.includes("sueno") ||
      tag.includes("sueño") ||
      tag.includes("horassueno") ||
      tag.includes("horas_sueno") ||
      tag.includes("conductor")
    );
  };

  const anotacionesQuery = useQuery({
    queryKey: ["preop-anotaciones", preopId],
    enabled: !!preopId && !!bearerToken,
    queryFn: async () => {
      const res = await fetch(`${base}/api/preoperacionales/${preopId}/anotaciones`, {
        headers: authHeaders,
      });
      if (!res.ok) throw new Error("Error al cargar anotaciones");
      const json = await res.json();
      return json;
    },
  });

  const anotaciones: Anotacion[] = useMemo(() => {
    const raw = anotacionesQuery.data as any;
    if (!raw) return [];
    // Try multiple response shapes:
    // - Array directly
    // - { anotaciones: [...] }
    // - { data: [...] }
    // - { data: { anotaciones: [...] } }
    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw.anotaciones)) return raw.anotaciones;
    if (Array.isArray(raw.data)) return raw.data;
    if (raw.data && Array.isArray(raw.data.anotaciones)) return raw.data.anotaciones;
    return [];
  }, [anotacionesQuery.data]);

  const novedades: NovedadFull[] = useMemo(() => {
    const data = historialQuery.data;
    if (!data) return [];
    const raw = data as any;
    const list = Array.isArray(raw.novedades)
      ? raw.novedades
      : raw.data && Array.isArray(raw.data.novedades)
        ? raw.data.novedades
        : [];
    // El backend expone el estado de la novedad como `estadoCorreccion`
    return list.map((n: any) => ({
      ...n,
      estado: n.estado ?? n.estadoCorreccion ?? "PENDIENTE",
    }));
  }, [historialQuery.data]);

  // Timeline: combine historial entries (from each novedad) + annotations, sorted by date
  type TimelineItem =
    | { kind: "historial"; fecha: string; accion: string; novedadId?: string; item?: string; entry: HistorialEntry }
    | { kind: "anotacion"; fecha: string; anotacion: Anotacion };

  const timeline: TimelineItem[] = useMemo(() => {
    const items: TimelineItem[] = [];
    for (const nov of novedades) {
      for (const h of nov.historial || []) {
        items.push({
          kind: "historial",
          fecha: h.fecha || "",
          accion: h.accion,
          novedadId: nov._id,
          item: nov.item,
          entry: h,
        });
      }
    }
    for (const a of anotaciones) {
      items.push({
        kind: "anotacion",
        fecha: a.fecha || a.createdAt || "",
        anotacion: a,
      });
    }
    return items.sort((a, b) => {
      const da = new Date(a.fecha || 0).getTime();
      const db = new Date(b.fecha || 0).getTime();
      return da - db;
    });
  }, [novedades, anotaciones]);

  // ── Mutations ──

  const refreshAll = async () => {
    await Promise.all([
      queryClient.refetchQueries({ queryKey: ["preop-historial", preopId] }),
      queryClient.refetchQueries({ queryKey: ["preop-anotaciones", preopId] }),
    ]);
    queryClient.invalidateQueries({ queryKey: ["preoperacionales-admin"] });
    onUpdate?.();
  };

  const createMutation = useMutation({
    mutationFn: async (body: { texto: string; tipo: TipoAnotacion; fotoCorreccion?: string; fotoFalla?: string }) => {
      const res = await fetch(`${base}/api/preoperacionales/${preopId}/anotaciones`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || "Error al crear anotación");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Anotación creada");
      setNuevoTexto("");
      setNuevoTipo("GENERAL");
      setNuevoFoto(null);
      refreshAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handlePublicarAnotacion = async () => {
    if (!nuevoTexto.trim()) return;
    setSubiendoAnotacion(true);
    try {
      let fotoUrl: string | undefined;
      if (nuevoFoto) {
        const presRes = await fetch(`${base}/api/documentos/presigned-url`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            fileName: `anotacion-${Date.now()}.${nuevoFoto.name.split(".").pop()}`,
            mimeType: nuevoFoto.type || "image/jpeg",
          }),
        });
        if (!presRes.ok) throw new Error("Error al obtener URL de subida");
        const presJson = await presRes.json();
        const { uploadUrl, publicUrl } = presJson.data || presJson;
        await uploadFileToS3(uploadUrl, nuevoFoto);
        fotoUrl = publicUrl;
      }
      await createMutation.mutateAsync({
        texto: nuevoTexto.trim(),
        tipo: nuevoTipo,
        ...(fotoUrl ? { fotoCorreccion: fotoUrl } : {}),
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al crear anotación");
    } finally {
      setSubiendoAnotacion(false);
    }
  };

  const updateMutation = useMutation({
    mutationFn: async ({ aid, texto }: { aid: string; texto: string }) => {
      const res = await fetch(`${base}/api/preoperacionales/${preopId}/anotaciones/${aid}`, {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify({ texto }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || "Error al actualizar");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Anotación actualizada");
      setEditingId(null);
      setEditingTexto("");
      refreshAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (aid: string) => {
      const res = await fetch(`${base}/api/preoperacionales/${preopId}/anotaciones/${aid}`, {
        method: "DELETE",
        headers: authHeaders,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || "Error al eliminar");
      }
      return true;
    },
    onSuccess: () => {
      toast.success("Anotación eliminada");
      setDeleteId(null);
      refreshAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const validarMutation = useMutation({
    mutationFn: async ({ nid, observaciones }: { nid: string; observaciones: string }) => {
      const res = await fetch(`${base}/api/preoperacionales/${preopId}/novedades/${nid}/validar`, {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify({ observaciones }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || "Error al validar");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Corrección validada");
      setValidarNovedadId(null);
      setValidarObs("");
      refreshAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rechazarMutation = useMutation({
    mutationFn: async ({ nid, motivo }: { nid: string; motivo: string }) => {
      const res = await fetch(`${base}/api/preoperacionales/${preopId}/novedades/${nid}/rechazar`, {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify({ motivo }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || "Error al rechazar");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Corrección rechazada");
      setRechazarNovedadId(null);
      setRechazarMotivo("");
      refreshAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resolverMutation = useMutation({
    mutationFn: async ({ nid, fotoCorreccion }: { nid: string; fotoCorreccion: string }) => {
      const res = await fetch(`${base}/api/preoperacionales/${preopId}/novedades/${nid}/resolver`, {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify({ fotoCorreccion }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || "Error al subir corrección");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Corrección enviada para revisión");
      refreshAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleConfirmCorreccion = async (nid: string, item?: string) => {
    if (!bearerToken || !correccionFile) {
      toast.error("Seleccione una foto");
      return;
    }
    setUploadingNovedadId(nid);
    try {
      // 1. Get presigned URL
      const presRes = await fetch(`${base}/api/documentos/presigned-url`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          fileName: `correccion-${nid}-${Date.now()}.${correccionFile.name.split(".").pop()}`,
          mimeType: correccionFile.type || "image/jpeg",
        }),
      });
      if (!presRes.ok) throw new Error("Error al obtener URL de subida");
      const presJson = await presRes.json();
      const { uploadUrl, publicUrl } = presJson.data || presJson;

      // 2. Upload to S3
      await uploadFileToS3(uploadUrl, correccionFile);

      // 3. Save the correction URL
      await resolverMutation.mutateAsync({ nid, fotoCorreccion: publicUrl });

      // 4. If there's an observation, create an annotation linked to this novedad
      if (correccionObs.trim()) {
        try {
          await fetch(`${base}/api/preoperacionales/${preopId}/anotaciones`, {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({
              texto: correccionObs.trim(),
              tipo: "GENERAL",
              novedadOrigenId: nid,
              itemOrigen: item,
              fotoCorreccion: publicUrl,
            }),
          });
        } catch {
          // non-fatal
        }
      }

      setCorreccionNovedadId(null);
      setCorreccionObs("");
      setCorreccionFile(null);
      refreshAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al subir foto");
    } finally {
      setUploadingNovedadId(null);
    }
  };

  // ── Permissions helpers ──

  const currentIdentifiers = [user?.userId, user?.persona, user?.username].filter(Boolean) as string[];

  const isSameAuthor = (a: Anotacion): boolean => {
    // autor can be a string (username) or an object with _id/userId/nombre
    if (typeof a.autor === "string") {
      return currentIdentifiers.some((id) => id === a.autor);
    }
    if (a.autor && typeof a.autor === "object") {
      const candidates = [a.autor._id, a.autor.userId, a.autor.nombre].filter(Boolean) as string[];
      return candidates.some((c) => currentIdentifiers.includes(c));
    }
    return false;
  };

  const canEditAnotacion = (a: Anotacion): boolean => {
    if (a.tipo === "VALIDACION") return false;
    if (isAdmin) return true;
    return isSameAuthor(a);
  };

  const canDeleteAnotacion = (a: Anotacion): boolean => {
    if (a.tipo === "VALIDACION") return !!isAdmin;
    if (isAdmin) return true;
    return isSameAuthor(a);
  };

  const loading = historialQuery.isLoading || anotacionesQuery.isLoading;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Timeline */}
      <section>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Línea de tiempo
        </h3>
        {timeline.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">Sin actividad registrada.</p>
        ) : (
          <ol className="relative border-l border-muted-foreground/20 ml-2 space-y-4">
            {timeline.map((it, idx) => {
              if (it.kind === "historial") {
                const meta = accionMeta(it.accion);
                return (
                  <li key={`h-${idx}`} className="ml-5">
                    <span
                      className={`absolute -left-[9px] flex h-4 w-4 items-center justify-center rounded-full ${meta.color} ring-2 ring-background`}
                    >
                      {meta.icon}
                    </span>
                    <div className="flex items-center flex-wrap gap-2">
                      <p className="text-sm font-medium">{meta.label}</p>
                      {it.item && (
                        <Badge variant="outline" className="text-xs">
                          {ITEM_LABELS[it.item] || it.item}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{fmt(it.fecha)}</p>
                    {(it.entry.observaciones || it.entry.motivo || it.entry.detalles) && (
                      <p className="text-xs mt-1 text-muted-foreground">
                        {it.entry.observaciones || it.entry.motivo || it.entry.detalles}
                      </p>
                    )}
                  </li>
                );
              }
              const a = it.anotacion;
              return (
                <li key={`a-${a._id}`} className="ml-5">
                  <span className="absolute -left-[9px] flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 ring-2 ring-background">
                    <MessageSquare className="h-2.5 w-2.5 text-white" />
                  </span>
                  <div className="flex items-center flex-wrap gap-2">
                    <p className="text-sm font-medium">{autorLabel(a.autor, a)}</p>
                    <Badge variant={tipoBadgeVariant(a.tipo)} className="text-xs">
                      {a.tipo}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{fmt(it.fecha)}</p>
                  <p className="text-sm mt-1 whitespace-pre-wrap">{a.texto}</p>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {/* Novedades detail */}
      {novedades.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Novedades</h3>
          {novedades.map((nov) => {
            const validacionAnot = anotaciones.find(
              (a) => a.tipo === "VALIDACION" && a.novedadOrigenId === nov._id
            );
            const antes = validacionAnot?.fotoFalla || nov.fotoFalla;
            const despues = validacionAnot?.fotoCorreccion || nov.fotoCorreccion;
            return (
              <div
                key={nov._id}
                className="border rounded-lg p-3 space-y-2 bg-muted/20"
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <p className="text-sm font-medium">
                      {ITEM_LABELS[nov.item] || nov.item}
                      {nov.seccion ? <span className="text-muted-foreground"> — {nov.seccion}</span> : null}
                    </p>
                    {nov.descripcion && (
                      <p className="text-xs text-muted-foreground">{nov.descripcion}</p>
                    )}
                  </div>
                  {estadoNovedadBadge(nov.estado)}
                </div>
                {nov.fechaLimite && (
                  <p className="text-xs text-muted-foreground">
                    Fecha límite: {fmt(nov.fechaLimite)}
                  </p>
                )}

                {/* Foto de falla original (siempre visible si existe) */}
                {nov.fotoFalla && nov.estado !== "VALIDADA" && (
                  <div className="pt-2 border-t">
                    <p className="text-xs font-semibold text-muted-foreground mb-1">Foto de la falla</p>
                    <a href={nov.fotoFalla} target="_blank" rel="noreferrer">
                      <img
                        src={nov.fotoFalla}
                        alt="Falla"
                        className="h-32 w-auto object-cover rounded-lg border-2 border-red-200"
                      />
                    </a>
                  </div>
                )}

                {/* Foto de corrección subida (en revisión) */}
                {nov.fotoCorreccion && nov.estado !== "VALIDADA" && (
                  <div className="pt-2 border-t">
                    <p className="text-xs font-semibold text-muted-foreground mb-1">Foto de corrección (esperando validación)</p>
                    <a href={nov.fotoCorreccion} target="_blank" rel="noreferrer">
                      <img
                        src={nov.fotoCorreccion}
                        alt="Corrección"
                        className="h-32 w-auto object-cover rounded-lg border-2 border-blue-200"
                      />
                    </a>
                  </div>
                )}

                {/* Aviso de incorregible cuando durmio <= 2h — esta condicion no se corrige con una foto */}
                {(nov.estado === "CREADA" || nov.estado === "PENDIENTE" || nov.estado === "RECHAZADA") && esNovedadSuenoIncorregible(nov) && (
                  <div className="pt-2 border-t">
                    <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-3">
                      <Ban className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                      <div className="text-xs">
                        <p className="font-semibold text-amber-800 dark:text-amber-300">Novedad no corregible</p>
                        <p className="text-amber-700 dark:text-amber-400 mt-0.5">
                          El conductor reportó {horasSueno} {horasSueno === 1 ? "hora" : "horas"} de sueño (mínimo PESV: 8). Esta condición no puede subsanarse subiendo una corrección; requiere reemplazo del conductor o decisión administrativa.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Subir foto de corrección - cualquier rol con acceso, novedades pendientes (y corregibles) */}
                {(nov.estado === "CREADA" || nov.estado === "PENDIENTE" || nov.estado === "RECHAZADA") && !esNovedadSuenoIncorregible(nov) && (
                  <div className="pt-2 border-t">
                    {correccionNovedadId === nov._id ? (
                      <div className="space-y-2 bg-background border rounded-md p-3">
                        <p className="text-xs font-semibold">Enviar corrección</p>

                        <div>
                          <label className="text-xs text-muted-foreground block mb-1">
                            Observación <span className="text-[10px]">(obligatoria)</span>
                          </label>
                          <Textarea
                            value={correccionObs}
                            onChange={(e) => setCorreccionObs(e.target.value)}
                            placeholder="Describa cómo se corrigió la novedad..."
                            rows={2}
                          />
                        </div>

                        <div>
                          <label className="text-xs text-muted-foreground block mb-1">
                            Foto de la corrección *
                          </label>
                          <input
                            ref={(el) => { fileInputRefs.current[nov._id] = el; }}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="hidden"
                            onClick={(e) => { (e.target as HTMLInputElement).value = ""; }}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) setCorreccionFile(file);
                            }}
                          />
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="gap-1.5"
                              onClick={() => fileInputRefs.current[nov._id]?.click()}
                            >
                              <Camera className="h-3.5 w-3.5" />
                              {correccionFile ? "Cambiar foto" : "Seleccionar foto"}
                            </Button>
                            {correccionFile && (
                              <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                                {correccionFile.name}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex gap-2 pt-1">
                          <Button
                            size="sm"
                            disabled={
                              uploadingNovedadId === nov._id ||
                              !correccionFile ||
                              !correccionObs.trim()
                            }
                            onClick={() => handleConfirmCorreccion(nov._id, nov.item)}
                          >
                            {uploadingNovedadId === nov._id && (
                              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                            )}
                            Enviar corrección
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setCorreccionNovedadId(null);
                              setCorreccionObs("");
                              setCorreccionFile(null);
                            }}
                            disabled={uploadingNovedadId === nov._id}
                          >
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        onClick={() => {
                          setCorreccionNovedadId(nov._id);
                          setCorreccionObs("");
                          setCorreccionFile(null);
                        }}
                      >
                        <Upload className="h-3.5 w-3.5" />
                        Subir corrección
                      </Button>
                    )}
                  </div>
                )}

                {/* Historial de la novedad — toggle */}
                {nov.historial && nov.historial.length > 0 && (
                  <div className="pt-2 border-t">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 gap-1 text-xs"
                      onClick={() => setShowHistorialNovedadId(showHistorialNovedadId === nov._id ? null : nov._id)}
                    >
                      <History className="h-3 w-3" />
                      {showHistorialNovedadId === nov._id ? "Ocultar" : "Ver"} historial ({nov.historial.length})
                    </Button>
                    {showHistorialNovedadId === nov._id && (
                      <ol className="mt-2 ml-2 border-l border-muted-foreground/20 space-y-2">
                        {nov.historial.map((h, hi) => {
                          const meta = accionMeta(h.accion);
                          return (
                            <li key={hi} className="ml-3 relative">
                              <span className={`absolute -left-[7px] top-1.5 h-3 w-3 rounded-full ${meta.color} ring-2 ring-background`}></span>
                              <p className="text-xs font-medium">{meta.label}</p>
                              <p className="text-[10px] text-muted-foreground">{fmt(h.fecha)}</p>
                              {(h.observaciones || h.motivo || h.detalles) && (
                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                  {h.observaciones || h.motivo || h.detalles}
                                </p>
                              )}
                            </li>
                          );
                        })}
                      </ol>
                    )}
                  </div>
                )}

                {/* Admin validation buttons */}
                {isAdmin && nov.estado === "EN_REVISION" && (
                  <div className="space-y-2">
                    {validarNovedadId === nov._id ? (
                      <div className="flex flex-col gap-2 bg-background border rounded-md p-2">
                        <Textarea
                          value={validarObs}
                          onChange={(e) => setValidarObs(e.target.value)}
                          placeholder="Observaciones de validación (opcional)"
                          rows={2}
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                            disabled={validarMutation.isPending}
                            onClick={() =>
                              validarMutation.mutate({ nid: nov._id, observaciones: validarObs })
                            }
                          >
                            {validarMutation.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                            Confirmar validación
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setValidarNovedadId(null)}>
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : rechazarNovedadId === nov._id ? (
                      <div className="flex flex-col gap-2 bg-background border rounded-md p-2">
                        <Textarea
                          value={rechazarMotivo}
                          onChange={(e) => setRechazarMotivo(e.target.value)}
                          placeholder="Motivo del rechazo"
                          rows={2}
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={rechazarMutation.isPending || !rechazarMotivo.trim()}
                            onClick={() =>
                              rechazarMutation.mutate({ nid: nov._id, motivo: rechazarMotivo })
                            }
                          >
                            {rechazarMutation.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                            Confirmar rechazo
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setRechazarNovedadId(null)}>
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 gap-1.5"
                          onClick={() => setValidarNovedadId(nov._id)}
                        >
                          <ShieldCheck className="h-3 w-3" />
                          Validar
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="gap-1.5"
                          onClick={() => setRechazarNovedadId(nov._id)}
                        >
                          <Ban className="h-3 w-3" />
                          Rechazar
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* Before/after photos for VALIDADA */}
                {nov.estado === "VALIDADA" && (antes || despues) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t">
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">Antes (falla)</p>
                      {antes ? (
                        <a href={antes} target="_blank" rel="noreferrer">
                          <img
                            src={antes}
                            alt="Falla"
                            className="w-full h-40 object-cover rounded-lg border-2 border-red-200"
                          />
                        </a>
                      ) : (
                        <div className="h-40 rounded-lg border bg-muted/30 flex items-center justify-center text-xs text-muted-foreground">
                          Sin foto
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">Después (corrección)</p>
                      {despues ? (
                        <a href={despues} target="_blank" rel="noreferrer">
                          <img
                            src={despues}
                            alt="Corrección"
                            className="w-full h-40 object-cover rounded-lg border-2 border-green-200"
                          />
                        </a>
                      ) : (
                        <div className="h-40 rounded-lg border bg-muted/30 flex items-center justify-center text-xs text-muted-foreground">
                          Sin foto
                        </div>
                      )}
                    </div>
                    {validacionAnot?.texto && (
                      <p className="sm:col-span-2 text-xs italic text-muted-foreground">
                        "{validacionAnot.texto}"
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}

      {/* Anotaciones list */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          Anotaciones ({anotaciones.length})
        </h3>
        {anotaciones.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">Sin anotaciones.</p>
        ) : (
          <div className="space-y-3">
            {[...anotaciones]
              .sort((a, b) => {
                const da = new Date(a.fecha || a.createdAt || 0).getTime();
                const db = new Date(b.fecha || b.createdAt || 0).getTime();
                return db - da;
              })
              .map((a) => (
                <div key={a._id} className="flex gap-3 border rounded-lg p-3">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="text-xs bg-primary/10 text-primary">
                      {autorInitials(a.autor)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center flex-wrap gap-2">
                      <p className="text-sm font-medium">{autorLabel(a.autor, a)}</p>
                      <Badge variant="outline" className="text-xs">
                        {autorRolLabel(a)}
                      </Badge>
                      <Badge variant={tipoBadgeVariant(a.tipo)} className="text-xs">
                        {a.tipo}
                      </Badge>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {fmt(a.fecha || a.createdAt)}
                      </span>
                    </div>
                    {editingId === a._id ? (
                      <div className="mt-2 space-y-2">
                        <Textarea
                          value={editingTexto}
                          onChange={(e) => setEditingTexto(e.target.value)}
                          rows={3}
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            disabled={updateMutation.isPending || !editingTexto.trim()}
                            onClick={() =>
                              updateMutation.mutate({ aid: a._id, texto: editingTexto })
                            }
                          >
                            {updateMutation.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                            Guardar
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingId(null);
                              setEditingTexto("");
                            }}
                          >
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm mt-1 whitespace-pre-wrap break-words">{a.texto}</p>
                        {a.itemOrigen && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Relacionado: {ITEM_LABELS[a.itemOrigen] || a.itemOrigen}
                          </p>
                        )}
                        {/* Fotos adjuntas: antes/después para VALIDACION, o foto única para otras */}
                        {a.tipo === "VALIDACION" && (a.fotoFalla || a.fotoCorreccion) ? (
                          <div className="grid grid-cols-2 gap-2 mt-2">
                            {a.fotoFalla && (
                              <div>
                                <p className="text-[10px] uppercase text-muted-foreground mb-0.5">Antes</p>
                                <a href={a.fotoFalla} target="_blank" rel="noreferrer">
                                  <img
                                    src={a.fotoFalla}
                                    alt="Antes"
                                    className="w-full h-32 object-cover rounded border-2 border-red-200"
                                  />
                                </a>
                              </div>
                            )}
                            {a.fotoCorreccion && (
                              <div>
                                <p className="text-[10px] uppercase text-muted-foreground mb-0.5">Después</p>
                                <a href={a.fotoCorreccion} target="_blank" rel="noreferrer">
                                  <img
                                    src={a.fotoCorreccion}
                                    alt="Después"
                                    className="w-full h-32 object-cover rounded border-2 border-green-200"
                                  />
                                </a>
                              </div>
                            )}
                          </div>
                        ) : (
                          (a.fotoFalla || a.fotoCorreccion) && (
                            <div className="mt-2 flex gap-2 flex-wrap">
                              {a.fotoCorreccion && (
                                <a href={a.fotoCorreccion} target="_blank" rel="noreferrer">
                                  <img
                                    src={a.fotoCorreccion}
                                    alt="Adjunto"
                                    className="h-24 w-auto object-cover rounded border"
                                  />
                                </a>
                              )}
                              {a.fotoFalla && (
                                <a href={a.fotoFalla} target="_blank" rel="noreferrer">
                                  <img
                                    src={a.fotoFalla}
                                    alt="Adjunto"
                                    className="h-24 w-auto object-cover rounded border"
                                  />
                                </a>
                              )}
                            </div>
                          )
                        )}
                        <div className="flex gap-1 mt-2">
                          {canEditAnotacion(a) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 gap-1"
                              onClick={() => {
                                setEditingId(a._id);
                                setEditingTexto(a.texto);
                              }}
                            >
                              <Pencil className="h-3 w-3" />
                              Editar
                            </Button>
                          )}
                          {canDeleteAnotacion(a) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 gap-1 text-destructive hover:text-destructive"
                              onClick={() => setDeleteId(a._id)}
                            >
                              <Trash2 className="h-3 w-3" />
                              Eliminar
                            </Button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}
          </div>
        )}
      </section>

      {/* Add annotation form */}
      <section className="border rounded-lg p-3 space-y-2 bg-muted/20">
        <h3 className="text-sm font-semibold">Agregar anotación</h3>
        <Textarea
          value={nuevoTexto}
          onChange={(e) => setNuevoTexto(e.target.value)}
          placeholder="Escribe una anotación..."
          rows={3}
        />

        {/* Foto opcional */}
        <input
          ref={nuevoFotoInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onClick={(e) => { (e.target as HTMLInputElement).value = ""; }}
          onChange={(e) => setNuevoFoto(e.target.files?.[0] || null)}
        />
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => nuevoFotoInputRef.current?.click()}
          >
            <Camera className="h-3.5 w-3.5" />
            {nuevoFoto ? "Cambiar foto" : "Adjuntar foto"}
            <span className="text-muted-foreground text-xs">(opcional)</span>
          </Button>
          {nuevoFoto && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground truncate max-w-[180px]">{nuevoFoto.name}</span>
              <button
                type="button"
                className="text-destructive hover:underline"
                onClick={() => setNuevoFoto(null)}
              >
                Quitar
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <Select value={nuevoTipo} onValueChange={(v) => setNuevoTipo(v as TipoAnotacion)}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="GENERAL">General</SelectItem>
              {isAdmin && <SelectItem value="REVISION">Revisión</SelectItem>}
            </SelectContent>
          </Select>
          <Button
            className="gap-1.5 sm:ml-auto"
            disabled={subiendoAnotacion || createMutation.isPending || !nuevoTexto.trim()}
            onClick={handlePublicarAnotacion}
          >
            {subiendoAnotacion || createMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Publicar
          </Button>
        </div>
      </section>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar anotación?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default PreopSeguimiento;

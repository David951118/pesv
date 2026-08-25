import { useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { getApiRndcBaseUrl } from "@/services/apirndc/apirndc.config";
import { uploadFileToS3 } from "@/lib/uploadToS3";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { ModuleHeader } from "@/components/layout/ModuleHeader";
import { ContentCard } from "@/components/layout/ContentCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronsUpDown,
  ClipboardCheck,
  Loader2,
  MinusCircle,
  Send,
  ShieldAlert,
  XCircle,
  Camera,
  Gauge,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getVehiculoKilometraje } from "@/services/apirndc/apirndc.api";
import { KM_FUENTE_LABELS } from "@/components/operacion/operacion.helpers";
import {
  SECCION_DELANTERA_ITEMS,
  SECCION_MEDIA_ITEMS,
  SECCION_TRASERA_ITEMS,
  SECCION_ASEO_ITEMS,
  KIT_PRIMEROS_AUXILIOS_ITEMS,
  KIT_CARRETERA_ITEMS,
} from "@/lib/preopItems";
import { KitInfoDialog } from "@/components/preoperativas/KitInfoDialog";

type Estado = "BUENO" | "REGULAR" | "MALO" | "NO_APLICA";

interface ItemState {
  estado: Estado;
  observaciones: string;
  fotoUrl?: string;
}

type ItemsMap = Record<string, ItemState>;

interface VehiculoOption {
  _id: string;
  placa: string;
  marca?: string;
  linea?: string;
}

interface ConductorOption {
  _id: string;
  nombres?: string;
  apellidos?: string;
  identificacion: string;
}

export default function NuevaPreoperacionalAdmin() {
  const { bearerToken, user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const base = getApiRndcBaseUrl();

  const [vehiculoId, setVehiculoId] = useState("");
  const [conductorIdSel, setConductorIdSel] = useState("");
  const [vehPopoverOpen, setVehPopoverOpen] = useState(false);
  const [condPopoverOpen, setCondPopoverOpen] = useState(false);
  const [kilometraje, setKilometraje] = useState("");
  const [loadingKm, setLoadingKm] = useState(false);
  const [horasSueno, setHorasSueno] = useState("");
  const [estadoSalud, setEstadoSalud] = useState<"" | "BUENO" | "REGULAR" | "MALO">("");
  const [estadoSaludObs, setEstadoSaludObs] = useState("");
  const [tomaMedicamentos, setTomaMedicamentos] = useState(false);
  const [medicamentosDetalle, setMedicamentosDetalle] = useState("");
  const [consumoSustancias, setConsumoSustancias] = useState(false);
  const [sustanciasDetalle, setSustanciasDetalle] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [confirmEtico, setConfirmEtico] = useState(false);

  // Items state: todo BUENO por defecto
  const initialItems = useMemo<ItemsMap>(() => {
    const m: ItemsMap = {};
    for (const it of [...SECCION_DELANTERA_ITEMS, ...SECCION_MEDIA_ITEMS, ...SECCION_TRASERA_ITEMS, ...SECCION_ASEO_ITEMS]) {
      m[it.key] = { estado: "BUENO", observaciones: "" };
    }
    return m;
  }, []);
  const [items, setItems] = useState<ItemsMap>(initialItems);

  // Popup de confirmacion para kits
  const [kitDialog, setKitDialog] = useState<{
    open: boolean;
    itemKey: string;
    estado: Estado;
    kit: "primerosAuxilios" | "carretera";
  } | null>(null);

  const fotoInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [uploadingPhotoKey, setUploadingPhotoKey] = useState<string | null>(null);

  // ── Catalogos ──
  const { data: vehiculos = [] } = useQuery({
    queryKey: ["admin-new-preop-vehiculos"],
    queryFn: async (): Promise<VehiculoOption[]> => {
      const res = await fetch(`${base}/api/vehiculos?limit=500`, {
        headers: { Authorization: `Bearer ${bearerToken}` },
      });
      if (!res.ok) return [];
      const json = await res.json();
      return (json.data ?? []) as VehiculoOption[];
    },
    enabled: !!bearerToken,
  });

  const { data: conductores = [] } = useQuery({
    queryKey: ["admin-new-preop-conductores"],
    queryFn: async (): Promise<ConductorOption[]> => {
      const res = await fetch(`${base}/api/terceros?limit=500`, {
        headers: { Authorization: `Bearer ${bearerToken}` },
      });
      if (!res.ok) return [];
      const json = await res.json();
      return (json.data ?? []) as ConductorOption[];
    },
    enabled: !!bearerToken,
  });

  const selectedVehiculo = vehiculos.find((v) => v._id === vehiculoId);
  const selectedConductor = conductores.find((c) => c._id === conductorIdSel);

  // ── Traer kilometraje actual desde Cellvi GPS ──
  const handleConsultarKm = async () => {
    if (!vehiculoId) {
      toast.info("Seleccione primero un vehículo");
      return;
    }
    setLoadingKm(true);
    try {
      const res = await getVehiculoKilometraje(vehiculoId);
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

  const updateItem = (key: string, patch: Partial<ItemState>) => {
    setItems((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  };

  // Subida de foto para fallas (MALO/REGULAR)
  const handlePhotoChange = async (key: string, file: File) => {
    if (!bearerToken) return;
    try {
      setUploadingPhotoKey(key);
      const presignedRes = await fetch(`${base}/api/documentos/presigned-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${bearerToken}` },
        body: JSON.stringify({ fileName: file.name, mimeType: file.type }),
      });
      if (!presignedRes.ok) throw new Error("No se pudo obtener URL de subida");
      const pres = await presignedRes.json();
      const { uploadUrl, publicUrl } = pres.data ?? pres;
      await uploadFileToS3(uploadUrl, file);
      updateItem(key, { fotoUrl: publicUrl });
      toast.success("Foto subida");
    } catch (e: any) {
      toast.error(e.message || "Error al subir foto");
    } finally {
      setUploadingPhotoKey(null);
    }
  };

  // ── Validación ──
  const { reviewed, fallas, needsFoto } = useMemo(() => {
    const all = [...SECCION_DELANTERA_ITEMS, ...SECCION_MEDIA_ITEMS, ...SECCION_TRASERA_ITEMS, ...SECCION_ASEO_ITEMS];
    let f = 0;
    let missingFoto = 0;
    for (const it of all) {
      const s = items[it.key];
      if (s.estado === "MALO") {
        f++;
        if (!s.fotoUrl) missingFoto++;
      }
    }
    return { reviewed: all.length, fallas: f, needsFoto: missingFoto };
  }, [items]);

  const estadoGeneral = fallas > 0 ? "NOVEDAD" : "APROBADO";

  const isFormValid =
    !!vehiculoId &&
    !!conductorIdSel &&
    Number(kilometraje) > 0 &&
    Number(horasSueno) > 0 &&
    !!estadoSalud &&
    needsFoto === 0 &&
    confirmEtico;

  // ── Submit ──
  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!bearerToken) throw new Error("Sin sesión");

      const buildSection = (arr: readonly { key: string; label: string }[]) => {
        const out: Record<string, { estado: string; observaciones: string; fotoUrl: string }> = {};
        for (const it of arr) {
          const s = items[it.key];
          out[it.key] = {
            estado: s.estado,
            observaciones: s.observaciones || "",
            fotoUrl: s.fotoUrl || "",
          };
        }
        return out;
      };

      const body = {
        vehiculo: vehiculoId,
        conductor: conductorIdSel,
        fecha: new Date().toISOString(),
        kilometraje: Number(kilometraje),
        firmadoCheck: true,
        observaciones: observaciones || undefined,
        // El backend deriva creadoPor del token; creadoPorUserId no se envía
        // (el userId de Cellvi no es ObjectId y el backend lo descarta)
        creadoPorAdmin: true,
        seccionConductor: {
          horasSueno: Number(horasSueno),
          estadoSalud: estadoSalud || "BUENO",
          estadoSaludObservaciones: estadoSaludObs || undefined,
          tomaMedicamentos,
          medicamentosDetalle: medicamentosDetalle || undefined,
          consumoSustancias,
          sustanciasDetalle: sustanciasDetalle || undefined,
        },
        seccionDelantera: buildSection(SECCION_DELANTERA_ITEMS),
        seccionMedia: buildSection(SECCION_MEDIA_ITEMS),
        seccionTrasera: buildSection(SECCION_TRASERA_ITEMS),
        seccionAseo: buildSection(SECCION_ASEO_ITEMS),
      };

      const res = await fetch(`${base}/api/preoperacionales`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${bearerToken}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        const e: any = new Error(err?.message || "Error al crear preoperacional");
        e.status = res.status;
        throw e;
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Preoperacional creada");
      queryClient.invalidateQueries({ queryKey: ["preoperacionales-admin"] });
      navigate("/preoperativas");
    },
    onError: (e: any) => {
      if (e.status === 409) {
        toast.error(
          "Ya existe una preoperacional para este vehículo hoy. Habilítele una preop extra desde la pantalla de preoperacionales antes de volver a crear.",
          { duration: 8000 },
        );
      } else if (e.status === 403) {
        toast.error("No tiene permisos para crear preoperacionales en nombre de otro conductor.");
      } else {
        toast.error(e.message);
      }
    },
  });

  // Aplica un estado al item, mostrando antes el popup informativo si es un kit.
  // NO_APLICA se aplica directo (no hay nada que confirmar si el item no aplica al vehiculo).
  const applyEstado = (itemKey: string, estado: Estado) => {
    const isKit = itemKey === "kitPrimerosAuxilios" || itemKey === "equipoCarretera";
    if (isKit && estado !== "NO_APLICA") {
      const kit = itemKey === "kitPrimerosAuxilios" ? "primerosAuxilios" : "carretera";
      setKitDialog({ open: true, itemKey, estado, kit });
      return;
    }
    updateItem(itemKey, { estado });
  };

  const handleKitConfirm = () => {
    if (!kitDialog) return;
    updateItem(kitDialog.itemKey, { estado: kitDialog.estado });
    setKitDialog(null);
  };

  // ── UI helpers ──
  const EstadoPicker = ({ itemKey }: { itemKey: string }) => {
    const s = items[itemKey];
    const opts: { v: Estado; label: string; icon: any; color: string }[] = [
      { v: "BUENO", label: "Bueno", icon: CheckCircle2, color: "text-green-600" },
      { v: "REGULAR", label: "Regular", icon: MinusCircle, color: "text-amber-500" },
      { v: "MALO", label: "Malo", icon: XCircle, color: "text-red-600" },
      { v: "NO_APLICA", label: "N/A", icon: AlertTriangle, color: "text-slate-500" },
    ];
    return (
      <div className="flex flex-wrap gap-1.5">
        {opts.map((o) => {
          const Icon = o.icon;
          const active = s.estado === o.v;
          return (
            <Button
              key={o.v}
              type="button"
              size="sm"
              variant={active ? "default" : "outline"}
              className={cn(
                "gap-1 h-8 text-xs",
                active && o.v === "MALO" && "bg-red-600 hover:bg-red-700",
                active && o.v === "REGULAR" && "bg-amber-500 hover:bg-amber-600",
                active && o.v === "NO_APLICA" && "bg-slate-600 hover:bg-slate-700",
              )}
              onClick={() => applyEstado(itemKey, o.v)}
            >
              <Icon className={cn("h-3.5 w-3.5", !active && o.color)} />
              {o.label}
            </Button>
          );
        })}
      </div>
    );
  };

  const renderSection = (title: string, arr: readonly { key: string; label: string }[]) => (
    <ContentCard>
      <div className="space-y-4">
        <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">{title}</h3>
        <div className="space-y-3 divide-y divide-border">
          {arr.map((it) => {
            const s = items[it.key];
            return (
              <div key={it.key} className="pt-3 first:pt-0 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-sm font-medium">{it.label}</span>
                  <EstadoPicker itemKey={it.key} />
                </div>
                {(s.estado === "REGULAR" || s.estado === "MALO") && (
                  <div className="space-y-2 pl-0.5">
                    <Textarea
                      value={s.observaciones}
                      onChange={(e) => updateItem(it.key, { observaciones: e.target.value })}
                      placeholder="Observaciones (opcional si es regular, recomendado si es malo)"
                      rows={2}
                      className="text-sm"
                    />
                    {s.estado === "MALO" && (
                      <div className="space-y-1">
                        <input
                          ref={(el) => { fotoInputRefs.current[it.key] = el; }}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          onClick={(e) => { (e.target as HTMLInputElement).value = ""; }}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handlePhotoChange(it.key, f);
                          }}
                        />
                        <Button
                          type="button"
                          variant={s.fotoUrl ? "default" : "outline"}
                          size="sm"
                          className="gap-1.5"
                          onClick={() => fotoInputRefs.current[it.key]?.click()}
                          disabled={uploadingPhotoKey === it.key}
                        >
                          {uploadingPhotoKey === it.key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                          {s.fotoUrl ? "Cambiar foto" : "Adjuntar foto (obligatoria)"}
                        </Button>
                        {s.fotoUrl && (
                          <img src={s.fotoUrl} alt="Falla" className="h-20 w-auto rounded border" />
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </ContentCard>
  );

  return (
    <DashboardLayout>
      <PageContainer>
        <ModuleHeader
          title="Nueva Preoperacional (Admin)"
          description="Diligenciar una preoperacional en nombre de un conductor"
          icon={ClipboardCheck}
        />

        <div className="space-y-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Volver
          </Button>

          {/* Aviso ético */}
          <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-4">
            <div className="flex items-start gap-3">
              <ShieldAlert className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-semibold text-amber-900 dark:text-amber-200">Uso excepcional</p>
                <p className="text-amber-800 dark:text-amber-300 mt-1">
                  Diligenciar una preoperacional por un conductor solo debe hacerse en casos justificados
                  (falla técnica del dispositivo, conexión intermitente, etc.). El sistema deja constancia
                  de que fue creada por un administrador y por cuál.
                </p>
              </div>
            </div>
          </div>

          {/* Selección vehículo + conductor */}
          <ContentCard>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Vehículo *</Label>
                <Popover open={vehPopoverOpen} onOpenChange={setVehPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                      <span className="truncate text-left">
                        {selectedVehiculo ? `${selectedVehiculo.placa} — ${selectedVehiculo.marca ?? ""} ${selectedVehiculo.linea ?? ""}`.trim() : "Seleccione vehículo"}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar por placa..." />
                      <CommandList>
                        <CommandEmpty>Sin resultados</CommandEmpty>
                        <CommandGroup>
                          {vehiculos.map((v) => (
                            <CommandItem
                              key={v._id}
                              value={`${v.placa} ${v.marca ?? ""} ${v.linea ?? ""}`}
                              onSelect={() => { setVehiculoId(v._id); setVehPopoverOpen(false); }}
                            >
                              <Check className={cn("mr-2 h-4 w-4", v._id === vehiculoId ? "opacity-100" : "opacity-0")} />
                              {v.placa} — {v.marca} {v.linea}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Conductor *</Label>
                <Popover open={condPopoverOpen} onOpenChange={setCondPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                      <span className="truncate text-left">
                        {selectedConductor
                          ? `${selectedConductor.nombres ?? ""} ${selectedConductor.apellidos ?? ""} — ${selectedConductor.identificacion}`.trim()
                          : "Seleccione conductor"}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar por nombre o cédula..." />
                      <CommandList>
                        <CommandEmpty>Sin resultados</CommandEmpty>
                        <CommandGroup>
                          {conductores.map((c) => (
                            <CommandItem
                              key={c._id}
                              value={`${c.nombres ?? ""} ${c.apellidos ?? ""} ${c.identificacion}`}
                              onSelect={() => { setConductorIdSel(c._id); setCondPopoverOpen(false); }}
                            >
                              <Check className={cn("mr-2 h-4 w-4", c._id === conductorIdSel ? "opacity-100" : "opacity-0")} />
                              {c.nombres} {c.apellidos} — {c.identificacion}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Kilometraje *</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={kilometraje}
                    onChange={(e) => setKilometraje(e.target.value)}
                    placeholder="Ej: 45000"
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
              </div>
            </div>
          </ContentCard>

          {/* Sección conductor */}
          <ContentCard>
            <div className="space-y-4">
              <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Sección Conductor</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Horas de sueño reportadas *</Label>
                  <Input
                    type="number"
                    value={horasSueno}
                    onChange={(e) => setHorasSueno(e.target.value)}
                    min={0}
                    max={24}
                    placeholder="Ej: 8"
                  />
                  {horasSueno && Number(horasSueno) < 8 && Number(horasSueno) > 0 && (
                    <p className="text-xs text-amber-600">⚠ Menos de 8 horas: el sistema marcará esta condición como no corregible.</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Estado de salud *</Label>
                  <Select value={estadoSalud} onValueChange={(v) => setEstadoSalud(v as any)}>
                    <SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BUENO">Bueno</SelectItem>
                      <SelectItem value="REGULAR">Regular</SelectItem>
                      <SelectItem value="MALO">Malo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {estadoSalud && estadoSalud !== "BUENO" && (
                <div className="space-y-2">
                  <Label>Observaciones de salud</Label>
                  <Textarea value={estadoSaludObs} onChange={(e) => setEstadoSaludObs(e.target.value)} rows={2} />
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="medicamentos" checked={tomaMedicamentos} onChange={(e) => setTomaMedicamentos(e.target.checked)} />
                    <Label htmlFor="medicamentos" className="cursor-pointer">Toma medicamentos</Label>
                  </div>
                  {tomaMedicamentos && (
                    <Input value={medicamentosDetalle} onChange={(e) => setMedicamentosDetalle(e.target.value)} placeholder="Detalle" />
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="sustancias" checked={consumoSustancias} onChange={(e) => setConsumoSustancias(e.target.checked)} />
                    <Label htmlFor="sustancias" className="cursor-pointer">Consumo de sustancias</Label>
                  </div>
                  {consumoSustancias && (
                    <Input value={sustanciasDetalle} onChange={(e) => setSustanciasDetalle(e.target.value)} placeholder="Detalle" />
                  )}
                </div>
              </div>
            </div>
          </ContentCard>

          {/* Checklist */}
          {renderSection("Sección Delantera", SECCION_DELANTERA_ITEMS)}
          {renderSection("Sección Media", SECCION_MEDIA_ITEMS)}
          {renderSection("Sección Trasera", SECCION_TRASERA_ITEMS)}
          {renderSection("Sección Aseo", SECCION_ASEO_ITEMS)}

          {/* Observaciones generales */}
          <ContentCard>
            <div className="space-y-2">
              <Label>Observaciones generales</Label>
              <Textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={3} placeholder="Motivo por el cual el admin diligencia esta preoperacional..." />
            </div>
          </ContentCard>

          {/* Resumen */}
          <ContentCard>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Revisados</p>
                  <p className="text-lg font-bold">{reviewed} / {reviewed}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Fallas</p>
                  <p className="text-lg font-bold text-red-600">{fallas}</p>
                </div>
                <Badge variant={estadoGeneral === "APROBADO" ? "default" : "destructive"} className="text-sm">
                  {estadoGeneral}
                </Badge>
              </div>
              {needsFoto > 0 && (
                <p className="text-xs text-red-600 flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Faltan {needsFoto} foto{needsFoto > 1 ? "s" : ""} de ítems marcados como MALO
                </p>
              )}
            </div>
          </ContentCard>

          {/* Confirmación ética */}
          <ContentCard>
            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                id="etico"
                checked={confirmEtico}
                onChange={(e) => setConfirmEtico(e.target.checked)}
                className="mt-1"
              />
              <Label htmlFor="etico" className="cursor-pointer text-sm leading-snug">
                Confirmo que estoy diligenciando esta preoperacional con información provista por el conductor,
                por un motivo justificado. Entiendo que queda registro de quién la creó.
              </Label>
            </div>
          </ContentCard>

          <div className="flex justify-end gap-2 pb-6">
            <Button variant="outline" onClick={() => navigate(-1)}>Cancelar</Button>
            <Button
              onClick={() => submitMutation.mutate()}
              disabled={!isFormValid || submitMutation.isPending}
              className="gap-1.5"
            >
              {submitMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Crear preoperacional
            </Button>
          </div>
        </div>

        <KitInfoDialog
          open={!!kitDialog}
          onOpenChange={(v) => !v && setKitDialog(null)}
          estado={kitDialog?.estado ?? "BUENO"}
          kit={kitDialog?.kit ?? "primerosAuxilios"}
          items={(kitDialog?.kit ?? "primerosAuxilios") === "primerosAuxilios" ? KIT_PRIMEROS_AUXILIOS_ITEMS : KIT_CARRETERA_ITEMS}
          onConfirm={handleKitConfirm}
        />
      </PageContainer>
    </DashboardLayout>
  );
}

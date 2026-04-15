import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, ChevronsUpDown, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { getApiRndcBaseUrl } from "@/services/apirndc/apirndc.config";
import { useQueryClient } from "@tanstack/react-query";
import { uploadFileToS3 } from "@/lib/uploadToS3";
import { FileDropZone } from "./FileDropZone";
import type { ApiRndcDocumento } from "@/services/apirndc/apirndc.types";

// ─── Tipo Documento → Entidades permitidas ───
// V = Vehiculo, T = Tercero, E = Empresa
const TIPO_DOC_CONFIG: Record<string, { label: string; entidades: string[]; grupal: boolean }> = {
  SOAT:                 { label: "SOAT",                  entidades: ["Vehiculo"],             grupal: false },
  TECNOMECANICA:        { label: "Tecnomecanica",         entidades: ["Vehiculo"],             grupal: false },
  TARJETA_OPERACION:    { label: "Tarjeta de Operacion",  entidades: ["Vehiculo"],             grupal: false },
  TARJETA_PROPIEDAD:    { label: "Tarjeta de Propiedad",  entidades: ["Vehiculo"],             grupal: false },
  REVISION_PREVENTIVA:  { label: "Revision Preventiva",   entidades: ["Vehiculo"],             grupal: false },
  POLIZA_RCE:           { label: "Poliza RCE",            entidades: ["Vehiculo", "Empresa"],  grupal: true },
  POLIZA_RCC:           { label: "Poliza RCC",            entidades: ["Vehiculo", "Empresa"],  grupal: true },
  LICENCIA_CONDUCCION:  { label: "Licencia de Conduccion", entidades: ["Tercero"],             grupal: false },
  CEDULA:               { label: "Cedula",                entidades: ["Tercero"],              grupal: false },
  ARL:                  { label: "ARL",                   entidades: ["Tercero"],              grupal: false },
  EPS:                  { label: "EPS",                   entidades: ["Tercero"],              grupal: false },
  CAJA_COMPENSACION:    { label: "Caja de Compensacion",  entidades: ["Tercero"],              grupal: false },
  FONDO_PENSIONES:      { label: "Fondo de Pensiones",    entidades: ["Tercero"],              grupal: false },
  EXAMEN_MEDICO:        { label: "Examen Medico",         entidades: ["Tercero"],              grupal: false },
  CAPACITACION_PESV:    { label: "Capacitacion PESV",     entidades: ["Tercero"],              grupal: false },
  CONTRATO_CLIENTE:     { label: "Contrato Cliente",      entidades: ["Empresa"],              grupal: false },
  CAMARA_COMERCIO:      { label: "Camara de Comercio",    entidades: ["Empresa"],              grupal: false },
  RUT:                  { label: "RUT",                   entidades: ["Tercero", "Empresa"],   grupal: false },
  OTRO:                 { label: "Otro",                  entidades: ["Vehiculo", "Tercero", "Empresa"], grupal: false },
};

const TIPO_DOC_KEYS = Object.keys(TIPO_DOC_CONFIG);
const ESTADO_OPTIONS = ["VIGENTE", "POR_VENCER", "VENCIDO", "HISTORICO", "RECHAZADO"];

const ENTIDAD_LABELS: Record<string, string> = {
  Vehiculo: "Vehiculo",
  Tercero: "Tercero",
  Empresa: "Empresa",
};

interface DocumentoFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documento?: ApiRndcDocumento | null;
  onSuccess: () => void;
  /** Pre-fill tipo documento and lock it */
  defaultTipoDocumento?: string;
  /** Pre-fill entidad modelo and lock it */
  defaultEntidadModelo?: string;
  /** Pre-fill entidad id and lock it */
  defaultEntidadId?: string;
}

interface EntidadOption {
  id: string;
  label: string;
}

const initialForm = {
  tipoDocumento: "",
  entidadModelo: "" as string,
  entidadIds: [] as string[],
  numero: "",
  entidadEmisora: "",
  fechaExpedicion: "",
  fechaVencimiento: "",
  estado: "VIGENTE",
  observaciones: "",
};

export function DocumentoFormDialog({ open, onOpenChange, documento, onSuccess, defaultTipoDocumento, defaultEntidadModelo, defaultEntidadId }: DocumentoFormDialogProps) {
  const [form, setForm] = useState(initialForm);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFileReverso, setSelectedFileReverso] = useState<File | null>(null);
  const [selectedFileExtra, setSelectedFileExtra] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadProgressReverso, setUploadProgressReverso] = useState<number | null>(null);
  const [uploadProgressExtra, setUploadProgressExtra] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const isEditing = !!documento;
  const { bearerToken } = useAuth();
  const queryClient = useQueryClient();

  // Current tipo config
  const tipoConfig = form.tipoDocumento ? TIPO_DOC_CONFIG[form.tipoDocumento] : null;
  const allowedEntidades = tipoConfig?.entidades ?? [];
  const isGrupal = tipoConfig?.grupal ?? false;
  const isMultiSelect = isGrupal && !isEditing;

  // Fetch entities directly with bearerToken
  const { data: vehiculos = [], isLoading: loadingVehiculos } = useQuery({
    queryKey: ["doc-form-vehiculos"],
    queryFn: async () => {
      if (!bearerToken) return [];
      const res = await fetch(`${getApiRndcBaseUrl()}/api/vehiculos?limit=200`, {
        headers: { Authorization: `Bearer ${bearerToken}` },
      });
      const result = await res.json();
      if (!res.ok) return [];
      return (result.data ?? []) as { _id: string; placa: string; marca?: string; linea?: string }[];
    },
    enabled: !!bearerToken && open,
  });

  const { data: terceros = [], isLoading: loadingTerceros } = useQuery({
    queryKey: ["doc-form-terceros"],
    queryFn: async () => {
      if (!bearerToken) return [];
      const res = await fetch(`${getApiRndcBaseUrl()}/api/terceros?limit=200`, {
        headers: { Authorization: `Bearer ${bearerToken}` },
      });
      const result = await res.json();
      if (!res.ok) return [];
      return (result.data ?? []) as { _id: string; nombres?: string; apellidos?: string; identificacion: string }[];
    },
    enabled: !!bearerToken && open,
  });

  const { data: empresas = [], isLoading: loadingEmpresas } = useQuery({
    queryKey: ["doc-form-empresas"],
    queryFn: async () => {
      if (!bearerToken) return [];
      const res = await fetch(`${getApiRndcBaseUrl()}/api/empresas?limit=200`, {
        headers: { Authorization: `Bearer ${bearerToken}` },
      });
      const result = await res.json();
      if (!res.ok) return [];
      return (result.data ?? []) as { _id: string; razonSocial: string; nit: string }[];
    },
    enabled: !!bearerToken && open,
  });

  const isLoadingEntidades =
    form.entidadModelo === "Vehiculo" ? loadingVehiculos
    : form.entidadModelo === "Tercero" ? loadingTerceros
    : form.entidadModelo === "Empresa" ? loadingEmpresas
    : false;

  const entidadOptions: EntidadOption[] = useMemo(() => {
    if (form.entidadModelo === "Vehiculo") {
      return vehiculos.map((v) => ({
        id: v._id,
        label: `${v.placa} - ${v.marca ?? ""} ${v.linea ?? ""}`.trim(),
      }));
    }
    if (form.entidadModelo === "Tercero") {
      return terceros.map((t) => ({
        id: t._id,
        label: `${t.nombres ?? ""} ${t.apellidos ?? ""} - ${t.identificacion}`.trim(),
      }));
    }
    if (form.entidadModelo === "Empresa") {
      return empresas.map((e) => ({
        id: e._id,
        label: `${e.razonSocial} - NIT ${e.nit}`,
      }));
    }
    return [];
  }, [form.entidadModelo, vehiculos, terceros, empresas]);

  const selectedLabels = useMemo(() => {
    const map = new Map(entidadOptions.map((o) => [o.id, o.label]));
    return form.entidadIds.map((id) => ({ id, label: map.get(id) ?? (typeof id === "string" ? id : String(id)) }));
  }, [form.entidadIds, entidadOptions]);

  // Auto-select entidadModelo when tipo documento only has one option
  useEffect(() => {
    if (tipoConfig && allowedEntidades.length === 1 && form.entidadModelo !== allowedEntidades[0]) {
      setForm((prev) => ({ ...prev, entidadModelo: allowedEntidades[0], entidadIds: [] }));
    }
  }, [form.tipoDocumento]);

  useEffect(() => {
    if (documento) {
      setForm({
        tipoDocumento: documento.tipoDocumento,
        entidadModelo: documento.entidadModelo,
        entidadIds: [typeof documento.entidadId === "object" ? (documento.entidadId as Record<string, string>)._id : documento.entidadId],
        numero: documento.numero ?? "",
        entidadEmisora: documento.entidadEmisora ?? "",
        fechaExpedicion: documento.fechaExpedicion?.substring(0, 10) ?? "",
        fechaVencimiento: documento.fechaVencimiento?.substring(0, 10) ?? "",
        estado: documento.estado,
        observaciones: documento.observaciones ?? "",
      });
    } else {
      setForm({
        ...initialForm,
        ...(defaultTipoDocumento ? { tipoDocumento: defaultTipoDocumento } : {}),
        ...(defaultEntidadModelo ? { entidadModelo: defaultEntidadModelo } : {}),
        ...(defaultEntidadId ? { entidadIds: [defaultEntidadId] } : {}),
      });
    }
    setSelectedFile(null);
    setSelectedFileReverso(null);
    setUploadProgress(null);
    setUploadProgressReverso(null);
    setIsUploading(false);
  }, [documento, open, defaultTipoDocumento, defaultEntidadModelo, defaultEntidadId]);

  const update = (key: string, value: unknown) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleTipoDocumentoChange = (tipo: string) => {
    const config = TIPO_DOC_CONFIG[tipo];
    const entidades = config?.entidades ?? [];
    setForm((prev) => ({
      ...prev,
      tipoDocumento: tipo,
      entidadModelo: entidades.length === 1 ? entidades[0] : "",
      entidadIds: [],
    }));
  };

  const handleEntidadModeloChange = (modelo: string) => {
    setForm((prev) => ({ ...prev, entidadModelo: modelo, entidadIds: [] }));
  };

  const toggleEntidad = (id: string) => {
    if (isMultiSelect) {
      setForm((prev) => {
        const exists = prev.entidadIds.includes(id);
        return {
          ...prev,
          entidadIds: exists
            ? prev.entidadIds.filter((eid) => eid !== id)
            : [...prev.entidadIds, id],
        };
      });
    } else {
      update("entidadIds", [id]);
      setPopoverOpen(false);
    }
  };

  const removeEntidad = (id: string) => {
    setForm((prev) => ({
      ...prev,
      entidadIds: prev.entidadIds.filter((eid) => eid !== id),
    }));
  };

  const handleSubmit = async () => {
    if (!form.tipoDocumento || !form.entidadModelo || form.entidadIds.length === 0) {
      toast.error("Complete los campos obligatorios: Tipo Documento, Entidad");
      return;
    }

    const basePayload: Record<string, unknown> = {
      entidadModelo: form.entidadModelo,
      tipoDocumento: form.tipoDocumento,
      numero: form.numero || undefined,
      entidadEmisora: form.entidadEmisora || undefined,
      fechaExpedicion: form.fechaExpedicion || undefined,
      fechaVencimiento: form.fechaVencimiento || undefined,
      estado: form.estado,
      observaciones: form.observaciones || undefined,
    };

    // Upload file to S3 if selected
    if (selectedFile) {
      try {
        setIsUploading(true);
        setUploadProgress(0);

        // Step 1: Get presigned URL
        const presignedRes = await fetch(`${getApiRndcBaseUrl()}/api/documentos/presigned-url`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${bearerToken}`,
          },
          body: JSON.stringify({
            fileName: selectedFile.name,
            mimeType: selectedFile.type,
          }),
        });
        if (!presignedRes.ok) {
          const errText = await presignedRes.text().catch(() => "");
          throw new Error(`Error obteniendo URL de subida: ${presignedRes.status} ${errText}`);
        }
        const presigned = await presignedRes.json();
        const { uploadUrl, key, publicUrl } = presigned.data ?? presigned;

        // Step 2: Upload to S3
        await uploadFileToS3(uploadUrl, selectedFile, (p) => setUploadProgress(p.percent));
        setUploadProgress(100);

        // Step 3: Add archivo metadata to payload
        basePayload.archivo = {
          url: publicUrl,
          key,
          mimeType: selectedFile.type,
          nombreOriginal: selectedFile.name,
          pesoBytes: selectedFile.size,
        };
      } catch (err) {
        setIsUploading(false);
        setUploadProgress(null);
        toast.error(err instanceof Error ? err.message : "Error al subir archivo");
        return;
      }
    }

    // Upload reverse file to S3 if selected
    if (selectedFileReverso) {
      try {
        setUploadProgressReverso(0);

        const presignedRes = await fetch(`${getApiRndcBaseUrl()}/api/documentos/presigned-url`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${bearerToken}`,
          },
          body: JSON.stringify({
            fileName: selectedFileReverso.name,
            mimeType: selectedFileReverso.type,
          }),
        });
        if (!presignedRes.ok) {
          throw new Error(`Error obteniendo URL de subida (reverso): ${presignedRes.status}`);
        }
        const presigned = await presignedRes.json();
        const { uploadUrl, key, publicUrl } = presigned.data ?? presigned;

        await uploadFileToS3(uploadUrl, selectedFileReverso, (p) => setUploadProgressReverso(p.percent));
        setUploadProgressReverso(100);

        basePayload.archivoReverso = {
          url: publicUrl,
          key,
          mimeType: selectedFileReverso.type,
          nombreOriginal: selectedFileReverso.name,
          pesoBytes: selectedFileReverso.size,
        };
      } catch (err) {
        setIsUploading(false);
        setUploadProgressReverso(null);
        toast.error(err instanceof Error ? err.message : "Error al subir archivo reverso");
        return;
      }
    }

    // Upload extra file to S3 if selected
    if (selectedFileExtra) {
      try {
        setUploadProgressExtra(0);
        const presignedRes = await fetch(`${getApiRndcBaseUrl()}/api/documentos/presigned-url`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${bearerToken}` },
          body: JSON.stringify({ fileName: selectedFileExtra.name, mimeType: selectedFileExtra.type }),
        });
        if (!presignedRes.ok) throw new Error(`Error obteniendo URL de subida (extra): ${presignedRes.status}`);
        const presigned = await presignedRes.json();
        const { uploadUrl, key, publicUrl } = presigned.data ?? presigned;
        await uploadFileToS3(uploadUrl, selectedFileExtra, (p) => setUploadProgressExtra(p.percent));
        setUploadProgressExtra(100);
        basePayload.archivoExtra = {
          url: publicUrl,
          key,
          mimeType: selectedFileExtra.type,
          nombreOriginal: selectedFileExtra.name,
          pesoBytes: selectedFileExtra.size,
        };
      } catch (err) {
        setIsUploading(false);
        setUploadProgressExtra(null);
        toast.error(err instanceof Error ? err.message : "Error al subir archivo extra");
        return;
      }
    }

    const base = getApiRndcBaseUrl();
    const authHeaders = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${bearerToken}`,
    };

    try {
      if (isEditing && documento) {
        const res = await fetch(`${base}/api/documentos/${documento._id}`, {
          method: "PUT",
          headers: authHeaders,
          body: JSON.stringify({ ...basePayload, entidadId: form.entidadIds[0] }),
        });
        if (!res.ok) throw new Error(`Error al actualizar: ${res.status}`);
        toast.success("Documento actualizado exitosamente");
        queryClient.invalidateQueries({ queryKey: ["apirndc-documentos"] });
        onOpenChange(false);
        onSuccess();
      } else {
        // For grupal: file uploaded once, same archivo metadata for all
        const promises = form.entidadIds.map(async (entidadId) => {
          const res = await fetch(`${base}/api/documentos`, {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({ ...basePayload, entidadId }),
          });
          if (!res.ok) throw new Error(`Error al crear: ${res.status}`);
          return res.json();
        });
        await Promise.all(promises);
        const count = form.entidadIds.length;
        toast.success(
          count === 1
            ? "Documento creado exitosamente"
            : `${count} documentos creados exitosamente`,
        );
        queryClient.invalidateQueries({ queryKey: ["apirndc-documentos"] });
        onOpenChange(false);
        setForm(initialForm);
        onSuccess();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar documento");
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  const isPending = isUploading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Documento" : "Crear Nuevo Documento"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Modifique los campos del documento."
              : "Seleccione el tipo de documento primero. El sistema mostrara las entidades compatibles."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 1. Tipo Documento (PRIMERO) */}
          <div className="space-y-2">
            <Label>Tipo Documento *</Label>
            <Select value={form.tipoDocumento} onValueChange={handleTipoDocumentoChange} disabled={!!defaultTipoDocumento}>
              <SelectTrigger><SelectValue placeholder="Seleccione tipo de documento" /></SelectTrigger>
              <SelectContent>
                {TIPO_DOC_KEYS.map((key) => (
                  <SelectItem key={key} value={key}>{TIPO_DOC_CONFIG[key].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {tipoConfig && isGrupal && (
              <p className="text-xs text-primary">Poliza grupal: puede asignar a multiples entidades</p>
            )}
          </div>

          {/* 2. Tipo Entidad (solo si hay mas de una opcion) */}
          {form.tipoDocumento && allowedEntidades.length > 1 && (
            <div className="space-y-2">
              <Label>Tipo Entidad *</Label>
              <Select value={form.entidadModelo} onValueChange={handleEntidadModeloChange}>
                <SelectTrigger><SelectValue placeholder="Seleccione tipo de entidad" /></SelectTrigger>
                <SelectContent>
                  {allowedEntidades.map((ent) => (
                    <SelectItem key={ent} value={ent}>{ENTIDAD_LABELS[ent]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* 3. Entidad(es) - Combobox buscable */}
          {form.tipoDocumento && form.entidadModelo && (
            <div className="space-y-2">
              <Label>
                {isMultiSelect ? "Entidades *" : "Entidad *"}
                {form.entidadIds.length > 0 && (
                  <span className="text-xs text-muted-foreground ml-2">
                    ({form.entidadIds.length} seleccionada{form.entidadIds.length !== 1 ? "s" : ""})
                  </span>
                )}
              </Label>
              {isLoadingEntidades ? (
                <div className="flex items-center gap-2 py-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Cargando entidades...</span>
                </div>
              ) : (
                <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={popoverOpen}
                      className="w-full justify-between font-normal"
                    >
                      <span className="truncate text-left">
                        {form.entidadIds.length === 0
                          ? "Buscar y seleccionar..."
                          : isMultiSelect
                            ? `${form.entidadIds.length} seleccionada${form.entidadIds.length !== 1 ? "s" : ""}`
                            : selectedLabels[0]?.label ?? "Seleccionada"}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar por nombre, placa, NIT..." />
                      <CommandList>
                        <CommandEmpty>No se encontraron resultados</CommandEmpty>
                        <CommandGroup>
                          {entidadOptions.map((opt) => {
                            const isSelected = form.entidadIds.includes(opt.id);
                            return (
                              <CommandItem
                                key={opt.id}
                                value={opt.label}
                                onSelect={() => toggleEntidad(opt.id)}
                              >
                                <Check className={cn("mr-2 h-4 w-4", isSelected ? "opacity-100" : "opacity-0")} />
                                {opt.label}
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              )}

              {/* Selected entities badges (multi-select) */}
              {isMultiSelect && selectedLabels.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {selectedLabels.map((sel) => (
                    <Badge key={sel.id} variant="secondary" className="gap-1 pr-1">
                      <span className="max-w-[200px] truncate">{sel.label}</span>
                      <button
                        type="button"
                        onClick={() => removeEntidad(sel.id)}
                        className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Numero */}
          <div className="space-y-2">
            <Label>Numero</Label>
            <Input value={form.numero} onChange={(e) => update("numero", e.target.value)} placeholder="Numero del documento" />
          </div>

          {/* Entidad Emisora */}
          <div className="space-y-2">
            <Label>Entidad Emisora</Label>
            <Input value={form.entidadEmisora} onChange={(e) => update("entidadEmisora", e.target.value)} placeholder="Ej: Seguros Bolivar" />
          </div>

          {/* Fechas */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Fecha Expedicion</Label>
              <Input type="date" value={form.fechaExpedicion} onChange={(e) => update("fechaExpedicion", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Fecha Vencimiento</Label>
              <Input type="date" value={form.fechaVencimiento} onChange={(e) => update("fechaVencimiento", e.target.value)} />
            </div>
          </div>

          {/* Estado */}
          <div className="space-y-2">
            <Label>Estado</Label>
            <Select value={form.estado} onValueChange={(v) => update("estado", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ESTADO_OPTIONS.map((e) => (
                  <SelectItem key={e} value={e}>{e.replace("_", " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Observaciones */}
          <div className="space-y-2">
            <Label>Observaciones</Label>
            <Textarea
              value={form.observaciones}
              onChange={(e) => update("observaciones", e.target.value)}
              placeholder="Observaciones adicionales..."
              rows={3}
            />
          </div>

          {/* Archivo adjunto */}
          <div className="space-y-2">
            <Label>Archivo adjunto (frente)</Label>
            <FileDropZone
              file={selectedFile}
              onFileChange={setSelectedFile}
              uploadProgress={uploadProgress}
              disabled={isUploading}
            />
          </div>

          {/* Archivo reverso (opcional) */}
          <div className="space-y-2">
            <Label>Reverso <span className="text-muted-foreground font-normal">(opcional)</span></Label>
            <FileDropZone
              file={selectedFileReverso}
              onFileChange={setSelectedFileReverso}
              uploadProgress={uploadProgressReverso}
              disabled={isUploading}
            />
          </div>

          {/* Archivo adicional (opcional) */}
          <div className="space-y-2">
            <Label>Archivo Adicional <span className="text-muted-foreground font-normal">(opcional)</span></Label>
            <FileDropZone
              file={selectedFileExtra}
              onFileChange={setSelectedFileExtra}
              uploadProgress={uploadProgressExtra}
              disabled={isUploading}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isUploading}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isUploading
              ? "Subiendo..."
              : isEditing
                ? "Guardar Cambios"
                : form.entidadIds.length > 1
                  ? `Crear ${form.entidadIds.length} Documentos`
                  : "Crear Documento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

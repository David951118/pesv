import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useSessionState } from "@/hooks/useSessionState";
import { useAuth } from "@/hooks/useAuth";
import { RolesMultiSelect, splitRoles, requiereUsuarioCellvi, SHOW_ACCESS_ROLES } from "@/components/usuarios/RolesMultiSelect";
import { getTerceroNombre } from "@/components/inventario/inventario.helpers";
import { getApiRndcBaseUrl } from "@/services/apirndc/apirndc.config";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { uploadFileToS3 } from "@/lib/uploadToS3";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { ModuleHeader } from "@/components/layout/ModuleHeader";
import { ContentCard } from "@/components/layout/ContentCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { toast } from "sonner";
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
  UsersIcon,
  Plus,
  Search,
  User,
  Loader2,
  ArrowLeft,
  Truck,
  Briefcase,
  ShieldCheck,
  Building2,
  Package,
  ArrowRight,
  ChevronsUpDown,
  Check,
  Pencil,
  Trash2,
  Upload,
  Camera,
  ImageIcon,
} from "lucide-react";

const ITEMS_PER_PAGE = 10;

interface TerceroData {
  _id: string;
  identificacion: string;
  tipoId: string;
  nombres: string;
  apellidos: string;
  razonSocial?: string; // persona jurídica (NIT)
  roles: string[];
  rolesSistema?: string[];
  usuarioCellvi: string;
  fotoUrl?: string;
  foto?: { url: string; key: string };
  contacto?: { telefono?: string };
  datosConductor?: { tipoSangre?: string };
  empresa?: string | { _id: string; razonSocial: string };
  estado?: string;
}

interface PhotoUploadState {
  file: File | null;
  previewUrl: string | null;
  publicUrl: string | null;
  key: string | null;
  uploading: boolean;
  progress: number;
}

const initialPhotoState: PhotoUploadState = {
  file: null,
  previewUrl: null,
  publicUrl: null,
  key: null,
  uploading: false,
  progress: 0,
};

function getRolLabel(rol: string): string {
  const labels: Record<string, string> = {
    CONDUCTOR: "Conductor",
    PROPIETARIO: "Propietario",
    CLIENTE: "Cliente",
    ADMINISTRATIVO: "Administrativo",
    PROVEEDOR: "Proveedor",
    MECANICO: "Mecánico",
    ROLE_MECANICO: "Mecánico (acceso)",
    ROLE_AUDITOR: "Auditor (acceso)",
  };
  return labels[rol] || rol;
}

// Tipos de documento aceptados por el API RNDC (enum Tercero.tipoId).
// NIT identifica a una persona jurídica: usa razón social en vez de nombres.
const TIPO_ID_OPTIONS: { value: string; label: string }[] = [
  { value: "CC", label: "CC - Cédula" },
  { value: "CE", label: "CE - Cédula Extranjería" },
  { value: "NIT", label: "NIT - Persona jurídica" },
  { value: "PEP", label: "PEP - Permiso Especial de Permanencia" },
  { value: "PASAPORTE", label: "Pasaporte" },
];

function getTerceroPhotoUrl(tercero: TerceroData): string | undefined {
  return tercero.foto?.url || tercero.fotoUrl;
}

export default function Usuarios() {
  const queryClient = useQueryClient();
  const { empresaId, bearerToken, role } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialUserId = searchParams.get("user");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [showList, setShowList] = useState(!!initialUserId);

  const [showCreateDialog, setShowCreateDialog, clearCreateDialog] = useSessionState("usr-create-open", false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [viewingUser, setViewingUser] = useState<TerceroData | null>(null);

  const [terceroForm, setTerceroForm, clearTerceroForm] = useSessionState("usr-tercero-form", {
    identificacion: "",
    tipoId: "CC",
    nombres: "",
    apellidos: "",
    razonSocial: "",
    roles: ["CONDUCTOR"] as string[],
    usuarioCellvi: "",
    telefono: "",
    tipoSangre: "",
    empresaId: "",
  });
  const [empresaPopoverOpen, setEmpresaPopoverOpen] = useState(false);
  const [editEmpresaPopoverOpen, setEditEmpresaPopoverOpen] = useState(false);

  // Photo upload state for create and edit
  const [createPhoto, setCreatePhoto] = useState<PhotoUploadState>(initialPhotoState);
  const [editPhoto, setEditPhoto] = useState<PhotoUploadState>(initialPhotoState);
  const createFileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  // Edit form state
  const [editForm, setEditForm] = useState({
    identificacion: "",
    tipoId: "CC",
    nombres: "",
    apellidos: "",
    razonSocial: "",
    roles: ["CONDUCTOR"] as string[],
    usuarioCellvi: "",
    telefono: "",
    tipoSangre: "",
    empresaId: "",
  });

  // Fetch empresas list for name lookup (admin only)
  const isAdmin = role === "admin";
  const { data: empresasList } = useQuery({
    queryKey: ["empresas-list"],
    queryFn: async () => {
      const base = getApiRndcBaseUrl();
      const res = await fetch(`${base}/api/empresas/list`, {
        headers: { Authorization: `Bearer ${bearerToken}` },
      });
      const result = await res.json();
      return (result.data ?? result) as { _id: string; razonSocial: string }[];
    },
    enabled: !!bearerToken && isAdmin,
  });

  const getEmpresaName = (empresa?: string | { _id: string; razonSocial: string }) => {
    if (!empresa) return "\u2014";
    if (typeof empresa === "object") return empresa.razonSocial;
    const found = empresasList?.find((e) => e._id === empresa);
    return found?.razonSocial || empresa;
  };

  const getEmpresaId = (empresa?: string | { _id: string; razonSocial: string }) => {
    if (!empresa) return "";
    if (typeof empresa === "object") return empresa._id;
    return empresa;
  };

  // Fetch terceros
  const { data: terceros, isLoading, error } = useQuery({
    queryKey: ["terceros-list", isAdmin ? "all" : empresaId],
    queryFn: async () => {
      if (!bearerToken) throw new Error("No autenticado");
      const base = getApiRndcBaseUrl();
      // limit alto: el backend pagina de a 50 por defecto; sin esto el admin
      // (que ve todos los terceros) no vería lo recién creado si supera los 50.
      const url = isAdmin
        ? `${base}/api/terceros?limit=1000`
        : `${base}/api/terceros/empresa/${empresaId}`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${bearerToken}`,
        },
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Error al cargar terceros");
      return (result.data ?? result) as TerceroData[];
    },
    enabled: !!bearerToken && (isAdmin || !!empresaId),
  });

  // ────── Photo upload helper ──────
  const handlePhotoUpload = async (
    file: File,
    setPhotoState: React.Dispatch<React.SetStateAction<PhotoUploadState>>,
  ) => {
    if (!bearerToken) return;

    const previewUrl = URL.createObjectURL(file);
    setPhotoState({
      file,
      previewUrl,
      publicUrl: null,
      key: null,
      uploading: true,
      progress: 0,
    });

    try {
      const base = getApiRndcBaseUrl();
      // 1. Get presigned URL
      const presignRes = await fetch(`${base}/api/terceros/foto/presigned-url`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${bearerToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fileName: file.name, mimeType: file.type }),
      });
      const presignResult = await presignRes.json();
      if (!presignRes.ok || !presignResult.success) {
        throw new Error(presignResult.error || "Error al obtener URL de subida");
      }

      const { uploadUrl, key, publicUrl } = presignResult.data;

      // 2. Upload to S3
      await uploadFileToS3(uploadUrl, file, (progress) => {
        setPhotoState((prev) => ({ ...prev, progress: progress.percent }));
      });

      // 3. Store result
      setPhotoState((prev) => ({
        ...prev,
        publicUrl,
        key,
        uploading: false,
        progress: 100,
      }));
      toast.success("Foto subida correctamente");
    } catch (err) {
      setPhotoState(initialPhotoState);
      toast.error(err instanceof Error ? err.message : "Error al subir la foto");
    }
  };

  const associatePhoto = async (terceroId: string, photoPublicUrl: string, photoKey: string) => {
    const base = getApiRndcBaseUrl();
    const res = await fetch(`${base}/api/terceros/${terceroId}/foto`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${bearerToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: photoPublicUrl, key: photoKey }),
    });
    if (!res.ok) {
      const result = await res.json();
      throw new Error(result.error || "Error al asociar la foto");
    }
  };

  // ────── Create tercero mutation ──────
  const createTerceroMutation = useMutation({
    mutationFn: async () => {
      if (!bearerToken) throw new Error("No autenticado");
      const targetEmpresa = isAdmin ? terceroForm.empresaId : empresaId;
      if (!targetEmpresa) throw new Error(isAdmin ? "Seleccione una empresa" : "No se encontró empresa. Cierre sesión e inicie sesión de nuevo.");

      const { roles, rolesSistema } = splitRoles(terceroForm.roles ?? []);
      const esNit = terceroForm.tipoId === "NIT";
      const body: Record<string, unknown> = {
        identificacion: terceroForm.identificacion.trim(),
        tipoId: terceroForm.tipoId,
        empresa: targetEmpresa,
        // Persona jurídica (NIT) usa razón social; persona natural, nombres y apellidos
        nombres: esNit ? "" : terceroForm.nombres.trim(),
        apellidos: esNit ? "" : terceroForm.apellidos.trim(),
        razonSocial: esNit ? (terceroForm.razonSocial ?? "").trim() : "",
        roles,
        rolesSistema,
        // Solo puede ir vacío cuando el tercero es únicamente proveedor
        usuarioCellvi: terceroForm.usuarioCellvi.trim(),
        contacto: {
          telefono: terceroForm.telefono,
        },
      };

      if (roles.includes("CONDUCTOR") && terceroForm.tipoSangre) {
        body.datosConductor = { tipoSangre: terceroForm.tipoSangre };
      }

      const base = getApiRndcBaseUrl();
      const res = await fetch(`${base}/api/terceros`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${bearerToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || result.message || "Error al crear tercero");

      // Associate photo if uploaded
      if (createPhoto.publicUrl && createPhoto.key) {
        const terceroId = result.data?._id || result._id;
        if (terceroId) {
          await associatePhoto(terceroId, createPhoto.publicUrl, createPhoto.key);
        }
      }

      return result;
    },
    onSuccess: () => {
      toast.success("Tercero creado exitosamente");
      queryClient.invalidateQueries({ queryKey: ["terceros-list"] });
      setShowCreateDialog(false);
      resetForm();
      setCreatePhoto(initialPhotoState);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // ────── Edit tercero mutation ──────
  const editTerceroMutation = useMutation({
    mutationFn: async () => {
      if (!bearerToken || !viewingUser) throw new Error("No autenticado");
      const targetEmpresa = isAdmin ? editForm.empresaId : empresaId;
      if (!targetEmpresa) throw new Error(isAdmin ? "Seleccione una empresa" : "No se encontró empresa.");

      const { roles, rolesSistema } = splitRoles(editForm.roles ?? []);
      const esNit = editForm.tipoId === "NIT";
      const body: Record<string, unknown> = {
        identificacion: editForm.identificacion.trim(),
        tipoId: editForm.tipoId,
        empresa: targetEmpresa,
        nombres: esNit ? "" : editForm.nombres.trim(),
        apellidos: esNit ? "" : editForm.apellidos.trim(),
        razonSocial: esNit ? (editForm.razonSocial ?? "").trim() : "",
        roles,
        rolesSistema,
        usuarioCellvi: editForm.usuarioCellvi.trim(),
        contacto: {
          telefono: editForm.telefono,
        },
      };

      if (roles.includes("CONDUCTOR") && editForm.tipoSangre) {
        body.datosConductor = { tipoSangre: editForm.tipoSangre };
      }

      const base = getApiRndcBaseUrl();
      const res = await fetch(`${base}/api/terceros/${viewingUser._id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${bearerToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || result.message || "Error al actualizar tercero");

      // Associate photo if a new one was uploaded
      if (editPhoto.publicUrl && editPhoto.key) {
        await associatePhoto(viewingUser._id, editPhoto.publicUrl, editPhoto.key);
      }

      return result;
    },
    onSuccess: () => {
      toast.success("Tercero actualizado exitosamente");
      queryClient.invalidateQueries({ queryKey: ["terceros-list"] });
      setShowEditDialog(false);
      setEditPhoto(initialPhotoState);
      // Refresh viewing user
      if (viewingUser) {
        const split = splitRoles(editForm.roles ?? []);
        const esNitEdit = editForm.tipoId === "NIT";
        const updatedUser: TerceroData = {
          ...viewingUser,
          identificacion: editForm.identificacion.trim(),
          tipoId: editForm.tipoId,
          nombres: esNitEdit ? "" : editForm.nombres.trim(),
          apellidos: esNitEdit ? "" : editForm.apellidos.trim(),
          razonSocial: esNitEdit ? (editForm.razonSocial ?? "").trim() : "",
          roles: split.roles,
          rolesSistema: split.rolesSistema,
          usuarioCellvi: editForm.usuarioCellvi.trim(),
          contacto: { telefono: editForm.telefono },
          datosConductor: split.roles.includes("CONDUCTOR") && editForm.tipoSangre
            ? { tipoSangre: editForm.tipoSangre }
            : undefined,
          foto: editPhoto.publicUrl && editPhoto.key
            ? { url: editPhoto.publicUrl, key: editPhoto.key }
            : viewingUser.foto,
        };
        setViewingUser(updatedUser);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // ────── Delete tercero mutation ──────
  const deleteTerceroMutation = useMutation({
    mutationFn: async () => {
      if (!bearerToken || !viewingUser) throw new Error("No autenticado");

      const base = getApiRndcBaseUrl();
      const res = await fetch(`${base}/api/terceros/${viewingUser._id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${bearerToken}`,
        },
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || result.message || "Error al eliminar tercero");
      return result;
    },
    onSuccess: () => {
      toast.success("Tercero eliminado exitosamente");
      queryClient.invalidateQueries({ queryKey: ["terceros-list"] });
      setShowDeleteDialog(false);
      handleViewUser(null);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});

  const validateCreateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (terceroForm.tipoId === "NIT") {
      if (!(terceroForm.razonSocial ?? "").trim()) errors.razonSocial = "Razón social es requerida";
    } else {
      if (!terceroForm.nombres.trim()) errors.nombres = "Nombres es requerido";
      if (!terceroForm.apellidos.trim()) errors.apellidos = "Apellidos es requerido";
    }
    if (!terceroForm.identificacion.trim()) errors.identificacion = "Identificación es requerida";
    if (requiereUsuarioCellvi(terceroForm.roles ?? []) && !terceroForm.usuarioCellvi.trim())
      errors.usuarioCellvi = "Usuario Cellvi es requerido (solo el proveedor puede quedar sin usuario)";
    if (splitRoles(terceroForm.roles ?? []).roles.length === 0)
      errors.roles = "Seleccione al menos un rol de negocio";
    if (isAdmin && !terceroForm.empresaId) errors.empresaId = "Seleccione una empresa";
    setCreateErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateSubmit = () => {
    if (!validateCreateForm()) return;
    createTerceroMutation.mutate();
  };

  const resetForm = () => {
    clearTerceroForm();
    clearCreateDialog();
    setCreateErrors({});
  };

  const openEditDialog = (tercero?: TerceroData) => {
    // OJO: si esto se pasa como onClick directo (onClick={openEditDialog}),
    // React inyecta el SyntheticEvent como primer argumento. Solo aceptamos un
    // TerceroData real; cualquier otra cosa cae al viewingUser actual.
    const isTercero = tercero && typeof tercero === "object" && "_id" in tercero;
    const target = isTercero ? tercero : viewingUser;
    if (!target) return;
    if (isTercero) setViewingUser(tercero);
    setEditForm({
      identificacion: target.identificacion ?? "",
      tipoId: target.tipoId ?? "CC",
      nombres: target.nombres ?? "",
      apellidos: target.apellidos ?? "",
      razonSocial: target.razonSocial ?? "",
      roles: [...(target.roles ?? []), ...(target.rolesSistema ?? [])],
      usuarioCellvi: target.usuarioCellvi ?? "",
      telefono: target.contacto?.telefono || "",
      tipoSangre: target.datosConductor?.tipoSangre || "",
      empresaId: getEmpresaId(target.empresa),
    });
    setEditPhoto(initialPhotoState);
    setShowEditDialog(true);
  };

  const openDeleteDialog = (tercero: TerceroData) => {
    setViewingUser(tercero);
    setShowDeleteDialog(true);
  };

  // Restore viewing user from URL
  useEffect(() => {
    if (initialUserId && terceros && !viewingUser) {
      const found = terceros.find((t) => t._id === initialUserId);
      if (found) setViewingUser(found);
    }
  }, [initialUserId, terceros]);

  const handleViewUser = (tercero: TerceroData | null) => {
    setViewingUser(tercero);
    if (tercero) {
      setSearchParams({ user: tercero._id }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  };

  // Filter and paginate
  const filteredTerceros = terceros?.filter((t) => {
    const fullName = `${t.razonSocial ?? ""} ${t.nombres ?? ""} ${t.apellidos ?? ""}`.toLowerCase();
    const matchesSearch =
      fullName.includes(search.toLowerCase()) ||
      t.identificacion?.toLowerCase().includes(search.toLowerCase()) ||
      t.usuarioCellvi?.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === "all" || t.roles?.includes(roleFilter);
    return matchesSearch && matchesRole;
  }) || [];

  const totalPages = Math.ceil(filteredTerceros.length / ITEMS_PER_PAGE);
  const paginatedTerceros = filteredTerceros.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const renderPaginationItems = () => {
    const items = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      items.push(
        <PaginationItem key={i}>
          <PaginationLink
            onClick={() => handlePageChange(i)}
            isActive={currentPage === i}
            className="cursor-pointer"
          >
            {i}
          </PaginationLink>
        </PaginationItem>
      );
    }
    return items;
  };

  // Count by role
  const roleCounts = {
    CONDUCTOR: terceros?.filter((t) => t.roles?.includes("CONDUCTOR")).length ?? 0,
    PROPIETARIO: terceros?.filter((t) => t.roles?.includes("PROPIETARIO")).length ?? 0,
    CLIENTE: terceros?.filter((t) => t.roles?.includes("CLIENTE")).length ?? 0,
    ADMINISTRATIVO: terceros?.filter((t) => t.roles?.includes("ADMINISTRATIVO")).length ?? 0,
    PROVEEDOR: terceros?.filter((t) => t.roles?.includes("PROVEEDOR")).length ?? 0,
  };
  const totalTerceros = terceros?.length ?? 0;

  const roleCards = [
    { key: "CONDUCTOR", label: "Conductores", icon: Truck, color: "text-blue-600", bg: "bg-blue-500/10", border: "hover:border-blue-400", count: roleCounts.CONDUCTOR },
    { key: "PROPIETARIO", label: "Propietarios", icon: Briefcase, color: "text-purple-600", bg: "bg-purple-500/10", border: "hover:border-purple-400", count: roleCounts.PROPIETARIO },
    { key: "CLIENTE", label: "Clientes", icon: Building2, color: "text-green-600", bg: "bg-green-500/10", border: "hover:border-green-400", count: roleCounts.CLIENTE },
    { key: "ADMINISTRATIVO", label: "Administrativos", icon: ShieldCheck, color: "text-amber-600", bg: "bg-amber-500/10", border: "hover:border-amber-400", count: roleCounts.ADMINISTRATIVO },
    { key: "PROVEEDOR", label: "Proveedores", icon: Package, color: "text-teal-600", bg: "bg-teal-500/10", border: "hover:border-teal-400", count: roleCounts.PROVEEDOR },
  ];

  const handleCardClick = (roleKey: string) => {
    setRoleFilter(roleKey);
    setCurrentPage(1);
    setShowList(true);
  };

  const handleShowAll = () => {
    setRoleFilter("all");
    setCurrentPage(1);
    setShowList(true);
  };

  const handleBackToDashboard = () => {
    setShowList(false);
    setViewingUser(null);
    setSearchParams({}, { replace: true });
  };

  // ────── Photo upload UI component ──────
  const renderPhotoUpload = (
    photoState: PhotoUploadState,
    setPhotoState: React.Dispatch<React.SetStateAction<PhotoUploadState>>,
    fileInputRef: React.RefObject<HTMLInputElement | null>,
    existingPhotoUrl?: string,
  ) => {
    const displayUrl = photoState.previewUrl || existingPhotoUrl;

    return (
      <div className="space-y-2">
        <Label>Foto</Label>
        <div className="flex items-center gap-4">
          {/* Preview thumbnail */}
          <div className="relative h-20 w-20 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center overflow-hidden bg-muted/30 shrink-0">
            {displayUrl ? (
              <img
                src={displayUrl}
                alt="Preview"
                className="h-full w-full object-cover rounded-lg"
              />
            ) : (
              <Camera className="h-8 w-8 text-muted-foreground/50" />
            )}
            {photoState.uploading && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
                <Loader2 className="h-6 w-6 animate-spin text-white" />
              </div>
            )}
          </div>

          <div className="flex-1 space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handlePhotoUpload(file, setPhotoState);
                }
                // Reset input so same file can be re-selected
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={photoState.uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {photoState.uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Subiendo...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  {displayUrl ? "Cambiar foto" : "Seleccionar foto"}
                </>
              )}
            </Button>

            {/* Progress bar */}
            {photoState.uploading && (
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${photoState.progress}%` }}
                />
              </div>
            )}

            {/* Upload status */}
            {photoState.publicUrl && (
              <div className="flex items-center gap-1 text-xs text-green-600">
                <ImageIcon className="h-3 w-3" />
                <span>Foto lista</span>
              </div>
            )}

            <p className="text-xs text-muted-foreground">JPG, PNG o WebP</p>
          </div>
        </div>
      </div>
    );
  };

  // ────── Empresa combobox component ──────
  const renderEmpresaCombobox = (
    value: string,
    onChange: (id: string) => void,
    open: boolean,
    onOpenChange: (open: boolean) => void,
  ) => (
    <div className="space-y-2">
      <Label>Empresa *</Label>
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          >
            <span className="truncate">
              {value
                ? empresasList?.find((e) => e._id === value)?.razonSocial ?? "Empresa seleccionada"
                : "Buscar empresa..."}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
          <Command>
            <CommandInput placeholder="Buscar por nombre..." />
            <CommandList>
              <CommandEmpty>No se encontraron empresas</CommandEmpty>
              <CommandGroup>
                {empresasList?.map((emp) => (
                  <CommandItem
                    key={emp._id}
                    value={emp.razonSocial}
                    onSelect={() => {
                      onChange(emp._id);
                      onOpenChange(false);
                    }}
                  >
                    <Check
                      className={`mr-2 h-4 w-4 ${value === emp._id ? "opacity-100" : "opacity-0"}`}
                    />
                    {emp.razonSocial}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );

  return (
    <DashboardLayout>
      <PageContainer>
        <ModuleHeader
          title="Administración de Terceros"
          description="Gestione conductores, propietarios, clientes y proveedores"
          icon={UsersIcon}
        />

        {/* ─── Sub-dashboard ─── */}
        {!showList && !viewingUser && (
          <div className="space-y-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <>
                {/* Total card */}
                <button
                  type="button"
                  onClick={handleShowAll}
                  className="w-full bg-card border rounded-lg p-6 flex items-center justify-between shadow-corporate hover:shadow-corporate-md hover:border-primary/30 transition-all duration-200 group cursor-pointer text-left"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-primary/10 group-hover:scale-105 transition-transform">
                      <UsersIcon className="h-7 w-7 text-primary" />
                    </div>
                    <div>
                      <p className="text-3xl font-bold text-foreground">{totalTerceros}</p>
                      <p className="text-sm text-muted-foreground">Total de terceros registrados</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                    <span>Ver todos</span>
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </button>

                {/* Role cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                  {roleCards.map((card) => {
                    const Icon = card.icon;
                    return (
                      <button
                        key={card.key}
                        type="button"
                        onClick={() => handleCardClick(card.key)}
                        className={`bg-card border rounded-lg p-5 shadow-corporate hover:shadow-corporate-md ${card.border} transition-all duration-200 group cursor-pointer text-left`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className={`p-2.5 rounded-lg ${card.bg} group-hover:scale-105 transition-transform`}>
                            <Icon className={`h-5 w-5 ${card.color}`} />
                          </div>
                          <span className={`text-2xl font-bold ${card.color}`}>{card.count}</span>
                        </div>
                        <p className="font-semibold text-foreground text-sm">{card.label}</p>
                        <div className="flex items-center gap-1 text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity mt-2">
                          <span>Ver listado</span>
                          <ArrowRight className="h-3 w-3" />
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Quick action */}
                <div className="flex justify-center">
                  <Button onClick={() => { setShowCreateDialog(true); setShowList(true); }} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Nuevo Tercero
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ─── List view ─── */}
        {(showList || viewingUser) && (
        <ContentCard>
          {viewingUser ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <Button variant="ghost" onClick={() => { handleViewUser(null); }} className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Volver al listado
                </Button>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => openEditDialog()} className="gap-2">
                    <Pencil className="h-4 w-4" />
                    Editar
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setShowDeleteDialog(true)}
                    className="gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    Eliminar
                  </Button>
                </div>
              </div>

              {/* Tercero header */}
              <div className="bg-muted/30 border rounded-lg p-6">
                <div className="flex items-start gap-4">
                  {getTerceroPhotoUrl(viewingUser) ? (
                    <img
                      src={getTerceroPhotoUrl(viewingUser)}
                      alt={getTerceroNombre(viewingUser)}
                      className="h-20 w-20 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="h-20 w-20 rounded-lg bg-primary/10 flex items-center justify-center">
                      <User className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold text-foreground">
                      {getTerceroNombre(viewingUser)}
                    </h2>
                    <p className="text-muted-foreground">
                      {viewingUser.tipoId} {viewingUser.identificacion}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {viewingUser.roles?.map((rol) => (
                        <Badge key={rol} variant="secondary">
                          {getRolLabel(rol)}
                        </Badge>
                      ))}
                      {viewingUser.rolesSistema?.map((rol) => (
                        <Badge key={rol} variant="default">
                          {getRolLabel(rol)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Tercero details */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-card border rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">Usuario Cellvi</p>
                  <p className="font-medium">{viewingUser.usuarioCellvi || "Sin usuario (no inicia sesión)"}</p>
                </div>
                <div className="bg-card border rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">Teléfono</p>
                  <p className="font-medium">{viewingUser.contacto?.telefono || "No registrado"}</p>
                </div>
                {viewingUser.datosConductor?.tipoSangre && (
                  <div className="bg-card border rounded-lg p-4">
                    <p className="text-sm text-muted-foreground">Tipo de Sangre</p>
                    <p className="font-medium">{viewingUser.datosConductor.tipoSangre}</p>
                  </div>
                )}
                {isAdmin && (
                  <div className="bg-card border rounded-lg p-4">
                    <p className="text-sm text-muted-foreground">Empresa</p>
                    <p className="font-medium">{getEmpresaName(viewingUser.empresa)}</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Back + Toolbar */}
              <div className="mb-4">
                <Button variant="ghost" size="sm" onClick={handleBackToDashboard} className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Volver al panel
                </Button>
                {roleFilter !== "all" && (
                  <Badge variant="secondary" className="ml-2">{getRolLabel(roleFilter)}</Badge>
                )}
              </div>
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nombre, identificación, usuario..."
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="pl-10"
                  />
                </div>
                <Select
                  value={roleFilter}
                  onValueChange={(value) => {
                    setRoleFilter(value);
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filtrar por rol" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los roles</SelectItem>
                    <SelectItem value="CONDUCTOR">Conductor</SelectItem>
                    <SelectItem value="PROPIETARIO">Propietario</SelectItem>
                    <SelectItem value="CLIENTE">Cliente</SelectItem>
                    <SelectItem value="ADMINISTRATIVO">Administrativo</SelectItem>
                    <SelectItem value="PROVEEDOR">Proveedor</SelectItem>
                    <SelectItem value="MECANICO">Mecánico</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={() => setShowCreateDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nuevo Tercero
                </Button>
              </div>

              {/* Table */}
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : error ? (
                <div className="text-center py-12 text-destructive">
                  Error al cargar terceros: {(error as Error).message}
                </div>
              ) : (
                <>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nombre</TableHead>
                          <TableHead>Identificación</TableHead>
                          <TableHead>Rol</TableHead>
                          {isAdmin && <TableHead>Empresa</TableHead>}
                          <TableHead>Usuario Cellvi</TableHead>
                          <TableHead>Teléfono</TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedTerceros.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={isAdmin ? 7 : 6} className="text-center py-8 text-muted-foreground">
                              No se encontraron terceros
                            </TableCell>
                          </TableRow>
                        ) : (
                          paginatedTerceros.map((tercero) => (
                            <TableRow
                              key={tercero._id}
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => handleViewUser(tercero)}
                            >
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                                    <User className="h-4 w-4 text-muted-foreground" />
                                  </div>
                                  <p className="font-medium">
                                    {getTerceroNombre(tercero)}
                                  </p>
                                </div>
                              </TableCell>
                              <TableCell>
                                <span className="text-sm">
                                  {tercero.tipoId} {tercero.identificacion}
                                </span>
                              </TableCell>
                              <TableCell>
                                {tercero.roles?.map((rol) => (
                                  <Badge key={rol} variant="secondary" className="mr-1">
                                    {getRolLabel(rol)}
                                  </Badge>
                                ))}
                                {tercero.rolesSistema?.map((rol) => (
                                  <Badge key={rol} variant="default" className="mr-1">
                                    {getRolLabel(rol)}
                                  </Badge>
                                ))}
                              </TableCell>
                              {isAdmin && (
                                <TableCell>
                                  <span className="text-sm">
                                    {getEmpresaName(tercero.empresa)}
                                  </span>
                                </TableCell>
                              )}
                              <TableCell>
                                <span className="text-sm">{tercero.usuarioCellvi || "-"}</span>
                              </TableCell>
                              <TableCell>
                                <span className="text-sm text-muted-foreground">
                                  {tercero.contacto?.telefono || "-"}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    title="Editar"
                                    onClick={(e) => { e.stopPropagation(); openEditDialog(tercero); }}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                    title="Eliminar"
                                    onClick={(e) => { e.stopPropagation(); openDeleteDialog(tercero); }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="mt-4 flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        Mostrando {(currentPage - 1) * ITEMS_PER_PAGE + 1} -{" "}
                        {Math.min(currentPage * ITEMS_PER_PAGE, filteredTerceros.length)} de{" "}
                        {filteredTerceros.length} terceros
                      </span>
                      <Pagination>
                        <PaginationContent>
                          <PaginationItem>
                            <PaginationPrevious
                              onClick={() => handlePageChange(currentPage - 1)}
                              className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                            />
                          </PaginationItem>
                          {renderPaginationItems()}
                          <PaginationItem>
                            <PaginationNext
                              onClick={() => handlePageChange(currentPage + 1)}
                              className={
                                currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"
                              }
                            />
                          </PaginationItem>
                        </PaginationContent>
                      </Pagination>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </ContentCard>
        )}

        {/* ─── Create Tercero Dialog ─── */}
        <Dialog
          open={showCreateDialog}
          onOpenChange={(open) => {
            setShowCreateDialog(open);
            if (!open) setCreatePhoto(initialPhotoState);
          }}
        >
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Crear Nuevo Tercero</DialogTitle>
              <DialogDescription>
                Complete los datos para registrar un nuevo tercero en el sistema.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Roles *</Label>
                <RolesMultiSelect
                  value={terceroForm.roles ?? []}
                  onChange={(roles) => { setTerceroForm({ ...terceroForm, roles }); setCreateErrors((p) => ({ ...p, roles: "" })); }}
                />
                {createErrors.roles && <p className="text-xs text-destructive">{createErrors.roles}</p>}
                <p className="text-xs text-muted-foreground">
                  {SHOW_ACCESS_ROLES ? (
                    <>
                      El <strong>Perfil</strong> son etiquetas de la persona. El <strong>Acceso al sistema</strong>
                      {" "}(Mecánico/Auditor) permite iniciar sesión y requiere <strong>Usuario Cellvi</strong>.
                    </>
                  ) : (
                    <>Seleccione el <strong>perfil</strong> de la persona.</>
                  )}
                </p>
              </div>
              {isAdmin && renderEmpresaCombobox(
                terceroForm.empresaId,
                (id) => setTerceroForm({ ...terceroForm, empresaId: id }),
                empresaPopoverOpen,
                setEmpresaPopoverOpen,
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Tipo Documento *</Label>
                  <Select
                    value={terceroForm.tipoId}
                    onValueChange={(value) => { setTerceroForm({ ...terceroForm, tipoId: value }); setCreateErrors((p) => ({ ...p, nombres: "", apellidos: "", razonSocial: "" })); }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPO_ID_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>{terceroForm.tipoId === "NIT" ? "NIT *" : "Identificación *"}</Label>
                  <Input
                    value={terceroForm.identificacion}
                    onChange={(e) => { setTerceroForm({ ...terceroForm, identificacion: e.target.value }); setCreateErrors((p) => ({ ...p, identificacion: "" })); }}
                    placeholder={terceroForm.tipoId === "NIT" ? "Ej: 900123456-7" : "Número de documento"}
                    className={createErrors.identificacion ? "border-destructive" : ""}
                  />
                  {createErrors.identificacion && <p className="text-xs text-destructive">{createErrors.identificacion}</p>}
                </div>
              </div>
              {terceroForm.tipoId === "NIT" ? (
                <div className="space-y-1">
                  <Label>Razón Social *</Label>
                  <Input
                    value={terceroForm.razonSocial ?? ""}
                    onChange={(e) => { setTerceroForm({ ...terceroForm, razonSocial: e.target.value }); setCreateErrors((p) => ({ ...p, razonSocial: "" })); }}
                    placeholder="Razón social de la empresa"
                    className={createErrors.razonSocial ? "border-destructive" : ""}
                  />
                  {createErrors.razonSocial && <p className="text-xs text-destructive">{createErrors.razonSocial}</p>}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Nombres *</Label>
                    <Input
                      value={terceroForm.nombres}
                      onChange={(e) => { setTerceroForm({ ...terceroForm, nombres: e.target.value }); setCreateErrors((p) => ({ ...p, nombres: "" })); }}
                      placeholder="Nombres"
                      className={createErrors.nombres ? "border-destructive" : ""}
                    />
                    {createErrors.nombres && <p className="text-xs text-destructive">{createErrors.nombres}</p>}
                  </div>
                  <div className="space-y-1">
                    <Label>Apellidos *</Label>
                    <Input
                      value={terceroForm.apellidos}
                      onChange={(e) => { setTerceroForm({ ...terceroForm, apellidos: e.target.value }); setCreateErrors((p) => ({ ...p, apellidos: "" })); }}
                      placeholder="Apellidos"
                      className={createErrors.apellidos ? "border-destructive" : ""}
                    />
                    {createErrors.apellidos && <p className="text-xs text-destructive">{createErrors.apellidos}</p>}
                  </div>
                </div>
              )}
              <div className="space-y-1">
                <Label>
                  Usuario Cellvi {requiereUsuarioCellvi(terceroForm.roles ?? []) ? "*" : "(opcional)"}
                </Label>
                <Input
                  value={terceroForm.usuarioCellvi}
                  onChange={(e) => { setTerceroForm({ ...terceroForm, usuarioCellvi: e.target.value }); setCreateErrors((p) => ({ ...p, usuarioCellvi: "" })); }}
                  placeholder="Usuario Cellvi"
                  className={createErrors.usuarioCellvi ? "border-destructive" : ""}
                />
                {createErrors.usuarioCellvi && <p className="text-xs text-destructive">{createErrors.usuarioCellvi}</p>}
                {!requiereUsuarioCellvi(terceroForm.roles ?? []) && (
                  <p className="text-xs text-muted-foreground">
                    Solo los proveedores pueden quedar sin Usuario Cellvi.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Teléfono</Label>
                <Input
                  value={terceroForm.telefono}
                  onChange={(e) => setTerceroForm({ ...terceroForm, telefono: e.target.value })}
                  placeholder="Número de teléfono"
                />
              </div>

              {/* Photo upload replaces old Foto URL text input */}
              {renderPhotoUpload(createPhoto, setCreatePhoto, createFileInputRef)}

              {(terceroForm.roles ?? []).includes("CONDUCTOR") && (
                <div className="space-y-2">
                  <Label>Tipo de Sangre</Label>
                  <Select
                    value={terceroForm.tipoSangre}
                    onValueChange={(value) => setTerceroForm({ ...terceroForm, tipoSangre: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione tipo de sangre" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="O+">O+</SelectItem>
                      <SelectItem value="O-">O-</SelectItem>
                      <SelectItem value="A+">A+</SelectItem>
                      <SelectItem value="A-">A-</SelectItem>
                      <SelectItem value="B+">B+</SelectItem>
                      <SelectItem value="B-">B-</SelectItem>
                      <SelectItem value="AB+">AB+</SelectItem>
                      <SelectItem value="AB-">AB-</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleCreateSubmit}
                disabled={createTerceroMutation.isPending || createPhoto.uploading}
              >
                {createTerceroMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Crear Tercero
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ─── Edit Tercero Dialog ─── */}
        <Dialog
          open={showEditDialog}
          onOpenChange={(open) => {
            setShowEditDialog(open);
            if (!open) setEditPhoto(initialPhotoState);
          }}
        >
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Editar Tercero</DialogTitle>
              <DialogDescription>
                Modifique los datos del tercero.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Roles *</Label>
                <RolesMultiSelect
                  value={editForm.roles ?? []}
                  onChange={(roles) => setEditForm({ ...editForm, roles })}
                />
                <p className="text-xs text-muted-foreground">
                  {SHOW_ACCESS_ROLES ? (
                    <>
                      El <strong>Perfil</strong> son etiquetas de la persona. El <strong>Acceso al sistema</strong>
                      {" "}(Mecánico/Auditor) permite iniciar sesión y requiere <strong>Usuario Cellvi</strong>.
                    </>
                  ) : (
                    <>Seleccione el <strong>perfil</strong> de la persona.</>
                  )}
                </p>
              </div>
              {isAdmin && renderEmpresaCombobox(
                editForm.empresaId,
                (id) => setEditForm({ ...editForm, empresaId: id }),
                editEmpresaPopoverOpen,
                setEditEmpresaPopoverOpen,
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Tipo Documento *</Label>
                  <Select
                    value={editForm.tipoId}
                    onValueChange={(value) => setEditForm({ ...editForm, tipoId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPO_ID_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{editForm.tipoId === "NIT" ? "NIT *" : "Identificación *"}</Label>
                  <Input
                    value={editForm.identificacion}
                    onChange={(e) => setEditForm({ ...editForm, identificacion: e.target.value })}
                    placeholder={editForm.tipoId === "NIT" ? "Ej: 900123456-7" : "Número de documento"}
                  />
                </div>
              </div>
              {editForm.tipoId === "NIT" ? (
                <div className="space-y-2">
                  <Label>Razón Social *</Label>
                  <Input
                    value={editForm.razonSocial ?? ""}
                    onChange={(e) => setEditForm({ ...editForm, razonSocial: e.target.value })}
                    placeholder="Razón social de la empresa"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Nombres *</Label>
                    <Input
                      value={editForm.nombres}
                      onChange={(e) => setEditForm({ ...editForm, nombres: e.target.value })}
                      placeholder="Nombres"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Apellidos *</Label>
                    <Input
                      value={editForm.apellidos}
                      onChange={(e) => setEditForm({ ...editForm, apellidos: e.target.value })}
                      placeholder="Apellidos"
                    />
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label>
                  Usuario Cellvi {requiereUsuarioCellvi(editForm.roles ?? []) ? "*" : "(opcional)"}
                </Label>
                <Input
                  value={editForm.usuarioCellvi}
                  onChange={(e) => setEditForm({ ...editForm, usuarioCellvi: e.target.value })}
                  placeholder="Usuario Cellvi"
                />
                {!requiereUsuarioCellvi(editForm.roles ?? []) && (
                  <p className="text-xs text-muted-foreground">
                    Solo los proveedores pueden quedar sin Usuario Cellvi.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Teléfono</Label>
                <Input
                  value={editForm.telefono}
                  onChange={(e) => setEditForm({ ...editForm, telefono: e.target.value })}
                  placeholder="Número de teléfono"
                />
              </div>

              {/* Photo upload with existing photo preview */}
              {renderPhotoUpload(
                editPhoto,
                setEditPhoto,
                editFileInputRef,
                viewingUser ? getTerceroPhotoUrl(viewingUser) : undefined,
              )}

              {(editForm.roles ?? []).includes("CONDUCTOR") && (
                <div className="space-y-2">
                  <Label>Tipo de Sangre</Label>
                  <Select
                    value={editForm.tipoSangre}
                    onValueChange={(value) => setEditForm({ ...editForm, tipoSangre: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione tipo de sangre" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="O+">O+</SelectItem>
                      <SelectItem value="O-">O-</SelectItem>
                      <SelectItem value="A+">A+</SelectItem>
                      <SelectItem value="A-">A-</SelectItem>
                      <SelectItem value="B+">B+</SelectItem>
                      <SelectItem value="B-">B-</SelectItem>
                      <SelectItem value="AB+">AB+</SelectItem>
                      <SelectItem value="AB-">AB-</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                Cancelar
              </Button>
              <Button
                onClick={() => editTerceroMutation.mutate()}
                disabled={
                  editTerceroMutation.isPending ||
                  editPhoto.uploading ||
                  !editForm.identificacion.trim() ||
                  (editForm.tipoId === "NIT"
                    ? !(editForm.razonSocial ?? "").trim()
                    : !editForm.nombres.trim() || !editForm.apellidos.trim()) ||
                  (requiereUsuarioCellvi(editForm.roles ?? []) && !editForm.usuarioCellvi.trim()) ||
                  (isAdmin && !editForm.empresaId)
                }
              >
                {editTerceroMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Guardar Cambios
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ─── Delete Confirmation Dialog ─── */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Eliminar Tercero</AlertDialogTitle>
              <AlertDialogDescription>
                {viewingUser
                  ? `¿Está seguro de que desea eliminar a ${getTerceroNombre(viewingUser)} (${viewingUser.tipoId} ${viewingUser.identificacion})? Esta acción no se puede deshacer.`
                  : "Esta acción no se puede deshacer."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteTerceroMutation.isPending}>
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  deleteTerceroMutation.mutate();
                }}
                disabled={deleteTerceroMutation.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteTerceroMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </PageContainer>
    </DashboardLayout>
  );
}

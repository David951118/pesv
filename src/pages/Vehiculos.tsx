import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useSessionState } from "@/hooks/useSessionState";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useEmpresasList, getEmpresaName } from "@/hooks/useEmpresasList";
import { getApiRndcBaseUrl } from "@/services/apirndc/apirndc.config";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { ModuleHeader } from "@/components/layout/ModuleHeader";
import { ContentCard } from "@/components/layout/ContentCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CellviPlacaCombobox } from "@/components/documentos/CellviPlacaCombobox";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Truck,
  Plus,
  Search,
  Loader2,
  ArrowLeft,
  Car,
  Pencil,
  Trash2,
  Gauge,
  RefreshCw,
} from "lucide-react";
import { getVehiculoKilometraje } from "@/services/apirndc/apirndc.api";
import { KM_FUENTE_LABELS } from "@/components/operacion/operacion.helpers";

const ITEMS_PER_PAGE = 10;

const COMBUSTIBLE_OPTIONS = ["GASOLINA", "DIESEL", "GAS", "HIBRIDO", "ELECTRICO"];
const ESTADO_OPTIONS = ["ACTIVO", "MANTENIMIENTO", "INACTIVO", "RETIRADO"];
const CARROCERIA_OPTIONS = ["CERRADA", "ABIERTA", "FURGON", "VOLQUETA", "PLATAFORMA"];
const MODALIDAD_OPTIONS = ["ESPECIAL", "PUBLICO", "PRIVADO", "CARGA", "MIXTO"];

interface VehiculoData {
  _id: string;
  placa: string;
  numeroInterno: string;
  idCellvi: string;
  marca: string;
  linea: string;
  modelo: number;
  color: string;
  claseVehiculo: string;
  carroceria: string;
  modalidad: string;
  combustible: string;
  motor: string;
  chasis: string;
  cilindraje: string;
  capacidadPasajeros: number;
  fechaMatricula: string;
  propietario: string | { _id: string; nombres: string; apellidos: string };
  empresaAfiliadora: string | { _id: string; razonSocial?: string };
  fechaAfiliacion: string;
  estado: string;
  kilometrajeActual: number;
}

interface TerceroOption {
  _id: string;
  nombres: string;
  apellidos: string;
  identificacion: string;
}

function getEstadoBadgeVariant(estado: string) {
  switch (estado) {
    case "ACTIVO": return "default";
    case "MANTENIMIENTO": return "secondary";
    case "INACTIVO": return "outline";
    case "RETIRADO": return "destructive";
    default: return "secondary";
  }
}

function getPropietarioName(prop: VehiculoData["propietario"]): string {
  if (!prop) return "-";
  if (typeof prop === "string") return prop;
  return `${prop.nombres} ${prop.apellidos}`;
}

const initialVehiculoForm = {
  cellviId: "",
  placa: "",
  marca: "",
  linea: "",
  modelo: "",
  claseVehiculo: "",
  motor: "",
  chasis: "",
  fechaMatricula: "",
  color: "",
  carroceria: "",
  modalidad: "",
  combustible: "GASOLINA",
  cilindraje: "",
  capacidadPasajeros: "",
  numeroInterno: "",
  kilometrajeActual: "",
  fechaAfiliacion: "",
  propietario: "",
  estado: "ACTIVO",
};

export default function Vehiculos() {
  const queryClient = useQueryClient();
  const { user, empresaId, bearerToken, cellviToken, role } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialVehId = searchParams.get("vehiculo");
  const [search, setSearch] = useState("");
  const [estadoFilter, setEstadoFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);

  const [showCreateDialog, setShowCreateDialog, clearCreateDialog] = useSessionState("veh-create-open", false);
  const [viewingVehiculo, setViewingVehiculo] = useState<VehiculoData | null>(null);
  const [vehiculoForm, setVehiculoForm, clearVehiculoForm] = useSessionState("veh-form", initialVehiculoForm);
  const [loadingCellvi, setLoadingCellvi] = useState(false);
  // Opciones de placa (id + placa) para el selector de Cellvi
  const [cellviPlateOptions, setCellviPlateOptions] = useState<{ id: string; placa: string }[]>([]);
  // Caché de detalles de cada vehículo Cellvi (respuesta de /show), llenada on-demand
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [cellviVehiclesData, setCellviVehiclesData] = useState<Record<string, any>>({});

  const isAdmin = role === "admin";
  // Empresa afiliadora elegida al crear (solo admin; los demás roles usan su propia empresa)
  const [createEmpresa, setCreateEmpresa] = useState("");
  const cellviVehiculos = user?.vehiculos || [];

  // Cargar las placas del selector al abrir el diálogo:
  // - Admin: TODOS los vehículos de Cellvi (/cellvi/vehiculo/flat/list). El admin de Cellvi no
  //   tiene vehículos "asignados", por eso user.vehiculos viene vacío y hay que pedir la lista completa.
  // - Otros roles: solo los vehículos asignados al usuario (user.vehiculos).
  useEffect(() => {
    if (!showCreateDialog) return;
    let cancelled = false;

    const load = async () => {
      if (isAdmin) {
        if (!cellviToken) return;
        setLoadingCellvi(true);
        try {
          const res = await fetch(`/cellviapi/cellvi/vehiculo/flat/list`, {
            headers: { Authorization: `Bearer ${cellviToken}` },
          });
          if (res.ok) {
            const json = await res.json();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const raw: any[] = Array.isArray(json) ? json : json?.data ?? [];
            const list = raw
              .map((v) => ({ id: String(v.id), placa: v.placa }))
              .filter((v) => v.id && v.placa);
            if (!cancelled) setCellviPlateOptions(list);
          }
        } catch {
          // ignore
        } finally {
          if (!cancelled) setLoadingCellvi(false);
        }
      } else {
        setCellviPlateOptions(
          cellviVehiculos.map((v) => ({ id: String(v.id), placa: v.placa })),
        );
      }
    };

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCreateDialog, cellviToken, isAdmin]);

  // Fill form when selecting a plate (detalles on-demand + cacheados)
  const handleSelectCellviPlaca = async (cellviId: string) => {
    const opt = cellviPlateOptions.find((o) => o.id === cellviId);
    // Refleja la selección de inmediato (al menos la placa)
    setVehiculoForm((f) => ({ ...f, cellviId, placa: opt?.placa || f.placa }));

    let data = cellviVehiclesData[cellviId];
    if (!data && cellviToken) {
      try {
        const res = await fetch(`/cellviapi/cellvi/vehiculo/${cellviId}/show`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${cellviToken}`,
            "Content-Type": "application/json",
          },
        });
        if (res.ok) {
          data = await res.json();
          setCellviVehiclesData((prev) => ({ ...prev, [cellviId]: data }));
        }
      } catch {
        // ignore
      }
    }
    if (!data) return;

    const fechaRaw = data.fechaMatricula || "";
    const fechaMatricula = fechaRaw ? fechaRaw.substring(0, 10) : "";

    setVehiculoForm((f) => ({
      ...f,
      cellviId,
      placa: data.placa || f.placa,
      marca: data.linea?.marca?.marca || "",
      linea: data.linea?.linea || "",
      modelo: data.modelo?.toString() || "",
      claseVehiculo: data.tipoVehiculo?.nombre || "",
      motor: data.serialMotor || "",
      chasis: data.serialChasis || "",
      fechaMatricula,
    }));
  };

  // Fetch vehiculos list
  const { data: vehiculos, isLoading, error } = useQuery({
    queryKey: ["vehiculos-list"],
    queryFn: async () => {
      if (!bearerToken) throw new Error("No autenticado");
      // limit alto: la lista pagina/busca en cliente, así que traemos todos los vehículos
      // (el backend devuelve 50 por defecto y dejaría fuera los recién creados).
      const res = await fetch(`${getApiRndcBaseUrl()}/api/vehiculos?limit=1000`, {
        headers: { Authorization: `Bearer ${bearerToken}` },
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Error al cargar vehículos");
      return (result.data ?? result) as VehiculoData[];
    },
    enabled: !!bearerToken,
  });

  // Fetch terceros for propietario select — admin gets all, supervisor gets empresa-filtered
  const { data: empresasList = [] } = useEmpresasList();
  const [empresaFilter, setEmpresaFilter] = useState<string>("all");
  const { data: terceros } = useQuery({
    queryKey: ["terceros-list", isAdmin ? "all" : empresaId],
    queryFn: async () => {
      if (!bearerToken) throw new Error("No autenticado");
      const url = isAdmin
        ? `${getApiRndcBaseUrl()}/api/terceros`
        : `${getApiRndcBaseUrl()}/api/terceros/empresa/${empresaId}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${bearerToken}` },
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Error al cargar terceros");
      return (result.data ?? result) as TerceroOption[];
    },
    enabled: !!bearerToken && (isAdmin || !!empresaId),
  });

  // Kilometraje en vivo del vehículo en detalle (Cellvi GPS → preop → manual)
  const { data: kmRes, isFetching: kmLoading } = useQuery({
    queryKey: ["vehiculo-km", viewingVehiculo?._id],
    queryFn: ({ signal }) =>
      getVehiculoKilometraje(viewingVehiculo!._id, undefined, signal),
    enabled: !!viewingVehiculo?._id,
    staleTime: 60_000,
  });

  // Consultar y PERSISTIR el km actual desde Cellvi
  const actualizarKmMutation = useMutation({
    mutationFn: () =>
      getVehiculoKilometraje(viewingVehiculo!._id, { actualizar: true }),
    onSuccess: (res) => {
      const km = res.data?.kilometraje;
      toast.success(
        km != null
          ? `Kilometraje actualizado: ${km.toLocaleString("es-CO")}`
          : "El equipo no reporta kilometraje",
      );
      queryClient.invalidateQueries({ queryKey: ["vehiculo-km", viewingVehiculo?._id] });
      queryClient.invalidateQueries({ queryKey: ["vehiculos-list"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Create vehiculo mutation
  const createVehiculoMutation = useMutation({
    mutationFn: async () => {
      if (!bearerToken) throw new Error("No autenticado");
      // Admin elige la empresa afiliadora; los demás roles usan la suya.
      const empresaAfiliadora = isAdmin ? createEmpresa : empresaId;
      if (!empresaAfiliadora) {
        throw new Error(
          isAdmin
            ? "Seleccione la empresa afiliadora del vehículo."
            : "No se encontró empresa. Cierre sesión e inicie sesión de nuevo.",
        );
      }

      const body = {
        placa: vehiculoForm.placa,
        numeroInterno: vehiculoForm.numeroInterno,
        idCellvi: vehiculoForm.cellviId,
        marca: vehiculoForm.marca,
        linea: vehiculoForm.linea,
        modelo: Number(vehiculoForm.modelo) || 0,
        color: vehiculoForm.color,
        claseVehiculo: vehiculoForm.claseVehiculo,
        carroceria: vehiculoForm.carroceria,
        modalidad: vehiculoForm.modalidad,
        combustible: vehiculoForm.combustible,
        motor: vehiculoForm.motor,
        chasis: vehiculoForm.chasis,
        cilindraje: vehiculoForm.cilindraje,
        capacidadPasajeros: Number(vehiculoForm.capacidadPasajeros) || 0,
        fechaMatricula: vehiculoForm.fechaMatricula,
        propietario: vehiculoForm.propietario,
        empresaAfiliadora,
        fechaAfiliacion: vehiculoForm.fechaAfiliacion,
        estado: vehiculoForm.estado,
        kilometrajeActual: Number(vehiculoForm.kilometrajeActual) || 0,
      };

      const res = await fetch(`${getApiRndcBaseUrl()}/api/vehiculos`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${bearerToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || result.message || "Error al crear vehículo");
      return result;
    },
    onSuccess: () => {
      toast.success("Vehículo creado exitosamente");
      queryClient.invalidateQueries({ queryKey: ["vehiculos-list"] });
      setShowCreateDialog(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const resetForm = () => {
    clearVehiculoForm();
    clearCreateDialog();
    setCellviVehiclesData({});
    setCreateEmpresa("");
  };

  // Restore viewing vehiculo from URL
  useEffect(() => {
    if (initialVehId && vehiculos && !viewingVehiculo) {
      const found = vehiculos.find((v) => v._id === initialVehId);
      if (found) setViewingVehiculo(found);
    }
  }, [initialVehId, vehiculos]);

  const handleViewVehiculo = (vehiculo: VehiculoData | null) => {
    setViewingVehiculo(vehiculo);
    if (vehiculo) {
      setSearchParams({ vehiculo: vehiculo._id }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  };

  const [editingVehiculo, setEditingVehiculo] = useState<VehiculoData | null>(null);

  const handleEditVehiculo = (vehiculo: VehiculoData) => {
    setEditingVehiculo(vehiculo);
    setVehiculoForm({
      cellviId: vehiculo.idCellvi || "",
      placa: vehiculo.placa || "",
      marca: vehiculo.marca || "",
      linea: vehiculo.linea || "",
      modelo: vehiculo.modelo?.toString() || "",
      claseVehiculo: vehiculo.claseVehiculo || "",
      motor: vehiculo.motor || "",
      chasis: vehiculo.chasis || "",
      fechaMatricula: vehiculo.fechaMatricula || "",
      color: vehiculo.color || "",
      carroceria: vehiculo.carroceria || "",
      modalidad: vehiculo.modalidad || "",
      combustible: vehiculo.combustible || "GASOLINA",
      cilindraje: vehiculo.cilindraje || "",
      capacidadPasajeros: vehiculo.capacidadPasajeros?.toString() || "",
      numeroInterno: vehiculo.numeroInterno || "",
      kilometrajeActual: vehiculo.kilometrajeActual?.toString() || "",
      fechaAfiliacion: vehiculo.fechaAfiliacion || "",
      propietario: typeof vehiculo.propietario === "string" ? vehiculo.propietario : vehiculo.propietario?._id || "",
      estado: vehiculo.estado || "ACTIVO",
    });
    setShowCreateDialog(true);
  };

  const updateVehiculoMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!bearerToken) throw new Error("No autenticado");
      const body = {
        placa: vehiculoForm.placa,
        numeroInterno: vehiculoForm.numeroInterno,
        idCellvi: vehiculoForm.cellviId,
        marca: vehiculoForm.marca,
        linea: vehiculoForm.linea,
        modelo: Number(vehiculoForm.modelo) || 0,
        color: vehiculoForm.color,
        claseVehiculo: vehiculoForm.claseVehiculo,
        carroceria: vehiculoForm.carroceria,
        modalidad: vehiculoForm.modalidad,
        combustible: vehiculoForm.combustible,
        motor: vehiculoForm.motor,
        chasis: vehiculoForm.chasis,
        cilindraje: vehiculoForm.cilindraje,
        capacidadPasajeros: Number(vehiculoForm.capacidadPasajeros) || 0,
        fechaMatricula: vehiculoForm.fechaMatricula,
        propietario: vehiculoForm.propietario,
        fechaAfiliacion: vehiculoForm.fechaAfiliacion,
        estado: vehiculoForm.estado,
        kilometrajeActual: Number(vehiculoForm.kilometrajeActual) || 0,
      };
      const res = await fetch(`${getApiRndcBaseUrl()}/api/vehiculos/${id}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${bearerToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || result.message || "Error al actualizar");
      return result;
    },
    onSuccess: () => {
      toast.success("Vehículo actualizado exitosamente");
      queryClient.invalidateQueries({ queryKey: ["vehiculos-list"] });
      setShowCreateDialog(false);
      setEditingVehiculo(null);
      resetForm();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const handleDeleteVehiculo = async (id: string) => {
    if (!bearerToken) return;
    try {
      const res = await fetch(`${getApiRndcBaseUrl()}/api/vehiculos/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${bearerToken}` },
      });
      if (!res.ok) throw new Error(`Error: ${res.status}`);
      toast.success("Vehículo eliminado exitosamente");
      queryClient.invalidateQueries({ queryKey: ["vehiculos-list"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar");
    }
  };

  // Filter and paginate
  const filteredVehiculos = vehiculos?.filter((v) => {
    const matchesSearch =
      v.placa?.toLowerCase().includes(search.toLowerCase()) ||
      v.marca?.toLowerCase().includes(search.toLowerCase()) ||
      v.linea?.toLowerCase().includes(search.toLowerCase()) ||
      v.numeroInterno?.toLowerCase().includes(search.toLowerCase());
    const matchesEstado = estadoFilter === "all" || v.estado === estadoFilter;
    const empId = typeof v.empresaAfiliadora === "object" ? v.empresaAfiliadora._id : v.empresaAfiliadora;
    const matchesEmpresa = empresaFilter === "all" || empId === empresaFilter;
    return matchesSearch && matchesEstado && matchesEmpresa;
  }) || [];

  const totalPages = Math.ceil(filteredVehiculos.length / ITEMS_PER_PAGE);
  const paginatedVehiculos = filteredVehiculos.slice(
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

  return (
    <DashboardLayout>
      <PageContainer>
        <ModuleHeader
          title="Administración de Vehículos"
          description="Gestione los vehículos de la empresa"
          icon={Truck}
        />

        <ContentCard>
          {viewingVehiculo ? (
            <div className="space-y-6">
              <Button variant="ghost" onClick={() => handleViewVehiculo(null)} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Volver a vehículos
              </Button>

              {/* Vehicle header */}
              <div className="bg-muted/30 border rounded-lg p-6">
                <div className="flex items-start gap-4">
                  <div className="h-20 w-20 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Car className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold text-foreground">
                      {viewingVehiculo.placa}
                    </h2>
                    <p className="text-muted-foreground">
                      {viewingVehiculo.marca} {viewingVehiculo.linea} - {viewingVehiculo.modelo}
                    </p>
                    <div className="flex gap-2 mt-2">
                      <Badge variant={getEstadoBadgeVariant(viewingVehiculo.estado) as "default" | "secondary" | "outline" | "destructive"}>
                        {viewingVehiculo.estado}
                      </Badge>
                      <Badge variant="outline">{viewingVehiculo.claseVehiculo}</Badge>
                    </div>
                  </div>
                </div>
              </div>

              {/* Kilometraje actual */}
              <div className="bg-card border rounded-lg p-6">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-lg bg-primary/10">
                      <Gauge className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Kilometraje actual</p>
                      <p className="text-3xl font-bold text-foreground leading-tight">
                        {kmLoading && !kmRes ? (
                          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        ) : (
                          <>
                            {(kmRes?.data?.kilometraje ?? viewingVehiculo.kilometrajeActual)?.toLocaleString("es-CO") ?? "-"}
                            <span className="text-base font-normal text-muted-foreground"> km</span>
                          </>
                        )}
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {kmRes?.data?.fuente && (
                          <Badge variant="outline">
                            {KM_FUENTE_LABELS[kmRes.data.fuente] ?? kmRes.data.fuente}
                          </Badge>
                        )}
                        {kmRes?.data?.fecha && (
                          <span className="text-xs text-muted-foreground">
                            {(() => { try { return format(new Date(kmRes.data.fecha), "dd MMM yyyy HH:mm", { locale: es }); } catch { return ""; } })()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => actualizarKmMutation.mutate()}
                    disabled={actualizarKmMutation.isPending}
                    className="gap-2"
                  >
                    {actualizarKmMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    Actualizar desde Cellvi
                  </Button>
                </div>
              </div>

              {/* Vehicle details */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Información General</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="bg-card border rounded-lg p-4">
                    <p className="text-sm text-muted-foreground">Placa</p>
                    <p className="font-medium">{viewingVehiculo.placa}</p>
                  </div>
                  <div className="bg-card border rounded-lg p-4">
                    <p className="text-sm text-muted-foreground">Número Interno</p>
                    <p className="font-medium">{viewingVehiculo.numeroInterno || "-"}</p>
                  </div>
                  <div className="bg-card border rounded-lg p-4">
                    <p className="text-sm text-muted-foreground">ID Cellvi</p>
                    <p className="font-medium">{viewingVehiculo.idCellvi || "-"}</p>
                  </div>
                  <div className="bg-card border rounded-lg p-4">
                    <p className="text-sm text-muted-foreground">Marca / Línea</p>
                    <p className="font-medium">{viewingVehiculo.marca} {viewingVehiculo.linea}</p>
                  </div>
                  <div className="bg-card border rounded-lg p-4">
                    <p className="text-sm text-muted-foreground">Modelo</p>
                    <p className="font-medium">{viewingVehiculo.modelo}</p>
                  </div>
                  <div className="bg-card border rounded-lg p-4">
                    <p className="text-sm text-muted-foreground">Color</p>
                    <p className="font-medium">{viewingVehiculo.color || "-"}</p>
                  </div>
                </div>

                <h3 className="text-lg font-semibold">Datos Técnicos</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="bg-card border rounded-lg p-4">
                    <p className="text-sm text-muted-foreground">Clase de Vehículo</p>
                    <p className="font-medium">{viewingVehiculo.claseVehiculo || "-"}</p>
                  </div>
                  <div className="bg-card border rounded-lg p-4">
                    <p className="text-sm text-muted-foreground">Carrocería</p>
                    <p className="font-medium">{viewingVehiculo.carroceria || "-"}</p>
                  </div>
                  <div className="bg-card border rounded-lg p-4">
                    <p className="text-sm text-muted-foreground">Modalidad</p>
                    <p className="font-medium">{viewingVehiculo.modalidad || "-"}</p>
                  </div>
                  <div className="bg-card border rounded-lg p-4">
                    <p className="text-sm text-muted-foreground">Combustible</p>
                    <p className="font-medium">{viewingVehiculo.combustible || "-"}</p>
                  </div>
                  <div className="bg-card border rounded-lg p-4">
                    <p className="text-sm text-muted-foreground">Motor</p>
                    <p className="font-medium">{viewingVehiculo.motor || "-"}</p>
                  </div>
                  <div className="bg-card border rounded-lg p-4">
                    <p className="text-sm text-muted-foreground">Chasis</p>
                    <p className="font-medium">{viewingVehiculo.chasis || "-"}</p>
                  </div>
                  <div className="bg-card border rounded-lg p-4">
                    <p className="text-sm text-muted-foreground">Cilindraje</p>
                    <p className="font-medium">{viewingVehiculo.cilindraje || "-"}</p>
                  </div>
                  <div className="bg-card border rounded-lg p-4">
                    <p className="text-sm text-muted-foreground">Capacidad Pasajeros</p>
                    <p className="font-medium">{viewingVehiculo.capacidadPasajeros || "-"}</p>
                  </div>
                </div>

                <h3 className="text-lg font-semibold">Propietario y Afiliación</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="bg-card border rounded-lg p-4">
                    <p className="text-sm text-muted-foreground">Propietario</p>
                    <p className="font-medium">{getPropietarioName(viewingVehiculo.propietario)}</p>
                  </div>
                  <div className="bg-card border rounded-lg p-4">
                    <p className="text-sm text-muted-foreground">Fecha Matrícula</p>
                    <p className="font-medium">{viewingVehiculo.fechaMatricula ? (() => { try { return format(new Date(viewingVehiculo.fechaMatricula), "dd MMM yyyy", { locale: es }); } catch { return viewingVehiculo.fechaMatricula; } })() : "-"}</p>
                  </div>
                  <div className="bg-card border rounded-lg p-4">
                    <p className="text-sm text-muted-foreground">Fecha Afiliación</p>
                    <p className="font-medium">{viewingVehiculo.fechaAfiliacion ? (() => { try { return format(new Date(viewingVehiculo.fechaAfiliacion), "dd MMM yyyy", { locale: es }); } catch { return viewingVehiculo.fechaAfiliacion; } })() : "-"}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Toolbar */}
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por placa, marca, línea..."
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="pl-10"
                  />
                </div>
                <Select
                  value={estadoFilter}
                  onValueChange={(value) => {
                    setEstadoFilter(value);
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filtrar por estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los estados</SelectItem>
                    {ESTADO_OPTIONS.map((e) => (
                      <SelectItem key={e} value={e}>{e}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isAdmin && empresasList.length > 0 && (
                  <Select
                    value={empresaFilter}
                    onValueChange={(value) => {
                      setEmpresaFilter(value);
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Filtrar por empresa" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas las empresas</SelectItem>
                      {empresasList.map((e) => (
                        <SelectItem key={e._id} value={e._id}>{e.razonSocial}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Button onClick={() => setShowCreateDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nuevo Vehículo
                </Button>
              </div>

              {/* Table */}
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : error ? (
                <div className="text-center py-12 text-destructive">
                  Error al cargar vehículos: {(error as Error).message}
                </div>
              ) : (
                <>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Placa</TableHead>
                          <TableHead>Marca / Línea</TableHead>
                          <TableHead>Modelo</TableHead>
                          <TableHead>Clase</TableHead>
                          <TableHead>Estado</TableHead>
                          {isAdmin && <TableHead>Empresa</TableHead>}
                          <TableHead>Propietario</TableHead>
                          {isAdmin && <TableHead className="text-center">Acciones</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedVehiculos.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={isAdmin ? 8 : 6} className="text-center py-8 text-muted-foreground">
                              No se encontraron vehículos
                            </TableCell>
                          </TableRow>
                        ) : (
                          paginatedVehiculos.map((vehiculo) => (
                            <TableRow
                              key={vehiculo._id}
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => handleViewVehiculo(vehiculo)}
                            >
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                                    <Car className="h-4 w-4 text-muted-foreground" />
                                  </div>
                                  <p className="font-medium">{vehiculo.placa}</p>
                                </div>
                              </TableCell>
                              <TableCell>
                                <span className="text-sm">{vehiculo.marca} {vehiculo.linea}</span>
                              </TableCell>
                              <TableCell>
                                <span className="text-sm">{vehiculo.modelo}</span>
                              </TableCell>
                              <TableCell>
                                <span className="text-sm">{vehiculo.claseVehiculo || "-"}</span>
                              </TableCell>
                              <TableCell>
                                <Badge variant={getEstadoBadgeVariant(vehiculo.estado) as "default" | "secondary" | "outline" | "destructive"}>
                                  {vehiculo.estado}
                                </Badge>
                              </TableCell>
                              {isAdmin && (
                                <TableCell>
                                  <span className="text-sm text-muted-foreground">
                                    {getEmpresaName(empresasList, vehiculo.empresaAfiliadora)}
                                  </span>
                                </TableCell>
                              )}
                              <TableCell>
                                <span className="text-sm text-muted-foreground">
                                  {getPropietarioName(vehiculo.propietario)}
                                </span>
                              </TableCell>
                              {isAdmin && (
                                <TableCell>
                                  <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => handleEditVehiculo(vehiculo)}
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>Eliminar vehículo</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            ¿Estás seguro de eliminar el vehículo {vehiculo.placa}? Esta acción no se puede deshacer.
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                          <AlertDialogAction
                                            onClick={() => handleDeleteVehiculo(vehiculo._id)}
                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                          >
                                            Eliminar
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  </div>
                                </TableCell>
                              )}
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
                        {Math.min(currentPage * ITEMS_PER_PAGE, filteredVehiculos.length)} de{" "}
                        {filteredVehiculos.length} vehículos
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
                              className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
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

        {/* Create Vehiculo Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={(open) => { setShowCreateDialog(open); if (!open) setEditingVehiculo(null); }}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingVehiculo ? "Editar Vehículo" : "Crear Nuevo Vehículo"}</DialogTitle>
              <DialogDescription>
                Seleccione un vehículo de Cellvi para auto-completar los datos, luego complete los campos faltantes.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {/* Cellvi plate selector */}
              <div className="space-y-2">
                <Label>Placa (Cellvi) *</Label>
                {loadingCellvi ? (
                  <div className="flex items-center gap-2 py-2">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground">Cargando vehículos de Cellvi...</span>
                  </div>
                ) : (
                  <CellviPlacaCombobox
                    options={cellviPlateOptions}
                    value={vehiculoForm.cellviId}
                    onSelect={handleSelectCellviPlaca}
                  />
                )}
                {!loadingCellvi && cellviPlateOptions.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No hay vehículos de Cellvi disponibles. Verifique su sesión.
                  </p>
                )}
              </div>

              {/* Auto-filled fields (from Cellvi) */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Placa</Label>
                  <Input
                    value={vehiculoForm.placa}
                    onChange={(e) => setVehiculoForm({ ...vehiculoForm, placa: e.target.value })}
                    placeholder="ABC123"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Marca</Label>
                  <Input
                    value={vehiculoForm.marca}
                    onChange={(e) => setVehiculoForm({ ...vehiculoForm, marca: e.target.value })}
                    placeholder="Marca"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Línea</Label>
                  <Input
                    value={vehiculoForm.linea}
                    onChange={(e) => setVehiculoForm({ ...vehiculoForm, linea: e.target.value })}
                    placeholder="Línea"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Modelo (Año)</Label>
                  <Input
                    type="number"
                    value={vehiculoForm.modelo}
                    onChange={(e) => setVehiculoForm({ ...vehiculoForm, modelo: e.target.value })}
                    placeholder="2024"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Clase de Vehículo</Label>
                  <Input
                    value={vehiculoForm.claseVehiculo}
                    onChange={(e) => setVehiculoForm({ ...vehiculoForm, claseVehiculo: e.target.value })}
                    placeholder="Clase"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Motor</Label>
                  <Input
                    value={vehiculoForm.motor}
                    onChange={(e) => setVehiculoForm({ ...vehiculoForm, motor: e.target.value })}
                    placeholder="Serial motor"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Chasis</Label>
                  <Input
                    value={vehiculoForm.chasis}
                    onChange={(e) => setVehiculoForm({ ...vehiculoForm, chasis: e.target.value })}
                    placeholder="Serial chasis"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fecha Matrícula</Label>
                  <Input
                    type="date"
                    value={vehiculoForm.fechaMatricula}
                    onChange={(e) => setVehiculoForm({ ...vehiculoForm, fechaMatricula: e.target.value })}
                  />
                </div>
              </div>

              {/* Manual fields */}
              <div className="border-t pt-4">
                <p className="text-sm font-medium text-muted-foreground mb-3">Campos adicionales</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Color</Label>
                  <Input
                    value={vehiculoForm.color}
                    onChange={(e) => setVehiculoForm({ ...vehiculoForm, color: e.target.value })}
                    placeholder="Color"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Carrocería</Label>
                  <Select
                    value={vehiculoForm.carroceria}
                    onValueChange={(value) => setVehiculoForm({ ...vehiculoForm, carroceria: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione" />
                    </SelectTrigger>
                    <SelectContent>
                      {CARROCERIA_OPTIONS.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Modalidad</Label>
                  <Select
                    value={vehiculoForm.modalidad}
                    onValueChange={(value) => setVehiculoForm({ ...vehiculoForm, modalidad: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione" />
                    </SelectTrigger>
                    <SelectContent>
                      {MODALIDAD_OPTIONS.map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Combustible</Label>
                  <Select
                    value={vehiculoForm.combustible}
                    onValueChange={(value) => setVehiculoForm({ ...vehiculoForm, combustible: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COMBUSTIBLE_OPTIONS.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Cilindraje</Label>
                  <Input
                    value={vehiculoForm.cilindraje}
                    onChange={(e) => setVehiculoForm({ ...vehiculoForm, cilindraje: e.target.value })}
                    placeholder="Cilindraje"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Capacidad Pasajeros</Label>
                  <Input
                    type="number"
                    value={vehiculoForm.capacidadPasajeros}
                    onChange={(e) => setVehiculoForm({ ...vehiculoForm, capacidadPasajeros: e.target.value })}
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Número Interno</Label>
                  <Input
                    value={vehiculoForm.numeroInterno}
                    onChange={(e) => setVehiculoForm({ ...vehiculoForm, numeroInterno: e.target.value })}
                    placeholder="Número interno"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Kilometraje Actual</Label>
                  <Input
                    type="number"
                    value={vehiculoForm.kilometrajeActual}
                    onChange={(e) => setVehiculoForm({ ...vehiculoForm, kilometrajeActual: e.target.value })}
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Fecha Afiliación</Label>
                  <Input
                    type="date"
                    value={vehiculoForm.fechaAfiliacion}
                    onChange={(e) => setVehiculoForm({ ...vehiculoForm, fechaAfiliacion: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <Select
                    value={vehiculoForm.estado}
                    onValueChange={(value) => setVehiculoForm({ ...vehiculoForm, estado: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ESTADO_OPTIONS.map((e) => (
                        <SelectItem key={e} value={e}>{e}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {isAdmin && !editingVehiculo && (
                <div className="space-y-2">
                  <Label>Empresa afiliadora *</Label>
                  <Select value={createEmpresa} onValueChange={setCreateEmpresa}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione la empresa" />
                    </SelectTrigger>
                    <SelectContent>
                      {empresasList.map((e) => (
                        <SelectItem key={e._id} value={e._id}>{e.razonSocial}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label>Propietario *</Label>
                <Select
                  value={vehiculoForm.propietario}
                  onValueChange={(value) => setVehiculoForm({ ...vehiculoForm, propietario: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione un propietario" />
                  </SelectTrigger>
                  <SelectContent>
                    {terceros?.map((t) => (
                      <SelectItem key={t._id} value={t._id}>
                        {t.nombres} {t.apellidos} - {t.identificacion}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancelar
              </Button>
              <Button
                onClick={() => editingVehiculo
                  ? updateVehiculoMutation.mutate(editingVehiculo._id)
                  : createVehiculoMutation.mutate()
                }
                disabled={
                  createVehiculoMutation.isPending ||
                  updateVehiculoMutation.isPending ||
                  !vehiculoForm.placa ||
                  (isAdmin && !editingVehiculo && !createEmpresa)
                }
              >
                {(createVehiculoMutation.isPending || updateVehiculoMutation.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingVehiculo ? "Guardar Cambios" : "Crear Vehículo"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageContainer>
    </DashboardLayout>
  );
}

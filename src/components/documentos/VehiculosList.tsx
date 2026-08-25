import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { getVehiculos, getTercerosByEmpresa, createVehiculo } from "@/services/apirndc";
import { useSessionState } from "@/hooks/useSessionState";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, ArrowLeft, Car, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CellviPlacaCombobox } from "@/components/documentos/CellviPlacaCombobox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { toast } from "sonner";

const COMBUSTIBLE_OPTIONS = ["GASOLINA", "DIESEL", "GAS", "HIBRIDO", "ELECTRICO"];
const ESTADO_OPTIONS = ["ACTIVO", "MANTENIMIENTO", "INACTIVO", "RETIRADO"];
const CARROCERIA_OPTIONS = ["CERRADA", "ABIERTA", "FURGON", "VOLQUETA", "PLATAFORMA"];
const MODALIDAD_OPTIONS = ["ESPECIAL", "PUBLICO", "PRIVADO", "CARGA", "MIXTO"];

interface VehiculoAPI {
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
  empresaAfiliadora: string;
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

interface VehiculosListProps {
  onSelectVehiculo: (id: string) => void;
  onBack: () => void;
}

const initialForm = {
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

function getPropietarioName(prop: VehiculoAPI["propietario"]): string {
  if (!prop) return "-";
  if (typeof prop === "string") return prop;
  return `${prop.nombres} ${prop.apellidos}`;
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

export function VehiculosList({ onSelectVehiculo, onBack }: VehiculosListProps) {
  const queryClient = useQueryClient();
  const { user, empresaId, bearerToken, cellviToken, role } = useAuth();
  const isAdmin = role === "admin";
  const [searchTerm, setSearchTerm] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [showForm, setShowForm, clearShowForm] = useSessionState("veh-doc-create", false);
  const [vehiculoForm, setVehiculoForm, clearVehiculoForm] = useSessionState("veh-doc-form", initialForm);
  const [loadingCellvi, setLoadingCellvi] = useState(false);
  // Opciones de placa (id + placa) para el selector de Cellvi
  const [cellviPlateOptions, setCellviPlateOptions] = useState<{ id: string; placa: string }[]>([]);
  // Caché de los detalles de cada vehículo Cellvi (respuesta de /show), llenada on-demand
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [cellviVehiclesData, setCellviVehiclesData] = useState<Record<string, any>>({});

  const cellviVehiculos = user?.vehiculos || [];

  // Cargar las placas del selector al abrir el diálogo:
  // - Admin: TODOS los vehículos de Cellvi (/cellvi/vehiculo/flat/list)
  // - Otros roles: solo los vehículos asignados al usuario (user.vehiculos)
  useEffect(() => {
    if (!showForm) return;
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
  }, [showForm, cellviToken, isAdmin]);

  const handleSelectCellviPlaca = async (cellviId: string) => {
    const opt = cellviPlateOptions.find((o) => o.id === cellviId);
    // Refleja la selección de inmediato (la placa al menos)
    setVehiculoForm((f) => ({ ...f, cellviId, placa: opt?.placa || f.placa }));

    // Detalles on-demand (cacheados) para auto-completar el resto del formulario
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

  // Fetch vehiculos from API
  const { data: vehiculos, isLoading } = useQuery({
    queryKey: ["vehiculos-list"],
    queryFn: async ({ signal }) => {
      // limit alto: la lista pagina/busca en cliente, así que traemos todos los vehículos
      // (el backend devuelve 50 por defecto y dejaría fuera los recién creados).
      const result = await getVehiculos({ limit: 1000 }, signal);
      return (result.data ?? []) as unknown as VehiculoAPI[];
    },
    enabled: !!bearerToken,
  });

  // Fetch terceros for propietario select — filtered by empresa
  const { data: terceros } = useQuery({
    queryKey: ["terceros-list", empresaId],
    queryFn: async ({ signal }) => {
      if (!empresaId) throw new Error("No se encontró empresa");
      const result = await getTercerosByEmpresa(empresaId, signal);
      return (result.data ?? []) as unknown as TerceroOption[];
    },
    enabled: !!bearerToken && !!empresaId,
  });

  // Create vehiculo mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!bearerToken) throw new Error("No autenticado");
      if (!empresaId) throw new Error("No se encontró empresa. Cierre sesión e inicie sesión de nuevo.");

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
        empresaAfiliadora: empresaId,
        fechaAfiliacion: vehiculoForm.fechaAfiliacion,
        estado: vehiculoForm.estado,
        kilometrajeActual: Number(vehiculoForm.kilometrajeActual) || 0,
      };

      // Vía el cliente con refresco automático de sesión: si el token venció
      // (pestaña en segundo plano, móvil suspendido) reintenta con uno nuevo
      // en vez de fallar con "Token no proporcionado".
      return createVehiculo(body);
    },
    onSuccess: () => {
      toast.success("Vehículo creado exitosamente");
      queryClient.invalidateQueries({ queryKey: ["vehiculos-list"] });
      setShowForm(false);
      clearVehiculoForm();
      clearShowForm();
      setCellviVehiclesData({});
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const filteredVehiculos = vehiculos?.filter((v) => {
    const search = searchTerm.toLowerCase();
    const matchSearch =
      v.placa?.toLowerCase().includes(search) ||
      v.marca?.toLowerCase().includes(search) ||
      v.linea?.toLowerCase().includes(search) ||
      v.numeroInterno?.toLowerCase().includes(search);
    const matchEstado = filtroEstado === "todos" || v.estado === filtroEstado;
    return matchSearch && matchEstado;
  });

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <Button variant="ghost" onClick={onBack} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Button>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por placa, marca..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filtroEstado} onValueChange={setFiltroEstado}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {ESTADO_OPTIONS.map((e) => (
                  <SelectItem key={e} value={e}>{e}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => setShowForm(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Agregar Vehículo
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredVehiculos?.length === 0 ? (
          <div className="text-center py-12 bg-card border rounded-lg">
            <Car className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">No se encontraron vehículos</p>
            <Button onClick={() => setShowForm(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Agregar primer vehículo
            </Button>
          </div>
        ) : (
          <div className="bg-card border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Placa</TableHead>
                  <TableHead>Marca / Línea</TableHead>
                  <TableHead>Modelo</TableHead>
                  <TableHead>Clase</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Propietario</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVehiculos?.map((v) => (
                  <TableRow
                    key={v._id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => onSelectVehiculo(v._id)}
                  >
                    <TableCell className="font-bold">{v.placa}</TableCell>
                    <TableCell>{v.marca} {v.linea}</TableCell>
                    <TableCell>{v.modelo}</TableCell>
                    <TableCell>{v.claseVehiculo || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={getEstadoBadgeVariant(v.estado) as "default" | "secondary" | "outline" | "destructive"}>
                        {v.estado}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {getPropietarioName(v.propietario)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Create Vehiculo Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Crear Nuevo Vehículo</DialogTitle>
            <DialogDescription>
              Seleccione una placa de Cellvi para auto-completar los datos, luego complete los campos faltantes.
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

            {/* Auto-filled fields */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Placa</Label>
                <Input value={vehiculoForm.placa} onChange={(e) => setVehiculoForm({ ...vehiculoForm, placa: e.target.value })} placeholder="ABC123" />
              </div>
              <div className="space-y-2">
                <Label>Marca</Label>
                <Input value={vehiculoForm.marca} onChange={(e) => setVehiculoForm({ ...vehiculoForm, marca: e.target.value })} placeholder="Marca" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Línea</Label>
                <Input value={vehiculoForm.linea} onChange={(e) => setVehiculoForm({ ...vehiculoForm, linea: e.target.value })} placeholder="Línea" />
              </div>
              <div className="space-y-2">
                <Label>Modelo (Año)</Label>
                <Input type="number" value={vehiculoForm.modelo} onChange={(e) => setVehiculoForm({ ...vehiculoForm, modelo: e.target.value })} placeholder="2024" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Clase de Vehículo</Label>
                <Input value={vehiculoForm.claseVehiculo} onChange={(e) => setVehiculoForm({ ...vehiculoForm, claseVehiculo: e.target.value })} placeholder="Clase" />
              </div>
              <div className="space-y-2">
                <Label>Motor</Label>
                <Input value={vehiculoForm.motor} onChange={(e) => setVehiculoForm({ ...vehiculoForm, motor: e.target.value })} placeholder="Serial motor" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Chasis</Label>
                <Input value={vehiculoForm.chasis} onChange={(e) => setVehiculoForm({ ...vehiculoForm, chasis: e.target.value })} placeholder="Serial chasis" />
              </div>
              <div className="space-y-2">
                <Label>Fecha Matrícula</Label>
                <Input type="date" value={vehiculoForm.fechaMatricula} onChange={(e) => setVehiculoForm({ ...vehiculoForm, fechaMatricula: e.target.value })} />
              </div>
            </div>

            <div className="border-t pt-4">
              <p className="text-sm font-medium text-muted-foreground mb-3">Campos adicionales</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Color</Label>
                <Input value={vehiculoForm.color} onChange={(e) => setVehiculoForm({ ...vehiculoForm, color: e.target.value })} placeholder="Color" />
              </div>
              <div className="space-y-2">
                <Label>Carrocería</Label>
                <Select value={vehiculoForm.carroceria} onValueChange={(value) => setVehiculoForm({ ...vehiculoForm, carroceria: value })}>
                  <SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger>
                  <SelectContent>
                    {CARROCERIA_OPTIONS.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Modalidad</Label>
                <Select value={vehiculoForm.modalidad} onValueChange={(value) => setVehiculoForm({ ...vehiculoForm, modalidad: value })}>
                  <SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger>
                  <SelectContent>
                    {MODALIDAD_OPTIONS.map((m) => (<SelectItem key={m} value={m}>{m}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Combustible</Label>
                <Select value={vehiculoForm.combustible} onValueChange={(value) => setVehiculoForm({ ...vehiculoForm, combustible: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COMBUSTIBLE_OPTIONS.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Cilindraje</Label>
                <Input value={vehiculoForm.cilindraje} onChange={(e) => setVehiculoForm({ ...vehiculoForm, cilindraje: e.target.value })} placeholder="Cilindraje" />
              </div>
              <div className="space-y-2">
                <Label>Capacidad Pasajeros</Label>
                <Input type="number" value={vehiculoForm.capacidadPasajeros} onChange={(e) => setVehiculoForm({ ...vehiculoForm, capacidadPasajeros: e.target.value })} placeholder="0" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Número Interno (opcional)</Label>
                <Input value={vehiculoForm.numeroInterno} onChange={(e) => setVehiculoForm({ ...vehiculoForm, numeroInterno: e.target.value })} placeholder="Número interno" />
              </div>
              <div className="space-y-2">
                <Label>Kilometraje Actual</Label>
                <Input type="number" min={0} max={2000000} value={vehiculoForm.kilometrajeActual} onChange={(e) => setVehiculoForm({ ...vehiculoForm, kilometrajeActual: e.target.value })} placeholder="0" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Fecha Afiliación</Label>
                <Input type="date" value={vehiculoForm.fechaAfiliacion} onChange={(e) => setVehiculoForm({ ...vehiculoForm, fechaAfiliacion: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Estado</Label>
                <Select value={vehiculoForm.estado} onValueChange={(value) => setVehiculoForm({ ...vehiculoForm, estado: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ESTADO_OPTIONS.map((e) => (<SelectItem key={e} value={e}>{e}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Propietario *</Label>
              <Select value={vehiculoForm.propietario} onValueChange={(value) => setVehiculoForm({ ...vehiculoForm, propietario: value })}>
                <SelectTrigger><SelectValue placeholder="Seleccione un propietario" /></SelectTrigger>
                <SelectContent>
                  {terceros?.map((t) => (
                    <SelectItem key={t._id} value={t._id}>{t.nombres} {t.apellidos} - {t.identificacion}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !vehiculoForm.cellviId || !vehiculoForm.placa || !vehiculoForm.propietario}
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Crear Vehículo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

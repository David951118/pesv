import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useSessionState } from "@/hooks/useSessionState";
import { useAuth } from "@/hooks/useAuth";
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
} from "lucide-react";

const ITEMS_PER_PAGE = 10;

interface TerceroData {
  _id: string;
  identificacion: string;
  tipoId: string;
  nombres: string;
  apellidos: string;
  roles: string[];
  usuarioCellvi: string;
  fotoUrl?: string;
  contacto?: { telefono?: string };
  datosConductor?: { tipoSangre?: string };
  empresa?: string | { _id: string; razonSocial: string };
  estado?: string;
}

function getRolLabel(rol: string): string {
  const labels: Record<string, string> = {
    CONDUCTOR: "Conductor",
    PROPIETARIO: "Propietario",
    CLIENTE: "Cliente",
    ADMINISTRATIVO: "Administrativo",
    PROVEEDOR: "Proveedor",
  };
  return labels[rol] || rol;
}

export default function Usuarios() {
  const queryClient = useQueryClient();
  const { empresaId, bearerToken, role } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialUserId = searchParams.get("user");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [showList, setShowList] = useState(!!initialUserId); // start on dashboard unless deep-linking

  const [showCreateDialog, setShowCreateDialog, clearCreateDialog] = useSessionState("usr-create-open", false);
  const [viewingUser, setViewingUser] = useState<TerceroData | null>(null);

  const [terceroForm, setTerceroForm, clearTerceroForm] = useSessionState("usr-tercero-form", {
    identificacion: "",
    tipoId: "CC",
    nombres: "",
    apellidos: "",
    rol: "CONDUCTOR",
    usuarioCellvi: "",
    fotoUrl: "",
    telefono: "",
    tipoSangre: "",
    empresaId: "",
  });
  const [empresaPopoverOpen, setEmpresaPopoverOpen] = useState(false);

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
    if (!empresa) return "—";
    if (typeof empresa === "object") return empresa.razonSocial;
    const found = empresasList?.find((e) => e._id === empresa);
    return found?.razonSocial || empresa;
  };

  // Fetch terceros — admin gets all, supervisor gets empresa-filtered
  const { data: terceros, isLoading, error } = useQuery({
    queryKey: ["terceros-list", isAdmin ? "all" : empresaId],
    queryFn: async () => {
      if (!bearerToken) throw new Error("No autenticado");
      const base = getApiRndcBaseUrl();
      const url = isAdmin
        ? `${base}/api/terceros`
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

  // Create tercero mutation
  const createTerceroMutation = useMutation({
    mutationFn: async () => {
      if (!bearerToken) throw new Error("No autenticado");
      const targetEmpresa = isAdmin ? terceroForm.empresaId : empresaId;
      if (!targetEmpresa) throw new Error(isAdmin ? "Seleccione una empresa" : "No se encontró empresa. Cierre sesión e inicie sesión de nuevo.");

      const body: Record<string, unknown> = {
        identificacion: terceroForm.identificacion,
        tipoId: terceroForm.tipoId,
        empresa: targetEmpresa,
        nombres: terceroForm.nombres,
        apellidos: terceroForm.apellidos,
        roles: [terceroForm.rol],
        usuarioCellvi: terceroForm.usuarioCellvi,
        fotoUrl: terceroForm.fotoUrl || undefined,
        contacto: {
          telefono: terceroForm.telefono,
        },
      };

      if (terceroForm.rol === "CONDUCTOR" && terceroForm.tipoSangre) {
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
      return result;
    },
    onSuccess: () => {
      toast.success("Tercero creado exitosamente");
      queryClient.invalidateQueries({ queryKey: ["terceros-list"] });
      setShowCreateDialog(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const resetForm = () => {
    clearTerceroForm();
    clearCreateDialog();
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
    const fullName = `${t.nombres} ${t.apellidos}`.toLowerCase();
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
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

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
              <Button variant="ghost" onClick={() => { handleViewUser(null); }} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Volver al listado
              </Button>

              {/* Tercero header */}
              <div className="bg-muted/30 border rounded-lg p-6">
                <div className="flex items-start gap-4">
                  {viewingUser.fotoUrl ? (
                    <img
                      src={viewingUser.fotoUrl}
                      alt={`${viewingUser.nombres} ${viewingUser.apellidos}`}
                      className="h-20 w-20 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="h-20 w-20 rounded-lg bg-primary/10 flex items-center justify-center">
                      <User className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold text-foreground">
                      {viewingUser.nombres} {viewingUser.apellidos}
                    </h2>
                    <p className="text-muted-foreground">
                      {viewingUser.tipoId} {viewingUser.identificacion}
                    </p>
                    <div className="flex gap-2 mt-2">
                      {viewingUser.roles?.map((rol) => (
                        <Badge key={rol} variant="secondary">
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
                  <p className="font-medium">{viewingUser.usuarioCellvi}</p>
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
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedTerceros.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={isAdmin ? 6 : 5} className="text-center py-8 text-muted-foreground">
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
                                    {tercero.nombres} {tercero.apellidos}
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
                              </TableCell>
                              {isAdmin && (
                                <TableCell>
                                  <span className="text-sm">
                                    {getEmpresaName(tercero.empresa)}
                                  </span>
                                </TableCell>
                              )}
                              <TableCell>
                                <span className="text-sm">{tercero.usuarioCellvi}</span>
                              </TableCell>
                              <TableCell>
                                <span className="text-sm text-muted-foreground">
                                  {tercero.contacto?.telefono || "-"}
                                </span>
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

        {/* Create Tercero Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Crear Nuevo Tercero</DialogTitle>
              <DialogDescription>
                Complete los datos para registrar un nuevo tercero en el sistema.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Rol *</Label>
                <Select
                  value={terceroForm.rol}
                  onValueChange={(value) => setTerceroForm({ ...terceroForm, rol: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CONDUCTOR">Conductor</SelectItem>
                    <SelectItem value="PROPIETARIO">Propietario</SelectItem>
                    <SelectItem value="CLIENTE">Cliente</SelectItem>
                    <SelectItem value="ADMINISTRATIVO">Administrativo</SelectItem>
                    <SelectItem value="PROVEEDOR">Proveedor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {isAdmin && (
                <div className="space-y-2">
                  <Label>Empresa *</Label>
                  <Popover open={empresaPopoverOpen} onOpenChange={setEmpresaPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={empresaPopoverOpen}
                        className="w-full justify-between font-normal"
                      >
                        <span className="truncate">
                          {terceroForm.empresaId
                            ? empresasList?.find((e) => e._id === terceroForm.empresaId)?.razonSocial ?? "Empresa seleccionada"
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
                                  setTerceroForm({ ...terceroForm, empresaId: emp._id });
                                  setEmpresaPopoverOpen(false);
                                }}
                              >
                                <Check
                                  className={`mr-2 h-4 w-4 ${terceroForm.empresaId === emp._id ? "opacity-100" : "opacity-0"}`}
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
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Nombres *</Label>
                  <Input
                    value={terceroForm.nombres}
                    onChange={(e) => setTerceroForm({ ...terceroForm, nombres: e.target.value })}
                    placeholder="Nombres"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Apellidos *</Label>
                  <Input
                    value={terceroForm.apellidos}
                    onChange={(e) => setTerceroForm({ ...terceroForm, apellidos: e.target.value })}
                    placeholder="Apellidos"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Tipo Documento *</Label>
                  <Select
                    value={terceroForm.tipoId}
                    onValueChange={(value) => setTerceroForm({ ...terceroForm, tipoId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CC">CC - Cédula</SelectItem>
                      <SelectItem value="CE">CE - Cédula Extranjería</SelectItem>
                      <SelectItem value="NIT">NIT</SelectItem>
                      <SelectItem value="TI">TI - Tarjeta Identidad</SelectItem>
                      <SelectItem value="PA">PA - Pasaporte</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Identificación *</Label>
                  <Input
                    value={terceroForm.identificacion}
                    onChange={(e) => setTerceroForm({ ...terceroForm, identificacion: e.target.value })}
                    placeholder="Número de documento"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Usuario Cellvi *</Label>
                <Input
                  value={terceroForm.usuarioCellvi}
                  onChange={(e) => setTerceroForm({ ...terceroForm, usuarioCellvi: e.target.value })}
                  placeholder="Usuario Cellvi"
                />
              </div>
              <div className="space-y-2">
                <Label>Teléfono</Label>
                <Input
                  value={terceroForm.telefono}
                  onChange={(e) => setTerceroForm({ ...terceroForm, telefono: e.target.value })}
                  placeholder="Número de teléfono"
                />
              </div>
              <div className="space-y-2">
                <Label>Foto URL</Label>
                <Input
                  value={terceroForm.fotoUrl}
                  onChange={(e) => setTerceroForm({ ...terceroForm, fotoUrl: e.target.value })}
                  placeholder="https://..."
                />
              </div>
              {terceroForm.rol === "CONDUCTOR" && (
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
                onClick={() => createTerceroMutation.mutate()}
                disabled={
                  createTerceroMutation.isPending ||
                  !terceroForm.identificacion ||
                  !terceroForm.nombres ||
                  !terceroForm.apellidos ||
                  !terceroForm.usuarioCellvi ||
                  (isAdmin && !terceroForm.empresaId)
                }
              >
                {createTerceroMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Crear Tercero
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageContainer>
    </DashboardLayout>
  );
}

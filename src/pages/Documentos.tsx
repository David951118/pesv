import { useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { ModuleHeader } from "@/components/layout/ModuleHeader";
import { HojaVidaVehiculo } from "@/components/documentos/HojaVidaVehiculo";
import { DocumentosStats } from "@/components/documentos/DocumentosStats";
import { DocumentosFilters, type DocumentosFilterValues } from "@/components/documentos/DocumentosFilters";
import { DocumentosTable } from "@/components/documentos/DocumentosTable";
import { DocumentoFormDialog } from "@/components/documentos/DocumentoFormDialog";
import { DocumentoDetailDialog } from "@/components/documentos/DocumentoDetailDialog";
import { useAuth } from "@/hooks/useAuth";
import { getApiRndcBaseUrl } from "@/services/apirndc/apirndc.config";
import { Car, FileText, FolderOpen, Loader2, History, Search, X, Eye, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { ApiRndcDocumento } from "@/services/apirndc/apirndc.types";

type Tab = "documentos" | "vehiculos" | "historial";

export default function Documentos() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { role, bearerToken } = useAuth();
  // Tanto admin como cliente-admin (supervisor) pueden borrar documentos:
  // el backend ya autoriza ambos roles. Mantenemos el nombre isAdmin
  // para no propagar el cambio en cascada por toda la pagina.
  const isAdmin = role === "admin" || role === "supervisor";
  const queryClient = useQueryClient();

  // Tab state — support legacy ?section=vehiculos URLs
  const sectionParam = searchParams.get("section");
  const tabParam = searchParams.get("tab");
  const initialTab: Tab = sectionParam === "vehiculos" || tabParam === "vehiculos" ? "vehiculos" : sectionParam === "historial" || tabParam === "historial" ? "historial" : "documentos";
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [historialSearch, setHistorialSearch] = useState("");

  // Vehiculo sub-navigation state
  const initialId = searchParams.get("id");

  // Filters
  const [filters, setFilters] = useState<DocumentosFilterValues>({
    search: "",
    entidadModelo: "todos",
    estado: "todos",
    tipoDocumento: "todos",
    empresaId: "todos",
  });
  const [page, setPage] = useState(1);
  const limit = 20;

  // Dialogs
  const [showForm, setShowForm] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<ApiRndcDocumento | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  // Build query params
  const queryParams: Record<string, string | number> = { page, limit };
  if (filters.entidadModelo !== "todos") queryParams.entidadModelo = filters.entidadModelo;
  if (filters.estado !== "todos") queryParams.estado = filters.estado;
  if (filters.tipoDocumento !== "todos") queryParams.tipoDocumento = filters.tipoDocumento;
  if (filters.empresaId !== "todos") queryParams.empresaId = filters.empresaId;

  // Fetch documents with bearer token
  const { data, isLoading } = useQuery({
    queryKey: ["documentos-list", queryParams],
    queryFn: async () => {
      if (!bearerToken) return { data: [] as ApiRndcDocumento[], pagination: undefined };
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(queryParams)) {
        params.set(k, String(v));
      }
      const res = await fetch(`${getApiRndcBaseUrl()}/api/documentos?${params.toString()}`, {
        headers: { Authorization: `Bearer ${bearerToken}` },
      });
      if (!res.ok) return { data: [] as ApiRndcDocumento[], pagination: undefined };
      const json = await res.json();
      return {
        data: (json.data ?? []) as ApiRndcDocumento[],
        pagination: json.pagination as { page: number; limit: number; total: number; pages: number } | undefined,
      };
    },
    enabled: !!bearerToken,
  });

  // Client-side search filter
  const allDocs = data?.data ?? [];
  const filteredDocs = filters.search
    ? allDocs.filter((d) => {
        const s = filters.search.toLowerCase();
        return (
          d.tipoDocumento?.toLowerCase().includes(s) ||
          d.numero?.toLowerCase().includes(s) ||
          d.entidadEmisora?.toLowerCase().includes(s)
        );
      })
    : allDocs;

  // Tab navigation
  const switchTab = useCallback((tab: Tab) => {
    setActiveTab(tab);
    if (tab === "vehiculos" || tab === "historial") {
      setSearchParams({ section: tab }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  }, [setSearchParams]);

  const handleVehiculoBack = () => switchTab("documentos");

  const handleSelectedIdChange = useCallback((id: string | null) => {
    const params: Record<string, string> = { section: "vehiculos" };
    if (id) params.id = id;
    setSearchParams(params, { replace: true });
  }, [setSearchParams]);

  // Document actions
  const handleView = (doc: ApiRndcDocumento) => {
    setSelectedDoc(doc);
    setShowDetail(true);
  };

  const handleEdit = (doc: ApiRndcDocumento) => {
    setSelectedDoc(doc);
    setShowForm(true);
  };

  const handleCreate = () => {
    setSelectedDoc(null);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!bearerToken) return;
    try {
      const res = await fetch(`${getApiRndcBaseUrl()}/api/documentos/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${bearerToken}` },
      });
      if (!res.ok) throw new Error(`Error: ${res.status}`);
      toast.success("Documento eliminado exitosamente");
      queryClient.invalidateQueries({ queryKey: ["documentos-list"] });
      queryClient.invalidateQueries({ queryKey: ["documentos-historial"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar");
    }
  };

  const handleFormSuccess = () => {
    setSelectedDoc(null);
    queryClient.invalidateQueries({ queryKey: ["documentos-list"] });
    queryClient.invalidateQueries({ queryKey: ["documentos-historial"] });
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  // Historial query - groups docs by tipoDocumento showing all versions
  const { data: historialData, isLoading: loadingHistorial } = useQuery({
    queryKey: ["documentos-historial"],
    queryFn: async () => {
      if (!bearerToken) return [];
      const res = await fetch(`${getApiRndcBaseUrl()}/api/documentos?limit=500`, {
        headers: { Authorization: `Bearer ${bearerToken}` },
      });
      if (!res.ok) return [];
      const json = await res.json();
      return (json.data ?? []) as ApiRndcDocumento[];
    },
    enabled: !!bearerToken && activeTab === "historial",
  });

  // Group historial by entidad + tipoDocumento, with optional search filter on entidad,
  // tipoDocumento o numero de cualquier version del grupo.
  const historialGroups = (() => {
    if (!historialData) return [];
    const map = new Map<string, { entidad: string; tipo: string; docs: ApiRndcDocumento[] }>();
    for (const doc of historialData) {
      const entidadId = typeof doc.entidad === "object" ? (doc.entidad as any)?._id : doc.entidad;
      const entidadNombre = typeof doc.entidad === "object"
        ? (doc.entidad as any)?.placa || (doc.entidad as any)?.nombres || (doc.entidad as any)?.razonSocial || entidadId
        : entidadId;
      const key = `${entidadId}-${doc.tipoDocumento}`;
      if (!map.has(key)) {
        map.set(key, { entidad: entidadNombre || "—", tipo: doc.tipoDocumento || "—", docs: [] });
      }
      map.get(key)!.docs.push(doc);
    }
    for (const [, group] of map) {
      group.docs.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    }
    const all = Array.from(map.values()).filter(g => g.docs.length > 0).sort((a, b) => a.entidad.localeCompare(b.entidad));
    const q = historialSearch.trim().toLowerCase();
    if (!q) return all;
    return all.filter((g) => {
      if (g.entidad.toLowerCase().includes(q)) return true;
      if (g.tipo.toLowerCase().replace(/_/g, " ").includes(q)) return true;
      return g.docs.some((d) => (d.numero || "").toLowerCase().includes(q));
    });
  })();

  const tabs = [
    { id: "documentos" as Tab, label: "Todos los Documentos", icon: FileText },
    { id: "vehiculos" as Tab, label: "Hoja de Vida Vehiculo", icon: Car },
    { id: "historial" as Tab, label: "Historial", icon: History },
  ];

  return (
    <DashboardLayout>
      <PageContainer>
        <ModuleHeader
          title="Documentos"
          description="Gestion documental integral"
          icon={FolderOpen}
          iconVariant="primary"
        />

        {/* Tab bar */}
        <div className="flex gap-1 border-b border-border mb-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => switchTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        {activeTab === "documentos" && (
          <div className="space-y-6">
            <DocumentosStats />
            <DocumentosFilters
              filters={filters}
              onFilterChange={(f) => { setFilters(f); setPage(1); }}
              onCreateClick={handleCreate}
              isAdmin={isAdmin}
            />
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <DocumentosTable
                documentos={filteredDocs}
                pagination={data?.pagination}
                onPageChange={handlePageChange}
                onView={handleView}
                onEdit={handleEdit}
                onDelete={handleDelete}
                isAdmin={isAdmin}
              />
            )}
          </div>
        )}

        {activeTab === "vehiculos" && (
          <HojaVidaVehiculo
            onBack={handleVehiculoBack}
            initialSelectedId={initialId}
            onSelectedIdChange={handleSelectedIdChange}
          />
        )}

        {activeTab === "historial" && (
          <div className="space-y-4">
            {/* Filtro de busqueda */}
            <div className="bg-card border rounded-lg p-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={historialSearch}
                  onChange={(e) => setHistorialSearch(e.target.value)}
                  placeholder="Buscar por entidad (placa, nombre, NIT), tipo de documento o numero..."
                  className="pl-9 pr-9"
                />
                {historialSearch && (
                  <button
                    type="button"
                    onClick={() => setHistorialSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-muted"
                    aria-label="Limpiar busqueda"
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                )}
              </div>
            </div>

            {loadingHistorial ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : historialGroups.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <History className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p className="font-medium">
                  {historialSearch ? "Sin resultados para esa busqueda" : "No hay documentos con historial"}
                </p>
              </div>
            ) : (
              historialGroups.map((group, idx) => (
                <div key={idx} className="bg-card border rounded-lg overflow-hidden">
                  <div className="px-4 py-3 bg-muted/30 border-b flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-sm">{group.entidad}</span>
                    <Badge variant="secondary" className="ml-2">{group.tipo}</Badge>
                    <span className="text-xs text-muted-foreground ml-auto">{group.docs.length} version{group.docs.length !== 1 ? "es" : ""}</span>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Numero</TableHead>
                        <TableHead>Fecha Expedicion</TableHead>
                        <TableHead>Fecha Vencimiento</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Entidad Emisora</TableHead>
                        <TableHead>Creado</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.docs.map((doc, i) => (
                        <TableRow
                          key={doc._id}
                          className={cn("hover:bg-muted/50", i === 0 && "bg-green-50/50 dark:bg-green-900/10")}
                        >
                          <TableCell className="font-medium text-sm">{doc.numero || "—"}</TableCell>
                          <TableCell className="text-sm">{doc.fechaExpedicion ? format(new Date(doc.fechaExpedicion), "dd MMM yyyy", { locale: es }) : "—"}</TableCell>
                          <TableCell className="text-sm">{doc.fechaVencimiento ? format(new Date(doc.fechaVencimiento), "dd MMM yyyy", { locale: es }) : "—"}</TableCell>
                          <TableCell>
                            <Badge variant={doc.estado === "VIGENTE" ? "default" : doc.estado === "POR_VENCER" ? "secondary" : "destructive"}>
                              {doc.estado?.replace("_", " ") || "—"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{doc.entidadEmisora || "—"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{doc.createdAt ? format(new Date(doc.createdAt), "dd/MM/yyyy", { locale: es }) : "—"}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" onClick={() => handleView(doc)} title="Ver detalle">
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleEdit(doc)} title="Editar">
                                <Pencil className="h-4 w-4" />
                              </Button>
                              {isAdmin && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" title="Eliminar">
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Eliminar documento</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Esta accion enviara el documento a la papelera. Podra restaurarlo posteriormente.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleDelete(doc._id)}>
                                        Eliminar
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ))
            )}
          </div>
        )}

        {/* Dialogs */}
        <DocumentoFormDialog
          open={showForm}
          onOpenChange={setShowForm}
          documento={selectedDoc}
          onSuccess={handleFormSuccess}
        />
        <DocumentoDetailDialog
          open={showDetail}
          onOpenChange={setShowDetail}
          documento={selectedDoc}
        />
      </PageContainer>
    </DashboardLayout>
  );
}

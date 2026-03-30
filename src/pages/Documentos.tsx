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
import { Car, FileText, FolderOpen, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { ApiRndcDocumento } from "@/services/apirndc/apirndc.types";

type Tab = "documentos" | "vehiculos";

export default function Documentos() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { role, bearerToken } = useAuth();
  const isAdmin = role === "admin";
  const queryClient = useQueryClient();

  // Tab state — support legacy ?section=vehiculos URLs
  const sectionParam = searchParams.get("section");
  const tabParam = searchParams.get("tab");
  const initialTab: Tab = sectionParam === "vehiculos" || tabParam === "vehiculos" ? "vehiculos" : "documentos";
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);

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
    if (tab === "vehiculos") {
      setSearchParams({ section: "vehiculos" }, { replace: true });
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
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar");
    }
  };

  const handleFormSuccess = () => {
    setSelectedDoc(null);
    queryClient.invalidateQueries({ queryKey: ["documentos-list"] });
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const tabs = [
    { id: "documentos" as Tab, label: "Todos los Documentos", icon: FileText },
    { id: "vehiculos" as Tab, label: "Hoja de Vida Vehiculo", icon: Car },
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

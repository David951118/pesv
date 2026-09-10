import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { ModuleHeader } from "@/components/layout/ModuleHeader";
import { useAuth } from "@/hooks/useAuth";
import { getApiRndcBaseUrl } from "@/services/apirndc/apirndc.config";
import {
  Trash2,
  RotateCcw,
  AlertTriangle,
  Loader2,
  Users,
  Car,
  FileText,
  Handshake,
  Building2,
  Route,
  Fuel,
  Gavel,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
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

type EntityType =
  | "empresas"
  | "terceros"
  | "vehiculos"
  | "documentos"
  | "contratos"
  | "rutas"
  | "combustible"
  | "multas";

interface DeletedItem {
  _id: string;
  displayName: string;
  displayDetail: string;
  deletedAt?: string;
}

const ENTITY_CONFIG: Record<EntityType, { label: string; icon: typeof Users; endpoint: string; skipEmpresaFilter?: boolean }> = {
  empresas: { label: "Empresas", icon: Building2, endpoint: "/api/empresas", skipEmpresaFilter: true },
  terceros: { label: "Terceros", icon: Users, endpoint: "/api/terceros" },
  vehiculos: { label: "Vehículos", icon: Car, endpoint: "/api/vehiculos" },
  documentos: { label: "Documentos", icon: FileText, endpoint: "/api/documentos" },
  contratos: { label: "Contratos", icon: Handshake, endpoint: "/api/contratos" },
  rutas: { label: "Rutas", icon: Route, endpoint: "/api/rutas", skipEmpresaFilter: true },
  combustible: {
    label: "Tanqueos",
    icon: Fuel,
    endpoint: "/api/operacion/combustible",
    skipEmpresaFilter: true,
  },
  multas: {
    label: "Multas",
    icon: Gavel,
    endpoint: "/api/multas",
    skipEmpresaFilter: true,
  },
};

function normalizeItems(entity: EntityType, data: unknown[]): DeletedItem[] {
  return data.map((item: Record<string, unknown>) => {
    let displayName = "";
    let displayDetail = "";

    switch (entity) {
      case "empresas":
        displayName = (item.razonSocial as string) || (item.nombreComercial as string) || String(item._id);
        displayDetail = (item.nit as string) || "";
        break;
      case "terceros":
        displayName = (item.nombre as string) || (item.razonSocial as string) || String(item._id);
        displayDetail = (item.documento as string) || (item.cedula as string) || "";
        break;
      case "vehiculos":
        displayName = (item.placa as string) || String(item._id);
        displayDetail = (item.marca as string) || "";
        break;
      case "documentos":
        displayName = (item.tipo as string) || (item.nombre as string) || String(item._id);
        displayDetail = (item.estado as string) || "";
        break;
      case "contratos":
        displayName = (item.numero as string) || (item.consecutivo as string) || String(item._id);
        displayDetail = (item.estado as string) || "";
        break;
      case "rutas":
        displayName =
          (item.nombre as string) ||
          [item.origen, item.destino].filter(Boolean).join(" → ") ||
          String(item._id);
        displayDetail = (item.recorrido as string) || "";
        break;
      case "combustible": {
        const veh = item.vehiculo as { placa?: string } | null;
        displayName = (item.placa as string) || veh?.placa || String(item._id);
        const galones = item.galones != null ? `${item.galones} gal` : "";
        const fecha = item.fecha
          ? new Date(item.fecha as string).toLocaleDateString("es-CO")
          : "";
        displayDetail = [galones, fecha].filter(Boolean).join(" · ");
        break;
      }
      case "multas": {
        const veh = item.vehiculo as { placa?: string } | null;
        const placa = (item.placa as string) || veh?.placa || "";
        displayName = [item.numero as string, placa].filter(Boolean).join(" · ") || String(item._id);
        const fecha = item.fecha
          ? new Date(item.fecha as string).toLocaleDateString("es-CO")
          : "";
        displayDetail = [item.descripcion as string, fecha].filter(Boolean).join(" · ");
        break;
      }
    }

    return {
      _id: item._id as string,
      displayName,
      displayDetail,
      deletedAt: item.deletedAt as string | undefined,
    };
  });
}

export default function Papelera() {
  const { bearerToken, empresaId } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<EntityType>("empresas");
  const [items, setItems] = useState<DeletedItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchDeleted = useCallback(async () => {
    if (!bearerToken) return;
    setLoading(true);
    const base = getApiRndcBaseUrl();
    const config = ENTITY_CONFIG[activeTab];

    const params = new URLSearchParams({ includeDeleted: "true", onlyDeleted: "true" });
    if (!config.skipEmpresaFilter && empresaId) {
      params.set("empresaId", empresaId);
    }
    try {
      const res = await fetch(
        `${base}${config.endpoint}?${params.toString()}`,
        { headers: { Authorization: `Bearer ${bearerToken}` } }
      );
      const json = await res.json();
      const list = json.success ? json.data : json;
      if (Array.isArray(list)) {
        // Filter only items that have deletedAt (soft-deleted)
        const deleted = (list as Record<string, unknown>[]).filter(
          (item) => !!item.deletedAt
        );
        setItems(normalizeItems(activeTab, deleted));
      } else {
        setItems([]);
      }
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [bearerToken, empresaId, activeTab]);

  useEffect(() => {
    fetchDeleted();
  }, [fetchDeleted]);

  const handleRestore = async (id: string) => {
    const base = getApiRndcBaseUrl();
    const config = ENTITY_CONFIG[activeTab];
    try {
      const res = await fetch(`${base}${config.endpoint}/${id}/restore`, {
        method: "POST",
        headers: { Authorization: `Bearer ${bearerToken}` },
      });
      const json = await res.json();
      if (json.success) {
        toast({ title: "Restaurado", description: "El registro fue restaurado exitosamente." });
        fetchDeleted();
      } else {
        toast({ title: "Error", description: json.message || "No se pudo restaurar.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Error de conexión.", variant: "destructive" });
    }
  };

  const handleHardDelete = async (id: string) => {
    const base = getApiRndcBaseUrl();
    const config = ENTITY_CONFIG[activeTab];
    try {
      const res = await fetch(`${base}${config.endpoint}/${id}/hard`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${bearerToken}` },
      });
      const json = await res.json();
      if (json.success) {
        toast({ title: "Eliminado", description: "El registro fue eliminado permanentemente." });
        fetchDeleted();
      } else {
        toast({ title: "Error", description: json.message || "No se pudo eliminar.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Error de conexión.", variant: "destructive" });
    }
  };

  const tabs: { key: EntityType; label: string; icon: typeof Users }[] = Object.entries(ENTITY_CONFIG).map(
    ([key, val]) => ({ key: key as EntityType, label: val.label, icon: val.icon })
  );

  return (
    <DashboardLayout>
      <PageContainer>
        <ModuleHeader
          title="Papelera"
          description="Registros eliminados — puedes restaurarlos o eliminarlos permanentemente"
          icon={Trash2}
          iconVariant="destructive"
        />

        {/* Tabs */}
        <div className="flex gap-2 border-b border-border pb-0">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Trash2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium">La papelera está vacía</p>
            <p className="text-sm">No hay {ENTITY_CONFIG[activeTab].label.toLowerCase()} eliminados</p>
          </div>
        ) : (
          <div className="bg-card rounded-lg border border-border overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-table-header text-foreground text-sm uppercase tracking-wider">
                  <th className="text-left px-4 py-3 font-semibold">Nombre</th>
                  <th className="text-left px-4 py-3 font-semibold">Detalle</th>
                  <th className="text-left px-4 py-3 font-semibold">Eliminado</th>
                  <th className="text-center px-4 py-3 font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item._id}
                    className="border-b border-table-border hover:bg-table-row-hover transition-colors"
                  >
                    <td className="px-4 py-3 font-medium">{item.displayName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{item.displayDetail || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground text-sm">
                      {item.deletedAt
                        ? new Date(item.deletedAt).toLocaleDateString("es-CO")
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm" className="text-success hover:text-success">
                              <RotateCcw className="h-4 w-4 mr-1" />
                              Restaurar
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Restaurar registro</AlertDialogTitle>
                              <AlertDialogDescription>
                                ¿Deseas restaurar "{item.displayName}"? El registro volverá a estar activo en el sistema.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleRestore(item._id)}>
                                Restaurar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                              <AlertTriangle className="h-4 w-4 mr-1" />
                              Eliminar
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Eliminar permanentemente</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta acción no se puede deshacer. El registro "{item.displayName}" será eliminado
                                permanentemente del sistema.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleHardDelete(item._id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Eliminar permanentemente
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PageContainer>
    </DashboardLayout>
  );
}

import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { ModuleHeader } from "@/components/layout/ModuleHeader";
import { useAuth } from "@/hooks/useAuth";
import { getApiRndcBaseUrl } from "@/services/apirndc/apirndc.config";
import { BrandingEditor } from "@/components/empresas/BrandingEditor";
import type { EmpresaBranding } from "@/hooks/useEmpresaBranding";
import {
  Building2,
  Search,
  Loader2,
  Eye,
  Plus,
  Pencil,
  Trash2,
  Palette,
  ArrowLeft,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
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

interface Empresa {
  _id: string;
  nit: string;
  razonSocial: string;
  nombreComercial?: string;
  tipoEmpresa?: string;
  estado?: string;
  createdAt?: string;
  branding?: Partial<EmpresaBranding>;
}

const emptyForm = { nit: "", razonSocial: "", nombreComercial: "" };

export default function Empresas() {
  const { bearerToken, user } = useAuth();
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Dialogs
  const [viewEmpresa, setViewEmpresa] = useState<Empresa | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editEmpresa, setEditEmpresa] = useState<Empresa | null>(null);
  const [deleteEmpresa, setDeleteEmpresa] = useState<Empresa | null>(null);

  // Branding editor
  const [brandingEmpresa, setBrandingEmpresa] = useState<Empresa | null>(null);
  const [savingBranding, setSavingBranding] = useState(false);

  // Form
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const base = getApiRndcBaseUrl();
  const headers = {
    Authorization: `Bearer ${bearerToken}`,
    "Content-Type": "application/json",
  };

  const fetchEmpresas = useCallback(async () => {
    if (!bearerToken) return;
    setLoading(true);
    try {
      const res = await fetch(`${base}/api/empresas`, {
        headers: { Authorization: `Bearer ${bearerToken}` },
      });
      const json = await res.json();
      if (json.success) {
        setEmpresas(Array.isArray(json.data) ? json.data : []);
      }
    } catch {
      toast.error("Error al cargar empresas");
    } finally {
      setLoading(false);
    }
  }, [bearerToken, base]);

  useEffect(() => {
    fetchEmpresas();
  }, [fetchEmpresas]);

  // ── Create ──

  const openCreate = () => {
    setForm(emptyForm);
    setShowCreate(true);
  };

  const handleCreate = async () => {
    if (!form.nit || !form.razonSocial) {
      toast.error("NIT y Razón Social son obligatorios");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${base}/api/empresas`, {
        method: "POST",
        headers,
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success("Empresa creada exitosamente");
        setShowCreate(false);
        fetchEmpresas();
      } else {
        toast.error(json.message || "Error al crear empresa");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSaving(false);
    }
  };

  // ── Edit ──

  const openEdit = (empresa: Empresa) => {
    setForm({
      nit: empresa.nit || "",
      razonSocial: empresa.razonSocial || "",
      nombreComercial: empresa.nombreComercial || "",
    });
    setEditEmpresa(empresa);
  };

  const handleEdit = async () => {
    if (!editEmpresa) return;
    if (!form.nit || !form.razonSocial) {
      toast.error("NIT y Razón Social son obligatorios");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${base}/api/empresas/${editEmpresa._id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success("Empresa actualizada");
        setEditEmpresa(null);
        fetchEmpresas();
      } else {
        toast.error(json.message || "Error al actualizar");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ──

  const handleDelete = async () => {
    if (!deleteEmpresa) return;
    try {
      const res = await fetch(`${base}/api/empresas/${deleteEmpresa._id}`, {
        method: "DELETE",
        headers,
        body: JSON.stringify({ deletedBy: user?.userId }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success("Empresa eliminada");
        setDeleteEmpresa(null);
        fetchEmpresas();
      } else {
        toast.error(json.message || "Error al eliminar");
      }
    } catch {
      toast.error("Error de conexión");
    }
  };

  // ── Save Branding ──

  const handleSaveBranding = async (branding: Partial<EmpresaBranding>) => {
    if (!brandingEmpresa) return;
    setSavingBranding(true);
    try {
      const res = await fetch(`${base}/api/empresas/${brandingEmpresa._id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ branding }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success("Branding guardado exitosamente");
        // Update local state
        setEmpresas((prev) =>
          prev.map((e) => (e._id === brandingEmpresa._id ? { ...e, branding } : e))
        );
        setBrandingEmpresa({ ...brandingEmpresa, branding });
      } else {
        toast.error(json.message || "Error al guardar branding");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSavingBranding(false);
    }
  };

  const filtered = empresas.filter(
    (e) =>
      e.razonSocial?.toLowerCase().includes(search.toLowerCase()) ||
      e.nit?.includes(search) ||
      e.nombreComercial?.toLowerCase().includes(search.toLowerCase())
  );

  const formFields = (prefix: string) => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`${prefix}-nit`}>NIT *</Label>
        <Input
          id={`${prefix}-nit`}
          placeholder="900123456-1"
          value={form.nit}
          onChange={(e) => setForm({ ...form, nit: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${prefix}-razonSocial`}>Razón Social *</Label>
        <Input
          id={`${prefix}-razonSocial`}
          placeholder="Mi Transporte SAS"
          value={form.razonSocial}
          onChange={(e) => setForm({ ...form, razonSocial: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${prefix}-nombreComercial`}>Nombre Comercial</Label>
        <Input
          id={`${prefix}-nombreComercial`}
          placeholder="Mi Transporte"
          value={form.nombreComercial}
          onChange={(e) => setForm({ ...form, nombreComercial: e.target.value })}
        />
      </div>
    </div>
  );

  // ── If branding editor is open, show full-page editor ──

  if (brandingEmpresa) {
    return (
      <DashboardLayout>
        <PageContainer>
          <div className="flex items-center gap-3 mb-6">
            <Button variant="ghost" size="icon" onClick={() => setBrandingEmpresa(null)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Branding — {brandingEmpresa.razonSocial}
              </h1>
              <p className="text-sm text-muted-foreground">
                NIT {brandingEmpresa.nit} · Configura los colores, logos y apariencia de esta empresa
              </p>
            </div>
          </div>

          <div className="bg-card rounded-lg border border-border p-6">
            <BrandingEditor
              initialBranding={brandingEmpresa.branding || {}}
              empresaNombre={brandingEmpresa.nombreComercial || brandingEmpresa.razonSocial}
              saving={savingBranding}
              onSave={handleSaveBranding}
            />
          </div>
        </PageContainer>
      </DashboardLayout>
    );
  }

  // ── Main list view ──

  return (
    <DashboardLayout>
      <PageContainer>
        <ModuleHeader
          title="Empresas"
          description="Gestión de empresas registradas en el sistema"
          icon={Building2}
          iconVariant="primary"
          actions={
            <div className="flex items-center gap-3">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por NIT o nombre..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Nueva Empresa
              </Button>
            </div>
          }
        />

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="bg-card rounded-lg border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-table-header text-foreground text-sm uppercase tracking-wider">
                    <th className="text-left px-4 py-3 font-semibold">Razón Social</th>
                    <th className="text-left px-4 py-3 font-semibold">NIT</th>
                    <th className="text-left px-4 py-3 font-semibold">Nombre Comercial</th>
                    <th className="text-left px-4 py-3 font-semibold">Colores</th>
                    <th className="text-left px-4 py-3 font-semibold">Estado</th>
                    <th className="text-center px-4 py-3 font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-muted-foreground">
                        No se encontraron empresas
                      </td>
                    </tr>
                  ) : (
                    filtered.map((empresa) => {
                      const b = empresa.branding;
                      return (
                        <tr
                          key={empresa._id}
                          className="border-b border-table-border hover:bg-table-row-hover transition-colors"
                        >
                          <td className="px-4 py-3 font-medium">{empresa.razonSocial}</td>
                          <td className="px-4 py-3 text-muted-foreground">{empresa.nit}</td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {empresa.nombreComercial || "—"}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <div
                                className="w-5 h-5 rounded-full border border-border"
                                style={{ backgroundColor: b?.colorPrimary || "#0B5EA8" }}
                                title={`Principal: ${b?.colorPrimary || "#0B5EA8"}`}
                              />
                              <div
                                className="w-5 h-5 rounded-full border border-border"
                                style={{ backgroundColor: b?.colorPrimaryDark || "#0A2E52" }}
                                title={`Oscuro: ${b?.colorPrimaryDark || "#0A2E52"}`}
                              />
                              <div
                                className="w-5 h-5 rounded-full border border-border"
                                style={{ backgroundColor: b?.colorAccent || "#FFD400" }}
                                title={`Acento: ${b?.colorAccent || "#FFD400"}`}
                              />
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="status-badge status-active">
                              {empresa.estado || "Activa"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                title="Ver detalle"
                                onClick={() => setViewEmpresa(empresa)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                title="Editar datos"
                                onClick={() => openEdit(empresa)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-primary hover:text-primary"
                                title="Configurar branding"
                                onClick={() => setBrandingEmpresa(empresa)}
                              >
                                <Palette className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                title="Eliminar"
                                onClick={() => setDeleteEmpresa(empresa)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── View Dialog ── */}
        <Dialog open={!!viewEmpresa} onOpenChange={() => setViewEmpresa(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{viewEmpresa?.razonSocial}</DialogTitle>
              <DialogDescription>Detalle de la empresa</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">NIT:</span>
                <span className="font-medium">{viewEmpresa?.nit}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Razón Social:</span>
                <span className="font-medium">{viewEmpresa?.razonSocial}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Nombre Comercial:</span>
                <span className="font-medium">{viewEmpresa?.nombreComercial || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tipo:</span>
                <span className="font-medium">{viewEmpresa?.tipoEmpresa || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Estado:</span>
                <span className="font-medium">{viewEmpresa?.estado || "Activa"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">ID:</span>
                <span className="font-mono text-xs">{viewEmpresa?._id}</span>
              </div>
              {viewEmpresa?.createdAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Creada:</span>
                  <span className="font-medium">
                    {new Date(viewEmpresa.createdAt).toLocaleDateString("es-CO")}
                  </span>
                </div>
              )}
              {viewEmpresa?.branding && (
                <>
                  <hr className="my-2" />
                  <p className="font-semibold text-foreground">Branding</p>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-6 h-6 rounded-full border"
                      style={{ backgroundColor: viewEmpresa.branding.colorPrimary || "#0B5EA8" }}
                    />
                    <div
                      className="w-6 h-6 rounded-full border"
                      style={{ backgroundColor: viewEmpresa.branding.colorPrimaryDark || "#0A2E52" }}
                    />
                    <div
                      className="w-6 h-6 rounded-full border"
                      style={{ backgroundColor: viewEmpresa.branding.colorAccent || "#FFD400" }}
                    />
                    <span className="text-xs text-muted-foreground ml-2">
                      {viewEmpresa.branding.eslogan || "Sin eslogan"}
                    </span>
                  </div>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* ── Create Dialog ── */}
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nueva Empresa</DialogTitle>
              <DialogDescription>
                Ingresa los datos de la empresa a registrar
              </DialogDescription>
            </DialogHeader>
            {formFields("create")}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreate(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button onClick={handleCreate} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creando...
                  </>
                ) : (
                  "Crear Empresa"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Edit Dialog ── */}
        <Dialog open={!!editEmpresa} onOpenChange={() => setEditEmpresa(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Empresa</DialogTitle>
              <DialogDescription>
                Modifica los datos de {editEmpresa?.razonSocial}
              </DialogDescription>
            </DialogHeader>
            {formFields("edit")}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditEmpresa(null)} disabled={saving}>
                Cancelar
              </Button>
              <Button onClick={handleEdit} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  "Guardar Cambios"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Delete Confirmation ── */}
        <AlertDialog open={!!deleteEmpresa} onOpenChange={() => setDeleteEmpresa(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Eliminar empresa</AlertDialogTitle>
              <AlertDialogDescription>
                ¿Estás seguro de que deseas eliminar <strong>{deleteEmpresa?.razonSocial}</strong> (NIT: {deleteEmpresa?.nit})?
                Esta acción enviará la empresa a la papelera.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </PageContainer>
    </DashboardLayout>
  );
}

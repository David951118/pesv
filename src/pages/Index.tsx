import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { ModuleHeader } from "@/components/layout/ModuleHeader";
import { StatsGrid } from "@/components/layout/StatsGrid";
import { useEmpresaStats } from "@/hooks/useEmpresaStats";
import { useAuth } from "@/hooks/useAuth";
import { getApiRndcBaseUrl } from "@/services/apirndc/apirndc.config";
import {
  Truck,
  Users,
  AlertTriangle,
  ArrowRight,
  LayoutDashboard,
  Loader2,
  Building2,
  Car,
  FolderOpen,
  Trash2,
  FileText,
  ClipboardCheck,
  ScrollText,
  Map,
  TrendingUp,
} from "lucide-react";
import { Link } from "react-router-dom";

/* ─── Admin Dashboard ─── */

function AdminDashboard() {
  const { bearerToken } = useAuth();
  const [counts, setCounts] = useState<{
    empresas: number;
    vehiculos: number;
    terceros: number;
    documentos: number;
    loading: boolean;
  }>({ empresas: 0, vehiculos: 0, terceros: 0, documentos: 0, loading: true });

  useEffect(() => {
    if (!bearerToken) return;
    const base = getApiRndcBaseUrl();
    const headers = { Authorization: `Bearer ${bearerToken}` };

    Promise.all([
      fetch(`${base}/api/empresas`, { headers }).then((r) => r.json()),
      fetch(`${base}/api/vehiculos`, { headers }).then((r) => r.json()),
      fetch(`${base}/api/terceros`, { headers }).then((r) => r.json()),
      fetch(`${base}/api/estadisticas/documentos`, { headers }).then((r) => r.json()).catch(() => ({ data: {} })),
    ])
      .then(([empRes, vehRes, terRes, docRes]) => {
        const empData = empRes.success ? empRes.data : empRes;
        const vehData = vehRes.success ? vehRes.data : vehRes;
        const terData = terRes.success ? terRes.data : terRes;
        const docData = docRes.data || {};
        setCounts({
          empresas: Array.isArray(empData) ? empData.length : 0,
          vehiculos: Array.isArray(vehData) ? vehData.length : 0,
          terceros: Array.isArray(terData) ? terData.length : 0,
          documentos: docData.total || 0,
          loading: false,
        });
      })
      .catch(() => setCounts((prev) => ({ ...prev, loading: false })));
  }, [bearerToken]);

  const stats = [
    {
      title: "Empresas",
      value: counts.empresas.toString(),
      subtitle: "Registradas",
      icon: Building2,
      iconVariant: "primary" as const,
      href: "/empresas",
    },
    {
      title: "Vehículos",
      value: counts.vehiculos.toString(),
      subtitle: "En plataforma",
      icon: Car,
      iconVariant: "primary" as const,
      href: "/vehiculos",
    },
    {
      title: "Usuarios",
      value: counts.terceros.toString(),
      subtitle: "Conductores y terceros",
      icon: Users,
      iconVariant: "success" as const,
      href: "/usuarios",
    },
    {
      title: "Documentos",
      value: counts.documentos.toString(),
      subtitle: "Total registrados",
      icon: FolderOpen,
      iconVariant: "warning" as const,
      href: "/documentos",
    },
  ];

  const quickLinks = [
    { title: "Empresas", description: "Gestionar empresas y branding", icon: Building2, color: "text-primary", bg: "bg-primary/10", href: "/empresas" },
    { title: "Vehículos", description: "Flota vehicular completa", icon: Car, color: "text-primary", bg: "bg-primary/10", href: "/vehiculos" },
    { title: "Usuarios", description: "Conductores, propietarios y más", icon: Users, color: "text-green-600", bg: "bg-green-500/10", href: "/usuarios" },
    { title: "Documentos", description: "Gestión documental y S3", icon: FolderOpen, color: "text-amber-600", bg: "bg-amber-500/10", href: "/documentos" },
    { title: "Auditoría", description: "FUEC y preoperacionales", icon: ScrollText, color: "text-primary", bg: "bg-primary/10", href: "/auditoria" },
    { title: "Papelera", description: "Registros eliminados", icon: Trash2, color: "text-destructive", bg: "bg-destructive/10", href: "/papelera" },
  ];

  return (
    <DashboardLayout>
      <PageContainer>
        <ModuleHeader
          title="Panel de Administración"
          description="Vista general de toda la plataforma Asegurar"
          icon={LayoutDashboard}
          iconVariant="primary"
        />

        {counts.loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <StatsGrid stats={stats} columns={4} />

            <div>
              <h2 className="text-lg font-semibold text-foreground mb-4">Acceso Rápido</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {quickLinks.map((item) => (
                  <Link
                    key={item.href}
                    to={item.href}
                    className="group bg-card rounded-lg border border-border p-5 shadow-corporate hover:shadow-corporate-md hover:border-primary/30 transition-all duration-200"
                  >
                    <div className="flex items-start gap-4 mb-3">
                      <div className={`p-3 rounded-lg ${item.bg} group-hover:scale-105 transition-transform`}>
                        <item.icon className={`h-6 w-6 ${item.color}`} />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                          {item.title}
                        </h3>
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                      <span>Ir al módulo</span>
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </>
        )}
      </PageContainer>
    </DashboardLayout>
  );
}

/* ─── Supervisor Dashboard ─── */

function SupervisorDashboard() {
  const { data: empresaStats, isLoading } = useEmpresaStats();

  const vehiculosTotal = empresaStats?.vehiculos?.total ?? 0;
  const conductoresTotal = empresaStats?.terceros?.conductores ?? 0;
  const tercerosTotal = empresaStats?.terceros?.total ?? 0;
  const docVencidos = empresaStats?.documentos?.vencidos ?? 0;
  const docPorVencer = empresaStats?.documentos?.porVencer ?? 0;
  const preopEsteMes = empresaStats?.preoperacionales?.esteMes ?? 0;
  const preopAprobados = empresaStats?.preoperacionales?.aprobados ?? 0;
  const preopConNovedad = empresaStats?.preoperacionales?.conNovedad ?? 0;
  const preopRechazados = empresaStats?.preoperacionales?.rechazados ?? 0;
  const contratosVigentes = empresaStats?.contratos?.vigentes ?? 0;
  const contratosTotal = empresaStats?.contratos?.total ?? 0;

  const stats = [
    {
      title: "Vehículos",
      value: vehiculosTotal.toString(),
      subtitle: "Registrados",
      icon: Truck,
      iconVariant: "primary" as const,
      href: "/vehiculos",
    },
    {
      title: "Conductores",
      value: conductoresTotal.toString(),
      subtitle: `${tercerosTotal} terceros total`,
      icon: Users,
      iconVariant: "success" as const,
      href: "/usuarios",
    },
    {
      title: "Alertas Docs",
      value: (docVencidos + docPorVencer).toString(),
      subtitle: `${docVencidos} vencidos · ${docPorVencer} por vencer`,
      icon: AlertTriangle,
      iconVariant: docVencidos > 0 ? ("destructive" as const) : ("warning" as const),
      href: "/documentos",
    },
    {
      title: "Preoperacionales",
      value: preopEsteMes.toString(),
      subtitle: `${preopAprobados} aprobados este mes`,
      icon: TrendingUp,
      iconVariant: "primary" as const,
      href: "/preoperativas",
    },
  ];

  const quickLinks = [
    { title: "Preoperativas", description: "Inspecciones diarias de la flota", icon: ClipboardCheck, color: "text-primary", bg: "bg-primary/10", href: "/preoperativas", badge: preopEsteMes > 0 ? preopEsteMes.toString() : undefined },
    { title: "Contratos FUEC", description: `${contratosVigentes} vigentes de ${contratosTotal}`, icon: FileText, color: "text-primary", bg: "bg-primary/10", href: "/fuec", badge: contratosVigentes > 0 ? contratosVigentes.toString() : undefined },
    { title: "Mapa", description: "Seguimiento de vehículos en tiempo real", icon: Map, color: "text-green-600", bg: "bg-green-500/10", href: "/mapa" },
{ title: "Documentos", description: `${docVencidos} vencidos · ${docPorVencer} por vencer`, icon: FolderOpen, color: "text-amber-600", bg: "bg-amber-500/10", href: "/documentos", badge: docVencidos > 0 ? docVencidos.toString() : undefined, badgeColor: docVencidos > 0 ? "bg-destructive text-destructive-foreground" : undefined },
    { title: "Vehículos", description: "Gestión de la flota", icon: Car, color: "text-primary", bg: "bg-primary/10", href: "/vehiculos" },
    { title: "Usuarios", description: "Conductores y terceros", icon: Users, color: "text-green-600", bg: "bg-green-500/10", href: "/usuarios" },
    { title: "Auditoría", description: "FUEC y preoperacionales", icon: ScrollText, color: "text-primary", bg: "bg-primary/10", href: "/auditoria" },
  ];

  const empresaNombre = empresaStats?.empresa?.razonSocial;

  return (
    <DashboardLayout>
      <PageContainer>
        <ModuleHeader
          title="Panel de Control"
          description={
            empresaNombre
              ? `${empresaNombre} — NIT ${empresaStats?.empresa?.nit}`
              : "Administración de flota"
          }
          icon={LayoutDashboard}
          iconVariant="primary"
        />

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <StatsGrid stats={stats} columns={4} />

            {/* Preoperacionales breakdown */}
            {(preopConNovedad > 0 || preopRechazados > 0) && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-card rounded-lg border border-border p-4">
                  <p className="text-sm text-muted-foreground">Aprobados</p>
                  <p className="text-2xl font-bold text-green-600">{preopAprobados}</p>
                </div>
                <div className="bg-card rounded-lg border border-border p-4">
                  <p className="text-sm text-muted-foreground">Con Novedad</p>
                  <p className="text-2xl font-bold text-amber-600">{preopConNovedad}</p>
                </div>
                <div className="bg-card rounded-lg border border-border p-4">
                  <p className="text-sm text-muted-foreground">Rechazados</p>
                  <p className="text-2xl font-bold text-destructive">{preopRechazados}</p>
                </div>
              </div>
            )}

            {/* Quick access */}
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-4">Acceso Rápido</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {quickLinks.map((item) => (
                  <Link
                    key={item.href}
                    to={item.href}
                    className="group bg-card rounded-lg border border-border p-5 shadow-corporate hover:shadow-corporate-md hover:border-primary/30 transition-all duration-200"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className={`p-3 rounded-lg ${item.bg} group-hover:scale-105 transition-transform`}>
                        <item.icon className={`h-6 w-6 ${item.color}`} />
                      </div>
                      {item.badge && (
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${item.badgeColor || "bg-primary text-primary-foreground"}`}>
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <h3 className="font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </Link>
                ))}
              </div>
            </div>
          </>
        )}
      </PageContainer>
    </DashboardLayout>
  );
}

/* ─── Router ─── */

const Index = () => {
  const { role } = useAuth();
  if (role === "admin") return <AdminDashboard />;
  return <SupervisorDashboard />;
};

export default Index;

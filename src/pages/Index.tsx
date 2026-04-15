import { useState, useEffect, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { useEmpresaStats } from "@/hooks/useEmpresaStats";
import { useAuth } from "@/hooks/useAuth";
import { getApiRndcBaseUrl } from "@/services/apirndc/apirndc.config";
import { PreoperativaAlerts } from "@/components/preoperativas/PreoperativaAlerts";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Truck,
  Users,
  AlertTriangle,
  ArrowRight,
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
  FileWarning,
  Clock,
  BarChart3,
  Sparkles,
  Plus,
  UserCog,
  LucideIcon,
} from "lucide-react";
import { Link } from "react-router-dom";

/* ─── Shared UI primitives ─── */

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  accent: "blue" | "green" | "amber" | "red" | "purple" | "indigo";
  href?: string;
  trend?: string;
}

const accentStyles: Record<
  MetricCardProps["accent"],
  { border: string; iconBg: string; iconText: string; valueText: string; gradient: string }
> = {
  blue: {
    border: "border-l-blue-500",
    iconBg: "bg-blue-100 dark:bg-blue-900/30",
    iconText: "text-blue-600 dark:text-blue-400",
    valueText: "text-blue-700 dark:text-blue-300",
    gradient: "from-blue-50/60 to-transparent dark:from-blue-900/10",
  },
  green: {
    border: "border-l-emerald-500",
    iconBg: "bg-emerald-100 dark:bg-emerald-900/30",
    iconText: "text-emerald-600 dark:text-emerald-400",
    valueText: "text-emerald-700 dark:text-emerald-300",
    gradient: "from-emerald-50/60 to-transparent dark:from-emerald-900/10",
  },
  amber: {
    border: "border-l-amber-500",
    iconBg: "bg-amber-100 dark:bg-amber-900/30",
    iconText: "text-amber-600 dark:text-amber-400",
    valueText: "text-amber-700 dark:text-amber-300",
    gradient: "from-amber-50/60 to-transparent dark:from-amber-900/10",
  },
  red: {
    border: "border-l-rose-500",
    iconBg: "bg-rose-100 dark:bg-rose-900/30",
    iconText: "text-rose-600 dark:text-rose-400",
    valueText: "text-rose-700 dark:text-rose-300",
    gradient: "from-rose-50/60 to-transparent dark:from-rose-900/10",
  },
  purple: {
    border: "border-l-purple-500",
    iconBg: "bg-purple-100 dark:bg-purple-900/30",
    iconText: "text-purple-600 dark:text-purple-400",
    valueText: "text-purple-700 dark:text-purple-300",
    gradient: "from-purple-50/60 to-transparent dark:from-purple-900/10",
  },
  indigo: {
    border: "border-l-indigo-500",
    iconBg: "bg-indigo-100 dark:bg-indigo-900/30",
    iconText: "text-indigo-600 dark:text-indigo-400",
    valueText: "text-indigo-700 dark:text-indigo-300",
    gradient: "from-indigo-50/60 to-transparent dark:from-indigo-900/10",
  },
};

function MetricCard({ title, value, subtitle, icon: Icon, accent, href, trend }: MetricCardProps) {
  const s = accentStyles[accent];
  const content = (
    <div
      className={`relative overflow-hidden rounded-2xl border border-border border-l-4 ${s.border} bg-gradient-to-br ${s.gradient} bg-card p-5 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 h-full`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`p-2.5 rounded-xl ${s.iconBg}`}>
          <Icon className={`h-5 w-5 ${s.iconText}`} />
        </div>
        {trend && (
          <span className={`text-xs font-semibold ${s.valueText} inline-flex items-center gap-1`}>
            <TrendingUp className="h-3 w-3" />
            {trend}
          </span>
        )}
      </div>
      <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
      <p className={`text-3xl font-bold tracking-tight ${s.valueText}`}>{value}</p>
      {subtitle && <p className="text-xs text-muted-foreground mt-1.5">{subtitle}</p>}
    </div>
  );
  return href ? (
    <Link to={href} className="block">
      {content}
    </Link>
  ) : (
    content
  );
}

interface QuickActionProps {
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
  gradient: string;
}

function QuickAction({ title, description, icon: Icon, href, gradient }: QuickActionProps) {
  return (
    <Link
      to={href}
      className={`group relative overflow-hidden rounded-2xl p-6 text-white shadow-md hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 bg-gradient-to-br ${gradient}`}
    >
      <div className="relative z-10 flex items-start justify-between">
        <div className="flex-1">
          <div className="inline-flex p-2.5 rounded-xl bg-white/20 backdrop-blur-sm mb-3">
            <Icon className="h-5 w-5 text-white" />
          </div>
          <h3 className="text-lg font-bold mb-1">{title}</h3>
          <p className="text-sm text-white/85">{description}</p>
        </div>
        <ArrowRight className="h-5 w-5 text-white/80 group-hover:translate-x-1 transition-transform" />
      </div>
      <div className="absolute -right-8 -bottom-8 opacity-10 group-hover:opacity-20 transition-opacity">
        <Icon className="h-32 w-32 text-white" />
      </div>
    </Link>
  );
}

interface QuickLinkProps {
  title: string;
  icon: LucideIcon;
  href: string;
  accent: MetricCardProps["accent"];
}

function QuickLink({ title, icon: Icon, href, accent }: QuickLinkProps) {
  const s = accentStyles[accent];
  return (
    <Link
      to={href}
      className="group flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm hover:shadow-md hover:border-primary/40 transition-all"
    >
      <div className={`p-2 rounded-lg ${s.iconBg}`}>
        <Icon className={`h-4 w-4 ${s.iconText}`} />
      </div>
      <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors flex-1">
        {title}
      </span>
      <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
    </Link>
  );
}

interface HeroBannerProps {
  title: string;
  subtitle: string;
  summary?: string;
}

function HeroBanner({ title, subtitle, summary }: HeroBannerProps) {
  const today = useMemo(
    () => format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es }),
    []
  );
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary to-indigo-600 p-6 sm:p-8 text-white shadow-lg">
      <div className="relative z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-sm text-xs font-medium mb-3">
          <Sparkles className="h-3.5 w-3.5" />
          <span className="capitalize">{today}</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1">{title}</h1>
        <p className="text-white/85 text-sm sm:text-base">{subtitle}</p>
        {summary && (
          <p className="mt-4 text-sm text-white/90 max-w-2xl leading-relaxed">{summary}</p>
        )}
      </div>
      <div className="absolute -right-12 -top-12 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
      <div className="absolute -right-24 -bottom-24 h-72 w-72 rounded-full bg-indigo-400/20 blur-3xl" />
    </div>
  );
}

function SectionTitle({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between mb-4">
      <h2 className="text-lg font-bold text-foreground">{children}</h2>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}

/* ─── Admin Dashboard ─── */

function AdminDashboard() {
  const { bearerToken, user } = useAuth();
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

  return (
    <DashboardLayout>
      <PageContainer>
        <div className="space-y-6">
          <HeroBanner
            title={`Panel Administrativo · ${user?.persona ?? ""}`}
            subtitle="Vista general de toda la plataforma Asegurar"
            summary="Supervisa empresas, vehículos, usuarios y documentos desde un único lugar. Accede a estadísticas detalladas y gestiona la operación global."
          />

          {counts.loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {/* Métricas */}
              <section>
                <SectionTitle hint="Datos en tiempo real">Métricas clave</SectionTitle>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <MetricCard
                    title="Empresas"
                    value={counts.empresas}
                    subtitle="Registradas en plataforma"
                    icon={Building2}
                    accent="blue"
                    href="/empresas"
                  />
                  <MetricCard
                    title="Vehículos totales"
                    value={counts.vehiculos}
                    subtitle="Flota consolidada"
                    icon={Car}
                    accent="indigo"
                    href="/vehiculos"
                  />
                  <MetricCard
                    title="Usuarios totales"
                    value={counts.terceros}
                    subtitle="Conductores y terceros"
                    icon={Users}
                    accent="green"
                    href="/usuarios"
                  />
                  <MetricCard
                    title="Documentos activos"
                    value={counts.documentos}
                    subtitle="Total registrados"
                    icon={FolderOpen}
                    accent="amber"
                    href="/documentos"
                  />
                </div>
              </section>

              {/* Acciones rápidas */}
              <section>
                <SectionTitle>Acciones rápidas</SectionTitle>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <QuickAction
                    title="Gestionar Empresas"
                    description="Altas, branding y configuración"
                    icon={Building2}
                    href="/empresas"
                    gradient="from-blue-500 to-blue-700"
                  />
                  <QuickAction
                    title="Ver Usuarios"
                    description="Conductores, propietarios y admins"
                    icon={UserCog}
                    href="/usuarios"
                    gradient="from-emerald-500 to-teal-700"
                  />
                  <QuickAction
                    title="Papelera"
                    description="Recupera registros eliminados"
                    icon={Trash2}
                    href="/papelera"
                    gradient="from-rose-500 to-rose-700"
                  />
                </div>
              </section>

              {/* Estadísticas CTA */}
              <section>
                <Link
                  to="/estadisticas"
                  className="group flex items-center justify-between gap-4 rounded-2xl border border-border bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 dark:from-purple-950/30 dark:via-indigo-950/30 dark:to-blue-950/30 p-5 shadow-sm hover:shadow-md transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-sm">
                      <BarChart3 className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground">Estadísticas detalladas</h3>
                      <p className="text-sm text-muted-foreground">
                        Explora métricas completas, gráficos y tendencias de toda la plataforma
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:translate-x-1 group-hover:text-primary transition-all" />
                </Link>
              </section>

              {/* Accesos secundarios */}
              <section>
                <SectionTitle>Accesos rápidos</SectionTitle>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <QuickLink title="Vehículos" icon={Car} href="/vehiculos" accent="blue" />
                  <QuickLink title="Documentos" icon={FolderOpen} href="/documentos" accent="amber" />
                  <QuickLink title="Auditoría" icon={ScrollText} href="/auditoria" accent="purple" />
                  <QuickLink title="Papelera" icon={Trash2} href="/papelera" accent="red" />
                </div>
              </section>
            </>
          )}
        </div>
      </PageContainer>
    </DashboardLayout>
  );
}

/* ─── Supervisor Dashboard ─── */

function SupervisorDashboard() {
  const { bearerToken } = useAuth();
  const { data: empresaStats, isLoading } = useEmpresaStats();
  const [preoperativas, setPreoperativas] = useState<any[]>([]);

  useEffect(() => {
    if (!bearerToken) return;
    fetch(`${getApiRndcBaseUrl()}/api/preoperacionales`, {
      headers: { Authorization: `Bearer ${bearerToken}` },
    })
      .then((r) => r.json())
      .then((res) => {
        const data = res.success ? res.data : res;
        setPreoperativas(Array.isArray(data) ? data : []);
      })
      .catch(() => setPreoperativas([]));
  }, [bearerToken]);

  const vehiculosTotal = empresaStats?.vehiculos?.total ?? 0;
  const conductoresTotal = empresaStats?.terceros?.conductores ?? 0;
  const docVencidos = empresaStats?.documentos?.vencidos ?? 0;
  const docPorVencer = empresaStats?.documentos?.porVencer ?? 0;
  const preopEsteMes = empresaStats?.preoperacionales?.esteMes ?? 0;
  const preopAprobados = empresaStats?.preoperacionales?.aprobados ?? 0;
  const preopConNovedad = empresaStats?.preoperacionales?.conNovedad ?? 0;
  const contratosVigentes = empresaStats?.contratos?.vigentes ?? 0;

  const preopsHoy = useMemo(() => {
    const hoy = new Date().toISOString().slice(0, 10);
    return preoperativas.filter((p: any) => {
      const fecha = p.fecha_hora || p.fecha_asignada || "";
      return typeof fecha === "string" && fecha.startsWith(hoy);
    }).length;
  }, [preoperativas]);

  const empresaNombre = empresaStats?.empresa?.razonSocial ?? "Tu empresa";
  const alertasDocs = docVencidos + docPorVencer;

  return (
    <DashboardLayout>
      <PageContainer>
        <div className="space-y-6">
          <HeroBanner
            title={`Panel Operativo · ${empresaNombre}`}
            subtitle={
              empresaStats?.empresa?.nit
                ? `NIT ${empresaStats.empresa.nit} — Administración de flota`
                : "Administración de flota"
            }
            summary={`Hoy tienes ${preopsHoy} preoperacionales programadas, ${contratosVigentes} contratos FUEC vigentes${alertasDocs > 0 ? ` y ${alertasDocs} alertas documentales pendientes.` : "."}`}
          />

          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {/* Métricas */}
              <section>
                <SectionTitle hint="Resumen operativo">Métricas clave</SectionTitle>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <MetricCard
                    title="Vehículos activos"
                    value={vehiculosTotal}
                    subtitle="Flota registrada"
                    icon={Truck}
                    accent="blue"
                    href="/vehiculos"
                  />
                  <MetricCard
                    title="Conductores"
                    value={conductoresTotal}
                    subtitle="Activos en plataforma"
                    icon={Users}
                    accent="green"
                    href="/usuarios"
                  />
                  <MetricCard
                    title="Preops hoy"
                    value={preopsHoy}
                    subtitle={`${preopAprobados} aprobadas este mes`}
                    icon={ClipboardCheck}
                    accent="purple"
                    href="/preoperativas"
                    trend={preopEsteMes > 0 ? `${preopEsteMes} mes` : undefined}
                  />
                  <MetricCard
                    title="Alertas documentos"
                    value={alertasDocs}
                    subtitle={`${docVencidos} vencidos · ${docPorVencer} por vencer`}
                    icon={AlertTriangle}
                    accent={docVencidos > 0 ? "red" : "amber"}
                    href="/documentos"
                  />
                </div>
              </section>

              {/* Acciones rápidas */}
              <section>
                <SectionTitle>Acciones rápidas</SectionTitle>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <QuickAction
                    title="Nueva Preoperacional"
                    description="Registra una nueva inspección diaria"
                    icon={Plus}
                    href="/preoperativas"
                    gradient="from-indigo-500 to-blue-700"
                  />
                  <QuickAction
                    title="Crear FUEC"
                    description="Genera un nuevo contrato de transporte"
                    icon={FileText}
                    href="/fuec"
                    gradient="from-emerald-500 to-teal-700"
                  />
                  <QuickAction
                    title="Ver Mapa"
                    description="Seguimiento de vehículos en tiempo real"
                    icon={Map}
                    href="/mapa"
                    gradient="from-purple-500 to-fuchsia-700"
                  />
                </div>
              </section>

              {/* Alertas y actividad */}
              <section>
                <SectionTitle>Alertas y actividad reciente</SectionTitle>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Alertas de documentos */}
                  <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <FileWarning className="h-5 w-5 text-amber-600" />
                      <h3 className="font-semibold text-foreground">Alertas documentales</h3>
                    </div>
                    <div className="space-y-3">
                      {docVencidos > 0 && (
                        <Link
                          to="/documentos"
                          className="flex items-center justify-between gap-3 p-3 rounded-xl border border-rose-200 bg-rose-50/60 dark:border-rose-900/40 dark:bg-rose-900/10 hover:shadow-sm transition-shadow"
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-rose-100 dark:bg-rose-900/30">
                              <FileWarning className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                            </div>
                            <span className="text-sm font-medium text-rose-700 dark:text-rose-300">
                              Documentos vencidos
                            </span>
                          </div>
                          <span className="text-xl font-bold text-rose-700 dark:text-rose-300">
                            {docVencidos}
                          </span>
                        </Link>
                      )}
                      {docPorVencer > 0 && (
                        <Link
                          to="/documentos"
                          className="flex items-center justify-between gap-3 p-3 rounded-xl border border-amber-200 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-900/10 hover:shadow-sm transition-shadow"
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                              <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                            </div>
                            <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
                              Próximos a vencer
                            </span>
                          </div>
                          <span className="text-xl font-bold text-amber-700 dark:text-amber-300">
                            {docPorVencer}
                          </span>
                        </Link>
                      )}
                      {preopConNovedad > 0 && (
                        <Link
                          to="/preoperativas"
                          className="flex items-center justify-between gap-3 p-3 rounded-xl border border-blue-200 bg-blue-50/60 dark:border-blue-900/40 dark:bg-blue-900/10 hover:shadow-sm transition-shadow"
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                              <AlertTriangle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            </div>
                            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                              Correcciones pendientes
                            </span>
                          </div>
                          <span className="text-xl font-bold text-blue-700 dark:text-blue-300">
                            {preopConNovedad}
                          </span>
                        </Link>
                      )}
                      {docVencidos === 0 && docPorVencer === 0 && preopConNovedad === 0 && (
                        <div className="text-center py-6 text-sm text-muted-foreground">
                          No hay alertas documentales pendientes.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Alertas preoperacionales */}
                  <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <ClipboardCheck className="h-5 w-5 text-purple-600" />
                      <h3 className="font-semibold text-foreground">Preoperacionales</h3>
                    </div>
                    <PreoperativaAlerts preoperativas={preoperativas} />
                  </div>
                </div>
              </section>

              {/* Estadísticas CTA */}
              <section>
                <Link
                  to="/estadisticas"
                  className="group flex items-center justify-between gap-4 rounded-2xl border border-border bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 dark:from-purple-950/30 dark:via-indigo-950/30 dark:to-blue-950/30 p-5 shadow-sm hover:shadow-md transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-sm">
                      <BarChart3 className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground">Estadísticas detalladas</h3>
                      <p className="text-sm text-muted-foreground">
                        Métricas completas, gráficos y tendencias de tu operación
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:translate-x-1 group-hover:text-primary transition-all" />
                </Link>
              </section>

              {/* Accesos secundarios */}
              <section>
                <SectionTitle>Accesos rápidos</SectionTitle>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <QuickLink title="Vehículos" icon={Car} href="/vehiculos" accent="blue" />
                  <QuickLink title="Usuarios" icon={Users} href="/usuarios" accent="green" />
                  <QuickLink title="Documentos" icon={FolderOpen} href="/documentos" accent="amber" />
                  <QuickLink title="FUEC" icon={FileText} href="/fuec" accent="indigo" />
                  <QuickLink title="Auditoría" icon={ScrollText} href="/auditoria" accent="purple" />
                  <QuickLink title="Mapa" icon={Map} href="/mapa" accent="red" />
                </div>
              </section>
            </>
          )}
        </div>
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

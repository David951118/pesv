import { Link, useLocation } from "react-router-dom";
import {
  Home,
  ClipboardCheck,
  FileText,
  Map,
  FolderOpen,
  Truck,
  Car,
  LogOut,
  User,
  Shield,
  Users,
  ScrollText,
  Building2,
  Trash2,
  BarChart3,
  Wrench,
  Boxes,
  ChevronsUpDown,
} from "lucide-react";
import logoAsegurar from "@/assets/logos/triangulo1 png.png";
import { getLogoSrc } from "@/assets/logos";
import { useAuth, type AppRole } from "@/hooks/useAuth";
import { useEmpresaBranding } from "@/hooks/useEmpresaBranding";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";

function getRoleLabel(role: AppRole | null): string {
  switch (role) {
    case "admin": return "Administrador";
    case "supervisor": return "Supervisor";
    case "conductor": return "Conductor";
    case "mecanico": return "Mecánico";
    default: return "Usuario";
  }
}

interface NavItem {
  title: string;
  href: string;
  icon: typeof Home;
  roles: AppRole[];
}
interface NavGroup {
  label: string;
  items: NavItem[];
}

// Items agrupados por dominio. Mantiene los mismos href y roles que la navegación previa.
const navGroups: NavGroup[] = [
  {
    label: "General",
    items: [
      { title: "Inicio", href: "/", icon: Home, roles: ["admin", "supervisor"] },
    ],
  },
  {
    label: "Operación",
    items: [
      { title: "Preoperativas", href: "/preoperativas", icon: ClipboardCheck, roles: ["supervisor", "mecanico"] },
      { title: "FUEC", href: "/fuec", icon: FileText, roles: ["supervisor"] },
      { title: "Mapa", href: "/mapa", icon: Map, roles: ["supervisor"] },
      { title: "Operación", href: "/operacion", icon: Truck, roles: ["admin", "supervisor"] },
    ],
  },
  {
    label: "Gestión de flota",
    items: [
      { title: "Vehículos", href: "/vehiculos", icon: Car, roles: ["admin", "supervisor"] },
      { title: "Documentos", href: "/documentos", icon: FolderOpen, roles: ["admin", "supervisor"] },
      { title: "Mantenimiento", href: "/mantenimiento", icon: Wrench, roles: ["admin", "supervisor", "mecanico"] },
      { title: "Inventario", href: "/inventario", icon: Boxes, roles: ["admin", "supervisor", "mecanico"] },
    ],
  },
  {
    label: "Análisis",
    items: [
      { title: "Estadísticas", href: "/estadisticas", icon: BarChart3, roles: ["admin", "supervisor"] },
      { title: "Auditoría", href: "/auditoria", icon: ScrollText, roles: ["admin", "supervisor"] },
    ],
  },
  {
    label: "Administración",
    items: [
      { title: "Usuarios", href: "/usuarios", icon: Users, roles: ["admin", "supervisor"] },
      { title: "Empresas", href: "/empresas", icon: Building2, roles: ["admin"] },
      { title: "Papelera", href: "/papelera", icon: Trash2, roles: ["admin"] },
    ],
  },
];

export function AppSidebar() {
  const location = useLocation();
  const { user, role, signOut } = useAuth();
  const { empresa, branding } = useEmpresaBranding();
  const { isMobile, setOpenMobile } = useSidebar();

  const navLogo = role === "admin" ? logoAsegurar : getLogoSrc(branding.logoKey);
  const navBrand = role === "admin" ? "Asegurar" : (empresa?.nombreComercial || empresa?.razonSocial || "Asegurar");

  const displayName = user?.persona || user?.username || "";
  const firstName = displayName.split(" ").filter(Boolean)[0] || "";
  const userInitials = displayName.split(" ").filter(Boolean).map((w) => w[0]).join("").substring(0, 2).toUpperCase() || "U";

  const isActive = (href: string) =>
    href === "/" ? location.pathname === "/" : location.pathname.startsWith(href);

  const closeOnMobile = () => { if (isMobile) setOpenMobile(false); };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link to="/" onClick={closeOnMobile} className="flex items-center gap-2 px-1 py-1.5">
          <img src={navLogo} alt={navBrand} className="h-8 w-8 shrink-0 object-contain" />
          <span className="text-base font-semibold truncate group-data-[collapsible=icon]:hidden">
            {navBrand}
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {navGroups.map((g) => {
          const items = g.items.filter((it) => role && it.roles.includes(role));
          if (items.length === 0) return null;
          return (
            <SidebarGroup key={g.label}>
              <SidebarGroupLabel>{g.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton asChild isActive={isActive(item.href)} tooltip={item.title}>
                          <Link to={item.href} onClick={closeOnMobile}>
                            <Icon />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent">
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarFallback className="rounded-lg bg-primary text-primary-foreground text-xs font-semibold">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{firstName}</span>
                    <span className="truncate text-xs text-muted-foreground">{getRoleLabel(role)}</span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-56 rounded-lg"
                side="right"
                align="end"
                sideOffset={4}
              >
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{displayName}</p>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1">
                      <div className="p-1 rounded bg-primary/10">
                        {role === "admin" || role === "supervisor" ? (
                          <Shield className="h-3 w-3 text-primary" />
                        ) : (
                          <User className="h-3 w-3 text-primary" />
                        )}
                      </div>
                      <span>{getRoleLabel(role)}</span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={signOut}
                  className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Cerrar sesión</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}

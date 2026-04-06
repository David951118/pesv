import { useState } from "react";
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
  ChevronDown,
  Menu,
  Users,
  ScrollText,
  Building2,
  Trash2,
} from "lucide-react";
import logoAsegurar from "@/assets/logos/triangulo1 png.png";
import { cn } from "@/lib/utils";
import { useAuth, type AppRole } from "@/hooks/useAuth";
import { useEmpresaBranding } from "@/hooks/useEmpresaBranding";
import { getLogoSrc } from "@/assets/logos";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AlertsPopup } from "@/components/dashboard/AlertsPopup";

function getRoleLabel(role: AppRole | null): string {
  switch (role) {
    case "admin": return "Administrador";
    case "supervisor": return "Supervisor";
    case "conductor": return "Conductor";
    default: return "Usuario";
  }
}

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

interface NavItem {
  title: string;
  href: string;
  icon: typeof Home;
  roles: AppRole[];
}

const navItems: NavItem[] = [
  // Shared
  { title: "Inicio", href: "/", icon: Home, roles: ["admin", "supervisor"] },

  // Supervisor / operational
  { title: "Preoperativas", href: "/preoperativas", icon: ClipboardCheck, roles: ["supervisor"] },
  { title: "FUEC", href: "/fuec", icon: FileText, roles: ["supervisor"] },
  { title: "Mapa", href: "/mapa", icon: Map, roles: ["supervisor"] },

  // Shared management
  { title: "Documentos", href: "/documentos", icon: FolderOpen, roles: ["admin", "supervisor"] },
  { title: "Vehículos", href: "/vehiculos", icon: Car, roles: ["admin", "supervisor"] },
  { title: "Usuarios", href: "/usuarios", icon: Users, roles: ["admin", "supervisor"] },
  { title: "Auditoría", href: "/auditoria", icon: ScrollText, roles: ["admin", "supervisor"] },

  // Admin only
  { title: "Empresas", href: "/empresas", icon: Building2, roles: ["admin"] },
  { title: "Papelera", href: "/papelera", icon: Trash2, roles: ["admin"] },
];

export function TopNav() {
  const location = useLocation();
  const { user, role, signOut } = useAuth();
  const { empresa, branding } = useEmpresaBranding();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Non-admin users see their empresa logo; admin always sees Asegurar triangle
  const navLogo = role === "admin" ? logoAsegurar : getLogoSrc(branding.logoKey);
  const navBrand = role === "admin" ? "Asegurar" : (empresa?.nombreComercial || empresa?.razonSocial || "Asegurar");

  const displayName = user?.persona || user?.username || "";
  const userInitials = displayName.split(" ").filter(Boolean).map(w => w[0]).join("").substring(0, 2).toUpperCase() || "U";

  const visibleItems = navItems.filter(item => role && item.roles.includes(role));

  return (
    <nav className="bg-nav w-full shadow-lg">
      <div className="w-full px-4 xl:px-6">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            {/* Mobile Menu Button */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="xl:hidden mr-2 text-nav-foreground hover:bg-nav-hover"
                >
                  <Menu className="h-6 w-6" />
                  <span className="sr-only">Abrir menú</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0">
                <SheetHeader className="p-4 border-b bg-nav">
                  <SheetTitle className="flex items-center gap-3">
                    <img
                      src={navLogo}
                      alt={navBrand}
                      className="h-8 w-auto"
                    />
                    <span className="text-nav-foreground font-bold text-lg">
                      {navBrand}
                    </span>
                  </SheetTitle>
                </SheetHeader>
                <div className="py-4">
                  {visibleItems.map((item) => {
                    const isActive = location.pathname === item.href;
                    const Icon = item.icon;

                    return (
                      <Link
                        key={item.href}
                        to={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={cn(
                          "flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors",
                          isActive
                            ? "bg-primary/10 text-primary border-l-4 border-primary"
                            : "text-foreground hover:bg-muted"
                        )}
                      >
                        <Icon className="h-5 w-5" />
                        <span>{item.title}</span>
                      </Link>
                    );
                  })}
                </div>

                {/* User info in mobile menu */}
                <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-muted/50">
                  <div className="flex items-center gap-3 mb-3">
                    <Avatar className="h-10 w-10 border-2 border-primary/20">
                      <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
                        {userInitials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{displayName}</p>
                      <p className="text-xs text-muted-foreground">
                        {getRoleLabel(role)}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      signOut();
                    }}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Cerrar sesión
                  </Button>
                </div>
              </SheetContent>
            </Sheet>

            {/* Logo */}
            <div className="flex-shrink-0 mr-8">
              <Link to="/" className="flex items-center gap-3">
                <img
                  src={navLogo}
                  alt={navBrand}
                  className="h-8 w-auto"
                />
                <span className="text-nav-foreground font-bold text-lg tracking-tight hidden sm:block">
                  {navBrand}
                </span>
              </Link>
            </div>

            {/* Navigation Links - Desktop */}
            <div className="hidden xl:flex items-center space-x-0.5">
              {visibleItems.map((item) => {
                const isActive = location.pathname === item.href;
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={cn(
                      "nav-link flex items-center gap-1.5 px-2.5 py-1.5",
                      isActive && "nav-link-active"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-xs font-medium whitespace-nowrap">{item.title}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Right side: Alerts + Theme toggle + User Menu */}
          <div className="flex items-center gap-2">
            {(role === "admin" || role === "supervisor") && <AlertsPopup />}
            <ThemeToggle className="text-nav-foreground hover:bg-nav-hover" />

            {/* User Menu - Desktop */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="flex items-center gap-2 text-nav-foreground hover:bg-nav-hover px-3 py-2 rounded-lg transition-colors"
                >
                  <Avatar className="h-8 w-8 border-2 border-nav-foreground/20">
                    <AvatarFallback className="bg-accent text-accent-foreground text-sm font-semibold">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden sm:flex flex-col items-start">
                    <span className="text-sm font-medium text-nav-foreground/90">
                      {displayName}
                    </span>
                    <span className="text-xs text-nav-foreground/60">
                      {getRoleLabel(role)}
                    </span>
                  </div>
                  <ChevronDown className="h-4 w-4 text-nav-foreground/60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none text-foreground">{displayName}</p>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1">
                      {role === "admin" || role === "supervisor" ? (
                        <>
                          <div className="p-1 rounded bg-primary/10">
                            <Shield className="h-3 w-3 text-primary" />
                          </div>
                          <span>{getRoleLabel(role)}</span>
                        </>
                      ) : (
                        <>
                          <div className="p-1 rounded bg-muted">
                            <User className="h-3 w-3" />
                          </div>
                          <span>Conductor</span>
                        </>
                      )}
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
          </div>
        </div>
      </div>
    </nav>
  );
}

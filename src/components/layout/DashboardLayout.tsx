import { AppSidebar } from "./AppSidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AlertsPopup } from "@/components/dashboard/AlertsPopup";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresaBranding } from "@/hooks/useEmpresaBranding";
import { getLogoSrc } from "@/assets/logos";
import { Loader2 } from "lucide-react";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { loading, branding } = useEmpresaBranding();
  const { role } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <img
          src={getLogoSrc(branding.logoKey)}
          alt="Cargando"
          className="h-16 w-16 object-contain animate-pulse"
        />
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Cargando plataforma...</p>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-6" />
          <div className="flex-1" />
          {(role === "admin" || role === "supervisor") && (
            <AlertsPopup className="relative text-foreground hover:bg-muted" />
          )}
          <ThemeToggle />
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

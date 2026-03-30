import { TopNav } from "./TopNav";
import { useEmpresaBranding } from "@/hooks/useEmpresaBranding";
import { getLogoSrc } from "@/assets/logos";
import { Loader2 } from "lucide-react";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { loading, branding } = useEmpresaBranding();

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
    <div className="min-h-screen bg-background">
      <TopNav />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}

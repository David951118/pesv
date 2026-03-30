import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface ModuleHeaderProps {
  /** Título principal del módulo */
  title: string;
  /** Descripción breve del módulo */
  description: string;
  /** Icono del módulo (componente Lucide) */
  icon: LucideIcon;
  /** Color de fondo del icono (variante semántica) */
  iconVariant?: "primary" | "success" | "warning" | "destructive";
  /** Acciones principales (botones, filtros) */
  actions?: React.ReactNode;
  /** Contenido adicional debajo del header (filtros, tabs) */
  children?: React.ReactNode;
  className?: string;
}

const iconVariantStyles = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  destructive: "bg-destructive/10 text-destructive",
};

/**
 * ModuleHeader - Header estandarizado para todos los módulos
 * Proporciona consistencia visual con título, descripción, icono y acciones
 */
export function ModuleHeader({
  title,
  description,
  icon: Icon,
  iconVariant = "primary",
  actions,
  children,
  className,
}: ModuleHeaderProps) {
  return (
    <div className={cn("space-y-6", className)}>
      {/* Header principal */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={cn("p-2.5 rounded-lg", iconVariantStyles[iconVariant])}>
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{title}</h1>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        
        {actions && (
          <div className="flex items-center gap-3">
            {actions}
          </div>
        )}
      </div>

      {/* Contenido adicional (filtros, tabs, etc.) */}
      {children}
    </div>
  );
}

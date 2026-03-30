import { cn } from "@/lib/utils";

interface ContentCardProps {
  children: React.ReactNode;
  className?: string;
  /** Padding del contenido */
  padding?: "none" | "sm" | "default" | "lg";
  /** Mostrar header con título */
  header?: {
    title: string;
    subtitle?: string;
    icon?: React.ReactNode;
    actions?: React.ReactNode;
  };
}

const paddingStyles = {
  none: "",
  sm: "p-4",
  default: "p-5",
  lg: "p-6",
};

/**
 * ContentCard - Tarjeta estandarizada para contenido de módulos
 * Fondo blanco, bordes sutiles, sombra corporativa ligera
 */
export function ContentCard({ 
  children, 
  className, 
  padding = "default",
  header,
}: ContentCardProps) {
  return (
    <div 
      className={cn(
        "bg-card rounded-lg border border-border shadow-corporate overflow-hidden",
        className
      )}
    >
      {header && (
        <div className="px-5 py-4 border-b border-border bg-gradient-to-r from-table-header to-card flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            {header.icon && (
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                {header.icon}
              </div>
            )}
            <div>
              <h3 className="font-semibold text-foreground">{header.title}</h3>
              {header.subtitle && (
                <span className="text-xs text-muted-foreground">{header.subtitle}</span>
              )}
            </div>
          </div>
          {header.actions && (
            <div className="flex items-center gap-2">
              {header.actions}
            </div>
          )}
        </div>
      )}
      <div className={cn(paddingStyles[padding])}>
        {children}
      </div>
    </div>
  );
}

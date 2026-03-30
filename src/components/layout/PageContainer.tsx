import { cn } from "@/lib/utils";

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * PageContainer - Contenedor principal estandarizado para el contenido de módulos
 * Proporciona un ancho máximo consistente y márgenes laterales uniformes
 */
export function PageContainer({ children, className }: PageContainerProps) {
  return (
    <div className={cn("space-y-6", className)}>
      {children}
    </div>
  );
}

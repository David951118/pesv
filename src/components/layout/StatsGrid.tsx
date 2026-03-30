import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

interface StatItem {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  iconVariant?: "primary" | "success" | "warning" | "destructive";
  href?: string;
}

interface StatsGridProps {
  stats: StatItem[];
  columns?: 2 | 3 | 4;
  className?: string;
}

const iconVariantStyles = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  destructive: "bg-destructive/10 text-destructive",
};

const columnStyles = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
};

/**
 * StatsGrid - Grid de tarjetas de estadísticas/KPIs estandarizado
 * Diseño limpio con iconos, valores prominentes y subtítulos
 */
export function StatsGrid({ stats, columns = 4, className }: StatsGridProps) {
  return (
    <div className={cn("grid grid-cols-1 gap-5", columnStyles[columns], className)}>
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        const cardClass = cn(
          "bg-card rounded-lg border border-border p-5 shadow-corporate hover:shadow-corporate-md transition-all",
          stat.href && "cursor-pointer hover:border-primary/30",
        );
        const content = (
          <>
            <div className="flex items-start justify-between mb-4">
              <div className={cn("p-3 rounded-lg", iconVariantStyles[stat.iconVariant || "primary"])}>
                <Icon className="h-6 w-6" />
              </div>
              {stat.subtitle && (
                <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded">
                  {stat.subtitle}
                </span>
              )}
            </div>
            <p className="text-3xl font-bold text-foreground tracking-tight">{stat.value}</p>
            <p className="text-sm text-muted-foreground font-medium mt-1">{stat.title}</p>
          </>
        );
        return stat.href ? (
          <Link key={index} to={stat.href} className={cardClass}>
            {content}
          </Link>
        ) : (
          <div key={index} className={cardClass}>
            {content}
          </div>
        );
      })}
    </div>
  );
}

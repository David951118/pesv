import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Database, Radio, Combine } from "lucide-react";
import type { DataSource } from "@/services/cellvi/cellvi.types";

interface DataSourceToggleProps {
  current: DataSource;
  onChange: (source: DataSource) => void;
  cellviConfigured: boolean;
}

const DATA_SOURCES: { id: DataSource; label: string; icon: React.ReactNode; description: string }[] = [
  {
    id: "traccar",
    label: "Traccar",
    icon: <Database className="h-4 w-4" />,
    description: "Solo fuente Traccar (GPS principal)",
  },
  {
    id: "cellvi",
    label: "Cellvi",
    icon: <Radio className="h-4 w-4" />,
    description: "Solo fuente Cellvi",
  },
  {
    id: "mixed",
    label: "Mixto",
    icon: <Combine className="h-4 w-4" />,
    description: "Ambas fuentes combinadas",
  },
];

export function DataSourceToggle({ current, onChange, cellviConfigured }: DataSourceToggleProps) {
  const currentInfo = DATA_SOURCES.find((s) => s.id === current) || DATA_SOURCES[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 bg-card">
          {currentInfo.icon}
          <span className="hidden sm:inline">{currentInfo.label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {DATA_SOURCES.map((source) => {
          const disabled = source.id !== "traccar" && !cellviConfigured;
          return (
            <DropdownMenuItem
              key={source.id}
              onClick={() => !disabled && onChange(source.id)}
              className={`${current === source.id ? "bg-accent" : ""} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
              disabled={disabled}
            >
              <div className="flex items-center gap-2 w-full">
                {source.icon}
                <div className="flex-1">
                  <p className="text-sm font-medium">{source.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {disabled ? "No configurado" : source.description}
                  </p>
                </div>
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

import { ConductorLayout } from "@/components/layout/ConductorLayout";
import { Construction } from "lucide-react";

export default function ConductorFUEC() {
  return (
    <ConductorLayout>
      <div className="text-center py-12">
        <div className="bg-card border border-border rounded-lg p-8 shadow-sm">
          <Construction className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-xl font-bold text-foreground mb-2">FUEC</h1>
          <p className="text-sm text-muted-foreground">
            Este módulo se está migrando al nuevo sistema.
          </p>
        </div>
      </div>
    </ConductorLayout>
  );
}

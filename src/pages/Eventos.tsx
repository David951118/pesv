import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { ModuleHeader } from "@/components/layout/ModuleHeader";
import { ContentCard } from "@/components/layout/ContentCard";
import { AlertTriangle, Construction } from "lucide-react";

export default function Eventos() {
  return (
    <DashboardLayout>
      <PageContainer>
        <ModuleHeader
          title="Eventos de Pánico"
          description="Monitoreo de eventos y alertas"
          icon={AlertTriangle}
          iconVariant="destructive"
        />
        <ContentCard padding="lg">
          <div className="text-center py-12">
            <Construction className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-semibold text-foreground mb-2">Módulo en desarrollo</p>
            <p className="text-sm text-muted-foreground">
              Esta sección se está migrando al nuevo sistema.
            </p>
          </div>
        </ContentCard>
      </PageContainer>
    </DashboardLayout>
  );
}

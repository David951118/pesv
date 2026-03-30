import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { ModuleHeader } from "@/components/layout/ModuleHeader";
import { ContentCard } from "@/components/layout/ContentCard";
import { Radio, Construction } from "lucide-react";

export default function RNDC() {
  return (
    <DashboardLayout>
      <PageContainer>
        <ModuleHeader
          title="RNDC"
          description="Registro Nacional de Despachos de Carga"
          icon={Radio}
          iconVariant="primary"
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

import { useState } from "react";
import { Wrench } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { ModuleHeader } from "@/components/layout/ModuleHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertasTab } from "@/components/mantenimiento/AlertasTab";
import { OrdenesTab } from "@/components/mantenimiento/OrdenesTab";
import { PlanesTab } from "@/components/mantenimiento/PlanesTab";
import { OrdenFormDialog, type OrdenPrefill } from "@/components/mantenimiento/OrdenFormDialog";

export default function Mantenimiento() {
  const [tab, setTab] = useState("alertas");
  const [otDialogOpen, setOtDialogOpen] = useState(false);
  const [otPrefill, setOtPrefill] = useState<OrdenPrefill | null>(null);

  const handleCrearOt = (prefill?: OrdenPrefill) => {
    setOtPrefill(prefill ?? null);
    setOtDialogOpen(true);
  };

  return (
    <DashboardLayout>
      <PageContainer>
        <ModuleHeader
          title="Mantenimiento"
          description="Gestione planes, alertas y órdenes de trabajo de la flota"
          icon={Wrench}
        />

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="alertas">Alertas</TabsTrigger>
            <TabsTrigger value="ordenes">Órdenes de trabajo</TabsTrigger>
            <TabsTrigger value="planes">Planes</TabsTrigger>
          </TabsList>
          <TabsContent value="alertas" className="mt-6">
            <AlertasTab onCrearOt={handleCrearOt} />
          </TabsContent>
          <TabsContent value="ordenes" className="mt-6">
            <OrdenesTab onNuevaOt={() => handleCrearOt()} />
          </TabsContent>
          <TabsContent value="planes" className="mt-6">
            <PlanesTab />
          </TabsContent>
        </Tabs>

        <OrdenFormDialog open={otDialogOpen} onOpenChange={setOtDialogOpen} prefill={otPrefill} />
      </PageContainer>
    </DashboardLayout>
  );
}

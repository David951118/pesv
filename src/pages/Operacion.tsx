import { useState } from "react";
import { Truck } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { ModuleHeader } from "@/components/layout/ModuleHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ViajesTab } from "@/components/operacion/ViajesTab";
import { CombustibleTab } from "@/components/operacion/CombustibleTab";
import { RendimientoTab } from "@/components/operacion/RendimientoTab";
import { RutasTab } from "@/components/operacion/RutasTab";

export default function Operacion() {
  const [tab, setTab] = useState("viajes");

  return (
    <DashboardLayout>
      <PageContainer>
        <ModuleHeader
          title="Operación"
          description="Gestione viajes, combustible y rendimiento de la flota"
          icon={Truck}
        />

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="viajes">Viajes</TabsTrigger>
            <TabsTrigger value="rutas">Rutas</TabsTrigger>
            <TabsTrigger value="combustible">Combustible</TabsTrigger>
            <TabsTrigger value="rendimiento">Rendimiento</TabsTrigger>
          </TabsList>
          <TabsContent value="viajes" className="mt-6">
            <ViajesTab />
          </TabsContent>
          <TabsContent value="rutas" className="mt-6">
            <RutasTab />
          </TabsContent>
          <TabsContent value="combustible" className="mt-6">
            <CombustibleTab />
          </TabsContent>
          <TabsContent value="rendimiento" className="mt-6">
            <RendimientoTab />
          </TabsContent>
        </Tabs>
      </PageContainer>
    </DashboardLayout>
  );
}

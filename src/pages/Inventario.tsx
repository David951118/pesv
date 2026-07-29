import { useState } from "react";
import { Boxes } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { ModuleHeader } from "@/components/layout/ModuleHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RepuestosTab } from "@/components/inventario/RepuestosTab";
import { MovimientosTab, type MovimientosFilter } from "@/components/inventario/MovimientosTab";
import { ConsumosTab } from "@/components/inventario/ConsumosTab";
import { MovimientoFormDialog } from "@/components/inventario/MovimientoFormDialog";
import type { ApiRndcRepuesto } from "@/services/apirndc/apirndc.types";

export default function Inventario() {
  const [tab, setTab] = useState("repuestos");
  const [repuestoFilter, setRepuestoFilter] = useState<MovimientosFilter | null>(null);
  const [movDialogOpen, setMovDialogOpen] = useState(false);

  const handleVerKardex = (repuesto: ApiRndcRepuesto) => {
    setRepuestoFilter({ repuestoId: repuesto._id, repuestoNombre: repuesto.nombre });
    setTab("movimientos");
  };

  return (
    <DashboardLayout>
      <PageContainer>
        <ModuleHeader
          title="Inventario"
          description="Gestione repuestos, movimientos de stock y consumos por vehículo"
          icon={Boxes}
        />

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="repuestos">Repuestos</TabsTrigger>
            <TabsTrigger value="movimientos">Movimientos</TabsTrigger>
            <TabsTrigger value="consumos">Consumos</TabsTrigger>
          </TabsList>
          <TabsContent value="repuestos" className="mt-6">
            <RepuestosTab onVerKardex={handleVerKardex} />
          </TabsContent>
          <TabsContent value="movimientos" className="mt-6">
            <MovimientosTab
              onRegistrar={() => setMovDialogOpen(true)}
              repuestoFilter={repuestoFilter}
              onClearRepuestoFilter={() => setRepuestoFilter(null)}
            />
          </TabsContent>
          <TabsContent value="consumos" className="mt-6">
            <ConsumosTab />
          </TabsContent>
        </Tabs>

        <MovimientoFormDialog open={movDialogOpen} onOpenChange={setMovDialogOpen} prefill={null} />
      </PageContainer>
    </DashboardLayout>
  );
}

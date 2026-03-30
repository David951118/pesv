import { useState } from "react";
import { VehiculosList } from "./VehiculosList";
import { VehiculoDetail } from "./VehiculoDetail";

interface HojaVidaVehiculoProps {
  onBack: () => void;
  initialSelectedId?: string | null;
  onSelectedIdChange?: (id: string | null) => void;
}

export function HojaVidaVehiculo({ onBack, initialSelectedId, onSelectedIdChange }: HojaVidaVehiculoProps) {
  const [selectedVehiculoId, setSelectedVehiculoId] = useState<string | null>(initialSelectedId || null);

  const handleSelectVehiculo = (id: string | null) => {
    setSelectedVehiculoId(id);
    onSelectedIdChange?.(id);
  };

  const handleBack = () => {
    if (selectedVehiculoId) {
      handleSelectVehiculo(null);
    } else {
      onBack();
    }
  };

  if (selectedVehiculoId) {
    return <VehiculoDetail vehiculoId={selectedVehiculoId} onBack={handleBack} />;
  }

  return (
    <VehiculosList 
      onSelectVehiculo={handleSelectVehiculo}
      onBack={handleBack}
    />
  );
}

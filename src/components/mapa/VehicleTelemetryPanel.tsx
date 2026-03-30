import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Fuel,
  Battery,
  Thermometer,
  Gauge,
  Power,
  AlertTriangle,
  Radio,
  Satellite,
  Zap,
  Shield,
  Car,
} from "lucide-react";
import { toast } from "sonner";

interface TelemetryData {
  fuel?: number;
  battery?: number;
  temperature?: number;
  odometer?: number;
  rpm?: number;
  engineHours?: number;
  satellites?: number;
  signalStrength?: number;
  voltage?: number;
}

interface VehicleTelemetryPanelProps {
  vehicleId: string;
  placa: string;
  telemetry: TelemetryData;
  ignition?: boolean | null;
  isOnline?: boolean;
}

export function VehicleTelemetryPanel({
  vehicleId,
  placa,
  telemetry,
  ignition,
  isOnline,
}: VehicleTelemetryPanelProps) {
  const handleRemoteShutdown = () => {
    toast.warning("Apagado Remoto", {
      description: `¿Confirmar apagado remoto de ${placa}? Esta acción detendrá el motor.`,
      action: {
        label: "Confirmar",
        onClick: () => {
          // In production, this would call the backend API
          toast.success("Comando enviado", {
            description: `Señal de apagado enviada a ${placa}. El motor se detendrá en breve.`,
          });
        },
      },
      cancel: {
        label: "Cancelar",
        onClick: () => {},
      },
    });
  };

  const handleEmergencyButton = () => {
    toast.error("🚨 ALERTA DE EMERGENCIA", {
      description: `Activando protocolo de emergencia para ${placa}`,
      action: {
        label: "Confirmar Emergencia",
        onClick: () => {
          toast.success("Emergencia Activada", {
            description: "Se ha notificado a las autoridades y centros de control.",
          });
        },
      },
    });
  };

  const handleImmobilize = () => {
    toast.warning("Inmovilizar Vehículo", {
      description: `¿Bloquear arranque de ${placa}? El vehículo no podrá encender hasta desbloquear.`,
      action: {
        label: "Inmovilizar",
        onClick: () => {
          toast.success("Vehículo inmovilizado", {
            description: "El sistema de arranque ha sido bloqueado remotamente.",
          });
        },
      },
    });
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Car className="h-4 w-4" />
            Telemetría en Tiempo Real
          </CardTitle>
          <Badge variant={isOnline ? "default" : "destructive"}>
            {isOnline ? "Conectado" : "Sin señal"}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Main Gauges */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1 text-muted-foreground">
              <Battery className="h-3.5 w-3.5" />
              Batería
            </span>
            <span className="font-medium">{telemetry.battery ?? 0}%</span>
          </div>
          <Progress 
            value={telemetry.battery ?? 0} 
            className="h-2"
          />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-muted/50 rounded-lg p-2">
            <Thermometer className="h-4 w-4 mx-auto mb-1 text-orange-500" />
            <p className="text-xs text-muted-foreground">Motor</p>
            <p className="text-sm font-semibold">{telemetry.temperature ?? '--'}°C</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-2">
            <Gauge className="h-4 w-4 mx-auto mb-1 text-green-500" />
            <p className="text-xs text-muted-foreground">Odómetro</p>
            <p className="text-sm font-semibold">{telemetry.odometer ? `${(telemetry.odometer/1000).toFixed(0)}k` : '--'}</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-2">
            <Zap className="h-4 w-4 mx-auto mb-1 text-yellow-500" />
            <p className="text-xs text-muted-foreground">Voltaje</p>
            <p className="text-sm font-semibold">{telemetry.voltage ?? '--'}V</p>
          </div>
        </div>

        {/* Signal Info */}
        <div className="flex items-center justify-between text-sm bg-muted/30 rounded-lg p-2">
          <div className="flex items-center gap-2">
            <Satellite className="h-4 w-4 text-primary" />
            <span>{telemetry.satellites ?? 0} satélites</span>
          </div>
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-primary" />
            <span>{telemetry.signalStrength ?? 0}% señal</span>
          </div>
          <div className="flex items-center gap-1">
            <Power className={`h-4 w-4 ${ignition ? 'text-green-500' : 'text-muted-foreground'}`} />
            <span>{ignition ? 'Encendido' : 'Apagado'}</span>
          </div>
        </div>

        <Separator />

        {/* Remote Control Actions */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Control Remoto
          </p>
          <div className="grid grid-cols-3 gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="text-xs h-auto py-2"
              onClick={handleRemoteShutdown}
              disabled={!isOnline || !ignition}
            >
              <Power className="h-3.5 w-3.5 mr-1" />
              Apagar Motor
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="text-xs h-auto py-2"
              onClick={handleImmobilize}
              disabled={!isOnline}
            >
              <Shield className="h-3.5 w-3.5 mr-1" />
              Inmovilizar
            </Button>
            <Button 
              variant="destructive" 
              size="sm" 
              className="text-xs h-auto py-2"
              onClick={handleEmergencyButton}
            >
              <AlertTriangle className="h-3.5 w-3.5 mr-1" />
              Emergencia
            </Button>
          </div>
        </div>

        <p className="text-[10px] text-muted-foreground text-center">
          Las acciones remotas requieren GPS activo y dispositivo conectado
        </p>
      </CardContent>
    </Card>
  );
}

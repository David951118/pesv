import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Construction } from "lucide-react";

export default function ResetPassword() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="bg-card border border-border rounded-lg p-8 text-center shadow-sm max-w-md w-full">
        <Construction className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h1 className="text-xl font-bold text-foreground mb-2">Restablecer Contraseña</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Esta funcionalidad se está migrando al nuevo sistema.
        </p>
        <Button onClick={() => navigate("/auth")}>Volver al inicio de sesión</Button>
      </div>
    </div>
  );
}

import { Construction } from "lucide-react";

export default function FUECPublico() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="bg-card border border-border rounded-lg p-8 text-center shadow-sm max-w-md w-full">
        <Construction className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h1 className="text-xl font-bold text-foreground mb-2">Validación FUEC</h1>
        <p className="text-sm text-muted-foreground">
          Esta funcionalidad se está migrando al nuevo sistema.
        </p>
      </div>
    </div>
  );
}

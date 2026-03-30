import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth, type AppRole } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: AppRole[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // No role assigned
  if (!role) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center">
          <h1 className="text-xl font-bold mb-2">Acceso Pendiente</h1>
          <p className="text-muted-foreground">
            Tu cuenta no tiene un rol asignado. Contacta al administrador.
          </p>
        </div>
      </div>
    );
  }

  // Check role permissions
  if (allowedRoles && !allowedRoles.includes(role)) {
    // Redirect based on role
    if (role === "conductor") {
      return <Navigate to="/conductor/preoperativas" replace />;
    } else {
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
}

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Loader2, AlertCircle, User, Lock } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { z } from "zod";
import { ThemeToggle } from "@/components/ThemeToggle";
import loginBackground from "@/assets/login-background.jpeg";
import logoAsegurar from "@/assets/logos/Asegurar con fecha de creación Png.png";

const authSchema = z.object({
  username: z.string().min(1, "El usuario es requerido"),
  password: z.string().min(1, "La contraseña es requerida"),
});

export default function Auth() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { user, role, loading: authLoading, signIn } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && user) {
      if (role === "conductor") {
        navigate("/conductor/preoperativas", { replace: true });
      } else if (role === "admin" || role === "supervisor") {
        navigate("/", { replace: true });
      }
    }
  }, [user, role, authLoading, navigate]);

  const handleLogin = async () => {
    setError(null);

    const validation = authSchema.safeParse({ username, password });
    if (!validation.success) {
      setError(validation.error.errors[0].message);
      return;
    }

    setLoading(true);

    try {
      const { error } = await signIn(username, password);
      if (error) {
        setError(error.message);
      }
    } catch {
      setError("Ocurrió un error inesperado. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${loginBackground})` }}
      />
      <div className="absolute inset-0 bg-black/30" />

      {/* Theme toggle on login page */}
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle className="text-white hover:bg-white/20" />
      </div>

      <div className="relative z-10 w-full px-4 py-8 sm:px-6 lg:px-8 flex items-center justify-center">
        <Card
          className="w-full max-w-md rounded-2xl border border-gray-200/50 dark:border-gray-700/50"
          style={{
            backgroundColor: "rgba(255, 255, 255, 0.96)",
            boxShadow: "0 10px 40px rgba(0, 0, 0, 0.18), 0 4px 12px rgba(0, 0, 0, 0.1)",
          }}
        >
          <CardHeader className="text-center pb-4">
            <div className="mx-auto mb-8 pt-2">
              <img
                src={logoAsegurar}
                alt="Asegurar Limitada"
                className="h-28 w-auto mx-auto"
              />
            </div>
            <CardTitle className="text-lg font-semibold text-primary tracking-tight">Ingresa con tu usuario y clave de Cellvi</CardTitle>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleLogin();
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="username-login" className="text-foreground font-medium">
                  Usuario
                </Label>
                <div className="flex items-center gap-3">
                  <User className="h-5 w-5 text-primary shrink-0" />
                  <Input
                    id="username-login"
                    type="text"
                    placeholder="Usuario"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={loading}
                    required
                    className="bg-background border-border h-11"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password-login" className="text-foreground font-medium">
                  Contraseña
                </Label>
                <div className="flex items-center gap-3">
                  <Lock className="h-5 w-5 text-primary shrink-0" />
                  <Input
                    id="password-login"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    required
                    className="bg-background border-border h-11"
                  />
                </div>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                Si olvidaste tu contraseña, contacta al administrador.
              </p>

              <Button type="submit" className="w-full mt-6 h-12 text-base font-bold" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Ingresando...
                  </>
                ) : (
                  "Iniciar Sesión"
                )}
              </Button>
              <p className="text-center text-xs text-slate-400 dark:text-slate-500 mt-4">
                Acceso seguro · Plataforma corporativa
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

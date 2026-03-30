import { ReactNode, useState, useEffect, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ClipboardCheck, FileText, LogOut, User, UserCircle, FolderOpen, ShieldAlert, AlertTriangle, XCircle, CheckCircle, X, FileWarning } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { getApiRndcBaseUrl } from "@/services/apirndc/apirndc.config";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ThemeToggle";

interface ConductorLayoutProps {
  children: ReactNode;
}

const navItems = [
  { title: "Preoperativas", href: "/conductor/preoperativas", icon: ClipboardCheck },
  { title: "Documentos", href: "/conductor/documentos", icon: FolderOpen },
  { title: "FUEC", href: "/conductor/fuec", icon: FileText },
  { title: "Perfil", href: "/conductor/configuracion", icon: UserCircle },
];

interface ValidationItem {
  campo: string;
  mensaje: string;
}

interface VehicleValidation {
  placa: string;
  autorizado: boolean;
  errores: ValidationItem[];
  alertas: ValidationItem[];
}

const SESSION_KEY = "conductor-validation-shown";

export function ConductorLayout({ children }: ConductorLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, bearerToken, conductorId, signOut } = useAuth();
  const [showPopup, setShowPopup] = useState(false);
  const [validations, setValidations] = useState<VehicleValidation[]>([]);

  const runValidation = useCallback(async () => {
    if (!bearerToken || !conductorId || !user?.vehiculos?.length) return;
    if (sessionStorage.getItem(SESSION_KEY)) return;

    const base = getApiRndcBaseUrl();

    // First resolve cellvi vehicles to get their _ids
    const vehiculoIds: { _id: string; placa: string }[] = [];
    await Promise.all(
      user.vehiculos.map(async (v) => {
        try {
          const res = await fetch(`${base}/api/vehiculos/cellvi/${v.id}`, {
            headers: { Authorization: `Bearer ${bearerToken}` },
          });
          if (!res.ok) return;
          const json = await res.json();
          const raw = Array.isArray(json.data) ? json.data[0] : json.data;
          if (raw?._id) vehiculoIds.push({ _id: raw._id, placa: raw.placa || v.placa });
        } catch { /* skip */ }
      })
    );

    if (vehiculoIds.length === 0) {
      sessionStorage.setItem(SESSION_KEY, "1");
      return;
    }

    // Validate each vehicle
    const results: VehicleValidation[] = [];
    await Promise.all(
      vehiculoIds.map(async (v) => {
        try {
          const res = await fetch(`${base}/api/preoperacionales/validar/${v._id}/${conductorId}`, {
            headers: { Authorization: `Bearer ${bearerToken}` },
          });
          if (!res.ok) return;
          const json = await res.json();
          const data = json.data;
          if (data && (data.errores?.length > 0 || data.alertas?.length > 0)) {
            results.push({
              placa: v.placa,
              autorizado: data.autorizado,
              errores: data.errores || [],
              alertas: data.alertas || [],
            });
          }
        } catch { /* skip */ }
      })
    );

    sessionStorage.setItem(SESSION_KEY, "1");

    if (results.length > 0) {
      setValidations(results);
      setShowPopup(true);
    }
  }, [bearerToken, conductorId, user?.vehiculos]);

  useEffect(() => {
    runValidation();
  }, [runValidation]);

  const hasErrors = validations.some((v) => v.errores.length > 0);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-primary text-primary-foreground shadow-lg sticky top-0 z-50">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2">
            <User className="h-5 w-5" />
            <span className="font-semibold text-sm truncate max-w-[150px]">
              {user?.persona || user?.username}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle className="text-primary-foreground hover:bg-primary-foreground/10" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                sessionStorage.removeItem(SESSION_KEY);
                signOut();
              }}
              className="text-primary-foreground hover:bg-primary-foreground/10"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-4 pb-20">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border shadow-lg safe-area-inset-bottom">
        <div className="flex items-center justify-around h-16">
          {navItems.map((item) => {
            const isActive = location.pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className={cn("h-6 w-6", isActive && "scale-110")} />
                <span className="text-xs font-medium">{item.title}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Validation Popup */}
      {showPopup && (
        <ValidationPopup
          validations={validations}
          hasErrors={hasErrors}
          onClose={() => setShowPopup(false)}
          onGoToDocuments={() => {
            setShowPopup(false);
            navigate("/conductor/documentos");
          }}
        />
      )}
    </div>
  );
}

// ── Validation Popup ──

function ValidationPopup({
  validations,
  hasErrors,
  onClose,
  onGoToDocuments,
}: {
  validations: VehicleValidation[];
  hasErrors: boolean;
  onClose: () => void;
  onGoToDocuments: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Content */}
      <div className="relative bg-card border rounded-2xl shadow-2xl w-full max-w-sm max-h-[80vh] overflow-y-auto">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1 rounded-full hover:bg-muted transition-colors"
        >
          <X className="h-5 w-5 text-muted-foreground" />
        </button>

        {/* Header */}
        <div className={`p-5 pb-3 ${hasErrors ? "bg-red-50 dark:bg-red-950/20" : "bg-amber-50 dark:bg-amber-950/20"} rounded-t-2xl`}>
          <div className="flex items-center gap-3">
            {hasErrors ? (
              <div className="p-2.5 rounded-full bg-red-100 dark:bg-red-900/40">
                <ShieldAlert className="h-6 w-6 text-red-600" />
              </div>
            ) : (
              <div className="p-2.5 rounded-full bg-amber-100 dark:bg-amber-900/40">
                <AlertTriangle className="h-6 w-6 text-amber-600" />
              </div>
            )}
            <div>
              <h2 className="text-lg font-bold text-foreground">
                {hasErrors ? "Documentos con problemas" : "Alertas de documentos"}
              </h2>
              <p className="text-xs text-muted-foreground">
                Verificación al iniciar sesión
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {validations.map((v, vi) => (
            <div key={vi} className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono">{v.placa}</Badge>
                {v.autorizado ? (
                  <Badge variant="secondary" className="text-xs">Con alertas</Badge>
                ) : (
                  <Badge variant="destructive" className="text-xs">No autorizado</Badge>
                )}
              </div>

              {/* Errors */}
              {v.errores.map((err, i) => (
                <div key={`e-${i}`} className="flex items-start gap-2 bg-red-50 dark:bg-red-900/15 border border-red-200 dark:border-red-800 rounded-lg p-2.5">
                  <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-red-800 dark:text-red-300">{err.campo}</p>
                    <p className="text-xs text-red-600 dark:text-red-400">{err.mensaje}</p>
                  </div>
                </div>
              ))}

              {/* Alerts */}
              {v.alertas.map((alerta, i) => (
                <div key={`a-${i}`} className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-800 rounded-lg p-2.5">
                  <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-300">{alerta.campo}</p>
                    <p className="text-xs text-amber-600 dark:text-amber-400">{alerta.mensaje}</p>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="p-4 pt-0 space-y-2">
          {hasErrors && (
            <Button onClick={onGoToDocuments} className="w-full gap-2" variant="destructive">
              <FileWarning className="h-4 w-4" />
              Ir a Documentos
            </Button>
          )}
          <Button onClick={onClose} variant={hasErrors ? "outline" : "default"} className="w-full gap-2">
            {hasErrors ? "Cerrar" : (
              <>
                <CheckCircle className="h-4 w-4" />
                Entendido
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

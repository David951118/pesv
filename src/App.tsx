import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { BrandingProvider } from "@/hooks/useEmpresaBranding";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Admin/Supervisor pages
import Index from "./pages/Index";
import Documentos from "./pages/Documentos";
import Preoperativas from "./pages/Preoperativas";
import NuevaPreoperacionalAdmin from "./pages/admin/NuevaPreoperacionalAdmin";

import FUEC from "./pages/FUEC";
import Mapa from "./pages/Mapa";
import Usuarios from "./pages/Usuarios";
import Vehiculos from "./pages/Vehiculos";
import Mantenimiento from "./pages/Mantenimiento";
import Inventario from "./pages/Inventario";
import Operacion from "./pages/Operacion";
import Auditoria from "./pages/Auditoria";
import Estadisticas from "./pages/Estadisticas";
import Empresas from "./pages/Empresas";
import Papelera from "./pages/Papelera";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";

// Public pages
import FUECPublico from "./pages/FUECPublico";
import VerificarPreoperacional from "./pages/public/VerificarPreoperacional";
import VerificarContrato from "./pages/public/VerificarContrato";

// Conductor pages
import ConductorPreoperativas from "./pages/conductor/ConductorPreoperativas";
import ConductorDocumentos from "./pages/conductor/ConductorDocumentos";
import ConductorFUEC from "./pages/conductor/ConductorFUEC";
import ConductorConfiguracion from "./pages/conductor/ConductorConfiguracion";
import ConductorCombustible from "./pages/conductor/ConductorCombustible";
import ConductorMantenimiento from "./pages/conductor/ConductorMantenimiento";

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <BrandingProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Auth */}
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Public routes - No authentication required */}
            <Route path="/fuec/validar/:numero" element={<FUECPublico />} />
            <Route path="/verificar/preoperacional/:codigo" element={<VerificarPreoperacional />} />
            <Route path="/verificar/contrato/:codigo" element={<VerificarContrato />} />

            {/* Dashboard — both admin and supervisor */}
            <Route
              path="/"
              element={
                <ProtectedRoute allowedRoles={["admin", "supervisor"]}>
                  <Index />
                </ProtectedRoute>
              }
            />

            {/* Supervisor-only operational routes */}
            <Route
              path="/preoperativas"
              element={
                <ProtectedRoute allowedRoles={["supervisor", "mecanico"]}>
                  <Preoperativas />
                </ProtectedRoute>
              }
            />
            <Route
              path="/preoperativas/nueva"
              element={
                <ProtectedRoute allowedRoles={["admin", "supervisor"]}>
                  <NuevaPreoperacionalAdmin />
                </ProtectedRoute>
              }
            />
            <Route
              path="/fuec"
              element={
                <ProtectedRoute allowedRoles={["supervisor"]}>
                  <FUEC />
                </ProtectedRoute>
              }
            />
            <Route
              path="/mapa"
              element={
                <ProtectedRoute allowedRoles={["supervisor"]}>
                  <Mapa />
                </ProtectedRoute>
              }
            />
{/* Shared management — admin and supervisor */}
            <Route
              path="/documentos"
              element={
                <ProtectedRoute allowedRoles={["admin", "supervisor"]}>
                  <Documentos />
                </ProtectedRoute>
              }
            />
            <Route
              path="/vehiculos"
              element={
                <ProtectedRoute allowedRoles={["admin", "supervisor"]}>
                  <Vehiculos />
                </ProtectedRoute>
              }
            />
            <Route
              path="/mantenimiento"
              element={
                <ProtectedRoute allowedRoles={["admin", "supervisor", "mecanico"]}>
                  <Mantenimiento />
                </ProtectedRoute>
              }
            />
            <Route
              path="/inventario"
              element={
                <ProtectedRoute allowedRoles={["admin", "supervisor", "mecanico"]}>
                  <Inventario />
                </ProtectedRoute>
              }
            />
            <Route
              path="/operacion"
              element={
                <ProtectedRoute allowedRoles={["admin", "supervisor"]}>
                  <Operacion />
                </ProtectedRoute>
              }
            />
            <Route
              path="/usuarios"
              element={
                <ProtectedRoute allowedRoles={["admin", "supervisor"]}>
                  <Usuarios />
                </ProtectedRoute>
              }
            />
            <Route
              path="/auditoria"
              element={
                <ProtectedRoute allowedRoles={["admin", "supervisor"]}>
                  <Auditoria />
                </ProtectedRoute>
              }
            />
            <Route
              path="/estadisticas"
              element={
                <ProtectedRoute allowedRoles={["admin", "supervisor"]}>
                  <Estadisticas />
                </ProtectedRoute>
              }
            />

            {/* Admin-only routes */}
            <Route
              path="/empresas"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <Empresas />
                </ProtectedRoute>
              }
            />
            <Route
              path="/papelera"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <Papelera />
                </ProtectedRoute>
              }
            />

            {/* Conductor routes */}
            <Route
              path="/conductor/preoperativas"
              element={
                <ProtectedRoute allowedRoles={["conductor"]}>
                  <ConductorPreoperativas />
                </ProtectedRoute>
              }
            />
            <Route
              path="/conductor/documentos"
              element={
                <ProtectedRoute allowedRoles={["conductor"]}>
                  <ConductorDocumentos />
                </ProtectedRoute>
              }
            />
            <Route
              path="/conductor/combustible"
              element={
                <ProtectedRoute allowedRoles={["conductor"]}>
                  <ConductorCombustible />
                </ProtectedRoute>
              }
            />
            <Route
              path="/conductor/mantenimiento"
              element={
                <ProtectedRoute allowedRoles={["conductor"]}>
                  <ConductorMantenimiento />
                </ProtectedRoute>
              }
            />
            <Route
              path="/conductor/fuec"
              element={
                <ProtectedRoute allowedRoles={["conductor"]}>
                  <ConductorFUEC />
                </ProtectedRoute>
              }
            />
            <Route
              path="/conductor/configuracion"
              element={
                <ProtectedRoute allowedRoles={["conductor"]}>
                  <ConductorConfiguracion />
                </ProtectedRoute>
              }
            />
            
            {/* Redirect /conductor to preoperativas */}
            <Route path="/conductor" element={<Navigate to="/conductor/preoperativas" replace />} />

            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
      </BrandingProvider>
    </AuthProvider>
  </QueryClientProvider>
  </ErrorBoundary>
);

export default App;

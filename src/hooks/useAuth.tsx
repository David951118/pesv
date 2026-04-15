import { useState, useEffect, useCallback, useRef, createContext, useContext, ReactNode } from "react";
import { getApiRndcBaseUrl } from "@/services/apirndc/apirndc.config";

export type AppRole = "admin" | "conductor" | "supervisor";

const AUTH_STORAGE_KEY = "auth_data";

// Refresh 5 minutes before expiration
const REFRESH_BUFFER_MS = 5 * 60_000;

// ── Role mapping ──

export const API_ROLE_MAP: Record<string, { appRole: AppRole; priority: number }> = {
  ROLE_ADMIN:        { appRole: "admin",      priority: 3 },
  ROLE_CLIENTE_ADMIN:{ appRole: "supervisor",  priority: 2 },
  ROLE_CLIENTE:      { appRole: "conductor",   priority: 1 },
  ROLE_USER:         { appRole: "conductor",   priority: 0 },
};

export function mapApiRolesToAppRole(apiRoles: string[]): AppRole {
  let best: { appRole: AppRole; priority: number } | null = null;
  for (const r of apiRoles) {
    const mapped = API_ROLE_MAP[r];
    if (mapped && (!best || mapped.priority > best.priority)) {
      best = mapped;
    }
  }
  return best?.appRole ?? "conductor";
}

// ── Types ──

interface Vehiculo {
  id: number;
  placa: string;
}

interface StoredAuth {
  bearerToken: string;
  cellviToken: string;
  expiresAt: string;
  username: string;
  persona: string;
  userId: string;
  empresaId: string;
  terceroId: string;
  vehiculos: Vehiculo[];
  apiRoles: string[];
  role: AppRole;
}

interface AuthUser {
  username: string;
  persona: string;
  userId: string;
  empresaId: string;
  terceroId: string;
  vehiculos: Vehiculo[];
  apiRoles: string[];
}

interface AuthContextType {
  user: AuthUser | null;
  bearerToken: string | null;
  cellviToken: string | null;
  role: AppRole | null;
  empresaId: string | null;
  conductorId: string | null;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

function getStoredAuth(): StoredAuth | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveStoredAuth(auth: StoredAuth) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [bearerToken, setBearerToken] = useState<string | null>(null);
  const [cellviToken, setCellviToken] = useState<string | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [conductorId, setConductorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearSession = useCallback(() => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setUser(null);
    setBearerToken(null);
    setCellviToken(null);
    setRole(null);
    setEmpresaId(null);
    setConductorId(null);
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  const applySession = useCallback((stored: StoredAuth) => {
    setUser({
      username: stored.username,
      persona: stored.persona,
      userId: stored.userId,
      empresaId: stored.empresaId,
      terceroId: stored.terceroId,
      vehiculos: stored.vehiculos ?? [],
      apiRoles: stored.apiRoles ?? [],
    });
    setBearerToken(stored.bearerToken);
    setCellviToken(stored.cellviToken);
    setRole(stored.role);
    setEmpresaId(stored.empresaId);
    if (stored.role === "conductor") {
      setConductorId(stored.terceroId);
    }
  }, []);

  // ── Token refresh ──

  const refreshToken = useCallback(async () => {
    const stored = getStoredAuth();
    if (!stored?.bearerToken) {
      clearSession();
      return;
    }

    try {
      const base = getApiRndcBaseUrl();
      const res = await fetch(`${base}/api/auth/refresh`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stored.bearerToken}`,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        // Token invalid/expired server-side, force logout
        clearSession();
        return;
      }

      const data = await res.json();
      if (!data.success) {
        clearSession();
        return;
      }

      // Update stored auth with new token and expiration
      const updated: StoredAuth = {
        ...stored,
        bearerToken: data.token ?? stored.bearerToken,
        cellviToken: data.cellviToken ?? stored.cellviToken,
        expiresAt: data.expiresAt ?? stored.expiresAt,
      };
      saveStoredAuth(updated);
      applySession(updated);
      scheduleRefresh(updated.expiresAt);
    } catch {
      // Network error — don't logout, retry later
      scheduleRefresh(stored.expiresAt);
    }
  }, [clearSession, applySession]);

  const scheduleRefresh = useCallback((expiresAt: string) => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    if (!expiresAt) return;

    const expiresMs = new Date(expiresAt).getTime();
    const refreshAt = expiresMs - REFRESH_BUFFER_MS;
    const delay = refreshAt - Date.now();

    if (delay <= 0) {
      // Already past refresh window — try immediately
      refreshToken();
      return;
    }

    refreshTimerRef.current = setTimeout(() => {
      refreshToken();
    }, delay);
  }, [refreshToken]);

  // ── Restore session on mount ──

  useEffect(() => {
    const stored = getStoredAuth();
    if (stored) {
      if (stored.expiresAt && new Date(stored.expiresAt) <= new Date()) {
        // Token expired — try a refresh before giving up
        refreshToken().finally(() => setLoading(false));
        return;
      }
      applySession(stored);
      scheduleRefresh(stored.expiresAt);
    }
    setLoading(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, []);

  const signIn = async (username: string, password: string) => {
    try {
      const base = getApiRndcBaseUrl();
      const res = await fetch(`${base}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        return { error: new Error("Credenciales inválidas. Verifica tu usuario y contraseña.") };
      }

      const data = await res.json();
      if (!data.success) {
        return { error: new Error(data.message || "Error de autenticación.") };
      }

      const apiRoles: string[] = data.user?.roles ?? [];
      const computedRole = mapApiRolesToAppRole(apiRoles);

      const storedAuth: StoredAuth = {
        bearerToken: data.token ?? "",
        cellviToken: data.cellviToken ?? "",
        expiresAt: data.expiresAt ?? "",
        username,
        persona: data.user?.persona ?? username,
        userId: data.user?.userId ?? username,
        empresaId: data.user?.empresaId ?? "",
        terceroId: data.user?.terceroId ?? "",
        vehiculos: data.user?.vehiculos ?? [],
        apiRoles,
        role: computedRole,
      };
      saveStoredAuth(storedAuth);
      applySession(storedAuth);
      scheduleRefresh(storedAuth.expiresAt);

      return { error: null };
    } catch {
      return { error: new Error("Error de conexión con el servidor.") };
    }
  };

  const signOut = async () => {
    clearSession();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        bearerToken,
        cellviToken,
        role,
        empresaId,
        conductorId,
        loading,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

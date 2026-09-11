/**
 * ApiRdnc client.
 *
 * Calls ApiRdnc directly (no proxy).
 */
import { getApiRndcBaseUrl } from './apirndc.config';

/** JWT token cache. */
let cachedToken: string | null = null;
let tokenExp = 0;

/**
 * Returns the bearer token of the logged-in session (managed by useAuth),
 * or null when there is no valid session stored.
 */
function getSessionToken(): string | null {
  try {
    const raw = localStorage.getItem('auth_data');
    if (!raw) return null;
    const stored = JSON.parse(raw) as { bearerToken?: string; expiresAt?: string };
    if (!stored.bearerToken) return null;
    if (stored.expiresAt && new Date(stored.expiresAt) <= new Date()) return null;
    return stored.bearerToken;
  } catch {
    return null;
  }
}

/**
 * Intenta refrescar el token de la sesión contra /api/auth/refresh.
 * Comparte una única promesa en vuelo para que varias peticiones que reciben
 * 401 a la vez no disparen refrescos en paralelo (que se pisarían al rotar el
 * token). Devuelve el nuevo bearer token o null si el refresh no fue posible.
 */
let refreshInFlight: Promise<string | null> | null = null;
async function tryRefreshToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const raw = localStorage.getItem('auth_data');
      if (!raw) return null;
      const stored = JSON.parse(raw) as {
        bearerToken?: string;
        cellviToken?: string;
        expiresAt?: string;
      };
      if (!stored.bearerToken) return null;

      const base = getApiRndcBaseUrl();
      const res = await fetch(`${base}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${stored.bearerToken}`,
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (!data.success || !data.token) return null;

      const updated = {
        ...stored,
        bearerToken: data.token as string,
        cellviToken: data.cellviToken ?? stored.cellviToken,
        expiresAt: data.expiresAt ?? stored.expiresAt,
      };
      localStorage.setItem('auth_data', JSON.stringify(updated));
      return data.token as string;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

/**
 * Señala a la app (useAuth) que la sesión murió definitivamente para que cierre
 * sesión de forma limpia, en vez de dejar peticiones fallando en silencio.
 */
function notifySessionExpired() {
  try {
    localStorage.removeItem('auth_data');
    window.dispatchEvent(new Event('auth:expired'));
  } catch {
    /* no-op */
  }
}

/** Authenticate with ApiRdnc. Prefers the logged-in session token. */
async function getToken(): Promise<string> {
  const sessionToken = getSessionToken();
  if (sessionToken) return sessionToken;

  // Sesión existe pero está vencida localmente: intentar refrescarla antes de
  // caer al login con credenciales de desarrollo (que en producción no existen).
  if (localStorage.getItem('auth_data')) {
    const refreshed = await tryRefreshToken();
    if (refreshed) return refreshed;
  }

  if (cachedToken && Date.now() < tokenExp) return cachedToken;

  const base = getApiRndcBaseUrl();
  const user = import.meta.env.VITE_APIRNDC_DEV_USERNAME as string | undefined;
  const pass = import.meta.env.VITE_APIRNDC_DEV_PASSWORD as string | undefined;

  if (!user || !pass) {
    throw new Error('ApiRdnc credentials not configured. Set VITE_APIRNDC_DEV_USERNAME and VITE_APIRNDC_DEV_PASSWORD.');
  }

  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: user, password: pass }),
  });

  if (!res.ok) throw new Error(`ApiRdnc login failed: ${res.status}`);
  const json = await res.json();
  cachedToken = json.token;
  tokenExp = Date.now() + 28 * 60 * 1000;
  return cachedToken!;
}

/**
 * Generic caller — calls API directly.
 */
export async function apirndcProxyCall<T = unknown>(
  method: string,
  path: string,
  payload?: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  const token = await getToken();
  const base = getApiRndcBaseUrl();

  let url = `${base}/api${path.replace(/^\/api/, '')}`;

  if (method === 'GET' && payload) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(payload)) {
      if (v !== undefined && v !== null) params.append(k, String(v));
    }
    const qs = params.toString();
    if (qs) url += `?${qs}`;
  }

  const init: RequestInit = {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    signal,
  };

  if (method !== 'GET' && payload) {
    init.body = JSON.stringify(payload);
  }

  let res = await fetch(url, init);

  // Sesión vencida a mitad de camino (timer de refresh no disparó por pestaña
  // en segundo plano, equipo suspendido, etc.): intentar refrescar una vez y
  // reintentar la misma petición antes de propagar el error.
  if (res.status === 401 && localStorage.getItem('auth_data')) {
    const newToken = await tryRefreshToken();
    if (newToken) {
      (init.headers as Record<string, string>).Authorization = `Bearer ${newToken}`;
      res = await fetch(url, init);
    }
    // Si tras el refresh sigue 401, la sesión murió de verdad → cerrar limpio.
    if (res.status === 401) notifySessionExpired();
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    try {
      const json = JSON.parse(text) as {
        message?: string;
        error?: string;
        details?: { field?: string; message?: string }[];
      };
      // Los errores de validación del API traen el motivo en `details`
      // (p. ej. "El objeto archivo es obligatorio"); `error` solo dice
      // "Error de Validación", que no le sirve al usuario.
      const detalle = Array.isArray(json.details)
        ? json.details.map((d) => d.message).filter(Boolean).join('; ')
        : '';
      const mensaje = json.message || detalle || json.error;
      if (mensaje) throw new Error(mensaje);
    } catch (err) {
      if (err instanceof Error && err.message && !(err instanceof SyntaxError)) throw err;
    }
    throw new Error(`ApiRdnc ${method} ${path}: ${res.status} ${text}`);
  }
  return res.json();
}

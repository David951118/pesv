/**
 * ApiRdnc client.
 *
 * Calls ApiRdnc directly (no proxy).
 */
import { getApiRndcBaseUrl } from './apirndc.config';

/** JWT token cache. */
let cachedToken: string | null = null;
let tokenExp = 0;

/** Authenticate with ApiRdnc. */
async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExp) return cachedToken;

  const base = getApiRndcBaseUrl();
  const user = import.meta.env.VITE_APIRNDC_DEV_USERNAME || 'rndc';
  const pass = import.meta.env.VITE_APIRNDC_DEV_PASSWORD || 'rndc2';

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

  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`ApiRdnc ${method} ${path}: ${res.status} ${text}`);
  }
  return res.json();
}

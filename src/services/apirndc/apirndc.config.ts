/**
 * ApiRdnc configuration check.
 *
 * Credentials are managed server-side in the backend.
 * This module checks if the integration is enabled and provides the base URL.
 */

/**
 * Returns true if the ApiRdnc integration is enabled.
 * Controlled by VITE_APIRNDC_ENABLED env var.
 * This flag contains NO secrets — just "true" or "false".
 */
export function isApiRndcEnabled(): boolean {
  const flag = import.meta.env.VITE_APIRNDC_ENABLED as string | undefined;
  return flag === 'true';
}

/**
 * Returns the base URL for ApiRdnc direct calls (no proxy).
 * Reads VITE_APIRNDC_BASE_URL, defaults to https://rndc.asegurar.com.co
 */
export function getApiRndcBaseUrl(): string {
  const url = import.meta.env.VITE_APIRNDC_BASE_URL as string | undefined;
  return (url || 'https://rndc.asegurar.com.co').replace(/\/+$/, '');
}

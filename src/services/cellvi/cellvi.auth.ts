/**
 * Cellvi configuration check.
 *
 * Credentials are managed server-side in the backend.
 * This module only checks if the integration is enabled via env flag.
 */

/**
 * Returns true if the Cellvi integration is enabled.
 * Controlled by VITE_CELLVI_ENABLED env var ("true" / "false").
 */
export function isCellviConfigured(): boolean {
  // If the flag is explicitly "false" or missing, Cellvi is disabled.
  // This flag contains NO secrets — just "true" or "false".
  const flag = import.meta.env.VITE_CELLVI_ENABLED as string | undefined;
  return flag === "true";
}

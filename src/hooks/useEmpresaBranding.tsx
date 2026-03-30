import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "./useAuth";
import { getApiRndcBaseUrl } from "@/services/apirndc/apirndc.config";

export interface EmpresaBranding {
  colorPrimary: string;
  colorPrimaryDark: string;
  colorAccent: string;
  logoKey: string;
  eslogan: string;
}

export interface EmpresaFull {
  _id: string;
  nit: string;
  razonSocial: string;
  nombreComercial?: string;
  tipoEmpresa?: string;
  estado?: string;
  branding?: Partial<EmpresaBranding>;
}

export const DEFAULT_BRANDING: EmpresaBranding = {
  colorPrimary: "#0B5EA8",
  colorPrimaryDark: "#0A2E52",
  colorAccent: "#FFD400",
  logoKey: "asegurar",
  eslogan: "Defensa Predictiva 24/7",
};

/** Convert hex (#RRGGBB) to HSL string "H S% L%" */
function hexToHsl(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return "";
  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/** Apply branding colors as CSS custom properties on :root */
export function applyBrandingToDOM(branding: Partial<EmpresaBranding>) {
  const root = document.documentElement;
  const merged = { ...DEFAULT_BRANDING, ...branding };

  if (merged.colorPrimary) {
    const hsl = hexToHsl(merged.colorPrimary);
    if (hsl) {
      root.style.setProperty("--primary", hsl);
      root.style.setProperty("--ring", hsl);
      root.style.setProperty("--brand-primary", hsl);
      root.style.setProperty("--sidebar-primary", hsl);
      root.style.setProperty("--sidebar-ring", hsl);
      root.style.setProperty("--nav-hover", hsl);
      root.style.setProperty("--nav-active", hsl);
    }
  }

  if (merged.colorPrimaryDark) {
    const hsl = hexToHsl(merged.colorPrimaryDark);
    if (hsl) {
      root.style.setProperty("--nav-background", hsl);
      root.style.setProperty("--brand-dark", hsl);
    }
  }

  if (merged.colorAccent) {
    const hsl = hexToHsl(merged.colorAccent);
    if (hsl) {
      root.style.setProperty("--accent", hsl);
      root.style.setProperty("--brand-accent", hsl);
    }
  }
}

/** Remove custom branding from DOM (restore CSS defaults) */
export function clearBrandingFromDOM() {
  const root = document.documentElement;
  const props = [
    "--primary", "--ring", "--brand-primary", "--sidebar-primary",
    "--sidebar-ring", "--nav-hover", "--nav-active",
    "--nav-background", "--brand-dark",
    "--accent", "--brand-accent",
  ];
  props.forEach((p) => root.style.removeProperty(p));
}

// ── Context ──

interface BrandingContextType {
  empresa: EmpresaFull | null;
  branding: EmpresaBranding;
  loading: boolean;
}

const BrandingContext = createContext<BrandingContextType>({
  empresa: null,
  branding: DEFAULT_BRANDING,
  loading: false,
});

export function BrandingProvider({ children }: { children: ReactNode }) {
  const { bearerToken, empresaId, role, loading: authLoading } = useAuth();
  const [empresa, setEmpresa] = useState<EmpresaFull | null>(null);
  const [branding, setBranding] = useState<EmpresaBranding>(DEFAULT_BRANDING);
  const [fetching, setFetching] = useState(false);
  const hasFetched = useRef(false);

  useEffect(() => {
    // Admin sees platform defaults, not empresa branding
    if (role === "admin" || !empresaId || !bearerToken) {
      clearBrandingFromDOM();
      setBranding(DEFAULT_BRANDING);
      setEmpresa(null);
      setFetching(false);
      return;
    }

    setFetching(true);
    const base = getApiRndcBaseUrl();
    fetch(`${base}/api/empresas/${empresaId}`, {
      headers: { Authorization: `Bearer ${bearerToken}` },
    })
      .then((res) => res.json())
      .then((json) => {
        const data: EmpresaFull = json.success ? json.data : json;
        setEmpresa(data);
        const merged = { ...DEFAULT_BRANDING, ...(data.branding || {}) };
        setBranding(merged);
        applyBrandingToDOM(merged);
      })
      .catch(() => {
        // Silently use defaults
      })
      .finally(() => {
        hasFetched.current = true;
        setFetching(false);
      });

    return () => {
      clearBrandingFromDOM();
    };
  }, [bearerToken, empresaId, role]);

  // Show loading if: auth is still loading, OR we're fetching branding for the first time
  const loading = authLoading || (fetching && !hasFetched.current);

  return (
    <BrandingContext.Provider value={{ empresa, branding, loading }}>
      {children}
    </BrandingContext.Provider>
  );
}

/** Hook: reads empresa branding from context (shared, single fetch) */
export function useEmpresaBranding() {
  return useContext(BrandingContext);
}

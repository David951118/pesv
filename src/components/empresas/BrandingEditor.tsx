import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, RotateCcw, Home, Users, FileText, LogOut, Check } from "lucide-react";
import { LOGO_OPTIONS, getLogoSrc } from "@/assets/logos";
import type { EmpresaBranding } from "@/hooks/useEmpresaBranding";
import { DEFAULT_BRANDING } from "@/hooks/useEmpresaBranding";
import { cn } from "@/lib/utils";

interface BrandingEditorProps {
  initialBranding: Partial<EmpresaBranding>;
  empresaNombre: string;
  saving: boolean;
  onSave: (branding: Partial<EmpresaBranding>) => void;
}

const PRESET_PALETTES = [
  { name: "Azul Asegurar", primary: "#0B5EA8", dark: "#0A2E52", accent: "#FFD400" },
  { name: "Verde Corporativo", primary: "#1B7A3D", dark: "#0F4D25", accent: "#FFD400" },
  { name: "Rojo Ejecutivo", primary: "#B91C1C", dark: "#7F1D1D", accent: "#F59E0B" },
  { name: "Morado Moderno", primary: "#7C3AED", dark: "#4C1D95", accent: "#F59E0B" },
  { name: "Teal Profesional", primary: "#0D9488", dark: "#134E4A", accent: "#FBBF24" },
  { name: "Naranja Energico", primary: "#EA580C", dark: "#7C2D12", accent: "#3B82F6" },
];

function darkenHex(hex: string, amount: number): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return hex;
  const r = Math.max(0, Math.round(parseInt(result[1], 16) * (1 - amount)));
  const g = Math.max(0, Math.round(parseInt(result[2], 16) * (1 - amount)));
  const b = Math.max(0, Math.round(parseInt(result[3], 16) * (1 - amount)));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

export function BrandingEditor({ initialBranding, empresaNombre, saving, onSave }: BrandingEditorProps) {
  const [branding, setBranding] = useState<Partial<EmpresaBranding>>({
    ...DEFAULT_BRANDING,
    ...initialBranding,
  });

  useEffect(() => {
    setBranding({ ...DEFAULT_BRANDING, ...initialBranding });
  }, [initialBranding]);

  const update = (field: keyof EmpresaBranding, value: string) => {
    const next = { ...branding, [field]: value };
    if (field === "colorPrimary" && value.match(/^#[a-f\d]{6}$/i)) {
      next.colorPrimaryDark = darkenHex(value, 0.45);
    }
    setBranding(next);
  };

  const applyPreset = (preset: typeof PRESET_PALETTES[0]) => {
    setBranding({
      ...branding,
      colorPrimary: preset.primary,
      colorPrimaryDark: preset.dark,
      colorAccent: preset.accent,
    });
  };

  const resetDefaults = () => {
    setBranding({ ...DEFAULT_BRANDING });
  };

  const primary = branding.colorPrimary || DEFAULT_BRANDING.colorPrimary;
  const dark = branding.colorPrimaryDark || DEFAULT_BRANDING.colorPrimaryDark;
  const accent = branding.colorAccent || DEFAULT_BRANDING.colorAccent;
  const selectedLogo = branding.logoKey || DEFAULT_BRANDING.logoKey;

  return (
    <div className="space-y-8">
      {/* Logo selector */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Logo de la empresa</h3>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {LOGO_OPTIONS.map((logo) => (
            <button
              key={logo.key}
              onClick={() => update("logoKey", logo.key)}
              className={cn(
                "relative flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all",
                selectedLogo === logo.key
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border hover:border-primary/30"
              )}
            >
              {selectedLogo === logo.key && (
                <div className="absolute top-1.5 right-1.5 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                  <Check className="h-3 w-3 text-primary-foreground" />
                </div>
              )}
              <img
                src={logo.src}
                alt={logo.label}
                className="h-12 w-12 object-contain"
              />
              <span className="text-xs text-muted-foreground font-medium truncate w-full text-center">
                {logo.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Presets */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Paletas predefinidas</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {PRESET_PALETTES.map((preset) => (
            <button
              key={preset.name}
              onClick={() => applyPreset(preset)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border hover:border-primary/40 transition-colors text-left"
            >
              <div className="flex gap-1">
                <div className="w-5 h-5 rounded-full border" style={{ backgroundColor: preset.primary }} />
                <div className="w-5 h-5 rounded-full border" style={{ backgroundColor: preset.dark }} />
                <div className="w-5 h-5 rounded-full border" style={{ backgroundColor: preset.accent }} />
              </div>
              <span className="text-xs font-medium truncate">{preset.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Color pickers */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Color Principal</Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={primary}
              onChange={(e) => update("colorPrimary", e.target.value)}
              className="w-10 h-10 rounded cursor-pointer border border-border"
            />
            <Input
              value={primary}
              onChange={(e) => update("colorPrimary", e.target.value)}
              placeholder="#0B5EA8"
              className="font-mono text-sm"
            />
          </div>
          <p className="text-xs text-muted-foreground">Botones, links, navbar hover</p>
        </div>

        <div className="space-y-2">
          <Label>Color Oscuro (Navbar)</Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={dark}
              onChange={(e) => update("colorPrimaryDark", e.target.value)}
              className="w-10 h-10 rounded cursor-pointer border border-border"
            />
            <Input
              value={dark}
              onChange={(e) => update("colorPrimaryDark", e.target.value)}
              placeholder="#0A2E52"
              className="font-mono text-sm"
            />
          </div>
          <p className="text-xs text-muted-foreground">Fondo de la barra de navegación</p>
        </div>

        <div className="space-y-2">
          <Label>Color Acento</Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={accent}
              onChange={(e) => update("colorAccent", e.target.value)}
              className="w-10 h-10 rounded cursor-pointer border border-border"
            />
            <Input
              value={accent}
              onChange={(e) => update("colorAccent", e.target.value)}
              placeholder="#FFD400"
              className="font-mono text-sm"
            />
          </div>
          <p className="text-xs text-muted-foreground">Badges, CTAs, avatares</p>
        </div>
      </div>

      {/* Eslogan */}
      <div className="max-w-md space-y-2">
        <Label>Eslogan</Label>
        <Input
          value={branding.eslogan || ""}
          onChange={(e) => update("eslogan", e.target.value)}
          placeholder="Defensa Predictiva 24/7"
        />
        <p className="text-xs text-muted-foreground">No se usa en login (login siempre es Asegurar), solo referencia interna</p>
      </div>

      {/* ── Live Preview ── */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Vista Previa</h3>
        <div className="border border-border rounded-xl overflow-hidden shadow-md">
          {/* Preview Navbar */}
          <div
            className="flex items-center justify-between px-4 h-12"
            style={{ backgroundColor: dark, color: "#fff" }}
          >
            <div className="flex items-center gap-3">
              <img
                src={getLogoSrc(selectedLogo)}
                alt=""
                className="h-7 w-7 object-contain rounded"
              />
              <span className="font-bold text-sm">{empresaNombre || "Empresa"}</span>
            </div>
            <div className="flex items-center gap-2">
              {[Home, Users, FileText].map((Icon, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium"
                  style={
                    i === 0
                      ? { backgroundColor: primary, color: "#fff" }
                      : { color: "rgba(255,255,255,0.7)" }
                  }
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{["Inicio", "Usuarios", "Docs"][i]}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <div
                className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ backgroundColor: accent, color: dark }}
              >
                AB
              </div>
              <LogOut className="h-4 w-4 opacity-60" />
            </div>
          </div>

          {/* Preview Body */}
          <div className="bg-background p-4 space-y-3" style={{ minHeight: 140 }}>
            <div className="flex items-center gap-2">
              <div
                className="p-2 rounded-lg"
                style={{ backgroundColor: `${primary}18`, color: primary }}
              >
                <Home className="h-5 w-5" />
              </div>
              <div>
                <p className="font-bold text-sm text-foreground">Panel de Control</p>
                <p className="text-xs text-muted-foreground">{empresaNombre || "Empresa"}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {["Vehículos", "Conductores", "Documentos"].map((label, i) => (
                <div key={i} className="bg-card border border-border rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-lg font-bold text-foreground">{[42, 18, 7][i]}</p>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                className="px-3 py-1.5 rounded text-xs font-semibold text-white"
                style={{ backgroundColor: primary }}
              >
                Botón Principal
              </button>
              <button
                className="px-3 py-1.5 rounded text-xs font-bold"
                style={{ backgroundColor: accent, color: dark }}
              >
                Acción CTA
              </button>
              <span
                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold"
                style={{ backgroundColor: `${primary}18`, color: primary }}
              >
                Badge
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <Button variant="outline" size="sm" onClick={resetDefaults}>
          <RotateCcw className="h-4 w-4 mr-2" />
          Restaurar Defaults
        </Button>
        <Button onClick={() => onSave(branding)} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Guardando...
            </>
          ) : (
            "Guardar Branding"
          )}
        </Button>
      </div>
    </div>
  );
}

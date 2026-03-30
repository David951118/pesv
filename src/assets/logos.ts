import logoAsegurar from "./logos/Asegurar con fecha de creación Png.png";
import logoCoopsetrans from "./logos/logo-coopsetrans.png";
import logoExpresuratur from "./logos/logo-expresuratur.png";
import logoRedondo from "./logos/logo-redondo.png";
import logoAion from "./logos/aion-logo.png";
import logoAionIcon from "./logos/aion-logo-icon.png";
import logoSandona from "./logos/sandona.jpg";

export interface LogoOption {
  key: string;
  label: string;
  src: string;
}

/**
 * Available logos for empresa selection.
 * To add a new logo: drop the image in src/assets/logos/ and add an entry here.
 */
export const LOGO_OPTIONS: LogoOption[] = [
  { key: "asegurar", label: "Asegurar", src: logoAsegurar },
  { key: "coopsetrans", label: "Coopsetrans", src: logoCoopsetrans },
  { key: "expresuratur", label: "Expresuratur", src: logoExpresuratur },
  { key: "redondo", label: "Logo Redondo", src: logoRedondo },
  { key: "aion", label: "AION", src: logoAion },
  { key: "aion-icon", label: "AION Icono", src: logoAionIcon },
  { key: "sandona", label: "Sandoná", src: logoSandona },
];

/** Get logo src by key, falls back to Asegurar */
export function getLogoSrc(key: string | undefined): string {
  if (!key) return logoAsegurar;
  const found = LOGO_OPTIONS.find((o) => o.key === key);
  return found?.src ?? logoAsegurar;
}

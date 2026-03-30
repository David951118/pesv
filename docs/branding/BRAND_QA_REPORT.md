# Brand QA Report — AION Defensa Predictiva S.A.S

> Rebranding audit completo. Fecha: 2026-02-08.
> Estado general: **PASS con warnings (assets opcionales pendientes del usuario)**

---

## 1. Brand Surfaces Matrix

### 1.1 Web App (SPA — Vite + React)

| Surface | Archivo | Estado | Validacion |
|---------|---------|--------|------------|
| `<title>` | `index.html:6` | OK | "AION Defensa Predictiva S.A.S" |
| `<meta description>` | `index.html:7` | OK | Incluye "Defensa Predictiva 24/7" |
| `<meta author>` | `index.html:8` | OK | "AION Defensa Predictiva S.A.S" |
| Favicon | `index.html:11` -> `public/favicon.ico` | OK | Referencia local (reemplazar ICO con icono AION real) |
| Apple Touch Icon | `index.html:12` -> `public/apple-touch-icon.png` | **PENDIENTE** | Archivo no existe aun |
| Manifest link | `index.html:13` -> `public/manifest.json` | OK | Creado y enlazado |
| theme-color | `index.html:14` | OK | `#0B5EA8` (azul corporativo AION) |
| OG title | `index.html:18` | OK | "AION Defensa Predictiva S.A.S" |
| OG description | `index.html:19` | OK | Tagline completo |
| OG image | `index.html:20` -> `public/og-image.png` | **PENDIENTE** | Archivo no existe aun; debe ser 1200x630px |
| Twitter card | `index.html:23` | OK | summary_large_image |
| Twitter site | `index.html:24` | OK | @AIONDefensa |
| Twitter image | `index.html:27` -> `public/og-image.png` | **PENDIENTE** | Mismo que OG image |
| Login logo | `src/pages/Auth.tsx:121` -> `src/assets/aion-logo.png` | OK | alt="AION Defensa Predictiva" |
| Login titulo | `src/pages/Auth.tsx:126` | OK | "AION" |
| Login tagline | `src/pages/Auth.tsx:128` | OK | "Defensa Predictiva 24/7" |
| Nav logo (desktop) | `src/components/layout/TopNav.tsx:150` | OK | alt="AION Defensa Predictiva" |
| Nav texto | `src/components/layout/TopNav.tsx:155` | OK | "AION" |
| Nav logo (mobile) | `src/components/layout/TopNav.tsx:82` | OK | alt="AION Defensa Predictiva" |
| CSS palette comment | `src/index.css:9` | OK | "Paleta Corporativa AION Defensa Predictiva" |
| 404 page | `src/pages/NotFound.tsx` | OK | Sin branding (generico) |
| Dashboard | `src/pages/Index.tsx` | OK | Sin branding textual (correcto) |
| Conductor layout | `src/components/layout/ConductorLayout.tsx` | OK | Sin branding textual |

### 1.2 PWA / manifest.json

| Surface | Archivo | Estado | Validacion |
|---------|---------|--------|------------|
| name | `public/manifest.json` | OK | "AION Defensa Predictiva S.A.S" |
| short_name | `public/manifest.json` | OK | "AION" |
| description | `public/manifest.json` | OK | Tagline completo |
| theme_color | `public/manifest.json` | OK | `#0B5EA8` |
| background_color | `public/manifest.json` | OK | `#0D3B66` |
| icon 192x192 | `public/manifest.json` -> `public/icon-192.png` | **PENDIENTE** | Archivo no existe |
| icon 512x512 | `public/manifest.json` -> `public/icon-512.png` | **PENDIENTE** | Archivo no existe |

### 1.3 Desktop App (Tauri 2)

| Surface | Archivo | Estado | Validacion |
|---------|---------|--------|------------|
| productName | `apps/desktop/src-tauri/tauri.conf.json:3` | OK | "AION Defensa Predictiva" |
| identifier | `apps/desktop/src-tauri/tauri.conf.json:5` | OK | `com.aiondefensa.admin-hub` |
| window title | `apps/desktop/src-tauri/tauri.conf.json:15` | OK | "AION Defensa Predictiva" |
| bundle icon 32x32 | `apps/desktop/src-tauri/icons/32x32.png` | **NO EVIDENCIADO** | Directorio icons/ no existe |
| bundle icon 128x128 | `apps/desktop/src-tauri/icons/128x128.png` | **NO EVIDENCIADO** | Directorio icons/ no existe |
| bundle icon 128x128@2x | `apps/desktop/src-tauri/icons/128x128@2x.png` | **NO EVIDENCIADO** | Directorio icons/ no existe |
| icon.icns (macOS) | `apps/desktop/src-tauri/icons/icon.icns` | **NO EVIDENCIADO** | Necesario para build macOS |
| icon.ico (Windows) | `apps/desktop/src-tauri/icons/icon.ico` | **NO EVIDENCIADO** | Necesario para build Windows |
| Cargo.toml name | `apps/desktop/src-tauri/Cargo.toml:2` | OK | "aion-defensa-predictiva-desktop" |
| package.json name | `apps/desktop/package.json:2` | OK | "aion-defensa-predictiva-desktop" |
| HTML title | `apps/desktop/index.html:6` | OK | "AION Defensa Predictiva" |
| Login screen | `apps/desktop/src/components/setup/LoginScreen.tsx:34` | OK | "AION Defensa Predictiva" |
| Setup wizard | `apps/desktop/src/components/setup/SetupWizard.tsx:47` | OK | "AION Defensa Predictiva" |
| Dashboard header | `apps/desktop/src/components/dashboard/Dashboard.tsx:32` | OK | "AION Defensa Predictiva" |
| Loading text | `apps/desktop/src/App.tsx:37` | OK | "Initializing AION Defensa Predictiva..." |
| Connection panel | `apps/desktop/src/components/connections/ConnectionsPanel.tsx:61` | OK | "AION API" (no "Lovable API") |
| Feature flag | `apps/desktop/src/lib/types.ts:139` | OK | `aionEnabled` (no `lovableEnabled`) |
| Rust log message | `apps/desktop/src-tauri/src/lib.rs:17` | OK | "AION Defensa Predictiva Desktop starting" |
| Rust panic msg | `apps/desktop/src-tauri/src/lib.rs:~30` | OK | "error running AION Defensa Predictiva" |

### 1.4 Installers / Signing

| Surface | Archivo | Estado | Validacion |
|---------|---------|--------|------------|
| Windows NSIS | `apps/desktop/src-tauri/tauri.conf.json:42` | OK | Hereda productName="AION Defensa Predictiva" |
| Windows signing | `scripts/sign-windows.ps1` | OK | Description="AION Defensa Predictiva S.A.S" |
| macOS signing | `scripts/build-macos.sh` | OK | Sin branding textual |
| macOS notarize | `scripts/notarize-macos.sh` | OK | Sin branding textual |
| CI release name | `.github/workflows/release.yml` | OK | "AION Defensa Predictiva S.A.S" |

### 1.5 Rust Crates / Backend

| Surface | Archivo | Estado | Validacion |
|---------|---------|--------|------------|
| Workspace authors | `Cargo.toml:~23` | OK | "AION Defensa Predictiva S.A.S" |
| Provider crate name | `crates/providers/aion/Cargo.toml:2` | OK | "lah-provider-aion" |
| Provider struct | `crates/providers/aion/src/lib.rs:19` | OK | `AIONProvider` |
| Provider string | `crates/providers/aion/src/lib.rs:67` | OK | `"aion"` (error messages) |
| GitHub user-agent | `crates/providers/github/src/lib.rs:55` | OK | `"AIONDefensaPredictiva/1.0"` |
| Keyring SERVICE | `crates/crypto/src/keyring_store.rs:6` | OK | `"com.aiondefensa.admin-hub"` |
| Config data dir | `crates/core/src/config.rs:103` | OK | `.join("AIONDefensaPredictiva")` |
| Config feature flag | `crates/core/src/config.rs:37` | OK | `aion_enabled` |
| SQLite schema header | `apps/desktop/src-tauri/migrations/001_initial.sql:1` | OK | "AION Defensa Predictiva" |
| SQLite provider enum | `apps/desktop/src-tauri/migrations/001_initial.sql:38` | OK | `'aion'` in comment |
| Drive boundary | `crates/providers/drive/src/lib.rs:~283` | OK | `aion_upload_boundary` |

### 1.6 Documentation

| Surface | Archivo | Estado | Validacion |
|---------|---------|--------|------------|
| README.md | `README.md:1` | OK | "# AION Defensa Predictiva S.A.S" |
| SECURITY.md | `SECURITY.md:1` | OK | "AION Defensa Predictiva S.A.S" |
| COMPLIANCE.md | `COMPLIANCE.md:1` | OK | "AION Defensa Predictiva S.A.S" |
| 12 desktop docs | `docs/desktop-installer/01..12` | OK | Todas rebrandeadas |
| SUPABASE_SETUP | `docs/deployment/SUPABASE_SETUP.md` | OK | "AION Defensa Predictiva S.A.S" |
| RUN_MAC_WINDOWS | `docs/deployment/RUN_MAC_WINDOWS.md` | OK | "AION Defensa Predictiva S.A.S" |
| LOCAL_STORAGE | `docs/operations/LOCAL_STORAGE.md` | OK | "AION Defensa Predictiva S.A.S" |
| BACKUP_DRIVE | `docs/operations/BACKUP_DRIVE.md` | OK | "AION Defensa Predictiva S.A.S" |
| GO_NO_GO | `docs/security/GO_NO_GO.md` | OK | "AION Defensa Predictiva S.A.S" |
| Legacy plan | `docs/legacy/lovable-plan.md` | OK | Movido desde `.lovable/plan.md` |

### 1.7 Policies / CI / Scripts

| Surface | Archivo | Estado | Validacion |
|---------|---------|--------|------------|
| roles-capabilities.yml | `policies/roles-capabilities.yml:2` | OK | "AION Defensa Predictiva S.A.S" |
| dlp-rules.yml | `policies/dlp-rules.yml:2` | OK | "AION Defensa Predictiva S.A.S" |
| data-classification.yml | `policies/data-classification.yml:2` | OK | "AION Defensa Predictiva S.A.S" |
| retention-defaults.yml | `policies/retention-defaults.yml:2` | OK | "AION Defensa Predictiva S.A.S" |
| CI workflow | `.github/workflows/ci.yml` | OK | "AION Defensa Predictiva S.A.S" |
| Release workflow | `.github/workflows/release.yml` | OK | "AION Defensa Predictiva S.A.S" |
| Security audit workflow | `.github/workflows/security-audit.yml` | OK | "AION Defensa Predictiva S.A.S" |
| build-windows.ps1 | `scripts/build-windows.ps1:6` | OK | "AION Defensa Predictiva S.A.S" |
| sign-windows.ps1 | `scripts/sign-windows.ps1` | OK | "AION Defensa Predictiva S.A.S" |
| brand-verify.sh | `scripts/brand-verify.sh` | OK | **NUEVO** - script de verificacion |

### 1.8 Config / Env

| Surface | Archivo | Estado | Validacion |
|---------|---------|--------|------------|
| package.json name | `package.json:2` | OK | `"aion-admin-hub"` (era `vite_react_shadcn_ts`) |
| .env.example header | `.env.example:2` | OK | "AION Defensa Predictiva S.A.S" |
| .env.example API vars | `.env.example` | OK | `AION_API_URL`, `AION_API_KEY` (no `LOVABLE_`) |
| supabase/config.toml | `supabase/config.toml` | OK | Project ID generico, sin branding |

---

## 2. Assets Pendientes del Usuario

Los siguientes archivos deben ser proporcionados por el usuario con el logo real de AION (escudo hexagonal):

| Archivo | Formato | Tamano | Uso |
|---------|---------|--------|-----|
| `src/assets/aion-logo.png` | PNG transparente | ~400x150px | Logo principal en Login y TopNav (REEMPLAZAR el actual) |
| `src/assets/aion-logo-icon.png` | PNG transparente | ~64x64px | Icono compacto (REEMPLAZAR el actual) |
| `public/favicon.ico` | ICO multi-size (16+32+48) | 48x48 max | Tab del navegador (REEMPLAZAR el actual) |
| `public/og-image.png` | PNG | 1200x630px | Social cards (OG/Twitter) - **CREAR** |
| `public/apple-touch-icon.png` | PNG | 180x180px | iOS home screen - **CREAR** |
| `public/icon-192.png` | PNG | 192x192px | PWA manifest - **CREAR** |
| `public/icon-512.png` | PNG | 512x512px | PWA manifest + splash - **CREAR** |
| `apps/desktop/src-tauri/icons/32x32.png` | PNG | 32x32px | Desktop app taskbar - **CREAR** |
| `apps/desktop/src-tauri/icons/128x128.png` | PNG | 128x128px | Desktop app icon - **CREAR** |
| `apps/desktop/src-tauri/icons/128x128@2x.png` | PNG | 256x256px | Desktop retina - **CREAR** |
| `apps/desktop/src-tauri/icons/icon.icns` | ICNS | Multi-size | macOS app bundle - **CREAR** |
| `apps/desktop/src-tauri/icons/icon.ico` | ICO | Multi-size | Windows installer/EXE - **CREAR** |

### Como generar los iconos desde el logo SVG/PNG de alta resolucion:

```bash
# Prerequisitos
# brew install imagemagick      # macOS
# apt install imagemagick        # Linux

# Desde una imagen fuente de alta resolucion (ej: aion-logo-source.png 1024x1024)
SRC="aion-logo-source.png"

# Web favicons
convert "$SRC" -resize 16x16   public/favicon-16.png
convert "$SRC" -resize 32x32   public/favicon-32.png
convert "$SRC" -resize 48x48   public/favicon-48.png
convert public/favicon-16.png public/favicon-32.png public/favicon-48.png public/favicon.ico

# PWA icons
convert "$SRC" -resize 180x180 public/apple-touch-icon.png
convert "$SRC" -resize 192x192 public/icon-192.png
convert "$SRC" -resize 512x512 public/icon-512.png

# Social card (1200x630 con fondo corporativo #0D3B66)
convert -size 1200x630 "xc:#0D3B66" \
  \( "$SRC" -resize 400x400 \) -gravity center -composite \
  public/og-image.png

# Tauri desktop icons
mkdir -p apps/desktop/src-tauri/icons
convert "$SRC" -resize 32x32     apps/desktop/src-tauri/icons/32x32.png
convert "$SRC" -resize 128x128   apps/desktop/src-tauri/icons/128x128.png
convert "$SRC" -resize 256x256   apps/desktop/src-tauri/icons/128x128@2x.png

# macOS .icns (requires iconutil on macOS)
mkdir -p aion.iconset
convert "$SRC" -resize 16x16     aion.iconset/icon_16x16.png
convert "$SRC" -resize 32x32     aion.iconset/icon_16x16@2x.png
convert "$SRC" -resize 32x32     aion.iconset/icon_32x32.png
convert "$SRC" -resize 64x64     aion.iconset/icon_32x32@2x.png
convert "$SRC" -resize 128x128   aion.iconset/icon_128x128.png
convert "$SRC" -resize 256x256   aion.iconset/icon_128x128@2x.png
convert "$SRC" -resize 256x256   aion.iconset/icon_256x256.png
convert "$SRC" -resize 512x512   aion.iconset/icon_256x256@2x.png
convert "$SRC" -resize 512x512   aion.iconset/icon_512x512.png
convert "$SRC" -resize 1024x1024 aion.iconset/icon_512x512@2x.png
iconutil -c icns aion.iconset -o apps/desktop/src-tauri/icons/icon.icns
rm -rf aion.iconset

# Windows .ico (multi-size)
convert "$SRC" -resize 16x16 ico-16.png
convert "$SRC" -resize 32x32 ico-32.png
convert "$SRC" -resize 48x48 ico-48.png
convert "$SRC" -resize 256x256 ico-256.png
convert ico-16.png ico-32.png ico-48.png ico-256.png apps/desktop/src-tauri/icons/icon.ico
rm ico-*.png
```

---

## 3. Script de Verificacion

```bash
./scripts/brand-verify.sh
```

Chequea automaticamente:
- Referencias estancadas a marcas anteriores (Lovable, ASEGURAR, gpt-engineer)
- Existencia de archivos de marca criticos
- Texto de marca en archivos clave
- Build output limpio

Resultado actual: **15 PASS, 4 WARN, 0 FAIL**

---

## 4. Referencia Aceptada: `lovable-tagger`

| Archivo | Referencia | Razon de exclusion |
|---------|------------|--------------------|
| `package.json:87` | `"lovable-tagger": "^1.1.13"` | Paquete npm de terceros (dev dependency). No visible al usuario. |
| `vite.config.ts:4` | `import { componentTagger } from "lovable-tagger"` | Solo activo en mode=development. No en build de produccion. |

Para eliminar completamente (opcional): `npm uninstall lovable-tagger` y remover el import + plugin en `vite.config.ts`.

---

## 5. Riesgos Priorizados

### BLOQUEANTES (deben resolverse antes de release)

| # | Riesgo | Estado |
|---|--------|--------|
| B1 | Logo actual (`aion-logo.png`) es el antiguo renombrado, no el escudo AION real | **PENDIENTE DEL USUARIO** |
| B2 | Desktop icons no existen (`apps/desktop/src-tauri/icons/`) — build desktop fallaria | **PENDIENTE DEL USUARIO** |

### NO BLOQUEANTES (web puede salir sin estos)

| # | Riesgo | Impacto |
|---|--------|---------|
| N1 | `og-image.png` no existe | Social cards mostraran imagen rota en WhatsApp/LinkedIn/Twitter |
| N2 | `apple-touch-icon.png` no existe | iOS "Add to Home Screen" usara screenshot generico |
| N3 | `icon-192.png` / `icon-512.png` no existen | PWA install prompt no tendra icono AION |
| N4 | `favicon.ico` actual puede no ser el icono AION | Tab del navegador mostraria icono incorrecto |
| N5 | `cellviapi.asegurar.com.co` en `.env` | URL de API tercero legitima (dominio externo, no nuestra marca) |

---

## 6. Checklist Go/No-Go

### Web Release Gates

- [x] `npm run build` pasa sin errores
- [x] `./scripts/brand-verify.sh` da 0 FAIL
- [x] `<title>` = "AION Defensa Predictiva S.A.S"
- [x] Login muestra logo AION + tagline "Defensa Predictiva 24/7"
- [x] TopNav muestra logo AION
- [x] `manifest.json` existe con nombre AION
- [x] `index.html` no tiene URLs de gpt-engineer
- [x] OG tags apuntan a `/og-image.png` (local)
- [x] Favicon apunta a `/favicon.ico` (local)
- [x] `package.json` name = `aion-admin-hub`
- [ ] **Logo real de AION** colocado en `src/assets/aion-logo.png`
- [ ] **Favicon real** generado desde logo AION
- [ ] **OG image** creada (1200x630px con logo AION)
- [ ] Auth login/logout funcional
- [ ] Rutas admin y conductor accesibles
- [ ] Edge functions desplegadas y respondiendo
- [ ] RLS activo en todas las tablas
- [ ] No hay console errors en produccion

### Desktop Release Gates

- [x] `tauri.conf.json` productName = "AION Defensa Predictiva"
- [x] `tauri.conf.json` identifier = "com.aiondefensa.admin-hub"
- [x] Cargo.toml name = "aion-defensa-predictiva-desktop"
- [x] LoginScreen, SetupWizard, Dashboard muestran "AION Defensa Predictiva"
- [x] Provider crate renombrado a `crates/providers/aion/`
- [x] Keyring SERVICE = "com.aiondefensa.admin-hub"
- [ ] **Icons directory** creado con iconos AION reales
- [ ] `cargo build` pasa (verificar en maquina con Rust toolchain)
- [ ] `cargo tauri build` produce instalador funcional
- [ ] Firma de codigo configurada (Windows: AzureSignTool, macOS: codesign)
- [ ] Auto-update endpoint configurado con clave Ed25519

---

*Documento generado automaticamente — AION Defensa Predictiva S.A.S*

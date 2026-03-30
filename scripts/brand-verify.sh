#!/usr/bin/env bash
# =============================================================================
# Brand Verification Script — AION Defensa Predictiva S.A.S
# =============================================================================
# Run after rebranding or before any release to verify brand consistency.
# Exit code 0 = pass, 1 = findings that need review.
#
# Usage:
#   chmod +x scripts/brand-verify.sh
#   ./scripts/brand-verify.sh
# =============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'
PASS=0
WARN=0
FAIL=0

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "============================================="
echo " AION Brand Verification"
echo " $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "============================================="
echo ""

# ── 1. Check for stale brand references in source ───────────────────────────

echo "=== 1. Stale brand references (source) ==="

# Lovable (excluding acceptable dev dependency)
LOVABLE_HITS=$(rg -c -i "lovable" \
  --glob '!package-lock.json' \
  --glob '!node_modules/**' \
  --glob '!dist/**' \
  --glob '!.git/**' \
  --glob '!docs/legacy/**' \
  --glob '!docs/branding/**' \
  --glob '!scripts/brand-verify.sh' \
  . 2>/dev/null || true)

LOVABLE_COUNT=0
LOVABLE_FLAGGED=""
while IFS=: read -r file count; do
  [ -z "$file" ] && continue
  case "$file" in
    ./package.json|./vite.config.ts|./SECURITY_AUDIT_REPORT.md)
      # Acceptable: lovable-tagger dev dependency
      ;;
    *)
      LOVABLE_COUNT=$((LOVABLE_COUNT + count))
      LOVABLE_FLAGGED="$LOVABLE_FLAGGED\n  $file ($count hits)"
      ;;
  esac
done <<< "$LOVABLE_HITS"

if [ "$LOVABLE_COUNT" -gt 0 ]; then
  echo -e "${RED}FAIL${NC}: Found $LOVABLE_COUNT stale 'lovable' references:$LOVABLE_FLAGGED"
  FAIL=$((FAIL + 1))
else
  echo -e "${GREEN}PASS${NC}: No stale 'lovable' references (lovable-tagger in package.json/vite.config.ts excluded)"
  PASS=$((PASS + 1))
fi

# ASEGURAR (old brand, excluding Spanish verb usage)
ASEGURAR_BRAND=$(rg -n -i "asegurar" \
  --glob '!package-lock.json' \
  --glob '!node_modules/**' \
  --glob '!dist/**' \
  --glob '!.git/**' \
  --glob '!.env' \
  --glob '!scripts/brand-verify.sh' \
  src/ index.html public/ apps/desktop/src/ 2>/dev/null | \
  grep -iv "// .*asegurar\|-- .*asegurar\|# .*asegurar\|asegurar que\|para asegurar\|asegurar el\|asegurar la\|cellviapi.asegurar" || true)

if [ -n "$ASEGURAR_BRAND" ]; then
  echo -e "${RED}FAIL${NC}: Found potential 'ASEGURAR' brand references:"
  echo "$ASEGURAR_BRAND" | head -10
  FAIL=$((FAIL + 1))
else
  echo -e "${GREEN}PASS${NC}: No stale 'ASEGURAR' brand references in source"
  PASS=$((PASS + 1))
fi

# gpt-engineer URLs
GPT_HITS=$(rg -c "gpt-engineer" \
  --glob '!package-lock.json' \
  --glob '!node_modules/**' \
  --glob '!dist/**' \
  --glob '!.git/**' \
  --glob '!docs/branding/**' \
  --glob '!scripts/brand-verify.sh' \
  --glob '!SECURITY_AUDIT_REPORT.md' \
  . 2>/dev/null || true)

GPT_COUNT=0
while IFS=: read -r file count; do
  [ -z "$file" ] && continue
  GPT_COUNT=$((GPT_COUNT + count))
done <<< "$GPT_HITS"

if [ "$GPT_COUNT" -gt 0 ]; then
  echo -e "${RED}FAIL${NC}: Found $GPT_COUNT stale 'gpt-engineer' references (old platform URLs)"
  FAIL=$((FAIL + 1))
else
  echo -e "${GREEN}PASS${NC}: No stale 'gpt-engineer' URLs"
  PASS=$((PASS + 1))
fi

echo ""

# ── 2. Check critical brand files exist ─────────────────────────────────────

echo "=== 2. Brand asset files ==="

check_file() {
  local path="$1"
  local desc="$2"
  local required="$3"
  if [ -f "$ROOT/$path" ]; then
    local size
    size=$(wc -c < "$ROOT/$path" | tr -d ' ')
    if [ "$size" -lt 100 ]; then
      echo -e "${YELLOW}WARN${NC}: $desc ($path) exists but is very small (${size}B) — may be placeholder"
      WARN=$((WARN + 1))
    else
      echo -e "${GREEN}PASS${NC}: $desc ($path) — ${size}B"
      PASS=$((PASS + 1))
    fi
  elif [ "$required" = "required" ]; then
    echo -e "${RED}FAIL${NC}: $desc MISSING ($path)"
    FAIL=$((FAIL + 1))
  else
    echo -e "${YELLOW}WARN${NC}: $desc not found ($path)"
    WARN=$((WARN + 1))
  fi
}

check_file "src/assets/aion-logo.png"           "Web logo (main)"              required
check_file "src/assets/aion-logo-icon.png"       "Web logo (icon variant)"      required
check_file "public/favicon.ico"                  "Favicon (ICO)"                required
check_file "public/manifest.json"                "PWA manifest"                 required
check_file "public/og-image.png"                 "OG social card image"         optional
check_file "public/apple-touch-icon.png"         "Apple touch icon (180x180)"   optional
check_file "public/icon-192.png"                 "PWA icon 192x192"             optional
check_file "public/icon-512.png"                 "PWA icon 512x512"             optional

echo ""

# ── 3. Check brand text in key files ────────────────────────────────────────

echo "=== 3. Brand text verification ==="

check_contains() {
  local file="$1"
  local pattern="$2"
  local desc="$3"
  if [ -f "$ROOT/$file" ] && grep -q "$pattern" "$ROOT/$file"; then
    echo -e "${GREEN}PASS${NC}: $desc"
    PASS=$((PASS + 1))
  else
    echo -e "${RED}FAIL${NC}: $desc — pattern '$pattern' not found in $file"
    FAIL=$((FAIL + 1))
  fi
}

check_contains "index.html"                            "AION Defensa Predictiva"     "index.html <title>"
check_contains "index.html"                            "manifest.json"               "index.html manifest link"
check_contains "public/manifest.json"                  "AION Defensa Predictiva"     "manifest.json name"
check_contains "public/manifest.json"                  '"short_name": "AION"'        "manifest.json short_name"
check_contains "README.md"                             "AION Defensa Predictiva"     "README.md heading"
check_contains "apps/desktop/src-tauri/tauri.conf.json" "AION Defensa Predictiva"    "Tauri productName"
check_contains "apps/desktop/src-tauri/tauri.conf.json" "com.aiondefensa"            "Tauri identifier"

echo ""

# ── 4. Build dist check (if dist exists) ────────────────────────────────────

echo "=== 4. Build output (dist/) ==="

if [ -d "$ROOT/dist" ]; then
  DIST_LOVABLE=$(rg -c -i "lovable" "$ROOT/dist/" 2>/dev/null | \
    grep -v "lovable-tagger\|componentTagger" || true)

  DIST_COUNT=0
  while IFS=: read -r file count; do
    [ -z "$file" ] && continue
    DIST_COUNT=$((DIST_COUNT + count))
  done <<< "$DIST_LOVABLE"

  if [ "$DIST_COUNT" -gt 0 ]; then
    echo -e "${RED}FAIL${NC}: Found 'lovable' in built output (dist/)"
    FAIL=$((FAIL + 1))
  else
    echo -e "${GREEN}PASS${NC}: dist/ clean of 'lovable' brand references"
    PASS=$((PASS + 1))
  fi
else
  echo -e "${YELLOW}WARN${NC}: dist/ not found — run 'npm run build' first"
  WARN=$((WARN + 1))
fi

echo ""

# ── Summary ─────────────────────────────────────────────────────────────────

echo "============================================="
echo " Results: ${GREEN}${PASS} PASS${NC}  ${YELLOW}${WARN} WARN${NC}  ${RED}${FAIL} FAIL${NC}"
echo "============================================="

if [ "$FAIL" -gt 0 ]; then
  echo -e "${RED}BRAND CHECK FAILED${NC} — fix the above issues before release."
  exit 1
else
  if [ "$WARN" -gt 0 ]; then
    echo -e "${YELLOW}BRAND CHECK PASSED WITH WARNINGS${NC} — review optional items."
  else
    echo -e "${GREEN}BRAND CHECK PASSED${NC}"
  fi
  exit 0
fi

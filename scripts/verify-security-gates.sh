#!/usr/bin/env bash
# =============================================================================
# OPERATIONAL CLOSURE EVIDENCE — AION Defensa Predictiva S.A.S
# =============================================================================
# Run this script to collect evidence that all security gates pass.
# Output: structured report suitable for audit trail.
# Exit code: non-zero if ANY gate fails.
#
# Usage:
#   chmod +x scripts/verify-security-gates.sh
#   ./scripts/verify-security-gates.sh
# =============================================================================
# NOTE: We intentionally do NOT use `set -e` here. Each gate captures its own
# exit status so that ALL gates run even if one fails. The script exits non-zero
# at the end if any gate failed.
set -uo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

PASS=0
FAIL=0
WARN=0

check() {
  local label="$1"
  local result="$2"  # 0=pass, 1=fail, 2=warn
  local detail="${3:-}"
  if [ "$result" -eq 0 ]; then
    echo -e "  ${GREEN}[PASS]${NC} $label"
    [ -n "$detail" ] && echo "         $detail"
    PASS=$((PASS + 1))
  elif [ "$result" -eq 2 ]; then
    echo -e "  ${YELLOW}[WARN]${NC} $label"
    [ -n "$detail" ] && echo "         $detail"
    WARN=$((WARN + 1))
  else
    echo -e "  ${RED}[FAIL]${NC} $label"
    [ -n "$detail" ] && echo "         $detail"
    FAIL=$((FAIL + 1))
  fi
}

echo "============================================="
echo "  SECURITY GATE VERIFICATION"
echo "  $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo "============================================="
echo ""

# --- Gate 1: No credentials in public/ ---
echo "Gate 1: Credential exposure"
if [ -f "public/credenciales-conductores.md" ]; then
  check "credentials file deleted" 1 "public/credenciales-conductores.md still exists!"
else
  check "credentials file deleted" 0
fi

# --- Gate 2: .env not tracked ---
echo "Gate 2: .env not in git"
if git ls-files --error-unmatch .env 2>/dev/null; then
  check ".env not tracked" 1
else
  check ".env not tracked" 0
fi

# --- Gate 3: .env.example safe ---
echo "Gate 3: .env.example safety"
if grep -qE 'eyJ[A-Za-z0-9_-]{20,}\.' .env.example 2>/dev/null; then
  check ".env.example has no JWTs" 1
else
  check ".env.example has no JWTs" 0
fi
if grep -q "VITE_CELLVI_USERNAME\|VITE_CELLVI_PASSWORD\|VITE_CELLVI_BASE_URL" .env.example 2>/dev/null; then
  check ".env.example has no Cellvi credentials" 1
else
  check ".env.example has no Cellvi credentials" 0
fi

# --- Gate 4: JWT config (hardened) ---
echo "Gate 4: JWT gateway"
DISABLED=$(grep -c 'verify_jwt = false' supabase/config.toml || true)
ENABLED=$(grep -c 'verify_jwt = true' supabase/config.toml || true)
if [ "$DISABLED" -eq 1 ]; then
  check "exactly 1 function has jwt=false (verify-fuec)" 0
else
  check "exactly 1 function has jwt=false" 1 "Expected 1, found $DISABLED"
fi
if [ "$ENABLED" -ge 8 ]; then
  check "at least 8 functions have jwt=true" 0 "$ENABLED functions with jwt=true"
else
  check "at least 8 functions have jwt=true" 1 "Expected >=8, found $ENABLED"
fi

# --- Gate 5: No service_role in client code (excluding test files) ---
echo "Gate 5: No service_role in client"
if grep -rn --exclude-dir=test "service_role\|SERVICE_ROLE_KEY" src/ 2>/dev/null; then
  check "no service_role references in src/ (excl. tests)" 1
else
  check "no service_role references in src/ (excl. tests)" 0
fi

# --- Gate 6: No Cellvi credentials in client (excluding test files) ---
echo "Gate 6: Cellvi credentials server-side only"
if grep -rn --exclude-dir=test "VITE_CELLVI_USERNAME\|VITE_CELLVI_PASSWORD\|VITE_CELLVI_BASE_URL" src/ 2>/dev/null; then
  check "no VITE_CELLVI credentials in src/ (excl. tests)" 1
else
  check "no VITE_CELLVI credentials in src/ (excl. tests)" 0
fi

# --- Gate 7: No signUp ---
echo "Gate 7: Registration disabled"
if grep -q "signUp" src/hooks/useAuth.tsx 2>/dev/null; then
  check "no signUp in useAuth" 1
else
  check "no signUp in useAuth" 0
fi
if grep -qE "Registrarse|Crear Cuenta" src/pages/Auth.tsx 2>/dev/null; then
  check "no register UI in Auth.tsx" 1
else
  check "no register UI in Auth.tsx" 0
fi

# --- Gate 8: Security tests ---
echo "Gate 8: Security tests"
TEST_OUTPUT=$(npx vitest run src/test/security.test.ts 2>&1) || true
# Extract "Tests  N passed" (not "Test Files  1 passed")
TEST_PASSED=$(echo "$TEST_OUTPUT" | grep -oP 'Tests\s+\K\d+ passed' | head -1 || echo "0 passed")
if echo "$TEST_OUTPUT" | grep -q "failed"; then
  check "security tests" 1 "$TEST_PASSED"
else
  check "security tests" 0 "$TEST_PASSED"
fi

# --- Gate 9: Build ---
echo "Gate 9: Build"
BUILD_OUTPUT=$(npm run build 2>&1) || true
if echo "$BUILD_OUTPUT" | grep -q "built in"; then
  check "production build succeeds" 0
else
  check "production build succeeds" 1
fi

# --- Gate 10: Bundle secret scan (hardened) ---
echo "Gate 10: Bundle secrets"
BUNDLE_LEAKS=0
# Check for Cellvi credentials
if grep -rl "CELLVI_USERNAME\|CELLVI_PASSWORD" dist/ 2>/dev/null; then
  check "no Cellvi credentials in bundle" 1
  BUNDLE_LEAKS=1
else
  check "no Cellvi credentials in bundle" 0
fi
# Check for service_role key
if grep -rl "service_role" dist/ 2>/dev/null; then
  check "no service_role in bundle" 1
  BUNDLE_LEAKS=1
else
  check "no service_role in bundle" 0
fi
# Check for JWT-shaped tokens (eyJ... with 20+ chars — real tokens, not CSS/hashes)
if grep -rloP 'eyJ[A-Za-z0-9_-]{40,}\.' dist/ 2>/dev/null; then
  check "no JWT tokens in bundle" 1 "Possible embedded JWT found"
  BUNDLE_LEAKS=1
else
  check "no JWT tokens in bundle" 0
fi
# Check for old credentials file content
if grep -rl "credenciales" dist/ 2>/dev/null; then
  check "no credential references in bundle" 1
  BUNDLE_LEAKS=1
else
  check "no credential references in bundle" 0
fi

# --- Gate 11: TypeScript ---
echo "Gate 11: TypeScript"
TSC_OUTPUT=$(npx tsc --noEmit 2>&1) || true
if [ -z "$TSC_OUTPUT" ]; then
  check "TypeScript clean" 0
else
  check "TypeScript clean" 1 "$TSC_OUTPUT"
fi

# --- Gate 12: verify-fuec threat model (hardened) ---
echo "Gate 12: verify-fuec threat model"
FUEC_SRC="supabase/functions/verify-fuec/index.ts"
GATE12_FAIL=0
if ! grep -q "THREAT MODEL" "$FUEC_SRC" 2>/dev/null; then
  check "threat model header present" 1
  GATE12_FAIL=1
else
  check "threat model header present" 0
fi
# Verify specific compensating controls are documented (not just the header)
for control in "Rate limit" "Input:" "SECURITY DEFINER" "read-only" "CORS" "Logging" "No writes"; do
  if ! grep -qi "$control" "$FUEC_SRC" 2>/dev/null; then
    check "threat model documents: $control" 1
    GATE12_FAIL=1
  fi
done
if [ "$GATE12_FAIL" -eq 0 ]; then
  check "all 7 compensating controls documented" 0
fi

echo ""
echo "============================================="
echo -e "  RESULTS: ${GREEN}${PASS} passed${NC}, ${RED}${FAIL} failed${NC}, ${YELLOW}${WARN} warnings${NC}"
echo "============================================="
echo ""

if [ "$FAIL" -eq 0 ]; then
  echo -e "${GREEN}ALL GATES PASSED. Ready for operational steps.${NC}"
  echo ""
  echo "Remaining operational steps (require live environment):"
  echo "  1. Apply DB migrations:  supabase db push"
  echo "  2. Rotate Supabase anon key (was in committed .env)"
  echo "  3. Set Cellvi secrets:   supabase secrets set CELLVI_BASE_URL=... CELLVI_USERNAME=... CELLVI_PASSWORD=..."
  echo "  4. Disable signups:      Supabase Dashboard → Auth → Settings"
  echo "  5. Reset 79 passwords:   See PRODUCTION_HARDENING_RUNBOOK.md Phase 2"
  echo "  6. Git history purge:    See PRODUCTION_HARDENING_RUNBOOK.md Section 4"
  exit 0
else
  echo -e "${RED}${FAIL} GATE(S) FAILED. Fix before proceeding.${NC}"
  exit 1
fi

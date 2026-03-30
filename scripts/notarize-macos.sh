#!/usr/bin/env bash
# =============================================================================
# notarize-macos.sh — Notarize macOS app with Apple notarytool
# =============================================================================
# Submits a macOS .dmg (or .app/.zip) to Apple's notarization service and
# staples the notarization ticket upon success. Uses notarytool (Xcode 13+).
#
# Prerequisites:
#   - macOS with Xcode Command Line Tools installed
#   - xcrun notarytool available (Xcode 13+)
#   - Apple Developer account with App Store Connect API access
#
# Environment Variables (required):
#   APPLE_ID                    — Apple ID email for notarization
#   APPLE_TEAM_ID               — Apple Developer Team ID (10-char alphanumeric)
#   APPLE_APP_SPECIFIC_PASSWORD — App-specific password (generate at appleid.apple.com)
#
# Environment Variables (optional):
#   DMG_PATH                    — Explicit path to .dmg file (auto-detected if not set)
#   NOTARIZE_TIMEOUT            — Timeout in seconds for notarization (default: 1800)
#   SKIP_STAPLE                 — Set to "true" to skip stapling
#
# Usage:
#   ./scripts/notarize-macos.sh
#   DMG_PATH=./target/release/bundle/dmg/app.dmg ./scripts/notarize-macos.sh
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
NOTARIZE_TIMEOUT="${NOTARIZE_TIMEOUT:-1800}"
SKIP_STAPLE="${SKIP_STAPLE:-false}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ---------------------------------------------------------------------------
# Helper Functions
# ---------------------------------------------------------------------------
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

cleanup() {
    # Clean up temporary files if any were created
    if [[ -n "${TEMP_DIR:-}" && -d "${TEMP_DIR}" ]]; then
        rm -rf "${TEMP_DIR}"
    fi
}

trap cleanup EXIT

# ---------------------------------------------------------------------------
# Preflight Checks
# ---------------------------------------------------------------------------
log_info "Starting macOS notarization process..."

# Verify we are on macOS
if [[ "$(uname -s)" != "Darwin" ]]; then
    log_error "This script must be run on macOS."
    exit 1
fi

# Check for notarytool
if ! xcrun notarytool --version &>/dev/null; then
    log_error "notarytool not found. Ensure Xcode 13+ Command Line Tools are installed."
    log_error "Install with: xcode-select --install"
    exit 1
fi

log_info "notarytool version: $(xcrun notarytool --version 2>&1 | head -1)"

# Check required environment variables
MISSING_VARS=()
if [[ -z "${APPLE_ID:-}" ]]; then
    MISSING_VARS+=("APPLE_ID")
fi
if [[ -z "${APPLE_TEAM_ID:-}" ]]; then
    MISSING_VARS+=("APPLE_TEAM_ID")
fi
if [[ -z "${APPLE_APP_SPECIFIC_PASSWORD:-}" ]]; then
    MISSING_VARS+=("APPLE_APP_SPECIFIC_PASSWORD")
fi

if [[ ${#MISSING_VARS[@]} -gt 0 ]]; then
    log_error "Missing required environment variables:"
    for var in "${MISSING_VARS[@]}"; do
        log_error "  - ${var}"
    done
    echo ""
    log_error "Set these variables before running this script:"
    log_error "  export APPLE_ID=\"your-apple-id@example.com\""
    log_error "  export APPLE_TEAM_ID=\"ABCDE12345\""
    log_error "  export APPLE_APP_SPECIFIC_PASSWORD=\"xxxx-xxxx-xxxx-xxxx\""
    log_error ""
    log_error "Generate an app-specific password at: https://appleid.apple.com/account/manage"
    exit 1
fi

# ---------------------------------------------------------------------------
# Locate DMG
# ---------------------------------------------------------------------------
if [[ -n "${DMG_PATH:-}" ]]; then
    if [[ ! -f "${DMG_PATH}" ]]; then
        log_error "Specified DMG not found: ${DMG_PATH}"
        exit 1
    fi
    log_info "Using specified DMG: ${DMG_PATH}"
else
    log_info "Searching for .dmg in target directory..."
    DMG_PATH=$(find "${PROJECT_ROOT}/target" -name "*.dmg" -type f -newer "${PROJECT_ROOT}/Cargo.toml" 2>/dev/null | head -1)

    if [[ -z "${DMG_PATH}" ]]; then
        log_error "No .dmg file found in ${PROJECT_ROOT}/target/"
        log_error "Run ./scripts/build-macos.sh first to build the application."
        exit 1
    fi
    log_info "Found DMG: ${DMG_PATH}"
fi

DMG_NAME=$(basename "${DMG_PATH}")
DMG_SIZE=$(du -h "${DMG_PATH}" | cut -f1)
log_info "File: ${DMG_NAME} (${DMG_SIZE})"

# ---------------------------------------------------------------------------
# Step 1: Verify code signature before notarization
# ---------------------------------------------------------------------------
log_step "Step 1/4: Verifying code signature..."

if codesign --verify --deep --strict "${DMG_PATH}" 2>/dev/null; then
    log_info "Code signature is valid."
else
    log_warn "Code signature verification failed or app is not signed."
    log_warn "Notarization may fail without a valid signature."
    log_warn "Ensure the app was built with a valid Developer ID certificate."
fi

# ---------------------------------------------------------------------------
# Step 2: Submit for notarization
# ---------------------------------------------------------------------------
log_step "Step 2/4: Submitting for notarization..."
log_info "Apple ID:  ${APPLE_ID}"
log_info "Team ID:   ${APPLE_TEAM_ID}"
log_info "Timeout:   ${NOTARIZE_TIMEOUT}s"

SUBMISSION_OUTPUT=$(xcrun notarytool submit "${DMG_PATH}" \
    --apple-id "${APPLE_ID}" \
    --team-id "${APPLE_TEAM_ID}" \
    --password "${APPLE_APP_SPECIFIC_PASSWORD}" \
    --wait \
    --timeout "${NOTARIZE_TIMEOUT}" \
    2>&1) || true

echo "${SUBMISSION_OUTPUT}"

# Extract submission ID for log retrieval
SUBMISSION_ID=$(echo "${SUBMISSION_OUTPUT}" | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -1)

# Check if notarization was successful
if echo "${SUBMISSION_OUTPUT}" | grep -q "status: Accepted"; then
    log_info "Notarization successful!"
elif echo "${SUBMISSION_OUTPUT}" | grep -q "status: Invalid"; then
    log_error "Notarization rejected by Apple."

    # Fetch the notarization log for details
    if [[ -n "${SUBMISSION_ID}" ]]; then
        log_error "Fetching notarization log for submission ${SUBMISSION_ID}..."
        xcrun notarytool log "${SUBMISSION_ID}" \
            --apple-id "${APPLE_ID}" \
            --team-id "${APPLE_TEAM_ID}" \
            --password "${APPLE_APP_SPECIFIC_PASSWORD}" 2>&1 || true
    fi
    exit 1
else
    log_error "Notarization status unclear. Review output above."

    if [[ -n "${SUBMISSION_ID}" ]]; then
        log_info "Check status manually:"
        log_info "  xcrun notarytool info ${SUBMISSION_ID} --apple-id ${APPLE_ID} --team-id ${APPLE_TEAM_ID}"
    fi
    exit 1
fi

# ---------------------------------------------------------------------------
# Step 3: Staple the notarization ticket
# ---------------------------------------------------------------------------
if [[ "${SKIP_STAPLE}" != "true" ]]; then
    log_step "Step 3/4: Stapling notarization ticket..."
    xcrun stapler staple "${DMG_PATH}"
    log_info "Notarization ticket stapled successfully."
else
    log_warn "Skipping stapling (SKIP_STAPLE=true)"
fi

# ---------------------------------------------------------------------------
# Step 4: Verify notarization
# ---------------------------------------------------------------------------
log_step "Step 4/4: Verifying notarization..."

if xcrun stapler validate "${DMG_PATH}" 2>/dev/null; then
    log_info "Notarization verification passed."
else
    log_warn "Stapler validation returned a warning (may be expected for DMGs)."
fi

# Also verify with spctl if possible
if spctl --assess --type open --context context:primary-signature "${DMG_PATH}" 2>/dev/null; then
    log_info "Gatekeeper assessment passed."
else
    log_warn "Gatekeeper assessment could not be completed (may require mounting the DMG)."
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
log_info ""
log_info "Notarization complete!"
log_info "  File:          ${DMG_PATH}"
log_info "  Submission ID: ${SUBMISSION_ID:-unknown}"
log_info "  Status:        Accepted"
log_info ""
log_info "The DMG is ready for distribution."

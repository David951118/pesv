#!/usr/bin/env bash
# =============================================================================
# build-macos.sh — Build macOS .dmg with Tauri CLI
# =============================================================================
# Builds a universal (x86_64 + aarch64) macOS .dmg using tauri-cli.
# Handles code signing with an Apple Developer certificate.
#
# Prerequisites:
#   - Rust toolchain with aarch64-apple-darwin and x86_64-apple-darwin targets
#   - Node.js 20+ and npm
#   - tauri-cli v2+ (cargo install tauri-cli)
#   - Apple Developer certificate in keychain
#
# Environment Variables (required):
#   APPLE_SIGNING_IDENTITY   — Code signing identity (e.g., "Developer ID Application: ...")
#
# Environment Variables (optional):
#   TAURI_SIGNING_PRIVATE_KEY          — Tauri update signing key
#   TAURI_SIGNING_PRIVATE_KEY_PASSWORD — Password for the signing key
#   BUILD_TARGET                       — Override target (default: universal-apple-darwin)
#   SKIP_FRONTEND_BUILD               — Set to "true" to skip npm build
#
# Usage:
#   ./scripts/build-macos.sh
#   APPLE_SIGNING_IDENTITY="Developer ID Application: My Co" ./scripts/build-macos.sh
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
BUILD_TARGET="${BUILD_TARGET:-universal-apple-darwin}"
SKIP_FRONTEND_BUILD="${SKIP_FRONTEND_BUILD:-false}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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

check_command() {
    if ! command -v "$1" &>/dev/null; then
        log_error "Required command not found: $1"
        exit 1
    fi
}

# ---------------------------------------------------------------------------
# Preflight Checks
# ---------------------------------------------------------------------------
log_info "Starting macOS build process..."
log_info "Project root: ${PROJECT_ROOT}"
log_info "Build target: ${BUILD_TARGET}"

# Verify we are on macOS
if [[ "$(uname -s)" != "Darwin" ]]; then
    log_error "This script must be run on macOS."
    exit 1
fi

# Check required tools
check_command "rustc"
check_command "cargo"
check_command "node"
check_command "npm"

# Check for tauri-cli
if ! cargo tauri --version &>/dev/null; then
    log_error "tauri-cli not found. Install with: cargo install tauri-cli --version '^2'"
    exit 1
fi

# Check Rust targets for universal binary
if [[ "${BUILD_TARGET}" == "universal-apple-darwin" ]]; then
    log_info "Checking Rust targets for universal binary..."
    if ! rustup target list --installed | grep -q "aarch64-apple-darwin"; then
        log_warn "Adding aarch64-apple-darwin target..."
        rustup target add aarch64-apple-darwin
    fi
    if ! rustup target list --installed | grep -q "x86_64-apple-darwin"; then
        log_warn "Adding x86_64-apple-darwin target..."
        rustup target add x86_64-apple-darwin
    fi
fi

# Check signing identity
if [[ -z "${APPLE_SIGNING_IDENTITY:-}" ]]; then
    log_warn "APPLE_SIGNING_IDENTITY is not set."
    log_warn "The build will proceed WITHOUT code signing."
    log_warn "Set APPLE_SIGNING_IDENTITY to enable signing."
    log_warn "Example: export APPLE_SIGNING_IDENTITY=\"Developer ID Application: Your Company (TEAMID)\""
else
    log_info "Signing identity: ${APPLE_SIGNING_IDENTITY}"

    # Verify the identity exists in the keychain
    if ! security find-identity -v -p codesigning | grep -q "${APPLE_SIGNING_IDENTITY}"; then
        log_error "Signing identity not found in keychain: ${APPLE_SIGNING_IDENTITY}"
        log_error "Available identities:"
        security find-identity -v -p codesigning
        exit 1
    fi
    log_info "Signing identity verified in keychain."
fi

# ---------------------------------------------------------------------------
# Build Frontend
# ---------------------------------------------------------------------------
cd "${PROJECT_ROOT}"

if [[ "${SKIP_FRONTEND_BUILD}" != "true" ]]; then
    log_info "Installing npm dependencies..."
    npm ci

    log_info "Building frontend..."
    npm run build
else
    log_info "Skipping frontend build (SKIP_FRONTEND_BUILD=true)"
fi

# ---------------------------------------------------------------------------
# Build Tauri App
# ---------------------------------------------------------------------------
log_info "Building Tauri application for target: ${BUILD_TARGET}..."

BUILD_ARGS=(build --target "${BUILD_TARGET}")

# Add verbose flag for CI debugging
if [[ "${CI:-false}" == "true" ]]; then
    BUILD_ARGS+=(--verbose)
fi

cargo tauri "${BUILD_ARGS[@]}"

# ---------------------------------------------------------------------------
# Locate Output Artifacts
# ---------------------------------------------------------------------------
DMG_PATH=$(find "${PROJECT_ROOT}/target" -name "*.dmg" -type f -newer "${PROJECT_ROOT}/Cargo.toml" | head -1)

if [[ -z "${DMG_PATH}" ]]; then
    log_error "No .dmg file found in target directory after build."
    exit 1
fi

log_info "Build artifact: ${DMG_PATH}"

# ---------------------------------------------------------------------------
# Generate Checksum
# ---------------------------------------------------------------------------
CHECKSUM_PATH="${DMG_PATH}.sha256"
shasum -a 256 "${DMG_PATH}" > "${CHECKSUM_PATH}"
log_info "SHA-256 checksum: ${CHECKSUM_PATH}"
log_info "$(cat "${CHECKSUM_PATH}")"

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
DMG_SIZE=$(du -h "${DMG_PATH}" | cut -f1)
log_info "Build completed successfully!"
log_info "  Artifact: ${DMG_PATH}"
log_info "  Size:     ${DMG_SIZE}"
log_info "  Checksum: ${CHECKSUM_PATH}"
log_info ""
log_info "Next steps:"
log_info "  1. Run ./scripts/notarize-macos.sh to notarize the app"
log_info "  2. Verify the signature: codesign --verify --deep --strict \"${DMG_PATH}\""

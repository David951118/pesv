<#
.SYNOPSIS
    Build Windows installer (.exe NSIS) with Tauri CLI.

.DESCRIPTION
    Builds the AION Defensa Predictiva S.A.S desktop installer for Windows using tauri-cli.
    Produces an NSIS .exe installer and optionally an .msi via WiX.

.PARAMETER SkipFrontendBuild
    Skip the npm build step (useful if frontend is already built).

.PARAMETER BuildTarget
    Override the Rust build target. Default: x86_64-pc-windows-msvc.

.PARAMETER Verbose
    Enable verbose output for debugging.

.NOTES
    Prerequisites:
      - Rust toolchain (stable, MSVC)
      - Node.js 20+ and npm
      - tauri-cli v2+ (cargo install tauri-cli)
      - NSIS (automatically managed by Tauri)

    Environment Variables (optional):
      TAURI_SIGNING_PRIVATE_KEY          — Tauri update signing key
      TAURI_SIGNING_PRIVATE_KEY_PASSWORD — Password for the signing key
      WINDOWS_CERTIFICATE_PATH           — Path to .pfx code signing certificate
      WINDOWS_CERTIFICATE_PASSWORD       — Password for the .pfx certificate

    Usage:
      .\scripts\build-windows.ps1
      .\scripts\build-windows.ps1 -SkipFrontendBuild -Verbose
#>

[CmdletBinding()]
param(
    [switch]$SkipFrontendBuild,
    [string]$BuildTarget = "x86_64-pc-windows-msvc",
    [switch]$Verbose
)

# ---------------------------------------------------------------------------
# Strict mode
# ---------------------------------------------------------------------------
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir

# ---------------------------------------------------------------------------
# Helper Functions
# ---------------------------------------------------------------------------
function Write-LogInfo {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Green
}

function Write-LogWarn {
    param([string]$Message)
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Write-LogError {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

function Test-CommandExists {
    param([string]$Command)
    $null = Get-Command $Command -ErrorAction SilentlyContinue
    return $?
}

# ---------------------------------------------------------------------------
# Preflight Checks
# ---------------------------------------------------------------------------
Write-LogInfo "Starting Windows build process..."
Write-LogInfo "Project root: $ProjectRoot"
Write-LogInfo "Build target: $BuildTarget"

# Verify platform
if ($env:OS -ne "Windows_NT") {
    Write-LogError "This script must be run on Windows."
    exit 1
}

# Check required tools
$requiredCommands = @("rustc", "cargo", "node", "npm")
foreach ($cmd in $requiredCommands) {
    if (-not (Test-CommandExists $cmd)) {
        Write-LogError "Required command not found: $cmd"
        exit 1
    }
}

# Check tauri-cli
try {
    $tauriVersion = cargo tauri --version 2>&1
    Write-LogInfo "tauri-cli version: $tauriVersion"
}
catch {
    Write-LogError "tauri-cli not found. Install with: cargo install tauri-cli --version '^2'"
    exit 1
}

# Check Rust target
$installedTargets = rustup target list --installed
if ($installedTargets -notcontains $BuildTarget) {
    Write-LogWarn "Adding Rust target: $BuildTarget"
    rustup target add $BuildTarget
}

# ---------------------------------------------------------------------------
# Build Frontend
# ---------------------------------------------------------------------------
Set-Location $ProjectRoot

if (-not $SkipFrontendBuild) {
    Write-LogInfo "Installing npm dependencies..."
    npm ci
    if ($LASTEXITCODE -ne 0) {
        Write-LogError "npm ci failed with exit code $LASTEXITCODE"
        exit $LASTEXITCODE
    }

    Write-LogInfo "Building frontend..."
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-LogError "npm run build failed with exit code $LASTEXITCODE"
        exit $LASTEXITCODE
    }
}
else {
    Write-LogInfo "Skipping frontend build (-SkipFrontendBuild)"
}

# ---------------------------------------------------------------------------
# Build Tauri App
# ---------------------------------------------------------------------------
Write-LogInfo "Building Tauri application for target: $BuildTarget..."

$buildArgs = @("tauri", "build", "--target", $BuildTarget)

if ($Verbose) {
    $buildArgs += "--verbose"
}

cargo @buildArgs
if ($LASTEXITCODE -ne 0) {
    Write-LogError "Tauri build failed with exit code $LASTEXITCODE"
    exit $LASTEXITCODE
}

# ---------------------------------------------------------------------------
# Locate Output Artifacts
# ---------------------------------------------------------------------------
$nsisExe = Get-ChildItem -Path "$ProjectRoot\target" -Recurse -Filter "*-setup.exe" |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

$msiFile = Get-ChildItem -Path "$ProjectRoot\target" -Recurse -Filter "*.msi" -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

if ($null -eq $nsisExe) {
    Write-LogError "No NSIS installer (.exe) found in target directory after build."
    exit 1
}

Write-LogInfo "NSIS installer: $($nsisExe.FullName)"

if ($null -ne $msiFile) {
    Write-LogInfo "MSI installer:  $($msiFile.FullName)"
}

# ---------------------------------------------------------------------------
# Generate Checksums
# ---------------------------------------------------------------------------
$artifacts = @($nsisExe)
if ($null -ne $msiFile) {
    $artifacts += $msiFile
}

foreach ($artifact in $artifacts) {
    $hash = Get-FileHash -Path $artifact.FullName -Algorithm SHA256
    $checksumContent = "$($hash.Hash)  $($artifact.Name)"
    $checksumPath = "$($artifact.FullName).sha256"
    $checksumContent | Out-File -FilePath $checksumPath -Encoding utf8 -NoNewline
    Write-LogInfo "SHA-256: $checksumContent"
}

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
$nsisSize = [math]::Round($nsisExe.Length / 1MB, 2)
Write-LogInfo "Build completed successfully!"
Write-LogInfo "  NSIS Installer: $($nsisExe.FullName)"
Write-LogInfo "  Size:           $nsisSize MB"

if ($null -ne $msiFile) {
    $msiSize = [math]::Round($msiFile.Length / 1MB, 2)
    Write-LogInfo "  MSI Installer:  $($msiFile.FullName)"
    Write-LogInfo "  Size:           $msiSize MB"
}

Write-LogInfo ""
Write-LogInfo "Next steps:"
Write-LogInfo "  1. Run .\scripts\sign-windows.ps1 to sign the binaries"
Write-LogInfo "  2. Verify signature: signtool verify /pa `"$($nsisExe.FullName)`""

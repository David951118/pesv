<#
.SYNOPSIS
    Sign Windows binaries with AzureSignTool or signtool.

.DESCRIPTION
    Signs the AION Defensa Predictiva S.A.S Windows installer and executables using
    either Azure Key Vault (AzureSignTool) or a local PFX certificate
    (signtool). Supports timestamping for long-term signature validity.

.PARAMETER ArtifactPath
    Path to the specific artifact to sign. If not provided, searches the
    target directory for NSIS installers and .exe files.

.PARAMETER UseLocalCert
    Use a local .pfx certificate with signtool instead of Azure Key Vault.

.PARAMETER TimestampServer
    RFC 3161 timestamp server URL. Default: http://timestamp.digicert.com

.PARAMETER Verbose
    Enable verbose output.

.NOTES
    Prerequisites:
      - For Azure signing: .NET SDK, AzureSignTool
      - For local signing: Windows SDK (signtool.exe)
      - Appropriate code signing certificate

    Environment Variables for Azure Key Vault signing:
      AZURE_KEY_VAULT_URI      — Azure Key Vault URI
      AZURE_CLIENT_ID          — Azure AD application client ID
      AZURE_CLIENT_SECRET      — Azure AD application client secret
      AZURE_TENANT_ID          — Azure AD tenant ID
      AZURE_CERT_NAME          — Certificate name in Key Vault

    Environment Variables for local PFX signing:
      WINDOWS_CERTIFICATE_PATH     — Path to .pfx certificate file
      WINDOWS_CERTIFICATE_PASSWORD — Password for the .pfx file

    Usage:
      .\scripts\sign-windows.ps1
      .\scripts\sign-windows.ps1 -UseLocalCert
      .\scripts\sign-windows.ps1 -ArtifactPath ".\target\release\app-setup.exe"
#>

[CmdletBinding()]
param(
    [string]$ArtifactPath,
    [switch]$UseLocalCert,
    [string]$TimestampServer = "http://timestamp.digicert.com",
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
$Description = "AION Defensa Predictiva S.A.S"
$DescriptionUrl = "https://github.com/your-org/aion-defensa-predictiva"

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

function Write-LogStep {
    param([string]$Message)
    Write-Host "[STEP] $Message" -ForegroundColor Cyan
}

function Test-CommandExists {
    param([string]$Command)
    $null = Get-Command $Command -ErrorAction SilentlyContinue
    return $?
}

function Find-SignTool {
    # Search for signtool in Windows SDK paths
    $sdkPaths = @(
        "${env:ProgramFiles(x86)}\Windows Kits\10\bin\*\x64\signtool.exe",
        "${env:ProgramFiles}\Windows Kits\10\bin\*\x64\signtool.exe"
    )

    foreach ($pattern in $sdkPaths) {
        $found = Get-Item $pattern -ErrorAction SilentlyContinue | Sort-Object FullName -Descending | Select-Object -First 1
        if ($null -ne $found) {
            return $found.FullName
        }
    }

    # Try PATH
    $inPath = Get-Command signtool.exe -ErrorAction SilentlyContinue
    if ($null -ne $inPath) {
        return $inPath.Source
    }

    return $null
}

# ---------------------------------------------------------------------------
# Preflight Checks
# ---------------------------------------------------------------------------
Write-LogInfo "Starting Windows signing process..."

if ($env:OS -ne "Windows_NT") {
    Write-LogError "This script must be run on Windows."
    exit 1
}

# ---------------------------------------------------------------------------
# Locate Artifacts
# ---------------------------------------------------------------------------
Write-LogStep "Step 1/4: Locating artifacts to sign..."

$artifactsToSign = @()

if ($ArtifactPath) {
    if (-not (Test-Path $ArtifactPath)) {
        Write-LogError "Specified artifact not found: $ArtifactPath"
        exit 1
    }
    $artifactsToSign += Get-Item $ArtifactPath
}
else {
    # Search for NSIS installer
    $nsisExe = Get-ChildItem -Path "$ProjectRoot\target" -Recurse -Filter "*-setup.exe" -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1

    # Search for main executable
    $mainExe = Get-ChildItem -Path "$ProjectRoot\target\release" -Filter "*.exe" -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -notmatch "setup" } |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1

    # Search for MSI
    $msiFile = Get-ChildItem -Path "$ProjectRoot\target" -Recurse -Filter "*.msi" -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1

    if ($null -ne $mainExe) { $artifactsToSign += $mainExe }
    if ($null -ne $nsisExe) { $artifactsToSign += $nsisExe }
    if ($null -ne $msiFile) { $artifactsToSign += $msiFile }
}

if ($artifactsToSign.Count -eq 0) {
    Write-LogError "No artifacts found to sign."
    Write-LogError "Run .\scripts\build-windows.ps1 first to build the application."
    exit 1
}

Write-LogInfo "Found $($artifactsToSign.Count) artifact(s) to sign:"
foreach ($artifact in $artifactsToSign) {
    $size = [math]::Round($artifact.Length / 1MB, 2)
    Write-LogInfo "  - $($artifact.Name) ($size MB)"
}

# ---------------------------------------------------------------------------
# Step 2: Validate signing configuration
# ---------------------------------------------------------------------------
Write-LogStep "Step 2/4: Validating signing configuration..."

if ($UseLocalCert) {
    # --- Local PFX Certificate Signing ---
    Write-LogInfo "Mode: Local PFX certificate (signtool)"

    if (-not $env:WINDOWS_CERTIFICATE_PATH) {
        Write-LogError "WINDOWS_CERTIFICATE_PATH environment variable is not set."
        Write-LogError "Set it to the path of your .pfx code signing certificate."
        exit 1
    }

    if (-not (Test-Path $env:WINDOWS_CERTIFICATE_PATH)) {
        Write-LogError "Certificate file not found: $($env:WINDOWS_CERTIFICATE_PATH)"
        exit 1
    }

    if (-not $env:WINDOWS_CERTIFICATE_PASSWORD) {
        Write-LogWarn "WINDOWS_CERTIFICATE_PASSWORD is not set. signtool may prompt for it."
    }

    # Find signtool
    $signtoolPath = Find-SignTool
    if (-not $signtoolPath) {
        Write-LogError "signtool.exe not found. Install the Windows SDK."
        Write-LogError "Download from: https://developer.microsoft.com/en-us/windows/downloads/windows-sdk/"
        exit 1
    }
    Write-LogInfo "signtool: $signtoolPath"
}
else {
    # --- Azure Key Vault Signing ---
    Write-LogInfo "Mode: Azure Key Vault (AzureSignTool)"

    $requiredVars = @(
        "AZURE_KEY_VAULT_URI",
        "AZURE_CLIENT_ID",
        "AZURE_CLIENT_SECRET",
        "AZURE_TENANT_ID",
        "AZURE_CERT_NAME"
    )

    $missingVars = @()
    foreach ($var in $requiredVars) {
        if (-not (Get-Item "env:$var" -ErrorAction SilentlyContinue)) {
            $missingVars += $var
        }
    }

    if ($missingVars.Count -gt 0) {
        Write-LogError "Missing required environment variables for Azure Key Vault signing:"
        foreach ($var in $missingVars) {
            Write-LogError "  - $var"
        }
        Write-LogError ""
        Write-LogError "Set these variables or use -UseLocalCert for PFX-based signing."
        exit 1
    }

    # Install AzureSignTool if not present
    if (-not (Test-CommandExists "AzureSignTool")) {
        Write-LogInfo "Installing AzureSignTool..."
        dotnet tool install --global AzureSignTool
        if ($LASTEXITCODE -ne 0) {
            Write-LogError "Failed to install AzureSignTool. Ensure .NET SDK is installed."
            exit 1
        }
    }

    $azureSignToolVersion = AzureSignTool --version 2>&1
    Write-LogInfo "AzureSignTool version: $azureSignToolVersion"
}

# ---------------------------------------------------------------------------
# Step 3: Sign artifacts
# ---------------------------------------------------------------------------
Write-LogStep "Step 3/4: Signing artifacts..."

$signedCount = 0

foreach ($artifact in $artifactsToSign) {
    Write-LogInfo "Signing: $($artifact.Name)..."

    if ($UseLocalCert) {
        # --- signtool signing ---
        $signtoolArgs = @(
            "sign",
            "/f", $env:WINDOWS_CERTIFICATE_PATH,
            "/fd", "SHA256",
            "/tr", $TimestampServer,
            "/td", "SHA256",
            "/d", $Description,
            "/du", $DescriptionUrl
        )

        if ($env:WINDOWS_CERTIFICATE_PASSWORD) {
            $signtoolArgs += @("/p", $env:WINDOWS_CERTIFICATE_PASSWORD)
        }

        if ($Verbose) {
            $signtoolArgs += "/v"
        }

        $signtoolArgs += $artifact.FullName

        & $signtoolPath @signtoolArgs
        if ($LASTEXITCODE -ne 0) {
            Write-LogError "Failed to sign: $($artifact.Name)"
            exit $LASTEXITCODE
        }
    }
    else {
        # --- AzureSignTool signing ---
        $azureArgs = @(
            "sign",
            "--azure-key-vault-url", $env:AZURE_KEY_VAULT_URI,
            "--azure-key-vault-client-id", $env:AZURE_CLIENT_ID,
            "--azure-key-vault-client-secret", $env:AZURE_CLIENT_SECRET,
            "--azure-key-vault-tenant-id", $env:AZURE_TENANT_ID,
            "--azure-key-vault-certificate", $env:AZURE_CERT_NAME,
            "--file-digest", "sha256",
            "--timestamp-rfc3161", $TimestampServer,
            "--timestamp-digest", "sha256",
            "--description", $Description,
            "--description-url", $DescriptionUrl
        )

        if ($Verbose) {
            $azureArgs += "--verbose"
        }

        $azureArgs += $artifact.FullName

        AzureSignTool @azureArgs
        if ($LASTEXITCODE -ne 0) {
            Write-LogError "Failed to sign: $($artifact.Name)"
            exit $LASTEXITCODE
        }
    }

    $signedCount++
    Write-LogInfo "Successfully signed: $($artifact.Name)"
}

# ---------------------------------------------------------------------------
# Step 4: Verify signatures
# ---------------------------------------------------------------------------
Write-LogStep "Step 4/4: Verifying signatures..."

$signtoolPath = Find-SignTool
if ($signtoolPath) {
    foreach ($artifact in $artifactsToSign) {
        Write-LogInfo "Verifying: $($artifact.Name)..."
        & $signtoolPath verify /pa /v $artifact.FullName 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-LogInfo "Signature valid: $($artifact.Name)"
        }
        else {
            Write-LogWarn "Signature verification returned non-zero for: $($artifact.Name)"
            Write-LogWarn "This may be expected if signtool cannot find the root CA in the local store."
        }
    }
}
else {
    Write-LogWarn "signtool not found; skipping signature verification."
    Write-LogWarn "Install Windows SDK to enable verification."
}

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
Write-LogInfo ""
Write-LogInfo "Signing complete!"
Write-LogInfo "  Signed $signedCount artifact(s)"
Write-LogInfo "  Timestamp server: $TimestampServer"
Write-LogInfo ""

foreach ($artifact in $artifactsToSign) {
    Write-LogInfo "  - $($artifact.FullName)"
}

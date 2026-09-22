# Bullet API Automation Platform - Installer Build Script
param(
    [switch]$SkipFrontendBuild = $false
)

$ErrorActionPreference = "Stop"
$rootDir = (Get-Item $PSScriptRoot).Parent.FullName
Set-Location $rootDir

Write-Host "=== BULLET SINGLE-FILE INSTALLER BUILD ===" -ForegroundColor Cyan

# 1. Build Frontend Assets (if not skipped)
if (-not $SkipFrontendBuild) {
    Write-Host "[1/5] Building React Frontend Assets..." -ForegroundColor Yellow
    Push-Location "src/Bullet.Web"
    try {
        & "npm.cmd" run build
    } finally {
        Pop-Location
    }

    Write-Host "Copying Frontend bundle to API wwwroot..." -ForegroundColor DarkGray
    if (-not (Test-Path "src/Bullet.Api/wwwroot")) {
        New-Item -ItemType Directory -Path "src/Bullet.Api/wwwroot" -Force | Out-Null
    }
    Copy-Item -Path "src/Bullet.Web/dist/*" -Destination "src/Bullet.Api/wwwroot" -Recurse -Force
}

# 2. Publish Desktop Application
Write-Host "[2/5] Publishing Standalone Desktop App..." -ForegroundColor Yellow
dotnet publish "src/Bullet.Desktop/Bullet.Desktop.csproj" -c Release -r win-x64 --self-contained false -o "publish/desktop"

# Clean up debug symbols and temporary files from publish folder
Get-ChildItem -Path "publish/desktop" -Include "*.pdb", "*.log", "bullet.db*" -Recurse -File | Remove-Item -Force -ErrorAction SilentlyContinue

# 3. Create Payload Archive
Write-Host "[3/5] Packaging Embedded Application Payload..." -ForegroundColor Yellow
$payloadZip = "src/Bullet.Installer/payload.zip"
if (Test-Path $payloadZip) { Remove-Item $payloadZip -Force }
Compress-Archive -Path "publish/desktop/*" -DestinationPath $payloadZip -Force
$zipSize = (Get-Item $payloadZip).Length / 1MB
Write-Host "Payload archive created: $([Math]::Round($zipSize, 2)) MB" -ForegroundColor Green

# 4. Build Native Single-File Installer
Write-Host "[4/5] Building Native Single-File Installer (Bullet-Setup.exe)..." -ForegroundColor Yellow
if (-not (Test-Path "dist-installer")) {
    New-Item -ItemType Directory -Path "dist-installer" -Force | Out-Null
}

dotnet publish "src/Bullet.Installer/Bullet.Installer.csproj" -c Release -r win-x64 -p:PublishSingleFile=true -o "dist-installer"

# Clean up intermediate payload.zip from source tree
Remove-Item $payloadZip -Force -ErrorAction SilentlyContinue

# 5. Inno Setup Build (if ISCC is available)
$isccPaths = @(
    "$env:LOCALAPPDATA\Programs\InnoSetup\ISCC.exe",
    "C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
)
$iscc = $isccPaths | Where-Object { Test-Path $_ } | Select-Object -First 1

if ($iscc) {
    Write-Host "[5/5] Building Inno Setup Package using $iscc..." -ForegroundColor Yellow
    & $iscc "installer/Bullet.iss"
} else {
    Write-Host "[5/5] Skipping Inno Setup build (ISCC.exe not in standard paths)." -ForegroundColor DarkGray
}

# 6. Authenticode Signing (if certificate exists in CurrentUser\My)
$cert = (Get-ChildItem Cert:\CurrentUser\My -ErrorAction SilentlyContinue | Where-Object { $_.Subject -like "*BULLET Open Source Project*" -or $_.Subject -like "*VishalViswanathan03*" } | Select-Object -First 1)
if ($cert) {
    Write-Host "`nAuthenticode Signing Installer Binaries with DigiCert timestamp..." -ForegroundColor Cyan
    Get-ChildItem -Path "dist-installer" -Filter "*.exe" | ForEach-Object {
        Write-Host "Signing $($_.Name)..." -ForegroundColor Yellow
        $sig = Set-AuthenticodeSignature -FilePath $_.FullName -Certificate $cert -TimestampServer "http://timestamp.digicert.com" -HashAlgorithm SHA256 -IncludeChain All
        Write-Host "Signature status: $($sig.Status)" -ForegroundColor ($sig.Status -eq 'Valid' ? 'Green' : 'DarkYellow')
    }
} else {
    Write-Host "`n[Notice] No code-signing certificate found in Cert:\CurrentUser\My. Installers left unsigned for local dev." -ForegroundColor DarkGray
}

# Generate SHA256 Checksums
Write-Host "`nComputing SHA256 Checksums for Release Artifacts..." -ForegroundColor Cyan
Get-ChildItem -Path "dist-installer" -Filter "*.exe" | ForEach-Object {
    $hash = (Get-FileHash -Algorithm SHA256 $_.FullName).Hash
    "$hash  $($_.Name)" | Out-File -Encoding utf8 "$($_.FullName).sha256"
    Write-Host "$($_.Name) ($([Math]::Round($_.Length / 1MB, 2)) MB) -> $hash" -ForegroundColor Green
}

Write-Host "`nInstaller build complete! Artifacts are available in: dist-installer/" -ForegroundColor Green

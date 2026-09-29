param(
    [switch]$SkipFrontendBuild = $false
)

$ErrorActionPreference = "Stop"
$rootDir = (Get-Item $PSScriptRoot).Parent.FullName
Set-Location $rootDir

Write-Host "=== BULLET MACOS NATIVE PACKAGING ===" -ForegroundColor Cyan

if (-not (Test-Path "dist-installer")) {
    New-Item -ItemType Directory -Path "dist-installer" -Force | Out-Null
}

# 1. Build and Package Apple Silicon (osx-arm64)
Write-Host "`n[1/2] Publishing and Packaging Apple Silicon (osx-arm64)..." -ForegroundColor Yellow
$armTarget = "publish/mac-arm64/Bullet.app/Contents/Resources/app"
dotnet publish "src/Bullet.Api/Bullet.Api.csproj" -c Release -r osx-arm64 --self-contained true -o $armTarget
Copy-Item -Path "src/Bullet.Api/wwwroot" -Destination "$armTarget/wwwroot" -Recurse -Force
Copy-Item -Path "scripts/run-mac.sh" -Destination "publish/mac-arm64/run-mac.sh" -Force
Get-ChildItem -Path $armTarget -Include "*.pdb" -Recurse -File | Remove-Item -Force -ErrorAction SilentlyContinue

$armZip = "dist-installer/Bullet-macOS-AppleSilicon-arm64.zip"
if (Test-Path $armZip) { Remove-Item $armZip -Force }
Compress-Archive -Path "publish/mac-arm64/*" -DestinationPath $armZip -Force
$armHash = (Get-FileHash -Algorithm SHA256 $armZip).Hash
"$armHash  Bullet-macOS-AppleSilicon-arm64.zip" | Out-File -Encoding utf8 "$armZip.sha256"
Write-Host "Apple Silicon Package: $armZip ($([Math]::Round((Get-Item $armZip).Length / 1MB, 2)) MB)" -ForegroundColor Green
Write-Host "SHA256: $armHash" -ForegroundColor Cyan

# 2. Build and Package Intel Mac (osx-x64)
Write-Host "`n[2/2] Publishing and Packaging Intel Mac (osx-x64)..." -ForegroundColor Yellow
$x64Target = "publish/mac-x64/Bullet.app/Contents/Resources/app"
dotnet publish "src/Bullet.Api/Bullet.Api.csproj" -c Release -r osx-x64 --self-contained true -o $x64Target
Copy-Item -Path "src/Bullet.Api/wwwroot" -Destination "$x64Target/wwwroot" -Recurse -Force
Copy-Item -Path "scripts/run-mac.sh" -Destination "publish/mac-x64/run-mac.sh" -Force
Get-ChildItem -Path $x64Target -Include "*.pdb" -Recurse -File | Remove-Item -Force -ErrorAction SilentlyContinue

$x64Zip = "dist-installer/Bullet-macOS-Intel-x64.zip"
if (Test-Path $x64Zip) { Remove-Item $x64Zip -Force }
Compress-Archive -Path "publish/mac-x64/*" -DestinationPath $x64Zip -Force
$x64Hash = (Get-FileHash -Algorithm SHA256 $x64Zip).Hash
"$x64Hash  Bullet-macOS-Intel-x64.zip" | Out-File -Encoding utf8 "$x64Zip.sha256"
Write-Host "Intel Mac Package: $x64Zip ($([Math]::Round((Get-Item $x64Zip).Length / 1MB, 2)) MB)" -ForegroundColor Green
Write-Host "SHA256: $x64Hash" -ForegroundColor Cyan

Write-Host "`nmacOS packaging complete!" -ForegroundColor Green

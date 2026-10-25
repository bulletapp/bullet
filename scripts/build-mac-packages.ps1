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

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

function Create-MacZip($sourceDir, $zipPath) {
    if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
    $resolvedSource = (Get-Item $sourceDir).FullName
    $zip = [System.IO.Compression.ZipFile]::Open($zipPath, [System.IO.Compression.ZipArchiveMode]::Create)
    try {
        $files = Get-ChildItem -Path $resolvedSource -Recurse -File
        foreach ($file in $files) {
            $rel = $file.FullName.Substring($resolvedSource.Length).TrimStart('\', '/') -replace '\\', '/'
            $entry = $zip.CreateEntry($rel, [System.IO.Compression.CompressionLevel]::Optimal)
            
            $isExecutable = ($file.Extension -in @('.sh', '.command')) -or 
                            ($file.Name -in @('Bullet', 'Bullet.Api')) -or 
                            ($file.DirectoryName -like "*Contents\MacOS*")

            if ($isExecutable) {
                # 0100755 in octal = 0x81ED in high 16 bits (-rwxr-xr-x)
                $entry.ExternalAttributes = [int]0x81ED0000
            } else {
                # 0100644 in octal = 0x81A4 in high 16 bits (-rw-r--r--)
                $entry.ExternalAttributes = [int]0x81A40000
            }

            $entryStream = $entry.Open()
            try {
                $fileStream = [System.IO.File]::OpenRead($file.FullName)
                try {
                    $fileStream.CopyTo($entryStream)
                } finally {
                    $fileStream.Dispose()
                }
            } finally {
                $entryStream.Dispose()
            }
        }
    } finally {
        $zip.Dispose()
    }
}

# 1. Build and Package Apple Silicon (osx-arm64)
Write-Host "`n[1/2] Publishing and Packaging Apple Silicon (osx-arm64)..." -ForegroundColor Yellow
$armTarget = "publish/mac-arm64/Bullet.app/Contents/Resources/app"
dotnet publish "src/Bullet.Api/Bullet.Api.csproj" -c Release -r osx-arm64 --self-contained true -o $armTarget
if (Test-Path "$armTarget/wwwroot") { Remove-Item "$armTarget/wwwroot" -Recurse -Force }
New-Item -ItemType Directory -Path "$armTarget/wwwroot" -Force | Out-Null
Copy-Item -Path "src/Bullet.Api/wwwroot/*" -Destination "$armTarget/wwwroot" -Recurse -Force
Copy-Item -Path "scripts/run-mac.sh" -Destination "publish/mac-arm64/run-mac.sh" -Force
Get-ChildItem -Path $armTarget -Include "*.pdb" -Recurse -File | Remove-Item -Force -ErrorAction SilentlyContinue

$armZip = "dist-installer/Bullet-macOS-AppleSilicon-arm64.zip"
Create-MacZip "publish/mac-arm64" $armZip
$armHash = (Get-FileHash -Algorithm SHA256 $armZip).Hash
"$armHash  Bullet-macOS-AppleSilicon-arm64.zip" | Out-File -Encoding utf8 "$armZip.sha256"
Write-Host "Apple Silicon Package: $armZip ($([Math]::Round((Get-Item $armZip).Length / 1MB, 2)) MB)" -ForegroundColor Green
Write-Host "SHA256: $armHash" -ForegroundColor Cyan

# 2. Build and Package Intel Mac (osx-x64)
Write-Host "`n[2/2] Publishing and Packaging Intel Mac (osx-x64)..." -ForegroundColor Yellow
$x64Target = "publish/mac-x64/Bullet.app/Contents/Resources/app"
dotnet publish "src/Bullet.Api/Bullet.Api.csproj" -c Release -r osx-x64 --self-contained true -o $x64Target
if (Test-Path "$x64Target/wwwroot") { Remove-Item "$x64Target/wwwroot" -Recurse -Force }
New-Item -ItemType Directory -Path "$x64Target/wwwroot" -Force | Out-Null
Copy-Item -Path "src/Bullet.Api/wwwroot/*" -Destination "$x64Target/wwwroot" -Recurse -Force
Copy-Item -Path "scripts/run-mac.sh" -Destination "publish/mac-x64/run-mac.sh" -Force
Get-ChildItem -Path $x64Target -Include "*.pdb" -Recurse -File | Remove-Item -Force -ErrorAction SilentlyContinue

$x64Zip = "dist-installer/Bullet-macOS-Intel-x64.zip"
Create-MacZip "publish/mac-x64" $x64Zip
$x64Hash = (Get-FileHash -Algorithm SHA256 $x64Zip).Hash
"$x64Hash  Bullet-macOS-Intel-x64.zip" | Out-File -Encoding utf8 "$x64Zip.sha256"
Write-Host "Intel Mac Package: $x64Zip ($([Math]::Round((Get-Item $x64Zip).Length / 1MB, 2)) MB)" -ForegroundColor Green
Write-Host "SHA256: $x64Hash" -ForegroundColor Cyan

Write-Host "`nmacOS packaging complete!" -ForegroundColor Green

@echo off
setlocal
echo =========================================================================
echo  BULLET Code-Signing Certificate Installer
echo =========================================================================
echo.
echo This utility installs the public code-signing certificate for BULLET
echo into your Windows CurrentUser Certificate Store (Trusted Root).
echo.
echo This resolves Windows SmartScreen warnings and verifies the publisher
echo as 'bulletapp'.
echo.

set "CER_PATH=%~dp0Bullet-Release.cer"
if not exist "%CER_PATH%" (
    set "CER_PATH=%~dp0publish\desktop\Bullet-Release.cer"
)
if not exist "%CER_PATH%" (
    set "CER_PATH=%~dp0dist-installer\Bullet-Release.cer"
)

if not exist "%CER_PATH%" (
    echo [ERROR] Could not find Bullet-Release.cer in this directory.
    echo Please make sure Bullet-Release.cer is located in the same folder as this script.
    echo.
    pause
    exit /b 1
)

echo Importing: %CER_PATH%
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$cert = Import-Certificate -FilePath '%CER_PATH%' -CertStoreLocation Cert:\CurrentUser\Root; $null = Import-Certificate -FilePath '%CER_PATH%' -CertStoreLocation Cert:\CurrentUser\TrustedPublisher -ErrorAction SilentlyContinue; Get-ChildItem '%~dp0' -Filter '*.exe' | Unblock-File -ErrorAction SilentlyContinue; Get-ChildItem '%~dp0' -Filter '*.zip' | Unblock-File -ErrorAction SilentlyContinue; if ($cert) { Write-Host '[SUCCESS] Certificate successfully trusted in CurrentUser\Root and TrustedPublisher!' -ForegroundColor Green; Write-Host ('Thumbprint: ' + $cert[0].Thumbprint) -ForegroundColor DarkCyan } else { Write-Host '[ERROR] Failed to import certificate.' -ForegroundColor Red; exit 1 }"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo [OK] Setup complete! Downloads unblocked and certificate trusted.
    echo You can now launch Bullet-Setup.exe directly without SmartScreen blocks.
) else (
    echo.
    echo [!] An error occurred during certificate import.
)

echo.
pause

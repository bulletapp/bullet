@echo off
setlocal
cd /d "%~dp0"
echo =========================================================================
echo   BULLET Windows Installer Setup
echo =========================================================================
echo.
echo Installing publisher certificate and unblocking installer...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$c = 'Bullet-Release.cer'; if (Test-Path $c) { Import-Certificate -FilePath $c -CertStoreLocation Cert:\CurrentUser\Root -ErrorAction SilentlyContinue | Out-Null; Import-Certificate -FilePath $c -CertStoreLocation Cert:\CurrentUser\TrustedPublisher -ErrorAction SilentlyContinue | Out-Null; } Get-ChildItem -Filter '*.exe' | Unblock-File -ErrorAction SilentlyContinue"
echo.
echo Starting BULLET Setup...
start "" "Bullet-Setup.exe"

@echo off
setlocal
cd /d "%~dp0"
echo =========================================================================
echo   BULLET Desktop (Portable)
echo =========================================================================
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$c = 'Bullet-Release.cer'; if (Test-Path $c) { Import-Certificate -FilePath $c -CertStoreLocation Cert:\CurrentUser\Root -ErrorAction SilentlyContinue | Out-Null; Import-Certificate -FilePath $c -CertStoreLocation Cert:\CurrentUser\TrustedPublisher -ErrorAction SilentlyContinue | Out-Null; } Get-ChildItem -Filter '*.exe' | Unblock-File -ErrorAction SilentlyContinue"
start "" "Bullet.exe"

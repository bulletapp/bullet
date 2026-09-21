#!/bin/bash
# ==============================================================================
# BULLET API Testing Platform - macOS Native Launcher
# https://github.com/bullet-sh/bullet
# ==============================================================================

set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "================================================================"
echo "           🚀 BULLET: Load. Aim. API. (macOS)                  "
echo "================================================================"
echo ""

# Find native executable or dotnet dll
EXECUTABLE=""
if [ -f "./Bullet.Api" ]; then
    chmod +x ./Bullet.Api 2>/dev/null || true
    EXECUTABLE="./Bullet.Api"
elif [ -f "./Contents/Resources/app/Bullet.Api" ]; then
    chmod +x ./Contents/Resources/app/Bullet.Api 2>/dev/null || true
    EXECUTABLE="./Contents/Resources/app/Bullet.Api"
elif [ -f "./Bullet.Api.dll" ]; then
    EXECUTABLE="dotnet ./Bullet.Api.dll"
elif [ -f "./Contents/Resources/app/Bullet.Api.dll" ]; then
    EXECUTABLE="dotnet ./Contents/Resources/app/Bullet.Api.dll"
elif [ -f "../src/Bullet.Api/Bullet.Api.csproj" ]; then
    EXECUTABLE="dotnet run --project ../src/Bullet.Api"
fi

if [ -z "$EXECUTABLE" ]; then
    echo "❌ Error: Could not locate BULLET Engine executable."
    echo "Please ensure .NET 10 SDK is installed from https://dotnet.microsoft.com/download/dotnet/10.0"
    exit 1
fi

PORT=5000
echo "⚡ Starting BULLET Core Engine on http://localhost:$PORT..."
$EXECUTABLE --urls "http://127.0.0.1:$PORT" &
API_PID=$!

# Trap termination to kill the API process on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down BULLET Engine (PID: $API_PID)..."
    kill "$API_PID" 2>/dev/null || true
    exit 0
}
trap cleanup SIGINT SIGTERM EXIT

# Wait for server to be responsive
echo "⏳ Initializing telemetry and workspace..."
for i in {1..30}; do
    if curl -s "http://127.0.0.1:$PORT/" >/dev/null 2>&1 || curl -s "http://127.0.0.1:$PORT/health" >/dev/null 2>&1; then
        echo "✓ BULLET Engine is active!"
        break
    fi
    sleep 0.5
done

# Launch browser on macOS
echo "🎯 Launching BULLET Web IDE in browser..."
open "http://localhost:$PORT" 2>/dev/null || open "http://127.0.0.1:$PORT" 2>/dev/null || true

echo ""
echo "BULLET is actively running in background (PID: $API_PID)."
echo "Press Ctrl+C in this terminal window to stop the service."
echo "================================================================"

wait "$API_PID"

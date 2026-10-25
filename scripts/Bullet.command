#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# Strip Apple Gatekeeper quarantine from all files in the extracted bundle
xattr -cr "$DIR" 2>/dev/null || true
# Ensure execute permissions on launcher and core binaries
chmod +x "$DIR/run-mac.sh" "$DIR/Bullet.app/Contents/MacOS/Bullet" "$DIR/Bullet.app/Contents/Resources/app/Bullet.Api" 2>/dev/null || true
exec "$DIR/run-mac.sh"

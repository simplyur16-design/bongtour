#!/usr/bin/env bash
# Launch simplyur on iOS Simulator (macOS + full Xcode required).
# Windows cannot run the Apple Simulator — use this Mac (or a cloud Mac).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="$ROOT/apps/simplyur-mobile"
cd "$APP"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "iOS Simulator only works on macOS. Windows: use Android emulator or Expo Go on a physical iPhone."
  exit 1
fi

if ! xcodebuild -version >/dev/null 2>&1; then
  echo "Xcode is not installed (or xcode-select points at Command Line Tools only)."
  echo "1) Install Xcode from the Mac App Store (~12GB+)."
  echo "2) Open Xcode once → accept license → Settings → Locations → Command Line Tools = Xcode."
  echo "3) Or run: sudo xcode-select -s /Applications/Xcode.app/Contents/Developer"
  echo "4) Re-run: bash scripts/run-simplyur-ios-simulator.sh"
  open "macappstore://apps.apple.com/app/xcode/id497799835" 2>/dev/null || true
  exit 2
fi

if ! xcrun simctl list devices available >/dev/null 2>&1; then
  echo "simctl unavailable. Open Xcode once to finish installing platforms/simulators."
  exit 3
fi

# Prefer a recent iPhone if present
UDID="$(xcrun simctl list devices available -j | python3 - <<'PY'
import json,sys
data=json.load(sys.stdin)
best=None
for runtime, devices in data.get("devices", {}).items():
  if "iOS" not in runtime: continue
  for d in devices:
    if d.get("isAvailable") and "iPhone" in d.get("name",""):
      best=d["udid"]
      if "iPhone 16" in d["name"] or "iPhone 15" in d["name"]:
        print(d["udid"]); sys.exit(0)
if best: print(best)
PY
)"

if [[ -z "${UDID:-}" ]]; then
  echo "No available iPhone simulator. In Xcode: Window → Devices and Simulators → + → iPhone."
  exit 4
fi

echo "Booting simulator $UDID ..."
xcrun simctl boot "$UDID" 2>/dev/null || true
open -a Simulator

if [[ ! -d node_modules/expo ]]; then
  npm install
fi

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created .env from .env.example — set EXPO_PUBLIC_API_BASE_URL if needed."
fi

echo "Starting Expo on iOS Simulator..."
npx expo start --ios --clear

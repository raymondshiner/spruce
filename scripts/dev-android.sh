#!/usr/bin/env bash
# scripts/dev-android.sh
# Boot the Pixel_8_Pro AVD, tile it on the right side of the screen, and
# start `expo start` in the foreground so this kitty becomes the Metro
# console on the left.
#
# Usage:
#   ./scripts/dev-android.sh              # default AVD (Pixel_8_Pro)
#   ./scripts/dev-android.sh Pixel_7      # specific AVD
#
# Layout: emulator pinned to the right 60% of the focused monitor's
# usable area (vertical screens take less width — Pixel emulator window
# at 1:1 scale is taller than wide, so 60% is enough).

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
EMULATOR="$ANDROID_HOME/emulator/emulator"
ADB="${ANDROID_HOME}/platform-tools/adb"
[[ -x "$ADB" ]] || ADB="adb"

AVD="${1:-Pixel_8_Pro}"

if ! "$EMULATOR" -list-avds | grep -qx "$AVD"; then
  echo "dev-android: AVD '$AVD' not found. Available:" >&2
  "$EMULATOR" -list-avds >&2
  exit 1
fi

# ── Boot the emulator if it's not already running ────────────────────────────
if "$ADB" devices | awk 'NR>1 {print $1}' | grep -q '^emulator-'; then
  echo "dev-android: emulator already running"
else
  echo "dev-android: booting AVD '$AVD'..."
  EMU_LOG="/tmp/spruce-emulator.log"
  # -no-snapshot-save keeps boot state clean; drop it once you have a warm snapshot.
  # -gpu host uses the host GPU (NVIDIA RTX on this machine).
  setsid "$EMULATOR" -avd "$AVD" -gpu host -no-boot-anim \
    > "$EMU_LOG" 2>&1 < /dev/null &
  disown 2>/dev/null || true
fi

# ── Wait for device + full boot ──────────────────────────────────────────────
echo "dev-android: waiting for device..."
"$ADB" wait-for-device

echo "dev-android: waiting for boot to complete..."
for _ in $(seq 1 120); do
  BOOTED=$("$ADB" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' || echo "")
  [[ "$BOOTED" == "1" ]] && break
  sleep 1
done
[[ "${BOOTED:-}" == "1" ]] || { echo "dev-android: emulator failed to boot in 120s" >&2; exit 1; }
echo "dev-android: emulator booted"

# ── Tile the emulator window via hyprctl ─────────────────────────────────────
# Emulator window class is 'Emulator' (Qt app). We compute the right-side
# rectangle from the focused monitor's geometry and dispatch a resize+move.
if command -v hyprctl >/dev/null 2>&1; then
  MON_JSON=$(hyprctl monitors -j | jq -r '.[] | select(.focused==true)')
  MW=$(echo "$MON_JSON" | jq -r '.width')
  MH=$(echo "$MON_JSON" | jq -r '.height')
  MX=$(echo "$MON_JSON" | jq -r '.x')
  MY=$(echo "$MON_JSON" | jq -r '.y')
  RL=$(echo "$MON_JSON" | jq -r '.reserved[0]')
  RT=$(echo "$MON_JSON" | jq -r '.reserved[1]')
  RR=$(echo "$MON_JSON" | jq -r '.reserved[2]')
  RB=$(echo "$MON_JSON" | jq -r '.reserved[3]')

  USABLE_W=$(( MW - RL - RR ))
  USABLE_H=$(( MH - RT - RB ))
  EMU_W=$(( USABLE_W * 60 / 100 ))
  EMU_H=$(( USABLE_H ))
  EMU_X=$(( MX + RL + USABLE_W - EMU_W ))
  EMU_Y=$(( MY + RT ))

  # Find the emulator window and float+position it. Retry a few times because
  # the window may take a moment to register after boot.
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    EMU_ADDR=$(hyprctl clients -j | jq -r '[.[] | select(.class=="Emulator" or (.class | test("qemu"; "i")))][0].address // empty')
    [[ -n "$EMU_ADDR" ]] && break
    sleep 0.5
  done

  if [[ -n "$EMU_ADDR" ]]; then
    hyprctl dispatch setfloating "address:$EMU_ADDR" >/dev/null || true
    hyprctl dispatch resizewindowpixel "exact $EMU_W $EMU_H,address:$EMU_ADDR" >/dev/null || true
    hyprctl dispatch movewindowpixel "exact $EMU_X $EMU_Y,address:$EMU_ADDR" >/dev/null || true
    echo "dev-android: emulator tiled to ${EMU_W}x${EMU_H} @ ${EMU_X},${EMU_Y}"
  else
    echo "dev-android: warning — could not find emulator window to tile" >&2
  fi
fi

# ── Start Metro / Expo dev server in the foreground ──────────────────────────
echo "dev-android: starting Expo (press 'a' to open on Android, 'r' to reload)"
exec npx expo start --android

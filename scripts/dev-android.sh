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
# Layout: emulator joins the master layout as a tiled window on the
# right, sized just wide enough to maintain the phone's portrait aspect
# at full screen height. Smith kitty takes the rest of the column on
# the left.

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
  RL=$(echo "$MON_JSON" | jq -r '.reserved[0]')
  RT=$(echo "$MON_JSON" | jq -r '.reserved[1]')
  RR=$(echo "$MON_JSON" | jq -r '.reserved[2]')
  RB=$(echo "$MON_JSON" | jq -r '.reserved[3]')
  USABLE_W=$(( MW - RL - RR ))
  USABLE_H=$(( MH - RT - RB ))

  # Pull the device's portrait aspect from the AVD config (hw.lcd.width/height).
  # Fall back to Pixel 8 Pro (1344x2992) if missing.
  AVD_INI="$HOME/.android/avd/${AVD}.avd/config.ini"
  DEV_W=$(grep -E '^hw\.lcd\.width=' "$AVD_INI" 2>/dev/null | cut -d= -f2)
  DEV_H=$(grep -E '^hw\.lcd\.height=' "$AVD_INI" 2>/dev/null | cut -d= -f2)
  [[ -z "$DEV_W" || -z "$DEV_H" ]] && { DEV_W=1344; DEV_H=2992; }

  # Master tile width that makes the LCD render at full available height.
  # Emulator window has ~32px of titlebar chrome above the LCD; subtract it
  # from height before applying the device aspect ratio so the inner phone
  # screen ends up filling vertically.
  CHROME_H=32
  MASTER_W=$(( (USABLE_H - CHROME_H) * DEV_W / DEV_H ))
  # mfact is a 0..1 fraction. Compute with float precision via awk.
  MFACT=$(awk -v w="$MASTER_W" -v u="$USABLE_W" 'BEGIN { printf "%.4f", w/u }')

  # Ensure master layout + orientation-right (master on the right side).
  PREV_LAYOUT=$(hyprctl getoption -j general:layout | jq -r '.str // "dwindle"')
  [[ "$PREV_LAYOUT" != master ]] && hyprctl keyword general:layout master >/dev/null
  hyprctl dispatch layoutmsg orientationright >/dev/null

  # Find the emulator's main window (skip the secondary toolbar window).
  EMU_ADDR=""; TOOL_ADDR=""
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    EMU_ADDR=$(hyprctl clients -j | jq -r '[.[] | select(.class=="Emulator" and (.title | startswith("Android Emulator")))][0].address // empty')
    [[ -n "$EMU_ADDR" ]] && break
    sleep 0.5
  done
  TOOL_ADDR=$(hyprctl clients -j | jq -r '[.[] | select(.class=="Emulator" and (.title=="Emulator"))][0].address // empty')

  if [[ -n "$EMU_ADDR" ]]; then
    # Make sure it's tiled (in case a previous run / window rule floated it).
    hyprctl dispatch settiled "address:$EMU_ADDR" >/dev/null 2>&1 || true
    # Promote to master so it sits on the right side of the workspace.
    hyprctl dispatch focuswindow "address:$EMU_ADDR" >/dev/null
    sleep 0.15
    # Only swap if we're not already master.
    MASTER_ADDR=$(hyprctl clients -j | jq -r --arg ws "$(hyprctl activeworkspace -j | jq -r .name)" \
      '[.[] | select(.workspace.name==$ws)] | sort_by(.at[0]) | reverse | .[0].address // empty')
    if [[ "$MASTER_ADDR" != "$EMU_ADDR" ]]; then
      hyprctl dispatch layoutmsg swapwithmaster master >/dev/null
      sleep 0.15
    fi
    hyprctl dispatch layoutmsg "mfact exact $MFACT" >/dev/null
    echo "dev-android: emulator tiled as master (mfact=$MFACT, ~${MASTER_W}px wide)"
  else
    echo "dev-android: warning — could not find emulator window to tile" >&2
  fi

  # Toolbar sidebar: float it and shove to the top-left of the laptop monitor.
  if [[ -n "$TOOL_ADDR" ]]; then
    hyprctl dispatch setfloating "address:$TOOL_ADDR" >/dev/null || true
    hyprctl dispatch movewindowpixel "exact 0 40,address:$TOOL_ADDR" >/dev/null || true
  fi
fi

# ── Start Metro / Expo dev server in the foreground ──────────────────────────
echo "dev-android: starting Expo (press 'a' to open on Android, 'r' to reload)"
exec npx expo start --android

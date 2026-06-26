#!/usr/bin/env bash
# Prepare a freshly-generated Capacitor iOS project for building Daybreak with
# HealthKit. Run on macOS (Codemagic CI or a Mac) AFTER `npx cap add ios`.
#
#   npx cap add ios          # scaffold ios/ (idempotent)
#   bash scripts/ios-prepare.sh
#   npx cap sync ios
#   cd ios/App && pod install
#
# It copies the native plugin + entitlements in, injects the HealthKit usage
# string and app-bound domain into Info.plist, and points the project at the
# entitlements file. Idempotent.
set -euo pipefail

APP_DIR="ios/App/App"
PBXPROJ="ios/App/App.xcodeproj/project.pbxproj"
INFO_PLIST="$APP_DIR/Info.plist"
HEALTH_DOMAIN="${HEALTH_DOMAIN:-daybreak-one.vercel.app}"

if [ ! -d "$APP_DIR" ]; then
  echo "error: $APP_DIR not found — run 'npx cap add ios' first." >&2
  exit 1
fi

echo "→ Copying native HealthKit plugin + entitlements"
cp native/ios/HealthKitPlugin.swift "$APP_DIR/HealthKitPlugin.swift"
cp native/ios/App.entitlements "$APP_DIR/App.entitlements"

echo "→ Patching Info.plist"
plist_set() {
  /usr/libexec/PlistBuddy -c "Delete :$1" "$INFO_PLIST" 2>/dev/null || true
  /usr/libexec/PlistBuddy -c "Add :$1 $2" "$INFO_PLIST"
}
plist_set "NSHealthShareUsageDescription string" \
  "Daybreak reads your Health data (sleep, heart, activity, and workouts) to show your morning briefing and trends."
# WKAppBoundDomains (array) for limitsNavigationsToAppBoundDomains.
/usr/libexec/PlistBuddy -c "Delete :WKAppBoundDomains" "$INFO_PLIST" 2>/dev/null || true
/usr/libexec/PlistBuddy -c "Add :WKAppBoundDomains array" "$INFO_PLIST"
/usr/libexec/PlistBuddy -c "Add :WKAppBoundDomains:0 string $HEALTH_DOMAIN" "$INFO_PLIST"

echo "→ Wiring CODE_SIGN_ENTITLEMENTS in project.pbxproj"
# Add the entitlements path to every build config that doesn't already set it.
if ! grep -q "CODE_SIGN_ENTITLEMENTS" "$PBXPROJ"; then
  # Insert right after each PRODUCT_BUNDLE_IDENTIFIER line in the App target.
  perl -0pi -e 's/(PRODUCT_BUNDLE_IDENTIFIER = [^;]+;)/$1\n\t\t\t\tCODE_SIGN_ENTITLEMENTS = App\/App.entitlements;/g' "$PBXPROJ"
  echo "  added CODE_SIGN_ENTITLEMENTS"
else
  echo "  already present, skipping"
fi

echo "✓ iOS project prepared for HealthKit"

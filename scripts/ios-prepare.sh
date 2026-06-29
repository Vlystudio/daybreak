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

# The HealthKit plugin ships as a local Capacitor plugin pod (native/healthkit),
# auto-linked by `npx cap sync ios` — no file injection needed here. We only wire
# the app target's entitlement + Info.plist.
echo "→ Copying HealthKit entitlement"
cp native/ios/App.entitlements "$APP_DIR/App.entitlements"

echo "→ Patching Info.plist"
plist_set() {
  /usr/libexec/PlistBuddy -c "Delete :$1" "$INFO_PLIST" 2>/dev/null || true
  /usr/libexec/PlistBuddy -c "Add :$1 $2" "$INFO_PLIST"
}
plist_set "NSHealthShareUsageDescription string" \
  "Daybreak reads your Health data (sleep, heart, activity, and workouts) to show your morning briefing and trends."
# Apple requires BOTH purpose strings whenever the HealthKit entitlement is
# present, even for read-only apps (App Store validation error 90683).
plist_set "NSHealthUpdateUsageDescription string" \
  "Daybreak does not write to Health; this permission is only requested if you choose to log data back."
# Camera + photo library purpose strings. The web app opens the system camera /
# photo picker via <input type="file" accept="image/*" capture> (meal photos for
# calorie estimates, grocery receipts, profile picture). iOS HARD-CRASHES the
# WKWebView host app (SIGABRT) the moment that picker touches the camera or
# library if these keys are absent — so they are required even though the app
# uses no native camera plugin.
plist_set "NSCameraUsageDescription string" \
  "Daybreak uses the camera to take photos of meals and grocery receipts so it can estimate calories and log items, and to set your profile photo."
plist_set "NSPhotoLibraryUsageDescription string" \
  "Daybreak accesses your photos so you can upload a meal or receipt photo, or choose a profile picture."
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

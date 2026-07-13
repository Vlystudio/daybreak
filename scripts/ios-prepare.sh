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

echo "Copying app privacy manifest and native assets"
[ -f native/ios/PrivacyInfo.xcprivacy ] || { echo "error: native/ios/PrivacyInfo.xcprivacy missing" >&2; exit 1; }
cp native/ios/PrivacyInfo.xcprivacy "$APP_DIR/PrivacyInfo.xcprivacy"
[ -d native/ios/AppIcon.appiconset ] || { echo "error: native iOS app icons missing" >&2; exit 1; }
[ -d native/ios/Splash.imageset ] || { echo "error: native iOS launch assets missing" >&2; exit 1; }
rm -rf "$APP_DIR/Assets.xcassets/AppIcon.appiconset" "$APP_DIR/Assets.xcassets/Splash.imageset"
cp -R native/ios/AppIcon.appiconset "$APP_DIR/Assets.xcassets/AppIcon.appiconset"
cp -R native/ios/Splash.imageset "$APP_DIR/Assets.xcassets/Splash.imageset"

echo "Adding PrivacyInfo.xcprivacy to the app target"
ruby <<'RUBY'
require 'xcodeproj'
project = Xcodeproj::Project.open('ios/App/App.xcodeproj')
target = project.targets.find { |candidate| candidate.name == 'App' } or abort('App target missing')
group = project.main_group.find_subpath('App', true)
ref = group.files.find { |file| file.path == 'PrivacyInfo.xcprivacy' } || group.new_file('PrivacyInfo.xcprivacy')
target.resources_build_phase.add_file_reference(ref, true) unless target.resources_build_phase.files_references.include?(ref)
project.save
RUBY

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
  "Daybreak does not write data to Apple Health."
# Camera + microphone + photo library purpose strings. The web app opens the
# system camera / photo picker via <input type="file" accept="image/*"> (meal
# photos for calorie estimates, grocery receipts, profile picture). The picker's
# "Take Photo" option presents an IN-PROCESS UIImagePickerController(.camera), so
# iOS TCC HARD-CRASHES the WKWebView host app (SIGABRT, drops to home screen, no
# JS-catchable error) the moment it touches the camera device if the matching key
# is absent — so these are required even though the app uses no native camera
# plugin, and even after capture="environment" was dropped (that only stopped the
# camera being FORCED open on tap; choosing "Take Photo" still opens it). The
# MICROPHONE one is the non-obvious crasher: WKWebView's "Take Photo or Video" UI
# provisions an AVCaptureSession that initializes the mic even for photo-only
# capture, so its purpose string is mandatory or the app aborts as the camera
# opens. THESE ONLY PROTECT THE DEVICE ONCE A BUILD CARRYING THEM SHIPS TO
# TestFlight — TCC reads the plist baked into the installed .app, not the source.
plist_set "NSCameraUsageDescription string" \
  "Daybreak uses the camera to take photos of meals and grocery receipts so it can estimate calories and log items, and to set your profile photo."
plist_set "NSMicrophoneUsageDescription string" \
  "The in-app camera initializes the microphone when you take a photo of a meal or receipt. Daybreak does not record audio."
plist_set "NSPhotoLibraryUsageDescription string" \
  "Daybreak accesses your photos so you can upload a meal or receipt photo, or choose a profile picture."
# WKAppBoundDomains (array) for limitsNavigationsToAppBoundDomains.
/usr/libexec/PlistBuddy -c "Delete :WKAppBoundDomains" "$INFO_PLIST" 2>/dev/null || true
/usr/libexec/PlistBuddy -c "Add :WKAppBoundDomains array" "$INFO_PLIST"
/usr/libexec/PlistBuddy -c "Add :WKAppBoundDomains:0 string $HEALTH_DOMAIN" "$INFO_PLIST"
plist_set "CFBundleDisplayName string" "Daybreak"
/usr/libexec/PlistBuddy -c "Delete :UISupportedInterfaceOrientations" "$INFO_PLIST" 2>/dev/null || true
/usr/libexec/PlistBuddy -c "Add :UISupportedInterfaceOrientations array" "$INFO_PLIST"
/usr/libexec/PlistBuddy -c "Add :UISupportedInterfaceOrientations:0 string UIInterfaceOrientationPortrait" "$INFO_PLIST"

# V1 is iPhone-only; the device test matrix therefore does not claim iPad support.
perl -0pi -e 's/TARGETED_DEVICE_FAMILY = "?1,2"?;/TARGETED_DEVICE_FAMILY = 1;/g' "$PBXPROJ"

echo "→ Wiring CODE_SIGN_ENTITLEMENTS in project.pbxproj"
# Add the entitlements path to every build config that doesn't already set it.
if ! grep -q "CODE_SIGN_ENTITLEMENTS" "$PBXPROJ"; then
  # Insert right after each PRODUCT_BUNDLE_IDENTIFIER line in the App target.
  perl -0pi -e 's/(PRODUCT_BUNDLE_IDENTIFIER = [^;]+;)/$1\n\t\t\t\tCODE_SIGN_ENTITLEMENTS = App\/App.entitlements;/g' "$PBXPROJ"
  echo "  added CODE_SIGN_ENTITLEMENTS"
else
  echo "  already present, skipping"
fi

# Self-verify the privacy strings actually landed in Info.plist, so the Codemagic
# build log proves it (rules out a silent PlistBuddy/injection failure if a crash
# is ever reported again).
echo "→ Verifying privacy usage strings in Info.plist"
verify_fail=0
for k in NSCameraUsageDescription NSMicrophoneUsageDescription NSPhotoLibraryUsageDescription NSHealthShareUsageDescription NSHealthUpdateUsageDescription; do
  if /usr/libexec/PlistBuddy -c "Print :$k" "$INFO_PLIST" >/dev/null 2>&1; then
    echo "  ✓ $k"
  else
    echo "  ✗ MISSING $k" >&2
    verify_fail=1
  fi
done
if [ "$verify_fail" -ne 0 ]; then
  echo "error: one or more required usage strings are missing from Info.plist" >&2
  exit 1
fi

echo "✓ iOS project prepared for HealthKit"

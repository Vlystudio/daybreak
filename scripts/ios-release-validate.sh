#!/usr/bin/env bash
set -euo pipefail

APP_DIR="ios/App/App"
PLIST="$APP_DIR/Info.plist"
PROJECT="ios/App/App.xcodeproj/project.pbxproj"
EXPECTED_URL="https://daybreak-one.vercel.app"
EXPECTED_BUNDLE="app.daybreak.mobile"
fail() { echo "error: $*" >&2; exit 1; }
has_plist_key() { /usr/libexec/PlistBuddy -c "Print :$1" "$PLIST" >/dev/null 2>&1; }

[ -f "$PLIST" ] || fail "Info.plist missing"
[ -f "$APP_DIR/PrivacyInfo.xcprivacy" ] || fail "PrivacyInfo.xcprivacy missing"
plutil -lint "$APP_DIR/PrivacyInfo.xcprivacy" >/dev/null || fail "PrivacyInfo.xcprivacy is invalid"
[ -f "$APP_DIR/App.entitlements" ] || fail "App.entitlements missing"
grep -q "com.apple.developer.healthkit" "$APP_DIR/App.entitlements" || fail "HealthKit entitlement missing"
grep -q "PRODUCT_BUNDLE_IDENTIFIER = $EXPECTED_BUNDLE" "$PROJECT" || fail "bundle identifier mismatch"
grep -q "PrivacyInfo.xcprivacy" "$PROJECT" || fail "privacy manifest is not in the Xcode project"
grep -q "DaybreakHealthkit" "ios/App/Podfile.lock" || fail "HealthKit pod is not linked"
grep -q "$EXPECTED_URL" capacitor.config.ts || fail "production URL mismatch"
grep -q "cleartext: false" capacitor.config.ts || fail "cleartext networking is not disabled"
! grep -R -nE 'http://(localhost|127\.0\.0\.1|10\.|192\.168\.)|NSAllowsArbitraryLoads.*true' \
  capacitor.config.ts "$APP_DIR" || fail "development URL or cleartext exception found"

for key in NSHealthShareUsageDescription NSHealthUpdateUsageDescription NSCameraUsageDescription NSMicrophoneUsageDescription NSPhotoLibraryUsageDescription WKAppBoundDomains; do
  has_plist_key "$key" || fail "$key missing"
done

version=$(/usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" "$PLIST")
build=$(/usr/libexec/PlistBuddy -c "Print :CFBundleVersion" "$PLIST")
[ -n "$version" ] || fail "semantic version missing"
[ -n "$build" ] || fail "build number missing"
[ -f "$APP_DIR/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png" ] || fail "1024 App Store icon missing"
[ -f "$APP_DIR/Assets.xcassets/Splash.imageset/Splash-2732.png" ] || fail "branded launch asset missing"

if [ -n "${IPA_PATH:-}" ]; then
  [ -f "$IPA_PATH" ] || fail "IPA_PATH does not exist"
  tmp=$(mktemp -d)
  trap 'rm -rf "$tmp"' EXIT
  unzip -q "$IPA_PATH" -d "$tmp"
  app=$(find "$tmp/Payload" -maxdepth 1 -name '*.app' -type d | head -1)
  [ -n "$app" ] || fail "app bundle missing from IPA"
  [ -f "$app/PrivacyInfo.xcprivacy" ] || fail "privacy manifest missing from archive"
  codesign -d --entitlements :- "$app" 2>"$tmp/entitlements.plist"
  grep -q "com.apple.developer.healthkit" "$tmp/entitlements.plist" || fail "archive lacks HealthKit entitlement"
fi

echo "iOS release validation passed"

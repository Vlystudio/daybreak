#!/usr/bin/env bash
set -euo pipefail

APP_DIR="ios/App/App"
PLIST="$APP_DIR/Info.plist"
PROJECT="ios/App/App.xcodeproj/project.pbxproj"
EXPECTED_URL="https://daybreak-one.vercel.app"
EXPECTED_BUNDLE="app.daybreak.mobile"
fail() { echo "error: $*" >&2; exit 1; }
plist_value() { /usr/libexec/PlistBuddy -c "Print :$2" "$1" 2>/dev/null; }
has_plist_key() { plist_value "$PLIST" "$1" >/dev/null; }

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
  [ -n "$(plist_value "$PLIST" "$key")" ] || fail "$key is empty"
done

version=$(plist_value "$PLIST" CFBundleShortVersionString)
build=$(plist_value "$PLIST" CFBundleVersion)
[ -n "$version" ] || fail "semantic version missing"
[ -n "$build" ] || fail "build number missing"
[ -f "$APP_DIR/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png" ] || fail "1024 App Store icon missing"
[ -f "$APP_DIR/Assets.xcassets/Splash.imageset/Splash-2732.png" ] || fail "branded launch asset missing"

if [ -n "${IPA_PATH:-}" ]; then
  [ -f "$IPA_PATH" ] || fail "IPA_PATH does not exist"
  : "${ARCHIVE_PATH:?ARCHIVE_PATH is required for archive validation}"
  : "${DSYM_PATH:?DSYM_PATH is required for archive validation}"
  : "${EXPECTED_APP_VERSION:?EXPECTED_APP_VERSION is required for archive validation}"
  : "${EXPECTED_BUILD_NUMBER:?EXPECTED_BUILD_NUMBER is required for archive validation}"
  : "${EXPECTED_TEAM_ID:?EXPECTED_TEAM_ID is required for archive validation}"
  : "${EVIDENCE_OUTPUT:?EVIDENCE_OUTPUT is required for archive validation}"
  [ -d "$ARCHIVE_PATH" ] || fail "archive path does not exist"
  [ -d "$DSYM_PATH" ] || fail "dSYM path does not exist"

  tmp=$(mktemp -d)
  trap 'rm -rf "$tmp"' EXIT
  unzip -q "$IPA_PATH" -d "$tmp"
  app=$(find "$tmp/Payload" -maxdepth 1 -name '*.app' -type d | head -1)
  [ -n "$app" ] || fail "app bundle missing from IPA"
  archive_plist="$app/Info.plist"
  [ -f "$archive_plist" ] || fail "archive Info.plist missing"
  [ -f "$app/PrivacyInfo.xcprivacy" ] || fail "privacy manifest missing from archive"
  [ -f "$app/embedded.mobileprovision" ] || fail "embedded provisioning profile missing"

  archive_bundle=$(plist_value "$archive_plist" CFBundleIdentifier)
  archive_version=$(plist_value "$archive_plist" CFBundleShortVersionString)
  archive_build=$(plist_value "$archive_plist" CFBundleVersion)
  [ "$archive_bundle" = "$EXPECTED_BUNDLE" ] || fail "archive bundle identifier mismatch"
  [ "$archive_version" = "$EXPECTED_APP_VERSION" ] || fail "archive marketing version mismatch"
  [ "$archive_build" = "$EXPECTED_BUILD_NUMBER" ] || fail "archive build number mismatch"
  plist_value "$archive_plist" CFBundleIcons >/dev/null || fail "archive icon declaration missing"
  plist_value "$archive_plist" UILaunchStoryboardName >/dev/null || fail "archive launch screen declaration missing"

  for key in NSAllowsArbitraryLoads NSAllowsArbitraryLoadsInWebContent NSAllowsArbitraryLoadsForMedia; do
    ats_value=$(plist_value "$archive_plist" "NSAppTransportSecurity:$key" || true)
    [ "$ats_value" != "true" ] || fail "archive enables unsafe ATS key $key"
  done
  plutil -convert xml1 -o "$tmp/archive-info.xml" "$archive_plist"
  if grep -A1 '<key>NSExceptionAllowsInsecureHTTPLoads</key>' "$tmp/archive-info.xml" | grep -q '<true/>'; then
    fail "archive contains an insecure ATS exception domain"
  fi

  codesign --verify --deep --strict "$app" || fail "archive code signature verification failed"
  codesign -d --entitlements :- "$app" >"$tmp/entitlements.plist" 2>"$tmp/codesign-entitlements.log"
  plutil -lint "$tmp/entitlements.plist" >/dev/null || fail "archive entitlement dump is invalid"
  plist_value "$tmp/entitlements.plist" com.apple.developer.healthkit >/dev/null || fail "archive lacks HealthKit entitlement"
  entitlement_team=$(plist_value "$tmp/entitlements.plist" com.apple.developer.team-identifier)
  entitlement_app_id=$(plist_value "$tmp/entitlements.plist" application-identifier)
  [ "$entitlement_team" = "$EXPECTED_TEAM_ID" ] || fail "signed entitlement team mismatch"
  [ "$entitlement_app_id" = "$EXPECTED_TEAM_ID.$EXPECTED_BUNDLE" ] || fail "signed application identifier mismatch"

  security cms -D -i "$app/embedded.mobileprovision" >"$tmp/embedded-profile.plist"
  profile_team=$(plist_value "$tmp/embedded-profile.plist" TeamIdentifier:0)
  profile_app_id=$(plist_value "$tmp/embedded-profile.plist" Entitlements:application-identifier)
  profile_name=$(plist_value "$tmp/embedded-profile.plist" Name)
  profile_expiration=$(plist_value "$tmp/embedded-profile.plist" ExpirationDate)
  [ "$profile_team" = "$EXPECTED_TEAM_ID" ] || fail "embedded profile team mismatch"
  [ "$profile_app_id" = "$EXPECTED_TEAM_ID.$EXPECTED_BUNDLE" ] || fail "embedded profile bundle mismatch"
  plist_value "$tmp/embedded-profile.plist" Entitlements:com.apple.developer.healthkit >/dev/null || fail "embedded profile lacks HealthKit"
  ruby -rtime -e 'abort("expired provisioning profile") unless Time.parse(ARGV.fetch(0)) > Time.now' "$profile_expiration"

  codesign -dv --verbose=4 "$app" 2>"$tmp/codesign-details.log"
  signing_identity=$(sed -n 's/^Authority=//p' "$tmp/codesign-details.log" | head -1)
  signed_team=$(sed -n 's/^TeamIdentifier=//p' "$tmp/codesign-details.log" | head -1)
  [ -n "$signing_identity" ] || fail "signing identity was not reported"
  [ "$signed_team" = "$EXPECTED_TEAM_ID" ] || fail "code signature team mismatch"

  ipa_sha256=$(shasum -a 256 "$IPA_PATH" | awk '{print $1}')
  export IOS_EVIDENCE_OUTPUT="$EVIDENCE_OUTPUT"
  export IOS_EVIDENCE_COMMIT="${CM_COMMIT:-$(git rev-parse HEAD)}"
  export IOS_EVIDENCE_BUILD_ID="${CM_BUILD_ID:-}"
  export IOS_EVIDENCE_WORKFLOW="ios-healthkit"
  export IOS_EVIDENCE_ARCHIVE_PATH="$ARCHIVE_PATH"
  export IOS_EVIDENCE_IPA_PATH="$IPA_PATH"
  export IOS_EVIDENCE_DSYM_PATH="$DSYM_PATH"
  export IOS_EVIDENCE_IPA_SHA256="$ipa_sha256"
  export IOS_EVIDENCE_BUNDLE_ID="$archive_bundle"
  export IOS_EVIDENCE_VERSION="$archive_version"
  export IOS_EVIDENCE_BUILD_NUMBER="$archive_build"
  export IOS_EVIDENCE_SIGNING_TEAM="$signed_team"
  export IOS_EVIDENCE_SIGNING_IDENTITY="$signing_identity"
  export IOS_EVIDENCE_PROFILE_NAME="$profile_name"
  export IOS_EVIDENCE_PROFILE_EXPIRATION="$profile_expiration"
  node scripts/write-ios-archive-evidence.mjs
fi

echo "iOS release validation passed"

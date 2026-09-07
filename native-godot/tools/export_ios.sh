#!/usr/bin/env bash
# Prepared for an ephemeral GitHub-hosted Mac; never submits a build to Apple.
set +x
set -euo pipefail
umask 077

fail() { printf '%s\n' "$*" >&2; exit 1; }
[[ "$(uname -s)" == Darwin ]] || fail 'This export requires a macOS runner with Xcode.'
[[ "${COSMO_IOS_TEAM_ID:-}" =~ ^[A-Z0-9]{10}$ ]] || fail 'Supply your actual 10-character Apple Developer Team ID.'
[[ "${COSMO_IOS_BUILD_NUMBER:-}" =~ ^[1-9][0-9]{0,8}$ ]] || fail 'Supply a positive numeric build number (at most 9 digits).'
mode="${COSMO_IOS_OUTPUT:-xcode_project}"
[[ "$mode" == xcode_project || "$mode" == signed_archive ]] || fail 'Output must be xcode_project or signed_archive.'
if [[ "$mode" == signed_archive ]]; then
  [[ -n "${COSMO_IOS_CERTIFICATE_BASE64:-}" && -n "${COSMO_IOS_CERTIFICATE_PASSWORD:-}" && -n "${COSMO_IOS_PROFILE_BASE64:-}" ]] || fail 'Signed archive requires all three documented GitHub signing secrets.'
fi
xcodebuild -version
xcrun --sdk iphoneos --show-sdk-version

repo="$(cd "$(dirname "$0")/../.." && pwd)"
job_temp="${RUNNER_TEMP:?Run on an ephemeral GitHub-hosted macOS runner.}"
work="$(mktemp -d "$job_temp/cosmo-ios.XXXXXX")"
artifacts="$job_temp/cosmo-ios-artifacts"
[[ ! -e "$artifacts" ]] || fail 'Artifact directory already exists; use a fresh runner.'
mkdir -p "$artifacts" "$work/project" "$work/export" "$work/downloads"
keychain=""
profile_installed=""
cleanup() {
  if [[ -n "$keychain" ]]; then security delete-keychain "$keychain" >/dev/null 2>&1 || true; fi
  if [[ -n "$profile_installed" ]]; then rm -f "$profile_installed"; fi
  # This exact directory was created by mktemp above; never delete caller paths.
  rm -rf "$work"
}
trap cleanup EXIT

# Official Godot 4.7.2 assets and published SHA-256 values, checked 2026-09-07.
base='https://github.com/godotengine/godot-builds/releases/download/4.7.2-stable'
editor='Godot_v4.7.2-stable_macos.universal.zip'
templates='Godot_v4.7.2-stable_export_templates.tpz'
curl --fail --location --retry 3 --output "$work/downloads/$editor" "$base/$editor"
curl --fail --location --retry 3 --output "$work/downloads/$templates" "$base/$templates"
(
  cd "$work/downloads"
  printf '%s  %s\n' 'c58a24e31d720be9d62f60cb5627c4e695fb72f21b0cfe1bc9ccaa9a3b3ba63e' "$editor" 'f298490b8d44d934be425a5a65a51bf15f422428b229a06a6e11d9ffea248011' "$templates" | shasum -a 256 -c -
)
ditto -x -k "$work/downloads/$editor" "$work/editor"
godot="$work/editor/Godot.app/Contents/MacOS/Godot"
[[ -x "$godot" ]] || fail 'The pinned macOS editor executable is missing.'
template_dir="$HOME/Library/Application Support/Godot/export_templates/4.7.2.stable"
mkdir -p "$template_dir"
unzip -p "$work/downloads/$templates" templates/ios.zip > "$template_dir/ios.zip"
[[ -s "$template_dir/ios.zip" ]] || fail 'The matching iOS template is missing.'
"$godot" --version

# The checkout and Windows preset stay unchanged. Only this staging copy gets
# the supplied Team ID/build number and the existing approved 1024px app icon.
rsync -a --exclude='.godot' --exclude='builds' --exclude='tools' --exclude='tests' "$repo/native-godot/" "$work/project/"
cp "$repo/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png" "$work/project/ios-icon.png"
python3 - "$work/project/export_presets.cfg" <<'PY'
import os, pathlib
p = pathlib.Path(__import__('sys').argv[1])
text = p.read_text()
for old, new in (
    ('application/app_store_team_id=""', f'application/app_store_team_id="{os.environ["COSMO_IOS_TEAM_ID"]}"'),
    ('application/version="1"', f'application/version="{os.environ["COSMO_IOS_BUILD_NUMBER"]}"'),
):
    if text.count(old) != 1:
        raise SystemExit(f'Expected exactly one preset setting: {old}')
    text = text.replace(old, new)
p.write_text(text)
PY
"$godot" --headless --path "$work/project" --editor --import --quit
"$godot" --headless --path "$work/project" --export-release 'iOS Cloud Project' "$work/export/Cosmo.ipa"
[[ -f "$work/export/Cosmo.xcodeproj/project.pbxproj" ]] || fail 'Godot did not produce the expected Xcode project.'
cp "$repo/native-godot/LICENSE" "$work/export/LICENSE-COSMO.txt"
cp "$repo/native-godot/THIRD_PARTY_LICENSES.txt" "$work/export/THIRD_PARTY_LICENSES.txt"
ditto -c -k --sequesterRsrc --keepParent "$work/export" "$artifacts/Cosmo-Xcode-project.zip"

if [[ "$mode" == signed_archive ]]; then
  python3 - "$work" <<'PY'
import base64, os, pathlib, sys
folder = pathlib.Path(sys.argv[1])
for key, filename in [('COSMO_IOS_CERTIFICATE_BASE64', 'certificate.p12'), ('COSMO_IOS_PROFILE_BASE64', 'profile.mobileprovision')]:
    (folder / filename).write_bytes(base64.b64decode(''.join(os.environ[key].split()), validate=True))
PY
  unset COSMO_IOS_CERTIFICATE_BASE64 COSMO_IOS_PROFILE_BASE64
  security cms -D -i "$work/profile.mobileprovision" > "$work/profile.plist"
  profile_uuid="$(python3 - "$work/profile.plist" <<'PY'
import datetime, os, plistlib, re, sys
with open(sys.argv[1], 'rb') as stream: profile = plistlib.load(stream)
entitlements = profile.get('Entitlements', {})
if os.environ['COSMO_IOS_TEAM_ID'] not in profile.get('TeamIdentifier', []):
    raise SystemExit('Provisioning profile belongs to a different Apple team.')
if entitlements.get('application-identifier', '').split('.', 1)[-1] != 'app.cosmo.arcade':
    raise SystemExit('Provisioning profile must explicitly match app.cosmo.arcade.')
if entitlements.get('get-task-allow') or profile.get('ProvisionedDevices') or profile.get('ProvisionsAllDevices'):
    raise SystemExit('Use an App Store distribution profile, not Development, Ad Hoc, or Enterprise.')
if profile.get('ExpirationDate', datetime.datetime.min) <= datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None):
    raise SystemExit('Provisioning profile has expired.')
uuid = profile.get('UUID', '')
if not re.fullmatch(r'[A-Fa-f0-9-]{36}', uuid): raise SystemExit('Invalid provisioning profile UUID.')
print(uuid)
PY
  )"
  keychain="$work/signing.keychain-db"
  keychain_password="$(openssl rand -hex 32)"
  security create-keychain -p "$keychain_password" "$keychain"
  security set-keychain-settings -lut 21600 "$keychain"
  security unlock-keychain -p "$keychain_password" "$keychain"
  security import "$work/certificate.p12" -P "$COSMO_IOS_CERTIFICATE_PASSWORD" -A -t cert -f pkcs12 -k "$keychain" >/dev/null
  unset COSMO_IOS_CERTIFICATE_PASSWORD
  security set-key-partition-list -S apple-tool:,apple: -k "$keychain_password" "$keychain" >/dev/null
  unset keychain_password
  security list-keychains -d user -s "$keychain"
  profile_dir="$HOME/Library/MobileDevice/Provisioning Profiles"
  mkdir -p "$profile_dir"
  profile_installed="$profile_dir/$profile_uuid.mobileprovision"
  cp "$work/profile.mobileprovision" "$profile_installed"
  xcodebuild -quiet -project "$work/export/Cosmo.xcodeproj" -scheme Cosmo \
    -sdk iphoneos -configuration Release -destination 'generic/platform=iOS' \
    -archivePath "$work/Cosmo.xcarchive" archive \
    DEVELOPMENT_TEAM="$COSMO_IOS_TEAM_ID" CODE_SIGN_STYLE=Manual \
    CODE_SIGN_IDENTITY='Apple Distribution' PROVISIONING_PROFILE_SPECIFIER="$profile_uuid" \
    OTHER_CODE_SIGN_FLAGS="--keychain $keychain"
  [[ -d "$work/Cosmo.xcarchive/Products/Applications/Cosmo.app" ]] || fail 'Xcode did not produce the expected signed application archive.'
  codesign --verify --deep --strict "$work/Cosmo.xcarchive/Products/Applications/Cosmo.app"
  ditto -c -k --sequesterRsrc --keepParent "$work/Cosmo.xcarchive" "$artifacts/Cosmo-signed-archive.zip"
fi

{
  printf 'Cosmo iOS cloud build\nBundle ID: app.cosmo.arcade\nGodot: 4.7.2.stable\nOutput: %s\nBuild: %s\nCommit: %s\n' "$mode" "$COSMO_IOS_BUILD_NUMBER" "${GITHUB_SHA:-local}"
  xcodebuild -version
  printf '\nNo build was uploaded to Apple. The Xcode project is not an installable app.\n'
} > "$artifacts/BUILD-INFO.txt"
printf 'Prepared artifacts: %s\n' "$artifacts"

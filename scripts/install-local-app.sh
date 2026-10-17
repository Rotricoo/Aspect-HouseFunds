#!/usr/bin/env bash
set -euo pipefail

app_source="src-tauri/target/release/bundle/macos/Aspect - House Funds.app"
app_destination="/Applications/Aspect - House Funds.app"

if [[ ! -d "$app_source" ]]; then
  echo "Aspect - House Funds.app was not found. Run npm run tauri:build first."
  exit 1
fi

ditto "$app_source" "$app_destination"
codesign --force --deep --sign - "$app_destination"
codesign --verify --deep --strict "$app_destination"

# Keep Launch Services from indexing the generated build bundle as a second app.
launch_services_register="/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister"
if [[ -x "$launch_services_register" ]]; then
  "$launch_services_register" -u "$app_source" || true
fi
rm -rf "$app_source"

echo "Aspect - House Funds was installed at $app_destination"
echo "The generated build copy was removed to avoid duplicate app entries."
echo "The SQLite database remains in Application Support and was not replaced."

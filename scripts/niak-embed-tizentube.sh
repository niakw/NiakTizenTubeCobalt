#!/usr/bin/env bash
# Build a known, immutable TizenTube userscript for embedding into Cobalt.
# Never execute a mutable jsDelivr/npm "latest" userscript in the signed APK.
set -euo pipefail

SOURCE_SHA="f99945a84ff767bf14ad8c1146e8e3fd49a3d628"
SCRIPT_SHA256="9bdf8d414e1282c5ada05cae7bf4d1a53871c905c123e00e4543dbeb7c584c75"
DESTINATION="${1:-cobalt/shell/embedded_resources/cobalt_java_script_polyfill/niak_upstream_tizentube.js}"

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

git clone --quiet --depth=1 https://github.com/reisxd/TizenTube.git "$work/TizenTube"
git -C "$work/TizenTube" fetch --quiet --depth=1 origin "$SOURCE_SHA"
git -C "$work/TizenTube" checkout --quiet --detach "$SOURCE_SHA"
test "$(git -C "$work/TizenTube" rev-parse HEAD)" = "$SOURCE_SHA"

(
  cd "$work/TizenTube/mods"
  npm ci --ignore-scripts --no-audit --no-fund
  npm run build
)
bundle="$work/TizenTube/dist/userScript.js"
test -s "$bundle"
node --check "$bundle"

actual=$(sha256sum "$bundle" | awk '{print $1}')
if [[ "$actual" != "$SCRIPT_SHA256" ]]; then
  echo "ERROR: TizenTube bundle hash mismatch. Refusing to embed executable JS." >&2
  echo "expected=$SCRIPT_SHA256 actual=$actual" >&2
  exit 1
fi
mkdir -p "$(dirname "$DESTINATION")"
install -m 0644 "$bundle" "$DESTINATION"
printf 'TizenTube pinned source: %s\nEmbedded JS SHA-256: %s\n' "$SOURCE_SHA" "$SCRIPT_SHA256"

#!/usr/bin/env bash
# Install the exact sccache binary used by existing Cobalt builds.
# Avoid relying on the GitHub release-asset URL alone (HTTP 504 incidents).
set -euo pipefail

expected="aec995a83ad3dff3d14b6314e08858b7b73d35ca85a5bcf3d3a9ec07dee35588"
api_url="https://api.github.com/repos/mozilla/sccache/releases/assets/452060682"
release_url="https://github.com/mozilla/sccache/releases/download/v0.16.0/sccache-v0.16.0-x86_64-unknown-linux-musl.tar.gz"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
archive="$tmp/sccache.tar.gz"
verified=false

if [[ "$(uname -s)" != Linux || "$(uname -m)" != x86_64 ]]; then
  echo "::error::sccache installer only supports Linux x86_64."
  exit 1
fi

for location in api release; do
  if [[ "$location" == api ]]; then
    url="$api_url"
  else
    url="$release_url"
  fi
  for attempt in 1 2 3; do
    rm -f "$archive"
    echo "Fetching pinned sccache v0.16.0 from $location (attempt $attempt)"
    if [[ "$location" == api && -n "${GH_TOKEN:-}" ]]; then
      curl --fail --silent --show-error --location --connect-timeout 15 --max-time 90 \
        --header "Accept: application/octet-stream" \
        --header "X-GitHub-Api-Version: 2022-11-28" \
        --header "Authorization: Bearer $GH_TOKEN" \
        --output "$archive" "$url" || true
    else
      curl --fail --silent --show-error --location --connect-timeout 15 --max-time 90 \
        --header "Accept: application/octet-stream" \
        --output "$archive" "$url" || true
    fi

    if [[ -s "$archive" ]]; then
      actual="$(sha256sum "$archive" | awk '{print $1}')"
      if [[ "$actual" == "$expected" ]]; then
        verified=true
        break
      fi
      echo "::warning::Downloaded data did not match the pinned sccache SHA-256 (source: $location)."
    fi
    if (( attempt < 3 )); then
      sleep $((5 * attempt))
    fi
  done
  if [[ "$verified" == true ]]; then
    break
  fi
done

if [[ "$verified" != true ]]; then
  echo "::error::Could not obtain the SHA-256-verified sccache 0.16.0 archive. Stopping before costly source sync; existing cache cannot be safely reused with another tool version."
  exit 1
fi

mkdir -p "$tmp/extracted" "$HOME/.local/bin"
tar -xzf "$archive" -C "$tmp/extracted"
binary="$(find "$tmp/extracted" -type f -name sccache -print -quit)"
if [[ -z "$binary" ]]; then
  echo "::error::Verified sccache archive did not contain a binary."
  exit 1
fi
install -m 0755 "$binary" "$HOME/.local/bin/sccache"
export PATH="$HOME/.local/bin:$PATH"
if [[ -n "${GITHUB_PATH:-}" ]]; then
  echo "$HOME/.local/bin" >> "$GITHUB_PATH"
fi
sccache --version
test "$(sccache --version)" = "sccache 0.16.0"
echo "Installed sha256-verified sccache v0.16.0; compatible with previous Cobalt build version."

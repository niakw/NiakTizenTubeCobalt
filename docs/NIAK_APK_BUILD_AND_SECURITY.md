# Niak Cobalt — reproducible APK and userscript source

## Exact TizenTube executable provenance

The official mutable CDN address (`cdn.jsdelivr.net/npm/@foxreis/tizentube/dist/userScript.js?v=...`) is **not** an acceptable executable source for this fork.

This fork compiles the main userscript directly from upstream GPL-3.0-only sources:

- Upstream repository: https://github.com/reisxd/TizenTube
- Exact upstream commit: `f99945a84ff767bf14ad8c1146e8e3fd49a3d628`
- Upstream build inputs: `mods/package.json`, `mods/package-lock.json`, `mods/rollup.config.js` and source modules
- Command: `bash scripts/niak-embed-tizentube.sh` (run **before** GN generation)
- Expected resulting `dist/userScript.js` SHA-256: `9bdf8d414e1282c5ada05cae7bf4d1a53871c905c123e00e4543dbeb7c584c75`
- Output embedded into Cobalt: `cobalt/shell/embedded_resources/cobalt_java_script_polyfill/niak_upstream_tizentube.js`

The builder verifies the exact Git revision and generated SHA-256 before copying the executable bundle. A mismatch fails the build; the expected digest must never be downloaded from the same untrusted CDN as the script.

`niak_tizentube_security_guard.js` additionally blocks *dynamic* requests and inserted `<script>` elements matching the old mutable jsDelivr/unpkg userscript URL, while ordinary video network requests are left untouched. This does **not** constitute a proof that every hypothetical HTML-parser or native-injected script can be blocked. The signed APK must still be audited to ensure no second execution path exists. The extension is scoped to HTTPS YouTube origins by Cobalt's native document-start injector.

The main upstream code remains licensed under **GPL-3.0-only**. Redistribution must include the required attribution and corresponding sources.

## Android APK build

The [Niak Cobalt APK builder](https://github.com/niakw/TizenTubeCobalt/actions/workflows/niak-apk-build.yml) performs a genuine Chromium/Cobalt source checkout, Android gclient sync, GN/Ninja build for `//cobalt/android:cobalt_apk`, and checks the built APK's ZIP integrity, DEX, manifest, native libraries, signing certificate and SHA-256 before uploading an artifact.

The pipeline's public Ubuntu runner is evaluated for actual free disk, and unused preinstalled SDKs are removed before a full compile. The build is resource intensive; a green [targeted Node/Java check](https://github.com/niakw/TizenTubeCobalt/actions/workflows/niak-cobalt-filters.yml) **does not** imply that an APK was compiled.

### Test APK limitations

A GitHub Actions-generated APK is initially signed with a **temporary debug key**, unless the pipeline is adapted to a stable owner-controlled release key. This certificate will **not** match the original TizenTube Cobalt publisher's signing key, so Android will not accept it as an in-place update of the official package. Do not promise automatic upgrades or preservation of app data. It is a test build until the user validates startup, login, long-press navigation, video playback and update behavior on their Android TV.

A production release requires a stable private release-signing key, full build and installer validation, and explicit user-facing release notes. Do not attach the upstream release's APK under the Niak fork name.

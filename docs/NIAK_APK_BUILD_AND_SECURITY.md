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

### Stable owner signing — mandatory before the next APK build

The GitHub Actions APK builder **fails before expensive native compilation** unless the repository has BOTH:

1. **Actions secret** `NIAK_COBALT_SIGNING_KEYSTORE_B64`: base64 encoding of a persistent JKS/PKCS12 keystore with alias `androiddebugkey`, store password `android`, and key password `android`. These compatibility names are hardcoded by this Cobalt GN build; they do **not** imply the private key is generated for each run.
2. **Actions variable** `NIAK_COBALT_SIGNING_CERT_SHA256`: SHA-256 fingerprint of that keystore's signing certificate, from `keytool -list -v`. Colons and case are normalized by the workflow.

Create the keystore **once**, on a trusted computer, and keep an offline encrypted backup. For example:

```sh
keytool -genkeypair -keystore niak-cobalt-signing.jks \
  -alias androiddebugkey -storepass android -keypass android \
  -keyalg RSA -keysize 3072 -validity 10000 \
  -dname "CN=Niak Cobalt,O=Niak,C=FR"
keytool -list -v -keystore niak-cobalt-signing.jks \
  -storepass android -alias androiddebugkey
base64 < niak-cobalt-signing.jks | tr -d '\\n'
```

Paste the **base64 output** as the repository secret in Settings → Secrets and variables → Actions, and the displayed **SHA256 certificate fingerprint** as the repository Actions variable. Never commit, paste in issues, or upload the unencrypted keystore to the repository. Existing secrets remain private to GitHub Actions.

Both ARM32 and ARM64 workflows use the exact same secret, and compare the stored certificate fingerprint with both the keystore and the generated APK signature. No temporary-key fallback remains. New outputs are named `-SIGNED-QA.apk`; QA still means **device testing pending**, not a production endorsement. The automatic prerelease gate refuses older ephemeral-key builds.

**Important migration limit:** the official TizenTube APK and previously released Niak `-TEST.apk` files were signed with different private keys. Android requires the same signing certificate to update an existing package without data loss. Merely rebuilding or renaming an APK cannot recover an old signing key. The first transition to the new permanent Niak key may therefore require uninstalling and signing in again, unless the prior private signing key can be recovered. Once the permanent key is established, keep reusing it for future versions to avoid repeated reconfiguration. This does **not** authorize claims of an in-place update over an old temp-key installation.

Android TV navigation, account login, playback, feedback actions and updates must still be checked on physical hardware. A successful native CI build and signer validation alone cannot establish production readiness.

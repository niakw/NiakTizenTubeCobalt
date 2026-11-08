// Source wiring contracts only; these do not replace a native GN/Android build.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
function read(file) { return fs.readFileSync(path.join(root, file), 'utf8'); }

test('Cobalt bundles exactly one Niak recommendation runtime', () => {
  const build = read('cobalt/shell/BUILD.gn');
  const scripts = build.match(/embedded_resources\/cobalt_java_script_polyfill\/niak_[^"\n]+\.js/g) || [];
  assert.deepEqual(scripts, [
    'embedded_resources/cobalt_java_script_polyfill/niak_tizentube_filters.js'
  ]);
  assert.match(build, /"embed_polyfilled_javascript"/);
});

test('Niak source injection is scoped to YouTube HTTPS origins', () => {
  const shell = read('cobalt/shell/browser/shell.cc');
  assert.match(shell, /file_name == "niak_tizentube_filters\.js"/);
  assert.match(shell, /"https:\/\/www\.youtube\.com"/);
  assert.match(shell, /"https:\/\/youtube\.com"/);
  assert.match(shell, /"https:\/\/m\.youtube\.com"/);
  assert.match(shell, /is_niak_filter\s*\?\s*std::vector<std::string>/);
  assert.match(shell, /js_communication_host_->AddDocumentStartJavaScript\(\s*script,\s*allowed_origins\)/);
});

test('User-Agent override has registered persistent storage, restore and clear paths', () => {
  const h = read('cobalt/browser/global_features.h');
  const cpp = read('cobalt/browser/global_features.cc');
  const tests = read('cobalt/browser/global_features_unittest.cc');
  assert.match(h, /kUserAgentOverridePrefName/);
  assert.match(cpp, /CreateMetricsServices\(\);\s*RestorePersistedSettings\(\);/);
  assert.match(cpp, /RegisterStringPref\(kUserAgentOverridePrefName/);
  assert.match(cpp, /metrics_local_state_->SetString\(kUserAgentOverridePrefName/);
  assert.match(cpp, /metrics_local_state_->ClearPref\(kUserAgentOverridePrefName/);
  assert.match(cpp, /settings_\[kUserAgentOverridePrefName\] = stored;/);
  assert.match(tests, /UserAgentOverrideUsesPersistedPref/);
});

test('Android video surface is hidden when no frame rectangle is available', () => {
  const android = read('cobalt/android/apk/app/src/main/java/dev/cobalt/coat/CobaltActivity.java');
  assert.match(android, /mVideoSurfaceView\.setAlpha\(0f\)/);
  assert.match(android, /mVideoSurfaceView\.setAlpha\(videoSurfaceVisible \? 1f : 0f\)/);
  assert.match(android, /setVideoSurfaceBounds\(\s*mVideoSurfaceX, mVideoSurfaceY, mVideoSurfaceWidth, mVideoSurfaceHeight\)/);
  assert.match(android, /dispatchKeyEventToIme\(event\) \|\| super\.onKeyDown/);
  assert.match(android, /dispatchKeyEventToIme\(event\) \|\| super\.onKeyUp/);
});

test('Starboard first frame can render before audio has advanced', () => {
  const video = read('starboard/android/shared/video_render_algorithm_android.cc');
  assert.match(video, /#else\s*\/\/ Paint the first decoded frame[\s\S]*?release_frames_after_audio_starts_\(true\)/);
  assert.match(video, /if \(first_frame_released_ &&/);
});

test('The updater is a compiled Android activity with verified HTTPS APKs', () => {
  const build = read('cobalt/android/BUILD.gn');
  const mainJava = build.split('android_library("cobalt_main_java")')[1]
    .split('if (!use_evergreen)')[0];
  for (const filename of ['CobaltUpdateActivity.java', 'UpdateDownloader.java']) {
    assert.ok(mainJava.includes('apk/app/src/main/java/dev/cobalt/coat/' + filename),
      filename + ' must be compiled into the actual APK Java library');
  }
  const downloader = read('cobalt/android/apk/app/src/main/java/dev/cobalt/coat/UpdateDownloader.java');
  assert.match(downloader, /"https"\.equals\(url\.getProtocol\(\)\)/);
  assert.match(downloader, /static final long MAX_BYTES = 512L \* 1024 \* 1024/);
  assert.match(downloader, /MAX_ATTEMPTS = 3/);
  const activity = read('cobalt/android/apk/app/src/main/java/dev/cobalt/coat/CobaltUpdateActivity.java');
  assert.match(activity, /current\.equals\(downloaded\)/);
  assert.match(activity, /getPackageArchiveInfo/);
  assert.match(activity, /canRequestPackageInstalls/);
  const bridge = read('cobalt/android/apk/app/src/main/java/dev/cobalt/coat/BaseStarboardBridge.java');
  assert.match(bridge, /UpdateDownloader\.validateUrl\(url\)/);
  assert.match(bridge, /new Intent\(activity, CobaltUpdateActivity\.class\)/);
  const manifest = read('cobalt/shell/android/shell_apk/AndroidManifest.xml.jinja2');
  assert.match(manifest, /<activity android:name="dev\.cobalt\.coat\.CobaltUpdateActivity"/);
  assert.match(manifest, /android:exported="false"/);
  const resources = read('cobalt/shell/android/BUILD.gn');
  assert.match(resources, /java\/res\/values\/update_strings\.xml/);
});

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

'use strict';
// Fail closed: an APK must never be published from a newly generated signing key.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const builder = fs.readFileSync(path.join(root, '.github/workflows/niak-apk-build.yml'), 'utf8');
const publisher = fs.readFileSync(path.join(root, '.github/workflows/niak-apk-prerelease.yml'), 'utf8');

test('native builder requires an owner-controlled certificate before native compilation', () => {
  assert.ok(builder.includes('NIAK_COBALT_SIGNING_KEYSTORE_B64'));
  assert.ok(builder.includes('NIAK_COBALT_SIGNING_CERT_SHA256'));
  assert.ok(builder.includes('Require a permanent signer before any costly native compilation'));
  assert.ok(!builder.includes('keytool -genkeypair'));
  assert.ok(builder.includes('base64 --decode'));
  assert.ok(builder.includes('actual_cert'));
  assert.ok(builder.includes('expected_cert'));
  assert.ok(builder.includes('-SIGNED-QA.apk'));
});

test('publisher only accepts owner-signed QA artifact names', () => {
  assert.ok(publisher.includes('NIAK_COBALT_SIGNING_KEYSTORE_B64'));
  assert.ok(publisher.includes('artifact_name="niak-cobalt-$arch-$SOURCE_SHA-SIGNED-QA"'));
  assert.ok(publisher.includes('for arch in arm arm64; do'));
  assert.ok(publisher.includes('run_ids[arm]:-') && publisher.includes('run_ids[arm64]:-'));
  assert.ok(publisher.includes('expected_cert') && publisher.includes('gh release create'));
  assert.ok(publisher.includes('-SIGNED-QA.apk'));
  assert.ok(!publisher.includes("--pattern 'niak-cobalt-*-TEST'"));
});

'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../cobalt/shell/embedded_resources/cobalt_java_script_polyfill/niak_tizentube_security_guard.js'), 'utf8');
const mutable = 'https://cdn.jsdelivr.net/npm/@foxreis/tizentube/dist/userScript.js?v=2026';
const safe = 'https://cdn.jsdelivr.net/npm/other-package/v1/example.js';

function boot(host = 'www.youtube.com') {
  const network = [];
  const children = [];
  const notices = [];
  function FakeElement() { this.tagName = 'SCRIPT'; this.attributes = {}; }
  FakeElement.prototype.setAttribute = function (name, value) { this.attributes[name] = value; };
  FakeElement.prototype.getAttribute = function (name) { return this.attributes[name] || ''; };
  function FakeNode() {}
  FakeNode.prototype.appendChild = function (node) { children.push(node); return node; };
  FakeNode.prototype.insertBefore = FakeNode.prototype.appendChild;
  FakeNode.prototype.replaceChild = FakeNode.prototype.appendChild;
  function FakeScript() { FakeElement.call(this); this._src = ''; }
  FakeScript.prototype = Object.create(FakeElement.prototype);
  Object.defineProperty(FakeScript.prototype, 'src', {
    configurable: true,
    get() { return this._src; },
    set(value) { this._src = value; }
  });
  function FakeXHR() {}
  FakeXHR.prototype.open = function (method, url) { network.push(url); };
  const window = { location: { hostname: host, href: 'https://' + host + '/tv' },
    fetch: url => { network.push(url); return Promise.resolve({ok: true}); } };
  vm.runInNewContext(source, {
    window, URL, Promise, Element: FakeElement, Node: FakeNode,
    XMLHttpRequest: FakeXHR, HTMLScriptElement: FakeScript,
    console: { warn: message => notices.push(message) }
  });
  return {window, FakeNode, FakeScript, FakeXHR, children, network, notices};
}
test('Immutable APK guard rejects remote executable fetch and XHR', async () => {
  const b = boot();
  await assert.rejects(b.window.fetch(mutable), /blocked/);
  assert.throws(() => new b.FakeXHR().open('GET', mutable), /blocked/);
  await b.window.fetch(safe);
  assert.deepEqual(b.network, [safe]);
  assert.equal(b.notices.length, 1, 'only one warning');
});
test('Rejects dynamically inserted mutable script but allows ordinary scripts', () => {
  const b = boot();
  const blocked = new b.FakeScript();
  blocked.setAttribute('src', mutable);
  assert.equal(blocked.getAttribute('src'), '');
  blocked.src = mutable;
  assert.equal(blocked.src, '');
  const container = new b.FakeNode();
  const normal = new b.FakeScript();
  normal.src = safe;
  container.appendChild(normal);
  assert.equal(b.children.length, 1);
  assert.equal(b.children[0].src, safe);
});
test('Guard remains disabled on unrelated websites', async () => {
  const b = boot('example.com');
  await b.window.fetch(mutable);
  assert.equal(b.network[0], mutable);
});

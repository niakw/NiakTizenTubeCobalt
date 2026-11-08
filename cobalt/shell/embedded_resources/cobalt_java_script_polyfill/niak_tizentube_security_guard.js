/*
 * Niak Cobalt userscript security guard.
 * Blocks the mutable TizenTube CDN userscript. The audited version is built
 * from a pinned Git commit and compiled into the APK instead.
 */
(function () {
  'use strict';

  if (!/^(www\.youtube\.com|youtube\.com|m\.youtube\.com)$/.test(window.location.hostname)) return;
  if (window.__niakPinnedScriptGuard) return;
  window.__niakPinnedScriptGuard = true;
  var warned = false;

  function mutableTizenTubeScript(value) {
    if (typeof value !== 'string' || value.indexOf('@foxreis/tizentube') === -1) return false;
    try {
      var u = new URL(value, window.location.href);
      if (u.protocol !== 'https:') return false;
      if (u.hostname !== 'cdn.jsdelivr.net' && u.hostname !== 'unpkg.com') return false;
      return /^\/(?:npm\/)?@foxreis\/tizentube(?:@[^/]+)?\/dist\/userScript\.js$/i.test(u.pathname);
    } catch (_) { return false; }
  }

  function warnOnce() {
    if (warned) return;
    warned = true;
    console.warn('Niak Cobalt: blocked mutable external TizenTube userscript; APK-bundled copy is used.');
  }

  function scriptTag(node) {
    return node && typeof node.tagName === 'string' && node.tagName.toUpperCase() === 'SCRIPT';
  }

  function blockedElement(node) {
    if (!scriptTag(node)) return false;
    var src = node.getAttribute && node.getAttribute('src') || node.src || '';
    return mutableTizenTubeScript(src);
  }

  if (typeof Element !== 'undefined' && Element.prototype.setAttribute) {
    var originalAttribute = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function (name, value) {
      if (scriptTag(this) && String(name).toLowerCase() === 'src' &&
          mutableTizenTubeScript(String(value))) {
        warnOnce();
        return;
      }
      return originalAttribute.apply(this, arguments);
    };
  }

  if (typeof HTMLScriptElement !== 'undefined') {
    var descriptor = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'src');
    if (descriptor && descriptor.configurable && descriptor.set) {
      Object.defineProperty(HTMLScriptElement.prototype, 'src', {
        configurable: true,
        enumerable: descriptor.enumerable,
        get: descriptor.get,
        set: function (value) {
          if (mutableTizenTubeScript(String(value))) { warnOnce(); return; }
          return descriptor.set.call(this, value);
        }
      });
    }
  }

  if (typeof Node !== 'undefined') {
    ['appendChild', 'insertBefore', 'replaceChild'].forEach(function (method) {
      var original = Node.prototype[method];
      if (typeof original !== 'function') return;
      Node.prototype[method] = function (node) {
        if (blockedElement(node)) { warnOnce(); return node; }
        return original.apply(this, arguments);
      };
    });
  }

  if (typeof window.fetch === 'function') {
    var originalFetch = window.fetch;
    window.fetch = function (resource) {
      var url = typeof resource === 'string' ? resource :
        resource && resource.url;
      if (mutableTizenTubeScript(url)) {
        warnOnce();
        return Promise.reject(new TypeError('Mutable TizenTube userscript blocked'));
      }
      return originalFetch.apply(this, arguments);
    };
  }

  if (typeof XMLHttpRequest !== 'undefined' && XMLHttpRequest.prototype.open) {
    var originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url) {
      if (mutableTizenTubeScript(String(url))) {
        warnOnce();
        throw new TypeError('Mutable TizenTube userscript blocked');
      }
      return originalOpen.apply(this, arguments);
    };
  }
})();
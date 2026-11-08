/*
 * Niak TizenTube Cobalt: local recommendation controls.
 * SPDX-License-Identifier: GPL-3.0-only
 * Inspired by simkin/TizenTube PR #720 (video/channel blocklists).
 * This script is bundled by cobalt/shell:embed_polyfilled_javascript.
 */
(function () {
  'use strict';

  if (!/^(www|m)\.youtube\.com$/i.test(window.location.hostname)) return;
  if (window.__niakRecommendationControlsLoaded) return;
  window.__niakRecommendationControlsLoaded = true;

  var STORAGE_KEY = 'niak.tizentube.recommendations.v1';
  var MAX_HIDDEN = 1000;
  var MAX_BLOCKED = 500;
  var nativeParse = JSON.parse;
  var state = load();
  var resolverTimer;

  function load() {
    try {
      var saved = nativeParse(window.localStorage.getItem(STORAGE_KEY) || '{}');
      return {
        hidden: Array.isArray(saved.hidden) ? saved.hidden.filter(isString).slice(-MAX_HIDDEN) : [],
        blocked: Array.isArray(saved.blocked) ? saved.blocked.filter(isString).slice(-MAX_BLOCKED) : [],
        names: saved.names && typeof saved.names === 'object' && !Array.isArray(saved.names) ? saved.names : {}
      };
    } catch (_) {
      return { hidden: [], blocked: [], names: {} };
    }
  }

  function isString(value) { return typeof value === 'string' && value.length < 256; }
  function persist() {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch (error) { console.warn('NiakCobalt: preferences could not be saved', error); }
  }
  function nameKey(name) { return 'name:' + name.trim().toLocaleLowerCase(); }
  function idKey(id) { return 'id:' + id; }

  function textOf(value) {
    if (typeof value === 'string') return value;
    if (!value || typeof value !== 'object') return '';
    if (typeof value.simpleText === 'string') return value.simpleText;
    if (typeof value.content === 'string') return value.content;
    if (Array.isArray(value.runs)) return value.runs.map(function (run) { return run && run.text || ''; }).join('');
    return '';
  }

  function findChannelId(root, depth, budget) {
    if (!root || typeof root !== 'object' || depth > 10 || budget.left-- <= 0) return null;
    var id = root.browseEndpoint && root.browseEndpoint.browseId;
    if (typeof id === 'string' && /^UC[\w-]{22}$/.test(id)) return id;
    var values = Object.values(root);
    for (var i = 0; i < values.length; i++) {
      var found = findChannelId(values[i], depth + 1, budget);
      if (found) return found;
    }
    return null;
  }

  function getVideoId(item) {
    return (item.tileRenderer && item.tileRenderer.contentId) ||
      (item.lockupViewModel && item.lockupViewModel.contentId) || null;
  }

  function getChannel(item) {
    var tile = item.tileRenderer;
    var lockup = item.lockupViewModel;
    var node = tile
      ? tile.metadata && tile.metadata.tileMetadataRenderer && tile.metadata.tileMetadataRenderer.lines &&
        tile.metadata.tileMetadataRenderer.lines[0] && tile.metadata.tileMetadataRenderer.lines[0].lineRenderer &&
        tile.metadata.tileMetadataRenderer.lines[0].lineRenderer.items &&
        tile.metadata.tileMetadataRenderer.lines[0].lineRenderer.items[0] &&
        tile.metadata.tileMetadataRenderer.lines[0].lineRenderer.items[0].lineItemRenderer &&
        tile.metadata.tileMetadataRenderer.lines[0].lineRenderer.items[0].lineItemRenderer.text
      : lockup && lockup.metadata && lockup.metadata.lockupMetadataViewModel &&
        lockup.metadata.lockupMetadataViewModel.metadata &&
        lockup.metadata.lockupMetadataViewModel.metadata.contentMetadataViewModel &&
        lockup.metadata.lockupMetadataViewModel.metadata.contentMetadataViewModel.metadataRows &&
        lockup.metadata.lockupMetadataViewModel.metadata.contentMetadataViewModel.metadataRows[0] &&
        lockup.metadata.lockupMetadataViewModel.metadata.contentMetadataViewModel.metadataRows[0].metadataParts &&
        lockup.metadata.lockupMetadataViewModel.metadata.contentMetadataViewModel.metadataRows[0].metadataParts[0] &&
        lockup.metadata.lockupMetadataViewModel.metadata.contentMetadataViewModel.metadataRows[0].metadataParts[0].text;
    var name = textOf(node).trim().slice(0, 140);
    var id = findChannelId(node, 0, { left: 50 }) || findChannelId(item, 0, { left: 200 });
    return name || id ? { id: id, name: name } : null;
  }

  function isVideoTile(item) {
    return item && (item.tileRenderer && item.tileRenderer.style === 'TILE_STYLE_YTLR_DEFAULT' ||
      item.lockupViewModel && item.lockupViewModel.contentType === 'LOCKUP_CONTENT_TYPE_VIDEO');
  }

  function menuAction(label, action, parameters) {
    return { menuServiceItemRenderer: {
      text: { runs: [{ text: label }] },
      serviceEndpoint: { clickTrackingParams: null,
        playlistEditEndpoint: { customAction: { action: action, parameters: parameters } } },
      trackingParams: null
    } };
  }

  function getMenu(item) {
    var tile = item.tileRenderer;
    var lockup = item.lockupViewModel;
    var context = lockup && lockup.rendererContext && lockup.rendererContext.commandContext;
    var current = tile ? tile.onLongPressCommand : context && context.onLongPress && context.onLongPress.innertubeCommand;
    var validMenu = current && current.showMenuCommand && current.showMenuCommand.menu &&
      current.showMenuCommand.menu.menuRenderer && current.showMenuCommand.menu.menuRenderer.items;
    if (Array.isArray(validMenu)) return validMenu;

    var videoId = getVideoId(item);
    if (!videoId) return null;
    var title = tile ? textOf(tile.metadata && tile.metadata.tileMetadataRenderer && tile.metadata.tileMetadataRenderer.title)
      : textOf(lockup.metadata && lockup.metadata.lockupMetadataViewModel && lockup.metadata.lockupMetadataViewModel.title);
    var channel = getChannel(item);
    var clickEndpoint = tile ? tile.onSelectCommand && tile.onSelectCommand.watchEndpoint
      : context && context.onTap && context.onTap.innertubeCommand && context.onTap.innertubeCommand.watchEndpoint;
    var items = [];
    if (clickEndpoint) items.push({ menuNavigationItemRenderer: {
      text: { runs: [{ text: 'Lire' }] }, navigationEndpoint: { watchEndpoint: clickEndpoint }, trackingParams: null
    } });
    var menuCommand = Object.assign({}, current || {}, {
      showMenuCommand: {
        contentId: videoId,
        title: { simpleText: title || '' },
        subtitle: { simpleText: channel && channel.name || '' },
        menu: { menuRenderer: {
          items: items, trackingParams: null,
          accessibility: { accessibilityData: { label: 'Options vidéo' } }
        } }
      }
    });
    if (tile) tile.onLongPressCommand = menuCommand;
    else if (context) context.onLongPress = Object.assign({}, context.onLongPress || {}, { innertubeCommand: menuCommand });
    else return null;
    return items;
  }

  function addActions(item) {
    var videoId = getVideoId(item);
    if (!isString(videoId)) return;
    var items = getMenu(item);
    if (!items || items.some(function (e) {
      var endpoint = e && e.menuServiceItemRenderer && e.menuServiceItemRenderer.serviceEndpoint;
      var action = endpoint && endpoint.playlistEditEndpoint && endpoint.playlistEditEndpoint.customAction;
      return action && action.action === 'NIAK_HIDE_VIDEO';
    })) return;
    var channel = getChannel(item);
    items.push(menuAction('Pas intéressé (masquer)', 'NIAK_HIDE_VIDEO', { videoId: videoId }));
    if (channel) {
      items.push(menuAction('Ne plus recommander cette chaîne (local)', 'NIAK_BLOCK_CHANNEL', channel));
      items.push(menuAction('Bloquer cette chaîne', 'NIAK_BLOCK_CHANNEL', channel));
    }
    items.push(menuAction('Gérer les vidéos et chaînes masquées', 'NIAK_MANAGE_HIDDEN', {}));
  }

  function pageExempt() {
    return /FElibrary|FEhistory|FEplaylist|\/playlist|[?&]list=/i.test(window.location.hash || '');
  }
  function blocked(item) {
    if (!isVideoTile(item)) return false;
    if (state.hidden.indexOf(getVideoId(item)) !== -1) return true;
    var channel = getChannel(item);
    if (!channel) return false;
    if (channel.id && state.blocked.indexOf(idKey(channel.id)) !== -1) return true;
    if (channel.name && state.blocked.indexOf(nameKey(channel.name)) !== -1) return true;
    if (!channel.id && channel.name) return state.blocked.some(function (key) {
      return key.indexOf('id:') === 0 && state.names[key] && nameKey(state.names[key]) === nameKey(channel.name);
    });
    return false;
  }

  function patchResponse(value) {
    var budget = { left: 3500 };
    function walk(obj, depth) {
      if (!obj || typeof obj !== 'object' || depth > 19 || budget.left-- <= 0) return;
      if (Array.isArray(obj)) {
        for (var n = 0; n < obj.length; n++) walk(obj[n], depth + 1);
        return;
      }
      for (var key in obj) {
        if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
        var child = obj[key];
        if (key === 'items' && Array.isArray(child)) {
          var hasVideo = child.some(isVideoTile);
          if (hasVideo) {
            child.forEach(function (item) { if (isVideoTile(item)) addActions(item); });
            if (!pageExempt()) obj[key] = child.filter(function (item) { return !blocked(item); });
            child = obj[key];
          }
        }
        walk(child, depth + 1);
      }
    }
    walk(value, 0);
  }

  JSON.parse = function () {
    var result = nativeParse.apply(this, arguments);
    var source = arguments[0];
    if (typeof source === 'string' &&
        (source.indexOf('"tileRenderer"') !== -1 || source.indexOf('"lockupViewModel"') !== -1)) {
      try { patchResponse(result); }
      catch (error) { console.warn('NiakCobalt: recommendation patch failed', error); }
    }
    return result;
  };

  function notice(message) {
    try {
      if (!document.body) return;
      var box = document.createElement('div');
      box.textContent = message;
      box.style.cssText = 'position:fixed;z-index:2147483647;bottom:5%;left:5%;max-width:90%;padding:20px 28px;background:#222;color:#fff;font:20px Arial;border-radius:12px;';
      document.body.appendChild(box);
      window.setTimeout(function () { if (box.parentNode) box.parentNode.removeChild(box); }, 3500);
    } catch (_) {}
  }

  function saveAction(action) {
    if (action.action === 'NIAK_HIDE_VIDEO') {
      var videoId = action.parameters && action.parameters.videoId;
      if (!isString(videoId)) return true;
      if (state.hidden.indexOf(videoId) === -1) state.hidden.push(videoId);
      state.hidden = state.hidden.slice(-MAX_HIDDEN);
      persist();
      notice('Vidéo masquée. Actualise l’accueil pour appliquer.');
      return true;
    }
    if (action.action === 'NIAK_BLOCK_CHANNEL') {
      var channel = action.parameters || {};
      var key = channel.id && /^UC[\w-]{22}$/.test(channel.id) ? idKey(channel.id)
        : channel.name && isString(channel.name) ? nameKey(channel.name) : null;
      if (!key) return true;
      if (state.blocked.indexOf(key) === -1) state.blocked.push(key);
      state.blocked = state.blocked.slice(-MAX_BLOCKED);
      state.names[key] = channel.name || channel.id;
      persist();
      notice('Chaîne bloquée localement. Actualise l’accueil.');
      return true;
    }
    if (action.action === 'NIAK_MANAGE_HIDDEN') { openManager(); return true; }
    return false;
  }

  function extractAction(cmd) {
    if (!cmd || typeof cmd !== 'object') return null;
    return cmd.playlistEditEndpoint && cmd.playlistEditEndpoint.customAction ||
      cmd.customAction || cmd.signalAction && cmd.signalAction.customAction || null;
  }

  function hookResolvers() {
    try {
      var yttv = window._yttv;
      if (!yttv) return;
      Object.keys(yttv).forEach(function (key) {
        var inst = yttv[key] && yttv[key].instance;
        if (!inst || typeof inst.resolveCommand !== 'function' || inst.resolveCommand.__niakControls) return;
        var previous = inst.resolveCommand;
        var wrapped = function (cmd) {
          var action = extractAction(cmd);
          if (action && /^NIAK_/.test(action.action || '') && saveAction(action)) return true;
          return previous.apply(this, arguments);
        };
        wrapped.__niakControls = true;
        inst.resolveCommand = wrapped;
      });
    } catch (error) { console.warn('NiakCobalt: command hookup unavailable', error); }
  }

  function makeButton(parent, label, action) {
    var button = document.createElement('button');
    button.textContent = label;
    button.style.cssText = 'display:block;background:#303030;color:white;border:2px solid #777;border-radius:8px;padding:14px;margin:8px 0;font:18px Arial;width:100%;text-align:left;';
    button.addEventListener('click', action);
    parent.appendChild(button);
    return button;
  }

  function openManager() {
    if (!document.body) return;
    var old = document.getElementById('niak-hidden-manager');
    if (old) old.remove();
    var root = document.createElement('div');
    root.id = 'niak-hidden-manager';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', 'Gestion des masquages');
    root.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.88);display:flex;align-items:center;justify-content:center;color:white;font:20px Arial;';
    var panel = document.createElement('div');
    panel.style.cssText = 'background:#171717;border:1px solid #666;border-radius:14px;width:75%;max-height:80%;overflow:auto;padding:24px 30px;';
    var title = document.createElement('h2');
    title.textContent = 'Vidéos et chaînes masquées';
    panel.appendChild(title);
    var subtitle = document.createElement('p');
    subtitle.textContent = state.hidden.length + ' vidéos masquées · ' + state.blocked.length + ' chaînes bloquées (localement)';
    panel.appendChild(subtitle);
    if (state.hidden.length) makeButton(panel, 'Effacer les vidéos masquées (' + state.hidden.length + ')', function () {
      state.hidden = []; persist(); openManager();
    });
    state.blocked.forEach(function (key) {
      makeButton(panel, 'Débloquer : ' + (state.names[key] || key), function () {
        state.blocked = state.blocked.filter(function (k) { return k !== key; });
        delete state.names[key]; persist(); openManager();
      });
    });
    makeButton(panel, 'Fermer', function () { root.remove(); });
    root.appendChild(panel);
    document.body.appendChild(root);
    root.addEventListener('keydown', function (event) {
      var keys = ['Escape', 'Backspace', 'BrowserBack'];
      if (keys.indexOf(event.key) !== -1) { event.preventDefault(); root.remove(); return; }
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      var buttons = Array.from(root.querySelectorAll('button'));
      var index = buttons.indexOf(document.activeElement);
      var delta = event.key === 'ArrowDown' ? 1 : -1;
      buttons[(index + delta + buttons.length) % buttons.length].focus();
      event.preventDefault();
    });
    var first = panel.querySelector('button');
    if (first) first.focus();
  }

  hookResolvers();
  resolverTimer = window.setInterval(hookResolvers, 800);
  window.addEventListener('pagehide', function () { window.clearInterval(resolverTimer); });
})();
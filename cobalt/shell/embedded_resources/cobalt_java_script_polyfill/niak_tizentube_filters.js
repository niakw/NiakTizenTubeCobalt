/*
 * Niak TizenTube Cobalt video and channel filters.
 * Ported independently from the behavior of reisxd/TizenTube PR #720.
 * Local filtering is deliberately separate from the remotely loaded userscript.
 * This script ships inside the APK via Cobalt's document-start JS resources.
 */
(function () {
  'use strict';
  if (!/^(www\.youtube\.com|youtube\.com|m\.youtube\.com)$/.test(window.location.hostname)) return;
  if (window.__niakTizenTubeFiltersV1) return;
  window.__niakTizenTubeFiltersV1 = true;

  var STORAGE_KEY = 'niak-tizentube-filters-v1';
  var MAX_HIDDEN = 1000;
  var MAX_CHANNELS = 250;
  // Weak keys prevent the metadata cache from retaining obsolete TV tiles.
  var channelCache = new WeakMap();
  var fr = /^fr\b/i.test(navigator.language || '');
  var text = fr ? {
    hide: 'Pas intéressé', dont: 'Ne pas recommander cette chaîne',
    block: 'Bloquer cette chaîne', manage: 'Gérer les vidéos et chaînes masquées',
    heading: 'Vidéos et chaînes masquées', clear: 'Réafficher toutes les vidéos',
    clearChannels: 'Débloquer toutes les chaînes', none: 'Aucune chaîne bloquée',
    unblock: 'Débloquer : ', hidden: 'Vidéo masquée (actualise les recommandations)',
    blocked: 'Chaîne bloquée (actualise les recommandations)',
    restored: 'Filtres mis à jour', unavailable: 'Chaîne non identifiable'
  } : {
    hide: 'Not interested', dont: "Don't recommend this channel",
    block: 'Block channel', manage: 'Manage hidden videos and channels',
    heading: 'Hidden videos and blocked channels', clear: 'Restore all hidden videos',
    clearChannels: 'Unblock all channels', none: 'No blocked channels',
    unblock: 'Unblock: ', hidden: 'Video hidden (refresh recommendations)',
    blocked: 'Channel blocked (refresh recommendations)',
    restored: 'Filters updated', unavailable: 'Channel unavailable'
  };

  function emptyState() { return { hiddenVideos: [], blockedChannels: [], channelNames: {} }; }
  function readState() {
    try {
      var value = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
      if (!value || typeof value !== 'object') return emptyState();
      return {
        hiddenVideos: Array.isArray(value.hiddenVideos) ? value.hiddenVideos.filter(function (v) { return typeof v === 'string'; }).slice(-MAX_HIDDEN) : [],
        blockedChannels: Array.isArray(value.blockedChannels) ? value.blockedChannels.filter(function (v) { return typeof v === 'string'; }).slice(-MAX_CHANNELS) : [],
        channelNames: value.channelNames && typeof value.channelNames === 'object' && !Array.isArray(value.channelNames) ? value.channelNames : {}
      };
    } catch (error) { return emptyState(); }
  }
  function writeState(value) {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); }
    catch (error) { console.warn('Niak filters: storage unavailable', error); }
  }
  function displayText(node) {
    if (typeof node === 'string') return node;
    if (!node || typeof node !== 'object') return '';
    if (typeof node.simpleText === 'string') return node.simpleText;
    if (typeof node.content === 'string') return node.content;
    if (Array.isArray(node.runs)) return node.runs.map(function (x) { return x && x.text || ''; }).join('');
    return '';
  }
  function findChannelId(value, depth) {
    if (!value || typeof value !== 'object' || depth > 11) return null;
    var browse = value.browseEndpoint && value.browseEndpoint.browseId;
    if (typeof browse === 'string' && /^UC[A-Za-z0-9_-]{22}$/.test(browse)) return browse;
    var keys = Object.keys(value);
    for (var i = 0; i < keys.length && i < 50; i++) {
      var id = findChannelId(value[keys[i]], depth + 1);
      if (id) return id;
    }
    return null;
  }
  // Home recommendations can wrap the real watch command in another endpoint.
  // Only unwrap explicit watch commands, never channel/playlist navigation.
  function watchNavigation(command, depth) {
    if (!command || typeof command !== 'object' || depth > 4) return null;
    if (command.watchEndpoint && typeof command.watchEndpoint.videoId === 'string') return command;
    var nested = command.innertubeCommand || command.navigationEndpoint;
    if (nested) {
      var match = watchNavigation(nested, depth + 1);
      if (match) return match;
    }
    var commands = command.commandExecutorCommand && command.commandExecutorCommand.commands;
    if (Array.isArray(commands)) {
      for (var i = 0; i < commands.length && i < 8; i++) {
        var found = watchNavigation(commands[i], depth + 1);
        if (found) return found;
      }
    }
    return null;
  }
  function videoNavigation(item) {
    var t = item && item.tileRenderer, l = item && item.lockupViewModel;
    var context = l && l.rendererContext && l.rendererContext.commandContext;
    return watchNavigation(t ? (t.onSelectCommand || t.navigationEndpoint ||
      t.onTapCommand || t.onTap) :
      context && (context.onTap || context.onTapCommand || context.onSelectCommand), 0);
  }
  function videoId(item) {
    var id = item && (item.tileRenderer && item.tileRenderer.contentId ||
      item.lockupViewModel && item.lockupViewModel.contentId);
    if (!(typeof id === 'string' && /^[A-Za-z0-9_-]{11}$/.test(id))) {
      var navigation = videoNavigation(item);
      id = navigation && navigation.watchEndpoint.videoId;
    }
    return typeof id === 'string' && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  }
  function channelInfo(item) {
    if (!item || typeof item !== 'object') return null;
    if (channelCache.has(item)) return channelCache.get(item);
    var t = item && item.tileRenderer;
    var l = item && item.lockupViewModel;
    var nameNode = t ? t.metadata && t.metadata.tileMetadataRenderer && t.metadata.tileMetadataRenderer.lines &&
      t.metadata.tileMetadataRenderer.lines[0] && t.metadata.tileMetadataRenderer.lines[0].lineRenderer &&
      t.metadata.tileMetadataRenderer.lines[0].lineRenderer.items &&
      t.metadata.tileMetadataRenderer.lines[0].lineRenderer.items[0] &&
      t.metadata.tileMetadataRenderer.lines[0].lineRenderer.items[0].lineItemRenderer &&
      t.metadata.tileMetadataRenderer.lines[0].lineRenderer.items[0].lineItemRenderer.text :
      l && l.metadata && l.metadata.lockupMetadataViewModel && l.metadata.lockupMetadataViewModel.metadata &&
      l.metadata.lockupMetadataViewModel.metadata.contentMetadataViewModel &&
      l.metadata.lockupMetadataViewModel.metadata.contentMetadataViewModel.metadataRows &&
      l.metadata.lockupMetadataViewModel.metadata.contentMetadataViewModel.metadataRows[0] &&
      l.metadata.lockupMetadataViewModel.metadata.contentMetadataViewModel.metadataRows[0].metadataParts &&
      l.metadata.lockupMetadataViewModel.metadata.contentMetadataViewModel.metadataRows[0].metadataParts[0] &&
      l.metadata.lockupMetadataViewModel.metadata.contentMetadataViewModel.metadataRows[0].metadataParts[0].text;
    var name = displayText(nameNode).trim();
    var id = findChannelId(nameNode, 0) || findChannelId(item, 0);
    var result = name || id ? { id: id, name: name } : null;
    channelCache.set(item, result);
    return result;
  }
  function channelKey(channel) {
    if (!channel || typeof channel !== 'object') return null;
    if (channel.id && /^UC[A-Za-z0-9_-]{22}$/.test(channel.id)) return 'id:' + channel.id;
    if (typeof channel.name === 'string' && channel.name.trim()) return 'name:' + channel.name.trim().toLowerCase();
    return null;
  }
  function blockChannel(channel) {
    var key = channelKey(channel);
    if (!key) return false;
    var state = readState();
    if (state.blockedChannels.indexOf(key) === -1) state.blockedChannels.push(key);
    state.blockedChannels = state.blockedChannels.slice(-MAX_CHANNELS);
    state.channelNames[key] = channel.name || channel.id;
    writeState(state);
    return true;
  }
  function hideVideo(id) {
    if (!id) return false;
    var state = readState();
    if (state.hiddenVideos.indexOf(id) === -1) state.hiddenVideos.push(id);
    state.hiddenVideos = state.hiddenVideos.slice(-MAX_HIDDEN);
    writeState(state);
    return true;
  }
  function exemptions() {
    return /FElibrary|FEhistory|FEplaylist|\/playlist|[?&]list=/i.test(window.location.hash || '');
  }
  function isVideo(item) {
    if (!item) return false;
    var t = item.tileRenderer, l = item.lockupViewModel;
    // Home uses many styles of video tile, not just DEFAULT and FEATURED.
    // A valid watch/video ID is stronger evidence than any presentation style.
    // Explicit channel, playlist and mix cards must still remain untouched.
    if (!videoId(item)) return false;
    var type = (t && t.contentType || l && l.contentType || '');
    if (typeof type === 'string' && /CHANNEL|PLAYLIST|COLLECTION|MIX/i.test(type))
      return false;
    return !!(t || l);
  }
  function isBlocked(item, state) {
    if (!isVideo(item)) return false;
    if (state.hiddenVideos.indexOf(videoId(item)) !== -1) return true;
    var channel = channelInfo(item);
    if (!channel) return false;
    var key = channelKey(channel);
    if (key && state.blockedChannels.indexOf(key) !== -1) return true;
    if (channel.name) {
      var nameKey = 'name:' + channel.name.toLowerCase();
      if (state.blockedChannels.indexOf(nameKey) !== -1) return true;
      if (!channel.id) {
        for (var i = 0; i < state.blockedChannels.length; i++) {
          var k = state.blockedChannels[i];
          if (k.indexOf('id:') === 0 && String(state.channelNames[k] || '').toLowerCase() === channel.name.toLowerCase()) return true;
        }
      }
    }
    return false;
  }
  function serviceItem(title, action, parameters) {
    return { menuServiceItemRenderer: {
      text: { runs: [{ text: title }] },
      trackingParams: null,
      serviceEndpoint: { clickTrackingParams: null, playlistEditEndpoint: {
        customAction: { action: action, parameters: parameters || null }
      } }
    } };
  }
  function feedbackPanel(item) {
    var t = item && item.tileRenderer, l = item && item.lockupViewModel;
    var onLongPress = t && t.onLongPressCommand ||
      l && l.rendererContext && l.rendererContext.commandContext && l.rendererContext.commandContext.onLongPress;
    var endpoint = onLongPress && (onLongPress.showEngagementPanelEndpoint ||
      onLongPress.innertubeCommand && onLongPress.innertubeCommand.showEngagementPanelEndpoint);
    if (endpoint && endpoint.identifier && endpoint.identifier.tag &&
      endpoint.globalConfiguration && endpoint.globalConfiguration.params) {
      return { panelId: endpoint.identifier.tag, params: endpoint.globalConfiguration.params };
    }
    return null;
  }
  function menuFor(item) {
    var t = item.tileRenderer, l = item.lockupViewModel;
    var cmd = t ? t.onLongPressCommand :
      l.rendererContext && l.rendererContext.commandContext &&
      l.rendererContext.commandContext.onLongPress;
    if (cmd && cmd.innertubeCommand) cmd = cmd.innertubeCommand;
    if (cmd && cmd.showMenuCommand && cmd.showMenuCommand.menu &&
      cmd.showMenuCommand.menu.menuRenderer && Array.isArray(cmd.showMenuCommand.menu.menuRenderer.items)) {
      return cmd.showMenuCommand.menu.menuRenderer.items;
    }
    var id = videoId(item), navigation = videoNavigation(item);
    if (!id) return null;
    // Home occasionally ships a valid video ID but no explicit watch command.
    // Preserve the native endpoint when present; use a minimal watch command otherwise.
    if (!navigation) navigation = { watchEndpoint: { videoId: id } };
    var items = [{ menuNavigationItemRenderer: {
      text: { runs: [{ text: fr ? 'Lire' : 'Play' }] },
      navigationEndpoint: navigation, trackingParams: null
    } }];
    var data = { showMenuCommand: {
      contentId: id, thumbnail: { thumbnails: t && t.header && t.header.tileHeaderRenderer &&
        t.header.tileHeaderRenderer.thumbnail && t.header.tileHeaderRenderer.thumbnail.thumbnails || [] },
      title: { simpleText: '' }, subtitle: { simpleText: '' },
      menu: { menuRenderer: { items: items, trackingParams: null } }
    } };
    if (t) t.onLongPressCommand = data;
    else {
      if (!l.rendererContext) l.rendererContext = {};
      if (!l.rendererContext.commandContext) l.rendererContext.commandContext = {};
      l.rendererContext.commandContext.onLongPress = { innertubeCommand: data };
    }
    return items;
  }
  function decorateMenu(item) {
    if (!isVideo(item) || !videoId(item)) return;
    var panel = feedbackPanel(item);
    var items = menuFor(item);
    if (!items) return;
    var channel = channelInfo(item), id = videoId(item);
    var seen = {};
    // TizenTube itself can add the two feedback actions. Reuse those entries
    // instead of appending a second pair, while routing them to our local
    // persistence handler. Keep unrelated YouTube service commands untouched.
    for (var i = 0; i < items.length; i++) {
      var renderer = items[i] && items[i].menuServiceItemRenderer;
      var action = renderer && actionOf(renderer.serviceEndpoint);
      if (!action || typeof action.action !== 'string') continue;
      var name = action.action;
      if (name === 'NOT_INTERESTED') {
        action.action = 'NIAK_NOT_INTERESTED';
        action.parameters = { videoId: id, panel: panel || action.parameters || null };
        name = action.action;
      } else if (name === 'DONT_RECOMMEND_CHANNEL') {
        action.action = 'NIAK_DONT_RECOMMEND';
        action.parameters = { channel: channel, panel: panel || action.parameters || null };
        name = action.action;
      }
      if (name.indexOf('NIAK_') !== 0) continue;
      if (seen[name]) {
        items.splice(i--, 1);
      } else {
        seen[name] = true;
      }
    }
    if (!seen.NIAK_NOT_INTERESTED)
      items.push(serviceItem(text.hide, 'NIAK_NOT_INTERESTED', { videoId: id, panel: panel }));
    if (channel) {
      if (!seen.NIAK_DONT_RECOMMEND)
        items.push(serviceItem(text.dont, 'NIAK_DONT_RECOMMEND', { channel: channel, panel: panel }));
      if (!seen.NIAK_BLOCK_CHANNEL)
        items.push(serviceItem(text.block, 'NIAK_BLOCK_CHANNEL', { channel: channel }));
    }
    if (!seen.NIAK_MANAGE_FILTERS)
      items.push(serviceItem(text.manage, 'NIAK_MANAGE_FILTERS', null));
  }
  // The main TizenTube userscript already removes adSlotRenderer in some
  // home layouts. This backstop covers nested and continuation shelves, without
  // attempting to guess whether editorial/featured videos are paid ads.
  function adBlockingEnabled() {
    try {
      var stored = window.localStorage.getItem('ytaf-configuration');
      if (!stored) return true;
      var config = nativeParse(stored);
      return !config || config.enableAdBlock !== false;
    } catch (error) { return true; }
  }
  function isConfirmedAdSlot(item) {
    return !!(item && typeof item === 'object' &&
      Object.prototype.hasOwnProperty.call(item, 'adSlotRenderer'));
  }
  function filterItems(items, state, blockAds) {
    if (!Array.isArray(items)) return items;
    for (var i = 0; i < items.length; i++) decorateMenu(items[i]);
    if (exemptions()) return items;
    if (!state.hiddenVideos.length && !state.blockedChannels.length && !blockAds) return items;
    return items.filter(function (item) {
      return !(blockAds && isConfirmedAdSlot(item)) && !isBlocked(item, state);
    });
  }
  function decoratePayload(root) {
    if (!root || typeof root !== 'object' || Array.isArray(root)) return;
    if (!root.contents && !root.continuationContents &&
        !root.onResponseReceivedActions && !root.onResponseReceivedEndpoints &&
        !root.frameworkUpdates) return;
    // Read localStorage once per network response instead of once per shelf.
    var state = readState();
    var blockAds = adBlockingEnabled();
    var seen = new WeakSet(), count = 0;
    function walk(obj, depth) {
      if (!obj || typeof obj !== 'object' || seen.has(obj) || depth > 22 || ++count > 6000) return;
      seen.add(obj);
      // Home can wrap video tiles in richItemRenderer rather than the usual list.
      if (isVideo(obj)) decorateMenu(obj);
      if (obj.sectionListRenderer && Array.isArray(obj.sectionListRenderer.contents) &&
          blockAds && !exemptions()) {
        obj.sectionListRenderer.contents =
          obj.sectionListRenderer.contents.filter(function (item) { return !isConfirmedAdSlot(item); });
      }
      if (obj.horizontalListRenderer && Array.isArray(obj.horizontalListRenderer.items))
        obj.horizontalListRenderer.items = filterItems(obj.horizontalListRenderer.items, state, blockAds);
      if (obj.gridRenderer && Array.isArray(obj.gridRenderer.items))
        obj.gridRenderer.items = filterItems(obj.gridRenderer.items, state, blockAds);
      if (obj.horizontalListContinuation && Array.isArray(obj.horizontalListContinuation.items))
        obj.horizontalListContinuation.items = filterItems(obj.horizontalListContinuation.items, state, blockAds);
      if (obj.gridContinuation && Array.isArray(obj.gridContinuation.items))
        obj.gridContinuation.items = filterItems(obj.gridContinuation.items, state, blockAds);
      var keys = Object.keys(obj);
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        if (k === 'metadata' || k === 'rendererContext' || k === 'menu' || k === 'streamingData') continue;
        var v = obj[k];
        if (v && typeof v === 'object') {
          if (Array.isArray(v)) {
            for (var j = 0; j < v.length && j < 250; j++) walk(v[j], depth + 1);
          } else walk(v, depth + 1);
        }
      }
    }
    walk(root, 0);
  }

  // TizenTube installs its own JSON.parse wrapper after this document-start
  // script. Always run our menu deduplication AFTER the latest upstream parser.
  // Earlier wrappers are retained for compatibility, but do not redecorate.
  var nativeParse = JSON.parse;
  var parseDepth = 0;
  function wrapParse(parser) {
    return function () {
    parseDepth++;
    try {
    var data = parser.apply(this, arguments);
    if (parseDepth > 1) return data;
    var source = arguments[0];
    var isPlayerAds = typeof source === 'string' &&
        (source.indexOf('"adPlacements"') !== -1 ||
         source.indexOf('"adSlots"') !== -1 ||
         source.indexOf('"playerAds"') !== -1);
    // A normal VOD/live player response may contain top-level ad markers.
    // Drop only structures already handled by the upstream TizenTube ad blocker,
    // without rewriting streams, timing, captions or playback contexts.
    if (isPlayerAds && data && typeof data === 'object' && !Array.isArray(data)) {
      try {
        if (adBlockingEnabled()) {
          if (Array.isArray(data.adPlacements)) data.adPlacements = [];
          if (Array.isArray(data.adSlots)) data.adSlots = [];
          if (data.playerAds) data.playerAds = false;
        }
      } catch (error) {
        console.warn('Niak filters: player-ad parsing unavailable', error);
      }
    }
    // Avoid traversing large video streams and player settings JSON.
    if (typeof source === 'string' &&
        source.indexOf('"horizontalListRenderer"') === -1 &&
        source.indexOf('"gridRenderer"') === -1 &&
        source.indexOf('"horizontalListContinuation"') === -1 &&
        source.indexOf('"gridContinuation"') === -1 &&
         source.indexOf('"tileRenderer"') === -1 &&
         source.indexOf('"lockupViewModel"') === -1 &&
        source.indexOf('"richGridRenderer"') === -1) return data;
    try { decoratePayload(data); }
    catch (error) { console.warn('Niak filters: unable to process recommendations', error); }
    return data;
    } finally { parseDepth--; }
    };
  }
  var currentParse = wrapParse(nativeParse);
  try {
    var parseDescriptor = Object.getOwnPropertyDescriptor(JSON, 'parse');
    if (parseDescriptor && !parseDescriptor.configurable) {
      JSON.parse = currentParse;
    } else {
      Object.defineProperty(JSON, 'parse', {
        configurable: true,
        enumerable: parseDescriptor ? parseDescriptor.enumerable : false,
        get: function () { return currentParse; },
        set: function (next) {
          if (typeof next === 'function' && next !== currentParse)
            currentParse = wrapParse(next);
        }
      });
    }
  } catch (error) {
    JSON.parse = currentParse;
  }
  window.JSON.parse = JSON.parse;

  function findResolve() {
    var yttv = window._yttv;
    if (!yttv || typeof yttv !== 'object') return [];
    return Object.keys(yttv).map(function (key) {
      return yttv[key] && yttv[key].instance;
    }).filter(function (instance) {
      return instance && typeof instance.resolveCommand === 'function';
    });
  }
  function resolveUi(command) {
    var instances = findResolve();
    if (instances.length) return instances[0].resolveCommand(command);
    return false;
  }
  function toast(message) {
    resolveUi({ openPopupAction: { popupType: 'TOAST', popup: {
      overlayToastRenderer: { title: { simpleText: 'TizenTube' }, subtitle: { simpleText: message } }
    } } });
  }
  function compactLink(label, action, parameters) {
    return { compactLinkRenderer: {
      title: { simpleText: label },
      serviceEndpoint: { commandExecutorCommand: { commands: [
        { playlistEditEndpoint: { customAction: { action: action, parameters: parameters || null } } }
      ] } }
    } };
  }
  function showManage(update) {
    var state = readState(), list = [
      compactLink(text.clear + ' (' + state.hiddenVideos.length + ')', 'NIAK_CLEAR_VIDEOS'),
      compactLink(text.clearChannels + ' (' + state.blockedChannels.length + ')', 'NIAK_CLEAR_CHANNELS')
    ];
    for (var i = 0; i < state.blockedChannels.length && i < 60; i++) {
      var key = state.blockedChannels[i];
      list.push(compactLink(text.unblock + (state.channelNames[key] || key), 'NIAK_UNBLOCK_CHANNEL', { key: key }));
    }
    if (!state.blockedChannels.length) list.push({ overlayMessageRenderer: {
      message: { simpleText: text.none }
    } });
    var cmd = { openPopupAction: { popupType: 'MODAL', uniqueId: 'niak-filter-settings',
      popup: { overlaySectionRenderer: { overlay: { overlayTwoPanelRenderer: {
        actionPanel: { overlayPanelRenderer: {
          header: { overlayPanelHeaderRenderer: { title: { simpleText: text.heading } } },
          content: { overlayPanelItemListRenderer: { items: list } }
        } },
        backButton: { buttonRenderer: { command: { signalAction: { signal: 'POPUP_BACK' } } } }
      } }, dismissalCommand: { signalAction: { signal: 'POPUP_BACK' } } } }
    } };
    if (update) {
      cmd.openPopupAction.shouldMatchUniqueId = true;
      cmd.openPopupAction.updateAction = true;
    }
    resolveUi(cmd);
  }
  function sendYoutubeFeedback(panel, index) {
    if (!panel || typeof panel.panelId !== 'string' ||
        typeof panel.params !== 'string') return;
    try {
      var yttv = window._yttv;
      if (!yttv) return;
      var mappings = Object.keys(yttv).map(function (key) { return yttv[key] && yttv[key].mappings; })
        .filter(function (m) { return m && typeof m.get === 'function'; })[0];
      if (!mappings) return;
      var client = mappings.get('KabukiInnerTubeClient');
      if (!client || !client.fetch) return;
      client.fetch({ path: '/youtubei/v1/get_panel',
        payload: { panelId: panel.panelId, params: panel.params } }).subscribe(function (r) {
        var list = r && r.content && r.content.engagementPanelSectionListRenderer &&
          r.content.engagementPanelSectionListRenderer.content &&
          r.content.engagementPanelSectionListRenderer.content.listViewModel &&
          r.content.engagementPanelSectionListRenderer.content.listViewModel.listItems;
        if (!Array.isArray(list)) return;
        function findToken(obj, depth) {
          if (!obj || typeof obj !== 'object' || depth > 12) return null;
          if (typeof obj.feedbackToken === 'string') return obj.feedbackToken;
          var values = Object.keys(obj);
          for (var i = 0; i < values.length; i++) {
            var found = findToken(obj[values[i]], depth + 1);
            if (found) return found;
          }
          return null;
        }
        var tokens = list.map(function (x) { return findToken(x && x.listItemViewModel, 0); }).filter(Boolean);
        if (tokens[index]) client.fetch({ path: '/youtubei/v1/feedback',
          payload: { feedbackTokens: [tokens[index]] } }).subscribe(function () {}, function () {});
      }, function () {});
    } catch (error) { console.warn('Niak filters: feedback unavailable', error); }
  }
  function actionOf(cmd) {
    return cmd && (cmd.customAction || cmd.signalAction && cmd.signalAction.customAction ||
      cmd.playlistEditEndpoint && cmd.playlistEditEndpoint.customAction);
  }
  function handle(action, parameters) {
    if (action === 'NIAK_NOT_INTERESTED') {
      if (parameters && hideVideo(parameters.videoId)) {
        sendYoutubeFeedback(parameters.panel, 0); toast(text.hidden);
      }
    } else if (action === 'NIAK_DONT_RECOMMEND') {
      if (parameters && blockChannel(parameters.channel)) {
        sendYoutubeFeedback(parameters.panel, 1); toast(text.blocked);
      } else toast(text.unavailable);
    } else if (action === 'NIAK_BLOCK_CHANNEL') {
      if (parameters && blockChannel(parameters.channel)) toast(text.blocked);
      else toast(text.unavailable);
    } else if (action === 'NIAK_MANAGE_FILTERS') showManage(false);
    else if (action === 'NIAK_CLEAR_VIDEOS') {
      var s = readState(); s.hiddenVideos = []; writeState(s); toast(text.restored); showManage(true);
    } else if (action === 'NIAK_CLEAR_CHANNELS') {
      var s2 = readState(); s2.blockedChannels = []; s2.channelNames = {}; writeState(s2); toast(text.restored); showManage(true);
    } else if (action === 'NIAK_UNBLOCK_CHANNEL') {
      var s3 = readState(), k = parameters && parameters.key;
      s3.blockedChannels = s3.blockedChannels.filter(function (v) { return v !== k; });
      delete s3.channelNames[k]; writeState(s3); toast(text.restored); showManage(true);
    }
  }
  function isNiakCommand(command) {
    var a = actionOf(command);
    return a && typeof a.action === 'string' && a.action.indexOf('NIAK_') === 0 ? a : null;
  }
  function wrapResolver(original) {
    if (original.__niakFiltersPatched) return original;
    var wrapped = function (cmd) {
      var direct = isNiakCommand(cmd) ||
        cmd && cmd.innertubeCommand && isNiakCommand(cmd.innertubeCommand);
      if (direct) {
        handle(direct.action, direct.parameters);
        return true;
      }
      var executor = cmd && cmd.commandExecutorCommand;
      if (executor && Array.isArray(executor.commands)) {
        var pending = [], local = false;
        executor.commands.forEach(function (command) {
          var a = isNiakCommand(command);
          if (a) { handle(a.action, a.parameters); local = true; }
          else pending.push(command);
        });
        if (local) {
          if (!pending.length) return true;
          var forwarded = Object.assign({}, cmd, {
            commandExecutorCommand: Object.assign({}, executor, { commands: pending })
          });
          return original.call(this, forwarded, arguments[1]);
        }
      }
      return original.apply(this, arguments);
    };
    wrapped.__niakFiltersPatched = true;
    return wrapped;
  }
  function guardResolver(instance) {
    var original = instance.resolveCommand;
    if (instance.__niakResolverGuard) return;
    var descriptor = Object.getOwnPropertyDescriptor(instance, 'resolveCommand');
    if (descriptor && !descriptor.configurable) {
      if (!original.__niakFiltersPatched && descriptor.writable)
        instance.resolveCommand = wrapResolver(original);
      return;
    }
    // Each instance needs its own closure; the YouTube TV runtime can expose
    // multiple resolvers at once.
    var current = wrapResolver(original);
    try {
      Object.defineProperty(instance, 'resolveCommand', {
        configurable: true, enumerable: descriptor ? descriptor.enumerable : true,
        get: function () { return current; },
        set: function (next) {
          if (typeof next === 'function' && next !== current)
            current = wrapResolver(next);
        }
      });
      Object.defineProperty(instance, '__niakResolverGuard', {
        value: true, configurable: true
      });
    } catch (error) {
      try { instance.resolveCommand = current; }
      catch (unwritable) { console.warn('Niak filters: resolver not patchable', unwritable); }
    }
  }
  function installCommandPatch() {
    var instances = findResolve();
    for (var i = 0; i < instances.length; i++) {
      guardResolver(instances[i]);
    }
  }
  // The first Home feed may be supplied as a pre-parsed global, unlike
  // subsequent network responses handled by JSON.parse.
  // Leave pre-existing accessors or non-configurable globals alone.
  function installInitialFeedHook() {
    var descriptor = Object.getOwnPropertyDescriptor(window, 'ytInitialData');
    if (descriptor && (!descriptor.configurable || !descriptor.writable ||
        descriptor.get || descriptor.set)) return;
    var initialData = descriptor ? descriptor.value : undefined;
    try {
      Object.defineProperty(window, 'ytInitialData', {
        configurable: true, enumerable: descriptor ? descriptor.enumerable : true,
        get: function () { return initialData; },
        set: function (data) {
          try { decoratePayload(data); }
          catch (error) { console.warn('Niak filters: initial Home feed unavailable', error); }
          initialData = data;
        }
      });
      if (initialData) decoratePayload(initialData);
    } catch (error) {
      console.warn('Niak filters: initial Home hook unavailable', error);
    }
  }
  installInitialFeedHook();
  installCommandPatch();
  var lastInitialFeed = null;
  function inspectInitialFeed() {
    // Some clients expose ytInitialData through a non-configurable getter, or
    // replace it after our document-start hook. Never overwrite those globals.
    try {
      var data = window.ytInitialData;
      if (data && typeof data === 'object' && data !== lastInitialFeed) {
        decoratePayload(data);
        lastInitialFeed = data;
      }
    } catch (error) { console.warn('Niak filters: Home feed inspection unavailable', error); }
  }
  inspectInitialFeed();
  window.setInterval(function () {
    installCommandPatch();
    inspectInitialFeed();
  }, 1500);
})();

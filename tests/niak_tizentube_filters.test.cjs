// Small representative YouTube TV renderer/command integration tests.
// Run: node --test cobalt/shell/embedded_resources/cobalt_java_script_polyfill/niak_tizentube_filters.test.cjs
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const script = fs.readFileSync(path.join(__dirname, '../cobalt/shell/embedded_resources/cobalt_java_script_polyfill/niak_tizentube_filters.js'), 'utf8');
const VIDEO = 'abcDEF12345';
const CHANNEL = 'UC' + 'z'.repeat(22);
function boot(hostname = 'www.youtube.com') {
  const storage = new Map();
  let storageReads = 0;
  const ticks = [];
  const outgoing = [];
  const window = {
    location: { hostname, hash: '#/' },
    localStorage: {
      getItem: (key) => { storageReads++; return storage.has(key) ? storage.get(key) : null; },
      setItem: (key, value) => storage.set(key, value)
    },
    setInterval: (fn) => { ticks.push(fn); },
    _yttv: { live: { instance: { resolveCommand: (cmd) => { outgoing.push(cmd); return false; } } } }
  };
  const context = vm.createContext({ window, navigator: { language: 'fr-FR' }, console });
  // In a browser window.JSON === JSON; the vm fixture must mirror that.
  window.JSON = vm.runInContext('JSON', context);
  vm.runInContext(script, context, { filename: 'niak_tizentube_filters.js' });
  ticks.forEach((fn) => fn());
  return {
    window, storage, outgoing, storageReads: () => storageReads, parse: (data) => vm.runInContext('JSON.parse', context)(JSON.stringify(data)),
    command: (action, parameters) => window._yttv.live.instance.resolveCommand({
      playlistEditEndpoint: { customAction: { action, parameters } }
    })
  };
}
function tile(id = VIDEO, channelName = 'Test Channel') {
  return { tileRenderer: {
    style: 'TILE_STYLE_YTLR_DEFAULT',
    contentId: id,
    onSelectCommand: { watchEndpoint: { videoId: id } },
    metadata: { tileMetadataRenderer: {
      lines: [{ lineRenderer: { items: [{ lineItemRenderer: {
        text: { simpleText: channelName, browseEndpoint: { browseId: CHANNEL } }
      } }] } }]
    } },
    header: { tileHeaderRenderer: { thumbnail: { thumbnails: [
      { url: 'https://i.ytimg.com/vi/' + id + '/hqdefault.jpg' }
    ] } } }
  } };
}
function response(items) {
  return { contents: { tvBrowseRenderer: { content: { tvSurfaceContentRenderer: {
    content: { sectionListRenderer: { contents: [
      { shelfRenderer: { content: { horizontalListRenderer: { items } } } }
    ] } }
  } } } } };
}
function itemsOf(r) {
  return r.contents.tvBrowseRenderer.content.tvSurfaceContentRenderer.content
    .sectionListRenderer.contents[0].shelfRenderer.content.horizontalListRenderer.items;
}
function menuOf(item) {
  return item.tileRenderer.onLongPressCommand.showMenuCommand.menu.menuRenderer.items;
}
function actionsOf(items) {
  return Array.from(items, (x) => x?.menuServiceItemRenderer?.serviceEndpoint?.playlistEditEndpoint?.customAction?.action).filter(Boolean);
}

test('APK filter adds the 4 Cobalt long-press actions to a real-style video tile', () => {
  const app = boot();
  const r = app.parse(response([tile()]));
  assert.deepEqual(actionsOf(menuOf(itemsOf(r)[0])), [
    'NIAK_NOT_INTERESTED', 'NIAK_DONT_RECOMMEND', 'NIAK_BLOCK_CHANNEL', 'NIAK_MANAGE_FILTERS'
  ]);
  assert.equal(menuOf(itemsOf(r)[0])[0].menuNavigationItemRenderer.navigationEndpoint.watchEndpoint.videoId, VIDEO);
});
test('Not interested hides matching video on subsequent recommendations and persists', () => {
  const app = boot();
  app.command('NIAK_NOT_INTERESTED', { videoId: VIDEO });
  assert.equal(itemsOf(app.parse(response([tile(), tile('otherVIDEO1')]))).length, 1);
  const state = JSON.parse(app.storage.get('niak-tizentube-filters-v1'));
  assert.deepEqual(state.hiddenVideos, [VIDEO]);
});
test('Channel block filters video tiles by id but keeps non-video items', () => {
  const app = boot();
  app.command('NIAK_BLOCK_CHANNEL', { channel: { id: CHANNEL, name: 'Test Channel' } });
  const items = itemsOf(app.parse(response([tile(), { shelfDividerRenderer: {} }])));
  assert.equal(items.length, 1);
  assert.ok(items[0].shelfDividerRenderer);
});
test('History, library and playlists remain visible after blocking', () => {
  const app = boot();
  app.command('NIAK_NOT_INTERESTED', { videoId: VIDEO });
  for (const hash of ['#/browse?browseId=FElibrary', '#/browse?browseId=FEhistory', '#/playlist?list=PL1']) {
    app.window.location.hash = hash;
    assert.equal(itemsOf(app.parse(response([tile()]))).length, 1, hash);
  }
});
test('Manage dialog can unblock one channel and restore hidden videos', () => {
  const app = boot();
  app.command('NIAK_BLOCK_CHANNEL', { channel: { id: CHANNEL, name: 'Test Channel' } });
  app.command('NIAK_NOT_INTERESTED', { videoId: VIDEO });
  app.command('NIAK_MANAGE_FILTERS');
  assert.ok(app.outgoing.some((x) => x?.openPopupAction?.popupType === 'MODAL'));
  app.command('NIAK_UNBLOCK_CHANNEL', { key: 'id:' + CHANNEL });
  app.command('NIAK_CLEAR_VIDEOS');
  const state = JSON.parse(app.storage.get('niak-tizentube-filters-v1'));
  assert.equal(state.blockedChannels.length, 0);
  assert.equal(state.hiddenVideos.length, 0);
});
test('Existing context menu gets actions only once', () => {
  const app = boot();
  const item = tile();
  item.tileRenderer.onLongPressCommand = { showMenuCommand: { menu: {
    menuRenderer: { items: [{ menuServiceItemRenderer: { text: { runs: [{ text: 'Save' }] } } }] }
  } } };
  const first = app.parse(response([item]));
  const already = itemsOf(first)[0];
  const again = app.parse(response([already]));
  assert.equal(actionsOf(menuOf(itemsOf(again)[0])).filter((x) => x === 'NIAK_NOT_INTERESTED').length, 1);
});
test('Engagement panel remains available when a long-press menu is synthesized', () => {
  const app = boot();
  const item = tile();
  item.tileRenderer.onLongPressCommand = {
    showEngagementPanelEndpoint: {
      identifier: { tag: 'engagement-panel' },
      globalConfiguration: { params: 'feed-context' }
    }
  };
  const r = app.parse(response([item]));
  const menu = menuOf(itemsOf(r)[0]);
  const hide = menu.find((m) =>
    m?.menuServiceItemRenderer?.serviceEndpoint?.playlistEditEndpoint?.customAction?.action === 'NIAK_NOT_INTERESTED');
  assert.equal(hide.menuServiceItemRenderer.serviceEndpoint.playlistEditEndpoint.customAction.parameters.panel.panelId, 'engagement-panel');
});
test('Blocked channel dialog updates in place after individual unblock', () => {
  const app = boot();
  app.command('NIAK_BLOCK_CHANNEL', { channel: { id: CHANNEL, name: 'Test Channel' } });
  app.command('NIAK_MANAGE_FILTERS');
  app.command('NIAK_UNBLOCK_CHANNEL', { key: 'id:' + CHANNEL });
  const modals = app.outgoing.filter((x) => x?.openPopupAction?.popupType === 'MODAL');
  assert.equal(modals.length, 2);
  assert.equal(modals[1].openPopupAction.updateAction, true);
  assert.equal(modals[1].openPopupAction.shouldMatchUniqueId, true);
});
test('Corrupt storage is ignored, non-YouTube origins are never patched', () => {
  const app = boot();
  app.storage.set('niak-tizentube-filters-v1', '{broken');
  assert.equal(itemsOf(app.parse(response([tile()]))).length, 1);
  const outside = boot('example.com');
  assert.equal(outside.window.__niakTizenTubeFiltersV1, undefined);
  assert.equal(outside.window._yttv.live.instance.resolveCommand({
    playlistEditEndpoint: { customAction: { action: 'NIAK_NOT_INTERESTED', parameters: { videoId: VIDEO } } }
  }), false);
});

test('Unrelated player JSON bypasses recommendation traversal', () => {
  const app = boot();
  const before = app.storageReads();
  const data = { contents: { player: { stats: new Array(1000).fill('x') } } };
  assert.deepEqual(JSON.parse(JSON.stringify(app.parse(data))), data);
  assert.equal(app.storageReads(), before);
});

test('One network response with multiple shelves reads each preference key once', () => {
  const app = boot();
  const input = response([tile()]);
  input.contents.tvBrowseRenderer.content.tvSurfaceContentRenderer.content
    .sectionListRenderer.contents.push({
      shelfRenderer: { content: { horizontalListRenderer: { items: [tile('otherVIDEO1')] } } }
    });
  const before = app.storageReads();
  app.parse(input);
  // One recommendation-state read + one ad-block setting read, not per shelf.
  assert.equal(app.storageReads() - before, 2);
});

test('Modern lockupViewModel supports long-press and locally blocked channels', () => {
  const app = boot();
  const lockup = { lockupViewModel: {
    contentType: 'LOCKUP_CONTENT_TYPE_VIDEO', contentId: VIDEO,
    rendererContext: { commandContext: { onTap: {
      innertubeCommand: { watchEndpoint: { videoId: VIDEO } }
    } } },
    metadata: { lockupMetadataViewModel: {
      title: { content: 'Modern video' },
      metadata: { contentMetadataViewModel: { metadataRows: [{ metadataParts: [{
        text: { content: 'Test Channel', browseEndpoint: { browseId: CHANNEL } }
      }] }] } }
    } }
  } };
  const first = app.parse(response([lockup]));
  const model = itemsOf(first)[0].lockupViewModel;
  const items = model.rendererContext.commandContext.onLongPress.innertubeCommand
    .showMenuCommand.menu.menuRenderer.items;
  assert.ok(actionsOf(items).includes('NIAK_BLOCK_CHANNEL'));
  app.command('NIAK_BLOCK_CHANNEL', { channel: { id: CHANNEL, name: 'Test Channel' } });
  assert.equal(itemsOf(app.parse(response([lockup]))).length, 0);
});

test('Known ad slot structures are removed from home shelves and continuations', () => {
  const app = boot();
  const ad = { adSlotRenderer: { slotId: 'paid-masthead' } };
  const input = response([tile(), ad]);
  input.contents.tvBrowseRenderer.content.tvSurfaceContentRenderer.content
    .sectionListRenderer.contents.push(ad, {
      shelfRenderer: { title: {simpleText: 'Featured'}, content: {
        horizontalListRenderer: {items: [tile('otherVIDEO1')]}
      } }
    });
  const result = app.parse(input);
  const sections = result.contents.tvBrowseRenderer.content.tvSurfaceContentRenderer.content
    .sectionListRenderer.contents;
  assert.equal(sections.some((entry) => !!entry.adSlotRenderer), false);
  assert.equal(itemsOf(result).length, 1);
  assert.equal(sections.length, 2, 'non-ad editorial shelves must be preserved');

  const continuation = app.parse({continuationContents: {
    horizontalListContinuation: {items: [ad, tile()]}
  }});
  assert.equal(continuation.continuationContents.horizontalListContinuation.items.length, 1);
});

test('Explicit TizenTube ad-block off preserves ad slots', () => {
  const app = boot();
  app.storage.set('ytaf-configuration', JSON.stringify({enableAdBlock: false}));
  const ad = {adSlotRenderer: {slotId: 'paid'}};
  const input = response([tile(), ad]);
  input.contents.tvBrowseRenderer.content.tvSurfaceContentRenderer.content
    .sectionListRenderer.contents.push(ad);
  const result = app.parse(input);
  const sections = result.contents.tvBrowseRenderer.content.tvSurfaceContentRenderer.content
    .sectionListRenderer.contents;
  assert.equal(itemsOf(result).length, 2);
  assert.equal(sections.some((entry) => !!entry.adSlotRenderer), true);
});

test('Live player ad markers are removed without touching actual streaming data', () => {
  const app = boot();
  const response = {
    videoDetails: { videoId: VIDEO, isLiveContent: true },
    adPlacements: [{adPlacementRenderer: {config: {offsetStartMilliseconds: 60000}}}],
    adSlots: [{adSlotRenderer: {slotId: 'live-preroll'}}],
    playerAds: {playerLegacyDesktopWatchAdsRenderer: {}},
    streamingData: {
      adaptiveFormats: [{itag: 140, mimeType: 'audio/mp4', url: 'https://stream.example/audio'}],
      expiresInSeconds: '21540'
    },
    playbackContext: {contentPlaybackContext: {vis: 0}}
  };
  const output = app.parse(response);
  assert.deepEqual(Array.from(output.adPlacements), []);
  assert.deepEqual(Array.from(output.adSlots), []);
  assert.equal(output.playerAds, false);
  assert.equal(output.streamingData.adaptiveFormats[0].itag, 140);
  assert.equal(output.streamingData.adaptiveFormats[0].url, 'https://stream.example/audio');
  assert.equal(output.playbackContext.contentPlaybackContext.vis, 0);
});

test('Live ad markers remain when the user disables the ad blocker', () => {
  const app = boot();
  app.storage.set('ytaf-configuration', JSON.stringify({enableAdBlock: false}));
  const response = {
    adPlacements: [{adPlacementRenderer: {}}],
    adSlots: [{adSlotRenderer: {}}],
    playerAds: true,
    streamingData: {formats: [{itag: 18}]}
  };
  const output = app.parse(response);
  assert.equal(output.adPlacements.length, 1);
  assert.equal(output.adSlots.length, 1);
  assert.equal(output.playerAds, true);
  assert.equal(output.streamingData.formats[0].itag, 18);
});

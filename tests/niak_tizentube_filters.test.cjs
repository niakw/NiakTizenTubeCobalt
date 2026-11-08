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
  const ticks = [];
  const outgoing = [];
  const window = {
    location: { hostname, hash: '#/' },
    localStorage: {
      getItem: (key) => storage.has(key) ? storage.get(key) : null,
      setItem: (key, value) => storage.set(key, value)
    },
    setInterval: (fn) => { ticks.push(fn); },
    _yttv: { live: { instance: { resolveCommand: (cmd) => { outgoing.push(cmd); return false; } } } }
  };
  const context = vm.createContext({ window, navigator: { language: 'fr-FR' }, console });
  vm.runInContext(script, context, { filename: 'niak_tizentube_filters.js' });
  ticks.forEach((fn) => fn());
  return {
    window, storage, outgoing, parse: (data) => vm.runInContext('JSON.parse', context)(JSON.stringify(data)),
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
  return items.map((x) => x?.menuServiceItemRenderer?.serviceEndpoint?.playlistEditEndpoint?.customAction?.action).filter(Boolean);
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

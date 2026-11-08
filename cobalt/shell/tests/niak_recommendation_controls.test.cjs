// Regression tests for Niak TizenTube Cobalt recommendation controls.
// Run: node --test cobalt/shell/tests/niak_recommendation_controls.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const script = fs.readFileSync(path.join(__dirname, '../embedded_resources/cobalt_java_script_polyfill/niak_recommendation_controls.js'), 'utf8');
const VIDEO_A = 'videoABC123';
const VIDEO_B = 'videoXYZ456';
const CHANNEL_ID = 'UCabcdefghijklmnopqrstuv';

function tile(id, name = 'Example creator') {
  return { tileRenderer: {
    style: 'TILE_STYLE_YTLR_DEFAULT',
    contentId: id,
    metadata: {tileMetadataRenderer: {
      title: {simpleText: 'Example Video'},
      lines: [{lineRenderer: {items: [{lineItemRenderer: {text: {
        runs: [{text: name, navigationEndpoint: {browseEndpoint: {browseId: CHANNEL_ID}}}]
      }}}]}}]
    }},
    onSelectCommand: {watchEndpoint: {videoId: id}}
  }};
}

function setup(hash = '#/') {
  const storage = {};
  let onInterval = () => {};
  const window = {
    location: {hostname: 'www.youtube.com', hash},
    localStorage: {
      getItem: key => storage[key] || null,
      setItem: (key, value) => { storage[key] = value; }
    },
    setInterval: callback => { onInterval = callback; return 7; },
    clearInterval: () => {},
    setTimeout: () => {},
    addEventListener: () => {},
    _yttv: {}
  };
  const context = vm.createContext({window, document: {body: null}, console});
  vm.runInContext(script, context);
  window.JSON = vm.runInContext('JSON', context);
  return {window, storage, hook: () => onInterval()};
}

function menu(item) {
  return item.tileRenderer.onLongPressCommand.showMenuCommand.menu.menuRenderer.items;
}
function action(items, actionName) {
  const value = items.find(item =>
    item.menuServiceItemRenderer?.serviceEndpoint?.playlistEditEndpoint?.customAction?.action === actionName);
  return value?.menuServiceItemRenderer.serviceEndpoint;
}

test('video tiles get long-press actions and preserve the play command', () => {
  const {window} = setup();
  const response = window.JSON.parse(JSON.stringify({contents: {shelfRenderer: {content: {
    horizontalListRenderer: {items: [tile(VIDEO_A)]}
  }}}}));
  const item = response.contents.shelfRenderer.content.horizontalListRenderer.items[0];
  assert.ok(action(menu(item), 'NIAK_HIDE_VIDEO'));
  assert.ok(action(menu(item), 'NIAK_BLOCK_CHANNEL'));
  assert.ok(action(menu(item), 'NIAK_MANAGE_HIDDEN'));
  assert.equal(menu(item)[0].menuNavigationItemRenderer.navigationEndpoint.watchEndpoint.videoId, VIDEO_A);
});

test('hiding one video preserves other videos and non-video rows', () => {
  const {window, hook, storage} = setup();
  const instance = {resolveCommand: () => false};
  window._yttv.client = {instance};
  hook();
  const data = {shelfRenderer: {content: {horizontalListRenderer: {
    items: [tile(VIDEO_A), tile(VIDEO_B), {guideEntryRenderer: {title: 'Keep me'}}]
  }}}};
  const first = window.JSON.parse(JSON.stringify(data));
  assert.equal(instance.resolveCommand(action(menu(first.shelfRenderer.content.horizontalListRenderer.items[0]), 'NIAK_HIDE_VIDEO')), true);
  assert.match(Object.keys(storage)[0], /niak\.tizentube/);
  const next = window.JSON.parse(JSON.stringify(data));
  assert.equal(next.shelfRenderer.content.horizontalListRenderer.items.length, 2);
  assert.equal(next.shelfRenderer.content.horizontalListRenderer.items[0].tileRenderer.contentId, VIDEO_B);
  assert.ok(next.shelfRenderer.content.horizontalListRenderer.items[1].guideEntryRenderer);
});

test('channel blocking removes its recommendations but never library items', () => {
  const {window, hook} = setup();
  const instance = {resolveCommand: () => false};
  window._yttv.client = {instance};
  hook();
  const first = window.JSON.parse(JSON.stringify({items: [tile(VIDEO_A)]}));
  assert.equal(instance.resolveCommand(action(menu(first.items[0]), 'NIAK_BLOCK_CHANNEL')), true);
  assert.equal(window.JSON.parse(JSON.stringify({items: [tile(VIDEO_A)]})).items.length, 0);
  window.location.hash = '#/browse?browseId=FElibrary';
  assert.equal(window.JSON.parse(JSON.stringify({items: [tile(VIDEO_A)]})).items.length, 1);
});

test('does not duplicate actions and does not inject outside YouTube', () => {
  const {window} = setup();
  const first = window.JSON.parse(JSON.stringify({items: [tile(VIDEO_A)]}));
  const second = window.JSON.parse(JSON.stringify({items: [first.items[0]]}));
  assert.equal(menu(second.items[0]).filter(item =>
    item.menuServiceItemRenderer?.serviceEndpoint?.playlistEditEndpoint?.customAction?.action === 'NIAK_HIDE_VIDEO').length, 1);
  const unrelated = {location: {hostname: 'other.example'}, localStorage: {getItem: () => null}};
  vm.runInNewContext(script, {window: unrelated, console});
  assert.equal(unrelated.__niakRecommendationControlsLoaded, undefined);
});

test('existing video menus are augmented, not replaced', () => {
  const {window} = setup();
  const item = tile(VIDEO_A);
  const original = {menuServiceItemRenderer: {text: {runs: [{text: 'Original'}]}}};
  item.tileRenderer.onLongPressCommand = {showMenuCommand: {menu: {menuRenderer: {items: [original]}}}};
  const result = window.JSON.parse(JSON.stringify({items: [item]})).items[0];
  assert.equal(menu(result)[0].menuServiceItemRenderer.text.runs[0].text, 'Original');
  assert.ok(action(menu(result), 'NIAK_HIDE_VIDEO'));
});

# Niak fork — Android TV video/channel hiding

**Status: Cobalt source integrated; 21 targeted Node checks and 10 Java updater tests green; Android APK/device validation not yet performed.**

The one active implementation is:

- `cobalt/shell/embedded_resources/cobalt_java_script_polyfill/niak_tizentube_filters.js`
- `cobalt/shell/BUILD.gn`: declares this script as an input for `embed_polyfilled_javascript`
- `cobalt/shell/browser/shell.cc`: registers packaged JavaScript at document start
- `tests/niak_tizentube_filters.test.cjs`: contract tests for YouTube TV tile menus, local storage, filtering and dialogs
- `.github/workflows/niak-cobalt-filters.yml`: sparse-checkout CI for JS/GN source contracts plus 10 real Java downloader JUnit tests (no native Cobalt APK build)

A separate experimental recommendation script and redundant test workflow were removed to avoid conflicting JSON hooks and duplicate context menu entries. Only the implementation above is shipped. The source now also restricts this script to YouTube HTTPS origins and avoids scanning non-recommendation JSON responses.

## Features and controls

With a video tile selected on the YouTube TV home page, **hold OK** for the long-press context menu:

| UI control | Behavior |
| --- | --- |
| **Pas intéressé / Not interested** | Hide the selected video locally; attempt Google feedback only when a valid engagement panel was available |
| **Ne pas recommander cette chaîne / Don't recommend this channel** | Block its video recommendations locally; optionally submit feedback using YouTube's panel tokens |
| **Bloquer cette chaîne / Block channel** | Block locally by stable channel ID; fall back to channel name |
| **Gérer les vidéos et chaînes masquées / Manage hidden videos and channels** | Restore all hidden videos, unblock all channels or unblock channels individually |

Preferences are saved in YouTube TV localStorage on that device under `niak-tizentube-filters-v1`; hidden video IDs are capped at 1,000 and channel entries at 250. Labels are available in French and English. No separate app or JavaScript addon install is required **once an APK has been built from this fork**.

The script augments existing long-press menu commands where present and synthesizes a minimal menu if a supported tile lacks one. Filtering is applied when YouTube TV parses a refreshed recommendation grid/shelf/continuation. Already-rendered items may remain visible until the next refresh. History, personal library and playlists are explicitly exempt.

## Differences from upstream PR #720

[reisxd/TizenTube PR #720](https://github.com/reisxd/TizenTube/pull/720) modifies a **different repository**, the separately distributed TizenTube JavaScript userscript. This fork implements similar behavior within Cobalt's embedded document-start JavaScript, without merging or replacing that upstream project.

The attempt to send YouTube feedback uses the official runtime's `KabukiInnerTubeClient` when an engagement panel/token is available. **Feedback success and the "Tell us why" reasons dialog are not guaranteed**; local filtering works without those endpoints. A blocked channel in this fork is not necessarily a block in your Google account.

## How to validate

The lightweight CI runs:

```sh
node --check cobalt/shell/embedded_resources/cobalt_java_script_polyfill/niak_tizentube_filters.js
node --test tests/niak_tizentube_filters.test.cjs
python3 cobalt/build/generate_data_header.py CobaltJavaScriptPolyfill /tmp/niak-embedded-js.h cobalt/shell/embedded_resources/cobalt_java_script_polyfill
```

It verifies syntax, menu structure, persistence, exemptions, channel/video blocking, modal management and that Node tests are not accidentally embedded in the APK. The CI is intentionally light: it does not compile the native Cobalt runtime.

[Niak Cobalt video filters workflow](https://github.com/niakw/TizenTubeCobalt/actions/workflows/niak-cobalt-filters.yml)

For final device qualification, build **this fork** as an Android TV APK, sign it, install it on the TV, then test long-press, menu focus/Back navigation, both tile and lockup formats, all four actions, persistence after restart, and coexistence with SponsorBlock/ad blocking. **Do not use the upstream release APK to test these fork changes**: it does not contain them.

The runtime still depends on the separately distributed TizenTube userscript for its other features; the source integration here does not resolve upstream's remote-userscript integrity issue.

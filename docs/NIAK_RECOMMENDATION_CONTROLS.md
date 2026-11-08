# Niak fork — Android TV recommendation controls

Status: **source integrated in Cobalt; runtime APK not yet built or verified on a TV**.

This fork embeds an additional, origin-gated document-start script in Cobalt:
\`cobalt/shell/embedded_resources/cobalt_java_script_polyfill/niak_recommendation_controls.js\`.

Cobalt already uses \`cobalt/shell:embed_polyfilled_javascript\` to embed all scripts
in that directory; \`Shell::RegisterInjectedJavaScript()\` installs them at
document start. The script runs only when the web page host is
\`www.youtube.com\` or \`m.youtube.com\`.

## Features

On a YouTube TV recommendation tile, **long-press OK** to access:

- **Pas intéressé (masquer)** — hide the selected video on this TV.
- **Ne plus recommander cette chaîne (local)** — locally suppress recommendations from that channel.
- **Bloquer cette chaîne** — same local channel block, with a separate explicit action.
- **Gérer les vidéos et chaînes masquées** — a remote-friendly dialog to clear the list of hidden videos or unblock individual channels.

The script supports the two current YouTube TV response shapes:
\`tileRenderer\` and \`lockupViewModel\`. It filters recommendation grids,
horizontal shelves and continuation lists, while deliberately preserving
library, history and playlist entries. It augments existing long-press menus
rather than replacing them. To see the filtered results after choosing an action,
refresh or revisit the recommendations.

Lists live in YouTube TV's **localStorage on the device** under
\`niak.tizentube.recommendations.v1\`. The saved data contains video IDs and
channel IDs/names only; hidden videos are capped at 1,000 and blocked
channels at 500. This is *not* a Google account preference and does
not send \`Not interested\` feedback to YouTube servers.

## Integration and limitations

The enhancement is embedded in the Cobalt application at native build time:
it does **not** require installing another standalone APK or browser extension.
It coexists with TizenTube's separately distributed userscript, which still
supplies ad blocking, SponsorBlock and most other UI functions.

This is a **local port inspired by
[reisxd/TizenTube PR #720](https://github.com/reisxd/TizenTube/pull/720)**,
rather than an unmodified merge of that PR (whose files belong to a different
repository). The original PR can also submit YouTube feedback when tokens exist;
the embedded Cobalt port intentionally does not claim that remote feature.

The existing official APKs linked from this repository's README are **not
built from this fork** and will not contain this code. Source tests cannot
prove the Cobalt/Android TV runtime integration or real remote-controller
behavior; those checks still need a signed fork APK and a device test.

## Tests

\`\`\`sh
node --check cobalt/shell/embedded_resources/cobalt_java_script_polyfill/niak_recommendation_controls.js
node --test cobalt/shell/tests/niak_recommendation_controls.test.cjs
\`\`\`

A sparse GitHub Actions check runs these tests without cloning or compiling
the entire Chromium/Cobalt tree.

## Further work

- Qualify menu rendering, focus and remote BACK behavior on the actual TV.
- Verify script coexistence with the current released TizenTube userscript.
- Build and sign a fork-specific Cobalt APK, then distribute it separately.
- Consider upstream's native YouTube feedback integration if it can be made
  reliable and tested on the target YouTube TV client.

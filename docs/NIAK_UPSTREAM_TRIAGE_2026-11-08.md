# TizenTube Cobalt fork — upstream triage (2026-11-08)

**Snapshot:** fork `niakw/TizenTubeCobalt`, main `5394e8577499d05062c59030b99e32a1539af804`. Recheck heads and CI before implementing any entry. This document tracks **work outstanding**, not bugs fixed by merely adding documentation.

## Pull requests

| Upstream | Status on this fork | Next action |
| --- | --- | --- |
| [#293](https://github.com/reisxd/TizenTubeCobalt/pull/293) Linux/Android GN dependency | Ported on main, commit `71ed496` | Requires full target build verification |
| [#381](https://github.com/reisxd/TizenTubeCobalt/pull/381) Arabic glyph clipping | Ported on main, commit `f487e19` | Requires Android TV font render validation |
| [#288](https://github.com/reisxd/TizenTubeCobalt/pull/288) persist `user_agent_override` | **Open / not ported**; upstream marked non-mergeable | Investigate unsupported-device/reloading symptom (#287), isolate persistence under current GlobalFeatures implementation, add restart regression test before porting |
| [#383](https://github.com/reisxd/TizenTubeCobalt/pull/383) unnamed Android rendering/key handling patch | **Open / not ported** | Requires dedicated review: touches CobaltActivity input events, video surface visibility and first-frame audio/video sync. No blanket merge until playback and remote BACK tested |
| [#385](https://github.com/reisxd/TizenTubeCobalt/pull/385) updater progress/retry/install flow | **Open / not ported** | Useful separate workstream; 9 files, Android installer/security surface; verify full GN, signing and TV installation |
| [#382](https://github.com/reisxd/TizenTubeCobalt/pull/382) home rows/Continue Watching | **Open / not ported** | Optional UI feature requiring companion JS changes; not a connectivity fix |

The PR for local video/channel masking is [TizenTube #720](https://github.com/reisxd/TizenTube/pull/720) in a **different JavaScript repo**. A locally embedded, independently adapted implementation is present in this fork, with [scope and limits](NIAK_RECOMMENDATION_CONTROLS.md). It does not imply that the upstream PR was merged.

## Priority issues relevant to Android TV

| Priority | Issue | Working diagnosis / acceptance criteria |
| --- | --- | --- |
| **P0 security** | [#374](https://github.com/reisxd/TizenTubeCobalt/issues/374) remotely loaded mutable userscript | Audit where userscript is loaded and whether its integrity is checked. Prefer signed APK-bundled bytes or an immutable version with hash verification and fail-closed behavior. Do **not** claim fixed by bundling the local *recommendation* script alone; the main userscript is separate |
| **P1 playback** | [#320](https://github.com/reisxd/TizenTubeCobalt/issues/320) videos freezing, [#367](https://github.com/reisxd/TizenTubeCobalt/issues/367) UI stuttering, [#258](https://github.com/reisxd/TizenTubeCobalt/issues/258) crashes | Reproduce with exact Android TV device/version, APK architecture and 1080p versus 4K. Capture timing, codec, player errors, logcat, dropped frames, playback retry and whether YouTube official app behaves differently. Investigate video renderer **without** automatically applying #383 |
| **P1 connectivity** | [#287](https://github.com/reisxd/TizenTubeCobalt/issues/287) user-agent override not persisted, [#369](https://github.com/reisxd/TizenTubeCobalt/issues/369) network error | Distinguish Android TV session/streaming failures from Samsung/Tizen proxy startup reports. Issue #369 currently reports a Samsung device, so it is **not evidence** that an Android TV streaming error has the same root cause. No speculative network retry loop |
| **P1 in-stream ads** | [#378](https://github.com/reisxd/TizenTubeCobalt/issues/378) skippable ads in live streams | Reproduce on a live stream, identify the player/InnerTube payload and client version; test ad suppression while preserving playback and video position |
| **P2 home ads** | [#386](https://github.com/reisxd/TizenTubeCobalt/issues/386) featured/sponsored home cards | Compare fresh YouTube TV JSON renderer shapes; filter only confidently identified advertising content and do not remove organic shelves blindly |
| **P2 history** | [#361](https://github.com/reisxd/TizenTubeCobalt/issues/361) viewing timestamps not saved with blockers | Validate watch progress/history under blocking before changing network request filtering |
| **P2 other** | [#390](https://github.com/reisxd/TizenTubeCobalt/issues/390) initial deep-link lost at cold start | Fix only with test exercising document replacement and consumption of initial deep link |

### Two different kinds of 'advertisement'

1. **Ads inserted by YouTube** (pre-roll, mid-roll, live ads, promoted home cards): ad blocking depends on the current client responses and is not 100% reliable. Reports #378 and #386 identify concrete gaps to investigate.
2. **Sponsorship segments read aloud *inside* a creator's video**: SponsorBlock uses a crowd-submitted segment database. If nobody has submitted the segment, no client can reliably skip it by querying SponsorBlock alone. Confirm enabled categories and report missing segments upstream rather than promising full automatic detection.

### Repro protocol before video/network changes

- Note device model, Android TV version, Cobalt version, whether wired or Wi-Fi, and whether a specific video consistently fails.
- Separate **buffering wheel**, **decoder freeze (picture stops while audio continues)**, **app crash**, **login/session loss**, and **automatic seeking/skipping of sponsored segments**; these have different causes.
- Compare the same problematic video with the official YouTube Android TV app.
- Compare 1080p against 4K/high frame rate and available codecs; log exact changes.
- Preserve sanitized Android `logcat` and statistics, but **do not publish** Google cookies, auth headers, user tokens or account identifiers.
- Before declaring fixed: exercise 30+ minutes of playback, seeking, switching videos, remote Back/OK, recovery from temporary network drop, session restore, history and live streams, on an actual Android TV device.

## Validation gates

- **Done:** Source-level local recommendation controls; targeted Node gate passed ([run](https://github.com/niakw/TizenTubeCobalt/actions/runs/42508882620)).
- **Not done:** Full Cobalt Android build, APK signing, actual device validation, #374 remote script integrity, and upstream #288/#382/#383/#385 porting.
- **GitHub Actions:** Past `autoroll_main.yaml` red runs came from an invalid empty schedule declaration; the fork has since replaced it with manual `workflow_dispatch`. Historical red runs are not proof that current source builds fail.

**Release policy:** Do not advertise the upstream download as containing fork changes, and do not mark issues resolved solely because synthetic tests pass.

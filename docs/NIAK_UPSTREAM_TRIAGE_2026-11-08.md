# TizenTube Cobalt fork — upstream triage (2026-11-08)

**Updated:** 2026-11-08, after the PR #288 / #383 / #385 source ports and the ad-slot filter changes. Recheck the current main SHA and CI when implementing further changes. Source integration and Android runtime qualification are separate states.

## Pull requests

| Upstream | Status on this fork | Next action |
| --- | --- | --- |
| [#293](https://github.com/reisxd/TizenTubeCobalt/pull/293) Linux/Android GN dependency | Ported on main, commit `71ed496` | Requires full target build verification |
| [#381](https://github.com/reisxd/TizenTubeCobalt/pull/381) Arabic glyph clipping | Ported on main, commit `f487e19` | Requires Android TV font render validation |
| [#288](https://github.com/reisxd/TizenTubeCobalt/pull/288) persist `user_agent_override` | **Adapted/ported on main**, `0563c4b`, C++ unit test `a58dc38` | Reboot/real-device persistence still unverified; upstream PR remains open |
| [#383](https://github.com/reisxd/TizenTubeCobalt/pull/383) Android rendering/key handling | **Ported on main**, `d52d280` / `d57cd0f` | Surface visibility, first decoded frame and real remote key behavior need a compiled APK and TV testing; not a proven fix for mid-stream network drops |
| [#385](https://github.com/reisxd/TizenTubeCobalt/pull/385) updater progress/retry/install flow | **Ported on main**, with Java-source GN integration corrected in `621ea03` | All **10 upstream downloader JUnit tests green**; needs full Android build, APK signing, installer and update-from-existing-version test. Companion frontend PR not integrated |
| [#382](https://github.com/reisxd/TizenTubeCobalt/pull/382) home rows/Continue Watching | **Open / not ported** | Optional UI feature requiring companion JS changes; not a connectivity fix |

The PR for local video/channel masking is [TizenTube #720](https://github.com/reisxd/TizenTube/pull/720) in a **different JavaScript repo**. A locally embedded, independently adapted implementation is present in this fork, with [scope and limits](NIAK_RECOMMENDATION_CONTROLS.md). It does not imply that the upstream PR was merged.

## Priority issues relevant to Android TV

| Priority | Issue | Working diagnosis / acceptance criteria |
| --- | --- | --- |
| **P0 security** | [#374](https://github.com/reisxd/TizenTubeCobalt/issues/374) remotely loaded mutable userscript | Audit where userscript is loaded and whether its integrity is checked. Prefer signed APK-bundled bytes or an immutable version with hash verification and fail-closed behavior. Do **not** claim fixed by bundling the local *recommendation* script alone; the main userscript is separate |
| **P1 playback** | [#320](https://github.com/reisxd/TizenTubeCobalt/issues/320) videos freezing, [#367](https://github.com/reisxd/TizenTubeCobalt/issues/367) UI stuttering, [#258](https://github.com/reisxd/TizenTubeCobalt/issues/258) crashes | PR #383 rendering/key patch ported; recommendation JSON processing made cheaper (`2e579294`). Neither is proof that network buffering or all freezes are resolved. Capture logcat, codecs, dropped frames and playback comparison on actual TV |
| **P1 connectivity** | [#287](https://github.com/reisxd/TizenTubeCobalt/issues/287) user-agent override not persisted, [#369](https://github.com/reisxd/TizenTubeCobalt/issues/369) network error | User-agent preference persistence implemented, but not reboot-tested on TV. #369 reports a Samsung/Tizen proxy symptom, not evidence for Android TV stream drops. Avoid speculative network retry loops |
| **P1 in-stream ads** | [#378](https://github.com/reisxd/TizenTubeCobalt/issues/378) skippable ads in live streams | Reproduce on a live stream, identify the player/InnerTube payload and client version; test ad suppression while preserving playback and video position |
| **P2 home ads** | [#386](https://github.com/reisxd/TizenTubeCobalt/issues/386) featured/sponsored home cards | Added a **conservative** backstop for known `adSlotRenderer` entries in nested shelves/continuations (`8380efb`), respecting the existing ad-block switch; unknown sponsored formats remain unverified |
| **P2 history** | [#361](https://github.com/reisxd/TizenTubeCobalt/issues/361) viewing timestamps not saved with blockers | Validate watch progress/history under blocking before changing network request filtering |
| **P2 other** | [#390](https://github.com/reisxd/TizenTubeCobalt/issues/390) initial deep-link lost at cold start | Source fix `a482c51`: moved initial-link consumption from transient object construction to the first JavaScript property read, memoized per document. Static source contract green; real cold-start external-link test still required |

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

- **Done at source/test level:** Video/channel blocking, user-agent persistence, Android surface/first-frame source port, safer updater, known ad-slot suppression, and lazy startup-link consumption. [21 Node contracts + 10 actual Java JUnit tests green](https://github.com/niakw/TizenTubeCobalt/actions/runs/42512086562).
- **Still outstanding:** Full Cobalt Android build and signed APK, TV remote/playback tests, #374 remote main userscript integrity, real live-stream ad capture (#378), cold-start deep-link device validation (#390), companion JS integration and optional home rows (#382).
- **GitHub Actions:** Past `autoroll_main.yaml` red runs came from an invalid empty schedule declaration; the fork has since replaced it with manual `workflow_dispatch`. Historical red runs are not proof that current source builds fail.

**Release policy:** Do not advertise the upstream download as containing fork changes, and do not mark issues resolved solely because synthetic tests pass.

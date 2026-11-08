# 💠 TizenTube Cobalt

<p align="center">
    <img width="600px" src=".github/assets/TizenTube Cobalt Banner.png">
    <br>
</p>

**TizenTube Cobalt** is an app based on [Cobalt](https://cobalt.dev) that enhances your favourite streaming website viewing experience by removing ads, adding [SponsorBlock](https://sponsor.ajay.app/) support, and providing useful features like video speed control.

<details>
<summary><strong>What is Cobalt?</strong></summary>

Cobalt is a lightweight, cross-platform application container and runtime for HTML5-based apps, originally developed by Google for embedded and resource-constrained devices (like smart TVs, set-top boxes, and game consoles). It implements a subset of the W3C HTML5 standard and runs web apps with high performance on a wide range of hardware.

</details>

## ✨ Features

- 🛑 **Ad Blocker**: Enjoy your favourite streaming website without interruptions from ads.
- ❗ **SponsorBlock Support**: Automatically skip sponsored segments in videos.
- ⏭️ **Video Speed Control**: Adjust playback speed to your preference.
- 🔺 **[DeArrow](https://dearrow.ajay.app/) Support**: Remove clickbait and misleading video titles.
- ➕ **More to come!** Request features via [issues](https://github.com/reisxd/TizenTube/issues/new).

> [!IMPORTANT]
> **Source fork:** the GitHub release links below point to the official upstream TizenTube Cobalt APKs, **not** builds of this fork. Commits made here are not included in those APKs. To use fork-specific changes, a separately built and signed APK is required; no fork-specific APK release is currently available.
>
> **Component boundary:** This fork now embeds an independent Cobalt-side port of the video/channel hiding controls described in [TizenTube PR #720](https://github.com/reisxd/TizenTube/pull/720). It is not a merge of the TizenTube JavaScript PR and does not replace the upstream userscript. More advanced upstream feedback prompts may differ.

## Niak fork: local recommendation controls

This fork adds a **document-start JavaScript extension bundled into the Cobalt APK**. On a recommended video tile, **long-press OK** and select:

- **Not interested / Pas intéressé** — hide that video locally.
- **Don't recommend this channel / Ne pas recommander cette chaîne** — block its recommendations locally. If YouTube supplied an engagement feedback panel, the extension also attempts to send the account feedback.
- **Block channel / Bloquer cette chaîne** — local channel blocklist by ID (or by name if the channel ID is absent).
- **Manage hidden videos and channels / Gérer les vidéos et chaînes masquées** — unblock an individual channel, clear all blocked channels, or restore all hidden videos.

Filtering applies to recommendation shelves, grids, and continuations after the **next feed refresh**. Library, history, and playlist pages are deliberately exempt. The extension saves preferences in app-local storage (`niak-tizentube-filters-v1`) and does not require another patched TizenTube repository. It has English/French labels.

**Limits:** The displayed controls and modal still require a real Android TV device test. The lightweight CI validates JavaScript syntax, menu structures, persistence, filters and native resource embedding; it **does not compile or sign an APK**. The official upstream APK linked below **does not contain these fork changes**. Local blocks are not synchronized to your Google account, and optional feedback requests can fail if YouTube changes its API.

[Read implementation and test limitations](docs/NIAK_RECOMMENDATION_CONTROLS.md) · [View Niak video filters CI](https://github.com/niakw/TizenTubeCobalt/actions/workflows/niak-cobalt-filters.yml)

## Niak fork — APK build status

The fork has a [native Android APK build workflow](https://github.com/niakw/TizenTubeCobalt/actions/workflows/niak-apk-build.yml) for ARM/ARM64, with binary integrity and signing verification. **A successful Node/Java check is not an APK.** Do not use the official upstream download button as a substitute for a fork build.

The main TizenTube userscript is generated from a [pinned Git commit and verified SHA-256](docs/NIAK_APK_BUILD_AND_SECURITY.md) before GN compilation, instead of executing the mutable CDN version. An Android test APK may have a different debug signature from the official app and may require uninstalling the existing application. No production release will be represented as complete until a genuine signed APK is verified.

## ⬇️ Download

Get the latest release for your platform:

<p align="left">
    <a href="https://github.com/reisxd/TizenTubeCobalt/releases/latest">
        <picture>
            <img width="250px"
                src=".github/assets/TizenTube Download Latest Release Button.png" />
        </picture>
    </a>
</p>


**AFTVNews code:** `6366500`
> 💡 For a better experience, preferably use TizenTube Cobalt on a [**Google TV certified device.**](https://www.androidtv-guide.com/)

## ❓ How to Install

1. Download the latest release from the link above.
2. Sideload or install the app on your device (using a file manager, ADB, or platform-specific method).
3. Open the app and enjoy an enhanced streaming experience!

## 🌐 Community & Support

| Links |
| ------------- |
| [r/TizenTube Subreddit](https://www.reddit.com/r/TizenTube/)  |
| [Discord Server](https://discord.gg/m2P7v8Y2qR)  | 
| [Telegram](https://t.me/tizentubeofficial)  |
| [Matrix Space](https://matrix.to/#/!BLE5ubNYktI30e8K0j:matrix.6513006.xyz)  |
| [Report Issues / Request Features](https://github.com/reisxd/tizenTubeCobalt/issues)  |

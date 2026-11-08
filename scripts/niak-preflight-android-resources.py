#!/usr/bin/env python3
"""Verify all Android resources are declared before an expensive Cobalt build.

Chromium's prepare_resources.py rejects unlisted files found under java/res,
but the check otherwise happens late in Ninja (after thousands of C++ jobs).
This preflight is fast and does not require Android SDK, GN, or gclient.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RESOURCES = ROOT / "cobalt/shell/android/java/res"
BUILD = ROOT / "cobalt/shell/android/BUILD.gn"


def check() -> int:
    if not BUILD.is_file() or not RESOURCES.is_dir():
        print("Android resource preflight: required source tree not available", file=sys.stderr)
        return 2

    content = BUILD.read_text(encoding="utf-8")
    match = re.search(
        r'android_resources\("cobalt_shell_java_resources"\)\s*\{'
        r'([\s\S]*?)\n\}',
        content,
    )
    if not match:
        print("Android resource preflight: target missing", file=sys.stderr)
        return 2
    sources = re.search(r"\bsources\s*=\s*\[([^\]]*)\]", match.group(1))
    if not sources:
        print("Android resource preflight: sources list missing", file=sys.stderr)
        return 2

    listed = set(re.findall(r'"(java/res/[^"]+)"', sources.group(1)))
    actual = {
        file.relative_to(BUILD.parent).as_posix()
        for file in RESOURCES.rglob("*")
        if file.is_file()
    }
    missing = sorted(actual - listed)
    nonexistent = sorted(listed - actual)

    if missing:
        print("Android resource preflight: UNLISTED files:", file=sys.stderr)
        for item in missing:
            print(f"  + {item}", file=sys.stderr)
    if nonexistent:
        print("Android resource preflight: NONEXISTENT GN entries:", file=sys.stderr)
        for item in nonexistent:
            print(f"  - {item}", file=sys.stderr)
    if missing or nonexistent:
        return 1
    print(f"Android resource preflight passed: {len(actual)} files declared.")
    return 0


if __name__ == "__main__":
    sys.exit(check())

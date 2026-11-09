#!/usr/bin/env python3
"""Verify real Cobalt APK native ABI before publishing a TEST build.

Complements, never replaces, apksigner verification and actual TV testing.
"""
import os
import sys
import zipfile

ABIS = {"arm": ("armeabi-v7a", 1, 40), "arm64": ("arm64-v8a", 2, 183)}


def verify(apk_path: str, arch: str) -> None:
    if arch not in ABIS:
        raise ValueError(f"Unsupported target: {arch!r}; expected arm or arm64")
    abi, elf_class, machine = ABIS[arch]
    if os.path.getsize(apk_path) <= 10_000_000:
        raise ValueError("APK unexpectedly small")
    with zipfile.ZipFile(apk_path) as apk:
        names = set(apk.namelist())
        if not {"AndroidManifest.xml", "classes.dex"}.issubset(names):
            raise ValueError("Missing Android manifest or Java DEX")
        native = sorted(name for name in names
                        if name.startswith("lib/") and name.endswith(".so"))
        if not native:
            raise ValueError("No native shared libraries found in APK")
        wrong = [name for name in native if not name.startswith(f"lib/{abi}/")]
        if wrong:
            raise ValueError(f"Unexpected native ABI for {arch}: {wrong[:5]}")
        for name in native:
            with apk.open(name) as stream:
                header = stream.read(20)
            if len(header) < 20 or header[:4] != b"\x7fELF":
                raise ValueError(f"Not an ELF shared library: {name}")
            if (header[4] != elf_class or header[5] != 1
                    or int.from_bytes(header[18:20], "little") != machine):
                raise ValueError(f"Wrong ELF class/machine in {name} for Android {arch}")
        failed_entry = apk.testzip()
        if failed_entry:
            raise ValueError(f"Damaged APK ZIP member: {failed_entry}")
    print(f"Verified actual Android {arch} APK: {abi}, {len(native)} ELF libraries, intact ZIP")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("Usage: niak-verify-apk-abi.py <built.apk> <arm|arm64>")
    try:
        verify(sys.argv[1], sys.argv[2])
    except (ValueError, OSError, zipfile.BadZipFile) as exc:
        raise SystemExit(f"APK ABI verification failed: {exc}") from exc

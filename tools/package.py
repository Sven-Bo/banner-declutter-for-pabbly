"""Build the Chrome Web Store upload zip.

The store wants manifest.json at the *root* of the archive, and it should
contain only what actually ships -- no tests, no build tooling, no README.

    python tools/package.py
"""
import json
import re
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"

# Everything the manifest can reach at runtime, and nothing else.
SHIPPED = (
    "manifest.json",
    "src/background.js",
    "src/config.js",
    "src/content.js",
    "src/hider.js",
    "src/inject.css",
    "src/picker.js",
    "src/scanner.js",
    "src/storage.js",
    "popup/popup.css",
    "popup/popup.html",
    "popup/popup.js",
    "icons/icon16.png",
    "icons/icon32.png",
    "icons/icon48.png",
    "icons/icon128.png",
)


def manifest_files():
    """Name, version, and every path the manifest references."""
    manifest = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
    referenced = set(manifest["icons"].values())
    referenced |= set(manifest["action"]["default_icon"].values())
    referenced.add(manifest["action"]["default_popup"])
    referenced.add(manifest["background"]["service_worker"])
    for entry in manifest["content_scripts"]:
        referenced |= set(entry["js"]) | set(entry["css"])
    return manifest["name"], manifest["version"], referenced


def main():
    name, version, referenced = manifest_files()

    missing_from_disk = [f for f in SHIPPED if not (ROOT / f).exists()]
    if missing_from_disk:
        raise SystemExit(f"missing files: {missing_from_disk}")

    unpackaged = sorted(referenced - set(SHIPPED))
    if unpackaged:
        raise SystemExit(f"manifest references files the package omits: {unpackaged}")

    DIST.mkdir(exist_ok=True)
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    target = DIST / f"{slug}-{version}.zip"

    with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as bundle:
        for member in SHIPPED:
            bundle.write(ROOT / member, arcname=member)

    size_kb = target.stat().st_size / 1024
    print(f"{target.relative_to(ROOT)}  ({len(SHIPPED)} files, {size_kb:.1f} KB)")
    print("manifest.json is at the archive root:",
          zipfile.ZipFile(target).namelist()[0] == "manifest.json")


if __name__ == "__main__":
    main()

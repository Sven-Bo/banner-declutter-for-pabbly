"""Render the Chrome Web Store screenshots from store/shots.html.

Every asset is a fixed-size <section>, so we screenshot the element rather than
the viewport and land on the store's required dimensions exactly.

    python tools/make-screenshots.py
"""
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "store" / "shots.html"
OUT_DIR = ROOT / "store"

# element id -> (filename, expected width, expected height)
ASSETS = (
    ("shot-1", "screenshot-1-before-after.png", 1280, 800),
    ("shot-2", "screenshot-2-controls.png", 1280, 800),
    ("shot-3", "screenshot-3-picker.png", 1280, 800),
    ("tile-small", "promo-tile-small.png", 440, 280),
)

VIEWPORT = {"width": 1280, "height": 800}


def main() -> None:
    if not SOURCE.exists():
        raise SystemExit(f"missing {SOURCE}")

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(channel="chrome")
        page = browser.new_page(viewport=VIEWPORT, device_scale_factor=1)
        page.goto(SOURCE.as_uri())
        page.wait_for_load_state("networkidle")

        for element_id, filename, _, _ in ASSETS:
            page.locator(f"#{element_id}").screenshot(path=str(OUT_DIR / filename))

        browser.close()

    # The store rejects anything that is not exactly the size it asked for.
    failures = 0
    for _, filename, want_w, want_h in ASSETS:
        path = OUT_DIR / filename
        width, height = png_size(path)
        ok = (width, height) == (want_w, want_h)
        failures += 0 if ok else 1
        status = "ok" if ok else f"WRONG SIZE, wanted {want_w}x{want_h}"
        print(f"  {filename}: {width}x{height} {status} ({path.stat().st_size // 1024} KB)")

    if failures:
        raise SystemExit(f"{failures} asset(s) came out the wrong size")


def png_size(path: Path) -> tuple[int, int]:
    """Read width/height straight out of the PNG IHDR chunk."""
    header = path.read_bytes()[16:24]
    return int.from_bytes(header[:4], "big"), int.from_bytes(header[4:], "big")


if __name__ == "__main__":
    main()

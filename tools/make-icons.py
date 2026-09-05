"""Generate the extension icons. Pure stdlib: no Pillow, no build step.

Design: a green rounded square (Pabbly's colour) holding a white banner bar
with a diagonal cut through it -- "the banner, removed".

    python tools/make-icons.py
"""
import math
import struct
import zlib
from pathlib import Path

SIZES = (16, 32, 48, 128)
SUPERSAMPLE = 4  # rendered at 4x and box-filtered down, for clean edges

TOP = (0x00, 0xC4, 0x7F)
BOTTOM = (0x00, 0x8F, 0x60)
BAR = (0xFF, 0xFF, 0xFF)

OUT_DIR = Path(__file__).resolve().parent.parent / "icons"


def rounded_rect(x, y, left, top, right, bottom, radius):
    """Signed-ish test: is (x, y) inside a rounded rectangle?"""
    cx = min(max(x, left + radius), right - radius)
    cy = min(max(y, top + radius), bottom - radius)
    return math.hypot(x - cx, y - cy) <= radius


def distance_to_segment(px, py, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    span = dx * dx + dy * dy
    t = 0.0 if span == 0 else max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / span))
    return math.hypot(px - (ax + dx * t), py - (ay + dy * t))


def render(size):
    """Return RGBA bytes for one icon at `size`, box-filtered from `size * SUPERSAMPLE`."""
    hi = size * SUPERSAMPLE
    pad = hi * 0.02
    radius = hi * 0.225

    bar_left, bar_right = hi * 0.17, hi * 0.83
    bar_top, bar_bottom = hi * 0.415, hi * 0.585
    bar_radius = hi * 0.045

    cut_a = (hi * 0.235, hi * 0.735)
    cut_b = (hi * 0.765, hi * 0.265)
    cut_half_width = hi * 0.055

    hi_pixels = bytearray(hi * hi * 4)
    for y in range(hi):
        py = y + 0.5
        blend = py / hi
        base = tuple(round(TOP[i] + (BOTTOM[i] - TOP[i]) * blend) for i in range(3))
        for x in range(hi):
            px = x + 0.5
            offset = (y * hi + x) * 4
            if not rounded_rect(px, py, pad, pad, hi - pad, hi - pad, radius):
                continue  # stays transparent

            colour = base
            in_bar = rounded_rect(px, py, bar_left, bar_top, bar_right, bar_bottom, bar_radius)
            in_cut = distance_to_segment(px, py, *cut_a, *cut_b) <= cut_half_width
            if in_bar and not in_cut:
                colour = BAR

            hi_pixels[offset:offset + 4] = bytes((*colour, 255))

    # Box-filter down to the requested size.
    out = bytearray(size * size * 4)
    cells = SUPERSAMPLE * SUPERSAMPLE
    for y in range(size):
        for x in range(size):
            totals = [0, 0, 0, 0]
            for sy in range(SUPERSAMPLE):
                row = (y * SUPERSAMPLE + sy) * hi
                for sx in range(SUPERSAMPLE):
                    offset = (row + x * SUPERSAMPLE + sx) * 4
                    for channel in range(4):
                        totals[channel] += hi_pixels[offset + channel]
            offset = (y * size + x) * 4
            out[offset:offset + 4] = bytes(total // cells for total in totals)
    return bytes(out)


def chunk(kind, payload):
    body = kind + payload
    return struct.pack(">I", len(payload)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)


def write_png(path, size, rgba):
    stride = size * 4
    raw = b"".join(b"\x00" + rgba[y * stride:(y + 1) * stride] for y in range(size))
    header = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", header)
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )
    path.write_bytes(png)


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for size in SIZES:
        target = OUT_DIR / f"icon{size}.png"
        write_png(target, size, render(size))
        print(f"wrote {target.name} ({target.stat().st_size} bytes)")


if __name__ == "__main__":
    main()

"""Generate the PWA/app icons for "AI Running in Your Browser".

Produces PNG icons (192, 512, maskable, apple-touch) with a indigo->cyan
gradient background and the "AI" wordmark.

Requires Pillow:
    pip install Pillow

Usage:
    python scripts/generate_icons.py
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "icons"
OUT.mkdir(exist_ok=True)

# Brand gradient stops
TOP = (99, 102, 241)     # indigo
BOTTOM = (34, 211, 238)  # cyan


def font(size: int) -> ImageFont.FreeTypeFont:
    """Best-effort bold font; falls back to default if none is found."""
    for name in (
        "arialbd.ttf",
        "Arial Bold.ttf",
        "DejaVuSans-Bold.ttf",
        "LiberationSans-Bold.ttf",
    ):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def rounded_gradient(size: int, radius_frac: float = 0.22) -> Image.Image:
    img = Image.new("RGBA", (size, size))
    px = img.load()
    r = int(size * radius_frac)
    for y in range(size):
        t = y / (size - 1)
        r_c = TOP[0] + (BOTTOM[0] - TOP[0]) * t
        g_c = TOP[1] + (BOTTOM[1] - TOP[1]) * t
        b_c = TOP[2] + (BOTTOM[2] - TOP[2]) * t
        for x in range(size):
            px[x, y] = (int(r_c), int(g_c), int(b_c), 255)
    # rounded-rect mask
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size - 1, size - 1), radius=r, fill=255)
    img.putalpha(mask)
    return img


def draw(size: int, maskable: bool = False) -> Image.Image:
    img = rounded_gradient(size)
    d = ImageDraw.Draw(img)
    # pad text away from edges so it survives maskable icon cropping
    pad = int(size * (0.24 if maskable else 0.12))
    f = font(int(size * (0.40 if maskable else 0.46)))
    text = "AI"
    bbox = d.textbbox((0, 0), text, font=f)
    w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x = pad + (size - 2 * pad - w) / 2 - bbox[0]
    y = pad + (size - 2 * pad - h) / 2 - bbox[1]
    d.text((x, y), text, font=f, fill=(255, 255, 255, 255))
    return img


def social_card() -> Image.Image:
    """1200x630 Open Graph / Twitter card with the brand wordmark."""
    W, H = 1200, 630
    img = Image.new("RGBA", (W, H))
    px = img.load()
    for y in range(H):
        t = y / (H - 1)
        r_c = TOP[0] + (BOTTOM[0] - TOP[0]) * t
        g_c = TOP[1] + (BOTTOM[1] - TOP[1]) * t
        b_c = TOP[2] + (BOTTOM[2] - TOP[2]) * t
        for x in range(W):
            px[x, y] = (int(r_c), int(g_c), int(b_c), 255)
    d = ImageDraw.Draw(img)
    title = "AI Running in Your Browser"
    subtitle = "Whisper · Summarization · Translation — 100% on-device via WebAssembly"
    f_title = font(88)
    f_sub = font(40)
    # title
    bb = d.textbbox((0, 0), title, font=f_title)
    d.text(((W - (bb[2] - bb[0])) / 2 - bb[0], 200 - bb[1]), title, font=f_title, fill=(255, 255, 255, 255))
    # subtitle
    bb = d.textbbox((0, 0), subtitle, font=f_sub)
    d.text(((W - (bb[2] - bb[0])) / 2 - bb[0], 330 - bb[1]), subtitle, font=f_sub, fill=(235, 240, 250, 255))
    # thin divider line
    d.rounded_rectangle((W / 2 - 60, 300, W / 2 + 60, 302), radius=1, fill=(255, 255, 255, 180))
    return img


def main() -> None:
    draw(192).save(OUT / "icon-192.png")
    draw(512).save(OUT / "icon-512.png")
    draw(512, maskable=True).save(OUT / "icon-maskable-512.png")
    draw(180).save(OUT / "apple-touch-icon.png")
    social_card().save(OUT / "social-card.png")
    print(f"Icons + social card written to {OUT}")



if __name__ == "__main__":
    main()

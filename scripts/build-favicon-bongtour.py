"""
Extract yellow B logo from checkerboard/artifact background, emit favicon set.
Run from repo root: python scripts/build-favicon-bongtour.py
Requires: Pillow, numpy, scipy

Outputs:
- app/favicon.ico, app/icon.png (Next.js App Router file convention)
- public/icons/*.png (static PNG + source)
"""
from __future__ import annotations

import os
import sys

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), ".."))
APP_DIR = os.path.join(ROOT, "app")
OUT_DIR = os.path.join(ROOT, "public", "icons")
SRC_PRIMARY = os.path.join(ROOT, "public", "_favicon_src.png")
SRC_FALLBACK = r"C:\Users\USER\.cursor\projects\c-Users-USER-Desktop-BONGTOUR\assets\c__Users_USER_AppData_Roaming_Cursor_User_workspaceStorage_b8d9c2c829ee296ba4410b6c45b2b76a_images_Gemini_Generated_Image_eew9mceew9mceew9-ad6fc54d-dab2-41c7-adf1-b33e055798ef.png"


def resolve_src() -> str:
    if os.path.isfile(SRC_PRIMARY):
        return SRC_PRIMARY
    if os.path.isfile(SRC_FALLBACK):
        return SRC_FALLBACK
    print("Missing source. Place attachment at public/_favicon_src.png", file=sys.stderr)
    sys.exit(1)


def build_logo_mask(rgb: np.ndarray) -> np.ndarray:
    r = rgb[:, :, 0].astype(np.int16)
    g = rgb[:, :, 1].astype(np.int16)
    b = rgb[:, :, 2].astype(np.int16)
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    spread = (mx - mn).astype(np.float32)

    neutral = (np.abs(r - g) < 18) & (np.abs(r - b) < 18) & (np.abs(g - b) < 18)
    very_light = (r > 238) & (g > 238) & (b > 238)
    very_dark = (r < 35) & (g < 35) & (b < 35)

    yellowish = (r > 95) & (g > 70) & (b < 245) & (r + g > b + 95) & (spread > 22)

    mask = yellowish & ~neutral & ~very_light & ~very_dark
    mask = ndimage.binary_closing(mask, iterations=2)
    mask = ndimage.binary_opening(mask, iterations=1)
    return mask


def mask_to_rgba(rgb: np.ndarray, mask: np.ndarray) -> Image.Image:
    a = (mask.astype(np.float32) * 255.0).astype(np.uint8)
    h, w = mask.shape
    out = np.zeros((h, w, 4), dtype=np.uint8)
    out[:, :, :3] = rgb
    out[:, :, 3] = a
    im = Image.fromarray(out, "RGBA")
    im = im.filter(ImageFilter.GaussianBlur(radius=0.4))
    a2 = np.array(im.split()[3]).astype(np.float32)
    a2 = np.clip(a2 * 1.05, 0, 255).astype(np.uint8)
    a2[a2 < 12] = 0
    im.putalpha(Image.fromarray(a2))
    return im


def crop_and_square(im: Image.Image, pad_ratio: float = 0.07) -> Image.Image:
    a = np.array(im.split()[3])
    ys, xs = np.where(a > 8)
    if len(xs) == 0:
        return im
    x0, x1 = xs.min(), xs.max() + 1
    y0, y1 = ys.min(), ys.max() + 1
    im = im.crop((x0, y0, x1, y1))
    w, h = im.size
    side = max(w, h)
    pad = int(side * pad_ratio)
    side2 = side + 2 * pad
    canvas = Image.new("RGBA", (side2, side2), (0, 0, 0, 0))
    ox = (side2 - w) // 2
    oy = (side2 - h) // 2
    canvas.paste(im, (ox, oy), im)
    return canvas


def main() -> None:
    src = resolve_src()
    os.makedirs(OUT_DIR, exist_ok=True)
    os.makedirs(APP_DIR, exist_ok=True)
    base = Image.open(src).convert("RGB")
    rgb = np.array(base)
    mask = build_logo_mask(rgb)
    rgba = mask_to_rgba(rgb, mask)
    squared = crop_and_square(rgba, pad_ratio=0.07)

    squared.save(os.path.join(OUT_DIR, "favicon-source-transparent.png"), "PNG", optimize=True)

    def save_size(px: int, name: str) -> None:
        squared.resize((px, px), Image.Resampling.LANCZOS).save(
            os.path.join(OUT_DIR, name), "PNG", optimize=True
        )

    save_size(512, "icon-512.png")
    save_size(192, "icon-192.png")
    save_size(32, "favicon-32.png")
    save_size(16, "favicon-16.png")

    s16 = squared.resize((16, 16), Image.Resampling.LANCZOS)
    s32 = squared.resize((32, 32), Image.Resampling.LANCZOS)
    s48 = squared.resize((48, 48), Image.Resampling.LANCZOS)
    ico_path = os.path.join(APP_DIR, "favicon.ico")
    s32.save(
        ico_path,
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48)],
        append_images=[s16, s48],
    )

    icon512 = squared.resize((512, 512), Image.Resampling.LANCZOS)
    icon512.save(os.path.join(APP_DIR, "icon.png"), "PNG", optimize=True)

    print("Wrote app/favicon.ico, app/icon.png, public/icons/* from:", src)


if __name__ == "__main__":
    main()

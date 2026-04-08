# 누끼(배경 제거) - Python 3 + rembg 필요
# 설치: pip install rembg pillow
# 실행: python scripts/remove-bg.py

import io
import os
from pathlib import Path

try:
    from rembg import remove
    from PIL import Image
except ImportError:
    print("먼저 설치: pip install rembg pillow")
    exit(1)

IMAGE_DIR = Path(__file__).resolve().parent.parent / "public" / "image"
OUT_DIR = IMAGE_DIR / "nobg"  # 배경 제거본은 nobg 폴더에 저장

def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for name in ["envelope-closed.png", "envelope-opened.png", "bong-sajang-pops.png", "bong-sajang-chat.png"]:
        path = IMAGE_DIR / name
        if not path.exists():
            print("건너뜀 (없음):", name)
            continue
        with open(path, "rb") as f:
            out = remove(f.read())
        out_path = OUT_DIR / name
        Image.open(io.BytesIO(out)).save(out_path)
        print("저장:", out_path)

main()

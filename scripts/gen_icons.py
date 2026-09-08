"""从 assets/icon-source.png 生成扩展图标，目录约定与 B 站下载器一致。"""
from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets" / "icon-source.png"
OUT = ROOT / "icons"
SIZES = (16, 32, 48, 128)


def main() -> None:
    if not SRC.is_file():
        raise SystemExit("缺少源图: " + str(SRC))
    OUT.mkdir(parents=True, exist_ok=True)
    source = Image.open(SRC).convert("RGBA")
    for size in SIZES:
        if size <= 32:
            img = source.resize((size * 4, size * 4), Image.Resampling.LANCZOS)
            img = img.filter(ImageFilter.UnsharpMask(radius=1.1, percent=140, threshold=2))
            img = img.resize((size, size), Image.Resampling.LANCZOS)
        else:
            img = source.resize((size, size), Image.Resampling.LANCZOS)
        dest = OUT / f"icon{size}.png"
        img.save(dest, "PNG", optimize=True)
        print("OK", dest.name)


if __name__ == "__main__":
    main()

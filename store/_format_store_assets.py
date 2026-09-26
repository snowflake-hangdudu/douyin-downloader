"""由真实产品截图生成 Chrome / Edge 商店素材。"""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageOps

ROOT = Path(__file__).resolve().parent
ICON = ROOT.parent / 'icons' / 'icon128.png'
SOURCES = {
    'single': ROOT / 'source-capture-single.png',
    'list': ROOT / 'source-capture-list.png',
}


def cover(image: Image.Image, size: tuple[int, int], box=None) -> Image.Image:
    source = image.crop(box) if box else image
    return ImageOps.fit(
        source.convert('RGB'),
        size,
        method=Image.Resampling.LANCZOS,
        centering=(0.55, 0.50),
    )


def write_store_icons() -> None:
    icon = Image.open(ICON).convert('RGBA')
    for filename, size in [('store-icon-128.png', 128), ('logo-300.png', 300)]:
        mark = icon.resize((size, size), Image.Resampling.LANCZOS)
        canvas = Image.new('RGB', (size, size), (250, 250, 251))
        draw = ImageDraw.Draw(canvas)
        accent = (17, 17, 17)
        draw.rectangle((0, 0, size, 3), fill=(0, 195, 215))
        draw.rectangle((0, 3, size, 6), fill=(255, 45, 130))
        canvas.paste(mark, (0, 0), mark)
        canvas.save(ROOT / filename, 'PNG', optimize=True)
        print('OK', filename, size)


def format_single(image: Image.Image) -> None:
    width, height = image.size
    cover(image, (1280, 800)).save(ROOT / 'screenshot-1280x800.png', 'PNG', optimize=True)
    cover(image, (640, 400)).save(ROOT / 'screenshot-640x400.png', 'PNG', optimize=True)
    panel_left = int(width * 0.58)
    panel_top = int(height * 0.06)
    panel_bottom = int(height * 0.94)
    focus = cover(image, (1280, 800), (panel_left, panel_top, width, panel_bottom))
    focus.save(ROOT / 'screenshot-panel-1280x800.png', 'PNG', optimize=True)
    tile_left = max(0, width - 448)
    tile_top = int(height * 0.055)
    tile = image.crop((tile_left, tile_top, width, tile_top + 280))
    tile.resize((440, 280), Image.Resampling.LANCZOS).save(ROOT / 'tile-440x280.png', 'PNG', optimize=True)
    cover(image, (1400, 560)).save(ROOT / 'marquee-1400x560.png', 'PNG', optimize=True)


def format_list(image: Image.Image) -> None:
    cover(image, (1280, 800)).save(ROOT / 'screenshot-list-1280x800.png', 'PNG', optimize=True)


def main(mode: str) -> None:
    source = SOURCES.get(mode)
    if not source or not source.is_file():
        raise SystemExit(f'缺少截图：{source}')
    image = Image.open(source).convert('RGB')
    print('source', mode, image.size)
    if mode == 'single':
        format_single(image)
    elif mode == 'list':
        format_list(image)
    else:
        raise SystemExit(f'未知模式：{mode}')


if __name__ == '__main__':
    args = sys.argv[1:]
    if args == ['icons']:
        write_store_icons()
    elif len(args) == 1 and args[0] in SOURCES:
        main(args[0])
    else:
        raise SystemExit('用法: python store/_format_store_assets.py single|list|icons')

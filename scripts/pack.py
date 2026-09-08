"""打包发布 zip，并把调试区整块关掉。"""
from __future__ import annotations

import argparse
import re
import zipfile
from pathlib import Path

DEBUG_FLAG = re.compile(
    r"(DownloaderKit\.DEBUG\s*=\s*)(?:true|false)(\s*;\s*//\s*@pack:debug)"
)
EXCLUDE_PARTS = {"test", "store", "scripts", "node_modules", ".git", "_metadata"}
EXCLUDE_NAMES = {".gitignore"}


def should_include(path: Path, root: Path, out: Path) -> bool:
    relative = path.relative_to(root)
    if path == out:
        return False
    if any(part in EXCLUDE_PARTS for part in relative.parts):
        return False
    if relative.name in EXCLUDE_NAMES:
        return False
    return path.is_file()


def pack_bytes(rel: str, raw: bytes) -> bytes:
    if rel.replace("\\", "/") != "shared/debug-flag.js":
        return raw
    text = raw.decode("utf-8")
    text2, count = DEBUG_FLAG.subn(r"\1false\2", text, count=1)
    if count:
        print("PATCH: shared/debug-flag.js DEBUG -> false")
    else:
        print("WARN: 未找到 @pack:debug，打包后调试区可能仍显示")
    return text2.encode("utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="打包扩展并关闭调试区")
    parser.add_argument("--root", default=".", help="扩展根目录")
    parser.add_argument("--out", default="", help="输出 zip 路径")
    args = parser.parse_args()

    root = Path(args.root).resolve()
    out = Path(args.out).resolve() if args.out else root / (root.name + "-chrome.zip")

    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(root.rglob("*")):
            if not should_include(path, root, out):
                continue
            rel = path.relative_to(root).as_posix()
            data = pack_bytes(rel, path.read_bytes())
            archive.writestr(rel, data)
            print("ADD:", rel)
    print("OK ->", out)


if __name__ == "__main__":
    main()

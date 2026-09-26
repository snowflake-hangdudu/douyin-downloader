"""打包 Firefox 发布包（XPI），并关闭调试区。"""
from __future__ import annotations

import json
import re
import zipfile
from pathlib import Path

DEBUG_FLAG = re.compile(
    r"(DownloaderKit\.DEBUG\s*=\s*)(?:true|false)(\s*;\s*//\s*@pack:debug)"
)
EXCLUDE_PARTS = {"test", "store", "scripts", "node_modules", ".git", "_metadata", "docs"}
EXCLUDE_NAMES = {
    ".gitignore",
    "package.json",
    "package-lock.json",
    "douyin-downloader-chrome.zip",
    "douyin-downloader-firefox.xpi",
    "README.md",
}


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


def build_manifest(root: Path) -> str:
    manifest = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
    manifest["background"] = {
        "scripts": [
            "lib/aweme-parse.js",
            "shared/runtime.js",
            "shared/remote-content.js",
            "shared/config-handler.js",
            "background.js",
        ]
    }
    # Firefox match patterns do not support port numbers. The code only calls
    # the fixed :8081 configuration endpoint, so retain access to this IP only.
    manifest["host_permissions"] = [
        re.sub(r"(?<=://)([^/*:]+):\d+(/.*)$", r"\1\2", pattern)
        for pattern in manifest.get("host_permissions", [])
    ]
    manifest["browser_specific_settings"] = {
        "gecko": {
            "id": "douyin-downloader@hangdudu.local",
            "data_collection_permissions": {"required": ["none"]},
            "strict_min_version": "128.0",
        }
    }
    return json.dumps(manifest, ensure_ascii=False, indent=2) + "\n"


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    out = root / "douyin-downloader-firefox.xpi"

    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("manifest.json", build_manifest(root).encode("utf-8"))
        print("ADD: manifest.json (firefox)")
        for path in sorted(root.rglob("*")):
            if not should_include(path, root, out):
                continue
            rel = path.relative_to(root).as_posix()
            if rel == "manifest.json":
                continue
            data = pack_bytes(rel, path.read_bytes())
            archive.writestr(rel, data)
            print("ADD:", rel)
    print("OK ->", out)


if __name__ == "__main__":
    main()

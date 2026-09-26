"""Generate Douyin icons from shared-download-kit/brand-assets/douyin.png.

Authoritative source is the kit brand-asset (vertical play box + cyan/pink bars),
not the obsolete phone-outline art.
"""
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
KIT_SCRIPTS = ROOT.parent / "shared-download-kit" / "scripts"
sys.path.insert(0, str(KIT_SCRIPTS))

from gen_platform_icons import generate_for  # noqa: E402


def main() -> None:
    generate_for("douyin", ROOT)


if __name__ == "__main__":
    main()

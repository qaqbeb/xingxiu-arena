#!/usr/bin/env python3
"""Install a painted weapon icon (see ART-BRIEF-WEAPONS.md).

    python3 tools/install_weapon_art.py chuanyun --image ~/gen/chuanyun.png
    python3 tools/install_weapon_art.py --sheet        # contact sheet of all icons

The source must be a square RGBA image with a truly transparent background.
The weapon is trimmed, centred, scaled to fill 90% of a 192 px canvas and
written to miniprogram/assets/weapons/<id>.png. Requires Pillow.
"""
import argparse
import re
import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "miniprogram/assets/weapons"
PREVIEW = ROOT / "tools/preview"
SIZE = 192


def weapon_ids():
    text = (ROOT / "miniprogram/core/ships.js").read_text()
    block = text[text.index("const WEAPONS = ["):text.index("function mount(")]
    return re.findall(r'^\s{6}id: "(\w+)",', block, re.M)


def fail(message):
    sys.exit("install_weapon_art: " + message)


def install(weapon, path):
    if weapon not in weapon_ids():
        fail(f"unknown weapon {weapon!r}")
    img = Image.open(Path(path).expanduser())
    if img.mode != "RGBA":
        fail("image must be RGBA with a real alpha channel, got " + img.mode)
    if img.width != img.height:
        fail(f"image must be square, got {img.width}×{img.height}")
    alpha = img.getchannel("A")
    n = img.width
    if max(alpha.getpixel(p) for p in [(0, 0), (n - 1, 0), (0, n - 1), (n - 1, n - 1)]) > 8:
        fail("corners are not transparent: the background must be true alpha")
    box = alpha.point(lambda v: 255 if v >= 128 else 0).getbbox()
    if not box:
        fail("image is empty")
    problems = []
    if (box[2] - box[0]) * (box[3] - box[1]) < n * n * 0.08:
        problems.append("the weapon is tiny in its frame; regenerate it larger for a sharper icon")
    solid = alpha.point(lambda v: 255 if v >= 128 else 0)
    left, right = solid.tobytes(), solid.transpose(Image.FLIP_LEFT_RIGHT).tobytes()
    same = sum(1 for a, b in zip(left, right) if a and b)
    either = sum(1 for a, b in zip(left, right) if a or b)
    centre = (box[0] + box[2]) / 2 / n
    if abs(centre - 0.5) < 0.05 and same / either < 0.8:
        problems.append(f"silhouette is only {same / either:.0%} mirror-symmetric; weapons are drawn square-on, barrel up")
    crop = img.crop(box)
    k = SIZE * 0.9 / max(crop.size)
    crop = crop.resize((max(1, round(crop.width * k)), max(1, round(crop.height * k))), Image.LANCZOS)
    out = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    out.paste(crop, ((SIZE - crop.width) // 2, (SIZE - crop.height) // 2))
    OUT.mkdir(parents=True, exist_ok=True)
    target = OUT / f"{weapon}.png"
    out.save(target, optimize=True)
    if target.stat().st_size > 70_000:
        problems.append(f"{target.name} is {target.stat().st_size:,} bytes; keep icons under 70 KB")
    print(f"installed {target.relative_to(ROOT)} ({target.stat().st_size:,} bytes)")
    for problem in problems:
        print("PROBLEM:", problem)
    return not problems


def sheet():
    ids = weapon_ids()
    cols = 7
    rows = -(-len(ids) // cols)
    cell = SIZE + 28
    canvas = Image.new("RGB", (cols * cell, rows * cell), (11, 16, 20))
    draw = ImageDraw.Draw(canvas)
    missing = []
    for i, weapon in enumerate(ids):
        x, y = (i % cols) * cell, (i // cols) * cell
        path = OUT / f"{weapon}.png"
        if path.exists():
            icon = Image.open(path).convert("RGBA")
            canvas.paste(icon, (x + 14, y + 4), icon)
        else:
            missing.append(weapon)
            draw.rectangle([x + 14, y + 4, x + 14 + SIZE, y + 4 + SIZE], outline=(120, 60, 60))
        draw.text((x + 16, y + SIZE + 8), weapon, fill=(220, 226, 223))
    PREVIEW.mkdir(parents=True, exist_ok=True)
    canvas.save(PREVIEW / "weapons-sheet.png")
    total = sum(p.stat().st_size for p in OUT.glob("*.png")) if OUT.exists() else 0
    print(f"sheet: tools/preview/weapons-sheet.png  ({len(ids) - len(missing)}/{len(ids)} icons, {total:,} bytes)")
    if missing:
        print("missing:", ", ".join(missing))


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("weapon", nargs="?")
    parser.add_argument("--image")
    parser.add_argument("--sheet", action="store_true")
    args = parser.parse_args()
    if args.sheet:
        return sheet()
    if not (args.weapon and args.image):
        fail("give a weapon id and --image, or --sheet")
    sys.exit(0 if install(args.weapon, args.image) else 1)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Install a painted hull sprite and calibrate its turrets and nozzles.

Used when replacing the placeholder art in miniprogram/assets/ships2/ (see
ART-BRIEF-SHIPS.md). It validates the image, writes the 512 px runtime sprite,
converts measured pixel positions to hull coordinates in
miniprogram/core/ship-geometry.js, and renders an overlay so the result can be
checked by eye.

Install and calibrate (pixel positions are measured on the image you pass):

    python3 tools/calibrate_ship.py tieao --image ~/gen/tieao.png \
        --mounts "b1:560,610; b2:694,610; m1:627,470; b3:430,820; b4:824,820" \
        --engines "480,1190,60; 627,1205,80; 774,1190,60"

Each mount is id:u,v. Each engine is u,v,width[,flame] in pixels, where u,v is
the centre of the nozzle opening and flame is the plume length (default 5×
width). u runs right, v runs down, origin at the top-left corner.

Re-render the overlay for the geometry already on disk:

    python3 tools/calibrate_ship.py tieao --check

Requires Pillow.
"""
import argparse
import json
import math
import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SPRITES = ROOT / "miniprogram/assets/ships2"
GEOMETRY = ROOT / "miniprogram/core/ship-geometry.js"
PREVIEW = ROOT / "tools/preview"
SPRITE_SCALE = 1.04
HEAD = "const geometry = "
TAIL = ";\n  if (typeof module"


def read_geometry():
    text = GEOMETRY.read_text()
    start = text.index(HEAD) + len(HEAD)
    return json.loads(text[start:text.index(TAIL)])


def write_geometry(data):
    body = json.dumps(data, ensure_ascii=False, indent=2).replace("\n", "\n  ")
    GEOMETRY.write_text(
        "// Hull geometry matched to the sprites in assets/ships2.\n"
        "// Written by tools/calibrate_ship.py (and by tools/kitbash_ships.py for\n"
        "// placeholder art). Edit through those tools, not by hand.\n"
        "(function (root) {\n  const geometry = " + body + ";\n"
        '  if (typeof module !== "undefined" && module.exports) module.exports = geometry;\n'
        "  else root.StarShipGeometry = geometry;\n"
        '})(typeof globalThis !== "undefined" ? globalThis : this);\n'
    )


def pairs(text):
    return [part.strip() for part in text.replace("\n", ";").split(";") if part.strip()]


def fail(message):
    sys.exit("calibrate_ship: " + message)


def inspect(img, problems):
    """Checks every sprite must pass; returns the body box (alpha >= 128)."""
    if img.mode != "RGBA":
        fail("image must be RGBA with a real alpha channel, got " + img.mode)
    if img.width != img.height:
        fail(f"image must be square, got {img.width}×{img.height}")
    alpha = img.getchannel("A")
    corners = [alpha.getpixel(p) for p in [(0, 0), (img.width - 1, 0), (0, img.height - 1), (img.width - 1, img.height - 1)]]
    if max(corners) > 8:
        fail("corners are not transparent: the background must be true alpha, not a colour or checkerboard")
    box = alpha.point(lambda v: 255 if v >= 128 else 0).getbbox()
    if not box:
        fail("image is empty")
    n = img.width
    height = (box[3] - box[1]) / n
    if not 0.94 <= height <= 0.995:
        problems.append(f"hull height is {height:.1%} of the canvas; it must fill 94–99% (bow at the top, nozzles at the bottom)")
    centre = (box[0] + box[2]) / 2 / n
    if abs(centre - 0.5) > 0.015:
        problems.append(f"hull is off-centre horizontally ({centre:.1%}); the keel must sit on the vertical centre line")
    # Port/starboard symmetry of the silhouette.
    solid = alpha.point(lambda v: 255 if v >= 128 else 0)
    mirror = solid.transpose(Image.FLIP_LEFT_RIGHT)
    left, right = solid.tobytes(), mirror.tobytes()
    same = sum(1 for a, b in zip(left, right) if a and b)
    either = sum(1 for a, b in zip(left, right) if a or b)
    if either and same / either < 0.9:
        problems.append(f"silhouette is only {same / either:.0%} mirror-symmetric; hulls are symmetric about the keel")
    return box


def overlay(name, spec):
    img = Image.open(SPRITES / f"{name}.png").convert("RGBA")
    k = 2
    canvas = Image.new("RGBA", (512 * k, 512 * k), (8, 14, 22, 255))
    canvas.alpha_composite(img.resize((512 * k, 512 * k), Image.LANCZOS))
    draw = ImageDraw.Draw(canvas)
    unit = spec["length"] * SPRITE_SCALE / 512

    def pixel(x, y):
        return (256 + y / unit) * k, (256 - x / unit) * k

    for e in spec["engineSlots"]:
        px, py = pixel(e["x"], e["y"])
        half = e["width"] / unit * k / 2
        draw.ellipse([px - half, py - half * 0.5, px + half, py + half * 0.5], outline=(255, 170, 80, 255), width=2)
        draw.line([px, py, px, py + e["length"] / unit * k * 0.4], fill=(255, 170, 80, 255), width=2)
    for mount_id, (x, y) in spec["mountPoints"].items():
        px, py = pixel(x, y)
        draw.ellipse([px - 11, py - 11, px + 11, py + 11], outline=(140, 222, 198, 255), width=2)
        draw.line([px - 15, py, px + 15, py], fill=(140, 222, 198, 255))
        draw.line([px, py - 15, px, py + 15], fill=(140, 222, 198, 255))
        draw.text((px + 13, py - 16), mount_id, fill=(255, 255, 255, 255))
    PREVIEW.mkdir(parents=True, exist_ok=True)
    out = PREVIEW / f"{name}-check.png"
    canvas.convert("RGB").save(out)
    return out


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("ship", help="hull id, e.g. tieao")
    parser.add_argument("--image", help="painted sprite to install (any square RGBA size)")
    parser.add_argument("--mounts", help='"id:u,v; id:u,v" measured on --image')
    parser.add_argument("--engines", help='"u,v,width[,flame]; ..." measured on --image')
    parser.add_argument("--fit", action="store_true",
                        help="uniformly rescale and centre the hull to fill 97%% of the canvas before installing; "
                             "coordinates are still given on the original --image")
    parser.add_argument("--check", action="store_true", help="only render the overlay for the geometry on disk")
    args = parser.parse_args()

    data = read_geometry()
    if args.ship not in data:
        fail(f"unknown hull {args.ship!r}; known: {', '.join(data)}")
    spec = data[args.ship]
    problems = []

    if args.check:
        box = inspect(Image.open(SPRITES / f"{args.ship}.png"), problems)
    else:
        if not (args.image and args.mounts and args.engines):
            fail("--image, --mounts and --engines are all required (or use --check)")
        source = Image.open(Path(args.image).expanduser())
        fit = lambda u, v: (u, v)
        if args.fit:
            # A hull that touches the frame or floats small is reframed, not repainted.
            if source.mode != "RGBA" or source.width != source.height:
                fail("--fit still needs a square RGBA image")
            raw = source.getchannel("A").point(lambda v: 255 if v >= 128 else 0).getbbox()
            n0 = source.width
            f = 0.97 * n0 / (raw[3] - raw[1])
            cx, cy = (raw[0] + raw[2]) / 2, (raw[1] + raw[3]) / 2
            scaled = source.resize((round(n0 * f), round(n0 * f)), Image.LANCZOS)
            framed = Image.new("RGBA", (n0, n0), (0, 0, 0, 0))
            framed.paste(
                scaled, (round(n0 / 2 - cx * f), round(n0 / 2 - cy * f)))
            source = framed
            fit = lambda u, v: ((u - cx) * f + n0 / 2, (v - cy) * f + n0 / 2)
        box = inspect(source, problems)
        n = source.width
        unit = spec["length"] * SPRITE_SCALE / n  # hull units per source pixel
        alpha = source.getchannel("A")

        mounts = {}
        for item in pairs(args.mounts):
            mount_id, _, coords = item.partition(":")
            u, v = fit(*(float(c) for c in coords.split(",")))
            if not (0 <= u < n and 0 <= v < n) or alpha.getpixel((int(u), int(v))) < 128:
                problems.append(f"mount {mount_id.strip()} at ({u:g},{v:g}) is not on the hull")
            mounts[mount_id.strip()] = [round((n / 2 - v) * unit, 2), round((u - n / 2) * unit, 2)]
        missing = set(spec["mountPoints"]) - set(mounts)
        extra = set(mounts) - set(spec["mountPoints"])
        if missing or extra:
            fail(f"mount ids must match core/ships.js exactly; missing {sorted(missing)}, unexpected {sorted(extra)}")

        style = spec["engineSlots"][0]["style"]
        engines = []
        for item in pairs(args.engines):
            values = [float(c) for c in item.split(",")]
            if len(values) not in (3, 4):
                fail(f"engine {item!r} must be u,v,width[,flame]")
            u, v, width = values[:3]
            flame = values[3] if len(values) == 4 else width * 5
            u, v = fit(u, v)
            if args.fit:
                width, flame = width * f, flame * f
            if v < n * 0.5:
                problems.append(f"engine at ({u:g},{v:g}) is in the forward half; nozzles belong at the stern")
            engines.append(dict(x=round((n / 2 - v) * unit, 2), y=round((u - n / 2) * unit, 2),
                                width=round(width * unit, 2), length=round(flame * unit), style=style))
        engines.sort(key=lambda e: e["y"])
        for a, b in zip(engines, reversed(engines)):
            if abs(a["y"] + b["y"]) > spec["length"] * 0.02 or abs(a["x"] - b["x"]) > spec["length"] * 0.02:
                problems.append("engines are not mirror-symmetric about the keel; re-measure the nozzle centres")
                break

        spec["mountPoints"] = {k: mounts[k] for k in spec["mountPoints"]}
        spec["engineSlots"] = engines
        # Collision width follows the visible beam of the hull.
        spec["width"] = round((box[2] - box[0]) / (box[3] - box[1]) * spec["length"])
        SPRITES.mkdir(parents=True, exist_ok=True)
        target = SPRITES / f"{args.ship}.png"
        source.resize((512, 512), Image.LANCZOS).save(target, optimize=True)
        if target.stat().st_size > 420_000:
            problems.append(f"{target.name} is {target.stat().st_size:,} bytes; keep each sprite under 420 KB")
        write_geometry(data)
        print(f"installed {target.relative_to(ROOT)} ({target.stat().st_size:,} bytes), "
              f"{spec['length']}×{spec['width']}, {len(engines)} engines, {len(mounts)} mounts")

    print("overlay:", overlay(args.ship, spec).relative_to(ROOT))
    for problem in problems:
        print("PROBLEM:", problem)
    sys.exit(1 if problems else 0)


if __name__ == "__main__":
    main()

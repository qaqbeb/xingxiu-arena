#!/usr/bin/env python3
"""Build placeholder hull sprites by kitbashing the four painted originals.

PLACEHOLDER ART. Running this overwrites assets/ships2/*.png and the whole of
core/ship-geometry.js, including hulls already replaced with real art and
calibrated by tools/calibrate_ship.py. See ART-BRIEF-SHIPS.md.

Each recipe layers scaled, tinted or cropped copies of the source sprites.
Because every layer is an affine placement of a source whose engine and mount
coordinates are known, the script also emits those coordinates for the new
hull (tools/kitbash_ships.json), so nozzles and turrets line up with the art.

    python3 tools/kitbash_ships.py

Writes the sprites to miniprogram/assets/ships2/ and the matching geometry to
miniprogram/core/ship-geometry.js.
"""
import json
from pathlib import Path
from PIL import Image, ImageEnhance, ImageFilter, ImageChops

# Kitbash layer label + source mount -> mount id used by core/ships.js.
MOUNT_IDS = {
    "tieao": {
        "Cb1": "b1",
        "Cb2": "b2",
        "Cm1": "m1",
        "Lb1": "b3",
        "Rb2": "b4"
    },
    "fuyue": {
        "Lb1": "b1",
        "Rb1": "b2",
        "Cm1": "m1",
        "Lm1": "m2",
        "Rm1": "m3",
        "Lb3": "b3",
        "Rb2": "b4",
        "Cb1": "b5",
        "Cb2": "b6",
        "Lb2": "b7",
        "Rb3": "b8"
    },
    "shaoji": {
        "Cb1": "b1",
        "Cb2": "e1",
        "Cm1": "m1"
    },
    "zhenyue": {
        "Cb1": "b1",
        "Ce1": "e1",
        "Lb1": "b2",
        "Re1": "b3",
        "Lb2": "m1",
        "Rb2": "m2",
        "Le1": "e2",
        "Rb1": "e3",
        "Cb2": "b4"
    },
    "lingxiao": {
        "Bb1": "b1",
        "Cb1": "b2",
        "Ce1": "e1",
        "Bm1": "m1",
        "Bb2": "b3",
        "Bb3": "b4",
        "Cb2": "e2"
    },
    "xinyue": {
        "Ce1": "e1",
        "Ce2": "e2"
    },
    "kuimu": {
        "Ce1": "e1",
        "Ce2": "e2",
        "Le1": "e3",
        "Re2": "e4",
        "Le2": "m1",
        "Re1": "m2",
        "Ce3": "e5",
        "Ce4": "e6"
    },
    "kangjin": {
        "Ce1": "e1",
        "Ce2": "e2",
        "Ce3": "e3",
        "Ce4": "e4",
        "Le2": "m1",
        "Re1": "m2",
        "Le1": "e5",
        "Re2": "e6",
        "Le3": "e7",
        "Le4": "e8",
        "Re3": "e9",
        "Re4": "e10"
    }
}

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "miniprogram/assets/ships"
OUT = ROOT / "miniprogram/assets/ships2"
SPRITE = 1.04  # spriteScale shared by every hull

# Source hull length and feature points in body space (+X bow, +Y starboard).
SOURCES = {
    "xia": dict(length=100, engines=[(-43.62, -14.68, 4.15, 26), (-42.79, -8.63, 5.31, 34), (-47.11, 0, 7.88, 43), (-42.79, 8.63, 5.31, 34), (-43.62, 14.51, 4.15, 26)],
                mounts={"b1": (1.08, -9.54), "b2": (1.08, 9.70), "m1": (14.26, 0)}),
    "xie": dict(length=240, engines=[(-108.08, -64.69, 17.91, 50), (-112.06, -34.83, 20.9, 65), (-115.05, 0, 24.88, 80), (-112.06, 35.23, 20.9, 65), (-108.08, 65.09, 17.91, 50)],
                mounts={"b1": (48.57, 0), "b2": (-29.46, -43.99), "b3": (-29.46, 45.18), "m1": (4.18, 0)}),
    "tian": dict(length=150, engines=[(-70.66, -13.68, 8.71, 50), (-72.9, 0.12, 8.71, 58), (-70.66, 13.56, 8.71, 50)],
                 mounts={"b1": (25.13, -8.96), "e1": (25.13, 8.71), "b2": (-38.32, 0)}),
    "shen": dict(length=140, engines=[(-66.53, -16.84, 10.45, 50), (-66.65, 0, 10.45, 62), (-66.53, 16.84, 10.45, 50)],
                 mounts={"e1": (6.27, -26.47), "e2": (6.27, 26.47), "e3": (18.46, -16.60), "e4": (18.46, 16.49)}),
}


def to_pixel(src, x, y):
    k = 512 / (SOURCES[src]["length"] * SPRITE)
    return 256 + y * k, 256 - x * k


def tint(img, saturation=1.0, brightness=1.0, colour=None):
    r, g, b, a = img.split()
    rgb = Image.merge("RGB", (r, g, b))
    rgb = ImageEnhance.Color(rgb).enhance(saturation)
    rgb = ImageEnhance.Brightness(rgb).enhance(brightness)
    if colour:
        rgb = ImageChops.multiply(rgb, Image.new("RGB", rgb.size, colour))
    return Image.merge("RGBA", (*rgb.split(), a))


class Hull:
    def __init__(self):
        self.canvas = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
        self.points = []  # (kind, label, px, py, extra)

    def add(self, src, scale=1.0, dx=0, dy=0, crop=None, engines=True, mounts=(), label="",
            sx=1.0, **look):
        """Place a source sprite; dx/dy are offsets of its centre in 512-space."""
        img = Image.open(SRC / f"{src}.png").convert("RGBA")
        if look:
            img = tint(img, **look)
        if crop:  # keep only a vertical strip (x0, x1) of the source
            mask = Image.new("L", img.size, 0)
            mask.paste(255, (crop[0], 0, crop[1], 512))
            img.putalpha(ImageChops.multiply(img.getchannel("A"), mask))
        w, h = round(512 * scale * sx), round(512 * scale)
        img = img.resize((w, h), Image.LANCZOS)
        left, top = round(512 + dx - w / 2), round(512 + dy - h / 2)
        # Contact shadow so an upper layer reads as sitting on the lower one.
        shadow = Image.new("RGBA", img.size, (0, 0, 0, 0))
        shadow.putalpha(img.getchannel("A").filter(ImageFilter.GaussianBlur(5)).point(lambda v: v * 0.55))
        under = self.canvas.getchannel("A")
        layer = Image.new("RGBA", self.canvas.size, (0, 0, 0, 0))
        layer.paste(shadow, (left, top))
        layer.putalpha(ImageChops.multiply(layer.getchannel("A"), under))
        self.canvas = Image.alpha_composite(self.canvas, layer)
        self.canvas.alpha_composite(img, (left, top))

        def place(px, py):
            return left + px * scale * sx, top + py * scale

        if engines:
            for x, y, width, length in SOURCES[src]["engines"]:
                px, py = to_pixel(src, x, y)
                if crop and not (crop[0] <= px <= crop[1]):
                    continue
                unit = scale * SOURCES[src]["length"]  # converted to new units later
                self.points.append(("engine", "", *place(px, py), (width / SOURCES[src]["length"], length / SOURCES[src]["length"], scale)))
        for m in mounts:
            px, py = to_pixel(src, *SOURCES[src]["mounts"][m])
            self.points.append(("mount", label + m, *place(px, py), None))
        return self

    def finish(self, name, length, style):
        # Ignore near-transparent fringe pixels; they skew the centre line.
        box = self.canvas.getchannel("A").point(lambda v: 255 if v > 40 else 0).getbbox()
        h = box[3] - box[1]
        k = 500 / h  # hull length fills the sprite, like the originals
        cx, cy = (box[0] + box[2]) / 2, (box[1] + box[3]) / 2
        size = (round(1024 * k), round(1024 * k))
        img = self.canvas.resize(size, Image.LANCZOS)
        out = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
        out.alpha_composite(img, (round(256 - cx * k), round(256 - cy * k)))
        OUT.mkdir(parents=True, exist_ok=True)
        out.save(OUT / f"{name}.png", optimize=True)
        unit = length * SPRITE / 512

        def body(px, py):
            fx, fy = 256 + (px - cx) * k, 256 + (py - cy) * k
            return round((256 - fy) * unit, 2), round((fx - 256) * unit, 2)

        engines, mounts = [], {}
        for kind, label, px, py, extra in self.points:
            x, y = body(px, py)
            if kind == "engine":
                w, l, s = extra
                grow = s * k * 512 * unit  # source-length units → new units
                engines.append(dict(x=x, y=y, width=round(w * grow, 2), length=round(l * grow), style=style))
            elif label in MOUNT_IDS[name]:
                mounts[MOUNT_IDS[name][label]] = [x, y]
        if name == "xinyue":
            mounts["e3"] = [22, 0]  # bow hardpoint has no painted turret
        width = round((box[2] - box[0]) / h * length)
        return dict(length=length, width=width, engineSlots=engines, mountPoints=mounts)


def build():
    specs = {}
    iron = dict(saturation=0.35, brightness=0.78, colour=(215, 205, 195))
    cool = dict(saturation=0.0, brightness=1.12, colour=(214, 222, 232))
    pale = dict(saturation=0.0, brightness=1.75, colour=(232, 236, 240))

    # 低科技 驱逐：三体铁舰——赤螯主体夹两具副舰体
    h = Hull()
    for side in (-1, 1):
        h.add("xia", 0.62, dx=side * 86, dy=92, mounts=("b1",) if side < 0 else ("b2",), label="L" if side < 0 else "R", **iron)
    h.add("xia", 1.0, mounts=("b1", "b2", "m1"), label="C", **iron)
    specs["tieao"] = h.finish("tieao", 150, "low")

    # 低科技 主力：双玄甲并联，赤铜脊舰压顶
    h = Hull()
    for side in (-1, 1):
        h.add("xie", 0.7, dx=side * 112, dy=40, mounts=("b1", "b2", "b3", "m1"), label="L" if side < 0 else "R")
    h.add("xia", 0.92, dy=-40, engines=False, mounts=("m1", "b1", "b2"), label="C", saturation=0.7, brightness=0.8)
    specs["fuyue"] = h.finish("fuyue", 330, "low")

    # 中科技 护卫：赤螯船型换天兵涂装
    h = Hull()
    h.add("xia", 1.0, sx=1.12, mounts=("b1", "b2", "m1"), label="C", **cool)
    specs["shaoji"] = h.finish("shaoji", 92, "mid")

    # 中科技 巡洋：羽林主体加两具外挂舰体
    h = Hull()
    for side in (-1, 1):
        h.add("tian", 0.68, dx=side * 96, dy=84, mounts=("b1", "e1", "b2"), label="L" if side < 0 else "R")
    h.add("tian", 1.0, mounts=("b1", "e1", "b2"), label="C")
    specs["zhenyue"] = h.finish("zhenyue", 220, "mid")

    # 中科技 主力：灰装甲基座上叠羽林指挥舰
    h = Hull()
    h.add("xie", 0.98, dy=34, mounts=("b2", "b3", "b1", "m1"), label="B", **pale)
    h.add("tian", 0.9, dy=-42, engines=False, mounts=("b1", "e1", "b2"), label="C")
    specs["lingxiao"] = h.finish("lingxiao", 320, "mid")

    # 高科技 护卫：收窄的参水猿船型
    h = Hull()
    h.add("shen", 1.0, sx=0.6, mounts=("e1", "e2"), label="C")
    specs["xinyue"] = h.finish("xinyue", 96, "high")

    # 高科技 巡洋：参水猿加一对后掠外翼舰体
    h = Hull()
    for side in (-1, 1):
        h.add("shen", 0.66, dx=side * 118, dy=96, mounts=("e1", "e2"), label="L" if side < 0 else "R")
    h.add("shen", 1.0, mounts=("e1", "e2", "e3", "e4"), label="C")
    specs["kuimu"] = h.finish("kuimu", 210, "high")

    # 高科技 主力：双体并联，中央前出旗舰体
    h = Hull()
    for side in (-1, 1):
        h.add("shen", 0.8, dx=side * 108, dy=70, mounts=("e1", "e2", "e3", "e4"), label="L" if side < 0 else "R")
    h.add("shen", 0.95, dy=-60, mounts=("e1", "e2", "e3", "e4"), label="C")
    specs["kangjin"] = h.finish("kangjin", 300, "high")

    # Geometry the game reads: nozzle and mount positions that match the art.
    body = json.dumps(specs, ensure_ascii=False, indent=2)
    (ROOT / "miniprogram/core/ship-geometry.js").write_text(
        "// Generated by tools/kitbash_ships.py — do not edit by hand.\n"
        "(function (root) {\n  const geometry = " + body.replace("\n", "\n  ") + ";\n"
        "  if (typeof module !== \"undefined\" && module.exports) module.exports = geometry;\n"
        "  else root.StarShipGeometry = geometry;\n"
        "})(typeof globalThis !== \"undefined\" ? globalThis : this);\n")
    return specs


if __name__ == "__main__":
    for name, spec in build().items():
        size = (OUT / f"{name}.png").stat().st_size
        print(f"{name:9s} {spec['length']:3d}×{spec['width']:3d}  engines {len(spec['engineSlots']):2d}  mounts {len(spec['mountPoints']):2d}  {size:,} bytes")

#!/usr/bin/env python3
"""Layered combat sound set for the Web Audio engine (v0.4).

Original synthesis, Python standard library only. Unlike generate_audio.py,
every sound here is built from separate layers that are filtered and shaped
independently: a transient, a pitched body that drops in frequency, a noise
tail, then saturation and a short room reflection. Run from the project root:

    python3 tools/generate_sfx.py
"""
import math
from pathlib import Path
import random
import struct
import wave

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "miniprogram/assets/sfx"
SR = 32000
TAU = math.tau


def length(seconds):
    return int(round(seconds * SR))


def noise(n, rng):
    return [rng.uniform(-1, 1) for _ in range(n)]


def lowpass(x, cutoff, poles=2):
    a = 1 - math.exp(-TAU * cutoff / SR)
    for _ in range(poles):
        y, out = 0.0, []
        for v in x:
            y += a * (v - y)
            out.append(y)
        x = out
    return x


def highpass(x, cutoff, poles=1):
    for _ in range(poles):
        low = lowpass(x, cutoff, 1)
        x = [v - l for v, l in zip(x, low)]
    return x


def bandpass(x, low, high):
    return highpass(lowpass(x, high), low)


def sweep(n, f0, f1, rate, shape="sine", phase=0.0):
    """Tone falling (or rising) exponentially from f0 to f1."""
    out, p = [], phase
    for i in range(n):
        t = i / SR
        f = f1 + (f0 - f1) * math.exp(-rate * t)
        p += TAU * f / SR
        s = math.sin(p)
        if shape == "tri":
            s = 2 / math.pi * math.asin(s)
        elif shape == "square":
            s = math.tanh(4 * s)
        out.append(s)
    return out


def decay(x, rate, attack=0.0):
    out = []
    for i, v in enumerate(x):
        t = i / SR
        e = math.exp(-rate * t)
        if attack:
            e *= 1 - math.exp(-t / attack)
        out.append(v * e)
    return out


def gain(x, g):
    return [v * g for v in x]


def mix(*layers):
    n = max(len(l) for l in layers)
    out = [0.0] * n
    for layer in layers:
        for i, v in enumerate(layer):
            out[i] += v
    return out


def shift(x, seconds):
    return [0.0] * length(seconds) + x


def saturate(x, drive):
    k = math.tanh(drive)
    return [math.tanh(v * drive) / k for v in x]


def room(x, taps):
    """A few damped early reflections: cheap sense of mass and space."""
    out = list(x) + [0.0] * length(max(t for t, _ in taps) + 0.02)
    dull = lowpass(x, 1800, 1)
    for delay_s, amount in taps:
        d = length(delay_s)
        for i, v in enumerate(dull):
            out[i + d] += v * amount
    return out


def crackle(n, rng, density, rate):
    """Sparse random ticks: debris and secondary pops."""
    out = [0.0] * n
    for i in range(n):
        if rng.random() < density / SR:
            amp = rng.uniform(0.3, 1) * math.exp(-rate * i / SR)
            for j in range(min(60, n - i)):
                out[i + j] += amp * rng.uniform(-1, 1) * math.exp(-j / 9)
    return out


def finish(x, seconds, peak, loop=False):
    n = length(seconds)
    x = (x + [0.0] * n)[:n]
    if not loop:
        fade_in, fade_out = length(0.0015), length(0.03)
        for i in range(fade_in):
            x[i] *= i / fade_in
        for i in range(fade_out):
            x[n - 1 - i] *= i / fade_out
    top = max(abs(v) for v in x) or 1
    return [v * peak / top for v in x]


def write(name, samples):
    path = OUT / (name + ".wav")
    pcm = [max(-32767, min(32767, round(v * 32767))) for v in samples]
    with wave.open(str(path), "wb") as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(SR)
        f.writeframes(struct.pack("<" + "h" * len(pcm), *pcm))
    return name, len(pcm) / SR, path.stat().st_size


# ── guns ────────────────────────────────────────────────────────────────────
def gun(rng, seconds, body_hz, body_rate, crack_hz, tail_rate, weight, echo):
    n = length(seconds)
    # 1. transient: a few milliseconds of bright noise, the "crack".
    crack = decay(highpass(noise(n, rng), crack_hz), 260)
    snap = decay(bandpass(noise(n, rng), 900, 4200), 70)
    # 2. body: pitch falls fast, which the ear reads as a pressure wave.
    body = decay(sweep(n, body_hz * 2.6, body_hz, 55), body_rate, 0.0008)
    sub = decay(sweep(n, body_hz * 1.4, body_hz * 0.5, 22), body_rate * 0.7, 0.002)
    # Phone speakers cannot reproduce the sub: a midrange knock carries the weight.
    knock = decay(sweep(n, body_hz * 5.2, body_hz * 3.3, 40), body_rate * 1.5,
                  0.0006)
    # 3. tail: dull roar that outlives the shot.
    tail = decay(lowpass(noise(n, rng), 520 + body_hz * 2), tail_rate, 0.004)
    x = mix(gain(crack, 0.9), gain(snap, 0.7), gain(body, 1.0 * weight),
            gain(sub, 0.8 * weight), gain(knock, 0.55 * weight),
            gain(tail, 1.5 * weight))
    x = saturate(x, 2.4)
    return room(x, echo)


def autocannon(rng):
    return gun(rng, 0.2, 150, 42, 3200, 30, 0.75, [(0.031, 0.16)])


def cannon_medium(rng):
    return gun(rng, 0.5, 92, 17, 2400, 11, 1.1, [(0.043, 0.24), (0.097, 0.12)])


def cannon_heavy(rng):
    return gun(rng, 0.95, 54, 8.5, 1900, 5.5, 1.6,
               [(0.052, 0.3), (0.121, 0.18), (0.21, 0.09)])


def plasma(rng):
    n = length(0.32)
    # FM zap: a falling carrier bent by a faster falling modulator.
    out, p, pm = [], 0.0, 0.0
    for i in range(n):
        t = i / SR
        fm = 90 + 900 * math.exp(-16 * t)
        pm += TAU * fm / SR
        f = 210 + 1500 * math.exp(-21 * t) + 260 * math.sin(pm) * math.exp(-9 * t)
        p += TAU * f / SR
        out.append(math.sin(p) + 0.35 * math.sin(2.01 * p))
    tone = decay(out, 11, 0.0012)
    hiss = decay(bandpass(noise(n, rng), 2500, 9000), 30)
    thump = decay(sweep(n, 190, 70, 30), 24)
    return room(saturate(mix(tone, gain(hiss, 0.5), gain(thump, 0.8)), 1.8),
                [(0.037, 0.16)])


def missile(rng):
    n = length(0.6)
    raw = noise(n, rng)
    out, low, band = [], 0.0, 0.0
    for i, v in enumerate(raw):
        t = i / SR
        # The filter opens as the motor lights, then the rocket recedes.
        cutoff = 500 + 3800 * (1 - math.exp(-9 * t)) * math.exp(-2.4 * t)
        a = 1 - math.exp(-TAU * cutoff / SR)
        low += a * (v - low)
        band += 0.02 * (low - band)
        out.append((low - band) * (1 - math.exp(-60 * t)) * math.exp(-3.6 * t))
    pop = decay(sweep(n, 260, 80, 40), 30)
    return saturate(mix(gain(out, 2.2), gain(pop, 0.9)), 1.6)


# ── impacts ─────────────────────────────────────────────────────────────────
def hull_impact(rng, seconds, thud_hz, thud_rate, ring, debris, weight, echo):
    n = length(seconds)
    click = decay(highpass(noise(n, rng), 2600), 320)
    crunch = decay(bandpass(noise(n, rng), 380, 3000), 34 / weight)
    thud = decay(sweep(n, thud_hz * 3, thud_hz, 70), thud_rate, 0.0006)
    # Inharmonic plate modes: struck metal, not a musical note.
    plate = [0.0] * n
    for ratio, amount, rate in ring:
        partial = decay(sweep(n, thud_hz * ratio, thud_hz * ratio * 0.985, 6),
                        rate)
        plate = mix(plate, gain(partial, amount))
    bits = lowpass(crackle(n, rng, debris, 9), 5200, 1)
    rumble = decay(lowpass(noise(n, rng), 300), thud_rate * 0.6, 0.006)
    x = mix(gain(click, 0.9), gain(crunch, 1.1), gain(thud, 1.25 * weight),
            gain(plate, 0.42), gain(shift(bits, 0.02), 0.5),
            gain(rumble, 1.6 * weight))
    return room(saturate(x, 2.6), echo)


def impact_metal(rng):
    return hull_impact(rng, 0.3, 190, 34,
                       [(3.1, 1, 30), (5.4, 0.6, 38), (8.9, 0.35, 50)],
                       40, 0.7, [(0.029, 0.14)])


def impact_solid(rng):
    return hull_impact(rng, 0.5, 112, 18,
                       [(2.7, 1, 19), (4.6, 0.6, 24), (7.3, 0.4, 30),
                        (11.2, 0.2, 40)],
                       70, 1.1, [(0.041, 0.22), (0.09, 0.1)])


def impact_heavy(rng):
    return hull_impact(rng, 0.9, 62, 8.5,
                       [(2.4, 1, 11), (3.9, 0.7, 14), (6.2, 0.45, 18),
                        (9.7, 0.25, 26)],
                       110, 1.7, [(0.055, 0.3), (0.13, 0.16), (0.22, 0.08)])


def impact_shield(rng):
    n = length(0.42)
    # Energy absorption: a soft-edged, detuned downward "fwoomp".
    a = sweep(n, 640, 170, 15)
    b = sweep(n, 652, 174, 15, phase=1.1)
    c = sweep(n, 1290, 350, 17)
    tone = decay(mix(a, b, gain(c, 0.3)), 10, 0.004)
    air = decay(highpass(noise(n, rng), 3500), 24, 0.003)
    thump = decay(sweep(n, 150, 55, 26), 20, 0.002)
    wobble = [1 + 0.25 * math.sin(TAU * 38 * i / SR) for i in range(n)]
    x = mix(gain(tone, 0.6), gain(air, 0.45), gain(thump, 0.9))
    return room([v * w for v, w in zip(x, wobble)], [(0.045, 0.2)])


def impact_plasma(rng):
    n = length(0.36)
    sizzle = decay(bandpass(noise(n, rng), 1800, 8000), 15, 0.001)
    burn = bandpass(crackle(n, rng, 500, 12), 1200, 7000)
    thump = decay(sweep(n, 240, 75, 34), 20)
    tone = decay(sweep(n, 900, 240, 20, "tri"), 18)
    return room(saturate(mix(gain(sizzle, 0.7), gain(burn, 0.7), thump,
                             gain(tone, 0.35)), 2), [(0.035, 0.15)])


def explosion(rng):
    n = length(2.0)
    crack = decay(highpass(noise(n, rng), 1500), 60)
    boom = decay(sweep(n, 150, 30, 9), 3.2, 0.002)
    second = shift(decay(sweep(n, 95, 26, 7), 3.5, 0.004), 0.16)
    roar_noise = noise(n, rng)
    roar, low = [], 0.0
    for i, v in enumerate(roar_noise):
        t = i / SR
        # The fireball starts bright and closes down as it cools.
        a = 1 - math.exp(-TAU * (180 + 2600 * math.exp(-5 * t)) / SR)
        low += a * (v - low)
        roar.append(low * math.exp(-2.4 * t) * (1 - math.exp(-140 * t)))
    debris = lowpass(crackle(n, rng, 160, 3.2), 4200, 1)
    x = mix(gain(crack, 0.9), gain(boom, 1.6), gain(second, 1.0),
            gain(roar, 3.4), gain(shift(debris, 0.07), 0.55))
    return room(saturate(x, 3.0), [(0.07, 0.3), (0.16, 0.2), (0.29, 0.11)])


def overload(rng):
    n = length(0.6)
    # Shields collapsing: ring-modulated falling tone torn by static.
    out = []
    p = 0.0
    for i in range(n):
        t = i / SR
        f = 260 + 1900 * math.exp(-7 * t)
        p += TAU * f / SR
        out.append(math.sin(p) * math.sin(TAU * 73 * t))
    tone = decay(out, 5.5, 0.002)
    static = bandpass(crackle(n, rng, 900, 5), 1500, 9000)
    drop = decay(sweep(n, 220, 45, 9), 8)
    return room(saturate(mix(gain(tone, 0.8), gain(static, 0.9),
                             gain(drop, 0.9)), 2.2), [(0.05, 0.2)])


# ── beds (seamless loops: every component completes whole cycles) ────────────
def loop(seconds, partials, tremolo=()):
    n = length(seconds)
    out = []
    for i in range(n):
        t = i / SR
        v = sum(a * math.sin(TAU * f * t + ph) for f, a, ph in partials)
        for f, depth in tremolo:
            v *= 1 + depth * math.sin(TAU * f * t)
        out.append(v)
    return out


def beam_loop():
    return loop(1.0, [(55, 0.5, 0), (110, 1, 0.4), (220, 0.42, 1.3),
                      (331, 0.3, 0.2), (443, 0.2, 2.1), (662, 0.12, 0.9),
                      (1105, 0.06, 1.7)], [(23, 0.12), (7, 0.06)])


def beam_pd_loop():
    return loop(1.0, [(173, 1, 0), (347, 0.3, 0.7), (521, 0.18, 1.9),
                      (1042, 0.08, 0.3)], [(31, 0.15)])


def ambient_loop():
    # A ship's bridge: deep reactor hum that slowly breathes.
    return loop(2.0, [(41, 1, 0), (41.5, 0.8, 1.0), (61.5, 0.45, 2.0),
                      (82.5, 0.3, 0.5), (123.5, 0.2, 1.4), (247, 0.06, 0.3)],
                [(0.5, 0.25), (1.5, 0.1)])


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    spec = [
        ("kinetic", autocannon, 0.24, 0.8),
        ("cannon_medium", cannon_medium, 0.62, 0.85),
        ("cannon_heavy", cannon_heavy, 1.2, 0.9),
        ("plasma", plasma, 0.38, 0.75),
        ("missile", missile, 0.6, 0.7),
        ("impact_metal", impact_metal, 0.34, 0.85),
        ("impact_solid", impact_solid, 0.6, 0.88),
        ("impact_heavy", impact_heavy, 1.15, 0.9),
        ("impact_shield", impact_shield, 0.48, 0.75),
        ("impact_plasma", impact_plasma, 0.4, 0.8),
        ("explosion", explosion, 2.3, 0.92),
        ("shield", overload, 0.66, 0.75),
    ]
    rows = []
    for name, build, seconds, peak in spec:
        rng = random.Random(90210 + sum(map(ord, name)))
        rows.append(write(name, finish(build(rng), seconds, peak)))
    for name, build, seconds, peak in [("beam_loop", beam_loop, 1.0, 0.45),
                                       ("beam_pd_loop", beam_pd_loop, 1.0, 0.3),
                                       ("ambient_loop", ambient_loop, 2.0, 0.5)]:
        rows.append(write(name, finish(build(), seconds, peak, loop=True)))
    total = sum(r[2] for r in rows)
    for name, seconds, size in rows:
        print(f"{name:16s} {seconds:5.2f}s {size:8,d} bytes")
    print(f"total {total:,} bytes")
    assert total < 1_100_000


if __name__ == "__main__":
    main()

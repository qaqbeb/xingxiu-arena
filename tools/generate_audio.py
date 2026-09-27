#!/usr/bin/env python3
"""Original, reproducible procedural game sounds; Python standard library only."""
import math
from pathlib import Path
import random
import struct
import wave

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'miniprogram/assets/audio'
SR = 22050
TAU = math.tau

def make(name, duration, synth, peak=.75, loop=False):
    rng = random.Random(14037 + sum(map(ord, name)))
    count = round(duration * SR)
    data = []
    for i in range(count):
        t = i / SR
        # Gentle onset and exact silent endpoints prevent waveform discontinuities.
        fade = min(1.0, i / (SR * .003), (count - 1 - i) / (SR * .018))
        data.append(synth(t, rng) * (1 if loop else max(0, fade)))
    gain = peak / max(abs(x) for x in data)
    pcm = [round(x * gain * 32767) for x in data]
    path = OUT / (name + '.wav')
    with wave.open(str(path), 'wb') as f:
        f.setnchannels(1); f.setsampwidth(2); f.setframerate(SR)
        f.writeframes(struct.pack('<' + 'h' * len(pcm), *pcm))
    with wave.open(str(path), 'rb') as f:
        n = f.getnframes()
        samples = struct.unpack('<' + 'h' * n, f.readframes(n))
        assert f.getnchannels() == 1 and f.getsampwidth() == 2
        assert abs(samples[0] - samples[-1]) < 3000 if loop else samples[0] == samples[-1] == 0
        actual_peak = max(map(abs, samples)) / 32767
        assert actual_peak <= .75003
        return (name + '.wav', n / SR, actual_peak, path.stat().st_size)

def sine(f,t): return math.sin(TAU*f*t)
def noise(r): return r.uniform(-1,1)

def ui(t,r):
    return (sine(920,t)+.25*sine(1380,t))*math.exp(-48*t)

def kinetic(t,r):
    # Falling membrane body with two metallic overtones and a brief barrel transient.
    return .9*math.sin(TAU*(90*t+1.2*(1-math.exp(-45*t))))*math.exp(-21*t) + .18*sine(427,t)*math.exp(-38*t) + .25*noise(r)*math.exp(-110*t)

def missile(t,r):
    # Smooth resonant filtered noise conveys thrust without a sharp explosion.
    missile.low = .86*missile.low + .14*noise(r)
    env = (1-math.exp(-65*t))*math.exp(-9*t)
    return env*(missile.low*1.7+.17*math.sin(TAU*(210*t+110*t*t)))
missile.low = 0

def plasma(t,r):
    phase = TAU*(220*t+2.1*(1-math.exp(-27*t)))
    return (math.sin(phase)+.19*math.sin(2.006*phase))*math.exp(-16*t)*(1+.15*sine(37,t))

def explosion(t,r):
    explosion.low = .94*explosion.low + .06*noise(r)
    body = math.sin(TAU*(39*t+.8*(1-math.exp(-13*t))))*math.exp(-5*t)
    grit = noise(r)*math.exp(-14*t)*(.3+.15*sine(27,t))
    tail = explosion.low*2.8*math.exp(-3.5*t)+.16*sine(48,t)*math.exp(-5*t)*(1-math.exp(-30*t))
    return .6*body + grit + tail
explosion.low = 0

def victory(t,r):
    total = 0
    for start, f in [(0,523.25),(.16,659.25),(.32,783.99)]:
        dt = t-start
        if dt >= 0:
            env = (1-math.exp(-170*dt))*math.exp(-11*dt)
            total += env*(sine(f,dt)+.12*sine(2*f,dt))
    return total

def shield(t,r):
    return (sine(1420,t)+.43*sine(2087,t)+.2*sine(3191,t))*math.exp(-17*t)+.025*noise(r)*math.exp(-70*t)

def thrust(t,r):
    # Short tapered low engine bed. UI may retrigger at ~180 ms while thrusting.
    thrust.low = .93*thrust.low + .07*noise(r)
    phase = TAU*(51*t+8*t*t)
    return (.6*math.sin(phase)+.22*math.sin(phase*2.03)+thrust.low*1.7)*(1+.18*sine(13,t))
thrust.low = 0

def strafe(t,r):
    strafe.low = .72*strafe.low + .28*noise(r)
    return (.65*strafe.low+.24*sine(155,t))*math.exp(-12*t)
strafe.low = 0

def vent(t,r):
    vent.low = .6*vent.low + .4*noise(r)
    return (noise(r)-vent.low)*.5*(1-math.exp(-38*t))*math.exp(-4*t)+.06*sine(280,t)*math.exp(-8*t)
vent.low = 0

def system(t,r):
    phase = TAU*(180*t+760*t*t)
    return (math.sin(phase)+.21*math.sin(phase*1.5))*math.exp(-7*t)*(1-math.exp(-60*t))

def beam(t,r):
    return (sine(340,t)+.22*sine(680,t)+.1*sine(1027,t))*(1+.14*sine(41,t))*math.exp(-4*t)

def impact_metal(t,r):
    clang = sum(a*sine(f,t)*math.exp(-d*t) for a,f,d in [(1,188,25),(.38,463,20),(.16,917,31)])
    return .5*clang+.25*noise(r)*math.exp(-95*t)

def impact_shield(t,r):
    phase = TAU*(330*t+2*(1-math.exp(-20*t)))
    return (math.sin(phase)+.3*math.sin(phase*1.43))*math.exp(-14*t)*(1+.15*sine(42,t))+.18*sine(81,t)*math.exp(-20*t)

def impact_heavy(t,r):
    impact_heavy.low = .91*impact_heavy.low+.09*noise(r)
    return .7*math.sin(TAU*(46*t+.6*(1-math.exp(-35*t))))*math.exp(-8*t)+.65*impact_heavy.low*math.exp(-10*t)+.16*sine(221,t)*math.exp(-30*t)
impact_heavy.low = 0

def impact_beam(t,r):
    # Hot continuous contact: electric hiss and a narrow resonant sizzle, no metal knock.
    env = (1-math.exp(-150*t))*min(1, max(0, (.24-t)/.04))
    return env*(.27*noise(r)+.15*sine(1730,t)+.08*sine(2641,t))*(.8+.2*sine(83,t))

def impact_beam_shield(t,r):
    env = (1-math.exp(-100*t))*min(1, max(0, (.24-t)/.05))
    return env*(.35*sine(720,t)+.19*sine(1087,t)+.06*noise(r))*(.8+.2*sine(55,t))

def impact_plasma(t,r):
    phase = TAU*(170*t+2.6*(1-math.exp(-32*t)))
    return (.6*math.sin(phase)+.27*noise(r)*math.exp(-18*t))*math.exp(-12*t)

def cannon_voice(tier, contact=False, variant=0):
    # Original layered percussion: sharp crack, damped plate modes, filtered debris.
    # Midrange body remains audible on phone speakers even for the largest gun.
    low = 0.0
    band = 0.0
    tune = [1.0, .957, 1.041][variant]
    def synth(t, r):
        nonlocal low, band
        n = noise(r)
        low += (.09 if tier == 2 else .17) * (n-low)
        band += .52 * (n-band)
        crack = (n-band)*math.exp(-t*(115 if contact else 160))
        base = ([240, 155, 94] if contact else [205, 125, 72])[tier]*tune
        decay = [28, 17, 10][tier]
        body = math.sin(TAU*(base*t + .8*(1-math.exp(-65*t))))*math.exp(-decay*t)
        plate = sum(a*sine(base*ratio,t)*math.exp(-d*t) for a,ratio,d in
                    [(.30,2.73,decay*1.25),(.17,4.91,decay*1.7),(.08,8.17,decay*2)])
        grit = (band-low)*math.exp(-t*([34,20,12][tier]))
        rumble = low*math.exp(-t*([22,12,7][tier]))*(1-math.exp(-90*t))
        # Impact fragments arrive after the initial strike rather than a long pure tone.
        fragments = 0
        if contact:
            for delay, amount in [(.021,.20),(.047,.12),(.083,.07)]:
                if t >= delay:
                    fragments += amount*(n-band)*math.exp(-(t-delay)*90)
        return 1.8*crack + .38*body + (.55 if contact else .15)*plate + 2.0*grit + (tier+1)*.6*rumble + fragments
    return synth

OUT.mkdir(parents=True,exist_ok=True)
rows = [make('ui',.09,ui,.50),make('kinetic',.16,cannon_voice(0)),make('missile',.30,missile,.65),make('plasma',.24,plasma,.62),make('explosion',1.2,explosion),make('victory',.72,victory,.62),make('shield',.24,shield,.55),make('thrust',.30,thrust,.52),make('strafe',.14,strafe,.30),make('vent',.55,vent,.38),make('system',.38,system,.48),make('beam',.18,beam,.48),make('impact_metal',.28,cannon_voice(0,True),.73),make('impact_shield',.32,impact_shield,.68),make('impact_heavy',.58,cannon_voice(2,True),.75)]
rows += [make('impact_beam',.24,impact_beam,.54),make('impact_beam_shield',.24,impact_beam_shield,.54),make('impact_plasma',.30,impact_plasma,.68)]
# Three fixed variations per family; runtime rotates them without combat RNG.
families = [('kinetic',.16,0,False),('cannon_medium',.32,1,False),('cannon_heavy',.55,2,False),
            ('impact_metal',.28,0,True),('impact_solid',.42,1,True),('impact_heavy',.58,2,True)]
existing = {row[0] for row in rows}
for name, duration, tier, contact in families:
    for variant in range(3):
        filename = name if variant == 0 else f'{name}_{variant+1}'
        if filename+'.wav' not in existing:
            rows.append(make(filename,duration,cannon_voice(tier,contact,variant),.73 if contact else .70))
# Whole-number frequencies form seamless one-second loops, with no repeated attacks.
rows += [make('beam_loop',1,lambda t,r: .8*sine(110,t)+.18*sine(220,t)+.09*sine(317,t)+.04*sine(419,t),.38,True),
         make('beam_pd_loop',1,lambda t,r: .65*sine(173,t)+.12*sine(346,t)+.05*sine(521,t),.28,True)]
# Native and browser receive the same distant timbre: two-pole lowpass, no renormalization.
for name,duration,peak,bytes_ in list(rows):
    if '_loop' in name: continue
    with wave.open(str(OUT/name),'rb') as f:
        samples=struct.unpack('<'+'h'*f.getnframes(),f.readframes(f.getnframes()))
    a=b=0.0
    filtered=[]
    for i,value in enumerate(samples):
        a += .18*(value-a); b += .18*(a-b)
        tail=min(1,(len(samples)-1-i)/(SR*.018))
        filtered.append(round(b*max(0,tail)))
    farname=name.replace('.wav','_far.wav')
    with wave.open(str(OUT/farname),'wb') as f:
        f.setnchannels(1);f.setsampwidth(2);f.setframerate(SR)
        f.writeframes(struct.pack('<'+'h'*len(filtered),*filtered))
    rows.append((farname,duration,max(map(abs,filtered))/32767,(OUT/farname).stat().st_size))
# Validate every encoded near/far/loop asset, not just generator buffers.
for name, duration, peak, bytes_ in rows:
    with wave.open(str(OUT/name), 'rb') as f:
        assert f.getframerate()==SR and f.getnchannels()==1 and f.getsampwidth()==2
        samples=struct.unpack('<'+'h'*f.getnframes(), f.readframes(f.getnframes()))
    assert max(map(abs,samples)) <= 24576
    if '_loop' not in name: assert samples[0]==samples[-1]==0
size = sum(row[3] for row in rows)
assert size < 1_500_000
lines = ['# Original procedural audio', '', 'All assets are original mathematical synthesis. No external samples, downloads, recordings, or third-party audio were used.', '', '## Reproduce', '', 'From the project root, run `python3 tools/generate_audio.py`. The generator uses only Python standard library `wave`, `math`, seeded `random`, `struct`, and `pathlib`. It writes the WAV assets and this readback report.', '', 'All files are uncompressed PCM, 22,050 Hz, mono, signed 16-bit little-endian WAV. A 3 ms onset and 18 ms endpoint fade prevent clicks; one-shot endpoints are zero. Continuous beam loops instead use periodic integer-frequency waveforms, with boundary continuity checked. Peak levels are normalized per sound, with maximum target 0.75 full scale to leave mixing headroom. Adapters use a 0.9 master gain, moderate overlap attenuation and a bounded voice count.', '', '## Readback validation', '', '| File | Duration (seconds) | Absolute peak / full scale | Bytes |', '|---|---:|---:|---:|']
for name,duration,peak,bytes_ in rows:
    lines.append(f'| `{name}` | {duration:.5f} | {peak:.5f} | {bytes_:,} |')
lines += ['', f'Total WAV size: **{size:,} bytes**, below 1.5 MB. All channel counts, sample widths, endpoint samples, and peak limits were asserted after reopening each encoded WAV.', '', '## Sound design', '', '- `ui.wav`: soft, short positive click with a clear harmonic overtone; reduced peak.', '- `kinetic.wav`: light cannon crack, damped midrange body and filtered barrel noise; three variants.', '- `missile.wav`: gently rising filtered noise thrust plus a subtle upward oscillator sweep.', '- `plasma.wav`: clean descending science-fiction pulse with restrained modulation.', '- `explosion.wav`: low falling sine body, decaying broadband debris, and a filtered rumbling tail; 1.2 seconds.', '- `victory.wav`: restrained ascending three-note C–E–G confirmation, with overlapping exponential decay.', '- `impact_metal.wav`: dense hull knock and short inharmonic resonance.', '- `impact_beam.wav`: electric contact hiss and hot cutting sizzle, no ballistic knock.', '- `impact_beam_shield.wav`: resonant shield interference while a beam makes contact.', '- `impact_plasma.wav`: collapsing energy pulse and a brief crackling tail.', '- `impact_shield.wav`: modulated energy absorption, distinct from hull impacts.', '- `impact_heavy.wav`: heavy hull strike with broadband crack, audible midrange body, plate modes and delayed fragments; three variants.', '- `shield.wav`: bright glassy inharmonic impact with a soft noise transient.', '- `thrust.wav`: tapered varying 51 Hz engine bed with filtered turbulence; retrigger at about 180 ms while accelerating, stop triggering on release.', '- `strafe.wav`: quieter, brief filtered side-thruster burst.', '- `vent.wav`: high-passed noise releasing pressure, distinct from an explosion.', '- `system.wav`: rising low-to-mid oscillator charge cue.', '- `beam.wav`: restrained harmonic hum for short beam pulses.', '', 'Recommended event names: impact_metal for hull strikes, impact_shield for shield absorption, impact_heavy for large projectile strikes, explosion for destruction. Both adapters expose playSound(name, volume=1); volume is clamped to 0–1 and multiplied by a 0.9 master level. Each sound has up to three independent voices, with a global limit of 12 active voices. Repeated effects within 65 ms are coalesced (UI clicks: 35 ms); overlapping instances and busy scenes receive additional gain attenuation. UI can further attenuate other ships by distance and priority. Hidden/blurred sessions stop audio; unavailable, blocked, or failed playback is ignored safely. Mute is controlled by GameUI. Beam audio uses two bounded continuous voices, quiet point-defense levels and stop/fade lifecycle handling; no per-hit beam hiss is played.']
lines += ['', '## Ballistic sound families', '', 'Light: kinetic / impact_metal. Medium: cannon_medium / impact_solid. Heavy: cannon_heavy / impact_heavy. Each has three original variations (base, _2, _3); runtime rotates variants without touching combat randomness. Crack, damped plate resonance, midrange body and filtered debris are synthesized separately. Shield assets are unchanged. Four of twelve one-shot voice slots are reserved for impacts; two additional quiet beam loop voices are bounded separately; at capacity an impact can replace a firing/engine voice. Hull hit gain favors the flagship and its attacks.']
lines += ['', 'Distance uses world coordinates around the camera, independent of zoom and shooter ownership. Distant one-shots use a two-pole lowpass variant. Heavy contacts duck beam beds for 160 ms. All audio remains independently synthesized; original game audio is reference material only.']
(ROOT/'AUDIO.md').write_text('\n'.join(lines)+'\n')
print('\n'.join(lines[lines.index('| File | Duration (seconds) | Absolute peak / full scale | Bytes |'):lines.index('## Sound design')]))

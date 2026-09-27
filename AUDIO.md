# Original procedural audio

All assets are original mathematical synthesis. No external samples, downloads, recordings, or third-party audio were used.

## Reproduce

From the project root, run `python3 tools/generate_audio.py`. The generator uses only Python standard library `wave`, `math`, seeded `random`, `struct`, and `pathlib`. It writes the WAV assets and this readback report.

All files are uncompressed PCM, 22,050 Hz, mono, signed 16-bit little-endian WAV. A 3 ms onset and 18 ms endpoint fade prevent clicks; one-shot endpoints are zero. Continuous beam loops instead use periodic integer-frequency waveforms, with boundary continuity checked. Peak levels are normalized per sound, with maximum target 0.75 full scale to leave mixing headroom. Adapters use a 0.9 master gain, moderate overlap attenuation and a bounded voice count.

## Readback validation

| File | Duration (seconds) | Absolute peak / full scale | Bytes |
|---|---:|---:|---:|
| `ui.wav` | 0.08998 | 0.50002 | 4,012 |
| `kinetic.wav` | 0.16000 | 0.74999 | 7,100 |
| `missile.wav` | 0.30000 | 0.65001 | 13,274 |
| `plasma.wav` | 0.24000 | 0.62001 | 10,628 |
| `explosion.wav` | 1.20000 | 0.74999 | 52,964 |
| `victory.wav` | 0.72000 | 0.62001 | 31,796 |
| `shield.wav` | 0.24000 | 0.55000 | 10,628 |
| `thrust.wav` | 0.30000 | 0.52000 | 13,274 |
| `strafe.wav` | 0.14000 | 0.30000 | 6,218 |
| `vent.wav` | 0.55002 | 0.37999 | 24,300 |
| `system.wav` | 0.38000 | 0.48000 | 16,802 |
| `beam.wav` | 0.18000 | 0.48000 | 7,982 |
| `impact_metal.wav` | 0.28000 | 0.73000 | 12,392 |
| `impact_shield.wav` | 0.32000 | 0.68001 | 14,156 |
| `impact_heavy.wav` | 0.58000 | 0.74999 | 25,622 |
| `impact_beam.wav` | 0.24000 | 0.53999 | 10,628 |
| `impact_beam_shield.wav` | 0.24000 | 0.53999 | 10,628 |
| `impact_plasma.wav` | 0.30000 | 0.68001 | 13,274 |
| `kinetic_2.wav` | 0.16000 | 0.70000 | 7,100 |
| `kinetic_3.wav` | 0.16000 | 0.70000 | 7,100 |
| `cannon_medium.wav` | 0.32000 | 0.70000 | 14,156 |
| `cannon_medium_2.wav` | 0.32000 | 0.70000 | 14,156 |
| `cannon_medium_3.wav` | 0.32000 | 0.70000 | 14,156 |
| `cannon_heavy.wav` | 0.55002 | 0.70000 | 24,300 |
| `cannon_heavy_2.wav` | 0.55002 | 0.70000 | 24,300 |
| `cannon_heavy_3.wav` | 0.55002 | 0.70000 | 24,300 |
| `impact_metal_2.wav` | 0.28000 | 0.73000 | 12,392 |
| `impact_metal_3.wav` | 0.28000 | 0.73000 | 12,392 |
| `impact_solid.wav` | 0.42000 | 0.73000 | 18,566 |
| `impact_solid_2.wav` | 0.42000 | 0.73000 | 18,566 |
| `impact_solid_3.wav` | 0.42000 | 0.73000 | 18,566 |
| `impact_heavy_2.wav` | 0.58000 | 0.73000 | 25,622 |
| `impact_heavy_3.wav` | 0.58000 | 0.73000 | 25,622 |
| `beam_loop.wav` | 1.00000 | 0.37999 | 44,144 |
| `beam_pd_loop.wav` | 1.00000 | 0.28001 | 44,144 |
| `ui_far.wav` | 0.08998 | 0.17380 | 4,012 |
| `kinetic_far.wav` | 0.16000 | 0.18586 | 7,100 |
| `missile_far.wav` | 0.30000 | 0.38874 | 13,274 |
| `plasma_far.wav` | 0.24000 | 0.53417 | 10,628 |
| `explosion_far.wav` | 1.20000 | 0.63143 | 52,964 |
| `victory_far.wav` | 0.72000 | 0.34349 | 31,796 |
| `shield_far.wav` | 0.24000 | 0.08808 | 10,628 |
| `thrust_far.wav` | 0.30000 | 0.45927 | 13,274 |
| `strafe_far.wav` | 0.14000 | 0.16657 | 6,218 |
| `vent_far.wav` | 0.55002 | 0.12183 | 24,300 |
| `system_far.wav` | 0.38000 | 0.42433 | 16,802 |
| `beam_far.wav` | 0.18000 | 0.38630 | 7,982 |
| `impact_metal_far.wav` | 0.28000 | 0.22062 | 12,392 |
| `impact_shield_far.wav` | 0.32000 | 0.51399 | 14,156 |
| `impact_heavy_far.wav` | 0.58000 | 0.32926 | 25,622 |
| `impact_beam_far.wav` | 0.24000 | 0.11881 | 10,628 |
| `impact_beam_shield_far.wav` | 0.24000 | 0.21186 | 10,628 |
| `impact_plasma_far.wav` | 0.30000 | 0.45820 | 13,274 |
| `kinetic_2_far.wav` | 0.16000 | 0.20176 | 7,100 |
| `kinetic_3_far.wav` | 0.16000 | 0.21741 | 7,100 |
| `cannon_medium_far.wav` | 0.32000 | 0.25831 | 14,156 |
| `cannon_medium_2_far.wav` | 0.32000 | 0.22147 | 14,156 |
| `cannon_medium_3_far.wav` | 0.32000 | 0.26606 | 14,156 |
| `cannon_heavy_far.wav` | 0.55002 | 0.26234 | 24,300 |
| `cannon_heavy_2_far.wav` | 0.55002 | 0.33332 | 24,300 |
| `cannon_heavy_3_far.wav` | 0.55002 | 0.29460 | 24,300 |
| `impact_metal_2_far.wav` | 0.28000 | 0.21540 | 12,392 |
| `impact_metal_3_far.wav` | 0.28000 | 0.20951 | 12,392 |
| `impact_solid_far.wav` | 0.42000 | 0.25813 | 18,566 |
| `impact_solid_2_far.wav` | 0.42000 | 0.30757 | 18,566 |
| `impact_solid_3_far.wav` | 0.42000 | 0.27705 | 18,566 |
| `impact_heavy_2_far.wav` | 0.58000 | 0.32762 | 25,622 |
| `impact_heavy_3_far.wav` | 0.58000 | 0.29646 | 25,622 |

Total WAV size: **1,182,232 bytes**, below 1.5 MB. All channel counts, sample widths, endpoint samples, and peak limits were asserted after reopening each encoded WAV.

## Sound design

- `ui.wav`: soft, short positive click with a clear harmonic overtone; reduced peak.
- `kinetic.wav`: light cannon crack, damped midrange body and filtered barrel noise; three variants.
- `missile.wav`: gently rising filtered noise thrust plus a subtle upward oscillator sweep.
- `plasma.wav`: clean descending science-fiction pulse with restrained modulation.
- `explosion.wav`: low falling sine body, decaying broadband debris, and a filtered rumbling tail; 1.2 seconds.
- `victory.wav`: restrained ascending three-note C–E–G confirmation, with overlapping exponential decay.
- `impact_metal.wav`: dense hull knock and short inharmonic resonance.
- `impact_beam.wav`: electric contact hiss and hot cutting sizzle, no ballistic knock.
- `impact_beam_shield.wav`: resonant shield interference while a beam makes contact.
- `impact_plasma.wav`: collapsing energy pulse and a brief crackling tail.
- `impact_shield.wav`: modulated energy absorption, distinct from hull impacts.
- `impact_heavy.wav`: heavy hull strike with broadband crack, audible midrange body, plate modes and delayed fragments; three variants.
- `shield.wav`: bright glassy inharmonic impact with a soft noise transient.
- `thrust.wav`: tapered varying 51 Hz engine bed with filtered turbulence; retrigger at about 180 ms while accelerating, stop triggering on release.
- `strafe.wav`: quieter, brief filtered side-thruster burst.
- `vent.wav`: high-passed noise releasing pressure, distinct from an explosion.
- `system.wav`: rising low-to-mid oscillator charge cue.
- `beam.wav`: restrained harmonic hum for short beam pulses.

Recommended event names: impact_metal for hull strikes, impact_shield for shield absorption, impact_heavy for large projectile strikes, explosion for destruction. Both adapters expose playSound(name, volume=1); volume is clamped to 0–1 and multiplied by a 0.9 master level. Each sound has up to three independent voices, with a global limit of 12 active voices. Repeated effects within 65 ms are coalesced (UI clicks: 35 ms); overlapping instances and busy scenes receive additional gain attenuation. UI can further attenuate other ships by distance and priority. Hidden/blurred sessions stop audio; unavailable, blocked, or failed playback is ignored safely. Mute is controlled by GameUI. Beam audio uses two bounded continuous voices, quiet point-defense levels and stop/fade lifecycle handling; no per-hit beam hiss is played.

## Ballistic sound families

Light: kinetic / impact_metal. Medium: cannon_medium / impact_solid. Heavy: cannon_heavy / impact_heavy. Each has three original variations (base, _2, _3); runtime rotates variants without touching combat randomness. Crack, damped plate resonance, midrange body and filtered debris are synthesized separately. Shield assets are unchanged. Four of twelve one-shot voice slots are reserved for impacts; two additional quiet beam loop voices are bounded separately; at capacity an impact can replace a firing/engine voice. Hull hit gain favors the flagship and its attacks.

Distance uses world coordinates around the camera, independent of zoom and shooter ownership. Distant one-shots use a two-pole lowpass variant. Heavy contacts duck beam beds for 160 ms. All audio remains independently synthesized; original game audio is reference material only.

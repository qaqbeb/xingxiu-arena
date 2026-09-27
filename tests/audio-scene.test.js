"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const A = require("../miniprogram/core/battle-audio");
const catalog = require("../miniprogram/core/ships");
test("distance attenuates in world coordinates independent of camera zoom", () => {
  const camera = { x: 100, y: 100, scale: 1 };
  const near = A.spatial(camera, 200, 100),
    far = A.spatial(camera, 1300, 100);
  assert(near.gain > far.gain * 5);
  assert.equal(near.far, false);
  assert.equal(far.far, true);
  assert.equal(A.spatial({ ...camera, scale: 0.1 }, 1300, 100).gain, far.gain);
  assert.equal(A.spatial(camera, 3100, 100).gain, 0);
});
test("many beams have a quiet bounded bed and point defense is quieter", () => {
  const ui = {
    sound: true,
    screen: "battle",
    camera: { x: 0, y: 0 },
    battle: { status: "active", beams: [] },
  };
  ui.battle.beams = Array.from({ length: 30 }, () => ({
    weaponId: "fuling",
    x: 0,
    y: 0,
  }));
  const beam = A.beams(ui, catalog);
  assert.equal(beam.length, 1);
  assert(beam[0].volume <= 0.18);
  ui.battle.beams = [{ weaponId: "zhaoyao", x: 0, y: 0 }];
  assert(A.beams(ui, catalog)[0].volume < beam[0].volume / 4);
  ui.paused = true;
  assert.deepEqual(A.beams(ui, catalog), []);
});
test("beam loop does not retrigger, fades on ceasefire and stops immediately on suspend", () => {
  const voices = [];
  const loops = A.createLoops((name) => {
    const v = {
      name,
      plays: 0,
      stops: 0,
      play() {
        this.plays++;
      },
      stop() {
        this.stops++;
      },
    };
    voices.push(v);
    return v;
  });
  for (let i = 0; i < 600; i++)
    loops.sync([{ key: "beam_loop", volume: 0.12 }], 1 / 60);
  assert.equal(voices.length, 1);
  assert.equal(voices[0].plays, 1);
  assert(voices[0].volume <= 0.12 && voices[0].volume > 0.11);
  loops.sync([{ key: "beam_loop", volume: 0.12 }], 0.1, 0.4);
  assert(voices[0].volume < 0.08);
  for (let i = 0; i < 20; i++) loops.sync([], 1 / 60);
  assert.equal(voices[0].stops, 1);
  loops.sync([{ key: "beam_loop", volume: 0.12 }], 1 / 60);
  assert.equal(voices[0].plays, 2);
  loops.stop();
  assert.equal(voices[0].stops, 2);
});
test("distant impact asset removes sharp high frequencies without amplifying peak", () => {
  const read = (name) => {
    const b = fs.readFileSync(
      path.resolve(__dirname, "../miniprogram/assets/audio", name + ".wav"),
    );
    const samples = [];
    for (let i = 44; i < b.length; i += 2) samples.push(b.readInt16LE(i));
    return samples;
  };
  const near = read("impact_heavy"),
    far = read("impact_heavy_far");
  const roughness = (a) =>
    a.slice(1).reduce((sum, v, i) => sum + (v - a[i]) ** 2, 0);
  assert.equal(near.length, far.length);
  assert(roughness(far) < roughness(near) * 0.2);
  assert(Math.max(...far.map(Math.abs)) <= Math.max(...near.map(Math.abs)));
});

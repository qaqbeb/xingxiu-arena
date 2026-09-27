"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const R = require("../miniprogram/core/battle-renderer");
const C = require("../miniprogram/core/combat");
function fixture() {
  const battle = C.createBattle(["xia"], ["tian"], 17, { deferred: false });
  return {
    battle,
    screen: "battle",
    paused: false,
    camera: { scale: 0.7, x: 100, y: 100 },
    width: 1000,
    height: 700,
    images: {},
    toScreen: (x, y) => ({ x: x * 0.7, y: y * 0.7 }),
    shipImage() {},
    text() {},
  };
}
function advance(ui, dt = 0.05) {
  ui.battle.time += dt;
  R.update(ui, dt);
}
test("effects consume events once, stop on pause and follow simulation time", () => {
  const ui = fixture(),
    s = ui.battle.ships[0];
  ui.battle.events = [
    {
      seq: 1,
      type: "hit",
      x: s.x,
      y: s.y,
      damage: 120,
      targetId: s.id,
      shieldHit: true,
    },
  ];
  advance(ui);
  assert.equal(ui._worldFX.bursts.length, 1);
  const life = ui._worldFX.bursts[0].life;
  R.update(ui, 1);
  assert.equal(ui._worldFX.bursts[0].life, life);
  ui.paused = true;
  R.update(ui, 1);
  assert.equal(ui._worldFX.bursts[0].life, life);
  assert.equal(ui.screenShake.strength, 0);
  ui.paused = false;
  advance(ui);
  assert.equal(ui._worldFX.bursts.length, 1);
  assert.ok(ui._worldFX.bursts[0].life < life);
});
test("visuals never mutate combat state or random generator and remain bounded", () => {
  const ui = fixture(),
    snapshot = JSON.stringify(ui.battle);
  R.reset(ui);
  R.update(ui, 0.05);
  assert.equal(JSON.stringify(ui.battle), snapshot);
  for (let i = 1; i < 120; i++) {
    ui.battle.events = [
      { seq: i, type: "explosion", x: 200, y: 300, radius: 90 },
    ];
    advance(ui);
  }
  assert.ok(ui._worldFX.particles.length <= 650);
  assert.ok(ui._worldFX.bursts.length <= 90);
  const f = ui._worldFX;
  ui.battle = C.createBattle(["xia"], ["xia"], 9);
  R.update(ui, 0.05);
  assert.notEqual(ui._worldFX, f);
  assert.equal(ui._worldFX.particles.length, 0);
});
test("same inputs give identical deterministic visual particles", () => {
  const a = fixture(),
    b = fixture();
  for (const ui of [a, b]) {
    ui.battle.events = [
      { seq: 1, type: "explosion", x: 20, y: 50, radius: 40 },
    ];
    advance(ui);
  }
  assert.deepEqual(a._worldFX.particles, b._worldFX.particles);
});
test("all drawing branches work at small scales with absent optional assets", () => {
  const ui = fixture();
  let operations = 0;
  const gradient = { addColorStop() {} };
  ui.ctx = new Proxy(
    {
      globalAlpha: 1,
      createLinearGradient() {
        return gradient;
      },
      createRadialGradient() {
        return gradient;
      },
    },
    {
      get(t, k) {
        if (k in t) return t[k];
        return (...args) => {
          for (const v of args)
            if (typeof v === "number")
              assert.ok(
                Number.isFinite(v),
                k + " received nonfinite coordinate",
              );
          operations++;
        };
      },
      set(t, k, v) {
        t[k] = v;
        return true;
      },
    },
  );
  const s = ui.battle.ships[0];
  s.x = 400;
  s.y = 400;
  s.shieldOn = true;
  s.shieldLevel = 1;
  s.thrust = { forward: 1, backward: 0.3, turn: 0.5, strafe: 0.5 };
  ui.battle.events = [
    {
      seq: 1,
      type: "shot",
      shipId: s.id,
      weaponId: s.mounts[0].weaponId || s.mounts[0].defaultWeapon,
    },
    { seq: 2, type: "hit", x: 420, y: 400, targetId: s.id, shieldHit: true },
    { seq: 3, type: "explosion", x: 480, y: 450, radius: 60 },
  ];
  ui.battle.projectiles = [
    {
      id: 1,
      x: 450,
      y: 400,
      angle: 0,
      kind: "missile",
      weaponId: "chuanyun",
      color: "#ffcf79",
    },
  ];
  ui.battle.beams = [{ x: 400, y: 400, x2: 700, y2: 450, color: "#85ccea" }];
  advance(ui);
  for (const scale of [0.1, 0.7, 1.5]) {
    ui.camera.scale = scale;
    R.drawSpace(ui, false);
    R.drawShip(ui, s);
    R.drawOrdnance(ui);
    R.drawShip(ui, { ...s, status: "destroyed" }, 0.2);
  }
  assert.ok(operations > 500);
});

function recordingContext() {
  const calls = [],
    stack = [],
    gradient = { addColorStop() {} };
  const values = {
    globalAlpha: 1,
    fillStyle: "",
    strokeStyle: "",
    globalCompositeOperation: "source-over",
  };
  const ctx = new Proxy(values, {
    get(t, k) {
      if (k in t) return t[k];
      if (k === "save") return () => stack.push({ ...values });
      if (k === "restore") return () => Object.assign(values, stack.pop());
      if (k === "createLinearGradient" || k === "createRadialGradient")
        return (...args) => {
          assert.ok(args.every(Number.isFinite));
          return gradient;
        };
      return (...args) => {
        for (const a of args)
          if (typeof a === "number") assert.ok(Number.isFinite(a));
        calls.push({
          method: k,
          args,
          alpha: t.globalAlpha,
          style: t.fillStyle,
        });
      };
    },
    set(t, k, v) {
      t[k] = v;
      return true;
    },
  });
  return { ctx, calls };
}
test("invalid background sizes are skipped, ghost reserves stay intact and opacity is respected", () => {
  const ui = fixture(),
    recording = recordingContext();
  ui.ctx = recording.ctx;
  for (const background of [
    {},
    { width: 0, height: 0 },
    { width: Infinity, height: 100 },
  ]) {
    ui.images.background = background;
    R.drawSpace(ui);
  }
  assert.equal(
    recording.calls.filter((c) => c.method === "drawImage").length,
    0,
  );
  const alpha = [];
  ui.shipImage = (id, x, y, size, angle, a) => alpha.push(a);
  const ship = {
    ...ui.battle.ships[0],
    x: 400,
    y: 400,
    status: "reserve",
    ghost: true,
  };
  R.drawShip(ui, ship, 0.7);
  assert.equal(alpha[0], 0.7);
  assert.ok(
    recording.calls.some(
      (c) => c.method === "fillRect" && c.style === "#9aa2a0",
    ),
    "reserve ghost must draw intact gun mounts",
  );
  R.drawShip(ui, { ...ship, ghost: false, status: "destroyed" }, 0.19);
  assert.equal(alpha[1], 0.19);
  assert.equal(ui.ctx.globalAlpha, 1);
});
test("shield impact stays attached when its target translates and rotates", () => {
  const ui = fixture(),
    s = ui.battle.ships[0];
  s.angle = 0;
  s.x = 400;
  s.y = 400;
  ui.battle.events = [
    {
      seq: 1,
      type: "hit",
      x: 440,
      y: 400,
      normalAngle: 0,
      shieldHit: true,
      targetId: s.id,
    },
  ];
  advance(ui);
  s.x = 500;
  s.y = 500;
  s.angle = Math.PI / 2;
  const { ctx, calls } = recordingContext();
  ui.ctx = ctx;
  R.drawOrdnance(ui);
  assert.ok(
    calls.some(
      (c) =>
        c.method === "translate" &&
        Math.abs(c.args[0] - 350) < 1e-8 &&
        Math.abs(c.args[1] - 378) < 1e-8,
    ),
  );
});
test("eight-ship live combat keeps visual buffers bounded and produces real recoil without altering simulation", (t) => {
  const ids = ["xia", "xia", "xia", "xia"];
  const make = () => {
    const b = C.createBattle(ids, ids, 971, { deferred: false });
    b.ships.forEach((s, i) => {
      s.x = 1800 + (i % 4) * 180;
      s.y = s.team ? 1250 : 1750;
      s.angle = s.team ? Math.PI / 2 : -Math.PI / 2;
      s.targetAngle = s.angle;
      s.mounts.forEach((m) => (m.aimAngle = s.angle + m.angle));
    });
    return b;
  };
  const ui = fixture(),
    baseline = make();
  ui.battle = make();
  const { ctx, calls } = recordingContext();
  ui.ctx = ctx;
  ui.toScreen = (x, y) => ({
    x: (x - 1800) * 0.7 + 150,
    y: (y - 1200) * 0.7 + 100,
  });
  let elapsed = 0,
    peak = 0,
    sawShot = false,
    sawHit = false,
    sawRecoil = false;
  for (let i = 0; i < 600; i++) {
    C.stepBattle(baseline, 1 / 60);
    C.stepBattle(ui.battle, 1 / 60);
    const start = performance.now();
    R.update(ui, 1 / 60);
    elapsed += performance.now() - start;
    peak = Math.max(peak, ui._worldFX.particles.length);
    sawShot ||= Object.keys(ui._worldFX.shots).length > 0;
    sawHit ||= ui._worldFX.bursts.length > 0;
    if (i % 5 === 0) {
      calls.length = 0;
      for (const s of ui.battle.ships) R.drawShip(ui, s);
      R.drawOrdnance(ui);
      sawRecoil ||= calls.some(
        (c) =>
          c.method === "fillRect" && c.style === "#9aa2a0" && c.args[0] < -0.01,
      );
    }
    assert.ok(ui._worldFX.particles.length <= 650);
    assert.ok(Object.keys(ui._worldFX.shots).length <= 24);
    assert.ok(
      Object.keys(ui._worldFX.trails).length <= ui.battle.projectiles.length,
    );
  }
  assert.ok(
    sawShot && sawHit && sawRecoil,
    "simulation must actually fire, hit and animate barrel recoil",
  );
  assert.deepEqual(ui.battle, baseline);
  assert.ok(
    elapsed < 2000,
    "600 visual updates should avoid pathological buffer costs",
  );
  t.diagnostic(
    `600 visual updates: ${elapsed.toFixed(1)}ms total; peak ${peak}/650 particles`,
  );
});

test("distant ships use readable directional team glyphs and retain selection arcs", () => {
  const ui = fixture(),
    { ctx, calls } = recordingContext();
  ui.ctx = ctx;
  ui.camera.scale = 0.08;
  const s = { ...ui.battle.ships[0], x: 400, y: 400, angle: -Math.PI / 2 };
  ui.selectedShip = s.id;
  const images = [];
  ui.shipImage = (...args) => images.push(args);
  R.drawShip(ui, s);
  assert.equal(images.length, 0, "tiny art is replaced by a readable glyph");
  assert.ok(calls.some((c) => c.method === "rotate" && c.args[0] === s.angle));
  assert.ok(calls.some((c) => c.method === "fill" && c.style === "#8cdec8"));
  assert.ok(
    calls.filter((c) => c.method === "arc" && c.args[2] === 13).length === 4,
    "selected ship retains its four selection arcs",
  );
  calls.length = 0;
  R.drawShip(ui, { ...s, id: "enemy", team: 1 });
  assert.ok(calls.some((c) => c.method === "fill" && c.style === "#ed9989"));
  ui.camera.scale = 0.5;
  R.drawShip(ui, s);
  assert.equal(images.length, 1, "close view uses the detailed ship image");
});

test("ordinary and beam hits do not shake; flagship heavy hits decay without stacking", () => {
  const ui = fixture(),
    ship = ui.battle.ships[0];
  ui.flagshipId = ship.id;
  let seq = 0;
  const hit = (weaponId, damage) => {
    ui.battle.events = [
      {
        seq: ++seq,
        type: "hit",
        weaponId,
        damage,
        targetId: ship.id,
        x: ship.x,
        y: ship.y,
      },
    ];
    advance(ui, 0.02);
  };
  for (let i = 0; i < 30; i++) {
    hit("chuanyun", 65);
    hit("fuling", 400);
    assert.equal(ui.screenShake.strength, 0);
  }
  hit("bengshan", 340);
  const initial = ui.screenShake.strength;
  assert.ok(initial > 0 && initial < 1);
  hit("bengshan", 340);
  assert.ok(ui.screenShake.strength < initial);
  ui.battle.events = [];
  for (let i = 0; i < 30; i++) advance(ui, 0.02);
  assert.equal(ui.screenShake.strength, 0);
  ui.battle.events = [
    { seq: ++seq, type: "explosion", x: ship.x + 2000, y: ship.y, radius: 100 },
  ];
  advance(ui);
  assert.equal(ui.screenShake.strength, 0);
});

test("heavy hull strike has more ejecta than a light hit; beam contacts remain small", () => {
  function impact(weaponId, damage) {
    const ui = fixture(),
      ship = ui.battle.ships[0];
    ui.battle.events = [
      {
        seq: 1,
        type: "hit",
        weaponId,
        damage,
        x: ship.x,
        y: ship.y,
        targetId: ship.id,
        normalAngle: 0,
      },
    ];
    advance(ui, 0.01);
    return ui._worldFX;
  }
  const light = impact("chuanyun", 65),
    heavy = impact("zhenhai", 900),
    beam = impact("fuling", 2);
  assert(heavy.bursts[0].r > light.bursts[0].r * 2);
  assert(heavy.particles.length > light.particles.length);
  assert(beam.bursts[0].r < light.bursts[0].r);
  assert(beam.particles.length <= 2);
  assert(heavy.particles.some((p) => p.kind === "debris"));
});

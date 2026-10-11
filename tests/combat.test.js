"use strict";
const assert = require("node:assert/strict");
const C = require("../miniprogram/core/combat");
const Catalog = require("../miniprogram/core/ships");
const test = require("node:test");
function battle(a = "xia", b = "xia") {
  const s = C.createBattle([a], [b], 7, { deferred: false });
  // Isolated weapon/physics fixtures explicitly use a horizontal heading.
  s.ships.forEach((p) => {
    p.angle = p.targetAngle = p.team ? Math.PI : 0;
    p.mounts.forEach((m) => (m.aimAngle = p.angle + m.angle));
  });
  return s;
}
function inert() {
  return { moveX: 0, moveY: 0, fire: false, autoGroups: [false, false, false] };
}
function tick(s, seconds, commands) {
  for (let i = 0; i < Math.round(seconds * 60); i++)
    C.stepBattle(
      s,
      1 / 60,
      commands || Object.fromEntries(s.ships.map((p) => [p.id, inert()])),
    );
}
test("catalog retains the four reference acceleration and turn baselines", () => {
  const expected = {
    xia: [120, 110, 90, 60, 90],
    tian: [90, 60, 40, 30, 60],
    shen: [100, 90, 60, 40, 100],
    xie: [30, 20, 10, 12, 12],
  };
  for (const d of Catalog.SHIPS) {
    assert.equal(C.validateLoadout(d.id).ok, true, d.id + " default fit");
    if (!expected[d.id]) continue; // hulls added after the four references
    const m = d.movement;
    assert.deepEqual(
      [
        m.maxSpeed,
        m.acceleration,
        m.deceleration,
        m.maxTurnRate,
        m.turnAcceleration,
      ],
      expected[d.id],
    );
    assert.equal(C.validateLoadout(d.id).ok, true);
  }
});
test("180 degree rotations accelerate and brake close to analytic duration", () => {
  for (const d of Catalog.SHIPS) {
    const p = battle(d.id).ships[0],
      dt = 1 / 120,
      m = d.movement,
      expected = 180 / m.maxTurnRate + m.maxTurnRate / m.turnAcceleration;
    let elapsed = 0,
      previous = 0;
    while (elapsed < expected + 2) {
      C.motionStep(p, { aimAngle: Math.PI }, dt);
      assert.ok(
        Math.abs(p.angularVelocity - previous) <=
          ((m.turnAcceleration * Math.PI) / 180) * dt + 1e-8,
      );
      previous = p.angularVelocity;
      elapsed += dt;
      if (
        Math.abs(
          Math.atan2(Math.sin(p.angle - Math.PI), Math.cos(p.angle - Math.PI)),
        ) <
          (2 * Math.PI) / 180 &&
        Math.abs(p.angularVelocity) < (0.5 * Math.PI) / 180
      )
        break;
    }
    assert.ok(
      Math.abs(elapsed - expected) < 0.7,
      d.id + ": " + elapsed + " vs " + expected,
    );
  }
});
test("heading changes preserve world momentum and reversing is not instantaneous", () => {
  const p = battle().ships[0];
  p.vx = 120;
  C.motionStep(p, { moveX: -1, aimAngle: Math.PI / 2 }, 1 / 60);
  assert.ok(p.vx > 118);
  assert.ok(Math.abs(p.vy) < 0.1);
  assert.ok(Math.abs(p.angle) < 0.01);
  const a = battle().ships[0],
    b = battle().ships[0];
  a.vx = b.vx = 100;
  C.motionStep(a, {}, 0.1);
  C.motionStep(b, { brake: true }, 0.1);
  assert.equal(a.vx, 95.5);
  assert.equal(b.vx, 91);
});
test("shield arcs block front impacts, projectiles create hard flux and beams soft flux", () => {
  const s = battle(),
    p = s.ships[0];
  p.shieldLevel = 1;
  C.applyDamage(s, p, 100, "kinetic", p.x + 100, p.y, false, "1-0");
  assert.equal(p.hardFlux, 200);
  assert.equal(p.hp, p.maxHp);
  C.applyDamage(s, p, 100, "kinetic", p.x + 100, p.y, true, "1-0");
  assert.equal(p.softFlux, 200);
  const armor = p.armor.slice();
  C.applyDamage(s, p, 100, "he", p.x - 100, p.y, false, "1-0");
  assert.ok(p.hp < p.maxHp);
  assert.equal(p.armor[0], armor[0]);
  assert.ok(p.armor[3] < armor[3]);
});
test("hard flux remains with shields raised but dissipates after lowering", () => {
  const s = battle(),
    p = s.ships[0];
  p.hardFlux = 1000;
  p.softFlux = 500;
  tick(s, 1);
  assert.equal(p.hardFlux, 1000);
  assert.ok(p.softFlux < 500);
  p.shieldOn = false;
  p.softFlux = 0;
  tick(s, 1);
  assert.ok(p.hardFlux < 850);
});
test("external shield hit overloads, venting disables weapons, shields and drains hard flux", () => {
  const s = battle(),
    p = s.ships[0];
  p.shieldLevel = 1;
  C.applyDamage(s, p, 2000, "kinetic", p.x + 100, p.y, false, "1-0");
  assert.equal(p.overload, 4);
  assert.equal(p.shieldOn, false);
  p.overload = 0;
  p.hardFlux = 1000;
  C.stepBattle(s, 1 / 30, {
    "0-0": { vent: true, shieldToggle: true, fire: true },
    "1-0": inert(),
  });
  assert.ok(p.venting > 0);
  assert.equal(p.shieldOn, false);
  assert.ok(p.hardFlux < 1000);
  assert.equal(s.projectiles.filter((q) => q.sourceId === p.id).length, 0);
});
test("large hits breach intact armor faster than equal damage in small hits; breached sectors expose hull", () => {
  const s = battle("xie"),
    a = s.ships[0],
    s2 = battle("xie"),
    b = s2.ships[0];
  a.shieldOn = b.shieldOn = false;
  C.applyDamage(s, a, 600, "he", a.x + 100, a.y, false);
  for (let i = 0; i < 10; i++)
    C.applyDamage(s2, b, 60, "he", b.x + 100, b.y, false);
  assert.ok(a.hp < b.hp);
  const before = b.hp;
  b.armor[3] = 0;
  C.applyDamage(s2, b, 60, "energy", b.x - 100, b.y, false);
  assert.equal(before - b.hp, 60);
  assert.equal(b.armor[1], b.maxArmor[1]);
});
test("玄甲阵 reduces front damage without repairing or protecting stern and preserves angular continuity", () => {
  function hit(front, system) {
    const s = battle("xie"),
      p = s.ships[0];
    p.shieldOn = false;
    p.systemTime = system ? 4 : 0;
    C.applyDamage(s, p, 500, "he", p.x + (front ? 200 : -200), p.y, false);
    return p.maxHp - p.hp;
  }
  assert.ok(hit(true, true) < hit(true, false));
  assert.equal(hit(false, true), hit(false, false));
  const p = battle("xie").ships[0];
  p.angularVelocity = (12 * Math.PI) / 180;
  p.systemTime = 4;
  C.motionStep(p, { aimAngle: Math.PI }, 1 / 60);
  assert.ok(p.angularVelocity > (11 * Math.PI) / 180);
});
test("fixed substeps reproduce 30 and 60 FPS motion and consume toggle once", () => {
  const a = battle(),
    b = battle(),
    cmd = {
      "0-0": {
        moveX: 0.8,
        moveY: 0.3,
        aimAngle: 1.5,
        autoGroups: [false, false, false],
      },
      "1-0": inert(),
    };
  for (let i = 0; i < 120; i++) C.stepBattle(a, 1 / 30, cmd);
  for (let i = 0; i < 240; i++) C.stepBattle(b, 1 / 60, cmd);
  assert.equal(a.ships[0].x, b.ships[0].x);
  assert.equal(a.ships[0].angle, b.ships[0].angle);
  C.stepBattle(a, 0.1, { "0-0": { shieldToggle: true }, "1-0": inert() });
  assert.equal(a.ships[0].shieldOn, false);
});
test("fitting budget rejects incompatible mounts and upgrades; accepted upgrades affect stats", () => {
  assert.equal(
    C.validateLoadout("xia", { weapons: { b1: "lihuo" } }).ok,
    false,
  );
  assert.equal(C.validateLoadout("xia", { vents: 99 }).ok, false);
  assert.equal(C.validateLoadout("xia", { capacitors: -1 }).ok, false);
  const s = C.createBattle(["xia"], ["xia"], 1, {
    loadouts: { "0-0": { vents: 3, capacitors: 2 } },
  });
  assert.equal(s.ships[0].dissipation, 190);
  assert.equal(s.ships[0].maxFlux, 2800);
});
test("reserves prevent defeat, destroyed flagship pauses deployment, battles have no timeout", () => {
  const s = C.createBattle(["xia", "xia"], ["xia"], 1);
  assert.equal(s.status, "needsDeployment");
  C.deployShip(s, "0-0", 1000, 1000, 0);
  C.deployShip(s, "1-0", 3800, 1000, Math.PI);
  s.ships[0].status = "destroyed";
  C.stepBattle(s, 1 / 60);
  assert.equal(s.status, "needsDeployment");
  assert.equal(s.winner, null);
  assert.equal(C.deployShip(s, "0-1", 400, 1500, 0), true);
  tick(s, 110);
  assert.equal(s.status, "running");
  assert.ok(s.time > 100);
  s.ships.filter((p) => p.team === 0).forEach((p) => (p.status = "retreated"));
  C.stepBattle(s, 1 / 60);
  assert.equal(s.winner, 1);
});
test("rear target cannot be engaged by forward fixed main cannon", () => {
  const s = battle("xie"),
    p = s.ships[0],
    enemy = s.ships[1];
  enemy.x = p.x - 450;
  enemy.y = p.y;
  C.stepBattle(s, 1 / 60, {
    "0-0": {
      aimAngle: Math.PI,
      fire: true,
      manualGroup: 0,
      autoGroups: [false, false, false],
    },
    "1-0": inert(),
  });
  assert.equal(s.projectiles.filter((q) => q.weaponId === "zhenhai").length, 0);
});
test("beam PD intercepts actual guided missiles", () => {
  const s = battle("shen"),
    p = s.ships[0];
  p.mounts.forEach((m) => {
    if (m.id === "e3") m.aimAngle = Math.PI;
  });
  s.projectiles.push({
    id: 1,
    x: p.x - 150,
    y: p.y - 35,
    px: p.x - 150,
    py: p.y - 35,
    angle: 0,
    team: 1,
    kind: "missile",
    damageType: "he",
    color: "#fff",
    sourceId: "1-0",
    damage: 450,
    speed: 10,
    life: 6,
    remaining: 1000,
    hp: 5,
    targetId: p.id,
    turnRate: 1,
  });
  tick(s, 0.2, { "0-0": { autoGroups: [false, false, true] }, "1-0": inert() });
  assert.equal(s.projectiles.filter((q) => q.kind === "missile").length, 0);
  assert.equal(p.hp, p.maxHp);
});
test("one-shot controls survive render frames shorter than one physics step", () => {
  const s = battle();
  C.stepBattle(s, 1 / 144, { "0-0": { shieldToggle: true }, "1-0": inert() });
  C.stepBattle(s, 1 / 144, { "0-0": inert(), "1-0": inert() });
  C.stepBattle(s, 1 / 144, { "0-0": inert(), "1-0": inert() });
  assert.equal(s.ships[0].shieldOn, false);
});
test("friendly hulls block a projectile without friendly damage", () => {
  const s = C.createBattle(["xia", "xia"], ["xia"], 1, { deferred: false }),
    p = s.ships[0],
    ally = s.ships[1],
    enemy = s.ships[2];
  p.x = 1000;
  p.y = 1000;
  ally.x = 1200;
  ally.y = 1000;
  enemy.x = 1400;
  enemy.y = 1000;
  s.projectiles.push({
    id: 1,
    x: 1100,
    y: 1000,
    px: 1100,
    py: 1000,
    angle: 0,
    team: 0,
    kind: "projectile",
    damageType: "he",
    sourceId: p.id,
    damage: 1000,
    speed: 12000,
    life: 1,
    remaining: 1000,
    hp: 1,
  });
  tick(s, 1 / 60);
  assert.equal(s.projectiles.length, 0);
  const hit = s.events.find((e) => e.type === "hit" && e.targetId === ally.id);
  assert.ok(hit && hit.blocked && hit.damage === 0);
  assert.ok(s.effects.some((e) => e.kind === "hit" && e.targetId === ally.id));
  assert.equal(ally.hp, ally.maxHp);
  assert.equal(enemy.hp, enemy.maxHp);
});
test("seeded AI battles finish by exhaustion and valid fleet budget includes reserves", () => {
  assert.throws(() => C.createBattle(["fuyue", "fuyue", "fuyue"], ["xia"]), /预算/);
  const a = C.createBattle(["xia", "tian"], ["shen", "xia"], 19, {
      deferred: false,
    }),
    b = C.createBattle(["xia", "tian"], ["shen", "xia"], 19, {
      deferred: false,
    });
  for (let i = 0; i < 240 * 60 && a.status === "running"; i++) {
    C.stepBattle(a, 1 / 60);
    C.stepBattle(b, 1 / 60);
  }
  assert.equal(a.status, "finished");
  assert.equal(a.winner, b.winner);
  assert.equal(a.time, b.time);
  assert.deepEqual(
    a.ships.map((p) => p.hp),
    b.ships.map((p) => p.hp),
  );
});
test("enemy reinforcements scan the same full candidate grid as navigation", () => {
  const N = require("../miniprogram/core/navigation");
  const s = C.createBattle(["xia", "xia", "xia", "xia"], ["xia"], 1);
  for (let i = 0; i < 4; i++)
    assert.equal(
      C.deployShip(s, "0-" + i, 800 + i * 1050, 1000, -Math.PI / 2),
      true,
    );
  s.time = 1;
  const legal = N.findPlacement(s, "1-0", "reinforcement");
  assert.ok(legal);
  assert.equal(legal.angle, Math.PI / 2);
  assert.ok(legal.y >= 200 && legal.y <= 500);
  C.deployEnemy(s);
  const enemy = s.ships.find((p) => p.id === "1-0");
  assert.equal(enemy.status, "active");
  assert.equal(enemy.x, legal.x);
  assert.equal(enemy.y, legal.y);
});
test("automatic mounts choose a farther target inside their arc over a nearer rear target", () => {
  const s = C.createBattle(["shen"], ["xia", "xia"], 1, { deferred: false });
  const p = s.ships[0],
    rear = s.ships[1],
    front = s.ships[2];
  Object.assign(p, { x: 1500, y: 1500, angle: 0, targetAngle: 0 });
  p.mounts.forEach((m) => (m.aimAngle = p.angle + m.angle));
  Object.assign(rear, { x: 1250, y: 1500 });
  Object.assign(front, { x: 2000, y: 1500 });
  tick(s, 1, {
    "0-0": { aimAngle: 0, autoGroups: [true, false, false] },
    "1-0": inert(),
    "1-1": inert(),
  });
  assert.ok(
    s.events.filter(
      (e) => e.type === "shot" && e.shipId === p.id && e.weapon === "lihuo",
    ).length >= 4,
  );
  assert.equal(rear.hp, rear.maxHp);
  assert.ok(front.hardFlux > 0 || front.hp < front.maxHp);
});
test("automatic mounts skip a friendly-obstructed target and engage a clear one", () => {
  const s = C.createBattle(["shen", "xia"], ["xia", "xia"], 1, {
    deferred: false,
  });
  Object.assign(s.ships[0], { x: 1500, y: 1500, angle: 0, targetAngle: 0 });
  Object.assign(s.ships[1], { x: 1710, y: 1500 });
  Object.assign(s.ships[2], { x: 1920, y: 1500 });
  Object.assign(s.ships[3], { x: 1800, y: 1850 });
  tick(s, 1, {
    "0-0": { aimAngle: 0, autoGroups: [true, false, false] },
    "0-1": inert(),
    "1-0": inert(),
    "1-1": inert(),
  });
  assert.ok(
    s.events.some(
      (e) => e.type === "shot" && e.shipId === "0-0" && e.weapon === "lihuo",
    ),
  );
  assert.equal(s.ships[1].hp, s.ships[1].maxHp);
});
test("missile lifetime is fuel-limited while straight projectiles remain range-limited", () => {
  const s = battle(),
    p = s.ships[0];
  Object.assign(p, { x: 1000, y: 1000, angle: 0, targetAngle: 0 });
  p.mounts.forEach((m) => (m.aimAngle = p.angle + m.angle));
  s.ships[1].x = 4200;
  s.ships[1].y = 2600;
  C.stepBattle(s, 1 / 60, {
    "0-0": {
      aimAngle: 0,
      fire: true,
      manualGroup: 1,
      autoGroups: [false, false, false],
    },
    "1-0": inert(),
  });
  const missile = s.projectiles.find((q) => q.kind === "missile");
  assert.ok(missile);
  missile.turnRate = 0;
  s.projectiles.push({
    id: 999,
    x: 1000,
    y: 500,
    px: 1000,
    py: 500,
    angle: 0,
    team: 0,
    kind: "projectile",
    damageType: "he",
    sourceId: p.id,
    damage: 10,
    speed: 240,
    life: 10,
    remaining: 1000,
    hp: 1,
  });
  tick(s, 4.5);
  assert.ok(s.projectiles.includes(missile));
  assert.ok(missile.x > 2000);
  assert.equal(
    s.projectiles.some((q) => q.id === 999),
    false,
  );
  tick(s, 1.6);
  assert.equal(s.projectiles.includes(missile), false);
});

test("default fleets face inward from the bottom and top deployment bands", () => {
  const s = C.createBattle(["xie", "xia", "xia"], ["shen", "tian", "xia"], 1, {
    deferred: false,
  });
  for (const p of s.ships) {
    assert.equal(p.status, "active");
    assert.equal(p.angle, p.team ? Math.PI / 2 : -Math.PI / 2);
    assert.ok(p.y >= (p.team ? 400 : 2100) && p.y <= (p.team ? 900 : 2600));
  }
  const r = C.createBattle(["xia"], ["xia"]);
  assert.equal(C.deployShip(r, "0-0", 2400, 2300), true);
  assert.equal(r.ships[0].angle, -Math.PI / 2);
});
test("retreat orders leave through each team's home vertical edge", () => {
  for (const team of [0, 1]) {
    const s = C.createBattle(["xia"], ["xia"], 1, { deferred: false });
    const p = s.ships[team];
    p.y = team ? 50 : 2950;
    C.setOrder(s, p.id, { type: "retreat" });
    for (let i = 0; i < 600 && p.status === "active"; i++)
      C.stepBattle(s, 1 / 60);
    assert.equal(p.status, "retreated");
    assert.ok(team ? p.y < 0 : p.y > s.height);
  }
});
test("thrust reflects acceleration, braking and turning without erasing momentum", () => {
  const p = battle().ships[0];
  C.motionStep(p, { moveX: 1 }, 1 / 60);
  assert.equal(p.thrust.forward, 1);
  assert.equal(p.thrust.backward, 0);
  const vx = p.vx;
  C.motionStep(p, { brake: true, aimAngle: Math.PI / 2 }, 1 / 120);
  assert.ok(p.thrust.backward > 0);
  assert.ok(p.thrust.turn > 0);
  assert.ok(p.vx > 0 && p.vx < vx);
  for (const d of Catalog.SHIPS) {
    // ART-BRIEF-SHIPS permits two nozzles on the Xinyue frigate.
    assert.ok(d.engineSlots.length >= (d.id === "xinyue" ? 2 : 3));
    assert.ok(
      d.engineSlots.every(
        (e) =>
          e.x < 0 &&
          e.width > 0 &&
          e.length > 0 &&
          ["low", "mid", "high"].includes(e.style),
      ),
    );
  }
});
test("shot and damage events carry muzzle, surface and destruction data with bounded effects", () => {
  const s = battle(),
    p = s.ships[0];
  C.stepBattle(s, 1 / 60, {
    "0-0": { aimAngle: 0, fire: true, autoGroups: [false, false, false] },
    "1-0": inert(),
  });
  const shot = s.events.find((e) => e.type === "shot");
  assert.equal(shot.weaponId, shot.weapon);
  assert.equal(shot.shipId, p.id);
  assert.ok(shot.mountId);
  for (const k of ["x", "y", "angle"]) assert.ok(Number.isFinite(shot[k]));
  p.shieldLevel = 1;
  C.applyDamage(
    s,
    p,
    100,
    "kinetic",
    p.x + p.radius + 8,
    p.y,
    false,
    "1-0",
    "chuanyun",
  );
  let hit = s.events.at(-1);
  assert.equal(hit.shieldHit, true);
  assert.equal(hit.armorHit, false);
  assert.equal(hit.x, p.x + p.radius + 8);
  assert.equal(hit.normalAngle, 0);
  assert.equal(hit.targetId, p.id);
  assert.equal(hit.sourceId, "1-0");
  p.shieldOn = false;
  p.vx = 17;
  p.vy = -23;
  for (let i = 0; i < 450; i++)
    C.applyDamage(s, p, 0.01, "energy", p.x, p.y + 35, false, "1-0", "lihuo");
  assert.ok(s.events.length <= 400 && s.effects.length <= 400);
  C.applyDamage(s, p, 100000, "he", p.x, p.y + 35, false, "1-0", "zhenhai");
  const explosion = s.events.at(-1);
  assert.equal(explosion.type, "explosion");
  assert.equal(explosion.shipId, p.id);
  assert.equal(explosion.vx, 17);
  assert.equal(explosion.vy, -23);
  assert.equal(explosion.radius, p.radius * 1.7);
  assert.ok(s.events.length <= 400 && s.effects.length <= 400);
});

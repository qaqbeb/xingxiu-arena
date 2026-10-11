"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const C = require("../miniprogram/core/combat");
const catalog = require("../miniprogram/core/ships");

// Runs an AI duel and records, per step, the rounds each weapon put in flight.
function observe(left, right, seed, seconds) {
  const s = C.createBattle(left, right, seed, { deferred: false }),
    seen = new Set(),
    launches = {},
    flags = { child: 0, sprint: 0, split: 0 };
  for (let i = 0; i < seconds * 60 && s.status === "running"; i++) {
    C.stepBattle(s, 1 / 60);
    const fresh = {};
    for (const p of s.projectiles) {
      if (p.sprinting) flags.sprint++;
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      if (p.child) flags.child++;
      else fresh[p.weaponId] = (fresh[p.weaponId] || 0) + 1;
    }
    for (const id of Object.keys(fresh))
      (launches[id] = launches[id] || []).push(fresh[id]);
  }
  flags.split = s.events.filter((e) => e.type === "split").length;
  return { s, launches, flags };
}

test("every hull class exists in each tech line and heavier classes are slower and tougher", () => {
  const order = ["护卫", "驱逐", "巡洋", "主力"];
  for (const tech of ["低科技", "中科技", "高科技"]) {
    const line = order.map((c) => catalog.SHIPS.find((s) => s.tech === tech && s.hullClass === c));
    assert(line.every(Boolean), tech + " has all four classes");
    for (let i = 1; i < line.length; i++) {
      assert(line[i].movement.maxSpeed < line[i - 1].movement.maxSpeed, tech + " speed falls with class");
      assert(line[i].hull > line[i - 1].hull, tech + " hull grows with class");
      assert(line[i].cost > line[i - 1].cost, tech + " cost grows with class");
    }
  }
  // Tech identity within a class: low tech is armour, high tech is flux and shields.
  for (const c of order) {
    const of = (tech) => catalog.SHIPS.find((s) => s.tech === tech && s.hullClass === c),
      low = of("低科技"),
      high = of("高科技");
    assert(low.armor > high.armor, c + ": low tech carries more armour");
    assert(high.fluxCapacity > low.fluxCapacity, c + ": high tech holds more flux");
    assert(high.shieldEfficiency < low.shieldEfficiency, c + ": high tech shields are more efficient");
    assert(high.movement.maxSpeed > low.movement.maxSpeed, c + ": high tech is faster");
  }
});

test("a rocket pod launches its whole salvo on one trigger and spends one ammo", () => {
  const { s, launches } = observe(["tieao"], ["xie"], 31, 30);
  assert(launches.tianhuo && launches.tianhuo.length > 0, "the pod fired");
  assert(launches.tianhuo.every((n) => n === catalog.getWeapon("tianhuo").salvo));
  const pod = s.ships[0].mounts.find((m) => m.weaponId === "tianhuo" || m.defaultWeapon === "tianhuo");
  assert.equal(pod.ammo, catalog.getWeapon("tianhuo").ammo - launches.tianhuo.length);
});

test("a MIRV bus splits into its warheads near the target", () => {
  const { flags } = observe(["lingxiao"], ["fuyue"], 7, 60),
    mirv = catalog.getWeapon("jiuxiao").mirv;
  assert(flags.split > 0, "at least one bus reached split range");
  assert.equal(flags.child, flags.split * mirv.count);
});

test("a sabot drops guidance and sprints at the end of its run", () => {
  const s = C.createBattle(["xia"], ["xie"], 5, {
    deferred: false,
    loadouts: { "0-0": { weapons: { m1: "chuandun" }, vents: 0, capacitors: 0 } },
  });
  let sprinted = false,
    top = 0;
  for (let i = 0; i < 60 * 40 && s.status === "running"; i++) {
    C.stepBattle(s, 1 / 60);
    for (const p of s.projectiles)
      if (p.weaponId === "chuandun") {
        top = Math.max(top, p.speed);
        if (p.sprinting) {
          sprinted = true;
          assert.equal(p.turnRate, 0);
        }
      }
  }
  assert(sprinted, "the sabot entered its sprint stage");
  assert.equal(top, catalog.getWeapon("chuandun").sprint.speed);
});

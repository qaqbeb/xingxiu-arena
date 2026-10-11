"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const K = require("../miniprogram/core/campaign");
const catalog = require("../miniprogram/core/ships");

test("a new campaign starts at the home port with one frigate and a connected map", () => {
  const s = K.create(7);
  assert.equal(K.valid(s), true);
  assert.equal(s.location, K.HOME);
  assert.deepEqual(s.fleet.map((f) => f.typeId), ["xia"]);
  // Every node is reachable from home.
  const seen = new Set([K.HOME]),
    queue = [K.HOME];
  while (queue.length)
    for (const next of K.neighbors(queue.pop()))
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
  assert.equal(seen.size, K.NODES.length);
  assert.equal(JSON.stringify(K.create(7)), JSON.stringify(s), "same seed, same start");
});

test("travel follows links, spends days and raises an encounter only at hostile nodes", () => {
  const s = K.create(11);
  assert.equal(K.travel(s, "guixu").ok, false);
  const port = K.travel(s, "yaoguang");
  assert.equal(port.ok, true);
  assert.equal(port.encounter, null);
  assert(s.day > 1);
  K.travel(s, "tianshu");
  const wild = K.travel(s, "suixing");
  assert(wild.encounter);
  assert(wild.encounter.fleet.length >= 1);
  const cost = wild.encounter.fleet.reduce((n, id) => n + catalog.getShip(id).cost, 0);
  assert(cost <= 10, "danger 1 fleets stay within 10 DP");
  assert.equal(K.travel(s, "kaiyang").ok, false, "cannot sail past an unresolved encounter");
  assert.equal(K.withdraw(s), true);
  assert.equal(s.location, "tianshu");
  assert.equal(s.encounter, null);
});

test("victory pays the bounty, carries hull damage and clears the node for a while", () => {
  const s = K.create(3);
  K.travel(s, "suixing");
  const bounty = s.encounter.bounty,
    uid = s.fleet[0].uid;
  const report = K.resolveBattle(s, {
    winner: 0,
    ships: [{ uid, status: "active", hull: 0.4 }],
    destroyed: s.encounter.fleet.slice(),
  });
  assert.equal(report.victory, true);
  assert.equal(s.credits, 6000 + bounty);
  assert.equal(s.fleet[0].hull, 0.4);
  assert.equal(K.hostile(s, "suixing"), false);
  for (const id of report.salvage) assert(s.inventory[id] > 0);
  s.day += 20;
  assert.equal(K.hostile(s, "suixing"), true, "pirates return");
});

test("defeat sends survivors back; total loss is underwritten with a fresh frigate", () => {
  const s = K.create(5);
  s.fleet.push({ uid: 99, typeId: "tian", hull: 1, loadout: { weapons: {}, vents: 0, capacitors: 0 } });
  K.travel(s, "suixing");
  let report = K.resolveBattle(s, {
    winner: 1,
    ships: [
      { uid: s.fleet[0].uid, status: "destroyed", hull: 0 },
      { uid: 99, status: "retreated", hull: 0.3 },
    ],
  });
  assert.deepEqual(report.lost, ["赤螯"]);
  assert.equal(report.wiped, false);
  assert.equal(s.location, "tianshu");
  assert.deepEqual(s.fleet.map((f) => f.typeId), ["tian"]);
  K.travel(s, "suixing");
  const before = s.credits;
  report = K.resolveBattle(s, { winner: 1, ships: [{ uid: 99, status: "destroyed", hull: 0 }] });
  assert.equal(report.wiped, true);
  assert.deepEqual(s.fleet.map((f) => f.typeId), ["xia"]);
  assert.equal(s.credits, before - report.insurance);
  assert.equal(s.location, K.HOME);
});

test("markets sell ships and weapons within credits, fleet size and DP limits", () => {
  const s = K.create(21),
    m = K.market(s);
  assert(m.ships.some((o) => o.typeId === "xia"), "home always stocks a frigate");
  assert.equal(K.market(s), m, "stock is stable until it expires");
  s.credits = 0;
  assert.equal(K.buyShip(s, 0).reason, "星币不足");
  s.credits = 1e6;
  const offer = m.ships[0];
  assert.equal(K.buyShip(s, 0).ok, true);
  assert.equal(s.credits, 1e6 - offer.price);
  assert.equal(s.fleet.length, 2);
  // DP ceiling
  s.fleet = [1, 2].map((uid) => ({ uid, typeId: "fuyue", hull: 1, loadout: { weapons: {}, vents: 0, capacitors: 0 } }));
  m.ships = [{ typeId: "xie", price: 100 }];
  assert.match(K.buyShip(s, 0).reason, /DP/);
  // weapons
  const id = Object.keys(m.weapons)[0],
    count = m.weapons[id];
  assert.equal(K.buyWeapon(s, id).ok, true);
  assert.equal(s.inventory[id], 1);
  assert.equal(m.weapons[id] || 0, count - 1);
  assert.equal(K.sellWeapon(s, id).ok, true);
  assert.equal(s.inventory[id], undefined);
  assert.equal(K.sellWeapon(s, id).ok, false);
  // away from port
  s.location = "suixing";
  assert.equal(K.market(s), null);
  assert.equal(K.repair(s).ok, false);
});

test("repair restores hull for a price; selling a ship returns its weapons", () => {
  const s = K.create(2);
  s.fleet[0].hull = 0.5;
  const cost = K.repairCost(s.fleet[0]);
  assert(cost > 0);
  assert.equal(K.repair(s, 0).ok, true);
  assert.equal(s.fleet[0].hull, 1);
  assert.equal(s.credits, 6000 - cost);
  assert.equal(K.sellShip(s, 0).ok, false, "the last ship cannot be sold");
  s.fleet.push({ uid: 50, typeId: "tian", hull: 1, loadout: { weapons: {}, vents: 0, capacitors: 0 } });
  assert.equal(K.sellShip(s, 1).ok, true);
  assert.equal(s.inventory.bengshan, 1);
  assert.equal(s.inventory.fuling, 1);
  assert.equal(s.inventory.suixing, 1);
});

test("refit moves weapons between mounts and inventory and never invents stock", () => {
  const s = K.create(9),
    fit = { weapons: { b1: "poyue" }, vents: 0, capacitors: 0 };
  assert.match(K.applyFit(s, 0, fit).reason, /库存没有/);
  s.inventory.poyue = 1;
  assert.equal(K.applyFit(s, 0, fit).ok, true);
  assert.equal(s.inventory.poyue, undefined);
  assert.equal(s.inventory.chuanyun, 1, "the replaced default weapon is kept");
  assert.equal(K.mounted(s.fleet[0]).b1, "poyue");
  // Reverting uses the stored default again.
  assert.equal(K.applyFit(s, 0, { weapons: {}, vents: 2, capacitors: 0 }).ok, true);
  assert.equal(s.inventory.poyue, 1);
  assert.equal(s.inventory.chuanyun, undefined);
  assert.equal(K.applyFit(s, 0, { weapons: { b1: "zhenhai" }, vents: 0, capacitors: 0 }).ok, false);
});

test("the boss node holds a fixed fleet and stays cleared once beaten", () => {
  const s = K.create(4);
  s.location = "yuheng";
  const e = K.travel(s, "guixu").encounter;
  assert.deepEqual(e.fleet, ["fuyue", "xie", "tieao", "xia"]);
  const report = K.resolveBattle(s, { winner: 0, ships: [{ uid: s.fleet[0].uid, status: "active", hull: 1 }] });
  assert.equal(report.boss, true);
  s.day += 100;
  assert.equal(K.hostile(s, "guixu"), false);
});

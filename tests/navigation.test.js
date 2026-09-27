"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const N = require("../miniprogram/core/navigation");
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
const reserve = (id, team = 0, typeId = "xia") => ({
  id,
  team,
  typeId,
  status: "reserve",
  radius: 60,
  length: 100,
  width: 65,
});
const battle = (ships) => ({ ships, width: 4800, height: 3000 });

test("world/screen mapping preserves aspect and round-trips at different sizes and zooms", () => {
  for (const [width, height] of [
    [1600, 900],
    [844, 390],
    [390, 844],
    [2560, 720],
  ]) {
    for (const zoom of [0.75, 1, 1.5]) {
      const cam = N.createCamera(width, height);
      N.zoomCamera(cam, zoom);
      near(
        cam.scale,
        Math.min(
          width / 1600,
          Math.max(height / 1050, Math.min(width / 2400, 0.32)),
        ) * zoom,
      );
      for (const [x, y] of [
        [0, 0],
        [4800, 3000],
        [1000, 1500],
        [2300, 1350],
      ]) {
        const pixel = N.worldToScreen(cam, x, y);
        const world = N.screenToWorld(cam, pixel.x, pixel.y);
        near(world.x, x);
        near(world.y, y);
      }
      const a = N.worldToScreen(cam, 1000, 1000),
        b = N.worldToScreen(cam, 1100, 1100);
      near(b.x - a.x, b.y - a.y);
    }
  }
});

test("zoom remains under the pointer and centered zoom keeps its center", () => {
  const cam = N.createCamera(1600, 900);
  const before = N.screenToWorld(cam, 350, 230);
  N.zoomCamera(cam, 1.5, 350, 230);
  const after = N.screenToWorld(cam, 350, 230);
  near(before.x, after.x);
  near(before.y, after.y);
  const x = cam.x,
    y = cam.y;
  N.zoomCamera(cam, 0.75);
  near(cam.x, x);
  near(cam.y, y);
  N.zoomCamera(cam, 1e20);
  assert.equal(cam.zoom, 2.5);
  N.zoomCamera(cam, 0);
  assert.equal(cam.zoom, 2.5);
});

test("overview fits the whole world without distortion after resize; leaving restores 1x", () => {
  const cam = N.createCamera(844, 390);
  for (const [w, h] of [
    [844, 390],
    [390, 844],
    [3000, 500],
  ]) {
    N.setCameraMode(cam, "overview");
    N.resizeCamera(cam, w, h);
    const a = N.worldToScreen(cam, 0, 0),
      b = N.worldToScreen(cam, 4800, 3000);
    assert.ok(
      a.x >= -1e-9 && a.y >= -1e-9 && b.x <= w + 1e-9 && b.y <= h + 1e-9,
    );
    near((b.x - a.x) / (b.y - a.y), 1.6);
    near(cam.x, 2400);
    near(cam.y, 1500);
    N.setCameraMode(cam, "follow");
    near(cam.zoom, 1);
  }
});

test("free pan uses screen pixels and clamps view to world; following is smooth and bounded", () => {
  const cam = N.createCamera(800, 450);
  const initialScale = cam.scale;
  N.panCamera(cam, 50, -25);
  near(cam.x, 2400 - 50 / initialScale);
  near(cam.y, 1500 + 25 / initialScale);
  assert.equal(cam.mode, "free");
  N.panCamera(cam, 100000, 100000);
  near(cam.x, cam.width / (2 * cam.scale));
  near(cam.y, cam.height / (2 * cam.scale));
  N.setCameraMode(cam, "follow");
  const before = cam.x;
  N.updateCamera(cam, 1 / 60, { x: 2400, y: 1500 }, 0);
  assert.ok(cam.x > before && cam.x < 2400);
  N.updateCamera(cam, 100, { x: 2400, y: 1500 }, 0);
  assert.ok(cam.x > 2400 && cam.x <= 2730);
  const previous = cam.x;
  N.updateCamera(cam, 1 / 60, { x: 2400, y: 1500 }, Math.PI);
  assert.ok(previous - cam.x < 40);
  N.resizeCamera(cam, 0, NaN);
  assert.equal(cam.width, 800);
  assert.equal(cam.height, 450);
});

test("fleet accounting includes every selected reserve and supports duplicate hulls", () => {
  assert.deepEqual(N.validateFleet(["xie", "shen", "tian"]), {
    ok: true,
    cost: 60,
    reason: "",
  });
  assert.equal(N.validateFleet(["xie", "xie", "xia"]).ok, false);
  assert.equal(N.validateFleet(["xia", "xia", "xia", "xia"]).ok, true);
  assert.equal(N.validateFleet(["xia", "xia", "xia", "xia", "xia"]).ok, false);
  assert.equal(N.validateFleet([]).ok, false);
  assert.equal(N.validateFleet(["unknown"]).ok, false);
  assert.equal(N.validateFleet(null).ok, false);
});

test("vertical deployment zones reject wrong bands, overlaps and incomplete hulls", () => {
  assert.deepEqual(N.deploymentZone(0), {
    minX: 400,
    maxX: 4400,
    minY: 2100,
    maxY: 2600,
  });
  assert.deepEqual(N.deploymentZone(1, "reinforcement"), {
    minX: 400,
    maxX: 4400,
    minY: 200,
    maxY: 500,
  });
  const a = reserve("0-0"),
    b = Object.assign(reserve("0-1"), { status: "active", x: 1000, y: 2350 });
  const s = battle([a, b, reserve("1-0", 1)]);
  assert.equal(N.placement(s, a.id, 400, 2100).ok, true);
  assert.equal(N.placement(s, a.id, 399, 2100).ok, false);
  assert.equal(N.placement(s, a.id, 1000, 2099).ok, false);
  assert.equal(N.placement(s, a.id, 1000, 2601).ok, false);
  assert.equal(N.placement(s, a.id, 1139, 2350).ok, false);
  assert.equal(N.placement(s, a.id, 1140, 2350).ok, true);
  assert.equal(N.placement(s, b.id, 400, 2100).ok, false);
  assert.equal(N.placement(s, a.id, NaN, 2100).ok, false);
  assert.equal(N.placement(s, "missing", 400, 2100).ok, false);
  assert.equal(N.placement(s, "1-0", 400, 400).ok, true);
  assert.equal(N.placement(s, "1-0", 400, 2100).ok, false);
  a.radius = 650;
  assert.equal(N.placement(s, a.id, 400, 2350).ok, false);
});
test("reinforcements enforce 900 enemy distance and ignore inactive hulls", () => {
  const a = reserve("0-0"),
    enemy = Object.assign(reserve("1-0", 1), {
      status: "active",
      x: 1500,
      y: 2500,
    });
  const s = battle([a, enemy]);
  assert.equal(N.placement(s, a.id, 600, 2500, "reinforcement").ok, true);
  assert.equal(N.placement(s, a.id, 601, 2500, "reinforcement").ok, false);
  assert.equal(N.placement(s, a.id, 600, 2499, "reinforcement").ok, false);
  enemy.x = 500;
  for (const status of ["destroyed", "retreated", "reserve"]) {
    enemy.status = status;
    assert.equal(N.placement(s, a.id, 500, 2500, "reinforcement").ok, true);
  }
  enemy.status = "active";
  enemy.y = 900;
  const extra = reserve("1-1", 1);
  s.ships.push(extra);
  assert.equal(N.placement(s, extra.id, 4400, 300, "reinforcement").ok, true);
});

test("deployment cannot circumvent fleet cap or refund destroyed hull budget", () => {
  const ships = [
    reserve("0-0", 0, "xie"),
    reserve("0-1", 0, "xie"),
    reserve("0-2"),
  ];
  ships[1].status = "destroyed";
  assert.equal(N.placement(battle(ships), "0-0", 600, 300).ok, false);
  const five = Array.from({ length: 5 }, (_, i) => reserve("0-" + i));
  assert.equal(N.findPlacement(battle(five), "0-0"), null);
});

test("candidate search is deterministic, legal, symmetric and handles blocked reinforcement strips", () => {
  const ships = [
    reserve("0-0"),
    reserve("0-1"),
    reserve("0-2"),
    reserve("0-3"),
  ];
  const s = battle(ships);
  for (const ship of ships) {
    const p = N.findPlacement(s, ship.id);
    assert.ok(p);
    assert.deepEqual(p, N.findPlacement(s, ship.id));
    assert.equal(N.placement(s, ship.id, p.x, p.y).ok, true);
    assert.equal(p.angle, -Math.PI / 2);
    Object.assign(ship, p, { status: "active" });
  }
  const enemy = reserve("1-0", 1);
  s.ships.push(enemy);
  assert.equal(N.findPlacement(s, enemy.id).angle, Math.PI / 2);
  const blocked = battle([
    reserve("0-0"),
    ...[800, 1850, 2900, 3950].map((x, i) =>
      Object.assign(reserve("1-" + i, 1), { status: "active", x, y: 2650 }),
    ),
  ]);
  assert.equal(N.findPlacement(blocked, "0-0", "reinforcement"), null);
  assert.equal(N.findPlacement(s, "missing"), null);
});

test("landscape follow keeps the deployed flagship above controls with combat range visible", () => {
  const cam = N.createCamera(844, 390);
  N.setCameraFocus(cam, 53, 242);
  near(cam.scale, 0.32);
  for (const length of [100, 180, 240]) {
    const ship = { x: 2400, y: 2500, length };
    N.updateCamera(cam, 100, ship, -Math.PI / 2);
    const pixel = N.worldToScreen(cam, ship.x, ship.y);
    assert.ok(pixel.y + length * cam.scale * 0.57 + 18 <= 242);
    const enemy = N.worldToScreen(cam, ship.x, ship.y - 350);
    assert.ok(enemy.y >= 53, "350-unit target must clear the top bar");
    assert.ok(
      length * cam.scale * 1.14 >= 30,
      "small ships remain discernible",
    );
  }
  const before = cam.scale;
  N.zoomCamera(cam, 1.25);
  assert.ok(cam.scale > before);
  N.updateCamera(cam, 100, { x: 2400, y: 2500, length: 240 }, -Math.PI / 2);
  const hull = N.worldToScreen(cam, 2400, 2500);
  assert.ok(hull.y + 240 * cam.scale * 0.57 < 242);
  N.setCameraMode(cam, "overview");
  const corner = N.worldToScreen(cam, 4800, 3000);
  assert.ok(corner.x <= 844 && corner.y <= 390);
  N.setCameraMode(cam, "follow");
  near(cam.scale, before);
});

test("camera focus adapts to HUD changes and reverse aim without covering the hull", () => {
  const cam = N.createCamera(844, 390);
  N.setCameraFocus(cam, 53, 242);
  for (const angle of [-Math.PI / 2, 0, Math.PI / 2, Math.PI]) {
    N.updateCamera(cam, 100, { x: 2400, y: 1600, length: 100 }, angle);
    const p = N.worldToScreen(cam, 2400, 1600);
    assert.ok(p.y > 72 && p.y < 223);
  }
  N.setCameraFocus(cam, 53, 280);
  assert.ok(cam.scale >= 0.32);
  N.setCameraFocus(cam);
  near(cam.scale, 390 / 1050);
});

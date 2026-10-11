"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { GameUI } = require("../miniprogram/core/game-ui");
const nav = require("../miniprogram/core/navigation");
const catalog = require("../miniprogram/core/ships");
const combat = require("../miniprogram/core/combat");

function fixture(saved, width = 1280, height = 720) {
  const labels = [],
    played = [],
    writes = [],
    canvasStack = [];
  const finite = (name, args) =>
    args.forEach((v) => {
      if (typeof v === "number")
        assert(Number.isFinite(v), name + " received non-finite number");
    });
  const context = new Proxy(
    {
      globalAlpha: 1,
      globalCompositeOperation: "source-over",
      lineWidth: 1,
      save() {
        canvasStack.push(
          Object.fromEntries(
            Object.entries(this).filter(
              ([, value]) => typeof value !== "function",
            ),
          ),
        );
      },
      restore() {
        const saved = canvasStack.pop();
        if (!saved) return;
        for (const key of Object.keys(this))
          if (typeof this[key] !== "function" && !(key in saved))
            delete this[key];
        Object.assign(this, saved);
      },
      fillText(...args) {
        finite("fillText", args);
        labels.push(String(args[0]));
      },
      measureText(value) {
        return { width: String(value).length * 8 };
      },
      createRadialGradient(...args) {
        finite("radialGradient", args);
        return { addColorStop() {} };
      },
      createLinearGradient(...args) {
        finite("linearGradient", args);
        return { addColorStop() {} };
      },
    },
    {
      get(target, key) {
        return key in target
          ? target[key]
          : (...args) => finite(String(key), args);
      },
      set(target, key, value) {
        finite(String(key), [value]);
        target[key] = value;
        return true;
      },
    },
  );
  const canvas = { getContext: () => context };
  const ui = new GameUI({
    canvas,
    assetRoot: "",
    createImage: () => ({
      width: 512,
      height: 512,
      naturalWidth: 512,
      naturalHeight: 512,
      set src(value) {
        this._src = value;
        if (value.includes("nebula")) {
          this.width = this.naturalWidth = 1672;
          this.height = this.naturalHeight = 941;
        }
        if (this.onload) this.onload();
      },
      get src() {
        return this._src;
      },
    }),
    load: () => saved,
    save: (value) => writes.push(structuredClone(value)),
    playSound: (name, volume) => played.push({ name, volume }),
  });
  ui.resize(width, height, 2);
  ui.draw();
  return { ui, labels, played, writes };
}
function launch(ui, all = true) {
  ui.prepare();
  if (all) ui.autoPlace();
  else {
    const point = nav.findPlacement(ui.battle, "0-0", "initial");
    assert(point);
    assert(ui.placeDraft("0-0", point));
  }
  ui.launch();
  ui.draw();
  assert.equal(ui.screen, "battle");
}
function tick(ui, seconds, fps = 60) {
  for (let i = 0; i < seconds * fps; i++) ui.frame(1 / fps);
}
function touchStick(ui, key, id, dx, dy) {
  const z = ui.stickZones()[key];
  ui.pointerDown(id, z.x, z.y);
  ui.pointerMove(id, z.x + dx * z.r, z.y + dy * z.r);
  return z;
}

test("fleet editor rejects excess budget and fifth vessel without changing either fleet", () => {
  const { ui, writes } = fixture();
  ui.fleets = [["fuyue", "fuyue"], ["xia"]];
  ui.team = 0;
  ui.slot = 2;
  ui.changeFleet("xie");
  assert.deepEqual(ui.fleets[0], ["fuyue", "fuyue"]);
  assert.equal(writes.length, 0);
  ui.fleets[0] = ["xia", "xia", "xia", "xia"];
  ui.slot = 4;
  ui.changeFleet("xia");
  assert.equal(ui.fleets[0].length, 4);
  ui.slot = 2;
  ui.changeFleet("tian");
  assert.equal(ui.fleets[0][2], "tian");
  assert(nav.validateFleet(ui.fleets[0]).ok);
  assert.deepEqual(ui.fleets[1], ["xia"]);
  assert.equal(writes.at(-1).version, 2);
  ui.fleets[0] = ["xia"];
  ui.removeSlot(0, 0);
  assert.deepEqual(ui.fleets[0], ["xia"]);
});

test("prepare is deferred; launch requires legal placement and preserves a reserve", () => {
  const { ui } = fixture();
  ui.prepare();
  assert.equal(ui.screen, "deploy");
  assert(ui.battle.ships.every((s) => s.status === "reserve"));
  ui.launch();
  assert.equal(ui.screen, "deploy");
  assert.equal(ui.battle.time, 0);
  assert.equal(ui.placeDraft("0-0", { x: 3000, y: 1500 }), false);
  const point = nav.findPlacement(ui.battle, "0-0", "initial");
  assert(ui.placeDraft("0-0", point));
  assert.equal(ui.drafts["0-0"].angle, -Math.PI / 2);
  assert.equal(
    ui.battle.ships[0].status,
    "reserve",
    "draft must not advance simulation",
  );
  ui.launch();
  assert.equal(ui.flagship().status, "active");
  assert(ui.battle.ships.some((s) => s.team === 0 && s.status === "reserve"));
  assert(ui.battle.ships.some((s) => s.team === 1 && s.status === "active"));
  ui.frame(1 / 60);
  assert(ui.battle.time > 0);
});

test("two touch sticks independently move and fire; releasing one preserves the other", () => {
  const { ui } = fixture();
  launch(ui);
  const left = touchStick(ui, "left", 101, 1, 0),
    right = touchStick(ui, "right", 202, 1, 0);
  let cmd = ui.command();
  assert(cmd.moveX > 0.9);
  assert.equal(cmd.fire, true);
  ui.pointerUp(101, left.x, left.y);
  cmd = ui.command();
  assert.equal(cmd.moveX, 0);
  assert.equal(cmd.fire, true);
  touchStick(ui, "left", 303, 0, -1);
  ui.pointerCancel(202);
  cmd = ui.command();
  assert(cmd.moveY < -0.9);
  assert.equal(cmd.fire, false);
  ui.pointerUp(303, left.x, left.y);
  assert.equal(ui.command().moveY, 0);
  assert(right.x > left.x);
});

test("suspend freezes time, clears all inputs and does not alter velocity instantly", () => {
  const { ui } = fixture();
  launch(ui);
  ui.keyDown("d");
  tick(ui, 0.2);
  const speed = ui.flagship().vx;
  assert(speed > 0);
  touchStick(ui, "right", 10, 1, 0);
  ui.keyDown("v");
  ui.suspend();
  const time = ui.battle.time;
  assert.equal(ui.flagship().vx, speed);
  tick(ui, 0.2);
  assert.equal(ui.battle.time, time);
  assert.equal(ui.command().fire, false);
  assert.equal(ui.command().moveX, 0);
  assert.equal(ui.command().vent, undefined);
  ui.openTactical();
  ui.resumeBattle();
  ui.frame(1 / 60);
  assert(ui.battle.time > time);
  assert(ui.flagship().vx < speed);
});

test("manual group selection does not reset independent automatic fire switches", () => {
  const { ui } = fixture();
  launch(ui);
  const s = ui.flagship();
  assert.deepEqual(s.autoGroups, [false, true, true]);
  ui.keyDown("2");
  ui.keyUp("2");
  assert.equal(ui.command().manualGroup, 1);
  assert.deepEqual(s.autoGroups, [false, true, true]);
  ui.keyDown("r");
  ui.keyUp("r");
  assert.deepEqual(s.autoGroups, [false, false, true]);
  ui.keyDown("1");
  ui.keyUp("1");
  ui.keyDown("r");
  ui.keyUp("r");
  assert.deepEqual(s.autoGroups, [true, false, true]);
  ui.openTactical();
  ui.resumeBattle();
  ui.frame(1 / 60);
  assert.deepEqual(s.autoGroups, [true, false, true]);
});

test("switching flagship preserves position, velocity, heading, and hull of both ships", () => {
  const { ui } = fixture();
  launch(ui);
  ui.keyDown("d");
  tick(ui, 0.3);
  const ships = ui.battle.ships.filter(
    (s) => s.team === 0 && s.status === "active",
  );
  const snapshot = (s) => [
    s.x,
    s.y,
    s.vx,
    s.vy,
    s.angle,
    s.angularVelocity,
    s.hp,
  ];
  const before = ships.map(snapshot);
  ui.openTactical();
  ui.takeControl(ships[1].id);
  assert.equal(ui.flagshipId, ships[1].id);
  assert.deepEqual(ships.map(snapshot), before);
  assert.equal(ui.command().moveX, 0);
  ui.resumeBattle();
  assert.deepEqual(ships.map(snapshot), before);
});

test("reserves can reinforce from the entry zone after the only active ship is lost", () => {
  const { ui } = fixture();
  launch(ui, false);
  const destroyed = ui.flagship();
  destroyed.status = "destroyed";
  destroyed.hp = 0;
  ui.frame(1 / 60);
  assert.equal(ui.screen, "tactical");
  assert.equal(ui.battle.status, "needsDeployment");
  const reserve = ui.battle.ships.find(
    (s) => s.team === 0 && s.status === "reserve",
  );
  const point = nav.findPlacement(ui.battle, reserve.id, "reinforcement");
  assert(point);
  assert(ui.placeDraft(reserve.id, point));
  ui.resumeBattle();
  assert.equal(ui.screen, "battle");
  assert.equal(ui.flagshipId, reserve.id);
  assert.equal(reserve.status, "active");
  assert.equal(destroyed.status, "destroyed");
  ui.frame(1 / 60);
  assert.equal(ui.battle.status, "running");
});

test("refit upgrades stop at OP budget, compatible weapon selection remains valid", () => {
  const { ui } = fixture();
  ui.refit();
  const def = catalog.getShip(ui.fitType);
  for (let i = 0; i < 100; i++) ui.changeFlux("vents", 1);
  const fit = ui.fitting(ui.fitId);
  assert.equal(ui.fitCost(def, fit), def.op);
  const before = fit.capacitors;
  ui.changeFlux("capacitors", 1);
  assert.equal(fit.capacitors, before);
  for (let i = 0; i < 100; i++) ui.changeFlux("vents", -1);
  assert.equal(fit.vents, 0);
  for (const mount of def.mounts) ui.changeWeapon(mount);
  assert(combat.validateLoadout(def.id, fit).ok);
  ui.modal = null;
  ui.prepare();
  assert.equal(ui.screen, "deploy");
});

test("invalid or legacy saved settings cannot inject an invalid fleet", () => {
  for (const saved of [
    { fleets: [["missing"], ["xia"]], sound: false },
    { version: 2, fleets: [["fuyue", "fuyue", "fuyue"], ["xia"]], sound: false },
  ]) {
    const { ui } = fixture(saved);
    assert(ui.fleets.every((ids) => nav.validateFleet(ids).ok));
    launch(ui);
    ui.frame(1 / 60);
  }
  const { ui } = fixture({
    version: 2,
    fleets: [["shen"], ["xia"]],
    sound: false,
  });
  assert.deepEqual(ui.fleets, [["shen"], ["xia"]]);
  assert.equal(ui.sound, false);
});

test("all screens and overlays render finite geometry at desktop, mobile and portrait sizes", () => {
  for (const [w, h] of [
    [1440, 810],
    [844, 390],
    [390, 844],
  ]) {
    const { ui } = fixture(undefined, w, h);
    ui.resize(w, h, 2, { left: 20, top: 0, right: w - 20, bottom: h - 10 });
    ui.draw();
    ui.modal = "help";
    ui.draw();
    ui.modal = null;
    ui.refit();
    ui.draw();
    ui.modal = null;
    ui.prepare();
    ui.draw();
    ui.autoPlace();
    ui.draw();
    ui.launch();
    ui.frame(1 / 60);
    ui.openTactical();
    ui.draw();
    ui.resumeBattle();
    ui.toggleMode();
    ui.draw();
    ui.toggleMode();
    ui.suspend();
    ui.draw();
    ui.battle.status = "finished";
    ui.battle.winner = 0;
    ui.draw();
    assert.equal(ui.canvas.width, w * 2);
  }
});

test("30 Hz and 60 Hz render schedules produce the same one-second flight trajectory", () => {
  const results = [30, 60].map((fps) => {
    const { ui } = fixture();
    launch(ui);
    ui.keyDown("d");
    tick(ui, 1, fps);
    const s = ui.flagship();
    return [ui.battle.time, s.x, s.y, s.vx, s.vy, s.angle];
  });
  results[0].forEach((value, i) =>
    assert(
      Math.abs(value - results[1][i]) < 1e-7,
      `trajectory component ${i} differs`,
    ),
  );
});

test("one-shot shield input survives a render frame shorter than a simulation tick", () => {
  const { ui } = fixture();
  launch(ui);
  const s = ui.flagship(),
    before = s.shieldOn;
  ui.pointerDown(999, ui.width / 2, ui.height / 2, 2, "mouse");
  ui.pointerUp(999, ui.width / 2, ui.height / 2);
  ui.frame(1 / 120);
  ui.frame(1 / 120);
  assert.equal(s.shieldOn, !before);
  ui.frame(1 / 60);
  assert.equal(s.shieldOn, !before, "toggle must not replay on the next tick");
});

test("training runs real thrust, gradual turning and braking with a passive deployed target", () => {
  const { ui } = fixture();
  ui.prepare(true);
  ui.launch();
  ui.draw();
  const s = ui.flagship(),
    x = s.x;
  ui.keyDown("d");
  tick(ui, 0.5);
  assert(s.x > x);
  assert(s.vx > 0);
  const enemies = ui.battle.ships.filter((ship) => ship.team === 1);
  assert.equal(enemies.length, 1);
  assert.equal(enemies[0].typeId, "xie");
  assert.equal(enemies[0].status, "active");
  assert.equal(enemies[0].trainingTarget, true);
  assert.equal(s.angle, -Math.PI / 2);
  const angle = s.angle;
  const z = touchStick(ui, "right", 77, 0, 1);
  ui.frame(1 / 60);
  assert(
    Math.abs(s.angle - angle) < 0.02,
    "hull should not snap to 90 degrees",
  );
  ui.pointerUp(77, z.x, z.y);
  ui.keyUp("d");
  const speed = Math.hypot(s.vx, s.vy);
  ui.keyDown("c");
  tick(ui, 0.4);
  assert(Math.hypot(s.vx, s.vy) < speed);
  assert.equal(s.hp, s.maxHp);
  assert(ui.battle.time > 0.8);
});

test("compact tactical panel retains five usable commands including retreat", () => {
  const { ui } = fixture(undefined, 844, 390);
  launch(ui);
  ui.openTactical();
  const drawn = [],
    button = ui.button.bind(ui);
  ui.button = (label, ...args) => {
    const b = button(label, ...args);
    drawn.push({ label, ...b });
    return b;
  };
  ui.draw();
  const commands = ["接管", "前往", "集火", "护航", "撤离"].map((label) =>
    drawn.find((b) => b.label === label),
  );
  for (const b of commands) {
    assert(b);
    assert(b.w >= 44 && b.h >= 44);
    assert(b.x >= 0 && b.x + b.w <= 844);
    assert(b.y >= 64 && b.y + b.h <= 390 - 98);
  }
  const retreat = commands[4];
  ui.pointerDown(901, retreat.x + 10, retreat.y + 10);
  ui.pointerUp(901, retreat.x + 10, retreat.y + 10);
  assert.equal(ui.flagship().order.type, "retreat");
  assert.equal(ui.mode, "spectate");
});

test("two map fingers zoom and pan in deployment, tactics and AI observation without release clicks", () => {
  for (const screen of ["deploy", "tactical", "spectate"]) {
    const { ui } = fixture();
    if (screen === "deploy") ui.prepare();
    else {
      launch(ui);
      if (screen === "tactical") ui.openTactical();
      else ui.toggleMode();
    }
    ui.draw();
    nav.setCameraMode(ui.camera, "free");
    ui.camera.x = 2400;
    ui.camera.y = 1500;
    const v = ui.viewport,
      cx = v.x + v.w / 2,
      cy = v.y + v.h / 2,
      scale = ui.camera.scale;
    let clicks = 0;
    ui.mapClick = () => clicks++;
    ui.pointerDown(401, cx - 80, cy);
    ui.pointerDown(402, cx + 80, cy);
    assert(ui.mapGesture);
    ui.pointerMove(401, cx - 120, cy);
    ui.pointerMove(402, cx + 120, cy);
    assert(Math.abs(ui.camera.scale - scale * 1.5) < 1e-8);
    const before = { x: ui.camera.x, y: ui.camera.y },
      zoomedScale = ui.camera.scale;
    ui.pointerMove(401, cx - 100, cy + 20);
    ui.pointerMove(402, cx + 140, cy + 20);
    assert(Math.abs(ui.camera.scale - zoomedScale) < 1e-8);
    assert(Math.abs(ui.camera.x - (before.x - 20 / zoomedScale)) < 1e-7);
    assert(Math.abs(ui.camera.y - (before.y - 20 / zoomedScale)) < 1e-7);
    ui.pointerUp(401, cx - 100, cy + 20);
    assert.equal(ui.mapGesture, null);
    assert(ui.pointers[402].moved);
    const x = ui.camera.x;
    ui.pointerMove(402, cx + 145, cy + 20);
    assert(ui.camera.x < x);
    ui.pointerUp(402, cx + 145, cy + 20);
    assert.equal(clicks, 0);
  }
});

test("map gesture cancellation suppresses selection and manual sticks never become a pinch", () => {
  const { ui } = fixture();
  ui.prepare();
  ui.draw();
  let clicks = 0;
  ui.mapClick = () => clicks++;
  ui.pointerDown(1, 500, 250);
  ui.pointerDown(2, 700, 250);
  ui.pointerCancel(1);
  ui.pointerUp(2, 700, 250);
  assert.equal(clicks, 0);
  assert.equal(ui.mapGesture, null);
  ui.autoPlace();
  ui.launch();
  ui.draw();
  const scale = ui.camera.scale;
  touchStick(ui, "left", 11, 1, 0);
  touchStick(ui, "right", 12, 1, 0);
  assert.equal(ui.mapGesture, null);
  assert.equal(ui.camera.scale, scale);
  assert(ui.command().moveX > 0);
  assert(ui.command().fire);
  ui.clearInput();
  ui.paused = true;
  ui.pointerDown(20, 500, 250);
  ui.pointerDown(21, 700, 250);
  assert.equal(ui.mapGesture, null);
});

test("a tactical move command hands the flagship to AI and invalid targets do not claim success", () => {
  const { ui } = fixture();
  launch(ui);
  ui.openTactical();
  ui.selectedShip = ui.flagshipId;
  ui.orderMode = "attack";
  const destination = ui.toScreen(2600, 2000);
  ui.mapClick(destination.x, destination.y);
  assert.equal(ui.mode, "manual");
  assert.equal(ui.flagship().order, null);
  assert.match(ui.toast, /命令无效/);
  assert.equal(ui.orderMode, "attack");
  ui.orderMode = "move";
  ui.keys.d = true;
  ui.pending.vent = true;
  ui.mapClick(destination.x, destination.y);
  assert.equal(ui.mode, "spectate");
  assert.equal(ui.flagship().order.type, "move");
  assert.equal(ui.orderMode, null);
  assert.deepEqual(ui.pending, {});
  assert.deepEqual(ui.keys, {});
  assert.match(ui.toast, /已下达航行/);
  const before = ui.flagship().x;
  ui.resumeBattle();
  ui.frame(1 / 60);
  assert(ui.flagship().x > before, "AI must execute the stored order");
  ui.openTactical();
  ui.mode = "manual";
  ui.orderMode = "escort";
  const own = ui.toScreen(ui.flagship().x, ui.flagship().y);
  ui.mapClick(own.x, own.y);
  assert.equal(ui.mode, "manual");
  assert.match(ui.toast, /命令无效/);
});

test("deployment availability checks later reserves and marks all reserves retreated only when blocked", () => {
  const { ui } = fixture();
  ui.fleets = [["xia", "xie", "xia"], ["xia"]];
  launch(ui, false);
  ui.flagship().status = "destroyed";
  ui.flagship().hp = 0;
  // An oversized reserve cannot fit the entry strip; the following ordinary hull still can.
  const reserves = ui.battle.ships.filter(
    (s) => s.team === 0 && s.status === "reserve",
  );
  reserves[0].radius = 800;
  assert.equal(
    nav.findPlacement(ui.battle, reserves[0].id, "reinforcement"),
    null,
  );
  assert(nav.findPlacement(ui.battle, reserves[1].id, "reinforcement"));
  ui.frame(1 / 60);
  assert.equal(ui.screen, "tactical");
  assert.equal(ui.battle.status, "needsDeployment");
  assert.equal(ui.battle.winner, null);
  assert(reserves.every((s) => s.status === "reserve"));
  reserves[1].radius = 800;
  ui.screen = "battle";
  ui.paused = false;
  ui.frame(1 / 60);
  assert.equal(ui.battle.status, "finished");
  assert.equal(ui.battle.winner, 1);
  assert(reserves.every((s) => s.status === "retreated"));
  assert.equal(
    ui.battle.events.filter((e) => e.type === "retreat" && e.team === 0).length,
    2,
  );
});

test("results label reflects recorded hull damage rather than all damage", () => {
  const { ui, labels } = fixture();
  launch(ui);
  labels.length = 0;
  ui.battle.status = "finished";
  ui.battle.winner = 0;
  ui.draw();
  assert(labels.includes("结构伤害"));
  assert(!labels.includes("伤害贡献"));
});

test("mouse dragging a virtual stick keeps stick control ahead of mouse firing", () => {
  const { ui } = fixture();
  launch(ui);
  const z = ui.stickZones().left;
  ui.pointerDown(808, z.x, z.y, 0, "mouse");
  ui.pointerMove(808, z.x + z.r, z.y);
  assert.equal(ui.pointers[808].kind, "stick");
  assert(ui.command().moveX > 0.9);
  assert.equal(ui.command().fire, false);
  assert.equal(ui.mouse, null);
  ui.pointerUp(808, z.x + z.r, z.y);
  assert.equal(ui.command().moveX, 0);
});

test("native menu capsule leaves all header controls and text clear at 844 by 390", () => {
  for (const menuLeft of [720, 570]) {
    const { ui } = fixture(undefined, 844, 390);
    ui.resize(844, 390, 2, { left: 44, top: 0, right: 800, bottom: 390 });
    ui.menuRect = {
      left: menuLeft,
      top: 7,
      right: 807,
      bottom: 39,
      width: 807 - menuLeft,
      height: 32,
    };
    const buttons = [],
      texts = [],
      button = ui.button.bind(ui),
      text = ui.text.bind(ui),
      mono = ui.mono.bind(ui);
    ui.button = (label, ...args) => {
      const b = button(label, ...args);
      buttons.push({ label, ...b });
      return b;
    };
    ui.text = (value, x, y, size, color, align, ...rest) => {
      if (y < 30)
        texts.push({ value: String(value), x, y, align: align || "left" });
      return text(value, x, y, size, color, align, ...rest);
    };
    ui.mono = (value, x, y, size, color, align) => {
      if (y < 30)
        texts.push({ value: String(value), x, y, align: align || "left" });
      return mono(value, x, y, size, color, align);
    };
    const check = (expected) => {
      buttons.length = 0;
      texts.length = 0;
      ui.draw();
      for (const label of expected) {
        const b = buttons.find((b) => b.label === label);
        assert(b, label);
        assert(b.x >= 44, label + " stays inside safe left");
        assert(b.x + b.w <= menuLeft - 8, label + " clears capsule");
      }
      const spans = texts
        .map((t) => {
          const width = t.value.length * 8;
          return {
            label: t.value,
            left:
              t.x -
              (t.align === "center"
                ? width / 2
                : t.align === "right"
                  ? width
                  : 0),
            width,
          };
        })
        .sort((a, b) => a.left - b.left);
      for (let i = 0; i < spans.length; i++) {
        assert(spans[i].left >= 44, spans[i].label + " clears safe left");
        assert(
          spans[i].left + spans[i].width <= menuLeft - 8,
          spans[i].label + " clears capsule",
        );
        if (i)
          assert(
            spans[i - 1].left + spans[i - 1].width <= spans[i].left,
            spans[i - 1].label + " overlaps " + spans[i].label,
          );
      }
    };
    check(["声音 开", "操作说明"]);
    ui.prepare();
    check(["← 整备", "快速布阵", "出击  →"]);
    ui.autoPlace();
    ui.launch();
    check(["手操", "战术图", "整备"]);
    ui.openTactical();
    check(["← 整备", "继续驾驶"]);
  }
});

test("setting native capsule after resize does not move the minimap or affect browser header bounds", () => {
  const { ui } = fixture(undefined, 844, 390);
  ui.resize(844, 390, 2, { left: 44, top: 0, right: 800, bottom: 390 });
  launch(ui);
  const mini = () => ui.buttons.find((b) => b.y === 48 && b.w === 96);
  const before = mini();
  assert(before);
  assert.equal(ui.headerRight(), 788);
  ui.menuRect = {
    left: 720,
    top: 7,
    right: 807,
    bottom: 39,
    width: 87,
    height: 32,
  };
  ui.draw();
  const after = mini();
  assert(after);
  assert.deepEqual(
    [after.x, after.y, after.w, after.h],
    [before.x, before.y, before.w, before.h],
  );
  assert.equal(ui.headerRight(), 712);
  ui.menuRect = undefined;
  assert.equal(ui.headerRight(), 788);
});

test("deleting a fleet slot shifts surviving refits without resetting either team's equipment", () => {
  const { ui, writes } = fixture();
  ui.fleets = [["xia", "tian", "shen", "xia"], ["tian"]];
  ui.loadouts = {
    "0-0": { weapons: { b1: "suixing" }, vents: 1, capacitors: 0 },
    "0-1": { weapons: {}, vents: 2, capacitors: 0 },
    "0-2": { weapons: {}, vents: 0, capacitors: 2 },
    "0-3": { weapons: { b2: "suixing" }, vents: 0, capacitors: 1 },
    "1-0": { weapons: {}, vents: 3, capacitors: 0 },
  };
  const before = structuredClone(ui.loadouts);
  ui.team = 0;
  ui.slot = 3;
  ui.removeSlot(0, 1);
  assert.deepEqual(ui.fleets[0], ["xia", "shen", "xia"]);
  assert.deepEqual(ui.loadouts, {
    "0-0": before["0-0"],
    "0-1": before["0-2"],
    "0-2": before["0-3"],
    "1-0": before["1-0"],
  });
  assert.equal(ui.slot, 2);
  assert.deepEqual(writes.at(-1).loadouts, ui.loadouts);
  ui.prepare();
  for (const [i, original] of [
    [0, "0-0"],
    [1, "0-2"],
    [2, "0-3"],
  ]) {
    const ship = ui.battle.ships.find((s) => s.id === "0-" + i);
    const def = catalog.getShip(ship.typeId);
    assert.equal(
      ship.maxFlux,
      def.fluxCapacity + before[original].capacitors * 200,
    );
    assert.equal(
      ship.dissipation,
      def.fluxDissipation + before[original].vents * 10,
    );
  }
});

test("training fires real projectiles into the target shield and raises weapon and impact flux", () => {
  const { ui } = fixture();
  ui.prepare(true);
  ui.launch();
  ui.draw();
  const own = ui.flagship(),
    target = ui.battle.ships.find((s) => s.team === 1);
  own.autoGroups = [false, false, false];
  const targetPosition = [target.x, target.y, target.angle];
  const allies = ui.battle.ships.filter((s) => s.team === 0 && s.id !== own.id);
  const allyPositions = allies.map((s) => [s.x, s.y, s.angle]);
  touchStick(ui, "right", 170, 0, -1);
  tick(ui, 2);
  const shots = ui.battle.events.filter((e) => e.type === "shot");
  assert(shots.some((e) => e.shipId === own.id && e.weaponId === "chuanyun"));
  assert(
    shots.every((e) => e.shipId === own.id),
    "passive ships must never fire",
  );
  assert(
    ui.battle.events.some(
      (e) => e.type === "hit" && e.targetId === target.id && e.shieldHit,
    ),
  );
  assert(target.hardFlux > 0, "projectiles load real shield hard flux");
  assert(own.softFlux > 0, "weapon firing consumes soft flux");
  assert.equal(target.hp, target.maxHp);
  assert.deepEqual([target.x, target.y, target.angle], targetPosition);
  assert.deepEqual(
    allies.map((s) => [s.x, s.y, s.angle]),
    allyPositions,
  );
  ui.pointerCancel(170);
  ui.pending.shieldToggle = true;
  ui.frame(1 / 60);
  assert.equal(own.shieldOn, false);
  ui.pending.vent = true;
  ui.frame(1 / 60);
  assert(own.venting > 0);
  assert.equal(own.shieldOn, false);
});

test("training AI observation releases friendly ships while keeping the target passive", () => {
  const { ui } = fixture();
  ui.prepare(true);
  ui.launch();
  ui.toggleMode();
  assert.equal(ui.mode, "spectate");
  tick(ui, 1);
  const shots = ui.battle.events.filter((e) => e.type === "shot");
  assert(
    shots.some((e) => e.team === 0),
    "friendly AI must engage the training target",
  );
  assert(
    shots.every((e) => e.team === 0),
    "training target must not retaliate",
  );
});

test("training target does not inherit an incompatible opposing fleet refit", () => {
  const { ui } = fixture();
  ui.fleets[1] = ["shen"];
  ui.loadouts["1-0"] = {
    weapons: { e1: "lihuo", e2: "lihuo" },
    vents: 0,
    capacitors: 0,
  };
  const before = structuredClone(ui.loadouts);
  ui.prepare(true);
  assert.equal(ui.screen, "deploy");
  ui.launch();
  assert.equal(ui.screen, "battle");
  assert.equal(ui.battle.ships.find((s) => s.team === 1).typeId, "xie");
  assert.deepEqual(
    ui.loadouts,
    before,
    "training must not rewrite the saved refit",
  );
});

test("compact deployment toolbar leaves the bottom deployment band visible", () => {
  const { ui } = fixture(undefined, 844, 390);
  ui.prepare();
  ui.autoPlace();
  const drawn = [],
    button = ui.button.bind(ui);
  ui.button = (label, ...args) => {
    const b = button(label, ...args);
    if (["↶ 15°", "↷ 15°", "设为旗舰", "留备"].includes(label)) drawn.push(b);
    return b;
  };
  ui.draw();
  const zone = nav.deploymentZone(0),
    top = ui.toScreen(zone.minX, zone.minY),
    bottom = ui.toScreen(zone.maxX, zone.maxY);
  assert.equal(drawn.length, 4);
  for (const b of drawn) {
    assert(b.w >= 40 && b.h >= 40);
    const overlaps =
      b.x < bottom.x &&
      b.x + b.w > top.x &&
      b.y < bottom.y &&
      b.y + b.h > top.y;
    assert.equal(
      overlaps,
      false,
      "rotation/reserve toolbar must not hide deployed ships",
    );
  }
});

test("result buttons survive render frames between press and release", () => {
  for (const [width, height] of [
    [844, 390],
    [1280, 720],
  ]) {
    for (const pointerType of ["touch", "mouse"]) {
      for (const [label, screen] of [
        ["返回整备", "hangar"],
        ["重新部署", "deploy"],
      ]) {
        const { ui } = fixture(undefined, width, height);
        const buttons = new Map(),
          button = ui.button.bind(ui);
        ui.button = (text, ...args) => {
          const result = button(text, ...args);
          buttons.set(text, result);
          return result;
        };
        launch(ui);
        ui.keyDown("w");
        for (const ship of ui.battle.ships.filter((s) => s.team === 1)) {
          ship.hp = 0;
          ship.status = "destroyed";
        }
        ui.frame(1 / 60);
        assert.equal(ui.battle.status, "finished");
        assert.deepEqual(
          ui.keys,
          {},
          "ending combat must clear held flight controls",
        );
        const b = buttons.get(label),
          x = b.x + b.w / 2,
          y = b.y + b.h / 2;
        const oldBattle = ui.battle,
          endTime = oldBattle.time;
        ui.pointerDown(501, x, y, 0, pointerType);
        tick(ui, 0.15);
        assert.equal(
          oldBattle.time,
          endTime,
          "results must not advance combat",
        );
        ui.pointerUp(501, x, y);
        assert.equal(
          ui.screen,
          screen,
          `${label} should respond to ${pointerType} at ${width}x${height}`,
        );
        if (screen === "deploy") {
          assert.notEqual(ui.battle, oldBattle);
          assert.equal(ui.battle.time, 0);
        }
      }
    }
  }
});

test("contact sounds distinguish ballistic, beam, shield and plasma hits", () => {
  for (const [weaponId, damage, shieldHit, expected] of [
    ["chuanyun", 65, false, "impact_metal"],
    ["bengshan", 340, false, "impact_solid"],
    ["zhenhai", 900, false, "impact_heavy"],
    ["chuanyun", 65, true, "impact_shield"],
    ["fuling", 4, false, null],
    ["fuling", 4, true, null],
    ["lihuo", 100, false, "impact_plasma"],
  ]) {
    const { ui, played } = fixture();
    launch(ui);
    played.length = 0;
    ui.battle.events.push({
      seq: ++ui.battle.eventSeq,
      type: "hit",
      weaponId,
      damage,
      shieldHit,
      targetId: ui.flagshipId,
      x: ui.camera.x,
      y: ui.camera.y,
    });
    ui.frame(1 / 120);
    assert.deepEqual(
      played.filter((p) => p.name.startsWith("impact_")).map((p) => p.name),
      expected ? [expected] : [],
    );
    ui.frame(1 / 120);
    assert.equal(
      played.filter((p) => p.name === expected).length,
      expected ? 1 : 0,
      "event must not replay next frame",
    );
  }
});

test("manual battlefield pan and pinch preserve steering and never fire", () => {
  const { ui } = fixture();
  launch(ui);
  ui.camera.x = 2400;
  ui.camera.y = 1500;
  const angle = ui.aimAngle;
  ui.pointerDown(71, 500, 250);
  ui.pointerMove(71, 550, 250);
  assert.equal(ui.camera.mode, "free");
  assert(ui.camera.x < 2400);
  ui.pointerDown(72, 700, 250);
  const scale = ui.camera.scale;
  ui.pointerMove(72, 780, 250);
  assert(ui.camera.scale > scale);
  assert.equal(ui.command().fire, false);
  assert.equal(ui.aimAngle, angle);
  ui.pointerUp(71, 550, 250);
  ui.pointerUp(72, 780, 250);
  const x = ui.camera.x;
  ui.frame(1 / 60);
  assert.equal(ui.camera.x, x);
  ui.draw();
  ui.buttons.find((b) => b.role === "recenter").fn();
  assert.equal(ui.camera.mode, "follow");
  ui.pointerDown(73, 500, 250, 1, "mouse");
  ui.pointerMove(73, 600, 250);
  assert.equal(ui.camera.mode, "free");
  assert.equal(ui.mouseDown, false);
  assert.equal(ui.mouse, null);
  ui.pointerUp(73, 600, 250);
});

test("minimap drag seeks the battlefield without opening tactics or firing", () => {
  const { ui } = fixture();
  launch(ui);
  const b = ui.buttons.find((b) => b.role === "minimap");
  ui.pointerDown(81, b.x + b.w * 0.4, b.y + b.h * 0.5);
  const x = ui.camera.x;
  ui.pointerMove(81, b.x + b.w * 0.6, b.y + b.h * 0.5);
  assert(ui.camera.x > x);
  ui.pointerUp(81, b.x + b.w * 0.6, b.y + b.h * 0.5);
  assert.equal(ui.screen, "battle");
  assert.equal(ui.camera.mode, "free");
  assert.equal(ui.command().fire, false);
});

test("HUD idle fade keeps controls usable; toggleHud collapses sections and retains driving", () => {
  for (const [w, h] of [
    [1280, 720],
    [844, 390],
  ]) {
    const { ui, labels } = fixture(undefined, w, h);
    launch(ui);
    const scale = ui.camera.scale;
    ui._hudFade = ui.clock - 11;
    ui.draw();
    assert(ui.buttons.some((b) => b.role === "brake"));
    assert(ui.buttons.some((b) => b.role === "vent"));
    assert(ui.buttons.some((b) => b.role === "minimap"));
    ui.pointerDown(70, w / 2, h / 2, 0, "touch");
    ui.pointerUp(70, w / 2, h / 2);
    assert(ui.clock - ui._hudFade < 1);
    ui.toggleHud("topHudHidden");
    ui.draw();
    assert(!ui.buttons.some((b) => b.role === "minimap"));
    assert(!ui.bottomHudHidden);
    ui.toggleHud("bottomHudHidden");
    labels.length = 0;
    ui.draw();
    assert(ui.buttons.some((b) => b.role === "vent"));
    assert(ui.buttons.some((b) => b.role === "brake"));
    assert(Math.abs(ui.camera.scale - scale) < 1e-9);
    touchStick(ui, "left", 91, 1, 0);
    touchStick(ui, "right", 92, 1, 0);
    assert(ui.command().moveX > 0);
    assert(ui.command().fire);
    ui.clearInput();
    ui.toggleHud("topHudHidden");
    ui.toggleHud("bottomHudHidden");
    labels.length = 0;
    ui.draw();
    assert(ui.buttons.some((b) => b.role === "minimap"));
  }
});

test("ballistic firing selects caliber and real hull strikes stay audible", () => {
  for (const [weaponId, expected] of [
    ["chuanyun", "kinetic"],
    ["bengshan", "cannon_medium"],
    ["zhenhai", "cannon_heavy"],
  ]) {
    const { ui, played } = fixture();
    launch(ui);
    played.length = 0;
    ui.battle.events.push({
      seq: ++ui.battle.eventSeq,
      type: "shot",
      weaponId,
      shipId: ui.flagshipId,
    });
    ui.frame(1 / 120);
    assert(played.some((p) => p.name === expected));
  }
  const { ui, played } = fixture();
  ui.prepare(true);
  ui.launch();
  ui.draw();
  const target = ui.battle.ships.find((s) => s.team === 1);
  target.shieldOn = false;
  target.shieldLevel = 0;
  ui.flagship().autoGroups = [false, false, false];
  touchStick(ui, "right", 170, 0, -1);
  tick(ui, 2);
  assert(
    ui.battle.events.some(
      (e) => e.type === "hit" && !e.shieldHit && e.weaponId === "chuanyun",
    ),
  );
  assert(
    played.some(
      (p) => p.name === "impact_metal" && p.volume > 0.2 && p.volume < 0.9,
    ),
  );
});

test("flagship hits and explosions retain distance attenuation; beam events never stack one-shots", () => {
  function sample(distance, type, weaponId) {
    const { ui, played } = fixture();
    launch(ui);
    played.length = 0;
    ui.battle.events.push({
      seq: ++ui.battle.eventSeq,
      type,
      weaponId,
      damage: 900,
      sourceId: ui.flagshipId,
      targetId: "1-0",
      x: ui.camera.x + distance,
      y: ui.camera.y,
    });
    ui.frame(1 / 120);
    return played;
  }
  for (const [type, weapon] of [
    ["hit", "zhenhai"],
    ["explosion", null],
  ]) {
    const near = sample(50, type, weapon),
      far = sample(1600, type, weapon);
    const name = type === "hit" ? "impact_heavy" : "explosion";
    assert(
      near.find((p) => p.name === name).volume >
        far.find((p) => p.name === name).volume * 5,
    );
  }
  assert.equal(
    sample(100, "hit", "fuling").filter((p) => p.name.startsWith("impact_"))
      .length,
    0,
  );
});

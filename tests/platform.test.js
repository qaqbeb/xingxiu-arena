"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");
const { GameUI } = require("../miniprogram/core/game-ui");

function nativeFixture() {
  const handlers = {},
    labels = [],
    audio = [],
    storage = new Map();
  let now = 10000,
    scheduled,
    dimensions = {
      windowWidth: 844,
      windowHeight: 390,
      pixelRatio: 3,
      safeArea: { left: 20, top: 0, right: 824, bottom: 380 },
    };
  let menu = {
    left: 733,
    top: 8,
    right: 824,
    bottom: 40,
    width: 91,
    height: 32,
  };
  const finite = (name, args) => {
    for (const arg of args)
      if (typeof arg === "number")
        assert(Number.isFinite(arg), name + " received non-finite coordinate");
  };
  const stateStack = [];
  const context = new Proxy(
    {
      globalAlpha: 1,
      globalCompositeOperation: "source-over",
      lineWidth: 1,
      save() {
        stateStack.push({
          globalAlpha: this.globalAlpha,
          globalCompositeOperation: this.globalCompositeOperation,
          lineWidth: this.lineWidth,
        });
      },
      restore() {
        if (stateStack.length) Object.assign(this, stateStack.pop());
      },
      fillText(text, x, y, ...rest) {
        finite("fillText", [x, y, ...rest]);
        labels.push({ text: String(text), x, y });
      },
      measureText(text) {
        return { width: String(text).length * 9 };
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
      get: (obj, key) =>
        key in obj ? obj[key] : (...args) => finite(String(key), args),
      set(obj, key, value) {
        finite(String(key), [value]);
        obj[key] = value;
        return true;
      },
    },
  );
  const canvas = { getContext: () => context };
  const wx = {
    createCanvas: () => canvas,
    createImage: () => ({
      width: 1024,
      height: 1024,
      set src(value) {
        this._src = value;
        if (this.onload) this.onload();
      },
    }),
    getWindowInfo: () => dimensions,
    getMenuButtonBoundingClientRect: () => menu,
    getStorageSync: (key) => storage.get(key),
    setStorageSync: (key, value) => storage.set(key, value),
    createInnerAudioContext() {
      const item = {
        plays: 0,
        stops: 0,
        play() {
          this.plays++;
        },
        stop() {
          this.stops++;
        },
        onError(fn) {
          this.error = fn;
        },
      };
      audio.push(item);
      return item;
    },
  };
  for (const name of [
    "TouchStart",
    "TouchMove",
    "TouchEnd",
    "TouchCancel",
    "Hide",
    "Show",
    "WindowResize",
    "KeyDown",
    "KeyUp",
    "MouseDown",
    "MouseMove",
    "MouseUp",
    "Wheel",
  ])
    wx["on" + name] = (fn) => (handlers[name] = fn);
  class Clock extends Date {
    static now() {
      return now;
    }
  }
  const entry = path.resolve(__dirname, "../miniprogram/game.js");
  const scope = {
    wx,
    GameGlobal: {},
    Date: Clock,
    requestAnimationFrame: (fn) => {
      scheduled = fn;
    },
    require: createRequire(entry),
  };
  vm.runInNewContext(fs.readFileSync(entry, "utf8"), scope, {
    filename: entry,
  });
  const ui = scope.GameGlobal.arena;
  function frame(ms = 20) {
    now += ms;
    labels.length = 0;
    assert.equal(typeof scheduled, "function");
    scheduled();
  }
  function touch(id, x, y) {
    return { identifier: id, clientX: x, clientY: y };
  }
  function emit(type, touches) {
    handlers[type]({ changedTouches: touches });
  }
  function clickLabel(pattern, id = 1) {
    const hit = labels.find((label) =>
      typeof pattern === "string"
        ? label.text === pattern
        : pattern.test(label.text),
    );
    assert(hit, "visible control missing: " + pattern);
    emit("TouchStart", [touch(id, hit.x, hit.y)]);
    emit("TouchEnd", [touch(id, hit.x, hit.y)]);
    frame();
  }
  return {
    ui,
    playSound: scope.playSound,
    canvas,
    handlers,
    labels,
    audio,
    frame,
    touch,
    emit,
    clickLabel,
    setWindow(info, capsule) {
      dimensions = info;
      menu = capsule;
    },
  };
}

test("native touch adapter drives real UI from hangar through drag deployment into dual-stick combat", () => {
  const f = nativeFixture(),
    { ui, touch, emit, frame } = f;
  assert(ui instanceof GameUI, "adapter must use the real GameUI module");
  assert.equal(ui.screen, "hangar");
  assert.equal(f.canvas.width, 1688, "native DPR is capped at two");
  assert.deepEqual(ui.menuRect, {
    left: 733,
    top: 8,
    right: 824,
    bottom: 40,
    width: 91,
    height: 32,
  });
  f.clickLabel(/^部署舰队/);
  assert.equal(ui.screen, "deploy");
  const card = f.labels.find((label) => label.text === "拖入战场");
  assert(card);
  const nav = require("../miniprogram/core/navigation");
  const ship = ui.battle.ships.find(
    (s) => s.team === 0 && s.status === "reserve",
  );
  const placement = nav.findPlacement(ui.battle, ship.id);
  assert(placement);
  const target = ui.toScreen(placement.x, placement.y);
  emit("TouchStart", [touch(7, card.x, card.y)]);
  emit("TouchMove", [touch(7, target.x, target.y)]);
  frame();
  emit("TouchEnd", [touch(7, target.x, target.y)]);
  frame();
  assert.equal(
    Object.keys(ui.drafts).length,
    1,
    "drag must create one valid deployment draft",
  );
  f.clickLabel(/^出击/);
  assert.equal(ui.screen, "battle");
  assert.equal(ui.flagship().status, "active");
  assert(
    ui.battle.ships.some(
      (ship) => ship.team === 0 && ship.status === "reserve",
    ),
    "unplaced ships remain reserves",
  );
  const { left, right } = ui.stickZones();
  emit("TouchStart", [touch(11, left.x, left.y), touch(22, right.x, right.y)]);
  emit("TouchMove", [
    touch(11, left.x + left.r, left.y),
    touch(22, right.x, right.y - right.r),
  ]);
  const startX = ui.flagship().x;
  for (let i = 0; i < 15; i++) frame();
  assert(
    ui.flagship().x > startX,
    "native left touch must accelerate the flagship",
  );
  assert(
    ui.battle.events.some(
      (event) => event.type === "shot" && event.shipId === ui.flagshipId,
    ),
    "native right touch must fire flagship weapons",
  );
  emit("TouchEnd", [touch(11, left.x + left.r, left.y)]);
  assert.equal(ui.sticks.left, null);
  assert.equal(
    ui.sticks.right.id,
    22,
    "left release must preserve right touch",
  );
  emit("TouchStart", [touch(33, left.x, left.y)]);
  emit("TouchMove", [{ identifier: 33, x: left.x, y: left.y - left.r }]);
  assert(
    ui.sticks.left.dy < -0.9,
    "native x/y coordinate fallback remains supported",
  );
  emit("TouchCancel", [touch(22, right.x, right.y)]);
  assert.equal(ui.sticks.right, null);
  assert.equal(
    ui.sticks.left.id,
    33,
    "right cancellation must preserve left touch",
  );
  emit("TouchCancel", [touch(33, left.x, left.y)]);
  assert.equal(ui.sticks.left, null);
  assert(
    f.audio.some((voice) => voice.plays > 0),
    "adapter receives real gameplay audio requests",
  );
});

test("native hide clears held controls and freezes simulation; show refreshes dimensions and capsule without auto-resume", () => {
  const f = nativeFixture(),
    { ui, touch, emit, frame, handlers } = f;
  f.clickLabel(/^部署舰队/);
  f.clickLabel("快速布阵");
  f.clickLabel(/^出击/);
  const zones = ui.stickZones();
  emit("TouchStart", [
    touch(41, zones.left.x, zones.left.y),
    touch(42, zones.right.x, zones.right.y),
  ]);
  emit("TouchMove", [
    touch(41, zones.left.x + zones.left.r, zones.left.y),
    touch(42, zones.right.x + zones.right.r, zones.right.y),
  ]);
  handlers.KeyDown({ key: "d" });
  frame();
  assert(ui.flagship().vx > 0);
  handlers.Hide();
  const time = ui.battle.time;
  frame(1000);
  assert.equal(ui.battle.time, time);
  assert.equal(ui.paused, true);
  assert.equal(Object.keys(ui.pointers).length, 0);
  assert.equal(Object.keys(ui.keys).length, 0);
  assert.equal(ui.sticks.left, null);
  assert.equal(ui.sticks.right, null);
  assert.equal(ui.mouseDown, false);
  assert(f.audio.every((voice) => voice.stops > 0));
  const capsule = {
    left: 785,
    top: 10,
    right: 885,
    bottom: 42,
    width: 100,
    height: 32,
  };
  f.setWindow(
    {
      windowWidth: 900,
      windowHeight: 420,
      pixelRatio: 1,
      safeArea: { left: 15, top: 0, right: 885, bottom: 410 },
    },
    capsule,
  );
  handlers.Show();
  frame();
  assert.equal(ui.width, 900);
  assert.equal(ui.height, 420);
  assert.equal(f.canvas.width, 900);
  assert.equal(ui.safe.right, 885);
  assert.deepEqual(ui.menuRect, capsule);
  assert.equal(
    ui.battle.time,
    time,
    "foreground return must remain paused until explicit action",
  );
  f.clickLabel("战术图");
  f.clickLabel("继续驾驶");
  const resumed = ui.battle.time;
  frame();
  assert(ui.battle.time > resumed);
  assert.equal(ui.screen, "battle");
  assert.equal(ui.sticks.left, null);
  assert.equal(ui.sticks.right, null);
  const newer = { ...capsule, left: 780 };
  f.setWindow(
    {
      windowWidth: 900,
      windowHeight: 420,
      pixelRatio: 2,
      safeArea: { left: 15, top: 0, right: 885, bottom: 410 },
    },
    newer,
  );
  handlers.WindowResize();
  assert.equal(f.canvas.width, 1800);
  assert.deepEqual(ui.menuRect, newer);
});

test("native desktop mouse and wheel work with official SDK fields and coalesce translated touches", () => {
  const f = nativeFixture(),
    { ui, handlers, touch } = f;
  const calls = [];
  for (const method of [
    "pointerDown",
    "pointerMove",
    "pointerUp",
    "pointerCancel",
    "wheel",
    "keyDown",
    "keyUp",
  ])
    ui[method] = (...args) => calls.push([method, ...args]);
  handlers.MouseDown({ x: 200, y: 150, button: 2 });
  handlers.TouchStart({ changedTouches: [touch(1, 200, 150)] });
  handlers.MouseMove({ x: 220, y: 160, movementX: 20, movementY: 10 });
  handlers.MouseUp({ x: 220, y: 160, button: 2 });
  handlers.TouchEnd({ changedTouches: [touch(1, 220, 160)] });
  assert.equal(calls.filter((v) => v[0] === "pointerDown").length, 1);
  assert.deepEqual(calls[0], ["pointerDown", "mouse", 200, 150, 2, "mouse"]);
  assert(calls.some((v) => v[0] === "pointerUp" && v[1] === "mouse"));
  handlers.Wheel({ x: 300, y: 180, deltaY: -120 });
  assert.deepEqual(calls.at(-1), ["wheel", -120, 300, 180]);
  handlers.KeyDown({ code: "KeyW" });
  handlers.KeyDown({ key: "w", code: "KeyW" });
  assert.equal(calls.filter((v) => v[0] === "keyDown").length, 1);
  handlers.KeyUp({ key: "W", code: "KeyW" });
  assert.deepEqual(calls.at(-1), ["keyUp", "w"]);
  f.frame(600);
  handlers.TouchStart({ touches: [touch(7, 25, 40)] });
  handlers.MouseDown({ x: 25, y: 40, button: 0 });
  assert.equal(calls.filter((v) => v[0] === "pointerDown").length, 2);
  handlers.TouchEnd({ touches: [] });
  assert.deepEqual(calls.at(-1), ["pointerUp", 7, 25, 40, 0, "touch"]);
});

test("touches-only input clicks deployment and commits drag at its last coordinate; cancellation does not click", () => {
  const f = nativeFixture(),
    { ui, handlers, touch } = f;
  const button = f.labels.find((label) => /^部署舰队/.test(label.text));
  assert(button);
  handlers.TouchStart({ touches: [touch(81, button.x, button.y)] });
  handlers.TouchCancel({ touches: [] });
  assert.equal(ui.screen, "hangar", "cancellation must not activate a button");
  handlers.TouchStart({ touches: [touch(82, button.x, button.y)] });
  handlers.TouchEnd({ touches: [] });
  assert.equal(
    ui.screen,
    "deploy",
    "a touches-only release activates the actual deployment button",
  );
  f.frame();
  const card = f.labels.find((label) => label.text === "拖入战场");
  assert(card);
  const nav = require("../miniprogram/core/navigation");
  const ship = ui.battle.ships.find(
    (s) => s.team === 0 && s.status === "reserve",
  );
  const placement = nav.findPlacement(ui.battle, ship.id);
  const target = ui.toScreen(placement.x, placement.y);
  handlers.TouchStart({ touches: [touch(83, card.x, card.y)] });
  handlers.TouchMove({ touches: [touch(83, target.x, target.y)] });
  handlers.TouchEnd({ touches: [] });
  assert.equal(
    Object.keys(ui.drafts).length,
    1,
    "drag releases at the latest move coordinate",
  );
  assert(Math.abs(ui.drafts[ship.id].x - placement.x) < 1e-6);
  assert(Math.abs(ui.drafts[ship.id].y - placement.y) < 1e-6);
});

test("native impact audio has useful gain, bounded voices, cooldown and hide cleanup", () => {
  const f = nativeFixture();
  f.playSound("impact_metal", 0.3);
  assert.equal(f.audio.length, 1);
  assert(Math.abs(f.audio[0].volume - 0.27) < 1e-9);
  f.playSound("impact_metal", 0.3);
  assert.equal(f.audio[0].plays, 1, "same-frame hit bursts coalesce");
  for (let i = 0; i < 4; i++) {
    f.frame(70);
    f.playSound("explosion", 1);
  }
  assert.equal(
    f.audio.filter((a) => a.src.endsWith("explosion.wav")).length,
    3,
  );
  for (const name of [
    "kinetic",
    "missile",
    "plasma",
    "victory",
    "shield",
    "thrust",
    "strafe",
    "vent",
    "system",
    "beam",
    "impact_shield",
    "impact_heavy",
  ])
    f.playSound(name, 1);
  assert(
    f.audio.filter((a) => a.plays).length <= 13,
    "at most 12 active voices plus the expired hit",
  );
  assert(f.audio.every((a) => a.volume >= 0 && a.volume <= 0.9));
  f.handlers.Hide();
  assert(f.audio.every((a) => a.stops >= a.plays));
});

test("native right click toggles shields while left fire remains held", () => {
  const f = nativeFixture(),
    { ui, handlers } = f;
  f.clickLabel(/^部署舰队/);
  f.clickLabel("快速布阵");
  f.clickLabel(/^出击/);
  f.frame(600);
  const x = ui.width / 2,
    y = ui.height / 2;
  handlers.MouseDown({ x, y, button: 0 });
  assert.equal(ui.mouseDown, true);
  handlers.MouseDown({ x, y, button: 2 });
  assert.equal(ui.pending.shieldToggle, true);
  handlers.MouseUp({ x, y, button: 2 });
  assert.equal(ui.mouseDown, true);
  handlers.MouseUp({ x, y, button: 0 });
  assert.equal(ui.mouseDown, false);
});

test("native cannon variants rotate and all resolve to real PCM assets", () => {
  const f = nativeFixture();
  for (const name of [
    "kinetic",
    "cannon_medium",
    "cannon_heavy",
    "impact_metal",
    "impact_solid",
    "impact_heavy",
  ]) {
    const sources = [];
    for (let i = 0; i < 4; i++) {
      f.frame(700);
      f.playSound(name, 0.8);
      const voice = f.audio.find((a) =>
        a.src.endsWith(name + (i % 3 ? "_" + ((i % 3) + 1) : "") + ".wav"),
      );
      assert(voice);
      sources.push(voice.src);
      const data = fs.readFileSync(
        path.resolve(__dirname, "../miniprogram", voice.src),
      );
      assert.equal(data.toString("ascii", 0, 4), "RIFF");
      assert.equal(data.readUInt32LE(24), 22050);
    }
    assert.equal(new Set(sources).size, 3);
    assert.equal(sources[0], sources[3]);
  }
});

test("browser reserves impact voices and admits a heavy strike in a busy mix", () => {
  const html = fs.readFileSync(
    path.resolve(__dirname, "../index.html"),
    "utf8",
  );
  const code = html.slice(
    html.indexOf('"use strict";'),
    html.search(/const app = new (?:StarArena|StarRefit)\.GameUI/),
  );
  const voices = [];
  let now = 10000;
  class Audio {
    constructor(src) {
      this.src = src;
      this.plays = 0;
      this.pauses = 0;
      voices.push(this);
    }
    play() {
      this.plays++;
      return Promise.resolve();
    }
    pause() {
      this.pauses++;
    }
  }
  const scope = {
    StarBattleAudio: require("../miniprogram/core/battle-audio"),
    document: { getElementById() {} },
    performance: { now: () => now },
    Audio,
  };
  vm.runInNewContext(code, scope);
  for (const name of [
    "kinetic",
    "cannon_medium",
    "cannon_heavy",
    "missile",
    "plasma",
    "beam",
    "thrust",
    "explosion",
    "vent",
  ])
    scope.playSound(name, 0.6);
  assert.equal(
    voices.length,
    8,
    "firing and engines leave four slots for impacts",
  );
  for (const name of [
    "impact_metal",
    "impact_solid",
    "impact_beam",
    "impact_shield",
  ])
    scope.playSound(name, 0.8);
  assert.equal(voices.length, 12);
  scope.playSound("impact_heavy", 0.95);
  assert.equal(
    voices.filter((v) => v.pauses).length,
    1,
    "contact replaces one lower priority sound",
  );
  assert(
    voices.some((v) => v.src.endsWith("impact_heavy.wav") && v.plays === 1),
  );
  assert(voices.every((v) => v.volume > 0 && v.volume <= 0.9));
});

test("native distant shots load lowpass assets and beam loops stop on suspend", () => {
  const f = nativeFixture();
  f.playSound("cannon_heavy", 0.18, { far: true });
  assert(f.audio.some((v) => v.src.endsWith("cannon_heavy_far.wav")));
  f.ui.p.syncLoops([{ key: "beam_loop", volume: 0.12 }], 0.1);
  const loop = f.audio.find((v) => v.src.endsWith("beam_loop.wav"));
  assert(loop && loop.loop && loop.plays === 1);
  for (let i = 0; i < 10; i++)
    f.ui.p.syncLoops([{ key: "beam_loop", volume: 0.12 }], 0.05);
  assert.equal(loop.plays, 1);
  f.handlers.Hide();
  assert(loop.stops > 0);
});

// Native adapter; all input coordinates are logical screen pixels.
require("./core/ships");
require("./core/navigation");
require("./core/combat");
require("./core/battle-renderer");
const { GameUI } = require("./core/campaign-screen");
const battleAudio = require("./core/battle-audio");
const soundEngine = require("./core/sound-engine");
const canvas = wx.createCanvas();
const pools = Object.create(null);
const lastSound = Object.create(null);
const allowed = [
  "ui",
  "kinetic",
  "missile",
  "plasma",
  "explosion",
  "victory",
  "shield",
  "thrust",
  "strafe",
  "vent",
  "system",
  "beam",
  "impact_metal",
  "impact_shield",
  "impact_heavy",
  "impact_beam",
  "impact_beam_shield",
  "impact_plasma",
  "cannon_medium",
  "cannon_heavy",
  "impact_solid",
];
const duration = {
  ui: 90,
  kinetic: 160,
  missile: 300,
  plasma: 240,
  explosion: 1200,
  victory: 720,
  shield: 240,
  thrust: 300,
  strafe: 140,
  vent: 550,
  system: 380,
  beam: 180,
  impact_metal: 280,
  impact_shield: 320,
  impact_heavy: 580,
  impact_beam: 240,
  impact_beam_shield: 240,
  impact_plasma: 300,
  cannon_medium: 320,
  cannon_heavy: 550,
  impact_solid: 420,
};
const soundVariants = Object.create(null);
const variedSounds = [
  "kinetic",
  "cannon_medium",
  "cannon_heavy",
  "impact_metal",
  "impact_solid",
  "impact_heavy",
];
let duckUntil = 0;
const beamLoops = battleAudio.createLoops((name) => {
  const voice = wx.createInnerAudioContext();
  voice.src = "assets/audio/" + name + ".wav";
  voice.obeyMuteSwitch = true;
  return voice;
});
function syncLoops(requests, dt) {
  try {
    beamLoops.sync(requests, dt, Date.now() < duckUntil ? 0.4 : 1);
  } catch (_) {
    /* Audio failure must not stop combat. */
  }
}
function stopLoops() {
  try {
    beamLoops.stop();
  } catch (_) {
    /* Optional audio backend. */
  }
}
function playSound(name, volume = 1, options = {}) {
  try {
    if (!allowed.includes(name) || volume < 0.008) return;
    const now = Date.now();
    if (now - (lastSound[name] || 0) < (name === "ui" ? 35 : 65)) return;
    const all = Object.values(pools).flat();
    let active = all.filter((v) => v.until > now).length;
    const priority = name.startsWith("impact_");
    // Keep four channels available for contact; steal only lower-priority audio.
    if (!priority && active >= 8) return;
    if (active >= 12) {
      const victim = all
        .filter((v) => v.until > now && !v.priority)
        .sort((a, b) => a.until - b.until)[0];
      if (!victim) return;
      victim.audio.stop();
      victim.until = 0;
      active--;
    }
    const pool = pools[name] || (pools[name] = []);
    let voice = pool.find((v) => v.until <= now);
    if (!voice && pool.length >= 3) return;
    if (!voice) {
      const audio = wx.createInnerAudioContext();
      audio.src = "assets/audio/" + name + ".wav";
      audio.obeyMuteSwitch = true;
      voice = { audio, until: 0 };
      pool.push(voice);
      if (audio.onError)
        audio.onError(() => {
          voice.until = 0;
        });
    }
    voice.priority = priority;
    let filename = name;
    if (variedSounds.includes(name)) {
      const variant = soundVariants[name] || 0;
      soundVariants[name] = (variant + 1) % 3;
      filename += variant ? "_" + (variant + 1) : "";
    }
    if (options.far) filename += "_far";
    voice.audio.src = "assets/audio/" + filename + ".wav";
    if (
      name === "impact_heavy" ||
      name === "impact_solid" ||
      name === "explosion"
    )
      duckUntil = Date.now() + 160;
    const overlap = pool.filter((v) => v.until > now).length;
    voice.audio.volume =
      (0.9 * Math.max(0, Math.min(1, Number.isFinite(volume) ? volume : 1))) /
      Math.sqrt(1 + overlap * 0.4 + active * 0.05);
    voice.until = now + duration[name];
    lastSound[name] = now;
    voice.audio.stop();
    voice.audio.play();
  } catch (_) {
    /* Audio is optional. */
  }
}
// Audio and the later hulls live in subpackages so the main package stays
// small. Without subpackage support everything is already in place.
const packs = typeof wx.loadSubpackage === "function";
function loadPack(name, done) {
  if (!packs) return done(true);
  try {
    wx.loadSubpackage({
      name,
      success: () => done(true),
      fail: () => done(false),
    });
  } catch (_) {
    done(false);
  }
}
// Web Audio engine when the base library has one; InnerAudioContext stays as fallback.
let engine = null;
function startEngine() {
  try {
    if (wx.createWebAudioContext && wx.getFileSystemManager) {
      const files = wx.getFileSystemManager();
      engine = soundEngine.create(
        wx.createWebAudioContext(),
        (path) =>
          new Promise((resolve, reject) =>
            files.readFile({
              filePath: path,
              success: (r) => resolve(r.data),
              fail: reject,
            }),
          ),
      );
    }
  } catch (_) {
    engine = null;
  }
}
// The engine decodes from both audio folders, so wait for both.
loadPack("sfx", () => loadPack("audio", startEngine));
const game = new GameUI({
  canvas,
  createImage: () => wx.createImage(),
  assetRoot: "",
  deferPacks: packs,
  playSound(name, volume, options) {
    if (engine && engine.has(name)) engine.play(name, volume, options);
    else playSound(name, volume, options);
  },
  syncLoops(requests, dt) {
    if (engine && engine.has("beam_loop")) engine.syncLoops(requests, dt);
    else syncLoops(requests, dt);
  },
  stopLoops() {
    if (engine) engine.stopLoops();
    stopLoops();
  },
  vibrate(strong) {
    try {
      if (wx.vibrateShort) wx.vibrateShort({ type: strong ? "heavy" : "light" });
    } catch (_) {}
  },
  save(value) {
    try {
      wx.setStorageSync("xingxiu.settings.v2", value);
    } catch (_) {}
  },
  load() {
    try {
      return wx.getStorageSync("xingxiu.settings.v2");
    } catch (_) {
      return null;
    }
  },
});
function resize() {
  const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
  game.resize(
    info.windowWidth,
    info.windowHeight,
    Math.min(info.pixelRatio || 1, 2),
    info.safeArea,
  );
  try {
    game.menuRect = wx.getMenuButtonBoundingClientRect
      ? wx.getMenuButtonBoundingClientRect()
      : null;
  } catch (_) {
    game.menuRect = null;
  }
}
if (packs) loadPack("ships2", (ok) => ok && game.loadPack("ships2"));
if (packs) loadPack("weapons", (ok) => ok && game.loadPack("weapons"));
resize();
if (wx.onWindowResize) wx.onWindowResize(resize);
const touches = new Set();
const touchPoints = new Map();
const keys = new Set();
// Official PC events use x/y, button (0/1/2), and keyboard key/code.
// https://github.com/wechat-miniprogram/minigame-api-typings/blob/master/types/wx/lib.wx.api.d.ts
let inputSource = "",
  sourceTime = -Infinity,
  mouseHeld = false,
  mouseButton = 0;
function claim(source) {
  const now = Date.now();
  if (
    source !== inputSource &&
    (now - sourceTime < 500 || mouseHeld || touches.size)
  )
    return false;
  inputSource = source;
  sourceTime = now;
  return true;
}
function point(e) {
  const x = e.clientX == null ? e.x : e.clientX;
  const y = e.clientY == null ? e.y : e.clientY;
  return Number.isFinite(x) && Number.isFinite(y) ? [x, y] : null;
}
function bindTouch(api, method) {
  if (typeof wx[api] !== "function") return;
  wx[api]((event) => {
    const ending = method === "pointerUp" || method === "pointerCancel";
    if (method === "pointerDown" && !claim("touch")) return;
    if (inputSource !== "touch") return;
    sourceTime = Date.now();
    const changed = event.changedTouches || (!ending ? event.touches : null);
    if (!changed) {
      // Without changedTouches, ended IDs have disappeared from touches.
      const remaining = new Set((event.touches || []).map((v) => v.identifier));
      for (const id of touches)
        if (!remaining.has(id)) {
          const xy = touchPoints.get(id);
          if (method === "pointerUp" && xy)
            game.pointerUp(id, ...xy, 0, "touch");
          else game.pointerCancel(id);
          touches.delete(id);
          touchPoints.delete(id);
        }
      return;
    }
    for (const touch of changed) {
      const id = touch.identifier,
        xy = point(touch);
      if (id == null) continue;
      if (method === "pointerDown" && xy) touches.add(id);
      else if (!touches.has(id)) continue;
      if (xy) touchPoints.set(id, xy);
      const lastPoint = xy || (ending && touchPoints.get(id));
      if (ending) {
        touches.delete(id);
        touchPoints.delete(id);
      }
      if (lastPoint) game[method](id, ...lastPoint, 0, "touch");
      else if (ending) game.pointerCancel(id);
    }
  });
}
bindTouch("onTouchStart", "pointerDown");
bindTouch("onTouchMove", "pointerMove");
bindTouch("onTouchEnd", "pointerUp");
bindTouch("onTouchCancel", "pointerCancel");
if (typeof wx.onMouseDown === "function")
  wx.onMouseDown((e) => {
    const xy = point(e);
    if (!xy || !claim("mouse")) return;
    if (mouseHeld) {
      if (
        mouseButton === 0 &&
        e.button === 2 &&
        game.mouseDown &&
        game.screen === "battle" &&
        !game.paused &&
        !game.modal &&
        game.mode === "manual"
      )
        game.pending.shieldToggle = true;
      return;
    }
    mouseHeld = true;
    mouseButton = e.button || 0;
    game.pointerDown("mouse", ...xy, e.button || 0, "mouse");
  });
if (typeof wx.onMouseMove === "function")
  wx.onMouseMove((e) => {
    const xy = point(e);
    if (xy && (inputSource !== "touch" || Date.now() - sourceTime >= 500))
      game.pointerMove("mouse", ...xy);
  });
if (typeof wx.onMouseUp === "function")
  wx.onMouseUp((e) => {
    if (!mouseHeld || (e.button || 0) !== mouseButton) return;
    const xy = point(e);
    mouseHeld = false;
    sourceTime = Date.now();
    if (xy) game.pointerUp("mouse", ...xy);
    else game.pointerCancel("mouse");
  });
if (typeof wx.onWheel === "function")
  wx.onWheel((e) => {
    const xy = point(e);
    if (xy && Number.isFinite(e.deltaY)) game.wheel(e.deltaY, ...xy);
  });
function keyName(e) {
  if (typeof e.key === "string" && e.key) return e.key.toLowerCase();
  const code = e.code || "";
  if (/^Key[A-Z]$/.test(code)) return code.slice(3).toLowerCase();
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  return (
    { Space: " ", ShiftLeft: "shift", ShiftRight: "shift" }[code] ||
    code.toLowerCase()
  );
}
if (wx.onKeyDown)
  wx.onKeyDown((e) => {
    const key = keyName(e);
    if (key && !keys.has(key)) {
      keys.add(key);
      game.keyDown(key);
    }
  });
if (wx.onKeyUp)
  wx.onKeyUp((e) => {
    const key = keyName(e);
    if (key) {
      keys.delete(key);
      game.keyUp(key);
    }
  });
let last = Date.now();
let hidden = false;
function suspend() {
  if (mouseHeld) game.pointerCancel("mouse");
  mouseHeld = false;
  inputSource = "";
  sourceTime = -Infinity;
  touches.forEach((id) => game.pointerCancel(id));
  touches.clear();
  touchPoints.clear();
  keys.forEach((key) => game.keyUp(key));
  keys.clear();
  game.suspend();
  if (engine) engine.suspend();
  Object.values(pools)
    .flat()
    .forEach((v) => {
      try {
        v.audio.stop();
      } catch (_) {}
      v.until = 0;
    });
}
if (wx.onHide)
  wx.onHide(() => {
    hidden = true;
    suspend();
  });
if (wx.onShow)
  wx.onShow(() => {
    hidden = false;
    last = Date.now();
    if (engine) engine.resume();
    resize();
  });
function frame() {
  const now = Date.now();
  if (!hidden) game.frame(Math.min((now - last) / 1000, 0.05));
  last = now;
  requestAnimationFrame(frame);
}
frame();
GameGlobal.arena = game;

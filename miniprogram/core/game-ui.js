(function (root, factory) {
  if (typeof module === "object" && module.exports)
    module.exports = factory(
      require("./ships"),
      require("./combat"),
      require("./navigation"),
      require("./battle-renderer"),
      require("./battle-audio"),
    );
  else
    root.StarArena = factory(
      root.StarShips,
      root.StarCombat,
      root.StarNavigation,
      root.StarBattleRenderer,
      root.StarBattleAudio,
    );
})(
  typeof globalThis !== "undefined" ? globalThis : this,
  function (catalog, combat, nav, renderer, audio) {
    "use strict";
    // ── HUD colour tokens (military sci-fi) ──────────────────────────
    const C = {
      bg: "#050b13",
      panel: "#0b1925",
      line: "#243b48",
      text: "#e8eeeb",
      muted: "#a9c0c9",   // ≥5.5:1 on #0b1925
      dim: "#4d6878",
      mint: "#8cdec6",
      gold: "#ddba83",
      red: "#ed9989",
      blue: "#85ccea",
    };
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const fmt = (t) =>
      Math.floor(t / 60)
        .toString()
        .padStart(2, "0") +
      ":" +
      Math.floor(t % 60)
        .toString()
        .padStart(2, "0");
    const clone = (v) => JSON.parse(JSON.stringify(v));
    const active = (s) => s.status === "active";
    const SIZE = { small: "小", medium: "中", large: "大" },
      TYPE = { ballistic: "实弹", energy: "能量", missile: "导弹" };

    // ── chamfered rect helper (pure maths, no state) ─────────────────
    function chamferPath(c, x, y, w, h, ch) {
      ch = Math.min(ch, w / 2, h / 2);
      c.beginPath();
      c.moveTo(x + ch, y);
      c.lineTo(x + w - ch, y);
      c.lineTo(x + w, y + ch);
      c.lineTo(x + w, y + h - ch);
      c.lineTo(x + w - ch, y + h);
      c.lineTo(x + ch, y + h);
      c.lineTo(x, y + h - ch);
      c.lineTo(x, y + ch);
      c.closePath();
    }

    class GameUI {
      constructor(platform) {
        this.p = platform;
        this.canvas = platform.canvas;
        this.ctx = this.canvas.getContext("2d");
        this.images = {};
        this.assetErrors = [];
        this.screen = "hangar";
        this.fleets = [
          ["xia", "tian", "shen"],
          ["xie", "xia", "tian"],
        ];
        this.loadouts = {};
        this.team = 0;
        this.slot = 0;
        this.selected = "xia";
        this.clock = 0;
        this.acc = 0;
        this.seed = 2127;
        this.buttons = [];
        this.pointers = {};
        this.keys = {};
        this.sticks = { left: null, right: null };
        this.pending = {};
        this.manualGroup = 0;
        this.sound = true;
        this.soundTimes = {};
        this.modal = null;
        this.paused = false;
        this.mode = "manual";
        this.speed = 1;
        this.toast = "";
        this.toastUntil = 0;
        this.inputKind = "";
        this.drafts = {};
        this.selectedShip = null;
        this.pendingDeploy = null;
        this.aimAngle = 0;
        this.mouse = null;
        this.lastEvent = 0;
        this.lastAlive = true;
        this.orderMode = null;
        // ── NEW: design-system state ──────────────────────────────
        this._pressedBtn = null;       // {id, x, y} for press visual
        this.screenChangedAt = 0;      // for 120ms transition
        this._crosshairFlash = 0;      // 150ms red flash timer
        this._joystickGhosts = {};     // ghost fade {left:{x,y,op},right:{x,y,op}}
        this._cachedGradients = {};     // gradient cache key→CanvasGradient
        this._hudFade = 0;              // last pointer event time for auto-HUD-fade
        try {
          const saved = platform.load && platform.load();
          if (saved && saved.version === 2) {
            if (
              saved.fleets &&
              saved.fleets.length === 2 &&
              saved.fleets.every((a) => nav.validateFleet(a).ok)
            )
              this.fleets = saved.fleets;
            if (typeof saved.sound === "boolean") this.sound = saved.sound;
            this.loadouts = saved.loadouts || {};
          }
        } catch (e) {}
        this.selected = this.fleets[0][0];
        // Hulls shipped in a subpackage wait until the adapter reports it loaded.
        catalog.SHIPS.forEach((s) => {
          if (!s.pack || !platform.deferPacks) this.loadShipImage(s);
        });
        const background = platform.createImage();
        background.onload = () => {
          this.images.background = background;
        };
        background.onerror = () => this.assetErrors.push("background");
        background.src = platform.assetRoot + "assets/backgrounds/nebula.jpg";
        let n = 418;
        this.stars = [];
        for (let i = 0; i < 250; i++) {
          n = (n * 1664525 + 1013904223) >>> 0;
          const x = n / 4294967296;
          n = (n * 1664525 + 1013904223) >>> 0;
          this.stars.push({
            x,
            y: n / 4294967296,
            r: i % 13 === 0 ? 1.25 : 0.55,
            a: 0.12 + (i % 5) * 0.09,
          });
        }
      }

      loadShipImage(s) {
        const img = this.p.createImage();
        img.onload = () => {
          this.images[s.id] = img;
        };
        img.onerror = () => this.assetErrors.push(s.id);
        img.src = this.p.assetRoot + s.asset;
      }
      // Called by the adapter once a subpackage is on disk.
      loadPack(name) {
        catalog.SHIPS.filter((s) => s.pack === name).forEach((s) =>
          this.loadShipImage(s),
        );
      }

      // ── resize ───────────────────────────────────────────────────
      resize(w, h, dpr, safeArea) {
        this.width = w;
        this.height = h;
        this.dpr = dpr || 1;
        this.u = clamp(Math.min(w / 1280, h / 720), 0.72, 1.15);
        this.compact = h < 520;
        this.safe = {
          left: (safeArea && safeArea.left) || 0,
          top: (safeArea && safeArea.top) || 0,
          right: (safeArea && safeArea.right) || w,
          bottom: (safeArea && safeArea.bottom) || h,
        };
        this.canvas.width = Math.round(w * this.dpr);
        this.canvas.height = Math.round(h * this.dpr);
        this.clearInput();
        this.configureViewport();
      }

      configureViewport() {
        const s = this.safe || {
          left: 0,
          top: 0,
          right: this.width,
          bottom: this.height,
        };
        const isMap = this.screen === "deploy" || this.screen === "tactical";
        this.viewport = {
          x: s.left,
          y: s.top + (isMap ? 64 : 0),
          w:
            s.right -
            s.left -
            (this.screen === "tactical"
              ? Math.min(250, (s.right - s.left) * 0.3)
              : 0),
          h: s.bottom - s.top - (isMap ? 130 : 0),
        };
        if (!this.camera)
          this.camera = nav.createCamera(this.viewport.w, this.viewport.h);
        else nav.resizeCamera(this.camera, this.viewport.w, this.viewport.h);
        if (this.screen === "battle")
          nav.setCameraFocus(
            this.camera,
            this.topHudHidden ? 0 : 44,
            this.viewport.h -
              (this.bottomHudHidden ? 20 : this.mode === "manual" ? 74 : 56),
          );
        else nav.setCameraFocus(this.camera);
        if (isMap) nav.setCameraMode(this.camera, "overview");
      }

      setScreen(screen) {
        this.clearInput();
        this.toast = "";
        this.toastUntil = 0;
        this.screen = screen;
        this.screenChangedAt = this.clock;
        this.configureViewport();
        this._hudFade = this.clock;
      }

      save() {
        try {
          if (this.p.save)
            this.p.save({
              version: 2,
              fleets: this.fleets,
              loadouts: this.loadouts,
              sound: this.sound,
            });
        } catch (e) {}
      }

      notify(t) {
        this.toast = t;
        this.toastUntil = this.clock + 3;
      }

      play(name, volume = 0.4, options = {}) {
        if (!this.sound || !this.p.playSound) return;
        const cooldown =
          name === "kinetic" ||
          name.startsWith("cannon_") ||
          ["impact_metal", "impact_solid", "impact_heavy"].includes(name)
            ? 0.065
            : 0.18;
        if (this.clock - (this.soundTimes[name] ?? -100) < cooldown) return;
        this.soundTimes[name] = this.clock;
        this.p.playSound(name, volume, options);
      }

      clearInput() {
        this.mapGesture = null;
        this.pointers = {};
        this.keys = {};
        this.sticks = { left: null, right: null };
        this.pending = {};
        this.mouseDown = false;
        this.braking = false;
        this.ventHold = null;
        this.mouse = null;
        this._pressedBtn = null;
      }

      suspend() {
        this.clearInput();
        if (this.p.stopLoops) this.p.stopLoops();
        if (this.screen === "battle") this.paused = true;
      }

      flagship() {
        return (
          this.battle && this.battle.ships.find((s) => s.id === this.flagshipId)
        );
      }
      chosenShip() {
        return (
          this.battle &&
          this.battle.ships.find((s) => s.id === this.selectedShip)
        );
      }

      // ── coord helpers ────────────────────────────────────────────
      toScreen(x, y) {
        const p = nav.worldToScreen(this.camera, x, y);
        return { x: p.x + this.viewport.x, y: p.y + this.viewport.y };
      }
      toWorld(x, y) {
        return nav.screenToWorld(
          this.camera,
          x - this.viewport.x,
          y - this.viewport.y,
        );
      }

      // ── hit-test (unchanged API) ─────────────────────────────────
      hitButton(x, y) {
        for (let i = this.buttons.length - 1; i >= 0; i--) {
          const b = this.buttons[i];
          if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h)
            return b;
        }
        return null;
      }
      containsView(x, y) {
        const v = this.viewport;
        return x >= v.x && x <= v.x + v.w && y >= v.y && y <= v.y + v.h;
      }
      mapInputAllowed() {
        return (
          this.screen === "deploy" ||
          this.screen === "tactical" ||
          (this.screen === "battle" &&
            (this.mode === "spectate" || !this.paused))
        );
      }
      returnToFlagship() {
        this.mouse = null;
        this.autoZoom = true;
        nav.setCameraMode(this.camera, "follow");
      }
      seekMinimap(button, x, y) {
        this.mouse = null;
        this.camera.x = clamp((x - button.x) / button.w, 0, 1) * 4800;
        this.camera.y = clamp((y - button.y) / button.h, 0, 1) * 3000;
        nav.panCamera(this.camera, 0, 0);
      }
      toggleHud(which) {
        const scale = this.camera.scale;
        this[which] = !this[which];
        this.configureViewport();
        this.camera.zoom = scale / this.camera.baseScale;
        nav.zoomCamera(this.camera, 1);
      }

      // ── map gesture ──────────────────────────────────────────────
      startMapGesture() {
        if (this.mapGesture || !this.mapInputAllowed()) return;
        const points = Object.values(this.pointers).filter(
          (p) => p.kind === "map" && p.pointerType !== "mouse",
        );
        if (points.length < 2) return;
        const [a, b] = points;
        points.forEach((p) => (p.moved = true));
        this.mapGesture = {
          ids: [a.id, b.id],
          x: (a.x + b.x) / 2,
          y: (a.y + b.y) / 2,
          distance: Math.hypot(a.x - b.x, a.y - b.y),
        };
      }
      releaseMapGesture(id) {
        if (!this.mapGesture || !this.mapGesture.ids.includes(id)) return;
        this.mapGesture = null;
        for (const p of Object.values(this.pointers))
          if (p.kind === "map") {
            p.moved = true;
            p.sx = p.x;
            p.sy = p.y;
          }
        this.startMapGesture();
      }

      // ── pointer events (API unchanged) ───────────────────────────
      pointerDown(id, x, y, button = 0, pointerType = "touch") {
        this._hudFade = this.clock;
        this.inputKind = pointerType === "mouse" ? "desktop" : "touch";
        const b = this.hitButton(x, y),
          p = {
            id,
            x,
            y,
            sx: x,
            sy: y,
            time: this.clock,
            kind: "button",
            button: b,
            pointerType,
          };
        this.pointers[id] = p;
        if (b) {
          this._pressedBtn = { id: b._uid || (b._uid = Math.random()), x, y };
          if (b.role === "minimap") {
            p.kind = "minimap";
            this.seekMinimap(b, x, y);
          } else if (b.role === "reserve") {
            p.kind = "deploy";
            p.shipId = b.shipId;
            this.pendingDeploy = b.shipId;
            this.selectedShip = b.shipId;
          } else if (b.role === "vent") {
            this.ventHold = { id, start: this.clock };
          } else if (b.role === "brake") {
            this.braking = true;
          }
          return;
        }
        if (this.modal) return;
        if (
          this.screen === "battle" &&
          !this.paused &&
          this.mode === "manual"
        ) {
          if (pointerType === "mouse" && button === 1) {
            p.kind = "map";
            p.moved = true;
            this.mouse = null;
            return;
          }
          const zones = this.stickZones();
          const midX = (this.safe.left + this.safe.right) / 2;
          if (pointerType !== "mouse") {
            const bottomThreshold = this.safe.bottom - (this.compact ? 200 : 220);
            if (y > bottomThreshold) {
              if (x < midX && !this.sticks.left) {
                p.kind = "stick";
                p.stick = "left";
                this.mouse = null;
                this.sticks.left = { id, x, y, dx: 0, dy: 0 };
                this.moveStick(p, x, y);
                return;
              }
              if (x >= midX && !this.sticks.right) {
                p.kind = "stick";
                p.stick = "right";
                this.mouse = null;
                this.sticks.right = { id, x, y, dx: 0, dy: 0 };
                this.moveStick(p, x, y);
                return;
              }
            }
          } else {
            for (const key of ["left", "right"]) {
              const z = zones[key];
              if (Math.hypot(x - z.x, y - z.y) < z.r * 1.45 && !this.sticks[key]) {
                p.kind = "stick";
                p.stick = key;
                this.mouse = null;
                this.sticks[key] = { id, x: z.x, y: z.y, dx: 0, dy: 0 };
                this.moveStick(p, x, y);
                return;
              }
            }
          }
          if (pointerType === "mouse") {
            p.kind = "mouse";
            this.mouse = { x, y };
            if (button === 2) this.pending.shieldToggle = true;
            else this.mouseDown = true;
            return;
          }
          if (this.containsView(x, y)) {
            p.kind = "map";
            this.mouse = null;
            this.startMapGesture();
          }
          return;
        }
        if (this.mapInputAllowed() && this.containsView(x, y)) {
          p.kind = "map";
          p.world = this.toWorld(x, y);
          this.startMapGesture();
        }
      }

      moveStick(p, x, y) {
        const st = this.sticks[p.stick];
        if (!st || st.id !== p.id) return;
        const r = this.stickZones()[p.stick].r * 0.68,
          dx = (x - st.x) / r,
          dy = (y - st.y) / r,
          n = Math.max(1, Math.hypot(dx, dy));
        st.dx = dx / n;
        st.dy = dy / n;
        // ── NEW: aim deadzone + aim-assist ──
        if (p.stick === "right" && Math.hypot(dx, dy) > 0.25) {
          let angle = Math.atan2(dy, dx);
          // aim assist: nudge toward nearest enemy within ±10°
          angle = this._aimAssist(angle, st.x, st.y);
          this.aimAngle = angle;
        }
      }

      _aimAssist(angle, cx, cy) {
        const ship = this.flagship();
        if (!ship) return angle;
        const THRESHOLD = 10 * Math.PI / 180; // ±10°
        const RANGE = 700;
        let best = null, bestDist = Infinity;
        for (const s of this.battle.ships) {
          if (s.team === 0 || s.status === "destroyed") continue;
          const d = Math.hypot(s.x - ship.x, s.y - ship.y);
          if (d > RANGE) continue;
          const targetAngle = Math.atan2(s.y - ship.y, s.x - ship.x);
          let diff = targetAngle - angle;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          if (Math.abs(diff) < THRESHOLD && d < bestDist) {
            best = targetAngle;
            bestDist = d;
          }
        }
        if (best !== null) {
          // lerp≈0.15缓吸
          let diff = best - angle;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          return angle + diff * 0.15;
        }
        return angle;
      }

      pointerMove(id, x, y) {
        const p = this.pointers[id];
        if (!p || (p.pointerType === "mouse" && p.kind === "mouse"))
          this.mouse = { x, y };
        else this.mouse = null;
        if (!p) return;
        const dx = x - p.x,
          dy = y - p.y;
        p.x = x;
        p.y = y;
        if (p.kind === "minimap") {
          this.seekMinimap(p.button, x, y);
          return;
        }
        if (p.kind === "stick") this.moveStick(p, x, y);
        if (p.kind === "deploy" && Math.hypot(x - p.sx, y - p.sy) > 6) {
          this.drag = { shipId: p.shipId, x, y };
        }
        if (p.kind === "map" && this.mapGesture) {
          const g = this.mapGesture,
            a = this.pointers[g.ids[0]],
            b = this.pointers[g.ids[1]];
          if (a && b) {
            const cx = (a.x + b.x) / 2,
              cy = (a.y + b.y) / 2,
              distance = Math.hypot(a.x - b.x, a.y - b.y);
            nav.panCamera(this.camera, cx - g.x, cy - g.y);
            if (g.distance > 1 && distance > 1)
              nav.zoomCamera(
                this.camera,
                distance / g.distance,
                cx - this.viewport.x,
                cy - this.viewport.y,
              );
            g.x = cx;
            g.y = cy;
            g.distance = distance;
          }
          p.moved = true;
          return;
        }
        if (
          p.kind === "map" &&
          (p.moved || Math.hypot(x - p.sx, y - p.sy) > 8)
        ) {
          p.moved = true;
          nav.panCamera(this.camera, dx, dy);
        }
      }

      pointerUp(id, x, y) {
        const p = this.pointers[id];
        if (!p) return;
        delete this.pointers[id];
        this.releaseMapGesture(id);
        this._pressedBtn = null;
        if (p.kind === "stick") {
          const st = this.sticks[p.stick];
          if (st) {
            this._joystickGhosts[p.stick] = {
              x: st.x + st.dx * this.stickZones()[p.stick].r * 0.68,
              y: st.y + st.dy * this.stickZones()[p.stick].r * 0.68,
              op: 0.6,
            };
          }
          this.sticks[p.stick] = null;
          return;
        }
        if (p.kind === "mouse") {
          this.mouseDown = false;
          return;
        }
        if (p.kind === "deploy") {
          if (this.drag && this.containsView(x, y))
            this.placeDraft(p.shipId, this.toWorld(x, y));
          this.drag = null;
          return;
        }
        if (
          p.kind === "map" &&
          !p.moved &&
          !(this.screen === "battle" && this.mode === "manual")
        )
          this.mapClick(x, y);
        if (p.kind === "button" && p.button) {
          const b = p.button;
          if (b.role === "brake") this.braking = false;
          if (b.role === "vent") {
            this.ventHold = null;
            return;
          }
          if (
            Math.hypot(x - p.sx, y - p.sy) < 10 &&
            x >= b.x &&
            x <= b.x + b.w &&
            y >= b.y &&
            y <= b.y + b.h
          ) {
            this.play("ui", 0.22);
            b.fn();
          }
        }
      }

      pointerCancel(id) {
        const p = this.pointers[id];
        if (p && p.kind === "stick") this.sticks[p.stick] = null;
        delete this.pointers[id];
        this.releaseMapGesture(id);
        this.drag = null;
        this.mouseDown = false;
        this.braking = false;
        this.ventHold = null;
        this._pressedBtn = null;
      }

      wheel(delta, x, y) {
        if (!this.camera || this.screen === "hangar" || this.modal) return;
        this.autoZoom = false;
        nav.zoomCamera(
          this.camera,
          delta > 0 ? 0.88 : 1.14,
          x - this.viewport.x,
          y - this.viewport.y,
        );
      }

      keyDown(key) {
        key = key.toLowerCase();
        if (this.keys[key]) return;
        this.keys[key] = true;
        this.inputKind = "desktop";
        if (this.modal) {
          if (key === "escape") this.modal = null;
          return;
        }
        // ── NEW: unified pause → tactical ──
        if (key === " " || key === "space") {
          if (this.screen === "battle") this.openTactical();
          else if (this.screen === "tactical") this.resumeBattle();
          return;
        }
        if (this.screen !== "battle" || this.mode !== "manual") return;
        if (key === "v") this.pending.vent = true;
        if (key === "f") this.pending.system = true;
        if (key === "r") this.toggleAuto(this.manualGroup);
        if (["1", "2", "3"].includes(key)) this.manualGroup = Number(key) - 1;
      }

      keyUp(key) {
        delete this.keys[key.toLowerCase()];
      }

      // ── fleet / loadout logic (unchanged) ────────────────────────
      changeFleet(typeId) {
        const a = this.fleets[this.team].slice();
        if (this.slot > a.length) this.slot = a.length;
        a[this.slot] = typeId;
        const result = nav.validateFleet(a);
        if (!result.ok) {
          this.notify(result.reason);
          return;
        }
        this.fleets[this.team] = a;
        delete this.loadouts[this.team + "-" + this.slot];
        this.selected = typeId;
        this.save();
      }

      removeSlot(team, index) {
        if (this.fleets[team].length === 1) {
          this.notify("至少保留一艘战舰");
          return;
        }
        this.fleets[team].splice(index, 1);
        for (let i = index; i < 4; i++) {
          const next = this.loadouts[team + "-" + (i + 1)];
          if (next) this.loadouts[team + "-" + i] = next;
          else delete this.loadouts[team + "-" + i];
        }
        this.slot = Math.min(this.slot, this.fleets[team].length - 1);
        this.selected = this.fleets[team][this.slot];
        this.save();
      }

      fitting(id) {
        return (
          this.loadouts[id] ||
          (this.loadouts[id] = { weapons: {}, vents: 0, capacitors: 0 })
        );
      }

      fitCost(def, fit) {
        return (
          def.mounts.reduce(
            (sum, m) =>
              sum +
              (
                catalog.getWeapon(fit.weapons[m.id] || m.defaultWeapon) || {
                  op: 0,
                }
              ).op,
            0,
          ) +
          (fit.vents || 0) +
          (fit.capacitors || 0)
        );
      }

      refit() {
        this.fitId = this.team + "-" + this.slot;
        this.fitType = this.fleets[this.team][this.slot];
        if (this.fitType) this.modal = "refit";
      }

      changeWeapon(mount) {
        const def = catalog.getShip(this.fitType),
          fit = this.fitting(this.fitId),
          list = catalog.WEAPONS.filter(
            (w) => w.size === mount.size && w.type === mount.type,
          ),
          index = list.findIndex(
            (w) => w.id === (fit.weapons[mount.id] || mount.defaultWeapon),
          );
        if (list.length < 2) {
          this.notify("此炮位当前只有这一种兼容武器");
          return;
        }
        const old = fit.weapons[mount.id];
        fit.weapons[mount.id] = list[(index + 1) % list.length].id;
        if (this.fitCost(def, fit) > def.op) {
          fit.weapons[mount.id] = old;
          this.notify("装配点不足");
        } else this.save();
      }

      changeFlux(key, delta) {
        const fit = this.fitting(this.fitId),
          def = catalog.getShip(this.fitType);
        const prev = fit[key] || 0;
        fit[key] = Math.max(0, prev + delta);
        if (this.fitCost(def, fit) > def.op) {
          fit[key] = prev;
          this.notify("装配点不足");
        } else this.save();
      }

      // ── battle lifecycle (unchanged) ─────────────────────────────
      prepare(training = false) {
        try {
          this.training = training;
          this.autoZoom = true;
          this.battle = combat.createBattle(
            this.fleets[0],
            training ? ["xie"] : this.fleets[1],
            this.seed++,
            {
              deferred: true,
              loadouts: training
                ? Object.fromEntries(
                    Object.entries(this.loadouts).filter(([id]) =>
                      id.startsWith("0-"),
                    ),
                  )
                : this.loadouts,
            },
          );
        } catch (e) {
          this.notify(e.message || "配装无效");
          return;
        }
        renderer.reset(this);
        this.drafts = {};
        this.flagshipId = "0-0";
        this.selectedShip = "0-0";
        this.pendingDeploy = null;
        this.mode = "manual";
        this.speed = 1;
        this.lastEvent = 0;
        this.lastAlive = true;
        this.paused = false;
        this.acc = 0;
        this.setScreen("deploy");
        if (training) this.autoPlace();
      }

      placementState(excludeId) {
        const s = Object.assign({}, this.battle);
        s.ships = this.battle.ships.map((a) =>
          this.drafts[a.id] && a.id !== excludeId
            ? Object.assign({}, a, this.drafts[a.id], { status: "active" })
            : a,
        );
        return s;
      }

      placeDraft(id, p) {
        const result = nav.placement(
          this.placementState(id),
          id,
          p.x,
          p.y,
          this.screen === "deploy" ? "initial" : "reinforcement",
        );
        if (!result.ok) {
          this.notify(result.reason);
          return false;
        }
        this.drafts[id] = {
          x: p.x,
          y: p.y,
          angle: this.drafts[id] ? this.drafts[id].angle : -Math.PI / 2,
        };
        this.selectedShip = id;
        this.pendingDeploy = null;
        return true;
      }

      autoPlace() {
        for (const s of this.battle.ships.filter(
          (a) => a.team === 0 && a.status === "reserve" && !this.drafts[a.id],
        )) {
          const p = nav.findPlacement(
            this.placementState(),
            s.id,
            this.screen === "deploy" ? "initial" : "reinforcement",
          );
          if (p) this.drafts[s.id] = p;
        }
        this.notify("已布置，可点舰船调整朝向或留作预备队");
      }

      commitDrafts() {
        for (const id of Object.keys(this.drafts)) {
          const p = this.drafts[id];
          combat.deployShip(this.battle, id, p.x, p.y, p.angle);
        }
        this.drafts = {};
      }

      launch() {
        if (!Object.keys(this.drafts).length) {
          this.notify("先拖一艘舰船进入下方部署区，或点击快速布阵");
          return;
        }
        this.commitDrafts();
        if (!this.training)
          for (const s of this.battle.ships.filter((a) => a.team === 1)) {
            const p = nav.findPlacement(this.battle, s.id, "initial");
            if (p) combat.deployShip(this.battle, s.id, p.x, p.y, p.angle);
          }
        this.flagshipId = (
          this.battle.ships.find(
            (s) => s.id === this.flagshipId && active(s),
          ) || this.battle.ships.find((s) => s.team === 0 && active(s))
        ).id;
        this.aimAngle = this.flagship().angle;
        if (this.training) {
          const target = this.battle.ships.find((s) => s.team === 1);
          const own = this.flagship();
          combat.deployShip(
            this.battle,
            target.id,
            own.x,
            own.y - 650,
            Math.PI / 2,
          );
          target.trainingTarget = true;
          this.notify("靶舰不会还击，可测试武器、护盾、散幅与制动");
        }
        this.battle.status = "running";
        this.setScreen("battle");
        nav.setCameraMode(this.camera, "follow");
        this.camera.x = this.flagship().x;
        this.camera.y = this.flagship().y;
        this.play("system", 0.45);
      }

      openTactical() {
        if (!this.battle) return;
        this.paused = true;
        this.drafts = {};
        this.selectedShip = this.flagshipId;
        this.setScreen("tactical");
      }

      resumeBattle() {
        this.commitDrafts();
        const friend = this.battle.ships.filter(
          (s) => s.team === 0 && active(s),
        );
        if (!friend.length) {
          this.notify("请部署预备舰，或结束演武");
          return;
        }
        if (!this.flagship() || !active(this.flagship()))
          this.flagshipId = friend[0].id;
        if (this.battle.status === "needsDeployment")
          this.battle.status = "running";
        this.paused = false;
        this.setScreen("battle");
        nav.setCameraMode(this.camera, "follow");
        this.aimAngle = this.flagship().angle;
        this.camera.x = this.flagship().x;
        this.camera.y = this.flagship().y;
      }

      takeControl(id) {
        const s = this.battle.ships.find(
          (a) => a.id === id && a.team === 0 && active(a),
        );
        if (!s) return;
        this.flagshipId = id;
        this.selectedShip = id;
        this.aimAngle = s.angle;
        this.mode = "manual";
        this.speed = 1;
        this.clearInput();
        if (this.screen === "battle") this.configureViewport();
        this.notify("已接管 " + catalog.getShip(s.typeId).name);
      }

      toggleMode() {
        this.clearInput();
        this.mode = this.mode === "manual" ? "spectate" : "manual";
        this.speed = 1;
        if (
          this.mode === "manual" &&
          (!this.flagship() || !active(this.flagship()))
        ) {
          const s = this.battle.ships.find((a) => a.team === 0 && active(a));
          if (s) this.flagshipId = s.id;
        }
        this.aimAngle = this.flagship() ? this.flagship().angle : this.aimAngle;
        this.configureViewport();
        nav.setCameraMode(this.camera, "follow");
      }

      toggleAuto(group) {
        const s = this.flagship();
        if (!s) return;
        s.autoGroups[group] = !s.autoGroups[group];
      }

      issueOrder(id, order) {
        if (!combat.setOrder(this.battle, id, order)) {
          this.notify(
            "命令无效，请选择有效的" +
              (order.type === "attack"
                ? "敌舰"
                : order.type === "escort"
                  ? "其他友舰"
                  : "在场友舰或目的地"),
          );
          return false;
        }
        if (this.mode === "manual" && id === this.flagshipId) {
          this.mode = "spectate";
          this.speed = 1;
          this.clearInput();
        }
        this.notify(
          "已下达" +
            { move: "航行", attack: "集火", escort: "护航", retreat: "撤离" }[
              order.type
            ] +
            "命令",
        );
        return true;
      }

      mapClick(x, y) {
        const p = this.toWorld(x, y);
        if (this.pendingDeploy) {
          this.placeDraft(this.pendingDeploy, p);
          return;
        }
        const candidates = this.battle.ships.filter(
          (s) => active(s) || this.drafts[s.id],
        );
        let found = null,
          best = 30;
        candidates.forEach((s) => {
          const pos = this.drafts[s.id] || s,
            sp = this.toScreen(pos.x, pos.y),
            d = Math.hypot(sp.x - x, sp.y - y);
          if (
            d < Math.max(24, s.radius * this.camera.scale) &&
            d < best + s.radius * this.camera.scale
          ) {
            found = s;
            best = d;
          }
        });
        if (this.orderMode && this.selectedShip) {
          const order = { type: this.orderMode, x: p.x, y: p.y };
          if (found) order.targetId = found.id;
          if (this.issueOrder(this.selectedShip, order)) this.orderMode = null;
          return;
        }
        if (found) {
          this.selectedShip = found.id;
          if (this.screen === "battle" && this.mode === "spectate") {
            this.flagshipId = found.id;
            nav.setCameraMode(this.camera, "follow");
          }
        }
      }

      command() {
        const s = this.flagship();
        if (!s) return {};
        let mx = 0,
          my = 0;
        const st = this.sticks.left;
        if (st) {
          mx = st.dx;
          my = st.dy;
        } else {
          mx = (this.keys.d ? 1 : 0) - (this.keys.a ? 1 : 0);
          my = (this.keys.s ? 1 : 0) - (this.keys.w ? 1 : 0);
          const n = Math.max(1, Math.hypot(mx, my));
          mx /= n;
          my /= n;
        }
        if (this.mouse && !this.sticks.right) {
          const p = this.toWorld(this.mouse.x, this.mouse.y);
          if (Math.hypot(p.x - s.x, p.y - s.y) > 5)
            this.aimAngle = Math.atan2(p.y - s.y, p.x - s.x);
        }
        const right = this.sticks.right,
          fire = !!(
            this.mouseDown ||
            (right && Math.hypot(right.dx, right.dy) > 0.25)
          );
        if (fire && s) {
          const converged = this._turretsConverged(s);
          const overloaded = s.hardFlux >= s.softFlux && s.softFlux > 0;
          if (!converged || overloaded || s.venting > 0) {
            this._crosshairFlash = this.clock + 0.15;
          }
        }
        const result = Object.assign(
          {
            moveX: mx,
            moveY: my,
            aimAngle: this.aimAngle,
            fire,
            manualGroup: this.manualGroup,
            brake: this.braking || !!this.keys.c,
            autoGroups: s.autoGroups.slice(),
          },
          this.pending,
        );
        return result;
      }

      // Follow view breathes with the fight: tight on the hull while cruising,
      // easing out just far enough to keep the nearest enemy in frame.
      updateAutoZoom(dt) {
        const cam = this.camera,
          own = this.flagship();
        if (
          this.autoZoom === false ||
          cam.mode !== "follow" ||
          this.paused ||
          !this.battle ||
          !own ||
          !active(own)
        )
          return;
        // A capital ship fills the screen at frigate zoom; pull back by size.
        const cruise = clamp(190 / (own.length || 100), 0.62, 1);
        let want = cruise,
          best = Infinity;
        for (const s of this.battle.ships) {
          if (s.team === own.team || !active(s)) continue;
          const dx = s.x - own.x,
            dy = s.y - own.y,
            d = Math.hypot(dx, dy);
          if (d >= best) continue;
          best = d;
          const span =
              (cam.focusBottom || cam.height) - (cam.focusTop || 0),
            room =
              (Math.abs(dx) / (d || 1)) * cam.width * 0.44 +
              (Math.abs(dy) / (d || 1)) * span * 0.66;
          want =
            d < 1150
              ? Math.min(
                  cruise * 1.15,
                  clamp(room / Math.max(d, 1) / cam.baseScale, 0.6, 1.15),
                )
              : cruise;
        }
        cam.zoom += (want - cam.zoom) * (1 - Math.exp(-1.6 * dt));
        cam.scale = cam.baseScale * cam.zoom;
      }

      // ── frame loop ───────────────────────────────────────────────
      frame(dt) {
        if (!this.width) return;
        dt = Math.max(0, Math.min(dt || 0, 0.1));
        this.clock += dt;
        if (this.ventHold && this.clock - this.ventHold.start >= 0.35) {
          this.pending.vent = true;
          this.ventHold = null;
        }
        if (
          this.screen === "battle" &&
          this.battle &&
          this.battle.status !== "finished" &&
          !this.paused &&
          !this.modal
        ) {
          // Hit-stop slows the simulation clock only; the step size and
          // therefore the battle outcome are untouched.
          const stopped = this.hitStop > 0 && this.speed === 1;
          if (this.hitStop > 0) this.hitStop = Math.max(0, this.hitStop - dt);
          this.acc += dt * this.speed * (stopped ? 0.12 : 1);
          let first = true;
          const cmd = this.mode === "manual" ? this.command() : null;
          while (this.acc >= 1 / 60) {
            const commands = {};
            if (this.training) {
              for (const ship of this.battle.ships.filter(active)) {
                commands[ship.id] = {
                  brake: true,
                  fire: false,
                  aimAngle: ship.angle,
                  autoGroups: [false, false, false],
                };
              }
            }
            if (cmd && this.flagship() && active(this.flagship())) {
              commands[this.flagshipId] = first
                ? cmd
                : Object.assign({}, cmd, {
                    vent: false,
                    system: false,
                    shieldToggle: false,
                  });
            } else if (this.training && this.mode === "spectate") {
              for (const ship of this.battle.ships.filter((s) => s.team === 0))
                delete commands[ship.id];
            }
            combat.stepBattle(this.battle, 1 / 60, commands);
            if (first) this.pending = {};
            first = false;
            this.acc -= 1 / 60;
            if (this.battle.status !== "running") break;
          }
          if (this.battle.status === "needsDeployment" && !this.training) {
            this.acc = 0;
            this.openTactical();
            const reserves = this.battle.ships.filter(
              (s) => s.team === 0 && s.status === "reserve",
            );
            if (
              reserves.length &&
              !reserves.some((s) =>
                nav.findPlacement(this.battle, s.id, "reinforcement"),
              )
            ) {
              for (const s of reserves) {
                s.status = "retreated";
                this.battle.events.push({
                  seq: ++this.battle.eventSeq,
                  type: "retreat",
                  shipId: s.id,
                  team: 0,
                  text: "增援带失守，预备舰撤离",
                });
              }
              this.battle.status = "finished";
              this.battle.winner = this.battle.ships.some(
                (s) => s.team === 1 && (active(s) || s.status === "reserve"),
              )
                ? 1
                : "draw";
              this.paused = false;
              this.setScreen("battle");
            } else this.notify("旗舰失联，请投入预备舰");
          } else if (this.battle.status === "finished") {
            this.acc = 0;
            this.clearInput();
          } else if (
            this.mode === "manual" &&
            this.flagship() &&
            !active(this.flagship())
          ) {
            this.openTactical();
            this.notify("旗舰失联，选择友舰接管");
          }
          for (const e of this.battle.events || [])
            if (e.seq > this.lastEvent) {
              this.lastEvent = Math.max(this.lastEvent, e.seq);
              if (e.type === "shot") {
                const weapon = catalog.getWeapon(e.weaponId || e.weapon);
                if (weapon && weapon.mode === "beam") continue;
                const source = this.battle.ships.find((a) => a.id === e.shipId),
                  location = audio.spatial(
                    this.camera,
                    source ? source.x : e.x,
                    source ? source.y : e.y,
                  );
                this.play(
                  weapon && weapon.mode === "missile"
                    ? "missile"
                    : weapon && weapon.mode === "beam"
                      ? "beam"
                      : weapon && weapon.type === "energy"
                        ? "plasma"
                        : weapon && weapon.size === "large"
                          ? "cannon_heavy"
                          : weapon && weapon.size === "medium"
                            ? "cannon_medium"
                            : "kinetic",
                  0.52 * location.gain,
                  {
                    far: location.far,
                    pan: location.pan,
                    // One recording per family; pitch separates the calibres.
                    pitch:
                      weapon && weapon.type === "energy"
                        ? clamp(1.25 - weapon.damage / 700, 0.6, 1.2)
                        : weapon && weapon.type === "missile"
                          ? clamp(1.2 - weapon.damage / 2500, 0.65, 1.2)
                          : weapon && weapon.pd
                            ? 1.25
                            : 1,
                  },
                );
              }
              if (e.type === "hit") {
                const location = audio.spatial(this.camera, e.x, e.y);
                const weapon = catalog.getWeapon(e.weaponId);
                if (weapon && weapon.mode === "beam") continue;
                const gain = (e.shieldHit ? 0.6 : 0.9) * location.gain;
                const sound =
                  weapon && weapon.mode === "beam"
                    ? e.shieldHit
                      ? "impact_beam_shield"
                      : "impact_beam"
                    : weapon && weapon.type === "energy"
                      ? e.shieldHit
                        ? "impact_shield"
                        : "impact_plasma"
                      : e.shieldHit
                        ? "impact_shield"
                        : weapon && weapon.type === "ballistic"
                          ? weapon.size === "large"
                            ? "impact_heavy"
                            : weapon.size === "medium"
                              ? "impact_solid"
                              : "impact_metal"
                          : e.damage >= 200
                            ? "impact_heavy"
                            : "impact_metal";
                this.play(sound, gain, { far: location.far, pan: location.pan });
              }
              if (e.type === "explosion") {
                const location = audio.spatial(this.camera, e.x, e.y);
                this.play("explosion", 0.95 * location.gain, {
                  far: location.far,
                  pan: location.pan,
                });
              }
              if (e.type === "overload") this.play("shield", 0.4);
              if (e.type === "vent") this.play("vent", 0.3);
              if (e.type === "system") this.play("system", 0.35);
              if (e.type === "finish" && this.battle.winner === 0)
                this.play("victory", 0.5);
            }
          if (cmd && Math.hypot(cmd.moveX, cmd.moveY) > 0.2)
            this.play("thrust", 0.12);
        }
        if (this.camera && this.screen === "battle") this.updateAutoZoom(dt);
        if (this.camera && this.screen === "battle")
          nav.updateCamera(
            this.camera,
            dt,
            this.flagship(),
            this.mode === "manual"
              ? this.aimAngle
              : this.flagship() && this.flagship().angle,
          );
        if (this.p.syncLoops) {
          const loops = audio.beams(this, catalog);
          if (
            !this.sound ||
            this.paused ||
            this.screen !== "battle" ||
            this.modal ||
            this.battle?.status === "finished"
          ) {
            if (this.p.stopLoops) this.p.stopLoops();
          } else this.p.syncLoops(loops, dt);
        }
        if (this.battle) renderer.update(this, dt);
        this.draw();
      }

      // ═════════════════════════════════════════════════════════════
      //  DRAWING PRIMITIVES  –  military HUD design language
      // ═════════════════════════════════════════════════════════════

      text(t, x, y, size = 14, color = C.text, align = "left", weight = 400) {
        const c = this.ctx;
        c.font =
          weight +
          " " +
          size +
          'px "PingFang SC", "Microsoft YaHei", sans-serif';
        c.fillStyle = color;
        c.textAlign = align;
        c.textBaseline = "middle";
        c.fillText(String(t), x, y);
      }

      mono(t, x, y, size = 11, color = C.muted, align = "left") {
        const c = this.ctx;
        c.font = size + "px Menlo, Consolas, monospace";
        c.fillStyle = color;
        c.textAlign = align;
        c.textBaseline = "middle";
        c.fillText(String(t), x, y);
      }

      rect(x, y, w, h, fill, stroke) {
        const c = this.ctx;
        if (fill) {
          c.fillStyle = fill;
          c.fillRect(x, y, w, h);
        }
        if (stroke) {
          c.strokeStyle = stroke;
          c.lineWidth = 1;
          c.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
        }
      }

      // ── chamfered rect (panel) ───────────────────────────────────
      chamferRect(x, y, w, h, fill, stroke, ch = 6) {
        const c = this.ctx;
        ch = Math.min(ch, w / 2, h / 2, 8);
        chamferPath(c, x, y, w, h, ch);
        if (fill) {
          c.fillStyle = fill;
          c.fill();
        }
        if (stroke) {
          c.strokeStyle = stroke;
          c.lineWidth = 1;
          c.stroke();
        }
        // top 1px inner highlight
        if (fill && stroke) {
          c.save();
          chamferPath(c, x + 1, y + 1, w - 2, h - 2, Math.max(0, ch - 1));
          c.strokeStyle = "#ffffff12";
          c.lineWidth = 0.5;
          c.stroke();
          c.restore();
        }
      }

      // ── corner brackets ──────────────────────────────────────────
      bracket(x, y, w, h, col = C.line, arm = 8) {
        const c = this.ctx;
        c.strokeStyle = col;
        c.lineWidth = 2;
        // top-left
        c.beginPath();
        c.moveTo(x, y + arm); c.lineTo(x, y); c.lineTo(x + arm, y);
        c.stroke();
        // top-right
        c.beginPath();
        c.moveTo(x + w - arm, y); c.lineTo(x + w, y); c.lineTo(x + w, y + arm);
        c.stroke();
        // bottom-left
        c.beginPath();
        c.moveTo(x, y + h - arm); c.lineTo(x, y + h); c.lineTo(x + arm, y + h);
        c.stroke();
        // bottom-right
        c.beginPath();
        c.moveTo(x + w - arm, y + h); c.lineTo(x + w, y + h); c.lineTo(x + w, y + h - arm);
        c.stroke();
      }

      line(x, y, x2, y2, col = C.line, width = 1) {
        const c = this.ctx;
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x2, y2);
        c.strokeStyle = col;
        c.lineWidth = width;
        c.stroke();
      }

      circle(x, y, r, col, fill, width = 1) {
        if (r <= 0) return;
        const c = this.ctx;
        c.beginPath();
        c.arc(x, y, r, 0, Math.PI * 2);
        if (fill) {
          c.fillStyle = fill;
          c.fill();
        }
        if (col) {
          c.strokeStyle = col;
          c.lineWidth = width;
          c.stroke();
        }
      }

      // ── gradient cache ───────────────────────────────────────────
      _getGradient(key, w, h) {
        if (this._cachedGradients[key]) return this._cachedGradients[key];
        const c = this.ctx;
        const g = c.createLinearGradient(0, 0, 0, h);
        this._cachedGradients[key] = g;
        return g;
      }

      // ═════════════════════════════════════════════════════════════
      //  BUTTON  –  three-tier system with pressed / disabled
      // ═════════════════════════════════════════════════════════════
      button(t, x, y, w, h, fn, opts = {}) {
        const c = this.ctx;
        const ch = 5;
        const pressed = this._pressedBtn &&
          this._pressedBtn.x >= x - 2 && this._pressedBtn.x <= x + w + 2 &&
          this._pressedBtn.y >= y - 2 && this._pressedBtn.y <= y + h + 2;
        const disabled = opts.disabled;
        const alpha = disabled ? 0.4 : 1;

        c.save();
        c.globalAlpha = alpha;

        let fill, stroke, textColor;
        const offY = pressed ? 1 : 0;

        if (opts.cta) {
          // CTA gold
          fill = pressed ? "#c9a46a" : "#1a1608";
          stroke = C.gold;
          textColor = C.gold;
        } else if (opts.primary) {
          fill = pressed ? "#1a5048" : "#0d2a25";
          stroke = C.mint;
          textColor = C.mint;
        } else if (opts.danger) {
          fill = pressed ? "#3a1616" : "#1a0c0c";
          stroke = C.red;
          textColor = C.red;
        } else if (opts.active) {
          fill = pressed ? "#1b3b40" : "#132f38";
          stroke = C.mint;
          textColor = C.mint;
        } else {
          fill = pressed ? "#163040" : "#0d1e2bdc";
          stroke = C.line;
          textColor = opts.color || C.text;
        }

        const drawX = x + (pressed ? 1 : 0);
        const drawY = y + offY;

        chamferPath(c, drawX, drawY, w, h, ch);
        c.fillStyle = fill;
        c.fill();
        if (stroke) {
          c.strokeStyle = stroke;
          c.lineWidth = 1;
          c.stroke();
        }

        // divider for secondary buttons
        if (!opts.primary && !opts.cta && !opts.danger && opts.divider) {
          c.strokeStyle = C.line + "60";
          c.lineWidth = 1;
          c.beginPath();
          c.moveTo(drawX + w * 0.5, drawY + 4);
          c.lineTo(drawX + w * 0.5, drawY + h - 4);
          c.stroke();
        }

        c.fillStyle = textColor;
        c.font = (opts.weight || (opts.primary || opts.cta ? 600 : 400)) +
          " " + (opts.size || 13) +
          'px "PingFang SC", "Microsoft YaHei", sans-serif';
        c.textAlign = "center";
        c.textBaseline = "middle";
        c.fillText(String(t), drawX + w / 2, drawY + h / 2);

        c.restore();

        const b = { x, y, w, h, fn, label: String(t), ...opts };
        this.buttons.push(b);
        return b;
      }

      hit(x, y, w, h, fn, opts = {}) {
        this.buttons.push({ x, y, w, h, fn, ...opts });
      }

      bar(x, y, w, value, col, h = 4) {
        this.rect(x, y, w, h, "#253543");
        this.rect(x, y, w * clamp(value, 0, 1), h, col);
      }

      shipImage(id, x, y, size, angle = 0, alpha = 1) {
        const c = this.ctx,
          img = this.images[id];
        c.save();
        c.translate(x, y);
        c.rotate(angle + Math.PI / 2);
        c.globalAlpha = alpha;
        if (img) c.drawImage(img, -size / 2, -size / 2, size, size);
        else {
          c.fillStyle = C.dim;
          c.beginPath();
          c.moveTo(0, -size * 0.4);
          c.lineTo(-size * 0.24, size * 0.35);
          c.lineTo(size * 0.24, size * 0.35);
          c.closePath();
          c.fill();
        }
        c.restore();
      }

      // ═════════════════════════════════════════════════════════════
      //  MAIN DRAW
      // ═════════════════════════════════════════════════════════════
      draw() {
        const c = this.ctx;
        c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

        // transition fade
        const transElapsed = this.clock - this.screenChangedAt;
        const transAlpha = transElapsed < 0.12 ? transElapsed / 0.12 : 1;
        if (transAlpha < 1) {
          c.globalAlpha = transAlpha;
        }

        this.rect(0, 0, this.width, this.height, C.bg);
        this.buttons = [];

        if (this.screen === "hangar") this.drawHangar();
        else if (this.drawScreen && this.drawScreen()) {
          // Screens owned by a subclass (menu, star map, port).
        } else if (this.battle) {
          this.drawSpace();
          this.drawBattleWorld();
          if (this.screen === "deploy" || this.screen === "tactical")
            this.drawTactical();
          else this.drawFlight();
        }

        if (this.modal) this.drawModal();

        // toast
        if (this.clock < this.toastUntil && this.toast) {
          const w = Math.min(
            this.width - 48,
            Math.max(180, this.toast.length * 11 + 28),
          );
          const tw = Math.min(w, 340);
          this.chamferRect((this.width - tw) / 2, 66, tw, 26, "#142d34f2", "#4c8b83", 5);
          this.text(this.toast, this.width / 2, 79, 11, C.mint, "center");
        }

        // portrait warning
        if (this.width < this.height) {
          this.rect(0, 0, this.width, this.height, "#050b13ed");
          this.text(
            "请横置设备",
            this.width / 2,
            this.height / 2 - 15,
            25,
            C.mint,
            "center",
          );
          this.text(
            "双摇杆驾驶需要横向空间",
            this.width / 2,
            this.height / 2 + 25,
            14,
            C.muted,
            "center",
          );
        }

        c.globalAlpha = 1;
      }

      headerRight(padding = 12) {
        const edge = this.safe.right - padding;
        return this.menuRect && Number.isFinite(this.menuRect.left)
          ? Math.min(edge, this.menuRect.left - 8)
          : edge;
      }

      headerText(value, x, y, size, color, width, weight = 400) {
        if (width < size * 2) return x;
        this.ctx.font =
          weight +
          " " +
          size +
          'px "PingFang SC", "Microsoft YaHei", sans-serif';
        let label = String(value);
        const letters = Array.from(label);
        while (letters.length && this.ctx.measureText(label).width > width) {
          letters.pop();
          label = letters.join("") + "…";
        }
        if (!letters.length) return x;
        const end = x + this.ctx.measureText(label).width;
        this.text(label, x, y, size, color, "left", weight);
        return end;
      }

      // ═════════════════════════════════════════════════════════════
      //  HANGAR  –  fixed compact layout
      // ═════════════════════════════════════════════════════════════
      drawHangar() {
        const w = this.width,
          h = this.height,
          u = this.u,
          pad = Math.max(16, 24 * u);
        const rw = clamp(w * 0.29, 255, 360);
        const rx = w - pad - rw;
        const lw = rx - pad * 2;

        const headerLeft = Math.max(pad, this.safe.left + 12);
        const headerRight = this.headerRight(16);
        const controlsLeft = headerRight - 160;

        this.drawSpace(true);

        // header
        const titleEnd = this.headerText(
          "星宿演武",
          headerLeft,
          29,
          25 * u + 3,
          C.text,
          controlsLeft - headerLeft - 16,
          600,
        );
        if (controlsLeft - titleEnd > 190)
          this.mono("FLEET COMMAND / 03", titleEnd + 18, 31, 10, C.mint);
        this.button(
          this.sound ? "声音 开" : "声音 关",
          controlsLeft,
          8,
          76,
          44,
          () => {
            this.sound = !this.sound;
            this.save();
          },
          { size: 12 },
        );
        this.button(
          "操作说明",
          headerRight - 76,
          8,
          76,
          44,
          () => (this.modal = "help"),
          { size: 12 },
        );
        this.line(pad, 59, w - pad, 59);

        const s = catalog.getShip(this.selected);
        const heroY = 73;
        const heroH = h - 202;

        // ── left panel: ship detail ──
        this.chamferRect(pad, heroY, lw, heroH, "#0b1823d8", C.line, 6);
        const imageX = pad + lw * 0.72,
          imageY = heroY + heroH * 0.48,
          imageSize = Math.min(lw * 0.53, heroH * 0.84);
        this.circle(imageX, imageY, imageSize * 0.42, "#284550");
        this.circle(imageX, imageY, imageSize * 0.53, "#182f3b");
        this.line(
          imageX - imageSize * 0.6,
          imageY,
          imageX + imageSize * 0.6,
          imageY,
          "#203948",
        );
        this.shipImage(s.id, imageX, imageY, imageSize, -Math.PI / 2);

        const tx = pad + 20;
        const ultra = this.compact && heroH < 138;
        if (!ultra)
          this.mono(
            s.tech === "低科技"
              ? "LOW TECH"
              : s.tech === "中科技"
                ? "MIDLINE"
                : "HIGH TECH",
            tx,
            heroY + 24,
            11,
            C.gold,
          );
        this.text(
          s.name,
          tx,
          heroY + (ultra ? 24 : this.compact ? 58 : 77),
          ultra ? 18 : this.compact ? 27 : 40 * u,
          C.text,
          "left",
          600,
        );
        this.text(
          s.className + " · " + s.role,
          tx,
          heroY + (ultra ? 44 : this.compact ? 88 : 122),
          ultra ? 10 : this.compact ? 12 : 15,
          C.muted,
        );
        if (!this.compact) {
          this.text(s.material || "原创太空舰体", tx, heroY + 158, 14, C.gold);
          this.text(
            "武器槽位与舰体朝向共同决定火力",
            tx,
            heroY + 186,
            12,
            C.dim,
          );
        }

        // stats line
        const sy = heroY + heroH - (ultra ? 38 : this.compact ? 72 : 125);
        if (ultra) {
          this.mono(
            "航速 " +
              s.movement.maxSpeed +
              "  转向 " +
              s.movement.maxTurnRate +
              "°/s  部署 " +
              s.cost +
              "  装配 " +
              s.op +
              " OP",
            tx,
            sy,
            10,
            C.mint,
          );
        } else {
          this.mono(
            "航速 " +
              s.movement.maxSpeed +
              "   转向 " +
              s.movement.maxTurnRate +
              "°/s",
            tx,
            sy,
            12,
            C.mint,
          );
          this.mono(
            "部署 " + s.cost + "    装配 " + s.op + " OP",
            tx,
            sy + 22,
            11,
            C.muted,
          );
        }

        // "装入所选舰位" button
        this.button(
          "装入所选舰位",
          tx,
          heroY + heroH - (ultra ? 30 : 38),
          Math.min(155, lw * 0.38),
          ultra ? 26 : 36,
          () => this.changeFleet(s.id),
          { primary: true, size: ultra ? 10 : 12 },
        );

        // ── ship catalog cards: bottom row, or under the hero panel in compact ──
        const cardsY = this.compact ? heroY + heroH + 8 : h - 114;
        const cardH = this.compact ? clamp(h - cardsY - 6, 64, 96) : 96;
        // Four hulls per page, lightest class first; arrows flip the page.
        const ORDER = ["护卫", "驱逐", "巡洋", "主力"];
        const roster = catalog.SHIPS.slice().sort(
          (a, b) => ORDER.indexOf(a.hullClass) - ORDER.indexOf(b.hullClass),
        );
        const pages = Math.ceil(roster.length / 4);
        if (this.catalogPage === undefined)
          this.catalogPage = Math.floor(
            Math.max(0, roster.findIndex((a) => a.id === s.id)) / 4,
          );
        this.catalogPage = clamp(this.catalogPage, 0, pages - 1);
        const arrowW = pages > 1 ? 30 : 0;
        const cardW = (lw - 21 - 2 * arrowW - (arrowW ? 14 : 0)) / 4;
        if (pages > 1) {
          this.button("‹", pad, cardsY, arrowW, cardH, () => this.catalogPage--, {
            disabled: this.catalogPage === 0,
            size: 18,
          });
          this.button(
            "›",
            pad + lw - arrowW,
            cardsY,
            arrowW,
            cardH,
            () => this.catalogPage++,
            { disabled: this.catalogPage >= pages - 1, size: 18 },
          );
        }
        roster.slice(this.catalogPage * 4, this.catalogPage * 4 + 4).forEach((a, i) => {
          const x = pad + (arrowW ? arrowW + 7 : 0) + i * (cardW + 7);
          this.chamferRect(
            x,
            cardsY,
            cardW,
            cardH,
            a.id === s.id ? "#18333b" : "#0b1a26",
            a.id === s.id ? C.mint : C.line,
            6,
          );
          this.shipImage(
            a.id,
            x + cardW * 0.63,
            cardsY + cardH * 0.4,
            cardH * 0.75,
            -Math.PI / 2,
          );
          this.text(
            a.name,
            x + 10,
            cardsY + cardH * 0.74,
            this.compact ? 12 : 14,
            C.text,
          );
          this.mono(
            a.hullClass + " " + a.cost + " DP",
            x + cardW - 9,
            cardsY + cardH * 0.9,
            9,
            C.muted,
            "right",
          );
          this.hit(x, cardsY, cardW, cardH, () => (this.selected = a.id));
        });

        // ── right column: fleet list ──
        // team tabs
        const tabY = this.compact ? 52 : 73;
        const tabH = this.compact ? 28 : 44;
        this.button(
          "友方编队",
          rx,
          tabY,
          rw / 2 - 3,
          tabH,
          () => {
            this.team = 0;
            this.slot = 0;
            this.selected = this.fleets[0][0];
          },
          { active: this.team === 0, color: C.mint, size: 12 },
        );
        this.button(
          "对手编队",
          rx + rw / 2 + 3,
          tabY,
          rw / 2 - 3,
          tabH,
          () => {
            this.team = 1;
            this.slot = 0;
            this.selected = this.fleets[1][0];
          },
          { active: this.team === 1, color: C.red, size: 12 },
        );

        // fleet rows – compressed in compact
        const tiny = this.compact && h < 340;
        const rowH = tiny ? 28 : this.compact ? 32 : 64;
        const rowGap = this.compact ? 0 : 3;
        const startY = tiny ? 80 : this.compact ? 83 : 130;
        const btnH = tiny ? 38 : 44;

        for (let i = 0; i < 4; i++) {
          const y = startY + i * (rowH + rowGap),
            id = this.fleets[this.team][i],
            a = id && catalog.getShip(id),
            on = this.slot === i;
          this.chamferRect(
            rx,
            y,
            rw,
            rowH,
            on ? "#173039" : "#0a1722",
            on ? C.mint : C.line,
            5,
          );
          if (a) {
            this.shipImage(
              id,
              rx + 28,
              y + rowH / 2,
              rowH * 0.9,
              -Math.PI / 2,
            );
            this.text(
              a.name,
              rx + 56,
              y + (this.compact ? rowH / 2 - 5 : rowH / 2 - 7),
              this.compact ? 12 : 17,
            );
            if (!this.compact) {
              this.text(
                a.role + " · " + a.cost + " DP",
                rx + 56,
                y + rowH / 2 + 12,
                10,
                C.muted,
              );
            }
            // hit area for row select (exclude the × button area)
            this.hit(rx, y, rw - 44, rowH, () => {
              this.slot = i;
              this.selected = id;
            });
            // × button
            this.text("×", rx + rw - 22, y + rowH / 2, 21, C.dim, "center");
            this.hit(rx + rw - 44, y, 44, rowH, () =>
              this.removeSlot(this.team, i),
            );
          } else {
            this.text(
              "＋  添加战舰",
              rx + rw / 2,
              y + rowH / 2,
              13,
              C.muted,
              "center",
            );
            this.hit(rx, y, rw, rowH, () => {
              this.slot = this.fleets[this.team].length;
              this.notify("选择左侧舰船，再点\u201c装入所选舰位\u201d");
            });
          }
        }

        // budget bar (non-compact only)
        const fleetCost = nav.validateFleet(this.fleets[this.team]).cost;
        if (!this.compact) {
          const budgetY = startY + 4 * (rowH + rowGap) + 23;
          this.mono(
            "舰队预算",
            rx + 3,
            budgetY,
            11,
            C.muted,
          );
          this.mono(
            fleetCost + " / " + nav.BUDGET + " DP",
            rx + rw - 3,
            budgetY,
            12,
            C.gold,
            "right",
          );
          this.bar(
            rx,
            budgetY + 21,
            rw,
            fleetCost / 60,
            C.gold,
            3,
          );
          this.text(
            "四种舰型 · 自由配装 · 单舰接管",
            rx,
            budgetY + 44,
            12,
            C.muted,
          );
        }

        // bottom buttons – repositioned to avoid overlap
        const lastRowEnd = startY + 4 * (rowH + rowGap);
        const btnGap = this.compact ? 12 : 8;
        const btnY = lastRowEnd + btnGap;

        this.button(
          "配装",
          rx,
          btnY,
          rw * 0.43 - 4,
          btnH,
          () => this.refit(),
          { size: 13 },
        );
        this.button(
          "试炼场",
          rx + rw * 0.43 + 3,
          btnY,
          rw * 0.57 - 3,
          btnH,
          () => this.prepare(true),
          { size: 13 },
        );

        // CTA button – final fleet deploy
        const ctaY = btnY + btnH + btnGap;
        this.button(
          this.compact ? "部署舰队 " + fleetCost + "/" + nav.BUDGET + " →" : "进入战场  →",
          rx,
          ctaY,
          rw,
          btnH,
          () => this.prepare(false),
          { cta: true, size: tiny ? 14 : 16 },
        );
      }

      drawSpace(staticView = false) {
        renderer.drawSpace(this, staticView);
      }

      drawBattleWorld() {
        const c = this.ctx,
          v = this.viewport;
        c.save();
        c.beginPath();
        c.rect(v.x, v.y, v.w, v.h);
        c.clip();
        if (this.screen === "battle" && this.screenShake)
          c.translate(this.screenShake.x, this.screenShake.y);
        const overview = this.screen === "deploy" || this.screen === "tactical",
          scale = this.camera.scale;
        const a = this.toScreen(0, 0),
          b = this.toScreen(4800, 3000);
        this.rect(a.x, a.y, b.x - a.x, b.y - a.y, null, "#30424c");
        if (overview || this.training) {
          for (let x = 0; x <= 4800; x += 400) {
            const p = this.toScreen(x, 0),
              q = this.toScreen(x, 3000);
            this.line(p.x, p.y, q.x, q.y, "#142630");
          }
          for (let y = 0; y <= 3000; y += 400) {
            const p = this.toScreen(0, y),
              q = this.toScreen(4800, y);
            this.line(p.x, p.y, q.x, q.y, "#142630");
          }
        }
        if (overview) {
          const stage = this.screen === "deploy" ? "initial" : "reinforcement";
          [0, 1].forEach((team) => {
            const zone = nav.deploymentZone(team, stage),
              color = team ? C.red : C.mint,
              p = this.toScreen(zone.minX, zone.minY),
              q = this.toScreen(zone.maxX, zone.maxY);
            this.rect(
              p.x,
              p.y,
              q.x - p.x,
              q.y - p.y,
              color + "0c",
              color + "70",
            );
            this.text(
              team ? "敌方入场区 ↓" : "友方部署区 ↑",
              (p.x + q.x) / 2,
              clamp(p.y + 15, v.y + 12, v.y + v.h - 8),
              10,
              color,
              "center",
            );
          });
        }
        if (this.training) {
          const p = this.toScreen(2300, 1500);
          for (let r = 200; r <= 800; r += 200)
            this.circle(p.x, p.y, r * scale, "#213b44");
          this.text("试飞信标", p.x, p.y + 20, 11, C.muted, "center");
        }
        for (const s of this.battle.ships) {
          if (s.status === "destroyed") {
            this.drawShip(s, 0.4);
            continue;
          }
          if (active(s)) this.drawShip(s, 1);
        }
        for (const id of Object.keys(this.drafts)) {
          const s = this.battle.ships.find((a) => a.id === id);
          this.drawShip(
            Object.assign({}, s, this.drafts[id], {
              status: "active",
              ghost: true,
            }),
            0.8,
          );
        }
        if (this.drag) {
          const s = this.battle.ships.find((a) => a.id === this.drag.shipId),
            p = this.toWorld(this.drag.x, this.drag.y),
            ok = nav.placement(
              this.placementState(s.id),
              s.id,
              p.x,
              p.y,
              this.screen === "deploy" ? "initial" : "reinforcement",
            ).ok;
          this.drawShip(
            Object.assign({}, s, p, { angle: -Math.PI / 2, ghost: true }),
            0.7,
          );
          this.circle(
            this.drag.x,
            this.drag.y,
            s.radius * scale + 7,
            ok ? C.mint : C.red,
          );
        }
        renderer.drawOrdnance(this);

        // ── crosshair with state feedback ──
        const ship = this.flagship();
        if (
          ship &&
          active(ship) &&
          this.screen === "battle" &&
          this.mode === "manual"
        ) {
          const p = this.toScreen(ship.x, ship.y);
          const r = Math.max(34, ship.length * scale * 0.7, this.gaugeRadius(ship) + 12);

          // convergence check
          const converged = this._turretsConverged(ship);
          const q = {
            x: p.x + Math.cos(this.aimAngle) * r,
            y: p.y + Math.sin(this.aimAngle) * r,
          };

          // crosshair state
          if (this._crosshairFlash > this.clock) {
            // red flash 150ms
            this.circle(q.x, q.y, 6, null, C.red + "88", 2);
            this.circle(q.x, q.y, 3, C.red);
          } else if (converged) {
            // mint solid – converged
            this.circle(q.x, q.y, 4, C.mint);
          } else {
            // grey hollow – not converged
            this.circle(q.x, q.y, 5, C.dim, null, 1.5);
          }

          // aim line
          this.line(
            p.x + Math.cos(this.aimAngle) * (r - 15),
            p.y + Math.sin(this.aimAngle) * (r - 15),
            q.x,
            q.y,
            converged ? C.mint : C.gold,
            1.5,
          );

          // velocity vector
          this.line(
            p.x,
            p.y,
            p.x + ship.vx * scale * 0.9,
            p.y + ship.vy * scale * 0.9,
            C.blue + "a0",
          );
        }
        if (ship && active(ship) && this.screen === "battle" && !this.topHudHidden)
          this.drawFlagshipGauge(ship);
        c.restore();

        // flash timer decay
        if (this._crosshairFlash > this.clock) this._crosshairFlash = 0;

        if (this.screen === "battle") this.drawOffscreen();
      }

      // ── turret convergence check ──
      _turretsConverged(ship) {
        if (!ship || !ship.mounts) return false;
        let anyManual = false;
        let allConverged = true;
        for (let gi = 0; gi < 3; gi++) {
          if (ship.autoGroups[gi]) continue; // auto groups don't need manual convergence
          if (gi !== this.manualGroup) continue; // only check the selected manual group
          anyManual = true;
          for (const m of ship.mounts) {
            if (m.group !== gi) continue;
            if (!m.aimAngle) continue;
            const diff = Math.abs(m.aimAngle - this.aimAngle);
            const normalized = diff > Math.PI ? Math.PI * 2 - diff : diff;
            if (normalized > 5 * Math.PI / 180) { // >5° = not converged
              allConverged = false;
            }
          }
        }
        if (!anyManual) return true; // all auto = consider converged
        return allConverged;
      }

      drawShip(s, opacity = 1) {
        renderer.drawShip(this, s, opacity);
      }

      drawOffscreen() {
        const v = this.viewport,
          occupied = [];
        for (const s of this.battle.ships.filter(active)) {
          const p = this.toScreen(s.x, s.y);
          if (
            p.x > v.x + 18 &&
            p.x < v.x + v.w - 18 &&
            p.y > v.y + 44 &&
            p.y < v.y + v.h - 70
          )
            continue;
          const col = s.team ? C.red : C.mint,
            x = clamp(p.x, v.x + 20, v.x + v.w - 20),
            minY = v.y + 98,
            maxY = Math.max(minY, v.y + v.h - 96);
          let y = clamp(p.y, minY, maxY);
          const slots = [];
          for (let row = minY; row <= maxY; row += 18) slots.push(row);
          slots.sort((a, b) => Math.abs(a - y) - Math.abs(b - y));
          const open = slots.find((row) =>
            occupied.every(
              (o) => Math.abs(o.x - x) > 110 || Math.abs(o.y - row) >= 17,
            ),
          );
          if (open !== undefined) y = open;
          occupied.push({ x, y });
          const angle = Math.atan2(p.y - y, p.x - x);
          this.line(
            x - Math.cos(angle) * 7,
            y - Math.sin(angle) * 7,
            x + Math.cos(angle) * 4,
            y + Math.sin(angle) * 4,
            col,
            2,
          );
          if (s.team) {
            const own = this.flagship(),
              distance = own
                ? Math.round(Math.hypot(s.x - own.x, s.y - own.y))
                : 0;
            this.text(
              catalog.getShip(s.typeId).name + " " + distance,
              x + (x < this.width / 2 ? 9 : -9),
              y - 4,
              9,
              col,
              x < this.width / 2 ? "left" : "right",
            );
          }
        }
      }

      // ── joystick zones (ghost defaults; floating spawns on touch) ──
      stickZones() {
        const s = this.safe,
          r = this.compact ? 51 : 65;
        return {
          left: { x: s.left + r + 28, y: s.bottom - r - 22, r },
          right: { x: s.right - r - 28, y: s.bottom - r - 22, r },
        };
      }

      drawJoystick(key, label) {
        const defaults = this.stickZones()[key];
        const st = this.sticks[key];
        const ghost = this._joystickGhosts[key];

        if (ghost) {
          ghost.op -= 0.04;
          if (ghost.op <= 0) { this._joystickGhosts[key] = null; }
        }

        const cx = st ? st.x : (ghost ? ghost.x : defaults.x);
        const cy = st ? st.y : (ghost ? ghost.y : defaults.y);
        const r = defaults.r;
        const active = !!st;
        const alpha = ghost ? ghost.op : 1;

        this.ctx.save();
        this.ctx.globalAlpha = alpha;
        this.circle(cx, cy, r, active ? "#6c999055" : "#6c999022", active ? "#0a1b2399" : "#0a1b2333");
        if (active || alpha > 0.2) {
          this.circle(cx, cy, r * 0.68, active ? "#5d8d8844" : "#5d8d8818");
          this.line(cx - r * 0.8, cy, cx + r * 0.8, cy, active ? "#547b7844" : "#547b7818");
          this.line(cx, cy - r * 0.8, cx, cy + r * 0.8, active ? "#547b7844" : "#547b7818");
        }
        const knobX = cx + (st ? st.dx : 0) * r * 0.68;
        const knobY = cy + (st ? st.dy : 0) * r * 0.68;
        this.circle(
          knobX,
          knobY,
          r * 0.34,
          active ? C.mint : "#668882",
          active ? "#2a514eee" : "#192e3bba",
        );
        if (!st && !ghost && (this.keys.w || this.mouse)) {
          this.text(label, cx, cy + r + 13, 10, C.muted, "center");
        }
        this.ctx.restore();
      }

      // ═════════════════════════════════════════════════════════════
      //  FLIGHT (battle manual mode)
      // ═════════════════════════════════════════════════════════════
      drawFlight() {
        const w = this.width,
          h = this.height,
          safe = this.safe,
          ship = this.flagship(),
          battle = this.battle;

        // ── slim top row: clock and three compact buttons, no backing strip ──
        const topH = 34;
        const top = safe.top + 6;
        const btnW = this.compact ? 54 : 70;
        const gap = 6;
        const start = this.headerRight(12) - 3 * btnW - 2 * gap;

        if (!this.topHudHidden) {
          this.mono(fmt(battle.time), safe.left + 14, safe.top + 21, 13, C.mint);
          if (this.training)
            this.text("武备试炼场", safe.left + 62, safe.top + 20, 11, C.muted);

          this.button(
            this.mode === "manual" ? "手操" : "AI观战",
            start,
            top,
            btnW,
            topH,
            () => this.toggleMode(),
            { active: this.mode === "manual", size: 11 },
          );
          this.button(
            "战术图",
            start + btnW + gap,
            top,
            btnW,
            topH,
            () => this.openTactical(),
            { size: 11 },
          );
          this.button(
            "整备",
            start + 2 * (btnW + gap),
            top,
            btnW,
            topH,
            () => {
              this.paused = true;
              this.setScreen("hangar");
            },
            { size: 11 },
          );

          this.drawMinimap();
          const zx = safe.right - (this.compact ? 96 : 132) - 12 - 38;
          this.button(
            "＋",
            zx,
            safe.top + 48,
            32,
            28,
            () => {
              this.autoZoom = false;
              nav.zoomCamera(this.camera, 1.25);
            },
            { size: 15 },
          );
          this.button(
            "−",
            zx,
            safe.top + 80,
            32,
            28,
            () => {
              this.autoZoom = false;
              nav.zoomCamera(this.camera, 0.8);
            },
            { size: 17 },
          );
        }

        // HUD auto-fade: hide after 8s inactivity, restore on edge proximity
        const hudIdle = this.clock - this._hudFade;
        const hudFadeAlpha = this.mode === "manual" && hudIdle > 8
          ? Math.min(1, (hudIdle - 8) / 2) : 0;
        const topAlpha = this.topHudHidden ? 0.15 : (hudFadeAlpha > 0 ? Math.max(0.15, 1 - hudFadeAlpha) : 1);
        const botAlpha = this.bottomHudHidden ? 0.15 : (hudFadeAlpha > 0 ? Math.max(0.15, 1 - hudFadeAlpha) : 1);

        if (this.camera.mode === "free")
          this.button(
            "回到旗舰",
            safe.left + 12,
            safe.top + (this.topHudHidden ? 50 : 100),
            88,
            34,
            () => this.returnToFlagship(),
            { size: 11, role: "recenter" },
          );
        if (ship && active(ship)) {
          const def = catalog.getShip(ship.typeId);


          if (this.mode === "manual") {
            this.drawJoystick("left", "推进");
            this.drawJoystick("right", "瞄准");

            // Controls sit in one bottom row between the two thumbs so that
            // nothing covers the engagement or the floating stick areas.
            const zones = this.stickZones();
            const pad = this.compact ? 50 : 58;
            const rowY = safe.bottom - pad - 12;
            const padGap = 8;
            const hasSystem = ship.typeId === "xie";
            const rightEdge = zones.right.x - zones.right.r - 14;
            const shieldX = rightEdge - pad;
            const ventX = shieldX - padGap - pad;

            this.button(
              ship.shieldOn ? "护盾 开" : "护盾 关",
              shieldX,
              rowY,
              pad,
              pad,
              () => (this.pending.shieldToggle = true),
              { active: ship.shieldOn, size: 11 },
            );
            this.button(
              ship.venting > 0 ? "散幅中" : "长按散幅",
              ventX,
              rowY,
              pad,
              pad,
              () => {},
              {
                role: "vent",
                color: ship.venting > 0 ? C.blue : C.text,
                size: 10,
              },
            );
            if (hasSystem) {
              this.button(
                ship.systemCooldown > 0
                  ? Math.ceil(ship.systemCooldown) + "s"
                  : "玄甲阵",
                shieldX,
                rowY - padGap - pad,
                pad,
                pad,
                () => (this.pending.system = true),
                { active: ship.systemTime > 0, color: C.gold, size: 11 },
              );
            }

            const brakeX = zones.left.x + zones.left.r + 14;
            this.button("制动", brakeX, rowY, pad, pad, () => {}, {
              role: "brake",
              active: this.braking,
              size: 11,
            });

            // weapon group chips – bottom centre, between brake and vent
            const free = ventX - padGap - (brakeX + pad + padGap);
            const gw = clamp(free, 150, 264);
            const gx = brakeX + pad + padGap + (free - gw) / 2;
            const gh = 36;
            const gy = safe.bottom - gh - 12;
            for (let i = 0; i < 3; i++) {
              const x = gx + i * (gw / 3);
              const cw = gw / 3 - 4;
              const on = this.manualGroup === i;
              this.chamferRect(
                x,
                gy,
                cw,
                gh,
                on ? "#193942cc" : "#0a1b2799",
                on ? C.mint : C.line,
                4,
              );
              this.text(
                ["主炮", "副炮", "防御"][i],
                x + cw / 2,
                gy + 13,
                11,
                on ? C.text : C.muted,
                "center",
                on ? 600 : 400,
              );
              this.text(
                ship.autoGroups[i] ? "自动" : "手动",
                x + cw / 2,
                gy + 27,
                9,
                ship.autoGroups[i] ? C.mint : C.gold,
                "center",
              );
              this.hit(x, gy, cw * 0.5, gh, () => (this.manualGroup = i));
              this.hit(x + cw * 0.5, gy, cw * 0.5, gh, () =>
                this.toggleAuto(i),
              );
            }

            if (this.training && !this.topHudHidden)
              this.text(
                "舰艏线 / 金色期望朝向 / 蓝色速度矢量",
                safe.left + 14,
                safe.top + 96,
                10,
                C.muted,
              );
          } else {
            // spectate mode
            this.button(
              this.speed + "× 速度",
              safe.left + 14,
              safe.bottom - 52,
              78,
              40,
              () => (this.speed = this.speed === 1 ? 2 : 1),
              { size: 12 },
            );
            this.button(
              "跟随旗舰",
              safe.left + 98,
              safe.bottom - 52,
              84,
              40,
              () => this.returnToFlagship(),
              { size: 12 },
            );
          }
        }

        // last event text
        const last = (battle.events || [])
          .filter((e) => ["overload", "explosion", "system"].includes(e.type))
          .slice(-1)[0];
        if (last && !this.topHudHidden)
          this.text(
            last.text,
            (safe.left + safe.right) / 2,
            safe.top + 58,
            11,
            last.type === "explosion" ? C.red : C.gold,
            "center",
          );

        if (battle.status === "finished") this.drawResults();
      }

      // Flagship gauges live on the hull itself, so the pilot never looks away
      // from the fight: structure on the left arc, flux on the right arc, and
      // the six armour sectors as a thin ring that turns with the ship.
      drawFlagshipGauge(ship) {
        const c = this.ctx,
          p = this.toScreen(ship.x, ship.y),
          R = this.gaugeRadius(ship),
          span = Math.PI * 0.62,
          hp = clamp(ship.hp / ship.maxHp, 0, 1),
          hard = clamp(ship.hardFlux / ship.maxFlux, 0, 1),
          flux = clamp((ship.hardFlux + ship.softFlux) / ship.maxFlux, 0, 1),
          arc = (from, to, color, width, anti) => {
            c.beginPath();
            c.arc(p.x, p.y, R, from, to, !!anti);
            c.strokeStyle = color;
            c.lineWidth = width;
            c.stroke();
          };
        c.save();
        c.lineCap = "butt";
        // structure: fills upward along the left side
        const left = Math.PI - span / 2 + span;
        arc(left - span, left, "#0b161dcc", 6);
        arc(left - span, left, "#2a3b47", 4);
        if (hp > 0)
          arc(left, left - span * hp, hp > 0.35 ? C.mint : C.red, 4, true);
        // flux: fills upward along the right side, hard flux drawn over soft
        const right = span / 2;
        arc(right - span, right, "#0b161dcc", 6);
        arc(right - span, right, "#2a3b47", 4);
        if (flux > 0) arc(right, right - span * flux, "#9a815c", 4, true);
        if (hard > 0) arc(right, right - span * hard, C.gold, 4, true);
        if (flux > 0.8 && Math.sin(this.clock * 9) > 0)
          arc(right - span, right, C.red + "aa", 4);
        // armour: sector 0 faces the bow; only worn plates draw attention
        for (let i = 0; i < 6; i++) {
          const val = ship.armor[i] / ship.maxArmor[i],
            mid = ship.angle + (i * Math.PI) / 3;
          c.beginPath();
          c.arc(p.x, p.y, R - 8, mid - 0.44, mid + 0.44);
          c.strokeStyle =
            val > 0.65 ? "#8aaa9c55" : val > 0.1 ? "#d6a35c" : "#d2564c";
          c.lineWidth = val > 0.65 ? 1.5 : 2.5;
          c.stroke();
        }
        c.restore();
        // Colour and position carry the meaning; words appear only as a warning.
        if (flux > 0.8)
          this.text("幅能告急", p.x, p.y - R - 9, 10, C.red, "center", 600);
      }
      gaugeRadius(ship) {
        return Math.max(38, ship.radius * this.camera.scale + 18);
      }

      drawMinimap() {
        const sw = this.compact ? 96 : 132,
          sh = (sw * 3000) / 4800,
          x = this.safe.right - sw - 12,
          y = this.safe.top + 48;
        this.minimapH = sh;
        this.rect(x, y, sw, sh, "#091a249e", "#314a53");
        for (const s of this.battle.ships.filter(active)) {
          this.circle(
            x + (s.x / 4800) * sw,
            y + (s.y / 3000) * sh,
            s.id === this.flagshipId ? 3 : 2,
            null,
            s.team ? C.red : C.mint,
          );
        }
        const v = this.viewport,
          left = this.toWorld(v.x, v.y),
          right = this.toWorld(v.x + v.w, v.y + v.h);
        this.rect(
          x + (clamp(left.x, 0, 4800) / 4800) * sw,
          y + (clamp(left.y, 0, 3000) / 3000) * sh,
          Math.min(4800, right.x) - Math.max(0, left.x) > 0
            ? ((Math.min(4800, right.x) - Math.max(0, left.x)) / 4800) * sw
            : 0,
          Math.min(3000, right.y) - Math.max(0, left.y) > 0
            ? ((Math.min(3000, right.y) - Math.max(0, left.y)) / 3000) * sh
            : 0,
          null,
          "#95b7b06a",
        );
        this.hit(x, y, sw, sh, () => {}, { role: "minimap" });
      }

      // ═════════════════════════════════════════════════════════════
      //  TACTICAL / DEPLOY
      // ═════════════════════════════════════════════════════════════
      drawTactical() {
        const initial = this.screen === "deploy",
          w = this.width,
          h = this.height,
          ship = this.chosenShip();

        const headerLeft = this.safe.left + 12,
          headerRight = this.headerRight(),
          controlsLeft = headerRight - (initial ? 196 : 114),
          titleLeft = headerLeft + 96;

        this.rect(0, 0, w, 63, "#0b1821f2", C.line);
        this.button(
          "← 整备",
          headerLeft,
          9,
          78,
          44,
          () => this.setScreen("hangar"),
          { size: 12 },
        );

        const titleEnd = this.headerText(
            initial ? "部署舰队" : "战术暂停",
            titleLeft,
            29,
            20,
            C.text,
            controlsLeft - titleLeft - 16,
            500,
          ),
          descriptionLeft = titleEnd + 18;
        if (controlsLeft - descriptionLeft >= 100)
          this.headerText(
            this.training
              ? "实弹靶舰 · 测试武备与推进"
              : initial
                ? "下方入场，舰艏朝上；点舰调整朝向"
                : "点选友舰，下令、接管或投入预备队",
            descriptionLeft,
            30,
            11,
            C.muted,
            controlsLeft - descriptionLeft - 14,
          );

        if (initial) {
          this.button(
            "快速布阵",
            controlsLeft,
            9,
            94,
            44,
            () => this.autoPlace(),
            { size: 12 },
          );
          this.button(
            "出击  →",
            headerRight - 94,
            9,
            94,
            44,
            () => this.launch(),
            { cta: true, size: 14 },
          );
        } else {
          this.button(
            "继续驾驶",
            controlsLeft,
            9,
            114,
            44,
            () => this.resumeBattle(),
            { cta: true, size: 14 },
          );
        }

        this.rect(0, h - 65, w, 65, "#0a1924f2", C.line);
        const reserves = this.battle.ships.filter(
            (s) => s.team === 0 && s.status === "reserve",
          ),
          cardW = Math.min(
            170,
            (w - (initial ? 0 : 250) - 28) / Math.max(1, reserves.length),
          );
        if (!reserves.length)
          this.text(
            "所有舰船已投入 · 点选战场上的友舰下达命令",
            18,
            h - 33,
            12,
            C.muted,
          );
        reserves.forEach((s, i) => {
          const x = 14 + i * (cardW + 5),
            d = catalog.getShip(s.typeId),
            on = this.pendingDeploy === s.id || this.selectedShip === s.id;
          this.chamferRect(
            x,
            h - 55,
            cardW - 5,
            50,
            on ? "#1b363e" : "#0c202c",
            on ? C.mint : C.line,
            5,
          );
          this.shipImage(s.typeId, x + 28, h - 32, 40, -Math.PI / 2);
          this.text(d.name, x + 55, h - 41, 12);
          this.text(
            this.drafts[s.id] ? "已布阵 · 拖动调整" : "拖入战场",
            x + 55,
            h - 25,
            9,
            this.drafts[s.id] ? C.mint : C.muted,
          );
          this.hit(x, h - 55, cardW - 5, 50, () => {}, {
            role: "reserve",
            shipId: s.id,
          });
        });

        if (ship && this.drafts[ship.id]) {
          const px = this.safe.left + 16,
            py = this.viewport.y + this.viewport.h - 66;
          this.chamferRect(px - 5, py - 6, 159, 102, "#0b1d28ee", C.line, 6);
          this.button(
            "↶ 15°",
            px,
            py,
            71,
            42,
            () => (this.drafts[ship.id].angle -= Math.PI / 12),
            { size: 12 },
          );
          this.button(
            "↷ 15°",
            px + 77,
            py,
            71,
            42,
            () => (this.drafts[ship.id].angle += Math.PI / 12),
            { size: 12 },
          );
          this.button(
            "设为旗舰",
            px,
            py + 48,
            71,
            42,
            () => {
              this.flagshipId = ship.id;
              this.notify("旗舰：" + catalog.getShip(ship.typeId).name);
            },
            { size: 11 },
          );
          this.button(
            "留备",
            px + 77,
            py + 48,
            71,
            42,
            () => {
              delete this.drafts[ship.id];
              this.pendingDeploy = null;
            },
            { size: 12 },
          );
        }

        if (!initial) this.drawCommandPanel();
        if (this.orderMode)
          this.text(
            "点选" +
              (this.orderMode === "move"
                ? "目的地"
                : this.orderMode === "attack"
                  ? "敌舰"
                  : "友舰") +
              "，下达命令",
            15,
            84,
            13,
            C.gold,
          );
      }

      drawCommandPanel() {
        const v = this.viewport,
          x = v.x + v.w + 8,
          w = this.width - x - 12,
          h = this.height,
          s = this.chosenShip();

        this.chamferRect(x - 5, 64, w + 17, h - 65, "#0b1a26ed", C.line, 6);
        if (!s) {
          this.text("选择战舰", x + 13, 95, 17, C.muted);
          return;
        }

        const def = catalog.getShip(s.typeId);
        this.text(
          def.name,
          x + 13,
          this.compact ? 82 : 88,
          this.compact ? 17 : 20,
          C.text,
          "left",
          500,
        );
        this.text(
          s.team
            ? "敌方目标"
            : s.id === this.flagshipId
              ? "当前旗舰"
              : "友方战舰",
          x + 13,
          this.compact ? 103 : 115,
          11,
          s.team ? C.red : C.mint,
        );
        this.mono(
          "结构 " + Math.ceil(s.hp) + " / " + s.maxHp,
          x + 13,
          this.compact ? 122 : 141,
          11,
          C.muted,
        );
        this.mono(
          "幅能 " +
            Math.round(((s.softFlux + s.hardFlux) / s.maxFlux) * 100) +
            "%",
          x + 13,
          this.compact ? 139 : 160,
          11,
          C.gold,
        );

        if (s.team === 0 && active(s)) {
          const bw = (w - 28) / 2,
            by = this.compact ? 151 : 181,
            gap = this.compact ? 47 : 49;
          this.button(
            "接管",
            x + 10,
            by,
            bw,
            44,
            () => this.takeControl(s.id),
            { active: s.id === this.flagshipId, size: 12 },
          );
          this.button(
            "前往",
            x + 18 + bw,
            by,
            bw,
            44,
            () => (this.orderMode = "move"),
            { size: 12 },
          );
          this.button(
            "集火",
            x + 10,
            by + gap,
            bw,
            44,
            () => (this.orderMode = "attack"),
            { size: 12 },
          );
          this.button(
            "护航",
            x + 18 + bw,
            by + gap,
            bw,
            44,
            () => (this.orderMode = "escort"),
            { size: 12 },
          );
          this.button(
            "撤离",
            x + 10,
            by + gap * 2,
            w - 20,
            44,
            () => this.issueOrder(s.id, { type: "retreat" }),
            { danger: true, size: 12 },
          );
        }

        if (!this.compact) {
          this.text("前往：点目的地", x + 13, 350, 11, C.muted);
          this.text("集火 / 护航：点选目标", x + 13, 373, 11, C.muted);
          this.text("预备舰从友方边缘进入", x + 13, 408, 11, C.muted);
        }

        this.button(
          "结束演武",
          x + 10,
          h - 54,
          w - 20,
          44,
          () => {
            this.battle.status = "finished";
            this.battle.winner = 1;
            this.setScreen("battle");
          },
          { danger: true, size: 12 },
        );
      }

      // ═════════════════════════════════════════════════════════════
      //  RESULTS
      // ═════════════════════════════════════════════════════════════
      drawResults() {
        this.rect(0, 0, this.width, this.height, "#030b12bd");
        this.buttons = [];
        const w = Math.min(510, this.width - 30),
          h = Math.min(320, this.height - 24),
          x = (this.width - w) / 2,
          y = (this.height - h) / 2,
          b = this.battle;

        this.chamferRect(x, y, w, h, "#0b1c29f7", "#52847e", 8);
        this.bracket(x, y, w, h, C.mint, 12);

        this.mono(
          "ENGAGEMENT COMPLETE",
          this.width / 2,
          y + 28,
          11,
          C.mint,
          "center",
        );
        this.text(
          b.winner === 0
            ? "友方胜出"
            : b.winner === 1
              ? "舰队失守"
              : "双方平局",
          this.width / 2,
          y + 76,
          32,
          b.winner === 1 ? C.red : C.mint,
          "center",
          600,
        );
        this.text(
          "交战 " +
            fmt(b.time) +
            " · 存活 " +
            b.ships.filter((s) => s.team === 0 && active(s)).length +
            " 艘",
          this.width / 2,
          y + 120,
          14,
          C.muted,
          "center",
        );
        const names = b.ships
          .filter((s) => s.team === 0)
          .map(
            (s) =>
              catalog.getShip(s.typeId).name +
              " " +
              Math.round(s.damageDealt || 0),
          );
        this.text("结构伤害", this.width / 2, y + 157, 11, C.dim, "center");
        this.text(
          names.join("   /   "),
          this.width / 2,
          y + 183,
          12,
          C.text,
          "center",
        );

        this.button(
          "返回整备",
          x + 22,
          y + h - 72,
          (w - 54) / 2,
          48,
          () => this.setScreen("hangar"),
          { size: 15 },
        );
        this.button(
          "重新部署",
          x + 32 + (w - 54) / 2,
          y + h - 72,
          (w - 54) / 2,
          48,
          () => this.prepare(this.training),
          { cta: true, size: 15 },
        );
      }

      // ═════════════════════════════════════════════════════════════
      //  MODAL (help / refit)
      // ═════════════════════════════════════════════════════════════
      drawModal() {
        this.rect(0, 0, this.width, this.height, "#020910dd");
        this.buttons = [];
        const mw = Math.min(850, this.width - 28),
          mh = Math.min(this.modal === "help" ? 520 : 540, this.height - 24),
          x = (this.width - mw) / 2,
          y = (this.height - mh) / 2;

        this.chamferRect(x, y, mw, mh, "#0c1e2b", C.line, 8);
        this.bracket(x, y, mw, mh, C.line, 10);

        this.button(
          "×",
          x + mw - 52,
          y + 8,
          44,
          40,
          () => {
            this.modal = null;
            this.clearInput();
          },
          { size: 23 },
        );

        if (this.modal === "help") {
          this.text("驾驶手册", x + 23, y + 30, 23, C.text, "left", 500);
          this.text(
            "移动方向、舰艏朝向与炮塔瞄准分别计算",
            x + 23,
            y + 63,
            13,
            C.mint,
          );
          const touch =
            this.inputKind === "touch" ||
            (this.inputKind === "" && this.compact);
          const entries = [
            ["推进", touch ? "左摇杆，松手缓慢减速" : "左摇杆 / WASD，松手缓慢减速"],
            ["转向", touch ? "右摇杆；舰体先加速旋转再制动" : "右摇杆 / 鼠标；舰体先加速旋转再制动"],
            ["开火", touch ? "右杆拖出死区，发射选中手动组" : "右杆拖出死区 / 鼠标左键，发射选中手动组"],
            ["自动", touch ? "点武器组旁开关，仅接管这一组武器" : "点武器组旁开关 / R，仅接管这一组武器"],
            ["防御", touch ? "护盾开关；长按散幅，散幅时不能开火" : "护盾开关；长按散幅 / V，散幅时不能开火"],
            ["操舰", touch ? "制动；玄甲阵（仅玄甲）；其他战舰自主作战" : "制动 / C；玄甲阵 / F；其他战舰自主作战"],
            ["指挥", touch ? "战术图：拖入预备舰、换旗舰、下令" : "战术图 / 空格：拖入预备舰、换旗舰、下令"],
            ["观察", "AI观战时可拖镜头、缩放、切换倍速"],
          ];
          const two = this.compact || mw > 650,
            colW = (mw - 56) / (two ? 2 : 1),
            rowH = this.compact ? 48 : 77;
          entries.forEach((a, i) => {
            const col = two ? i % 2 : 0,
              row = two ? Math.floor(i / 2) : i,
              xx = x + 23 + col * colW,
              yy = y + 100 + row * rowH;
            this.text(a[0], xx, yy, 14, C.gold);
            this.text(a[1], xx, yy + 22, this.compact ? 10 : 12, C.muted);
          });
          this.text(
            "护卫 60°/s · 驱逐 30–40°/s · 重巡 12°/s",
            x + 23,
            y + mh - 25,
            12,
            C.mint,
          );
          return;
        }

        // refit modal
        const def = catalog.getShip(this.fitType),
          fit = this.fitting(this.fitId),
          cost = this.fitCost(def, fit);

        this.text(
          def.name + " · 武器整备",
          x + 23,
          y + 29,
          23,
          C.text,
          "left",
          500,
        );
        this.mono("OP " + cost + " / " + def.op, x + 23, y + 63, 13, C.gold);
        this.text("点击炮位切换兼容武器", x + 180, y + 63, 12, C.muted);

        const cols = 2,
          cw = (mw - 58) / cols,
          rh = this.compact ? 60 : 85;
        def.mounts.forEach((m, i) => {
          const xx = x + 23 + (i % 2) * (cw + 12),
            yy = y + 88 + Math.floor(i / 2) * rh,
            weapon = catalog.getWeapon(fit.weapons[m.id] || m.defaultWeapon);
          this.chamferRect(xx, yy, cw, rh - 8, "#112936", C.line, 5);
          this.text(
            SIZE[m.size] + TYPE[m.type] + " · " + weapon.name,
            xx + 12,
            yy + 18,
            this.compact ? 12 : 15,
          );
          this.mono(
            weapon.range + " 射程 / " + weapon.op + " OP",
            xx + 12,
            yy + 38,
            10,
            C.muted,
          );
          this.text("›", xx + cw - 18, yy + (rh - 8) / 2, 22, C.mint, "center");
          this.hit(xx, yy, cw, rh - 8, () => this.changeWeapon(m));
        });

        const fy = y + mh - 112;
        [
          ["vents", "散逸", def.fluxDissipation + (fit.vents || 0) * 10],
          [
            "capacitors",
            "容量",
            def.fluxCapacity + (fit.capacitors || 0) * 200,
          ],
        ].forEach(([key, label, val], i) => {
          const xx = x + 23 + i * (cw + 12);
          this.text(label + " " + val, xx, fy + 21, 13, C.mint);
          this.button(
            "−",
            xx + cw - 95,
            fy,
            44,
            42,
            () => this.changeFlux(key, -1),
            { size: 20 },
          );
          this.button(
            "＋",
            xx + cw - 45,
            fy,
            44,
            42,
            () => this.changeFlux(key, 1),
            { size: 18 },
          );
        });

        this.text(
          "每点 1 OP：散逸 +10 / 容量 +200；所有更改自动保存",
          x + 23,
          y + mh - 50,
          this.compact ? 10 : 12,
          C.muted,
        );
        this.button(
          "完成整备",
          x + mw - 151,
          y + mh - 51,
          128,
          39,
          () => (this.modal = null),
          { primary: true, size: 13 },
        );
      }
    }

    return { GameUI };
  },
);

(function (root, factory) {
  if (typeof module === "object" && module.exports)
    module.exports = factory(require("./game-ui"), require("./ships"), require("./combat"), require("./refit-weapon-art"));
  else root.StarRefit = factory(root.StarArena, root.StarShips, root.StarCombat, root.StarRefitWeaponArt);
})(typeof globalThis !== "undefined" ? globalThis : this, function (base, catalog, combat, art) {
  "use strict";
  // This screen deliberately owns no combat, renderer, audio or fleet logic.
  // Both platform adapters use this subclass; the base UI remains independent.
  const P = { bg: "#0b1014", panel: "#11191e", line: "#2a353b", text: "#e0e4df", muted: "#98a4a7", dim: "#586970", accent: "#d7b679", good: "#99bea9", bad: "#d79887" };
  const SIZE = { small: "小型", medium: "中型", large: "大型" };
  const TYPE = { ballistic: "实弹", energy: "能量", missile: "导弹" };
  const DAMAGE = { kinetic: "动能", he: "破甲", energy: "能量", frag: "破片" };
  const PURPOSE = {
    chuanyun: "连续实弹压制护盾，为主炮创造破甲窗口。",
    suixing: "近程防空，可拦截导弹；对裸露结构有效。",
    bengshan: "低射速重炮。用单发冲击击穿装甲。",
    zhenhai: "舰艏重炮。窄射界要求舰体提前转向。",
    lihuo: "高输出能量弹。持续开火会显著增加幅能。",
    fuling: "长射程连续光束，适合维持对护盾的压力。",
    zhaoyao: "近程点防御光束，优先处理来袭导弹。",
    zhuihun: "有限弹药的制导武器，适合在护盾破绽时发射。",
    poyue: "短射程小型破甲炮。贴近后撕开装甲，对护盾乏力。",
    liexing: "高射速动能机炮，持续压垮护盾并逼出硬幅能。",
    tiansan: "中型防空霰阵，拦截导弹的覆盖面远大于小型点防。",
    guanri: "超远程动能弩炮，弹速极快，专门击穿护盾。",
    bailei: "三联速射重炮，持续破甲输出高，幅能压力也大。",
    leiting: "蓄能重脉冲。单发极痛，但一轮齐射就占掉大半幅能。",
    yingguang: "轻型能量弹，对盾对甲都不吃亏的通用小炮。",
    dingshen: "低耗远程牵制光束，逼对手举盾积攒幅能。",
    pojun: "仅三发的无制导重雷。命中装甲即重创，易被点防拦截。",
    liuxing: "高速小火矢齐射，弹药充足，用数量耗穿点防。",
  };
  const EFFECT = { kinetic: "护盾 ×2   装甲 ×0.5", he: "护盾 ×0.5   装甲 ×2", energy: "护盾 ×1   装甲 ×1", frag: "护盾 ×0.25   装甲 ×0.25" };
  // Colour carries meaning on this screen: mount type, damage type, and the
  // three figures a player compares (damage, flux, range) each keep one hue.
  const TYPE_COLOR = { ballistic: "#d9a868", energy: "#a8a2ff", missile: "#ff8d76" };
  const DAMAGE_COLOR = { kinetic: "#f2d06b", he: "#ff9360", energy: "#a8a2ff", frag: "#9fb0b5" };
  const TECH_COLOR = { 低科技: "#d9a868", 中科技: "#8fd8cf", 高科技: "#b9b0ff" };
  const STAT = { damage: "#f4d28a", flux: "#b3a4ff", range: "#8cdec6", ammo: "#ffb37a", vent: "#8cdec6" };
  const copy = (v) => JSON.parse(JSON.stringify(v));
  // Per-second figures. One trigger of a salvo or MIRV weapon delivers every
  // round it carries, so damage counts them all.
  const volley = (w) => (w.mirv ? w.mirv.count * w.mirv.damage : w.damage) * (w.salvo || 1);
  const rate = (w, key) => w.mode === "beam" ? w[key] : (key === "damage" ? volley(w) : w[key]) / w.cooldown;
  const number = (n) => Math.round(n).toLocaleString("en-US");

  class GameUI extends base.GameUI {
    refit() {
      super.refit();
      if (this.modal !== "refit") return;
      const def = catalog.getShip(this.fitType);
      const saved = Object.assign({ weapons: {}, vents: 0, capacitors: 0 }, this.loadouts[this.fitId] || {});
      saved.weapons = saved.weapons || {};
      const fit = combat.validateLoadout(def.id, saved).ok ? saved : { weapons: {}, vents: 0, capacitors: 0 };
      this.refitState = { fit: copy(fit), mountId: def.mounts[0].id, candidateId: null, history: [], page: 0, message: "" };
      this.selectRefitMount(def.mounts[0].id);
      this.clearInput();
    }
    refitDefinition() { return catalog.getShip(this.fitType); }
    refitMount() { return this.refitDefinition().mounts.find((m) => m.id === this.refitState.mountId); }
    refitWeapon(mount) { return catalog.getWeapon(this.refitState.fit.weapons[mount.id] || mount.defaultWeapon); }
    refitCompatible() {
      const m = this.refitMount();
      return catalog.WEAPONS.filter((w) => w.type === m.type && w.size === m.size);
    }
    selectRefitMount(id) {
      const m = this.refitDefinition().mounts.find((item) => item.id === id);
      if (!m) return false;
      this.refitState.mountId = id;
      this.refitState.candidateId = this.refitWeapon(m).id;
      this.refitState.page = 0;
      this.refitState.message = "";
      this.refitState.more = false;
      return true;
    }
    previewRefitWeapon(id) {
      if (!this.refitCompatible().some((w) => w.id === id)) return false;
      this.refitState.candidateId = id;
      this.refitState.message = "";
      return true;
    }
    refitCandidate() {
      const draft = copy(this.refitState.fit);
      draft.weapons[this.refitState.mountId] = this.refitState.candidateId;
      return { fit: draft, ...combat.validateLoadout(this.fitType, draft) };
    }
    applyRefit(fit, message, remember = true) {
      const valid = combat.validateLoadout(this.fitType, fit);
      if (!valid.ok) { this.refitState.message = valid.reason; return false; }
      if (remember) {
        this.refitState.history.push(copy(this.refitState.fit));
        if (this.refitState.history.length > 20) this.refitState.history.shift();
      }
      this.refitState.fit = copy(fit);
      this.loadouts[this.fitId] = copy(fit);
      this.save();
      this.refitState.message = message;
      return true;
    }
    installRefitWeapon() {
      const result = this.refitCandidate();
      if (!result.ok) { this.refitState.message = "装配点不足，请先减少幅能扩容或散幅。"; return false; }
      const w = catalog.getWeapon(this.refitState.candidateId);
      if (this.refitWeapon(this.refitMount()).id === w.id) return false;
      return this.applyRefit(result.fit, w.name + "已安装");
    }
    changeFlux(key, delta) {
      if (this.modal !== "refit" || !this.refitState) return super.changeFlux(key, delta);
      if (!["vents", "capacitors"].includes(key) || !Number.isInteger(delta)) return false;
      const fit = copy(this.refitState.fit);
      fit[key] = Math.max(0, (fit[key] || 0) + delta);
      if (fit[key] === (this.refitState.fit[key] || 0)) return false;
      return this.applyRefit(fit, key === "vents" ? "散幅配置已应用" : "容量配置已应用");
    }
    undoRefit() {
      const fit = this.refitState.history.pop();
      if (!fit) return false;
      this.applyRefit(fit, "已撤销上一步", false);
      this.refitState.candidateId = this.refitWeapon(this.refitMount()).id;
      return true;
    }
    resetRefit() {
      this.applyRefit({ weapons: {}, vents: 0, capacitors: 0 }, "已恢复标准配装，可撤销");
      this.refitState.candidateId = this.refitWeapon(this.refitMount()).id;
    }
    closeRefit() { this.modal = null; this.refitState = null; this.clearInput(); }
    nextRefitShip(delta) {
      const n = this.fleets[this.team].length;
      this.slot = (this.slot + delta + n) % n;
      this.selected = this.fleets[this.team][this.slot];
      this.refit();
    }
    keyDown(key) {
      if (this.modal !== "refit") return super.keyDown(key);
      const k = key.toLowerCase();
      if (this.keys[k]) return;
      this.keys[k] = true;
      if (k === "escape") this.closeRefit();
      else if (/^[1-9]$/.test(k)) {
        const m = this.refitDefinition().mounts[Number(k) - 1];
        if (m) this.selectRefitMount(m.id);
      } else if (k === "enter") this.installRefitWeapon();
    }
    drawModal() {
      if (this.modal !== "refit") return super.drawModal();
      if (!this.refitState) this.refit();
      this.drawRefit();
    }
    // ── weapon art ───────────────────────────────────────────────────
    // Painted icons live in the "weapons" subpackage; until one has loaded the
    // hand-drawn miniature stands in, so the screen never shows an empty box.
    loadWeaponImages() {
      if (this.weaponImages) return;
      this.weaponImages = {};
      for (const w of catalog.WEAPONS) {
        const img = this.p.createImage();
        img.onload = () => { this.weaponImages[w.id] = img; };
        img.onerror = () => {};
        img.src = this.p.assetRoot + "assets/weapons/" + w.id + ".png";
      }
    }
    loadPack(name) {
      super.loadPack(name);
      if (name === "weapons") { this.weaponPack = true; this.loadWeaponImages(); }
    }
    weaponArt(weapon, x, y, w, h) {
      if (!this.weaponImages && (!this.p.deferPacks || this.weaponPack)) this.loadWeaponImages();
      const img = this.weaponImages && this.weaponImages[weapon.id];
      if (!img) return art.draw(this.ctx, weapon, x, y, w, h);
      const size = Math.min(w, h);
      this.ctx.drawImage(img, x + (w - size) / 2, y + (h - size) / 2, size, size);
      return true;
    }

    // ── fit summary ──────────────────────────────────────────────────
    refitStats() {
      const d = this.refitDefinition(), fit = this.refitState.fit, used = this.fitCost(d, fit);
      let weaponFlux = 0;
      for (const m of d.mounts) weaponFlux += rate(this.refitWeapon(m), "flux");
      const dissipation = d.fluxDissipation + (fit.vents || 0) * 10, capacity = d.fluxCapacity + (fit.capacitors || 0) * 200;
      return { used, remain: d.op - used, upgrades: (fit.vents || 0) + (fit.capacitors || 0), weaponFlux, upkeep: d.shieldUpkeep, dissipation, capacity };
    }
    // One tap fits the weapon. A refused fit leaves the mount as it was and says why.
    chooseRefitWeapon(id) {
      const mount = this.refitMount(), current = this.refitWeapon(mount).id;
      if (id === current || !this.previewRefitWeapon(id)) return false;
      const done = this.installRefitWeapon();
      if (!done) this.refitState.candidateId = current;
      return done;
    }
    refitAffordable(id) {
      const draft = copy(this.refitState.fit);
      draft.weapons[this.refitState.mountId] = id;
      return combat.validateLoadout(this.fitType, draft).ok;
    }

    // ── layout ───────────────────────────────────────────────────────
    refitLayout() {
      const s = this.safe, W = s.right - s.left, H = s.bottom - s.top, short = H < 540, narrow = W < 640;
      const pad = short ? 10 : 20, head = short ? 50 : 64, foot = short ? 66 : 88;
      const left = s.left + pad, right = s.right - pad, top = s.top + head, bottom = s.bottom - foot - (short ? 4 : 10);
      const inner = right - left, gap = short ? 8 : 14;
      // Hulls with many mounts get a two-column slot list so rows stay tappable.
      const many = !narrow && this.refitDefinition().mounts.length > 6;
      const slotsW = Math.round(many ? Math.max(232, Math.min(300, inner * 0.3)) : Math.max(narrow ? 118 : 148, Math.min(230, inner * 0.2)));
      const pickerW = Math.round(Math.max(narrow ? 236 : 300, Math.min(560, inner * 0.42)));
      const stageW = inner - slotsW - pickerW - gap * 2;
      return { short, narrow, many, pad, left, right, top, bottom, head, foot, gap,
        slots: { x: left, y: top, w: slotsW, h: bottom - top },
        stage: { x: left + slotsW + gap, y: top, w: stageW, h: bottom - top },
        picker: { x: right - pickerW, y: top, w: pickerW, h: bottom - top },
        footer: { x: left, y: bottom + (short ? 4 : 10), w: inner, h: foot } };
    }
    refitText(t, x, y, size = 13, color = P.text, align = "left", weight = 400, width) {
      const c = this.ctx;
      c.save();
      c.font = weight + " " + size + 'px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
      if (width) {
        let v = String(t);
        while (v.length > 1 && c.measureText(v).width > width) v = v.slice(0, -1);
        if (v !== String(t)) v = v.slice(0, -1) + "…";
        t = v;
      }
      c.fillStyle = color; c.textAlign = align; c.textBaseline = "middle";
      c.fillText(String(t), x, y); c.restore();
    }
    refitWidth(t, size, weight = 400) {
      const c = this.ctx;
      c.save();
      c.font = weight + " " + size + 'px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
      const w = c.measureText(String(t)).width;
      c.restore();
      return w;
    }
    refitButton(label, x, y, w, h, fn, opts = {}) {
      const disabled = !!opts.disabled;
      const hover = this.mouse && this.mouse.x >= x && this.mouse.x <= x + w && this.mouse.y >= y && this.mouse.y <= y + h;
      this.rect(x, y, w, h, disabled ? "#141b20" : opts.primary ? P.accent : hover ? "#2a363d" : "#1c262c", disabled ? "#222c31" : opts.primary ? null : "#3d4a4f");
      this.refitText(label, x + w / 2, y + h / 2, opts.size || 13, disabled ? P.dim : opts.primary ? "#202117" : P.text, "center", opts.primary ? 600 : 400);
      if (!disabled) this.hit(x, y, w, h, fn, { role: opts.role || "refit-action", ...opts });
    }
    // Draws "label value" pairs left to right, the value in its own colour, and
    // stops before running past the right edge.
    refitFacts(facts, x, y, right, size) {
      for (const [label, value, color] of facts) {
        const lw = label ? this.refitWidth(label + " ", size) : 0, vw = this.refitWidth(value, size, 600);
        if (x + lw + vw > right) break;
        if (label) this.refitText(label, x, y, size, P.muted);
        this.refitText(value, x + lw, y, size, color, "left", 600);
        x += lw + vw + size * 1.1;
      }
      return x;
    }

    // ── drawing ──────────────────────────────────────────────────────
    drawRefit() {
      const c = this.ctx, l = this.refitLayout(), d = this.refitDefinition();
      this.buttons = [];
      c.save();
      this.rect(0, 0, this.width, this.height, P.bg);
      const shade = c.createLinearGradient(0, 0, 0, this.height);
      shade.addColorStop(0, "#141c22"); shade.addColorStop(1, "#090d11");
      this.rect(0, 0, this.width, this.height, shade);
      this.drawRefitHeader(l, d);
      this.drawRefitSlots(l, d);
      this.drawRefitShip(l, d);
      this.drawRefitLibrary(l, d);
      this.drawRefitEngineering(l, d);
      this.drawRefitMenu();
      c.restore();
    }
    drawRefitHeader(l, d) {
      const top = this.safe.top + (l.short ? 3 : 10), right = Math.min(l.right, this.headerRight()), state = this.refitState;
      this.refitButton("‹ 完成", l.left, top, 76, 44, () => this.closeRefit(), { role: "refit-close", primary: true, size: 13 });
      let x = l.left + 88;
      const several = this.fleets[this.team].length > 1, wide = right - l.left >= 520;
      // right-hand controls, laid out from the edge inwards
      let rx = right;
      const place = (w) => { rx -= w; const at = rx; rx -= 6; return at; };
      if (wide) {
        this.refitButton("标准", place(58), top, 58, 44, () => this.resetRefit(), { role: "refit-reset", size: 12 });
        this.refitButton("撤销", place(58), top, 58, 44, () => this.undoRefit(), { role: "refit-undo", disabled: !state.history.length, size: 12 });
      } else {
        const mx = place(44);
        this.refitButton("···", mx, top, 44, 44, () => { state.more = !state.more; }, { role: "refit-more", size: 18 });
      }
      if (several) {
        this.refitButton("›", place(44), top, 44, 44, () => this.nextRefitShip(1), { role: "refit-next-ship", size: 20 });
        this.refitButton("‹", place(44), top, 44, 44, () => this.nextRefitShip(-1), { role: "refit-previous-ship", size: 20 });
      }
      const room = rx - x;
      this.refitText(d.name, x, top + (l.short ? 15 : 16), l.short ? 19 : 22, P.text, "left", 600, room);
      this.refitText((d.hullClass ? d.hullClass + "舰 · " : "") + d.className + " · " + d.tech + (several ? "   " + (this.slot + 1) + "/" + this.fleets[this.team].length : ""), x, top + (l.short ? 35 : 38), 11, TECH_COLOR[d.tech] || P.muted, "left", 400, room);
      this.line(l.left, l.top - 5, l.right, l.top - 5, P.line);
      this.refitMenu = !wide && state.more ? { x: Math.max(l.left, right - 214), y: top + 48 } : null;
    }
    // Drawn after every panel so its buttons sit on top of what it covers.
    drawRefitMenu() {
      const m = this.refitMenu, state = this.refitState;
      if (!m) return;
      this.rect(m.x, m.y, 214, 60, "#11191e", P.accent);
      this.refitButton("撤销上一步", m.x + 7, m.y + 8, 96, 44, () => { this.undoRefit(); state.more = false; }, { role: "refit-undo", disabled: !state.history.length, size: 11 });
      this.refitButton("恢复标准", m.x + 111, m.y + 8, 96, 44, () => { this.resetRefit(); state.more = false; }, { role: "refit-reset", size: 11 });
    }
    // Every mount as one row: the list is the primary way to pick a slot, so a
    // capital ship's twelve mounts stay as easy to hit as a frigate's three.
    drawRefitSlots(l, d) {
      let a = l.slots;
      const mount = this.refitMount(), n = d.mounts.length;
      const titleH = l.short ? 18 : 24;
      this.refitText("炮位", a.x, a.y + titleH / 2 - 1, 11, P.muted, "left", 600);
      this.refitText(n + " 个", a.x + a.w, a.y + titleH / 2 - 1, 10, P.dim, "right");
      const cols = l.many ? 2 : 1, rows = Math.ceil(n / cols), colW = (a.w - (cols - 1) * 4) / cols;
      const step = Math.min(l.short ? 46 : 54, (a.h - titleH) / rows), rowH = step - 3, slim = rowH < 34 || cols > 1;
      d.mounts.forEach((m, i) => {
        const y = a.y + titleH + (i % rows) * step, active = m.id === mount.id, w = this.refitWeapon(m), color = TYPE_COLOR[m.type];
        const a0 = a;
        a = { x: a0.x + Math.floor(i / rows) * (colW + 4), w: colW };
        this.rect(a.x, y, a.w, rowH, active ? "#2b2a20" : "#131b20", active ? P.accent : "#232e34");
        this.rect(a.x, y, 3, rowH, color);
        const icon = Math.min(rowH - 4, 34);
        this.weaponArt(w, a.x + 7, y + (rowH - icon) / 2, icon, icon);
        const tx = a.x + 12 + icon;
        if (slim) {
          this.refitText(String(i + 1).padStart(2, "0"), tx, y + rowH / 2, 10, active ? P.accent : P.dim, "left", 600);
          this.refitText(w.name, tx + 20, y + rowH / 2, 11, P.text, "left", 400, a.x + a.w - tx - 24);
        } else {
          this.refitText(String(i + 1).padStart(2, "0") + " " + SIZE[m.size] + TYPE[m.type], tx, y + rowH / 2 - 8, 10, active ? P.accent : color, "left", 600, a.x + a.w - tx - 4);
          this.refitText(w.name, tx, y + rowH / 2 + 8, 12, P.text, "left", 400, a.x + a.w - tx - 4);
        }
        this.hit(a.x, y, a.w, rowH, () => this.selectRefitMount(m.id), { role: "refit-slot", mountId: m.id });
        a = a0;
      });
    }
    drawRefitShip(l, d) {
      const c = this.ctx, a = l.stage, mount = this.refitMount();
      const foot = l.short ? 16 : 24;
      const cx = a.x + a.w / 2, cy = a.y + (a.h - foot) / 2;
      const size = Math.max(60, Math.min(a.w * 1.02, (a.h - foot) * 1.02));
      this.refitShipGeometry = { cx, cy, size };
      const unit = size / (d.length * (d.spriteScale || 1.04)), rad = Math.PI / 180;
      const pos = (m) => ({ x: cx + m.y * unit, y: cy - m.x * unit });
      c.save(); c.beginPath(); c.rect(a.x, a.y, a.w, a.h); c.clip();
      const glow = c.createRadialGradient(cx, cy, size * 0.1, cx, cy, size * 0.62);
      glow.addColorStop(0, "#2b3a4270"); glow.addColorStop(1, "#17212900");
      this.rect(a.x, a.y, a.w, a.h, glow);
      this.circle(cx, cy, size * 0.5, "#222e33", null);
      // firing arc of the selected mount
      const selected = pos(mount), angle = (mount.angle - 90) * rad, color = TYPE_COLOR[mount.type];
      c.beginPath(); c.moveTo(selected.x, selected.y);
      c.arc(selected.x, selected.y, size * 0.6, angle - mount.arc * rad / 2, angle + mount.arc * rad / 2);
      c.closePath(); c.fillStyle = color + "14"; c.fill(); c.strokeStyle = color + "55"; c.lineWidth = 1; c.stroke();
      c.save(); c.shadowColor = "#000000"; c.shadowBlur = 16; c.shadowOffsetY = 6;
      this.shipImage(d.id, cx, cy, size, -Math.PI / 2); c.restore();
      c.restore();
      d.mounts.forEach((m, i) => {
        const p = pos(m), active = m.id === mount.id, r = active ? 12 : 8;
        this.circle(p.x, p.y, r, active ? P.accent : TYPE_COLOR[m.type], active ? "#2b2a20f2" : "#0d1418d9", active ? 2 : 1.3);
        this.refitText(i + 1, p.x, p.y + 0.5, active ? 11 : 9, active ? P.accent : P.text, "center", 600);
        this.hit(p.x - 13, p.y - 13, 26, 26, () => this.selectRefitMount(m.id), { role: "refit-pin", mountId: m.id });
      });
      this.refitText((mount.hardpoint ? "固定炮位" : "旋转炮塔") + " · 射界 " + mount.arc + "° · 武器组 " + (mount.group + 1), cx, a.y + a.h - foot / 2 + 2, l.short ? 10 : 11, P.muted, "center", 400, a.w);
    }
    drawRefitLibrary(l, d) {
      const a = l.picker, m = this.refitMount(), state = this.refitState;
      const list = this.refitCompatible(), installed = this.refitWeapon(m), index = d.mounts.indexOf(m) + 1;
      const headH = l.short ? 22 : 30, noteH = l.short ? 18 : 24;
      this.refitText("炮位 " + String(index).padStart(2, "0"), a.x, a.y + headH / 2 - 2, l.short ? 14 : 16, P.text, "left", 600);
      this.refitText(SIZE[m.size] + TYPE[m.type], a.x + (l.short ? 60 : 70), a.y + headH / 2 - 2, 12, TYPE_COLOR[m.type], "left", 600);
      const per = Math.max(1, Math.min(4, Math.floor((a.h - headH - noteH) / 44)));
      const pages = Math.max(1, Math.ceil(list.length / per));
      const page = (state.page = Math.max(0, Math.min(pages - 1, state.page || 0)));
      if (pages > 1) {
        this.refitButton("‹", a.x + a.w - 92, a.y, 44, headH - 2, () => { state.page = page - 1; }, { disabled: page === 0, size: 16 });
        this.refitButton("›", a.x + a.w - 44, a.y, 44, headH - 2, () => { state.page = page + 1; }, { disabled: page >= pages - 1, size: 16 });
        this.refitText(page + 1 + "/" + pages, a.x + a.w - 100, a.y + headH / 2 - 2, 10, P.dim, "right");
      } else this.refitText(list.length + " 件可选 · 点选即装", a.x + a.w, a.y + headH / 2 - 2, 10, P.dim, "right");
      const visible = list.slice(page * per, page * per + per);
      const step = Math.min(l.short ? 68 : 92, (a.h - headH - noteH) / Math.max(visible.length, l.short ? 3 : 4)), rowH = step - 5;
      const tall = rowH >= 58;
      visible.forEach((w, i) => {
        const y = a.y + headH + i * step, equipped = w.id === installed.id, ok = equipped || this.refitAffordable(w.id);
        const c = this.ctx;
        c.save();
        if (!ok) c.globalAlpha = 0.5;
        this.rect(a.x, y, a.w, rowH, equipped ? "#26271f" : "#131b20", equipped ? P.accent : "#263238");
        if (equipped) this.rect(a.x, y, 3, rowH, P.accent);
        const box = rowH - 8;
        this.rect(a.x + 6, y + 4, box, box, "#0b1115", "#1e282d");
        this.weaponArt(w, a.x + 8, y + 6, box - 4, box - 4);
        const tx = a.x + box + 16, edge = a.x + a.w - 10;
        const line1 = y + (tall ? 15 : rowH / 2 - 9), line2 = y + (tall ? 35 : rowH / 2 + 9);
        // name, state badge, cost
        const delta = w.op - installed.op;
        this.refitText(w.op + " OP", edge, line1, l.short ? 13 : 14, P.accent, "right", 600);
        const costW = this.refitWidth(w.op + " OP", l.short ? 13 : 14, 600);
        if (equipped) this.refitText("已装", edge - costW - 10, line1, 10, P.good, "right", 600);
        else if (!ok) this.refitText("装配点不足", edge - costW - 10, line1, 10, P.bad, "right", 600);
        else if (delta) this.refitText((delta > 0 ? "+" : "") + delta, edge - costW - 10, line1, 11, delta > 0 ? P.bad : P.good, "right", 600);
        this.refitText(w.name, tx, line1, l.short ? 14 : 16, P.text, "left", 600, edge - costW - 70 - tx);
        // coloured figures
        const tag = DAMAGE[w.damageType], tagW = this.refitWidth(tag, 10, 600) + 10;
        this.rect(tx, line2 - 8, tagW, 16, DAMAGE_COLOR[w.damageType] + "2e", DAMAGE_COLOR[w.damageType] + "90");
        this.refitText(tag, tx + tagW / 2, line2, 10, DAMAGE_COLOR[w.damageType], "center", 600);
        const facts = [["伤害", number(rate(w, "damage")) + "/s", STAT.damage]];
        if (w.flux) facts.push(["幅能", number(rate(w, "flux")) + "/s", STAT.flux]);
        facts.push(["射程", String(w.range), STAT.range]);
        if (w.ammo) facts.push(["弹药", String(w.ammo * (w.salvo || 1)), STAT.ammo]);
        this.refitFacts(facts, tx + tagW + 8, line2, edge, l.short ? 11 : 12);
        if (tall) this.refitText(EFFECT[w.damageType] + "　" + (PURPOSE[w.id] || w.purpose || ""), tx, y + rowH - 13, 10, P.dim, "left", 400, edge - tx);
        c.restore();
        this.hit(a.x, y, a.w, rowH, () => this.chooseRefitWeapon(w.id), { role: "refit-weapon", weaponId: w.id });
      });
      if (list.length === 1) this.refitText("这种炮位目前只有这一件武器", a.x + 4, a.y + headH + step + 12, 11, P.dim);
      if (state.message) this.refitText(state.message, a.x, a.y + a.h - noteH / 2 + 2, 11, /不足|没有|无法|不兼容/.test(state.message) ? P.bad : P.good, "left", 400, a.w);
    }
    drawRefitEngineering(l, d) {
      const f = l.footer, fit = this.refitState.fit, s = this.refitStats();
      this.rect(f.x, f.y, f.w, f.h, "#0f161b", "#222d33");
      const mid = f.y + f.h / 2, tight = f.w < 620;
      // ── ordnance points ──
      const aw = Math.round(f.w * (tight ? 0.24 : 0.25)), ax = f.x + 12;
      this.refitText("装配点", ax, f.y + 15, 11, P.muted);
      this.refitText(s.used + " / " + d.op, ax + aw - 24, f.y + 15, l.short ? 15 : 18, s.remain < 0 ? P.bad : P.text, "right", 600);
      const bw = aw - 24, by = mid + 1, weaponsOP = s.used - s.upgrades;
      this.rect(ax, by, bw, 6, "#232e34");
      this.rect(ax, by, bw * Math.min(1, weaponsOP / d.op), 6, P.accent);
      this.rect(ax + bw * weaponsOP / d.op, by, bw * (fit.vents || 0) / d.op, 6, STAT.vent);
      this.rect(ax + bw * (weaponsOP + (fit.vents || 0)) / d.op, by, bw * (fit.capacitors || 0) / d.op, 6, STAT.flux);
      this.refitText("剩余 " + s.remain, ax, f.y + f.h - 14, 11, s.remain ? P.muted : P.accent);
      // ── steppers, measured from the right edge ──
      const unit = tight ? 132 : 176, cx0 = f.x + f.w - unit * 2 - 8;
      [["vents", "散逸", number(s.dissipation) + "/s", STAT.vent], ["capacitors", "容量", number(s.capacity), STAT.flux]].forEach(([key, label, value, color], i) => {
        const x = cx0 + i * unit, n = fit[key] || 0, bh = Math.min(44, f.h - 12), y = f.y + (f.h - bh) / 2;
        const tw = unit - 96;
        this.refitText(label + (n ? " +" + n : ""), x + tw / 2, mid - 9, 10, P.muted, "center", 400, tw);
        this.refitText(value, x + tw / 2, mid + 9, tight ? 12 : 14, color, "center", 600, tw);
        this.refitButton("−", x + tw, y, 44, bh, () => this.changeFlux(key, -1), { disabled: !n, role: "refit-flux-minus", key, size: 20 });
        this.refitButton("+", x + tw + 46, y, 44, bh, () => this.changeFlux(key, 1), { disabled: s.remain <= 0, role: "refit-flux-plus", key, size: 20 });
      });
      // ── flux balance: can this fit keep firing? ──
      const bx = ax + aw, bwid = cx0 - bx - 10, load = s.weaponFlux, net = load - s.dissipation, netShield = net + s.upkeep;
      this.line(bx - 6, f.y + 8, bx - 6, f.y + f.h - 8, "#222d33");
      this.line(cx0 - 6, f.y + 8, cx0 - 6, f.y + f.h - 8, "#222d33");
      this.refitFacts([["武器幅能", number(load) + "/s", STAT.flux], ["散逸", number(s.dissipation) + "/s", STAT.vent]], bx + 4, f.y + 15, bx + bwid, tight ? 11 : 12);
      const gy = mid + 1;
      this.rect(bx + 4, gy, bwid - 8, 6, "#232e34");
      const scale = Math.max(load + s.upkeep, s.dissipation) || 1, gw = bwid - 8;
      this.rect(bx + 4, gy, gw * load / scale, 6, net > 0 ? P.bad : STAT.flux);
      this.rect(bx + 4 + gw * load / scale, gy, gw * s.upkeep / scale, 6, "#5d7684");
      this.rect(bx + 4 + gw * s.dissipation / scale - 1, gy - 3, 2, 12, STAT.vent);
      const seconds = (v) => (s.capacity / v < 99 ? Math.round(s.capacity / v) + " 秒" : "很久");
      const verdict = netShield <= 0 ? ["举盾齐射也能一直打", P.good]
        : net <= 0 ? ["齐射可持续；举盾时 " + seconds(netShield) + "满幅能", STAT.ammo]
        : ["齐射 " + seconds(net) + "满幅能，举盾 " + seconds(netShield), P.bad];
      this.refitText(verdict[0], bx + 4, f.y + f.h - 14, 11, verdict[1], "left", 400, bwid - 8);
    }
  }
  return { GameUI };
});

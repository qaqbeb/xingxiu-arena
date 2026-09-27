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
  };
  const EFFECT = { kinetic: "护盾 ×2   装甲 ×0.5", he: "护盾 ×0.5   装甲 ×2", energy: "护盾 ×1   装甲 ×1", frag: "护盾 ×0.25   装甲 ×0.25" };
  const copy = (v) => JSON.parse(JSON.stringify(v));
  const rate = (w, key) => w.mode === "beam" ? w[key] : w[key] / w.cooldown;
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
      else if (/^[1-4]$/.test(k)) {
        const m = this.refitDefinition().mounts[Number(k) - 1];
        if (m) this.selectRefitMount(m.id);
      } else if (k === "enter") this.installRefitWeapon();
    }
    drawModal() {
      if (this.modal !== "refit") return super.drawModal();
      if (!this.refitState) this.refit();
      this.drawRefit();
    }
    refitLayout() {
      const s = this.safe, short = s.bottom - s.top < 540;
      const pad = short ? 14 : 28;
      const left = s.left + pad, right = s.right - pad;
      const top = s.top + (short ? 58 : 92);
      const bottom = s.bottom - (short ? 80 : 126);
      const split = left + (right - left) * (short ? 0.46 : 0.53);
      return { short, pad, left, right, top, bottom, split, footer: bottom + 12,
        stage: { x: left, y: top, w: split - left - 18, h: bottom - top },
        library: { x: split + 16, y: top, w: right - split - 16, h: bottom - top } };
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
    refitButton(label, x, y, w, h, fn, opts = {}) {
      const disabled = !!opts.disabled;
      const hover = this.mouse && this.mouse.x >= x && this.mouse.x <= x + w && this.mouse.y >= y && this.mouse.y <= y + h;
      this.rect(x, y, w, h, disabled ? "#172025" : opts.primary ? P.accent : hover ? "#263138" : "#1b252b", disabled ? P.line : opts.primary ? null : "#47534f");
      this.refitText(label, x + w / 2, y + h / 2, opts.size || 13, disabled ? P.dim : opts.primary ? "#202117" : P.text, "center", opts.primary ? 600 : 400);
      if (!disabled) this.hit(x, y, w, h, fn, { role: opts.role || "refit-action", ...opts });
    }
    drawRefit() {
      const c = this.ctx, l = this.refitLayout(), d = this.refitDefinition();
      this.buttons = [];
      c.save();
      this.rect(0, 0, this.width, this.height, P.bg);
      const shade = c.createLinearGradient(0, 0, this.width, this.height);
      shade.addColorStop(0, "#1b252b"); shade.addColorStop(0.6, "#0c1217"); shade.addColorStop(1, "#11191d");
      this.rect(0, 0, this.width, this.height, shade);
      this.line(l.left, l.top - 9, l.right, l.top - 9, P.line);
      const titleY = this.safe.top + (l.short ? 27 : 37);
      this.refitText("舰船整备", l.left, titleY, l.short ? 19 : 24, P.text, "left", 600);
      this.refitText((this.team === 0 ? "己方" : "对手") + "舰队  /  " + String(this.slot + 1).padStart(2, "0"), l.left + (l.short ? 108 : 136), titleY, 12, P.muted);
      const headerRight = Math.min(l.right, this.headerRight());
      this.refitButton("完成整备  ›", headerRight - 116, this.safe.top + 6, 116, 44, () => this.closeRefit(), { role: "refit-close" });
      if (!l.short) this.refitText("选择舰体炮位，检视并安装武器", l.left, titleY + 28, 12, P.muted);
      this.line(l.split, l.top + 4, l.split, l.bottom, P.line);
      this.drawRefitShip(l, d);
      this.drawRefitLibrary(l, d);
      this.drawRefitEngineering(l, d);
      c.restore();
    }
    drawRefitShip(l, d) {
      const c = this.ctx, a = l.stage;
      this.refitText(d.name, a.x, a.y + 13, l.short ? 21 : 30, P.text, "left", 600);
      this.refitText(d.className + "  ·  " + d.tech, a.x, a.y + (l.short ? 36 : 43), 12, P.muted);
      const shipSwitchX = a.x + a.w - 92;
      this.refitButton("‹", shipSwitchX, a.y - 4, 44, 44, () => this.nextRefitShip(-1), { role: "refit-previous-ship", disabled: this.fleets[this.team].length < 2, size: 22 });
      this.refitButton("›", shipSwitchX + 48, a.y - 4, 44, 44, () => this.nextRefitShip(1), { role: "refit-next-ship", disabled: this.fleets[this.team].length < 2, size: 22 });
      const head = l.short ? 50 : 66, foot = l.short ? 18 : 56;
      const cx = a.x + a.w / 2, cy = a.y + head + (a.h - head - foot) / 2;
      const size = Math.max(70, Math.min(a.w * (l.short ? 0.82 : 0.8), a.h - head - foot + (l.short ? 22 : 12)));
      this.refitShipGeometry = { cx, cy, size };
      c.save(); c.beginPath(); c.rect(a.x, a.y + head - 6, a.w, Math.max(1, a.h - head + 6)); c.clip();
      const glow = c.createRadialGradient(cx, cy, size * 0.1, cx, cy, size * 0.68);
      glow.addColorStop(0, "#30404780"); glow.addColorStop(1, "#17212900");
      this.rect(a.x, a.y + head - 6, a.w, a.h, glow);
      // Drafting marks are restrained and stationary; the hull stays the visual focus.
      this.line(cx, a.y + head, cx, a.y + a.h - foot + 10, "#2b393c");
      this.line(a.x + 12, cy, a.x + a.w - 12, cy, "#243034");
      this.circle(cx, cy, size * 0.49, "#273539", null);
      for (let i = -4; i <= 4; i++) {
        const ty = cy + i * size / 9;
        this.line(cx - size * 0.51, ty, cx - size * 0.51 + (i % 2 ? 4 : 9), ty, "#526065");
      }
      const mount = this.refitMount();
      const pos = (m) => ({ x: cx + m.y * size / (d.length * (d.spriteScale || 1.04)), y: cy - m.x * size / (d.length * (d.spriteScale || 1.04)) });
      const selected = pos(mount), rad = Math.PI / 180, angle = (mount.angle - 90) * rad;
      const radius = size * 0.59;
      c.beginPath(); c.moveTo(selected.x, selected.y);
      c.arc(selected.x, selected.y, radius, angle - mount.arc * rad / 2, angle + mount.arc * rad / 2);
      c.closePath(); c.fillStyle = "#c7a66b0d"; c.fill(); c.strokeStyle = "#c7a66b38"; c.lineWidth = 1; c.stroke();
      c.save(); c.shadowColor = "#000000"; c.shadowBlur = 18; c.shadowOffsetY = 8;
      this.shipImage(d.id, cx, cy, size, -Math.PI / 2); c.restore();
      d.mounts.forEach((m) => {
        const p = pos(m), iconSize = Math.max(l.short ? 15 : 21, size * (m.size === "large" ? 0.17 : m.size === "medium" ? 0.105 : 0.075));
        c.save(); c.translate(p.x, p.y); c.rotate(m.angle * rad);
        art.draw(c, this.refitWeapon(m), -iconSize / 2, -iconSize / 2, iconSize, iconSize);
        c.restore();
      });
      c.restore();
      // Callouts supplement exact on-hull pins with non-overlapping touch targets.
      const sides = [[], []];
      d.mounts.forEach((m, i) => { const side = m.y < -0.1 ? 0 : m.y > 0.1 ? 1 : sides[0].length <= sides[1].length ? 0 : 1; sides[side].push({ m, i }); });
      const callW = Math.min(l.short ? 86 : 133, a.w * 0.26);
      for (let side = 0; side < 2; side++) {
        const items = sides[side].sort((v, w) => w.m.x - v.m.x);
        items.forEach(({ m, i }, index) => {
          const p = pos(m), active = m.id === mount.id;
          const x = side ? a.x + a.w - callW : a.x;
          const available = Math.max(46, a.h - head - foot);
          const y = a.y + head + (available - items.length * 46) / 2 + index * (l.short ? 46 : 66) - (!l.short && items.length > 1 ? 10 : 0);
          const endX = side ? x : x + callW, endY = y + 22;
          c.save(); c.beginPath(); c.moveTo(p.x, p.y); c.lineTo((p.x + endX) / 2, endY); c.lineTo(endX, endY);
          c.strokeStyle = active ? P.accent : "#72807a99"; c.lineWidth = 1; c.stroke(); c.restore();
          this.rect(x, y, callW, 44, active ? "#302d23ed" : "#111a20ee", active ? "#8f794f" : "#334248");
          this.refitText(String(i + 1).padStart(2, "0") + "  " + SIZE[m.size] + TYPE[m.type], x + 7, y + 12, l.short ? 10 : 11, active ? P.accent : P.muted);
          this.refitText(this.refitWeapon(m).name, x + 7, y + 30, l.short ? 11 : 13, P.text);
          this.hit(x, y, callW, 44, () => this.selectRefitMount(m.id), { role: "refit-slot", mountId: m.id });
          this.circle(p.x, p.y, active ? 13 : 10, active ? P.accent : "#c3cbc5", "#111a20d9", active ? 2 : 1);
          this.refitText(i + 1, p.x, p.y, 11, active ? P.accent : P.text, "center", 600);
          this.hit(p.x - 12, p.y - 12, 24, 24, () => this.selectRefitMount(m.id), { role: "refit-pin", mountId: m.id });
        });
      }
      const hintY = a.y + a.h - (l.short ? 4 : 34);
      this.refitText((mount.hardpoint ? "固定炮" : "旋转炮塔") + "  ·  射界 " + mount.arc + "°  ·  武器组 " + (mount.group + 1), cx, hintY, l.short ? 10 : 12, P.muted, "center");
      if (!l.short) this.refitText(d.material, cx, hintY + 23, 12, P.dim, "center");
    }
    drawRefitLibrary(l, d) {
      const a = l.library, m = this.refitMount(), state = this.refitState;
      const list = this.refitCompatible(), selected = catalog.getWeapon(state.candidateId), installed = this.refitWeapon(m);
      const mountNumber = d.mounts.indexOf(m) + 1;
      this.refitText("炮位 " + String(mountNumber).padStart(2, "0"), a.x, a.y + 10, l.short ? 17 : 22, P.text, "left", 600);
      this.refitText(SIZE[m.size] + " / " + TYPE[m.type], a.x + (l.short ? 85 : 110), a.y + 11, 12, P.accent);
      this.refitText(list.length + " 件兼容", a.x + a.w, a.y + 11, 11, P.muted, "right");
      const rowH = l.short ? 48 : 72, gap = l.short ? 5 : 8, listY = a.y + (l.short ? 30 : 44);
      const page = state.page || 0, visible = list.slice(page * 2, page * 2 + 2);
      visible.forEach((w, i) => {
        const y = listY + i * (rowH + gap), active = w.id === selected.id, equipped = w.id === installed.id;
        this.rect(a.x, y, a.w, rowH, active ? "#282a24" : "#162026", active ? "#8c7a57" : "#2e3b41");
        if (active) this.rect(a.x, y, 3, rowH, P.accent);
        art.draw(this.ctx, w, a.x + 6, y + 2, l.short ? 56 : 78, rowH - 4, { selected: active });
        const tx = a.x + (l.short ? 66 : 94);
        this.refitText(w.name, tx, y + (l.short ? 14 : 23), l.short ? 14 : 17, P.text, "left", 600);
        this.refitText(DAMAGE[w.damageType] + (w.mode === "beam" ? "光束" : w.type === "missile" ? "导弹" : "弹") + "  ·  射程 " + w.range, tx, y + (l.short ? 33 : 49), l.short ? 10 : 12, P.muted, "left", 400, a.w - (l.short ? 66 : 94) - 64);
        this.refitText(w.op + " OP", a.x + a.w - 12, y + (l.short ? 14 : 24), l.short ? 13 : 16, active ? P.accent : P.text, "right", 500);
        this.refitText(equipped ? "已装配" : "可替换", a.x + a.w - 12, y + (l.short ? 33 : 49), l.short ? 10 : 11, equipped ? P.good : P.muted, "right");
        this.hit(a.x, y, a.w, rowH, () => this.previewRefitWeapon(w.id), { role: "refit-weapon", weaponId: w.id });
      });
      if (list.length === 1) {
        const y = listY + rowH + gap;
        this.refitText("该槽型目前只有这一件兼容武器", a.x + 4, y + 14, 11, P.dim);
      }
      const infoY = listY + 2 * (rowH + gap) + (l.short ? 4 : 16);
      const result = this.refitCandidate(), delta = selected.op - installed.op, same = installed.id === selected.id;
      if (!l.short && a.h >= 455) {
        this.line(a.x, infoY - 4, a.x + a.w, infoY - 4, P.line);
        art.draw(this.ctx, selected, a.x, infoY + 10, 110, 110, { selected: true });
        this.refitText(selected.name, a.x + 120, infoY + 26, 20, P.text, "left", 600);
        this.refitText(PURPOSE[selected.id], a.x + 120, infoY + 54, 12, P.muted, "left", 400, a.w - 122);
        this.refitText(EFFECT[selected.damageType], a.x + 120, infoY + 82, 12, P.accent);
        const statY = infoY + 138, col = a.w / 3;
        const stats = [
          ["持续伤害 / 秒", rate(selected, "damage"), rate(installed, "damage"), false],
          ["开火幅能 / 秒", rate(selected, "flux"), rate(installed, "flux"), true],
          ["有效射程", selected.range, installed.range, false],
        ];
        stats.forEach(([label, value, old, lower], i) => {
          const x = a.x + i * col;
          this.refitText(label, x, statY, 11, P.muted);
          this.refitText(number(value), x, statY + 28, 24, P.text, "left", 500);
          if (!same && Math.round(value - old)) {
            const diff = Math.round(value - old);
            this.refitText((diff > 0 ? "+" : "") + diff, x + 80, statY + 28, 12, (diff < 0) === lower ? P.good : P.bad);
          }
        });
        if (a.h > 490) {
          this.refitText(selected.mode === "beam" ? "连续照射" : "单发 " + selected.damage + "  ·  间隔 " + selected.cooldown + " 秒", a.x, statY + 64, 12, P.muted);
          this.refitText(selected.ammo ? "弹药 " + selected.ammo + " 发" : "无弹药限制", a.x + a.w, statY + 64, 12, P.muted, "right");
        }
      } else if (l.bottom - 44 - infoY >= 40) {
        const compare = (value, old) => !same && Math.round(value) !== Math.round(old) ? number(old) + " → " + number(value) : number(value);
        this.refitText("伤害 " + compare(rate(selected, "damage"), rate(installed, "damage")) + "/s   幅能 " + compare(rate(selected, "flux"), rate(installed, "flux")) + "/s", a.x, infoY + 6, l.short ? 11 : 13, P.muted);
        this.refitText(EFFECT[selected.damageType], a.x, infoY + 23, l.short ? 10 : 12, P.accent);
        if (l.bottom - 44 - infoY >= 64)
          this.refitText("射程 " + compare(selected.range, installed.range) + (selected.ammo ? "   弹药 " + selected.ammo + " 发" : ""), a.x, infoY + 41, 10, P.muted);
        if (!l.short && l.bottom - 44 - infoY >= 100)
          this.refitText(PURPOSE[selected.id], a.x, infoY + 69, 12, P.muted, "left", 400, a.w);
      }
      const buttonW = l.short ? 128 : 154, buttonY = l.bottom - 44;
      const note = state.message || (same ? "当前配置" : !result.ok ? "装配点不足" : delta === 0 ? "替换不改变装配点" : delta < 0 ? "替换节省 " + (-delta) + " OP" : "替换增加 " + delta + " OP");
      this.refitText(note, a.x, buttonY + 22, l.short ? 11 : 12, !result.ok ? P.bad : P.muted, "left", 400, a.w - buttonW - 12);
      this.refitButton(same ? "已装配" : !result.ok ? "装配点不足" : "安装至炮位 " + String(mountNumber).padStart(2, "0"), a.x + a.w - buttonW, buttonY, buttonW, 44, () => this.installRefitWeapon(), { primary: true, disabled: same || !result.ok, role: "refit-install" });
      if (list.length > 2) {
        // Two rows keep the current armory readable; future catalog expansion gets paging.
        this.refitButton("‹", a.x + a.w - 96, infoY - 4, 44, 44, () => { state.page = Math.max(0, page - 1); }, { disabled: page === 0 });
        this.refitButton("›", a.x + a.w - 48, infoY - 4, 44, 44, () => { state.page = Math.min(Math.ceil(list.length / 2) - 1, page + 1); }, { disabled: page >= Math.ceil(list.length / 2) - 1 });
      }
    }
    drawRefitEngineering(l, d) {
      const fit = this.refitState.fit, used = this.fitCost(d, fit), remain = d.op - used;
      const y = l.footer, width = l.right - l.left, budgetW = width * (l.short ? 0.28 : 0.3);
      this.line(l.left, y - 1, l.right, y - 1, "#47514d");
      const budgetX = l.left;
      this.refitText("装配点", budgetX, y + 19, 12, P.muted);
      this.refitText(used + " / " + d.op, budgetX + budgetW - 20, y + 19, l.short ? 16 : 20, P.text, "right", 500);
      const bx = budgetX, by = y + 36, bw = budgetW - 20;
      this.rect(bx, by, bw, 5, "#253036");
      const weaponsOP = used - (fit.vents || 0) - (fit.capacitors || 0);
      this.rect(bx, by, bw * weaponsOP / d.op, 5, P.accent);
      this.rect(bx + bw * weaponsOP / d.op, by, bw * (fit.vents || 0) / d.op, 5, "#93b8b0");
      this.rect(bx + bw * (weaponsOP + (fit.vents || 0)) / d.op, by, bw * (fit.capacitors || 0) / d.op, 5, "#76909d");
      this.refitText("剩余 " + remain + " OP", budgetX, y + 54, 11, remain ? P.muted : P.accent);
      const upgradeX = l.left + budgetW, unitW = (width - budgetW) / 2;
      [["vents", "散幅", d.fluxDissipation, 10, "/s"], ["capacitors", "容量", d.fluxCapacity, 200, ""]].forEach(([key, label, baseValue, step, suffix], i) => {
        const x = upgradeX + i * unitW + 8, n = fit[key] || 0;
        const narrow = unitW < 225;
        if (narrow) {
          this.refitText(label, x, y + 16, 11, P.muted);
          this.refitText(number(baseValue + n * step) + suffix, x, y + 38, 11, P.text);
        } else {
          this.refitText(label + " " + number(baseValue + n * step) + suffix, x, y + 17, l.short ? 12 : 15, P.text);
          this.refitText("每点 +" + step + suffix, x, y + 41, 10, P.muted);
        }
        const controlsX = x + unitW - (narrow ? 134 : l.short ? 145 : 157);
        this.refitButton("−", controlsX, y + 10, 44, 44, () => this.changeFlux(key, -1), { disabled: !n, role: "refit-flux-minus", key, size: 20 });
        this.refitText(n, controlsX + 63, y + 32, 18, P.accent, "center");
        this.refitButton("+", controlsX + 82, y + 10, 44, 44, () => this.changeFlux(key, 1), { disabled: remain <= 0, role: "refit-flux-plus", key, size: 20 });
      });
      if (!l.short) {
        this.refitButton("恢复标准配装", l.left, y + 69, 116, 36, () => this.resetRefit(), { role: "refit-reset", size: 11 });
        this.refitButton("撤销上一步", l.left + 126, y + 69, 104, 36, () => this.undoRefit(), { role: "refit-undo", disabled: !this.refitState.history.length, size: 11 });
        this.refitText("武器、散幅与容量共用装配点；安装后立即应用。", l.right, y + 88, 11, P.dim, "right");
      } else {
        // Compact layouts put reversible reset/undo controls in the vacant header strip.
        const x = Math.max(l.left + 222, this.headerRight() - 260);
        if (this.headerRight() - x >= 258) {
          this.refitButton("撤销", x, this.safe.top + 6, 60, 44, () => this.undoRefit(), { disabled: !this.refitState.history.length, role: "refit-undo", size: 11 });
          this.refitButton("标准", x + 66, this.safe.top + 6, 60, 44, () => this.resetRefit(), { role: "refit-reset", size: 11 });
        } else {
          this.refitButton("···", this.headerRight() - 168, this.safe.top + 6, 44, 44, () => { this.refitState.more = !this.refitState.more; }, { role: "refit-more", size: 20 });
          if (this.refitState.more) {
            const mx = this.headerRight() - 224, my = this.safe.top + 53;
            this.rect(mx, my, 224, 60, "#11191e", P.accent);
            this.refitButton("撤销上一步", mx + 7, my + 8, 100, 44, () => { this.undoRefit(); this.refitState.more = false; }, { role: "refit-undo", disabled: !this.refitState.history.length, size: 11 });
            this.refitButton("恢复标准", mx + 117, my + 8, 100, 44, () => { this.resetRefit(); this.refitState.more = false; }, { role: "refit-reset", size: 11 });
          }
        }
      }
    }
  }
  return { GameUI };
});

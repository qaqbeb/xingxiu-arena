(function (root, factory) {
  if (typeof module === "object" && module.exports)
    module.exports = factory(
      require("./refit-screen"),
      require("./ships"),
      require("./campaign"),
      require("./refit-weapon-art"),
    );
  else
    root.StarCampaignUI = factory(
      root.StarRefit,
      root.StarShips,
      root.StarCampaign,
      root.StarRefitWeaponArt,
    );
})(typeof globalThis !== "undefined" ? globalThis : this, function (
  base,
  catalog,
  campaign,
  art,
) {
  "use strict";
  // Campaign layer: main menu, star map, ports (ship market, weapon market,
  // dockyard) and the battle aftermath. Battles themselves are the existing
  // deploy → fight flow; this class only feeds it a fleet and reads the result.
  const P = {
    panel: "#0b1925e8",
    panelSolid: "#0b1925",
    line: "#243b48",
    text: "#e8eeeb",
    muted: "#a9c0c9",
    dim: "#5d7887",
    mint: "#8cdec6",
    gold: "#ddba83",
    red: "#ed9989",
    blue: "#85ccea",
  };
  const SIZE = { small: "小型", medium: "中型", large: "大型" };
  const TYPE = { ballistic: "实弹", energy: "能量", missile: "导弹" };
  const DAMAGE = { kinetic: "动能", he: "破甲", energy: "能量", frag: "破片" };
  const KIND = { port: "港口", wild: "险地", boss: "妖王巢穴" };
  const TECH = { low: "低科技", mid: "中科技", high: "高科技" };
  const SCREENS = ["menu", "map", "port"];
  const copy = (v) => JSON.parse(JSON.stringify(v));
  const money = (n) => Math.round(n).toLocaleString("en-US");
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  class GameUI extends base.GameUI {
    constructor(platform) {
      super(platform);
      this.campaign = null;
      this.campaignActive = false;
      this.campaignBattle = false;
      this.skirmish = null;
      this.report = null;
      this.mapSelect = null;
      this.portTab = "ships";
      this.pages = { market: 0, stock: 0 };
      this.confirmNew = false;
      try {
        const saved = platform.load && platform.load();
        if (saved && campaign.valid(saved.campaign)) this.campaign = saved.campaign;
      } catch (_) {}
      this.screen = "menu";
    }

    // ── persistence ────────────────────────────────────────────────────
    save() {
      try {
        // While campaigning, this.fleets mirrors the campaign fleet; the
        // skirmish setup the player built earlier is what belongs on disk.
        const free = this.skirmish || { fleets: this.fleets, loadouts: this.loadouts };
        if (this.p.save)
          this.p.save({
            version: 2,
            fleets: free.fleets,
            loadouts: free.loadouts,
            sound: this.sound,
            campaign: this.campaign,
          });
      } catch (_) {}
    }

    // ── mode switching ─────────────────────────────────────────────────
    enterCampaign(fresh) {
      if (fresh || !this.campaign) this.campaign = campaign.create(Date.now());
      if (!this.skirmish) this.skirmish = { fleets: this.fleets, loadouts: this.loadouts };
      this.campaignActive = true;
      this.confirmNew = false;
      this.report = null;
      this.mapSelect = null;
      this.syncFleet();
      this.save();
      super.setScreen("map");
    }
    leaveCampaign() {
      if (this.skirmish) {
        this.fleets = this.skirmish.fleets;
        this.loadouts = this.skirmish.loadouts;
        this.skirmish = null;
      }
      this.campaignActive = false;
      this.campaignBattle = false;
      this.battle = null;
      this.selected = this.fleets[0][0];
      this.team = 0;
      this.slot = 0;
      this.save();
      super.setScreen("menu");
    }
    // The battle and refit code read this.fleets / this.loadouts; keep them a
    // mirror of the campaign fleet.
    syncFleet(enemy) {
      const state = this.campaign;
      this.fleets = [state.fleet.map((s) => s.typeId), enemy || ["xia"]];
      this.loadouts = {};
      state.fleet.forEach((s, i) => (this.loadouts["0-" + i] = copy(s.loadout)));
      this.team = 0;
      this.slot = clamp(this.slot || 0, 0, state.fleet.length - 1);
    }
    setScreen(screen) {
      // The combat UI sends the player "back to the hangar"; on campaign that
      // means leaving the engagement.
      if (this.campaignActive && screen === "hangar") {
        if (this.campaignBattle && this.battle && this.battle.time > 0 && !this.report)
          this.finishCampaignBattle(true);
        else if (this.campaignBattle && !this.report) {
          campaign.withdraw(this.campaign);
          this.campaignBattle = false;
          this.notify("已脱离接触，返回上一处");
        }
        this.paused = false;
        this.syncFleet();
        this.save();
        return super.setScreen("map");
      }
      return super.setScreen(screen);
    }

    // ── battle bridge ──────────────────────────────────────────────────
    engage() {
      const state = this.campaign;
      if (!state.encounter) return;
      this.syncFleet(state.encounter.fleet);
      this.roster = state.fleet.map((s) => s.uid);
      this.report = null;
      this.campaignBattle = true;
      this.prepare(false);
      if (!this.battle || this.screen !== "deploy") {
        this.campaignBattle = false;
        return;
      }
      // Damage carried over from earlier fights.
      state.fleet.forEach((s, i) => {
        const ship = this.battle.ships.find((b) => b.id === "0-" + i);
        if (ship) ship.hp = Math.max(1, ship.maxHp * s.hull);
      });
    }
    finishCampaignBattle(abandoned) {
      const b = this.battle,
        ships = this.roster.map((uid, i) => {
          const ship = b.ships.find((s) => s.id === "0-" + i);
          return {
            uid,
            status: ship ? ship.status : "reserve",
            hull: ship ? ship.hp / ship.maxHp : 1,
          };
        });
      this.report = campaign.resolveBattle(this.campaign, {
        winner: abandoned ? 1 : b.winner,
        ships,
        destroyed: b.ships
          .filter((s) => s.team === 1 && s.status === "destroyed")
          .map((s) => s.typeId),
      });
      this.report.abandoned = !!abandoned;
      this.campaignBattle = false;
      this.syncFleet();
      this.save();
    }
    closeReport() {
      this.report = null;
      this.battle = null;
      this.paused = false;
      this.mapSelect = null;
      super.setScreen("map");
    }
    frame(dt) {
      super.frame(dt);
      if (
        this.campaignActive &&
        this.campaignBattle &&
        this.battle &&
        this.battle.status === "finished" &&
        !this.report
      ) {
        this.finishCampaignBattle(false);
        this.draw();
      }
    }
    drawResults() {
      if (!this.campaignActive) return super.drawResults();
      // The report is computed right after the frame that ends the battle.
      if (this.report) this.drawReport();
    }

    // ── refit with inventory ───────────────────────────────────────────
    openRefit(slot) {
      this.syncFleet();
      this.team = 0;
      this.slot = slot;
      this.refit();
    }
    refitCompatible() {
      const all = super.refitCompatible();
      if (!this.campaignActive) return all;
      const mountedId = this.refitWeapon(this.refitMount()).id;
      return all.filter(
        (w) => w.id === mountedId || this.campaign.inventory[w.id] > 0,
      );
    }
    applyRefit(fit, message, remember = true) {
      if (this.campaignActive) {
        const result = campaign.applyFit(this.campaign, this.slot, fit);
        if (!result.ok) {
          this.refitState.message = result.reason;
          return false;
        }
      }
      return super.applyRefit(fit, message, remember);
    }

    // ── drawing: dispatcher ────────────────────────────────────────────
    drawScreen() {
      if (!SCREENS.includes(this.screen)) return false;
      this.drawSpace(true);
      if (this.screen === "menu") this.drawMenu();
      else if (this.screen === "map") this.drawMap();
      else this.drawPort();
      return true;
    }
    drawHangar() {
      super.drawHangar();
      if (this.campaignActive || this.modal) return;
      // Skirmish needs a way back to the title screen.
      const sound = this.buttons.find((b) => String(b.label || "").startsWith("声音"));
      if (sound)
        this.button("‹ 主菜单", sound.x - 84, sound.y, 76, sound.h, () => super.setScreen("menu"), { size: 12 });
    }
    wrap(value, x, y, width, size, color, lineHeight, maxLines) {
      const per = Math.max(4, Math.floor(width / size)),
        text = String(value);
      let line = 0;
      for (let i = 0; i < text.length && line < (maxLines || 9); i += per, line++)
        this.text(text.slice(i, i + per), x, y + line * (lineHeight || size + 6), size, color);
      return line;
    }
    panel(x, y, w, h, stroke) {
      this.chamferRect(x, y, w, h, P.panel, stroke || P.line, 6);
    }
    header(title, back) {
      const s = this.safe,
        state = this.campaign,
        right = this.headerRight(12);
      this.rect(s.left, s.top, s.right - s.left, 46, "#07131ae6");
      let x = s.left + 14;
      if (back) {
        this.button(back.label, x, s.top + 5, 82, 36, back.fn, { size: 12 });
        x += 92;
      }
      this.text(title, x, s.top + 24, 17, P.text, "left", 600);
      const info = "星币 " + money(state.credits) + "   ·   第 " + state.day + " 日";
      this.text(info, right, s.top + 24, 13, P.gold, "right", 500);
      return s.top + 46;
    }

    // ── menu ───────────────────────────────────────────────────────────
    drawMenu() {
      const s = this.safe,
        cx = (s.left + s.right) / 2,
        h = s.bottom - s.top,
        compact = h < 460;
      this.text("星宿演武", cx, s.top + h * (compact ? 0.17 : 0.2), compact ? 38 : 52, P.text, "center", 700);
      this.mono("STAR MANSIONS · FLEET COMMAND", cx, s.top + h * (compact ? 0.17 : 0.2) + (compact ? 34 : 46), 11, P.mint, "center");
      const bw = Math.min(300, s.right - s.left - 60),
        bh = compact ? 46 : 54,
        gap = compact ? 10 : 14,
        items = [];
      if (this.campaign)
        items.push(["继续征途 · 第 " + this.campaign.day + " 日", () => this.enterCampaign(false), { cta: true }]);
      items.push([
        this.campaign ? (this.confirmNew ? "再点一次：放弃旧档重新开始" : "新的征途") : "踏上征途",
        () => {
          if (this.campaign && !this.confirmNew) this.confirmNew = true;
          else this.enterCampaign(true);
        },
        this.campaign ? { danger: this.confirmNew } : { cta: true },
      ]);
      items.push(["自由演武", () => super.setScreen("hangar"), {}]);
      items.push([this.sound ? "声音 开" : "声音 关", () => { this.sound = !this.sound; this.save(); }, {}]);
      let y = s.top + h * (compact ? 0.4 : 0.42);
      for (const [label, fn, opts] of items) {
        this.button(label, cx - bw / 2, y, bw, bh, fn, Object.assign({ size: 15 }, opts));
        y += bh + gap;
      }
      this.text("征途：从一艘虾兵级起家，打劫险地、逛市场、扩编舰队，最终讨平归墟。", cx, s.bottom - 16, 11, P.dim, "center");
    }

    // ── star map ───────────────────────────────────────────────────────
    drawMap() {
      const s = this.safe,
        state = this.campaign,
        top = this.header("星图", { label: "‹ 主菜单", fn: () => this.leaveCampaign() }),
        W = s.right - s.left,
        H = s.bottom - top,
        panelW = clamp(W * 0.32, 220, 320),
        area = { x: s.left + 8, y: top + 8, w: W - panelW - 24, h: H - 16 },
        scale = Math.min(area.w / 1000, area.h / 560),
        ox = area.x + (area.w - 1000 * scale) / 2,
        oy = area.y + (area.h - 560 * scale) / 2,
        at = (n) => ({ x: ox + n.x * scale, y: oy + n.y * scale }),
        here = state.location,
        chosen = campaign.node(this.mapSelect) ? this.mapSelect : here;

      for (const [a, b] of campaign.LINKS) {
        const p = at(campaign.node(a)),
          q = at(campaign.node(b)),
          open = a === here || b === here;
        this.line(p.x, p.y, q.x, q.y, open ? "#5fa79a" : "#22363f", open ? 1.6 : 1);
      }
      for (const n of campaign.NODES) {
        const p = at(n),
          hostile = campaign.hostile(state, n.id),
          color = n.kind === "port" ? P.mint : n.kind === "boss" ? P.gold : hostile ? P.red : P.dim,
          r = n.kind === "boss" ? 11 : n.kind === "port" ? 9 : 7;
        if (n.id === chosen) this.bracket(p.x - 20, p.y - 20, 40, 40, P.gold, 7);
        this.circle(p.x, p.y, r + 4, color + "55");
        this.circle(p.x, p.y, r, color, n.kind === "port" ? "#12303a" : "#1a1418", 2);
        if (n.kind !== "port")
          this.text(hostile ? "!" : "✓", p.x, p.y + 0.5, 10, color, "center", 700);
        this.text(n.name, p.x, p.y + r + 13, 11, n.id === here ? P.text : P.muted, "center", n.id === here ? 600 : 400);
        if (n.id === here) {
          const pulse = 4 + Math.sin(this.clock * 4) * 2;
          this.circle(p.x, p.y, r + 9 + pulse, P.mint + "aa", null, 1.5);
          this.shipImage(state.fleet[0].typeId, p.x + 22, p.y - 18, 30, -Math.PI / 2);
        }
        this.hit(p.x - 24, p.y - 24, 48, 52, () => (this.mapSelect = n.id), { role: "map-node", node: n.id });
      }

      // ── side panel ──
      const px = s.right - panelW - 8,
        py = top + 8,
        ph = H - 16,
        n = campaign.node(chosen),
        tx = px + 14,
        tw = panelW - 28;
      this.panel(px, py, panelW, ph);
      this.text(n.name, tx, py + 24, 19, P.text, "left", 600);
      this.text(KIND[n.kind] + " · " + TECH[n.tech], px + panelW - 14, py + 25, 11, n.kind === "port" ? P.mint : P.red, "right");
      let y = py + 48;
      if (n.kind !== "port") {
        this.text("危险度 " + "◆".repeat(n.danger) + "◇".repeat(5 - n.danger), tx, y, 11, P.gold);
        y += 20;
      }
      y += this.wrap(n.desc, tx, y, tw, 12, P.muted, 18, 3) * 18 + 6;

      const actionY = py + ph - 58;
      if (chosen === here) {
        if (n.kind === "port") {
          this.button("进入港口", tx, actionY, tw, 46, () => this.openPort("ships"), { cta: true, size: 15 });
        } else
          this.text(campaign.hostile(state, here) ? "敌舰队仍盘踞此处" : "此处已肃清，数日后会有新的匪帮", tx, actionY + 22, 11, P.dim);
      } else if (campaign.linked(here, chosen)) {
        const hostile = campaign.hostile(state, chosen);
        this.text("航程 " + campaign.travelDays(here, chosen) + " 日" + (hostile ? " · 抵达即遭遇敌舰队" : ""), tx, actionY - 14, 11, hostile ? P.red : P.muted);
        this.button("启航", tx, actionY, tw, 46, () => this.sail(chosen), { cta: true, size: 15 });
      } else this.text("没有直达航线，先前往相邻星域", tx, actionY + 22, 11, P.dim);

      // fleet summary, tappable to open the dockyard view
      const fy = actionY - 30 - 58;
      if (fy > y + 4) {
        this.text("舰队 " + campaign.fleetCost(state) + "/" + campaign.BUDGET + " DP", tx, fy - 2, 10, P.dim);
        const cell = Math.min(52, tw / 4);
        state.fleet.forEach((ship, i) => {
          const cx = tx + cell * i + cell / 2;
          this.shipImage(ship.typeId, cx, fy + 28, cell * 0.8, -Math.PI / 2);
          this.rect(cx - cell * 0.36, fy + 50, cell * 0.72, 3, "#253543");
          this.rect(cx - cell * 0.36, fy + 50, cell * 0.72 * ship.hull, 3, ship.hull > 0.4 ? P.mint : P.red);
        });
        this.hit(tx, fy - 8, tw, 64, () => this.openPort("dock"), { role: "map-fleet" });
      }

      if (state.bossDefeated)
        this.text("归墟已平 · 你可以继续游历", area.x + 10, area.y + area.h - 10, 11, P.gold);
      if (this.report) this.drawReport();
      else if (state.encounter) this.drawEncounter();
    }
    sail(to) {
      const result = campaign.travel(this.campaign, to);
      if (!result.ok) return this.notify(result.reason);
      this.mapSelect = null;
      this.play("system", 0.35);
      this.save();
    }
    drawEncounter() {
      const e = this.campaign.encounter,
        n = campaign.node(e.node),
        w = Math.min(460, this.width - 40),
        h = Math.min(270, this.height - 30),
        x = (this.width - w) / 2,
        y = (this.height - h) / 2;
      this.rect(0, 0, this.width, this.height, "#030b12c8");
      this.buttons = [];
      this.chamferRect(x, y, w, h, "#0b1c29f7", P.red, 8);
      this.mono("HOSTILE CONTACT", this.width / 2, y + 22, 11, P.red, "center");
      this.text(n.kind === "boss" ? "妖王旗舰编队" : n.name + " · 敌舰队", this.width / 2, y + 50, 20, P.text, "center", 600);
      const cell = Math.min(92, (w - 40) / e.fleet.length);
      e.fleet.forEach((id, i) => {
        const cx = this.width / 2 + (i - (e.fleet.length - 1) / 2) * cell;
        this.shipImage(id, cx, y + 108, Math.min(64, cell * 0.8), Math.PI / 2);
        this.text(catalog.getShip(id).name, cx, y + 150, 11, P.muted, "center");
      });
      const mine = campaign.fleetCost(this.campaign),
        theirs = e.fleet.reduce((sum, id) => sum + catalog.getShip(id).cost, 0);
      this.text("敌方 " + theirs + " DP  对  我方 " + mine + " DP   ·   悬赏 " + money(e.bounty) + " 星币", this.width / 2, y + 176, 12, theirs > mine * 1.3 ? P.red : P.gold, "center");
      const bw = (w - 54) / 2;
      this.button("撤退", x + 22, y + h - 62, bw, 46, () => {
        campaign.withdraw(this.campaign);
        this.save();
        this.notify("已撤回上一处");
      }, { size: 15 });
      this.button("迎战", x + 32 + bw, y + h - 62, bw, 46, () => this.engage(), { cta: true, size: 15 });
    }
    drawReport() {
      const r = this.report,
        w = Math.min(480, this.width - 40),
        h = Math.min(290, this.height - 24),
        x = (this.width - w) / 2,
        y = (this.height - h) / 2,
        cx = this.width / 2;
      this.rect(0, 0, this.width, this.height, "#030b12d0");
      this.buttons = [];
      this.chamferRect(x, y, w, h, "#0b1c29f7", r.victory ? P.mint : P.red, 8);
      this.mono("AFTER ACTION", cx, y + 22, 11, r.victory ? P.mint : P.red, "center");
      this.text(
        r.boss ? "归墟已平" : r.victory ? "大获全胜" : r.abandoned ? "脱离战斗" : r.wiped ? "舰队全灭" : "败退",
        cx, y + 56, 28, r.victory ? P.mint : P.red, "center", 600,
      );
      let ty = y + 96;
      const row = (label, value, color) => {
        this.text(label, x + 30, ty, 12, P.muted);
        this.text(value, x + w - 30, ty, 12, color || P.text, "right");
        ty += 24;
      };
      if (r.victory) row("悬赏", "+" + money(r.credits) + " 星币", P.gold);
      if (r.salvage.length) {
        const counts = {};
        for (const id of r.salvage) counts[id] = (counts[id] || 0) + 1;
        const names = Object.keys(counts).map((id) => catalog.getWeapon(id).name + (counts[id] > 1 ? "×" + counts[id] : ""));
        row("打捞", names.slice(0, 4).join("、") + (names.length > 4 ? " 等" : ""), P.blue);
      } else if (r.victory) row("打捞", "一无所获");
      if (r.lost.length) row("损失", r.lost.join("、"), P.red);
      if (r.wiped) row("保险理赔", "天枢港补发赤螯一艘，扣除 " + money(r.insurance) + " 星币", P.gold);
      if (r.boss) row("战果", "妖王伏诛，星域暂得安宁", P.gold);
      if (!r.victory && !r.wiped) row("去向", "残部退回上一处", P.muted);
      this.button("返回星图", x + 30, y + h - 62, w - 60, 46, () => this.closeReport(), { cta: true, size: 15 });
    }

    // ── port ───────────────────────────────────────────────────────────
    openPort(tab) {
      this.portTab = tab;
      this.pages = { market: 0, stock: 0 };
      this.syncFleet();
      super.setScreen("port");
    }
    trade(result, done) {
      if (!result.ok) return this.notify(result.reason);
      this.play("ui", 0.4);
      this.syncFleet();
      this.save();
      if (done) this.notify(done);
    }
    drawPort() {
      const s = this.safe,
        state = this.campaign,
        here = campaign.node(state.location),
        docked = here.kind === "port",
        top = this.header(docked ? here.name : "舰队", { label: "‹ 星图", fn: () => super.setScreen("map") }),
        tabs = docked ? [["ships", "舰船市场"], ["weapons", "武器市场"], ["dock", "船坞"]] : [["dock", "舰队"]];
      if (!docked) this.portTab = "dock";
      const tw = Math.min(120, (s.right - s.left - 28) / tabs.length - 6);
      tabs.forEach(([id, label], i) =>
        this.button(label, s.left + 14 + i * (tw + 6), top + 6, tw, 34, () => { this.portTab = id; }, { active: this.portTab === id, size: 12 }),
      );
      const box = { x: s.left + 14, y: top + 48, w: s.right - s.left - 28, h: s.bottom - top - 56 };
      if (this.portTab === "ships") this.drawShipMarket(box);
      else if (this.portTab === "weapons") this.drawWeaponMarket(box);
      else this.drawDock(box, docked);
    }
    drawShipMarket(box) {
      const state = this.campaign,
        offers = campaign.market(state).ships;
      if (!offers.length) {
        this.text("本港舰船已售空，过几日再来", box.x + box.w / 2, box.y + box.h / 2, 13, P.dim, "center");
        return;
      }
      const gap = 10,
        cw = (box.w - gap * 2) / 3,
        short = box.h < 300;
      offers.forEach((offer, i) => {
        const d = catalog.getShip(offer.typeId),
          x = box.x + i * (cw + gap),
          afford = state.credits >= offer.price;
        this.panel(x, box.y, cw, box.h);
        const img = Math.min(cw * 0.5, box.h * (short ? 0.34 : 0.4));
        this.shipImage(d.id, x + cw / 2, box.y + img / 2 + 10, img, -Math.PI / 2);
        let y = box.y + img + 22;
        this.text(d.name, x + 12, y, 16, P.text, "left", 600);
        this.text(d.cost + " DP", x + cw - 12, y, 12, P.gold, "right");
        y += 18;
        this.text(d.hullClass + "舰 · " + d.className + " · " + d.tech + " · " + d.role, x + 12, y, 10, P.muted);
        y += 17;
        this.text("结构 " + d.hull + "  装甲 " + d.armor + "  航速 " + d.movement.maxSpeed, x + 12, y, 10, P.dim);
        this.button(money(offer.price) + " 星币  购买", x + 10, box.y + box.h - 50, cw - 20, 40,
          () => this.trade(campaign.buyShip(state, i), d.name + "已编入舰队"),
          { cta: afford, disabled: !afford, size: 12 });
      });
    }
    weaponLine(w) {
      return SIZE[w.size] + TYPE[w.type] + " · " + DAMAGE[w.damageType] + " · 射程 " + w.range;
    }
    drawWeaponMarket(box) {
      const state = this.campaign,
        m = campaign.market(state),
        gap = 12,
        cw = (box.w - gap) / 2,
        rowH = 44,
        per = Math.max(1, Math.floor((box.h - 34) / rowH)),
        columns = [
          { key: "market", title: "市场货架", x: box.x, ids: Object.keys(m.weapons), buy: true },
          { key: "stock", title: "我的库存", x: box.x + cw + gap, ids: Object.keys(state.inventory), buy: false },
        ];
      for (const col of columns) {
        this.panel(col.x, box.y, cw, box.h);
        const pages = Math.max(1, Math.ceil(col.ids.length / per)),
          page = (this.pages[col.key] = clamp(this.pages[col.key], 0, pages - 1));
        this.text(col.title, col.x + 12, box.y + 16, 12, P.muted, "left", 600);
        if (pages > 1) {
          this.text(page + 1 + "/" + pages, col.x + cw - 84, box.y + 16, 10, P.dim, "right");
          this.button("‹", col.x + cw - 78, box.y + 2, 34, 28, () => { this.pages[col.key] = page - 1; }, { disabled: page === 0, size: 14 });
          this.button("›", col.x + cw - 40, box.y + 2, 34, 28, () => { this.pages[col.key] = page + 1; }, { disabled: page >= pages - 1, size: 14 });
        }
        if (!col.ids.length)
          this.text(col.buy ? "货架已空" : "库存为空，战利品和买来的武器会放在这里", col.x + 12, box.y + 52, 11, P.dim);
        col.ids.slice(page * per, page * per + per).forEach((id, i) => {
          const w = catalog.getWeapon(id),
            y = box.y + 32 + i * rowH,
            count = col.buy ? m.weapons[id] : state.inventory[id],
            price = col.buy ? campaign.weaponPrice(id) : campaign.weaponSellPrice(id),
            afford = !col.buy || state.credits >= price;
          this.line(col.x + 8, y, col.x + cw - 8, y, "#1b2c36");
          this.weaponArt(w, col.x + 6, y + 3, 40, rowH - 6);
          this.text(w.name + "  ×" + count, col.x + 50, y + 14, 13, P.text, "left", 500);
          this.text(this.weaponLine(w), col.x + 50, y + 31, 10, P.dim);
          this.button((col.buy ? "买 " : "卖 ") + money(price), col.x + cw - 92, y + 5, 84, rowH - 10,
            () => this.trade(col.buy ? campaign.buyWeapon(state, id) : campaign.sellWeapon(state, id)),
            { cta: col.buy && afford, disabled: !afford, size: 11 });
        });
      }
    }
    drawDock(box, docked) {
      const state = this.campaign,
        rowH = Math.min(70, (box.h - (docked ? 46 : 4)) / campaign.MAX_FLEET),
        bh = Math.min(40, rowH - 14);
      state.fleet.forEach((ship, i) => {
        const d = catalog.getShip(ship.typeId),
          y = box.y + i * rowH,
          cost = campaign.repairCost(ship);
        this.panel(box.x, y, box.w, rowH - 6, i === 0 ? P.gold : P.line);
        this.shipImage(d.id, box.x + rowH / 2, y + (rowH - 6) / 2, rowH - 14, -Math.PI / 2);
        const tx = box.x + rowH + 4;
        this.text(d.name + (i === 0 ? "  旗舰" : ""), tx, y + (rowH - 6) / 2 - 9, 14, P.text, "left", 600);
        this.text(d.hullClass + "舰 · " + d.className + " · " + d.cost + " DP · 结构 " + Math.round(ship.hull * 100) + "%", tx, y + (rowH - 6) / 2 + 10, 10, ship.hull > 0.4 ? P.muted : P.red);
        const buttons = [["配装", () => this.openRefit(i), {}]];
        if (i > 0) buttons.push(["设为旗舰", () => { campaign.setFlagship(state, i); this.trade({ ok: true }); }, {}]);
        if (docked) {
          buttons.push([cost ? "维修 " + money(cost) : "完好", () => this.trade(campaign.repair(state, i)), { disabled: !cost || state.credits < cost }]);
          buttons.push(["出售 " + money(campaign.shipSellPrice(ship)), () => this.trade(campaign.sellShip(state, i), "已出售，舰上武器转入库存"), { danger: true, disabled: state.fleet.length <= 1 }]);
        }
        const bw = Math.min(96, (box.w - rowH - 150) / buttons.length - 6);
        buttons.forEach(([label, fn, opts], k) =>
          this.button(label, box.x + box.w - 8 - (buttons.length - k) * (bw + 6) + 6, y + (rowH - 6 - bh) / 2, bw, bh, fn, Object.assign({ size: 11 }, opts)),
        );
      });
      if (docked) {
        const total = state.fleet.reduce((sum, s) => sum + campaign.repairCost(s), 0);
        this.text("舰队 " + state.fleet.length + "/" + campaign.MAX_FLEET + " 艘 · " + campaign.fleetCost(state) + "/" + campaign.BUDGET + " DP", box.x + 4, box.y + box.h - 20, 11, P.dim);
        this.button(total ? "全部维修 " + money(total) : "全舰完好", box.x + box.w - 170, box.y + box.h - 40, 170, 38,
          () => this.trade(campaign.repair(state)), { cta: !!total && state.credits >= total, disabled: !total || state.credits < total, size: 12 });
      } else this.text("离港期间只能调整配装与旗舰；维修和买卖需要进港", box.x + 4, box.y + box.h - 12, 11, P.dim);
    }
  }
  return { GameUI };
});

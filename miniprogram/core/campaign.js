(function (root, factory) {
  if (typeof module === "object" && module.exports)
    module.exports = factory(require("./ships"), require("./combat"));
  else root.StarCampaign = factory(root.StarShips, root.StarCombat);
})(typeof globalThis !== "undefined" ? globalThis : this, function (
  catalog,
  combat,
) {
  "use strict";
  // Campaign rules only: star map, encounters, battle aftermath, markets and
  // the weapon inventory. No drawing and no platform calls, so every rule here
  // can be exercised from Node. All randomness comes from state.rng.
  const VERSION = 1,
    MAX_FLEET = 4,
    BUDGET = 100,
    HOME = "tianshu",
    RESTOCK_DAYS = 5,
    RESPAWN_DAYS = 6;

  // Map space is 1000 × 560; the screen scales it to fit.
  const NODES = [
    { id: "tianshu", name: "天枢港", kind: "port", tech: "mid", danger: 0, x: 150, y: 300, desc: "天庭水师的母港。航道安全，货色中规中矩。" },
    { id: "yaoguang", name: "瑶光集", kind: "port", tech: "low", danger: 0, x: 330, y: 130, desc: "走私贩与旧铁匠的集市，实弹与导弹最全。" },
    { id: "suixing", name: "碎星带", kind: "wild", tech: "low", danger: 1, x: 320, y: 420, desc: "散兵游勇在陨石间打劫商船，适合练手。" },
    { id: "chiyan", name: "赤焰残骸", kind: "wild", tech: "low", danger: 2, x: 500, y: 250, desc: "古战场的残骸群，虾兵蟹将在此拾荒。" },
    { id: "kaiyang", name: "开阳坞", kind: "port", tech: "low", danger: 0, x: 520, y: 470, desc: "龙宫旧部经营的重型船坞，出售蟹将级。" },
    { id: "heishui", name: "黑水星云", kind: "wild", tech: "mid", danger: 3, x: 560, y: 80, desc: "能见度极低，叛逃的天兵在云中设伏。" },
    { id: "tianquan", name: "天权站", kind: "port", tech: "mid", danger: 0, x: 700, y: 330, desc: "前线补给站，天兵级与制式装备供应充足。" },
    { id: "canglang", name: "苍狼裂隙", kind: "wild", tech: "mid", danger: 4, x: 740, y: 150, desc: "妖族主力舰队的巡逻线，没有重舰不要进入。" },
    { id: "youming", name: "幽冥航道", kind: "wild", tech: "high", danger: 4, x: 840, y: 460, desc: "失控的星宿级在此游荡，能量武器的宝库。" },
    { id: "yuheng", name: "玉衡台", kind: "port", tech: "high", danger: 0, x: 880, y: 250, desc: "星宿工坊所在，只卖高科技舰船与能量武器。" },
    { id: "guixu", name: "归墟", kind: "boss", tech: "high", danger: 5, x: 950, y: 80, desc: "万川归处。盘踞着妖王的旗舰编队。" },
  ];
  const LINKS = [
    ["tianshu", "yaoguang"],
    ["tianshu", "suixing"],
    ["yaoguang", "chiyan"],
    ["suixing", "chiyan"],
    ["suixing", "kaiyang"],
    ["yaoguang", "heishui"],
    ["chiyan", "tianquan"],
    ["kaiyang", "tianquan"],
    ["heishui", "canglang"],
    ["tianquan", "canglang"],
    ["tianquan", "youming"],
    ["tianquan", "yuheng"],
    ["youming", "yuheng"],
    ["canglang", "guixu"],
    ["yuheng", "guixu"],
  ];
  const ENEMY_BUDGET = [0, 10, 24, 42, 64, 90];
  const BOSS_FLEET = ["fuyue", "xie", "tieao", "xia"];
  const TECH_OF = { 低科技: "low", 中科技: "mid", 高科技: "high" };

  const node = (id) => NODES.find((n) => n.id === id);
  const linked = (a, b) =>
    LINKS.some(([p, q]) => (p === a && q === b) || (p === b && q === a));
  const neighbors = (id) =>
    LINKS.filter((l) => l.includes(id)).map(([p, q]) => (p === id ? q : p));
  const travelDays = (a, b) =>
    Math.max(1, Math.round(Math.hypot(node(a).x - node(b).x, node(a).y - node(b).y) / 110));

  function random(state) {
    state.rng = (Math.imul(state.rng, 1664525) + 1013904223) >>> 0;
    return state.rng / 4294967296;
  }
  const pick = (state, list) => list[Math.floor(random(state) * list.length)];

  // ── prices ────────────────────────────────────────────────────────────
  const shipPrice = (typeId) => {
    const cost = catalog.getShip(typeId).cost;
    return Math.round((cost * 420 + cost * cost * 8) / 50) * 50;
  };
  const weaponPrice = (id) => catalog.getWeapon(id).op * 180;
  const shipSellPrice = (ship) =>
    Math.round((shipPrice(ship.typeId) * 0.5 * (0.4 + 0.6 * ship.hull)) / 50) * 50;
  const weaponSellPrice = (id) => Math.round(weaponPrice(id) * 0.5);
  const repairCost = (ship) =>
    Math.ceil((shipPrice(ship.typeId) * 0.25 * (1 - ship.hull)) / 10) * 10;

  // ── fleet helpers ─────────────────────────────────────────────────────
  function newShip(state, typeId) {
    return {
      uid: ++state.shipSeq,
      typeId,
      hull: 1,
      loadout: { weapons: {}, vents: 0, capacitors: 0 },
    };
  }
  // Every mount always holds a weapon: the fitted one, else the factory default.
  function mounted(ship) {
    const def = catalog.getShip(ship.typeId),
      out = {};
    for (const m of def.mounts)
      out[m.id] = (ship.loadout.weapons || {})[m.id] || m.defaultWeapon;
    return out;
  }
  const fleetCost = (state) =>
    state.fleet.reduce((sum, s) => sum + catalog.getShip(s.typeId).cost, 0);
  function stock(state, id, delta) {
    const next = (state.inventory[id] || 0) + delta;
    if (next > 0) state.inventory[id] = next;
    else delete state.inventory[id];
  }

  function create(seed) {
    const state = {
      version: VERSION,
      rng: (seed >>> 0) || 20261011,
      day: 1,
      credits: 6000,
      location: HOME,
      previous: HOME,
      shipSeq: 0,
      fleet: [],
      inventory: {},
      markets: {},
      cleared: {},
      encounter: null,
      bossDefeated: false,
      kills: 0,
    };
    state.fleet.push(newShip(state, "xia"));
    return state;
  }
  function valid(state) {
    return !!(
      state &&
      state.version === VERSION &&
      Array.isArray(state.fleet) &&
      state.fleet.length &&
      state.fleet.every((s) => catalog.getShip(s.typeId)) &&
      node(state.location)
    );
  }

  // ── travel and encounters ─────────────────────────────────────────────
  function enemyFleet(state, target) {
    if (target.kind === "boss") return BOSS_FLEET.slice();
    const budget = ENEMY_BUDGET[target.danger],
      fleet = [];
    let left = budget;
    // Local tech is favoured so each region fights differently.
    const weight = (s) => (TECH_OF[s.tech] === target.tech ? 3 : 1);
    while (fleet.length < MAX_FLEET) {
      const options = catalog.SHIPS.filter((s) => s.cost <= left);
      if (!options.length) break;
      const pool = [];
      for (const s of options) for (let i = 0; i < weight(s); i++) pool.push(s);
      const chosen = pick(state, pool);
      fleet.push(chosen.id);
      left -= chosen.cost;
    }
    return fleet.length ? fleet : ["xia"];
  }
  function hostile(state, id) {
    const n = node(id);
    if (n.kind === "port") return false;
    if (n.kind === "boss") return !state.bossDefeated;
    return !(state.cleared[id] > state.day);
  }
  function travel(state, to) {
    if (state.encounter) return { ok: false, reason: "当前遭遇尚未解决" };
    if (!node(to) || !linked(state.location, to))
      return { ok: false, reason: "没有直达航线" };
    const days = travelDays(state.location, to);
    state.previous = state.location;
    state.location = to;
    state.day += days;
    if (hostile(state, to)) {
      const fleet = enemyFleet(state, node(to));
      state.encounter = {
        node: to,
        fleet,
        danger: node(to).danger,
        bounty: bounty(fleet, node(to).danger),
      };
    }
    return { ok: true, days, encounter: state.encounter };
  }
  function bounty(fleet, danger) {
    const cost = fleet.reduce((sum, id) => sum + catalog.getShip(id).cost, 0);
    return Math.round((cost * 160 * (1 + 0.15 * danger)) / 50) * 50;
  }
  // Declining a fight costs the trip but nothing else.
  function withdraw(state) {
    if (!state.encounter) return false;
    const days = travelDays(state.location, state.previous);
    state.location = state.previous;
    state.day += days;
    state.encounter = null;
    return true;
  }

  // outcome: { winner, ships: [{ uid, status, hull }], destroyed: [typeId] }
  // status is the battle status of each player ship; "reserve" means it never
  // entered the fight and keeps its previous hull.
  function resolveBattle(state, outcome) {
    const encounter = state.encounter,
      report = {
        victory: outcome.winner === 0,
        credits: 0,
        salvage: [],
        lost: [],
        wiped: false,
        boss: false,
        insurance: 0,
      };
    if (!encounter) return report;
    for (const result of outcome.ships || []) {
      const ship = state.fleet.find((s) => s.uid === result.uid);
      if (!ship) continue;
      if (result.status === "destroyed") {
        report.lost.push(catalog.getShip(ship.typeId).name);
        state.fleet.splice(state.fleet.indexOf(ship), 1);
      } else if (result.status !== "reserve")
        ship.hull = Math.max(0.05, Math.min(1, result.hull));
    }
    if (report.victory) {
      report.credits = encounter.bounty;
      state.credits += report.credits;
      state.kills += encounter.fleet.length;
      for (const typeId of outcome.destroyed || encounter.fleet)
        for (const m of catalog.getShip(typeId).mounts)
          if (random(state) < 0.3) {
            report.salvage.push(m.defaultWeapon);
            stock(state, m.defaultWeapon, 1);
          }
      if (node(encounter.node).kind === "boss") {
        state.bossDefeated = true;
        report.boss = true;
      } else state.cleared[encounter.node] = state.day + RESPAWN_DAYS;
    } else if (state.fleet.length) {
      // Survivors limp back the way they came.
      state.location = state.previous;
      state.day += 1;
    }
    if (!state.fleet.length) {
      // Total loss: the home port underwrites one frigate so the run continues.
      report.wiped = true;
      report.insurance = Math.round(state.credits * 0.3);
      state.credits -= report.insurance;
      state.fleet.push(newShip(state, "xia"));
      state.location = state.previous = HOME;
      state.day += 3;
    }
    state.encounter = null;
    return report;
  }

  // ── markets ───────────────────────────────────────────────────────────
  function market(state, id) {
    const port = node(id || state.location);
    if (!port || port.kind !== "port") return null;
    let m = state.markets[port.id];
    if (m && m.until > state.day) return m;
    const match = (tech) => tech === port.tech,
      shipPool = [];
    for (const s of catalog.SHIPS)
      for (let i = 0; i < (match(TECH_OF[s.tech]) ? 4 : 1); i++) shipPool.push(s.id);
    const ships = [];
    for (let i = 0; i < 3; i++) {
      const typeId = pick(state, shipPool);
      ships.push({
        typeId,
        price: Math.round((shipPrice(typeId) * (0.9 + random(state) * 0.25)) / 50) * 50,
      });
    }
    // Home always has a cheap hull so a broke commander is never stuck.
    if (port.id === HOME && !ships.some((s) => s.typeId === "xia"))
      ships[0] = { typeId: "xia", price: shipPrice("xia") };
    const favoured = { low: ["ballistic", "missile"], mid: ["ballistic", "energy", "missile"], high: ["energy"] }[port.tech],
      weapons = {};
    for (const w of catalog.WEAPONS) {
      const chance = favoured.includes(w.type) ? 0.8 : 0.25;
      if (random(state) < chance)
        weapons[w.id] = 1 + Math.floor(random(state) * (w.size === "large" ? 2 : 4));
    }
    m = state.markets[port.id] = { until: state.day + RESTOCK_DAYS, ships, weapons };
    return m;
  }
  function buyShip(state, index) {
    const m = market(state),
      offer = m && m.ships[index];
    if (!offer) return { ok: false, reason: "此处没有这艘船" };
    if (state.fleet.length >= MAX_FLEET)
      return { ok: false, reason: "舰队已满 " + MAX_FLEET + " 艘" };
    if (fleetCost(state) + catalog.getShip(offer.typeId).cost > BUDGET)
      return { ok: false, reason: "超出舰队部署上限 " + BUDGET + " DP" };
    if (state.credits < offer.price) return { ok: false, reason: "星币不足" };
    state.credits -= offer.price;
    state.fleet.push(newShip(state, offer.typeId));
    m.ships.splice(index, 1);
    return { ok: true };
  }
  function sellShip(state, slot) {
    const ship = state.fleet[slot];
    if (!ship || !market(state)) return { ok: false, reason: "只能在港口出售" };
    if (state.fleet.length <= 1) return { ok: false, reason: "不能卖掉最后一艘船" };
    const price = shipSellPrice(ship);
    // Fitted weapons come off the hull and stay with the commander.
    for (const id of Object.values(mounted(ship))) stock(state, id, 1);
    state.fleet.splice(slot, 1);
    state.credits += price;
    return { ok: true, price };
  }
  function buyWeapon(state, id) {
    const m = market(state);
    if (!m || !(m.weapons[id] > 0)) return { ok: false, reason: "已售罄" };
    const price = weaponPrice(id);
    if (state.credits < price) return { ok: false, reason: "星币不足" };
    state.credits -= price;
    if (--m.weapons[id] <= 0) delete m.weapons[id];
    stock(state, id, 1);
    return { ok: true };
  }
  function sellWeapon(state, id) {
    const m = market(state);
    if (!m) return { ok: false, reason: "只能在港口出售" };
    if (!(state.inventory[id] > 0)) return { ok: false, reason: "库存里没有" };
    stock(state, id, -1);
    m.weapons[id] = (m.weapons[id] || 0) + 1;
    state.credits += weaponSellPrice(id);
    return { ok: true };
  }
  function repair(state, slot) {
    if (!market(state)) return { ok: false, reason: "只能在港口维修" };
    const ships = slot === undefined ? state.fleet : [state.fleet[slot]].filter(Boolean),
      cost = ships.reduce((sum, s) => sum + repairCost(s), 0);
    if (!cost) return { ok: false, reason: "无需维修" };
    if (state.credits < cost) return { ok: false, reason: "星币不足" };
    state.credits -= cost;
    for (const s of ships) s.hull = 1;
    return { ok: true, cost };
  }
  function setFlagship(state, slot) {
    if (!state.fleet[slot]) return false;
    state.fleet.unshift(state.fleet.splice(slot, 1)[0]);
    return true;
  }

  // Refit with stock accounting: weapons leaving mounts return to inventory,
  // weapons going on must be owned. Flux upgrades are free dockyard work.
  function applyFit(state, slot, fit) {
    const ship = state.fleet[slot];
    if (!ship) return { ok: false, reason: "没有这艘船" };
    const check = combat.validateLoadout(ship.typeId, fit);
    if (!check.ok) return check;
    const before = mounted(ship),
      after = mounted({ typeId: ship.typeId, loadout: fit }),
      need = {};
    for (const mountId of Object.keys(after)) {
      if (after[mountId] === before[mountId]) continue;
      need[after[mountId]] = (need[after[mountId]] || 0) + 1;
      need[before[mountId]] = (need[before[mountId]] || 0) - 1;
    }
    for (const id of Object.keys(need))
      if (need[id] > (state.inventory[id] || 0))
        return { ok: false, reason: "库存没有" + catalog.getWeapon(id).name + "，先去市场购买" };
    for (const id of Object.keys(need)) stock(state, id, -need[id]);
    ship.loadout = JSON.parse(JSON.stringify(fit));
    return { ok: true };
  }

  return {
    VERSION,
    MAX_FLEET,
    BUDGET,
    HOME,
    NODES,
    LINKS,
    node,
    linked,
    neighbors,
    travelDays,
    create,
    valid,
    hostile,
    travel,
    withdraw,
    resolveBattle,
    market,
    buyShip,
    sellShip,
    buyWeapon,
    sellWeapon,
    repair,
    repairCost,
    setFlagship,
    applyFit,
    mounted,
    fleetCost,
    shipPrice,
    shipSellPrice,
    weaponPrice,
    weaponSellPrice,
  };
});

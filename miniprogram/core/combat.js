(function (root) {
  "use strict";
  const C =
    typeof module !== "undefined" && module.exports
      ? require("./ships.js")
      : root.StarShips;
  const Navigation =
    typeof module !== "undefined" && module.exports
      ? require("./navigation")
      : root.StarNavigation;
  const PI = Math.PI,
    TAU = 2 * PI,
    R = PI / 180,
    H = 1 / 60,
    clamp = (v, a, b) => Math.max(a, Math.min(b, v)),
    wrap = (a) => ((((a + PI) % TAU) + TAU) % TAU) - PI,
    approach = (v, t, d) => v + clamp(t - v, -d, d);
  function validateLoadout(typeId, l = {}) {
    const d = C.getShip(typeId);
    if (!d) return { ok: false, reason: "未知舰型", cost: 0 };
    let cost = 0;
    const upgrades = ["vents", "capacitors"];
    for (const k of upgrades) {
      const n = l[k] || 0;
      if (!Number.isInteger(n) || n < 0)
        return { ok: false, reason: "幅能升级必须是非负整数", cost };
      cost += n;
    }
    for (const id of Object.keys(l.weapons || {}))
      if (!d.mounts.some((m) => m.id === id))
        return { ok: false, reason: "未知炮位 " + id, cost };
    for (const m of d.mounts) {
      const w = C.getWeapon((l.weapons || {})[m.id] || m.defaultWeapon);
      if (!w || w.type !== m.type || w.size !== m.size)
        return {
          ok: false,
          reason: "炮位 " + m.id + " 的类型或尺寸不兼容",
          cost,
        };
      cost += w.op;
    }
    return {
      ok: cost <= d.op,
      reason: cost > d.op ? "装配超过 OP 预算" : "",
      cost,
    };
  }
  function event(s, type, ship, text, weapon, details = {}) {
    s.events.push(
      Object.assign(
        {
          seq: ++s.eventSeq,
          type,
          shipId: ship && ship.id,
          team: ship && ship.team,
          text,
          weapon,
          weaponId: weapon,
        },
        details,
      ),
    );
    if (s.events.length > 400) s.events.splice(0, s.events.length - 400);
  }
  function createBattle(left, right, seed = 1, options = {}) {
    const s = {
      ships: [],
      projectiles: [],
      beams: [],
      effects: [],
      events: [],
      eventSeq: 0,
      time: 0,
      status: "needsDeployment",
      winner: null,
      width: 4800,
      height: 3000,
      seed: seed >>> 0,
      accumulator: 0,
      projectileSeq: 0,
      pendingCommands: {},
    };
    [left, right].forEach((ids, team) => {
      if (!Array.isArray(ids) || ids.length < 1 || ids.length > 4)
        throw Error("每队需要 1–4 艘舰船");
      if (
        ids.reduce(
          (v, id) => v + (C.getShip(id) || { cost: Infinity }).cost,
          0,
        ) > 100
      )
        throw Error("编队超过 100 预算");
      ids.forEach((id, i) => {
        const d = C.getShip(id),
          iid = team + "-" + i,
          l = (options.loadouts || {})[iid] || {},
          valid = validateLoadout(id, l);
        if (!valid.ok) throw Error(valid.reason);
        const ship = Object.assign({}, d, {
          id: iid,
          typeId: id,
          team,
          status: "reserve",
          x: 2400 + (i - (ids.length - 1) / 2) * 550,
          y: team ? 650 : 2350,
          vx: 0,
          vy: 0,
          angle: team ? PI / 2 : -PI / 2,
          targetAngle: team ? PI / 2 : -PI / 2,
          angularVelocity: 0,
          thrust: { forward: 0, backward: 0, strafe: 0, turn: 0 },
          radius: Math.hypot(d.length, d.width) / 2,
          hp: d.hull,
          maxHp: d.hull,
          softFlux: 0,
          hardFlux: 0,
          maxFlux: d.fluxCapacity + (l.capacitors || 0) * 200,
          dissipation: d.fluxDissipation + (l.vents || 0) * 10,
          armor: Array(6).fill(d.armor),
          maxArmor: Array(6).fill(d.armor),
          shieldOn: true,
          shieldArc: d.shieldArc * R,
          shieldLevel: 0,
          overload: 0,
          venting: 0,
          systemTime: 0,
          systemCooldown: 0,
          autoGroups: [false, true, true],
          order: null,
          damageDealt: 0,
          kills: 0,
          targetId: null,
          turnSign: 1,
          turnSettled: false,
          aiTimer: 0,
          aiState: "advance",
          aiHold: 0,
          mounts: d.mounts.map((m) =>
            Object.assign({}, m, {
              angle: m.angle * R,
              arc: m.arc * R,
              weaponId: (l.weapons || {})[m.id] || m.defaultWeapon,
              aimAngle: (team ? PI / 2 : -PI / 2) + m.angle * R,
              cooldown: 0,
              ammo:
                C.getWeapon((l.weapons || {})[m.id] || m.defaultWeapon).ammo ||
                null,
            }),
          ),
        });
        s.ships.push(ship);
      });
    });
    if (options.deferred === false) {
      s.ships.forEach((p) => deployShip(s, p.id, p.x, p.y, p.angle));
      s.status = "running";
    }
    return s;
  }
  function deployShip(s, id, x, y, angle) {
    const p = s.ships.find((p) => p.id === id);
    if (angle === undefined && p) angle = p.team ? PI / 2 : -PI / 2;
    if (
      !p ||
      p.status !== "reserve" ||
      !Number.isFinite(x + y + angle) ||
      x < p.radius ||
      x > s.width - p.radius ||
      y < p.radius ||
      y > s.height - p.radius ||
      s.ships.some(
        (q) =>
          q.status === "active" &&
          Math.hypot(q.x - x, q.y - y) < q.radius + p.radius + 20,
      )
    )
      return false;
    Object.assign(p, { x, y, angle, targetAngle: angle, status: "active" });
    p.mounts.forEach((m) => (m.aimAngle = angle + m.angle));
    s.status = "running";
    return true;
  }
  function deployEnemy(s) {
    const stage = s.time === 0 ? "initial" : "reinforcement";
    for (const p of s.ships.filter(
      (p) => p.team === 1 && p.status === "reserve",
    )) {
      const position = Navigation.findPlacement(s, p.id, stage);
      if (position) deployShip(s, p.id, position.x, position.y, position.angle);
      else if (stage === "reinforcement") {
        p.status = "retreated";
        event(s, "retreat", p, "增援带失守，预备舰撤离");
      }
    }
  }
  function setOrder(s, id, order) {
    const p = s.ships.find((p) => p.id === id);
    if (
      !p ||
      p.status !== "active" ||
      !order ||
      !["move", "attack", "escort", "retreat"].includes(order.type)
    )
      return false;
    if (order.type === "move" && !Number.isFinite(order.x + order.y))
      return false;
    if (
      ["attack", "escort"].includes(order.type) &&
      !s.ships.some(
        (q) =>
          q.id === order.targetId &&
          q.status === "active" &&
          (order.type === "escort"
            ? q.team === p.team && q.id !== p.id
            : q.team !== p.team),
      )
    )
      return false;
    p.order = Object.assign({}, order);
    p.aiTimer = 0;
    return true;
  }
  function motionStep(p, c, dt) {
    const beforeVx = p.vx,
      beforeVy = p.vy,
      beforeTurn = p.angularVelocity;
    const m = p.movement,
      f = p.systemTime > 0 ? 0.4 : 1,
      restricted = p.venting > 0 ? 0.5 : 1;
    let target = Number.isFinite(c.aimAngle) ? c.aimAngle : p.targetAngle;
    p.targetAngle = target;
    let e = wrap(target - p.angle);
    if (Math.abs(Math.abs(e) - PI) < 1e-7) e = PI * p.turnSign;
    if (Math.abs(e) > 4 * R) p.turnSettled = false;
    if (Math.abs(e) < 2 * R && Math.abs(p.angularVelocity) < 0.5 * R)
      p.turnSettled = true;
    const a = m.turnAcceleration * R * f,
      limit = m.maxTurnRate * R * f;
    let desired = p.turnSettled
      ? 0
      : Math.sign(e) * Math.min(limit, Math.sqrt(2 * a * Math.abs(e)));
    const old = p.angularVelocity;
    p.angularVelocity = approach(old, desired, a * dt);
    p.angle = wrap(p.angle + (old + p.angularVelocity) * 0.5 * dt);
    if (Math.abs(e) > 0.001) p.turnSign = Math.sign(e);
    let mx = clamp(c.moveX || 0, -1, 1),
      my = clamp(c.moveY || 0, -1, 1),
      mag = Math.hypot(mx, my);
    if (mag > 1) {
      mx /= mag;
      my /= mag;
      mag = 1;
    }
    const max = m.maxSpeed * f * restricted;
    if (c.brake || mag < 0.001) {
      const v = Math.hypot(p.vx, p.vy),
        dv = m.deceleration * (c.brake ? 1 : 0.5) * dt;
      if (v > 0) {
        const k = Math.max(0, v - dv) / v;
        p.vx *= k;
        p.vy *= k;
      }
    } else {
      const co = Math.cos(p.angle),
        si = Math.sin(p.angle),
        dx = mx * max - p.vx,
        dy = my * max - p.vy,
        localX = dx * co + dy * si,
        localY = -dx * si + dy * co;
      const ax = clamp(
          localX / dt,
          -m.deceleration * f * restricted,
          m.acceleration * f * restricted,
        ),
        ay = clamp(
          localY / dt,
          -m.acceleration * m.strafeFactor * f * restricted,
          m.acceleration * m.strafeFactor * f * restricted,
        );
      p.vx += (ax * co - ay * si) * dt;
      p.vy += (ax * si + ay * co) * dt;
      const v = Math.hypot(p.vx, p.vy);
      if (v > max) {
        const k = Math.max(max, v - m.deceleration * dt) / v;
        p.vx *= k;
        p.vy *= k;
      }
    }
    // Actual body-frame acceleration drives jets, including braking and counter-turning.
    const ax =
      ((p.vx - beforeVx) * Math.cos(p.angle) +
        (p.vy - beforeVy) * Math.sin(p.angle)) /
      dt;
    const ay =
      (-(p.vx - beforeVx) * Math.sin(p.angle) +
        (p.vy - beforeVy) * Math.cos(p.angle)) /
      dt;
    p.thrust = {
      forward: clamp(ax / (m.acceleration * f * restricted), 0, 1),
      backward: clamp(-ax / (m.deceleration * f * restricted), 0, 1),
      strafe: clamp(
        ay / (m.acceleration * m.strafeFactor * f * restricted),
        -1,
        1,
      ),
      turn: clamp((p.angularVelocity - beforeTurn) / (a * dt), -1, 1),
    };
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  function impact(
    s,
    p,
    damage,
    type,
    x,
    y,
    shieldHit,
    armorHit,
    sourceId,
    weaponId,
    blocked = false,
  ) {
    const co = Math.cos(p.angle),
      si = Math.sin(p.angle),
      dx = x - p.x,
      dy = y - p.y,
      lx = dx * co + dy * si,
      ly = -dx * si + dy * co,
      nx = shieldHit ? lx : lx / (p.length * p.length),
      ny = shieldHit ? ly : ly / (p.width * p.width),
      normalAngle = Math.atan2(nx * si + ny * co, nx * co - ny * si),
      w = C.getWeapon(weaponId),
      data = {
        x,
        y,
        normalAngle,
        angle: normalAngle,
        shieldHit,
        armorHit,
        damageType: type,
        damage,
        targetId: p.id,
        sourceId,
        weaponId,
        blocked,
        shipId: p.id,
        radius: blocked ? 8 : w ? w.impactSize : 18,
        color: w ? w.effectColor : p.color,
      };
    event(s, "hit", p, blocked ? "友舰挡弹" : "武器命中", weaponId, data);
    s.effects.push(
      Object.assign({ kind: "hit", life: 0.22, maxLife: 0.22 }, data),
    );
    if (s.effects.length > 400) s.effects.splice(0, s.effects.length - 400);
  }
  function applyDamage(s, p, damage, type, hx, hy, beam, sourceId, weaponId) {
    if (p.status !== "active" || damage <= 0) return;
    const a = wrap(Math.atan2(hy - p.y, hx - p.x) - p.angle),
      mods = {
        kinetic: [2, 0.5],
        he: [0.5, 2],
        energy: [1, 1],
        frag: [0.25, 0.25],
      }[type] || [1, 1];
    let hull = 0,
      shieldHit = false,
      armorHit = false;
    if (
      p.shieldOn &&
      p.shieldLevel > 0 &&
      p.overload <= 0 &&
      p.venting <= 0 &&
      Math.abs(a) <= (p.shieldArc * p.shieldLevel) / 2
    ) {
      shieldHit = true;
      const flux = damage * mods[0] * p.shieldEfficiency;
      if (beam) p.softFlux += flux;
      else p.hardFlux += flux;
      if (p.softFlux + p.hardFlux >= p.maxFlux) {
        const total = p.softFlux + p.hardFlux;
        p.softFlux *= p.maxFlux / total;
        p.hardFlux *= p.maxFlux / total;
        p.overload = 4;
        p.shieldOn = false;
        p.shieldLevel = 0;
        event(s, "overload", p, "护盾过载");
      }
    } else {
      const sector = Math.floor(((a + PI / 6 + TAU) % TAU) / (PI / 3)) % 6,
        armor = p.armor[sector],
        strength = Math.max(1, damage * mods[1]),
        absorb = armor / (armor + strength),
        guard = p.systemTime > 0 && Math.abs(a) < PI / 3 ? 0.65 : 1;
      armorHit = armor > 0;
      const armorDamage = strength * absorb * guard;
      p.armor[sector] = Math.max(0, armor - armorDamage);
      hull = damage * (1 - absorb) * guard;
      p.hp = Math.max(0, p.hp - hull);
    }
    const source = s.ships.find((q) => q.id === sourceId);
    if (source) source.damageDealt += hull;
    impact(s, p, damage, type, hx, hy, shieldHit, armorHit, sourceId, weaponId);
    if (p.hp <= 0) {
      p.status = "destroyed";
      p.shieldOn = false;
      if (source) source.kills++;
      const explosion = {
        shipId: p.id,
        angle: p.angle,
        vx: p.vx,
        vy: p.vy,
        x: p.x,
        y: p.y,
        kind: "explosion",
        radius: p.radius * 1.7,
        life: 1.3,
        maxLife: 1.3,
        color: p.color,
      };
      s.effects.push(explosion);
      if (s.effects.length > 400) s.effects.splice(0, s.effects.length - 400);
      event(s, "explosion", p, "舰船被击毁", undefined, explosion);
    }
  }
  function hitEllipse(p, x, y, x2, y2, shield) {
    const co = Math.cos(p.angle),
      si = Math.sin(p.angle),
      dx = x - p.x,
      dy = y - p.y,
      lx = dx * co + dy * si,
      ly = -dx * si + dy * co,
      ex = (x2 - x) * co + (y2 - y) * si,
      ey = -(x2 - x) * si + (y2 - y) * co,
      rx = shield ? p.radius + 8 : p.length / 2,
      ry = shield ? p.radius + 8 : p.width / 2,
      A = (ex * ex) / (rx * rx) + (ey * ey) / (ry * ry),
      B = 2 * ((lx * ex) / (rx * rx) + (ly * ey) / (ry * ry)),
      D = (lx * lx) / (rx * rx) + (ly * ly) / (ry * ry) - 1;
    if (D <= 0) return 0;
    if (A === 0) return null;
    const disc = B * B - 4 * A * D;
    if (disc < 0) return null;
    const t = (-B - Math.sqrt(disc)) / (2 * A);
    return t >= 0 && t <= 1 ? t : null;
  }
  function rayHit(s, source, x, y, x2, y2) {
    let best = null;
    for (const p of s.ships) {
      if (p.status !== "active" || p.id === source) continue;
      let t = hitEllipse(p, x, y, x2, y2, false);
      if (p.shieldOn && p.shieldLevel > 0) {
        const st = hitEllipse(p, x, y, x2, y2, true);
        if (st !== null) {
          const a = wrap(
            Math.atan2(y + (y2 - y) * st - p.y, x + (x2 - x) * st - p.x) -
              p.angle,
          );
          if (
            Math.abs(a) <= (p.shieldArc * p.shieldLevel) / 2 &&
            (t === null || st < t)
          )
            t = st;
        }
      }
      if (t !== null && (!best || t < best.t))
        best = { p, t, x: x + (x2 - x) * t, y: y + (y2 - y) * t };
    }
    return best;
  }
  function aiCommand(s, p, dt) {
    p.aiTimer -= dt;
    if (p.aiTimer > 0 && p.aiCommand) return p.aiCommand;
    p.aiTimer = 0.25;
    const enemies = s.ships.filter(
        (q) => q.status === "active" && q.team !== p.team,
      ),
      friends = s.ships.filter(
        (q) => q.status === "active" && q.team === p.team && q !== p,
      );
    let t = enemies.find((q) => q.id === p.targetId);
    if (!t || s.time > p.aiHold) {
      t = enemies.slice().sort((a, b) => score(a) - score(b))[0];
      p.aiHold = s.time + 2;
    }
    function score(q) {
      return (
        Math.hypot(q.x - p.x, q.y - p.y) -
        ((q.softFlux + q.hardFlux) / q.maxFlux) * 180 +
        Math.abs(wrap(Math.atan2(q.y - p.y, q.x - p.x) - p.angle)) * 70
      );
    }
    const o = p.order;
    if (o && o.type === "attack")
      t = enemies.find((q) => q.id === o.targetId) || t;
    p.targetId = t ? t.id : null;
    const c = {
      moveX: 0,
      moveY: 0,
      aimAngle: t ? Math.atan2(t.y - p.y, t.x - p.x) : p.angle,
      fire: true,
      manualGroup: 0,
    };
    let waypoint = null;
    const fraction = (p.softFlux + p.hardFlux) / p.maxFlux;
    if (fraction > 0.8) p.aiState = "cooldown";
    if (fraction < 0.45 && p.aiState === "cooldown") p.aiState = "engage";
    if (o && o.type === "retreat") {
      waypoint = { x: p.x, y: p.team ? -300 : s.height + 300 };
      p.aiState = "retreat";
    } else if (o && o.type === "move") {
      waypoint = o;
      p.aiState = "move";
    } else if (p.aiState === "cooldown" && t) {
      const a = Math.atan2(p.y - t.y, p.x - t.x);
      waypoint = { x: p.x + Math.cos(a) * 500, y: p.y + Math.sin(a) * 500 };
    } else if (o && o.type === "escort") {
      const ally = friends.find((q) => q.id === o.targetId);
      if (ally) {
        waypoint = {
          x:
            ally.x -
            Math.cos(ally.angle) * 220 -
            Math.sin(ally.angle) * (Number(p.id.slice(2)) % 2 ? 180 : -180),
          y:
            ally.y -
            Math.sin(ally.angle) * 220 +
            Math.cos(ally.angle) * (Number(p.id.slice(2)) % 2 ? 180 : -180),
        };
        p.aiState = "escort";
      }
    } else if (t) {
      const d = Math.hypot(t.x - p.x, t.y - p.y),
        range =
          Math.max(
            ...p.mounts
              .map((m) => C.getWeapon(m.weaponId))
              .filter((w) => !w.pd)
              .map((w) => w.range),
          ) * 0.72;
      if (p.typeId === "xia" && d < 1100 && d > 450 && !p.flankDone) {
        if (!p.flankPoint)
          p.flankPoint = {
            x: clamp(
              t.x -
                Math.cos(t.angle) * 420 -
                Math.sin(t.angle) * (p.id.endsWith("0") ? 480 : -480),
              200,
              s.width - 200,
            ),
            y: clamp(
              t.y -
                Math.sin(t.angle) * 420 +
                Math.cos(t.angle) * (p.id.endsWith("0") ? 480 : -480),
              200,
              s.height - 200,
            ),
          };
        waypoint = p.flankPoint;
        p.aiState = "flank";
        if (Math.hypot(waypoint.x - p.x, waypoint.y - p.y) < 100) {
          p.flankDone = true;
          p.flankPoint = null;
        }
      } else if (d > range + 70) {
        waypoint = t;
        p.aiState = "advance";
      } else if (d < range - 140) {
        const a = Math.atan2(p.y - t.y, p.x - t.x);
        waypoint = { x: p.x + Math.cos(a) * 250, y: p.y + Math.sin(a) * 250 };
        p.aiState = "range";
      }
    }
    if (waypoint) {
      const dx = waypoint.x - p.x,
        dy = waypoint.y - p.y,
        d = Math.hypot(dx, dy),
        speed = p.movement.maxSpeed,
        stop = Math.hypot(p.vx, p.vy) ** 2 / (2 * p.movement.deceleration);
      if (d > 25) {
        const k = clamp((d - stop) / 180, 0.15, 1);
        c.moveX = (dx / d) * k;
        c.moveY = (dy / d) * k;
        if (!t || p.aiState === "retreat") c.aimAngle = Math.atan2(dy, dx);
      } else c.brake = true;
    }
    for (const f of friends) {
      const dx = p.x - f.x,
        dy = p.y - f.y,
        d = Math.hypot(dx, dy),
        safe = p.radius + f.radius + 70;
      if (d < safe && d > 0) {
        c.moveX += ((dx / d) * (safe - d)) / safe;
        c.moveY += ((dy / d) * (safe - d)) / safe;
      }
    }
    p.aiCommand = c;
    return c;
  }
  function controls(s, p, c, manual, dt) {
    if (c.autoGroups) p.autoGroups = c.autoGroups.map(Boolean);
    if (c.shieldToggle && p.overload <= 0 && p.venting <= 0)
      p.shieldOn = !p.shieldOn;
    if (
      c.vent &&
      p.overload <= 0 &&
      p.venting <= 0 &&
      p.softFlux + p.hardFlux > 0
    ) {
      p.venting = 3;
      p.shieldOn = false;
      event(s, "vent", p, "主动散幅");
    }
    if (c.system && p.typeId === "xie" && p.systemCooldown <= 0) {
      p.systemTime = 4;
      p.systemCooldown = 16;
      event(s, "system", p, "玄甲阵展开");
    }
    if (!manual) {
      const t = s.ships.find((q) => q.id === p.targetId),
        d = t ? Math.hypot(t.x - p.x, t.y - p.y) : Infinity;
      if (p.venting <= 0 && p.overload <= 0)
        p.shieldOn = d < 1100 && p.aiState !== "cooldown";
      if (p.aiState === "cooldown" && d > 950 && p.venting <= 0) {
        p.venting = 3;
        event(s, "vent", p, "撤离散幅");
      }
      if (p.typeId === "xie" && d < 850 && p.systemCooldown <= 0) {
        p.systemTime = 4;
        p.systemCooldown = 16;
        event(s, "system", p, "玄甲阵展开");
      }
    }
    p.overload = Math.max(0, p.overload - dt);
    p.venting = Math.max(0, p.venting - dt);
    p.systemTime = Math.max(0, p.systemTime - dt);
    p.systemCooldown = Math.max(0, p.systemCooldown - dt);
    if (p.overload > 0 || p.venting > 0) p.shieldOn = false;
    p.shieldLevel = approach(p.shieldLevel, p.shieldOn ? 1 : 0, dt * 2);
    let remaining = p.dissipation * dt * (p.venting > 0 ? 3 : 1);
    const soft = Math.min(p.softFlux, remaining);
    p.softFlux -= soft;
    remaining -= soft;
    if (!p.shieldOn) p.hardFlux = Math.max(0, p.hardFlux - remaining);
    if (p.shieldOn) {
      const upkeep = p.shieldUpkeep * dt;
      if (p.softFlux + p.hardFlux + upkeep < p.maxFlux) p.softFlux += upkeep;
      else p.shieldOn = false;
    }
    motionStep(p, c, dt);
  }
  function fireWeapons(s, p, c, manual, dt) {
    if (p.overload > 0 || p.venting > 0) return;
    for (const m of p.mounts) {
      const w = C.getWeapon(m.weaponId);
      m.cooldown = Math.max(0, m.cooldown - dt);
      const co = Math.cos(p.angle),
        si = Math.sin(p.angle),
        x = p.x + m.x * co - m.y * si,
        y = p.y + m.x * si + m.y * co;
      const automatic = !manual || p.autoGroups[m.group];
      function targetAim(q) {
        let tx = q.x,
          ty = q.y;
        if (w.mode === "projectile" && q.kind !== "missile") {
          const travel = Math.hypot(tx - x, ty - y) / w.speed;
          tx += (q.vx || 0) * travel;
          ty += (q.vy || 0) * travel;
        }
        return Math.atan2(ty - y, tx - x);
      }
      function eligible(q) {
        const distance = Math.hypot(q.x - x, q.y - y),
          aim = targetAim(q);
        if (
          distance > w.range + (q.radius || 0) ||
          Math.abs(wrap(aim - p.angle - m.angle)) > m.arc / 2
        )
          return false;
        const hit = rayHit(
          s,
          p.id,
          x,
          y,
          x + Math.cos(aim) * w.range,
          y + Math.sin(aim) * w.range,
        );
        return (
          !hit ||
          hit.p.team !== p.team ||
          Math.hypot(hit.x - x, hit.y - y) >= distance
        );
      }
      let target = null,
        missile = null;
      if (automatic) {
        const candidates = s.ships.filter(
          (q) => q.team !== p.team && q.status === "active" && eligible(q),
        );
        candidates.sort((a, b) =>
          a.id === p.targetId
            ? -1
            : b.id === p.targetId
              ? 1
              : Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y),
        );
        target = candidates[0] || null;
        if (w.pd) {
          missile =
            s.projectiles
              .filter(
                (q) =>
                  q.kind === "missile" &&
                  q.team !== p.team &&
                  q.life > 0 &&
                  eligible(q),
              )
              .sort(
                (a, b) =>
                  Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y),
              )[0] || null;
          if (missile) target = missile;
        }
      }
      const want = automatic
        ? target
          ? targetAim(target)
          : m.aimAngle
        : Number.isFinite(c.aimAngle)
          ? c.aimAngle
          : p.targetAngle;
      const center = p.angle + m.angle,
        delta = wrap(want - center),
        allowed = Math.abs(delta) <= m.arc / 2,
        desired = center + clamp(delta, -m.arc / 2, m.arc / 2);
      m.aimAngle = wrap(
        m.aimAngle +
          clamp(
            wrap(desired - m.aimAngle),
            -(m.hardpoint ? 50 : 160) * R * dt,
            (m.hardpoint ? 50 : 160) * R * dt,
          ),
      );
      m.aimAngle = wrap(
        center + clamp(wrap(m.aimAngle - center), -m.arc / 2, m.arc / 2),
      );
      const firing = automatic
        ? !!target
        : c.fire && (c.manualGroup || 0) === m.group;
      if (
        !firing ||
        !allowed ||
        Math.abs(wrap(want - m.aimAngle)) > 5 * R ||
        m.cooldown > 0 ||
        m.ammo === 0
      )
        continue;
      const distance = target ? Math.hypot(target.x - x, target.y - y) : 0;
      if (automatic && distance > w.range + (target.radius || 0)) continue;
      const flux = w.flux * (w.mode === "beam" ? dt : 1);
      if (p.softFlux + p.hardFlux + flux >= p.maxFlux * 0.98) continue;
      const ex = x + Math.cos(m.aimAngle) * w.range,
        ey = y + Math.sin(m.aimAngle) * w.range,
        obstruction = rayHit(s, p.id, x, y, ex, ey);
      if (
        obstruction &&
        obstruction.p.team === p.team &&
        (!missile ||
          Math.hypot(obstruction.x - x, obstruction.y - y) < distance)
      )
        continue;
      p.softFlux += flux;
      if (w.mode === "beam") {
        let bx = ex,
          by = ey;
        if (missile) {
          bx = missile.x;
          by = missile.y;
          missile.hp -= w.damage * dt;
          if (missile.hp <= 0) missile.life = 0;
        } else if (obstruction) {
          bx = obstruction.x;
          by = obstruction.y;
          applyDamage(
            s,
            obstruction.p,
            w.damage * dt,
            w.damageType,
            bx,
            by,
            true,
            p.id,
            w.id,
          );
        }
        s.beams.push({
          x,
          y,
          x2: bx,
          y2: by,
          team: p.team,
          color: w.color,
          sourceId: p.id,
          weaponId: w.id,
        });
        if (!m.beamEvent || s.time - m.beamEvent > 0.25) {
          event(s, "shot", p, "光束", w.id, {
            mountId: m.id,
            x,
            y,
            angle: m.aimAngle,
            size: w.size,
            damage: w.damage,
            sourceId: p.id,
          });
          m.beamEvent = s.time;
        }
      } else {
        // A salvo leaves the launcher as a fan; odd rounds fly a touch slower
        // so the volley arrives staggered instead of as one blob.
        const rounds = w.salvo || 1;
        for (let round = 0; round < rounds; round++)
          s.projectiles.push({
            id: ++s.projectileSeq,
            x,
            y,
            px: x,
            py: y,
            angle:
              m.aimAngle +
              (rounds > 1
                ? (round / (rounds - 1) - 0.5) * (w.spread || 0) * R
                : 0),
            team: p.team,
            kind: w.mode,
            damageType: w.damageType,
            color: w.color,
            sourceId: p.id,
            weaponId: w.id,
            damage: w.damage,
            speed: w.speed * (round % 2 ? 0.93 : 1),
            life: w.fuel || w.range / w.speed,
            remaining: w.mode === "missile" ? w.speed * w.fuel : w.range,
            hp: w.hp || 1,
            targetId: target && !missile ? target.id : null,
            pd: !!w.pd,
            turnRate: (w.turnRate || 0) * R,
            mirv: w.mirv || null,
            sprint: w.sprint || null,
          });
        m.cooldown = w.cooldown;
        if (m.ammo !== null) m.ammo--;
        event(s, "shot", p, w.name, w.id, {
          mountId: m.id,
          x,
          y,
          angle: m.aimAngle,
          size: w.size,
          damage: w.damage,
          sourceId: p.id,
        });
      }
    }
  }
  function advanceProjectiles(s, dt) {
    const spawned = [];
    for (const b of s.projectiles) {
      if (b.life <= 0) continue;
      b.px = b.x;
      b.py = b.y;
      b.life -= dt;
      if (b.kind === "missile") {
        let t = s.ships.find(
          (q) => q.id === b.targetId && q.status === "active",
        );
        if (!t)
          t = s.ships
            .filter((q) => q.status === "active" && q.team !== b.team)
            .sort(
              (a, c) =>
                Math.hypot(a.x - b.x, a.y - b.y) -
                Math.hypot(c.x - b.x, c.y - b.y),
            )[0];
        if (t)
          b.angle = wrap(
            b.angle +
              clamp(
                wrap(Math.atan2(t.y - b.y, t.x - b.x) - b.angle),
                -b.turnRate * dt,
                b.turnRate * dt,
              ),
          );
        if (t) {
          const bearing = Math.atan2(t.y - b.y, t.x - b.x),
            distance = Math.hypot(t.x - b.x, t.y - b.y) - (t.radius || 0);
          if (b.mirv && distance < b.mirv.range) {
            // The bus dies here; its warheads fan out and home on their own.
            for (let i = 0; i < b.mirv.count; i++)
              spawned.push({
                id: ++s.projectileSeq,
                x: b.x,
                y: b.y,
                px: b.x,
                py: b.y,
                angle:
                  bearing +
                  (i / (b.mirv.count - 1 || 1) - 0.5) * b.mirv.spread * R,
                team: b.team,
                kind: "missile",
                damageType: b.damageType,
                color: b.color,
                sourceId: b.sourceId,
                weaponId: b.weaponId,
                damage: b.mirv.damage,
                speed: b.mirv.speed * (i % 2 ? 0.92 : 1),
                life: 2.4,
                remaining: Infinity,
                hp: 30,
                targetId: t.id,
                pd: false,
                turnRate: 150 * R,
                child: true,
              });
            b.life = 0;
            event(s, "split", null, "分导", b.weaponId, { x: b.x, y: b.y });
            continue;
          }
          if (
            b.sprint &&
            !b.sprinting &&
            distance < b.sprint.range &&
            Math.abs(wrap(bearing - b.angle)) < 0.3
          ) {
            // Final dash: no more steering, far too fast for point defence.
            b.sprinting = true;
            b.angle = bearing;
            b.speed = b.sprint.speed;
            b.turnRate = 0;
            b.life = Math.max(b.life, 1);
          }
        }
      }
      const travel =
        b.kind === "missile"
          ? b.speed * dt
          : Math.min(b.remaining, b.speed * dt);
      b.x += Math.cos(b.angle) * travel;
      b.y += Math.sin(b.angle) * travel;
      b.remaining -= travel;
      const hit = rayHit(s, b.sourceId, b.px, b.py, b.x, b.y);
      let intercepted = false;
      if (b.pd) {
        for (const m of s.projectiles) {
          if (
            m === b ||
            m.team === b.team ||
            m.kind !== "missile" ||
            m.life <= 0
          )
            continue;
          const dx = b.x - b.px,
            dy = b.y - b.py,
            t = clamp(
              ((m.x - b.px) * dx + (m.y - b.py) * dy) /
                (dx * dx + dy * dy || 1),
              0,
              1,
            );
          if (
            (!hit || t < hit.t) &&
            Math.hypot(m.x - b.px - dx * t, m.y - b.py - dy * t) < 14
          ) {
            m.hp -= b.damage;
            b.life = 0;
            if (m.hp <= 0) m.life = 0;
            intercepted = true;
            break;
          }
        }
      }
      if (hit && !intercepted) {
        if (hit.p.team !== b.team)
          applyDamage(
            s,
            hit.p,
            b.damage,
            b.damageType,
            hit.x,
            hit.y,
            false,
            b.sourceId,
            b.weaponId,
          );
        else {
          const bearing = wrap(
            Math.atan2(hit.y - hit.p.y, hit.x - hit.p.x) - hit.p.angle,
          );
          const shield =
            hit.p.shieldOn &&
            hit.p.shieldLevel > 0 &&
            Math.abs(bearing) <= (hit.p.shieldArc * hit.p.shieldLevel) / 2;
          impact(
            s,
            hit.p,
            0,
            b.damageType,
            hit.x,
            hit.y,
            shield,
            !shield,
            b.sourceId,
            b.weaponId,
            true,
          );
        }
        b.life = 0;
      }
      if (b.kind !== "missile" && b.remaining <= 0) b.life = 0;
    }
    s.projectiles = s.projectiles.filter((b) => b.life > 0).concat(spawned);
  }
  function resolveShips(s) {
    const active = s.ships.filter((p) => p.status === "active");
    for (let i = 0; i < active.length; i++)
      for (let j = i + 1; j < active.length; j++) {
        const a = active[i],
          b = active[j],
          dx = b.x - a.x,
          dy = b.y - a.y,
          d = Math.hypot(dx, dy),
          bearing = Math.atan2(dy, dx),
          support = (p) =>
            1 /
            Math.sqrt(
              Math.cos(bearing - p.angle) ** 2 / (p.length * 0.5) ** 2 +
                Math.sin(bearing - p.angle) ** 2 / (p.width * 0.5) ** 2,
            ),
          min = support(a) + support(b);
        if (d < min) {
          const nx = d ? dx / d : 1,
            ny = d ? dy / d : 0,
            push = (min - d) / 2;
          a.x -= nx * push;
          a.y -= ny * push;
          b.x += nx * push;
          b.y += ny * push;
          const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          if (rel < 0) {
            a.vx += nx * rel * 0.5;
            a.vy += ny * rel * 0.5;
            b.vx -= nx * rel * 0.5;
            b.vy -= ny * rel * 0.5;
          }
        }
      }
    for (const p of active)
      if (
        p.x < -p.radius ||
        p.x > s.width + p.radius ||
        p.y < -p.radius ||
        p.y > s.height + p.radius
      ) {
        p.status = "retreated";
        event(s, "retreat", p, "驶离战场");
      }
  }
  function outcome(s) {
    if (
      !s.ships.some((p) => p.team === 1 && p.status === "active") &&
      s.ships.some((p) => p.team === 1 && p.status === "reserve")
    )
      deployEnemy(s);
    const available = [0, 1].map((t) =>
      s.ships.some(
        (p) =>
          p.team === t && (p.status === "active" || p.status === "reserve"),
      ),
    );
    if (!available[0] || !available[1]) {
      s.status = "finished";
      s.winner = available[0] ? 0 : available[1] ? 1 : "draw";
      event(s, "finish", null, s.winner === "draw" ? "双方撤出" : "战斗结束");
    } else if (!s.ships.some((p) => p.team === 0 && p.status === "active"))
      s.status = "needsDeployment";
  }
  function stepBattle(s, dt, commands = {}) {
    if (s.status !== "running" || !Number.isFinite(dt) || dt <= 0) return s;
    for (const id of Object.keys(commands)) {
      const c = commands[id];
      for (const k of ["shieldToggle", "vent", "system"])
        if (c[k]) {
          if (!s.pendingCommands[id]) s.pendingCommands[id] = {};
          s.pendingCommands[id][k] = true;
        }
    }
    s.accumulator += Math.min(dt, 0.25);
    let first = true;
    while (s.accumulator + 1e-10 >= H && s.status === "running") {
      s.accumulator -= H;
      s.time += H;
      s.beams = [];
      for (const p of s.ships) {
        if (p.status !== "active") continue;
        const manual = Object.prototype.hasOwnProperty.call(commands, p.id),
          raw = manual ? commands[p.id] : aiCommand(s, p, H),
          c = Object.assign({}, raw);
        if (first && s.pendingCommands[p.id]) {
          Object.assign(c, s.pendingCommands[p.id]);
          delete s.pendingCommands[p.id];
        }
        if (!first) {
          c.shieldToggle = false;
          c.vent = false;
          c.system = false;
        }
        controls(s, p, c, manual, H);
        fireWeapons(s, p, c, manual, H);
      }
      advanceProjectiles(s, H);
      resolveShips(s);
      s.effects.forEach((e) => (e.life -= H));
      s.effects = s.effects.filter((e) => e.life > 0);
      outcome(s);
      first = false;
    }
    return s;
  }
  const api = {
    createBattle,
    deployShip,
    deployEnemy,
    stepBattle,
    setOrder,
    validateLoadout,
    motionStep,
    applyDamage,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.StarCombat = api;
})(typeof globalThis !== "undefined" ? globalThis : this);

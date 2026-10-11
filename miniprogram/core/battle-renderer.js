(function (root, factory) {
  if (typeof module === "object" && module.exports)
    module.exports = factory(require("./ships"));
  else root.StarBattleRenderer = factory(root.StarShips);
})(typeof globalThis !== "undefined" ? globalThis : this, function (catalog) {
  "use strict";
  // Original Canvas renderer. Visual randomness is deliberately independent of combat.
  const TAU = Math.PI * 2,
    cap = 650,
    clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function reset(ui) {
    ui._worldFX = {
      battle: ui.battle,
      time: 0,
      lastTime: 0,
      seq: 0,
      seed: 718391,
      particles: [],
      bursts: [],
      shots: {},
      trails: {},
      emit: 0,
      shake: 0,
      lastShake: -10,
      beamHits: {},
      pending: [],
      flash: 0,
      beamEmit: 0,
    };
    ui.hitStop = 0;
    ui.screenShake = { x: 0, y: 0, strength: 0 };
    return ui._worldFX;
  }
  function state(ui) {
    return !ui._worldFX || ui._worldFX.battle !== ui.battle
      ? reset(ui)
      : ui._worldFX;
  }
  function rand(f) {
    f.seed = (Math.imul(f.seed, 1664525) + 1013904223) >>> 0;
    return f.seed / 4294967296;
  }
  function circle(c, x, y, r, color) {
    if (!(r > 0)) return;
    c.beginPath();
    c.arc(x, y, r, 0, TAU);
    c.fillStyle = color;
    c.fill();
  }
  function line(c, x, y, xx, yy, color, w) {
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(xx, yy);
    c.strokeStyle = color;
    c.lineWidth = w;
    c.stroke();
  }
  function glow(c, x, y, r, color, alpha) {
    if (!(r > 0)) return;
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, "transparent");
    c.save();
    c.globalAlpha *= alpha === undefined ? 1 : alpha;
    circle(c, x, y, r, g);
    c.restore();
  }
  function point(s, x, y) {
    const ca = Math.cos(s.angle),
      sa = Math.sin(s.angle);
    return { x: s.x + ca * x - sa * y, y: s.y + sa * x + ca * y };
  }
  function slots(s, d) {
    return (
      d.engineSlots || [
        {
          x: -s.length * 0.35,
          y: -s.width * 0.19,
          width: s.width * 0.11,
          length: s.length * 0.3,
          style: d.tech === "高科技" ? "high" : "low",
        },
        {
          x: -s.length * 0.35,
          y: s.width * 0.19,
          width: s.width * 0.11,
          length: s.length * 0.3,
          style: d.tech === "高科技" ? "high" : "low",
        },
      ]
    );
  }
  function engineColor(slot) {
    return slot.style === "high"
      ? "#65bfff"
      : slot.style === "mid"
        ? "#8de7df"
        : "#ffad58";
  }
  function power(s, d) {
    const t = s.thrust || {};
    return clamp(
      0.22 +
        Math.max(0, t.forward || 0) * 0.78 +
        (Math.hypot(s.vx || 0, s.vy || 0) / (d.movement.maxSpeed || 100)) *
          0.35,
      0.18,
      1.25,
    );
  }
  function particle(f, p) {
    if (f.particles.length >= cap) f.particles.shift();
    f.particles.push(p);
  }
  function burst(f, e, ship, ui) {
    const x = Number.isFinite(e.x) ? e.x : ship && ship.x,
      y = Number.isFinite(e.y) ? e.y : ship && ship.y;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const weapon = catalog.getWeapon(e.weaponId),
      beam = weapon && weapon.mode === "beam";
    if (beam) {
      const key = e.sourceId + ":" + e.targetId + ":" + e.weaponId;
      if (f.time - (f.beamHits[key] ?? -10) < 0.12) return;
      f.beamHits[key] = f.time;
    }
    const explosion = e.type === "explosion",
      shield = !!e.shieldHit,
      r = explosion
        ? e.radius || (ship && ship.radius) || 65
        : clamp(Math.sqrt(e.damage || 80) * 1.1, 7, 34),
      tier =
        weapon && weapon.size === "large"
          ? 2
          : weapon && weapon.size === "medium"
            ? 1
            : 0,
      life = explosion ? 1.6 : shield ? 0.48 : beam ? 0.12 : 0.38 + tier * 0.14;
    f.bursts.push({
      x,
      y,
      r: beam ? 5 : shield || explosion ? r : r * (1 + tier * 0.4),
      beam,
      tier,
      life,
      max: life,
      shield,
      explosion,
      angle: e.normalAngle || 0,
      targetId: e.targetId,
      localAngle: ship ? (e.normalAngle || 0) - ship.angle : 0,
      offsetX: ship
        ? (x - ship.x) * Math.cos(ship.angle) +
          (y - ship.y) * Math.sin(ship.angle)
        : 0,
      offsetY: ship
        ? -(x - ship.x) * Math.sin(ship.angle) +
          (y - ship.y) * Math.cos(ship.angle)
        : 0,
      color: e.damageType === "energy" ? e.color || "#aa9fff" : "#ffaf64",
    });
    if (f.bursts.length > 90) f.bursts.shift();
    // Shake is a short local impulse, never an accumulation of every damage tick.
    const own = ui.battle.ships.find(
      (s) => s.id === ui.flagshipId && s.status === "active",
    );
    const distance = own ? Math.hypot(x - own.x, y - own.y) : Infinity;
    const impulse =
      explosion && distance < 650
        ? 1.8 * (1 - distance / 650)
        : !beam && !e.blocked && e.targetId === ui.flagshipId && e.damage >= 200
          ? Math.min(1.2, e.damage / 600)
          : 0;
    if (impulse > 0 && f.time - f.lastShake >= 0.35) {
      f.shake = Math.max(f.shake, impulse * 2.4);
      f.lastShake = f.time;
      if (ui.p && ui.p.vibrate) ui.p.vibrate(explosion || impulse > 0.8);
    }
    // Heavy contact freezes the fight for a few frames so the blow can register.
    const onScreen = distance < 1100;
    if (!beam && onScreen && !e.secondary) {
      const stop = explosion
        ? 0.11
        : e.blocked
          ? 0
          : tier === 2
            ? 0.07
            : tier === 1 &&
                (e.targetId === ui.flagshipId || e.sourceId === ui.flagshipId)
              ? 0.035
              : 0;
      if (stop > (ui.hitStop || 0)) ui.hitStop = stop;
    }
    if (explosion && !e.secondary) {
      f.flash = Math.max(f.flash, onScreen ? 0.5 : 0.15);
      // The hull breaks up over a second: secondary blasts, then drifting wreckage.
      const hull = (ship && ship.radius) || 60;
      for (let i = 0; i < 5; i++)
        f.pending.push({
          at: f.time + 0.12 + i * 0.16 + rand(f) * 0.08,
          x: x + (rand(f) - 0.5) * hull * 1.3,
          y: y + (rand(f) - 0.5) * hull * 1.3,
          radius: hull * (0.35 + rand(f) * 0.35),
        });
      const chunks = clamp(Math.round(hull / 14), 4, 10);
      for (let i = 0; i < chunks; i++) {
        const a = rand(f) * TAU,
          speed = 18 + rand(f) * 70,
          ttl = 2.2 + rand(f) * 2.2;
        particle(f, {
          x: x + Math.cos(a) * hull * 0.3,
          y: y + Math.sin(a) * hull * 0.3,
          vx: Math.cos(a) * speed + (ship ? ship.vx || 0 : 0) * 0.6,
          vy: Math.sin(a) * speed + (ship ? ship.vy || 0 : 0) * 0.6,
          life: ttl,
          max: ttl,
          r: hull * (0.07 + rand(f) * 0.12),
          color: "#3a3f44",
          kind: "chunk",
          angle: a,
          spin: (rand(f) - 0.5) * 5,
        });
      }
    }
    const count = explosion ? 44 : beam ? 2 : shield ? 9 : 12 + tier * 10;
    for (let i = 0; i < count; i++) {
      const a = explosion
          ? rand(f) * TAU
          : (e.normalAngle || 0) + (rand(f) - 0.5) * 2.8,
        speed =
          (explosion ? 50 : beam ? 15 : 80 + tier * 50) +
          rand(f) * (explosion ? 130 : beam ? 25 : 160 + tier * 60),
        ttl = (explosion ? 0.5 : 0.18) + rand(f) * (explosion ? 1.7 : 0.48),
        smoke = !shield && !beam && i % 4 === 0;
      particle(f, {
        x,
        y,
        vx: Math.cos(a) * speed + (ship ? ship.vx || 0 : e.vx || 0) * 0.65,
        vy: Math.sin(a) * speed + (ship ? ship.vy || 0 : e.vy || 0) * 0.65,
        life: ttl,
        max: ttl,
        r: smoke ? 4 + rand(f) * r * 0.2 : 1 + rand(f) * 2.6,
        color: shield
          ? "#98e5ff"
          : e.damageType === "energy"
            ? e.color || "#b4aaff"
            : i % 3
              ? "#ffc179"
              : "#fff3ca",
        kind: smoke
          ? "smoke"
          : !beam && !shield && i % 3 === 0
            ? "debris"
            : "spark",
        angle: a,
      });
    }
  }
  function update(ui, dt) {
    const f = state(ui),
      b = ui.battle;
    if (!b || ui.paused || ui.screen === "deploy" || ui.screen === "tactical") {
      ui.screenShake = { x: 0, y: 0, strength: 0 };
      return;
    }
    if (Number.isFinite(b.time)) {
      const elapsed = b.time - f.lastTime;
      f.lastTime = b.time;
      if (elapsed <= 0) return;
      dt = elapsed;
    }
    dt = clamp(Number(dt) || 0, 0, 0.1);
    f.time += dt;
    for (const e of b.events || []) {
      if (!(e.seq > f.seq)) continue;
      f.seq = e.seq;
      const s = b.ships.find((s) => s.id === (e.targetId || e.shipId));
      if (e.type === "shot") {
        f.shots[
          (e.shipId || "") + ":" + (e.mountId || e.weaponId || e.weapon || "")
        ] = f.time;
      } else if (e.type === "hit" || e.type === "explosion") burst(f, e, s, ui);
    }
    for (const q of f.pending)
      if (q.at <= f.time)
        burst(
          f,
          {
            type: "explosion",
            x: q.x,
            y: q.y,
            radius: q.radius,
            secondary: true,
          },
          null,
          ui,
        );
    f.pending = f.pending.filter((q) => q.at > f.time);
    f.flash = Math.max(0, f.flash - dt * 3.2);
    // Beam contact throws a continuous spray rather than one burst per tick.
    f.beamEmit += dt;
    if (f.beamEmit >= 0.03) {
      f.beamEmit %= 0.03;
      for (const beam of b.beams || []) {
        if (!Number.isFinite(beam.x2)) continue;
        const back = Math.atan2(beam.y - beam.y2, beam.x - beam.x2);
        for (let i = 0; i < 2; i++) {
          const a = back + (rand(f) - 0.5) * 2.4,
            speed = 60 + rand(f) * 170,
            ttl = 0.12 + rand(f) * 0.22;
          particle(f, {
            x: beam.x2,
            y: beam.y2,
            vx: Math.cos(a) * speed,
            vy: Math.sin(a) * speed,
            life: ttl,
            max: ttl,
            r: 1 + rand(f) * 1.6,
            color: i ? beam.color || "#9fdcff" : "#f2fbff",
            kind: "spark",
            angle: a,
          });
        }
      }
    }
    for (const p of f.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const drag = Math.exp(-dt * (p.kind === "smoke" ? 1.6 : 0.55));
      p.vx *= drag;
      p.vy *= drag;
    }
    f.particles = f.particles.filter((p) => p.life > 0);
    for (const e of f.bursts) e.life -= dt;
    f.bursts = f.bursts.filter((e) => e.life > 0);
    for (const k of Object.keys(f.shots))
      if (f.time - f.shots[k] > 0.6) delete f.shots[k];
    f.emit += dt;
    if (f.emit >= 0.045) {
      f.emit %= 0.045;
      for (const s of b.ships || []) {
        const d = catalog.getShip(s.typeId);
        if (!d || s.ghost) continue;
        if (s.status === "active" && s.hp < s.maxHp * 0.55 && rand(f) < 0.5) {
          const p = point(
              s,
              (rand(f) - 0.5) * s.length * 0.5,
              (rand(f) - 0.5) * s.width * 0.4,
            ),
            fire = s.hp < s.maxHp * 0.28 && rand(f) < 0.5,
            ttl = fire ? 0.45 : 1.1;
          particle(f, {
            x: p.x,
            y: p.y,
            vx: (s.vx || 0) * 0.35 + rand(f) * 10 - 5,
            vy: (s.vy || 0) * 0.35 + rand(f) * 10 - 5,
            life: ttl,
            max: ttl,
            r: fire ? 2.5 + rand(f) * 2.5 : 4 + rand(f) * 6,
            color: fire ? "#ff9a45" : "#5b514b",
            kind: fire ? "ember" : "smoke",
          });
        }
        if (s.status === "active") {
          for (const slot of slots(s, d)) {
            const p = point(s, slot.x, slot.y),
              strength = power(s, d),
              ttl = 0.35 + strength * 0.45;
            particle(f, {
              x: p.x,
              y: p.y,
              vx: (s.vx || 0) * 0.5 - Math.cos(s.angle) * 35 * strength,
              vy: (s.vy || 0) * 0.5 - Math.sin(s.angle) * 35 * strength,
              life: ttl,
              max: ttl,
              r: slot.width * 0.5,
              color: engineColor(slot),
              kind: slot.style === "low" ? "exhaust" : "ion",
            });
          }
        } else if (s.status === "destroyed" && rand(f) < 0.12) {
          const p = point(
            s,
            (rand(f) - 0.5) * s.length * 0.45,
            (rand(f) - 0.5) * s.width * 0.4,
          );
          particle(f, {
            x: p.x,
            y: p.y,
            vx: rand(f) * 8 - 4,
            vy: -8,
            life: 1.5,
            max: 1.5,
            r: 4 + rand(f) * 8,
            color: "#c87838",
            kind: "smoke",
          });
        }
      }
      for (const p of b.projectiles || []) {
        if (p.kind !== "missile") continue;
        particle(f, {
          x: p.x,
          y: p.y,
          vx: -Math.cos(p.angle) * 16,
          vy: -Math.sin(p.angle) * 16,
          life: 0.8,
          max: 0.8,
          r: 2.6,
          color: "#bfa78c",
          kind: "exhaust",
        });
      }
    }
    const live = new Set();
    for (const p of b.projectiles || []) {
      live.add(String(p.id));
      const t = f.trails[p.id] || (f.trails[p.id] = []);
      t.push({ x: p.x, y: p.y });
      if (t.length > 9) t.shift();
    }
    for (const k of Object.keys(f.trails)) if (!live.has(k)) delete f.trails[k];
    f.shake *= Math.exp(-dt * 11);
    if (f.shake < 0.02) f.shake = 0;
    const gain =
      ui.shakeIntensity === undefined ? 0.65 : clamp(ui.shakeIntensity, 0, 1);
    ui.screenShake = {
      x: Math.sin(f.time * 91) * f.shake * gain,
      y: Math.sin(f.time * 113 + 0.7) * f.shake * gain,
      strength: f.shake * gain,
    };
  }
  const stars = [];
  let seed = 98431;
  for (let i = 0; i < 330; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const x = seed / 4294967296;
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    stars.push({
      x,
      y: seed / 4294967296,
      r: i % 29 === 0 ? 1.3 : i % 5 === 0 ? 0.8 : 0.45,
      depth: 1 + (i % 3),
      a: 0.12 + (i % 7) * 0.055,
    });
  }
  function drawSpace(ui, staticView) {
    const c = ui.ctx,
      w = ui.width,
      h = ui.height,
      cx = staticView ? 0 : (ui.camera && ui.camera.x) || 0,
      cy = staticView ? 0 : (ui.camera && ui.camera.y) || 0;
    c.save();
    c.fillStyle = "#040911";
    c.fillRect(0, 0, w, h);
    const img = ui.images && ui.images.background;
    if (
      img &&
      Number.isFinite(img.width) &&
      img.width > 0 &&
      Number.isFinite(img.height) &&
      img.height > 0
    ) {
      const ratio = Math.max(w / img.width, h / img.height) * 1.12,
        iw = img.width * ratio,
        ih = img.height * ratio;
      c.globalAlpha = 0.52;
      c.drawImage(
        img,
        (w - iw) / 2 - Math.sin(cx * 0.00035) * iw * 0.05,
        (h - ih) / 2 - Math.sin(cy * 0.00035) * ih * 0.05,
        iw,
        ih,
      );
      c.globalAlpha = 1;
    }
    glow(
      c,
      w * 0.2 - cx * 0.003,
      h * 0.62 - cy * 0.003,
      w * 0.65,
      "#153242",
      0.26,
    );
    glow(
      c,
      w * 0.8 - cx * 0.001,
      h * 0.15 - cy * 0.001,
      w * 0.6,
      "#28213b",
      0.2,
    );
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i],
        x = (((s.x * w - (cx * 0.09) / s.depth) % w) + w) % w,
        y = (((s.y * h - (cy * 0.09) / s.depth) % h) + h) % h;
      c.globalAlpha = s.a;
      circle(c, x, y, s.r, i % 4 ? "#b9ced8" : "#e5c6a9");
      if (s.r > 1) {
        line(c, x - 3, y, x + 3, y, "#b3d6e2", 0.5);
        line(c, x, y - 3, x, y + 3, "#b3d6e2", 0.5);
      }
    }
    // Near dust moves almost with the world and streaks along the flagship's
    // velocity, which is what makes thrust read as speed.
    const own =
        !staticView &&
        ui.battle &&
        (ui.battle.ships || []).find((s) => s.id === ui.flagshipId),
      zoom = (ui.camera && ui.camera.scale) || 0.5,
      svx = own ? (own.vx || 0) * zoom * 0.07 : 0,
      svy = own ? (own.vy || 0) * zoom * 0.07 : 0;
    c.globalAlpha = 0.2;
    for (let i = 0; i < 46; i++) {
      const s = stars[i * 7],
        k = zoom * (0.45 + (i % 3) * 0.2),
        x = (((s.x * w * 1.7 - cx * k) % w) + w) % w,
        y = (((s.y * h * 1.7 - cy * k) % h) + h) % h;
      line(c, x, y, x - svx - 1.2, y - svy - 0.3, "#9fbcc4", 1);
    }
    c.restore();
  }
  function flame(c, x, y, width, length, color, phase) {
    const w = Math.max(0.9, width),
      l = Math.max(3, length) * (1 + 0.055 * Math.sin(phase));
    glow(c, x, y, w * 3.5, color, 0.35);
    const g = c.createLinearGradient(x, y, x - l, y);
    g.addColorStop(0, color);
    g.addColorStop(0.45, color + "a0");
    g.addColorStop(1, color + "00");
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(x, y - w * 0.5);
    c.bezierCurveTo(
      x - l * 0.4,
      y - w * 0.7,
      x - l * 0.8,
      y - w * 0.14,
      x - l,
      y,
    );
    c.bezierCurveTo(
      x - l * 0.65,
      y + w * 0.15,
      x - l * 0.3,
      y + w * 0.8,
      x,
      y + w * 0.5,
    );
    c.closePath();
    c.fill();
    c.fillStyle = "#eaf9ff";
    c.beginPath();
    c.moveTo(x + 1, y - w * 0.21);
    c.lineTo(x - l * 0.48, y);
    c.lineTo(x + 1, y + w * 0.21);
    c.fill();
  }
  function drawShip(ui, s, opacity) {
    const d = catalog.getShip(s.typeId);
    if (!d) return;
    const c = ui.ctx,
      p = ui.toScreen(s.x, s.y),
      z = ui.camera.scale,
      size = s.length * z * (d.spriteScale || 1.14),
      alive = s.status === "active" || !!s.ghost,
      f = state(ui),
      selected = s.id === ui.selectedShip || s.id === ui.flagshipId,
      col = s.team ? "#ed9989" : "#8cdec8";
    if (
      p.x < -size ||
      p.x > ui.width + size ||
      p.y < -size ||
      p.y > ui.height + size
    )
      return;
    c.save();
    c.globalAlpha = opacity === undefined ? 1 : opacity;
    if (alive && !s.ghost && size >= 18) {
      c.save();
      c.translate(p.x, p.y);
      c.rotate(s.angle);
      for (const slot of slots(s, d))
        flame(
          c,
          slot.x * z,
          slot.y * z,
          slot.width * z,
          (slot.length || s.length * 0.3) * z * power(s, d),
          engineColor(slot),
          f.time * 32 + slot.y,
        );
      const t = s.thrust || {},
        turn = t.turn || s.angularVelocity || 0,
        strafe = t.strafe || 0;
      if (Math.abs(turn) > 0.02 || Math.abs(strafe) > 0.05) {
        const sign = Math.sign(turn || strafe);
        for (const side of [-1, 1]) {
          c.save();
          c.translate(
            side * s.length * 0.27 * z,
            side * sign * s.width * 0.32 * z,
          );
          c.rotate((-side * sign * Math.PI) / 2);
          flame(
            c,
            0,
            0,
            Math.max(1, 2 * z),
            Math.max(5, 12 * z) * (Math.abs(turn) + Math.abs(strafe) + 0.25),
            "#9fd5ef",
            f.time * 29,
          );
          c.restore();
        }
      }
      if ((t.backward || 0) > 0.05) {
        c.save();
        c.translate(s.length * 0.32 * z, 0);
        c.rotate(Math.PI);
        flame(c, 0, 0, 3 * z, 17 * z * t.backward, "#9fd5ef", f.time * 27);
        c.restore();
      }
      c.restore();
    }
    if (size < 18) {
      // At map scale the art is subpixel detail. A fixed-size directional hull
      // keeps fleet identity and heading legible without changing hit geometry.
      c.save();
      c.translate(p.x, p.y);
      c.rotate(s.angle);
      c.beginPath();
      c.moveTo(7, 0);
      c.lineTo(-4.5, -4.5);
      c.lineTo(-2.5, 0);
      c.lineTo(-4.5, 4.5);
      c.closePath();
      c.fillStyle = alive ? col : "#53616b";
      c.strokeStyle = "#07111b";
      c.lineWidth = 1.3;
      c.fill();
      c.stroke();
      c.restore();
      // Stable team pip remains visible even when a ship points at the viewer.
      circle(c, p.x, p.y + 8, 1.5, alive ? col : "#53616b");
    } else {
      ui.shipImage(
        s.typeId,
        p.x,
        p.y,
        size,
        s.angle,
        opacity === undefined ? (alive ? 1 : 0.48) : clamp(opacity, 0, 1),
      );
    }
    if (!alive) {
      c.save();
      c.translate(p.x, p.y);
      c.rotate(s.angle);
      c.globalAlpha *= 0.65;
      for (let i = 0; i < 5; i++) {
        const x = (i - 2) * size * 0.11,
          y = Math.sin(i * 4.2) * size * 0.13;
        line(
          c,
          x - 5,
          y - 3,
          x + 6,
          y + 5,
          "#10151a",
          Math.max(2, size * 0.035),
        );
        glow(
          c,
          x,
          y,
          Math.max(2, size * 0.055),
          "#d47832",
          0.45 + 0.15 * Math.sin(f.time * 2 + i),
        );
      }
      c.restore();
      c.restore();
      return;
    }
    for (const m of size >= 18 ? s.mounts || [] : []) {
      const w = catalog.getWeapon(m.weaponId || m.defaultWeapon);
      if (!w) continue;
      const pos = point(s, m.x, m.y),
        q = ui.toScreen(pos.x, pos.y),
        a = Number.isFinite(m.aimAngle) ? m.aimAngle : s.angle + (m.angle || 0),
        r = Math.max(
          1.5,
          (w.size === "large" ? 5.8 : w.size === "medium" ? 4 : 2.7) * z,
        );
      const last = f.shots[s.id + ":" + m.id] ?? f.shots[s.id + ":" + w.id],
        age = last === undefined ? 10 : f.time - last,
        recoil = age < 0.18 ? Math.sin((age / 0.18) * Math.PI) * r * 0.65 : 0;
      c.save();
      c.translate(q.x, q.y);
      c.rotate(a);
      circle(c, 0, 0, r * 1.23, "#0a1017");
      circle(c, 0, 0, r, "#697477");
      c.fillStyle = "#26353c";
      c.fillRect(-r * 0.7, -r * 0.65, r * 1.5, r * 1.3);
      c.fillStyle = "#9aa2a0";
      c.fillRect(-recoil, -r * 0.23, r * 2.6, r * 0.46);
      c.fillStyle = "#35454d";
      c.fillRect(r * 2.1 - recoil, -r * 0.32, r * 0.6, r * 0.64);
      if (age < 0.105) {
        c.globalCompositeOperation = "lighter";
        glow(
          c,
          r * 2.8,
          0,
          r * (3.8 - age * 24),
          w.color || "#ffc27a",
          1 - age / 0.105,
        );
        c.fillStyle = "#fff1c9";
        c.beginPath();
        c.moveTo(r * 2.3, -r * 0.7);
        c.lineTo(r * (5.5 - age * 20), 0);
        c.lineTo(r * 2.3, r * 0.7);
        c.fill();
      }
      c.restore();
    }
    if (s.shieldOn && s.shieldLevel > 0 && !s.ghost && size >= 18) {
      const rr = (s.radius + 8) * z,
        arc = (s.shieldArc || Math.PI) * s.shieldLevel;
      c.save();
      c.translate(p.x, p.y);
      c.rotate(s.angle);
      const g = c.createRadialGradient(0, 0, rr * 0.7, 0, 0, rr);
      g.addColorStop(0, "#69bfff00");
      g.addColorStop(1, "#69bfff24");
      c.beginPath();
      c.moveTo(0, 0);
      c.arc(0, 0, rr, -arc / 2, arc / 2);
      c.closePath();
      c.fillStyle = g;
      c.fill();
      c.beginPath();
      c.arc(0, 0, rr, -arc / 2, arc / 2);
      c.strokeStyle = "#a6e6f8a0";
      c.lineWidth = Math.max(1.2, 2.2 * z);
      c.stroke();
      c.restore();
    }
    if (selected) {
      const rr = Math.max(13, size * 0.54);
      c.strokeStyle = col + "99";
      c.lineWidth = 1;
      for (let i = 0; i < 4; i++) {
        c.beginPath();
        c.arc(p.x, p.y, rr, (i * Math.PI) / 2 + 0.2, (i * Math.PI) / 2 + 0.52);
        c.stroke();
      }
      line(
        c,
        p.x + Math.cos(s.angle) * (rr + 3),
        p.y + Math.sin(s.angle) * (rr + 3),
        p.x + Math.cos(s.angle) * (rr + 11),
        p.y + Math.sin(s.angle) * (rr + 11),
        col,
        2,
      );
    }
    if ((size > 28 || selected) && s.hp > 0) {
      const bw = clamp(size * 0.63, 28, 72),
        y = p.y + size * 0.5 + 8;
      // The flagship carries its own ring gauges in battle; skip the duplicate bars.
      const ringed =
        ui.screen === "battle" &&
        s.id === ui.flagshipId &&
        ui.drawFlagshipGauge;
      if (!ringed) {
        c.fillStyle = "#253543";
        c.fillRect(p.x - bw / 2, y, bw, 3);
        c.fillStyle = col;
        c.fillRect(p.x - bw / 2, y, bw * clamp(s.hp / s.maxHp, 0, 1), 3);
        c.fillStyle = "#d5b57d";
        c.fillRect(
          p.x - bw / 2,
          y + 6,
          bw * clamp((s.softFlux + s.hardFlux) / s.maxFlux, 0, 1),
          2,
        );
      }
      if (ui.text) {
        if (s.overload > 0 || s.venting > 0)
          ui.text(
            s.overload > 0 ? "过载" : "散幅",
            p.x,
            p.y - size * 0.57 - 10,
            11,
            s.overload > 0 ? "#ed9989" : "#85ccea",
            "center",
          );
        if (ui.screen !== "battle" || selected)
          ui.text(d.name, p.x, y + 20, 11, col, "center");
      }
    }
    if (s.overload > 0 && !s.ghost && size >= 18) {
      // Overload: crawling arcs tell the player this ship is helpless right now.
      c.save();
      c.globalCompositeOperation = "lighter";
      c.strokeStyle = "#bfe9ff";
      c.lineWidth = Math.max(1, 1.6 * z);
      const tick = Math.floor(f.time * 18);
      for (let i = 0; i < 4; i++) {
        let n = (tick * 7919 + i * 104729 + (s.x | 0)) >>> 0;
        const next = () =>
          (n = (Math.imul(n, 1664525) + 1013904223) >>> 0) / 4294967296;
        let a = next() * TAU,
          rad = size * (0.15 + next() * 0.3);
        c.beginPath();
        c.moveTo(p.x + Math.cos(a) * rad, p.y + Math.sin(a) * rad);
        for (let j = 0; j < 4; j++) {
          a += (next() - 0.5) * 1.3;
          rad += (next() - 0.4) * size * 0.14;
          c.lineTo(p.x + Math.cos(a) * rad, p.y + Math.sin(a) * rad);
        }
        c.stroke();
      }
      glow(
        c,
        p.x,
        p.y,
        size * 0.55,
        "#7fc8ff",
        0.18 + 0.12 * Math.sin(f.time * 30),
      );
      c.restore();
    }
    if (s.systemTime > 0) {
      c.beginPath();
      c.arc(p.x, p.y, size * 0.56, 0, TAU);
      c.strokeStyle = "#ddba8380";
      c.stroke();
    }
    c.restore();
  }
  function drawOrdnance(ui) {
    const c = ui.ctx,
      f = state(ui),
      b = ui.battle,
      z = ui.camera.scale;
    if (!b) return;
    c.save();
    c.lineCap = "round";
    for (const p of f.particles) {
      const q = ui.toScreen(p.x, p.y);
      if (q.x < -50 || q.x > ui.width + 50 || q.y < -50 || q.y > ui.height + 50)
        continue;
      const life = p.life / p.max;
      c.globalAlpha =
        life * (p.kind === "smoke" ? 0.25 : p.kind === "exhaust" ? 0.16 : 0.65);
      const r =
        Math.max(0.65, p.r * z) *
        (p.kind === "smoke" ? 1 + (1 - life) * 2.7 : 1);
      if (p.kind === "chunk") {
        // Wreckage: dark tumbling plates with a cooling ember edge.
        c.save();
        c.globalAlpha = Math.min(1, life * 2.5);
        c.translate(q.x, q.y);
        c.rotate(p.angle + (p.max - p.life) * (p.spin || 2));
        c.fillStyle = "#2b3238";
        c.beginPath();
        c.moveTo(-r, -r * 0.5);
        c.lineTo(r * 0.7, -r * 0.7);
        c.lineTo(r, r * 0.3);
        c.lineTo(-r * 0.4, r * 0.7);
        c.closePath();
        c.fill();
        c.strokeStyle = life > 0.5 ? "#ff9d52" : "#5d6a70";
        c.lineWidth = Math.max(0.6, r * 0.12);
        c.stroke();
        c.restore();
      } else if (p.kind === "smoke" || p.kind === "exhaust") {
        circle(c, q.x, q.y, r, p.kind === "smoke" ? "#5b514b" : p.color);
      } else {
        c.globalCompositeOperation = "lighter";
        if (p.kind === "spark")
          line(
            c,
            q.x,
            q.y,
            q.x - p.vx * z * 0.035,
            q.y - p.vy * z * 0.035,
            p.color,
            Math.max(0.7, r * 0.6),
          );
        else if (p.kind === "debris") {
          c.save();
          c.globalCompositeOperation = "source-over";
          c.globalAlpha = Math.min(1, life * 1.8);
          c.translate(q.x, q.y);
          c.rotate(p.angle + (p.max - p.life) * 8);
          c.fillStyle = life > 0.7 ? "#f7c592" : "#807870";
          c.fillRect(-r, -r * 0.35, r * 2, r * 0.7);
          c.restore();
        } else glow(c, q.x, q.y, r * 1.8, p.color, 0.6);
        c.globalCompositeOperation = "source-over";
      }
    }
    c.globalAlpha = 1;
    c.globalCompositeOperation = "lighter";
    for (const p of b.projectiles || []) {
      const q = ui.toScreen(p.x, p.y),
        w = catalog.getWeapon(p.weaponId),
        energy = w && w.type === "energy",
        missile = p.kind === "missile",
        heavy = (p.damage || 0) > 300,
        col = p.color || "#ffca76",
        a = p.angle || 0,
        trail = f.trails[p.id] || [],
        width = Math.max(1.1, z * (heavy ? 3.4 : energy ? 3 : 1.8)),
        len = Math.max(7, Math.min(34, (p.speed || 400) * 0.045 * z));
      if (energy || missile) {
        for (let i = 1; i < trail.length; i++) {
          const a = ui.toScreen(trail[i - 1].x, trail[i - 1].y),
            bb = ui.toScreen(trail[i].x, trail[i].y);
          c.globalAlpha = (i / trail.length) * 0.32;
          line(c, a.x, a.y, bb.x, bb.y, col, (width * i) / trail.length);
        }
        c.globalAlpha = 1;
      }
      if (!energy && !missile) {
        // A solid shell with a brief shutter-length tracer, not a glowing laser capsule.
        c.save();
        c.translate(q.x, q.y);
        c.rotate(a);
        const shellLength = Math.max(2.5, (heavy ? 9 : 4) * z),
          shellWidth = Math.max(0.85, (heavy ? 2.6 : 1.2) * z),
          streak = Math.max(7, Math.min(46, (p.speed || 650) * 0.05 * z)),
          gradient = c.createLinearGradient(-streak, 0, 0, 0);
        gradient.addColorStop(0, "#ffc87700");
        gradient.addColorStop(0.65, "#ffbf7060");
        gradient.addColorStop(1, "#ffe0a9cc");
        line(c, -streak, 0, -shellLength * 0.35, 0, gradient, shellWidth);
        glow(c, 0, 0, shellWidth * (heavy ? 4.5 : 3.2), col, heavy ? 0.7 : 0.5);
        c.globalCompositeOperation = "source-over";
        c.fillStyle = heavy ? "#bca684" : "#ead4a7";
        c.beginPath();
        c.moveTo(shellLength * 0.55, 0);
        c.lineTo(shellLength * 0.15, -shellWidth * 0.6);
        c.lineTo(-shellLength * 0.55, -shellWidth * 0.6);
        c.lineTo(-shellLength * 0.55, shellWidth * 0.6);
        c.lineTo(shellLength * 0.15, shellWidth * 0.6);
        c.closePath();
        c.fill();
        line(
          c,
          -shellLength * 0.3,
          -shellWidth * 0.25,
          shellLength * 0.25,
          0,
          "#fff4dd",
          0.6,
        );
        c.restore();
        continue;
      }
      const tx = q.x - Math.cos(a) * len,
        ty = q.y - Math.sin(a) * len,
        g = c.createLinearGradient(tx, ty, q.x, q.y);
      g.addColorStop(0, col + "00");
      g.addColorStop(1, col);
      line(c, tx, ty, q.x, q.y, g, width * 2.8);
      line(
        c,
        tx + Math.cos(a) * len * 0.4,
        ty + Math.sin(a) * len * 0.4,
        q.x,
        q.y,
        "#fff1d3",
        width * 0.62,
      );
      if (energy) glow(c, q.x, q.y, width * 4, col, 0.65);
      if (missile) {
        c.save();
        c.translate(q.x, q.y);
        c.rotate(a);
        flame(
          c,
          -4 * z,
          0,
          Math.max(1.6, 3 * z),
          Math.max(8, 14 * z),
          "#ffb164",
          f.time * 40,
        );
        c.fillStyle = "#d3d9cd";
        const big = p.child ? 0.7 : w && w.size === "large" ? 2 : w && w.size === "medium" ? 1.4 : 1;
        c.fillRect(-4 * z * big, -Math.max(1, z * big), 8 * z * big, Math.max(2, z * 2 * big));
        c.fillStyle = col;
        c.fillRect(2 * z * big, -Math.max(1, z * big), 2 * z * big, Math.max(2, z * 2 * big));
        c.restore();
      } else circle(c, q.x, q.y, width * 0.75, "#fff5de");
    }
    for (const beam of b.beams || []) {
      const p = ui.toScreen(beam.x, beam.y),
        q = ui.toScreen(beam.x2, beam.y2),
        col = beam.color || "#8cdec8",
        heavy = !(catalog.getWeapon(beam.weaponId) || {}).pd,
        k = heavy ? 1 : 0.55,
        pulse =
          1 +
          Math.sin(f.time * 47 + p.x * 0.05) * 0.16 +
          Math.sin(f.time * 131) * 0.08,
        length = Math.hypot(q.x - p.x, q.y - p.y) || 1,
        ux = (q.x - p.x) / length,
        uy = (q.y - p.y) / length;
      // Soft halo, coloured body, white-hot core; width breathes so it reads as energy.
      line(c, p.x, p.y, q.x, q.y, col + "16", Math.max(7, 20 * z) * pulse * k);
      line(c, p.x, p.y, q.x, q.y, col + "55", Math.max(3.5, 9 * z) * pulse * k);
      line(c, p.x, p.y, q.x, q.y, col + "d0", Math.max(2, 4.2 * z) * k);
      line(c, p.x, p.y, q.x, q.y, "#f4fdff", Math.max(0.9, 1.7 * z) * k);
      // Energy pulses racing down the beam.
      const step = Math.max(26, 70 * z),
        offset = (f.time * 620 * z) % step;
      c.globalAlpha = 0.55;
      for (let d = offset; d < length; d += step)
        line(
          c,
          p.x + ux * d,
          p.y + uy * d,
          p.x + ux * Math.min(length, d + step * 0.22),
          p.y + uy * Math.min(length, d + step * 0.22),
          "#ffffff",
          Math.max(1.4, 3 * z) * k,
        );
      c.globalAlpha = 1;
      glow(c, p.x, p.y, Math.max(6, 16 * z) * k, col, 0.75);
      circle(c, p.x, p.y, Math.max(1.5, 3.4 * z) * k, "#f4fdff");
      glow(c, q.x, q.y, Math.max(9, 26 * z) * pulse * k, col, 0.8);
      circle(c, q.x, q.y, Math.max(2, 5 * z) * pulse * k, "#ffffff");
    }
    for (const e of f.bursts) {
      let x = e.x,
        y = e.y,
        angle = e.angle;
      if (!e.explosion && e.targetId) {
        const target = b.ships.find((s) => s.id === e.targetId);
        if (target) {
          const anchored = point(target, e.offsetX, e.offsetY);
          x = anchored.x;
          y = anchored.y;
          angle = target.angle + e.localAngle;
        }
      }
      const q = ui.toScreen(x, y),
        life = e.life / e.max,
        age = 1 - life,
        r = Math.max(3, e.r * z);
      c.globalAlpha = life;
      if (e.shield) {
        const target = e.targetId && b.ships.find((s) => s.id === e.targetId);
        if (target && target.radius) {
          // The hit spreads sideways across the bubble instead of floating in space.
          const o = ui.toScreen(target.x, target.y),
            rr = (target.radius + 8) * z,
            at = Math.atan2(q.y - o.y, q.x - o.x),
            spread = (0.12 + age * 0.55) * (1 + e.tier * 0.35);
          for (let i = 0; i < 3; i++) {
            c.beginPath();
            c.arc(
              o.x,
              o.y,
              rr + i * 2.2,
              at - spread * (1 - i * 0.22),
              at + spread * (1 - i * 0.22),
            );
            c.strokeStyle = i ? "#73c6f0" : "#e4fbff";
            c.lineWidth = Math.max(
              1,
              (3.4 - i) * (1 - age) * (1 + e.tier * 0.4),
            );
            c.stroke();
          }
          for (const side of [-1, 1]) {
            const a2 = at + side * spread;
            glow(
              c,
              o.x + Math.cos(a2) * rr,
              o.y + Math.sin(a2) * rr,
              r * 0.55,
              "#bdeeff",
              life * 0.8,
            );
          }
        } else {
          c.save();
          c.translate(q.x, q.y);
          c.rotate(angle);
          c.scale(0.4, 1);
          for (let i = 0; i < 3; i++) {
            c.beginPath();
            c.arc(0, 0, r * (0.3 + age * 2 + i * 0.26), 0, TAU);
            c.strokeStyle = i ? "#73bded70" : "#cdf9ff";
            c.lineWidth = Math.max(0.7, 2 * (1 - age));
            c.stroke();
          }
          c.restore();
        }
        glow(c, q.x, q.y, r * 1.5, "#8bdcff", life * 0.7);
        circle(c, q.x, q.y, r * 0.3 * life, "#f2fdff");
      } else if (e.explosion) {
        glow(c, q.x, q.y, r * (0.6 + age * 1.4), "#ff7c2a", life * 0.65);
        glow(c, q.x, q.y, r * (0.35 + age * 0.5), "#ffc77a", life);
        glow(c, q.x, q.y, r * 0.32 * life, "#fff4cc", life);
        if (age < 0.14)
          glow(c, q.x, q.y, r * (0.9 + age * 4), "#fffbe8", 1 - age / 0.14);
        for (const ring of [2.4, 1.5]) {
          c.beginPath();
          c.arc(q.x, q.y, r * (0.35 + age * ring), 0, TAU);
          c.strokeStyle = ring > 2 ? "#ffd9a0" : "#ff9a4a";
          c.lineWidth = Math.max(0.8, (ring > 2 ? 5 : 3) * z * life * life);
          c.stroke();
        }
      } else if (e.beam) {
        glow(c, q.x, q.y, r, e.color, life * 0.35);
        circle(c, q.x, q.y, Math.max(0.7, r * 0.2) * life, "#dcf4ff");
      } else {
        const seconds = e.max - e.life;
        const flash = Math.max(0, 1 - seconds / 0.085);
        // Bright contact lasts milliseconds; ejecta and smoke carry the longer aftermath.
        glow(c, q.x, q.y, r * (1 + age), e.color, life * life * 0.35);
        if (flash > 0) {
          glow(c, q.x, q.y, r * 1.25, "#ffc48a", flash);
          circle(c, q.x, q.y, r * 0.35 * flash, "#fff5df");
          c.save();
          c.translate(q.x, q.y);
          c.rotate(angle);
          line(
            c,
            -r * 0.3,
            0,
            r * (1.2 + e.tier * 0.3),
            0,
            "#fff1c9",
            Math.max(1, 2 * z * flash),
          );
          c.restore();
        }
        if (e.tier > 0 && seconds < 0.22) {
          c.globalAlpha = (1 - seconds / 0.22) * 0.45;
          c.beginPath();
          c.arc(q.x, q.y, r * (0.4 + seconds * 6), 0, TAU);
          c.strokeStyle = "#f3bd86";
          c.lineWidth = Math.max(0.6, 1.5 * z);
          c.stroke();
        }
      }
    }
    if (f.flash > 0.01) {
      c.globalAlpha = Math.min(0.2, f.flash * 0.45);
      c.fillStyle = "#ffe9c4";
      c.fillRect(0, 0, ui.width, ui.height);
    }
    c.restore();
  }
  return { drawSpace, drawShip, drawOrdnance, update, reset };
});

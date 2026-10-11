(function (root) {
  "use strict";
  const Ships =
    typeof module !== "undefined" && module.exports
      ? require("./ships")
      : root.StarShips;
  const WORLD = Object.freeze({ width: 4800, height: 3000 });
  const BUDGET = 100;
  const MAX_FLEET = 4;
  const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
  const positive = (n, fallback) =>
    Number.isFinite(n) && n > 0 ? n : fallback;

  function validateFleet(ids) {
    if (!Array.isArray(ids))
      return { ok: false, cost: 0, reason: "编队格式无效" };
    let cost = 0;
    for (const id of ids) {
      const def = Ships.getShip(id);
      if (!def || !Number.isFinite(def.cost))
        return { ok: false, cost, reason: "未知舰船型号：" + String(id) };
      cost += def.cost;
    }
    if (ids.length < 1 || ids.length > MAX_FLEET)
      return { ok: false, cost, reason: "编队须有1至4艘舰船（含预备舰）" };
    if (cost > BUDGET)
      return { ok: false, cost, reason: "编队总预算超过" + BUDGET + "（含预备舰）" };
    return { ok: true, cost, reason: "" };
  }

  function fitScale(cam) {
    return Math.min(cam.width / WORLD.width, cam.height / WORLD.height);
  }
  function focusBounds(cam) {
    const top = clamp(
      Number.isFinite(cam.focusTop) ? cam.focusTop : 0,
      0,
      cam.height - 1,
    );
    const bottom = clamp(
      Number.isFinite(cam.focusBottom) ? cam.focusBottom : cam.height,
      top + 1,
      cam.height,
    );
    return { top, bottom, height: bottom - top, center: (top + bottom) / 2 };
  }
  function constrain(cam) {
    const halfW = cam.width / (2 * cam.scale),
      halfH = cam.height / (2 * cam.scale);
    // Following may reveal space beyond the arena edge. Clamping the full view
    // to the arena would push edge-deployed flagships underneath the flight HUD.
    if (cam.mode === "follow") {
      cam.x = clamp(cam.x, -halfW, WORLD.width + halfW);
      cam.y = clamp(cam.y, -halfH, WORLD.height + halfH);
      return cam;
    }
    cam.x =
      halfW >= WORLD.width / 2
        ? WORLD.width / 2
        : clamp(cam.x, halfW, WORLD.width - halfW);
    cam.y =
      halfH >= WORLD.height / 2
        ? WORLD.height / 2
        : clamp(cam.y, halfH, WORLD.height - halfH);
    return cam;
  }
  function rescale(cam) {
    // Hulls must read as ships on a phone: scale follows screen height so the
    // flagship stays roughly a fifth of the view on any landscape device.
    cam.baseScale = clamp(cam.height / 700, 0.5, 0.9);
    if (cam.mode === "overview") {
      cam.scale = fitScale(cam);
      cam.zoom = cam.scale / cam.baseScale;
      cam.x = WORLD.width / 2;
      cam.y = WORLD.height / 2;
    } else {
      cam.scale = cam.baseScale * cam.zoom;
    }
    return constrain(cam);
  }
  function createCamera(viewWidth, viewHeight) {
    return rescale({
      x: 2400,
      y: 1500,
      zoom: 1,
      width: positive(viewWidth, 1600),
      height: positive(viewHeight, 900),
      mode: "follow",
    });
  }
  function resizeCamera(cam, w, h) {
    cam.width = positive(w, cam.width);
    cam.height = positive(h, cam.height);
    return rescale(cam);
  }
  function setCameraFocus(cam, top, bottom) {
    cam.focusTop = Number.isFinite(top) ? top : 0;
    cam.focusBottom = Number.isFinite(bottom) ? bottom : cam.height;
    return rescale(cam);
  }
  function setCameraMode(cam, mode) {
    if (!["follow", "overview", "free"].includes(mode)) return cam;
    if (cam.mode === "overview" && mode !== "overview") cam.zoom = 1;
    cam.mode = mode;
    return rescale(cam);
  }
  function worldToScreen(cam, x, y) {
    return {
      x: (x - cam.x) * cam.scale + cam.width / 2,
      y: (y - cam.y) * cam.scale + cam.height / 2,
    };
  }
  function screenToWorld(cam, x, y) {
    return {
      x: (x - cam.width / 2) / cam.scale + cam.x,
      y: (y - cam.height / 2) / cam.scale + cam.y,
    };
  }
  function updateCamera(cam, dt, ship, aimAngle) {
    if (cam.mode === "overview") return rescale(cam);
    if (
      cam.mode !== "follow" ||
      !ship ||
      !Number.isFinite(ship.x) ||
      !Number.isFinite(ship.y)
    )
      return constrain(cam);
    const focus = focusBounds(cam);
    // Keep the hull and its compact status bars within the unobscured area.
    const margin = Math.min(
      focus.height * 0.45,
      Math.max(12, (ship.length || 100) * cam.scale * 0.57 + 19),
    );
    const lead = Number.isFinite(aimAngle)
      ? Math.min(260, (focus.height * 0.24) / cam.scale)
      : 0;
    const leadX = lead ? Math.cos(aimAngle) * lead : 0;
    const leadY = lead ? Math.sin(aimAngle) * lead : 0;
    const screenY = clamp(
      focus.center - leadY * cam.scale,
      focus.top + margin,
      focus.bottom - margin,
    );
    const targetX = ship.x + leadX;
    const targetY = ship.y - (screenY - cam.height / 2) / cam.scale;
    const blend = 1 - Math.exp(-4 * Math.max(0, Number.isFinite(dt) ? dt : 0));
    cam.x += (targetX - cam.x) * blend;
    cam.y += (targetY - cam.y) * blend;
    return constrain(cam);
  }
  function zoomCamera(cam, factor, screenX, screenY) {
    if (!Number.isFinite(factor) || factor <= 0) return cam;
    const sx = Number.isFinite(screenX) ? screenX : cam.width / 2;
    const sy = Number.isFinite(screenY) ? screenY : cam.height / 2;
    const anchor = screenToWorld(cam, sx, sy);
    // Wheel/pinch can grow continuously out of overview without an abrupt 1x jump.
    if (cam.mode === "overview") cam.mode = "free";
    cam.zoom = clamp(
      cam.zoom * factor,
      Math.min(0.5, fitScale(cam) / cam.baseScale),
      2.5,
    );
    cam.scale = cam.baseScale * cam.zoom;
    cam.x = anchor.x - (sx - cam.width / 2) / cam.scale;
    cam.y = anchor.y - (sy - cam.height / 2) / cam.scale;
    return constrain(cam);
  }
  function panCamera(cam, dxScreen, dyScreen) {
    if (!Number.isFinite(dxScreen) || !Number.isFinite(dyScreen)) return cam;
    cam.mode = "free";
    cam.x -= dxScreen / cam.scale;
    cam.y -= dyScreen / cam.scale;
    return constrain(cam);
  }

  function hullRadius(ship) {
    if (Number.isFinite(ship.radius) && ship.radius > 0) return ship.radius;
    const def = Ships.getShip(ship.typeId) || {};
    return (
      Math.hypot(
        positive(ship.length, positive(def.length, 100)),
        positive(ship.width, positive(def.width, 100)),
      ) / 2
    );
  }
  function deploymentZone(team, stage = "initial") {
    const ys =
      stage === "initial"
        ? team === 0
          ? [2100, 2600]
          : [400, 900]
        : team === 0
          ? [2500, 2800]
          : [200, 500];
    return { minX: 400, maxX: 4400, minY: ys[0], maxY: ys[1] };
  }
  function placement(s, shipId, x, y, stage = "initial") {
    const fail = (reason) => ({ ok: false, reason });
    if (!s || !Array.isArray(s.ships)) return fail("战场数据无效");
    const ship = s.ships.find((v) => v.id === shipId);
    if (!ship || ship.status !== "reserve")
      return fail("只能部署尚未入场的预备舰");
    if (ship.team !== 0 && ship.team !== 1) return fail("舰船阵营无效");
    if (stage !== "initial" && stage !== "reinforcement")
      return fail("部署阶段无效");
    if (!Number.isFinite(x) || !Number.isFinite(y)) return fail("部署坐标无效");
    // Every instance counts, including reserves, destroyed and retreated ships: deployment never refunds budget.
    const fleet = validateFleet(
      s.ships.filter((v) => v.team === ship.team).map((v) => v.typeId),
    );
    if (!fleet.ok) return fail(fleet.reason);
    const radius = hullRadius(ship);
    const width = positive(s.width, WORLD.width),
      height = positive(s.height, WORLD.height);
    if (
      x - radius < 0 ||
      x + radius > width ||
      y - radius < 0 ||
      y + radius > height
    )
      return fail("完整舰体必须处于战场边界内");
    const zone = deploymentZone(ship.team, stage);
    if (x < zone.minX || x > zone.maxX || y < zone.minY || y > zone.maxY)
      return fail(
        stage === "initial" ? "请放入己方初始部署带" : "请放入己方边缘增援带",
      );
    for (const other of s.ships) {
      if (other.id === ship.id || other.status !== "active") continue;
      const distance = Math.hypot(x - other.x, y - other.y);
      if (distance < radius + hullRadius(other) + 20)
        return fail("舰体重叠，请留出部署间距");
      if (
        stage === "reinforcement" &&
        other.team !== ship.team &&
        distance < 900
      )
        return fail("敌舰控制此处，增援须距敌舰至少900");
    }
    return { ok: true, reason: "" };
  }
  function findPlacement(s, shipId, stage = "initial") {
    if (!s || !Array.isArray(s.ships)) return null;
    const ship = s.ships.find((v) => v.id === shipId);
    if (
      !ship ||
      ship.status !== "reserve" ||
      !["initial", "reinforcement"].includes(stage)
    )
      return null;
    const zone = deploymentZone(ship.team, stage);
    const middleX = (zone.minX + zone.maxX) / 2,
      middleY = (zone.minY + zone.maxY) / 2,
      columns = [middleX],
      rows = [middleY];
    for (let offset = 100; offset <= (zone.maxX - zone.minX) / 2; offset += 100)
      columns.push(middleX - offset, middleX + offset);
    for (let offset = 50; offset <= (zone.maxY - zone.minY) / 2; offset += 50)
      rows.push(middleY - offset, middleY + offset);
    for (const y of rows)
      for (const x of columns) {
        if (placement(s, shipId, x, y, stage).ok)
          return { x, y, angle: ship.team === 0 ? -Math.PI / 2 : Math.PI / 2 };
      }
    return null;
  }
  const api = {
    WORLD,
    BUDGET,
    MAX_FLEET,
    validateFleet,
    createCamera,
    resizeCamera,
    setCameraFocus,
    setCameraMode,
    updateCamera,
    zoomCamera,
    panCamera,
    worldToScreen,
    screenToWorld,
    deploymentZone,
    placement,
    findPlacement,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.StarNavigation = api;
})(typeof globalThis !== "undefined" ? globalThis : this);

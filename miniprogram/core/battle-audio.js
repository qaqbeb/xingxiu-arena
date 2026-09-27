(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.StarBattleAudio = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  function spatial(camera, x, y) {
    const d = Math.hypot((x || 0) - camera.x, (y || 0) - camera.y);
    // World-space listener: zoom never makes distant guns sound close.
    const edge = Math.max(0, Math.min(1, (2600 - d) / 500));
    return { gain: edge / (1 + (d / 520) ** 2), far: d > 650, distance: d };
  }
  function beams(ui, catalog) {
    if (
      !ui.sound ||
      ui.paused ||
      ui.modal ||
      ui.screen !== "battle" ||
      !ui.battle ||
      ui.battle.status === "finished"
    )
      return [];
    const groups = {};
    for (const b of ui.battle.beams || []) {
      const w = catalog.getWeapon(b.weaponId);
      if (!w) continue;
      const s = spatial(ui.camera, b.x, b.y);
      const key = w.pd ? "beam_pd_loop" : "beam_loop";
      const volume = (w.pd ? 0.035 : 0.12) * s.gain;
      groups[key] = Math.min(
        w.pd ? 0.055 : 0.18,
        Math.hypot(groups[key] || 0, volume),
      );
    }
    return Object.entries(groups).map(([key, volume]) => ({ key, volume }));
  }
  // One reusable voice per beam family, independent of event ticks or mount count.
  function createLoops(create) {
    const voices = new Map();
    function sync(requests, dt = 0.016, duck = 1) {
      const wanted = new Map(requests.map((r) => [r.key, r.volume * duck]));
      for (const [key, target] of wanted) {
        if (target < 0.001) continue;
        if (!voices.has(key)) {
          const audio = create(key);
          audio.loop = true;
          voices.set(key, { audio, volume: 0, playing: false });
        }
        const v = voices.get(key);
        if (!v.playing) {
          v.audio.volume = 0.001;
          v.playing = true;
          try {
            const pending = v.audio.play();
            if (pending && pending.catch)
              pending.catch(() => {
                v.playing = false;
              });
          } catch (_) {
            v.playing = false;
          }
        }
      }
      for (const [key, v] of voices) {
        const target = wanted.get(key) || 0;
        v.volume +=
          (target - v.volume) *
          (1 - Math.exp(-Math.max(0, dt) * (target ? 18 : 28)));
        v.audio.volume = Math.max(0, Math.min(0.18, v.volume));
        if (!target && v.volume < 0.002 && v.playing) {
          try {
            v.audio.stop();
          } catch (_) {}
          v.playing = false;
          v.volume = 0;
        }
      }
    }
    function stop() {
      for (const v of voices.values()) {
        try {
          v.audio.stop();
        } catch (_) {}
        v.playing = false;
        v.volume = 0;
      }
    }
    return { sync, stop };
  }
  return { spatial, beams, createLoops };
});

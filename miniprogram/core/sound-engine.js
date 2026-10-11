(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.StarSoundEngine = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  // Web Audio mixer shared by the browser and WeChat adapters. Compared with
  // one media element per voice it starts sounds on the same frame as the hit,
  // and can re-pitch, pan and muffle a single recording instead of shipping
  // pre-rendered variants.
  const LAYERED = [
    "kinetic",
    "cannon_medium",
    "cannon_heavy",
    "plasma",
    "missile",
    "impact_metal",
    "impact_solid",
    "impact_heavy",
    "impact_shield",
    "impact_plasma",
    "explosion",
    "shield",
    "beam_loop",
    "beam_pd_loop",
    "ambient_loop",
  ];
  const LEGACY = [
    "ui",
    "victory",
    "thrust",
    "strafe",
    "vent",
    "system",
    "beam",
    "impact_beam",
    "impact_beam_shield",
  ];
  // Seconds a sound must wait before it may retrigger; heavy sounds overlap less.
  const GAP = {
    ui: 0.035,
    kinetic: 0.045,
    impact_metal: 0.045,
    thrust: 0.18,
    explosion: 0.09,
  };
  const HEAVY = ["impact_heavy", "impact_solid", "explosion", "cannon_heavy"];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // load(path) must resolve to an ArrayBuffer of the encoded file.
  function create(context, load) {
    const buffers = Object.create(null),
      last = Object.create(null),
      voices = [],
      loops = Object.create(null);
    let seed = 20261011;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const master = context.createGain(),
      effects = context.createGain(),
      impacts = context.createGain(),
      beds = context.createGain();
    master.gain.value = 0.9;
    let output = master;
    if (context.createDynamicsCompressor) {
      // Glue: a busy broadside gets denser instead of clipping.
      const squeeze = context.createDynamicsCompressor();
      try {
        squeeze.threshold.value = -14;
        squeeze.knee.value = 12;
        squeeze.ratio.value = 5;
        squeeze.attack.value = 0.003;
        squeeze.release.value = 0.18;
      } catch (_) {}
      master.connect(squeeze);
      output = squeeze;
    }
    output.connect(context.destination);
    for (const bus of [effects, impacts, beds]) bus.connect(master);

    function decode(name, path) {
      return Promise.resolve()
        .then(() => load(path))
        .then(
          (data) =>
            new Promise((resolve, reject) => {
              const pending = context.decodeAudioData(data, resolve, reject);
              if (pending && pending.then) pending.then(resolve, reject);
            }),
        )
        .then((buffer) => {
          buffers[name] = buffer;
        })
        .catch(() => {});
    }
    const ready = Promise.all(
      LAYERED.map((n) => decode(n, "assets/sfx/" + n + ".wav")).concat(
        LEGACY.map((n) => decode(n, "assets/audio/" + n + ".wav")),
      ),
    );

    function resume() {
      try {
        if (context.state === "suspended" && context.resume) context.resume();
      } catch (_) {}
    }
    function suspend() {
      stopLoops();
      for (const v of voices.splice(0)) {
        try {
          v.source.stop();
        } catch (_) {}
      }
    }

    // options: far (muffle), pan (-1..1), pitch (rate multiplier)
    function play(name, volume, options) {
      const buffer = buffers[name];
      if (!buffer || !(volume >= 0.008)) return false;
      resume();
      const now = context.currentTime,
        o = options || {};
      if (now - (last[name] === undefined ? -1 : last[name]) < (GAP[name] || 0.06))
        return false;
      const impact = name.indexOf("impact_") === 0 || name === "explosion";
      for (let i = voices.length - 1; i >= 0; i--)
        if (voices[i].until <= now) voices.splice(i, 1);
      if (voices.length >= 20) {
        if (!impact) return false;
        // Contact always wins a channel from the oldest gunfire or engine voice.
        const victim = voices.findIndex((v) => !v.impact);
        if (victim < 0) return false;
        try {
          voices[victim].source.stop();
        } catch (_) {}
        voices.splice(victim, 1);
      }
      last[name] = now;
      const source = context.createBufferSource(),
        level = context.createGain(),
        heavy = HEAVY.indexOf(name) >= 0,
        // No two shots are identical: small random pitch and level offsets.
        rate =
          (o.pitch || 1) *
          (name === "ui" || name === "victory"
            ? 1
            : 1 + (random() - 0.5) * (heavy ? 0.1 : 0.16));
      source.buffer = buffer;
      source.playbackRate.value = rate;
      level.gain.value = clamp(volume, 0, 1) * (0.92 + random() * 0.16);
      let node = source;
      if (o.far && context.createBiquadFilter) {
        // Distance removes the crack and keeps the thump.
        const filter = context.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 900;
        node.connect(filter);
        node = filter;
      }
      if (o.pan && context.createStereoPanner) {
        const panner = context.createStereoPanner();
        panner.pan.value = clamp(o.pan, -1, 1) * 0.8;
        node.connect(panner);
        node = panner;
      }
      node.connect(level);
      level.connect(impact ? impacts : effects);
      source.start(0);
      voices.push({ source, impact, until: now + buffer.duration / rate });
      if (heavy && impact && !o.far) {
        // Duck everything else briefly so the blow owns the mix.
        const dip = name === "explosion" ? 0.3 : 0.5,
          hold = name === "explosion" ? 0.4 : 0.22;
        for (const bus of [effects, beds]) {
          try {
            bus.gain.cancelScheduledValues(now);
            bus.gain.setValueAtTime(dip, now);
            bus.gain.linearRampToValueAtTime(1, now + hold);
          } catch (_) {
            bus.gain.value = 1;
          }
        }
      }
      return true;
    }

    function loopVoice(key) {
      if (loops[key]) return loops[key];
      const buffer = buffers[key];
      if (!buffer) return null;
      const source = context.createBufferSource(),
        level = context.createGain();
      source.buffer = buffer;
      source.loop = true;
      level.gain.value = 0;
      source.connect(level);
      level.connect(beds);
      source.start(0);
      return (loops[key] = { source, level, volume: 0 });
    }
    function syncLoops(requests, dt) {
      resume();
      const wanted = { ambient_loop: 0.16 };
      for (const r of requests || [])
        wanted[r.key] = Math.max(wanted[r.key] || 0, r.volume * 1.6);
      for (const key of Object.keys(wanted)) loopVoice(key);
      for (const key of Object.keys(loops)) {
        const v = loops[key],
          target = wanted[key] || 0;
        v.volume +=
          (target - v.volume) *
          (1 - Math.exp(-Math.max(0, dt || 0.016) * (target ? 14 : 24)));
        v.level.gain.value = clamp(v.volume, 0, 0.4);
        if (!target && v.volume < 0.002) {
          try {
            v.source.stop();
          } catch (_) {}
          delete loops[key];
        }
      }
    }
    function stopLoops() {
      for (const key of Object.keys(loops)) {
        try {
          loops[key].source.stop();
        } catch (_) {}
        delete loops[key];
      }
    }
    return {
      ready,
      play,
      syncLoops,
      stopLoops,
      resume,
      suspend,
      has: (name) => !!buffers[name],
    };
  }
  return { create, LAYERED, LEGACY };
});

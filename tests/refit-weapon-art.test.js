"use strict";
const assert = require("node:assert/strict");
const art = require("../miniprogram/core/refit-weapon-art.js");

function context() {
  const calls = [];
  let depth = 0;
  const c = { calls, depth: () => depth };
  ["translate", "scale", "moveTo", "lineTo", "fillRect", "arc"].forEach(name => {
    c[name] = (...args) => {
      assert(args.every(Number.isFinite), `${name} received non-finite coordinates`);
      calls.push([name, ...args]);
    };
  });
  ["beginPath", "closePath", "fill", "stroke"].forEach(name => { c[name] = () => {}; });
  c.save = () => { depth++; };
  c.restore = () => { depth--; assert(depth >= 0); };
  return c;
}

const ids = ["chuanyun", "suixing", "bengshan", "zhenhai", "lihuo", "fuling", "zhaoyao", "zhuihun",
  "poyue", "liexing", "tiansan", "guanri", "bailei", "leiting", "yingguang", "dingshen", "pojun", "liuxing"];
const geometry = new Set();
for (const id of ids) {
  for (const [width, height] of [[72,58], [130,110]]) {
    const c = context();
    assert.equal(art.draw(c, { id }, 13, 27, width, height, { selected: true }), true);
    assert.equal(c.depth(), 0, "Canvas state must be balanced");
    // All primitives stay inside the promised 8% local margin, even at the muzzle.
    for (const [name, ...args] of c.calls) {
      if (name === "moveTo" || name === "lineTo") {
        assert(args.every(v => v >= 8 && v <= 92), `${id}: contour leaves art bounds`);
      } else if (name === "fillRect") {
        const [x,y,w,h] = args;
        assert(x >= 8 && y >= 8 && x+w <= 92 && y+h <= 92, `${id}: rectangle leaves art bounds`);
      } else if (name === "arc") {
        const [x,y,r] = args;
        assert(x-r >= 8 && y-r >= 8 && x+r <= 92 && y+r <= 92, `${id}: circle leaves art bounds`);
      }
    }
    if (width === 72) geometry.add(JSON.stringify(c.calls));
  }
}
assert.equal(geometry.size, ids.length, "Weapons must have distinct mechanical geometry");
const invalid = context();
assert.equal(art.draw(invalid, "missing", 0, 0, 72, 58), false);
assert.equal(art.draw(invalid, "chuanyun", 0, NaN, 72, 58), false);
assert.equal(art.draw(invalid, "chuanyun", 0, 0, 0, 58), false);
assert.equal(invalid.calls.length, 0);
const broken = context();
broken.fill = () => { throw new Error("renderer failure"); };
assert.throws(() => art.draw(broken, "chuanyun", 0, 0, 72, 58), /renderer failure/);
assert.equal(broken.depth(), 0, "Canvas state must restore even if rendering throws");
console.log("refit-weapon-art: 18 distinct renderers, both display sizes, geometry and state checks passed");

"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { GameUI } = require("../miniprogram/core/refit-screen");
const catalog = require("../miniprogram/core/ships");
const combat = require("../miniprogram/core/combat");
function fixture(saved, width = 1280, height = 720) {
  const labels = [],
    played = [],
    writes = [],
    canvasStack = [];
  const finite = (name, args) =>
    args.forEach((v) => {
      if (typeof v === "number")
        assert(Number.isFinite(v), name + " received non-finite number");
    });
  const context = new Proxy(
    {
      globalAlpha: 1,
      globalCompositeOperation: "source-over",
      lineWidth: 1,
      save() {
        canvasStack.push(
          Object.fromEntries(
            Object.entries(this).filter(
              ([, value]) => typeof value !== "function",
            ),
          ),
        );
      },
      restore() {
        const saved = canvasStack.pop();
        if (!saved) return;
        for (const key of Object.keys(this))
          if (typeof this[key] !== "function" && !(key in saved))
            delete this[key];
        Object.assign(this, saved);
      },
      fillText(...args) {
        finite("fillText", args);
        labels.push(String(args[0]));
      },
      measureText(value) {
        return { width: String(value).length * 8 };
      },
      createRadialGradient(...args) {
        finite("radialGradient", args);
        return { addColorStop() {} };
      },
      createLinearGradient(...args) {
        finite("linearGradient", args);
        return { addColorStop() {} };
      },
    },
    {
      get(target, key) {
        return key in target
          ? target[key]
          : (...args) => finite(String(key), args);
      },
      set(target, key, value) {
        finite(String(key), [value]);
        target[key] = value;
        return true;
      },
    },
  );
  const canvas = { getContext: () => context };
  const ui = new GameUI({
    canvas,
    assetRoot: "",
    createImage: () => ({
      width: 512,
      height: 512,
      naturalWidth: 512,
      naturalHeight: 512,
      set src(value) {
        this._src = value;
        if (value.includes("nebula")) {
          this.width = this.naturalWidth = 1672;
          this.height = this.naturalHeight = 941;
        }
        if (this.onload) this.onload();
      },
      get src() {
        return this._src;
      },
    }),
    load: () => saved,
    save: (value) => writes.push(structuredClone(value)),
    playSound: (name, volume) => played.push({ name, volume }),
  });
  ui.resize(width, height, 2);
  ui.draw();
  return { ui, labels, played, writes };
}

function click(ui, role, id) {
  ui.draw();
  const b = ui.buttons.find((b) => b.role === role && (!id || b.mountId === id || b.weaponId === id || b.key === id));
  assert(b, "missing active control: " + role + " " + (id || ""));
  const x = b.x + b.w / 2, y = b.y + b.h / 2;
  ui.pointerDown(99, x, y);
  ui.draw(); // A real display frame must not invalidate the pending click.
  ui.pointerUp(99, x, y);
  ui.draw();
}

test("all 14 physical slots expose only compatible weapons and preview does not save", () => {
  const { ui, writes } = fixture();
  let count = 0;
  for (const ship of catalog.SHIPS) {
    ui.fleets[0] = [ship.id]; ui.slot = 0; ui.refit();
    for (const m of ship.mounts) {
      click(ui, "refit-slot", m.id);
      assert.equal(ui.refitState.mountId, m.id);
      assert.equal(ui.refitState.candidateId, m.defaultWeapon);
      const options = ui.buttons.filter((b) => b.role === "refit-weapon");
      assert.equal(options.length, catalog.WEAPONS.filter((w) => w.type === m.type && w.size === m.size).length);
      for (const option of options) {
        click(ui, "refit-weapon", option.weaponId);
        assert.equal(ui.refitState.candidateId, option.weaponId);
        assert.equal(ui.refitWeapon(m).id, m.defaultWeapon);
      }
      count++;
    }
  }
  assert.equal(count, 14);
  assert.equal(writes.length, 0);
  assert.deepEqual(ui.loadouts, {});
});

test("install uses the selected physical slot, persists and reaches real battle loadouts", () => {
  const { ui, writes } = fixture(); ui.refit();
  click(ui, "refit-slot", "b2");
  click(ui, "refit-weapon", "suixing");
  assert.equal(writes.length, 0);
  click(ui, "refit-install");
  assert.equal(ui.loadouts["0-0"].weapons.b2, "suixing");
  assert.equal(ui.loadouts["0-0"].weapons.b1, undefined);
  assert.equal(writes.length, 1);
  assert.equal(ui.fitCost(catalog.getShip("xia"), ui.loadouts["0-0"]), 12);
  click(ui, "refit-close");
  assert.equal(ui.modal, null);
  ui.refit(); click(ui, "refit-slot", "b2");
  assert.equal(ui.refitState.candidateId, "suixing");
  const reopened = fixture(writes.at(-1)).ui;
  reopened.refit(); reopened.selectRefitMount("b2");
  assert.equal(reopened.refitState.candidateId, "suixing");
  reopened.closeRefit(); reopened.prepare();
  const ship = reopened.battle.ships.find((s) => s.id === "0-0");
  assert.equal(ship.mounts.find((m) => m.id === "b2").weaponId, "suixing");
});

test("OP exhaustion blocks more expensive replacement and flux increases without saving", () => {
  const { ui, writes } = fixture(); ui.refit();
  ui.previewRefitWeapon("suixing"); assert(ui.installRefitWeapon());
  assert(ui.changeFlux("vents", 12));
  const before = structuredClone(ui.loadouts), saves = writes.length;
  ui.previewRefitWeapon("chuanyun");
  assert.equal(ui.refitCandidate().ok, false);
  assert.equal(ui.installRefitWeapon(), false);
  assert.equal(ui.changeFlux("capacitors", 1), false);
  assert.equal(ui.previewRefitWeapon("zhenhai"), false);
  assert.equal(ui.changeFlux("invalid", 1), false);
  assert.deepEqual(ui.loadouts, before);
  assert.equal(writes.length, saves);
  ui.draw();
  assert(!ui.buttons.some((b) => b.role === "refit-install"));
  assert(!ui.buttons.some((b) => b.role === "refit-flux-plus"));
  assert(ui.changeFlux("vents", -1));
  assert(ui.installRefitWeapon());
  assert(combat.validateLoadout(ui.fitType, ui.loadouts[ui.fitId]).ok);
});

test("flux upgrades, undo and standard refit all persist correct simulation values", () => {
  const { ui } = fixture(); ui.refit();
  click(ui, "refit-flux-plus", "vents");
  click(ui, "refit-flux-plus", "capacitors");
  ui.closeRefit(); ui.prepare();
  const s = ui.battle.ships.find((s) => s.id === "0-0");
  assert.equal(s.dissipation, catalog.getShip("xia").fluxDissipation + 10);
  assert.equal(s.maxFlux, catalog.getShip("xia").fluxCapacity + 200);
  ui.screen = "hangar"; ui.refit();
  click(ui, "refit-reset");
  assert.equal(ui.refitState.fit.vents, 0);
  assert.equal(ui.refitState.fit.capacitors, 0);
  click(ui, "refit-undo");
  assert.equal(ui.refitState.fit.vents, 1);
  assert.equal(ui.refitState.fit.capacitors, 1);
});

test("ship switching isolates duplicate-hull loadouts; Escape discards only uninstalled preview", () => {
  const { ui, writes } = fixture(); ui.fleets[0] = ["xia", "xia"]; ui.refit();
  ui.previewRefitWeapon("suixing"); ui.installRefitWeapon();
  click(ui, "refit-next-ship");
  assert.equal(ui.fitId, "0-1");
  assert.equal(ui.refitState.candidateId, "chuanyun");
  ui.previewRefitWeapon("suixing");
  ui.keyDown("Escape"); ui.keyUp("Escape");
  assert.equal(ui.modal, null);
  assert.equal(ui.refitState, null);
  assert.equal(writes.length, 1);
  assert.equal(ui.loadouts["0-1"], undefined);
  ui.refit(); click(ui, "refit-previous-ship");
  assert.equal(ui.refitState.candidateId, "suixing");
});

test("desktop and mobile render every hull; touch callouts and actions stay inside safe bounds", () => {
  for (const [w, h] of [[1280,720], [1024,600], [844,390], [740,360], [568,320]]) {
    const { ui } = fixture(undefined, w, h);
    ui.resize(w,h,2,{left:20,top:0,right:w-20,bottom:h-10});
    if (h < 500) ui.menuRect = {left:w-111,top:8,right:w-20,bottom:40,width:91,height:32};
    for (const d of catalog.SHIPS) {
      ui.fleets[0] = [d.id]; ui.slot = 0; ui.refit();
      for (const m of d.mounts) {
        ui.selectRefitMount(m.id); ui.draw();
        for (const b of ui.buttons) {
          assert(b.x >= ui.safe.left && b.y >= ui.safe.top, b.role + " escaped top/left");
          assert(b.x+b.w <= ui.safe.right+0.001 && b.y+b.h <= ui.safe.bottom+0.001, b.role + " escaped right/bottom at " + w+"x"+h);
          if (b.role === "refit-slot") assert(b.h >= 44 && b.w >= 44);
          if (b.y < 45) assert(b.x+b.w <= ui.headerRight()+0.001, b.role + " under native capsule");
        }
        const slots = ui.buttons.filter((b) => b.role === "refit-slot");
        for (let i=0;i<slots.length;i++) for(let j=i+1;j<slots.length;j++) {
          const a=slots[i],b=slots[j];
          assert(!(a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y), "touch callouts overlap");
        }
      }
    }
  }
});

test("incomplete but valid saved refits are normalized; invalid saved fitting is not silently written", () => {
  const saved={version:2,loadouts:{"0-0":{vents:2}}};
  const {ui,writes}=fixture(saved); ui.refit(); ui.draw();
  assert.equal(ui.refitState.fit.vents,2);
  assert.equal(ui.refitState.candidateId,"chuanyun");
  assert.equal(writes.length,0);
  ui.loadouts["0-0"]={weapons:{b1:"zhenhai"},vents:-2};
  ui.refit(); ui.draw();
  assert(combat.validateLoadout("xia",ui.refitState.fit).ok);
  assert.equal(writes.length,0);
});

test("weapon comparison text stays above install actions at intermediate and short heights", () => {
  for (const [w,h] of [[1280,720],[1024,650],[1024,600],[1024,550],[844,390],[740,360],[568,320]]) {
    const {ui}=fixture(undefined,w,h);
    ui.resize(w,h,1,{left:20,top:0,right:w-20,bottom:h-10});
    ui.refit(); ui.previewRefitWeapon("suixing");
    const drawn=[];
    ui.refitText=(value,x,y,size=13)=>drawn.push({value:String(value),x,y,size});
    const l=ui.refitLayout();
    ui.drawRefitLibrary(l,ui.refitDefinition());
    const actionY=l.bottom-44;
    for (const t of drawn) {
      if (Math.abs(t.y-(actionY+22))<0.001) continue; // Status and button label.
      assert(t.y+t.size/2 <= actionY, 'detail overlaps actions at '+w+'x'+h+': '+t.value);
    }
  }
});

test("small native screens keep reset and undo accessible through overflow", () => {
  const {ui}=fixture(undefined,568,320);
  ui.resize(568,320,1,{left:20,top:0,right:548,bottom:310});
  ui.menuRect={left:457,top:8,right:548,bottom:40};
  ui.refit();
  click(ui,"refit-flux-plus","vents");
  click(ui,"refit-more"); click(ui,"refit-undo");
  assert.equal(ui.refitState.fit.vents,0);
  click(ui,"refit-more"); click(ui,"refit-reset");
  assert.equal(ui.refitState.more,false);
});

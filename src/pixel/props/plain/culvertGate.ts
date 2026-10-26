// The culvert gate (lane R-B, B5; shortcut S2): an iron portcullis in the
// culvert's mouth at the back of the Hollow Mouth's platform, the tunnel under
// the causeway running out to the lake behind it. It opens only from inside,
// by the lever beside it (the kit lever, which sets lever:culvert and
// signals this gate "lifting"): the bars grind up into their housing, the
// brass horn on the arch blows once down the tunnel (and far off the
// ferryman wakes), and the lake's light shows at the tunnel's end. Once open
// it stays open (persisted `open`), and E on it goes through to the ferry
// (the room's doors table: S2). While shut, E only rattles it. Never breaks.
// Origin: the platform floor at the gate's centre.

import { defineRecipe, type Prop } from "../../prop.ts";
import type { Part } from "../../part.ts";
import { matId, puff } from "../../kit.ts";
import "./materials.ts";

export interface GateParams {
  /** Opening width and height in H. */
  w: number;
  h: number;
}

interface Refs {
  bars: Part;
  horn: Part;
  lake: Part;
  f: number;
  H0: number;
}

export const culvertGate = defineRecipe<GateParams, Refs>({
  id: "culvertGate",
  breakage: "never",
  reason: "The culvert under the causeway, barred from outside: lift it from within and a horn sounds down the tunnel to the lake, the ferryman wakes, and the long way round becomes a boat ride (shortcut S2).",
  defaults: { w: 1.5, h: 1.75 },
  use: { reach: 0.7, prompt: "go" },
  persist: ["open"],
  cues: ["gate.rattle", "gate.lift", "culvert.horn", "gate.open"],
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const W = u(p.w), Ht = u(p.h);
    // the lake's light far down the tunnel: a small cold opening, seen only once the bars are up
    const lk = b.part("lake", { w: W, h: Ht, pivot: [W >> 1, Ht], at: [0, 0], layer: "bg", z: 1, visible: false });
    lk.ellipse(W >> 1, Math.round(Ht * 0.62), Math.round(W * 0.09), Math.round(Ht * 0.06), { mat: "glassPale", profile: "flat" });
    lk.rect(Math.round(W * 0.35), Math.round(Ht * 0.66), Math.round(W * 0.3), 2, { mat: "water", profile: "flat" });
    // the bars: a grid of square iron with a spiked foot. Drawn in code so they can retract up into the
    // housing: only the part below the housing shows, its spiked foot rising as it lifts.
    const bars = b.part("bars", { w: W, h: Ht + 4, pivot: [W >> 1, Ht], at: [0, 0], layer: "bg", z: 3, hittable: false });
    const gap = u(0.19), bw = Math.max(2, u(0.05)), cross = u(0.42), cw = Math.max(2, u(0.05));
    const iron = matId("plainIron");
    const drawBars = (part: Part, f: number): void => {
      const g = part.grid;
      g.clearAll();
      const lift = Math.round(f * Ht * 0.9);
      const vis = Ht - lift;
      for (let x = u(0.06); x < W - 2; x += gap) {
        for (let y = 0; y < vis; y++) for (let k = 0; k < bw; k++) {
          const i = g.inner(x + k, y);
          if (i >= 0) g.setRaw(i, iron, k === 0 ? 1 : k === bw - 1 ? -1 : 0, 1, 1.5, 0, 999);
        }
        for (let k = 0; k < 3; k++) for (let j = -1 + k; j <= bw - k; j++) {
          const i = g.inner(x + j, vis + k);
          if (i >= 0) g.setRaw(i, iron, -1, 1, 1.2, 0, 999);
        }
      }
      for (let y0 = u(0.25) - lift; y0 < vis - u(0.1); y0 += cross) {
        if (y0 < 0) continue;
        for (let y = y0; y < y0 + cw; y++) for (let x = 0; x < W; x++) {
          const i = g.inner(x, y);
          if (i >= 0) g.setRaw(i, iron, y === y0 ? 1 : 0, 2, 2, 0, 999);
        }
      }
    };
    const barsPart = b.get("bars");
    barsPart.tag["heal"] = false;
    barsPart.dynamic = (part) => {
      const r = (part.prop as Prop<Refs> | null)?.refs;
      const f = r ? r.f : 0;
      if (part.tag["drawnF"] === f) return;
      drawBars(part, f);
      part.tag["drawnF"] = f;
    };
    void bars;
    // the housing over the arch, and the brass horn on it pointing down the tunnel
    const hs = b.part("housing", { w: W + u(0.3), h: u(0.3), pivot: [(W + u(0.3)) >> 1, u(0.3)], at: [0, -Ht + 2], layer: "bg", z: 5 });
    hs.rect(0, 0, W + u(0.3), u(0.3), { mat: "plainIron", profile: "bevel", r: 2 });
    hs.rivets(Array.from({ length: 6 }, (_, i) => [u(0.08) + i * Math.round((W + u(0.14)) / 6), u(0.15)] as [number, number]), { mat: "plainIron", r: 1 });
    const horn = b.part("horn", { w: u(0.62), h: u(0.3), pivot: [u(0.05), u(0.22)], at: [Math.round(W * 0.35), -Ht - u(0.18)], layer: "bg", z: 6 });
    horn.poly([0, u(0.18), u(0.42), u(0.12), u(0.6), 0, u(0.6), u(0.3), u(0.42), u(0.2), 0, u(0.24)], { mat: "plainBrass", profile: "dome", r: 3 });
    horn.rect(0, u(0.17), u(0.12), u(0.08), { mat: "plainIron", profile: "bevel" });
    return { bars: b.get("bars"), horn: b.get("horn"), lake: b.get("lake"), f: 0, H0: Ht };
  },
  initial: (c) => (c.data["open"] ? "open" : "closed"),
  states: {
    closed: {
      use(c) {
        c.sound("gate.rattle", 0.8);
        c.refs.bars.shake = 0.18;
        c.emit({ type: "door", action: "rattle" });
      },
      hit(c) {
        c.refs.bars.shake = 0.2;
        c.sound("metal.hit", 0.6);
      },
    },
    lifting: {
      sound: "gate.lift",
      enter(c) {
        c.data["open"] = true;
        c.refs.lake.visible = true;
        c.sound("culvert.horn", 1);
        c.refs.horn.shake = 0.6;
        const [x, y] = c.refs.horn.toWorld(c.refs.horn.grid.w, 0);
        puff(c.world, "smoke", x, y, 6, [1, -0.4], { speed: 0.5 });
        c.emit({ type: "shake", amplitude: 1, duration: 0.5 });
      },
      update(c, dt) {
        const r = c.refs;
        r.f = Math.min(1, r.f + dt / 2.4);
        pose(c);
        if (r.horn.shake < 0.2 && c.t < 1.6) r.horn.shake = 0.3;
        if (r.f >= 1) c.go("open");
      },
    },
    open: {
      enter(c) {
        c.refs.f = 1;
        c.data["open"] = true;
        c.refs.lake.visible = true;
        pose(c);
      },
      use(c) {
        c.sound("gate.open", 0.5);
        c.emit({ type: "door", action: "enter" });
      },
      hit(c) {
        c.sound("metal.hit", 0.5);
      },
    },
  },
  actions: {
    /** Open without the lift (the save says the lever was pulled). */
    open: () => "open",
  },
  demo: {
    w: 5,
    script: [
      { label: "shut: E rattles it", use: true, wait: 1 },
      { label: "the lever lifts it: the horn blows", go: "lifting", wait: 3.2 },
      { label: "open: the lake's light down the tunnel", wait: 1 },
    ],
  },
});

/** The bars retract up into the housing (redrawn by the part's dynamic when f changes). */
function pose(c: Prop<Refs>): void {
  void c;
}

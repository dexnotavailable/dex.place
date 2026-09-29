// Loose candles: prayer candles in a row on an iron rack or a stone ledge,
// or a cluster on the floor, each a different height with its own drips and
// a live flame. States: lit, guttering, out, relighting (E relights). Hits
// and the dash's wind gutter the flames they reach (smoke curls up); a heavy
// hit crumbles wax and it mends. One shared light per few candles keeps the
// room's light list small. Origin: floor (or the ledge top), centre.

import { addFlame, hitReaches, lightFlame, puff, remaining, snuffFlame, stepFlame, type Flame } from "../kit.ts";
import { defineRecipe, type Prop } from "../prop.ts";
import type { Part } from "../part.ts";

export interface CandleParams {
  count: number;
  layout: "row" | "cluster";
  /** What they stand on. */
  stand: "none" | "rack" | "ledge";
  lit: boolean;
}

interface Refs {
  flames: Flame[];
  candles: Part[];
}

export const candles = defineRecipe<CandleParams, Refs>({
  id: "candles",
  breakage: "heal",
  reason: "Candles people left: rows at the pilgrim shrine and the chapel, a few in the lodge and the storm alcove; small warm lights that answer wind and hits.",
  defaults: { count: 7, layout: "row", stand: "rack", lit: true },
  use: { reach: 0.6, prompt: "light" },
  cues: ["flame.gutter", "flame.light"],
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const n = Math.max(1, Math.min(12, Math.round(p.count)));
    const r = b.rand;
    const row = p.layout === "row";
    const spacing = row ? u(0.13) : u(0.09);
    const W = Math.max(u(0.3), n * spacing + u(0.16));
    const standH = p.stand === "rack" ? u(0.55) : p.stand === "ledge" ? u(0.12) : 0;
    const cx = Math.floor(W / 2);
    if (p.stand !== "none") {
      const st = b.part("stand", { w: W, h: standH, pivot: [cx, standH], at: [0, 0], layer: "mid", z: 5 });
      if (p.stand === "rack") {
        // an iron votive rack: a tray on two legs, a drip lip
        st.rect(0, 0, W, u(0.05), { mat: "iron", profile: "bevel", r: 1, depth: 3, piece: "tray" });
        st.rect(0, u(0.05), W, 2, { mat: "iron", profile: "cylH", z: 1, piece: "lip" });
        for (const x of [u(0.04), W - u(0.04) - 3]) st.rect(x, u(0.05), 3, standH - u(0.05), { mat: "iron", profile: "cylV", piece: "leg" });
        st.rect(u(0.04), standH - u(0.18), W - u(0.08), 2, { mat: "iron", profile: "cylH", piece: "brace" });
        st.speckle({ amount: 0.12, seed: p.seed, tone: -1 });
        // old wax runs over the tray edge
        for (let k = 0; k < Math.ceil(n / 2); k++) st.rect(Math.floor(r() * (W - 4)) + 2, u(0.05), 1, 2 + Math.floor(r() * 4), { mat: "wax", profile: "flat", z: 2, piece: "run", tone: -1 });
      } else {
        st.rect(0, 0, W, standH, { mat: "stone", profile: "bevel", r: 2, depth: 4, piece: "ledge" });
        st.speckle({ amount: 0.12, seed: p.seed, tone: -1, scale: 2 });
      }
    }
    const flames: Flame[] = [];
    const candleParts: Part[] = [];
    for (let k = 0; k < n; k++) {
      const x = row ? Math.round(-W / 2 + u(0.08) + (k + 0.5) * spacing + (r() - 0.5) * 2) : Math.round((r() - 0.5) * (W - u(0.1)));
      const hh = u(row ? 0.07 + r() * 0.12 : 0.08 + r() * 0.16);
      const cw = Math.max(4, u(row ? 0.05 : 0.055 + r() * 0.02));
      const base = -standH + (row ? 0 : -Math.floor(r() * 2));
      const name = `candle${k}`;
      const cb = b.part(name, { w: cw + 2, h: hh + 1, pivot: [Math.floor((cw + 2) / 2), hh + 1], at: [x, base], layer: "mid", z: 6 + (row ? 0 : Math.floor(r() * 3)) });
      cb.rect(1, 1, cw, hh, { mat: "wax", profile: "cylV" });
      cb.rect(1, 1, cw, 1, { mat: "wax", mode: "paint", tone: 1 });
      // drips, a pooled foot, a scorched wick
      for (let d = 0; d < 2; d++) cb.rect(r() < 0.5 ? 1 : cw, 2, 1, 1 + Math.floor(r() * hh * 0.6), { mat: "wax", profile: "flat", z: 1, tone: 1 });
      cb.rect(0, hh - 1, cw + 2, 2, { mat: "wax", profile: "dome", r: 1, tone: -1, piece: "pool" });
      cb.rect(1 + Math.floor(cw / 2), 0, 1, 2, { mat: "soot", profile: "flat", noInk: true, piece: "wick" });
      candleParts.push(b.get(name));
      // a light on every third candle keeps the room's light list short
      const f = addFlame(b, { name: `flame${k}`, parent: name, at: [1 + Math.floor(cw / 2), 0], size: [0.05, 0.11], light: k % 3 === 1 || n === 1 ? 1.8 : 0, intensity: 0.45, glow: 0.16, z: 12, lit: p.lit });
      flames.push(f);
    }
    return { flames, candles: candleParts };
  },
  initial: (c) => (c.params["lit"] ? "lit" : "out"),
  states: {
    lit: {
      update: (c, dt) => step(c, dt),
      hit: (c, h) => onHit(c, h.hit, h.contact),
      use: (c) => (c.refs.flames.some((f) => f.target === 0) ? "relighting" : undefined),
    },
    guttering: {
      after: [0.8, "out"],
      update: (c, dt) => step(c, dt),
      hit: (c, h) => onHit(c, h.hit, h.contact),
    },
    out: {
      update: (c, dt) => step(c, dt),
      hit: (c, h) => onHit(c, h.hit, h.contact),
      use: () => "relighting",
    },
    relighting: {
      sound: "flame.light",
      enter(c) {
        // one after another along the row, like a taper passed along
        c.refs.flames.forEach((f, k) => {
          f.target = 0;
          f.smoke = 0;
          (f as Flame & { at?: number }).at = k * 0.12;
        });
      },
      update(c, dt) {
        c.refs.flames.forEach((f, k) => {
          const at = (f as Flame & { at?: number }).at ?? 0;
          if (c.t >= at && f.target === 0 && remaining(c.refs.candles[k]!) > 0.5) lightFlame(c, f);
        });
        step(c, dt);
      },
      after: [1.6, "lit"],
      hit: (c, h) => onHit(c, h.hit, h.contact),
    },
  },
  actions: {
    light: () => "relighting",
    snuff: (c) => {
      for (const f of c.refs.flames) snuffFlame(c, f);
      return "guttering";
    },
  },
  demo: {
    indoor: true,
    w: 6,
    variants: [
      { label: "cluster on the floor", params: { layout: "cluster", stand: "none", count: 5 }, dx: -1.8 },
      { label: "ledge row", params: { stand: "ledge", count: 4 }, dx: 1.9 },
    ],
    script: [
      { label: "lit", wait: 1 },
      { label: "dash wind: the near flames gutter", hit: "wind", from: -1.2, wait: 1.6 },
      { label: "E: relight along the row", use: true, from: -0.5, wait: 2 },
      { label: "slash: the ones it reaches go out", hit: "slash", from: -0.7, wait: 1.2 },
      { label: "heavy: wax crumbles", hit: "heavy", from: -0.9, wait: 1.5 },
      { label: "mends", wait: 6 },
      { label: "relight", act: "light", wait: 2 },
    ],
  },
});

function step(c: Prop<Refs>, dt: number): void {
  let lit = 0;
  c.refs.flames.forEach((f, k) => {
    if (f.target > 0 && remaining(c.refs.candles[k]!) < 0.5) snuffFlame(c, f);
    stepFlame(c, f, dt);
    const [wx] = c.world.windAt(f.part.wx, f.part.wy);
    if (Math.abs(wx) > c.params.H * 26 && f.target > 0) snuffFlame(c, f);
    if (f.target > 0) lit++;
  });
  if (c.state === "lit" && lit === 0) c.go("guttering");
}

function onHit(c: Prop<Refs>, hit: import("../hits.ts").Hit, contact: [number, number] | null): void {
  const H = c.params.H;
  if (hit.type !== "wind") {
    const reps = c.damage(hit);
    for (const r of reps) if (r.removed && r.contact) puff(c.world, "dust", r.contact[0], r.contact[1], 3, [0, -1], { rgb: [[207, 195, 177], [168, 153, 138]] });
  }
  for (const f of c.refs.flames) {
    if (!hitReaches(hit, f, H, contact)) continue;
    if (hit.type === "wind") {
      f.leanV += hit.dir[0] * 14;
      if (hit.force > H * 3 && c.rand() < 0.8) snuffFlame(c, f);
    } else snuffFlame(c, f);
  }
}

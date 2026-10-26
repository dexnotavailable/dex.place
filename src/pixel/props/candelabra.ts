// Standing candelabra: brass body on iron claw feet, wax candles, live
// flames. Flames flicker and light the room (and rim Rosace in warm light);
// a hit wobbles the whole stand on a spring (pixel-safe rotation) and
// gutters the flames it reaches; heavy hits crumble candles; the dash's wind
// leans the flames and can blow them out. E relights. Origin: floor, centre.

import { F_NOINK } from "../cells.ts";
import { coverage } from "../hits.ts";
import { flicker, Spring } from "../motion.ts";
import { P_DRAG, P_FADE, P_RISE, P_ADD } from "../bodies.ts";
import { resolveMat } from "../materials.ts";
import { defineRecipe, type Prop, type PropLight, type PropGlow } from "../prop.ts";
import type { Part } from "../part.ts";

export interface CandelabraParams {
  /** 3 or 5 candles. */
  candles: number;
  /** Total height in H. */
  height: number;
}

interface Flame {
  part: Part;
  candle: Part;
  light: PropLight;
  glow: PropGlow;
  level: number;
  target: number;
  lean: number;
  leanV: number;
  smoke: number;
  seed: number;
}

interface Refs {
  body: Part;
  wobble: Spring;
  flames: Flame[];
}

const OFFS: Record<number, number[]> = { 3: [-0.22, 0, 0.22], 5: [-0.36, -0.18, 0, 0.18, 0.36] };
const PANS: Record<number, number[]> = { 3: [0.2, 0.08, 0.2], 5: [0.24, 0.16, 0.06, 0.16, 0.24] };
const WAX: Record<number, number[]> = { 3: [0.17, 0.23, 0.17], 5: [0.15, 0.2, 0.24, 0.19, 0.14] };

function drawFlame(f: Flame, t: number): void {
  const g = f.part.grid;
  g.clearAll();
  if (f.level <= 0.02) return;
  const fl = flicker(t, f.seed, 1.3);
  const s = f.level * (0.82 + 0.18 * fl);
  const fh = Math.max(3, Math.round(g.h * s));
  const maxHalf = Math.max(1.2, (g.w / 2) * (0.75 + 0.25 * s));
  const flame = resolveMat("flame").id;
  for (let y = 0; y < fh; y++) {
    const tt = (y + 0.5) / fh; // 0 tip .. 1 base
    const half = maxHalf * Math.pow(Math.sin(Math.PI * Math.min(1, tt * 0.92 + 0.06)), 0.85) * (0.55 + 0.45 * tt);
    const lean = f.lean * Math.pow(1 - tt, 1.6) * fh * 0.9 + Math.sin(t * 9 + f.seed + y * 0.4) * (1 - tt) * 0.6;
    const cx = g.w / 2 + lean;
    for (let x = 0; x < g.w; x++) {
      const d = Math.abs(x + 0.5 - cx) / Math.max(half, 0.6);
      if (d > 1) continue;
      const yy = g.h - fh + y;
      const i = g.inner(x, yy);
      if (i < 0) continue;
      let tone = d < 0.4 && tt > 0.35 ? 1 : d < 0.75 ? 0 : -1;
      if (tt < 0.18) tone = -1;
      if (tt > 0.88 && d < 0.5) tone = -2;
      g.setRaw(i, flame, tone, 1, 2, F_NOINK, 1);
    }
  }
  f.part.heat = (fl - 0.85) * 3;
}

function snuff(c: Prop<Refs>, f: Flame): void {
  if (f.target === 0) return;
  f.target = 0;
  f.smoke = 1.6;
  c.sound("flame.gutter", 0.6);
}

function relight(f: Flame): void {
  if (f.candle.grid.count < (f.candle.grid.orig ? 0.45 : 0) * countOrig(f.candle)) return;
  f.target = 1;
}

function countOrig(p: Part): number {
  const o = p.grid.orig;
  if (!o) return p.grid.count;
  let n = 0;
  for (let i = 0; i < o.mat.length; i++) if (o.mat[i]) n++;
  return n;
}

export const candelabra = defineRecipe<CandelabraParams, Refs>({
  id: "candelabra",
  reason: "Standing lights along the chapel and shrines: they light the way (and Rosace), and show a room is tended.",
  defaults: { candles: 5, height: 1.35 },
  use: { reach: 0.9, prompt: "light" },
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const n = p.candles === 3 ? 3 : 5;
    const offs = OFFS[n]!, pans = PANS[n]!, wax = WAX[n]!;
    const w = u(n === 5 ? 0.92 : 0.62), h = u(p.height - 0.2);
    const cx = Math.floor(w / 2);
    const body = b.part("body", { w, h, pivot: [cx, h], at: [0, 0], layer: "mid", smoothRotate: true, z: 10, collide: "none" });
    // claw feet
    body.piece("feet");
    for (const s of [-1, 1]) {
      body.stroke([cx, h - u(0.13), cx + s * u(0.12), h - u(0.06), cx + s * u(0.2), h - 2], [5, 4, 3], { mat: "iron" });
      body.circle(cx + s * u(0.2), h - 3, 2.6, { mat: "iron", profile: "dome", r: 2 });
    }
    body.rect(cx - 2, h - u(0.1), 5, u(0.1), { mat: "iron", profile: "cylV" });
    // base knop and stem
    body.piece("stem");
    body.ellipse(cx, h - u(0.15), u(0.085), u(0.06), { mat: "brass", profile: "dome", r: 4 });
    const armY = u(0.36);
    body.rect(cx - u(0.035), armY, u(0.07), h - armY - u(0.18), { mat: "brass", profile: "cylV" });
    for (const ky of [0.56, 0.82]) body.ellipse(cx, u(ky), u(0.06), u(0.035), { mat: "brass", profile: "dome", r: 3 });
    // arms
    body.piece("arms");
    offs.forEach((dx, k) => {
      const x = cx + u(dx), py = u(pans[k]!);
      if (dx !== 0) body.stroke([cx, armY + u(0.04), cx + u(dx) * 0.55, armY + u(0.1), x, armY - u(0.02), x, py + 3], 4, { mat: "brass" });
      else body.rect(cx - 2, py, 4, armY - py + 2, { mat: "brass", profile: "cylV" });
    });
    // drip pans and sockets
    body.piece("pans");
    const candleAt: [number, number][] = [];
    offs.forEach((dx, k) => {
      const x = cx + u(dx), py = u(pans[k]!);
      body.ellipse(x, py + 1, u(0.06), 2.2, { mat: "brass", profile: "dome", r: 2 });
      body.rect(x - 2, py - 4, 5, 4, { mat: "brass", profile: "cylV" });
      candleAt.push([x, py - 4]);
    });
    body.speckle({ amount: 0.05 + p.wear * 0.2, seed: p.seed, tone: -1, mats: ["brass"] });
    // candles and flames
    const flames: Flame[] = [];
    candleAt.forEach(([x, y], k) => {
      const ch = u(wax[k]!), cw = Math.max(4, u(0.06));
      const cb = b.part(`candle${k}`, { w: cw, h: ch, pivot: [Math.floor(cw / 2), ch], at: [x, y], parent: "body", layer: "mid", smoothRotate: true, z: 11 });
      cb.rect(0, 1, cw, ch - 1, { mat: "wax", profile: "cylV" });
      // melted rim and drips
      cb.rect(0, 1, cw, 2, { mat: "wax", mode: "paint", tone: 1 });
      const r = b.rand;
      for (let d = 0; d < 2; d++) {
        const dx = r() < 0.5 ? 0 : cw - 1;
        cb.rect(dx, 2, 1, 2 + Math.floor(r() * ch * 0.4), { mat: "wax", mode: "paint", tone: 1 });
      }
      cb.rect(Math.floor(cw / 2), 0, 1, 2, { mat: "soot", profile: "flat", noInk: true, piece: "wick" });
      b.get(`candle${k}`).tag["heal"] = true;
      const fw = Math.max(5, u(0.09)), fh = Math.max(9, u(0.2));
      b.part(`flame${k}`, { w: fw, h: fh, pivot: [Math.floor(fw / 2), fh], at: [Math.floor(cw / 2), 0], parent: `candle${k}`, layer: "mid", outline: 0, hittable: false, smoothRotate: true, z: 12 });
      const light = b.light({ part: `flame${k}`, at: [fw / 2, fh * 0.55], colour: [1, 0.68, 0.36], radius: u(2.1), intensity: 0.62, flicker: 0.4, height: u(0.35) });
      const glow = b.glow({ part: `flame${k}`, at: [fw / 2, fh * 0.6], colour: [1, 0.58, 0.26], radius: u(0.3), intensity: 0.55, flicker: 0.5 });
      flames.push({ part: b.get(`flame${k}`), candle: b.get(`candle${k}`), light, glow, level: 1, target: 1, lean: 0, leanV: 0, smoke: 0, seed: p.seed * 3 + k * 1.7 });
    });
    b.get("body").tag["heal"] = true;
    const refs: Refs = { body: b.get("body"), wobble: new Spring(70, 3.2), flames };
    for (const f of flames) {

      f.part.dynamic = () => drawFlame(f, f.part.prop?.world.time ?? 0);
    }
    return refs;
  },
  initial: "lit",
  states: {
    lit: {
      update: (c, dt) => step(c, dt),
      hit: (c, h) => onHit(c, h.hit),
      use(c) {
        if (c.refs.flames.some((f) => f.target === 0)) return "relighting";
      },
    },
    guttering: {
      after: [0.8, "out"],
      update: (c, dt) => step(c, dt),
      hit: (c, h) => onHit(c, h.hit),
    },
    out: {
      update: (c, dt) => step(c, dt),
      hit: (c, h) => onHit(c, h.hit),
      use: () => "relighting",
    },
    relighting: {
      sound: "flame.light",
      enter(c) {
        for (const f of c.refs.flames) relight(f);
        const [x, y] = c.refs.flames[Math.floor(c.refs.flames.length / 2)]!.part.toWorld(2, 4);
        for (let k = 0; k < 8; k++) c.world.particles.spawn({ x, y, vx: (c.rand() - 0.5) * 30, vy: -20 - c.rand() * 30, life: 0.3 + c.rand() * 0.3, rgb: [255, 210, 130], flags: P_ADD | P_DRAG });
      },
      after: [0.6, "lit"],
      update: (c, dt) => step(c, dt),
      hit: (c, h) => onHit(c, h.hit),
    },
  },
});

function step(c: Prop<Refs>, dt: number): void {
  const { body, wobble, flames } = c.refs;
  wobble.step(dt);
  body.rot = Math.max(-0.5, Math.min(0.5, wobble.x));
  const w = c.world;
  let lit = 0;
  for (const f of flames) {
    // candle crumbled: its flame can't burn
    if (f.candle.grid.count < countOrig(f.candle) * 0.45 && f.target > 0) snuff(c, f);
    const rate = f.target > f.level ? 2.2 : 3.2;
    f.level += Math.sign(f.target - f.level) * Math.min(Math.abs(f.target - f.level), rate * dt);
    // lean: wind + the stand's own swing, on a spring
    const [wx] = w.windAt(f.part.wx, f.part.wy);
    const targetLean = Math.max(-1.2, Math.min(1.2, wx * 0.0022 - wobble.v * 0.25));
    f.leanV += ((targetLean - f.lean) * 60 - f.leanV * 8) * dt;
    f.lean += f.leanV * dt;
    if (Math.abs(wx) > c.params.H * 26 && f.target > 0) snuff(c, f);
    f.light.level = f.level;
    f.glow.level = f.level;
    if (f.level > 0.05) lit++;
    if (f.smoke > 0) {
      f.smoke -= dt;
      if (c.rand() < dt * 18) {
        const [x, y] = f.candle.toWorld(f.candle.pivotX, -1);
        const g = 100 + Math.floor(c.rand() * 30);
        w.particles.spawn({ x: x + (c.rand() - 0.5) * 2, y, vx: (c.rand() - 0.5) * 8 + wx * 0.02, vy: -18 - c.rand() * 14, life: 0.9 + c.rand() * 0.9, rgb: [g, g - 4, g + 12], flags: P_RISE | P_DRAG | P_FADE });
      }
    }
  }
  if (c.state === "lit" && lit === 0 && flames.every((f) => f.target === 0)) c.go("guttering");
}

function onHit(c: Prop<Refs>, hit: import("../hits.ts").Hit): string | void {
  const { wobble, flames } = c.refs;
  const H = c.params.H;
  // the stand rocks on its feet
  const push = (hit.dir[0] || (c.rand() - 0.5)) * Math.min(3.2, hit.force / H) * (hit.type === "wind" ? 0.25 : 0.55);
  wobble.impulse(push);
  if (hit.type !== "wind") {
    const reps = c.damage(hit);
    void reps;
  }
  let contact: [number, number] | null = null;
  if (hit.type !== "wind") for (const r of c.lastHitReports()) if (r.contact) contact = r.contact;
  for (const f of flames) {
    const [x, y] = f.part.toWorld(f.part.pivotX, f.part.pivotY - 4);
    const near = coverage(hit.shape, x, y) > 0 || coverage(hit.shape, x, y + 6) > 0 || (!!contact && Math.hypot(contact[0] - x, contact[1] - y) < H * 0.8);
    const shock = hit.type === "q" || hit.type === "r" || hit.type === "heavy";
    if (hit.type === "wind") {
      f.leanV += hit.dir[0] * 14;
      if (near && hit.force > H * 3 && c.rand() < 0.7) snuff(c, f);
    } else if (near || (shock && c.rand() < 0.75) || (contact && c.rand() < 0.6)) snuff(c, f);
  }
}

// Reeds in the shallows (lane R-B, B1 and the causeway's wet flats): tall
// stems standing in the water, a few with cattail heads and long leaves.
// They lean with the wind, part around whoever wades through (world.actors,
// fed by the plain's rumble), bow from a swing or a dash, and bow all
// together when the colossus's big ring washes in (a broad gust from the
// rumble). A slash cuts stems short (the heads and bits float down); they
// grow back. Drawn in code into one dynamic part, redrawn only while
// something moves. Origin: the bed's left end, at the water surface.
//
// Breakage: heal (plants). In a sway-only room nothing is cut; `form`
// (total stem height) lets the policy check see that.

import { coverage, type Hit } from "../../hits.ts";
import { matId, puff } from "../../kit.ts";
import { defineRecipe, type Prop } from "../../prop.ts";
import type { Part } from "../../part.ts";
import { vnoise } from "../../util.ts";
import "./materials.ts";

export interface ReedParams {
  /** Bed width and tallest stem, in H. */
  width: number;
  height: number;
  /** Stems per 10 px. */
  density: number;
  /** Share of stems with a cattail head. */
  heads: number;
  kind: "green" | "dry";
  /** mid: behind the player (tall); fg: in front of her (keep these low). */
  layer: "mid" | "fg";
}

interface Stem {
  x: number;
  h: number;
  h0: number;
  lean: number;
  v: number;
  rest: number;
  mat: number;
  head: boolean;
  leaf: number;
  regrow: number;
  w: number;
  /** Rows the bed's footing under this stem sits above the bed's base (shallows shelve); 0 on the flat. */
  gy: number;
}

interface Refs {
  part: Part;
  /** Grid row of the bed's base (stems with gy > 0 root above it). */
  base: number;
  stems: Stem[];
  dirty: boolean;
  wake: number;
  regrowing: boolean;
  head: number;
}

function draw(r: Refs): void {
  const g = r.part.grid;
  g.clearAll();
  for (const s of r.stems) {
    const bottom = r.base - s.gy;
    const h = Math.max(1, Math.round(s.h));
    const lean = Math.max(-1.4, Math.min(1.4, s.lean));
    let tx = s.x, ty = bottom;
    for (let yy = 0; yy < h; yy++) {
      const t = yy / h;
      const px = s.x + lean * h * t * t * 0.8;
      const py = bottom - yy * (1 - 0.25 * lean * lean * t);
      const tone = (t > 0.75 ? 1 : t < 0.2 ? -1 : 0) + (s.mat === r.head ? 0 : 0);
      for (let k = 0; k < (t < 0.5 ? s.w : 1); k++) {
        const i = g.inner(Math.round(px) + k, Math.round(py));
        if (i >= 0) g.setRaw(i, s.mat, tone, 1, 1 + t, 0, 8);
      }
      tx = px;
      ty = py;
      // a long leaf peels off the stem and droops
      if (s.leaf > 0 && yy === Math.round(h * s.leaf)) {
        const dir = s.x % 2 === 0 ? 1 : -1;
        for (let k = 1; k < Math.round(h * 0.35); k++) {
          const lx = Math.round(px + dir * k * 0.9 + lean * k * 0.3);
          const ly = Math.round(py - k * 0.6 + (k * k) / (h * 0.25));
          const j = g.inner(lx, ly);
          if (j >= 0) g.setRaw(j, s.mat, k > h * 0.2 ? 1 : 0, 1, 1.5, 0, 7);
        }
      }
    }
    // the cattail: a dark two-pixel head below the tip
    if (s.head && s.h > s.h0 * 0.8) {
      const hl = Math.max(3, Math.round(s.h0 * 0.13));
      for (let k = 0; k < hl; k++) {
        const t = 1 - (k + 2) / h;
        const px = s.x + lean * h * t * t * 0.8;
        const py = bottom - (h - 2 - k) * (1 - 0.25 * lean * lean * t);
        for (let dx = 0; dx < 2; dx++) {
          const i = g.inner(Math.round(px) + dx, Math.round(py));
          if (i >= 0) g.setRaw(i, r.head, k === 0 ? 1 : dx === 0 ? 0 : -1, 3, 2.4, 0, 6);
        }
      }
    }
    void tx;
    void ty;
  }
  r.dirty = false;
}

export const reedBed = defineRecipe<ReedParams, Refs>({
  id: "reedBed",
  breakage: "heal",
  reason: "The reed shallows: stems that stand in the water around your ankles, part as you wade, and bow together when the colossus's ripple washes in, so its footfall reaches you.",
  defaults: { width: 1.6, height: 0.95, density: 3.2, heads: 0.16, kind: "green", layer: "mid" },
  cues: ["leaf.cut", "reed.rustle"],
  feel: 0.6,
  form: (c) => c.refs.stems.reduce((n, s) => n + s.h, 0),
  build(b, p) {
    const W = b.u(p.width), sh = b.u(p.height);
    const Ht = Math.round(sh * 1.25) + 4;
    const r = b.rand;
    const green = matId(p.kind === "dry" ? "reedDry" : "reedStem"), dry = matId("reedDry");
    const n = Math.max(3, Math.round((W / 10) * p.density));
    const stems: Stem[] = [];
    // every stem roots where the shallows' floor (or the water's surface) is under its own x; a
    // stem with nothing to stand in is not grown. Draws stay in order so flat beds look as before.
    const reach = Math.round(b.H * 0.6);
    let up = 0, down = 0;
    for (let k = 0; k < n; k++) {
      const x = Math.round(((k + r() * 0.8) / n) * (W - 1));
      const gy = b.groundRise(x + 0.5, reach);
      const clump = vnoise(x / (sh * 0.8), 0.5, p.seed);
      const h0 = Math.max(4, Math.round(sh * (0.4 + clump * 0.7) * (0.75 + r() * 0.35)));
      stems.push({
        x, h: h0, h0, lean: 0, v: 0, rest: (r() - 0.5) * 0.35,
        mat: r() < (p.kind === "dry" ? 0.85 : 0.18) ? dry : green,
        head: r() < p.heads, leaf: r() < 0.3 ? 0.35 + r() * 0.3 : 0, regrow: 0, w: r() < 0.3 ? 2 : 1, gy: Number.isNaN(gy) ? 0 : gy,
      });
      if (Number.isNaN(gy)) {
        stems.pop();
        continue;
      }
      up = Math.max(up, gy);
      down = Math.max(down, -gy);
    }
    const part = b.part("reeds", { w: W + Math.round(sh * 0.6), h: Ht + up + down, pivot: [0, Ht + up], at: [0, 1], layer: p.layer, parallax: 1, z: p.layer === "fg" ? 5 : 3, outline: 2, hittable: false });
    part.piece("stems");
    for (const s of stems) s.lean = s.rest;
    const refs: Refs = { part: b.get("reeds"), base: Ht + up - 1, stems, dirty: true, wake: 1, regrowing: false, head: matId("reedHead") };
    refs.part.dynamicEvery = 3;
    refs.part.dynamic = () => {
      if (refs.dirty) draw(refs);
    };
    refs.part.tag["heal"] = false;
    return refs;
  },
  initial: "growing",
  states: {
    growing: {
      update: (c, dt) => step(c, dt),
      hit: (c, h) => cut(c, h.hit),
    },
  },
  demo: {
    w: 6,
    params: { width: 2.4 },
    variants: [{ label: "dry, in front", params: { kind: "dry", width: 1.6, height: 0.5, layer: "fg" }, dx: 2.6 }],
    script: [
      { label: "still", wait: 0.6 },
      { label: "wade through: they part", walk: [-0.6, 3.0], wait: 2.4 },
      { label: "wind rises", wind: 420, wait: 2 },
      { label: "calm", wind: 0, wait: 1 },
      { label: "slash: stems cut, heads fall", hit: "slash", from: 0.8, face: 1, wait: 1.2 },
      { label: "dash wind: bows", hit: "wind", from: -0.2, face: 1, wait: 1.2 },
      { label: "grows back", wait: 6 },
    ],
  },
});

function step(c: Prop<Refs>, dt: number): void {
  const r = c.refs;
  const H = c.params.H;
  const w = c.world;
  const cx = c.x + r.part.grid.w / 2;
  const wind = w.windAt(cx, c.y - H * 0.4)[0];
  const actors = w.actorsNear(cx, c.y, r.part.grid.w / 2 + H * 0.5, H * 0.8);
  const windy = Math.abs(wind) > 2;
  if (!windy && !actors.length && r.wake <= 0 && !r.regrowing) return;
  r.wake -= dt;
  let moving = false, short = false;
  const t = w.time;
  for (const s of r.stems) {
    const sx = c.x + s.x;
    let target = s.rest + (windy ? Math.max(-1.1, Math.min(1.1, wind / 520)) * 0.9 + Math.sin(t * 1.7 + s.x * 0.07) * Math.min(0.25, Math.abs(wind) / 1000) : 0);
    for (const a of actors) {
      const d = sx - a.x, rr = H * 0.3;
      if (Math.abs(d) < rr) target += Math.sign(d || 1) * (1 - Math.abs(d) / rr) * 0.9;
    }
    if (s.regrow > 0) s.regrow = Math.max(0, s.regrow - dt);
    else if (s.h < s.h0) {
      s.h = Math.min(s.h0, s.h + dt * s.h0 * 0.3);
      moving = true;
    }
    if (s.h < s.h0) short = true;
    // reeds are stiffer and slower than grass
    const a = (target - s.lean) * 55 - s.v * 7;
    s.v += a * dt;
    s.lean += s.v * dt;
    if (Math.abs(s.v) > 0.02 || Math.abs(target - s.lean) > 0.03) moving = true;
  }
  r.regrowing = short;
  if (moving) {
    r.dirty = true;
    r.wake = Math.max(r.wake, 0.3);
  }
}

function cut(c: Prop<Refs>, hit: Hit): void {
  const r = c.refs;
  const cuts = !c.keepsCells && (hit.type === "slash" || hit.type === "heavy" || hit.type === "q" || hit.type === "r");
  let n = 0, bent = 0;
  for (const s of r.stems) {
    const sy = c.y - s.gy;
    const sx = c.x + s.x, mid = sy - s.h * 0.5;
    const cov = Math.max(coverage(hit.shape, sx, mid), coverage(hit.shape, sx, sy - s.h * 0.85));
    const near = hit.shape.kind === "cone" ? Math.hypot(sx - hit.shape.x, mid - hit.shape.y) < hit.shape.len : cov > 0;
    if (!near) continue;
    s.v += (hit.dir[0] || 1) * (hit.type === "wind" ? 7 : 11);
    bent++;
    if (cuts && cov > 0 && s.h > s.h0 * 0.4) {
      const top = sy - s.h;
      s.h = Math.max(3, Math.round(s.h0 * 0.3));
      s.regrow = 2.5 + c.rand() * 2;
      r.regrowing = true;
      if (n++ % 2 === 0) puff(c.world, "leaf", sx, top + 2, 2, [hit.dir[0], -1], { speed: 0.6 });
    }
  }
  if (n) c.sound("leaf.cut", Math.min(1, 0.3 + n * 0.03));
  else if (bent && hit.type !== "wind") c.sound("reed.rustle", Math.min(1, 0.25 + bent * 0.02));
  r.wake = 1.5;
  r.dirty = true;
}

// Grass, flowers and vines: living pixels that answer everything near them.
//
// grass (kind grass | dry | flowers): blades that lean with the wind, part
// around whoever walks through (world.actors), bow away from a swing or a
// dash, and when cut drop to stubs (leaves and petals scatter in their own
// colours) and grow back. Origin: the patch's left end, on the ground.
//
// vines: strands hanging from a ledge or wall top, with leaves along them;
// they sway, swing when hit or brushed, are cut short by a slash and grow
// back down. Origin: the left end of the ledge they hang from.
//
// Both redraw only while something moves (at most 20 times a second); still
// air and no one near costs nothing.
//
// Breakage policy: in a sway-only room (the nave) nothing is cut. Blades and
// strands only bend and swing, so `form` (total blade height, strand points)
// stays exactly as built; src/pixel/tools/policy.mjs checks it.

import { F_NOINK } from "../cells.ts";
import { coverage, type Hit } from "../hits.ts";
import { matId, puff } from "../kit.ts";
import { defineRecipe, type Prop } from "../prop.ts";
import type { Part } from "../part.ts";
import { vnoise } from "../util.ts";

// ---------------------------------------------------------------------------
// grass
// ---------------------------------------------------------------------------

export interface GrassParams {
  kind: "grass" | "dry" | "flowers";
  /** Patch width and blade height in H. */
  width: number;
  height: number;
  /** Blades per 10 px. */
  density: number;
}

interface Blade {
  x: number;
  h: number;
  h0: number;
  lean: number;
  v: number;
  rest: number;
  mat: number;
  tone: number;
  flower: number;
  regrow: number;
  seed: number;
  /** Rows the ground under this blade sits above the patch's base (steps, slopes); 0 on the flat. */
  gy: number;
}

interface GrassRefs {
  part: Part;
  /** Grid row of the patch's base (blades with gy > 0 root above it). */
  base: number;
  blades: Blade[];
  dirty: boolean;
  drawn: Float32Array;
  wake: number;
  /** Some blade is cut short and still growing back (keeps the step awake). */
  regrowing: boolean;
}

const FLOWERS = ["flowerRose", "flowerPale", "flowerGold"];

function drawGrass(r: GrassRefs): void {
  const g = r.part.grid;
  g.clearAll();
  for (const b of r.blades) {
    const bottom = r.base - b.gy;
    const h = Math.max(1, Math.round(b.h));
    const lean = Math.max(-1.3, Math.min(1.3, b.lean));
    let tipX = b.x, tipY = bottom;
    for (let yy = 0; yy < h; yy++) {
      const t = yy / h;
      const px = b.x + lean * h * t * t * 0.85;
      const py = bottom - yy * (1 - 0.28 * lean * lean * t);
      const i = g.inner(Math.round(px), Math.round(py));
      if (i < 0) continue;
      const tone = b.tone + (t > 0.7 ? 1 : t < 0.25 ? -1 : 0);
      g.setRaw(i, b.mat, tone, 1 + (b.seed > 0.5 ? 1 : 0), 1 + t, 0, 8);
      tipX = px;
      tipY = py;
    }
    if (b.flower && b.h > b.h0 * 0.7) {
      for (const [dx, dy, tn] of [[0, -1, 1], [-1, 0, 0], [1, 0, 0], [0, 0, 1], [0, 1, -1]] as const) {
        const i = g.inner(Math.round(tipX) + dx, Math.round(tipY) + dy - 1);
        if (i >= 0) g.setRaw(i, b.flower, tn, 3, 2.5, 0, 6);
      }
    }
  }
  r.dirty = false;
}

export const grass = defineRecipe<GrassParams, GrassRefs>({
  id: "grass",
  breakage: "heal",
  reason: "Ground cover that shows the wind and your passing: it parts around your feet, bows from a swing, scatters when cut and grows back, so even a quiet field reacts.",
  defaults: { kind: "grass", width: 2, height: 0.26, density: 6 },
  cues: ["leaf.cut", "leaf.rustle"],
  feel: 0.6,
  form: (c) => c.refs.blades.reduce((n, b) => n + b.h, 0),
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const W = u(p.width), bh = u(p.height);
    const Ht = Math.round(bh * 1.35) + 3;
    const n = Math.max(3, Math.round((W / 10) * p.density));
    const r = b.rand;
    // every blade roots on the ground under its own x: the patch climbs steps and slopes, and a
    // blade over a drop or inside a wall is not grown (no floating tufts, no buried ones). The
    // random draws run in the same order for every blade, grown or not, so a patch on flat ground
    // looks exactly as before.
    const reach = Math.round(b.H * 0.6);
    const green = matId(p.kind === "dry" ? "grassDry" : "grass"), dry = matId("grassDry");
    const blades: Blade[] = [];
    let up = 0, down = 0;
    for (let k = 0; k < n; k++) {
      const x = Math.round(((k + r() * 0.8) / n) * (W - 1));
      const gy = b.groundRise(x + 0.5, reach);
      // clumps: taller in the middle of a clump, shorter at its edges
      const clump = vnoise(x / (bh * 1.4), 0.5, p.seed);
      const h0 = Math.max(3, Math.round(bh * (0.45 + clump * 0.75) * (0.8 + r() * 0.4)));
      const flower = p.kind === "flowers" && r() < 0.34 ? matId(FLOWERS[Math.floor(r() * FLOWERS.length)]!) : 0;
      const blade: Blade = {
        x, h: h0, h0, lean: 0, v: 0, rest: (r() - 0.5) * 0.5, mat: r() < (p.kind === "dry" ? 0.9 : 0.14) ? dry : green,
        tone: r() < 0.3 ? -1 : 0, flower, regrow: 0, seed: r(), gy: Number.isNaN(gy) ? 0 : gy,
      };
      if (Number.isNaN(gy)) continue;
      up = Math.max(up, gy);
      down = Math.max(down, -gy);
      blades.push(blade);
    }
    const part = b.part("grass", { w: W, h: Ht + up + down, pivot: [0, Ht + up], at: [0, 1], layer: "fg", parallax: 1, z: 4, outline: 2, hittable: false });
    part.piece("blades");
    for (const bl of blades) bl.lean = bl.rest;
    const refs: GrassRefs = { part: b.get("grass"), base: Ht + up - 1, blades, dirty: true, drawn: new Float32Array(blades.length), wake: 1, regrowing: false };
    refs.part.dynamicEvery = 3;
    refs.part.dynamic = () => {
      if (refs.dirty) drawGrass(refs);
    };
    refs.part.tag["heal"] = false;
    return refs;
  },
  initial: "growing",
  states: {
    growing: {
      update: (c, dt) => grassStep(c, dt),
      hit: (c, h) => grassHit(c, h.hit),
    },
  },
  demo: {
    w: 6,
    params: { width: 2.2 },
    variants: [
      { label: "flowers", params: { kind: "flowers", width: 1.6 }, dx: -2.4 },
      { label: "dry (the plain)", params: { kind: "dry", width: 1.6, height: 0.3 }, dx: 1.9 },
    ],
    script: [
      { label: "still", wait: 0.6 },
      { label: "walk through: it parts", walk: [-0.6, 2.6], wait: 2.2 },
      { label: "wind rises", wind: 380, wait: 2 },
      { label: "calm", wind: 0, wait: 1 },
      { label: "slash: blades cut, leaves scatter", hit: "slash", from: 0.7, face: 1, wait: 1.2 },
      { label: "dash wind: bows", hit: "wind", from: -0.2, face: 1, wait: 1.2 },
      { label: "grows back", wait: 6 },
    ],
  },
});

function grassStep(c: Prop<GrassRefs>, dt: number): void {
  const r = c.refs;
  const H = c.params.H;
  const w = c.world;
  const wind = w.windAt(c.x + r.part.grid.w / 2, c.y - H * 0.1)[0];
  const actors = w.actorsNear(c.x + r.part.grid.w / 2, c.y, r.part.grid.w / 2 + H * 0.4, H * 0.5);
  const windy = Math.abs(wind) > 2;
  if (!windy && !actors.length && r.wake <= 0 && !r.regrowing) return;
  r.wake -= dt;
  let moving = false, short = false;
  const t = w.time;
  for (const b of r.blades) {
    const bx = c.x + b.x;
    let target = b.rest + (windy ? Math.max(-1, Math.min(1, wind / 500)) * 0.9 + Math.sin(t * 2.2 + b.x * 0.09) * Math.min(0.3, Math.abs(wind) / 900) : 0);
    for (const a of actors) {
      const d = bx - a.x, rr = H * 0.22;
      if (Math.abs(d) < rr) target += Math.sign(d || 1) * (1 - Math.abs(d) / rr) * 1.1;
    }
    if (b.regrow > 0) {
      b.regrow -= dt;
      if (b.regrow <= 0) b.regrow = 0;
    } else if (b.h < b.h0) {
      b.h = Math.min(b.h0, b.h + dt * b.h0 * 0.35);
      moving = true;
    }
    if (b.h < b.h0) short = true;
    const a = (target - b.lean) * 90 - b.v * 9;
    b.v += a * dt;
    b.lean += b.v * dt;
    if (Math.abs(b.v) > 0.02 || Math.abs(target - b.lean) > 0.03) moving = true;
  }
  r.regrowing = short;
  if (moving) {
    r.dirty = true;
    r.wake = Math.max(r.wake, 0.3);
  }
}

function grassHit(c: Prop<GrassRefs>, hit: Hit): void {
  const r = c.refs;
  const H = c.params.H;
  // a sway-only room (or a never prop) only bends blades; nothing is mown
  const cuts = !c.keepsCells && (hit.type === "slash" || hit.type === "heavy" || hit.type === "q" || hit.type === "r");
  let n = 0, bent = 0;
  for (const b of r.blades) {
    const by = c.y - b.gy;
    const bx = c.x + b.x, mid = by - b.h * 0.5;
    const cov = Math.max(coverage(hit.shape, bx, mid), coverage(hit.shape, bx, by - b.h * 0.9));
    const near = hit.shape.kind === "cone" ? Math.hypot(bx - hit.shape.x, mid - hit.shape.y) < hit.shape.len : cov > 0;
    if (!near) {
      // a swing close by still bows it
      continue;
    }
    b.v += (hit.dir[0] || 1) * (hit.type === "wind" ? 9 : 14);
    bent++;
    if (cuts && cov > 0 && b.h > b.h0 * 0.4) {
      const top = by - b.h;
      b.h = Math.max(2, Math.round(b.h0 * 0.22));
      b.regrow = 2 + c.rand() * 1.5;
      r.regrowing = true;
      if (n++ % 2 === 0) {
        const kind = b.flower ? "petal" : "leaf";
        puff(c.world, kind, bx, top + 2, 2, [hit.dir[0], -1], { speed: 0.7 });
      }
    }
  }
  if (n) c.sound("leaf.cut", Math.min(1, 0.3 + n * 0.03));
  else if (bent && hit.type !== "wind") c.sound("leaf.rustle", Math.min(1, 0.25 + bent * 0.02));
  r.wake = 1.5;
  r.dirty = true;
  void H;
  void F_NOINK;
}

// ---------------------------------------------------------------------------
// vines
// ---------------------------------------------------------------------------

export interface VineParams {
  /** Ledge width and longest strand in H. */
  width: number;
  length: number;
  strands: number;
  flowers: boolean;
}

interface Strand {
  x: number;
  n: number;
  n0: number;
  px: Float32Array;
  py: Float32Array;
  qx: Float32Array;
  qy: Float32Array;
  regrow: number;
  seed: number;
}

interface VineRefs {
  part: Part;
  strands: Strand[];
  seg: number;
  dirty: boolean;
  wake: number;
}

function drawVines(c: Prop<VineRefs>): void {
  const r = c.refs;
  const g = r.part.grid;
  g.clearAll();
  const ox = r.part.wx - r.part.pivotX, oy = r.part.wy - r.part.pivotY;
  const leaf = matId("grass"), stem = matId("moss"), fl = matId("flowerPale");
  for (const s of r.strands) {
    for (let k = 0; k < s.n - 1; k++) {
      const ax = s.px[k]! - ox, ay = s.py[k]! - oy, bx = s.px[k + 1]! - ox, by = s.py[k + 1]! - oy;
      const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay)));
      for (let q = 0; q <= steps; q++) {
        const i = g.inner(Math.round(ax + ((bx - ax) * q) / steps), Math.round(ay + ((by - ay) * q) / steps));
        if (i >= 0) g.setRaw(i, stem, 0, 1, 1.5, 0, 8);
      }
      // leaves every other joint, alternating sides; the odd flower
      if (k >= 1) {
        const side = k % 2 ? 1 : -1;
        const lx = Math.round(bx) + side, ly = Math.round(by);
        // a small leaf: three pixels out from the stem, lit on top
        for (const [dx, dy, t] of [[0, 0, 0], [side, 0, 1], [side * 2, -1, 1], [side, -1, 0], [side * 2, 0, 0], [0, 1, -1]] as const) {
          const i = g.inner(lx + dx, ly + dy);
          if (i >= 0) g.setRaw(i, leaf, t, 2, 2, 0, 6);
        }
        if (c.params["flowers"] && (k * 7 + Math.floor(s.seed * 10)) % 9 === 0) {
          const i = g.inner(lx + side * 2, ly - 1);
          if (i >= 0) g.setRaw(i, fl, 1, 3, 2.5, F_NOINK, 6);
        }
      }
    }
  }
  r.dirty = false;
}

export const vines = defineRecipe<VineParams, VineRefs>({
  id: "vines",
  breakage: "heal",
  reason: "Green hanging off old stone (the cliff stair, the fallen ring's ribs, the balcony): it sways, parts when you brush it, and grows back when cut, so ruins feel alive.",
  defaults: { width: 1.4, length: 1.1, strands: 7, flowers: false },
  cues: ["leaf.cut", "leaf.rustle"],
  feel: 0.4,
  form: (c) => c.refs.strands.reduce((n, s) => n + s.n, 0),
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const W = u(p.width), L = u(p.length);
    const seg = Math.max(3, u(0.05));
    b.part("vines", { w: W + u(0.8), h: L + u(0.2), pivot: [u(0.4), 0], at: [0, 0], layer: "fg", parallax: 1, z: 3, outline: 2, hittable: false });
    const r = b.rand;
    const strands: Strand[] = [];
    for (let k = 0; k < p.strands; k++) {
      const x = Math.round(((k + 0.3 + r() * 0.4) / p.strands) * W);
      const n0 = Math.max(3, Math.round(((L * (0.35 + r() * 0.65)) / seg)));
      const s: Strand = { x, n: n0, n0, px: new Float32Array(n0), py: new Float32Array(n0), qx: new Float32Array(n0), qy: new Float32Array(n0), regrow: 0, seed: r() };
      for (let i = 0; i < n0; i++) {
        s.px[i] = s.qx[i] = b.ox + x * b.flip;
        s.py[i] = s.qy[i] = b.oy + i * seg;
      }
      strands.push(s);
    }
    const refs: VineRefs = { part: b.get("vines"), strands, seg, dirty: true, wake: 1 };
    refs.part.dynamicEvery = 3;
    refs.part.tag["heal"] = false;
    return refs;
  },
  initial: "growing",
  states: {
    growing: {
      enter(c) {
        c.refs.part.dynamic = () => {
          if (c.refs.dirty) drawVines(c);
        };
      },
      update: (c, dt) => vineStep(c, dt),
      hit: (c, h) => vineHit(c, h.hit),
    },
  },
  demo: {
    w: 4,
    at: 1.6,
    params: { flowers: true },
    script: [
      { label: "hanging", wait: 0.8 },
      { label: "wind", wind: 420, wait: 2 },
      { label: "calm", wind: 0, wait: 1 },
      { label: "walk through them", walk: [-0.8, 2.2], wait: 1.8 },
      { label: "slash: strands cut short", hit: "slash", from: 0.2, face: 1, wait: 1.5 },
      { label: "grow back", wait: 7 },
    ],
  },
});

function vineStep(c: Prop<VineRefs>, dt: number): void {
  const r = c.refs;
  const H = c.params.H, w = c.world;
  const wind = w.windAt(c.x, c.y + H * 0.5)[0];
  const actors = w.actorsNear(c.x + r.part.grid.w / 2, c.y + H, r.part.grid.w, H * 1.2);
  const windy = Math.abs(wind) > 2;
  let grow = false;
  for (const s of r.strands) {
    if (s.regrow > 0) s.regrow -= dt;
    else if (s.n < s.n0) {
      s.n++;
      s.px[s.n - 1] = s.px[s.n - 2]!;
      s.py[s.n - 1] = s.py[s.n - 2]! + 1;
      s.qx[s.n - 1] = s.px[s.n - 1]!;
      s.qy[s.n - 1] = s.py[s.n - 1]!;
      s.regrow = 0.25;
      grow = true;
    }
  }
  if (!windy && !actors.length && r.wake <= 0 && !grow) return;
  r.wake -= dt;
  const g = w.gravity * 0.6;
  let energy = 0;
  for (const s of r.strands) {
    for (let i = 1; i < s.n; i++) {
      const vx = (s.px[i]! - s.qx[i]!) * 0.94, vy = (s.py[i]! - s.qy[i]!) * 0.94;
      s.qx[i] = s.px[i]!;
      s.qy[i] = s.py[i]!;
      let ax = wind * 0.35 * (i / s.n) + Math.sin(w.time * 1.7 + s.seed * 9 + i * 0.3) * Math.min(20, Math.abs(wind) * 0.05);
      for (const a of actors) {
        const d = s.px[i]! - a.x;
        if (Math.abs(d) < H * 0.25 && s.py[i]! > a.y - a.h && s.py[i]! < a.y) ax += Math.sign(d || 1) * 900;
      }
      s.px[i] = s.px[i]! + vx + ax * dt * dt;
      s.py[i] = s.py[i]! + vy + g * dt * dt;
      energy += vx * vx + vy * vy;
    }
    for (let it = 0; it < 8; it++) {
      for (let i = 1; i < s.n; i++) {
        const dx = s.px[i]! - s.px[i - 1]!, dy = s.py[i]! - s.py[i - 1]!;
        const d = Math.hypot(dx, dy) || 1e-6;
        const k = (d - r.seg) / d;
        if (i === 1) {
          s.px[i] = s.px[i]! - dx * k;
          s.py[i] = s.py[i]! - dy * k;
        } else {
          s.px[i - 1] = s.px[i - 1]! + dx * k * 0.5;
          s.py[i - 1] = s.py[i - 1]! + dy * k * 0.5;
          s.px[i] = s.px[i]! - dx * k * 0.5;
          s.py[i] = s.py[i]! - dy * k * 0.5;
        }
      }
    }
  }
  let pts = 0;
  for (const s of r.strands) pts += s.n;
  if (energy > 0.004 * pts || grow || windy || actors.some((a) => Math.abs(a.vx) > 5)) {
    r.dirty = true;
    r.wake = Math.max(r.wake, 0.5);
  }
}

function vineHit(c: Prop<VineRefs>, hit: Hit): void {
  const r = c.refs;
  // a sway-only room (or a never prop) only swings strands; nothing is cut
  const cuts = !c.keepsCells && hit.type !== "wind" && hit.type !== "point";
  let cut = 0, swung = 0;
  for (const s of r.strands) {
    for (let i = 1; i < s.n; i++) {
      const cov = coverage(hit.shape, s.px[i]!, s.py[i]!);
      const inCone = hit.shape.kind === "cone" && Math.hypot(s.px[i]! - hit.shape.x, s.py[i]! - hit.shape.y) < hit.shape.len;
      if (cov <= 0 && !inCone) continue;
      s.qx[i] = s.qx[i]! - (hit.dir[0] || 1) * 4;
      swung++;
      if (cuts && cov > 0 && i > 1) {
        puff(c.world, "leaf", s.px[i]!, s.py[i]!, 3, [hit.dir[0], -0.5], { speed: 0.6 });
        s.n = i;
        s.regrow = 2.5 + c.rand();
        cut++;
        break;
      }
    }
  }
  if (cut) c.sound("leaf.cut", 0.6);
  else if (swung && hit.type !== "wind") c.sound("leaf.rustle", 0.4);
  r.wake = 2;
  r.dirty = true;
}

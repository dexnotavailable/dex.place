// Small ambient life: dust, moths, puddles and loose paper. They are the
// "everywhere, small" row of the prop list; each room places a few.
//
// dust: an emitter over a rect (in H): motes that hang and wander (dust in
// lamp light, ash, reed seeds, embers), part in the dash's wind, and (grit)
// sift from a ceiling in bursts when a colossus steps far above (`sift`).
// Capped per room (world.budget.ambient), only spawned in view, thinned in
// reduced motion. Origin: the rect's bottom-left.
//
// moths: a few moths that find the nearest lit lamp within reach and
// flutter round it; when it goes out they drift off. Origin: where they
// wait (near a lamp).
//
// puddle: a thin sheet of water on the ground holding the sky's colour
// (day, dusk sunset, storm). Footsteps ring it, hits splash it, rain (the
// host's world.rain) dots it. Origin: its left end on the ground.
//
// paper: a few loose sheets on the floor; wind, a dash or a hurried step
// lifts them and they flutter down; strays fade home after a while.
// Origin: floor, where they lie.

import { P_ADD, P_AMB, P_FADE, P_FLOAT, P_GRAV, P_ORBIT, P_DRAG } from "../bodies.ts";
// P_AMB: moths that lose their lamp become ordinary ambient drifters
import { F_NOINK } from "../cells.ts";
import { Ripples } from "../fx.ts";
import { coverage, type Hit } from "../hits.ts";
import { matId, puff } from "../kit.ts";
import { defineRecipe, type Prop } from "../prop.ts";
import type { Part } from "../part.ts";

// ---------------------------------------------------------------------------
// dust
// ---------------------------------------------------------------------------

export interface DustParams {
  kind: "dust" | "ash" | "seeds" | "embers" | "grit";
  /** Emitter rect in H (from the origin, up and right). */
  width: number;
  height: number;
  /** How many hang in the air at once (before the room's cap). */
  count: number;
  /** Motes lit by a lamp or a shaft (additive). */
  lit: boolean;
}

const DUST_RGB: Record<DustParams["kind"], [number, number, number][]> = {
  dust: [[196, 184, 176], [226, 214, 196], [170, 160, 160]],
  ash: [[88, 84, 94], [110, 104, 114]],
  seeds: [[200, 190, 160], [226, 218, 196]],
  embers: [[255, 150, 70], [255, 196, 110], [230, 110, 50]],
  grit: [[96, 86, 84], [120, 108, 100], [70, 64, 66]],
};

interface DustRefs {
  acc: number;
  live: number;
}

export const dust = defineRecipe<DustParams, DustRefs>({
  id: "dust",
  breakage: "never",
  reason: "Air you can see: dust in lamp light indoors, reed seeds and ash outside, embers in the foundry, grit sifting from the hollow's ceiling when a colossus steps far above.",
  defaults: { kind: "dust", width: 3, height: 2, count: 40, lit: true },
  cues: ["grit.sift"],
  feel: 0.5,
  build() {
    return { acc: 0, live: 0 };
  },
  initial: "drifting",
  states: {
    drifting: {
      update(c, dt) {
        const p = c.params as unknown as DustParams;
        if (p.kind === "grit") return;
        const H = c.params.H;
        const w = c.world;
        if (!w.inView(c.x + (p.width * H) / 2, c.y - (p.height * H) / 2, p.width * H * 0.6)) return;
        // keep about `count` alive: spawn at the rate they expire
        const life = p.kind === "embers" ? 2.5 : 6;
        c.refs.acc += dt * (p.count / life) * (w.reduced ? 0.5 : 1);
        const rgb = DUST_RGB[p.kind];
        while (c.refs.acc >= 1) {
          c.refs.acc -= 1;
          const x = c.x + c.rand() * p.width * H, y = c.y - c.rand() * p.height * H;
          const add = p.lit || p.kind === "embers";
          w.spawnAmbient({
            x, y, vx: (c.rand() - 0.5) * 6 + (p.kind === "seeds" ? 8 : 0), vy: p.kind === "embers" ? -14 - c.rand() * 10 : (c.rand() - 0.5) * 4 + (p.kind === "ash" ? 3 : 0),
            life: life * (0.6 + c.rand() * 0.8), rgb: rgb[Math.floor(c.rand() * rgb.length)]!, flags: P_FLOAT | P_FADE | (add ? P_ADD : 0), size: 1,
          });
        }
      },
      // the dash's wind parts the motes: the world's gust carries them (P_FLOAT follows world.windAt)
      hit: () => undefined,
    },
  },
  actions: {
    /** A burst of grit from the ceiling (in time with a far footfall). */
    sift: (c, arg) => {
      const p = c.params as unknown as DustParams;
      const H = c.params.H;
      const n = Math.round(Number(arg ?? 1) * 24 * (c.world.reduced ? 0.5 : 1));
      const rgb = DUST_RGB.grit;
      for (let k = 0; k < n; k++) {
        const x = c.x + c.rand() * p.width * H, y = c.y - p.height * H + c.rand() * 4;
        c.world.spawnAmbient({ x, y, vx: (c.rand() - 0.5) * 6, vy: 10 + c.rand() * 30, life: 1.4 + c.rand() * 1.2, rgb: rgb[Math.floor(c.rand() * rgb.length)]!, flags: P_GRAV | P_DRAG | P_FADE });
      }
      c.sound("grit.sift", Math.min(1, Number(arg ?? 1)));
    },
  },
  demo: {
    w: 6,
    params: { width: 3, height: 2.2, count: 50, lit: true },
    variants: [{ label: "grit (hollow ceiling)", params: { kind: "grit", width: 1.5, height: 3.2 }, dx: -2.2 }],
    script: [
      { label: "motes hang in the light", wait: 3 },
      { label: "dash through them", hit: "wind", from: -0.5, face: 1, wait: 2 },
      { label: "a colossus steps far above: grit sifts", act: "sift", wait: 2.5 },
    ],
  },
});

// ---------------------------------------------------------------------------
// moths
// ---------------------------------------------------------------------------

interface MothRefs {
  target: [number, number] | null;
  look: number;
  count: number;
}

export const moths = defineRecipe<{ count: number; reach: number }, MothRefs>({
  id: "moths",
  breakage: "never",
  reason: "Moths find the lamps you light: a small sign of life that follows light, so a lit shrine or porch lamp is visibly warmer than an out one.",
  defaults: { count: 5, reach: 3 },
  build() {
    return { target: null, look: 0, count: 0 };
  },
  initial: "waiting",
  states: {
    waiting: {
      update(c, dt) {
        const r = c.refs;
        r.look -= dt;
        if (r.look > 0) return;
        r.look = 0.4;
        const w = c.world;
        const H = c.params.H;
        // the nearest warm light within reach (lights from lamps, candles and flames)
        let best: [number, number] | null = null, bd = (c.params["reach"] as number) * H;
        for (const L of w.lights()) {
          if (L.intensity < 0.2 || L.colour[0] < L.colour[2]) continue;
          const d = Math.hypot(L.x - c.x, L.y - c.y);
          if (d < bd) { bd = d; best = [L.x, L.y]; }
        }
        const moved = !best || !r.target || Math.hypot(best[0] - r.target[0], best[1] - r.target[1]) > 2;
        if (moved) retarget(c, best);
        r.target = best;
        if (!best || !w.inView(best[0], best[1], H)) return;
        // keep `count` moths on it
        const P = w.particles;
        let n = 0;
        for (let i = 0; i < P.n; i++) if (P.flags[i]! & P_ORBIT && Math.abs(P.hSx[i]! - best[0]) < 1 && Math.abs(P.hSy[i]! - best[1]) < 1) n++;
        r.count = n;
        const want = (c.params["count"] as number) * (w.reduced ? 0.5 : 1);
        for (let k = n; k < want; k++) {
          const a = c.rand() * Math.PI * 2;
          w.spawnAmbient({ x: best[0] + Math.cos(a) * H * 1.2, y: best[1] + Math.sin(a) * H * 0.8, vx: 0, vy: 0, life: 10 + c.rand() * 10, rgb: c.rand() < 0.5 ? [218, 208, 190] : [240, 232, 216], flags: P_ORBIT | P_FADE, orbit: best, size: k % 2 ? 2 : 1 });
        }
      },
    },
  },
  demo: {
    w: 5,
    params: { count: 6 },
    at: 1.2,
    with: [{ id: "shrineLantern", params: { lit: true }, dx: 0.3 }],
    script: [
      { label: "moths gather at the lit lamp", wait: 4 },
      { label: "the lamp goes out: they drift off", on: "shrineLantern", act: "douse", wait: 3 },
      { label: "lit again: they come back", on: "shrineLantern", act: "light", wait: 4 },
    ],
  },
});

/** Moths of the old lamp fly off (or to the new one). */
function retarget(c: Prop<MothRefs>, to: [number, number] | null): void {
  const old = c.refs.target;
  if (!old) return;
  const P = c.world.particles;
  for (let i = 0; i < P.n; i++) {
    if (!(P.flags[i]! & P_ORBIT) || Math.abs(P.hSx[i]! - old[0]) > 1 || Math.abs(P.hSy[i]! - old[1]) > 1) continue;
    if (to) {
      P.hSx[i] = to[0];
      P.hSy[i] = to[1];
    } else {
      // no light: off into the dark
      P.flags[i] = (P.flags[i]! & ~P_ORBIT) | P_FLOAT | P_AMB;
      P.vx[i] = (c.rand() - 0.5) * 80;
      P.vy[i] = -30 - c.rand() * 40;
      P.life[i] = Math.min(P.life[i]!, 1.5);
    }
  }
}

// ---------------------------------------------------------------------------
// puddle
// ---------------------------------------------------------------------------

export interface PuddleParams {
  /** Width in H. */
  width: number;
  /** The sky it holds. */
  sky: "day" | "dusk" | "storm";
}

interface PuddleRefs {
  part: Part;
  ripples: Ripples;
  mat: number;
  dirty: boolean;
  rainAcc: number;
  lastStep: number;
}

function drawPuddle(r: PuddleRefs): void {
  const g = r.part.grid;
  g.clearAll();
  const n = r.ripples.n;
  for (let x = 0; x < n; x++) {
    // an irregular oval edge
    const t = (x + 0.5) / n;
    const e = Math.sin(Math.PI * t);
    const depth = Math.max(1, Math.round(e * 4.4));
    const h = r.ripples.h[x]!;
    const slope = (r.ripples.h[Math.min(n - 1, x + 1)]! - r.ripples.h[Math.max(0, x - 1)]!) * 0.5;
    // the surface stands a pixel proud of the ground in the middle (a meniscus), lifted by ripples
    const top = e > 0.35 ? (h > 0.5 ? 0 : 1) : 2;
    for (let y = top; y < 2 + depth; y++) {
      const i = g.inner(x, y);
      if (i < 0) continue;
      const d = y - top;
      // the sky on the surface (two rows, broken where a ripple slopes), its colour below, darker deep down
      const broken = Math.abs(slope) > 0.2 || Math.abs(h) > 0.6;
      const tone = d === 0 ? (broken ? 0 : 1) : d === 1 ? (broken || (x + y) % 3 === 0 ? 0 : 1) : d === 2 ? 0 : -1;
      g.setRaw(i, r.mat, tone, 1, 1 + (d === 0 ? 1 + slope * 3 : 0), F_NOINK, 999);
    }
  }
  r.dirty = false;
}

export const puddle = defineRecipe<PuddleParams, PuddleRefs>({
  id: "puddle",
  breakage: "never",
  reason: "Water left by the storm: puddles on the spire and the pilgrim path hold the sky (the sunset after the storm), ring under your steps and splash when struck.",
  defaults: { width: 1.2, sky: "day" },
  cues: ["water.step", "water.splash"],
  feel: 0.3,
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const W = u(p.width);
    // sunk into the ground's top rows (drawn only over the ground), holding the sky's colour, unlit by the key
    b.part("water", { w: W, h: 8, pivot: [0, 2], at: [0, 0], layer: "decal", z: 2, outline: 0, hittable: false, lit: 0.3 });
    const refs: PuddleRefs = { part: b.get("water"), ripples: new Ripples(W, 110, 2.2, 0.3), mat: matId(p.sky === "dusk" ? "puddleDusk" : p.sky === "storm" ? "puddleStorm" : "puddleDay"), dirty: true, rainAcc: 0, lastStep: 0 };
    refs.part.tag["heal"] = false;
    refs.part.dynamicEvery = 2;
    refs.part.dynamic = () => {
      if (refs.dirty) drawPuddle(refs);
    };
    refs.part.glintT = -1;
    return refs;
  },
  initial: "still",
  states: {
    still: {
      update(c, dt) {
        const r = c.refs;
        const H = c.params.H;
        const w = c.world;
        const W = r.ripples.n;
        // footsteps ring it
        for (const a of w.actorsNear(c.x + W / 2, c.y, W / 2, H * 0.3)) {
          if (Math.abs(a.vx) < 10) continue;
          r.lastStep += dt;
          if (r.lastStep > 0.28) {
            r.lastStep = 0;
            const lx = Math.round(a.x - c.x);
            r.ripples.disturb(lx, 5, 2);
            puff(w, "water", a.x, c.y - 1, 3, [Math.sign(a.vx) * 0.3, -1], { speed: 0.5, spread: 0.6 });
            c.sound("water.step", 0.4);
          }
        }
        // rain (the host sets world.rain 0..1)
        const rain = w.rain;
        if (rain > 0) {
          r.rainAcc += dt * rain * W * 0.06;
          while (r.rainAcc >= 1) {
            r.rainAcc -= 1;
            r.ripples.disturb(c.rand() * W, 2.5, 1);
          }
        }
        const e = r.ripples.step(dt);
        if (e > 0.05) r.dirty = true;
        // a slow glint now and then (the sky moving over it)
        if (r.part.glintT < 0 && c.rand() < dt * 0.08) r.part.glintT = 0;
      },
      hit(c, h) {
        onPuddleHit(c, h.hit);
      },
    },
  },
  demo: {
    w: 6,
    params: { width: 1.4, sky: "day" },
    variants: [
      { label: "dusk (holds the sunset)", params: { width: 1.2, sky: "dusk" }, dx: 1.7 },
      { label: "storm", params: { width: 1, sky: "storm" }, dx: -2.2 },
    ],
    script: [
      { label: "still", wait: 0.8 },
      { label: "walk through: each step rings it", walk: [-0.6, 2.4], wait: 2.4 },
      { label: "slash into it: splash", hit: "heavy", from: -0.6, face: 1, wait: 1.6 },
      { label: "settles", wait: 1.5 },
    ],
  },
});

function onPuddleHit(c: Prop<PuddleRefs>, hit: Hit): void {
  const r = c.refs;
  const W = r.ripples.n;
  let at = -1;
  for (let x = 0; x < W; x += 3) if (coverage(hit.shape, c.x + x, c.y - 1) > 0) { at = x; break; }
  if (at < 0 && hit.type !== "wind") return;
  if (hit.type === "wind") {
    for (let x = 0; x < W; x += 6) r.ripples.disturb(x, 1.2, 2);
    return;
  }
  r.ripples.disturb(at, hit.type === "slash" ? 6 : 12, 4);
  puff(c.world, "water", c.x + at, c.y - 1, hit.type === "slash" ? 6 : 14, [hit.dir[0] * 0.3, -1], { speed: 1.4, spread: 0.7 });
  c.sound("water.splash", 0.7);
  r.dirty = true;
}

// ---------------------------------------------------------------------------
// paper
// ---------------------------------------------------------------------------

interface Sheet {
  /** Lying: the sheet seen edge-on. Flying: its face, turning as it falls. */
  part: Part;
  face: Part;
  hx: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  flying: boolean;
  away: number;
  phase: number;
}

interface PaperRefs {
  sheets: Sheet[];
}

export const paper = defineRecipe<{ count: number }, PaperRefs>({
  id: "paper",
  breakage: "never",
  reason: "Loose pages: in the archive, on the lodge floor, blown against the bus shelter; they lift in wind and your dash and flutter down, a small thing that moves when you do.",
  defaults: { count: 3 },
  cues: ["paper.flutter"],
  feel: 0.6,
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const sheets: Sheet[] = [];
    for (let k = 0; k < Math.max(1, Math.min(6, p.count)); k++) {
      const w = u(0.15 + b.rand() * 0.04), h = u(0.11);
      const name = `sheet${k}`;
      const sp = b.part(name, { w, h: 3, pivot: [w >> 1, 2], at: [0, 0], layer: "mid", z: 5 + k, smoothRotate: true, hittable: false });
      // lying flat: a thin sheet seen edge-on with its inked side up
      sp.rect(0, 1, w, 2, { mat: "parchment", profile: "flat", depth: 1 });
      sp.rect(2, 1, w - 4, 1, { mat: "parchment", mode: "paint", tone: 1 });
      for (let x = 3; x < w - 3; x += 3) sp.pixels([[x, 2]], { mat: "mapInk", mode: "paint" });
      const fc = b.part(`face${k}`, { w, h, pivot: [w >> 1, h >> 1], at: [0, 0], layer: "mid", z: 5 + k, smoothRotate: true, hittable: false, visible: false });
      fc.rect(0, 0, w, h, { mat: "parchment", profile: "flat", depth: 1 });
      fc.rect(0, 0, w, 1, { mat: "parchment", mode: "paint", tone: 1 });
      for (let y = 3; y < h - 2; y += 3) fc.rect(2, y, w - 4 - ((y * 7) % 5), 1, { mat: "mapInk", mode: "paint" });
      const face = b.get(`face${k}`);
      face.worldSpace = true;
      face.y = b.oy;
      const part = b.get(name);
      part.worldSpace = true;
      const hx = b.ox + (k - (p.count - 1) / 2) * u(0.22) + (b.rand() - 0.5) * u(0.06);
      sheets.push({ part, face, hx, x: hx, y: b.oy, vx: 0, vy: 0, rot: (b.rand() - 0.5) * 0.1, vr: 0, flying: false, away: 0, phase: b.rand() * 6 });
      part.x = Math.round(hx);
      part.y = b.oy;
      face.x = Math.round(hx);
      part.rot = sheets[k]!.rot;
    }
    return { sheets };
  },
  initial: "lying",
  states: {
    lying: {
      update(c, dt) {
        const w = c.world;
        const H = c.params.H;
        for (const s of c.refs.sheets) {
          const [wx] = w.windAt(s.x, s.y - 4);
          const hurried = w.actorsNear(s.x, s.y, H * 0.35, H * 0.3).some((a) => Math.abs(a.vx) > H * 2.2);
          if (!s.flying && (Math.abs(wx) > 520 || hurried)) lift(c, s, Math.sign(wx) || Math.sign(w.actors[0]?.vx ?? 1), 0.8);
          if (s.flying) flutter(c, s, dt, wx);
          else if (Math.abs(s.x - s.hx) > H * 2) {
            s.away += dt;
            if (s.away > 6) home(c, s);
          }
        }
      },
      hit(c, h) {
        const H = c.params.H;
        for (const s of c.refs.sheets) {
          const inCone = h.hit.shape.kind === "cone" && Math.hypot(s.x - h.hit.shape.x, s.y - 4 - h.hit.shape.y) < h.hit.shape.len;
          if (inCone || coverage(h.hit.shape, s.x, s.y - 2) > 0 || Math.hypot(s.x - (h.contact?.[0] ?? 1e9), s.y - (h.contact?.[1] ?? 1e9)) < H * 0.6) lift(c, s, h.hit.dir[0] || 1, h.hit.type === "wind" ? 1.2 : 1);
        }
      },
    },
  },
  demo: {
    w: 4,
    params: { count: 4 },
    script: [
      { label: "lying on the floor", wait: 0.6 },
      { label: "dash past: they lift and flutter down", hit: "wind", from: -1.3, face: 1, wait: 3 },
      { label: "strong wind", wind: 700, wait: 2 },
      { label: "calm", wind: 0, wait: 3 },
      { label: "strays fade home", wait: 6 },
    ],
  },
});

function lift(c: Prop<PaperRefs>, s: Sheet, dir: number, k: number): void {
  const H = c.params.H;
  s.flying = true;
  s.away = 0;
  s.vx = dir * H * (0.8 + c.rand() * 0.8) * k;
  s.vy = -H * (1.6 + c.rand() * 0.8) * k;
  s.vr = (c.rand() - 0.5) * 8;
  c.sound("paper.flutter", 0.4);
}

function flutter(c: Prop<PaperRefs>, s: Sheet, dt: number, wx: number): void {
  const H = c.params.H;
  const t = c.world.time + s.phase;
  // falls slowly, sliding side to side as it rocks (the falling-leaf path)
  s.vy += H * 3.2 * dt;
  s.vy = Math.min(s.vy, H * 0.7);
  s.vx += (Math.sin(t * 5) * H * 2.4 + wx * 0.25) * dt;
  s.vx *= Math.pow(0.5, dt);
  s.rot = Math.sin(t * 5) * 0.9 + s.vr * 0.05;
  s.x += s.vx * dt;
  s.y += s.vy * dt;
  if (s.y >= c.y && s.vy > 0) {
    s.y = c.y;
    s.flying = false;
    s.vx = s.vy = 0;
    s.rot = (c.rand() - 0.5) * 0.12;
  }
  s.part.x = Math.round(s.x);
  s.part.y = Math.round(s.y);
  s.part.rot = s.rot;
  // in the air you see the page; on the floor, its edge
  s.face.visible = s.flying;
  s.part.visible = !s.flying;
  s.face.x = Math.round(s.x);
  s.face.y = Math.round(s.y - s.face.pivotY);
  s.face.rot = s.rot * 0.6 + Math.sin(c.world.time * 3 + s.phase) * 0.4;
}

function home(c: Prop<PaperRefs>, s: Sheet): void {
  s.away = -99;
  c.world.tweens.add({
    target: s.part, key: "dissolve", to: 1, dur: 0.6, onDone: () => {
      s.x = s.hx;
      s.y = c.y;
      s.part.x = Math.round(s.x);
      s.part.y = Math.round(s.y);
      s.part.rot = 0;
      s.away = 0;
      c.world.tweens.add({ target: s.part, key: "dissolve", to: 0, dur: 0.6 });
    },
  });
}

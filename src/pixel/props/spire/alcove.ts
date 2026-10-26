// The storm alcove (lane R-D; WORLD-PLAN D2, shrine 4): a window alcove cut
// into the spire halfway up the outer climb, the coziest place inside the
// worst weather. Two recipes:
//
//   stormAlcove  the recess: a back wall of warm-lit iron plates, thick cut
//                jambs, and a heavy lintel whose front edge drips rain
//   stormWindow  the small stained-glass window in its back wall, the first
//                stained glass in the world (a hint of the chapel): an iron
//                pointed arch, leaded quarries in storm blues with a small warm
//                rose, cracked by the storm, rain running down it. It is dark
//                with the storm behind it; lightning lights it from behind for
//                a moment and throws its colours into the alcove.
//                States: cracked (as the storm left it), shattered (a hit
//                breaks panes into glinting shards), reassembling (they fly
//                home one by one), whole (mended: the cracks are gone too,
//                until the next visit). Breakage "heal".
//
// Origins: the alcove's floor at its left end; the window's sill, bottom centre.

import "./materials.ts";
import { F_NOINK } from "../../cells.ts";
import { mat, matById } from "../../materials.ts";
import { hash2 } from "../../util.ts";
import { P_FADE, P_GRAV } from "../../bodies.ts";
import { defineRecipe, type Prop, type PropGlow, type PropLight } from "../../prop.ts";
import type { Part } from "../../part.ts";
import type { CellGrid } from "../../cells.ts";
import { STORM } from "./storm.ts";

// ------------------------------------------------------------------------------------
// the recess

export interface AlcoveParams {
  /** Width and height of the opening, H. */
  width: number;
  height: number;
}

export const stormAlcove = defineRecipe<AlcoveParams, { drip: number; lintelY: number; w: number }>({
  id: "stormAlcove",
  breakage: "floor",
  reason: "The storm alcove: a window cut into the spire halfway up the climb, a dry warm recess with a shrine, candles and a bench, the coziest place inside the worst weather.",
  defaults: { width: 8.8, height: 3.9 },
  demo: {
    w: 11,
    params: { width: 8.8, height: 3.9 },
    script: [
      { label: "the recess, rain dripping off the lintel", wait: 2 },
      { label: "heavy on the jamb: dents and sparks", hit: "heavy", from: 0.4, wait: 1.5 },
    ],
  },
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const W = u(p.width), Ht = u(p.height);
    const jamb = u(0.42), lintel = u(0.5);
    // the back wall, behind everything
    const back = b.part("back", { w: W, h: Ht, pivot: [0, Ht], at: [0, 0], layer: "bg", z: 1, collide: "none" });
    const course = u(0.46);
    for (let y = 0, k = 0; y < Ht; y += course, k++) {
      const hh = Math.min(course, Ht - y);
      back.rect(0, y, W, hh, { mat: "spireIron", profile: "bevel", r: 1, depth: 2, piece: `c${k % 2}`, tone: k === 0 ? -1 : 0 });
      const jw = u(1.2 + (k % 3) * 0.25);
      for (let x = (k % 2) * (jw >> 1); x < W; x += jw) back.rect(x, y, 1, hh, { mat: "spireIronDark", mode: "paint" });
    }
    back.speckle({ amount: 0.07, seed: p.seed, tone: -1, scale: 2 });
    // jambs: the thickness of the spire's skin, cut clean, a lit bevel on the left one (two small parts)
    for (const [side, lit] of [[0, true], [1, false]] as const) {
      const name = lit ? "jambL" : "jambR";
      const jb = b.part(name, { w: jamb, h: Ht, pivot: [0, Ht], at: [side === 0 ? -jamb : W, 0], layer: "bg", z: 3, collide: "none" });
      jb.rect(0, 0, jamb, Ht, { mat: "spireIron", profile: "bevel", r: 3, depth: 5, z: 2 });
      jb.rect(lit ? jamb - 2 : 0, 0, 2, Ht, { mat: "spireIron", mode: "paint", tone: lit ? 1 : -1 });
      jb.rivets([[4, 6], [jamb - 5, 6], [4, Ht - 6], [jamb - 5, Ht - 6]], { mat: "spireIron", r: 1 });
    }
    // the lintel over the opening (in front of her: she walks under it)
    const lt = b.part("lintel", { w: W + jamb * 2 + 8, h: lintel, pivot: [jamb + 4, lintel], at: [0, -Ht], layer: "fg", z: 4, collide: "none", parallax: 1 });
    lt.rect(0, 0, W + jamb * 2 + 8, lintel, { mat: "spireIron", profile: "bevel", r: 3, depth: 5, z: 2 });
    lt.rect(0, 0, W + jamb * 2 + 8, 1, { mat: "spireIron", mode: "paint", tone: 1 });
    lt.rect(0, lintel - 3, W + jamb * 2 + 8, 3, { mat: "spireIronDark", mode: "paint" });
    const rv: [number, number][] = [];
    for (let x = 6; x < W + jamb * 2; x += u(0.4)) rv.push([x, lintel >> 1]);
    lt.rivets(rv, { mat: "spireIron", r: 1 });
    lt.rect(u(0.6), 5, u(1.2), 3, { mat: "routeRed", mode: "paint" });
    b.get("back").tag["heal"] = true;
    // the recess holds the candles' warmth: a low warm fill across the back wall
    b.light({ at: [Math.round(W * 0.62), -Math.round(Ht * 0.35)], colour: [1, 0.66, 0.4], radius: u(4.6), intensity: 0.42, height: u(1.4), flicker: 0.08 });
    b.light({ at: [Math.round(W * 0.15), -Math.round(Ht * 0.4)], colour: [1, 0.7, 0.45], radius: u(3), intensity: 0.25, height: u(1.2), flicker: 0.06 });
    return { drip: 0, lintelY: -Ht, w: W };
  },
  initial: "idle",
  states: {
    idle: {
      update(c, dt) {
        // rain drips off the lintel's front edge, less in reduced motion
        const r = c.refs;
        if (STORM.strength <= 0) return;
        r.drip -= dt * (c.world.reduced ? 0.4 : 1);
        if (r.drip > 0) return;
        r.drip = 0.08 + c.rand() * 0.25;
        const x = c.x + c.rand() * r.w;
        c.world.particles.spawn({ x, y: c.y + r.lintelY + 2, vx: 0, vy: c.params.H * 0.5, life: 0.6 + c.rand() * 0.3, rgb: [120, 140, 170], flags: P_GRAV | P_FADE, size: 1 });
      },
      hit(c, h) {
        if (h.hit.type !== "wind") c.damage(h.hit);
      },
    },
  },
});

// ------------------------------------------------------------------------------------
// the window

export interface StormWindowParams {
  /** Width and height in H. */
  width: number;
  height: number;
  /** Floor distance below the sill in px (the colours fall there). */
  drop: number;
}

interface WinRefs {
  glass: Part;
  frame: Part;
  cracks: Part;
  rain: Part;
  total: number;
  now: number;
  recount: number;
  lights: PropLight[];
  beams: PropGlow[];
  pool: PropGlow;
  back: number;
}

const QUARRY = ["glassBlue", "glassBlue", "glassViolet", "glassBlue", "glassPale"];

function countGlass(g: CellGrid): number {
  let n = 0;
  for (let i = 0; i < g.mat.length; i++) if (g.mat[i] && matById(g.mat[i]!)?.behaviour === "shatter") n++;
  return n;
}

export const stormWindow = defineRecipe<StormWindowParams, WinRefs>({
  id: "stormWindow",
  breakage: "heal",
  reason: "The first stained glass in the world, a hint of the chapel: dark with the storm behind it, lit from behind by lightning; cracked by the storm, shattered by a hit, it reassembles.",
  defaults: { width: 1.3, height: 2.1, drop: 60 },
  cues: ["glass.shatter", "glass.hit"],
  demo: {
    w: 5,
    at: 1,
    indoor: true,
    script: [
      { label: "cracked, rain on the glass, dark", wait: 1.5 },
      { label: "slash: panes shatter into shards", hit: "slash", from: -0.6, wait: 2 },
      { label: "shards fly home: whole", wait: 10 },
    ],
  },
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const W = u(p.width), Hh = u(p.height);
    const t = Math.max(5, u(0.1));
    const sillH = u(0.12);
    const cx = Math.floor(W / 2);
    const openW = W - t * 2;
    const sy = openW * 0.9;
    const inArch = (x: number, y: number): boolean => {
      const X = x + 0.5 - t, Y = y + 0.5 - t;
      if (X < 0 || X > openW || Y < 0 || y > Hh - sillH) return false;
      if (Y >= sy) return true;
      return Math.hypot(X - openW, Y - sy) <= openW && Math.hypot(X, Y - sy) <= openW;
    };
    const gl = b.part("glass", { w: W, h: Hh, pivot: [cx, Hh], at: [0, 0], layer: "bg", z: 10, outline: 0 });
    const s = Math.max(8, u(0.16));
    const roseY = t + Math.round(openW * 0.42), roseR = Math.round(openW * 0.22);
    const lead = mat("lead").id;
    let pn = 0;
    const pieceIds = new Map<string, number>();
    for (let y = 0; y < Hh; y++)
      for (let x = 0; x < W; x++) {
        if (!inArch(x, y)) continue;
        const X = x - t, Y = y - t;
        const du = (X + Y) / s, dv = (X - Y) / s;
        const fu = du - Math.floor(du), fv = dv - Math.floor(dv);
        const i = gl.grid.inner(x, y);
        const rr = Math.hypot(x + 0.5 - cx, y + 0.5 - roseY) / roseR;
        const inRose = rr < 1;
        if (inRose ? Math.abs(rr - 0.45) < 0.1 || Math.abs(rr - 0.98) < 0.06 : fu < 1.2 / s || fv < 1.2 / s) {
          gl.grid.setRaw(i, lead, 0, 1, 2, F_NOINK, 70);
          continue;
        }
        const key = inRose ? `r${rr < 0.45 ? 0 : Math.floor((Math.atan2(y - roseY, x - cx) + Math.PI) / (Math.PI / 3))}` : `${Math.floor(du)}:${Math.floor(dv)}`;
        if (!pieceIds.has(key)) pieceIds.set(key, pn++);
        const iu = Math.floor(du), iv = Math.floor(dv);
        const ph = hash2(iu, iv, 5);
        const m = inRose ? (rr < 0.45 ? "glassGold" : "glassRed") : QUARRY[Math.floor(ph * QUARRY.length)]!;
        const ph2 = hash2(iu, iv, 31);
        const tone = (ph2 < 0.15 ? 1 : ph2 > 0.85 ? -1 : 0) + (Math.min(fu, fv) > 0.6 ? 1 : 0);
        gl.grid.setRaw(i, mat(m).id, Math.min(1, tone), gl.pieceId(`pane${pieceIds.get(key)! % 240}`), 1.5, 0, 12);
      }
    // the iron frame in front of the glass
    const fr = b.part("frame", { w: W + 6, h: Hh + 3, pivot: [cx + 3, Hh + 3], at: [0, 3], layer: "bg", z: 12 });
    fr.arch(3, 0, W, Hh - sillH + 2, { mat: "spireIron", profile: "bevel", r: 3, depth: 4, z: 2, piece: "arch" });
    fr.arch(3 + t, t, openW, Hh - sillH - t + 2, { mat: "spireIron", mode: "erase" });
    fr.rect(0, Hh - sillH + 1, W + 6, sillH + 2, { mat: "spireIron", profile: "bevel", r: 2, depth: 4, z: 4, piece: "sill" });
    fr.rect(0, Hh - sillH + 1, W + 6, 1, { mat: "spireIron", mode: "paint", tone: 1 });
    fr.rivets([[5, Hh - sillH - 6], [W, Hh - sillH - 6]], { mat: "spireIron", r: 1 });
    b.get("frame").tag["heal"] = true;
    // cracks across the glass (a separate overlay: gone once the window has reassembled)
    const ck = b.part("cracks", { w: W, h: Hh, pivot: [cx, Hh], at: [0, 0], layer: "bg", z: 11, outline: 0, hittable: false });
    const crack = (x0: number, y0: number, segs: number, seed: number): void => {
      let x = x0, y = y0;
      for (let k = 0; k < segs; k++) {
        const a = (hash2(seed, k, 3) - 0.5) * 2.4 + Math.PI / 2 * (hash2(seed, k, 9) > 0.5 ? 1 : -0.4);
        const nx = Math.round(x + Math.cos(a) * 4), ny = Math.round(y + Math.sin(a) * 4);
        const pts: [number, number][] = [];
        for (let q = 0; q <= 4; q++) {
          const px = Math.round(x + ((nx - x) * q) / 4), py = Math.round(y + ((ny - y) * q) / 4);
          if (inArch(px, py)) pts.push([px, py]);
        }
        if (pts.length) ck.pixels(pts, { mat: "glassPale", tone: 1, noInk: true });
        x = nx;
        y = ny;
      }
    };
    crack(cx - 4, Math.round(Hh * 0.55), 7, p.seed + 1);
    crack(cx + 3, Math.round(Hh * 0.3), 5, p.seed + 2);
    crack(cx - 2, Math.round(Hh * 0.72), 4, p.seed + 3);
    // rain running down the glass: redrawn at 15 Hz
    const rn = b.part("rain", { w: W, h: Hh, pivot: [cx, Hh], at: [0, 0], layer: "bg", z: 11.5, outline: 0, hittable: false });
    const rainPart = b.get("rain");
    rainPart.dynamicEvery = 4;
    const drops = Array.from({ length: 7 }, (_, k) => ({ x: Math.round(t + hash2(k, 1, p.seed) * openW), y: hash2(k, 2, p.seed) * Hh, v: 6 + hash2(k, 3, p.seed) * 14 }));
    const water = mat("glassPale").id;
    rainPart.dynamic = (part, dt) => {
      const g = part.grid;
      g.clearAll();
      if (STORM.strength <= 0) return;
      for (const d of drops) {
        d.y += d.v * dt * 4;
        if (d.y > Hh - sillH) {
          d.y = t + openW * 0.3;
          d.x = Math.round(t + Math.random() * openW);
        }
        for (let k = 0; k < 3; k++) {
          const yy = Math.round(d.y) - k;
          if (!inArch(d.x, yy)) continue;
          const i = g.inner(d.x, yy);
          if (i >= 0) g.setRaw(i, water, k === 0 ? 1 : 0, 1, 1, F_NOINK, 1);
        }
      }
    };
    void rn;
    // the light lightning throws through it: cold from behind, coloured shafts into the alcove
    const drop = p.drop;
    const beamCols: [number, number, number][] = [[0.35, 0.5, 1], [0.6, 0.4, 0.95], [1, 0.7, 0.4]];
    const beams: PropGlow[] = [-0.22, 0.22, 0].map((fx, k) =>
      b.glow({ kind: "beam", at: [Math.round(fx * W), -Math.round(Hh * (k === 2 ? 0.62 : 0.35))], to: [Math.round(0.45 * drop), drop + Math.round(Hh * 0.35)], colour: beamCols[k]!, radius: Math.round(W * 0.25), width1: Math.round(W * 0.5), intensity: 0.7 }),
    );
    const pool = b.glow({ kind: "disc", at: [Math.round(0.45 * drop), drop], colour: [0.55, 0.6, 1], radius: Math.round(W * 0.8), flat: 0.1, intensity: 0.7 });
    const lights = [
      b.light({ at: [0, -Math.round(Hh * 0.45)], colour: [0.6, 0.7, 1], radius: u(3.4), intensity: 0.9, height: u(1.2) }),
      b.light({ at: [0, -Math.round(Hh * 0.62)], colour: [1, 0.6, 0.5], radius: u(2.2), intensity: 0.5, height: u(1.2) }),
    ];
    const glass = b.get("glass");
    const total = countGlass(glass.grid);
    return { glass, frame: b.get("frame"), cracks: b.get("cracks"), rain: rainPart, total, now: total, recount: 0, lights, beams, pool, back: 0 };
  },
  initial: "cracked",
  states: {
    cracked: {
      enter(c) {
        c.refs.cracks.visible = true;
      },
      update: (c, dt) => backlight(c, dt),
      hit: (c, h) => (hitGlass(c, h.hit) ? "shattered" : undefined),
    },
    shattered: {
      sound: "glass.shatter",
      enter(c) {
        c.refs.cracks.visible = false;
      },
      update: (c, dt) => backlight(c, dt),
      hit(c, h) {
        hitGlass(c, h.hit);
        c.t = 0;
      },
      after: [4.5, "reassembling"],
    },
    reassembling: {
      enter(c) {
        c.world.restoreDebris(c.refs.glass, { stagger: 6, dur: 1.5 });
        c.world.restoreDebris(c.refs.frame, { stagger: 2, dur: 1 });
      },
      update(c, dt) {
        backlight(c, dt);
        const done = !c.world.chunks.some((k) => k.home?.part === c.refs.glass) && c.t > 2;
        if (done || c.t > 12) {
          c.world.restorePart(c.refs.glass);
          c.world.restorePart(c.refs.frame);
          c.refs.now = c.refs.total;
          c.go("whole");
        }
      },
      hit: (c, h) => (hitGlass(c, h.hit) ? "shattered" : undefined),
    },
    whole: {
      update: (c, dt) => backlight(c, dt),
      hit: (c, h) => (hitGlass(c, h.hit) ? "shattered" : undefined),
    },
  },
});

function hitGlass(c: Prop<WinRefs>, hit: import("../../hits.ts").Hit): boolean {
  if (hit.type === "wind") return false;
  const before = c.refs.now;
  c.damage(hit);
  c.refs.now = countGlass(c.refs.glass.grid);
  c.refs.glass.glintT = 0;
  return c.refs.now < before - 4;
}

/** Dark with the storm behind it; lightning (the world's flash) lights it from behind for a moment. */
function backlight(c: Prop<WinRefs>, dt: number): void {
  const r = c.refs;
  if (c.state === "reassembling" && (r.recount = (r.recount + 1) % 12) === 0) r.now = countGlass(r.glass.grid);
  const k = Math.max(0, Math.min(1, (r.now / Math.max(1, r.total) - 0.1) / 0.9));
  const target = STORM.strength > 0 ? STORM.flash : 0.6;
  // quick to light, slower to fade (stepped by the flash itself)
  r.back = target > r.back ? target : Math.max(target, r.back - dt * 2.5);
  const lv = k * (0.12 + 0.88 * r.back);
  r.glass.glow = 0.15 + 0.85 * r.back;
  for (const L of r.lights) L.level = lv;
  for (const B of r.beams) B.level = k * r.back;
  r.pool.level = k * r.back * 0.8;
}

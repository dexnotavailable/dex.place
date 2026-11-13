// Stained-glass window: a stone lancet pair under a rose, leaded quarries
// of coloured glass lit from behind. It throws coloured shafts onto the
// floor and coloured light (Rosace's rim takes the colour). A hit shatters
// the panes it reaches into glinting shards that fall and settle; after a
// while the shards lift and fly home one by one, and the light comes back
// with them. The stone chips and mends. Origin: the sill's bottom centre
// (place it on the wall, the sill ~1 H above the floor).

import { F_NOINK, type CellGrid } from "../cells.ts";
import { mat, matById } from "../materials.ts";
import { hash2 } from "../util.ts";
import { defineRecipe, type Prop, type PropGlow, type PropLight } from "../prop.ts";
import type { Part } from "../part.ts";

export interface WindowParams {
  /** Width and height in H. */
  width: number;
  height: number;
  /** Direction the shafts fall (x per unit of drop). */
  slant: number;
  /** Floor distance below the sill in px (shafts end there). */
  drop: number;
}

interface Refs {
  glass: Part;
  frame: Part;
  total: number;
  now: number;
  recount: number;
  lights: PropLight[];
  beams: PropGlow[];
  pool: PropGlow;
}

type Region = "border" | "field" | "flame" | "base" | "rose" | "roseCore" | "roseField";
const REGION_MAT: Record<Region, string[]> = {
  border: ["glassRed", "glassRed", "glassGold"],
  field: ["glassBlue", "glassBlue", "glassBlue", "glassViolet"],
  flame: ["glassGold", "glassGold", "glassPale"],
  base: ["glassGreen", "glassGreen", "glassBlue"],
  rose: ["glassRed", "glassGold"],
  roseCore: ["glassGold"],
  roseField: ["glassViolet", "glassBlue"],
};

export const stainedGlass = defineRecipe<WindowParams, Refs>({
  id: "stainedGlass",
  reason: "The chapel of light's windows: they colour the light Rosace walks through, and show the place is kept (they mend).",
  defaults: { width: 2.1, height: 3.6, slant: -0.55, drop: 80 },
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const W = u(p.width), Hh = u(p.height);
    const t = Math.max(6, u(0.13)); // frame thickness
    const sillH = u(0.14);
    const cx = Math.floor(W / 2);
    const openW = W - t * 2, openH = Hh - t - sillH;
    // --- glass (behind the frame) ---
    const gl = b.part("glass", { w: W, h: Hh, pivot: [cx, Hh], at: [0, 0], layer: "bg", z: 10, outline: 0 });
    const lancetW = Math.floor((openW - t) / 2);
    const roseR = Math.round(openW * 0.25);
    const roseY = t + Math.round(openW * 0.36);
    const headH = Math.round(lancetW * 0.866);
    const lancetTop = roseY + roseR + headH - Math.round(roseR * 0.3);
    const s = Math.max(10, u(0.19)); // quarry size
    const pieces = new Map<string, number>();
    const pieceOf = (key: string): string => {
      if (!pieces.has(key)) pieces.set(key, pieces.size);
      return `pane${pieces.get(key)! % 240}`;
    };
    // opening mask: the arch minus mullion, drawn cell by cell
    const inArch = (x: number, y: number): boolean => {
      const X = x + 0.5 - t, Y = y + 0.5 - t;
      if (X < 0 || X > openW || Y < 0 || y > Hh - sillH) return false;
      const R = openW;
      const sy = openW * 0.866;
      if (Y >= sy) return true;
      return Math.hypot(X - R, Y - sy) <= R && Math.hypot(X, Y - sy) <= R;
    };
    const lead = "lead";
    for (let y = 0; y < Hh; y++) {
      for (let x = 0; x < W; x++) {
        if (!inArch(x, y)) continue;
        const X = x - t, Y = y - t;
        const du = (X + Y) / s, dv = (X - Y) / s;
        const fu = du - Math.floor(du), fv = dv - Math.floor(dv);
        const leadLine = fu < 1 / s * 1.2 || fv < 1 / s * 1.2;
        // regions
        const inRose = Math.hypot(x + 0.5 - cx, y + 0.5 - roseY) < roseR;
        const lancet = x < cx ? 0 : 1;
        const lx = lancet === 0 ? x - t : x - (t + lancetW + t);
        const ly = y - lancetTop;
        let region: Region = "field";
        if (inRose) {
          const r = Math.hypot(x + 0.5 - cx, y + 0.5 - roseY) / roseR;
          const a = Math.atan2(y + 0.5 - roseY, x + 0.5 - cx);
          const petal = Math.cos(a * 6) * 0.5 + 0.5;
          region = r < 0.28 ? "roseCore" : r < 0.72 && petal > 0.35 ? "rose" : "roseField";
        } else {
          const edge = Math.min(lx, lancetW - lx);
          const flameX = Math.abs(lx - lancetW / 2) / (lancetW / 2);
          const fy = ly / Math.max(1, openH - lancetTop + t);
          if (edge < s * 0.55) region = "border";
          else if (fy > 0.82) region = "base";
          else if (fy > 0.18 && fy < 0.78 && flameX < 0.55 * Math.sin(Math.PI * Math.min(1, (fy - 0.18) / 0.6)) + 0.08) region = "flame";
        }
        const key = inRose ? `r${Math.floor(Math.atan2(y - roseY, x - cx) * 3)}${Math.floor(Math.hypot(x - cx, y - roseY) / (roseR / 3))}` : `${lancet}:${Math.floor(du / 2)}:${Math.floor(dv / 2)}`;
        const i = gl.grid.inner(x, y);
        if (leadLine && !inRose) {
          gl.grid.setRaw(i, mat(lead).id, 0, 1, 2, F_NOINK, 70);
          continue;
        }
        if (inRose) {
          const r = Math.hypot(x + 0.5 - cx, y + 0.5 - roseY) / roseR;
          const a = Math.atan2(y + 0.5 - roseY, x + 0.5 - cx);
          const ringLead = Math.abs(r - 0.28) < 0.05 || Math.abs(r - 0.72) < 0.04 || (r > 0.28 && Math.abs(((a / (Math.PI / 6)) % 1 + 1) % 1 - 0.5) > 0.47);
          if (ringLead) {
            gl.grid.setRaw(i, mat(lead).id, 0, 1, 2, F_NOINK, 70);
            continue;
          }
        }
        const mats = REGION_MAT[region];
        // one colour and one tone per pane (quarry), never per pixel
        const iu = Math.floor(du), iv = Math.floor(dv);
        const ph = hash2(iu + lancet * 97, iv, inRose ? 11 : 3);
        const m = mats[Math.floor(ph * mats.length)] ?? mats[0]!;
        const pid = gl.pieceId(pieceOf(key));
        const ph2 = hash2(iu, iv, 29);
        let tone = ph2 < 0.12 ? 1 : ph2 > 0.86 ? -1 : 0;
        // old glass: a soft streak inside each pane, lighter toward its top corner
        if (Math.min(fu, fv) > 0.62) tone += 1;
        gl.grid.setRaw(i, mat(m).id, Math.min(1, tone), pid, 1.5, 0, 12);
      }
    }
    // --- the stone frame (in front of the glass) ---
    const fr = b.part("frame", { w: W + 8, h: Hh + 4, pivot: [cx + 4, Hh + 4], at: [0, 4], layer: "bg", z: 12 });
    const fx = 4;
    // outer arch minus the opening
    fr.arch(fx, 0, W, Hh - sillH + 2, { mat: "stoneLight", profile: "bevel", r: 3, depth: 5, z: 2, piece: "arch" });
    fr.arch(fx + t, t, openW, Hh - sillH - t + 2, { mat: "stoneLight", mode: "erase" });
    // tympanum: solid stone above the lancets, pierced by the two pointed heads and the rose
    fr.arch(fx + t, t, openW, Hh - sillH - t + 2, { mat: "stoneLight", profile: "flat", depth: 3, z: 2, piece: "tympanum", paint: (_x, y) => (y <= lancetTop ? undefined : null) });
    for (const lx of [fx + t, fx + t + lancetW + t]) fr.arch(lx, lancetTop - headH, lancetW, headH + 2, { mat: "stoneLight", mode: "erase" });
    fr.circle(fx + cx, roseY, roseR, { mat: "stoneLight", mode: "erase" });
    // rose ring and cusps
    fr.ring(fx + cx, roseY, roseR - 1, roseR + Math.max(3, Math.round(t * 0.5)), { mat: "stoneLight", profile: "dome", r: 3, z: 4, piece: "rose" });
    // mullion between the lancets
    fr.rect(fx + t + lancetW, lancetTop - headH + 2, t, Hh - sillH - lancetTop + headH, { mat: "stoneLight", profile: "cylV", z: 3, piece: "mullion" });
    // lancet head mouldings
    for (const lx of [fx + t, fx + t + lancetW + t]) {
      fr.arch(lx - 1, lancetTop - headH - 1, lancetW + 2, headH + 3, { mat: "stoneLight", mode: "paint", tone: -1, paint: (_x, _y, d) => (d < 2 ? "stoneLight" : null) });
    }
    // sill
    fr.rect(0, Hh - sillH + 2, W + 8, sillH + 2, { mat: "stoneLight", profile: "bevel", r: 3, depth: 5, z: 4, piece: "sill" });
    fr.rect(0, Hh - sillH + 2, W + 8, 1, { mat: "stoneLight", mode: "paint", tone: 1 });
    fr.speckle({ amount: 0.1, seed: p.seed + 7, tone: -1, scale: 2 });
    fr.cracks(fx + 4, Hh - sillH - 10, { n: 1, len: 12, seed: p.seed + 11, dir: -Math.PI / 2 });
    b.get("frame").tag["heal"] = true;
    // --- light: coloured shafts to the floor, a pool, coloured point lights ---
    const drop = p.drop;
    const beamCols: [number, number, number][] = [[0.3, 0.45, 0.95], [1, 0.78, 0.38], [0.9, 0.32, 0.38]];
    const beams: PropGlow[] = [];
    [[-0.25, 0], [0.25, 1], [0, 2]].forEach(([fxp, ci], k) => {
      const sx = Math.round(fxp! * W), sy = -Math.round(Hh * (k === 2 ? 0.72 : 0.35));
      beams.push(b.glow({ kind: "beam", at: [sx, sy], to: [Math.round(p.slant * (drop - sy)), drop - sy], colour: beamCols[ci!]!, radius: Math.round(W * 0.28), width1: Math.round(W * 0.55), intensity: 0.62 }));
    });
    const pool = b.glow({ kind: "disc", at: [Math.round(p.slant * drop), drop], colour: [0.75, 0.62, 0.8], radius: Math.round(W * 0.8), flat: 0.1, intensity: 0.7 });
    const lights = [
      b.light({ at: [-Math.round(W * 0.2), -Math.round(Hh * 0.4)], colour: [0.45, 0.55, 1], radius: u(3.2), intensity: 0.55, height: u(1.2) }),
      b.light({ at: [Math.round(W * 0.2), -Math.round(Hh * 0.4)], colour: [1, 0.72, 0.4], radius: u(3), intensity: 0.5, height: u(1.2) }),
      b.light({ at: [0, -Math.round(Hh * 0.75)], colour: [0.95, 0.45, 0.5], radius: u(2.6), intensity: 0.4, height: u(1.2) }),
    ];
    const glass = b.get("glass");
    const total = countGlass(glass.grid);
    return { glass, frame: b.get("frame"), total, now: total, recount: 0, lights, beams, pool };
  },
  initial: "idle",
  states: {
    idle: {
      update: (c) => lightLevel(c),
      hit: (c, h) => (hitWindow(c, h.hit) ? "broken" : undefined),
    },
    broken: {
      sound: "glass.shatter",
      update: (c) => lightLevel(c),
      hit(c, h) {
        hitWindow(c, h.hit);
        c.t = 0;
      },
      after: [4.5, "restoring"],
    },
    restoring: {
      enter(c) {
        c.world.restoreDebris(c.refs.glass, { stagger: 6, dur: 1.5 });
        c.world.restoreDebris(c.refs.frame, { stagger: 2, dur: 1 });
      },
      update(c) {
        lightLevel(c);
        const g = c.refs.glass.grid;
        const done = !c.world.chunks.some((k) => k.home?.part === c.refs.glass) && c.t > 2;
        if (done || c.t > 12) {
          c.world.restorePart(c.refs.glass);
          c.world.restorePart(c.refs.frame);
          c.refs.now = c.refs.total;
          c.go("idle");
        }
        void g;
      },
      hit: (c, h) => (hitWindow(c, h.hit) ? "broken" : undefined),
    },
  },
});

/** Glass cells left (lead and stone don't count: only glass shines). */
function countGlass(g: CellGrid): number {
  let n = 0;
  for (let i = 0; i < g.mat.length; i++) if (g.mat[i] && matById(g.mat[i]!)?.behaviour === "shatter") n++;
  return n;
}

function hitWindow(c: Prop<Refs>, hit: import("../hits.ts").Hit): boolean {
  if (hit.type === "wind") return false;
  const before = c.refs.now;
  c.damage(hit);
  c.refs.now = countGlass(c.refs.glass.grid);
  c.refs.glass.glintT = 0;
  return c.refs.now < before - 4;
}

function lightLevel(c: Prop<Refs>): void {
  const r = c.refs;
  if (c.state === "restoring" && (r.recount = (r.recount + 1) % 12) === 0) r.now = countGlass(r.glass.grid);
  // only the glass cells shine: light scales with what is left of it
  const k = Math.max(0, Math.min(1, (r.now / Math.max(1, r.total) - 0.1) / 0.9));
  for (const L of r.lights) L.level = k;
  for (const B of r.beams) B.level = k;
  r.pool.level = k;
}

// The market's upper walkway and its stairs (C1): open steel grating on
// channel beams, a railing behind with posts and a kick plate, stairs of
// grating treads on a diagonal stringer. The room's terrain carries the
// collision (one-way ledges and stair treads, WORLD-PLAN section 1 sizes:
// 0.15 H platforms, 0.2 x 0.3 H steps); these draw it and take the hits:
// steel dents and mends. Origins: walkway, its left end on the deck top;
// stair, its first tread's outer edge on the floor (as the room's treads()).

import "./materials.ts";
import { defineRecipe, type Prop } from "../../prop.ts";
import { puff } from "../../kit.ts";
import { hitCentre, type Hit } from "../../hits.ts";

export interface WalkwayParams {
  /** Deck length in H. */
  length: number;
  /** Railing height in H (0: none). */
  rail: number;
  /** Rail posts every this many H. */
  post: number;
}

export const gratingWalk = defineRecipe<WalkwayParams, null>({
  id: "gratingWalk",
  breakage: "heal",
  reason: "The market's upper street: a grating walkway over the stalls, so the hub has two levels and a view over the hollow; it rings under her feet and dents where she hits it.",
  defaults: { length: 6, rail: 0.9, post: 1.3 },
  cues: ["metal.hit"],
  standard: { h: 0.15, parts: ["deck"], note: "one-way platform thickness (the deck's top sits on the ledge)" },
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const L = u(p.length);
    const th = u(0.15);
    const beam = u(0.12);
    const deck = b.part("deck", { w: L, h: th + beam, pivot: [0, 0], at: [0, 0], layer: "mid", z: 4, collide: "none" });
    // the grating: a lit top bar, a band of open cells, a bottom bar
    deck.rect(0, 0, L, 3, { mat: "hollowSteel", profile: "bevel", r: 1, depth: 2, piece: "top" });
    deck.rect(0, 0, L, 1, { mat: "hollowSteel", mode: "paint", tone: 1 });
    deck.rect(0, 3, L, th - 5, { mat: "hollowSteel", profile: "flat", depth: 1, piece: "grid", tone: -1 });
    for (let x = 1; x < L - 2; x += 4) deck.rect(x, 4, 2, th - 7, { mat: "hollowSteel", mode: "erase" });
    deck.rect(0, th - 2, L, 2, { mat: "hollowSteel", profile: "cylH", piece: "bar" });
    // channel beams under it, with a web of holes
    deck.rect(0, th, L, beam, { mat: "hollowSteel", profile: "flat", depth: 2, piece: "beam", tone: -1 });
    deck.rect(0, th, L, 2, { mat: "hollowSteel", mode: "paint", tone: 0 });
    deck.rect(0, th + beam - 2, L, 2, { mat: "hollowSteel", mode: "paint", tone: 0 });
    for (let x = u(0.3); x < L - u(0.3); x += u(0.6)) deck.circle(x, th + beam / 2, 2.5, { mat: "hollowSteel", mode: "erase" });
    deck.rivets(
      Array.from({ length: Math.floor(L / u(0.3)) }, (_, k) => [Math.round(u(0.15) + k * u(0.3)), th + 1] as [number, number]),
      { mat: "hollowSteel", r: 1 },
    );
    deck.speckle({ amount: 0.08, seed: p.seed, tone: -1, mats: ["hollowSteel"] });
    if (p.rail > 0) {
      const rh = u(p.rail);
      const rail = b.part("rail", { w: L, h: rh, pivot: [0, rh], at: [0, 0], layer: "bg", z: 2, collide: "none" });
      rail.rect(0, 0, L, 3, { mat: "hollowSteel", profile: "cylH", piece: "top" });
      rail.rect(0, Math.round(rh * 0.5), L, 2, { mat: "hollowSteel", profile: "cylH", piece: "mid" });
      rail.rect(0, rh - u(0.08), L, u(0.08), { mat: "hollowSteel", profile: "flat", depth: 1, piece: "kick", tone: -1 });
      for (let x = 1; x < L; x += u(p.post)) rail.rect(Math.min(L - 3, x), 0, 3, rh, { mat: "hollowSteel", profile: "cylV", piece: "post" });
      rail.speckle({ amount: 0.06, seed: p.seed + 3, tone: -1, mats: ["hollowSteel"] });
    }
    return null;
  },
  initial: "idle",
  states: {
    idle: {
      hit: (c, h) => steelHit(c, h.hit),
    },
  },
  demo: {
    w: 8,
    at: 1.2,
    params: { length: 6 },
    script: [
      { label: "the walkway", wait: 0.6 },
      { label: "heavy: the grating dents", hit: "heavy", from: -1, wait: 1.5 },
      { label: "mends", wait: 7 },
    ],
  },
});

export interface StairParams {
  /** Rise in H (the room's treads(): 0.2 H steps). */
  rise: number;
  /** +1: climbs to the right; -1: climbs to the left. */
  dir: 1 | -1;
  /** Handrail height in H (0: none). */
  rail: number;
}

export const gratingStair = defineRecipe<StairParams, null>({
  id: "gratingStair",
  breakage: "heal",
  reason: "Stairs up to the market walkway at both ends: readable steps at the standard rise and tread (0.2 x 0.3 H), open grating so the stalls stay visible under them.",
  defaults: { rise: 6, dir: 1, rail: 0.9 },
  cues: ["metal.hit"],
  standard: { h: 6, parts: ["treads"], note: "rise of the market stair (0.2 x 0.3 H steps)" },
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const n = Math.max(1, Math.ceil(p.rise / 0.2 - 1e-6));
    const rise = u(p.rise) / n;
    const tread = u(0.3);
    const W = Math.round(tread * n) + 4;
    const Ht = u(p.rise) + u(p.rail) + 6;
    const s = p.dir;
    // drawn left to right in a grid whose bottom-left is the stair foot (dir +1) or foot at the right (dir -1)
    const X = (x: number): number => (s > 0 ? x : W - x);
    const base = Ht;
    // round 3: a real steel stair, not treads hung off a line. Two cut stringers (the far one a step
    // darker, standing a few px up and back so the treads read as seated BETWEEN them), each tread
    // resting on the near stringer's notch with an angle bracket and a bolt, the riser's shadow under
    // every nose, a base plate bolted to the deck at the foot and a cleat at the head
    const far = b.part("stringer-far", { w: W, h: Ht, pivot: [s > 0 ? 0 : W, base], at: [0, 0], layer: "bg", z: 1, collide: "none" });
    const st = b.part("treads", { w: W, h: Ht, pivot: [s > 0 ? 0 : W, base], at: [0, 0], layer: "mid", z: 4, collide: "none" });
    const run = Math.round(tread * n);
    const K = 13; // the stringer's depth under the line of inner corners
    const col = (a: number): number => (s > 0 ? a : W - 1 - a);
    const lineY = (a: number): number => base - (u(p.rise) * a) / run;
    const treadTop = (a: number): number => Math.round(base - rise * Math.min(n, Math.floor(a / tread) + 1));
    // the far stringer: the same sawtooth 5 px higher, dark, and the open risers' shadow on it
    for (let a = 0; a < run; a++) {
      const y0 = treadTop(a) + 1 - 5, y1 = Math.min(base - 1, Math.round(lineY(a) + K - 5));
      if (y1 > y0) far.rect(col(a), y0, 1, y1 - y0, { mat: "hollowSteel", profile: "flat", depth: 1, tone: -2, piece: "stringer" });
    }
    for (let i = 1; i < n; i++) {
      const xr = col(Math.round(tread * i));
      const yt = Math.round(base - rise * (i + 1)) + 6, yb = Math.round(base - rise * i);
      if (yb > yt) far.rect(Math.min(xr, xr - s), yt, 2, yb - yt, { mat: "soot", profile: "flat", depth: 1, piece: "stringer" });
    }
    for (let i = 1; i <= n; i++) {
      const top = Math.round(base - rise * i);
      const a = Math.round(tread * (i - 1)), e = Math.round(tread * i);
      const x0 = Math.min(X(a), X(e)), x1 = Math.max(X(a), X(e));
      st.rect(x0, top, x1 - x0, 3, { mat: "hollowSteel", profile: "bevel", r: 1, depth: 2, piece: "tread" });
      st.rect(x0, top, x1 - x0, 1, { mat: "hollowSteel", mode: "paint", tone: 1 });
      st.rect(x0 + 1, top + 3, x1 - x0 - 2, 3, { mat: "hollowSteel", profile: "flat", depth: 1, tone: -1, piece: "tread" });
      for (let x = x0 + 2; x < x1 - 2; x += 4) st.rect(x, top + 3, 2, 3, { mat: "hollowSteel", mode: "erase" });
    }
    // the near stringer: a channel cut to the steps, its top edge lit, its face a step darker toward
    // its foot, a shadow band under each tread's nose, an angle bracket and a bolt under each tread
    for (let a = 0; a < run; a++) {
      const top = treadTop(a) + 4;
      const bot = Math.min(base - 1, Math.round(lineY(a) + K));
      if (bot <= top) continue;
      const x = col(a);
      st.rect(x, top, 1, bot - top, {
        mat: "hollowSteel",
        profile: "flat",
        depth: 2,
        z: 1,
        piece: "stringer",
        // the tread's shadow under its nose, the face a step darker toward the bottom
        toneFn: (_x, y) => (y < top + 2 ? -2 : y > top + (bot - top) * 0.6 ? -1 : 0),
      });
      // the lower flange: a lit lip along the bottom edge
      st.rect(x, bot, 1, 1, { mat: "hollowSteel", profile: "flat", depth: 2, z: 1, piece: "stringer", tone: 1 });
    }
    for (let i = 1; i <= n; i++) {
      const top = Math.round(base - rise * i);
      const mid = Math.round(tread * (i - 0.5));
      const bx = col(mid) - 2;
      st.rect(bx, top + 4, 5, 2, { mat: "hollowSteel", profile: "bevel", r: 1, depth: 2, z: 3, piece: "bracket", tone: 1 });
      st.rect(s > 0 ? bx : bx + 3, top + 4, 2, 6, { mat: "hollowSteel", profile: "bevel", r: 1, depth: 2, z: 3, piece: "bracket" });
      st.rivets([[col(mid), top + 8]], { mat: "iron", r: 1, z: 4 });
    }
    // the base plate on the deck at the foot (bolted), and the cleat that hangs the head on the walkway
    {
      const pw = Math.round(tread * 1.5);
      const x0 = s > 0 ? 0 : W - pw;
      st.rect(x0, base - 3, pw, 3, { mat: "hollowSteel", profile: "bevel", r: 1, depth: 2, z: 2, piece: "plate" });
      st.rect(x0, base - 3, pw, 1, { mat: "hollowSteel", mode: "paint", tone: 1 });
      st.rivets([[x0 + 3, base - 2], [x0 + pw - 4, base - 2]], { mat: "iron", r: 1, z: 4 });
      const hx = col(run - 1), hy = Math.round(base - u(p.rise));
      st.rect(Math.min(hx, hx - s * 8), hy + 3, 9, 10, { mat: "hollowSteel", profile: "bevel", r: 1, depth: 2, z: 2, piece: "cleat", tone: -1 });
      st.rivets([[hx - s * 4, hy + 6], [hx - s * 4, hy + 10]], { mat: "iron", r: 1, z: 4 });
    }
    // handrail: a top rail and a knee rail on posts every three treads, each post standing on the near
    // stringer (its foot on the tread line), not hanging off the rail
    if (p.rail > 0) {
      const rh = u(p.rail);
      const rail = b.part("rail", { w: W, h: Ht, pivot: [s > 0 ? 0 : W, base], at: [0, 0], layer: "bg", z: 2, collide: "none" });
      const r0: [number, number] = [X(2), base - rh];
      const r1: [number, number] = [X(run - 2), Math.round(base - u(p.rise) - rh)];
      rail.stroke([r0[0], r0[1], r1[0], r1[1]], 3, { mat: "hollowSteel", profile: "cylV", piece: "rail" });
      rail.stroke([r0[0], r0[1] + Math.round(rh * 0.5), r1[0], r1[1] + Math.round(rh * 0.5)], 2, { mat: "hollowSteel", profile: "cylV", piece: "rail", tone: -1 });
      for (let i = 1; i <= n; i += 3) {
        const a = Math.round(tread * (i - 0.5));
        const x = col(a);
        const yTop = Math.round(lineY(a) - rh - rise * 0.5);
        const yFoot = treadTop(a);
        rail.rect(x - 1, yTop, 3, yFoot - yTop, { mat: "hollowSteel", profile: "cylV", piece: "post" });
      }
    }
    return null;
  },
  initial: "idle",
  states: {
    idle: {
      hit: (c, h) => steelHit(c, h.hit),
    },
  },
  demo: {
    w: 10,
    params: { rise: 3, dir: 1 },
    script: [
      { label: "the stair", wait: 0.6 },
      { label: "slash across it", hit: "slash", from: -0.5, wait: 1.2 },
    ],
  },
});

/** Steel: dents, a spark or two, a clang; never wind. */
export function steelHit(c: Prop, hit: Hit): void {
  if (hit.type === "wind") return;
  c.damage(hit);
  const [x, y] = hitCentre(hit.shape);
  if (hit.type !== "point") puff(c.world, "spark", x, y, hit.type === "slash" ? 3 : 6, [hit.dir[0], -1], { speed: 0.8, spread: 1.4 });
}

// The Hollow's destructible ground: the market's worn flagstones, the lift
// foot's cold tile, the archive's boards. Same behaviour as the kit's floor
// (craters with raised rims on Q, R and heavy hits, slash scars, real debris,
// healing from the bottom up), in the region's own materials and courses.
// The room's terrain carries the collision: the part is ground (craters, debris land on it)
// but not a collider, so the adapter never rescans its cells for a platform top.
// Origin: left end of the walking surface.

import "./materials.ts";
import { crater, scar } from "../../break.ts";
import type { Hit } from "../../hits.ts";
import { defineRecipe } from "../../prop.ts";
import { matId } from "../../kit.ts";

export interface HollowFloorParams {
  /** Length in px (world). */
  width: number;
  /** Depth below the surface, in H. */
  depth: number;
  kind: "flagstone" | "tile" | "boards";
  /** Contact shadows on the walking lip under what stands on it: [centre, width] in H from the origin. */
  shadows: [number, number][];
  /** Pools of light on the walking surface: [centre, radius, strength 0..1] in H from the origin. */
  pools: [number, number, number][];
  /** Iron straps down the ledge's face where its supports run (H from the origin). */
  ribs: number[];
  /** Drains in the ledge's face, weeping grime and a little moss (H from the origin). */
  drains: number[];
  /** Flagstone: dress the walking lip (chips, cracks, grates in the walk, rubble and moss over the edge,
   * damp and worn patches down the face) so its line is never ruler-straight. */
  dress: boolean;
  /** Grates let into the walking surface (H from the origin). */
  grates: number[];
  /** Washes of a light that does not warm the material (a cold tube): [centre, radius, strength] in H,
   * one or two tone steps lighter on the walk and a little down the face, dithered at each edge. */
  washes: [number, number, number][];
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bayer = (x: number, y: number): number => BAYER[(y & 3) * 4 + (x & 3)]! / 16;

function craterPoint(hit: Hit): [number, number] | null {
  const s = hit.shape;
  if (s.kind === "circle" || s.kind === "point") return [s.x, s.y];
  if (s.kind === "rect") return [s.x + s.w / 2, s.y + s.h];
  if (s.kind === "arc") return [s.x, s.y];
  if (s.kind === "line") return [s.x1, s.y1];
  return null;
}

export const hollowFloor = defineRecipe<HollowFloorParams, { head: number }>({
  id: "hollowFloor",
  breakage: "floor",
  reason: "The Hollow's ground (the market's worn flagstones, the lift foot's tile, the archive's boards) shows the weight of her hits and heals, so the rooms reset.",
  defaults: { width: 1280, depth: 1.2, kind: "flagstone", shadows: [], pools: [], ribs: [], drains: [], dress: false, grates: [], washes: [] },
  build(b, p) {
    const head = 10;
    const depth = b.u(p.depth);
    const W = Math.ceil(p.width);
    const f = b.part("floor", { w: W, h: head + depth, pivot: [0, head], at: [0, 0], layer: "mid", collide: "none", ground: true, z: -5 });
    if (p.kind === "tile") {
      f.bricks(0, head + 3, W, depth - 3, { bw: b.u(0.25), bh: b.u(0.25), mat: "hollowTile", mortar: "soot", seed: p.seed + 3, bevel: 1, jitter: 0, stagger: 0, tones: [0, -1, 0, -1, 0] });
      f.rect(0, head, W, 4, { mat: "hollowTile", profile: "bevel", r: 2, depth: 3, z: 2, piece: "lip" });
      f.rect(0, head, W, 1, { mat: "hollowTile", mode: "paint", tone: 1 });
      f.speckle({ amount: 0.06, seed: p.seed + 5, tone: -1 });
    } else if (p.kind === "boards") {
      f.bricks(0, head + 3, W, depth - 3, { bw: b.u(1.8), bh: b.u(0.12), mat: "woodDark", mortar: "soot", seed: p.seed + 3, bevel: 1, jitter: 0.5, tones: [0, 0, -1, 0] });
      f.rect(0, head, W, 4, { mat: "wood", profile: "bevel", r: 2, depth: 2, z: 2, piece: "lip" });
      f.rect(0, head, W, 1, { mat: "wood", mode: "paint", tone: 1 });
      f.grain({ dir: "h", seed: p.seed + 4, mats: ["woodDark", "wood"], stretch: 22 });
    } else {
      // worn flagstones: a top course of big slabs, smaller rubble courses below going dark
      const bh = b.u(0.26);
      f.bricks(0, head + 3, W, bh, { bw: b.u(0.9), bh, mat: "hollowStone", mortar: "mortar", seed: p.seed + 3, bevel: 2, jitter: 0.4, tones: [0, -1, 0, 0, 1, -1] });
      f.bricks(0, head + 3 + bh, W, depth - bh - 3, { bw: b.u(0.55), bh: b.u(0.2), mat: "hollowStoneDark", mortar: "soot", seed: p.seed + 9, bevel: 1, jitter: 0.45, tones: [0, -1, 0, 1] });
      f.rect(0, head, W, 4, { mat: "hollowStone", profile: "bevel", r: 2, depth: 3, z: 2, piece: "lip" });
      f.rect(0, head, W, 1, { mat: "hollowStone", mode: "paint", tone: 1 });
      f.speckle({ amount: 0.14, seed: p.seed + 5, tone: -1, scale: 2 });
      f.speckle({ amount: 0.03, seed: p.seed + 8, tone: 1 });
      for (let k = 0; k < Math.max(2, W / 200); k++) {
        const x = Math.floor(b.rand() * W);
        f.cracks(x, head + 4 + Math.floor(b.rand() * depth * 0.3), { n: 2, len: 6 + Math.floor(b.rand() * 12), seed: p.seed + k * 13, dir: Math.PI / 2 });
      }
    }
    f.wear({ amount: 0.1 + p.wear * 0.2, seed: p.seed + 4, region: { x0: 0, y0: head, x1: W - 1, y1: head + 1 } });
    const g = f.grid;
    const H = b.u(1);
    const at = (x: number, y: number): number => {
      const i = g.inner(x, y);
      return i >= 0 && g.mat[i] ? i : -1;
    };
    const shift = (i: number, k: number): void => {
      if (i >= 0) g.tone[i] = Math.max(-3, Math.min(3, g.tone[i]! + k));
    };
    // drains: a dark mouth with two bars in the face, grime and a little moss weeping down from it
    if (p.kind === "flagstone")
      for (const [n, dx] of p.drains.entries()) {
        const cx = Math.round(dx * H), y0 = head + 6;
        f.rect(cx - 7, y0, 14, 6, { mat: "soot", profile: "sunk", r: 2, z: 0, piece: "drain" });
        for (const bx of [-3, 2]) f.rect(cx + bx, y0, 2, 6, { mat: "iron", profile: "cylV", z: 1, piece: "drain" });
        f.rect(cx - 8, y0 - 1, 16, 1, { mat: "hollowStone", mode: "paint", tone: 1 });
        for (let y = y0 + 6; y < head + depth; y++) {
          const t = (y - y0 - 6) / Math.max(1, depth - 12);
          for (let x = cx - 6; x < cx + 6; x++) {
            const edge = Math.abs(x - cx) / 6;
            const r = ((x * 73856093) ^ (y * 19349663) ^ (n * 83492791)) >>> 0;
            if ((r % 100) / 100 > (1 - t * 0.8) * (1 - edge * 0.7)) continue;
            const i = at(x, y);
            if (i < 0) continue;
            if (t < 0.5 && (r >> 8) % 3 === 0) g.mat[i] = matId("hollowMoss");
            else shift(i, -1);
          }
        }
      }
    // round 3: the lip dressed. The face takes broad damp and worn patches (value that varies at the
    // scale of the slabs, not only per stone); the top course is chipped and cracked; iron grates are
    // let into the walk; rubble, grit and moss sit on the lip and creep over its edge
    if (p.kind === "flagstone" && p.dress) {
      const R = (k: number, q: number): number => (((k * 73856093) ^ (q * 19349663) ^ (p.seed * 83492791)) >>> 0) / 4294967296;
      // broad patches: soft blobs of damp (darker) and of wear by the walk (lighter), stepped and dithered
      for (let k = 0; k < W / 70; k++) {
        const cx = R(k, 1) * W, cy = head + 6 + R(k, 2) * depth * 0.55;
        const rx = 30 + R(k, 3) * 70, ry = 8 + R(k, 4) * 16;
        const damp = R(k, 5) < 0.6;
        for (let y = Math.floor(cy - ry); y <= cy + ry; y++)
          for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
            const d = Math.hypot((x - cx) / rx, (y - cy) / ry);
            if (d >= 1 || y < head + 3) continue;
            if (d > 0.7 && bayer(x, y) < (d - 0.7) / 0.3) continue;
            shift(at(x, y), damp ? -1 : 1);
          }
      }
      // chips out of the lip: the stone is gone (the silhouette of the walk line breaks), the notch's
      // floor catches the light, and the broken bits lie beside it as rubble
      const chips: number[] = [];
      for (let x = 6 + Math.floor(R(0, 9) * 30); x < W - 12; x += 30 + Math.floor(R(x, 10) * 70)) {
        const cw = 4 + Math.floor(R(x, 11) * 9), cd = 2 + Math.floor(R(x, 12) * 3);
        chips.push(x + cw / 2);
        for (let q = 0; q < cw; q++) {
          const dd = Math.max(1, Math.round(cd * Math.sin(((q + 0.5) / cw) * Math.PI) + (R(x + q, 13) < 0.3 ? 1 : 0)));
          f.rect(x + q, head, 1, dd, { mat: "hollowStone", mode: "erase" });
          shift(at(x + q, head + dd), 1);
          shift(at(x + q, head + dd + 1), -1);
        }
      }
      // cracks running down from some chips into the top course
      for (const [k, cx] of chips.entries()) if (R(k, 20) < 0.45) f.cracks(Math.round(cx), head + 3, { n: 1, len: 8 + Math.floor(R(k, 21) * 14), seed: p.seed + 40 + k, dir: Math.PI / 2, spread: 0.5, tone: -1 });
      // grates let into the walk: a dark slot along the lip with iron bars, a lit rim
      for (const dx of p.grates) {
        const cx = Math.round(dx * H);
        f.rect(cx - 12, head, 24, 4, { mat: "soot", profile: "sunk", r: 1, z: 0, piece: "grate" });
        for (let bx = -10; bx < 12; bx += 4) f.rect(cx + bx, head, 2, 4, { mat: "iron", profile: "cylV", z: 1, piece: "grate" });
        f.rect(cx - 13, head, 26, 1, { mat: "iron", mode: "over", tone: 1, profile: "flat", depth: 1, piece: "grate" });
        for (let x = cx - 13; x < cx + 13; x++) shift(at(x, head + 4), -2);
      }
      // rubble beside the chips (shards of the lip, lit on top), moss cushions over the edge where the
      // drains keep it damp and here and there along the walk, strands of it down the face
      for (const [k, cx] of chips.entries()) {
        const n = 1 + Math.floor(R(k, 30) * 3);
        for (let j = 0; j < n; j++) {
          const w = 3 + Math.floor(R(k * 7 + j, 31) * 5), hh = w > 5 ? 3 : 2;
          const x = Math.round(cx + (R(k * 7 + j, 32) - 0.5) * 26);
          f.rect(x, head - hh, w, hh, { mat: R(k * 7 + j, 33) < 0.6 ? "hollowStone" : "hollowStoneDark", profile: "bevel", r: 1, depth: 2, z: 1, piece: "rubble", toneFn: (_x, y) => (y === head - hh ? 1 : 0) });
        }
      }
      const mossAt = [...p.drains.map((dx) => dx * H), ...Array.from({ length: Math.floor(W / 160) }, (_, k) => R(k, 50) * W)];
      for (const [k, mx] of mossAt.entries()) {
        const w = 8 + Math.floor(R(k, 35) * 12);
        const x0 = Math.round(mx - w / 2);
        const tall = 2 + Math.floor(R(k, 36) * 3);
        for (let q = 0; q < w; q++) {
          const hgt = Math.max(1, Math.round(Math.sin(((q + 0.5) / w) * Math.PI) * tall + (R(x0 + q, 38) - 0.5) * 1.4));
          f.rect(x0 + q, head - hgt, 1, hgt + 2, { mat: "hollowMoss", profile: "flat", depth: 2, z: 2, piece: "moss", toneFn: (_x, y) => (y === head - hgt ? 1 : y > head ? -1 : 0) });
          const hang = Math.floor(R(x0 + q, 37) * 9);
          for (let y = head + 2; y < head + 2 + hang; y++) {
            const i = at(x0 + q, y);
            if (i >= 0 && bayer(x0 + q, y) < 0.8 - (y - head) / 14) g.mat[i] = matId("hollowMoss");
          }
        }
      }
    }
    // grime streaks down the face from the lip, where water runs off the street
    if (p.kind === "flagstone")
      for (let k = 0; k < W / 34; k++) {
        const x0 = Math.floor(b.rand() * W), len = Math.round(depth * (0.25 + b.rand() * 0.6));
        for (let y = head + 4; y < head + 4 + len; y++)
          for (let x = x0; x < x0 + 1 + (k % 3 === 0 ? 1 : 0); x++) if (bayer(x, y) < 0.75 - (y - head) / len / 2) shift(at(x, y), -1);
      }
    // the ground's face falls into shadow with depth (ordered dither, a step at a time), so the lit
    // walking line reads first and the face under it sits back, as in the refs; the last rows go
    // nearly to black so the ledge sinks into the girder under it, not a hard seam
    {
      const y0 = head + Math.round(depth * 0.25);
      for (let y = y0; y < head + depth; y++) {
        const t = (y - y0) / Math.max(1, head + depth - y0); // 0..1 down the face
        for (let x = 0; x < W; x++) {
          const i = at(x, y);
          if (i < 0) continue;
          const steps = t * 3;
          const k = Math.floor(steps) + (steps - Math.floor(steps) > bayer(x, y) ? 1 : 0);
          if (k > 0) g.tone[i] = Math.max(-3, g.tone[i]! - k);
        }
      }
    }
    // iron straps where the ledge's supports run: a riveted plate down the face, a rust streak beside it
    for (const dx of p.ribs) {
      const cx = Math.round(dx * H);
      if (cx < 4 || cx > W - 5) continue;
      f.rect(cx - 4, head + 4, 9, depth - 4, { mat: "hollowSteel", profile: "bevel", r: 1, depth: 2, z: 2, piece: "strap", toneFn: (_x, y) => (y > depth * 0.55 ? -1 : 0) });
      f.rivets(Array.from({ length: Math.floor((depth - 8) / 12) }, (_, k) => [cx, head + 9 + k * 12] as [number, number]), { mat: "iron", r: 1, z: 4 });
      for (let y = head + 6; y < head + depth * 0.7; y++) if (bayer(cx + 6, y) < 0.6) {
        const i = at(cx + 6, y);
        if (i >= 0) g.mat[i] = matId("rust");
      }
    }
    // pools of light on the walking surface: the stone goes warm and a step lighter toward the
    // light (dithered at each step's edge), strongest on the lip, a little down the face
    for (const [dx, rH, k] of p.pools) {
      const cx = dx * H, r = rH * H;
      for (let y = head; y < head + Math.round(depth * 0.45); y++)
        for (let x = Math.floor(cx - r); x <= cx + r; x++) {
          const i = at(x, y);
          if (i < 0) continue;
          const fall = 1 - Math.abs(x - cx) / r - ((y - head) / (depth * 0.45)) * 0.7;
          const v = fall * k;
          if (v <= 0) continue;
          if (v > 0.18 + bayer(x, y) * 0.25) {
            if (g.mat[i] === matId("hollowStone") || g.mat[i] === matId("hollowStoneDark")) g.mat[i] = matId("hollowStoneLit");
            else if (g.mat[i] === matId("hollowTile")) g.mat[i] = matId("hollowTileLit");
          }
          if (v > 0.55 + bayer(x, y) * 0.2) shift(i, 1);
        }
    }
    for (const [dx, rH, k] of p.washes) {
      const cx = dx * H, r = rH * H;
      for (let y = head; y < head + Math.round(depth * 0.4); y++)
        for (let x = Math.floor(cx - r); x <= cx + r; x++) {
          const v = (1 - Math.abs(x - cx) / r - ((y - head) / (depth * 0.4)) * 0.8) * k;
          if (v > 0.15 + bayer(x, y) * 0.25) shift(at(x, y), v > 0.5 + bayer(x, y) * 0.2 ? 2 : 1);
        }
    }
    // contact shadows on the lip under whatever stands on it: two dark rows, feathered at the ends
    for (const [dx, wH] of p.shadows) {
      const cx = dx * H, hw = (wH * H) / 2 + 2;
      for (let x = Math.floor(cx - hw); x <= cx + hw; x++) {
        const e = 1 - Math.abs(x - cx) / hw; // 0 at the ends
        for (let q = 0; q < 4; q++) {
          const k = q < 2 ? (e > 0.2 ? 2 : 1) : e > 0.35 && q === 2 ? 1 : 0;
          if (k && (e > 0.12 || bayer(x, q) < 0.5)) shift(at(x, head + q), -k);
        }
      }
    }
    return { head };
  },
  initial: "idle",
  states: {
    idle: {
      hit(c, h) {
        const part = c.part("floor");
        const hit = h.hit;
        if (c.keepsCells) return;
        if (hit.crater) {
          const at = craterPoint(hit);
          if (at) crater(c.world, part, at[0], at[1], hit.crater.rx, hit.crater.ry, hit.crater.rim, hit);
        }
        if (hit.scar) scar(c.world, part, hit);
      },
    },
  },
  demo: {
    w: 6,
    params: { width: 480, kind: "flagstone" },
    script: [
      { label: "flagstones", wait: 0.5 },
      { label: "slash: a scar", hit: "slash", from: -1.5, wait: 1 },
      { label: "Q: a crater and rubble", hit: "q", from: 0.6, wait: 2 },
      { label: "heals from the bottom up", wait: 9 },
    ],
  },
});

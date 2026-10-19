// Which plate tiles a camera draws, and which the opening's camera draws over its whole run. Pure (no GL), shared by
// the game (game.ts: planeQuads, the opening set) and the build's bake (plates/bake.ts), so both name the same tiles.

import { framingAt } from "../camera.ts";
import type { Collision } from "../collide.ts";
import { H, TILE } from "../config.ts";
import { BEATS, cameraAt, herXH } from "../opening/timeline.ts";
import { levelFor, planeLevels, planeXf, type CamState } from "../render/view.ts";
import { PLANES, PLANE_IDS, type PlaneId, type WorldDef } from "../world/types.ts";

/** The densities each plane's art exists at (one per authored zoom). */
export function planeLevelTable(): Map<PlaneId, number[]> {
  const m = new Map<PlaneId, number[]>();
  for (const id of PLANE_IDS) m.set(id, planeLevels(PLANES[id].rate));
  return m;
}

/**
 * The plate level a plane is drawn at for this camera. (Round 6/7: at the catch's 2x the sky's, far, mid and back
 * planes sit on the frame's 2 px cells, painted at half the density for it.)
 */
export function levelOfPlane(cam: CamState, id: PlaneId, levels: readonly number[]): number {
  const xf = planeXf(cam, PLANES[id].rate);
  return levelFor(levels, xf.g) / (cam.zoom >= 1.9 && (id === "sky" || id === "far" || id === "mid" || id === "back") ? 2 : 1);
}

/** The tiles of a plane at level lv covering frame rows [ya, yb). */
export function tileSpanOf(cam: CamState, id: PlaneId, lv: number, ya: number, yb: number): { level: number; tx0: number; tx1: number; ty0: number; ty1: number } {
  const xf = planeXf(cam, PLANES[id].rate);
  const k = xf.g / lv;
  const ax0 = (0 - xf.offX) / k, ax1 = (cam.W - xf.offX) / k;
  const ay0 = (ya - xf.offY) / k, ay1 = (yb - xf.offY) / k;
  return { level: lv, tx0: Math.floor(ax0 / TILE), tx1: Math.floor((ax1 - 1e-6) / TILE), ty0: Math.floor(ay0 / TILE), ty1: Math.floor((ay1 - 1e-6) / TILE) };
}

export interface OpeningTile {
  id: PlaneId;
  lv: number;
  tx: number;
  ty: number;
  /** The runs of opening time T it is on screen. */
  runs: [number, number][];
}

/**
 * Every tile the opening's camera draws, hands-free from the press to the hand-back, for a frame of W x Hf, with the
 * runs of T it is on screen (sampled every quarter second, plus the widest frame's first tick and the skip's landing).
 * `flags`: the visitor's progress flags (a fresh visit has none).
 */
export function openingTiles(world: WorldDef, collision: Collision, W: number, Hf: number, reduced: boolean, levels: Map<PlaneId, number[]>, flags: (f: string) => boolean = () => false): { span: Map<string, OpeningTile>; most: number } {
  const cam = BEATS.camera, ui = BEATS.ui;
  const span = new Map<string, OpeningTile>();
  let most = 0;
  const times: number[] = [];
  for (let T = 0; T <= ui.handBack + 1e-6; T += 0.25) times.push(T);
  times.push(cam.widest.from + 0.02, ui.skipTo);
  times.sort((a, b) => a - b);
  // the ground along her hands-free path, walked from the catch spot (the ground under x near where she is
  // then: the terrace is above the shore she starts from, so "the ground below her now" would be the wrong one)
  const x0 = BEATS.her.catchXH * H, step = H / 4;
  const spawn = world.spawns.find((sp) => sp.id === "catch")!;
  const prof: number[] = [];
  let gy = collision.groundBelow(x0, spawn.y - 2 * H)?.y ?? spawn.y;
  for (let x = x0; x <= (BEATS.her.stopXH + 6) * H; x += step) {
    gy = collision.groundBelow(x, gy - 2 * H)?.y ?? gy;
    prof.push(gy);
  }
  const groundAt = (x: number): number => prof[Math.max(0, Math.min(prof.length - 1, Math.round((x - x0) / step)))]!;
  const framing = (v: number, opening: boolean): ReturnType<typeof framingAt> =>
    framingAt(world.tracks, v, (fl) => (fl === "opening" ? opening : flags(fl)), groundAt(v));
  for (const T of times) {
    const x = herXH(T) * H;
    const shot = cameraAt(T, { x, W, H: Hf, world: (v) => framing(v, false), reduced });
    if (!shot) continue;
    const c: CamState = { cx: shot.cx, cy: groundAt(x), zoom: shot.zoom, anchor: shot.anchor, horizon: shot.horizon, W, H: Hf };
    let n = 0;
    for (const id of PLANE_IDS) {
      if (id === "near" && c.zoom > 1.6) continue;
      const sp = tileSpanOf(c, id, levelOfPlane(c, id, levels.get(id)!), 0, Hf);
      for (let ty = sp.ty0; ty <= sp.ty1; ty++) {
        for (let tx = sp.tx0; tx <= sp.tx1; tx++, n++) {
          const k = `${id}|${sp.level}|${tx}|${ty}`;
          const t = span.get(k);
          const run = t?.runs[t.runs.length - 1];
          if (run && T - run[1] <= 0.25 + 1e-6) run[1] = T;
          else if (t) t.runs.push([T, T]);
          else span.set(k, { id, lv: sp.level, tx, ty, runs: [[T, T]] });
        }
      }
    }
    most = Math.max(most, n);
  }
  return { span, most };
}

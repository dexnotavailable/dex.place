// A move's timing: feel.json's numbers, overridden by what its drawing says when it has one. Two sources, in order:
// - marks an anim.json carries (lanes/anim/SPRITE-CONTRACT.md, "Marks"): active drawings, root motion, cancel windows;
// - what tools/zhusha/derive.mjs read off the drawings themselves (derived.json, Dex 10-19: "look at the frames so it
//   can derive the hitbox movement"): which drawings are live for each hit, the hit boxes on each of them (they move
//   with the slash), and her planted foot's movement.
// feel.json keeps the feel: when the first hit lands (the windup is squeezed to it), the damage, weight and knockback,
// the chain's push (lunges forward, recoils back), the windows. With no drawing (the white box) the move plays exactly
// as feel.json says. After the last hit the clip winds down slower than it wound up (windDown, Dex 10-16): the drawing's
// clock runs at `wind.rate` from `wind.from`. Pure: the controller and the tests use it.

import { artMarks, drawingIndex, moveToClip, rootAt, timeline, type AnimDef, type ArtMarks } from "./contract.ts";
import type { DerivedSlot, Rect } from "./derive.ts";

export type Weight = "light" | "medium" | "heavy" | "q" | "ult";

export interface HitDef {
  at: number;
  len: number;
  box: [number, number, number, number];
  anchor?: "start";
  dmg: number;
  weight: Weight;
  kb: [number, number];
  fx: string;
  /** What it breaks beyond its own box (props.ts): Q / E destruction, pieces' force. */
  break?: BreakDef;
}

/** A hit's destruction (props.ts): how hard pieces fly, and for the Q / E a reach that obliterates. */
export interface BreakDef {
  /** Pieces' speed (1: a sword hit). */
  force?: number;
  /** Pieces' upward share (1: as a sword hit; low: flat, along a beam). */
  lift?: number;
  /** A box [forward, up, width, height] in world H (not x charScale: a world effect) from the hit's origin: everything
   *  breakable in it goes, whatever its HP. */
  reach?: [number, number, number, number];
  /** How fast the destruction travels out from the origin, H per tick (0: all at once). */
  wave?: number;
  /** The reach hurts too (the champion), not only breaks. */
  damages?: boolean;
}

export interface MoveDef {
  ticks: number;
  hits: HitDef[];
  lunge?: { at: number; dist: number; ticks: number }[];
  chainFrom?: number;
  cancelFrom: number;
  hitCancelFrom?: number;
  moveFrom: number;
  airGravity?: number;
  hop?: number;
  plunge?: number;
  /** m1_4's dive (feel.json m1_4 dive.about): it only hits on the ground; when she leaves it, plunges, and what shows. */
  dive?: DiveDef;
  warp?: number;
  warpTicks?: number;
  airHang?: number;
  recoil?: [number, number, number];
  cooldown?: number;
  /** Which of the drawing's derived hits the move uses, in order (default: all); e_tap fires on its second (Dex 10-20). */
  artHits?: number[];
  /** No lunge and no carried momentum: only her planted foot moves her (m1_4, Dex 10-19). */
  inPlace?: boolean;
  /** A lunge that locks onto a foe (m1_3, Dex 10-19): distances in her drawn heights; see feel.json lockAbout. */
  lock?: LockDef;
  /** The wind-down's playback rate (default feel.json windDown.rate) and the move tick it starts (default: the last hit's end). */
  windDown?: number;
  windFrom?: number;
}

/** The dive's drawings for one slot (feel.json m1_4 dive.slots): drawing indices, the blade's floor contact (art px). */
export interface DiveSlot {
  /** [first, last] drawings shown on the floor before she leaves it (spread over those ticks by their own lengths). */
  ground: [number, number];
  /** Started in the air: this drawing first (two ticks), then `air`. */
  airFrom: number;
  /** Held while she is in the air (the hop, the plunge). */
  air: number;
  /** Shown on the tick she touches down (the chop comes out the next). */
  land: number;
  /** Art px ahead of her pivot where the blade meets the floor in the hit drawing. */
  contact: number;
  /** Leaves the floor (false: the slot's drawings all stand on it: no hop, the same timing). */
  hop: boolean;
}

export interface DiveDef {
  hopAt: number;
  plungeAt: number;
  /** Ticks of diving without touching down before the move gives up (she falls on as herself). */
  hold: number;
  /** Art px from the impact slash's pivot down to its arc's lowest reach: a dive's impact plays that high over the floor. */
  impactDrop: number;
  slots: Record<string, DiveSlot>;
}

/**
 * The hop's take-off speed (px a tick, up), so she is `top` px up after `n` ticks of `g` (px / tick^2) gravity, the
 * controller's order (speed += g, then she moves).
 */
export function hopSpeed(top: number, n: number, g: number): number {
  const k = Math.max(1, n);
  return (top + (g * k * (k + 1)) / 2) / k;
}

/**
 * The dive's drawing before the chop (a clip tick, the drawing's middle): on the floor the `ground` drawings spread
 * over `groundTicks` (by their own lengths), in the air `airFrom` for two ticks when the move started there then `air`,
 * the touchdown tick `land`. `starts` / `ticks`: the clip's drawings (contract.ts timeline).
 */
export function diveClip(
  s: DiveSlot, starts: readonly number[], ticks: readonly number[],
  st: { phase: "ground" | "air" | "land"; t: number; groundTicks: number; air: number; fromAir: boolean },
): number {
  const mid = (i: number): number => (starts[i] ?? 0) + (ticks[i] ?? 1) / 2;
  if (st.phase === "land") return mid(s.land);
  if (st.phase === "air") return mid(st.fromAir && st.air < 2 ? s.airFrom : s.air);
  const c0 = starts[s.ground[0]] ?? 0, c1 = (starts[s.ground[1]] ?? 0) + (ticks[s.ground[1]] ?? 1);
  const u = Math.min(1, Math.max(0, st.t / Math.max(1, st.groundTicks)));
  // never past the last ground drawing (u < 1 inside its ticks)
  return Math.min(c1 - 0.01, c0 + u * (c1 - c0));
}

/** m1_3's lunge (feel.json lockAbout): from `at` over `ticks`; dist with no foe, else up to the foe's edge less `strike`. */
export interface LockDef {
  at: number;
  ticks: number;
  dist: number;
  maxDist: number;
  strike: number;
  range: number;
  behind: number;
}

/** The lunge's ease-out: the share of its distance covered at u in [0, 1] (fast off the mark, settling). */
export function lockEase(u: number): number {
  const k = Math.min(1, Math.max(0, u));
  return 1 - (1 - k) * (1 - k);
}

/**
 * Where a lock-on lunge from x0 facing `dir` ends, given her foes' boxes (world px) and her drawn height K: the nearest
 * foe ahead within range (or behind within `behind`: she turns), stopped `strike` short of its near edge (never past
 * maxDist, never backwards into it); with none, dist ahead. Returns the travel (px along `dir`), the direction and the
 * foe it locked (index into foes, -1: none).
 */
export function lockTarget(
  x0: number, y0: number, dir: 1 | -1, foes: readonly { x: number; y: number; w: number; h: number }[], L: LockDef, K: number,
): { travel: number; dir: 1 | -1; foe: number } {
  let best: { d: number; dir: 1 | -1; i: number } | null = null;
  foes.forEach((f, i) => {
    // level with her: the foe's box spans her body's band
    if (f.y > y0 + 0.2 * K || f.y + f.h < y0 - 1.5 * K) return;
    for (const s of [dir, -dir as 1 | -1]) {
      const near = s > 0 ? f.x - x0 : x0 - (f.x + f.w);
      const reach = s === dir ? L.range * K : L.behind * K;
      // overlapping her already (near < 0) counts as right in front
      if (near > reach || near + f.w < 0) continue;
      const d = Math.max(0, near) + (s === dir ? 0 : 0.5 * K);
      if (!best || d < best.d) best = { d, dir: s, i };
    }
  });
  if (!best) return { travel: L.dist * K, dir, foe: -1 };
  const b = best as { d: number; dir: 1 | -1; i: number };
  const f = foes[b.i]!;
  const near = b.dir > 0 ? f.x - x0 : x0 - (f.x + f.w);
  return { travel: Math.min(L.maxDist * K, Math.max(0, near - L.strike * K)), dir: b.dir, foe: b.i };
}

/** The drawing's clock after the last hit runs slower: move tick t -> the anim's tick. */
export function windClock(t: number, wind: { from: number; rate: number }): number {
  return t <= wind.from ? t : wind.from + (t - wind.from) * wind.rate;
}

export interface ResolvedMove extends MoveDef {
  /** World px forward to move on move tick t (index t; from the drawing's root motion), or null: feel's lunges. */
  root: number[] | null;
  /** The clip's tick that shows on the move's first hit tick (null: the clip plays on the move's clock). */
  clipHitAt: number | null;
  /** Per move tick (0..ticks): the hit boxes of the drawing showing then (art px from the pivot, facing right), null: feel.json's box. */
  rects: (Rect[] | null)[] | null;
  /** The wind-down: from this move tick the drawing plays at `rate`. */
  wind: { from: number; rate: number };
  /** Which numbers came from the drawing (marks) or were derived from its pixels. */
  fromArt: { hits: boolean; root: boolean; cancel: boolean; derived: boolean };
  /** Whose root motion: an author's marks (they own her travel: no lunges on top), or her planted foot's (derived). */
  rootFrom: "marks" | "derived" | null;
}

/** Clip tick back to the move's clock (the inverse of moveToClip). */
export function clipToMove(c: number, moveHitAt: number | null, clipHitAt: number | null): number {
  if (moveHitAt === null || clipHitAt === null || moveHitAt <= 0 || clipHitAt <= 0) return c;
  if (c <= clipHitAt) return (c / clipHitAt) * moveHitAt;
  return moveHitAt + (c - clipHitAt);
}

/**
 * feel.json's move with its drawing applied: its marks first, then what derive.ts read off its pixels (`derived`, for this
 * slot; ignored when its drawings' ticks differ from the clip's). `art` is the slot's anim.json (null: the white box);
 * artPx = world px per art px at her drawn height (units.ts artPx); windRate = feel.json's windDown.rate.
 */
export function resolveMove(
  feel: MoveDef, art: Pick<AnimDef, "frames" | "hits" | "segments"> | null, artPx: number,
  opts: { derived?: DerivedSlot | null; windRate?: number } = {},
): ResolvedMove {
  const out: ResolvedMove = {
    ...feel, hits: feel.hits.map((h) => ({ ...h })), root: null, rootFrom: null, clipHitAt: null, rects: null,
    wind: { from: 0, rate: 1 }, fromArt: { hits: false, root: false, cancel: false, derived: false },
  };
  const d = opts.derived;
  const der = art && d && d.ticks.length === art.frames.length && d.ticks.every((k, i) => k === art.frames[i]!.ticks) ? d : null;
  const m: ArtMarks | null = art ? artMarks(art) : null;
  // the hits: live while the drawing says (its params from feel.json, hit by hit; extra runs reuse the last)
  const feelHit = (i: number): HitDef => ({ ...feel.hits[Math.min(i, feel.hits.length - 1)]! });
  if (m?.active && m.active.length && feel.hits.length) {
    out.hits = m.active.map((w, i) => ({ ...feelHit(i), at: Math.max(1, Math.round(w.at)), len: Math.max(1, Math.round(w.len)) }));
    out.fromArt.hits = true;
  } else if (der && (feel.artHits ? feel.artHits.some((i) => der.hits[i]) : der.hits.length) && feel.hits.length) {
    // derived: feel.json's first hit tick is kept (the windup squeezed to it), the drawing times the rest 1:1
    const dh = feel.artHits ? feel.artHits.map((i) => der.hits[i]).filter((h): h is DerivedSlot["hits"][number] => !!h) : der.hits;
    const mh = feel.hits[0]!.at, ch = dh[0]!.at;
    out.hits = dh.map((w, i) => ({ ...feelHit(i), at: i === 0 ? mh : Math.max(1, Math.round(clipToMove(w.at, mh, ch))), len: Math.max(1, w.len) }));
    out.clipHitAt = ch;
    out.fromArt.derived = true;
  }
  if (out.fromArt.hits || out.fromArt.derived) {
    const last = out.hits[out.hits.length - 1]!;
    out.ticks = Math.max(feel.ticks, last.at + last.len + 1);
  }
  // the clip's clock: with art hits the move IS the clip's timeline; else the clip is fitted to the move's first hit
  const moveHit = out.hits[0]?.at ?? null;
  const clipHit = out.fromArt.hits ? moveHit : out.fromArt.derived ? out.clipHitAt : (m?.hitTicks[0] ?? null);
  out.clipHitAt = clipHit;
  // the wind-down: after the last hit (or feel's windFrom) the drawing plays slower
  const lastHit = out.hits[out.hits.length - 1];
  out.wind = { from: feel.windFrom ?? (lastHit ? lastHit.at + lastHit.len : 0), rate: feel.windDown ?? opts.windRate ?? 1 };
  const clipAt = (t: number): number => moveToClip(windClock(t, out.wind), moveHit, clipHit);
  if (m?.cancel) {
    const toMove = (c: number | undefined): number | undefined => (c === undefined ? undefined : Math.max(1, Math.round(clipToMove(c, moveHit, clipHit))));
    const chain = toMove(m.cancel.chain), cancel = toMove(m.cancel.cancel), hit = toMove(m.cancel.hit), move = toMove(m.cancel.move);
    if (chain !== undefined) out.chainFrom = chain;
    if (cancel !== undefined) out.cancelFrom = cancel;
    if (hit !== undefined) out.hitCancelFrom = hit;
    if (move !== undefined) out.moveFrom = move;
    out.fromArt.cancel = true;
  }
  // (Dex 10-21, the ult form's chain: its drawings are "cut off") the next M1, or walking off, never skips the move's
  // own hits: where the drawing times a hit at or past feel.json's window (the uf_m1 drawings spread theirs over their
  // swirls; the normal chain's hits all land before its windows, so it is unchanged) and no mark sets the window, the
  // chain and the walk-out wait for the last hit's window to close. Dash / jump / skill cancels stay as they are.
  if ((out.fromArt.hits || out.fromArt.derived) && lastHit) {
    const done = lastHit.at + lastHit.len, skips = (w: number): boolean => out.hits.some((h) => h.at >= w);
    if (out.chainFrom !== undefined && m?.cancel?.chain === undefined && skips(out.chainFrom)) out.chainFrom = Math.max(out.chainFrom, done);
    if (m?.cancel?.move === undefined && skips(out.moveFrom)) out.moveFrom = Math.max(out.moveFrom, done);
  }
  // root motion: the marks' (authored), else her planted foot's (derived)
  let cum: number[] | null = m?.root ?? null;
  if (!cum && der) {
    cum = [0];
    for (const f of der.frames) cum.push(cum[cum.length - 1]! + f.root);
  }
  if (art && cum) {
    const n = out.ticks + 1;
    const step: number[] = [0];
    for (let t = 1; t < n; t++) step.push((rootAt(art.frames, cum, clipAt(t)) - rootAt(art.frames, cum, clipAt(t - 1))) * artPx);
    out.root = step;
    out.fromArt.root = true;
    out.rootFrom = m?.root ? "marks" : "derived";
  }
  // the derived boxes, tick by tick: inside a hit's window, the boxes of the drawing showing then
  if (art && der && out.fromArt.derived) {
    const { starts, total } = timeline(art.frames);
    const rects: (Rect[] | null)[] = [];
    for (let t = 0; t <= out.ticks; t++) {
      const live = out.hits.some((h) => t >= h.at && t < h.at + h.len);
      rects.push(live ? der.frames[drawingIndex(starts, total, clipAt(t), false)]!.rects : null);
    }
    out.rects = rects;
  }
  return out;
}

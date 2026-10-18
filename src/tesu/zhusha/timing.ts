// A move's timing: feel.json's numbers, overridden by the marks its drawing carries when there are any
// (lanes/anim/SPRITE-CONTRACT.md, "Marks"): active drawings set when the hits are live, root motion moves her
// as her legs do, cancel marks open the chain / cancel / move windows. With no marks (or no drawing: the white
// box) the move plays exactly as feel.json says. Pure: the controller and the tests use it.

import { artMarks, moveToClip, rootAt, type AnimDef, type ArtMarks } from "./contract.ts";

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
  warp?: number;
  warpTicks?: number;
  airHang?: number;
  recoil?: [number, number, number];
  cooldown?: number;
}

export interface ResolvedMove extends MoveDef {
  /** World px forward to move on move tick t (index t; from the drawing's root motion), or null: feel's lunges. */
  root: number[] | null;
  /** The clip's tick that shows on the move's first hit tick (null: the clip plays on the move's clock). */
  clipHitAt: number | null;
  /** Which numbers came from the drawing. */
  fromArt: { hits: boolean; root: boolean; cancel: boolean };
}

/** Clip tick back to the move's clock (the inverse of moveToClip). */
export function clipToMove(c: number, moveHitAt: number | null, clipHitAt: number | null): number {
  if (moveHitAt === null || clipHitAt === null || moveHitAt <= 0 || clipHitAt <= 0) return c;
  if (c <= clipHitAt) return (c / clipHitAt) * moveHitAt;
  return moveHitAt + (c - clipHitAt);
}

/**
 * feel.json's move with its drawing's marks applied. `art` is the slot's anim.json (null: the white box);
 * artPx = world px per art px at her drawn height (units.ts artPx).
 */
export function resolveMove(feel: MoveDef, art: Pick<AnimDef, "frames" | "hits" | "segments"> | null, artPx: number): ResolvedMove {
  const out: ResolvedMove = { ...feel, hits: feel.hits.map((h) => ({ ...h })), root: null, clipHitAt: null, fromArt: { hits: false, root: false, cancel: false } };
  if (!art) return out;
  const m: ArtMarks = artMarks(art);
  // the hits: live while the drawing says (its params from feel.json, hit by hit; extra runs reuse the last)
  if (m.active && m.active.length && feel.hits.length) {
    out.hits = m.active.map((w, i) => ({ ...feel.hits[Math.min(i, feel.hits.length - 1)]!, at: Math.max(1, Math.round(w.at)), len: Math.max(1, Math.round(w.len)) }));
    out.fromArt.hits = true;
    const last = out.hits[out.hits.length - 1]!;
    out.ticks = Math.max(feel.ticks, last.at + last.len + 1);
  }
  // the clip's clock: with art hits the move IS the clip's timeline; else the clip is fitted to feel's first hit
  const moveHit = out.hits[0]?.at ?? null;
  const clipHit = out.fromArt.hits ? moveHit : (m.hitTicks[0] ?? null);
  out.clipHitAt = clipHit;
  if (m.cancel) {
    const toMove = (c: number | undefined): number | undefined => (c === undefined ? undefined : Math.max(1, Math.round(clipToMove(c, moveHit, clipHit))));
    const chain = toMove(m.cancel.chain), cancel = toMove(m.cancel.cancel), hit = toMove(m.cancel.hit), move = toMove(m.cancel.move);
    if (chain !== undefined) out.chainFrom = chain;
    if (cancel !== undefined) out.cancelFrom = cancel;
    if (hit !== undefined) out.hitCancelFrom = hit;
    if (move !== undefined) out.moveFrom = move;
    out.fromArt.cancel = true;
  }
  if (m.root) {
    const cum = m.root;
    const n = out.ticks + 1;
    const step: number[] = [0];
    for (let t = 1; t < n; t++) {
      const c0 = moveToClip(t - 1, moveHit, clipHit), c1 = moveToClip(t, moveHit, clipHit);
      step.push((rootAt(art.frames, cum, c1) - rootAt(art.frames, cum, c0)) * artPx);
    }
    out.root = step;
    out.fromArt.root = true;
  }
  return out;
}

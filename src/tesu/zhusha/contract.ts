// Zhusha's sprite contract (lanes/anim/SPRITE-CONTRACT.md), the parts with no browser in them:
// what an anim.json must say, how long each drawing holds, and the marks a drawing can carry
// (apex, active, root motion, cancel windows) turned into clip ticks. The loader (anims.ts), the
// controller (timing.ts), the slot-in tool (tools/zhusha/slot-in.mjs) and the tests use these.
//
// One size (Dex 10-18): every character is 128 px art, skull to sole. The game draws it with
// nearest-neighbour scaling at her drawn height (feel.json charScale); there is no second set.
//
// Only finished pixel art ships: an anim.json whose stage is not "pixel", that still carries a
// placeholder's background key, or whose figure is not 128 px is refused here, so an illustrated
// placeholder or a raw render can never reach the public build through this folder.

/** Every character's art height, skull to sole, art px (Dex 10-18: "let's roll with 128"). */
export const FIGURE_H = 128;
/** How far a drawing's measured figure (`fig`) may be off FIGURE_H, art px. */
export const FIG_TOL = 2;

/** What a drawing can be cancelled into from this drawing on (to the end of the move). */
export const CANCELS = ["chain", "cancel", "hit", "move"] as const;
export type Cancel = (typeof CANCELS)[number];

export interface AnimFrame {
  file: string;
  ticks: number;
  /** Her measured height skull to sole in this drawing (the kit's pose model), art px: 128 when sized right. */
  fig?: number;
  /** The apex of the movement (jump_arc: the top of the rise). */
  apex?: boolean;
  /** Damage is live during this drawing; a run of equal values is one hit (numbers split hits that touch). */
  active?: boolean | number;
  /** Forward movement from the legs during this drawing, art px (negative: backward). */
  root?: number;
  /** Windows that open on this drawing and stay open to the end of the move. */
  cancel?: Cancel[];
}

export interface IdleVariant {
  /** The base loop: drawings base[0]..base[1], played forward and back. */
  base: [number, number];
  /** After this many base loops (picked at random in [min, max]) one full play-through of the take. */
  every: [number, number];
}

export interface AnimDef {
  id: string;
  stage: "pixel";
  frames: AnimFrame[];
  loop?: boolean;
  /** The pixel in the frame where her soles meet the ground, hips centred above it. */
  pivot: [number, number];
  /** Her height skull to sole in frame px: FIGURE_H for every drawing. */
  figure_h: number;
  /** Frame indices where a hit lands (the retime lane's marks; `active` supersedes when present). */
  hits?: number[];
  /** jump_arc: [apex, contact] as frame indices (a drawing's `apex` mark supersedes the first). */
  segments?: [number, number];
  /** idle / uf_idle: the base loop and how often the whole take plays through. */
  idle_variant?: IdleVariant;
  source?: string;
  notes?: string;
}

export class AnimError extends Error {}

const FILE = /^f\d{3}\.png$/;
const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);

/**
 * Checks an anim.json against the contract; throws AnimError naming every problem. A drop stamped "local"
 * (tools/zhusha/slot-in.mjs --local: a look on the dev server) passes only with allowLocal (the dev server's
 * loader), so it can never pass the tests, the build or a production load.
 */
export function validateAnim(json: unknown, slot: string, opts: { allowLocal?: boolean } = {}): AnimDef {
  const bad: string[] = [];
  const o = json as Record<string, unknown>;
  if (!o || typeof o !== "object") throw new AnimError(`${slot}: anim.json is not an object`);
  if (o.id !== slot) bad.push(`id "${String(o.id)}" is not the folder's slot "${slot}"`);
  if (o.stage !== "pixel") bad.push(`stage "${String(o.stage)}": only finished pixel art ("pixel") ships`);
  if ("key" in o) bad.push(`has a background "key": placeholders never ship`);
  if ("local" in o && !opts.allowLocal) bad.push(`a local-only drop (slot-in --local): never ships; take it out with slot-in --remove`);
  const frames = o.frames;
  if (!Array.isArray(frames) || frames.length === 0) bad.push("no frames");
  else {
    frames.forEach((f: unknown, i: number) => {
      const fr = f as Record<string, unknown>;
      if (!fr || typeof fr !== "object") { bad.push(`frame ${i}: not an object`); return; }
      if (typeof fr.file !== "string" || !FILE.test(fr.file)) bad.push(`frame ${i}: file must be fNNN.png`);
      if (!isInt(fr.ticks) || fr.ticks < 1) bad.push(`frame ${i}: ticks must be a whole number >= 1`);
      if (fr.fig !== undefined && (typeof fr.fig !== "number" || Math.abs(fr.fig - FIGURE_H) > FIG_TOL)) bad.push(`frame ${i}: figure ${String(fr.fig)} px, not ${FIGURE_H}`);
      if (fr.apex !== undefined && typeof fr.apex !== "boolean") bad.push(`frame ${i}: apex must be true or false`);
      if (fr.active !== undefined && typeof fr.active !== "boolean" && !(isInt(fr.active) && fr.active >= 0)) bad.push(`frame ${i}: active must be true, false or a hit number`);
      if (fr.root !== undefined && (typeof fr.root !== "number" || !Number.isFinite(fr.root) || Math.abs(fr.root) > FIGURE_H)) bad.push(`frame ${i}: root must be art px (|root| <= ${FIGURE_H})`);
      if (fr.cancel !== undefined && (!Array.isArray(fr.cancel) || !fr.cancel.every((c) => (CANCELS as readonly string[]).includes(c as string)))) bad.push(`frame ${i}: cancel must list ${CANCELS.join(" / ")}`);
    });
  }
  const pv = o.pivot;
  if (!Array.isArray(pv) || pv.length !== 2 || !pv.every((v) => typeof v === "number" && Number.isFinite(v))) bad.push("pivot must be [x, y]");
  if (o.figure_h !== FIGURE_H) bad.push(`figure_h ${String(o.figure_h)}: every character is ${FIGURE_H} px skull to sole`);
  const n = Array.isArray(frames) ? frames.length : 0;
  if (o.hits !== undefined && (!Array.isArray(o.hits) || !o.hits.every((h) => isInt(h) && h >= 0 && h < n))) bad.push("hits must be frame indices");
  if (o.segments !== undefined && (!Array.isArray(o.segments) || o.segments.length !== 2 || !o.segments.every((h) => isInt(h) && h >= 0 && h < n))) bad.push("segments must be [apex, contact] frame indices");
  if (o.loop !== undefined && typeof o.loop !== "boolean") bad.push("loop must be true or false");
  if (o.idle_variant !== undefined) {
    const v = o.idle_variant as Record<string, unknown> | null;
    const b = v?.base, e = v?.every;
    if (!Array.isArray(b) || b.length !== 2 || !isInt(b[0]) || !isInt(b[1]) || b[0] < 0 || b[1] <= b[0] || b[1] >= n) bad.push("idle_variant.base must be [first, last] drawings, first < last < the frame count");
    if (!Array.isArray(e) || e.length !== 2 || !isInt(e[0]) || !isInt(e[1]) || e[0] < 1 || e[1] < e[0] || e[1] > 99) bad.push("idle_variant.every must be [min, max] base loops, 1 <= min <= max <= 99");
  }
  if (bad.length) throw new AnimError(`${slot}: ${bad.join("; ")}`);
  return o as unknown as AnimDef;
}

/** Each drawing's first tick, and the clip's length in ticks. */
export function timeline(frames: readonly { ticks: number }[]): { starts: number[]; total: number } {
  const starts: number[] = [];
  let t = 0;
  for (const f of frames) {
    starts.push(t);
    t += f.ticks;
  }
  return { starts, total: t };
}

/** The drawing showing at tick t (a loop wraps; otherwise it holds the first / last drawing). */
export function drawingIndex(starts: readonly number[], total: number, t: number, loop: boolean): number {
  if (!starts.length) return 0;
  const u = loop ? ((t % total) + total) % total : Math.min(Math.max(t, 0), total - 1e-6);
  let lo = 0, hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid]! <= u) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/**
 * The move's own clock (ticks since it started) on the clip's clock, so the clip's first marked
 * hit drawing shows on the move's first hit tick: before it the clip is stretched or squeezed to
 * land there, after it the clip plays at its own speed.
 */
export function moveToClip(t: number, moveHitAt: number | null, clipHitAt: number | null): number {
  if (moveHitAt === null || clipHitAt === null || moveHitAt <= 0) return t;
  if (t <= moveHitAt) return (t / moveHitAt) * clipHitAt;
  return clipHitAt + (t - moveHitAt);
}

/**
 * (cutoffs r5, the audit's "skipped drawings": the squeeze never showed a 1-tick windup drawing, so skill_q's beam
 * smear f004, the ult chain's smears uf_m1_1 f004 / uf_m1_2 f004 and uf_skill_q f001 / f004 were lost) The clip tick to
 * draw on move tick t while the windup is squeezed onto the hit (moveHitAt < clipHitAt): every windup drawing gets a
 * move tick of its own, the spare ticks shared by the drawings' own lengths; with fewer ticks than drawings each tick
 * shows where the windup has got to by the tick's end (the smear into the hit is never the one dropped). The hit
 * drawing still shows on moveHitAt, after it the clip runs 1:1 (moveToClip); a stretched windup is moveToClip's.
 */
export function windupClip(t: number, moveHitAt: number | null, clipHitAt: number | null, starts: readonly number[]): number {
  const c = moveToClip(t, moveHitAt, clipHitAt);
  if (moveHitAt === null || clipHitAt === null || moveHitAt <= 0 || t >= moveHitAt || moveHitAt >= clipHitAt) return c;
  // the windup's drawings: those that start before the hit drawing
  let n = 0;
  while (n < starts.length && starts[n]! < clipHitAt) n++;
  if (n <= 1) return c;
  const m = moveHitAt, k = Math.max(0, Math.min(m - 1, Math.floor(t)));
  const len = (i: number): number => (i + 1 < n ? starts[i + 1]! : clipHitAt) - starts[i]!;
  let pick: number;
  if (m >= n) {
    // a tick each, the spare ones by length (largest remainder, earlier drawing on a tie)
    const share = Array.from({ length: n }, (_, i) => ((m - n) * len(i)) / clipHitAt);
    const got = share.map((s) => 1 + Math.floor(s));
    let left = m - got.reduce((a, b) => a + b, 0);
    const order = share.map((s, i) => [s - Math.floor(s), i] as const).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
    for (let j = 0; left > 0; j = (j + 1) % n, left--) got[order[j]![1]]!++;
    pick = 0;
    for (let acc = got[0]!; acc <= k; acc += got[++pick]!);
  } else {
    // fewer ticks than drawings: each tick shows where the windup has got to by its end (the last tick the smear into
    // the hit, the first one already in from the rest pose she stood in), by the drawings' own lengths
    const u = ((k + 1) * clipHitAt) / m - 1e-6;
    pick = 0;
    while (pick + 1 < n && starts[pick + 1]! <= u) pick++;
  }
  return starts[pick]!;
}

/** A drawing's marks as clip ticks (null where the clip carries none: the controller keeps feel.json's numbers). */
export interface ArtMarks {
  total: number;
  /** The apex drawing's first tick. */
  apex: number | null;
  /** Hit windows from runs of active drawings: first tick and length. */
  active: { at: number; len: number }[] | null;
  /** Cumulative forward art px at each drawing boundary (length frames + 1), spread evenly over each drawing's ticks. */
  root: number[] | null;
  /** First tick of the first drawing opening each window. */
  cancel: Partial<Record<Cancel, number>> | null;
  /** Ticks where the marked `hits` drawings start (the retime lane's marks). */
  hitTicks: number[];
}

export function artMarks(def: Pick<AnimDef, "frames" | "hits" | "segments">): ArtMarks {
  const { starts, total } = timeline(def.frames);
  const fr = def.frames;
  const apexI = fr.findIndex((f) => f.apex === true);
  const apex = apexI >= 0 ? starts[apexI]! : def.segments ? starts[def.segments[0]]! : null;
  let active: { at: number; len: number }[] | null = null;
  if (fr.some((f) => f.active !== undefined && f.active !== false)) {
    active = [];
    let prev: boolean | number | undefined = undefined;
    fr.forEach((f, i) => {
      const v = f.active === false ? undefined : f.active;
      if (v === undefined) { prev = undefined; return; }
      if (prev !== undefined && prev === v) active![active!.length - 1]!.len += f.ticks;
      else active!.push({ at: starts[i]!, len: f.ticks });
      prev = v;
    });
  }
  let root: number[] | null = null;
  if (fr.some((f) => f.root !== undefined)) {
    root = [0];
    for (const f of fr) root.push(root[root.length - 1]! + (f.root ?? 0));
  }
  let cancel: Partial<Record<Cancel, number>> | null = null;
  fr.forEach((f, i) => {
    for (const c of f.cancel ?? []) {
      cancel ??= {};
      if (cancel[c] === undefined) cancel[c] = starts[i]!;
    }
  });
  const hitTicks = (def.hits ?? []).map((h) => starts[h]!).sort((a, b) => a - b);
  return { total, apex, active, root, cancel, hitTicks };
}

/** Forward art px covered by clip tick c (root motion spread evenly over each drawing's ticks). */
export function rootAt(frames: readonly { ticks: number }[], cum: readonly number[], c: number): number {
  if (c <= 0) return 0;
  let t = 0;
  for (let i = 0; i < frames.length; i++) {
    const k = frames[i]!.ticks;
    if (c < t + k) return cum[i]! + ((cum[i + 1]! - cum[i]!) * (c - t)) / k;
    t += k;
  }
  return cum[cum.length - 1]!;
}

/** The clip tick at which root motion has covered d art px (a looping cycle: d is taken modulo its stride). */
export function clipAtRoot(frames: readonly { ticks: number }[], cum: readonly number[], d: number): number {
  const stride = cum[cum.length - 1]!;
  if (!(Math.abs(stride) > 1e-9)) return 0;
  const want = ((d % stride) + stride) % stride;
  let t = 0;
  for (let i = 0; i < frames.length; i++) {
    const k = frames[i]!.ticks, a = cum[i]!, b = cum[i + 1]!;
    if ((want >= a && want < b) || (want <= a && want > b)) return t + (k * (want - a)) / (b - a);
    t += k;
  }
  return t;
}

/** The opaque box of an RGBA frame (alpha >= 128), or null when it is empty. */
export function opaqueBox(d: Uint8ClampedArray | Uint8Array, w: number, h: number): [number, number, number, number] | null {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3]! < 128) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return x1 < 0 ? null : [x0, y0, x1 + 1, y1 + 1];
}

/** Her head in a frame: the top of her silhouette near the pivot's column (frame px), for the hat's talisman. */
export function headOf(d: Uint8ClampedArray | Uint8Array, w: number, h: number, pivotX: number, figureH: number): [number, number] | null {
  const band = Math.round(figureH * 0.35);
  for (let y = 0; y < h; y++) {
    let sx = 0, n = 0;
    for (let x = Math.max(0, Math.round(pivotX - band)); x < Math.min(w, Math.round(pivotX + band)); x++) {
      if (d[(y * w + x) * 4 + 3]! >= 128) { sx += x; n++; }
    }
    if (n >= 2) return [sx / n, y];
  }
  return null;
}

// World effects as pixel sprite animations (lane C 10-19; lanes/engine/EFFECTS-CONTRACT.md is the spec B / B2 / E
// build to). The pure part, no browser: fx.json's rules and the player's clock (which effects live, which drawing each
// shows, where), so Node tests run it. fx/fx.ts loads the drawings and draws them.

/** Drawn at her art px: one effect px = one of her 128 px art px. */
export const FX_PX = 1;
/**
 * (rfinish 10-21) A big world effect seen only pulled out (the R's nuke and its smoke, at zoom 0.4-0.72: one frame px is
 * 1.4-2.5 world px there, 2-4 of her art px) may be drawn at a coarser grid: `px` 2-4 = each drawing px is that many of
 * her art px a side (1.3-2.6 world px, the world's own pixel size), so it stores a quarter (or less) of the px for the
 * same picture. Nothing finer than the frame is lost at those zooms. Her own effects stay at px 1.
 */
export const FX_PX_MAX = 4;
/**
 * A drawing at most this size (art px; 10-19 v2: raised for the huge R letter, the dive's nuke). The loader cuts every
 * drawing into FX_CELL cells, drops the empty ones, trims each to what is painted and stores a cell repeated anywhere
 * in the effect once, so one drawing bigger than an atlas page plays as one (same clock, aligned to the art px) and a
 * sparse or slowly building effect costs what is painted, not its canvas.
 */
export const FX_MAX_W = 4096;
export const FX_MAX_H = 4096;
export const FX_CELL = 128;
/** Per effect: stored px after the cells (GPU: 4 bytes each), and PNG bytes (the slot-in checks the bytes). */
export const FX_MAX_STORED = 16_000_000;
export const FX_MAX_BYTES = 8_000_000;
/** Effects alive at once (the oldest one-shot goes first). */
export const FX_MAX_LIVE = 64;

export type FxLayer = "back" | "front";
export type FxAttach = "world" | "her";

export interface FxFrame {
  file: string;
  ticks: number;
  /** This drawing's pivot moved by (dx, dy) art px. */
  off?: [number, number];
  /** Whole-drawing opacity (fades only). */
  opacity?: number;
}

export interface FxDef {
  id: string;
  stage: "pixel";
  /** Her art px per drawing px (1, or 2-4 for big world effects seen pulled out). */
  px: number;
  /** The drawing px placed on the spawn point. */
  pivot: [number, number];
  layer: FxLayer;
  attach: FxAttach;
  reflect: boolean;
  frames: FxFrame[];
  loop: boolean;
  /** Effects that start with this one, at the same point, facing and clock (one effect authored in parts). */
  with: string[];
  notes?: string;
}

export class FxError extends Error {}

const ID = /^[a-z0-9_]+$/;
const FILE = /^f\d{3}\.png$/;
const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Checks an fx.json against the contract; throws an FxError naming every problem. */
export function validateFx(json: unknown, id: string): FxDef {
  const o = json as Record<string, unknown>;
  if (!o || typeof o !== "object") throw new FxError(`${id}: fx.json is not an object`);
  const bad: string[] = [];
  if (!ID.test(id)) bad.push(`the folder "${id}" is not a valid id (lowercase, digits, _)`);
  if (o.id !== id) bad.push(`id "${String(o.id)}" is not the folder's "${id}"`);
  if (o.stage !== "pixel") bad.push(`stage "${String(o.stage)}": only finished pixel art ("pixel") ships`);
  if (!num(o.px) || !Number.isInteger(o.px) || o.px < FX_PX || o.px > FX_PX_MAX) bad.push(`px ${String(o.px)}: effects are drawn at her art px (px 1; 2-${FX_PX_MAX} for big world effects seen pulled out)`);
  const pv = o.pivot as unknown[];
  if (!Array.isArray(pv) || pv.length !== 2 || !pv.every((v) => num(v) && Number.isInteger(v))) bad.push("pivot must be [x, y] in whole drawing px");
  const layer = o.layer ?? "front";
  if (layer !== "back" && layer !== "front") bad.push(`layer "${String(layer)}": "back" or "front"`);
  const attach = o.attach ?? "world";
  if (attach !== "world" && attach !== "her") bad.push(`attach "${String(attach)}": "world" or "her"`);
  if ("reflect" in o && typeof o.reflect !== "boolean") bad.push("reflect must be true or false");
  if ("loop" in o && typeof o.loop !== "boolean") bad.push("loop must be true or false");
  const wth = o.with ?? [];
  if (!Array.isArray(wth) || !wth.every((v) => typeof v === "string" && ID.test(v) && v !== id)) bad.push("with must be a list of other effects' ids");
  const frames = o.frames;
  if (!Array.isArray(frames) || frames.length === 0) bad.push("no frames");
  else {
    frames.forEach((f: unknown, i: number) => {
      const fr = f as Record<string, unknown>;
      if (!fr || typeof fr !== "object") { bad.push(`frames[${i}] is not an object`); return; }
      if (typeof fr.file !== "string" || !FILE.test(fr.file)) bad.push(`frames[${i}].file "${String(fr.file)}": fNNN.png`);
      if (!num(fr.ticks) || !Number.isInteger(fr.ticks) || fr.ticks < 1) bad.push(`frames[${i}].ticks must be a whole number >= 1`);
      if ("off" in fr) {
        const of = fr.off as unknown[];
        if (!Array.isArray(of) || of.length !== 2 || !of.every((v) => num(v) && Number.isInteger(v))) bad.push(`frames[${i}].off must be [dx, dy] whole art px`);
      }
      if ("opacity" in fr && (!num(fr.opacity) || fr.opacity < 0 || fr.opacity > 1)) bad.push(`frames[${i}].opacity must be in [0, 1]`);
    });
  }
  if (bad.length) throw new FxError(`${id}: ${bad.join("; ")}`);
  return {
    id, stage: "pixel", px: o.px as number, pivot: [pv[0] as number, pv[1] as number], layer: layer as FxLayer, attach: attach as FxAttach,
    reflect: o.reflect !== false, frames: (frames as FxFrame[]).map((f) => ({ ...f })), loop: o.loop === true, with: [...(wth as string[])],
    ...(typeof o.notes === "string" ? { notes: o.notes } : {}),
  };
}

/** Checks a drawing's size and pixels: at most FX_MAX_W x FX_MAX_H, alpha 0 or 255 only. Returns the problems. */
export function checkFxDrawing(rgba: Uint8Array | Uint8ClampedArray, w: number, h: number, name: string): string[] {
  const bad: string[] = [];
  if (w > FX_MAX_W || h > FX_MAX_H) bad.push(`${name}: ${w} x ${h} is over ${FX_MAX_W} x ${FX_MAX_H}`);
  let soft = 0;
  for (let i = 3; i < rgba.length; i += 4) if (rgba[i] !== 0 && rgba[i] !== 255) soft++;
  if (soft) bad.push(`${name}: ${soft} half-transparent px (alpha 0 or 255 only; draw translucency as a dither)`);
  return bad;
}

/** One stored cell of a drawing: where it sits in the drawing, its trimmed size, and its pixels' key (dedupe). */
export interface FxCell {
  x: number;
  y: number;
  w: number;
  h: number;
  key: string;
  px: Uint8Array;
}

/**
 * Cuts a drawing (RGBA, w x h) into `cell`-px cells, leaves out the empty ones and trims each to its painted box.
 * Each cell's `key` is the same for the same pixels (with its size), so an effect stores a repeated cell once.
 */
export function fxCells(rgba: Uint8Array | Uint8ClampedArray, w: number, h: number, cell = FX_CELL): FxCell[] {
  const out: FxCell[] = [];
  for (let cy = 0; cy < h; cy += cell) {
    for (let cx = 0; cx < w; cx += cell) {
      const ex = Math.min(w, cx + cell), ey = Math.min(h, cy + cell);
      let x0 = ex, y0 = ey, x1 = -1, y1 = -1;
      for (let y = cy; y < ey; y++) {
        for (let x = cx; x < ex; x++) {
          if (rgba[(y * w + x) * 4 + 3]! < 128) continue;
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
      if (x1 < 0) continue;
      const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
      const px = new Uint8Array(cw * ch * 4);
      for (let y = 0; y < ch; y++) px.set(rgba.subarray(((y0 + y) * w + x0) * 4, ((y0 + y) * w + x0 + cw) * 4), y * cw * 4);
      // FNV-1a over the pixels (+ the size): a key for dedupe (the loader compares the bytes before sharing)
      let a = 0x811c9dc5 ^ cw, b = 0x01000193 ^ ch;
      for (let i = 0; i < px.length; i++) { a = Math.imul(a ^ px[i]!, 0x01000193); b = Math.imul(b ^ px[i]!, 0x5bd1e995); }
      out.push({ x: x0, y: y0, w: cw, h: ch, key: `${cw}x${ch}:${(a >>> 0).toString(36)}:${(b >>> 0).toString(36)}`, px });
    }
  }
  return out;
}

/** What the game asks for when it plays an effect (EFFECTS-CONTRACT.md "How the game plays one"). */
export interface FxSpawn {
  /** World px; ignored for attach "her" (her soles). */
  x?: number;
  y?: number;
  facing?: number;
  attach?: FxAttach;
  layer?: FxLayer;
  /** Ticks before it starts. */
  delay?: number;
}

export interface FxLive {
  def: FxDef;
  x: number;
  y: number;
  facing: number;
  attach: FxAttach;
  layer: FxLayer;
  /** Ticks since it started (negative while delayed). */
  t: number;
  serial: number;
  stopped: boolean;
  /** Its clock's rate (1: the game's; a skipped cinematic speeds its smoke on) and the fraction of a tick it owes. */
  rate: number;
  acc: number;
  /** A fade-out (a dither break-up, the renderer's opacity): ticks left of `fadeN`, then it stops. */
  fadeLeft: number;
  fadeN: number;
}

export interface FxHandle {
  stop(): void;
  readonly alive: boolean;
  /** Moves it (and its parts) to a world point (a live effect the game drifts). */
  move(x: number, y: number): void;
  /** Its clock runs `k` ticks a tick from now (and its parts'). */
  speed(k: number): void;
  /** Breaks up (dithers out) over `ticks`, then stops (and its parts). */
  fadeOut(ticks: number): void;
}

const DEAD: FxHandle = { stop: () => {}, alive: false, move: () => {}, speed: () => {}, fadeOut: () => {} };

/** A live effect's whole-drawing opacity from its fade-out (1 when none). */
export const fxFade = (e: FxLive): number => (e.fadeN > 0 ? Math.max(0, e.fadeLeft / e.fadeN) : 1);

/** The drawing an effect shows t ticks in (null when a one-shot is done). Loops wrap. */
export function fxFrameAt(def: FxDef, t: number): number | null {
  if (t < 0) return null;
  const total = def.frames.reduce((a, f) => a + f.ticks, 0);
  if (t >= total) {
    if (!def.loop) return null;
    t %= total;
  }
  for (let i = 0, at = 0; i < def.frames.length; i++) {
    at += def.frames[i]!.ticks;
    if (t < at) return i;
  }
  return def.frames.length - 1;
}

/** The effects alive and their clock (60 ticks a second, stopped by hitstop with the rest of the game). */
export class FxClock {
  readonly live: FxLive[] = [];
  private serial = 0;
  private warned = new Set<string>();

  readonly defs: ReadonlyMap<string, FxDef>;

  constructor(defs: ReadonlyMap<string, FxDef>) {
    this.defs = defs;
  }

  has(id: string): boolean {
    return this.defs.has(id);
  }

  play(id: string, o: FxSpawn = {}, depth = 0): FxHandle {
    const def = this.defs.get(id);
    if (!def) {
      if (!this.warned.has(id)) { this.warned.add(id); console.warn(`fx: no effect called ${id} (public/assets/fx/${id}/)`); }
      return DEAD;
    }
    if (this.live.length >= FX_MAX_LIVE) {
      const i = this.live.findIndex((e) => !e.def.loop);
      this.live.splice(i >= 0 ? i : 0, 1);
    }
    const e: FxLive = {
      def, x: o.x ?? 0, y: o.y ?? 0, facing: (o.facing ?? 1) < 0 ? -1 : 1, attach: o.attach ?? def.attach, layer: o.layer ?? def.layer,
      t: -Math.max(0, Math.round(o.delay ?? 0)), serial: this.serial++, stopped: false, rate: 1, acc: 0, fadeLeft: 0, fadeN: 0,
    };
    this.live.push(e);
    // its parts start with it: the same point, facing, delay (so the same clock); stopping it stops them
    const parts = depth < 4 ? def.with.map((p) => this.play(p, { ...o, layer: undefined }, depth + 1)) : [];
    return {
      stop: () => { e.stopped = true; for (const p of parts) p.stop(); },
      get alive() { return !e.stopped && fxFrameAt(e.def, Math.max(0, e.t)) !== null; },
      move: (x, y) => { e.x = x; e.y = y; for (const p of parts) p.move(x, y); },
      speed: (k) => { e.rate = Math.max(0, k); for (const p of parts) p.speed(k); },
      fadeOut: (n) => {
        const k = Math.max(1, Math.round(n));
        if (e.fadeN === 0 || e.fadeLeft > k) { e.fadeN = k; e.fadeLeft = k; }
        for (const p of parts) p.fadeOut(n);
      },
    };
  }

  /** One tick: every effect ages (at its rate; a delay always counts down a tick a tick); finished one-shots, stopped
   * and faded-out ones go. */
  tick(): void {
    for (const e of this.live) {
      if (e.t < 0 || e.rate === 1) e.t++;
      else {
        e.acc += e.rate;
        while (e.acc >= 1) { e.t++; e.acc--; }
      }
      if (e.fadeN > 0 && --e.fadeLeft <= 0) e.stopped = true;
    }
    for (let i = this.live.length - 1; i >= 0; i--) {
      const e = this.live[i]!;
      if (e.stopped || (e.t >= 0 && fxFrameAt(e.def, e.t) === null)) this.live.splice(i, 1);
    }
  }

  clear(): void {
    this.live.length = 0;
  }
}

/**
 * (zhusha lead 10-20, Dex: "layer her just 1 layer behind the ground along with whatever effects") A ground effect
 * (its pivot on the ground) is drawn `dip` art px low and nothing of it shows below the ground line, like her drawing.
 * Returns the ground's world y to cut at, or null when the effect is not on the ground (in the air, a hit point, the
 * lake's pass). `prefixes`: the effects that sit on the ground (feel.json draw.groundFx); `dipY`: the dip in world px
 * (a pivot already dipped, like her soleY, still counts as on the ground).
 */
export function fxGroundClip(
  id: string, x: number, y: number, prefixes: readonly string[], groundAt: ((x: number, y: number) => number | null) | null, dipY = 0,
): number | null {
  if (!groundAt || !prefixes.some((p) => id.startsWith(p))) return null;
  const g = groundAt(x, y - dipY - 2);
  return g !== null && y >= g - 2 && y <= g + dipY + 2 ? g : null;
}

/** How many rows of a cell show above `clipY` (world y): row k of a cell sits at world y = pivotY + (offY + k) x a. */
export function fxClipRows(rows: number, offY: number, pivotY: number, clipY: number, a: number): number {
  return Math.max(0, Math.min(rows, Math.ceil((clipY - pivotY) / a - offY)));
}

/**
 * (rfinish 10-21, Dex: effects must "know where the ground and stuff is") A wide ground effect (the R's nuke, its dust
 * skirt, its wreck) follows the ground under each part of it, not only under its pivot: a cell `sw` drawing px wide
 * whose drawing column c sits at world x = x0 + dir x c x A (A: world px per drawing px; facing left the columns run
 * the other way) is cut strip by strip at the ground under that strip (`groundCol`: the ground's y there, or null when
 * there is none near: nothing cut). One run when the ground is level under the whole cell. Returns [c0, c1, clipY].
 */
export function fxGroundStrips(
  x0: number, sw: number, A: number, dir: 1 | -1, groundCol: (x: number) => number | null, strip = 8,
): [number, number, number | null][] {
  const at = (c: number): number | null => groundCol(x0 + dir * c * A);
  const same = (p: number | null, q: number | null): boolean => (p === null ? q === null : q !== null && Math.abs(p - q) < 0.5);
  const a = at(0.5), m = at(sw / 2), b = at(sw - 0.5);
  if (same(a, m) && same(m, b)) return [[0, sw, m]];
  const out: [number, number, number | null][] = [];
  for (let c = 0; c < sw; c += strip) {
    const c1 = Math.min(sw, c + strip);
    const g = at((c + c1) / 2);
    const last = out[out.length - 1];
    if (last && same(last[2], g)) last[1] = c1;
    else out.push([c, c1, g]);
  }
  return out;
}

/**
 * (rfinish round 4) A draped piece's strips (fxGroundStrips) that its drawing lifts the same whole drawing px (the
 * ground under them over `clipY`, `A` world px a drawing px) are drawn as one: the same picture with fewer quads.
 * Strips over no ground stay apart.
 */
export function fxMergeLifts(runs: readonly [number, number, number | null][], clipY: number, A: number): [number, number, number | null][] {
  const out: [number, number, number | null][] = [];
  const lift = (g: number | null): number | null => (g === null ? null : Math.round((g - clipY) / A));
  for (const r of runs) {
    const last = out[out.length - 1];
    if (last && last[2] !== null && r[2] !== null && lift(last[2]) === lift(r[2])) last[1] = r[1];
    else out.push([r[0], r[1], r[2]]);
  }
  return out;
}

/**
 * (rfinish round 4, critic 10-22: the nuke's dust skirt ended in a hard vertical edge at the court's ledge and at the
 * building's front, where its strips over no ground were dropped) Where the ground stops under a draped piece
 * (fxGroundStrips' runs; `col`: the ground under drawing column c, null where none), the drawing columns it stops at:
 * [at, side], the ground on the columns below `at` (side 1) or from `at` on (side -1).
 */
export function fxGroundEnds(runs: readonly [number, number, number | null][], col: (c: number) => number | null, strip = 8): [number, number][] {
  const out: [number, number][] = [];
  for (let k = 0; k + 1 < runs.length; k++) {
    const a = runs[k]!, b = runs[k + 1]!;
    if ((a[2] === null) === (b[2] === null)) continue;
    // the runs were read at their strips' middles: find the column itself, a strip either side of the seam
    const lo = Math.max(a[0], a[1] - strip), hi = Math.min(b[1], b[0] + strip);
    if (b[2] === null) {
      let c = lo;
      while (c < hi && col(c + 0.5) !== null) c++;
      out.push([c, 1]);
    } else {
      let c = hi;
      while (c > lo && col(c - 0.5) !== null) c--;
      out.push([c, -1]);
    }
  }
  return out;
}

/**
 * How high the ground's piece may stand at x near the ends where the ground stops (`ends`: [at, side] in the same
 * units as x, the ground below `at` for side 1, from `at` on for side -1), a share of its full height: a tapered end
 * `span` long (a sine shoulder: whole away from the end, sloping down to nothing at it, never a vertical edge; a slow
 * unevenness so it reads as the dust thinning out, not a ruled curve); 1 away from the ends; 0 just past one (within
 * `past`: further out the strips over no ground are not drawn at all). In world px, so pieces lying over each other
 * are cut to one line (their own columns cut apart showed thin slivers of the one behind, kept as streaks zoomed out).
 */
export function fxErodeKeep(x: number, ends: readonly [number, number][], span: number, past: number): number {
  let keep = 1;
  for (const [at, side] of ends) {
    const d = side > 0 ? at - x : x - at;
    if (d <= 0) {
      if (d > -past) return 0;
      continue;
    }
    if (d >= span) continue;
    const u = d / span, lump = u > 0.85 ? 1 : 1 - 0.08 * (0.5 + 0.5 * Math.sin((x / span) * 9.7 + at * 0.013));
    keep = Math.min(keep, Math.sin((u * Math.PI) / 2) * lump);
  }
  return keep;
}

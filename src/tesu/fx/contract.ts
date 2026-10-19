// World effects as pixel sprite animations (lane C 10-19; lanes/engine/EFFECTS-CONTRACT.md is the spec B / B2 / E
// build to). The pure part, no browser: fx.json's rules and the player's clock (which effects live, which drawing each
// shows, where), so Node tests run it. fx/fx.ts loads the drawings and draws them.

/** Drawn at her art px: one effect px = one of her 128 px art px. */
export const FX_PX = 1;
/** A drawing at most this size (art px). */
export const FX_MAX_W = 2048;
export const FX_MAX_H = 1024;
/** Per effect: opaque-box px over all its drawings, and PNG bytes (the slot-in checks the bytes). */
export const FX_MAX_AREA = 6_000_000;
export const FX_MAX_BYTES = 2_000_000;
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
  px: 1;
  /** The drawing px placed on the spawn point. */
  pivot: [number, number];
  layer: FxLayer;
  attach: FxAttach;
  reflect: boolean;
  frames: FxFrame[];
  loop: boolean;
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
  if (o.px !== FX_PX) bad.push(`px ${String(o.px)}: effects are drawn at her art px (px 1)`);
  const pv = o.pivot as unknown[];
  if (!Array.isArray(pv) || pv.length !== 2 || !pv.every((v) => num(v) && Number.isInteger(v))) bad.push("pivot must be [x, y] in whole drawing px");
  const layer = o.layer ?? "front";
  if (layer !== "back" && layer !== "front") bad.push(`layer "${String(layer)}": "back" or "front"`);
  const attach = o.attach ?? "world";
  if (attach !== "world" && attach !== "her") bad.push(`attach "${String(attach)}": "world" or "her"`);
  if ("reflect" in o && typeof o.reflect !== "boolean") bad.push("reflect must be true or false");
  if ("loop" in o && typeof o.loop !== "boolean") bad.push("loop must be true or false");
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
    id, stage: "pixel", px: 1, pivot: [pv[0] as number, pv[1] as number], layer: layer as FxLayer, attach: attach as FxAttach,
    reflect: o.reflect !== false, frames: (frames as FxFrame[]).map((f) => ({ ...f })), loop: o.loop === true,
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
}

export interface FxHandle {
  stop(): void;
  readonly alive: boolean;
}

const DEAD: FxHandle = { stop: () => {}, alive: false };

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

  play(id: string, o: FxSpawn = {}): FxHandle {
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
      t: -Math.max(0, Math.round(o.delay ?? 0)), serial: this.serial++, stopped: false,
    };
    this.live.push(e);
    return { stop: () => { e.stopped = true; }, get alive() { return !e.stopped && fxFrameAt(e.def, Math.max(0, e.t)) !== null; } };
  }

  /** One tick: every effect ages; finished one-shots and stopped ones go. */
  tick(): void {
    for (const e of this.live) e.t++;
    for (let i = this.live.length - 1; i >= 0; i--) {
      const e = this.live[i]!;
      if (e.stopped || (e.t >= 0 && fxFrameAt(e.def, e.t) === null)) this.live.splice(i, 1);
    }
  }

  clear(): void {
    this.live.length = 0;
  }
}

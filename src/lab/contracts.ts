// The single data contract between the character pipeline (Blender -> pixel
// frames) and the lab runtime. docs/character/RUNTIME-CONTRACT.md explains
// every field; this file is the executable version of that document.
//
// Conventions:
// - Pixels are native sprite pixels (one pixel = one low-res screen pixel).
// - y points down. Frame-relative data (boxes, offsets, root motion, anchors)
//   is authored for a character FACING RIGHT; the runtime mirrors x when she
//   faces left.
// - Time is counted in 60 Hz simulation ticks.

export const SPRITE_CONTRACT = "dex.sprite/1";

export type Vec2 = [number, number];
/** x, y, w, h in atlas pixels. */
export type Rect = [number, number, number, number];
/** "#rrggbb". */
export type Colour = string;

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface HitBox extends Box {
  damage: number;
  /** Launch velocity given to the target, px per tick, x = away from the attacker. */
  knockback: Vec2;
  /** Global freeze on contact, in ticks. */
  hitstop: number;
  /** Poise damage; enough of it staggers the target. */
  stagger?: number;
  /** Hitboxes that share a group hit each target once per clip play. */
  group?: string;
  heavy?: boolean;
  /** VFX preset spawned at the contact point. */
  hitVfx?: string;
  /** Extra camera shake on contact. */
  shake?: { amplitude: number; duration: number };
  /** Zoom punch on contact (same fields as the zoom event). */
  zoom?: { steps: number; duration: number };
  /** Impact frame on contact (same fields as the impact event). */
  impact?: { mode: "invert" | "mono"; duration: number };
}

export type Phase = "neutral" | "anticipation" | "active" | "recovery";

/** Player actions a cancel window can accept. */
export const CANCEL_ACTIONS = ["m1", "m2", "skill", "ult", "jump", "move"] as const;
export type CancelAction = (typeof CANCEL_ACTIONS)[number];

export interface CancelWindow {
  /** action -> clip id to play (or "*" for the controller's default clip for that action). */
  into: Partial<Record<CancelAction, string>>;
  /** Only open once this clip play has hit something. */
  onHit?: boolean;
}

export interface LightEmission {
  colour: Colour;
  /** Radius of influence in pixels. */
  radius: number;
  /** 0..4, 1 is a normal lamp. */
  intensity: number;
  /** Ticks; the light fades out linearly over this time. */
  duration: number;
  /** Height above the sprite plane in pixels (bigger = flatter, softer light). */
  height?: number;
  /** Random intensity jitter 0..1. */
  flicker?: number;
}

interface Placed {
  /** Frame anchor name (see Frame.anchors) the offset is relative to; default the pivot. */
  anchor?: string;
  offset?: Vec2;
  /** Follow the character after spawning. */
  attach?: boolean;
}

export interface VfxEvent extends Placed {
  type: "vfx";
  /** Preset id from the VFX library (src/lab/data/vfx.json). */
  id: string;
  /** Degrees, clockwise (y down), in facing-right space. */
  rotation?: number;
  scale?: number | Vec2;
  colour?: Colour;
  core?: Colour;
  edge?: Colour;
  layer?: "back" | "front";
  /** Primitive overrides; keys and ranges are VFX_PARAMS below. */
  params?: Record<string, number>;
  light?: LightEmission;
}

export interface LightEvent extends Placed, LightEmission {
  type: "light";
}

export interface ShakeEvent {
  type: "shake";
  /** Pixels. */
  amplitude: number;
  duration: number;
}

export interface ZoomEvent {
  type: "zoom";
  /** Integer upscale steps added for the punch (1 or 2); keeps every pixel the same size. */
  steps: number;
  duration: number;
}

export interface SlowmoEvent {
  type: "slowmo";
  /** Simulation speed 0.05..1. */
  factor: number;
  /** Real-time ticks. */
  duration: number;
}

export interface CutinEvent {
  type: "cutin";
  id: string;
  duration: number;
}

export interface SoundEvent {
  type: "sound";
  id: string;
  volume?: number;
}

export interface ImpactEvent {
  type: "impact";
  mode: "invert" | "mono";
  /** 1 or 2 ticks. Skipped under prefers-reduced-motion. */
  duration: number;
}

export type FrameEvent =
  | VfxEvent
  | LightEvent
  | ShakeEvent
  | ZoomEvent
  | SlowmoEvent
  | CutinEvent
  | SoundEvent
  | ImpactEvent;

export interface Frame {
  rect: Rect;
  /** Foot anchor inside the rect, in pixels from the rect's top-left. */
  pivot: Vec2;
  /** Ticks this drawing is shown. */
  duration: number;
  /** Extra ticks the drawing is held after its duration (a held key). */
  hold?: number;
  phase?: Phase;
  hitboxes?: HitBox[];
  /** Overrides the package default hurtboxes; [] means no hurtbox. */
  hurtboxes?: Box[];
  iframes?: boolean;
  cancel?: CancelWindow[];
  /** Pixels travelled over the whole frame (spread across its ticks). */
  rootMotion?: Vec2;
  /** Fired when the frame starts. */
  events?: FrameEvent[];
  /** Named points relative to the pivot: tip, handN, handF, head, chest, muzzle... */
  anchors?: Record<string, Vec2>;
  /** Informational: the source pose or action frame. */
  pose?: string;
}

export interface Clip {
  id: string;
  atlas: string;
  loop?: boolean;
  /** Clip to play when a non-looping clip ends. */
  next?: string;
  /** Gravity multiplier while this clip plays (air attacks hang). */
  gravity?: number;
  /** Frames represent aim angles, evenly spaced from..to degrees (turret barrels). */
  angles?: { from: number; to: number };
  tags?: string[];
  frames: Frame[];
}

export interface AtlasDesc {
  id: string;
  /** Paths relative to the manifest. */
  albedo: string;
  normal: string | null;
  width: number;
  height: number;
  /**
   * "flat": albedo is unlit base colour, the key light shades it fully.
   * "baked": albedo already carries key-light shading; the key light only nudges it.
   */
  shading: "flat" | "baked";
}

export interface SpritePackage {
  contract: typeof SPRITE_CONTRACT;
  name: string;
  atlases: AtlasDesc[];
  clips: Clip[];
  defaults?: { hurtboxes?: Box[] };
}

/** What public/lab/<name>/manifest.json holds before the pipeline exports anything. */
export interface StandinManifest {
  contract: typeof SPRITE_CONTRACT;
  standin: true;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export class ContractError extends Error {
  readonly issues: string[];
  constructor(source: string, issues: string[]) {
    super(`${source}: ${issues.length} contract issue(s)\n  ${issues.slice(0, 20).join("\n  ")}`);
    this.name = "ContractError";
    this.issues = issues;
  }
}

type Obj = Record<string, unknown>;

class Checker {
  readonly issues: string[] = [];
  fail(path: string, msg: string): void {
    this.issues.push(`${path}: ${msg}`);
  }
  obj(v: unknown, path: string): Obj | null {
    if (typeof v === "object" && v !== null && !Array.isArray(v)) return v as Obj;
    this.fail(path, "expected an object");
    return null;
  }
  arr(v: unknown, path: string): unknown[] | null {
    if (Array.isArray(v)) return v;
    this.fail(path, "expected an array");
    return null;
  }
  str(v: unknown, path: string): v is string {
    if (typeof v === "string" && v.length > 0) return true;
    this.fail(path, "expected a non-empty string");
    return false;
  }
  num(v: unknown, path: string, min = -Infinity, max = Infinity): v is number {
    if (typeof v === "number" && Number.isFinite(v) && v >= min && v <= max) return true;
    this.fail(path, `expected a number in [${min}, ${max}], got ${JSON.stringify(v)}`);
    return false;
  }
  int(v: unknown, path: string, min = -Infinity, max = Infinity): v is number {
    if (this.num(v, path, min, max) && Number.isInteger(v)) return true;
    if (typeof v === "number" && !Number.isInteger(v)) this.fail(path, "expected an integer");
    return false;
  }
  bool(v: unknown, path: string): v is boolean {
    if (typeof v === "boolean") return true;
    this.fail(path, "expected true/false");
    return false;
  }
  vec2(v: unknown, path: string): v is Vec2 {
    const a = this.arr(v, path);
    if (!a) return false;
    if (a.length !== 2) {
      this.fail(path, "expected [x, y]");
      return false;
    }
    return this.num(a[0], `${path}[0]`) && this.num(a[1], `${path}[1]`);
  }
  colour(v: unknown, path: string): v is Colour {
    if (typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v)) return true;
    this.fail(path, `expected "#rrggbb", got ${JSON.stringify(v)}`);
    return false;
  }
  oneOf<T extends string>(v: unknown, path: string, options: readonly T[]): v is T {
    if (typeof v === "string" && (options as readonly string[]).includes(v)) return true;
    this.fail(path, `expected one of ${options.join(", ")}, got ${JSON.stringify(v)}`);
    return false;
  }
  unknownKeys(o: Obj, path: string, allowed: readonly string[]): void {
    for (const k of Object.keys(o)) if (!allowed.includes(k)) this.fail(`${path}.${k}`, "unknown field");
  }
}

const BOX_KEYS = ["x", "y", "w", "h"] as const;
const HITBOX_KEYS = [...BOX_KEYS, "damage", "knockback", "hitstop", "stagger", "group", "heavy", "hitVfx", "shake", "zoom", "impact"] as const;

function checkBox(c: Checker, v: unknown, path: string, keys: readonly string[] = BOX_KEYS): Obj | null {
  const o = c.obj(v, path);
  if (!o) return null;
  c.unknownKeys(o, path, keys);
  c.num(o.x, `${path}.x`);
  c.num(o.y, `${path}.y`);
  c.num(o.w, `${path}.w`, 0.0001);
  c.num(o.h, `${path}.h`, 0.0001);
  return o;
}

function checkHitbox(c: Checker, v: unknown, path: string): void {
  const o = checkBox(c, v, path, HITBOX_KEYS);
  if (!o) return;
  c.num(o.damage, `${path}.damage`, 0);
  c.vec2(o.knockback, `${path}.knockback`);
  c.int(o.hitstop, `${path}.hitstop`, 0, 60);
  if (o.stagger !== undefined) c.num(o.stagger, `${path}.stagger`, 0);
  if (o.group !== undefined) c.str(o.group, `${path}.group`);
  if (o.heavy !== undefined) c.bool(o.heavy, `${path}.heavy`);
  if (o.hitVfx !== undefined) c.str(o.hitVfx, `${path}.hitVfx`);
  if (o.shake !== undefined) {
    const s = c.obj(o.shake, `${path}.shake`);
    if (s) {
      c.unknownKeys(s, `${path}.shake`, ["amplitude", "duration"]);
      c.num(s.amplitude, `${path}.shake.amplitude`, 0, 32);
      c.int(s.duration, `${path}.shake.duration`, 1, 240);
    }
  }
  if (o.zoom !== undefined) {
    const z = c.obj(o.zoom, `${path}.zoom`);
    if (z) {
      c.unknownKeys(z, `${path}.zoom`, ["steps", "duration"]);
      c.int(z.steps, `${path}.zoom.steps`, 1, 2);
      c.int(z.duration, `${path}.zoom.duration`, 1, 240);
    }
  }
  if (o.impact !== undefined) {
    const m = c.obj(o.impact, `${path}.impact`);
    if (m) {
      c.unknownKeys(m, `${path}.impact`, ["mode", "duration"]);
      c.oneOf(m.mode, `${path}.impact.mode`, ["invert", "mono"] as const);
      c.int(m.duration, `${path}.impact.duration`, 1, 2);
    }
  }
}

/**
 * Every key a vfx event's `params` may override, with its range. Anything
 * else is rejected, so package data can't grow effects without bound (a
 * `duration` of 1e9 or a `count` of 3e6 fails validation with its path).
 * [min, max, integer]
 */
export const VFX_PARAMS: Readonly<Record<string, readonly [number, number, boolean]>> = {
  duration: [1, 600, true],
  // shape size (px)
  radius: [0, 1024, false],
  r0: [0, 1024, false],
  r1: [0, 1024, false],
  thickness: [0, 128, false],
  width: [0, 256, false],
  height: [0, 1024, false],
  length: [0, 1024, false],
  glow: [0, 16, false],
  flat: [0.05, 4, false],
  from: [-720, 720, false],
  to: [-720, 720, false],
  slivers: [0, 16, true],
  lines: [0, 16, true],
  branches: [1, 16, true],
  every: [1, 60, true],
  opacity: [0, 1, false],
  over: [0, 1, false],
  realtime: [0, 1, false],
  // particles (count is also a burst's ray count)
  count: [0, 256, true],
  speedMin: [0, 32, false],
  speedMax: [0, 32, false],
  spread: [0, 360, false],
  angle: [-360, 360, false],
  gravity: [-2, 2, false],
  drag: [0, 1, false],
  lifeMin: [1, 600, false],
  lifeMax: [1, 600, false],
  areaW: [0, 2048, false],
  areaH: [0, 2048, false],
  sizeMin: [0, 16, false],
  sizeMax: [0, 16, false],
  bounce: [0, 1, false],
  inward: [0, 512, false],
};

const LIGHT_KEYS = ["colour", "radius", "intensity", "duration", "height", "flicker"] as const;
const PLACED_KEYS = ["anchor", "offset", "attach"] as const;

function checkLight(c: Checker, o: Obj, path: string): void {
  c.colour(o.colour, `${path}.colour`);
  c.num(o.radius, `${path}.radius`, 1, 4096);
  c.num(o.intensity, `${path}.intensity`, 0, 8);
  c.int(o.duration, `${path}.duration`, 1, 1200);
  if (o.height !== undefined) c.num(o.height, `${path}.height`, 0, 1000);
  if (o.flicker !== undefined) c.num(o.flicker, `${path}.flicker`, 0, 1);
}

function checkPlaced(c: Checker, o: Obj, path: string): void {
  if (o.anchor !== undefined) c.str(o.anchor, `${path}.anchor`);
  if (o.offset !== undefined) c.vec2(o.offset, `${path}.offset`);
  if (o.attach !== undefined) c.bool(o.attach, `${path}.attach`);
}

const EVENT_TYPES = ["vfx", "light", "shake", "zoom", "slowmo", "cutin", "sound", "impact"] as const;

function checkEvent(c: Checker, v: unknown, path: string): void {
  const o = c.obj(v, path);
  if (!o) return;
  if (!c.oneOf(o.type, `${path}.type`, EVENT_TYPES)) return;
  switch (o.type) {
    case "vfx": {
      c.unknownKeys(o, path, ["type", ...PLACED_KEYS, "id", "rotation", "scale", "colour", "core", "edge", "layer", "params", "light"]);
      checkPlaced(c, o, path);
      c.str(o.id, `${path}.id`);
      if (o.rotation !== undefined) c.num(o.rotation, `${path}.rotation`, -720, 720);
      if (o.scale !== undefined) {
        if (typeof o.scale === "number") c.num(o.scale, `${path}.scale`, -16, 16);
        else if (c.vec2(o.scale, `${path}.scale`)) {
          const [sx, sy] = o.scale as [number, number];
          c.num(sx, `${path}.scale[0]`, -16, 16);
          c.num(sy, `${path}.scale[1]`, -16, 16);
        }
      }
      for (const k of ["colour", "core", "edge"] as const) if (o[k] !== undefined) c.colour(o[k], `${path}.${k}`);
      if (o.layer !== undefined) c.oneOf(o.layer, `${path}.layer`, ["back", "front"] as const);
      if (o.params !== undefined) {
        const p = c.obj(o.params, `${path}.params`);
        if (p) {
          for (const [k, pv] of Object.entries(p)) {
            const range = VFX_PARAMS[k];
            if (!range) {
              c.fail(`${path}.params.${k}`, `unknown vfx param (allowed: ${Object.keys(VFX_PARAMS).join(", ")})`);
              continue;
            }
            if (range[2]) c.int(pv, `${path}.params.${k}`, range[0], range[1]);
            else c.num(pv, `${path}.params.${k}`, range[0], range[1]);
          }
        }
      }
      if (o.light !== undefined) {
        const l = c.obj(o.light, `${path}.light`);
        if (l) {
          c.unknownKeys(l, `${path}.light`, LIGHT_KEYS);
          checkLight(c, l, `${path}.light`);
        }
      }
      break;
    }
    case "light":
      c.unknownKeys(o, path, ["type", ...PLACED_KEYS, ...LIGHT_KEYS]);
      checkPlaced(c, o, path);
      checkLight(c, o, path);
      break;
    case "shake":
      c.unknownKeys(o, path, ["type", "amplitude", "duration"]);
      c.num(o.amplitude, `${path}.amplitude`, 0, 32);
      c.int(o.duration, `${path}.duration`, 1, 240);
      break;
    case "zoom":
      c.unknownKeys(o, path, ["type", "steps", "duration"]);
      c.int(o.steps, `${path}.steps`, 1, 2);
      c.int(o.duration, `${path}.duration`, 1, 240);
      break;
    case "slowmo":
      c.unknownKeys(o, path, ["type", "factor", "duration"]);
      c.num(o.factor, `${path}.factor`, 0.05, 1);
      c.int(o.duration, `${path}.duration`, 1, 600);
      break;
    case "cutin":
      c.unknownKeys(o, path, ["type", "id", "duration"]);
      c.str(o.id, `${path}.id`);
      c.int(o.duration, `${path}.duration`, 1, 600);
      break;
    case "sound":
      c.unknownKeys(o, path, ["type", "id", "volume"]);
      c.str(o.id, `${path}.id`);
      if (o.volume !== undefined) c.num(o.volume, `${path}.volume`, 0, 2);
      break;
    case "impact":
      c.unknownKeys(o, path, ["type", "mode", "duration"]);
      c.oneOf(o.mode, `${path}.mode`, ["invert", "mono"] as const);
      c.int(o.duration, `${path}.duration`, 1, 2);
      break;
  }
}

const FRAME_KEYS = [
  "rect", "pivot", "duration", "hold", "phase", "hitboxes", "hurtboxes", "iframes",
  "cancel", "rootMotion", "events", "anchors", "pose",
] as const;

function checkFrame(c: Checker, v: unknown, path: string, atlas: AtlasDesc | undefined): void {
  const o = c.obj(v, path);
  if (!o) return;
  c.unknownKeys(o, path, FRAME_KEYS);
  const r = c.arr(o.rect, `${path}.rect`);
  if (r) {
    if (r.length !== 4) c.fail(`${path}.rect`, "expected [x, y, w, h]");
    else {
      const ok = r.every((n, i) => c.int(n, `${path}.rect[${i}]`, 0));
      const [x, y, w, h] = r as number[];
      if (ok && (w! <= 0 || h! <= 0)) c.fail(`${path}.rect`, "width and height must be > 0");
      if (ok && atlas && (x! + w! > atlas.width || y! + h! > atlas.height)) {
        c.fail(`${path}.rect`, `outside atlas "${atlas.id}" (${atlas.width}x${atlas.height})`);
      }
    }
  }
  c.vec2(o.pivot, `${path}.pivot`);
  c.int(o.duration, `${path}.duration`, 1, 600);
  if (o.hold !== undefined) c.int(o.hold, `${path}.hold`, 0, 600);
  if (o.phase !== undefined) c.oneOf(o.phase, `${path}.phase`, ["neutral", "anticipation", "active", "recovery"] as const);
  if (o.hitboxes !== undefined) c.arr(o.hitboxes, `${path}.hitboxes`)?.forEach((b, i) => checkHitbox(c, b, `${path}.hitboxes[${i}]`));
  if (o.hurtboxes !== undefined) c.arr(o.hurtboxes, `${path}.hurtboxes`)?.forEach((b, i) => checkBox(c, b, `${path}.hurtboxes[${i}]`));
  if (o.iframes !== undefined) c.bool(o.iframes, `${path}.iframes`);
  if (o.cancel !== undefined) {
    c.arr(o.cancel, `${path}.cancel`)?.forEach((w, i) => {
      const wp = `${path}.cancel[${i}]`;
      const wo = c.obj(w, wp);
      if (!wo) return;
      c.unknownKeys(wo, wp, ["into", "onHit"]);
      const into = c.obj(wo.into, `${wp}.into`);
      if (into) {
        for (const [k, target] of Object.entries(into)) {
          c.oneOf(k, `${wp}.into`, CANCEL_ACTIONS);
          c.str(target, `${wp}.into.${k}`);
        }
      }
      if (wo.onHit !== undefined) c.bool(wo.onHit, `${wp}.onHit`);
    });
  }
  if (o.rootMotion !== undefined) c.vec2(o.rootMotion, `${path}.rootMotion`);
  if (o.events !== undefined) c.arr(o.events, `${path}.events`)?.forEach((e, i) => checkEvent(c, e, `${path}.events[${i}]`));
  if (o.anchors !== undefined) {
    const a = c.obj(o.anchors, `${path}.anchors`);
    if (a) for (const [k, p] of Object.entries(a)) c.vec2(p, `${path}.anchors.${k}`);
  }
  if (o.pose !== undefined) c.str(o.pose, `${path}.pose`);
}

/**
 * Validates an exported (or stand-in baked) sprite package. Throws a
 * ContractError listing every problem with its JSON path; returns the typed
 * package otherwise.
 */
export function validatePackage(json: unknown, source: string): SpritePackage {
  const c = new Checker();
  const o = c.obj(json, "$");
  if (!o) throw new ContractError(source, c.issues);
  c.unknownKeys(o, "$", ["contract", "name", "atlases", "clips", "defaults"]);
  if (o.contract !== SPRITE_CONTRACT) c.fail("$.contract", `expected "${SPRITE_CONTRACT}"`);
  c.str(o.name, "$.name");

  const atlases = new Map<string, AtlasDesc>();
  c.arr(o.atlases, "$.atlases")?.forEach((a, i) => {
    const p = `$.atlases[${i}]`;
    const ao = c.obj(a, p);
    if (!ao) return;
    c.unknownKeys(ao, p, ["id", "albedo", "normal", "width", "height", "shading"]);
    const ok = c.str(ao.id, `${p}.id`) && c.str(ao.albedo, `${p}.albedo`);
    if (ao.normal !== null) c.str(ao.normal, `${p}.normal`);
    c.int(ao.width, `${p}.width`, 1, 8192);
    c.int(ao.height, `${p}.height`, 1, 8192);
    c.oneOf(ao.shading, `${p}.shading`, ["flat", "baked"] as const);
    if (ok) {
      if (atlases.has(ao.id as string)) c.fail(`${p}.id`, "duplicate atlas id");
      atlases.set(ao.id as string, ao as unknown as AtlasDesc);
    }
  });
  if (atlases.size === 0) c.fail("$.atlases", "at least one atlas is required");

  const clipIds = new Set<string>();
  const clips = c.arr(o.clips, "$.clips") ?? [];
  clips.forEach((cl, i) => {
    const p = `$.clips[${i}]`;
    const co = c.obj(cl, p);
    if (!co) return;
    c.unknownKeys(co, p, ["id", "atlas", "loop", "next", "gravity", "angles", "tags", "frames"]);
    if (c.str(co.id, `${p}.id`)) {
      if (clipIds.has(co.id)) c.fail(`${p}.id`, `duplicate clip id "${co.id}"`);
      clipIds.add(co.id);
    }
    let atlas: AtlasDesc | undefined;
    if (c.str(co.atlas, `${p}.atlas`)) {
      atlas = atlases.get(co.atlas);
      if (!atlas) c.fail(`${p}.atlas`, `unknown atlas "${co.atlas}"`);
    }
    if (co.loop !== undefined) c.bool(co.loop, `${p}.loop`);
    if (co.gravity !== undefined) c.num(co.gravity, `${p}.gravity`, 0, 4);
    if (co.angles !== undefined) {
      const an = c.obj(co.angles, `${p}.angles`);
      if (an) {
        c.unknownKeys(an, `${p}.angles`, ["from", "to"]);
        const ok = c.num(an.from, `${p}.angles.from`, -360, 360) && c.num(an.to, `${p}.angles.to`, -360, 360);
        if (ok && an.from === an.to) c.fail(`${p}.angles`, `"from" and "to" must differ (both ${an.from as number})`);
      }
    }
    if (co.tags !== undefined) c.arr(co.tags, `${p}.tags`)?.forEach((t, j) => c.str(t, `${p}.tags[${j}]`));
    const frames = c.arr(co.frames, `${p}.frames`);
    if (frames && frames.length === 0) c.fail(`${p}.frames`, "a clip needs at least one frame");
    frames?.forEach((f, j) => checkFrame(c, f, `${p}.frames[${j}]`, atlas));
  });
  // cross references that need every clip id
  clips.forEach((cl, i) => {
    const co = cl as Obj;
    if (typeof co !== "object" || co === null) return;
    if (co.next !== undefined && (typeof co.next !== "string" || !clipIds.has(co.next))) {
      c.fail(`$.clips[${i}].next`, `unknown clip "${String(co.next)}"`);
    }
    const frames = Array.isArray(co.frames) ? (co.frames as Obj[]) : [];
    frames.forEach((f, j) => {
      const cancel = Array.isArray(f?.cancel) ? (f.cancel as Obj[]) : [];
      cancel.forEach((w, k) => {
        const into = (w?.into ?? {}) as Obj;
        for (const [action, target] of Object.entries(into)) {
          if (target !== "*" && typeof target === "string" && !clipIds.has(target)) {
            c.fail(`$.clips[${i}].frames[${j}].cancel[${k}].into.${action}`, `unknown clip "${target}"`);
          }
        }
      });
    });
  });

  if (o.defaults !== undefined) {
    const d = c.obj(o.defaults, "$.defaults");
    if (d) {
      c.unknownKeys(d, "$.defaults", ["hurtboxes"]);
      if (d.hurtboxes !== undefined) c.arr(d.hurtboxes, "$.defaults.hurtboxes")?.forEach((b, i) => checkBox(c, b, `$.defaults.hurtboxes[${i}]`));
    }
  }

  if (c.issues.length) throw new ContractError(source, c.issues);
  return o as unknown as SpritePackage;
}

export function isStandinManifest(json: unknown): json is StandinManifest {
  return typeof json === "object" && json !== null && (json as Obj).contract === SPRITE_CONTRACT && (json as Obj).standin === true;
}

/** Total ticks a frame occupies, holds included. */
export function frameTicks(f: Frame): number {
  return f.duration + (f.hold ?? 0);
}

export function parseColour(hex: Colour): [number, number, number] {
  const v = parseInt(hex.slice(1), 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}

// Zhusha's controller in Tesu: "a heavy hitter moving fast". Fast: full sprint in 7 ticks, a
// 3 H dash in a quarter second, jump / dash / Q on the press. Heavy: the weight is after contact
// (hitstop by weight, shake by trauma, knockback, cracks), and falls are 1.8x faster than rises.
// Every number is in feel.json (H units and ticks); the test room's numbers were the start (its
// code is scrapped). Her drawings come through the sprite contract (anims.ts): this file only
// decides which role plays and where in it she is (`anim`); draw.ts draws a slot's drawing or,
// with no pixel art for that role yet, the white box with the squash and lean kept here.
// A drawing's marks (apex, active, root motion, cancel windows) override feel.json's numbers for
// its move when present (timing.ts). Her body (drawn height, hurtbox, attack boxes) is H x charScale;
// her movement is in H and m/s, untouched by charScale (units.ts).
//
// The world (game.ts, court.ts, props.ts) talks to her through the same surface the lab's
// Player had: body, facing, hp, dead, ultCd, skillCd, checkpoint, update(), hit(),
// hitboxes(), hurtboxes(), and `clip` (the current swing: its hit groups, whether it hit).

import feelRaw from "./feel.json?raw";
import derivedRaw from "./derived.json?raw";
import type { HitBox } from "../../lab/contracts.ts";
import type { Action, Input } from "../../lab/engine/input.ts";
import type { SpawnOptions } from "../../lab/engine/vfx.ts";
import type { WorldBox } from "../../lab/game/events.ts";
import type { Body } from "../collide.ts";
import { H } from "../config.ts";
import { timeline, type AnimDef } from "./contract.ts";
import type { DerivedSlot, Rect } from "./derive.ts";
import { lockEase, lockTarget, resolveMove, windClock, type BreakDef, type HitDef, type MoveDef, type ResolvedMove, type Weight } from "./timing.ts";
import { UltDirector, type UltCtx, type UltPhase } from "./ult.ts";
import { UltForm, type FormCtx } from "./ultform.ts";
import { artPx, checkUnits, drawnH, runHps } from "./units.ts";

export interface FeelFile {
  charScale: number;
  units: { metresPerH: number };
  body: { collider: [number, number]; boxW: number; hurtW: number; hurtH: number; hp: number };
  run: { mps: number; ultMps: number; accelTicks: number; stopTicks: number; turnTicks: number; airAccelTicks: number; airStopTicks: number; stopAnimFrom: number; playRate: number; ultPlayRate: number };
  jump: { height: number; riseTicks: number; fallGravity: number; maxFall: number; cut: number; hangSpeed: number; hangGravity: number; coyote: number; buffer: number; airJumps: number; airJumpHeight: number; fastFall: number; fastFallMax: number };
  land: { squashFrom: number; heavyFrom: number; heavyShake: number };
  dash: {
    distance: number; ticks: number; rampTicks: number; curve: number; iframes: number; cooldown: number; airDashes: number; attackFrom: number; jumpCarry: number; keepRun: number;
    airHold: number; airGravity: number; skidFrom: number; skidDustEvery: number;
    clips: Record<string, { keys: Record<string, number>; skid: number }>;
  };
  buffer: { attack: number; skill: number; dash: number; chainGrace: number };
  weights: Record<Weight, { hitstop: number; shake: number; punch: number; flash: number }>;
  shakePx: number;
  hitstopCap: number;
  moves: Record<string, MoveDef>;
  windDown: { rate: number };
  q: { hold: number; flash: number; camZoom: number; camTicks: number; camLeave: number };
  e: { hold: number; flash: number; skidEvery: number; boltFrom: number; boltSpeed: number };
  hurt: { stun: number; kb: [number, number]; iframes: number; heavyFrom: number; freeze: number; heavyFreeze: number; friction: number };
  /** Her drawing's visual dip into the ground (art px) and the ground width looked at under her (drawn heights). */
  draw: { dip: number; foot: number; groundFx: string[]; groundFollow: string[]; groundDrape: string[] };
  knockdown: { ticks: number; kb: [number, number]; getUpFrom: number; iframes: number; bounce: number; friction: number };
  defeat: { ticks: number; fadeFrom: number };
  respawn: { ticks: number };
  ult: {
    /** The form's E (Dex 10-20: removed for now; true brings it back). */
    e?: boolean;
    callTicks: number; flurryTicks: number; flurryCuts: number; flurryReach: number; flurryDmg: number;
    riseTicks: number; riseHeight: number; zenithTicks: number; diveTicks: number; diveForward: number;
    impactRadius: number; impactDmg: number; impactKb: [number, number]; smokeTicks: number; transformTicks: number;
    revealTicks: number; formTicks: number; exitTicks: number; slowmoTicks: number; slowmo: number; zoomOut: number;
    cooldown: number; dmgMul: number; airDashes: number; ghostDelay: number; ghostReach: number; ghostDmg: number; superArmour: boolean;
  };
}

export const FEEL = JSON.parse(feelRaw) as FeelFile;
checkUnits(FEEL);
/** What tools/zhusha/derive.mjs read off her attack drawings (hit boxes, live drawings, planted-foot movement), by slot. */
export const DERIVED = (JSON.parse(derivedRaw) as { slots: Record<string, DerivedSlot> }).slots;

/**
 * A sound cue from her, for the audio lane to layer on (Dex 10-19: her calls and hits mixed AAA-style). `id` is the cue
 * name feel.sound always got (swing, hit, slam, dash, jump, djump, land, hurt, charge, wave, rise, ult; new: skid);
 * the rest says what made it. Fired on the derived frames: a move's hit ticks are its drawings' live drawings.
 */
export interface Cue {
  id: string;
  volume: number;
  /** The move or action: m1_1..m1_4, skill_q, e_tap, r (the ult), dash, jump, djump, land, hurt, knockdown. */
  move: string;
  /** windup (the press), swing (a hit's first tick), hit (it connected), boom (Q / E / R detonation, m1_4's slam),
   *  land, recoil (the kick back), move (dash, jump), hurt (she is hit), rise / reveal (R's beats). */
  phase: "windup" | "swing" | "hit" | "boom" | "land" | "recoil" | "move" | "hurt" | "rise" | "reveal";
  /** How big: light chain hit .. R. */
  tier: Weight;
  /** 0..1 from the tier (light .3, medium .5, heavy .7, q .9, ult 1). */
  intensity: number;
  /** In the ult form (the far more powerful register, Dex 10-16). */
  ult: boolean;
  /** Which hit of the move (0 first), when it is one. */
  hit?: number;
  /** The game tick (input.tick). */
  tick: number;
}

const INTENSITY: Record<Weight, number> = { light: 0.3, medium: 0.5, heavy: 0.7, q: 0.9, ult: 1 };

/** A hit as props.ts and court.ts take it, plus what it breaks (its origin and direction for a travelling wave). */
export interface ZHit extends HitBox {
  /** ox, dir: where the hit came from and which way (a wave travels out from ox); area: this box is the hit's reach. */
  brk?: BreakDef & { ox: number; dir: 1 | -1; area?: boolean };
  /** The FX v2 impact slash where it connects (court.ts, props.ts play it when the game has it). */
  fxHit?: string;
}

/** The game's sprite effects (fx/fx.ts, game.ts hands them over): FX v2's built effects. */
export interface ZFx {
  has(id: string): boolean;
  play(id: string, o: { x?: number; y?: number; facing?: number; attach?: "her" | "world"; delay?: number }): { stop(): void } | unknown;
}

/** Which impact slash each of her hits leaves (FX v2 PLAN: a light, b medium, c heavy, f pierce, g finisher, h ult form). */
export function impactSlash(move: string, weight: Weight, ult: boolean): string | undefined {
  if (move === "e_tap") return undefined;
  // (Dex 10-21: the form's drawings already carry its swirls) not h: its black first drawing, held through every hit's
  // freeze, blotted out her drawing; the light cuts read over it
  if (ult) return move === "m1_4" ? "impact_slash_g" : weight === "heavy" ? "impact_slash_c" : "impact_slash_a";
  if (move === "m1_3") return "impact_slash_f";
  if (move === "m1_4") return "impact_slash_g";
  return weight === "light" ? "impact_slash_a" : weight === "medium" ? "impact_slash_b" : "impact_slash_c";
}

/** H per second to world px per tick. */
const pt = (hps: number): number => (hps * H) / 60;
/** Her drawn body, world px (H x charScale): the box, the art, the hurtbox, the attack boxes. */
export const BODY_H = drawnH(FEEL, H);
/** World px per art px (128 px art at her drawn height). */
export const ART_PX = artPx(FEEL, H);

/** What the world gives her each tick: movement against its ground (collide.ts, a ride's car, a charm). */
export interface MoveWorld {
  move(b: Body, dx: number, dy: number): { landed: boolean };
  /** The ground at or below y at x (collide.ts has it; a ride's car or a charm does not). */
  groundBelow?(x: number, y: number): { y: number } | null;
}

/** Effects, feel and camera, as game.ts wires them. */
export interface ZhushaHost {
  vfx: { spawn(id: string, o: SpawnOptions): void };
  feel: { freeze(n: number): void; slowmo(f: number, d: number): void; impactFrame(m: "invert" | "mono", d: number): void; sound(id: string, v?: number): void; readonly reducedMotion: boolean };
  /** (W, H: the frame's size in frame px, for R's shots that keep its nuke in frame; tests may leave them out) */
  camera: { shake(a: number, d: number): void; zoomPunch(steps: number): void; readonly W?: number; readonly H?: number };
  /** Her foes' bodies now (world boxes: the court's champion), for m1_3's lock-on; none: she lunges straight. */
  foes?(): WorldBox[];
}

export type State = "free" | "dash" | "move" | "hurt" | "down" | "dead" | "ult" | "exit";
export type { UltPhase };

/** The current swing, as props.ts and court.ts read it (hit groups each target once; `hit` once it connected). */
export interface Swing {
  id: string;
  index: number;
  hitGroups: Map<string, Set<object>>;
  hit: boolean;
}

/** What draw.ts shows this tick: a role (slots.json), the tick into its clip, and the box's pose. */
export interface AnimState {
  role: string;
  t: number;
  /** For moves: the move's first hit tick (the clip's hit drawing is timed to land on it). */
  hitAt: number | null;
  /** For moves: the clip tick that shows on hitAt (undefined: the clip's own first marked hit). */
  clipHitAt?: number | null;
  /** World px travelled in this role (walk / run cycles with root motion are played by distance: no foot sliding). */
  dist?: number;
  /** Hidden (R's flurry: she is the cuts; the smoke). */
  hidden: boolean;
  /** R's flame / line (the box is drawn as one). */
  flame: number;
  /** The wind-down (Dex 10-16: back to idle slower than the windup): from anim tick `from` the clip plays at `rate`. */
  wind?: { from: number; rate: number };
}

interface Spring { v: number; vel: number }
const spring = (v = 1): Spring => ({ v, vel: 0 });
function stepSpring(s: Spring, target: number, k: number, damp: number): void {
  s.vel = (s.vel + (target - s.v) * k) * damp;
  s.v += s.vel;
}

interface Ghost { x: number; y: number; lean: number; life: number; max: number; ult: boolean }

const M1 = ["m1_1", "m1_2", "m1_3", "m1_4"] as const;
/** A move's return-to-rest role (slots.json), played after its own clip ends while she stands. */
const TAILS: Record<string, string | null> = { m1_1: "m1_1_ret", m1_2: "m1_2_ret", m1_3: "m1_3_ret", m1_4: "m1_4_ret", skill_q: null, e_tap: null };
const RETURNS = new Set(["m1_1_ret", "m1_2_ret", "m1_3_ret", "m1_4_ret", "run_stop", "dash"]);

export class Zhusha {
  readonly body: Body;
  facing: 1 | -1 = 1;
  hp: number;
  /** Ticks since the killing blow (0: alive). */
  dead = 0;
  ultCd = 0;
  skillCd = 0;
  eCd = 0;
  dashCd = 0;
  checkpoint: [number, number] = [0, 0];
  state: State = "free";
  /** Ticks in the current state. */
  t = 0;
  /** The ult form: ticks left (0: her base form). */
  form = 0;
  clip: Swing = { id: "", index: 0, hitGroups: new Map(), hit: false };
  anim: AnimState = { role: "idle", t: 0, hitAt: null, hidden: false, flame: 0 };
  readonly pose = { sx: spring(), sy: spring(), lean: spring(0), rot: spring(0), oy: spring(0) };
  ghosts: Ghost[] = [];
  /** Hurt flash ticks; invulnerable ticks. */
  flash = 0;
  invuln = 0;
  /** The Q's pull-out on the exploded area: the blast's middle, the move's start, ticks left. */
  private qCam: { x: number; x0: number; t: number } | null = null;
  /**
   * The E's bolt in flight (Worker B 10-21: Dex "you can tell she shot something but there's no collision or
   * explosion"): from her soles' x along `dir` on her palm's line `y`, its nose `FEEL.e.boltFrom + boltSpeed * t` art px
   * out (as e_bolt draws it); it bursts (e_hit) on the first foe it reaches, else at the end of its reach `len`.
   */
  private bolt: { x0: number; y: number; dir: 1 | -1; t: number; len: number; fx: { stop(): void } | null } | null = null;
  /** The last action taken (debug). */
  lastAction = "";
  /** R's phase (debug, drawing). */
  ultPhase: UltPhase | null = null;
  /** R's line: from the zenith to her (world px), while it fades. */
  streak: { x0: number; y0: number; x1: number; y1: number; life: number } | null = null;
  /** Ink / paint fade for defeat and respawn (0 = whole, 1 = gone). */
  ink = 0;
  /** R's smoke cloud after the impact (draw.ts), ticks into it and how long it lasts. */
  smoke: { x: number; y: number; t: number; life: number } | null = null;
  /** R, directed (ult.ts: the timeline, the camera's shots, the letterbox); the ult form's still idle and ghost blades (ultform.ts). */
  readonly r = new UltDirector();
  readonly uf = new UltForm();
  /** Set by the drawing side (anims.ts): has this anim's clip played out (true with no drawing)? Does a role have one? */
  clipDone: (a: AnimState, ult: boolean) => boolean = () => true;
  hasRole: (role: string, ult: boolean) => boolean = () => false;
  /** The drawing's anim.json for a role (its marks time the move), null for the white box. */
  clipOf: (role: string, ult: boolean) => AnimDef | null = () => null;
  /** The game's sprite effects (FX v2), when it has them: where one is built, it replaces the stand-in. */
  fx: ZFx | null = null;
  /** Plays a built effect if the game has it (true), else nothing (false: the caller draws its stand-in). */
  playFx(id: string, o: Parameters<ZFx["play"]>[1]): boolean {
    if (!this.fx?.has(id)) return false;
    this.fx.play(id, o);
    return true;
  }

  /** Plays a built effect and hands back its stop (null when the game does not have it). */
  private playFxHandle(id: string, o: Parameters<ZFx["play"]>[1]): { stop(): void } | null {
    if (!this.fx?.has(id)) return null;
    const h = this.fx.play(id, o) as { stop?: () => void } | undefined;
    return h && typeof h.stop === "function" ? { stop: () => h.stop!() } : { stop: () => {} };
  }

  /** The E's bolt, one tick: where its nose passes a foe it strikes there; at the end of its reach it bursts anyway. */
  private tickBolt(): void {
    const k = this.bolt;
    if (!k) return;
    const E = FEEL.e;
    const at = (t: number): number => Math.min(k.len, (E.boltFrom + E.boltSpeed * t) * ART_PX);
    // the stretch its nose covers on this tick's drawing (from the last drawing's nose to this one's)
    const a = k.t > 0 ? at(k.t - 1) : 0, z = at(k.t);
    k.t++;
    let hit: number | null = null;
    for (const fb of this.host.foes?.() ?? []) {
      if (k.y < fb.y || k.y > fb.y + fb.h) continue;
      const near = k.dir > 0 ? fb.x - k.x0 : k.x0 - (fb.x + fb.w);
      if (near + fb.w < a || near > z) continue;
      // a foe already over her muzzle is struck at the muzzle (never behind her)
      const d = Math.max(near, E.boltFrom * ART_PX);
      if (hit === null || d < hit) hit = d;
    }
    if (hit === null && z < k.len) return;
    const d = hit ?? k.len;
    k.fx?.stop();
    this.bolt = null;
    // the collision: the burst where it struck (a foe, else the end of its reach), every time
    this.playFx("e_hit", { x: k.x0 + k.dir * d, y: k.y, facing: k.dir });
    this.shake(hit === null ? 0.25 : 0.4);
  }

  /** Every sound cue with what made it (the audio lane listens here; feel.sound still gets id + volume). */
  onCue: ((c: Cue) => void) | null = null;
  /** The last cues (debug, tests, captures). */
  readonly cueLog: Cue[] = [];

  private host: ZhushaHost;
  /**
   * The move playing: `carry` is her speed along it that is not her planted foot's (a lunge's or recoil's, momentum);
   * `lock` is m1_3's lunge: from x0, `travel` px along the move, homing on a foe (`foe`, last seen centred at fx).
   */
  private move: {
    id: string; def: ResolvedMove; startX: number; startY: number; dir: 1 | -1; fxDone: Set<number>; landed: boolean; carry: number;
    lock: { x0: number; travel: number; foe: boolean; fx: number } | null;
  } | null = null;
  private moveStart = -9999;
  private chainIdx = -1;
  private chainEnd = -9999;
  private graceUntil = -1;
  private graceFrom = 0;
  private airJumps = 0;
  private coyote = 0;
  private cutDone = true;
  private airDashes = 0;
  private dashDir: 1 | -1 = 1;
  private dashProfile: number[];
  private fallSpeed = 0;
  private landT = 99;
  private lastLand = 0;
  private stopT = 99;
  private jumpT = 0;
  /** Ticks since she started falling (jump_arc's fall drawings). */
  fallT = 0;
  private wasRunning = false;
  private tick = 0;
  private lastHits = 0;
  private formSerial = 0;
  private ultC: (UltCtx & FormCtx) | null = null;
  private poseX: number | null = null;

  constructor(host: ZhushaHost, spawn: [number, number] = [0, 0]) {
    this.host = host;
    const [w, h] = FEEL.body.collider;
    this.body = { x: spawn[0], y: spawn[1], w, h, vx: 0, vy: 0, grounded: true, dropThrough: 0 };
    this.checkpoint = [spawn[0], spawn[1]];
    this.hp = FEEL.body.hp;
    this.dashProfile = Zhusha.profile();
  }

  /** The dash, tick by tick: two ticks to full burst, then an ease-out; the sum is the dash distance. */
  static profile(): number[] {
    const d = FEEL.dash;
    const n = d.ticks;
    const raw: number[] = [];
    for (let i = 0; i < n; i++) {
      const u0 = i / n, u1 = (i + 1) / n;
      const step = (1 - Math.pow(1 - u1, d.curve)) - (1 - Math.pow(1 - u0, d.curve));
      raw.push(step * Math.min(1, (i + 1) / (d.rampTicks + 1)));
    }
    const sum = raw.reduce((a, b) => a + b, 0);
    return raw.map((v) => (v / sum) * d.distance * H);
  }

  // --- the world's view of her ------------------------------------------------

  /** Run speed, world px per tick: 9 m/s, 11 m/s in the ult form (feel.json run.mps / ultMps). */
  get runSpeed(): number {
    return pt(runHps(FEEL, this.ultForm));
  }

  get ultForm(): boolean {
    return this.form > 0;
  }

  /** Her soles as drawn (her drawing sits feel.json draw.dip art px into the ground): effects anchored on her go there. */
  get soleY(): number {
    return this.body.y + FEEL.draw.dip * ART_PX;
  }

  /** The widest zoom the framing may show now (the Q's pull-out), null: the world's framing. R frames itself (ult.ts shots). */
  get camZoom(): number | null {
    return this.qCam ? FEEL.q.camZoom : null;
  }

  /** A world x the frame should centre on now (the Q's exploded area, kept with her), null: follow her. */
  get camAt(): number | null {
    const q = this.qCam;
    if (!q) return null;
    // the blast's middle, drifting with her as she moves off from where she struck
    return q.x + (this.body.x - q.x0) * 0.5;
  }

  /** Not hittable now (dash i-frames, R, defeat, respawn blink). */
  get iframes(): boolean {
    if (this.dead > 0 || this.invuln > 0 || this.state === "ult" || this.state === "exit") return true;
    return this.state === "dash" && this.t < FEEL.dash.iframes;
  }

  hurtboxes(): WorldBox[] {
    if (this.dead > 0 || this.anim.hidden) return [];
    const b = this.body, w = FEEL.body.hurtW * BODY_H, h = FEEL.body.hurtH * BODY_H;
    return [{ x: b.x - w / 2, y: b.y - h, w, h }];
  }

  /** Her hits active this tick, as world boxes with the lab's hit data (props.ts and court.ts take them). */
  hitboxes(): { box: WorldBox; hb: ZHit }[] {
    const out: { box: WorldBox; hb: ZHit }[] = [];
    if (this.state === "ult") return this.r.hitboxes(this.ultCtx());
    const m = this.move;
    if (this.state !== "move" || !m) return out;
    const t = this.t, ult = this.ultForm, U = FEEL.ult;
    m.def.hits.forEach((h, i) => {
      if (t >= h.at && t < h.at + h.len) out.push(...this.hitOf(h, `${this.clip.id}:${i}`, m, 1, ult ? U.dmgMul : 1, m.def.rects?.[t] ?? null, t === h.at));
      // the form's ghost: each M1 hit lands again a moment later, a little longer, at 60%
      if (ult && m.id.startsWith("m1_")) {
        const g = h.at + U.ghostDelay;
        if (t >= g && t < g + h.len) out.push(...this.hitOf(h, `${this.clip.id}:${i}:ghost`, m, U.ghostReach, U.dmgMul * U.ghostDmg, m.def.rects?.[t - U.ghostDelay] ?? null, false));
      }
    });
    return out;
  }

  /**
   * A hit's boxes this tick: the drawing's own (derived.json: the boxes over its slash, art px from her pivot) or, with
   * none, feel.json's box; plus, on its first tick, its break reach (the Q / E destruction band) when it has one.
   */
  private hitOf(h: HitDef, group: string, m: { startX: number; startY: number; dir: 1 | -1 }, reach: number, mul: number, rects: Rect[] | null, first: boolean): { box: WorldBox; hb: ZHit }[] {
    const f = h.anchor === "start" ? m.dir : this.facing;
    const ox = h.anchor === "start" ? m.startX : this.body.x;
    const oy = h.anchor === "start" ? m.startY : this.body.y;
    const K = BODY_H, A = ART_PX;
    const W = FEEL.weights[h.weight];
    const make = (box: WorldBox): { box: WorldBox; hb: ZHit } => ({
      box,
      hb: {
        ...box,
        damage: Math.round(h.dmg * mul),
        knockback: [pt(h.kb[0]), -pt(h.kb[1])],
        hitstop: Math.min(FEEL.hitstopCap, W.hitstop),
        group,
        heavy: h.weight === "heavy" || h.weight === "q" || h.weight === "ult",
        hitVfx: h.weight === "light" ? "hit.light" : "hit.heavy",
        brk: h.break ? { ...h.break, ox, dir: f } : undefined,
        fxHit: this.move ? impactSlash(this.move.id, h.weight, this.ultForm) : undefined,
      },
    });
    const out: { box: WorldBox; hb: ZHit }[] = [];
    if (rects) {
      // the drawing's boxes sit where the drawing is: on her, whatever the hit's anchor
      const bx = this.body.x, by = this.body.y, bf = this.facing;
      for (const [x0, y0, x1, y1] of rects) {
        const a = x0 * reach, b = x1 * reach;
        out.push(make({ x: bf > 0 ? bx + a * A : bx - b * A, y: by + y0 * A, w: (b - a) * A, h: (y1 - y0) * A }));
      }
    } else {
      const [fw, up, w0, hh] = h.box;
      const w = w0 * reach;
      out.push(make({ x: f > 0 ? ox + fw * K : ox - (fw + w) * K, y: oy - (up + hh) * K, w: w * K, h: hh * K }));
    }
    // the reach is a world effect (the Q's blast, the E's beam): world H, whatever her drawn size (charScale)
    const R = h.break?.reach;
    if (R && first) {
      const [fw, up, w, hh] = R;
      const r = make({ x: f > 0 ? ox + fw * H : ox - (fw + w) * H, y: oy - (up + hh) * H, w: w * H, h: hh * H });
      r.hb.brk = { ...r.hb.brk!, area: true };
      // a reach that only breaks never hurts (the champion takes the hit's own boxes); one that hurts shares the hit's
      // group, so a target in both is hit once
      if (!h.break?.damages) {
        r.hb.damage = 0;
        r.hb.group = `${group}:reach`;
      }
      out.push(r);
    }
    return out;
  }

  /** Her head from the soles (world px, facing right): the box's top; draw.ts swaps in a drawing's own. */
  headFromBox(): [number, number] {
    const lean = this.pose.lean.v;
    const h = BODY_H * this.pose.sy.v;
    return [lean * h, -h - 0.03 * BODY_H + this.pose.oy.v];
  }

  // --- taking hits ------------------------------------------------------------

  /** A hit on her: damage, which way it came from (+1: from her left, pushing right), knockback px/tick. */
  hit(damage: number, dir: number, kb?: [number, number]): boolean {
    if (this.iframes) return false;
    const s = this.host;
    this.hp = Math.max(0, this.hp - damage);
    this.flash = 10;
    this.cue("hurt", 1, "hurt", "hurt", damage >= FEEL.hurt.heavyFrom ? "heavy" : "light");
    s.vfx.spawn("hit.player", { x: this.body.x, y: this.body.y - 0.5 * H, facing: dir });
    if (this.hp <= 0) {
      this.startDefeat(dir);
      return true;
    }
    if (this.ultForm && FEEL.ult.superArmour) {
      // the form's super armour: it costs health and flashes, nothing moves her
      s.feel.freeze(4);
      return true;
    }
    const heavy = damage >= FEEL.hurt.heavyFrom;
    const f = dir >= 0 ? 1 : -1;
    this.facing = (-f) as 1 | -1;
    const K = heavy ? FEEL.knockdown.kb : FEEL.hurt.kb;
    this.body.vx = kb ? kb[0] * f : pt(K[0]) * f;
    this.body.vy = kb ? kb[1] : -pt(K[1]);
    this.body.grounded = false;
    this.move = null;
    this.qCam = null;
    this.setState(heavy ? "down" : "hurt");
    this.downBounced = false;
    this.invuln = heavy ? 0 : FEEL.hurt.iframes;
    // the weight of being hit (Dex 10-19: damage reactions read heavy): a long stop, a red flash, the frame kicked
    s.feel.freeze(heavy ? FEEL.hurt.heavyFreeze : FEEL.hurt.freeze);
    s.vfx.spawn("burst.red", { x: this.body.x, y: this.body.y - 0.55 * BODY_H, facing: dir, scale: heavy ? 1.4 : 1 });
    if (heavy) s.feel.impactFrame("invert", 2);
    this.shake(heavy ? 0.6 : 0.35);
    s.camera.zoomPunch(heavy ? 1 : 0.5);
    return true;
  }

  private startDefeat(dir: number): void {
    this.move = null;
    this.setState("dead");
    this.dead = 1;
    this.body.vx = pt(4) * (dir >= 0 ? 1 : -1);
    this.body.vy = -pt(4);
    this.body.grounded = false;
    this.host.feel.slowmo(0.4, 30);
    this.shake(0.6);
  }

  // --- the tick ---------------------------------------------------------------

  update(input: Input, world: MoveWorld): void {
    this.tick = input.tick;
    if (this.dashCd > 0) this.dashCd--;
    if (this.skillCd > 0) this.skillCd--;
    if (this.eCd > 0) this.eCd--;
    if (this.ultCd > 0) this.ultCd--;
    if (this.invuln > 0) this.invuln--;
    if (this.flash > 0) this.flash--;
    if (this.streak && --this.streak.life <= 0) this.streak = null;
    if (this.smoke && ++this.smoke.t >= this.smoke.life) this.smoke = null;
    for (const g of this.ghosts) g.life--;
    this.ghosts = this.ghosts.filter((g) => g.life > 0);
    this.t++;
    switch (this.state) {
      case "dead": this.tickDead(world); break;
      case "ult": this.r.tick(this.ultCtx(), input, world); break;
      case "exit": this.tickExit(world); break;
      case "hurt": this.tickHurt(input, world); break;
      case "down": this.tickDown(input, world); break;
      case "dash": this.tickDash(input, world); break;
      case "move": this.tickMove(input, world); break;
      default: this.tickFree(input, world); break;
    }
    this.tickBolt();
    if (this.form > 0 && this.state !== "ult" && this.state !== "exit" && --this.form === 0) this.startExit();
    this.r.after(this.state === "ult");
    this.uf.tick(this.ultCtx());
    // the Q's pull-out lets go when its time is up, or she has gone far from the blast, or R / defeat take the frame
    const q = this.qCam;
    if (q && (--q.t <= 0 || this.state === "ult" || this.dead > 0 || Math.abs(this.body.x - q.x) > FEEL.q.camLeave * H)) this.qCam = null;
    this.tickPose();
  }

  private setState(s: State): void {
    this.state = s;
    this.t = 0;
  }

  /** A press of `a` still alive: within its buffer, or made during the current move (kept until a window takes it). */
  private live(input: Input, a: Action, buf: number): boolean {
    const t = input.pressTick(a);
    if (t === undefined) return false;
    if (input.tick - t <= buf) return true;
    if ((this.state === "move" || this.state === "dash") && t >= this.moveStart) return true;
    return input.tick <= this.graceUntil && t >= this.graceFrom;
  }

  private gravityStep(input: Input, mul = 1): void {
    const J = FEEL.jump, b = this.body;
    const g0 = (2 * J.height * H) / (J.riseTicks * J.riseTicks);
    let g = g0 * mul;
    const held = input.isDown("jump");
    if (b.vy > 0) g *= J.fallGravity;
    if (!b.grounded && held && Math.abs(b.vy) < pt(J.hangSpeed)) g *= J.hangGravity;
    let max = pt(J.maxFall);
    if (!b.grounded && b.vy > -pt(J.hangSpeed) && input.isDown("down")) {
      g *= J.fastFall;
      max = pt(J.fastFallMax);
    }
    b.vy = Math.min(max, b.vy + g);
  }

  private moveBody(world: MoveWorld): boolean {
    const b = this.body;
    if (b.vy > 0) this.fallSpeed = b.vy;
    const { landed } = world.move(b, b.vx, b.vy);
    if (b.grounded) {
      this.coyote = FEEL.jump.coyote;
      this.airJumps = FEEL.jump.airJumps;
      this.airDashes = this.ultForm ? FEEL.ult.airDashes : FEEL.dash.airDashes;
    } else if (this.coyote > 0) this.coyote--;
    if (landed) this.onLand();
    return landed;
  }

  private onLand(): void {
    const hs = (this.fallSpeed * 60) / H; // H/s
    this.lastLand = hs;
    this.landT = 0;
    const L = FEEL.land, s = this.host;
    // the dust her soles blast out (Worker B 10-21, Dex: "Landing makes no sense with the effect"): on this tick, at
    // her soles on the floor, both ways along it, the bigger curl the way she travels (drawn facing right)
    const way = Math.abs(this.body.vx) > 0.5 ? (Math.sign(this.body.vx) as 1 | -1) : this.facing;
    if (hs >= L.heavyFrom) {
      this.shake(L.heavyShake + 0.1);
      if (!this.playFx("land_dust", { x: this.body.x, y: this.soleY, facing: way })) s.vfx.spawn("dust.land", { x: this.body.x, y: this.body.y, facing: 1 });
      this.cue("land", 1, "land", "land", "medium");
    } else if (hs >= L.squashFrom) {
      if (!this.playFx("land_dust_s", { x: this.body.x, y: this.soleY, facing: way })) s.vfx.spawn("dust.land", { x: this.body.x, y: this.body.y, facing: 1, scale: 0.6 });
      this.cue("land", 0.5, "land", "land", "light");
    }
    this.fallSpeed = 0;
  }

  // --- moving -----------------------------------------------------------------

  private tickFree(input: Input, world: MoveWorld): void {
    const b = this.body, R = FEEL.run, J = FEEL.jump, B = FEEL.buffer;
    const ax = input.axis();
    // actions out of free movement: R, Q, E, dash, attack (the latest press wins ties)
    if (this.tryUlt(input, world)) return;
    if (this.skillCd <= 0 && this.live(input, "skill", B.skill)) { input.consume("skill"); this.startMove("skill_q", input); return; }
    if (this.eReady(input) && this.live(input, "e", B.skill)) { input.consume("e"); this.startMove("e_tap", input); return; }
    if (this.dashReady() && this.live(input, "m2", B.dash)) { input.consume("m2"); this.startDash(input); return; }
    if (this.live(input, "m1", B.attack)) {
      input.consume("m1");
      const next = this.tick - this.chainEnd <= B.chainGrace && this.chainIdx >= 0 && this.chainIdx < 3 ? this.chainIdx + 1 : 0;
      this.startMove(M1[next]!, input);
      return;
    }
    // run
    const V = this.runSpeed;
    const target = ax * V;
    const turning = ax !== 0 && Math.sign(b.vx) === -ax;
    let rate: number;
    if (b.grounded) rate = ax !== 0 ? V / (turning ? R.turnTicks : R.accelTicks) : V / R.stopTicks;
    else rate = ax !== 0 ? V / R.airAccelTicks : V / R.airStopTicks;
    if (b.vx < target) b.vx = Math.min(target, b.vx + rate);
    else if (b.vx > target) b.vx = Math.max(target, b.vx - rate);
    if (ax !== 0) this.facing = ax as 1 | -1;
    if (turning && b.grounded && Math.abs(b.vx) > V * 0.6 && this.tick % 3 === 0) this.host.vfx.spawn("dust.kick", { x: b.x, y: b.y, facing: -ax });
    // jump
    if (this.live(input, "jump", J.buffer)) {
      const w1 = world as unknown as { onOneWay?: (b: Body) => boolean };
      if (input.isDown("down") && b.grounded && w1.onOneWay?.(b)) {
        b.dropThrough = 10;
        b.grounded = false;
        input.consume("jump");
      } else if (b.grounded || this.coyote > 0) {
        input.consume("jump");
        this.jump(J.height);
        this.host.vfx.spawn("dust.kick", { x: b.x, y: b.y, facing: this.facing });
        this.cue("jump", 0.8, "jump", "move", "light");
      } else if (this.airJumps > 0) {
        input.consume("jump");
        this.jump(J.airJumpHeight);
        this.airJumps--;
        this.host.vfx.spawn("jump.double", { x: b.x, y: b.y, facing: this.facing });
        this.cue("djump", 0.8, "djump", "move", "light");
      }
    }
    if (!this.cutDone && b.vy < 0 && !input.isDown("jump")) {
      b.vy *= J.cut;
      this.cutDone = true;
    }
    if (b.vy >= 0) this.cutDone = true;
    this.gravityStep(input);
    const before = b.vx, x0 = b.x;
    this.moveBody(world);
    this.jumpT++;
    this.fallT = !b.grounded && b.vy > 0 ? this.fallT + 1 : 0;
    // the run's own ending: she was running and let go on the ground
    const running = b.grounded && Math.abs(before) > pt(R.stopAnimFrom);
    if (b.grounded && ax === 0 && this.wasRunning) this.stopT = 0;
    else if (ax !== 0 || !b.grounded) this.stopT = 99;
    else this.stopT++;
    this.wasRunning = running && ax !== 0;
    this.locomotionAnim(ax, Math.abs(b.x - x0));
  }

  private jump(height: number): void {
    const J = FEEL.jump, b = this.body;
    const g0 = (2 * J.height * H) / (J.riseTicks * J.riseTicks);
    b.vy = -Math.sqrt(2 * g0 * height * H);
    b.grounded = false;
    this.coyote = 0;
    this.cutDone = false;
    this.jumpT = 0;
    this.pose.sy.v = 1.18;
    this.pose.sx.v = 0.86;
  }

  private locomotionAnim(ax: number, moved = 0): void {
    const b = this.body, a = this.anim;
    let role: string;
    if (!b.grounded) role = "jump";
    else if (this.landT < 10 && this.lastLand >= FEEL.land.squashFrom && Math.abs(b.vx) < this.runSpeed * 0.5) role = "jump";
    else if (Math.abs(b.vx) > this.runSpeed * 0.3 && ax !== 0) role = "run";
    else if (this.stopT < 40 && this.hasRole("run_stop", this.ultForm)) role = "run_stop"; // Dex 10-19: run_stop is out (no slot), the run cuts to idle
    else role = "idle";
    // a finished move's drawing plays out its wind-down (then its return to rest) while she stands, slower than its
    // windup (Dex 10-16: "the wind-down has to go back to idle state slower"); any input still takes her out of it
    if (role === "idle" && (TAILS[a.role] !== undefined || RETURNS.has(a.role))) {
      if (!this.clipDone(a, this.ultForm)) {
        a.t += a.wind?.rate ?? 1;
        return;
      }
      const ret = TAILS[a.role];
      if (ret && this.hasRole(ret, this.ultForm)) {
        const rate = a.wind?.rate ?? FEEL.windDown.rate;
        this.anim = { role: ret, t: 0, hitAt: null, hidden: false, flame: 0, wind: { from: 0, rate } };
        return;
      }
    }
    if (role !== a.role) {
      a.role = role;
      a.t = role === "jump" && b.grounded ? -1 : 0;
      a.hitAt = null;
      a.clipHitAt = undefined;
      a.dist = 0;
    }
    a.t++;
    a.dist = (a.dist ?? 0) + moved;
    a.hidden = false;
    a.flame = 0;
    if (b.grounded) this.landT++;
  }

  /** jump_arc's clock for draw.ts: rise, hold at the apex and fall drawings, then the settle after touchdown. */
  jumpPhase(): { phase: "rise" | "fall" | "land"; t: number } {
    const b = this.body;
    if (b.grounded) return { phase: "land", t: this.landT };
    return { phase: b.vy < 0 ? "rise" : "fall", t: this.jumpT };
  }

  /** The E is ready: off cooldown, and not in the ult form while its E is off (Dex 10-20: there a press is dropped). */
  private eReady(input: Input): boolean {
    if (this.ultForm && !FEEL.ult.e) {
      if (input.pressTick("e") !== undefined) input.consume("e");
      return false;
    }
    return this.eCd <= 0;
  }

  /** Does E do anything now (the finish blow asks too: in the form with its E off, E is nothing). */
  get eLive(): boolean {
    return !(this.ultForm && !FEEL.ult.e);
  }

  private dashReady(): boolean {
    return this.dashCd <= 0 && (this.body.grounded || this.airDashes > 0);
  }

  private startDash(input: Input): void {
    const ax = input.axis();
    if (ax !== 0) this.facing = ax as 1 | -1;
    this.dashDir = this.facing;
    if (!this.body.grounded) this.airDashes--;
    this.dashCd = FEEL.dash.ticks + FEEL.dash.cooldown;
    this.moveStart = input.tick;
    this.move = null;
    this.setState("dash");
    this.body.vy = 0;
    this.lastAction = "dash";
    this.anim = { role: "dash", t: 0, hitAt: null, hidden: false, flame: 0 };
    this.dashSkid = false;
    this.host.vfx.spawn("dash.speed", { x: this.body.x, y: this.body.y, facing: this.facing });
    this.cue("dash", 1, "dash", "move", "light");
    this.pose.sx.v = 1.3;
    this.pose.sy.v = 0.82;
  }

  /** The dash's skid has started (its dust and cue fire once). */
  private dashSkid = false;

  /**
   * The dash's drawing on the dash's clock (Dex 10-14: "a ground burst ... then a skid or plant to stop"): feel.json
   * dash.clips names, per slot, the dash tick each key drawing lands on (the burst on the speed's peak, the heel skid
   * as it bleeds off; the ult form's streak, then gone while she flies, reforming as she slows); between keys the clip
   * is stretched or squeezed, after the last it plays 1:1 (on into the tail while she stands). In the air the skid
   * drawings never show (she holds the glide). With no keys for the slot: 1:1.
   */
  dashClip(t: number, grounded: boolean): number {
    const clip = this.clipOf("dash", this.ultForm);
    const k = clip ? FEEL.dash.clips[clip.id] : undefined;
    if (!clip || !k) return t;
    const { starts } = timeline(clip.frames);
    const pts: [number, number][] = [[0, 0]];
    for (const [i, tick] of Object.entries(k.keys)) if (starts[+i] !== undefined) pts.push([tick, starts[+i]!]);
    pts.sort((a, b) => a[0] - b[0]);
    const last = pts[pts.length - 1]!;
    let c = last[1] + (t - last[0]);
    for (let j = 1; j < pts.length; j++) {
      const [t0, c0] = pts[j - 1]!, [t1, c1] = pts[j]!;
      if (t <= t1) { c = c0 + ((c1 - c0) * (t - t0)) / Math.max(1e-9, t1 - t0); break; }
    }
    const skidAt = starts[k.skid];
    if (!grounded && skidAt !== undefined) c = Math.min(c, skidAt - 0.01);
    return c;
  }

  private tickDash(input: Input, world: MoveWorld): void {
    const D = FEEL.dash, B = FEEL.buffer, b = this.body;
    const i = this.t - 1;
    this.anim.t = this.dashClip(this.t, b.grounded);
    if (this.t % 3 === 0) this.ghost(10);
    // out of the dash: R any time; attack, Q, E from attackFrom; a jump keeps most of its speed
    if (this.tryUlt(input, world)) return;
    if (this.t >= D.attackFrom) {
      if (this.skillCd <= 0 && this.live(input, "skill", B.skill)) { input.consume("skill"); this.startMove("skill_q", input); return; }
      if (this.eReady(input) && this.live(input, "e", B.skill)) { input.consume("e"); this.startMove("e_tap", input); return; }
      if (this.live(input, "m1", B.attack)) { input.consume("m1"); this.startMove("m1_1", input); return; }
    }
    if (this.t >= 3 && this.live(input, "jump", FEEL.jump.buffer) && (b.grounded || this.coyote > 0 || this.airJumps > 0)) {
      input.consume("jump");
      const v = Math.abs(b.vx);
      const carry = Math.max(this.runSpeed, Math.min(v * D.jumpCarry, this.runSpeed * 1.7));
      const air = !b.grounded && this.coyote <= 0;
      this.setState("free");
      this.jump(air ? FEEL.jump.airJumpHeight : FEEL.jump.height);
      if (air) this.airJumps--;
      b.vx = this.dashDir * carry;
      this.cue("jump", 0.8, "jump", "move", "light");
      this.moveBody(world);
      this.locomotionAnim(this.dashDir);
      return;
    }
    if (i >= this.dashProfile.length) {
      const held = input.axis() === this.dashDir;
      b.vx = held && D.keepRun > 0 ? this.dashDir * this.runSpeed * D.keepRun : this.dashDir * (this.dashProfile[this.dashProfile.length - 1] ?? 0);
      this.setState("free");
      this.wasRunning = held;
      this.locomotionAnim(held ? this.dashDir : 0);
      return;
    }
    b.vx = this.dashDir * this.dashProfile[i]!;
    const peak = Math.max(...this.dashProfile);
    if (b.grounded) {
      // the burst: dust off the driving foot; the skid: her heels bite as the speed bleeds off (Dex 10-14)
      if (i === D.rampTicks) this.host.vfx.spawn("dust.kick", { x: b.x, y: b.y, facing: -this.dashDir });
      if (this.dashProfile[i]! < D.skidFrom * peak) {
        if (!this.dashSkid) {
          this.dashSkid = true;
          this.cue("skid", 0.7, "dash", "move", "light");
          this.playFx("dust_roll_s", { x: b.x, y: this.soleY, facing: this.dashDir });
        }
        if (i % D.skidDustEvery === 0) this.host.vfx.spawn("dust.kick", { x: b.x, y: b.y, facing: this.dashDir });
      }
      // on the ground she stays on it (slopes)
      b.vy = 2;
    } else if (this.t <= D.airHold) b.vy = 0;
    // the air dash is a burst, not flight: after the hold, gravity comes back (gently) and she arcs into the fall
    else this.gravityStep(input, D.airGravity);
    this.moveBody(world);
  }

  // --- attacks, Q and E -----------------------------------------------------

  private startMove(id: string, input: Input): void {
    const feel = FEEL.moves[id];
    if (!feel) return;
    const clip = this.clipOf(id, this.ultForm);
    const def = resolveMove(feel, clip, ART_PX, { derived: clip ? DERIVED[clip.id] ?? null : null, windRate: FEEL.windDown.rate });
    const ax = input.axis();
    if (ax !== 0) this.facing = ax as 1 | -1;
    const b = this.body;
    // m1_3 locks onto a foe in reach (Dex 10-19): she turns to it and her lunge is aimed to stop at striking distance
    let lock: { x0: number; travel: number; foe: boolean; fx: number } | null = null;
    if (def.lock) {
      const foes = this.host.foes?.() ?? [];
      const L = lockTarget(b.x, b.y, this.facing, foes, def.lock, BODY_H);
      const f = foes[L.foe];
      if (f) this.facing = L.dir;
      lock = { x0: b.x, travel: L.travel, foe: !!f, fx: f ? f.x + f.w / 2 : 0 };
    }
    this.move = { id, def, startX: b.x, startY: b.y, dir: this.facing, fxDone: new Set(), landed: false, carry: def.inPlace || lock?.foe ? 0 : b.vx * this.facing, lock };
    this.moveStart = input.tick;
    this.clip = { id: `${id}#${input.tick}`, index: 0, hitGroups: new Map(), hit: false };
    this.lastHits = 0;
    this.setState("move");
    this.lastAction = id;
    const mi = M1.indexOf(id as (typeof M1)[number]);
    if (mi >= 0) this.chainIdx = mi;
    // the form's chain summons ghost blades on its hits (ultform.ts); it moves her as the normal chain does
    if (mi >= 0 && this.ultForm) this.uf.begin(mi, def.hits.map((h) => h.at), FEEL.ult.ghostDelay);
    if (id === "skill_q") this.skillCd = def.cooldown ?? 0;
    if (id === "e_tap") this.eCd = def.cooldown ?? 0;
    this.anim = { role: id, t: 0, hitAt: def.hits[0]?.at ?? null, clipHitAt: def.clipHitAt, hidden: false, flame: 0, wind: def.wind };
    // the finisher hops into its flip on the ground; from the air it plunges
    if (def.hop && b.grounded) {
      const g = ((2 * FEEL.jump.height * H) / (FEEL.jump.riseTicks * FEEL.jump.riseTicks)) * (def.airGravity ?? 1);
      b.vy = -Math.sqrt(2 * g * def.hop * H);
      b.grounded = false;
    }
    if (!b.grounded && !def.hop && b.vy > 0) b.vy *= 0.3;
    this.cue(id === "skill_q" ? "charge" : "swing", 0.7, id, "windup", def.hits[0]?.weight ?? "light");
  }

  private tickMove(input: Input, world: MoveWorld): void {
    const m = this.move!, def = m.def, t = this.t, b = this.body, B = FEEL.buffer;
    // the drawing's clock: 1:1 to the last hit, then the slower wind-down
    this.anim.t = windClock(t, def.wind);
    const connected = this.clip.hit || [...this.clip.hitGroups.values()].some((g) => g.size > 0);
    m.landed = connected;
    // effects on the move's own beats (they read even on air)
    def.hits.forEach((h, i) => {
      if (t === h.at && !m.fxDone.has(i)) {
        m.fxDone.add(i);
        this.swingFx(h, m, i);
      }
    });
    // windows
    const cancelAt = connected && def.hitCancelFrom !== undefined ? Math.min(def.cancelFrom, def.hitCancelFrom) : def.cancelFrom;
    if (this.tryUlt(input, world)) return;
    const mi = M1.indexOf(m.id as (typeof M1)[number]);
    if (mi >= 0 && mi < 3 && def.chainFrom !== undefined && t >= def.chainFrom && this.live(input, "m1", B.attack)) {
      input.consume("m1");
      this.startMove(M1[mi + 1]!, input);
      return;
    }
    if (t >= cancelAt) {
      if (this.skillCd <= 0 && m.id !== "skill_q" && this.live(input, "skill", B.skill)) { input.consume("skill"); this.startMove("skill_q", input); return; }
      if (this.eReady(input) && m.id !== "e_tap" && this.live(input, "e", B.skill)) { input.consume("e"); this.startMove("e_tap", input); return; }
      if (this.dashReady() && this.live(input, "m2", B.dash)) { input.consume("m2"); this.startDash(input); return; }
      if (this.live(input, "jump", FEEL.jump.buffer) && (b.grounded || this.coyote > 0)) {
        this.endMove(input);
        this.tickFree(input, world);
        return;
      }
    }
    if (t >= def.moveFrom && input.axis() !== 0) {
      this.endMove(input);
      this.tickFree(input, world);
      return;
    }
    if (t >= def.ticks) {
      this.endMove(input);
      this.tickFree(input, world);
      return;
    }
    // motion, along the move's direction: her planted foot (the drawing's root motion) plus the chain's push (Dex 10-19:
    // m1_1 and m1_2 lunge forward, m1_3 and the E recoil back, m1_4 in place); between pushes her speed bleeds off
    const rootV = def.root ? (def.root[t] ?? 0) : 0;
    let push: number | null = null;
    for (const l of def.lunge ?? []) if (t >= l.at && t < l.at + l.ticks) push = (l.dist * H) / l.ticks;
    const rc = def.recoil;
    if (rc && t >= rc[0] && t < rc[0] + rc[2]) push = -pt(rc[1]) * (1 - (t - rc[0]) / rc[2]);
    // m1_3's lunge: on its eased plan from where she started, re-aimed every tick at the locked foe
    const lk = def.lock, ml = m.lock;
    const homing = !!(lk && ml && ml.foe && t >= lk.at && t <= lk.at + lk.ticks);
    if (lk && ml && t >= lk.at && t < lk.at + lk.ticks) {
      if (ml.foe) {
        let best: WorldBox | null = null;
        for (const f of this.host.foes?.() ?? []) {
          const c = f.x + f.w / 2;
          if (Math.abs(c - ml.fx) < 2 * BODY_H && (!best || Math.abs(c - ml.fx) < Math.abs(best.x + best.w / 2 - ml.fx))) best = f;
        }
        if (best) {
          ml.fx = best.x + best.w / 2;
          const near = m.dir > 0 ? best.x - ml.x0 : ml.x0 - (best.x + best.w);
          ml.travel = Math.min(lk.maxDist * BODY_H, Math.max(0, near - lk.strike * BODY_H));
        }
      }
      const want = ml.x0 + m.dir * ml.travel * lockEase((t - lk.at + 1) / lk.ticks);
      push = (want - b.x) * m.dir - rootV;
    } else if (homing) push = -rootV;
    const wt = def.warpTicks ?? 3;
    if (m.id === "skill_q" && t <= wt) {
      // the Q's warp: 2.5 H in 3 ticks, then a dead stop
      m.carry = ((def.warp ?? 0) * H) / wt;
      if (t === 1) this.ghost(14);
    } else if (m.id === "skill_q" && t === wt + 1) m.carry *= 0.08;
    else if (def.inPlace || def.rootFrom === "marks") m.carry = 0;
    else if (push !== null) m.carry = push;
    else m.carry *= m.id === "skill_q" ? (b.grounded ? 0.6 : 0.85) : b.grounded ? 0.7 : 0.92;
    // the recoil's skid: dust under her feet while she slides back on the ground (and a cue as it starts)
    if (rc && push !== null && push < 0 && b.grounded && (t - rc[0]) % FEEL.e.skidEvery === 0) this.host.vfx.spawn("dust.kick", { x: b.x, y: b.y, facing: -m.dir });
    if (rc && t === rc[0]) {
      this.cue("skid", 0.8, m.id, "recoil", def.hits[0]?.weight ?? "medium");
      if (b.grounded) this.playFx("dust_roll_s", { x: b.x, y: this.soleY, facing: -m.dir });
    }
    // locked on, she stops dead at striking distance when the lunge is done
    if (lk && ml?.foe && t >= lk.at + lk.ticks) m.carry = 0;
    const along = rootV + m.carry;
    b.vx = m.dir * (connected && along > 0 && !homing ? along * 0.3 : along);
    if (m.id === "skill_q" && !b.grounded && t < (def.airHang ?? 0)) b.vy = 0;
    else if (m.id === "m1_4" && def.plunge && !b.grounded && t >= 6 && t < (def.hits[0]?.at ?? 13)) {
      // from the air the chop is a plunge: she drives down and it lands on touchdown
      b.vy = Math.max(b.vy, pt(def.plunge));
    } else this.gravityStep(input, def.airGravity ?? 1);
    const landed = this.moveBody(world);
    if (landed && m.id === "m1_4" && t < (def.hits[0]?.at ?? 13) && def.plunge) {
      // the plunge lands: the chop comes out now
      this.t = (def.hits[0]?.at ?? 13) - 1;
      this.anim.t = this.t;
    }
  }

  private endMove(input: Input): void {
    const m = this.move;
    if (m && M1.includes(m.id as (typeof M1)[number])) this.chainEnd = this.tick;
    this.graceUntil = input.tick + FEEL.buffer.chainGrace;
    this.graceFrom = this.moveStart;
    this.move = null;
    this.setState("free");
  }

  private swingFx(h: HitDef, m: { id: string; startX: number; startY: number; dir: 1 | -1 }, i: number): void {
    const s = this.host, b = this.body, f = this.facing;
    const at = (fw: number, up: number): SpawnOptions => ({ x: b.x + f * fw * BODY_H, y: b.y - up * BODY_H, facing: f });
    const ult = this.ultForm;
    const col = ult ? { colour: "#9fe4ff", edge: "#3a8fd8" } : {};
    // a traced drawing draws its own blade trail: the stand-in crescents step aside (impacts stay)
    const own = this.move ? this.hasRole(this.move.id, ult) : false;
    const trail = (id: string, o: SpawnOptions): void => { if (!own) s.vfx.spawn(id, o); };
    switch (h.fx) {
      case "slash_up": trail("smear.rise", { ...at(0.3, 0.55), ...col }); break;
      case "slash_down": trail("smear.cleave", { ...at(0.25, 0.6), ...col }); break;
      case "thrust": trail("streak.thrust", { ...at(0.5, 0.6), ...col }); break;
      case "thrust_big": trail("streak.thrust", { ...at(0.7, 0.62), scale: [1.6, 1.3], ...col }); break;
      case "chop":
        trail("smear.slam", { ...at(0.35, 0.6), ...col });
        // side-on (Dex 10-19: no destructive rings on the ground): the ground bursts up where the blade bites
        if (this.body.grounded) {
          s.vfx.spawn("debris.stone", at(0.9, 0));
          s.vfx.spawn("dust.land", at(0.9, 0));
        }
        this.cue("slam", 0.9, m.id, "boom", h.weight, i);
        break;
      case "shock":
        s.vfx.spawn("dust.land", at(1.2, 0));
        s.vfx.spawn("cracks", at(1.0, 0));
        this.shake(0.3);
        break;
      case "q_boom": {
        // the jumpscare (Dex 10-15): input to BOOM in a few ticks; the boom reads with or without a target: the frame
        // holds on it, flashes, and pulls out over the exploded area. Stand-in effects, side-on (Dex 10-19: no rings on
        // the ground) until lane B2's blast lands.
        const Q = FEEL.q;
        const cx = m.startX + m.dir * 1.9 * H;
        // the shockwave (Worker B 10-21, Dex: "a whole beam makes no sense, it's supposed to be a huge shockwave
        // forward"): q_wave runs along the floor from her blade, the booms / ignitions / her fire with it as parts;
        // pivot = her soles at the cast
        if (!this.playFx("q_wave", { x: b.x, y: this.soleY, facing: m.dir })) {
          s.vfx.spawn("burst.big", { x: cx, y: m.startY - 0.6 * H, facing: m.dir, scale: 1.6 });
          s.vfx.spawn("burst.red", { x: cx + m.dir * 1.2 * H, y: m.startY - 0.8 * H, facing: m.dir, scale: 1.5 });
          s.vfx.spawn("streak.markRed", { x: cx, y: m.startY - 0.55 * H, facing: m.dir, scale: [3, 1.4] });
          s.vfx.spawn("debris.stone", { x: cx, y: m.startY - 0.2 * H, facing: m.dir, scale: 1.4 });
          s.vfx.spawn("smoke.dark", { x: cx + m.dir * 0.8 * H, y: m.startY - 0.4 * H, facing: m.dir, scale: 1.6 });
        }
        this.cue("wave", 1, m.id, "boom", h.weight, i);
        s.feel.freeze(Q.hold);
        if (Q.flash > 0) s.feel.impactFrame("invert", Q.flash);
        this.shake(0.7);
        s.camera.zoomPunch(1);
        // the pull-out: centred on the blast's reach (its middle), held, then back to her framing
        const r = h.break?.reach;
        const mid = r ? (r[0] + r[2] / 2) * H : 4 * H;
        this.qCam = { x: m.startX + m.dir * mid, x0: b.x, t: Q.camTicks };
        break;
      }
      case "burn": s.vfx.spawn("embers.gold", { x: m.startX + m.dir * 1.9 * H, y: m.startY - 0.3 * H, facing: m.dir, scale: 1.5 }); break;
      case "rail": {
        // the E (Dex 10-19: Misaka's railgun): the tap fires; the frame holds a beat on the discharge, then she is
        // kicked back (feel.json e_tap.recoil). The beam is a stand-in streak along its reach until lane B2's lands.
        const E = FEEL.e;
        const r = h.break?.reach;
        const len = r ? r[2] * H : 8 * H;
        // FX v2: the muzzle blast (pivot = her soles at the cast), then the bolt flies (Worker B 10-21): e_bolt draws
        // it along her palm's line (82 art px up); tickBolt bursts e_hit where it strikes a foe or ends its reach
        const real = this.playFx("e_muzzle", { x: b.x, y: this.soleY, facing: f });
        if (real) {
          this.bolt?.fx?.stop();
          const reach = r ? (r[0] + r[2]) * H : len;
          this.bolt = { x0: b.x, y: this.soleY - 82 * ART_PX, dir: f, t: 0, len: reach, fx: this.playFxHandle("e_bolt", { x: b.x, y: this.soleY, facing: f }) };
        } else {
          s.vfx.spawn("streak.thrust", { x: b.x + f * ((r?.[0] ?? 0.3) * H + len / 2), y: b.y - 0.6 * BODY_H, facing: f, scale: [len / 168, 1.6], colour: "#8fdcff", edge: "#2a6fb8" });
          s.vfx.spawn("burst.hit", at(0.7, 0.6));
          s.vfx.spawn("sparks.hit", at(0.8, 0.6));
          s.vfx.spawn("dust.kick", { x: b.x, y: b.y, facing: -f });
        }
        s.feel.freeze(E.hold);
        if (E.flash > 0) s.feel.impactFrame("invert", E.flash);
        this.shake(0.45);
        s.camera.zoomPunch(1);
        this.cue("hit", 1, m.id, "boom", h.weight, i);
        break;
      }
      case "pillar":
        s.vfx.spawn("sparks.hit", at(0.9, 0.5));
        this.shake(0.3);
        this.cue("hit", 0.7, m.id, "swing", h.weight, i);
        break;
      default: trail("smear.cleave", at(0.3, 0.6));
    }
    if (h.fx !== "burn" && h.fx !== "shock" && h.fx !== "q_boom" && h.fx !== "rail" && h.fx !== "pillar") this.cue("swing", 0.6, m.id, "swing", h.weight, i);
  }

  /** After the world took her hits this tick (props.ts, court.ts): the weight of whatever connected. */
  afterHits(): void {
    let n = 0;
    for (const g of this.clip.hitGroups.values()) n += g.size;
    if (n <= this.lastHits) return;
    this.lastHits = n;
    const m = this.move;
    // R's weight is its own (ult.ts: the storm flows without hitstops, the nuke freezes once): here only the hit's cue
    if (this.state === "ult") {
      this.cue("hit", 0.6, "r", "hit", this.r.weight());
      return;
    }
    let w: Weight = "light";
    if (m) {
      const act = m.def.hits.filter((h) => this.t >= h.at && this.t < h.at + h.len + FEEL.ult.ghostDelay);
      const order: Weight[] = ["light", "medium", "heavy", "q", "ult"];
      for (const h of act) if (order.indexOf(h.weight) > order.indexOf(w)) w = h.weight;
    }
    const W = FEEL.weights[w], s = this.host;
    s.feel.freeze(Math.min(FEEL.hitstopCap, W.hitstop));
    this.shake(W.shake);
    if (W.punch > 0) s.camera.zoomPunch(W.punch);
    if (W.flash > 0) s.feel.impactFrame("invert", W.flash);
    const hi = m ? m.def.hits.findIndex((h) => this.t >= h.at && this.t < h.at + h.len + FEEL.ult.ghostDelay) : -1;
    this.cue("hit", w === "light" ? 0.6 : 1, m?.id ?? "?", "hit", w, hi >= 0 ? hi : undefined);
  }

  /** A sound cue: the old feel.sound(id, volume), plus the cue with what made it for the audio lane. */
  private cue(id: string, volume: number, move: string, phase: Cue["phase"], tier: Weight, hit?: number): void {
    this.host.feel.sound(id, volume);
    const c: Cue = { id, volume, move, phase, tier, intensity: INTENSITY[tier], ult: this.ultForm, tick: this.tick };
    if (hit !== undefined) c.hit = hit;
    this.cueLog.push(c);
    if (this.cueLog.length > 64) this.cueLog.shift();
    this.onCue?.(c);
  }

  /** Trauma 0..1: the frame moves by trauma squared. */
  private shake(trauma: number): void {
    const k = Math.min(1, trauma);
    this.host.camera.shake(Math.max(1, Math.round(k * k * FEEL.shakePx + k * 3)), Math.round(8 + 22 * k));
  }

  private ghost(life: number): void {
    // the afterimage is the white box's outline: with her drawing playing it reads as a blue rectangle (a primitive,
    // Dex 10-19), so it is only left for roles still drawn as the box (a drawn afterimage is the effects lane's)
    if (this.hasRole(this.anim.role, this.ultForm)) return;
    const b = this.body;
    this.ghosts.push({ x: b.x, y: b.y, lean: this.pose.lean.v, life, max: life, ult: this.ultForm });
  }

  // --- hurt, down, defeat -----------------------------------------------------

  private tickHurt(input: Input, world: MoveWorld): void {
    const b = this.body;
    this.anim.role = "hurt";
    this.anim.t = this.t;
    // knocked back, she skids: a longer slide on the ground, dust off her heels
    b.vx *= b.grounded ? FEEL.hurt.friction : 0.95;
    if (b.grounded && Math.abs(b.vx) > 1 && this.t % 3 === 0) this.host.vfx.spawn("dust.kick", { x: b.x, y: b.y, facing: Math.sign(b.vx) || 1 });
    this.gravityStep(input);
    this.moveBody(world);
    if (this.t >= FEEL.hurt.stun) this.setState("free");
  }

  /** The knockdown's first landing has bounced (she hits the ground, bounces once, then lies). */
  private downBounced = false;

  private tickDown(input: Input, world: MoveWorld): void {
    const b = this.body, K = FEEL.knockdown;
    this.anim.role = "knockdown";
    this.anim.t = this.t;
    b.vx *= b.grounded ? K.friction : 0.96;
    if (b.grounded && Math.abs(b.vx) > 1 && this.t % 3 === 0) this.host.vfx.spawn("dust.kick", { x: b.x, y: b.y, facing: Math.sign(b.vx) || 1 });
    this.gravityStep(input);
    const landed = this.moveBody(world);
    if (landed && !this.downBounced) {
      // the body hits the ground hard: a stop, a jolt, dust, and one low bounce
      this.downBounced = true;
      b.vy = -pt(K.bounce);
      b.grounded = false;
      this.host.feel.freeze(4);
      this.shake(0.4);
      this.host.vfx.spawn("dust.land", { x: b.x, y: b.y, facing: 1 });
      this.cue("land", 1, "knockdown", "land", "heavy");
      this.playFx("dust_roll_l", { x: b.x, y: this.soleY, facing: Math.sign(b.vx) || 1 });
    }
    const any = input.axis() !== 0 || input.pressTick("jump") !== undefined || input.pressTick("m1") !== undefined;
    if (this.t >= K.ticks || (this.t >= K.getUpFrom && any && b.grounded)) {
      this.setState("free");
      this.invuln = K.iframes;
    }
  }

  private tickDead(world: MoveWorld): void {
    const b = this.body, D = FEEL.defeat, Rs = FEEL.respawn;
    this.dead++;
    if (this.dead <= D.ticks) {
      this.anim.role = "defeat";
      this.anim.t = this.dead;
      b.vx *= b.grounded ? 0.8 : 0.96;
      b.vy = Math.min(pt(FEEL.jump.maxFall), b.vy + 0.6);
      world.move(b, b.vx, b.vy);
      this.ink = this.dead < D.fadeFrom ? 0 : Math.min(1, (this.dead - D.fadeFrom) / (D.ticks - D.fadeFrom));
      if (this.dead === D.ticks) {
        b.x = this.checkpoint[0];
        b.y = this.checkpoint[1];
        b.vx = b.vy = 0;
        this.hp = FEEL.body.hp;
        this.form = 0;
        this.facing = 1;
        world.move(b, 0, 1);
      }
      return;
    }
    const r = this.dead - D.ticks;
    this.anim.role = "respawn";
    this.anim.t = r;
    this.ink = Math.max(0, 1 - r / Rs.ticks);
    if (r >= Rs.ticks) {
      this.dead = 0;
      this.ink = 0;
      this.invuln = 60;
      this.setState("free");
      this.host.vfx.spawn("ring.halo", { x: b.x, y: b.y - 4, facing: 1, scale: 1.4 });
    }
  }

  // --- R ------------------------------------------------------------------------

  private tryUlt(input: Input, world: MoveWorld): boolean {
    if (this.live(input, "ult", FEEL.buffer.skill)) {
      if (this.ultForm) {
        // R again ends the form early
        input.consume("ult");
        this.startExit();
        return true;
      }
      if (this.ultCd > 0) return false;
      input.consume("ult");
      this.startUlt(world);
      return true;
    }
    return false;
  }

  private startUlt(world: MoveWorld): void {
    this.move = null;
    this.setState("ult");
    this.clip = { id: `r#${this.tick}`, index: 0, hitGroups: new Map(), hit: false };
    this.lastHits = 0;
    this.lastAction = "R";
    this.uf.clear();
    this.r.start(this.ultCtx(), world);
  }

  /** What R (ult.ts) and the form (ultform.ts) may do to her beyond her public fields. */
  private ultCtx(): UltCtx & FormCtx {
    const U = FEEL.ult;
    return (this.ultC ??= {
      z: this,
      host: this.host,
      bodyH: BODY_H,
      feel: { impactRadius: U.impactRadius, impactDmg: U.impactDmg, impactKb: U.impactKb, flurryDmg: U.flurryDmg, hitstop: FEEL.weights.ult.hitstop },
      shake: (k) => this.shake(k),
      ghost: (n) => this.ghost(n),
      foes: () => this.host.foes?.() ?? [],
      cue: (id, v, phase, move) => this.cue(id, v, move, phase, move === "r" ? "ult" : "heavy"),
      release: (input, world) => {
        this.ultPhase = null;
        this.setState("free");
        this.anim = { role: "idle", t: 0, hitAt: null, hidden: false, flame: 0 };
        // an R mashed during the cinematic must not end the form it just began
        input.consume("ult");
        this.tickFree(input, world);
      },
      enterForm: () => {
        this.form = U.formTicks;
        this.formSerial++;
        this.airDashes = U.airDashes;
      },
    });
  }

  private startExit(): void {
    this.form = 0;
    this.move = null;
    this.uf.clear();
    this.setState("exit");
    this.ultCd = FEEL.ult.cooldown;
    this.anim = { role: "uf_exit", t: 0, hitAt: null, hidden: false, flame: 0 };
    this.host.vfx.spawn("embers.gold", { x: this.body.x, y: this.body.y - 0.5 * H, facing: this.facing });
  }

  private tickExit(world: MoveWorld): void {
    const b = this.body;
    this.anim.t = this.t;
    b.vx *= 0.7;
    b.vy = Math.min(pt(FEEL.jump.maxFall), b.vy + 0.8);
    this.moveBody(world);
    if (this.t >= FEEL.ult.exitTicks) {
      this.setState("free");
      this.anim = { role: "idle", t: 0, hitAt: null, hidden: false, flame: 0 };
    }
  }

  // --- the opening drives her ----------------------------------------------------

  /** The opening's poses: a held still, her walk, her run (opening.ts moves her; only the drawing here). */
  posed(kind: "still" | "walk" | "run"): void {
    const role = kind === "still" ? "idle" : kind;
    if (this.anim.role !== role) this.anim = { role, t: 0, hitAt: null, hidden: false, flame: 0, dist: 0 };
    if (kind !== "still") this.anim.t++;
    this.anim.dist = (this.anim.dist ?? 0) + (this.poseX === null ? 0 : Math.abs(this.body.x - this.poseX));
    this.poseX = this.body.x;
    this.state = "free";
    this.tickPose();
  }

  // --- the box's procedural pose (squash, stretch, lean), sprung ----------------

  private tickPose(): void {
    const b = this.body, f = this.facing, p = this.pose, V = this.runSpeed;
    let sx = 1, sy = 1, lean = 0, rot = 0, oy = 0;
    const run = Math.min(1, Math.abs(b.vx) / V);
    switch (this.state) {
      case "free":
        if (!b.grounded) {
          const up = b.vy < 0;
          sy = up ? 1.08 : 1 + Math.min(0.12, b.vy / 80);
          sx = 2 - sy;
          lean = 0.12 * Math.sign(b.vx) * run;
        } else if (this.landT < 10 && this.lastLand > FEEL.land.squashFrom) {
          const k = Math.min(1, (this.lastLand - FEEL.land.squashFrom) / (FEEL.land.heavyFrom * 1.4)) * (1 - this.landT / 10);
          sy = 1 - 0.32 * k;
          sx = 1 + 0.3 * k;
        } else if (this.stopT < 14) lean = -0.14 * f * (1 - this.stopT / 14);
        else lean = 0.17 * Math.sign(b.vx) * run;
        break;
      case "dash":
        sx = 1.22;
        sy = 0.86;
        lean = 0.32 * this.dashDir;
        break;
      case "move": {
        const m = this.move!;
        const h0 = m.def.hits[0];
        const t = this.t;
        if (h0 && t < h0.at) {
          // the wind-up is short and low
          sy = 0.94;
          sx = 1.05;
          lean = -0.06 * f;
        } else if (h0 && t < h0.at + 6) {
          sy = 1.06;
          sx = 0.95;
          lean = (m.id === "e_tap" ? 0.12 : 0.24) * f;
        } else lean = 0.04 * f;
        if (m.id === "m1_4") {
          rot = h0 && t < h0.at ? -f * Math.PI * 2 * (t / h0.at) : 0;
          if (h0 && t >= h0.at && t < h0.at + 8) { sy = 0.8; sx = 1.25; }
        }
        if (m.id === "skill_q" && t <= (m.def.warpTicks ?? 3)) { sx = 1.6; sy = 0.7; lean = 0.4 * f; }
        if (m.id === "e_tap" && t >= 8 && t < 16) lean = -0.2 * f;
        break;
      }
      case "hurt":
        lean = -0.25 * f;
        sy = 0.92;
        break;
      case "down":
        rot = this.t < FEEL.knockdown.getUpFrom ? -f * Math.PI * 0.48 : -f * Math.PI * 0.48 * Math.max(0, 1 - (this.t - FEEL.knockdown.getUpFrom) / 14);
        oy = 0;
        break;
      case "dead":
        rot = -f * Math.PI * 0.5;
        break;
      case "ult":
        ({ sx, sy, lean, rot } = this.r.pose());
        break;
      default:
        break;
    }
    if (this.ultForm && this.state === "free" && b.grounded && Math.abs(b.vx) < 0.5) oy = -Math.round(Math.sin(this.tick * 0.08) * 1.5);
    stepSpring(p.sx, sx, 0.35, 0.62);
    stepSpring(p.sy, sy, 0.35, 0.62);
    stepSpring(p.lean, lean, 0.25, 0.7);
    if (this.state === "move" || this.state === "down" || this.state === "dead" || this.state === "ult") p.rot.v = rot;
    else stepSpring(p.rot, rot, 0.3, 0.6);
    stepSpring(p.oy, oy, 0.3, 0.6);
  }

  /** Debug. */
  debug(): Record<string, unknown> {
    return { state: this.state, t: this.t, role: this.anim.role, at: Math.round(this.anim.t), form: this.form, ult: this.ultPhase, last: this.lastAction, hp: this.hp };
  }
}

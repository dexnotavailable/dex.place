// Zhusha's controller in Tesu: "a heavy hitter moving fast". Fast: full sprint in 7 ticks, a
// 3 H dash in a quarter second, jump / dash / Q on the press. Heavy: the weight is after contact
// (hitstop by weight, shake by trauma, knockback, cracks), and falls are 1.8x faster than rises.
// Every number is in feel.json (H units and ticks); the test room's numbers were the start (its
// code is scrapped). Her drawings come through the sprite contract (anims.ts): this file only
// decides which role plays and where in it she is (`anim`); draw.ts draws a slot's drawing or,
// with no traced pixel art for that role yet, the white box with the squash and lean kept here.
//
// The world (game.ts, court.ts, props.ts) talks to her through the same surface the lab's
// Player had: body, facing, hp, dead, ultCd, skillCd, checkpoint, update(), hit(),
// hitboxes(), hurtboxes(), and `clip` (the current swing: its hit groups, whether it hit).

import feelRaw from "./feel.json?raw";
import type { HitBox } from "../../lab/contracts.ts";
import type { Action, Input } from "../../lab/engine/input.ts";
import type { SpawnOptions } from "../../lab/engine/vfx.ts";
import type { WorldBox } from "../../lab/game/events.ts";
import type { Body } from "../collide.ts";
import { H } from "../config.ts";

type Weight = "light" | "medium" | "heavy" | "q" | "ult";

interface HitDef {
  at: number;
  len: number;
  box: [number, number, number, number];
  anchor?: "start";
  dmg: number;
  weight: Weight;
  kb: [number, number];
  fx: string;
}

interface MoveDef {
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

export interface FeelFile {
  body: { collider: [number, number]; boxW: number; hurtW: number; hurtH: number; hp: number };
  run: { speed: number; accelTicks: number; stopTicks: number; turnTicks: number; airAccelTicks: number; airStopTicks: number; stopAnimFrom: number };
  jump: { height: number; riseTicks: number; fallGravity: number; maxFall: number; cut: number; hangSpeed: number; hangGravity: number; coyote: number; buffer: number; airJumps: number; airJumpHeight: number; fastFall: number; fastFallMax: number };
  land: { squashFrom: number; heavyFrom: number; heavyShake: number };
  dash: { distance: number; ticks: number; rampTicks: number; curve: number; iframes: number; cooldown: number; airDashes: number; attackFrom: number; jumpCarry: number; keepRun: number };
  buffer: { attack: number; skill: number; dash: number; chainGrace: number };
  weights: Record<Weight, { hitstop: number; shake: number; punch: number; flash: number }>;
  shakePx: number;
  hitstopCap: number;
  moves: Record<string, MoveDef>;
  hurt: { stun: number; kb: [number, number]; iframes: number; heavyFrom: number };
  knockdown: { ticks: number; kb: [number, number]; getUpFrom: number; iframes: number };
  defeat: { ticks: number; fadeFrom: number };
  respawn: { ticks: number };
  ult: {
    callTicks: number; flurryTicks: number; flurryCuts: number; flurryReach: number; flurryDmg: number;
    riseTicks: number; riseHeight: number; zenithTicks: number; diveTicks: number; diveForward: number;
    impactRadius: number; impactDmg: number; impactKb: [number, number]; smokeTicks: number; transformTicks: number;
    revealTicks: number; formTicks: number; exitTicks: number; slowmoTicks: number; slowmo: number; zoomOut: number;
    cooldown: number; dmgMul: number; airDashes: number; ghostDelay: number; ghostReach: number; ghostDmg: number; superArmour: boolean;
  };
}

export const FEEL = JSON.parse(feelRaw) as FeelFile;

/** H per second to world px per tick. */
const pt = (hps: number): number => (hps * H) / 60;

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
  camera: { shake(a: number, d: number): void; zoomPunch(steps: number): void };
}

export type State = "free" | "dash" | "move" | "hurt" | "down" | "dead" | "ult" | "exit";
export type UltPhase = "call" | "flurry" | "rise" | "zenith" | "dive" | "smoke" | "transform" | "reveal";

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
  /** Hidden (R's flurry: she is the cuts; the smoke). */
  hidden: boolean;
  /** R's flame / line (the box is drawn as one). */
  flame: number;
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
const RETURNS = new Set(["m1_1_ret", "m1_2_ret", "m1_3_ret", "m1_4_ret", "run_stop"]);

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
  /** R's camera pull-out (a zoom the framing should not exceed), null when none. */
  camZoom: number | null = null;
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
  /** Set by the drawing side (anims.ts): has this anim's clip played out (true with no drawing)? Does a role have one? */
  clipDone: (a: AnimState, ult: boolean) => boolean = () => true;
  hasRole: (role: string, ult: boolean) => boolean = () => false;

  private host: ZhushaHost;
  private move: { id: string; def: MoveDef; startX: number; startY: number; dir: 1 | -1; fxDone: Set<number>; landed: boolean } | null = null;
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
  private ult: { x0: number; y0: number; zx: number; zy: number; cut: number; fwd: number; floor: number } = { x0: 0, y0: 0, zx: 0, zy: 0, cut: 0, fwd: 0, floor: 0 };
  private formSerial = 0;

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

  get runSpeed(): number {
    return pt(FEEL.run.speed);
  }

  get ultForm(): boolean {
    return this.form > 0;
  }

  /** Not hittable now (dash i-frames, R, defeat, respawn blink). */
  get iframes(): boolean {
    if (this.dead > 0 || this.invuln > 0 || this.state === "ult" || this.state === "exit") return true;
    return this.state === "dash" && this.t < FEEL.dash.iframes;
  }

  hurtboxes(): WorldBox[] {
    if (this.dead > 0 || this.anim.hidden) return [];
    const b = this.body, w = FEEL.body.hurtW * H, h = FEEL.body.hurtH * H;
    return [{ x: b.x - w / 2, y: b.y - h, w, h }];
  }

  /** Her hits active this tick, as world boxes with the lab's hit data (props.ts and court.ts take them). */
  hitboxes(): { box: WorldBox; hb: HitBox }[] {
    const out: { box: WorldBox; hb: HitBox }[] = [];
    if (this.state === "ult") return this.ultHitboxes();
    const m = this.move;
    if (this.state !== "move" || !m) return out;
    const t = this.t, ult = this.ultForm, U = FEEL.ult;
    m.def.hits.forEach((h, i) => {
      if (t >= h.at && t < h.at + h.len) out.push(this.hitOf(h, `${this.clip.id}:${i}`, m, 1, ult ? U.dmgMul : 1));
      // the form's ghost: each M1 hit lands again a moment later, a little longer, at 60%
      if (ult && m.id.startsWith("m1_")) {
        const g = h.at + U.ghostDelay;
        if (t >= g && t < g + h.len) out.push(this.hitOf(h, `${this.clip.id}:${i}:ghost`, m, U.ghostReach, U.dmgMul * U.ghostDmg));
      }
    });
    return out;
  }

  private hitOf(h: HitDef, group: string, m: { startX: number; startY: number; dir: 1 | -1 }, reach: number, mul: number): { box: WorldBox; hb: HitBox } {
    const [fw, up, w0, hh] = h.box;
    const w = w0 * reach;
    const f = h.anchor === "start" ? m.dir : this.facing;
    const ox = h.anchor === "start" ? m.startX : this.body.x;
    const oy = h.anchor === "start" ? m.startY : this.body.y;
    const x = f > 0 ? ox + fw * H : ox - (fw + w) * H;
    const box = { x, y: oy - (up + hh) * H, w: w * H, h: hh * H };
    const W = FEEL.weights[h.weight];
    const hb: HitBox = {
      ...box,
      damage: Math.round(h.dmg * mul),
      knockback: [pt(h.kb[0]), -pt(h.kb[1])],
      hitstop: Math.min(FEEL.hitstopCap, W.hitstop),
      group,
      heavy: h.weight === "heavy" || h.weight === "q" || h.weight === "ult",
      hitVfx: h.weight === "light" ? "hit.light" : "hit.heavy",
    };
    return { box, hb };
  }

  private ultHitboxes(): { box: WorldBox; hb: HitBox }[] {
    const U = FEEL.ult, b = this.body;
    if (this.ultPhase === "flurry") {
      // each cut a light hit in front of her
      const per = U.flurryTicks / U.flurryCuts;
      const cut = Math.floor(this.t / per);
      if (cut >= U.flurryCuts || this.t - cut * per >= 2) return [];
      const f = this.facing;
      const x = f > 0 ? this.ult.x0 + 0.1 * H : this.ult.x0 - (0.1 + U.flurryReach) * H;
      const box = { x, y: this.ult.y0 - 1.5 * H, w: U.flurryReach * H, h: 1.5 * H };
      return [{ box, hb: { ...box, damage: U.flurryDmg, knockback: [pt(0.6), -pt(0.4)], hitstop: 2, group: `r-cut-${cut}`, hitVfx: "hit.light" } }];
    }
    if (this.ultPhase === "smoke" && this.t < 2) {
      const R = U.impactRadius * H;
      const box = { x: b.x - R, y: b.y - 6 * H, w: 2 * R, h: 7 * H };
      return [{ box, hb: { ...box, damage: U.impactDmg, knockback: [pt(U.impactKb[0]), -pt(U.impactKb[1])], hitstop: FEEL.weights.ult.hitstop, group: "r", heavy: true, hitVfx: "hit.heavy" } }];
    }
    return [];
  }

  /** Her head from the soles (world px, facing right): the box's top; draw.ts swaps in a drawing's own. */
  headFromBox(): [number, number] {
    const lean = this.pose.lean.v;
    const h = H * this.pose.sy.v;
    return [lean * h, -h - 0.03 * H + this.pose.oy.v];
  }

  // --- taking hits ------------------------------------------------------------

  /** A hit on her: damage, which way it came from (+1: from her left, pushing right), knockback px/tick. */
  hit(damage: number, dir: number, kb?: [number, number]): boolean {
    if (this.iframes) return false;
    const s = this.host;
    this.hp = Math.max(0, this.hp - damage);
    this.flash = 10;
    s.feel.sound("hurt");
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
    this.setState(heavy ? "down" : "hurt");
    this.invuln = heavy ? 0 : FEEL.hurt.iframes;
    s.feel.freeze(heavy ? 9 : 5);
    this.shake(heavy ? 0.5 : 0.25);
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
      case "ult": this.tickUlt(input, world); break;
      case "exit": this.tickExit(world); break;
      case "hurt": this.tickHurt(input, world); break;
      case "down": this.tickDown(input, world); break;
      case "dash": this.tickDash(input, world); break;
      case "move": this.tickMove(input, world); break;
      default: this.tickFree(input, world); break;
    }
    if (this.form > 0 && this.state !== "ult" && this.state !== "exit" && --this.form === 0) this.startExit();
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
    if (hs >= L.heavyFrom) {
      this.shake(L.heavyShake + 0.1);
      s.vfx.spawn("dust.land", { x: this.body.x, y: this.body.y, facing: 1 });
      s.vfx.spawn("ring.dust", { x: this.body.x, y: this.body.y, facing: 1 });
      s.feel.sound("land", 1);
    } else if (hs >= L.squashFrom) {
      s.vfx.spawn("dust.land", { x: this.body.x, y: this.body.y, facing: 1, scale: 0.6 });
      s.feel.sound("land", 0.5);
    }
    this.fallSpeed = 0;
  }

  // --- moving -----------------------------------------------------------------

  private tickFree(input: Input, world: MoveWorld): void {
    const b = this.body, R = FEEL.run, J = FEEL.jump, B = FEEL.buffer;
    const ax = input.axis();
    // actions out of free movement: R, Q, E, dash, attack (the latest press wins ties)
    if (this.tryUlt(input)) return;
    if (this.skillCd <= 0 && this.live(input, "skill", B.skill)) { input.consume("skill"); this.startMove("skill_q", input); return; }
    if (this.eCd <= 0 && this.live(input, "e", B.skill)) { input.consume("e"); this.startMove("e_tap", input); return; }
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
        this.host.feel.sound("jump", 0.8);
      } else if (this.airJumps > 0) {
        input.consume("jump");
        this.jump(J.airJumpHeight);
        this.airJumps--;
        this.host.vfx.spawn("jump.double", { x: b.x, y: b.y, facing: this.facing });
        this.host.feel.sound("djump", 0.8);
      }
    }
    if (!this.cutDone && b.vy < 0 && !input.isDown("jump")) {
      b.vy *= J.cut;
      this.cutDone = true;
    }
    if (b.vy >= 0) this.cutDone = true;
    this.gravityStep(input);
    const before = b.vx;
    this.moveBody(world);
    this.jumpT++;
    this.fallT = !b.grounded && b.vy > 0 ? this.fallT + 1 : 0;
    // the run's own ending: she was running and let go on the ground
    const running = b.grounded && Math.abs(before) > pt(R.stopAnimFrom);
    if (b.grounded && ax === 0 && this.wasRunning) this.stopT = 0;
    else if (ax !== 0 || !b.grounded) this.stopT = 99;
    else this.stopT++;
    this.wasRunning = running && ax !== 0;
    this.locomotionAnim(ax);
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

  private locomotionAnim(ax: number): void {
    const b = this.body, a = this.anim;
    let role: string;
    if (!b.grounded) role = "jump";
    else if (this.landT < 10 && this.lastLand >= FEEL.land.squashFrom && Math.abs(b.vx) < this.runSpeed * 0.5) role = "jump";
    else if (Math.abs(b.vx) > this.runSpeed * 0.3 && ax !== 0) role = "run";
    else if (this.stopT < 40) role = "run_stop";
    else role = "idle";
    // a finished move's drawing plays out its wind-down (then its return to rest) while she stands
    if (role === "idle" && (TAILS[a.role] !== undefined || RETURNS.has(a.role))) {
      if (!this.clipDone(a, this.ultForm)) {
        a.t++;
        return;
      }
      const ret = TAILS[a.role];
      if (ret && this.hasRole(ret, this.ultForm)) {
        this.anim = { role: ret, t: 0, hitAt: null, hidden: false, flame: 0 };
        return;
      }
    }
    if (role !== a.role) {
      a.role = role;
      a.t = role === "jump" && b.grounded ? -1 : 0;
      a.hitAt = null;
    }
    a.t++;
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
    this.host.vfx.spawn("dash.speed", { x: this.body.x, y: this.body.y, facing: this.facing });
    this.host.feel.sound("dash", 1);
    this.pose.sx.v = 1.3;
    this.pose.sy.v = 0.82;
  }

  private tickDash(input: Input, world: MoveWorld): void {
    const D = FEEL.dash, B = FEEL.buffer, b = this.body;
    const i = this.t - 1;
    this.anim.t++;
    if (this.t % 3 === 0) this.ghost(10);
    // out of the dash: R any time; attack, Q, E from attackFrom; a jump keeps most of its speed
    if (this.tryUlt(input)) return;
    if (this.t >= D.attackFrom) {
      if (this.skillCd <= 0 && this.live(input, "skill", B.skill)) { input.consume("skill"); this.startMove("skill_q", input); return; }
      if (this.eCd <= 0 && this.live(input, "e", B.skill)) { input.consume("e"); this.startMove("e_tap", input); return; }
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
      this.host.feel.sound("jump", 0.8);
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
    // on the ground she stays on it (slopes); in the air she holds her height
    b.vy = b.grounded ? 2 : 0;
    this.moveBody(world);
  }

  // --- attacks, Q and E -----------------------------------------------------

  private startMove(id: string, input: Input): void {
    const def = FEEL.moves[id];
    if (!def) return;
    const ax = input.axis();
    if (ax !== 0) this.facing = ax as 1 | -1;
    const b = this.body;
    this.move = { id, def, startX: b.x, startY: b.y, dir: this.facing, fxDone: new Set(), landed: false };
    this.moveStart = input.tick;
    this.clip = { id: `${id}#${input.tick}`, index: 0, hitGroups: new Map(), hit: false };
    this.lastHits = 0;
    this.setState("move");
    this.lastAction = id;
    const mi = M1.indexOf(id as (typeof M1)[number]);
    if (mi >= 0) this.chainIdx = mi;
    if (id === "skill_q") this.skillCd = def.cooldown ?? 0;
    if (id === "e_tap") this.eCd = def.cooldown ?? 0;
    this.anim = { role: id, t: 0, hitAt: def.hits[0]?.at ?? null, hidden: false, flame: 0 };
    // the finisher hops into its flip on the ground; from the air it plunges
    if (def.hop && b.grounded) {
      const g = ((2 * FEEL.jump.height * H) / (FEEL.jump.riseTicks * FEEL.jump.riseTicks)) * (def.airGravity ?? 1);
      b.vy = -Math.sqrt(2 * g * def.hop * H);
      b.grounded = false;
    }
    if (!b.grounded && !def.hop && b.vy > 0) b.vy *= 0.3;
    this.host.feel.sound(id === "skill_q" ? "charge" : "swing", 0.7);
  }

  private tickMove(input: Input, world: MoveWorld): void {
    const m = this.move!, def = m.def, t = this.t, b = this.body, B = FEEL.buffer;
    this.anim.t++;
    const connected = this.clip.hit || [...this.clip.hitGroups.values()].some((g) => g.size > 0);
    m.landed = connected;
    // effects on the move's own beats (they read even on air)
    def.hits.forEach((h, i) => {
      if (t === h.at && !m.fxDone.has(i)) {
        m.fxDone.add(i);
        this.swingFx(h, m);
      }
    });
    // windows
    const cancelAt = connected && def.hitCancelFrom !== undefined ? Math.min(def.cancelFrom, def.hitCancelFrom) : def.cancelFrom;
    if (this.tryUlt(input)) return;
    const mi = M1.indexOf(m.id as (typeof M1)[number]);
    if (mi >= 0 && mi < 3 && def.chainFrom !== undefined && t >= def.chainFrom && this.live(input, "m1", B.attack)) {
      input.consume("m1");
      this.startMove(M1[mi + 1]!, input);
      return;
    }
    if (t >= cancelAt) {
      if (this.skillCd <= 0 && m.id !== "skill_q" && this.live(input, "skill", B.skill)) { input.consume("skill"); this.startMove("skill_q", input); return; }
      if (this.eCd <= 0 && m.id !== "e_tap" && this.live(input, "e", B.skill)) { input.consume("e"); this.startMove("e_tap", input); return; }
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
    // motion
    let lungeV = 0;
    for (const l of def.lunge ?? []) if (t >= l.at && t < l.at + l.ticks) lungeV = (l.dist * H) / l.ticks;
    if (m.id === "skill_q") {
      // the warp: 2.5 H in 3 ticks, then a dead stop; in the air she hangs a moment
      const wt = def.warpTicks ?? 3;
      if (t <= wt) {
        b.vx = (m.dir * (def.warp ?? 0) * H) / wt;
        if (t === 1) this.ghost(14);
      } else if (t === wt + 1) b.vx *= 0.08;
      else b.vx *= b.grounded ? 0.6 : 0.85;
      if (!b.grounded && t < (def.airHang ?? 0)) b.vy = 0;
      else this.gravityStep(input, def.airGravity ?? 1);
    } else if (m.id === "e_tap") {
      const [at, sp, rt] = def.recoil ?? [8, 11, 12];
      if (t >= at && t < at + rt) b.vx = -m.dir * pt(sp) * (1 - (t - at) / rt);
      else b.vx = lungeV ? m.dir * lungeV : b.vx * (b.grounded ? 0.7 : 0.92);
      this.gravityStep(input, def.airGravity ?? 1);
    } else {
      b.vx = lungeV ? this.facing * lungeV : b.vx * (b.grounded ? 0.7 : 0.92);
      if (connected && b.vx * this.facing > 0) b.vx *= 0.3;
      if (m.id === "m1_4" && def.plunge && !b.grounded && t >= 6 && t < (def.hits[0]?.at ?? 13)) {
        // from the air the chop is a plunge: she drives down and it lands on touchdown
        b.vy = Math.max(b.vy, pt(def.plunge));
      } else this.gravityStep(input, def.airGravity ?? 1);
    }
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

  private swingFx(h: HitDef, m: { startX: number; startY: number; dir: 1 | -1 }): void {
    const s = this.host, b = this.body, f = this.facing;
    const at = (fw: number, up: number): SpawnOptions => ({ x: b.x + f * fw * H, y: b.y - up * H, facing: f });
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
        if (this.body.grounded) s.vfx.spawn("slam.ground", at(0.9, 0));
        s.feel.sound("slam", 0.9);
        break;
      case "shock":
        s.vfx.spawn("ring.dust", at(1.2, 0));
        s.vfx.spawn("cracks", at(1.0, 0));
        this.shake(0.3);
        break;
      case "q_boom": {
        // the whole stroke detonates on the press: the boom reads with or without a target
        const cx = m.startX + m.dir * 1.9 * H;
        s.vfx.spawn("q.wave", { x: cx, y: m.startY, facing: m.dir });
        s.vfx.spawn("burst.big", { x: cx, y: m.startY - 0.6 * H, facing: m.dir, scale: 1.6 });
        s.vfx.spawn("ring.wide", { x: cx, y: m.startY - 0.3 * H, facing: m.dir, scale: [1.8, 0.8] });
        s.vfx.spawn("streak.markRed", { x: cx, y: m.startY - 0.55 * H, facing: m.dir, scale: [3, 1.4] });
        s.vfx.spawn("cracks", { x: cx, y: m.startY, facing: m.dir, scale: 1.4 });
        s.feel.sound("wave", 1);
        this.shake(0.45);
        s.camera.zoomPunch(1);
        break;
      }
      case "burn": s.vfx.spawn("embers.gold", { x: m.startX + m.dir * 1.9 * H, y: m.startY - 0.3 * H, facing: m.dir, scale: 1.5 }); break;
      case "palm":
        s.vfx.spawn("burst.hit", at(0.9, 0.6));
        s.vfx.spawn("ring.small", at(1.0, 0.6));
        s.feel.sound("hit", 0.8);
        break;
      default: trail("smear.cleave", at(0.3, 0.6));
    }
    if (h.fx !== "burn" && h.fx !== "shock" && h.fx !== "q_boom") s.feel.sound("swing", 0.6);
  }

  /** After the world took her hits this tick (props.ts, court.ts): the weight of whatever connected. */
  afterHits(): void {
    let n = 0;
    for (const g of this.clip.hitGroups.values()) n += g.size;
    if (n <= this.lastHits) return;
    this.lastHits = n;
    const m = this.move;
    let w: Weight = "light";
    if (this.state === "ult") w = this.ultPhase === "flurry" ? "light" : "ult";
    else if (m) {
      const act = m.def.hits.filter((h) => this.t >= h.at && this.t < h.at + h.len + FEEL.ult.ghostDelay);
      const order: Weight[] = ["light", "medium", "heavy", "q", "ult"];
      for (const h of act) if (order.indexOf(h.weight) > order.indexOf(w)) w = h.weight;
    }
    const W = FEEL.weights[w], s = this.host;
    s.feel.freeze(Math.min(FEEL.hitstopCap, W.hitstop));
    this.shake(W.shake);
    if (W.punch > 0) s.camera.zoomPunch(W.punch);
    if (W.flash > 0) s.feel.impactFrame("invert", W.flash);
    s.feel.sound("hit", w === "light" ? 0.6 : 1);
  }

  /** Trauma 0..1: the frame moves by trauma squared. */
  private shake(trauma: number): void {
    const k = Math.min(1, trauma);
    this.host.camera.shake(Math.max(1, Math.round(k * k * FEEL.shakePx + k * 3)), Math.round(8 + 22 * k));
  }

  private ghost(life: number): void {
    const b = this.body;
    this.ghosts.push({ x: b.x, y: b.y, lean: this.pose.lean.v, life, max: life, ult: this.ultForm });
  }

  // --- hurt, down, defeat -----------------------------------------------------

  private tickHurt(input: Input, world: MoveWorld): void {
    const b = this.body;
    this.anim.role = "hurt";
    this.anim.t = this.t;
    b.vx *= b.grounded ? 0.8 : 0.95;
    this.gravityStep(input);
    this.moveBody(world);
    if (this.t >= FEEL.hurt.stun) this.setState("free");
  }

  private tickDown(input: Input, world: MoveWorld): void {
    const b = this.body, K = FEEL.knockdown;
    this.anim.role = "knockdown";
    this.anim.t = this.t;
    b.vx *= b.grounded ? 0.8 : 0.96;
    this.gravityStep(input);
    this.moveBody(world);
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

  private tryUlt(input: Input): boolean {
    if (this.live(input, "ult", FEEL.buffer.skill)) {
      if (this.ultForm) {
        // R again ends the form early
        input.consume("ult");
        this.startExit();
        return true;
      }
      if (this.ultCd > 0) return false;
      input.consume("ult");
      this.startUlt();
      return true;
    }
    return false;
  }

  private startUlt(): void {
    const b = this.body, s = this.host;
    this.move = null;
    this.setState("ult");
    this.ultPhase = "call";
    this.ult = { x0: b.x, y0: b.y, zx: b.x, zy: b.y, cut: -1, fwd: 0, floor: b.y };
    this.clip = { id: `r#${this.tick}`, index: 0, hitGroups: new Map(), hit: false };
    this.lastHits = 0;
    this.lastAction = "R";
    b.vx = 0;
    b.vy = 0;
    this.anim = { role: "r_call", t: 0, hitAt: null, hidden: false, flame: 0 };
    s.vfx.spawn("r.call", { x: b.x, y: b.y, facing: this.facing });
    s.feel.sound("charge", 1);
    s.camera.zoomPunch(1);
  }

  private nextPhase(p: UltPhase): void {
    this.ultPhase = p;
    this.t = 0;
  }

  private tickUlt(input: Input, world: MoveWorld): void {
    const U = FEEL.ult, b = this.body, s = this.host, f = this.facing;
    const t = this.t;
    switch (this.ultPhase) {
      case "call": {
        this.anim = { role: "r_call", t, hitAt: null, hidden: false, flame: Math.min(1, t / U.callTicks) * 0.4 };
        b.vx = 0;
        b.vy = 0;
        if (t % 6 === 0) s.vfx.spawn("embers.gold", { x: b.x, y: b.y - 0.4 * H, facing: f });
        if (t >= U.callTicks) {
          this.nextPhase("flurry");
          this.ult.x0 = b.x;
          this.ult.y0 = b.y;
          s.vfx.spawn("burst.red", { x: b.x, y: b.y - 0.5 * H, facing: f });
          s.feel.sound("dash", 1);
        }
        break;
      }
      case "flurry": {
        // she is the cuts: sixteen strokes in front of her, then the glyph ignites
        this.anim = { role: "r_flurry", t, hitAt: null, hidden: true, flame: 0 };
        const per = U.flurryTicks / U.flurryCuts;
        const cut = Math.floor(t / per);
        if (cut !== this.ult.cut && cut < U.flurryCuts) {
          this.ult.cut = cut;
          const r1 = Math.sin(cut * 12.9898) * 43758.5453, r2 = Math.sin(cut * 78.233) * 12345.678;
          const u = r1 - Math.floor(r1), v = r2 - Math.floor(r2);
          const x = this.ult.x0 + f * (0.2 + u * U.flurryReach) * H, y = this.ult.y0 - (0.2 + v * 1.2) * H;
          // the decree written in the air: vermilion strokes, gold sparks where each lands
          s.vfx.spawn("streak.markRed", { x, y, facing: f, rotation: (u - 0.5) * 2.4, scale: [3.2, 2] });
          if (cut % 2 === 0) s.vfx.spawn("streak.mark", { x: x + f * 0.2 * H, y: y - 0.2 * H, facing: f, rotation: (v - 0.5) * 2.8, scale: [2.2, 1.4] });
          if (cut === U.flurryCuts - 1) s.vfx.spawn("flash.gold", { x: this.ult.x0 + f * 0.9 * H, y: this.ult.y0 - 0.8 * H, facing: f, scale: 1.6 });
          if (cut % 4 === 0) s.feel.sound("swing", 0.5);
        }
        if (t >= U.flurryTicks) {
          this.nextPhase("rise");
          s.vfx.spawn("pillar", { x: b.x, y: b.y, facing: f });
          s.feel.sound("rise", 1);
          this.camZoom = U.zoomOut;
        }
        break;
      }
      case "rise": {
        // a flame, accelerating up
        this.anim = { role: "nuke", t, hitAt: null, hidden: false, flame: 1 };
        const k = (t + 1) / U.riseTicks;
        const want = this.ult.y0 - U.riseHeight * H * k * k;
        world.move(b, 0, want - b.y);
        if (t % 2 === 0) this.ghost(12);
        if (t >= U.riseTicks) {
          this.nextPhase("zenith");
          this.ult.zx = b.x;
          this.ult.zy = b.y;
          // where the dive lands: ahead if there is ground there (near her own height), else straight down;
          // with no ground found it ends only on a real landing (or the void's tug-back puts her on one)
          const near = (x: number): number | null => {
            const g = world.groundBelow?.(x, this.ult.y0 - 2 * H);
            return g && g.y < this.ult.y0 + 2.5 * H ? g.y : null;
          };
          const ahead = near(b.x + f * U.diveForward * H), here = near(b.x);
          this.ult.fwd = ahead !== null ? U.diveForward * H : 0;
          this.ult.floor = ahead ?? here ?? Infinity;
        }
        break;
      }
      case "zenith": {
        // a beat of stillness at the top, upside down
        this.anim = { role: "nuke", t, hitAt: null, hidden: false, flame: 1 };
        b.vx = b.vy = 0;
        if (t >= U.zenithTicks) {
          this.nextPhase("dive");
          s.feel.sound("dash", 1);
        }
        break;
      }
      case "dive": {
        // she is a line from the zenith to the floor: powered, accelerating, ahead of where she rose
        this.anim = { role: "nuke", t, hitAt: null, hidden: false, flame: 1 };
        const k = Math.min(1, (t + 1) / U.diveTicks);
        b.vx = t < U.diveTicks ? (f * this.ult.fwd) / U.diveTicks : 0;
        b.vy = Math.min(pt(10) + pt(70) * k * k, Number.isFinite(this.ult.floor) ? Math.max(0, this.ult.floor - b.y) + 1 : Infinity);
        const { landed } = world.move(b, b.vx, b.vy);
        this.streak = { x0: this.ult.zx, y0: this.ult.zy - 0.5 * H, x1: b.x, y1: b.y - 0.5 * H, life: 36 };
        if (landed || b.grounded || b.y >= this.ult.floor - 0.5 || t > U.diveTicks + 60) this.impact();
        break;
      }
      case "smoke": {
        // the smoke hides her (draw.ts draws the cloud from `smoke`); it thins into the transform
        this.anim = { role: "transform", t: 0, hitAt: null, hidden: true, flame: 0 };
        if (t === 1) this.camZoom = null;
        if (t >= U.smokeTicks) this.nextPhase("transform");
        break;
      }
      case "transform": {
        // the burn plays forward: normal idle into the form
        this.anim = { role: "transform", t, hitAt: null, hidden: false, flame: 0 };
        if (t % 8 === 0) s.vfx.spawn("embers.gold", { x: b.x, y: b.y - 0.6 * H, facing: f });
        if (t >= U.transformTicks) {
          this.nextPhase("reveal");
          this.form = U.formTicks;
          this.formSerial++;
          this.airDashes = U.airDashes;
          s.vfx.spawn("ring.halo", { x: b.x, y: b.y - 0.5 * H, facing: f, scale: 1.6 });
          s.feel.sound("ult", 0.7);
        }
        break;
      }
      case "reveal": {
        this.anim = { role: "r_reveal", t, hitAt: null, hidden: false, flame: 0 };
        if (t >= U.revealTicks) {
          this.ultPhase = null;
          this.setState("free");
          this.anim = { role: "idle", t: 0, hitAt: null, hidden: false, flame: 0 };
        }
        break;
      }
      default:
        this.setState("free");
    }
    void input;
  }

  /** The dive lands: everything near breaks, the frame freezes white and the smoke rolls in. */
  private impact(): void {
    const U = FEEL.ult, b = this.body, s = this.host;
    this.nextPhase("smoke");
    this.smoke = { x: b.x, y: b.y, t: 0, life: U.smokeTicks + Math.round(U.transformTicks * 0.6) };
    b.vx = b.vy = 0;
    s.feel.freeze(FEEL.weights.ult.hitstop);
    s.feel.impactFrame("invert", 3);
    s.feel.slowmo(U.slowmo, U.slowmoTicks);
    this.shake(1);
    s.camera.zoomPunch(3);
    s.vfx.spawn("r.finale", { x: b.x, y: b.y, facing: this.facing });
    s.vfx.spawn("ring.ult", { x: b.x, y: b.y - 0.2 * H, facing: 1 });
    s.vfx.spawn("pillar.ult", { x: b.x, y: b.y, facing: 1 });
    s.vfx.spawn("cracks.ult", { x: b.x, y: b.y, facing: 1 });
    s.vfx.spawn("burst.ult", { x: b.x, y: b.y - 0.5 * H, facing: 1 });
    s.feel.sound("ult", 1);
    s.feel.sound("slam", 1);
  }

  private startExit(): void {
    this.form = 0;
    this.move = null;
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
    if (this.anim.role !== role) this.anim = { role, t: 0, hitAt: null, hidden: false, flame: 0 };
    if (kind !== "still") this.anim.t++;
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
        if (this.ultPhase === "call") { sy = 1 + 0.06 * Math.sin(this.t * 0.6); }
        if (this.ultPhase === "rise") { sx = 0.6; sy = 1.5; }
        if (this.ultPhase === "zenith") rot = Math.PI;
        if (this.ultPhase === "dive") { sx = 0.45; sy = 1.9; rot = Math.PI; }
        if (this.ultPhase === "smoke") { sy = 0.8; sx = 1.2; }
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

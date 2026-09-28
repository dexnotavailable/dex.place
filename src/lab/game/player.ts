// Player controller. Locomotion is physics-driven (run, jump with buffer,
// coyote time and variable height, double jump, drop-through). Everything
// else - M1 string, dash, dash attack, Q, R, hurt - is an "action" clip whose
// data owns timing, root motion, hitboxes, i-frames and cancel windows.

import { frameTicks, type Clip, type HitBox } from "../contracts.ts";
import type { Input } from "../engine/input.ts";
import type { Renderer, SpriteDraw } from "../engine/renderer.ts";
import type { RuntimeSprite } from "./assets.ts";
import { ClipPlayer } from "./clip-player.ts";
import { fireFrame, toWorld, type Services, type WorldBox } from "./events.ts";
import type { Body, World } from "./world.ts";

export interface PlayerTuning {
  hp: number;
  runSpeed: number;
  accelGround: number;
  decelGround: number;
  accelAir: number;
  gravity: number;
  /** Gravity multiplier while falling (vy > 0): a snappier way down than up. */
  fallGravity: number;
  /** Gravity multiplier near the apex (|vy| < apexBand) while jump is held: a slight hang. */
  apexGravity: number;
  apexBand: number;
  fallMax: number;
  jumpVelocity: number;
  jumpCut: number;
  doubleJumpVelocity: number;
  coyoteTicks: number;
  jumpBufferTicks: number;
  attackBufferTicks: number;
  dashBufferTicks: number;
  skillBufferTicks: number;
  /**
   * A press made during an action is kept past its normal buffer only when
   * the action will accept it (a cancel window, or the action ending) within
   * this many ticks of the press. Anything later expires on the normal
   * buffer, so a committed move never releases a stale input half a second on.
   */
  actionHoldTicks: number;
  /** Attack root motion stops this far (px) in front of an enemy body. */
  attackStopGap: number;
  dashCooldown: number;
  /** A dash started within this many ticks of the previous dash's start is a chained (second) dash. */
  dashChainWindow: number;
  /** Cooldown after a chained dash: two dashes in a row, then a longer lock. */
  dashChainCooldown: number;
  airDashes: number;
  skillCooldown: number;
  ultCooldown: number;
  hurtInvuln: number;
  respawnInvuln: number;
  collider: { w: number; h: number };
  landClipMinFall: number;
}

type ActionKind = "m1" | "m2" | "skill" | "ult" | "jump" | "move";
type PressKind = "ult" | "skill" | "m2" | "jump" | "m1";
/** Tie-break when two presses land on the same tick: defensive/special before the attack. */
const PRESS_ORDER: PressKind[] = ["ult", "skill", "m2", "jump", "m1"];

/** Clip ids this controller asks for; a package missing any of them fails at load. */
export const PLAYER_CLIPS = [
  "idle", "run", "jump", "apex", "fall", "land", "double_jump", "dash", "dash_attack",
  "m1_1", "m1_2", "m1_3", "m1_4", "skill_q", "ult_r", "hurt",
] as const;

export class Player {
  readonly body: Body;
  facing = 1;
  hp: number;
  mode: "free" | "action" = "free";
  readonly clip: ClipPlayer;
  private jumps = 0;
  private coyote = 0;
  private airDashes = 0;
  private jumpCutDone = true;
  dashCd = 0;
  /** Input tick the last dash started, and whether that dash was already a chained one. */
  private lastDash = -9999;
  private lastDashChained = false;
  skillCd = 0;
  ultCd = 0;
  invuln = 0;
  private flash = 0;
  dead = 0;
  private fallSpeed = 0;
  checkpoint: [number, number];
  /** For the debug overlay: last action the controller took. */
  lastAction = "";
  /** Input tick the current action chain started (free -> action). */
  private chainStart = 0;
  /** Presses keep their action lifetime until this input tick after an action ends. */
  private actionGrace = -1;
  private inputTick = 0;

  constructor(
    readonly sprite: RuntimeSprite,
    readonly t: PlayerTuning,
    readonly s: Services,
    spawn: [number, number],
  ) {
    this.body = { x: spawn[0], y: spawn[1], w: t.collider.w, h: t.collider.h, vx: 0, vy: 0, grounded: true, dropThrough: 0 };
    this.checkpoint = [spawn[0], spawn[1]];
    this.hp = t.hp;
    const missing = PLAYER_CLIPS.filter((id) => !sprite.clips.has(id));
    if (missing.length) throw new Error(`${sprite.name}: missing clips ${missing.join(", ")}`);
    this.clip = new ClipPlayer(this.get("idle"));
  }

  private get(id: string): Clip {
    const c = this.sprite.clips.get(id);
    if (!c) throw new Error(`player package has no clip "${id}"`);
    return c;
  }

  get follow() {
    return () => ({ x: this.body.x, y: this.body.y, facing: this.facing });
  }

  private play(id: string): void {
    this.clip.play(this.get(id));
    this.fireEntered();
  }

  private fireEntered(): void {
    const f = this.clip.takeEntered();
    if (!f) return;
    fireFrame(f, { x: this.body.x, y: this.body.y, facing: this.facing, follow: this.follow, sprite: () => this.spriteDraw() }, this.s);
  }

  private startAction(id: string, kind: ActionKind): void {
    if (this.mode !== "action") this.chainStart = this.inputTick;
    this.mode = "action";
    this.lastAction = `${kind} -> ${id}`;
    this.play(id);
  }

  get iframes(): boolean {
    return this.dead > 0 || this.invuln > 0 || (this.mode === "action" && !!this.clip.frame.iframes);
  }

  private dashReady(): boolean {
    return this.dashCd <= 0 && (this.body.grounded || this.airDashes > 0);
  }

  private startDash(input: Input): void {
    const ax = input.axis();
    if (ax !== 0) this.facing = ax;
    if (!this.body.grounded) this.airDashes--;
    // two dashes in a row are free; the second one earns a longer lock, so
    // dash-spam is not faster than running and not a free defence
    const chained = !this.lastDashChained && this.inputTick - this.lastDash <= this.t.dashChainWindow;
    this.dashCd = chained ? this.t.dashChainCooldown : this.t.dashCooldown;
    this.lastDash = this.inputTick;
    this.lastDashChained = chained;
    this.body.vy = 0;
    this.startAction("dash", "m2");
  }

  /**
   * Tick of a live press of `a`, or null. Out of an action a press lives for
   * its normal buffer. During an action (and on the tick after it ends) a
   * press made since the action chain started stays alive for
   * actionHoldTicks, so a dodge or jump tapped early in a swing comes out at
   * the first window that accepts it instead of silently expiring.
   */
  private live(input: Input, a: PressKind): number | null {
    const t = input.pressTick(a);
    if (t === undefined) return null;
    const age = input.tick - t;
    const T = this.t;
    const buf = a === "jump" ? T.jumpBufferTicks : a === "m1" ? T.attackBufferTicks : a === "m2" ? T.dashBufferTicks : T.skillBufferTicks;
    if (age <= buf) return t;
    if (t < this.chainStart - buf) return null;
    if (input.tick <= this.actionGrace && this.mode !== "action") return age <= T.actionHoldTicks ? t : null;
    if (this.mode !== "action") return null;
    // held only if this action will take it within actionHoldTicks of the press
    return age + this.ticksUntilAccepts(a) <= T.actionHoldTicks ? t : null;
  }

  /**
   * Updates from now until the current action accepts `a`: a cancel window
   * for it opens (onHit windows only once this play has hit) or the clip
   * ends. 0 when the current frame already accepts it.
   */
  private ticksUntilAccepts(a: PressKind): number {
    const c = this.clip;
    const frames = c.clip.frames;
    const accepts = (i: number): boolean => (frames[i]!.cancel ?? []).some((w) => (!w.onHit || c.hit) && !!w.into[a]);
    let wait = 0;
    for (let i = c.index; i < frames.length; i++) {
      if (accepts(i)) break;
      wait += i === c.index ? frameTicks(frames[i]!) - c.tick : frameTicks(frames[i]!);
    }
    if (a === "m2") wait = Math.max(wait, this.dashCd);
    return wait;
  }

  /** A choice made from the press at tick t supersedes every older (and same-tick) press. */
  private settle(input: Input, pend: Record<PressKind, number | null>, t: number): void {
    for (const k of PRESS_ORDER) {
      input.consumeUpTo(k, t);
      const pk = pend[k];
      if (pk !== null && pk <= t) pend[k] = null;
    }
  }

  /** Is an enemy body in front of her (or overlapping with its centre ahead) within `gap` px? */
  private blockedAhead(blockers: readonly WorldBox[], gap: number): boolean {
    const b = this.body;
    const half = b.w / 2;
    const top = b.y - b.h;
    for (const e of blockers) {
      if (e.y > b.y || e.y + e.h < top) continue;
      const cx = e.x + e.w / 2;
      if ((cx - b.x) * this.facing <= 0) continue;
      const front = this.facing > 0 ? e.x - (b.x + half) : b.x - half - (e.x + e.w);
      if (front < gap) return true;
    }
    return false;
  }

  update(input: Input, world: World, blockers: readonly WorldBox[] = []): void {
    const T = this.t;
    if (this.dashCd > 0) this.dashCd--;
    if (this.skillCd > 0) this.skillCd--;
    if (this.ultCd > 0) this.ultCd--;
    if (this.invuln > 0) this.invuln--;
    if (this.flash > 0) this.flash--;
    if (this.dead > 0) {
      this.updateDead(world);
      return;
    }
    this.inputTick = input.tick;
    const ax = input.axis();
    const pend: Record<PressKind, number | null> = {
      ult: this.ultCd <= 0 ? this.live(input, "ult") : null,
      skill: this.skillCd <= 0 ? this.live(input, "skill") : null,
      m2: this.live(input, "m2"),
      jump: this.live(input, "jump"),
      m1: this.live(input, "m1"),
    };

    let jumpCancel = false;
    if (this.mode === "action") {
      const f = this.clip.frame;
      const windows = (f.cancel ?? []).filter((w) => !w.onHit || this.clip.hit);
      const target = (a: ActionKind): string | undefined => {
        for (const w of windows) if (w.into[a]) return w.into[a];
        return undefined;
      };
      const pick = (a: ActionKind, dflt: string): string => {
        const t = target(a)!;
        return t === "*" ? dflt : t;
      };
      // Presses this frame accepts. Any non-attack choice (ult, skill, dash,
      // jump) beats a mashed attack; among those the latest press wins.
      let choice: PressKind | null = null;
      for (const k of PRESS_ORDER) {
        const t = pend[k];
        if (t === null || !target(k)) continue;
        if (k === "m2" && !this.dashReady()) continue;
        if (k === "m1") {
          if (choice === null) choice = k;
          continue;
        }
        if (choice === null || t > pend[choice]!) choice = k;
      }
      if (choice !== null) {
        const t = pend[choice]!;
        this.settle(input, pend, t);
        switch (choice) {
          case "ult":
            this.ultCd = T.ultCooldown;
            if (ax !== 0) this.facing = ax;
            this.startAction(pick("ult", "ult_r"), "ult");
            break;
          case "skill":
            this.skillCd = T.skillCooldown;
            if (ax !== 0) this.facing = ax;
            this.startAction(pick("skill", "skill_q"), "skill");
            break;
          case "m2":
            this.startDash(input);
            break;
          case "m1":
            if (ax !== 0 && !this.clip.hasTag("dash")) this.facing = ax;
            this.startAction(pick("m1", "m1_1"), "m1");
            break;
          case "jump":
            // back to free movement; the jump itself happens below, this tick,
            // and any newer press waits a tick so it can't eat the jump
            pend.jump = t;
            jumpCancel = true;
            this.mode = "free";
            this.lastAction = "jump cancel";
            break;
        }
      } else if (ax !== 0 && target("move")) {
        this.mode = "free";
        this.lastAction = "move cancel";
      }
    }

    if (this.mode === "free" && !jumpCancel) {
      if (pend.ult !== null) {
        this.settle(input, pend, pend.ult);
        this.ultCd = T.ultCooldown;
        if (ax !== 0) this.facing = ax;
        this.startAction("ult_r", "ult");
      } else if (pend.skill !== null) {
        this.settle(input, pend, pend.skill);
        this.skillCd = T.skillCooldown;
        if (ax !== 0) this.facing = ax;
        this.startAction("skill_q", "skill");
      } else if (pend.m2 !== null && this.dashReady()) {
        this.settle(input, pend, pend.m2);
        this.startDash(input);
      } else if (pend.m1 !== null) {
        this.settle(input, pend, pend.m1);
        if (ax !== 0) this.facing = ax;
        this.startAction("m1_1", "m1");
      }
    }

    const b = this.body;
    if (this.mode === "free") {
      const target = ax * T.runSpeed;
      const turning = ax !== 0 && Math.sign(b.vx) === -ax;
      const accel = b.grounded ? (ax !== 0 ? T.accelGround * (turning ? 1.7 : 1) : T.decelGround) : T.accelAir * (turning ? 1.4 : 1);
      if (b.vx < target) b.vx = Math.min(target, b.vx + accel);
      else if (b.vx > target) b.vx = Math.max(target, b.vx - accel);
      if (ax !== 0) this.facing = ax;
      // jumping
      if (pend.jump !== null) {
        if (input.isDown("down") && b.grounded && b.y < -0.5) {
          b.dropThrough = 10;
          b.grounded = false;
          input.consume("jump");
        } else if (b.grounded || this.coyote > 0) {
          input.consume("jump");
          b.vy = T.jumpVelocity;
          b.grounded = false;
          this.coyote = 0;
          this.jumps = 1;
          this.jumpCutDone = false;
          this.play("jump");
        } else if (this.jumps < 2) {
          input.consume("jump");
          b.vy = T.doubleJumpVelocity;
          this.jumps = 2;
          this.jumpCutDone = false;
          this.play("double_jump");
        }
      }
      const held = input.isDown("jump");
      if (!this.jumpCutDone && b.vy < 0 && !held) {
        b.vy *= T.jumpCut;
        this.jumpCutDone = true;
      }
      if (b.vy >= 0) this.jumpCutDone = true;
      // rise, a slight hang at the apex while jump is held, then a faster fall
      let g = T.gravity;
      if (b.vy > 0) g *= T.fallGravity;
      if (held && !b.grounded && Math.abs(b.vy) < T.apexBand) g = T.gravity * T.apexGravity;
      b.vy = Math.min(T.fallMax, b.vy + g);
    } else {
      const rm = this.clip.rootMotion();
      const g = this.clip.clip.gravity ?? 1;
      if (rm) b.vx = rm[0] * this.facing;
      else b.vx *= b.grounded ? 0.7 : 0.9;
      // Attacks stop at an enemy: no forward travel once this play has hit,
      // or while a body is right in front of her. The dash passes through.
      if (b.vx * this.facing > 0 && !this.clip.hasTag("dash") && (this.clip.hit || this.blockedAhead(blockers, T.attackStopGap))) b.vx = 0;
      if (rm && rm[1] !== 0) b.vy = rm[1];
      else if (g === 0) b.vy = 0;
      else b.vy = Math.min(T.fallMax, b.vy + T.gravity * g);
    }

    if (b.vy > 0) this.fallSpeed = b.vy;
    const { landed } = world.move(b, b.vx, b.vy);
    if (b.grounded) {
      this.coyote = T.coyoteTicks;
      this.jumps = 0;
      this.airDashes = T.airDashes;
    } else if (this.coyote > 0) {
      this.coyote--;
    }
    if (landed && this.mode === "free" && this.fallSpeed >= T.landClipMinFall) this.play("land");
    if (landed) this.fallSpeed = 0;

    // clip time
    this.clip.step();
    if (this.mode === "action" && this.clip.done) {
      const next = this.clip.clip.next;
      this.mode = "free";
      // presses still waiting on this action get one more tick to come out
      this.actionGrace = input.tick + 1;
      if (next) this.play(next);
    }
    if (this.mode === "free") this.pickLocomotion();
    this.fireEntered();
  }

  private pickLocomotion(): void {
    const c = this.clip;
    const b = this.body;
    if (c.hasTag("free") && !c.done) {
      const keep = c.clip.id === "land" ? b.grounded && Math.abs(b.vx) < 1.2 : !b.grounded;
      if (keep) return;
    }
    let id: string;
    if (b.grounded) id = Math.abs(b.vx) > 0.35 ? "run" : "idle";
    else if (b.vy < -1.6) id = c.clip.id === "jump" ? "jump" : "apex";
    else if (b.vy < 1.4) id = "apex";
    else id = "fall";
    if (c.clip.id !== id || c.done) {
      // keep the jump clip once started; only switch into it from play("jump")
      if (id === "jump" && c.clip.id !== "jump") id = "apex";
      if (c.clip.id !== id) this.play(id);
    }
  }

  hit(damage: number, dir: number, kb: [number, number]): boolean {
    if (this.iframes) return false;
    this.hp -= damage;
    this.invuln = this.t.hurtInvuln;
    this.flash = 6;
    this.facing = -dir;
    this.body.vx = kb[0] * dir;
    this.body.vy = kb[1];
    this.body.grounded = false;
    this.s.feel.freeze(5);
    this.s.camera.shake(3, 12);
    this.s.feel.sound("hurt");
    this.s.vfx.spawn("hit.player", { x: this.body.x, y: this.body.y - 48, facing: dir });
    if (this.hp <= 0) {
      this.dead = 1;
      this.mode = "free";
      // she goes down in the hurt drawing (its first frame is held, the clip doesn't step while dead)
      this.play("hurt");
      this.s.feel.slowmo(0.4, 30);
    } else {
      this.startAction("hurt", "move");
    }
    return true;
  }

  /** Death -> thrown back in the hurt pose -> fade -> respawn at the checkpoint -> fade in. */
  private updateDead(world: World): void {
    this.dead++;
    const b = this.body;
    if (this.dead < 34) {
      // the killing hit's knockback carries her; she drops to the floor and slides to a stop
      b.vx *= b.grounded ? 0.8 : 0.96;
      b.vy = Math.min(this.t.fallMax, b.vy + this.t.gravity);
      world.move(b, b.vx, b.vy);
    }
    if (this.dead === 34) {
      b.x = this.checkpoint[0];
      b.y = this.checkpoint[1];
      b.vx = b.vy = 0;
      this.hp = this.t.hp;
      this.facing = 1;
      this.play("idle");
    }
    if (this.dead >= 68) {
      this.dead = 0;
      this.invuln = this.t.respawnInvuln;
      this.s.vfx.spawn("ring.halo", { x: b.x, y: b.y - 4, facing: 1, scale: 1.6 });
      this.s.vfx.spawn("feathers", { x: b.x, y: b.y - 50, facing: 1 });
    }
  }

  /** 0..1 fade amount for the screen during death / respawn. */
  get fade(): number {
    if (this.dead <= 0) return 0;
    if (this.dead < 34) return Math.min(1, this.dead / 30);
    return Math.max(0, 1 - (this.dead - 34) / 30);
  }

  hurtboxes(): WorldBox[] {
    const f = this.clip.frame;
    const boxes = f.hurtboxes ?? this.sprite.defaultHurt;
    return boxes.map((b) => toWorld(b, this.body.x, this.body.y, this.facing));
  }

  hitboxes(): { box: WorldBox; hb: HitBox }[] {
    if (this.mode !== "action") return [];
    const f = this.clip.frame;
    return (f.hitboxes ?? []).map((hb) => ({ hb, box: toWorld(hb, this.body.x, this.body.y, this.facing) }));
  }

  spriteDraw(): SpriteDraw | undefined {
    const f = this.clip.frame;
    const sheet = this.sprite.sheets.get(this.clip.clip.atlas);
    if (!sheet) return undefined;
    const [sx, sy, sw, sh] = f.rect;
    const [px, py] = f.pivot;
    const x = this.facing > 0 ? this.body.x - px : this.body.x - (sw - px);
    return { sheet, sx, sy, sw, sh, x: Math.round(x), y: Math.round(this.body.y - py), flip: this.facing < 0 };
  }

  anchor(name: string): [number, number] | null {
    const a = this.clip.frame.anchors?.[name];
    return a ? [this.body.x + a[0] * this.facing, this.body.y + a[1]] : null;
  }

  draw(r: Renderer): void {
    const d = this.spriteDraw();
    if (!d) return;
    let opacity = 1;
    if (this.dead > 0) opacity = this.dead < 34 ? 1 - this.dead / 34 : (this.dead - 34) / 34;
    else if (this.invuln > 0 && this.mode !== "action" && Math.floor(this.invuln / 4) % 2 === 0) opacity = 0.55;
    r.sprite({ ...d, tint: this.flash > 0 ? [1, 0.35, 0.4, this.flash > 3 ? 0.85 : 0.45] : undefined, opacity });
  }
}

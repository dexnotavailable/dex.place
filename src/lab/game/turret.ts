// Sentinel turret: tracks the player, telegraphs (eye flares, charge motes,
// a steady aim line that brightens, the barrel drawing back), fires readable
// projectiles on an interval, answers a target hugging it with a point-blank
// pulse, flashes and recoils on hit, staggers on heavy hits (then shrugs off
// staggers for a while), breaks apart and rebuilds.

import { ContractError, type Clip, type HitBox } from "../contracts.ts";
import { VFX_TYPE, type PointLight, type Renderer, type RGB } from "../engine/renderer.ts";
import type { RuntimeSprite } from "./assets.ts";
import { toWorld, type Services, type WorldBox } from "./events.ts";
import type { World } from "./world.ts";

export interface TurretTuning {
  hp: number;
  range: number;
  trackRate: number;
  fireInterval: number;
  telegraph: number;
  projectileSpeed: number;
  projectileLife: number;
  projectileDamage: number;
  projectileKnockback: [number, number];
  staggerPoise: number;
  staggerTicks: number;
  /** After a stagger ends, hits still damage but can't stagger again for this many ticks. */
  staggerImmunity: number;
  /** When a stagger ends, the next attack comes after this many ticks plus a full telegraph. */
  staggerRefire: number;
  /**
   * Point-blank: a target whose hurtbox is within this many px of the mount,
   * or across the barrel, gets a pulse instead of a shot.
   */
  closeRange: number;
  /** Radius of the point-blank pulse around the mount, px. */
  pulseRadius: number;
  /** Ticks the pulse can hit (it expands over them). */
  pulseTicks: number;
  pulseKnockback: [number, number];
  /** While the target is in close range, the next attack is at most telegraph + this many ticks away. */
  closeRefire: number;
  respawnTicks: number;
  recoil: number;
}

export interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  trail: [number, number][];
  alive: boolean;
}

/** Point-blank shockwave around the mount. */
export interface Pulse {
  x: number;
  y: number;
  age: number;
  hit: boolean;
}

export interface TurretTarget {
  x: number;
  y: number;
  alive: boolean;
  /** Her hurtboxes in world space (the body box when a frame has none). */
  hurt: readonly WorldBox[];
}

type State = "idle" | "telegraph" | "stagger" | "broken";

/** Nearest distance from a point to a box (0 inside). */
function distToBox(x: number, y: number, b: WorldBox): number {
  const dx = Math.max(b.x - x, 0, x - (b.x + b.w));
  const dy = Math.max(b.y - y, 0, y - (b.y + b.h));
  return Math.hypot(dx, dy);
}

/** Does the segment (x0,y0)-(x1,y1), widened by `pad`, touch the box? */
function segmentTouches(x0: number, y0: number, x1: number, y1: number, b: WorldBox, pad: number): boolean {
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    if (distToBox(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, b) <= pad) return true;
  }
  return false;
}

export class Turret {
  facing = -1;
  /** Aim in degrees relative to facing: 0 forward, -90 up, 90 down. */
  aim = 0;
  hp: number;
  state: State = "idle";
  private timer = 0;
  private fireTimer: number;
  private poise = 0;
  /** Ticks left in which a hit can't stagger (counts down after a stagger ends). */
  private immune = 0;
  /** The target is point-blank right now (the telegraph shows the pulse ring). */
  close = false;
  pulse: Pulse | null = null;
  /** Attacks released since load: projectiles plus point-blank pulses. */
  shotsFired = 0;
  pulsesFired = 0;
  private flash = 0;
  private recoil = 0;
  private jolt = 0;
  private age = 0;
  readonly projectiles: Projectile[] = [];
  private base: Clip;
  private head: Clip;
  private barrel: Clip;
  private broken: Clip;

  constructor(
    readonly sprite: RuntimeSprite,
    readonly t: TurretTuning,
    readonly s: Services,
    readonly x: number,
    readonly y: number,
  ) {
    this.hp = t.hp;
    this.fireTimer = t.fireInterval;
    const get = (id: string): Clip => {
      const c = sprite.clips.get(id);
      if (!c) throw new Error(`turret package has no clip "${id}"`);
      return c;
    };
    this.base = get("base");
    this.head = get("head");
    this.barrel = get("barrel");
    this.broken = get("broken");
    // The barrel is angle-indexed; without a real from..to span there is no
    // frame to pick. Fail at load with the path, never inside the frame loop.
    const a = this.barrel.angles;
    const at = `$.clips[${sprite.pkg.clips.indexOf(this.barrel)}].angles`;
    const src = sprite.source === "pipeline" ? "/lab/turret/manifest.json" : `${sprite.name} (stand-in bake)`;
    if (!a) throw new ContractError(src, [`${at}: the turret "barrel" clip needs { "from": deg, "to": deg }`]);
    if (a.from === a.to) throw new ContractError(src, [`${at}: "from" and "to" must differ (both ${a.from})`]);
  }

  get alive(): boolean {
    return this.state !== "broken";
  }

  private mount(): [number, number] {
    const m = this.base.frames[0]!.anchors?.mount ?? [0, -27];
    return [this.x + m[0] * this.facing, this.y + m[1]];
  }

  private barrelFrameIndex(): number {
    const a = this.barrel.angles;
    const n = this.barrel.frames.length;
    if (!a || a.from === a.to || n < 2) return 0;
    const k = Math.round(((this.aim - a.from) / (a.to - a.from)) * (n - 1));
    return Number.isFinite(k) ? Math.max(0, Math.min(n - 1, k)) : 0;
  }

  /** Muzzle point and unit direction in world space. */
  muzzle(): { x: number; y: number; dx: number; dy: number } {
    const [mx, my] = this.mount();
    const hf = this.head.frames[0]!;
    const bp = hf.anchors?.barrel ?? [5, -9];
    const px = mx + bp[0] * this.facing, py = my + bp[1];
    const bf = this.barrel.frames[this.barrelFrameIndex()]!;
    const mz = bf.anchors?.muzzle ?? [30, 0];
    const rad = (this.aim * Math.PI) / 180;
    return { x: px + mz[0] * this.facing, y: py + mz[1], dx: Math.cos(rad) * this.facing, dy: Math.sin(rad) };
  }

  hurtbox(): WorldBox | null {
    if (!this.alive) return null;
    const hb = this.sprite.defaultHurt[0] ?? { x: -14, y: -58, w: 28, h: 58 };
    return toWorld(hb, this.x, this.y, this.facing);
  }

  /**
   * Solid body she can't stand inside (a little narrower than the plinth).
   * The game pushes her out of it a few px per tick, so a dash still passes
   * through but walking or swinging into it stops at its face.
   */
  pushBox(): WorldBox | null {
    if (!this.alive) return null;
    const hb = this.hurtbox()!;
    const w = Math.max(8, hb.w + 4);
    return { x: this.x - w / 2, y: hb.y, w, h: hb.h };
  }

  update(target: TurretTarget, world: World): void {
    const T = this.t;
    this.age++;
    if (this.flash > 0) this.flash--;
    if (this.recoil > 0) this.recoil = Math.max(0, this.recoil - 0.5);
    if (this.jolt > 0) this.jolt--;
    if (this.immune > 0 && this.state !== "stagger") this.immune--;
    this.updateProjectiles(world);
    if (this.pulse && ++this.pulse.age >= T.pulseTicks) this.pulse = null;

    if (this.state === "broken") {
      this.timer--;
      if (this.timer === 44) this.s.vfx.spawn("turret.rebuild", { x: this.x, y: this.y - 20, facing: this.facing });
      if (this.timer <= 0) {
        this.state = "idle";
        this.hp = T.hp;
        this.poise = 0;
        this.immune = 0;
        this.fireTimer = T.fireInterval;
        this.flash = 6;
        this.s.feel.sound("turret_rebuild", 0.7);
      }
      return;
    }
    if (this.state === "stagger") {
      if (--this.timer <= 0) {
        this.state = "idle";
        this.immune = T.staggerImmunity;
      }
      this.aim += (40 - this.aim) * 0.05;
      this.close = false;
      return;
    }

    const dx = target.x - this.x;
    const dy = target.y - 48 - (this.y - 38);
    const dist = Math.hypot(dx, dy);
    const inRange = target.alive && dist < T.range;
    if (inRange && this.state !== "telegraph") this.facing = dx >= 0 ? 1 : -1;
    const want = inRange ? Math.max(-80, Math.min(80, (Math.atan2(dy, Math.abs(dx)) * 180) / Math.PI)) : 10;
    const rate = this.state === "telegraph" ? (this.fireTimer > 10 ? T.trackRate * 0.5 : 0) : T.trackRate;
    this.aim += (want - this.aim) * rate;

    if (!inRange) {
      this.fireTimer = Math.max(this.fireTimer, T.telegraph + 24);
      if (this.state === "telegraph") this.state = "idle";
      this.close = false;
      return;
    }
    // Hugging it is not a safe spot: point-blank, the next attack comes sooner
    // (still after the full telegraph) and it is a pulse, not a shot.
    this.close = this.isClose(target.hurt);
    if (this.close && this.state === "idle") this.fireTimer = Math.min(this.fireTimer, T.telegraph + T.closeRefire);
    this.fireTimer--;
    if (this.fireTimer <= T.telegraph && this.state === "idle") {
      this.state = "telegraph";
      this.s.feel.sound("turret_charge", 0.6);
    }
    if (this.state === "telegraph") {
      // charge motes gather at the muzzle, or at the head when it is about to pulse
      const [cx, cy] = this.close ? this.mount() : ((m) => [m.x, m.y])(this.muzzle());
      if (this.fireTimer % 5 === 0) this.s.vfx.spawn("charge.red", { x: cx, y: cy, facing: 1 });
      if (this.fireTimer <= 0) this.fire(target);
    }
  }

  /**
   * Is any of her hurtboxes within closeRange of the mount, or across the
   * barrel (between the mount and the muzzle)? A shot spawned at the muzzle
   * would start behind her there.
   */
  isClose(hurt: readonly WorldBox[]): boolean {
    const [mx, my] = this.mount();
    const m = this.muzzle();
    return hurt.some((h) => distToBox(mx, my, h) <= this.t.closeRange || segmentTouches(mx, my, m.x, m.y, h, 4));
  }

  private fire(target: TurretTarget): void {
    const T = this.t;
    this.recoil = T.recoil;
    this.fireTimer = T.fireInterval;
    this.state = "idle";
    this.shotsFired++;
    if (this.isClose(target.hurt)) {
      const [mx, my] = this.mount();
      this.pulse = { x: mx, y: my, age: 0, hit: false };
      this.pulsesFired++;
      this.s.vfx.spawn("turret.pulse", { x: mx, y: my, facing: this.facing });
      this.s.feel.sound("turret_fire", 1);
      this.s.camera.shake(2, 8);
      return;
    }
    const m = this.muzzle();
    this.projectiles.push({ x: m.x, y: m.y, vx: m.dx * T.projectileSpeed, vy: m.dy * T.projectileSpeed, life: T.projectileLife, trail: [], alive: true });
    this.s.vfx.spawn("turret.muzzle", { x: m.x, y: m.y, facing: this.facing, rotation: this.aim });
    this.s.feel.sound("turret_fire", 0.8);
  }

  /** Radius the pulse reaches this tick (it expands over pulseTicks). */
  pulseRadius(): number {
    if (!this.pulse) return 0;
    const k = Math.min(1, (this.pulse.age + 1) / Math.max(1, this.t.pulseTicks));
    return this.t.pulseRadius * (0.6 + 0.4 * k);
  }

  /** Does the live pulse reach this box? */
  pulseReaches(b: WorldBox): boolean {
    return !!this.pulse && distToBox(this.pulse.x, this.pulse.y, b) <= this.pulseRadius();
  }

  private updateProjectiles(world: World): void {
    for (const p of this.projectiles) {
      if (!p.alive) continue;
      p.trail.unshift([p.x, p.y]);
      if (p.trail.length > 5) p.trail.pop();
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
      // shots pass over ledges (they are one-way) and burst on the floor
      if (p.life <= 0 || p.y >= -1 || p.x < 0 || p.x > world.width) this.pop(p);
    }
    for (let i = this.projectiles.length - 1; i >= 0; i--) if (!this.projectiles[i]!.alive) this.projectiles.splice(i, 1);
  }

  pop(p: Projectile): void {
    if (!p.alive) return;
    p.alive = false;
    this.s.vfx.spawn("sparks.red", { x: p.x, y: p.y, facing: 1, params: { count: 6 } });
    this.s.vfx.spawn("flash.red", { x: p.x, y: p.y, facing: 1, scale: 0.7 });
  }

  projectileBox(p: Projectile): WorldBox {
    return { x: p.x - 4, y: p.y - 4, w: 8, h: 8 };
  }

  takeHit(hb: HitBox): void {
    if (!this.alive) return;
    const T = this.t;
    this.hp -= hb.damage;
    this.flash = hb.heavy ? 5 : 3;
    this.jolt = hb.heavy ? 8 : 5;
    // No poise builds while staggered, during the immunity after it, or
    // while it charges (armoured: once it glows, dodge, don't mash).
    const canStagger = this.state === "idle" && this.immune <= 0;
    if (canStagger) this.poise += hb.stagger ?? 0;
    this.s.feel.sound(hb.heavy ? "hit_heavy" : "hit");
    if (this.hp <= 0) {
      this.state = "broken";
      this.timer = T.respawnTicks;
      this.projectiles.forEach((p) => this.pop(p));
      this.pulse = null;
      this.s.vfx.spawn("turret.break", { x: this.x, y: this.y - 34, facing: this.facing });
      this.s.feel.freeze(8);
      this.s.feel.slowmo(0.5, 18);
      this.s.camera.shake(6, 22);
      this.s.feel.sound("turret_break");
      return;
    }
    if (canStagger && (hb.heavy || this.poise >= T.staggerPoise)) {
      this.state = "stagger";
      this.timer = T.staggerTicks;
      this.poise = 0;
      // A stagger interrupts the attack but can't postpone it: when it ends
      // the turret attacks again staggerRefire ticks plus a full telegraph
      // later, wherever its timer was, so staggering it again and again
      // can't keep it from ever shooting.
      this.fireTimer = T.telegraph + T.staggerRefire;
    }
  }

  lights(): PointLight[] {
    const out: PointLight[] = [];
    for (const p of this.projectiles) out.push({ x: p.x, y: p.y, height: 10, radius: 96, colour: [1, 0.2, 0.28], intensity: 1.25 });
    if (!this.alive) return out;
    const [mx, my] = this.mount();
    const eye = this.head.frames[0]!.anchors?.eye ?? [5, -10];
    const k = this.charge();
    const glow = k > 0 ? 0.45 + 0.95 * k * (0.82 + 0.18 * Math.sin(this.age * 0.32)) : 0.35;
    out.push({ x: mx + eye[0] * this.facing, y: my + eye[1], height: 14, radius: k > 0 ? 120 : 70, colour: [1, 0.18, 0.26], intensity: glow });
    return out;
  }

  draw(r: Renderer): void {
    const sheet = this.sprite.sheets.get(this.base.atlas)!;
    const flip = this.facing < 0;
    const tint = this.flash > 0 ? ([1, 1, 1, this.flash > 2 ? 0.9 : 0.5] as [number, number, number, number]) : undefined;
    const put = (clip: Clip, index: number, x: number, y: number, extraTint = tint): void => {
      const f = clip.frames[index]!;
      const [sx, sy, sw, sh] = f.rect;
      const [px, py] = f.pivot;
      r.sprite({ sheet, sx, sy, sw, sh, x: flip ? x - (sw - px) : x - px, y: y - py, flip, tint: extraTint });
    };
    if (!this.alive) {
      put(this.broken, 0, this.x, this.y, undefined);
      return;
    }
    const jx = this.jolt > 0 ? (this.jolt % 2 === 0 ? 1 : -1) * Math.ceil(this.jolt / 3) : 0;
    const wob = this.state === "stagger" ? Math.round(Math.sin(this.age * 0.9) * 1.5) : 0;
    const tele = this.charge();
    put(this.base, 0, this.x, this.y);
    const [mx, my] = this.mount();
    // body tell: the head sinks a pixel and the barrel draws back as it charges
    const hx = mx - Math.round(this.recoil * 0.4) * this.facing + jx + wob;
    const hy = my + (this.state === "stagger" || tele > 0.5 ? 1 : 0);
    const bp = this.head.frames[0]!.anchors?.barrel ?? [5, -9];
    const rad = (this.aim * Math.PI) / 180;
    const pull = this.recoil + Math.round(tele * 4);
    const rx = Math.round(Math.cos(rad) * -pull) * this.facing;
    const ry = Math.round(Math.sin(rad) * -pull);
    put(this.barrel, this.barrelFrameIndex(), hx + bp[0] * this.facing + rx, hy + bp[1] + ry);
    put(this.head, tele > 0 ? 1 : 0, hx, hy);
  }

  /** 0 when not telegraphing, else 0..1 through the telegraph. */
  private charge(): number {
    if (this.state !== "telegraph") return 0;
    return Math.max(0.001, Math.min(1, 1 - this.fireTimer / this.t.telegraph));
  }

  /**
   * Telegraph cues, pulse and projectiles, drawn over sprites. Every cue is
   * steady and only its brightness ramps and breathes: nothing blinks.
   */
  drawFx(r: Renderer): void {
    const k = this.charge();
    if (k > 0) {
      const breathe = 0.82 + 0.18 * Math.sin(this.age * 0.32);
      const b = (0.3 + 0.7 * k) * breathe;
      const col: RGB = [b, 0.25 * b, 0.32 * b];
      const late = this.fireTimer <= 16;
      if (this.close) {
        // point-blank: a ring at the pulse's reach instead of an aim line
        const [mx, my] = this.mount();
        const R = this.t.pulseRadius;
        const n = Math.round((2 * Math.PI * R) / (late ? 2 : 3));
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          r.rect(mx + Math.cos(a) * R, my + Math.sin(a) * R, 1, 1, col, 0);
        }
      } else {
        const m = this.muzzle();
        const len = 182;
        const th = late ? 2 : 1;
        const rot = Math.atan2(m.dy, m.dx);
        r.vfx({
          type: VFX_TYPE.rect, t: 0, seed: 0, over: 0, p0: [1, 0, 0, 0], p1: [0, 0, 0, 0],
          core: col, main: col, edge: col, x: m.x + m.dx * 8, y: m.y + m.dy * 8, rot, sx: 1, sy: 1, ext: [0, -th / 2, len, th / 2],
        });
      }
      // eye flare: a hot cross that grows over the last 16 ticks
      if (late) {
        const [mx, my] = this.mount();
        const eye = this.head.frames[0]!.anchors?.eye ?? [5, -10];
        const ex = Math.round(mx + (eye[0] + 1) * this.facing), ey = Math.round(my + eye[1]);
        const L = 1 + Math.round((1 - this.fireTimer / 16) * 4);
        const hot: RGB = [1, 0.92 * breathe, 0.9 * breathe];
        r.rect(ex - L, ey, 2 * L + 1, 1, col, 0);
        r.rect(ex, ey - L + 1, 1, 2 * L - 1, col, 0);
        r.rect(ex - 1, ey, 3, 1, hot, 0);
        r.rect(ex, ey - 1, 1, 3, hot, 0);
      }
    }
    for (const p of this.projectiles) {
      p.trail.forEach((q, i) => {
        const c: [number, number, number] = i < 2 ? [0.85, 0.1, 0.18] : [0.42, 0.04, 0.1];
        const s = i < 2 ? 2 : 1;
        r.rect(q[0] - s / 2, q[1] - s / 2, s, s, c);
      });
      const base = { t: 0.25, seed: 0, over: 1, p1: [0, 0, 0, 0] as [number, number, number, number], x: p.x, y: p.y, rot: 0, sx: 1, sy: 1 };
      r.vfx({ ...base, type: VFX_TYPE.disc, p0: [6, 6, 1, 0], core: [0.05, 0.04, 0.05], main: [0.05, 0.04, 0.05], edge: [0.05, 0.04, 0.05], ext: [-7, -7, 7, 7] });
      r.vfx({ ...base, type: VFX_TYPE.disc, p0: [4, 4, 1, 0], core: [1, 1, 1], main: [1, 0.35, 0.42], edge: [0.85, 0.08, 0.18], ext: [-5, -5, 5, 5], t: 0 });
    }
  }
}

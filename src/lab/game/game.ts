// The lab scene: loop, combat resolution, draw order, HUD, cut-in, debug.
//
// Timing: real time is cut into 60 Hz real ticks (camera, shake, slow-mo and
// cut-in timers, impact frames). Each real tick feeds `slowFactor` into a
// simulation accumulator; whole simulation ticks run the game. Hitstop
// freezes simulation ticks only, so shake and flashes keep playing.

import { cutinEyes } from "../art/cutin.ts";
import { Camera, type CameraTuning } from "../engine/camera.ts";
import type { Input } from "../engine/input.ts";
import { RESOLUTIONS, VFX_TYPE, type Lighting, type PointLight, type Renderer, type RGB, type SpriteSheet } from "../engine/renderer.ts";
import type { Sfx } from "../engine/sfx.ts";
import type { Vfx } from "../engine/vfx.ts";
import type { RuntimeSprite } from "./assets.ts";
import { overlap, type Services } from "./events.ts";
import { Feel } from "./feel.ts";
import { Player, type PlayerTuning } from "./player.ts";
import type { Touch } from "./touch.ts";
import { Turret, type TurretTuning } from "./turret.ts";
import type { MapData } from "./world.ts";
import { World } from "./world.ts";

export interface Tuning {
  player: PlayerTuning;
  camera: CameraTuning;
  turret: TurretTuning;
  feel: { maxHitstop: number; impactCooldown: number; cutinTicks: number };
}

export interface SceneLighting extends Lighting {
  backdrop: { top: RGB; mid: RGB; low: RGB; bands: number };
}

const TICK = 1000 / 60;

export class Game {
  readonly camera: Camera;
  readonly feel: Feel;
  readonly world: World;
  readonly player: Player;
  readonly turret: Turret;
  readonly services: Services;
  debug = false;
  simTicks = 0;
  realTicks = 0;
  private acc = 0;
  private simAcc = 0;
  private last = -1;
  fps = 0;
  private fpsFrames = 0;
  private fpsT0 = 0;
  frameMs = 0;
  private cutinSheet: SpriteSheet;
  private cutinSize: [number, number];
  private speedLines: { y: number; x: number; len: number; v: number; c: RGB }[] = [];
  manual = false;

  constructor(
    readonly r: Renderer,
    readonly input: Input,
    readonly vfx: Vfx,
    readonly sfx: Sfx,
    readonly touch: Touch,
    readonly tuning: Tuning,
    readonly lighting: SceneLighting,
    map: MapData,
    playerSprite: RuntimeSprite,
    turretSprite: RuntimeSprite,
  ) {
    this.camera = new Camera(tuning.camera);
    this.feel = new Feel(this.camera, tuning.feel);
    this.feel.onSound = (id, v) => sfx.play(id, v);
    this.feel.onCutin = () => this.seedSpeedLines();
    this.world = new World(r, map);
    this.vfx.groundAt = (x, y) => this.world.groundAt(x, y);
    this.services = { vfx, feel: this.feel, camera: this.camera };
    this.player = new Player(playerSprite, tuning.player, this.services, map.spawn);
    const tp = map.platforms.find((p) => p.turret) ?? map.platforms[0]!;
    this.turret = new Turret(turretSprite, tuning.turret, this.services, Math.round(tp.x + tp.w / 2), tp.y);
    const eyes = cutinEyes();
    this.cutinSheet = { albedo: r.texture(eyes), normal: r.flatNormal, keyInfluence: 0 };
    this.cutinSize = [eyes.w, eyes.h];
    this.camera.snapTo(this.player.body.x, this.player.body.y - 40, r.iw, r.ih, this.world.bounds());
    input.onToggle = (what) => {
      if (what === "debug") this.debug = !this.debug;
      if (what === "res") this.toggleRes();
    };
  }

  onRes: (mode: "near" | "far") => void = () => {};

  toggleRes(): void {
    this.r.setMode(this.r.mode === "near" ? "far" : "near");
    this.camera.snapTo(this.player.body.x, this.player.body.y - 40, this.r.iw, this.r.ih, this.world.bounds());
    this.onRes(this.r.mode);
  }

  // --- time -------------------------------------------------------------------

  frame(now: number): void {
    if (this.last < 0) this.last = now;
    const dt = Math.min(100, now - this.last);
    this.last = now;
    if (!this.manual) {
      this.acc += dt;
      while (this.acc >= TICK) {
        this.acc -= TICK;
        this.realTick();
      }
    }
    const t0 = performance.now();
    this.render();
    this.frameMs = performance.now() - t0;
    this.fpsFrames++;
    if (now - this.fpsT0 >= 500) {
      this.fps = (this.fpsFrames * 1000) / (now - this.fpsT0);
      this.fpsFrames = 0;
      this.fpsT0 = now;
    }
  }

  realTick(): void {
    this.realTicks++;
    this.feel.realTick();
    this.vfx.realTick();
    this.simAcc += this.feel.slowFactor;
    while (this.simAcc >= 1) {
      this.simAcc -= 1;
      this.simTick();
    }
    const b = this.player.body;
    this.camera.update(b.x, b.y - 40, this.player.facing, this.r.iw, this.r.ih, this.world.bounds(), Math.abs(b.vx) > 0.5);
    this.touch.cooldowns(this.player.skillCd <= 0, this.player.ultCd <= 0);
    for (const l of this.speedLines) l.x -= l.v;
  }

  simTick(): void {
    if (this.feel.hitstop > 0) {
      this.feel.hitstop--;
      return;
    }
    this.simTicks++;
    const tb = this.turret.hurtbox();
    this.player.update(this.input, this.world, tb ? [tb] : []);
    this.separate();
    const b = this.player.body;
    const hurt = this.player.hurtboxes();
    this.turret.update({
      x: b.x,
      y: b.y,
      alive: this.player.dead === 0,
      // a frame with no hurtbox still has a body the turret can be point-blank to
      hurt: hurt.length ? hurt : [{ x: b.x - b.w / 2, y: b.y - b.h, w: b.w, h: b.h }],
    }, this.world);
    this.combat();
    this.vfx.update();
    this.input.tick++;
  }

  /** Soft push-out: she can't end a tick standing inside the turret's body. */
  private separate(): void {
    const pb = this.turret.pushBox();
    const p = this.player;
    if (!pb || p.dead > 0) return;
    const b = p.body;
    const half = b.w / 2;
    if (b.x + half <= pb.x || b.x - half >= pb.x + pb.w || b.y <= pb.y || b.y - b.h >= pb.y + pb.h) return;
    const cx = pb.x + pb.w / 2;
    const dir = b.x === cx ? -p.facing : Math.sign(b.x - cx);
    const pen = dir < 0 ? b.x + half - pb.x : pb.x + pb.w - (b.x - half);
    const [x0, , x1] = this.world.bounds();
    b.x = Math.min(Math.max(b.x + dir * Math.min(pen, 4), x0 + 12 + half), x1 - 12 - half);
    if (b.vx * dir < 0) b.vx = 0;
  }

  private combat(): void {
    const p = this.player;
    const t = this.turret;
    const hits = p.hitboxes();
    if (hits.length) {
      const tb = t.hurtbox();
      for (const { box, hb } of hits) {
        if (tb) {
          const ov = overlap(box, tb);
          if (ov) {
            const group = hb.group ?? `f${p.clip.index}`;
            let set = p.clip.hitGroups.get(group);
            if (!set) p.clip.hitGroups.set(group, (set = new Set()));
            if (!set.has(t)) {
              set.add(t);
              p.clip.hit = true;
              t.takeHit(hb);
              this.feel.freeze(hb.hitstop);
              // contact-only feedback: a whiff never gets these
              if (hb.shake) this.camera.shake(hb.shake.amplitude, hb.shake.duration);
              if (hb.zoom) this.camera.zoom(hb.zoom.steps, hb.zoom.duration);
              if (hb.impact) this.feel.impactFrame(hb.impact.mode, hb.impact.duration);
              this.vfx.spawn(hb.hitVfx ?? "hit.light", { x: ov.x + ov.w / 2, y: ov.y + ov.h / 2, facing: p.facing });
            }
          }
        }
        for (const pr of t.projectiles) {
          if (pr.alive && overlap(box, t.projectileBox(pr))) {
            t.pop(pr);
            this.feel.sound("parry");
            this.vfx.spawn("flash.hit", { x: pr.x, y: pr.y, facing: p.facing });
          }
        }
      }
    }
    if (p.dead === 0) {
      const hurt = p.hurtboxes();
      for (const pr of t.projectiles) {
        if (!pr.alive) continue;
        const pb = t.projectileBox(pr);
        if (!hurt.some((h) => overlap(h, pb))) continue;
        const dir = pr.vx >= 0 ? 1 : -1;
        if (p.hit(this.tuning.turret.projectileDamage, dir, this.tuning.turret.projectileKnockback)) t.pop(pr);
      }
      // point-blank pulse: hits once, knocks her away from the turret
      const pu = t.pulse;
      if (pu && !pu.hit && hurt.some((h) => t.pulseReaches(h))) {
        const dir = p.body.x >= pu.x ? 1 : -1;
        if (p.hit(this.tuning.turret.projectileDamage, dir, this.tuning.turret.pulseKnockback)) pu.hit = true;
      }
    }
  }

  // --- drawing ------------------------------------------------------------------

  lights(): PointLight[] {
    const out = [...this.vfx.pointLights(), ...this.turret.lights()];
    const halo = this.player.anchor("halo");
    if (halo && this.player.dead === 0) out.push({ x: halo[0], y: halo[1], height: 8, radius: 34, colour: [1, 0.86, 0.5], intensity: 0.45 });
    return out;
  }

  render(): void {
    const r = this.r;
    const [cx, cy] = this.camera.view();
    const L = this.lighting;
    r.begin(cx, cy, L, this.lights());
    r.backdrop(L.backdrop.top, L.backdrop.mid, L.backdrop.low, -cy, L.backdrop.bands);
    this.world.drawBackground(r, cx, cy);
    this.world.drawPlatforms(r);
    this.vfx.draw(r, "back");
    this.vfx.drawAfterimages(r);
    this.turret.draw(r);
    // ultimate cut-in: the world drops to ~40% with a cool tint (a real
    // multiply, no dither); she and her effects stay at full strength
    const dim = this.cutinDim();
    if (dim > 0) r.dim([1 - dim * 0.64, 1 - dim * 0.6, 1 - dim * 0.46]);
    this.player.draw(r);
    this.vfx.draw(r, "front");
    this.turret.drawFx(r);
    this.drawCutin();
    this.drawHud();
    if (this.debug) this.drawDebugBoxes();
    const b = this.player.body;
    r.present({
      impact: this.feel.impact,
      zoomSteps: this.camera.zoomSteps,
      focus: [b.x - cx, b.y - 44 - cy],
      fade: [0.02, 0.02, 0.04, this.player.fade],
    });
  }

  private seedSpeedLines(): void {
    this.speedLines = [];
    for (let i = 0; i < 26; i++) {
      this.speedLines.push({
        y: Math.random(),
        x: Math.random() * RESOLUTIONS.far[0] * 1.4,
        len: 20 + Math.random() * 90,
        v: 9 + Math.random() * 12,
        c: Math.random() < 0.3 ? [1, 0.94, 0.72] : [0.3, 0.33, 0.52],
      });
    }
  }

  /** 0..1 strength of the world dim behind the cut-in (eases in and out). */
  private cutinDim(): number {
    const c = this.feel.cutin;
    if (!c) return 0;
    return Math.max(0, Math.min(1, c.t / 6, (c.duration - c.t) / 8));
  }

  /** Ultimate cut-in: a dark band slides in with speed lines and her eyes. */
  private drawCutin(): void {
    const c = this.feel.cutin;
    if (!c) return;
    const r = this.r;
    const D = c.duration;
    const inT = 7, outT = 8;
    let slide = 0;
    if (c.t < inT) slide = 1 - c.t / inT;
    else if (c.t > D - outT) slide = -(c.t - (D - outT)) / outT;
    slide = Math.sign(slide) * Math.pow(Math.abs(slide), 1.6);
    const [ew, eh] = this.cutinSize;
    const bandH = eh + 18;
    const by = Math.round(r.ih * 0.4 - bandH / 2);
    const off = Math.round(slide * r.iw);
    r.rect(off, by, r.iw, bandH, [0.04, 0.045, 0.09], 1, 1, true);
    r.rect(off, by - 2, r.iw, 1, [1, 0.88, 0.54], 1, 1, true);
    r.rect(off, by + bandH + 1, r.iw, 1, [1, 0.88, 0.54], 1, 1, true);
    r.rect(off, by, r.iw, 1, [0.36, 0.78, 1], 1, 1, true);
    r.rect(off, by + bandH - 1, r.iw, 1, [0.36, 0.78, 1], 1, 1, true);
    for (const l of this.speedLines) {
      const x = ((l.x % (r.iw + l.len)) + r.iw + l.len) % (r.iw + l.len) - l.len;
      r.rect(x + off, by + 3 + Math.floor(l.y * (bandH - 6)), l.len, 1, l.c, 1, 1, true);
    }
    const ex = Math.round(r.iw / 2 - ew / 2 + slide * r.iw * 1.25);
    r.sprite({ sheet: this.cutinSheet, sx: 0, sy: 0, sw: ew, sh: eh, x: ex, y: by + 9, lit: 0, screen: true });
    // two-tick additive white pop as it lands (uniform, not a dither)
    if (c.t < 2) r.rect(0, 0, r.iw, r.ih, [0.32, 0.32, 0.34], 0, 1, true);
  }

  /** Very quiet HUD: HP pips top-left, Q/R readiness top-right (touch buttons own the bottom). */
  private drawHud(): void {
    const r = this.r;
    const p = this.player;
    const y = 9;
    const diamond = (x: number, yy: number, s: number, c: RGB, opacity = 1): void =>
      r.vfx({ type: VFX_TYPE.diamond, t: 0, seed: 0, over: 1, p0: [s, s, 0, 0], p1: [opacity, 0, 0, 0], core: c, main: c, edge: c, x, y: yy, rot: 0, sx: 1, sy: 1, ext: [-s - 1, -s - 1, s + 1, s + 1], screen: true });
    for (let i = 0; i < this.tuning.player.hp; i++) {
      const on = i < p.hp;
      diamond(10 + i * 8, y, 3, on ? [0.96, 0.8, 0.42] : [0.22, 0.22, 0.3], on ? 0.9 : 0.8);
    }
    const pip = (x: number, cd: number, max: number): void => {
      const ready = cd <= 0;
      diamond(x, y, 3.6, ready ? [0.98, 0.86, 0.5] : [0.2, 0.2, 0.28], ready ? 0.85 : 0.9);
      if (!ready) {
        const w = Math.round(9 * (1 - cd / max));
        r.rect(x - 4, y + 6, w, 1, [0.6, 0.55, 0.45], 1, 0.9, true);
      }
    };
    pip(r.iw - 24, p.skillCd, this.tuning.player.skillCooldown);
    pip(r.iw - 11, p.ultCd, this.tuning.player.ultCooldown);
  }

  private drawDebugBoxes(): void {
    const r = this.r;
    for (const h of this.player.hurtboxes()) r.box(h.x, h.y, h.w, h.h, this.player.iframes ? [0.4, 0.4, 1] : [0.3, 1, 0.55]);
    for (const { box } of this.player.hitboxes()) r.box(box.x, box.y, box.w, box.h, [1, 0.2, 0.25]);
    const tb = this.turret.hurtbox();
    if (tb) r.box(tb.x, tb.y, tb.w, tb.h, [0.3, 1, 0.55]);
    for (const pr of this.turret.projectiles) {
      const b = this.turret.projectileBox(pr);
      r.box(b.x, b.y, b.w, b.h, [1, 0.2, 0.25]);
    }
    const pu = this.turret.pulse;
    if (pu) {
      const R = this.turret.pulseRadius();
      for (let i = 0; i < 48; i++) r.rect(pu.x + Math.cos((i / 48) * Math.PI * 2) * R, pu.y + Math.sin((i / 48) * Math.PI * 2) * R, 1, 1, [1, 0.2, 0.25]);
    }
    const b = this.player.body;
    r.rect(b.x - 2, b.y, 5, 1, [1, 1, 1]);
    r.rect(b.x, b.y - 2, 1, 5, [1, 1, 1]);
    for (const [name, c] of [["tip", [1, 0.9, 0.3]], ["halo", [0.5, 0.9, 1]]] as const) {
      const a = this.player.anchor(name);
      if (a) r.rect(a[0], a[1], 1, 1, [c[0], c[1], c[2]]);
    }
  }

  debugText(): string {
    const p = this.player;
    const c = p.clip;
    const f = c.frame;
    const b = p.body;
    const v = this.vfx.counts;
    const t = this.turret;
    return [
      `fps ${this.fps.toFixed(0)}  frame ${this.frameMs.toFixed(2)} ms  draws ${this.r.drawCalls}`,
      `res ${this.r.mode} ${this.r.iw}x${this.r.ih} @${this.r.out.scale}x  zoom+${this.camera.zoomSteps}`,
      `clip ${c.clip.id}  frame ${c.index + 1}/${c.clip.frames.length}  tick ${c.tick}  phase ${f.phase ?? "-"}${f.iframes ? "  iframes" : ""}`,
      `pose ${f.pose ?? "-"}  mode ${p.mode}  ${p.lastAction}`,
      `pos ${b.x.toFixed(1)}, ${b.y.toFixed(1)}  vel ${b.vx.toFixed(2)}, ${b.vy.toFixed(2)}  ${b.grounded ? "ground" : "air"}`,
      `hp ${p.hp}/${this.tuning.player.hp}  dash ${p.dashCd}  Q ${p.skillCd}  R ${p.ultCd}`,
      `lights ${this.r.lightCount}  effects ${v.effects}  particles ${v.particles}`,
      `turret ${t.state} hp ${Math.max(0, t.hp)}  aim ${t.aim.toFixed(0)}  shots ${t.projectiles.length}${t.close ? "  point-blank" : ""}`,
      `hitstop ${this.feel.hitstop}  slow ${this.feel.slowFactor}  impact ${this.feel.impact}${this.feel.reducedMotion ? "  reduced-motion" : ""}`,
      `sprites ${p.sprite.source}/${t.sprite.source}  sim ${this.simTicks}`,
    ].join("\n");
  }

  /** Test hook: plain state for automation. */
  state(): Record<string, unknown> {
    const p = this.player;
    return {
      clip: p.clip.clip.id,
      frame: p.clip.index,
      phase: p.clip.frame.phase ?? null,
      mode: p.mode,
      x: p.body.x,
      y: p.body.y,
      vx: p.body.vx,
      vy: p.body.vy,
      grounded: p.body.grounded,
      facing: p.facing,
      hp: p.hp,
      dead: p.dead,
      invuln: p.invuln,
      turret: {
        state: this.turret.state,
        hp: this.turret.hp,
        x: this.turret.x,
        y: this.turret.y,
        shots: this.turret.projectiles.length,
        fired: this.turret.shotsFired,
        pulses: this.turret.pulsesFired,
        close: this.turret.close,
      },
      fps: this.fps,
      lights: this.r.lightCount,
      res: this.r.mode,
      scale: this.r.out.scale,
      sim: this.simTicks,
      impact: this.feel.impact,
      cutin: this.feel.cutin?.id ?? null,
      slow: this.feel.slowFactor,
      zoom: this.camera.zoomSteps,
      counts: this.vfx.counts,
    };
  }
}

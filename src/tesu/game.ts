// Tesu's runtime: one continuous world. A 60 Hz simulation (the lab's Player on the
// continuous ground), a camera keyed to where she is, plates streamed where the camera
// looks, and a frame built from the depth stack with still water in the middle of it.
//
// Draw order (A.1): sky gradient, P0 sky pieces, P1 far, far mist, the far part of the
// lake, P2, mid mist, P3, P4 play (behind her), her and her effects, the near part of the
// lake, P4 front, P5 near. The reflection target is drawn first: the sky mirrored about
// the horizon, each plane about its own waterline, her about the play plane's.

import type { Action, Input } from "../lab/engine/input.ts";
import type { Camera as LabCamera } from "../lab/engine/camera.ts";
import type { Lighting, Renderer as LabRenderer } from "../lab/engine/renderer.ts";
import { Vfx } from "../lab/engine/vfx.ts";
import { Feel } from "../lab/game/feel.ts";
import { Player } from "../lab/game/player.ts";
import type { Services } from "../lab/game/events.ts";
import type { World as LabWorld } from "../lab/game/world.ts";
import { makeTarget, type Target, type WorldRenderer } from "../world/render/renderer.ts";
import { rgb } from "./art/palette.ts";
import { Camera, framingAt } from "./camera.ts";
import { Collision } from "./collide.ts";
import { Court, type Prize } from "./court.ts";
import { Props } from "./props.ts";
import { Sound } from "./sound.ts";
import { H, INTERIOR_Y, PHYSICS, TILE } from "./config.ts";
import { TileStore } from "./plates/store.ts";
import type { ZhushaAssets } from "./player.ts";
import { Atmos, type MistBand } from "./render/atmos.ts";
import { Motes } from "./render/motes.ts";
import { SpriteRenderer } from "./render/sprites.ts";
import { Opening } from "./opening.ts";
import { Titles } from "./title.ts";
import { PlaneRenderer, type PlaneLook, type TileQuad } from "./render/planes.ts";
import { eyeY, levelFor, planeLevels, planeXf, rowOf, type CamState } from "./render/view.ts";
import { buildWorld } from "./world/index.ts";
import { TERRACE_X0, TERRACE_X1 } from "./world/sections/common.ts";
import { isReload, loadSave, resumePlace, writeSave, type TesuSave } from "./save.ts";
import { PLANES, PLANE_IDS, type Atmos as AtmosDef, type PlaneId, type SpriteDef, type Spawn, type Usable, type Water, type WorldDef } from "./world/types.ts";

/** Flags that live only for this visit (never saved): a bout in progress. */
const TRANSIENT = new Set(["bout"]);

const DAY: Lighting = {
  ambient: [0.64, 0.66, 0.7],
  keyDir: [0.5, -0.66, 0.56],
  keyColour: [0.6, 0.58, 0.52],
  rimColour: [0.86, 0.96, 1.0],
  rimDir: [-0.62, -0.78],
  rimIntensity: 0.55,
  rimBoost: 1.25,
  rimPointGain: 1.1,
  rimThreshold: 0.4,
  bands: 6,
  lightRoom: 0.6,
  lightTint: 1.0,
  lightCap: 1.35,
};

interface PlaneDraw {
  quads: TileQuad[];
  look: PlaneLook;
  /** Every visible tile was ready at the chosen level. */
  complete: boolean;
  level: number;
}

const hexRgb = (h: string): [number, number, number] => rgb(h);

export interface TesuOpts {
  start: string;
  /** Started from a link (a place address): no resume, no opening. */
  link: boolean;
  /** Skip the opening on a fresh start (tools). */
  noOpening?: boolean;
  manual: boolean;
  sync: boolean;
}

export class TesuGame {
  readonly world: WorldDef;
  readonly collision: Collision;
  readonly camera = new Camera();
  readonly planes: PlaneRenderer;
  readonly store: TileStore;
  readonly atmos: Atmos;
  readonly sprites: SpriteRenderer;
  readonly titles: Titles;
  readonly opening: Opening;
  readonly player: Player;
  readonly vfx: Vfx;
  readonly feel: Feel;
  readonly flags = new Set<string>();
  /** The Prize Court's bouts (the board picks, the champion, the killing blow's download). */
  readonly court: Court;
  /** Things that break, with weight, and the support rule. */
  readonly props: Props;
  /** Effects, ambience beds and the adaptive score. */
  readonly sound = new Sound();
  /** Also told every score cue (tools). */
  onCue: (name: string) => void = () => {};
  /** A bout won: the note "it's in your downloads" (the page draws it). */
  onCelebrate: (prize: Prize) => void = () => {};
  private spriteById = new Map<string, SpriteDef>();
  readonly save: TesuSave;
  readonly motes = new Motes({ colours: [[1, 0.98, 0.9], [0.95, 0.97, 1], [1, 0.93, 0.7]], count: 46, drift: [7, -3], sway: 9, size: 1 });
  private closeSprite: ZhushaAssets["closeup"];
  refl: Target;
  debug = false;
  manual = false;
  loading = true;
  time = 0;
  tick = 0;
  fps = 0;
  private acc = 0;
  private simAcc = 0;
  private last = 0;
  private fpsN = 0;
  private fpsT = 0;
  private input: Input;
  private inputProxy: Input;
  private frozen = 0;
  /** Ink-wash fade (0..1) for the void tug-back. */
  fade = 0;
  private cutFade = 0;
  /** After a tug-back, movement keys count only once they have been let go. */
  private waitRelease = false;
  private fadeCut = 0;
  private tug: { t: number; x: number; y: number } | null = null;
  private lastSafe: [number, number] = [0, 0];
  private fallFrom: number | null = null;
  cloudDrop = false;
  private levels = new Map<PlaneId, number[]>();
  private lastLevel = new Map<PlaneId, number>();

  constructor(readonly r: WorldRenderer, input: Input, assets: ZhushaAssets, opts: TesuOpts) {
    this.world = buildWorld();
    this.collision = new Collision(this.world.walks, this.world.walls);
    this.collision.minX = 0;
    this.collision.maxX = this.world.w;
    const gl = r.gl;
    const maxLayers = Math.min(gl.getParameter(gl.MAX_ARRAY_TEXTURE_LAYERS) as number, 768);
    this.planes = new PlaneRenderer(gl, maxLayers);
    this.store = new TileStore(this.planes, { sync: opts.sync });
    this.atmos = new Atmos(gl, r.emptyVao);
    this.sprites = new SpriteRenderer(gl, r.emptyVao);
    this.titles = new Titles(gl, r.emptyVao);
    this.opening = new Opening({
      playerX: () => this.player.body.x,
      freeze: (t) => { this.frozen = Math.max(this.frozen, t); },
      title: (text, big) => this.titles.show(text, big),
      setFlag: (f) => this.setFlag(f),
      nextBar: () => this.sound.music.nextBar(),
      cue: (n) => this.cue(n),
    });
    this.refl = makeTarget(gl, r.iw, r.ih, false);
    r.onFrame = () => {
      gl.deleteFramebuffer(this.refl.fbo);
      gl.deleteTexture(this.refl.color.tex);
      this.refl = makeTarget(gl, r.iw, r.ih, false);
    };
    for (const id of PLANE_IDS) this.levels.set(id, planeLevels(PLANES[id].rate));
    this.input = input;
    this.manual = opts.manual;
    this.vfx = new Vfx(assets.vfx);
    const cam = this.camera;
    const labCam = {
      shake: (a: number, d: number) => cam.shake(a, d),
      zoom: (s: number) => cam.zoomPunch(s),
      reducedMotion: false,
    } as unknown as LabCamera;
    this.feel = new Feel(labCam, assets.tuning.feel);
    cam.reducedMotion = this.feel.reducedMotion;
    this.titles.reducedMotion = this.feel.reducedMotion;
    SpriteRenderer.driftScale = this.feel.reducedMotion ? 0.25 : 1;
    const services: Services = { vfx: this.vfx, feel: this.feel, camera: labCam };
    // frozen controls read nothing; "down" only means drop-through on one-way ground
    this.inputProxy = new Proxy(input, {
      get: (t, k, rcv) => {
        if (k === "isDown") return (a: Action) => (this.frozen > 0 ? false : a === "down" ? t.isDown(a) && this.collision.onOneWay(this.player.body) : t.isDown(a));
        if (k === "axis") return () => {
          if (this.frozen > 0) return 0;
          if (this.waitRelease) {
            if (t.isDown("left") || t.isDown("right")) return 0;
            this.waitRelease = false;
          }
          return t.axis();
        };
        if (k === "pressTick") return (a: Action) => (this.frozen > 0 || (a === "ult" && this.court?.ultLocked) ? undefined : t.pressTick(a));
        const v = Reflect.get(t, k, rcv);
        return typeof v === "function" ? v.bind(t) : v;
      },
    });
    this.player = new Player(assets.sprite, assets.tuning.player, services, [0, 0]);
    this.closeSprite = assets.closeup;
    this.vfx.groundAt = (x, y) => this.collision.groundAt(x, y);
    this.save = loadSave();
    for (const f of this.save.flags) if (!TRANSIENT.has(f)) this.flags.add(f);
    for (const s of this.world.sprites) this.spriteById.set(s.id, s);
    this.court = new Court({
      player: this.player, vfx: this.vfx, feel: this.feel, camera: this.camera,
      sprite: (id) => {
        const s = this.spriteById.get(id);
        if (!s) throw new Error(`no sprite ${id}`);
        return s;
      },
      setFlag: (f, on) => this.setFlag(f, on),
      freeze: (n) => { this.frozen = Math.max(this.frozen, n); },
      cue: (n) => this.cue(n),
      celebrate: (p) => this.onCelebrate(p),
    });
    this.feel.onSound = (id, v) => this.sound.sfx(id, v);
    this.props = new Props({
      player: this.player, vfx: this.vfx, feel: this.feel, camera: this.camera,
      ground: (x, y) => this.collision.groundBelow(x, y)?.y ?? null,
      addSprite: (s) => { this.world.sprites.push(s); this.spriteById.set(s.id, s); },
      removeSprite: (id) => {
        const i = this.world.sprites.findIndex((s) => s.id === id);
        if (i >= 0) this.world.sprites.splice(i, 1);
        this.spriteById.delete(id);
      },
      setFlag: (f, on) => this.setFlag(f, on),
      hasFlag: (f) => this.flags.has(f),
      usables: () => this.world.usables,
      bottom: this.world.h + 4 * H,
    }, this.world.props, (id) => this.spriteById.get(id)!);
    const catchS = this.world.spawns.find((s) => s.id === "catch")!;
    const resume = opts.link ? null : resumePlace(this.save, Date.now(), catchS.x, isReload());
    if (resume) this.spawnAt({ id: "resume", x: resume.x, y: resume.y, facing: resume.facing });
    else this.spawnAt(this.world.spawns.find((s) => s.id === opts.start) ?? catchS);
    this.startedBy = resume ? "resume" : opts.link ? "link" : "fresh";
    if (this.startedBy === "fresh" && !opts.noOpening) {
      this.opening.start();
      this.camera.snap(this.player.body.x, this.player.body.y, this.framing(), 1);
    }
  }

  readonly startedBy: "fresh" | "resume" | "link" = "fresh";

  /** Sets a progress flag (kept on this device). */
  setFlag(f: string, on = true): void {
    if (on === this.flags.has(f)) return;
    if (on) this.flags.add(f);
    else this.flags.delete(f);
    if (TRANSIENT.has(f)) return;
    this.save.flags = [...this.flags].filter((x) => !TRANSIENT.has(x));
    writeSave(this.save);
  }

  /** A score cue (the opening, the court, the hall). */
  private cue(name: string): void {
    this.sound.music.cue(name);
    this.onCue(name);
  }

  /**
   * The score follows her, not a clock: in the opening a drum layer comes in at each mark
   * (the jetty's last posts, the shore, the three gates); the hall gathers the music into its
   * quiet; outdoors after the opening the calm landscape form plays; beds follow the place.
   */
  private scoreTick(): void {
    const b = this.player.body;
    const m = this.sound.music;
    if (this.opening.active && !m.dropped) {
      const marks = [103, 108, 115, 119, 123];
      let n = 0;
      for (const k of marks) if (b.x >= k * H) n++;
      if (n > m.layers) this.cue(`calm:layer:${n}`);
    }
    if (this.tick % 30 !== 0) return;
    const inside = b.y >= INTERIOR_Y;
    this.sound.setBed(inside ? "hall" : b.x < 109 * H ? "lake" : "heights");
    if (inside && m.mood !== "hall" && m.mood !== "intense") this.cue("music:hall");
    else if (!inside && !this.opening.active && (m.mood === "off" || m.mood === "hall")) this.cue("music:land");
  }

  private notePlace(): void {
    const b = this.player.body;
    if (!b.grounded || this.tug) return;
    this.save.place = { x: Math.round(b.x), y: Math.round(b.y), facing: this.player.facing as 1 | -1, at: Date.now() };
    writeSave(this.save);
  }

  spawnAt(s: Spawn): void {
    const b = this.player.body;
    b.x = s.x;
    b.y = s.y;
    b.vx = b.vy = 0;
    b.grounded = false;
    this.player.facing = s.facing;
    this.player.checkpoint = [s.x, s.y];
    this.collision.move(b, 0, 1);
    this.lastSafe = [b.x, b.y];
    this.camera.snap(b.x, b.y, this.framing(), s.facing);
  }

  /** Puts her at world x (y = the ground there) and settles the camera. */
  place(x: number, y?: number): void {
    const g = this.collision.groundBelow(x, y ?? -1e9);
    this.spawnAt({ id: "place", x, y: y ?? g?.y ?? 0, facing: this.player.facing as 1 | -1 });
  }

  /** A held entrance shot (indoors grand): zoom and where it frames, seconds left. */
  vista: { zoom: number; x: number; y: number; anchor: number; t: number } | null = null;
  /** Doors, services and things to inspect within reach (nearest first). */
  near: Usable | null = null;
  /** A scene cut in progress (through a door). */
  private cut: { t: number; to: Spawn; title?: string } | null = null;
  /** What happens when she uses something (panels live in the page, not here). */
  onUse: (u: Usable) => void = () => {};
  /** Places already entered this visit (place names show once each). */
  private entered = new Set<string>();

  /** Debug and tools: force a framing (zoom, anchor, horizon), or null to follow the tracks. */
  framingOverride: Partial<ReturnType<typeof framingAt>> | null = null;

  private framing(): ReturnType<typeof framingAt> {
    const has = (fl: string): boolean => (fl === "opening" ? this.opening.active : this.flags.has(fl));
    // the widest frame holds until the drop has landed, wherever she has got to
    const x = this.opening.holding ? Math.min(this.player.body.x, TERRACE_X1) : this.player.body.x;
    let f = framingAt(this.world.tracks, Math.max(x, this.opening.holding ? TERRACE_X0 + 1 : -Infinity), has, this.player.body.y);
    // an entrance shot: a held vista on first entry, ended early by moving
    if (this.vista) f = { ...f, zoom: this.vista.zoom, fixX: this.vista.x, fixY: this.vista.y, anchor: this.vista.anchor, pin: null };
    return this.framingOverride ? { ...f, ...this.framingOverride } : f;
  }

  // --- time ---------------------------------------------------------------

  frame(now: number): void {
    const dt = Math.min(100, this.last ? now - this.last : 16.7);
    this.last = now;
    this.fpsN++;
    this.fpsT += dt;
    if (this.fpsT >= 500) {
      this.fps = (this.fpsN * 1000) / this.fpsT;
      this.fpsN = 0;
      this.fpsT = 0;
    }
    if (!this.manual) {
      this.acc += dt;
      let n = 0;
      while (this.acc >= 1000 / 60 && n < 6) {
        this.realTick();
        this.acc -= 1000 / 60;
        n++;
      }
      if (n >= 6) this.acc = 0;
    }
    this.render();
  }

  realTick(): void {
    this.tick++;
    this.time += 1 / 60;
    this.feel.realTick();
    this.vfx.realTick();
    this.simAcc += this.feel.slowFactor;
    while (this.simAcc >= 1) {
      this.simAcc -= 1;
      this.simTick();
    }
    const b = this.player.body;
    this.camera.W = this.r.iw;
    this.camera.H = this.r.ih;
    const f = this.framing();
    const cuts = this.camera.cuts;
    this.camera.update(b.x, b.y, this.player.facing, b.vx, f);
    // reduced motion: a cut between held frames is a short dithered cross-fade, not a swing
    if (this.camera.cuts !== cuts && this.tick > 2) this.cutFade = 1;
    this.cutFade = Math.max(0, this.cutFade - 1 / 12);
    this.tugTick();
    this.cutTick();
    if (this.vista) {
      this.vista.t -= 1 / 60;
      if (this.vista.t <= 0 || Math.abs(b.vx) > 0.6) this.vista = null;
    }
    this.near = this.cut || this.tug ? null : this.findNear();
    this.placeNames();
    this.motes.update(1 / 60);
    this.opening.tick(1 / 60);
    this.scoreTick();
    this.titles.update(1 / 60);
    if (this.tick % 60 === 0) this.notePlace();
  }

  private simTick(): void {
    if (this.feel.hitstop > 0) {
      this.feel.hitstop--;
      return;
    }
    if (this.frozen > 0) this.frozen--;
    const b = this.player.body;
    const wasGrounded = b.grounded;
    this.collision.holdDown = this.frozen <= 0 && this.input.isDown("down");
    this.player.update(this.inputProxy, this.collision as unknown as LabWorld, []);
    this.court.tick();
    this.props.takeHits(this.player);
    this.props.tick();
    this.vfx.update();
    this.input.tick++;
    // falls: no damage anywhere; a long one is a cloud drop
    if (b.grounded) {
      if (this.fallFrom !== null && b.y - this.fallFrom > PHYSICS.cloudDrop * H) {
        this.vfx.spawn("dust.land", { x: b.x, y: b.y, facing: 1 });
        this.camera.shake(3, 10);
      }
      this.fallFrom = null;
      this.cloudDrop = false;
      if (!this.collision.onOneWay(b) || this.collision.standingOn) this.lastSafe = [b.x, b.y];
    } else {
      if (wasGrounded || this.fallFrom === null) this.fallFrom = this.fallFrom ?? b.y;
      if (this.fallFrom !== null && b.y - this.fallFrom > 1.5 * 9 * H) this.cloudDrop = true;
    }
    // the void: a fall into nothing fades and the hat talisman tugs her back
    if (!this.tug) {
      for (const v of this.world.voids) {
        if (b.x >= v.x0 && b.x <= v.x1 && b.y > v.y && (v.y1 === undefined || b.y < v.y1)) {
          this.tug = { t: 0, ...this.safeSpot() };
          this.frozen = 9999;
          break;
        }
      }
      if (b.y > this.world.h + H * 4) this.tug = { t: 0, ...this.safeSpot() };
    }
  }

  /**
   * Where the tug-back sets her down: the last ground she stood on, a step back from the
   * edge she left (on the same ground), so she never lands on the lip.
   */
  private safeSpot(): { x: number; y: number } {
    const [x, y] = this.lastSafe;
    const away = -this.player.facing;
    for (const step of [0.8, 0.5, 0.25]) {
      const nx = x + away * step * H;
      const g = this.collision.groundBelow(nx, y - 0.3 * H);
      if (g && Math.abs(g.y - y) < 0.4 * H) return { x: nx, y: g.y };
    }
    return { x, y };
  }

  private tugTick(): void {
    if (!this.tug) {
      this.fade = Math.max(0, this.fade - 0.04);
      return;
    }
    this.tug.t++;
    this.fade = Math.min(1, this.tug.t / 24);
    if (this.tug.t === 30) {
      const b = this.player.body;
      b.x = this.tug.x;
      b.y = this.tug.y - 2;
      b.vx = b.vy = 0;
      b.grounded = false;
      this.collision.move(b, 0, 4);
      this.camera.snap(b.x, b.y, this.framing(), this.player.facing);
      this.fallFrom = null;
    }
    if (this.tug.t >= 36) {
      this.tug = null;
      this.frozen = 6;
      // a key still held from before the fall does not walk her straight off again
      this.waitRelease = true;
    }
  }

  // --- using things ---------------------------------------------------------

  /** The nearest usable thing within reach of her (about half an H around its area). */
  private findNear(): Usable | null {
    const b = this.player.body;
    const reach = 0.45 * H;
    let best: Usable | null = null, bd = Infinity;
    for (const u of this.world.usables) {
      if (b.x < u.x0 - reach || b.x > u.x1 + reach || b.y < u.y0 - reach || b.y - b.h > u.y1 + reach) continue;
      const d = Math.abs(b.x - (u.x0 + u.x1) / 2);
      if (d < bd) { bd = d; best = u; }
    }
    return best;
  }

  /** F, Enter or a tap on the thing: use what is within reach. */
  use(u: Usable | null = this.near): void {
    if (!u || this.cut || this.tug) return;
    // the board waits while a bout is on; leaving through a door ends the bout
    if (this.court.busy && u.action.kind === "panel" && u.action.panel === "board") return;
    if (u.action.kind === "door") {
      this.court.cancel();
      const id = u.action.to;
      const to = this.world.spawns.find((sp) => sp.id === id);
      if (to) this.cut = { t: 0, to, title: u.action.title };
      return;
    }
    this.onUse(u);
  }

  /** The usable thing under a frame point (touch: object taps win). */
  usableAt(fx: number, fy: number): Usable | null {
    const cam = this.camera.state();
    const xf = planeXf(cam, 1);
    const x = (fx - xf.offX) / xf.s, y = (fy - xf.offY) / xf.s;
    const b = this.player.body;
    for (const u of this.world.usables) {
      if (x >= u.x0 && x <= u.x1 && y >= u.y0 - H && y <= u.y1 && Math.abs(b.x - (u.x0 + u.x1) / 2) < 4 * H) return u;
    }
    return null;
  }

  /** A door is a scene cut: fade, move, fade back in on the other side (with its entrance shot). */
  private cutTick(): void {
    const c = this.cut;
    if (!c) return;
    c.t++;
    this.frozen = Math.max(this.frozen, 2);
    if (c.t === 16) {
      this.spawnAt(c.to);
      if (c.to.y >= INTERIOR_Y && !this.entered.has(`vista:${c.to.id}`)) {
        // the held Vista entrance shot of an indoors-grand room (about 2.5 s; moving ends it)
        this.entered.add(`vista:${c.to.id}`);
        const room = this.world.places.find((p) => c.to.x >= p.x0 && c.to.x <= p.x1 && p.y0 !== undefined && c.to.y >= p.y0);
        if (room && room.vista !== undefined) {
          this.vista = { zoom: 0.5, x: (room.x0 + room.x1) / 2, y: room.vista, anchor: 0.82, t: 2.5 };
          this.camera.snap(this.player.body.x, this.player.body.y, this.framing(), c.to.facing);
        }
      }
    }
    this.fadeCut = c.t < 16 ? c.t / 16 : Math.max(0, 1 - (c.t - 16) / 18);
    if (c.t >= 34) {
      this.cut = null;
      this.fadeCut = 0;
    }
  }

  /** Small place names, once each per visit, as she crosses into a place. */
  private placeNames(): void {
    const b = this.player.body;
    for (const p of this.world.places) {
      if (p.title !== "place" || this.entered.has(p.id)) continue;
      if (b.x < p.x0 || b.x > p.x1) continue;
      if ((p.y0 !== undefined && b.y < p.y0) || (p.y1 !== undefined && b.y > p.y1)) continue;
      if (p.y0 === undefined && b.y >= INTERIOR_Y) continue;
      this.entered.add(p.id);
      if (this.opening.active) continue;
      this.titles.show(p.name, false, b.y >= INTERIOR_Y);
    }
  }

  // --- drawing ------------------------------------------------------------

  /**
   * Her sprite. In the close band (zoom near 2) she is drawn from the 192 px render at
   * native size (the same clip and frame), never as a magnified 96 px sprite.
   */
  private drawPlayer(cam: CamState, focus: [number, number], mirror: number | null): void {
    const r = this.r, p = this.player;
    if (this.fade >= 1) return;
    if (cam.zoom < 1.9) {
      p.draw(r as unknown as LabRenderer);
      return;
    }
    const clip = this.closeSprite.clips.get(p.clip.clip.id);
    const f = clip?.frames[p.clip.index];
    const sheet = clip ? this.closeSprite.sheets.get(clip.atlas) : undefined;
    if (!f || !sheet) {
      p.draw(r as unknown as LabRenderer);
      return;
    }
    const k = cam.zoom / 2;
    const [sx, sy, sw, sh] = f.rect;
    const [px, py] = f.pivot;
    const xf = planeXf(cam, 1);
    const fx = p.body.x * xf.s + xf.offX, fy = p.body.y * xf.s + xf.offY;
    const x = p.facing > 0 ? fx - px * k : fx - (sw - px) * k;
    let y = fy - py * k;
    if (mirror !== null) y = 2 * mirror - (fy + (sh - py) * k);
    r.setTransform();
    r.sprite({ sheet, sx, sy: mirror !== null ? sy : sy, sw, sh, x: Math.round(x), y: Math.round(y), flip: p.facing < 0, screen: true });
    r.flush();
    void focus;
  }

  private atmosAt(x: number, y: number): AtmosDef {
    const list = this.world.atmos.filter((e) => (e.y0 === undefined || y >= e.y0) && (e.y1 === undefined || y <= e.y1) && (e.y0 !== undefined || y < INTERIOR_Y));
    let a = list[0] ?? this.world.atmos[0]!;
    for (const e of list) if (e.x <= x) a = e;
    return a;
  }

  private look(id: PlaneId, a: AtmosDef): PlaneLook {
    const sp = PLANES[id];
    return { haze: hexRgb(a.haze), fade: sp.fade, ink: hexRgb("#1b1922"), inkAmt: sp.ink, grade: [1, 1, 1, 0] };
  }

  /**
   * Tiles of a plane covering frame rows [ya, yb), at the level for the current zoom.
   * Requests what is missing; draws the last complete level underneath until it lands.
   */
  private planeQuads(cam: CamState, id: PlaneId, ya: number, yb: number, a: AtmosDef, prefetch: boolean): PlaneDraw {
    const rate = PLANES[id].rate;
    const xf = planeXf(cam, rate);
    const levels = this.levels.get(id)!;
    const level = levelFor(levels, xf.g);
    const quads: TileQuad[] = [];
    let complete = true;
    const add = (lv: number, mark: boolean): void => {
      const k = xf.g / lv;
      const ax0 = (0 - xf.offX) / k, ax1 = (cam.W - xf.offX) / k;
      const ay0 = (ya - xf.offY) / k, ay1 = (yb - xf.offY) / k;
      const tx0 = Math.floor(ax0 / TILE), tx1 = Math.floor((ax1 - 1e-6) / TILE);
      const ty0 = Math.floor(ay0 / TILE), ty1 = Math.floor((ay1 - 1e-6) / TILE);
      const cxT = (tx0 + tx1) / 2, cyT = (ty0 + ty1) / 2;
      const planePri = id === "play" ? 0 : id === "front" || id === "back" ? 1 : 2;
      for (let ty = ty0; ty <= ty1; ty++) {
        for (let tx = tx0; tx <= tx1; tx++) {
          const pri = planePri + Math.hypot(tx - cxT, ty - cyT) * 0.5 + (mark ? 0 : 10);
          const layer = mark ? this.store.get(id, lv, tx, ty, pri) : this.peek(id, lv, tx, ty);
          if (layer === -1 && mark) complete = false;
          if (layer < 0) continue;
          quads.push({ x0: tx * TILE * k + xf.offX, y0: ty * TILE * k + xf.offY, x1: (tx + 1) * TILE * k + xf.offX, y1: (ty + 1) * TILE * k + xf.offY, layer });
        }
      }
      if (prefetch && mark) {
        for (let tx = tx0 - 1; tx <= tx1 + 1; tx++) {
          this.store.want(id, lv, tx, ty0 - 1, planePri + 20);
          this.store.want(id, lv, tx, ty1 + 1, planePri + 20);
        }
        for (let ty = ty0; ty <= ty1; ty++) {
          this.store.want(id, lv, tx0 - 1, ty, planePri + 20);
          this.store.want(id, lv, tx1 + 1, ty, planePri + 20);
        }
      }
    };
    add(level, true);
    if (!complete) {
      const prev = this.lastLevel.get(id);
      if (prev !== undefined && prev !== level) {
        const top = quads.splice(0);
        add(prev, false);
        quads.push(...top);
      }
    } else this.lastLevel.set(id, level);
    return { quads, look: this.look(id, a), complete, level };
  }

  /** A tile's layer if it is already painted at that level (never requests). */
  private peek(id: PlaneId, lv: number, tx: number, ty: number): number {
    return this.store.peek(id, lv, tx, ty);
  }

  private activeWater(cam: CamState): Water | null {
    // the water whose near extent is closest to the camera's x
    let best: Water | null = null, d = Infinity;
    for (const w of this.world.waters) {
      const x0 = Math.min(w.x0, w.fx0 ?? w.x0), x1 = Math.max(w.x1, w.fx1 ?? w.x1);
      const span = cam.W / Math.min(1, cam.zoom) / 0.06;
      if (cam.cx + span < x0 || cam.cx - span > x1) continue;
      const dd = cam.cx < w.x0 ? w.x0 - cam.cx : cam.cx > w.x1 ? cam.cx - w.x1 : 0;
      if (dd < d) { d = dd; best = w; }
    }
    return best;
  }

  render(): void {
    const r = this.r, gl = r.gl;
    if (this.manual) this.store.drain();
    else this.store.pump();
    this.sprites.newFrame();
    this.store.frame++;
    const cam = this.camera.state();
    const W = cam.W, Hf = cam.H;
    const a = this.atmosAt(cam.cx, cam.cy);
    const hz = cam.horizon * Hf;
    const sunPx: [number, number, number] = a.sun ? [a.sun[0] * W, a.sun[1] * Hf, 9] : [0, 0, 0];
    const sky = [hexRgb(a.sky[0]), hexRgb(a.sky[1]), hexRgb(a.sky[2])];
    const water = this.activeWater(cam);
    const draws = new Map<PlaneId, PlaneDraw>();
    for (const id of PLANE_IDS) draws.set(id, this.planeQuads(cam, id, 0, Hf, a, !this.manual));
    this.loading = ![...draws.values()].every((d) => d.complete);
    const z = cam.zoom;
    const xfPlay = planeXf(cam, 1);
    const focus: [number, number] = [W / 2, cam.anchor * Hf];
    // the sprite renderer maps x to ((x - camX) - fx) * s + fx: match the play plane exactly
    const s4 = xfPlay.s;
    const camX = (focus[0] * (1 - s4) - xfPlay.offX) / s4, camY = (focus[1] * (1 - s4) - xfPlay.offY) / s4;
    const b = this.player.body;
    const lights = this.vfx.pointLights();

    // --- the reflection target
    let wlPlay = Hf;
    if (water) {
      wlPlay = rowOf(cam, 1, water.y);
      r.bindTarget(this.refl, true, [0, 0, 0, 1]);
      this.atmos.drawSky(W, Hf, hz, sky[0]!, sky[1]!, sky[2]!, sunPx, true);
      for (const id of PLANE_IDS) {
        if (id === "near") continue;
        const m = rowOf(cam, PLANES[id].rate, water.y);
        if (m >= Hf + 2) continue;
        const pd = this.planeQuads(cam, id, Math.max(-Hf * 3, 2 * m - Hf), m + 1, a, false);
        this.planes.draw(pd.quads, pd.look, W, Hf, m);
        this.sprites.draw(this.world.sprites.filter((sp) => sp.plane === id && sp.reflect !== false), cam, pd.look, this.time, m, this.manual);
        if (id === "play") {
          r.begin(camX, camY, DAY, lights);
          r.setTransform(s4, focus, wlPlay);
          if (cam.zoom < 1.9) this.drawPlayer(cam, focus, wlPlay);
          r.flush();
          r.setTransform();
        }
      }
    }

    // --- the frame
    r.bindTarget(r.main, true, [0, 0, 0, 1]);
    this.atmos.drawSky(W, Hf, hz, sky[0]!, sky[1]!, sky[2]!, sunPx, false);
    const eye = eyeY(cam);
    const waterDraw = (rows: [number, number]): void => {
      if (!water) return;
      this.atmos.drawWater(W, Hf, this.refl.color.tex, {
        hz, eye, wy: water.y, z, cx: cam.cx, lens: 1, focus,
        ext: [water.x0, water.x1, water.fx0 ?? water.x0, water.fx1 ?? water.x1],
        depth: [water.near, water.far], rows, time: this.time,
        deep: hexRgb(a.water?.deep ?? "#1f5a60"), body: hexRgb(a.water?.body ?? "#3f8f8a"), shallow: hexRgb(a.water?.shallow ?? "#bfe0dc"),
        haze: hexRgb(a.haze), glint: hexRgb(a.water?.glint ?? "#fffbe8"), still: water.kind === "lake" ? 1 : 0.4,
      });
    };
    const mist = (rate: number, strength: number, drift: number): void => {
      if (!water || a.mist <= 0) return;
      const row = rowOf(cam, rate, water.y);
      const band: MistBand = { row: row - 4 * Math.max(Math.min(1, z), 0.3), half: 26 * Math.max(0.45, planeXf(cam, rate).g), density: a.mist * strength, drift };
      this.atmos.drawMist(W, Hf, [band], hexRgb(a.mistColour), this.time, cam.cx * rate);
    };
    // the lake is a flat plane: each band of its rows sits between two planes' waterlines,
    // so it is drawn in slices, each in front of the planes behind it
    const wl = (id: PlaneId): number => (water ? rowOf(cam, PLANES[id].rate, water.y) : Hf);
    let waterFrom = 0;
    const waterTo = (row: number): void => {
      const to = Math.min(Hf, Math.ceil(row));
      if (water && to > waterFrom) waterDraw([Math.max(0, Math.floor(waterFrom)), to]);
      waterFrom = Math.max(waterFrom, to);
    };
    for (const id of PLANE_IDS) {
      const d = draws.get(id)!;
      if (id === "mid") {
        waterTo(wl("mid"));
        mist(PLANES.far.rate, 1, 4);
      }
      if (id === "back") {
        waterTo(wl("back"));
        mist(PLANES.mid.rate, 0.75, 7);
      }
      if (id === "play") waterTo(wl("play"));
      if (id === "front") {
        // her and her effects, then the near water over the play plane's underwater parts
        r.begin(camX, camY, DAY, lights);
        if (s4 !== 1) r.setTransform(s4, focus);
        this.vfx.draw(r as unknown as LabRenderer, "back");
        this.vfx.drawAfterimages(r as unknown as LabRenderer);
        this.drawPlayer(cam, focus, null);
        if (s4 !== 1) r.setTransform(s4, focus);
        this.vfx.draw(r as unknown as LabRenderer, "front");
        r.flush();
        r.setTransform();
        this.motes.draw(r, cam, 1);
        r.flush();
        waterTo(Hf);
      }
      if (id === "near" && z > 1.6) continue;
      this.planes.draw(d.quads, d.look, W, Hf);
      this.sprites.draw(this.world.sprites.filter((sp) => sp.plane === id), cam, d.look, this.time, null, this.manual);
      // banks of mist lying in valleys at this depth
      for (const m of this.world.mists) {
        if (m.after !== id) continue;
        const xf = planeXf(cam, m.rate);
        const fx0 = m.x0 * m.rate * xf.g + xf.offX, fx1 = m.x1 * m.rate * xf.g + xf.offX;
        if (fx1 < 0 || fx0 > W) continue;
        const row = m.y * m.rate * xf.g + xf.offY;
        this.atmos.drawMist(W, Hf, [{ row, half: m.half * m.rate * xf.g, density: m.density, drift: 5 }], hexRgb(a.mistColour), this.time, cam.cx * m.rate, [fx0, fx1]);
      }
      // a big title written into the landscape after its plane (nearer planes pass in front)
      this.titles.draw(W, Hf, id);
      if (id === "back" || id === "near") {
        r.begin(camX, camY, DAY, lights);
        this.motes.draw(r, cam, id === "back" ? 0.6 : 1.3);
        r.flush();
      }
    }
    this.drawPrompt(cam);
    this.titles.draw(W, Hf);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    void b;
    r.present({
      impact: this.feel.impact,
      zoom: 1 + this.camera.punch,
      view: 1,
      focus: [W / 2, cam.anchor * Hf],
      fade: [0.106, 0.098, 0.133, this.loading && this.tick < 2 ? 1 : Math.max(this.fade, this.cutFade * 0.85, this.fadeCut)],
      bars: 0,
      overlay: false,
    });
  }

  /** The F key cap over the thing within reach (it bobs a little). */
  private drawPrompt(cam: CamState): void {
    const u = this.near;
    if (!u || this.cut) return;
    const xf = planeXf(cam, 1);
    const fx = Math.round(((u.x0 + u.x1) / 2) * xf.s + xf.offX);
    const fy = Math.round(u.y0 * xf.s + xf.offY - 18 + Math.round(Math.sin(this.time * 4) * 1.5));
    const r = this.r;
    r.begin(0, 0, DAY, []);
    const ink: [number, number, number] = [0.106, 0.098, 0.133];
    const paper: [number, number, number] = [1, 0.98, 0.94];
    r.rect(fx - 8, fy - 8, 17, 17, ink, 1, 1, true);
    r.rect(fx - 7, fy - 7, 15, 15, paper, 1, 1, true);
    r.rect(fx - 6, fy + 5, 13, 2, [0.8, 0.75, 0.66], 1, 1, true);
    r.rect(fx - 3, fy - 4, 2, 8, ink, 1, 1, true);
    r.rect(fx - 3, fy - 4, 7, 2, ink, 1, 1, true);
    r.rect(fx - 3, fy - 1, 5, 2, ink, 1, 1, true);
    r.flush();
  }

  state(): Record<string, unknown> {
    const b = this.player.body;
    const cam = this.camera;
    return {
      x: Math.round(b.x), y: Math.round(b.y), xH: +(b.x / H).toFixed(2), yH: +(b.y / H).toFixed(2),
      grounded: b.grounded, vx: +b.vx.toFixed(2), vy: +b.vy.toFixed(2), facing: this.player.facing,
      on: this.collision.standingOn?.name ?? null, surface: this.collision.lastSurface,
      zoom: +cam.zoom.toFixed(4), wantZoom: +cam.wantZoom.toFixed(4), atLevel: cam.atLevel, anchor: +cam.anchor.toFixed(3), horizon: +cam.horizon.toFixed(3),
      cam: [Math.round(cam.cx), Math.round(cam.cy)], loading: this.loading, fade: +this.fade.toFixed(2), cloudDrop: this.cloudDrop,
      tiles: this.store.stats(), fps: Math.round(this.fps), frame: [this.r.iw, this.r.ih], present: this.r.presenter.rect,
      clip: this.player.clip.clip.id,
      opening: this.opening.state, startedBy: this.startedBy, near: this.near?.id ?? null, cut: !!this.cut,
      court: this.court.state_(), hp: this.player.hp, ultCd: this.player.ultCd,
      props: this.props.state(), airborne: this.props.airborne(), broken: this.props.broken,
      music: { mood: this.sound.music.mood, layers: this.sound.music.layers, dropped: this.sound.music.dropped, nextBar: +this.sound.music.nextBar().toFixed(2) },
    };
  }

  debugText(): string {
    const s = this.state();
    return Object.entries(s).map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`).join("\n");
  }
}

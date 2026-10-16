// Tesu's runtime: one continuous world. A 60 Hz simulation (Zhusha's controller,
// zhusha/controller.ts, on the continuous ground), a camera keyed to where she is, plates streamed where the camera
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
import { Zhusha, type MoveWorld } from "./zhusha/controller.ts";
import { ZhushaDraw } from "./zhusha/draw.ts";
import { makeTarget, type Target, type WorldRenderer } from "../world/render/renderer.ts";
import { rgb } from "./art/palette.ts";
import { Camera, framingAt } from "./camera.ts";
import { Collision } from "./collide.ts";
import { Court, type Prize } from "./court.ts";
import { Props } from "./props.ts";
import { Rides } from "./ride.ts";
import { blendAtmos } from "./atmos-blend.ts";
import { Sound } from "./sound.ts";
import { CHARM_PERCH, H, INTERIOR_Y, PHYSICS, TILE } from "./config.ts";
import { TileStore } from "./plates/store.ts";
import type { ZhushaAssets } from "./player.ts";
import { Atmos, waterHolds, type MistBand, type SkyGlow } from "./render/atmos.ts";
import { Motes } from "./render/motes.ts";
import { SpriteRenderer } from "./render/sprites.ts";
import { Opening } from "./opening.ts";
import { SilentLink, type OpeningLink } from "./opening/conductor.ts";
import { HAT_TIE, Ofuda, type OfudaPose } from "./opening/ofuda.ts";
import { BEATS, cameraAt, herXH } from "./opening/timeline.ts";
import { Titles } from "./title.ts";
import { PlaneRenderer, type PlaneLook, type TileQuad } from "./render/planes.ts";
import { eyeY, levelFor, planeLevels, planeXf, rowOf, type CamState } from "./render/view.ts";
import { buildWorld } from "./world/index.ts";
import { isReload, loadSave, resumePlace, writeSave, type TesuSave } from "./save.ts";
import { PLANES, PLANE_IDS, type CharmDef, type Atmos as AtmosDef, type PlaneId, type SpriteDef, type Spawn, type Usable, type Water, type WorldDef } from "./world/types.ts";

/** Flags that live only for this visit (never saved): a bout in progress. */
const TRANSIENT_FLAGS = new Set(["bout"]);
/** The Pillar Hop's paper charms: how far below the charm her feet hang, how far ahead Q reaches one, how long a warp, a hold and a re-arm last (ticks). */
const PERCH = CHARM_PERCH;
const CHARM_REACH = 7 * H;
const WARP_T = 10;
const PERCH_T = 50;
const CHARM_REARM = 120;
/** Flags for this visit only (a bout on, a ride under way): never saved. */
const TRANSIENT = { has: (f: string): boolean => TRANSIENT_FLAGS.has(f) || f.startsWith("ride:") };

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

/** A plate tile of the opening set: first and last T the opening's camera has it on screen; rank: what for (game.ts warmPlan). */
interface WarmTile {
  id: PlaneId;
  lv: number;
  tx: number;
  ty: number;
  k: string;
  from: number;
  until: number;
  rank: number;
}

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
  /**
   * The page column's world window (`/`): show Kagami still, controls held, until the PLAY
   * press (or "continue") calls play() with the page's conductor, which starts the opening at T 0.
   */
  hold?: boolean;
  manual: boolean;
  sync: boolean;
  /**
   * (the homepage) The frame the opening will run at, if not the one drawn now: the world window waits between
   * the page's bars and is the whole window from the press, so the opening set is planned for that size.
   */
  landed?: () => [number, number] | null;
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
  readonly player: Zhusha;
  /** Her drawings (traced pixel art per slot) or the white box. */
  readonly zdraw: ZhushaDraw;
  readonly vfx: Vfx;
  readonly feel: Feel;
  readonly flags = new Set<string>();
  /** The Prize Court's bouts (the board picks, the champion, the killing blow's download). */
  readonly court: Court;
  /** Things that break, with weight, and the support rule. */
  readonly props: Props;
  /** Ropeways (the Silk Line): two cars on a cable, and the ride she is on. */
  readonly rides: Rides;
  /** Effects, ambience beds and the adaptive score. */
  readonly sound = new Sound();
  /** Also told every score cue (tools). */
  onCue: (name: string) => void = () => {};
  /** A bout won: the note "it's in your downloads" (the page draws it). */
  onCelebrate: (prize: Prize) => void = () => {};
  private spriteById = new Map<string, SpriteDef>();
  readonly save: TesuSave;
  readonly motes = new Motes({ colours: [[1, 0.98, 0.9], [0.95, 0.97, 1], [1, 0.93, 0.7]], count: 46, drift: [7, -3], sway: 9, size: 1 });
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
  private cloudSpeed = 0;
  private levels = new Map<PlaneId, number[]>();
  private lastLevel = new Map<PlaneId, number>();
  /** (round 7) The frame size the last picture was drawn at; the first scene has been shown. */
  private drawnAt = "";
  private shown = false;

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
    // (round 7, performance) painted sprites' frames are painted by the plate workers (not for
    // deterministic captures: ?manual paints them on the page, as it paints the plates)
    if (!opts.manual) this.sprites.async = (job, done) => this.store.paintSprite(job, done);
    this.titles = new Titles(gl, r.emptyVao);
    this.opening = new Opening({
      herX: () => this.player.body.x,
      moveTo: (x, jump) => this.driveTo(x, jump),
      pose: (kind) => this.posePlayer(kind),
      touchedSince: (t) => this.touchedSince(t),
      inputTick: () => this.input.tick,
      release: (vx) => {
        this.player.body.vx = vx;
        this.frozen = 0;
      },
      // TESU's moment: the palace's gate is pinned at 0.8 of the width, so the title keeps to
      // the sky between, at most 56% of the frame wide (on narrow screens it shrinks instead)
      title: (text, hold, out, after, maxFrac) => {
        this.titles.show(text, true, false, after, maxFrac, { hold, out, fadeIn: this.feel.reducedMotion ? 0.3 : 0 });
        this.setFlag("title:tesu");
      },
      titleAt: (t) => this.titles.setTime(true, t),
      sfx: (id, at) => this.sound.sfx(id, 1, at),
      sfxCancel: () => this.sound.cancelAhead(),
      bed: (k, secs) => this.sound.bedLevel(k, secs),
      framing: (x, opening) => this.trackFraming(x, opening),
      frameW: () => this.r.iw,
      frameH: () => this.r.ih,
      cut: () => { this.cutFade = 1; },
      cine: (on) => { document.documentElement.classList.toggle("cine", on); },
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
    this.landed = opts.landed ?? null;
    this.vfx = new Vfx(assets.vfx);
    const cam = this.camera;
    const labCam = {
      shake: (a: number, d: number) => cam.shake(a, d),
      zoom: (s: number) => cam.zoomPunch(s),
      reducedMotion: false,
    } as unknown as LabCamera;
    this.feel = new Feel(labCam, assets.feel);
    cam.reducedMotion = this.feel.reducedMotion;
    this.titles.reducedMotion = this.feel.reducedMotion;
    SpriteRenderer.driftScale = this.feel.reducedMotion ? 0.25 : 1;
    // frozen controls read nothing; "down" only means drop-through on one-way ground
    this.inputProxy = new Proxy(input, {
      get: (t, k, rcv) => {
        // (down: drop-through on one-way ground, a fast fall in the air)
        if (k === "isDown") return (a: Action) => (this.frozen > 0 ? false : a === "down" ? t.isDown(a) && (!this.player.body.grounded || this.collision.onOneWay(this.player.body)) : t.isDown(a));
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
    this.player = new Zhusha({ vfx: this.vfx, feel: this.feel, camera: this.camera }, [0, 0]);
    this.zdraw = new ZhushaDraw(assets.anims);
    this.zdraw.bind(this.player);
    this.vfx.groundAt = (x, y) => this.collision.groundAt(x, y);
    this.save = loadSave();
    for (const f of this.save.flags) if (!TRANSIENT.has(f)) this.flags.add(f);
    for (const s of this.world.sprites) this.spriteById.set(s.id, s);
    this.gatedSprites = this.world.sprites.filter((s) => s.when || s.unless);
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
    this.rides = new Rides(this.world.rides, { sprite: (id) => this.spriteById.get(id) });
    const catchS = this.world.spawns.find((s) => s.id === "catch")!;
    const resume = opts.link ? null : resumePlace(this.save, Date.now(), catchS.x, isReload());
    if (resume) this.spawnAt({ id: "resume", x: resume.x, y: resume.y, facing: resume.facing });
    else this.spawnAt(this.world.spawns.find((s) => s.id === opts.start) ?? catchS);
    this.startedBy = resume ? "resume" : opts.link ? "link" : "fresh";
    if (opts.hold || (this.startedBy === "fresh" && !opts.noOpening)) {
      // the world waits for the press (PLAY or "continue" on the homepage, "continue" on /tesu/ itself):
      // Kagami held at the postcard, bare-hatted, controls held
      this.holding = true;
      this.awaitingPress = !opts.hold;
      this.frozen = 1e9;
      this.sound.locked = true;
      this.camera.snap(this.player.body.x, this.player.body.y, this.framing(), 1);
    }
  }

  readonly startedBy: "fresh" | "resume" | "link" = "fresh";
  /** /tesu/ on its own, fresh: the page shows "continue" and the press starts the opening (main.ts). */
  awaitingPress = false;
  /** Zhusha's talisman: the opening's bake, then the live chain on her hat. */
  readonly ofuda = new Ofuda();
  private ofudaPose: OfudaPose | null = null;
  private ofudaX = 0;
  /** Her drawings are in (the opening set waits for them; they load before the world starts). */
  closeReady = true;

  /** Sets a progress flag (kept on this device). */
  setFlag(f: string, on = true): void {
    if (on === this.flags.has(f)) return;
    if (on) this.flagSince.set(f, this.tick);
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
   * The score: the opening plays Track 1 (the page's conductor owns it) and the old synthesized layers wait
   * while it sounds; then the hall gathers the music into its quiet, outdoors the calm landscape form plays;
   * beds follow the place.
   */
  private scoreTick(): void {
    const b = this.player.body;
    const m = this.sound.music;
    m.held = this.opening.music || this.opening.state === "cine";
    if (this.tick % 30 !== 0) return;
    const inside = b.y >= INTERIOR_Y;
    this.sound.setBed(inside ? "hall" : b.x < 109 * H ? "lake" : "heights");
    if (m.held) return;
    if (inside && m.mood !== "hall" && m.mood !== "intense") this.cue("music:hall");
    else if (!inside && !this.opening.active && (m.mood === "off" || m.mood === "hall")) this.cue("music:land");
  }

  private notePlace(): void {
    const b = this.player.body;
    // (a reload before the opening hands back replays it from its start: no place is noted in it)
    if (!b.grounded || this.tug || this.rides.active || this.holding || this.opening.active) return;
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
  vista: { zoom: number; x: number; y: number; anchor: number; t: number; pin?: { x: number; at: number } } | null = null;
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

  /** The world's tracks at x, with the opening's reveal track on or off (the opening's camera reads them). */
  private trackFraming(x: number, opening: boolean, y = this.groundY(x)): ReturnType<typeof framingAt> {
    const has = (fl: string): boolean => (fl === "opening" ? opening : this.flags.has(fl));
    return framingAt(this.world.tracks, x, has, y);
  }

  /** The ground's y under x near her (the jetty, the shore road, the terrace). */
  private groundY(x: number): number {
    const b = this.player.body;
    return this.collision.groundBelow(x, b.y - 2 * H)?.y ?? b.y;
  }

  private framing(): ReturnType<typeof framingAt> {
    const has = (fl: string): boolean => (fl === "opening" ? this.opening.active : this.flags.has(fl));
    let f = framingAt(this.world.tracks, this.player.body.x, has, this.player.body.y);
    // an entrance shot: a held vista on first entry, ended early by moving
    if (this.vista) f = { ...f, zoom: this.vista.zoom, fixX: this.vista.pin ? null : this.vista.x, fixY: this.vista.y, anchor: this.vista.anchor, pin: this.vista.pin ?? null, bounds: null };
    // outdoors the frame never shows past the world's ends (the widest frames on ultra-wide screens)
    if (!f.bounds && this.player.body.y < INTERIOR_Y) f = { ...f, bounds: [0, this.world.w] };
    // the world window waiting for the press: the opening's first shot, the held postcard of Kagami with the
    // sky in the middle of the frame (so TESU, for a visitor who scrolls on past, is written into the sky)
    if (this.holding) {
      const s0 = BEATS.camera.shots[0]!;
      f = { ...f, zoom: s0.zoom[0], anchor: s0.anchor[0], horizon: s0.horizon[0], lead: 0, fixX: s0.cx[0] * H, pin: null };
    }
    // R's climb: the frame pulls out to hold the whole rise and dive
    if (this.player.camZoom !== null) f = { ...f, zoom: Math.min(f.zoom, this.player.camZoom) };
    return this.framingOverride ? { ...f, ...this.framingOverride } : f;
  }

  // --- time ---------------------------------------------------------------

  /** The world window is covered by the website: no ticks, no drawing, sound faded down. */
  away = false;
  /** Waiting for PLAY in the page column (controls held, Kagami still). */
  holding = false;

  setAway(away: boolean): void {
    if (away === this.away) return;
    this.away = away;
    this.sound.setVisible(away ? 0 : 1);
  }

  /**
   * The press (PLAY or "continue"): the opening starts on the link's clock (the page's conductor: Track 1 as
   * heard). Without one (tools) it runs silent on the world's own simulated time.
   */
  play(link?: OpeningLink): void {
    if (!this.holding) return;
    this.holding = false;
    this.awaitingPress = false;
    this.frozen = 0;
    this.sound.locked = false;
    if (link?.ctx) this.sound.start(link.ctx);
    this.spawnAt(this.world.spawns.find((s) => s.id === "catch")!);
    this.opening.start(link ?? new SilentLink(() => this.time, this.feel.reducedMotion));
    const shot = this.opening.camera(this.player.body.x);
    if (shot) this.camera.set(shot, this.player.body.x, this.player.body.y);
  }

  // --- the opening drives her (opening.ts): visual and timing only, on the ground the world already has

  /** Along the ground to x; far (a skip) or not yet on the ground: put down there. */
  private driveTo(x: number, jump: boolean): void {
    const b = this.player.body;
    const dx = x - b.x;
    if (jump || Math.abs(dx) > H) {
      this.place(x);
      this.player.facing = 1;
      return;
    }
    if (!b.grounded) this.collision.move(b, 0, 2);
    if (Math.abs(dx) > 1e-4) this.collision.move(b, dx, 0);
    if (!b.grounded) {
      const g = this.collision.groundBelow(b.x, b.y - PHYSICS.stepUp * H);
      if (g && g.y - b.y < 2 * H) this.collision.move(b, 0, g.y - b.y + 0.5);
    }
    b.vx = 0;
    b.vy = 0;
    this.player.facing = 1;
  }

  /** Her idle held as a still (the opening's holds), her walk, or her run playing (opening.ts moves her). */
  private posePlayer(kind: "still" | "walk" | "run"): void {
    this.player.posed(kind);
  }

  /** A movement or action input since input tick t (held now, or pressed after it). */
  private touchedSince(t: number): boolean {
    const acts = ["left", "right", "up", "down", "jump", "m1", "m2", "skill", "ult"] as const;
    return acts.some((a) => this.input.isDown(a) || (this.input.pressTick(a) ?? -Infinity) > t);
  }

  frame(now: number): void {
    // covered or out of view: nothing runs, except the drawing that streams in the first plates
    // (so a world loaded behind the website is ready when she scrolls up to it)
    if (this.away && !this.loading) {
      this.last = now;
      // (the opening set keeps streaming in while the title covers the world)
      if (this.warming) this.warmPump();
      return;
    }
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
      // (round 7, performance) everything that moves moves on ticks, so a frame in which no tick ran
      // would draw the picture already on screen again: on a 120-240 Hz screen that is two frames in
      // three (Dex's runs at 180 Hz). They are not drawn (the canvas keeps its picture) unless the
      // frame changed size; the plates keep streaming, and a tile or sprite frame that lands between
      // ticks shows with the next one (at most 1/60 s later). (Once the first scene is in: the world
      // reports itself loading again for a moment whenever a giant's frame set at a new zoom streams in.)
      const size = `${this.r.iw}x${this.r.ih}`;
      if (n === 0 && this.shown && size === this.drawnAt) {
        this.store.pump();
        return;
      }
      this.drawnAt = size;
    }
    this.render();
  }

  realTick(): void {
    this.tick++;
    this.time += 1 / 60;
    this.opening.tick();
    this.warmStream();
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
    // the opening's camera is time-locked to the music; then the world's tracks have the frame again
    const shot = this.opening.camera(b.x);
    if (shot) this.camera.set(shot, b.x, b.y);
    else this.camera.update(b.x, b.y, this.player.facing, b.vx, f);
    this.ofudaTick();
    // reduced motion: a cut between held frames is a short dithered cross-fade, not a swing
    if (this.camera.cuts !== cuts && this.tick > 2) this.cutFade = 1;
    this.cutFade = Math.max(0, this.cutFade - 1 / 12);
    this.tugTick();
    this.cutTick();
    if (this.vista) {
      this.vista.t -= 1 / 60;
      if (this.vista.t <= 0 || Math.abs(b.vx) > 0.6) this.vista = null;
    }
    this.syncGates();
    this.doorTick();
    this.near = this.cut || this.tug || this.rides.active || this.warp || this.opening.state === "cine" || this.holding ? null : this.findNear();
    this.placeNames();
    this.motes.update(1 / 60);
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
    if (this.opening.drive()) {
      // the cinematic (and the hands-free run after the drop) moves her; her own controls wait
      this.vfx.update();
      this.input.tick++;
      this.fallFrom = null;
      this.cloudDrop = false;
      return;
    }
    const wasGrounded = b.grounded;
    this.collision.holdDown = this.frozen <= 0 && this.input.isDown("down");
    // on a ropeway: the car carries her, its floor is her ground, nothing else applies
    if (this.rides.active) {
      this.frozen = Math.max(this.frozen, 2);
      const was = b.x;
      const done = this.rides.tick(b);
      // on a slide she faces the way the flume runs
      if (this.rides.active?.def.slide && Math.abs(b.x - was) > 0.2) this.player.facing = b.x > was ? 1 : -1;
      // a slide's feel: spray kicked up on the steep runs, the frame jolting at the drops
      if (this.rides.active?.def.slide && this.tick % 6 === 0) {
        const sl = this.rides.slope();
        if (sl > 0.25) this.vfx.spawn("dust.kick", { x: b.x, y: b.y, facing: this.player.facing });
        if (sl > 0.8) this.camera.shake(1.5, 6);
      }
      this.player.update(this.inputProxy, this.rides.world as unknown as MoveWorld);
      this.court.tick();
      this.player.afterHits();
      this.props.tick();
      this.vfx.update();
      this.input.tick++;
      this.fallFrom = null;
      this.cloudDrop = false;
      if (done) this.arrive(done.def, done.dir);
      return;
    }
    for (const [id, t] of this.charmT) if (t > 0) this.charmT.set(id, t - 1);
    // a paper charm: Q with one in reach ahead warps her to it, and she hangs from it a moment
    if (this.tryCharm() || this.warp || this.perch) {
      this.charmTick(b);
      this.court.tick();
      this.props.takeHits(this.player);
      this.player.afterHits();
      this.props.tick();
      this.vfx.update();
      this.input.tick++;
      this.fallFrom = null;
      this.cloudDrop = false;
      return;
    }
    this.player.update(this.inputProxy, this.collision as unknown as MoveWorld);
    this.court.tick();
    this.props.takeHits(this.player);
    this.player.afterHits();
    this.props.tick();
    this.vfx.update();
    this.input.tick++;
    // falls: no damage anywhere; a long one is a cloud drop
    // a cloud drop speeds up past her ordinary falling speed (the Prow Leap is a 7 s fall)
    if (!b.grounded && this.cloudDrop && !this.tug) {
      this.cloudSpeed = Math.min(this.cloudSpeed + 0.5, 26);
      this.collision.move(b, 0, this.cloudSpeed);
      // in a long drop she only drifts (holding a direction all the way down no longer
      // carries her far past where she was headed), and over open air she is steered toward
      // the nearest ground below, so a held key never takes her off the map into the void
      const cap = 0.35;
      if (Math.abs(b.vx) > cap) {
        // (the step she just took at her full air speed is taken back down to the cap)
        this.collision.move(b, -(b.vx - Math.sign(b.vx) * cap), 0);
        b.vx = Math.sign(b.vx) * cap;
      }
      if (!this.collision.groundBelow(b.x, b.y, false)) {
        for (let d = 0.25 * H; d <= 10 * H; d += 0.25 * H) {
          const dir = this.collision.groundBelow(b.x - d, b.y, false) ? -1 : this.collision.groundBelow(b.x + d, b.y, false) ? 1 : 0;
          if (dir) {
            this.collision.move(b, dir * Math.min(2.5, d), 0);
            break;
          }
        }
      }
    }
    if (b.grounded) {
      if (this.fallFrom !== null && b.y - this.fallFrom > PHYSICS.cloudDrop * H) {
        const wet = this.collision.standingOn?.surface === "water";
        this.vfx.spawn(wet ? "ring.wide" : "dust.land", { x: b.x, y: b.y, facing: 1 });
        if (wet) this.vfx.spawn("dust.kick", { x: b.x, y: b.y, facing: 1 });
        this.feel.sound(wet ? "splash" : "land", 1);
        this.camera.shake(3, 10);
      }
      this.fallFrom = null;
      this.cloudDrop = false;
      this.cloudSpeed = 0;
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

  // --- the talisman ------------------------------------------------------------

  /** The talisman this tick: none before the press, the bones' bake through the opening, then the live chain on her hat. */
  private ofudaTick(): void {
    const b = this.player.body, f = this.player.facing;
    const speed = (((b.x - this.ofudaX) * 60) / H) * f;
    this.ofudaX = b.x;
    if (this.holding) {
      this.ofudaPose = null;
      return;
    }
    const head = this.zdraw.head(this.player);
    const tie: [number, number] = [b.x + (head[0] + HAT_TIE[0]) * f, b.y + head[1] + HAT_TIE[1]];
    const o = this.opening, reduced = this.feel.reducedMotion;
    const [t0, t1] = this.ofuda.span;
    if (o.active && o.T <= t1) {
      const pose = o.T < t0 ? null : this.ofuda.bakeAt(o.T, b.x, b.y, tie, reduced);
      this.ofudaPose = pose;
      if (pose) this.ofuda.seed(pose, f);
      return;
    }
    const w = o.wind();
    const bob = o.active ? o.bob() : Math.abs(speed) > 0.3 ? this.time * Math.PI * 2 * Math.min(5, 1 + Math.abs(speed)) : null;
    this.ofudaPose = this.ofuda.live(tie, f, speed - w.base * f, w.gust, bob, reduced);
  }

  /** The talisman as pixels at the camera's scale (behind her, or in front). */
  private drawOfuda(cam: CamState, behind: boolean): void {
    const p = this.ofudaPose;
    if (!p || p.behind !== behind || this.fade >= 1) return;
    const r = this.r, xf = planeXf(cam, 1), o = this.opening;
    let glint: number | null = null;
    if (o.active && o.T < this.ofuda.span[1]) {
      for (const g of BEATS.ofuda.glints) {
        const u = (o.T - g) / (5 / 12);
        if (u >= 0 && u < 1) glint = u;
      }
    }
    r.setTransform();
    this.ofuda.draw(p, (x, y) => [x * xf.s + xf.offX, y * xf.s + xf.offY], xf.s, glint, this.feel.reducedMotion, (x, y, c) => r.rect(x, y, 1, 1, c, 1, 1, true));
  }

  /** After the hand-back, no input for a while: a small paper tag "->" beside her (gone on the first input). */
  private drawHint(cam: CamState): void {
    if (!this.opening.hint) return;
    const xf = planeXf(cam, 1), b = this.player.body;
    const fx = Math.round(b.x * xf.s + xf.offX + 0.5 * H * Math.min(1, xf.s) + 8);
    const fy = Math.round((b.y - 0.62 * H) * xf.s + xf.offY + Math.round(Math.sin(this.time * 4) * 1.5));
    const r = this.r;
    const ink: [number, number, number] = [0.106, 0.098, 0.133];
    r.begin(0, 0, DAY, []);
    r.rect(fx - 1, fy - 1, 21, 15, ink, 1, 1, true);
    r.rect(fx, fy, 19, 13, [1, 0.96, 0.94], 1, 1, true);
    r.rect(fx + 4, fy + 5, 9, 3, ink, 1, 1, true);
    r.rect(fx + 11, fy + 3, 2, 7, ink, 1, 1, true);
    r.rect(fx + 13, fy + 4, 1, 5, ink, 1, 1, true);
    r.rect(fx + 14, fy + 5, 1, 3, ink, 1, 1, true);
    r.flush();
  }

  // --- the opening set's plates: every tile the opening's camera draws on its hands-free path, with the T span
  // it is on screen. "continue" waits for the ones that cannot be painted in time once the music runs: the widest
  // frame under TESU first (it lands on drop 2 out of a two-second whip, and holds four seconds), then the drift
  // from the press to the close band, then TESU's ease back in, as many as the plate store can hold beside the
  // frame on screen (empty tiles cost nothing). The rest (the walk's reveal, the whip-out) streams in ahead of the
  // camera while it runs, and the store keeps each tile until the camera is past it (plates/store.ts keep).

  private warm: { plan: WarmTile[]; gate: number; gateMax: number; done: number; size: string; budget: number } | null = null;

  /** Plates of the opening set are still coming in. */
  get warming(): boolean {
    return !!this.warm && this.warm.done < this.warm.gate;
  }

  /** The opening's plan of plates for the frame as it is now (its size and reduced motion). */
  private landed: (() => [number, number] | null) | null;

  /** The frame the opening runs at (the landed world window on the homepage, else the frame now). */
  private openingFrame(): [number, number] {
    return this.landed?.() ?? [this.r.iw, this.r.ih];
  }

  private warmPlan(): { plan: WarmTile[]; gateMax: number; budget: number } {
    const [W, Hf] = this.openingFrame();
    const reduced = this.feel.reducedMotion;
    const cam = BEATS.camera, ui = BEATS.ui;
    // per tile, the runs of T it is on screen (a far plane's tile in the drift may come back in the ease-in)
    const span = new Map<string, { id: PlaneId; lv: number; tx: number; ty: number; runs: [number, number][] }>();
    let most = 0;
    // every quarter second (and the beats' own moments: the widest frame's first tick, the skip's landing)
    const times: number[] = [];
    for (let T = 0; T <= ui.handBack + 1e-6; T += 0.25) times.push(T);
    times.push(cam.widest.from + 0.02, ui.skipTo);
    times.sort((a, b) => a - b);
    // the ground along her hands-free path, walked from the catch spot (the ground under x near where she is
    // then: the terrace is above the shore she starts from, so "the ground below her now" would be the wrong one)
    const x0 = BEATS.her.catchXH * H, step = H / 4;
    const spawn = this.world.spawns.find((sp) => sp.id === "catch")!;
    const prof: number[] = [];
    let gy = this.collision.groundBelow(x0, spawn.y - 2 * H)?.y ?? spawn.y;
    for (let x = x0; x <= (BEATS.her.stopXH + 6) * H; x += step) {
      gy = this.collision.groundBelow(x, gy - 2 * H)?.y ?? gy;
      prof.push(gy);
    }
    const groundAt = (x: number): number => prof[Math.max(0, Math.min(prof.length - 1, Math.round((x - x0) / step)))]!;
    for (const T of times) {
      const x = herXH(T) * H;
      const shot = cameraAt(T, { x, W, H: Hf, reveal: (v) => this.trackFraming(v, true, groundAt(v)), world: (v) => this.trackFraming(v, false, groundAt(v)), reduced });
      if (!shot) continue;
      const c: CamState = { cx: shot.cx, cy: groundAt(x), zoom: shot.zoom, anchor: shot.anchor, horizon: shot.horizon, W, H: Hf };
      let n = 0;
      for (const id of PLANE_IDS) {
        if (id === "near" && c.zoom > 1.6) continue;
        const sp = this.tileSpan(c, id, this.levelOf(c, id), 0, Hf);
        for (let ty = sp.ty0; ty <= sp.ty1; ty++) {
          for (let tx = sp.tx0; tx <= sp.tx1; tx++, n++) {
            const k = `${id}|${sp.level}|${tx}|${ty}`;
            const t = span.get(k);
            const run = t?.runs[t.runs.length - 1];
            if (run && T - run[1] <= 0.25 + 1e-6) run[1] = T;
            else if (t) t.runs.push([T, T]);
            else span.set(k, { id, lv: sp.level, tx, ty, runs: [[T, T]] });
          }
        }
      }
      most = Math.max(most, n);
    }
    // what "continue" waits for, in this order: the widest frame, the drift, the skip's landing; then (streamed
    // while it runs, as the store has room) the whip-out (from the walk on: two seconds are too few to paint it),
    // the walk and the ease back in (each four seconds ahead: the walk is slow, the ease follows a four-second
    // hold). One entry per run of a tile.
    const plan: WarmTile[] = [];
    for (const [k, t] of span) {
      for (const [from, until] of t.runs) {
        const widest = until >= cam.widest.from && from < cam.easeIn.from;
        const skip = until >= ui.skipTo && from <= ui.skipTo + 0.5;
        const rank = widest ? 0 : from < cam.reveal.from ? 1 : skip ? 2 : from >= cam.easeIn.from ? 5 : from >= cam.whip.from ? 3 : 4;
        // (on screen until the next sample)
        plan.push({ id: t.id, lv: t.lv, tx: t.tx, ty: t.ty, k, from, until: until + 0.25, rank });
      }
    }
    plan.sort((a, b) => a.rank - b.rank || a.from - b.from);
    const gateMax = plan.findIndex((t) => t.rank > 2);
    // the store's layers less a frame on screen and its margin (measured: about a fifth to a third of a frame's
    // tiles hold paint, the rest are empty and cost nothing)
    const budget = Math.max(64, this.planes.layers - Math.ceil(most * 0.3) - 48);
    return { plan, gateMax: gateMax < 0 ? plan.length : gateMax, budget };
  }

  startWarm(): void {
    const [fw, fh] = this.openingFrame();
    const size = `${fw}x${fh}${this.feel.reducedMotion ? "r" : ""}`;
    if (this.warm?.size === size) return;
    this.store.clearKeep();
    const p = this.warmPlan();
    this.warm = { ...p, gate: p.gateMax, done: 0, size };
    this.warmProgress();
    const n = (r: number): number => p.plan.filter((t) => t.rank === r).length;
    console.info(`[opening] the opening set at ${size}: up to ${p.gateMax} plate tiles before "continue" (widest frame ${n(0)}, drift ${n(1)}, skip landing ${n(2)}), ${p.plan.length - p.gateMax} streaming behind (whip ${n(3)}, walk ${n(4)}, ease-in ${n(5)}); the store holds ${this.planes.layers} painted, the opening keeps up to ${p.budget}`);
  }

  private warmPump(): void {
    this.store.pump();
  }

  /**
   * The opening set's plates in (0..1). Asks (again) for the ones "continue" waits for, in order, while the store
   * has room to keep them: where it runs out, what "continue" waits for ends (the rest streams in later).
   */
  warmProgress(): number {
    const w = this.warm;
    if (!w) return 0;
    const st = this.store;
    let room = w.budget - st.keptLayers(), done = 0, i = 0;
    for (; i < w.gateMax; i++) {
      const t = w.plan[i]!;
      const l = st.layerOf(t.k);
      if (l === -2 || st.lost.has(t.k)) { done++; continue; }
      // (a kept tile holding paint is already counted in keptLayers; any other takes room)
      if (!(l !== undefined && l >= 0 && st.isKept(t.k))) {
        if (room <= 0) break;
        room--;
      }
      st.keep(t.k, t.from, t.until, t.rank === 0);
      if (l === undefined) st.want(t.id, t.lv, t.tx, t.ty, 30 + i * 0.001);
      else if (l >= 0) done++;
    }
    w.gate = i;
    w.done = done;
    if (this.away && done < i) st.pump();
    return i ? done / i : 1;
  }

  /**
   * While the opening runs: the store keeps what the camera still needs (until it is past it) and the plates
   * ahead are asked for, nearest in T first (the widest frame and the whip-out from the walk on, the rest four
   * seconds ahead), while the store has room to keep them. After the hand-back the store is the world's again.
   */
  private warmStream(): void {
    const w = this.warm, st = this.store, o = this.opening;
    if (!w || this.holding) return;
    if (!o.active) {
      this.warm = null;
      st.clearKeep();
      return;
    }
    const T = o.T;
    st.keepT = T;
    if (this.tick % 6) return;
    let room = w.budget - st.keptLayers();
    // first what is on screen within two seconds, whatever it is for; then by what it is for, each its lead ahead
    for (const soon of [true, false]) {
      for (const t of w.plan) {
        if (t.until < T || st.lost.has(t.k)) continue;
        const lead = soon ? 2 : t.rank === 0 || t.rank === 3 ? 12 : 4;
        if (t.from - lead > T) continue;
        const l = st.layerOf(t.k);
        if (l === -2) continue;
        if (!(l !== undefined && l >= 0 && st.isKept(t.k))) {
          if (room <= 0) break;
          room--;
        }
        st.keep(t.k, t.from, t.until, t.rank === 0 || t.rank === 3);
        if (l === undefined) st.want(t.id, t.lv, t.tx, t.ty, 30 + Math.max(0, t.from - T));
      }
    }
  }

  // --- using things ---------------------------------------------------------

  // --- flags that change the world: a bridge dropped, a rail gone, a sign that no longer holds

  private flagSince = new Map<string, number>();
  private gatedSprites: SpriteDef[] = [];

  /** Gated ground, walls and sprites follow the flags (ground a second after its flag: the deck's drop). */
  private syncGates(): void {
    const settled = (f: string, after: number): boolean => {
      if (!this.flags.has(f)) return false;
      const since = this.flagSince.get(f);
      return since === undefined || this.tick - since >= after;
    };
    this.collision.gate((f) => settled(f, 60));
    for (const s of this.gatedSprites) {
      const on = !s.when || settled(s.when, s.delay ?? 0);
      s.hidden = !on || (!!s.unless && this.flags.has(s.unless));
    }
    // the charms light while they re-arm, and sway otherwise
    for (const c of this.world.charms) {
      const s = this.spriteById.get(c.id);
      if (s) s.frame = (this.charmT.get(c.id) ?? 0) > 0 ? 2 : Math.floor(this.time * 1.5 + c.x / 97) % 2;
    }
  }

  // --- doors that open as she comes near (round 7): a sprite's frame, eased; visual only

  private doors: { world: WorldDef; list: SpriteDef[]; t: Map<string, number> } | null = null;

  private doorTick(): void {
    if (!this.doors || this.doors.world !== this.world) this.doors = { world: this.world, list: this.world.sprites.filter((s) => s.opens), t: new Map() };
    const b = this.player.body;
    for (const s of this.doors.list) {
      const o = s.opens!;
      const inside = !this.cut && b.x >= o.x0 && b.x <= o.x1 && Math.abs(b.y - s.y) <= (o.dy ?? 2 * H);
      const was = this.doors.t.get(s.id) ?? 0;
      const t = inside ? Math.min(1, was + 1 / (60 * (o.open ?? 0.9))) : Math.max(0, was - 1 / (60 * (o.close ?? 1.3)));
      this.doors.t.set(s.id, t);
      // ease in and out: the leaves start heavy, swing, and settle
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      s.frame = Math.round(e * (Math.max(1, s.frames ?? 1) - 1));
    }
  }

  // --- the Pillar Hop's paper charms

  private charmT = new Map<string, number>();
  private warp: { c: CharmDef; t: number; from: [number, number] } | null = null;
  private perch: { c: CharmDef; t: number } | null = null;
  /** Where the charm she holds (or flies to) puts her feet. */
  private perchAt: [number, number] = [0, 0];
  private readonly perchWorld = {
    move: (b: { x: number; y: number; vy: number; grounded: boolean }, dx: number, dy: number): { landed: boolean } => {
      b.x += dx;
      const [px, py] = this.perchAt;
      const was = b.grounded;
      if (Math.abs(b.x - px) <= 0.45 * H && b.y <= py + 1 && b.y + dy >= py) {
        b.y = py;
        b.vy = 0;
        b.grounded = true;
        return { landed: !was };
      }
      b.y += dy;
      b.grounded = false;
      return { landed: false };
    },
  };

  /** The armed charm ahead of her within Q's reach, nearest first. */
  private charmInReach(): CharmDef | null {
    const b = this.player.body, f = this.player.facing;
    let best: CharmDef | null = null, bd = Infinity;
    for (const c of this.world.charms) {
      if ((this.charmT.get(c.id) ?? 0) > 0 || this.perch?.c === c) continue;
      const dx = (c.x - b.x) * f, dy = c.y + PERCH - b.y;
      if (dx < 0.5 * H || dx > CHARM_REACH || dy < -4.5 * H || dy > 4 * H) continue;
      const d = Math.hypot(dx, dy);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  /** Q with a charm in reach: the press is the charm's, not the sword's. */
  private tryCharm(): boolean {
    if (this.frozen > 0 || this.warp || this.cut || this.tug) return false;
    const t = this.input.pressTick("skill");
    if (t === undefined || this.input.tick - t > 8) return false;
    const c = this.charmInReach();
    if (!c) return false;
    this.input.consume("skill");
    const b = this.player.body;
    this.warp = { c, t: 0, from: [b.x, b.y] };
    this.perch = null;
    this.charmT.set(c.id, CHARM_REARM);
    this.vfx.spawn("afterimage.trail", { x: b.x, y: b.y, facing: this.player.facing });
    this.feel.sound("dash", 1);
    return true;
  }

  /** The warp to a charm (a short flight), then the hold: jump, dash, walk off or warp on; it lets go in time. */
  private charmTick(b: { x: number; y: number; vx: number; vy: number; grounded: boolean }): void {
    const w = this.warp;
    if (w) {
      w.t++;
      const k = Math.min(1, w.t / WARP_T), e = 1 - (1 - k) * (1 - k);
      this.perchAt = [w.from[0] + (w.c.x - w.from[0]) * e, w.from[1] + (w.c.y + PERCH - w.from[1]) * e];
      b.x = this.perchAt[0];
      b.y = this.perchAt[1];
      b.vx = b.vy = 0;
      b.grounded = true;
      this.frozen = Math.max(this.frozen, 1);
      this.player.update(this.inputProxy, this.perchWorld as unknown as MoveWorld);
      if (k >= 1) {
        this.warp = null;
        this.perch = { c: w.c, t: 0 };
        this.vfx.spawn("ring.halo", { x: w.c.x, y: w.c.y, facing: 1 });
      }
      return;
    }
    const p = this.perch!;
    p.t++;
    this.perchAt = [p.c.x, p.c.y + PERCH];
    this.player.update(this.inputProxy, this.perchWorld as unknown as MoveWorld);
    // off the charm: she jumped, dashed or walked off, or it let go
    if (!b.grounded || Math.abs(b.x - p.c.x) > 0.45 * H || p.t >= PERCH_T) {
      this.perch = null;
      if (p.t >= PERCH_T && b.grounded) {
        b.grounded = false;
        b.y += 1;
      }
    }
  }

  /** The nearest usable thing within reach of her (about half an H around its area). */
  private findNear(): Usable | null {
    const b = this.player.body;
    const reach = 0.45 * H;
    let best: Usable | null = null, bd = Infinity;
    for (const u of this.world.usables) {
      if (u.unless && this.flags.has(u.unless)) continue;
      if (b.x < u.x0 - reach || b.x > u.x1 + reach || b.y < u.y0 - reach || b.y - b.h > u.y1 + reach) continue;
      // the thing she stands in front of wins over a neighbour whose centre is nearer
      const edge = b.x < u.x0 ? u.x0 - b.x : b.x > u.x1 ? b.x - u.x1 : 0;
      const d = edge * 4 + Math.abs(b.x - (u.x0 + u.x1) / 2) * 0.01;
      if (d < bd) { bd = d; best = u; }
    }
    return best;
  }

  /** F, Enter or a tap on the thing: use what is within reach. */
  use(u: Usable | null = this.near): void {
    if (!u || this.cut || this.tug || this.opening.state === "cine" || this.holding) return;
    // the board waits while a bout is on; leaving through a door ends the bout
    if (this.court.busy && u.action.kind === "panel" && u.action.panel === "board") return;
    if (u.action.kind === "ride") {
      if (this.rides.active) return;
      this.court.cancel();
      const b = this.player.body;
      if (!this.rides.board(u.action.ride, u.action.dir, b)) return;
      this.flags.add(`ride:${u.action.ride}`);
      this.player.facing = u.action.dir;
      this.frozen = Math.max(this.frozen, 2);
      this.feel.sound("lift-start", 1);
      return;
    }
    if (u.action.kind === "door") {
      const a = u.action;
      if (a.needs && !this.flags.has(a.needs)) {
        this.onUse({ ...u, action: { kind: "say", text: a.closed ?? "It does not open from this side." } });
        return;
      }
      if (a.opens) this.setFlag(a.opens, true);
      this.court.cancel();
      const id = u.action.to;
      const to = this.world.spawns.find((sp) => sp.id === id);
      if (to) this.cut = { t: 0, to, title: u.action.title };
      return;
    }
    this.onUse(u);
  }

  /**
   * The car has docked: she stands on the station's ground again. Up at the top the frame holds
   * a Vista over what she rode through, with its big title (once a visit); moving ends it.
   */
  private arrive(def: WorldDef["rides"][number], dir: 1 | -1): void {
    const b = this.player.body;
    this.flags.delete(`ride:${def.id}`);
    b.grounded = false;
    b.vy = 0;
    // (from a hair above, so a station's ground a pixel off the car's floor still takes her)
    b.y -= 4;
    this.collision.move(b, 0, 8);
    this.lastSafe = [b.x, b.y];
    this.frozen = Math.max(this.frozen, 6);
    this.waitRelease = true;
    this.feel.sound(def.splash ? "splash" : "lift-dock", 1);
    if (def.splash) {
      this.vfx.spawn("ring.wide", { x: b.x, y: b.y, facing: 1 });
      this.vfx.spawn("dust.kick", { x: b.x, y: b.y, facing: this.player.facing });
      this.camera.shake(3, 12);
    }
    if (dir === 1 && def.top) {
      const t = def.top;
      this.vista = { zoom: 0.5, x: t.x, y: t.y, anchor: t.anchor, t: t.secs, pin: t.pin };
      if (t.title && !this.entered.has(`title:${def.id}`)) {
        this.entered.add(`title:${def.id}`);
        this.titles.show(t.title, true, false, t.titleAfter ?? "back", t.titleFrac ?? 0.9);
      }
    }
  }

  /** The usable thing under a frame point (touch: object taps win). */
  usableAt(fx: number, fy: number): Usable | null {
    const cam = this.camera.state();
    const xf = planeXf(cam, 1);
    const x = (fx - xf.offX) / xf.s, y = (fy - xf.offY) / xf.s;
    const b = this.player.body;
    for (const u of this.world.usables) {
      if (u.unless && this.flags.has(u.unless)) continue;
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
      if ((p.title !== "place" && p.title !== "big") || this.entered.has(p.id)) continue;
      if (b.x < p.x0 || b.x > p.x1) continue;
      if ((p.y0 !== undefined && b.y < p.y0) || (p.y1 !== undefined && b.y > p.y1)) continue;
      if (p.y0 === undefined && b.y >= INTERIOR_Y) continue;
      this.entered.add(p.id);
      if (this.opening.active) continue;
      // a region's big title (YUEMEN) slams in once a visit, written after the back plane
      if (p.title === "big") this.titles.show(p.name, true, false, "back", 0.6);
      else this.titles.show(p.name, false, b.y >= INTERIOR_Y);
    }
  }

  // --- drawing ------------------------------------------------------------

  /**
   * Her: a traced drawing for what she is doing, or the white box (zhusha/draw.ts). In the close band
   * (zoom near 2) a traced drawing comes from its native 192 px atlas at one art px per frame px.
   */
  private drawPlayer(cam: CamState, focus: [number, number], mirror: number | null): void {
    if (this.fade >= 1) return;
    const xf = planeXf(cam, 1), b = this.player.body;
    const close = cam.zoom >= 1.9 ? { zoom: cam.zoom, fx: b.x * xf.s + xf.offX, fy: b.y * xf.s + xf.offY, mirror } : null;
    this.zdraw.draw(this.r, this.player, close);
    void focus;
  }

  /** The light at a point: neighbouring atmos entries blend across their `blend` widths (atmos-blend.ts). */
  private atmosAt(x: number, y: number): AtmosDef {
    return blendAtmos(this.world.atmos, x, y, INTERIOR_Y);
  }

  private look(id: PlaneId, a: AtmosDef): PlaneLook {
    const sp = PLANES[id];
    // (round 5) a place may keep its own haze on a plane (Kagami's mid plane keeps its darks)
    return { haze: hexRgb(a.haze), fade: a.fades?.[id] ?? sp.fade, ink: hexRgb("#1b1922"), inkAmt: sp.ink, grade: a.grade ?? [1, 1, 1, 0] };
  }

  /**
   * Tiles of a plane covering frame rows [ya, yb), at the level for the current zoom.
   * Requests what is missing; draws the last complete level underneath until it lands.
   */
  /** The plate level a plane is drawn at for this camera. */
  private levelOf(cam: CamState, id: PlaneId): number {
    const xf = planeXf(cam, PLANES[id].rate);
    return levelFor(this.levels.get(id)!, xf.g) / (cam.zoom >= 1.9 && (id === "sky" || id === "far" || id === "mid" || id === "back") ? 2 : 1);
  }

  /** The tiles of a plane at level lv covering frame rows [ya, yb). */
  private tileSpan(cam: CamState, id: PlaneId, lv: number, ya: number, yb: number): { level: number; tx0: number; tx1: number; ty0: number; ty1: number } {
    const xf = planeXf(cam, PLANES[id].rate);
    const k = xf.g / lv;
    const ax0 = (0 - xf.offX) / k, ax1 = (cam.W - xf.offX) / k;
    const ay0 = (ya - xf.offY) / k, ay1 = (yb - xf.offY) / k;
    return { level: lv, tx0: Math.floor(ax0 / TILE), tx1: Math.floor((ax1 - 1e-6) / TILE), ty0: Math.floor(ay0 / TILE), ty1: Math.floor((ay1 - 1e-6) / TILE) };
  }

  private planeQuads(cam: CamState, id: PlaneId, ya: number, yb: number, a: AtmosDef, prefetch: boolean): PlaneDraw {
    const rate = PLANES[id].rate;
    const xf = planeXf(cam, rate);
    // (round 6, the critic's E3/S9) at the catch's 2x the sky's, far and mid planes' plates sit on
    // the frame's 2 px art cells like everything near (painted at half the density for it), as
    // their sprites already do (render/sprites.ts)
    // (round 7, density) and the back plane's: at the catch it stood at 1.45x its play density, so its
    // art px landed on 1 and 2 px cells in turn (the massif's face and falls a patchwork beside the
    // lake's 2 px); every plane behind the lake now shares the 2 px cell, the near planes the 1 px
    const level = this.levelOf(cam, id);
    const quads: TileQuad[] = [];
    let complete = true;
    const add = (lv: number, mark: boolean): void => {
      const k = xf.g / lv;
      const { tx0, tx1, ty0, ty1 } = this.tileSpan(cam, id, lv, ya, yb);
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
    // the water nearest the camera: its near extent in x, and its height (Kagami's lake and
    // Hoài Phố's harbour lie one above the other)
    let best: Water | null = null, d = Infinity;
    for (const w of this.world.waters) {
      const x0 = Math.min(w.x0, w.fx0 ?? w.x0), x1 = Math.max(w.x1, w.fx1 ?? w.x1);
      const span = cam.W / Math.min(1, cam.zoom) / 0.06;
      if (cam.cx + span < x0 || cam.cx - span > x1) continue;
      const dd = (cam.cx < w.x0 ? w.x0 - cam.cx : cam.cx > w.x1 ? cam.cx - w.x1 : 0) + Math.abs(cam.cy - w.y);
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
    // (round 5: the glowing sun's core is small and bright, its bloom does the rest; at the catch's 2x
    // the same size on the frame)
    const sunPx: [number, number, number] = a.sun ? [a.sun[0] * W, a.sun[1] * Hf, a.glow ? 8 : 9] : [0, 0, 0];
    const sky = [hexRgb(a.sky[0]), hexRgb(a.sky[1]), hexRgb(a.sky[2])];
    // the banded sky and the sun's bloom, where the place has them (cells of two px at the catch's 2x)
    const glow: SkyGlow | undefined = a.glow && a.glow.strength > 0 ? { radius: a.glow.radius * Hf, strength: a.glow.strength, colour: hexRgb(a.glow.colour), cell: cam.zoom >= 1.9 ? 2 : 1, plain: a.glow.plain } : undefined;
    const water = this.activeWater(cam);
    const draws = new Map<PlaneId, PlaneDraw>();
    for (const id of PLANE_IDS) draws.set(id, this.planeQuads(cam, id, 0, Hf, a, !this.manual));
    // the world shows once its plates are in and its rendered giants have a frame to show
    const wasLoading = this.loading;
    this.loading = ![...draws.values()].every((d) => d.complete) || (this.sprites.waiting > 0 && this.tick < 60 * 20);
    if (wasLoading && !this.loading) performance.mark("tesu:first-scene");
    // the first scene is in: the rest of the opening's plates stream in behind it while it waits for the press
    // (asked again if the frame changes size: the set is the frame's)
    if (!this.loading && (this.holding || (this.opening.active && this.opening.T < BEATS.ui.handBack))) this.startWarm();
    if (!this.loading) this.shown = true;
    const z = cam.zoom;
    const xfPlay = planeXf(cam, 1);
    const focus: [number, number] = [W / 2, cam.anchor * Hf];
    // the sprite renderer maps x to ((x - camX) - fx) * s + fx: match the play plane exactly
    const s4 = xfPlay.s;
    const camX = (focus[0] * (1 - s4) - xfPlay.offX) / s4, camY = (focus[1] * (1 - s4) - xfPlay.offY) / s4;
    const b = this.player.body;
    const lights = this.vfx.pointLights();

    // banks of fog lying on the water at a background plane's waterline (the place's `fog`):
    // drawn over that plane and the water at its depth, behind every nearer plane, and mirrored
    // in the lake's reflection target
    // (round 6: a layer marked `behind` lies behind its plane's land instead, drawn before it)
    const fogOn = (id: PlaneId, mirrored: boolean, behind = false): void => {
      if (!water || !a.fog) return;
      for (const f of a.fog) {
        if (f.plane !== id || f.density <= 0 || (f.behind ?? false) !== behind) continue;
        const rate = PLANES[id].rate, xf = planeXf(cam, rate);
        this.atmos.drawFog(W, Hf, {
          wl: rowOf(cam, rate, water.y), g: xf.g, offX: xf.offX, drift: -this.time * (f.drift ?? 1.5),
          density: f.density, height: f.height, apron: f.apron ?? f.height * 0.5, roll: f.roll ?? 0.6, size: f.size ?? 260, foot: f.foot ?? 0, pools: f.pools, cover: f.cover, veils: f.veils,
          cell: cam.zoom >= 1.9 ? 2 : 1, colour: hexRgb(f.colour ?? a.haze), mirrored,
        });
      }
    };

    // --- the reflection target
    let wlPlay = Hf;
    if (water) {
      wlPlay = rowOf(cam, 1, water.y);
      r.bindTarget(this.refl, true, [0, 0, 0, 1]);
      this.atmos.drawSky(W, Hf, hz, sky[0]!, sky[1]!, sky[2]!, sunPx, true, glow);
      for (const id of PLANE_IDS) {
        if (id === "near") continue;
        const m = rowOf(cam, PLANES[id].rate, water.y);
        if (m >= Hf + 2) continue;
        const pd = this.planeQuads(cam, id, Math.max(-Hf * 3, 2 * m - Hf), m + 1, a, false);
        fogOn(id, true, true);
        this.planes.draw(pd.quads, pd.look, W, Hf, m);
        this.sprites.draw(this.world.sprites.filter((sp) => sp.plane === id && sp.reflect !== false), cam, pd.look, this.time, m, this.manual);
        fogOn(id, true);
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
    this.atmos.drawSky(W, Hf, hz, sky[0]!, sky[1]!, sky[2]!, sunPx, false, glow);
    const eye = eyeY(cam);
    const waterDraw = (rows: [number, number]): void => {
      if (!water) return;
      this.atmos.drawWater(W, Hf, this.refl.color.tex, {
        hz, eye, wy: water.y, z, cx: cam.cx, lens: 1, focus,
        ext: [water.x0, water.x1, water.fx0 ?? water.x0, water.fx1 ?? water.x1],
        depth: [water.near, water.far], rows, time: this.time,
        deep: hexRgb(a.water?.deep ?? "#1f5a60"), body: hexRgb(a.water?.body ?? "#3f8f8a"), shallow: hexRgb(a.water?.shallow ?? "#bfe0dc"),
        haze: hexRgb(a.haze), glint: hexRgb(a.water?.glint ?? "#fffbe8"), still: water.kind === "lake" ? 1 : 0.4, mirror: a.water?.mirror ?? [1, 1, 1],
        cell: a.water?.near && cam.zoom >= 1.9 ? 2 : 1, near: a.water?.near, hold: waterHolds(cam, water), shore: water.shore, feet: water.shore ? [wl("back"), 0] : undefined,
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
      if (id === "far") fogOn("sky", false);
      if (id === "mid") {
        waterTo(wl("mid"));
        mist(PLANES.far.rate, 1, 4);
        fogOn("far", false);
      }
      if (id === "back") {
        waterTo(wl("back"));
        mist(PLANES.mid.rate, 0.75, 7);
        fogOn("mid", false);
      }
      if (id === "play") {
        waterTo(wl("play"));
        fogOn("back", false);
      }
      if (id === "front") {
        // her and her effects, then the near water over the play plane's underwater parts
        r.begin(camX, camY, DAY, lights);
        if (s4 !== 1) r.setTransform(s4, focus);
        this.vfx.draw(r as unknown as LabRenderer, "back");
        this.vfx.drawAfterimages(r as unknown as LabRenderer);
        this.drawOfuda(cam, true);
        if (s4 !== 1) r.setTransform(s4, focus);
        this.drawPlayer(cam, focus, null);
        this.drawOfuda(cam, false);
        if (s4 !== 1) r.setTransform(s4, focus);
        this.vfx.draw(r as unknown as LabRenderer, "front");
        r.flush();
        r.setTransform();
        this.motes.draw(r, cam, 1);
        r.flush();
        waterTo(Hf);
      }
      if (id === "near" && z > 1.6) continue;
      // (round 6, the integration) the near plane is not drawn in the close band; coming into the
      // pull-back it dissolves in over zoom 1.6 to 1.45 instead of popping in whole in one frame (the
      // pull-back's dark near corner stands in the frame there). (round 7) By clumps of its own art
      // cells anchored to the plane, the frame's foot first (render/planes.ts SHOW_GLSL), not the
      // round-6 ordered dither that read as a checker mesh half-way.
      const nearXf = id === "near" && z > 1.45 ? planeXf(cam, PLANES.near.rate) : null;
      const look = nearXf ? { ...d.look, show: (1.6 - z) / 0.15, showAt: [nearXf.offX, nearXf.offY, nearXf.g] as [number, number, number] } : d.look;
      fogOn(id, false, true);
      this.planes.draw(d.quads, look, W, Hf);
      this.sprites.draw(this.world.sprites.filter((sp) => sp.plane === id), cam, look, this.time, null, this.manual);
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
    this.drawHint(cam);
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
      clip: this.player.anim.role, zhusha: this.player.debug(), slots: this.zdraw.anims.size,
      opening: this.opening.state, T: +this.opening.T.toFixed(3), autoRun: this.opening.autoRun, holding: this.holding, startedBy: this.startedBy, near: this.near?.id ?? null, cut: !!this.cut,
      warm: this.warm ? `${this.warm.done}/${this.warm.gate} of ${this.warm.gateMax}, ${this.warm.plan.length} planned` : null,
      ofuda: this.ofudaPose ? this.ofudaPose.pts.map((p) => [Math.round(p[0]), Math.round(p[1])]) : null,
      charm: this.warp ? `warp:${this.warp.c.id}` : this.perch ? `perch:${this.perch.c.id}` : null,
      ride: this.rides.active ? { id: this.rides.active.def.id, dir: this.rides.active.dir, t: +this.rides.active.t.toFixed(2) } : null, vista: !!this.vista,
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

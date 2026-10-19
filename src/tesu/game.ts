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
import { ART_PX, Zhusha, type MoveWorld } from "./zhusha/controller.ts";
import { Fx } from "./fx/fx.ts";
import { ZhushaDraw } from "./zhusha/draw.ts";
import { NpcDraw } from "./cast/npcs.ts";
import { makeTarget, type PointLight, type Target, type WorldRenderer } from "../world/render/renderer.ts";
import { ActorLayer } from "./render/reduce.ts";
import { ScreenActors, screenCam } from "./render/actors.ts";
import { rgb } from "./art/palette.ts";
import { Camera, framingAt } from "./camera.ts";
import { Collision } from "./collide.ts";
import { Court, type Prize } from "./court.ts";
import { Props } from "./props.ts";
import { Rides } from "./ride.ts";
import { blendAtmos } from "./atmos-blend.ts";
import { Sound } from "./sound.ts";
import { placeAt, THEME_FADE } from "./region-music.ts";
import { spaceFor } from "./mix.ts";
import { CHARM_PERCH, H, INTERIOR_Y, PHYSICS, TILE } from "./config.ts";
import { TileStore, type PlatePool } from "./plates/store.ts";
import { levelOfPlane, openingTiles, tileSpanOf } from "./plates/span.ts";
import type { ZhushaAssets } from "./player.ts";
import { Atmos, waterHolds, type MistBand, type SkyGlow } from "./render/atmos.ts";
import { Motes } from "./render/motes.ts";
import { SpriteRenderer } from "./render/sprites.ts";
import { Opening } from "./opening.ts";
import { SilentLink, type OpeningLink, type PaperFrom } from "./opening/conductor.ts";
import { WorldPaper, type PaperPose } from "./opening/paper.ts";
import { BEATS, CLIP_END, HANDOFF_T, ceilingRow, clamp01, keysAt, paperAirAt, paperBlendAt, paperLensAt, paperScreenAt, setStartZoom, smooth, startT } from "./opening/timeline.ts";
import { Veils, fallVeils } from "./opening/sky.ts";
import { Titles } from "./title.ts";
import { PlaneRenderer, type PlaneLook, type TileQuad } from "./render/planes.ts";
import { eyeY, planeLevels, planeXf, rowOf, type CamState } from "./render/view.ts";
import { currentWorld } from "./world/current.ts";
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
  /** (engine 10-18) The plate workers started at boot (main.ts), which handed over the world. */
  pool?: PlatePool | null;
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
  /** (engine 10-18) Her, her effects and the talisman at play density, reduced onto the frame when zoomed out. */
  readonly actors: ActorLayer;
  /** (engine 10-18) Her drawing at screen resolution at play zoom and closer (render/actors.ts). */
  readonly screen: ScreenActors;
  readonly titles: Titles;
  /** The opening's fog layers on the lens (opening/sky.ts). */
  readonly veils: Veils;
  readonly opening: Opening;
  readonly player: Zhusha;
  /** Her drawings (traced pixel art per slot) or the white box. */
  readonly zdraw: ZhushaDraw;
  /** The cast: white boxes at her drawn height until their 128 px art lands (cast/npcs.ts draws them, not the sprite renderer). */
  readonly npcs: NpcDraw;
  readonly vfx: Vfx;
  /** (lane C 10-19) World effects as pixel sprite animations (fx/fx.ts, lanes/engine/EFFECTS-CONTRACT.md): main.ts
   * loads them at start; play one with `game.fx.play(id, { x, y, facing })`. */
  fx: Fx = Fx.none();
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
    // (engine, perf) adopted at boot (main.ts): the bake's, a worker's, or built there when neither
    this.world = currentWorld();
    this.collision = new Collision(this.world.walks, this.world.walls);
    this.collision.minX = 0;
    this.collision.maxX = this.world.w;
    const gl = r.gl;
    const maxLayers = Math.min(gl.getParameter(gl.MAX_ARRAY_TEXTURE_LAYERS) as number, 768);
    this.planes = new PlaneRenderer(gl, maxLayers);
    this.store = new TileStore(this.planes, { sync: opts.sync, pool: opts.pool });
    this.atmos = new Atmos(gl, r.emptyVao);
    this.sprites = new SpriteRenderer(gl, r.emptyVao);
    this.actors = new ActorLayer(gl, r.emptyVao);
    this.screen = new ScreenActors(gl, r.emptyVao);
    // (round 7, performance) painted sprites' frames are painted by the plate workers (not for
    // deterministic captures: ?manual paints them on the page, as it paints the plates)
    if (!opts.manual) this.sprites.async = (job, done) => this.store.paintSprite(job, done);
    this.titles = new Titles(gl, r.emptyVao);
    this.veils = new Veils(gl, r.emptyVao);
    this.opening = new Opening({
      herX: () => this.player.body.x,
      moveTo: (x, jump) => this.driveTo(x, jump),
      pose: (kind, tick) => this.posePlayer(kind, tick),
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
      framing: (x) => this.trackFraming(x, false),
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
    // foes: what m1_3 locks onto (the court's champion while a bout is on; read when she lunges)
    this.player = new Zhusha({ vfx: this.vfx, feel: this.feel, camera: this.camera, foes: () => this.court?.foes() ?? [] }, [0, 0]);
    this.zdraw = new ZhushaDraw(assets.anims);
    this.zdraw.bind(this.player);
    this.npcs = new NpcDraw(assets.cast, this.world.sprites);
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
    // sounds by id (props, the court, the world) wait for the tick's end; her cues (move, phase, tier) claim theirs and
    // play her mapped sound and voice (sound.ts heard / herCue / flush)
    this.feel.onSound = (id, v) => this.sound.heard(id, v);
    this.player.onCue = (c) => this.sound.herCue(c);
    // R plays the FX loop's effects when they are in (zhusha/ult.ts; its stand-ins draw until then)
    this.player.r.fx = { has: (id) => this.fx.clock.has(id), play: (id, o) => this.fx.play(id, o) };
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
  /** The ofuda (the loader lane's PaperOfuda, her sprite's paper): falling in the opening, then on her hat (the white box's). */
  readonly paper = new WorldPaper(ART_PX);
  private paperPose: PaperPose | null = null;
  private paperX = 0;
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

  /** A score cue (the opening, the court). */
  private cue(name: string): void {
    this.sound.cue(name);
    this.onCue(name);
  }

  /**
   * The score: the opening plays Track 1 (the page's conductor owns it), then each place's main theme; beds follow the
   * place; her footsteps land on the drawings where a foot meets the ground (sound.ts STEP_FRAMES).
   */
  private scoreTick(): void {
    const b = this.player.body;
    // the place's main theme (region-music.ts): none while the press waits or the opening's cinema runs; when a
    // theme starts it takes Track 1 down with it (the conductor's handOver, through the link the game kept)
    const themes = this.sound.regions;
    const was = themes.sounding;
    themes.update(placeAt(this.world.places, b.x, b.y, INTERIOR_Y), this.holding || this.opening.active);
    if (themes.sounding && !was) this.openingLink?.handOver?.(THEME_FADE);
    this.sound.flush();
    const shown = this.zdraw.shown(this.player);
    this.sound.footstep(shown?.slot.id ?? null, shown?.index ?? 0, b.grounded && !this.rides.active, this.collision.lastSurface);
    // her voice follows her state, the space she is in (its reverb) and her place on screen (its pan)
    const inside = b.y >= INTERIOR_Y;
    const cam = this.camera.state();
    const p = this.player;
    this.sound.follow({ state: p.state, phase: p.ultPhase, ult: p.ultForm }, spaceFor(themes.playing, inside), ((b.x - cam.cx) * planeXf(cam, 1).s) / Math.max(1, cam.W / 2));
    if (this.tick % 30 !== 0) return;
    this.sound.setBed(inside ? "hall" : b.x < 109 * H ? "lake" : "heights");
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
    // the world window waiting for the press: the opening's first frame, high in the sky over Kagami (behind
    // the website's "dex"), where the fall starts
    if (this.holding) {
      const s0 = keysAt(0, this.player.body.x, this.r.iw, this.r.ih);
      f = { ...f, zoom: s0.zoom, anchor: s0.anchor, horizon: s0.horizon, lead: 0, fixX: s0.cx, fixY: null, pin: null, bounds: null };
    }
    // R's climb: the frame pulls out to hold the whole rise and dive
    if (this.player.camZoom !== null) f = { ...f, zoom: Math.min(f.zoom, this.player.camZoom) };
    // the Q's pull-out holds the exploded area in frame (zhusha/controller.ts camAt)
    if (this.player.camAt !== null) f = { ...f, fixX: this.player.camAt, pin: null };
    return this.framingOverride ? { ...f, ...this.framingOverride } : f;
  }

  // --- time ---------------------------------------------------------------

  /** The world window is covered by the website: no ticks, no drawing, sound faded down. */
  away = false;
  /** Waiting for PLAY in the page column (controls held, Kagami still). */
  holding = false;

  /** She is in the player's hands: no press awaited, the opening handed her back (or never ran: a ?at= start). */
  get playable(): boolean {
    return !this.holding && !this.awaitingPress && (this.opening.state === "off" || this.opening.state === "done");
  }
  /** The opening's link, kept after the opening lets go of it (Track 1 can still sound: the theme fades it). */
  private openingLink: OpeningLink | null = null;

  setAway(away: boolean): void {
    if (away === this.away) return;
    this.away = away;
    this.sound.setVisible(away ? 0 : 1);
  }

  /**
   * The press (PLAY or "continue"): the opening starts on the link's clock (the page's conductor: Track 1 as
   * heard). Without one (tools) it runs silent on the world's own simulated time.
   */
  play(link?: OpeningLink, way: "continue" | "corner" | "top" | "bottom" = "continue"): void {
    if (!this.holding) return;
    this.holding = false;
    this.awaitingPress = false;
    this.frozen = 0;
    this.sound.locked = false;
    if (link?.ctx) this.sound.start(link.ctx);
    this.openingLink = link ?? null;
    // (rev 5) the website's ofuda at the press: the world takes it over where it hangs, at its size and pose
    this.paperFrom = link?.paperFrom ?? null;
    this.pageK = this.paperFrom?.k ?? null;
    this.paperShown = false;
    this.spawnAt(this.world.spawns.find((s) => s.id === "catch")!);
    this.opening.start(link ?? new SilentLink(() => this.time, this.feel.reducedMotion, way));
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

  /** The catch's drawing at its clip tick, her idle held as a still, her walk, or her run playing (opening.ts moves her). */
  private posePlayer(kind: "clip" | "still" | "walk" | "run", tick = 0): void {
    if (kind !== "clip") {
      this.player.posed(kind);
      return;
    }
    // the catch (opening_ofuda): the opening sets the clip's tick from the music; it holds still between
    this.player.posed("still");
    this.player.anim = { role: BEATS.her.clip.slot, t: tick, hitAt: null, hidden: false, flame: 0, dist: 0 };
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
    this.warmFall();
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
    // the opening's camera is time-locked to the music; then the world's tracks have the frame again. Its first
    // keys show the paper at the page's own scale (the loader's: max(2, round(vh x dpr / 540)) device px per art px)
    setStartZoom(this.pageArtPx() / (ART_PX * (this.r.presenter.rect.scale || 1)));
    const shot = this.opening.camera(b.x);
    const cine = shot ? null : this.player.r.shot;
    if (shot) this.camera.set(shot, b.x, b.y);
    else if (cine) {
      // R's shots (zhusha/ult.ts): placed exactly each tick (its own cuts and moves), shake and punch still run
      const cf = { ...f, zoom: cine.zoom, anchor: cine.anchor, lead: 0, fixX: cine.x, fixY: cine.y, pin: null };
      this.camera.snap(cine.x, cine.y, cf, this.player.facing);
      this.camera.update(cine.x, cine.y, this.player.facing, 0, cf);
      // reduced motion: its cuts cross-fade like the camera's own
      if (cine.cut && this.feel.reducedMotion) this.cutFade = 1;
    } else this.camera.update(b.x, b.y, this.player.facing, b.vx, f);
    this.paperTick();
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
    this.near = this.cut || this.tug || this.rides.active || this.warp || this.opening.state === "cine" || this.holding || this.player.r.active ? null : this.findNear();
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
    this.fx.tick();
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

  // --- the ofuda ---------------------------------------------------------------

  /** The hat's tie from the drawn frame's head anchor (world px at 96, facing right). */
  private static readonly HAT_TIE: [number, number] = [2, -7];

  /**
   * The ofuda this tick: none before the press; falling through the opening's sky (its flight on the frame, drawn on
   * to her hand-off point); the catch's drawing has it from f001 to the clip's end; then on her hat, live, while she is
   * the white box (a traced drawing has its own).
   */
  private paperTick(): void {
    const b = this.player.body, f = this.player.facing;
    const speed = (((b.x - this.paperX) * 60) / H) * f;
    this.paperX = b.x;
    const o = this.opening, reduced = this.feel.reducedMotion;
    if (this.holding) {
      this.paperPose = null;
      this.paper.off();
      return;
    }
    const T = o.T;
    if (o.active && T < HANDOFF_T) {
      const sp = paperScreenAt(T, o.way);
      if (!sp || T < startT(o.way)) { this.paperPose = null; this.paper.off(); return; }
      const cam = this.camera.state(), xf = planeXf(cam, 1);
      // its place on the frame, as a world point on the play plane, drawn on to the paper in the catch's f001
      const wx = (sp[0] * cam.W - xf.offX) / xf.s, wy = (sp[1] * cam.H - xf.offY) / xf.s;
      const ho = BEATS.her.clip.handoff;
      const hx = b.x + ho[0] * ART_PX * f, hy = b.y + ho[1] * ART_PX;
      const k = paperBlendAt(T, o.way);
      const fresh = this.paper.mode !== "fall";
      if (fresh) {
        this.paper.startFall(this.paperFrom?.nodes);
        this.paperOff = [0, 0];
      }
      // where the page's paper hangs, against the flight's first point: an offset that fades out as it falls (measured
      // until it drops, so the world window's own layout for the opening, a frame or two late, is the one it sits in)
      {
        const pf = this.paperFrom;
        if (pf && (fresh || T < 0.3)) {
          const dpr = window.devicePixelRatio || 1, pr = this.r.presenter.rect, s0 = this.paper.middleOf(pf.nodes);
          // the page's viewport to this frame (the world window's place on the page, as laid out for the opening)
          const fe = (window.frameElement as HTMLElement | null)?.getBoundingClientRect() ?? { left: 0, top: 0 };
          const fx = ((pf.x - fe.left) * dpr - pr.x) / pr.scale + s0[0] * (pf.k / pr.scale);
          const fy = ((pf.y - fe.top) * dpr - pr.y) / pr.scale + s0[1] * (pf.k / pr.scale);
          const p0 = paperScreenAt(startT(o.way), o.way) ?? sp;
          this.paperOff = [fx - p0[0] * cam.W, fy - p0[1] * cam.H];
        }
      }
      const fade = 1 - smooth(T / 1.2);
      const wxo = wx + (this.paperOff[0] * fade) / xf.s, wyo = wy + (this.paperOff[1] * fade) / xf.s;
      // dropping out of the black it turns into the whole paper (the clip's own size and colours)
      if (T >= BEATS.ofuda.stripAt) {
        this.paper.toWhole();
        this.paper.turn((T - BEATS.ofuda.stripAt) / BEATS.ofuda.stripFor);
      }
      // the last of it: steered onto the clip's paper in the hand-off drawing, so the drawing takes it over in place
      const band = BEATS.her.clip.band, steerFrom = HANDOFF_T - BEATS.ofuda.steer;
      // (on it a tick before the drawing takes over: that tick shows exactly the drawing's paper, drawn by us)
      const u = T <= steerFrom ? 0 : Math.min(1, (T - steerFrom) / (HANDOFF_T - 1 / 60 - steerFrom)) ** 2;
      const nodes = band.map((n) => [b.x + n[0] * ART_PX * f, b.y + n[1] * ART_PX] as [number, number]);
      // and over its last 0.3 s it takes on the clip paper's grain (texel by texel), so the drawing's busier paper follows
      const grain = clamp01((T - (HANDOFF_T - 0.3)) / (0.3 - 1 / 60));
      // and before the steer it turns to lie the clip paper's way
      const turn = smooth((T - (HANDOFF_T - BEATS.ofuda.turn)) / (BEATS.ofuda.turn - BEATS.ofuda.steer / 2));
      this.paperPose = this.paper.fall(wxo + (hx - wxo) * k, wyo + (hy - wyo) * k, paperAirAt(T, o.way), 1 / 60, { nodes, u, grain, turn });
      // the page draws its own paper over this one until the world has drawn it once (column.ts)
      if (!this.paperShown) {
        this.paperShown = true;
        try { window.parent?.document.dispatchEvent(new Event("dex:paperworld")); } catch { /* no page around */ }
      }
      return;
    }
    if (o.active && T < CLIP_END) {
      this.paperPose = null;
      this.paper.off();
      return;
    }
    // a traced drawing has her hat's paper drawn in: the live one is the white box's
    if (this.zdraw.shown(this.player)) {
      this.paperPose = null;
      this.paper.off();
      return;
    }
    const head = this.zdraw.head(this.player);
    const tie = TesuGame.HAT_TIE;
    const w = o.wind();
    this.paperPose = this.paper.hat(b.x + (head[0] + tie[0]) * f, b.y + head[1] + tie[1], f, speed - w.base * f, w.gust, reduced);
  }

  /** Device px per art px the website's loader drew the ofuda at (motion/column.ts), or as it would on this screen. */
  pageArtPx(): number {
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const vh = typeof window !== "undefined" ? window.innerHeight : 720;
    return this.pageK ?? Math.max(2, Math.round((vh * dpr) / 540));
  }
  /** The page's own figure, when it sent one with the press. */
  pageK: number | null = null;
  /** The website's ofuda at the press (conductor.ts PaperFrom), and its offset from the flight's first point (frame px). */
  private paperFrom: PaperFrom | null = null;
  private paperOff: [number, number] = [0, 0];
  /** The world has drawn the paper since the press (the page stops drawing its own then). */
  private paperShown = false;

  /**
   * The black loading screen as a slab above everything (beats.ts ceiling): drawn over the world where the camera is
   * still inside it, the falling paper over the black (it hangs there at the press and falls out of it).
   */
  private drawCeiling(cam: CamState): void {
    const o = this.opening;
    if (!(this.holding || (o.active && o.T < 4))) return;
    const xf = planeXf(cam, 1);
    const row = Math.ceil(ceilingRow(this.player.body.y, xf.s, xf.offY));
    if (row <= 0) return;
    const r = this.r;
    r.begin(0, 0, DAY, []);
    r.rect(0, 0, cam.W, Math.min(cam.H, row), [0, 0, 0], 1, 1, true);
    r.flush();
    this.drawOfuda(cam, false, true);
  }

  /** How near the lens the falling paper is now (opening/timeline.ts paperLensAt; reduced motion: never). */
  private paperLens(): number {
    const o = this.opening;
    return o.active && o.T < HANDOFF_T && !this.feel.reducedMotion ? paperLensAt(o.T, o.way) : 0;
  }

  /** (the lens) Near the camera the falling paper is in front of every plane (the fog in front of the camera passes over it). */
  private drawLensOfuda(cam: CamState): void {
    if (this.paperLens() <= 0) return;
    this.r.begin(0, 0, DAY, []);
    this.drawOfuda(cam, false, true);
    this.r.flush();
  }

  /**
   * The ofuda as pixels at the camera's scale (in front of her: it hangs at the front of her hat, or falls). `top`:
   * the call over every plane (near the lens, and over the black slab); the play plane's own call skips it then.
   */
  private drawOfuda(cam: CamState, behind: boolean, top = false): void {
    const p = this.paperPose;
    if (!p || behind || this.fade >= 1) return;
    if (!top && this.paperLens() > 0) return;
    const r = this.r, xf = planeXf(cam, 1), o = this.opening;
    let glint: number | null = null;
    let lens: { h: number; w: number } | undefined;
    if (o.active && o.T < HANDOFF_T) {
      for (const g of BEATS.ofuda.glints) {
        const u = (o.T - g) / (5 / 12);
        if (u >= 0 && u < 1) glint = u;
      }
      // the camera rides with it: near the lens through the fall (reduced motion: its own size, no zoom on it)
      const w = this.paperLens();
      if (w > 0) lens = { h: BEATS.ofuda.lens.h * cam.H, w };
    }
    r.setTransform();
    WorldPaper.draw(p, (x, y) => [x * xf.s + xf.offX, y * xf.s + xf.offY], glint, this.feel.reducedMotion, (x, y, c, s) => r.rect(x, y, s, s, c, 1, 1, true), lens);
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
    const cam = BEATS.camera, ui = BEATS.ui, walkFrom = BEATS.her.walkFrom;
    // per tile, the runs of T it is on screen (a far plane's tile in the drift may come back in the ease-in);
    // (engine, perf) shared with the build's bake (plates/span.ts), so both name the same tiles
    const { span, most } = openingTiles(this.world, this.collision, W, Hf, reduced, this.levels, (f) => this.flags.has(f));
    // what "continue" waits for, in this order: the widest frame, the drift, the skip's landing; then (streamed
    // while it runs, as the store has room) the whip-out (from the walk on: two seconds are too few to paint it),
    // the walk and the ease back in (each four seconds ahead: the walk is slow, the ease follows a four-second
    // hold). One entry per run of a tile.
    const plan: WarmTile[] = [];
    for (const [k, t] of span) {
      for (const [from, until] of t.runs) {
        const widest = until >= cam.widest.from && from < cam.easeIn.from;
        const skip = until >= ui.skipTo && from <= ui.skipTo + 0.5;
        const rank = widest ? 0 : from < walkFrom ? 1 : skip ? 2 : from >= cam.easeIn.from ? 5 : from >= cam.whip.from ? 3 : 4;
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

  /**
   * The fall's clouds (world/sections/opening-sky.ts) are sprites, painted on demand: while the world waits for the
   * press (behind "dex"), their drawings are asked for at the level the fall shows them, one moment of the fall every
   * third of a second, so none pops in on the way down.
   */
  private fallWarm = { i: 0, defs: null as SpriteDef[] | null };
  private warmFall(): void {
    if (!this.holding || this.loading || this.tick % 20) return;
    const w = this.fallWarm;
    w.defs ??= this.world.sprites.filter((s) => s.id.startsWith("fall-"));
    const moments = [0.5, 1.5, 2.5, 3.5, 4.5, 5.5, 6.5, 7.5, 8.5, 9.5, 10.5];
    if (w.i >= moments.length * 4 || !w.defs.length) return;
    const T = moments[Math.floor(w.i / 4)]!, frame = w.i % 4;
    w.i++;
    const [W, Hf] = this.openingFrame();
    const s = keysAt(T, BEATS.her.catchXH * H, W, Hf);
    const cam: CamState = { cx: s.cx, cy: BEATS.her.deckYH * H, zoom: s.zoom, anchor: s.anchor, horizon: s.horizon, W, H: Hf };
    const a = this.atmosAt(cam.cx, cam.cy);
    for (const id of PLANE_IDS) {
      const defs = w.defs.filter((d) => d.plane === id);
      if (defs.length) this.sprites.draw(defs, cam, this.look(id, a), frame + 0.01, null, false, true);
    }
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
   * Her: a drawing for what she is doing, or the white box (zhusha/draw.ts), at her drawn height
   * (128 px art, feel.json charScale) on the play plane's transform at every zoom.
   */
  private drawPlayer(cam: CamState, focus: [number, number], mirror: number | null): void {
    if (this.fade >= 1) return;
    this.zdraw.draw(this.r, this.player, { s: planeXf(cam, 1).s, focus, mirror });
  }

  /**
   * (engine 10-18) What moves on the play plane, one step of it, in depth order: "back" (her effects behind her, the
   * talisman behind), "art" (her drawing; worker 6: the NPCs), "front" (the talisman in front, her effects in front).
   * `c` and `focus` are the camera of the grid it lands on (the frame, the screen-res layer or the zoomed-out actor
   * buffer, see drawActors): planeXf(c, 1) is the play plane's transform there. The renderer's begin() is done.
   */
  private actorsPass(step: "back" | "art" | "front", c: CamState, focus: [number, number], split = false): void {
    const r = this.r, s = planeXf(c, 1).s;
    // (lane C 10-19) `split`: the screen-res layer's passes, where the sprite effects go with her drawing (her art px
    // at screen res, EFFECTS-CONTRACT.md) instead of with the world-grid back / front steps
    if (step === "back") {
      if (s !== 1) r.setTransform(s, focus);
      if (!split) this.drawFx(c, focus, "back");
      this.vfx.draw(r as unknown as LabRenderer, "back");
      this.vfx.drawAfterimages(r as unknown as LabRenderer);
      this.drawOfuda(c, true);
    } else if (step === "art") {
      // the cast's boxes (or art), then her: the characters stand in front of the play plane's props (engine 10-18:
      // with her on whichever grid she is drawn, so every character's pixels match hers)
      if (split) this.drawFx(c, focus, "back");
      r.setTransform(s, focus);
      this.npcs.draw(r, { s, focus, mirror: null }, this.time, false);
      if (s !== 1) r.setTransform(s, focus);
      else r.setTransform();
      this.drawPlayer(c, focus, null);
      if (split) this.drawFx(c, focus, "front");
    } else {
      this.drawOfuda(c, false);
      if (s !== 1) r.setTransform(s, focus);
      if (!split) this.drawFx(c, focus, "front");
      this.vfx.draw(r as unknown as LabRenderer, "front");
    }
    r.flush();
    r.setTransform();
  }

  /** (lane C 10-19) The sprite effects of a layer on the play plane's transform of `c` (her art px, her pivot snap). */
  private drawFx(c: CamState, focus: [number, number], layer: "back" | "front", mirror: number | null = null): void {
    if (!this.fx.clock.live.length) return;
    const b = this.player.body, s = planeXf(c, 1).s;
    this.r.setTransform(s, focus, mirror);
    this.fx.draw(this.r, { s, focus, mirror }, layer, ART_PX, { x: b.x, y: b.y, facing: this.player.facing }, mirror !== null);
    this.r.flush();
  }

  /** (engine 10-18) The actors in the lake's reflection target (world res): her drawing (worker 6: the NPCs). */
  private reflActors(c: CamState, focus: [number, number], mirror: number | null, reflection = true): void {
    const s = planeXf(c, 1).s;
    this.drawFx(c, focus, "back", mirror);
    this.r.setTransform(s, focus, mirror);
    this.npcs.draw(this.r, { s, focus, mirror }, this.time, reflection);
    this.r.setTransform(s, focus, mirror);
    this.drawPlayer(c, focus, mirror);
    this.drawFx(c, focus, "front", mirror);
    this.r.setTransform(s, focus, mirror);
  }

  /**
   * (lane C 10-19) Whether her drawing goes through the reduction (reducedActors) on a grid that shows the play plane
   * at scale s: zoomed out, or where one of her art px would land under one px of that grid (her 0.88 size on a 1080p
   * screen: 0.66 px), so she is reduced with the feature-keeping rule instead of nearest-neighbour dropping rows.
   */
  private reduceActors(s: number, zoom: number): boolean {
    return ActorLayer.wants(zoom) || s * ART_PX < 1 - 1e-6;
  }

  /**
   * (engine 10-18) The actors in the frame pass. On a screen shown at a whole scale k >= 2 they get their own
   * screen-res layer (render/actors.ts; everything drawn after them goes to the front target, composited over them by
   * the presenter): at play zoom and closer her drawing at screen res, her effects and the talisman on the world grid;
   * zoomed out (lane C 10-19, Dex: "below zoom 1 she and her effects reduce onto HER pixel size, never the world's
   * 2 px grid") all of them reduced from her art density onto that screen-res layer. At k = 1 (1080p) the screen is
   * the frame: reduced onto it zoomed out or where her art px would be under one px (reducedActors), else drawn
   * straight onto it.
   */
  private drawActors(cam: CamState, focus: [number, number], lights: PointLight[]): void {
    const r = this.r, xf = planeXf(cam, 1);
    const steps = ["back", "art", "front"] as const;
    // the renderer maps x to ((x - camX) - fx) * s + fx: match the play plane exactly
    const camOf = (s: number, offX: number, offY: number, f: [number, number]): [number, number] => [(f[0] * (1 - s) - offX) / s, (f[1] * (1 - s) - offY) / s];
    const [camX, camY] = camOf(xf.s, xf.offX, xf.offY, focus);
    const k = r.presenter.rect.scale;
    const all = (c: CamState): void => { for (const st of steps) this.actorsPass(st, c, [c.W / 2, c.anchor * c.H]); };
    if (ScreenActors.wants(k) && ActorLayer.wants(cam.zoom)) {
      // zoomed out on a 2x+ screen: reduced onto her own (screen-res) grid
      this.screen.begin(r, cam.W, cam.H, k);
      this.reducedActors(cam, null, lights, null, all);
      this.screen.end(r);
      r.begin(camX, camY, DAY, lights);
      return;
    }
    if (!ScreenActors.wants(k) && this.reduceActors(xf.s, cam.zoom)) {
      this.reducedActors(cam, r.main, lights, null, all);
      r.begin(camX, camY, DAY, lights);
      return;
    }
    if (!ScreenActors.wants(k)) {
      r.begin(camX, camY, DAY, lights);
      for (const st of steps) this.actorsPass(st, cam, focus);
      return;
    }
    const sc = screenCam(cam, xf, k), fs: [number, number] = [focus[0] * k, focus[1] * k];
    const [sx, sy] = camOf(xf.s * k, xf.offX * k, xf.offY * k, fs);
    this.screen.begin(r, cam.W, cam.H, k);
    this.screen.world(r, () => { r.begin(camX, camY, DAY, lights); this.actorsPass("back", cam, focus, true); });
    this.screen.art(r, () => { r.begin(sx, sy, DAY, lights); this.actorsPass("art", sc, fs, true); });
    this.screen.world(r, () => { r.begin(camX, camY, DAY, lights); this.actorsPass("front", cam, focus, true); });
    this.screen.end(r);
    r.begin(camX, camY, DAY, lights);
  }

  /**
   * (engine 10-18) Wider than play zoom (or where her art px would be under one frame px), what moves on the play plane
   * (her, her effects, the talisman) is drawn at her art density into the actor layer (lane C 10-19: one layer px per
   * art px; `draw` gets the layer's camera), then reduced onto `target` on the frame's grid, or (target null) onto the
   * screen-res actor layer begun for this frame (her own grid, k x the frame's), the reduction anchored to her feet
   * (render/reduce.ts). `mirror`: the reflection's waterline row.
   */
  private reducedActors(cam: CamState, target: Target | null, lights: PointLight[], mirror: number | null, draw: (c: CamState) => void): void {
    const r = this.r, xf = planeXf(cam, 1), b = this.player.body;
    const view = { cx: (cam.W / 2 - xf.offX) / xf.s, cy: (cam.H / 2 - xf.offY) / xf.s };
    const c = this.actors.begin(r, cam, view, [b.x, b.y - H], Math.max(1, 1 / ART_PX));
    // the renderer maps x to ((x - camX) - f) * s + f: match the layer's play-plane transform about the pass's focus
    const lx = this.actors.xf, f: [number, number] = [c.W / 2, c.anchor * c.H];
    r.begin((f[0] * (1 - lx.s) - lx.offX) / lx.s, (f[1] * (1 - lx.s) - lx.offY) / lx.s, DAY, lights);
    draw(c);
    this.actors.end(r);
    if (target) {
      r.bindTarget(target, false);
      this.actors.composite(cam.W, cam.H, xf, [b.x, b.y], mirror);
      return;
    }
    const k = r.presenter.rect.scale;
    this.screen.reduced(r, () => this.actors.composite(cam.W * k, cam.H * k, { s: xf.s * k, offX: xf.offX * k, offY: xf.offY * k }, [b.x, b.y], null));
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
    return levelOfPlane(cam, id, this.levels.get(id)!);
  }

  /** The tiles of a plane at level lv covering frame rows [ya, yb). */
  private tileSpan(cam: CamState, id: PlaneId, lv: number, ya: number, yb: number): { level: number; tx0: number; tx1: number; ty0: number; ty1: number } {
    return tileSpanOf(cam, id, lv, ya, yb);
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
          // (engine 10-18) zoomed out between levels the plate is reduced onto the frame's grid, a footprint reaching
          // into the right / lower neighbours (render/reduce.ts)
          const red = k < 0.999;
          quads.push({
            x0: tx * TILE * k + xf.offX, y0: ty * TILE * k + xf.offY, x1: (tx + 1) * TILE * k + xf.offX, y1: (ty + 1) * TILE * k + xf.offY, layer,
            ax: tx * TILE, ay: ty * TILE, k, off: [xf.offX, xf.offY],
            right: red ? this.peek(id, lv, tx + 1, ty) : -1, down: red ? this.peek(id, lv, tx, ty + 1) : -1, diag: red ? this.peek(id, lv, tx + 1, ty + 1) : -1,
          });
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
    // (engine 10-18, loading) until the first scene is in, a frame only asks for what it needs (plates, the reflection's
    // rows, sprite frames) and draws nothing: the world is not shown while it loads, and a drawn frame there cost the
    // page's thread and GPU a whole scene per animation frame, beside the website's "dex"
    if (this.loading && !this.shown && !this.manual) {
      if (water) {
        for (const id of PLANE_IDS) {
          if (id === "near") continue;
          const m = rowOf(cam, PLANES[id].rate, water.y);
          if (m >= Hf + 2) continue;
          const pd = this.planeQuads(cam, id, Math.max(-Hf * 3, 2 * m - Hf), m + 1, a, false);
          this.sprites.draw(this.world.sprites.filter((sp) => sp.plane === id && sp.reflect !== false && !this.npcs.has(sp)), cam, pd.look, this.time, m, false, true);
        }
      }
      for (const id of PLANE_IDS) this.sprites.draw(this.world.sprites.filter((sp) => sp.plane === id && !this.npcs.has(sp)), cam, draws.get(id)!.look, this.time, null, false, true);
      return;
    }
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
        this.sprites.draw(this.world.sprites.filter((sp) => sp.plane === id && sp.reflect !== false && !this.npcs.has(sp)), cam, pd.look, this.time, m, this.manual);
        fogOn(id, true);
        if (id === "play" && this.reduceActors(planeXf(cam, 1).s, cam.zoom)) {
          // (engine 10-18) zoomed out (lane C 10-19: or her art px under one world px): the reflection is the actors'
          // reduced drawing, mirrored
          this.reducedActors(cam, this.refl, lights, wlPlay, (c) => this.reflActors(c, [c.W / 2, c.anchor * c.H], null));
        } else if (id === "play") {
          r.begin(camX, camY, DAY, lights);
          r.setTransform(s4, focus, wlPlay);
          if (cam.zoom < 1.9) this.reflActors(cam, focus, wlPlay);
          r.flush();
          r.setTransform();
        }
      }
    }

    // --- the frame
    r.bindTarget(r.main, true, [0, 0, 0, 1]);
    // (the opening's fall) high in the sky the eye-level row lies below the frame: the sky keeps its gradient over
    // the frame (deep above, paler toward the haze below), never one flat fill
    this.atmos.drawSky(W, Hf, Math.min(hz, Hf * 1.04), sky[0]!, sky[1]!, sky[2]!, sunPx, false, glow);
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
        // her and her effects (on the frame, on the screen-res layer, or reduced when zoomed out: drawActors), then
        // the near water over the play plane's underwater parts
        this.drawActors(cam, focus, lights);
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
      this.sprites.draw(this.world.sprites.filter((sp) => sp.plane === id && !this.npcs.has(sp)), cam, look, this.time, null, this.manual);
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
    // the opening's fall: fog layers in front of the camera, sweeping up past it as it comes down (opening/sky.ts)
    this.drawLensOfuda(cam);
    if (this.opening.active && this.opening.T < BEATS.her.walkFrom) this.veils.draw(W, Hf, fallVeils(this.opening.T, W, Hf, this.opening.way, this.feel.reducedMotion));
    this.drawCeiling(cam);
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
      bars: this.player.r.bars,
      overlay: false,
      layers: this.screen.take(),
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
      ofuda: this.paperPose ? [Math.round((this.paperPose.pts[0]![0] + this.paperPose.pts[11]![0]) / 2), Math.round((this.paperPose.pts[0]![1] + this.paperPose.pts[11]![1]) / 2)] : null, paper: this.paper.mode,
      charm: this.warp ? `warp:${this.warp.c.id}` : this.perch ? `perch:${this.perch.c.id}` : null,
      ride: this.rides.active ? { id: this.rides.active.def.id, dir: this.rides.active.dir, t: +this.rides.active.t.toFixed(2) } : null, vista: !!this.vista,
      court: this.court.state_(), hp: this.player.hp, ultCd: this.player.ultCd,
      props: this.props.state(), airborne: this.props.airborne(), broken: this.props.broken,
      music: { theme: this.sound.regions.playing },
    };
  }

  debugText(): string {
    const s = this.state();
    return Object.entries(s).map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`).join("\n");
  }
}

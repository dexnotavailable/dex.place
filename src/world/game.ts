// The world runtime: one loop that ties together the room system (streamed
// rooms with scene-engine backdrops, terrain, props, doors, lifts and rides,
// exits), the lab's player (controller, moves, VFX, rim lighting, runtime
// contract) at the locked scale, the world camera and its modes, weather and
// time, ambient life, the music state machine, interaction and panels, the
// save, the story and sound hooks, the travel-time logger, and the presenter.
//
// Props come from two engines: the runtime's stub recipes (props/*.ts) and
// the pixel-matter engine (src/pixel) through the adapter (pixel/adapter.ts).
// Both feed collision, light, E and sound the same way.
//
// Timing is the lab's: 60 Hz real ticks (camera, shake, slow-mo, fades) feed
// a simulation accumulator; hitstop freezes simulation ticks only.
//
// Draw order per frame:
//   reflection: backdrop layers mirrored + the world's reflecting sprites
//               (terrain, props, the player) mirrored about the waterline
//   main:       backdrop back pass -> far/back props (+ pixel far, bg),
//               terrain, decals -> middle props (+ pixel mid, decal) ->
//               effects (back) -> player -> effects (front) -> front props
//               (+ pixel fg) and terrain -> light layer (+ pixel light,
//               glows, particles) -> ambient -> backdrop front pass (foreground,
//               near rain) -> prompt, HUD
//   close-up:   when the combat zoom is on, the player and her effects again
//               from the 144 px bake at native pixel size, over the zoomed world
//   present:    scale rule, bars, impact frames, fades

import type { Action, Input } from "../lab/engine/input.ts";
import type { Camera } from "../lab/engine/camera.ts";
import type { Renderer as LabRenderer, SpriteSheet } from "../lab/engine/renderer.ts";
import { Vfx } from "../lab/engine/vfx.ts";
import { overlap, type Services, type WorldBox } from "../lab/game/events.ts";
import { Feel } from "../lab/game/feel.ts";
import { Player } from "../lab/game/player.ts";
import type { Frame } from "../lab/contracts.ts";
import type { World as LabWorld } from "../lab/game/world.ts";
import { FlashGate } from "../scenes/engine/flashes.ts";
import { Ambient } from "./ambient.ts";
import { WorldAudio } from "./audio.ts";
import { h, PHYSICS, SCALE, STREAM } from "./config.ts";
import { Hooks, type WorldApi } from "./hooks.ts";
import type { PlayerAssets } from "./player/setup.ts";
import { loopFrameAt } from "./player/frames.ts";
import { PixelDraw } from "./pixel/adapter.ts";
import type { CellTexture, Interaction, Prop, PropCanvas, PropHit, PropLight, PropWorld } from "./props-api.ts";
import { WorldRenderer, VFX_TYPE, type PointLight, type RGB } from "./render/renderer.ts";
import { WorldCamera } from "./room/camera.ts";
import { Room, RoomStream } from "./room/room.ts";
import type { Area, RoomAudio, RoomCamera, RoomDef, Spawn } from "./room/types.ts";
import { Save } from "./save.ts";
import type { StubTexture } from "./props/stub.ts";
import type { Touch } from "./touch.ts";
import { Travel, type Dest } from "./travel.ts";
import { Panels, type PanelKind } from "./ui.ts";
import { Weather, type WeatherProgram } from "./weather.ts";
import type { PixelMatterEngine } from "./props-api.ts";
import type { Prop as PxProp, HitType, LayerName } from "../pixel/index.ts";

const TICK = 1000 / 60;

type Mode = "intro" | "play" | "transition";

export interface GameOpts {
  rooms: RoomDef[];
  start: { room: string; spawn: string };
  engine: PixelMatterEngine;
  /** Where each room came from (debug). */
  source?: Map<string, string>;
  /** The route order for the map (room ids). */
  route?: string[];
}

/** Something the player can use: a stub prop or a pixel-matter prop. */
type Near = { kind: "stub"; prop: Prop; it: Interaction } | { kind: "pixel"; prop: PxProp };

/** Duck-typed door protocol: a prop that finishes opening (doors, the ferry boat). */
type Opener = Prop & { justOpened?: boolean; close?: () => void };

export class WorldGame {
  readonly camera = new WorldCamera();
  readonly feel: Feel;
  readonly vfx: Vfx;
  readonly player: Player;
  readonly closeupSprite: PlayerAssets["closeup"];
  readonly audio = new WorldAudio();
  readonly weather: Weather;
  readonly save = new Save();
  readonly stream: RoomStream;
  readonly panels: Panels;
  readonly ambient = new Ambient();
  readonly gate = new FlashGate();
  readonly hooks = new Hooks();
  readonly travel = new Travel();
  readonly pixelDraw: PixelDraw;
  readonly api: WorldApi;
  room!: Room;
  mode: Mode = "intro";
  debug = false;
  manual = false;
  reduced: boolean;
  simTicks = 0;
  realTicks = 0;
  fps = 0;
  frameMs = 0;
  seconds = 0;
  /** The website is up (scrolled away): the world waits. */
  away = false;
  private acc = 0;
  private simAcc = 0;
  private last = -1;
  private fpsFrames = 0;
  private fpsT0 = 0;
  private fade = 1;
  /** Honest loading: black until the first room's shaders are compiled (no fake wait). */
  loading = true;
  private trans: { t: number; to: { room: string; spawn: string }; switched: boolean; kind: "door" | "edge" | "pit" } | null = null;
  private lastSafe: [number, number] = [0, 0];
  private near: Near | null = null;
  private pushes: PropWorld["pushes"] = [];
  private hitProps = new Map<string, Set<string>>();
  private pixelGroups = new Set<string>();
  private insideFor = 0;
  private stormPassed = false;
  private audioTick = 0;
  private services: Services;
  private propWorld: PropWorld;
  private canvasApi: PropCanvas;
  private defs: Map<string, RoomDef>;
  private resting = 0;
  /** Rest duck (seconds left). */
  private restDuck = 0;
  /** For the scale report: measured player height at each size. */
  heights: PlayerAssets["heights"];
  private inputProxy: Input;
  /** Controls frozen this tick: the proxy hides input from the player without dropping held keys. */
  private inputMuted = false;
  /** The area the player is in (or null). */
  area: Area | null = null;
  /** Sitting on a bench: the camera holds, the UI hides, the music dips. */
  /** Sitting on a bench: its id, and where she sits (x, and y the floor under the seat). */
  sitting: { id: string; x: number; y: number } | null = null;
  private sitTicks = 0;
  /** Wading (feet in shallow water). */
  wading = false;
  /** The arena is on (the terminal is woken, summoning or holding its seal). */
  private arena = false;
  private pendingCooldown: { prop: PxProp; t: number } | null = null;
  /** Named music ducks in dB (hooks: "colossus" at Stonetop). */
  readonly ducks = new Map<string, number>();
  /** The theme's "from the top" happened in this region (it restarts only on coming back from another region). */
  private fromTopRegion: string | null = null;
  private moved = false;
  private beganAt = 0;
  private triggersIn = new Set<number>();
  private rumbleIn = 30;
  private stillFor = 0;

  constructor(
    readonly r: WorldRenderer,
    readonly input: Input,
    readonly touch: Touch,
    assets: PlayerAssets,
    private opts: GameOpts,
  ) {
    this.reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.defs = new Map(opts.rooms.map((d) => [d.id, d]));
    this.heights = assets.heights;
    this.vfx = new Vfx(assets.vfx);
    this.feel = new Feel(this.camera as unknown as Camera, assets.tuning.feel);
    this.feel.onSound = (id, v) => this.cue(id, v);
    this.services = { vfx: this.vfx, feel: this.feel, camera: this.camera as unknown as Camera };
    this.closeupSprite = assets.closeup;
    this.weather = new Weather(() => this.gate.allow(this.seconds, this.reduced));
    this.weather.onThunder = (s) => {
      if (this.audioFor().cut) return; // above the storm now: its thunder stays behind
      if (this.room.def.underground) this.audio.rumble(s);
      else this.audio.thunder(s, this.room.def.audio.weatherThrough ?? 1);
    };
    this.panels = new Panels(r.canvas);
    this.panels.onClose = (k) => this.panelClosed(k);
    this.pixelDraw = new PixelDraw(r.canvas, r.gl);
    this.api = this.makeApi();
    this.save.onFlag = (k, v) => {
      this.travel.mark("flag", `${k}=${v}`);
      this.hooks.flag(k, v, this.api);
    };
    this.stream = new RoomStream(
      this.defs,
      {
        r,
        gate: () => this.gate.allow(this.seconds, this.reduced),
        engine: opts.engine,
        flag: (k) => this.save.get(k),
        pixelDraw: () => this.pixelDraw,
        pixelSave: () => this.save.data.props ?? {},
      },
      STREAM.keepDepth,
      (d) => this.hooks.room(d, this.api),
    );

    // the lab's player, fed a proxy input: "down" only means drop-through on a one-way platform
    const col = (): Room["collision"] => this.room.collision;
    this.inputProxy = new Proxy(input, {
      get: (t, k, rcv) => {
        // while controls are frozen (a door, a ride, a rest) the player sees no input, but keys
        // still physically held stay held, so walking through a door keeps walking after it
        if (k === "isDown") return (a: Action) => !this.inputMuted && (a === "down" ? t.isDown("down") && col().onOneWay(this.player.body) : t.isDown(a));
        if (k === "axis") return () => (this.inputMuted ? 0 : t.axis());
        if (k === "pressTick") return (a: Action) => (this.inputMuted ? undefined : t.pressTick(a));
        if (k === "pressed") return (a: Action, buf?: number) => !this.inputMuted && t.pressed(a, buf);
        const v = Reflect.get(t, k, rcv) as unknown;
        return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(t) : v;
      },
    });
    this.player = new Player(assets.sprite, assets.tuning.player, this.services, [0, 0]);
    // seated on a bench she is drawn from the sprite's sit clip (everything that draws or masks her
    // goes through spriteDraw, so the reflection and the gallery's mask follow)
    this.worldSprite = assets.sprite;
    const standing = this.player.spriteDraw.bind(this.player);
    this.player.spriteDraw = () => this.seatedDraw() ?? standing();

    this.propWorld = {
      time: 0,
      tick: 0,
      reduced: this.reduced,
      wind: 0,
      rain: 0,
      flash: 0,
      player: { x: 0, y: 0, vx: 0, vy: 0, facing: 1, h: SCALE.H },
      sound: (id, v = 1, at) => this.audio.play(id, v, at ? this.pan(at[0]) : 0),
      save: { get: (k) => this.save.get(k), set: (k, v) => this.save.set(k, v) },
      session: { get: (k) => this.save.getSession(k), set: (k, v) => this.save.setSession(k, v) },
      openPanel: (k, a) => this.openPanel(k, a),
      vfx: (id, x, y, facing = 1) => this.vfx.spawn(id, { x, y, facing }),
      pushes: this.pushes,
      signal: (target, msg) => this.signal(target, msg),
    };
    const r2 = this.r;
    this.canvasApi = {
      cells: (tex: CellTexture, x, y, o = {}) => {
        const t = tex as StubTexture;
        r2.sprite({ sheet: t.handle as SpriteSheet, sx: o.sx ?? 0, sy: o.sy ?? 0, sw: o.sw ?? t.w, sh: o.sh ?? t.h, x, y, flip: o.flip, lit: o.lit ?? 1, opacity: o.opacity ?? 1 });
      },
      rect: (x, y, w, hh, c, op = 1) => r2.rect(x, y, w, hh, c, 1, op),
      glow: (x, y, rad, c, s) =>
        r2.vfx({
          type: VFX_TYPE.disc, t: 0, seed: 0, over: 0,
          p0: [0, rad, 1, 0], p1: [0, 0, 0, 0],
          core: [c[0] * s * 1.2, c[1] * s * 1.2, c[2] * s * 1.2], main: [c[0] * s * 0.7, c[1] * s * 0.7, c[2] * s * 0.7], edge: [c[0] * s * 0.35, c[1] * s * 0.35, c[2] * s * 0.35],
          x, y, rot: 0, sx: 1, sy: 1, ext: [-rad - 1, -rad - 1, rad + 1, rad + 1],
        }),
    };
    this.vfx.groundAt = (x, y) => this.room.collision.groundAt(x, y);
    this.camera.reducedMotion = this.reduced;
    input.onToggle = (what) => {
      if (what === "debug") this.debug = !this.debug;
    };
    this.hooks.install(this.api);
    const rest = this.save.data.rest;
    const start = rest && this.defs.has(rest.room) ? rest : opts.start;
    this.enter(start.room, start.spawn, true);
  }

  private pan(x: number): number {
    return Math.max(-1, Math.min(1, (x - (this.camera.x + SCALE.viewW / 2)) / (SCALE.viewW / 2)));
  }

  private makeApi(): WorldApi {
    return {
      flag: (k) => this.save.get(k),
      setFlag: (k, v) => this.save.set(k, v),
      session: (k) => this.save.getSession(k),
      setSession: (k, v) => this.save.setSession(k, v),
      room: () => this.room?.def.id ?? "",
      area: () => this.area?.id ?? null,
      player: () => ({ x: this.player.body.x, y: this.player.body.y, grounded: this.player.body.grounded, facing: this.player.facing }),
      prop: (id) => this.room?.prop(id),
      pixelProp: (id) => this.room?.pixel?.world.find(id),
      signal: (id, msg) => this.signal(id, msg),
      weather: (room, program) => {
        if (program) this.weather.overrides.set(room, program);
        else this.weather.overrides.delete(room);
      },
      duck: (name, db) => {
        if (db > 0) this.ducks.set(name, db);
        else this.ducks.delete(name);
      },
      panel: (k, a) => this.openPanel(k, a),
      sound: (id, v) => this.audio.play(id, v ?? 1),
      time: () => this.seconds,
      shake: (px, ticks) => {
        if (!this.reduced) this.camera.shake(px, ticks);
      },
      rebuild: (id) => {
        if (id === this.room?.def.id) return false;
        const r = this.stream.rooms.get(id);
        if (!r || !r.built) return false;
        r.dispose();
        return true;
      },
      setRest: (room, spawn) => this.save.setRest(room, spawn),
      reduced: this.reduced,
    };
  }

  /** A message to a prop in the current room (stub receive(), or a pixel-matter state by name). */
  signal(target: string, msg: string): void {
    const p = this.room.prop(target);
    if (p?.receive) {
      p.receive(msg, this.propWorld);
      return;
    }
    const px = this.room.pixel?.world.find(target);
    if (px && px.recipe.states[msg]) px.go(msg);
  }

  // --- rooms -------------------------------------------------------------------------

  private program(): WeatherProgram {
    const d = this.room.def;
    const o = this.weather.overrides.get(d.id);
    if (o) return o;
    if (d.weatherIf && this.save.get(d.weatherIf.flag)) return d.weatherIf.program;
    return d.weather;
  }

  /** The room's camera, or the current area's. */
  private cameraFor(): RoomCamera {
    const d = this.room.def;
    const base: RoomCamera = d.camera ?? { mode: "free" };
    const a = this.area;
    if (!a?.camera) return base;
    const c = { ...a.camera };
    if (c.mode === "locked" && !c.at) {
      // a locked area frames itself where you walked in: centred on the area, feet at its anchor
      if (!this.lockedAt) {
        const b = this.player.body;
        const anchor = c.anchor ?? base.anchor ?? 0.64;
        this.lockedAt = [Math.round((a.x0 + a.x1) / 2 - SCALE.viewW / 2), Math.round(b.y - SCALE.viewH * anchor)];
      }
      c.at = this.lockedAt;
    }
    return c;
  }
  private lockedAt: [number, number] | null = null;

  /** The room's audio with the current area's overrides. */
  audioFor(): RoomAudio {
    const d = this.room.def;
    const a = d.audioIf && this.save.get(d.audioIf.flag) ? { ...d.audio, ...d.audioIf.audio } : d.audio;
    return this.area?.audio ? { ...a, ...this.area.audio } : a;
  }

  private findArea(): Area | null {
    const b = this.player.body;
    for (const a of this.room.def.areas ?? []) {
      if (b.x < a.x0 || b.x > a.x1) continue;
      if (a.y0 !== undefined && b.y < a.y0) continue;
      if (a.y1 !== undefined && b.y > a.y1) continue;
      return a;
    }
    return null;
  }

  private enter(roomId: string, spawnId: string, first = false): void {
    if (this.sitting) this.stand();
    const room = this.stream.get(roomId);
    room.build();
    this.room = room;
    this.stream.settle(roomId);
    const d = room.def;
    const sp: Spawn = d.spawns[spawnId] ?? Object.values(d.spawns)[0]!;
    const b = this.player.body;
    b.x = sp.x;
    b.y = sp.y;
    b.vx = 0;
    b.vy = 0;
    this.player.facing = sp.facing;
    this.player.checkpoint = [sp.x, sp.y];
    this.lastSafe = [sp.x, sp.y];
    this.vfx.clear();
    this.sitting = null;
    this.summonView = false;
    this.camera.override = null;
    for (const p of room.props) (p as Opener).close?.();
    // arriving on a carrier puts it at that stop (and sends it on)
    if (sp.ride) {
      const c = room.prop(sp.ride.prop);
      c?.snapStop?.(sp.ride.stop);
      // go: a stop index, or -1 for "onward" (the furthest stop the save allows: the express)
      if (c && sp.ride.go !== undefined) c.receive?.(sp.ride.go < 0 ? "go" : `go:${sp.ride.go}`, this.propWorld);
      room.syncCollision();
    }
    this.area = null;
    this.lockedAt = null;
    this.area = this.findArea();
    this.camera.zones = d.zones ?? [];
    this.camera.resetRail();
    this.camera.mode = this.cameraFor();
    this.camera.arenaActive = false;
    this.camera.snapTo(b.x, b.y, sp.facing, room.collision.bounds());
    this.ambient.reset(d.ambient, d.w, d.h);
    const u = b.x / d.w;
    if (first || !d.weather.interior) this.weather.snap(this.program(), u);
    else this.weather.interior = true;
    if (!first) this.roomAudio(true);
    this.hitProps.clear();
    this.pixelGroups.clear();
    this.triggersIn.clear();
    if (this.fromTopRegion && d.region !== this.fromTopRegion) this.fromTopRegion = null;
    this.travel.mark("room", d.id);
    if (this.area) this.travel.mark("area", this.area.id);
    this.hooks.enter(d.id, null, this.api);
    if (this.area) this.hooks.enter(d.id, this.area.id, this.api);
  }

  private roomAudio(entering: boolean): void {
    if (entering) this.audio.setBed(this.audioFor().bed);
    this.musicLevel(true);
  }

  /** The music machine, every 12 ticks (WORLD-PLAN section 9). */
  private musicLevel(force = false): void {
    const a = this.audioFor();
    if (!this.audio.started) return;
    const b = this.player.body;
    const x = b.x;
    const want = this.arena ? "arena" : a.music;
    let level = a.level ?? (want === "arena" ? 0.8 : 0.72);
    const through = this.room.def.underground ? 0 : a.weatherThrough ?? 1;
    // where the storm cut off, the weather heard is the place's own (the calm), not the rain still easing out
    const wx = a.cut ? this.weather.target(this.program(), x / this.room.def.w).p : null;
    level *= 1 - (wx ? wx.rain : this.weather.p.rain) * 0.45 * through;
    let db = a.duck ?? 0;
    if (this.restDuck > 0) db += 5;
    if (this.sitting) db += 4;
    if (this.panels.open) db += this.panels.kind === "gallery" ? 6 : this.panels.kind === "map" ? 0 : 3;
    for (const v of this.ducks.values()) db += v;
    level *= Math.pow(10, -db / 20);
    const silent = a.silent || !!a.silence?.some(([x0, x1]) => x >= x0 && x <= x1);
    // muffle: a number, or a ramp along the room's y (the lift ride opening up)
    let muffle = 0;
    if (typeof a.muffle === "number") muffle = a.muffle;
    else if (a.muffle) {
      const k = Math.max(0, Math.min(1, (b.y - a.muffle.y0) / (a.muffle.y1 - a.muffle.y0 || 1)));
      muffle = a.muffle.from + (a.muffle.to - a.muffle.from) * k;
    }
    this.audio.setMuffle(muffle, typeof a.muffle === "number" ? 1.5 : 0.4);
    if (want === "arena") this.audio.setMusic("arena", level, { rise: 3 });
    else if (want === "theme") {
      const cur = this.audio.current();
      if (a.fromTop && this.fromTopRegion !== (this.room.def.region ?? this.room.def.id)) {
        // from the top: the one place the theme restarts rather than continues
        this.fromTopRegion = this.room.def.region ?? this.room.def.id;
        this.audio.setMusic("theme", silent ? 0 : level, { restart: true, rise: 9, delay: 2.5 });
      } else if (cur !== "theme") {
        const e = a.enter;
        const since = this.seconds - this.beganAt;
        const wait = (e?.wait ?? 0) > since || (e?.move && !this.moved);
        if (!wait) this.audio.setMusic("theme", silent ? 0 : level, { at: e?.at, rise: e?.rise ?? 9, delay: e?.delay });
      } else this.audio.setMusic("theme", silent ? 0 : level, silent ? { fade: 4 } : {});
    } else if (want === "none") {
      if (this.audio.current() !== "none" || force) this.audio.setMusic("none", 0, { fade: this.arenaExit > 0 ? 6 : 4 });
    }
    const rain = this.room.def.underground ? 0 : wx ? wx.rain : this.weather.p.rain;
    const wind = this.room.def.underground ? 0 : wx ? wx.wind : this.weather.wind;
    this.audio.setWeather(rain, wind, through * (this.area?.roofed ? 0.5 : 1));
  }

  private go(to: { room: string; spawn: string }, kind: "door" | "edge" | "pit"): void {
    if (this.trans) return;
    this.trans = { t: 0, to, switched: false, kind };
  }

  // --- intro / sound ---------------------------------------------------------------------

  /** The one Enter action: control now, sound starts in its chosen state. */
  begin(): void {
    if (this.mode !== "intro") return;
    this.mode = "play";
    this.beganAt = this.seconds;
    this.travel.begin();
    this.travel.mark("room", this.room.def.id);
    this.audio.start(!this.save.data.sound);
    this.roomAudio(true);
  }

  setSound(on: boolean): void {
    this.save.setSound(on);
    this.audio.setMuted(!on);
  }

  /** Scroll-away pauses World work; resume starts a fresh clock without hidden-time catch-up. */
  setAway(away: boolean): void {
    if (this.away === away) return;
    this.away = away;
    this.last = -1;
    this.acc = 0;
    this.fpsFrames = 0;
    this.fpsT0 = performance.now();
    this.frameMs = 0;
    this.fps = 0;
    this.audio.setAway(away);
    if (away) this.input.releaseAll();
  }

  // --- panels --------------------------------------------------------------------------

  private openPanel(kind: string, arg?: string): void {
    if (kind === "rest") {
      this.rest(arg ?? "");
      return;
    }
    if (kind === "sit") {
      this.sit(arg ?? "");
      return;
    }
    if (kind === "summon") {
      // where the arena says what to watch (the Crown's seal ring), the view goes there while the
      // seals light one after another and hold; otherwise the combat zoom hook: the close-up
      // render path takes over while the terminal calls
      const focus = this.room.def.camera?.arena?.focus;
      if (focus !== undefined) {
        this.summonView = true;
        this.camera.override = { cx: focus, bars: 0.07 };
      } else this.camera.setCloseup(true);
      this.camera.shake(2, 30);
      return;
    }
    if (kind === "summoned") {
      this.camera.setCloseup(false);
      this.endSummonView();
      this.panels.show("summoned");
      return;
    }
    if (kind === "map") {
      const route = this.opts.route ?? this.opts.rooms.map((r) => r.id);
      this.panels.mapInfo = {
        rooms: route.filter((id) => this.defs.has(id) || id === "B3").map((id) => ({ id, label: this.defs.get(id)?.title.split(":")[0] ?? id, origin: this.defs.get(id)?.origin, w: this.defs.get(id)?.w, h: this.defs.get(id)?.h })),
        here: this.area?.id ?? this.room.def.id,
        visited: new Set(this.travel.events.filter((e) => e.kind === "room" || e.kind === "area").map((e) => e.id)),
        shrines: [1, 2, 3, 4, 5, 6].filter((n) => this.save.get(`shrine:${n}`)),
      };
    }
    this.panels.show(kind as PanelKind, arg);
    this.input.releaseAll();
  }

  private panelClosed(k: PanelKind): void {
    // an ordinary door that opened onto a panel closes again behind you
    for (const p of this.room.props) if ((p as Opener).close && p.state === "open") (p as Opener).close!();
    void k;
  }

  /** Resting at a shrine lantern: it stays lit, the rest place moves here, the lamps toward the next shrine light up. */
  private rest(id: string): void {
    const p = this.player;
    p.hp = p.t.hp;
    p.checkpoint = [p.body.x, p.body.y];
    const spawn = Object.entries(this.room.def.spawns).sort((a, b) => Math.abs(a[1].x - p.body.x) - Math.abs(b[1].x - p.body.x))[0]?.[0] ?? "";
    this.save.setRest(this.room.def.id, spawn);
    this.resting = 90;
    this.restDuck = 8;
    this.vfx.spawn("ring.halo", { x: p.body.x, y: p.body.y - 4, facing: 1, scale: 1.2 });
    this.audio.play("chime", 0.5);
    const m = /^shrine:(\d)$/.exec(id);
    if (m) {
      this.save.set(id, true);
      this.hooks.rest(Number(m[1]), this.api);
    }
  }

  /** Sitting on a bench: the camera holds on the view, the UI hides, the music dips. Any move stands up. */
  private sit(id: string): void {
    const bench = this.room.prop(id);
    if (!bench) return;
    const b = this.player.body;
    b.x = bench.x;
    b.vx = 0;
    this.sitting = { id, x: bench.x, y: bench.y };
    this.sitTicks = 0;
    // hold on the room's vista near the bench if there is one, else a little ahead of the way she faces
    const z = (this.room.def.zones ?? []).find((q) => bench.x >= q.x0 && bench.x <= q.x1 && q.cx !== undefined);
    this.camera.override = { cx: z?.cx ?? bench.x + this.player.facing * SCALE.viewW * 0.12, cy: z?.cy, bars: 0.07 };
    this.input.releaseAll();
    this.touch.usable(false);
  }

  private stand(): void {
    const id = this.sitting?.id;
    this.sitting = null;
    this.camera.override = null;
    // Keep the kit bench's state in step with the player. Otherwise moving
    // away leaves it "sat", and the next use only stands the empty bench up.
    if (id) this.room.pixel?.world.find(id)?.act("stand");
  }

  // --- input ---------------------------------------------------------------------------

  use(): void {
    if (this.mode === "intro") {
      this.begin();
      return;
    }
    if (this.mode !== "play" || this.panels.open || !this.near || this.away) return;
    if (this.sitting) {
      this.stand();
      return;
    }
    const n = this.near;
    if (n.kind === "stub") n.it.use(this.propWorld);
    else n.prop.use();
  }

  // --- time ------------------------------------------------------------------------------

  frame(now: number): void {
    if (this.last < 0) this.last = now;
    const dt = Math.min(100, now - this.last);
    this.last = now;
    // Keep the cheap RAF clock alive for smooth return, but submit no hidden
    // World render, shader polling or neighbour warming while reading the site.
    if (this.away) {
      this.acc = 0;
      this.frameMs = 0;
      this.fps = 0;
      this.fpsFrames = 0;
      this.fpsT0 = now;
      return;
    }
    if (!this.manual) {
      this.acc += dt;
      while (this.acc >= TICK) {
        this.acc -= TICK;
        this.realTick();
      }
    }
    // neighbours' shaders finish compiling in the background
    for (const r of this.stream.rooms.values()) if (r !== this.room && r.built) r.backdrop?.poll();
    const t0 = performance.now();
    this.render();
    this.frameMs = performance.now() - t0;
    this.fpsFrames++;
    if (now - this.fpsT0 >= 500) {
      this.fps = (this.fpsFrames * 1000) / (now - this.fpsT0);
      this.fpsFrames = 0;
      this.fpsT0 = now;
      // warm a neighbour in a calm moment (one per half second at most)
      if (!this.trans && !this.loading) this.stream.warmOne(this.room.def.id);
    }
  }

  realTick(): void {
    this.realTicks++;
    this.seconds += 1 / 60;
    if (this.away) return;
    this.feel.realTick();
    this.vfx.realTick();
    this.transitionTick();
    this.simAcc += this.feel.slowFactor;
    while (this.simAcc >= 1) {
      this.simAcc -= 1;
      this.simTick();
    }
    const b = this.player.body;
    const d = this.room.def;
    this.weather.update(1 / 60, this.program(), b.x / d.w, d.w, this.camera.x, this.reduced);
    this.room.backdrop?.update(1 / 60);
    // camera: mode (room or area), stillness for vista holds, the arena clamp
    const moving = Math.abs(b.vx) > 0.5 || !b.grounded;
    this.stillFor = moving ? 0 : this.stillFor + 1 / 60;
    this.camera.still = this.stillFor;
    this.camera.arenaActive = this.arenaClamp;
    this.camera.update(b.x, b.y, this.player.facing, this.room.collision.bounds(), Math.abs(b.vx) > 0.5, b.vy);
    this.touch.cooldowns(this.player.skillCd <= 0, this.player.ultCd <= 0);
    if (++this.audioTick % 12 === 0) this.musicLevel();
    if (this.restDuck > 0) this.restDuck -= 1 / 60;
    if (this.room.def.underground && this.mode === "play" && (this.rumbleIn -= 1 / 60) <= 0) {
      this.rumbleIn = 25 + Math.random() * 30;
      this.audio.rumble(0.7);
    }
    this.hooks.tick(this.api, 1 / 60);
    this.storyTick();
  }

  /** The test world's beat: the storm passes while you're indoors. Final rooms keep their weather. */
  private storyTick(): void {
    const target = this.room.def.stormPasses;
    if (this.stormPassed || !target) return;
    if (this.room.def.weather.interior && this.weather.p.lightning > 2) this.insideFor += 1 / 60;
    if (this.insideFor > 40) {
      this.stormPassed = true;
      this.weather.overrides.set(target, {
        zones: [
          { x0: 0, x1: 0.3, state: "serene" },
          { x0: 0.3, x1: 1, state: "after" },
        ],
        feather: 0.1,
        time: "day",
      });
    }
  }

  private transitionTick(): void {
    const tr = this.trans;
    const ready = !this.room.backdrop || this.room.backdrop.ready();
    if (this.loading) {
      if (ready || this.seconds > 12) this.loading = false;
      else return;
    }
    if (!tr) {
      this.fade = Math.max(0, this.fade - 1 / 30);
      return;
    }
    tr.t++;
    const out = 20;
    if (!tr.switched) {
      this.fade = Math.min(1, tr.t / out);
      if (tr.t >= out + 2) {
        tr.switched = true;
        if (tr.kind === "pit") {
          const b = this.player.body;
          b.x = this.lastSafe[0];
          b.y = this.lastSafe[1];
          b.vx = b.vy = 0;
          this.camera.snapTo(b.x, b.y, this.player.facing, this.room.collision.bounds());
        } else this.enter(tr.to.room, tr.to.spawn);
        tr.t = 0;
      }
    } else {
      // the next room's shaders may still be compiling: stay dark until they are (honest, no fake wait)
      if (!ready && tr.t < 60 * 8) {
        tr.t = 0;
        return;
      }
      this.fade = Math.max(0, 1 - tr.t / 24);
      if (tr.t >= 24) this.trans = null;
    }
  }

  simTick(): void {
    if (this.feel.hitstop > 0) {
      this.feel.hitstop--;
      return;
    }
    this.simTicks++;
    if (this.mode === "play") this.travel.tick();
    const room = this.room;
    const b = this.player.body;
    const pw = this.propWorld;
    const inside = !!this.room.def.weather.interior || !!room.def.underground || !!this.area?.roofed;
    pw.time = room.time;
    pw.tick = room.tick;
    pw.wind = inside ? 0 : this.weather.wind;
    pw.rain = inside ? 0 : this.weather.p.rain;
    pw.flash = this.weather.flash;
    pw.player.x = b.x;
    pw.player.y = b.y;
    pw.player.vx = b.vx;
    pw.player.vy = b.vy;
    pw.player.facing = this.player.facing;
    this.pushes.length = 0;
    const clip = this.player.clip;
    if (clip.hasTag("dash") || clip.hasTag("skill") || clip.hasTag("ult")) this.pushes.push({ x: b.x, y: b.y - SCALE.H / 2, r: SCALE.H * 2, s: 1 });
    room.update(pw);
    if (room.pixel) {
      // the player is the pixel world's actor: grass and reeds part round her, doors and the
      // keeper know she is near, moths lift as she hurries by (docs/props/ENGINE.md, "Actors")
      room.pixel.world.actors = [{ x: b.x, y: b.y, vx: b.vx * 60, h: SCALE.H, id: "player" }];
      room.pixel.step(pw.wind, inside ? 0 : this.weather.p.overcast * 0.5, this.pushes, this.simTicks);
      this.pixelEvents();
      this.save.setProps(room.pixel.saveData());
      room.syncCollision();
    }
    // a lift, hook or boat carries whoever stands on it
    const on = room.collision.standingOn;
    let carried: Prop | undefined;
    if (on && b.grounded) {
      const m = room.collision.oneWays.find((o) => o.id && o.id === on.id)?.mover ?? room.collision.solids.find((s) => s.id && s.id === on.id)?.mover;
      if (m) {
        b.y += m.dy;
        b.x += m.dx;
      }
      carried = on.id ? room.prop(on.id) : undefined;
    }
    const riding = !!carried?.holdsRider && !!carried.moving;
    // sitting: any move stands you up
    if (this.sitting && (this.input.isDown("left") || this.input.isDown("right") || this.input.isDown("jump"))) this.stand();
    if (this.sitting) this.sitTicks++;
    const frozen = this.mode !== "play" || this.panels.open || !!this.trans || this.resting > 0 || riding || !!this.sitting;
    if (this.resting > 0) this.resting--;
    this.inputMuted = frozen;
    const x0 = b.x;
    this.player.update(this.inputProxy, room.collision as unknown as LabWorld, []);
    if (Math.abs(b.x - x0) > 0.5 && this.mode === "play") this.moved = true;
    // wading: shallow water slows you to half the run speed
    this.wading = false;
    for (const w of room.def.water ?? []) {
      if (b.x >= w.x0 && b.x <= w.x1 && b.y >= w.y - 1) {
        this.wading = true;
        b.x = x0 + (b.x - x0) * (w.slow ?? 0.5);
        if (b.grounded) room.collision.lastSurface = "water";
        break;
      }
    }
    this.combat();
    this.vfx.update();
    this.input.tick++;
    // areas (the shelter, the storm alcove): their camera, sound and the travel log
    const area = this.findArea();
    if (area !== this.area) {
      this.area = area;
      this.lockedAt = null;
      this.camera.resetRail();
      if (area) {
        this.travel.mark("area", area.id);
        this.hooks.enter(room.def.id, area.id, this.api);
      }
      // the storm's sound cuts off (the Blade's break, the first time), or the place's own bed
      const cut = area?.audio?.cut;
      if (cut && !(cut.unless && this.save.get(cut.unless))) this.audio.cut(cut.silence, this.audioFor().bed);
      else this.audio.setBed(this.audioFor().bed);
    }
    this.camera.mode = this.cameraFor();
    this.triggers();
    this.destinations();
    // safety: the last solid ground, and pits
    const pitY = room.def.pitY ?? room.def.h + PHYSICS.pitMargin * SCALE.H;
    const inPit = b.y > pitY || !!room.def.pits?.some((q) => b.x >= q.x0 && b.x <= q.x1 && b.y > q.y);
    if (b.grounded && !inPit && !room.collision.standingOn?.id && !this.wading) this.lastSafe = [b.x, b.y];
    if (inPit && !this.trans) {
      if (room.def.waterline !== undefined) this.vfx.spawn("dust.land", { x: b.x, y: room.def.waterline, facing: 1 });
      this.audio.play("land", 0.6);
      this.go({ room: room.def.id, spawn: "" }, "pit");
    }
    // exits at the room's edges (each in its y band)
    for (const e of room.def.exits) {
      if (e.y0 !== undefined && b.y < e.y0) continue;
      if (e.y1 !== undefined && b.y > e.y1) continue;
      if ((e.side === "left" && b.x < -h(0.2)) || (e.side === "right" && b.x > room.def.w + h(0.2))) this.go(e.to, "edge");
    }
    // doors (and the ferry) that finished opening
    for (const p of room.props) {
      const o = p as Opener;
      if (!o.justOpened) continue;
      const t = room.def.doors?.[p.id];
      if (!t) continue;
      if ("panel" in t) this.openPanel(t.panel, t.arg);
      else {
        if (t.flag) this.save.set(t.flag, true);
        this.go(t, "door");
      }
    }
    // the terminal's honest interim: the seal holds, then it cools down and points at the website
    if (this.pendingCooldown && (this.pendingCooldown.t -= 1 / 60) <= 0) {
      const p = this.pendingCooldown.prop;
      this.pendingCooldown = null;
      if (p.state === "summoned") p.go("cooldown");
      this.openPanel("summoned");
    }
    if (this.arenaExit > 0) this.arenaExit -= 1 / 60;
    this.findNear();
  }

  private triggers(): void {
    const b = this.player.body;
    const list = this.room.def.triggers ?? [];
    list.forEach((t, i) => {
      const inside = b.x >= t.x0 && b.x <= t.x1 && (t.y0 === undefined || b.y >= t.y0) && (t.y1 === undefined || b.y <= t.y1);
      if (inside && !this.triggersIn.has(i)) {
        this.triggersIn.add(i);
        if (t.flag) this.save.set(t.flag, true);
        if (t.session) this.save.setSession(t.session, true);
        if (t.signal) this.signal(t.signal.target, t.signal.msg);
      } else if (!inside) this.triggersIn.delete(i);
    });
  }

  /** The travel log: the first time you stand within reach of each destination. */
  private destinations(): void {
    if (this.mode !== "play") return;
    const b = this.player.body;
    for (const pl of this.room.def.props) {
      const dest = pl.params?.["dest"] as Dest | undefined;
      if (!dest || this.travel.reached[dest] !== undefined) continue;
      // within reach: 1.5 H across, and anywhere from the floor up to a banner hung 4 H above you
      if (Math.abs(pl.x - b.x) <= SCALE.H * 1.5 && pl.y - b.y <= SCALE.H * 1 && b.y - pl.y <= SCALE.H * 4) this.travel.dest(dest);
    }
  }

  /** Pixel-matter events: sound, panels, states (the terminal's arena), shakes. */
  private pixelEvents(): void {
    const px = this.room.pixel;
    if (!px) return;
    for (const e of px.events()) {
      if (e.type === "sound") this.audio.play(String(e["id"]), Number(e["volume"] ?? 1), this.pan(Number(e["x"] ?? this.player.body.x)));
      else if (e.type === "panel") this.openPanel(String(e["panel"]), e["arg"] !== undefined ? String(e["arg"]) : undefined);
      else if (e.type === "shake") {
        if (!this.reduced) this.camera.shake(Number(e["amplitude"] ?? 2), Math.round(Number(e["duration"] ?? 0.4) * 60));
      } else if (e.type === "summon") this.openPanel("summon");
      else if (e.prop && ["door", "lever", "rest", "sit", "stand"].includes(e.type)) this.kitEvent(e.type, e.prop, e);
      else if (e.type === "state" && e.prop) {
        const from = String(e["from"] ?? "");
        const to = String(e["to"] ?? "");
        this.hooks.state(e.prop.id, from, to, this.api);
        if (e.prop.recipe.id === "bossTerminal") this.terminalState(e.prop, to);
      }
    }
  }

  /**
   * The pixel kit's host events drive the same mechanics as the runtime's own
   * props: a door that opens takes you where the room's doors table says (and
   * sets its flag), releasing a latch sets the placement's flag, a lever sets
   * its flag and signals its target, a shrine lantern rests you (its flag is
   * shrine:N), a bench sits you down.
   */
  private kitEvent(type: string, p: PxProp, e: Record<string, unknown>): void {
    const pl = this.room.def.props.find((q) => q.id === p.id);
    const params = pl?.params ?? {};
    const flag = params["flag"] as string | undefined;
    if (type === "door") {
      const action = String(e["action"] ?? "");
      if (action === "unlatch" && flag) this.save.set(flag, true);
      if (action === "enter") {
        const t = this.room.def.doors?.[p.id];
        if (t && "panel" in t) this.openPanel(t.panel, t.arg);
        else if (t) {
          if (t.flag) this.save.set(t.flag, true);
          this.go(t, "door");
        }
      }
    } else if (type === "lever") {
      if (flag && e["on"]) this.save.set(flag, true);
      const target = params["target"] as string | undefined;
      if (target) this.signal(target, (params["msg"] as string) ?? "call");
    } else if (type === "rest") this.rest(flag ?? `shrine:${params["n"] ?? 0}`);
    else if (type === "sit") {
      const b = this.player.body;
      b.x = p.x;
      this.sitting = { id: p.id, x: p.x, y: p.y };
      this.sitTicks = 0;
      this.camera.override = { cx: p.x + this.player.facing * SCALE.viewW * 0.12, bars: 0.07 };
      this.input.releaseAll();
    } else if (type === "stand") this.stand();
  }

  /**
   * The terminal's states drive the arena: woken, summoning and the held seal
   * bring the arena music in over 3 s; cooling down sends it back to the storm
   * over 6 s. The camera clamps to the arena floor while it summons and holds.
   */
  private terminalState(p: PxProp, to: string): void {
    const on = to === "woken" || to === "summoning" || to === "summoned";
    if (this.arena && !on) this.arenaExit = 6;
    this.arena = on;
    this.arenaClamp = to === "summoning" || to === "summoned";
    if (to === "summoned") this.pendingCooldown = { prop: p, t: 2.5 };
    if (to === "cooldown" || to === "dormant") {
      this.camera.setCloseup(false);
      this.endSummonView();
    }
    this.musicLevel(true);
  }
  /** The view is on the arena's seal ring while the terminal summons (see openPanel "summon"). */
  private summonView = false;
  private endSummonView(): void {
    if (!this.summonView) return;
    this.summonView = false;
    if (!this.sitting) this.camera.override = null;
  }
  private arenaClamp = false;
  private arenaExit = 0;

  private findNear(): void {
    const b = this.player.body;
    let best: { n: Near; d: number } | null = null;
    if (this.mode === "play" && !this.panels.open && !this.trans && !this.sitting) {
      for (const p of this.room.props) {
        const it = p.interaction();
        if (!it) continue;
        const d = Math.abs(p.x - b.x);
        const bb = p.bounds();
        const dy = b.y - Math.min(bb.y + bb.h, p.y);
        if (d <= it.radius && dy > -SCALE.H * 0.5 && dy < SCALE.H * 1.2 && (!best || d < best.d)) best = { n: { kind: "stub", prop: p, it }, d };
      }
      const px = this.room.pixel?.nearestUsable(b.x, b.y - SCALE.H * 0.5);
      if (px) {
        const [cx] = px.centre();
        const d = Math.abs(cx - b.x);
        if (!best || d < best.d) best = { n: { kind: "pixel", prop: px }, d };
      }
    }
    this.near = best ? best.n : null;
    this.touch.usable(!!this.near);
  }

  /** Player hits against props: each prop reacts once per clip play and hit group. */
  private combat(): void {
    const p = this.player;
    const hits = p.hitboxes();
    const b = p.body;
    const face = (p.facing >= 0 ? 1 : -1) as 1 | -1;
    const clip = p.clip;
    // the dash's wind reaches pixel matter once per dash
    if (clip.hasTag("dash") && this.room.pixel && !this.pixelGroups.has(`${clip.clip.id}/wind`)) {
      this.pixelGroups.add(`${clip.clip.id}/wind`);
      this.room.pixel.hit("wind", b.x, b.y, face);
    }
    if (!hits.length) {
      if (p.mode !== "action") {
        this.hitProps.clear();
        this.pixelGroups.clear();
      }
      return;
    }
    for (const { box, hb } of hits) {
      const group = `${clip.clip.id}/${hb.group ?? `f${clip.index}`}`;
      // pixel matter: the move's preset hit shape, once per hit group (Q and R once per clip)
      if (this.room.pixel) {
        const type: HitType = clip.hasTag("ult") ? "r" : clip.hasTag("skill") ? "q" : hb.heavy ? "heavy" : "slash";
        const key = type === "q" || type === "r" ? `${clip.clip.id}/${type}` : group;
        if (!this.pixelGroups.has(key)) {
          this.pixelGroups.add(key);
          if (this.room.pixel.hit(type, b.x, b.y, face)) {
            this.feel.freeze(Math.min(3, hb.hitstop));
            clip.hit = true;
          }
        }
      }
      let set = this.hitProps.get(group);
      if (!set) this.hitProps.set(group, (set = new Set()));
      for (const prop of this.room.props) {
        if (set.has(prop.id)) continue;
        const ov = overlap(box, prop.bounds() as WorldBox);
        if (!ov) continue;
        const hit: PropHit = { shape: "slash", box: ov, dir: [p.facing, 0], damage: hb.damage, heavy: !!hb.heavy, source: clip.clip.id };
        if (prop.hit(hit, this.propWorld)) {
          set.add(prop.id);
          this.vfx.spawn(hb.heavy ? "hit.heavy" : "hit.light", { x: ov.x + ov.w / 2, y: ov.y + ov.h / 2, facing: p.facing });
          if (prop.collision === "solid" || prop.recipe === "crate" || prop.recipe === "door") {
            this.feel.freeze(Math.min(3, hb.hitstop));
            clip.hit = true;
          }
        }
      }
    }
    // clip changed: forget old groups
    if (this.hitProps.size > 24) this.hitProps.clear();
    if (this.pixelGroups.size > 48) this.pixelGroups.clear();
  }

  private cue(id: string, v: number): void {
    if (id === "step") this.audio.step(this.wading ? "water" : this.audioFor().surface ?? this.room.collision.lastSurface, v);
    else this.audio.play(id, v);
  }

  // --- drawing ---------------------------------------------------------------------------

  private viewRect(): { x: number; y: number; w: number; h: number } {
    return { x: this.camera.x, y: this.camera.y, w: SCALE.viewW, h: SCALE.viewH };
  }

  /** The frame's effect lights; `strikes: false` leaves out the lightning (the player's own lights). */
  private lights(strikes = true): PointLight[] {
    const out: PointLight[] = [...this.vfx.pointLights()];
    const pl: PropLight[] = [];
    this.room.lights(pl, this.viewRect());
    for (const l of pl) out.push({ x: l.x, y: l.y, height: l.height, radius: l.radius, colour: l.colour, intensity: l.intensity });
    const seat = this.seatedFrame();
    const sa = seat?.frame.anchors?.["halo"];
    const halo = seat && sa ? ([seat.x + sa[0] * this.player.facing, seat.y + sa[1]] as [number, number]) : this.player.anchor("halo");
    if (halo && this.player.dead === 0) out.push({ x: halo[0], y: halo[1], height: 8, radius: SCALE.H * 0.35, colour: [1, 0.86, 0.5], intensity: 0.4 });
    // lightning: a strong light high above the strike (rims everything toward it)
    for (const s of this.weather.strikes) {
      if (!strikes || s.level <= 0 || this.weather.interior || this.room.def.underground) continue;
      out.push({ x: s.x, y: this.camera.y - SCALE.H * 2, height: SCALE.H * 3, radius: SCALE.viewW * 1.2, colour: [0.8, 0.84, 1], intensity: s.level * 1.1 });
    }
    return out;
  }

  /** Pixel-matter layers at this point of the draw order (flushes the world batch around them). */
  private drawPixel(layers: LayerName[], lights: PointLight[], o: { glows?: boolean; particles?: "solid" | "add" | "both" } = {}): void {
    const px = this.room.pixel;
    if (!px || px.empty) return;
    const r = this.r;
    r.flush();
    const lighting = this.weather.lighting(this.room.def.lighting);
    this.pixelDraw.draw(px.world, layers, { x: r.camX, y: r.camY }, lighting, lights, o);
  }

  private drawWorldSprites(reflection: boolean, lights: PointLight[] = []): void {
    const r = this.r;
    const room = this.room;
    const [cx] = this.camera.view();
    const reflects = (p: Prop): boolean => !reflection || !!room.def.props.find((pl) => pl.id === p.id)?.reflect;
    room.drawProps(this.canvasApi, "far", cx, reflects);
    room.drawProps(this.canvasApi, "back", cx, reflects);
    if (!reflection) this.drawPixel(["far", "bg"], lights);
    room.drawTerrain(r, false, reflection);
    if (!reflection) room.drawProps(this.canvasApi, "decal", cx);
    room.drawProps(this.canvasApi, "middle", cx, reflects);
    if (!reflection) this.drawPixel(["mid", "decal"], lights, { particles: "solid" });
    if (!reflection) {
      this.vfx.draw(r as unknown as LabRenderer, "back");
      this.vfx.drawAfterimages(r as unknown as LabRenderer);
    }
    if (this.camera.closeup < 0.02 || reflection) this.drawPlayer();
    if (!reflection) {
      if (this.camera.closeup < 0.02) this.vfx.draw(r as unknown as LabRenderer, "front");
      room.drawProps(this.canvasApi, "front", cx);
      this.drawPixel(["fg"], lights);
      room.drawTerrain(r, true);
      room.drawProps(this.canvasApi, "light", cx);
      this.drawPixel(["light"], lights, { glows: true, particles: "add" });
      this.ambient.draw(r, this.weather.flash);
    }
  }

  /**
   * The player under her own light: the room's, without the lightning (a
   * strike lights the world around her, never a white-out of her), then the
   * frame's light again for whatever is drawn after her.
   */
  private drawPlayer(): void {
    const r = this.r;
    const f = this.frameLight;
    if (f) r.relight(f.subject, f.subjectLights);
    this.player.draw(r as unknown as LabRenderer);
    if (f) r.relight(f.lighting, f.lights);
  }
  private readonly worldSprite: PlayerAssets["sprite"];

  /** The sit clip's current frame and where it stands, or null (not sitting, or a sprite with no sit clip: she stands as before). */
  private seatedFrame(): { frame: Frame; sheet: SpriteSheet; x: number; y: number } | null {
    const s = this.sitting;
    const clip = s ? this.worldSprite.clips.get("sit") : undefined;
    const sheet = clip ? this.worldSprite.sheets.get(clip.atlas) : undefined;
    if (!s || !clip || !sheet || !clip.frames.length) return null;
    const frame = loopFrameAt(clip.frames, this.sitTicks);
    return { frame, sheet, x: s.x, y: s.y };
  }

  /** The seated drawing, in the shape of the lab Player's spriteDraw (feet on the floor under the seat). */
  private seatedDraw(): ReturnType<Player["spriteDraw"]> | null {
    const f = this.seatedFrame();
    if (!f) return null;
    const [sx, sy, sw, sh] = f.frame.rect;
    const [px, py] = f.frame.pivot;
    const face = this.player.facing;
    const x = face > 0 ? f.x - px : f.x - (sw - px);
    return { sheet: f.sheet, sx, sy, sw, sh, x: Math.round(x), y: Math.round(f.y - py), flip: face < 0 };
  }

  private frameLight: { lighting: ReturnType<Weather["lighting"]>; lights: PointLight[]; subject: ReturnType<Weather["lighting"]>; subjectLights: PointLight[] } | null = null;

  render(): void {
    const r = this.r;
    const room = this.room;
    const bd = room.backdrop;
    const [cx, cy] = this.camera.view();
    const lighting = this.weather.lighting(room.def.lighting);
    const lights = this.lights();
    const subject = this.weather.lighting(room.def.lighting, true);
    const subjectLights = this.lights(false);
    this.frameLight = { lighting, lights, subject, subjectLights };
    const horizon = Math.round(SCALE.viewH * 0.7);
    if (bd) {
      bd.reduced = this.reduced;
      bd.setCamera(cx, cy);
      bd.setWeather(this.weather.uniforms(cx, horizon), this.weather.interior || room.def.underground ? [] : this.weather.flashLights(cx));
      // reflection pass
      const wl = room.def.waterline;
      bd.renderReflection(
        wl === undefined
          ? undefined
          : () => {
              r.bindTarget(bd.refl, false);
              r.begin(cx, cy, lighting, lights);
              r.setTransform(1, [0, 0], wl - cy);
              this.drawWorldSprites(true);
              r.flush();
              r.setTransform(1, [0, 0], null);
            },
      );
    }
    // main pass
    r.bindTarget(r.main, true);
    if (bd) bd.render(r.main, "back");
    r.begin(cx, cy, lighting, lights);
    this.drawWorldSprites(false, lights);
    this.ambientUpdate();
    r.flush();
    if (bd) bd.render(r.main, "front");
    r.begin(cx, cy, lighting, lights);
    if (!this.sitting) {
      this.drawPrompt();
      this.drawHud();
    }
    if (this.debug) this.drawDebug();
    r.flush();
    // close-up overlay
    const Z = this.camera.closeupZoom;
    const b = this.player.body;
    const focus: [number, number] = [b.x - cx, b.y - SCALE.H * 0.55 - cy];
    const closeup = this.camera.closeup >= 0.02;
    if (closeup) {
      r.bindTarget(r.over, true, [0, 0, 0, 0]);
      r.begin(cx, cy, subject, subjectLights);
      r.setTransform(Z, focus, null);
      this.drawCloseupPlayer(Z);
      this.vfx.draw(r as unknown as LabRenderer, "back");
      this.vfx.draw(r as unknown as LabRenderer, "front");
      r.flush();
      r.setTransform(1, [0, 0], null);
    }
    const punch = this.camera.zoomSteps > 0 ? 1 + this.camera.zoomSteps / Math.max(1, Math.round(r.presenter.rect.scale)) : 1;
    r.present({
      impact: this.feel.impact,
      zoom: closeup ? Z : punch,
      focus,
      fade: [0.02, 0.02, 0.035, Math.max(this.fade, this.player.fade)],
      bars: this.camera.bars,
      overlay: closeup,
    });
  }

  private ambientUpdate(): void {
    // ambient simulation piggybacks on the frame (it is purely visual)
    const pl: PropLight[] = [];
    this.room.lights(pl, this.viewRect());
    const [cx, cy] = this.camera.view();
    const outside = !this.weather.interior && !this.room.def.underground && !this.area?.roofed;
    this.ambient.update(pl, this.weather.wind, outside ? this.weather.p.rain : 0, outside, cx, cy, this.room.collision, this.reduced);
  }

  /** The player from the 144 px bake, same clip and frame, at the zoomed position. */
  private drawCloseupPlayer(Z: number): void {
    const p = this.player;
    const s = this.closeupSprite;
    const clip = s.clips.get(p.clip.clip.id);
    const f = clip?.frames[p.clip.index];
    const sheet = clip ? s.sheets.get(clip.atlas) : undefined;
    if (!f || !sheet) return;
    const r = this.r;
    const [sx, sy, sw, sh] = f.rect;
    const [px, py] = f.pivot;
    // the zoom keeps the focus (her middle) in place, so her feet land 0.55 H * Z below it;
    // the close-up sprite is drawn 1:1 there, at native pixel size
    const fx = Math.round(p.body.x - r.camX);
    const fy = Math.round(p.body.y - r.camY - SCALE.H * 0.55 + SCALE.H * 0.55 * Z);
    const x = p.facing > 0 ? fx - px : fx - (sw - px);
    r.sprite({ sheet, sx, sy, sw, sh, x, y: fy - py, flip: p.facing < 0, screen: true, lit: 1 });
  }

  /** A small key glyph over the thing you can use. */
  private drawPrompt(): void {
    const n = this.near;
    if (!n || this.mode !== "play") return;
    const r = this.r;
    let x: number;
    let top: number;
    if (n.kind === "stub") {
      const bb = n.prop.bounds();
      x = Math.round(n.prop.x);
      top = bb.y;
    } else {
      const bb = n.prop.bounds();
      x = Math.round((bb.x0 + bb.x1) / 2);
      top = bb.y0;
    }
    const bob = this.reduced ? 0 : Math.round(Math.sin(this.realTicks * 0.08));
    const y = Math.round(Math.min(top, this.player.body.y - SCALE.H) - 14 + bob);
    const ink: RGB = [0.05, 0.05, 0.07];
    const cap: RGB = [0.86, 0.82, 0.72];
    r.rect(x - 6, y - 6, 13, 13, ink, 1, 0.85);
    r.rect(x - 5, y - 5, 11, 11, cap, 1, 0.9);
    r.rect(x - 5, y + 4, 11, 1, [0.6, 0.56, 0.48], 1, 0.9);
    // "E" (or a dot on touch)
    if (this.touch.shown) r.rect(x - 1, y - 1, 3, 3, ink);
    else {
      r.rect(x - 2, y - 3, 1, 6, ink);
      r.rect(x - 2, y - 3, 4, 1, ink);
      r.rect(x - 2, y, 3, 1, ink);
      r.rect(x - 2, y + 2, 4, 1, ink);
    }
  }

  private drawHud(): void {
    const r = this.r;
    const p = this.player;
    const show = p.hp < p.t.hp || p.skillCd > 0 || p.ultCd > 0;
    if (!show) return;
    const y = Math.round(SCALE.viewH * this.camera.bars) + 12;
    const diamond = (x: number, yy: number, s: number, c: RGB, opacity = 1): void =>
      r.vfx({ type: VFX_TYPE.diamond, t: 0, seed: 0, over: 1, p0: [s, s, 0, 0], p1: [opacity, 0, 0, 0], core: c, main: c, edge: c, x, y: yy, rot: 0, sx: 1, sy: 1, ext: [-s - 1, -s - 1, s + 1, s + 1], screen: true });
    for (let i = 0; i < p.t.hp; i++) diamond(14 + i * 11, y, 4, i < p.hp ? [0.96, 0.8, 0.42] : [0.22, 0.22, 0.3], 0.9);
    const pip = (x: number, cd: number, max: number): void => {
      const ready = cd <= 0;
      diamond(x, y, 4.5, ready ? [0.98, 0.86, 0.5] : [0.2, 0.2, 0.28], 0.9);
      if (!ready) r.rect(x - 5, y + 8, Math.round(11 * (1 - cd / max)), 1, [0.6, 0.55, 0.45], 1, 0.9, true);
    };
    pip(SCALE.viewW - 34, p.skillCd, p.t.skillCooldown);
    pip(SCALE.viewW - 16, p.ultCd, p.t.ultCooldown);
  }

  private drawDebug(): void {
    const r = this.r;
    const c = this.room.collision;
    for (const s of c.solids) r.box(s.x, s.y, s.w, Math.max(1, Math.min(s.h, SCALE.viewH)), s.mover ? [1, 0.6, 0.2] : [0.3, 0.8, 1]);
    for (const o of c.oneWays) r.rect(o.x, o.y, o.w, 1, [0.4, 1, 0.5]);
    for (const p of this.room.props) {
      const b = p.bounds();
      r.box(b.x, b.y, b.w, b.h, p.interaction() ? [1, 0.9, 0.3] : [0.55, 0.5, 0.7]);
    }
    for (const w of this.room.def.water ?? []) r.rect(w.x0, w.y, w.x1 - w.x0, 1, [0.3, 0.6, 1]);
    for (const a of this.room.def.areas ?? []) r.box(a.x0, a.y0 ?? this.camera.y + 4, a.x1 - a.x0, (a.y1 ?? this.camera.y + SCALE.viewH - 4) - (a.y0 ?? this.camera.y + 4), [1, 0.5, 0.2]);
    for (const z of this.camera.zones) r.rect(z.x0, this.camera.y + 2, z.x1 - z.x0, 1, z.hold ? [0.6, 0.9, 1] : [1, 0.4, 0.8]);
    for (const hbx of this.player.hurtboxes()) r.box(hbx.x, hbx.y, hbx.w, hbx.h, [0.3, 1, 0.55]);
    for (const { box } of this.player.hitboxes()) r.box(box.x, box.y, box.w, box.h, [1, 0.2, 0.25]);
    const b = this.player.body;
    // the locked scale, measured on screen: a 1 H bar next to the player
    r.rect(b.x + h(0.5), b.y - SCALE.H, 1, SCALE.H, [1, 0.3, 0.3]);
    r.rect(b.x + h(0.5) - 2, b.y - SCALE.H, 5, 1, [1, 0.3, 0.3]);
    r.rect(b.x + h(0.5) - 2, b.y - 1, 5, 1, [1, 0.3, 0.3]);
  }

  debugText(): string {
    const p = this.player;
    const b = p.body;
    const w = this.weather;
    const pr = this.r.presenter.rect;
    const bd = this.room.backdrop;
    const d = this.room.def;
    const src = this.opts.source?.get(d.id) ?? "";
    const a = this.audio.state;
    return [
      `fps ${this.fps.toFixed(0)}  frame ${this.frameMs.toFixed(2)} ms  draws ${this.r.drawCalls}+${bd?.stats.draws ?? 0}  points ${bd?.stats.points ?? 0}`,
      `view ${SCALE.viewW}x${SCALE.viewH} @${pr.scale.toFixed(3)}x ${pr.sharp ? "sharp-bilinear" : "nearest"}  H ${SCALE.H} close-up ${SCALE.closeupH} (stand-in bbox incl. halo+glaive ${this.heights.world}/${this.heights.closeup})`,
      `room ${d.id} (${src}) ${d.w}x${d.h} (${(d.w / SCALE.H).toFixed(1)}x${(d.h / SCALE.H).toFixed(1)} H)${this.area ? `  area ${this.area.id}` : ""}  build ${this.room.buildMs} ms (backdrop ${bd?.buildMs ?? 0})  live: ${this.stream.status()}`,
      `pos ${b.x.toFixed(0)}, ${b.y.toFixed(0)} (${(b.x / SCALE.H).toFixed(2)}, ${(b.y / SCALE.H).toFixed(2)} H)${d.origin ? ` world ${(d.origin[0] + b.x / SCALE.H).toFixed(1)}, ${(d.origin[1] - b.y / SCALE.H).toFixed(1)} H` : ""}  ${b.grounded ? "ground" : "air"} on ${this.room.collision.lastSurface}${this.wading ? " (wading)" : ""}${this.sitting ? " (sitting)" : ""}  clip ${p.clip.clip.id}`,
      `camera ${this.camera.mode.mode} anchor ${this.camera.anchor.toFixed(2)}  ${this.camera.x.toFixed(0)}, ${this.camera.y.toFixed(0)}  zone ${this.camera.zoneWeight.toFixed(2)} still ${this.stillFor.toFixed(1)}  bars ${this.camera.bars.toFixed(3)}  close-up ${this.camera.closeup.toFixed(2)}${this.camera.arenaActive ? "  arena" : ""}`,
      `weather ${d.underground ? "underground/" : w.interior ? "inside/" : ""}${w.label}  rain ${w.p.rain.toFixed(2)} wind ${w.wind.toFixed(2)} mist ${w.p.mist.toFixed(2)} dark ${w.p.dark.toFixed(2)} flash ${w.flash.toFixed(2)} strikes ${w.strikes.length}${this.stormPassed ? "  (storm passed)" : ""}`,
      `sound ${this.audio.started ? (this.audio.muted ? "muted" : "on") : "not started"}  music ${a.music} ${a.level.toFixed(2)} muffle ${a.muffle.toFixed(2)}${a.resting ? " resting" : ""}  bed ${a.bed}  ducks ${[...this.ducks].map(([k, v]) => `${k} ${v}`).join(",") || "-"}`,
      `near ${this.near ? (this.near.kind === "stub" ? `${this.near.prop.recipe}#${this.near.prop.id}` : `px:${this.near.prop.recipe.id}#${this.near.prop.id}`) : "-"}  props ${this.room.props.length}+${this.room.pixel?.props.length ?? 0}px  lights ${this.r.lightCount}  vfx ${this.vfx.counts.effects}/${this.vfx.counts.particles}`,
      `save ${Object.keys(this.save.data.flags).filter((k) => this.save.data.flags[k]).join(", ") || "-"}  rest ${this.save.data.rest ? `${this.save.data.rest.room}/${this.save.data.rest.spawn}` : "-"}`,
      this.travel.summary(),
    ].join("\n");
  }

  /** Test hook: plain state for automation. */
  state(): Record<string, unknown> {
    const b = this.player.body;
    return {
      mode: this.mode,
      room: this.room.def.id,
      area: this.area?.id ?? null,
      source: this.opts.source?.get(this.room.def.id) ?? null,
      x: b.x,
      y: b.y,
      vx: b.vx,
      vy: b.vy,
      grounded: b.grounded,
      facing: this.player.facing,
      clip: this.player.clip.clip.id,
      hp: this.player.hp,
      camera: [this.camera.x, this.camera.y],
      cameraMode: this.camera.mode.mode,
      anchor: this.camera.anchor,
      bars: this.camera.bars,
      closeup: this.camera.closeup,
      weather: { label: this.weather.label, interior: this.weather.interior, underground: !!this.room.def.underground, ...this.weather.p, wind: this.weather.wind, flash: this.weather.flash },
      near: this.near ? this.near.prop.id : null,
      panel: this.panels.kind,
      transition: !!this.trans,
      fade: this.fade,
      present: this.r.presenter.rect,
      heights: this.heights,
      live: this.stream.status(),
      save: this.save.data,
      session: this.save.session,
      fps: this.fps,
      frameMs: this.frameMs,
      sim: this.simTicks,
      audio: { ...this.audio.state, ducks: Object.fromEntries(this.ducks) },
      stormPassed: this.stormPassed,
      sitting: !!this.sitting,
      wading: this.wading,
      away: this.away,
      arena: this.arena,
      travel: { t: +this.travel.t.toFixed(2), reached: this.travel.reached, events: this.travel.events },
      pixel: this.room.pixel ? this.room.pixel.props.map((p) => ({ id: p.id, recipe: p.recipe.id, state: p.state })) : [],
      hooks: this.hooks.ids,
    };
  }

  /** Test hook: put the player at room x (on the ground there), snap the camera and the weather. */
  place(x: number, y?: number): Record<string, unknown> {
    const b = this.player.body;
    b.x = x;
    b.y = y ?? this.room.collision.groundAt(x, 0);
    b.vx = b.vy = 0;
    this.area = this.findArea();
    this.lockedAt = null;
    this.camera.resetRail();
    this.camera.mode = this.cameraFor();
    this.camera.snapTo(b.x, b.y, this.player.facing, this.room.collision.bounds());
    this.weather.snap(this.program(), b.x / this.room.def.w);
    return this.state();
  }

  /** Test hook: jump straight to a room and spawn (no fade). */
  teleport(room: string, spawn: string): void {
    this.enter(room, spawn);
  }

  /** Room ids known to this world. */
  roomIds(): string[] {
    return [...this.defs.keys()];
  }

  /** Room data (tests and tools read geometry for the reach checks). */
  roomDef(id: string): RoomDef | undefined {
    return this.defs.get(id);
  }
}

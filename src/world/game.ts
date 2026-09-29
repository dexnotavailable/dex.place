// The world runtime: one loop that ties together the room system (streamed
// rooms with scene-engine backdrops, terrain, pixel-matter props, doors,
// lifts, exits), the lab's player (controller, moves, VFX, rim lighting,
// runtime contract) at the locked scale, the world camera, weather and time,
// ambient life, sound, interaction and panels, the save, and the presenter.
//
// Timing is the lab's: 60 Hz real ticks (camera, shake, slow-mo, fades) feed
// a simulation accumulator; hitstop freezes simulation ticks only.
//
// Draw order per frame:
//   reflection: backdrop layers mirrored + the world's reflecting sprites
//               (terrain, props, the player) mirrored about the waterline
//   main:       backdrop back pass -> far/back props, terrain, decals ->
//               middle props -> effects (back) -> player -> effects (front) ->
//               front props and terrain -> light layer -> ambient ->
//               backdrop front pass (foreground, near rain) -> prompt, HUD
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
import type { World as LabWorld } from "../lab/game/world.ts";
import { FlashGate } from "../scenes/engine/flashes.ts";
import { Ambient } from "./ambient.ts";
import { WorldAudio } from "./audio.ts";
import { h, PHYSICS, SCALE, STREAM } from "./config.ts";
import type { PlayerAssets } from "./player/setup.ts";
import type { CellTexture, Interaction, Prop, PropCanvas, PropHit, PropLight, PropWorld } from "./props-api.ts";
import { WorldRenderer, VFX_TYPE, type PointLight, type RGB } from "./render/renderer.ts";
import { WorldCamera } from "./room/camera.ts";
import { Room, RoomStream } from "./room/room.ts";
import type { RoomDef, Spawn } from "./room/types.ts";
import { Save } from "./save.ts";
import type { StubTexture } from "./props/stub.ts";
import type { Touch } from "./touch.ts";
import { Panels, type PanelKind } from "./ui.ts";
import { Weather, type WeatherProgram } from "./weather.ts";
import type { PixelMatterEngine } from "./props-api.ts";
import { Door } from "./props/recipes.ts";

const TICK = 1000 / 60;

type Mode = "intro" | "play" | "transition";

export interface GameOpts {
  rooms: RoomDef[];
  start: { room: string; spawn: string };
  engine: PixelMatterEngine;
}

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
  private near: { prop: Prop; it: Interaction } | null = null;
  private pushes: PropWorld["pushes"] = [];
  private hitProps = new Map<string, Set<string>>();
  private insideFor = 0;
  private stormPassed = false;
  private audioTick = 0;
  private services: Services;
  private propWorld: PropWorld;
  private canvasApi: PropCanvas;
  private defs: Map<string, RoomDef>;
  private resting = 0;
  /** For the scale report: measured player height at each size. */
  heights: PlayerAssets["heights"];
  private inputProxy: Input;

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
    this.weather.onThunder = (s) => this.audio.thunder(s, this.room.def.audio.weatherThrough ?? 1);
    this.panels = new Panels(r.canvas);
    this.panels.onClose = (k) => this.panelClosed(k);
    this.stream = new RoomStream(this.defs, { r, gate: () => this.gate.allow(this.seconds, this.reduced), engine: opts.engine, flag: (k) => this.save.get(k) }, STREAM.keepDepth);

    // the lab's player, fed a proxy input: "down" only means drop-through on a one-way platform
    const col = (): Room["collision"] => this.room.collision;
    this.inputProxy = new Proxy(input, {
      get: (t, k, rcv) => {
        if (k === "isDown") return (a: Action) => (a === "down" ? t.isDown("down") && col().onOneWay(this.player.body) : t.isDown(a));
        const v = Reflect.get(t, k, rcv) as unknown;
        return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(t) : v;
      },
    });
    this.player = new Player(assets.sprite, assets.tuning.player, this.services, [0, 0]);

    this.propWorld = {
      time: 0,
      tick: 0,
      reduced: this.reduced,
      wind: 0,
      rain: 0,
      flash: 0,
      player: { x: 0, y: 0, vx: 0, vy: 0, facing: 1, h: SCALE.H },
      sound: (id, v = 1, at) => this.audio.play(id, v, at ? Math.max(-1, Math.min(1, (at[0] - (this.camera.x + SCALE.viewW / 2)) / (SCALE.viewW / 2))) : 0),
      save: { get: (k) => this.save.get(k), set: (k, v) => this.save.set(k, v) },
      openPanel: (k, a) => this.openPanel(k, a),
      vfx: (id, x, y, facing = 1) => this.vfx.spawn(id, { x, y, facing }),
      pushes: this.pushes,
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
    const start = this.save.data.rest ?? opts.start;
    this.enter(start.room, start.spawn, true);
  }

  // --- rooms -------------------------------------------------------------------------

  private program(): WeatherProgram {
    return this.weather.overrides.get(this.room.def.id) ?? this.room.def.weather;
  }

  private enter(roomId: string, spawnId: string, first = false): void {
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
    for (const p of room.props) if (p instanceof Door) p.close();
    this.camera.zones = d.zones ?? [];
    this.camera.snapTo(b.x, b.y, sp.facing, room.collision.bounds());
    this.ambient.reset(d.ambient, d.w, d.h);
    const u = b.x / d.w;
    if (first || !d.weather.interior) this.weather.snap(this.program(), u);
    else this.weather.interior = true;
    if (!first) this.roomAudio(true);
    this.hitProps.clear();
  }

  private roomAudio(entering: boolean): void {
    const a = this.room.def.audio;
    if (entering) this.audio.setBed(a.bed);
    this.musicLevel(true);
  }

  private musicLevel(force = false): void {
    const a = this.room.def.audio;
    if (!this.audio.started) return;
    const x = this.player.body.x;
    let level = a.music === "arena" ? 0.8 : 0.72;
    level *= 1 - this.weather.p.rain * 0.45 * (a.weatherThrough ?? 1);
    if (this.room.def.weather.interior) level *= 0.75;
    if (a.silence?.some(([x0, x1]) => x >= x0 && x <= x1)) level = 0;
    if (this.panels.open && this.panels.kind !== "map") level *= 0.5;
    if (a.music) this.audio.setMusic(a.music, level);
    else if (force) this.audio.setMusic("none", 0);
    this.audio.setWeather(this.weather.p.rain, this.weather.wind, a.weatherThrough ?? 1);
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
    this.audio.start(!this.save.data.sound);
    this.roomAudio(true);
  }

  setSound(on: boolean): void {
    this.save.setSound(on);
    this.audio.setMuted(!on);
  }

  // --- panels --------------------------------------------------------------------------

  private openPanel(kind: string, arg?: string): void {
    if (kind === "rest") {
      this.rest(arg ?? "");
      return;
    }
    if (kind === "summon") {
      // the combat zoom hook: the close-up render path takes over while the terminal calls
      this.camera.setCloseup(true);
      this.camera.shake(2, 30);
      return;
    }
    if (kind === "summoned") {
      this.camera.setCloseup(false);
      this.panels.show("summoned");
      return;
    }
    if (kind === "map") this.panels.mapInfo = { rooms: this.opts.rooms.map((r) => ({ id: r.id, label: r.id })), here: this.room.def.id };
    this.panels.show(kind as PanelKind, arg);
    this.input.releaseAll();
  }

  private panelClosed(k: PanelKind): void {
    // an ordinary door that opened onto a panel closes again behind you
    for (const p of this.room.props) if (p instanceof Door && p.state === "open") p.close();
    void k;
  }

  private rest(id: string): void {
    const p = this.player;
    p.hp = p.t.hp;
    p.checkpoint = [p.body.x, p.body.y];
    const spawn = Object.entries(this.room.def.spawns).sort((a, b) => Math.abs(a[1].x - p.body.x) - Math.abs(b[1].x - p.body.x))[0]?.[0] ?? "";
    this.save.setRest(this.room.def.id, spawn);
    this.resting = 180;
    this.vfx.spawn("ring.halo", { x: p.body.x, y: p.body.y - 4, facing: 1, scale: 1.2 });
    this.audio.play("chime", 0.5);
    void id;
  }

  // --- input ---------------------------------------------------------------------------

  use(): void {
    if (this.mode === "intro") {
      this.begin();
      return;
    }
    if (this.mode !== "play" || this.panels.open || !this.near) return;
    this.near.it.use(this.propWorld);
  }

  // --- time ------------------------------------------------------------------------------

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
    this.camera.update(b.x, b.y, this.player.facing, this.room.collision.bounds(), Math.abs(b.vx) > 0.5);
    this.touch.cooldowns(this.player.skillCd <= 0, this.player.ultCd <= 0);
    if (++this.audioTick % 12 === 0) this.musicLevel();
    this.storyTick();
  }

  /** The storm passes while you're indoors (after a while inside, the plain clears). */
  private storyTick(): void {
    if (this.stormPassed) return;
    if (this.room.def.weather.interior && this.weather.p.lightning > 2) this.insideFor += 1 / 60;
    if (this.insideFor > 40) {
      this.stormPassed = true;
      this.weather.overrides.set("plain", {
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
    const room = this.room;
    const b = this.player.body;
    const pw = this.propWorld;
    pw.time = room.time;
    pw.tick = room.tick;
    pw.wind = this.weather.interior ? 0 : this.weather.wind;
    pw.rain = this.weather.interior ? 0 : this.weather.p.rain;
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
    // a lift carries whoever stands on it
    const on = room.collision.standingOn;
    if (on && b.grounded) {
      const m = room.collision.oneWays.find((o) => o.id && o.id === on.id)?.mover ?? room.collision.solids.find((s) => s.id && s.id === on.id)?.mover;
      if (m) {
        b.y += m.dy;
        b.x += m.dx;
      }
    }
    const frozen = this.mode !== "play" || this.panels.open || !!this.trans || this.resting > 0;
    if (this.resting > 0) this.resting--;
    if (frozen) this.input.releaseAll();
    this.player.update(this.inputProxy, room.collision as unknown as LabWorld, []);
    this.combat();
    this.vfx.update();
    this.input.tick++;
    // safety: the last solid ground, and pits
    if (b.grounded && !room.collision.standingOn?.id) this.lastSafe = [b.x, b.y];
    const pitY = room.def.pitY ?? room.def.h + PHYSICS.pitMargin * SCALE.H;
    if (b.y > pitY && !this.trans) {
      if (room.def.waterline !== undefined) this.vfx.spawn("dust.land", { x: b.x, y: room.def.waterline, facing: 1 });
      this.audio.play("land", 0.6);
      this.go({ room: room.def.id, spawn: "" }, "pit");
    }
    // exits at the room's edges
    for (const e of room.def.exits) {
      if ((e.side === "left" && b.x < -h(0.2)) || (e.side === "right" && b.x > room.def.w + h(0.2))) this.go(e.to, "edge");
    }
    // doors that finished opening
    for (const p of room.props) {
      if (!(p instanceof Door) || !p.justOpened) continue;
      const t = room.def.doors?.[p.id];
      if (!t) continue;
      if ("panel" in t) this.openPanel(t.panel);
      else this.go(t, "door");
    }
    this.findNear();
  }

  private findNear(): void {
    const b = this.player.body;
    let best: { prop: Prop; it: Interaction; d: number } | null = null;
    if (this.mode === "play" && !this.panels.open && !this.trans) {
      for (const p of this.room.props) {
        const it = p.interaction();
        if (!it) continue;
        const d = Math.abs(p.x - b.x);
        const bb = p.bounds();
        const dy = b.y - Math.min(bb.y + bb.h, p.y);
        if (d <= it.radius && dy > -SCALE.H * 0.5 && dy < SCALE.H * 1.2 && (!best || d < best.d)) best = { prop: p, it, d };
      }
    }
    this.near = best ? { prop: best.prop, it: best.it } : null;
    this.touch.usable(!!this.near);
  }

  /** Player hits against props: each prop reacts once per clip play and hit group. */
  private combat(): void {
    const p = this.player;
    const hits = p.hitboxes();
    if (!hits.length) {
      if (p.mode !== "action") this.hitProps.clear();
      return;
    }
    const key = `${p.clip.clip.id}:${this.simTicks - p.clip.tick}`;
    void key;
    for (const { box, hb } of hits) {
      const group = `${p.clip.clip.id}/${hb.group ?? `f${p.clip.index}`}`;
      let set = this.hitProps.get(group);
      if (!set) this.hitProps.set(group, (set = new Set()));
      for (const prop of this.room.props) {
        if (set.has(prop.id)) continue;
        const ov = overlap(box, prop.bounds() as WorldBox);
        if (!ov) continue;
        const hit: PropHit = { shape: "slash", box: ov, dir: [p.facing, 0], damage: hb.damage, heavy: !!hb.heavy, source: p.clip.clip.id };
        if (prop.hit(hit, this.propWorld)) {
          set.add(prop.id);
          this.vfx.spawn(hb.heavy ? "hit.heavy" : "hit.light", { x: ov.x + ov.w / 2, y: ov.y + ov.h / 2, facing: p.facing });
          if (prop.collision === "solid" || prop.recipe === "crate" || prop.recipe === "door") {
            this.feel.freeze(Math.min(3, hb.hitstop));
            p.clip.hit = true;
          }
        }
      }
    }
    // clip changed: forget old groups
    if (this.hitProps.size > 24) this.hitProps.clear();
  }

  private cue(id: string, v: number): void {
    if (id === "step") this.audio.step(this.room.collision.lastSurface, v);
    else this.audio.play(id, v);
  }

  // --- drawing ---------------------------------------------------------------------------

  private lights(): PointLight[] {
    const out: PointLight[] = [...this.vfx.pointLights()];
    const pl: PropLight[] = [];
    this.room.lights(pl);
    for (const l of pl) out.push({ x: l.x, y: l.y, height: l.height, radius: l.radius, colour: l.colour, intensity: l.intensity });
    const halo = this.player.anchor("halo");
    if (halo && this.player.dead === 0) out.push({ x: halo[0], y: halo[1], height: 8, radius: SCALE.H * 0.35, colour: [1, 0.86, 0.5], intensity: 0.4 });
    // lightning: a strong light high above the strike (rims everything toward it)
    for (const s of this.weather.strikes) {
      if (s.level <= 0 || this.weather.interior) continue;
      out.push({ x: s.x, y: this.camera.y - SCALE.H * 2, height: SCALE.H * 3, radius: SCALE.viewW * 1.2, colour: [0.8, 0.84, 1], intensity: s.level * 1.1 });
    }
    return out;
  }

  private drawWorldSprites(reflection: boolean): void {
    const r = this.r;
    const room = this.room;
    const [cx] = this.camera.view();
    const reflects = (p: Prop): boolean => !reflection || !!room.def.props.find((pl) => pl.id === p.id)?.reflect;
    room.drawProps(this.canvasApi, "far", cx, reflects);
    room.drawProps(this.canvasApi, "back", cx, reflects);
    room.drawTerrain(r, false, reflection);
    if (!reflection) room.drawProps(this.canvasApi, "decal", cx);
    room.drawProps(this.canvasApi, "middle", cx, reflects);
    if (!reflection) {
      this.vfx.draw(r as unknown as LabRenderer, "back");
      this.vfx.drawAfterimages(r as unknown as LabRenderer);
    }
    if (this.camera.closeup < 0.02 || reflection) this.player.draw(r as unknown as LabRenderer);
    if (!reflection) {
      if (this.camera.closeup < 0.02) this.vfx.draw(r as unknown as LabRenderer, "front");
      room.drawProps(this.canvasApi, "front", cx);
      room.drawTerrain(r, true);
      room.drawProps(this.canvasApi, "light", cx);
      this.ambient.draw(r, this.weather.flash);
    }
  }

  render(): void {
    const r = this.r;
    const room = this.room;
    const bd = room.backdrop;
    const [cx, cy] = this.camera.view();
    const lighting = this.weather.lighting(room.def.lighting);
    const lights = this.lights();
    const horizon = Math.round(SCALE.viewH * 0.7);
    if (bd) {
      bd.reduced = this.reduced;
      bd.setCamera(cx, cy);
      bd.setWeather(this.weather.uniforms(cx, horizon), this.weather.interior ? [] : this.weather.flashLights(cx));
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
    this.drawWorldSprites(false);
    this.ambientUpdate();
    r.flush();
    if (bd) bd.render(r.main, "front");
    r.begin(cx, cy, lighting, lights);
    this.drawPrompt();
    this.drawHud();
    if (this.debug) this.drawDebug();
    r.flush();
    // close-up overlay
    const Z = this.camera.closeupZoom;
    const b = this.player.body;
    const focus: [number, number] = [b.x - cx, b.y - SCALE.H * 0.55 - cy];
    const closeup = this.camera.closeup >= 0.02;
    if (closeup) {
      r.bindTarget(r.over, true, [0, 0, 0, 0]);
      r.begin(cx, cy, lighting, lights);
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
    this.room.lights(pl);
    const [cx, cy] = this.camera.view();
    this.ambient.update(pl, this.weather.wind, this.weather.p.rain, !this.weather.interior, cx, cy, this.room.collision, this.reduced);
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
    const bb = n.prop.bounds();
    const x = Math.round(n.prop.x);
    const bob = this.reduced ? 0 : Math.round(Math.sin(this.realTicks * 0.08));
    const y = Math.round(Math.min(bb.y, this.player.body.y - SCALE.H) - 14 + bob);
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
    for (const z of this.camera.zones) r.rect(z.x0, this.camera.y + 2, z.x1 - z.x0, 1, [1, 0.4, 0.8]);
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
    return [
      `fps ${this.fps.toFixed(0)}  frame ${this.frameMs.toFixed(2)} ms  draws ${this.r.drawCalls}+${bd?.stats.draws ?? 0}  points ${bd?.stats.points ?? 0}`,
      `view ${SCALE.viewW}x${SCALE.viewH} @${pr.scale.toFixed(3)}x ${pr.sharp ? "sharp-bilinear" : "nearest"}  H ${SCALE.H} close-up ${SCALE.closeupH} (stand-in bbox incl. halo+glaive ${this.heights.world}/${this.heights.closeup})`,
      `room ${this.room.def.id} ${this.room.def.w}x${this.room.def.h} (${(this.room.def.w / SCALE.H).toFixed(1)}x${(this.room.def.h / SCALE.H).toFixed(1)} H)  build ${this.room.buildMs} ms (backdrop ${bd?.buildMs ?? 0})  live: ${this.stream.status()}`,
      `pos ${b.x.toFixed(0)}, ${b.y.toFixed(0)} (${(b.x / SCALE.H).toFixed(2)}, ${(b.y / SCALE.H).toFixed(2)} H)  ${b.grounded ? "ground" : "air"} on ${this.room.collision.lastSurface}  clip ${p.clip.clip.id}`,
      `camera ${this.camera.x.toFixed(0)}, ${this.camera.y.toFixed(0)}  zone ${this.camera.zoneWeight.toFixed(2)}  bars ${this.camera.bars.toFixed(3)}  close-up ${this.camera.closeup.toFixed(2)}`,
      `weather ${w.interior ? "inside/" : ""}${w.label}  rain ${w.p.rain.toFixed(2)} wind ${w.wind.toFixed(2)} mist ${w.p.mist.toFixed(2)} dark ${w.p.dark.toFixed(2)} flash ${w.flash.toFixed(2)} strikes ${w.strikes.length}${this.stormPassed ? "  (storm passed)" : ""}`,
      `sound ${this.audio.started ? (this.audio.muted ? "muted" : "on") : "not started"}  music ${this.audio.state.music} ${this.audio.state.level.toFixed(2)}  bed ${this.audio.state.bed}`,
      `near ${this.near ? `${this.near.prop.recipe}#${this.near.prop.id}` : "-"}  props ${this.room.props.length}  lights ${this.r.lightCount}  vfx ${this.vfx.counts.effects}/${this.vfx.counts.particles}`,
      `save ${Object.keys(this.save.data.flags).filter((k) => this.save.data.flags[k]).join(", ") || "-"}  rest ${this.save.data.rest ? `${this.save.data.rest.room}/${this.save.data.rest.spawn}` : "-"}`,
    ].join("\n");
  }

  /** Test hook: plain state for automation. */
  state(): Record<string, unknown> {
    const b = this.player.body;
    return {
      mode: this.mode,
      room: this.room.def.id,
      x: b.x,
      y: b.y,
      vx: b.vx,
      vy: b.vy,
      grounded: b.grounded,
      facing: this.player.facing,
      clip: this.player.clip.clip.id,
      hp: this.player.hp,
      camera: [this.camera.x, this.camera.y],
      bars: this.camera.bars,
      closeup: this.camera.closeup,
      weather: { label: this.weather.label, interior: this.weather.interior, ...this.weather.p, wind: this.weather.wind, flash: this.weather.flash },
      near: this.near ? this.near.prop.id : null,
      panel: this.panels.kind,
      transition: !!this.trans,
      fade: this.fade,
      present: this.r.presenter.rect,
      heights: this.heights,
      live: this.stream.status(),
      save: this.save.data,
      fps: this.fps,
      frameMs: this.frameMs,
      sim: this.simTicks,
      audio: this.audio.state,
      stormPassed: this.stormPassed,
    };
  }

  /** Test hook: put the player at room x (on the ground there), snap the camera and the weather. */
  place(x: number, y?: number): Record<string, unknown> {
    const b = this.player.body;
    b.x = x;
    b.y = y ?? this.room.collision.groundAt(x, 0);
    b.vx = b.vy = 0;
    this.camera.snapTo(b.x, b.y, this.player.facing, this.room.collision.bounds());
    this.weather.snap(this.program(), b.x / this.room.def.w);
    return this.state();
  }

  /** Test hook: jump straight to a room and spawn (no fade). */
  teleport(room: string, spawn: string): void {
    this.enter(room, spawn);
  }
}

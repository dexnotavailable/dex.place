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
import { H, PHYSICS, TILE } from "./config.ts";
import { TileStore } from "./plates/store.ts";
import type { ZhushaAssets } from "./player.ts";
import { Atmos, type MistBand } from "./render/atmos.ts";
import { Motes } from "./render/motes.ts";
import { PlaneRenderer, type PlaneLook, type TileQuad } from "./render/planes.ts";
import { eyeY, levelFor, planeLevels, planeXf, rowOf, type CamState } from "./render/view.ts";
import { buildWorld } from "./world/index.ts";
import { isReload, loadSave, resumePlace, writeSave, type TesuSave } from "./save.ts";
import { PLANES, PLANE_IDS, type Atmos as AtmosDef, type PlaneId, type Spawn, type Water, type WorldDef } from "./world/types.ts";

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
  readonly player: Player;
  readonly vfx: Vfx;
  readonly feel: Feel;
  readonly flags = new Set<string>();
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
    const services: Services = { vfx: this.vfx, feel: this.feel, camera: labCam };
    // frozen controls read nothing; "down" only means drop-through on one-way ground
    this.inputProxy = new Proxy(input, {
      get: (t, k, rcv) => {
        if (k === "isDown") return (a: Action) => (this.frozen > 0 ? false : a === "down" ? t.isDown(a) && this.collision.onOneWay(this.player.body) : t.isDown(a));
        if (k === "axis") return () => (this.frozen > 0 ? 0 : t.axis());
        if (k === "pressTick") return (a: Action) => (this.frozen > 0 ? undefined : t.pressTick(a));
        const v = Reflect.get(t, k, rcv);
        return typeof v === "function" ? v.bind(t) : v;
      },
    });
    this.player = new Player(assets.sprite, assets.tuning.player, services, [0, 0]);
    this.closeSprite = assets.closeup;
    this.vfx.groundAt = (x, y) => this.collision.groundAt(x, y);
    this.save = loadSave();
    for (const f of this.save.flags) this.flags.add(f);
    const catchS = this.world.spawns.find((s) => s.id === "catch")!;
    const resume = opts.link ? null : resumePlace(this.save, Date.now(), catchS.x, isReload());
    if (resume) this.spawnAt({ id: "resume", x: resume.x, y: resume.y, facing: resume.facing });
    else this.spawnAt(this.world.spawns.find((s) => s.id === opts.start) ?? catchS);
    this.startedBy = resume ? "resume" : opts.link ? "link" : "fresh";
  }

  readonly startedBy: "fresh" | "resume" | "link" = "fresh";

  /** Sets a progress flag (kept on this device). */
  setFlag(f: string, on = true): void {
    if (on === this.flags.has(f)) return;
    if (on) this.flags.add(f);
    else this.flags.delete(f);
    this.save.flags = [...this.flags];
    writeSave(this.save);
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

  /** Debug and tools: force a framing (zoom, anchor, horizon), or null to follow the tracks. */
  framingOverride: Partial<ReturnType<typeof framingAt>> | null = null;

  private framing(): ReturnType<typeof framingAt> {
    const f = framingAt(this.world.tracks, this.player.body.x, (fl) => this.flags.has(fl));
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
    const f = this.framing();
    this.camera.update(b.x, b.y, this.player.facing, b.vx, f);
    this.tugTick();
    this.motes.update(1 / 60);
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
    this.player.update(this.inputProxy, this.collision as unknown as LabWorld, []);
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
          this.tug = { t: 0, x: this.lastSafe[0], y: this.lastSafe[1] };
          this.frozen = 9999;
          break;
        }
      }
      if (b.y > this.world.h + H * 4) this.tug = { t: 0, x: this.lastSafe[0], y: this.lastSafe[1] };
    }
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

  private atmosAt(x: number): AtmosDef {
    const list = this.world.atmos;
    let a = list[0]!;
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
    this.store.frame++;
    const cam = this.camera.state();
    const W = cam.W, Hf = cam.H;
    const a = this.atmosAt(cam.cx);
    const hz = cam.horizon * Hf;
    const sunPx: [number, number, number] = a.sun ? [a.sun[0] * W, a.sun[1] * Hf, 9] : [0, 0, 0];
    const sky = [hexRgb(a.sky[0]), hexRgb(a.sky[1]), hexRgb(a.sky[2])];
    const water = this.activeWater(cam);
    const draws = new Map<PlaneId, PlaneDraw>();
    for (const id of PLANE_IDS) draws.set(id, this.planeQuads(cam, id, 0, Hf, a, !this.manual));
    this.loading = ![...draws.values()].every((d) => d.complete);
    const z = cam.zoom, zEff = Math.min(1, z), lens = Math.max(1, z);
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
        hz, eye, wy: water.y, z: zEff, cx: cam.cx, lens, focus,
        ext: [water.x0, water.x1, water.fx0 ?? water.x0, water.fx1 ?? water.x1],
        depth: [water.near, water.far], rows, time: this.time,
        deep: hexRgb("#1f5a60"), body: hexRgb("#3f8f8a"), shallow: hexRgb("#bfe0dc"),
        haze: hexRgb(a.haze), glint: hexRgb("#fffbe8"), still: water.kind === "lake" ? 1 : 0.4,
      });
    };
    const mist = (rate: number, strength: number, drift: number): void => {
      if (!water || a.mist <= 0) return;
      const row = rowOf(cam, rate, water.y);
      const band: MistBand = { row: row - 4 * Math.max(zEff, 0.3), half: 26 * Math.max(0.45, planeXf(cam, rate).g), density: a.mist * strength, drift };
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
      if (id === "back" || id === "near") {
        r.begin(camX, camY, DAY, lights);
        this.motes.draw(r, cam, id === "back" ? 0.6 : 1.3);
        r.flush();
      }
    }
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    void b;
    r.present({
      impact: this.feel.impact,
      zoom: 1 + this.camera.punch,
      view: 1,
      focus: [W / 2, cam.anchor * Hf],
      fade: [0.106, 0.098, 0.133, this.loading && this.tick < 2 ? 1 : this.fade],
      bars: 0,
      overlay: false,
    });
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
    };
  }

  debugText(): string {
    const s = this.state();
    return Object.entries(s).map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`).join("\n");
  }
}

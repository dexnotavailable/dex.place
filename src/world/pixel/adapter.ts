// The pixel-matter adapter: the real engine in src/pixel/ running inside the
// world runtime. One PixelWorld per room (built with the room, dropped with
// it), fed the room's wind, the player's position, her hits (the moveset's
// preset hit shapes: slash, heavy, Q, R, dash wind) and E; read back for
// collision (its colliders become the room's solids and platforms), light
// (its lights rim the player in their colour, and the world's lights light
// its cells), sound, panels, state events and the save (its persisted keys
// are mirrored into the world save as cut:<id> etc., so one save answers
// every "is it open" question).
//
// Recipes are found, not registered: the pixel lane's registry
// (src/pixel/registry.ts) finds every recipe under src/pixel/props/**, so a
// region lane's recipe in src/pixel/props/<region>/ is placeable from a room
// with no shared edit. Room placements name a recipe; see resolveRecipe()
// for how a name picks the engine. The kit's host events (door, lever, rest,
// sit, stand) drive the same mechanics as the runtime's own props (game.ts).
//
// Drawing shares the world's WebGL2 context: a PixelRenderer is made on the
// same canvas (getContext returns the existing context), and its cell, glow
// and particle programs draw straight into the world target inside the main
// pass, between the world's own layers (far and bg behind the terrain, mid
// and decal before the player, fg after her, light last). The renderer has
// no public "draw these layers into the bound target" call yet, so this uses
// its per-layer internals through one typed seam (Internals below), checked
// at start-up; ENGINE.md lists the ask to make it public.

import { PixelRenderer, PixelWorld, LAB_LIGHTING, presetHit, type Hit, type HitType, type LayerName, type PointLight, type Prop as PxProp, type Recipe, type WorldEvent, type Lighting as PxLighting } from "../../pixel/index.ts";
import { findRecipe } from "../../pixel/registry.ts";
import type { Lighting } from "../render/renderer.ts";
import { FRAME } from "../config.ts";

type AnyRecipe = Recipe<object, unknown>;

/**
 * Which engine builds a placement. `engine: "pixel"` asks the pixel-matter
 * registry (src/pixel/registry.ts: every recipe under src/pixel/props/**, the
 * kit and the region folders, looked up forgivingly: "map-banner" finds
 * mapBanner); `engine: "stub"` asks the runtime's stub recipes. Otherwise the
 * runtime's stub wins when it knows the name (its doors, levers and lifts
 * carry the round's mechanics), then pixel matter.
 */
export function resolveRecipe(name: string, engine: "pixel" | "stub" | undefined, stubHas: (n: string) => boolean): { engine: "pixel"; recipe: AnyRecipe } | { engine: "stub" } | null {
  const px = (): AnyRecipe | undefined => findRecipe(name) as AnyRecipe | undefined;
  if (engine === "pixel") {
    const r = px();
    return r ? { engine: "pixel", recipe: r } : null;
  }
  if (engine === "stub" || stubHas(name)) return stubHas(name) ? { engine: "stub" } : null;
  const r = px();
  return r ? { engine: "pixel", recipe: r } : null;
}

/** The PixelRenderer internals the adapter draws through (see the header). */
interface Internals {
  syncMaterials(): void;
  useCell(L: PxLighting, lights: PointLight[], view: "lit"): void;
  drawPart(part: unknown, cam: { x: number; y: number }, layer: LayerName, world: PixelWorld): void;
  drawGlows(world: PixelWorld, cam: { x: number; y: number }): void;
  drawParticles(world: PixelWorld, cam: { x: number; y: number }, additive: boolean): void;
  frame: number;
}

/** One per game: the pixel renderer on the world's GL context. */
export class PixelDraw {
  readonly pr: PixelRenderer;
  private io: Internals;
  constructor(canvas: HTMLCanvasElement, private gl: WebGL2RenderingContext) {
    this.pr = new PixelRenderer(canvas, FRAME.w, FRAME.h);
    if (this.pr.gl !== gl) throw new Error("pixel adapter: the pixel renderer did not get the world's WebGL2 context");
    this.io = this.pr as unknown as Internals;
    for (const k of ["syncMaterials", "useCell", "drawPart", "drawGlows", "drawParticles"] as const)
      if (typeof this.io[k] !== "function") throw new Error(`pixel adapter: PixelRenderer.${k} is gone; the adapter (src/world/pixel/adapter.ts) needs a public per-layer draw (docs/props/ENGINE.md)`);
  }

  /** The frame's width changed (window shape): the pixel renderer projects into the new width. */
  resizeFrame(w: number, h: number): void {
    const pr = this.pr as unknown as { vw: number; vh: number };
    pr.vw = w;
    pr.vh = h;
  }

  /** Free a room's textures (room teardown). */
  release(world: PixelWorld): void {
    this.pr.releaseWorld(world);
  }

  /**
   * Draw these layers of a pixel world into the bound target (the world's
   * main target, 1280 x 720). Leaves blending as the world renderer expects.
   */
  draw(world: PixelWorld, layers: LayerName[], cam: { x: number; y: number }, lighting: Lighting, lights: PointLight[], o: { glows?: boolean; particles?: "solid" | "add" | "both" } = {}): void {
    const gl = this.gl;
    for (const p of world.drainRetired()) this.pr.release(p);
    const parts = world.allParts().filter((p) => p.visible && p.grid.count > 0 && layers.includes(p.layer));
    if (!parts.length && !o.glows && !o.particles) return;
    this.io.frame++;
    this.io.syncMaterials();
    const L: PxLighting = { ...LAB_LIGHTING, ...(lighting as Partial<PxLighting>) };
    this.io.useCell(L, lights.slice(0, 16), "lit");
    gl.bindVertexArray(null);
    for (const layer of layers) {
      const list = parts.filter((p) => p.layer === layer).sort((a, b) => a.z - b.z);
      for (const p of list) this.io.drawPart(p, cam, layer, world);
    }
    if (o.particles === "solid" || o.particles === "both") this.io.drawParticles(world, cam, false);
    if (o.glows) this.io.drawGlows(world, cam);
    if (o.particles === "add" || o.particles === "both") this.io.drawParticles(world, cam, true);
    // hand the state back to the world renderer
    gl.bindVertexArray(null);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.activeTexture(gl.TEXTURE0);
  }
}

export interface PixelBox {
  x: number;
  y: number;
  w: number;
  h: number;
  platform: boolean;
  id: string;
}

/** A room's pixel matter. */
export class PixelRoom {
  readonly world: PixelWorld;
  readonly props: PxProp[] = [];
  /** Placement params by prop id (reflection flags, the original placement). */
  readonly ids = new Set<string>();
  private lastBlow = -1;

  constructor(w: number, h: number, H: number, saved: Record<string, Record<string, unknown>>, ground: (x: number, y: number) => boolean, private host?: { gate: () => boolean; reduced: () => boolean }) {
    this.world = new PixelWorld({ H, width: w, height: h, seed: 7, heal: { delay: 4.5, rate: 70 } });
    if (host) {
      // All pixel callers (including direct neon flickers) use the host's
      // common clock and live mode; room-local time must not reset its gate.
      this.world.flashGate = { allow: () => host.gate() };
      this.world.reduced = host.reduced();
    }
    this.world.saveData = structuredClone(saved);
    // the world's terrain is ground for ropes, cloth and debris (the engine asks solidAt)
    const own = this.world.solidAt.bind(this.world);
    this.world.solidAt = (x: number, y: number): boolean => ground(x, y) || own(x, y);
  }

  add(recipe: AnyRecipe, id: string, x: number, y: number, params: Record<string, unknown>, flip: boolean): PxProp {
    const p = this.world.add(recipe, params as never, x, y, { id, flip: flip ? -1 : 1 });
    this.props.push(p as PxProp);
    this.ids.add(id);
    return p as PxProp;
  }

  get empty(): boolean {
    return this.props.length === 0;
  }

  /** One 60 Hz step with the room's wind (-1..1) and the player's air pushes. */
  step(wind: number, gust: number, pushes: { x: number; y: number; r: number; s: number }[], tick: number): void {
    if (this.empty) return;
    if (this.host) this.world.reduced = this.host.reduced();
    const H = this.world.H;
    this.world.wind = { x: wind * H * 3, gust: gust * H * 2 };
    // a dash or spin push blows once per start (the engine keeps the gust alive for its duration)
    if (pushes.length && tick - this.lastBlow > 20) {
      const p = pushes[0]!;
      this.world.blow(p.x, p.y, p.r, 0, -H * 2, 0.35);
      this.lastBlow = tick;
    }
    this.world.step(1 / 60);
  }

  /** The player's move as the engine's preset hit shapes; returns whether anything was touched. */
  hit(type: HitType, x: number, y: number, face: 1 | -1): boolean {
    if (this.empty) return false;
    let touched = false;
    for (const h of presetHit(type, x, y, face, this.world.H) as Hit[]) {
      for (const r of this.world.hit(h)) if (r.reports.some((q) => q.covered > 0)) touched = true;
    }
    return touched;
  }

  /**
   * Collision boxes. Pixel matter never blocks the way: its solid parts become
   * platform tops (stand on a donation box or the terminal; walk past them in
   * front). Walls and floors that must stop you are room terrain.
   */
  colliders(): PixelBox[] {
    const out: PixelBox[] = [];
    if (this.empty) return out;
    const H = this.world.H;
    for (const c of this.world.colliders()) {
      if (c.type === "trigger") continue;
      const id = c.part.prop?.id ?? "";
      const platform = true;
      void H;
      out.push({ x: c.x0, y: c.y0, w: c.x1 - c.x0, h: c.y1 - c.y0, platform, id });
    }
    return out;
  }

  lights(view: { x: number; y: number; w: number; h: number }): PointLight[] {
    return this.empty ? [] : this.world.lights(view);
  }

  nearestUsable(x: number, y: number): PxProp | null {
    return this.empty ? null : this.world.nearestUsable(x, y);
  }

  events(): WorldEvent[] {
    return this.empty ? [] : this.world.drainEvents();
  }

  /** The persisted keys (the engine refreshes them every step). */
  saveData(): Record<string, Record<string, unknown>> {
    return this.world.saveData;
  }
}

// The scene contract. A scene file default-exports a SceneDef; the engine
// calls build(ctx) whenever the resolution mode changes (world 1280x720, the
// locked view; near 640x360 and far 960x540, the old prototype sizes kept for
// comparison), so a scene regenerates at the new pixel size instead of scaling.
// The sizes themselves live in scale.ts.

import type { Hex } from "./palette.ts";
import type { Pix } from "./pix.ts";

export type Mode = "world" | "near" | "far";
export { RESOLUTIONS } from "./scale.ts";

export type Blend = "over" | "add";

export interface LayerCommon {
  name: string;
  /**
   * Distance in "player plane" units: 1 is the character's plane, 2 is twice as
   * far (moves half as fast), Infinity is the sky (never moves), below 1 is
   * foreground (moves faster than the camera). Parallax = 1 / depth, and the
   * default fog comes from the scene's fog density at this depth.
   */
  depth: number;
  /** Override the fog amount (0..1) instead of taking it from depth. */
  fog?: number;
  /**
   * Waterline (layer y) to mirror this layer about into the reflection buffer.
   * Leave undefined for layers that should not show in water.
   */
  reflect?: number;
  blend?: Blend;
  opacity?: number;
  /** Band-edge dithering for ramp() in this layer (0 = hard bands). */
  dither?: number;
  /**
   * Layer-space box outside which the layer draws nothing (x0/x1 optional).
   * The engine scissors to it, so a thin band costs only its own pixels.
   */
  bounds?: { y0: number; y1: number; x0?: number; x1?: number };
  /**
   * With reflect: the mirrored copy fades out over this many px below its
   * waterline (stepped, dithered), so a reflection dims with distance from the
   * thing that casts it. 0 / undefined = no fade (the old behaviour).
   */
  reflectFade?: number;
  /** With reflect: darken the mirrored copy by this much (0..1, default 0). */
  reflectDim?: number;
}

/** A layer computed per pixel by scene GLSL. body must define vec4 layer(vec2 p, vec2 s). */
export interface GlslLayer extends LayerCommon {
  kind: "glsl";
  body: string;
  /** Samples the reflection buffer through uRefl (water). */
  usesReflection?: boolean;
}

/** A layer drawn from a Pix buffer built on the CPU at build time. */
export interface PixLayer extends LayerCommon {
  kind: "pix";
  pix: Pix;
  /** Layer-space position of the buffer's top-left pixel. */
  x: number;
  y: number;
  repeatX?: boolean;
  /** 0..1: how often emissive pixels dim for a moment (windows, lamps). */
  twinkle?: number;
}

export interface PointSink {
  /** Layer-space top-left, whole pixels after the engine's rounding. */
  push(x: number, y: number, size: number, shape: number, row: number, shade: number, frame: number, alpha: number): void;
}

export interface LightOut {
  /** Layer-space centre. */
  x: number;
  y: number;
  radius: number;
  intensity: number;
  colour: [number, number, number];
}

export interface SimEnv {
  /** Scene seconds. */
  t: number;
  reduced: boolean;
  ctx: BuildCtx;
  /** Global flash limiter: ask before starting a flash. */
  flashGate(): boolean;
}

export interface PointSystem {
  update(dt: number, env: SimEnv): void;
  draw(sink: PointSink): void;
  lights?(out: LightOut[]): void;
}

/** Particles, birds and flash accents, drawn as point sprites. */
export interface PointsLayer extends LayerCommon {
  kind: "points";
  system: PointSystem;
}

/** The stand-in character (toggle C). */
export interface CharacterLayer extends LayerCommon {
  kind: "character";
  /** Layer-space x of the feet and y of the ground under them. */
  x: number;
  ground: number;
  facing?: 1 | -1;
  /** Direction toward the key light for the 1px rim (screen, y down). */
  rimDir?: [number, number];
  /** Skull top to sole in px (default STANDIN_HEIGHT, 136; the locked player is ctx.player). */
  height?: number;
}

export type LayerDef = GlslLayer | PixLayer | PointsLayer | CharacterLayer;

export interface BuildCtx {
  mode: Mode;
  /** Low-res buffer size. */
  W: number;
  H: number;
  /** H / 360: multiply view-scaled sizes by this so a scene composes the same in every mode. */
  u: number;
  /** H / 720: world px per locked-view px (1 in world mode, 0.5 in near). */
  world: number;
  /** The locked player height in this mode's px (80 in world mode). */
  player: number;
  /** Camera pan range at depth 1, in pixels. */
  span: number;
  /** Ramp row index by name. */
  row(name: string): number;
  /** Parallax of a depth, and the extra width a layer at that depth needs to cover the pan. */
  par(depth: number): number;
  panWidth(depth: number): number;
  fogAt(depth: number): number;
  rng: () => number;
}

export interface FogSpec {
  /** Sky/haze colour stops down the screen: [y fraction 0 = top, colour]. */
  stops: [number, Hex][];
  /** Number of bands the gradient is stepped into. */
  bands?: number;
  /** Fog at depth d is max * (1 - exp(-density * (d - 1))). */
  density: number;
  max: number;
  /** A stepped glow in the haze around a light source (screen fractions, r in heights). */
  glow?: { x: number; y: number; r: number; colour: Hex; strength: number; steps?: number; dither?: number };
  /** How much of each gradient band edge is dithered (0..1, default 0.85). Lower = flatter bands. */
  dither?: number;
}

export interface SceneDef {
  title: string;
  palette: Record<string, Hex[]>;
  fog: FogSpec;
  /** Camera pan range at depth 1 (default 0.5 W). */
  span?: (W: number, H: number) => number;
  /** Seconds for one slow auto-drift sweep there and back (default 70). */
  driftPeriod?: number;
  /** GLSL shared by every layer: must define float sceneLight(vec2 s, float depth). */
  prelude?: (ctx: BuildCtx) => string;
  build: (ctx: BuildCtx) => LayerDef[];
}

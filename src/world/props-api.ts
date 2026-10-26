// The prop interface the world runtime talks to, matching
// docs/props/PIXEL-MATTER.md: a prop is data (cells with material, height,
// piece, health, age), built from a recipe, drawn through the same lighting
// as the player (normals, key light, effect lights, rim), with a small state
// machine, motion, breakage, lights, collision, wind, sound cues and a reason.
//
// The real pixel-matter engine is being built in src/pixel/ by another lane.
// Until it lands, src/world/props/stub.ts implements this interface with a
// small cell rasteriser, so every room can place its props now and the
// engine drops in later by registering itself with setPropEngine().
//
// Units: world px, y down. A prop's (x, y) is its base: the ground point
// under its centre. Recipes size themselves from params.H (the player's
// height, config SCALE.H), never raw pixels.

export type PropMaterial =
  | "stone"
  | "glass"
  | "wood"
  | "iron"
  | "gold"
  | "cloth"
  | "wax"
  | "flame"
  | "foliage"
  | "paper"
  | "rope"
  | "bone"
  | "water"
  | "brass"
  | "plaster";

/** Draw layers, back to front (PIXEL-MATTER "Layers"). */
export type PropLayer = "far" | "back" | "middle" | "front" | "light" | "decal";

export type PropCollision = "solid" | "platform" | "none" | "trigger";

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A hit from the player (or anything else). Shapes from PIXEL-MATTER "Hit shapes". */
export interface PropHit {
  shape: "point" | "slash" | "circle" | "cone";
  /** World box of the hitting volume (the attack's hitbox overlap). */
  box: Box;
  /** Direction of travel (unit-ish), x away from the attacker. */
  dir: [number, number];
  damage: number;
  heavy: boolean;
  /** Move / effect id that hit (m1_2, skill_q, ...). */
  source: string;
}

export interface PropLight {
  x: number;
  y: number;
  radius: number;
  colour: [number, number, number];
  intensity: number;
  height: number;
}

export interface PropSaveApi {
  /** Persistent flags per prop id (cut cords, released latches). */
  get(key: string): boolean;
  set(key: string, v: boolean): void;
}

/** What a prop sees each tick. */
export interface PropWorld {
  /** Seconds since the room went live. */
  time: number;
  /** 60 Hz ticks. */
  tick: number;
  reduced: boolean;
  /** Wind -1..1 (+ = toward +x), gusting. The player's dash and spins add local pushes via push(). */
  wind: number;
  rain: number;
  /** Lightning flash level 0..1 this tick. */
  flash: number;
  player: { x: number; y: number; vx: number; vy: number; facing: number; h: number };
  sound(id: string, volume?: number, at?: [number, number]): void;
  save: PropSaveApi;
  /** Ask the UI to open a panel (donate, gallery, archive, account, map, donors, downloads). */
  openPanel(kind: string, arg?: string): void;
  /** Spawn a VFX preset from the player's library (dust, sparks, feathers...). */
  vfx(id: string, x: number, y: number, facing?: number): void;
  /** Local air push from the player (dash, spins): point, radius, strength. */
  pushes: { x: number; y: number; r: number; s: number }[];
}

/** Draw calls a prop may make; implemented by the world renderer. */
export interface PropCanvas {
  /** A cell texture (albedo + normal) at a world position; lit = 0 draws it unlit (emissive). */
  cells(tex: CellTexture, x: number, y: number, o?: { flip?: boolean; lit?: number; opacity?: number; sx?: number; sy?: number; sw?: number; sh?: number }): void;
  /** Solid pixel rect in world space (ropes, sparks, rain on props). */
  rect(x: number, y: number, w: number, h: number, colour: [number, number, number], opacity?: number): void;
  /** A soft stepped glow (additive) at a world point. */
  glow(x: number, y: number, r: number, colour: [number, number, number], strength: number): void;
}

/** Opaque texture handle made by the engine from a prop's cells. */
export interface CellTexture {
  readonly w: number;
  readonly h: number;
}

export interface Interaction {
  /** How close (px, feet to base) the player must be. */
  radius: number;
  /** One or two words for the small prompt; empty = only the key glyph. */
  label: string;
  use(w: PropWorld): void;
}

export interface Prop {
  readonly id: string;
  readonly recipe: string;
  /** Why this prop is here (CANON: every prop has a reason). */
  readonly reason: string;
  x: number;
  y: number;
  /** Current state name (idle, disturbed, damaged, broken, rubble, restoring; or special: lit/out, closed/open...). */
  readonly state: string;
  readonly states: readonly string[];
  readonly collision: PropCollision;
  /** Layers this prop draws on (draw() is called once per layer). */
  readonly layers: readonly PropLayer[];
  /** World box for culling, hits and prompts. */
  bounds(): Box;
  /** Solid boxes or platform tops (platform: h is ignored) while collision is solid/platform. */
  solids(): Box[];
  /** E / use, when the prop has one right now. */
  interaction(): Interaction | null;
  /** A hit: returns true if the prop reacted (the attack then counts as connecting). */
  hit(h: PropHit, w: PropWorld): boolean;
  update(w: PropWorld): void;
  draw(c: PropCanvas, layer: PropLayer): void;
  lights(out: PropLight[]): void;
  setState(s: string): void;
  dispose(): void;
}

export interface PropParams {
  id: string;
  x: number;
  y: number;
  /** The player's height in world px (size everything from this). */
  H: number;
  seed?: number;
  variant?: string;
  /** 0..1 wear. */
  wear?: number;
  /** Recipe-specific parameters. */
  [key: string]: unknown;
}

export interface PropRecipe {
  name: string;
  reason: string;
  build(p: PropParams, engine: PixelMatterEngine): Prop;
}

/** The engine: cells, textures, the recipes it knows. */
export interface PixelMatterEngine {
  readonly name: string;
  register(r: PropRecipe): void;
  has(recipe: string): boolean;
  create(recipe: string, p: PropParams): Prop;
}

let engine: PixelMatterEngine | null = null;

/** The pixel-matter engine (src/pixel) registers itself here when it lands; until then the stub is used. */
export function setPropEngine(e: PixelMatterEngine): void {
  engine = e;
}

export function propEngine(): PixelMatterEngine {
  if (!engine) throw new Error("no prop engine registered (src/world/props/stub.ts registers the stub at boot)");
  return engine;
}

// The data model of the continuous world. One world, in world px (x east, y down) at
// play density; H = 96 px (config.ts). Places are authored as sections that push pieces
// (painted art on a plane), ground (collision) and camera, water and void data into one
// WorldDef. Nothing here knows about rooms.

/**
 * Planes from far to near (A.1's depth stack): P0 sky pieces (clouds, the isles) over the
 * sky shader's gradient, P1 far, P2 middle far, P3 near back, P4 play (behind her) and
 * play front (in front of her, same rate), P5 near front.
 */
export const PLANE_IDS = ["sky", "far", "mid", "back", "play", "front", "near"] as const;
export type PlaneId = (typeof PLANE_IDS)[number];

export interface PlaneSpec {
  id: PlaneId;
  /** Scroll rate against the camera at play zoom (1 = the play plane). */
  rate: number;
  /** Share faded toward the haze colour (0 none). Near planes darken toward ink instead. */
  fade: number;
  /** Darkening toward ink for planes in front of the play plane. */
  ink: number;
}

/** The standard stack. Rates and fades from A.1 (P1 0.05-0.1, P2 0.2-0.35, P3 0.5-0.7, P5 1.2-1.5). */
export const PLANES: Record<PlaneId, PlaneSpec> = {
  sky: { id: "sky", rate: 0.02, fade: 0, ink: 0 },
  far: { id: "far", rate: 0.08, fade: 0.62, ink: 0 },
  mid: { id: "mid", rate: 0.28, fade: 0.4, ink: 0 },
  back: { id: "back", rate: 0.62, fade: 0.17, ink: 0 },
  play: { id: "play", rate: 1, fade: 0, ink: 0 },
  front: { id: "front", rate: 1, fade: 0, ink: 0 },
  near: { id: "near", rate: 1.35, fade: 0, ink: 0.3 },
};

/** A painted thing on a plane. Painters live in art/painters and are looked up by `kind`. */
export interface Piece {
  plane: PlaneId;
  kind: string;
  /** Anchor in 3D world px (on the play plane, plain world px). */
  x: number;
  y: number;
  /** Painter parameters. Sizes are level-1 art px of the piece's plane. */
  p: Record<string, unknown>;
  /** Order within the plane (higher paints later). */
  z: number;
  seed: number;
  /** Shows in still water (default true). */
  reflect?: boolean;
  /** Filled in by the world builder: bounds in level-1 plane px. */
  box?: [number, number, number, number];
}

export type Surface = "wood" | "stone" | "earth" | "grass" | "tile" | "water";

/**
 * Walkable ground: a polyline with strictly increasing x. A solid walk has mass under it
 * (`depth` px of rock, timber or masonry: walls for anything walking into it from the side);
 * a one-way walk (planks, ledges) can be jumped through from below and dropped through.
 */
export interface Walk {
  id: number;
  pts: number[];
  surface: Surface;
  oneWay: boolean;
  /** Thickness of the mass under a solid walk, px (Infinity for massif). */
  depth: number;
  /**
   * A stair she can walk under: one-way, never stepped onto from other ground while
   * walking (she hops onto it, or comes down onto it from its top).
   */
  stair?: boolean;
  /** Optional name (for spawns, debug, the stroke it belongs to). */
  name?: string;
}

/**
 * A vertical hard edge she cannot pass: a rail at the end of a band, a building wall, the
 * massif's flank. Every one is drawn (the terrain grammar: never an invisible wall).
 */
export interface Wall {
  x: number;
  y0: number;
  y1: number;
  /** What the visitor sees there. */
  reason: "rail" | "wall" | "cliff" | "gate" | "world-end";
  /** Blocks only bodies coming from this side ("both" by default). */
  from?: "left" | "right" | "both";
}

/** Still water: a flat surface in 3D, from in front of the play plane to the far shore. */
export interface Water {
  /** World y of the surface. */
  y: number;
  /** 3D x extent (world px) at the play plane. */
  x0: number;
  x1: number;
  /** 3D x extent at the far shore (the lake widens away from the camera); defaults to x0, x1. */
  fx0?: number;
  fx1?: number;
  /** Nearest and farthest depth, as plane rates (1.6 = in front of the play plane, 0.05 = far). */
  near: number;
  far: number;
  /** Look: "lake" (Kagami's mirror), "harbour", "pool". */
  kind: string;
}

/** Below `y` within [x0, x1] there is nothing: a fall fades and the hat talisman tugs her back. */
export interface Void {
  x0: number;
  x1: number;
  y: number;
  /** Lower limit (a band of void, e.g. the water under a jetty); open below when unset. */
  y1?: number;
}

/** Camera framing keyed to where she is (not to a clock). Values are blended between keys by her x. */
export interface CamKey {
  x: number;
  /** Play plane scale (1 play, 0.5 vista, 0.125 the widest frame, 2 close). */
  zoom?: number;
  /** Feet row as a share of the frame height (0.66 ordinary, 0.78 overlook, 0.7 narrow). */
  anchor?: number;
  /** Horizon row as a share of the frame height (eye level). */
  horizon?: number;
  /** Look-ahead toward her facing, share of the frame width. */
  lead?: number;
  /** Fixed camera x (world px) instead of following her (vistas, framed holds). */
  fixX?: number;
  /** Fixed camera feet-row y (world px). */
  fixY?: number;
  /**
   * Pin a world x (on the play plane) to a fraction of the frame's width, whatever the
   * window's shape: a narrow frame crops the far side of the picture, the pinned thing stays put.
   */
  pin?: { x: number; at: number };
}

export interface CamTrack {
  id: string;
  x0: number;
  x1: number;
  /** Only within this y band (interiors share x with the land above them). */
  y0?: number;
  y1?: number;
  /** Only while this world flag is unset (e.g. the opening's reveal). */
  unless?: string;
  /** Only while this flag is set. */
  when?: string;
  keys: CamKey[];
}

/** Haze, sky and light for a stretch of the land (blended by x). */
export interface Atmos {
  x: number;
  /** Only within this y band (interiors live in a band of their own below the land). */
  y0?: number;
  y1?: number;
  /** An interior: no sky, sun or clouds; warm haze instead of mist. */
  interior?: boolean;
  /** Sky top, horizon and low colours. */
  sky: [string, string, string];
  /** Haze colour background planes fade toward. */
  haze: string;
  /** Mist band strength 0..1 and colour. */
  mist: number;
  mistColour: string;
  /** Sun position in the sky as share of the frame (x, y); null for none. */
  sun: [number, number] | null;
  /** Still water's colours under this sky (deep, body, shallow, the sun's glint). */
  water?: { deep: string; body: string; shallow: string; glint: string };
}

/** Something that moves on a plane: animated frames from a painter (or, later, a render). */
export interface SpriteDef {
  id: string;
  plane: PlaneId;
  kind: string;
  /** Anchor in 3D world px (its feet). */
  x: number;
  y: number;
  p: Record<string, unknown>;
  seed: number;
  frames?: number;
  fps?: number;
  /** Walks back and forth along [x0, x1] (3D px) at `speed` px/s. */
  path?: [number, number];
  speed?: number;
  /** Shows in still water (default true). */
  reflect?: boolean;
  /**
   * Drifts east at this many plane px per second (clouds, mist), wrapping over `path` without
   * ever turning round; choose a path wider than any frame the plane is seen in.
   */
  drift?: number;
}

/** A bank of mist lying at a height in a stretch of the land (a valley's), drawn after a plane. */
export interface MistBank {
  x0: number;
  x1: number;
  /** World y of its middle and its half thickness (3D px). */
  y: number;
  half: number;
  /** The depth it lies at (a plane rate) and the plane it is drawn after. */
  rate: number;
  after: PlaneId;
  density: number;
}

/**
 * Something she can use with F (or Enter, or a tap): a door (a scene cut), a service that
 * opens an in-world panel, a thing to inspect. Its area is in world px.
 */
export interface Usable {
  id: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** What the prompt says (a word, for screen readers and the caption). */
  label: string;
  action:
    | { kind: "door"; to: string; title?: string }
    | { kind: "panel"; panel: string; arg?: string }
    | { kind: "say"; text: string };
}

export interface Spawn {
  id: string;
  x: number;
  y: number;
  facing: 1 | -1;
}

/** A named place: titles, the map, links (/tesu/<place>). */
export interface Place {
  id: string;
  name: string;
  x0: number;
  x1: number;
  /** A y band (interiors). */
  y0?: number;
  y1?: number;
  /** Indoors grand: the world y its held Vista entrance shot frames on (her feet row). */
  vista?: number;
  /** "big" titles (TESU) or small place names. */
  title?: "big" | "place";
  spawn: string;
}

export interface WorldDef {
  /** World extent in px. */
  w: number;
  h: number;
  pieces: Piece[];
  sprites: SpriteDef[];
  walks: Walk[];
  walls: Wall[];
  waters: Water[];
  mists: MistBank[];
  voids: Void[];
  tracks: CamTrack[];
  atmos: Atmos[];
  spawns: Spawn[];
  places: Place[];
  usables: Usable[];
}

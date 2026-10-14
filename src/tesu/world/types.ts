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
  /** Painted only at art scales at or above this (a foreground prop that only frames close shots). */
  minLevel?: number;
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
  /** Ground only while this world flag is set (a rope bridge once dropped across). */
  when?: string;
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
  /** Gone once this world flag is set (the rail a dropped bridge now carries on from). */
  unless?: string;
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
  /**
   * The frame's edges never pass these world x (a room's end walls): the camera's centre is
   * kept half a frame inside them, easing in rather than stopping dead.
   */
  bounds?: [number, number];
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
  water?: {
    deep: string; body: string; shallow: string; glint: string;
    /** Multiplies what the water mirrors (rgb, default [1, 1, 1]): below 1, a darker, glassier mirror. */
    mirror?: [number, number, number];
    /**
     * (round 6) The near water's look, each 0..1 (default none): [darker and cooler toward the
     * camera, the mirror drawn down in soft streaks under what it mirrors, a few long slow ripple
     * bands (the ripples' gaps and glints only in them), the far edge melting into the haze].
     */
    near?: [number, number, number, number];
  };
  /** A colour grade on every plane: multiply by rgb (0..1+), by this amount (0..1). */
  grade?: [number, number, number, number];
  /**
   * How gradually this entry takes over from the one before it, px: the change is spread over
   * this width centred on its x (and on its y band's edges). 0 (the default) switches at once.
   */
  blend?: number;
  /**
   * The sky's look (Kagami's sky lane, round 4): the gradient in flat bands with narrow dithered
   * seams (no fine dither across the whole sky), and a broad warm bloom round the sun in stepped
   * rings: its radius (share of the frame height), strength (0..1) and colour. Absent: the old sky
   * exactly.
   */
  glow?: {
    radius: number; strength: number; colour: string;
    /**
     * (round 5) Keep the sky's own gradient (no flat bands) and add only the sun: its small bright
     * core and smooth bloom (Gate Road's morning, the same sun as Kagami's).
     */
    plain?: boolean;
  };
  /** Banks of fog lying on the water at background planes' waterlines (depth by rendering). */
  fog?: FogLayer[];
  /**
   * (round 5) This place's own haze per background plane (0..1), instead of the plane's standard
   * fade: Kagami's mid plane keeps its darks so far, mid and near read apart by value.
   */
  fades?: Partial<Record<PlaneId, number>>;
}

/**
 * A bank of fog lying on the still water at one plane's waterline, drawn over that plane and the
 * water at its depth, behind every nearer plane (and in the lake's mirror): thick on the water,
 * thinning upward to a heaped top that rolls at three scales, in flat steps of translucency (no
 * screen door). Sizes in px of its plane's art (frame px at play zoom).
 */
export interface FogLayer {
  plane: PlaneId;
  /** Opacity on the water (0..1). */
  density: number;
  /** How high its banks heap above the waterline. */
  height: number;
  /** How far it lies out on the water in front of the waterline (default half its height). */
  apron?: number;
  /** How much its top heaps and sags, 0 (level) .. 1 (default 0.6); the banks' size (default 260). */
  roll?: number;
  size?: number;
  /** Its colour (default the haze). */
  colour?: string;
  /** Drift east, plane px a second (default 1.5). */
  drift?: number;
  /**
   * The share of its (rolling) height that lies solid on the water, thinning in steps above it
   * (default 0: none), so a thing wading in the bank dissolves into it rather than ending on a line.
   */
  foot?: number;
  /**
   * (round 5) Where its banks lie, so it is never one band across the whole lake: pools of fog
   * [plane px x, half width, strength 0..1.4] (thick at a karst's feet), and between them it
   * covers this share of the open water in torn patches (0: only the pools; 1, the default: the
   * whole width, as before). Pools stay put on the land; the fog inside them drifts.
   */
  pools?: [number, number, number][];
  cover?: number;
  /**
   * (round 6) Veils: torn streamers of the same fog floating in the air above the water (the
   * weather a far giant wades through): [plane px x (they drift with the fog), half width, height
   * of their middle above the waterline, thickness, strength 0..1, tear 0 (whole) .. 1 (rags),
   * how much of their top catches the sun 0..1, slope (rise per px, so none lies level)]. Each
   * wanders, swells and tears on its own.
   */
  veils?: [number, number, number, number, number, number, number, number][];
  /**
   * (round 6) Drawn behind its plane instead of over it: a bank of haze lying along the horizon
   * behind the plane's land (it swells behind the land's clusters by its pools and thins in the
   * gaps), never over the land's faces.
   */
  behind?: boolean;
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
  /** Driven from code (a bout's champion, Bao): the frame shown, its facing, hidden or not. */
  frame?: number;
  flip?: boolean;
  hidden?: boolean;
  /** Shown only once this world flag is set, `delay` ticks after it was set this visit (a bridge dropping across). */
  when?: string;
  delay?: number;
  /** Hidden once this world flag is set (the rolled bridge, once cut loose). */
  unless?: string;
  /** Share of its width shown, left to right on screen (an entrance assembling it); 1 = all. */
  reveal?: number;
  /** Flash toward white (0..1), a hit's one-frame flash. */
  white?: number;
  /**
   * Moves along its path only when its frame changes (a rendered walk cycle: the feet stay
   * planted between frames, as the render's ground speed per frame says).
   */
  stepMove?: boolean;
  /** Its own haze amount (0..1) instead of its plane's (a giant set deep in the distance). */
  fade?: number;
  /**
   * (round 5) Its haze thickening toward its foot in one continuous dithered falloff: over this
   * share of its height from the bottom, up to this haze at the waterline [share, haze] (a giant
   * wading far off in the fog lying on the water: no strata across its legs).
   */
  fadeFoot?: [number, number];
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
  /** Gone once this world flag is set (what it said no longer holds). */
  unless?: string;
  action:
    | {
        kind: "door"; to: string; title?: string;
        /** A shortcut that opens from one side (GDK B): the flag it needs, what it says until then. */
        needs?: string; closed?: string;
        /** Using it sets this flag (the lift's lower station opens the lift for good). */
        opens?: string;
      }
    | { kind: "panel"; panel: string; arg?: string }
    | { kind: "say"; text: string }
    /** Board a ropeway's car at this station: up its cable (1) or down it (-1). */
    | { kind: "ride"; ride: string; dir: 1 | -1 };
}

/**
 * A ropeway (GDK A.3, Shanshui's Silk Line): two cars on one cable, one at each station, that
 * pass each other on the way. She boards at a station and rides, controls held, to the other
 * end; the camera follows on the ride's own track (its flag `ride:<id>` is set meanwhile).
 */
export interface RideDef {
  id: string;
  /** The cable (or the flume's bed), world px, from the first station to the second (the car hangs from it). */
  pts: number[];
  /** Seconds from station to station. */
  secs: number;
  /** The cars' sprite ids (each is moved along the cable; `<id>:front` too if defined): two pass each other, one waits, none for a flume. */
  cars: string[];
  /** From the cable down to the car's floor, px (where she stands); 0 for a flume she rides herself. */
  hang: number;
  /** Rides only from its first station to its second (a flume, a kite); its car waits at the first again after. */
  oneWay?: boolean;
  /**
   * A slide (the bamboo flume): the speed follows the slope (H a second: min on the level, plus
   * gain for each unit of drop over run), building up and easing off, the whole ride still `secs`.
   */
  slide?: { min: number; gain: number };
  /** On arriving at the second station: a splash (into the basin at the flume's foot). */
  splash?: boolean;
  /** On arriving at the high station: a held Vista (zoom 1/2 on these, ended by moving) and a big title. */
  top?: {
    x: number; y: number; anchor: number; secs: number;
    /** Keep this world x at this share of the frame's width instead of centring x (any screen shape). */
    pin?: { x: number; at: number };
    /** The big title, and the most of the frame's width it may take (the rest stays clear of the station). */
    title?: string; titleFrac?: number;
    /** The plane the big title is written after (default "back": the forest's ranks stay behind it). */
    titleAfter?: PlaneId;
  };
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
  props: PropDef[];
  rides: RideDef[];
  charms: CharmDef[];
}

/**
 * A paper charm hung over a gap (GDK A.3, the Pillar Hop): Q within reach of one ahead of her
 * warps her to it, and she hangs from it a moment (a perch: she can jump, dash, or warp on to
 * the next one). Its sprite (same id) lights while it re-arms.
 */
export interface CharmDef {
  id: string;
  /** Where she takes hold of it (world px); her feet hang PERCH below. */
  x: number;
  y: number;
}

/**
 * Something that breaks (GDK 5.6, Appendix G): a prop on the play plane drawn by a painter.
 * Cosmetic props break and come back when she leaves; session ones stay broken until a
 * reload; permanent ones stay changed on this device; protected ones only go "tink".
 * The support rule: a prop standing on (or hanging from) another falls when that one goes.
 */
export interface PropDef {
  id: string;
  kind: string;
  p: Record<string, unknown>;
  /** Its anchor (feet, or the hook it hangs from), world px. */
  x: number;
  y: number;
  cls: "cosmetic" | "session" | "permanent" | "protected";
  material: "wood" | "stone" | "clay" | "paper" | "metal";
  /** Hits to break (1 by default). */
  hp?: number;
  /** The prop it stands on or hangs from. */
  on?: string;
  /** Hangs from its anchor (falls as a whole when its support goes). */
  hangs?: boolean;
  /** Pieces it breaks into (4 by default). */
  pieces?: number;
}

// The Chapel of Light's nave layout (lane R-E; WORLD-PLAN E3), as plain data so
// the backdrop (chapel.ts), the room (e3-chapel.ts) and the wall-set check
// (src/world/rooms/chapel/_tools/wallset-check.mjs) all read the same numbers.
// No imports: Node runs it as is (type stripping) for the check.

/** Pixels per H (the locked player height). */
export const P = 80;

/** The nave's layout in world H (WORLD-PLAN section 3 coordinates; E3 spans x 410..458, floor 40). */
export const NAVE = {
  x0: 410,
  x1: 458,
  top: 53.8,
  floor: 40,
  /** Feet at this share of the view (the rail row): the nave above the floor, the flags below. */
  anchor: 0.84,
  door: 412.3,
  roseHeight: 5.85,
  roseSize: 2.3,
  crank: 414.25,
  lectern: 416.7,
  piers: [418.9, 424.3, 429.7, 435.1, 440.5, 445.9],
  /** A pier's half-width at its widest (the base and the capital), H. */
  pierHalf: 0.55,
  /** Bays with a tapestry instead of an open arch (by pier index on their west side). */
  closed: [1, 3],
  easels: [421.6, 427.0, 432.4, 437.8, 443.2],
  niches: [447.6, 450.2, 452.8, 455.4],
  pews: [424.3, 429.7, 435.1, 440.5],
  racks: [419.9],
  look: 445.3,
  lookAt: 451.3,
  censer: 435.55,
  tapestries: [427.0, 437.8],
  /** Iron lanterns down the nave, hung beside each easel bay's aisle window (not across its glass). */
  lanterns: [422.95, 433.75, 444.55],
  floorRamp: ["#120e15", "#1b1620", "#261f2b", "#342a36", "#463945"],
};

/**
 * The side aisle's depth. Shallow on purpose: each aisle lancet is anchored to the centre of its
 * open arcade bay (it sits there when that bay is in the middle of the view) and drifts by
 * (1 - 1/depth) of the camera's travel from there, which at 1.12 keeps it inside its bay's
 * opening, clear of both piers, out to the widest frame (wallset-check.mjs proves it).
 */
export const AISLE_DEPTH = 1.12;

/** The aisle lancet: a two-light window with a mullion and an oculus, in aisle H above the aisle floor. */
export const LANCET = {
  /** The sill's top (the glass starts here): above the easel crowns (2.9 H on the nave floor). */
  sill: 2.85,
  /** Half-width of the whole opening, and of its splay and hood beyond it. */
  half: 0.5,
  splay: 0.06,
  hood: 0.07,
  /** The outer head: springing and the arc's radius factor. */
  spring: 4.4,
  k: 1.5,
  /** The aisle floor sits this far above the nave floor on screen (H). */
  floorLift: 0.28,
};

/** Room px from world H. */
export const RX = (wx: number): number => Math.round((wx - NAVE.x0) * P);

/** The open arcade bays: [west pier px, east pier px, centre px] in nave room px. */
export function openBays(): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (let i = 0; i < NAVE.piers.length - 1; i++) {
    if (NAVE.closed.includes(i)) continue;
    const a = RX(NAVE.piers[i]!), b = RX(NAVE.piers[i + 1]!);
    out.push([a, b, Math.round((a + b) / 2)]);
  }
  return out;
}

/**
 * Each aisle lancet's x in the aisle layer's own px (layer x + half its pan, as chapel.ts aisleBody
 * reads it): where the bay's centre falls when the camera centres that bay (camera x = c - 640).
 */
export function lancetXs(viewHalf = 640): number[] {
  return openBays().map(([, , c]) => Math.round(viewHalf + (c - viewHalf) / AISLE_DEPTH));
}

/** Half-width of the lancet with its splay and hood, px. */
export const LANCET_HALF_PX = Math.round((LANCET.half + LANCET.splay + LANCET.hood) * P);

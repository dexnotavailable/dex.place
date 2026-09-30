// D2 the Outer Climb (lane R-D; WORLD-PLAN section 4, D2): 40 x 45 H on the
// spire's face in the storm. The lift stops where lightning broke its rail
// (y 40) and you climb the outside: six flights zigzag up the face, each two
// machine housings of 0.8 H (single jumps) then 22 standard steps, between
// iron catwalks bolted to the spire. The storm alcove (shrine 4) is on the
// middle catwalk (y 58). The top catwalk leads on to the Crown.
//
// The storm: every 9 s a gust pushes you east along the catwalk you stand on
// at up to 0.5 H/s (the storm driver's gust decks). It stops short of each
// catwalk's 0.3 H lip or the next flight's machinery, so it can't push you
// off; the alcove is sheltered. The pennants snap and the rain leans about
// 1.4 s before each push. A fall lands on the catwalk below (never down the
// whole climb); off an open end, the gust fade returns you to the last safe
// ground. The traversal keeps the grey-box's proven route (the same rows,
// flights and x positions), so the round's timing holds.
//
// Collision is terrain (art "none"); what you see and hit is pixel matter:
// the catwalks and the landing (spireDeck), the flights (spireStair).

import { Spire, LIGHT, RAMP } from "./_build.ts";
import { climbScene } from "./_scenes/climb.ts";

const d2 = new Spire({
  id: "D2",
  title: "D2 Outer Climb",
  x0: 246,
  x1: 286,
  top: 82.5,
  bottom: 37.2,
  camera: { mode: "free", anchor: 0.7, lookY: 1.2 },
  audio: { music: "none", bed: "storm", weatherThrough: 1, surface: "wet-metal" },
  weather: { state: "rain", time: "day" },
  neighbours: ["D1", "D3"],
  lighting: LIGHT.storm,
  surface: "wet-metal",
  ramp: RAMP.iron,
  art: "none",
});
const H80 = 80;

// ---------------------------------------------------------------------------------
// The landing at the break (y 40): where the lift's gate lets you out. Both its ends carry the
// 0.3 H lip, so walking to either end stops you there instead of dropping you into the void.
d2.floor(248, 284, 40, 2.2);
d2.block(248, 248.22, 40.3, 39.8, { surface: "metal", art: "none" });
d2.block(283.78, 284, 40.3, 39.8, { surface: "metal", art: "none" });
d2.px("spireDeck", "landing", 248, 40, { width: 36 * H80, depth: 0.9, kind: "landing", lip: "both" });

/** A flight up from a catwalk at `y`, starting at x, going `dir`: two 0.8 H housings, then 22 steps to y + 6. */
const flight = (id: string, x: number, y: number, dir: 1 | -1): void => {
  const a = Math.min(x, x + dir * 1.2), b = Math.max(x, x + dir * 1.2);
  d2.block(a, b, y + 0.8, y - 0.15);
  const c = Math.min(x + dir * 1.2, x + dir * 2.4), e = Math.max(x + dir * 1.2, x + dir * 2.4);
  d2.block(c, e, y + 1.6, y - 0.15);
  d2.stairs(x + dir * 2.4, y + 1.6, y + 6, dir, y - 0.15);
  d2.px("spireStair", id, x, y, {}, { flip: dir < 0 });
};

/** A catwalk: a gust deck (collision and the push) and its iron (spireDeck). */
const catwalk = (id: string, x0: number, x1: number, y: number, o: { lipWest?: boolean; lipEast?: boolean; stopAt?: number; shelter?: [number, number][] }): void => {
  d2.deck(x0, x1, y, o);
  d2.px("spireDeck", id, x0, y, { width: (x1 - x0) * H80, depth: 0.42, kind: "catwalk", lip: o.lipEast ? "east" : o.lipWest ? "west" : "none" });
};

flight("flight-40", 272, 40, 1);
catwalk("walk-46", 254, 282, 46, { lipEast: true });
flight("flight-46", 262, 46, -1);
catwalk("walk-52", 252, 276, 52, { stopAt: 268 });
flight("flight-52", 268, 52, 1);
catwalk("walk-58", 252, 278, 58, { lipEast: true, shelter: [[261.4, 270.6]] });
// the storm alcove on row 58: a window cut into the spire, roofed
d2.block(261.6, 270.4, 61.9, 61.45);
flight("flight-58", 258, 58, -1);
catwalk("walk-64", 248, 272, 64, { lipWest: true, stopAt: 262 });
flight("flight-64", 262, 64, 1);
catwalk("walk-70", 250, 272, 70, { lipEast: true });
flight("flight-70", 260, 70, -1);
// the top catwalk: west to the Crown (its east end has the lip)
catwalk("walk-76", 246, 258, 76, { lipEast: true });

// a fall lands one or two rows down, never at the foot of the climb: past row 64's west lip
// (the only open end the storm doesn't blow toward) you're returned to the last safe ground
d2.pit(246, 246.9, 60);
d2.pit(246, 256, 38.5);

// ---------------------------------------------------------------------------------
// The storm (driver + gust decks, and its hand on the props), the lift gate, shrine 4.
d2.prop("spire-storm", "storm", 247, 80, { decks: d2.decks, strength: 1 }, { engine: "stub" });
d2.px("stormDirector", "storm-hand", 247, 80, { mode: "storm" });
d2.door("lift-gate-d2", "door", 267.2, 40, { room: "D1", spawn: "break" }, { kind: "gate", open: true, beyond: "dark", frame: "iron" }, { engine: "pixel" });
d2.px("spirePortal", "portal-lift", 267.2, 40, { kind: "gate" });

// shrine 4 (the storm alcove): the recess, lantern, donation box and plaque, bench, candles, the window
d2.px("stormAlcove", "alcove", 261.6, 58, { width: 8.8, height: 3.45 });
d2.px("shrineLantern", "shrine-4", 262.6, 58, { n: 4, flag: "shrine:4" });
d2.px("donationBox", "box-4", 264.0, 58, { dest: "donate" });
d2.px("donorPlaque", "plaque-4", 264.8, 58.95);
d2.px("bench", "bench-4", 266.6, 58, { kind: "stone", length: 1.4 });
d2.px("candelabra", "alcove-candelabra", 268.9, 58, { candles: 3, height: 1.15 });
d2.px("candles", "alcove-candles", 269.9, 58, { count: 4, layout: "cluster", stand: "none" });
d2.px("stormWindow", "alcove-glass", 265.6, 59.1, { width: 1.3, height: 2.1, drop: 88 });
d2.spawn("shrine", 261.8, 58, 1);
d2.area({ id: "D2-alcove", title: "D2 Storm Alcove", x0: 262, x1: 270, top: 61.4, bottom: 57.9, camera: { mode: "locked", anchor: 0.66 }, audio: { bed: "alcove", weatherThrough: 0.4 }, roofed: true });

// route marks: red pennants at the head of every flight (they snap ahead of each gust)
for (const [x, y] of [[270.6, 40], [263.4, 46], [266.6, 52], [259.4, 58], [260.6, 64], [261.4, 70], [256.6, 76]] as const) d2.px("clothHanging", `pennant-${x}`, x, y, { kind: "pennant", colour: "red" });

// lamp posts toward shrine 4: dark until shrine 3 is lit, then on one after another
for (const [i, x, y] of [[0, 256, 40], [1, 275, 46], [2, 256, 52], [3, 252.5, 64]] as const) d2.px("lampPost", `lamp-3-${i}`, x, y, { lit: false, shrine: 3, order: i, arm: 1 });

// warning lights on every lip (they quicken ahead of a gust), and by the lift gate
for (const [x, y, k] of [[281.89, 46.3, 0], [252.3, 52, 1], [277.89, 58.3, 2], [248.11, 64.3, 3], [271.89, 70.3, 4], [257.89, 76.3, 5]] as const) d2.px("warningLight", `beacon-${k}`, x, y, { mode: "blink", phase: k * 0.37 });
d2.px("warningLight", "beacon-gate", 269.3, 43.4, { mode: "blink", mount: "wall", phase: 0.2 });

// what earlier wardens left, and what the storm left
d2.px("brokenArmour", "armour-40", 258.5, 40, { pieces: ["pauldron", "greave"], slide: [-2.5, 2] });
d2.px("brokenArmour", "armour-52", 259, 52, { pieces: ["helm", "greave"], slide: [-2, 2] });
d2.px("brokenArmour", "armour-70", 266, 70, { pieces: ["helm", "pauldron"], slide: [-1.5, 1.5] });
d2.px("pillar", "fin-1", 250.2, 40, { kind: "broken", height: 1.1, width: 0.46, stone: "stoneDark" });
d2.px("pillar", "fin-2", 252.4, 40, { kind: "square", height: 1.5, width: 0.4, stone: "stoneDark" });
d2.px("puddle", "puddle-40", 262.2, 40, { width: 1.5, sky: "storm" });
d2.px("puddle", "puddle-46", 270.2, 46, { width: 1.1, sky: "storm" });
d2.px("puddle", "puddle-64", 256.4, 64, { width: 1.2, sky: "storm" });
d2.px("cable", "chain-58", 274.4, 57.58, { kind: "chain", free: true, length: 1.6, hook: true });
d2.px("cable", "chain-70", 267.4, 69.58, { kind: "chain", free: true, length: 1.2, hook: true });
// the lift's counterweight, hanging in its channel at the east edge
d2.px("counterweight", "counterweight", 284.9, 57, { mode: "hang", cable: 26 });

// the secret: off row 52's open west end (the gust blows the other way), a 2.8 H dash gap to a
// lone perch with a pennant and the view west over the void; a catch ledge 1 H below that reaches
// under row 52's end (a jump straight back up)
d2.ledge(247.3, 249.2, 52);
d2.px("spireDeck", "perch", 247.3, 52, { width: 1.9 * H80, depth: 0.36, kind: "catwalk", lip: "west" });
d2.block(247.3, 247.52, 52.3, 51.8);
d2.px("clothHanging", "pennant-lone", 247.9, 52, { kind: "pennant", colour: "red" });
d2.ledge(247.0, 252.6, 51);
d2.block(252.38, 252.6, 51.3, 50.8);
d2.px("spireDeck", "catch", 247.0, 51, { width: 5.6 * H80, depth: 0.3, kind: "catwalk", lip: "east" });
d2.vista(247.3, 249.2, 252, 55, 0.07, 53.5, 51.7);

d2.spawn("lift", 265.6, 40, -1).spawn("top", 246.8, 76, 1);
d2.exit("left", "D3", "west", 75.5, 78);

export const climb = d2.build(
  climbScene({ w: d2.W, h: d2.Ht, edgeBottom: d2.X(253.5), edgeTop: d2.X(257), channel: [d2.X(284.3), d2.X(285.5)], dry: [[d2.X(261.8), d2.Y(61.45), d2.X(270.2), d2.Y(57.9)]] }),
  { hide: ["wx-rain-far", "wx-rain-near"] },
);

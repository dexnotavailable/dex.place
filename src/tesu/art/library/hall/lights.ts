// The Hall of Works' light and the Prize Court's: one environment each, shared by every
// painter (static plates) and by the dressing that places the moving lights, so a lantern
// that hangs somewhere also lights the wall, the floor and the furniture around it.
//
// The hall (GDK A.3; round 1, Dex 10-14): the key is the Prize Court gate's daylight in the middle of
// the room; the skylight's shaft falls beside it; one pool per service (the desk, the box, the sponsors'
// board, the map, the nook); a little cool daylight at the front doors; the shell (ceiling, upper walls,
// end walls) carries no lamp at all.
// The court: a clear morning, the sun up and to the left (art bible: light = (-0.62, -0.78)).

import type { Light, LightEnv, PointLight } from "./kit.ts";

const H = 96;
const h = (n: number): number => Math.round(n * H);

/** The hall's frame of reference (mirrors world/sections/hall.ts; the dressing checks it). */
export const HALL = {
  x0: h(130),
  floor: h(292),
  gallery: h(292) - h(7.2),
};
const X = (o: number): number => HALL.x0 + h(o);
const FY = HALL.floor;
const GY = HALL.gallery;

/** The Prize Court gate's centre (H from the west end; mirrors hall.ts GATE_O). */
export const GATE_O = 17.85;

/** The skylight's shaft: from the roof (cropped) down to the floor in the clear wall between the desk and
 *  the gate, so the room's light gathers at its middle (round 1: it was in the left third; round 2: narrower and
 *  a little right, so it lands in the clear floor between the desk and the gate and never on the desk). */
export const SHAFT = { x0: X(14.4), y0: FY - h(18), x1: X(15.45), y1: FY, w: h(1.2), k: 0.95, pool: h(1.25) };

/** Hanging lanterns of the hall: [x in H from the hall's west wall, height of the lantern's middle above the
 *  floor in H, size, plane, strength, reach in H]. Ground-floor ones hang from the gallery's soffit, one over
 *  each service (its pool); upstairs ones hang between the art's groups. Nothing lights the shell. */
export interface HallLantern { o: number; y: number; kind: "round" | "tall" | "palace" | "drum"; plane: "back" | "play" | "front" | "near"; r: number; k: number; reach?: number }

export const HALL_LANTERNS: HallLantern[] = [
  // the ground floor: one lantern over each service, low enough to make its pool
  // (round 4, W1-b) the notice wall's and the sponsors' board's lanterns moved west with them (were 5.2, 8.4)
  { o: 5.0, y: 3.55, kind: "round", plane: "play", r: 0.85, k: 0.42, reach: 2.4 },
  { o: 8.15, y: 3.4, kind: "palace", plane: "play", r: 0.85, k: 0.45, reach: 2.2 },
  // (round 2, W1-5) the desk's lantern hangs low, so its pool lands on the counter and the floor in front
  // (round 3, W1-3) lower still, just off the counter's west end over the visitor's side: its pool on the counter's
  // top and front and the floor before it (was o 12.55, y 2.35)
  { o: 12.6, y: 1.6, kind: "palace", plane: "play", r: 0.85, k: 0.7, reach: 2.0 },
  // (round 4, W1-e: its pool ended ~0.5 H above the map, lighting empty wall) 0.95 H lower, so the pool lands on the
  // map's crest rail and the top of its face
  { o: 22.0, y: 2.15, kind: "round", plane: "play", r: 0.85, k: 0.48, reach: 2.2 },
  // upstairs, between the art's groups on the Long Gallery
  { o: 4.95, y: 9.9, kind: "tall", plane: "play", r: 0.9, k: 0.4, reach: 2.6 },
  { o: 10.1, y: 9.7, kind: "round", plane: "play", r: 0.95, k: 0.45, reach: 2.6 },
  { o: 20.68, y: 9.9, kind: "tall", plane: "play", r: 0.9, k: 0.4, reach: 2.4 },
];

/** Lanterns on the back plane (P3): small, low, under its gallery (x in H, world); none on the upper wall. */
export const BACK_LANTERNS: HallLantern[] = [
  { o: -2.5, y: 4.6, kind: "round", plane: "back", r: 0.9, k: 0.3 },
  { o: 5.9, y: 4.2, kind: "round", plane: "back", r: 0.9, k: 0.3 },
  { o: 12.9, y: 4.8, kind: "tall", plane: "back", r: 0.9, k: 0.28 },
  { o: 20.4, y: 4.4, kind: "round", plane: "back", r: 0.9, k: 0.3 },
  { o: 27.8, y: 4.6, kind: "palace", plane: "back", r: 0.9, k: 0.3 },
  { o: 35.2, y: 4.3, kind: "round", plane: "back", r: 0.9, k: 0.3 },
];

function lanternLights(list: HallLantern[], reach: number): PointLight[] {
  return list.map((l) => ({ kind: "point", x: X(l.o), y: FY - h(l.y), r: h(l.reach ?? reach) * l.r, k: l.k * 1.35 }));
}

/** The Prize Court gate's daylight: the room's key. A pool on the floor in front of the moon gate and the
 *  light pouring out of it (lights.ts is placement; the painters render it). */
export const GATE_LIGHTS: Light[] = [
  // (a "shaft" with no beam to speak of: only its pool on the floor, which lights the walkway's lip, the floor
  // and whatever stands in front of the gate; its beam is a hair-thin line far off along the floor)
  { kind: "shaft", x0: X(GATE_O) - h(60), y0: FY - 1, x1: X(GATE_O), y1: FY, w: 2, k: 1.35, pool: h(2.7) },
  { kind: "point", x: X(GATE_O), y: FY - h(1.0), r: h(3.2), k: 0.8 },
];

/** One lamp per service: the pools that make each one read on its own (desk, box, board, map, nook...). */
export const SERVICE_LAMPS: PointLight[] = [
  // the notice wall's own lamp
  { kind: "point", x: X(5.0), y: FY - h(1.9), r: h(1.9), k: 0.45 },
  // the sponsors' board: the lantern hanging over its head
  { kind: "point", x: X(8.15), y: FY - h(2.6), r: h(1.9), k: 0.75 },
  // the offering box: its own lantern on a bracket off the west post of its frame (round 2)
  // (round 2, W2-7) hung a little lower on its bracket, so it lights the chest's lid and front and the plinth
  // (round 3, W1-3) the bracket reaches in over the chest's west end now: the pool lands on the chest, not the post
  // (round 4, W1-b) the chest 1.15 H wide from 10.22 H, the lantern under its frame's sign at 10.6 H / 0.95 H
  { kind: "point", x: X(10.6), y: FY - h(0.95), r: h(1.5), k: 1.0 },
  // the register desk: its desk lamp at the visitor's end
  // (round 4, W1-a) the counter is 12.7-15.1 H now; the desk lamp at its west end
  { kind: "point", x: X(12.85), y: FY - h(0.8), r: h(1.7), k: 0.95 },
  // (round 3, W1-3) and the paper lantern on the pigeonhole cabinet's east shoulder (services.ts desk)
  // (round 4, W1-a) the cabinet's shoulder lantern is gone (it hung right under the signboard's east lantern); the two
  // paper lanterns under the register's signboard's ends light the board's rail and gold, the cabinet and the counter's
  // east half where the queue stands (signboard.ts; the board is 1.75 H wide over Hanko at 13.8 H, its lower edge 2.45 H up)
  { kind: "point", x: X(13.02), y: FY - h(2.29), r: h(1.45), k: 0.65 },
  { kind: "point", x: X(14.58), y: FY - h(2.29), r: h(1.45), k: 0.7 },
  // the map's lamp
  { kind: "point", x: X(22.0), y: FY - h(1.55), r: h(1.7), k: 0.7 },
  // the nook: the standing lamp between the shelf and the bench (round 3: at 26.3 H, by the landing's west post)
  { kind: "point", x: X(26.3), y: FY - h(1.2), r: h(2.1), k: 1.0 },
  // the Crane Desk's candle (round 3: the desk is under the stair's open lower flight, 29.6-31.0 H)
  { kind: "point", x: X(30.4), y: FY - h(0.8), r: h(1.4), k: 0.6 },
  // upstairs: a picture lamp over each group of the art, and one at the Request Board
  // (round 3, W1-6: the pair hangs 0.45 H higher; its picture lamp with it)
  { kind: "point", x: X(7.1), y: GY - h(2.8), r: h(2.1), k: 0.6 },
  { kind: "point", x: X(12.4), y: GY - h(2.7), r: h(2.4), k: 0.75 },
  { kind: "point", x: X(17.8), y: GY - h(2.9), r: h(2.9), k: 0.62 },
  { kind: "point", x: X(21.35), y: GY - h(2.1), r: h(1.6), k: 0.5 },
];

/** The stone lantern on the stair landing's east newel (round 2): it lights the landing and both flights.
 *  (Round 3: the landing is deep and lower, 26.5-29.0 H at 2.9 H; its east newel at 28.92 H.) */
export const STAIR_LANTERN: PointLight = { kind: "point", x: X(28.92), y: FY - h(4.02), r: h(2.0), k: 0.55 };

/** The hall's light: dark shell, the gate's daylight the key, the shaft beside it, a pool per service. */
export const HALL_LIGHT: LightEnv = {
  ambient: 0.2,
  dir: [-0.5, -0.86],
  lights: [
    { kind: "shaft", ...SHAFT },
    ...GATE_LIGHTS,
    ...lanternLights(HALL_LANTERNS, 4.2),
    ...lanternLights(BACK_LANTERNS, 3.0),
    ...SERVICE_LAMPS,
    STAIR_LANTERN,
    // cool daylight round the front doors, low
    { kind: "point", x: X(1.55), y: FY - h(1.2), r: h(2.6), k: 0.38 },
  ],
};

/** The hall's light without the gate's: for the wall the gate is cut in (light coming out of an opening
 *  lights what stands in front of it, never the wall face round it). */
export const HALL_LIGHT_NO_GATE: LightEnv = { ...HALL_LIGHT, lights: HALL_LIGHT.lights.filter((l) => !GATE_LIGHTS.includes(l)) };

/** The court: a clear morning, lit from the upper left. */
export const COURT_LIGHT: LightEnv = {
  ambient: 0.92,
  dir: [-0.62, -0.78],
  lights: [],
};

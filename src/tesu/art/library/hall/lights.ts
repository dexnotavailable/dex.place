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
 *  the gate, so the room's light gathers at its middle (round 1: it was in the left third). */
export const SHAFT = { x0: X(14.0), y0: FY - h(18), x1: X(15.35), y1: FY, w: h(1.7), k: 0.95, pool: h(1.7) };

/** Hanging lanterns of the hall: [x in H from the hall's west wall, height of the lantern's middle above the
 *  floor in H, size, plane, strength, reach in H]. Ground-floor ones hang from the gallery's soffit, one over
 *  each service (its pool); upstairs ones hang between the art's groups. Nothing lights the shell. */
export interface HallLantern { o: number; y: number; kind: "round" | "tall" | "palace" | "drum"; plane: "back" | "play" | "front" | "near"; r: number; k: number; reach?: number }

export const HALL_LANTERNS: HallLantern[] = [
  // the ground floor: one lantern over each service, low enough to make its pool
  { o: 5.2, y: 3.55, kind: "round", plane: "play", r: 0.85, k: 0.42, reach: 2.4 },
  { o: 8.4, y: 3.4, kind: "palace", plane: "play", r: 0.85, k: 0.45, reach: 2.2 },
  { o: 13.2, y: 3.15, kind: "palace", plane: "play", r: 0.9, k: 0.5, reach: 2.3 },
  { o: 22.0, y: 3.1, kind: "round", plane: "play", r: 0.85, k: 0.48, reach: 2.2 },
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
  { kind: "point", x: X(5.2), y: FY - h(1.9), r: h(1.9), k: 0.45 },
  // the sponsors' board: the lantern hanging over its head
  { kind: "point", x: X(8.4), y: FY - h(2.6), r: h(1.9), k: 0.75 },
  // the offering box: the candle lantern on its lid
  { kind: "point", x: X(11.1), y: FY - h(0.7), r: h(1.35), k: 0.85 },
  // the register desk: its desk lamp at the visitor's end
  { kind: "point", x: X(12.9), y: FY - h(0.8), r: h(1.7), k: 0.95 },
  // the map's lamp
  { kind: "point", x: X(22.0), y: FY - h(1.55), r: h(1.7), k: 0.7 },
  // the nook: the standing lamp between the shelf and the bench
  { kind: "point", x: X(26.25), y: FY - h(1.2), r: h(2.1), k: 1.0 },
  // the Crane Desk's candle
  { kind: "point", x: X(31.5), y: FY - h(0.8), r: h(1.4), k: 0.6 },
  // upstairs: a picture lamp over each group of the art, and one at the Request Board
  { kind: "point", x: X(7.1), y: GY - h(2.35), r: h(2.1), k: 0.6 },
  { kind: "point", x: X(12.4), y: GY - h(2.7), r: h(2.4), k: 0.75 },
  { kind: "point", x: X(17.8), y: GY - h(2.9), r: h(2.9), k: 0.62 },
  { kind: "point", x: X(21.35), y: GY - h(2.1), r: h(1.6), k: 0.5 },
];

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

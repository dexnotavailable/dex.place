// The Hall of Works' light and the Prize Court's: one environment each, shared by every
// painter (static plates) and by the dressing that places the moving lights, so a lantern
// that hangs somewhere also lights the wall, the floor and the furniture around it.
//
// The hall (GDK A.3): one key light, the skylight's shaft over the Crane Desk, slanting down
// from the upper left; warm lantern fill; cool daylight round both doors; a lamp in the nook.
// The court: a clear morning, the sun up and to the left (art bible: light = (-0.62, -0.78)).

import type { LightEnv, PointLight } from "./kit.ts";

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

/** The skylight's shaft: from the roof (cropped) down to the floor beside the Crane Desk. */
export const SHAFT = { x0: X(12.0), y0: FY - h(18), x1: X(15.3), y1: FY, w: h(2.6), k: 1.3, pool: h(3.0) };

/** Hanging lanterns of the hall: [x in H from the hall's west wall, height of the lantern's middle above the floor in H, size, plane]. */
export interface HallLantern { o: number; y: number; kind: "round" | "tall" | "palace" | "drum"; plane: "back" | "play" | "front" | "near"; r: number; k: number }

export const HALL_LANTERNS: HallLantern[] = [
  // the ground floor's run of lanterns under the gallery, at head height and above
  { o: 3.6, y: 5.0, kind: "palace", plane: "play", r: 1, k: 0.55 },
  { o: 9.6, y: 5.3, kind: "round", plane: "play", r: 1, k: 0.5 },
  { o: 19.0, y: 5.6, kind: "palace", plane: "play", r: 1, k: 0.55 },
  { o: 6.4, y: 5.9, kind: "tall", plane: "play", r: 0.9, k: 0.4 },
  { o: 16.4, y: 6.0, kind: "round", plane: "play", r: 0.85, k: 0.4 },
  { o: 21.3, y: 5.2, kind: "round", plane: "play", r: 0.9, k: 0.45 },
  // the double-height end by the stair and the great doors
  { o: 26.2, y: 9.4, kind: "drum", plane: "play", r: 1.25, k: 0.6 },
  { o: 31.8, y: 6.4, kind: "palace", plane: "play", r: 1.1, k: 0.6 },
  { o: 28.6, y: 12.0, kind: "round", plane: "play", r: 1.2, k: 0.45 },
  { o: 24.0, y: 13.4, kind: "tall", plane: "play", r: 1.1, k: 0.4 },
  // upstairs, over the Long Gallery
  { o: 5.5, y: 12.4, kind: "tall", plane: "play", r: 1, k: 0.45 },
  { o: 10.4, y: 12.0, kind: "round", plane: "play", r: 1.1, k: 0.45 },
  { o: 17.6, y: 12.6, kind: "tall", plane: "play", r: 1, k: 0.45 },
  { o: 21.6, y: 12.2, kind: "round", plane: "play", r: 1, k: 0.45 },
];

/** Lanterns on the back plane (P3): smaller, many, at many heights (x in H, world). */
export const BACK_LANTERNS: HallLantern[] = [
  { o: -2.5, y: 4.6, kind: "round", plane: "back", r: 0.9, k: 0.35 },
  { o: 1.6, y: 9.8, kind: "tall", plane: "back", r: 0.9, k: 0.3 },
  { o: 5.9, y: 4.2, kind: "round", plane: "back", r: 0.9, k: 0.35 },
  { o: 8.2, y: 10.6, kind: "palace", plane: "back", r: 0.9, k: 0.3 },
  { o: 12.9, y: 4.8, kind: "tall", plane: "back", r: 0.9, k: 0.35 },
  { o: 15.7, y: 9.6, kind: "round", plane: "back", r: 0.9, k: 0.3 },
  { o: 20.4, y: 4.4, kind: "round", plane: "back", r: 0.9, k: 0.35 },
  { o: 23.6, y: 10.4, kind: "tall", plane: "back", r: 0.9, k: 0.3 },
  { o: 27.8, y: 4.6, kind: "palace", plane: "back", r: 0.9, k: 0.35 },
  { o: 30.9, y: 9.9, kind: "round", plane: "back", r: 0.9, k: 0.3 },
  { o: 35.2, y: 4.3, kind: "round", plane: "back", r: 0.9, k: 0.35 },
];

function lanternLights(list: HallLantern[], reach: number): PointLight[] {
  return list.map((l) => ({ kind: "point", x: X(l.o), y: FY - h(l.y), r: h(reach) * l.r, k: l.k * 1.35 }));
}

/** The hall's light: dark and warm, the shaft the one strong key. */
export const HALL_LIGHT: LightEnv = {
  ambient: 0.2,
  dir: [-0.5, -0.86],
  lights: [
    { kind: "shaft", ...SHAFT },
    ...lanternLights(HALL_LANTERNS, 4.2),
    ...lanternLights(BACK_LANTERNS, 3.2),
    // daylight round the front doors and the great doors (cool, low, spilling onto the floor)
    { kind: "point", x: X(1.85), y: FY - h(1.6), r: h(3.2), k: 0.42 },
    { kind: "point", x: X(32.15), y: FY - h(1.8), r: h(3.6), k: 0.5 },
    // the nook's lamp under the stair
    { kind: "point", x: X(25.2), y: FY - h(1.4), r: h(2.4), k: 0.55 },
  ],
};

/** The court: a clear morning, lit from the upper left. */
export const COURT_LIGHT: LightEnv = {
  ambient: 0.92,
  dir: [-0.62, -0.78],
  lights: [],
};

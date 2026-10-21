// The Hall of Works (GDK A.3, "Frame, hall"): indoors grand, about two screens wide and
// two and a half tall, entered through the palace's red doors (a scene cut). Laid out round
// its middle (Dex 10-14): the Prize Court gate, a moon gate in the back wall with the court's
// daylight in it, stands at the middle; Hanko's register desk right beside it on the left, the
// map of Tesu on its right. Out from there, left: the main offering box, the sponsors' board,
// the Notice Wall, the front doors; right: the reading nook under the stair with the docs shelf
// and Seo, then the Crane Desk under the stair's lower flight. Upstairs, the Long Gallery: the shuttered
// Teahouse, the emperor's art in three groups on display screens, a small offering box, the
// Request Board by the stair's head. Readability rules beat depth: every usable thing stands
// on the walk line with 1.5 H or more of clear wall between, sized to her (charScale 0.88).
//
// Interiors live in the world's band below the land (config INTERIOR_Y).

import { h } from "../../config.ts";
import type { WorldBuilder } from "../build.ts";
import { GALLERY_PIECES } from "./hall-art.ts";
import { dressHall } from "../../art/library/hall/dress.ts";

export const HALL_X0 = h(130);
export const HALL_W = h(34);
export const HALL_X1 = HALL_X0 + HALL_W;
/** The ground floor and the Long Gallery's floor. */
export const HALL_FLOOR = h(292);
export const GALLERY_Y = HALL_FLOOR - h(7.2);

const X = (o: number): number => HALL_X0 + h(o);
/** The Prize Court gate's centre (H from the west end: 0.525 of the hall). */
export const GATE_O = 17.85;
/**
 * The stair's landing: [x0, x1, height above the floor] (H). Its two posts frame the reading nook under it.
 * (Round 3, W1-1, Dex 10-19 "fix the obvious triangle shape": a deep landing, 2.5 H, between a steep upper flight
 * (1.05) and a gentle lower one (0.7), so the stair turns at an elbow instead of drawing one hypotenuse.)
 */
export const STAIR_LANDING: [number, number, number] = [26.5, 29.0, 2.9];
/** The stair's foot (H): the gentle lower flight comes down to it near the east wall. */
export const STAIR_FOOT = 33.0;
/** The register desk's counter top above the floor (px): at her waist (she is ~0.98 H at charScale 0.88). */
export const DESK_TOP = h(0.57);
/**
 * The Long Gallery's hang (Dex's art upstairs), in three groups: [piece, centre H, max width H, max height H,
 * the frame's lower edge above the gallery floor H]. A pair of landscapes; the hero; a salon of five.
 * (Round 2, W1-6: hung high on the screens, every lower edge at 1.95 H or more over the gallery floor, so from
 * the ground floor at play zoom the frame's top edge cuts only the balustrade and the screens, never a picture;
 * upstairs they hang at the frame's middle. The lower edges step, so the hang has a rhythm in y too.)
 */
// (Round 3, W1-6: the eight lower edges still sat on one line, y 665-690 in the gallery frame: the pair now hangs
// 0.45 H higher than the hero, so the three groups step in y as well as x: the pair high, the hero low, the salon
// stacked. Sizes unchanged, so pixelize_art.py needs no re-run.)
export const GALLERY_HANG: [number, number, number, number, number][] = [
  [0, 6.3, 1.45, 1.0, 2.45], [1, 7.95, 1.45, 1.0, 2.62],
  [2, 12.4, 2.5, 1.6, 1.95],
  [5, 16.0, 1.3, 1.6, 2.35], [3, 17.4, 1.15, 0.7, 2.85], [4, 17.4, 1.15, 0.7, 1.95], [7, 18.75, 1.0, 1.45, 2.12], [8, 19.85, 1.0, 1.3, 2.4],
];
// (Round 4, W1-j: the hero's and the salon's lower edges still sat on one line, y 665-685) the salon's tall portrait
// 0.3 H higher and its last piece 0.42 H higher, so the salon steps 2.35 / 1.95 / 2.12 / 2.4 against the hero's 1.95
// (nothing lower than 1.95 H: from the ground floor the frame's top still cuts no picture). Sizes unchanged.
/** The display screens the groups hang on upstairs: [x0, x1, height above the gallery floor] (H). */
export const GALLERY_SCREENS: [number, number, number][] = [[5.3, 8.95, 2.15], [10.85, 13.95, 2.5], [15.05, 20.55, 2.75]];

/**
 * Hangs gallery piece i with its frame's centre at x and its lower edge at y: as wide as
 * `w` allows, no taller than `maxH`, in the piece's own proportions.
 */
function frameSize(i: number, w: number, maxH: number): [number, number] {
  const g = GALLERY_PIECES[i]!;
  let fw = w, fh = (w * g.height) / g.width;
  if (fh > maxH) { fh = maxH; fw = (maxH * g.width) / g.height; }
  return [Math.round(fw), Math.round(fh)];
}

/** The area she uses a frame from (it reaches down to the floor she stands on). */
function useBox(i: number, x: number, y: number, w: number, maxH: number): { x0: number; y0: number; x1: number; y1: number } {
  const [fw, fh] = frameSize(i, w, maxH);
  return { x0: x - Math.max(fw / 2, h(0.5)), y0: y - fh - h(0.3), x1: x + Math.max(fw / 2, h(0.5)), y1: y + h(2.4) };
}

function hang(b: WorldBuilder, i: number, x: number, y: number, w: number, maxH = h(1.6), use = useBox(i, x, y, w, maxH)): void {
  const g = GALLERY_PIECES[i];
  if (!g) return;
  const [fw, fh] = frameSize(i, w, maxH);
  b.sprite({ id: `art-${g.id}`, plane: "play", kind: "image", x, y, p: { src: `/gallery/${g.id}-t.webp`, w: fw, h: fh }, frames: 1 });
  b.usable({ id: `art-frame-${g.id}`, ...use, label: "look at the piece", action: { kind: "panel", panel: "art", arg: g.id } });
}

export function hall(b: WorldBuilder): void {
  const FY = HALL_FLOOR, GY = GALLERY_Y;
  // --- the room's look (walls, floors, gallery, stair, lanterns, light, furniture) is env-hall's
  // dressing, placed at the end from the positions below (art/library/hall)

  // --- collision: the floor, the gallery, the stair, the end walls
  b.walk([X(0), FY, X(34), FY], { surface: "wood", depth: h(3), name: "hall-floor" });
  b.walk([X(2.6), GY, X(22.8), GY], { surface: "wood", oneWay: true, depth: h(0.3), name: "long-gallery" });
  // the stair from the gallery's east end: two flights and a landing on posts (round 2, Dex 10-19: no one long
  // triangle); each flight no steeper than she walks (PHYSICS.maxSlope 1.05), the nook under the landing
  b.walk([X(22.4), GY, X(STAIR_LANDING[0]), FY - h(STAIR_LANDING[2]), X(STAIR_LANDING[1]), FY - h(STAIR_LANDING[2]), X(STAIR_FOOT), FY - h(0.1)], { surface: "wood", stair: true, depth: h(0.2), name: "hall-stair" });
  b.wall({ x: X(0.4), y0: FY - h(20), y1: FY + h(0.1), reason: "wall" });
  b.wall({ x: X(33.6), y0: FY - h(20), y1: FY + h(0.1), reason: "wall" });
  b.wall({ x: X(2.6), y0: GY - h(4), y1: GY + h(0.1), reason: "wall", from: "right" });

  // --- the ground floor, left to right (Dex 10-14: the Prize Court door in the MIDDLE, reception right
  // beside it on the left, the world map on its right; the other services spaced so each one reads on
  // its own: 1.5 H or more of clear wall between any two silhouettes; sized to her at charScale 0.88)
  b.usable({ id: "hall-front-doors", x0: X(0.75), y0: FY - h(2.1), x1: X(2.35), y1: FY, label: "go out", action: { kind: "door", to: "hall-door" } });
  b.usable({ id: "notice-wall", x0: X(4.05), y0: FY - h(2.3), x1: X(6.0), y1: FY, label: "read the notices", action: { kind: "panel", panel: "notice" } });
  b.usable({ id: "patrons", x0: X(7.45), y0: FY - h(2.3), x1: X(8.85), y1: FY, label: "the sponsors' board", action: { kind: "panel", panel: "patrons" } });
  // (round 2) its prompt shows between the chest's top (0.53 H) and the hanging sign over it
  // (round 3, W1-3) the chest's art stands 0.18 H in from the usable's west end (dress.ts), so she uses it from the west
  // with a clear gap between her and the pavilion's post (from the east she merged with the chest's end, the post and
  // the bay column's base)
  // (round 4, W1-b) the notice wall, the sponsors' board and the box each 0.2-0.25 H west (the gallery post between the
  // notice wall and the board with them, dress.ts), so the bay between that post and the bay's west column (11.95 H)
  // holds a chest about 1.2 H wide whose plinth still clears the column's base by a visible gap
  b.usable({ id: "offering-box", x0: X(10.25), y0: FY - h(0.8), x1: X(11.05), y1: FY, label: "the offering box", action: { kind: "panel", panel: "donate" } });
  // Hanko behind her desk (anchored at the counter top: she stands behind it, the counter at her waist)
  // (round 4, W1-a) the counter 2.4 H long (was 1.8: it lost to the gate in its own frame); Hanko behind its middle,
  // the visitor's end on the west, a queue of two ambient patrons at its east end (dress.ts)
  b.sprite({ id: "hanko", plane: "play", kind: "hanko", x: X(13.8), y: FY - DESK_TOP + 4, p: {}, frames: 4, fps: 1.2 });
  b.usable({ id: "hanko-desk", x0: X(12.7), y0: FY - h(1.6), x1: X(15.1), y1: FY, label: "talk to Hanko", action: { kind: "panel", panel: "hanko" } });
  // the Prize Court: a moon gate in the back wall's middle bay, daylight and the court beyond it
  b.usable({ id: "great-doors", x0: X(GATE_O - 1.1), y0: FY - h(3.1), x1: X(GATE_O + 1.1), y1: FY, label: "the Prize Court", action: { kind: "door", to: "court-gate" } });
  b.usable({ id: "map-pillar", x0: X(21.15), y0: FY - h(1.3), x1: X(22.85), y1: FY, label: "the map", action: { kind: "say", text: "The map of Tesu: the coast and the lake, the gate road climbing to the palace, the court lit at its end." } });
  // the reading nook under the stair: the docs shelf, a bench and a side table, Seo's spot on the bench
  b.usable({ id: "docs-shelf", x0: X(24.35), y0: FY - h(2.0), x1: X(27.85), y1: FY, label: "the docs shelf", action: { kind: "panel", panel: "docs" } });
  // (round 3) Seo's bench, the side table and the cat under the deep landing (its posts at 26.58 and 28.92 H)
  b.sprite({ id: "seo", plane: "play", kind: "seo", x: X(27.17), y: FY, p: {}, frames: 3, fps: 0.7 });
  // the Crane Desk: (round 3) tucked under the stair's open lower flight, a clerk's desk in the stair's lee
  b.usable({ id: "crane-desk", x0: X(29.6), y0: FY - h(1.0), x1: X(31.0), y1: FY, label: "the Crane Desk", action: { kind: "panel", panel: "crane" } });
  // one of the emperor's pieces downstairs: art-07 over the nook's bench, on the stair's spandrel
  hang(b, 6, X(27.17), FY - h(1.15), h(0.6), h(0.8));
  b.sprite({ id: "hall-cat", plane: "play", kind: "cat", x: X(28.55), y: FY - h(0.05), p: {}, frames: 2, fps: 0.6 });

  // --- the Long Gallery upstairs: the Teahouse, the art in three groups on display screens (a pair, the
  // hero piece, a salon of five), a small offering box between the first two, the Request Board by the
  // stair's head
  b.usable({ id: "teahouse", x0: X(2.9), y0: GY - h(2.2), x1: X(4.7), y1: GY, label: "the Teahouse", action: { kind: "say", text: "The Teahouse, shuttered. It opens later." } });
  for (const [gi, at, w, maxH, lift] of GALLERY_HANG) hang(b, gi, X(at), GY - h(lift), h(w), h(maxH));
  b.usable({ id: "offering-box-small", x0: X(9.75), y0: GY - h(1.3), x1: X(10.45), y1: GY, label: "the small offering box", action: { kind: "panel", panel: "donate" } });
  b.usable({ id: "request-board", x0: X(20.75), y0: GY - h(1.7), x1: X(21.95), y1: GY, label: "the Request Board", action: { kind: "say", text: "Pins, hooks and one slip: \"Requests open later.\"" } });

  // --- spawns, the place, the camera
  b.spawn({ id: "hall-in", x: X(3.35), y: FY, facing: 1 });
  b.spawn({ id: "hall-court-side", x: X(GATE_O + 0.45), y: FY, facing: -1 });
  // where each website section's link stands her (GDK 3.7): the blog at the Notice Wall, donate
  // (and support, account) at Hanko's desk, the docs in the reading nook, the gallery upstairs
  b.spawn({ id: "hall-notice", x: X(3.85), y: FY, facing: 1 });
  b.spawn({ id: "hall-desk", x: X(12.4), y: FY, facing: 1 });
  b.spawn({ id: "hall-nook", x: X(24.0), y: FY, facing: 1 });
  b.spawn({ id: "hall-gallery", x: X(12), y: GY, facing: 1 });
  b.place({ id: "hall-of-works", name: "Hall of Works", x0: HALL_X0, x1: HALL_X1, y0: FY - h(20), y1: FY + h(5), title: "place", spawn: "hall-in", vista: FY - h(2.4) });
  // the frame's edges stay inside the hall's end walls (env-hall, approved): at the doors she
  // walks toward the frame's edge, the usual room convention
  b.track({ id: "hall", x0: HALL_X0 - h(10), x1: HALL_X1 + h(10), y0: FY - h(30), y1: FY + h(10), bounds: [X(0.4), X(33.6)], keys: [
    { x: HALL_X0, zoom: 1, anchor: 0.8, horizon: 0.42, lead: 0.05 },
    { x: HALL_X1, zoom: 1, anchor: 0.8, horizon: 0.42, lead: 0.05 },
  ] });

  // --- env-hall's dressing: every visible thing in the room, read from the layout above
  dressHall(b);
}

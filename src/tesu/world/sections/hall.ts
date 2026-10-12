// The Hall of Works (GDK A.3, "Frame, hall"): indoors grand, about two screens wide and
// two and a half tall, entered through the palace's red doors (a scene cut). Left to right
// on the ground floor: the doors; the Notice Wall just inside; Hanko's desk with the main
// offering box, the patrons' scroll beside it and the Crane Desk under the skylight; the
// central pillar with the map on its cord; the Request Board; the reading nook under the
// stairs with the docs shelf and Seo; the great doors to the court. Upstairs, the Long
// Gallery: the shuttered Teahouse, the emperor's art in frames, a small offering box, the
// commissions brush stand. Readability rules beat depth: every usable thing stands on the
// walk line, and the clutter lives on the back planes.
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
  b.walk([X(22.4), GY, X(30), FY - h(0.1)], { surface: "wood", stair: true, depth: h(0.2), name: "hall-stair" });
  b.wall({ x: X(0.4), y0: FY - h(20), y1: FY + h(0.1), reason: "wall" });
  b.wall({ x: X(33.6), y0: FY - h(20), y1: FY + h(0.1), reason: "wall" });
  b.wall({ x: X(2.6), y0: GY - h(4), y1: GY + h(0.1), reason: "wall", from: "right" });

  // --- the ground floor, left to right
  b.usable({ id: "hall-front-doors", x0: X(0.7), y0: FY - h(3.7), x1: X(3.0), y1: FY, label: "go out", action: { kind: "door", to: "hall-door" } });
  b.usable({ id: "notice-wall", x0: X(4.6), y0: FY - h(3.4), x1: X(8.0), y1: FY, label: "read the notices", action: { kind: "panel", panel: "notice" } });
  b.usable({ id: "patrons", x0: X(9.0), y0: FY - h(4.4), x1: X(10.2), y1: FY, label: "the hanging scroll", action: { kind: "panel", panel: "patrons" } });
  b.sprite({ id: "hanko", plane: "play", kind: "hanko", x: X(11.6), y: FY - h(1.15) + 4, p: {}, frames: 4, fps: 1.2 });
  b.usable({ id: "hanko-desk", x0: X(10.4), y0: FY - h(1.6), x1: X(12.6), y1: FY, label: "talk to Hanko", action: { kind: "panel", panel: "hanko" } });
  b.usable({ id: "offering-box", x0: X(12.6), y0: FY - h(2.2), x1: X(13.6), y1: FY, label: "the offering box", action: { kind: "panel", panel: "donate" } });
  b.usable({ id: "crane-desk", x0: X(14.4), y0: FY - h(1.4), x1: X(16.0), y1: FY, label: "the Crane Desk", action: { kind: "panel", panel: "crane" } });
  b.usable({ id: "map-pillar", x0: X(17.2), y0: FY - h(2.4), x1: X(18.8), y1: FY, label: "the map", action: { kind: "say", text: "The land's map, rolled tight on its cord. One cut and it would unroll." } });
  b.usable({ id: "request-board", x0: X(19.6), y0: FY - h(2.6), x1: X(21.3), y1: FY, label: "the Request Board", action: { kind: "say", text: "Pins, hooks and one slip: \"Requests open later.\"" } });
  // the reading nook under the stair: the docs shelf, Seo, a lamp
  b.sprite({ id: "seo", plane: "play", kind: "seo", x: X(25.6), y: FY, p: {}, frames: 3, fps: 0.7 });
  b.usable({ id: "docs-shelf", x0: X(22.6), y0: FY - h(3.4), x1: X(26.2), y1: FY, label: "the docs shelf", action: { kind: "panel", panel: "docs" } });
  // two of the emperor's pieces between the nook and the great doors
  // (env-hall, approved: art-07 on the nook's spandrel panel under the stair, its usable where
  // it was; art-08 on the great doors' wall just left of the doors)
  hang(b, 6, X(27.0), FY - h(1.15), h(0.75), h(0.95), useBox(6, X(27.4), FY - h(2.0), h(1.5), h(1.6)));
  hang(b, 7, X(30.45), FY - h(1.6), h(0.8), h(1.5));
  b.usable({ id: "great-doors", x0: X(30.9), y0: FY - h(4.2), x1: X(33.4), y1: FY, label: "the great doors", action: { kind: "door", to: "court-gate" } });
  b.sprite({ id: "hall-cat", plane: "play", kind: "cat", x: X(7.4), y: FY - h(0.05), p: {}, frames: 2, fps: 0.6 });

  // --- the Long Gallery upstairs
  b.usable({ id: "teahouse", x0: X(2.9), y0: GY - h(2.6), x1: X(4.7), y1: GY, label: "the Teahouse", action: { kind: "say", text: "The Teahouse, shuttered. It opens later." } });
  // seven frames upstairs hold the other pieces, each in a frame of its own shape
  const slots = [6.2, 8.9, 11.6, 14.2, 16.8, 19.0, 21.0];
  const upstairs = GALLERY_PIECES.map((_, i) => i).filter((i) => i !== 6 && i !== 7);
  upstairs.forEach((gi, k) => {
    const at = slots[k];
    if (at === undefined) return;
    hang(b, gi, X(at), GY - h(1.1), h(1.9), h(1.7));
  });
  b.usable({ id: "offering-box-small", x0: X(21.8), y0: GY - h(1.3), x1: X(22.6), y1: GY, label: "the small offering box", action: { kind: "panel", panel: "donate" } });

  // --- spawns, the place, the camera
  b.spawn({ id: "hall-in", x: X(3.6), y: FY, facing: 1 });
  b.spawn({ id: "hall-court-side", x: X(30.2), y: FY, facing: -1 });
  // where each website section's link stands her (GDK 3.7): the blog at the Notice Wall, donate
  // (and support, account) at Hanko's desk, the docs in the reading nook, the gallery upstairs
  b.spawn({ id: "hall-notice", x: X(6.3), y: FY, facing: 1 });
  b.spawn({ id: "hall-desk", x: X(11.6), y: FY, facing: 1 });
  b.spawn({ id: "hall-nook", x: X(24.4), y: FY, facing: 1 });
  b.spawn({ id: "hall-gallery", x: X(12), y: GY, facing: 1 });
  b.place({ id: "hall-of-works", name: "Hall of Works", x0: HALL_X0, x1: HALL_X1, y0: FY - h(20), y1: FY + h(5), title: "place", spawn: "hall-in", vista: FY - h(2.4) });
  b.track({ id: "hall", x0: HALL_X0 - h(10), x1: HALL_X1 + h(10), y0: FY - h(30), y1: FY + h(10), keys: [
    { x: HALL_X0, zoom: 1, anchor: 0.8, horizon: 0.42, lead: 0.05 },
    { x: HALL_X1, zoom: 1, anchor: 0.8, horizon: 0.42, lead: 0.05 },
  ] });

  // --- env-hall's dressing: every visible thing in the room, read from the layout above
  dressHall(b);
}

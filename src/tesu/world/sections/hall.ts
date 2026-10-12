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
import { PLANES } from "../types.ts";
import { GALLERY_PIECES } from "./hall-art.ts";

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
function hang(b: WorldBuilder, i: number, x: number, y: number, w: number, maxH = h(1.6)): void {
  const g = GALLERY_PIECES[i];
  if (!g) return;
  let fw = w, fh = (w * g.height) / g.width;
  if (fh > maxH) { fh = maxH; fw = (maxH * g.width) / g.height; }
  fw = Math.round(fw); fh = Math.round(fh);
  b.piece("play", "artframe", x - fw / 2, y, { w: fw, h: fh }, { z: 3 });
  b.sprite({ id: `art-${g.id}`, plane: "play", kind: "image", x, y, p: { src: `/gallery/${g.id}-t.webp`, w: fw, h: fh }, frames: 1 });
  b.usable({ id: `art-frame-${g.id}`, x0: x - Math.max(fw / 2, h(0.5)), y0: y - fh - h(0.3), x1: x + Math.max(fw / 2, h(0.5)), y1: y + h(2.4), label: "look at the piece", action: { kind: "panel", panel: "art", arg: g.id } });
}

export function hall(b: WorldBuilder): void {
  const FY = HALL_FLOOR, GY = GALLERY_Y;
  // --- light and haze: warm lantern light, incense haze instead of mist, no sky
  b.atmos({ x: HALL_X0 - h(20), y0: FY - h(40), y1: FY + h(20), interior: true, sky: ["#120f14", "#1d171c", "#241c20"], haze: "#3a2a26", mist: 0, mistColour: "#5a4438", sun: null });

  // --- the room's bones
  const r3 = PLANES.back.rate;
  // the back wall, long enough to fill the frame anywhere in the room at play zoom and in
  // the entrance shot; its gallery band lines up with the Long Gallery
  b.piece("back", "hallwall", HALL_X0 - h(26), FY, { w: (HALL_W + h(52)) * r3, h: h(30) * r3, below: h(10) * r3, gallery: h(7.2) * r3 }, { z: 0 });
  // columns behind (near back) and in front (near front)
  for (let o = -4; o <= 38; o += 4.25) b.piece("back", "column", X(o), FY, { h: h(26) * r3, w: 30 }, { z: 2 });
  for (const o of [6.5, 21.5]) b.piece("near", "column", X(o), FY + h(0.4), { h: h(30), w: 54 }, { z: 2 });
  // the floors and the gallery's railing
  b.piece("play", "hallfloor", HALL_X0 - h(6), FY, { w: HALL_W + h(12), t: 30, kind: "ground" }, { z: 0 });
  b.piece("play", "hallfloor", X(2.6), GY, { w: h(20.6), t: 30, kind: "gallery" }, { z: 2 });
  b.piece("front", "balustrade", X(2.8), GY, { w: h(19.6), h: 58 }, { z: 1 });
  // the stair from the gallery down to the floor by the great doors; its underside roofs the nook
  b.piece("play", "hallstair", X(22.4), GY, { dx: h(7.6), dy: h(6.84) }, { z: 3 });
  // end walls beyond the doors
  b.piece("play", "mass", 0, 0, { top: [X(-30), FY - h(30), X(0.5), FY - h(30)], bottom: [X(0.5), FY + h(10), X(-30), FY + h(10)], rock: "stone", cap: "none", tufts: 0, shade: 0.9 }, { z: -3 });
  b.piece("play", "mass", 0, 0, { top: [X(33.6), FY - h(30), X(64), FY - h(30)], bottom: [X(64), FY + h(10), X(33.6), FY + h(10)], rock: "stone", cap: "none", tufts: 0, shade: 0.9 }, { z: -3 });
  // lanterns from the beams, a skylight's beam over the Crane Desk
  for (const [o, drop] of [[3.5, h(5.5)], [9, h(4.2)], [16, h(3.6)], [24, h(4.8)], [30, h(5.2)]] as const) b.piece("play", "hanglantern", X(o), FY - h(17), { drop, r: 20 }, { z: 1 });
  b.piece("front", "lightshaft", X(13.6), FY, { w: h(2.6), h: h(17), lean: h(1.2) }, { z: 3 });

  // --- collision: the floor, the gallery, the stair, the end walls
  b.walk([X(0), FY, X(34), FY], { surface: "wood", depth: h(3), name: "hall-floor" });
  b.walk([X(2.6), GY, X(22.8), GY], { surface: "wood", oneWay: true, depth: h(0.3), name: "long-gallery" });
  b.walk([X(22.4), GY, X(30), FY - h(0.1)], { surface: "wood", stair: true, depth: h(0.2), name: "hall-stair" });
  b.wall({ x: X(0.4), y0: FY - h(20), y1: FY + h(0.1), reason: "wall" });
  b.wall({ x: X(33.6), y0: FY - h(20), y1: FY + h(0.1), reason: "wall" });
  b.wall({ x: X(2.6), y0: GY - h(4), y1: GY + h(0.1), reason: "wall", from: "right" });

  // --- the ground floor, left to right
  b.piece("play", "idoor", X(0.7), FY, { w: h(2.3), h: h(3.7) }, { z: 4 });
  b.usable({ id: "hall-front-doors", x0: X(0.7), y0: FY - h(3.7), x1: X(3.0), y1: FY, label: "go out", action: { kind: "door", to: "hall-door" } });
  b.piece("play", "noticewall", X(4.6), FY, { w: h(3.4), h: h(3.4) }, { z: 4 });
  b.usable({ id: "notice-wall", x0: X(4.6), y0: FY - h(3.4), x1: X(8.0), y1: FY, label: "read the notices", action: { kind: "panel", panel: "notice" } });
  b.piece("play", "hangscroll", X(9.1), FY - h(1.9), { w: h(0.9), h: h(2.2) }, { z: 3 });
  b.usable({ id: "patrons", x0: X(9.0), y0: FY - h(4.4), x1: X(10.2), y1: FY, label: "the hanging scroll", action: { kind: "panel", panel: "patrons" } });
  b.piece("play", "desk", X(10.4), FY, { w: h(3.0), h: h(1.15) }, { z: 5 });
  b.sprite({ id: "hanko", plane: "play", kind: "hanko", x: X(11.6), y: FY - h(1.15) + 4, p: {}, frames: 4, fps: 1.2 });
  b.usable({ id: "hanko-desk", x0: X(10.4), y0: FY - h(1.6), x1: X(12.6), y1: FY, label: "talk to Hanko", action: { kind: "panel", panel: "hanko" } });
  b.piece("play", "offerbox", X(12.8), FY - h(1.15), { w: h(0.8), h: h(0.75) }, { z: 6 });
  b.usable({ id: "offering-box", x0: X(12.6), y0: FY - h(2.2), x1: X(13.6), y1: FY, label: "the offering box", action: { kind: "panel", panel: "donate" } });
  b.piece("play", "cranedesk", X(14.4), FY, { w: h(1.6), h: h(0.95) }, { z: 5 });
  b.usable({ id: "crane-desk", x0: X(14.4), y0: FY - h(1.4), x1: X(16.0), y1: FY, label: "the Crane Desk", action: { kind: "panel", panel: "crane" } });
  b.piece("play", "mappillar", X(18.0), FY, { w: h(1.0), h: h(22) }, { z: 3 });
  b.usable({ id: "map-pillar", x0: X(17.2), y0: FY - h(2.4), x1: X(18.8), y1: FY, label: "the map", action: { kind: "say", text: "The land's map, rolled tight on its cord. One cut and it would unroll." } });
  b.piece("play", "reqboard", X(19.6), FY, { w: h(1.7), h: h(2.6) }, { z: 4 });
  b.usable({ id: "request-board", x0: X(19.6), y0: FY - h(2.6), x1: X(21.3), y1: FY, label: "the Request Board", action: { kind: "say", text: "Pins, hooks and one slip: \"Requests open later.\"" } });
  // the reading nook under the stair: the docs shelf, Seo, a lamp
  b.piece("play", "bookshelf", X(22.6), FY, { w: h(2.4), h: h(3.4) }, { z: 2 });
  b.sprite({ id: "seo", plane: "play", kind: "seo", x: X(25.6), y: FY, p: {}, frames: 3, fps: 0.7 });
  b.usable({ id: "docs-shelf", x0: X(22.6), y0: FY - h(3.4), x1: X(26.2), y1: FY, label: "the docs shelf", action: { kind: "panel", panel: "docs" } });
  // two of the emperor's pieces between the nook and the great doors
  hang(b, 6, X(27.4), FY - h(2.0), h(1.5));
  hang(b, 7, X(29.3), FY - h(2.0), h(1.3));
  b.piece("play", "idoor", X(30.9), FY, { w: h(2.5), h: h(4.2) }, { z: 4 });
  b.usable({ id: "great-doors", x0: X(30.9), y0: FY - h(4.2), x1: X(33.4), y1: FY, label: "the great doors", action: { kind: "door", to: "court-gate" } });
  b.sprite({ id: "hall-cat", plane: "play", kind: "cat", x: X(7.4), y: FY - h(0.05), p: {}, frames: 2, fps: 0.6 });

  // --- the Long Gallery upstairs
  b.piece("play", "shutter", X(2.9), GY, { w: h(1.8), h: h(2.6) }, { z: 4 });
  b.usable({ id: "teahouse", x0: X(2.9), y0: GY - h(2.6), x1: X(4.7), y1: GY, label: "the Teahouse", action: { kind: "say", text: "The Teahouse, shuttered. It opens later." } });
  // seven frames upstairs hold the other pieces, each in a frame of its own shape
  const slots = [6.2, 8.9, 11.6, 14.2, 16.8, 19.0, 21.0];
  const upstairs = GALLERY_PIECES.map((_, i) => i).filter((i) => i !== 6 && i !== 7);
  upstairs.forEach((gi, k) => {
    const at = slots[k];
    if (at === undefined) return;
    hang(b, gi, X(at), GY - h(1.1), h(1.9), h(1.7));
  });
  b.piece("play", "offerbox", X(21.9), GY, { w: h(0.6), h: h(0.55) }, { z: 5 });
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
}

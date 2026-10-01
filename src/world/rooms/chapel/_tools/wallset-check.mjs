// Wall-set glass vs the nave's piers (lane R-E): node src/world/rooms/chapel/_tools/wallset-check.mjs
//
// The Chapel of Light's windows must never sit behind a pier or column (a sliver of colour down a
// pier's edge reads as a texture seam, not a window). Checked from the layout data alone (nave-plan.ts,
// read by both the backdrop and the room), so it needs no browser:
//   aisle   every aisle lancet, at every camera position on the rail (1 px steps) where any of it is
//           on screen in the widest frame the world renders (FRAME_W.max at the interior zoom), stays
//           inside its own arcade bay's opening: clear of both piers' widest rectangles (base and
//           capital), and with its head under the arcade's arch
//   wall    the rose window (a depth-1 prop over the west doors) clears every pier rectangle
// Exits 1 on any failure.
import { NAVE, LANCET, AISLE_DEPTH, P, RX, openBays, lancetXs, LANCET_HALF_PX } from "../../../../scenes/scenes/chapel/nave-plan.ts";
import { FRAME_W, ZOOM, SCALE } from "../../../config.ts";

const fails = [];
const span = (NAVE.x1 - NAVE.x0) * P - SCALE.viewW;
const half = SCALE.viewW / 2;
const visHalf = FRAME_W.max / ZOOM.interior / 2;
const pierHalf = NAVE.pierHalf * P;
const piers = NAVE.piers.map(RX);
// the arcade's opening: a two-centred arch over each bay (chapel.ts naveBody: half-width a, springing 4.25, k 1.32)
const archTop = (u, a) => {
  const R = a * 1.32, c = R - a, x = Math.abs(u) + c;
  return 4.25 + Math.sqrt(Math.max(0, R * R - x * x));
};
const headH = LANCET.spring + Math.sqrt(Math.max(0, (LANCET.half * LANCET.k) ** 2 - (LANCET.half * (LANCET.k - 1)) ** 2)) + LANCET.splay + LANCET.hood;
const report = [];
openBays().forEach(([a, b, c], i) => {
  const L = lancetXs(half)[i];
  let worst = Infinity, seen = 0;
  for (let C = 0; C <= span; C++) {
    const s = L - Math.round(C / AISLE_DEPTH); // the lancet's screen x (design-view px)
    if (Math.abs(s - half) > visHalf + LANCET_HALF_PX) continue;
    seen++;
    const n = s + C; // where it falls on the nave wall
    const clear = Math.min(n - LANCET_HALF_PX - (a + pierHalf), b - pierHalf - (n + LANCET_HALF_PX));
    worst = Math.min(worst, clear);
    if (clear < 0) {
      fails.push(`aisle lancet ${i} (bay ${(a / P + NAVE.x0).toFixed(1)}..${(b / P + NAVE.x0).toFixed(1)} H) crosses a pier at camera x ${C} (${clear} px)`);
      break;
    }
    // the head under the arcade's arch, at the lancet's outer corners and its apex (nave H above the floor)
    const aH = (b - a) / 2 / P - 0.45;
    const mid = (a + b) / 2;
    for (const [dx, hgt] of [[-LANCET_HALF_PX, LANCET.spring + LANCET.floorLift], [LANCET_HALF_PX, LANCET.spring + LANCET.floorLift], [0, headH + LANCET.floorLift]]) {
      const u = (n + dx - mid) / P;
      if (hgt > archTop(u, aH)) {
        fails.push(`aisle lancet ${i}: head above the arcade's arch at camera x ${C}`);
        break;
      }
    }
  }
  report.push({ lancet: i, bay: [+(a / P + NAVE.x0).toFixed(2), +(b / P + NAVE.x0).toFixed(2)], cameraPositionsSeen: seen, minClearancePx: worst });
});
// the rose window over the west doors (depth 1): its stone ring against the piers
const roseR = (NAVE.roseSize / 2 + 0.2) * P;
const rose = RX(NAVE.door);
for (const x of piers) {
  if (Math.abs(rose - x) < roseR + pierHalf) fails.push(`rose window overlaps the pier at ${(x / P + NAVE.x0).toFixed(1)} H`);
}
report.push({ rose: { x: NAVE.door, clearancePx: Math.min(...piers.map((x) => Math.abs(rose - x) - roseR - pierHalf)) } });
console.log(JSON.stringify({ aisleDepth: AISLE_DEPTH, widestVisibleHalfPx: Math.round(visHalf), report, fails }, null, 1));
process.exit(fails.length ? 1 : 0);

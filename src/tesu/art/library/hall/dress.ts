// env-hall's dressing: every visible thing in the Hall of Works and the Prize Court, placed
// from the world builder's own layout (its walks, usables and sprites), so if a service moves
// the art moves with it. The builder's sections call these at their end; nothing here adds
// collision, usables or camera.

import type { WorldBuilder } from "../../../world/build.ts";
import { PLANES, type Usable, type Walk } from "../../../world/types.ts";
import { BACK_LANTERNS, HALL, HALL_LANTERNS, HALL_LIGHT, SHAFT } from "./lights.ts";
import type { Bay } from "./backwall.ts";
import { yOn } from "../../../world/sections/common.ts";
import { DIAG } from "../../../world/sections/gate-road.ts";


const H = 96;
const h = (n: number): number => Math.round(n * H);

/** Where the Prow Stair starts at the foot of the palace cliff (shiraito.ts PATH_TOP_X). */
export const PROW_STAIR_FOOT_X = h(170);

function usable(b: WorldBuilder, id: string): Usable {
  const u = b.def.usables.find((o) => o.id === id);
  if (!u) throw new Error(`env-hall dressing: no usable ${id}`);
  return u;
}
function walk(b: WorldBuilder, name: string): Walk {
  const w = b.def.walks.find((o) => o.name === name);
  if (!w) throw new Error(`env-hall dressing: no walk ${name}`);
  return w;
}

/** The Hall of Works, dressed. */
export function dressHall(b: WorldBuilder): void {
  const floor = walk(b, "hall-floor");
  const FY = floor.pts[1]!;
  const RX0 = floor.pts[0]!;
  if (FY !== HALL.floor || RX0 !== HALL.x0) throw new Error("env-hall dressing: the hall moved; update lights.ts HALL");
  const gal = walk(b, "long-gallery");
  const GY = gal.pts[1]!, GX0 = gal.pts[0]!, GX1 = gal.pts[2]!;
  const st = walk(b, "hall-stair");
  const X = (o: number): number => RX0 + h(o);
  const r3 = PLANES.back.rate;
  const at = (x: number, y: number, rate = 1) => ({ wx: x, wy: y, rate });

  // --- light and haze: warm incense haze instead of mist, no sky
  b.atmos({ x: RX0 - h(20), y0: FY - h(40), y1: FY + h(20), interior: true, sky: ["#120d0e", "#1b1314", "#22181a"], haze: "#6e4e3a", mist: 0, mistColour: "#6a4c3a", sun: null });

  // --- the back wall (P3): long enough for every frame in the room, the entrance shot included
  const bx0 = X(-15), bx1 = X(49);
  const U = H * r3;
  const colsW: number[] = [];
  for (let o = -15; o <= 49; o += 4.25) colsW.push(X(o));
  const lows: Bay["low"][] = ["banner", "lattice", "archive", "moon", "lattice", "banner", "archive", "lattice", "moon", "archive", "lattice", "banner", "moon", "lattice", "archive"];
  const highs: Bay["high"][] = ["window", "scroll", "open", "window", "scroll", "window", "open", "window", "scroll", "open", "window", "scroll", "window", "open", "window"];
  const bays: Bay[] = [];
  for (let i = 0; i + 1 < colsW.length; i++) {
    bays.push({ x0: (colsW[i]! - bx0) * r3, x1: (colsW[i + 1]! - bx0) * r3, low: lows[i % lows.length]!, high: highs[i % highs.length]!, seed: 101 + i * 37 });
  }
  b.piece("back", "hall.backwall", bx0, FY, {
    w: (bx1 - bx0) * r3, u: U, top: h(21) * r3, below: h(6) * r3,
    bays, cols: colsW.map((x) => (x - bx0) * r3), at: at(bx0, FY, r3),
  }, { z: 0 });

  // --- the deeper hall (P2), seen through the back wall's openings
  const r2 = PLANES.mid.rate;
  const dx0 = X(-60), dx1 = X(95);
  b.piece("mid", "hall.deep", dx0, FY, { w: (dx1 - dx0) * r2, u: H * r2, top: h(30) * r2, below: h(4) * r2 }, { z: 0, reflect: false });

  // --- the walkway's edge and the stone floor nearer us
  const refl: [number, number, number][] = [
    [SHAFT.x1 - X(-8), h(1.4), 0.55],
    ...HALL_LANTERNS.filter((l) => l.plane === "play" && l.y < 8).map((l) => [X(l.o) - X(-8), h(0.35) * l.r, 0.32] as [number, number, number]),
    [X(1.85) - X(-8), h(0.9), 0.18], [X(32.15) - X(-8), h(1.0), 0.22],
  ];
  b.piece("play", "hall.floor", X(-8), FY, { w: h(50), below: h(6), caps: [4, 8.6, 14.1, 18, 23.2, 27.4, 33.6].map((o) => X(o) - X(-8)), refl, at: at(X(-8), FY) }, { z: -2 });

  // --- the end walls with the doors built into them
  const fd = usable(b, "hall-front-doors"), gd = usable(b, "great-doors");
  b.piece("play", "hall.endwall", X(0.4), FY, { side: -1, wall: fd.x1 - X(0.4) + h(0.55), doorAt: fd.x0 - X(0.4), doorW: fd.x1 - fd.x0, doorH: FY - fd.y0, top: FY - GY + h(0.2), out: h(16), day: 0.8, at: at(X(0.4), FY) }, { z: 1 });
  b.piece("play", "hall.endwall", X(33.6), FY, { side: 1, wall: X(33.6) - gd.x0 + h(0.5), doorAt: X(33.6) - gd.x1, doorW: gd.x1 - gd.x0, doorH: FY - gd.y0, top: h(9.6), out: h(16), day: 1, great: true, at: at(X(33.6), FY) }, { z: 1 });

  // --- the Long Gallery: its beam on posts, the central pillar through it, the balustrade
  const pillarX = (usable(b, "map-pillar").x0 + usable(b, "map-pillar").x1) / 2;
  const postsW = [X(4.3), X(8.5), X(14.0), X(23.1)];
  b.piece("play", "hall.gallery", GX0, GY, { w: GX1 - GX0 + h(0.6), depth: Math.round(0.62 * H), posts: postsW.map((x) => x - GX0), drop: FY - GY, pillar: [pillarX - GX0, h(0.56)], at: at(GX0, GY) }, { z: 2 });
  b.piece("play", "hall.pillar", pillarX, FY, { r: h(0.52), h: h(16.4), beam: [FY - GY, Math.round(0.62 * H)], at: at(pillarX, FY) }, { z: 3 });
  b.piece("front", "hall.balustrade", GX0 + h(0.2), GY, { w: GX1 - GX0 - h(0.4), h: Math.round(0.64 * H), at: at(GX0 + h(0.2), GY) }, { z: 1 });

  // --- the stair and its near rail
  const [sx0, sy0, sx1, sy1] = st.pts as [number, number, number, number];
  b.piece("play", "hall.stair", sx0, sy0, { dx: sx1 - sx0, dy: sy1 - sy0 + h(0.1), depth: 44, at: at(sx0, sy0) }, { z: 2 });
  b.piece("front", "hall.stair", sx0, sy0, { dx: sx1 - sx0, dy: sy1 - sy0 + h(0.1), depth: 44, rail: true, at: at(sx0, sy0) }, { z: 2 });

  // --- the services, each standing on the walk line where the builder put it
  const sv = (id: string) => usable(b, id);
  const nw = sv("notice-wall");
  b.piece("play", "hall.notice", nw.x0, FY, { w: nw.x1 - nw.x0, h: FY - nw.y0, at: at(nw.x0, FY) }, { z: 4 });
  const pa = sv("patrons");
  b.piece("play", "hall.scrollstand", pa.x0, FY, { w: pa.x1 - pa.x0, h: Math.min(FY - pa.y0, h(3.2)), at: at(pa.x0, FY) }, { z: 4 });
  const hanko = b.def.sprites.find((s) => s.id === "hanko");
  const deskH = hanko ? FY - hanko.y + 4 : h(1.15);
  const hk = sv("hanko-desk"), ob = sv("offering-box");
  const deskX0 = hk.x0, deskX1 = Math.max(hk.x1, ob.x1 - h(0.2));
  const boxX0 = ob.x0 + h(0.2), boxW = Math.min(h(0.8), ob.x1 - boxX0);
  b.piece("play", "hall.counter", deskX0, FY, { w: deskX1 - deskX0, h: deskH, clear: [boxX0 - deskX0 - 4, boxX0 - deskX0 + boxW + 4], at: at(deskX0, FY) }, { z: 5 });
  const boxH = h(0.75), boxTop = FY - deskH - boxH;
  const soffit = GY + Math.round(0.62 * H);
  b.piece("play", "hall.offerbox", boxX0, FY - deskH, { w: boxW, h: boxH, rope: boxTop - soffit - Math.round(0.32 * H) - 9, at: at(boxX0, FY - deskH) }, { z: 6 });
  const cd = sv("crane-desk");
  b.piece("play", "hall.cranedesk", cd.x0, FY, { w: cd.x1 - cd.x0, h: h(0.95), at: at(cd.x0, FY) }, { z: 5 });
  const rq = sv("request-board");
  b.piece("play", "hall.reqboard", rq.x0, FY, { w: rq.x1 - rq.x0, h: FY - rq.y0, at: at(rq.x0, FY) }, { z: 4 });
  const ds = sv("docs-shelf");
  b.piece("play", "hall.shelf", ds.x0, FY, { w: h(2.4), h: h(3.4), at: at(ds.x0, FY) }, { z: 3 });
  b.piece("play", "hall.lamp", ds.x1 + h(0.45), FY, { w: Math.round(0.3 * H), h: Math.round(1.55 * H), at: at(ds.x1 + h(0.45), FY) }, { z: 5 });
  // the art: on stands upstairs, on cords from a nail below
  for (const s of b.def.sprites) {
    if (!s.id.startsWith("art-") || s.kind !== "image") continue;
    const w = Number(s.p.w), hh = Number(s.p.h);
    const up = s.y < FY - h(4);
    b.piece("play", "hall.frame", s.x, s.y, { w, h: hh, mount: up ? "stand" : "wall", floor: up ? GY - s.y : 0, at: at(s.x, s.y) }, { z: 4 });
  }
  const th = sv("teahouse");
  b.piece("play", "hall.teahouse", th.x0, GY, { w: th.x1 - th.x0, h: GY - th.y0, at: at(th.x0, GY) }, { z: 4 });
  const ob2 = sv("offering-box-small");
  const b2x = ob2.x0 + h(0.1), b2w = h(0.6), b2h = h(0.62);
  b.piece("play", "hall.offerbox", b2x, GY, { w: b2w, h: b2h, legs: true, rope: (GY - b2h - Math.round(0.32 * H) - 9) - (FY - h(15.5)), at: at(b2x, GY) }, { z: 5 });

  // --- the near front (P5): great near columns in the gaps between services, scale props at
  // the frame's foot; painted only at play zoom and closer (at the entrance shot they would be
  // huge)
  const NEAR_Y = FY + Math.round(0.45 * H);
  const rN = PLANES.near.rate;
  // (placed where they never cover a service while she stands at it, in either facing, on
  // either floor: the Long Gallery's frames run almost unbroken from 3 H to 23 H, so the near
  // columns stand outside that stretch, and the middle keeps only low near props)
  for (const o of [-2.6, 28.8, 36.8]) {
    b.piece("near", "hall.nearcol", X(o), NEAR_Y, { r: Math.round(0.44 * H), h: 2300, at: at(X(o), NEAR_Y, rN) }, { z: 2, minLevel: 0.9, reflect: false });
  }
  const nearProps: [number, string, number][] = [[5.6, "pine", 0.55], [13.4, "teacart", 1.0], [17.0, "broom", 0.7], [24.8, "crates", 1.0], [31.0, "jar", 1.0]];
  for (const [o, kind, sc] of nearProps) b.piece("near", "hall.nearprop", X(o), NEAR_Y, { kind, s: sc, at: at(X(o), NEAR_Y, rN) }, { z: 3, minLevel: 0.9, reflect: false });

  // --- the back floor's clutter (P3), low, among which the hall's crowd stands
  const clutterAt: [number, string][] = [[-6.2, "bench"], [-1.2, "jars"], [3.1, "plant"], [7.4, "teatable"], [11.2, "umbrellas"], [14.6, "bench"], [19.2, "jars"], [22.1, "crates"], [26.0, "brazier"], [29.6, "bench"], [33.2, "plant"], [37.4, "jars"], [41.2, "teatable"]];
  for (const [o, kind] of clutterAt) b.piece("back", "hall.clutter", X(o), FY, { kind, u: U, at: at(X(o), FY, r3) }, { z: 2 });

  // --- the roof over the room: the tie beam the lanterns hang from, coffers, the skylight
  const BEAM = h(15.5), BEAM_D = h(0.9);
  b.piece("play", "hall.roof", X(-8), FY, { w: h(50), beam: BEAM, depth: BEAM_D, sky: [SHAFT.x0 - h(1.3) - X(-8), SHAFT.x0 + h(1.3) - X(-8)], top: h(19), at: at(X(-8), FY) }, { z: 6 });

  // --- the lanterns: on the play plane from the beam, on the back plane from its own roof
  HALL_LANTERNS.forEach((l, i) => {
    const hook = FY - BEAM;
    const lanternTop = FY - h(l.y) - Math.round(12 * l.r);
    b.sprite({ id: `hall-lantern-${i}`, plane: l.plane, kind: "hall.lantern", x: X(l.o), y: hook, p: { kind: l.kind, s: l.r * 2.1, cord: lanternTop - hook, phase: (i * 0.37) % 1, lit: 1 }, frames: 12, fps: 3, reflect: false });
  });
  BACK_LANTERNS.forEach((l, i) => {
    const hook = FY - h(16);
    const lanternTop = FY - h(l.y) - Math.round(10 * l.r);
    b.sprite({ id: `hall-lantern-back-${i}`, plane: "back", kind: "hall.lantern", x: X(l.o), y: hook, p: { kind: l.kind, s: l.r * 1.9 * r3, cord: (lanternTop - hook) * r3, phase: (i * 0.61 + 0.2) % 1, lit: 0.85 }, frames: 12, fps: 3, reflect: false });
  });

  // --- life: a paper crane leaves the Crane Desk now and then and rises up the shaft to the
  // skylight; incense smoke from the brazier by the back wall
  const deskTop = FY - h(0.95);
  const craneX = cd.x0 + Math.round((cd.x1 - cd.x0) * 0.3);
  const rise = deskTop - (FY - BEAM);
  b.sprite({ id: "hall-crane-flight", plane: "play", kind: "hall.craneflight", x: craneX, y: deskTop, p: { rise, drift: Math.round((SHAFT.x1 - SHAFT.x0) * (rise / h(18))) + (craneX - SHAFT.x1) }, frames: 64, fps: 8, reflect: false });
  b.sprite({ id: "hall-smoke-brazier", plane: "back", kind: "hall.smoke", x: X(26.0), y: FY - Math.round(0.84 * H), p: { h: Math.round(h(3.2) * r3) }, frames: 16, fps: 4, reflect: false });

  // --- the key light: the skylight's shaft, breathing, and the dust turning in it
  const fascia: [number, number] = [GY - FY - 2, GY + Math.round(0.62 * H) - FY + 2];
  const beamGap: [number, number] = [-BEAM - BEAM_D, -BEAM];
  b.sprite({ id: "hall-shaft", plane: "play", kind: "hall.shaft", x: SHAFT.x1, y: FY, p: { h: h(18), lean: SHAFT.x1 - SHAFT.x0, w: SHAFT.w, wTop: Math.round(SHAFT.w * 0.8), gaps: [fascia, beamGap] }, frames: 8, fps: 1, reflect: false });
  b.sprite({ id: "hall-dust", plane: "front", kind: "hall.dust", x: SHAFT.x1, y: FY, p: { h: h(14), lean: Math.round((SHAFT.x1 - SHAFT.x0) * (14 / 18)), w: SHAFT.w, n: 70 }, frames: 16, fps: 4, reflect: false });

  void HALL_LIGHT;
}

/** The Prize Court, dressed. */
export function dressCourt(b: WorldBuilder, o: { gongX: number }): void {
  const main = walk(b, "prize-court"), tip = walk(b, "prize-court-tip");
  const Y = main.pts[1]!;
  const CX0 = main.pts[0]!, WELL0 = main.pts[2]!, WELL1 = tip.pts[0]!, CX1 = tip.pts[2]!;
  const r3 = PLANES.back.rate;
  // the ring's middle (where the seal lies) and the bout's held camera centre (where the near
  // pillars frame it), both read from the builder's layout
  const MID = (CX0 + WELL0) / 2 + h(0.4);
  const bout = b.def.tracks.find((t) => t.id === "bout");
  const HOLD = bout?.keys[0]?.fixX ?? MID + h(3.7);

  // --- the arena's paved surface with the great seal, receding to the stands (P3)
  // (on the play plane: the court's camera is fixed, so the band's depth is exact there, and
  // it covers the stands' trestles where the floor runs in front of them)
  const band = Math.round((0.68 - 0.36) * 864 * (1 - r3));
  b.piece("play", "court.floor", CX0, Y, { w: CX1 - CX0 - h(0.3), u: band / 1.05, below: band, seal: [MID - CX0, h(3.3)] }, { z: 0, reflect: false, minLevel: 0.9 });

  // --- the foundation under the floor's front edge, the stairwell's mouth left open
  const pil: number[] = [];
  for (let x = CX0 + h(1.3); x < CX1; x += h(2.6)) if (x < WELL0 - h(0.5) || x > WELL1 + h(0.5)) pil.push(x - (CX0 - h(0.3)));
  b.piece("play", "court.foundation", CX0 - h(0.3), Y, { w: CX1 - CX0 + h(0.5), depth: h(2.7), well: [WELL0 - (CX0 - h(0.3)), WELL1 - (CX0 - h(0.3))], pilasters: pil }, { z: 1 });

  // --- the gatehouse porch against the hall's east wall
  const cd = usable(b, "court-doors");
  b.piece("play", "court.gatehouse", cd.x0 - h(0.25), Y, { w: cd.x1 - cd.x0 + h(0.5), h: Y - cd.y0 }, { z: 3 });

  // --- the Prize Board under the newest release's banner
  const pb = usable(b, "prize-board");
  b.piece("play", "court.board", (pb.x0 + pb.x1) / 2, Y, { plaques: ["dexclient", "dexcode"] }, { z: 4 });

  // --- Bao's gong tower and the gong (a sprite the bout drives: gongFrame in index.ts)
  const gongY = h(1.45), gr = Math.round(0.72 * H);
  b.piece("play", "court.gongtower", o.gongX, Y, { h: h(13), half: h(1.05), gongY }, { z: 3 });
  const beamUnder = Y - gongY - h(1.32);
  b.sprite({ id: "gong", plane: "play", kind: "court.gong", x: o.gongX, y: beamUnder, p: { r: gr, cord: (Y - gongY - gr) - beamUnder }, frames: 12, frame: 0, reflect: false });

  // --- lantern pillars behind the ring, newels at the stair's mouth, two near pillars that
  // stand at the frame's edges in a bout (P5, play zoom only)
  for (const x of [MID - h(1.7), WELL1 + h(0.9)]) b.piece("play", "court.lanternpillar", x, Y, { h: h(2.2) }, { z: 2 });
  for (const x of [WELL0 - h(0.25), WELL1 + h(0.25)]) b.piece("play", "court.newel", x, Y, { h: h(0.95) }, { z: 3 });
  // the near plane frames the bottom corners with cliff pines growing out of the rock under
  // the prow; their crowns top out just below the floor line, so they never cover her or a
  // service (GDK A.1: P5 never hides what matters). The bout's sides are framed by the hall's
  // wall on the left and the drop on the right.
  b.piece("near", "court.nearpine", HOLD - h(6.8), Y + h(4.2), { h: h(4.85), lean: 0.6, seed: 3 }, { z: 3, minLevel: 0.9, reflect: false });
  b.piece("near", "court.nearpine", HOLD + h(6.0), Y + h(4.4), { h: h(5.05), lean: -0.7, seed: 7 }, { z: 3, minLevel: 0.9, reflect: false });

  // --- the spectators' tiers under the stands sprite (which then draws its spectators alone)
  const stands = b.def.sprites.find((sp) => sp.id === "stands");
  if (stands) {
    stands.p = { ...stands.p, tiers: false };
    b.piece("back", "court.tiers", stands.x, stands.y, { w: Number(stands.p.w), rows: Number(stands.p.rows ?? 3) }, { z: 0, reflect: false });
  }

  // --- festival banners on tall poles among the stands (P3 sprites), each in the wind
  const r3b = PLANES.back.rate;
  [-6.2, -2.4, 1.6, 5.4].forEach((dx, i) => {
    b.sprite({ id: `court-banner-${i}`, plane: "back", kind: "court.banner", x: HOLD + h(dx), y: Y, p: { h: Math.round(h(5.6) * r3b), w: Math.round(h(0.55) * r3b), drop: Math.round(h(1.7) * r3b), phase: (i * 0.37) % 1 }, frames: 8, fps: 5, reflect: false });
  });

  // --- the Prow Stair's last run up through the rock and the foundation to the mouth, with
  // the grate across the mouth (the stand-in recess stops at 176 H)
  // (the stair's walk is laid by shiraito.ts after the court, so its line is rebuilt here
  // from the same data; hall.test.mjs checks the two agree)
  {
    const ax = PROW_STAIR_FOOT_X, ay = yOn(DIAG, ax), bx = WELL1, by = Y;
    const sx0 = h(176), sy0 = ay + ((by - ay) * (sx0 - ax)) / (bx - ax);
    b.piece("play", "court.stairrun", sx0, sy0, { x1: bx - sx0, y1: by - sy0, head: 112, masonry: Y - sy0, found: h(2.7), grate: [WELL0 - sx0 - h(0.1), WELL1 - sx0 + h(0.1)] }, { z: 2 });
  }

  // --- the tip: a bench, the stone rail she cannot pass, and past it the Prow Leap
  const leapW = b.def.walks.find((w) => w.name === "prow-leap");
  const railEnd = leapW ? leapW.pts[0]! - h(0.15) : CX1;
  b.piece("play", "court.bench", CX1 - h(1.75), Y, { w: 96 }, { z: 4 });
  b.piece("front", "court.rail", CX1 - h(1.4), Y, { w: railEnd - (CX1 - h(1.4)), h: Math.round(0.62 * H) }, { z: 2 });
  if (leapW) {
    const lx0 = leapW.pts[0]!, lx1 = leapW.pts[leapW.pts.length - 2]!;
    b.piece("play", "court.leap", lx0 - h(0.1), Y, { w: lx1 - lx0 + h(0.1) }, { z: 3 });
    b.sprite({ id: "court-flags", plane: "play", kind: "court.flags", x: lx0 + h(0.05), y: Y, p: { w: lx1 - lx0, h: Math.round(1.9 * H), n: 5 }, frames: 8, fps: 5, reflect: false });
  }
}

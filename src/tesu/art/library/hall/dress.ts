// env-hall's dressing: every visible thing in the Hall of Works and the Prize Court, placed
// from the world builder's own layout (its walks, usables and sprites), so if a service moves
// the art moves with it. The builder's sections call these at their end; nothing here adds
// collision, usables or camera.

import type { WorldBuilder } from "../../../world/build.ts";
import { PLANES, type Usable, type Walk } from "../../../world/types.ts";
import { BACK_LANTERNS, HALL, HALL_LANTERNS, HALL_LIGHT, SHAFT } from "./lights.ts";
import type { Bay } from "./backwall.ts";

const H = 96;
const h = (n: number): number => Math.round(n * H);

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
  b.atmos({ x: RX0 - h(20), y0: FY - h(40), y1: FY + h(20), interior: true, sky: ["#120d0e", "#1b1314", "#22181a"], haze: "#5c4130", mist: 0, mistColour: "#6a4c3a", sun: null });

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
  b.piece("play", "hall.floor", X(-8), FY, { w: h(50), below: h(6), caps: [4, 8.6, 14.1, 18, 23.2, 27.4, 33.6].map((o) => X(o) - X(-8)), at: at(X(-8), FY) }, { z: -2 });

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
  b.piece("play", "hall.stair", sx0, sy0, { dx: sx1 - sx0, dy: sy1 - sy0 + h(0.1), depth: 44, at: at(sx0, sy0) }, { z: 4 });
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
    b.piece("play", "hall.frame", s.x, s.y, { w, h: hh, mount: up ? "stand" : "wall", floor: up ? GY - s.y : 0, at: at(s.x, s.y) }, { z: 3 });
  }
  const th = sv("teahouse");
  b.piece("play", "hall.teahouse", th.x0, GY, { w: th.x1 - th.x0, h: GY - th.y0, at: at(th.x0, GY) }, { z: 4 });
  const ob2 = sv("offering-box-small");
  const b2x = ob2.x0 + h(0.1), b2w = h(0.6), b2h = h(0.62);
  b.piece("play", "hall.offerbox", b2x, GY, { w: b2w, h: b2h, legs: true, rope: (GY - b2h - Math.round(0.32 * H) - 9) - (FY - h(15.5)), at: at(b2x, GY) }, { z: 5 });

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

  // --- the key light: the skylight's shaft, breathing, and the dust turning in it
  const fascia: [number, number] = [GY - FY - 2, GY + Math.round(0.62 * H) - FY + 2];
  const beamGap: [number, number] = [-BEAM - BEAM_D, -BEAM];
  b.sprite({ id: "hall-shaft", plane: "play", kind: "hall.shaft", x: SHAFT.x1, y: FY, p: { h: h(18), lean: SHAFT.x1 - SHAFT.x0, w: SHAFT.w, wTop: Math.round(SHAFT.w * 0.8), gaps: [fascia, beamGap] }, frames: 8, fps: 1, reflect: false });
  b.sprite({ id: "hall-dust", plane: "front", kind: "hall.dust", x: SHAFT.x1, y: FY, p: { h: h(14), lean: Math.round((SHAFT.x1 - SHAFT.x0) * (14 / 18)), w: SHAFT.w, n: 70 }, frames: 16, fps: 4, reflect: false });

  void HALL_LIGHT;
}

/** The Prize Court, dressed. */
export function dressCourt(b: WorldBuilder, o: { gongX: number }): void {
  void b;
  void o;
}

// env-hall's dressing: every visible thing in the Hall of Works and the Prize Court, placed
// from the world builder's own layout (its walks, usables and sprites), so if a service moves
// the art moves with it. The builder's sections call these at their end; nothing here adds
// collision, usables or camera.

import type { WorldBuilder } from "../../../world/build.ts";
import { PLANES, type Usable, type Walk } from "../../../world/types.ts";
import { BACK_LANTERNS, GATE_O, HALL, HALL_LANTERNS, HALL_LIGHT, SERVICE_LAMPS, SHAFT } from "./lights.ts";
import type { Bay } from "./backwall.ts";
import type { NearFootP } from "./services.ts";
import { yOn } from "../../../world/sections/common.ts";
import { DIAG } from "../../../world/sections/gate-road.ts";
import type { Caster } from "./court-light.ts";


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

/** Where the pixelized preview of gallery piece `id` hung at w x h lives (public/). */
export function hallArtSrc(id: string, w: number, hh: number): string {
  return `/tesu/hall-art/${id}-${Math.round(w)}x${Math.round(hh)}.png`;
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
  const sv = (id: string) => usable(b, id);
  const D = Math.round(0.62 * H); // the gallery beam's depth
  const soffit = GY + D;

  // the Prize Court gate: lights.ts places its daylight at GATE_O; the builder's usable must agree
  const gd = sv("great-doors");
  const gateX = (gd.x0 + gd.x1) / 2;
  if (Math.abs(gateX - X(GATE_O)) > 2) throw new Error("env-hall dressing: the gate moved; update lights.ts GATE_O");

  // --- light and haze: warm incense haze instead of mist, no sky
  // (hall loop round 1) the haze the far planes sink into is the shell's cool dusk, not warm brown
  b.atmos({ x: RX0 - h(20), y0: FY - h(40), y1: FY + h(20), interior: true, sky: ["#120d0e", "#1b1314", "#22181a"], haze: "#3a3550", mist: 0, mistColour: "#3a3550", sun: null });

  // --- the back wall (P3): long enough for every frame in the room, the entrance shot included. Its
  // ground-floor bays are lattice, banners and archives only: the room's one moon gate is the real one
  const bx0 = X(-15), bx1 = X(49);
  const U = H * r3;
  const colsW: number[] = [];
  for (let o = -15; o <= 49; o += 4.25) colsW.push(X(o));
  const lows: Bay["low"][] = ["banner", "lattice", "archive", "lattice", "banner", "archive", "lattice", "banner", "lattice", "archive", "lattice", "banner", "archive", "lattice", "archive"];
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

  // --- the gallery's posts: in the clear wall between services, two of them framing the middle bay
  const postsO = [3.55, 7.0, 11.95, 23.6];
  const bayL = X(11.95), bayR = X(23.6);

  // --- the walkway's edge and the stone floor nearer us: gold caps under the posts (never a ruled
  // line), the gate's daylight doubled long in the polish, a warm streak under each service's lamp
  const F0 = X(-8);
  const refl: [number, number, number][] = [
    [gateX - F0, h(1.45), 0.95],
    [SHAFT.x1 - F0, h(0.75), 0.4],
    ...SERVICE_LAMPS.filter((l) => l.y > GY).map((l) => [l.x - F0, h(0.32) + l.r * 0.12, 0.22 * l.k] as [number, number, number]),
    ...HALL_LANTERNS.filter((l) => l.plane === "play" && l.y < 7).map((l) => [X(l.o) - F0, h(0.3) * l.r, 0.16] as [number, number, number]),
    [X(1.55) - F0, h(0.8), 0.18],
  ];
  b.piece("play", "hall.floor", F0, FY, { w: h(50), below: h(6), caps: [...postsO, 28.9, 33.6].map((o) => X(o) - F0), refl, at: at(F0, FY) }, { z: -2 });

  // --- the end walls: the front doors built into the west one; the east one plain (the court's door is
  // the gate in the middle now)
  const fd = sv("hall-front-doors");
  b.piece("play", "hall.endwall", X(0.4), FY, { side: -1, wall: fd.x1 - X(0.4) + h(0.55), doorAt: fd.x0 - X(0.4), doorW: fd.x1 - fd.x0, doorH: FY - fd.y0, top: FY - GY + h(0.2), out: h(16), day: 0.8, at: at(X(0.4), FY) }, { z: 1 });
  b.piece("play", "hall.endwall", X(33.6), FY, { side: 1, wall: h(2.4), doorAt: 0, doorW: 0, doorH: 0, top: h(9.6), out: h(16), day: 0, at: at(X(33.6), FY) }, { z: 1 });

  // --- the middle bay: its wall with the moon gate, between the two posts that frame it
  b.piece("play", "hall.gate", gateX, FY, { l: bayL - gateX, r: bayR - gateX, top: FY - soffit, rad: Math.round(1.6 * H), cy: Math.round(1.62 * H), at: at(gateX, FY) }, { z: 1 });
  // (hall loop round 1) the bay's wall sinks into the cool dusk round the lit opening (hall-light.ts)
  b.piece("play", "hall.bayshade", gateX, FY, { l: bayL - gateX, r: bayR - gateX, top: FY - soffit, rad: Math.round(1.6 * H), cy: Math.round(1.62 * H), at: at(gateX, FY) }, { z: 1.5, reflect: false });

  // --- the Long Gallery: its beam on posts, the balustrade (no pillar through it any more: the map
  // stands on its own stand now)
  b.piece("play", "hall.gallery", GX0, GY, { w: GX1 - GX0 + h(0.6), depth: D, posts: postsO.map((o) => X(o) - GX0), drop: FY - GY, pillar: [-h(50), 0], at: at(GX0, GY) }, { z: 2 });
  b.piece("front", "hall.balustrade", GX0 + h(0.2), GY, { w: GX1 - GX0 - h(0.4), h: Math.round(0.64 * H), at: at(GX0 + h(0.2), GY) }, { z: 1 });

  // --- the stair and its near rail
  const [sx0, sy0, sx1, sy1] = st.pts as [number, number, number, number];
  b.piece("play", "hall.stair", sx0, sy0, { dx: sx1 - sx0, dy: sy1 - sy0 + h(0.1), depth: 44, at: at(sx0, sy0) }, { z: 2 });
  b.piece("front", "hall.stair", sx0, sy0, { dx: sx1 - sx0, dy: sy1 - sy0 + h(0.1), depth: 44, rail: true, at: at(sx0, sy0) }, { z: 2 });

  // --- the services, each standing on the walk line where the builder put it
  const nw = sv("notice-wall");
  b.piece("play", "hall.notice", nw.x0, FY, { w: nw.x1 - nw.x0, h: FY - nw.y0, at: at(nw.x0, FY) }, { z: 4 });
  const pa = sv("patrons");
  b.piece("play", "hall.ranking", pa.x0, FY, { w: pa.x1 - pa.x0, h: FY - pa.y0, at: at(pa.x0, FY) }, { z: 4 });
  const ob = sv("offering-box");
  const boxX0 = ob.x0 + h(0.15), boxW = Math.round(0.55 * H);
  b.piece("play", "hall.donation", boxX0, FY, { w: boxW, h: Math.round(0.56 * H), main: true, at: at(boxX0, FY) }, { z: 6 });
  const hk = sv("hanko-desk");
  const hanko = b.def.sprites.find((s) => s.id === "hanko");
  const deskTop = hanko ? FY - hanko.y + 4 : Math.round(0.57 * H);
  b.piece("play", "hall.desk", hk.x0, FY, { w: hk.x1 - hk.x0, top: deskTop, who: (hanko?.x ?? (hk.x0 + hk.x1) / 2) - hk.x0, at: at(hk.x0, FY) }, { z: 5 });
  const mp = sv("map-pillar");
  b.piece("play", "hall.map", mp.x0, FY, { w: mp.x1 - mp.x0, at: at(mp.x0, FY) }, { z: 5 });
  // the reading nook: the docs shelf (no taller than 2 H), the standing lamp, the bench and the table
  const ds = sv("docs-shelf");
  b.piece("play", "hall.shelf", ds.x0, FY, { w: h(1.75), h: h(1.9), at: at(ds.x0, FY) }, { z: 3 });
  b.piece("play", "hall.lamp", ds.x0 + h(1.92), FY, { w: Math.round(0.26 * H), h: Math.round(1.3 * H), at: at(ds.x0 + h(1.92), FY) }, { z: 5 });
  const nookX = ds.x0 + h(2.12);
  b.piece("play", "hall.nook", nookX, FY, { bench: [0, h(0.8)], table: [h(0.88), h(1.33)], at: at(nookX, FY) }, { z: 4 });
  const cd = sv("crane-desk");
  b.piece("play", "hall.cranedesk", cd.x0, FY, { w: cd.x1 - cd.x0, h: Math.round(0.6 * H), at: at(cd.x0, FY) }, { z: 5 });
  // the art: on the display screens upstairs, on the stair's spandrel in the nook
  const arts = b.def.sprites.filter((s) => s.id.startsWith("art-") && s.kind === "image");
  for (const s of arts) {
    const w = Number(s.p.w), hh = Number(s.p.h);
    // (hall loop round 1) Dex's art hangs as pixelized previews at the room's 1 px, made at exactly
    // this size by tools/hall/pixelize_art.py (hall.test.mjs fails if a size has none)
    s.p = { ...s.p, src: hallArtSrc(s.id.slice(4), w, hh) };
    b.piece("play", "hall.frame", s.x, s.y, { w, h: hh, mount: "wall", floor: 0, at: at(s.x, s.y) }, { z: 4 });
  }
  // the screens: one per group of the upstairs hang (a group: frames less than 1 H apart)
  const up = arts.filter((s) => s.y < FY - h(4)).map((s) => ({ x0: s.x - Number(s.p.w) / 2, x1: s.x + Number(s.p.w) / 2, top: s.y - Number(s.p.h) })).sort((a, c) => a.x0 - c.x0);
  const groups: { x0: number; x1: number; top: number }[] = [];
  for (const f of up) {
    const g = groups[groups.length - 1];
    if (g && f.x0 - g.x1 < H) { g.x1 = Math.max(g.x1, f.x1); g.top = Math.min(g.top, f.top); } else groups.push({ ...f });
  }
  for (const g of groups) {
    const x0 = g.x0 - h(0.3), x1 = g.x1 + h(0.3);
    const leaves = Math.max(2, Math.round((x1 - x0) / h(1.3)));
    b.piece("play", "hall.screen", x0, GY, { w: x1 - x0, h: GY - g.top + h(0.32), leaves, at: at(x0, GY) }, { z: 3 });
  }
  const th = sv("teahouse");
  b.piece("play", "hall.teahouse", th.x0, GY, { w: th.x1 - th.x0, h: GY - th.y0, at: at(th.x0, GY) }, { z: 4 });
  const ob2 = sv("offering-box-small");
  const b2x = ob2.x0 + h(0.1);
  b.piece("play", "hall.donation", b2x, GY, { w: Math.round(0.5 * H), h: Math.round(0.42 * H), ped: Math.round(0.62 * H), at: at(b2x, GY) }, { z: 5 });
  const rq = sv("request-board");
  b.piece("play", "hall.reqboard", rq.x0, GY, { w: rq.x1 - rq.x0, h: GY - rq.y0, at: at(rq.x0, GY) }, { z: 4 });

  // --- the near front (P5): great near columns only beyond the hall's ends (inside, at 1.35x parallax a
  // near column always lands on a judged service in one of the frames); painted at play zoom and closer
  const NEAR_Y = FY + Math.round(0.45 * H);
  const rN = PLANES.near.rate;
  for (const o of [-2.6, 36.8]) {
    b.piece("near", "hall.nearcol", X(o), NEAR_Y, { r: Math.round(0.44 * H), h: 2300, at: at(X(o), NEAR_Y, rN) }, { z: 2, minLevel: 0.9, reflect: false });
  }

  // --- the near foot (P5): dark silhouettes cut by the frame's bottom (benches seen from behind, planters,
  // a jar, a length of rail) framing the floor below the walk line; spaced so the gate's long reflection in
  // the middle of the core frame stays clear; play zoom and closer only
  const FOOT_Y = FY + h(1.0);
  const foot: [number, NearFootP["kind"], number, number][] = [
    [-1.8, "jar", 0, 125], [2.6, "planter", 0, 205], [6.9, "bench", 2.2, 150], [11.9, "jar", 0, 132], [15.6, "bench", 1.8, 142],
    [22.6, "planter", 0, 196], [25.6, "rail", 1.6, 136], [29.6, "bench", 2.0, 150], [33.0, "planter", 0, 210],
  ];
  foot.forEach(([o, kind, w, top], i) => {
    b.piece("near", "hall.nearfoot", X(o), FOOT_Y, { kind, w: Math.round(h(w) * rN), top, seed: 11 + i * 7 }, { z: 3, minLevel: 0.9, reflect: false });
  });

  // --- the back floor's clutter (P3), low, among which the hall's crowd stands
  const clutterAt: [number, string][] = [[-6.2, "bench"], [-1.2, "jars"], [3.1, "plant"], [7.4, "teatable"], [11.2, "umbrellas"], [14.6, "bench"], [19.2, "jars"], [22.1, "crates"], [26.0, "brazier"], [29.6, "bench"], [33.2, "plant"], [37.4, "jars"], [41.2, "teatable"]];
  for (const [o, kind] of clutterAt) b.piece("back", "hall.clutter", X(o), FY, { kind, u: U, at: at(X(o), FY, r3) }, { z: 2 });

  // --- the roof over the room: the tie beam the lanterns hang from, coffers falling into the dark up to
  // the frame's top in the entrance shot, the skylight
  const BEAM = h(15.5), BEAM_D = h(0.9);
  b.piece("play", "hall.roof", X(-8), FY, { w: h(50), beam: BEAM, depth: BEAM_D, sky: [SHAFT.x0 - h(0.7) - X(-8), SHAFT.x0 + h(0.7) - X(-8)], top: h(25), at: at(X(-8), FY) }, { z: 6 });

  // --- the lanterns: under the gallery they hang from its soffit (no cord crosses the art upstairs);
  // elsewhere from the beam; on the back plane from its own roof
  HALL_LANTERNS.forEach((l, i) => {
    const x = X(l.o);
    const underGallery = l.y < 7 && x > GX0 && x < GX1 + h(0.6);
    const hook = underGallery ? soffit : FY - BEAM;
    const lanternTop = FY - h(l.y) - Math.round(12 * l.r);
    b.sprite({ id: `hall-lantern-${i}`, plane: l.plane, kind: "hall.lantern", x, y: hook, p: { kind: l.kind, s: l.r * 2.1, cord: lanternTop - hook, phase: (i * 0.37) % 1, lit: 1 }, frames: 12, fps: 3, reflect: false });
  });
  BACK_LANTERNS.forEach((l, i) => {
    const hook = FY - h(6.4);
    const lanternTop = FY - h(l.y) - Math.round(10 * l.r);
    b.sprite({ id: `hall-lantern-back-${i}`, plane: "back", kind: "hall.lantern", x: X(l.o), y: hook, p: { kind: l.kind, s: l.r * 1.9 * r3, cord: (lanternTop - hook) * r3, phase: (i * 0.61 + 0.2) % 1, lit: 0.85 }, frames: 12, fps: 3, reflect: false });
  });

  // --- life: a paper crane leaves the Crane Desk now and then and rises out of the frame; incense smoke
  // from the brazier by the back wall
  const deskTopC = FY - Math.round(0.6 * H);
  const craneX = cd.x0 + Math.round((cd.x1 - cd.x0) * 0.3);
  const rise = deskTopC - (FY - BEAM);
  b.sprite({ id: "hall-crane-flight", plane: "play", kind: "hall.craneflight", x: craneX, y: deskTopC, p: { rise, drift: h(0.9) }, frames: 64, fps: 8, reflect: false });
  b.sprite({ id: "hall-smoke-brazier", plane: "back", kind: "hall.smoke", x: X(26.0), y: FY - Math.round(0.84 * H), p: { h: Math.round(h(3.2) * r3) }, frames: 16, fps: 4, reflect: false });

  // --- the skylight's shaft beside the gate, breathing, and the dust turning in it
  const fascia: [number, number] = [GY - FY - 2, GY + D - FY + 2];
  const beamGap: [number, number] = [-h(30), -BEAM];
  // (hall loop round 2) the rays are drawn only upstairs where the shaft crosses open air (the play plane
  // below the gallery and the art's screens are lifted in its body by hall.light); the dust turns only in
  // the light just over its landing on the floor
  const skip: [number, number, number, number][] = groups.map((g) => [g.x0 - h(0.3) - SHAFT.x1, g.top - h(0.35) - FY, g.x1 + h(0.3) - SHAFT.x1, GY - FY + 2]);
  b.sprite({ id: "hall-shaft", plane: "play", kind: "hall.shaft", x: SHAFT.x1, y: FY, p: { h: h(18), lean: SHAFT.x1 - SHAFT.x0, w: SHAFT.w, wTop: Math.round(SHAFT.w * 0.85), gaps: [fascia, beamGap], from: GY - FY, skip }, frames: 8, fps: 1, reflect: false });
  b.sprite({ id: "hall-dust", plane: "front", kind: "hall.dust", x: SHAFT.x1, y: FY, p: { h: h(2.6), lean: Math.round((SHAFT.x1 - SHAFT.x0) * (2.6 / 18)), w: SHAFT.w, n: 18 }, frames: 16, fps: 4, reflect: false });

  // --- (hall loop round 1) life overhead: strings of paper cranes and silk streamers let down from
  // the Long Gallery's underside, high over the walk line (hall.life), off the gate's bay and the
  // lanterns' cords; steam off the tea tables on the back floor
  {
    const soffit = GY + Math.round(0.62 * H);
    const maxLen = (FY - h(4.3)) - soffit;
    const gate = b.def.usables.find((o) => o.id === "great-doors");
    const lanternXs = HALL_LANTERNS.filter((l) => l.plane === "play").map((l) => X(l.o));
    const hang: [number, "cranes" | "streamer", number, number][] = [];
    for (let x = GX0 + h(0.9), i = 0; x < GX1 - h(0.6); i++) {
      const clearGate = !gate || x < gate.x0 - h(1.4) || x > gate.x1 + h(1.4);
      const clearLantern = lanternXs.every((lx) => Math.abs(lx - x) > h(0.45));
      if (clearGate && clearLantern) {
        const cranes = (i * 7 + 3) % 5 < 3;
        const len = Math.min(maxLen, Math.round(h(cranes ? 0.9 : 1.3) + ((i * 37) % 11) / 10 * h(1.1)));
        hang.push([x - GX0, cranes ? "cranes" : "streamer", len, 11 + i * 17]);
      }
      x += h(1.2) + ((i * 53) % 13) / 12 * h(1.1);
    }
    b.piece("play", "hall.life", GX0, soffit, { w: GX1 - GX0, hang, at: at(GX0, soffit) }, { z: 7, reflect: false });
    for (const pc of b.def.pieces) {
      if (pc.kind !== "hall.clutter" || pc.p.kind !== "teatable") continue;
      const i = b.def.sprites.filter((sp) => sp.id.startsWith("hall-steam-")).length;
      b.sprite({ id: `hall-steam-${i}`, plane: "back", kind: "hall.smoke", x: pc.x + h(0.15), y: FY - Math.round(0.62 * H), p: { h: Math.round(h(0.9) * r3) }, frames: 16, fps: 4, reflect: false });
    }
  }

  // --- (hall loop round 1) the light lands: the shell sinks into the cool dark, every light lays
  // its pool in clustered bands on what is behind and round it, the day spills across the floor
  // from the doors, the shaft lands as a lattice-cast patch (hall-light.ts)
  const daylit: [number, number, number, number][] = [];
  for (const [id, day] of [["hall-front-doors", 0.6], ["great-doors", 1.0]] as const) {
    const u = b.def.usables.find((o) => o.id === id);
    if (u) daylit.push([u.x0, u.x1, FY - u.y0, day]);
  }
  const lightP = { floor: FY, gallery: GY, ends: [X(0.4), X(33.6)] as [number, number], doors: daylit };
  b.piece("back", "hall.light", bx0, FY, { ...lightP, w: (bx1 - bx0) * r3, top: h(24) * r3, below: h(6) * r3, at: at(bx0, FY, r3) }, { z: 50, reflect: false });
  b.piece("play", "hall.light", X(-8), FY, { ...lightP, w: h(50), top: h(21), below: h(6), play: true, at: at(X(-8), FY) }, { z: 50, reflect: false });

  void HALL_LIGHT;
}

/** The Prize Court, dressed. */
export function dressCourt(b: WorldBuilder, o: { gongX: number; ring?: [number, number] }): void {
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
  // (round 1, L14: the seal painted on the floor in perspective is gone (a 3D top in a side-on game; its radius
  // is 0 now); the ring is side-on instead: court.ring, a dais in the paving, kerbs, posts, the rope, banners)
  b.piece("play", "court.floor", CX0, Y, { w: CX1 - CX0 - h(0.3), u: band / 1.05, below: band, seal: [MID - CX0, 0.001] }, { z: 0, reflect: false, minLevel: 0.9 });
  if (o.ring) b.piece("play", "court.ring", o.ring[0], Y, { w: o.ring[1] - o.ring[0], band }, { z: 2, reflect: false });

  // --- the foundation under the floor's front edge, the stairwell's mouth left open
  const pil: number[] = [];
  for (let x = CX0 + h(1.3); x < CX1; x += h(2.6)) if (x < WELL0 - h(0.5) || x > WELL1 + h(0.5)) pil.push(x - (CX0 - h(0.3)));
  b.piece("play", "court.foundation", CX0 - h(0.3), Y, { w: CX1 - CX0 + h(0.5), depth: h(2.7), well: [WELL0 - (CX0 - h(0.3)), WELL1 - (CX0 - h(0.3))], pilasters: pil, centre: MID - (CX0 - h(0.3)) }, { z: 1 });

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
    // (hall loop round 1) the spectators are a crowd of people, every one different (court-light.ts)
    stands.kind = "court.crowd";
    stands.p = { ...stands.p, tiers: false };
    b.piece("back", "court.tiers", stands.x, stands.y, { w: Number(stands.p.w), rows: Number(stands.p.rows ?? 3) }, { z: 0, reflect: false });
  }

  // --- festival banners on tall poles among the stands (P3 sprites), each in the wind
  const r3b = PLANES.back.rate;
  // (hall loop round 1) each its own height, width, length, gust and pattern: never a pair of twins
  const flagSet: [number, number, number, number, number, number][] = [[-6.2, 5.6, 0.55, 1.7, 1.0, 0], [-2.4, 6.1, 0.48, 2.2, 1.35, 1], [1.6, 5.2, 0.6, 1.35, 0.8, 2], [5.4, 5.8, 0.44, 1.95, 1.2, 1]];
  flagSet.forEach(([dx, ph, bw, dr, gust, style], i) => {
    b.sprite({ id: `court-banner-${i}`, plane: "back", kind: "court.banner", x: HOLD + h(dx), y: Y, p: { h: Math.round(h(ph) * r3b), w: Math.round(h(bw) * r3b), drop: Math.round(h(dr) * r3b), phase: (i * 0.37) % 1, gust, style }, frames: 8, fps: 5, reflect: false });
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

  // --- beyond the tip the land falls away into a sea of mist: a dense bank low on the back
  // plane's depth, starting east of the stands, so nothing of the far plains shows under it
  for (const [dy, half, dens] of [[6.6, 2.6, 1], [4.4, 1.6, 1], [2.8, 1.3, 0.75]] as const) {
    b.mist({ x0: h(193.4), x1: h(260), y: Y + h(dy), half: h(half), rate: PLANES.back.rate, after: "back", density: dens });
  }
  // and mist rising up the prow's own cliff, at its depth, over the far lake's waterline
  for (const [dy, half, dens] of [[3.0, 1.7, 1], [1.7, 0.9, 0.85]] as const) {
    b.mist({ x0: h(193.9), x1: h(240), y: Y + h(dy), half: h(half), rate: 1, after: "play", density: dens });
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

  // --- (hall loop round 1) the sun lands: every standing thing throws its shadow back across the
  // paving, up and to the right (court-light.ts projects their side-on silhouettes)
  b.piece("play", "court.shadows", CX0, Y, { band, w: CX1 - CX0 + h(0.2), reach: h(2.9), slant: 0.6, casters: courtCasters(b, CX0, Y, { gongX: o.gongX, mid: MID, well0: WELL0, well1: WELL1, cx1: CX1, railEnd, ring: o.ring }) }, { z: 2.5, reflect: false, minLevel: 0.9 });
}

/** The court's standing things as side-on silhouettes for their shadows (x from the court's west end, z up from the walk line). */
function courtCasters(b: WorldBuilder, CX0: number, Y: number, o: { gongX: number; mid: number; well0: number; well1: number; cx1: number; railEnd: number; ring?: [number, number] }): Caster[] {
  const cs: Caster[] = [];
  const box = (x0: number, x1: number, z0: number, z1: number) => cs.push({ box: [x0 - CX0, x1 - CX0, z0, z1] });
  const rod = (x: number, w: number, z0: number, z1: number) => cs.push({ rod: [x - CX0, w, z0, z1] });
  // the gatehouse porch against the hall's wall, its roof overhanging
  const cd = usable(b, "court-doors");
  const g0 = cd.x0 - h(0.25), gw = cd.x1 - cd.x0 + h(0.5), gd = Y - cd.y0;
  box(g0, g0 + gw, 0, gd + h(0.6));
  box(g0 - 0.45 * gw, g0 + 1.45 * gw, gd + h(0.6), gd + h(1.05));
  // the Prize Board: legs, the board, its roof, the banner on its poles
  const pb = usable(b, "prize-board");
  const bx = (pb.x0 + pb.x1) / 2;
  box(bx - h(1.0), bx - h(0.89), 0, h(1.97));
  box(bx + h(0.9), bx + h(1.01), 0, h(1.97));
  box(bx - h(1.0), bx + h(1.01), h(0.24), h(0.28));
  box(bx - h(1.1), bx + h(1.1), h(0.72), h(2.17));
  box(bx - h(1.4), bx + h(1.4), h(2.17), h(2.36));
  box(bx - h(1.2), bx + h(1.2), h(2.36), h(2.58));
  rod(bx - h(1.12), 8, 0, h(4.6));
  rod(bx + h(1.06), 8, 0, h(4.6));
  box(bx - h(0.95), bx + h(0.95), h(2.55), h(4.45));
  // Bao's gong tower: posts on stone bases, the beam and the brace, the gong on its cords, the tower
  const gx = o.gongX, half = h(1.05), r = Math.round(0.17 * H), gy = h(1.45);
  for (const s of [-1, 1]) {
    rod(gx + s * half, 2 * r, 0, gy + h(1.82));
    box(gx + s * half - r * 1.55, gx + s * half + r * 1.55, 0, h(0.19));
    box(gx + s * half - r * 1.4, gx + s * half + r * 1.4, h(0.19), h(0.5));
    rod(gx + s * h(0.4), 3, gy + h(0.6), gy + h(1.32));
  }
  box(gx - half - h(0.3), gx + half + h(0.3), gy + h(1.32), gy + h(1.58));
  box(gx - half - h(0.3), gx + half + h(0.3), h(0.95), h(1.09));
  box(gx - half * 0.62, gx + half * 0.62, gy + h(1.58), h(13));
  cs.push({ disc: [gx - CX0, gy, Math.round(0.72 * H)] });
  // the stone lantern pillars and the newels at the stair's mouth
  for (const x of [o.mid - h(1.7), o.well1 + h(0.9)]) {
    box(x - h(0.2), x + h(0.2), 0, h(0.38));
    rod(x, h(0.25), 0, h(2.2));
    box(x - h(0.3), x + h(0.3), h(2.2), h(2.72));
    box(x - h(0.44), x + h(0.44), h(2.72), h(2.95));
  }
  for (const x of [o.well0 - h(0.25), o.well1 + h(0.25)]) {
    box(x - h(0.16), x + h(0.16), 0, h(0.95));
    box(x - h(0.12), x + h(0.12), h(0.95), h(1.4));
  }
  // the props that stand on the court: the lantern post (and its lantern), the jars
  for (const pr of b.def.props) {
    if (pr.x < CX0 || pr.x > o.cx1 + h(0.5)) continue;
    const ph = Number(pr.p.h ?? 0);
    if (pr.kind === "lanternpost") {
      rod(pr.x, 7, 0, ph);
      box(pr.x, pr.x + Number(pr.p.arm ?? 40), ph - 8, ph);
    } else if (pr.kind === "paperlantern") {
      const rr = Number(pr.p.r ?? 14);
      cs.push({ disc: [pr.x - CX0, Y - pr.y - rr * 1.6, rr] });
    } else if (pr.kind === "jar") {
      box(pr.x - ph * 0.36, pr.x + ph * 0.36, 0, ph * 0.8);
      box(pr.x - ph * 0.2, pr.x + ph * 0.2, ph * 0.8, ph);
    }
  }
  // the ring's posts, its rope slung between their heads, the banner poles outside them
  if (o.ring) {
    const [r0, r1] = o.ring;
    for (const [px, out] of [[r0 - h(0.16), -1], [r1 + h(0.16), 1]] as const) {
      box(px - h(0.14), px + h(0.14), 0, h(0.24));
      rod(px, h(0.15), 0, h(1.45));
      box(px - 5, px + 5, h(1.45), h(1.65));
      const qx = px + out * h(0.36);
      rod(qx, 3, 0, h(3.3));
      box(qx - h(0.2), qx + h(0.2), h(1.65), h(3.2));
    }
    box(r0 - h(0.16), r1 + h(0.16), h(1.27), h(1.33));
  }
  // the bench and the stone rail at the tip
  const bn = o.cx1 - h(1.75);
  box(bn - 4, bn + 100, h(0.38), h(0.46));
  box(bn + 4, bn + 18, 0, h(0.38));
  box(bn + 78, bn + 92, 0, h(0.38));
  const r0 = o.cx1 - h(1.4), rw = o.railEnd - r0, rh = Math.round(0.62 * H);
  const n = Math.max(2, Math.round(rw / (0.9 * H)));
  for (let i = 0; i <= n; i++) box(r0 + (i * rw) / n - 6, r0 + (i * rw) / n + 6, 0, rh + 8);
  box(r0, r0 + rw, rh - 7, rh + 4);
  box(r0, r0 + rw, rh * 0.5, rh * 0.62);
  return cs;
}

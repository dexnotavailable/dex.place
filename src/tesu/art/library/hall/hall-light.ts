// The Hall of Works' light landing (the hall loop, round 1): one light logic for the room.
//
// The room's shell (the roof, the upper back wall above the gallery, the ends beyond the end walls)
// sinks into a cool blue-violet dark, like the mass round ref 06's lit gate. Warmth lives only where
// light lands: every lantern and lamp lays a warm pool on whatever is behind and around it, in two
// or three clustered bands with wandering edges (no dither screen); the low lights also lay a pool
// on the floor and a streak of reflection down its polish. The doors' daylight spills across the
// floor as the longest, brightest streak in the room. The skylight's shaft lights what it passes
// through and lands on the floor as a bright patch with the skylight's lattice cast in it.
//
// It is a piece per plane (the back wall's plane and the play plane), painted after everything
// else on that plane: it re-colours what is already there by whole ramp steps (tint.ts), so the
// wood's grain and the lacquer's sheen stay in the light. Every light is read from lights.ts and
// every door from the builder's usables, so when the room is re-laid the light moves with it.

import { definePainter } from "../../painter.ts";
import { BACK_LANTERNS, HALL, HALL_LIGHT, SHAFT } from "./lights.ts";
import { clamp, hash, vnoise, type At } from "./kit.ts";
import { bayer4 } from "../../raster.ts";
import { lut, lutChain, poolLut, tint } from "./tint.ts";
import { BAY as ROOF_BAY } from "./roof.ts";
import { UP, UPPER_KINDS, loftLampFrac, loftOpening } from "./upper.ts";
import { clerestoryBoxes, gateGeo, scrollBoxes, stiles } from "./gate.ts";
import { P } from "../../palette.ts";

const H = 96;
/** The back wall's columns' radius (world px): backwall.ts 0.36 u. */
const COL_R = 0.36 * H;

export interface HallLightP {
  /** Size of the piece in its plane's px: the anchor is its west end on the walk line. */
  w: number;
  top: number;
  below: number;
  /** World y of the walk line and of the gallery's floor; world x of the room's two end walls. */
  floor: number;
  gallery: number;
  ends: [number, number];
  /** Doors with daylight behind them: [world x0, x1, height (px), daylight 0..1]. */
  doors: [number, number, number, number][];
  /** The play plane: the floor's pools and streaks, the shaft's beam and landing. */
  play?: boolean;
  at: At;
}

interface Pool { x: number; y: number; r: number; k: number }

/**
 * The lights, sorted by the plane their pools can land on without sliding off them as the camera
 * moves (a light's pool must be on its own plane, or on a plane behind it only where the camera
 * looks straight at it). Back: the back wall's own lanterns, pooled on the back wall. Play: every
 * other light, pooled on the floor in front of it. Low: the service lamps near the walk line (a
 * service is in the middle of the frame when she stands at it), also pooled on the back wall.
 */
function sortLights(floor: number, doors: [number, number, number, number][]): { back: Pool[]; play: Pool[]; low: Pool[] } {
  const backKeys = new Set(BACK_LANTERNS.map((l) => `${HALL.x0 + Math.round(l.o * H)}|${floor - Math.round(l.y * H)}`));
  const back: Pool[] = [], play: Pool[] = [], low: Pool[] = [];
  for (const L of HALL_LIGHT.lights) {
    if (L.kind !== "point") continue;
    if (backKeys.has(`${L.x}|${L.y}`)) {
      back.push({ x: L.x, y: L.y, r: Math.min(L.r * 0.38, 1.15 * H), k: L.k * 1.8 });
      continue;
    }
    // a door's own daylight is the doors' fan (below), not a lamp's pool
    const atDoor = doors.some(([d0, d1]) => L.x > d0 - H && L.x < d1 + H);
    if (atDoor) continue;
    play.push({ x: L.x, y: L.y, r: L.r, k: L.k });
    if (floor - L.y < 3 * H) low.push({ x: L.x, y: L.y, r: 1.7 * H, k: L.k * 1.1 });
  }
  return { back, play, low };
}

/** The back wall's lit lofts (world px): the opening's ends and the lamp's x (upper.ts; the bays are the dressing's, from
 *  15 H west of the hall's west wall every 4.25 H, seeds 101 + 37 i). */
function lofts(): { x0: number; x1: number; lamp: number }[] {
  const out: { x0: number; x1: number; lamp: number }[] = [];
  const [o0, o1] = loftOpening();
  for (let i = 0; i < 15; i++) {
    if (UPPER_KINDS[i % UPPER_KINDS.length] !== "loft") continue;
    const bx = HALL.x0 + (-15 + 4.25 * i) * H;
    const x0 = bx + o0 * H, x1 = bx + o1 * H;
    out.push({ x0, x1, lamp: x0 + (x1 - x0) * loftLampFrac(101 + i * 37) });
  }
  return out;
}

export const hallLight = definePainter<HallLightP>("hall.light", {
  bounds(p) {
    return [0, -p.top, p.w, p.below];
  },
  paint(c, p) {
    const at = p.at;
    const L = sortLights(p.floor, p.doors);
    const LOFTS = p.play ? [] : lofts();
    // (round 2, W2-6) the service lamps' pools are no longer laid on the back wall: two planes back, they slid off
    // their lamps with the camera and read as round discs behind the services
    const wallPools = p.play ? [] : L.back;
    const umber = new Set<number>([...P.umber, ...P.dusk, ...P.mauve]);
    const warm = [null, lut("warm", 1), lut("warm", 2), lut("warm", 3)] as const;
    const night = [null, lut("night", 1), lut("night", 2), lut("night", 3)] as const;
    const sun = [null, lut("sun", 1), lut("sun", 2), lut("sun", 3)] as const;
    const FY = p.floor;
    tint(c, 0, -p.top, p.w, p.below, (X, Y, lx, ly) => {
      const wx = at.wx + lx / at.rate, wy = at.wy + ly / at.rate;
      // the wandering edge of every band: a slow noise, so no pool is a drawn circle
      const jit = (vnoise(wx * 0.07, wy * 0.07, 7) - 0.5) * 0.05 + (hash(X, Y, 3) - 0.5) * 0.015;
      if (wy > FY + 1) {
        if (!p.play) {
          // (round 2, W2-6) the back floor's polish under each back-wall lantern: a wide, shallow pool
          let fv = 0;
          for (const q of wallPools) {
            const dx = (wx - q.x) / (q.r * 1.35), dd = (wy - FY) / (0.75 * H);
            const f = 1 - dx * dx - dd * dd;
            if (f > 0) fv += q.k * f * 0.85;
          }
          const n = bandsOf(fv + jit + (fv > 0.04 ? (bayer4(X, Y) - 0.5) * 0.14 : 0));
          return n ? lut("warm", n) : null;
        }
        // --- the floor: pools under the low lights, reflections down the polish, the doors' day
        const dep = (wy - FY) / H;
        let wv = 0, sv = 0;
        for (const q of L.play) {
          const hgt = (FY - q.y) / H;
          if (hgt > 7) continue;
          const dx = (wx - q.x) / ((0.55 + hgt * 0.08) * H);
          if (Math.abs(dx) > 1) continue;
          // the light catching the walkway's lacquered lip and face just under it (its reflection
          // down the polish is the floor's own, room.ts)
          const near = 1.3 - hgt * 0.12;
          if (dep < 0.13) wv += q.k * near * (1 - dx * dx) * 1.2;
          else if (dep < 0.46) wv += q.k * near * Math.max(0, 1 - dx * dx * 1.8) * 0.6;
        }
        for (const [d0, d1, , day] of p.doors) {
          const cx = (d0 + d1) / 2, hw = (d1 - d0) / 2;
          // the day through the doorway: a fan across the walkway and the floor in front of it
          const u = (wx - cx) / (hw * (0.8 + dep * 0.4));
          sv += day * Math.max(0, 1 - u * u) * Math.max(0, 1 - dep / 1.5) * 1.05;
        }
        // the shaft's landing: a bright patch at its foot with the skylight's lattice cast in it
        const fx = (wx - SHAFT.x1) / SHAFT.pool, fy = (dep - 0.18) / 0.5;
        const land = Math.max(0, 1 - fx * fx - fy * fy);
        if (land > 0) {
          // (integration, round 2) the lattice's bars fall straight down the floor's face: slanted with the depth they
          // read as boards receding into the picture, a floor seen from above in a side-on room
          const gx = wx;
          const bar = ((gx % 26) + 26) % 26 < 3.2 || (((wy - FY) % 9) + 9) % 9 < 1.4;
          sv += SHAFT.k * land * (bar ? 0.25 : 1.15);
        }
        const v = Math.max(wv, sv) + jit;
        const n = v > 0.95 ? 3 : v > 0.55 ? 2 : v > 0.22 ? 1 : 0;
        if (!n) return null;
        return sv >= wv ? sun[n]! : warm[n]!;
      }
      // --- the room: the shell sinks into the cool dark, the lights' pools lift it
      let shade = 0;
      // (integration, round 2: each step came on at one height across everything, a level line across the end columns)
      // each step comes on over a short dithered run
      const sd = (bayer4(X, Y) - 0.5) * 0.4 * H;
      if (wy < FY - 10.6 * H + sd) shade = 1;
      if (wy < FY - 13.2 * H + sd) shade = 2;
      // the roof over the tie beam: the coffers and rafters fall away into the dark
      // (the skylight's well stays as bright as the day in it)
      // (integration, round 1: graded, so the coffers just over the beam still read as the roof falling
      // away instead of a flat band; only the skylight's own well, 16.4-18.8 H up, keeps the day: the
      // roof above the well darkens like the rest instead of standing up as a lit chimney)
      const roofAt = FY - 16.1 * H - (p.play ? 0 : 0.5 * H);
      if (wy < roofAt) {
        const inWell = p.play && Math.abs(wx - SHAFT.x0) < 1.35 * H && wy > FY - 18.9 * H;
        shade = inWell ? 0 : wy > roofAt - 1.4 * H + jit * H ? 2 : 3;
      }
      // (hall loop round 2, W2-1) the play plane's roof over the tie beam is painted in the air's own
      // values, stepping into the haze as it goes up (roof.ts): no shade laid over it
      if (p.play && wy < FY - 16.42 * H) shade = 0;
      // (hall loop round 2, W2-8) the back wall's upper storey (the lintel, its bracket sets, the plate and the
      // lofts over it) sinks one step only: backwall.ts paints its structure in its own low values, so two or
      // three steps crushed it to a flat field with a few dots; the roof's boards over the lofts take two, the
      // purlins high up three
      if (!p.play && wy < FY - 13.2 * H) shade = wy > FY - 17.6 * H ? 1 : wy > FY - 19.2 * H + jit * H ? 2 : 3;
      // (integration, round 2: beyond the end walls the shell sank two steps on a ruled vertical line, which cut the
      // roof and the upper storey in hall-wide and the back wall in docs-nook where nothing stands at that line) the
      // dark comes on at the line only where the play plane's end walls and the dark rooms beyond them stand (up to the
      // tie beam's underside, 15.5 H: dress.ts BEAM); above them, and on
      // the back plane (whose line never meets a wall with the parallax), it steps down a bay at a time, each step
      // behind a member that stands there: the roof's transverse frames (roof.ts, every BAY from the piece's west
      // end) on the play plane, the back wall's columns on the back plane
      const past = Math.max(p.ends[0] - 0.2 * H - wx, wx - p.ends[1] - 0.2 * H);
      if (past > 0) {
        const full = wy < FY - 2.2 * H ? 2 : 1;
        if (p.play && wy > FY - 15.5 * H) shade = Math.max(shade, full);
        else {
          const unit = p.play ? ROOF_BAY * H : 4.25 * H;
          const o = p.play ? at.wx : HALL.x0 - 15 * H;
          const half = p.play ? 0.3 * H : COL_R;
          const west = wx < p.ends[0];
          const end = west ? p.ends[0] - 0.2 * H : p.ends[1] + 0.2 * H;
          // the members standing between the end line and this point (their far faces passed)
          let n = 0;
          const k0 = Math.floor((Math.min(wx, end) - o) / unit) - 1, k1 = Math.ceil((Math.max(wx, end) - o) / unit) + 1;
          for (let k = k0; k <= k1; k++) {
            const m = o + k * unit;
            if (west ? m < end && wx < m - half : m > end && wx > m + half) n++;
          }
          shade = Math.max(shade, Math.min(full, n));
        }
      }
      // (hall loop round 2, W2-6/W2-8) a loft's box keeps the light its own lamp paints in it (no dusk, no disc);
      // under it the lamp's light spills a step onto the cornice's face and the tops of the sets, across the
      // lamp's reach and stopped at the loft's posts
      if (LOFTS.length && wy < FY - (UP.sets - 0.35) * H && wy > FY - UP.ceil * H) {
        const lo = LOFTS.find((q) => wx > q.x0 && wx < q.x1);
        if (lo) {
          if (wy < FY - UP.cornice * H) return null;
          const dx = (wx - lo.lamp) / (1.5 * H);
          const sp = (1 - dx * dx) * (1 - (wy - (FY - UP.cornice * H)) / (0.75 * H)) + jit * 2;
          if (sp > 0.35) return lut("warm", sp > 0.75 ? 2 : 1);
        }
      }
      let v = 0;
      // (round 2, W2-6: every pool was a round disc) the lantern's cap shades the wall over it, so its pool reaches
      // further down than up and wider than tall; the nearest column's face turned to it catches it hardest and
      // further along its length, the face turned away takes little; the painted structure (gold, red, the screens'
      // timber) takes it a little more than the dark boarding behind
      if (wallPools.length) {
        const ci = Math.round(((wx - HALL.x0) / H + 15) / 4.25);
        const col = HALL.x0 + (-15 + 4.25 * ci) * H;
        const onCol = Math.abs(wx - col) < COL_R;
        const mat = umber.has(c.buf.get(X, Y)) ? 0.85 : 1.1;
        for (const q of wallPools) {
          const dx = wx - q.x, dy = wy - q.y;
          const rx = q.r * 1.2, ry = dy < 0 ? q.r * 0.55 : q.r * 1.3;
          if (Math.abs(dx) > rx * 1.1 || dy > ry * 1.6 || dy < -ry) continue;
          let f = 1 - (dx / rx) ** 2 - (dy / ry) ** 2;
          if (onCol) {
            const facing = Math.abs(q.x - col) < COL_R * 0.5 || Math.sign(q.x - col) === Math.sign(wx - col);
            const fc = 1 - (dx / (rx * 1.1)) ** 2 - (dy / (ry * 1.6)) ** 2;
            f = facing ? Math.max(f, fc) * 1.3 : f * 0.35;
          }
          if (f > 0) v += q.k * f ** 1.5 * mat;
        }
      }
      // (integration, round 2: the back-wall lanterns' pools stood on the wall as hard-edged blobs) each band's edge is
      // dithered over a short run of the falloff, so the pool fades into the wall instead of ending on a line
      const lift0 = bandsOf(v + jit + (v > 0.04 ? (bayer4(X, Y) - 0.5) * 0.14 : 0));
      let lift = lift0 - shade;
      // (hall loop round 2, W2-4) the shaft: a body of lit air a step or two above the room's air,
      // brightest where it leaves the well and fading as it falls, its edges wandering slowly (no ruled
      // line, no rain), three long faint rays down its length; whatever it passes in front of on the play
      // plane takes the light on its own colour
      if (p.play && wy > SHAFT.y0 && wy < FY) {
        const n = shaftSteps(wx, wy, FY, X, Y);
        if (n > 0) return lutChain(lift > 0 ? ["warm", Math.min(3, lift)] : ["night", Math.min(3, -lift)], ["air", n]);
      }
      void warm; void night;
      // (round 2, W2-6) the same on the back wall: the lantern's warmth laid over the dusk, never the wall's own brown
      if (lift0 > 0 && shade > 0) return lutChain(["night", Math.min(3, shade)], ["warm", Math.min(4, lift0 + 1)]);
      return poolLut(Math.min(3, shade), Math.min(3, lift0));
    });
  },
});

/** The shaft's body at a world point: 0 (outside) .. 3 air steps. */
export function shaftSteps(wx: number, wy: number, FY: number, X = 0, Y = 0): number {
  const tt = clamp((FY - wy) / (FY - SHAFT.y0), 0, 1); // 0 at the floor .. 1 at the well
  const ax = SHAFT.x1 + (SHAFT.x0 - SHAFT.x1) * tt;
  const half = (SHAFT.w / 2) * (1 - 0.15 * tt);
  const off = (wx - ax) / half;
  // parallel light: the edges run straight down the slant but soft, two or three bands across them,
  // the seams between the bands a narrow dither
  const dd = Math.abs(off);
  if (dd > 1.25) return 0;
  const core = clamp(1 - Math.pow(dd / 1.25, 2.2), 0, 1);
  let s = core * (0.5 + 0.5 * tt * tt);
  // three long faint rays from the well, each fading out at its own length
  for (const [ru, rw, end] of SHAFT_RAYS) {
    const e = Math.abs(off - ru) / rw;
    if (e < 1 && tt > end) s += 0.22 * (1 - e * e) * clamp((tt - end) / 0.25, 0, 1);
  }
  // the landing: the air just over the floor holds the most dust and light
  if (tt < 0.1) s += 0.1 * (1 - tt / 0.1) * core;
  s += (bayer4(X, Y) - 0.5) * 0.06;
  return s > 0.8 ? 3 : s > 0.48 ? 2 : s > 0.16 ? 1 : 0;
}

/** The shaft's rays: [centre across the shaft (-1..1), half width, where it fades out (0 floor .. 1 well)]. */
const SHAFT_RAYS: [number, number, number][] = [[-0.42, 0.1, 0.32], [0.08, 0.13, 0.52], [0.5, 0.08, 0.2]];

function bandsOf(v: number): number {
  return v > 0.8 ? 3 : v > 0.46 ? 2 : v > 0.2 ? 1 : 0;
}

// ---------------------------------------------------------------------------
// The mass round the opening (ref 06: the lit gate in a cool dark frame): the bay wall the Prize
// Court gate is cut through sinks into the cool dusk (two even steps over the plaster, one on the dado), never on
// the opening's ring (the day lights its stone). Painted just after the bay, before the services
// stand in front of it, so only the wall darkens.
// ---------------------------------------------------------------------------
export interface BayShadeP {
  /** The bay wall's ends and height (local px from the gate's centre on the floor), the opening's radius and centre height. */
  l: number;
  r: number;
  top: number;
  rad: number;
  cy: number;
  /** Where the gate stands (world px), so the service lamps in front of the wall can pool on it. */
  at?: At;
}

export const bayShade = definePainter<BayShadeP>("hall.bayshade", {
  bounds(p) {
    return [p.l, -p.top, p.r, 0];
  },
  paint(c, p) {
    // (hall loop round 2) the bay round the lit gate: a cool, quiet mass that keeps its structure (the
    // plaster two night steps, the dado, the scrolls and the windows' day one), the court's day thrown
    // back up off the lit floor round the ring's foot and along its moulding (sun steps, strongest at the
    // sill, falling off up and out across the plaster), and the service lamps in front of the wall lighting
    // its relief: the stiles' faces toward the lamp, the rails' tops, the plaster between them a step
    const g = gateGeo(p);
    const clear = g.R + g.RING + 0.5;
    const cl = clerestoryBoxes(g), sc = scrollBoxes(g);
    const st = stiles(g);
    const SW = Math.round(0.085 * H);
    // the bay wall's rails (gate.ts bayWall): the mid rail, the low rail over the dado, the dado's top
    const RAIL_MID = -2.55 * H, DADO_H = Math.round(0.42 * H), RAIL_LOW = -DADO_H - 0.08 * H;
    const lamps: Pool[] = [];
    if (p.at) {
      const gx = p.at.wx, fy = p.at.wy;
      for (const L of HALL_LIGHT.lights) {
        if (L.kind !== "point" || fy - L.y > 4 * H) continue;
        const lx = L.x - gx;
        if (lx < p.l - H || lx > p.r + H || Math.abs(lx) < p.rad + 0.5 * H) continue;
        lamps.push({ x: lx, y: L.y - fy, r: 1.5 * H, k: Math.min(0.85, L.k) });
      }
    }
    // the gate's head (the plaque's red, the beam, the canopy's tiles, the teal paint) holds a step better
    const accent = new Set<number>([...P.red, ...P.gold, ...P.tile, ...P.jade]);
    const plaqueY1 = g.CY - g.R - g.RING - 5, plaqueY0 = plaqueY1 - 0.4 * H;
    const inBox = (b: [number, number, number, number], lx: number, ly: number, m = 0): boolean => lx > b[0] - m && lx < b[2] + m && ly > b[1] - m && ly < b[3] + m;
    tint(c, p.l, -p.top, p.r, -1, (X, Y, lx, ly) => {
      const d = Math.hypot(lx, ly - g.CY);
      if (d < clear && ly < -1) return null;
      // the keystone over the ring is the ring's own stone
      if (Math.abs(lx) < 10 && ly > plaqueY1 - 1 && ly < g.CY - g.R + 3) return null;
      const j = (vnoise(lx * 0.045, ly * 0.045, 19) - 0.5) * 0.16 + (vnoise(lx * 0.2, ly * 0.2, 23) - 0.5) * 0.04;
      // --- how much it sinks
      let shade = ly > -0.42 * H ? 1 : 2;
      if (cl.some((b) => inBox(b, lx, ly, -4))) shade = 1;
      if (sc.some((b) => inBox(b, lx, ly, 4))) shade = 1;
      const col = c.buf.get(X, Y);
      if (accent.has(col)) {
        const plaque = Math.abs(lx) < 0.8 * H && ly > plaqueY0 - 1 && ly < plaqueY1 + 1;
        shade = plaque ? 0 : Math.max(0, shade - 1);
      }
      // --- the court's day thrown back up off the lit floor and the sill: up the ring's foot and out
      // along the wall's foot, and a thin glow along the moulding, brighter low down
      const out = d - clear;
      const lowness = clamp((ly - g.CY) / g.R, -1, 1); // -1 at the top .. 1 at the sill
      const bounce = Math.pow(clamp(1 - -ly / (1.9 * H), 0, 1), 1.5) * clamp(1 - (Math.abs(lx) - g.R * 0.55) / (2.0 * H), 0, 1);
      const rim = clamp(1 - out / (0.2 * H), 0, 1) * (0.45 + 0.55 * clamp(lowness + 0.4, 0, 1));
      const day = Math.max(bounce * 1.15, rim * 0.8) + j;
      let sunN = day > 0.82 ? 2 : day > 0.36 ? 1 : 0;
      // --- the lamps in front of the wall light the panel behind them: strongest just above the lamp,
      // falling off up the plaster, stopped at the stiles either side (each throws the panel beyond into
      // its shade); the stiles' faces turned to the lamp and the rails' top edges catch it hardest
      // (round 2, W2-6: the pools read as a dome and a rounded block, a panel filled edge to edge) a lamp's light is
      // drawn by the relief it rakes across: the stile faces turned to it and the rails' top edges over it catch it
      // in bright strips, the flat plaster takes only a faint warmth that fades out inside its own panel; the
      // stiles either side of the lamp's panel throw the near part of the panels beyond into their shadow
      let lamp = 0;
      const railTop = Math.abs(ly - (RAIL_MID - 0.045 * H)) < 2.5 || Math.abs(ly - RAIL_LOW) < 2.5 || Math.abs(ly + DADO_H) < 2.5;
      for (const q of lamps) {
        const dy = ly - q.y;
        // a lamp standing on a service lights up the wall (the service hides what is under it); a
        // lantern hanging free lights it above and below
        const hanging = q.y < -2 * H;
        // (integration, round 2: a falloff linear in height pinched the pool's contours into points at its ends, a lens
        // with arrowhead tips either side of the lamp) one smooth bell, wider than tall, reaching less far over a
        // lantern (its cap shades the wall above it) than under it; a lamp on a service lights only up the wall
        const rx = (hanging ? 1.35 : 1.15) * H;
        const ry = dy < 0 ? (hanging ? 0.95 : 1.7) * H : (hanging ? 1.15 : 0.3) * H;
        const d2 = ((lx - q.x) / rx) ** 2 + (dy / ry) ** 2;
        if (d2 >= 1) continue;
        const f = (1 - d2) ** 1.5;
        // (integration, round 2: the pool stopped dead at the stiles either side of its lamp, a lit rectangle with ruled
        // sides, and the light let through beyond them came out as small arrowhead wedges) the plaster takes one
        // falloff right across the stiles; each stile stands a few px proud of the plaster, so it throws a narrow shadow
        // on the side away from the lamp, wider the further it stands from the lamp, its edge dithered over a few px;
        // the stile's edge turned to the lamp catches it in a bright strip, its face a little
        let v = q.k * f * 0.85, lit = 1;
        for (const sx of st) {
          const toS = sx - q.x, toP = lx - q.x;
          if (Math.abs(lx - sx) <= SW / 2) {
            const lampSide = toS > 0 ? lx < sx - SW / 2 + 2.5 : lx > sx + SW / 2 - 2.5;
            v = q.k * f * (lampSide && Math.abs(toS) > SW ? 1.5 : 0.5);
            continue;
          }
          if (Math.sign(toS) !== Math.sign(toP) || Math.abs(toP) < Math.abs(toS)) continue;
          const beyond = Math.abs(toP) - Math.abs(toS) - SW / 2;
          const sw = SW * 0.45 + Math.abs(toS) * 0.09;
          const soft = clamp((beyond - sw) / 5, 0, 1);
          if (soft < 1 && soft <= bayer4(X, Y)) lit = 0.3;
        }
        v *= lit;
        // a rail's top edge catches a lamp hung over it (a hanging lantern lights the rails below it)
        if (railTop && dy > 0) v = Math.max(v, q.k * f * 1.4);
        lamp = Math.max(lamp, v);
      }
      const lv = lamp + j * 0.6 + (bayer4(X, Y) - 0.5) * (lamp > 0.08 ? 0.12 : 0.04);
      const warmN = lv > 0.8 ? 4 : lv > 0.56 ? 3 : lv > 0.33 ? 2 : lv > 0.15 ? 1 : 0;
      // net of the light and the dusk, both on the wall's own colour (a pool brings the warm plaster back
      // and lifts it; the dusk sinks it): never a warm step laid over the dusk, which reads as a stain
      // (round 2, W2-6) a lamp's pool is laid over the dusk (the dusk first, the lamplight on it): it climbs from the
      // navy through the violet-brown into amber at its core, instead of netting back to the plaster's own grey-brown
      // (which read as a brown stain the shape of the pool)
      if (warmN > 0 && warmN >= sunN) return lutChain(["night", shade], ["warm", warmN]);
      const net = Math.max(warmN, sunN) - shade;
      if (net > 0) return lut(warmN >= sunN ? "warm" : "sun", net);
      if (net < 0) return lut("night", -net);
      return null;
    });
  },
});

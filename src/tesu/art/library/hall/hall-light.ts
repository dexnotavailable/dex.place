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
import { BACK_LANTERNS, HALL, HALL_LANTERNS, HALL_LIGHT, SERVICE_LAMPS, SHAFT } from "./lights.ts";
import { clamp, hash, vnoise, type At } from "./kit.ts";
import { bayer4 } from "../../raster.ts";
import { amberLut, chain2, dayLut, lut, lutChain, poolLut, tint } from "./tint.ts";
import { BAY as ROOF_BAY } from "./roof.ts";
import { UP, UPPER_KINDS, loftLampFrac, loftOpening } from "./upper.ts";
import { clerestoryBoxes, gateGeo, headBox, scrollBoxes, stiles } from "./gate.ts";
import { sillRail } from "./bay.ts";
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
          // the day through the doorway: across the walkway's lip and face in front of it (round 3, W2-6: it spread
          // over the stone floor too as a round beige halo; the floor below takes the day only as its reflection,
          // a narrow smear straight down, room.ts)
          if (dep > 0.46) continue;
          const u = (wx - cx) / (hw * (0.75 + dep * 0.3));
          sv += day * Math.max(0, 1 - u * u) * (dep < 0.13 ? 1.05 : 0.8 * (1 - (dep - 0.13) / 0.4));
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
        // (round 4, W2-e: the well's exemption reached down over the tie beam's top third, a ragged lighter patch on the
        // beam under the well: the beam takes the room's shade the same all along)
        const inWell = p.play && Math.abs(wx - SHAFT.x0) < 1.35 * H && wy > FY - 18.9 * H && wy < FY - 16.42 * H;
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
        // (round 3, W2-8) on the play plane the end's outer wall keeps its structure at a dim value: one step, not two
        const full = wy < FY - 2.2 * H && !p.play ? 2 : 1;
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
      // (round 3: it reached down over the red panels between the sets as dithered red patches: now only the cornice and
      // the sets' top caps)
      if (LOFTS.length && wy < FY - (UP.sets - 0.12) * H && wy > FY - UP.ceil * H) {
        const lo = LOFTS.find((q) => wx > q.x0 && wx < q.x1);
        if (lo) {
          if (wy < FY - UP.cornice * H) return null;
          const dx = (wx - lo.lamp) / (1.5 * H);
          // (round 3: a slow noise on its edge drew red blotches on the panels; an ordered dither at its edge instead)
          const sp = (1 - dx * dx) * (1 - (wy - (FY - UP.cornice * H)) / (0.55 * H)) + (bayer4(X, Y) - 0.5) * 0.18;
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
      // (round 3) the shaft starts at the well's mouth: the well itself paints its own day (roof.ts)
      if (p.play && wy > FY - 16.45 * H && wy < FY) {
        let n = shaftSteps(wx, wy, FY, X, Y);
        // (round 3, W2-4: where the shaft crossed the tie beam and the gallery's fascia it lit their whole faces, a lit
        // box) light falling from above lands on their tops: only the top few px of each take it, a step more
        const beamTop = FY - 16.42 * H, beamBot = FY - 15.5 * H;
        const fas0 = p.gallery - 2, fas1 = p.gallery + 0.62 * H + 2;
        if (wy > beamTop - 1 && wy < beamBot + 1) n = wy < beamTop + 4 && n > 0 ? Math.min(3, n + 1) : 0;
        else if (wy > fas0 && wy < fas1) n = wy < fas0 + 5 && n > 0 ? Math.min(3, n + 1) : 0;
        // (round 4, W2-f: across the gallery storey the shaft lit only the play plane's art screens, so its west side
        // ran down the screen group's own west edge as a lit glass column, the back wall beside it unlit) the gallery
        // storey takes no shaft body: the light shows there only where it lands, on the gallery floor's top and (the
        // balustrade's own painter) the rail tops; the screens keep the soft beam their own light field gives them
        else if (wy > beamBot && wy < fas0 - 4) n = 0;
        if (n > 0) return lutChain(lift > 0 ? ["warm", Math.min(3, lift)] : ["night", Math.min(3, -lift)], ["air", n]);
      }
      void warm; void night;
      // (round 2, W2-6) the same on the back wall: the lantern's warmth laid over the dusk, never the wall's own brown
      if (lift0 > 0 && shade > 0) return lutChain(["night", Math.min(3, shade)], ["warm", Math.min(4, lift0 + 1)]);
      return poolLut(Math.min(3, shade), Math.min(3, lift0));
    });
  },
});

/** The shaft's core strength at a world point: 0 outside .. 1 in its middle, falling off across it and fading from the
 *  well down to the floor (round 3: shared with the balustrade, which lights only its rail's top in it). */
export function shaftCore(wx: number, wy: number, FY: number): number {
  const tt = clamp((FY - wy) / (FY - SHAFT.y0), 0, 1); // 0 at the floor .. 1 at the well
  const ax = SHAFT.x1 + (SHAFT.x0 - SHAFT.x1) * tt;
  const half = (SHAFT.w / 2) * (1 - 0.15 * tt);
  const dd = Math.abs((wx - ax) / half);
  if (dd > 1.25) return 0;
  return clamp(1 - Math.pow(dd / 1.25, 2.2), 0, 1) * (0.5 + 0.5 * tt * tt);
}

/** The shaft's body at a world point: 0 (outside) .. 3 air steps. */
export function shaftSteps(wx: number, wy: number, FY: number, X = 0, Y = 0): number {
  const tt = clamp((FY - wy) / (FY - SHAFT.y0), 0, 1); // 0 at the floor .. 1 at the well
  const ax = SHAFT.x1 + (SHAFT.x0 - SHAFT.x1) * tt;
  const half = (SHAFT.w / 2) * (1 - 0.15 * tt);
  const off = (wx - ax) / half;
  // parallel light: the edges run straight down the slant but soft, two or three bands across them
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
  // (round 3, W2-4: the body ended on a ruled edge either side, a lit box) every band's edge is dithered over a wide
  // run: the shaft's sides fade out over 8-16 px
  s += (bayer4(X, Y) - 0.5) * 0.3;
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
    // (hall loop round 3) the bay round the lit gate: a cool, quiet mass that keeps its structure (the plaster two
    // night steps, the dado and the scrolls one), lit by two lights only:
    // - the court's day coming in through the gate (W2-2): a cool spill that fades over about 1.5 H round the ring,
    //   strongest low down where the lit floor throws it back up, caught hardest by what stands proud of the wall
    //   (the scrolls' faces, the canopy's underside and the plaque, the dado's cap and the low rail's top); the bay
    //   stays quiet beyond 2 H;
    // - each hanging lantern and the desk lamp (W2-1: the pools were grey-brown stains in four lobes): an amber
    //   pool, a hot core round the lamp, one smooth fall-off wider than tall laid right across the stiles (they
    //   catch it on their edges turned to the lamp, a thin shade on the far edge; they never carve it), the rail
    //   tops and the dado's cap under a hanging lantern catching it hardest.
    const g = gateGeo(p);
    const clear = g.R + g.RING + 0.5;
    const cl = clerestoryBoxes(g), sc = scrollBoxes(g);
    const st = stiles(g);
    const hb = headBox(g);
    const SW = Math.round(0.085 * H);
    // the bay wall's rails (gate.ts bayWall): the mid rail, the low rail over the dado, the dado's top
    const RAIL_MID = -2.55 * H, DADO_H = Math.round(0.42 * H), RAIL_LOW = -DADO_H - 0.08 * H;
    interface Lamp { x: number; y: number; k: number; hanging: boolean }
    const lamps: Lamp[] = [];
    if (p.at) {
      const gx = p.at.wx, fy = p.at.wy;
      const hung = HALL_LANTERNS.filter((l) => l.plane === "play" && l.y < 4).map((l) => ({ x: HALL.x0 + Math.round(l.o * H), y: fy - Math.round(l.y * H), k: l.k * 1.35, hanging: true }));
      // (the lamps standing on the services in front of the bay: the desk lamp on the counter, the paper lantern on the
      // pigeonhole cabinet's shoulder)
      // (a service's light at the same x as a hanging lantern is that lantern's light on the service: not a second lamp)
      const standing = SERVICE_LAMPS.filter((l) => fy - l.y < 2.2 * H && hung.every((q) => Math.abs(q.x - l.x) > 0.3 * H)).map((l) => ({ x: l.x, y: l.y, k: l.k, hanging: false }));
      for (const L of [...hung, ...standing]) {
        const lx = L.x - gx;
        if (lx < p.l - H || lx > p.r + H || Math.abs(lx) < p.rad + 0.5 * H) continue;
        lamps.push({ x: lx, y: L.y - fy, k: Math.min(0.9, L.k), hanging: L.hanging });
      }
    }
    // (round 4, W2-b: the pools were airbrush eggs in ordered-dither rings) ref 05 carves lamplight as SHAPES: every
    // plaster panel between the stiles and rails takes the lamps as one flat step, the panel a lamp hangs in two steps
    // up, the panels round it one, no gradient inside a panel; the stiles' and rails' edges turned to a lamp catch it a
    // step harder (the far edge a step less); a short hot streak on the plaster right behind each hanging lantern
    const SR1 = sillRail(cl[0]![3])[1];
    const FR_Y = -p.top + Math.round(0.42 * H) + 0.08 * H;
    // the bands (local y): the clerestories' band, the middle band, the low band over the dado, the dado
    const bands: [number, number][] = [[FR_Y, SR1], [SR1, RAIL_MID - 0.045 * H], [RAIL_MID + 0.045 * H, RAIL_LOW], [-DADO_H, 0]];
    const cols: [number, number][] = [];
    for (let i = 0; i <= st.length; i++) cols.push([i === 0 ? p.l : st[i - 1]! + SW / 2, i === st.length ? p.r : st[i]! - SW / 2]);
    // each lamp's own column: the panels between the two stiles either side of it
    const colOfLamp = new Map<Lamp, number>();
    const bandAt = (ly: number): number => bands.findIndex(([y0, y1]) => ly >= y0 && ly < y1);
    const colAt = (lx: number): number => { let i = 0; while (i < st.length && lx >= st[i]!) i++; return i; };
    for (const q of lamps) colOfLamp.set(q, colAt(q.x));
    /** A lamp's step on the panel of band bp, column ci (round 4, W2-b): one flat step per panel, never a gradient or
     *  a dither inside one. The panel a lamp hangs in front of takes two steps (one for a weak lamp); the panel over or
     *  under it in its column one step when the lamp hangs within 0.7 H of their rail, the panels beside it one step
     *  when it hangs within 0.5 H of their stile. */
    const lampStep = (q: Lamp, ci: number, bp: number): number => {
      const cq = colOfLamp.get(q)!, bq = bandAt(q.y);
      if (bp < 0 || bq < 0) return 0;
      let n = 0;
      if (ci === cq && bp === bq) n = q.k > 0.32 ? 2 : 1;
      // (the dado's ashlar under a lamp takes it as the low band does, a step at most)
      if (bp === 3 && n > 1) n = 1;
      else if (ci === cq && bp === bq + 1 && bp < 3) n = bands[bq]![1] - q.y < 0.7 * H ? 1 : 0;
      else if (ci === cq && bp === bq - 1) n = q.y - bands[bq]![0] < 0.7 * H ? 1 : 0;
      else if (bp === bq && Math.abs(ci - cq) === 1) {
        const sx = st[Math.min(ci, cq)]!;
        n = Math.abs(q.x - sx) < 0.5 * H ? 1 : 0;
      }
      return n;
    };
    // the rails: the mid rail and the low rail over the dado (their top edge 1.5 px)
    const railish = (ly: number): boolean => Math.abs(ly - RAIL_MID) < 0.045 * H || (ly >= RAIL_LOW && ly < -DADO_H);
    const railTopEdge = (ly: number): boolean => (Math.abs(ly - RAIL_MID) < 0.045 * H && ly < RAIL_MID - 0.045 * H + 1.5) || (ly >= RAIL_LOW && ly < RAIL_LOW + 1.5);
    // the gate's head (the plaque's red, the beam, the canopy's tiles, the teal paint) holds a step better
    const accent = new Set<number>([...P.red, ...P.gold, ...P.tile, ...P.jade]);
    const plaqueY1 = g.CY - g.R - g.RING - 5, plaqueY0 = plaqueY1 - 0.4 * H;
    const inBox = (b: [number, number, number, number], lx: number, ly: number, m = 0): boolean => lx > b[0] - m && lx < b[2] + m && ly > b[1] - m && ly < b[3] + m;
    const night = [null, lut("night", 1), lut("night", 2), lut("night", 3)] as const;
    const SKY = new Set<number>([...P.range, ...P.blue]);
    tint(c, p.l, -p.top, p.r, -1, (X, Y, lx, ly) => {
      const d = Math.hypot(lx, ly - g.CY);
      if (d < clear && ly < -1) return null;
      // the keystone over the ring is the ring's own stone
      if (Math.abs(lx) < 10 && ly > plaqueY1 - 1 && ly < g.CY - g.R + 3) return null;
      const j = (vnoise(lx * 0.045, ly * 0.045, 19) - 0.5) * 0.16 + (vnoise(lx * 0.2, ly * 0.2, 23) - 0.5) * 0.04;
      const bay = bayer4(X, Y) - 0.5;
      // --- how much it sinks
      let shade = ly > -0.42 * H ? 1 : 2;
      const col0 = c.buf.get(X, Y);
      if (cl.some((b) => inBox(b, lx, ly, -4))) {
        // (round 3, W2-3a) the clerestories' sky is the court's day: only their timber sinks
        if (SKY.has(col0)) return null;
        shade = 1;
      }
      const onScroll = sc.findIndex((b) => inBox(b, lx, ly, 4));
      if (onScroll >= 0) shade = 1;
      const col = col0;
      const plaque = Math.abs(lx) < 0.8 * H && ly > plaqueY0 - 1 && ly < plaqueY1 + 1;
      if (accent.has(col)) shade = plaque ? 0 : Math.max(0, shade - 1);

      // --- the court's day: a cool spill round the ring, fading over 1.5 H, more low down
      const out = Math.max(0, d - clear);
      const lowness = clamp((ly - (g.CY - 0.3 * g.R)) / (1.3 * g.R), 0, 1); // 0 high .. 1 at the floor
      const reach = (1.25 + 0.45 * lowness) * H;
      let day = Math.pow(clamp(1 - out / reach, 0, 1), 1.7) * (0.32 + 0.85 * lowness);
      // the lit floor in front of the sill throws it up the wall's foot either side of the ring
      const foot = clamp(1 - -ly / (0.95 * H), 0, 1) * clamp(1 - (Math.abs(lx) - g.R * 0.6) / (1.9 * H), 0, 1);
      day = Math.max(day, foot * 0.95);
      // what stands proud of the wall catches it hardest: the scrolls' faces (their edge toward the gate most), the
      // canopy's underside (the beam's soffit and the rafter ends, lit from below), the plaque, the dado's cap and
      // the low rail's top
      if (onScroll >= 0) {
        const [x0, , x1] = sc[onScroll]!;
        const toward = lx < 0 ? x1 - lx : lx - x0; // 0 at the edge toward the gate
        day = Math.max(day, 0.62 + (toward < 3 ? 0.3 : 0));
      }
      if (Math.abs(lx) < hb.cw + 2) {
        if (ly > hb.beam1 - 4 && ly < hb.beam1 + 1) day = Math.max(day, 0.98 - Math.abs(lx) / (hb.cw * 2.2));
        else if (ly > hb.beam0 - 9 && ly < hb.beam0) day = Math.max(day, 0.4 - Math.abs(lx) / (hb.cw * 3));
      }
      if (plaque) day = Math.max(day, 0.5);
      // (round 4, W2-h) the canopy's cast shadow: across the plaque's top and on the plaster either side of the beam,
      // under the eave, a step down and none of the day's lift
      const eaveY = hb.beam0 - 10;
      const castY = (plaque ? plaqueY0 + 0.12 * H : eaveY + 0.3 * H) + (vnoise(lx * 0.08, 3, 29) - 0.5) * 4;
      if (Math.abs(lx) < hb.ew - 6 && ly > eaveY && ly < castY && !(Math.abs(lx) < hb.cw + 2 && ly < hb.beam1 + 1)) {
        shade += 1;
        day *= 0.25;
      }
      // (round 3, W2-3a) a faint light on the plaster under each clerestory, through its lattice
      for (const b of cl) {
        const below = ly - (b[3] + 11);
        if (below < 0 || below > 0.5 * H) continue;
        const u = (lx - (b[0] + b[2]) / 2) / ((b[2] - b[0]) / 2 + 0.15 * H);
        if (Math.abs(u) < 1) day = Math.max(day, (1 - u * u) * (1 - below / (0.5 * H)) * 0.45);
      }
      const capTop = Math.abs(ly + DADO_H) < 2.2 || Math.abs(ly - RAIL_LOW) < 1.6;
      if (capTop) day *= 1.45;
      // (the gate's head, the plaque and the scrolls take it as one even step each: no dither speckle on them)
      const even = plaque || onScroll >= 0 || (Math.abs(lx) < hb.cw + 2 && ly > hb.beam0 - 9 && ly < hb.beam1 + 1);
      const dv = day + (even ? 0 : j * 0.8 + bay * (day > 0.1 ? 0.14 : 0.03));
      const dayN = dv > 1.0 ? 3 : dv > 0.62 ? 2 : dv > 0.3 ? 1 : 0;

      // --- the lamps (round 4, W2-b): one flat step per panel; the stiles and rails take the brighter panel beside
      // them, their edge turned to its lamp a step more, the far edge a step less; the hot streak behind a lantern
      let ambN = 0;
      const b = bandAt(ly);
      const ci = colAt(lx);
      const sti = st.findIndex((sx) => Math.abs(lx - sx) < SW / 2);
      let lit: Lamp | undefined;
      // (a member takes the brighter of the panels it stands between: a stile those either side in its band, a rail
      // those over and under it in its column)
      const nb = b >= 0 ? b : bands.findIndex(([y0]) => ly < y0);
      for (const q of lamps) {
        const v = sti >= 0 && b >= 0 ? Math.max(lampStep(q, sti, b), lampStep(q, sti + 1, b))
          : b < 0 ? Math.max(lampStep(q, ci, nb), lampStep(q, ci, nb - 1))
          : lampStep(q, ci, b);
        if (v > ambN) { ambN = v; lit = q; }
      }
      if (lit && b >= 3) ambN = Math.min(ambN, 1);
      if (lit && sti >= 0) {
        // a stile's edge turned to the lamp catches it a step harder, its far edge a step less
        const e = (lx - st[sti]!) * (Math.sign(lit.x - st[sti]!) || 1);
        if (e > SW / 2 - 2) ambN += 1;
        else if (e < -SW / 2 + 1.5) ambN -= 1;
      } else if (lit && b < 0 && railish(ly)) {
        // a rail's top edge catches a lamp over it; its underside one under it
        ambN += lit.y < ly ? (railTopEdge(ly) ? 1 : 0) : railTopEdge(ly) ? -1 : 1;
      } else if (lit && b >= 0 && b < 3) {
        // the plaster's recess along a panel's edge turned to its lamp is the arris that catches it
        const [x0, x1] = cols[ci]!, [y0, y1] = bands[b]!;
        const edgeX = lit.x < x0 ? lx - x0 : lit.x > x1 ? x1 - lx : Infinity;
        const edgeY = lit.y < y0 ? ly - y0 : lit.y > y1 ? y1 - ly : Infinity;
        if (Math.min(edgeX, edgeY) < 1.2) ambN += 1;
      }
      // the hot streak: a narrow upright oval of light on the plaster right behind a hanging lantern (its ends show
      // over and under the lantern)
      for (const q of lamps) {
        if (!q.hanging) continue;
        const u = (lx - q.x) / (0.17 * H), v = (ly - q.y) / (0.36 * H);
        const r2 = u * u + v * v;
        if (r2 < 1) ambN = Math.max(ambN, r2 < 0.4 ? 5 : 4);
      }
      ambN = clamp(ambN, 0, 5);
      const lamp = ambN > 0 ? 0.3 + 0.2 * ambN : 0;
      const base = night[Math.min(3, shade)] ?? null;
      // (the steps: 1 a warm lift for the panels round a lamp, 2 the lamp's own panel in amber, 3 the edges turned to
      // it, 4 and 5 the hot ring and core right behind a lantern)
      if (ambN > 0 && lamp >= day) return chain2(base, ambN === 1 ? lut("warm", 1) : amberLut(ambN === 2 ? 1 : ambN === 3 ? 2 : ambN === 4 ? 3 : 5));
      // (the plaque's red and the gold keep their colour in the day: a plain lift)
      if (dayN > 0) return chain2(base, accent.has(col) ? lut("sun", dayN) : dayLut(dayN));
      return base;
    });
  },
});

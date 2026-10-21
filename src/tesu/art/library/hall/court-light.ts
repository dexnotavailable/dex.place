// The Prize Court's sunlight landing (the hall loop, round 1; round 2: onto the podium's face, side-on):
// every standing thing on the court throws its shadow, and the spectators are a crowd, not a picket.
//
// The sun is up and to the left and a little in front of us (COURT_LIGHT), so a thing standing
// on the walk line throws its shadow back across the arena floor and to the right: the floor's
// band recedes upward on screen, so a post's shadow runs up and to the right from its foot, a
// beam's shadow lies across the floor as a bar further back, the gong's disc lands as an oval
// patch. Each pixel of the floor asks "which point of which caster stands between me and the
// sun" (a true projection of the casters' side-on silhouettes), and darkens by whole ramp steps
// toward the sky's cool (tint.ts): a hard core, a narrow penumbra that widens with height, and a
// dark contact line at every foot (ref 01: the near bench and bins throw hard dark shadows).

import { definePainter, type PaintCtx } from "../../painter.ts";
import { P } from "../../palette.ts";
import { M, clamp, fbm, hash, line, rect, tn, type Ramp } from "./kit.ts";
import { lut, tint } from "./tint.ts";

/**
 * A caster's solid part, side-on, in the shadow painter's local px: x along the court, z the
 * height above the walk line (up is positive). Boxes, discs, and slender rods leaning by `lean`
 * px over their height.
 */
export type Caster =
  | { box: [number, number, number, number] }
  | { disc: [number, number, number] }
  | { rod: [number, number, number, number] };

export interface ShadowsP {
  /** The arena floor's band: how far it runs up from the walk line (px), and how long it is. */
  band: number;
  w: number;
  /** Height (px) whose shadow lands on the floor's far edge, and how far right a point's shadow
   *  moves per px of its height. */
  reach: number;
  slant: number;
  casters: Caster[];
}

function inside(cs: readonly Caster[], x: number, z: number, pen: number): number {
  // the deepest the point lies inside any caster, in px (negative: outside, by that much)
  let best = -Infinity;
  for (const k of cs) {
    let d: number;
    if ("box" in k) {
      const [x0, x1, z0, z1] = k.box;
      if (z < z0 - pen || z > z1 + pen) continue;
      d = Math.min(x - x0, x1 - x, (z - z0) * 2, (z1 - z) * 2);
    } else if ("disc" in k) {
      const [cx, cz, r] = k.disc;
      d = r - Math.hypot(x - cx, z - cz);
    } else {
      const [bx, w, z0, z1] = k.rod;
      if (z < z0 || z > z1) continue;
      d = w / 2 - Math.abs(x - bx);
    }
    if (d > best) best = d;
  }
  return best;
}

export const courtShadows = definePainter<ShadowsP>("court.shadows", {
  bounds(p) {
    return [0, -p.band - 0.4 * 96, p.w, 3];
  },
  paint(c, p) {
    // (hall loop round 2, W2-10) side-on: the floor is a line, the band behind it is the podium's face
    // (court-stone.ts). The sun is up and to the left and a little in front, so a thing on the walk line
    // throws its shadow onto that face shifted right by WX and down by WZ (the face stands that far
    // behind): a wall point (x, z) is in shadow when (x - WX, z + WZ) lies inside a caster. On the walk
    // line itself only the contact shadow shows: a thin dark sliver running right from every foot.
    const WX = 0.46 * 96, WZ = 0.24 * 96;
    void p.reach; void p.slant;
    const one = lut("day", 1), two = lut("day", 2), three = lut("day", 3);
    const feet: [number, number][] = [];
    for (const k of p.casters) {
      if ("box" in k && k.box[2] <= 1) feet.push([k.box[0], k.box[1]]);
      if ("rod" in k && k.rod[2] <= 1) feet.push([k.rod[0] - k.rod[1] / 2, k.rod[0] + k.rod[1] / 2]);
    }
    // only the podium (its haze stone), the ring's kerb and their moss take it: never what stands in front
    const paving = new Set<number>([...P.karst, ...P.earth, ...P.moss]);
    tint(c, 0, -p.band - 0.4 * 96, p.w, 1, (X, Y, lx, ly) => {
      if (!paving.has(c.buf.get(X, Y))) return null;
      const z = -ly;
      let n = 0;
      // the face: the casters' silhouettes thrown back onto it, a hard core and a one-px penumbra
      // broken by the stone's grain
      const grit = (fbm(lx * 0.23, ly * 0.23, 31, 2) - 0.5) * 1.4;
      const d = inside(p.casters, lx - WX, z + WZ, 1) + grit;
      if (d > 1) n = 2;
      else if (d > -1) n = 1;
      // the contact line on the walk line: right at a foot and running right from it
      if (z < 4) {
        for (const [a, b] of feet) {
          if (lx > a - 1 && lx < b + 4 + (4 - z) * 2) { n = Math.max(n, 1) + (z < 2 && lx < b + 3 ? 1 : 0); break; }
        }
      }
      if (n >= 3) return three;
      return n === 2 ? two : n === 1 ? one : null;
    });
  },
});

// ---------------------------------------------------------------------------
// The crowd on the tiers (a sprite on the back plane, drawn over the court.tiers piece; frames
// as the old paper stands: 0 and 1 idle with a sway, 2 cheering, 3 hushed and leaning in).
// Tiny people, side-on, every one different: robes in the land's colours, straw hats, buns and
// caps, parasols, a raised fist, a child on a parent's shoulders, a pennant waved, some sitting;
// gaps and empty seats; lit from the upper left with their shadows on the riser behind; the back
// rows hazier and cooler. Ref 06's stair crowd: varied dark silhouettes, never a picket.
// ---------------------------------------------------------------------------
export interface CrowdP {
  w: number;
  rows?: number;
  frame?: number;
  tiers?: boolean;
}

// (hall loop round 2, W2-12: round 1's crowd still read as one peg shape in even rows) people with
// shoulders and sleeves, every one its own height and pose: standing, sitting, leaning on the rail on
// their forearms, an arm up, a kerchief or a fan waved, a pennant, a parasol, a wide straw hat, a child
// on a parent's shoulders, a vendor with a tray on a strap; packed in knots that overlap, with a gap or
// two along each row; the far rows stepped back into the air (two haze steps for the top row).
// (round 4, W1-h) "banner": a long swallowtail banner held up on a pole over the heads
type Kind = "robe" | "straw" | "bun" | "cap" | "parasol" | "kid" | "seated" | "fist" | "pennant" | "fan" | "elder" | "lean" | "vendor" | "wave" | "banner";
const KINDS: Kind[] = ["robe", "straw", "bun", "lean", "cap", "seated", "fist", "robe", "kid", "bun", "fan", "lean", "straw", "parasol", "robe", "wave", "elder", "seated", "pennant", "cap", "lean", "bun"];
const ROBE_SET: Ramp[] = [P.blue, P.earth, P.jade, M.verm, P.mauve, P.timber, P.blue, P.earth, P.tile, P.moss, P.violet, P.red, P.timber, P.paper];
const HAIR: Ramp = [P.ink[1]!, P.ink[0]!, P.umber[5]!];

/** Lit on the left, turning away on the right, a dark seam at the right edge. */
function sideTone(ramp: Ramp, u: number, X: number, Y: number, base = 0.3): number {
  const t = u < -0.35 ? base - 0.18 : u < 0.3 ? base : base + 0.25;
  return tn(ramp, clamp(u > 0.8 ? t + 0.22 : t, 0, 1), X, Y, 0.2);
}

function blob(c: PaintCtx, cx: number, cy: number, rx: number, ry: number, col: (X: number, Y: number, u: number, v: number) => number): void {
  rect(c, cx - rx - 0.5, cy - ry - 0.5, cx + rx + 0.5, cy + ry + 0.5, (X, Y, lx, ly) => {
    const u = (lx - cx) / rx, v = (ly - cy) / ry;
    return u * u + v * v > 1.05 ? 0 : col(X, Y, u, v);
  });
}

interface Fig {
  x: number; foot: number; kind: Kind; robe: Ramp; seed: number; f: number; rail: number;
}

/** A person (body with shoulders and sleeves, head, what they hold); every part `shadow` when given. */
function person(c: PaintCtx, g: Fig, shadow: number | null): void {
  const { kind, f, seed } = g;
  const S = shadow;
  const sway = f === 1 ? (seed > 0.5 ? 1 : -1) : 0;
  const hush = f === 3;
  const cheer = f === 2;
  const hop = cheer && seed > 0.35 && kind !== "seated" && kind !== "lean" ? -2 : 0;
  const lean = kind === "lean" || (hush && seed > 0.6);
  const seated = kind === "seated";
  const vendor = kind === "vendor";
  // height: adults 18-23 px, the seated and the leaning lower, elders stooped
  const tall = seated ? 13 : lean ? 15 : kind === "elder" ? 17 : 18 + Math.round(seed * 5);
  const x = g.x + sway + (S !== null ? 3 : 0);
  const y0 = g.foot + hop + (S !== null ? 2 : 0);
  const headR = 2.5 + (seed > 0.7 ? 0.3 : 0);
  const hy = y0 - tall + headR;
  const sh = hy + headR + 1; // the shoulder line
  const shw = 3.6 + seed * 1.1 + (kind === "elder" ? -0.3 : 0); // half the shoulders
  const hemw = seated ? shw + 2.2 : shw + 0.8 + seed * 1.2;
  const fwd = lean ? 2 : 0; // the body bent toward the rail
  const robe = (X: number, Y: number, u: number, base = 0.3) => (S !== null ? S : sideTone(g.robe, u, X, Y, kind === "elder" ? 0.45 : base));
  // the body: sloped shoulders, sleeves hanging wide, the robe falling to the hem (the rail hides the feet)
  rect(c, x - hemw - 2, sh - 1, x + hemw + 2 + fwd, y0, (X, Y, lx, ly) => {
    const t = (ly - sh) / Math.max(1, y0 - sh);
    const cx = x + fwd * (1 - t);
    // shoulders: rounded at the top corners
    const half = t < 0.12 ? shw - (1 - t / 0.12) * 1.4 : shw + (hemw - shw) * Math.min(1, (t - 0.12) * 1.3);
    // the sleeves stand out a little at the elbows
    const sleeve = t > 0.25 && t < 0.62 && !lean ? 0.9 : 0;
    const u = (lx - cx) / (half + sleeve);
    if (Math.abs(u) > 1) return 0;
    if (S === null) {
      // a sash, and the sleeve's edge as a darker fold
      if (Math.abs(t - 0.45) < 0.06 && seed > 0.25) return tn(seed > 0.7 ? M.gold : seed > 0.45 ? P.ink : M.verm, 0.4, X, Y, 0);
      if (sleeve && Math.abs(Math.abs(u) - 0.78) < 0.08 && t > 0.3) return sideTone(g.robe, u, X, Y, 0.48);
    }
    return robe(X, Y, u);
  });
  // leaning on the rail: the forearms laid along it in front of the body
  if (lean) {
    rect(c, x - shw - 1, g.rail - 3, x + shw + 3, g.rail - 1, (X, Y, lx) => (S !== null ? S : lx > x + shw ? tn(P.skin, 0.4, X, Y, 0) : sideTone(g.robe, (lx - x) / shw, X, Y, 0.38)));
  }
  // the head, hair and what is on it
  const hx = x + fwd * 1.2 + (hush ? 1 : 0);
  blob(c, hx, hy, headR, headR + 0.3, (X, Y, u, v) => {
    if (S !== null) return S;
    const profile = seed > 0.55;
    if (v < -0.35 || (profile ? u < -0.45 : u > 0.6)) return tn(HAIR, v < -0.6 && u < -0.2 ? 0.0 : 0.5, X, Y, 0);
    return tn(P.skin, u < -0.2 ? 0.12 : 0.45, X, Y, 0);
  });
  const ink = (X: number, Y: number, t = 0.5) => (S !== null ? S : tn(HAIR, t, X, Y, 0));
  if (kind === "straw" || vendor) {
    // a wide conical straw hat: a flat triangle, lit on its left slope
    rect(c, hx - 7, hy - 6, hx + 7, hy - 1, (X, Y, lx, ly) => {
      const u = (lx - hx) / 7, top = hy - 6 + Math.abs(u) * 4.2;
      if (ly < top) return 0;
      return S !== null ? S : tn(P.earth, u < -0.1 ? 0.05 : u < 0.5 ? 0.25 : 0.55, X, Y, 0.2);
    });
  } else if (kind === "bun" || kind === "fan" || kind === "wave") {
    blob(c, hx + (seed > 0.55 ? -2 : 1), hy - 2.6, 1.6, 1.4, (X, Y, u) => ink(X, Y, u < 0 ? 0.0 : 0.6));
    if (S === null && seed > 0.4) c.buf.set(Math.round(c.X(hx + 1.5)), Math.round(c.Y(hy - 3.6)), seed > 0.7 ? P.red[2]! : P.gold[2]!);
  } else if (kind === "cap" || kind === "elder") {
    rect(c, hx - 3, hy - 4, hx + 3, hy - 1.5, (X, Y, lx) => ink(X, Y, lx < hx ? 0.0 : 0.6));
    if (kind === "elder") rect(c, hx - 1, hy + 2, hx + 1.5, hy + 5, (X, Y) => (S !== null ? S : tn(P.paper, 0.2, X, Y, 0)));
  }
  // arms and what they hold
  const arm = (ax: number, ay: number, bx: number, by: number) => {
    const n = Math.max(2, Math.ceil(Math.hypot(bx - ax, by - ay) * c.d));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const X = Math.round(c.X(ax + (bx - ax) * t)), Y = Math.round(c.Y(ay + (by - ay) * t));
      c.buf.set(X, Y, S !== null ? S : t > 0.82 ? P.skin[1]! : tn(g.robe, 0.32, X, Y, 0));
      c.buf.set(X + 1, Y, S !== null ? S : t > 0.82 ? P.skin[2]! : tn(g.robe, 0.6, X + 1, Y, 0));
    }
  };
  const up = kind === "fist" || kind === "wave" || (cheer && seed > 0.4 && !lean && kind !== "parasol");
  if (up) {
    const reach = cheer ? 2 : 0;
    arm(x - shw + 1, sh + 1, x - shw - 2 + sway, sh - 8 - reach);
    if (kind === "wave" && S === null) rect(c, x - shw - 6 + sway, sh - 12 - reach, x - shw - 1 + sway, sh - 8 - reach, (X, Y, lx, ly) => ((lx + ly + f) % 3 < 2 ? tn(seed > 0.5 ? P.paper : M.verm, 0.2, X, Y, 0) : 0));
    if (cheer && seed > 0.7) arm(x + shw - 1, sh + 1, x + shw + 2, sh - 7);
  }
  if (kind === "parasol") {
    const px = x + 3, top = sh - 13 - (cheer ? 2 : 0);
    rect(c, px - 0.5, top, px + 0.5, sh + 4, () => (S !== null ? S : P.umber[3]!));
    const pr: Ramp = seed > 0.6 ? M.verm : seed > 0.3 ? P.blue : P.paper;
    rect(c, px - 9, top - 1, px + 9, top + 4, (X, Y, lx, ly) => {
      const u = (lx - px) / 9;
      const crown = top - 1 + u * u * 4.5;
      if (ly < crown || Math.abs(u) > 1) return 0;
      if (S !== null) return S;
      const rib = Math.abs(((u * 2.5) % 1 + 1) % 1 - 0.5) < 0.08;
      return tn(pr, (u < -0.2 ? 0.1 : u < 0.4 ? 0.3 : 0.55) + (ly > top + 2.5 ? 0.2 : 0) + (rib ? 0.2 : 0), X, Y, 0.2);
    });
  } else if (kind === "pennant") {
    const px = x - 4, top = sh - 14 - (cheer ? 4 : 0);
    rect(c, px - 0.5, top, px + 0.5, sh + 3, () => (S !== null ? S : P.umber[3]!));
    const flap = f % 2 === 0 ? 1 : -1;
    rect(c, px, top, px + 10, top + 6, (X, Y, lx, ly) => {
      const t = (lx - px) / 10;
      const mid = top + 3 + t * flap * 1.2;
      if (Math.abs(ly - mid) > 3 * (1 - t)) return 0;
      return S !== null ? S : tn(seed > 0.5 ? M.verm : P.gold, t < 0.5 ? 0.25 : 0.45, X, Y, 0.2);
    });
  } else if (kind === "fan") {
    const fx = x + shw + 2, fy = sh + (cheer ? -3 : 2);
    blob(c, fx, fy, 3.5, 2.6, (X, Y, u, v) => (S !== null ? S : v > 0.5 ? tn(P.umber, 0.4, X, Y, 0) : tn(seed > 0.5 ? M.verm : P.paper, u < 0 ? 0.15 : 0.4, X, Y, 0.2)));
  } else if (kind === "kid") {
    // a child on the shoulders: a small body over the head, legs either side
    const kx = hx, ky = hy - 3.5;
    rect(c, kx - 2.6, ky - 5.5, kx + 2.6, ky + 1, (X, Y, lx) => (S !== null ? S : sideTone(seed > 0.5 ? P.gold : M.verm, (lx - kx) / 2.6, X, Y, 0.25)));
    blob(c, kx, ky - 7.6, 2.0, 2.2, (X, Y, u, v) => (S !== null ? S : v < -0.3 ? tn(HAIR, 0.3, X, Y, 0) : tn(P.skin, u < 0 ? 0.15 : 0.45, X, Y, 0)));
    for (const s of [-1, 1]) rect(c, kx + s * 2.6 - 0.5, ky, kx + s * 2.6 + 1, ky + 4, (X, Y) => (S !== null ? S : tn(seed > 0.5 ? P.gold : M.verm, 0.5, X, Y, 0)));
    if (cheer) arm(kx - 2, ky - 4, kx - 4, ky - 11);
  } else if (kind === "banner") {
    // (round 4, W1-h) a long swallowtail banner on a pole held up over the heads, its cloth lifting in the wind
    const px = x + 2, top = sh - 27 - (cheer ? 3 : 0);
    rect(c, px - 0.5, top - 1, px + 0.5, sh + 4, () => (S !== null ? S : P.umber[3]!));
    rect(c, px - 1, top - 1, px + 10, top, () => (S !== null ? S : P.gold[2]!));
    const flap = f % 2 === 0 ? 1 : -1;
    rect(c, px - 2, top, px + 12, top + 17, (X, Y, lx, ly) => {
      const t = (ly - top) / 16;
      const u = (lx - px - Math.sin(t * 3 + f) * 1.3 * t * flap) / 9;
      if (u < 0.05 || u > 1 || t > 1) return 0;
      if (t > 0.84 && Math.abs(u - 0.52) < (t - 0.84) * 3.2) return 0;
      if (S !== null) return S;
      if (u < 0.17 || u > 0.88) return tn(P.gold, 0.3, X, Y, 0);
      return tn(seed > 0.5 ? M.verm : P.blue, u < 0.5 ? 0.22 : 0.42, X, Y, 0.2);
    });
    arm(x - shw + 1, sh + 1, px - 1, sh - 7);
  } else if (vendor) {
    // a tray on a strap: a plank at the chest with buns and cups on it
    const ty = sh + 5;
    rect(c, x - shw - 4, ty, x + shw + 4, ty + 2, (X, Y) => (S !== null ? S : tn(P.timber, 0.35, X, Y, 0)));
    if (S === null) for (let k = 0; k < 4; k++) blob(c, x - shw - 2 + k * 3.2, ty - 1.2, 1.2, 1.1, (X, Y, u) => tn(k % 2 ? P.paper : P.earth, u < 0 ? 0.1 : 0.4, X, Y, 0));
    line(c, x - shw + 1, sh, x + shw + 3, ty, S !== null ? S : P.umber[3]!);
  }
}

export const crowd = definePainter<CrowdP>("court.crowd", {
  bounds(p) {
    const rows = p.rows ?? 3;
    return [-p.w / 2 - 14, -rows * 34 - 76, p.w / 2 + 14, 4];
  },
  paint(c, p) {
    const rows = p.rows ?? 3;
    const f = p.frame ?? 0;
    const hw = p.w / 2;
    const haze = lut("haze", 1), haze2 = lut("haze", 2), shade = lut("day", 1);
    for (let r = rows - 1; r >= 0; r--) {
      const top = -r * 34 - 20, inset = r * 26;
      const x0 = -hw + inset + 12, x1 = hw - inset - 12;
      // knots of 2-7 people, overlapping, with a gap or two along the row; vendors work the row's ends
      // (round 4, W1-h: "three strict, evenly spaced rows") a dense knot behind the ring's middle (the stands' centre
      // is the ring's), thinning toward the ends into small groups with wide gaps; some stand up out of the row (the
      // wavers, the fists, the banners), the rest sit a pixel or two higher or lower, so no row of heads is a ruled
      // line; a held banner or two over each row's middle knot
      const figs: Fig[] = [];
      let x = x0 + hash(r, 1, c.seed) * 8;
      let i = 0, banners = 0;
      while (x < x1) {
        const d = Math.min(1, Math.abs(x) / (hw * 0.82));
        const k = Math.max(1, Math.round((2 + hash(i, r + 7, c.seed) * 6) * (1.15 - d * 0.75)));
        for (let j = 0; j < k && x < x1; j++, i++) {
          const s = hash(i, r * 13 + 3, c.seed);
          let kind = KINDS[Math.floor(hash(i, r * 13 + 5, c.seed) * KINDS.length)]!;
          if ((x < x0 + 30 || x > x1 - 30) && hash(i, r, 41) < 0.4) kind = "vendor";
          const dx = Math.min(1, Math.abs(x) / (hw * 0.82));
          if (dx < 0.45 && banners < (r === 0 ? 2 : 1) && hash(i, r * 13 + 23, c.seed) < 0.16 && kind !== "vendor") { kind = "banner"; banners++; }
          else if (dx < 0.4 && kind === "robe" && hash(i, r * 13 + 25, c.seed) < 0.5) kind = "wave";
          const stand = kind === "wave" || kind === "fist" || kind === "banner" || kind === "pennant" ? -3 : 0;
          const jit = Math.round((hash(i, r * 13 + 27, c.seed) - 0.5) * 3);
          figs.push({ x, foot: top - 1 + stand + jit, kind, robe: ROBE_SET[Math.floor(hash(i, r * 13 + 9, c.seed) * ROBE_SET.length)]!, seed: s, f, rail: top - 8 });
          x += (5 + hash(i, r * 13 + 11, c.seed) * 3) * (1 + dx * 0.5) + (kind === "parasol" ? 6 : kind === "straw" || kind === "vendor" ? 3 : 0);
        }
        const gapP = 0.12 + d * 0.6;
        x += hash(i, r + 17, c.seed) < gapP ? (22 + hash(i, r + 19, c.seed) * 34) * (0.6 + d) : 3 + hash(i, r + 21, c.seed) * 6;
      }
      // the shadows first, on the riser of the row behind (above this row's rail), then the people:
      // every other one first, so the knots overlap front and back instead of in a stack
      const riser = P.stone[5]!;
      const clipTop = top - 9;
      for (const g of figs) personClipped(c, g, riser, clipTop);
      figs.forEach((g, j) => { if (j % 2 === 1) person(c, g, null); });
      figs.forEach((g, j) => { if (j % 2 === 0) person(c, g, null); });
      // the rows further back sit in more air: lighter, cooler, flatter
      // (round 3, W2-10) every row a step back in the air from the near court, the back rows further
      // (round 4, W2-i) the front row, nearest the ring, a step into the day's shade instead (its people behind the
      // ring's rope read against the ring, not as the brightest band)
      tint(c, -hw, top - 60, hw, top, (_X, _Y, _lx, ly) => (ly < top - 1 ? (r > 1 ? haze2 : r > 0 ? haze : shade) : null));
    }
  },
});

/** A person's shadow, clipped above a line (the rail in front hides the rest), only where empty. */
function personClipped(c: PaintCtx, g: Fig, col: number, clipY: number): void {
  const buf = c.buf;
  const yClip = c.Y(clipY);
  const clip = Object.create(buf) as typeof buf;
  clip.set = (X: number, Y: number, v: number) => { if (Y < yClip) buf.under(X, Y, v); };
  clip.under = clip.set;
  person({ ...c, buf: clip }, g, col);
}

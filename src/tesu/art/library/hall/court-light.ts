// The Prize Court's sunlight landing (the hall loop, round 1): every standing thing on the court
// throws its shadow across the paving, and the spectators are a crowd of people, not a picket.
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
import { M, clamp, fbm, hash, rect, tn, type Ramp } from "./kit.ts";
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
    return [0, -p.band - 2, p.w, 3];
  },
  paint(c, p) {
    const kd = p.band / p.reach;
    const one = lut("day", 1), two = lut("day", 2), three = lut("day", 3);
    // feet: the casters touching the walk line (their x ranges), for the contact line
    const feet: [number, number][] = [];
    for (const k of p.casters) {
      if ("box" in k && k.box[2] <= 1) feet.push([k.box[0], k.box[1]]);
      if ("rod" in k && k.rod[2] <= 1) feet.push([k.rod[0] - k.rod[1] / 2, k.rod[0] + k.rod[1] / 2]);
    }
    tint(c, 0, -p.band, p.w, 1, (_X, _Y, lx, ly) => {
      const depth = -ly;
      if (depth < -0.5) return null;
      const z = Math.max(0, depth) / kd;
      const x = lx - z * p.slant;
      // the penumbra widens with the height the shadow comes from; the stone's grain breaks its edge
      const pen = 1 + z * 0.035;
      const grit = (fbm(lx * 0.21, ly * 0.4, 31, 2) - 0.5) * 1.6;
      const d = inside(p.casters, x, z, pen) + grit;
      let n = 0;
      if (d > pen) n = 2;
      else if (d > -pen) n = 1;
      // the contact line: the floor right at a foot, and the shadow's root, one step darker
      if (depth < 5) {
        for (const [a, b] of feet) {
          if (lx > a - 1 && lx < b + 5 + depth * 0.6) { n = Math.max(n, 1) + (depth < 2.5 && lx < b + 3 ? 1 : 0); break; }
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

type Kind = "robe" | "straw" | "bun" | "cap" | "parasol" | "kid" | "seated" | "fist" | "pennant" | "fan" | "elder";
const KINDS: Kind[] = ["robe", "straw", "bun", "cap", "parasol", "kid", "seated", "fist", "pennant", "fan", "elder", "robe", "bun", "straw", "seated", "cap"];
const ROBES: Ramp[] = [P.blue, P.earth, P.stone, P.jade, M.verm, P.paper, P.mauve, P.timber, P.blue, P.earth, P.tile, P.moss];
const HAIR: Ramp = [P.ink[1]!, P.ink[0]!, P.umber[5]!];

/** Lit on the left, turning away on the right, a dark seam at the right edge. */
function sideTone(ramp: Ramp, u: number, X: number, Y: number, base = 0.3): number {
  const t = u < -0.35 ? base - 0.18 : u < 0.3 ? base : base + 0.25;
  return tn(ramp, clamp(u > 0.82 ? t + 0.2 : t, 0, 1), X, Y, 0.2);
}

function blob(c: PaintCtx, cx: number, cy: number, rx: number, ry: number, col: (X: number, Y: number, u: number, v: number) => number): void {
  rect(c, cx - rx - 0.5, cy - ry - 0.5, cx + rx + 0.5, cy + ry + 0.5, (X, Y, lx, ly) => {
    const u = (lx - cx) / rx, v = (ly - cy) / ry;
    return u * u + v * v > 1.05 ? 0 : col(X, Y, u, v);
  });
}

interface Fig {
  x: number; foot: number; kind: Kind; robe: Ramp; seed: number; f: number;
}

/** A person's silhouette (body, head, what they hold), drawn with col for every part. */
function person(c: PaintCtx, g: Fig, shadow: number | null): void {
  const { kind, f, seed } = g;
  const sway = f === 1 ? (seed > 0.5 ? 1 : -1) : 0;
  const lean = f === 3 ? 2 : 0;
  const hop = f === 2 && seed > 0.35 ? -2 : 0;
  const seated = kind === "seated";
  const tall = kind === "elder" ? -1 : 0;
  const shH = seated ? 15 : 21 + Math.round(seed * 3) + tall;
  const x = g.x + sway + (shadow !== null ? 3 : 0);
  const y0 = g.foot + hop + (shadow !== null ? 2 : 0);
  const sh = y0 - shH;
  const wTop = 3.4 + seed * 1.2, wBot = seated ? 6.5 : 5 + seed * 1.6;
  const S = shadow;
  const robe = (X: number, Y: number, u: number) => (S !== null ? S : sideTone(g.robe, u, X, Y, kind === "elder" ? 0.45 : 0.3));
  // the robe: a tapered body from the shoulders down behind the rail, a sash
  rect(c, x - wBot - 1, sh, x + wBot + 1 + lean, y0, (X, Y, lx, ly) => {
    const t = (ly - sh) / (y0 - sh);
    const hw = wTop + (wBot - wTop) * Math.min(1, t * 1.3);
    const cx = x + lean * (1 - t);
    const u = (lx - cx) / hw;
    if (Math.abs(u) > 1) return 0;
    if (S === null && Math.abs(t - 0.42) < 0.05 && seed > 0.3) return tn(seed > 0.7 ? M.gold : P.ink, 0.4, X, Y, 0);
    return robe(X, Y, u);
  });
  // the head, hair and what is on it
  const hx = x + lean * 1.4, hy = sh - 3.2;
  blob(c, hx, hy, 2.7, 3.0, (X, Y, u, v) => {
    if (S !== null) return S;
    if (v < -0.35 || u > 0.55) return tn(HAIR, v < -0.6 && u < -0.2 ? 0.0 : 0.5, X, Y, 0);
    return tn(P.skin, u < -0.2 ? 0.15 : 0.45, X, Y, 0);
  });
  const ink = (X: number, Y: number, t = 0.5) => (S !== null ? S : tn(HAIR, t, X, Y, 0));
  if (kind === "straw") {
    rect(c, hx - 6.5, hy - 5, hx + 6.5, hy - 1.5, (X, Y, lx, ly) => {
      const u = (lx - hx) / 6.5, top = hy - 5 + Math.abs(u) * 3.4;
      if (ly < top) return 0;
      return S !== null ? S : tn(P.earth, u < -0.1 ? 0.05 : u < 0.5 ? 0.25 : 0.55, X, Y, 0.2);
    });
  } else if (kind === "bun" || kind === "fan") {
    blob(c, hx + 0.6, hy - 3.4, 1.6, 1.4, (X, Y, u) => ink(X, Y, u < 0 ? 0.0 : 0.6));
    if (S === null && kind === "bun") c.buf.set(Math.round(c.X(hx + 2)), Math.round(c.Y(hy - 4)), seed > 0.5 ? P.red[2]! : P.gold[2]!);
  } else if (kind === "cap" || kind === "elder") {
    rect(c, hx - 3, hy - 4.5, hx + 3, hy - 1.8, (X, Y, lx) => ink(X, Y, lx < hx ? 0.0 : 0.6));
    if (kind === "elder") rect(c, hx - 1, hy + 2, hx + 1.5, hy + 5, (X, Y) => (S !== null ? S : tn(P.paper, 0.2, X, Y, 0)));
  }
  // arms and what they hold
  const hand = (ax: number, ay: number, bx: number, by: number) => {
    const n = Math.max(2, Math.ceil(Math.hypot(bx - ax, by - ay) * c.d));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const X = Math.round(c.X(ax + (bx - ax) * t)), Y = Math.round(c.Y(ay + (by - ay) * t));
      c.buf.set(X, Y, S !== null ? S : t > 0.85 ? P.skin[1]! : tn(g.robe, 0.35, X, Y, 0));
      c.buf.set(X + 1, Y, S !== null ? S : tn(g.robe, 0.6, X + 1, Y, 0));
    }
  };
  const cheer = f === 2;
  if (kind === "fist" || (cheer && seed > 0.45)) {
    hand(x - wTop + 1, sh + 2, x - wTop - 1 + sway, sh - 9 - (cheer ? 2 : 0));
    if (cheer) hand(x + wTop - 1, sh + 2, x + wTop + 1, sh - 8);
  }
  if (kind === "parasol") {
    const px = x + 3, top = sh - 14 - (cheer ? 2 : 0);
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
    const up = cheer ? -4 : 0;
    const px = x - 4, top = sh - 15 + up;
    rect(c, px - 0.5, top, px + 0.5, sh + 3, () => (S !== null ? S : P.umber[3]!));
    const flap = f % 2 === 0 ? 1 : -1;
    rect(c, px, top, px + 10, top + 6, (X, Y, lx, ly) => {
      const t = (lx - px) / 10;
      const mid = top + 3 + t * flap * 1.2;
      if (Math.abs(ly - mid) > 3 * (1 - t)) return 0;
      return S !== null ? S : tn(seed > 0.5 ? M.verm : P.gold, t < 0.5 ? 0.25 : 0.45, X, Y, 0.2);
    });
  } else if (kind === "fan") {
    const fx = x + wTop + 3, fy = sh + (cheer ? -3 : 2);
    blob(c, fx, fy, 3.5, 2.6, (X, Y, u, v) => (S !== null ? S : v > 0.5 ? tn(P.umber, 0.4, X, Y, 0) : tn(seed > 0.5 ? M.verm : P.paper, u < 0 ? 0.15 : 0.4, X, Y, 0.2)));
  } else if (kind === "kid") {
    // a child on the shoulders: small body over the head, legs either side
    const kx = hx, ky = hy - 4;
    rect(c, kx - 3, ky - 6, kx + 3, ky + 1, (X, Y, lx) => (S !== null ? S : sideTone(seed > 0.5 ? P.gold : M.verm, (lx - kx) / 3, X, Y, 0.25)));
    blob(c, kx, ky - 8.5, 2.1, 2.3, (X, Y, u, v) => (S !== null ? S : v < -0.3 ? tn(HAIR, 0.3, X, Y, 0) : tn(P.skin, u < 0 ? 0.15 : 0.45, X, Y, 0)));
    for (const s of [-1, 1]) rect(c, kx + s * 2.5 - 0.5, ky, kx + s * 2.5 + 1, ky + 4, (X, Y) => (S !== null ? S : tn(seed > 0.5 ? P.gold : M.verm, 0.5, X, Y, 0)));
    if (cheer) hand(kx - 2, ky - 5, kx - 4, ky - 12);
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
    const haze = lut("haze", 1);
    for (let r = rows - 1; r >= 0; r--) {
      const top = -r * 34 - 20, inset = r * 26;
      const x0 = -hw + inset + 12, x1 = hw - inset - 12;
      // people come in knots of 1-4 with gaps between, and the odd empty seat
      const figs: Fig[] = [];
      let x = x0 + hash(r, 1, c.seed) * 8;
      let i = 0;
      while (x < x1) {
        const k = 1 + Math.floor(hash(i, r + 7, c.seed) * 4);
        for (let j = 0; j < k && x < x1; j++, i++) {
          const s = hash(i, r * 13 + 3, c.seed);
          const kind = KINDS[Math.floor(hash(i, r * 13 + 5, c.seed) * KINDS.length)]!;
          figs.push({ x, foot: top - 1, kind, robe: ROBES[Math.floor(hash(i, r * 13 + 9, c.seed) * ROBES.length)]!, seed: s, f });
          x += 11 + hash(i, r * 13 + 11, c.seed) * 5 + (kind === "parasol" ? 6 : 0);
        }
        x += 10 + hash(i, r + 17, c.seed) * 26;
      }
      // the shadows first, on the riser of the row behind (above this row's rail), then the people
      const riser = P.stone[5]!;
      const clipTop = top - 9;
      for (const g of figs) personClipped(c, g, riser, clipTop);
      for (const g of figs) person(c, g, null);
      // the rows further back sit in more air: lighter, cooler, flatter
      if (r > 0) tint(c, -hw, top - 60, hw, top, (_X, _Y, _lx, ly) => (ly < top - 1 ? haze : null));
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


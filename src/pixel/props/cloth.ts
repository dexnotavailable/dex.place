// Banners and cloth: verlet cloth that keeps its real pixels.
//
//   banner    a processional banner on a rod: border, the lamp mark, a
//             swallowtail with a fringe (the pilgrim path, the Crown)
//   tapestry  a wide wall hanging woven with the colossi's procession under
//             the ring (the chapel: sway only there)
//   pennant   a long red pennant on an iron pole, pinned at its hoist: it
//             streams and whips in the storm's gusts (the gust tell) and
//             hangs still after the storm (the spire, the Blade)
//
// States: hanging -> torn (a slash cuts along its path) -> restoring (after
// a few seconds it fades, knits and fades back in) -> hanging. In a
// sway-only room (the nave) a slash only pushes it. Origin: the rod's centre
// (banner, tapestry) or the pole's foot (pennant).

import type { PartBuilder } from "../builder.ts";
import type { Cloth } from "../motion.ts";
import { defineRecipe, type Prop } from "../prop.ts";
import type { Part } from "../part.ts";
import { hitCentre, type Hit } from "../hits.ts";

export type ClothColour = "red" | "indigo" | "gold" | "teal" | "pale";
const MAT: Record<ClothColour, string> = { red: "clothRed", indigo: "clothIndigo", gold: "clothGold", teal: "clothTeal", pale: "clothPale" };

export interface ClothParams {
  kind: "banner" | "tapestry" | "pennant";
  colour: ClothColour;
  /** Cloth width and length in H (defaults per kind when 0). */
  width: number;
  length: number;
}

interface Refs {
  cloth: Cloth;
  part: Part;
  tornAt: number;
}

const LAMP_MARK = `
  ...#...
  ..###..
  .##.##.
  .#####.
  ..###..
  ...#...
  .#####.
`;

function bannerDesign(c: PartBuilder, w: number, h: number, mat: string, trim: string, seed: number): void {
  c.rect(0, 0, w, h, { mat, profile: "flat", depth: 1, piece: "cloth" });
  // swallowtail: cut a V from the hem
  const v = Math.round(h * 0.14);
  for (let y = h - v; y < h; y++) {
    const half = Math.round(((y - (h - v)) / v) * (w * 0.5));
    for (let x = Math.floor(w / 2 - half); x < Math.ceil(w / 2 + half); x++) {
      const i = c.grid.inner(x, y);
      if (i >= 0) c.grid.clearRaw(i);
    }
  }
  // border and trim bands
  c.rect(0, 0, w, 3, { mat: trim, mode: "paint" });
  c.rect(0, 5, w, 1, { mat: trim, mode: "paint", tone: -1 });
  for (let y = 7; y < h - v; y++) {
    for (const x of [1, w - 2]) {
      const i = c.grid.inner(x, y);
      if (i >= 0 && c.grid.mat[i]) c.grid.tone[i] = -1;
    }
  }
  // the lamp mark, twice size, in the trim colour
  c.ornament(Math.round(w / 2) - 7, Math.round(h * 0.3), LAMP_MARK, { "#": { mat: trim } }, { mode: "paint", scale: 2 });
  // weave and wear
  c.grain({ dir: "v", seed, density: 0.18, stretch: 20, mats: [mat] });
  c.speckle({ amount: 0.05, seed: seed + 1, tone: 1, mats: [mat] });
  // fringe along the swallowtail edges
  for (let x = 0; x < w; x += 2) {
    const y = h - v + Math.round((Math.abs(x + 0.5 - w / 2) / (w / 2)) * v) - 1;
    const i = c.grid.inner(x, Math.min(h - 1, y));
    if (i >= 0 && c.grid.mat[i]) c.grid.mat[i] = c.grid.mat[i]!;
    c.pixels([[x, Math.min(h - 1, y + 1)]], { mat: trim, profile: "flat" });
  }
}

function tapestryDesign(c: PartBuilder, w: number, h: number, mat: string, seed: number): void {
  c.rect(0, 0, w, h, { mat: "clothGold", profile: "flat", depth: 1, piece: "border" });
  c.rect(4, 4, w - 8, h - 8, { mat, profile: "flat", depth: 1, piece: "field" });
  // woven rows
  for (let y = 5; y < h - 5; y += 3) c.rect(4, y, w - 8, 1, { mat, mode: "paint", tone: -1 });
  // the ring (an arc) and its sun
  const cx = Math.round(w * 0.5), cy = Math.round(h * 0.42), R = Math.round(Math.min(w, h) * 0.3);
  for (let a = Math.PI * 1.08; a < Math.PI * 1.92; a += 0.01) c.pixels([[Math.round(cx + Math.cos(a) * R), Math.round(cy + Math.sin(a) * R * 0.8)], [Math.round(cx + Math.cos(a) * (R - 1)), Math.round(cy + Math.sin(a) * (R - 1) * 0.8)]], { mat: "clothPale", mode: "paint" });
  c.circle(cx + Math.round(R * 0.35), cy - Math.round(R * 0.5), 3, { mat: "clothGold", mode: "paint" });
  // the procession: colossi walking along the ground line
  const gy = Math.round(h * 0.78);
  c.rect(6, gy, w - 12, 1, { mat: "clothPale", mode: "paint", tone: -1 });
  const walker = `
    .#.
    ###
    ###
    .#.
    #.#
    #.#
  `;
  for (let k = 0; k < 5; k++) c.ornament(Math.round(w * (0.14 + k * 0.17)), gy - 12, walker, { "#": { mat: "clothPale", tone: k === 2 ? 1 : 0 } }, { mode: "paint", scale: 2 });
  // a line of small lamps below, lit
  for (let k = 0; k < 6; k++) c.pixels([[Math.round(w * (0.12 + k * 0.152)), gy + 5]], { mat: "clothGold", mode: "paint", tone: 1 });
  // fringe
  for (let x = 2; x < w - 2; x += 2) c.pixels([[x, h - 1]], { mat: "clothGold", mode: "paint", tone: -1 });
  c.speckle({ amount: 0.06, seed, tone: -1, scale: 2 });
}

function pennantDesign(c: PartBuilder, w: number, h: number, mat: string): void {
  // a long tapered triangle from the hoist (left) to the fly
  for (let x = 0; x < w; x++) {
    const half = (h / 2) * (1 - (x / w) * 0.85);
    c.rect(x, Math.round(h / 2 - half), 1, Math.max(1, Math.round(half * 2)), { mat, profile: "flat", depth: 1 });
  }
  c.rect(0, 0, 3, h, { mat: "clothPale", mode: "paint", tone: -1 });
  c.rect(4, Math.round(h / 2) - 1, Math.round(w * 0.7), 1, { mat, mode: "paint", tone: 1 });
}

export const clothHanging = defineRecipe<ClothParams, Refs>({
  id: "clothHanging",
  breakage: "heal",
  reason: "Cloth that shows the air: banners where people walk in procession, a tapestry of the colossi in the chapel, and red pennants whose whipping tells the storm's gusts before they hit.",
  defaults: { kind: "banner", colour: "red", width: 0, length: 0 },
  cues: ["cloth.tear", "cloth.hit"],
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const kind = p.kind;
    const w = u(p.width || (kind === "banner" ? 0.56 : kind === "tapestry" ? 2.4 : 1.1));
    const h = u(p.length || (kind === "banner" ? 1.5 : kind === "tapestry" ? 1.5 : 0.32));
    const mat = MAT[p.colour];
    const src = b.canvas(w, h);
    if (kind === "banner") bannerDesign(src, w, h, mat, p.colour === "gold" ? "clothRed" : "clothGold", p.seed);
    else if (kind === "tapestry") tapestryDesign(src, w, h, mat, p.seed);
    else pennantDesign(src, w, h, mat);
    src.grid.computeNormals({ x0: 0, y0: 0, x1: src.grid.W - 1, y1: src.grid.Hh - 1 });
    let cloth: Cloth, part: Part;
    if (kind === "pennant") {
      // the pole, the pennant at its top, pinned along the hoist
      const ph = u(2.3);
      const pole = b.part("pole", { w: u(0.12), h: ph, pivot: [u(0.06), ph], at: [0, 0], layer: "mid", z: 7 });
      pole.rect(u(0.06) - 2, u(0.06), 4, ph - u(0.06), { mat: "iron", profile: "cylV" });
      pole.circle(u(0.06), u(0.04), u(0.035), { mat: "brass", profile: "dome", r: 2, piece: "finial" });
      pole.rect(0, ph - u(0.06), u(0.12), u(0.06), { mat: "iron", profile: "bevel", r: 1, depth: 3, piece: "foot" });
      pole.rect(u(0.06) - 3, u(0.14), 6, 2, { mat: "iron", profile: "cylH", piece: "clip" });
      pole.rect(u(0.06) - 3, u(0.14) + h, 6, 2, { mat: "iron", profile: "cylH", piece: "clip" });
      const sp = Math.max(4, Math.round(h / 4));
      ({ cloth, part } = b.cloth("cloth", { src: src.grid, spacing: sp, x: 2, y: -ph + u(0.14) + 2, pinTop: false, damping: 0.965, windGain: 2.6, stiffness: 1, foldGain: 1.2, sleep: 12, layer: "mid", room: [w * 0.4, h * 3, w * 0.4, w * 1.1] }));
      for (let j = 0; j < cloth.rows; j++) {
        const k = j * cloth.cols;
        cloth.pin(k, cloth.p[k * 3]!, cloth.p[k * 3 + 1]!, 0);
      }
      part.z = 8;
    } else {
      // rod with finials on two wall brackets
      const rw = w + u(0.22);
      const rod = b.part("rod", { w: rw, h: 10, pivot: [rw >> 1, 5], at: [0, 0], layer: "bg", z: 16 });
      rod.rect(3, 3, rw - 6, 4, { mat: kind === "tapestry" ? "woodDark" : "iron", profile: "cylH" });
      for (const x of [3, rw - 4]) rod.circle(x, 5, 3, { mat: "brass", profile: "dome", r: 2, z: 2, piece: "finial" });
      for (const x of [u(0.1), rw - u(0.1) - 2]) rod.rect(x, 0, 3, 6, { mat: "iron", profile: "bevel", r: 1, depth: 2, piece: "bracket" });
      const sp = Math.max(5, Math.round(w / (kind === "tapestry" ? 18 : 7)));
      ({ cloth, part } = b.cloth("cloth", { src: src.grid, spacing: sp, x: -w / 2, y: 5, bottomMass: kind === "banner" ? 2.5 : 3, damping: 0.972, windGain: kind === "tapestry" ? 0.25 : 0.5, foldGain: 1.4, layer: "bg", room: [w * 0.35, 6, w * 0.35, h * 0.3] }));
      part.z = 15;
    }
    return { cloth, part, tornAt: -1 };
  },
  initial: "hanging",
  states: {
    hanging: {
      hit: (c, h) => onHit(c, h.hit),
    },
    torn: {
      sound: "cloth.tear",
      update(c) {
        if (c.age - c.refs.tornAt > 4.5) c.go("restoring");
      },
      hit: (c, h) => onHit(c, h.hit),
    },
    restoring: {
      enter(c) {
        c.world.tweens.add({ target: c.refs.part, key: "dissolve", to: 1, dur: 0.5, ease: "inOutSine" });
      },
      update(c) {
        const r = c.refs;
        if (c.t >= 0.55 && r.cloth.torn > 0) {
          r.cloth.reset();
          r.part.dissolveMode = 1;
          c.world.tweens.add({ target: r.part, key: "dissolve", to: 0, dur: 0.7, ease: "inOutSine" });
        }
      },
      after: [1.4, "hanging"],
    },
  },
  actions: {
    /** A gust that the pennants show first (the host's gust tell). */
    gust: (c, arg) => {
      const H = c.params.H;
      const [x0, y0, x1, y1] = c.refs.cloth.bounds();
      c.refs.cloth.push((x0 + x1) / 2, (y0 + y1) / 2, H * 2, Number(arg ?? 1) * 3, -0.5, 2);
    },
  },
  demo: {
    w: 7,
    at: 2.4,
    params: { kind: "banner", colour: "red" },
    variants: [
      { label: "indigo banner", params: { kind: "banner", colour: "indigo" }, dx: -1.0 },
      { label: "tapestry", params: { kind: "tapestry", colour: "indigo" }, dx: -3.6, at: 2.2 },
      { label: "pennant", params: { kind: "pennant", colour: "red" }, dx: 2.3, at: 0 },
    ],
    script: [
      { label: "still air", wait: 1 },
      { label: "wind rises (storm)", wind: 420, wait: 2.5 },
      { label: "dash wind at the banner", hit: "wind", from: -1.4, wait: 1.2 },
      { label: "slash: it tears along the cut", hit: "slash", from: -0.5, wait: 2 },
      { label: "wind drops", wind: 0, wait: 3 },
      { label: "restores", wait: 3 },
    ],
  },
});

function onHit(c: Prop<Refs>, hit: Hit): string | void {
  const r = c.refs;
  const H = c.params.H;
  const [x, y] = hitCentre(hit.shape);
  const f = hit.type === "wind" ? 1.4 : hit.type === "slash" || hit.type === "point" ? 2.4 : 3.6;
  r.cloth.push(x, y, H * 1.8, hit.dir[0] * f, hit.dir[1] * f * 0.4, f);
  if (hit.type === "wind") return;
  const res = c.cut(hit, { ropes: false });
  if (res.torn > 0) {
    r.tornAt = c.age;
    c.sound("cloth.hit", 0.6);
    return "torn";
  }
}

// Sentinel turret, authored in code. Strict red / black / white like the enemy
// reference: ornate black armour, bone-white filigree and horns, a red
// banner and a red eye. Exported as a contract package with four clips:
// base, head (idle / charged), barrel (angle-indexed) and broken.

import { SPRITE_CONTRACT, validatePackage, type Clip, type SpritePackage } from "../contracts.ts";
import { pack, trim, type PackedAtlas, type PackedImage } from "./atlas-builder.ts";
import { Palette, PixBuf } from "./pixbuf.ts";

const TP = new Palette();
const T = {
  armor: TP.add({ tones: ["#050406", "#0f0d10", "#1c181b", "#2c2629", "#463e43"], line: "#000000", lite: "#0f0d10" }),
  bone: TP.add({ tones: ["#6e6664", "#a39b98", "#d3ccc8", "#f2eeea", "#ffffff"], line: "#121013", lite: "#2c2629", shine: 0.2 }),
  red: TP.add({ tones: ["#3a040e", "#660816", "#a50f28", "#d81e38", "#ff5a6a"], line: "#160105", lite: "#3a040e" }),
};
const EYE = [255, 64, 84] as [number, number, number];
const EYE_HOT = [255, 236, 236] as [number, number, number];
const KEY: [number, number, number] = [-0.35, -0.7, 0.62];

const G = { base: 1, banner: 2, horn: 3, head: 4, crown: 5, barrel: 6, rubble: 7 };

type V = [number, number];

function render(key: string, w: number, h: number, ox: number, oy: number, draw: (b: PixBuf) => void): { image: PackedImage; pivot: V } {
  const b = new PixBuf(w, h, ox, oy, TP);
  draw(b);
  const { albedo, normal } = b.finish(KEY);
  const t = trim(w, h, albedo, normal, 0)!;
  return { image: { key, w: t.w, h: t.h, albedo: t.albedo, normal: t.normal }, pivot: [ox - t.x, oy - t.y] };
}

function drawBase(b: PixBuf, broken: boolean): void {
  // plinth
  b.poly([-23, 0, 23, 0, 22, -4, 19, -6, -19, -6, -22, -4], T.armor, G.base, { round: 2, trim: { mat: T.bone, width: 1, where: (_x, y) => y < -4.5 } });
  // column with bone filigree
  b.poly([-13, -6, 13, -6, 10, -22, 7, -25, -7, -25, -10, -22], T.armor, G.base, {
    round: 4,
    paint: (x, y) => {
      const ax = Math.abs(x + 0.5);
      if (Math.abs(ax - 6.5) < 0.6 && y < -8 && y > -21) return T.bone;
      if (Math.abs(y + 14.5) < 0.6 && ax < 6) return T.bone;
      return undefined;
    },
  });
  // horns sweeping up and out
  for (const s of [-1, 1]) {
    const pts: number[] = [];
    const ws: number[] = [];
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      pts.push(s * (11 + t * 9 + t * t * 3), -18 - t * 16 + t * t * 2);
      ws.push(4.2 * (1 - t) + 0.5);
    }
    b.ribbon(pts, ws, T.bone, G.horn, { round: 1.6 });
  }
  if (broken) {
    b.poly([-9, -25, -6, -30, -2, -27, 1, -31, 4, -26, 8, -29, 9, -25], T.armor, G.rubble, { round: 1.5 });
    b.line(-4, -23, 2, -12, T.bone, G.rubble, -1);
    b.line(3, -20, 6, -9, T.bone, G.rubble, -1);
    return;
  }
  // mount ring
  b.ellipse(0, -26, 12, 3.4, 0, T.bone, G.base, { round: 2 });
  // banner with sigil, tattered hem
  b.poly([-6, -21, 6, -21, 6, -4, 3.5, -1, 2, -4, 0, 0, -2, -4, -3.5, -1, -6, -4], T.red, G.banner, {
    round: 2,
    tilt: [0, 0.1],
    paint: (x, y) => {
      const X = x + 0.5, Y = y + 0.5;
      if (Math.abs(X) < 0.6 && Y > -18 && Y < -6) return T.bone;
      if (Math.abs(Math.hypot(X, Y + 14) - 2.6) < 0.55) return T.bone;
      return undefined;
    },
  });
}

function drawHead(b: PixBuf, charged: boolean): void {
  // helm: rounded, heavier at the jaw, a visor ridge
  const helm = [-9, 0, 9, 0, 11, -7, 9, -14, 4, -18, -3, -18, -8, -15, -11, -8];
  b.poly(helm, T.armor, G.head, {
    round: 4.5,
    trim: { mat: T.bone, width: 1, where: (_x, y) => y > -1.5 || y < -15.5 },
    paint: (x, y) => {
      const X = x + 0.5, Y = y + 0.5;
      if (Math.abs(Y + 8) < 0.6 && X < 2 && X > -9) return T.bone; // brow filigree
      if (Math.abs(X + 3) < 0.6 && Y < -2 && Y > -8) return T.bone;
      return undefined;
    },
  });
  // crown of spikes
  const spikes: [number, number][] = [[-7, 22], [-3.5, 26], [0.5, 29], [4, 26], [7.5, 22]];
  for (const [x, hgt] of spikes) b.poly([x - 1.8, -15.5, x + 1.8, -15.5, x + 0.2, -hgt], T.bone, G.crown, { round: 1.2 });
  // red tassels at the jaw
  b.ribbon([-9, -3, -11, 2, -12, 7], [2.4, 2, 0.6], T.red, G.head, { round: 1 });
  b.ribbon([9, -3, 10.5, 2, 11, 6], [2.2, 1.8, 0.6], T.red, G.head, { round: 1 });
  // the eye slit, facing +x
  for (let x = 3; x <= 7; x++) b.pix(x, -10, x === 7 || !charged ? EYE : EYE_HOT, G.head);
  b.pix(4, -9, EYE, G.head);
  b.pix(5, -9, charged ? EYE_HOT : EYE, G.head);
  if (charged) {
    b.pix(8, -10, EYE, G.head);
    b.pix(2, -10, EYE, G.head);
  }
}

function drawBarrel(b: PixBuf, deg: number): V {
  const a = (deg * Math.PI) / 180;
  const d: V = [Math.cos(a), Math.sin(a)];
  const p: V = [-d[1], d[0]];
  const at = (t: number, o = 0): V => [d[0] * t + p[0] * o, d[1] * t + p[1] * o];
  // shaft
  const s0 = at(-5), s1 = at(22);
  b.capsule(s0[0], s0[1], 2.6, s1[0], s1[1], 2.2, T.armor, G.barrel, {
    round: 2.2,
    paint: (x, y) => {
      const t = (x + 0.5) * d[0] + (y + 0.5) * d[1];
      if ((t > 5 && t < 7) || (t > 13 && t < 15)) return T.bone;
      const o = (x + 0.5) * p[0] + (y + 0.5) * p[1];
      if (Math.abs(o) < 0.6 && t > 7 && t < 20) return T.red;
      return undefined;
    },
  });
  // flared bone muzzle
  const m = [at(21, 3), at(29, 4.4), at(30, 2.2), at(30, -2.2), at(29, -4.4), at(21, -3)];
  b.poly(m.flat(), T.bone, G.barrel, { round: 1.6 });
  const tip = at(30.5);
  b.pix(tip[0], tip[1], EYE, G.barrel);
  // rear spike
  const r0 = at(-5, 2), r1 = at(-12), r2 = at(-5, -2);
  b.poly([...r0, ...r1, ...r2], T.bone, G.barrel, { round: 1 });
  return at(31);
}

export interface TurretBake {
  pkg: SpritePackage;
  atlas: PackedAtlas;
}

export function bakeTurret(): TurretBake {
  const images: PackedImage[] = [];
  const pivots = new Map<string, V>();
  const anchors = new Map<string, Record<string, V>>();
  const add = (key: string, r: { image: PackedImage; pivot: V }, anc: Record<string, V> = {}): void => {
    images.push(r.image);
    pivots.set(key, r.pivot);
    anchors.set(key, anc);
  };
  add("base", render("base", 80, 60, 40, 50, (b) => drawBase(b, false)), { mount: [0, -27] });
  add("broken", render("broken", 80, 60, 40, 50, (b) => drawBase(b, true)));
  add("head0", render("head0", 50, 50, 25, 40, (b) => drawHead(b, false)), { barrel: [5, -9], eye: [5, -10] });
  add("head1", render("head1", 50, 50, 25, 40, (b) => drawHead(b, true)), { barrel: [5, -9], eye: [5, -10] });
  const ANG = [] as number[];
  for (let a = -90; a <= 90; a += 7.5) ANG.push(a);
  for (const a of ANG) {
    let muzzle: V = [0, 0];
    const k = `barrel${a}`;
    add(k, render(k, 90, 90, 45, 45, (b) => { muzzle = drawBarrel(b, a); }));
    anchors.set(k, { muzzle: [Math.round(muzzle[0] * 10) / 10, Math.round(muzzle[1] * 10) / 10] });
  }
  const atlas = pack(images, 1024);
  const frame = (key: string, duration = 60) => ({ rect: atlas.rects.get(key)!, pivot: pivots.get(key)!, duration, anchors: anchors.get(key)!, pose: key });
  const clips: Clip[] = [
    { id: "base", atlas: "turret", loop: true, frames: [frame("base")] },
    { id: "broken", atlas: "turret", loop: true, frames: [frame("broken")] },
    { id: "head", atlas: "turret", loop: true, tags: ["indexed"], frames: [frame("head0"), frame("head1")] },
    { id: "barrel", atlas: "turret", loop: true, angles: { from: -90, to: 90 }, frames: ANG.map((a) => frame(`barrel${a}`)) },
  ];
  const pkg = validatePackage(
    {
      contract: SPRITE_CONTRACT,
      name: "sentinel turret (stand-in)",
      atlases: [{ id: "turret", albedo: "(baked)", normal: "(baked)", width: atlas.width, height: atlas.height, shading: "baked" }],
      clips,
      defaults: { hurtboxes: [{ x: -14, y: -58, w: 28, h: 58 }] },
    },
    "turret (stand-in bake)",
  );
  return { pkg, atlas };
}

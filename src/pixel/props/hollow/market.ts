// The Foundry Market's working parts (C1, WORLD-PLAN section 4):
//
//   neonGlyph    neon and holy-light signs: glyph tubes that mean nothing,
//                except the small book mark over the archive door. lit,
//                flicker (asks the flash gate), spark (hit), dark for a beat
//   steamVent    a floor grate on a cycle: hiss, then a burst that pushes
//                cloth, flames and dust (a wind source, never damage)
//   junctionBox  a wall box with conduit; a hit makes it spark (a light
//                source for a moment), then it settles
//   redPipe      the route mark underground: a red pipe along the walkway,
//                on brackets, with a valve wheel; dents and mends
//   radio        the stall radio the theme plays from, muffled; its dial
//                glows, the speaker cloth breathes
//   jibCrane     a crane with a swinging hook behind the walkway: the
//                trolley runs along the jib now and then; the hook swings
//                when hit and settles
//   hearthFire   the Hearth Shrine's fire, in the alcove's furnace mouth:
//                live flames and embers that rim her orange
//   footfalls    no picture: a colossus crossing far above. A thud every
//                2.5 s through a crossing, grit sifting from the ceiling in
//                time, lamps swaying, a 1 px shake (off in
//                reduced motion); the backdrops read the same pulse
//
// Origins: the floor (vent, crane, hearth), the mount point (sign, box,
// radio), the pipe's left end.

import "./materials.ts";
import { addFlame, matId, puff, stepFlame, type Flame } from "../../kit.ts";
import { P_ADD, P_DRAG, P_FADE, P_GRAV, P_RISE } from "../../bodies.ts";
import { hitCentre, type Hit } from "../../hits.ts";
import { Pendulum, type Rope } from "../../motion.ts";
import { defineRecipe, type Prop } from "../../prop.ts";
import type { Part } from "../../part.ts";
import { steelHit } from "./walkway.ts";
import { footfall } from "./pulse.ts";

// ---------------------------------------------------------------------------
// neonGlyph
// ---------------------------------------------------------------------------

export interface NeonGlyphParams {
  /** "glyphs": tubes that mean nothing; "book": the archive's book mark. */
  kind: "glyphs" | "book";
  colour: "rose" | "teal" | "amber";
  /** Glyph count and orientation. */
  count: number;
  vertical: boolean;
  lit: boolean;
  /** How it is held up: "wall" (standoffs and a shadow on the wall behind), "pole" (a steel post down
   * to the street, `pole` H from the board's centre to the ground), "chains" (hung, `pole` H up). */
  mount: "wall" | "pole" | "chains";
  pole: number;
}

interface NeonRefs {
  board: Part;
  tubes: number[];
  next: number;
}

const NEON_MAT = { rose: "neonRose", teal: "neonTeal", amber: "hollowAmber" } as const;
const NEON_RGB: Record<NeonGlyphParams["colour"], [number, number, number]> = { rose: [1, 0.45, 0.55], teal: [0.4, 1, 0.9], amber: [1, 0.66, 0.3] };

/** 3x5 glyph cells from a seed: blocky strokes, never letters. */
function glyphBits(seed: number): boolean[] {
  const bits: boolean[] = [];
  let h = seed * 2654435761;
  for (let i = 0; i < 15; i++) {
    h = (h ^ (h >>> 13)) * 1274126177;
    bits.push(((h >>> 7) & 7) < 4);
  }
  // keep a spine so it reads as a sign stroke, not noise
  for (let y = 0; y < 5; y++) bits[y * 3 + (seed % 3)] = true;
  return bits;
}

const BOOK = `
.##...##.
#..#.#..#
#...#...#
#.#.#.#.#
#...#...#
#.#.#.#.#
#...#...#
.###.###.
`;

export const neonGlyph = defineRecipe<NeonGlyphParams, NeonRefs>({
  id: "neonGlyph",
  breakage: "never",
  reason: "Glyph signs keep the market awake and give it colour against the amber; they mean nothing, except the small book mark over the archive's door, which is how you find the documentation.",
  defaults: { kind: "glyphs", colour: "rose", count: 3, vertical: true, lit: true, mount: "wall", pole: 0 },
  cues: ["neon.buzz", "neon.spark"],
  build(b, p) {
    const s = 2; // font px
    const cell = 4 * s;
    let bw: number, bh: number;
    const tubes: number[] = [];
    const tube = NEON_MAT[p.colour];
    if (p.kind === "book") {
      bw = 9 * s + 8;
      bh = 8 * s + 8;
    } else {
      bw = p.vertical ? cell + 8 : p.count * cell + 8;
      bh = p.vertical ? p.count * (6 * s) + 8 : 6 * s + 8;
    }
    const bd = b.part("board", { w: bw, h: bh, pivot: [bw >> 1, bh >> 1], at: [0, 0], layer: "bg", z: 10 });
    // what holds it: never a sign floating in the air
    if (p.mount === "pole" && p.pole > 0) {
      const len = Math.max(4, b.u(p.pole) - (bh >> 1));
      const pl = b.part("pole", { w: 14, h: len + 2, pivot: [7, 0], at: [0, bh - (bh >> 1) - 2], layer: "bg", z: 9, hittable: false });
      pl.rect(5, 0, 4, len, { mat: "iron", profile: "cylV", piece: "post" });
      for (let y = 6; y < len - 8; y += b.u(0.5)) pl.rect(4, y, 6, 2, { mat: "iron", profile: "bevel", r: 1, depth: 2, z: 1, piece: "band" });
      pl.rect(3, 0, 8, 4, { mat: "iron", profile: "bevel", r: 1, depth: 2, z: 1, piece: "collar" });
      pl.rect(0, len - 3, 14, 3, { mat: "iron", profile: "bevel", r: 1, depth: 2, z: 1, piece: "foot" });
      pl.rivets([[2, len - 2], [11, len - 2]], { mat: "iron", r: 1, z: 2 });
      pl.speckle({ amount: 0.1, seed: p.seed + 5, tone: -1, mats: ["iron"] });
    } else if (p.mount === "chains" && p.pole > 0) {
      const len = Math.max(4, b.u(p.pole) - (bh >> 1));
      const ch = b.part("chains", { w: bw, h: len, pivot: [bw >> 1, len], at: [0, -(bh >> 1) + 1], layer: "bg", z: 9, hittable: false });
      for (const x of [3, bw - 5]) for (let y = 0; y < len; y++) ch.rect(x + ((y >> 1) % 2), y, 2, 1, { mat: "iron", profile: "flat", piece: "chain" });
    } else {
      // standoffs at the corners and the board's shadow on the wall behind it
      const sh = b.part("standoff", { w: bw + 4, h: bh + 4, pivot: [(bw >> 1) + 1, (bh >> 1) - 1], at: [0, 0], layer: "bg", z: 8, hittable: false, outline: 0 });
      sh.rect(0, 0, bw + 4, bh + 4, { mat: "soot", profile: "flat", tone: -1, noInk: true });
      for (const [x, y] of [[-2, 3], [bw - 1, 3], [-2, bh - 5], [bw - 1, bh - 5]] as [number, number][]) bd.rect(Math.max(0, x), y, 3, 2, { mat: "iron", profile: "bevel", r: 1, depth: 2, z: 1, piece: "stud" });
    }
    bd.rect(0, 0, bw, bh, { mat: "stoneDark", profile: "bevel", r: 2, depth: 3, piece: "backing" });
    bd.rect(2, 2, bw - 4, bh - 4, { mat: "soot", mode: "paint" });
    bd.rivets([[3, 3], [bw - 4, 3], [3, bh - 4], [bw - 4, bh - 4]], { mat: "iron", r: 1 });
    const put = (x: number, y: number): void => {
      bd.rect(x, y, s, s, { mat: tube, profile: "flat", depth: 1.5, z: 2, piece: "tubes", noInk: true });
      for (let a = 0; a < s; a++) for (let c2 = 0; c2 < s; c2++) {
        const i = bd.grid.inner(x + a, y + c2);
        if (i >= 0) tubes.push(i);
      }
    };
    if (p.kind === "book") {
      BOOK.trim().split("\n").forEach((row, y) => [...row.trim()].forEach((ch, x) => ch === "#" && put(4 + x * s, 4 + y * s)));
    } else {
      for (let k = 0; k < p.count; k++) {
        const bits = glyphBits(p.seed * 7 + k * 13 + 1);
        const gx = p.vertical ? 4 + s : 4 + k * cell + s;
        const gy = p.vertical ? 4 + k * 6 * s : 4;
        bits.forEach((on, i) => on && put(gx + (i % 3) * s, gy + Math.floor(i / 3) * s));
      }
    }
    const rgb = NEON_RGB[p.colour];
    b.light({ part: "board", at: [bw / 2, bh / 2], colour: rgb, radius: b.u(p.kind === "book" ? 1.4 : 2), intensity: 0.5, flicker: 0.05 });
    b.glow({ part: "board", at: [bw / 2, bh / 2], colour: [rgb[0] * 0.85, rgb[1] * 0.7, rgb[2] * 0.75], radius: Math.max(bw, bh) * 0.6, intensity: 0.22, flat: bh / bw });
    return { board: b.get("board"), tubes, next: 4 + (p.seed % 7) };
  },
  initial: (c) => (c.params["lit"] ? "lit" : "dark"),
  states: {
    lit: {
      enter: (c) => neon(c, 1),
      update(c, dt) {
        const r = c.refs;
        r.next -= dt;
        if (r.next <= 0 && !c.world.reduced) {
          r.next = 6 + c.rand() * 10;
          if (c.world.flashGate.allow(c.world.time, c.world.reduced)) c.go("flicker");
        }
      },
      hit: (_c, h) => (h.hit.type === "wind" ? undefined : "spark"),
    },
    flicker: {
      sound: "neon.buzz",
      update(c) {
        const t = c.t;
        neon(c, t < 0.18 ? 0.5 : t < 0.36 ? 1 : t < 0.5 ? 0.3 : 1);
      },
      after: [0.6, "lit"],
      hit: (_c, h) => (h.hit.type === "wind" ? undefined : "spark"),
    },
    spark: {
      sound: "neon.spark",
      enter(c) {
        const [x, y] = c.refs.board.toWorld(c.refs.board.grid.w / 2, c.refs.board.grid.h / 2);
        puff(c.world, "spark", x, y, 8, [0, -1], { speed: 1, spread: 1.6 });
        c.world.flashLight(x, y, [1, 0.8, 0.6], c.params.H * 1.2, 0.7, 0.12);
        c.refs.board.shake = 0.2;
        neon(c, 0);
      },
      after: [0.9, "lit"],
    },
    dark: {
      enter: (c) => neon(c, 0),
      hit: (c, h) => {
        if (h.hit.type !== "wind") c.refs.board.shake = 0.15;
      },
    },
  },
  actions: {
    on: () => "lit",
    off: () => "dark",
    flicker: (c) => (c.state === "lit" ? "flicker" : undefined),
  },
  demo: {
    w: 5,
    at: 1.6,
    params: { kind: "glyphs", colour: "rose", count: 3 },
    variants: [
      { label: "book mark (archive)", params: { kind: "book", colour: "amber" }, dx: -1.6 },
      { label: "teal, across", params: { kind: "glyphs", colour: "teal", count: 4, vertical: false }, dx: 1.8 },
    ],
    script: [
      { label: "lit", wait: 1 },
      { label: "flicker", act: "flicker", wait: 0.7 },
      { label: "hit: a spark, dark a beat", hit: "slash", from: -0.4, wait: 1.2 },
      { label: "off", act: "off", wait: 0.8 },
      { label: "on", act: "on", wait: 0.8 },
    ],
  },
});

function neon(c: Prop<NeonRefs>, level: number): void {
  const r = c.refs;
  const g = r.board.grid;
  const colour = c.params["colour"] as NeonGlyphParams["colour"];
  const onId = matId(NEON_MAT[colour]), offId = matId("neonTube");
  r.tubes.forEach((i, k) => {
    const lit = level >= 1 || (level > 0 && ((k * 7919) % 97) / 97 < level);
    const m = lit ? onId : offId;
    if (g.mat[i] !== m && g.mat[i]) {
      g.mat[i] = m;
      g.markRaw(i);
    }
  });
  for (const L of c.lights) L.level = level;
  for (const G of c.glows) G.level = level;
}

// ---------------------------------------------------------------------------
// steamVent
// ---------------------------------------------------------------------------

export interface VentParams {
  /** Seconds per cycle (a burst each cycle). */
  period: number;
  /** Burst strength 0..1. */
  strength: number;
}

interface VentRefs {
  grate: Part;
  timer: number;
}

const STEAM: [number, number, number][] = [
  [150, 132, 112],
  [182, 164, 140],
  [120, 104, 90],
];

export const steamVent = defineRecipe<VentParams, VentRefs>({
  id: "steamVent",
  breakage: "never",
  reason: "The foundry breathes through the street: vents hiss on a cycle and burst, pushing awnings, flames and dust (a wind source you can see), never hurting anyone.",
  defaults: { period: 9, strength: 1 },
  cues: ["steam.hiss", "steam.burst"],
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const w = u(0.9), h = u(0.14);
    const g = b.part("grate", { w, h, pivot: [w >> 1, h], at: [0, 2], layer: "mid", z: -2 });
    g.rect(0, 0, w, h, { mat: "hollowSteel", profile: "bevel", r: 1, depth: 2, piece: "frame" });
    for (let x = 3; x < w - 3; x += 4) g.rect(x, 2, 2, h - 3, { mat: "hollowSteel", mode: "erase" });
    g.rect(0, 0, w, 1, { mat: "hollowSteel", mode: "paint", tone: 1 });
    g.speckle({ amount: 0.2, seed: p.seed, tone: -1 });
    return { grate: b.get("grate"), timer: (p.seed % 50) / 10 };
  },
  initial: "idle",
  states: {
    idle: {
      update(c, dt) {
        const r = c.refs;
        const P = c.params as unknown as VentParams;
        r.timer += dt;
        // a thin wisp all the time
        if (c.rand() < dt * (c.world.reduced ? 1.5 : 3)) wisp(c, 1);
        if (r.timer >= P.period) {
          r.timer = 0;
          return c.go("hiss");
        }
      },
      hit: (c, h) => ventHit(c, h.hit),
    },
    hiss: {
      sound: "steam.hiss",
      update(c, dt) {
        if (c.rand() < dt * 14) wisp(c, 2);
      },
      after: [1.2, "burst"],
      hit: (c, h) => ventHit(c, h.hit),
    },
    burst: {
      sound: "steam.burst",
      enter(c) {
        const H = c.params.H;
        const s = (c.params as unknown as VentParams).strength;
        // a wind source: lifts cloth, bends flames, carries dust
        c.world.blow(c.x, c.y - H * 0.6, H * 2.2, 0, -H * 5 * s, 0.9);
        for (let k = 0; k < (c.world.reduced ? 8 : 16); k++) wisp(c, 4);
      },
      update(c, dt) {
        if (c.rand() < dt * 30) wisp(c, 3);
      },
      after: [1.4, "idle"],
      hit: (c, h) => ventHit(c, h.hit),
    },
  },
  demo: {
    w: 5,
    params: { period: 4 },
    script: [
      { label: "idle wisp", wait: 3 },
      { label: "hiss, then a burst (a wind source)", wait: 4 },
      { label: "slash the grate: a clang", hit: "slash", from: -0.6, wait: 1 },
    ],
  },
});

function wisp(c: Prop<VentRefs>, force: number): void {
  const H = c.params.H;
  const w = c.world;
  if (!w.inView(c.x, c.y, H * 3)) return;
  w.spawnAmbient({
    x: c.x + (c.rand() - 0.5) * H * 0.7,
    y: c.y - 2,
    vx: (c.rand() - 0.5) * H * 0.3,
    vy: -H * (0.4 + force * 0.5) * (0.6 + c.rand() * 0.6),
    life: 0.8 + c.rand() * (0.5 + force * 0.4),
    rgb: STEAM[Math.floor(c.rand() * STEAM.length)]!,
    flags: P_RISE | P_DRAG | P_FADE,
    size: force > 2 && c.rand() < 0.4 ? 2 : 1,
  });
}

function ventHit(c: Prop<VentRefs>, hit: Hit): void {
  if (hit.type === "wind") return;
  steelHit(c, hit);
  c.refs.grate.shake = 0.12;
}

// ---------------------------------------------------------------------------
// junctionBox
// ---------------------------------------------------------------------------

interface BoxRefs {
  box: Part;
  lamp: number[];
}

export const junctionBox = defineRecipe<{ conduit: number }, BoxRefs>({
  id: "junctionBox",
  breakage: "never",
  reason: "The market's power runs through boxes on the columns; hit one and it sparks, lighting the street for a moment, then settles: the place is makeshift and alive.",
  defaults: { conduit: 1.2 },
  cues: ["spark.crackle"],
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const w = u(0.3), h = u(0.38);
    const box = b.part("box", { w, h, pivot: [w >> 1, h >> 1], at: [0, 0], layer: "bg", z: 9 });
    box.roundRect(0, 0, w, h, 2, { mat: "iron", profile: "bevel", r: 2, depth: 3, piece: "case" });
    box.rect(3, 3, w - 6, h - 6, { mat: "iron", profile: "flat", depth: 1, z: 2, piece: "door" });
    box.rect(3, 3, w - 6, 1, { mat: "iron", mode: "paint", tone: 1 });
    box.rivets([[2, 2], [w - 3, 2], [2, h - 3], [w - 3, h - 3]], { mat: "brass", r: 1 });
    // a warning stripe and a small lamp
    for (let x = 4; x < w - 4; x += 4) box.rect(x, h - 8, 2, 3, { mat: "clothGold", mode: "paint" });
    box.rect(w - 8, 6, 3, 3, { mat: "hollowAmber", profile: "flat", z: 3, piece: "lamp", noInk: true });
    const lamp: number[] = [];
    for (let a = 0; a < 3; a++) for (let c2 = 0; c2 < 3; c2++) lamp.push(box.grid.inner(w - 8 + a, 6 + c2));
    box.speckle({ amount: 0.1, seed: p.seed, tone: -1, mats: ["iron"] });
    // conduit up to the walkway
    const ch = u(p.conduit);
    const cd = b.part("conduit", { w: 6, h: ch, pivot: [3, ch], at: [-u(0.06), -(h >> 1)], layer: "bg", z: 8, hittable: false });
    cd.rect(1, 0, 4, ch, { mat: "iron", profile: "cylV" });
    for (let y = 6; y < ch; y += u(0.3)) cd.rect(0, y, 6, 2, { mat: "iron", profile: "cylH", piece: "clip" });
    return { box: b.get("box"), lamp: lamp.filter((i) => i >= 0) };
  },
  initial: "idle",
  states: {
    idle: {
      update(c) {
        // the lamp blinks slowly (a held 1 s step, never a strobe)
        setLamp(c, Math.floor(c.age) % 3 === 0 ? 0 : 1);
      },
      hit: (_c, h) => (h.hit.type === "wind" ? undefined : "spark"),
    },
    spark: {
      sound: "spark.crackle",
      enter(c) {
        const r = c.refs;
        const [x, y] = r.box.toWorld(r.box.grid.w / 2, r.box.grid.h * 0.3);
        puff(c.world, "spark", x, y, 12, [0, -1], { speed: 1.2, spread: 2.4 });
        // a light source for a moment (through the flash gate)
        c.world.flashLight(x, y, [1, 0.82, 0.55], c.params.H * 2.2, 0.85, 0.18);
        r.box.shake = 0.25;
        setLamp(c, 0);
      },
      update(c, dt) {
        // a few late sparks as it settles
        if (c.t < 0.6 && c.rand() < dt * 10) {
          const [x, y] = c.refs.box.toWorld(c.refs.box.grid.w / 2, c.refs.box.grid.h * 0.3);
          puff(c.world, "spark", x, y, 2, [0, 1], { speed: 0.6, spread: 1.2 });
        }
      },
      after: [1.2, "idle"],
    },
  },
  demo: {
    w: 4,
    at: 1.2,
    script: [
      { label: "idle, the lamp blinks", wait: 2 },
      { label: "slash: sparks light the street", hit: "slash", from: -0.4, wait: 1.6 },
      { label: "settles", wait: 1 },
    ],
  },
});

function setLamp(c: Prop<BoxRefs>, on: number): void {
  const g = c.refs.box.grid;
  const m = matId(on ? "hollowAmber" : "hollowDigitOff");
  for (const i of c.refs.lamp) if (g.mat[i] && g.mat[i] !== m) {
    g.mat[i] = m;
    g.markRaw(i);
  }
}

// ---------------------------------------------------------------------------
// redPipe
// ---------------------------------------------------------------------------

export const redPipe = defineRecipe<{ length: number; valve: number }, null>({
  id: "redPipe",
  breakage: "heal",
  reason: "The route's red underground: one red pipe runs along the market walkway toward the lift, the way the red line runs along the dock and the red cloth along the causeway.",
  defaults: { length: 8, valve: 0.35 },
  cues: ["metal.hit"],
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const L = u(p.length);
    const d = u(0.1);
    const pipe = b.part("pipe", { w: L, h: d + 6, pivot: [0, (d + 6) >> 1], at: [0, 0], layer: "bg", z: 6 });
    pipe.rect(0, 3, L, d, { mat: "hollowPipeRed", profile: "cylH", piece: "run" });
    // flanges every 1.6 H, brackets every 1.2 H
    for (let x = u(0.8); x < L - 4; x += u(1.6)) pipe.rect(x, 1, 4, d + 4, { mat: "hollowPipeRed", profile: "cylV", z: 2, piece: "flange" });
    for (let x = u(0.4); x < L - 4; x += u(1.2)) pipe.rect(x, 3 + d - 1, 5, 4, { mat: "iron", profile: "bevel", r: 1, depth: 2, z: 3, piece: "bracket" });
    pipe.speckle({ amount: 0.12, seed: p.seed, tone: -1, mats: ["hollowPipeRed"] });
    pipe.grain({ dir: "h", seed: p.seed + 1, density: 0.12, stretch: 24, mats: ["hollowPipeRed"] });
    if (p.valve > 0) {
      const vx = Math.round(L * p.valve);
      const vr = u(0.09);
      const v = b.part("valve", { w: vr * 2 + 2, h: vr * 2 + 8, pivot: [vr + 1, vr * 2 + 8], at: [vx, 3], layer: "bg", z: 7 });
      v.rect(vr - 1, vr * 2, 4, 8, { mat: "hollowPipeRed", profile: "cylV", piece: "stem" });
      v.ring(vr + 1, vr + 1, vr - 3, vr, { mat: "iron", profile: "dome", r: 2, piece: "wheel" });
      v.rect(vr, 1, 2, vr * 2, { mat: "iron", profile: "cylV", piece: "spoke" });
      v.rect(1, vr, vr * 2, 2, { mat: "iron", profile: "cylH", piece: "spoke" });
    }
    return null;
  },
  initial: "idle",
  states: {
    idle: {
      hit: (c, h) => steelHit(c, h.hit),
    },
  },
  demo: {
    w: 8,
    at: 1.4,
    params: { length: 6 },
    script: [
      { label: "the red pipe", wait: 0.6 },
      { label: "heavy: it dents", hit: "heavy", from: -1, wait: 1.5 },
      { label: "mends", wait: 7 },
    ],
  },
});

// ---------------------------------------------------------------------------
// radio
// ---------------------------------------------------------------------------

interface RadioRefs {
  body: Part;
  cone: number[];
  wobble: Pendulum;
}

export const hollowRadio = defineRecipe<{ antenna: boolean }, RadioRefs>({
  id: "hollowRadio",
  breakage: "never",
  reason: "Underground the theme keeps going through a radio: on a stall counter in the market, on the empty operator's chair at the lift foot (WORLD-PLAN: the muffled playhead, never restarted).",
  defaults: { antenna: true },
  cues: ["radio.crackle"],
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const w = u(0.34), h = u(0.22);
    const body = b.part("body", { w, h: h + u(0.3), pivot: [w >> 1, h + u(0.3)], at: [0, 0], layer: "mid", z: 9, smoothRotate: true });
    const top = u(0.3);
    body.roundRect(0, top, w, h, 3, { mat: "woodDark", profile: "bevel", r: 3, depth: 3, piece: "case" });
    body.rect(0, top, w, 1, { mat: "woodDark", mode: "paint", tone: 1 });
    // speaker cloth with a grille, the dial, two knobs
    body.roundRect(3, top + 3, Math.round(w * 0.52), h - 6, 2, { mat: "burlap", profile: "flat", depth: 1, z: 2, piece: "cloth" });
    for (let x = 5; x < 3 + Math.round(w * 0.52) - 1; x += 3) body.rect(x, top + 3, 1, h - 6, { mat: "woodDark", mode: "paint", tone: -1 });
    const cone: number[] = [];
    for (let y = top + 5; y < top + h - 5; y++) for (let x = 5; x < 3 + Math.round(w * 0.52) - 2; x++) cone.push(body.grid.inner(x, y));
    const dx = 3 + Math.round(w * 0.52) + 3;
    body.rect(dx, top + 3, w - dx - 3, u(0.06), { mat: "hollowDial", profile: "flat", z: 2, piece: "dial", noInk: true });
    body.rect(dx + 3, top + 3, 1, u(0.06), { mat: "iron", mode: "paint" });
    for (const k of [0, 1]) body.circle(dx + 3 + k * u(0.08), top + h - u(0.06), u(0.025), { mat: "brass", profile: "dome", r: 2, z: 2, piece: "knob" });
    if (p.antenna) body.stroke([w - u(0.06), top, w + u(0.02), top - u(0.28)], 1.5, { mat: "iron", profile: "cylV", piece: "antenna" });
    b.light({ part: "body", at: [dx + (w - dx) / 2, top + 4], colour: [1, 0.62, 0.3], radius: b.u(0.7), intensity: 0.35, flicker: 0.1 });
    return { body: b.get("body"), cone: cone.filter((i) => i >= 0), wobble: new Pendulum(u(0.2), u(17.5), 2.6) };
  },
  initial: "playing",
  states: {
    playing: {
      update(c, dt) {
        const r = c.refs;
        // the speaker cloth breathes with the music, a tone step at a time (4 fps)
        const beat = Math.floor(c.age * 4) % 4;
        const g = r.body.grid;
        const tone = beat === 0 ? 1 : 0;
        if (c.world.reduced) return;
        for (let k = 0; k < r.cone.length; k += 7) {
          const i = r.cone[k]!;
          if (g.tone[i] !== tone && g.mat[i]) {
            g.tone[i] = tone;
            g.markRaw(i);
          }
        }
        if (!r.wobble.resting) {
          r.wobble.step(dt, 0);
          r.body.rot = Math.max(-0.4, Math.min(0.4, r.wobble.angle));
        }
      },
      hit(c, h) {
        if (h.hit.type === "wind") return;
        c.refs.wobble.impulse((h.hit.dir[0] < 0 ? -1 : 1) * 1.6);
        c.sound("radio.crackle", 0.5);
      },
    },
  },
  demo: {
    w: 3,
    at: 0.55,
    script: [
      { label: "playing (the cloth breathes)", wait: 2 },
      { label: "slash: it rocks and crackles", hit: "slash", from: -0.5, wait: 2 },
    ],
  },
});

// ---------------------------------------------------------------------------
// jibCrane
// ---------------------------------------------------------------------------

export interface CraneParams {
  /** Mast height and jib length in H; the jib points this way. */
  mast: number;
  jib: number;
  dir: 1 | -1;
  /** Chain length under the trolley, in H. */
  drop: number;
}

interface CraneRefs {
  trolley: Part;
  rope: Rope;
  at: number;
  from: number;
  to: number;
  run: number;
}

export const jibCrane = defineRecipe<CraneParams, CraneRefs>({
  id: "jibCrane",
  breakage: "never",
  reason: "The foundry's cranes are how the hollow was built and still works: one stands behind the market walkway with its hook hanging over the gap, moving goods now and then; hit the hook and it swings.",
  defaults: { mast: 7, jib: 5, dir: -1, drop: 2.2 },
  cues: ["crane.run", "chain.rattle"],
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const mh = u(p.mast), jl = u(p.jib), mw = u(0.22);
    const s = p.dir;
    const W = jl + mw + u(0.8);
    const cx = s < 0 ? W - u(0.5) : u(0.5);
    const m = b.part("mast", { w: W, h: mh + u(0.5), pivot: [cx, mh + u(0.5)], at: [0, 0], layer: "bg", z: 1, hittable: false });
    const base = mh + u(0.5);
    const top = base - mh;
    // the mast: two chords and zigzag bracing
    const x0 = cx - (mw >> 1), x1 = cx + (mw >> 1);
    m.rect(x0, top, 3, mh, { mat: "hollowSteel", profile: "cylV", piece: "chord" });
    m.rect(x1 - 3, top, 3, mh, { mat: "hollowSteel", profile: "cylV", piece: "chord" });
    for (let y = top; y < base - mw; y += mw) {
      m.line(x0 + 2, y, x1 - 2, y + mw, { mat: "hollowSteel", piece: "brace" });
      m.line(x0 + 2, y + mw, x1 - 2, y + mw, { mat: "hollowSteel", piece: "brace" });
    }
    m.rect(x0 - 4, base - u(0.12), mw + 8, u(0.12), { mat: "hollowSteel", profile: "bevel", r: 2, depth: 3, piece: "foot" });
    // the jib: a lattice girder toward `dir`, and a counter-jib with its weight
    const jy = top + u(0.08);
    const jx0 = cx, jx1 = cx + s * jl;
    const jh = u(0.16);
    m.rect(Math.min(jx0, jx1), jy, jl, 3, { mat: "hollowSteel", profile: "cylH", piece: "jib" });
    m.rect(Math.min(jx0, jx1), jy + jh, jl, 3, { mat: "hollowSteel", profile: "cylH", piece: "jib" });
    for (let k = 0; k < jl; k += jh) m.line(jx0 + s * k, jy + 2, jx0 + s * (k + jh), jy + jh, { mat: "hollowSteel", piece: "lattice" });
    const cw = u(0.5);
    m.rect(Math.min(cx, cx - s * cw), jy, cw, 3, { mat: "hollowSteel", profile: "cylH", piece: "counter" });
    m.rect(Math.min(cx - s * cw, cx - s * (cw - u(0.22))), jy + 3, u(0.22), u(0.3), { mat: "stoneDark", profile: "bevel", r: 2, depth: 3, piece: "weight" });
    // the cab, a small lit window
    m.rect(cx - u(0.16), jy + jh + 3, u(0.32), u(0.26), { mat: "iron", profile: "bevel", r: 2, depth: 3, piece: "cab" });
    m.rect(cx - u(0.1) + s * 3, jy + jh + 7, u(0.12), u(0.08), { mat: "lampGlass", profile: "flat", z: 2, piece: "window" });
    // apex and stays
    m.line(cx, top - u(0.4), jx1 - s * 4, jy, { mat: "cable", piece: "stay" });
    m.line(cx, top - u(0.4), cx - s * cw, jy, { mat: "cable", piece: "stay" });
    m.rect(cx - 1, top - u(0.4), 3, u(0.4), { mat: "hollowSteel", profile: "cylV", piece: "apex" });
    m.speckle({ amount: 0.06, seed: p.seed, tone: -1 });
    // the trolley that runs along the jib, and the chain and hook under it
    const tw = u(0.2);
    const tr = b.part("trolley", { w: tw, h: u(0.1), pivot: [tw >> 1, 0], at: [cx - cx + s * Math.round(jl * 0.7), -base + jy + jh + 3], layer: "bg", z: 3, hittable: false });
    tr.rect(0, 0, tw, u(0.1), { mat: "iron", profile: "bevel", r: 1, depth: 2 });
    for (const x of [3, tw - 4]) tr.circle(x, 1, 2, { mat: "iron", profile: "dome", r: 1, piece: "wheel" });
    const { rope } = b.rope("chain", { from: [s * Math.round(jl * 0.7), -base + jy + jh + 3 + u(0.1)], to: [s * Math.round(jl * 0.7), -base + jy + jh + 3 + u(0.1) + u(p.drop)], segments: Math.max(6, Math.round(p.drop * 7)), mat: "iron", width: 2, chain: true, pinStart: true, endMass: 7, damping: 0.99, windGain: 0.3, layer: "mid" });
    const hw = u(0.18), hh = u(0.24);
    const hk = b.part("hook", { w: hw, h: hh, pivot: [hw >> 1, 0], at: [0, 0], layer: "mid", z: 7 });
    hk.rect((hw >> 1) - 3, 0, 6, u(0.07), { mat: "clothGold", profile: "bevel", r: 1, depth: 2, piece: "block" });
    hk.ring(hw >> 1, hh - u(0.07), u(0.03), u(0.07), { mat: "iron", profile: "dome", r: 2, piece: "hook" });
    hk.rect(0, hh - u(0.12), (hw >> 1) - 1, u(0.06), { mat: "iron", mode: "erase" });
    b.hang("hook", rope);
    return { trolley: b.get("trolley"), rope, at: 0.7, from: 0.7, to: 0.7, run: 0 };
  },
  initial: "idle",
  states: {
    idle: {
      update(c) {
        // now and then the trolley runs to a new spot along the jib
        if (c.t > 14 + ((c.params.seed * 7) % 10)) {
          const r = c.refs;
          r.from = r.at;
          r.to = r.at > 0.6 ? 0.35 + c.rand() * 0.15 : 0.7 + c.rand() * 0.2;
          c.go("moving");
        }
      },
      hit: (c, h) => craneHit(c, h.hit),
    },
    moving: {
      sound: "crane.run",
      update(c) {
        const r = c.refs;
        const P = c.params as unknown as CraneParams;
        const dur = 5;
        const k = Math.min(1, c.t / dur);
        const e = k * k * (3 - 2 * k);
        r.at = r.from + (r.to - r.from) * e;
        const x = P.dir * Math.round(c.params.H * P.jib * r.at);
        r.trolley.x = x;
        const pin = r.rope.pins[0];
        if (pin) {
          r.rope.pins[0] = [c.x + x * c.flip, pin[1]];
          r.rope.wake();
        }
        if (k >= 1) c.go("idle");
      },
      hit: (c, h) => craneHit(c, h.hit),
    },
  },
  demo: {
    w: 9,
    params: { mast: 4, jib: 3, drop: 1.6, dir: -1 },
    script: [
      { label: "idle", wait: 1 },
      { label: "the trolley runs", go: "moving", wait: 5.5 },
      { label: "slash the hook: it swings", hit: "slash", from: -2, wait: 3 },
    ],
  },
});

function craneHit(c: Prop<CraneRefs>, hit: Hit): void {
  const [x, y] = hitCentre(hit.shape);
  const f = hit.type === "wind" ? 2.5 : hit.type === "slash" || hit.type === "point" ? 4 : 6;
  c.refs.rope.push(x, y, c.params.H * 1.6, hit.dir[0] * f, hit.dir[1] * f - 1);
  if (hit.type !== "wind") c.sound("chain.rattle", 0.5);
}

// ---------------------------------------------------------------------------
// hearthFire
// ---------------------------------------------------------------------------

interface HearthRefs {
  flames: Flame[];
  embers: number;
}

export const hearthFire = defineRecipe<{ width: number }, HearthRefs>({
  id: "hearthFire",
  breakage: "heal",
  reason: "The Hearth Shrine sits in a furnace-warm alcove: this fire is what makes it warm, and it rims her orange while she rests there (WORLD-PLAN section 8: light feeds the player).",
  defaults: { width: 1.3 },
  cues: ["flame.gutter"],
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const W = u(p.width);
    const bed = b.part("bed", { w: W, h: u(0.14), pivot: [W >> 1, u(0.14)], at: [0, 0], layer: "bg", z: 3 });
    // a bed of coals and a few logs
    for (let x = 0; x < W; x += 3) bed.rect(x, u(0.06) + ((x * 7) % 5 === 0 ? -2 : 0), 3, u(0.08), { mat: (x * 13) % 7 < 3 ? "ember" : "woodDark", profile: "dome", r: 2, piece: "coal" });
    bed.stroke([u(0.1), u(0.1), W * 0.55, u(0.04)], 5, { mat: "woodDark", profile: "cylV", piece: "log" });
    bed.stroke([W * 0.4, u(0.05), W - u(0.1), u(0.11)], 5, { mat: "wood", profile: "cylV", piece: "log" });
    const flames: Flame[] = [];
    // a glow that joins the flames into one fire
    b.glow({ part: "bed", at: [W / 2, 0], colour: [1, 0.5, 0.2], radius: W * 0.62, intensity: 0.45, flat: 0.55, flicker: 0.4 });
    const n = Math.max(5, Math.round(p.width * 7));
    for (let k = 0; k < n; k++) {
      const x = Math.round(((k + 0.5) / n) * W);
      const big = k % 3 !== 1;
      const mid = Math.abs(k - (n - 1) / 2) < 1.6;
      flames.push(addFlame(b, { name: `flame${k}`, parent: "bed", at: [x, u(0.08)], size: mid ? [0.2, 0.5] : big ? [0.17, 0.4] : [0.13, 0.28], light: k === Math.floor(n / 2) ? 3.6 : 0, intensity: 1, glow: mid ? 0.55 : big ? 0.4 : 0, colour: [1, 0.55, 0.26], layer: "bg", z: big ? 6 : 7 }));
    }
    return { flames, embers: 0 };
  },
  initial: "burning",
  states: {
    burning: {
      update(c, dt) {
        const r = c.refs;
        for (const f of r.flames) stepFlame(c, f, dt);
        // embers rise from the fire
        r.embers += dt * (c.world.reduced ? 2 : 5);
        while (r.embers >= 1) {
          r.embers -= 1;
          const H = c.params.H;
          c.world.spawnAmbient({ x: c.x + (c.rand() - 0.5) * H, y: c.y - H * 0.2, vx: (c.rand() - 0.5) * 10, vy: -H * (0.5 + c.rand() * 0.6), life: 1 + c.rand() * 1.4, rgb: c.rand() < 0.5 ? [255, 160, 70] : [255, 210, 120], flags: P_ADD | P_DRAG | P_FADE, size: 1 });
        }
      },
      hit(c, h) {
        // the fire leans and gutters where it's struck, then draws back up
        for (const f of c.refs.flames) {
          f.leanV += h.hit.dir[0] * (h.hit.type === "wind" ? 3 : 5);
          if (h.hit.type !== "wind") f.level = Math.max(0.4, f.level - 0.4);
        }
        if (h.hit.type !== "wind") c.damage(h.hit, ["bed"]);
      },
    },
  },
  demo: {
    w: 4,
    script: [
      { label: "burning", wait: 2 },
      { label: "dash wind: it leans", hit: "wind", from: -1, wait: 1.5 },
      { label: "slash: it gutters and draws back up", hit: "slash", from: -0.5, wait: 2 },
    ],
  },
});

// ---------------------------------------------------------------------------
// footfalls: a colossus crossing far above
// ---------------------------------------------------------------------------

export interface FootfallParams {
  /** Seconds between crossings (start to start) and how long one lasts. */
  every: number;
  length: number;
  /** Seconds between thuds while it crosses (WORLD-PLAN: every 2.5 s). */
  step: number;
  /** Start this many seconds into the cycle (0: a quiet stretch first). */
  offset: number;
}

interface FootRefs {
  last: number;
}

export const hollowFootfalls = defineRecipe<FootfallParams, FootRefs>({
  id: "hollowFootfalls",
  breakage: "never",
  reason: "The colossi are felt in the hollow, not seen (WORLD-PLAN beat 6): a deep thud every 2.5 s while one crosses far above, grit sifting from the ceiling in time, lamps swaying.",
  defaults: { every: 70, length: 30, step: 2.5, offset: 18 },
  cues: ["colossus.footfall", "grit.sift"],
  build() {
    return { last: -1 };
  },
  initial: "listening",
  states: {
    listening: {
      update(c) {
        const P = c.params as unknown as FootfallParams;
        const t = (c.world.time + P.offset) % P.every;
        if (t > P.length) return;
        const k = Math.floor(t / P.step);
        if (k === c.refs.last) return;
        c.refs.last = k;
        // the crossing swells in and fades: strength by where it is in the crossing
        const x = t / P.length;
        const strength = Math.max(0.25, Math.sin(Math.PI * Math.min(1, x + 0.04)));
        thud(c, strength);
      },
    },
  },
  actions: {
    /** One footfall now (the story, or a capture). */
    thud: (c, arg) => {
      thud(c, Number(arg ?? 1));
    },
  },
  demo: {
    w: 6,
    with: [
      { id: "dust", params: { kind: "grit", width: 3, height: 3 }, dx: -1.5, at: 0 },
      { id: "lampPost", params: { lit: true }, dx: 1.6 },
    ],
    script: [
      { label: "a footfall far above", act: "thud", arg: 1, wait: 2.5 },
      { label: "and another", act: "thud", arg: 1, wait: 2.5 },
    ],
  },
});

function thud(c: Prop<FootRefs>, strength: number): void {
  footfall(strength);
  c.sound("colossus.footfall", 0.4 + strength * 0.6);
  // a 1 px shake at the peak of a crossing (the host drops it in reduced motion)
  if (strength > 0.7) c.emit({ type: "shake", amplitude: 1, duration: 0.25 });
  const H = c.params.H;
  for (const p of c.world.props) {
    if (p === c) continue;
    const id = p.recipe.id;
    if (id === "dust" && p.params["kind"] === "grit") {
      p.act("sift", strength);
      // and a thin curtain of paler grit that catches the lamplight, so the sifting reads
      const w = Number(p.params["width"]) * H, top = p.y - Number(p.params["height"]) * H;
      if (!c.world.inView(p.x + w / 2, top + H, w)) continue;
      const n = Math.round(18 * strength * (c.world.reduced ? 0.5 : 1));
      for (let k = 0; k < n; k++)
        c.world.spawnAmbient({ x: p.x + c.rand() * w, y: top + c.rand() * 3, vx: (c.rand() - 0.5) * 4, vy: 20 + c.rand() * 40, life: 1.2 + c.rand() * 1.4, rgb: c.rand() < 0.5 ? [168, 138, 104] : [196, 166, 124], flags: P_GRAV | P_DRAG | P_FADE, size: c.rand() < 0.2 ? 2 : 1 });
    }
    else if (id === "lampPost") p.act("gust", 0.35 * strength);
    else if (id === "hangingLantern" || id === "marketLantern") p.act("nudge", 0.4 * strength);
    // (cables and awnings are left alone: a verlet line or a cloth woken every 2.5 s through a
    // 30 s crossing costs more than the sway is worth; the dash, steam and hits still move them)
  }
}

// ---------------------------------------------------------------------------
// hollowCable: a short cable span or a hanging chain, with a tight draw box
// ---------------------------------------------------------------------------

/**
 * The kit's cable sizes its rope part to reach anywhere the rope could swing
 * (fine for one line in a sandbox); the market strings many across a street
 * that stays in a breeze, so its lines never sleep. This one keeps the same
 * verlet line in a draw box just big enough for its sag and swing, so an
 * awake line redraws a few thousand cells instead of a million.
 */
export const hollowCable = defineRecipe<{ kind: "cable" | "chain"; to: [number, number]; free: boolean; length: number; slack: number; swing: number }, { rope: Rope }>({
  id: "hollowCable",
  breakage: "never",
  reason: "Cables strung across the market street between the walkway's columns, and a chain with a hook hanging from the dark: the hollow is built and wired by hand; they sway and swing when you pass.",
  defaults: { kind: "cable", to: [3, 0], free: false, length: 1.5, slack: 1.06, swing: 0.5 },
  cues: ["chain.rattle"],
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const to: [number, number] = p.free ? [0, u(p.length)] : [u(p.to[0]), u(p.to[1])];
    const len = Math.hypot(to[0], to[1]);
    const segs = Math.max(6, Math.round(len / u(0.14)));
    const { rope, part } = b.rope("line", { from: [0, 0], to, segments: segs, slack: p.free ? 1 : p.slack, mat: p.kind === "chain" ? "iron" : "cable", width: p.kind === "chain" ? 2 : 3, chain: p.kind === "chain", pinStart: true, pinEnd: !p.free, endMass: p.free ? 6 : undefined, damping: 0.985, windGain: 0.25, reach: u(p.swing) });
    part.z = 6;
    if (!p.free) {
      for (let i = 0; i < 300; i++) rope.step(1 / 60, u(17.5));
      rope.x0.set(rope.x);
      rope.y0.set(rope.y);
      rope.px.set(rope.x);
      rope.py.set(rope.y);
    } else {
      const hw = u(0.16), hh = u(0.22);
      const hk = b.part("hook", { w: hw, h: hh, pivot: [hw >> 1, 0], at: to, layer: "mid", z: 7 });
      hk.rect((hw >> 1) - 2, 0, 4, u(0.08), { mat: "iron", profile: "cylV", piece: "shank" });
      hk.ring(hw >> 1, hh - u(0.07), u(0.03), u(0.07), { mat: "iron", profile: "dome", r: 2, piece: "hook" });
      hk.rect(0, hh - u(0.12), (hw >> 1) - 1, u(0.06), { mat: "iron", mode: "erase" });
      b.hang("hook", rope);
    }
    return { rope };
  },
  initial: "hanging",
  states: {
    hanging: {
      hit(c, h) {
        const [x, y] = hitCentre(h.hit.shape);
        const f = h.hit.type === "wind" ? 2 : h.hit.type === "slash" || h.hit.type === "point" ? 3 : 4.5;
        c.refs.rope.push(x, y, c.params.H * 1.6, h.hit.dir[0] * f, h.hit.dir[1] * f - 1);
        if (h.hit.type !== "wind") c.sound("chain.rattle", 0.5);
      },
    },
  },
  actions: {
    shake: (c, arg) => {
      const r = c.refs.rope, k = r.n >> 1;
      r.push(r.x[k]!, r.y[k]!, c.params.H * 3, Number(arg ?? 1) * 1.5, -0.6);
    },
  },
  demo: {
    w: 6,
    at: 2.4,
    params: { to: [3, 0.1] },
    variants: [{ label: "free chain and hook", params: { kind: "chain", free: true, length: 1.6, swing: 0.8 }, dx: 2.4 }],
    script: [
      { label: "hanging", wait: 0.8 },
      { label: "slash: it swings", hit: "slash", from: 1, face: 1, wait: 2 },
    ],
  },
});

// ---------------------------------------------------------------------------
// marketLantern: a lantern on a cord, swinging as one pendulum
// ---------------------------------------------------------------------------

interface MarketLanternRefs {
  body: Part;
  swing: Pendulum;
  flame: Flame;
}

/**
 * The market's lanterns under the walkway (paper) and over the archive door
 * (iron). One part that turns about its hook (pixel-safe rotation) on a
 * pendulum: a hit, the dash's wind, a steam burst or a far footfall swings
 * it and it settles. Cheaper than a verlet chain, which matters in a street
 * that is never quite still.
 */
export const marketLantern = defineRecipe<{ kind: "paper" | "iron"; drop: number; lit: boolean }, MarketLanternRefs>({
  id: "marketLantern",
  breakage: "heal",
  reason: "Warm lamps hung under the walkway at every stall (WORLD-PLAN: lamps at every stall) and a small lamp over the archive's door: they sway when you pass close, and the market feels lived in.",
  defaults: { kind: "paper", drop: 0.8, lit: true },
  cues: ["lamp.on", "cloth.hit", "glass.hit"],
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const paper = p.kind === "paper";
    const lw = u(paper ? 0.26 : 0.2), lh = u(paper ? 0.34 : 0.3);
    const drop = u(p.drop);
    const W = lw + 4;
    const cx = W >> 1;
    const body = b.part("body", { w: W, h: drop + lh, pivot: [cx, 0], at: [0, 0], layer: "mid", z: 9, smoothRotate: true });
    // the cord (paper) or chain (iron) from the hook
    for (let y = 0; y < drop; y++) body.rect(cx - (paper ? 0 : (y >> 1) % 2), y, paper ? 1 : 2, 1, { mat: paper ? "rope" : "iron", profile: "flat", piece: "cord", noInk: paper });
    const top = drop;
    if (paper) {
      body.rect(cx - 2, top, 4, u(0.04), { mat: "woodDark", profile: "cylV", piece: "cap" });
      body.ellipse(cx, top + lh / 2 + 1, lw / 2, lh / 2 - u(0.05), { mat: "paperLamp", profile: "dome", r: 5, piece: "paper" });
      for (let y = top + u(0.08); y < top + lh - u(0.06); y += u(0.05)) body.rect(2, y, lw, 1, { mat: "paperLamp", mode: "paint", tone: -1 });
      body.rect(cx - u(0.07), top + u(0.03), u(0.14), 3, { mat: "woodDark", profile: "cylH", z: 2, piece: "rim" });
      body.rect(cx - u(0.07), top + lh - 3, u(0.14), 3, { mat: "woodDark", profile: "cylH", z: 2, piece: "rim" });
      body.rect(cx - 1, top + lh - 1, 2, 1, { mat: "clothRed", profile: "flat", piece: "tassel" });
    } else {
      body.poly([cx - u(0.1), top + u(0.08), cx + u(0.1), top + u(0.08), cx + u(0.03), top + u(0.02), cx - u(0.03), top + u(0.02)], { mat: "iron", profile: "dome", r: 2, piece: "cap" });
      body.rect(cx - u(0.08), top + u(0.08), u(0.16), u(0.15), { mat: "lampGlass", profile: "flat", depth: 1, piece: "glass" });
      body.rect(cx - u(0.08) + 2, top + u(0.08) + 2, u(0.16) - 4, u(0.15) - 4, { mat: "lampGlass", mode: "paint", tone: 1 });
      for (const x of [cx - u(0.08), cx - 1, cx + u(0.08) - 2]) body.rect(x, top + u(0.08), 2, u(0.15), { mat: "brass", profile: "cylV", z: 2, piece: "frame" });
      body.rect(cx - u(0.09), top + u(0.23), u(0.18), 3, { mat: "brass", profile: "cylH", z: 2, piece: "base" });
    }
    const flame = addFlame(b, { name: "flame", parent: "body", at: [cx, top + (paper ? Math.round(lh * 0.7) : u(0.21))], size: paper ? [0.05, 0.09] : [0.06, 0.1], light: 2.4, intensity: 0.7, glow: paper ? 0.4 : 0.3, colour: paper ? [1, 0.6, 0.34] : [1, 0.7, 0.4], z: paper ? 8 : 10, lit: p.lit });
    if (paper) flame.part.visible = false;
    return { body: b.get("body"), swing: new Pendulum(drop + lh / 2, u(17.5), 0.8), flame };
  },
  initial: "on",
  states: {
    on: {
      update(c, dt) {
        const r = c.refs;
        stepFlame(c, r.flame, dt);
        // a steam burst or the dash's gust nudges it
        const [wx] = c.world.windAt(c.x, c.y + c.params.H * 0.6);
        const push = Math.abs(wx) > c.params.H * 1.2 ? wx * 0.00012 : 0;
        if (r.swing.resting && !push) return;
        r.swing.step(dt, push);
        r.body.rot = Math.max(-0.6, Math.min(0.6, r.swing.angle));
      },
      hit(c, h) {
        const r = c.refs;
        r.swing.impulse((h.hit.dir[0] < 0 ? -1 : 1) * (h.hit.type === "wind" ? 0.9 : h.hit.type === "slash" || h.hit.type === "point" ? 1.8 : 2.6));
        if (h.hit.type !== "wind") c.damage(h.hit, ["body"]);
      },
    },
  },
  actions: {
    nudge: (c, arg) => {
      c.refs.swing.impulse(Number(arg ?? 1) * 0.9);
    },
  },
  demo: {
    w: 4,
    at: 2.6,
    params: { kind: "paper" },
    variants: [{ label: "iron (the archive door)", params: { kind: "iron", drop: 0.9 }, dx: 1.4 }],
    script: [
      { label: "lit", wait: 1 },
      { label: "dash wind: it swings and settles", hit: "wind", from: -1, wait: 3 },
      { label: "slash: a harder swing", hit: "slash", from: -0.6, wait: 3 },
    ],
  },
});

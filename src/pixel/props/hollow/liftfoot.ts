// The Lift Foot (C3, WORLD-PLAN section 4): a waiting room arranged wrong, at
// the foot of a megastructure. Cold fluorescent strips against the amber
// outside; a warning light that turns while the lift moves.
//
//   waitingChairs  a row of joined waiting-room chairs (E sits, like a
//                  bench); steel dents and mends
//   ticketDisplay  a number display frozen on one number
//   liftSign       an up arrow with the spire mark: the way to the downloads
//   warningLight   a beacon: off; amber and turning while the lift moves (it
//                  watches the lift gate); red while an arena summons (the
//                  story can send it); a hit makes it blink and settle
//   tubeLight      a ceiling fluorescent strip: cold light; now and then a
//                  tube stutters (through the flash gate)
//   liftCar        the lift platform in its shaft behind the gate: cables up
//                  out of sight, the counterweight on its rail; parked,
//                  called (lights), departing (it rises away), arriving
//   operatorBooth  the empty operator's booth and chair (the radio sits on it)
//
// Origins: the floor under the centre (the sign and the display: their mount
// point; the tube: its ceiling mount).

import "./materials.ts";
import { matId, puff } from "../../kit.ts";
import { Spring } from "../../motion.ts";
import { textPixels } from "../../materials.ts";
import { defineRecipe, type Prop } from "../../prop.ts";
import type { Part } from "../../part.ts";
import { steelHit } from "./walkway.ts";

// ---------------------------------------------------------------------------
// waitingChairs
// ---------------------------------------------------------------------------

interface ChairRefs {
  frame: Part;
  seat: Part;
  rock: Spring;
}

export const waitingChairs = defineRecipe<{ seats: number; facing: 1 | -1 }, ChairRefs>({
  id: "waitingChairs",
  breakage: "heal",
  reason: "A row of waiting-room chairs at the foot of the lift, arranged a little wrong (CANON: familiar places emptied of purpose); you can sit and wait, and nothing comes.",
  defaults: { seats: 4, facing: 1 },
  use: { reach: 0.5, prompt: "sit" },
  cues: ["bench.sit", "metal.hit"],
  standard: { h: 0.28, parts: ["seat"], note: "seat top above the floor" },
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const sw = u(0.42);
    const L = sw * p.seats + u(0.08);
    const seatTop = u(0.28);
    const backH = u(0.66);
    const fr = b.part("frame", { w: L, h: backH + 2, pivot: [L >> 1, backH + 2], at: [0, 0], layer: "mid", z: 6, smoothRotate: true });
    const bottom = backH + 2;
    // the steel beam the seats hang on, and its feet
    fr.rect(u(0.04), bottom - seatTop + u(0.06), L - u(0.08), 3, { mat: "iron", profile: "cylH", piece: "beam" });
    for (const x of [u(0.14), L - u(0.2)]) {
      fr.rect(x, bottom - seatTop + u(0.06), u(0.05), seatTop - u(0.06), { mat: "iron", profile: "cylV", piece: "leg" });
      fr.rect(x - u(0.06), bottom - 3, u(0.17), 3, { mat: "iron", profile: "bevel", r: 1, depth: 2, piece: "foot" });
    }
    // the moulded backs, each a little apart
    for (let k = 0; k < p.seats; k++) {
      const x0 = u(0.04) + k * sw + 2;
      const back = p.facing > 0 ? x0 : x0 + sw - u(0.1) - 4;
      fr.roundRect(back, bottom - backH, u(0.1), backH - seatTop + 2, 3, { mat: "hollowSeat", profile: "dome", r: 3, piece: `back${k % 2}` });
      fr.rect(back + 1, bottom - backH + 3, u(0.1) - 2, 1, { mat: "hollowSeat", mode: "paint", tone: 1 });
    }
    const sh = u(0.06);
    const st = b.part("seat", { w: L, h: sh, pivot: [L >> 1, sh], at: [0, -(seatTop - sh)], layer: "mid", z: 7, collide: "platform", smoothRotate: true });
    for (let k = 0; k < p.seats; k++) st.roundRect(u(0.04) + k * sw + 2, 0, sw - 4, sh, 2, { mat: "hollowSeat", profile: "bevel", r: 2, depth: 3, piece: `seat${k % 2}` });
    st.rect(0, 0, L, 1, { mat: "hollowSeat", mode: "paint", tone: 1 });
    // one seat's plastic cracked long ago
    st.cracks(u(0.04) + sw + sw / 2, 2, { n: 1, len: 5, seed: p.seed });
    return { frame: b.get("frame"), seat: b.get("seat"), rock: new Spring(110, 7) };
  },
  initial: "idle",
  states: {
    idle: {
      update: (c, dt) => rock(c, dt),
      use: () => "sat",
      hit: (c, h) => chairHit(c, h.hit),
    },
    sat: {
      sound: "bench.sit",
      enter(c) {
        c.emit({ type: "sit", x: c.x, y: c.y - c.params.H * 0.28 });
      },
      update: (c, dt) => rock(c, dt),
      use: () => "idle",
      exit(c) {
        c.emit({ type: "stand" });
      },
      hit: (c, h) => chairHit(c, h.hit),
    },
  },
  actions: {
    stand: (c) => (c.state === "sat" ? "idle" : undefined),
  },
  demo: {
    w: 6,
    params: { seats: 4 },
    script: [
      { label: "the row", wait: 0.6 },
      { label: "E: sit", use: true, wait: 1 },
      { label: "stand", act: "stand", wait: 0.4 },
      { label: "heavy: the steel dents, a seat cracks", hit: "heavy", from: -1, wait: 1.5 },
      { label: "mends", wait: 7 },
    ],
  },
});

function rock(c: Prop<ChairRefs>, dt: number): void {
  const r = c.refs;
  if (r.rock.resting) return;
  r.rock.step(dt);
  const a = Math.max(-0.08, Math.min(0.08, r.rock.x));
  r.frame.rot = a;
  r.seat.rot = a;
}

function chairHit(c: Prop<ChairRefs>, hit: import("../../hits.ts").Hit): void {
  if (hit.type === "wind") return;
  c.refs.rock.v += (hit.dir[0] < 0 ? -1 : 1) * (hit.type === "slash" ? 0.4 : 0.9);
  steelHit(c, hit);
}

// ---------------------------------------------------------------------------
// ticketDisplay
// ---------------------------------------------------------------------------

const SEG: Record<string, string> = {
  "0": "111101101101111",
  "1": "010110010010111",
  "2": "111001111100111",
  "3": "111001111001111",
  "4": "101101111001001",
  "5": "111100111001111",
  "6": "111100111101111",
  "7": "111001010010010",
  "8": "111101111101111",
  "9": "111101111001111",
};

export const ticketDisplay = defineRecipe<{ number: string; hang: number }, { box: Part; lit: number[] }>({
  id: "ticketDisplay",
  breakage: "never",
  reason: "The waiting room's ticket display, frozen on one number: nobody is called; it only makes the waiting feel real.",
  defaults: { number: "47", hang: 0 },
  cues: ["display.buzz"],
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const digits = p.number.slice(0, 3);
    const s = 3;
    const w = digits.length * 4 * s + 6 + u(0.1), h = 5 * s + 6 + u(0.06);
    const box = b.part("box", { w, h, pivot: [w >> 1, h >> 1], at: [0, 0], layer: "bg", z: 9 });
    // hung from the ceiling on two rods with ceiling plates (never stuck on the air)
    if (p.hang > 0) {
      const len = Math.max(4, u(p.hang) - (h >> 1) + 2);
      const rods = b.part("rods", { w, h: len, pivot: [w >> 1, len], at: [0, -(h >> 1) + 2], layer: "bg", z: 8, hittable: false });
      for (const x of [u(0.08), w - u(0.08) - 2]) {
        rods.rect(x, 0, 2, len, { mat: "iron", profile: "cylV", piece: "rod" });
        rods.rect(x - 3, 0, 8, 3, { mat: "iron", profile: "bevel", r: 1, depth: 2, piece: "plate" });
        rods.rect(x - 1, len - 4, 4, 3, { mat: "iron", profile: "bevel", r: 1, depth: 2, piece: "clamp" });
      }
    }
    box.roundRect(0, 0, w, h, 2, { mat: "iron", profile: "bevel", r: 2, depth: 3, piece: "case" });
    box.rect(3, 3, w - 6, h - 6, { mat: "screen", profile: "flat", z: 2, piece: "glass" });
    const lit: number[] = [];
    const ox = Math.round((w - (digits.length * 4 * s - s)) / 2), oy = Math.round((h - 5 * s) / 2);
    [...digits].forEach((ch, k) => {
      const g = SEG[ch] ?? SEG["0"]!;
      for (let i = 0; i < 15; i++) {
        const x = ox + k * 4 * s + (i % 3) * s, y = oy + Math.floor(i / 3) * s;
        box.rect(x, y, s - 1, s - 1, { mat: g[i] === "1" ? "hollowDigit" : "hollowDigitOff", profile: "flat", z: 3, piece: "segs", noInk: true });
        if (g[i] === "1") for (let a = 0; a < s - 1; a++) for (let c2 = 0; c2 < s - 1; c2++) lit.push(box.grid.inner(x + a, y + c2));
      }
    });
    b.light({ part: "box", at: [w / 2, h / 2], colour: [1, 0.3, 0.2], radius: u(1.1), intensity: 0.4 });
    return { box: b.get("box"), lit: lit.filter((i) => i >= 0) };
  },
  initial: "frozen",
  states: {
    frozen: {
      hit(c, h) {
        if (h.hit.type === "wind") return;
        c.refs.box.shake = 0.15;
        return "glitch";
      },
    },
    glitch: {
      sound: "display.buzz",
      update(c) {
        // the digits drop out once, then come back on the same number
        const off = c.t < 0.3;
        const g = c.refs.box.grid;
        const m = matId(off ? "hollowDigitOff" : "hollowDigit");
        for (const i of c.refs.lit) if (g.mat[i] !== m) {
          g.mat[i] = m;
          g.markRaw(i);
        }
        for (const L of c.lights) L.level = off ? 0 : 1;
      },
      after: [0.5, "frozen"],
    },
  },
  demo: {
    w: 3,
    at: 1.8,
    script: [
      { label: "frozen on one number", wait: 1 },
      { label: "slash: it drops out, comes back the same", hit: "slash", from: -0.3, wait: 1 },
    ],
  },
});

// ---------------------------------------------------------------------------
// liftSign
// ---------------------------------------------------------------------------

const SPIRE = `
....#....
....#....
...###...
...###...
..#####..
..#####..
.#######.
#########
`;

export const spireArrowSign = defineRecipe<{ label: string }, { board: Part }>({
  id: "spireArrowSign",
  breakage: "never",
  reason: "The lift foot's sign: an up arrow with the spire mark, the same mark the map uses for the downloads; the only wayfinding the lift needs.",
  defaults: { label: "" },
  cues: ["metal.hit"],
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const w = u(0.5), h = u(0.72);
    const bd = b.part("board", { w, h, pivot: [w >> 1, h >> 1], at: [0, 0], layer: "bg", z: 9 });
    bd.roundRect(0, 0, w, h, 3, { mat: "iron", profile: "bevel", r: 2, depth: 3, piece: "plate" });
    bd.rect(3, 3, w - 6, h - 6, { mat: "clothPale", profile: "flat", z: 2, piece: "face" });
    // the arrow up
    const cx = w >> 1;
    bd.poly([cx, 6, cx + u(0.14), 6 + u(0.14), cx + u(0.05), 6 + u(0.14), cx + u(0.05), 6 + u(0.28), cx - u(0.05), 6 + u(0.28), cx - u(0.05), 6 + u(0.14), cx - u(0.14), 6 + u(0.14)], { mat: "clothRed", profile: "flat", z: 3, piece: "arrow" });
    // the spire mark under it
    bd.ornament(cx - 9, h - 22, SPIRE, { "#": { mat: "stoneDark" } }, { mode: "over", scale: 2, z: 3 });
    if (p.label) {
      const t = textPixels(p.label.slice(0, 8));
      for (const [x, y] of t.pts) bd.rect(cx - Math.round(t.w / 2) + x, h - 30 + y, 1, 1, { mat: "stoneDark", mode: "paint" });
    }
    bd.rivets([[4, 4], [w - 5, 4], [4, h - 5], [w - 5, h - 5]], { mat: "brass", r: 1 });
    return { board: b.get("board") };
  },
  initial: "idle",
  states: {
    idle: {
      hit(c, h) {
        if (h.hit.type !== "wind") c.refs.board.shake = 0.15;
      },
    },
  },
  demo: { w: 3, at: 2, script: [{ label: "up, to the spire", wait: 0.6 }] },
});

// ---------------------------------------------------------------------------
// warningLight
// ---------------------------------------------------------------------------

interface WarnRefs {
  dome: Part;
  lamp: number[];
  beam: import("../../prop.ts").PropGlow;
  ang: number;
}

export const hollowBeacon = defineRecipe<{ watch: string }, WarnRefs>({
  id: "hollowBeacon",
  breakage: "never",
  reason: "A beacon over the lift gate: amber and turning while the lift moves, red while the arena summons, dark otherwise; it tells you the machine is alive.",
  defaults: { watch: "" },
  cues: ["warning.on"],
  build(b) {
    const u = (f: number): number => b.u(f);
    const w = u(0.24), h = u(0.2);
    const d = b.part("dome", { w, h, pivot: [w >> 1, 0], at: [0, 0], layer: "bg", z: 10 });
    d.rect(0, 0, w, u(0.05), { mat: "iron", profile: "bevel", r: 1, depth: 2, piece: "base" });
    d.ellipse(w >> 1, u(0.05) + u(0.08), w * 0.4, u(0.09), { mat: "hollowDigitOff", profile: "dome", r: 4, piece: "glass" });
    for (let x = 3; x < w - 3; x += 4) d.rect(x, u(0.05), 1, u(0.14), { mat: "iron", mode: "paint" });
    const lamp: number[] = [];
    for (let y = u(0.05); y < h; y++) for (let x = 0; x < w; x++) {
      const i = d.grid.inner(x, y);
      if (i >= 0 && d.grid.mat[i] === matId("hollowDigitOff")) lamp.push(i);
    }
    b.light({ part: "dome", at: [w / 2, u(0.12)], colour: [1, 0.6, 0.2], radius: u(2.6), intensity: 0.7, on: false });
    const beam = b.glow({ kind: "beam", part: "dome", at: [w / 2, u(0.12)], to: [w / 2 + u(1.8), u(1.2)], colour: [1, 0.62, 0.22], radius: u(0.06), width1: u(0.7), intensity: 0.18, on: false });
    return { dome: b.get("dome"), lamp, beam, ang: 0 };
  },
  initial: "off",
  states: {
    off: {
      enter: (c) => warn(c, null),
      update(c) {
        const w = watched(c);
        if (w) c.go("amber");
      },
      hit: (_c, h) => (h.hit.type === "wind" ? undefined : "blink"),
    },
    amber: {
      sound: "warning.on",
      enter: (c) => warn(c, "hollowAmber"),
      update(c, dt) {
        turn(c, dt, [1, 0.6, 0.2]);
        if (c.t > 2.5 && !watched(c)) c.go("off");
      },
    },
    red: {
      enter: (c) => warn(c, "hollowRed"),
      update: (c, dt) => turn(c, dt, [1, 0.25, 0.18]),
    },
    blink: {
      enter: (c) => warn(c, "hollowAmber"),
      after: [0.5, "off"],
    },
  },
  actions: {
    amber: () => "amber",
    red: () => "red",
    off: () => "off",
  },
  demo: {
    w: 5,
    at: 3,
    script: [
      { label: "off", wait: 0.8 },
      { label: "amber, turning (the lift moves)", act: "amber", wait: 3 },
      { label: "red (the arena summons)", act: "red", wait: 3 },
      { label: "off", act: "off", wait: 0.8 },
    ],
  },
});

/** Is the watched prop (the lift gate) opening or open? */
function watched(c: Prop<WarnRefs>): boolean {
  const id = String(c.params["watch"] ?? "");
  if (!id) return false;
  const p = c.world.find(id);
  return !!p && (p.state === "opening" || p.state === "open");
}

function warn(c: Prop<WarnRefs>, mat: string | null): void {
  const g = c.refs.dome.grid;
  const m = matId(mat ?? "hollowDigitOff");
  for (const i of c.refs.lamp) if (g.mat[i] !== m) {
    g.mat[i] = m;
    g.markRaw(i);
  }
  for (const L of c.lights) L.on = !!mat;
  c.refs.beam.on = !!mat;
  if (mat) {
    const col: [number, number, number] = mat === "hollowRed" ? [1, 0.25, 0.18] : [1, 0.6, 0.2];
    for (const L of c.lights) L.colour = col;
    c.refs.beam.colour = col;
  }
}

/** The beam sweeps round (a steady turn, never a flash): its far end swings across and back. */
function turn(c: Prop<WarnRefs>, dt: number, col: [number, number, number]): void {
  const r = c.refs;
  r.ang += dt * (c.world.reduced ? 1.2 : 2.6);
  const H = c.params.H;
  const s = Math.sin(r.ang);
  r.beam.to = [r.dome.grid.w / 2 + s * H * 1.8, H * 1.2];
  // the light is strongest when the beam faces us (the middle of its sweep)
  const face = Math.cos(r.ang);
  for (const L of c.lights) {
    L.intensity = 0.35 + 0.35 * Math.max(0, face);
    L.colour = col;
  }
}

// ---------------------------------------------------------------------------
// tubeLight
// ---------------------------------------------------------------------------

interface TubeRefs {
  fix: Part;
  tube: number[];
  next: number;
}

export const fluorescentStrip = defineRecipe<{ length: number; drop: number }, TubeRefs>({
  id: "fluorescentStrip",
  breakage: "never",
  reason: "Cold fluorescent strips in the waiting room, against the amber outside: the lift foot belongs to the spire's cold machinery, not the market's fire.",
  defaults: { length: 1.4, drop: 0.3 },
  cues: ["tube.tick"],
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const L = u(p.length), d = u(p.drop);
    const fx = b.part("fix", { w: L, h: d + u(0.1), pivot: [L >> 1, 0], at: [0, 0], layer: "bg", z: 8 });
    for (const x of [u(0.15), L - u(0.15)]) fx.rect(x, 0, 1, d, { mat: "iron", profile: "flat", piece: "wire" });
    fx.rect(0, d, L, u(0.05), { mat: "iron", profile: "bevel", r: 1, depth: 2, piece: "housing" });
    fx.rect(3, d + u(0.05), L - 6, u(0.04), { mat: "hollowTube", profile: "cylH", z: 2, piece: "tube", noInk: true });
    const tube: number[] = [];
    for (let y = d + u(0.05); y < d + u(0.09); y++) for (let x = 3; x < L - 3; x++) tube.push(fx.grid.inner(x, y));
    b.light({ part: "fix", at: [L / 2, d + u(0.08)], colour: [0.78, 0.94, 0.92], radius: u(3.2), intensity: 0.55, flicker: 0.02 });
    b.glow({ part: "fix", at: [L / 2, d + u(0.07)], colour: [0.6, 0.8, 0.78], radius: L * 0.55, intensity: 0.12, flat: 0.12 });
    return { fix: b.get("fix"), tube: tube.filter((i) => i >= 0), next: 5 + (p.seed % 11) };
  },
  initial: "on",
  states: {
    on: {
      enter: (c) => tube(c, 1),
      update(c, dt) {
        const r = c.refs;
        r.next -= dt;
        if (r.next <= 0) {
          r.next = 9 + c.rand() * 16;
          if (!c.world.reduced && c.world.flashGate.allow(c.world.time, c.world.reduced)) c.go("stutter");
        }
      },
      hit(c, h) {
        if (h.hit.type !== "wind") c.refs.fix.shake = 0.12;
      },
    },
    stutter: {
      sound: "tube.tick",
      update(c) {
        const t = c.t;
        tube(c, t < 0.15 ? 0 : t < 0.3 ? 1 : t < 0.42 ? 0 : 1);
      },
      after: [0.55, "on"],
    },
  },
  demo: {
    w: 4,
    at: 3,
    script: [
      { label: "on", wait: 1 },
      { label: "a stutter", go: "stutter", wait: 1 },
    ],
  },
});

function tube(c: Prop<TubeRefs>, on: number): void {
  const g = c.refs.fix.grid;
  const m = matId(on ? "hollowTube" : "hollowTubeOff");
  for (const i of c.refs.tube) if (g.mat[i] !== m) {
    g.mat[i] = m;
    g.markRaw(i);
  }
  for (const L of c.lights) L.level = on;
  for (const G of c.glows) G.level = on;
}

// ---------------------------------------------------------------------------
// liftCar
// ---------------------------------------------------------------------------

interface CarRefs {
  car: Part;
  weight: Part;
  y: number;
  lamp: number[];
}

export const hollowLiftCar = defineRecipe<{ shaft: number; watch: string }, CarRefs>({
  id: "hollowLiftCar",
  breakage: "never",
  reason: "The spire lift's platform, parked in its shaft behind the gate: cables up out of sight, the counterweight on its rail; you ride it to the storm.",
  defaults: { shaft: 4.6, watch: "" },
  cues: ["lift-start", "lift-dock"],
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const W = u(2.3), Hh = u(p.shaft);
    // the shaft's back: rails and the counterweight track (behind everything)
    const sh = b.part("shaft", { w: W + u(0.5), h: Hh, pivot: [(W + u(0.5)) >> 1, Hh], at: [0, 0], layer: "bg", z: 1, hittable: false });
    sh.rect(0, 0, W + u(0.5), Hh, { mat: "soot", profile: "flat", piece: "back" });
    for (const x of [u(0.1), W + u(0.34)]) sh.rect(x, 0, u(0.06), Hh, { mat: "iron", profile: "cylV", piece: "rail" });
    for (let y = 8; y < Hh; y += u(0.5)) sh.rect(u(0.1), y, W + u(0.3), 2, { mat: "iron", mode: "paint", tone: -1 });
    // the car: a cage with a floor plate, a roof, bars, a lamp
    const ch = u(2.6);
    const car = b.part("car", { w: W, h: ch + u(1.6), pivot: [W >> 1, ch + u(1.6)], at: [0, 0], layer: "bg", z: 3, hittable: false });
    const top = u(1.6);
    car.rect(0, top + ch - u(0.12), W, u(0.12), { mat: "hollowSteel", profile: "bevel", r: 2, depth: 3, piece: "floor" });
    car.rect(0, top, W, u(0.1), { mat: "hollowSteel", profile: "bevel", r: 2, depth: 3, piece: "roof" });
    for (let x = 0; x < W; x += u(0.18)) car.rect(x, top + u(0.1), 2, ch - u(0.22), { mat: "iron", profile: "cylV", piece: "bars" });
    car.rect(0, top + Math.round(ch * 0.45), W, 2, { mat: "iron", profile: "cylH", piece: "rail" });
    // cables from the roof up out of sight
    for (const x of [Math.round(W * 0.3), Math.round(W * 0.7)]) car.rect(x, 0, 2, top, { mat: "cable", profile: "cylV", piece: "cable" });
    car.rect(Math.round(W * 0.5) - u(0.12), top - u(0.1), u(0.24), u(0.1), { mat: "iron", profile: "bevel", r: 1, depth: 2, piece: "sheave" });
    // a small lamp under the roof
    car.rect(Math.round(W / 2) - 3, top + u(0.1), 6, 3, { mat: "hollowDigitOff", profile: "flat", z: 2, piece: "lamp", noInk: true });
    const lamp: number[] = [];
    for (let y = top + u(0.1); y < top + u(0.1) + 3; y++) for (let x = Math.round(W / 2) - 3; x < Math.round(W / 2) + 3; x++) lamp.push(car.grid.inner(x, y));
    // the counterweight beside it, on the right rail
    const wt = b.part("weight", { w: u(0.22), h: u(0.7), pivot: [u(0.11), u(0.7)], at: [(W >> 1) + u(0.13), -Hh + u(1.4)], layer: "bg", z: 2, hittable: false });
    wt.rect(0, 0, u(0.22), u(0.7), { mat: "stoneDark", profile: "bevel", r: 2, depth: 3 });
    for (let y = 4; y < u(0.7); y += 6) wt.rect(0, y, u(0.22), 1, { mat: "stoneDark", mode: "paint", tone: -1 });
    b.light({ part: "car", at: [W / 2, top + u(0.2)], colour: [0.9, 0.95, 0.9], radius: u(1.8), intensity: 0.4, on: false });
    return { car: b.get("car"), weight: b.get("weight"), y: 0, lamp: lamp.filter((i) => i >= 0) };
  },
  initial: "parked",
  states: {
    parked: {
      enter: (c) => carLamp(c, false),
      update(c) {
        c.refs.car.y = 0;
        // the gate opening calls it: its lamp comes on, it waits for you
        if (gateOpen(c)) c.go("called");
      },
    },
    called: {
      enter: (c) => carLamp(c, true),
      update(c) {
        if (c.t > 1 && !gateOpen(c)) c.go("parked");
      },
    },
    departing: {
      sound: "lift-start",
      update(c, dt) {
        const r = c.refs;
        // it rises away out of the view (the ride itself is the next room)
        r.y = Math.min(c.params.H * 6, r.y + dt * c.params.H * Math.min(4.5, c.t * 2));
        r.car.y = -Math.round(r.y);
        r.weight.y = Math.round(-c.params.H * Number(c.params["shaft"]) + c.params.H * 1.4 + r.y);
      },
      after: [5, "parked"],
    },
    arriving: {
      enter(c) {
        c.refs.y = c.params.H * 4;
        carLamp(c, true);
      },
      update(c, dt) {
        const r = c.refs;
        r.y = Math.max(0, r.y - dt * c.params.H * Math.max(0.6, 3 - c.t));
        r.car.y = -Math.round(r.y);
        if (r.y <= 0) {
          c.sound("lift-dock", 0.8);
          c.go("parked");
        }
      },
    },
  },
  actions: {
    call: () => "called",
    depart: () => "departing",
    arrive: () => "arriving",
  },
  demo: {
    w: 5,
    script: [
      { label: "parked", wait: 1 },
      { label: "called: its lamp comes on", act: "call", wait: 1.2 },
      { label: "departs up the shaft", act: "depart", wait: 5 },
      { label: "arriving", act: "arrive", wait: 3 },
    ],
  },
});

function gateOpen(c: Prop<CarRefs>): boolean {
  const id = String(c.params["watch"] ?? "");
  const p = id ? c.world.find(id) : undefined;
  return !!p && (p.state === "opening" || p.state === "open");
}

function carLamp(c: Prop<CarRefs>, on: boolean): void {
  const g = c.refs.car.grid;
  const m = matId(on ? "hollowTube" : "hollowDigitOff");
  for (const i of c.refs.lamp) if (g.mat[i] !== m) {
    g.mat[i] = m;
    g.markRaw(i);
  }
  for (const L of c.lights) L.on = on;
}

// ---------------------------------------------------------------------------
// operatorBooth
// ---------------------------------------------------------------------------

export const operatorBooth = defineRecipe<Record<string, never>, { booth: Part }>({
  id: "operatorBooth",
  breakage: "heal",
  reason: "The lift operator's booth, empty: a counter window, a stool, a coat on a hook; the radio on the chair keeps the theme going for nobody.",
  defaults: {},
  cues: ["wood.hit"],
  build(b) {
    const u = (f: number): number => b.u(f);
    const W = u(1.5), Hh = u(2.2);
    const bo = b.part("booth", { w: W, h: Hh, pivot: [W >> 1, Hh], at: [0, 0], layer: "bg", z: 4 });
    // walls: panelled below, a glazed window above, a little roof
    bo.rect(0, u(0.15), W, Hh - u(0.15), { mat: "hollowSeat", profile: "flat", depth: 1, tone: -1, piece: "wall" });
    bo.rect(0, 0, W, u(0.15), { mat: "iron", profile: "bevel", r: 2, depth: 3, piece: "roof" });
    // dusty dark glass with the empty booth behind it, a sheen across it from the tubes (round 1's pale
    // pane was the brightest, most saturated thing in the room)
    bo.rect(u(0.1), u(0.35), W - u(0.2), u(0.75), { mat: "hollowGlassDim", profile: "flat", z: 2, piece: "glass" });
    for (let k = 0; k < 2; k++) {
      const gx = u(0.2) + k * u(0.55);
      for (let t = 0; t < u(0.3); t++) bo.rect(gx + t, u(0.4) + Math.round(t * 1.4), 2 - k, 1, { mat: "hollowGlassDim", mode: "paint", tone: 2 });
    }
    bo.rect(u(0.1), u(0.35) + u(0.37), W - u(0.2), 2, { mat: "iron", profile: "cylH", z: 3, piece: "mullion" });
    bo.rect(Math.round(W / 2) - 1, u(0.35), 2, u(0.75), { mat: "iron", profile: "cylV", z: 3, piece: "mullion" });
    bo.rect(0, u(1.1), W, u(0.07), { mat: "wood", profile: "bevel", r: 1, depth: 2, z: 3, piece: "counter" });
    for (let x = u(0.05); x < W; x += u(0.25)) bo.rect(x, u(1.2), 1, Hh - u(1.3), { mat: "hollowSeat", mode: "paint", tone: -2 });
    // a coat on a hook inside, seen through the glass
    bo.poly([u(0.3), u(0.45), u(0.42), u(0.45), u(0.46), u(0.95), u(0.26), u(0.95)], { mat: "leatherDark", profile: "dome", r: 3, z: 1, piece: "coat" });
    return { booth: b.get("booth") };
  },
  initial: "idle",
  states: {
    idle: {
      hit(c, h) {
        if (h.hit.type === "wind") return;
        c.damage(h.hit);
        const [x, y] = [c.x, c.y - c.params.H];
        if (h.hit.type !== "slash") puff(c.world, "splinter", x, y, 4);
      },
    },
  },
  demo: { w: 4, script: [{ label: "the empty booth", wait: 0.6 }] },
});

/** The empty operator's chair (the radio sits on its seat). */
export const operatorChair = defineRecipe<Record<string, never>, null>({
  id: "operatorChair",
  breakage: "heal",
  reason: "The operator's chair beside the booth, empty; the radio on its seat is the only thing still working here.",
  defaults: {},
  cues: ["wood.hit"],
  build(b) {
    const u = (f: number): number => b.u(f);
    const W = u(0.46), Hh = u(0.9);
    const ch = b.part("chair", { w: W, h: Hh, pivot: [W >> 1, Hh], at: [0, 0], layer: "mid", z: 5 });
    ch.rect(0, Hh - u(0.46), W, u(0.05), { mat: "wood", profile: "bevel", r: 2, depth: 3, piece: "seat" });
    for (const x of [u(0.03), W - u(0.07)]) ch.rect(x, Hh - u(0.41), u(0.04), u(0.41), { mat: "woodDark", profile: "cylV", piece: "leg" });
    ch.rect(u(0.02), 0, u(0.05), Hh - u(0.41), { mat: "woodDark", profile: "cylV", piece: "back" });
    for (const y of [u(0.05), u(0.2)]) ch.rect(u(0.02), y, u(0.2), u(0.05), { mat: "wood", profile: "bevel", r: 1, depth: 2, piece: "slat" });
    return null;
  },
  initial: "idle",
  states: { idle: {} },
  demo: { w: 3, script: [{ label: "the empty chair", wait: 0.6 }] },
});

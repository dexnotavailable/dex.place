// Two boards on the lodge wall behind the counter (WORLD-PLAN A3).
//
// lampBoard: six small lamps on a dark plank, one per shrine, with tally
// notches under them (one to six). Each comes on when its shrine is lit and
// stays on: progress with no UI. The host (Ringwater's room state) says which
// with the states on1 ... on6 (idempotent), so it always mirrors the save.
//
// productBoard: the first downloads pointer, twenty seconds from the dock. It
// lists the real products from the website's live downloads list
// (src/site/data/downloads.ts; nothing is invented), with a small black spire
// and its red light painted at the side, the way the spire stands on the
// horizon. E opens the website's downloads page in a panel (with the plain
// link to open it as a page); the spire mark points out of the window.
//
// Both never break: hits shake them on their nails. Origin: the wall mount
// point (the board's top middle).

import "./materials.ts";
import { downloads } from "../../../site/data/downloads.ts";
import { textPixels } from "../../materials.ts";
import { Spring } from "../../motion.ts";
import { defineRecipe, type Prop, type PropGlow } from "../../prop.ts";
import type { Part } from "../../part.ts";

interface LampRefs {
  off: Part[];
  on: Part[];
  glows: PropGlow[];
  shake: Spring;
  board: Part;
}

const lampStates: Record<string, import("../../prop.ts").StateDef<LampRefs>> = {
  idle: {
    update: (c, dt) => shakeStep(c.refs.shake, c.refs.board, dt),
    hit(c, h) {
      c.refs.shake.impulse((h.hit.dir[0] < 0 ? -1 : 1) * 0.2);
    },
  },
};
for (let n = 1; n <= 6; n++)
  lampStates[`on${n}`] = {
    enter(c) {
      setLamp(c, n, true);
      c.go("idle");
    },
  };

export const lampBoard = defineRecipe<{ lit: number[] }, LampRefs>({
  id: "lampBoard",
  breakage: "never",
  reason: "The keeper keeps a lamp for each shrine on the route; the board shows which you have lit, so progress needs no UI.",
  defaults: { lit: [] },
  persist: [],
  cues: ["wood.hit"],
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const W = u(1.3), Hh = u(0.42);
    const bd = b.part("board", { w: W, h: Hh, pivot: [W >> 1, 0], at: [0, 0], layer: "bg", z: 6, smoothRotate: true });
    bd.rect(0, 0, W, Hh, { mat: "woodDark", profile: "bevel", r: 2, depth: 3, piece: "plank" });
    bd.rect(0, 0, W, 1, { mat: "woodDark", mode: "paint", tone: 1 });
    bd.grain({ dir: "h", seed: p.seed, mats: ["woodDark"], stretch: 18 });
    bd.rivets([[3, 3], [W - 4, 3]], { mat: "iron", r: 1.2 });
    const off: Part[] = [], on: Part[] = [], glows: PropGlow[] = [];
    const step = (W - u(0.2)) / 6;
    for (let n = 1; n <= 6; n++) {
      const x = Math.round(u(0.1) + step * (n - 0.5));
      // an iron cup on a bracket; the tally notches below
      bd.rect(x - 3, u(0.2), 7, 3, { mat: "iron", profile: "cylH", z: 2, piece: `cup${n}` });
      bd.rect(x - 1, u(0.2) + 3, 3, 3, { mat: "iron", profile: "cylV", z: 2, piece: `stem${n}` });
      for (let k = 0; k < n; k++) bd.rect(x - Math.floor((n * 2 - 1) / 2) + k * 2, u(0.33), 1, 3, { mat: "woodDark", mode: "paint", tone: -2 });
      const lo = b.part(`off${n}`, { w: 5, h: 5, pivot: [2, 5], parent: "board", at: [x, u(0.2)], layer: "bg", z: 8 });
      lo.circle(2, 2, 2.3, { mat: "ringLampOff", profile: "dome", r: 2 });
      const ln = b.part(`on${n}`, { w: 5, h: 5, pivot: [2, 5], parent: "board", at: [x, u(0.2)], layer: "bg", z: 8, lit: 0, visible: false });
      ln.circle(2, 2, 2.3, { mat: "ringLampOn", profile: "dome", r: 2, noInk: true });
      ln.rect(2, 0, 1, 2, { mat: "ringLampOn", mode: "paint", tone: 1 });
      off.push(b.get(`off${n}`));
      on.push(b.get(`on${n}`));
      glows.push(b.glow({ part: `on${n}`, at: [2, 2], colour: [1, 0.66, 0.34], radius: u(0.1), intensity: 0.5, flicker: 0.3, on: false }));
    }
    return { off, on, glows, shake: new Spring(120, 8), board: b.get("board") };
  },
  initial: (c) => {
    for (const n of (c.params["lit"] as number[]) ?? []) setLamp(c, n, true);
    return "idle";
  },
  states: lampStates,
  demo: {
    indoor: true,
    at: 1.6,
    w: 4,
    script: [
      { label: "all six dark after the storm", wait: 1 },
      { label: "shrine 1 lit", go: "on1", wait: 0.8 },
      { label: "shrine 2 lit", go: "on2", wait: 0.8 },
      { label: "shrine 5 lit", go: "on5", wait: 1 },
      { label: "slash: shakes on its nails", hit: "slash", from: -0.8, wait: 1 },
    ],
  },
});

function setLamp(c: Prop<LampRefs>, n: number, lit: boolean): void {
  const i = n - 1;
  if (i < 0 || i > 5) return;
  c.refs.off[i]!.visible = !lit;
  c.refs.on[i]!.visible = lit;
  c.refs.glows[i]!.on = lit;
}

function shakeStep(s: Spring, part: Part, dt: number): void {
  if (s.resting) return;
  s.step(dt);
  part.rot = Math.max(-0.08, Math.min(0.08, s.x));
}

// ---------------------------------------------------------------------------

/** The real product list (the website's downloads data): names, and the version when there is a file. */
export function productLines(): string[] {
  return downloads.map((d) => (d.file ? `${d.name} ${d.file.version}` : d.name));
}

interface ProductRefs {
  board: Part;
  shake: Spring;
  light: PropGlow;
}

export const productBoard = defineRecipe<{ lines: string[] }, ProductRefs>({
  id: "productBoard",
  breakage: "never",
  reason: "The first downloads pointer, twenty seconds in: the real products, the website's downloads one step away, and the spire's red light on the horizon for anyone who wants the long way.",
  defaults: { lines: [] },
  use: { reach: 0.6, prompt: "downloads" },
  cues: ["wood.hit", "paper.open"],
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const lines = (p.lines.length ? p.lines : productLines()).map((l) => l.toUpperCase().slice(0, 20));
    const s = 2;
    const tw = Math.max(...lines.map((l) => textPixels(l).w)) * s;
    const spire = u(0.26);
    const W = tw + spire + u(0.2), Hh = Math.max(u(0.5), lines.length * 6 * s + u(0.16));
    const bd = b.part("board", { w: W, h: Hh, pivot: [W >> 1, 0], at: [0, 0], layer: "bg", z: 6, smoothRotate: true });
    bd.rect(0, 0, W, Hh, { mat: "wood", profile: "bevel", r: 2, depth: 3, piece: "plank" });
    bd.rect(3, 3, W - 6, Hh - 6, { mat: "parchment", profile: "flat", depth: 1, z: 1, piece: "paper" });
    bd.speckle({ amount: 0.1, seed: p.seed, tone: -1, mats: ["parchment"] });
    bd.rivets([[2, 2], [W - 3, 2], [2, Hh - 3], [W - 3, Hh - 3]], { mat: "iron", r: 1 });
    // the names, in ink
    lines.forEach((l, k) => {
      const { pts } = textPixels(l);
      for (const [x, y] of pts) bd.rect(u(0.1) + x * s, u(0.08) + k * 6 * s + y * s, s, s, { mat: "mapInk", mode: "paint", tone: 0 });
    });
    // the spire mark: a black blade on a thin base with its red light and a wisp of storm
    const sx = W - spire - u(0.04), sy = u(0.06), sh = Hh - u(0.12);
    bd.poly([sx + (spire >> 1), sy, sx + (spire >> 1) + 3, sy + sh - 3, sx + (spire >> 1) - 3, sy + sh - 3], { mat: "soot", profile: "flat", z: 2, piece: "spire" });
    bd.rect(sx + 2, sy + sh - 3, spire - 4, 2, { mat: "soot", profile: "flat", z: 2, piece: "spire" });
    bd.rect(sx + (spire >> 1) - 5, sy + 2, 10, 1, { mat: "mapInk", mode: "paint", tone: -1 });
    bd.rect(sx + (spire >> 1) - 3, sy + 1, 6, 1, { mat: "mapInk", mode: "paint", tone: -1 });
    bd.rect(sx + (spire >> 1), sy + 4, 1, 1, { mat: "mapRed", z: 3, piece: "light" });
    const light = b.glow({ part: "board", at: [sx + (spire >> 1) + 0.5, sy + 4.5], colour: [1, 0.25, 0.2], radius: 3, intensity: 0.6, flicker: 0 });
    return { board: b.get("board"), shake: new Spring(120, 8), light };
  },
  initial: "idle",
  states: {
    idle: {
      update(c, dt) {
        // the spire's light blinks slowly, like the one on the horizon (never a flash)
        c.refs.light.level = Math.sin(c.world.time * 1.6) > 0.2 ? 1 : 0.35;
        shakeStep(c.refs.shake, c.refs.board, dt);
      },
      use(c) {
        c.sound("paper.open", 0.5);
        c.emit({ type: "panel", panel: "downloads" });
      },
      hit(c, h) {
        c.refs.shake.impulse((h.hit.dir[0] < 0 ? -1 : 1) * 0.25);
      },
    },
  },
  demo: {
    indoor: true,
    at: 1.4,
    w: 4,
    script: [
      { label: "the real products, the spire's light", wait: 1.6 },
      { label: "E: the website's downloads", use: true, wait: 1 },
      { label: "slash: shakes on its nails", hit: "slash", from: -0.9, wait: 1 },
    ],
  },
});

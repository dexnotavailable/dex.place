// The Crown's banners (lane R-D; WORLD-PLAN D3: two long banners behind the
// terminal, sway, tear). A long cloth hung from an iron rod under the
// overhang, the colossi's procession sewn on it, fringed, a swallowtail foot.
// It sways by shearing its rows sideways in whole pixels, more the lower they
// hang (the storm's steady lean, its gusts, a hit, a dash), redrawn from its
// design at 15 Hz: cloth without a cloth simulation (the kit's verlet banner
// costs about 0.9 ms a frame awake, and in the storm nothing ever sleeps).
// A slash tears it where it lands: everything below the cut drops away and
// fades, then it knits back from the cut down (breakage "heal": the room
// resets). Origin: the rod's centre.

import "./materials.ts";
import { hitCentre } from "../../hits.ts";
import { puff } from "../../kit.ts";
import { defineRecipe, type Prop } from "../../prop.ts";
import type { Part } from "../../part.ts";
import type { PartBuilder } from "../../builder.ts";
import { STORM, gustNow } from "./storm.ts";

export interface BannerParams {
  colour: "red" | "indigo";
  /** Width and length in H. */
  width: number;
  length: number;
}

interface Refs {
  cloth: Part;
  src: PartBuilder;
  W: number;
  L: number;
  pad: number;
  sway: number;
  vel: number;
  /** Row of the tear (-1: whole), how far the torn piece has fallen (px), how much has knit back (rows). */
  cut: number;
  fall: number;
  knit: number;
}

export const stormBanner = defineRecipe<BannerParams, Refs>({
  id: "stormBanner",
  breakage: "heal",
  reason: "The Crown's two long banners behind the terminal, the colossi's procession sewn on them: they sway in the storm and tear under a blade, and the room mends them.",
  defaults: { colour: "red", width: 0.56, length: 1.8 },
  cues: ["cloth.hit", "cloth.tear"],
  demo: {
    w: 5,
    at: 2.4,
    script: [
      { label: "hanging in the storm", wait: 2 },
      { label: "slash: it tears where it's cut", hit: "slash", from: -0.6, wait: 2.5 },
      { label: "knits back", wait: 6 },
    ],
  },
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const W = u(p.width), L = u(p.length);
    const mat = p.colour === "indigo" ? "clothIndigo" : "clothRed";
    const trim = "clothGold";
    // the rod on two brackets
    const rw = W + u(0.2);
    const rod = b.part("rod", { w: rw, h: 8, pivot: [rw >> 1, 4], at: [0, 0], layer: "bg", z: 16, collide: "none" });
    rod.rect(3, 2, rw - 6, 4, { mat: "iron", profile: "cylH" });
    for (const x of [3, rw - 4]) rod.circle(x, 4, 3, { mat: "brass", profile: "dome", r: 2, z: 2, piece: "finial" });
    // the design, drawn once
    const src = b.canvas(W, L);
    const tailH = u(0.22);
    for (let y = 0; y < L; y++) {
      const tail = y > L - tailH ? ((W - 1) / 2) * ((y - (L - tailH)) / tailH) : -1;
      for (let x = 0; x < W; x++) {
        if (tail >= 0 && Math.abs(x - (W - 1) / 2) < tail) continue;
        let m = mat, tone = 0;
        if (x < 3 || x > W - 4) { m = trim; tone = -1; }
        const band = y > L * 0.35 && y < L * 0.35 + u(0.2);
        if (band && (x + Math.floor(y / 3)) % 5 === 0 && x > 3 && x < W - 4) { m = "clothPale"; tone = 0; }
        if (Math.abs(y - (L * 0.35 + u(0.28))) < 1 && x % 6 === 3) { m = trim; tone = 1; }
        if (Math.abs(y - L * 0.18) < 1.2 && x > 4 && x < W - 5) { m = trim; tone = 0; }
        src.pixels([[x, y]], { mat: m, profile: "flat", tone: tone + ((x + y) % 11 === 0 ? -1 : 0) });
      }
    }
    // the cloth part it is drawn into, with room either side for the sway and below for a tear's fall
    const pad = u(0.3);
    b.part("cloth", { w: W + pad * 2, h: L + u(1.2), pivot: [(W >> 1) + pad, 0], at: [0, 5], layer: "bg", z: 15, collide: "none" });
    const cloth = b.get("cloth");
    cloth.dynamicEvery = 4;
    const refs: Refs = { cloth, src, W, L, pad, sway: 0, vel: 0, cut: -1, fall: 0, knit: 0 };
    cloth.dynamic = (part) => redraw(part, refs, b.rand);
    return refs;
  },
  initial: "hanging",
  states: {
    hanging: {
      update: (c, dt) => sway(c, dt),
      hit: (c, h) => tear(c, h.hit, h.contact),
    },
    torn: {
      sound: "cloth.tear",
      update(c, dt) {
        sway(c, dt);
        const r = c.refs;
        r.fall = Math.min(c.params.H * 1.2, r.fall + c.t * 17.5 * c.params.H * dt);
        if (c.t > 3.5) {
          c.go("knitting");
          return;
        }
      },
      hit(c) {
        c.refs.cloth.flash = Math.max(c.refs.cloth.flash, 0.3);
      },
    },
    knitting: {
      enter(c) {
        c.refs.fall = 0;
        c.refs.knit = 0;
      },
      update(c, dt) {
        sway(c, dt);
        const r = c.refs;
        r.knit += dt * c.params.H * 0.6;
        if (r.cut + r.knit >= r.L) {
          r.cut = -1;
          c.go("hanging");
          return;
        }
      },
      hit: (c, h) => tear(c, h.hit, h.contact),
    },
  },
});

/** Copy the design into the cloth part, each row shifted by the sway; a tear drops and fades the rows below the cut. */
function redraw(part: Part, r: Refs, rand: () => number): void {
  const g = part.grid;
  const s = r.src.grid;
  g.clearAll();
  const room = g.h - r.L;
  for (let y = 0; y < r.L; y++) {
    const f = (y + 1) / r.L;
    let dy = 0;
    let keep = 1;
    if (r.cut >= 0 && y >= r.cut) {
      if (r.knit > 0) keep = y < r.cut + r.knit ? 1 : 0;
      else {
        dy = Math.round(r.fall);
        keep = 1 - r.fall / Math.max(1, room);
      }
    }
    if (keep <= 0) continue;
    const off = Math.round(r.sway * f * f * 2.2 + Math.sin(y * 0.09 + r.vel) * 0.6 * f) + r.pad;
    for (let x = 0; x < r.W; x++) {
      const i = s.inner(x, y);
      if (i < 0 || !s.mat[i]) continue;
      if (keep < 1 && rand() > keep) continue;
      const j = g.inner(x + off, y + dy);
      if (j < 0) continue;
      g.setRaw(j, s.mat[i]!, s.tone[i]!, 1, s.height[i]!, 0, 30);
    }
  }
}

function sway(c: Prop<Refs>, dt: number): void {
  const r = c.refs;
  const H = c.params.H;
  // the wind leans it; the gust pushes it further; it swings back like cloth
  const g = STORM.strength > 0 ? gustNow(c.world.time) : { level: 0, tell: 0 };
  const wind = c.world.wind.x / (H * 3);
  const target = (wind * 0.5 + g.level * 0.9 + g.tell * 0.25) * H * 0.1 + Math.sin(c.world.time * 1.7) * H * 0.012;
  r.vel += (target - r.sway) * 9 * dt;
  r.vel *= Math.pow(0.12, dt);
  r.sway += r.vel * dt * 6;
}

function tear(c: Prop<Refs>, hit: import("../../hits.ts").Hit, contact: [number, number] | null): string | void {
  const r = c.refs;
  const H = c.params.H;
  r.vel += hit.dir[0] * H * (hit.type === "wind" ? 0.25 : 0.4);
  if (hit.type === "wind" || c.keepsCells) return;
  // where the blade actually crossed the cloth (else the hit's centre)
  const [, y] = contact ?? hitCentre(hit.shape);
  const row = Math.round(y - (c.y + 5));
  if (row < 6 || row >= r.L - 2) return;
  r.cut = row;
  r.fall = 0;
  r.knit = 0;
  puff(c.world, "petal", c.x, c.y + 5 + row, 8, [hit.dir[0], 0.3], { speed: 0.6, rgb: [[120, 42, 52], [150, 64, 64]] });
  c.sound("cloth.tear", 0.7);
  return "torn";
}

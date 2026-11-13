// The Archive (C2, WORLD-PLAN section 4): documentation as real panels, the
// coziest and quietest room. Nothing breaks in a reading room: the lectern
// makes its world sway-only when the room opens (world.breakage = "sway"),
// so every prop here only sways, rattles and settles.
//
//   archiveShelf    a bay of shelves and scroll racks for one product, with a
//                   plain sign; E opens that product's docs (a panel event:
//                   { panel: "archive", arg: "g-<group>" }, the /docs/ group
//                   anchor); hits sway it and rattle the books, a scroll may
//                   fall and roll home
//   archiveLectern  a lectern with an open book: the pages flutter when you
//                   pass quickly or dash; E opens the documentation index
//   archivist       the one who reads here, in an armchair; she turns a page
//                   now and then; E gets a hum (a sound and a small lift of the
//                   head), never a word
//   readingLamp     the green-shaded reading lamp on its side table
//   rug             a worn rug, seen edge on, with a fringe
//
// Origins: the floor under the prop's centre.

import "./materials.ts";
import { defineRecipe, type Prop } from "../../prop.ts";
import type { Part } from "../../part.ts";
import { Pendulum, Spring } from "../../motion.ts";
import { textPixels } from "../../materials.ts";
import { puff } from "../../kit.ts";
import type { PartBuilder } from "../../builder.ts";

const SPINES = ["hollowSpineRed", "hollowSpineGreen", "hollowSpineBlue", "hollowSpineOchre", "leather", "leatherDark", "parchment"];

/** A row of book spines standing on a shelf from x0 to x1 (bottom at y). */
function books(c: PartBuilder, x0: number, x1: number, y: number, maxH: number, seed: number, piece = "books"): void {
  const r = c.rand;
  let x = x0;
  let k = seed;
  while (x < x1 - 2) {
    const w = 2 + Math.floor(r() * 3);
    const h = Math.round(maxH * (0.62 + r() * 0.38));
    const m = SPINES[(k++ * 7 + Math.floor(r() * 3)) % SPINES.length]!;
    if (r() < 0.08 && x + h < x1) {
      // one lying flat
      c.rect(x, y - w, h, w, { mat: m, profile: "cylH", piece });
      x += h + 1;
      continue;
    }
    c.rect(x, y - h, Math.min(w, x1 - x), h, { mat: m, profile: "cylV", piece });
    if (h > 8) c.rect(x, y - h + 3, Math.min(w, x1 - x), 1, { mat: m, mode: "paint", tone: 1 });
    x += w + (r() < 0.12 ? 2 : 0);
  }
}

// ---------------------------------------------------------------------------
// archiveShelf
// ---------------------------------------------------------------------------

export interface ShelfParams {
  /** The product's name on the sign (real names only), and its /docs/ group id. */
  label: string;
  group: string;
  /** Bay width and height in H. */
  width: number;
  height: number;
  /** A scroll rack (cubbies of rolled scrolls) instead of the lowest shelf. */
  scrolls: boolean;
}

interface ShelfRefs {
  case: Part;
  sway: Spring;
  rattle: number;
  scroll: Part | null;
  scrollOut: number;
}

export const archiveShelf = defineRecipe<ShelfParams, ShelfRefs>({
  id: "archiveShelf",
  breakage: "never",
  reason: "Documentation lives here as real panels, one bay per product with a plain sign; E on a bay opens that product's docs (CANON: an archive behind an ordinary door, no puzzle, real docs kept apart from lore).",
  defaults: { label: "", group: "", width: 1.5, height: 2.1, scrolls: true },
  use: { reach: 0.7, prompt: "read" },
  cues: ["paper-open", "shelf.rattle"],
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const W = u(p.width), Hh = u(p.height);
    const cs = b.part("case", { w: W, h: Hh, pivot: [W >> 1, Hh], at: [0, 0], layer: "bg", z: 6 });
    // the carcass: dark oak sides, a cornice, a plinth
    cs.rect(0, 0, W, Hh, { mat: "woodDark", profile: "flat", depth: 1, tone: -1, piece: "back" });
    for (const x of [0, W - u(0.07)]) cs.rect(x, 0, u(0.07), Hh, { mat: "woodDark", profile: "bevel", r: 2, depth: 3, piece: "side" });
    cs.rect(0, 0, W, u(0.09), { mat: "woodDark", profile: "bevel", r: 2, depth: 3, piece: "cornice" });
    cs.rect(0, 0, W, 1, { mat: "woodDark", mode: "paint", tone: 1 });
    cs.rect(0, Hh - u(0.1), W, u(0.1), { mat: "woodDark", profile: "bevel", r: 1, depth: 2, piece: "plinth" });
    // shelves with books; the lowest holds scrolls in cubbies
    const n = 4;
    const inner0 = u(0.09), inner1 = Hh - u(0.1);
    const sh = (inner1 - inner0) / n;
    for (let k = 0; k < n; k++) {
      const y = Math.round(inner0 + sh * (k + 1));
      cs.rect(u(0.05), y - 3, W - u(0.1), 3, { mat: "wood", profile: "cylH", z: 2, piece: "shelf" });
      const top = Math.round(inner0 + sh * k) + 3;
      if (p.scrolls && k === n - 1) {
        // cubbies of scrolls: rolled ends seen head-on
        const cw = u(0.18);
        for (let x = u(0.08); x + cw <= W - u(0.08); x += cw) {
          cs.rect(x, top, 2, y - 3 - top, { mat: "woodDark", profile: "cylV", z: 1, piece: "cubby" });
          for (let yy = y - 3 - 5; yy > top + 3; yy -= 6) for (let xx = x + 3; xx + 4 < x + cw; xx += 5) cs.circle(xx + 2, yy, 2.2, { mat: "parchment", profile: "dome", r: 2, piece: "scrolls" });
        }
      } else books(cs, u(0.08), W - u(0.08), y - 3, y - 3 - top - 2, p.seed + k * 5);
    }
    cs.speckle({ amount: 0.05, seed: p.seed, tone: -1, mats: ["woodDark"] });
    // the plain sign on the cornice: the product's name, painted
    if (p.label) {
      const t = textPixels(p.label.slice(0, 14));
      const sw = t.w + u(0.1), shh = 5 + u(0.08);
      const sg = b.part("sign", { w: sw, h: shh, pivot: [sw >> 1, shh], at: [0, -Hh + 2], layer: "bg", z: 8 });
      sg.rect(0, 0, sw, shh, { mat: "parchment", profile: "bevel", r: 1, depth: 2, piece: "board" });
      sg.rect(0, 0, sw, 1, { mat: "parchment", mode: "paint", tone: 1 });
      const ox = Math.round((sw - t.w) / 2), oy = Math.round((shh - 5) / 2);
      for (const [x, y] of t.pts) sg.rect(ox + x, oy + y, 1, 1, { mat: "hollowSpineRed", mode: "paint", tone: -1 });
      for (const x of [2, sw - 3]) sg.rect(x, 1, 1, 1, { mat: "brass", mode: "paint" });
    }
    // a scroll that can fall out when the bay is knocked, then rolls home
    const sc = b.part("scroll", { w: u(0.2), h: 5, pivot: [u(0.1), 5], at: [Math.round(W * 0.2) - (W >> 1), -u(0.1) - 3], layer: "mid", z: 9, visible: false, hittable: false, smoothRotate: true });
    sc.rect(0, 0, u(0.2), 5, { mat: "parchment", profile: "cylH" });
    sc.rect(u(0.2) - 3, 0, 3, 5, { mat: "hollowSpineRed", mode: "paint" });
    return { case: b.get("case"), sway: new Spring(70, 6), rattle: 0, scroll: b.get("scroll"), scrollOut: 0 };
  },
  initial: "idle",
  states: {
    idle: {
      update: (c, dt) => shelfStep(c, dt),
      use(c) {
        c.sound("paper-open", 0.8);
        c.emit({ type: "panel", panel: "archive", arg: c.params["group"] ? `g-${c.params["group"]}` : undefined });
      },
      hit(c, h) {
        if (h.hit.type === "wind") return;
        const r = c.refs;
        r.sway.v += (h.hit.dir[0] < 0 ? -1 : 1) * (h.hit.type === "slash" || h.hit.type === "point" ? 0.06 : 0.12);
        r.rattle = 0.6;
        c.sound("shelf.rattle", 0.6);
        // a heavier knock lets one scroll fall out; it lies a moment and is put back
        if (h.hit.type !== "slash" && h.hit.type !== "point" && r.scroll && !r.scroll.visible) {
          r.scroll.visible = true;
          r.scrollOut = 0.001;
        }
      },
    },
  },
  demo: {
    indoor: true,
    w: 6,
    params: { label: "DEXCLIENT", group: "dexclient" },
    variants: [{ label: "dexCode", params: { label: "DEXCODE", group: "dexcode" }, dx: 1.7 }],
    script: [
      { label: "a bay per product", wait: 0.8 },
      { label: "E: that product's docs (panel)", use: true, wait: 0.8 },
      { label: "slash: it sways and rattles", hit: "slash", from: -0.7, wait: 1.2 },
      { label: "heavy: a scroll falls out, then goes home", hit: "heavy", from: -0.9, wait: 4 },
    ],
  },
});

function shelfStep(c: Prop<ShelfRefs>, dt: number): void {
  const r = c.refs;
  if (!r.sway.resting) {
    r.sway.step(dt);
    r.case.offX = Math.round(r.sway.x * c.params.H * 0.4);
  }
  if (r.rattle > 0) {
    r.rattle -= dt;
    // books settle with a held one-pixel shiver (a few frames, not a strobe)
    r.case.offY = r.rattle > 0.1 && Math.floor(r.rattle * 12) % 2 ? -1 : 0;
  }
  if (r.scroll && r.scrollOut > 0) {
    r.scrollOut += dt;
    const t = r.scrollOut;
    const H = c.params.H;
    // falls from its cubby to the floor, rolls a little, lies there, then is gone (put back)
    const fall = Math.min(1, t / 0.35);
    r.scroll.y = Math.round(-H * 0.13 + fall * fall * H * 0.1);
    r.scroll.x = Math.round(H * 0.2 - (H * Number(c.params["width"])) / 2 + Math.min(1, Math.max(0, (t - 0.35) / 0.6)) * H * 0.35);
    r.scroll.rot = Math.min(1, Math.max(0, (t - 0.35) / 0.6)) * Math.PI;
    if (t > 3.2) {
      r.scroll.visible = false;
      r.scrollOut = 0;
      r.scroll.rot = 0;
    }
  }
}

// ---------------------------------------------------------------------------
// archiveLectern
// ---------------------------------------------------------------------------

interface LecternRefs {
  pages: Part;
  flutter: number;
  spare: number;
}

export const archiveLectern = defineRecipe<{ panel: string }, LecternRefs>({
  id: "archiveLectern",
  breakage: "never",
  reason: "The archive's index: an open book on a lectern; E opens the documentation index as a real page (focus, back, close). Its pages lift when someone hurries past.",
  defaults: { panel: "archive" },
  use: { reach: 0.7, prompt: "read" },
  cues: ["paper-open", "page.flutter"],
  standard: { h: 0.55, parts: ["stand"], note: "lectern top (counter or lectern top, WORLD-PLAN section 1)" },
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const top = u(0.55);
    const W = u(0.62);
    const st = b.part("stand", { w: W, h: top + 2, pivot: [W >> 1, top + 2], at: [0, 0], layer: "mid", z: 6 });
    const cx = W >> 1;
    st.rect(cx - u(0.18), top + 2 - u(0.06), u(0.36), u(0.06), { mat: "woodDark", profile: "bevel", r: 2, depth: 3, piece: "foot" });
    st.rect(cx - u(0.04), u(0.08), u(0.08), top - u(0.06), { mat: "woodDark", profile: "cylV", piece: "column" });
    for (let y = u(0.2); y < top - u(0.1); y += u(0.12)) st.rect(cx - u(0.05), y, u(0.1), 2, { mat: "woodDark", profile: "cylH", z: 2, piece: "turning" });
    // the slanted desk
    st.poly([0, u(0.12), W, 0, W, u(0.05), 2, u(0.16)], { mat: "wood", profile: "bevel", r: 2, depth: 3, piece: "desk" });
    st.grain({ dir: "h", seed: p.seed, mats: ["wood"], stretch: 12 });
    // the open book: two page blocks, a ribbon
    const pg = b.part("pages", { w: W, h: u(0.12), pivot: [W >> 1, u(0.12)], at: [0, -top + u(0.02)], layer: "mid", z: 8 });
    pg.poly([u(0.04), u(0.1), cx, u(0.06), cx, u(0.1), u(0.06), u(0.12)], { mat: "parchment", profile: "dome", r: 2, piece: "left" });
    pg.poly([cx, u(0.06), W - u(0.04), u(0.02), W - u(0.02), u(0.05), cx, u(0.1)], { mat: "parchment", profile: "dome", r: 2, piece: "right" });
    for (let k = 1; k < 4; k++) pg.line(u(0.06) + k * 3, u(0.1) - k, cx - 3, u(0.07) + (k % 2), { mat: "parchment", mode: "paint", tone: -1 });
    pg.rect(cx - 1, u(0.08), 2, u(0.07), { mat: "clothRed", profile: "flat", piece: "ribbon" });
    // a candle on the desk's corner
    b.light({ part: "stand", at: [W - u(0.06), u(0.02)], colour: [1, 0.74, 0.46], radius: u(1.2), intensity: 0.4, flicker: 0.3 });
    return { pages: b.get("pages"), flutter: 0, spare: 0 };
  },
  initial: "open",
  states: {
    open: {
      enter(c) {
        // nothing breaks in a reading room
        c.world.breakage = "sway";
      },
      update(c, dt) {
        const r = c.refs;
        // someone hurrying past (or a dash's wind) lifts the pages
        for (const a of c.world.actorsNear(c.x, c.y - c.params.H * 0.5, c.params.H * 1.2)) if (Math.abs(a.vx) > c.params.H * 1.6) r.flutter = Math.max(r.flutter, 0.6);
        if (r.flutter > 0) {
          r.flutter -= dt;
          r.pages.offY = Math.floor(r.flutter * 16) % 2 ? -1 : 0;
          if (c.rand() < dt * 8) {
            const [x, y] = r.pages.toWorld(r.pages.grid.w * 0.75, 1);
            puff(c.world, "paper", x, y, 1, [0.4, -1], { speed: 0.25, spread: 0.6 });
          }
        } else r.pages.offY = 0;
      },
      use(c) {
        c.sound("paper-open", 0.8);
        c.emit({ type: "panel", panel: String(c.params["panel"] ?? "archive") });
      },
      hit(c, h) {
        if (h.hit.type === "wind") {
          c.refs.flutter = 0.9;
          c.sound("page.flutter", 0.5);
        } else c.refs.pages.shake = 0.12;
      },
    },
  },
  demo: {
    indoor: true,
    w: 4,
    script: [
      { label: "the index, open", wait: 0.8 },
      { label: "dash past: the pages lift", hit: "wind", from: -1, wait: 1.2 },
      { label: "E: the documentation index", use: true, wait: 0.8 },
    ],
  },
});

// ---------------------------------------------------------------------------
// archivist
// ---------------------------------------------------------------------------

interface ArchivistRefs {
  body: Part;
  head: Part;
  book: Part;
  page: Part;
  turn: number;
  next: number;
  lift: number;
}

export const archivist = defineRecipe<Record<string, never>, ArchivistRefs>({
  id: "archivist",
  breakage: "never",
  reason: "One of the world's three residents: the archivist reads here and doesn't speak; E gets a hum, not a word (WORLD-PLAN section 2).",
  defaults: {},
  use: { reach: 0.8, prompt: "" },
  cues: ["archivist.hum", "page.turn"],
  build(b) {
    const u = (f: number): number => b.u(f);
    // the armchair: high back, rolled arms, short legs
    const cw = u(0.78), chh = u(0.86);
    const ch = b.part("chair", { w: cw, h: chh, pivot: [cw >> 1, chh], at: [0, 0], layer: "bg", z: 4 });
    ch.roundRect(0, 0, u(0.2), chh - u(0.1), 4, { mat: "leatherDark", profile: "dome", r: 4, piece: "back" });
    ch.roundRect(u(0.02), chh - u(0.44), cw - u(0.04), u(0.2), 4, { mat: "leather", profile: "dome", r: 4, piece: "seat" });
    ch.roundRect(cw - u(0.2), chh - u(0.5), u(0.18), u(0.14), 4, { mat: "leather", profile: "dome", r: 3, z: 2, piece: "arm" });
    for (const x of [u(0.04), cw - u(0.1)]) ch.rect(x, chh - u(0.24), u(0.06), u(0.24), { mat: "woodDark", profile: "cylV", piece: "leg" });
    for (let y = u(0.1); y < chh - u(0.5); y += u(0.1)) ch.rect(u(0.06), y, 2, 2, { mat: "brass", mode: "paint" });
    // the reader, seated facing right: coat, legs crossed, a shawl
    const bw = u(0.52), bh = u(0.76);
    const body = b.part("body", { w: bw, h: bh, pivot: [0, bh], at: [-(cw >> 1) + u(0.14), -u(0.3)], layer: "bg", z: 6 });
    body.poly([u(0.02), bh, u(0.3), bh, u(0.34), bh - u(0.08), u(0.12), bh - u(0.12), u(0.1), u(0.1), u(0.02), u(0.12)], { mat: "hollowCoat", profile: "dome", r: 4, piece: "coat" });
    body.rect(u(0.24), bh - u(0.1), u(0.26), u(0.08), { mat: "hollowCoat", profile: "cylH", piece: "thigh" });
    body.rect(u(0.44), bh - u(0.06), u(0.06), u(0.3), { mat: "leatherDark", profile: "cylV", piece: "shin" });
    body.poly([u(0.02), u(0.12), u(0.18), u(0.08), u(0.2), u(0.3), u(0.04), u(0.34)], { mat: "clothTeal", profile: "dome", r: 3, z: 2, piece: "shawl" });
    // hands and the open book on her knee
    const book = b.part("book", { w: u(0.26), h: u(0.14), pivot: [0, u(0.14)], at: [u(0.24), bh - u(0.12)], parent: "body", layer: "bg", z: 8 });
    book.poly([0, u(0.14), u(0.13), u(0.06), u(0.13), u(0.1), u(0.02), u(0.14)], { mat: "parchment", profile: "dome", r: 2, piece: "left" });
    book.poly([u(0.13), u(0.06), u(0.26), 0, u(0.26), u(0.04), u(0.13), u(0.1)], { mat: "parchment", profile: "dome", r: 2, piece: "right" });
    book.rect(u(0.12), u(0.06), 2, u(0.07), { mat: "hollowSpineGreen", profile: "cylV", piece: "spine" });
    book.circle(u(0.02), u(0.12), 2.2, { mat: "hollowSkin", profile: "dome", r: 2, z: 2, piece: "hand" });
    book.circle(u(0.24), u(0.03), 2.2, { mat: "hollowSkin", profile: "dome", r: 2, z: 2, piece: "hand" });
    // the page that turns
    const page = b.part("page", { w: u(0.14), h: u(0.1), pivot: [0, u(0.1)], at: [u(0.13), u(0.1)], parent: "book", layer: "bg", z: 9, smoothRotate: true, visible: false });
    page.poly([0, u(0.1), 0, u(0.04), u(0.13), 0, u(0.13), u(0.06)], { mat: "parchment", profile: "flat", piece: "leaf" });
    // head bowed over the book: grey hair in a bun, the face in shadow, spectacles glinting
    const hs = u(0.22);
    const head = b.part("head", { w: hs + 4, h: hs + 4, pivot: [u(0.06), hs + 2], at: [u(0.12), u(0.1)], parent: "body", layer: "bg", z: 7, smoothRotate: true });
    head.ellipse(u(0.12), hs * 0.55, hs * 0.42, hs * 0.46, { mat: "hollowSkin", profile: "dome", r: 3, piece: "face" });
    head.poly([u(0.02), hs * 0.75, u(0.04), hs * 0.1, u(0.16), 0, u(0.2), hs * 0.3, u(0.1), hs * 0.4, u(0.08), hs * 0.8], { mat: "hollowHair", profile: "dome", r: 3, z: 2, piece: "hair" });
    head.circle(u(0.03), hs * 0.2, u(0.05), { mat: "hollowHair", profile: "dome", r: 3, z: 3, piece: "bun" });
    head.rect(u(0.17), hs * 0.5, u(0.07), 2, { mat: "brass", profile: "cylH", z: 3, piece: "spectacles" });
    return { body: b.get("body"), head: b.get("head"), book: b.get("book"), page: b.get("page"), turn: 0, next: 9 + b.rand() * 6, lift: 0 };
  },
  initial: "reading",
  states: {
    reading: {
      update(c, dt) {
        const r = c.refs;
        // breathing: a one-pixel rise every few seconds; the head nods over the lines
        const t = c.age;
        r.body.offY = Math.floor(t / 3.2) % 2 ? 0 : -1;
        r.head.rot = r.lift > 0 ? -0.25 : 0.18 + (Math.floor(t * 2) % 6 === 0 ? 0.05 : 0);
        r.lift = Math.max(0, r.lift - dt);
        // now and then a page turns: it lifts from the right and lays over to the left
        r.next -= dt;
        if (r.next <= 0 && r.turn <= 0) {
          r.turn = 0.001;
          r.page.visible = true;
          c.sound("page.turn", 0.35);
        }
        if (r.turn > 0) {
          r.turn += dt;
          const k = Math.min(1, r.turn / 0.9);
          // held steps (6 of them), like a hand-drawn page turn
          r.page.rot = -Math.floor(k * 6) / 6 * Math.PI;
          if (k >= 1) {
            r.turn = 0;
            r.page.visible = false;
            r.page.rot = 0;
            r.next = 11 + c.rand() * 9;
          }
        }
      },
      use(c) {
        // a hum, and she looks up for a moment; no words
        c.sound("archivist.hum", 0.8);
        c.refs.lift = 1.4;
      },
      hit(c, h) {
        if (h.hit.type !== "wind") c.refs.lift = 0.8;
      },
    },
  },
  demo: {
    indoor: true,
    w: 4,
    script: [
      { label: "reading", wait: 3 },
      { label: "E: a hum, she looks up", use: true, wait: 1.6 },
      { label: "a page turns", act: "turn", wait: 1.5 },
    ],
  },
  actions: {
    turn: (c) => {
      c.refs.next = 0;
    },
  },
});

// ---------------------------------------------------------------------------
// readingLamp
// ---------------------------------------------------------------------------

export const archiveLamp = defineRecipe<{ table: boolean }, { shade: Part; swing: Pendulum }>({
  id: "archiveLamp",
  breakage: "never",
  reason: "The one green-shaded reading lamp the archive is lit by, with its candles: a pool of warm light to read in, and the green that marks this room.",
  defaults: { table: true },
  cues: ["glass.hit"],
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const th = p.table ? u(0.5) : 0;
    const W = u(0.4);
    if (p.table) {
      const t = b.part("table", { w: W, h: th, pivot: [W >> 1, th], at: [0, 0], layer: "bg", z: 5 });
      t.rect(0, 0, W, u(0.05), { mat: "woodDark", profile: "bevel", r: 2, depth: 3, piece: "top" });
      t.rect(W >> 1, u(0.05), u(0.05), th - u(0.1), { mat: "woodDark", profile: "cylV", piece: "leg" });
      t.rect((W >> 1) - u(0.1), th - u(0.05), u(0.25), u(0.05), { mat: "woodDark", profile: "bevel", r: 1, depth: 2, piece: "foot" });
      // a cup and two books on it
      t.rect(u(0.03), -2, u(0.16), 2, { mat: "hollowSpineBlue", profile: "cylH", piece: "books" });
    }
    const lh = u(0.42);
    const lamp = b.part("lamp", { w: u(0.3), h: lh, pivot: [u(0.15), lh], at: [u(0.06), -th], layer: "bg", z: 7, smoothRotate: true });
    lamp.rect(u(0.15) - u(0.07), lh - u(0.03), u(0.14), u(0.03), { mat: "brass", profile: "bevel", r: 1, depth: 2, piece: "base" });
    lamp.rect(u(0.15) - 1, u(0.12), 2, lh - u(0.14), { mat: "brass", profile: "cylV", piece: "stem" });
    // the green glass shade, lit from inside
    lamp.poly([u(0.02), u(0.16), u(0.28), u(0.16), u(0.24), u(0.07), u(0.06), u(0.07)], { mat: "hollowLampGreen", profile: "dome", r: 3, piece: "shade" });
    lamp.rect(u(0.06), u(0.16), u(0.18), 2, { mat: "brass", profile: "cylH", z: 2, piece: "rim" });
    const sh = b.get("lamp");
    sh.glow = 0.9;
    b.light({ part: "lamp", at: [u(0.15), u(0.2)], colour: [1, 0.86, 0.56], radius: u(2.4), intensity: 0.75, flicker: 0.02 });
    b.glow({ kind: "beam", part: "lamp", at: [u(0.15), u(0.17)], to: [u(0.15), lh + th], colour: [0.9, 0.8, 0.5], radius: u(0.14), width1: u(0.6), intensity: 0.14 });
    return { shade: sh, swing: new Pendulum(u(0.3), u(17.5), 3) };
  },
  initial: "on",
  states: {
    on: {
      update(c, dt) {
        const r = c.refs;
        if (r.swing.resting) return;
        r.swing.step(dt, 0);
        r.shade.rot = Math.max(-0.3, Math.min(0.3, r.swing.angle));
      },
      hit(c, h) {
        if (h.hit.type === "wind") return;
        c.refs.swing.impulse((h.hit.dir[0] < 0 ? -1 : 1) * 1.4);
      },
    },
  },
  demo: {
    indoor: true,
    w: 3,
    script: [
      { label: "lit", wait: 1 },
      { label: "slash: it rocks", hit: "slash", from: -0.4, wait: 2 },
    ],
  },
});

// ---------------------------------------------------------------------------
// rug
// ---------------------------------------------------------------------------

export const hollowRug = defineRecipe<{ width: number; colour: string }, null>({
  id: "hollowRug",
  breakage: "never",
  reason: "A worn rug under the reading chair and the lectern: footsteps go soft here (the archive is the quietest room in the world).",
  defaults: { width: 5, colour: "clothRed" },
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const W = u(p.width);
    const r = b.part("rug", { w: W + 6, h: 4, pivot: [(W + 6) >> 1, 3], at: [0, 0], layer: "decal", z: 1, hittable: false });
    r.rect(3, 0, W, 3, { mat: p.colour, profile: "flat", depth: 1 });
    for (let x = 3; x < W + 3; x += 6) r.rect(x, 1, 3, 1, { mat: "clothGold", mode: "paint" });
    for (let x = 0; x < W + 6; x += 2) if (x < 3 || x > W + 2) r.rect(x, 2, 1, 1, { mat: "clothPale", profile: "flat" });
    r.wear({ amount: 0.15, seed: p.seed });
    return null;
  },
  initial: "lying",
  states: { lying: {} },
  demo: { w: 6, script: [{ label: "the rug", wait: 0.5 }] },
});

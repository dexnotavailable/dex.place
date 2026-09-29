// The catalogue lectern (lane R-E): a limestone lectern by the chapel door
// with an open book on its slanted desk. E opens the catalogue of all nine
// works (the gallery panel's "all" view: every real thumbnail, each opening
// on its own). Its pages flutter now and then, and a page lifts when you
// hurry past or swing near it. It never breaks (a service object), and in
// the nave nothing fractures anyway. Origin: the floor under its foot.

import "./materials.ts";
import { matId } from "../../kit.ts";
import { defineRecipe } from "../../prop.ts";
import type { Part } from "../../part.ts";

export interface LecternParams {
  /** Panel to open and its argument (the chapel's opens the whole catalogue). */
  panel: string;
  arg: string;
}

interface Refs {
  page: Part;
  /** 0..1 turn of the loose page (0 flat on the right, 1 flat on the left). */
  turn: number;
  /** Direction and how far this flutter lifts. */
  dir: number;
  peak: number;
  next: number;
  pw: number;
  ph: number;
}

export const catalogueLectern = defineRecipe<LecternParams, Refs>({
  id: "catalogueLectern",
  breakage: "never",
  reason: "The catalogue: a separate action that shows all of Dex's works at once (CANON), by the chapel door so it is the first thing you can use inside.",
  defaults: { panel: "gallery", arg: "all" },
  use: { reach: 0.6, prompt: "read" },
  feel: 1.2,
  cues: ["paper.turn"],
  standard: { h: 0.62, note: "desk top near the plan's 0.55 H counter / lectern height" },
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const W = u(0.62), Hh = u(0.62);
    const cx = W >> 1;
    const st = b.part("stand", { w: W, h: Hh, pivot: [cx, Hh], at: [0, 0], layer: "mid", z: 4, hittable: false });
    // foot, shaft with a band, the capital under the desk
    st.rect(cx - u(0.2), Hh - u(0.08), u(0.4), u(0.08), { mat: "limestone", profile: "bevel", r: 2, depth: 3, piece: "foot" });
    st.rect(cx - u(0.12), Hh - u(0.12), u(0.24), u(0.05), { mat: "limestone", profile: "bevel", r: 1, depth: 2, z: 1, piece: "plinth" });
    st.rect(cx - u(0.06), u(0.14), u(0.12), Hh - u(0.25), { mat: "limestone", profile: "cylV", piece: "shaft" });
    st.rect(cx - u(0.075), Math.round(Hh * 0.5), u(0.15), 3, { mat: "limestone", profile: "cylH", z: 2, piece: "band" });
    st.poly([cx - u(0.13), u(0.15), cx + u(0.13), u(0.15), cx + u(0.06), u(0.24), cx - u(0.06), u(0.24)], { mat: "limestone", profile: "bevel", r: 2, depth: 3, z: 1, piece: "capital" });
    // the slanted desk (higher at the back, toward the wall)
    st.poly([cx - u(0.3), u(0.1), cx + u(0.3), u(0.03), cx + u(0.3), u(0.1), cx - u(0.3), u(0.16)], { mat: "oak", profile: "bevel", r: 2, depth: 3, z: 3, piece: "desk" });
    st.speckle({ amount: 0.1, seed: p.seed, tone: -1, mats: ["limestone"] });
    st.grain({ dir: "h", seed: p.seed + 2, mats: ["oak"], stretch: 8 });
    // the open book: two page blocks with a spine, a red ribbon marker
    const BW = u(0.56), BH = u(0.14);
    const bk = b.part("book", { w: BW, h: BH, pivot: [BW >> 1, BH], at: [0, -u(0.5)], layer: "mid", z: 6, hittable: false });
    const bc = BW >> 1;
    bk.poly([1, BH - 4, bc, BH - 1, BW - 1, BH - 8, BW - 1, BH - 5, bc, BH, 1, BH - 1], { mat: "leatherDark", profile: "flat", piece: "cover" });
    bk.poly([2, BH - 7, bc - 1, BH - 3, bc - 1, BH - 2, 2, BH - 4], { mat: "parchment", profile: "dome", r: 2, depth: 2, z: 1, piece: "left" });
    bk.poly([bc + 1, BH - 3, BW - 3, BH - 11, BW - 3, BH - 8, bc + 1, BH - 2], { mat: "parchment", profile: "dome", r: 2, depth: 2, z: 1, piece: "right" });
    // lines of writing, too small to read (it is the catalogue; the panel has the real thing)
    for (let k = 0; k < 3; k++) {
      bk.line(5, BH - 6 + k, bc - 4, BH - 3 + k - 1, { mat: "parchment", mode: "paint", tone: -2 });
      bk.line(bc + 4, BH - 4 + k - 1, BW - 6, BH - 9 + k, { mat: "parchment", mode: "paint", tone: -2 });
    }
    bk.rect(bc, BH - 3, 1, 4, { mat: "clothRed", profile: "flat", z: 3, piece: "ribbon" });
    // the loose page that flutters (redrawn only while it moves)
    const pw = Math.round(BW * 0.44), ph = u(0.2);
    b.part("page", { w: pw * 2 + 2, h: ph, pivot: [pw + 1, ph - 2], at: [0, -u(0.5) - 2], layer: "mid", z: 7, hittable: false, outline: 1 });
    const page = b.get("page");
    const refs: Refs = { page, turn: 0, dir: 0, peak: 0.5, next: 3 + b.rand() * 5, pw, ph };
    page.dynamic = (part) => drawPage(part, refs);
    page.dynamicEvery = 2;
    return refs;
  },
  initial: "still",
  states: {
    still: {
      update(c, dt) {
        const r = c.refs;
        r.next -= dt;
        // now and then, or when someone hurries past, a page lifts and turns
        const hurry = c.world.actorsNear(c.x, c.y, c.params.H * 1.2).some((a) => Math.abs(a.vx) > c.params.H * 2.4);
        if (r.next <= 0 || hurry) {
          r.next = 5 + c.rand() * 7;
          return c.go("turning");
        }
      },
      use(c) {
        c.emit({ type: "panel", panel: String(c.params["panel"] ?? "gallery"), arg: String(c.params["arg"] ?? "all") });
      },
      hit: (_c, h) => (h.hit.type === "wind" || h.hit.type === "slash" ? "turning" : undefined),
    },
    turning: {
      sound: "paper.turn",
      enter(c) {
        c.refs.dir = 1;
        c.refs.peak = 0.4 + c.rand() * 0.25;
      },
      update(c, dt) {
        // the page lifts, hangs a moment and flops back (the book stays open at the same place)
        const r = c.refs;
        r.turn = Math.max(0, Math.min(r.peak, r.turn + r.dir * dt * (c.world.reduced ? 0.6 : 1.1)));
        if (r.dir > 0 && r.turn >= r.peak && c.t > 0.5) r.dir = -1;
        if (r.dir < 0 && r.turn <= 0) {
          r.turn = 0;
          c.go("still");
        }
      },
      use(c) {
        c.emit({ type: "panel", panel: String(c.params["panel"] ?? "gallery"), arg: String(c.params["arg"] ?? "all") });
      },
    },
  },
  demo: {
    indoor: true,
    w: 4,
    script: [
      { label: "the open catalogue", wait: 0.8 },
      { label: "dash past: a page lifts and turns", hit: "wind", from: -1.2, wait: 2.2 },
      { label: "slash: a page flutters, nothing breaks", hit: "slash", from: -0.6, wait: 2 },
      { label: "E: the catalogue", use: true, wait: 0.5 },
    ],
  },
});

/** The loose page as a thin sheet rotating about the spine: its projected width is cos of the turn. */
function drawPage(part: Part, r: Refs): void {
  const g = part.grid;
  const key = Math.round(r.turn * 24);
  if (part.tag["key"] === key) return;
  part.tag["key"] = key;
  g.clearAll();
  const a = r.turn * Math.PI;
  const len = r.pw;
  const ex = Math.cos(a) * len;
  const lift = Math.sin(a) * r.ph * 0.8;
  const sx = r.pw + 1, sy = r.ph - 2;
  const id = matId("parchment");
  // a curved sheet: the page bows as it lifts
  const n = Math.max(4, Math.ceil(Math.abs(ex) + lift));
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    const x = Math.round(sx + ex * t);
    const y = Math.round(sy - lift * Math.sin(t * Math.PI * 0.5) - Math.sin(t * Math.PI) * 2 * Math.sin(a));
    for (let d = 0; d < 2; d++) {
      const i = g.inner(x, y + d);
      if (i >= 0) g.setRaw(i, id, d === 0 ? 1 : 0, 1, 1, 0, 20);
    }
  }
  g.computeNormals();
}

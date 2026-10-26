// Artwork frame (lane R-E, the Chapel of Light): a gilt frame for one of
// Dex's nine works, on an easel down the nave (01 to 05, 16:9) or hung in a
// niche at the east end (06 to 09, portrait). The frame holds a dark board;
// the work itself is never drawn here. WORLD-PLAN section 14, default 3:
// a DOM overlay of the real thumbnail is pinned exactly onto that board by
// the room (src/world/rooms/chapel/gallery.ts, using artRect() below), so
// the art is never pixelated, lit, tinted or used as a texture, and E opens
// the full work on its own in the gallery panel.
//
// Frames ignore hits: every part is unhittable, so a slash passes through
// with no reaction at all (the nave rule; the breakage policy's "never").
// Origin: the floor under the frame's centre.

import "./materials.ts";
import { defineRecipe } from "../../prop.ts";
import type { Part } from "../../part.ts";

export interface ArtFrameParams {
  /** Gallery id ("01" ... "09"), from content/gallery/manifest.json. */
  art: string;
  /** easel: stands on the nave floor; niche: hangs on the wall. */
  kind: "easel" | "niche";
  /** The work's area in H (WORLD-PLAN section 1: 2.4 x 1.35, 1.6 x 2.4, 1.35 x 2.4). */
  w: number;
  h: number;
  /** Height of the frame's bottom edge above the floor, in H. */
  sill: number;
}

interface Refs {
  frame: Part;
  art: { x0: number; y0: number; x1: number; y1: number };
}

/** Moulding width in H. */
const MOULD = 0.15;

/**
 * The work's area relative to the prop origin, in world px (y up is
 * negative): where the thumbnail overlay goes. Same rounding as the build.
 */
export function artRect(p: { w: number; h: number; sill?: number; kind?: string }, H: number): { x0: number; y0: number; x1: number; y1: number } {
  const u = (f: number): number => Math.round(f * H);
  const aw = u(p.w), ah = u(p.h), m = u(MOULD);
  const sill = u(p.sill ?? (p.kind === "niche" ? 1.0 : 1.02));
  const x0 = -Math.floor(aw / 2);
  const y1 = -(sill + m);
  return { x0, y0: y1 - ah, x1: x0 + aw, y1 };
}

export const artFrame = defineRecipe<ArtFrameParams, Refs>({
  id: "artFrame",
  breakage: "never",
  reason: "Dex's nine works, each shown on its own in the Chapel of Light (CANON: illustrations, display only). The frame holds the real thumbnail as a DOM overlay; E opens the full work.",
  defaults: { art: "01", kind: "easel", w: 2.4, h: 1.35, sill: 1.02 },
  use: { reach: 0.7, prompt: "look" },
  standard: { w: 2.4 + MOULD * 2, h: 1.02 + 1.35 + MOULD * 2, parts: ["frame"], note: "the work's area is 2.4 x 1.35 H (plan); the gilt moulding sits around it" },
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const r = artRect(p, b.H);
    const m = u(MOULD);
    const aw = r.x1 - r.x0, ah = r.y1 - r.y0;
    const W = aw + m * 2, Hf = ah + m * 2;
    const easel = p.kind === "easel";
    // --- the easel (behind the frame): two splayed front legs, a back leg, the tray ---
    if (easel) {
      const top = -r.y0 + m + u(0.16);
      const EW = u(1.3), EH = top + 2;
      const back = b.part("backLeg", { w: EW, h: EH, pivot: [EW >> 1, EH], at: [0, 0], layer: "mid", z: 2, hittable: false });
      back.stroke([EW / 2 + 1, 2, EW / 2 + u(0.08), EH - 1], 4, { mat: "oak", profile: "cylV", tone: -1 });
      back.grain({ dir: "v", seed: p.seed, mats: ["oak"] });
      const legs = b.part("easel", { w: EW, h: EH, pivot: [EW >> 1, EH], at: [0, 0], layer: "mid", z: 4, hittable: false });
      const cx = EW / 2;
      legs.stroke([cx - u(0.13), 2, cx - u(0.52), EH - 1], 5, { mat: "oak", profile: "cylV", piece: "legL" });
      legs.stroke([cx + u(0.13), 2, cx + u(0.52), EH - 1], 5, { mat: "oak", profile: "cylV", piece: "legR" });
      legs.rect(cx - u(0.2), 0, u(0.4), 4, { mat: "oak", profile: "bevel", r: 1, depth: 2, piece: "cap" });
      // cross bar below the tray
      const cross = EH - u(0.48);
      legs.rect(cx - u(0.42), cross, u(0.84), 3, { mat: "oak", profile: "cylH", z: 1, piece: "cross" });
      // the tray the frame rests on, with a lip
      const tray = EH - u(p.sill) - 1;
      legs.rect(cx - Math.round(W * 0.42), tray, Math.round(W * 0.84), 5, { mat: "oak", profile: "bevel", r: 2, depth: 3, z: 3, piece: "tray" });
      legs.rect(cx - Math.round(W * 0.42), tray - 2, Math.round(W * 0.84), 2, { mat: "oak", profile: "flat", z: 4, piece: "lip", tone: 1 });
      legs.grain({ dir: "v", seed: p.seed + 3, mats: ["oak"], density: 0.2 });
      legs.speckle({ amount: 0.06, seed: p.seed + 5, tone: -1, mats: ["oak"] });
      // brass pegs holding the tray
      legs.rivets([[cx - Math.round(W * 0.36), tray + 2], [cx + Math.round(W * 0.36), tray + 2]], { mat: "brass", r: 1.3 });
    } else {
      // a nail and a picture wire above a hung frame
      const wh = u(0.34);
      const wire = b.part("wire", { w: W, h: wh, pivot: [W >> 1, wh], at: [0, r.y0 - m], layer: "bg", z: 3, hittable: false, outline: 0 });
      wire.line(Math.round(W * 0.2), wh - 1, W >> 1, 2, { mat: "iron", noInk: true });
      wire.line(W - Math.round(W * 0.2), wh - 1, W >> 1, 2, { mat: "iron", noInk: true });
      wire.circle(W >> 1, 2, 2, { mat: "brass", profile: "dome", r: 2 });
    }
    // --- the frame: gilt moulding, a darker inner lip, corner rosettes, the dark board ---
    const fr = b.part("frame", { w: W, h: Hf, pivot: [W >> 1, Hf], at: [r.x0 - m + (W >> 1), r.y1 + m], layer: easel ? "mid" : "bg", z: 8, hittable: false });
    // from the outside in: a bright outer bead, a dark cove, the gilt face with a bead
    // rhythm, a bright inner bead, a dark slip against the board
    fr.rect(0, 0, W, Hf, { mat: "gilt", profile: "bevel", r: 3, depth: 4, piece: "mould" });
    fr.rect(0, 0, W, 1, { mat: "gilt", mode: "paint", tone: 1 });
    fr.rect(2, 2, W - 4, Hf - 4, { mat: "giltDark", profile: "sunk", r: 2, depth: 2, z: 2, piece: "cove" });
    fr.rect(4, 4, W - 8, Hf - 8, { mat: "gilt", profile: "bevel", r: 2, depth: 2, z: 3, piece: "face" });
    for (let x = 7; x < W - 6; x += 5) fr.pixels([[x, 5], [x, Hf - 6]], { mat: "gilt", mode: "paint", tone: 1 });
    for (let y = 7; y < Hf - 6; y += 5) fr.pixels([[5, y], [W - 6, y]], { mat: "gilt", mode: "paint", tone: 1 });
    fr.rect(m - 3, m - 3, aw + 6, ah + 6, { mat: "gilt", profile: "dome", r: 1, depth: 1, z: 4, tone: 1, piece: "bead" });
    fr.rect(m - 1, m - 1, aw + 2, ah + 2, { mat: "giltDark", profile: "flat", z: 3, tone: -1, piece: "slip" });
    // corner blocks with a rosette
    for (const [x, y] of [[0, 0], [W - m + 2, 0], [0, Hf - m + 2], [W - m + 2, Hf - m + 2]] as [number, number][]) {
      fr.rect(x, y, m - 2, m - 2, { mat: "gilt", profile: "bevel", r: 2, depth: 3, z: 5, piece: "corner" });
      fr.circle(x + (m - 2) / 2, y + (m - 2) / 2, Math.max(1.6, (m - 2) * 0.28), { mat: "gilt", profile: "dome", r: 2, z: 7, tone: 1, piece: "rosette" });
    }
    // the board the thumbnail covers: exactly the work's area
    fr.rect(m, m, aw, ah, { mat: "artBoard", profile: "flat", z: 1, piece: "board", noInk: true });
    fr.speckle({ amount: 0.1, seed: p.seed + 9, tone: -1, mats: ["gilt", "giltDark"] });
    fr.wear({ amount: 0.08, seed: p.seed + 11, region: { x0: 0, y0: 0, x1: W - 1, y1: 2 } });
    return { frame: b.get("frame"), art: r };
  },
  initial: "idle",
  states: {
    idle: {
      use(c) {
        c.emit({ type: "panel", panel: "gallery", arg: String(c.params["art"] ?? "01") });
      },
      // frames ignore hits (no handler reaction; every part is unhittable anyway)
      hit: () => undefined,
    },
  },
  demo: {
    indoor: true,
    w: 7,
    params: { art: "01", kind: "easel", w: 2.4, h: 1.35 },
    variants: [
      { label: "niche, 2:3 (06)", params: { art: "06", kind: "niche", w: 1.6, h: 2.4, sill: 1.0 }, dx: -2.6 },
      { label: "niche, 9:16 (07)", params: { art: "07", kind: "niche", w: 1.35, h: 2.4, sill: 1.0 }, dx: 2.6 },
    ],
    script: [
      { label: "an easel in the nave; two niche frames", wait: 0.8 },
      { label: "slash: passes through, no reaction", hit: "slash", from: -0.6, wait: 1 },
      { label: "Q: nothing moves", hit: "q", from: 0, wait: 1.2 },
      { label: "E: the gallery panel (one work)", use: true, wait: 0.6 },
    ],
  },
});

// The rose window and its shutter crank (lane R-E, the Chapel of Light).
//
// roseWindow: a round window 2.5 H across, high on the nave's west wall above
// the doors: a stone ring with twelve petal lancets, an outer ring of foils and
// a gold oculus, glazed in sunset-backlit glass. On arrival it is shuttered
// (two half-round oak leaves, iron banded) and the nave is candle-dim. The
// crank opens it: the leaves swing back on their hinges, sunset floods
// through, and coloured shafts sweep east down the nave, lighting each work in
// turn (a warm point light on its frame and a pool on the floor under it)
// until they come to rest on the four niches at the east end. It stays open
// for the save (`open`, mirrored with the world flag rose:open). It is the
// biggest light in the world, it rim-lights Rosace in colour, and it never
// breaks: hits only shake the shutter. Origin: the window's centre.
//
// roseCrank: the shutter's crank on the wall below (a door variant: closed,
// opening, open): a spoked iron wheel on a limestone post, its chain rising to
// the shutter. E turns it; it tells the window to open and emits the kit's
// `lever` event so the host sets rose:open. Origin: the floor under its post.

import "./materials.ts";
import { F_NOINK } from "../../cells.ts";
import { mat } from "../../materials.ts";
import { matId, puff } from "../../kit.ts";
import { EASE, hash2 } from "../../util.ts";
import { defineRecipe, type Prop, type PropGlow, type PropLight } from "../../prop.ts";
import type { Part } from "../../part.ts";

export interface RoseParams {
  /** Diameter in H. */
  size: number;
  /**
   * Where the light lands, prop-local px from the centre: each work's centre
   * ([dx, dy], optionally [dx, dy, half width, half height] of the framed work
   * in px) in route order.
   */
  targets: number[][];
  /** Floor, px below the centre (pools sit there). */
  floor: number;
  /** Seconds for the sweep from the first work to the last. */
  sweep: number;
  /**
   * How many of the last targets the light comes to rest on (0: all alike).
   * Those get a stronger light and pool, the shafts settle across them, and
   * the works the sweep has passed keep a softer glow.
   */
  rest: number;
}

interface Refs {
  glass: Part;
  shutter: Part;
  R: number;
  /** 0 shut .. 1 open (shutter leaves). */
  f: number;
  /** 0..1 progress of the sweep down the nave. */
  s: number;
  beams: PropGlow[];
  own: PropLight[];
  tl: PropLight[];
  pools: PropGlow[];
  /** A soft warm wash on the wall around each work the light rests on (by target index; null elsewhere). */
  rests: (PropGlow | null)[];
  halo: PropGlow;
  leaf: { w: number; h: number; src: Uint8Array; tone: Int8Array };
}

const LIGHT_ROSE: [number, number, number] = [1, 0.6, 0.5];
const LIGHT_GOLD: [number, number, number] = [1, 0.76, 0.44];
const LIGHT_VIOLET: [number, number, number] = [0.72, 0.5, 0.95];

export const roseWindow = defineRecipe<RoseParams, Refs>({
  id: "roseWindow",
  breakage: "never",
  reason: "The Chapel of Light's reveal: shuttered on arrival, cranked open it floods the nave with sunset and lights Dex's works one by one (WORLD-PLAN E3). The biggest light source in the world; unbreakable.",
  defaults: { size: 2.5, targets: [], floor: 468, sweep: 12, rest: 0 },
  persist: ["open"],
  cues: ["shutter.open", "rose.swell"],
  standard: { w: 2.5 + 0.4, note: "2.5 H round window in a 0.2 H stone ring" },
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const R = Math.round(u(p.size) / 2);
    const ring = u(0.2);
    const S = (R + ring) * 2 + 2;
    const c = S / 2;
    // --- glass ---
    const gl = b.part("glass", { w: S, h: S, pivot: [c, c], at: [0, 0], layer: "bg", z: 10, outline: 0, hittable: false });
    const g = gl.grid;
    const lead = mat("lead").id;
    const pick = (list: string[], k: number): number => mat(list[Math.floor(k * list.length) % list.length]!).id;
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const dx = x + 0.5 - c, dy = y + 0.5 - c;
        const r = Math.hypot(dx, dy) / R;
        if (r > 1) continue;
        const a = Math.atan2(dy, dx);
        const seg = ((a / (Math.PI * 2)) * 12 + 12.5) % 12; // 12 petals, one pointing up
        const within = seg - Math.floor(seg); // 0..1 across a petal
        const i = g.inner(x, y);
        let m = mat("roseViolet").id;
        let tone = 0;
        if (r < 0.2) {
          // the oculus: gold with an amber heart
          m = r < 0.09 ? mat("roseAmber").id : mat("roseGold").id;
          tone = r < 0.14 ? 1 : 0;
        } else if (r < 0.74) {
          // petals: crimson and violet in turn, a gold tip, blue between
          const petal = Math.floor(seg) % 2 === 0;
          const edge = Math.abs(within - 0.5) * 2; // 0 middle .. 1 petal edge
          const tip = r > 0.62 - (1 - edge) * 0.06;
          m = tip ? mat("roseGold").id : petal ? mat("roseCrimson").id : pick(["roseViolet", "roseBlue"], hash2(Math.floor(seg), 3));
          tone = edge < 0.3 ? 1 : edge > 0.8 ? -1 : 0;
          // quarries: one tone per little pane, never per pixel
          const qh = hash2(Math.floor(r * 9), Math.floor(seg * 2), 7);
          if (qh < 0.15) tone -= 1;
          else if (qh > 0.88) tone += 1;
        } else {
          // outer foils (small circles) in blue and gold, violet quarries between
          const inFoil = Math.abs(within - 0.5) < 0.36 && Math.abs(r - 0.87) < 0.1;
          m = inFoil ? (Math.floor(seg) % 2 ? mat("roseBlue").id : mat("roseGold").id) : mat("roseViolet").id;
          tone = inFoil ? (Math.abs(r - 0.87) < 0.05 ? 1 : 0) : -1 + (hash2(Math.floor(a * 20), Math.floor(r * 12), 9) > 0.7 ? 1 : 0);
        }
        // lead: petal boundaries, the rings, the quarry grid
        const petalLine = Math.min(within, 1 - within) * (r * R * Math.PI * 2 / 12) < 1.1;
        const ringLine = Math.abs(r - 0.2) * R < 1.1 || Math.abs(r - 0.74) * R < 1.2;
        const quarry = r > 0.24 && r < 0.72 && Math.abs(((r * R) % 9) - 4.5) > 3.8;
        if ((petalLine && r > 0.2) || ringLine || quarry) {
          g.setRaw(i, lead, 0, 1, 2, F_NOINK, 999);
          continue;
        }
        g.setRaw(i, m, Math.max(-2, Math.min(1, tone)), 2, 1.5, 0, 999);
      }
    }
    // --- the stone: an outer ring, petal mullions and cusps, the oculus ring (in front of the glass) ---
    const st = b.part("stone", { w: S + 4, h: S + 4, pivot: [c + 2, c + 2], at: [0, 0], layer: "bg", z: 12, hittable: false });
    st.ring(c + 2, c + 2, R - 1, R + ring, { mat: "chapelStoneLight", profile: "dome", r: 5, depth: 6, piece: "ring" });
    // two mouldings round the ring: a bead near the glass, a roll at the outer edge
    st.ring(c + 2, c + 2, R + 2, R + 4, { mat: "chapelStoneLight", profile: "dome", r: 1, z: 6, tone: 1, piece: "bead" });
    st.ring(c + 2, c + 2, R + ring - 3, R + ring, { mat: "chapelStoneLight", profile: "dome", r: 2, z: 5, piece: "roll" });
    // a bead of darker stone at the inner edge, voussoir joints round the ring
    st.ring(c + 2, c + 2, R - 1, R + 1, { mat: "chapelStoneLight", mode: "paint", tone: -1 });
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2;
      st.line(c + 2 + Math.cos(a) * (R + 2), c + 2 + Math.sin(a) * (R + 2), c + 2 + Math.cos(a) * (R + ring), c + 2 + Math.sin(a) * (R + ring), { mat: "chapelStoneLight", mode: "paint", tone: -2 });
    }
    // spokes: thin stone mullions between the petals, from the oculus to the rim
    for (let k = 0; k < 12; k++) {
      // on the petal boundaries (petals are centred every 30 degrees, one pointing up)
      const a = ((k + 0.5) / 12) * Math.PI * 2 - Math.PI / 2;
      const x0 = c + 2 + Math.cos(a) * R * 0.2, y0 = c + 2 + Math.sin(a) * R * 0.2;
      const x1 = c + 2 + Math.cos(a) * R * 0.98, y1 = c + 2 + Math.sin(a) * R * 0.98;
      st.stroke([x0, y0, x1, y1], 3, { mat: "chapelStoneLight", profile: "cylV", z: 2, piece: "spoke" });
    }
    st.ring(c + 2, c + 2, R * 0.19, R * 0.24, { mat: "chapelStoneLight", profile: "dome", r: 2, z: 3, piece: "oculus" });
    st.ring(c + 2, c + 2, R * 0.72, R * 0.76, { mat: "limestone", profile: "dome", r: 2, z: 2, piece: "inner" });
    st.speckle({ amount: 0.12, seed: p.seed, tone: -1, mats: ["limestone"] });
    // --- the shutter: two half-round oak leaves, drawn from one design as they swing ---
    b.part("shutter", { w: S, h: S, pivot: [c, c], at: [0, 0], layer: "bg", z: 14, hittable: true });
    const design = b.canvas(S, S);
    design.circle(c, c, R + 1, { mat: "oak", profile: "flat", depth: 2, piece: "leaf" });
    // planks (vertical), two iron bands, big nail heads, the seam down the middle
    for (let x = 2; x < S; x += Math.max(8, u(0.16))) design.rect(x, 0, 1, S, { mat: "oak", mode: "paint", tone: -2 });
    for (const y of [c - Math.round(R * 0.55), c + Math.round(R * 0.45)]) {
      design.rect(0, y, S, Math.max(4, u(0.06)), { mat: "iron", mode: "paint" });
      for (let x = 6; x < S - 4; x += 14) design.pixels([[x, y + 1]], { mat: "iron", mode: "paint", tone: 1 });
    }
    design.rect(c - 1, 0, 2, S, { mat: "oak", mode: "paint", tone: -3 });
    design.grain({ dir: "v", seed: p.seed + 4, mats: ["oak"], density: 0.24 });
    design.speckle({ amount: 0.08, seed: p.seed + 5, tone: -1, mats: ["oak"] });
    const dg = design.grid;
    const src = new Uint8Array(S * S), tone = new Int8Array(S * S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const i = dg.inner(x, y);
      src[y * S + x] = dg.mat[i]!;
      tone[y * S + x] = dg.tone[i]!;
    }
    // --- light: the window's own glow and lights, the shafts, a light at each work, pools ---
    const halo = b.glow({ kind: "disc", at: [0, 0], colour: [1, 0.66, 0.5], radius: Math.round(R * 1.7), intensity: 0.5, on: true });
    const own = [
      b.light({ at: [0, 0], colour: LIGHT_ROSE, radius: u(6), intensity: 0.9, height: u(2.2) }),
      b.light({ at: [u(0.6), u(1.4)], colour: LIGHT_GOLD, radius: u(5), intensity: 0.7, height: u(1.6) }),
    ];
    const beamCols: [number, number, number][] = [LIGHT_ROSE, LIGHT_GOLD, LIGHT_VIOLET];
    const beams = beamCols.map((col, k) => b.glow({ kind: "beam", at: [Math.round((k - 1) * R * 0.45), Math.round(R * 0.2)], to: [u(4), p.floor], colour: col, radius: Math.round(R * 0.9), width1: u(2.4), intensity: 0.55 }));
    const firstRest = restFrom(p.targets.length, p.rest);
    const tl = p.targets.map(([dx, dy], k) => {
      const rest = k >= firstRest;
      return b.light({ at: [dx!, dy!], colour: k % 3 === 1 ? LIGHT_GOLD : LIGHT_ROSE, radius: u(rest ? 3.2 : 2.4), intensity: rest ? 1.2 : 0.75, height: u(1.2) });
    });
    const pools = p.targets.map(([dx], k) => {
      const rest = k >= firstRest;
      return b.glow({ kind: "disc", at: [dx!, p.floor - 2], colour: [1, 0.64, 0.52], radius: u(rest ? 1.9 : 1.5), flat: 0.12, intensity: rest ? 0.85 : 0.55 });
    });
    // the works the light rests on: sunset pooled on the wall of each niche, around the frame
    // (a soft ring hugging the frame: the work itself is never lit or tinted, only the wall around it)
    const rests = p.targets.map(([dx, dy, hw, hh], k) => {
      if (k < firstRest) return null;
      const rx = (hw ?? u(0.75)) + u(0.28), ry = (hh ?? u(1.25)) + u(0.28);
      return b.glow({ kind: "ring", at: [dx!, dy!], colour: [1, 0.7, 0.52], radius: rx, flat: ry / rx, thick: u(0.36), intensity: 0.3 });
    });
    const refs: Refs = { glass: b.get("glass"), shutter: b.get("shutter"), R, f: 0, s: 0, beams, own, tl, pools, rests, halo, leaf: { w: S, h: S, src, tone } };
    return refs;
  },
  initial: (c) => (c.data["open"] ? "lit" : "shut"),
  states: {
    shut: {
      enter(c) {
        c.refs.f = 0;
        c.refs.s = 0;
        drawShutter(c.refs);
        levels(c);
      },
      update: (c) => levels(c),
      hit: (c, h) => knock(c, h.hit.dir[0]),
    },
    opening: {
      sound: "shutter.open",
      enter(c) {
        c.data["open"] = true;
      },
      update(c, dt) {
        const r = c.refs;
        r.f = Math.min(1, r.f + dt / (c.world.reduced ? 3.6 : 2.8));
        drawShutter(r);
        levels(c);
        if (r.f >= 1) c.go("sweeping");
      },
    },
    sweeping: {
      sound: "rose.swell",
      update(c, dt) {
        const r = c.refs;
        r.s = Math.min(1, r.s + dt / Math.max(1, Number(c.params["sweep"] ?? 12)));
        levels(c);
        if (r.s >= 1) c.go("lit");
      },
      hit: (c, h) => knock(c, h.hit.dir[0]),
    },
    lit: {
      enter(c) {
        const r = c.refs;
        r.f = 1;
        r.s = 1;
        c.data["open"] = true;
        drawShutter(r);
        levels(c);
      },
      update: (c) => levels(c),
      hit: (c, h) => knock(c, h.hit.dir[0]),
    },
  },
  actions: {
    /** The crank's pull (or the story): open it and let the light sweep. */
    open: (c) => (c.state === "shut" ? "opening" : undefined),
    /** Already open for this save: straight to the settled light. */
    settle: () => "lit",
  },
  demo: {
    indoor: true,
    at: 5.6,
    w: 14,
    params: { targets: [[160, 380], [400, 380], [640, 380], [880, 380]], floor: 448, sweep: 6, rest: 2 },
    script: [
      { label: "shuttered: the nave is candle-dim", wait: 1 },
      { label: "slash the shutter: it knocks, nothing breaks", hit: "slash", from: -0.4, wait: 1 },
      { label: "open: the leaves swing back", act: "open", wait: 3 },
      { label: "the light sweeps east, lighting each work", wait: 6.5 },
      { label: "settled", wait: 1.5 },
    ],
  },
});

/** Light levels from the shutter (f) and the sweep (s). */
function levels(c: Prop<Refs>): void {
  const r = c.refs;
  const open = EASE["inOutCubic"]!(r.f);
  r.glass.glow = 0.12 + 0.88 * open;
  // the glass reads dark behind the shutter; its backlight rises as the leaves part
  for (const L of r.own) L.level = open;
  r.halo.level = open * 0.9;
  const n = r.tl.length;
  // where the sweep has reached, in target units (0 = before the first work)
  const at = r.s * (n + 0.6);
  const firstRest = restFrom(n, Number(c.params["rest"] ?? 0));
  // a work lights as the sweep reaches it; once it has passed (and the work is
  // not one the light rests on) it keeps a softer glow
  const lvl = (k: number): number => {
    const on = clamp01((at - k) / 1.1);
    if (k >= firstRest) return on;
    return on * (1 - 0.55 * clamp01((at - k - 1.6) / 1.4));
  };
  r.tl.forEach((L, k) => (L.level = lvl(k)));
  r.pools.forEach((G, k) => (G.level = lvl(k)));
  r.rests.forEach((G, k) => G && (G.level = lvl(k)));
  // the shafts fall from the window toward where the sweep is now, then settle on the last works
  const tgt = c.params["targets"] as [number, number][];
  const floor = Number(c.params["floor"] ?? 0);
  const last: [number, number] = tgt.length ? tgt[tgt.length - 1]! : [c.params.H * 8, floor];
  const first: [number, number] = tgt.length ? tgt[0]! : [c.params.H * 3, floor];
  // they settle over the middle of the works the light rests on, spread across them
  const restA = tgt.length ? tgt[Math.min(firstRest, tgt.length - 1)]! : last;
  const end = (restA[0] + last[0]) / 2;
  const ease = EASE["inOutSine"]!(Math.min(1, r.s * 1.1));
  const ex = first[0] + (end - first[0]) * ease;
  const spread = c.params.H * 0.9 + (Math.max(c.params.H * 0.9, (last[0] - restA[0]) / 2.4) - c.params.H * 0.9) * ease;
  r.beams.forEach((G, k) => {
    G.to = [Math.round(ex + (k - 1) * spread) - G.lx, floor - G.ly];
    G.level = open * (c.state === "lit" ? 0.9 : 1);
  });
}

/** Index of the first target the light rests on (n when it rests on none in particular). */
function restFrom(n: number, rest: number): number {
  return rest > 0 ? Math.max(0, n - Math.round(rest)) : n;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** A hit on the shutter or glass: the leaves knock in their frame. */
function knock(c: Prop<Refs>, dir: number): string | void {
  const s = c.refs.shutter;
  s.shake = Math.max(s.shake, 0.18);
  s.offX = 0;
  c.sound("wood.hit", 0.5);
  void dir;
}

/** The two leaves, each rotated about its outer hinge: projected width shrinks by cos, and the face darkens. */
function drawShutter(r: Refs): void {
  const key = Math.round(r.f * 40);
  const part = r.shutter;
  if (part.tag["key"] === key) return;
  part.tag["key"] = key;
  const g = part.grid;
  g.clearAll();
  if (r.f >= 1) {
    part.visible = false;
    return;
  }
  part.visible = true;
  const { w, h, src, tone } = r.leaf;
  const c = w / 2;
  const ang = EASE["inOutCubic"]!(r.f) * Math.PI * 0.46;
  const k = Math.cos(ang);
  const shade = Math.round((1 - k) * 3);
  const oak = matId("oak");
  // left leaf: hinge at its outer (left) edge, x in 0..c; right leaf mirrored
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const left = x < c;
      const hinge = left ? 0 : w;
      const sx = Math.round(hinge + (x - hinge) / Math.max(0.05, k));
      if (left ? sx >= c : sx < c) continue;
      if (sx < 0 || sx >= w) continue;
      const m = src[y * w + sx]!;
      if (!m) continue;
      const i = g.inner(x, y);
      g.setRaw(i, m, Math.max(-3, tone[y * w + sx]! - shade - (m === oak && (left ? x : w - 1 - x) < 2 ? 1 : 0)), left ? 1 : 2, 2, 0, 999);
    }
  }
  g.computeNormals();
}

// =====================================================================================

export interface CrankParams {
  /** The window to open (prop id in the same room). */
  window: string;
}

interface CrankRefs {
  wheel: Part;
  spin: number;
}

export const roseCrank = defineRecipe<CrankParams, CrankRefs>({
  id: "roseCrank",
  breakage: "never",
  reason: "The rose window's shutter crank: one turn floods the nave with sunset and lights the works (WORLD-PLAN E3, a door variant: closed, opening, open).",
  defaults: { window: "rose-window" },
  use: { reach: 0.6, prompt: "turn" },
  persist: ["done"],
  cues: ["crank.turn", "chain.run"],
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const W = u(0.34), Hp = u(1.0);
    const post = b.part("post", { w: W, h: Hp, pivot: [W >> 1, Hp], at: [0, 0], layer: "mid", z: 3, hittable: false });
    post.rect(0, Hp - u(0.1), W, u(0.1), { mat: "limestone", profile: "bevel", r: 2, depth: 3, piece: "base" });
    post.rect(Math.round(W * 0.2), u(0.12), Math.round(W * 0.6), Hp - u(0.2), { mat: "limestone", profile: "bevel", r: 2, depth: 3, piece: "post" });
    post.rect(Math.round(W * 0.1), u(0.06), Math.round(W * 0.8), u(0.08), { mat: "limestone", profile: "bevel", r: 2, depth: 3, z: 1, piece: "cap" });
    post.speckle({ amount: 0.1, seed: p.seed, tone: -1, mats: ["limestone"] });
    // the drum the chain winds on
    post.rect(Math.round(W * 0.3), u(0.02), Math.round(W * 0.4), u(0.06), { mat: "iron", profile: "cylH", z: 3, piece: "drum" });
    // the wheel: rim, six spokes, a hub and a handle
    const D = u(0.62);
    const wh = b.part("wheel", { w: D + 2, h: D + 2, pivot: [(D >> 1) + 1, (D >> 1) + 1], at: [0, -Math.round(Hp * 0.62)], layer: "mid", z: 6, smoothRotate: true, hittable: false });
    const cc = (D >> 1) + 1;
    wh.ring(cc, cc, D / 2 - 3, D / 2, { mat: "iron", profile: "dome", r: 2, piece: "rim" });
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      wh.stroke([cc, cc, cc + Math.cos(a) * (D / 2 - 2), cc + Math.sin(a) * (D / 2 - 2)], 2, { mat: "iron", profile: "cylV", piece: "spoke" });
    }
    wh.circle(cc, cc, 3, { mat: "brass", profile: "dome", r: 2, z: 3, piece: "hub" });
    wh.rect(cc + Math.round(D * 0.36), cc - 2, 3, 4, { mat: "oak", profile: "cylH", z: 4, piece: "handle" });
    return { wheel: b.get("wheel"), spin: 0 };
  },
  initial: (c) => (c.data["done"] ? "open" : "closed"),
  states: {
    closed: {
      use: () => "opening",
    },
    opening: {
      sound: "crank.turn",
      enter(c) {
        c.data["done"] = true;
        // the host sets rose:open (the kit's lever event); the window opens now
        c.emit({ type: "lever", on: true });
        c.world.find(String(c.params["window"] ?? ""))?.act("open");
      },
      update(c, dt) {
        const r = c.refs;
        const k = c.t < 2.4 ? EASE["outCubic"]!(Math.min(1, c.t / 0.4)) : Math.max(0, 1 - (c.t - 2.4) / 0.6);
        r.spin += dt * 7 * k;
        r.wheel.rot = r.spin;
        if (Math.floor(c.t * 5) !== Math.floor((c.t - dt) * 5) && c.t < 2.6) {
          c.sound("chain.run", 0.35);
          const [x, y] = r.wheel.toWorld(r.wheel.pivotX, 0);
          if (Math.floor(c.t * 5) % 3 === 0) puff(c.world, "dust", x, y, 2, [0, -1], { speed: 0.2 });
        }
      },
      after: [3, "open"],
    },
    open: {},
  },
  demo: {
    indoor: true,
    w: 4,
    script: [
      { label: "the crank, the shutter's chain rising from its drum", wait: 0.8 },
      { label: "E: it turns", use: true, wait: 3.4 },
      { label: "done (it stays done for the save)", wait: 0.8 },
    ],
  },
});

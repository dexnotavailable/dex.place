// What her attack drawings themselves say about a hit (Dex 10-19: "make sure the combat feel looks at the frames so it
// can derive the hitbox movement which makes sense"). Pure, no browser and no node APIs: tools/zhusha/derive.mjs runs it
// over the slotted drawings and writes derived.json; the tests run it again and compare, so derived.json can never go
// stale against public/assets/zhusha/.
//
// Per drawing:
// - energy: the blade's glowing runes and the slash / burst effects (cyan to deep blue, and their near-white cores),
//   told from her body by colour (the master palette keeps them apart: her blacks, reds, skin, gold and stockings never
//   fall in the cyan-blue band with that saturation). Specks (sparkles, motes) under MIN_COMP px are left out.
// - active: the energy in front of her (at or past her soles' centre, the pivot column) is big AND mostly new against
//   the drawing before (it is sweeping through the space in front of her, not a blade held still or a fading trail).
// - rects: where that energy is, as a few boxes hugging it (an 8 art px grid, runs merged), art px from the pivot,
//   facing right, y negative up. The game's hitbox on an active drawing is these boxes at her drawn size.
// - hits: how many and which beat each is come from the move's marked hit drawings (anim.json "hits": Dex's retime
//   BOOMs, m1_3's three thrusts, e_tap's burst and pillar); when each hit's damage is live comes from the active drawings
//   around its mark.
// - root: how far her planted foot says she moved since the drawing before (art px, + = the way she faces). The
//   drawings are drawn in place (her soles' centre on the pivot), so a foot that stays on the ground but shifts in the
//   frame means the body moved the other way; of the foot contacts the pair with the smallest move is the planted one
//   (the safe reading: never more travel than a foot shows). Airborne drawings (no contact) move 0 and the next one is
//   read against the last drawing she stood in.

export interface Img {
  w: number;
  h: number;
  /** RGBA, row-major. */
  data: Uint8Array | Uint8ClampedArray;
}

export type Rect = [number, number, number, number];

export interface DerivedFrame {
  /** Energy px in front of her (at or past the pivot column). */
  area: number;
  /** Of those, px with no energy within NEAR px in the drawing before. */
  sweep: number;
  active: boolean;
  /** Boxes over the energy in front of her (active drawings only): [x0, y0, x1, y1] art px from the pivot, facing right. */
  rects: Rect[];
  /** Art px she moved since the drawing before, by her planted foot (+ = the way she faces). */
  root: number;
  /** Her ground contacts (soles), x ranges in art px from the pivot. */
  feet: [number, number][];
}

export interface DerivedSlot {
  slot: string;
  /** A hash of the anim.json's frames (file + ticks), pivot and every drawing's pixels. */
  hash: string;
  ticks: number[];
  frames: DerivedFrame[];
  /** The hits: first and last drawing of each one's live window, and its clip ticks (at, len). */
  hits: { first: number; last: number; at: number; len: number }[];
}

export const DERIVE = {
  /** Energy specks smaller than this (px, 8-connected) are sparkles, not the slash. */
  minComp: 64,
  /** An active drawing: at least this much energy in front of her ... */
  areaMin: 1000,
  /** ... and at least this much of it new against the drawing before. */
  sweepMin: 400,
  /** "New" = no energy px of the drawing before within this many px. */
  near: 2,
  /** The hit boxes' grid (art px) and how many energy px make a cell count. */
  cell: 8,
  cellMin: 6,
  /** Foot contacts: body px in the last rows above the ground row, clusters this wide (wider: ink, shadow, a blade tip). */
  contactRows: 3,
  footMin: 3,
  footMax: 20,
  /** A planted foot moves at most this much between drawings (art px); more is a different foot. */
  maxStep: 12,
} as const;

/** The blade and its effects, by colour: the cyan to deep blue band with some saturation, or a bluish near-white core. */
export function isEnergy(r: number, g: number, b: number): boolean {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  const v = mx / 255;
  const s = mx > 0 ? (mx - mn) / mx : 0;
  if (v >= 0.8 && s <= 0.3 && b >= r && b >= g - 8) return true;
  if (s < 0.3 || v < 0.3 || mx === mn) return false;
  const d = mx - mn;
  let h: number;
  if (mx === r) h = (((g - b) / d) % 6 + 6) % 6;
  else if (mx === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h /= 6;
  return h >= 0.44 && h <= 0.7;
}

/** FNV-1a over bytes, as 8 hex digits (stable across node and the browser). */
export function fnv(chunks: readonly (Uint8Array | Uint8ClampedArray | string)[]): string {
  let h = 0x811c9dc5;
  for (const c of chunks) {
    if (typeof c === "string") {
      for (let i = 0; i < c.length; i++) { h ^= c.charCodeAt(i) & 255; h = Math.imul(h, 0x01000193); }
    } else {
      for (let i = 0; i < c.length; i++) { h ^= c[i]!; h = Math.imul(h, 0x01000193); }
    }
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

interface Masks {
  w: number;
  h: number;
  energy: Uint8Array;
  body: Uint8Array;
}

function masks(img: Img): Masks {
  const { w, h, data } = img;
  const energy = new Uint8Array(w * h), body = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (data[i * 4 + 3]! < 128) continue;
    if (isEnergy(data[i * 4]!, data[i * 4 + 1]!, data[i * 4 + 2]!)) energy[i] = 1;
    else body[i] = 1;
  }
  // specks out: 8-connected components under minComp px
  const seen = new Uint8Array(w * h), stack: number[] = [], comp: number[] = [];
  for (let i = 0; i < w * h; i++) {
    if (!energy[i] || seen[i]) continue;
    comp.length = 0;
    stack.push(i);
    seen[i] = 1;
    while (stack.length) {
      const p = stack.pop()!;
      comp.push(p);
      const x = p % w, y = (p - x) / w;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const q = ny * w + nx;
          if (energy[q] && !seen[q]) { seen[q] = 1; stack.push(q); }
        }
      }
    }
    if (comp.length < DERIVE.minComp) for (const p of comp) energy[p] = 0;
  }
  return { w, h, energy, body };
}

/** Ground contacts: clusters of body px in the rows just above the ground row, x relative to the pivot. */
function contacts(m: Masks, px: number, py: number): [number, number][] {
  const cols: number[] = [];
  for (let x = 0; x < m.w; x++) {
    for (let y = Math.max(0, py - DERIVE.contactRows); y < Math.min(m.h, py); y++) {
      if (m.body[y * m.w + x]) { cols.push(x); break; }
    }
  }
  const out: [number, number][] = [];
  let a = -1, b = -1;
  const close = (): void => {
    const wd = b - a + 1;
    if (a >= 0 && wd >= DERIVE.footMin && wd <= DERIVE.footMax) out.push([a - px, b - px]);
  };
  for (const x of cols) {
    if (a >= 0 && x - b <= 3) b = x;
    else { close(); a = b = x; }
  }
  close();
  return out;
}

/** The planted foot's reading of how far she moved from contacts `prev` to `cur` (null: no foot pairs up). */
function rootFrom(prev: [number, number][], cur: [number, number][]): number | null {
  let best: number | null = null;
  for (const [a0, a1] of prev) {
    for (const [b0, b1] of cur) {
      const dx = (b0 + b1) / 2 - (a0 + a1) / 2;
      if (Math.abs(dx) > DERIVE.maxStep) continue;
      // smallest move wins; on a tie the trailing foot (further back) is the planted one
      if (best === null || Math.abs(dx) < Math.abs(best) - 1e-9 || (Math.abs(Math.abs(dx) - Math.abs(best)) < 1e-9 && dx > best)) best = dx;
    }
  }
  return best === null ? null : 0 - best;
}

/** Boxes over a mask (x >= the pivot column only), on DERIVE.cell cells aligned to the pivot, runs merged across rows. */
function cover(m: Masks, fwd: Uint8Array, px: number, py: number): Rect[] {
  const C = DERIVE.cell;
  const counts = new Map<string, number>();
  for (let y = 0; y < m.h; y++) {
    for (let x = px; x < m.w; x++) {
      if (!fwd[y * m.w + x]) continue;
      const k = `${Math.floor((x - px) / C)},${Math.floor((y - py) / C)}`;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
  }
  const rows = new Map<number, number[]>();
  for (const [k, n] of counts) {
    if (n < DERIVE.cellMin) continue;
    const [cx, cy] = k.split(",").map(Number) as [number, number];
    let r = rows.get(cy);
    if (!r) rows.set(cy, (r = []));
    r.push(cx);
  }
  // runs per row
  const runs: { cy: number; c0: number; c1: number }[] = [];
  for (const cy of [...rows.keys()].sort((a, b) => a - b)) {
    const xs = rows.get(cy)!.sort((a, b) => a - b);
    let c0 = xs[0]!, c1 = xs[0]!;
    for (let i = 1; i < xs.length; i++) {
      if (xs[i] === c1 + 1) c1 = xs[i]!;
      else { runs.push({ cy, c0, c1 }); c0 = c1 = xs[i]!; }
    }
    runs.push({ cy, c0, c1 });
  }
  // the same run in consecutive rows becomes one box
  const out: { r0: number; r1: number; c0: number; c1: number }[] = [];
  for (const r of runs) {
    const prev = out.find((o) => o.r1 === r.cy - 1 && o.c0 === r.c0 && o.c1 === r.c1);
    if (prev) prev.r1 = r.cy;
    else out.push({ r0: r.cy, r1: r.cy, c0: r.c0, c1: r.c1 });
  }
  return out.map((o) => [o.c0 * C, o.r0 * C, (o.c1 + 1) * C, (o.r1 + 1) * C] as Rect);
}

/** Derives one slot from its anim.json fields and its decoded drawings (in frame order). */
export function deriveSlot(slot: string, def: { frames: { file: string; ticks: number }[]; pivot: [number, number]; hits?: number[] }, imgs: readonly Img[]): DerivedSlot {
  if (imgs.length !== def.frames.length) throw new Error(`${slot}: ${imgs.length} drawings for ${def.frames.length} frames`);
  const px = Math.round(def.pivot[0]), py = Math.round(def.pivot[1]);
  const hash = fnv([JSON.stringify({ frames: def.frames.map((f) => [f.file, f.ticks]), pivot: def.pivot }), ...imgs.map((i) => i.data)]);
  const ms = imgs.map(masks);
  const frames: DerivedFrame[] = [];
  let lastFeet: [number, number][] | null = null;
  ms.forEach((m, k) => {
    // energy in front of her
    const fwd = new Uint8Array(m.w * m.h);
    let area = 0, sweep = 0;
    // the drawing before (one canvas and pivot per slot, so a px is the same place in both)
    const prev = k > 0 ? ms[k - 1]! : null;
    for (let y = 0; y < m.h; y++) {
      for (let x = px; x < m.w; x++) {
        const i = y * m.w + x;
        if (!m.energy[i]) continue;
        fwd[i] = 1;
        area++;
        let near = false;
        if (prev) {
          for (let dy = -DERIVE.near; dy <= DERIVE.near && !near; dy++) {
            for (let dx = -DERIVE.near; dx <= DERIVE.near; dx++) {
              const nx = x + dx, ny = y + dy;
              if (nx >= 0 && ny >= 0 && nx < prev.w && ny < prev.h && prev.energy[ny * prev.w + nx]) { near = true; break; }
            }
          }
        }
        if (!near) sweep++;
      }
    }
    const active = area >= DERIVE.areaMin && sweep >= DERIVE.sweepMin;
    const feet = contacts(m, px, py);
    let root = 0;
    if (k > 0 && feet.length && lastFeet && lastFeet.length) root = rootFrom(lastFeet, feet) ?? 0;
    if (feet.length) lastFeet = feet;
    frames.push({ area, sweep, active, rects: active ? cover(m, fwd, px, py) : [], root, feet });
  });
  // the hits: each marked hit drawing (anim.json "hits", Dex's retime BOOMs) is one hit; the run of active drawings
  // around it is when its damage is live (a run holding two marks splits at the second; a run with no mark joins the
  // hit before it). With no marks every run is a hit. A marked drawing the colours call quiet still gets its own box.
  const starts: number[] = [];
  let t = 0;
  for (const f of def.frames) { starts.push(t); t += f.ticks; }
  const marks = [...new Set((def.hits ?? []).filter((h) => h >= 0 && h < frames.length))].sort((a, b) => a - b);
  for (const h of marks) if (!frames[h]!.active && !frames[h]!.rects.length) frames[h]!.rects = cover(ms[h]!, forward(ms[h]!, px), px, py);
  const runs: [number, number][] = [];
  frames.forEach((f, i) => {
    if (!f.active) return;
    const last = runs[runs.length - 1];
    if (last && last[1] === i - 1) last[1] = i;
    else runs.push([i, i]);
  });
  const groups: [number, number][] = [];
  if (!marks.length) groups.push(...runs);
  else {
    for (const h of marks) groups.push([h, h]);
    for (const [a, b] of runs) {
      const inside = marks.filter((h) => h >= a && h <= b);
      if (inside.length) {
        // the first mark's hit takes the run's start; each mark's hit runs to the next mark (or the run's end)
        inside.forEach((h, j) => {
          const g = groups[marks.indexOf(h)]!;
          g[0] = Math.min(g[0], j === 0 ? a : h);
          g[1] = Math.max(g[1], j + 1 < inside.length ? inside[j + 1]! - 1 : b);
        });
      } else {
        const before = marks.filter((h) => h < a);
        const g = groups[before.length ? marks.indexOf(before[before.length - 1]!) : 0]!;
        g[0] = Math.min(g[0], a);
        g[1] = Math.max(g[1], b);
      }
    }
  }
  const hits = groups.map(([first, last]) => ({ first, last, at: starts[first]!, len: starts[last]! + def.frames[last]!.ticks - starts[first]! }));
  return { slot, hash, ticks: def.frames.map((f) => f.ticks), frames, hits };
}

/** The energy at or past the pivot column. */
function forward(m: Masks, px: number): Uint8Array {
  const fwd = new Uint8Array(m.w * m.h);
  for (let y = 0; y < m.h; y++) for (let x = px; x < m.w; x++) if (m.energy[y * m.w + x]) fwd[y * m.w + x] = 1;
  return fwd;
}

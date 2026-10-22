// World effects as pixel sprite animations (lane C 10-19, lanes/engine/EFFECTS-CONTRACT.md): every effect under
// public/assets/fx/<id>/ (fx.json + fNNN.png) loads at start, trimmed and packed into atlases like her drawings, and
// is drawn at her art px through her own path (the actors' pass: at screen res where an art px is a screen px or more,
// else in the actor layer, reduced onto her grid). The game plays one with fx.play(id, { x, y, facing }).

import type { SpriteSheet } from "../../lab/engine/renderer.ts";
import type { WorldRenderer } from "../../world/render/renderer.ts";
import { artQuery } from "../zhusha/anims.ts";
import { artTransform, type PlayView } from "../zhusha/units.ts";
import { H } from "../config.ts";
import { FxClock, fxCells, fxClipRows, type FxCell, fxErodeKeep, fxFade, fxFrameAt, fxGroundClip, fxGroundEnds, fxGroundStrips, fxMergeLifts, FX_MAX_H, FX_MAX_STORED, FX_MAX_W, validateFx, type FxCarry, type FxDef, type FxHandle, type FxLayer, type FxSpawn } from "./contract.ts";

/** Effects present at build time (a missing one is never fetched). */
export const FX_PRESENT: string[] = Object.keys(import.meta.glob("/public/assets/fx/*/fx.json"))
  .map((k) => k.split("/")[4] ?? "")
  .filter(Boolean)
  .sort();

export const FX_BASE = "/assets/fx/";
const ATLAS = 2048;

/** One stored cell of a drawing: its atlas page and rect, and its top-left from the pivot (art px). */
interface FxPiece {
  sheet: number;
  r: [number, number, number, number];
  off: [number, number];
}

interface FxLoaded {
  def: FxDef;
  /** Per drawing, its cells (fx/contract.ts fxCells: empty cells left out, repeated ones stored once). */
  drawings: FxPiece[][];
  sheets: SpriteSheet[];
  /** Stored px (GPU memory / 4). */
  stored: number;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${url}`));
    img.src = url;
  });
}

/**
 * The effects' main-thread work (a drawing cut into cells and put on its atlas page, a page uploaded), one piece at a
 * time with a breath between, so loading them never takes more than a sliver of a frame (Dex 10-21: the opening "lags
 * like hell": ~10 MB of drawings were cut all at once, effects in parallel, through the fall).
 */
let queue: Promise<unknown> = Promise.resolve();

/** A drawing cut into its cells (fx/contract.ts fxCells), with its size. */
interface Cut { w: number; h: number; cells: FxCell[] }

/**
 * The cutting worker (fx/cut-worker.ts: fetch, decode and cut off the main thread), started on first use; null where
 * there is none (no workers or no OffscreenCanvas: cut in the page), or after it fails (what it was cutting fails too,
 * and those effects are left out as any broken one is).
 */
interface Cutter { w: Worker; n: number; waiting: Map<number, [(c: Cut) => void, (e: Error) => void]> }
let cutter: Cutter | null | undefined;
function cutOff(url: string): Promise<Cut> | null {
  if (cutter === undefined) {
    try {
      if (typeof Worker === "undefined" || typeof OffscreenCanvas === "undefined") throw new Error("no worker");
      const w = new Worker(new URL("./cut-worker.ts", import.meta.url), { type: "module" });
      const c: Cutter = { w, n: 0, waiting: new Map() };
      w.onmessage = (e: MessageEvent<{ n: number; error?: string } & Cut>) => {
        const f = c.waiting.get(e.data.n);
        c.waiting.delete(e.data.n);
        if (e.data.error !== undefined) f?.[1](new Error(e.data.error));
        else f?.[0]({ w: e.data.w, h: e.data.h, cells: e.data.cells });
      };
      w.onerror = () => {
        cutter = null;
        for (const [, no] of c.waiting.values()) no(new Error("the cutting worker failed"));
        c.waiting.clear();
      };
      cutter = c;
    } catch {
      cutter = null;
    }
  }
  if (!cutter) return null;
  const c = cutter, n = ++c.n;
  return new Promise((ok, no) => { c.waiting.set(n, [ok, no]); c.w.postMessage({ n, url }); });
}
function inTurn<T>(work: () => T): Promise<T> {
  const run = queue.then(work);
  queue = run.catch(() => {}).then(() => new Promise((r) => setTimeout(r, 0)));
  return run;
}

async function loadFx(r: WorldRenderer, id: string): Promise<FxLoaded> {
  // versioned by content in a build (the server keeps /assets/ for a year), fresh from the dev server
  const q = artQuery(`${FX_BASE}${id}`);
  const res = await fetch(`${FX_BASE}${id}/fx.json${q}`, q ? {} : { cache: "no-cache" });
  if (!res.ok) throw new Error(`${id}: fx.json HTTP ${res.status}`);
  const def = validateFx(await res.json(), id);
  // (each page remembers how much of it is used: a page is uploaded at that size, not the whole 2048 x 2048, so a small
  // effect or the final page of a big one does not hold a mostly empty 16 MB texture: critic 10-22, effect memory)
  const pages: { canvas: HTMLCanvasElement; g: CanvasRenderingContext2D; w: number; h: number }[] = [];
  let x = 0, y = 0, row = 0, stored = 0;
  const place = (w: number, h: number): [number, number, number] => {
    if (!pages.length || x + w > ATLAS) { x = 0; y += row; row = 0; }
    if (!pages.length || y + h > ATLAS) {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = ATLAS;
      pages.push({ canvas, g: canvas.getContext("2d", { willReadFrequently: true })!, w: 0, h: 0 });
      x = y = row = 0;
    }
    const at: [number, number, number] = [pages.length - 1, x, y];
    const pg = pages[pages.length - 1]!;
    pg.w = Math.max(pg.w, x + w);
    pg.h = Math.max(pg.h, y + h);
    x += w + 1;
    row = Math.max(row, h + 1);
    return at;
  };
  const scratch = document.createElement("canvas");
  const sg = scratch.getContext("2d", { willReadFrequently: true })!;
  const [pvx, pvy] = def.pivot;
  const shared = new Map<string, { at: [number, number, number]; px: Uint8Array }>();
  const drawings: FxPiece[][] = [];
  // one drawing at a time (a long effect never holds all its decoded drawings at once; the next one is fetched while
  // this one is cut into cells, in its turn)
  const url = (i: number): string => `${FX_BASE}${id}/${def.frames[i]!.file}${q}`;
  const ask = (i: number): Promise<Cut> => {
    const p = cutOff(new URL(url(i), location.href).href) ?? loadImage(url(i)).then((img) => inTurn(() => cutHere(img)));
    p.catch(() => {});
    return p;
  };
  let next = ask(0);
  for (let i = 0; i < def.frames.length; i++) {
    const f = def.frames[i]!;
    const got = await next;
    if (i + 1 < def.frames.length) next = ask(i + 1);
    await inTurn(() => paste(got, f));
  }
  const sheets: SpriteSheet[] = [];
  for (const p of pages) sheets.push(await inTurn(() => ({ albedo: r.texture(usedPart(p)), normal: r.flatNormal, keyInfluence: 0 })));
  return { def, drawings, sheets, stored };

  // a page's used part (its cells are placed from its top left; sprites read texels by position, so a cropped page
  // draws the same)
  function usedPart(p: (typeof pages)[number]): HTMLCanvasElement {
    const w = Math.max(1, p.w), h = Math.max(1, p.h);
    if (w >= ATLAS && h >= ATLAS) return p.canvas;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    c.getContext("2d")!.drawImage(p.canvas, 0, 0);
    return c;
  }

  // (no worker here) fetched and cut in the page, in its turn
  function cutHere(img: HTMLImageElement): Cut {
    const w = img.naturalWidth, h = img.naturalHeight;
    if (w > FX_MAX_W || h > FX_MAX_H) return { w, h, cells: [] };
    scratch.width = w;
    scratch.height = h;
    sg.clearRect(0, 0, w, h);
    sg.drawImage(img, 0, 0);
    return { w, h, cells: fxCells(sg.getImageData(0, 0, w, h).data, w, h) };
  }

  function paste({ w, h, cells }: Cut, f: (typeof def.frames)[number]): void {
    if (w > FX_MAX_W || h > FX_MAX_H) throw new Error(`${id}/${f.file}: ${w} x ${h} is over ${FX_MAX_W} x ${FX_MAX_H}`);
    const off = f.off ?? [0, 0];
    const pieces: FxPiece[] = [];
    for (const c of cells) {
      let s = shared.get(c.key);
      if (!s || s.px.length !== c.px.length || !s.px.every((v, j) => v === c.px[j])) {
        const at = place(c.w, c.h);
        pages[at[0]]!.g.putImageData(new ImageData(Uint8ClampedArray.from(c.px), c.w, c.h), at[1], at[2]);
        stored += c.w * c.h;
        if (stored > FX_MAX_STORED) throw new Error(`${id}: over ${FX_MAX_STORED} stored px (EFFECTS-CONTRACT.md budgets)`);
        s = { at, px: c.px };
        shared.set(c.key, s);
      }
      pieces.push({ sheet: s.at[0], r: [s.at[1], s.at[2], c.w, c.h], off: [c.x - pvx + off[0], c.y - pvy + off[1]] });
    }
    drawings.push(pieces);
  }
}

/** The game's effects: loaded at start, played by id, drawn in the actors' pass with her. */
export class Fx {
  private loaded = new Map<string, FxLoaded>();
  readonly clock: FxClock;

  private constructor(loaded: Map<string, FxLoaded>) {
    this.loaded = loaded;
    this.clock = new FxClock(new Map([...loaded].map(([id, l]) => [id, l.def])));
  }

  /** Loads every present effect; one that breaks the contract is reported and left out. */
  static async load(r: WorldRenderer): Promise<Fx> {
    const loaded = new Map<string, FxLoaded>();
    await Promise.all(FX_PRESENT.map(async (id) => {
      try {
        loaded.set(id, await loadFx(r, id));
      } catch (e) {
        console.warn(`fx: ${id} left out:`, e instanceof Error ? e.message : e);
      }
    }));
    return new Fx(loaded);
  }

  /** No effects (tests, a renderer-less game). */
  static none(): Fx {
    return new Fx(new Map());
  }

  play(id: string, o: FxSpawn = {}): FxHandle {
    return this.clock.play(id, o);
  }

  /** Plays one already `from` ticks in, at `rate` (fx/contract.ts FxClock.playFrom: her slash trail carried on). */
  playFrom(id: string, o: FxSpawn, from: number, rate = 1): FxCarry {
    return this.clock.playFrom(id, o, from, rate);
  }

  tick(): void {
    this.clock.tick();
  }

  clear(): void {
    this.clock.clear();
  }

  get size(): number {
    return this.loaded.size;
  }

  /** Per effect and drawing, its painted box about the pivot in drawing px ([x0, y0, x1, y1]; null: empty). */
  private boxes = new Map<string, ([number, number, number, number] | null)[]>();

  /**
   * (rfinish 10-22, Dex: "the ult is outside of frame") The world box (px) the live effects whose id starts with one
   * of `prefixes` cover right now (their drawings' painted cells, at `a` world px per art px, her ART_PX), for a
   * camera that keeps them in frame; null when none is drawn. Attach "her" effects are left out (they ride her).
   * `ahead` (round 4, reduced motion's held framings): the box of every drawing they have still to show, from now to
   * their end (one waiting on its delay too), so a held frame chosen now holds all of them.
   */
  extent(prefixes: readonly string[], a: number, ahead = false): { x0: number; y0: number; x1: number; y1: number } | null {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const e of this.clock.live) {
      if ((e.t < 0 && !ahead) || e.stopped || e.attach === "her" || !prefixes.some((p) => e.def.id.startsWith(p))) continue;
      const l = this.loaded.get(e.def.id);
      const now = fxFrameAt(e.def, Math.max(0, e.t));
      if (now === null || !l) continue;
      const A = a * e.def.px;
      // (a loop: all of its drawings)
      for (let i = ahead && e.def.loop ? 0 : now, last = ahead ? e.def.frames.length - 1 : now; i <= last; i++) {
        const b = this.box(e.def.id, l.drawings, i);
        if (!b) continue;
        const ex0 = e.facing < 0 ? e.x - b[2] * A : e.x + b[0] * A, ex1 = e.facing < 0 ? e.x - b[0] * A : e.x + b[2] * A;
        x0 = Math.min(x0, ex0);
        x1 = Math.max(x1, ex1);
        y0 = Math.min(y0, e.y + b[1] * A);
        y1 = Math.max(y1, e.y + b[3] * A);
      }
    }
    return x1 > x0 ? { x0, y0, x1, y1 } : null;
  }

  /** Drawing i's painted box about the pivot in drawing px (cached; null: empty). */
  private box(id: string, drawings: readonly (readonly FxPiece[] | undefined)[], i: number): [number, number, number, number] | null {
    let bs = this.boxes.get(id);
    if (!bs) this.boxes.set(id, (bs = []));
    let b = bs[i];
    if (b === undefined) {
      let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
      for (const d of drawings[i] ?? []) {
        bx0 = Math.min(bx0, d.off[0]);
        by0 = Math.min(by0, d.off[1]);
        bx1 = Math.max(bx1, d.off[0] + d.r[2]);
        by1 = Math.max(by1, d.off[1] + d.r[3]);
      }
      b = bs[i] = bx1 > bx0 ? [bx0, by0, bx1, by1] : null;
    }
    return b;
  }

  /**
   * Draws the live effects of a layer on the play plane's transform for this pass (`view`), at `a` world px per art px
   * (her ART_PX), each pivot snapped like her drawings'. `her`: her soles and facing (for attach "her"); `reflection`:
   * the lake's pass (effects with reflect false are left out). `ground`: the ground effects' dip into the ground and the
   * world's ground (fx/contract.ts fxGroundClip), left out in the lake's pass; `follow`: the ground effects that are cut
   * at the ground under each part of them (fxGroundStrips: wide ones on uneven ground), not only under the pivot;
   * `drape`: low ground effects (dust rolling along the floor, rubble) whose every strip also sits on the ground under it
   * (down a stair, up a slope; none where there is no ground near: never floating over a drop); `erode`: draped effects
   * whose ends where the ground stops under them taper off (fxGroundEnds / fxErodeKeep), not cut flat; `fine`: draped
   * effects laid on a slope in strips of 2 columns, not 8 (rigid ones: the rubble). An
   * effect at px 2-4 is drawn at that many art px a drawing px. Leaves the transform at the view's.
   */
  draw(
    r: WorldRenderer, view: PlayView, layer: FxLayer, a: number, her: { x: number; y: number; facing: number }, reflection = false,
    ground: { dip: number; ids: readonly string[]; at: (x: number, y: number) => number | null; follow?: readonly string[]; drape?: readonly string[]; erode?: readonly string[]; erodeSpan?: number; erodeH?: number; fine?: readonly string[] } | null = null,
  ): void {
    // the ground under a column (world x), near the effect's own ground line: a step up or down, not a ledge far below;
    // `high`: also a slope or a cliff top rising well above the line (a tall effect is hidden behind its front edge)
    const cols = new Map<number, number | null>();
    const colGround = (x: number, line: number, high: boolean): number | null => {
      const k = (Math.round(x / 2) * 4096 + Math.round(line)) * 2 + (high ? 1 : 0);
      let g = cols.get(k);
      if (g === undefined) {
        let y = ground!.at(x, line - 2.5 * H);
        if (high && (y === null || y > line + 3 * H)) y = ground!.at(x, line - 5 * H);
        g = y !== null && y <= line + 3 * H ? y : null;
        cols.set(k, g);
      }
      return g;
    };
    for (const e of this.clock.live) {
      // (a stopped effect is gone from the frame at once, even while the clock is frozen: R's letter on the impact)
      if (e.layer !== layer || e.t < 0 || e.stopped || (reflection && !e.def.reflect)) continue;
      const i = fxFrameAt(e.def, e.t);
      const l = this.loaded.get(e.def.id);
      const pieces = i === null ? undefined : l?.drawings[i];
      if (!pieces || !l || i === null) continue;
      const onHer = e.attach === "her";
      const facing = onHer ? her.facing : e.facing;
      const px = onHer ? her.x : e.x, py0 = onHer ? her.y : e.y;
      const clipY = ground && !reflection && view.mirror === null ? fxGroundClip(e.def.id, px, py0, ground.ids, ground.at, ground.dip * a) : null;
      // dipped like her drawing (an effect spawned at her soleY is dipped already)
      const py = clipY === null ? py0 : Math.max(py0, clipY + ground!.dip * a);
      // world px per drawing px (px 2-4: a big world effect seen pulled out)
      const A = a * e.def.px;
      const xf = artTransform(view, r.camX, r.camY, px, py, A);
      const flip = facing < 0, fade = fxFade(e);
      const opacity = fade < 1 ? (e.def.frames[i]!.opacity ?? 1) * fade : e.def.frames[i]!.opacity;
      const drape = clipY !== null && !!ground!.drape?.some((p) => e.def.id.startsWith(p));
      const follow = drape || (clipY !== null && !!ground!.follow?.some((p) => e.def.id.startsWith(p)));
      // (round 4) where the ground stops under an eroded piece (the skirt): the ends over the whole drawing (its cells
      // side by side: a ledge can fall between two of them), in world x, where it tapers off down to the ground over
      // `erodeSpan` world px, cut to `erodeH` world px x the keep (one line for every piece lying there)
      let ends: [number, number][] | null = null;
      const dir = flip ? -1 : 1;
      if (drape && ground!.erode?.some((p) => e.def.id.startsWith(p))) {
        let e0 = Infinity, c1 = -Infinity;
        for (const d of pieces) {
          e0 = Math.min(e0, d.off[0]);
          c1 = Math.max(c1, d.off[0] + d.r[2]);
        }
        const xs = px + dir * e0 * A;
        const col = (c: number): number | null => colGround(xs + dir * c * A, clipY!, false);
        // (every column looked at: a ledge anywhere under it, not only where three samples fall)
        const runs: [number, number, number | null][] = [];
        for (let c = 0; c < c1 - e0; c++) {
          const g = col(c + 0.5), last = runs[runs.length - 1];
          if (last && (last[2] === null) === (g === null)) last[1] = c + 1;
          else runs.push([c, c + 1, g]);
        }
        const found = runs.length > 1 ? fxGroundEnds(runs, col) : [];
        ends = found.length ? found.map(([at, side]) => [xs + dir * at * A, side * dir]) : null;
      }
      const span = ground?.erodeSpan ?? 150, eh = ground?.erodeH ?? 140;
      r.setTransform(xf.z, xf.focus, view.mirror);
      // (the screen column / row a drawing x / y lands on: the renderer's own rounding, world/render/renderer.ts sx, sy)
      const screenX = (xd: number): number => {
        const v = Math.round(xd) - r.camX;
        return xf.z === 1 ? v : Math.round((v - xf.focus[0]) * xf.z + xf.focus[0]);
      };
      const screenY = (yd: number): number => {
        const v = Math.round(yd) - r.camY;
        return xf.z === 1 ? v : Math.round((v - xf.focus[1]) * xf.z + xf.focus[1]);
      };
      // every cell on the same pivot transform: the drawing's art px land on one grid, seamless
      for (const d of pieces) {
        const sheet = l.sheets[d.sheet];
        if (!sheet) continue;
        const [sx, sy, sw, sh0] = d.r;
        if (follow) {
          // cut strip by strip at the ground under it (a step up hides what is behind it, a step down shows it)
          // (round 4) a rigid draped piece (the rubble: ground.fine) in strips of 2 columns: on a slope or a stair it lies
          // along the ground as a whole (a fine skew), where 8-column strips each lifted on their own broke its slabs
          // into a sawtooth; soft dust keeps its 8-column strips (cheap, and a sawtooth does not show in it). Strips
          // lifted the same whole drawing px are drawn as one
          const x0 = flip ? px - d.off[0] * A : px + d.off[0] * A;
          const fine = drape && !!ground!.fine?.some((p) => e.def.id.startsWith(p));
          let runs = fxGroundStrips(x0, sw, A, dir, (x) => colGround(x, clipY!, !drape), fine ? 2 : 8);
          if (drape && runs.length > 1) runs = fxMergeLifts(runs, clipY!, A);
          for (const [c0, c1, g] of runs) {
            // draped: the strip moves with the ground under it (whole drawing px) and is cut at its own floor line
            if (drape && g === null) continue;
            const lift = drape ? Math.round((g! - clipY!) / A) : 0;
            const sh = g === null ? sh0 : fxClipRows(sh0, d.off[1], Math.round(py), drape ? clipY! : g, A);
            if (sh <= 0) continue;
            const y = xf.q[1] + d.off[1] + lift;
            if (ends) {
              // column by column near an end: only its rows up to `keep` of the drawing's height over the floor. A cut
              // column's top lands on the screen row the renderer rounds it to (world/render/renderer.ts sy) and starts
              // its texture there (a part of a row), so it samples the very rows the whole drawing does: zoomed out
              // (reduced) the cut columns showed as vertical streaks, each column sampling its rows at its own phase
              const Y0 = screenY(y);
              const keep = (c: number): number => fxErodeKeep(px + dir * (d.off[0] + c + 0.5) * A, ends!, span, 8 * A);
              const cut = (c: number): number => {
                const k = keep(c);
                return k >= 1 ? 0 : Math.max(0, Math.min(sh, Math.ceil((-k * eh) / A - d.off[1])));
              };
              for (let c = c0; c < c1; ) {
                // (the columns cut alike drawn as one)
                const skip = cut(c);
                let c2 = c + 1;
                while (c2 < c1 && cut(c2) === skip) c2++;
                if (skip < sh) {
                  // its width: up to where the next segment starts on the screen (each quad's own rounding left a 1 px
                  // gap every few columns at an in-between scale, showing as streaks once reduced)
                  const dx = flip ? xf.q[0] - (d.off[0] + c2) : xf.q[0] + d.off[0] + c;
                  const w = xf.z === 1 ? c2 - c : (screenX(dx + c2 - c) - screenX(dx)) / xf.z;
                  const sf = skip === 0 || xf.z === 1 ? skip : (screenY(y + skip) - Y0) / xf.z;
                  if (w > 0 && sh - sf > 0) r.sprite({ sheet, sx: sx + c, sy: sy + sf, sw: w, sh: sh - sf, x: dx, y: y + skip, flip, lit: 0, opacity });
                }
                c = c2;
              }
              continue;
            }
            // (round 4: its width up to where the next strip starts on the screen, no 1 px gap between strips)
            const dx = flip ? xf.q[0] - (d.off[0] + c1) : xf.q[0] + d.off[0] + c0;
            const w = xf.z === 1 || runs.length === 1 ? c1 - c0 : (screenX(dx + c1 - c0) - screenX(dx)) / xf.z;
            if (w > 0) r.sprite({ sheet, sx: sx + c0, sy, sw: w, sh, x: dx, y, flip, lit: 0, opacity });
          }
          continue;
        }
        const sh = clipY === null ? sh0 : fxClipRows(sh0, d.off[1], Math.round(py), clipY, A);
        if (sh <= 0) continue;
        const dx = flip ? xf.q[0] - (d.off[0] + sw) : xf.q[0] + d.off[0];
        // (cutoffs 10-21) tile: the cell's far edges where the transform puts them, so cells meet with no see-through
        // hairline where an art px is more than a frame px (the close band, the R's cut-in, 1440p / 4K)
        r.sprite({ sheet, sx, sy, sw, sh, x: dx, y: xf.q[1] + d.off[1], flip, lit: 0, opacity, tile: true });
      }
    }
    r.setTransform(view.s, view.focus, view.mirror);
  }
}

// reed-shallows (refs w03 + w01), the backdrop of B1 Reed Shallows (lane R-B):
// the first near encounter with scale. The same lake as the arrival, late
// morning with the sun breaking through, the reflections at their strongest,
// and a colossus wading the shallows at depth 8, close enough that its legs
// stand in the water in front of the far shore. Each foot throws a ring; once
// per pass the weight leg plants mid-frame and a big ring races across the
// whole lake and washes through the reeds at the boardwalk (and the room's
// controller shakes the camera 1 px, off in reduced motion). Spray tears off
// a lifted foot; water streams off it; the reflection breaks in the ripples.
// The ring hangs far behind in the west, the spire sits small on the east
// horizon. At the player plane: the yard's stone stair, the old boardwalk
// with its broken gap, the reed channel, the steps up to the causeway.
//
// The room (src/world/rooms/plain/b1.ts) builds its collision from the same
// numbers (reed-shallows/geo.ts). Default export: the /scenes/ preview at the
// boardwalk framing; reedShallows(true) is the world backdrop (its rows
// follow the camera up the stair).

import { Flock, moveAfter, Motes, Pix, disc, fogBand, mist, rangeProfile, shaft, shaftFn, sky, smooth, terrain, fbm1, hashInt, f, type LayerDef, type SceneDef, type BuildCtx } from "../engine/index.ts";
import { EyeGlint, Wheelers } from "./colossus-plain/systems.ts";
import type { ColossusDef } from "./colossus-plain/colossus.ts";
import { EXT, Spray, Track, WalkClock, bodyGlsl, camYGlsl, crossing, farRingGlsl, passWindow, ringsGlsl, spireGlsl, wadeFrontGlsl, type FeedColossus } from "./causeway/shared.ts";
import { B1, SPAN, geo, type Geo } from "./reed-shallows/geo.ts";
import { buildShore } from "./reed-shallows/land.ts";
import { reeds } from "./reed-shallows/reeds.ts";
import { shallows } from "./reed-shallows/water.ts";

export const TITLE = "reed-shallows";
const GHOST_DEPTH = 28;
const RAY_DEPTH = 22;

interface Walkers {
  main: ColossusDef;
  ghost: ColossusDef;
  /** Layer row of the water surface at the main colossus's depth. */
  surface: number;
  feed: FeedColossus[];
}

const cache = new WeakMap<BuildCtx, Walkers>();

/** The two walkers for a build context (the prelude and build must agree). */
function walkers(ctx: BuildCtx, g: Geo): Walkers {
  const hit = cache.get(ctx);
  if (hit) return hit;
  const d = B1.colDepth;
  const S = 0.625 * g.u;
  const surface = g.LY(g.waterY(d), d);
  // it wades: its feet stand on the bottom, about 34 design units under the surface
  const main = crossing(g.W, g.reach(d, 6), { S, vd: 22, gap: 10, startAt: 0.86, T: 4.4, seed: 7, dendrites: true, ground: surface + Math.round(34 * S) });
  const gs = 0.2 * g.u;
  const ghost = crossing(g.W, g.reach(GHOST_DEPTH, 6), { S: gs, vd: 13, gap: 44, startAt: -0.3, T: 5.6, seed: 23, dendrites: false, ground: g.LY(g.waterY(GHOST_DEPTH), GHOST_DEPTH) + Math.round(6 * gs) });
  const feed: FeedColossus[] = [
    { name: "main", c: main, depth: d, pass: passWindow(main, g.W * 0.5) },
    { name: "ghost", c: ghost, depth: GHOST_DEPTH, pass: [1e9, 1e9] },
  ];
  const w = { main, ghost, surface, feed };
  cache.set(ctx, w);
  return w;
}

export function reedShallows(inWorld: boolean): SceneDef {
  return {
    title: TITLE,
    palette: {
      sun: ["#e6dcb4", "#f4ecd0", "#fdf8e8"],
      haze: ["#5b7774", "#7a9590", "#9fb3a8", "#c6cdb8", "#e8e2c4"],
      cloud: ["#6d8584", "#869b97", "#a2b3aa", "#c4ccbc"],
      far: ["#44605f", "#526f6e", "#64807c", "#7a918a"],
      ringdark: ["#2c3c3f", "#34484b", "#3e5356", "#4a5f60"],
      ringlit: ["#8e8a6a", "#c2b684", "#e8dca8"],
      spire: ["#0e1216", "#161c21", "#20282e"],
      storm: ["#2a3038", "#363d47", "#444c57", "#555d68"],
      red: ["#5a1c18", "#a8352a", "#e0604a"],
      water: ["#14302f", "#1c403d", "#27544f", "#346a62", "#4c877a"],
      glint: ["#7fb0a2", "#c2e0cc", "#f6f0d4"],
      foam: ["#8fb3a8", "#c5dccf", "#eef2e2"],
      beam: ["#6f7456", "#a9a276", "#dcd2a2", "#f8eec6"],
      reed: ["#162017", "#222e1c", "#324127", "#465632", "#667244"],
      reedhead: ["#26190f", "#3a2818", "#523a23"],
      flesh: ["#3d5357", "#566d6f", "#7a8e8a", "#a5b3aa", "#d4d9c6"],
      tar: ["#0a0f11", "#11191c", "#1a2528", "#28373a", "#415150"],
      vein: ["#46302c", "#6a3b33", "#8e4f40", "#ad6a50"],
      dust: ["#4a5a58", "#5f706c", "#798882", "#95a299", "#b6bcad"],
      glintc: ["#a6b8ae", "#dfe8dc", "#fbfbf2"],
      wood: ["#0c1011", "#151b1d", "#222a2a", "#39413d", "#62624f"],
      stone: ["#0e1315", "#182022", "#253033", "#3a4747", "#5f6b62"],
      moss: ["#16211a", "#1f2e22", "#2c3f2b", "#3f5536"],
      earth: ["#101413", "#181e1c", "#232a27", "#333b36", "#4a5249"],
      iron: ["#07090b", "#101417", "#1d2326", "#39403f"],
      buoy: ["#3a1512", "#6a241c", "#98392a"],
      bird: ["#1c2628", "#2a3739"],
      standin: ["#06080a", "#0d1216", "#26303a", "#e6d8a8"],
    },
    fog: {
      stops: [
        [0.0, "#2f474c"],
        [0.2, "#4d6a6b"],
        [0.45, "#8aa39b"],
        [0.56, "#c6ceb5"],
        [0.6, "#dcd9bb"],
        [0.62, "#a9b8a8"],
        [0.75, "#6d8984"],
        [1.0, "#3d5753"],
      ],
      bands: 16,
      dither: 0.45,
      density: 0.1,
      max: 0.78,
      glow: { x: 0.28, y: 0.13, r: 0.6, colour: "#efe3b8", strength: 0.45, steps: 5, dither: 0.16 },
    },
    span: () => SPAN,
    driftPeriod: 120,

    prelude: (ctx) => {
      const g = geo(ctx, inWorld);
      const wk = walkers(ctx, g);
      return /* glsl */ `
${camYGlsl(inWorld, 0)}
${ringsGlsl(wk.feed, g.W)}
${shaftFn({ fn: "ray", from: [g.W * 0.29, g.H * 0.16], to: [g.W * 0.2, g.H * 0.72], w0: g.H * 0.05, w1: g.H * 0.18, streaks: 7, speed: 0.03, fadeStart: 0.6, intensity: 0.8 })}
// breaks of sun drifting across water and land, in world space (positive in a break)
float sunBreak(float wx, float depth) {
  float tm = uTime * (1.0 - 0.6 * uReduced);
  float n = fbm(vec2((wx + tm * 45.0) / 1100.0, depth / 9.0 + 1.0), 3);
  return smoothstep(0.54, 0.62, n);
}
float sceneLight(vec2 s, float depth) {
  float l = 0.0;
  if (depth < 70.0) {
    float wx = (s.x + layerOff(depth) - ${f(g.W / 2)}) * max(depth, 1.0);
    l += floor(sunBreak(wx, depth) * 2.0 + 0.5) * 0.05 * (1.0 - smoothstep(30.0, 70.0, depth));
  }
  l += ray(s + vec2(layerOff(${f(RAY_DEPTH)}), 0.0)) * 0.22 * smoothstep(1.5, 6.0, depth);
  return l;
}`;
    },

    build: (ctx) => {
      const g = geo(ctx, inWorld);
      const { W, H, u, hor } = g;
      const L: LayerDef[] = [];
      const R = (n: string): number => ctx.row(n);
      const wide = (d: number): { x: number; w: number } => {
        const w = ctx.panWidth(d) + 8;
        return { x: -Math.ceil((w - W) / 2), w };
      };
      const wk = walkers(ctx, g);
      const { main, ghost } = wk;

      // --- sky, sun, the ring behind, cloud ----------------------------------------------
      L.push(sky({ reflect: hor }));
      L.push(disc({ name: "sun", x: W * 0.28, y: H * 0.12, r: H * 0.05, row: "sun", halo: { r: 2.2, strength: 0.4, steps: 5, seam: 0.2 }, reflect: hor, dither: 0.3 }));
      L.push({
        kind: "glsl",
        name: "ring",
        depth: 140,
        fog: 0.35,
        reflect: hor,
        body: farRingGlsl({ cx: -W * 0.12, cy: H * 0.5, R: H * 0.46, thick: H * 0.07, tilt: 0.36, rot: -0.28, row: "ringdark", lit: "ringlit", fog: 0.2, gap: [5.1, 5.55] }),
        bounds: { y0: 0, y1: hor + 1, x0: -W * 0.2, x1: W * 0.42 },
      });
      L.push(
        mist({
          name: "high-cloud",
          depth: 90,
          y0: -10,
          y1: H * 0.4,
          sx: 240 * u,
          sy: 16 * u,
          drift: -4 * (u / 2),
          evolve: 0.07,
          cover: 0.52,
          warp: 1.6,
          levels: 4,
          alpha: 0.62,
          edgeDither: 0.35,
          row: "cloud",
          tone: 0.4,
          tonePerLevel: 0.12,
          tint: 0.55,
          lightGain: 0.3,
          reflect: hor,
        }),
      );
      L.push({
        kind: "glsl",
        name: "spire",
        depth: 180,
        fog: 0.45,
        reflect: hor,
        body: spireGlsl({ x: W * 1.02, base: hor + 1, h: H * 0.2, w: 3 * u, lean: 0.08, row: "spire", cloud: "storm", red: "red", fog: 0.25 }),
        bounds: { x0: W * 0.9, x1: W * 1.2, y0: hor - H * 0.32, y1: hor + 2 },
      });
      L.push(
        mist({
          name: "veil",
          depth: 32,
          y0: -12,
          y1: H * 0.46,
          softTop: 4,
          sx: 150 * u,
          sy: 30 * u,
          drift: -5 * (u / 2),
          evolve: 0.09,
          cover: 0.46,
          warp: 1.7,
          levels: 4,
          alpha: 0.5,
          edgeDither: 0.35,
          row: "haze",
          tone: 0.3,
          tonePerLevel: 0.14,
          tint: 0.55,
          lightGain: 0.5,
          reflect: hor,
        }),
      );

      // far hills: low on the left (under the ring), the plain's long edge on the right
      {
        const d = 30;
        const { x, w } = wide(d);
        const pix = new Pix(w, H);
        const base = g.LY(g.waterY(d), d) + 1;
        const left = rangeProfile({ base, amp: H * 0.1, scale: 70 * u, seed: 211, sharp: 0.45 });
        const right = (X: number): number => base - (H * 0.035 + 5 * u * fbm1(X / (60 * u), 212, 3));
        const top = (px: number): number => {
          const X = px + x;
          const lm = smooth(W * 0.42, W * 0.12, X);
          const rm = smooth(W * 0.5, W * 0.72, X);
          const h = Math.max((base - left(X)) * lm, (base - right(X)) * rm);
          return h < 1 ? 1e9 : base - h;
        };
        terrain(pix, {
          row: R("far"),
          top,
          bottom: () => base,
          seed: 213,
          scale: 26 * u,
          light: [-0.7, -1],
          base: 0.45,
          contrast: 0.35,
          strata: 0.2,
          fog: (_px, py) => 0.1 + 0.35 * smooth(hor - H * 0.08, base, py),
        });
        L.push({ kind: "pix", name: "far-hills", depth: d, fog: 0.42, pix, x, y: 0, reflect: base, reflectFade: 30 * u, dither: 0.3 });
      }

      // the ghost on the far shore, then the haze bank its feet stand in
      const track: ConstructorParameters<typeof Track>[0] = [];
      const ghostBounds = { y0: ghost.ground - 350 * ghost.S, y1: g.LY(g.waterY(GHOST_DEPTH), GHOST_DEPTH) + 1, x0: 0, x1: 0 };
      track.push({ c: ghost, bounds: ghostBounds, ext: EXT, margin: 4 });
      L.push({
        kind: "glsl",
        name: "ghost",
        depth: GHOST_DEPTH,
        fog: 0.6,
        body: bodyGlsl(ghost, { farFog: 0.2, rearFog: 0.35, groundFog: 0.45, key: [-0.5, 0.6, 0.3], fill: 0.06 }),
        bounds: ghostBounds,
        dither: 0.2,
        reflect: ghostBounds.y1,
        reflectFade: 50 * u,
        reflectDim: 0.1,
      });
      L.push(
        fogBand({
          name: "horizon-haze",
          depth: 24,
          y0: hor - H * 0.06,
          y1: hor + 3,
          softBottom: 1,
          sx: 170 * u,
          sy: 9 * u,
          drift: -3 * (u / 2),
          cover: 0.62,
          alpha: 0.65,
          levels: 4,
          row: "haze",
          tone: 0.5,
          tint: 0.3,
          lightGain: 1,
          reflect: hor,
        }),
      );

      // --- the lake ------------------------------------------------------------------------
      L.push(
        shallows({
          horizon: hor,
          G0: g.wl,
          ref: g.ref,
          dFar: 60,
          row: "water",
          glintRow: "glint",
          foamRow: "foam",
          reflFar: 0.92,
          reflNear: 0.5,
          shear: 3 * u,
          jitter: 1.5 * u,
          glints: 0.005,
          u,
          dither: 0.5,
          rings: true,
          shoals: 0.8,
        }),
      );

      // far reed beds on the water, low and dark, with a few old posts
      L.push(
        reeds({
          name: "far-reeds",
          depth: 14,
          base: g.LY(g.waterY(14), 14),
          clumps: [
            [-W * 0.02, 70 * u, 7 * u],
            [W * 0.3, 40 * u, 5 * u],
            [W * 0.78, 90 * u, 8 * u],
            [W * 1.04, 60 * u, 6 * u],
          ],
          spacing: 2,
          row: "reed",
          headRow: "reedhead",
          heads: 0.05,
          reflect: g.LY(g.waterY(14), 14),
          reflectFade: 10 * u,
          fog: 0.28,
          wash: true,
        }),
      );

      // --- the colossus, wading ------------------------------------------------------------
      const d = B1.colDepth;
      const mainBounds = { y0: -1e6, y1: wk.surface + 1, x0: 0, x1: 0 };
      track.push({ c: main, bounds: mainBounds, ext: EXT, margin: 4 });
      L.push({ kind: "points", name: "tracker", depth: d, system: new Track(track) });
      L.push({ kind: "points", name: "walk-clock", depth: d, system: new WalkClock(TITLE, wk.feed) });
      L.push({
        kind: "glsl",
        name: "colossus",
        depth: d,
        fog: 0.1,
        body: bodyGlsl(main, { farFog: 0.2, rearFog: 0.45, groundFog: 0.05, groundH: 50, key: [-0.55, 0.7, 0.45], fill: 0.04 }),
        bounds: mainBounds,
        dither: 0.15,
        reflect: wk.surface,
        reflectFade: 150 * u,
        reflectDim: 0.06,
      });
      L.push({ kind: "points", name: "spray", depth: d, fog: 0.12, system: new Spray(main, wk.surface, { foam: R("foam"), water: R("glint") }, 1.2), reflect: wk.surface });
      L.push({ kind: "points", name: "wheelers", depth: d, fog: 0.25, system: new Wheelers(main, R("bird"), 7, ctx.rng) });
      L.push({ kind: "points", name: "eye-glint", depth: d, blend: "add", system: new EyeGlint(main, R("glintc"), 1.5) });
      L.push(
        fogBand({
          name: "wade-haze",
          // the haze drifts in front of the colossus' feet: nearer than it (d), so it is drawn over it
          depth: d - 0.5,
          y0: wk.surface - 16 * u,
          y1: wk.surface + 2,
          softTop: 10 * u,
          softBottom: 2,
          sx: 140 * u,
          sy: 6 * u,
          drift: -4 * (u / 2),
          evolve: 0.05,
          cover: 0.4,
          alpha: 0.3,
          levels: 3,
          row: "haze",
          tone: 0.5,
          tint: 0.35,
          lightGain: 0.9,
        }),
      );

      // the sun's ray to the water, and motes in it
      L.push(shaft({ name: "ray", depth: RAY_DEPTH, fn: "ray", row: "beam", steps: 3, alpha: 0.28 }));

      // --- mid distance: reed islands, an old mooring line with buoys ----------------------
      L.push(
        reeds({
          name: "island-reeds",
          depth: 4.2,
          base: g.LY(g.waterY(4.2), 4.2),
          clumps: [
            [-W * 0.08, 60 * u, 22 * u],
            [W * 0.12, 26 * u, 16 * u],
            [W * 0.62, 34 * u, 18 * u],
            [W * 0.9, 50 * u, 24 * u],
            [W * 1.12, 40 * u, 18 * u],
          ],
          spacing: 3,
          row: "reed",
          headRow: "reedhead",
          heads: 0.12,
          reflect: g.LY(g.waterY(4.2), 4.2),
          reflectFade: 24 * u,
          fog: 0.06,
          wash: true,
        }),
      );
      {
        const dd = 2.4;
        const { x, w } = wide(dd);
        const pix = new Pix(w, H + Math.ceil(g.ref / dd) + 8);
        const base = g.LY(g.waterY(dd), dd);
        const posts: number[] = [];
        for (let X = -W * 0.05; X < W * 1.2; X += (60 + 30 * hashInt(Math.round(X), 1, 3)) * u) posts.push(Math.round(X));
        const top = (i: number): number => base - Math.round((14 + 10 * hashInt(i, 2, 3)) * u);
        posts.forEach((X, i) => {
          const px = X - x;
          const lean = (hashInt(i, 4, 3) - 0.5) * 0.25;
          for (let y = top(i); y < base + 2 * u; y++) {
            const lx = Math.round(px + (base - y) * lean);
            pix.set(lx, y, y === top(i) ? 0.45 : 0.22, R("wood"));
            pix.set(lx + 1, y, 0.1, R("wood"));
            if (u >= 2) pix.set(lx + 2, y, 0.08, R("wood"));
          }
          // the old line: a sagging rope to the next post with a buoy halfway
          const nx = posts[i + 1];
          if (nx === undefined || hashInt(i, 5, 3) < 0.3) return;
          const a = [px + 1, top(i) + 3 * u], b = [nx - x + 1, top(i + 1) + 3 * u];
          const len = b[0]! - a[0]!;
          for (let k = 0; k <= len; k++) {
            const t = k / len;
            const y = Math.round(a[1]! + (b[1]! - a[1]!) * t + Math.sin(Math.PI * t) * 6 * u);
            pix.set(a[0]! + k, y, 0.3, R("wood"));
          }
          const bx = Math.round(a[0]! + len * 0.5);
          const by = base - Math.round(1.5 * u);
          for (let yy = -2 * u; yy <= u; yy++) for (let xx = -2 * u; xx <= 2 * u; xx++) if (xx * xx + yy * yy * 1.4 <= 4 * u * u) pix.set(bx + xx, by + yy, yy < 0 && xx < 0 ? 0.8 : 0.45, R("buoy"));
        });
        L.push({ kind: "pix", name: "mooring-line", depth: dd, pix, x, y: 0, reflect: base, reflectFade: 30 * u, dither: 0 });
      }
      L.push(
        mist({
          name: "water-mist",
          depth: 3,
          y0: g.LY(hor + 4 * u, 3),
          y1: g.LY(hor + 40 * u, 3),
          sx: 110 * u,
          sy: 6 * u,
          drift: 6 * (u / 2),
          evolve: 0.06,
          cover: 0.24,
          warp: 1.8,
          levels: 4,
          alpha: 0.4,
          edgeDither: 0.35,
          row: "haze",
          tone: 0.46,
          tonePerLevel: 0.12,
          tint: 0.5,
          lightGain: 1.2,
        }),
      );
      L.push({
        kind: "points",
        name: "beam-motes",
        depth: RAY_DEPTH,
        blend: "add",
        system: new Motes({ region: [W * 0.1, H * 0.2, W * 0.36, hor], count: Math.round(60 * u), row: R("beam"), shade: [0.45, 0.99], vel: [-1.2 * (u / 2), 1.4 * (u / 2)], wander: 2.5 * (u / 2), size: 1, twinkle: 0.35 }, ctx.rng),
      });

      // --- the player plane: the yard's stair, the boardwalk, the channel banks, the east bank
      {
        const x0 = g.X(B1.x0) - 12;
        const x1 = g.X(B1.x1) + 12;
        const y0 = g.Y(B1.yard + 0.6);
        const y1 = g.Y(B1.bottom - 0.4);
        const pix = new Pix(x1 - x0, y1 - y0);
        buildShore(pix, g, x0, y0, { wood: R("wood"), stone: R("stone"), moss: R("moss"), earth: R("earth"), iron: R("iron") });
        L.push({ kind: "pix", name: "shore", depth: 1, pix, x: x0, y: y0, reflect: g.Y(B1.water), reflectFade: 40 * u, dither: 0 });
      }
      L.push({ kind: "character", name: "figure", depth: 1, x: g.X(90), ground: g.Y(B1.deck), rimDir: [-1, -1], height: g.P });

      // --- in front: the water you wade through (the gap and the channel), reeds along the near water
      {
        const surf = g.Y(B1.water);
        const spans: [number, number][] = [
          [g.X(B1.gap[0]), g.X(B1.gap[1])],
          [g.X(B1.channel[0]), g.X(B1.channel[1])],
        ];
        L.push({ kind: "glsl", name: "wade-front", depth: 1, body: wadeFrontGlsl({ spans, surface: surf, depth: Math.round(g.P * 0.42), row: "water", lit: "glint", alpha: 0.72 }), bounds: { x0: spans[0]![0], x1: spans[1]![1], y0: surf - 3, y1: surf + g.P } });
      }
      L.push(
        reeds({
          name: "near-reeds",
          depth: 0.8,
          base: g.LY(H + 6 * u, 0.8),
          clumps: [
            [-W * 0.15, 40 * u, 38 * u],
            [W * 0.1, 30 * u, 30 * u],
            [W * 0.55, 16 * u, 22 * u],
            [W * 0.86, 36 * u, 40 * u],
            [W * 1.2, 44 * u, 36 * u],
          ],
          spacing: 4,
          width: Math.max(1, Math.round(u)),
          row: "reed",
          headRow: "reedhead",
          heads: 0.18,
          wash: true,
          pass: "front",
        }),
      );
      L.push({
        kind: "points",
        name: "seeds",
        depth: 1.4,
        system: new Motes({ region: [-40, H * 0.3, W + 40, H], count: Math.round(22 * u), row: R("glint"), shade: [0.3, 0.8], vel: [8, -2], wander: 3, size: 1, twinkle: 0.2 }, ctx.rng),
      });
      L.push({
        kind: "points",
        name: "birds",
        depth: 16,
        system: new Flock({ y: [H * 0.2, H * 0.36], x: [-40, W + 40], every: 40, speed: 12 * u, count: [3, 6], row: R("bird"), shade: 0.2 }),
      });
      // the spire (180) is farther than the ring (140): it sits behind it
      moveAfter(L, "spire", "sun");
      // the mooring line (2.4) is nearer than the water mist (3)
      moveAfter(L, "mooring-line", "water-mist");
      return L;
    },
  };
}

export default reedShallows(false);

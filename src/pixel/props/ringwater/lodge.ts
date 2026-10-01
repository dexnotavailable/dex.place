// The keeper's lodge from outside, and the yard shrine's arch (WORLD-PLAN A2,
// A4).
//
// lodgeFacade: the end wall of the lodge on its cliff shelf, seen from the top
// of the cliff stair (A2: the reveal) or from the yard (A4): a stone footing,
// log walls, a warm window, the roof's eave and a stovepipe with a thread of
// smoke, so the house reads as lived in before you open its door. The door
// leaf is the kit door (lodgeDoor) at the same x as `door`: the facade cuts the
// opening for it (reveal, lintel log, stone sill, a small hood), so the door is
// built into the logs, not pasted on them. Origin: the wall's foot,
// at the door side's corner; `side` +1 puts the wall to the right of the
// origin (A4: the lodge is west of the yard, so -1 there).
//
// shrineArch: two stone posts and a timber lintel over the yard shrine; the
// map banner hangs from the lintel on its rod (place the kit's mapBanner at
// `hang`), knotted red cords at the posts. Chips and mends.

import "./materials.ts";
import { Spring } from "../../motion.ts";
import { P_DRAG, P_FADE, P_RISE } from "../../bodies.ts";
import { defineRecipe } from "../../prop.ts";
import type { Part } from "../../part.ts";

interface FacadeRefs {
  wall: Part;
  smoke: number;
  pipe: [number, number];
}

export const lodgeFacade = defineRecipe<{ width: number; height: number; side: 1 | -1; window: boolean; windowAt: number; door: number; porch: boolean; woodpile: number[] }, FacadeRefs>({
  id: "lodgeFacade",
  breakage: "never",
  reason: "The keeper's lodge on its shelf: seen from outside, a warm window and smoke from the stove say someone is home before the door opens.",
  defaults: { width: 3.2, height: 4.6, side: 1, window: true, windowAt: 0.55, door: 0, porch: true, woodpile: [] },
  cues: ["wood.hit"],
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const W = u(p.width), Ht = u(p.height), eave = u(0.5);
    const GW = W + eave, GH = Ht + u(0.9);
    const s = p.side < 0 ? -1 : 1;
    // grid x runs away from the door side; mirror by flipping the part. The sun is up and to the
    // right in every Ringwater room: in grid terms that is +x when s = 1 and -x when s = -1.
    const sunGridRight = s > 0;
    const wall = b.part("wall", { w: GW, h: GH, pivot: [0, GH], at: [0, 0], layer: "bg", z: 2 });
    const top = GH - Ht;
    const foot = u(0.45);
    // stone footing: rough dressed blocks in the cliff's own stone, moss along its top
    wall.bricks(0, GH - foot, W, foot, { bw: u(0.34), bh: u(0.15), mat: "ringFooting", mortar: "mortar", seed: p.seed, bevel: 2, tones: [0, -1, 0, 1], jitter: 0.5 });
    wall.rect(0, GH - foot, W, 1, { mat: "ringFooting", mode: "paint", tone: 1 });
    for (let x = 1; x < W - 1; x++) if (b.rand() < 0.35) wall.rect(x, GH - foot - (b.rand() < 0.4 ? 1 : 0), 1, 2, { mat: "moss", z: 3, noInk: true });
    // log courses with notched corners at the door side, clay chinking between them
    const logH = u(0.24);
    let course = 0;
    for (let y = top; y < GH - foot; y += logH, course++) {
      const low = GH - foot - y < logH * 2.2; // the splash zone: the lowest logs are darker
      wall.rect(0, y, W, logH, { mat: "woodDark", profile: "cylH", piece: "log", tone: low ? -1 : 0 });
      wall.rect(0, y, W, 1, { mat: "woodDark", mode: "paint", tone: 1 });
      wall.rect(0, y + logH - 1, W, 1, { mat: "ringChink", mode: "paint", tone: course % 3 === 0 ? -1 : 0 });
      wall.rect(-2, y + 1, u(0.14), logH - 2, { mat: "wood", profile: "dome", r: 3, z: 1, piece: "notch" });
      wall.rect(-1, y + (logH >> 1), 2, 1, { mat: "wood", mode: "paint", tone: -1 });
    }
    wall.grain({ dir: "h", seed: p.seed + 1, stretch: 22, mats: ["woodDark"] });
    // checks along the logs
    for (let k = 0; k < Math.round(W / 9); k++) {
      const cy = top + Math.floor(b.rand() * (Ht - foot)), cx = Math.floor(b.rand() * (W - 12));
      wall.rect(cx, cy, 4 + Math.floor(b.rand() * 9), 1, { mat: "woodDark", mode: "paint", tone: -2 });
    }
    // the roof: a heavy eave over the wall's top, dark shingles in courses, a lit edge
    wall.poly([-u(0.2), top + u(0.1), W + eave, top + u(0.1), W + eave, top - u(0.08), W * 0.1, top - u(0.9) + 6, -u(0.2), top - u(0.9) + 6], { mat: "soot", profile: "bevel", r: 3, depth: 4, piece: "roof" });
    for (let y = top - u(0.8), r = 0; y < top + u(0.1); y += 4, r++) {
      wall.line(-u(0.2), y, W + eave, y + 1, { mat: "soot", mode: "paint", tone: -1 });
      for (let x = -u(0.2) + (r % 2) * 5; x < W + eave; x += 10) wall.rect(x, y + 1, 1, 3, { mat: "soot", mode: "paint", tone: -1 });
    }
    wall.rect(-u(0.2), top + u(0.08), W + eave + u(0.2), 2, { mat: "wood", profile: "cylH", z: 1, piece: "fascia" });
    // the shadow the eave throws on the top logs
    wall.rect(0, top + u(0.1) + 2, W, 3, { mat: "woodDark", mode: "paint", tone: -2 });
    // the window, warm from inside, set back in a deep frame with a sill and a box of herbs
    if (p.window) {
      const wx = Math.round(W * p.windowAt), wy = top + u(0.9), ww = u(0.6), wh = u(0.7);
      wall.rect(wx - 3, wy - 3, ww + 6, wh + 6, { mat: "wood", profile: "bevel", r: 2, depth: 3, z: 2, piece: "frame" });
      wall.rect(wx, wy, ww, wh, { mat: "lampGlass", profile: "flat", z: 3, piece: "glass" });
      wall.rect(wx, wy, ww, 2, { mat: "soot", profile: "flat", z: 3, piece: "glass" });
      wall.rect(sunGridRight ? wx : wx + ww - 2, wy + 2, 2, wh - 2, { mat: "lampGlass", mode: "paint", tone: -1 });
      wall.rect(wx + (ww >> 1) - 1, wy, 2, wh, { mat: "wood", profile: "cylV", z: 4, piece: "muntin" });
      wall.rect(wx, wy + (wh >> 1) - 1, ww, 2, { mat: "wood", profile: "cylH", z: 4, piece: "muntin" });
      wall.rect(wx - u(0.1), wy - u(0.1), ww + u(0.2), u(0.08), { mat: "woodDark", profile: "cylH", z: 3, piece: "lintel" });
      wall.rect(wx - 5, wy + wh + 3, ww + 10, 3, { mat: "wood", profile: "bevel", r: 1, z: 3, piece: "sill" });
      wall.rect(wx - 2, wy + wh + 6, ww + 4, u(0.1), { mat: "wood", profile: "bevel", r: 1, depth: 2, z: 3, piece: "planter", tone: -1 });
      for (let x = wx - 1; x < wx + ww + 2; x++) {
        const hh = 2 + Math.floor(b.rand() * 4);
        wall.rect(x, wy + wh + 6 - hh, 1, hh, { mat: b.rand() < 0.12 ? "flowerRose" : "grass", z: 4, noInk: true, tone: b.rand() < 0.3 ? 1 : 0 });
      }
      // rain has streaked the logs under the planter
      for (let k = 0; k < 3; k++) wall.rect(wx + 3 + Math.floor(b.rand() * (ww - 6)), wy + wh + 6 + u(0.1), 1, u(0.2 + b.rand() * 0.3), { mat: "woodDark", mode: "paint", tone: -1 });
      b.light({ part: "wall", at: [wx + ww / 2, wy + wh / 2], colour: [1, 0.66, 0.36], radius: u(1.6), intensity: 0.45, flicker: 0.2 });
      b.glow({ part: "wall", at: [wx + ww / 2, wy + wh / 2], colour: [1, 0.6, 0.3], radius: u(0.5), intensity: 0.22, flicker: 0.2 });
    }
    // the doorway, built into the wall (the kit door's leaf and casing sit inside it): the logs
    // and the footing are cut for it, the reveal shows the wall's thickness (the inner face toward
    // the sun catches it, the head sits in the lintel's shadow), a squared lintel log runs past
    // both sides into the logs, a stone sill at the threshold, a small shingled hood on brackets
    if (p.door > 0) {
      const cx = u(p.door);
      const FW = u(0.94), FH = u(1.54); // the kit door's casing (0.7 + 2 x 0.12 by 1.4 + 0.14)
      const rx = cx - (FW >> 1) - 4, rw = FW + 8, ry = GH - FH - 5;
      wall.rect(rx, ry, rw, GH - ry, { mat: "soot", profile: "flat", z: 3, piece: "reveal", noInk: true });
      const litX = sunGridRight ? rx : rx + rw - 4;
      const darkX = sunGridRight ? rx + rw - 4 : rx;
      wall.rect(litX, ry + 5, 4, GH - ry - 5, { mat: "woodDark", profile: "flat", z: 3, piece: "reveal" });
      wall.rect(sunGridRight ? litX : litX + 3, ry + 5, 1, GH - ry - 5, { mat: "woodDark", mode: "paint", tone: 1 });
      wall.rect(darkX, ry, 4, GH - ry, { mat: "soot", profile: "flat", z: 3, piece: "reveal", tone: -1 });
      // the log ends cut by the opening: a pale end-grain sliver on each course beside it
      for (let y = top; y < GH - foot; y += logH) {
        if (y + logH <= ry) continue;
        for (const ex of [rx - 1, rx + rw]) wall.rect(ex, Math.max(y, ry) + 2, 1, logH - 4, { mat: "wood", mode: "paint", tone: 1 });
      }
      // the lintel: a squared log with end grain, its shadow on the wall below
      const lw = rw + u(0.36), lx = rx - u(0.18), lh = u(0.17), ly = ry - lh;
      wall.rect(lx, ly, lw, lh, { mat: "woodDark", profile: "bevel", r: 2, depth: 4, z: 4, piece: "lintel" });
      wall.rect(lx, ly, lw, 1, { mat: "woodDark", mode: "paint", tone: 2 });
      for (const ex of [lx, lx + lw - 3]) wall.rect(ex, ly + 2, 3, lh - 4, { mat: "wood", profile: "dome", r: 2, z: 5, piece: "lintel" });
      wall.rect(lx, ly + lh, rx - lx, 2, { mat: "woodDark", mode: "paint", tone: -2 });
      wall.rect(rx + rw, ly + lh, lx + lw - rx - rw, 2, { mat: "woodDark", mode: "paint", tone: -2 });
      if (p.porch) {
        const hy = ly - u(0.04), hx0 = lx - u(0.1), hx1 = lx + lw + u(0.1);
        wall.poly([hx0, hy, hx1, hy, hx1 - u(0.06), hy - u(0.24), hx0 + u(0.06), hy - u(0.24)], { mat: "soot", profile: "bevel", r: 2, depth: 4, z: 6, piece: "hood" });
        for (let y = hy - u(0.22); y < hy; y += 3) wall.line(hx0 + 2, y, hx1 - 2, y, { mat: "soot", mode: "paint", tone: -1 });
        wall.rect(hx0, hy, hx1 - hx0, 2, { mat: "wood", profile: "cylH", z: 7, piece: "hood" });
        for (const bx of [lx + 4, lx + lw - 8]) wall.stroke([bx, ly + lh + u(0.28), bx + 4, hy + 1], 2, { mat: "woodDark", z: 5, piece: "bracket" });
      }
      // the sill: a dressed stone slab at the threshold, wider than the opening, worn in its middle
      wall.rect(rx - 4, GH - 4, rw + 8, 4, { mat: "ringFooting", profile: "bevel", r: 1, depth: 3, z: 4, piece: "sill" });
      wall.rect(rx + 6, GH - 4, rw - 12, 1, { mat: "ringFooting", mode: "paint", tone: 1 });
    }
    // firewood stacked against the wall (from, to in H along it): split log ends in staggered rows
    // under a board, the bark rims dark, the cut faces lit toward the sun
    if (p.woodpile.length === 2) {
      const [a0, a1] = p.woodpile as [number, number];
      const x0 = u(a0), x1 = u(a1), ph = u(0.62), r = u(0.075);
      wall.rect(x0 - 2, GH - ph - 4, x1 - x0 + 4, 3, { mat: "woodDark", profile: "bevel", r: 1, depth: 2, z: 6, piece: "woodpile" });
      wall.rect(x0, GH - ph, x1 - x0, ph, { mat: "soot", profile: "flat", z: 4, piece: "woodpile", tone: -1 });
      for (let row = 0, y = GH - r - 1; y > GH - ph + r - 1; row++, y -= r * 2 - 2) {
        for (let x = x0 + r + (row % 2) * r; x < x1 - r + 1; x += r * 2) {
          const tone = b.rand() < 0.3 ? -1 : b.rand() < 0.2 ? 1 : 0;
          wall.circle(x, y, r, { mat: "wood", profile: "dome", r: 2, depth: 2, z: 5, piece: "woodpile", tone });
          wall.ring(x, y, r - 1, r, { mat: "woodDark", z: 6, piece: "woodpile" });
          wall.pixels([[x, y]], { mat: "woodDark", z: 7 });
        }
      }
    }
    // the stovepipe through the roof
    const px = Math.round(W * 0.8);
    wall.rect(px, top - u(0.95), u(0.1), u(0.6), { mat: "iron", profile: "cylV", z: 2, piece: "pipe" });
    wall.rect(px - 2, top - u(0.98), u(0.1) + 4, 3, { mat: "iron", profile: "cylH", z: 3, piece: "cap" });
    wall.speckle({ amount: 0.06, seed: p.seed + 2, tone: -1, mats: ["woodDark"] });
    if (s < 0) b.get("wall").flip = -1;
    return { wall: b.get("wall"), smoke: 0, pipe: [px + u(0.05), top - u(1.0)] };
  },
  initial: "home",
  states: {
    home: {
      update(c, dt) {
        const r = c.refs;
        r.smoke -= dt;
        if (r.smoke > 0) return;
        r.smoke = 0.35 + c.rand() * 0.3;
        const [x, y] = r.wall.toWorld(r.pipe[0], r.pipe[1]);
        if (!c.world.inView(x, y, c.params.H * 2)) return;
        const g = 118 + Math.floor(c.rand() * 24);
        const [wx] = c.world.windAt(x, y);
        c.world.particles.spawn({ x, y, vx: -3 + wx * 0.02 + (c.rand() - 0.5) * 3, vy: -9 - c.rand() * 5, life: 2.4 + c.rand() * 1.6, rgb: [g, g - 2, g + 8], flags: P_RISE | P_DRAG | P_FADE });
      },
      hit: () => undefined,
    },
  },
  demo: {
    w: 6,
    params: { side: 1, door: 0.6 },
    script: [{ label: "the lodge from outside: smoke, a warm window", wait: 3 }],
  },
});

// ---------------------------------------------------------------------------

interface ArchRefs {
  arch: Part;
  shake: Spring;
}

export const shrineArch = defineRecipe<{ width: number; height: number }, ArchRefs>({
  id: "shrineArch",
  breakage: "heal",
  reason: "The yard shrine's gate: people hang what matters from it; here, the map, rolled and tied with a red cord.",
  defaults: { width: 2.6, height: 3.55 },
  cues: ["stone.hit"],
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const W = u(p.width), Ht = u(p.height), pw = u(0.22);
    const a = b.part("arch", { w: W + u(0.4), h: Ht, pivot: [(W + u(0.4)) >> 1, Ht], at: [0, 0], layer: "bg", z: 3, smoothRotate: true });
    const x0 = u(0.2);
    for (const x of [x0, x0 + W - pw]) {
      a.rect(x, u(0.2), pw, Ht - u(0.2), { mat: "stone", profile: "bevel", r: 3, depth: 4, piece: "post" });
      a.rect(x - 2, Ht - u(0.16), pw + 4, u(0.16), { mat: "stoneDark", profile: "bevel", r: 2, depth: 3, z: 1, piece: "base" });
      for (let y = u(0.6); y < Ht - u(0.3); y += u(0.42)) a.rect(x, y, pw, 1, { mat: "stone", mode: "paint", tone: -2 });
      a.cracks(x + (pw >> 1), Ht - u(0.5), { n: 1, len: 6, seed: p.seed + x });
      // a knotted red cord round each post
      a.rect(x - 1, u(0.9), pw + 2, 3, { mat: "clothRed", profile: "cylH", z: 2, piece: "cord" });
      a.pixels([[x + pw + 1, u(0.9) + 3], [x + pw + 1, u(0.9) + 5], [x + pw + 2, u(0.9) + 6]], { mat: "clothRed", z: 2 });
    }
    // the lintel: a timber beam with upturned ends over a tie beam
    a.poly([0, u(0.02), W + u(0.4), u(0.02), W + u(0.3), u(0.18), u(0.1), u(0.18)], { mat: "woodDark", profile: "bevel", r: 3, depth: 4, z: 2, piece: "lintel" });
    a.rect(0, 0, W + u(0.4), 2, { mat: "woodDark", mode: "paint", tone: 1 });
    a.rect(x0 - 2, u(0.36), W + 4, u(0.1), { mat: "woodDark", profile: "cylH", z: 2, piece: "tie" });
    a.speckle({ amount: 0.12, seed: p.seed, tone: -1, scale: 2, mats: ["stone"] });
    a.rect(x0, Ht - u(0.24), pw, 3, { mat: "moss", mode: "under", z: 1 });
    return { arch: b.get("arch"), shake: new Spring(140, 9) };
  },
  initial: "idle",
  states: {
    idle: {
      update(c, dt) {
        const r = c.refs;
        if (r.shake.resting) return;
        r.shake.step(dt);
        r.arch.rot = Math.max(-0.02, Math.min(0.02, r.shake.x));
      },
      hit(c, h) {
        if (h.hit.type === "wind") return;
        c.refs.shake.impulse((h.hit.dir[0] < 0 ? -1 : 1) * 0.05);
        c.damage(h.hit);
      },
    },
  },
  demo: {
    w: 5,
    with: [{ id: "mapBanner", dx: 0, at: 3.37 }],
    script: [
      { label: "the arch with the rolled map", wait: 1 },
      { label: "slash the post: chips, mends", hit: "slash", from: -1.6, wait: 2 },
    ],
  },
});

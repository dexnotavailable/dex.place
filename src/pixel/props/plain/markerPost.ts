// Marker post with red cloth (lane R-B, B2; from the colossus-plain scene):
// an old leaning post with a crossbar, stuck in a little cairn at the road's
// edge, a strip of the route's red cloth knotted at its top that whips in
// the wind (harder toward the east, where the wind rises). These are the
// route marks across the plain. The post splinters and mends; a slash tears
// the cloth, which knits back after a while. Origin: the post's foot.

import type { Cloth } from "../../motion.ts";
import { hitCentre, type Hit } from "../../hits.ts";
import { defineRecipe, type Prop } from "../../prop.ts";
import type { Part } from "../../part.ts";
import "./materials.ts";

export interface MarkerParams {
  /** Post height and lean (H per H, + leans east). */
  height: number;
  lean: number;
  /** Cloth length in H. */
  cloth: number;
}

interface Refs {
  cloth: Cloth;
  part: Part;
  tornAt: number;
}

export const markerPost = defineRecipe<MarkerParams, Refs>({
  id: "markerPost",
  breakage: "heal",
  reason: "The route marks across the plain: old posts with a strip of the muted red cloth, whipping in the rising wind, so the way east reads without a word.",
  defaults: { height: 2.1, lean: 0.12, cloth: 0.55 },
  cues: ["cloth.tear", "wood.hit"],
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const hgt = u(p.height);
    const lean = p.lean;
    const w = u(0.9) + Math.round(hgt * Math.abs(lean));
    const px0 = u(0.45);
    const post = b.part("post", { w, h: hgt + u(0.12), pivot: [px0, hgt + u(0.1)], at: [0, 0], layer: "mid", z: 6 });
    const X = (y: number): number => px0 + (hgt + u(0.1) - y) * lean; // grid x of the post's axis at grid row y
    // the post: a weathered square timber, lit on its west face
    const pts: number[] = [X(u(0.1)), u(0.1), X(hgt + u(0.1)), hgt + u(0.1)];
    post.stroke(pts, [u(0.07), u(0.09)], { mat: "plainWood" });
    post.grain({ dir: "v", seed: p.seed, tone: -1, density: 0.3 });
    // crossbar with its lashing
    const cy = u(0.34);
    post.stroke([X(cy) - u(0.2), cy + 2, X(cy) + u(0.2), cy - 1], u(0.05), { mat: "plainWoodDark", z: 1 });
    post.rect(Math.round(X(cy)) - 2, cy - 3, 5, 6, { mat: "plainRope", profile: "flat", z: 2 });
    // the cairn at its foot
    const base = hgt + u(0.1);
    const stones: [number, number, number, number][] = [
      [-0.2, 0, 0.16, 0.1],
      [0.05, 0, 0.18, 0.12],
      [-0.08, -0.09, 0.14, 0.09],
      [0.14, -0.08, 0.1, 0.07],
    ];
    for (const [dx, dy, sw, sh] of stones) post.roundRect(px0 + u(dx), base + u(dy) - u(sh), u(sw), u(sh), 3, { mat: "plainStone", profile: "dome", r: 3, z: 2 });
    // the red strip, knotted near the top and streaming off it
    const tipX = X(u(0.14)) - px0, tipY = -hgt + u(0.04);
    const cw = u(p.cloth), ch = Math.max(5, u(0.09));
    const src = b.canvas(cw, ch);
    for (let x = 0; x < cw; x++) {
      const t = x / cw;
      const half = (ch / 2) * (1 - t * 0.55);
      src.rect(x, Math.round(ch / 2 - half), 1, Math.max(1, Math.round(half * 2)), { mat: "clothRed", profile: "flat", depth: 1 });
    }
    src.rect(0, 0, 2, ch, { mat: "clothRed", mode: "paint", tone: -1 });
    src.grid.computeNormals({ x0: 0, y0: 0, x1: src.grid.W - 1, y1: src.grid.Hh - 1 });
    const sp = Math.max(3, Math.round(ch / 2));
    const { cloth, part } = b.cloth("cloth", { src: src.grid, spacing: sp, x: tipX, y: tipY, pinTop: false, damping: 0.96, windGain: 3.2, stiffness: 1, foldGain: 1.2, sleep: 14, layer: "mid", room: [cw * 1.2, ch * 4, cw * 1.2, cw * 1.2] });
    for (let j = 0; j < cloth.rows; j++) {
      const k = j * cloth.cols;
      cloth.pin(k, cloth.p[k * 3]!, cloth.p[k * 3 + 1]!, 0);
    }
    part.z = 7;
    return { cloth, part, tornAt: -1 };
  },
  initial: "standing",
  states: {
    standing: { hit: (c, h) => onHit(c, h.hit) },
    torn: {
      sound: "cloth.tear",
      update(c) {
        if (c.age - c.refs.tornAt > 4.5) c.go("restoring");
      },
      hit: (c, h) => onHit(c, h.hit),
    },
    restoring: {
      enter(c) {
        c.world.tweens.add({ target: c.refs.part, key: "dissolve", to: 1, dur: 0.5, ease: "inOutSine" });
      },
      update(c) {
        const r = c.refs;
        if (c.t >= 0.55 && r.cloth.torn > 0) {
          r.cloth.reset();
          r.part.dissolveMode = 1;
          c.world.tweens.add({ target: r.part, key: "dissolve", to: 0, dur: 0.7, ease: "inOutSine" });
        }
      },
      after: [1.4, "standing"],
    },
  },
  demo: {
    w: 5,
    variants: [{ label: "leaning west", params: { lean: -0.1, height: 1.8 }, dx: 1.8 }],
    script: [
      { label: "still", wait: 0.8 },
      { label: "the wind rises", wind: 460, wait: 2.5 },
      { label: "dash wind", hit: "wind", from: -1.2, wait: 1 },
      { label: "slash: the strip tears, the post splinters", hit: "slash", from: -0.6, wait: 2 },
      { label: "restores", wind: 120, wait: 6 },
    ],
  },
});

function onHit(c: Prop<Refs>, hit: Hit): string | void {
  const r = c.refs;
  const H = c.params.H;
  const [x, y] = hitCentre(hit.shape);
  const f = hit.type === "wind" ? 1.6 : 2.6;
  r.cloth.push(x, y, H * 1.6, hit.dir[0] * f, hit.dir[1] * f * 0.4, f);
  if (hit.type === "wind") return;
  c.damage(hit, ["post"]);
  const res = c.cut(hit, { ropes: false });
  if (res.torn > 0) {
    r.tornAt = c.age;
    return "torn";
  }
}

// Prayer flags on a line (and the keeper's laundry line): a rope strung
// between two posts with cloth pieces clipped along it. The line sags and
// sways; the flags flutter with the wind (more as it rises, the causeway's
// rising wind made visible) and swing when a hit passes. A slash cuts the
// line: it falls with its flags, then after a few seconds fades, knits and
// comes back (restore). Origin: the left post's foot.

import type { Rope } from "../motion.ts";
import { defineRecipe, type Prop } from "../prop.ts";
import type { Part } from "../part.ts";
import { hitCentre, type Hit } from "../hits.ts";

export interface FlagParams {
  kind: "prayer" | "laundry";
  /** Span between the posts and the line's height, in H. */
  span: number;
  height: number;
  /** Draw the posts (off when the line ties to walls or rocks). */
  posts: boolean;
}

interface Refs {
  rope: Rope;
  line: Part;
  flags: { part: Part; k: number; phase: number }[];
  cutAt: number;
}

const PRAYER = ["clothRed", "clothPale", "clothTeal", "clothGold", "clothIndigo"];

export const prayerFlags = defineRecipe<FlagParams, Refs>({
  id: "prayerFlags",
  breakage: "heal",
  reason: "Lines of cloth that make the wind visible: prayer flags on the causeway and Stonetop flutter harder as the storm nears; the keeper's laundry in the yard says someone lives here.",
  defaults: { kind: "prayer", span: 3.2, height: 1.9, posts: true },
  cues: ["cloth.tear", "cloth.hit"],
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const span = u(p.span), ht = u(p.height);
    if (p.posts) {
      for (const [name, x] of [["postL", 0], ["postR", span]] as const) {
        const pw = u(0.08), ph = ht + u(0.12);
        const pp = b.part(name, { w: pw + 4, h: ph, pivot: [(pw + 4) >> 1, ph], at: [x, 0], layer: "mid", z: 6 });
        pp.rect(2, 2, pw, ph - 2, { mat: "wood", profile: "cylV" });
        pp.grain({ dir: "v", seed: p.seed + x, mats: ["wood"] });
        pp.rect(0, ph - u(0.1), pw + 4, u(0.1), { mat: "stone", profile: "bevel", r: 2, depth: 2, piece: "foot" });
        pp.rect(1, u(0.1), pw + 2, 3, { mat: "rope", profile: "cylH", z: 2, piece: "tie" });
      }
    }
    const segs = Math.max(8, Math.round(span / u(0.12)));
    const { rope, part: line } = b.rope("line", { from: [0, -ht + u(0.12)], to: [span, -ht + u(0.12)], segments: segs, slack: 1.05, mat: "rope", width: 2, pinStart: true, pinEnd: true, damping: 0.985, windGain: 0.6 });
    line.z = 7;
    // let it settle into its sag before anyone sees it
    for (let i = 0; i < 240; i++) rope.step(1 / 60, u(17.5));
    rope.x0.set(rope.x);
    rope.y0.set(rope.y);
    rope.px.set(rope.x);
    rope.py.set(rope.y);
    const flags: Refs["flags"] = [];
    const laundry = p.kind === "laundry";
    const every = laundry ? 3 : 1;
    let n = 0;
    for (let k = 2; k < rope.n - 2; k += every + (laundry ? 1 : 1)) {
      const name = `flag${n}`;
      let fw: number, fh: number;
      const pb = (() => {
        if (!laundry) {
          fw = u(0.11);
          fh = u(0.14);
          const f = b.part(name, { w: fw, h: fh, pivot: [fw >> 1, 0], at: [0, 0], layer: "mid", z: 8, smoothRotate: true });
          const m = PRAYER[n % PRAYER.length]!;
          f.rect(0, 0, fw, fh, { mat: m, profile: "flat", depth: 1 });
          f.rect(0, 0, fw, 2, { mat: m, mode: "paint", tone: -1 });
          f.pixels([[fw >> 1, (fh >> 1) - 1], [(fw >> 1) - 1, fh >> 1], [(fw >> 1) + 1, fh >> 1], [fw >> 1, (fh >> 1) + 1]], { mat: m, mode: "paint", tone: 1 });
          return f;
        }
        const piece = n % 3;
        fw = u(piece === 0 ? 0.36 : 0.24);
        fh = u(piece === 0 ? 0.4 : 0.3);
        const f = b.part(name, { w: fw, h: fh, pivot: [fw >> 1, 0], at: [0, 0], layer: "mid", z: 8, smoothRotate: true });
        const m = piece === 1 ? "clothIndigo" : piece === 2 ? "canvas" : "clothPale";
        if (piece === 1) {
          // a shirt: body and sleeves
          f.rect(u(0.04), 0, fw - u(0.08), fh, { mat: m, profile: "flat", depth: 1 });
          f.rect(0, 0, fw, u(0.1), { mat: m, profile: "flat", depth: 1 });
          f.rect((fw >> 1) - 1, 0, 2, u(0.06), { mat: m, mode: "paint", tone: -1 });
        } else {
          f.rect(0, 0, fw, fh, { mat: m, profile: "flat", depth: 1 });
          for (let y = 3; y < fh; y += 4) f.rect(0, y, fw, 1, { mat: m, mode: "paint", tone: -1 });
          f.rect(0, fh - 2, fw, 2, { mat: m, mode: "paint", tone: 1 });
        }
        f.rect(2, 0, 2, 3, { mat: "woodDark", profile: "flat", z: 2, piece: "peg" });
        f.rect(fw - 4, 0, 2, 3, { mat: "woodDark", profile: "flat", z: 2, piece: "peg" });
        return f;
      })();
      void pb;
      const part = b.get(name);
      part.worldSpace = true;
      flags.push({ part, k, phase: b.rand() * 6 });
      n++;
    }
    const refs: Refs = { rope, line, flags, cutAt: -1 };
    place(refs, 0, 0);
    return refs;
  },
  initial: "hanging",
  states: {
    hanging: {
      update: (c) => step(c),
      hit: (c, h) => onHit(c, h.hit),
    },
    cut: {
      sound: "cloth.tear",
      update(c) {
        step(c);
        if (c.t > 4.5) c.go("restoring");
      },
      hit: (c, h) => onHit(c, h.hit),
    },
    restoring: {
      enter(c) {
        for (const p of [c.refs.line, ...c.refs.flags.map((f) => f.part)]) c.world.tweens.add({ target: p, key: "dissolve", to: 1, dur: 0.5 });
      },
      update(c) {
        const r = c.refs;
        if (c.t >= 0.55 && r.rope.isCut) {
          r.rope.reset();
          r.line.tag["drawn"] = false;
          for (const p of [r.line, ...r.flags.map((f) => f.part)]) {
            p.dissolveMode = 1;
            c.world.tweens.add({ target: p, key: "dissolve", to: 0, dur: 0.7 });
          }
        }
        step(c);
      },
      after: [1.4, "hanging"],
    },
  },
  demo: {
    w: 6,
    params: { span: 3.4 },
    variants: [{ label: "laundry (keeper's yard)", params: { kind: "laundry", span: 2.2, height: 1.7 }, dx: -2.8 }],
    script: [
      { label: "still", wait: 1 },
      { label: "wind rising", wind: 260, wait: 2.5 },
      { label: "storm wind", wind: 700, wait: 2.5 },
      { label: "slash the line", hit: "slash", from: 1.3, face: -1, wait: 2.5 },
      { label: "calm", wind: 0, wait: 3 },
      { label: "restored", wait: 1.5 },
    ],
  },
});

function place(r: Refs, t: number, wind: number): void {
  const R = r.rope;
  for (const f of r.flags) {
    const k = f.k;
    f.part.x = Math.round(R.x[k]!);
    f.part.y = Math.round(R.y[k]!);
    // hang from the line; flutter grows with the wind (and never strobes)
    const w = Math.max(-1, Math.min(1, wind / 600));
    const flutter = Math.sin(t * (4 + Math.abs(w) * 8) + f.phase) * (0.05 + Math.abs(w) * 0.35);
    const onCut = R.cut[Math.max(0, k - 1)] || R.cut[Math.min(R.n - 2, k)];
    f.part.rot = onCut ? Math.atan2(R.y[k + 1]! - R.y[k - 1]!, R.x[k + 1]! - R.x[k - 1]!) * 0.5 : -w * 1.1 + flutter;
  }
}

function step(c: Prop<Refs>): void {
  const r = c.refs;
  const mid = r.rope.n >> 1;
  const [wx] = c.world.windAt(r.rope.x[mid]!, r.rope.y[mid]!);
  if (r.rope.sleeping && Math.abs(wx) < 1) return;
  place(r, c.world.time, wx);
}

function onHit(c: Prop<Refs>, hit: Hit): string | void {
  const r = c.refs;
  const H = c.params.H;
  const [x, y] = hitCentre(hit.shape);
  const f = hit.type === "wind" ? 2 : 3.5;
  r.rope.push(x, y, H * 1.6, hit.dir[0] * f, hit.dir[1] * f - 1);
  if (hit.type === "wind" || c.state !== "hanging") return;
  const res = c.cut(hit, { cloth: false });
  // cut: each half hangs from its post with its flags
  if (res.cut > 0) return "cut";
}

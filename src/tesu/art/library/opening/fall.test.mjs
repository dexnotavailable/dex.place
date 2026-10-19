// The fall's cloud family (the fall loop, round 1: op.fallcloud): every kind paints something, stays inside its
// declared bounds, is deterministic and seamless across tiles; it uses the whole value range of Dex's refs (deep
// recesses, not a pale band); a deck's gaps are clear sky right through it; a streak is one band (its light runs
// across its thickness), never a row of identical ovals.
//   node --test src/tesu/art/library/opening/fall.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import "./index.ts";
import { painter, ctxFor } from "../../painter.ts";
import { IdxBuf } from "../../raster.ts";
import { P, hexOf } from "../../palette.ts";

const CASES = [
  [{ kind: "tower", w: 420, h: 520, lean: -0.1, sky: 0.8 }, [1, 0.5]],
  [{ kind: "cumulus", w: 460, h: 200, tower: 0.6, sky: 0.4 }, [1, 0.5]],
  [{ kind: "cumulus", w: 200, h: 64, tower: 0.45, far: 0.85, sky: 0.15 }, [1, 0.5]],
  [{ kind: "streak", w: 420, h: 60, far: 0.2, sky: 0.3, count: 3 }, [1, 0.5]],
  [{ kind: "wisp", w: 420, h: 60, sky: 1, count: 2 }, [1, 0.5]],
  [{ kind: "deck", w: 900, h: 120, sky: 0.3, gaps: [[0.2, 0.08]] }, [1, 0.5]],
];

function paintBox(p, level, x0, y0, w, h, seed = 4242) {
  const buf = new IdxBuf(w, h, x0, y0, level);
  painter("op.fallcloud").paint(ctxFor(buf, level, 0, 0, seed), p);
  return buf;
}
const whole = (p, level, seed = 4242) => {
  const [bx0, by0, bx1, by1] = painter("op.fallcloud").bounds(p);
  const x0 = Math.floor(bx0 * level) - 4, y0 = Math.floor(by0 * level) - 4;
  const w = Math.ceil(bx1 * level) - x0 + 8, h = Math.ceil(by1 * level) - y0 + 8;
  return { buf: paintBox(p, level, x0, y0, w, h, seed), x0, y0, w, h, b: [bx0, by0, bx1, by1] };
};
const lum = (i) => {
  const v = parseInt(hexOf(i).slice(1), 16);
  return 0.2126 * ((v >> 16) & 255) + 0.7152 * ((v >> 8) & 255) + 0.0722 * (v & 255);
};

for (const [p, levels] of CASES) {
  test(`op.fallcloud ${JSON.stringify(p).slice(0, 70)}: paints, in bounds, deterministic, seamless`, () => {
    for (const level of levels) {
      const { buf, x0, y0, w, h, b } = whole(p, level);
      let n = 0;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (!buf.px[y * w + x]) continue;
        n++;
        const ax = x0 + x, ay = y0 + y;
        assert.ok(ax > Math.floor(b[0] * level) + 1 && ax < Math.ceil(b[2] * level) - 1 && ay > Math.floor(b[1] * level) + 1 && ay < Math.ceil(b[3] * level) - 1,
          `pixel on or outside the bounds at level ${level}: ${ax},${ay} (bounds ${b.map((v) => v.toFixed(0))}): it would be cut straight`);
      }
      assert.ok(n > 200, `painted only ${n} px at level ${level}`);
      assert.deepEqual(paintBox(p, level, x0, y0, w, h).px, buf.px, `not deterministic at ${level}`);
      const mx = x0 + Math.floor(w / 2) + 3, my = y0 + Math.floor(h / 2) - 5;
      for (const [tx0, ty0, tx1, ty1] of [[x0, y0, mx, my], [mx, y0, x0 + w, my], [x0, my, mx, y0 + h], [mx, my, x0 + w, y0 + h]]) {
        const t = paintBox(p, level, tx0, ty0, tx1 - tx0, ty1 - ty0);
        for (let y = ty0; y < ty1; y++) for (let x = tx0; x < tx1; x++) assert.equal(t.get(x, y), buf.get(x, y), `seam at level ${level}, ${x},${y}`);
      }
    }
  });
}

test("op.fallcloud: the near cumulus spans the refs' range (a lit crown, deep recesses); a far one is compressed toward the sky", () => {
  const span = (p) => {
    const { buf } = whole(p, 1);
    let lo = 255, hi = 0;
    const seen = new Set();
    for (const c of buf.px) if (c) seen.add(c);
    for (const c of seen) { lo = Math.min(lo, lum(c)); hi = Math.max(hi, lum(c)); }
    return [lo, hi];
  };
  const [nlo, nhi] = span({ kind: "cumulus", w: 460, h: 200, tower: 0.6, sky: 0.4 });
  assert.ok(nhi > 240 && nlo < 125, `near cumulus luminance ${nlo.toFixed(0)}-${nhi.toFixed(0)} (the ref tower: 38-241; round 0: 149-247)`);
  const [flo] = span({ kind: "cumulus", w: 200, h: 64, tower: 0.45, far: 0.85, sky: 0.15 });
  assert.ok(flo > 170, `far cumulus darkest ${flo.toFixed(0)}: distance compresses toward the sky`);
});

test("op.fallcloud: a deck's gap is clear right through it; the deck is no ruled slab (its base wanders)", () => {
  const p = { kind: "deck", w: 900, h: 120, sky: 0.3, gaps: [[0.2, 0.08]] };
  const { buf, x0, y0, w, h } = whole(p, 1);
  // a column through the gap's middle: nothing painted in the layer's body
  const gx = Math.round(0.2 * p.w) - x0;
  let inGap = 0;
  for (let y = 0; y < h; y++) if (buf.px[y * w + gx]) inGap++;
  assert.ok(inGap < 6, `${inGap} px painted down the gap's middle`);
  // the lowest painted row per column varies by more than a few px across the deck (torn, hanging masses)
  const feet = [];
  for (let x = Math.round(-0.35 * p.w) - x0; x < Math.round(0.1 * p.w) - x0; x += 7) {
    let f = -1;
    for (let y = h - 1; y >= 0; y--) if (buf.px[y * w + x]) { f = y; break; }
    if (f >= 0) feet.push(f);
  }
  assert.ok(Math.max(...feet) - Math.min(...feet) > 10, `the base spans only ${Math.max(...feet) - Math.min(...feet)} px: ruled`);
  void y0;
});

test("op.fallcloud: a streak is lit along its top and cool along its underside, as one band", () => {
  const p = { kind: "streak", w: 420, h: 60, far: 0.2, sky: 0.3, count: 3 };
  const { buf, w, h } = whole(p, 1);
  let top = 0, topN = 0, bot = 0, botN = 0;
  for (let x = 0; x < w; x++) {
    let a = -1, b = -1;
    for (let y = 0; y < h; y++) if (buf.px[y * w + x]) { if (a < 0) a = y; b = y; }
    if (a < 0 || b - a < 4) continue;
    top += lum(buf.px[(a + 1) * w + x]); topN++;
    bot += lum(buf.px[(b - 1) * w + x]); botN++;
  }
  assert.ok(topN > 50 && top / topN > bot / botN + 12, `top ${(top / topN).toFixed(0)} vs underside ${(bot / botN).toFixed(0)}`);
  assert.ok(P.fallcu.length === 13 && P.fallfar.length === 5 && P.fallsky.length === 6);
});

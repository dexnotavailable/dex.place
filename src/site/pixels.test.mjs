// node --test: every pixel icon is well-formed and renders to crisp SVG.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ICONS, framesOf, pixelPaths, pixelSvg, validateIcon } from "./pixels.ts";

test("every icon is rectangular, same-sized across frames, known keys only", () => {
  for (const [name, icon] of Object.entries(ICONS)) {
    const { width, height } = validateIcon(name, icon);
    assert.ok(width >= 5 && width <= 16, `${name} width ${width}`);
    assert.ok(height >= 5 && height <= 16, `${name} height ${height}`);
  }
});

test("run-length paths cover exactly the painted pixels", () => {
  for (const [name, icon] of Object.entries(ICONS)) {
    for (const grid of framesOf(icon)) {
      const painted = grid.join("").replaceAll(".", "").length;
      let covered = 0;
      for (const d of pixelPaths(grid).values()) {
        for (const m of d.matchAll(/M\d+ \d+h(\d+)/g)) covered += Number(m[1]);
      }
      assert.equal(covered, painted, `${name}: ${covered} of ${painted} pixels`);
    }
  }
});

test("svg has fixed integer size, crisp edges and is decorative unless labelled", () => {
  const svg = pixelSvg("download", { scale: 3 });
  assert.match(svg, /width="33" height="33"/);
  // Dark-site glyphs: solid shapes with holes that follow the text colour.
  assert.match(svg, /fill="var\(--px-a,currentColor\)"/);
  assert.match(svg, /shape-rendering="crispEdges"/);
  assert.match(svg, /aria-hidden="true"/);
  const labelled = pixelSvg("heart", { label: 'a "heart" & <3' });
  assert.match(labelled, /role="img" aria-label="a &quot;heart&quot; &amp; &lt;3"/);
  const animated = pixelSvg("blob");
  assert.match(animated, /class="px px--blob px--anim"/);
  assert.equal((animated.match(/class="px-f px-f\d"/g) ?? []).length, 2);
});

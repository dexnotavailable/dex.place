// node --test: the page's stage (Dex 10-19, the redesign: premium web motion; GSAP + ScrollTrigger + Lenis approved).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = (p) => readFileSync(new URL(p, import.meta.url), "utf8");

test("stage plan: every entrance kind lands where the page has it, eased, smooth (no pixel steps)", async () => {
  const { ENTER_KINDS, planOf, restOf, parseEnter, startOf, isAhead, ITEMS } = await import("./motion/stage-plan.ts");
  assert.deepEqual([...ENTER_KINDS].sort(), ["band", "card", "fade", "paper", "rise"]);
  for (const kind of ENTER_KINDS) {
    for (const from of ["left", "right", "up", "down"]) {
      const p = planOf(kind, from);
      assert.ok(p.duration >= 0.6 && p.duration <= 1.4, `${kind}: ${p.duration}s`);
      assert.doesNotMatch(p.ease, /steps/, `${kind}: smooth`);
      assert.ok(p.at > 0.8 && p.at <= 1, `${kind}: starts as it comes up the screen`);
      const rest = restOf(p.from);
      for (const [k, v] of Object.entries(rest)) assert.equal(v, k === "opacity" || k.startsWith("scale") ? 1 : 0, `${kind} ${k} rests`);
      assert.equal(rest.transformOrigin, undefined);
    }
  }
  // the white grounds come from their own side, the whole width; the bands draw across from theirs
  assert.equal(planOf("paper", "left").from.xPercent < -100, true);
  assert.equal(planOf("paper", "right").from.xPercent > 100, true);
  assert.equal(planOf("band", "right").from.transformOrigin, "100% 50%");
  assert.equal(planOf("band", "left").from.scaleX, 0);
  // cards: up with a little turn from their side, and a row staggers
  assert.ok(planOf("card", "left").from.rotate < 0 && planOf("card", "right").from.rotate > 0);
  assert.ok(planOf("card").stagger > 0);
  // a paper's items come in once it is most of the way across
  assert.ok(ITEMS.after > 0.2 && ITEMS.after < 0.8);
  // attributes: unknown kinds are ignored, the side defaults to left
  assert.equal(parseEnter("wobble", "left"), null);
  assert.deepEqual(parseEnter("paper", undefined), { kind: "paper", from: "left" });
  assert.deepEqual(parseEnter("band", "right"), { kind: "band", from: "right" });
  // only what is still below its line is set back (what is on the screen, or above, never disappears)
  const p = planOf("rise");
  assert.equal(isAhead(900, 800, p), true);
  assert.equal(isAhead(400, 800, p), false);
  assert.equal(isAhead(-300, 800, p), false);
  // a thing at the page's foot that can never reach its line still comes in
  assert.match(startOf(p), /^clamp\(top \d+%\)$/);
});

test("stage plan: the lean is small, follows the scroll's speed both ways, and is nothing when the page is still", async () => {
  const { leanOf } = await import("./motion/stage-plan.ts");
  assert.equal(leanOf("lag", 0), 0);
  assert.equal(leanOf("skew", 0), 0);
  assert.equal(leanOf("lag", Number.NaN), 0);
  assert.ok(leanOf("lag", 1500) < 0 && leanOf("lag", -1500) > 0, "lag trails the scroll");
  assert.ok(leanOf("skew", 1500) > 0 && leanOf("skew", -1500) < 0);
  assert.ok(Math.abs(leanOf("lag", 1e6)) <= 22 && Math.abs(leanOf("skew", 1e6)) <= 3, "clamped");
  assert.ok(Math.abs(leanOf("lag", 1e6, 0.5)) <= 11, "k scales it");
});

test("stage wiring: lazy, after the mark and idle, never with reduced motion / Save-Data / an embed; one event name with lane F", () => {
  const main = src("./main.ts");
  assert.match(main, /if \(reduced\.matches \|\| saveData \|\| root\.dataset\.embed\) return;/);
  assert.match(main, /afterMark\(\)\.then\(idle\)\.then\(\(\) => import\("\.\/motion\/stage\.ts"\)\)/);
  assert.doesNotMatch(main, /from "gsap|from "lenis/, "the libraries never land in the main bundle");
  const stage = src("./motion/stage.ts");
  const way = stage.match(/WAY_IN_EVENT = "([^"]+)"/)[1];
  assert.equal(way, src("./motion/enter.ts").match(/ENTER_EVENT = "([^"]+)"/)[1], "the stage drops a glide when a way in starts");
  assert.doesNotMatch(stage, /from "\.\/enter\.ts"/, "the opening's audio never rides in the stage chunk");
  // the smooth wheel leaves dialogs, popovers, frames and nested scrollers alone, and rides GSAP's ticker
  assert.match(stage, /prevent: \(node\) => node\.matches\("dialog, \[popover\], iframe, \[data-lenis-prevent\]"\)/);
  assert.match(stage, /allowNestedScroll: true/);
  assert.match(stage, /gsap\.ticker\.add\(\(time\) => lenis\.raf\(time \* 1000\)\)/);
  assert.match(stage, /lenis\.on\("scroll", ScrollTrigger\.update\)/);
  // touch screens keep their own scroll; reduced motion switched on later puts everything back
  assert.match(stage, /const lenis = fine\.matches \? smoothWheel\(root\) : null;/);
  assert.match(stage, /mm\.add\("\(prefers-reduced-motion: no-preference\)"/);
  // nothing GSAP set is left on a thing once it has landed
  assert.match(stage, /clearProps: CLEAR/);
});

test("stage CSS: breathing adds to the transform (never replaces it), rests off screen, and stops with reduced motion; nothing hidden by CSS", () => {
  const css = src("./styles/stage.css");
  for (const kind of ["float", "sway", "pulse", "glow"]) assert.match(css, new RegExp(`\\[data-breathe="${kind}"\\] \\{ animation: br-${kind} `));
  const frames = [...css.matchAll(/@keyframes br-\w+ \{([^}]*\}[^}]*)\}/g)].map((m) => m[1]).join(" ");
  assert.doesNotMatch(frames, /transform:/, "individual properties only (translate / rotate / scale / opacity)");
  assert.match(css, /\.is-off \[data-breathe\] \{ animation-play-state: paused; \}/);
  assert.match(css, /@media \(prefers-reduced-motion: no-preference\) \{\n  \[data-breathe\]/);
  assert.doesNotMatch(css, /\[data-enter[^\]]*\][^{]*\{[^}]*(opacity: 0|visibility: hidden|display: none)/, "the CSS never hides an entrance");
  assert.match(src("./styles/site.css"), /@import "\.\/stage\.css";/);
});

// node --test: the home page's choreography (Dex 10-19, the redesign; lanes/motion/DESIGN-1019.md 3, 4, 6).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = (p) => readFileSync(new URL(p, import.meta.url), "utf8");

test("choreo plan: strips whip in from their side and land square; panels follow as a triggered slide; nothing goes back while you read", async () => {
  const P = await import("./motion/choreo-plan.ts");
  for (const s of [-1, 1]) {
    const a = P.stripPose(0, s), z = P.stripPose(1, s);
    assert.equal(Math.sign(a.xPercent), s, "the strip starts off its own side");
    assert.ok(Math.abs(a.xPercent) >= 100, "wholly off");
    assert.equal(Math.sign(a.skewX), -s, "sheared against its travel");
    assert.deepEqual([z.xPercent, z.skewX, z.shade], [0, 0, 1], "lands square, its shade cast");
    // the panel (and its shade, one pose) waits wholly off its own side
    assert.equal(Math.sign(P.panelFrom(s)), s);
    assert.ok(Math.abs(P.panelFrom(s)) >= 100);
  }
  // v3 round 1: the stitch slides out from under the strip with the content (down, square, solid once its paper is in)
  assert.ok(P.stitchFrom().y < 0 && P.stitchFrom(true).y < 0);
  assert.equal(P.stitchFrom().autoAlpha, 1, "solid: never a see-through slab over the world");
  assert.match(P.stitchFrom().clipPath, /^inset\([^)]*100%/, "hidden by a wipe it unrolls out of");
  // fast off the mark, long soft landing: half way through the strip's range it is nearly in
  assert.ok(Math.abs(P.stripPose(0.5, -1).xPercent) < 5);
  // latched: follows on the way in, never back
  assert.equal(P.latch(0.4, 0.2), 0.4);
  assert.equal(P.latch(0.4, 0.7), 0.7);
  assert.equal(P.latch(0, 1.4), 1);
  // site loop round 1: the panel is a triggered slide (a scrub stalled half way, blank, when the reader stopped); a
  // settle on the screen plays out. v3 round 1 (Dex 10-20: "have the white background go in first, then the UI elements
  // ... come in from under the top one"): the paper is nearly in when the content starts out from under the strip; a band
  // entered fast, at once
  assert.equal(P.PANEL_AT(false), "top bottom");
  assert.equal(P.PANEL_AT(true), "top 94%");
  assert.ok(P.PANEL_TIME >= 0.6 && P.PANEL_TIME <= 0.9);
  assert.ok(P.expoOut(P.CONTENT_GATE) > 0.8 && P.expoOut(P.CONTENT_GATE) < 0.95, "the paper first: the gate opens with it ~90% in");
  assert.ok(P.PANEL_TIME * P.CONTENT_GATE <= 0.25, "...and soon: never long-empty paper");
  assert.ok(P.FAST_N > 0 && P.FAST_N < 1);
  assert.ok(P.HEAD_LEAD >= 0.2 && P.HEAD_LEAD <= 0.4, "v4 round 1: the title leads, its content soon after");
  assert.ok(P.FAST_V >= 1200, "a normal wheel scroll never rides its content in with the paper");
  assert.ok(P.SPINE_AT < 1);
  assert.ok(P.SETTLE_TIME >= 0.3 && P.SETTLE_TIME <= 0.6, "a settle plays out, never a pop");
  assert.ok(P.STITCH_FADE <= 0.15, "the stitch is solid at once, never a see-through slab");
  assert.equal(P.onScreen(-10, 20, 800), true);
  assert.equal(P.onScreen(-300, -1, 800), false);
  assert.equal(P.onScreen(800, 1200, 800), false);
  // the strip is fully in exactly as the change of place under it comes into view
  assert.equal(P.STRIP_START, "top bottom");
  assert.equal(P.stripEnd(116), "top bottom-=116");
  // arm time: only bands wholly below the screen are set back
  assert.equal(P.isBelow(900, 800), true);
  assert.equal(P.isBelow(300, 800), false);
  // content variants
  assert.deepEqual(P.contentFrom("rise", -1), { y: 40, autoAlpha: 0 });
  assert.deepEqual(P.contentFrom("drop", 1), { y: -48, autoAlpha: 0 }, "out from under the layer above: down and in");
  assert.deepEqual(P.contentFrom("side", 1), { x: 48, autoAlpha: 0 });
  // the scroll's speed: -1..1, 0 at rest; the fore rides faster than the paper
  assert.equal(P.speedOf(0), 0);
  assert.equal(P.speedOf(400), 1);
  assert.equal(P.speedOf(-20), -0.5);
  assert.equal(P.speedOf(Number.NaN), 0);
  assert.equal(P.speedOf(7, true), 0.5, "a finger reads at a higher gain");
  // the world under the pointer: against it, in whole art pixels, at most its amount
  assert.equal(P.worldShift(1, 8, 2), -8);
  assert.equal(P.worldShift(-0.4, 8, 2), 4);
  assert.equal(P.worldShift(0, 8, 2), 0);
  assert.equal(Math.abs(P.worldShift(0.3, 10, 2)) % 2, 0);
  // a key's magnet: toward the pointer, never past 6 px
  assert.deepEqual(P.pull(0, 0), [0, 0]);
  assert.ok(P.pull(10, 0)[0] > 0);
  assert.ok(Math.hypot(...P.pull(200, -150)) <= 6.0001);
  assert.equal(P.foreY(0), 60);
  assert.equal(P.foreY(1), -120);
  assert.equal(P.foreY(1, true), -60);
  // v4 round 1: the join, the place rises with the paper coming up over it, slower than it (its foot stays under it)
  assert.ok(P.LIFT > 0.5 && P.LIFT < 1);
  assert.equal(P.liftY(0, 1080), 0);
  assert.equal(P.liftY(1, 1000), -Math.round(1000 * P.LIFT));
  assert.equal(P.liftY(2, 1000), P.liftY(1, 1000), "clamped");
  for (const p of [0.25, 0.5, 0.9]) assert.ok(-P.liftY(p, 1000) < p * 1000, "never past the paper's own climb");
});

test("choreo wiring: home only, never with reduced motion, lazy (load + mark + idle, a scroll intent, or the website already in view); one event name with lane F; Lenis waits for G3", () => {
  const main = src("./main.ts");
  assert.match(main, /if \(reduced\.matches \|\| root\.dataset\.embed \|\| !document\.querySelector\("\.band__strip"\)\) return;/);
  assert.match(main, /const intents = \["wheel", "touchstart", "keydown"\] as const;/);
  assert.match(main, /void loaded\.then\(afterMark\)\.then\(idle\)\.then\(start\);/);
  assert.match(main, /import\("\.\/motion\/choreo\.ts"\)/);
  assert.doesNotMatch(main, /from "gsap|from "lenis/, "the libraries never land in the main bundle");
  const choreo = src("./motion/choreo.ts");
  assert.equal(choreo.match(/WAY_IN_EVENT = "([^"]+)"/)[1], src("./motion/enter.ts").match(/ENTER_EVENT = "([^"]+)"/)[1]);
  assert.doesNotMatch(choreo, /from "\.\/enter\.ts"/, "the opening's audio never rides in the choreo chunk");
  assert.match(choreo, /mm\.add\("\(prefers-reduced-motion: no-preference\)"/);
  assert.match(choreo, /if \(fine\.matches && \/\[\?&\]smooth=lenis\/\.test\(location\.search\)\) \{\n\s+void smoothWheel\(root\)/, "Lenis waits for lane F's OK (G3)");
  // site loop v4 round 1: off by default, so it never rides in the choreo chunk (its own chunk, only when asked for)
  assert.match(choreo, /await import\("lenis"\)/);
  assert.doesNotMatch(choreo, /^import Lenis from "lenis"/m);
  assert.match(choreo, /prevent: \(node\) => node\.matches\("dialog, \[popover\], iframe, \.world, \[data-lenis-prevent\]"\)/);
  // the cards: K's deck through its contract only (G never reaches inside the li)
  assert.match(choreo, /m\.initCards\(list, \{ reduced: false, fine: fine\.matches, velocity: \(\) => speed\.n \}\)/);
  for (const call of ["d.settle()", "d.prime()", "d.entrance({ side: \"l\", solid: true }).timeScale(fast ? 4 : 1).play()", "d.reset()", "d.live(st.isActive)"]) assert.ok(choreo.includes(call), call);
  assert.doesNotMatch(choreo, /\.pcard__|\.cart\b/, "nothing inside a card");
  // nothing GSAP set is left on a thing once it has landed; no layout read in the ticker
  assert.match(choreo, /clearProps: CLEAR/);
  const tick = choreo.slice(choreo.indexOf("const tick = ()"), choreo.indexOf("gsap.ticker.add(tick)"));
  assert.doesNotMatch(tick, /getBoundingClientRect|offsetHeight|offsetTop|clientWidth/);
});

test("scroller: plain window.scrollTo until a smooth wheel registers, then every jump goes through it", async () => {
  const calls = [];
  globalThis.window = { scrollY: 100, scrollTo: (o) => calls.push(["native", o]) };
  const { scroller, useSmooth } = await import("./motion/scroller.ts");
  scroller.to(0, { immediate: true });
  scroller.to(500);
  assert.deepEqual(calls, [["native", { top: 0, behavior: "instant" }], ["native", { top: 500, behavior: "smooth" }]]);
  useSmooth({ scrollTo: (t, o) => calls.push(["smooth", t, o.force]), stop: () => calls.push(["stop"]), start: () => calls.push(["start"]) });
  scroller.to(0);
  scroller.stop();
  scroller.start();
  assert.deepEqual(calls.slice(2), [["smooth", 0, true], ["stop"], ["start"]]);
  useSmooth(null);
  delete globalThis.window;
});

test("choreo CSS: breathing adds to the transform (never replaces it, never touches what the script slides and fades), rests off screen, stops with reduced motion; nothing hidden by CSS", () => {
  const css = src("./styles/choreo.css");
  const frames = [...css.matchAll(/@keyframes [\w-]+ \{([\s\S]*?\})\s*\}/g)].map((m) => m[1]).join(" ");
  assert.doesNotMatch(frames, /transform:/, "translate / scale / rotate / background only");
  // the shades' breath is translate only (the script slides them on the transform and fades them on opacity)
  assert.match(css, /@media \(prefers-reduced-motion: no-preference\) \{\n  \.band__shade, \.band__strip-shade \{ animation: band-lift/);
  assert.match(css, /@keyframes band-lift \{ from \{ translate: [^;]+; \} to \{ translate: [^;]+; \} \}/);
  // v2 round 1: the idle loops rest while the page moves
  assert.match(css, /\[data-moving\] \.band__shade, \[data-moving\] \.band__strip-shade \{ animation-play-state: paused !important; \}/);
  assert.match(css, /\.is-off \.band__shade/);
  assert.doesNotMatch(css, /(opacity: 0[;\s}]|visibility: hidden|display: none)/, "the CSS never hides anything");
  assert.match(src("./styles/site.css"), /@import "\.\/choreo\.css";/);
  assert.match(src("./render/layout.ts"), /<i class="hdr__progress" aria-hidden="true"><\/i>/);
});

test("way 4's slide-off (lane F's ask): every surface leaves the screen away from the window, the window and the world untouched; back at once; the bands re-armed", async () => {
  const { awayFrom, SURFACES, SLIDEOFF_EVENT, SLIDEBACK_EVENT } = await import("./motion/slideoff.ts");
  assert.equal(SLIDEOFF_EVENT, "dex:slideoff");
  assert.equal(SLIDEBACK_EVENT, "dex:slideback");
  const vw = 1366, vh = 768;
  const win = { left: 0, top: 300, width: 900, height: 468 };
  const box = (left, top, width, height) => ({ left, top, width, height });
  // the header above the window goes up, past the screen's top
  const [hx, hy] = awayFrom(box(0, 0, 1366, 64), win, vw, vh);
  assert.ok(hx === 0 && hy <= -64);
  // the jetty's paper beside (right of) the window goes right, past the screen's edge
  const [px, py] = awayFrom(box(900, 300, 466, 468), win, vw, vh);
  assert.ok(px >= vw - 900 && py === 0);
  // overlapping the window: the way its centre leans (right here)
  const [ox] = awayFrom(box(820, 320, 546, 400), win, vw, vh);
  assert.ok(ox >= vw - 820);
  // below goes down; left goes left
  assert.ok(awayFrom(box(0, 780, 400, 100), { left: 0, top: 0, width: 1366, height: 700 }, vw, vh)[1] >= vh - 780);
  assert.ok(awayFrom(box(0, 300, 200, 100), { left: 400, top: 0, width: 966, height: 768 }, vw, vh)[0] <= -200);
  // what slides: the website's surfaces only (never F's window or the world)
  assert.doesNotMatch(SURFACES, /jetty__scene|\.world|data-jetty-scene/);
  const src = readFileSync(new URL("./motion/slideoff.ts", import.meta.url), "utf8");
  assert.match(src, /\.filter\(\(el\) => !el\.closest\("\[data-jetty-scene\], \.world"\) && !el\.querySelector\("\[data-jetty-scene\], \.world"\)\)/);
  assert.match(src, /el\.animate\(\[\{ translate: "0 0" \}/, "translate: it adds to GSAP's transforms");
  // wired on the home page (the jetty), in the main bundle (works without the choreography and with reduced motion)
  assert.match(src_("./main.ts"), /\["slideoff", \(\) => \{ if \(document\.querySelector\("\[data-jetty-scene\]"\)\) initSlideoff\(reduced\); \}\]/);
  // the choreography holds the page still meanwhile and re-arms its bands after
  const choreo = src_("./motion/choreo.ts");
  assert.match(choreo, /document\.addEventListener\(SLIDEOFF_EVENT, onSlideOff\);/);
  assert.match(choreo, /document\.addEventListener\(SLIDEBACK_EVENT, onSlideBack\);/);
  assert.match(choreo, /if \(isBelow\(b\.el\.getBoundingClientRect\(\)\.top, vh\)\) b\.reset\(\);/);
});
const src_ = (p) => readFileSync(new URL(p, import.meta.url), "utf8");

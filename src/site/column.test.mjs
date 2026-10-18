// node --test: the page column (Dex 10-16): the "dex" mark's eased, overlapping letters that stay; the ofuda state
// table; the loader items and the small ofuda (the world's own drawing); the paper's pixel edge; the stubs and
// the page structure on every column page.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { INTRO_TIMING, penEase, planMark } from "../intro/intro.ts";
import { bottomView, cornerView, driftPoint, topView, trail, trailPoint } from "./motion/flow.ts";
import { scatterCell, scatterSvg } from "./motion/scatter.ts";
import { COLUMN_PAGES, jettySection, shell, world } from "./render/layout.ts";
import { landing } from "./render/landing.ts";
import { routes } from "./render/routes.ts";
import { STUBS, commissionsBlock, moreSection, stubPage } from "./render/stubs.ts";
import { hanko } from "./render/glyphs.ts";
import { downloadsSection } from "./render/downloads.ts";
import { donateSection } from "./render/donate.ts";

const content = { docs: [], posts: [], gallery: [] };

// ------------------------------------------------------------------------------------------------- the mark

test('"dex": every letter starts before the one before it has finished, eased in and out', () => {
  const { strokes, written } = planMark();
  assert.equal(strokes.length, 4);
  for (let i = 1; i < strokes.length; i++) {
    const prev = strokes[i - 1];
    assert.ok(strokes[i].start > prev.start, `stroke ${i} starts after stroke ${i - 1} starts`);
    assert.ok(strokes[i].start < prev.start + prev.dur, `stroke ${i} starts before stroke ${i - 1} ends (overlap)`);
  }
  assert.ok(written > 1.0 && written < 1.7, `written in ${written.toFixed(2)} s`);
  // the pen's ease: slow at both ends, fast in the middle, and it gets there
  assert.equal(penEase(0), 0);
  assert.equal(penEase(1), 1);
  const slope = (u) => (penEase(u + 0.01) - penEase(u)) / 0.01;
  assert.ok(slope(0.02) < 0.1 && slope(0.97) < 0.1, "eased at the ends");
  assert.ok(slope(0.5) > 1.4, "fast in the middle");
  for (let u = 0; u < 1; u += 0.05) assert.ok(penEase(u + 0.05) >= penEase(u), "never goes back");
  // every pixel of the mark gets ink, and the strokes ink in order of their pens
  const { pixels } = planMark();
  assert.ok(pixels.length > 600);
  assert.ok(pixels.every((p) => Number.isFinite(p.inkAt) && p.inkAt >= INTRO_TIMING.start && p.inkAt <= written + 1e-6));
});

test('"dex" stays: a staying mark never turns to dust by itself; its release front runs left to right', () => {
  const { pixels } = planMark(Infinity);
  assert.ok(pixels.every((p) => p.dustAt === Infinity));
  assert.ok(pixels.every((p) => p.front >= 0 && p.front <= 1));
  const left = pixels.filter((p) => p.x < 10), right = pixels.filter((p) => p.x > 64);
  const mean = (a) => a.reduce((s, p) => s + p.front, 0) / a.length;
  assert.ok(mean(left) < mean(right), "the release starts at the left");
  // the timed mark (other pages that use it) still blows away after its hold
  const timed = planMark(1.5);
  assert.ok(timed.pixels.every((p) => Number.isFinite(p.dustAt) && p.dustAt >= timed.written + 1.5));
});

// ------------------------------------------------------------------------------------------- the state table

test("the ofuda is the game's state: the table, row by row (SITE-SCROLL.md)", () => {
  // loading: "dex" + the chibi icons; corner: the cycling loader; bottom: Zhusha, no button
  assert.deepEqual(topView("loading"), { mark: true, loader: true, ofuda: false, cont: false, game: false });
  assert.equal(cornerView("loading"), "loader");
  assert.deepEqual(bottomView("loading"), { zhusha: true, button: false });
  // loaded: the ofuda in its place + "click to continue"; corner: the ofuda; bottom: Zhusha + the button
  assert.deepEqual(topView("loaded"), { mark: true, loader: false, ofuda: true, cont: true, game: false });
  assert.equal(cornerView("loaded"), "ofuda");
  assert.deepEqual(bottomView("loaded"), { zhusha: true, button: true });
  // in game: the game; corner: nothing (it is on her hat); bottom: the jetty without her, no button
  assert.deepEqual(topView("ingame"), { mark: false, loader: false, ofuda: false, cont: false, game: true });
  assert.equal(cornerView("ingame"), "none");
  assert.deepEqual(bottomView("ingame"), { zhusha: false, button: false });
});

test("the trail: home at the top, in the corner before the game screen is half covered, back home going up", () => {
  assert.equal(trail(0), 0);
  assert.equal(trail(0.03), 0);
  assert.equal(trail(0.5), 1);
  assert.equal(trail(1), 1);
  for (let c = 0; c < 1; c += 0.02) assert.ok(trail(c + 0.02) >= trail(c));
  const home = { x: 500, y: 400 }, corner = { x: 1300, y: 80 };
  assert.deepEqual(trailPoint(0, home, corner, 1366), home);
  const end = trailPoint(1, home, corner, 1366);
  assert.ok(Math.abs(end.x - corner.x) < 1e-6 && Math.abs(end.y - corner.y) < 1e-6);
  // way 4: the drift ends in her hands, going right to left and down
  const from = { x: 1300, y: 80 }, to = { x: 300, y: 500 };
  const a = driftPoint(0, from, to), z = driftPoint(1, from, to), m = driftPoint(0.5, from, to);
  assert.deepEqual(a, from);
  assert.ok(Math.abs(z.x - to.x) < 1e-6 && Math.abs(z.y - to.y) < 1e-6);
  assert.ok(m.x < from.x && m.x > to.x && m.y > from.y && m.y < to.y);
});

// ------------------------------------------------------------------------------------------------ the loader

test("the page runs the pixel loader (Dex 10-18), not the chibi placeholders: it gathers into the ofuda on the world's word, then the paper takes over", () => {
  const src = readFileSync(new URL("./motion/column.ts", import.meta.url), "utf8");
  assert.match(src, /import \{[^}]*createPixelLoader[^}]*\} from "\.\/pixel-loader\.ts"/);
  assert.match(src, /import \{[^}]*PaperOfuda[^}]*\} from "\.\/pixel-loader\.ts"/);
  assert.doesNotMatch(src, /sprites\.ts|LoaderStage|\.\/paper\.ts/);
  // loading -> loaded: the loader lands on the ofuda; the page's paper starts where it hangs
  assert.match(src, /setState\("loaded"\);[^]*loader\.landOnOfuda\(\)/);
  assert.match(src, /new PaperOfuda\(\{ tie: \{ x: pos\.x \/ kc, y: pos\.y \/ kc \}/);
  // reduced motion: the paper never moves (it hangs straight from its tie)
  assert.match(src, /if \(reduced\.matches\) paper\.reset\(\);\s*else paper\.step\(dt\);/);
  // the one event out stays
  assert.match(src, /new CustomEvent<EnterDetail>\(ENTER_EVENT, \{ detail: \{ way: w \} \}\)/);
});

// ------------------------------------------------------------------------------------------- the paper's edge

test("the paper's edge: a scatter of white pixels, dense at the paper and thinning into the sky", () => {
  const cols = 40, rows = 96;
  const lit = (x) => Array.from({ length: rows }, (_, y) => scatterCell(x, y, cols)).filter(Boolean).length;
  assert.ok(lit(0) > rows * 0.6, `dense at the paper (${lit(0)})`);
  assert.ok(lit(cols - 1) < rows * 0.08, `sparse in the sky (${lit(cols - 1)})`);
  const thirds = [0, 1, 2].map((t) => Array.from({ length: cols / 4 }, (_, i) => lit(Math.floor(t * cols / 3) + i)).reduce((a, b) => a + b, 0));
  assert.ok(thirds[0] > thirds[1] && thirds[1] > thirds[2], `thins out ${thirds}`);
  const svg = scatterSvg(cols, rows, 4, false);
  assert.match(svg, /^<svg [^>]*width="160" height="384" viewBox="0 0 40 96" shape-rendering="crispEdges">/);
  assert.equal(scatterSvg(cols, rows, 4, false), svg, "deterministic");
  // mirrored: the same pixels, the paper on the right
  const first = (s) => s.match(/M(\d+) (\d+)h/).slice(1).map(Number);
  const [x0, y0] = first(svg), [x1, y1] = first(scatterSvg(cols, rows, 4, true));
  assert.equal(y0, y1);
  assert.equal(x1, cols - 1 - x0);
});

// ------------------------------------------------------------------------------------------- the page itself

test("every column page has the game screen on top and the jetty at the bottom; entries do not", () => {
  const meta = (page, path) => ({ path, title: page, page, description: "" });
  for (const path of COLUMN_PAGES) {
    const page = path === "/" ? "home" : "more";
    const { body } = shell({ meta: meta(page, path), main: "<p>x</p>" });
    assert.match(body, /<section class="world" data-world-mount data-world-hold/, path);
    assert.match(body, /data-gs-title/, path);
    assert.match(body, /<button class="gs-continue" type="button" data-gs-continue hidden>click to continue<\/button>/, path);
    assert.match(body, /role="status">loading the world</, path);
    assert.ok(body.indexOf("data-jetty") > body.indexOf('class="ftr"'), `${path}: the jetty is the bottom of the page`);
    assert.doesNotMatch(body, /data-sky/, `${path}: no sky behind the page (it is white, with windows)`);
    if (path !== "/") assert.match(body, /scrollTo\(0,w\.offsetHeight\)/, `${path} lands on its section`);
  }
  const doc = shell({ meta: meta("docs", "/docs/some-doc/"), main: "<p>x</p>" }).body;
  assert.doesNotMatch(doc, /data-world-mount|data-jetty/);
  // the game screen still has its no-script way into the world, and its skip link to the site
  assert.match(world(), /class="world__fallback"[^]*href="\/tesu\/"/);
  assert.match(world(), /<a class="skip" href="#site">/);
});

test("the jetty: Zhusha there, the way in hidden until the world is in, a plain link without scripts", () => {
  const j = jettySection();
  assert.match(j, /<section class="jetty" data-jetty data-her/);
  assert.match(j, /data-jetty-her/);
  assert.match(j, /<button class="jetty__go" type="button" data-jetty-go hidden>experience the world we made<\/button>/);
  assert.match(j, /<noscript><a class="jetty__go" href="\/tesu\/">experience the world we made<\/a><\/noscript>/);
});

test("home: the sections on papers alternating left and right, then the stubs", () => {
  const html = landing(content);
  const sides = [...html.matchAll(/<div class="band band--([lr])">/g)].map((m) => m[1]);
  assert.ok(sides.length >= 6);
  sides.forEach((s, i) => assert.equal(s, i % 2 ? "r" : "l"));
  assert.ok(html.indexOf('id="more"') > html.indexOf('id="donate"'));
  // the page's h1 is "dex" on the game screen, not a second big mark on the website
  assert.doesNotMatch(html, /<h1/);
});

test("the stubs: honest 'opens later' pages at their addresses, the commissions corner in the gallery", () => {
  const paths = routes(content).map((r) => r.path);
  for (const id of ["support", "account", "map", "forums"]) {
    assert.ok(paths.includes(`/${id}/`), id);
    const html = stubPage(id);
    assert.match(html, /Opens later/);
    assert.match(html, /<h1 /);
    assert.doesNotMatch(html, /<form|<input|type="password"/, `${id} fakes nothing`);
  }
  assert.ok(STUBS.some((s) => s.href === "/gallery/#commissions"));
  assert.match(commissionsBlock(2), /id="commissions"/);
  assert.match(routes(content).find((r) => r.path === "/gallery/").render().body, /id="commissions"/);
  const more = moreSection();
  for (const s of STUBS) assert.ok(more.includes(`href="${s.href}"`), s.id);
});

test("Hanko sits in the corner of every stub card and panel, decorative, as one slot her art drops into", () => {
  assert.equal(hanko(), '<span class="hanko" data-hanko aria-hidden="true"><i class="hanko__face"></i></span>');
  // one to a section (on its first card), not a row of identical seals
  assert.equal((moreSection().match(/data-hanko/g) ?? []).length, 1);
  assert.match(stubPage("account"), /data-hanko/);
  // and on the real panels: the published download, and the donation box (it sits on her desk)
  assert.match(downloadsSection(), /<article class="dlf"[^>]*>(<span class="hanko")/);
  assert.match(donateSection(), /<section class="card bank"[^>]*>(<span class="hanko")/);
  const css = readFileSync(new URL("./styles/v2.css", import.meta.url), "utf8");
  assert.match(css, /--hanko-sheet: url\(/);
  assert.match(css, /@keyframes hanko-blink/);
  // she blinks only, and not with reduced motion
  assert.match(css, /@media \(prefers-reduced-motion: no-preference\) \{\s*\.hanko__face \{ animation: hanko-blink/);
});

// ------------------------------------------------------------------------------- critique 1 (B1-B3, S1, S3)


test("the sky's colour: many steps, each step's lower edge an ordered dither into the next, never a ruled line", async () => {
  const { rampIndex, skyRamp } = await import("./motion/sky-plan.ts");
  const ramp = skyRamp(28);
  assert.equal(ramp.length, 28);
  const rows = 900, n = ramp.length;
  const seen = new Set();
  let dithered = 0;
  for (let y = 0; y < rows; y++) {
    const row = new Set();
    for (let x = 0; x < 8; x++) {
      const i = rampIndex(x, y, rows, n);
      row.add(i);
      seen.add(i);
    }
    assert.ok(row.size <= 2, `row ${y}: at most two neighbouring steps`);
    if (row.size === 2) {
      dithered++;
      const [a, b] = [...row];
      assert.equal(Math.abs(a - b), 1);
    }
  }
  assert.equal(seen.size, n, "every step shows");
  assert.ok(dithered > rows * 0.2, `the step edges dither (${dithered} rows)`);
});

test("windows into the world (Dex 10-18): white page, a window beside each section, alternating, each a different place, its edge dissolving on every side", () => {
  const html = landing(content);
  const bands = [...html.matchAll(/<div class="band band--([lr])">[^]*?<div class="band__win" data-window="([a-z]+)" aria-hidden="true"><\/div><\/div>/g)];
  assert.ok(bands.length >= 6, `${bands.length} windows`);
  bands.forEach((m, i) => assert.equal(m[1], i % 2 ? "r" : "l", "alternating sides"));
  const scenes = bands.map((m) => m[2]);
  assert.equal(new Set(scenes).size, scenes.length, `each window a different place (${scenes})`);
  // every place is one the windows know how to paint
  return import("./motion/windows.ts").then(({ SCENES }) => {
    for (const s of scenes) assert.ok(SCENES[s], s);
    for (const [id, sc] of Object.entries(SCENES)) {
      assert.ok(sc.pieces.length >= 3, `${id}: a composed place`);
      assert.ok(sc.pieces.every((p) => p.kind.startsWith("op.") && p.fit > 0 && p.fit <= 1), `${id}: the world's own painters, fitted`);
    }
    // the dissolving edge: the white's pixels on all four sides of a window (tiles for each side)
    const css = readFileSync(new URL("./styles/v2.css", import.meta.url), "utf8");
    assert.match(css, /\.band__win::after \{[^}]*var\(--scatter-l[^}]*var\(--scatter-r[^}]*var\(--scatter-b[^}]*var\(--scatter-t/);
    assert.match(css, /\.band__win::before \{[^}]*linear-gradient\(90deg[^}]*linear-gradient\(270deg[^}]*linear-gradient\(180deg[^}]*linear-gradient\(0deg/);
    assert.match(css, /\.sheet--column \{ background: #fff; \}/);
    // the scatter: dense at the white, thinning into the world, for each side
    const ys = (svg) => [...svg.matchAll(/M\d+ (\d+)h/g)].map((m) => +m[1]);
    const mean = (a) => a.reduce((p, q) => p + q, 0) / a.length;
    assert.ok(mean(ys(scatterSvg(12, 96, 4, "t"))) > 6 && mean(ys(scatterSvg(12, 96, 4, "b"))) < 6);
  });
});

test("the corner is a slot in the header (right of World, left of Menu); the marks are the pixel dex", async () => {
  const { header, footer } = await import("./render/layout.ts");
  const h = header("home");
  assert.match(h, /hdr__world[^]*<span class="hdr__slot" data-ofuda-slot aria-hidden="true"><\/span>[^]*hdr__menu/);
  assert.match(h, /<a class="hdr__mark pop" href="#site"><svg class="mark-px" viewBox="0 0 74 36"/);
  assert.doesNotMatch(h + footer("home"), /<span class="mark">/, "no handwriting-font dex left");
  // a section's own page is one band: its content beside a window onto its place
  const page = shell({ meta: { path: "/downloads/", title: "D", page: "downloads", description: "" }, main: '<div class="page">x</div>' }).body;
  assert.match(page, /<main id="main" class="main" tabindex="-1"><div class="band band--l"><div class="page">x<\/div><div class="band__win" data-window="palace"/);
});

test("the jetty's column: the question, the way in, and an honest line while the world loads", () => {
  const j = jettySection();
  assert.match(j, /<h2 class="jetty__ask" id="jetty-title">want to explore the world we made\?<\/h2>/);
  assert.match(j, /<p class="jetty__note" data-jetty-note>the world is still loading<\/p>/);
});

test("the loader lands when the opening set is in, even when the world's progress() stops a hair short of 1", () => {
  const src = readFileSync(new URL("./motion/column.ts", import.meta.url), "utf8");
  // progress() >= 1 is a way in, never the only one (it tops out at 0.99 when 0.7 + 0.1 + 0.1 + 0.1 rounds down)
  assert.match(src, /if \(world\?\.progress && world\.progress\(\) >= 1\) return true;/);
  assert.match(src, /return !!s && s\.plates >= 1 && s\.close && s\.font && s\.ofuda;/);
  assert.notEqual(0.7 + 0.1 + 0.1 + 0.1, 1);
});

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

test("home: the sections with their windows, a tall one beside (alternating sides) then a wide one across, then the stubs", () => {
  const html = landing(content);
  const kinds = [...html.matchAll(/<div class="band band--([lrw])">/g)].map((m) => m[1]);
  assert.ok(kinds.length >= 6);
  // tall and wide take turns; the tall ones alternate sides
  kinds.forEach((k, i) => assert.equal(k === "w", i % 2 === 1, `band ${i}: ${k}`));
  const tall = kinds.filter((k) => k !== "w");
  tall.forEach((k, i) => assert.equal(k, i % 2 ? "r" : "l"));
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

test("windows into the world (Dex 10-18, bigger 10-19): white page, a window with each section, each a different place, its edge a hole torn in the paper", () => {
  const html = landing(content);
  const bands = [...html.matchAll(/<div class="band band--([lrw])">[^]*?<div class="band__win" data-window="([a-z]+)" aria-hidden="true"><\/div><\/div>/g)];
  assert.ok(bands.length >= 6, `${bands.length} windows`);
  const scenes = bands.map((m) => m[2]);
  assert.equal(new Set(scenes).size, scenes.length, `each window a different place (${scenes})`);
  // every place is one the windows know how to paint, each in its own light
  return import("./motion/windows.ts").then(({ SCENES, holeMask, framed, WIDE }) => {
    for (const s of scenes) assert.ok(SCENES[s], s);
    for (const [id, sc] of Object.entries(SCENES)) {
      for (const pieces of [sc.pieces, sc.wide?.pieces ?? []]) {
        assert.ok(!pieces.length || pieces.length >= 3, `${id}: a composed place`);
        assert.ok(pieces.every((p) => p.kind.startsWith("op.") && p.fit > 0 && p.fit <= 1), `${id}: the world's own painters, fitted`);
      }
    }
    // the windows across the page frame their place wide; a tall window keeps its own framing
    for (const [i, m] of bands.entries()) {
      const sc = SCENES[m[2]];
      if (m[1] === "w") assert.ok(sc.wide, `band ${i} (${m[2]}) is across the page: its place has a wide framing`);
    }
    const lake = SCENES.lake;
    assert.equal(framed(lake, 300, 300), lake, "a square window: the place as composed");
    assert.equal(framed(lake, 300 * WIDE + 30, 300).pieces, lake.wide.pieces, "a wide window: its wide framing");
    const lights = Object.values(SCENES).map((sc) => JSON.stringify(sc.sky));
    assert.equal(new Set(lights).size, lights.length, "a different light in every window");
    // the places are different places: no two windows share their main painter (the tallest piece)
    const main = Object.values(SCENES).map((sc) => [...sc.pieces].sort((a, b) => b.fit - a.fit)[0].kind + (sc.walker ? "+walker" : ""));
    assert.equal(new Set(main).size, main.length, `${main}`);
    assert.ok(SCENES.sky.walker, "the sky window has Tesu's landmark in it (the Walker)");
    // the edge, drawn into the window: paper all round (no colour line framing the hole), the world in the middle,
    // the tear's line wandering (not a straight frame), white or a breath of white only (no grey), seeded per window
    const W = 160, H = 120;
    const m = holeMask(W, H, 1);
    const a = (x, y) => m[(y * W + x) * 4 + 3];
    for (let x = 0; x < W; x++) assert.ok(a(x, 0) === 255 && a(x, H - 1) === 255, `top/bottom row paper at ${x}`);
    for (let y = 0; y < H; y++) assert.ok(a(0, y) === 255 && a(W - 1, y) === 255, `left/right column paper at ${y}`);
    assert.equal(a(W >> 1, H >> 1), 0, "the middle is the world");
    for (let i = 0; i < m.length; i += 4) {
      if (m[i + 3]) assert.ok(m[i] === 255 && m[i + 1] === 255 && m[i + 2] === 255, "only white on the edge");
    }
    // where the paper ends along the top edge, column by column: it wanders by several pixels
    const tear = Array.from({ length: W - 40 }, (_, i) => { let y = 0; while (y < H / 2 && a(20 + i, y) === 255) y++; return y; });
    assert.ok(Math.max(...tear) - Math.min(...tear) >= 4, `the tear wanders (${Math.min(...tear)}..${Math.max(...tear)})`);
    assert.notDeepEqual(holeMask(W, H, 2), m, "seeded per window");
    assert.deepEqual(holeMask(W, H, 1), m, "deterministic");
    const css = readFileSync(new URL("./styles/v2.css", import.meta.url), "utf8");
    assert.doesNotMatch(css, /\.band__win::(before|after)/, "the edge is in the window, not a tiled overlay");
    assert.match(css, /\.band__win \{[^}]*background: #fff;/, "white behind the window until it paints (no coloured line)");
    assert.match(css, /\.sheet--column \{ background: #fff; \}/);
  });
});

test("every page that is not the page column is plain white (its sheet carries the white over the black html)", () => {
  const css = readFileSync(new URL("./styles/v2.css", import.meta.url), "utf8");
  assert.match(css, /\.sheet--page:not\(\.sheet--column\) \{ background: #fff; \}/);
  const meta = (page, path) => ({ path, title: page, page, description: "" });
  for (const [page, path] of [["docs", "/docs/some-doc/"], ["blog", "/blog/a-post/"], ["404", "/404"]]) {
    const { body } = shell({ meta: meta(page, path), main: "<p>x</p>" });
    assert.match(body, /<div class="sheet sheet--page" id="site"/, `${path}: a deep page's sheet`);
    assert.doesNotMatch(body, /sheet--column/, `${path}: not the column (so the white rule applies)`);
  }
});

test("\"dex\" writes itself on a quiet thread: the world, the windows and the opening's audio start after it (Dex 10-19)", async () => {
  // "when it draws 'dex' at the start it lags": the world's frame boots on the page's own thread
  const world = readFileSync(new URL("./motion/world.ts", import.meta.url), "utf8");
  assert.match(world, /afterMark\(\)\.then\(load\)/, "the world's code loads after the mark");
  assert.match(world, /prefetchWorld\(\);\s*afterMark\(\)\.then\(load\)/, "its files come down meanwhile (network only)");
  const main = readFileSync(new URL("./main.ts", import.meta.url), "utf8");
  assert.match(main, /afterMark\(\)\.then\(\(\) => import\("\.\/motion\/sky\.ts"\)\)/, "the windows after the mark");
  const enter = readFileSync(new URL("./motion/enter.ts", import.meta.url), "utf8");
  assert.match(enter, /void afterMark\(\)\.then\(wake\)/, "the opening's audio after the mark");
  const col = readFileSync(new URL("./motion/column.ts", import.meta.url), "utf8");
  assert.match(col, /markStart\(\);\s*intro = playIntro/);
  assert.match(col, /intro\.written\.then\(\(\) => \{ markDone = true; quietDone\(\); \}\)/);
  assert.match(col, /else if \(!intro\) quietDone\(\);/, "covered at the start: nothing waits for a mark");
  // the wait itself: resolves on the mark, at once without a game screen, and never hangs
  const listeners = {};
  let title = {};
  globalThis.document = {
    documentElement: { setAttribute() {} },
    querySelector: () => title,
    addEventListener: (n, f) => { (listeners[n] ??= []).push(f); },
    dispatchEvent: (e) => { for (const f of listeners[e.type] ?? []) f(e); return true; },
  };
  globalThis.window ??= globalThis;
  globalThis.CustomEvent ??= class extends Event {};
  const q = await import("./motion/quiet.ts");
  let done = false;
  const w = q.afterMark().then(() => { done = true; });
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(done, false, "waits while the mark draws");
  q.markStart();
  q.markDone();
  await w;
  assert.equal(done, true, "goes once it is written");
  q.resetMark();
  title = null;
  await q.afterMark(); // no game screen: at once
  title = {};
  q.resetMark();
  const t0 = Date.now();
  q.markStart();
  await q.afterMark();
  assert.ok(Date.now() - t0 >= q.DRAW_WAIT_MS - 50 && Date.now() - t0 < q.MARK_WAIT_MS, "a started mark that never says: the draw's wait");
  q.resetMark();
  delete globalThis.document;
});

test("mid-game on the website: the opening's words hide with its bars (no caption over the page; Dex 10-16)", () => {
  // the page hides the opening's layer while the website covers the game screen (column.css html.gs-away .op); a
  // shown caption must inherit that, never force itself visible
  const col = readFileSync(new URL("./styles/column.css", import.meta.url), "utf8");
  assert.match(col, /html\.gs-away \.op \{ visibility: hidden; \}/);
  const ov = readFileSync(new URL("../tesu/opening/overlay.ts", import.meta.url), "utf8");
  assert.match(ov, /\.op-cap\.on \{ visibility: inherit; \}/);
  assert.doesNotMatch(ov, /visibility: visible/);
});

test("the \"dex\" screen is black to its bottom edge: no band where the white page meets it (Dex 10-19)", () => {
  // "there's a white fade at the bottom which imo looks bad": the white page's top edge is clean, below the fold
  const v2 = readFileSync(new URL("./styles/v2.css", import.meta.url), "utf8");
  const col = readFileSync(new URL("./styles/column.css", import.meta.url), "utf8");
  const sc = readFileSync(new URL("./motion/scatter.ts", import.meta.url), "utf8");
  assert.doesNotMatch(v2, /\.sheet--column::before/, "nothing drawn above the sheet's top edge");
  assert.doesNotMatch(v2 + col + sc, /--sheet-edge/, "no edge band, its size or its height left anywhere");
  // the "Site" cue keeps its place near the screen's foot without the band's height
  assert.match(col, /\.world__cue \{[^}]*bottom: calc\(clamp\(28px, 4vw, 56px\) \+ 18px\)/);
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

test("Zhusha on the jetty is her own drawing at her play scale, the ofuda landing exactly on the one on her hat (no white box)", async () => {
  const { FIGURE, HER_ART, HOLDING, IDLE_PIVOT, WAITING, ofudaOnHat } = await import("./motion/her.ts");
  const { OFUDA_H, OFUDA_IN_IDLE, OFUDA_W } = await import("./motion/pixel-loader.ts");
  const { FIGURE_H } = await import("../tesu/zhusha/contract.ts");
  const { H } = await import("../tesu/config.ts");
  const feel = JSON.parse(readFileSync(new URL("../tesu/zhusha/feel.json", import.meta.url), "utf8"));
  // the same numbers the game draws her with (mirrored so the page's bundle carries none of the engine)
  assert.equal(FIGURE, FIGURE_H);
  assert.equal(HER_ART, (H * feel.charScale) / FIGURE_H);
  // her idle is in the game's assets: a plain loop, pivot at her soles
  const idle = JSON.parse(readFileSync(new URL("../../public/assets/zhusha/idle/anim.json", import.meta.url), "utf8"));
  assert.equal(idle.figure_h, 128);
  assert.ok(idle.frames.length >= 1 && idle.pivot.length === 2 && !idle.idle_variant);
  assert.deepEqual([...IDLE_PIVOT], idle.pivot);
  // she waits bare-hatted (the paperless loop when the game has it, else the idle) and then holds it (the idle, whose
  // hat carries the ofuda, cut from it at OFUDA_IN_IDLE): the page's paper lands on that place, the same size
  assert.equal(WAITING.at(-1), HOLDING);
  assert.equal(HOLDING, "/assets/zhusha/idle/");
  assert.equal(idle.frames[0].file, OFUDA_IN_IDLE.file);
  assert.deepEqual(ofudaOnHat(idle.pivot), { x: OFUDA_IN_IDLE.x - idle.pivot[0], y: OFUDA_IN_IDLE.y - idle.pivot[1], w: OFUDA_W, h: OFUDA_H });
  // the stand-in is gone from the page: no white box, no drawn hat band or eye, no second ofuda drawn over hers
  const css = readFileSync(new URL("./styles/column.css", import.meta.url), "utf8");
  assert.doesNotMatch(css, /\.jetty__her \{[^}]*background: #fff/);
  assert.doesNotMatch(css, /\.jetty__her::(before|after)/);
  assert.doesNotMatch(css, /\.jetty__hat \{[^}]*background/);
  // the drift lands on the ofuda's place on her hat (motion/sky.ts places .jetty__hat there)
  const col = readFileSync(new URL("./motion/column.ts", import.meta.url), "utf8");
  assert.match(col, /her\.querySelector\("\.jetty__hat"\)/);
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

test("the looks (Dex 10-19 'the motion feels cheap'): diorama ships; depth by nearness, a tear that opens as the window rises, unchanged frames skipped", async () => {
  const { DEFAULT_LOOK, LOOKS } = await import("./motion/look-mode.ts");
  const { LOOK, diorama } = await import("./motion/looks.ts");
  const { holeMask, tearField } = await import("./motion/windows.ts");
  assert.equal(DEFAULT_LOOK, "diorama");
  assert.deepEqual([...LOOKS].sort(), Object.keys(LOOK).sort(), "every look the switch knows exists");
  const st = (top, bandTop, bandH = 900) => ({ W: 300, H: 240, index: 0, top, bottom: top + 240, bandTop, bandBottom: bandTop + bandH, vh: 800, arrived: -1 });
  const piece = (kind, extra = {}) => ({ kind, p: {}, fit: 0.5, x: 0.5, y: 0.5, ...extra });
  // the scroll is the camera: near things move further than far ones, and the other way as the band goes up
  const low = st(500, 600), high = st(-200, -100);
  const dy = (s, pc) => diorama.offset(s, pc, 0, 0)[1];
  assert.ok(Math.abs(dy(low, piece("op.pine"))) > Math.abs(dy(low, piece("op.farkarst"))), "the pine moves more than the far karst");
  assert.ok(dy(low, piece("op.tower")) > 0 && dy(high, piece("op.tower")) < 0, "near things ride from low to high as the page scrolls");
  assert.ok(Math.abs(diorama.backOffset(low, 0)[1]) <= 12, "the sky moves no further than its margin");
  for (const s of [low, high]) for (const v of diorama.offset(s, piece("op.palace"), 0, 0)) assert.equal(v, Math.round(v), "whole pixels");
  // the tear: shut-ish while the window is at the screen's foot, open by the time it is near the top
  const foot = diorama.coverKey(st(790, 790), 0), mid = diorama.coverKey(st(560, 560), 0), up = diorama.coverKey(st(300, 300), 0);
  assert.ok(foot > mid && mid > up && up === 0, `the tear opens as it rises (${foot} > ${mid} > ${up})`);
  const out = new Uint8ClampedArray(300 * 240 * 4);
  assert.equal(diorama.cover(st(300, 300), () => tearField(300, 240, 1), out, 0), false, "open: nothing over the window");
  assert.equal(diorama.cover(st(700, 700), () => tearField(300, 240, 1), out, 0), true);
  // the growing tear is the finished hole's own outline: inside the finished tear the field is the world, outside paper
  const f = tearField(160, 120, 1), m = holeMask(160, 120, 1);
  let agree = 0, n = 0;
  for (let i = 0; i < f.length; i++) {
    if (m[i * 4 + 3] === 255) { n++; if (f[i] < 4) agree++; }
  }
  assert.ok(agree / n > 0.9, `paper in the mask is paper in the field (${agree}/${n})`);
  assert.ok(f[60 * 160 + 80] > 4 * 30, "the middle is far inside the tear");
});

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
  // every place is one the windows know how to paint, each in its own light
  return import("./motion/windows.ts").then(({ SCENES, edgeMask }) => {
    for (const s of scenes) assert.ok(SCENES[s], s);
    for (const [id, sc] of Object.entries(SCENES)) {
      assert.ok(sc.pieces.length >= 3, `${id}: a composed place`);
      assert.ok(sc.pieces.every((p) => p.kind.startsWith("op.") && p.fit > 0 && p.fit <= 1), `${id}: the world's own painters, fitted`);
    }
    const lights = Object.values(SCENES).map((sc) => JSON.stringify(sc.sky));
    assert.equal(new Set(lights).size, lights.length, "a different light in every window");
    // the places are different places: no two windows share their main painter (the tallest piece)
    const main = Object.values(SCENES).map((sc) => [...sc.pieces].sort((a, b) => b.fit - a.fit)[0].kind + (sc.walker ? "+walker" : ""));
    assert.equal(new Set(main).size, main.length, `${main}`);
    assert.ok(SCENES.sky.walker, "the sky window has Tesu's landmark in it (the Walker)");
    // the dissolving edge, drawn into the window: the outermost pixel all round solid white (no colour line framing
    // the hole), white thinning into the world, and seeded so no two windows (or sides) are the same
    const W = 80, H = 60, D = 12;
    const m = edgeMask(W, H, D, 1);
    const a = (x, y) => m[(y * W + x) * 4 + 3];
    for (let x = 0; x < W; x++) assert.ok(a(x, 0) === 255 && a(x, H - 1) === 255, `top/bottom row solid at ${x}`);
    for (let y = 0; y < H; y++) assert.ok(a(0, y) === 255 && a(W - 1, y) === 255, `left/right column solid at ${y}`);
    assert.equal(a(W >> 1, H >> 1), 0, "the middle is the world");
    const col = (k) => Array.from({ length: H - 2 * D }, (_, i) => a(k, D + i)).reduce((p, q) => p + q, 0);
    assert.ok(col(1) > col(5) && col(5) > col(D - 1), "white thinning into the world");
    const lit = (mask, side) => Array.from({ length: H - 2 * D }, (_, i) => {
      const y = D + i;
      return Array.from({ length: D }, (_, k) => (mask[(y * W + (side ? W - 1 - k : k)) * 4 + 3] === 255 ? 1 : 0)).join("");
    }).join("|");
    assert.notEqual(lit(m, 0), lit(edgeMask(W, H, D, 2), 0), "seeded per window");
    assert.notEqual(lit(m, 0), lit(m, 1), "seeded per side");
    assert.deepEqual(edgeMask(W, H, D, 1), m, "deterministic");
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

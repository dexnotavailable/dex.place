// node --test: the landing, /projects/ and project pages.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { cardArt } from "./render/cardart.ts";
import { landing, projectPage, projectsIndex } from "./render/landing.ts";
import { routes } from "./render/routes.ts";
import { projects, projectHref } from "./data/projects.ts";
import { downloads } from "./data/downloads.ts";

const content = { docs: [], posts: [], gallery: [] };

test("card art (Dex 10-19): every project's layers fill its card, back to front, lazily, decorative, and the files exist", () => {
  for (const p of projects.filter((q) => !q.art.rig)) {
    const html = cardArt(p);
    assert.match(html, /^<div class="cart" data-tilt-scene aria-hidden="true" style="--aw:\d+;--ah:\d+">/);
    const imgs = [...html.matchAll(/<img class="cart__l" data-depth="(\d)" src="([^"]+)" alt="" width="(\d+)" height="(\d+)" loading="lazy" decoding="async"/g)];
    assert.equal(imgs.length, p.art.layers, `${p.id} layers`);
    assert.ok(p.art.layers >= 2, `${p.id}: layers to pan`);
    // back to front: the far layer moves least
    const depths = imgs.map((m) => +m[1]);
    assert.deepEqual(depths, [...depths].sort((a, b) => a - b), `${p.id} depths rise to the front`);
    assert.ok(depths[0] < depths[depths.length - 1]);
    imgs.forEach((m, i) => {
      assert.equal(m[2], `/site/cards/${p.id}/${i}.png`);
      assert.ok(existsSync(new URL(`../../public${m[2]}`, import.meta.url)), `${m[2]} exists`);
      assert.equal(+m[3], p.art.w);
      assert.equal(+m[4], p.art.h);
    });
    assert.match(html, /<span class="cart__shine"><\/span><\/div>$/);
  }
});

test("every project has a page route, a doc link and at least one fact", () => {
  const paths = routes(content).map((r) => r.path);
  assert.ok(paths.includes("/projects/"));
  for (const p of projects) {
    assert.ok(paths.includes(projectHref(p)), `${p.id} route`);
    assert.match(p.docs.href, /^\/docs\/[\w-]+\/$/);
    assert.ok(p.facts.length > 0);
  }
});

test("landing lists the projects in Dex's order and links each page", () => {
  const html = landing(content);
  assert.deepEqual(projects.map((p) => p.name), ["dexCode", "dexClient", "dex.place"]);
  let at = -1;
  for (const p of projects) {
    const i = html.indexOf(`id="p-${p.id}"`);
    assert.ok(i > at, `${p.id} in order`);
    at = i;
    assert.ok(html.includes(`href="${projectHref(p)}"`));
  }
  // the cards carry their art (no code-drawn placeholder scenes, no "placeholder art" plates)
  assert.equal(html.match(/<div class="cart[ "][^>]*data-tilt-scene/g)?.length, projects.length);
  assert.doesNotMatch(html, /Placeholder art/i);
});

test("home cards: every project leads to its page, its docs and the one action that matters", () => {
  const html = landing(content);
  for (const p of projects) {
    const start = html.indexOf(`id="p-${p.id}"`);
    const cardHtml = html.slice(start, html.indexOf("</article>", start));
    assert.ok(cardHtml.includes(`href="${projectHref(p)}"`), `${p.id} details`);
    assert.ok(cardHtml.includes(`href="${p.docs.href}"`), `${p.id} docs`);
    const entry = downloads.find((d) => d.id === p.id);
    if (entry?.file) assert.ok(cardHtml.includes(`href="${entry.file.href}" download`), `${p.id} direct file`);
    else if (entry?.installedBy) assert.ok(cardHtml.includes(`href="#${entry.installedBy}"`), `${p.id} points at its installer`);
    else assert.ok(cardHtml.includes(`href="#world"`), `${p.id} leads up to the world`);
  }
});

test("download state comes from data/downloads.ts, never invented", () => {
  for (const p of projects) {
    const entry = downloads.find((d) => d.id === p.id);
    // The project's own part of its page; "Other projects" cards carry their own state.
    const page = projectPage(p);
    const html = page.slice(0, page.indexOf('class="others"'));
    if (entry?.file) {
      assert.ok(html.includes(`href="${entry.file.href}"`), `${p.id} links its real file`);
    } else {
      assert.ok(!/\.exe"/.test(html), `${p.id} links no installer`);
    }
  }
});

test("no Dex art outside the gallery, and #world only on the root page", () => {
  for (const html of [landing(content), projectsIndex(), ...projects.map(projectPage)]) {
    assert.ok(!/src="\/gallery\//.test(html));
    // the only pictures are the projects' own card art
    for (const [, src] of html.matchAll(/<img [^>]*src="([^"]+)"/g)) assert.match(src, /^\/site\/cards\//);
  }
  for (const html of [projectsIndex(), ...projects.map(projectPage)]) {
    assert.ok(!/href="#world"/.test(html));
  }
});

// ----------------------------------------------------- the one-scroll home

import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadContent } from "./build/content.ts";
import { NAV } from "./data/nav.ts";
import { shell } from "./render/layout.ts";

const real = loadContent(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.."));

test("home: every section in Dex's order, each with the anchor the nav jumps to", () => {
  const html = landing(real);
  const order = ["projects", "downloads", "gallery", "docs", "blog", "donate"];
  let at = -1;
  for (const id of order) {
    const i = html.indexOf(`id="${id}"`);
    assert.ok(i > at, `#${id} after the one before it`);
    at = i;
  }
  assert.deepEqual(NAV.map((n) => n.id), order);
  // Each section is usable in place: the file, the collage, the docs, the QR.
  assert.match(html, /href="\/downloads\/dexClient-Setup-[\d.]+\.exe"/);
  assert.match(html, /data-collage/);
  assert.match(html, /data-donate/);
  for (const d of real.docs) assert.ok(html.includes(`href="${d.url}"`), d.url);
  for (const p of real.posts) assert.ok(html.includes(`href="${p.url}"`), p.url);
});

test("home: Dex's art appears only inside the collage", () => {
  const html = landing(real);
  const start = html.indexOf(`<div class="collage-box"`);
  const end = html.indexOf(`</ul></div>`, start);
  assert.ok(start > 0 && end > start);
  const outside = html.slice(0, start) + html.slice(end);
  // (The viewer dialog has two empty <img> slots it fills from the collage.)
  // (and the projects' card art is our own pixel art from /site/cards/, never Dex's)
  assert.doesNotMatch(outside.replace(/<img class="viewer__(lo|hi)" alt="" data-viewer-(lo|hi) \/>/g, "").replace(/<img class="(?:cart__l|rig__p)" [^>]*src="\/site\/cards\/[^>]*>/g, ""), /<img /);
  assert.doesNotMatch(outside, /(src|srcset)="\/gallery\//);
});

test("nav: anchors on the home page, home + anchor elsewhere; inner pages mark their section", () => {
  const meta = (page, path) => ({ path, title: page, page, description: "" });
  const home = shell({ meta: meta("home", "/"), main: "" }).body;
  for (const n of NAV) assert.ok(home.includes(`class="nav__link" href="${n.anchor}"`), n.id);
  assert.doesNotMatch(home, /class="nav__link"[^>]*aria-current/);
  const docs = shell({ meta: meta("docs", "/docs/"), main: "" }).body;
  for (const n of NAV) assert.ok(docs.includes(`class="nav__link" href="/${n.anchor}"`), n.id);
  assert.match(docs, /class="nav__link" href="\/#docs" aria-current="true"/);
});

test("card rigs v2 (Dex 10-19): webp parts + rig.json in the agreed format (lanes/motion ASKS 00), under the cap, laid on the page as plain lazy layers", async () => {
  const { readFileSync, readdirSync, statSync } = await import("node:fs");
  const { pose, coverOf } = await import("./motion/cardrig.ts");
  const { rigOf, motionCss } = await import("./render/cardart.ts");
  const { normaliseRig } = await import("./motion/rig-read.ts");
  // both ways of writing the parts read the same: a list with ids, or the card-art lane's object by id + order
  const asList = { v: 2, size: [10, 20], parts: [{ id: "bg", src: "bg.webp", box: [0, 0, 10, 20] }, { id: "head", src: "head.webp", box: [2, 2, 4, 4], depth: 1 }] };
  const asObject = { v: 2, size: [10, 20], order: ["bg", "head"], parts: { head: { src: "head.webp", box: [2, 2, 4, 4], depth: 1 }, bg: { src: "bg.webp", box: [0, 0, 10, 20] } } };
  assert.deepEqual(normaliseRig(asObject).parts, asList.parts);
  assert.deepEqual(normaliseRig(asList).parts, asList.parts);
  assert.equal(normaliseRig({ v: 1, size: [1, 1], parts: {} }), null, "v1 (svg) is not read any more");
  const rigged = projects.filter((p) => p.art.rig);
  assert.ok(rigged.length >= 1, "at least one card plays a rig");
  for (const p of rigged) {
    const dir = new URL(`../../public/site/cards/${p.id}/`, import.meta.url);
    const rig = normaliseRig(JSON.parse(readFileSync(new URL("rig.json", dir), "utf8")));
    assert.ok(rig, `${p.id}: rig v2`);
    assert.deepEqual(rigOf(p), rig);
    const [W, H] = rig.size;
    assert.ok(W > 0 && H > 0, `${p.id}: a frame`);
    if (rig.focus) assert.ok(rig.focus[0] >= 0 && rig.focus[0] <= W && rig.focus[1] >= 0 && rig.focus[1] <= H, `${p.id}: the focus is in the frame`);
    // what ships: rig.json and the parts' webps (the cap counts every file but the plain-layer fallback)
    const shipped = readdirSync(dir).filter((f) => !/^\d+\.png$/.test(f));
    const bytes = shipped.reduce((n, f) => n + statSync(new URL(f, dir)).size, 0);
    assert.ok(bytes <= 250 * 1024, `${p.id}: ${Math.round(bytes / 1024)} KB shipped (cap 250)`);
    const ids = new Set();
    for (const part of rig.parts) {
      assert.match(part.id, /^[a-z0-9-]+$/);
      assert.ok(!ids.has(part.id), `${p.id}: ${part.id} once`);
      ids.add(part.id);
      assert.match(part.src, /^[a-z0-9-]+\.webp$/, `${p.id} ${part.id}: a webp beside rig.json`);
      assert.ok(shipped.includes(part.src), `${p.id}: ${part.src} exists`);
      const [x, y, w, h] = part.box;
      assert.ok(w > 0 && h > 0 && x >= -1 && y >= -1 && x + w <= W + 1 && y + h <= H + 1, `${p.id} ${part.id}: its box is in the frame`);
      assert.ok((part.depth ?? 0.5) >= 0 && (part.depth ?? 0.5) <= 1, `${p.id} ${part.id}: depth 0..1`);
      for (const m of part.motion ?? []) assert.ok(["sway", "breathe", "bob", "glow", "drift", "flicker"].includes(m.kind) && m.period > 0, `${p.id} ${part.id}: ${m.kind}`);
    }
    // on the page: every part a plain lazy layer, back to front, in an art box the CSS places from the focus
    const html = cardArt(p);
    assert.match(html, new RegExp(`^<div class="cart cart--rig[^"]*" data-tilt-scene data-rig="/site/cards/${p.id}/" aria-hidden="true" style="--aw:${W};--ah:${H};--fx:[\\d.]+;--fy:[\\d.]+">`));
    const layers = [...html.matchAll(/<img class="rig__p" src="([^"]+)" alt="" loading="lazy" decoding="async" data-part="([a-z0-9-]+)"/g)];
    assert.deepEqual(layers.map((m) => m[2]), rig.parts.map((q) => q.id), `${p.id}: every part, in order`);
    layers.forEach((m, i) => assert.equal(m[1], `/site/cards/${p.id}/${rig.parts[i].src}`));
    assert.doesNotMatch(html, /cart__l/, `${p.id}: no plain layers once the rig is in`);
  }
  // a part's motions as CSS: each kind its keyframes, moves in percent of the part's own box
  const css = motionCss({ id: "x", src: "x.webp", box: [0, 0, 200, 100], motion: [{ kind: "sway", deg: 3, period: 4, phase: 0.25 }, { kind: "bob", dx: 0, dy: 5, period: 2 }] });
  assert.match(css, /--rig-deg:3deg/);
  assert.match(css, /--rig-by:5%/);
  assert.match(css, /--anim:rig-sway 2s ease-in-out -1s infinite alternate, rig-bob 1s ease-in-out 0s infinite alternate/);
  // the poses: a sway swings both ways within its degrees, a breath never shrinks below 1 tall, a glow stays in range,
  // a drift fades in and out
  const sw = [0, 0.5, 1, 1.5, 2].map((t) => pose([{ kind: "sway", deg: 3, period: 2 }], t).rot);
  assert.ok(Math.max(...sw) <= 3 && Math.min(...sw) >= -3 && Math.max(...sw) > 2 && Math.min(...sw) < -2);
  for (let t = 0; t < 4; t += 0.25) {
    const b = pose([{ kind: "breathe", scale: 0.02, period: 4 }], t);
    assert.ok(b.sy >= 1 && b.sy <= 1.02 && b.sx <= 1);
    const g = pose([{ kind: "glow", min: 0.6, max: 1, period: 2 }], t).alpha;
    assert.ok(g >= 0.6 - 1e-9 && g <= 1 + 1e-9);
  }
  assert.ok(pose([{ kind: "drift", dy: -10, period: 1, fade: true }], 0.01).alpha < 0.2);
  assert.equal(pose([{ kind: "drift", dy: -10, period: 1, fade: true }], 0.5).alpha, 1);
  // the crop: the art covers the card with room to pan on every card shape, and the face stays in, high on the card,
  // even a head near the frame's top (Bao) on the 4:5 phone card
  for (const focus of [[576, 520], [600, 180], [300, 1500]]) {
    for (const [cw, ch] of [[240, 427], [376, 470], [300, 533]]) {
      const c = coverOf({ size: [1152, 2048], focus }, cw, ch);
      assert.ok(c.left <= -14 + 1e-6 && c.left + 1152 * c.s >= cw + 14 - 1e-6, `covers across ${cw}x${ch}`);
      assert.ok(c.top <= -14 + 1e-6 && c.top + 2048 * c.s >= ch + 14 - 1e-6, `covers down ${cw}x${ch}`);
      const fx = c.left + focus[0] * c.s, fy = c.top + focus[1] * c.s;
      assert.ok(fx > cw * 0.15 && fx < cw * 0.85, `focus ${focus} across ${cw}x${ch}: ${fx.toFixed(0)}`);
      assert.ok(fy > 10 && fy < ch * 0.9, `focus ${focus} down ${cw}x${ch}: ${fy.toFixed(0)}`);
      if (focus[1] < 600) assert.ok(fy < ch * 0.45, `a face near the top stays in the card's upper part (${fy.toFixed(0)} of ${ch})`);
    }
  }
});

// node --test: the project cards (lane K, lanes\motion\DESIGN-1019.md section 5): markup (render/pcard.ts), art
// (render/cardart.ts, the rig format), styles (styles/pcard.css) and motion (motion/pcard.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { cardArt } from "./render/cardart.ts";
import { landing, projectPage } from "./render/landing.ts";
import { projects, projectHref } from "./data/projects.ts";
import { downloads } from "./data/downloads.ts";

const content = { docs: [], posts: [], gallery: [] };

test("card art (Dex 10-19): every project's layers fill its card, back to front, lazily, decorative, and the files exist", () => {
  // (art drawn in code has no layers on disk: YUKI's, yuki.test.mjs)
  for (const p of projects.filter((q) => !q.art.rig && !q.art.code)) {
    const html = cardArt(p);
    assert.match(html, /^<div class="cart" aria-hidden="true" style="--aw:\d+;--ah:\d+">/);
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
    else if (entry?.guide) assert.ok(cardHtml.includes(`href="${entry.guide}"`) && cardHtml.includes(`Meet ${p.hero}`), `${p.id}: not out yet, meet her on her page`);
    else assert.ok(cardHtml.includes(`href="#world"`), `${p.id} leads up to the world`);
  }
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
    assert.match(html, new RegExp(`^<div class="cart cart--rig[^"]*" data-rig="/site/cards/${p.id}/"(?: data-lines)? role="img" aria-label="[^"]+" style="--aw:${W};--ah:${H};--fx:[\\d.]+;--fy:[\\d.]+">`), `${p.id}: a picture on the project page`);
    // on the card the art is decorative: the card's name says what it is
    assert.match(cardArt(p, undefined, { card: true, numeral: "01" }), /^<div class="cart cart--rig[^"]*" data-rig="[^"]+"(?: data-lines)? aria-hidden="true" /);
    assert.ok(p.art.alt && p.art.credit, `${p.id}: alt text and credit`);
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

test("Dex 10-19 'vector is best; some web elements don't necessarily need to be pixel': the cards are vector by default (no script needed)", async () => {
  const { DEFAULT_FINISH, FINISHES } = await import("./motion/finish-mode.ts");
  assert.equal(DEFAULT_FINISH, "vector");
  assert.deepEqual([...FINISHES].sort(), ["pixel", "vector"]);
  const landing = readFileSync(new URL("./styles/pcard.css", import.meta.url), "utf8");
  // the vector finish plays unless the pixel one is asked for (so it also plays before or without any script)
  assert.match(landing, /html:not\(\[data-cardfinish="pixel"\]\) \.rig__p \{ animation: var\(--anim, none\); \}/);
  assert.doesNotMatch(landing, /\[data-cardfinish="vector"\]/, "nothing waits for a script to say vector");
  // the card's own web bits move smoothly; pixel steps only on the pixel finish
  const shine = landing.match(/\.cart__shine \{[^}]*\}/)[0];
  assert.match(shine, /--shine-t: cubic-bezier\(/);
  assert.match(landing, /html\[data-cardfinish="pixel"\] \.cart__shine \{ --shine-t: steps\(\d+, end\); \}/);
  assert.doesNotMatch(landing.match(/\.pcard__link \{[^}]*\}/)[0], /steps\(/, "the name's underline grows smoothly");
  // the pixel finish's code is fetched only for that finish
  const main = readFileSync(new URL("./main.ts", import.meta.url), "utf8");
  assert.match(main, /if \(cardFinish !== "pixel" \|\| !document\.querySelector\("\[data-rig\]"\)\) return;/);
});

test("the seam (DESIGN-1019 7.1): the cards live in their own files, the deck keeps the contract G drives", async () => {
  // (Dex 10-22: home and /projects/ show the projects as banner strips, render/pbanner.ts; the cards stay as a project
  // page's "other projects". Both lists are data-pcards, so G and main.ts find either; a banner list is data-pban)
  assert.match(landing(content), /<ul class="pbans" data-pcards="home" data-pban>/);
  const page = projectPage(projects[0]);
  assert.match(page, /<ul class="pcards pcards--two" data-pcards="page">/);
  const landingCss = readFileSync(new URL("./styles/landing.css", import.meta.url), "utf8");
  assert.doesNotMatch(landingCss, /\.pcard(?:__|--|[\s{:,.])|\.cart(?:__|--)|\.rig__|@keyframes (?:cart|rig)-/, "no card rules left in landing.css (only the .pcards placement)");
  const site = readFileSync(new URL("./styles/site.css", import.meta.url), "utf8");
  assert.match(site, /@import "\.\/pcard\.css";/);
  const ts = readFileSync(new URL("./motion/pcard.ts", import.meta.url), "utf8");
  for (const k of ["prime", "entrance", "settle", "reset", "live", "destroy"]) assert.match(ts, new RegExp(`\\b${k}\\(`), k);
  assert.match(ts, /export function initCards\(list: HTMLElement, \w+: CardHost\): CardDeck/);
  assert.doesNotMatch(ts, /from "gsap\/ScrollTrigger"/, "K never uses ScrollTrigger");
  // a banner list goes to the banner deck, under the same contract
  assert.match(ts, /if \(list\.hasAttribute\("data-pban"\)\) return initBanners\(list, given\);/);
  const ban = readFileSync(new URL("./motion/pbanner.ts", import.meta.url), "utf8");
  for (const k of ["prime", "entrance", "settle", "reset", "live", "destroy"]) assert.match(ban, new RegExp(`\\b${k}\\b`), `banner ${k}`);
  assert.match(ban, /export function initBanners\(list: HTMLElement, given: CardHost\): CardDeck/);
  assert.doesNotMatch(ban, /from "gsap\/ScrollTrigger"/, "the banners never use ScrollTrigger (G triggers them)");
  // the art is not magnet.ts's to tilt any more
  for (const p of projects) assert.doesNotMatch(cardArt(p), /data-tilt-scene/);
});

test("the card's DOM (DESIGN-1019 5.2): one owner per wrapper, the hero accents, chrome, foot and the numeral in the art", async () => {
  const heroes = { yuki: ["Yuki", "cyan"], "dex-place": ["Zhusha", "magenta"] };
  for (const p of projects) {
    assert.deepEqual([p.hero, p.tone], heroes[p.id], `${p.id}: hero and accent`);
    // (the cards since Dex 10-22: a project page's "other projects")
    const html = projectPage(projects.find((o) => o.id !== p.id));
    const start = html.indexOf(`<li class="pcards__it" data-pcard="${p.id}"`);
    assert.ok(start >= 0, `${p.id}: li[data-pcard]`);
    const li = html.slice(start, html.indexOf("</li>", start) + 5);
    // outside in: in > tilt > float > (plate, article), then the ground, last in the li
    assert.match(li, new RegExp(`^<li[^>]*><div class="pcard__in" data-tone="${p.tone}"><div class="pcard__tilt"><div class="pcard__float"><span class="pcard__plate" aria-hidden="true"></span><article class="pcard pcard--${p.tone}" id="p-${p.id}"`));
    assert.match(li, /<\/article><\/div><\/div><\/div><span class="pcard__ground" aria-hidden="true"><\/span><\/li>$/);
    // the art: the back parts, the numeral, the figure; then the scrim, glare and shine
    const no = String(projects.indexOf(p) + 1).padStart(2, "0");
    if (p.art.code) {
      // drawn in code (YUKI): her night, the numeral, then her; the snow; the scrim, glare and shine
      assert.match(li, new RegExp(`<div class="ykart__stage"><svg class="ykstage".*</svg></div><span class="cart__num">${no}</span><div class="ykart__stage ykart__stage--her"><svg class="ykstage".*</svg></div><span class="ykfx" aria-hidden="true">.*</span><span class="cart__scrim"></span><span class="cart__glare"></span><span class="cart__shine"></span></div>`));
    } else {
      assert.match(li, new RegExp(`<div class="cart__art"><div class="rig__box">.*</div><span class="cart__num">${no}</span><div class="rig__box">.*</div></div><span class="cart__scrim"></span><span class="cart__glare"></span><span class="cart__shine"></span></div>`));
    }
    // chrome: the number chip and the platform, the caption (decorative), four brackets
    assert.match(li, new RegExp(`<span class="pcard__no" aria-hidden="true">${no}</span><p class="pcard__plat">${p.platform}</p>`));
    assert.ok(li.includes(`<span class="pcard__cap" aria-hidden="true">${`${p.hero} // ${p.name}`.toUpperCase()}</span>`));
    assert.match(li, /<i class="pcard__brackets" aria-hidden="true"><\/i><\/article>/);
    // one link for keyboards: the name; the art is a pointer shortcut
    assert.match(li, /<a class="pcard__hit" href="[^"]+" tabindex="-1" aria-hidden="true">/);
    assert.match(li, /class="pcard__name" id="p-[\w-]+-name"><a class="pcard__link" href=/);
  }
});

test("the numeral's place and the pop part (DESIGN-1019 5.3): rig.json's numeral field, else after the back parts; one pop part drawn again unclipped", async () => {
  const { numeralAt } = await import("./render/cardart.ts");
  const parts = [{ id: "sky", depth: 0 }, { id: "far", depth: 0.3 }, { id: "body", depth: 0.7 }, { id: "fx", depth: 0.9 }];
  assert.equal(numeralAt({ v: 2, size: [9, 16], parts }), 2, "after the last part shallower than 0.34");
  assert.equal(numeralAt({ v: 2, size: [9, 16], numeral: "sky", parts }), 1, "rig.json names the part");
  assert.equal(numeralAt({ v: 2, size: [9, 16], numeral: "nope", parts }), 2);
  assert.equal(numeralAt({ v: 2, size: [9, 16], parts: [{ id: "body", depth: 0.7 }] }), 0, "no back parts: first");
  const css = readFileSync(new URL("./styles/pcard.css", import.meta.url), "utf8");
  // the clipped copy hides, the unclipped one shows; never under the pixel finish (its canvas draws every part)
  assert.match(css, /\.pcard \.cart \.rig__l\[data-pop\] \{ visibility: hidden; \}/);
  assert.match(css, /html\[data-cardfinish="pixel"\] \.pcard__pop \{ display: none; \}/);
  // pixel fonts on whole font pixels: the numeral 100 / 150 / 200 (Tesu Display, 25 px a font px), the name 32 / 48
  // (DotGothic16, 16)
  for (const [, px] of css.matchAll(/\.cart__num \{[^}]*?font(?:-size)?:[^;]*?(\d+)px/g)) assert.equal(+px % 25, 0, px);
  for (const [, px] of css.matchAll(/\.pcard__name \{[^}]*?font(?:-size)?:[^;]*?(\d+)px/g)) assert.equal(+px % 16, 0, px);
  // banned: animated shadows and filters, clip-path, rounded corners on the card
  assert.doesNotMatch(css, /backdrop-filter|clip-path|border-radius/);
  assert.doesNotMatch(css, /transition:[^;]*box-shadow/);
});

test("the card's motion (DESIGN-1019 5.5-5.7, 6.3): one owner per transform, idle on the compositor, still under reduced motion", () => {
  const ts = readFileSync(new URL("./motion/pcard.ts", import.meta.url), "utf8");
  const css = readFileSync(new URL("./styles/pcard.css", import.meta.url), "utf8");
  // the deck: one per list (a second initCards gets the same deck), nothing under reduced motion
  assert.match(ts, /const known = decks\.get\(list\);/);
  assert.match(ts, /const motion = !host\.reduced;/);
  for (const fn of ["settle", "prime", "entrance"]) {
    const body = ts.slice(ts.indexOf(`function ${fn}(`), ts.indexOf(`function ${fn}(`) + 400);
    assert.match(body, /if \(!motion\) return/, `${fn} does nothing under reduced motion`);
  }
  // the entrance as the spec times it
  for (const bit of ["x: s * 0.24 * vw, y: 48, rotation: s * 4", "scale: one ? 1.15 : 1.2", "x: s * l.z * 48", "x: -s * 80", 'ease: "back.out(1.6)"', "stagger: 0.018", "i * 0.11"]) assert.ok(ts.includes(bit), bit);
  // no layout reads in the ticker: the pointer reads its box on pointer events, the width on resize
  const tick = ts.slice(ts.indexOf("const tick = "), ts.indexOf("const wake = "));
  assert.doesNotMatch(tick, /getBoundingClientRect|offsetWidth|offsetHeight|clientWidth/);
  // idle loops only with motion allowed, paused off screen; the press and the plate are transforms, never shadows
  const idle = css.slice(css.indexOf("@media (prefers-reduced-motion: no-preference) {\n  /* idle: the card floats"));
  assert.match(idle, /pcard-float 6\.4s/);
  assert.match(css, /\.pcard__in\.is-off :is\(\.pcard__float, \.rig__p, \.rig__l, \.cart__shine, \.btn__ic\) \{ animation-play-state: paused; \}/);
  assert.match(css, /@keyframes pcard-scroll-tilt \{ from \{ transform: rotateX\(5deg\); \} to \{ transform: rotateX\(-5deg\); \} \}/);
  assert.doesNotMatch(css, /animation:[^;]*(?:box-shadow|filter)/);
  // pixel icons step, the rest is smooth
  assert.match(css, /pcard-nudge 3\.2s step-end/);
});

test("line art for the entrance (DESIGN-1019 addendum, Dex 10-19): <rig>/lines.svg in the format H delivers, <= 80 KB gzip", async () => {
  const { gzipSync } = await import("node:zlib");
  const { normaliseRig } = await import("./motion/rig-read.ts");
  for (const p of projects.filter((q) => q.art.rig)) {
    const dir = new URL(`../../public/site/cards/${p.id}/`, import.meta.url);
    if (!existsSync(new URL("lines.svg", dir))) continue; // (optional: the entrance plays without it)
    const svg = readFileSync(new URL("lines.svg", dir), "utf8");
    const rig = normaliseRig(JSON.parse(readFileSync(new URL("rig.json", dir), "utf8")));
    assert.match(svg, new RegExp(`^<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${rig.size[0]} ${rig.size[1]}">`), `${p.id}: viewBox = rig.size`);
    assert.ok(gzipSync(svg).length <= 80 * 1024, `${p.id}: ${Math.round(gzipSync(svg).length / 1024)} KB gzip`);
    assert.doesNotMatch(svg, /<(?:image|text|script|style|filter|mask|use)\b|fill="|stroke="|transform="/, `${p.id}: plain paths only`);
    const ids = new Set(rig.parts.map((q) => q.id));
    const groups = [...svg.matchAll(/<g data-part="([a-z0-9-]+)">/g)].map((m) => m[1]);
    assert.ok(groups.length > 0 && groups.every((g) => ids.has(g)), `${p.id}: every group names a rig part`);
    const stages = [...svg.matchAll(/<path data-stage="(\d)" d="M[^"]+"\/>/g)].map((m) => +m[1]);
    assert.ok(stages.length > 0 && stages.every((s) => s >= 1 && s <= 3), `${p.id}: paths with stages 1-3`);
    assert.ok(stages.includes(1), `${p.id}: a silhouette`);
  }
  const ts = readFileSync(new URL("./motion/pcard.ts", import.meta.url), "utf8");
  // the three phases in the entrance G already calls; without the file, the plain entrance
  assert.match(ts, /if \(c\.lines\.length\) drawn\(c, at\); else plain\(c, at\);/);
  assert.match(ts, /strokeDashoffset: 1\.05/);
});

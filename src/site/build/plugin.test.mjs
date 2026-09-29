// node --test: build-plugin HTML fixes and the shell's inline scripts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { stylesheetsFirst } from "./plugin.ts";
import { ARRIVAL, head, shell } from "../render/layout.ts";

const meta = { page: "docs", path: "/docs/", title: "Docs", description: "d" };

test("stylesheets move ahead of every head script (cross-document view transition opt-in)", () => {
  const html =
    `<!doctype html><html><head>\n    <meta charset="utf-8" />\n    <script>inline()</script>\n` +
    `    <script type="module" crossorigin src="/assets/main.js"></script>\n` +
    `    <link rel="stylesheet" crossorigin href="/assets/main.css">\n  </head><body><link rel="stylesheet" href="/body.css"></body></html>`;
  const out = stylesheetsFirst(html);
  const headPart = out.slice(0, out.indexOf("</head>"));
  const link = headPart.indexOf(`<link rel="stylesheet" crossorigin href="/assets/main.css">`);
  assert.ok(link > 0, "stylesheet kept in head");
  assert.ok(link < headPart.indexOf("<script>inline()"), "before inline scripts");
  assert.ok(link < headPart.indexOf(`<script type="module"`), "before module scripts");
  assert.equal(headPart.match(/rel="stylesheet"/g).length, 1, "moved, not copied");
  assert.ok(out.includes(`<body><link rel="stylesheet" href="/body.css"></body>`), "body untouched");
  // Nothing to move, or nothing to move ahead of: unchanged.
  const plain = `<html><head><script>x()</script></head><body></body></html>`;
  assert.equal(stylesheetsFirst(plain), plain);
});

test("the head guards cross-document view transitions without blocking navigation", () => {
  const h = head(meta);
  assert.match(h, /addEventListener\("pageswap"/);
  assert.match(h, /addEventListener\("pagereveal"/);
  assert.match(h, /skipTransition\(\)/);
  // Only aborted view transitions are marked handled; nothing awaits them.
  assert.match(h, /addEventListener\("unhandledrejection".*\/transition\/i\.test\(r\.message\)\)e\.preventDefault\(\)/);
  assert.doesNotMatch(h, /startViewTransition|\.then\(/);
});

test("the arrival script ships only on pages with deferred collage tiles", () => {
  const tiles = shell({ meta, main: `<ul><li><picture class="art__pic" data-defer><img data-src="/a.webp"></picture></li></ul>` });
  assert.ok(tiles.body.endsWith(ARRIVAL));
  const strip = shell({ meta, main: `<ul class="film"><li><img data-defer="lead" data-src="/t.webp"></li></ul>` });
  assert.ok(!strip.body.includes(ARRIVAL), "film strip only: nothing to prioritise");
  assert.ok(!shell({ meta, main: "<p>hi</p>" }).body.includes(ARRIVAL));
  // Rests at the #fragment's target, or where the page is without one; the
  // largest images in view (and any within 3%, a snapped pixel) load at high
  // priority next to a lead already in the markup, the rest in view queue as "lead".
  assert.match(ARRIVAL, /var h=location\.hash\.slice\(1\),t=null;if\(h\)try\{/);
  assert.match(ARRIVAL, /top=t\?.*:y0,/);
  assert.match(ARRIVAL, /querySelectorAll\("img\[fetchpriority=high\]"\)/);
  assert.match(ARRIVAL, /if\(s\[2\]<most\*0\.97\)\{el\.setAttribute\("data-defer","lead"\);return\}i\.setAttribute\("fetchpriority","high"\)/);
});

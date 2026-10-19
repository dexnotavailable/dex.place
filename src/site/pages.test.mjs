// node --test: the deep pages (lane P, 10-19): docs, posts, the 404, gallery pieces and the stubs carry the home page's
// kit on white; each reading page looks onto one place of the world through one window; the stubs say what works
// until they open, linking only pages that exist; the code on a doc reads on its pale well (WCAG AA).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadContent } from "./build/content.ts";
import { routes } from "./render/routes.ts";
import { STUBS, stubPage } from "./render/stubs.ts";
import { DEEP_PLACES } from "./render/deep.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const content = loadContent(ROOT);
const list = routes(content);
const render = (p) => {
  const r = list.find((x) => x.path === p);
  assert.ok(r, `route ${p}`);
  return r.render().body;
};
const windows = (html) => [...html.matchAll(/data-window="([a-z]+)"/g)].map((m) => m[1]);

test("every doc, post and the 404 looks onto its place through exactly one window", () => {
  assert.ok(content.docs.length && content.posts.length);
  for (const d of content.docs) assert.deepEqual(windows(render(d.url)), [DEEP_PLACES.doc], d.url);
  for (const p of content.posts) assert.deepEqual(windows(render(p.url)), [DEEP_PLACES.post], p.url);
  assert.deepEqual(windows(render("/404.html")), [DEEP_PLACES.notfound]);
  // the windows are decoration: hidden from screen readers
  for (const p of [content.docs[0].url, content.posts[0].url, "/404.html"]) {
    assert.match(render(p), /<div class="dh__win[^"]*" data-window="[a-z]+" aria-hidden="true">/, p);
  }
  // a gallery piece shows Dex's art, never a window beside it
  for (const g of content.gallery) assert.deepEqual(windows(render(`/gallery/${g.id}/`)), [], g.id);
});

test("a deep page's head: the way back as breadcrumbs, one h1, its article labelled by it", () => {
  for (const d of content.docs) {
    const html = render(d.url);
    assert.match(html, /<nav class="dh__crumbs" aria-label="Breadcrumb"><a href="\/docs\/">Docs<\/a>/, d.url);
    assert.match(html, /<h1 class="dh__title" id="page-title">/, d.url);
    assert.match(html, /<article class="doc__main" aria-labelledby="page-title">/, d.url);
    // the group crumb links the group on /docs/, which exists there
    const g = /<a href="\/docs\/#(g-[a-z0-9-]+)">/.exec(html)?.[1];
    assert.ok(g && render("/docs/").includes(`id="${g}"`), `${d.url} group crumb ${g}`);
  }
  for (const p of content.posts) {
    const html = render(p.url);
    assert.match(html, /<a href="\/blog\/">Blog<\/a>/, p.url);
    assert.match(html, /<article class="post" aria-labelledby="page-title">/, p.url);
    assert.match(html, new RegExp(`${p.minutes} min read`), p.url);
  }
  const nf = render("/404.html");
  assert.match(nf, /<h1 class="dh__title dh__title--display" id="page-title">Not found<\/h1>/);
  assert.match(nf, /data-hanko/);
  for (const href of ["/", "/projects/", "/downloads/", "/gallery/", "/docs/", "/blog/", "/donate/"]) assert.ok(nf.includes(`href="${href}"`), href);
});

test("the stubs say what works until they open, linking only real pages and anchors", () => {
  const paths = new Set(list.map((r) => r.path));
  for (const s of STUBS.filter((x) => x.href.startsWith(`/${x.id}/`))) {
    assert.ok(s.until, `${s.id} has an until line`);
    const html = stubPage(s.id);
    assert.match(html, /Until then/, s.id);
    assert.ok(html.includes(`href="${s.until.href}"`), s.id);
    const [p, hash] = s.until.href.split("#");
    assert.ok(paths.has(p), `${s.id}: ${p} is a page`);
    if (hash) assert.ok(render(p).includes(`id="${hash}"`), `${s.id}: #${hash} is on ${p}`);
  }
});

test("a gallery piece names the keys it answers to (motion/keys.ts: arrows, Escape)", () => {
  const html = render(`/gallery/${content.gallery[0].id}/`);
  assert.match(html, /<kbd>←<\/kbd><kbd>→<\/kbd>/);
  assert.match(html, /<kbd>Esc<\/kbd>/);
  assert.match(html, /data-key="ArrowLeft"/);
  assert.match(html, /data-key="ArrowRight"/);
});

// ------------------------------------------------------------------------------------------- styles

const css = (f) => readFileSync(new URL(`./styles/${f}`, import.meta.url), "utf8");

test("the deep pages' sheet loads last, after v2.css", () => {
  const site = css("site.css");
  assert.ok(site.indexOf('@import "./pages-v2.css";') > site.indexOf('@import "./v2.css";'));
  assert.ok(site.trimEnd().endsWith('@import "./pages-v2.css";'));
});

/** Every custom property set on :root in v2.css, resolved (one level of var() is enough there). */
function tokens() {
  const out = {};
  const root = /:root\s*\{([^}]*)\}/.exec(css("v2.css"))[1];
  for (const m of root.matchAll(/--([\w-]+):\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  const val = (v) => {
    const r = /^var\(--([\w-]+)\)$/.exec(v);
    return r ? val(out[r[1]]) : v;
  };
  return (v) => val(v);
}
const lum = (hex) => {
  const n = hex.replace("#", "");
  const c = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

test("code on a doc reads on its pale well: ink and every syntax colour pass WCAG AA (4.5:1)", () => {
  const res = tokens();
  const well = res("var(--sunk)");
  assert.match(well, /^#[0-9a-f]{6}$/i);
  const sheet = css("pages-v2.css");
  const pre = /\.prose \.code pre \{ color: ([^;]+); \}/.exec(sheet)[1];
  assert.ok(contrast(res(pre), well) >= 4.5, `code text ${res(pre)}`);
  for (const k of ["c", "s", "n", "k", "v", "f", "p"]) {
    const c = new RegExp(`\\.t-${k} \\{ color: ([^;]+); \\}`).exec(sheet)?.[1];
    assert.ok(c, `.t-${k} is set for white`);
    const hex = res(c);
    assert.ok(contrast(hex, well) >= 4.5, `.t-${k} ${hex}: ${contrast(hex, well).toFixed(2)}:1`);
  }
});

test("a project's own page: the deep pages' kicker leads back to /projects/ and counts its place", () => {
  for (const r of list.filter((x) => /^\/projects\/[^/]+\/$/.test(x.path))) {
    const html = r.render().body;
    assert.match(html, /<nav class="dh__crumbs" aria-label="Breadcrumb"><a href="\/projects\/">Projects<\/a><\/nav>/, r.path);
    assert.match(html, /class="counter dh__aside"><b>0\d<\/b>/, r.path);
    assert.doesNotMatch(html, /class="crumbs"/, `${r.path}: no second breadcrumb row`);
  }
});

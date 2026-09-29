// node --test: the markdown/data loader and the routes it produces.
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadContent, parseFrontmatter, renderMarkdown } from "./content.ts";
import { blogFeed, routes } from "../render/routes.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

test("frontmatter: key/value lines, CRLF tolerated, fence required", () => {
  const { meta, body } = parseFrontmatter("---\r\ntitle: A: b\r\nplaceholder: true\r\n---\r\nHello", "x.md");
  assert.deepEqual(meta, { title: "A: b", placeholder: "true" });
  assert.equal(body, "Hello");
  assert.throws(() => parseFrontmatter("no fence", "x.md"), /frontmatter/);
});

test("markdown: headings get unique ids, h1 is demoted", () => {
  const { html, headings } = renderMarkdown("# Top\n\n## Install\n\n## Install\n\n### Why `x`?");
  assert.match(html, /<h2 id="top">/);
  assert.deepEqual(headings.map((h) => h.id), ["top", "install", "install-2", "why-x"]);
});

test("repo content loads; every route is unique; placeholders are noindex and not in the feed", () => {
  const content = loadContent(ROOT);
  assert.equal(content.gallery.length, 9);
  for (const item of content.gallery) assert.match(item.id, /^\d{2}$/);
  const list = routes(content);
  const paths = list.map((r) => r.path);
  assert.equal(new Set(paths).size, paths.length);
  for (const p of ["/", "/downloads/", "/gallery/", "/gallery/01/", "/docs/", "/blog/", "/donate/", "/404.html"]) {
    assert.ok(paths.includes(p), p);
  }
  for (const e of [...content.docs, ...content.posts].filter((x) => x.placeholder)) {
    const page = list.find((r) => r.path === e.url)?.render();
    assert.ok(page, e.url);
    assert.match(page.head, /name="robots" content="noindex"/);
    assert.match(page.body, /Placeholder/);
  }
  assert.doesNotMatch(blogFeed(content), /<item>/);
});

test("every page has one h1, a main landmark and no external asset URLs", () => {
  for (const r of routes(loadContent(ROOT))) {
    const { body } = r.render();
    assert.equal((body.match(/<h1[\s>]/g) ?? []).length, 1, `${r.path} h1 count`);
    assert.match(body, /<main id="main"/, r.path);
    assert.doesNotMatch(body, /(src|srcset)="https?:/, r.path);
  }
});

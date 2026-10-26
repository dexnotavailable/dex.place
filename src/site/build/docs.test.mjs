// node --test: docs and blog (markdown extras, grouping, ordering, pages).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { countWords, loadContent, loadEntries, readingMinutes, renderMarkdown } from "./content.ts";
import { highlight, langLabel } from "./highlight.ts";
import { HOME_POSTS, docsSection, groupedDocs, postsByYear } from "../render/docs.ts";
import { routes } from "../render/routes.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function fixture(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dexplace-docs-"));
  for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), text);
  return dir;
}

test("code fences: label bar, copy button without prompts, escaped and coloured", () => {
  const { html } = renderMarkdown('```powershell title="Check it"\nPS> Get-FileHash .\\a.exe -Algorithm SHA256 # <hash>\n```\n');
  assert.match(html, /<figure class="code" data-lang="powershell">/);
  assert.match(html, /<span class="code__lang">PowerShell<\/span>/);
  assert.match(html, /<span class="code__title">Check it<\/span>/);
  assert.match(html, /data-copy="Get-FileHash .\\a.exe -Algorithm SHA256 # &lt;hash&gt;"/);
  assert.match(html, /<span class="t-p">PS&gt; <\/span>/);
  assert.match(html, /<span class="t-k">Get-FileHash<\/span>/);
  assert.match(html, /<span class="t-f">-Algorithm<\/span>/);
  assert.match(html, /<span class="t-c"># &lt;hash&gt;<\/span>/);
  assert.match(html, /<pre tabindex="0"/);
  assert.doesNotMatch(html, /<hash>/);
});

test("highlight: unknown languages are only escaped; keywords match whole words", () => {
  assert.equal(highlight("<b>&", "brainfuck"), "&lt;b&gt;&amp;");
  assert.equal(highlight("important", "ts"), "important");
  assert.equal(highlight("const x = 'a'", "ts"), '<span class="t-k">const</span> x = <span class="t-s">\'a\'</span>');
  assert.equal(
    highlight("title: Hello\ndraft: true\n# note\ntags:\n  - one", "yaml"),
    '<span class="t-k">title</span>: Hello\n<span class="t-k">draft</span>: <span class="t-v">true</span>\n' +
      '<span class="t-c"># note</span>\n<span class="t-k">tags</span>:\n  - one',
  );
  assert.equal(langLabel("ps1"), "PowerShell");
  assert.equal(langLabel(""), null);
});

test("callouts, tables and external links", () => {
  const { html } = renderMarkdown(
    "> [!WARNING]\n> Careful.\n\n> Plain quote.\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n[k](https://ko-fi.com/x) [d](/docs/)",
  );
  assert.match(html, /<div class="callout callout--magenta" role="note"><p class="callout__label">.*<span>Warning<\/span><\/p><div class="callout__body"><p>Careful\.<\/p>/s);
  assert.match(html, /<blockquote>\n<p>Plain quote\.<\/p>/);
  assert.match(html, /<div class="table" role="region" tabindex="0" aria-label="Table"><table>[\s\S]*<\/table><\/div>/);
  assert.match(html, /<a class="ext" href="https:\/\/ko-fi.com\/x" rel="noopener">k<span class="sr"> \(another site\)<\/span><\/a>/);
  assert.match(html, /<a href="\/docs\/">d<\/a>/);
});

test("reading time is whole minutes, at least one", () => {
  assert.equal(countWords("## Hi there\n\n- one `two`"), 4);
  assert.equal(readingMinutes(10), 1);
  assert.equal(readingMinutes(660), 3);
});

test("docs sort by group, then order, then title; unknown groups fail the build", () => {
  const dir = fixture({
    "b.md": "---\ntitle: B\ngroup: dex-place\norder: 1\n---\n",
    "a.md": "---\ntitle: A\ngroup: dexclient\norder: 2\n---\n",
    "c.md": "---\ntitle: C\ngroup: dexclient\norder: 1\n---\n",
    "d.md": "---\ntitle: D\n---\n",
    "e.md": "---\ntitle: E\ngroup: dexcode\n---\n",
  });
  const docs = loadEntries(dir, "docs");
  assert.deepEqual(docs.map((d) => d.slug), ["e", "c", "a", "b", "d"]);
  assert.deepEqual(groupedDocs(docs).map((g) => g.group.id), ["dexcode", "dexclient", "dex-place", "other"]);
  const bad = fixture({ "x.md": "---\ntitle: X\ngroup: dexclinet\n---\n" });
  assert.throws(() => loadEntries(bad, "docs"), /group "dexclinet"/);
});

test("posts: newest first, bucketed by year, undated drafts last", () => {
  const dir = fixture({
    "old.md": "---\ntitle: Old\ndate: 2025-12-31\n---\n",
    "new.md": "---\ntitle: New\ndate: 2026-09-01\n---\n",
    "draft.md": "---\ntitle: Draft\n---\n",
    "mid.md": "---\ntitle: Mid\ndate: 2026-02-10\n---\n",
  });
  const posts = loadEntries(dir, "blog");
  assert.deepEqual(posts.map((p) => p.slug), ["new", "mid", "old", "draft"]);
  assert.deepEqual(postsByYear(posts).map((y) => [y.label, y.posts.length]), [["2026", 2], ["2025", 1], ["Drafts", 1]]);
  assert.equal(posts[3]?.group, null);
});

test("repo docs and blog pages: grouped index, sidebar, contents, pager, placeholders marked", () => {
  const content = loadContent(ROOT);
  const list = routes(content);
  const render = (p) => list.find((r) => r.path === p)?.render();

  const index = render("/docs/");
  for (const g of groupedDocs(content.docs)) assert.match(index.body, new RegExp(`id="g-${g.group.id}"`));
  for (const d of content.docs) assert.ok(index.body.includes(`href="${d.url}"`), d.url);

  for (const d of content.docs) {
    const page = render(d.url);
    assert.match(page.body, /<nav class="dside" aria-label="All docs">/, d.url);
    assert.equal((page.body.match(/aria-current="page"/g) ?? []).length >= 2, true, `${d.url} marks itself`);
    assert.match(page.head, /<title>.* · .* · dex<\/title>/, d.url);
    if (d.headings.filter((h) => h.depth <= 3).length >= 2) assert.match(page.body, /data-toc/, d.url);
  }

  const blog = render("/blog/");
  assert.match(blog.body, /href="\/blog\/feed.xml"/);
  for (const p of content.posts) {
    assert.ok(blog.body.includes(`href="${p.url}"`), p.url);
    const page = render(p.url);
    assert.match(page.body, /min read/);
    if (p.placeholder) assert.match(page.body, /tag--ph/);
    if (!p.date) assert.match(page.body, /Draft, not dated/);
  }
});

test("home section: docs catalogue, the latest posts as rows, older posts folded but still linked", () => {
  const dir = fixture(
    Object.fromEntries(
      Array.from({ length: HOME_POSTS + 2 }, (_, i) => [`p${i}.md`, `---\ntitle: Post ${i}\ndate: 2026-0${i + 1}-15\n---\n`]),
    ),
  );
  const posts = loadEntries(dir, "blog");
  const docs = loadContent(ROOT).docs;
  const html = docsSection({ docs, posts, gallery: [] });
  assert.ok(html.indexOf('id="docs"') < html.indexOf('id="blog"'), "docs before blog, like the nav");
  assert.equal((html.match(/class="bpost"/g) ?? []).length, HOME_POSTS);
  assert.match(html, /<details class="bmore">/);
  for (const p of posts) assert.ok(html.includes(`href="${p.url}"`), p.url);
  for (const d of docs) assert.ok(html.includes(`href="${d.url}"`), d.url);
  // Headings nest under the section's h2: part heads h3, groups and posts h4.
  assert.doesNotMatch(html, /<h[156][ >]/);
  assert.equal((html.match(/<h3[ >]/g) ?? []).length, 2);
  const few = docsSection({ docs, posts: posts.slice(0, 2), gallery: [] });
  assert.doesNotMatch(few, /bmore/);
});

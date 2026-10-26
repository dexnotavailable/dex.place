// node --test: same-day publication order across the blog's consumers.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadEntries } from "./content.ts";
import { HOME_POSTS, blogIndex, docsSection, postPage, postsByYear } from "../render/docs.ts";
import { blogFeed } from "../render/routes.ts";

function fixture(t, files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dexplace-blog-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), text);
  return dir;
}

const post = (title, fields = "date: 2026-10-01\n") => `---\ntitle: ${title}\n${fields}---\nBody.\n`;

test("same-day numbered posts sort by publication sequence, including an unnumbered title", (t) => {
  const dir = fixture(t, {
    "characterforge-02-second.md": post("CharacterForge 02: second"),
    "characterforge-03-live-build-log.md": post("CharacterForge live build log"),
    "characterforge-10-latest.md": post("CharacterForge update 10: latest"),
    "characterforge-09-before.md": post("CharacterForge update 09: before"),
    "characterforge-12-next.md": post("A newer update"),
    "unrelated.md": post("A newer day", "date: 2026-10-02\nsequence: 1\n"),
    "old-99.md": post("An older day", "date: 2025-12-31\n"),
    "draft-99.md": post("Z draft", ""),
    "draft-01.md": post("A draft", ""),
  });
  const posts = loadEntries(dir, "blog");
  assert.deepEqual(posts.map((p) => p.slug), [
    "unrelated", "characterforge-12-next", "characterforge-10-latest", "characterforge-09-before",
    "characterforge-03-live-build-log", "characterforge-02-second", "old-99", "draft-01", "draft-99",
  ]);
  assert.deepEqual(postsByYear(posts).map((g) => [g.label, g.posts.length]), [["2026", 6], ["2025", 1], ["Drafts", 2]]);
  assert.equal(posts.at(-1).date, null, "a sequence never invents a publication date");
});

test("explicit sequence overrides the slug; equal sequences retain deterministic title/slug order", (t) => {
  const dir = fixture(t, {
    "series-99-title.md": post("A title", "date: 2026-10-01\nsequence: 2\n"),
    "no-number.md": post("Z title", "date: 2026-10-01\nsequence: 10\n"),
    "b.md": post("Same", "date: 2026-10-01\nsequence: 2\n"),
    "a.md": post("Same", "date: 2026-10-01\nsequence: 2\n"),
    "zero.md": post("Explicit zero", "date: 2026-10-01\nsequence: 0\n"),
  });
  assert.deepEqual(loadEntries(dir, "blog").map((p) => p.slug), ["no-number", "series-99-title", "a", "b", "zero"]);
  const docs = loadEntries(dir, "docs");
  assert.deepEqual(docs.map((p) => p.slug), ["series-99-title", "zero", "a", "b", "no-number"]);
  assert.ok(docs.every((p) => p.sequence === 0), "blog sequence does not affect docs");
});

test("bad explicit sequences fail instead of silently falling back to title order", (t) => {
  for (const sequence of ["-1", "1.5", "NaN", "", "9007199254740992"]) {
    const dir = fixture(t, { "post.md": post("Post", `date: 2026-10-01\nsequence: ${sequence}\n`) });
    assert.throws(() => loadEntries(dir, "blog"), /sequence must be a non-negative safe integer/);
  }
});

test("home, blog, RSS and newer/older links consume the same newest-first order", (t) => {
  const dir = fixture(t, Object.fromEntries(
    Array.from({ length: HOME_POSTS + 2 }, (_, i) => [
      `series-${i + 1}-post.md`, post(i === 2 ? "Live build log" : `Update ${i + 1}`),
    ]),
  ));
  fs.writeFileSync(path.join(dir, "draft.md"), post("Draft", ""));
  fs.writeFileSync(path.join(dir, "placeholder.md"), post("Placeholder", "date: 2026-10-01\nsequence: 0\nplaceholder: true\n"));
  const posts = loadEntries(dir, "blog");
  const content = { docs: [], gallery: [], posts };
  const expected = Array.from({ length: HOME_POSTS + 2 }, (_, i) => `/blog/series-${HOME_POSTS + 2 - i}-post/`);
  for (const html of [blogIndex(content), docsSection(content)]) {
    const positions = expected.map((url) => html.indexOf(`href="${url}"`));
    assert.ok(positions.every((at, i) => at >= 0 && (!i || at > positions[i - 1])), "rendered rows keep the loader's order");
  }
  const home = docsSection(content);
  const collapsed = home.indexOf('<details class="bmore">');
  assert.ok(home.indexOf(`href="${expected[HOME_POSTS - 1]}"`) < collapsed);
  assert.ok(home.indexOf(`href="${expected[HOME_POSTS]}"`) > collapsed);
  const feed = blogFeed(content);
  assert.deepEqual([...feed.matchAll(/<item>.*?<link>https:\/\/dex.place(.*?)<\/link>/g)].map((m) => m[1]), expected);
  assert.doesNotMatch(feed, /\/blog\/(?:draft|placeholder)\//);
  const middle = posts[1];
  const page = postPage(content, middle);
  assert.match(page, new RegExp(`href="${expected[0]}"[^>]*>[\\s\\S]*?Newer`));
  assert.match(page, new RegExp(`href="${expected[2]}"[^>]*>[\\s\\S]*?Older`));
});

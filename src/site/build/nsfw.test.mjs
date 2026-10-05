// node --test: NSFW posts and images (render/nsfw.ts, CANON.md "Blog content").
// A post can be tagged `nsfw: true`; an image is marked by the title "nsfw"
// (markdown) or data-nsfw (raw <img>, which the publisher writes). Every
// marked image becomes a blurred spoiler, and its file never appears anywhere
// else: not in the feed, a meta tag, an index card or another page.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadEntries, renderMarkdown } from "./content.ts";
import { blogIndex, docsSection, postPage } from "../render/docs.ts";
import { blogFeed, nsfwLeaks, routes } from "../render/routes.ts";
import { NSFW_BLUR, findNsfwLeaks, hideNsfwImages, nsfwImageUrls } from "../render/nsfw.ts";

const IMG = "/blog/adult-post/body-front.webp";
const IMG2 = "/blog/adult-post/body-back.webp";

function fixture(t, files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dexplace-nsfw-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), text);
  return dir;
}

const BODY =
  `Intro text.\n\n![Front view of the body](${IMG} "nsfw")\n\n` +
  `<img src="${IMG2}" width="1600" height="900" alt="Back view" loading="lazy" decoding="async" data-nsfw>\n\n` +
  `![A clay head](/blog/adult-post/head.webp "A tooltip")\n`;

function site(t, { frontmatter = "nsfw: true\n", body = BODY } = {}) {
  const dir = fixture(t, {
    "adult-post.md": `---\ntitle: An adult post\nsummary: Body renders, blurred.\ndate: 2026-10-06\n${frontmatter}---\n${body}`,
    "plain-post.md": `---\ntitle: A plain post\nsummary: Nothing adult.\ndate: 2026-10-05\n---\nHello.\n`,
  });
  return { docs: [], gallery: [], posts: loadEntries(dir, "blog") };
}

const adult = (content) => content.posts.find((p) => p.slug === "adult-post");

// ------------------------------------------------------------ frontmatter

test("frontmatter nsfw: true tags the post; absent or false does not", (t) => {
  const content = site(t);
  assert.equal(adult(content).nsfw, true);
  assert.equal(content.posts.find((p) => p.slug === "plain-post").nsfw, false);
  const off = site(t, { frontmatter: "nsfw: false\n", body: "Text only.\n" });
  assert.equal(adult(off).nsfw, false);
  const text = site(t, { body: "Text only, but still adult.\n" });
  assert.equal(adult(text).nsfw, true, "a text-only post may be tagged too");
});

test("a bad nsfw value fails the build; so does an NSFW image in an untagged post", (t) => {
  const bad = fixture(t, { "p.md": "---\ntitle: P\nnsfw: yes\n---\nBody.\n" });
  assert.throws(() => loadEntries(bad, "blog"), /nsfw must be true or false/);
  const untagged = fixture(t, { "p.md": `---\ntitle: P\n---\n![alt](${IMG} "nsfw")\n` });
  assert.throws(() => loadEntries(untagged, "blog"), /needs nsfw: true/);
});

// ------------------------------------------------------- image -> spoiler

test("a markdown image titled nsfw becomes a blurred spoiler with a real button", () => {
  const { html } = renderMarkdown(`![Front view](${IMG} "nsfw")`);
  assert.match(html, /<img class="nsfw__img"/);
  assert.match(html, new RegExp(`src="${IMG}"`));
  assert.match(html, /<button class="btn btn--yellow btn--s nsfw__show" type="button" data-nsfw-show>Show image<span class="sr"> \(NSFW\)<\/span><\/button>/);
  assert.match(html, /<button [^>]*data-nsfw-hide>Hide image/);
  assert.match(html, /class="tag tag--nsfw">NSFW</);
  assert.ok(html.includes(`style="filter:${NSFW_BLUR}"`), "the blur is inline, so it holds even if the stylesheet does not load");
  // The alt text is not on the image until it is opened; no tooltip either.
  assert.match(html, /<img [^>]*alt="" data-alt="Front view"/);
  assert.doesNotMatch(html, /title="nsfw"/);
  assert.doesNotMatch(html, /<img(?![^>]*nsfw__img)/, "no unblurred <img> is left");
});

test("a raw <img data-nsfw> (what the publisher writes) keeps its size and loading hints", () => {
  const { html } = renderMarkdown(`<img src="${IMG2}" width="1600" height="900" alt="Back &quot;view&quot;" loading="lazy" decoding="async" data-nsfw>`);
  assert.match(html, /<img class="nsfw__img" src="[^"]+" width="1600" height="900" loading="lazy" decoding="async" alt="" data-alt="Back &quot;view&quot;" style=/);
  assert.match(html, /nsfw__show/);
});

test("markdown and raw markers give the same markup, and defaults are added", () => {
  const a = renderMarkdown(`![x](${IMG} "nsfw")`).html;
  const b = renderMarkdown(`<img src="${IMG}" alt="x" data-nsfw>`).html;
  const spoiler = (html) => /<span class="nsfw">[\s\S]*<\/span><\/span>/.exec(html)[0];
  assert.equal(spoiler(a), spoiler(b));
  assert.match(a, /loading="lazy" decoding="async"/);
});

test("unmarked images, other titles and data-nsfw=false are left alone", () => {
  const { html } = renderMarkdown(
    `![clay head](/a.webp "A tooltip")\n\n![plain](/b.webp)\n\n<img src="/c.webp" alt="c" data-nsfw="false">\n`,
  );
  assert.doesNotMatch(html, /nsfw__|tag--nsfw/);
  assert.match(html, /<img src="\/a\.webp" alt="clay head" title="A tooltip">/);
  assert.match(html, /<img src="\/b\.webp" alt="plain">/);
});

test("code samples that show the marker are not turned into images", () => {
  const { html } = renderMarkdown("```html\n<img src=\"/a.webp\" data-nsfw>\n```\n\nUse `![alt](a.webp \"nsfw\")`.");
  assert.doesNotMatch(html, /nsfw__img/);
});

test("an NSFW image inside a link fails the build instead of linking the open file", () => {
  assert.throws(() => renderMarkdown(`[![alt](${IMG} "nsfw")](${IMG})`), /inside a link/);
});

// ------------------------------------------------------------- tag on pages

test("the post page, the blog index and the home list show an NSFW tag", (t) => {
  const content = site(t);
  const post = adult(content);
  assert.match(postPage(content, post), /<p class="ahead__facts"><span class="tag tag--nsfw">NSFW<\/span>/);
  assert.doesNotMatch(postPage(content, content.posts.find((p) => p.slug === "plain-post")), /tag--nsfw/);
  const index = blogIndex(content);
  assert.match(index, /An adult post<\/a>[\s\S]*?class="tag tag--nsfw">NSFW<[\s\S]*?A plain post/, "the card shows the tag, the plain card does not");
  assert.equal([...index.matchAll(/tag--nsfw/g)].length, 1, "only the adult post's card");
  assert.match(docsSection(content), /tag--nsfw/);
});

test("the NSFW post's head says adult and asks not to index images; the card has no image", (t) => {
  const content = site(t);
  const all = routes(content);
  const page = all.find((r) => r.path === "/blog/adult-post/").render();
  assert.match(page.head, /<meta name="robots" content="noimageindex" \/>/);
  assert.match(page.head, /<meta name="rating" content="adult" \/>/);
  assert.match(page.head, /name="description" content="NSFW\. Body renders, blurred\."/);
  assert.doesNotMatch(page.head, /og:image|twitter:image|rel="preload"[^>]*image|rel="prefetch"/);
  const plain = all.find((r) => r.path === "/blog/plain-post/").render();
  assert.doesNotMatch(plain.head, /noimageindex|rating/);
});

// -------------------------------------------------------------------- feed

test("the feed marks the post NSFW and carries no image, file name or body", (t) => {
  const content = site(t);
  const feed = blogFeed(content);
  const item = /<item>(?:(?!<\/item>)[\s\S])*adult-post[\s\S]*?<\/item>/.exec(feed)[0];
  assert.match(item, /<title>\[NSFW\] An adult post<\/title>/);
  assert.match(item, /<category>NSFW<\/category>/);
  assert.match(item, /<description>NSFW: adult content, images hidden here\. View on dex\.place: https:\/\/dex\.place\/blog\/adult-post\/ Body renders, blurred\.<\/description>/);
  assert.doesNotMatch(feed, /<img|body-front|body-back|\.webp/);
  assert.doesNotMatch(feed.replace(item, ""), /NSFW/, "the plain post is not marked");
});

test("hideNsfwImages replaces every spoiler with one line of text and the post link", () => {
  const { html } = renderMarkdown(`Before.\n\n![a](${IMG} "nsfw")\n\n![clay](/c.webp)\n\n<img src="${IMG2}" alt="b" data-nsfw>\n\nAfter.`);
  const safe = hideNsfwImages(html, "https://dex.place/blog/adult-post/");
  assert.equal([...safe.matchAll(/NSFW image hidden: <a href="https:\/\/dex\.place\/blog\/adult-post\/">view on dex\.place<\/a>/g)].length, 2);
  assert.doesNotMatch(safe, /body-front|body-back|nsfw__|<button/);
  assert.match(safe, /<img src="\/c\.webp" alt="clay">/, "ordinary images are untouched");
  assert.match(safe, /Before\.[\s\S]*After\./);
});

// ------------------------------------------------------------- leak guard

test("the NSFW file URLs are collected from src and srcset", () => {
  const { html } = renderMarkdown(`<img src="/a.webp" srcset="/a-800.webp 800w, /a-400.webp 400w" alt="" data-nsfw>`);
  assert.deepEqual(nsfwImageUrls(html).sort(), ["/a-400.webp", "/a-800.webp", "/a.webp"]);
});

test("a clean site has no leaks, and the guard sees a file used outside its spoiler", (t) => {
  const content = site(t);
  assert.deepEqual(nsfwLeaks(content), []);
  const urls = adult(content).nsfwImages;
  assert.deepEqual(urls.sort(), [IMG2, IMG].sort());
  // Own page: only the spoiler <img> may carry the file.
  const own = postPage(content, adult(content));
  assert.deepEqual(findNsfwLeaks(own, urls, true), []);
  assert.deepEqual(findNsfwLeaks(own, urls, false).sort(), urls.slice().sort(), "any other page may not carry it at all");
  const og = `<meta property="og:image" content="https://dex.place${IMG}" />`;
  assert.deepEqual(findNsfwLeaks(og + own, urls, true), [IMG]);
  assert.deepEqual(findNsfwLeaks(`<link rel="prefetch" href="${IMG2}">`, urls, true), [IMG2]);
});

test("a leak through a summary, a meta image or the feed fails nsfwLeaks", (t) => {
  const content = site(t);
  const leakySummary = {
    ...content,
    posts: content.posts.map((p) => (p.slug === "plain-post" ? { ...p, summary: `See ${IMG}`, html: `<img src="${IMG}" alt="">` } : p)),
  };
  const found = nsfwLeaks(leakySummary);
  assert.ok(found.some((m) => m.startsWith("/blog/plain-post/ shows")), "another post's page");
  assert.ok(found.some((m) => m.startsWith("/blog/ shows")), "the blog index card");
  assert.ok(found.some((m) => m.startsWith("/ shows")), "the home list");
  assert.ok(found.some((m) => /blog feed would carry NSFW images/.test(m)), "the feed");
});

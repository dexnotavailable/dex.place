// Documentation and blog (DESIGN-SYSTEM.md §7): the "Docs & blog" home-page
// section, /docs/, /docs/<slug>/, /blog/, /blog/<slug>/. Built from content/docs and content/blog markdown by
// build/content.ts. Complete without JavaScript; motion/toc.ts only adds the
// scroll-spy and anchor copying.

import { DOC_GROUPS, OTHER_GROUP, docGroup, type DocGroup } from "../data/docs.ts";
import { floats } from "./floats.ts";
import { button, icon, pageHead, placeholderTag, sectionHead, strip, tile } from "./glyphs.ts";
import { cx, esc, pad2 } from "./html.ts";
import { nsfwTag } from "./nsfw.ts";
import type { Entry, SiteContent } from "./types.ts";

const plural = (n: number, one: string, many: string): string => `${pad2(n)} ${n === 1 ? one : many}`;

/** Docs bucketed by group, in data/docs.ts order; empty groups dropped. */
export function groupedDocs(docs: readonly Entry[]): { group: DocGroup; docs: Entry[] }[] {
  return [...DOC_GROUPS, OTHER_GROUP]
    .map((group) => ({ group, docs: docs.filter((d) => docGroup(d.group).id === group.id) }))
    .filter((g) => g.docs.length > 0);
}

// ---------------------------------------------------------------- dates

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

function dateParts(date: string): { y: string; m: string; d: string; long: string } {
  const [y = "", mm = "1", d = ""] = date.split("-");
  const m = MONTHS[Number(mm) - 1] ?? "";
  return { y, m, d, long: `${Number(d)} ${m} ${y}` };
}

/** Calendar block: day over month, or a dashed "Draft" block when undated. */
function dateBlock(e: Entry, tone: "cyan" | "paper" = "cyan"): string {
  if (!e.date) {
    return `<span class="dblock dblock--draft" aria-hidden="true"><span class="dblock__m">Draft</span></span>`;
  }
  const p = dateParts(e.date);
  return (
    `<span class="dblock dblock--${tone}" aria-hidden="true">` +
    `<span class="dblock__d">${p.d}</span><span class="dblock__m">${p.m}</span></span>`
  );
}

function dateText(e: Entry): string {
  return e.date
    ? `<time datetime="${e.date}">${dateParts(e.date).long}</time>`
    : `<span>Draft, not dated</span>`;
}

// ----------------------------------------------------------- docs index

function docLink(e: Entry, i: number): string {
  return (
    `<li><a class="dlink" href="${e.url}" data-reveal style="--i:${Math.min(i, 5)}">` +
    `<span class="dlink__main"><span class="dlink__title">${esc(e.title)}</span>` +
    (e.summary ? `<span class="dlink__sum">${esc(e.summary)}</span>` : "") +
    `</span>` +
    (e.placeholder ? placeholderTag() : "") +
    `<span class="dlink__go" aria-hidden="true">${icon("arrow", 2)}</span>` +
    `</a></li>`
  );
}

/**
 * The docs catalogue: one row per project group (tone edge, tile, name, real
 * count), its docs as full-width index lines beside it that pop on hover. Rows
 * grow with the docs, so a group with one page never leaves an empty box.
 * Group titles at `level`.
 */
function docGroups(content: SiteContent, level: 2 | 3 | 4): string {
  const groups = groupedDocs(content.docs);
  const h = `h${level}`;
  if (!groups.length) return `<p class="empty">Nothing here yet.</p>`;
  return (
    `<div class="dcat" data-reveal="pop-block">` +
    groups
      .map(({ group, docs }) =>
        `<section class="dgroup dgroup--${group.tone}" aria-labelledby="g-${group.id}">` +
        `<header class="dgroup__head">${tile(group.icon, group.tone, "s")}` +
        `<${h} class="dgroup__title" id="g-${group.id}">${esc(group.label)}</${h}>` +
        `<span class="dgroup__count">${plural(docs.length, "page", "pages")}</span></header>` +
        `<ol class="dgroup__list">${docs.map(docLink).join("")}</ol>` +
        `</section>`,
      )
      .join("") +
    `</div>`
  );
}

export function docsIndex(content: SiteContent): string {
  return (
    `<div class="page page--docs">` +
    floats("docs", { tone: "cyan", count: 3, glyph: "sparkle" }) +
    `<div class="wrap">` +
    pageHead({ kicker: "documentation", title: "Docs", tone: "cyan", icon: "book", aside: plural(content.docs.length, "page", "pages") }) +
    docGroups(content, 2) +
    `</div></div>`
  );
}

// ----------------------------------------------------------- blog index

/** One post as an index row: date block, title and summary, facts, arrow. The whole row is the link. */
function postItem(e: Entry, i: number, level: 2 | 3 | 4 = 3): string {
  const h = `h${level}`;
  return (
    `<li class="bpost" data-reveal style="--i:${Math.min(i, 5)}">` +
    dateBlock(e) +
    `<div class="bpost__main">` +
    `<${h} class="bpost__title"><a class="bpost__link" href="${e.url}">${esc(e.title)}</a></${h}>` +
    (e.summary ? `<p class="bpost__sum">${esc(e.summary)}</p>` : "") +
    `</div>` +
    `<p class="bpost__meta">${e.nsfw ? nsfwTag() : ""}${e.placeholder ? placeholderTag() : ""}` +
    `<span class="when">${dateText(e)}<span aria-hidden="true"> · </span><span>${e.minutes} min read</span></span></p>` +
    `<span class="bpost__go" aria-hidden="true">${icon("arrow", 3)}</span>` +
    `</li>`
  );
}

/** Posts bucketed by year (newest first), undated drafts last. */
export function postsByYear(posts: readonly Entry[]): { label: string; id: string; posts: Entry[] }[] {
  const out: { label: string; id: string; posts: Entry[] }[] = [];
  for (const p of posts) {
    const label = p.date ? p.date.slice(0, 4) : "Drafts";
    let bucket = out.find((b) => b.label === label);
    if (!bucket) {
      bucket = { label, id: `y-${label.toLowerCase()}`, posts: [] };
      out.push(bucket);
    }
    bucket.posts.push(p);
  }
  return out;
}

export function blogIndex(content: SiteContent): string {
  const posts = content.posts;
  const years = postsByYear(posts);
  const list = years.length
    ? years
        .map((y) =>
          `<section class="byear" aria-labelledby="${y.id}">` +
          `<h2 class="byear__label" id="${y.id}" data-reveal="pop">${esc(y.label)}</h2>` +
          `<ol class="bposts">${y.posts.map((p, i) => postItem(p, i)).join("")}</ol>` +
          `</section>`,
        )
        .join("")
    : `<p class="empty">Nothing here yet.</p>`;
  return (
    `<div class="page page--blog">` +
    floats("blog", { tone: "cyan", count: 2, span: 0.35, glyph: "star" }) +
    `<div class="wrap">` +
    pageHead({ kicker: "blog", title: "Blog", tone: "cyan", icon: "page", aside: plural(posts.length, "post", "posts") }) +
    `<div class="btools"><p class="btools__order">Newest first</p>` +
    button({ href: "/blog/feed.xml", label: "RSS feed", icon: "rss", iconFirst: true, size: "s", tone: "paper" }) +
    `</div>` +
    list +
    `</div></div>`
  );
}

// ------------------------------------------------------ home section

/** Posts shown in the home section; the rest are one key away on /blog/. */
export const HOME_POSTS = 4;

/** Every post past the latest few, as a compact folded list, so the whole blog stays reachable in place. */
function olderPosts(rest: readonly Entry[]): string {
  return (
    `<details class="bmore"><summary class="bmore__sum pop">${icon("plus", 2, "bmore__ic")}<span>Older posts</span>` +
    `<span class="bmore__n">${pad2(rest.length)}</span></summary>` +
    `<ol class="bmore__list">` +
    rest
      .map((p) => `<li><a class="bmore__link" href="${p.url}"><span>${p.nsfw ? `${nsfwTag()} ` : ""}${esc(p.title)}</span><span class="bmore__when">${p.date ? dateParts(p.date).long : "Draft"}</span></a></li>`)
      .join("") +
    `</ol></details>`
  );
}

/**
 * "Docs & blog" on the home page: the docs catalogue, then the latest posts.
 * Docs come first to match the nav order, so the scroll-spy reaches Docs, then
 * Blog (#blog is the second part's own anchor).
 */
export function docsSection(content: SiteContent): string {
  const posts = content.posts;
  const latest = posts.slice(0, HOME_POSTS);
  const more = posts.length - latest.length;
  return (
    `<section class="sec sec--docs" id="docs" aria-labelledby="docs-title">` +
    floats("home-docs", { tone: "cyan", count: 2, glyph: "star" }) +
    `<div class="wrap">` +
    sectionHead({ id: "docs-title", kicker: "docs · blog", title: "Docs & blog", tone: "cyan", icon: "book", more: { href: "/docs/", label: "Docs page" } }) +
    `<div class="dpart">` +
    `<div class="btools"><h3 class="sub" id="docs-sub">${tile("book", "cyan", "s")}<span>Docs</span></h3>` +
    `<span class="btools__count">${plural(content.docs.length, "page", "pages")}</span></div>` +
    docGroups(content, 4) +
    `</div>` +
    `<div class="blogpart" id="blog">` +
    `<div class="btools"><h3 class="sub" id="blog-title">${tile("page", "cyan", "s")}<span>${more > 0 ? "Latest posts" : "Blog"}</span></h3>` +
    `<span class="btools__count">${plural(posts.length, "post", "posts")}</span>` +
    `<span class="btools__keys">` +
    button({ href: "/blog/feed.xml", label: "RSS feed", icon: "rss", iconFirst: true, size: "s", tone: "paper" }) +
    button({ href: "/blog/", label: more > 0 ? `All ${pad2(posts.length)} posts` : "Blog page", icon: "arrow", size: "s", tone: "paper" }) +
    `</span></div>` +
    (latest.length ? `<ol class="bposts">${latest.map((p, i) => postItem(p, i, 4)).join("")}</ol>` : `<p class="empty">Nothing here yet.</p>`) +
    (more > 0 ? olderPosts(posts.slice(HOME_POSTS)) : "") +
    `</div>` +
    `</div></section>`
  );
}

// ------------------------------------------------------------ articles

function tocList(e: Entry): string {
  const hs = e.headings.filter((h) => h.depth === 2 || h.depth === 3);
  if (hs.length < 2) return "";
  return `<ol class="toc-list">${hs.map((h) => `<li class="toc-list__d${h.depth}"><a href="#${esc(h.id)}">${esc(h.text)}</a></li>`).join("")}</ol>`;
}

/** Thin reading-progress strip at the top of the viewport (CSS scroll timeline). */
const readbar = (): string => `<div class="readbar" aria-hidden="true"><i></i><i></i><i></i></div>`;

function pagerLink(e: Entry | undefined, dir: "prev" | "next", label: string): string {
  if (!e) return `<span class="apager__gap"></span>`;
  const arrow = dir === "prev" ? icon("arrow-left", 2) : icon("arrow", 2);
  return (
    `<a class="apager__link apager__link--${dir} pop" href="${e.url}" rel="${dir}">` +
    `<span class="apager__dir">${dir === "prev" ? arrow : ""}<span>${label}</span>${dir === "next" ? arrow : ""}</span>` +
    `<span class="apager__title">${esc(e.title)}</span></a>`
  );
}

function docSidebar(content: SiteContent, current: Entry): string {
  return groupedDocs(content.docs)
    .map(({ group, docs }) =>
      `<div class="dside__group">` +
      `<p class="dside__label">${tile(group.icon, group.tone, "s")}<span>${esc(group.label)}</span></p>` +
      `<ul class="dside__list">` +
      docs
        .map((d) => `<li><a class="dside__link" href="${d.url}"${d === current ? ` aria-current="page"` : ""}>${esc(d.title)}</a></li>`)
        .join("") +
      `</ul></div>`,
    )
    .join("");
}

export function docPage(content: SiteContent, e: Entry): string {
  const list = content.docs;
  const at = list.indexOf(e);
  const group = docGroup(e.group);
  const toc = tocList(e);
  const side = docSidebar(content, e);
  return (
    readbar() +
    `<div class="page page--doc">` +
    `<div class="wrap wrap--doc">` +
    `<nav class="crumbs" aria-label="Breadcrumb"><a href="/docs/">Docs</a><span aria-hidden="true">/</span>` +
    `<span>${esc(group.label)}</span><span aria-hidden="true">/</span><span aria-current="page">${esc(e.title)}</span></nav>` +
    `<div class="${cx("doc", toc && "doc--toc")}">` +
    `<nav class="dside" aria-label="All docs"><a class="dside__all" href="/docs/">${icon("book", 2)}<span>All docs</span></a>${side}</nav>` +
    `<article class="doc__main">` +
    `<header class="ahead ahead--doc ahead--${group.tone}" data-reveal>` +
    `<p class="ahead__kicker">${tile(group.icon, group.tone, "s")}<span>${esc(group.label)}</span>${e.nsfw ? nsfwTag() : ""}${e.placeholder ? placeholderTag() : ""}</p>` +
    `<h1 class="ahead__title">${esc(e.title)}</h1>` +
    (e.summary ? `<p class="ahead__sum">${esc(e.summary)}</p>` : "") +
    `</header>` +
    // Narrow screens: both navigators fold into disclosures above the text.
    `<div class="jumps">` +
    `<details class="jump jump--docs"><summary class="jump__sum pop">${icon("book", 2)}<span>All docs</span>${icon("arrow-down", 2, "jump__chev")}</summary>` +
    `<nav class="jump__panel" aria-label="All docs (compact)">${side}</nav></details>` +
    (toc
      ? `<details class="jump jump--toc"><summary class="jump__sum pop">${icon("menu", 2)}<span>On this page</span>${icon("arrow-down", 2, "jump__chev")}</summary>` +
        `<nav class="jump__panel" aria-label="On this page (compact)">${toc}</nav></details>`
      : "") +
    `</div>` +
    `<div class="prose">${e.html}</div>` +
    `<nav class="apager" aria-label="More docs">${pagerLink(list[at - 1], "prev", "Previous")}${pagerLink(list[at + 1], "next", "Next")}</nav>` +
    `</article>` +
    (toc ? `<aside class="dtoc" aria-labelledby="toc-title" data-toc><p class="dtoc__title" id="toc-title">On this page</p>${toc}<span class="dtoc__ind" aria-hidden="true"></span></aside>` : "") +
    `</div>` +
    `</div></div>`
  );
}

export function postPage(content: SiteContent, e: Entry): string {
  const list = content.posts;
  const at = list.indexOf(e);
  // Newest first, so the previous item in the list is the newer post.
  const newer = list[at - 1];
  const older = list[at + 1];
  return (
    readbar() +
    `<div class="page page--post">` +
    floats(`post-${e.slug}`, { tone: "cyan", count: 2, span: 0.4, glyph: "sparkle" }) +
    `<div class="wrap">` +
    `<nav class="crumbs crumbs--post" aria-label="Breadcrumb"><a href="/blog/">Blog</a><span aria-hidden="true">/</span><span aria-current="page">${esc(e.title)}</span></nav>` +
    `<article class="post">` +
    `<header class="ahead ahead--post ahead--cyan" data-reveal>` +
    `<div class="ahead__row">${e.date ? dateBlock(e) : ""}` +
    `<p class="ahead__facts">${e.nsfw ? nsfwTag() : ""}${e.placeholder ? placeholderTag() : ""}<span class="when">${dateText(e)}<span aria-hidden="true"> · </span><span>${e.minutes} min read</span></span></p></div>` +
    `<h1 class="ahead__title">${esc(e.title)}</h1>` +
    (e.summary ? `<p class="ahead__sum">${esc(e.summary)}</p>` : "") +
    `</header>` +
    `<div class="prose">${e.html}</div>` +
    `<div class="post__end" aria-hidden="true">${icon("sparkle", 3)}${strip("post__strip")}</div>` +
    `</article>` +
    `<nav class="apager apager--post" aria-label="More posts">${pagerLink(newer, "prev", "Newer")}${pagerLink(older, "next", "Older")}</nav>` +
    `<p class="post__back">${button({ href: "/blog/", label: "All posts", icon: "arrow-left", iconFirst: true, size: "m" })}</p>` +
    `</div></div>`
  );
}

export function entryPage(content: SiteContent, e: Entry): string {
  return e.kind === "docs" ? docPage(content, e) : postPage(content, e);
}

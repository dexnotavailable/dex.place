// Documentation and blog pages (DESIGN-SYSTEM.md §7): /docs/, /docs/<slug>/,
// /blog/, /blog/<slug>/. Built from content/docs and content/blog markdown by
// build/content.ts. Complete without JavaScript; motion/toc.ts only adds the
// scroll-spy and anchor copying.

import { DOC_GROUPS, OTHER_GROUP, docGroup, type DocGroup } from "../data/docs.ts";
import { floats } from "./floats.ts";
import { button, icon, pageHead, placeholderTag, sticker, strip, tile } from "./glyphs.ts";
import { cx, esc, pad2 } from "./html.ts";
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
    `<li><a class="dlink" href="${e.url}" style="--i:${i}">` +
    `<span class="dlink__main"><span class="dlink__title">${esc(e.title)}</span>` +
    (e.summary ? `<span class="dlink__sum">${esc(e.summary)}</span>` : "") +
    (e.placeholder ? placeholderTag() : "") +
    `</span>` +
    `<span class="dlink__go" aria-hidden="true">${icon("arrow", 2)}</span>` +
    `</a></li>`
  );
}

export function docsIndex(content: SiteContent): string {
  const groups = groupedDocs(content.docs);
  const body = groups.length
    ? `<div class="dgroups">` +
      groups
        .map(({ group, docs }, i) =>
          `<section class="dgroup dgroup--${group.tone}" aria-labelledby="g-${group.id}" data-reveal="pop-block" style="--i:${i}">` +
          `<header class="dgroup__head">${tile(group.icon, group.tone, "m")}` +
          `<h2 class="dgroup__title" id="g-${group.id}">${esc(group.label)}</h2>` +
          `<span class="dgroup__count">${plural(docs.length, "page", "pages")}</span></header>` +
          `<ol class="dgroup__list">${docs.map(docLink).join("")}</ol>` +
          `</section>`,
        )
        .join("") +
      `</div>`
    : `<p class="empty">Nothing here yet.</p>`;
  return (
    `<div class="page page--docs">` +
    floats("docs", { tone: "yellow", stickers: ["book", "page", "blob"] }) +
    `<div class="wrap">` +
    pageHead({ kicker: "documentation", title: "Docs", tone: "yellow", aside: plural(content.docs.length, "page", "pages"), stickers: ["book", "page"] }) +
    body +
    `</div></div>`
  );
}

// ----------------------------------------------------------- blog index

function postItem(e: Entry, i: number): string {
  return (
    `<li class="bpost" data-reveal style="--i:${Math.min(i, 5)}">` +
    dateBlock(e) +
    `<div class="bpost__main">` +
    `<h3 class="bpost__title"><a class="bpost__link" href="${e.url}">${esc(e.title)}</a></h3>` +
    (e.summary ? `<p class="bpost__sum">${esc(e.summary)}</p>` : "") +
    `<p class="bpost__meta">${e.placeholder ? placeholderTag() : ""}` +
    `<span class="when">${dateText(e)}<span aria-hidden="true"> · </span><span>${e.minutes} min read</span></span></p>` +
    `</div>` +
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
          `<ol class="bposts">${y.posts.map(postItem).join("")}</ol>` +
          `</section>`,
        )
        .join("")
    : `<p class="empty">Nothing here yet.</p>`;
  return (
    `<div class="page page--blog">` +
    floats("blog", { tone: "cyan", span: 0.35, stickers: ["page", "sparkle", "sleepy"] }) +
    `<div class="wrap">` +
    pageHead({ kicker: "blog", title: "Blog", tone: "cyan", aside: plural(posts.length, "post", "posts"), stickers: ["page", "star"] }) +
    `<div class="btools"><p class="btools__order">Newest first</p>` +
    button({ href: "/blog/feed.xml", label: "RSS feed", icon: "rss", iconFirst: true, size: "s", tone: "paper" }) +
    `</div>` +
    list +
    `</div></div>`
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
    `<a class="apager__link apager__link--${dir}" href="${e.url}" rel="${dir}">` +
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
    `<p class="ahead__kicker">${tile(group.icon, group.tone, "s")}<span>${esc(group.label)}</span>${e.placeholder ? placeholderTag() : ""}</p>` +
    `<h1 class="ahead__title">${esc(e.title)}</h1>` +
    (e.summary ? `<p class="ahead__sum">${esc(e.summary)}</p>` : "") +
    strip("ahead__strip") +
    `</header>` +
    // Narrow screens: both navigators fold into disclosures above the text.
    `<div class="jumps">` +
    `<details class="jump jump--docs"><summary class="jump__sum">${icon("book", 2)}<span>All docs</span>${icon("arrow-down", 2, "jump__chev")}</summary>` +
    `<nav class="jump__panel" aria-label="All docs (compact)">${side}</nav></details>` +
    (toc
      ? `<details class="jump jump--toc"><summary class="jump__sum">${icon("menu", 2)}<span>On this page</span>${icon("arrow-down", 2, "jump__chev")}</summary>` +
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
    floats(`post-${e.slug}`, { tone: "cyan", far: 2, mid: 2, near: 2, span: 0.4, stickers: ["sparkle", "page"] }) +
    `<div class="wrap">` +
    `<nav class="crumbs crumbs--post" aria-label="Breadcrumb"><a href="/blog/">Blog</a><span aria-hidden="true">/</span><span aria-current="page">${esc(e.title)}</span></nav>` +
    `<article class="post">` +
    `<header class="ahead ahead--post" data-reveal>` +
    `<div class="ahead__row">${e.date ? dateBlock(e) : ""}` +
    `<p class="ahead__facts">${e.placeholder ? placeholderTag() : ""}<span class="when">${dateText(e)}<span aria-hidden="true"> · </span><span>${e.minutes} min read</span></span></p></div>` +
    `<h1 class="ahead__title">${esc(e.title)}</h1>` +
    (e.summary ? `<p class="ahead__sum">${esc(e.summary)}</p>` : "") +
    strip("ahead__strip") +
    `</header>` +
    `<div class="prose">${e.html}</div>` +
    `<div class="post__end" aria-hidden="true">${sticker("sparkle", { scale: 3, tilt: -8, tone: "cyan" })}${strip("post__strip")}</div>` +
    `</article>` +
    `<nav class="apager apager--post" aria-label="More posts">${pagerLink(newer, "prev", "Newer")}${pagerLink(older, "next", "Older")}</nav>` +
    `<p class="post__back">${button({ href: "/blog/", label: "All posts", icon: "arrow-left", iconFirst: true, size: "m" })}</p>` +
    `</div></div>`
  );
}

export function entryPage(content: SiteContent, e: Entry): string {
  return e.kind === "docs" ? docPage(content, e) : postPage(content, e);
}

// Every URL the website layer serves, with its output file and renderer.
// The build plugin (src/site/build/plugin.ts) emits one HTML file per route
// and serves the same routes from the dev server.

import { downloadsPage } from "./downloads.ts";
import { shell } from "./layout.ts";
import { notFoundPage } from "./pages.ts";
import { galleryArrival, galleryOrder, galleryPage, piecePage } from "./gallery.ts";
import { landing, projectPage, projectsIndex, retiredProjectPage } from "./landing.ts";
import { projectHref, projects } from "../data/projects.ts";
import { RETIRED } from "../data/downloads.ts";
import { YUKI_LINE } from "../data/yuki.ts";
import { yukiPage } from "./yuki.ts";
import { blogIndex, docsIndex, entryPage, retiredDocPage } from "./docs.ts";
import { docGroup, RETIRED_DOCS } from "../data/docs.ts";
import { donatePage } from "./donate.ts";
import { STUBS, stubPage } from "./stubs.ts";
import type { Entry, PageMeta, Rendered, SiteContent } from "./types.ts";
import { esc, pad2 } from "./html.ts";
import { ORIGIN } from "./layout.ts";
import { findNsfwLeaks } from "./nsfw.ts";

export interface Route {
  /** URL path, always with a trailing slash (or "/404.html"). */
  readonly path: string;
  /** File name in dist/. */
  readonly file: string;
  render(): Rendered;
}

const page = (meta: PageMeta, main: () => string): (() => Rendered) => () => shell({ meta, main: main() });

function fileFor(path: string): string {
  return path === "/" ? "index.html" : `${path.replace(/^\//, "")}index.html`;
}

export function routes(content: SiteContent): Route[] {
  const list: { meta: PageMeta; main: () => string }[] = [
    {
      meta: { path: "/", title: null, page: "home", description: "Dex's projects: downloads, docs, illustrations and donations.", headEnd: galleryArrival(content) },
      main: () => landing(content),
    },
    {
      meta: { path: "/projects/", title: "Projects", page: "projects", description: `${projects.map((p) => p.name).join(" and ")}.` },
      main: projectsIndex,
    },
    // (a project with a page of its own, YUKI's /yuki/, has no /projects/<id>/)
    ...projects.filter((p) => !p.page).map((p) => ({
      meta: { path: projectHref(p), title: p.name, page: "projects" as const, description: p.line },
      main: () => projectPage(p),
    })),
    // the retired projects' old pages say where they went (Dex 10-26)
    ...RETIRED.map((r) => ({
      meta: { path: `/projects/${r.id}/`, title: r.name, page: "projects" as const, description: `${r.name} is retired.`, noindex: true },
      main: () => retiredProjectPage(r),
    })),
    // YUKI's page (Dex 10-26: dex.place/yuki, under Downloads)
    {
      meta: { path: "/yuki/", title: "YUKI", page: "downloads", description: `YUKI: ${YUKI_LINE} Download, plans and prices, install guide and what your PC gets.` },
      main: () => yukiPage(),
    },
    {
      meta: { path: "/downloads/", title: "Downloads", page: "downloads", description: "Direct downloads for Dex's projects, with sizes and SHA-256 checksums." },
      main: () => downloadsPage(),
    },
    {
      meta: { path: "/gallery/", title: "Gallery", page: "gallery", description: "Dex's illustrations." },
      main: () => galleryPage(content),
    },
    ...content.gallery.map((item, i) => ({
      meta: {
        path: `/gallery/${item.id}/`,
        title: `Gallery ${pad2(galleryOrder(content.gallery).placed.findIndex((q) => q.item === item) + 1)}`,
        page: "gallery" as const,
        description: item.alt,
      },
      main: () => piecePage(content, i),
    })),
    {
      meta: { path: "/docs/", title: "Docs", page: "docs", description: "Documentation for YUKI and dex.place, and for the retired dexCode and dexClient." },
      main: () => docsIndex(content),
    },
    ...entryRoutes(content, content.docs),
    // the retired docs' old addresses say where their readers go now (Dex 10-26), unless a doc of that name is back
    ...RETIRED_DOCS.filter((r) => !content.docs.some((d) => d.slug === r.slug)).map((r) => ({
      meta: { path: `/docs/${r.slug}/`, title: r.title, page: "docs" as const, description: `${r.project} is retired. YUKI replaces it.`, noindex: true },
      main: () => retiredDocPage(content, r),
    })),
    {
      meta: { path: "/blog/", title: "Blog", page: "blog", description: "Posts from Dex." },
      main: () => blogIndex(content),
    },
    ...entryRoutes(content, content.posts),
    {
      meta: { path: "/donate/", title: "Donate", page: "donate", description: "Support Dex through Ko-fi or a personal bank transfer (VietQR)." },
      main: donatePage,
    },
    // the services that open later: honest stubs at their own addresses (render/stubs.ts)
    ...(["support", "account", "map", "forums"] as const).map((id) => ({
      meta: { path: `/${id}/`, title: STUBS.find((s) => s.id === id)!.title, page: "more" as const, description: `${STUBS.find((s) => s.id === id)!.title}: opens later.` },
      main: () => stubPage(id),
    })),
  ];
  const out: Route[] = list.map(({ meta, main }) => ({ path: meta.path, file: fileFor(meta.path), render: page(meta, main) }));
  out.push({
    path: "/404.html",
    file: "404.html",
    render: page({ path: "/404.html", title: "Not found", page: "notfound", description: "This page does not exist.", noindex: true }, notFoundPage),
  });
  return out;
}

function entryRoutes(content: SiteContent, entries: readonly Entry[]): { meta: PageMeta; main: () => string }[] {
  return entries.map((e) => ({
    meta: {
      path: e.url,
      // Docs: "Installing dexClient · dexClient · dex"; posts: "First post · dex".
      title: e.kind === "docs" ? `${e.title} · ${docGroup(e.group).label}` : e.title,
      page: e.kind,
      description: (e.nsfw ? "NSFW. " : "") + (e.summary || e.title),
      noindex: e.placeholder,
      nsfw: e.nsfw,
    },
    main: () => entryPage(content, e),
  }));
}

/**
 * The feed carries no post bodies and no images, only title and summary. An
 * NSFW post says so in its title, a category and its description, and sends
 * the reader to the page, where the images are spoiler-blurred.
 */
const feedNote = (p: Entry): string =>
  p.nsfw ? `NSFW: adult content${p.nsfwImages.length ? ", images hidden here" : ""}. View on dex.place: ${ORIGIN}${p.url}` : "";

/** RSS 2.0 for published (non-placeholder, dated) posts. */
export function blogFeed(content: SiteContent): string {
  const posts = content.posts.filter((p) => !p.placeholder && p.date);
  const items = posts.map((p) => {
    const description = [feedNote(p), p.summary].filter(Boolean).join(" ");
    return [
      "<item>",
      `<title>${esc(p.nsfw ? `[NSFW] ${p.title}` : p.title)}</title>`,
      `<link>${ORIGIN}${p.url}</link>`,
      `<guid>${ORIGIN}${p.url}</guid>`,
      `<pubDate>${new Date(`${p.date}T00:00:00Z`).toUTCString()}</pubDate>`,
      p.nsfw ? "<category>NSFW</category>" : "",
      description ? `<description>${esc(description)}</description>` : "",
      "</item>",
    ].join("");
  });
  const xml =
    `<?xml version="1.0" encoding="utf-8"?>\n` +
    `<rss version="2.0"><channel><title>dex blog</title><link>${ORIGIN}/blog/</link>` +
    `<description>Posts from Dex.</description><language>en</language>${items.join("")}</channel></rss>\n`;
  // Tripwire: if the feed ever carries bodies, an NSFW file URL must not get in.
  const leaks = findNsfwLeaks(xml, posts.flatMap((p) => p.nsfwImages), false);
  if (leaks.length) throw new Error(`blog feed would carry NSFW images: ${leaks.join(", ")}`);
  return xml;
}

/**
 * Where an NSFW image file shows up that it must not: any route other than the
 * post's own page (home, indexes, other posts, the gallery, 404), the post's
 * own page outside a spoiler (meta tags, link hints), and the feed. Empty when
 * clean. The build throws on anything here; blog.test.mjs checks it too.
 */
export function nsfwLeaks(content: SiteContent): string[] {
  const entries = [...content.docs, ...content.posts].filter((e) => e.nsfwImages.length);
  if (!entries.length) return [];
  const found: string[] = [];
  for (const route of routes(content)) {
    const rendered = route.render();
    const html = `${rendered.head}\n${rendered.body}`;
    for (const e of entries) {
      for (const url of findNsfwLeaks(html, e.nsfwImages, route.path === e.url)) found.push(`${route.path} shows ${url}`);
    }
  }
  try {
    blogFeed(content);
  } catch (error) {
    found.push(String((error as Error).message));
  }
  return found;
}

// Every URL the website layer serves, with its output file and renderer.
// The build plugin (src/site/build/plugin.ts) emits one HTML file per route
// and serves the same routes from the dev server.

import { downloadsPage } from "./downloads.ts";
import { shell } from "./layout.ts";
import { notFoundPage } from "./pages.ts";
import { galleryArrival, galleryOrder, galleryPage, piecePage } from "./gallery.ts";
import { landing, projectPage, projectsIndex } from "./landing.ts";
import { projectHref, projects } from "../data/projects.ts";
import { blogIndex, docsIndex, entryPage } from "./docs.ts";
import { docGroup } from "../data/docs.ts";
import { donatePage } from "./donate.ts";
import type { Entry, PageMeta, Rendered, SiteContent } from "./types.ts";
import { esc, pad2 } from "./html.ts";
import { ORIGIN } from "./layout.ts";

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
      meta: { path: "/projects/", title: "Projects", page: "projects", description: "dexCode, dexClient and dex.place." },
      main: projectsIndex,
    },
    ...projects.map((p) => ({
      meta: { path: projectHref(p), title: p.name, page: "projects" as const, description: p.line },
      main: () => projectPage(p),
    })),
    {
      meta: { path: "/downloads/", title: "Downloads", page: "downloads", description: "Direct downloads for Dex's projects, with sizes and SHA-256 checksums." },
      main: downloadsPage,
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
      meta: { path: "/docs/", title: "Docs", page: "docs", description: "Documentation for dexCode, dexClient and dex.place." },
      main: () => docsIndex(content),
    },
    ...entryRoutes(content, content.docs),
    {
      meta: { path: "/blog/", title: "Blog", page: "blog", description: "Posts from Dex." },
      main: () => blogIndex(content),
    },
    ...entryRoutes(content, content.posts),
    {
      meta: { path: "/donate/", title: "Donate", page: "donate", description: "Support Dex through Ko-fi or an MB Bank transfer (VietQR)." },
      main: donatePage,
    },
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
      description: e.summary || e.title,
      noindex: e.placeholder,
    },
    main: () => entryPage(content, e),
  }));
}

/** RSS 2.0 for published (non-placeholder, dated) posts. */
export function blogFeed(content: SiteContent): string {
  const items = content.posts
    .filter((p) => !p.placeholder && p.date)
    .map((p) =>
      [
        "<item>",
        `<title>${esc(p.title)}</title>`,
        `<link>${ORIGIN}${p.url}</link>`,
        `<guid>${ORIGIN}${p.url}</guid>`,
        `<pubDate>${new Date(`${p.date}T00:00:00Z`).toUTCString()}</pubDate>`,
        p.summary ? `<description>${esc(p.summary)}</description>` : "",
        "</item>",
      ].join(""),
    );
  return (
    `<?xml version="1.0" encoding="utf-8"?>\n` +
    `<rss version="2.0"><channel><title>dex blog</title><link>${ORIGIN}/blog/</link>` +
    `<description>Posts from Dex.</description><language>en</language>${items.join("")}</channel></rss>\n`
  );
}

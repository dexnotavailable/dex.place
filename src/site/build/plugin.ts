// Vite plugin that turns the website's data and markdown into real,
// prerendered pages (TECH-PLAN.md §3, "Vite pages + one build plugin").
//
// - The root page (index.html) is a normal Vite input; its <!--site:head-->
//   and <!--site:body--> markers are filled in transformIndexHtml.
// - Every other page is cloned from one processed template
//   (src/site/pages/page.html, also a Vite input, so its CSS/JS are hashed and
//   linked) in generateBundle, then the template is dropped from dist/.
// - The dev server renders the same routes from the same code.
// Other workflows' pages (/lab/, /scenes/) have no markers and pass through.

import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";
import { blogFeed, routes, type Route } from "../render/routes.ts";
import type { Rendered } from "../render/types.ts";
import { loadContent } from "./content.ts";

export const TEMPLATE = "src/site/pages/page.html";
const HEAD = "<!--site:head-->";
const BODY = "<!--site:body-->";
const PRELOAD = "<!--site:preload-->";

// Latin files of the heading and body fonts are needed on every page; preload them.
const PRELOAD_FONTS = [/\/jersey-15-latin-400-normal-[\w-]+\.woff2$/, /\/space-grotesk-latin-wght-normal-[\w-]+\.woff2$/];

/**
 * Moves the page's stylesheet links ahead of every script in <head>. Vite
 * emits the entry's <script type="module"> first and its <link
 * rel="stylesheet"> after it. In Chromium (Edge, Chrome, Samsung Internet),
 * when the scripts come from cache the new page's first style pass can then
 * run before the sheet is in, so its `@view-transition` opt-in
 * (styles/shell.css) reads as off and the incoming cross-document view
 * transition is aborted ("Transition was aborted because of invalid state.
 * ViewTransition opt-in disabled", an uncaught promise rejection). With the
 * sheet first, the inline head scripts after it hold the parser until the
 * sheet has loaded, so nothing on the page runs or is styled without it. The
 * sheet is render-blocking either way, so first paint is not delayed.
 */
export function stylesheetsFirst(html: string): string {
  const headEnd = html.indexOf("</head>");
  if (headEnd < 0) return html;
  const links: string[] = [];
  const head = html.slice(0, headEnd).replace(/<link rel="stylesheet"[^>]*>\s*/g, (tag) => {
    links.push(tag.trim());
    return "";
  });
  const at = head.search(/<script[\s>]/);
  if (!links.length || at < 0) return html;
  return head.slice(0, at) + links.map((tag) => `${tag}\n    `).join("") + head.slice(at) + html.slice(headEnd);
}

function fill(template: string, page: Rendered, preload: string): string {
  if (!template.includes(HEAD) || !template.includes(BODY)) {
    throw new Error(`page template is missing ${HEAD} or ${BODY}`);
  }
  return template.replace(HEAD, () => page.head.replace(PRELOAD, preload)).replace(BODY, () => page.body);
}

export function sitePages(): Plugin {
  let root = process.cwd();
  const content = () => loadContent(root);
  const all = (): Route[] => routes(content());

  return {
    name: "dex:site-pages",
    enforce: "post",

    configResolved(config) {
      root = config.root;
    },

    transformIndexHtml: {
      order: "post",
      handler(html, ctx) {
        if (!html.includes(HEAD)) return html; // lab, scenes: not ours
        if (ctx.path.startsWith("/src/site/pages/")) return html; // the template: filled per page in generateBundle
        const home = all().find((r) => r.path === "/");
        if (!home) throw new Error("no route for /");
        // In build the preload marker stays until generateBundle knows the hashed font names.
        return fill(html, home.render(), ctx.server ? "" : PRELOAD);
      },
    },

    configureServer(server) {
      const contentDir = path.join(root, "content");
      server.watcher.add(contentDir);
      const reload = (file: string) => {
        if (path.resolve(file).startsWith(contentDir)) server.ws.send({ type: "full-reload" });
      };
      server.watcher.on("change", reload).on("add", reload).on("unlink", reload);

      server.middlewares.use(async (req, res, next) => {
        try {
          const url = new URL(req.url ?? "/", "http://localhost");
          const p = decodeURIComponent(url.pathname);
          if (p === "/" || p === "/index.html") { next(); return; }
          if (p === "/blog/feed.xml") {
            res.setHeader("Content-Type", "application/rss+xml; charset=utf-8");
            res.end(blogFeed(content()));
            return;
          }
          const list = all();
          const route = list.find((r) => r.path === p);
          if (!route) {
            if (!p.endsWith("/") && list.some((r) => r.path === `${p}/`)) {
              res.statusCode = 308;
              res.setHeader("Location", `${p}/${url.search}`);
              res.end();
              return;
            }
            next();
            return;
          }
          const template = fs.readFileSync(path.join(root, TEMPLATE), "utf8");
          const html = await server.transformIndexHtml(p, fill(template, route.render(), ""), req.originalUrl);
          res.statusCode = route.path === "/404.html" ? 404 : 200;
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end(html);
        } catch (error) {
          next(error);
        }
      });
    },

    generateBundle(_options, bundle) {
      const template = bundle[TEMPLATE];
      if (!template || template.type !== "asset") {
        throw new Error(`${TEMPLATE} is not in the bundle; is it listed in build.rolldownOptions.input?`);
      }
      const fonts = Object.keys(bundle).filter((name) => PRELOAD_FONTS.some((re) => re.test(`/${name}`)));
      const preload = fonts.map((name) => `<link rel="preload" href="/${name}" as="font" type="font/woff2" crossorigin />`).join("\n    ");

      const home = bundle["index.html"];
      if (!home || home.type !== "asset") throw new Error("index.html is not in the bundle");
      home.source = stylesheetsFirst(String(home.source).replace(PRELOAD, () => preload));

      const source = String(template.source);
      const c = content();
      for (const route of routes(c)) {
        if (route.path === "/") continue;
        this.emitFile({ type: "asset", fileName: route.file, source: stylesheetsFirst(fill(source, route.render(), preload)) });
      }
      this.emitFile({ type: "asset", fileName: "blog/feed.xml", source: blogFeed(c) });
      delete bundle[TEMPLATE];
    },
  };
}

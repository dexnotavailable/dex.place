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

// Latin files of the two text fonts are needed on every page; preload them.
const PRELOAD_FONTS = [/\/anybody-latin-standard-normal-[\w-]+\.woff2$/, /\/space-grotesk-latin-wght-normal-[\w-]+\.woff2$/];

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
      home.source = String(home.source).replace(PRELOAD, () => preload);

      const source = String(template.source);
      const c = content();
      for (const route of routes(c)) {
        if (route.path === "/") continue;
        this.emitFile({ type: "asset", fileName: route.file, source: fill(source, route.render(), preload) });
      }
      this.emitFile({ type: "asset", fileName: "blog/feed.xml", source: blogFeed(c) });
      delete bundle[TEMPLATE];
    },
  };
}

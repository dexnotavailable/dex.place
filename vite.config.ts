import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { sitePages, TEMPLATE } from "./src/site/build/plugin.ts";
import { tesuBake } from "./src/tesu/plates/bake-plugin.ts";

const page = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  // Static multi-page site: unknown paths are 404s, never a silent index.html fallback.
  appType: "mpa",
  // The website layer: prerenders /, /downloads/, /gallery/, /docs/, /blog/,
  // /donate/ and 404.html from src/site (see docs/site/DESIGN-SYSTEM.md).
  plugins: [sitePages(), tesuBake()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    // Every target browser has native modulepreload; skip the polyfill.
    modulePreload: { polyfill: false },
    // Fonts are never inlined into the stylesheet: the body face's ~120 small Japanese subsets were going in as base64
    // (70 KB gzip of a 92 KB sheet, render-blocking, on every page, for glyphs a page rarely uses); as files, a page
    // fetches only the subsets its text needs (unicode-range), and the Latin one is preloaded (build/plugin.ts).
    assetsInlineLimit: (file: string) => (/\.(woff2?|ttf|otf)$/.test(file) ? false : undefined),
    rolldownOptions: {
      input: {
        main: page("./index.html"),
        lab: page("./lab/index.html"),
        scenes: page("./scenes/index.html"),
        world: page("./world/index.html"),
        tesu: page("./tesu/index.html"),
        props: page("./props/index.html"),
        // Shared template for every non-root website page; cloned per route and
        // removed from dist/ by the site plugin.
        site: page(`./${TEMPLATE}`),
      },
    },
  },
});

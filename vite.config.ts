import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { sitePages, TEMPLATE } from "./src/site/build/plugin.ts";

const page = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  // Static multi-page site: unknown paths are 404s, never a silent index.html fallback.
  appType: "mpa",
  // The website layer: prerenders /, /downloads/, /gallery/, /docs/, /blog/,
  // /donate/ and 404.html from src/site (see docs/site/DESIGN-SYSTEM.md).
  plugins: [sitePages()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    // Every target browser has native modulepreload; skip the polyfill.
    modulePreload: { polyfill: false },
    rolldownOptions: {
      input: {
        main: page("./index.html"),
        lab: page("./lab/index.html"),
        scenes: page("./scenes/index.html"),
        // Shared template for every non-root website page; cloned per route and
        // removed from dist/ by the site plugin.
        site: page(`./${TEMPLATE}`),
      },
    },
  },
});

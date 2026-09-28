import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import { renderDownloads } from "./src/render.ts";

const page = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

const DOWNLOADS_MARKER = "<!--downloads-->";

// Writes the downloads list from src/downloads.ts into index.html at dev and
// build time. Vite restarts the dev server when that file changes.
function prerenderDownloads(): Plugin {
  return {
    name: "dex:prerender-downloads",
    transformIndexHtml(html, ctx) {
      // Only the root page carries the downloads list; the lab (/lab/) does not.
      if (ctx.path !== "/index.html") return html;
      if (!html.includes(DOWNLOADS_MARKER)) {
        throw new Error(`index.html is missing ${DOWNLOADS_MARKER}`);
      }
      return html.replace(DOWNLOADS_MARKER, renderDownloads());
    },
  };
}

export default defineConfig({
  // Static multi-page site: unknown paths are 404s, never a silent index.html fallback.
  appType: "mpa",
  plugins: [prerenderDownloads()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rolldownOptions: {
      input: { main: page("./index.html") },
    },
  },
});

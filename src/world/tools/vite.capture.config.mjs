// Capture-only dev server for /world/: no HMR and no file watching, so other
// lanes editing files can't reload the page mid-run (restart it after your own
// edits). The shared vite.config.ts is untouched. W0's ports are 24000-24099.
//   npx vite --config src/world/tools/vite.capture.config.mjs --port 24001 --strictPort --host 127.0.0.1
// The website's pages come from the site's own plugin (read, not edited), so the
// world's panels (/docs/<page>/, /downloads/, /donate/) load real pages here too
// instead of 404s.
import { fileURLToPath } from "node:url";
import { realpathSync } from "node:fs";
import { sitePages } from "../../site/build/plugin.ts";
const root = fileURLToPath(new URL("../../..", import.meta.url));
export default {
  root,
  appType: "mpa",
  plugins: [sitePages(), {
    name: "world-verifier-identity",
    configureServer(server) {
      server.middlewares.use("/__world-verifier", (_req, res) => {
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ root, nonce: process.env.WORLD_VERIFY_NONCE ?? null }));
      });
    },
  }],
  // Isolated D-backed worktrees can reuse installed dependencies via a
  // junction. Permit that exact dependency directory for font requests.
  server: { hmr: false, watch: null, fs: { allow: [root, realpathSync(new URL("../../../node_modules", import.meta.url))] } },
  logLevel: "warn",
};

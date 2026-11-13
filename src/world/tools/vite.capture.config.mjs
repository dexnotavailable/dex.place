// Capture-only dev server for /world/: no HMR and no file watching, so other
// lanes editing files can't reload the page mid-run (restart it after your own
// edits). The shared vite.config.ts is untouched. W0's ports are 24000-24099.
//   npx vite --config src/world/tools/vite.capture.config.mjs --port 24001 --strictPort --host 127.0.0.1
// The website's pages come from the site's own plugin (read, not edited), so the
// world's panels (/docs/<page>/, /downloads/, /donate/) load real pages here too
// instead of 404s.
import { fileURLToPath } from "node:url";
import { sitePages } from "../../site/build/plugin.ts";
export default {
  root: fileURLToPath(new URL("../../..", import.meta.url)),
  appType: "mpa",
  plugins: [sitePages()],
  server: { hmr: false, watch: null },
  logLevel: "warn",
};

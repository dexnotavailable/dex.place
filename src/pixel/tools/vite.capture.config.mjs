// Capture-only dev server for /props/: no HMR and no file watching, so other
// lanes editing files can't reload the page mid-recording. The shared
// vite.config.ts is untouched.
//   npx vite --config src/pixel/tools/vite.capture.config.mjs --port 22418 --strictPort --host 127.0.0.1
import { fileURLToPath } from "node:url";
export default {
  root: fileURLToPath(new URL("../../..", import.meta.url)),
  appType: "mpa",
  server: { hmr: false, watch: null },
};

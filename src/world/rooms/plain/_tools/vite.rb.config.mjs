// Lane R-B's capture server: no HMR, no watching (other lanes' edits can't
// reload a page mid-run), and, while the other region lanes are mid-edit,
// their region folders load as empty modules so one broken file elsewhere
// can't stop /world/ from booting (region rooms then fall back to the
// grey-box). Set RB_ISOLATE=0 to load everything.
//   npx vite --config src/world/rooms/plain/_tools/vite.rb.config.mjs --port 24301 --strictPort --host 127.0.0.1
import { fileURLToPath } from "node:url";

const OTHERS = /src[\\/](world[\\/]rooms|pixel[\\/]props)[\\/](ringwater|hollow|spire|chapel)[\\/]/;

export default {
  root: fileURLToPath(new URL("../../../../..", import.meta.url)),
  appType: "mpa",
  server: { hmr: false, watch: null },
  logLevel: "warn",
  plugins: [
    {
      name: "rb-isolate",
      enforce: "pre",
      load(id) {
        if (process.env.RB_ISOLATE === "0") return null;
        if (OTHERS.test(id)) return "export {};";
        return null;
      },
    },
  ],
};

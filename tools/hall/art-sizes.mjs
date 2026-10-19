// Prints the Hall of Works' art pieces as the world hangs them: [{ id, src, w, h }] (JSON). The
// pixel previews (pixelize_art.py) are made at exactly these sizes, so they show 1:1 at play zoom.
//   node tools/hall/art-sizes.mjs
import { buildWorld } from "../../src/tesu/world/index.ts";

const w = buildWorld();
const out = w.sprites
  .filter((s) => s.id.startsWith("art-"))
  .map((s) => ({ id: s.id.slice(4), src: String(s.p.src), w: Number(s.p.w), h: Number(s.p.h) }));
process.stdout.write(JSON.stringify(out));

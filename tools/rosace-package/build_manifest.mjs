// Rosace packaging: the dex.sprite/1 manifests for both sizes. The clip definitions (the lab's player.clips.json +
// the World's sit clip, at the stand-in's own authoring scale) are scaled to each size with the World's own
// scaleClipSource (hitboxes, root motion, event offsets), so frame counts, durations, holds, phases, cancels and
// events are the stand-in's exactly; only the drawings change: each pose key's rect, pivot and anchors come from
// the packed frames (layout_<px>.json), and the source is "pipeline".
//   node tools/rosace-package/build_manifest.mjs --layout review/pack --out-root public/world [--px 80,144]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { registerHooks, stripTypeScriptTypes } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "../..");
registerHooks({ load(url, context, next) {
  const u = new URL(url);
  if (u.search === "?raw") return { format: "module", shortCircuit: true, source: `export default ${JSON.stringify(readFileSync(u, "utf8"))}` };
  if (u.protocol === "file:" && u.pathname.endsWith(".ts")) {
    return { format: "module", shortCircuit: true, source: stripTypeScriptTypes(readFileSync(u, "utf8"), { mode: "transform", sourceUrl: url }) };
  }
  return next(url, context);
} });
const imp = (p) => import(pathToFileURL(path.join(REPO, p)).href);
const { scaleClipSource } = await imp("src/world/player/scale.ts");
const { WORLD_CLIPS } = await imp("src/world/player/standin.ts");
const { SPRITE_CONTRACT, validatePackage } = await imp("src/lab/contracts.ts");

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i].replace(/^--/, ""), process.argv[i + 1]);
const layoutDir = args.get("layout"), outRoot = args.get("out-root");
const sizes = (args.get("px") ?? "80,144").split(",").map(Number);
const DIRS = { 80: "character", 144: "character-closeup" };

const lab = JSON.parse(readFileSync(path.join(REPO, "src/lab/data/player.clips.json"), "utf8"));
const src = { ...lab, clips: [...lab.clips, ...WORLD_CLIPS] };
const report = {};
for (const px of sizes) {
  const layout = JSON.parse(readFileSync(path.join(layoutDir, `layout_${px}.json`), "utf8"));
  const scaled = scaleClipSource(src, px / 96);
  const clips = scaled.clips.map((c) => ({
    ...c,
    atlas: "body",
    frames: c.frames.map((f) => {
      const L = layout.frames[f.pose];
      if (!L) throw new Error(`no packed drawing for pose ${f.pose} at ${px}`);
      return { ...f, rect: L.rect, pivot: L.pivot, anchors: { ...L.anchors, ...(f.anchors ?? {}) } };
    }),
  }));
  const pkg = validatePackage({
    contract: SPRITE_CONTRACT,
    name: "Rosace (pipeline, drive9 R2)",
    atlases: [{ id: "body", albedo: "body.png", normal: "body_n.png", width: layout.width, height: layout.height, shading: "baked" }],
    clips,
    ...(scaled.defaults ? { defaults: scaled.defaults } : {}),
  }, `Rosace H${px}`);
  const dir = path.join(outRoot, DIRS[px]);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(pkg, null, 1) + "\n");
  report[px] = { clips: pkg.clips.length, frames: pkg.clips.reduce((n, c) => n + c.frames.length, 0), atlas: [layout.width, layout.height] };
}
console.log(JSON.stringify(report));

// Execute the real World loader on the CPU. Only Vite imports and browser/GPU
// boundaries are adapted; this is not rendered-character or native acceptance.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks, stripTypeScriptTypes } from "node:module";

let declared = {};
registerHooks({ load(url, context, next) {
  const u = new URL(url);
  if (u.search === "?raw") return { format: "module", shortCircuit: true, source: `export default ${JSON.stringify(readFileSync(u, "utf8"))}` };
  if (u.protocol === "file:" && u.pathname.endsWith(".ts")) {
    let source = readFileSync(u, "utf8");
    if (u.pathname.endsWith("/world/player/setup.ts")) {
      const glob = 'import.meta.glob("/public/world/*/manifest.json")';
      assert(source.includes(glob), "the actual loader's build-time manifest inventory must be exercised");
      source = source.replace(glob, JSON.stringify(declared));
    }
    return { format: "module", shortCircuit: true, source: stripTypeScriptTypes(source, { mode: "transform", sourceUrl: url }) };
  }
  return next(url, context);
} });

const { PLAYER_CLIPS } = await import("../../lab/game/player.ts");
const { WORLD_CLIPS } = await import("../player/standin.ts");
function pkg(size) {
  return {
    contract: "dex.sprite/1", name: `CPU fixture ${size}`,
    atlases: [{ id: "body", albedo: "body.png", normal: "body_n.png", width: size, height: size, shading: "baked" }],
    clips: [...PLAYER_CLIPS, ...WORLD_CLIPS.map(c => c.id)].map(id => ({
      id, atlas: "body", loop: true,
      frames: [{ rect: [0, 0, size, size], pivot: [size / 2, size], duration: 2, pose: `${id}-a` }],
    })),
  };
}
const worldFile = "/world/character/manifest.json", closeFile = "/world/character-closeup/manifest.json";
const placeholder = { contract: "dex.sprite/1", standin: true };
let index = 0;
async function run(name, { files = {}, status = 200, mime = "application/json", network = false, wrongImage = null } = {}, expected) {
  declared = Object.fromEntries(Object.keys(files).map(path => [`/public${path}`, true]));
  const fetches = [], textures = [];
  const oldFetch = globalThis.fetch, oldImage = globalThis.Image, oldImageData = globalThis.ImageData;
  globalThis.fetch = async path => {
    fetches.push(path);
    if (network) throw new Error("offline fixture");
    return { ok: status === 200, status, headers: { get: () => mime }, text: async () => JSON.stringify(files[path]) };
  };
  globalThis.Image = class {
    set src(path) {
      const size = path.includes("character-closeup") ? 144 : 80;
      this.naturalWidth = path === wrongImage ? size - 1 : size;
      this.naturalHeight = size;
      queueMicrotask(() => this.onload());
    }
  };
  globalThis.ImageData = class {
    constructor(width, height) { this.width = width; this.height = height; this.data = new Uint8ClampedArray(width * height * 4); }
  };
  const renderer = { flatNormal: {}, texture(image) { textures.push(image); return {}; } };
  try {
    const { loadPlayer } = await import(`../player/setup.ts?assets-case=${index++}`);
    if (expected instanceof RegExp) {
      await assert.rejects(loadPlayer(renderer), expected, name);
      assert.equal(textures.length, 0, "bad pair or first atlas must fail before texture upload");
    } else {
      const result = await loadPlayer(renderer);
      assert.equal(result.sprite.source, expected);
      assert.equal(result.closeup.source, expected);
      assert(result.sprite.clips.has("sit") && result.closeup.clips.has("sit"));
      if (!Object.keys(files).length) assert.equal(fetches.length, 0, "no requests for absent optional manifests");
    }
    console.log(`PASS ${name}`);
  } finally {
    globalThis.fetch = oldFetch; globalThis.Image = oldImage; globalThis.ImageData = oldImageData;
  }
}

await run("both absent: real procedural bake, no manifest requests", {}, "standin");
await run("both explicit placeholders: real procedural bake", { files: { [worldFile]: placeholder, [closeFile]: placeholder } }, "standin");
const pair = { [worldFile]: pkg(80), [closeFile]: pkg(144) };
await run("valid declared pair: both pipeline", { files: pair }, "pipeline");
for (const missing of ["hurt", "sit"]) {
  const incomplete = structuredClone(pair);
  for (const p of Object.values(incomplete)) p.clips = p.clips.filter(c => c.id !== missing);
  await run(`both packages omit required ${missing}`, { files: incomplete }, new RegExp(`${missing}: missing`));
}
await run("one export absent", { files: { [worldFile]: pkg(80) } }, /install both/);
await run("one export placeholder", { files: { [worldFile]: pkg(80), [closeFile]: placeholder } }, /install both/);
await run("declared HTTP error", { files: pair, status: 404 }, /HTTP 404/);
await run("declared HTML response", { files: pair, mime: "text\/html" }, /expected a JSON response/);
await run("declared network error", { files: pair, network: true }, /offline fixture/);
await run("decoded albedo mismatch", { files: pair, wrongImage: "/world/character/body.png" }, /body.png: decoded/);
await run("decoded normal mismatch", { files: pair, wrongImage: "/world/character/body_n.png" }, /body_n.png: decoded/);
console.log("12 real-loader CPU cases passed; fetch, decoded-image and GPU boundaries are fixtures, not native proof.");

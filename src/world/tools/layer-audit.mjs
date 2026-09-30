// Layer-order audit: builds every backdrop scene (the /scenes/ prototypes and the scenes the rooms
// use) headlessly and checks that what is drawn later is not farther away than what is drawn
// before it, and that every bird layer sits where its depth says.
//
//   node src/world/tools/layer-audit.mjs [--scene arrival,causeway] [--verbose] [--json out.json]
//
// A scene is a back-to-front list of layers, each with a `depth` (1 = the player's plane, larger =
// farther, Infinity = the sky, below 1 = foreground); the engine draws them in list order and does
// not sort. So a layer that follows a NEARER one but has a bigger depth is drawn over it: a far
// ridge over a near rock, a far birds layer over the near hills, parallax out of depth order (it
// moves slower than the thing it covers). The audit reports
//   inversion   layer B drawn after layer A but farther than A (both opaque-ish: additive light,
//               the character and effect layers are skipped)
//   bird        a bird layer whose neighbours put it in the wrong place: a nearer opaque layer
//               drawn before it (it flies over something in front of it), or a farther opaque
//               layer drawn after it (something behind it covers it), plus its sprite scale
// Exit code 1 when any inversion or bird problem is found.
import { createServer } from "vite";
import { writeFileSync } from "node:fs";

globalThis.window ??= globalThis;
globalThis.addEventListener ??= () => {};
globalThis.document ??= { createElement: () => ({ getContext: () => null, style: {} }), addEventListener() {}, getElementById: () => null };

const args = process.argv.slice(2);
const opt = (k, d) => {
  const i = args.indexOf(`--${k}`);
  return i < 0 ? d : (args[i + 1] ?? true);
};
const only = opt("scene", "") ? String(opt("scene")).split(",") : null;
const verbose = args.includes("--verbose");
const raw = args.includes("--raw"); // the lists as the scenes build them, before the engine's placeFlocks()

/**
 * Order the scenes keep on purpose: [scene title, the layer drawn later, why]. They are listed, not
 * failed. A layer here is a drawn-on-purpose exception; anything else an inversion reports is a bug.
 */
const INTENT = [
  ["pilgrim-path", "colossi", "the colossi stand in the valley below the horizon; they never overlap the spire's silhouette above it"],
  ["pilgrim-path", "valley-mist", "the valley mist wraps the spire's base on purpose"],
  ["bell-stair", "colossi", "as pilgrim-path (the same backdrop)"],
  ["bell-stair", "valley-mist", "as pilgrim-path"],
  ["chapel-porch", "colossi", "as pilgrim-path"],
  ["chapel-porch", "valley-mist", "as pilgrim-path"],
  ["hollow-mouth", "spire", "the spire is seen through the mouth's opening, framed by the back wall drawn first"],
  ["hollow-mouth", "arcade", "the arches are framing; rim is a lit edge drawn under them"],
  ["hollow-mouth", "east-arch", "as arcade"],
  ["spire-blade", "storm-on-spire", "the storm is a sky band that sits over the world below; it never clears in the west"],
  ["spire-blade", "break-1", "the stepped storm-break bands part one after another over the world below"],
  ["spire-blade", "break-2", "as break-1"],
  ["spire-blade", "break-3", "as break-1"],
  ["spire-blade", "break-4", "as break-1"],
];
const bare = (name) => name.split(" (")[0];
const intent = (scene, layer) => INTENT.find(([s, l]) => s === scene && l === layer)?.[2];

const server = await createServer({ root: process.cwd(), configFile: false, appType: "custom", server: { middlewareMode: true, hmr: false, watch: null }, logLevel: "error", optimizeDeps: { noDiscovery: true, include: [] } });

const results = [];
try {
  const { discoverRooms } = await server.ssrLoadModule("/src/world/rooms/registry.ts");
  const { SCALE } = await server.ssrLoadModule("/src/scenes/engine/scale.ts");
  const { placeFlocks } = await server.ssrLoadModule("/src/scenes/engine/order.ts");
  const fs = await import("node:fs");
  const dir = "src/scenes/scenes";
  const scenes = new Map(); // title -> { def, used }
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".ts")) continue;
    try {
      const m = await server.ssrLoadModule(`/${dir}/${f}`);
      if (m.default?.build) scenes.set(m.default.title ?? f, { def: m.default, where: `scenes/${f}` });
    } catch (e) {
      results.push({ scene: f, error: String(e.message ?? e).slice(0, 120) });
    }
  }
  for (const [id, room] of discoverRooms().rooms) {
    const sc = room.backdrop?.scene;
    if (sc?.build && !scenes.has(sc.title)) scenes.set(sc.title, { def: sc, where: `room ${id}` });
  }
  const W = SCALE.view.w, H = SCALE.view.h;
  for (const [title, { def, where }] of [...scenes].sort(([a], [b]) => a.localeCompare(b))) {
    if (only && !only.includes(title)) continue;
    const rows = Object.keys({ standin: 0, ...def.palette });
    const span = Math.round(def.span ? def.span(W, H) : W * 0.5);
    let seed = 7;
    const ctx = {
      mode: "world", W, H, u: H / 360, world: 1, player: SCALE.H, span,
      row: (n) => { const i = rows.indexOf(n); if (i < 0) throw new Error(`no ramp ${n}`); return i; },
      par: (d) => (Number.isFinite(d) ? 1 / d : 0),
      panWidth: (d) => W + Math.ceil(span * (Number.isFinite(d) ? 1 / d : 0)) + 2,
      fogAt: () => 0,
      rng: () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296),
    };
    let layers;
    try {
      layers = raw ? def.build(ctx) : placeFlocks(def.build(ctx));
    } catch (e) {
      results.push({ scene: title, where, error: String(e.message ?? e).slice(0, 140) });
      continue;
    }
    const L = layers.map((l, i) => ({ i, name: l.name, kind: l.kind, depth: l.depth, add: l.blend === "add", bird: l.kind === "points" && l.system?.constructor?.name === "Flock", sys: l.kind === "points" ? l.system?.constructor?.name : "" }));
    // solid-ish layers: they can hide or be hidden (glsl mist and pix count; additive light, points and the figure do not)
    const GROUND_PLANE = /(^|-)(water|lake|sea|plain|flats|floor|ground)$/;
    const solid = (l) => !l.add && (l.kind === "pix" || l.kind === "glsl") && !GROUND_PLANE.test(l.name);
    const inversions = [];
    for (const a of L) {
      if (!solid(a)) continue;
      for (const b of L) {
        if (b.i <= a.i || !solid(b)) continue;
        if (b.depth > a.depth + 1e-9 && Number.isFinite(a.depth)) inversions.push({ first: `${a.name} (${a.depth})`, later: `${b.name} (${b.depth})` });
      }
    }
    // keep only the tightest statement: each later layer against the nearest earlier layer it is farther than
    const seen = new Set();
    const all = inversions.filter((x) => { const k = x.later; if (seen.has(k)) return false; seen.add(k); return true; });
    const inv = all.filter((x) => !intent(title, bare(x.later)));
    const intended = all.filter((x) => intent(title, bare(x.later))).map((x) => ({ ...x, why: intent(title, bare(x.later)) }));
    const birds = [];
    for (const b of L.filter((l) => l.bird)) {
      const inFront = L.filter((l) => l.i < b.i && solid(l) && l.depth < b.depth - 1e-9); // nearer, drawn before: the bird is over it
      const behind = L.filter((l) => l.i > b.i && solid(l) && l.depth > b.depth + 1e-9 && Number.isFinite(l.depth)); // farther, drawn after: it covers the bird
      birds.push({ name: b.name, depth: b.depth, at: b.i, of: L.length, overNearer: inFront.map((l) => `${l.name} (${l.depth})`), underFarther: behind.map((l) => `${l.name} (${l.depth})`) });
    }
    results.push({ scene: title, where, layers: L, inversions: inv, intended, birds });
  }
} finally {
  await server.close();
}

let bad = 0;
const lines = [];
for (const r of results) {
  if (r.error) { lines.push(`${String(r.scene).padEnd(22)} ERROR ${r.error}`); continue; }
  const nb = r.birds.filter((b) => b.overNearer.length || b.underFarther.length).length;
  bad += r.inversions.length + nb;
  lines.push(`${r.scene.padEnd(22)} ${String(r.layers.length).padStart(3)} layers  inversions ${r.inversions.length}${r.intended.length ? ` (+${r.intended.length} intended)` : ""}  birds ${r.birds.length} (wrong ${nb})   [${r.where}]`);
  if (verbose) lines.push("    " + r.layers.map((l) => `${l.i}:${l.name}@${l.depth}${l.add ? "+" : ""}`).join("  "));
  for (const x of r.inversions) lines.push(`    inversion  ${x.later} is drawn after a nearer layer: ${x.first}`);
  if (verbose) for (const x of r.intended) lines.push(`    intended   ${x.later} after ${x.first}: ${x.why}`);
  for (const b of r.birds) {
    if (b.overNearer.length) lines.push(`    bird ${b.name}@${b.depth}: drawn over nearer ${b.overNearer.join(", ")}`);
    if (b.underFarther.length) lines.push(`    bird ${b.name}@${b.depth}: covered by farther ${b.underFarther.join(", ")}`);
  }
}
lines.push("");
lines.push(`${results.filter((r) => !r.error).length} scenes, ${results.reduce((n, r) => n + (r.inversions?.length ?? 0), 0)} inversions (${results.reduce((n, r) => n + (r.intended?.length ?? 0), 0)} more are intended, see INTENT), ${results.reduce((n, r) => n + (r.birds?.filter((b) => b.overNearer.length || b.underFarther.length).length ?? 0), 0)} misplaced bird layers`);
console.log(lines.join("\n"));
const jsonOut = opt("json", "");
if (jsonOut) writeFileSync(String(jsonOut), JSON.stringify(results, null, 1));
process.exit(bad ? 1 : 0);

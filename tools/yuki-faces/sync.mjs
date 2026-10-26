// Pixel Yuki on dex.place is the YUKI app's own mascot (Dex 10-26: the site's Yuki stays consistent with the app's).
// This reads the app's face code from a YUKI checkout at a git ref (never its working tree, which a taste round may be
// editing) and writes src/site/yuki-faces.ts: her palette, her layers and the app's mascot timings, as data.
//
//   node tools/yuki-faces/sync.mjs <path to a YUKI checkout> [ref, default HEAD]
//
// It runs the app's own composition (packages/desktop/src/renderer/src/ui/pixel/faces.ts, the look "yuki") and splits
// each face into the layers the site animates on its own: the back hair, the body, the bare head, then the eyes, the
// blush and the mouth of each expression, and the front pieces (ahoge, clip) in their two frames. Before writing, it
// lays the layers back together and checks them against the app's composeParts for every expression, frame and glance:
// the site's pixels are the app's, or the sync fails.

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const [repo, ref = "HEAD"] = process.argv.slice(2);
if (!repo) {
  console.error("usage: node tools/yuki-faces/sync.mjs <path to a YUKI checkout> [ref]");
  process.exit(2);
}
const UI = "packages/desktop/src/renderer/src/ui";
const git = (...a) => execFileSync("git", ["-C", repo, ...a], { encoding: "utf8" }).trim();
const sha = git("rev-parse", "--short", `${ref}^{commit}`);
const date = git("show", "-s", "--format=%cs", sha);

// the app's files at that commit, in a scratch folder, their relative imports given the .ts Node needs
const tmp = mkdtempSync(join(tmpdir(), "yuki-faces-"));
const files = { "faces.ts": `${UI}/pixel/faces.ts`, "grid.ts": `${UI}/pixel/grid.ts`, "mascotFrames.ts": `${UI}/mascotFrames.ts` };
for (const [name, path] of Object.entries(files)) {
  const src = git("show", `${sha}:${path}`).replace(/from '(\.{1,2}\/[^']+?)(\.ts)?'/g, (_, p) => `from '${p.replace(/^\.\/pixel\//, "./")}.ts'`);
  writeFileSync(join(tmp, name), src);
}
const F = await import(pathToFileURL(join(tmp, "faces.ts")).href);
const M = await import(pathToFileURL(join(tmp, "mascotFrames.ts")).href);
rmSync(tmp, { recursive: true, force: true });

const N = F.FACE;
const lk = F.LOOKS.yuki;
const blank = () => Array.from({ length: N }, () => ".".repeat(N));
const over = (g, top) => g.map((row, y) => [...row].map((c, x) => (top[y][x] !== "." ? top[y][x] : c)).join(""));
const stack = (...gs) => gs.reduce((a, b) => over(a, b), blank());
const same = (a, b) => a.every((row, y) => row === b[y]);
/** What `g` adds over `base` in rows [y0, y1). */
const diff = (g, base, y0 = 0, y1 = N) => g.map((row, y) => (y < y0 || y >= y1 ? ".".repeat(N) : [...row].map((c, x) => (c !== base[y][x] ? c : ".")).join("")));

const head = (expr, opts = {}) => F.composeParts(lk, expr, opts).head;
// the head before its face, as composeParts draws it: the bare head with the app's selective outline (where its
// outline lies against hair behind it, it takes the back hair's tone), read off a composed face. `h`: that face.
const outlined = (h) => F.bareHead().map((row, y) => [...row].map((c, x) => (c === "O" && h[y][x] !== "O" && h[y][x] !== "." ? h[y][x] : c)).join(""));
const bare = outlined(head("neutral"));
const front = lk.front ? [lk.front[0], lk.front[1]] : [blank(), blank()];
const gear = lk.gear ?? blank();
const base = (f) => stack(bare, front[f], gear);
const eyeRows = [0, F.BLUSH_Y];
const mouthRows = [F.MOUTH_Y, N];

// the eyes of every shape, and the open eyes glancing (the app moves the iris inside the eye)
const shapes = ["open", "half", "closed", "happy", "focused", "sleepy", "sad", "wide", "squeeze"];
const eyes = {};
for (const s of shapes) eyes[s] = diff(head("neutral", { eyes: s }), base(0), ...eyeRows);
for (const [name, g] of [["open-l", -1], ["open-r", 1]]) eyes[name] = diff(head("neutral", { glance: g }), base(0), ...eyeRows);
const blush = {
  soft: diff(head("neutral"), base(0), F.BLUSH_Y, F.BLUSH_Y + 1),
  strong: diff(head("happy"), base(0), F.BLUSH_Y, F.BLUSH_Y + 1),
};
// (the app's sad face welling a tear on the cheek in place of a blush pixel: checked below, not shown on the site)
const blushOf = (e) => (e.tear ? diff(head(Object.keys(F.EXPRESSIONS).find((k) => F.EXPRESSIONS[k] === e)), base(0), F.BLUSH_Y, F.BLUSH_Y + 1) : blush[e.blush ? "strong" : "soft"]);
const mouthOf = { small: "neutral", smile: "happy", open: "surprised", flat: "focused", frown: "sad" };
const mouths = Object.fromEntries(Object.entries(mouthOf).map(([m, expr]) => [m, diff(head(expr), base(0), ...mouthRows)]));
const props = Object.fromEntries(["zz", "zz-up", "sparkle", "sparkle-alt"].map((p) => [p, F.propGrid(p)]));
const parts0 = F.composeParts(lk, "neutral", { frame: 0 });
const parts1 = F.composeParts(lk, "neutral", { frame: 1 });

// lay them back together and check every face against the app's own
const failures = [];
for (const expr of Object.keys(F.EXPRESSIONS)) {
  const e = F.EXPRESSIONS[expr];
  for (const frame of [0, 1]) {
    const glances = F.CAN_BLINK.has(expr) && e.eyes === "open" ? [0, -1, 1] : [0];
    for (const g of glances) {
      const eyeLayer = g ? eyes[g < 0 ? "open-l" : "open-r"] : eyes[e.eyes];
      const mouth = Object.entries(mouthOf).find(([, x]) => F.EXPRESSIONS[x].mouth === e.mouth)?.[0];
      const want = F.composeParts(lk, expr, { frame, glance: g }).head;
      const got = stack(bare, eyeLayer, blushOf(e), mouth ? mouths[mouth] : blank(), front[frame], gear);
      if (!same(got, want)) { failures.push(`${expr} frame ${frame} glance ${g}`); if (process.env.DEBUG) got.forEach((r, y) => r !== want[y] && console.error(y, r, want[y])); }
    }
  }
}
// a hop's landing squash (the app's HOP_SWAY "land"): her long hair splayed a pixel outward, frame A in front, open
// eyes turned to the app's LAND_EYES (shut before it had them); the head's outline follows the splayed hair, so its few
// changed pixels are a layer too
const landEyes = M.LAND_EYES ?? "closed";
const landParts = F.composeParts(lk, "neutral", { frame: 0, splay: true, eyes: landEyes });
const landHead = diff(outlined(landParts.head), bare);
if (!eyes[landEyes] || !same(stack(bare, landHead, eyes[landEyes], blush.soft, mouths.small, front[0], gear), landParts.head)) failures.push("the landing frame");
if (!same(parts0.back, F.composeParts(lk, "happy", { frame: 0 }).back) || !same(parts0.body, parts1.body)) failures.push("back or body changes with the face");
if (failures.length) {
  console.error(`the layers don't add up to the app's faces: ${failures.join("; ")}`);
  process.exit(1);
}

// the palette: only letters her layers use
const all = [parts0.back, parts1.back, landParts.back, landHead, parts0.body, bare, ...front, gear, ...Object.values(eyes), ...Object.values(blush), ...Object.values(mouths), ...Object.values(props)];
const used = new Set(all.flatMap((g) => g.join("").split("")).filter((c) => c !== "."));
const palette = Object.fromEntries([...used].sort().map((c) => [c, lk.pal[c]]));
for (const [c, hex] of Object.entries(palette)) if (!/^#[0-9a-f]{6}$/i.test(hex ?? "")) throw new Error(`no colour for "${c}"`);

/** A layer as its rows with pixels and the first row's index (feature layers are a few rows of the 32). */
const crop = (g) => {
  const ys = g.map((row, y) => (/[^.]/.test(row) ? y : -1)).filter((y) => y >= 0);
  return ys.length ? { y: ys[0], rows: g.slice(ys[0], ys.at(-1) + 1) } : { y: 0, rows: [] };
};
const js = (v) => JSON.stringify(v);
const lines = (xs) => xs.join(String.fromCharCode(10));
/** A layer as TS at an indent (`pad`: the indent of the line it starts on). */
const layerTs = (g, pad = "") => {
  const c = crop(g);
  return lines(["{", `${pad}  y: ${c.y},`, `${pad}  rows: [`, ...c.rows.map((r) => `${pad}    ${js(r)},`), `${pad}  ],`, `${pad}}`]);
};
const pair = (a, b) => lines(["[", `  ${layerTs(a, "  ")},`, `  ${layerTs(b, "  ")},`, "]"]);
const record = (o) => lines(["{", ...Object.entries(o).map(([k, g]) => `  ${/^[a-z]+$/.test(k) ? k : js(k)}: ${layerTs(g, "  ")},`), "}"]);
const pick = (o, keys) => Object.fromEntries(keys.filter((k) => k in o).map((k) => [k, o[k]]));

const out = `// GENERATED by tools/yuki-faces/sync.mjs from the YUKI app at ${sha} (${date}): its mascot's look "yuki"
// (packages/desktop/src/renderer/src/ui/pixel/faces.ts) and its timings (ui/mascotFrames.ts). Don't edit by hand:
// change the app, then rerun the sync. The sync checked that these layers, laid back together, are the app's faces
// pixel for pixel. yuki-sprite.ts draws them.

/** Where these came from. */
export const YUKI_FACES_SOURCE = { commit: ${js(sha)}, date: ${js(date)} } as const;

/** Her bust is ${N} x ${N} pixels. */
export const FACE = ${N};

/** Palette letters to colours (outlines are a darker hue of their colour; K, the lid, is the darkest). */
export const PALETTE = ${lines(["{", ...Object.entries(palette).map(([c, hex]) => `  ${c}: ${js(hex.toLowerCase())},`), "}"])} as const;
export type FaceKey = keyof typeof PALETTE;

/** A layer: rows of palette letters ("." empty), the first at row \`y\` of the bust. */
export interface Layer {
  readonly y: number;
  readonly rows: readonly string[];
}

/** Behind the head: her long hair (it bobs with the head). Two sprite frames. */
export const BACK: readonly [Layer, Layer] = ${pair(parts0.back, parts1.back)};
/** The shoulders and neck (they stay still while the head bobs). */
export const BODY: Layer = ${layerTs(parts0.body)};
/** The head without a face: skin, the front hair. */
export const HEAD: Layer = ${layerTs(bare)};
/** A hop's landing squash (the app's HOP_SWAY "land"): her long hair splayed a pixel outward (in place of BACK), the
 *  few outline pixels of the head that follow it (over HEAD), and what her open eyes turn to (the app's LAND_EYES). */
export const LAND: { readonly back: Layer; readonly head: Layer; readonly eyes: ${js(landEyes)} } = ${lines(["{", `  back: ${layerTs(landParts.back, "  ")},`, `  head: ${layerTs(landHead, "  ")},`, `  eyes: ${js(landEyes)},`, "}"])};
/** Over the face: the ahoge and her clip, two sprite frames (the ahoge sways). */
export const FRONT: readonly [Layer, Layer] = ${pair(front[0], front[1])};
/** The eyes by shape; "open-l" and "open-r" are the open eyes glancing left and right. */
export const EYES = ${record(eyes)} as const satisfies Record<string, Layer>;
/** The blush: soft always, strong when she is happy or flustered. */
export const BLUSH = ${record(blush)} as const satisfies Record<string, Layer>;
/** The mouths. */
export const MOUTHS = ${record(mouths)} as const satisfies Record<string, Layer>;
/** Props drawn around the head, two frames each: zz (asleep), sparkle (happy). */
export const PROPS = ${record(props)} as const satisfies Record<string, Layer>;

/** The app's expressions: which eyes, mouth and blush each shows. */
export const EXPRESSIONS = ${JSON.stringify(Object.fromEntries(Object.entries(F.EXPRESSIONS).map(([k, e]) => [k, { eyes: e.eyes, mouth: Object.entries(mouthOf).find(([, x]) => F.EXPRESSIONS[x].mouth === e.mouth)?.[0] ?? null, blush: e.blush ? "strong" : "soft" }])), null, 2)} as const;

/** The app's mascot timings (ms), from ui/mascotFrames.ts: awake the "waiting" status's clock, asleep the "queued" one's
 *  (\`sway\`: which sprite frame each beat shows, A 0 or B 1). */
export const TIMING = ${JSON.stringify({
  // awake she keeps the app's "waiting" clock (its frames sway the ahoge A, B, A), asleep its "queued" one (A, B)
  frameMs: M.FRAME_MS?.waiting,
  bobMs: M.BOB_MS?.waiting,
  sway: M.STATUS_FRAMES.waiting.map((f, i) => M.swayOf(f, i)),
  asleep: { frameMs: M.FRAME_MS?.queued, bobMs: M.BOB_MS?.queued, sway: M.STATUS_FRAMES.queued.map((f, i) => M.swayOf(f, i)) },
  ...pick({ blinkSteps: M.BLINK_STEPS, swapSteps: M.SWAP_STEPS, glance: M.GLANCE, hopSteps: M.HOP_STEPS, hopSway: M.HOP_SWAY, hopMs: M.HOP_MS, press: M.PRESS }, ["blinkSteps", "swapSteps", "glance", "hopSteps", "hopSway", "hopMs", "press"]),
}, null, 2)} as const;
`;
const dest = fileURLToPath(new URL("../../src/site/yuki-faces.ts", import.meta.url));
writeFileSync(dest, out);
console.log(`wrote ${dest} from ${sha} (${date}): ${Object.keys(eyes).length} eyes, ${Object.keys(mouths).length} mouths, ${Object.keys(palette).length} colours`);

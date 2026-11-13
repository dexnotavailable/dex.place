// Materials: what a cell is made of. Each material has a 4-tone ramp (deep,
// shadow, lit, highlight; hue-shifted shadows), the thresholds on the key-lit
// value that pick a tone (the same banding Rosace's pipeline uses, see
// art/rosace/palette.json), outline colours (line, lit-side selout, inner
// line), an optional specular band, and how it behaves when hit.
//
// The world stays muted so Rosace stays the brightest, clearest thing on
// screen: world ramps top out well below her W1 white.

import rosaceRaw from "../../art/rosace/palette.json?raw";

export type Hex = string;
export type RGB = [number, number, number];

/** How a material reacts to damage (PIXEL-MATTER.md, "Material behaviour"). */
export type Behaviour =
  | "crumble" // stone: chips, cracks spread, crumbles into chunks and dust
  | "shatter" // glass: the whole pane shatters into glinting shards
  | "splinter" // wood: long splinters along the grain
  | "dent" // metal: dents (surface pushed in) and sparks, rarely breaks
  | "tear" // cloth, paper, rope: cut along the slash
  | "gutter" // flame: gutters out
  | "splash" // water: ripples and splashes
  | "none"; // indestructible (glyph light, seal)

export interface MaterialSpec {
  /** deep, shadow, lit, highlight. */
  ramp: [Hex, Hex, Hex, Hex];
  /** Key-lit value where shadow, lit and highlight start (deep below the first). */
  t?: [number, number, number];
  /** Outline colour (default: the shared world ink OL). */
  line?: Hex;
  /** Lit-side outline (default: the deep tone). */
  selout?: Hex;
  /** Inner line where this material's piece sits in front of another (default: deep). */
  inner?: Hex;
  spec?: { colour: Hex; thr: number };
  /** Emits its own light; ignores lighting (flame, glyphs, seals). */
  emissive?: boolean;
  /** Share of the colour that comes from light behind it (stained glass, screens), 0..1. */
  glow?: number;
  /** Gets outlines and inner lines (default true). */
  ink?: boolean;
  /** Takes the glint sweep (metal, glass). */
  glint?: boolean;
  behaviour: Behaviour;
  /** Hit points per cell. A light slash deals ~40 per covered cell. */
  hardness: number;
  bounce?: number;
  friction?: number;
  /** Sound family: cues are `<sound>.hit`, `<sound>.break`, `<sound>.step`. */
  sound: string;
  /** Dust particle colour when it crumbles (default: shadow tone). */
  dust?: Hex;
  /** Fraction of removed cells that fly as pixels (the rest become chunks or vanish into dust). */
  debris?: number;
}

export interface Material extends MaterialSpec {
  id: number;
  name: string;
  rgb: RGB[];
  lineRgb: RGB;
  seloutRgb: RGB;
  innerRgb: RGB;
  specRgb: RGB | null;
  dustRgb: RGB;
}

export function hex(h: Hex): RGB {
  const s = h.replace("#", "");
  const n = parseInt(s.length === 3 ? s.split("").map((c) => c + c).join("") : s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function toHex([r, g, b]: RGB): Hex {
  return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;
}

// ---------------------------------------------------------------------------
// Rosace's palette: the world ink and her own materials (for the scale gauge
// and anything that must match her exactly).
// ---------------------------------------------------------------------------
interface RosacePalette {
  colors: Record<string, Hex>;
  materials: Record<string, { ramp: string[]; t: number[]; line: string; selout: string; inner: string; spec?: { code: string; thr?: number } }>;
}
let ROSACE: RosacePalette | null = null;
try {
  ROSACE = JSON.parse(rosaceRaw) as RosacePalette;
} catch {
  ROSACE = null;
}
/** The shared outline ink (Rosace's OL). */
export const INK: Hex = ROSACE?.colors["OL"] ?? "#181032";

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------
const byName = new Map<string, Material>();
const byId: (Material | undefined)[] = [];

export function defineMaterial(name: string, spec: MaterialSpec): Material {
  const existing = byName.get(name);
  const id = existing ? existing.id : byId.length === 0 ? 1 : byId.length;
  if (id > 250) throw new Error("pixel: at most 250 materials");
  const rgb = spec.ramp.map(hex);
  const m: Material = {
    ...spec,
    id,
    name,
    rgb,
    lineRgb: hex(spec.line ?? INK),
    seloutRgb: hex(spec.selout ?? spec.ramp[0]),
    innerRgb: hex(spec.inner ?? spec.ramp[0]),
    specRgb: spec.spec ? hex(spec.spec.colour) : null,
    dustRgb: hex(spec.dust ?? spec.ramp[1]),
  };
  if (byId.length === 0) byId.push(undefined); // id 0 is empty
  byId[id] = m;
  byName.set(name, m);
  materialsVersion++;
  return m;
}

export let materialsVersion = 0;

export function mat(name: string): Material {
  const m = byName.get(name);
  if (!m) throw new Error(`pixel: unknown material "${name}"`);
  return m;
}

export function matById(id: number): Material | undefined {
  return byId[id];
}

export function allMaterials(): Material[] {
  return byId.filter((m): m is Material => !!m);
}

export type MatRef = string | Material;
export function resolveMat(m: MatRef): Material {
  return typeof m === "string" ? mat(m) : m;
}

// ---------------------------------------------------------------------------
// World materials (muted). Shadows lean cool/violet, lights lean warm.
// ---------------------------------------------------------------------------
const T_STONE: [number, number, number] = [0.16, 0.44, 0.8];
const T_METAL: [number, number, number] = [0.12, 0.34, 0.7];

defineMaterial("stone", { ramp: ["#34303f", "#4f4a5a", "#6f6875", "#928993"], t: T_STONE, behaviour: "crumble", hardness: 90, sound: "stone", debris: 0.35, bounce: 0.25 });
defineMaterial("stoneLight", { ramp: ["#4a4452", "#686170", "#8c8490", "#b2a9ad"], t: T_STONE, behaviour: "crumble", hardness: 90, sound: "stone", debris: 0.35, bounce: 0.25 });
defineMaterial("stoneDark", { ramp: ["#1f1c28", "#2e2a37", "#413c4b", "#57515f"], t: T_STONE, behaviour: "crumble", hardness: 110, sound: "stone", debris: 0.3, bounce: 0.2 });
defineMaterial("mortar", { ramp: ["#1a1721", "#25212c", "#322d39", "#403a47"], t: T_STONE, behaviour: "crumble", hardness: 50, sound: "stone", debris: 0.2 });
defineMaterial("marble", { ramp: ["#5d566a", "#807a8e", "#a7a1b2", "#c8c2cc"], t: [0.14, 0.4, 0.78], behaviour: "crumble", hardness: 110, sound: "stone", debris: 0.35, spec: { colour: "#ddd6dc", thr: 0.985 } });
defineMaterial("wood", { ramp: ["#2a1a1d", "#452a26", "#643f32", "#855841"], t: [0.14, 0.42, 0.8], behaviour: "splinter", hardness: 60, sound: "wood", debris: 0.25, bounce: 0.3 });
defineMaterial("woodDark", { ramp: ["#19111a", "#2a1a1e", "#3d2723", "#553729"], t: [0.14, 0.42, 0.8], behaviour: "splinter", hardness: 60, sound: "wood", debris: 0.25, bounce: 0.3 });
defineMaterial("iron", { ramp: ["#16151e", "#262633", "#3d3f51", "#5f6379"], t: T_METAL, behaviour: "dent", hardness: 320, sound: "metal", glint: true, spec: { colour: "#9aa3bd", thr: 0.965 }, bounce: 0.35, debris: 0.05 });
defineMaterial("brass", { ramp: ["#3f2a17", "#6b4a22", "#9c742f", "#c9a255"], t: T_METAL, behaviour: "dent", hardness: 260, sound: "metal", glint: true, spec: { colour: "#f0dc98", thr: 0.955 }, bounce: 0.35, debris: 0.05 });
defineMaterial("bronze", { ramp: ["#2c1f1d", "#4b3228", "#6e4c34", "#93704a"], t: T_METAL, behaviour: "dent", hardness: 280, sound: "metal", glint: true, spec: { colour: "#c9a877", thr: 0.965 }, bounce: 0.35, debris: 0.05 });
defineMaterial("lead", { ramp: ["#0f0e14", "#18171f", "#23222c", "#302f3a"], t: T_METAL, behaviour: "dent", hardness: 70, sound: "metal", bounce: 0.1, debris: 0.1 });
defineMaterial("clothRed", { ramp: ["#34121d", "#541c29", "#782a35", "#984043"], t: [0.12, 0.4, 0.78], behaviour: "tear", hardness: 30, sound: "cloth", debris: 0.15 });
defineMaterial("clothIndigo", { ramp: ["#1a1833", "#27254d", "#373566", "#4d4b82"], t: [0.12, 0.4, 0.78], behaviour: "tear", hardness: 30, sound: "cloth", debris: 0.15 });
defineMaterial("parchment", { ramp: ["#5e4c42", "#8a7461", "#b39c80", "#d2c09f"], t: [0.12, 0.38, 0.78], behaviour: "tear", hardness: 25, sound: "cloth", debris: 0.2 });
defineMaterial("mapInk", { ramp: ["#2a1b22", "#3d2830", "#553a3c", "#6d4c48"], t: [0.12, 0.38, 0.78], behaviour: "tear", hardness: 25, sound: "cloth", ink: false });
defineMaterial("mapRed", { ramp: ["#4a1620", "#6e2330", "#95323a", "#b04a48"], t: [0.12, 0.38, 0.78], behaviour: "tear", hardness: 25, sound: "cloth", ink: false });
defineMaterial("rope", { ramp: ["#2e2219", "#4b3a28", "#6a553a", "#8a724f"], t: [0.14, 0.42, 0.8], behaviour: "tear", hardness: 18, sound: "cloth", debris: 0.2 });
defineMaterial("wax", { ramp: ["#7a6a60", "#a8998a", "#cfc3b1", "#e8dfcf"], t: [0.1, 0.36, 0.74], behaviour: "crumble", hardness: 25, sound: "wax", debris: 0.4, bounce: 0.1 });
defineMaterial("flame", { ramp: ["#a8401c", "#e67f2a", "#ffc75a", "#fff3cc"], emissive: true, ink: false, behaviour: "gutter", hardness: 1, sound: "flame" });
defineMaterial("ember", { ramp: ["#5a1c10", "#9c3a18", "#e07024", "#ffb050"], emissive: true, ink: false, behaviour: "gutter", hardness: 1, sound: "flame" });
defineMaterial("glassRed", { ramp: ["#3e0e1a", "#6e1a2a", "#a83342", "#e2777a"], t: [0.1, 0.35, 0.9], glow: 0.85, glint: true, behaviour: "shatter", hardness: 12, sound: "glass", ink: false, spec: { colour: "#ffd2cc", thr: 0.97 }, bounce: 0.3, debris: 0.5 });
defineMaterial("glassBlue", { ramp: ["#0e1840", "#1a3274", "#335fb4", "#7aa8ec"], t: [0.1, 0.35, 0.9], glow: 0.85, glint: true, behaviour: "shatter", hardness: 12, sound: "glass", ink: false, spec: { colour: "#d0e4ff", thr: 0.97 }, bounce: 0.3, debris: 0.5 });
defineMaterial("glassGold", { ramp: ["#3e2c0e", "#735618", "#b88d2c", "#ecc97a"], t: [0.1, 0.35, 0.9], glow: 0.85, glint: true, behaviour: "shatter", hardness: 12, sound: "glass", ink: false, spec: { colour: "#fff0c4", thr: 0.97 }, bounce: 0.3, debris: 0.5 });
defineMaterial("glassGreen", { ramp: ["#0d3024", "#185a40", "#2f8c62", "#86d0a2"], t: [0.1, 0.35, 0.9], glow: 0.85, glint: true, behaviour: "shatter", hardness: 12, sound: "glass", ink: false, spec: { colour: "#d6ffe2", thr: 0.97 }, bounce: 0.3, debris: 0.5 });
defineMaterial("glassViolet", { ramp: ["#23123d", "#3e2270", "#6440a6", "#a888dc"], t: [0.1, 0.35, 0.9], glow: 0.85, glint: true, behaviour: "shatter", hardness: 12, sound: "glass", ink: false, spec: { colour: "#e8dcff", thr: 0.97 }, bounce: 0.3, debris: 0.5 });
defineMaterial("glassPale", { ramp: ["#26333f", "#44606e", "#7c9fae", "#c8e0e6"], t: [0.1, 0.35, 0.9], glow: 0.7, glint: true, behaviour: "shatter", hardness: 12, sound: "glass", ink: false, spec: { colour: "#f0fbff", thr: 0.97 }, bounce: 0.3, debris: 0.5 });
defineMaterial("screen", { ramp: ["#08090e", "#0d1018", "#131823", "#1c2331"], t: [0.1, 0.4, 0.85], glint: true, behaviour: "none", hardness: 999, sound: "glass", spec: { colour: "#3a4760", thr: 0.975 } });
defineMaterial("glyph", { ramp: ["#4a2408", "#a85a18", "#f29a3c", "#ffe1a4"], emissive: true, ink: false, behaviour: "none", hardness: 999, sound: "glass" });
defineMaterial("seal", { ramp: ["#34091a", "#7c1830", "#d23a54", "#ffc2b8"], emissive: true, ink: false, behaviour: "none", hardness: 999, sound: "seal" });
defineMaterial("water", { ramp: ["#0f1f2c", "#1a3446", "#2c5064", "#5c8a9a"], t: [0.1, 0.4, 0.86], glint: true, ink: false, behaviour: "splash", hardness: 999, sound: "water", spec: { colour: "#b8dde4", thr: 0.96 } });
defineMaterial("foliage", { ramp: ["#132019", "#1f3326", "#2f4a33", "#476644"], t: [0.14, 0.42, 0.8], behaviour: "tear", hardness: 10, sound: "leaf", debris: 0.6 });
// --- shared kit (phase 2): outdoors, cloth, lamps, signs, cables -------------
const T_SOFT: [number, number, number] = [0.12, 0.4, 0.78];
defineMaterial("earth", { ramp: ["#211a1d", "#382c2a", "#524238", "#6e5c4a"], t: T_STONE, behaviour: "crumble", hardness: 60, sound: "earth", debris: 0.4, bounce: 0.15 });
defineMaterial("moss", { ramp: ["#172119", "#243526", "#374e33", "#546a44"], t: T_SOFT, behaviour: "tear", hardness: 12, sound: "leaf", debris: 0.5 });
defineMaterial("grass", { ramp: ["#1b2822", "#2a3d30", "#42593d", "#667a4f"], t: T_SOFT, behaviour: "tear", hardness: 8, sound: "leaf", debris: 0.6 });
defineMaterial("grassDry", { ramp: ["#2c281e", "#463e28", "#6a5c37", "#8f7e4b"], t: T_SOFT, behaviour: "tear", hardness: 8, sound: "leaf", debris: 0.6 });
defineMaterial("flowerRose", { ramp: ["#3c1a24", "#662a34", "#94484a", "#b87766"], t: T_SOFT, behaviour: "tear", hardness: 6, sound: "leaf", debris: 0.7 });
defineMaterial("flowerPale", { ramp: ["#46425a", "#747088", "#a8a2b2", "#d2cac8"], t: T_SOFT, behaviour: "tear", hardness: 6, sound: "leaf", debris: 0.7 });
defineMaterial("flowerGold", { ramp: ["#463214", "#735520", "#a88436", "#cfb064"], t: T_SOFT, behaviour: "tear", hardness: 6, sound: "leaf", debris: 0.7 });
defineMaterial("straw", { ramp: ["#3b2c16", "#654e25", "#94773a", "#bca05c"], t: T_SOFT, behaviour: "tear", hardness: 20, sound: "straw", debris: 0.6 });
defineMaterial("burlap", { ramp: ["#2e2420", "#4a3a2e", "#6a5642", "#8a745a"], t: T_SOFT, behaviour: "tear", hardness: 28, sound: "cloth", debris: 0.2 });
defineMaterial("canvas", { ramp: ["#37322f", "#554c45", "#7b7066", "#a29484"], t: T_SOFT, behaviour: "tear", hardness: 30, sound: "cloth", debris: 0.15 });
defineMaterial("clothPale", { ramp: ["#48424f", "#6c6672", "#968f98", "#bdb4b4"], t: T_SOFT, behaviour: "tear", hardness: 30, sound: "cloth", debris: 0.15 });
defineMaterial("clothGold", { ramp: ["#382711", "#5b401b", "#835d29", "#a6803f"], t: T_SOFT, behaviour: "tear", hardness: 30, sound: "cloth", debris: 0.15 });
defineMaterial("clothTeal", { ramp: ["#11252a", "#1d3a3f", "#2c5857", "#477771"], t: T_SOFT, behaviour: "tear", hardness: 30, sound: "cloth", debris: 0.15 });
defineMaterial("leather", { ramp: ["#281512", "#42231b", "#633828", "#855238"], t: [0.14, 0.42, 0.8], behaviour: "tear", hardness: 70, sound: "cloth", debris: 0.1, bounce: 0.2 });
defineMaterial("leatherDark", { ramp: ["#1a1014", "#2b1a1c", "#402624", "#5a3830"], t: [0.14, 0.42, 0.8], behaviour: "tear", hardness: 70, sound: "cloth", debris: 0.1, bounce: 0.2 });
defineMaterial("rust", { ramp: ["#281512", "#472417", "#6c3e28", "#8f5c3c"], t: T_METAL, behaviour: "dent", hardness: 200, sound: "metal", bounce: 0.3, debris: 0.1 });
defineMaterial("copper", { ramp: ["#2b1a14", "#522e21", "#865032", "#b87a4d"], t: T_METAL, behaviour: "dent", hardness: 220, sound: "metal", glint: true, spec: { colour: "#e6b890", thr: 0.96 }, bounce: 0.35, debris: 0.05 });
defineMaterial("verdigris", { ramp: ["#182a29", "#284641", "#416b64", "#6a9387"], t: T_METAL, behaviour: "dent", hardness: 240, sound: "metal", bounce: 0.3, debris: 0.05 });
defineMaterial("cable", { ramp: ["#0d0d11", "#17171e", "#23232d", "#353542"], t: T_METAL, behaviour: "tear", hardness: 60, sound: "metal", debris: 0.05 });
defineMaterial("lampGlass", { ramp: ["#3e2a18", "#7a5428", "#c49248", "#f0d392"], t: [0.1, 0.35, 0.9], glow: 0.9, glint: true, behaviour: "shatter", hardness: 12, sound: "glass", ink: false, spec: { colour: "#fff0c8", thr: 0.97 }, bounce: 0.3, debris: 0.5 });
defineMaterial("paperLamp", { ramp: ["#4a3a2a", "#86684a", "#c8a676", "#f0dcaa"], t: [0.1, 0.35, 0.9], glow: 0.8, behaviour: "tear", hardness: 18, sound: "cloth", debris: 0.3 });
defineMaterial("neonRose", { ramp: ["#3a0e1c", "#86203a", "#d64c62", "#ffc2c2"], emissive: true, ink: false, behaviour: "none", hardness: 999, sound: "glass" });
defineMaterial("neonTeal", { ramp: ["#0a2a2a", "#156660", "#3cb8aa", "#c4f6e8"], emissive: true, ink: false, behaviour: "none", hardness: 999, sound: "glass" });
defineMaterial("neonTube", { ramp: ["#1c1a22", "#2c2a34", "#3e3c48", "#57555f"], t: T_METAL, glint: true, behaviour: "none", hardness: 999, sound: "glass" });
defineMaterial("bone", { ramp: ["#4a4238", "#716656", "#a09480", "#c8bca4"], t: T_STONE, behaviour: "crumble", hardness: 120, sound: "stone", debris: 0.3 });
defineMaterial("puddleDay", { ramp: ["#141f2a", "#243848", "#3e5e70", "#8cb4bc"], t: [0.1, 0.4, 0.86], glint: true, ink: false, behaviour: "splash", hardness: 999, sound: "water", spec: { colour: "#d8eef0", thr: 0.95 } });
defineMaterial("puddleDusk", { ramp: ["#221824", "#40283a", "#7a4a50", "#e0a07a"], t: [0.1, 0.4, 0.86], glint: true, ink: false, behaviour: "splash", hardness: 999, sound: "water", spec: { colour: "#ffe0b8", thr: 0.95 } });
defineMaterial("puddleStorm", { ramp: ["#0c0f18", "#161c2a", "#27324a", "#5a6c8c"], t: [0.1, 0.4, 0.86], glint: true, ink: false, behaviour: "splash", hardness: 999, sound: "water", spec: { colour: "#b8c8e8", thr: 0.95 } });
defineMaterial("moth", { ramp: ["#6e6660", "#9a9088", "#c8beb2", "#e8dfd2"], emissive: true, ink: false, behaviour: "none", hardness: 1, sound: "leaf" });

defineMaterial("soot", { ramp: ["#0c0b10", "#141219", "#1c1a22", "#25222c"], t: [0.14, 0.42, 0.8], behaviour: "crumble", hardness: 40, sound: "stone", ink: false });

// Rosace's own materials, straight from art/rosace/palette.json (scale gauge).
if (ROSACE) {
  const c = ROSACE.colors;
  for (const [name, m] of Object.entries(ROSACE.materials)) {
    const ramp = m.ramp.map((k) => c[k] ?? "#ff00ff") as [Hex, Hex, Hex, Hex];
    const t = [m.t[1] ?? 0.14, m.t[2] ?? 0.42, m.t[3] ?? 0.72] as [number, number, number];
    defineMaterial(`rosace.${name}`, {
      ramp,
      t,
      line: c[m.line] ?? INK,
      selout: c[m.selout] ?? ramp[0],
      inner: c[m.inner] ?? ramp[0],
      spec: m.spec?.thr !== undefined ? { colour: c[m.spec.code] ?? ramp[3], thr: m.spec.thr } : undefined,
      behaviour: "none",
      hardness: 999,
      sound: "cloth",
    });
  }
}

// ---------------------------------------------------------------------------
// A 3x5 pixel font for engraving (plaques, signs, labels on props).
// ---------------------------------------------------------------------------
const GLYPHS: Record<string, string> = {
  A: "010101111101101", B: "110101110101110", C: "011100100100011", D: "110101101101110",
  E: "111100110100111", F: "111100110100100", G: "011100101101011", H: "101101111101101",
  I: "111010010010111", J: "001001001101010", K: "101101110101101", L: "100100100100111",
  M: "101111111101101", N: "110101101101101", O: "010101101101010", P: "110101110100100",
  Q: "010101101110011", R: "110101110101101", S: "011100010001110", T: "111010010010010",
  U: "101101101101111", V: "101101101101010", W: "101101111111101", X: "101101010101101",
  Y: "101101010010010", Z: "111001010100111",
  "0": "010101101101010", "1": "010110010010111", "2": "110001010100111", "3": "110001010001110",
  "4": "101101111001001", "5": "111100110001110", "6": "011100110101010", "7": "111001010010010",
  "8": "010101010101010", "9": "010101011001110",
  ".": "000000000000010", "-": "000000111000000", "'": "010010000000000", " ": "000000000000000",
  ":": "000010000010000", "/": "001001010100100", "+": "000010111010000",
};

/** Pixels of `text` in the 3x5 font: [x, y] pairs, 4 px advance. */
export function textPixels(text: string): { pts: [number, number][]; w: number } {
  const pts: [number, number][] = [];
  let x = 0;
  for (const ch of text.toUpperCase()) {
    const g = GLYPHS[ch] ?? GLYPHS[" "]!;
    for (let i = 0; i < 15; i++) if (g[i] === "1") pts.push([x + (i % 3), Math.floor(i / 3)]);
    x += 4;
  }
  return { pts, w: Math.max(0, x - 1) };
}

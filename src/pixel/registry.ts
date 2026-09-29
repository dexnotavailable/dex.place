// Every recipe, found automatically. The shared kit lives in
// src/pixel/props/*.ts (the engine lane's); each region lane puts its own
// recipes in src/pixel/props/<region>/*.ts (ringwater, plain, hollow, spire,
// chapel). Any exported value that is a recipe (made with defineRecipe) is
// registered by its id, so a region lane adds a file and never edits a shared
// list. Materials a region file defines at module level (defineMaterial) load
// with it.
//
// Lookup is forgiving about spelling: "map-banner", "mapBanner" and
// "map_banner" all find the same recipe, so room data can keep kebab-case ids.
//
// This module is its own entry point (it is not re-exported from index.ts),
// so recipe files can import from "../index.ts" or "../../index.ts" without
// an import cycle.

import { BREAKAGE, type Recipe } from "./prop.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyRecipe = Recipe<any, any>;

export interface RecipeEntry {
  recipe: AnyRecipe;
  /** "kit" for src/pixel/props/*.ts, else the region folder name. */
  region: string;
  /** Source file, relative to src/pixel/props/. */
  file: string;
  /** The export name. */
  name: string;
}

const modules = import.meta.glob<Record<string, unknown>>(["./props/*.ts", "!./props/index.ts", "./props/*/**/*.ts"], { eager: true });

function isRecipe(v: unknown): v is AnyRecipe {
  if (!v || typeof v !== "object") return false;
  const r = v as Partial<AnyRecipe>;
  return typeof r.id === "string" && typeof r.reason === "string" && typeof r.build === "function" && !!r.states && typeof r.states === "object";
}

/** Normalised lookup key: lower case, letters and digits only. */
export function recipeKey(id: string): string {
  return id.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const byId = new Map<string, RecipeEntry>();
const byKey = new Map<string, RecipeEntry>();
/** Problems found while registering (duplicate ids, missing breakage). Empty when all is well. */
export const REGISTRY_ERRORS: string[] = [];

for (const [path, mod] of Object.entries(modules).sort(([a], [b]) => a.localeCompare(b))) {
  const rel = path.replace(/^\.\/props\//, "");
  const region = rel.includes("/") ? rel.split("/")[0]! : "kit";
  for (const [name, v] of Object.entries(mod)) {
    if (!isRecipe(v)) continue;
    const prev = byId.get(v.id);
    if (prev) {
      if (prev.recipe !== v) REGISTRY_ERRORS.push(`duplicate recipe id "${v.id}" in ${rel} (already in ${prev.file}); the first one wins`);
      continue;
    }
    const key = recipeKey(v.id);
    const clash = byKey.get(key);
    if (clash) {
      REGISTRY_ERRORS.push(`recipe id "${v.id}" in ${rel} looks the same as "${clash.recipe.id}" in ${clash.file}; ids must differ by more than case and dashes`);
      continue;
    }
    if (!BREAKAGE.includes(v.breakage)) REGISTRY_ERRORS.push(`recipe "${v.id}" in ${rel} has no breakage class`);
    const e: RecipeEntry = { recipe: v, region, file: rel, name };
    byId.set(v.id, e);
    byKey.set(key, e);
  }
}
for (const e of REGISTRY_ERRORS) console.warn(`pixel registry: ${e}`);

/** Every registered recipe, kit first, then regions in folder order. */
export function allRecipes(): RecipeEntry[] {
  const list = [...byId.values()];
  return list.sort((a, b) => (a.region === "kit" ? -1 : 0) - (b.region === "kit" ? -1 : 0) || a.region.localeCompare(b.region) || a.file.localeCompare(b.file) || a.recipe.id.localeCompare(b.recipe.id));
}

/** A recipe by id (any spelling: "map-banner", "mapBanner"), or undefined. */
export function findRecipe(id: string): AnyRecipe | undefined {
  return (byId.get(id) ?? byKey.get(recipeKey(id)))?.recipe;
}

/** Like findRecipe, but throws a clear error naming the close matches. */
export function recipe(id: string): AnyRecipe {
  const r = findRecipe(id);
  if (r) return r;
  const k = recipeKey(id);
  const near = [...byKey.keys()].filter((q) => q.includes(k.slice(0, 4)) || k.includes(q.slice(0, 4))).slice(0, 5);
  throw new Error(`pixel: no recipe "${id}"${near.length ? ` (did you mean ${near.map((q) => byKey.get(q)!.recipe.id).join(", ")}?)` : ""}`);
}

/** Recipes grouped by region ("kit", "ringwater", ...). */
export function recipesByRegion(): Map<string, RecipeEntry[]> {
  const out = new Map<string, RecipeEntry[]>();
  for (const e of allRecipes()) {
    const l = out.get(e.region) ?? [];
    l.push(e);
    out.set(e.region, l);
  }
  return out;
}

/** Every sound cue a recipe can emit: state `sound` cues plus its declared `cues` (for the sound lane). */
export function soundCues(r: AnyRecipe): string[] {
  const set = new Set<string>(r.cues ?? []);
  for (const s of Object.values(r.states) as { sound?: string }[]) if (s.sound) set.add(s.sound);
  return [...set].sort();
}

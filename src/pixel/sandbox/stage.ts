// Sandbox stages for the kit: `?prop=<id>` puts one registered recipe (and its
// variants) on a 16 H stage beside the H gauge; `?kit` lines every recipe up
// in one long room at game size, kit first, then each region's folder. Both
// come from the registry, so a region lane's new recipe shows up here with no
// edit to the sandbox.

import type { Backdrop, Lighting } from "../render.ts";
import { floor, gauge, wall } from "../props/index.ts";
import type { Prop } from "../prop.ts";
import { allRecipes, findRecipe, type RecipeEntry } from "../registry.ts";
import { PixelWorld } from "../world.ts";

export interface StageSlot {
  entry: RecipeEntry;
  prop: Prop;
  /** Stage centre x (world px) and width (px). */
  x: number;
  w: number;
  variants: { label: string; prop: Prop }[];
}

export interface StageRoom {
  world: PixelWorld;
  H: number;
  floorY: number;
  fig: Prop;
  byName: Map<string, Prop>;
  slots: StageSlot[];
  lighting: Partial<Lighting>;
  backdrop: Backdrop;
  kind: "prop" | "kit";
}

/** Recipes the stages leave out: the sandbox room's own wall and the gauge. */
const HIDDEN = new Set(["gauge", "wall"]);

export const SKY: Backdrop = { top: [0.09, 0.13, 0.17], mid: [0.2, 0.25, 0.28], low: [0.34, 0.35, 0.36], bands: 7, horizon: 560 };
export const DUSK_WALL: Backdrop = { top: [0.02, 0.018, 0.035], mid: [0.05, 0.045, 0.075], low: [0.08, 0.07, 0.1], bands: 6, horizon: 720 };
export const OUTDOOR_LIGHT: Partial<Lighting> = {};
export const CHAPEL_LIGHT: Partial<Lighting> = { ambient: [0.17, 0.16, 0.24], keyColour: [0.42, 0.4, 0.39] };

export function stageEntries(ids: string[] | null): RecipeEntry[] {
  const all = allRecipes().filter((e) => !HIDDEN.has(e.recipe.id));
  if (!ids) return all;
  const out: RecipeEntry[] = [];
  for (const id of ids) {
    const r = findRecipe(id);
    const e = r && all.find((q) => q.recipe === r);
    if (e) out.push(e);
  }
  return out;
}

/**
 * Build a stage. `ids` null: every recipe (the lineup). One id: its stage,
 * 16 H wide, with its variants. `indoor` puts the chapel wall behind (the
 * proof room's light); otherwise an open sky and the lab's light.
 */
export function buildStage(H: number, ids: string[] | null, save: PixelWorld["saveData"], o: { indoor?: boolean; nave?: boolean; reduced?: boolean } = {}): StageRoom {
  const entries = stageEntries(ids);
  const kind: StageRoom["kind"] = ids && ids.length === 1 ? "prop" : "kit";
  // a single prop stages indoors when its demo asks (doors, candles, lanterns); ?indoor forces it
  const indoor = o.indoor || (kind === "prop" && !!entries[0]?.recipe.demo?.indoor);
  const widths = entries.map((e) => Math.max(kind === "prop" ? 16 : 3, (e.recipe.demo?.w ?? 4)) * H);
  const lead = kind === "prop" ? 0 : 2 * H;
  const W = Math.max(16 * H, lead * 2 + widths.reduce((a, b) => a + b, 0));
  const Hh = 9 * H;
  const world = new PixelWorld({ H, width: W, height: Hh, seed: 7, heal: { delay: 4.5, rate: 60 } });
  world.saveData = save;
  if (o.nave) world.breakage = "sway";
  if (o.reduced) world.reduced = true;
  const floorY = Math.round(7.55 * H);
  const byName = new Map<string, Prop>();
  if (indoor) world.add(wall, { width: W, height: floorY / H - 0.05, columns: kind === "prop" ? [0.02, 0.98] : [], openings: [] }, 0, floorY, { id: "wall" });
  byName.set("floor", world.add(floor, { width: W, depth: (Hh - floorY) / H + 0.2 }, 0, floorY, { id: "floor" }));
  const slots: StageSlot[] = [];
  let x = lead;
  entries.forEach((e, k) => {
    const w = widths[k]!;
    const cx = Math.round(x + w / 2);
    const d = e.recipe.demo ?? {};
    const at = Math.round((d.at ?? 0) * H);
    // the stage already stands on the floor recipe: its slot shows that floor (and is hit there)
    const prop = e.recipe.id === "floor" ? byName.get("floor")! : world.add(e.recipe, { seed: 3 + k, ...(d.params ?? {}) }, cx, floorY - at, { id: e.recipe.id });
    byName.set(e.recipe.id, prop);
    const variants: StageSlot["variants"] = [];
    for (const v of d.variants ?? []) {
      const vat = Math.round((v.at ?? d.at ?? 0) * H);
      const vp = world.add(e.recipe, { seed: 5 + k, ...(d.params ?? {}), ...v.params }, Math.round(cx + v.dx * H), floorY - vat, { id: `${e.recipe.id}:${v.label}` });
      variants.push({ label: v.label, prop: vp });
      byName.set(`${e.recipe.id}: ${v.label}`, vp);
    }
    for (const wth of d.with ?? []) {
      const r = findRecipe(wth.id);
      if (!r) continue;
      const wat = Math.round((wth.at ?? 0) * H);
      const wp = world.add(r, { seed: 9 + k, ...(wth.params ?? {}) }, Math.round(cx + wth.dx * H), floorY - wat, { id: `with:${e.recipe.id}:${wth.id}` });
      byName.set(`with:${wth.id}`, wp);
    }
    slots.push({ entry: e, prop, x: cx, w, variants });
    x += w;
  });
  const first = slots[0];
  const fig = world.add(gauge, {}, first ? Math.round(first.x - 0.9 * H) : Math.round(8 * H), floorY, { id: "gauge" });
  byName.set("H gauge", fig);
  return {
    world, H, floorY, fig, byName, slots, kind,
    lighting: indoor ? CHAPEL_LIGHT : OUTDOOR_LIGHT,
    backdrop: indoor ? DUSK_WALL : SKY,
  };
}

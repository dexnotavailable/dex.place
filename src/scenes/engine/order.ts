// Draw order fixes the engine applies to a scene's layer list after build().
//
// The engine draws layers in list order and never sorts, so a scene author decides depth order by
// where a layer is pushed. Bird layers are the one thing that is easy to put in the wrong place:
// they are pushed wherever the code happens to be (often last, after the near cliffs, the dock and
// the figure's rocks), so a bird 12 units away flew OVER a cliff 2 units away. placeFlocks() gives
// every Flock layer the slot its depth says and tells the flock its depth (sprite size follows it).
//
// A flock goes behind every opaque layer nearer than it and in front of every layer farther than it:
//   - scan the list from the back of the picture; the slot is just after the last layer that is
//     farther (or as far) before the first opaque layer that is nearer;
//   - ground planes (the water, the plain, the flats, a floor) are drawn first by design and
//     extend out to the horizon at every depth; they do not count as "nearer".
// The audit that checks this for every scene: src/world/tools/layer-audit.mjs.

import type { LayerDef } from "./types.ts";

/** Layers that are a ground plane drawn first whatever their nominal depth. */
const GROUND_PLANE = /(^|-)(water|lake|sea|plain|flats|floor|ground)$/;

function opaque(l: LayerDef): boolean {
  return l.blend !== "add" && (l.kind === "pix" || l.kind === "glsl");
}

interface Flocky {
  isFlock: true;
  depth: number;
}

function isFlock(l: LayerDef): boolean {
  return l.kind === "points" && (l.system as unknown as Partial<Flocky>).isFlock === true;
}

/** Where a layer of depth `d` belongs in `list` (index to insert at), ignoring `list`'s own flock layers. */
export function slotFor(list: readonly LayerDef[], d: number): number {
  let slot = 0;
  for (let i = 0; i < list.length; i++) {
    const l = list[i]!;
    if (!opaque(l) || GROUND_PLANE.test(l.name)) continue;
    if (l.depth >= d) slot = i + 1;
    else break;
  }
  return slot;
}

/** Puts every bird layer at its depth's place in the draw order and tells it its depth. */
export function placeFlocks(layers: LayerDef[]): LayerDef[] {
  if (!layers.some(isFlock)) return layers;
  const rest = layers.filter((l) => !isFlock(l));
  const flocks = layers.filter(isFlock);
  // nearest last so two flocks keep the far one behind
  flocks.sort((a, b) => b.depth - a.depth);
  for (const fl of flocks) {
    if (fl.kind === "points") (fl.system as unknown as Flocky).depth = fl.depth;
    rest.splice(slotFor(rest, fl.depth), 0, fl);
  }
  return rest;
}

/** Moves the layers called `names` (in the order given) to sit right after the layer called `after`. No-op when any is missing. */
export function moveAfter(layers: LayerDef[], names: string | string[], after: string): LayerDef[] {
  const list = Array.isArray(names) ? names : [names];
  const moving = list.map((n) => layers.find((l) => l.name === n));
  if (moving.some((m) => !m) || !layers.some((l) => l.name === after)) return layers;
  const rest = layers.filter((l) => !moving.includes(l));
  rest.splice(rest.findIndex((l) => l.name === after) + 1, 0, ...(moving as LayerDef[]));
  layers.splice(0, layers.length, ...rest);
  return layers;
}

/** Moves the layers called `names` to sit right before the layer called `before`. */
export function moveBefore(layers: LayerDef[], names: string | string[], before: string): LayerDef[] {
  const list = Array.isArray(names) ? names : [names];
  const moving = list.map((n) => layers.find((l) => l.name === n));
  if (moving.some((m) => !m) || !layers.some((l) => l.name === before)) return layers;
  const rest = layers.filter((l) => !moving.includes(l));
  rest.splice(rest.findIndex((l) => l.name === before), 0, ...(moving as LayerDef[]));
  layers.splice(0, layers.length, ...rest);
  return layers;
}

/** Re-seats the layer called `name` where its depth puts it (see slotFor): behind everything nearer that is opaque. */
export function placeByDepth(layers: LayerDef[], name: string): LayerDef[] {
  const l = layers.find((x) => x.name === name);
  if (!l) return layers;
  const rest = layers.filter((x) => x !== l);
  rest.splice(slotFor(rest, l.depth), 0, l);
  layers.splice(0, layers.length, ...rest);
  return layers;
}

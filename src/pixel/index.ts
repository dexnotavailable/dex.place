// Pixel matter engine: public surface. See docs/props/ENGINE.md.

export { SCALE, hu, presentFit, physics, type PresentFit, type PresentMode } from "./scale.ts";
export { defineMaterial, mat, matById, allMaterials, INK, textPixels, type Material, type MaterialSpec, type Behaviour } from "./materials.ts";
export { CellGrid, F_NOINK, F_CRACK, F_SCORCH, F_FRESH, F_HOT, F_ADDED, F_NOHIT, PAD } from "./cells.ts";
export { PartBuilder, type ShapeOpts, type Profile } from "./builder.ts";
export { Part, LAYERS, LAYER_PARALLAX, type LayerName, type Collide, type PartOptions } from "./part.ts";
export { Prop, PropBuilder, defineRecipe, type Recipe, type StateDef, type BaseParams, type HitContext, type PropLight, type PropGlow, type PartSpec } from "./prop.ts";
export { PixelWorld, type PointLight, type Glow, type WorldEvent, type Collider, type WorldOptions } from "./world.ts";
export { PixelRenderer, LAB_LIGHTING, scale2x2, type Lighting, type ViewMode, type Backdrop, type RenderOptions } from "./render.ts";
export { coverage, hitBounds, presetHit, cutPath, hitCentre, type Hit, type HitShape, type HitType } from "./hits.ts";
export { overlap, damage, fracture, crater, scar, shatterPiece, spreadCracks, surfaceAt, cutAlong, type PartReport, type Overlap } from "./break.ts";
export { Chunk, Particles, P_ADD, P_GRAV, P_SETTLE, P_FADE, P_DRAG, P_RISE, P_HOME } from "./bodies.ts";
export { dissolve, assemble, disintegrate, glint, Ripples } from "./fx.ts";
export { Spring, Pendulum, Tweens, Rope, Cloth, sway, flicker, bob, invBilinear, type RopeSpec, type ClothSpec } from "./motion.ts";
export { rng, hash2, vnoise, fbm, bayer, EASE, type Ease } from "./util.ts";

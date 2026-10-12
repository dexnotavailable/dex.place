// What each env-sky asset is and how it behaves. Plain data for the world builder (and
// any tool): the painter kind, the planes it belongs on, its density rule, animation,
// reflection, transparency and glow. Placement, scale in the frame and composition stay
// the builder's; `use` says how the asset is meant to be placed.

export interface SkyAsset {
  id: string;
  /** Painter kind to place (piece or sprite). */
  kind: string;
  /** "piece" (a static plate) or "sprite" (moves or animates). */
  as: "piece" | "sprite";
  planes: ("sky" | "far" | "mid" | "back" | "play" | "front" | "near")[];
  /** Density: always 1 art px = 1 frame px at play zoom on its own plane; notes on levels. */
  density: string;
  animation: string;
  reflect: string;
  transparency: string;
  glow: string;
  /** How to place it (sizes in level-1 px of its plane). */
  use: string;
}

export const SKY_MANIFEST: SkyAsset[] = [
  {
    id: "karst-far",
    kind: "sky.karst",
    as: "piece",
    planes: ["far"],
    density: "Own plane density. Silhouettes and two tones at every level; no streaks below level 0.25.",
    animation: "None in the plate (far planes do not move). Pair with drifting sky.wisp sprites and the shader's mist bands.",
    reflect: "Yes (default). The far shore's waterline mirrors the rows and their mist banks.",
    transparency: "None. Its mist banks are opaque cloud-white with a two-step dithered top.",
    glow: "None.",
    use: "{ look: 'far', rows: 2 or 3, w: 900-1400, h: 220-320, mist: h*0.2 } standing on the far shore line, replacing the snow 'range' pieces. Overlap neighbours by about a fifth.",
  },
  {
    id: "karst-mid",
    kind: "sky.karst",
    as: "piece",
    planes: ["mid", "far"],
    density: "Own plane density. Streaks from level 0.25, bedding and cracks from 0.5.",
    animation: "None in the plate. Thin falls are static at this distance.",
    reflect: "Yes (default).",
    transparency: "None (mist bank as above).",
    glow: "None.",
    use: "{ look: 'mid' or 'near', rows: 1, towers: [[x, w, h], ...] } in the builder's existing tower slots (same list the 'towers' painter takes), or generated with w and h.",
  },
  {
    id: "cloud-bank",
    kind: "sky.bank",
    as: "sprite",
    planes: ["sky"],
    density: "Sky plane density (scale barely changes with zoom: one level in practice).",
    animation: "Drift: 1.5-3 plane px/s to the right (east wind), wrapping, never reversing. Frames 0-3 at 2 fps: rim dither and crown lobes churn.",
    reflect: "Yes: the lake doubles the sky.",
    transparency: "Dithered rim (50%) on the silhouette; body opaque.",
    glow: "None. Lit tops use the paper ramp's warm cream in the morning key.",
    use: "{ w: 380-700, h: 56-110 }, a big shape in P0 for outdoors grand (A.1); one or two per frame, upper third of the sky.",
  },
  {
    id: "cloud-stratus",
    kind: "sky.stratus",
    as: "sprite",
    planes: ["sky"],
    density: "Sky plane density.",
    animation: "Drift: 2-4 plane px/s, faster than banks (higher wind). Frames 0-3 at 2 fps: the end streaks flicker between rows.",
    reflect: "Yes.",
    transparency: "Ends break into alternate-row streaks, then a dither fade.",
    glow: "None.",
    use: "{ w: 300-900, h: 5-12, layers: 1-3 }, low over the far ranges and near the horizon: the layered-mist look between sky and karst.",
  },
  {
    id: "mist-wisp",
    kind: "sky.wisp",
    as: "sprite",
    planes: ["far", "mid", "back"],
    density: "Plane density of whichever plane it is placed on.",
    animation: "Drift 3-8 plane px/s, wrapping; frames 0-3 at 3 fps roll the inner texture.",
    reflect: "Yes when over water (it lies on the lake), otherwise off.",
    transparency: "Ordered dither from the density profile (sparse at the edges, solid in the core).",
    glow: "None.",
    use: "{ w: 200-600, h: 10-30, density: 0.5-0.8 } lying just above a row's mist bank or a waterline; two or three per plane in a frame.",
  },
  {
    id: "water-ripple",
    kind: "sky.ripple",
    as: "sprite",
    planes: ["front"],
    density: "Play plane density (the lake at the play plane's depth); ring lines are always 1 art px.",
    animation: "Authored frames: an 8-frame cycle at 8 fps (frame param 0-7), three rings opening and fading in turn.",
    reflect: "No: it is on the surface, not above it.",
    transparency: "Rings fade by ordered dither as they open; small gaps break each ring.",
    glow: "None. The near half takes the sky's light (cloud white early, pale jade as it fades), the far half dark jade.",
    use: "{ rx: 16-40, flat: 0.16, rings: 3 } as a sprite with frames 8 at 8 fps on the 'front' plane at the lake's y, centred on a mooring post, a jetty leg or a wading foot.",
  },
];

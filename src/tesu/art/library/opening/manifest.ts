// What each env-opening asset is and how it behaves: plane, animation, reflection,
// transparency, glow and (for props) states. Plain data for the world builder and any tool.
// Placement follows the builder's layout; the opening's section files place these pieces.

export interface OpeningAsset {
  kind: string;
  as: "piece" | "sprite" | "prop";
  planes: ("sky" | "far" | "mid" | "back" | "play" | "front" | "near")[];
  animation: string;
  reflect: string;
  transparency: string;
  glow: string;
  states?: string;
}

export const OPENING_MANIFEST: OpeningAsset[] = [
  { kind: "op.rock", as: "piece", planes: ["play"], animation: "None.", reflect: "Yes where above the lake (Kagami's plateau rim).", transparency: "Its foot dissolves into the valley mist by ordered dither (fadeY, fadeH).", glow: "None." },
  { kind: "op.wall", as: "piece", planes: ["back"], animation: "Static face; its threads flow as op.falls sprites.", reflect: "No (not over water).", transparency: "Foot dissolves into the valley mist by dither; threads fray into dithered spray.", glow: "None." },
  { kind: "op.falls", as: "sprite", planes: ["back"], animation: "4 frames at 12 fps, a seamless downward loop of foam dashes per thread.", reflect: "No.", transparency: "Dithered fraying lower down.", glow: "None." },
  { kind: "op.spring", as: "piece", planes: ["play"], animation: "Static mouth and fall; fallOnly sprite flows at 12 fps over 4 frames.", reflect: "No.", transparency: "Spray column dithered into the mist.", glow: "None." },
  { kind: "op.karst", as: "piece", planes: ["far", "mid"], animation: "None in the plate; wisps (sky.wisp) and the shader's mist bands drift over it.", reflect: "Yes: each plane mirrors about its own waterline.", transparency: "Mist bank at each row's foot: 50/25/12% dissolve above, solid below.", glow: "None." },
  { kind: "op.sea", as: "piece", planes: ["mid", "back"], animation: "None (the shader's mist bands move over it).", reflect: "Off where it stands behind the shore.", transparency: "Dithered dissolve above its swells.", glow: "None." },
  { kind: "op.islet", as: "piece", planes: ["back"], animation: "None.", reflect: "Yes: islets, pines, the small torii double in the lake.", transparency: "None.", glow: "None." },
  { kind: "op.bank", as: "piece", planes: ["near"], animation: "Static; its reed beds are op.reeds sprites.", reflect: "No (the surface ends at its waterline).", transparency: "None.", glow: "None." },
  { kind: "op.reeds", as: "sprite", planes: ["near", "back"], animation: "4 frames at 6 fps; a gust runs through the bed (phase by x), tips move most, cattails lag their stems.", reflect: "No on the near bank.", transparency: "None.", glow: "None." },
  { kind: "op.jetty", as: "piece", planes: ["play"], animation: "None (Kagami is mirror-still).", reflect: "Yes: deck, piles, braces and algae double in the lake.", transparency: "None.", glow: "None." },
  { kind: "op.post", as: "piece", planes: ["play"], animation: "None; a ripple ring (sky.ripple, 8 fps) opens at its foot.", reflect: "Yes.", transparency: "None.", glow: "None." },
  { kind: "op.plank", as: "piece", planes: ["play"], animation: "None.", reflect: "No.", transparency: "None.", glow: "None." },
  { kind: "op.boat", as: "piece", planes: ["play"], animation: "Painter supports an 8-frame bob (frame 0..7); placed still on Kagami.", reflect: "Yes.", transparency: "None.", glow: "None." },
  { kind: "op.coil", as: "piece", planes: ["play"], animation: "None.", reflect: "Yes.", transparency: "None.", glow: "None." },
  { kind: "op.bucket", as: "prop", planes: ["play"], animation: "None.", reflect: "Yes.", transparency: "None.", glow: "None.", states: "Cosmetic: breaks into its own pixels (builder's chunk painter), back when she leaves." },
  { kind: "op.barrel", as: "prop", planes: ["play"], animation: "None.", reflect: "No (on the terrace).", transparency: "None.", glow: "None.", states: "Cosmetic: breaks and resets; the ladle falls with it (support rule)." },
  { kind: "op.bench", as: "piece", planes: ["play"], animation: "None.", reflect: "No.", transparency: "None.", glow: "None." },
  { kind: "op.rail", as: "piece", planes: ["front"], animation: "None.", reflect: "No.", transparency: "None.", glow: "None." },
  { kind: "op.gate", as: "piece", planes: ["play", "front"], animation: "None.", reflect: "No (above the valley).", transparency: "None.", glow: "None." },
  { kind: "op.terrace", as: "piece", planes: ["play"], animation: "None.", reflect: "No.", transparency: "The drain's thread dithers out below.", glow: "None." },
  { kind: "op.pine", as: "piece", planes: ["play"], animation: "None (heavy pads; a sway would read as rubber).", reflect: "No.", transparency: "None.", glow: "None." },
  { kind: "op.bamboo", as: "sprite", planes: ["play"], animation: "4 frames at 4 fps; culms bend from the foot, leaf sprays follow.", reflect: "No.", transparency: "None.", glow: "None." },
  { kind: "op.flags", as: "sprite", planes: ["play"], animation: "4 frames at 6 fps; flags lift and swing, each one later than the last.", reflect: "No.", transparency: "None.", glow: "None." },
  { kind: "op.palace", as: "piece", planes: ["play"], animation: "None.", reflect: "No.", transparency: "None.", glow: "Warm paper behind the lattice and light through the doors' gap, as palette steps (paper, gold); additive glow waits for request S7." },
  { kind: "op.tower", as: "piece", planes: ["play"], animation: "None.", reflect: "No.", transparency: "None.", glow: "Lantern niche and round window as warm palette steps." },
  { kind: "op.stay", as: "piece", planes: ["play"], animation: "None.", reflect: "No.", transparency: "None.", glow: "None." },
  { kind: "op.banners", as: "sprite", planes: ["play"], animation: "4 frames at 6 fps; hems swing, tops stay on the rope.", reflect: "No.", transparency: "None.", glow: "None." },
  { kind: "op.cloud", as: "sprite", planes: ["sky"], animation: "Drift east 1.2 to 4 plane px/s, wrapping; 4 churn frames (cumulus at 1 fps, stratus at 2).", reflect: "Yes: the lake doubles the sky.", transparency: "Dithered shadow-side rims, frayed stratus ends.", glow: "None; the sun-grazed rim uses paper[0]." },
  { kind: "op.isle", as: "sprite", planes: ["sky"], animation: "8 frames at 0.8 to 1 fps: a whole-pixel rise and settle.", reflect: "Yes.", transparency: "Its thread of water dithers into a scrap of cloud.", glow: "Warm windows as gold steps." },
];

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
  { kind: "op.wall", as: "piece", planes: ["back"], animation: "Static face; its threads flow as op.falls sprites.", reflect: "No (not over water).", transparency: "Foot dissolves into the valley mist by dither; veils of threads over a sheet of falling water, broken at ledges, bloom into dithered spray.", glow: "None." },
  { kind: "op.falls", as: "sprite", planes: ["back"], animation: "4 frames at 12 fps, a seamless downward loop of foam dashes per thread.", reflect: "No.", transparency: "Dithered fraying lower down.", glow: "None." },
  { kind: "op.spring", as: "piece", planes: ["play"], animation: "Static mouth and fall; fallOnly sprite flows at 12 fps over 4 frames.", reflect: "No.", transparency: "Spray column dithered into the mist.", glow: "None." },
  { kind: "op.karst", as: "piece", planes: ["far", "mid"], animation: "None in the plate; wisps (sky.wisp) and the shader's mist bands drift over it.", reflect: "Yes: each plane mirrors about its own waterline.", transparency: "Mist at each row's foot: a low core and billows thinning by the three dissolve steps, climbing the feet, torn wisps; on the lake its foot takes the water's tone. Falls on chosen forms are veils blooming into dithered spray.", glow: "None." },
  { kind: "op.sea", as: "piece", planes: ["mid", "back"], animation: "None (the shader's mist bands move over it).", reflect: "Off where it stands behind the shore.", transparency: "The same mist bank as op.karst above its line, a torn west end; below, a floor of billows seen from above, the lake's tone near its line where it lies on water.", glow: "None." },
  { kind: "op.islet", as: "piece", planes: ["back"], animation: "None.", reflect: "Yes: islets, posts, reeds, pines and the small torii double in the lake.", transparency: "None.", glow: "None.", states: "Kinds (Kagami's four islets): piles (a ruined pile field, a fallen beam), reedbed (a reed bed round a stone lantern), crag (a jagged rock with a leaning pine), torii (the small torii's mossy islet, wet-banded posts); without a kind, the older kit (on, at)." },
  { kind: "op.headland", as: "piece", planes: ["back"], animation: "None.", reflect: "Yes: the woods and the shore double in the lake.", transparency: "None (sinks into the shader's haze with the back plane).", glow: "None." },
  { kind: "op.shore", as: "piece", planes: ["play"], animation: "None.", reflect: "Yes (ledges, trunk, thicket).", transparency: "None.", glow: "None." },
  { kind: "op.scree", as: "piece", planes: ["front"], animation: "None.", reflect: "Yes above the waterline (hidden under itself).", transparency: "None.", glow: "None.", states: "Kagami's east end: fallen blocks heaped in the shallows where the lake ends against the lip, spreading toward the camera; it hides the water's end in front of the rock." },
  { kind: "op.bank", as: "piece", planes: ["near"], animation: "Static; its reed stands are op.reeds sprites (bankTopAt, reedBeds).", reflect: "No (the surface ends at its waterline).", transparency: "None.", glow: "None.", states: "Authored masses (reeds, boulder, hummock, lantern, crag, tuft; an end crag's face drops off the bottom), each running off the bottom of the frame; without masses, a shore composed from its seed." },
  { kind: "op.reeds", as: "sprite", planes: ["near", "back"], animation: "4 frames at 6 fps (8 on Kagami's shore); a gust runs through the bed (phase by its place on the shore), tips move most, cattails lag their stems; height and density per bed.", reflect: "No on the near bank.", transparency: "None.", glow: "None." },
  { kind: "op.jetty", as: "piece", planes: ["play"], animation: "None (Kagami is mirror-still).", reflect: "Its plate (piles, braces, the deck seen from below in its shadow) doubles in the lake; its lit face is reflect:false sprites, so the reflection is a darker band.", transparency: "A slit of sky between some shrunk planks.", glow: "None." },
  { kind: "op.post", as: "sprite", planes: ["play"], animation: "None; a ripple ring (sky.ripple, 8 fps) opens at its foot.", reflect: "Yes.", transparency: "None.", glow: "None." },
  { kind: "op.plank", as: "piece", planes: ["play"], animation: "None.", reflect: "No.", transparency: "None.", glow: "None." },
  { kind: "op.boat", as: "piece", planes: ["play"], animation: "Painter supports an 8-frame bob (frame 0..7); placed still on Kagami.", reflect: "Yes.", transparency: "None.", glow: "None." },
  { kind: "op.coil", as: "sprite", planes: ["play"], animation: "None.", reflect: "Yes.", transparency: "None.", glow: "None." },
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
  { kind: "op.cloud", as: "sprite", planes: ["sky"], animation: "Drift east 1.2 to 4 plane px/s, wrapping; 4 churn frames (cumulus at 1 fps, stratus at 2).", reflect: "Yes, except Kagami's big cumulus (its base would rule the lake).", transparency: "Dithered shadow-side rims, frayed stratus ends.", glow: "None; the sun-grazed rim uses paper[0]." },
  { kind: "op.isle", as: "sprite", planes: ["sky"], animation: "8 frames at 0.8 to 1 fps: a whole-pixel rise and settle.", reflect: "No on Kagami (the sky mirrors about the horizon).", transparency: "Its thread of water dithers into a scrap of cloud.", glow: "Warm windows as gold steps." },
  { kind: "op.wade", as: "sprite", planes: ["mid"], animation: "96 frames at 9.6 fps, in lockstep with the Walker (same path, speed, stepMove; 4 frames to each of its 24-frame stride): rings at each footfall over about 1.5 s, splashes, lapping rings, a wake whose crests slide back, mist churning round the legs.", reflect: "Yes: the lake mirrors the rings' far halves, completing them.", transparency: "Mist and spray by ordered dither (three steps).", glow: "None." },
  { kind: "op.spray", as: "piece", planes: ["back"], animation: "None placed (the painter has 4 churn frames).", reflect: "Yes.", transparency: "Plumes thin by the three dissolve steps to single drops; the foot frays.", glow: "None." },
  { kind: "op.station", as: "sprite", planes: ["play"], animation: "None yet (round 2: lantern flicker, pulley turning).", reflect: "Yes.", transparency: "None.", glow: "None by day; the lantern is warm palette steps." },
  { kind: "op.landing", as: "piece", planes: ["play"], animation: "None.", reflect: "Yes where above the lake.", transparency: "None.", glow: "None." },
  { kind: "op.stub", as: "piece", planes: ["back", "front"], animation: "None (its reeds are op.reeds sprites).", reflect: "Yes.", transparency: "None.", glow: "None." },
  { kind: "op.crate", as: "prop", planes: ["play"], animation: "None.", reflect: "Yes.", transparency: "None.", glow: "None.", states: "Cosmetic: breaks into its own pixels, back when she leaves; the jar on it falls with it." },
  { kind: "op.jar", as: "prop", planes: ["play"], animation: "None.", reflect: "Yes.", transparency: "None.", glow: "None.", states: "Cosmetic: breaks into 3 pieces, back when she leaves." },
  { kind: "op.net", as: "sprite", planes: ["play"], animation: "None.", reflect: "Yes.", transparency: "Mesh over the deck's edge is open.", glow: "None." },
  { kind: "op.basket", as: "sprite", planes: ["play"], animation: "None.", reflect: "Yes.", transparency: "None.", glow: "None." },
];

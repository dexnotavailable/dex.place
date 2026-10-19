// The one palette Tesu is painted in. Every plate pixel is an index into this table
// (index 0 is empty), so the whole land shares one set of materials: ink, paper, stone,
// timber, lacquer, gold and a single seal red, plus the land's own greens and jade.
// Background planes fade toward their band's haze in the shader (render/planes.ts), so
// the same ramps serve every depth.
//
// Ramps run light to dark. Painters pick a step for light and dither between steps;
// they never invent colours.

export type Ramp = readonly number[];

const HEX: string[] = ["#000000"];
function ramp(...hex: string[]): Ramp {
  const out: number[] = [];
  for (const h of hex) {
    out.push(HEX.length);
    HEX.push(h);
  }
  return out;
}

/** Named ramps: P.rock[0] is the lightest step. */
export const P = {
  /** The one outline ink: a deep violet black. */
  ink: ramp("#1b1922", "#2a2732"),
  /** Talisman paper, plaster, banners. */
  paper: ramp("#fffaf0", "#f6ecd8", "#e6d8bc", "#cbbb9a", "#a5967a"),
  /** Pale karst limestone: the land's bones. Cool shadows. */
  karst: ramp("#f2f0e8", "#e0e0d6", "#c9cbc2", "#aeb4ad", "#929d97", "#76837f", "#5b6966", "#43504f", "#2f3a3b"),
  /** Moss and grass on the rock, sunny yellow-green to deep shade. */
  moss: ramp("#e6ec9f", "#c8da7c", "#a3c464", "#7da853", "#5a8a46", "#41703e", "#2d5534", "#1e3a29"),
  /** Pine needles: darker and cooler than moss. */
  pine: ramp("#628f66", "#477754", "#315f45", "#234a38", "#18362a", "#10261f"),
  bamboo: ramp("#dbe99d", "#b6d273", "#8bb758", "#649347", "#456f39"),
  blossom: ramp("#fff3f4", "#ffd6de", "#f6adbf", "#e2829c", "#bb5a74"),
  /** Jade water, for painted water bits (the lake itself is a shader). */
  jade: ramp("#dbf2eb", "#b0e2d4", "#83ccbf", "#5ab2a7", "#3f918c", "#2c7072", "#1f5358", "#163c43"),
  /** Weathered timber: jetties, posts, planks. */
  timber: ramp("#ead2a8", "#cfad7c", "#ad885a", "#896741", "#644a2e", "#45321f", "#2d2116"),
  /** Vermilion lacquer: the gates. */
  red: ramp("#ffb38c", "#ff7a55", "#ee4c31", "#ca3220", "#9c2217", "#6c1610"),
  /** Black lacquer: the palace. */
  lacquer: ramp("#5d5a68", "#47444f", "#35323c", "#27242d", "#1b1920"),
  gold: ramp("#fff7c6", "#ffe27c", "#f3bd41", "#d09024", "#9e6116", "#673d0d"),
  /** Glazed roof tiles, grey-blue. */
  tile: ramp("#97a6b8", "#76859a", "#5c687d", "#454f62", "#323948", "#23283a"),
  /** Cut stone: steps, walls, lanterns. Warmer than karst. */
  stone: ramp("#eee8dc", "#d8d0c0", "#bbb3a3", "#9c9587", "#7d776b", "#5f5a51", "#45413b"),
  /** Packed earth paths. */
  earth: ramp("#e3cca3", "#cbae80", "#ac8e63", "#896e4c", "#665139", "#463828"),
  /** Far snow on the ranges. */
  snow: ramp("#ffffff", "#eef5f7", "#d8e4ea", "#bccbd5"),
  /** Prayer-flag and banner blue. */
  blue: ramp("#a6cbe9", "#6b9fd2", "#4277ad", "#2b5383", "#1c3858"),
  /** Small flower accents, violet. */
  violet: ramp("#d3c1f2", "#a68ddb", "#7a62b2", "#54438a"),
  /** Mist and cloud whites (opaque; for painted cloud banks on far planes). */
  cloud: ramp("#ffffff", "#f3f7f8", "#e3ecef", "#cfdde3", "#b9cbd4"),
  /** Far-range rock: blue-grey, already part-way into the haze. */
  range: ramp("#e4ecef", "#cfdbe1", "#b7c8d1", "#9fb3bf", "#8aa0ae", "#768e9d", "#62798a"),
  /** Skin for small far figures and NPC stand-ins. */
  skin: ramp("#ffe0cc", "#f4bea2", "#d9947c", "#a9645a"),
  // --- appended by env-hall (indices of everything above are unchanged) ---
  /** Lantern-lit paper and warm glow: the hot core to the ember edge (the hall, dusk, night). */
  ember: ramp("#fff4d6", "#ffe0a3", "#f8bd6c", "#e08c46", "#b5602f"),
  /** Warm interior shadow: timber and lacquer in lamplight, the hall's dark. */
  umber: ramp("#7a5a48", "#5e4335", "#47322a", "#352520", "#261a18", "#191213"),
  /** Bronze: the gong, door fittings, censers. */
  bronze: ramp("#f7e2a6", "#d8b067", "#ad8443", "#7e5d2e", "#523d22", "#2f2318"),
  // --- appended by the Kagami sky lane, round 4 (indices of everything above are unchanged) ---
  /**
   * Sunlit cumulus (Dex's painterly cloud reference): the warm cream where the morning sun
   * strikes a billow's top, a peach lit face, a warm white where it turns from the sun, then
   * neutral cool greys into the shade and the flat cool grey base (values fall step by step; the
   * hue turns from warm to a near-neutral cool, never violet; round 5; round 6: the shade a touch
   * bluer, the sky's own cool, so a lost edge melts into it). Its last two steps are
   * the warm bounce from the land and lake in the lowest billows' shade.
   */
  cumulus: ramp("#fff7ea", "#fde8d6", "#efe7e2", "#dde0e4", "#c9d0d8", "#b4bdc9", "#a0aab8", "#8c97a7", "#c6c2c4", "#b3afb3"),
  // --- appended by the hall's scene loop (W), round 1 (indices of everything above are unchanged) ---
  /**
   * Blue-violet night shadow: the cool mass round a warm opening (Dex's ref 06, the Liyue gate at
   * night). The hall's shell (ceiling, upper walls, end walls) and the court's deepest shade.
   */
  dusk: ramp("#5e5a7e", "#4a4a6c", "#3a3b58", "#2d2e46", "#222336", "#191a28", "#121219"),
  /** Violet-brown dusk timber: where the warm interior turns into the cool shadow (ref 06's walls). */
  mauve: ramp("#6e5560", "#5e4952", "#473a4a", "#352b38", "#261f2a"),
} as const;

export type RampName = keyof typeof P;

if (HEX.length > 256) throw new Error(`palette has ${HEX.length} entries; the plate format holds 256`);

/** The palette as RGBA bytes, 256 entries (unused entries are transparent black). */
export function paletteRGBA(): Uint8Array {
  const out = new Uint8Array(256 * 4);
  HEX.forEach((h, i) => {
    if (i === 0) return;
    const v = parseInt(h.slice(1), 16);
    out[i * 4] = (v >> 16) & 255;
    out[i * 4 + 1] = (v >> 8) & 255;
    out[i * 4 + 2] = v & 255;
    out[i * 4 + 3] = 255;
  });
  return out;
}

/** Entries in use (for tests and debug). */
export const PALETTE_SIZE = HEX.length;

/** "#rrggbb" to linear-ish 0..1 floats (sRGB values as stored; the world is not gamma-corrected). */
export function rgb(hex: string): [number, number, number] {
  const v = parseInt(hex.slice(1), 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}

/** The hex of a palette index (debug, tests). */
export function hexOf(i: number): string {
  return HEX[i] ?? "#000000";
}

// Pixel art for the homepage's loader, drawn in code: the chibi loader items (PLACEHOLDERS until the cast lane
// draws the real chibis: simple pixel shapes, one per item of the opening plan's roster, D8) and the small ofuda.
//
// The ofuda is the SAME 8 x 20 drawing as the one on her hat in the world (public/tesu/opening/ofuda-front-192.png
// and -back-192.png; mark.test.mjs keeps the two in step): "the corner ofuda literally becomes the ofuda on her hat"
// (Dex 10-16), so the page shows the very object the world catches.
//
// Every sprite is rows of palette letters; '.' is empty. Pure data and pure functions (no DOM).

export type Rgb = readonly [number, number, number];

/** The loader's palette: the world's own colours (src/tesu/art/palette.ts) plus the ofuda's paper. */
export const PAL: Readonly<Record<string, Rgb>> = {
  k: [42, 39, 50], // ink outline
  w: [255, 250, 240], // paper white
  p: [230, 216, 188], // paper shade
  r: [238, 76, 49], // vermilion
  R: [156, 34, 23], // deep red
  g: [243, 189, 65], // gold
  G: [208, 144, 36], // gold shade
  y: [255, 226, 124], // gold light
  b: [30, 108, 171], // azure
  B: [111, 179, 232], // azure light
  s: [246, 205, 176], // skin
  h: [58, 42, 58], // hair
  m: [214, 216, 222], // steel
  M: [140, 147, 163], // steel shade
  n: [71, 119, 84], // pine
  N: [35, 74, 56], // pine shade
  t: [137, 103, 65], // timber
  e: [255, 255, 255], // glint
  // the ofuda's own colours (from the world's drawing)
  "1": [78, 48, 34],
  "2": [150, 104, 66],
  "3": [176, 128, 84],
  "4": [210, 166, 112],
  "5": [234, 202, 146],
  "6": [248, 228, 182],
  "7": [216, 122, 88],
  "8": [186, 48, 54],
  "9": [122, 32, 40],
  A: [132, 94, 62],
  C: [214, 178, 128],
  D: [190, 132, 98],
  E: [194, 152, 104],
  F: [160, 118, 80],
};

/** The ofuda's face (8 x 20), pixel for pixel the world's ofuda-front-192.png. */
export const OFUDA_FRONT: readonly string[] = [
  "11111111",
  "12222221",
  "12222221",
  "13455561",
  "13478561",
  "13488761",
  "13458561",
  "13888881",
  "13478761",
  "13758571",
  "13455561",
  "13858561",
  "13758761",
  "13888561",
  "13885761",
  "13457561",
  "13455661",
  "13459961",
  "13459961",
  "11111111",
];

/** Its back (ofuda-back-192.png): the script shows through the paper. */
export const OFUDA_BACK: readonly string[] = [
  "11111111",
  "1AAAAAA1",
  "1AAAAAA1",
  "1CCCCEF1",
  "1CCDCEF1",
  "1CDDDDF1",
  "1CCDEEF1",
  "1DDDDDD1",
  "1CDDDEF1",
  "1DEDEDF1",
  "1CCCCEF1",
  "1CDEDDF1",
  "1DDDEDF1",
  "1CDEDDF1",
  "1CDEDDF1",
  "1DCEDDF1",
  "1CDEEEF1",
  "1CCDDEF1",
  "1CCDDEF1",
  "11111111",
];

export const OFUDA_W = 8;
export const OFUDA_H = 20;

/** The loader items (placeholders). The roster: chibi Zhusha first, her sword second, then the rest shuffled. */
export type ItemId = "zhusha" | "sword" | "lantern" | "seal" | "crane" | "ingot" | "walker";

export interface ItemArt {
  id: ItemId;
  /** Read by screen readers as the loader's status ("loading the world: her sword"). */
  label: string;
  rows: readonly string[];
}

export const ITEM_SIZE = 16;

export const ITEMS: Readonly<Record<ItemId, ItemArt>> = {
  // chibi Zhusha: the wide hat with its talisman, the face under it, her red coat
  zhusha: {
    id: "zhusha",
    label: "zhusha",
    rows: [
      "......kkkk......",
      "....kkyggykk....",
      "..kkgggggggGkk..",
      "kGGGGGGG8GGGGGGk",
      "...khhhh8hhhhk..",
      "..khhsss5sssshk.",
      "..khsksssssksshk",
      "..khsksssssksshk",
      "..khsssrssssshk.",
      "...kkssssssskk..",
      "....krrrwwrrk...",
      "...krrrrwwrrrk..",
      "...kRrrrwwrrRk..",
      "....kkrrrrrkk...",
      ".....kk...kk....",
      "................",
    ],
  },
  // her sword (a jian): azure blade on the diagonal, gold guard, red tassel
  sword: {
    id: "sword",
    label: "her sword",
    rows: [
      ".............kk.",
      "............kek.",
      "...........kBbk.",
      "..........kBbk..",
      ".........kBbk...",
      "........kBbk....",
      ".......kBbk.....",
      "..kk..kBbk......",
      "..kgkkBbk.......",
      "...kgGbk........",
      "....kGgk........",
      "...kkkGgk.......",
      "..krk.kkgk......",
      "..krk....k......",
      "..kRk...........",
      "...k............",
    ],
  },
  // a paper lantern with its gold caps and a warm light
  lantern: {
    id: "lantern",
    label: "a paper lantern",
    rows: [
      ".......kk.......",
      "......kkkk......",
      ".....kGggGk.....",
      "....kkkkkkkk....",
      "...krrwwwwrrk...",
      "..krrwwyywwrrk..",
      "..krwwyyyywwrk..",
      "..krwwy88ywwrk..",
      "..krwwyyyywwrk..",
      "..krrwwyywwrrk..",
      "...krrwwwwrrk...",
      "....kkkkkkkk....",
      ".....kGggGk.....",
      "......kkkk......",
      ".......kk.......",
      ".......rr.......",
    ],
  },
  // the Emperor's seal: a red stamp block with a carved knob
  seal: {
    id: "seal",
    label: "the emperor's seal",
    rows: [
      "......kkkk......",
      ".....kggggk.....",
      ".....kgyggk.....",
      "......kggk......",
      ".....kkkkkk.....",
      "...kkrrrrrrkk...",
      "..krrrrrrrrrRk..",
      "..krrkkrrkkrRk..",
      "..krrrrrrrrrRk..",
      "..krrrrrrrrrRk..",
      "..kRRRRRRRRRRk..",
      "...kkkkkkkkkk...",
      "..8..8.....8....",
      "....8..88....8..",
      "................",
      "................",
    ],
  },
  // a paper crane, folded from gold paper
  crane: {
    id: "crane",
    label: "a paper crane",
    rows: [
      "................",
      ".k..............",
      "kgk.........kk..",
      ".kgk.......kwk..",
      "..kgk....kkwwk..",
      "...kgkkkkwwwpk..",
      "...kywwwwwwppk..",
      "..kyyywwwwpppkk.",
      ".kyyyyywwppppGgk",
      "..kkyyyyypppGGk.",
      "....kkkyyypGkk..",
      ".......kkkkk....",
      "................",
      "................",
      "................",
      "................",
    ],
  },
  // a gold ingot (sycee)
  ingot: {
    id: "ingot",
    label: "a gold ingot",
    rows: [
      "................",
      "................",
      "................",
      "......kkkk......",
      ".kk..kyyggk..kk.",
      "kyyk.kyeygk.kgGk",
      "kygyk.kggk.kgGGk",
      "kyggykkkkkkgGGGk",
      ".kyggggggggGGGk.",
      "..kygggggggGGk..",
      "...kkGGGGGGkk...",
      ".....kkkkkk.....",
      "................",
      "................",
      "................",
      "................",
    ],
  },
  // the Walker: a white body with a little pine on its back, dark legs (rare)
  walker: {
    id: "walker",
    label: "the walker",
    rows: [
      "........nn......",
      ".......nnNn.....",
      "......nnNNNn....",
      "........t.......",
      "...kkkkkkkkkk...",
      "..kwwwwwwwwwwk..",
      "..kwwwwwwwwwpk..",
      "..kwkwwwwwwwpk..",
      "..kwwwwwwwwppk..",
      "...kkkkkkkkkk...",
      "...kk.kk.kk.kk..",
      "...kk.kk.kk.kk..",
      "...kk.kk.kk.kk..",
      "..kkk.kkkkk.kkk.",
      "................",
      "................",
    ],
  },
};

/**
 * The cycle's order (the opening plan's D8): chibi Zhusha always first, her sword always second, then the
 * lantern, the seal, the crane and the ingot shuffled, the Walker now and then (1 in 8 per round). Deterministic
 * from `seed` so checks can replay it.
 */
export function roster(seed: number, rounds = 4): ItemId[] {
  let s = (seed >>> 0) || 1;
  const rand = (): number => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
  const out: ItemId[] = ["zhusha", "sword"];
  for (let r = 0; r < rounds; r++) {
    const rest: ItemId[] = ["lantern", "seal", "crane", "ingot"];
    for (let i = rest.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [rest[i], rest[j]] = [rest[j]!, rest[i]!];
    }
    if (rand() < 1 / 8) rest.splice(1 + Math.floor(rand() * 3), 0, "walker");
    out.push(...rest);
    if (r < rounds - 1) out.push("zhusha", "sword");
  }
  return out;
}

/** Checks a sprite: equal-length rows, only palette letters. Throws on a bad one. */
export function validateRows(name: string, rows: readonly string[], w: number, h: number): void {
  if (rows.length !== h) throw new Error(`${name}: ${rows.length} rows, want ${h}`);
  rows.forEach((row, y) => {
    if (row.length !== w) throw new Error(`${name} row ${y}: ${row.length} wide, want ${w}`);
    for (const ch of row) if (ch !== "." && !PAL[ch]) throw new Error(`${name} row ${y}: no colour ${ch}`);
  });
}

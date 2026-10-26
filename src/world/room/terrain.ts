// Terrain art: the player-plane ground drawn as lit pixel data (albedo +
// normal, like the lab's floor and ledges), so it takes the same key light,
// effect lights and rim as the player and props. Flat side view: a lit top
// lip, courses and joints, no fake 3D faces. Each piece is drawn at its own
// size and seed so nothing repeats like toy blocks; big slabs get finer
// texture, small things chunkier. Colours come from a 5-step ramp per room so
// the ground sits in the backdrop's value family.

// "block" is the grey-box: flat grey with a grid line every H (and ticks every
// half H on the lip), so a blockout room reads as measured geometry, not art.
export type TerrainArt = "stone" | "rock" | "wood" | "earth" | "plaster" | "block" | "none";

export interface TexPair {
  w: number;
  h: number;
  albedo: Uint8ClampedArray;
  normal: Uint8ClampedArray;
}

type RGB8 = [number, number, number];
const hx = (h: string): RGB8 => {
  const v = parseInt(h.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};

export const TERRAIN_RAMPS: Record<Exclude<TerrainArt, "none">, string[]> = {
  stone: ["#141318", "#211f26", "#302d36", "#45414c", "#666170"],
  rock: ["#090e11", "#10181c", "#1a2529", "#28373b", "#4a5551"],
  wood: ["#140e0b", "#23180f", "#342417", "#4a3421", "#6a4c31"],
  earth: ["#120d0c", "#1e1614", "#2c201c", "#3d2d26", "#574134"],
  plaster: ["#2a2622", "#3b3530", "#4f4841", "#665d54", "#857a6d"],
  block: ["#1c1d21", "#2a2c31", "#3a3c42", "#4d5057", "#6c6f77"],
};

function hash(x: number, y: number, s: number): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function vn(x: number, y: number, s: number): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  const fx = x - xi, fy = y - yi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x: number, y: number, s: number): number {
  return (vn(x, y, s) * 0.55 + vn(x * 2.1, y * 2.1, s + 7) * 0.3 + vn(x * 4.3, y * 4.3, s + 13) * 0.15);
}

/**
 * One terrain piece. `H` is the player height (sizes of courses, planks,
 * joints are fractions of it). `open`: which edges are exposed (a slab that
 * continues into a neighbour has no side lip there).
 */
export function terrainTexture(w: number, h: number, art: Exclude<TerrainArt, "none">, seed: number, H: number, ramp?: string[], open = { left: true, right: true }, rim = 0): TexPair {
  const R = (ramp ?? TERRAIN_RAMPS[art]).map(hx);
  const n = R.length;
  const albedo = new Uint8ClampedArray(w * h * 4);
  const normal = new Uint8ClampedArray(w * h * 4);
  const course = Math.max(6, Math.round(H * (art === "wood" ? 0.12 : 0.3)));
  const joint = Math.max(10, Math.round(H * (art === "wood" ? 0.55 : 0.8)));
  const put = (x: number, y: number, band: number, nrm: [number, number, number], ink = false): void => {
    const i = (y * w + x) * 4;
    const c = R[Math.max(0, Math.min(n - 1, band))]!;
    albedo[i] = c[0]; albedo[i + 1] = c[1]; albedo[i + 2] = c[2]; albedo[i + 3] = 255;
    const l = Math.hypot(nrm[0], nrm[1], nrm[2]) || 1;
    normal[i] = Math.round((nrm[0] / l * 0.5 + 0.5) * 255);
    normal[i + 1] = Math.round((nrm[1] / l * 0.5 + 0.5) * 255);
    normal[i + 2] = Math.round((nrm[2] / l * 0.5 + 0.5) * 255);
    normal[i + 3] = ink ? 0 : 255;
  };
  // the top edge: rock and earth get an irregular rim of boulders and tufts rising up to
  // `rim` px above the collision line (the texture starts `rim` px higher); stone chips a pixel
  const topOff = (x: number): number => {
    if (art === "rock" && rim > 0) {
      const lump = Math.max(0, fbm(x / 16, 0.5, seed) - 0.38) * 2.4;
      const boulder = Math.max(0, 1 - Math.abs(((x + Math.floor(hash(Math.floor(x / 23), 1, seed) * 11)) % 23) - 11) / 9) * (hash(Math.floor(x / 23), 2, seed) > 0.55 ? 1 : 0);
      const b = Math.min(rim, Math.round((lump * 0.8 + boulder * 0.6) * rim));
      return rim - b + (fbm(x / 4, 3.1, seed) > 0.7 ? 1 : 0);
    }
    if (art === "rock") return fbm(x / 5, 3.1, seed) > 0.62 ? 1 : 0;
    if (art === "earth") return rim + (fbm(x / 6, 1.5, seed) > 0.66 ? 1 : 0) - Math.round(Math.max(0, fbm(x / 9, 2.2, seed) - 0.5) * rim * 2);
    if (art === "stone") return hash(Math.floor(x / 3), 9, seed) > 0.93 ? 1 : 0;
    return 0;
  };
  for (let x = 0; x < w; x++) {
    const t0 = topOff(x);
    for (let y = 0; y < h; y++) {
      if (y < t0) continue;
      const d = y - t0; // depth below the lip
      const deep = y / Math.max(1, h);
      let band = n - 3;
      let nrm: [number, number, number] = [0, 0, 1];
      const g = fbm(x / (art === "rock" ? 7 : 11), y / (art === "rock" ? 5 : 9), seed);
      // rough ground (rock, earth) keeps its lip nearly face-on so the rim light doesn't
      // trace its jagged top as one bright line; cut stone and planks keep a crisp lit edge
      const rough = art === "rock" || art === "earth";
      if (art === "block" && d <= 1) {
        // the lip, with a darker tick every half H so gaps and ledges read in H
        const tick = (x + (seed >>> 16)) % Math.max(2, Math.round(H / 2)) === 0;
        put(x, y, d === 0 ? (tick ? n - 3 : n - 1) : n - 2, [0, -1, 0.4]);
        continue;
      }
      if (d === 0) { band = rough ? n - 3 + (hash(x, 1, seed) > 0.7 ? 1 : 0) : n - 1; nrm = rough ? [0, -0.15, 1] : [0, -1, 0.4]; }
      else if (d === 1) { band = rough ? n - 3 : n - 2; nrm = rough ? [0, -0.1, 1] : [0, -0.8, 0.6]; }
      else if (d === 2 && art !== "wood") { band = n - 3; nrm = [0, -0.4, 0.9]; }
      else {
        if (art === "stone") {
          const row = Math.floor((d - 3) / course);
          const off = row % 2 ? Math.floor(joint / 2) : 0;
          const jx = (x + off + Math.floor(hash(row, 1, seed) * 7)) % joint;
          const jy = (d - 3) % course;
          band = n - 3 + (g > 0.62 ? 1 : g < 0.3 ? -1 : 0);
          if (jy === 0) { band = 0; nrm = [0, 0.6, 0.8]; }
          else if (jy === 1) { band = n - 3; nrm = [0, -0.5, 0.85]; }
          else if (jx === 0) { band = 0; nrm = [0.6, 0, 0.8]; }
          else if (jx === 1) { band = n - 2; nrm = [-0.5, 0, 0.85]; }
          if (hash(x >> 1, y >> 1, seed + 3) > 0.985) band = 1; // pits
        } else if (art === "rock") {
          const strata = Math.sin(y * 0.55 + g * 5 + x * 0.04);
          band = n - 3 + (strata > 0.7 ? 1 : strata < -0.6 ? -1 : 0) + (g > 0.7 ? 1 : 0);
          const crack = Math.abs(((x + y * 0.6 + g * 30) % 37) - 18) < 0.6 && hash(Math.floor(x / 12), Math.floor(y / 10), seed) > 0.5;
          if (crack) { band = 0; nrm = [0.4, 0.3, 0.85]; }
          nrm = [nrm[0] + (fbm((x + 1) / 7, y / 5, seed) - fbm((x - 1) / 7, y / 5, seed)) * -3, nrm[1] + (fbm(x / 7, (y + 1) / 5, seed) - fbm(x / 7, (y - 1) / 5, seed)) * -3, 1];
        } else if (art === "wood") {
          const plank = Math.floor(x / Math.max(8, Math.round(H * 0.35)) + hash(0, Math.floor(d / course), seed) * 3);
          const seam = x % Math.max(8, Math.round(H * 0.35)) === 0;
          band = n - 3 + (hash(plank, Math.floor(d / course), seed) > 0.6 ? 1 : 0) - (d % course === 0 ? 1 : 0);
          if (seam) { band = 0; nrm = [0.6, 0, 0.8]; }
          if (d > course * 1.5) band -= 1;
        } else if (art === "block") {
          // grey-box: world-aligned grid lines every H (x from the piece's world x via seed offset)
          const gx = (x + (seed >>> 16)) % H;
          band = n - 3;
          if (gx === 0 || d % H === 0) band = n - 4;
        } else if (art === "earth") {
          band = n - 3 + (g > 0.6 ? 1 : g < 0.3 ? -1 : 0);
          if (d < 4 && hash(x, 3, seed) > 0.6) band = n - 2; // grass edge
        } else {
          band = n - 2 + (g > 0.65 ? 1 : g < 0.25 ? -1 : 0);
        }
        // darker with depth (the ground falls into shade below the lip)
        band -= Math.floor(Math.min(2, deep * 2.6 + (d > H * 0.5 ? 1 : 0)));
      }
      // exposed ends: a lit left edge and a dark right edge
      if (open.left && x === 0 && d > 0) { band = Math.min(n - 1, band + 1); nrm = [-0.8, 0, 0.6]; }
      if (open.right && x === w - 1 && d > 0) { band = Math.max(0, band - 1); nrm = [0.8, 0, 0.6]; }
      put(x, y, band, nrm);
    }
  }
  return { w, h, albedo, normal };
}

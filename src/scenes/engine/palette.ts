// Colour ramps. A scene names its ramps; each is 2..7 colours, darkest first.
// Every colour on screen comes out of one of these (shade -> band), so the
// scene stays banded like pixel art no matter what the shaders compute.
//
// In GLSL each ramp is available as a row constant R_<NAME> (uppercased, dashes
// become underscores): ramp(R_ROCK, shade, p, dither).

import { dataTexture, type Texture } from "./gl.ts";

export type Hex = string;
export type RGB = [number, number, number];

export function hex(h: Hex): RGB {
  const s = h.replace("#", "");
  const n = parseInt(s.length === 3 ? s.split("").map((c) => c + c).join("") : s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function toHex([r, g, b]: RGB): Hex {
  return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;
}

function rgbToHsl([r, g, b]: RGB): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn;
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): RGB {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

/**
 * A hue-shifted ramp around a base colour: shadows lean toward `coolHue`
 * (default blue-violet), lights toward `warmHue` (default gold). `spread` is
 * how far lightness travels each side of the base (0..0.5).
 */
export function shiftRamp(
  base: Hex,
  n = 4,
  o: { spread?: number; shift?: number; coolHue?: number; warmHue?: number; satDrop?: number } = {},
): Hex[] {
  const [h, s, l] = rgbToHsl(hex(base));
  const spread = o.spread ?? 0.22;
  const shift = o.shift ?? 18;
  const cool = o.coolHue ?? 235;
  const warm = o.warmHue ?? 48;
  const toward = (from: number, to: number, amt: number): number => {
    let d = ((to - from + 540) % 360) - 180;
    return from + Math.sign(d) * Math.min(Math.abs(d), amt);
  };
  const out: Hex[] = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const k = t * 2 - 1;
    const hh = k < 0 ? toward(h, cool, -k * shift) : toward(h, warm, k * shift);
    const ss = Math.max(0, Math.min(1, s * (1 - (o.satDrop ?? 0.25) * Math.abs(k))));
    const ll = Math.max(0.02, Math.min(0.97, l + k * spread));
    out.push(toHex(hslToRgb(hh, ss, ll)));
  }
  return out;
}

export interface Palette {
  names: string[];
  rows: Record<string, number>;
  tex: Texture;
  colours: RGB[][];
}

export function defineName(name: string): string {
  return `R_${name.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
}

export function buildPalette(gl: WebGL2RenderingContext, ramps: Record<string, Hex[]>): Palette {
  const names = Object.keys(ramps);
  if (names.length > 120) throw new Error("palette: at most 120 ramps");
  const data = new Uint8Array(8 * names.length * 4);
  const rows: Record<string, number> = {};
  const colours: RGB[][] = [];
  names.forEach((name, row) => {
    const list = ramps[name]!;
    if (list.length < 1 || list.length > 7) throw new Error(`palette ramp "${name}" needs 1..7 colours`);
    rows[name] = row;
    const cs = list.map(hex);
    colours.push(cs);
    cs.forEach(([r, g, b], i) => data.set([r, g, b, 255], (row * 8 + i) * 4));
    data.set([list.length, 0, 0, 255], (row * 8 + 7) * 4);
  });
  return { names, rows, tex: dataTexture(gl, 8, names.length, data), colours };
}

export function paletteDefines(p: Palette): string {
  return p.names.map((n, i) => `#define ${defineName(n)} ${i}.0`).join("\n");
}

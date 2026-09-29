// QR code as a module grid and as crisp SVG. DOM-free, so the same code
// prerenders the default donation QR at build time and redraws it in the
// browser when the amount changes. Encoder: lean-qr (MIT, no dependencies,
// about 3.7 kB gzipped).
import { correction, generate } from "lean-qr";

export interface QrGrid {
  /** Modules per side, without the quiet zone. */
  readonly size: number;
  /** True for a dark module. Out-of-range coordinates read as light. */
  get(x: number, y: number): boolean;
}

/**
 * Encodes `text` with at least error correction M (the level the legacy,
 * bank-app-checked code used). lean-qr raises the level when the same code
 * size has room for it, which only makes the code more robust.
 */
export function qrGrid(text: string): QrGrid {
  return generate(text, { minCorrectionLevel: correction.M });
}

/** SVG path data for the dark modules, one rectangle per horizontal run. */
export function qrPath(grid: QrGrid, offset = 0): string {
  const parts: string[] = [];
  for (let y = 0; y < grid.size; y += 1) {
    let x = 0;
    while (x < grid.size) {
      if (!grid.get(x, y)) { x += 1; continue; }
      const start = x;
      while (x < grid.size && grid.get(x, y)) x += 1;
      parts.push(`M${start + offset} ${y + offset}h${x - start}v1h${start - x}z`);
    }
  }
  return parts.join("");
}

export interface QrSvgOptions {
  /** Light border in modules. The QR standard asks for 4. */
  quiet?: number;
  dark?: string;
  light?: string;
  /** Accessible name. Without it the SVG is decorative (aria-hidden). */
  label?: string;
}

function escapeAttribute(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
}

/** A standalone SVG string; scales to any size without blurring. */
export function qrSvg(text: string, options: QrSvgOptions = {}): string {
  const { quiet = 4, dark = "#000", light = "#fff", label } = options;
  const grid = qrGrid(text);
  const side = grid.size + quiet * 2;
  const a11y = label ? `role="img" aria-label="${escapeAttribute(label)}"` : `aria-hidden="true"`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${side} ${side}" shape-rendering="crispEdges" ${a11y}>` +
    `<rect width="${side}" height="${side}" fill="${escapeAttribute(light)}"/>` +
    `<path d="${qrPath(grid, quiet)}" fill="${escapeAttribute(dark)}"/>` +
    `</svg>`
  );
}

// Where the website's white meets the world (Dex 10-16: "a gradual gradient plus sparse white pixels"). The pure
// pieces: scatterCell (the sparse white pixels, dense at the white, thinning into the world), used by the windows'
// own edges (motion/windows.ts edgeMask) and by the SVG tiles here; sheetEdge, the white page's top edge rising out of
// the black game screen as a clean two-tone ordered dither (no grey, no repeating stamp). initScatter writes on the
// sheet (#site, not <html>): `--scatter-r` / `--scatter-b` (the jetty's column and its top edge) and `--sheet-edge`,
// drawn again when the width changes.

/** Is the cell at (x, y) of a fade `cols` deep white? x = 0 is the paper's edge. Pure (for checks). */
export function scatterCell(x: number, y: number, cols: number): boolean {
  const u = (x + 0.5) / cols; // 0 at the paper, 1 out in the sky
  // dense at the paper, thinning fast, a few strays far out
  const p = 0.92 * Math.pow(1 - u, 2.6) + 0.035 * (1 - u);
  // the pixels clump a little (a cell beside a lit cell is likelier lit), like paper fibres coming apart
  const h = hash(x, y);
  const near = (hash(x - 1, y) < p ? 0.12 : 0) + (hash(x, y - 1) < p ? 0.08 : 0);
  return h < p + near * (1 - u);
}

function hash(x: number, y: number): number {
  let h = Math.imul(x * 374761393 + y * 668265263 + 1442695041, 3266489917) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 3266489917) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export type FadeSide = "l" | "r" | "t" | "b";

/**
 * The tile as SVG: a fade `depth` cells deep and `span` cells along the edge, `cell` css px a cell. `side` is
 * where the sky is: "l" paper left (fade runs right), "r" mirrored, "t" paper below (fade runs up), "b" paper above.
 */
export function scatterSvg(depth: number, span: number, cell: number, side: FadeSide | boolean): string {
  const s: FadeSide = side === true ? "r" : side === false ? "l" : side;
  const across = s === "l" || s === "r";
  const w = across ? depth : span, h = across ? span : depth;
  let d = "";
  for (let a = 0; a < span; a++) {
    for (let k = 0; k < depth; k++) {
      // k: cells from the paper; a: along the edge (hashed as if every edge ran the same way)
      if (!scatterCell(k, a, depth)) continue;
      const x = s === "l" ? k : s === "r" ? depth - 1 - k : a;
      const y = s === "b" ? k : s === "t" ? depth - 1 - k : a;
      d += `M${x} ${y}h1v1h-1z`;
    }
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w * cell}" height="${h * cell}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">` +
    `<path fill="#fff" d="${d}"/></svg>`
  );
}

const SPAN = 96;
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/**
 * The white page's top edge on the black game screen: `cols` x `rows` cells, white below thinning to none at the top
 * on an ordered (Bayer) dither, so the dissolve is two clean tones with no noise and no repeat across the page.
 */
export function sheetEdgeSvg(cols: number, rows: number, cell: number): string {
  let d = "";
  for (let y = 0; y < rows; y++) {
    const density = (y + 0.5) / rows; // 0 at the top (black) .. 1 at the bottom (the white page)
    for (let x = 0; x < cols;) {
      if ((BAYER4[(y & 3) * 4 + (x & 3)]! + 1) / 17 >= density) { x++; continue; }
      let n = 1;
      while (x + n < cols && (BAYER4[(y & 3) * 4 + ((x + n) & 3)]! + 1) / 17 < density) n++;
      d += `M${x} ${y}h${n}v1h-${n}z`;
      x += n;
    }
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${cols * cell}" height="${rows * cell}" viewBox="0 0 ${cols} ${rows}" shape-rendering="crispEdges">` +
    `<path fill="#fff" d="${d}"/></svg>`
  );
}

export function initScatter(): void {
  const sheet = document.getElementById("site");
  if (!sheet || !document.querySelector(".band__win, .jetty, .sheet--column")) return;
  let key = "";
  const draw = (): void => {
    const vw = document.documentElement.clientWidth || innerWidth;
    // the pixels match the page's pixel scale: 4 css px on a desktop, 3 on smaller screens; the fade's depth is the
    // windows' --win-fade (styles/v2.css: clamp(28px, 4vw, 56px))
    const cell = vw >= 1100 ? 4 : 3;
    const fade = Math.min(56, Math.max(28, innerWidth * 0.04));
    const depth = Math.max(4, Math.round(fade / cell));
    const next = `${depth}:${cell}:${vw}`;
    if (next === key) return;
    key = next;
    const url = (svg: string): string => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
    sheet.style.setProperty("--scatter-r", url(scatterSvg(depth, SPAN, cell, "r")));
    sheet.style.setProperty("--scatter-size", `${depth * cell}px ${SPAN * cell}px`);
    sheet.style.setProperty("--scatter-b", url(scatterSvg(depth, SPAN, cell, "b")));
    sheet.style.setProperty("--scatter-edge-size", `${SPAN * cell}px ${depth * cell}px`);
    // the sheet's top edge: one image the page's width, never repeated
    const cols = Math.ceil(vw / cell);
    sheet.style.setProperty("--sheet-edge", url(sheetEdgeSvg(cols, depth, cell)));
    sheet.style.setProperty("--sheet-edge-size", `${cols * cell}px ${depth * cell}px`);
    sheet.style.setProperty("--sheet-edge-h", `${depth * cell}px`);
  };
  draw();
  let t = 0;
  window.addEventListener("resize", () => {
    clearTimeout(t);
    t = window.setTimeout(draw, 150);
  });
}

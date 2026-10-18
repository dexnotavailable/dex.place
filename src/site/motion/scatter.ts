// The edge of the website's white paper (Dex 10-16): "a gradual gradient plus sparse white pixels". The
// gradient is CSS (styles/v2.css `.band::after` on the open side, `.band__edge` on the top and bottom); this
// draws the pixels over it: a scatter of white squares, dense where the paper ends and thinning out into the
// sky, on whole css pixels, as SVG tiles that repeat along the edge. Four tiles, one per direction the paper
// dissolves in: `--scatter-l` (paper on the left of the fade), `--scatter-r` (mirrored), `--scatter-t` (paper
// below: the paper's top edge), `--scatter-b` (paper above: its bottom edge). Written on the sheet (#site), not
// <html>; drawn again when the fade's size changes.

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

export function initScatter(): void {
  const sheet = document.getElementById("site");
  const side = document.querySelector<HTMLElement>(".band");
  const edge = document.querySelector<HTMLElement>(".band__edge");
  if (!sheet || (!side && !edge)) return;
  let key = "";
  const draw = (): void => {
    const vw = innerWidth;
    // the paper's pixels match the page's pixel scale: 4 css px on a desktop, 3 on smaller screens
    const cell = vw >= 1100 ? 4 : 3;
    const sideW = side ? parseFloat(getComputedStyle(side, "::after").width) || 0 : 0;
    const edgeH = edge ? parseFloat(getComputedStyle(edge).height) || 0 : 0;
    const across = Math.max(4, Math.round((sideW || 120) / cell));
    const down = Math.max(4, Math.round((edgeH || 40) / cell));
    const next = `${across}:${down}:${cell}`;
    if (next === key) return;
    key = next;
    const url = (svg: string): string => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
    sheet.style.setProperty("--scatter-l", url(scatterSvg(across, SPAN, cell, "l")));
    sheet.style.setProperty("--scatter-r", url(scatterSvg(across, SPAN, cell, "r")));
    sheet.style.setProperty("--scatter-size", `${across * cell}px ${SPAN * cell}px`);
    sheet.style.setProperty("--scatter-t", url(scatterSvg(down, SPAN, cell, "t")));
    sheet.style.setProperty("--scatter-b", url(scatterSvg(down, SPAN, cell, "b")));
    sheet.style.setProperty("--scatter-edge-size", `${SPAN * cell}px ${down * cell}px`);
  };
  draw();
  let t = 0;
  window.addEventListener("resize", () => {
    clearTimeout(t);
    t = window.setTimeout(draw, 150);
  });
}

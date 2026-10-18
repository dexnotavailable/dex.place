// The edge of the website's white paper (Dex 10-16): "a gradual gradient plus sparse white pixels". The
// gradient is CSS (styles/v2.css `.band::after`); this draws the pixels over it: a scatter of white squares,
// dense where the paper ends and thinning out into the sky, on whole css pixels, as an SVG tile that repeats
// down the edge. Two tiles: `--scatter-l` (paper on the left of the fade) and `--scatter-r` (mirrored).
// Written on the sheet (#site), not <html>; redrawn when the fade's width changes.

/** Is the cell at (x, y) of a `cols`-wide fade white? x = 0 is the paper's edge. Pure (for checks). */
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

/** The tile as SVG: `cols` x `rows` cells of `cell` css px; `mirror` puts the paper on the right. */
export function scatterSvg(cols: number, rows: number, cell: number, mirror: boolean): string {
  let d = "";
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (!scatterCell(x, y, cols)) continue;
      d += `M${mirror ? cols - 1 - x : x} ${y}h1v1h-1z`;
    }
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${cols * cell}" height="${rows * cell}" viewBox="0 0 ${cols} ${rows}" shape-rendering="crispEdges">` +
    `<path fill="#fff" d="${d}"/></svg>`
  );
}

const ROWS = 96;

export function initScatter(): void {
  const sheet = document.getElementById("site");
  const probe = document.querySelector<HTMLElement>(".band, .sheet--column .main > .page, .jetty__paper");
  if (!sheet || !probe) return;
  let key = "";
  const draw = (): void => {
    const vw = innerWidth;
    // the paper's pixels match the page's pixel scale: 4 css px on a desktop, 3 on smaller screens
    const cell = vw >= 1100 ? 4 : 3;
    const after = getComputedStyle(probe, probe.classList.contains("jetty__paper") ? "::before" : "::after");
    const w = parseFloat(after.width) || 160;
    const cols = Math.max(4, Math.round(w / cell));
    const next = `${cols}:${cell}`;
    if (next === key) return;
    key = next;
    for (const [name, mirror] of [["--scatter-l", false], ["--scatter-r", true]] as const) {
      const svg = scatterSvg(cols, ROWS, cell, mirror);
      sheet.style.setProperty(name, `url("data:image/svg+xml,${encodeURIComponent(svg)}")`);
    }
    sheet.style.setProperty("--scatter-size", `${cols * cell}px ${ROWS * cell}px`);
  };
  draw();
  let t = 0;
  window.addEventListener("resize", () => {
    clearTimeout(t);
    t = window.setTimeout(draw, 150);
  });
}

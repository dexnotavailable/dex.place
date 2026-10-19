// The project cards' rigged art (Dex 10-19: the card-art lane traces each splash into SVG with every part a named
// group, plus a rig: pivots, depth, motions; the card plays it). Format (lanes\motion\NOTEBOOK.md ASKS 0):
// public/site/cards/<id>/card.svg (viewBox 0 0 W H; each top-level <g id> one part, back to front) + rig.json
// ({ v: 1, size: [W, H], focus, parts: { id: { depth 0..1, pivot [x, y], motion: [{ kind, ... }] } } }).
//
// Two finishes (Dex chooses; ?finish=pixel|vector keeps one for the visit, html[data-cardfinish]):
// - pixel: every part is rasterised once onto the site's pixel grid (2 css px an art px, crisp edges), and the card
//   is one small canvas composited a frame on twos (12 fps) while it is on screen: the parts sway, breathe, bob, glow
//   and drift in whole pixels, and pan by their depth with the pointer (desktop), the scroll and a slow drift (touch).
// - vector: every part is rasterised once at the screen's resolution into its own layer and moved by CSS animations
//   (rotate / scale / translate / opacity: the compositor, no script a frame); the pan is the same as the PNG layers'
//   (motion/magnet.ts, the card's view timeline, the touch drift).
// It loads only when the card comes near (the PNG layers show until it is ready, and stay without scripts). Reduced
// motion: the rig is drawn once, still.

export type Finish = "pixel" | "vector";
const FINISHES: readonly Finish[] = ["pixel", "vector"];

export interface Motion {
  kind: "sway" | "breathe" | "bob" | "glow" | "drift" | "flicker";
  period: number;
  phase?: number;
  deg?: number;
  scale?: number;
  dx?: number;
  dy?: number;
  min?: number;
  max?: number;
  fade?: boolean;
}
export interface RigPart { depth?: number; pivot?: [number, number]; motion?: Motion[] }
export interface Rig { v: 1; size: [number, number]; focus?: [number, number]; parts: Record<string, RigPart> }

/** The finish this page shows: ?finish=<finish> (kept for the visit), else pixel. Sets html[data-cardfinish]. */
export function finishOfPage(): Finish {
  let f: Finish = "pixel";
  try {
    const q = new URLSearchParams(location.search).get("finish");
    if (q && (FINISHES as readonly string[]).includes(q)) sessionStorage.setItem("dex-finish", q);
    const kept = sessionStorage.getItem("dex-finish");
    if (kept && (FINISHES as readonly string[]).includes(kept)) f = kept as Finish;
  } catch {
    // (storage blocked: the default)
  }
  document.documentElement.dataset.cardfinish = f;
  return f;
}

export interface Pose { rot: number; sx: number; sy: number; dx: number; dy: number; alpha: number }

/** A part's pose at t seconds from its motions (pure): degrees, scales, svg units, opacity. */
export function pose(ms: readonly Motion[] | undefined, t: number): Pose {
  const p: Pose = { rot: 0, sx: 1, sy: 1, dx: 0, dy: 0, alpha: 1 };
  for (const m of ms ?? []) {
    const per = Math.max(0.2, m.period);
    const u = t / per + (m.phase ?? 0);
    const wave = Math.sin(u * Math.PI * 2);
    if (m.kind === "sway") p.rot += (m.deg ?? 2) * wave;
    else if (m.kind === "breathe") { const s = (m.scale ?? 0.01) * (wave + 1) / 2; p.sy *= 1 + s; p.sx *= 1 - s / 2; }
    else if (m.kind === "bob") { p.dx += (m.dx ?? 0) * wave; p.dy += (m.dy ?? 2) * wave; }
    else if (m.kind === "glow") { const lo = m.min ?? 0.6, hi = m.max ?? 1; p.alpha *= lo + (hi - lo) * (wave + 1) / 2; }
    else if (m.kind === "flicker") { const lo = m.min ?? 0.5, hi = m.max ?? 1; p.alpha *= Math.floor(u * 6) % 3 === 0 ? lo : hi; }
    else if (m.kind === "drift") {
      const f = u - Math.floor(u);
      p.dx += (m.dx ?? 0) * f;
      p.dy += (m.dy ?? -10) * f;
      if (m.fade) p.alpha *= f < 0.2 ? f / 0.2 : f > 0.75 ? (1 - f) / 0.25 : 1;
    }
  }
  return p;
}

interface Part {
  id: string;
  rig: RigPart;
  /** The part rasterised (pixel: art px; vector: device px), cropped to what it covers. */
  img: HTMLCanvasElement;
  /** Where the crop sits, in svg units. */
  x: number;
  y: number;
  /** Svg units per raster px. */
  unit: number;
}

const loadText = (url: string): Promise<string> => fetch(url).then((r) => (r.ok ? r.text() : Promise.reject(new Error(`${url}: ${r.status}`))));

const SVGNS = "http://www.w3.org/2000/svg";

/** One part alone as an svg document over its own box (svg units) at w x h px (the defs come along). */
function partSvg(svg: SVGSVGElement, g: Element, box: DOMRect, w: number, h: number, crisp: boolean): string {
  const defs = svg.querySelector(":scope > defs")?.outerHTML ?? "";
  // (the art's own shape-rendering comes along: art drawn in pixels asks for crisp edges, or its shapes show seams)
  const sr = crisp ? "crispEdges" : svg.getAttribute("shape-rendering");
  return `<svg xmlns="${SVGNS}" viewBox="${box.x} ${box.y} ${box.width} ${box.height}" width="${w}" height="${h}"${sr ? ` shape-rendering="${sr}"` : ""}>${defs}${g.outerHTML}</svg>`;
}

/**
 * Rasterise every part at `scale` raster px per svg unit, each only over its own box (measured in the page, not by
 * painting the whole card); pixel: every pixel either there or not (no soft edge).
 */
async function rasterise(svg: SVGSVGElement, rig: Rig, scale: number, pixel: boolean): Promise<Part[]> {
  const groups = Array.from(svg.children).filter((g) => g.tagName.toLowerCase() === "g" && g.id);
  // measure: the art in the page, unseen, sized nothing (its boxes are in svg units whatever its size)
  const host = document.createElementNS(SVGNS, "svg");
  host.setAttribute("viewBox", svg.getAttribute("viewBox") ?? `0 0 ${rig.size[0]} ${rig.size[1]}`);
  host.setAttribute("aria-hidden", "true");
  host.style.cssText = "position:absolute;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none";
  for (const n of Array.from(svg.children)) host.append(document.importNode(n, true));
  document.body.append(host);
  const boxes = new Map<string, DOMRect>();
  try {
    for (const g of Array.from(host.querySelectorAll<SVGGraphicsElement>(":scope > g[id]"))) {
      const bb = g.getBBox();
      // a pixel's margin round it (anti-aliasing, rotation)
      const m = 1 / scale + 0.5;
      if (bb.width > 0 && bb.height > 0) boxes.set(g.id, new DOMRect(bb.x - m, bb.y - m, bb.width + m * 2, bb.height + m * 2));
    }
  } finally {
    host.remove();
  }
  const parts: Part[] = [];
  for (const g of groups) {
    const box = boxes.get(g.id);
    if (!box) continue;
    const w = Math.max(1, Math.ceil(box.width * scale)), h = Math.max(1, Math.ceil(box.height * scale));
    const url = URL.createObjectURL(new Blob([partSvg(svg, g, box, w, h, pixel)], { type: "image/svg+xml" }));
    try {
      const img = new Image();
      img.decoding = "async";
      img.src = url;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const cg = c.getContext("2d", { willReadFrequently: pixel })!;
      cg.drawImage(img, 0, 0, w, h);
      if (pixel) {
        const data = cg.getImageData(0, 0, w, h);
        const d = data.data;
        for (let i = 3; i < d.length; i += 4) d[i] = d[i]! >= 128 ? 255 : 0;
        cg.putImageData(data, 0, 0);
      }
      parts.push({ id: g.id, rig: rig.parts[g.id] ?? {}, img: c, x: box.x, y: box.y, unit: box.width / w });
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  return parts;
}

/** How the art covers a card cw x ch css px with room to pan: css px per svg unit, and the art's top-left. */
export function coverOf(rig: Rig, cw: number, ch: number, pad = 14): { s: number; left: number; top: number } {
  const [VW, VH] = rig.size;
  const s = Math.max((cw + pad * 2) / VW, (ch + pad * 2) / VH);
  return { s, left: (cw - VW * s) / 2, top: (ch - VH * s) * 0.4 };
}

const DEPTH_BUCKET = (d: number): string => (d < 0.34 ? "1" : d < 0.67 ? "2" : "3");

export function initCardRigs(reduced: MediaQueryList, fine: MediaQueryList): void {
  const finish = finishOfPage();
  const arts = Array.from(document.querySelectorAll<HTMLElement>(".cart[data-rig]"));
  if (!arts.length || typeof IntersectionObserver !== "function") return;
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      io.unobserve(e.target);
      const el = e.target as HTMLElement;
      void build(el).catch((err: unknown) => console.warn("[site] card rig", el.dataset.rig, err));
    }
  }, { rootMargin: "50% 0px" });
  arts.forEach((a) => io.observe(a));

  async function build(art: HTMLElement): Promise<void> {
    const base = art.dataset.rig!;
    const [rigText, svgText] = await Promise.all([loadText(`${base}rig.json`), loadText(`${base}card.svg`)]);
    const rig = JSON.parse(rigText) as Rig;
    const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
    const svg = doc.documentElement as unknown as SVGSVGElement;
    if (svg.tagName.toLowerCase() !== "svg") throw new Error("not an svg");
    const r = art.getBoundingClientRect();
    if (finish === "pixel") await buildPixel(art, rig, svg, r.width, r.height);
    else await buildVector(art, rig, svg, r.width, r.height);
    art.setAttribute("data-rigged", finish);
  }

  // --- pixel: one canvas on the site's grid, composited on twos while on screen
  async function buildPixel(art: HTMLElement, rig: Rig, svg: SVGSVGElement, cw: number, ch: number): Promise<void> {
    const K = 2; // css px an art px
    const cov = coverOf(rig, cw, ch);
    const parts = await rasterise(svg, rig, cov.s / K, true);
    const cv = document.createElement("canvas");
    cv.className = "rig__px";
    cv.width = Math.ceil(cw / K);
    cv.height = Math.ceil(ch / K);
    const ctx = cv.getContext("2d")!;
    art.prepend(cv);
    const card = art.closest<HTMLElement>(".pcard") ?? art;
    let px = 0, py = 0, tx = 0, ty = 0, visible = true, timer = 0;
    const t0 = performance.now();
    const still = reduced.matches;
    if (fine.matches && !still) {
      card.addEventListener("pointermove", (e) => {
        const b = art.getBoundingClientRect();
        tx = ((e.clientX - b.left) / b.width) * 2 - 1;
        ty = ((e.clientY - b.top) / b.height) * 2 - 1;
      });
      card.addEventListener("pointerleave", () => { tx = 0; ty = 0; });
    }
    const PAN = 7; // art px at full sway, for the nearest part
    // a frame is planned first (every move in whole art px, the glow in eighths) and painted only if it differs
    let last = "";
    const draw = (): void => {
      const t = still ? 0 : (performance.now() - t0) / 1000;
      // the pan: the pointer (eased), the scroll (where the card is on the screen), a slow drift on touch screens
      px += (tx - px) * 0.25;
      py += (ty - py) * 0.25;
      const b = art.getBoundingClientRect();
      const sc = still ? 0 : Math.max(-1, Math.min(1, ((b.top + b.height / 2) / innerHeight) * 2 - 1));
      const drift = still || fine.matches ? 0 : Math.sin(t * 0.9);
      const s = cov.s / K; // art px per svg unit
      const ox = cov.left / K, oy = cov.top / K;
      const plan = parts.map((p) => {
        const pz = still ? { rot: 0, sx: 1, sy: 1, dx: 0, dy: 0, alpha: 1 } : pose(p.rig.motion, t);
        const depth = p.rig.depth ?? 0.5;
        const pv = p.rig.pivot ?? [p.x + (p.img.width * p.unit) / 2, p.y + (p.img.height * p.unit) / 2];
        return {
          p, pv,
          x: Math.round(ox + (pv[0] + pz.dx) * s) + Math.round((-px * 0.8 + drift * 0.6) * depth * PAN),
          y: Math.round(oy + (pv[1] + pz.dy) * s) + Math.round((-py * 0.6 + sc * 0.8) * depth * PAN),
          rot: Math.round(pz.rot * 4) / 4, sx: Math.round(pz.sx * 200) / 200, sy: Math.round(pz.sy * 200) / 200,
          alpha: Math.round(pz.alpha * 8) / 8,
        };
      });
      const key = plan.map((q) => `${q.x},${q.y},${q.rot},${q.sx},${q.sy},${q.alpha}`).join(";");
      if (key === last) return;
      last = key;
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.imageSmoothingEnabled = false;
      for (const q of plan) {
        ctx.save();
        ctx.globalAlpha = q.alpha;
        // whole art px for every move, so the pixels stay on the grid
        ctx.translate(q.x, q.y);
        if (q.rot) ctx.rotate((q.rot * Math.PI) / 180);
        if (q.sx !== 1 || q.sy !== 1) ctx.scale(q.sx, q.sy);
        ctx.drawImage(q.p.img, Math.round((q.p.x - q.pv[0]) * s), Math.round((q.p.y - q.pv[1]) * s));
        ctx.restore();
      }
    };
    const loop = (): void => {
      timer = 0;
      if (!visible) return;
      draw();
      if (!still) timer = window.setTimeout(loop, 1000 / 12);
    };
    new IntersectionObserver((es) => {
      visible = es.some((e) => e.isIntersecting);
      if (visible && !timer) loop();
    }).observe(art);
    draw();
  }

  // --- vector: a layer per part at the screen's resolution, moved by CSS (the compositor)
  async function buildVector(art: HTMLElement, rig: Rig, svg: SVGSVGElement, cw: number, ch: number): Promise<void> {
    const dpr = window.devicePixelRatio || 1;
    const cov = coverOf(rig, cw, ch);
    const parts = await rasterise(svg, rig, cov.s * dpr, false);
    const box = document.createElement("div");
    box.className = "rig__box";
    const [VW, VH] = rig.size;
    Object.assign(box.style, { left: `${cov.left}px`, top: `${cov.top}px`, width: `${VW * cov.s}px`, height: `${VH * cov.s}px` });
    for (const p of parts) {
      const l = document.createElement("div");
      l.className = "rig__l";
      l.dataset.depth = DEPTH_BUCKET(p.rig.depth ?? 0.5);
      l.style.setProperty("--pd", String(Math.round((p.rig.depth ?? 0.5) * 15)));
      const c = p.img;
      c.className = "rig__p";
      const w = c.width * p.unit, h = c.height * p.unit;
      const pv = p.rig.pivot ?? [p.x + w / 2, p.y + h / 2];
      Object.assign(c.style, {
        left: `${(p.x / VW) * 100}%`, top: `${(p.y / VH) * 100}%`, width: `${(w / VW) * 100}%`, height: `${(h / VH) * 100}%`,
        transformOrigin: `${((pv[0] - p.x) / w) * 100}% ${((pv[1] - p.y) / h) * 100}%`,
      });
      if (!reduced.matches) animate(c, p.rig.motion ?? [], cov.s);
      l.append(c);
      box.append(l);
    }
    art.prepend(box);
  }

  /** CSS animations for a part's motions (one property each: rotate, scale, translate, opacity). */
  function animate(el: HTMLElement, ms: Motion[], s: number): void {
    const list: string[] = [];
    for (const m of ms) {
      const per = Math.max(0.2, m.period), delay = `${-(m.phase ?? 0) * per}s`;
      if (m.kind === "sway") { el.style.setProperty("--rig-deg", `${m.deg ?? 2}deg`); list.push(`rig-sway ${per / 2}s ease-in-out ${delay} infinite alternate`); }
      else if (m.kind === "breathe") { el.style.setProperty("--rig-s", String(m.scale ?? 0.01)); list.push(`rig-breathe ${per / 2}s ease-in-out ${delay} infinite alternate`); }
      else if (m.kind === "bob") { el.style.setProperty("--rig-bx", `${(m.dx ?? 0) * s}px`); el.style.setProperty("--rig-by", `${(m.dy ?? 2) * s}px`); list.push(`rig-bob ${per / 2}s ease-in-out ${delay} infinite alternate`); }
      else if (m.kind === "glow") { el.style.setProperty("--rig-lo", String(m.min ?? 0.6)); el.style.setProperty("--rig-hi", String(m.max ?? 1)); list.push(`rig-glow ${per / 2}s ease-in-out ${delay} infinite alternate`); }
      else if (m.kind === "flicker") { el.style.setProperty("--rig-lo", String(m.min ?? 0.5)); el.style.setProperty("--rig-hi", String(m.max ?? 1)); list.push(`rig-flicker ${per}s steps(1, end) ${delay} infinite`); }
      else if (m.kind === "drift") { el.style.setProperty("--rig-bx", `${(m.dx ?? 0) * s}px`); el.style.setProperty("--rig-by", `${(m.dy ?? -10) * s}px`); list.push(`${m.fade ? "rig-drift-fade" : "rig-drift"} ${per}s linear ${delay} infinite`); }
    }
    if (list.length) el.style.animation = list.join(", ");
  }
}

// The project cards' rigged art (Dex 10-19). The card-art lane traces each splash, labels its parts and ships each part
// as a webp layer with a rig.json (format: lanes\motion\NOTEBOOK.md ASKS 00); render/cardart.ts puts the layers on the
// page as plain <img> in an art box placed by CSS from the rig's face focus.
//
// Two finishes (motion/finish-mode.ts; ?finish=pixel|vector keeps one for the visit, html[data-cardfinish]):
// - vector (the default, Dex 10-19 "vector is best"): the layers themselves, moved by CSS animations from the rig's
//   motions (the compositor; this chunk is not even fetched).
// - pixel: every layer drawn once onto the site's pixel grid (2 css px an art px, hard edges), then the card is one
//   small canvas composited on twos (12 fps) while it is on screen, and only when something moved a whole pixel: the
//   parts sway, breathe, bob, glow and drift in whole pixels, and pan by their depth with the pointer (desktop), the
//   scroll and a slow drift (touch).
// Reduced motion: still.

import { normaliseRig, type RigMotion as Motion, type RigPartV2, type RigV2 as Rig } from "./rig-read.ts";

export interface Pose { rot: number; sx: number; sy: number; dx: number; dy: number; alpha: number }

/** A part's pose at t seconds from its motions (pure): degrees, scales, frame units, opacity. */
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

/**
 * How the art covers a card cw x ch css px with room to pan (pad each side): css px per frame unit, and the frame's
 * top-left, the face focus centred across and ~30% down, clamped so the frame always covers. The same rule as the CSS
 * (styles/landing.css .cart--rig .rig__box). Pure.
 */
export function coverOf(rig: Pick<Rig, "size" | "focus">, cw: number, ch: number, pad = 14): { s: number; left: number; top: number } {
  const [W, H] = rig.size;
  const [fx, fy] = rig.focus ?? [W / 2, H * 0.3];
  const s = Math.max((cw + pad * 2) / W, (ch + pad * 2) / H);
  const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(v, hi));
  return { s, left: clamp(cw / 2 - fx * s, cw + pad - W * s, -pad), top: clamp(ch * 0.3 - fy * s, ch + pad - H * s, -pad) };
}

interface Part { rig: RigPartV2; img: HTMLCanvasElement }

export function initCardRigs(reduced: MediaQueryList, fine: MediaQueryList): void {
  if (document.documentElement.dataset.cardfinish !== "pixel") return; // vector: CSS plays the layers
  const arts = Array.from(document.querySelectorAll<HTMLElement>(".cart--rig[data-rig]"));
  if (!arts.length || typeof IntersectionObserver !== "function") return;
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      io.unobserve(e.target);
      const el = e.target as HTMLElement;
      void buildPixel(el).catch((err: unknown) => console.warn("[site] card rig", el.dataset.rig, err));
    }
  }, { rootMargin: "50% 0px" });
  arts.forEach((a) => io.observe(a));

  // the pixel finish: one canvas on the site's grid, composited on twos while on screen
  async function buildPixel(art: HTMLElement): Promise<void> {
    const rig = normaliseRig(await fetch(`${art.dataset.rig}rig.json`).then((r) => r.json()));
    if (!rig) throw new Error("not a v2 rig");
    const imgs = Array.from(art.querySelectorAll<HTMLImageElement>(".rig__p"));
    // (the page's own layers: wake the lazy ones and wait for them)
    await Promise.all(imgs.map((im) => { im.loading = "eager"; return im.decode().catch(() => undefined); }));
    const K = 2; // css px an art px
    const r = art.getBoundingClientRect();
    const cw = r.width, ch = r.height;
    const cov = coverOf(rig, cw, ch, cw * 0.06); // (6% pan room, as styles/pcard.css .rig__box)
    const s = cov.s / K; // art px per frame unit
    const parts: Part[] = [];
    for (const part of rig.parts) {
      const im = imgs.find((i) => i.dataset.part === part.id);
      if (!im || !im.naturalWidth) continue;
      const [, , w, h] = part.box;
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(w * s));
      c.height = Math.max(1, Math.round(h * s));
      const g = c.getContext("2d", { willReadFrequently: true })!;
      // down to the grid smoothly (pixel art stand-ins nearest), then every pixel either there or not
      g.imageSmoothingEnabled = !rig.pixelated;
      g.drawImage(im, 0, 0, c.width, c.height);
      const data = g.getImageData(0, 0, c.width, c.height);
      const d = data.data;
      for (let i = 3; i < d.length; i += 4) d[i] = d[i]! >= 128 ? 255 : 0;
      g.putImageData(data, 0, 0);
      parts.push({ rig: part, img: c });
    }
    const cv = document.createElement("canvas");
    cv.className = "rig__px";
    cv.width = Math.ceil(cw / K);
    cv.height = Math.ceil(ch / K);
    const ctx = cv.getContext("2d")!;
    art.prepend(cv);
    art.setAttribute("data-rigged", "pixel");
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
    const ox = cov.left / K, oy = cov.top / K;
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
      const plan = parts.map((p) => {
        const pz = still ? { rot: 0, sx: 1, sy: 1, dx: 0, dy: 0, alpha: 1 } : pose(p.rig.motion, t);
        const depth = p.rig.depth ?? 0.5;
        const [x, y, w, h] = p.rig.box;
        const pv = p.rig.pivot ?? [x + w / 2, y + h / 2];
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
        const [x, y] = q.p.rig.box;
        ctx.save();
        ctx.globalAlpha = q.alpha;
        // whole art px for every move, so the pixels stay on the grid
        ctx.translate(q.x, q.y);
        if (q.rot) ctx.rotate((q.rot * Math.PI) / 180);
        if (q.sx !== 1 || q.sy !== 1) ctx.scale(q.sx, q.sy);
        ctx.drawImage(q.p.img, Math.round((x - q.pv[0]) * s), Math.round((y - q.pv[1]) * s));
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
}

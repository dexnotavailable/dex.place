// The home page under a fine pointer (lanes/motion/DESIGN-1019.md 4.2; site loop v2 round 1: "the world ignores the
// cursor", "none of the site keys has a magnet"). Part of the choreo chunk; never on touch screens, never with reduced
// motion (the chunk is then never loaded).
// - the pointer, smoothed (quickTo 1.1 s power3.out) to -1..1 across the screen: motion/choreo.ts's ticker shifts each
//   band's world against it in whole art pixels and its shades the other way (the light follows the cursor).
// - one magnet for the site's keys: within the key's box + 24 px it pulls toward the pointer (<= 6 px), its label 3 px
//   further; let go, it springs back a little past its place. It writes the CSS `translate` (never the transform, so the
//   pixel pop's hover lift and press sink still play over it). The keys' boxes are read at most once a second as page
//   coordinates; the key under the pointer is read live.
// - the sleepy blobs wake as the pointer comes within 80 px (a hop and a "!", styles/choreo.css .is-awake), and doze
//   off again a moment after it leaves.

import { gsap } from "gsap";
import { pull } from "./choreo-plan.ts";

/** The keys that pull (the cards' own keys are lane K's; the header's sit still under the nav's indicator). */
const KEYS = ".btn, .pick, .ftr__chip, .ftr__nav a, .ftr__kofi, .ftr__mark";
const ZONE = 24;

interface Key {
  el: HTMLElement;
  label: HTMLElement | null;
  /** page box without our pull: left, top, right, bottom */
  l: number; t: number; r: number; b: number;
  x: number; y: number; vx: number; vy: number; tx: number; ty: number;
}

export interface Pointer {
  /** -1..1 across / down the screen, smoothed; 0 at the centre and before the pointer is seen */
  x: number;
  y: number;
  /** keys measured again (their content moved: a band landed, the layout changed) */
  dirty(): void;
  destroy(): void;
}

export function initPointer(root: ParentNode): Pointer {
  const P = { x: 0, y: 0 };
  const toX = gsap.quickTo(P, "x", { duration: 1.1, ease: "power3.out" });
  const toY = gsap.quickTo(P, "y", { duration: 1.1, ease: "power3.out" });
  const keys: Key[] = Array.from(root.querySelectorAll<HTMLElement>(KEYS))
    .filter((el) => !el.closest(".pcard, dialog, [popover], .hdr"))
    .map((el) => ({
      el, label: el.querySelector<HTMLElement>(":scope > .btn__label, :scope > span:not([class])"),
      l: 0, t: 0, r: 0, b: 0, x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0,
    }));
  const sleepy = Array.from(root.querySelectorAll<HTMLElement>(".ftr__sleepy, .dlp__zz")).map((el) => ({ el, l: 0, t: 0, r: 0, b: 0, doze: 0 }));
  let measured = -1e9;
  const measure = (): void => {
    const sx = scrollX, sy = scrollY;
    for (const k of keys) {
      const r = k.el.getBoundingClientRect();
      k.l = r.left + sx - k.x; k.t = r.top + sy - k.y; k.r = r.right + sx - k.x; k.b = r.bottom + sy - k.y;
    }
    for (const z of sleepy) {
      const r = z.el.getBoundingClientRect();
      z.l = r.left + sx; z.t = r.top + sy; z.r = r.right + sx; z.b = r.bottom + sy;
    }
    measured = performance.now();
  };

  let px = NaN, py = NaN, raf = 0, hot: Key | null = null, running = false;
  const moving = new Set<Key>();
  const write = (k: Key): void => {
    k.el.style.translate = k.x || k.y ? `${k.x.toFixed(2)}px ${k.y.toFixed(2)}px` : "";
    if (k.label) k.label.style.translate = k.x || k.y ? `${(k.x * 0.5).toFixed(2)}px ${(k.y * 0.5).toFixed(2)}px` : "";
  };
  // a spring per key: pulled, critically damped (~0.4 s); let go, a little under (it lands a little past, back.out-like)
  const step = (_t: number, dt: number): void => {
    const s = Math.min(dt, 48) / 1000;
    for (const k of moving) {
      const on = k === hot;
      const K = on ? 160 : 230, D = on ? 25 : 14;
      k.vx += ((k.tx - k.x) * K - k.vx * D) * s;
      k.vy += ((k.ty - k.y) * K - k.vy * D) * s;
      k.x += k.vx * s;
      k.y += k.vy * s;
      if (Math.abs(k.tx - k.x) < 0.05 && Math.abs(k.ty - k.y) < 0.05 && Math.abs(k.vx) + Math.abs(k.vy) < 0.1) {
        k.x = k.tx; k.y = k.ty; k.vx = k.vy = 0;
        moving.delete(k);
      }
      write(k);
    }
    if (!moving.size && running) { gsap.ticker.remove(step); running = false; }
  };
  const frame = (): void => {
    raf = 0;
    if (Number.isNaN(px)) return;
    const now = performance.now();
    if (now - measured > 1000) measure();
    const gx = px + scrollX, gy = py + scrollY;
    let best: Key | null = null;
    for (const k of keys) {
      if (gx > k.l - ZONE && gx < k.r + ZONE && gy > k.t - ZONE && gy < k.b + ZONE) { best = k; break; }
    }
    for (const z of sleepy) {
      const near = gx > z.l - 80 && gx < z.r + 80 && gy > z.t - 80 && gy < z.b + 80;
      if (near) { clearTimeout(z.doze); z.doze = 0; z.el.classList.add("is-awake"); }
      else if (!z.doze && z.el.classList.contains("is-awake")) z.doze = window.setTimeout(() => { z.doze = 0; z.el.classList.remove("is-awake"); }, 900);
    }
    if (hot && hot !== best) { hot.tx = hot.ty = 0; moving.add(hot); }
    hot = best;
    if (best) {
      // the key under the pointer, read live (a band's drift may have moved it since its box was read)
      const r = best.el.getBoundingClientRect();
      [best.tx, best.ty] = pull(px - (r.left + r.right) / 2 + best.x, py - (r.top + r.bottom) / 2 + best.y);
      moving.add(best);
    }
    if (moving.size && !running) { gsap.ticker.add(step); running = true; }
  };
  const queue = (): void => { if (!raf) raf = requestAnimationFrame(frame); };
  const onMove = (e: PointerEvent): void => {
    if (e.pointerType !== "mouse") return;
    px = e.clientX; py = e.clientY;
    toX((px / innerWidth) * 2 - 1);
    toY((py / innerHeight) * 2 - 1);
    queue();
  };
  const onLeave = (): void => { px = py = NaN; toX(0); toY(0); if (hot) { hot.tx = hot.ty = 0; moving.add(hot); hot = null; if (!running) { gsap.ticker.add(step); running = true; } } };
  document.addEventListener("pointermove", onMove, { passive: true });
  document.documentElement.addEventListener("pointerleave", onLeave);
  // the page moves under a resting pointer: the key under it may change
  addEventListener("scroll", queue, { passive: true });
  return {
    get x() { return P.x; },
    get y() { return P.y; },
    dirty: () => { measured = -1e9; },
    destroy: () => {
      document.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      removeEventListener("scroll", queue);
      cancelAnimationFrame(raf);
      if (running) gsap.ticker.remove(step);
      for (const k of keys) { k.x = k.y = 0; write(k); }
      for (const z of sleepy) { clearTimeout(z.doze); z.el.classList.remove("is-awake"); }
    },
  };
}

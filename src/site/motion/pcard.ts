// The project cards' motion (lane K, lanes\motion\DESIGN-1019.md 5.5-5.7 and the contract in 7.3). Lane G calls
// initCards on the home page (its choreography decides when the entrance plays); main.ts's "cards" step calls it on
// pages without that choreography. K never imports G, and never uses ScrollTrigger (the touch tilt is CSS).
//
// Who moves what (one owner per property):
//   .pcard__in     GSAP: the entrance (x, y, rotation, autoAlpha) and the scroll-speed skew (skewY)
//   .pcard__tilt   this file's pointer loop (fine pointers: tilt + lift, an inline transform); touch: a CSS view timeline
//   .pcard__float  CSS: the idle float and micro-tilt (translate, rotate), the press (scale)
//   .rig__l        GSAP: the entrance's depth settle (transform); the pointer loop: depth parallax (translate)
//   .cart__num     GSAP: the entrance's counter-motion (transform); the pointer loop: its parallax (translate)
//   .pcard__pop    GSAP: the entrance (transform, autoAlpha); the pointer loop: the rise on hover (translate)
//   .cart__glare   the pointer loop (translate, opacity)
//   .cart__shine   CSS idle turns + hover sweep; the entrance's sweep through the Web Animations API
// The idle loops are CSS (compositor); this file only pauses them off screen (.is-off) and while G says so (live).

import { gsap } from "gsap";

export interface CardHost {
  /** prefers-reduced-motion: reduce */
  reduced: boolean;
  /** (hover: hover) and (pointer: fine) */
  fine: boolean;
  /** G: smoothed scroll speed n, -1..1, 0 at rest (DESIGN-1019 4.3); K reads it in gsap.ticker. */
  velocity?: () => number;
}

export interface CardDeck {
  /** Pre-entrance pose for every card (hidden). G calls it in the same tick it creates the trigger, and only when
   *  the deck is wholly below the fold. No-op under reduced motion. */
  prime(): void;
  /** A paused timeline of the entrance (5.5). side: where the cards come from. index: one card only (phones);
   *  without it, all three with K's stagger. Empty timeline under reduced motion. */
  entrance(o: { side: "l" | "r"; index?: number }): gsap.core.Timeline;
  /** The landed pose now, no motion (deep links, bands already passed, focus inside, the watchdog). */
  settle(): void;
  /** Back to the primed pose (the band dropped wholly below the viewport again). */
  reset(): void;
  /** Idle loops and rig life on or off (G: band visibility). K also pauses itself off screen. */
  live(on: boolean): void;
  destroy(): void;
}

interface Card {
  li: HTMLElement;
  inn: HTMLElement;
  tilt: HTMLElement;
  float: HTMLElement;
  art: HTMLElement[];
  layers: { el: HTMLElement; z: number }[];
  num: HTMLElement | null;
  pop: HTMLElement | null;
  chrome: HTMLElement[];
  chars: HTMLElement[];
  rest: HTMLElement[];
  ground: HTMLElement | null;
  shine: HTMLElement | null;
  glare: HTMLElement | null;
  main: HTMLElement | null;
  // pointer state: targets and current values (tilt in -1..1, lift 0..1, glare 0..1)
  tx: number; ty: number; tl: number; tg: number;
  cx: number; cy: number; cl: number; cg: number;
  mx: number; my: number; // the CTA magnet, px
  hover: boolean;
  focus: boolean;
  rect: DOMRect | null;
  w: number; // card width (css px), cached
  skew: number;
  // the line art (lines.svg), once loaded: one svg per rig part, above the colour, and the paper under it all
  lines: { svg: SVGSVGElement; z: number; part: string; paths: SVGPathElement[][] }[];
  paper: HTMLElement | null;
  scrim: HTMLElement | null;
  numAlpha: number;
}

const decks = new WeakMap<HTMLElement, { deck: CardDeck; host: CardHost; wake: () => void }>();
const LANDED = { x: 0, y: 0, rotation: 0, autoAlpha: 1 };

/** The name's characters in a mask, built once (the link keeps its text for screen readers in .pcard__sr). */
function splitName(link: HTMLElement | null): HTMLElement[] {
  if (!link) return [];
  const done = link.querySelector<HTMLElement>(".pcard__nm");
  if (done) return Array.from(done.children) as HTMLElement[];
  const text = link.textContent ?? "";
  const nm = document.createElement("span");
  nm.className = "pcard__nm";
  nm.setAttribute("aria-hidden", "true");
  for (const ch of text) {
    const s = document.createElement("span");
    s.className = "pcard__ch";
    s.textContent = ch;
    nm.append(s);
  }
  const sr = document.createElement("span");
  sr.className = "pcard__sr";
  sr.textContent = text;
  link.replaceChildren(nm, sr);
  return Array.from(nm.children) as HTMLElement[];
}

function cardOf(li: HTMLElement, motion: boolean): Card | null {
  const q = <T extends HTMLElement>(s: string): T | null => li.querySelector<T>(s);
  const inn = q(".pcard__in"), tilt = q(".pcard__tilt"), float = q(".pcard__float");
  if (!inn || !tilt || !float) return null;
  const pop = q(".pcard__pop");
  return {
    li, inn, tilt, float, pop,
    art: [q(".cart .cart__art"), pop?.querySelector<HTMLElement>(".cart__art") ?? null].filter(Boolean) as HTMLElement[],
    layers: Array.from(li.querySelectorAll<HTMLElement>(".cart .rig__l")).map((el) => ({ el, z: Number(el.dataset.z ?? 0.5) || 0 })),
    num: q(".cart__num"),
    chrome: [q(".pcard__no"), q(".pcard__plat"), q(".pcard__cap"), q(".pcard__brackets")].filter(Boolean) as HTMLElement[],
    chars: motion ? splitName(q(".pcard__link")) : [],
    rest: [q(".pcard__state"), q(".pcard__line"), q(".pcard__acts")].filter(Boolean) as HTMLElement[],
    ground: q(".pcard__ground"),
    shine: q(".cart__shine"),
    glare: q(".cart__glare"),
    main: q(".pcard__main"),
    tx: 0, ty: 0, tl: 0, tg: 0, cx: 0, cy: 0, cl: 0, cg: 0, mx: 0, my: 0,
    hover: false, focus: false, rect: null, w: 460, skew: 0,
    lines: [], paper: null, scrim: q(".cart__scrim"), numAlpha: 0.45,
  };
}

/** One shine sweep (Web Animations: above the CSS idle turns, on the compositor). */
function sweep(c: Card, ms: number): void {
  const pixel = document.documentElement.dataset.cardfinish === "pixel";
  c.shine?.animate([{ transform: "translateX(-100%)" }, { transform: "translateX(100%)" }], {
    duration: ms, easing: pixel ? "steps(12, end)" : "cubic-bezier(.45, 0, .55, 1)",
  });
}

const SVG = "http://www.w3.org/2000/svg";
/** Stroke widths by stage (silhouette, big forms, details), in parts of the frame's width. */
const STROKE = [0.0045, 0.003, 0.002];

/**
 * The card's line art (DESIGN-1019 addendum, Dex 10-19: "the lineart gets drawn, then the colors fill in, then
 * parallax"): <rig>/lines.svg, format in lanes\cards\NOTEBOOK.md. Each `g[data-part]` becomes its own svg in a line
 * box above the colour (so it can ride its part's depth), every path drawn by a normalised dash (pathLength 1).
 */
async function loadLines(c: Card): Promise<void> {
  const cart = c.li.querySelector<HTMLElement>(".cart[data-rig][data-lines]");
  const art = c.li.querySelector<HTMLElement>(".cart .cart__art");
  // (the pixel finish draws its parts in a canvas: its cards keep the entrance without line art)
  if (!cart || !art || c.lines.length || document.documentElement.dataset.cardfinish === "pixel") return;
  const res = await fetch(`${cart.dataset.rig}lines.svg`);
  if (!res.ok) return;
  const doc = new DOMParser().parseFromString(await res.text(), "image/svg+xml");
  const root = doc.documentElement;
  const vb = root.getAttribute("viewBox");
  if (root.nodeName !== "svg" || !vb) return;
  const W = Number(vb.split(/[\s,]+/)[2]) || 1;
  const box = document.createElement("div");
  box.className = "rig__box rig__lines";
  for (const g of Array.from(root.querySelectorAll("g[data-part]"))) {
    const part = g.getAttribute("data-part") ?? "";
    const layer = c.layers.find((l) => l.el.querySelector(`.rig__p[data-part="${CSS.escape(part)}"]`));
    const svg = document.createElementNS(SVG, "svg");
    svg.setAttribute("class", "rig__ln");
    svg.setAttribute("viewBox", vb);
    svg.setAttribute("preserveAspectRatio", "none");
    const paths: SVGPathElement[][] = [[], [], []];
    for (const src of Array.from(g.querySelectorAll("path"))) {
      const p = document.createElementNS(SVG, "path");
      const st = Math.min(3, Math.max(1, Number(src.getAttribute("data-stage")) || 3));
      p.setAttribute("d", src.getAttribute("d") ?? "");
      p.setAttribute("pathLength", "1");
      p.setAttribute("stroke-width", String(+(W * STROKE[st - 1]!).toFixed(3)));
      svg.append(p);
      paths[st - 1]!.push(p);
    }
    box.append(svg);
    c.lines.push({ svg, z: layer?.z ?? 0, part, paths });
  }
  const paper = document.createElement("span");
  paper.className = "cart__paper";
  art.prepend(paper);
  art.append(box);
  c.paper = paper;
}

/** list = the ul[data-pcards]. Without a host.velocity (deep pages), there is no skew. */
export function initCards(list: HTMLElement, given: CardHost): CardDeck {
  const known = decks.get(list);
  const host: CardHost = { ...given };
  if (known) {
    // (a second caller, e.g. the choreography after main.ts's step: the same deck, with the scroll speed now)
    if (given.velocity) { known.host.velocity = host.velocity; known.wake(); }
    return known.deck;
  }
  const motion = !host.reduced;
  const cards = Array.from(list.querySelectorAll<HTMLElement>(":scope > .pcards__it"))
    .map((li) => cardOf(li, motion))
    .filter((c): c is Card => !!c);
  const phone = matchMedia("(max-width: 699px)");
  // (the numeral's resting opacity, from the stylesheet, read once)
  for (const c of cards) if (c.num) c.numAlpha = Number(getComputedStyle(c.num).opacity) || c.numAlpha;
  const running = new Set<gsap.core.Timeline>();
  const cleanup: (() => void)[] = [];
  let liveOn = true;
  const seen = new Map<Card, boolean>();
  const paint = (c: Card): void => { c.inn.classList.toggle("is-off", !(liveOn && (seen.get(c) ?? true))); };

  // ---- the art arrives before the cards do: when the list is within 1.5 screens, card 1 first
  if ("IntersectionObserver" in window) {
    const near = new IntersectionObserver((es) => {
      if (!es.some((e) => e.isIntersecting)) return;
      near.disconnect();
      for (const c of cards) for (const im of c.li.querySelectorAll<HTMLImageElement>("img[loading=lazy]")) im.loading = "eager";
      // the line art for the entrance, card 1 first (none: the entrance without it)
      if (motion) void cards.reduce((p, c) => p.then(() => loadLines(c)).catch(() => undefined), Promise.resolve());
    }, { rootMargin: "150% 0px" });
    near.observe(list);
    cleanup.push(() => near.disconnect());
    // off screen: the idle loops and the rig life pause
    const vis = new IntersectionObserver((es) => {
      for (const e of es) {
        const c = cards.find((k) => k.li === e.target);
        if (c) { seen.set(c, e.isIntersecting); paint(c); }
      }
    }, { rootMargin: "10% 0px" });
    for (const c of cards) vis.observe(c.li);
    cleanup.push(() => vis.disconnect());
  }

  // the card's width, for the depth parallax (scaled to a 460 px card); measured on resize, never in the ticker
  if ("ResizeObserver" in window) {
    const ro = new ResizeObserver(() => { for (const c of cards) c.w = c.inn.offsetWidth || c.w; });
    ro.observe(list);
    cleanup.push(() => ro.disconnect());
  }

  // ---- pointer: tilt, lift, glare, depth, the CTA magnet (fine pointers only)
  let ticking = false;
  const tick = (_t: number, dt: number): void => {
    const k = (tau: number): number => 1 - Math.exp(-dt / 1000 / tau);
    const v = host.velocity ? Math.max(-1, Math.min(1, host.velocity())) : 0;
    let busy = false;
    for (const c of cards) {
      if (c.inn.classList.contains("is-off")) continue;
      // the scroll-speed skew (G's n), on .pcard__in through GSAP's own transform cache
      const sk = Math.round(v * (phone.matches ? 2 : 3) * 100) / 100;
      if (sk !== c.skew) { c.skew = sk; gsap.set(c.inn, { skewY: sk }); }
      if (!host.fine) continue;
      // hover follows quickly (~0.6 s to land), leaving eases home a little slower (~0.9 s)
      const f = k(c.hover || c.focus ? 0.12 : 0.18);
      c.cx += (c.tx - c.cx) * f; c.cy += (c.ty - c.cy) * f; c.cl += (c.tl - c.cl) * f;
      c.cg += (c.tg - c.cg) * k(0.06);
      const moving = Math.abs(c.tx - c.cx) + Math.abs(c.ty - c.cy) + Math.abs(c.tl - c.cl) + Math.abs(c.tg - c.cg) > 0.002;
      if (!moving && !c.hover && !c.focus && c.cl < 0.002 && Math.abs(c.cx) < 0.002 && Math.abs(c.cy) < 0.002) {
        if (c.tilt.style.transform) {
          c.tilt.style.transform = "";
          for (const l of c.layers) l.el.style.translate = "";
          if (c.num) c.num.style.translate = "";
          if (c.pop) c.pop.style.translate = "";
          if (c.glare) c.glare.style.opacity = "";
          if (c.main) c.main.style.translate = "";
        }
        continue;
      }
      busy = true;
      c.tilt.style.transform =
        `translateZ(${(c.cl * 30).toFixed(2)}px) rotateX(${(-c.cy * 6).toFixed(3)}deg) rotateY(${(c.cx * 9).toFixed(3)}deg)`;
      // the parts shift against the tilt by their depth (22 px at depth 1 on a 460 px card), the numeral +-10 px
      const s = (c.w / 460) * 22;
      for (const l of c.layers) {
        if (!l.z) continue;
        l.el.style.translate = `${(-c.cx * l.z * s).toFixed(2)}px ${(-c.cy * l.z * s * 0.6).toFixed(2)}px`;
      }
      if (c.num) c.num.style.translate = `${(c.cx * 10).toFixed(2)}px ${(c.cy * 6).toFixed(2)}px`;
      if (c.pop) c.pop.style.translate = `${(-c.cx * s).toFixed(2)}px ${(-8 * c.cl - c.cy * s * 0.6).toFixed(2)}px`;
      if (c.glare) {
        c.glare.style.opacity = c.cg.toFixed(3);
        c.glare.style.translate = `${(c.cx * 25).toFixed(2)}% ${(c.cy * 25).toFixed(2)}%`;
      }
      if (c.main) c.main.style.translate = `${c.mx.toFixed(2)}px ${c.my.toFixed(2)}px`;
    }
    if (!busy && !host.velocity && ticking) { gsap.ticker.remove(tick); ticking = false; }
  };
  const wake = (): void => { if (!ticking) { gsap.ticker.add(tick); ticking = true; } };
  if (motion && host.velocity) wake();

  if (motion && host.fine) {
    for (const c of cards) {
      const on = (e: PointerEvent): void => {
        if (e.pointerType !== "mouse") return;
        const r = c.li.getBoundingClientRect();
        c.rect = r;
        c.hover = true;
        c.tx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
        c.ty = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1));
        c.tl = 1;
        c.tg = 1;
        // the CTA pulls toward the pointer, up to 6 px, within its box + 24 px
        if (c.main) {
          const b = c.main.getBoundingClientRect();
          const dx = e.clientX - (b.left + b.width / 2), dy = e.clientY - (b.top + b.height / 2);
          const inX = Math.abs(dx) < b.width / 2 + 24, inY = Math.abs(dy) < b.height / 2 + 24;
          c.mx = inX && inY ? Math.max(-6, Math.min(6, (dx / (b.width / 2 + 24)) * 6)) : 0;
          c.my = inX && inY ? Math.max(-6, Math.min(6, (dy / (b.height / 2 + 24)) * 6)) : 0;
        }
        wake();
      };
      const off = (): void => {
        c.hover = false;
        c.tx = 0; c.ty = 0; c.mx = 0; c.my = 0;
        c.tl = c.focus ? 1 : 0;
        c.tg = 0;
        wake();
      };
      // keyboard focus: the lift (no tilt); the plate and the name's bar are CSS
      const fin = (): void => {
        c.focus = !!c.float.querySelector(":focus-visible");
        if (c.focus) { c.tl = 1; wake(); }
      };
      const fout = (): void => { c.focus = false; if (!c.hover) { c.tl = 0; wake(); } };
      c.float.addEventListener("pointermove", on);
      c.float.addEventListener("pointerleave", off);
      c.float.addEventListener("focusin", fin);
      c.float.addEventListener("focusout", fout);
      cleanup.push(() => {
        c.float.removeEventListener("pointermove", on);
        c.float.removeEventListener("pointerleave", off);
        c.float.removeEventListener("focusin", fin);
        c.float.removeEventListener("focusout", fout);
      });
    }
  }

  // ---- the entrance (5.5)
  const inner = (c: Card): Element[] =>
    [...c.art, ...c.layers.map((l) => l.el), c.num, c.pop, ...c.chrome, ...c.chars, ...c.rest, c.ground, c.paper, c.scrim,
      ...c.lines.map((l) => l.svg)].filter(Boolean) as Element[];

  function settle(): void {
    for (const tl of running) tl.kill();
    running.clear();
    if (!motion) return;
    for (const c of cards) {
      gsap.set(c.inn, LANDED);
      gsap.set(inner(c), { clearProps: "transform,opacity,visibility" });
    }
  }

  function prime(): void {
    if (!motion) return;
    for (const tl of running) tl.kill();
    running.clear();
    for (const c of cards) {
      gsap.set(c.inn, { autoAlpha: 0 });
      if (c.ground) gsap.set(c.ground, { autoAlpha: 0 });
    }
  }

  function entrance(o: { side: "l" | "r"; index?: number }): gsap.core.Timeline {
    const tl = gsap.timeline({ paused: true, onComplete: () => { running.delete(tl); } });
    if (!motion) return tl;
    running.add(tl);
    const s = o.side === "r" ? 1 : -1;
    const one = o.index !== undefined;
    const D = phone.matches ? 0.8 : 1;
    const vw = innerWidth;
    const these = one ? cards.filter((_, i) => i === o.index) : cards;
    // every card in this call hidden from the first frame (the later ones wait their stagger out of sight)
    tl.set(these.map((c) => c.inn), { autoAlpha: 0, immediateRender: false }, 0);
    // a from-state is set at the first frame and tweened home at its own offset (nothing shows landed, then jumps)
    const ft = (t: gsap.TweenTarget, from: gsap.TweenVars, to: gsap.TweenVars, at: number): void => {
      tl.set(t, { ...from, immediateRender: false }, 0);
      tl.fromTo(t, from, { ...to, immediateRender: false }, at);
    };
    these.forEach((c, i) => {
      const at = one ? 0 : i * 0.11;
      ft(c.inn, one ? { x: s * 0.6 * vw, y: 0, rotation: s * 4 } : { x: s * 0.24 * vw, y: 48, rotation: s * 4 },
        { x: 0, y: 0, rotation: 0, duration: one ? 0.9 : 1.1 * D, ease: "expo.out" }, at);
      tl.to(c.inn, { autoAlpha: 1, duration: 0.3, ease: "none" }, at);
      if (c.ground) ft(c.ground, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.7 * D, ease: "power2.out" }, at + 0.35 * D);
      if (c.lines.length) drawn(c, at); else plain(c, at);
    });

    // (no line art yet: the card's parts settle by depth as it lands, 5.5)
    function plain(c: Card, at: number): void {
      if (c.art.length) ft(c.art, { scale: one ? 1.15 : 1.2 }, { scale: 1, duration: one ? 1.2 : 1.4 * D, ease: "expo.out" }, at);
      // the background settles first, the character lands last
      for (const l of c.layers) {
        if (l.z) ft(l.el, { x: s * l.z * 48 }, { x: 0, duration: 1.3 * D, ease: "expo.out" }, at);
      }
      if (c.num) ft(c.num, { x: -s * 80 }, { x: 0, duration: 1.3 * D, ease: "expo.out" }, at);
      if (c.chrome.length) ft(c.chrome, { y: -12, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.4 * D, ease: "power3.out", stagger: 0.04 }, at + 0.45 * D);
      if (c.chars.length) ft(c.chars, { yPercent: 110 }, { yPercent: 0, duration: 0.65 * D, ease: "expo.out", stagger: 0.018 }, at + 0.55 * D);
      if (c.rest.length) ft(c.rest, { y: 24, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.6 * D, ease: "expo.out", stagger: 0.06 }, at + 0.6 * D);
      if (c.pop) ft(c.pop, { y: 16, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.6 * D, ease: "back.out(1.6)" }, at + 0.7 * D);
      tl.call(() => sweep(c, 1100 * D), undefined, at + 0.9 * D);
    }

    // the addendum (Dex 10-19): 1. the line art draws on paper, silhouette -> big forms -> details; 2. the colour fills
    // in under it part by part, back to front, each part's lines settling away; 3. the parts settle out of their
    // depth offsets into place, then the idle and pointer parallax take over
    function drawn(c: Card, at: number): void {
      const depth = (z: number): number => s * z * 28;
      if (c.art.length) ft(c.art, { scale: 1.08 }, { scale: 1, duration: 1.8 * D, ease: "expo.out" }, at);
      if (c.paper) ft(c.paper, { autoAlpha: 1 }, { autoAlpha: 1, duration: 0.01 }, at);
      if (c.scrim) ft(c.scrim, { autoAlpha: 0 }, { autoAlpha: 0, duration: 0.01 }, at);
      tl.set(c.lines.map((l) => l.svg), { autoAlpha: 1, immediateRender: false }, 0);
      for (const l of c.lines) tl.set(l.svg, { x: depth(l.z), immediateRender: false }, 0);
      for (const l of c.layers) tl.set(l.el, { autoAlpha: 0, x: depth(l.z), immediateRender: false }, 0);
      if (c.num) tl.set(c.num, { autoAlpha: 0, x: -s * 60, immediateRender: false }, 0);
      // 1. the lines, stage by stage (each stage's paths in the file's order)
      const T1 = [0.1, 0.45, 0.8], DUR = [0.5, 0.45, 0.4], SPREAD = [0.25, 0.3, 0.3];
      for (let st = 0; st < 3; st++) {
        const paths = c.lines.flatMap((l) => l.paths[st] ?? []);
        if (!paths.length) continue;
        ft(paths, { strokeDashoffset: 1.05 }, {
          strokeDashoffset: 0, duration: DUR[st]! * D, ease: "power1.inOut", stagger: { amount: SPREAD[st]! * D },
        }, at + T1[st]! * D);
      }
      // 2. the colour, back to front; the numeral in its place among the parts
      const t0 = at + 1.05 * D, step = 0.1 * D;
      if (c.paper) tl.to(c.paper, { autoAlpha: 0, duration: 0.5 * D, ease: "power1.out" }, t0 + 0.1 * D);
      if (c.scrim) tl.to(c.scrim, { autoAlpha: 1, duration: 0.6 * D, ease: "power1.out" }, t0 + 0.2 * D);
      const numAt = c.num ? c.layers.findIndex((l) => c.num!.compareDocumentPosition(l.el) & Node.DOCUMENT_POSITION_FOLLOWING) : -1;
      c.layers.forEach((l, j) => {
        const when = t0 + (j + (numAt >= 0 && j >= numAt ? 1 : 0)) * step;
        tl.to(l.el, { autoAlpha: 1, duration: 0.45 * D, ease: "power2.out" }, when);
        const ln = c.lines.find((k) => l.el.querySelector(`.rig__p[data-part="${CSS.escape(k.part)}"]`));
        if (ln) tl.to(ln.svg, { autoAlpha: 0, duration: 0.6 * D, ease: "power1.out" }, when + 0.25 * D);
      });
      if (c.num) tl.to(c.num, { autoAlpha: c.numAlpha, x: 0, duration: 0.9 * D, ease: "expo.out" }, t0 + Math.max(0, numAt) * step);
      // 3. the parallax: every part (and its lines) out of its depth offset into place
      const t3 = t0 + (c.layers.length + 1) * step + 0.1 * D;
      const moving = [...c.layers.filter((l) => l.z).map((l) => l.el), ...c.lines.filter((l) => l.z).map((l) => l.svg)];
      if (moving.length) tl.to(moving, { x: 0, duration: 1.1 * D, ease: "expo.out" }, t3);
      // the card's words while the colour comes in
      if (c.chrome.length) ft(c.chrome, { y: -12, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.4 * D, ease: "power3.out", stagger: 0.04 }, at + 0.3 * D);
      if (c.chars.length) ft(c.chars, { yPercent: 110 }, { yPercent: 0, duration: 0.65 * D, ease: "expo.out", stagger: 0.018 }, t0 + 0.35 * D);
      if (c.rest.length) ft(c.rest, { y: 24, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.6 * D, ease: "expo.out", stagger: 0.06 }, t0 + 0.4 * D);
      if (c.pop) ft(c.pop, { y: 16, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.6 * D, ease: "back.out(1.6)" }, t3);
      tl.call(() => sweep(c, 1100 * D), undefined, t3 + 0.3 * D);
    }
    return tl;
  }

  const deck: CardDeck = {
    prime,
    entrance,
    settle,
    reset: prime,
    live(on: boolean) {
      liveOn = on;
      for (const c of cards) paint(c);
    },
    destroy() {
      for (const tl of running) tl.kill();
      running.clear();
      if (ticking) gsap.ticker.remove(tick);
      ticking = false;
      cleanup.splice(0).forEach((f) => f());
      decks.delete(list);
    },
  };
  decks.set(list, { deck, host, wake: () => { if (motion) wake(); } });
  if (new URLSearchParams(location.search).has("cards-debug")) (window as { __deck?: CardDeck }).__deck = deck;
  return deck;
}

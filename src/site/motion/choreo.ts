// The home page's choreography (Dex 10-19: "more aggro ... scrolling down should really give you a premium website";
// built to lanes/motion/DESIGN-1019.md 3 and 4). Own chunk, loaded by main.ts on the home page only (never with reduced
// motion: the page is then simply all there). The world never moves with the scroll; the website does:
// - every band (render/landing.ts homeBand): its strip whips in from its side, latched to the scroll (it follows on
//   the way in, never goes back while you read) and fully in exactly as the change of place under it comes into view;
//   then its head plays; the panel follows from the same side (latched, with a glide); once the panel is most of the way
//   in the content lands in batches as it comes up, and the stitch flies in from the world side; the spine draws; the
//   fore piece rides the scroll a little faster than the paper; leaving, the paper backs off toward its edge (desktop).
//   A band that drops wholly below the screen again is set back, so scrolling down replays it.
// - the cards (lane K's deck, motion/pcard.ts): primed, then their entrance when the projects panel is in.
// - alive: the scroll's speed n (-1..1) leans the strip titles and the fore, and K's cards read it (velocity()).
// - arm time: a band already reached is simply there; a nav jump or focus settles what it passes; a watchdog lands
//   anything left waiting on screen.
// Lenis (the smooth wheel) ships last (phase G3, after lane F's OK): until then only ?smooth=lenis turns it on.

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import {
  CONTENT_GATE, PANEL_START, PHONE_TIME, SPINE_AT, STRIP_START, contentFrom, foreY, isBelow, latch, panelEnd, panelPose,
  speedOf, stitchFrom, stripEnd, stripPose, type Side, type Variant,
} from "./choreo-plan.ts";
import { useSmooth } from "./scroller.ts";

gsap.registerPlugin(ScrollTrigger);

/** Lane F's "a way in starts the game" (motion/enter.ts ENTER_EVENT; named here so this chunk never pulls the opening's
 *  audio in with it; a test keeps the two the same). */
export const WAY_IN_EVENT = "dex:enter";

/** What GSAP leaves on a thing it moved, taken off once it has landed (so the CSS has it back). */
const CLEAR = "transform,opacity,visibility,translate,rotate,scale";

interface Band {
  el: HTMLElement;
  s: Side;
  sp: number;
  pp: number;
  landed: boolean;
  headPlayed: boolean;
  gateOpen: boolean;
  queue: HTMLElement[];
  seenAt: number;
  on: boolean;
  settle(): void;
  reset(): void;
  stripTitle: HTMLElement | null;
  stripPaper: HTMLElement;
  fore: HTMLElement | null;
  foreBase: number;
  lastN: number;
  lastFore: number;
  onGate: (() => void) | null;
}

/** Parts switched off for a visit (diagnosis on a real device: ?choreo-off=tick,drift,fore,refresh,head,content). */
const OFF = new Set((new URLSearchParams(location.search).get("choreo-off") ?? "").split(",").filter(Boolean));

export function initChoreo(fine: MediaQueryList): void {
  const root = document.documentElement;
  const mm = gsap.matchMedia();
  ScrollTrigger.config({ ignoreMobileResize: true });
  mm.add("(prefers-reduced-motion: no-preference)", () => {
    const phone = matchMedia("(max-width: 699px)").matches;
    const desktop = matchMedia("(min-width: 1100px)").matches;
    const T = phone ? PHONE_TIME : 1;
    root.setAttribute("data-choreo", "");
    const lenis = fine.matches && /[?&]smooth=lenis/.test(location.search) ? smoothWheel(root) : null;

    // --- the scroll's speed, n: our own measure each ticker frame (works with Lenis and with native touch scrolling)
    const speed = { n: 0 };
    const toN = gsap.quickTo(speed, "n", { duration: 0.4, ease: "power3.out" });
    let lastY = window.scrollY;
    const bands: Band[] = [];
    const tick = (): void => {
      const y = window.scrollY;
      toN(speedOf(y - lastY));
      lastY = y;
      const n = Math.round(speed.n * 200) / 200;
      for (const b of bands) {
        if (!b.on) continue;
        const fy = b.fore ? Math.round(b.foreBase + n * (phone ? 14 : 28)) : 0;
        if (n === b.lastN && fy === b.lastFore) continue;
        b.lastN = n;
        b.lastFore = fy;
        if (desktop && b.stripTitle && b.headPlayed) gsap.set(b.stripTitle, { x: n * 16 });
        if (desktop && b.sp >= 1) gsap.set(b.stripPaper, { scaleX: 1 + Math.abs(n) * 0.015 });
        if (b.fore) gsap.set(b.fore, { y: fy });
      }
    };
    if (!OFF.has("tick")) gsap.ticker.add(tick);

    for (const el of document.querySelectorAll<HTMLElement>(".band")) {
      if (!el.querySelector(".band__strip")) continue;
      bands.push(band(el, phone, desktop, T));
    }

    // --- the cards (lane K): their deck, primed or settled with their band, played when the projects panel is in
    const list = document.querySelector<HTMLElement>("#projects [data-pcards]");
    const projects = bands.find((b) => b.el.id === "projects");
    let deckGone = false;
    let deck: import("./pcard.ts").CardDeck | null = null;
    if (list && projects) {
      void import("./pcard.ts").then((m) => {
        if (deckGone) return;
        const d = m.initCards(list, { reduced: false, fine: fine.matches, velocity: () => speed.n });
        deck = d;
        const lis = Array.from(list.children) as HTMLElement[];
        if (projects.landed || !isBelow(projects.el.getBoundingClientRect().top, innerHeight)) d.settle();
        else d.prime();
        const play = (): void => {
          if (phone) {
            lis.forEach((li, i) => ScrollTrigger.create({
              trigger: li, start: "clamp(top 88%)", once: true,
              onEnter: () => d.entrance({ side: i % 2 ? "r" : "l", index: i }).play(),
            }));
          } else gsap.delayedCall(0.15, () => d.entrance({ side: "l" }).play());
        };
        if (projects.gateOpen) play();
        else projects.onGate = play;
        const oldReset = projects.reset, oldSettle = projects.settle;
        projects.reset = () => { oldReset(); d.reset(); projects.onGate = play; };
        projects.settle = () => { oldSettle(); d.settle(); };
        ScrollTrigger.create({ trigger: projects.el, start: "top bottom", end: "bottom top", onToggle: (st) => d.live(st.isActive) });
        // the cascade breathes with the scroll (desktop): the second and third cards ride a little
        if (desktop && lis.length >= 3) {
          gsap.fromTo(lis[1]!, { y: 24 }, { y: -24, ease: "none", scrollTrigger: { trigger: projects.el, start: "top bottom", end: "bottom top", scrub: 0.6 } });
          gsap.fromTo(lis[2]!, { y: 48 }, { y: -48, ease: "none", scrollTrigger: { trigger: projects.el, start: "top bottom", end: "bottom top", scrub: 0.6 } });
        }
        ScrollTrigger.refresh();
      }, (error: unknown) => console.error("[site] cards failed", error));
    }

    // --- the header: a scroll progress line across its foot
    const bar = document.querySelector<HTMLElement>(".hdr__progress");
    const sheet = document.querySelector<HTMLElement>(".sheet--home");
    if (bar && sheet) {
      gsap.fromTo(bar, { scaleX: 0 }, { scaleX: 1, ease: "none", scrollTrigger: { trigger: sheet, start: "top top", end: "bottom bottom", scrub: true } });
    }

    // --- a nav jump settles the bands it passes; focus inside a band settles it; a watchdog lands what waits on screen
    const settleBefore = (id: string): void => {
      const i = bands.findIndex((b) => b.el.id === id || b.el.querySelector(`#${CSS.escape(id)}`));
      if (i < 0) return;
      for (const b of bands.slice(0, i + 1)) b.settle();
    };
    const onClick = (e: MouseEvent): void => {
      const a = (e.target as Element | null)?.closest?.<HTMLAnchorElement>("a[href*='#']");
      if (!a) return;
      const url = new URL(a.href, location.href);
      if (url.pathname === location.pathname && url.hash.length > 1) settleBefore(decodeURIComponent(url.hash.slice(1)));
    };
    const onHash = (): void => { if (location.hash.length > 1) settleBefore(decodeURIComponent(location.hash.slice(1))); };
    document.addEventListener("click", onClick, true);
    window.addEventListener("hashchange", onHash);
    const watchdog = window.setInterval(() => {
      const vh = innerHeight, now = performance.now();
      for (const b of bands) {
        if (b.landed) continue;
        const r = b.el.getBoundingClientRect();
        const showing = r.top < vh * 0.6 && r.bottom > vh * 0.2;
        if (!showing) { b.seenAt = 0; continue; }
        if (!b.seenAt) b.seenAt = now;
        else if (now - b.seenAt > 1200 && (b.sp >= 1 || r.top < 0)) b.settle();
      }
    }, 1000);

    // --- triggers measured again when the page's height moves (fonts, the collage, the card art, a way in)
    let t = 0;
    const refresh = (): void => { clearTimeout(t); t = window.setTimeout(() => ScrollTrigger.refresh(), 150); };
    const ro = new ResizeObserver(refresh);
    if (sheet && !OFF.has("refresh")) ro.observe(sheet);
    void document.fonts?.ready.then(refresh);
    document.addEventListener(WAY_IN_EVENT, refresh);

    return () => {
      deckGone = true;
      (deck as import("./pcard.ts").CardDeck | null)?.destroy();
      gsap.ticker.remove(tick);
      clearInterval(watchdog);
      clearTimeout(t);
      ro.disconnect();
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("hashchange", onHash);
      document.removeEventListener(WAY_IN_EVENT, refresh);
      for (const b of bands) b.settle();
      if (lenis) { lenis.destroy(); useSmooth(null); }
      root.removeAttribute("data-choreo");
    };
  });
}

/** One band's choreography (3.1). */
function band(el: HTMLElement, phone: boolean, desktop: boolean, T: number): Band {
  const s: Side = el.classList.contains("band--r") ? 1 : -1;
  const q = <E extends HTMLElement>(sel: string): E | null => el.querySelector<E>(sel);
  const strip = q(".band__strip")!, stripPaper = q(".band__strip-paper")!, stripShade = q(".band__strip-shade")!;
  const panel = q(".band__panel")!, paper = q(".band__paper")!, shade = q(".band__shade")!, spine = q(".band__spine");
  const site = q(".band__site"), fore = q(".band__fore");
  const head = q(".band__in");
  const stitch = q("[data-stitch]");
  const items = Array.from(el.querySelectorAll<HTMLElement>(".band__panel > .wrap > *")).filter((x) => !x.matches("[data-pcards]") && x !== stitch);
  const variant: Variant = el.id === "downloads" ? "side" : "rise";
  const from = contentFrom(variant, s, phone);
  const vw = document.documentElement.clientWidth;

  // the strip's head: the kicker slides in, the title rises, the rule draws from its side, the key follows
  const headTl = gsap.timeline({ paused: true });
  if (head) {
    const kicker = head.querySelector(".sh__kicker"), title = head.querySelector(".sh__title"), rule = head.querySelector(".sh__rule"), more = head.querySelector(".sh__more");
    if (kicker) headTl.from(kicker, { x: -s * 24, autoAlpha: 0, duration: 0.6 * T, ease: "power3.out" }, 0);
    if (title) headTl.from(title, { yPercent: 60, autoAlpha: 0, duration: 0.8 * T, ease: "expo.out" }, 0.06 * T);
    if (rule) headTl.from(rule, { scaleX: 0, transformOrigin: s < 0 ? "0% 50%" : "100% 50%", duration: 0.9 * T, ease: "expo.inOut" }, 0.15 * T);
    if (more) headTl.from(more, { x: -s * 24, autoAlpha: 0, duration: 0.6 * T, ease: "power3.out" }, 0.3 * T);
  }

  // the surfaces get their own layer only while they move (set when set back, cleared once landed)
  const surfaces = [stripPaper, stripShade, paper, shade];
  const lift = (on: boolean): void => { for (const x of surfaces) x.style.willChange = on ? "transform" : ""; };
  const setStrip = (p: number): void => {
    const pose = stripPose(p, s, phone);
    gsap.set(stripPaper, { xPercent: pose.xPercent, skewX: pose.skewX, force3D: true });
    gsap.set(stripShade, { opacity: pose.shade });
  };
  const glide = { duration: (phone ? 0.4 : 0.5), ease: "power3.out" };
  const toPaper = gsap.quickTo(paper, "xPercent", glide);
  const toShadeX = gsap.quickTo(shade, "x", glide);
  const toShadeO = gsap.quickTo(shade, "opacity", glide);
  const setPanel = (p: number, now = false): void => {
    const pose = panelPose(p, s);
    if (now) { gsap.set(paper, { xPercent: pose.xPercent }); gsap.set(shade, { x: pose.shadeX, opacity: pose.shade }); }
    toPaper(pose.xPercent, now ? pose.xPercent : undefined);
    toShadeX(pose.shadeX, now ? pose.shadeX : undefined);
    toShadeO(pose.shade, now ? pose.shade : undefined);
  };

  const b: Band = {
    el, s, sp: 0, pp: 0, landed: false, headPlayed: false, gateOpen: false, queue: [], seenAt: 0, on: false,
    stripTitle: head?.querySelector<HTMLElement>(".sh__title") ?? null, stripPaper, fore, foreBase: 0, lastN: NaN, lastFore: NaN, onGate: null,
    settle: () => {},
    reset: () => {},
  };

  // content lands in batches as it comes up, but only once the panel is in
  const landStitch = (): void => {
    if (stitch && !stitch.dataset.landed) {
      stitch.dataset.landed = "";
      gsap.to(stitch, {
        x: 0, rotation: 0, autoAlpha: 1, duration: 1.1 * T, ease: "expo.out", delay: 0.15,
        onComplete: () => { gsap.set(stitch, { clearProps: CLEAR }); },
      });
    }
  };
  const land = (batch: HTMLElement[]): void => {
    landStitch();
    if (!batch.length) return;
    gsap.to(batch, {
      x: 0, y: 0, scale: 1, autoAlpha: 1, duration: (variant === "side" ? 0.7 : 0.8) * T, ease: "expo.out", stagger: 0.07, overwrite: "auto",
      onComplete: () => { gsap.set(batch, { clearProps: CLEAR }); },
    });
  };
  const openGate = (): void => {
    if (b.gateOpen) return;
    b.gateOpen = true;
    land(b.queue.splice(0));
    b.onGate?.();
    b.onGate = null;
  };

  const prime = (): void => {
    lift(true);
    b.sp = b.pp = 0;
    b.landed = b.headPlayed = b.gateOpen = false;
    setStrip(0);
    setPanel(0, true);
    headTl.pause(0);
    if (spine) gsap.set(spine, { scaleY: 0, transformOrigin: "50% 0%" });
    gsap.set(items, from);
    if (stitch) { delete stitch.dataset.landed; gsap.set(stitch, stitchFrom(s, vw, phone)); }
    b.queue = [];
  };
  b.settle = () => {
    if (b.landed) return;
    lift(false);
    b.landed = b.headPlayed = true;
    b.sp = b.pp = 1;
    setStrip(1);
    setPanel(1, true);
    headTl.progress(1).pause();
    if (spine) gsap.set(spine, { scaleY: 1 });
    gsap.killTweensOf([...items, ...(stitch ? [stitch] : [])]);
    gsap.set([...items, ...(stitch ? [stitch] : [])], { clearProps: CLEAR });
    if (stitch) stitch.dataset.landed = "";
    b.gateOpen = true;
    b.queue = [];
    b.onGate?.();
    b.onGate = null;
  };
  b.reset = () => prime();

  // arm: a band already reached is simply there; one wholly below is set back to play
  if (isBelow(el.getBoundingClientRect().top, innerHeight)) prime();
  else b.settle();

  // the strip (no lag: it must cover the change of place under it, even on a fling)
  ScrollTrigger.create({
    trigger: strip, start: STRIP_START, end: () => stripEnd(strip.offsetHeight),
    onUpdate: (st) => {
      if (b.landed && b.sp >= 1) return;
      const p = latch(b.sp, st.progress);
      if (p === b.sp) return;
      b.sp = p;
      setStrip(p);
      if (p >= 1 && !b.headPlayed) { b.headPlayed = true; headTl.play(); }
    },
  });
  // the panel (latched, with a glide); the gate; the spine
  ScrollTrigger.create({
    trigger: panel, start: PANEL_START, end: panelEnd(phone),
    onUpdate: (st) => {
      if (b.landed && b.pp >= 1) return;
      const p = latch(b.pp, st.progress);
      if (p === b.pp) return;
      b.pp = p;
      setPanel(p);
      if (p >= CONTENT_GATE) openGate();
      if (p >= SPINE_AT && spine && !b.landed) gsap.to(spine, { scaleY: 1, duration: 0.7 * T, ease: "expo.out", overwrite: true });
      if (p >= 1 && b.sp >= 1) {
        b.landed = true;
        gsap.delayedCall(0.6, () => { if (b.landed) lift(false); });
      }
    },
  });
  // content: batches as they come up the screen, queued behind the gate
  if (items.length && !OFF.has("content")) {
    ScrollTrigger.batch(items, {
      start: "clamp(top 88%)", interval: 0.1, batchMax: 6,
      onEnter: (batch) => {
        const list = (batch as HTMLElement[]).filter((x) => gsap.getProperty(x, "opacity") !== 1 || x.style.visibility === "hidden");
        if (b.gateOpen) land(list);
        else b.queue.push(...list);
      },
    });
  }
  // the fore rides the scroll a little faster than the paper (it is nearer)
  if (fore && !OFF.has("fore")) {
    ScrollTrigger.create({
      trigger: el, start: "top bottom", end: "bottom top",
      onUpdate: (st) => { b.foreBase = foreY(st.progress, phone); },
    });
  }
  // leaving (desktop): the paper backs off toward its own edge, the world widens
  if (desktop && site && !OFF.has("drift")) {
    gsap.fromTo(site, { x: 0 }, { x: () => s * 0.03 * innerWidth, ease: "none", immediateRender: false, scrollTrigger: { trigger: el, start: "bottom 35%", end: "bottom top", scrub: true, invalidateOnRefresh: true } });
  }
  // on screen (the speed reactions run only here); set back once it is wholly below the screen again
  ScrollTrigger.create({
    trigger: el, start: "top bottom", end: "bottom top",
    onToggle: (st) => { b.on = st.isActive; },
    onLeaveBack: () => b.reset(),
  });
  // focus inside settles it at once
  el.addEventListener("focusin", () => b.settle());
  return b;
}

/** Lenis on the window, on GSAP's ticker (phase G3; only ?smooth=lenis until lane F's OK). */
function smoothWheel(root: HTMLElement): Lenis {
  const lenis = new Lenis({
    autoRaf: false,
    lerp: 0.09,
    smoothWheel: true,
    allowNestedScroll: true,
    stopInertiaOnNavigate: true,
    prevent: (node) => node.matches("dialog, [popover], iframe, .world, [data-lenis-prevent]"),
  });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  // lane F's jumps land where they jump: drop any glide in flight when the flow changes or a way in starts
  const drop = (): void => { lenis.stop(); lenis.start(); };
  new MutationObserver(drop).observe(root, { attributes: true, attributeFilter: ["data-flow"] });
  document.addEventListener(WAY_IN_EVENT, drop);
  useSmooth(lenis);
  return lenis;
}

// The home page's choreography (Dex 10-19: "more aggro ... scrolling down should really give you a premium website";
// built to lanes/motion/DESIGN-1019.md 3 and 4). Own chunk, loaded by main.ts on the home page only (never with reduced
// motion: the page is then simply all there). The world never moves with the scroll; the website does:
// - every band (render/landing.ts homeBand): its strip whips in from its side, latched to the scroll (it follows on
//   the way in, never goes back while you read) and fully in exactly as the change of place under it comes into view;
//   then its head plays (the title rises in its line mask); the panel slides in from the same side once its top is on
//   the screen (a triggered slide with its shade riding along, never a scrub that could stall half way); most of the
//   way through it the content lands in batches as it comes up, and the stitch flies in from the world side; the spine
//   draws; the fore piece rides the scroll a little faster than the paper; leaving, the paper backs off toward its edge
//   (desktop). A band that drops wholly below the screen again is set back, so scrolling down replays it.
// - the footer is the last strip: its paper rises over the pine, then its rows land.
// - the cards (lane K's deck, motion/pcard.ts): primed, then their entrance when the projects panel is in.
// - alive: the scroll's speed n (-1..1) leans the strip titles and the fore, and K's cards read it (velocity()).
// - arm time: a band already reached is simply there; a nav jump or focus settles what it passes; a watchdog lands
//   anything left waiting on screen. On the screen a settle plays the rest of the entrance out (SETTLE_TIME); only
//   what is off the screen is simply set.
// Lenis (the smooth wheel) ships last (phase G3, after lane F's OK): until then only ?smooth=lenis turns it on.

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import {
  CONTENT_GATE, PANEL_AT, PANEL_TIME, PHONE_TIME, SETTLE_TIME, SPINE_AT, STITCH_FADE, STRIP_START, contentFrom, foreY,
  isBelow, latch, onScreen, panelFrom, speedOf, stitchFrom, stripEnd, stripPose, type Side, type Variant,
} from "./choreo-plan.ts";
import { scroller, useSmooth } from "./scroller.ts";
import { SLIDEBACK_EVENT, SLIDEOFF_EVENT } from "./slideoff.ts";

gsap.registerPlugin(ScrollTrigger);

/** Lane F's "a way in starts the game" (motion/enter.ts ENTER_EVENT; named here so this chunk never pulls the opening's
 *  audio in with it; a test keeps the two the same). */
export const WAY_IN_EVENT = "dex:enter";

/** What GSAP leaves on a thing it moved, taken off once it has landed (so the CSS has it back). */
const CLEAR = "transform,opacity,visibility,translate,rotate,scale";

interface Band {
  el: HTMLElement;
  s: Side;
  /** the strip's latched progress */
  sp: number;
  /** wholly in: strip, panel, gate (content further down still lands as it comes up) */
  landed: boolean;
  headPlayed: boolean;
  /** the panel's slide has started / finished */
  panelIn: boolean;
  panelDone: boolean;
  gateOpen: boolean;
  /** a settle asked for everything at once (the gate lands every block, not only the ones that came up) */
  all: boolean;
  queue: HTMLElement[];
  seenAt: number;
  on: boolean;
  /** Lands the band: plays the rest of its entrance out if it is on the screen, else (or now) simply sets it. True when
   *  it was set. */
  settle(now?: boolean): boolean;
  reset(): void;
  stripTitle: HTMLElement | null;
  stripSurfaces: HTMLElement[];
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
        if (desktop && b.sp >= 1) gsap.set(b.stripSurfaces, { scaleX: 1 + Math.abs(n) * 0.015 });
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
        const play = (): void => {
          if (phone) {
            lis.forEach((li, i) => ScrollTrigger.create({
              trigger: li, start: "clamp(top 88%)", once: true,
              onEnter: () => d.entrance({ side: i % 2 ? "r" : "l", index: i }).play(),
            }));
          } else gsap.delayedCall(0.15, () => d.entrance({ side: "l" }).play());
        };
        // a band already landed (arm time, or set while the deck was on its way) has its cards simply there; else they
        // wait out of sight and enter as its gate opens (a settle on the screen opens the gate: they still enter)
        if (projects.landed) d.settle();
        else {
          d.prime();
          if (projects.gateOpen) play();
          else projects.onGate = play;
        }
        const oldReset = projects.reset, oldSettle = projects.settle;
        projects.reset = () => { oldReset(); d.reset(); projects.onGate = play; };
        projects.settle = (now) => {
          const set = oldSettle(now);
          if (set) d.settle();
          return set;
        };
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
      // ...in the tone of the section you are in (its strip past 40% of the screen); read once, set on a change only
      bands.forEach((b, i) => {
        const tone = getComputedStyle(b.el).getPropertyValue("--tone").trim();
        if (!tone) return;
        ScrollTrigger.create({
          trigger: b.el, start: "top 40%",
          onEnter: () => { bar.style.backgroundColor = tone; },
          onLeaveBack: () => { bar.style.backgroundColor = i ? getComputedStyle(bands[i - 1]!.el).getPropertyValue("--tone").trim() : ""; },
        });
      });
    }

    // --- the footer: the last strip
    const ftrEl = document.querySelector<HTMLElement>(".sheet--home .ftr");
    const foot = ftrEl?.querySelector(".ftr__paper") ? footerRise(ftrEl, bands.at(-1)?.el ?? null, phone, T) : null;

    // --- a nav jump settles the bands it passes; focus inside a band settles it; a watchdog lands what waits on screen
    // (on the screen a settle plays the rest out; off it, simply set)
    const settleBefore = (id: string): void => {
      const target = document.getElementById(id);
      if (target && ftrEl?.contains(target)) {
        for (const b of bands) b.settle();
        foot?.settle();
        return;
      }
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

    // way 4 (lane F): the page holds still while the website is slid off; back at its top afterwards, every band is
    // set up again as on a fresh load (motion/slideoff.ts moves the surfaces themselves)
    const onSlideOff = (): void => scroller.stop();
    const onSlideBack = (): void => {
      scroller.start();
      const vh = innerHeight;
      for (const b of bands) {
        if (isBelow(b.el.getBoundingClientRect().top, vh)) b.reset();
        else b.settle(true);
      }
      if (ftrEl && foot) {
        if (isBelow(ftrEl.getBoundingClientRect().top, vh)) foot.reset();
        else foot.settle(true);
      }
      ScrollTrigger.refresh();
    };
    document.addEventListener(SLIDEOFF_EVENT, onSlideOff);
    document.addEventListener(SLIDEBACK_EVENT, onSlideBack);

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
      document.removeEventListener(SLIDEOFF_EVENT, onSlideOff);
      document.removeEventListener(SLIDEBACK_EVENT, onSlideBack);
      for (const b of bands) b.settle(true);
      foot?.destroy();
      if (bar) bar.style.backgroundColor = "";
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
  const site = q(".band__site")!, fore = q(".band__fore");
  const head = q(".band__in");
  const stitch = q("[data-stitch]");
  const items = Array.from(el.querySelectorAll<HTMLElement>(".band__panel > .wrap > *")).filter((x) => !x.matches("[data-pcards]") && x !== stitch);
  const variant: Variant = el.id === "downloads" ? "side" : "rise";
  const from = contentFrom(variant, s, phone);
  const vw = document.documentElement.clientWidth;
  const sheet = [paper, shade];

  // the strip's head: the kicker slides in, the title rises in its line mask (never over the world under the strip),
  // its underline and the rule draw from the band's side, the key follows
  const headTl = gsap.timeline({ paused: true });
  if (head) {
    const kicker = head.querySelector(".sh__kicker"), line = head.querySelector<HTMLElement>(".sh__txt"), ul = head.querySelector(".sh__ul");
    const rule = head.querySelector(".sh__rule"), more = head.querySelector(".sh__more");
    const origin = s < 0 ? "0% 50%" : "100% 50%";
    const chars = line ? splitChars(line) : [];
    if (kicker) headTl.from(kicker, { x: -s * 24, autoAlpha: 0, duration: 0.6 * T, ease: "power3.out" }, 0);
    // the title's letters rise in its line mask, rippling from the band's side (3.1: 22 ms apart)
    if (chars.length) headTl.from(chars, { yPercent: 110, duration: 0.8 * T, ease: "expo.out", stagger: { each: 0.022, from: s < 0 ? "start" : "end" } }, 0.06 * T);
    else if (line) headTl.from(line, { yPercent: 110, duration: 0.8 * T, ease: "expo.out" }, 0.06 * T);
    if (ul) headTl.from(ul, { scaleX: 0, transformOrigin: origin, duration: 0.6 * T, ease: "expo.out" }, 0.3 * T);
    if (rule) headTl.from(rule, { scaleX: 0, transformOrigin: origin, duration: 0.9 * T, ease: "expo.inOut" }, 0.15 * T);
    if (more) headTl.from(more, { x: -s * 24, autoAlpha: 0, duration: 0.6 * T, ease: "power3.out" }, 0.3 * T);
  }

  // the surfaces get their own layer only while they move (set when set back, cleared once landed)
  const surfaces = [stripPaper, stripShade, paper, shade];
  const lift = (on: boolean): void => { for (const x of surfaces) x.style.willChange = on ? "transform" : ""; };
  // the strip and its shade: one pose (the shadow is never cast where the paper is not yet)
  const setStrip = (p: number): void => {
    const pose = stripPose(p, s, phone);
    gsap.set([stripPaper, stripShade], { xPercent: pose.xPercent, skewX: pose.skewX, force3D: true });
    gsap.set(stripShade, { opacity: pose.shade });
  };

  const b: Band = {
    el, s, sp: 0, landed: false, headPlayed: false, panelIn: false, panelDone: false, gateOpen: false, all: false, queue: [], seenAt: 0, on: false,
    stripTitle: head?.querySelector<HTMLElement>(".sh__title") ?? null, stripSurfaces: [stripPaper, stripShade], fore, foreBase: 0, lastN: NaN, lastFore: NaN, onGate: null,
    settle: () => false,
    reset: () => {},
  };

  let gateCall: gsap.core.Tween | null = null;
  let stripRun: gsap.core.Tween | null = null;
  const landedItems = new WeakSet<HTMLElement>();
  const done = (): void => {
    if (b.landed || b.sp < 1 || !b.panelDone || !b.gateOpen) return;
    b.landed = true;
    gsap.delayedCall(0.6, () => { if (b.landed) lift(false); });
  };
  const playHead = (): void => {
    if (b.headPlayed) return;
    b.headPlayed = true;
    headTl.play();
  };

  // content lands in batches as it comes up, but only once the panel is (nearly) in; the stitch flies in solid
  const landStitch = (): void => {
    if (!stitch || stitch.dataset.landed !== undefined) return;
    stitch.dataset.landed = "";
    gsap.to(stitch, { autoAlpha: 1, duration: STITCH_FADE, ease: "none", delay: 0.15 });
    gsap.to(stitch, {
      x: 0, rotation: 0, duration: 1.1 * T, ease: "expo.out", delay: 0.15,
      onComplete: () => { gsap.set(stitch, { clearProps: CLEAR }); },
    });
  };
  const land = (batch: HTMLElement[], quick = false): void => {
    landStitch();
    const list = batch.filter((x) => !landedItems.has(x));
    if (!list.length) return;
    for (const x of list) landedItems.add(x);
    gsap.to(list, {
      x: 0, y: 0, scale: 1, autoAlpha: 1, duration: quick ? SETTLE_TIME + 0.15 : (variant === "side" ? 0.7 : 0.8) * T, ease: "expo.out",
      stagger: quick ? 0.03 : 0.07, overwrite: "auto",
      onComplete: () => { gsap.set(list, { clearProps: CLEAR }); },
    });
  };
  const openGate = (): void => {
    if (b.gateOpen) return;
    b.gateOpen = true;
    land(b.all ? items : b.queue.splice(0), b.all);
    b.queue = [];
    b.onGate?.();
    b.onGate = null;
    done();
  };

  // the panel: a triggered slide from its side, its shade riding with it (one pose), the spine drawn as it lands
  const playPanel = (dur: number): void => {
    if (b.panelIn) return;
    b.panelIn = true;
    gsap.to(sheet, { xPercent: 0, duration: dur, ease: "expo.out", onComplete: () => { b.panelDone = true; done(); } });
    gsap.to(shade, { opacity: 1, duration: dur * 0.5, ease: "power1.out" });
    if (spine) gsap.to(spine, { scaleY: 1, duration: 0.7 * T, ease: "expo.out", delay: dur * SPINE_AT });
    gateCall = gsap.delayedCall(dur * CONTENT_GATE, openGate);
  };

  const killAll = (): void => {
    gateCall?.kill();
    stripRun?.kill();
    gateCall = stripRun = null;
    gsap.killTweensOf([...surfaces, ...items, ...(spine ? [spine] : []), ...(stitch ? [stitch] : [])]);
  };
  const prime = (): void => {
    lift(true);
    killAll();
    b.sp = 0;
    b.landed = b.headPlayed = b.panelIn = b.panelDone = b.gateOpen = b.all = false;
    setStrip(0);
    gsap.set(sheet, { xPercent: panelFrom(s), force3D: true });
    gsap.set(shade, { opacity: 0 });
    headTl.pause(0);
    if (spine) gsap.set(spine, { scaleY: 0, transformOrigin: "50% 0%" });
    gsap.set(items, from);
    for (const x of items) landedItems.delete(x);
    if (stitch) { delete stitch.dataset.landed; gsap.set(stitch, stitchFrom(s, vw, phone)); }
    b.queue = [];
  };
  // off the screen: simply set (nobody sees it); nothing waits on the gate any more (the deck settles with it)
  const setDone = (): void => {
    killAll();
    lift(false);
    b.sp = 1;
    b.landed = b.headPlayed = b.panelIn = b.panelDone = b.gateOpen = b.all = true;
    setStrip(1);
    gsap.set(sheet, { xPercent: 0 });
    gsap.set(shade, { opacity: 1 });
    headTl.progress(1).pause();
    if (spine) gsap.set(spine, { scaleY: 1 });
    gsap.set([...items, ...(stitch ? [stitch] : [])], { clearProps: CLEAR });
    for (const x of items) landedItems.add(x);
    if (stitch) stitch.dataset.landed = "";
    b.queue = [];
    b.onGate = null;
  };
  // on the screen: the rest of the entrance plays out (never a pop): the strip the rest of its way, its head, the
  // panel, then everything still waiting lands together
  const playOut = (): void => {
    b.all = true;
    if (b.sp < 1) {
      const o = { p: b.sp };
      stripRun = gsap.to(o, {
        p: 1, duration: SETTLE_TIME, ease: "power2.out",
        onUpdate: () => { if (o.p > b.sp) { b.sp = o.p; setStrip(o.p); } },
        onComplete: () => { b.sp = 1; setStrip(1); playHead(); done(); },
      });
    } else playHead();
    playPanel(SETTLE_TIME);
    if (b.gateOpen) land(items, true);
  };
  b.settle = (now = false) => {
    if (b.landed && b.all) return true;
    const r = site.getBoundingClientRect();
    if (now || !onScreen(r.top, r.bottom, innerHeight)) { setDone(); return true; }
    playOut();
    return false;
  };
  b.reset = () => prime();

  // arm: a band already reached is simply there; one wholly below is set back to play
  if (isBelow(el.getBoundingClientRect().top, innerHeight)) prime();
  else b.settle(true);

  // the strip (no lag: it must cover the change of place under it, even on a fling)
  ScrollTrigger.create({
    trigger: strip, start: STRIP_START, end: () => stripEnd(strip.offsetHeight),
    onUpdate: (st) => {
      if (b.sp >= 1) return;
      const p = latch(b.sp, st.progress);
      if (p === b.sp) return;
      b.sp = p;
      setStrip(p);
      if (p >= 1) { playHead(); done(); }
    },
  });
  // the panel: plays once its top crosses PANEL_AT (or the scroll jumps past it)
  ScrollTrigger.create({
    trigger: panel, start: PANEL_AT(phone), end: "bottom top",
    onUpdate: (st) => { if (!b.panelIn && st.progress > 0) playPanel(PANEL_TIME * T); },
  });
  // content: batches as they come up the screen, queued behind the gate
  if (items.length && !OFF.has("content")) {
    ScrollTrigger.batch(items, {
      start: "clamp(top 88%)", interval: 0.1, batchMax: 6,
      onEnter: (batch) => {
        const list = (batch as HTMLElement[]).filter((x) => !landedItems.has(x));
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
  if (desktop && !OFF.has("drift")) {
    gsap.fromTo(site, { x: 0 }, { x: () => s * 0.03 * innerWidth, ease: "none", immediateRender: false, scrollTrigger: { trigger: el, start: "bottom 35%", end: "bottom top", scrub: true, invalidateOnRefresh: true } });
  }
  // on screen (the speed reactions run only here); set back once it is wholly below the screen again
  ScrollTrigger.create({
    trigger: el, start: "top bottom", end: "bottom top",
    onToggle: (st) => { b.on = st.isActive; },
    onLeaveBack: () => b.reset(),
  });
  // focus inside settles it (playing out what is left)
  el.addEventListener("focusin", () => { b.settle(); });
  return b;
}

/** A strip title's words as letters (each its own box, so each can rise in the line mask), the words kept whole for
 *  line breaks; the title is read once, from a copy for screen readers. Only while the choreography runs. */
function splitChars(line: HTMLElement): HTMLElement[] {
  const text = line.textContent ?? "";
  if (!text.trim() || line.querySelector(".sh__ch")) return Array.from(line.querySelectorAll<HTMLElement>(".sh__ch"));
  const read = document.createElement("span");
  read.className = "sr";
  read.textContent = text;
  const shown = document.createElement("span");
  shown.setAttribute("aria-hidden", "true");
  const chars: HTMLElement[] = [];
  for (const part of text.split(/(\s+)/)) {
    if (!part) continue;
    if (/^\s+$/.test(part)) { shown.append(" "); continue; }
    const word = document.createElement("span");
    word.className = "sh__w";
    for (const c of part) {
      const ch = document.createElement("span");
      ch.className = "sh__ch";
      ch.textContent = c;
      word.append(ch);
      chars.push(ch);
    }
    shown.append(word);
  }
  line.replaceChildren(read, shown);
  return chars;
}

/** The footer, the last strip (3.2): its paper rises over the pine (the last band's place reaches under it while the
 *  choreography runs), its shade casting up with it, then its rows land. Triggered like the panels, latched. */
function footerRise(ftr: HTMLElement, last: HTMLElement | null, phone: boolean, T: number): { settle(now?: boolean): void; reset(): void; destroy(): void } {
  const paper = ftr.querySelector<HTMLElement>(".ftr__paper"), shade = ftr.querySelector<HTMLElement>(".ftr__shade");
  const parts = Array.from(ftr.querySelectorAll<HTMLElement>(".ftr__more-head, .ftr__chips > li, .ftr__mark, .ftr__nav li, .ftr__side > *, .ftr__base"));
  const sheet = [paper, shade].filter((x): x is HTMLElement => x !== null);
  // the pine under the footer: the last band's world reaches down by the footer's height (measured, never per frame)
  const measure = (): void => { last?.style.setProperty("--ftr-h", `${Math.ceil(ftr.offsetHeight)}px`); };
  measure();
  const ro = new ResizeObserver(measure);
  ro.observe(ftr);
  let played = false, landed = false;
  const prime = (): void => {
    gsap.killTweensOf([...sheet, ...parts]);
    played = landed = false;
    gsap.set(sheet, { yPercent: 100, force3D: true });
    if (shade) gsap.set(shade, { opacity: 0 });
    gsap.set(parts, { y: 24, autoAlpha: 0 });
  };
  const setDone = (): void => {
    gsap.killTweensOf([...sheet, ...parts]);
    played = landed = true;
    gsap.set([...sheet, ...parts], { clearProps: CLEAR });
  };
  const play = (dur: number): void => {
    if (played) return;
    played = true;
    gsap.to(sheet, { yPercent: 0, duration: dur, ease: "expo.out", onComplete: () => { gsap.set(sheet, { clearProps: CLEAR }); } });
    if (shade) gsap.to(shade, { opacity: 1, duration: dur * 0.5, ease: "power1.out" });
    gsap.to(parts, {
      y: 0, autoAlpha: 1, duration: 0.6 * T, ease: "expo.out", stagger: 0.05, delay: dur * CONTENT_GATE,
      onComplete: () => { landed = true; gsap.set(parts, { clearProps: CLEAR }); },
    });
  };
  if (isBelow(ftr.getBoundingClientRect().top, innerHeight)) prime();
  else setDone();
  const rise = ScrollTrigger.create({
    trigger: ftr, start: PANEL_AT(phone), end: "bottom top",
    onUpdate: (st) => { if (!played && st.progress > 0) play(PANEL_TIME * T); },
  });
  const back = ScrollTrigger.create({ trigger: ftr, start: "top bottom", onLeaveBack: prime });
  function settle(now = false): void {
    if (landed) return;
    const r = ftr.getBoundingClientRect();
    if (now || !onScreen(r.top, r.bottom, innerHeight)) setDone();
    else play(SETTLE_TIME);
  }
  const onFocus = (): void => { settle(); };
  ftr.addEventListener("focusin", onFocus);
  return {
    settle,
    reset: prime,
    destroy: () => {
      ro.disconnect();
      rise.kill();
      back.kill();
      ftr.removeEventListener("focusin", onFocus);
      setDone();
      last?.style.removeProperty("--ftr-h");
    },
  };
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

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
// - the footer is the last strip: its paper rises over the lake, then its rows land.
// - the cards (lane K's deck, motion/pcard.ts): primed, then their entrance when the projects panel is in.
// - alive: the scroll's speed n (-1..1) leans the strip titles and the fore, and K's cards read it (velocity()).
// - arm time: a band already reached is simply there; a nav jump or focus settles what it passes; a watchdog lands
//   anything left waiting on screen. On the screen a settle plays the rest of the entrance out (SETTLE_TIME); only
//   what is off the screen is simply set.
// Lenis (the smooth wheel) ships last (phase G3, after lane F's OK): until then only ?smooth=lenis turns it on, and it
// comes in its own chunk then (site loop v4 round 1: bundled here it cost ~4 KB gzip of the motion budget on every visit).

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type Lenis from "lenis";
import {
  BANNER_AT, CONTENT_GATE, FAST_N, FAST_V, HEAD_LEAD, PANEL_AT, PANEL_IN_AT, PANEL_IN_EVENT, PANEL_TIME, PHONE_TIME, SETTLE_TIME,
  SPINE_AT, STRIP_START, contentFrom,
  foreY, isBelow, latch, liftY, onScreen, panelFrom, speedOf, stitchFrom, stripEnd, stripPose, worldShift, type Side,
  type Variant,
} from "./choreo-plan.ts";
import { initPointer, type Pointer } from "./pointer.ts";
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
  /** the strip itself on the screen (the band can be on while its strip is long gone above), and the shear last written
   *  (in 1/20 steps: site loop v3 round 2, a style write on every strip each tick cost frames at 1366) */
  stripOn: boolean;
  lastNq: number;
  /** what waits on the gate (the cards' deck); fast: the band came in fast, so it plays compressed */
  onGate: ((fast: boolean) => void) | null;
  /** the strip's light under the pointer (fine pointers), and its x last written */
  glare: HTMLElement | null;
  lastGx: number;
  /** the band's world and shades under the pointer (DESIGN-1019 4.2): its place's canvas (painted late: looked up until
   *  found), the shades, and what was last written */
  scene: HTMLCanvasElement | null;
  shades: HTMLElement[];
  lastWx: number;
  lastWy: number;
  lastSx: number;
  lastSy: number;
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
    let lenis: Lenis | null = null, gone = false;
    if (fine.matches && /[?&]smooth=lenis/.test(location.search)) {
      void smoothWheel(root).then((l) => { if (gone) { l.destroy(); useSmooth(null); } else lenis = l; }, (error: unknown) => console.error("[site] lenis failed", error));
    }

    // --- the scroll's speed, n: our own measure each ticker frame (works with Lenis and with native touch scrolling)
    const speed = { n: 0 };
    const toN = gsap.quickTo(speed, "n", { duration: 0.4, ease: "power3.out" });
    let lastY = window.scrollY;
    const bands: Band[] = [];
    // --- the pointer (fine pointers; not on a low-end device): the world shifts against it in whole art pixels, the
    // shades the other way (the light follows it); the keys pull toward it
    const lowEnd = (navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number }).connection?.saveData === true
      || ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8) <= 2;
    const ptr: Pointer | null = fine.matches && !OFF.has("pointer") ? initPointer(document.querySelector(".sheet--home") ?? document) : null;
    const wide = innerWidth >= 1600;
    const artPx = Math.round(2 * devicePixelRatio) / devicePixelRatio;
    const [ax, ay] = wide ? [10, 6] : [8, 4];
    let moving = false;
    const tick = (): void => {
      const y = window.scrollY;
      toN(speedOf(y - lastY, phone));
      lastY = y;
      const n = Math.round(speed.n * 200) / 200;
      // the idle loops rest while the page moves (styles/choreo.css [data-moving]): they are for when you stop
      const going = n !== 0;
      if (going !== moving) { moving = going; root.toggleAttribute("data-moving", going); }
      const wx =ptr && !lowEnd ? worldShift(ptr.x, ax, artPx) : 0, wy = ptr && !lowEnd ? worldShift(ptr.y, ay, artPx) : 0;
      const sx = ptr ? Math.round(-ptr.x * 16) / 2 : 0, sy = ptr ? Math.round(-ptr.y * 16) / 2 : 0;
      const gx = ptr ? Math.round((ptr.x + 1) * 0.5 * innerWidth) : 0;
      for (const b of bands) {
        if (!b.on) continue;
        // the strip's light follows the pointer along it (shown while the strip is hovered: styles/choreo.css)
        if (b.glare && b.stripOn && gx !== b.lastGx) { b.glare.style.translate = `${gx}px 0`; b.lastGx = gx; }
        if (ptr) {
          if (wx !== b.lastWx || wy !== b.lastWy) {
            b.scene ??= b.el.querySelector<HTMLCanvasElement>(".band__scene > canvas");
            if (b.scene) { b.scene.style.translate = wx || wy ? `${wx}px ${wy}px` : ""; b.lastWx = wx; b.lastWy = wy; }
          }
          if (sx !== b.lastSx || sy !== b.lastSy) {
            // (x / y: the slide owns xPercent, the breath is CSS on their ::before; the three add up)
            gsap.set(b.shades, { x: sx, y: sy });
            b.lastSx = sx; b.lastSy = sy;
          }
        }
        const fy = b.fore ? Math.round(b.foreBase + n * (phone ? 14 : 28)) : 0;
        if (n === b.lastN && fy === b.lastFore) continue;
        b.lastN = n;
        b.lastFore = fy;
        // the whole site leans on a fling, not only the cards: the strip titles drift (desktop) and tip with the scroll
        // (site loop v4 round 1: 1.5 degrees read as nothing in a fling's frames; now 3.5 at full speed, eased back with n)
        if (b.stripTitle && b.headPlayed) gsap.set(b.stripTitle, desktop ? { x: n * 24, skewY: n * 3.5 } : { skewY: n * 2.5 });
        const nq = Math.round(n * 20) / 20;
        if (desktop && b.sp >= 1 && b.stripOn && nq !== b.lastNq) {
          b.lastNq = nq;
          gsap.set(b.stripSurfaces, { scaleX: 1 + Math.abs(nq) * 0.015 });
          // ...and its giant number shears with the scroll (styles/choreo.css: a transform on its own layer)
          b.stripSurfaces[0]!.style.setProperty("--n", String(nq));
        }
        if (b.fore) gsap.set(b.fore, { y: fy });
      }
    };
    if (!OFF.has("tick")) gsap.ticker.add(tick);

    for (const el of document.querySelectorAll<HTMLElement>(".band")) {
      if (!el.querySelector(".band__strip")) continue;
      bands.push(band(el, phone, desktop, T, speed, () => ptr?.dirty()));
    }
    // (site loop v4 round 1, the critic: "the cursor does nothing outside cards and keys") a soft light on each strip's
    // paper under a fine pointer, on its own layer (a translate per pointer frame, no repaint of the strip)
    if (ptr) {
      for (const b of bands) {
        const g = document.createElement("i");
        g.className = "band__glare";
        g.setAttribute("aria-hidden", "true");
        b.el.querySelector(".band__strip-paper")?.append(g);
        b.glare = g;
      }
    }

    // --- the projects (Dex 10-22: banner strips running down the panel; lane K's deck contract, motion/pbanner.ts):
    // primed or settled with their band; once its gate opens, each banner enters on its own as it reaches 85% of the
    // screen, on every width (a band that came in fast plays them at four times the pace)
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
        let waiting: { kill(): void }[] = [];
        const drop = (): void => { for (const st of waiting) st.kill(); waiting = []; };
        const play = (fast = false): void => {
          drop();
          let up = 0;
          lis.forEach((li, i) => {
            const go = (quick: boolean): void => { d.entrance({ side: "l", index: i }).timeScale(quick ? 4 : 1).play(); };
            // (already up the screen as the gate opens: now, one after another)
            if (li.getBoundingClientRect().top < innerHeight * BANNER_AT) {
              const k = up++;
              if (k === 0) go(fast);
              else waiting.push(gsap.delayedCall(k * (fast ? 0.04 : 0.16), () => go(fast)));
              return;
            }
            waiting.push(ScrollTrigger.create({
              trigger: li, start: `top ${Math.round(BANNER_AT * 100)}%`, once: true,
              onEnter: (st) => go(fast || Math.abs(st.getVelocity()) >= FAST_V),
            }));
          });
        };
        // a band already landed (arm time, or set while the deck was on its way) has its banners simply there; else
        // they wait out of sight and enter one by one once its gate opens (a settle on the screen opens the gate: they
        // still enter)
        if (projects.landed) d.settle();
        else {
          d.prime();
          if (projects.gateOpen) play(projects.all);
          else projects.onGate = play;
        }
        const oldReset = projects.reset, oldSettle = projects.settle;
        projects.reset = () => { oldReset(); drop(); d.reset(); projects.onGate = play; };
        projects.settle = (now) => {
          const set = oldSettle(now);
          if (set) { drop(); d.settle(); }
          return set;
        };
        ScrollTrigger.create({ trigger: projects.el, start: "top bottom", end: "bottom top", onToggle: (st) => d.live(st.isActive) });
        // the strips breathe with the scroll (desktop): the stepped middle one rides a little against the others
        if (desktop && lis.length >= 2) {
          gsap.fromTo(lis[1]!, { y: 14 }, { y: -14, ease: "none", scrollTrigger: { trigger: projects.el, start: "top bottom", end: "bottom top", scrub: 0.6 } });
        }
        ScrollTrigger.refresh();
      }, (error: unknown) => console.error("[site] banners failed", error));
    }

    // --- the header: a scroll progress line across its foot
    const bar = document.querySelector<HTMLElement>(".hdr__progress");
    const hdr = bar?.closest<HTMLElement>(".hdr") ?? null;
    const sheet = document.querySelector<HTMLElement>(".sheet--home");
    if (bar && hdr && sheet) {
      gsap.fromTo(bar, { scaleX: 0 }, { scaleX: 1, ease: "none", scrollTrigger: { trigger: sheet, start: "top top", end: "bottom bottom", scrub: true } });
      // (site loop v4 round 1, the critic's idea) a little ofuda rides the line's tip, in the section's tone, swaying at
      // rest (styles/choreo.css .hdr__pip): a translate on its own layer
      const pip = document.createElement("i");
      pip.className = "hdr__pip";
      pip.setAttribute("aria-hidden", "true");
      bar.after(pip);
      // (its own translate, never GSAP's transform: GSAP would fold the CSS sway's rotate into it)
      let pipW = bar.offsetWidth, pipX = -1;
      ScrollTrigger.create({
        trigger: sheet, start: "top top", end: "bottom bottom",
        onRefresh: () => { pipW = bar.offsetWidth; },
        onUpdate: (st) => {
          const x = Math.round(st.progress * pipW);
          if (x !== pipX) { pipX = x; pip.style.translate = `${x}px 0`; }
        },
      });
      // ...and the header takes the tone of the section you are in (its strip past 40% of the screen): the line, the
      // nav indicator's shadow (styles/bands.css --sec-tone); read once, set on a change only
      const toneOf = (b: Band | undefined): string => (b ? getComputedStyle(b.el).getPropertyValue("--tone").trim() : "");
      const setTone = (t: string): void => { if (t) hdr.style.setProperty("--sec-tone", t); else hdr.style.removeProperty("--sec-tone"); };
      bands.forEach((b, i) => {
        const tone = toneOf(b);
        if (!tone) return;
        ScrollTrigger.create({
          trigger: b.el, start: "top 40%",
          onEnter: () => setTone(tone),
          onLeaveBack: () => setTone(toneOf(bands[i - 1])),
        });
      });
    }

    // --- the hanko (site loop v3 round 2): a press on any key stamps a seal of its section's tone under the pointer
    // (styles/choreo.css .press-seal): one element, moved and replayed, compositor only
    const seal = document.createElement("i");
    seal.className = "press-seal";
    seal.setAttribute("aria-hidden", "true");
    document.body.append(seal);
    let stamp: Animation | null = null;
    const onPress = (e: PointerEvent): void => {
      const key = (e.target as Element | null)?.closest?.(".sheet--home :is(a, button, .dlf)");
      if (!key || e.button > 0) return;
      // (the deep twin of the section's tone: it reads on the section's own coloured keys too)
      const home = key.closest<HTMLElement>(".band");
      const cs = getComputedStyle(home ?? key);
      const tone = (cs.getPropertyValue("--tone-d") || cs.getPropertyValue("--tone")).trim();
      if (tone) seal.style.setProperty("--hk", tone); else seal.style.removeProperty("--hk");
      // (site loop v4 round 1: a plain square read as a focus ring) a real seal: the section's own glyph cut in it (its
      // strip's pixel icon; the footer's, the dex mark's heart), pressed at a 4-8 degree tilt, the ink bleeding out as it
      // fades
      const glyph = (home ?? document).querySelector(home ? ".sh__kicker .tile svg" : ".ftr__kofi svg, .sh__kicker .tile svg");
      if (glyph && seal.dataset.from !== (home?.id ?? "ftr")) {
        seal.dataset.from = home?.id ?? "ftr";
        seal.replaceChildren(glyph.cloneNode(true));
      }
      const r = (Math.random() < 0.5 ? -1 : 1) * (4 + Math.round(Math.random() * 4));
      seal.style.translate = `${Math.round(e.clientX)}px ${Math.round(e.clientY)}px`;
      stamp?.cancel();
      stamp = seal.animate([
        { opacity: 0.95, scale: "1.6", rotate: `${r}deg`, outlineOffset: "-10px" },
        { opacity: 0.92, scale: "1", rotate: `${r}deg`, outlineOffset: "-10px", offset: 0.14 },
        { opacity: 0.85, scale: "1", rotate: `${r}deg`, outlineOffset: "-10px", offset: 0.5 },
        { opacity: 0, scale: "1.08", rotate: `${r}deg`, outlineOffset: "-7px" },
      ], { duration: 1100, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" });
    };
    document.addEventListener("pointerdown", onPress, { passive: true });

    // --- the footer: the last strip
    const ftrEl = document.querySelector<HTMLElement>(".sheet--home .ftr");
    const foot = ftrEl?.querySelector(".ftr__paper") ? footerRise(ftrEl, bands.at(-1)?.el ?? null, phone, T) : null;

    // --- the joins (site loop v4 round 1, the critic's dead band at donate -> docs: the pine and its cliffs stand at the
    // screen's foot, so the whole time the docs strip climbed, the window above it held only a bare dusk gradient): as
    // the next paper comes up over a place, the place rises with it at LIFT of its pace, so what it shows stays in the
    // window above the paper until the paper has it all; the next place waits, still, under the strip. Only the scene's
    // canvas moves (a transform on its own layer, inside the fixed scene). Not on phones: their places are sticky in
    // their bands and leave with them.
    const lifts: HTMLCanvasElement[] = [];
    if (!phone && !OFF.has("lift")) {
      bands.forEach((b, i) => {
        const next = bands[i + 1]?.el.querySelector<HTMLElement>(".band__strip") ?? ftrEl;
        if (!next) return;
        let last = 0;
        ScrollTrigger.create({
          trigger: next, start: "top bottom", end: "top top",
          onUpdate: (st) => {
            b.scene ??= b.el.querySelector<HTMLCanvasElement>(".band__scene > canvas");
            if (!b.scene) return;
            const y = liftY(st.progress, innerHeight);
            if (y === last) return;
            last = y;
            if (!lifts.includes(b.scene)) lifts.push(b.scene);
            b.scene.style.transform = y ? `translate3d(0, ${y}px, 0)` : "";
          },
        });
      });
    }

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
      document.removeEventListener("pointerdown", onPress);
      stamp?.cancel();
      seal.remove();
      for (const b of bands) b.settle(true);
      foot?.destroy();
      hdr?.style.removeProperty("--sec-tone");
      document.querySelector(".hdr__pip")?.remove();
      for (const c of lifts) c.style.transform = "";
      for (const b of bands) b.glare?.remove();
      ptr?.destroy();
      gone = true;
      if (lenis) { (lenis as Lenis).destroy(); useSmooth(null); }
      root.removeAttribute("data-choreo");
      root.removeAttribute("data-moving");
    };
  });
}

/** One band's choreography (3.1). speed: the scroll's speed n (a band entered fast lands its content with its paper);
 *  moved: its content has landed (the keys' boxes are read again). */
function band(el: HTMLElement, phone: boolean, desktop: boolean, T: number, speed: { n: number }, moved: () => void): Band {
  const s: Side = el.classList.contains("band--r") ? 1 : -1;
  const q = <E extends HTMLElement>(sel: string): E | null => el.querySelector<E>(sel);
  const strip = q(".band__strip")!, stripPaper = q(".band__strip-paper")!, stripShade = q(".band__strip-shade")!;
  const panel = q(".band__panel")!, paper = q(".band__paper")!, shade = q(".band__shade")!, spine = q(".band__spine");
  const site = q(".band__site")!, fore = q(".band__fore");
  const head = q(".band__in");
  // (Dex 10-22: what plays its own entrance on dex:panel-in, the gallery's wall and the donate decor, PLAN 8.1, is left
  // alone: a block that is or holds [data-self])
  const own = (x: HTMLElement): boolean => x.matches("[data-pcards], [data-self]") || !!x.querySelector("[data-self]");
  const blocks = Array.from(el.querySelectorAll<HTMLElement>(".band__panel > .wrap > *"));
  const stitch0 = q("[data-stitch]");
  const stitch = stitch0 && !blocks.some((x) => x.contains(stitch0) && own(x)) ? stitch0 : null;
  // what unrolls solid: the stitch, or the block that holds it (site loop v3 round 2: the downloads file card sat in a
  // list that faded in as one, so the card faded with it and the palace showed through its overhang)
  const unroll = stitch ? (blocks.find((x) => x.contains(stitch)) ?? stitch) : null;
  const items = blocks.filter((x) => !own(x) && x !== unroll);
  // (site loop v3 round 1: everything slides out from under the layer above it, the strip over its panel)
  const variant: Variant = "drop";
  const from = contentFrom(variant, s, phone);
  const sheet = [paper, shade];

  // the strip's head, out from under the paper above it (the strip clips its top edge): the kicker drops in, the title's
  // letters drop in their line mask and it squashes a pixel row as they land, its underline and the rule draw from the
  // band's side, the key drops and lands like a hanko pressed (a squash, a hop), the icon blinks.
  // Every part lands on its own place (explicit ends) and gives its transform back once
  // the head has played (the key's pixel pop and the rule's travelling dot are CSS on the same elements)
  // Site loop v4 round 1 (Dex 10-20 16:30Z: "the UI elements ... come in from under the top one"): the whole head comes
  // out from under the paper above as one beat, solid (no fade: the strip's top edge hides each part until it is out):
  // the kicker row with its rule drawing as it comes, the title's letters, and the key riding with them (it used to fade
  // in ~0.3 s late, a ghost; the rule drew ~0.4 s after the title)
  const headTl = gsap.timeline({ paused: true });
  if (head) {
    const kicker = head.querySelector<HTMLElement>(".sh__kicker"), line = head.querySelector<HTMLElement>(".sh__txt"), ul = head.querySelector(".sh__ul");
    const rule = head.querySelector(".sh__rule"), more = head.querySelector<HTMLElement>(".sh__more"), tile = head.querySelector(".sh__kicker .tile");
    const origin = s < 0 ? "0% 50%" : "100% 50%";
    const chars = line ? splitChars(line) : [];
    // how far up a part sits wholly above the strip's top edge (layout boxes, never the moved ones)
    const under = (x: HTMLElement) => (): number => -(topIn(x, strip) + x.offsetHeight + 6);
    if (kicker) headTl.fromTo(kicker, { y: under(kicker) }, { y: 0, duration: 0.7 * T, ease: "expo.out" }, 0);
    if (rule) headTl.fromTo(rule, { scaleX: 0 }, { scaleX: 1, transformOrigin: origin, duration: 0.8 * T, ease: "expo.out" }, 0.04 * T);
    if (tile) headTl.fromTo(tile, { scale: 1 }, { keyframes: { scale: [1, 1.3, 0.92, 1] }, duration: 0.42, ease: "power2.out" }, 0.3 * T);
    // the title's letters drop in its line mask, rippling from the band's side (3.1: 22 ms apart)
    if (chars.length) headTl.fromTo(chars, { yPercent: -110 }, { yPercent: 0, duration: 0.8 * T, ease: "expo.out", stagger: { each: 0.022, from: s < 0 ? "start" : "end" } }, 0.05 * T);
    else if (line) headTl.fromTo(line, { yPercent: -110 }, { yPercent: 0, duration: 0.8 * T, ease: "expo.out" }, 0.05 * T);
    // ...and it lands with a squash of one pixel row (the last letter is nearly in by then)
    if (line) {
      headTl.to(line, { scaleY: 0.95, transformOrigin: "50% 100%", duration: 0.07, ease: "power2.in" }, (0.05 + 0.22) * T + chars.length * 0.022)
        .to(line, { scaleY: 1, duration: 0.42, ease: "back.out(4)" });
    }
    if (ul) headTl.fromTo(ul, { scaleX: 0 }, { scaleX: 1, transformOrigin: origin, duration: 0.6 * T, ease: "expo.out" }, 0.18 * T);
    if (more) {
      headTl.fromTo(more, { y: under(more) }, { y: 0, duration: 0.6 * T, ease: "expo.out" }, 0.1 * T)
        .fromTo(more, { scaleX: 1.12, scaleY: 0.84 }, { scaleX: 1, scaleY: 1, transformOrigin: "50% 100%", duration: 0.5, ease: "elastic.out(1, 0.45)", immediateRender: false }, 0.34 * T);
    }
    const parts = [kicker, line, ul, rule, more, tile, ...chars].filter((x): x is Element => x !== null);
    headTl.eventCallback("onComplete", () => { gsap.set(parts, { clearProps: CLEAR }); });
  }

  const b0title = head?.querySelector<HTMLElement>(".sh__title") ?? null;
  // the surfaces get their own layer only while they move (set when set back, cleared once landed)
  const surfaces = [stripPaper, stripShade, paper, shade];
  // ...and while the band is on the screen, the strip and its title keep a layer of their own: the scroll's speed
  // stretches the strip and leans the title every frame (compositor work, never a repaint of the strip and its number)
  const keep = [stripPaper, stripShade, ...(b0title ? [b0title] : [])];
  const lift = (on: boolean): void => {
    for (const x of surfaces) x.style.willChange = on ? "transform" : "";
    if (!on && b.on) for (const x of keep) x.style.willChange = "transform";
  };
  // the strip and its shade: one pose (the shadow is never cast where the paper is not yet)
  const setStrip = (p: number): void => {
    const pose = stripPose(p, s, phone);
    gsap.set([stripPaper, stripShade], { xPercent: pose.xPercent, skewX: pose.skewX, force3D: true });
    gsap.set(stripShade, { opacity: pose.shade });
  };

  const b: Band = {
    el, s, sp: 0, landed: false, headPlayed: false, panelIn: false, panelDone: false, gateOpen: false, all: false, queue: [], seenAt: 0, on: false,
    stripTitle: b0title, stripSurfaces: [stripPaper, stripShade], fore, foreBase: 0, lastN: NaN, lastFore: NaN, stripOn: false, lastNq: 0, onGate: null, glare: null, lastGx: NaN,
    scene: null, shades: [stripShade, shade], lastWx: NaN, lastWy: NaN, lastSx: NaN, lastSy: NaN,
    settle: () => false,
    reset: () => {},
  };

  // the panel is in (its paper PANEL_IN_AT through its slide, or set): the page hears it once per entrance
  let panelSaid = false;
  const sayPanelIn = (): void => {
    if (panelSaid) return;
    panelSaid = true;
    el.setAttribute("data-panel-in", "");
    document.dispatchEvent(new CustomEvent(PANEL_IN_EVENT, { detail: { id: el.id } }));
  };

  let gateCall: gsap.core.Tween | null = null;
  let stripRun: gsap.core.Tween | null = null;
  const landedItems = new WeakSet<HTMLElement>();
  // the band's sleepy blob (downloads) peeks up as its band lands: a hop and a "!" (styles/choreo.css .is-awake)
  const zz = el.querySelector<HTMLElement>(".dlp__zz");
  const done = (): void => {
    if (b.landed || b.sp < 1 || !b.panelDone || !b.gateOpen) return;
    b.landed = true;
    if (zz && !zz.classList.contains("is-awake")) {
      zz.classList.add("is-awake");
      gsap.delayedCall(1.4, () => zz.classList.remove("is-awake"));
    }
    gsap.delayedCall(0.6, () => { if (b.landed) { lift(false); moved(); } });
  };
  // (site loop v4 round 1: on a fling the head plays at triple speed, never a strip left without its title mid-fling)
  const playHead = (fast = false): void => {
    if (b.headPlayed) return;
    b.headPlayed = true;
    headTl.timeScale(fast ? 3 : 1).play();
  };

  // content lands in batches as it comes up, but only once the panel is (nearly) in; the stitch flies in solid
  const wipe = { p: 0 };
  const landStitch = (): void => {
    if (!stitch || stitch.dataset.landed !== undefined) return;
    stitch.dataset.landed = "";
    // solid all the way (never see-through over the world it hangs onto): it unrolls down out from under the strip.
    // The wipe moves in whole 8 px steps (site loop v3 round 2): a pixel-art unroll, and a clip that changes only on a
    // step, so the card is painted again only then (a clip change repaints it; its slow tail was a repaint every frame)
    // (site loop v3 round 3: the clip was opened 100vw to each side, so each step repainted a viewport-wide layer and
    // a long frame landed as the band came in): it opens only as far as the stitch reaches past the block, plus its
    // shadow, and on a fling it lands in one go
    const u = unroll!, h = u.offsetHeight + 24;
    const ur = u.getBoundingClientRect(), sr = stitch.getBoundingClientRect();
    const sl = Math.ceil(Math.max(0, ur.left - sr.left)) + 16, sR = Math.ceil(Math.max(0, sr.right - ur.right)) + 16;
    if (Math.abs(speed.n) >= FAST_N) { gsap.set(u, { y: 0, clearProps: `${CLEAR},clipPath` }); return; }
    u.style.willChange = "clip-path";
    let last = NaN;
    gsap.to(u, { y: 0, duration: 0.9 * T, ease: "expo.out", delay: 0.1 });
    wipe.p = 0;
    gsap.to(wipe, {
      p: 1, duration: 0.9 * T, ease: "expo.out", delay: 0.1,
      onUpdate: () => {
        const b = Math.round(((1 - wipe.p) * h) / 8) * 8 - 24;
        if (b !== last) { last = b; u.style.clipPath = `inset(-24px -${sR}px ${b}px -${sl}px)`; }
      },
      onComplete: () => { u.style.willChange = ""; gsap.set(u, { clearProps: `${CLEAR},clipPath` }); },
    });
  };
  const land = (batch: HTMLElement[], quick = false): void => {
    landStitch();
    const list = batch.filter((x) => !landedItems.has(x));
    if (!list.length) return;
    for (const x of list) landedItems.add(x);
    // (site loop v4 round 1: solid within 0.14 s, the slide carries the rest: no ghost of a row easing in)
    const each = quick ? 0.03 : 0.06;
    gsap.to(list, { autoAlpha: 1, duration: 0.14, ease: "none", stagger: each });
    gsap.to(list, {
      x: 0, y: 0, scale: 1, duration: quick ? SETTLE_TIME + 0.15 : 0.8 * T, ease: "expo.out",
      stagger: each, overwrite: "auto",
      onComplete: () => { gsap.set(list, { clearProps: CLEAR }); },
    });
  };
  const openGate = (): void => {
    if (b.gateOpen) return;
    b.gateOpen = true;
    land(b.all ? items : b.queue.splice(0), b.all);
    b.queue = [];
    b.onGate?.(false);
    b.onGate = null;
    done();
  };

  // a band came in fast (a fling, a jump, a settle): all its content rides in on its paper, solid, the same slide (site
  // fix 10-21: it waited on the gate, a bare panel for ~0.2 s; faded in on its own, it crossed bare world ahead of it)
  const ride = (dur: number): void => {
    b.all = b.gateOpen = true;
    b.queue = [];
    const list = items.filter((x) => !landedItems.has(x));
    if (stitch && unroll && stitch.dataset.landed === undefined) {
      stitch.dataset.landed = "";
      gsap.set(unroll, { clearProps: "clipPath" });
      list.push(unroll);
    }
    for (const x of list) landedItems.add(x);
    if (list.length) {
      gsap.fromTo(list, { x: s * 1.01 * paper.offsetWidth, y: 0, scale: 1, autoAlpha: 1 }, {
        x: 0, duration: dur, ease: "expo.out", overwrite: "auto",
        onComplete: () => { gsap.set(list, { clearProps: `${CLEAR},clipPath` }); },
      });
    }
    b.onGate?.(true);
    b.onGate = null;
    done();
  };
  // the panel: a triggered slide from its side, its shade riding with it (one pose), the spine drawn as it lands; the
  // content slides out from under the strip once the paper is (nearly) in (with it when the band came in fast)
  const playPanel = (dur: number, fast = false): void => {
    if (b.panelIn) return;
    b.panelIn = true;
    gsap.to(sheet, {
      xPercent: 0, duration: dur, ease: "expo.out",
      onUpdate() { if (this.ratio >= PANEL_IN_AT) sayPanelIn(); },
      onComplete: () => { b.panelDone = true; sayPanelIn(); done(); },
    });
    gsap.to(shade, { opacity: 1, duration: dur * 0.5, ease: "power1.out" });
    if (spine) gsap.to(spine, { scaleY: 1, duration: 0.7 * T, ease: "expo.out", delay: dur * SPINE_AT });
    if (fast || Math.abs(speed.n) >= FAST_N) ride(dur);
    // (site loop v4 round 1, the critic on a phone: the content was in before its title had risen) the title leads: the
    // gate waits until the head has played HEAD_LEAD of its time
    else gateCall = gsap.delayedCall(Math.max(dur * CONTENT_GATE, (HEAD_LEAD * T - (b.headPlayed ? headTl.time() : 0)) / headTl.timeScale()), openGate);
  };

  const killAll = (): void => {
    gateCall?.kill();
    stripRun?.kill();
    gateCall = stripRun = null;
    gsap.killTweensOf([...surfaces, ...items, ...(spine ? [spine] : []), ...(unroll ? [unroll] : []), wipe]);
  };
  const prime = (): void => {
    lift(true);
    killAll();
    b.sp = 0;
    b.landed = b.headPlayed = b.panelIn = b.panelDone = b.gateOpen = b.all = false;
    setStrip(0);
    gsap.set(sheet, { xPercent: panelFrom(s), force3D: true });
    gsap.set(shade, { opacity: 0 });
    headTl.invalidate().timeScale(1).pause(0);
    if (spine) gsap.set(spine, { scaleY: 0, transformOrigin: "50% 0%" });
    gsap.set(items, from);
    for (const x of items) landedItems.delete(x);
    if (stitch && unroll) { delete stitch.dataset.landed; gsap.set(unroll, stitchFrom(phone)); }
    b.queue = [];
    panelSaid = false;
    el.removeAttribute("data-panel-in");
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
    gsap.set([...items, ...(unroll ? [unroll] : [])], { clearProps: `${CLEAR},clipPath` });
    for (const x of items) landedItems.add(x);
    if (stitch) stitch.dataset.landed = "";
    b.queue = [];
    b.onGate = null;
    sayPanelIn();
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
    playPanel(SETTLE_TIME, true);
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
      if (p >= 1) { playHead(Math.abs(st.getVelocity()) >= FAST_V || Math.abs(speed.n) >= FAST_N); done(); }
    },
  });
  // the panel: plays once its top crosses PANEL_AT (or the scroll jumps past it)
  ScrollTrigger.create({
    trigger: panel, start: PANEL_AT(phone), end: "bottom top",
    onUpdate: (st) => { if (!b.panelIn && st.progress > 0) playPanel(PANEL_TIME * T, Math.abs(st.getVelocity()) >= FAST_V); },
  });
  // content: batches as they come up the screen, queued behind the gate
  if (items.length && !OFF.has("content")) {
    ScrollTrigger.batch(items, {
      start: "clamp(top 88%)", interval: 0.05, batchMax: 6,
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
    onToggle: (st) => {
      b.on = st.isActive;
      if (!b.landed || b.sp < 1) return;
      for (const x of keep) x.style.willChange = b.on ? "transform" : "";
    },
    onLeaveBack: () => b.reset(),
  });
  ScrollTrigger.create({ trigger: strip, start: "top bottom", end: "bottom top", onToggle: (st) => { b.stripOn = st.isActive; } });
  // focus inside settles it (playing out what is left)
  el.addEventListener("focusin", () => { b.settle(); });
  return b;
}

/** An element's layout top inside `box` (its offset parents summed: transforms are not counted). */
function topIn(el: HTMLElement, box: HTMLElement): number {
  let y = 0;
  for (let e: HTMLElement | null = el; e && e !== box; e = e.offsetParent as HTMLElement | null) y += e.offsetTop;
  return y;
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

/** The footer, the last strip (3.2): its paper rises over the lake (the last band's place reaches under it while the
 *  choreography runs), its shade casting up with it, then its rows land. Triggered like the panels, latched. */
function footerRise(ftr: HTMLElement, last: HTMLElement | null, phone: boolean, T: number): { settle(now?: boolean): void; reset(): void; destroy(): void } {
  const paper = ftr.querySelector<HTMLElement>(".ftr__paper"), shade = ftr.querySelector<HTMLElement>(".ftr__shade");
  const parts = Array.from(ftr.querySelectorAll<HTMLElement>(".ftr__more-head, .ftr__chips > li, .ftr__mark, .ftr__nav li, .ftr__side > *, .ftr__base"));
  const sheet = [paper, shade].filter((x): x is HTMLElement => x !== null);
  // the lake under the footer: the last band's world reaches down by the footer's height (measured, never per frame)
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
    // (its rows drop in from under its top hem, as every band's do: site loop v3 round 1)
    gsap.set(parts, { y: -24, autoAlpha: 0 });
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

/** Lenis on the window, on GSAP's ticker (phase G3; only ?smooth=lenis until lane F's OK), its own chunk. */
async function smoothWheel(root: HTMLElement): Promise<Lenis> {
  const { default: Lenis } = await import("lenis");
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

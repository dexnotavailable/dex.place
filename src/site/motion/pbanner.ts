// The project banners' motion (Dex 10-22, lanes\site-art-1022\PLAN.md 5.4), under the cards' contract (CardDeck,
// lanes\motion\DESIGN-1019.md 7.3): motion/pcard.ts initCards hands a banner list (ul[data-pban]) to initBanners, so
// the choreography (motion/choreo.ts) and main.ts's "cards" step drive it as they drove the cards.
//
// Who moves what (one owner per property):
//   .pban__in      GSAP: the entrance (x, rotation, autoAlpha) and the scroll-speed skew (skewY)
//   .pban__tilt    CSS: touch screens tilt with the scroll (a view timeline)
//   .pban__lift    CSS: the hover lift (translate)
//   .pban__bk      GSAP: the plate's lag (transform); its img drifts (CSS translate)
//   .pban__num     GSAP: the counter-move (transform)
//   .pban__sl      GSAP: the slash drawn from the paper's side (transform); CSS: the hover sweep (scale)
//   .pban__hero    GSAP: from the world side (transform, autoAlpha); CSS: the hover pop (translate)
//   .pban__fx      GSAP: its sweep (transform, autoAlpha)
//   .pban__main    this file: the CTA's magnetic pull (translate)
// The idle loops are CSS (compositor); this file only pauses them off screen (.is-off) and while G says so (live).

import { gsap } from "gsap";
import type { CardDeck, CardHost } from "./pcard.ts";

interface Ban {
  li: HTMLElement;
  inn: HTMLElement;
  bk: HTMLElement | null;
  num: HTMLElement | null;
  sl: HTMLElement | null;
  hero: HTMLElement | null;
  heroArt: HTMLElement | null;
  fx: HTMLElement | null;
  chrome: HTMLElement[];
  chars: HTMLElement[];
  rest: HTMLElement[];
  shine: HTMLElement | null;
  main: HTMLElement | null;
  skew: number;
}

const decks = new WeakMap<HTMLElement, { deck: CardDeck; host: CardHost; wake: () => void }>();
const LANDED = { x: 0, rotation: 0, autoAlpha: 1 };

/** The name's characters in a mask, built once (the link keeps its text for screen readers in .pban__sr). */
function splitName(link: HTMLElement | null): HTMLElement[] {
  if (!link) return [];
  const done = link.querySelector<HTMLElement>(".pban__nm");
  if (done) return Array.from(done.children) as HTMLElement[];
  const text = link.textContent ?? "";
  const nm = document.createElement("span");
  nm.className = "pban__nm";
  nm.setAttribute("aria-hidden", "true");
  for (const ch of text) {
    const s = document.createElement("span");
    s.className = "pban__ch";
    s.textContent = ch;
    nm.append(s);
  }
  const sr = document.createElement("span");
  sr.className = "pban__sr";
  sr.textContent = text;
  link.replaceChildren(nm, sr);
  return Array.from(nm.children) as HTMLElement[];
}

function banOf(li: HTMLElement, motion: boolean): Ban | null {
  const q = <T extends HTMLElement>(s: string): T | null => li.querySelector<T>(s);
  const inn = q(".pban__in");
  if (!inn) return null;
  return {
    li, inn,
    bk: q(".pban__bk"), num: q(".pban__num"), sl: q(".pban__sl"), hero: q(".pban__hero"), heroArt: q(".pban__hero .cart__art"),
    fx: q(".pban__fx"),
    chrome: [q(".pban__no"), q(".pban__plat"), q(".pban__cap"), q(".pban__brackets")].filter(Boolean) as HTMLElement[],
    chars: motion ? splitName(q(".pban__link")) : [],
    rest: [q(".pban__state"), q(".pban__line"), q(".pban__acts")].filter(Boolean) as HTMLElement[],
    shine: q(".pban__shine"),
    main: q(".pban__main"),
    skew: 0,
  };
}

/** list = the ul[data-pban] (or a page header's [data-pban]). Without a host.velocity (deep pages), there is no skew. */
export function initBanners(list: HTMLElement, given: CardHost): CardDeck {
  const known = decks.get(list);
  const host: CardHost = { ...given };
  if (known) {
    if (given.velocity) { known.host.velocity = host.velocity; known.wake(); }
    return known.deck;
  }
  const motion = !host.reduced;
  const bans = Array.from(list.querySelectorAll<HTMLElement>(".pban"))
    .map((li) => banOf(li, motion))
    .filter((b): b is Ban => !!b);
  const phone = matchMedia("(max-width: 699px)");
  const running = new Set<gsap.core.Timeline>();
  const cleanup: (() => void)[] = [];
  let liveOn = true;
  const seen = new Map<Ban, boolean>();
  const paint = (b: Ban): void => { b.inn.classList.toggle("is-off", !(liveOn && (seen.get(b) ?? true))); };

  // ---- the art arrives before the banners do: within 1.5 screens every layer is fetched, banner 1 first (DOM order)
  if ("IntersectionObserver" in window) {
    const near = new IntersectionObserver((es) => {
      if (!es.some((e) => e.isIntersecting)) return;
      near.disconnect();
      for (const b of bans) for (const im of b.li.querySelectorAll<HTMLImageElement>("img[loading=lazy]")) im.loading = "eager";
    }, { rootMargin: "150% 0px" });
    near.observe(list);
    cleanup.push(() => near.disconnect());
    const vis = new IntersectionObserver((es) => {
      for (const e of es) {
        const b = bans.find((k) => k.li === e.target);
        if (b) { seen.set(b, e.isIntersecting); paint(b); }
      }
    }, { rootMargin: "10% 0px" });
    for (const b of bans) vis.observe(b.li);
    cleanup.push(() => vis.disconnect());
  }

  // ---- the scroll's speed leans each banner (skewY, +-2deg; phones 1.2), G's n read in gsap.ticker
  let ticking = false;
  const tick = (): void => {
    const v = host.velocity ? Math.max(-1, Math.min(1, host.velocity())) : 0;
    for (const b of bans) {
      if (b.inn.classList.contains("is-off")) continue;
      const sk = Math.round(v * (phone.matches ? 1.2 : 2) * 100) / 100;
      if (sk !== b.skew) { b.skew = sk; gsap.set(b.inn, { skewY: sk }); }
    }
  };
  const wake = (): void => { if (!ticking && motion && host.velocity) { gsap.ticker.add(tick); ticking = true; } };
  wake();

  // ---- the CTA pulls toward a fine pointer, up to 6 px, within its box + 24 px (the lift, plate, hero pop, slash
  // sweep, name bar and the siblings' dim are CSS)
  if (motion && host.fine) {
    for (const b of bans) {
      const main = b.main;
      if (!main) continue;
      const lift = b.li.querySelector<HTMLElement>(".pban__lift") ?? b.li;
      const on = (e: PointerEvent): void => {
        if (e.pointerType !== "mouse") return;
        const r = main.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
        const rx = r.width / 2 + 24, ry = r.height / 2 + 24;
        const inside = Math.abs(dx) < rx && Math.abs(dy) < ry;
        main.style.translate = inside ? `${(Math.max(-1, Math.min(1, dx / rx)) * 6).toFixed(1)}px ${(Math.max(-1, Math.min(1, dy / ry)) * 6).toFixed(1)}px` : "";
      };
      const off = (): void => { main.style.translate = ""; };
      lift.addEventListener("pointermove", on);
      lift.addEventListener("pointerleave", off);
      cleanup.push(() => { lift.removeEventListener("pointermove", on); lift.removeEventListener("pointerleave", off); main.style.translate = ""; });
    }
  }

  // ---- the entrance (PLAN 5.4): from its side, the plate lagging, the slash drawn from that side, the numeral
  // counter-moving, the hero in from the world side, the fx sweeping, the name's letters up in their mask
  const inner = (b: Ban): Element[] =>
    [b.bk, b.num, b.sl, b.hero, b.heroArt, b.fx, ...b.chrome, ...b.chars, ...b.rest].filter(Boolean) as Element[];

  function settle(): void {
    for (const tl of running) tl.kill();
    running.clear();
    if (!motion) return;
    for (const b of bans) {
      gsap.set(b.inn, LANDED);
      gsap.set(inner(b), { clearProps: "transform,opacity,visibility" });
    }
  }

  function prime(): void {
    if (!motion) return;
    for (const tl of running) tl.kill();
    running.clear();
    for (const b of bans) gsap.set(b.inn, { autoAlpha: 0 });
  }

  function entrance(o: { side: "l" | "r"; index?: number; solid?: boolean }): gsap.core.Timeline {
    const tl = gsap.timeline({ paused: true, onComplete: () => { running.delete(tl); } });
    if (!motion) return tl;
    running.add(tl);
    const s = o.side === "r" ? 1 : -1;
    const D = phone.matches ? 0.8 : 1;
    const vw = innerWidth;
    const these = o.index !== undefined ? bans.filter((_, i) => i === o.index) : bans;
    tl.set(these.map((b) => b.inn), { autoAlpha: 0, immediateRender: false }, 0);
    const ft = (t: gsap.TweenTarget, from: gsap.TweenVars, to: gsap.TweenVars, at: number): void => {
      tl.set(t, { ...from, immediateRender: false }, 0);
      tl.fromTo(t, from, { ...to, immediateRender: false }, at);
    };
    these.forEach((b, i) => {
      const at = o.index !== undefined ? 0 : i * 0.14;
      ft(b.inn, { x: s * 0.24 * vw, rotation: s * 2 }, { x: 0, rotation: 0, duration: 1.1 * D, ease: "expo.out" }, at);
      tl.to(b.inn, { autoAlpha: 1, duration: 0.25, ease: "none" }, at);
      if (b.bk) ft(b.bk, { x: s * 48 }, { x: 0, duration: 1.3 * D, ease: "expo.out" }, at);
      if (b.sl) ft(b.sl, { scaleX: 0, transformOrigin: s < 0 ? "0% 50%" : "100% 50%" }, { scaleX: 1, duration: 0.7 * D, ease: "expo.out" }, at + 0.15 * D);
      if (b.num) ft(b.num, { x: -s * 80 }, { x: 0, duration: 1.3 * D, ease: "expo.out" }, at);
      if (b.hero) ft(b.hero, { x: -s * 64, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 0.9 * D, ease: "expo.out" }, at + 0.3 * D);
      if (b.heroArt) ft(b.heroArt, { scale: 1.18 }, { scale: 1, duration: 1.2 * D, ease: "expo.out" }, at + 0.3 * D);
      if (b.fx) ft(b.fx, { x: s * 0.12 * vw, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 0.8 * D, ease: "expo.out" }, at + 0.45 * D);
      if (b.chrome.length) ft(b.chrome, { y: -12, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.4 * D, ease: "power3.out", stagger: 0.04 }, at + 0.4 * D);
      if (b.chars.length) ft(b.chars, { yPercent: 110 }, { yPercent: 0, duration: 0.65 * D, ease: "expo.out", stagger: 0.018 }, at + 0.55 * D);
      if (b.rest.length) ft(b.rest, { y: 24, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.6 * D, ease: "expo.out", stagger: 0.06 }, at + 0.62 * D);
      const shine = b.shine;
      if (shine) tl.call(() => { shine.animate([{ transform: "translateX(-100%)" }, { transform: "translateX(100%)" }], { duration: 1000 * D, easing: "cubic-bezier(.45, 0, .55, 1)" }); }, undefined, at + 0.9 * D);
    });
    tl.call(() => { for (const b of these) gsap.set(inner(b), { clearProps: "transform,opacity,visibility" }); });
    return tl;
  }

  const deck: CardDeck = {
    prime,
    entrance,
    settle,
    reset: prime,
    live(on: boolean) {
      liveOn = on;
      for (const b of bans) paint(b);
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
  decks.set(list, { deck, host, wake });
  return deck;
}

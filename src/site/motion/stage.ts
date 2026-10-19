// The page's stage (Dex 10-19, the redesign: "premium web" motion; GSAP, Motion or Lenis approved). Own chunk, loaded
// by main.ts once the "dex" mark has written itself and the page is idle; never with reduced motion, Save-Data or in
// an embed (the page is then simply all there).
// - The smooth wheel: Lenis on desktop pointers (touch screens keep their own native scroll), driven by GSAP's ticker so
//   ScrollTrigger and the scroll share one frame. Dialogs, popovers and anything that scrolls on its own keep the wheel.
//   Lane F's own jumps (the four ways in) are never fought: a glide is dropped whenever the flow changes or a way in
//   starts the game.
// - Entrances (motion/stage-plan.ts, from data-enter): white grounds slide in from their side, then their content;
//   bands draw across; cards slide in with an ease; blocks rise. Only what is still below the screen is set back.
// - Lean: [data-lean] things move a little with the scroll's speed and settle when it stops.
// - Breathing is CSS (styles/stage.css [data-breathe]); here each one only gets its own phase.
// Reduced motion switched on later: everything is put back as the page has it, the wheel goes native.

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import {
  ITEMS, isAhead, leanOf, parseEnter, planOf, restOf, startOf, type EnterFrom, type EnterKind, type LeanKind,
} from "./stage-plan.ts";
import { stageStarted, stageStopped, type Stage } from "./stage-ready.ts";

gsap.registerPlugin(ScrollTrigger);

/** Lane F's "a way in starts the game" (motion/enter.ts ENTER_EVENT; named here so this chunk never pulls the opening's
 *  audio in with it; a test keeps the two the same). */
export const WAY_IN_EVENT = "dex:enter";

/** Things still on their way in: the lean leaves them alone until they have landed. */
const entering = new WeakSet<Element>();

/** What GSAP leaves on a thing it moved, taken off once it has landed (so the CSS has it back). */
const CLEAR = "transform,opacity,translate,rotate,scale,transformOrigin";

export function initStage(fine: MediaQueryList): void {
  const root = document.documentElement;
  const mm = gsap.matchMedia();
  mm.add("(prefers-reduced-motion: no-preference)", () => {
    // (Lenis ships last, phase G3 of lanes/motion/DESIGN-1019.md, once lane F routes its jumps through scroller.ts;
    // until then only ?smooth=lenis turns it on, for trying)
    const lenis = fine.matches && /[?&]smooth=lenis/.test(location.search) ? smoothWheel(root) : null;
    root.setAttribute("data-stage", "");

    const enter = (els: Element | readonly Element[], kind: EnterKind, from?: EnterFrom): void => {
      const list = (Array.isArray(els) ? els : [els]) as HTMLElement[];
      for (const el of list) if (kind === "paper") paper(el, from ?? "left");
      enterAll(list.filter(() => kind !== "paper"), kind, from);
    };

    // the grounds and their content, then everything else by kind (a row arriving together staggers)
    for (const el of document.querySelectorAll<HTMLElement>('[data-enter="paper"]')) paper(el, parseEnter("paper", el.dataset.enterFrom)!.from);
    for (const kind of ["band", "rise", "card", "fade"] as const) {
      const els = Array.from(document.querySelectorAll<HTMLElement>(`[data-enter="${kind}"]`)).filter((el) => !el.closest("[data-enter-done]"));
      enterAll(els, kind);
    }
    breathe();
    const leaning = lean();

    const refresh = (): void => ScrollTrigger.refresh();
    // the page's height moves under the triggers as fonts, images and the world's windows land
    let t = 0;
    const ro = new ResizeObserver(() => {
      clearTimeout(t);
      t = window.setTimeout(refresh, 200);
    });
    ro.observe(document.body);
    void document.fonts?.ready.then(refresh);

    const stage: Stage = { gsap, ScrollTrigger, lenis, enter, refresh };
    stageStarted(stage);
    return () => {
      // (reduced motion switched on: GSAP puts every thing back; the wheel goes native)
      ro.disconnect();
      clearTimeout(t);
      leaning();
      lenis?.destroy();
      root.removeAttribute("data-stage");
      stageStopped();
    };
  });
}

/** Lenis on the window, on GSAP's ticker; dialogs, popovers, frames and nested scrollers keep the wheel. */
function smoothWheel(root: HTMLElement): Lenis {
  const lenis = new Lenis({
    autoRaf: false,
    lerp: 0.09,
    smoothWheel: true,
    allowNestedScroll: true,
    stopInertiaOnNavigate: true,
    prevent: (node) => node.matches("dialog, [popover], iframe, [data-lenis-prevent]"),
  });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  // lane F's jumps (the four ways in, motion/column.ts) land where they jump: drop any glide in flight
  const drop = (): void => {
    lenis.stop();
    lenis.start();
  };
  new MutationObserver(drop).observe(root, { attributes: true, attributeFilter: ["data-flow"] });
  document.addEventListener(WAY_IN_EVENT, drop);
  window.addEventListener("hashchange", drop);
  return lenis;
}

/** A white ground slides in from its side; then its items come in, in order. */
function paper(el: HTMLElement, from: EnterFrom): void {
  const plan = planOf("paper", from);
  if (!isAhead(el.getBoundingClientRect().top, innerHeight, plan)) return;
  const items = Array.from(el.querySelectorAll<HTMLElement>("[data-enter-item]")).filter((i) => i.closest('[data-enter="paper"]') === el);
  el.setAttribute("data-enter-done", "");
  [el, ...items].forEach((x) => entering.add(x));
  // (a ground that moves up or down is watched through its parent: its own box moves with it)
  const trigger = from === "up" || from === "down" ? (el.parentElement ?? el) : el;
  const tl = gsap.timeline({
    scrollTrigger: { trigger, start: startOf(plan), once: true },
    onComplete: () => {
      gsap.set([el, ...items], { clearProps: CLEAR });
      [el, ...items].forEach((x) => entering.delete(x));
    },
  });
  tl.from(el, { ...plan.from, duration: plan.duration, ease: plan.ease, immediateRender: true });
  if (items.length) {
    const ip = ITEMS.plan;
    tl.from(items, { ...ip.from, duration: ip.duration, ease: ip.ease, stagger: ip.stagger, immediateRender: true }, plan.duration * ITEMS.after);
  }
}

/** Things of one kind: each set back to its start, then brought in as they reach their line (a row together). */
function enterAll(els: readonly HTMLElement[], kind: EnterKind, fromOverride?: EnterFrom): void {
  const vh = innerHeight;
  const ahead = els.filter((el) => isAhead(el.getBoundingClientRect().top, vh, planOf(kind)));
  if (!ahead.length) return;
  for (const el of ahead) {
    const plan = planOf(kind, fromOverride ?? parseEnter(kind, el.dataset.enterFrom)?.from);
    gsap.set(el, plan.from);
    el.setAttribute("data-enter-done", "");
    entering.add(el);
  }
  const plan = planOf(kind);
  const order = (el: HTMLElement): number => Number(el.dataset.enterI ?? 0);
  ScrollTrigger.batch(ahead, {
    start: startOf(plan),
    once: true,
    onEnter: (batch) => {
      const row = (batch as HTMLElement[]).slice().sort((a, b) => order(a) - order(b));
      gsap.to(row, {
        ...restOf(plan.from),
        duration: plan.duration,
        ease: plan.ease,
        stagger: plan.stagger,
        overwrite: "auto",
        onComplete: () => {
          gsap.set(row, { clearProps: CLEAR });
          row.forEach((x) => entering.delete(x));
        },
      });
    },
  });
}

/** Every breathing thing its own phase (CSS does the breathing). */
function breathe(): void {
  document.querySelectorAll<HTMLElement>("[data-breathe]").forEach((el, i) => el.style.setProperty("--br-i", String((i * 5) % 11)));
}

/** [data-lean]: pushed a little by the scroll's speed, settling when it stops. Returns its undo. */
function lean(): () => void {
  const els = Array.from(document.querySelectorAll<HTMLElement>("[data-lean]"));
  if (!els.length) return () => {};
  const near = new Set<HTMLElement>();
  const io = new IntersectionObserver((es) => {
    for (const e of es) {
      if (e.isIntersecting) near.add(e.target as HTMLElement);
      else near.delete(e.target as HTMLElement);
    }
  }, { rootMargin: "20% 0px" });
  const items = els.map((el) => {
    io.observe(el);
    const kind: LeanKind = el.dataset.lean === "skew" ? "skew" : "lag";
    const k = Number(el.dataset.leanK ?? 1) || 1;
    return { el, kind, k, to: gsap.quickTo(el, kind === "skew" ? "skewY" : "y", { duration: 0.7, ease: "power3.out" }) };
  });
  const push = (v: number): void => {
    for (const it of items) if (near.has(it.el) && !entering.has(it.el)) it.to(leanOf(it.kind, v, it.k));
  };
  const settle = gsap.delayedCall(0.12, () => push(0)).pause();
  const st = ScrollTrigger.create({
    onUpdate: (self) => {
      push(self.getVelocity());
      settle.restart(true);
    },
  });
  return () => {
    st.kill();
    settle.kill();
    io.disconnect();
  };
}

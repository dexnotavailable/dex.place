// The world -> website handoff on the root page.
//
// Sets --world-progress (0..1) on the .world element itself as the site sheet
// rises over the sticky world: the black cinematic bars recede and the world
// dims and shrinks slightly (shell.css). Every consumer lives inside .world, so
// the write only restyles that small subtree, never the whole document (a
// custom property on <html> is inherited by every element and made each scroll
// frame recalc ~750 elements on phones). When the sheet fully covers the
// world, writes stop, the world is paused and it is hidden from paint.
//
// World mount contract (for the world workflow): put a module at
// src/world/mount.ts exporting
//   mount(el: HTMLElement): { pause(): void; resume(): void; destroy(): void }
// It is code-split and loaded only on the root page. It should honour
// prefers-reduced-motion itself (no autoplay). The site works without it.
//
// Loading starts with the page, not with its first animation frame or its
// load event: a page opened at the top (the usual arrival) mounts the World as
// soon as this script runs (document interactive), so a background tab loads
// it too and it simply draws once shown. A page that opens covered (a deep link
// to a section, or a reload the browser scrolls back down) mounts it once the
// page is idle, paused, so scrolling up finds it ready. Animation frames only
// drive the scroll visuals.

export interface WorldHandle {
  readonly ready?: Promise<void>;
  /** Resolves when the World draws its first scene frame (before it is playable). */
  readonly shown?: Promise<void>;
  focus?(): void;
  pause(): void;
  resume(): void;
  destroy(): void;
}

interface WorldModule {
  mount(el: HTMLElement): WorldHandle;
}

export function initWorld(_reduced: MediaQueryList): void {
  if (document.documentElement.dataset.embed === "world") return;
  const world = document.querySelector<HTMLElement>("[data-world-mount]");
  if (!world) return;
  const stage = world.querySelector<HTMLElement>("[data-world-stage]") ?? world;
  let handle: WorldHandle | null = null;
  let covered = false;
  let raf = 0;
  let last = -1;
  let started = false;
  let destroyed = false;
  // A deep link to a section lands covered, and a reload or history visit may
  // have its scroll position restored; either is only certain once the page
  // has loaded, so the start waits for that (then loads behind the site when
  // idle). Any other arrival opens at the top and starts right away.
  const deep = !!location.hash && location.hash !== "#world";
  const nav = performance.getEntriesByType?.("navigation")[0] as PerformanceNavigationTiming | undefined;
  const restores = history.scrollRestoration === "auto" && (nav?.type === "reload" || nav?.type === "back_forward");
  let waiting = (deep || restores) && document.readyState !== "complete";
  // The still frame's direct "World" link is the no-script route. With
  // scripts the World is loading, so the link only comes back if that fails.
  const fallback = world.querySelector<HTMLElement>(".world__fallback");

  // "World" links point at the empty #world anchor at offset 0 (layout.ts), so
  // the browser scrolls back up by itself (smoothly unless reduced motion).
  // Focus follows into the world once it is no longer covered (a hidden
  // element can't take focus), so keyboard users land in the world instead of
  // staying on the link they left behind.
  // The world may still compute as hidden for a frame after it uncovers (its
  // visibility can transition), so a refused focus retries on a few frames.
  let pending = location.hash === "#world";
  let tries = 0;
  const land = (): void => {
    if (!pending || covered) return;
    if (handle?.focus) { handle.focus(); pending = false; return; }
    world.focus({ preventScroll: true });
    if (document.activeElement === world || (tries += 1) > 8) pending = false;
    else requestAnimationFrame(land);
  };
  const toWorld = (): void => {
    pending = true;
    tries = 0;
    land();
  };

  const update = (): void => {
    raf = 0;
    const height = world.offsetHeight || window.innerHeight;
    const p = Math.min(1, Math.max(0, window.scrollY / height));
    const nowCovered = p >= 0.999;
    // Uncovered (at load, or scrolled back up before the idle start): start now.
    if (!nowCovered && !waiting) start();
    // Covered and staying covered: nothing visible changes, skip the write.
    if (nowCovered && covered) return;
    if (Math.abs(p - last) < 0.0005) return;
    last = p;
    world.style.setProperty("--world-progress", nowCovered ? "1" : p.toFixed(4));
    if (nowCovered !== covered) {
      const focusedInside = world.contains(document.activeElement);
      covered = nowCovered;
      world.toggleAttribute("data-covered", covered);
      if (covered) {
        handle?.pause();
        // A hidden child canvas must not keep receiving the site's keys.
        if (focusedInside) document.getElementById("main")?.focus({ preventScroll: true });
      }
      else handle?.resume();
    }
    land();
  };
  const kick = (): void => {
    if (!raf) raf = requestAnimationFrame(update);
  };
  window.addEventListener("scroll", kick, { passive: true });
  window.addEventListener("resize", kick);

  document.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const target = e.target instanceof Element ? e.target : null;
    const link = target?.closest("a[href='#world']");
    if (!link) return;
    // From the menu: close it first, or it would stay open over the world.
    const pop = link.closest<HTMLElement>("[popover]");
    if (pop?.matches(":popover-open")) pop.hidePopover();
    toWorld();
  });
  // Back/forward onto #world. (A fresh load of /#world already starts in the
  // world at the top of the page; the browser owns focus there.)
  window.addEventListener("hashchange", () => {
    if (location.hash === "#world") toWorld();
  });

  const modules = import.meta.glob<WorldModule>("../../world/mount.ts");
  const load = Object.values(modules)[0];
  function start(): void {
    if (!load || started || destroyed) return;
    started = true;
    world?.setAttribute("aria-busy", "true");
    if (fallback) fallback.hidden = true;
    load().then(async (mod) => {
      if (destroyed) return;
      handle = mod.mount(stage);
      if (covered) handle.pause();
      void handle.shown?.then(() => { if (!destroyed) world?.setAttribute("data-world-shown", ""); }, () => {});
      await handle.ready;
      if (destroyed) return;
      world?.setAttribute("data-world-ready", "");
      world?.setAttribute("aria-busy", "false");
      if (!covered && (document.activeElement === world || document.activeElement === document.body && (!location.hash || location.hash === "#world"))) handle.focus?.();
      land();
    }).catch((error: unknown) => {
      handle?.destroy();
      handle = null;
      if (!destroyed) {
        world?.setAttribute("aria-busy", "false");
        if (fallback) fallback.hidden = false;
        const failure = world?.querySelector<HTMLElement>("[data-world-failure]");
        if (failure) { failure.hidden = false; failure.textContent = "The world couldn't load. You can still use the site."; }
        console.error("[site] world failed to load; the website still works", error);
      }
    });
  }
  // Landed covered: the World loads behind the site once the page is idle,
  // paused, without taking focus or scroll from the section being read.
  const landed = (): void => {
    waiting = false;
    update();
    if (started || destroyed) return;
    if (typeof requestIdleCallback === "function") requestIdleCallback(start, { timeout: 2000 });
    else setTimeout(start, 1000);
  };
  update();
  if (!started) {
    if (document.readyState === "complete") landed();
    else window.addEventListener("load", landed, { once: true });
  }
  window.addEventListener("pagehide", (event) => {
    if (event.persisted) handle?.pause();
    else { destroyed = true; handle?.destroy(); }
  });
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) { if (!covered) handle?.resume(); kick(); }
  });
}

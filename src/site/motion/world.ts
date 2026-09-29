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

export interface WorldHandle {
  pause(): void;
  resume(): void;
  destroy(): void;
}

interface WorldModule {
  mount(el: HTMLElement): WorldHandle;
}

export function initWorld(_reduced: MediaQueryList): void {
  const world = document.querySelector<HTMLElement>("[data-world-mount]");
  if (!world) return;
  const stage = world.querySelector<HTMLElement>("[data-world-stage]") ?? world;
  let handle: WorldHandle | null = null;
  let covered = false;
  let raf = 0;
  let last = -1;

  // "World" links point at the empty #world anchor at offset 0 (layout.ts), so
  // the browser scrolls back up by itself (smoothly unless reduced motion).
  // Focus follows into the world once it is no longer covered (a hidden
  // element can't take focus), so keyboard users land in the world instead of
  // staying on the link they left behind.
  // The world may still compute as hidden for a frame after it uncovers (its
  // visibility can transition), so a refused focus retries on a few frames.
  let pending = false;
  let tries = 0;
  const land = (): void => {
    if (!pending || covered) return;
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
    // Covered and staying covered: nothing visible changes, skip the write.
    if (nowCovered && covered) return;
    if (Math.abs(p - last) < 0.0005) return;
    last = p;
    world.style.setProperty("--world-progress", nowCovered ? "1" : p.toFixed(4));
    if (nowCovered !== covered) {
      covered = nowCovered;
      world.toggleAttribute("data-covered", covered);
      if (covered) handle?.pause();
      else handle?.resume();
    }
    land();
  };
  const kick = (): void => {
    if (!raf) raf = requestAnimationFrame(update);
  };
  window.addEventListener("scroll", kick, { passive: true });
  window.addEventListener("resize", kick);
  update();

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

  // Vite resolves this at build time; with no world module the map is empty.
  const modules = import.meta.glob<WorldModule>("../../world/mount.ts");
  const load = Object.values(modules)[0];
  if (!load) return;
  load()
    .then((mod) => {
      handle = mod.mount(stage);
      world.setAttribute("data-world-ready", "");
      if (covered) handle.pause();
    })
    .catch((error: unknown) => {
      console.error("[site] world failed to load; the website still works", error);
    });
}

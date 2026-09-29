// Section nav (DESIGN-SYSTEM.md §4).
//
// - Indicator: a square yellow block sits behind the current section's link
//   and glides to whichever link is hovered or focused, then back.
// - Scroll-spy (home page): as you scroll, the section being read becomes the
//   current one (aria-current="true" on its links, bar and menu alike). Links
//   are ordinary #anchors, so jumping and smooth scrolling are the browser's
//   own (smooth unless reduced motion, base.css).
// - Stuck: once the header sits over content it gets its bottom edge.
// Without JS inner pages still mark their section; the home page marks none.

export function initNav(): void {
  const nav = document.querySelector<HTMLElement>(".nav");
  const list = nav?.querySelector<HTMLElement>("[data-nav]");
  const ind = nav?.querySelector<HTMLElement>("[data-nav-ind]");
  if (!nav || !list || !ind) return;
  const links = Array.from(list.querySelectorAll<HTMLAnchorElement>(".nav__link"));
  let current: HTMLElement | null = links.find((a) => a.hasAttribute("aria-current")) ?? null;
  let moving = false;

  const place = (target: HTMLElement | null, instant = false): void => {
    if (!target || target.offsetParent === null) {
      nav.removeAttribute("data-ind");
      ind.style.opacity = "0";
      return;
    }
    const base = nav.getBoundingClientRect();
    const r = target.getBoundingClientRect();
    if (instant || ind.style.opacity !== "1") ind.style.transition = "none";
    ind.style.setProperty("--x", `${Math.round(r.left - base.left)}px`);
    ind.style.setProperty("--w", `${Math.round(r.width)}px`);
    ind.style.opacity = "1";
    // The indicator now marks the current section; drop the static highlight.
    nav.setAttribute("data-ind", "");
    void ind.offsetWidth;
    ind.style.transition = "";
  };

  const rest = (): void => {
    moving = false;
    place(current);
  };
  const go = (a: HTMLElement): void => {
    if (!moving && current) place(current, true);
    moving = true;
    place(a);
  };

  for (const a of links) {
    a.addEventListener("pointerenter", () => go(a));
    a.addEventListener("focus", () => go(a));
  }
  list.addEventListener("pointerleave", rest);
  list.addEventListener("focusout", (e) => {
    if (!list.contains(e.relatedTarget as Node | null)) rest();
  });
  window.addEventListener("resize", () => place(moving ? null : current, true));
  void document.fonts?.ready.then(() => place(current, true));
  place(current, true);

  // Scroll-spy, home page only (sections carry the ids the links point at).
  const spyLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>("a[data-spy][href^='#']"));
  if (!spyLinks.length) return;
  const ids = Array.from(new Set(spyLinks.map((a) => a.dataset.spy!)));
  const sections = ids
    .map((id) => document.getElementById(id))
    .filter((el): el is HTMLElement => el !== null);
  if (!sections.length) return;
  let active = "";
  let raf = 0;
  const update = (): void => {
    raf = 0;
    // The section being read is the last one whose top has passed a line a
    // third of the way down the screen; at the very bottom, the last one.
    const line = Math.min(window.innerHeight * 0.34, 300);
    let id = "";
    for (const el of sections) if (el.getBoundingClientRect().top <= line) id = el.id;
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) id = sections.at(-1)!.id;
    if (id === active) return;
    active = id;
    for (const a of spyLinks) {
      if (a.dataset.spy === id) a.setAttribute("aria-current", "true");
      else a.removeAttribute("aria-current");
    }
    current = links.find((a) => a.dataset.spy === id) ?? null;
    if (!moving) place(current);
  };
  const kick = (): void => {
    if (!raf) raf = requestAnimationFrame(update);
  };
  window.addEventListener("scroll", kick, { passive: true });
  window.addEventListener("resize", kick);
  update();
}

// The header gets its bottom edge once it is stuck over content. On the
// home page its mark waits until the big intro mark has scrolled under it.
export function initStuck(): void {
  const hdr = document.querySelector<HTMLElement>("[data-hdr]");
  if (!hdr) return;
  const big = document.querySelector<HTMLElement>(".intro__mark");
  if (big) hdr.setAttribute("data-solo", "");
  let raf = 0;
  const update = (): void => {
    raf = 0;
    const rest = hdr.parentElement?.offsetTop ?? 0;
    hdr.toggleAttribute("data-stuck", window.scrollY > rest + 8);
    if (big) hdr.toggleAttribute("data-mark", big.getBoundingClientRect().bottom < hdr.offsetHeight);
  };
  const kick = (): void => {
    if (!raf) raf = requestAnimationFrame(update);
  };
  window.addEventListener("scroll", kick, { passive: true });
  window.addEventListener("resize", kick);
  update();
}

// Mobile menu focus (WCAG 2.4.3, 2.4.11). The menu is a native popover, so it
// opens and closes without JS; this makes it behave like a modal sheet:
// - on open, focus moves to its Close key (the Menu key is covered);
// - everything behind it is inert, and Tab / Shift+Tab step through its keys
//   and wrap, in every engine;
// - Esc (native light dismiss) or Close hides it and focus returns to the
//   Menu key;
// - picking a section on this page closes it, then jumps there and puts focus
//   on the section itself, so the next Tab carries on from where you landed.
// Every focus move here passes preventScroll: focusing the sticky Menu key
// lets the browser scroll the page toward it, which cancels a jump that has
// just started (phones and tablets, mid-page).
const FOCUSABLE = "a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex='-1'])";

export function initMenu(): void {
  const menu = document.querySelector<HTMLElement>("#menu[popover]");
  const opener = document.querySelector<HTMLButtonElement>("button.hdr__menu");
  if (!menu || !opener || typeof menu.showPopover !== "function") return;
  let inerted: HTMLElement[] = [];
  /** The section picked in the sheet; the jump runs once the sheet has closed. */
  let jumpTo: { el: HTMLElement; hash: string } | null = null;

  // Scrolls to a section (smoothly unless reduced motion: base.css) and gives
  // it focus without a second scroll. Its heading (the one that names it)
  // takes the focus, so screen readers announce where you are.
  const jump = (el: HTMLElement, hash: string): void => {
    if (location.hash === hash) el.scrollIntoView();
    else location.hash = hash;
    const named = el.getAttribute("aria-labelledby");
    const heading = (named && document.getElementById(named)) || el.querySelector<HTMLElement>("h1, h2, h3") || el;
    if (!heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1");
    heading.focus({ preventScroll: true });
  };

  const focusables = (): HTMLElement[] =>
    Array.from(menu.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null || el.getClientRects().length > 0);

  // Inert every branch of the page except the one that holds the menu.
  const lock = (): void => {
    for (let node: HTMLElement | null = menu; node && node !== document.body; node = node.parentElement) {
      const parent: HTMLElement | null = node.parentElement;
      if (!parent) break;
      for (const sib of Array.from(parent.children)) {
        if (sib === node || !(sib instanceof HTMLElement) || sib.inert || sib.tagName === "SCRIPT") continue;
        sib.inert = true;
        inerted.push(sib);
      }
    }
  };
  const unlock = (): void => {
    for (const el of inerted) el.inert = false;
    inerted = [];
  };

  // Unlock before the popover hides, so the browser's own focus return to
  // the Menu key (Esc, Close) is not blocked by inert.
  menu.addEventListener("beforetoggle", (event) => {
    if ((event as ToggleEvent).newState === "closed") unlock();
  });
  menu.addEventListener("toggle", (event) => {
    if ((event as ToggleEvent).newState === "open") {
      lock();
      // `autofocus` on the Close key already does this where supported.
      if (!menu.contains(document.activeElement)) focusables()[0]?.focus();
      return;
    }
    unlock();
    const target = jumpTo;
    jumpTo = null;
    if (target) {
      jump(target.el, target.hash);
      return;
    }
    // Focus left in the hidden sheet (or dropped to <body>) goes back to the
    // Menu key. A link that moved focus elsewhere (World) keeps it there.
    const active = document.activeElement;
    if ((!active || active === document.body || menu.contains(active)) && opener.offsetParent !== null) opener.focus({ preventScroll: true });
  });

  // Tab and Shift+Tab step through the sheet's keys and wrap at the ends. The
  // step is done here rather than left to the browser: Safari leaves links out
  // of the Tab order by default, so from Close it would drop focus onto the
  // (inert) page behind. Registered on the document so a stray focus (a tap on
  // the sheet's background) still comes back into the sheet.
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Tab" || !menu.matches(":popover-open")) return;
    const list = focusables();
    if (!list.length) return;
    event.preventDefault();
    const at = list.indexOf(document.activeElement as HTMLElement);
    const step = event.shiftKey ? -1 : 1;
    const next = at < 0 ? (event.shiftKey ? list.length - 1 : 0) : (at + step + list.length) % list.length;
    list[next]!.focus();
  });

  // Picking a section on this page closes the sheet, then jumps. The jump
  // waits for the sheet's "closed" toggle event (above): a link inside a
  // closing top-layer sheet does not reliably scroll the page behind it, and
  // the browser's own focus return must be over before the scroll starts.
  menu.addEventListener("click", (event) => {
    const link = (event.target as Element | null)?.closest?.<HTMLAnchorElement>("a[href^='#']");
    if (!link || !menu.matches(":popover-open") || link.hash === "#world") return;
    const target = document.getElementById(decodeURIComponent(link.hash.slice(1)));
    if (!target) return;
    event.preventDefault();
    jumpTo = { el: target, hash: link.hash };
    menu.hidePopover();
  });

  // Growing past the phone layout hides the Menu key; close the sheet with it.
  matchMedia("(max-width: 1099px)").addEventListener("change", (e) => {
    if (!e.matches && menu.matches(":popover-open")) menu.hidePopover();
  });
}

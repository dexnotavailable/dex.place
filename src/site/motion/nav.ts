// Sliding nav indicator: a yellow block that sits behind the current page's
// link and glides to whichever link is hovered or focused, then back.
// Without JS (or before this runs) the current link has a static highlight.

export function initNav(): void {
  const nav = document.querySelector<HTMLElement>(".nav");
  const list = nav?.querySelector<HTMLElement>("[data-nav]");
  const ind = nav?.querySelector<HTMLElement>("[data-nav-ind]");
  if (!nav || !list || !ind) return;
  const links = Array.from(list.querySelectorAll<HTMLAnchorElement>(".nav__link"));
  const current = links.find((a) => a.getAttribute("aria-current") === "page") ?? null;

  const place = (target: HTMLElement | null, instant = false): void => {
    if (!target || target.offsetParent === null) {
      nav.removeAttribute("data-moving");
      nav.removeAttribute("data-ind");
      ind.style.opacity = "0";
      return;
    }
    const base = nav.getBoundingClientRect();
    const r = target.getBoundingClientRect();
    if (instant) ind.style.transition = "none";
    ind.style.setProperty("--x", `${r.left - base.left}px`);
    ind.style.setProperty("--w", `${r.width}px`);
    ind.style.opacity = "1";
    // The indicator now marks the current page; drop the static highlight.
    nav.setAttribute("data-ind", "");
    if (instant) {
      void ind.offsetWidth;
      ind.style.transition = "";
    }
  };

  const rest = (): void => {
    if (current) {
      place(current);
    } else {
      ind.style.opacity = "0";
    }
    nav.removeAttribute("data-moving");
  };

  const go = (a: HTMLElement): void => {
    if (!nav.hasAttribute("data-moving")) {
      // Start from the current link (or the hovered one) so the block slides.
      place(current ?? a, true);
      nav.setAttribute("data-moving", "");
    }
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
  window.addEventListener("resize", () => place(nav.hasAttribute("data-moving") ? null : current, true));
  void document.fonts?.ready.then(() => place(current, true));
  place(current, true);
}

// Headroom: the floating header slides away while you read down the page and
// returns on any scroll up (or when it holds focus, via CSS :focus-within).
// Once the header is stuck over content it gets a paper backing
// ([data-stuck]) so headings don't show between the pills. On / the header
// mark stays hidden until the big hero mark has scrolled under the header
// ([data-mark]), so the mark is never shown twice in one view.
export function initHeadroom(): void {
  const hdr = document.querySelector<HTMLElement>("[data-hdr]");
  if (!hdr) return;
  const slab = document.querySelector<HTMLElement>(".hero__slab");
  if (slab) hdr.setAttribute("data-solo", "");
  let lastY = window.scrollY;
  let raf = 0;
  const update = (): void => {
    raf = 0;
    const y = window.scrollY;
    // Measured from the header's own resting place (on / it sits below the world).
    const rest = hdr.parentElement?.offsetTop ?? 0;
    const start = rest + 160;
    const menuOpen = document.querySelector("#menu:popover-open") !== null;
    const markPast = slab ? slab.getBoundingClientRect().bottom < hdr.offsetHeight : true;
    hdr.toggleAttribute("data-stuck", y > rest + 24);
    hdr.toggleAttribute("data-mark", markPast);
    if (y < start || menuOpen || y < lastY - 4) hdr.removeAttribute("data-away");
    else if (y > lastY + 4) hdr.setAttribute("data-away", "");
    if (Math.abs(y - lastY) > 4) lastY = y;
  };
  window.addEventListener("scroll", () => {
    if (!raf) raf = requestAnimationFrame(update);
  }, { passive: true });
  window.addEventListener("resize", () => {
    if (!raf) raf = requestAnimationFrame(update);
  });
  update();
}

// Mobile menu focus (WCAG 2.4.3, 2.4.11). The menu is a native popover, so it
// opens and closes without JS; this makes it behave like a modal sheet:
// - on open, focus moves to its Close key (the Menu key is covered);
// - everything behind it is inert, and Tab / Shift+Tab step through its keys
//   and wrap, in every engine;
// - Esc (native light dismiss) or Close hides it and focus returns to the
//   Menu key.
const FOCUSABLE = "a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex='-1'])";

export function initMenu(): void {
  const menu = document.querySelector<HTMLElement>("#menu[popover]");
  const opener = document.querySelector<HTMLButtonElement>("button.hdr__menu");
  if (!menu || !opener || typeof menu.showPopover !== "function") return;
  let inerted: HTMLElement[] = [];

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
    // Focus left in the hidden sheet (or dropped to <body>) goes back to the
    // Menu key. A link that moved focus elsewhere (World) keeps it there.
    const active = document.activeElement;
    if ((!active || active === document.body || menu.contains(active)) && opener.offsetParent !== null) opener.focus();
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

  // Growing past the phone layout hides the Menu key; close the sheet with it.
  matchMedia("(max-width: 940px)").addEventListener("change", (e) => {
    if (!e.matches && menu.matches(":popover-open")) menu.hidePopover();
  });
}

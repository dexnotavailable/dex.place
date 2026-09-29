// Gallery motion (its own chunk, loaded wherever the collage is: the home
// page's gallery section and /gallery/).
//
// - Hover field (fine pointers, motion welcome): the piece under the cursor
//   grows; its neighbours shrink a little and lean away, more the closer they
//   are. Transform only, no layout change. Keyboard focus does the same.
//   Springs smooth every value. Nothing rotates.
// - Viewer: clicking a piece flies it (FLIP) from the collage into a large
//   frame, and closing flies it back to its spot. The URL follows the piece
//   (/gallery/<id>/, a real prerendered page), so it can be shared, reloaded,
//   and the back button closes the viewer. Arrows and swipes step through
//   pieces in reading order; Esc, the close key or a click outside close it.
// Closing returns the URL to the page the viewer was opened from (/, /#gallery
// or /gallery/). Without this module every piece is a plain link to its own
// page.

import { release as releaseTile } from "./defer.ts";

interface Piece {
  readonly id: string;
  readonly href: string;
  readonly src: string;
  /** Every size of the piece (render/gallery.ts artSrcset); the viewer picks by its frame. */
  readonly srcset: string;
  readonly width: number;
  readonly height: number;
  readonly alt: string;
  readonly li: HTMLElement;
  readonly link: HTMLAnchorElement;
  readonly img: HTMLImageElement;
}

export function initGallery(reduced: MediaQueryList, fine: MediaQueryList): void {
  const collage = document.querySelector<HTMLElement>("[data-collage]");
  if (!collage) return;
  const pieces: Piece[] = Array.from(collage.querySelectorAll<HTMLAnchorElement>("a[data-piece]")).map((link) => {
    const li = link.closest<HTMLElement>(".art")!;
    const img = link.querySelector<HTMLImageElement>("img")!;
    return {
      id: link.dataset.piece!,
      href: link.getAttribute("href")!,
      src: link.dataset.src!,
      srcset: link.dataset.srcset ?? "",
      width: Number(link.dataset.w),
      height: Number(link.dataset.h),
      alt: img.alt,
      li,
      link,
      img,
    };
  });
  if (!pieces.length) return;
  const field = initField(collage, pieces, reduced, fine);
  const dialog = document.querySelector<HTMLDialogElement>("[data-viewer]");
  if (dialog && typeof dialog.showModal === "function") initViewer(dialog, pieces, reduced, field);
}

// ------------------------------------------------------------------ field

interface FieldState { s: number; x: number; y: number }

interface Field {
  /** Current scale of a piece (the viewer starts its flight from it). */
  scaleOf(i: number): number;
  /** Drops every piece back to rest at once. */
  rest(): void;
  /** The next focus on a piece is a return from the viewer: no lift for it. */
  quiet(): void;
}

function initField(collage: HTMLElement, pieces: readonly Piece[], reduced: MediaQueryList, fine: MediaQueryList): Field {
  const now: FieldState[] = pieces.map(() => ({ s: 1, x: 0, y: 0 }));
  const idle: Field = { scaleOf: (i) => now[i]!.s, rest: () => undefined, quiet: () => undefined };
  if (reduced.matches || !fine.matches) return idle;
  document.documentElement.classList.add("has-field");

  const goal: FieldState[] = pieces.map(() => ({ s: 1, x: 0, y: 0 }));
  let px = 0;
  let py = 0;
  /** The lifted piece was chosen by keyboard focus, not the cursor. */
  let byKey = false;
  let inside = false;
  let hovered = -1;
  let raf = 0;
  let last = 0;
  let paused = false;
  /** Set while the viewer hands focus back to the piece it closed on. */
  let muted = false;

  // Each tile's layout box against the collage (offset* ignore transforms, so
  // the field never feeds back; .collage is position: relative).
  const boxOf = (i: number) => {
    const el = pieces[i]!.li;
    const l = el.offsetLeft;
    const t = el.offsetTop;
    return { l, t, r: l + el.offsetWidth, b: t + el.offsetHeight };
  };

  // The lifted piece grows and rises 2px up-left like every block that pops
  // (§3). Only the pieces touching it step back: they shrink a little and
  // lean away from it, more the closer their edges are to its edges. Measured
  // edge to edge (not from the cursor), so the pieces right beside a big tile
  // react the same wherever the cursor sits on it, and keyboard focus matches
  // hover. The shrink is capped in pixels (a big neighbour gives up no more
  // than a small one), so the tight wall never opens wide gaps: calm, not a
  // ripple across the whole collage.
  const REACH = 40;
  const GIVE = 8;
  const aim = () => {
    const lifted = inside && !paused && hovered >= 0 ? boxOf(hovered) : null;
    pieces.forEach((_, i) => {
      const g = goal[i]!;
      g.s = 1; g.x = 0; g.y = 0;
      if (!lifted) return;
      if (i === hovered) {
        g.s = 1.06; g.x = -2; g.y = -2;
        return;
      }
      const r = boxOf(i);
      const ex = Math.max(0, r.l - lifted.r, lifted.l - r.r);
      const ey = Math.max(0, r.t - lifted.b, lifted.t - r.b);
      const f = Math.max(0, 1 - Math.hypot(ex, ey) / REACH);
      if (!f) return;
      const dx = (r.l + r.r - lifted.l - lifted.r) / 2;
      const dy = (r.t + r.b - lifted.t - lifted.b) / 2;
      const len = Math.hypot(dx, dy) || 1;
      const size = Math.max(r.r - r.l, r.b - r.t, 1);
      g.s = 1 - Math.min(0.03, GIVE / size) * f;
      g.x = (dx / len) * 3 * f;
      g.y = (dy / len) * 3 * f;
    });
  };

  const write = (i: number) => {
    const c = now[i]!;
    const el = pieces[i]!.li;
    if (Math.abs(c.s - 1) < 1e-3 && Math.abs(c.x) < 0.05 && Math.abs(c.y) < 0.05) {
      el.style.removeProperty("transform");
      el.removeAttribute("data-lift");
      return;
    }
    el.toggleAttribute("data-lift", c.s > 1.001);
    el.style.transform = `translate3d(${c.x.toFixed(2)}px, ${c.y.toFixed(2)}px, 0) scale(${c.s.toFixed(4)})`;
  };

  const tick = (t: number) => {
    const dt = last ? Math.min(64, t - last) : 16.7;
    last = t;
    const k = 1 - Math.pow(1 - 0.17, dt / 16.7);
    let moving = false;
    now.forEach((c, i) => {
      const g = goal[i]!;
      c.s += (g.s - c.s) * k;
      c.x += (g.x - c.x) * k;
      c.y += (g.y - c.y) * k;
      if (Math.abs(g.s - c.s) > 2e-4 || Math.abs(g.x - c.x) > 0.02 || Math.abs(g.y - c.y) > 0.02) {
        moving = true;
      } else {
        c.s = g.s; c.x = g.x; c.y = g.y;
      }
      write(i);
    });
    raf = moving ? requestAnimationFrame(tick) : 0;
    if (!raf) last = 0;
  };

  const kick = () => {
    aim();
    if (!raf) raf = requestAnimationFrame(tick);
  };

  const hit = (el: Element | null) => {
    const li = el?.closest?.(".art");
    return li ? pieces.findIndex((p) => p.li === li) : -1;
  };
  collage.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    px = e.clientX;
    py = e.clientY;
    inside = true;
    byKey = false;
    // In a 3px gap the collage itself is the target: keep the lifted piece
    // until the cursor reaches the next one, so crossing a gap never flickers.
    if (e.target === collage) return;
    const i = hit(e.target as Element | null);
    if (i === hovered) return;
    hovered = i;
    kick();
  });
  collage.addEventListener("pointerleave", () => {
    inside = false;
    hovered = -1;
    kick();
  });
  // Keyboard focus gets the same lift as hover.
  collage.addEventListener("focusin", (e) => {
    const i = pieces.findIndex((p) => p.link === e.target);
    if (muted) { muted = false; return; }
    if (i < 0 || !(e.target as HTMLElement).matches(":focus-visible")) return;
    inside = true;
    byKey = true;
    hovered = i;
    kick();
  });
  collage.addEventListener("focusout", () => {
    if (collage.contains(document.activeElement)) return;
    inside = false;
    hovered = -1;
    kick();
  });
  // Scrolling under a still cursor moves a different piece under it.
  window.addEventListener("scroll", () => {
    if (!inside || byKey) return;
    const i = hit(document.elementFromPoint(px, py));
    if (i !== hovered) { hovered = i; kick(); }
  }, { passive: true });

  return {
    scaleOf: (i) => now[i]!.s,
    rest: () => {
      paused = true;
      inside = false;
      hovered = -1;
      now.forEach((c) => { c.s = 1; c.x = 0; c.y = 0; });
      goal.forEach((c) => { c.s = 1; c.x = 0; c.y = 0; });
      pieces.forEach((_, i) => write(i));
      requestAnimationFrame(() => { paused = false; });
    },
    quiet: () => { muted = true; },
  };
}

// ----------------------------------------------------------------- viewer

/** A critically-ish damped spring as a CSS linear() easing (small overshoot). */
function springEasing(stiffness = 170, damping = 22, samples = 48): { easing: string; duration: number } {
  let x = 0;
  let v = 0;
  const dt = 1 / 240;
  const points: number[] = [];
  let t = 0;
  // Simulate until settled, then resample evenly.
  const trace: number[] = [];
  while (t < 2.5) {
    const a = stiffness * (1 - x) - damping * v;
    v += a * dt;
    x += v * dt;
    t += dt;
    trace.push(x);
    if (t > 0.3 && Math.abs(1 - x) < 0.001 && Math.abs(v) < 0.01) break;
  }
  for (let i = 0; i <= samples; i += 1) {
    const at = Math.min(trace.length - 1, Math.round((i / samples) * (trace.length - 1)));
    points.push(i === samples ? 1 : trace[at]!);
  }
  return { easing: `linear(${points.map((p) => p.toFixed(4)).join(", ")})`, duration: Math.round(t * 1000) };
}

function animate(el: Element, frames: Keyframe[], options: KeyframeAnimationOptions, fallback: string): Animation {
  try {
    return el.animate(frames, options);
  } catch {
    // linear() easing unsupported (older Safari): same motion, simpler curve.
    return el.animate(frames, { ...options, easing: fallback });
  }
}

interface Rect { left: number; top: number; width: number; height: number }

function initViewer(dialog: HTMLDialogElement, pieces: readonly Piece[], reduced: MediaQueryList, field: Field): void {
  const stage = dialog.querySelector<HTMLElement>("[data-viewer-stage]")!;
  const frame = dialog.querySelector<HTMLElement>("[data-viewer-frame]")!;
  const lo = dialog.querySelector<HTMLImageElement>("[data-viewer-lo]")!;
  const hi = dialog.querySelector<HTMLImageElement>("[data-viewer-hi]")!;
  const count = dialog.querySelector<HTMLElement>("[data-viewer-count]")!;
  const full = dialog.querySelector<HTMLAnchorElement>("[data-viewer-full]")!;
  const closeBtn = dialog.querySelector<HTMLButtonElement>("[data-viewer-close]")!;
  const baseTitle = document.title;
  // Where closing the viewer returns the address bar to.
  const isPiece = (path: string): boolean => /^\/gallery\/\d{2}\/$/.test(path);
  let base = isPiece(location.pathname) ? "/gallery/" : location.pathname + location.search + location.hash;
  const spring = springEasing(190, 24);
  const soft = springEasing(260, 30);

  let index = -1;
  let open = false;
  let closing = false;
  let pushed = false;
  let flight: Animation | null = null;
  // Where the page was when the viewer opened. Closing with history.back()
  // returns to an entry that may carry a fragment (/#gallery after a nav
  // jump); the browser would then scroll the page to that anchor while the
  // piece flies home, and it would land on the wrong spot. So scroll
  // restoration is manual while the viewer is up, and the close puts the
  // page back where it was, instantly, before the flight home is measured.
  let openY = -1;
  let restoration: ScrollRestoration | null = null;
  const holdScroll = () => {
    openY = window.scrollY;
    if ("scrollRestoration" in history && restoration === null) {
      restoration = history.scrollRestoration;
      history.scrollRestoration = "manual";
    }
  };
  const putBack = () => {
    if (openY >= 0 && Math.abs(window.scrollY - openY) > 0.5) window.scrollTo({ top: openY, behavior: "instant" });
  };
  const releaseScroll = () => {
    openY = -1;
    if (restoration !== null) {
      history.scrollRestoration = restoration;
      restoration = null;
    }
  };

  const motion = () => !reduced.matches;
  const n = pieces.length;

  // The frame edge around the image, both sides (gallery.css .viewer__frame).
  const chromeOf = (): number => 2 * 2;

  // Fits the piece (plus mat and outline) into the space the controls leave.
  const target = (p: Piece): Rect => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const narrow = vw < 700;
    // Room for the controls, plus the frame's hard shadow on the right.
    const sideRoom = narrow ? 22 : 104;
    const top = narrow ? 76 : 84;
    const bottom = narrow ? 96 : 48;
    const chrome = chromeOf();
    const maxW = Math.max(120, vw - sideRoom * 2 - chrome);
    const maxH = Math.max(120, vh - top - bottom - chrome);
    const scale = Math.min(maxW / p.width, maxH / p.height, 1.5);
    const width = Math.round(p.width * scale) + chrome;
    const height = Math.round(p.height * scale) + chrome;
    // Nudge left by half the shadow so frame + shadow sit centred.
    return { left: Math.round((vw - width) / 2 - (narrow ? 4 : 6)), top: Math.round(top + (vh - top - bottom - height) / 2), width, height };
  };

  const place = (r: Rect) => {
    frame.style.left = `${r.left}px`;
    frame.style.top = `${r.top}px`;
    frame.style.width = `${r.width}px`;
    frame.style.height = `${r.height}px`;
  };

  // Where the piece sits in the collage right now: its untransformed frame
  // size times the field's scale, around its (rotation-proof) centre.
  const origin = (i: number): { rect: Rect } => {
    const p = pieces[i]!;
    const bounds = p.link.getBoundingClientRect();
    const s = field.scaleOf(i);
    const width = p.link.offsetWidth * s;
    const height = p.link.offsetHeight * s;
    return {
      rect: { left: bounds.left + bounds.width / 2 - width / 2, top: bounds.top + bounds.height / 2 - height / 2, width, height },
    };
  };

  const delta = (from: Rect, to: Rect): string => {
    const dx = from.left + from.width / 2 - (to.left + to.width / 2);
    const dy = from.top + from.height / 2 - (to.top + to.height / 2);
    return `translate(${dx}px, ${dy}px) scale(${from.width / to.width}, ${from.height / to.height})`;
  };

  const fill = (i: number) => {
    const p = pieces[i]!;
    index = i;
    full.href = p.src;
    // A tile still waiting for its turn (motion/defer.ts) starts loading now.
    releaseTile(p.img.closest("picture"));
    lo.src = p.img.currentSrc || p.img.src;
    hi.classList.remove("is-loaded");
    hi.alt = p.alt;
    const rect = target(p);
    // The big image takes the smallest size that is sharp in its frame.
    hi.sizes = `${Math.max(1, rect.width - chromeOf())}px`;
    if (p.srcset) hi.srcset = p.srcset;
    else hi.removeAttribute("srcset");
    hi.src = p.src;
    const want = p.src;
    const done = () => { if (hi.getAttribute("src") === want) hi.classList.add("is-loaded"); };
    if (hi.complete && hi.naturalWidth) done();
    else hi.decode().then(done, () => hi.addEventListener("load", done, { once: true }));
    // The number is the piece's place on the wall (reading order), the same
    // as its piece page's counter, so stepping reads 03, 04, 05.
    const at = String(i + 1).padStart(2, "0");
    count.innerHTML = `<b>${at}</b><span aria-hidden="true"> / </span><span class="sr"> of </span>${String(n).padStart(2, "0")}`;
    document.title = `Gallery ${at} · dex`;
    place(rect);
    // Warm the neighbours' tiles (they may still be lazy): the browser then
    // loads them at the size their own srcset picks.
    for (const j of [(i + 1) % n, (i - 1 + n) % n]) {
      const q = pieces[j]!;
      releaseTile(q.img.closest("picture"));
      if (!q.img.complete) q.img.loading = "eager";
    }
  };

  const openAt = (i: number, push: boolean) => {
    if (open) { show(i, 0); return; }
    flight?.cancel();
    open = true;
    closing = false;
    holdScroll();
    const from = origin(i);
    field.rest();
    fill(i);
    pieces[i]!.li.classList.add("is-away");
    dialog.showModal();
    closeBtn.focus({ preventScroll: true });
    // Next frame: let the dialog lay out before the classes start transitions.
    requestAnimationFrame(() => dialog.classList.add("is-open"));
    if (push) {
      if (!isPiece(location.pathname)) base = location.pathname + location.search + location.hash;
      history.pushState({ gallery: pieces[i]!.id }, "", pieces[i]!.href);
      pushed = true;
    }
    if (motion()) {
      const to = target(pieces[i]!);
      flight = animate(
        frame,
        [{ transform: delta(from.rect, to) }, { transform: "none" }],
        { duration: spring.duration, easing: spring.easing },
        "cubic-bezier(.2,.9,.1,1)",
      );
    }
  };

  const finishClose = () => {
    const p = pieces[index];
    dialog.close();
    for (const q of pieces) q.li.classList.remove("is-away");
    document.title = baseTitle;
    open = false;
    closing = false;
    frame.getAnimations().forEach((a) => a.cancel());
    putBack();
    releaseScroll();
    if (p) {
      field.quiet();
      p.link.focus({ preventScroll: true });
      // With reduced motion this runs inside the popstate of history.back();
      // the browser's own fragment handling for that step (/#gallery) then
      // drops focus to <body>. Put it back on the piece once that settles
      // (WCAG 2.4.3), unless the visitor has moved on.
      const settle = () => {
        const a = document.activeElement;
        if (!open && (!a || a === document.body)) p.link.focus({ preventScroll: true });
      };
      requestAnimationFrame(() => setTimeout(settle, 0));
    }
  };

  // Animated close; called for UI closes (after history.back) and popstate.
  const closeNow = () => {
    if (!open || closing) return;
    closing = true;
    const p = pieces[index]!;
    putBack();
    // Bring the piece's spot into view first so it has somewhere to land
    // (stepping may have moved to a piece that was off screen).
    const r = p.li.getBoundingClientRect();
    if (r.bottom < 60 || r.top > window.innerHeight - 60) {
      window.scrollBy({ top: r.top + r.height / 2 - window.innerHeight / 2, behavior: "instant" });
      openY = window.scrollY;
    }
    for (const q of pieces) q.li.classList.toggle("is-away", q === p);
    dialog.classList.remove("is-open");
    if (!motion()) { finishClose(); return; }
    flight?.cancel();
    const from = origin(index);
    const to = target(p);
    flight = animate(
      frame,
      [{ transform: "none" }, { transform: delta(from.rect, to) }],
      { duration: 420, easing: "cubic-bezier(.5,0,.15,1)", fill: "forwards" },
      "ease-in-out",
    );
    flight.finished.then(finishClose, () => undefined);
  };

  const requestClose = () => {
    if (!open || closing) return;
    if (pushed && history.state && typeof history.state === "object" && "gallery" in history.state) {
      pushed = false;
      history.back(); // popstate runs closeNow
    } else {
      history.replaceState(null, "", base);
      closeNow();
    }
  };

  // Steps to another piece inside the viewer: out one way, in from the other.
  const show = (i: number, dir: number, fromX = 0) => {
    if (i === index) return;
    const p = pieces[i]!;
    history.replaceState({ gallery: p.id }, "", p.href);
    if (!motion() || dir === 0) { fill(i); frame.style.removeProperty("translate"); return; }
    flight?.cancel();
    const out = animate(
      frame,
      [{ transform: `translateX(${fromX}px)`, opacity: 1 }, { transform: `translateX(${-dir * 90 + fromX}px)`, opacity: 0 }],
      { duration: 150, easing: "cubic-bezier(.4,0,1,1)", fill: "forwards" },
      "ease-in",
    );
    flight = out;
    out.finished.then(() => {
      fill(i);
      frame.style.removeProperty("translate");
      out.cancel();
      flight = animate(
        frame,
        [{ transform: `translateX(${dir * 90}px) scale(.94)`, opacity: 0 }, { transform: "none", opacity: 1 }],
        { duration: soft.duration, easing: soft.easing },
        "cubic-bezier(.2,.9,.1,1)",
      );
    }, () => undefined);
  };

  const go = (dir: number) => {
    if (!open || closing) return;
    show((index + dir + n) % n, dir);
  };

  // --- wiring
  for (const [i, p] of pieces.entries()) {
    p.link.addEventListener("click", (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      openAt(i, true);
    });
  }
  closeBtn.addEventListener("click", requestClose);
  for (const b of dialog.querySelectorAll<HTMLButtonElement>("[data-viewer-go]")) {
    b.addEventListener("click", () => go(Number(b.dataset.viewerGo)));
  }
  dialog.addEventListener("cancel", (e) => {
    e.preventDefault();
    requestClose();
  });
  // A forced close (e.g. a repeated Esc the browser won't let us intercept).
  dialog.addEventListener("close", () => {
    if (!open) return;
    for (const q of pieces) q.li.classList.remove("is-away");
    dialog.classList.remove("is-open");
    document.title = baseTitle;
    open = false;
    closing = false;
    putBack();
    releaseScroll();
    if (isPiece(location.pathname)) history.replaceState(null, "", base);
  });
  dialog.addEventListener("keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
  });
  // The page behind must not scroll while the viewer is up.
  dialog.addEventListener("wheel", (e) => e.preventDefault(), { passive: false });

  // Pointer: click outside the frame closes; swipe left/right steps; swipe
  // down closes.
  let down: { x: number; y: number; id: number; t: number } | null = null;
  let dragged = false;
  stage.addEventListener("pointerdown", (e) => {
    if (!open || closing || (e.pointerType === "mouse" && e.button !== 0)) return;
    down = { x: e.clientX, y: e.clientY, id: e.pointerId, t: performance.now() };
    dragged = false;
  });
  stage.addEventListener("pointermove", (e) => {
    if (!down || e.pointerId !== down.id || e.pointerType === "mouse") return;
    const dx = e.clientX - down.x;
    const dy = e.clientY - down.y;
    if (!dragged && Math.hypot(dx, dy) > 8) {
      dragged = true;
      stage.setPointerCapture(e.pointerId);
    }
    if (dragged && motion()) {
      const horizontal = Math.abs(dx) > Math.abs(dy);
      frame.style.translate = horizontal ? `${dx}px 0` : `0 ${Math.max(0, dy)}px`;
    }
  });
  const release = (e: PointerEvent) => {
    if (!down || e.pointerId !== down.id) return;
    const dx = e.clientX - down.x;
    const dy = e.clientY - down.y;
    const fast = performance.now() - down.t < 300;
    down = null;
    if (!dragged) {
      if (e.type === "pointerup" && !frame.contains(e.target as Node)) requestClose();
      return;
    }
    const horizontal = Math.abs(dx) > Math.abs(dy);
    if (horizontal && (Math.abs(dx) > 70 || (fast && Math.abs(dx) > 30))) {
      frame.style.removeProperty("translate");
      show((index + (dx < 0 ? 1 : -1) + n) % n, dx < 0 ? 1 : -1, dx);
    } else if (!horizontal && dy > 90) {
      frame.style.removeProperty("translate");
      requestClose();
    } else {
      frame.style.removeProperty("translate");
      if (motion()) {
        animate(frame, [{ transform: horizontal ? `translateX(${dx}px)` : `translateY(${dy}px)` }, { transform: "none" }], { duration: soft.duration, easing: soft.easing }, "ease-out");
      }
    }
  };
  stage.addEventListener("pointerup", release);
  stage.addEventListener("pointercancel", release);

  window.addEventListener("popstate", () => {
    const m = /^\/gallery\/(\d{2})\/$/.exec(location.pathname);
    const i = m ? pieces.findIndex((p) => p.id === m[1]) : -1;
    if (i >= 0) {
      pushed = true;
      if (open) show(i, 0);
      else openAt(i, false);
    } else if (open) {
      pushed = false;
      closeNow();
    }
  });

  window.addEventListener("resize", () => {
    if (open && index >= 0) place(target(pieces[index]!));
  });
}

// In-world panels (GDK 3.7, 5.4): a ledger, a board, a scroll, a shelf: they look like
// part of the world, and underneath they are real HTML, so screen readers, keyboard and
// copy all work. While one is open the game keys are suspended and it behaves like an
// ordinary web dialog: Tab and Shift+Tab move between its buttons, Space and Enter press
// the focused one, Esc closes it (so does the key that opened it), focus returns to the
// world when it closes.

import type { Input } from "../../lab/engine/input.ts";

export type PanelLook = "ledger" | "board" | "scroll" | "shelf" | "box" | "frame" | "slip";

export interface PanelSpec {
  /** Title shown on the panel (and its accessible name). */
  title: string;
  look: PanelLook;
  /** Builds the panel's body (may be async: data loads on open). */
  body: (el: HTMLElement, panels: Panels) => void | Promise<void>;
  /** A wide panel (art, the map). */
  wide?: boolean;
}

/** The panels' pixel font (151 KB of styles for its many subsets) loads with the first panel. */
let fontAsked = false;

export class Panels {
  private root: HTMLElement;
  private current: { el: HTMLElement; spec: PanelSpec; closeKey?: string } | null = null;
  onChange: (open: boolean) => void = () => {};

  constructor(private input: Input, private world: HTMLElement) {
    this.root = document.createElement("div");
    this.root.id = "panel-layer";
    document.getElementById("stage")!.append(this.root);
    window.addEventListener("keydown", (e) => this.key(e), true);
  }

  get open(): boolean {
    return !!this.current;
  }

  get kind(): string | null {
    return this.current?.spec.title ?? null;
  }

  show(spec: PanelSpec, closeKey?: string): void {
    if (!fontAsked) {
      fontAsked = true;
      import("@fontsource/dotgothic16/400.css").catch(() => {});
    }
    this.close(false);
    this.input.paused = true;
    this.input.releaseAll();
    const el = document.createElement("section");
    el.className = `panel look-${spec.look}${spec.wide ? " wide" : ""}`;
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    const id = `panel-title-${Math.random().toString(36).slice(2, 8)}`;
    el.setAttribute("aria-labelledby", id);
    const head = document.createElement("header");
    const h = document.createElement("h2");
    h.id = id;
    h.textContent = spec.title;
    const close = document.createElement("button");
    close.type = "button";
    close.className = "close";
    close.setAttribute("aria-label", "Close");
    close.textContent = "×";
    close.addEventListener("click", () => this.close());
    head.append(h, close);
    const body = document.createElement("div");
    body.className = "body";
    el.append(head, body);
    this.root.append(el);
    this.root.classList.add("on");
    this.current = { el, spec, closeKey };
    const done = spec.body(body, this);
    const focusFirst = (): void => {
      const f = el.querySelector<HTMLElement>(".body a[href], .body button, .body input, .body [tabindex='0']") ?? close;
      f.focus({ preventScroll: true });
    };
    if (done instanceof Promise) done.then(focusFirst, (e: unknown) => {
      body.textContent = `Could not load this: ${e instanceof Error ? e.message : String(e)}`;
      focusFirst();
    });
    else focusFirst();
    this.onChange(true);
  }

  close(refocus = true): void {
    if (!this.current) return;
    this.current.el.remove();
    this.current = null;
    this.root.classList.remove("on");
    this.input.paused = false;
    this.input.releaseAll();
    if (refocus) (this.world as HTMLElement).focus({ preventScroll: true });
    this.onChange(false);
  }

  private key(e: KeyboardEvent): void {
    const c = this.current;
    if (!c) return;
    if (e.code === "Escape" || (c.closeKey && e.code === c.closeKey && !(e.target instanceof HTMLInputElement))) {
      e.preventDefault();
      e.stopPropagation();
      this.close();
      return;
    }
    if (e.code === "Tab") {
      // keep focus inside the panel
      const items = [...c.el.querySelectorAll<HTMLElement>("a[href], button, input, select, textarea, [tabindex='0']")].filter((n) => !n.hasAttribute("disabled"));
      if (!items.length) return;
      const first = items[0]!, last = items[items.length - 1]!;
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }
}

/** Small DOM helper: an element with a class and children. */
export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = "", ...kids: (Node | string | null | undefined)[]): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  for (const k of kids) if (k !== null && k !== undefined) n.append(k);
  return n;
}

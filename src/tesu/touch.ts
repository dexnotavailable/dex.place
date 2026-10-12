// Touch (GDK 6.8): the left half of the screen is a floating stick; the right has attack,
// jump and dash, with her kit in a fan round attack. A touch that starts on a usable
// object and lifts within 200 ms having moved less than 10 px is a tap on that object
// (the same as F): object taps win.

import type { Action, Input } from "../lab/engine/input.ts";

interface Stick {
  id: number;
  x: number;
  y: number;
  t: number;
  moved: number;
  sx: number;
  sy: number;
}

export class Touch {
  shown = false;
  /** A short, still tap at a client point: the game decides whether it hit something usable. */
  onTap: (clientX: number, clientY: number) => boolean = () => false;
  /** A button let go (the killing blow listens for the attack button's release). */
  onRelease: (a: Action) => void = () => {};
  /** The talisman tab (only in the page column): down to the website. */
  private onTab: (() => void) | null = null;

  setTab(go: () => void): void {
    this.onTab = go;
    if (this.shown) this.addTab();
  }

  private addTab(): void {
    if (!this.onTab || this.root.querySelector(".tab")) return;
    // the talisman tab at the bottom centre: where both halves of the screen are controls,
    // this is the way down to the website (GDK 3.8, 6.8)
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "tb tab";
    tab.setAttribute("aria-label", "To the website");
    tab.addEventListener("click", () => this.onTab?.());
    this.root.append(tab);
  }
  private stick: Stick | null = null;
  private knob: HTMLDivElement;
  private base: HTMLDivElement;
  private held = new Set<Action>();

  constructor(private input: Input, private root: HTMLElement, private surface: HTMLElement) {
    this.base = document.createElement("div");
    this.base.className = "stick-base";
    this.knob = document.createElement("div");
    this.knob.className = "stick-knob";
    this.base.append(this.knob);
    const coarse = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
    if (coarse) this.show();
    window.addEventListener("touchstart", () => this.show(), { once: true, passive: true });
    surface.addEventListener("pointerdown", (e) => this.down(e));
    window.addEventListener("pointermove", (e) => this.move(e));
    window.addEventListener("pointerup", (e) => this.up(e));
    window.addEventListener("pointercancel", (e) => this.up(e));
    window.addEventListener("blur", () => this.releaseStick());
  }

  show(): void {
    if (this.shown) return;
    this.shown = true;
    this.root.hidden = false;
    this.root.append(this.base);
    const btn = (action: Action, label: string, aria: string, cls: string): void => {
      const el = document.createElement("button");
      el.type = "button";
      el.className = `tb ${cls}`;
      el.textContent = label;
      el.setAttribute("aria-label", aria);
      const id = `touch-${action}`;
      const down = (e: PointerEvent): void => {
        e.preventDefault();
        e.stopPropagation();
        el.setPointerCapture(e.pointerId);
        el.classList.add("on");
        this.input.down(action, id);
      };
      const up = (e: PointerEvent): void => {
        e.preventDefault();
        el.classList.remove("on");
        this.input.up(action, id);
        if (e.type === "pointerup") this.onRelease(action);
      };
      el.addEventListener("pointerdown", down);
      el.addEventListener("pointerup", up);
      el.addEventListener("pointercancel", up);
      el.addEventListener("lostpointercapture", () => {
        el.classList.remove("on");
        this.input.up(action, id);
      });
      this.root.append(el);
    };
    btn("m1", "⚔", "attack", "attack");
    btn("jump", "▲", "jump", "jump");
    btn("m2", "»", "dash", "dash");
    btn("skill", "Q", "vermilion brush", "kit q");
    btn("ult", "R", "decree of the vermilion seal", "kit r");
    this.addTab();
  }

  private down(e: PointerEvent): void {
    if (e.pointerType === "mouse" || !this.shown) return;
    if (this.stick) return;
    const w = this.surface.clientWidth;
    const r = this.surface.getBoundingClientRect();
    if (e.clientX - r.left > w / 2) {
      // the right half: a quick still tap may still be an object tap
      this.stick = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), moved: 0, sx: e.clientX, sy: e.clientY };
      this.stick.moved = -1; // marks "tap only"
      return;
    }
    this.stick = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), moved: 0, sx: e.clientX, sy: e.clientY };
    this.base.style.left = `${e.clientX - r.left}px`;
    this.base.style.top = `${e.clientY - r.top}px`;
    this.base.classList.add("on");
    this.knob.style.transform = "translate(-50%, -50%)";
  }

  private move(e: PointerEvent): void {
    const s = this.stick;
    if (!s || s.id !== e.pointerId) return;
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    if (s.moved >= 0) s.moved = Math.max(s.moved, Math.hypot(e.clientX - s.sx, e.clientY - s.sy));
    if (s.moved < 0) return;
    const max = 40;
    const len = Math.hypot(dx, dy);
    const k = len > max ? max / len : 1;
    this.knob.style.transform = `translate(calc(-50% + ${dx * k}px), calc(-50% + ${dy * k}px))`;
    // the base follows a finger that drags far, so the stick never runs out
    if (len > max * 1.6) {
      s.x = e.clientX - (dx / len) * max * 1.6;
      s.y = e.clientY - (dy / len) * max * 1.6;
      const r = this.surface.getBoundingClientRect();
      this.base.style.left = `${s.x - r.left}px`;
      this.base.style.top = `${s.y - r.top}px`;
    }
    this.set("left", dx < -12);
    this.set("right", dx > 12);
    this.set("down", dy > 30 && Math.abs(dy) > Math.abs(dx));
  }

  private up(e: PointerEvent): void {
    const s = this.stick;
    if (!s || s.id !== e.pointerId) return;
    const quick = performance.now() - s.t < 200;
    const still = Math.hypot(e.clientX - s.sx, e.clientY - s.sy) < 10;
    if (quick && still) this.onTap(e.clientX, e.clientY);
    this.releaseStick();
  }

  private releaseStick(): void {
    this.stick = null;
    this.base.classList.remove("on");
    for (const a of [...this.held]) this.set(a, false);
  }

  private set(a: Action, on: boolean): void {
    if (on === this.held.has(a)) return;
    if (on) {
      this.held.add(a);
      this.input.down(a, "stick");
    } else {
      this.held.delete(a);
      this.input.up(a, "stick");
    }
  }

  /** Greys the kit buttons while they recharge. */
  cooldowns(skillReady: boolean, ultReady: boolean): void {
    this.root.querySelector(".kit.q")?.classList.toggle("cool", !skillReady);
    this.root.querySelector(".kit.r")?.classList.toggle("cool", !ultReady);
  }
}

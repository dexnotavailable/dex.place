// YUKI's page (/yuki/, render/yuki.ts) and her sprite wherever it is: what scripts add. The page is complete without
// this (the key downloads, the guide is there below it); this makes her alive and turns the page into the guide.
//
// - Her eyes follow a fine pointer (the eye layer one pixel left or right, styles/yuki.css --gx), on every stage.
// - Tap or click her on the page's stage: she hops, smiles and says something small.
// - The Download click (the default action runs: the file comes from GitHub, the page stays): the page becomes the
//   install guide (data-stage="guide"), she cheers, one status line says what to do, and the page goes to the steps.
// - The hero (her stage and the snow in front of it), her art in the Downloads block (the block itself is tall: its art
//   leaves the screen first), the drawn Windows prompt and her face in the steps' and facts' tiles rest off screen.
// - The live link (data/yuki.ts YUKI_LINK) only when it is switched on and in the page: after the click it asks YUKI's
//   engine on this PC how its first run is going.
// Reduced motion: no hop, no talking mouth, no smooth scroll; her face still changes (a state, not a motion).

import { readLinkStatus, YUKI_LINK } from "../data/yuki.ts";

const POKES = ["hehe.", "that tickles!", "snow's nice tonight.", "i live on your PC.", "hi again!"] as const;

interface Her {
  svg: SVGSVGElement;
  /** Her resting face, to come back to. */
  eyes: string;
  mouth: string;
}

function hersIn(root: ParentNode): Her[] {
  return Array.from(root.querySelectorAll<SVGSVGElement>("svg.yk")).map((svg) => ({
    svg, eyes: svg.dataset["eyes"] ?? "open", mouth: svg.dataset["mouth"] ?? "calm",
  }));
}

/** Her eyes follow the pointer: -1, 0 or 1 pixel, from where the pointer is beside her face. */
function initGlances(): () => void {
  const all = hersIn(document);
  if (!all.length) return () => {};
  let raf = 0, px = 0;
  const look = (): void => {
    raf = 0;
    for (const h of all) {
      const r = h.svg.getBoundingClientRect();
      if (r.width < 24 || r.bottom < 0 || r.top > innerHeight) continue;
      const cx = r.left + r.width / 2, dx = px - cx;
      const gx = Math.abs(dx) < r.width * 0.35 ? 0 : dx < 0 ? -1 : 1;
      h.svg.style.setProperty("--gx", String(gx));
    }
  };
  const move = (e: PointerEvent): void => {
    px = e.clientX;
    if (!raf) raf = requestAnimationFrame(look);
  };
  const leave = (): void => { for (const h of all) h.svg.style.removeProperty("--gx"); };
  window.addEventListener("pointermove", move, { passive: true });
  document.documentElement.addEventListener("pointerleave", leave);
  return () => {
    window.removeEventListener("pointermove", move);
    document.documentElement.removeEventListener("pointerleave", leave);
  };
}

/** Pauses what plays inside each element while it is off screen. */
function restOffScreen(els: Iterable<Element>): void {
  if (!("IntersectionObserver" in window)) return;
  const io = new IntersectionObserver((es) => {
    for (const e of es) e.target.classList.toggle("is-off", !e.isIntersecting);
  }, { rootMargin: "10% 0px" });
  for (const el of els) io.observe(el);
}

/** The page's stage: her line, her face, her hop. */
class Stage {
  private timers: number[] = [];
  constructor(
    private readonly stage: HTMLElement,
    private readonly her: Her | null,
    private readonly reduced: boolean,
  ) {}

  private later(ms: number, fn: () => void): void {
    this.timers.push(window.setTimeout(fn, ms));
  }

  private clear(): void {
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
  }

  /** Her face for a while (or for good), then back to rest. */
  face(eyes: string, mouth: string, ms = 0): void {
    if (!this.her) return;
    this.her.svg.dataset["eyes"] = eyes;
    this.her.svg.dataset["mouth"] = mouth;
    if (ms) this.later(ms, () => this.rest());
  }

  rest(): void {
    if (!this.her) return;
    this.her.svg.dataset["eyes"] = this.her.eyes;
    this.her.svg.dataset["mouth"] = this.her.mouth;
  }

  /** She says a line: the bubble pops, her mouth moves while she says it. */
  say(text: string, then: { eyes: string; mouth: string; ms?: number }): void {
    this.clear();
    const bubble = this.stage.querySelector<HTMLElement>("[data-yuki-say]");
    const line = bubble?.querySelector<HTMLElement>("[data-yuki-line]");
    if (bubble && line) {
      line.textContent = text;
      bubble.classList.remove("is-new");
      void bubble.offsetWidth;
      bubble.classList.add("is-new");
    }
    this.face(then.eyes, "talk");
    if (!this.reduced && this.her) {
      const svg = this.her.svg;
      const beats = Math.max(3, Math.min(12, Math.round(text.length / 3)));
      for (let i = 1; i <= beats; i++) this.later(i * 110, () => { svg.dataset["mouth"] = i % 2 ? "calm" : "talk"; });
      this.later((beats + 1) * 110, () => this.face(then.eyes, then.mouth, then.ms ?? 0));
    } else {
      this.face(then.eyes, then.mouth, then.ms ?? 0);
    }
  }

  hop(): void {
    if (this.reduced) return;
    const g = this.stage.querySelector<SVGGElement>(".ykstage__her");
    if (!g) return;
    g.classList.remove("is-hop");
    void g.getBoundingClientRect();
    g.classList.add("is-hop");
  }
}

/** The Download click: the page becomes the guide. */
function toGuide(page: HTMLElement, stage: Stage | null, reduced: boolean): void {
  if (page.dataset["stage"] === "guide") return;
  page.dataset["stage"] = "guide";
  stage?.say(page.dataset["sayGuide"] ?? "open it when it lands!", { eyes: "happy", mouth: "smile" });
  stage?.hop();
  const after = page.querySelector<HTMLElement>("[data-yuki-after]");
  if (after) after.textContent = "It's downloading from GitHub. When it lands, open it and follow the steps below.";
  const install = page.querySelector<HTMLElement>("#install");
  // a moment to see her cheer, then the steps (the click itself already started the file)
  window.setTimeout(() => {
    if (!install) return;
    install.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    install.focus({ preventScroll: true });
  }, reduced ? 0 : 700);
  startLink(page, stage);
}

/** The live link (off unless data/yuki.ts YUKI_LINK.enabled and its markup is in the page). */
function startLink(page: HTMLElement, stage: Stage | null): void {
  const box = page.querySelector<HTMLElement>("[data-yuki-link]");
  if (!YUKI_LINK.enabled || !box) return;
  const text = box.querySelector<HTMLElement>("[data-yuki-link-text]");
  const url = `${box.dataset["base"] ?? YUKI_LINK.base}${box.dataset["path"] ?? YUKI_LINK.path}`;
  const started = Date.now();
  let greeted = false;
  box.hidden = false;
  if (text) text.textContent = "Waiting for YUKI to start on this PC.";
  const ask = async (): Promise<void> => {
    if (Date.now() - started > YUKI_LINK.giveUpMs) { box.hidden = true; return; }
    try {
      // (Chromium's local network access: the request names its target, and the visitor may be asked first)
      const res = await fetch(url, { mode: "cors", cache: "no-store", credentials: "omit", targetAddressSpace: "loopback" } as RequestInit);
      const state = readLinkStatus(res.ok ? await res.json() : null);
      if (state.kind === "setup" && text) {
        box.dataset["state"] = "setup";
        text.textContent = state.progress === null ? "YUKI is setting up on this PC." : `YUKI is setting up on this PC: ${Math.round(state.progress * 100)}%.`;
      } else if (state.kind === "ready") {
        box.dataset["state"] = "ready";
        if (text) text.textContent = "YUKI is running on this PC. Say hi!";
        if (!greeted) { greeted = true; stage?.say("you made it!", { eyes: "happy", mouth: "smile" }); stage?.hop(); }
        return;
      }
    } catch {
      // not running yet (or not reachable from here): keep asking quietly
    }
    window.setTimeout(() => void ask(), YUKI_LINK.everyMs);
  };
  void ask();
}

export function initYuki(reduced: boolean, fine: boolean): void {
  if (fine && !reduced) initGlances();
  restOffScreen(document.querySelectorAll(".ykh, .dlf__art--yuki, [data-ss], .yktile"));
  const page = document.querySelector<HTMLElement>("[data-yuki-page]");
  if (!page) return;
  const stageEl = page.querySelector<HTMLElement>("[data-yuki-stage]");
  const stage = stageEl ? new Stage(stageEl, hersIn(stageEl)[0] ?? null, reduced) : null;
  if (stageEl && stage) {
    let n = 0;
    stageEl.addEventListener("click", () => {
      if (page.dataset["release"] === "none") {
        stage.say("five more minutes...", { eyes: "sleepy", mouth: "calm" });
        return;
      }
      stage.hop();
      stage.say(POKES[n++ % POKES.length]!, { eyes: "happy", mouth: "smile", ms: 1600 });
    });
  }
  for (const key of page.querySelectorAll<HTMLAnchorElement>("a.ykh__dl")) {
    // the default action runs (the download); this only adds the guide
    key.addEventListener("click", (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      toGuide(page, stage, reduced);
    });
  }
}

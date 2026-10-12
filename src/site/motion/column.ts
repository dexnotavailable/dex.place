// The page column on "/" (GDK 3.7, 3.8): the title on black, the self-paced fall, the world
// window, then the website. This script runs the parts that live between the page and the
// world:
//
// - the dex mark intro (the title lane's) on the title, while the world loads behind;
// - the talisman with her name: the loader lights its script as the world loads, it falls
//   with you through the sky as you scroll, lands where the scenery starts beside "want to
//   explore the world we made? PLAY", goes onto her hat when she plays, and follows you down
//   the page when you scroll on into the website (a press on it takes you back up);
// - "continue": the cinematic fall (bars, the letter's three lines as captions, one a
//   second), ending on the catch and the start of the reveal; it starts the sound;
// - PLAY: the reveal starts at 0:00 (she has just slapped the talisman on her hat); a
//   visitor who scrolls on past PLAY instead gets TESU in the world window;
// - the address: as a section or the world window crosses the middle of the screen the
//   address is replaced in place (no reload, no Back-button pile-up).

import { Talisman, TALISMAN_H, TALISMAN_W } from "./talisman.ts";

interface ColumnWorld {
  ready?: Promise<void>;
  play?(ctx?: AudioContext): void;
  title?(text: string): void;
  holding?(): boolean;
}

const LINES = [
  "To Zhusha, hunter of the western school.",
  "The Emperor of Tesu opens his court to challengers.",
  "A prize for every bout. Bring your sword.",
];

/** Section ids on "/" and their addresses, in page order. */
const SECTIONS: [string, string][] = [
  ["projects", "/projects/"],
  ["downloads", "/downloads/"],
  ["gallery", "/gallery/"],
  ["docs", "/docs/"],
  ["blog", "/blog/"],
  ["donate", "/donate/"],
];

let audio: AudioContext | null = null;
/** The page's audio, started inside the press that asked for it (PLAY, "continue"). */
function startAudio(): AudioContext | null {
  try {
    if (!audio) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AC) audio = new AC();
    }
    if (audio?.state === "suspended") void audio.resume();
  } catch {
    audio = null;
  }
  return audio;
}

export function initColumn(reduced: MediaQueryList): void {
  const title = document.querySelector<HTMLElement>("[data-col-title]");
  const fall = document.querySelector<HTMLElement>("[data-col-fall]");
  const anchor = document.querySelector<HTMLElement>(".world-top");
  const worldEl = document.querySelector<HTMLElement>("[data-world-mount]");
  if (!title || !fall || !anchor || !worldEl) return;
  const cont = title.querySelector<HTMLButtonElement>("[data-col-continue]")!;
  const load = title.querySelector<HTMLElement>("[data-col-load]")!;
  const caption = document.querySelector<HTMLElement>("[data-col-caption]")!;
  const playBox = worldEl.querySelector<HTMLElement>("[data-world-play]");
  const playBtn = worldEl.querySelector<HTMLButtonElement>("[data-world-playbtn]");
  const root = document.documentElement;

  // --- the overlay the talisman is drawn on, and the button that sits over it on the page
  const cv = document.createElement("canvas");
  cv.className = "col-talisman";
  cv.setAttribute("aria-hidden", "true");
  document.body.append(cv);
  const ctx = cv.getContext("2d")!;
  const back = document.createElement("button");
  back.type = "button";
  back.className = "col-talisman-btn";
  back.setAttribute("aria-label", "Back up to the world");
  back.hidden = true;
  document.body.append(back);
  back.addEventListener("click", () => {
    anchor.scrollIntoView({ behavior: reduced.matches ? "auto" : "smooth" });
    document.dispatchEvent(new CustomEvent("dex:toworld"));
  });
  const talisman = new Talisman();

  // --- the world window
  let world: ColumnWorld | null = (window as Window & { __dexWorld?: ColumnWorld }).__dexWorld ?? null;
  let worldReady = false;
  const onWorld = (w: ColumnWorld): void => {
    world = w;
    void w.ready?.then(() => { worldReady = true; }, () => { worldReady = true; });
  };
  if (world) onWorld(world);
  document.addEventListener("dex:world", (e) => onWorld((e as CustomEvent<ColumnWorld>).detail));

  // --- the title: the dex mark writes itself while the world loads
  let introDone = false;
  let intro: { skip(): void } | null = null;
  import("../../intro/index.ts").then((m) => {
    const h = m.playIntro({ parent: title, reducedMotion: reduced.matches });
    intro = h;
    void h.done.then(() => { introDone = true; });
  }, () => { introDone = true; });
  const t0 = performance.now();

  let played = false;
  let tesuShown = false;
  let cine: { t: number; from: number; to: number } | null = null;

  const play = (): void => {
    if (played) return;
    played = true;
    const a = startAudio();
    world?.play?.(a ?? undefined);
    if (playBox) playBox.hidden = true;
    document.dispatchEvent(new CustomEvent("dex:toworld"));
  };
  playBtn?.addEventListener("click", () => {
    anchor.scrollIntoView({ behavior: "auto" });
    play();
  });
  cont.addEventListener("click", () => {
    startAudio();
    intro?.skip();
    cont.hidden = true;
    // the cinematic fall: the page carries her letter down through the sky to the world
    cine = { t: 0, from: window.scrollY, to: anchor.offsetTop };
    root.classList.add("col-cine");
  });
  // a scroll skips the mark (the visitor has chosen to fall at their own pace)
  window.addEventListener("scroll", () => { if (!introDone && window.scrollY > 40) intro?.skip(); }, { passive: true });
  // during the cinematic fall the page is carried; the wheel and swipes wait
  const hold = (e: Event): void => { if (cine) e.preventDefault(); };
  window.addEventListener("wheel", hold, { passive: false });
  window.addEventListener("touchmove", hold, { passive: false });

  // --- the address
  const sections = SECTIONS.map(([id, path]) => [document.getElementById(id), path] as const).filter(([el]) => !!el) as [HTMLElement, string][];
  let address = location.pathname;
  const route = (vh: number, pWorld: number, worldTop: number): void => {
    const st = history.state as { gallery?: string } | null;
    if (st && typeof st === "object" && "gallery" in st) return; // the gallery's viewer owns the address
    const mid = window.scrollY + vh / 2;
    let path = "/";
    if (mid >= worldTop && pWorld < 0.5) path = "/tesu/";
    for (const [el, p] of sections) {
      const r = el.getBoundingClientRect();
      if (r.top <= vh / 2 && r.bottom > vh / 2) path = p;
    }
    if (path !== address) {
      address = path;
      history.replaceState(history.state, "", path);
    }
  };

  // --- the frame loop: where the talisman is, what it is doing, the cinematic fall
  let last = performance.now();
  const pos = { x: innerWidth / 2, y: innerHeight * 0.5, seen: 0 };
  let caughtAt = -1;
  const tick = (now: number): void => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const dpr = window.devicePixelRatio || 1;
    const vw = innerWidth, vh = innerHeight;
    if (cv.width !== Math.round(vw * dpr) || cv.height !== Math.round(vh * dpr)) {
      cv.width = Math.round(vw * dpr);
      cv.height = Math.round(vh * dpr);
    }
    const worldTop = anchor.offsetTop;
    const worldH = worldEl.offsetHeight || vh;
    const sy = window.scrollY;
    const pWorld = Math.max(0, Math.min(1, (sy - worldTop) / worldH));

    // the cinematic fall: about 4.6 s down through the sky, the letter's lines one a second
    if (cine) {
      cine.t += dt;
      const D = reduced.matches ? 0.01 : 4.6;
      const u = Math.min(1, cine.t / D);
      const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
      window.scrollTo(0, cine.from + (cine.to - cine.from) * e);
      const line = Math.floor((cine.t - 0.5) / 1.2);
      caption.textContent = line >= 0 && line < LINES.length ? LINES[line]! : "";
      caption.classList.toggle("on", line >= 0 && line < LINES.length);
      if (u >= 1 && cine.t > (reduced.matches ? 0 : 4.2)) {
        cine = null;
        root.classList.remove("col-cine");
        caption.textContent = "";
        caption.classList.remove("on");
        play();
      }
    }

    // the loader: the script lights from the top as the world loads; "continue" once it is in
    const loading = !worldReady;
    const lit = loading ? Math.min(0.9, (now - t0) / 6000) : 1;
    load.hidden = !loading;
    if (!loading && !played && !cine && cont.hidden && sy < vh * 0.5 && introDone) cont.hidden = false;
    if (playBox) playBox.hidden = played || loading || !world?.holding?.();
    // a visitor who scrolls on past PLAY gets TESU in the world window (PLAY saves it for the terrace)
    if (!played && !tesuShown && worldReady && pWorld > 0.06) {
      tesuShown = true;
      world?.title?.("TESU");
    }

    // where the talisman wants to be
    // whole device pixels per art pixel: big on the title, a step smaller down the page
    const onSite = pWorld > 0.12;
    const k = Math.max(2, Math.round((vh * dpr) / 300) - (onSite ? 1 : 0));
    const kc = k / dpr;
    const pageMargin = Math.max(20, (TALISMAN_W * kc) / 2 + 10);
    let tx = vw / 2, ty = vh * 0.42, show = true, flutter = 0.6, wind = 0.2;
    const fallFrom = vh * 0.3, landAt = worldTop - vh * 0.1;
    if (played || caughtAt >= 0) {
      // on her hat; pulled off it when the page carries on down to the website
      if (pWorld > 0.12) { tx = vw - pageMargin; ty = vh * 0.3; flutter = 0.8; wind = -0.4; }
      else show = false;
    } else if (pWorld > 0.12) {
      tx = vw - pageMargin; ty = vh * 0.3; flutter = 0.8; wind = -0.4;
    } else if (sy < fallFrom) {
      // on the title: below the mark, swaying, once the mark has gone
      show = introDone || cine !== null;
      ty = vh * 0.36;
      flutter = 0.35;
    } else if (sy < landAt - vh * 0.5) {
      // falling with you through the sky, drifting on the wind
      tx = vw * (0.5 + 0.16 * Math.sin(sy / 520 + now / 2600));
      ty = vh * 0.4;
      flutter = 1;
      wind = 0.6 * Math.sin(sy / 300);
    } else {
      // landing where the scenery starts, beside the prompt
      const f = Math.max(0, Math.min(1, (sy - (landAt - vh * 0.5)) / (vh * 0.5)));
      // beside the prompt, on the left of its paper strip
      const r = (playBox && !playBox.hidden ? playBox : playBtn)?.getBoundingClientRect();
      const lx = r && r.width ? r.left - TALISMAN_W * kc * 0.8 : vw * 0.4;
      const ly = r && r.height ? r.top + r.height / 2 - TALISMAN_H * kc * 0.15 : vh * 0.6;
      const fx = vw * (0.5 + 0.16 * Math.sin(sy / 520 + now / 2600)), fy = vh * 0.4;
      tx = fx + (lx - fx) * f;
      ty = fy + (ly - fy) * f;
      flutter = 1 - 0.75 * f;
      wind = 0.3 * (1 - f);
    }
    if (cine) { show = true; tx = vw * (0.5 + 0.1 * Math.sin(cine.t * 1.7)); ty = vh * 0.38; flutter = 1; wind = 0.5 * Math.sin(cine.t); }
    if (played && caughtAt < 0) caughtAt = now;
    // it eases where it is going (it is paper on the wind, not a cursor)
    const ease = reduced.matches ? 1 : 1 - Math.pow(0.002, dt);
    pos.x += (tx - pos.x) * ease;
    pos.y += (ty - pos.y) * ease;
    pos.seen += ((show ? 1 : 0) - pos.seen) * (reduced.matches ? 1 : 1 - Math.pow(0.01, dt));
    talisman.step(dt, wind, flutter, reduced.matches);
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (pos.seen > 0.02) {
      ctx.globalAlpha = Math.min(1, pos.seen * 1.2);
      talisman.draw(ctx, pos.x * dpr, (pos.y - (TALISMAN_H * kc) / 2) * dpr, k, lit);
      ctx.globalAlpha = 1;
    }
    // on the page it is a button back up to the world
    const onPage = show && pWorld > 0.12;
    back.hidden = !onPage;
    if (onPage) {
      back.style.left = `${pos.x - (TALISMAN_W * kc) / 2}px`;
      back.style.top = `${pos.y - (TALISMAN_H * kc) / 2}px`;
      back.style.width = `${TALISMAN_W * kc}px`;
      back.style.height = `${TALISMAN_H * kc}px`;
    }
    route(vh, pWorld, worldTop);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

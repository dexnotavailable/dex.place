// The page column (Dex 10-16; roadmap SITE-SCROLL.md): the game screen at the top, the website below it, the
// jetty scene at the bottom; the ofuda is the game's state (motion/flow.ts holds the table).
//
// - On load "dex" writes itself (eased, overlapping letters) and STAYS; under it the pixel loader runs (Dex 10-18:
//   "a smooth pixelized loading pixel graphic, then it forms into the ofuda"; motion/pixel-loader.ts) while the world
//   streams in behind a black cover. When the world is in, it gathers into the small ofuda, which from then on is a
//   real piece of paper (PaperOfuda), and "click to continue" shows.
// - Scroll down early and the loader trails down with you and settles in the website's top-right corner; scroll
//   all the way back up and it goes home. A deep link (/downloads/ ...) lands on its section with it there.
// - Four ways into the game, all ending in one event, `dex:enter` with the way (motion/enter.ts plays today's
//   opening from it): 1 "continue" at the top; 2 the corner ofuda (the page goes up, the same cutscene);
//   3 back up from the website, then "continue"; 4 at the bottom, "experience the world we made": the corner
//   ofuda drifts right to left down into the jetty scene to her, the white fade clears, then the game.
// - In game the corner is empty (the ofuda is on her hat) and the jetty has no Zhusha; the game pauses while
//   the website covers it (motion/world.ts) and carries on when you scroll back up.
// - "continue" without accidents (src/tesu/opening/press.ts): the button, Space or Enter, or a click anywhere
//   on the game screen but the loader (a click on the loader pokes it); nothing for 300 ms after it appears.
// - The address follows the scroll on "/" with no reload and no Back-button pile-up (replaceState only).

import { playIntro, type IntroHandle } from "../../intro/index.ts";
import { BEATS } from "../../tesu/opening/beats.ts";
import { pressContinues } from "../../tesu/opening/press.ts";
import type { OpeningSet } from "../../tesu/mount.ts";
import { ENTER_EVENT, initOpening, type EnterDetail, type Way } from "./enter.ts";
import { bottomView, cornerView, driftPoint, topView, trail, trailPoint, type FlowState } from "./flow.ts";
import { BOX_H, BOX_W, OFUDA_H, PaperOfuda, TIE, createPixelLoader } from "./pixel-loader.ts";

interface ColumnWorld {
  ready?: Promise<void>;
  booted?: Promise<void>;
  play?(link?: unknown): void;
  holding?(): boolean;
  openingSet?(): OpeningSet | null;
  progress?(): number;
}

/** Section ids on "/" and their addresses, in page order. */
const SECTIONS: [string, string][] = [
  ["downloads", "/downloads/"],
  ["gallery", "/gallery/"],
  ["docs", "/docs/"],
  ["blog", "/blog/"],
  ["donate", "/donate/"],
];

/** About how much the world downloads before it can play (the Save-Data note). */
const WORLD_MB = 6;
/** Where the mark's middle and the loader's top sit on the game screen (shares of its height). */
const MARK_Y = 0.4;
const STAGE_Y = 0.6;
/** Way 4: the ofuda's drift into the jetty, then the beat before the game (s). */
const DRIFT_S = 2.4;

/** After the catch: the white fade clears (1.2 s), then the whole scene holds this long before the game. */
const CAUGHT_S = 1.2 + 1.6;
/** The cut up to the game screen: a short white cover, out and back in (s each way). */
const CUT_S = 0.32;

declare global {
  interface Window {
    __dexWorld?: ColumnWorld;
    /** For checks: the column's state. */
    __dexFlow?: () => { state: FlowState; cover: number; trail: number; stage: string; shown: string[]; way: Way | null; corner: string };
  }
}

export function initColumn(reduced: MediaQueryList): void {
  const gs = document.querySelector<HTMLElement>(".world[data-world-mount]");
  const title = document.querySelector<HTMLElement>("[data-gs-title]");
  const sheet = document.getElementById("site");
  if (!gs || !title || !sheet) return;
  const cont = title.querySelector<HTMLButtonElement>("[data-gs-continue]")!;
  const status = title.querySelector<HTMLElement>("[data-gs-status]")!;
  const jetty = document.querySelector<HTMLElement>("[data-jetty]");
  const jettyGo = jetty?.querySelector<HTMLButtonElement>("[data-jetty-go]") ?? null;
  const her = jetty?.querySelector<HTMLElement>("[data-jetty-her]") ?? null;
  const jettyNote = jetty?.querySelector<HTMLElement>("[data-jetty-note]") ?? null;
  const hdr = sheet.querySelector<HTMLElement>(".hdr");
  const slot = hdr?.querySelector<HTMLElement>("[data-ofuda-slot]") ?? null;
  // the game screen is sticky (its own offsetTop follows the scroll): measure from the empty anchor above it
  const anchor = document.querySelector<HTMLElement>(".world-top");
  const coverOf = (): number => Math.max(0, Math.min(1, (window.scrollY - (anchor?.offsetTop ?? 0)) / (gs.offsetHeight || innerHeight)));
  const root = document.documentElement;
  const home = sheet.dataset.page === "home";
  const t0 = performance.now();

  // --- the overlay the loader and the ofuda are drawn on, and the corner ofuda's button
  const cv = document.createElement("canvas");
  cv.className = "ofuda-layer";
  cv.setAttribute("aria-hidden", "true");
  document.body.append(cv);
  const ctx = cv.getContext("2d")!;
  const corner = document.createElement("button");
  corner.type = "button";
  corner.className = "ofuda-btn";
  corner.setAttribute("aria-label", "Enter the world (the ofuda)");
  corner.hidden = true;
  // way 4's cut up to the game screen
  const cut = document.createElement("div");
  cut.className = "page-cut";
  cut.setAttribute("aria-hidden", "true");
  document.body.append(cut);
  // in the tab order right after the header
  if (hdr) hdr.after(corner);
  else sheet.prepend(corner);

  const seed = (Date.now() / 1000) | 0;
  // the pixel loader under "dex" (its box drawn on the overlay from this loop), and once it has gathered into the
  // ofuda, the paper alone in page space (art px = css px / kc), carried to the corner, the jetty or away
  const loader = createPixelLoader({ reduced, seed });
  let paper: PaperOfuda | null = null;
  /** The loader has gathered into the ofuda (landOnOfuda resolved) and the page's paper has taken over. */
  let landed = false;
  let landing = false;
  /** A poke on the ofuda: a puff of air (ms). */
  let pokeAt = -Infinity;

  // --- the world and the opening
  let world: ColumnWorld | null = window.__dexWorld ?? null;
  let worldReady = false;
  let failed: string | null = null;
  const onWorld = (w: ColumnWorld): void => {
    world = w;
    void w.ready?.then(() => { worldReady = true; }, (e: unknown) => {
      failed = e instanceof Error && /WebGL2/.test(e.message) ? "webgl" : "failed";
    });
  };
  if (world) onWorld(world);
  document.addEventListener("dex:world", (e) => onWorld((e as CustomEvent<ColumnWorld>).detail));
  const opening = initOpening({ reduced, world: () => world });
  // Save-Data, or a 2G-class line: the world waits to be asked (motion/world.ts marks it)
  let asked = !root.hasAttribute("data-world-ask");

  // --- "dex": written once the game screen is in view, and it stays
  let intro: IntroHandle | null = null;
  let markDone = false;
  const startMark = (): void => {
    if (intro) return;
    try {
      intro = playIntro({ parent: title, reducedMotion: reduced.matches, stay: true, y: MARK_Y });
      void intro.written.then(() => { markDone = true; });
    } catch {
      markDone = true;
    }
  };

  // --- the state
  let state: FlowState = "loading";
  let way: Way | null = null;
  let wentDown = false;
  /** The gust after the press: the ofuda is snatched up and out of the top (ms start). */
  let gustAt = -1;
  /** Way 2: going up to the game screen first. */
  let climbing: { at: number } | null = null;
  /** Way 4: the drift into the jetty, then the catch. */
  let drift: { at: number; from: { x: number; y: number } } | null = null;
  let caughtAt = -1;
  const setState = (s: FlowState): void => {
    if (s === state) return;
    state = s;
    root.dataset.flow = s;
    const b = bottomView(s);
    jetty?.toggleAttribute("data-her", b.zhusha);
    if (jettyGo) jettyGo.hidden = !b.button;
  };
  root.dataset.flow = state;
  setState("loading");
  jetty?.toggleAttribute("data-her", true);

  const isSetIn = (): boolean => {
    if (!worldReady || !opening.ready()) return false;
    if (world?.progress && world.progress() >= 1) return true;
    // the opening set itself: progress() can stop a hair short of 1 (0.7 + 0.1 + 0.1 + 0.1 is 0.9999999999999999 in
    // floating point, so it tops out at 0.99), and then the loader would never land
    const s = world?.openingSet?.() ?? null;
    return !!s && s.plates >= 1 && s.close && s.font && s.ofuda;
  };

  const enter = (w: Way): void => {
    if (state !== "loaded") return;
    way = w;
    setState("ingame");
    intro?.release();
    if (w !== "bottom") gustAt = performance.now();
    gs.setAttribute("data-entered", "");
    cont.hidden = true;
    corner.hidden = true;
    document.dispatchEvent(new CustomEvent<EnterDetail>(ENTER_EVENT, { detail: { way: w } }));
  };
  const toTop = (): void => {
    window.scrollTo({ top: 0, behavior: reduced.matches ? "instant" : "smooth" });
  };

  // way 1 and 3: "continue" (CHECK-1 item 12 rules)
  const guard = BEATS.ui.guardMs;
  let readyAt = Infinity;
  let downAt = -Infinity;
  let downPoke = false;
  const pokeRect = { x: 0, y: 0, w: 0, h: 0 };
  const inPoke = (x: number, y: number): boolean => x >= pokeRect.x && x <= pokeRect.x + pokeRect.w && y >= pokeRect.y && y <= pokeRect.y + pokeRect.h;
  const otherControl = (el: Element | null): boolean => !!el && el !== cont && !!el.closest("a, button, input, select, textarea, [role='button']");
  const press = (): void => enter(wentDown ? "top" : "continue");
  gs.addEventListener("pointerdown", (e) => {
    opening.unlock();
    downAt = performance.now();
    downPoke = inPoke(e.clientX, e.clientY);
    if (downPoke && landed) pokeAt = performance.now();
  });
  gs.addEventListener("click", (e) => {
    if (state !== "loaded") return;
    if (pressContinues({ ready: !cont.hidden, readyAt, guardMs: guard, downAt, onStage: downPoke, onOtherControl: otherControl(e.target as Element | null) })) press();
  });
  document.addEventListener("keydown", (e) => {
    opening.unlock();
    if (state !== "loaded" || cont.hidden) return;
    if (!pressContinues({ ready: !cont.hidden, readyAt, guardMs: guard, downAt: performance.now(), onStage: false, onOtherControl: otherControl(document.activeElement), repeat: e.repeat, key: e.key })) return;
    e.preventDefault();
    press();
  });
  document.addEventListener("pointerdown", () => opening.unlock(), { capture: true, passive: true });

  // way 2: the corner ofuda
  corner.addEventListener("click", () => {
    if (state !== "loaded" || climbing || drift) return;
    opening.unlock();
    climbing = { at: performance.now() };
    toTop();
  });

  // way 4: "experience the world we made"
  jettyGo?.addEventListener("click", () => {
    if (state !== "loaded" || climbing || drift) return;
    opening.unlock();
    jettyGo.hidden = true;
    drift = { at: performance.now(), from: { x: pos.x, y: pos.y } };
  });

  // --- the status line under the loader
  let statusKey = "";
  const say = (key: string, html: string): void => {
    if (key === statusKey) return;
    statusKey = key;
    status.innerHTML = html;
    status.querySelector<HTMLButtonElement>("[data-world-ask]")?.addEventListener("click", () => {
      asked = true;
      root.removeAttribute("data-world-ask");
      document.dispatchEvent(new CustomEvent("dex:loadworld"));
    });
  };

  // --- the address (home only)
  const sections = SECTIONS.map(([id, path]) => [document.getElementById(id), path] as const).filter(([el]) => !!el) as [HTMLElement, string][];
  let address = location.pathname;
  const goHome = (): void => {
    if (location.pathname !== "/") history.replaceState(history.state, "", "/" + location.search);
    address = "/";
  };
  if (home) {
    // Following a link from here: the homepage's history entry goes back to "/" first, so the navigation is an
    // ordinary new entry and Back returns to the homepage, scrolled where it was.
    document.addEventListener("click", (e) => {
      if (e.defaultPrevented || e.button !== 0) return;
      const a = (e.target instanceof Element ? e.target : null)?.closest<HTMLAnchorElement>("a[href]");
      if (!a || a.hasAttribute("download") || (a.target && a.target !== "_self")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search && url.hash) return;
      goHome();
    }, true);
    window.addEventListener("pagehide", () => goHome());
  }
  const route = (vh: number): void => {
    if (!home) return;
    const st = history.state as { gallery?: string } | null;
    if (st && typeof st === "object" && "gallery" in st) return; // the gallery's viewer owns the address
    let path = "/";
    for (const [el, p] of sections) if (el.getBoundingClientRect().top <= vh / 2) path = p;
    if (path !== address) {
      address = path;
      history.replaceState(history.state, "", path);
    }
  };

  // --- the frame loop
  let last = performance.now();
  const pos = { x: innerWidth / 2, y: innerHeight * STAGE_Y };
  let placed = false;
  let drawn = true;
  let paperFresh = false;
  const tick = (now: number): void => {
    // after a stall (the world's loading can hold the page for seconds) it snaps to where it belongs
    const stalled = now - last > 100;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const dpr = window.devicePixelRatio || 1;
    const vw = innerWidth, vh = innerHeight;
    if (cv.width !== Math.round(vw * dpr) || cv.height !== Math.round(vh * dpr)) {
      cv.width = Math.round(vw * dpr);
      cv.height = Math.round(vh * dpr);
    }
    const gsH = gs.offsetHeight || vh;
    const cover = coverOf();
    const p = (now - t0) / 1000;
    if (cover < 0.98) startMark();
    root.classList.toggle("gs-away", cover > 0.5);
    opening.covered(cover >= 0.999);

    // loading -> loaded
    if (state === "loading" && !failed && isSetIn()) {
      setState("loaded");
      landing = true;
      void loader.landOnOfuda().then(() => { landing = false; landed = true; paperFresh = true; });
    }
    if (state === "loading") {
      if (failed) {
        say(failed, failed === "webgl"
          ? `the world needs a newer browser · <a href="#site">visit the site ↓</a>`
          : `the world couldn't load · <a href="#site">you can still use the site ↓</a>`);
      } else if (!asked) {
        say("ask", `the world is big (about ${WORLD_MB} MB) · <button type="button" class="gs-ask" data-world-ask>load it</button>`);
      } else if (p >= BEATS.ui.slowAt) {
        say("slow", `still loading the world · <a href="#site">you can visit the site meanwhile ↓</a>`);
      } else {
        say("loading", "loading the world");
      }
    }

    // the pixel scale: the ofuda at about the size it is in the game (12 x 30 css px on a desktop); the loader's box
    // at the same scale on the game screen, at half of it (whole device px) in the header's slot
    const k = Math.max(2, Math.round((vh * dpr) / 540));
    const kc = k / dpr;
    if (cover > 0.9) wentDown = true;

    // where it wants to be
    const homeAt = { x: vw / 2, y: Math.round(gs.getBoundingClientRect().top + gsH * STAGE_Y) };
    // the website's corner: the slot in the header (right of World, or left of Menu), the thing centred in it;
    // never lower than home (it rides up with the website as it comes up)
    const f = trail(cover);
    const inSlot = f > 0.55;
    const kL = landed || !inSlot ? k : Math.max(1, Math.round(k / 2));
    const kcL = kL / dpr;
    // (positions are the ofuda's tie: the middle of its top edge; the box is drawn round it)
    const sr = slot?.getBoundingClientRect();
    const cornerAt = sr && sr.width
      ? {
        x: sr.left + sr.width / 2,
        y: Math.min(landed ? sr.top + (sr.height - OFUDA_H * kc) / 2 : sr.top + sr.height / 2 - (BOX_H / 2 - TIE.y) * kcL, homeAt.y),
      }
      : { x: (document.documentElement.clientWidth || vw) - 30, y: Math.min(homeAt.y, 78) };
    let target = trailPoint(f, homeAt, cornerAt, vw);
    // the air the paper hangs in: the loader's own breeze at home, a headwind while it trails, a still corner
    let wind = 6, gust = 0.4, show = true;
    if (f > 0.02 && f < 0.98) { wind = -40; gust = 1; }
    else if (f >= 0.98) { wind = 4; gust = 0.3; }

    // way 2: up to the game screen, then the same cutscene
    if (climbing) {
      if (window.scrollY <= 2 || now - climbing.at > 1800) {
        climbing = null;
        if (window.scrollY > 2) window.scrollTo({ top: 0, behavior: "instant" });
        enter("corner");
      }
    }
    // way 4: the drift into the jetty, the catch, then the game
    if (drift && her) {
      // onto the tie on her hat (motion/sky.ts places .jetty__hat there from her idle drawing; the ofuda's top on it)
      const r = (her.querySelector(".jetty__hat") ?? her).getBoundingClientRect();
      const to = { x: r.left + r.width / 2, y: r.top };
      const u = reduced.matches ? 1 : Math.min(1, (now - drift.at) / (DRIFT_S * 1000));
      target = driftPoint(u, drift.from, to);
      wind = -120 * (1 - u);
      gust = 1;
      if (u >= 1 && caughtAt < 0) {
        caughtAt = now;
        jetty?.setAttribute("data-caught", "");
      }
      if (caughtAt >= 0) {
        show = false;
        if (now - caughtAt > (reduced.matches ? 0 : CAUGHT_S * 1000)) {
          drift = null;
          climbing = null;
          // up to the game screen in one cut under a short cover (never a long ride back through the website),
          // and the game starts from the catch's way in
          if (reduced.matches) {
            window.scrollTo({ top: 0, behavior: "instant" });
            enter("bottom");
          } else {
            cut.classList.add("is-on");
            window.setTimeout(() => {
              window.scrollTo({ top: 0, behavior: "instant" });
              enter("bottom");
              cut.classList.remove("is-on");
            }, CUT_S * 1000);
          }
        }
      }
    }

    // after the press: the gust takes it up and out of the top
    if (gustAt >= 0) {
      const u = (now - gustAt) / 900;
      if (u < 1 && !reduced.matches) {
        target = { x: homeAt.x + vw * 0.06 * u, y: homeAt.y - (homeAt.y + 60) * u * u * 1.15 };
        wind = 140;
        gust = 1;
      } else show = false;
    } else if (state === "ingame") show = false;

    // it eases toward where it is going (paper on the wind, not a cursor); after a stall it is simply there
    if (!placed || reduced.matches || stalled) {
      pos.x = target.x;
      pos.y = target.y;
      if (placed && stalled && paper) { paper.moveTie(target.x / kc, target.y / kc); paper.reset(); }
      placed = true;
    } else {
      const ease = gustAt >= 0 || drift ? 1 - Math.pow(0.00002, dt) : 1 - Math.pow(0.004, dt);
      pos.x += (target.x - pos.x) * ease;
      pos.y += (target.y - pos.y) * ease;
    }

    // the loader and the ofuda
    // (in game, once the gust has gone, the layer is cleared once and left alone)
    const idle = state === "ingame" && !show;
    if (!idle || drawn) ctx.clearRect(0, 0, cv.width, cv.height);
    drawn = !idle;
    const asking = !asked || !!failed;
    ctx.globalAlpha = failed ? 0.4 : 1;
    if (!landed) {
      // the loader (gathering into the ofuda once the world is in), its tie at `pos`
      if (!asking || state !== "loading") loader.tick(dt);
      if (show && (!asking || landing)) {
        loader.drawTo(ctx, Math.round((pos.x - TIE.x * kcL) * dpr / kL) * kL, Math.round((pos.y - TIE.y * kcL) * dpr / kL) * kL, kL);
      }
    } else {
      // the paper alone, from where the loader's paper hangs at the landing (at rest then: no jump)
      if (!paper || paperFresh) {
        paper = new PaperOfuda({ tie: { x: pos.x / kc, y: pos.y / kc }, seed });
        paperFresh = false;
      }
      paper.wind.x = wind;
      paper.wind.y = gustAt >= 0 ? -60 : 0;
      paper.gust = Math.max(gust, 1.4 * Math.max(0, 1 - (now - pokeAt) / 600));
      paper.moveTie(pos.x / kc, pos.y / kc);
      // reduced motion: it never moves (it hangs straight from its tie)
      if (reduced.matches) paper.reset();
      else paper.step(dt);
      if (show) paper.drawTo(ctx, 0, 0, k);
    }
    ctx.globalAlpha = 1;

    // the poke zone (on the game screen only)
    const szW = (landed ? 16 : BOX_W) * kc, szH = (landed ? OFUDA_H + 6 : BOX_H) * kc;
    pokeRect.x = pos.x - szW / 2 - 10;
    pokeRect.y = pos.y - (landed ? 0 : TIE.y * kc) - 10;
    pokeRect.w = szW + 20;
    pokeRect.h = cover < 0.5 && show ? szH + 20 : 0;

    // the game screen's own bits
    const top = topView(state);
    const showCont = top.cont && way === null && !drift && caughtAt < 0 && landed && markDone && cover < 0.4 && !climbing;
    if (showCont && cont.hidden) {
      cont.hidden = false;
      readyAt = now;
    } else if (!showCont && !cont.hidden) {
      cont.hidden = true;
      readyAt = Infinity;
    }
    status.hidden = state !== "loading";
    if (jettyNote) jettyNote.hidden = state !== "loading";

    // the corner ofuda is a way in (way 2) once it has settled there
    const inCorner = cornerView(state) === "ofuda" && f >= 0.98 && landed && !climbing && !drift && show;
    corner.hidden = !inCorner;
    if (inCorner) {
      // the button covers the slot (a steady target), kept inside the screen
      const b = sr && sr.width ? { x0: sr.left, y0: sr.top, x1: sr.right, y1: sr.bottom } : { x0: pos.x - 12, y0: pos.y - 4, x1: pos.x + 12, y1: pos.y + OFUDA_H * kc + 4 };
      const x0 = Math.max(0, Math.round(b.x0 - 4)), y0 = Math.max(0, Math.round(b.y0 - 2));
      corner.style.left = `${x0}px`;
      corner.style.top = `${y0}px`;
      corner.style.width = `${Math.min(vw - x0, Math.round(b.x1 - b.x0 + 8))}px`;
      corner.style.height = `${Math.round(b.y1 - b.y0 + 4)}px`;
    }

    route(vh);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  window.__dexFlow = () => ({
    state, cover: coverOf(), trail: trail(coverOf()),
    // ("done" once the paper has taken over: the checks' word for landed)
    stage: landed ? "done" : loader.phase, shown: [], way, corner: cornerView(state),
  });
}

// The page column on "/" (GDK 3.7, 3.8; the opening lane's PLAN.md sections 1, 2, 7, 8, 9, 11): the title on
// black, the waiting room, the press, the fall, the world window, then the website. This script runs the
// parts that live between the page and the world:
//
// - the dex mark (the title lane's) writes itself while the world loads behind it: it holds 1.5 s on a first
//   visit, 0.8 s on a return visit; it never pads the wait;
// - the waiting room: the letter (the talisman with her name) hangs on black and its script lights from the
//   top as the OPENING SET loads (the progress bar is the letter itself: the world's code, every plate along
//   the opening camera's path, her 192 px drawing, the title face, the talisman, Track 1's first piece); when
//   it is all in, one gold sweep runs down the script and "continue" appears. Not in at 20 s: an honest note
//   and the way down to the site; the world failing: says so, the site is right below. (The loader's items,
//   the chibi and the rest, are phase 2: the stage they will stand on pokes like the letter does now.)
// - "continue" (CHECK-1 item 12): the button, Space or Enter (a fresh press; never on another control), or a
//   click outside the letter / item stage; a click ON it pokes it, before and after the button shows; for
//   300 ms after the button appears nothing continues, and a press that began before never does. Esc does
//   nothing here. Nothing sounds before the press (a first click unlocks audio silently);
// - the press: the opening's conductor starts Track 1 and the heard clock (src/tesu/opening/); the letter is
//   snatched up by a gust; the page is carried down through its sky and lands on the world window exactly on
//   bar 2 (T 4.63), the letter's three lines one per bar in the bottom bar; reduced motion: a cross-fade;
// - PLAY (the scroll path): the same timeline from T 0, the world already in view;
// - the address: replaced in place as a section or the world window crosses the middle of the screen (kept
//   at "/" while the opening runs, so a reload replays it from the start).

import { Talisman, TALISMAN_H, TALISMAN_W } from "./talisman.ts";
import { BEATS } from "../../tesu/opening/beats.ts";
import { Conductor, makeAudio, readOpeningNote, type OpeningLink } from "../../tesu/opening/conductor.ts";
import { pressContinues } from "../../tesu/opening/press.ts";
import { fallAt } from "../../tesu/opening/timeline.ts";
import { Track1 } from "../../tesu/opening/track.ts";
import type { OpeningSet } from "../../tesu/mount.ts";

interface ColumnWorld {
  ready?: Promise<void>;
  booted?: Promise<void>;
  play?(link?: OpeningLink): void;
  title?(text: string): void;
  holding?(): boolean;
  openingSet?(): OpeningSet | null;
}

/** Section ids on "/" and their addresses, in page order. */
const SECTIONS: [string, string][] = [
  ["projects", "/projects/"],
  ["downloads", "/downloads/"],
  ["gallery", "/gallery/"],
  ["docs", "/docs/"],
  ["blog", "/blog/"],
  ["donate", "/donate/"],
];

/** About how much the world downloads before it can play (the Save-Data note). */
const WORLD_MB = 6;

export function initColumn(reduced: MediaQueryList): void {
  const title = document.querySelector<HTMLElement>("[data-col-title]");
  const fall = document.querySelector<HTMLElement>("[data-col-fall]");
  const anchor = document.querySelector<HTMLElement>(".world-top");
  const worldEl = document.querySelector<HTMLElement>("[data-world-mount]");
  if (!title || !fall || !anchor || !worldEl) return;
  const cont = title.querySelector<HTMLButtonElement>("[data-col-continue]")!;
  const load = title.querySelector<HTMLElement>("[data-col-load]")!;
  const playBox = worldEl.querySelector<HTMLElement>("[data-world-play]");
  const playBtn = worldEl.querySelector<HTMLButtonElement>("[data-world-playbtn]");
  const root = document.documentElement;
  const note = readOpeningNote();
  const repeat = note.seen > 0;
  const t0 = performance.now();

  // --- the overlay the talisman is drawn on, and the button that sits over it on the page
  const cv = document.createElement("canvas");
  cv.className = "col-talisman";
  cv.setAttribute("aria-hidden", "true");
  document.body.append(cv);
  const ctx2d = cv.getContext("2d")!;
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

  // --- Track 1's first piece decodes on the page's context from the start (it stays suspended, and silent,
  // until a gesture; the first one unlocks it quietly)
  const audio = makeAudio();
  const track = audio ? new Track1(audio, audio.destination) : null;
  let trackIn = !track;
  void track?.aReady.then(() => { trackIn = true; });
  const unlock = (): void => { if (audio && audio.state === "suspended") void audio.resume(); };

  // --- the world window
  let world: ColumnWorld | null = (window as Window & { __dexWorld?: ColumnWorld }).__dexWorld ?? null;
  let worldReady = false;
  let worldBooted = false;
  let failed: string | null = null;
  const onWorld = (w: ColumnWorld): void => {
    world = w;
    void w.ready?.then(() => { worldReady = true; worldBooted = true; }, (e: unknown) => {
      failed = e instanceof Error && /WebGL2/.test(e.message) ? "webgl" : "failed";
    });
    void w.booted?.then(() => { worldBooted = true; });
  };
  if (world) onWorld(world);
  document.addEventListener("dex:world", (e) => onWorld((e as CustomEvent<ColumnWorld>).detail));
  // Save-Data, or a 2G-class line: the world waits to be asked (motion/world.ts marks it)
  let asked = !root.hasAttribute("data-world-ask");

  // --- the title: the dex mark writes itself while the world loads
  let introDone = false;
  let intro: { skip(): void } | null = null;
  import("../../intro/index.ts").then((m) => {
    const h = m.playIntro({ parent: title, reducedMotion: reduced.matches, hold: repeat ? BEATS.ui.markHoldReturn : BEATS.ui.markHold });
    intro = h;
    void h.done.then(() => { introDone = true; });
  }, () => { introDone = true; });

  // --- the opening set: what the next 36 seconds need, measured (the letter lights by it)
  let progress = 0;
  let setIn = false;
  let readyAt = Infinity;
  let sweepAt = -1;
  let lastSet = 0;
  const measure = (now: number): void => {
    if (now - lastSet < 150) return;
    lastSet = now;
    const s = world?.openingSet?.() ?? null;
    const parts: [number, number][] = [
      [0.15, worldBooted ? 1 : 0],
      [0.5, s ? s.plates : 0],
      [0.1, s?.close ? 1 : 0],
      [0.05, s?.font ? 1 : 0],
      [0.05, s?.ofuda ? 1 : 0],
      [0.15, trackIn ? 1 : 0],
    ];
    const p = parts.reduce((a, [w, v]) => a + w * v, 0);
    progress = Math.max(progress, Math.min(1, p));
    if (!setIn && worldReady && s && s.plates >= 1 && s.close && s.font && s.ofuda && trackIn) {
      setIn = true;
      progress = 1;
      sweepAt = now;
    }
  };

  // --- the press ---------------------------------------------------------------------------------------
  let conductor: Conductor | null = null;
  let falling: { from: number; to: number } | null = null;
  let landed = false;
  let gustFrom = -1;
  let played = false;
  let tesuShown = false;

  // (instant: the page's smooth scrolling would restart its glide every frame and the page would never fall)
  const scrollNow = (y: number): void => window.scrollTo({ top: y, behavior: "instant" });

  const press = (via: "continue" | "play"): void => {
    if (conductor) return;
    unlock();
    intro?.skip();
    cont.hidden = true;
    load.hidden = true;
    if (playBox) playBox.hidden = true;
    played = true;
    gustFrom = performance.now();
    const c = new Conductor(audio, track, { doc: document, reduced: reduced.matches, repeat });
    conductor = c;
    // (tools and checks read the running opening here)
    (window as Window & { __dexOpening?: Conductor }).__dexOpening = c;
    c.start();
    world?.play?.(c);
    root.classList.add("op-run", "op-cine");
    if (via === "continue") {
      // the page is carried down through its sky; the wheel and swipes wait
      falling = { from: window.scrollY, to: anchor.offsetTop };
      root.classList.add("col-cine");
    } else {
      landed = true;
      document.dispatchEvent(new CustomEvent("dex:toworld"));
    }
    c.onFrame = (T) => {
      const land = BEATS.bars[2]!;
      if (falling) {
        if (reduced.matches) {
          // no fall: a 0.3 s cross-fade to the world window at T 0
          c.overlay.black(T < 0.15 ? Math.max(0, T) / 0.15 : Math.max(0, 1 - (T - 0.15) / 0.15));
          if (T >= 0.15) scrollNow(falling.to);
        } else {
          scrollNow(falling.from + (falling.to - falling.from) * fallAt(T));
        }
        if (T >= land || (reduced.matches && T >= 0.3)) {
          scrollNow(falling.to);
          c.overlay.black(0);
          falling = null;
          landed = true;
          root.classList.remove("col-cine");
          document.dispatchEvent(new CustomEvent("dex:toworld"));
        }
      }
      if (T >= BEATS.her.drop1) root.classList.remove("op-cine");
    };
  };

  // --- "continue" and its rules (CHECK-1 item 12)
  const guard = BEATS.ui.guardMs;
  let downAt = -Infinity;
  let downPoke = false;
  /** The letter's rect on screen (css px): the poke zone (the item stage joins it when the items exist). */
  const pokeRect = { x: 0, y: 0, w: 0, h: 0 };
  const inPoke = (x: number, y: number): boolean => x >= pokeRect.x && x <= pokeRect.x + pokeRect.w && y >= pokeRect.y && y <= pokeRect.y + pokeRect.h;
  const otherControl = (el: Element | null): boolean => !!el && el !== cont && !!el.closest("a, button, input, select, textarea, [role='button']");
  title.addEventListener("pointerdown", (e) => {
    unlock();
    downAt = performance.now();
    downPoke = inPoke(e.clientX, e.clientY);
    if (downPoke && introDone && !conductor) talisman.poke();
  });
  title.addEventListener("click", (e) => {
    if (conductor) return;
    // a click on the letter pokes it, never continues; nor does a press that began before the button (or in its first 300 ms)
    if (pressContinues({ ready: !cont.hidden, readyAt, guardMs: guard, downAt, onStage: downPoke, onOtherControl: otherControl(e.target as Element | null) })) press("continue");
  });
  document.addEventListener("keydown", (e) => {
    unlock();
    if (conductor) return;
    if (!pressContinues({ ready: !cont.hidden, readyAt, guardMs: guard, downAt: performance.now(), onStage: false, onOtherControl: otherControl(document.activeElement), repeat: e.repeat, key: e.key })) return;
    e.preventDefault();
    press("continue");
  });
  playBtn?.addEventListener("click", () => {
    anchor.scrollIntoView({ behavior: "auto" });
    press("play");
  });
  // a scroll skips the mark (the visitor has chosen to fall at their own pace)
  window.addEventListener("scroll", () => { if (!introDone && window.scrollY > 40) intro?.skip(); }, { passive: true });
  // during the cinematic fall the page is carried; the wheel and swipes wait
  const hold = (e: Event): void => { if (falling) e.preventDefault(); };
  window.addEventListener("wheel", hold, { passive: false });
  window.addEventListener("touchmove", hold, { passive: false });

  // --- the status line under the letter
  let statusKey = "";
  const status = (key: string, html: string): void => {
    if (key === statusKey) return;
    statusKey = key;
    load.innerHTML = html;
    const ask = load.querySelector<HTMLButtonElement>("[data-world-ask]");
    ask?.addEventListener("click", () => {
      asked = true;
      root.removeAttribute("data-world-ask");
      document.dispatchEvent(new CustomEvent("dex:loadworld"));
    });
  };

  // --- the address
  const sections = SECTIONS.map(([id, path]) => [document.getElementById(id), path] as const).filter(([el]) => !!el) as [HTMLElement, string][];
  let address = location.pathname;
  // Following a link from here: the homepage's history entry goes back to "/" first, so the
  // navigation is an ordinary new entry (a link to the address on show would otherwise be a
  // replace) and Back returns to the homepage, scrolled where it was.
  const home = (): void => {
    if (location.pathname !== "/") history.replaceState(history.state, "", "/" + location.search);
    address = "/";
  };
  document.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.button !== 0) return;
    const a = (e.target instanceof Element ? e.target : null)?.closest<HTMLAnchorElement>("a[href]");
    if (!a || a.hasAttribute("download") || (a.target && a.target !== "_self")) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin) return;
    // an in-page jump stays on this page (a #fragment of the address on show)
    if (url.pathname === location.pathname && url.search === location.search && url.hash) return;
    home();
  }, true);
  window.addEventListener("pagehide", () => home());
  const route = (vh: number, pWorld: number, worldTop: number): void => {
    const st = history.state as { gallery?: string } | null;
    if (st && typeof st === "object" && "gallery" in st) return; // the gallery's viewer owns the address
    // the opening running: "/" (a reload replays it from the start, from the homepage)
    if (conductor && !conductor.finished) return;
    const mid = window.scrollY + vh / 2;
    let path = "/";
    if (mid >= worldTop && pWorld < 0.5) path = "/tesu/";
    for (const [el, p] of sections) if (el.getBoundingClientRect().top <= vh / 2) path = p;
    if (path !== address) {
      address = path;
      history.replaceState(history.state, "", path);
    }
  };

  // --- the frame loop: the loader, where the talisman is and what it is doing
  let last = performance.now();
  const pos = { x: innerWidth / 2, y: innerHeight * 0.5, seen: 0 };
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
    const p = (now - t0) / 1000;
    // the website covering the world: before the hand-back the world and the music pause together; after
    // it Track 1 fades down with the world's sound
    if (conductor && landed) conductor.setCovered(pWorld >= 0.999);

    // the loader
    if (!conductor) {
      measure(now);
      if (failed) {
        status(failed, failed === "webgl"
          ? `the world needs a newer browser · <a href="#site">visit the site ↓</a>`
          : `the world couldn't load · <a href="#site">you can still use the site ↓</a>`);
      } else if (!asked) {
        status("ask", `the world is big (about ${WORLD_MB} MB) · <button type="button" class="col-ask" data-world-ask>load it</button>`);
      } else if (!setIn && p >= BEATS.ui.slowAt) {
        status("slow", `still loading the world · <a href="#site">you can visit the site meanwhile ↓</a>`);
      } else if (!setIn) {
        status("loading", "loading the world");
      }
      const showCont = setIn && !failed && introDone && sy < vh * 0.5;
      if (showCont && cont.hidden) {
        cont.hidden = false;
        readyAt = now;
      } else if (!showCont && !cont.hidden) {
        cont.hidden = true;
        readyAt = Infinity;
      }
      load.hidden = !cont.hidden || !introDone;
      if (playBox) playBox.hidden = !setIn || !!failed || !world?.holding?.();
    }
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
    let tx = vw / 2, ty = vh * 0.46, show = true, flutter = 0.6, wind = 0.2;
    let flip = 1;
    const fallFrom = vh * 0.3, landAt = worldTop - vh * 0.1;
    if (gustFrom >= 0) {
      // the press: a gust snatches it up, it flips twice and flies out of the top (0.9 s); then it is the world's
      const u = (now - gustFrom) / 900;
      if (u < 1) {
        tx = vw / 2 + vw * 0.06 * u;
        ty = vh * 0.46 - (vh * 0.46 + TALISMAN_H * kc) * u * u * 1.15;
        flip = reduced.matches ? 1 : Math.cos(u * Math.PI * 4);
        flutter = 1;
        wind = 1.2;
        pos.x = tx;
        pos.y = ty;
      } else if (played && pWorld > 0.12 && conductor?.finished) {
        tx = vw - pageMargin; ty = vh * 0.3; flutter = 0.8; wind = -0.4;
      } else show = false;
    } else if (pWorld > 0.12) {
      tx = vw - pageMargin; ty = vh * 0.3; flutter = 0.8; wind = -0.4;
    } else if (sy < fallFrom) {
      // on the title: the waiting room's letter, hanging, once the mark has gone
      show = introDone;
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
      const r = (playBox && !playBox.hidden ? playBox : playBtn)?.getBoundingClientRect();
      const lx = r && r.width ? r.left - TALISMAN_W * kc * 0.8 : vw * 0.4;
      const ly = r && r.height ? r.top + r.height / 2 - TALISMAN_H * kc * 0.15 : vh * 0.6;
      const fx = vw * (0.5 + 0.16 * Math.sin(sy / 520 + now / 2600)), fy = vh * 0.4;
      tx = fx + (lx - fx) * f;
      ty = fy + (ly - fy) * f;
      flutter = 1 - 0.75 * f;
      wind = 0.3 * (1 - f);
    }
    // it eases where it is going (it is paper on the wind, not a cursor)
    const ease = reduced.matches || (gustFrom >= 0 && now - gustFrom < 900) ? 1 : 1 - Math.pow(0.002, dt);
    pos.x += (tx - pos.x) * ease;
    pos.y += (ty - pos.y) * ease;
    pos.seen += ((show ? 1 : 0) - pos.seen) * (reduced.matches ? 1 : 1 - Math.pow(0.01, dt));
    if (gustFrom >= 0 && !show) pos.seen = 0;
    talisman.step(dt, wind, flutter, reduced.matches);
    ctx2d.clearRect(0, 0, cv.width, cv.height);
    // its rect on screen: the poke zone on the title
    pokeRect.x = pos.x - (TALISMAN_W * kc) / 2 - 8;
    pokeRect.y = pos.y - (TALISMAN_H * kc) / 2 - 8;
    pokeRect.w = TALISMAN_W * kc + 16;
    pokeRect.h = pos.seen > 0.5 ? TALISMAN_H * kc + 16 : 0;
    if (pos.seen > 0.02) {
      ctx2d.globalAlpha = Math.min(1, pos.seen * 1.2) * (failed ? 0.45 : 1);
      const lit = gustFrom >= 0 || played ? 1 : progress;
      const sweep = sweepAt >= 0 && now - sweepAt < 700 ? (now - sweepAt) / 700 : undefined;
      talisman.draw(ctx2d, pos.x * dpr, (pos.y - (TALISMAN_H * kc) / 2) * dpr, k, lit, { sweep, flip });
      if (gustFrom >= 0 && now - gustFrom < 900 && !reduced.matches) {
        // the gust's wind streaks
        ctx2d.fillStyle = "rgba(246, 238, 233, 0.7)";
        for (let i = 0; i < 4; i++) {
          const sx = (pos.x + (i - 1.5) * TALISMAN_W * kc * 0.7) * dpr;
          const sy2 = (pos.y + ((now - gustFrom) * 0.9 + i * 60) % (vh * 0.6) - vh * 0.1) * dpr;
          ctx2d.fillRect(Math.round(sx / k) * k, Math.round(sy2 / k) * k, k, k * (6 + i * 3));
        }
      }
      ctx2d.globalAlpha = 1;
    }
    // on the page it is a button back up to the world
    const onPage = show && pWorld > 0.12 && (!conductor || conductor.finished);
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

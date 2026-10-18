// /tesu/ : Tesu, the continuous world (GDK v6). Boots the renderer, Zhusha and the world,
// then runs the loop. The page column (title, fall, website below) wraps this later; this
// page is the world on its own, full window.
//
// URL options: ?at=<spawn id> (start somewhere), ?x=<H> (start at x in H), ?debug, ?manual
// (no real-time loop: drive it from window.__tesu), ?sync (paint plates on the main thread).
// In the page column (src/tesu/mount.ts) it runs framed: ?embed=site, plus ?hold on "/" (the
// world window waits for PLAY or "continue", which the page calls through window.__tesu.play(link) with its
// opening conductor). On its own and fresh, /tesu/ offers "continue" itself once the opening set is in, and
// the press runs the same opening (opening/conductor.ts) here. ?skip: no opening.

import { Input, type Action, type KeyMap } from "../lab/engine/input.ts";
import { ContractError } from "../lab/contracts.ts";
import { WorldRenderer } from "../world/render/renderer.ts";
import { H } from "./config.ts";
import { TesuGame } from "./game.ts";
import { loadZhusha } from "./player.ts";
import { Touch } from "./touch.ts";
import { planeXf } from "./render/view.ts";
import { Panels, type PanelSpec } from "./panels/panels.ts";
import { craneDesk, docsShelf, galleryFrame, hankoDesk, noticeWall, offeringBox, patronsScroll, saySpec } from "./panels/services.ts";
import { celebrationNote, prizeBoard, startDownload } from "./panels/court.ts";
import { prizeFor } from "./court.ts";
import { readSlipInto, slipFor } from "./save.ts";
import type { Usable } from "./world/types.ts";
import { Conductor, makeAudio, readOpeningNote, type OpeningLink } from "./opening/conductor.ts";
import { Track1 } from "./opening/track.ts";
import { startPlateWorkers } from "./plates/store.ts";
import bake from "virtual:tesu-bake";
import { adoptWorld } from "./world/current.ts";
import { SpriteRenderer } from "./render/sprites.ts";

/**
 * The fixed keys (GDK 5.4, Appendix B): WASD and the arrows both move from the start;
 * J, Z or click attack; K or X dash; Q, E, R her kit; F (or Enter) uses things. Nothing on
 * Shift, so chained dashes never raise Windows' Sticky Keys prompt.
 */
const KEYS: KeyMap = {
  KeyA: ["left"],
  ArrowLeft: ["left"],
  KeyD: ["right"],
  ArrowRight: ["right"],
  KeyW: ["up", "jump"],
  ArrowUp: ["up", "jump"],
  Space: ["jump"],
  KeyS: ["down"],
  ArrowDown: ["down"],
  KeyJ: ["m1"],
  KeyZ: ["m1"],
  KeyK: ["m2"],
  KeyX: ["m2"],
  KeyQ: ["skill"],
  KeyE: ["e"],
  KeyR: ["ult"],
};

const canvas = document.getElementById("view") as HTMLCanvasElement;
const debugEl = document.getElementById("debug") as HTMLPreElement;
const failEl = document.getElementById("fail") as HTMLParagraphElement;

function watchSize(r: WorldRenderer): void {
  const apply = (w: number, h: number): void => {
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    r.layout();
  };
  const fallback = (): void => {
    const dpr = window.devicePixelRatio || 1;
    apply(Math.round(canvas.clientWidth * dpr), Math.round(canvas.clientHeight * dpr));
  };
  fallback();
  try {
    const ro = new ResizeObserver((entries) => {
      const box = entries[0]?.devicePixelContentBoxSize?.[0];
      const dpr = window.devicePixelRatio || 1;
      if (box && Math.abs(box.inlineSize - canvas.clientWidth * dpr) < 2.5) apply(box.inlineSize, box.blockSize);
      else fallback();
    });
    ro.observe(canvas, { box: "device-pixel-content-box" });
  } catch {
    new ResizeObserver(fallback).observe(canvas);
  }
  window.addEventListener("resize", fallback);
}

/**
 * (engine 10-18, loading) Hands the thread back for a moment (a message, not a timer: not throttled in a frame out of
 * view), so the page's own frames ("dex", the loader) keep drawing between the world's boot steps.
 */
function yieldTask(): Promise<void> {
  return new Promise((resolve) => {
    const c = new MessageChannel();
    c.port1.onmessage = () => resolve();
    c.port2.postMessage(0);
  });
}

async function boot(): Promise<void> {
  // load-time marks (lanes' load test reads them: performance.getEntriesByType("mark"))
  performance.mark("tesu:boot");
  const q = new URLSearchParams(location.search);
  // (engine 10-18) the plate workers first: worker 0 builds the world and hands it over (plates/store.ts), so this
  // thread, which the website's "dex" shares, never builds it; meanwhile the renderer and her drawings get ready here
  const sync = q.has("sync") || q.has("manual");
  // (engine, perf) the build's bake: tiles the opening needs, painted at build time (plates/bake.ts); none in dev
  const pool = sync ? null : startPlateWorkers(undefined, bake.index || bake.world ? { ...bake, check: q.has("bakecheck") } : null);
  await yieldTask();
  const r = new WorldRenderer(canvas);
  r.integerFrames = true;
  watchSize(r);
  performance.mark("tesu:gl");
  await yieldTask();
  const assets = await loadZhusha(r);
  performance.mark("tesu:assets");
  const def = pool ? await pool.world : null;
  if (def) adoptWorld(def);
  else {
    // (engine, perf) no bake and no worker to hand it over (?manual, ?sync, no workers): built here, which also
    // loads the world's painters on this page; otherwise the page never loads them (the workers paint)
    (await import("./world/index.ts")).buildWorld();
  }
  const bounds = pool ? await pool.bounds : null;
  if (bounds) for (const [id, b] of Object.entries(bounds)) SpriteRenderer.bootBounds.set(id, b);
  if (sync || !pool?.workers.length) await SpriteRenderer.loadPainters();
  performance.mark("tesu:world");
  await yieldTask();
  const input = new Input(canvas, KEYS);
  const touch = new Touch(input, document.getElementById("touch") as HTMLElement, canvas);
  const embedded = q.get("embed") === "site" && window.parent !== window;
  const game = new TesuGame(r, input, assets, {
    start: q.get("at") ?? "catch", link: q.has("at") || q.has("x") || q.has("hold"), noOpening: q.has("skip"),
    hold: q.has("hold"), manual: q.has("manual"), sync, pool,
    // the homepage's world window: between the page's bars while it waits, the whole window from the press
    landed: embedded ? () => {
      const host = window.frameElement?.parentElement;
      if (!host || !host.clientWidth || !host.clientHeight) return null;
      const dpr = window.devicePixelRatio || 1;
      const [w, h] = r.frameFor(Math.round(host.clientWidth * dpr), Math.round(host.clientHeight * dpr));
      return [w, h];
    } : undefined,
  });
  // the opening's inputs: in the cinematic Esc skips (the chip's key) and any other input shows the chip;
  // the page's conductor owns both, the world only tells it
  const link = (): OpeningLink | null => (game.opening.state === "cine" ? game.opening.link : null);
  window.addEventListener("keydown", (e) => {
    const l = link();
    if (!l) return;
    if (e.key === "Escape") {
      if (l.skip()) e.preventDefault();
    } else if (!e.repeat) l.input();
  }, { capture: true });
  window.addEventListener("pointerdown", () => link()?.input(), { capture: true });
  // a mouse press on the world gives it the keyboard (the input's own handler cancels the
  // browser's default, which would otherwise do that)
  canvas.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" && document.activeElement !== canvas) canvas.focus({ preventScroll: true });
  }, { capture: true });
  if (embedded) {
    // Page Up and Page Down scroll the page column (to the website and back), as the wheel does
    window.addEventListener("keydown", (e) => {
      if (panels.open || !["PageDown", "PageUp"].includes(e.code)) return;
      e.preventDefault();
      window.parent.scrollBy({ top: (e.code === "PageDown" ? 0.9 : -0.9) * window.parent.innerHeight, behavior: "smooth" });
    });
    // the talisman tab (touch): down to the website
    touch.setTab(() => window.parent.document.getElementById("site")?.scrollIntoView({ behavior: "smooth" }));
  }
  performance.mark("tesu:game");
  if (q.has("x")) game.place(Number(q.get("x")) * H);
  game.debug = q.has("debug");

  // the hall's services open in-world panels; doors are handled by the game itself
  const panels = new Panels(input, canvas);
  const slips = { writeSlip: () => slipFor(game.save), readSlip: (code: string) => {
    const err = readSlipInto(game.save, code);
    if (!err) for (const f of game.save.flags) game.flags.add(f);
    return err;
  } };
  const specFor = (u: Usable): PanelSpec | null => {
    const a = u.action;
    if (a.kind === "say") return saySpec(u.label.replace(/^the /, "The "), a.text);
    if (a.kind !== "panel") return null;
    switch (a.panel) {
      case "notice": return noticeWall;
      case "docs": return docsShelf;
      case "donate": return offeringBox;
      case "hanko": return hankoDesk(slips);
      case "crane": return craneDesk;
      case "patrons": return patronsScroll;
      case "art": return galleryFrame(a.arg ?? "");
      case "board": return prizeBoard((p) => game.court.summon(p));
      default: return null;
    }
  };
  game.onUse = (u) => {
    const spec = specFor(u);
    if (spec) panels.show(spec);
  };
  game.onCelebrate = (p) => panels.show(celebrationNote(p));
  // The killing blow (GDK 5.1): the next attack press on a staggered champion. The download
  // starts here, inside the input event itself (browsers only allow it from the user's own
  // input), from the release data's URL; the hit plays after it.
  let lastDownload: string | null = null;
  const finish = (): void => {
    if (panels.open) return;
    const prize = game.court.finishPress();
    if (!prize) return;
    lastDownload = prize.file.href;
    startDownload(prize.file.href);
  };
  const FINISH_KEYS = new Set(["KeyJ", "KeyZ", "KeyQ", "KeyE"]);
  window.addEventListener("keydown", (e) => {
    if (panels.open || e.repeat) return;
    if (FINISH_KEYS.has(e.code)) finish();
    if (e.code === "KeyF" || e.code === "Enter" || e.code === "NumpadEnter") {
      e.preventDefault();
      game.use();
    }
  });
  canvas.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" && e.button === 0) finish();
  });
  // on touch, a tap counts as user input when the finger lifts: the attack (or Q) button's release
  touch.onRelease = (a) => {
    if (a === "m1" || a === "skill") finish();
  };
  touch.onTap = (cx, cy) => {
    if (panels.open) return false;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const pr = r.presenter.rect;
    const fx = ((cx - rect.left) * dpr - pr.x) / pr.scale, fy = ((cy - rect.top) * dpr - pr.y) / pr.scale;
    const u = game.usableAt(fx, fy);
    if (u) game.use(u);
    return !!u;
  };
  input.onToggle = (w) => {
    if (w === "debug") game.debug = !game.debug;
  };
  canvas.focus();

  let n = 0;
  let lastFrame = 0;
  const loop = (now: number): void => {
    try {
      lastFrame = performance.now();
      game.frame(now);
      if (touch.shown) touch.cooldowns(game.player.skillCd <= 0, game.player.ultCd <= 0 && !game.court.ultLocked);
      if (game.debug) {
        if (n++ % 6 === 0) debugEl.textContent = game.debugText();
        debugEl.hidden = false;
      } else if (!debugEl.hidden) debugEl.hidden = true;
    } catch (e) {
      showFailure(e, "The world stopped");
      return;
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  // A browser stops animation frames in a frame that is out of view (the world window below
  // the title on "/"): while the world is still loading, a timer keeps its plates streaming so
  // it is ready when it scrolls into view.
  const keepLoading = window.setInterval(() => {
    if (!game.loading && !game.warming) { clearInterval(keepLoading); return; }
    const now = performance.now();
    if (now - lastFrame > 120) {
      lastFrame = now;
      try { game.frame(now); } catch (e) { clearInterval(keepLoading); showFailure(e, "The world stopped"); }
    }
  }, 60);

  let titleIn = false, ofudaIn = false;
  void game.titles.ready.then((ok) => { titleIn = ok; });
  void game.ofuda.ready.then((ok) => { ofudaIn = ok; });
  if (game.awaitingPress && !embedded && !q.has("manual")) standalonePress(game, () => titleIn && ofudaIn);

  const src = "auto";
  Object.assign(window, {
    __tesu: {
      game,
      state: () => game.state(),
      press: (a: Action) => input.down(a, src),
      release: (a: Action) => input.up(a, src),
      /** Puts her at x (in H) on the ground there. */
      place: (xH: number, yH?: number) => game.place(xH * H, yH === undefined ? undefined : yH * H),
      spawn: (id: string) => {
        const s = game.world.spawns.find((o) => o.id === id);
        if (s) game.spawnAt(s);
        return !!s;
      },
      advance: (ticks: number) => {
        for (let i = 0; i < ticks; i++) game.realTick();
        game.render();
        return game.state();
      },
      render: () => game.render(),
      flag: (f: string, on = true) => (on ? game.flags.add(f) : game.flags.delete(f)),
      use: () => game.use(),
      /** The press (PLAY or "continue"): the opening starts on the link's clock (the page's conductor); no link: silent, on the world's own time (tools). */
      play: (l?: OpeningLink) => game.play(l),
      audio: (ctx: AudioContext) => game.sound.start(ctx),
      /** The opening set (what the next 36 s need), for the page's loader: plates along the camera's path, her 192 px drawing, the title face, the talisman. */
      openingSet: () => ({ plates: game.warmProgress(), close: game.closeReady, font: titleIn, ofuda: ofudaIn, warming: game.warming }),
      /** The bout: summon a prize's champion, press the finish (as an attack press would). */
      summon: (id: string) => {
        const p = prizeFor(id);
        if (p) game.court.summon(p);
        return !!p;
      },
      finish: () => finish(),
      lastDownload: () => lastDownload,
      panels,
      /** Where a world point (px) is on the page (css px in this frame), for checks. */
      screenOf: (x: number, y: number) => {
        const xf = planeXf(game.camera.state(), 1);
        const pr = r.presenter.rect, dpr = window.devicePixelRatio || 1;
        return [(pr.x + (x * xf.s + xf.offX) * pr.scale) / dpr, (pr.y + (y * xf.s + xf.offY) * pr.scale) / dpr];
      },
      /** Forces a framing ({zoom, anchor, horizon, lead}); null follows the world's tracks again. */
      frame: (f: Record<string, number> | null) => {
        game.framingOverride = f;
      },
    },
  });
}

/**
 * /tesu/ on its own, fresh: Track 1's first piece decodes on a context made now (suspended: nothing sounds
 * before the press), and "continue" appears once the opening set is in; the press starts the opening here.
 */
function standalonePress(game: TesuGame, parts: () => boolean): void {
  const ctx = makeAudio();
  const track = ctx ? new Track1(ctx, ctx.destination) : null;
  let trackIn = !track;
  void track?.aReady.then(() => { trackIn = true; });
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "press";
  btn.textContent = "continue";
  btn.hidden = true;
  document.getElementById("stage")?.append(btn);
  let shownAt = Infinity;
  const go = (): void => {
    if (!game.awaitingPress || performance.now() - shownAt < 300) return;
    btn.remove();
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const c = new Conductor(ctx, track, { doc: document, reduced, repeat: readOpeningNote().seen > 0 });
    c.start();
    game.play(c);
    (document.getElementById("view") as HTMLCanvasElement | null)?.focus();
  };
  btn.addEventListener("click", go);
  window.addEventListener("keydown", (e) => {
    if (!btn.hidden && !e.repeat && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); go(); }
  });
  const wait = window.setInterval(() => {
    if (!game.awaitingPress) { clearInterval(wait); return; }
    const set = game.warmProgress() >= 1 && game.closeReady && parts() && trackIn;
    if (set && btn.hidden) {
      btn.hidden = false;
      shownAt = performance.now();
      clearInterval(wait);
    }
  }, 150);
}

function showFailure(e: unknown, lead: string): void {
  console.error(e);
  failEl.hidden = false;
  if (e instanceof Error && /WebGL2/.test(e.message)) {
    failEl.textContent = "This page needs WebGL2.";
    return;
  }
  const first = (m: string): string => m.split("\n")[0] ?? "";
  const detail = e instanceof ContractError ? `${first(e.message)} ${e.issues[0] ?? ""}` : e instanceof Error ? first(e.message) : "";
  failEl.textContent = detail ? `${lead}: ${detail}` : `${lead}.`;
}

boot().catch((e: unknown) => showFailure(e, "The world failed to start"));

// /tesu/ : Tesu, the continuous world (GDK v6). Boots the renderer, Zhusha and the world,
// then runs the loop. The page column (title, fall, website below) wraps this later; this
// page is the world on its own, full window.
//
// URL options: ?at=<spawn id> (start somewhere), ?x=<H> (start at x in H), ?debug, ?manual
// (no real-time loop: drive it from window.__tesu), ?sync (paint plates on the main thread).
// In the page column (src/tesu/mount.ts) it runs framed: ?embed=site, plus ?hold on "/" (the
// world window waits for PLAY, which the page calls through window.__tesu.play()).

import "@fontsource/dotgothic16/400.css";
import { Input, type Action, type KeyMap } from "../lab/engine/input.ts";
import { ContractError } from "../lab/contracts.ts";
import { WorldRenderer } from "../world/render/renderer.ts";
import { H } from "./config.ts";
import { TesuGame } from "./game.ts";
import { loadZhusha } from "./player.ts";
import { Touch } from "./touch.ts";
import { Panels, type PanelSpec } from "./panels/panels.ts";
import { craneDesk, docsShelf, galleryFrame, hankoDesk, noticeWall, offeringBox, patronsScroll, saySpec } from "./panels/services.ts";
import { celebrationNote, prizeBoard, startDownload } from "./panels/court.ts";
import { prizeFor } from "./court.ts";
import { readSlipInto, slipFor } from "./save.ts";
import type { Usable } from "./world/types.ts";

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

async function boot(): Promise<void> {
  const q = new URLSearchParams(location.search);
  const r = new WorldRenderer(canvas);
  r.integerFrames = true;
  watchSize(r);
  const assets = await loadZhusha(r);
  const input = new Input(canvas, KEYS);
  const touch = new Touch(input, document.getElementById("touch") as HTMLElement, canvas);
  const embedded = q.get("embed") === "site" && window.parent !== window;
  const game = new TesuGame(r, input, assets, {
    start: q.get("at") ?? "catch", link: q.has("at") || q.has("x") || q.has("hold"), noOpening: q.has("skip"),
    hold: q.has("hold"), manual: q.has("manual"), sync: q.has("sync") || q.has("manual"),
  });
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
  const loop = (now: number): void => {
    try {
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
      /** The page column: PLAY (the opening starts at 0:00), and the page's running audio. */
      play: () => game.play(),
      audio: (ctx: AudioContext) => game.sound.start(ctx),
      /** The bout: summon a prize's champion, press the finish (as an attack press would). */
      summon: (id: string) => {
        const p = prizeFor(id);
        if (p) game.court.summon(p);
        return !!p;
      },
      finish: () => finish(),
      lastDownload: () => lastDownload,
      panels,
      /** Forces a framing ({zoom, anchor, horizon, lead}); null follows the world's tracks again. */
      frame: (f: Record<string, number> | null) => {
        game.framingOverride = f;
      },
    },
  });
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

// /tesu/ : Tesu, the continuous world (GDK v6). Boots the renderer, Zhusha and the world,
// then runs the loop. The page column (title, fall, website below) wraps this later; this
// page is the world on its own, full window.
//
// URL options: ?at=<spawn id> (start somewhere), ?x=<H> (start at x in H), ?debug, ?manual
// (no real-time loop: drive it from window.__tesu), ?sync (paint plates on the main thread).

import { Input, type Action, type KeyMap } from "../lab/engine/input.ts";
import { ContractError } from "../lab/contracts.ts";
import { WorldRenderer } from "../world/render/renderer.ts";
import { H } from "./config.ts";
import { TesuGame } from "./game.ts";
import { loadZhusha } from "./player.ts";

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
  watchSize(r);
  const assets = await loadZhusha(r);
  const input = new Input(canvas, KEYS);
  const game = new TesuGame(r, input, assets, { start: q.get("at") ?? "catch", manual: q.has("manual"), sync: q.has("sync") || q.has("manual") });
  if (q.has("x")) game.place(Number(q.get("x")) * H);
  game.debug = q.has("debug");
  input.onToggle = (w) => {
    if (w === "debug") game.debug = !game.debug;
  };
  canvas.focus();

  let n = 0;
  const loop = (now: number): void => {
    try {
      game.frame(now);
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

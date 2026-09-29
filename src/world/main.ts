// /world/ : the unified world runtime and its 3-room test world
// (arrival -> the plain, mist to storm -> indoors). Dev-only page; see
// docs/world/RUNTIME.md.
//
// URL options: ?room=<id>&spawn=<id> start somewhere else; ?debug overlay;
// ?manual no real-time loop (drive it from window.__world); ?mute; ?fresh
// forget the save first; ?go skip the Enter gate (automation).

import { Input, type Action } from "../lab/engine/input.ts";
import { ContractError } from "../lab/contracts.ts";
import { setPropEngine } from "./props-api.ts";
import { StubEngine, type StubTexture } from "./props/stub.ts";
import { registerStubRecipes } from "./props/recipes.ts";
import { loadPlayer } from "./player/setup.ts";
import { WorldRenderer } from "./render/renderer.ts";
import { WorldGame } from "./game.ts";
import { Touch } from "./touch.ts";
import { arrival } from "./rooms/arrival.ts";
import { plain } from "./rooms/plain.ts";
import { house } from "./rooms/house.ts";
import { Save } from "./save.ts";

const canvas = document.getElementById("view") as HTMLCanvasElement;
const debugEl = document.getElementById("debug") as HTMLPreElement;
const touchEl = document.getElementById("touch") as HTMLDivElement;
const failEl = document.getElementById("fail") as HTMLParagraphElement;
const enterEl = document.getElementById("enter") as HTMLElement;
const soundEl = document.getElementById("sound") as HTMLButtonElement;

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
  if (q.has("fresh")) new Save().clear();
  const r = new WorldRenderer(canvas);
  watchSize(r);
  const engine = new StubEngine((t) => {
    const tex: StubTexture = {
      w: t.w,
      h: t.h,
      handle: { albedo: r.texture({ w: t.w, h: t.h, data: t.albedo }), normal: r.texture({ w: t.w, h: t.h, data: t.normal }), keyInfluence: 0.6 },
    };
    return tex;
  });
  registerStubRecipes(engine);
  setPropEngine(engine);
  const assets = await loadPlayer(r);
  const input = new Input(canvas);
  const touch = new Touch(input, touchEl);
  const rooms = [arrival, plain, house];
  const room = q.get("room");
  const start = room && rooms.some((d) => d.id === room) ? { room, spawn: q.get("spawn") ?? "" } : { room: "arrival", spawn: "start" };
  const game = new WorldGame(r, input, touch, assets, { rooms, start, engine });
  if (q.has("debug")) game.debug = true;
  game.manual = q.has("manual");
  if (q.has("mute")) game.save.data.sound = false;
  touch.onUse = () => game.use();

  const setSoundUi = (): void => {
    const on = game.save.data.sound;
    soundEl.setAttribute("aria-pressed", String(on));
    soundEl.setAttribute("aria-label", on ? "sound on" : "sound off");
    soundEl.dataset.on = String(on);
  };
  setSoundUi();
  soundEl.addEventListener("click", () => {
    game.setSound(!game.save.data.sound);
    setSoundUi();
    soundEl.blur();
    canvas.focus();
  });

  const begin = (): void => {
    if (game.mode !== "intro" || game.loading) return;
    game.begin();
    enterEl.hidden = true;
    canvas.focus();
  };
  // Enter (or a tap / click on the world) gives control and starts the sound state
  window.addEventListener("keydown", (e) => {
    if (game.panels.open) return;
    if (e.code === "Enter" || e.code === "NumpadEnter") {
      if (game.mode === "intro") {
        e.preventDefault();
        begin();
      } else game.use();
    } else if (e.code === "KeyE" && !e.repeat) {
      e.preventDefault();
      if (game.mode === "intro") begin();
      else game.use();
    } else if (e.code === "KeyM" && !e.repeat) {
      game.setSound(!game.save.data.sound);
      setSoundUi();
    }
  });
  canvas.addEventListener("pointerdown", () => begin());
  // the quiet "enter" shows once the world is actually there (and a moment of scenery first)
  const wait = window.setInterval(() => {
    if (game.loading) return;
    window.clearInterval(wait);
    if (q.has("go")) begin();
    else window.setTimeout(() => enterEl.classList.add("shown"), 1400);
  }, 100);

  // scrolling down closes the world like a curtain and hands over to the website below
  const onScroll = (): void => {
    const p = Math.min(1, Math.max(0, window.scrollY / Math.max(1, window.innerHeight * 0.8)));
    game.camera.extraBars = p * 0.5;
  };
  window.addEventListener("scroll", onScroll, { passive: true });

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
    __world: {
      game,
      state: () => game.state(),
      press: (a: Action) => input.down(a, src),
      release: (a: Action) => input.up(a, src),
      begin,
      use: () => game.use(),
      teleport: (room: string, spawn: string) => game.teleport(room, spawn),
      closeup: (on: boolean) => game.camera.setCloseup(on),
      /** Put the player at room x (y = the ground there) and settle camera and weather at once. */
      place: (x: number, y?: number) => game.place(x, y),
      advance: (ticks: number) => {
        for (let i = 0; i < ticks; i++) game.realTick();
        game.render();
        return game.state();
      },
      render: () => game.render(),
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

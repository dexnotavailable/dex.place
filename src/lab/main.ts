// /lab/ : first production scene for the player character. Blank map, the
// character, a sentinel turret and a few ledges. Loads pipeline exports from
// public/lab/character and public/lab/turret when present, else bakes the
// procedural stand-ins. ?sheet shows every stand-in pose; ?debug starts with
// the overlay; ?far starts at 960x540; ?manual freezes time for automation.

import clipsRaw from "./data/player.clips.json?raw";
import lightingRaw from "./data/lighting.json?raw";
import mapRaw from "./data/map.json?raw";
import tuningRaw from "./data/tuning.json?raw";
import vfxRaw from "./data/vfx.json?raw";
import { bakeStandin, type ClipSource } from "./art/standin-bake.ts";
import { ContractError } from "./contracts.ts";
import { bakeTurret } from "./art/standin-turret.ts";
import { Input, type Action } from "./engine/input.ts";
import { Renderer } from "./engine/renderer.ts";
import { Sfx } from "./engine/sfx.ts";
import { validateVfxLibrary, Vfx } from "./engine/vfx.ts";
import { fromBaked, loadExported, type RuntimeSprite } from "./game/assets.ts";
import { Game, type SceneLighting, type Tuning } from "./game/game.ts";
import { Touch } from "./game/touch.ts";
import type { MapData } from "./game/world.ts";
import { runSheet } from "./sheet.ts";

const canvas = document.getElementById("view") as HTMLCanvasElement;
const debugEl = document.getElementById("debug") as HTMLPreElement;
const touchEl = document.getElementById("touch") as HTMLDivElement;
const failEl = document.getElementById("fail") as HTMLParagraphElement;

function watchSize(r: Renderer): void {
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
      // exact device pixels when the browser reports them consistently, else CSS size x DPR
      if (box && Math.abs(box.inlineSize - canvas.clientWidth * dpr) < 2.5) apply(box.inlineSize, box.blockSize);
      else fallback();
    });
    ro.observe(canvas, { box: "device-pixel-content-box" });
  } catch {
    const ro = new ResizeObserver(fallback);
    ro.observe(canvas);
  }
  window.addEventListener("resize", fallback);
}

function checkVfxIds(sprite: RuntimeSprite, vfx: Vfx): void {
  const missing = new Set<string>();
  for (const c of sprite.pkg.clips) {
    for (const f of c.frames) {
      for (const e of f.events ?? []) if (e.type === "vfx" && !vfx.has(e.id)) missing.add(e.id);
      for (const h of f.hitboxes ?? []) if (h.hitVfx && !vfx.has(h.hitVfx)) missing.add(h.hitVfx);
    }
  }
  if (missing.size) console.warn(`${sprite.name}: vfx ids not in vfx.json: ${[...missing].join(", ")}`);
}

async function boot(): Promise<void> {
  const r = new Renderer(canvas);
  watchSize(r);
  const q = new URLSearchParams(location.search);
  const lighting = JSON.parse(lightingRaw) as SceneLighting;
  if (q.has("sheet")) {
    (document.getElementById("res") as HTMLButtonElement).hidden = true;
    runSheet(r, lighting, q.get("sheet") || null);
    return;
  }
  const tuning = JSON.parse(tuningRaw) as Tuning;
  const map = JSON.parse(mapRaw) as MapData;
  const vfx = new Vfx(validateVfxLibrary(JSON.parse(vfxRaw)));
  const input = new Input(canvas);
  const sfx = new Sfx();
  const touch = new Touch(input, touchEl);

  let player = await loadExported(r, "character");
  if (!player) {
    const baked = bakeStandin(JSON.parse(clipsRaw) as ClipSource);
    if (baked.warnings.length) console.info(`stand-in pose notes:\n${baked.warnings.join("\n")}`);
    player = fromBaked(r, baked.pkg, baked.atlas);
  }
  let turret = await loadExported(r, "turret");
  if (!turret) {
    const t = bakeTurret();
    turret = fromBaked(r, t.pkg, t.atlas);
  }
  checkVfxIds(player, vfx);
  checkVfxIds(turret, vfx);

  const game = new Game(r, input, vfx, sfx, touch, tuning, lighting, map, player, turret);
  const resBtn = document.getElementById("res") as HTMLButtonElement;
  game.onRes = (mode) => {
    resBtn.textContent = mode;
  };
  resBtn.addEventListener("click", () => {
    game.toggleRes();
    resBtn.blur();
  });
  if (q.has("far")) game.toggleRes();
  if (q.has("debug")) game.debug = true;
  game.manual = q.has("manual");
  if (q.has("mute")) sfx.muted = true;

  let n = 0;
  const loop = (now: number): void => {
    try {
      game.frame(now);
      if (game.debug) {
        if (n++ % 6 === 0) debugEl.textContent = game.debugText();
        debugEl.hidden = false;
      } else if (!debugEl.hidden) debugEl.hidden = true;
    } catch (e) {
      // never a silent black screen: stop the loop and say why
      showFailure(e, "The lab stopped");
      return;
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  // automation hooks (no UI): state reads, and manual stepping with ?manual
  const src = "auto";
  Object.assign(window, {
    __lab: {
      game,
      state: () => game.state(),
      press: (a: Action) => input.down(a, src),
      release: (a: Action) => input.up(a, src),
      advance: (ticks: number) => {
        for (let i = 0; i < ticks; i++) game.realTick();
        game.render();
        return game.state();
      },
    },
  });
}

/** Short failure line on the page (the console keeps the full error). */
function showFailure(e: unknown, lead: string): void {
  console.error(e);
  failEl.hidden = false;
  if (e instanceof Error && /WebGL2/.test(e.message)) {
    failEl.textContent = "This page needs WebGL2.";
    return;
  }
  // contract problems name the file and the first JSON path, which is what the pipeline needs
  const firstLine = (m: string): string => m.split("\n")[0] ?? "";
  const detail = e instanceof ContractError ? `${firstLine(e.message)} ${e.issues[0] ?? ""}` : e instanceof Error ? firstLine(e.message) : "";
  failEl.textContent = detail ? `${lead}: ${detail}` : `${lead}.`;
}

boot().catch((e: unknown) => showFailure(e, "The lab failed to start"));

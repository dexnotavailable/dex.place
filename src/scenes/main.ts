// /scenes/ : vibe prototypes for the world look. Each file in ./scenes/ is one
// scene (default export: SceneDef); they are found by import.meta.glob, so
// adding a scene never touches this file.
//
// Keys: 1-9 scene, Z resolution (world 1280x720 / old near 640x360 / old far
// 960x540), X presentation (auto / integer / sharp), C stand-in, ` fps,
// M reduced motion, arrows / A-D pan (drag also pans), Space toggles the auto
// drift, P pauses time.
// URL: ?scene=<id> ?res=world|near|far (?near, ?far) ?present=auto|integer|sharp
// ?nochar ?reduced ?fps ?cam=0..1 (fixed camera) ?t=<s>
// ?solo=a,b / ?hide=a,b (layer names, for debugging)
// ?manual (no real-time loop; drive it through window.__scenes).

import { Engine } from "./engine/engine.ts";
import { MODES, RESOLUTIONS, type PresentMode } from "./engine/scale.ts";
import type { Mode, SceneDef } from "./engine/types.ts";

const canvas = document.getElementById("view") as HTMLCanvasElement;
const pick = document.getElementById("pick") as HTMLElement;
const fpsEl = document.getElementById("fps") as HTMLPreElement;
const failEl = document.getElementById("fail") as HTMLParagraphElement;

const loaders = import.meta.glob<{ default: SceneDef }>("./scenes/*.ts");
const ids = Object.keys(loaders)
  .map((p) => p.replace(/^.*\/(.+)\.ts$/, "$1"))
  .sort();
const pathOf = (id: string): string => `./scenes/${id}.ts`;

function fail(e: unknown, lead: string): void {
  console.error(e);
  failEl.hidden = false;
  failEl.textContent = `${lead}: ${e instanceof Error ? e.message.split("\n").slice(0, 6).join("\n") : String(e)}`;
}

function watchSize(): void {
  const apply = (): void => {
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(canvas.clientWidth * dpr);
    const h = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  };
  apply();
  new ResizeObserver(apply).observe(canvas);
  window.addEventListener("resize", apply);
}

async function boot(): Promise<void> {
  if (ids.length === 0) throw new Error("no scenes in src/scenes/scenes/");
  const q = new URLSearchParams(location.search);
  watchSize();
  const engine = new Engine(canvas);
  engine.reduced = q.has("reduced") || matchMedia("(prefers-reduced-motion: reduce)").matches;
  engine.showChar = !q.has("nochar");
  const res = q.get("res") ?? (q.has("far") ? "far" : q.has("near") ? "near" : "");
  if (res in RESOLUTIONS) engine.mode = res as Mode;
  const pres = q.get("present") ?? "";
  if (["auto", "integer", "sharp"].includes(pres)) engine.present = pres as PresentMode;
  fpsEl.hidden = !q.has("fps");
  const names = (k: string): string[] => (q.get(k) ?? "").split(",").filter(Boolean);
  engine.solo = new Set(names("solo"));
  engine.hidden = new Set(names("hide"));

  const buttons = ids.map((id, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = `${i + 1} ${id}`;
    b.addEventListener("click", () => {
      void select(id);
      b.blur();
      canvas.focus();
    });
    pick.append(b);
    return b;
  });

  let loading = "";
  async function select(id: string): Promise<void> {
    const loader = loaders[pathOf(id)];
    if (!loader) return;
    loading = id;
    try {
      const mod = await loader();
      if (loading !== id) return;
      engine.setScene(id, mod.default);
      failEl.hidden = true;
      document.title = "dex";
      buttons.forEach((b, i) => b.setAttribute("aria-current", String(ids[i] === id)));
      const u = new URL(location.href);
      u.searchParams.set("scene", id);
      history.replaceState(null, "", u);
    } catch (e) {
      fail(e, `scene ${id} failed`);
    }
  }

  const first = q.get("scene") ?? location.hash.slice(1);
  await select(ids.includes(first) ? first : ids[0]!);
  const cam = q.get("cam");
  if (cam !== null) {
    engine.camera.auto = false;
    engine.camera.x = Math.min(1, Math.max(0, Number(cam))) * engine.camera.span;
  }
  const t0 = Number(q.get("t") ?? 0);
  if (t0 > 0) stepFor(t0, 1 / 30);

  // input: keys and drag
  const held = new Set<string>();
  window.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (/^[1-9]$/.test(k)) {
      const id = ids[Number(k) - 1];
      if (id) void select(id);
    } else if (k === "z") engine.setMode(MODES[(MODES.indexOf(engine.mode) + 1) % MODES.length]!);
    else if (k === "x") {
      const ps: PresentMode[] = ["auto", "integer", "sharp"];
      engine.present = ps[(ps.indexOf(engine.present) + 1) % ps.length]!;
    }
    else if (k === "c") engine.showChar = !engine.showChar;
    else if (k === "`") fpsEl.hidden = !fpsEl.hidden;
    else if (k === "m") engine.reduced = !engine.reduced;
    else if (k === " ") engine.camera.auto = !engine.camera.auto;
    else if (k === "p") engine.paused = !engine.paused;
    else if (["arrowleft", "arrowright", "a", "d"].includes(k)) held.add(k);
    else return;
    e.preventDefault();
  });
  window.addEventListener("keyup", (e) => held.delete(e.key.toLowerCase()));
  window.addEventListener("blur", () => held.clear());
  let dragId = -1;
  let lastX = 0;
  canvas.addEventListener("pointerdown", (e) => {
    dragId = e.pointerId;
    lastX = e.clientX;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (e.pointerId !== dragId) return;
    const dpr = window.devicePixelRatio || 1;
    engine.setInput(0, ((e.clientX - lastX) * dpr) / engine.out.scale);
    lastX = e.clientX;
  });
  const end = (e: PointerEvent): void => {
    if (e.pointerId === dragId) dragId = -1;
  };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);

  const dirNow = (): number => (held.has("arrowright") || held.has("d") ? 1 : 0) - (held.has("arrowleft") || held.has("a") ? 1 : 0);

  function stepFor(seconds: number, dt: number): void {
    for (let t = 0; t < seconds; t += dt) engine.update(dt);
  }

  // fps readout
  let frames = 0;
  let acc = 0;
  let cpu = 0;
  let fps = 0;
  let last = performance.now();
  const manual = q.has("manual");
  const loop = (now: number): void => {
    const dt = (now - last) / 1000;
    last = now;
    try {
      const c0 = performance.now();
      engine.setInput(dirNow(), 0);
      engine.update(dt);
      engine.render();
      cpu += performance.now() - c0;
    } catch (e) {
      fail(e, "the scene stopped");
      return;
    }
    frames++;
    acc += dt;
    if (acc >= 0.5) {
      fps = frames / acc;
      if (!fpsEl.hidden) {
        const s = engine.stats;
        fpsEl.textContent = [
          `${fps.toFixed(0)} fps  cpu ${(cpu / frames).toFixed(2)} ms`,
          `${engine.sceneId}  ${engine.W}x${engine.H} ${engine.mode}  x${+engine.out.scale.toFixed(3)} ${engine.out.sharp ? `sharp (pre x${engine.out.prescale})` : "integer"}  [${engine.present}]`,
          `layers ${s.layers}  draws ${s.draws}  points ${s.points}  build ${s.buildMs} ms`,
          `cam ${engine.camera.x.toFixed(0)}/${engine.camera.span} ${engine.camera.auto ? "drift" : "fixed"}${engine.reduced ? "  reduced" : ""}${engine.paused ? "  paused" : ""}`,
          "1-9 scene  Z res  X present  C figure  M reduced  space drift  P pause",
        ].join("\n");
      }
      frames = 0;
      acc = 0;
      cpu = 0;
    }
    requestAnimationFrame(loop);
  };
  if (manual) engine.render();
  else requestAnimationFrame(loop);

  // automation hooks (no UI)
  Object.assign(window, {
    __scenes: {
      engine,
      ids,
      select: (id: string) => select(id),
      fps: () => fps,
      /** Advance scene time by n steps of dt and render once. */
      step: (n: number, dt = 1 / 30) => {
        for (let i = 0; i < n; i++) engine.update(dt);
        engine.render();
      },
      setCam: (t: number) => {
        engine.camera.auto = false;
        engine.camera.x = t * engine.camera.span;
        engine.render();
      },
      /** Current low-res frame as a PNG data URL. */
      png: () => {
        engine.render();
        const { w, h, data } = engine.capture();
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        c.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(data), w, h), 0, 0);
        return c.toDataURL("image/png");
      },
    },
  });
}

boot().catch((e: unknown) => fail(e, "scenes failed to start"));

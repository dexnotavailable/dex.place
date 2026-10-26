// /props/ sandbox: the proof props in one room at the locked scale
// (1280x720 world px, H = 80), with the hit tool (slash / heavy / Q / R /
// point / dash wind), state buttons, layer and normal views, slow motion, a
// draggable light and an H toggle (80 exploration / 144 close-up).
//
// URL: ?h=144  ?manual (no RAF loop; drive it from window.__pixel)  ?lab (lab lighting)

import { presetHit, hitBounds, cutPath, type Hit, type HitShape, type HitType } from "../hits.ts";
import { segCross } from "../motion.ts";
import { matById } from "../materials.ts";
import type { Prop } from "../prop.ts";
import { LAYERS, type LayerName } from "../part.ts";
import { PixelRenderer, type Lighting, type ViewMode } from "../render.ts";
import { SCALE } from "../scale.ts";
import { PixelWorld, type WorldEvent } from "../world.ts";
import { bossTerminal, candelabra, donationBox, donorPlaque, floor, font, gauge, mapBanner, stainedGlass, wall } from "../props/index.ts";
import { assemble, disintegrate, dissolve, glint } from "../fx.ts";
import type { CellGrid } from "../cells.ts";

const q = new URLSearchParams(location.search);
const manual = q.has("manual");

type Tool = HitType | "light";
const TOOLS: [Tool, string, string][] = [
  ["slash", "slash", "J / 1"],
  ["heavy", "heavy", "K / 2"],
  ["q", "Q", "Q / 3"],
  ["r", "R", "R / 4"],
  ["point", "point", "5"],
  ["wind", "dash wind", "F / 6"],
  ["light", "move light", "7"],
];

const CHAPEL: Partial<Lighting> = { ambient: [0.17, 0.16, 0.24], keyColour: [0.42, 0.4, 0.39] };

interface Room {
  world: PixelWorld;
  H: number;
  floorY: number;
  fig: Prop;
  byName: Map<string, Prop>;
}

const state = {
  tool: "slash" as Tool,
  view: "lit" as ViewMode,
  layers: Object.fromEntries(LAYERS.map((l) => [l, true])) as Record<LayerName, boolean>,
  particles: true,
  speed: 1,
  paused: false,
  H: Number(q.get("h")) === 144 ? 144 : SCALE.H,
  lab: q.has("lab"),
  face: 1 as 1 | -1,
  cam: { x: 0, y: 0 },
  selected: "",
  sound: false,
  light: { x: 0, y: 0, on: true },
  lastHits: [] as { shape: HitShape; t: number }[],
  events: [] as string[],
  keys: new Set<string>(),
};

// ---------------------------------------------------------------------------
// room
// ---------------------------------------------------------------------------

function buildRoom(H: number, save: PixelWorld["saveData"] = {}): Room {
  const W = 16 * H, Hh = 9 * H;
  const world = new PixelWorld({ H, width: W, height: Hh, seed: 7, heal: { delay: 4.5, rate: 60 } });
  world.saveData = save;
  const floorY = Math.round(7.55 * H);
  const byName = new Map<string, Prop>();
  const add = (name: string, p: Prop): void => {
    byName.set(name, p);
  };
  add("wall", world.add(wall, { width: W, height: floorY / H - 0.05, columns: [0.25, 4.95, 7.65, 11.55, 15.75].map((x) => x / 16), openings: [[6.3 * H, 2.55 * H, 0.82, 4.95]] }, 0, floorY, { id: "wall" }));
  add("floor", world.add(floor, { width: W, depth: (Hh - floorY) / H + 0.2 }, 0, floorY, { id: "floor" }));
  add("window", world.add(stainedGlass, { drop: Math.round(1.0 * H) }, Math.round(6.3 * H), floorY - Math.round(1.0 * H), { id: "window" }));
  add("donation box", world.add(donationBox, { seed: 3 }, Math.round(1.55 * H), floorY, { id: "donation-box" }));
  add("donor plaque", world.add(donorPlaque, { names: [] }, Math.round(2.5 * H), floorY - Math.round(0.95 * H), { id: "donor-plaque" }));
  add("font", world.add(font, { seed: 6 }, Math.round(4.72 * H), floorY, { id: "font" }));
  add("candelabra", world.add(candelabra, { candles: 5, seed: 5 }, Math.round(3.75 * H), floorY, { id: "candelabra" }));
  add("map banner", world.add(mapBanner, { seed: 2 }, Math.round(10.25 * H), floorY - Math.round(3.4 * H), { id: "map-banner" }));
  add("boss terminal", world.add(bossTerminal, { seed: 4 }, Math.round(13.1 * H), floorY, { id: "boss-terminal" }));
  add("candelabra (3)", world.add(candelabra, { candles: 3, height: 1.15, seed: 9 }, Math.round(15.2 * H), floorY, { id: "candelabra-3" }));
  const fig = world.add(gauge, {}, Math.round(8.4 * H), floorY, { id: "gauge" });
  add("H gauge", fig);
  return { world, H, floorY, fig, byName };
}

let room = buildRoom(state.H);
state.light = { x: room.fig.x - room.H * 0.8, y: room.floorY - room.H * 1.3, on: true };
state.selected = "map banner";

// ---------------------------------------------------------------------------
// render
// ---------------------------------------------------------------------------

const canvas = document.getElementById("view") as HTMLCanvasElement;
const overlay = document.getElementById("overlay") as HTMLCanvasElement;
const octx = overlay.getContext("2d")!;
const fail = document.getElementById("fail") as HTMLParagraphElement;
let renderer: PixelRenderer;
try {
  renderer = new PixelRenderer(canvas);
} catch (e) {
  fail.hidden = false;
  fail.textContent = `The sandbox could not start: ${(e as Error).message}`;
  throw e;
}

function updateCamera(): void {
  const { world, H, floorY, fig } = room;
  const vw = renderer.vw, vh = renderer.vh;
  const tx = fig.x - vw / 2;
  state.cam.x = Math.round(Math.max(0, Math.min(world.width - vw, tx)));
  state.cam.y = Math.round(Math.max(0, Math.min(world.height - vh, floorY + H * 1.25 - vh)));
}

function hostLight(): void {
  const w = room.world;
  const H = room.H;
  if (state.light.on) {
    w.hostLights = [{ x: state.light.x, y: state.light.y, height: H * 0.7, radius: H * 3.2, colour: [0.72, 0.86, 1], intensity: 1.1 }];
    w.hostGlows = [{ kind: "disc", x: state.light.x, y: state.light.y, colour: [0.6, 0.78, 1], radius: H * 0.14, intensity: 1.2, flat: 1, x1: 0, y1: 0, width1: 0, thick: 0 }];
  } else {
    w.hostLights = [];
    w.hostGlows = [];
  }
}

function frame(): void {
  renderer.resize();
  updateCamera();
  hostLight();
  renderer.render(room.world, {
    cam: state.cam,
    view: state.view,
    layers: state.layers,
    lighting: state.lab ? {} : CHAPEL,
    particles: state.particles,
    backdrop: { top: [0.02, 0.018, 0.035], mid: [0.05, 0.045, 0.075], low: [0.08, 0.07, 0.1], bands: 6, horizon: renderer.vh },
  });
  renderer.present();
  drawOverlay();
}

function toScreen(x: number, y: number): [number, number] {
  const f = renderer.fit;
  const dpr = window.devicePixelRatio || 1;
  return [(f.x + (x - state.cam.x) * f.scale) / dpr, (f.y + (y - state.cam.y) * f.scale) / dpr];
}

function toWorld(clientX: number, clientY: number): [number, number] {
  const f = renderer.fit;
  const dpr = window.devicePixelRatio || 1;
  return [(clientX * dpr - f.x) / f.scale + state.cam.x, (clientY * dpr - f.y) / f.scale + state.cam.y];
}

function drawOverlay(): void {
  const dpr = window.devicePixelRatio || 1;
  const w = Math.round(overlay.clientWidth * dpr), h = Math.round(overlay.clientHeight * dpr);
  if (overlay.width !== w || overlay.height !== h) {
    overlay.width = w;
    overlay.height = h;
  }
  octx.setTransform(dpr, 0, 0, dpr, 0, 0);
  octx.clearRect(0, 0, overlay.width, overlay.height);
  const s = renderer.fit.scale / dpr;
  const now = performance.now();
  state.lastHits = state.lastHits.filter((hh) => now - hh.t < 450);
  for (const hh of state.lastHits) {
    const a = 1 - (now - hh.t) / 450;
    octx.strokeStyle = `rgba(255, 214, 120, ${0.8 * a})`;
    octx.lineWidth = 1;
    octx.beginPath();
    const sh = hh.shape;
    if (sh.kind === "arc") {
      const [cx, cy] = toScreen(sh.x, sh.y);
      const rin = 1 - sh.thick / Math.max(1, (sh.rx + sh.ry) / 2);
      octx.ellipse(cx, cy, sh.rx * s, sh.ry * s, 0, sh.a0, sh.a1, sh.a1 < sh.a0);
      octx.stroke();
      octx.beginPath();
      octx.ellipse(cx, cy, sh.rx * s * rin, sh.ry * s * rin, 0, sh.a0, sh.a1, sh.a1 < sh.a0);
    } else if (sh.kind === "circle") {
      const [cx, cy] = toScreen(sh.x, sh.y);
      octx.arc(cx, cy, sh.r * s, 0, Math.PI * 2);
    } else if (sh.kind === "line") {
      const [ax, ay] = toScreen(sh.x0, sh.y0), [bx, by] = toScreen(sh.x1, sh.y1);
      octx.moveTo(ax, ay);
      octx.lineTo(bx, by);
    } else {
      const b = hitBounds(sh);
      const [ax, ay] = toScreen(b.x0, b.y0), [bx, by] = toScreen(b.x1, b.y1);
      octx.rect(ax, ay, bx - ax, by - ay);
    }
    octx.stroke();
  }
  // the light handle
  if (state.light.on && state.tool === "light") {
    const [lx, ly] = toScreen(state.light.x, state.light.y);
    octx.strokeStyle = "rgba(160, 200, 255, 0.9)";
    octx.beginPath();
    octx.arc(lx, ly, 9, 0, Math.PI * 2);
    octx.stroke();
  }
  // E prompt
  const [fx, fy] = [room.fig.x, room.fig.y - room.H * 0.5];
  const usable = room.world.nearestUsable(fx, fy);
  const prompt = document.getElementById("prompt")!;
  if (usable && usable.recipe.use?.prompt) {
    prompt.hidden = false;
    prompt.textContent = `E  ${usable.recipe.use.prompt}`;
  } else prompt.hidden = true;
}

// ---------------------------------------------------------------------------
// actions
// ---------------------------------------------------------------------------

function fire(tool: HitType, face: 1 | -1 = state.face, at?: [number, number]): Hit[] {
  const { world, fig, H } = room;
  let hits: Hit[];
  if (tool === "point" && at) hits = presetHit("point", at[0], at[1], face, H);
  else hits = presetHit(tool, fig.x, fig.y, face, H);
  for (const h of hits) {
    world.hit(h);
    state.lastHits.push({ shape: h.shape, t: performance.now() });
  }
  if (tool === "heavy" || tool === "q" || tool === "r") world.flashLight(fig.x, fig.y - H * 0.4, [1, 0.86, 0.6], H * 2.5, 1.2, 0.12);
  return hits;
}

function use(): Prop | null {
  const { world, fig, H } = room;
  return world.use(fig.x, fig.y - H * 0.5);
}

function setH(H: number): void {
  const save = room.world.saveData;
  renderer.releaseWorld(room.world);
  room = buildRoom(H, save);
  state.H = H;
  state.light = { x: room.fig.x - H * 0.8, y: room.floorY - H * 1.3, on: state.light.on };
  buildPanel();
}

function resetRoom(): void {
  renderer.releaseWorld(room.world);
  room = buildRoom(state.H, {});
  state.light = { x: room.fig.x - state.H * 0.8, y: room.floorY - state.H * 1.3, on: state.light.on };
  buildPanel();
}

// ---------------------------------------------------------------------------
// sound (placeholder synth, off by default)
// ---------------------------------------------------------------------------

let audio: AudioContext | null = null;
function blip(id: string, vol: number): void {
  if (!state.sound) return;
  audio ??= new AudioContext();
  const a = audio;
  const t = a.currentTime;
  const g = a.createGain();
  g.connect(a.destination);
  const v = Math.min(0.25, 0.12 * vol);
  const tone = (freq: number, type: OscillatorType, dur: number, delay = 0): void => {
    const o = a.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t + delay);
    const gg = a.createGain();
    gg.gain.setValueAtTime(v, t + delay);
    gg.gain.exponentialRampToValueAtTime(0.0001, t + delay + dur);
    o.connect(gg).connect(g);
    o.start(t + delay);
    o.stop(t + delay + dur);
  };
  const noise = (dur: number, lp: number): void => {
    const buf = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = a.createBufferSource();
    src.buffer = buf;
    const f = a.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = lp;
    const gg = a.createGain();
    gg.gain.value = v * 1.6;
    src.connect(f).connect(gg).connect(g);
    src.start(t);
  };
  const fam = id.split(".")[0];
  if (id === "donate.chime") { tone(1175, "sine", 0.5); tone(1568, "sine", 0.7, 0.12); }
  else if (fam === "glass") { tone(2400 + Math.random() * 800, "sine", 0.18); tone(3300, "sine", 0.12, 0.04); noise(0.12, 6000); }
  else if (fam === "stone") noise(0.22, id.endsWith("crater") ? 500 : 900);
  else if (fam === "metal") { tone(880 + Math.random() * 200, "triangle", 0.25); noise(0.05, 5000); }
  else if (fam === "wood") { noise(0.1, 1400); tone(180, "triangle", 0.1); }
  else if (fam === "cloth") noise(0.18, 2200);
  else if (fam === "flame") noise(0.3, 1800);
  else if (fam === "terminal") tone(id.endsWith("summon") ? 110 : id.endsWith("deny") ? 160 : 330, id.endsWith("summon") ? "sawtooth" : "square", id.endsWith("summon") ? 1.2 : 0.2);
  else tone(660, "sine", 0.1);
}

// ---------------------------------------------------------------------------
// dialog (E panels: real DOM, focus managed, Esc closes)
// ---------------------------------------------------------------------------

const dialog = document.getElementById("dialog") as HTMLDialogElement;
const dTitle = document.getElementById("dialog-title")!;
const dBody = document.getElementById("dialog-body")!;
document.getElementById("dialog-close")!.addEventListener("click", () => dialog.close());
dialog.addEventListener("close", () => canvas.focus());

function gridImage(g: CellGrid, scale: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = g.w * scale;
  c.height = g.h * scale;
  const x = c.getContext("2d")!;
  for (let y = 0; y < g.h; y++) for (let xx = 0; xx < g.w; xx++) {
    const i = g.inner(xx, y);
    const m = matById(g.mat[i]!);
    if (!m) continue;
    const col = m.rgb[Math.max(0, Math.min(3, 2 + g.tone[i]!))]!;
    x.fillStyle = `rgb(${col[0]},${col[1]},${col[2]})`;
    x.fillRect(xx * scale, y * scale, scale, scale);
  }
  return c;
}

function openPanel(e: WorldEvent): void {
  dBody.textContent = "";
  if (e["panel"] === "map") {
    dTitle.textContent = "Map";
    const g = e["grid"] as CellGrid;
    dBody.append(gridImage(g, 3));
  } else if (e["panel"] === "donate") {
    dTitle.textContent = "Donate";
    const p = document.createElement("p");
    p.innerHTML = 'In the world this opens the real donate panel. <a href="https://ko-fi.com/dexdonation" target="_blank" rel="noopener">Ko-fi</a> · <a href="/donate/">MB Bank QR</a>';
    dBody.append(p);
  } else if (e["panel"] === "donors") {
    dTitle.textContent = "Donors";
    const p = document.createElement("p");
    p.textContent = "No donor records are loaded in the sandbox. The plaque engraves real names only.";
    dBody.append(p);
  } else return;
  if (!dialog.open && !manual) dialog.showModal();
  (document.getElementById("dialog-close") as HTMLButtonElement).focus();
}

function drainEvents(): void {
  for (const e of room.world.drainEvents()) {
    if (e.type === "sound") blip(String(e["id"]), Number(e["volume"] ?? 1));
    if (e.type === "panel") openPanel(e);
    const label = e.type === "sound" ? `sound ${e["id"]}` : e.type === "state" ? `${e.prop?.id}: ${e["from"] || "-"} -> ${e["to"]}` : `${e.type}${e["panel"] ? " " + e["panel"] : ""}${e["action"] ? " " + e["action"] : ""}`;
    state.events.unshift(label);
  }
  state.events.length = Math.min(state.events.length, 10);
}

// ---------------------------------------------------------------------------
// panel
// ---------------------------------------------------------------------------

const panel = document.getElementById("panel")!;
let statsEl: HTMLPreElement;
let eventsEl: HTMLPreElement;
let propEl: HTMLDivElement;

function btn(label: string, on: () => void, pressed?: () => boolean, title?: string): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = label;
  if (title) b.title = title;
  b.addEventListener("click", () => {
    on();
    refresh();
    canvas.focus();
  });
  if (pressed) b.dataset["pressed"] = "1";
  (b as HTMLButtonElement & { pressedFn?: () => boolean }).pressedFn = pressed;
  return b;
}

function section(title: string, ...kids: HTMLElement[]): void {
  const h = document.createElement("h3");
  h.textContent = title;
  panel.append(h, ...kids);
}

function row(...kids: HTMLElement[]): HTMLDivElement {
  const d = document.createElement("div");
  d.className = "row";
  d.append(...kids);
  return d;
}

function buildPanel(): void {
  panel.textContent = "";
  section("hit tool (click fires from the gauge)", row(...TOOLS.map(([t, label, keys]) => btn(label, () => (state.tool = t), () => state.tool === t, keys))));
  const sel = document.createElement("select");
  sel.setAttribute("aria-label", "prop");
  for (const name of room.byName.keys()) {
    const o = document.createElement("option");
    o.value = name;
    o.textContent = name;
    sel.append(o);
  }
  sel.value = state.selected;
  sel.addEventListener("change", () => {
    state.selected = sel.value;
    refresh();
  });
  propEl = document.createElement("div");
  section("prop", sel, propEl);
  section("view", row(...(["lit", "albedo", "normals", "layers"] as ViewMode[]).map((v) => btn(v, () => (state.view = v), () => state.view === v))));
  const layers = document.createElement("div");
  for (const l of LAYERS) {
    const lab = document.createElement("label");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = state.layers[l];
    cb.addEventListener("change", () => (state.layers[l] = cb.checked));
    lab.append(cb, l);
    layers.append(lab);
  }
  const pl = document.createElement("label");
  const pcb = document.createElement("input");
  pcb.type = "checkbox";
  pcb.checked = state.particles;
  pcb.addEventListener("change", () => (state.particles = pcb.checked));
  pl.append(pcb, "debris");
  layers.append(pl);
  section("layers", layers);
  section("time", row(
    ...[1, 0.25, 0.1].map((s) => btn(`${s}x`, () => (state.speed = s), () => state.speed === s)),
    btn("pause", () => (state.paused = !state.paused), () => state.paused, "P"),
    btn("step", () => room.world.step(1 / 60), undefined, "."),
  ));
  section("scale", row(
    btn("H 80", () => setH(80), () => state.H === 80),
    btn("H 144 close-up", () => setH(144), () => state.H === 144),
  ));
  section("room", row(
    btn("light on", () => (state.light.on = !state.light.on), () => state.light.on),
    btn("chapel light", () => (state.lab = false), () => !state.lab),
    btn("lab light", () => (state.lab = true), () => state.lab),
    btn("sound", () => (state.sound = !state.sound), () => state.sound),
    btn("reset room", resetRoom),
  ));
  const keys = document.createElement("pre");
  keys.className = "keys";
  keys.textContent = "A/D walk · E use · J K Q R F hits · 1-7 tools\nclick: fire tool (point: at cursor)\nshift+click: move gauge · drag with light tool\nV view · P pause · . step · Tab hide panel";
  section("keys", keys);
  statsEl = document.createElement("pre");
  section("stats", statsEl);
  eventsEl = document.createElement("pre");
  section("events", eventsEl);
  refresh();
}

function refresh(): void {
  for (const b of panel.querySelectorAll("button")) {
    const f = (b as HTMLButtonElement & { pressedFn?: () => boolean }).pressedFn;
    if (f) b.setAttribute("aria-pressed", String(f()));
  }
  const p = room.byName.get(state.selected);
  if (!p || !propEl) return;
  propEl.textContent = "";
  const reason = document.createElement("p");
  reason.className = "reason";
  reason.textContent = p.recipe.reason;
  propEl.append(reason);
  const states = Object.keys(p.recipe.states);
  if (states.length > 1) propEl.append(row(...states.map((s) => btn(s, () => p.go(s), () => p.state === s))));
  const extra: HTMLButtonElement[] = [];
  if (p.recipe.use) extra.push(btn("use (E)", () => p.use()));
  extra.push(btn("hit it (point)", () => {
    const [x, y] = p.centre();
    fire("point", 1, [x, y]);
  }));
  extra.push(btn("restore", () => {
    for (const part of p.parts) if (!part.dynamic) room.world.restorePart(part);
  }));
  propEl.append(row(...extra));
  propEl.append(row(
    btn("dissolve", () => runFx(p, "dissolve")),
    btn("reveal", () => runFx(p, "reveal")),
    btn("assemble", () => runFx(p, "assemble")),
    btn("disintegrate", () => runFx(p, "disintegrate")),
    btn("glint", () => runFx(p, "glint")),
  ));
}

function runFx(p: Prop, kind: string): void {
  const w = room.world;
  for (const part of p.parts) {
    if (part.dynamic || part.grid.count === 0 && kind !== "assemble") continue;
    if (kind === "dissolve") dissolve(w, part, 1, 0.8, 0);
    else if (kind === "reveal") dissolve(w, part, 0, 0.8, 2);
    else if (kind === "assemble") assemble(w, part, { stagger: 1.4, dur: 0.6 });
    else if (kind === "disintegrate") disintegrate(w, part, { dur: 1.2, dir: [0.3, -1] });
    else if (kind === "glint") glint(part);
  }
}

let fps = 0;
function updateStats(dt: number): void {
  if (!statsEl) return;
  fps = fps * 0.95 + (1 / Math.max(1e-3, dt)) * 0.05;
  const w = room.world;
  const r = renderer.stats;
  let cells = 0;
  for (const part of w.allParts()) cells += part.grid.count;
  const p = room.byName.get(state.selected);
  statsEl.textContent = [
    `${renderer.vw}x${renderer.vh} world px · H ${room.H} · ${renderer.fit.mode} ${renderer.fit.scale.toFixed(2)}x`,
    `fps ${fps.toFixed(0)} · sim ${w.stats.simMs.toFixed(2)} ms`,
    `draws ${r.draws} · parts ${r.parts} · uploads ${r.uploads} (${r.uploadKB.toFixed(1)} KB)`,
    `cells ${cells} · particles ${w.particles.n} · chunks ${w.chunks.length} (${w.stats.awakeChunks} awake)`,
    `ropes awake ${w.stats.awakeRopes} · cloth awake ${w.stats.awakeCloth} · wounds ${w.stats.wounds}`,
    `lights ${r.lights} · glows ${r.glows} · parts on GPU ${r.gpuParts}`,
    p ? `${p.id}: ${p.state} (${p.t.toFixed(1)} s)` : "",
  ].join("\n");
  eventsEl.textContent = state.events.join("\n");
}

// ---------------------------------------------------------------------------
// input
// ---------------------------------------------------------------------------

let dragging = false;
canvas.addEventListener("pointerdown", (e) => {
  canvas.focus();
  const [x, y] = toWorld(e.clientX, e.clientY);
  if (state.tool === "light" || e.button === 2) {
    dragging = true;
    state.light.x = x;
    state.light.y = y;
    canvas.setPointerCapture(e.pointerId);
    return;
  }
  if (e.shiftKey) {
    room.fig.x = Math.round(x);
    return;
  }
  state.face = x >= room.fig.x ? 1 : -1;
  room.fig.flip = state.face;
  fire(state.tool, state.face, [x, y]);
});
canvas.addEventListener("pointermove", (e) => {
  if (!dragging) return;
  const [x, y] = toWorld(e.clientX, e.clientY);
  state.light.x = x;
  state.light.y = y;
});
canvas.addEventListener("pointerup", () => (dragging = false));
canvas.addEventListener("contextmenu", (e) => e.preventDefault());

window.addEventListener("keydown", (e) => {
  if (dialog.open) return;
  const k = e.key.toLowerCase();
  state.keys.add(k);
  const toolKey: Record<string, Tool> = { "1": "slash", "2": "heavy", "3": "q", "4": "r", "5": "point", "6": "wind", "7": "light" };
  if (toolKey[k]) { state.tool = toolKey[k]!; refresh(); }
  else if (k === "j") fire("slash");
  else if (k === "k") fire("heavy");
  else if (k === "q") fire("q");
  else if (k === "r") fire("r");
  else if (k === "f") fire("wind");
  else if (k === "e") use();
  else if (k === "p") { state.paused = !state.paused; refresh(); }
  else if (k === ".") room.world.step(1 / 60);
  else if (k === "v") { const vs: ViewMode[] = ["lit", "albedo", "normals", "layers"]; state.view = vs[(vs.indexOf(state.view) + 1) % 4]!; refresh(); }
  else if (k === "tab") { e.preventDefault(); panel.classList.toggle("hidden"); }
  else return;
  e.preventDefault();
});
window.addEventListener("keyup", (e) => state.keys.delete(e.key.toLowerCase()));

function walk(dt: number): void {
  const left = state.keys.has("a") || state.keys.has("arrowleft");
  const right = state.keys.has("d") || state.keys.has("arrowright");
  const dir = (right ? 1 : 0) - (left ? 1 : 0);
  if (!dir) return;
  state.face = dir > 0 ? 1 : -1;
  room.fig.flip = state.face;
  room.fig.x = Math.max(room.H * 0.3, Math.min(room.world.width - room.H * 0.3, room.fig.x + dir * room.H * 3.2 * dt));
}

// ---------------------------------------------------------------------------
// loop + automation hooks
// ---------------------------------------------------------------------------

buildPanel();
let last = performance.now();
function loop(now: number): void {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  try {
    walk(dt);
    room.world.paused = state.paused;
    room.world.timeScale = state.speed;
    room.world.update(dt);
    drainEvents();
    frame();
    updateStats(dt);
    if (Math.floor(now / 250) !== Math.floor((now - dt * 1000) / 250)) refresh();
  } catch (e) {
    fail.hidden = false;
    fail.textContent = `The sandbox stopped: ${(e as Error).message}`;
    console.error(e);
    return;
  }
  requestAnimationFrame(loop);
}
if (!manual) requestAnimationFrame(loop);
else frame();

declare global {
  interface Window {
    __pixel: unknown;
  }
}

function toPng(crop?: [number, number, number, number]): string {
  const px = renderer.capture();
  const c = document.createElement("canvas");
  const [x, y, w, h] = crop ?? [0, 0, renderer.vw, renderer.vh];
  c.width = w;
  c.height = h;
  const img = new ImageData(new Uint8ClampedArray(px), renderer.vw, renderer.vh);
  const full = document.createElement("canvas");
  full.width = renderer.vw;
  full.height = renderer.vh;
  full.getContext("2d")!.putImageData(img, 0, 0);
  c.getContext("2d")!.drawImage(full, x, y, w, h, 0, 0, w, h);
  return c.toDataURL("image/png");
}

window.__pixel = {
  get world() {
    return room.world;
  },
  get room() {
    return room;
  },
  renderer,
  state,
  /** Advance n fixed steps and render. */
  step(n = 1): void {
    for (let i = 0; i < n; i++) {
      walk(1 / 60);
      room.world.step((1 / 60) * state.speed);
    }
    drainEvents();
    frame();
  },
  render: frame,
  fire,
  use,
  setH,
  resetRoom,
  go(name: string, st: string): void {
    room.byName.get(name)?.go(st);
  },
  prop(name: string): Prop | undefined {
    return room.byName.get(name);
  },
  moveFigure(x: number, face: 1 | -1 = 1): void {
    room.fig.x = Math.round(x);
    room.fig.flip = face;
    state.face = face;
  },
  light(x: number, y: number, on = true): void {
    state.light = { x, y, on };
  },
  png: toPng,
  fx(name: string, kind: string): void {
    const p = room.byName.get(name);
    if (p) runFx(p, kind);
  },
  /** Would a slash from foot x (facing) cross any rope of the named prop? */
  probeCut(name: string, x: number, face: 1 | -1 = 1): boolean {
    const p = room.byName.get(name)!;
    for (const h of presetHit("slash", x, room.floorY, face, room.H)) {
      const path = cutPath(h.shape);
      for (const r of p.ropes) for (let i = 0; i + 3 < path.length; i += 2) for (let k = 0; k < r.n - 1; k++) {
        if (!r.cut[k] && segCross(path[i]!, path[i + 1]!, path[i + 2]!, path[i + 3]!, r.x[k]!, r.y[k]!, r.x[k + 1]!, r.y[k + 1]!)) return true;
      }
    }
    return false;
  },
  mapImage(scale = 3): string | null {
    const p = room.byName.get("map banner") as Prop<{ src: CellGrid }> | undefined;
    return p ? gridImage(p.refs.src, scale).toDataURL("image/png") : null;
  },
  /** World rect of a prop (for crops), in screen (frame) px. */
  frameRect(name: string, pad = 16): [number, number, number, number] {
    const p = room.byName.get(name)!;
    const b = p.bounds();
    const x0 = Math.max(0, Math.floor(b.x0 - state.cam.x - pad)), y0 = Math.max(0, Math.floor(b.y0 - state.cam.y - pad));
    const x1 = Math.min(renderer.vw, Math.ceil(b.x1 - state.cam.x + pad)), y1 = Math.min(renderer.vh, Math.ceil(b.y1 - state.cam.y + pad));
    return [x0, y0, x1 - x0, y1 - y0];
  },
};

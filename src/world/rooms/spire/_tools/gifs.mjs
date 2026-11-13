// Spire motion captures (lane R-D): judge motion through a full cycle, not
// single frames. Frames every 3 ticks (20 fps), assembled with ffmpeg.
//   node src/world/rooms/spire/_tools/gifs.mjs [--port 24501] [--only gust,ride,break,summon,alcove] [--w 1280 --h 720]
// gust    D2: two full gust cycles on a catwalk, standing still: the pennants
//         snap during the tell, the rain leans, the push carries her to the lip
//         (a frame counter and the gust state are logged per frame)
// ride    D1: the whole ride from the Lift Foot to the break (every 2nd frame)
// break   D4: walking across x 292: the storm tears open in stepped bands
// summon  D3: wake the terminal (the roster), summon (seals, shutters, red), cool down
// alcove  D2: the alcove through lightning (the window lit from behind)
// Output: review/world/phase2/R-D/gif/<name>.gif and <name>.json (per-frame state).
import { createRequire } from "node:module";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
const require = createRequire(new URL("../../../../../tools/scene-pipeline/package.json", import.meta.url));
const { chromium } = require("playwright-core");
const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : d;
};
const PORT = arg("port", "24501");
const ONLY = new Set(arg("only", "gust,ride,break,summon,alcove").split(","));
const VW = +arg("w", 1280), VH = +arg("h", 720);
const FFMPEG = process.env.FFMPEG ?? "D:/Dex/Tools/ffmpeg-9.0.1-full_build/bin/ffmpeg.exe";
const OUT = arg("out", "review/world/phase2/R-D/gif");
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: "msedge", args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: VW, height: VH } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const ev = (fn, a) => page.evaluate(fn, a);
const adv = (n) => ev((n) => window.__world.advance(n), n);

async function open(extra = "") {
  await page.goto(`http://127.0.0.1:${PORT}/world/?manual&fresh&mute${extra}`, { waitUntil: "load" });
  await page.waitForFunction(() => !!window.__world, null, { timeout: 60000 });
  for (let k = 0; k < 300; k++) {
    if (!(await ev(() => window.__world.game.loading))) break;
    await page.waitForTimeout(100);
    await adv(1);
  }
  await ev(() => window.__world.begin());
}
async function go(room, spawn, x, y) {
  await ev(([r, s]) => window.__world.teleport(r, s), [room, spawn]);
  for (let k = 0; k < 400; k++) {
    const ok = await ev(() => { const g = window.__world.game; const b = g.room.backdrop; return !g.trans && (!b || b.ready()); });
    if (ok) break;
    await page.waitForTimeout(80);
    await adv(1);
  }
  if (x !== undefined) await ev(([x, y]) => { const w = window.__world; const o = w.game.room.def.origin; w.place((x - o[0]) * 80, y === undefined ? undefined : (o[1] - y) * 80); }, [x, y]);
  await adv(30);
}
const STATE = () => ev(() => {
  const g = window.__world.game;
  const b = g.player.body;
  const o = g.room.def.origin;
  const st = g.room.props.find((p) => p.recipe === "spire-storm");
  return { room: g.room.def.id, x: +(o[0] + b.x / 80).toFixed(3), y: +(o[1] - b.y / 80).toFixed(2), storm: st?.state ?? null, push: st ? +st.mover.dx.toFixed(3) : 0, after: +g.weather.p.after.toFixed(3), flash: g.weather.flash };
});
async function record(name, frames, step, every = 3) {
  const dir = `${OUT}/${name}`;
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const log = [];
  for (let f = 0; f < frames; f++) {
    if (!(await step(f))) await adv(every);
    await page.screenshot({ path: `${dir}/${String(f).padStart(4, "0")}.png` });
    log.push({ f, ...(await STATE()) });
  }
  const fps = Math.round(60 / every);
  execFileSync(FFMPEG, ["-y", "-loglevel", "error", "-framerate", String(fps), "-i", `${dir}/%04d.png`, "-vf", `scale=${Math.min(960, VW)}:-1:flags=neighbor,split[a][b];[a]palettegen=max_colors=200[p];[b][p]paletteuse=dither=none`, `${OUT}/${name}.gif`]);
  // keep three stills from the sequence
  for (const k of [0, Math.floor(frames / 2), frames - 1]) execFileSync("cp", [`${dir}/${String(k).padStart(4, "0")}.png`, `${OUT}/${name}-${k}.png`]);
  rmSync(dir, { recursive: true, force: true });
  writeFileSync(`${OUT}/${name}.json`, JSON.stringify(log));
  console.log(`${OUT}/${name}.gif`);
}

await open();
if (ONLY.has("gust")) {
  // two cycles (18 s) standing on row 46, a little west of its lip
  await go("D2", "lift", 276, 46);
  await record("gust", 360, async () => false);
}
if (ONLY.has("alcove")) {
  await go("D2", "shrine", 264.6, 58);
  await record("alcove", 240, async () => false);
}
if (ONLY.has("ride")) {
  await go("C3", "west", 265.2);
  await ev(() => window.__world.use());
  for (let k = 0; k < 400; k++) {
    const r = await ev(() => window.__world.game.room.def.id);
    if (r === "D1" && !(await ev(() => window.__world.game.trans))) break;
    await page.waitForTimeout(60);
    await adv(2);
  }
  await record("ride", 180, async () => false, 6);
}
if (ONLY.has("break")) {
  await open("");
  await go("D4", "west", 289);
  await record("break", 260, async (f) => {
    if (f === 4) await ev(() => window.__world.press("right"));
    if (f === 60) await ev(() => window.__world.release("right"));
    return false;
  });
}
if (ONLY.has("summon")) {
  await go("D3", "west", 255.6, 76);
  await record("summon", 300, async (f) => {
    if (f === 10) await ev(() => window.__world.use());
    if (f === 60) await ev(() => window.__world.use());
    if (f === 260) await ev(() => { const g = window.__world.game; if (g.panels.open) g.panels.close(); });
    return false;
  });
}
writeFileSync(`${OUT}/errors.json`, JSON.stringify(errors));
if (errors.length) console.log("errors:", errors.slice(0, 5));
await browser.close();

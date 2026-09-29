// Scripted tour of the test world for review captures.
//   node src/world/tools/tour.mjs [--w 1920 --h 1080 --dpr 1 --tag 1080 --port 22763 --only a,b]
// Drives /world/?manual through window.__world (deterministic ticks), writes
// PNGs to review/world/runtime/<tag>/ and a JSON log of states next to them.
// Uses playwright-core from tools/scene-pipeline driving the installed Edge.

import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
const require = createRequire(new URL("../../../tools/scene-pipeline/package.json", import.meta.url));
const { chromium } = require("playwright-core");

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : d;
};
const W = +arg("w", 1920), H = +arg("h", 1080), DPR = +arg("dpr", 1), TAG = arg("tag", `${W}x${H}`), PORT = arg("port", process.env.WORLD_PORT ?? "22763");
const ONLY = arg("only", "") ? new Set(arg("only", "").split(",")) : null;
const OUT = `review/world/runtime/${TAG}`;
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: "msedge", args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DPR, hasTouch: arg("touch", "0") === "1", isMobile: arg("mobile", "0") === "1" });
const page = await ctx.newPage();
const logs = [];
page.on("console", (m) => { if (m.type() === "error" && !/404/.test(m.text())) logs.push(`${m.type()}: ${m.text()}`); });
page.on("pageerror", (e) => logs.push(`pageerror: ${e.message}`));
await page.goto(`http://127.0.0.1:${PORT}/world/?manual&fresh`, { waitUntil: "load" });
await page.waitForFunction(() => !!window.__world, null, { timeout: 60000 });
const ev = (fn, a) => page.evaluate(fn, a);
const adv = (n) => ev((n) => window.__world.advance(n), n);
// wait for honest loading (shader compile) to finish
for (let i = 0; i < 200; i++) {
  const s = await ev(() => ({ loading: window.__world.game.loading }));
  if (!s.loading) break;
  await page.waitForTimeout(250);
  await adv(1);
}
await adv(40);
const states = {};
const shot = async (name, note = "") => {
  if (ONLY && !ONLY.has(name)) return;
  await ev(() => window.__world.render());
  await page.screenshot({ path: `${OUT}/${name}.png` });
  states[name] = { note, ...(await ev(() => window.__world.state())) };
  console.log(name, note);
};
const warm = async (room) => {
  // let a room's shaders finish before capturing it
  for (let i = 0; i < 120; i++) {
    const ok = await ev((room) => { const r = window.__world.game.stream.rooms.get(room); return !!r && r.built && !!r.backdrop && r.backdrop.ready(); }, room);
    if (ok) return;
    await page.waitForTimeout(250);
    await adv(1);
  }
};
const press = (a) => ev((a) => window.__world.press(a), a);
const release = (a) => ev((a) => window.__world.release(a), a);

await shot("01-arrival-first-view", "intro: scenery first, nothing competes");
await ev(() => window.__world.begin());
await press("right");
await adv(70);
await release("right");
await adv(30);
await shot("02-arrival-walk-right", "after a few steps right (the red line on the boards)");
await ev(() => window.__world.place(260));
await adv(90);
await shot("03-arrival-overlook", "the resting overlook at the end of the dock (bench)");
await ev(() => { const g = window.__world.game; return window.__world.place(g.room.def.props.find((p) => p.id === "pile-2").x); });
await adv(60);
await shot("04-arrival-pilings", "hopping the old pilings; the world reflects in the lake");
await ev(() => { const g = window.__world.game; return window.__world.place(g.room.def.props.find((p) => p.id === "shore-door").x - 30); });
await adv(60);
await shot("05-arrival-shore-door", "a door alone on the shore, latched from the other side (prompt shows)");

// the plain: mist -> storm
await ev(() => window.__world.teleport("plain", "west"));
await warm("plain");
await adv(90);
await shot("06-plain-mist", "the plain in mist");
for (const [name, u] of [["07-plain-stones", 0.34], ["08-plain-shrine", 0.44], ["09-plain-rain", 0.58], ["10-plain-storm", 0.8]]) {
  await ev((u) => { const g = window.__world.game; return window.__world.place(g.room.def.w * u); }, u);
  await adv(80);
  await shot(name, `plain at ${Math.round(u * 100)}%`);
}
// wait for a lightning flash in the storm
for (let i = 0; i < 400; i++) {
  const st = await adv(3);
  if (st.weather.flash >= 0.75) break;
}
await shot("11-plain-lightning", "lightning (through the flash gate)");
// cut the map banner cord
await ev(() => { const g = window.__world.game; const p = g.room.def.props.find((q) => q.id === "shrine-map"); window.__world.place(p.x - 40); g.player.facing = 1; });
await adv(20);
await press("m1");
await adv(4);
await release("m1");
await adv(160);
await shot("12-plain-map-banner-cut", "slashed the cord: the banner unrolls (saved)");
await ev(() => { const g = window.__world.game; const p = g.room.def.props.find((q) => q.id === "shrine-box"); window.__world.place(p.x - 18); });
await adv(20);
await ev(() => window.__world.use());
await adv(40);
await page.waitForTimeout(1500);
await shot("13-panel-donate", "E at the donation box: the website's donate page in an in-world panel");
await page.keyboard.press("Escape");
await adv(10);
await ev(() => { const g = window.__world.game; return window.__world.place(g.room.def.w - 330); });
await adv(80);
await shot("14-plain-house", "shelter: the house at the far side of the storm");

// indoors
await ev(() => window.__world.teleport("house", "entry"));
await warm("house");
await adv(90);
await shot("15-house-entry", "indoors: warm, small; the storm in the windows");
await ev(() => window.__world.place(800));
await adv(60);
await shot("16-house-reading", "the reading lectern (silence zone) and the archive door");
await ev(() => { const g = window.__world.game; return window.__world.place(g.room.def.props.find((p) => p.id === "terminal").x - 40, g.room.def.props.find((p) => p.id === "terminal").y); });
await adv(90);
await shot("17-house-upper", "the upper floor: shelves, the framed piece, the terminal");
await ev(() => window.__world.use());
await adv(70);
await shot("18-terminal-closeup", "terminal summoning: the combat zoom hands the player to the 144 px close-up render");
await adv(120);
await page.waitForTimeout(300);
await shot("19-terminal-summoned", "no warden yet: honest panel, downloads direct on the website");
await page.keyboard.press("Escape");

writeFileSync(`${OUT}/states.json`, JSON.stringify({ viewport: { W, H, DPR }, states, logs }, null, 1));
console.log(logs.length ? logs.join("\n") : "no console errors");
await browser.close();

// Mechanics check for the test world, end to end, through real input and real
// transitions (no teleports except to set up): jump reach in H, walking off
// the arrival into the plain, the house door, the back-door latch shortcut
// and its save, the lift, a pit, the storm passing while indoors.
//   node src/world/tools/flow.mjs [--port 22763]
// Prints a JSON report; writes review/world/runtime/flow.json.

import { createRequire } from "node:module";
import { writeFileSync, mkdirSync } from "node:fs";
const require = createRequire(new URL("../../../tools/scene-pipeline/package.json", import.meta.url));
const { chromium } = require("playwright-core");
const i = process.argv.indexOf("--port");
const PORT = i >= 0 ? process.argv[i + 1] : process.env.WORLD_PORT ?? "24001";

const browser = await chromium.launch({ channel: "msedge", args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error" && !/404/.test(m.text())) errors.push(m.text()); });
await page.goto(`http://127.0.0.1:${PORT}/world/?manual&fresh&world=test`, { waitUntil: "load" });
await page.waitForFunction(() => !!window.__world, null, { timeout: 60000 });
const ev = (fn, a) => page.evaluate(fn, a);
const adv = (n) => ev((n) => window.__world.advance(n), n);
const st = () => ev(() => window.__world.state());
const press = (a) => ev((a) => window.__world.press(a), a);
const release = (a) => ev((a) => window.__world.release(a), a);
for (let k = 0; k < 200; k++) {
  if (!(await ev(() => window.__world.game.loading))) break;
  await page.waitForTimeout(250);
  await adv(1);
}
await ev(() => window.__world.begin());
await adv(30);
const H = 80;
const report = {};

// --- jump reach
const s0 = await st();
await press("jump");
let minY = s0.y;
for (let k = 0; k < 60; k++) minY = Math.min(minY, (await adv(1)).y);
await release("jump");
await adv(60);
report.jumpHeightH = +((s0.y - minY) / H).toFixed(2);
await press("jump");
await adv(22);
await release("jump");
await adv(2);
await press("jump");
let minY2 = s0.y;
for (let k = 0; k < 70; k++) minY2 = Math.min(minY2, (await adv(1)).y);
await release("jump");
await adv(80);
report.doubleJumpHeightH = +((s0.y - minY2) / H).toFixed(2);
// run speed
const a = await st();
await press("right");
await adv(60);
const b = await st();
await release("right");
await adv(30);
report.runSpeedHperSecond = +((b.x - a.x) / H).toFixed(2);

// --- walk off the arrival's right edge into the plain (a real exit + fade)
await ev(() => { const g = window.__world.game; return window.__world.place(g.room.def.w - 60); });
await press("right");
let room = "arrival";
for (let k = 0; k < 200 && room === "arrival"; k++) room = (await adv(5)).room;
await release("right");
for (let k = 0; k < 400; k++) { const s = await adv(5); if (!s.transition) break; await page.waitForTimeout(20); }
report.edgeExit = room;
report.afterEdge = await st();

// --- the house door (E), a real transition
await ev(() => { const g = window.__world.game; const d = g.room.def.props.find((p) => p.id === "house-door"); return window.__world.place(d.x - 10); });
await adv(5);
report.nearHouseDoor = (await st()).near;
await ev(() => window.__world.use());
for (let k = 0; k < 400; k++) { const s = await adv(5); if (s.room === "house" && !s.transition) break; await page.waitForTimeout(20); }
report.houseDoor = (await st()).room;
if (report.houseDoor !== "house") { console.log(JSON.stringify({ edge: report.edgeExit, near: report.nearHouseDoor, st: await st() }).slice(0, 800)); }

// --- the lift carries you up
await ev(() => { const g = window.__world.game; const l = g.room.def.props.find((p) => p.id === "lift"); return window.__world.place(l.x); });
await adv(10);
const l0 = await st();
await ev(() => window.__world.use());
for (let k = 0; k < 120; k++) await adv(5);
const l1 = await st();
report.lift = { fromY: l0.y, toY: l1.y, roseH: +((l0.y - l1.y) / H).toFixed(2), grounded: l1.grounded };

// --- the storm passes while you're inside (story beat)
report.stormPassedBefore = (await st()).stormPassed;
for (let k = 0; k < 60 * 42 / 30; k++) await adv(30);
report.stormPassedAfter = (await st()).stormPassed;

// --- the back door: release the latch (saved), go through to the arrival shore
await ev(() => { const g = window.__world.game; const d = g.room.def.props.find((p) => p.id === "house-back"); return window.__world.place(d.x - 12, d.y); });
await adv(5);
report.nearBackDoor = (await st()).near;
await ev(() => window.__world.use());
for (let k = 0; k < 400; k++) { const s = await adv(5); if (s.room === "arrival" && !s.transition) break; await page.waitForTimeout(20); }
const back = await st();
report.shortcut = { room: back.room, latchSaved: !!back.save.flags["latch:house-back"] };
// the shore door now opens from this side too
await adv(10);
report.nearShoreDoor = (await st()).near;
await ev(() => window.__world.use());
for (let k = 0; k < 400; k++) { const s = await adv(5); if (s.room === "house" && !s.transition) break; await page.waitForTimeout(20); }
report.shoreDoorOpens = (await st()).room;

// --- a pit: step off the dock into the lake and come back on safe ground
await ev(() => window.__world.teleport("arrival", "start"));
await adv(10);
await ev(() => { const g = window.__world.game; return window.__world.place(g.room.def.props.find((p) => p.id === "pile-1").x - 45, 740); });
let pitRespawn = null;
for (let k = 0; k < 200; k++) { const s = await adv(3); if (s.transition) { for (let j = 0; j < 200; j++) { const t = await adv(3); if (!t.transition) { pitRespawn = t; break; } } break; } }
report.pit = pitRespawn ? { x: pitRespawn.x, y: pitRespawn.y, grounded: pitRespawn.grounded } : null;

// --- persistence: reload keeps the latch and the map cut
await page.goto(`http://127.0.0.1:${PORT}/world/?manual`, { waitUntil: "load" });
await page.waitForFunction(() => !!window.__world, null, { timeout: 60000 });
report.saveAfterReload = (await st()).save;

report.errors = errors;
mkdirSync("review/world/runtime", { recursive: true });
writeFileSync("review/world/runtime/flow.json", JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, (k, v) => (k === "afterEdge" ? { room: v.room, x: v.x, y: v.y } : v), 1));
await browser.close();

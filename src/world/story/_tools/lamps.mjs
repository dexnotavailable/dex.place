// The lamps you lit, from Ringwater (lane I1): the far strand shows exactly the save's lit
// shrines, live, in the morning and in the evening after the round.
//   node src/world/story/_tools/lamps.mjs [--port 24801]
// Shots at 1280x720 (1x), 1920x1080 (1.5x sharp-bilinear), 2560x1440 (2x) and a phone
// (844x390 @3), with 0, 3 and 6 shrines lit, plus zooms of the strand. Writes
// review/world/phase2/I1/lamps/ (lamps.json: which lamp points each view drew).
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
const require = createRequire(new URL("../../../../tools/scene-pipeline/package.json", import.meta.url));
const { chromium } = require("playwright-core");
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const PORT = arg("port", "24801");
const OUT = "review/world/phase2/I1/lamps";
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: "msedge", args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
const report = { views: [] };
const sizes = [
  ["720", { viewport: { width: 1280, height: 720 } }],
  ["1080", { viewport: { width: 1920, height: 1080 } }],
  ["1440", { viewport: { width: 2560, height: 1440 } }],
  ["phone", { viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true }],
];
for (const [tag, opts] of sizes) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const ev = (fn, a) => page.evaluate(fn, a);
  await page.goto(`http://127.0.0.1:${PORT}/world/?manual&fresh&mute`, { waitUntil: "load" });
  await page.waitForFunction(() => !!window.__world);
  for (let k = 0; k < 600 && (await ev(() => window.__world.game.loading)); k++) { await page.waitForTimeout(100); await ev(() => window.__world.advance(1)); }
  await ev(() => window.__world.begin());
  const view = async (name, room, spawn, x, lit, extra = {}) => {
    await ev(([room, spawn, x, lit, extra]) => {
      const w = window.__world, g = w.game;
      for (let n = 1; n <= 6; n++) g.save.set(`shrine:${n}`, n <= lit);
      if (extra.done) {
        // as in the round: round:done is set on the far side of the sky door, out of Ringwater
        w.teleport("E4", "balcony");
        g.save.set("round:done", true);
      }
      w.teleport(room, spawn);
      const o = g.room.def.origin ?? [0, 0];
      const px = (x - o[0]) * 80;
      w.place(px, g.room.collision.groundAt(px, g.player.body.y - 240));
    }, [room, spawn, x, lit, extra]);
    for (let k = 0; k < 300; k++) {
      if (await ev(() => { const b = window.__world.game.room.backdrop; return !b || b.ready(); })) break;
      await page.waitForTimeout(100);
    }
    await ev(() => window.__world.advance(200));
    await page.waitForTimeout(300);
    await ev(() => window.__world.advance(20));
    const file = `${OUT}/${tag}-${name}.png`;
    await page.screenshot({ path: file });
    const s = await ev(() => { const g = window.__world.game; return { room: g.room.def.id, built: g.room.backdrop?.def?.title ?? g.room.backdrop?.scene?.title ?? null, keeper: g.room.pixel?.world.find("keeper-pier")?.state ?? null, evening: g.save.getSession("evening"), lit: [1, 2, 3, 4, 5, 6].filter((n) => g.save.get(`shrine:${n}`)), present: g.r.presenter.rect }; });
    report.views.push({ tag, name, file, ...s });
  };
  // a returning morning: none lit, three lit, all six
  await view("A1-morning-0", "A1", "start", 16, 0);
  await view("A1-morning-3", "A1", "start", 16, 3);
  await view("A1-morning-6", "A1", "start", 16, 6);
  await view("A0-morning-6", "A0", "east", -11.65, 6);
  // the evening after the round (round:done set during this visit)
  await view("A0-evening-6", "A0", "east", -11.65, 6, { done: true });
  await view("A0-evening-4", "A0", "east", -11.65, 4);
  await view("A1-evening-6", "A1", "start", 16, 6);
  await view("A4-evening-6", "A4", "west", 68, 6);
  // the balcony's valley (R-E's scene; the story hook lifts its lamps over the valley mist)
  await view("E4-balcony-6", "E4", "balcony", 484.2, 6);
  report.views.push({ tag, errors });
  await ctx.close();
  console.log(tag, errors.length ? errors : "ok");
}
writeFileSync(`${OUT}/lamps.json`, JSON.stringify(report, null, 1));
await browser.close();

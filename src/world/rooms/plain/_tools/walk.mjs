// Region B end to end with real input (W0's bot, src/world/tools/bot.js), the
// same moves as the round (round.mjs) from the yard to the market:
//   node src/world/rooms/plain/_tools/walk.mjs [--port 24301] [--shots 1]
// B1: wade the channel, cut the bridge from the east bank (S1); B2: the break,
// the crater, the wade, rest at shrine 2; B5: the culvert lever (S2), the hook
// down, the street into C1. Then the returning checks: the bridge is down and
// walkable after a reload, the hook comes when called from the bottom, and the
// ferry (A0) sails to the culvert once the lever is pulled.
// Writes review/world/phase2/R-B/walk.json.
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
const require = createRequire(new URL("../../../../../tools/scene-pipeline/package.json", import.meta.url));
const { chromium } = require("playwright-core");
const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : d;
};
const PORT = arg("port", process.env.WORLD_PORT ?? "24301");
const SHOTS = arg("shots", "0") === "1";
const OUT = "review/world/phase2/R-B";
mkdirSync(`${OUT}/walk`, { recursive: true });
const BOT = readFileSync(new URL("../../../tools/bot.js", import.meta.url), "utf8");

const browser = await chromium.launch({ channel: "msedge", args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => m.type() === "error" && !/Failed to load resource/.test(m.text()) && errors.push(m.text()));
const ev = (fn, a) => page.evaluate(fn, a);
const log = [];
const note = (s) => {
  log.push(s);
  console.log(s);
};

async function open(query) {
  await page.goto(`http://127.0.0.1:${PORT}/world/?${query}`, { waitUntil: "load", timeout: 120000 });
  await page.waitForFunction(() => !!window.__world, null, { timeout: 120000 });
  await page.addScriptTag({ content: BOT });
  for (let k = 0; k < 400; k++) {
    if (!(await ev(() => window.__world.game.loading))) break;
    await page.waitForTimeout(100);
    await ev(() => window.__world.advance(1));
  }
}
async function run(call, ...args) {
  for (let k = 0; k < 4000; k++) {
    const r = await ev(([c, a]) => window.__bot[c](...a), [call, args]);
    if (r.wait) {
      await page.waitForTimeout(40);
      continue;
    }
    if (r.budget) throw new Error(`${call}(${args.join(", ")}) ran out of budget at ${JSON.stringify(r)}`);
    return r;
  }
  throw new Error(`${call} never finished`);
}
const st = () => ev(() => window.__bot.st());
async function walk(x) {
  let r;
  for (let k = 0; k < 8; k++) {
    const before = (await st()).room;
    r = await run("walk", x, 3000, {});
    const s = await st();
    if (s.room === before) return r;
    await run("wait", 20);
    const d = await st();
    const ox = await ev(() => { const d = window.__world.game.room.def; return [d.origin?.[0] ?? 0, (d.origin?.[0] ?? 0) + d.w / 80]; });
    if (x < ox[0] || x > ox[1] || Math.abs(d.x - x) < 0.3) return r;
  }
  return r;
}
const use = () => run("use");
const wait = (t, until) => run("wait", t, until);
async function expectRoom(id) {
  const s = await st();
  if (s.room !== id) throw new Error(`expected room ${id}, in ${s.room} at ${s.x.toFixed(1)}, ${s.y.toFixed(1)}`);
}
async function shot(name) {
  if (!SHOTS) return;
  await ev(() => window.__world.render());
  await page.screenshot({ path: `${OUT}/walk/${name}.png` });
}
const t = () => ev(() => window.__world.game.travel.t);
const flag = (k) => ev((k) => window.__world.game.save.get(k), k);
const report = { port: PORT, times: {}, flags: {}, checks: {}, errors, log };

await open("manual&fresh");
await ev(() => window.__world.begin());
await ev(() => window.__world.teleport("B1", "west"));
await wait(60);
await expectRoom("B1");
note("B1: down the stair, the boardwalk, wade the channel, cut the bridge from the east bank");
const t0 = await t();
await walk(97.2);
report.checks.wadingInChannel = await ev(() => window.__world.game.wading);
await shot("B1-wading");
// a slash from inside the channel (west of the mast) must not cut it
await run("slash", 1);
await wait(30);
report.checks.cutFromWestRefused = !(await flag("cut:rope-bridge"));
await walk(98.9);
await run("slash", -1);
await wait(120);
report.flags["cut:rope-bridge"] = await flag("cut:rope-bridge");
report.checks.bridgeState = await ev(() => window.__world.game.room.pixel?.world.find("rope-bridge")?.state);
await shot("B1-bridge-down");
// walk back west over the lowered deck without wading
await walk(93.0);
report.checks.onDeckNotWading = !(await ev(() => window.__world.game.wading)) && Math.abs((await st()).y - 0.2) < 0.05;
await walk(108.4);
await expectRoom("B2");
report.times.B1 = +((await t()) - t0).toFixed(2);
note("B2: the causeway, the break, the crater, the wade, the rib arch, shrine 2 in the shelter");
const t1 = await t();
await walk(160.2);
report.times.B2_to_shelter = +((await t()) - t1).toFixed(2);
await walk(161.0);
await use();
await wait(120);
report.flags["shrine:2"] = await flag("shrine:2");
await shot("B3-shelter");
const t2 = await t();
await walk(172.4);
await expectRoom("B5");
report.times.B2_shelter_to_B5 = +((await t()) - t2).toFixed(2);
report.times.B2_walk = +(report.times.B2_to_shelter + report.times.B2_shelter_to_B5).toFixed(2);
note("B5: the culvert lever (S2), the hook down, the street into the market");
await walk(182.6);
await use();
await wait(200);
report.flags["lever:culvert"] = await flag("lever:culvert");
report.checks.gateState = await ev(() => window.__world.game.room.pixel?.world.find("culvert-gate")?.state);
await shot("B5-culvert-open");
await walk(186.4);
const th0 = await t();
await use();
await wait(900, "idle");
report.times.hookRide = +((await t()) - th0).toFixed(2);
report.checks.hookAtBottom = (await st()).y < -31;
await shot("B5-bottom");
// someone calls it up from the top (the top lever's signal), then the street's lever calls it back down
await walk(184.6);
await ev(() => window.__world.game.signal("crane", "call:0"));
await wait(900, "idle");
report.checks.hookSentUp = await ev(() => window.__world.game.room.prop("crane")?.at === 0);
report.checks.streetLever = (await use()).near;
await wait(40);
await wait(900, "idle");
report.checks.hookCalledDownFromStreet = await ev(() => window.__world.game.room.prop("crane")?.at === 1);
await walk(188.4);
await expectRoom("C1");
report.times.B1_to_C1 = +((await t()) - t0).toFixed(2);

note("reload: the bridge stays down, the gate stays open");
await open("manual");
await ev(() => window.__world.begin());
await ev(() => window.__world.teleport("B1", "channel-east"));
await wait(60);
report.checks.bridgeAfterReload = await ev(() => window.__world.game.room.pixel?.world.find("rope-bridge")?.state);
await walk(92.4);
report.checks.crossedOnDeckAfterReload = Math.abs((await st()).y - 0.2) < 0.05;
await ev(() => window.__world.teleport("B5", "culvert"));
await wait(60);
report.checks.gateAfterReload = await ev(() => window.__world.game.room.pixel?.world.find("culvert-gate")?.state);
note("S2: the ferry at Pier's End sails to the culvert now");
await ev(() => window.__world.teleport("A0", "west"));
await wait(60);
// the grey-box's stub boat, or the Ringwater lane's pixel-matter ferry (any placement whose door leads to S2)
const boat = await ev(() => {
  const g = window.__world.game;
  const o = g.room.def.origin?.[0] ?? 0;
  const b = g.room.props.find((p) => p.recipe === "boat");
  if (b) return { id: b.id, x: b.x / 80 + o, state: b.state };
  const id = Object.entries(g.room.def.doors ?? {}).find(([, t]) => t.room === "S2")?.[0];
  const px = id ? g.room.pixel?.world.find(id) : null;
  return px ? { id, x: px.x / 80 + o, state: px.state, pixel: true } : null;
});
report.checks.boat = boat;
if (boat) {
  await walk(boat.x);
  await use();
  await wait(2400, "room", "A0");
  const s = await st();
  report.checks.ferryArrives = s.room;
  if (s.room === "S2") {
    await wait(1400, "idle");
    await walk(34.5);
    report.checks.ferryLandsAt = (await st()).room;
  }
}
writeFileSync(`${OUT}/walk.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify({ times: report.times, flags: report.flags, checks: report.checks, errors }, null, 1));
await browser.close();

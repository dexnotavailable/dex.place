// Actual module probes for cleared storm sound and the bench reset action.
// Host repeat-sit, pixels and audible entry behavior require browser checks.
// node --experimental-transform-types src/world/tools/source-regressions.mjs
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
registerHooks({ load(url, ctx, next) {
  if (url.endsWith("?raw")) return { format: "module", shortCircuit: true, source: `export default ${JSON.stringify(readFileSync(new URL(url), "utf8"))}` };
  return next(url, ctx);
} });
const { spireStorm } = await import("../rooms/spire/storm-driver.ts");
const { STORM } = await import("../../pixel/props/spire/storm.ts");
const { PixelWorld } = await import("../../pixel/world.ts");
const { bench } = await import("../../pixel/props/bench.ts");
function stormRun(cleared) {
  const driver = spireStorm.build({ id: "storm", x: 0, y: 0, H: 80, strength: "rain" }, { texture: () => { throw new Error("unexpected texture"); } });
  const cues = [];
  const world = { rain: 0.55, flash: 0, reduced: false, player: { x: 0, y: 0, vx: 0 }, save: { get: (k) => cleared && k === "blade:cleared" }, sound: (id) => cues.push(id) };
  for (let frame = 0; frame < 60 * 27; frame++) {
    driver.update(world);
    world.rain += (0 - world.rain) / 60 * 0.35;
  }
  return { cues, finalStrength: STORM.strength, remainingRain: world.rain };
}
const storm = stormRun(false);
assert(storm.cues.includes("storm.tell") && storm.cues.includes("storm.gust"), "control must exercise the gust cycle");
const cleared = stormRun(true);
assert(cleared.remainingRain > 0, "fixture must retain asymptotic rain");
assert.equal(cleared.cues.length, 0, "cleared Blade must stop every storm cue");
assert.equal(cleared.finalStrength, 0);
const pw = new PixelWorld({ H: 80 });
const seat = pw.add(bench, { kind: "stone", length: 1.8 }, 100, 200, { id: "bench" });
seat.use(); assert.equal(seat.state, "sat");
seat.act("stand"); assert.equal(seat.state, "idle");
seat.use(); assert.equal(seat.state, "sat");
// E is only offered where it does something: lit candles have no prompt until a flame is out; a door you stand in
// front of beats a low neighbour whose centre is nearer your chest
const { candles } = await import("../../pixel/props/candles.ts");
const cw = new PixelWorld({ H: 80 });
const cd = cw.add(candles, { count: 3, layout: "row", stand: "none", lit: true }, 100, 200, { id: "cd" });
for (let i = 0; i < 4; i++) cw.step ? cw.step(1 / 60) : cd.update?.(1 / 60);
const nearCandles = (w) => w.nearestUsable(100, 200 - 40)?.id ?? null;
assert.equal(nearCandles(cw), null, "lit candles offer no E");
cd.go("out");
assert.equal(nearCandles(cw), "cd", "snuffed candles offer E");
const { door } = await import("../../pixel/props/door.ts");
const dw = new PixelWorld({ H: 80 });
const tall = dw.add(door, { variant: "stone" }, 300, 400, { id: "tall-door" });
const low = dw.add(bench, { kind: "stone", length: 1.8 }, 340, 400, { id: "low-bench" });
const tb = tall.bounds();
const stand = (tb.x0 + tb.x1) / 2;
assert.equal(dw.nearestUsable(stand, 400 - 40)?.id, "tall-door", "standing in a door's zone picks the door over a low neighbour");
void low;
const report = { at: new Date().toISOString(), passed: true, stormControl: storm.cues, cleared, bench: "idle -> sat -> idle -> sat", candles: "lit: no E, out: E", door: "zone beats centre distance", boundary: "actual source modules; host call and hardware/audio approval are separate" };
mkdirSync("review/world/phase2/resumption-20260930", { recursive: true });
writeFileSync("review/world/phase2/resumption-20260930/source-regressions.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));

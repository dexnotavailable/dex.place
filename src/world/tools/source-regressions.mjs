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
const report = { at: new Date().toISOString(), passed: true, stormControl: storm.cues, cleared, bench: "idle -> sat -> idle -> sat", boundary: "actual source modules; host call and hardware/audio approval are separate" };
mkdirSync("review/world/phase2/resumption-20260930", { recursive: true });
writeFileSync("review/world/phase2/resumption-20260930/source-regressions.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));

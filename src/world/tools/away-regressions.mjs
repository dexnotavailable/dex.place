// Real WorldGame.frame/setAway source methods; collaborators are counting
// fixtures. Raw imports and unused build-time discovery maps are adapted for
// Node. Native/public frame, audio and scrolling acceptance are separate.
import assert from "node:assert/strict";
import { registerHooks, stripTypeScriptTypes } from "node:module";
import { readFileSync } from "node:fs";

registerHooks({ load(url, context, next) {
  const u = new URL(url);
  if (u.search === "?raw") return { format: "module", shortCircuit: true, source: `export default ${JSON.stringify(readFileSync(u, "utf8"))}` };
  if (u.protocol === "file:" && u.pathname.endsWith(".ts")) return {
    format: "module", shortCircuit: true,
    source: stripTypeScriptTypes(readFileSync(u, "utf8").replaceAll("import.meta.glob", "(() => ({}))"), { mode: "transform", sourceUrl: url }),
  };
  return next(url, context);
} });

const { WorldGame } = await import("../game.ts");
const game = Object.create(WorldGame.prototype);
const counts = { tick: 0, render: 0, poll: 0, warm: 0, release: 0, audio: [] };
const room = { def: { id: "A1" }, built: true, backdrop: { poll() { throw new Error("current backdrop must not be polled here"); } } };
Object.assign(game, {
  away: false, last: -1, acc: 0, manual: false, frameMs: 0,
  fpsFrames: 0, fpsT0: 0, fps: 0, trans: null, loading: false, room,
  stream: { rooms: new Map([["A1", room], ["A2", { built: true, backdrop: { poll() { counts.poll++; } } }]]), warmOne(id) { assert.equal(id, "A1"); counts.warm++; } },
  audio: { setAway(value) { counts.audio.push(value); } },
  input: { releaseAll() { counts.release++; } },
  render() { counts.render++; }, realTick() { counts.tick++; },
});

game.frame(0);
game.frame(1000); // visible: bounded catch-up, rendering, polling and warming work.
assert(counts.tick > 0 && counts.render === 2 && counts.poll === 2 && counts.warm === 1);
const visible = { ...counts };
game.setAway(true);
assert.equal(counts.release, 1);
assert.deepEqual(counts.audio, [true]);
game.setAway(true); // idempotent notification does not reset/release twice.
assert.equal(counts.release, 1);
for (const now of [1016, 1600, 2400, 60000]) game.frame(now);
for (const key of ["tick", "render", "poll", "warm"]) assert.equal(counts[key], visible[key], `hidden ${key} must not run`);
assert.equal(game.acc, 0);
assert.equal(game.frameMs, 0);
assert.equal(game.fps, 0);

game.setAway(false);
assert.deepEqual(counts.audio, [true, false]);
game.frame(120000); // even a tab-suspension gap adds no hidden-time simulation.
assert.equal(counts.tick, visible.tick);
assert.equal(counts.render, visible.render + 1);
game.frame(120017);
assert.equal(counts.tick, visible.tick + 1);

game.setAway(true);
game.manual = true;
const beforeManual = counts.render;
game.frame(130000);
assert.equal(counts.render, beforeManual, "manual-mode frame must also skip hidden rendering");
game.setAway(false);
game.frame(140000);
assert.equal(counts.render, beforeManual + 1, "manual-mode visible frame still draws");
assert.equal(counts.tick, visible.tick + 1, "manual mode never advances simulation through RAF");
console.log(JSON.stringify({ pass: true, hiddenFrames: 5, counts, checks: ["visible control", "hidden tick/render/poll/warm zero", "idempotent release/audio", "no hidden-time catch-up", "normal next-tick resume", "manual hidden/visible"], boundary: "actual methods; renderer/audio/room collaborators mocked, native/public pending" }));

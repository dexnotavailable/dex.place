import { test } from "node:test";
import assert from "node:assert/strict";
import { validatePackage } from "../lab/contracts.ts";
import { validateAtlasImages, validateExportPair } from "../world/player/export-validation.ts";
import { loopFrameAt } from "../world/player/frames.ts";

const required = ["idle", "run", "sit"];
function packageAt(size) {
  return validatePackage({
    contract: "dex.sprite/1", name: `fixture ${size}`,
    atlases: [{ id: "body", albedo: "body.png", normal: null, width: size, height: size, shading: "baked" }],
    clips: required.map(id => ({ id, atlas: "body", loop: true, frames: [
      { rect: [0, 0, size, size], pivot: [size / 2, size], duration: 2, pose: `${id}-a` },
      { rect: [0, 0, size, size], pivot: [size / 2, size], duration: 4, hold: 1, pose: `${id}-b` },
    ] })),
  }, "test fixture");
}

test("missing exports keep the procedural preview; a synchronized native-size pair is accepted", () => {
  validateExportPair(null, null, required);
  const a = packageAt(80), b = packageAt(144);
  b.clips.reverse(); // clip lookup is by id; atlas geometry legitimately differs with resolution.
  validateExportPair(a, b, required);
});

for (const missing of ["world", "closeup"]) test(`partial ${missing} export cannot silently mix pipeline and stand-in`, () => {
  assert.throws(() => validateExportPair(missing === "world" ? null : packageAt(80), missing === "closeup" ? null : packageAt(144), required), /install both/);
});

test("both packages missing sit fails even when their clip sets match", () => {
  const a = packageAt(80), b = packageAt(144);
  a.clips.pop(); b.clips.pop();
  assert.throws(() => validateExportPair(a, b, required), /sit: missing/);
});

test("an additional attack must exist at both sizes", () => {
  const a = packageAt(80), b = packageAt(144);
  a.clips.push({ ...structuredClone(a.clips[0]), id: "m1_5" });
  assert.throws(() => validateExportPair(a, b, required), /m1_5: missing from 144px/);
});

test("a short close-up cannot drop the player at the final world frame", () => {
  const a = packageAt(80), b = packageAt(144);
  b.clips[0].frames.pop();
  assert.throws(() => validateExportPair(a, b, required), /idle: frame count differs/);
});

test("equal total ticks do not hide a different exposure/hold breakdown", () => {
  const a = packageAt(80), b = packageAt(144);
  b.clips[0].frames[1].duration = 3; b.clips[0].frames[1].hold = 2;
  assert.throws(() => validateExportPair(a, b, required), /duration\/hold differs/);
});

test("same-count reordered semantic frames fail", () => {
  const a = packageAt(80), b = packageAt(144);
  b.clips[0].frames[0].pose = "idle-b";
  assert.throws(() => validateExportPair(a, b, required), /phase\/pose order differs/);
});

test("unlabelled frames cannot falsely establish pair alignment", () => {
  const a = packageAt(80), b = packageAt(144);
  delete a.clips[0].frames[0].pose; delete b.clips[0].frames[0].pose;
  assert.throws(() => validateExportPair(a, b, required), /source pose key/);
});

test("matching frames do not hide conflicting clip loop/transition behavior", () => {
  const a = packageAt(80), b = packageAt(144);
  b.clips[0].loop = false; b.clips[0].next = "run";
  assert.throws(() => validateExportPair(a, b, required), /loop\/next differs/);
});

test("decoded albedo and normal dimensions must match manifest before GPU upload", () => {
  const atlas = { ...packageAt(80).atlases[0], normal: "body_n.png" };
  const correct = { naturalWidth: 80, naturalHeight: 80 };
  validateAtlasImages(atlas, correct, correct, "/world/character/");
  validateAtlasImages({ ...atlas, normal: null }, correct, null, "/world/character/");
  assert.throws(() => validateAtlasImages(atlas, { naturalWidth: 79, naturalHeight: 80 }, correct, "/world/character/"), /body.png: decoded 79x80/);
  assert.throws(() => validateAtlasImages(atlas, correct, { naturalWidth: 80, naturalHeight: 81 }, "/world/character/"), /body_n.png: decoded 80x81/);
  assert.throws(() => validateAtlasImages(atlas, correct, null, "/world/character/"), /declared normal map was not decoded/);
});

test("a seated pose respects hold ticks at exposure and wrap boundaries", () => {
  const [a, b] = packageAt(80).clips[2].frames;
  a.hold = 3; // first pose = 2 exposure + 3 hold; second = 4 exposure + 1 hold.
  assert.equal(loopFrameAt([a, b], 0), a);
  assert.equal(loopFrameAt([a, b], 4), a);
  assert.equal(loopFrameAt([a, b], 5), b);
  assert.equal(loopFrameAt([a, b], 9), b);
  assert.equal(loopFrameAt([a, b], 10), a);
  assert.equal(loopFrameAt([a, b], 24), a);
});

// The cast until its art exists (Dex 10-18: "white placeholder boxes at player height"): cast.json names real
// play-plane characters of the world, every box stands at Zhusha's drawn height (H x charScale), and a bad entry
// is refused.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { npcBox, npcSlot, validateCast } from "./cast/boxes.ts";
import { drawnH } from "./zhusha/units.ts";
import { buildWorld } from "./world/index.ts";
import { H } from "./config.ts";

const CAST = JSON.parse(readFileSync(join(import.meta.dirname, "cast/cast.json"), "utf8"));
const FEEL = JSON.parse(readFileSync(join(import.meta.dirname, "zhusha/feel.json"), "utf8"));

test("cast: cast.json is valid and names the world's characters on the play plane", () => {
  const cast = validateCast(CAST);
  const sprites = new Map(buildWorld().sprites.map((s) => [s.id, s]));
  for (const id of ["bao", "champion", "hanko", "seo"]) assert.ok(cast.npcs[id], `${id} is boxed`);
  for (const id of Object.keys(cast.npcs)) {
    const sp = sprites.get(id);
    assert.ok(sp, `${id}: no such sprite in the world`);
    assert.equal(sp.plane, "play", `${id}: boxes stand on the play plane, at her scale`);
  }
  // not cast (and not at her scale): left as drawn
  for (const id of ["hall-cat", "stands", "walker-wade"]) assert.equal(cast.npcs[id], undefined, id);
});

test("cast: every NPC box stands at her drawn height (H x charScale) in its resting frame", () => {
  const cast = validateCast(CAST);
  const body = drawnH(FEEL, H);
  assert.ok(Math.abs(body - 96 * FEEL.charScale) < 1e-9);
  for (const [id, e] of Object.entries(cast.npcs)) {
    const b = npcBox(e, body, 0);
    assert.equal(b.h, body, `${id} at frame 0`);
    assert.ok(b.w > 0);
    assert.equal(npcSlot(e, 0), null, `${id}: no art yet, the box`);
  }
  // people are as wide as her own box; the Lion keeps the length of its bout body in her heights (345 px at the 10-18
  // size 1.1; 20% less with her at 0.88, Dex 10-19 "NPCs 20% smaller the same way")
  assert.ok(Math.abs(npcBox(cast.npcs.seo, body, 0).w - FEEL.body.boxW * body) < 1e-9);
  assert.ok(Math.abs(npcBox(cast.npcs.champion, body, 0).w - 345 * FEEL.charScale / 1.1) < 1);
  // a pose squashes the box for a frame (the Lion's wind-up), then it is back at her height
  assert.ok(npcBox(cast.npcs.champion, body, 3).h < body);
  assert.equal(npcBox(cast.npcs.champion, body, 1).h, body);
});

test("cast: art slots map frames, and bad entries are refused", () => {
  const e = { who: "lion", w: 3, roles: { "3": "windup", "*": "idle" } };
  assert.equal(npcSlot(e, 3), "windup");
  assert.equal(npcSlot(e, 0), "idle");
  const bad = (n) => () => validateCast({ npcs: { x: { who: "x", w: 0.36, ...n } } });
  assert.throws(bad({ w: 0 }), /w must be/);
  assert.throws(bad({ who: "../x" }), /who/);
  assert.throws(bad({ roles: { a: "idle" } }), /roles key/);
  assert.throws(bad({ roles: { "1": "Idle Loop" } }), /slot name/);
  assert.throws(bad({ poses: { "1": { sy: 0 } } }), /poses/);
  assert.throws(bad({ poses: { "1": { tilt: 1 } } }), /poses/);
  assert.throws(() => validateCast({}), /no npcs/);
});

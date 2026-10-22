// The see-through gate (cutoffs 10-21, round 4; the critic's round-3 notes): an edit that thins her drawings must not
// punch holes into them. Round 1's heals left a 50% screen-door through the ult finisher's ghost sword (uf_m1_4 f014),
// ate her blade's tip (uf_jump_arc f003-f004) and opened hairline gaps and holes inside the ult Q's field
// (uf_skill_q f010-f013), and an audit that only looked at edges missed it. tools/zhusha/seethrough.mjs looks inside.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ASSETS, NEW_CHK, drawings, judge, loadBaseline, scanMask, scanPng } from "../../tools/zhusha/seethrough.mjs";

/** a w x h mask from rows of "#" (opaque) and "." */
const mask = (rows) => {
  const h = rows.length, w = rows[0].length, m = new Uint8Array(w * h);
  rows.forEach((r, y) => [...r].forEach((c, x) => (m[y * w + x] = c === "#" ? 1 : 0)));
  return [m, w, h];
};

test("see-through: a solid shape scans clean; a 50% screen-door, a pinprick and a hairline gap each show", () => {
  const solid = Array.from({ length: 12 }, () => "." + "#".repeat(14) + ".");
  assert.deepEqual(scanMask(...mask(solid)), [0, 0, 0], "a filled block: nothing");
  const door = solid.map((r, y) => [...r].map((c, x) => (c === "#" && x > 3 && x < 12 && y > 2 && y < 9 && (x + y) % 2 ? "." : c)).join(""));
  const [chk] = scanMask(...mask(door));
  assert.ok(chk >= 20, `a dithered band is a screen-door (${chk} checker cells)`);
  const pin = solid.map((r, y) => (y === 5 ? r.slice(0, 7) + "." + r.slice(8) : r));
  assert.deepEqual(scanMask(...mask(pin)).slice(1), [1, 1], "one pinprick");
  const hair = solid.map((r, y) => (y === 6 ? r.slice(0, 3) + "......" + r.slice(9) : r));
  const [, p2, gap] = scanMask(...mask(hair));
  assert.equal(p2, 0, "a hairline is not a pinprick");
  assert.equal(gap, 6, "but the closing covers all of it");
});

test("see-through: none of her drawings (nor the carried trails) is more see-through than its baseline", () => {
  const base = loadBaseline();
  const list = drawings();
  assert.ok(list.length > 600, `her drawings are scanned (${list.length})`);
  const bad = list.flatMap((rel) => judge(rel, scanPng(readFileSync(join(ASSETS, rel))), base.get(rel)));
  assert.deepEqual(bad, [], "re-made on purpose? look at it, then node tools/zhusha/seethrough.mjs --write");
});

test("see-through: the gate refuses round 1's damage (uf_m1_4 f014's screen-door, uf_skill_q f012's holes)", () => {
  const base = loadBaseline();
  // the drawings as round 1 left them (still so at round 3's head, 826552d6), by their scans
  assert.ok(judge("zhusha/uf_m1_4/f014.png", [61, 87, 604], base.get("zhusha/uf_m1_4/f014.png")).length >= 3);
  assert.ok(judge("zhusha/uf_jump_arc/f011.png", [23, 50, 303], base.get("zhusha/uf_jump_arc/f011.png")).length >= 3);
  assert.ok(judge("zhusha/uf_skill_q/f012.png", [0, 45, 1060], base.get("zhusha/uf_skill_q/f012.png")).length >= 2);
  assert.ok(judge("zhusha/uf_jump_arc/f004.png", [3, 13, 139], base.get("zhusha/uf_jump_arc/f004.png")).length >= 2, "her blade's tip");
  assert.equal(judge("zhusha/new_move/f000.png", [NEW_CHK + 1, 0, 0], undefined).length, 1, "a new drawing: no screen-door");
  assert.equal(judge("zhusha/new_move/f000.png", [3, 40, 900], undefined).length, 0, "but its own texture is its own");
});

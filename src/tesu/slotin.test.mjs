// The slot-in tool (tools/zhusha/slot-in.mjs): a finished 128 px move passes; anything not stage "pixel", any
// drawing whose figure is not 128 px (or unmeasured), and anything that looks like an H3 render is refused.
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkDrawing, checkMove, ensureRole, readPng, underH3, writePng } from "../../tools/zhusha/slotin-lib.mjs";

const TOOL = join(import.meta.dirname, "../../tools/zhusha/slot-in.mjs");

/** A drawing: a w x h frame, transparent backdrop, a figure of `cols` colours (opaque: no backdrop at all). */
function drawing(w = 120, h = 160, { cols = 24, opaque = false } = {}) {
  const d = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4, inside = opaque || (x > w * 0.3 && x < w * 0.7 && y > h * 0.1 && y < h * 0.95);
      if (!inside) continue;
      const k = (x * 7 + y * 13) % cols;
      d[i] = (k * 37) & 255; d[i + 1] = (k * 91 + (k >> 8)) & 255; d[i + 2] = (k * 53 + (k >> 4) * 17) & 255; d[i + 3] = 255;
    }
  }
  return writePng(w, h, d);
}

function move(o = {}, frames = null) {
  const dir = mkdtempSync(join(tmpdir(), "slotin-"));
  const fr = frames ?? [0, 1, 2].map((i) => ({ file: `f00${i}.png`, ticks: 4, fig: 128 }));
  for (const f of fr) writeFileSync(join(dir, f.file), f.png ?? drawing());
  const def = { id: "m1_1", stage: "pixel", frames: fr.map(({ png, ...f }) => f), pivot: [60, 152], figure_h: 128, hits: [1], source: "h3-L-m1_1-A-s3003-90764d", ...o };
  writeFileSync(join(dir, "anim.json"), JSON.stringify(def));
  return dir;
}

test("slot-in: PNGs read back as written; animated PNGs are seen", () => {
  const d = new Uint8Array(3 * 2 * 4).map((_, i) => (i * 29) & 255);
  const back = readPng(writePng(3, 2, d));
  assert.deepEqual([back.w, back.h, back.animated], [3, 2, false]);
  assert.deepEqual([...back.rgba], [...d]);
  assert.equal(readPng(writePng(3, 2, d, { animated: true })).animated, true);
});

test("slot-in: a finished 128 px move passes", () => {
  const r = checkMove("m1_1", move());
  assert.deepEqual(r.problems, []);
  assert.ok(r.ok);
  assert.deepEqual(r.files, ["f000.png", "f001.png", "f002.png", "anim.json"]);
});

test("slot-in: refuses anything not stage pixel, not 128 px, or with an unmeasured drawing", () => {
  const no = (dir, re) => { const r = checkMove("m1_1", dir); assert.equal(r.ok, false); assert.ok(r.problems.some((p) => re.test(p)), r.problems.join(" | ")); };
  no(move({ stage: "placeholder" }), /stage "placeholder"/);
  no(move({ figure_h: 192 }), /figure_h 192/);
  no(move({ key: [89, 115, 99] }), /key/);
  no(move({}, [{ file: "f000.png", ticks: 4, fig: 128 }, { file: "f001.png", ticks: 4, fig: 192 }]), /figure 192 px/);
  no(move({}, [{ file: "f000.png", ticks: 4, fig: 128 }, { file: "f001.png", ticks: 4 }]), /no measured figure/);
  no(move({ id: "m1_2" }), /id "m1_2"/);
});

test("slot-in: refuses what looks like an H3 render", () => {
  const no = (png, re) => { const p = checkDrawing(png, "f000.png"); assert.ok(p.some((x) => re.test(x)), p.join(" | ")); };
  no(drawing(120, 160, { opaque: true }), /no transparent backdrop/);
  no(writePng(4, 4, new Uint8Array(64), { animated: true }), /animated PNG/);
  no(drawing(768, 1344), /H3 frame's size/);
  no(drawing(140, 170, { cols: 400 }), /more than 256 colours/);
  no(Buffer.from("not a png at all"), /not a PNG/);
  assert.ok(underH3("D:/Dex/Temp/dexplace-v2/lanes/anim/gen-method/mass/h3/takes/m1_1"));
  assert.ok(!underH3("D:/Dex/Temp/dexplace-v2/lanes/anim/moves/m1_1/final"));
  const r = checkMove("m1_1", move({}, [{ file: "f000.png", ticks: 4, fig: 128, png: drawing(120, 160, { opaque: true }) }]));
  assert.equal(r.ok, false);
});

test("slot-in: dropped and unknown slots are refused; a slot no role plays gets one", () => {
  assert.ok(checkMove("e_hold", move({ id: "e_hold" })).problems.some((p) => /dropped by Dex/.test(p)));
  assert.ok(checkMove("m9_9", move({ id: "m9_9" })).problems.some((p) => /not a slot/.test(p)));
  const slots = { roles: { idle: { normal: "idle", ult: "uf_idle" } } };
  assert.equal(ensureRole(slots, "uf_idle"), null);
  assert.equal(ensureRole(slots, "opening_ofuda"), "opening_ofuda");
  assert.deepEqual(slots.roles.opening_ofuda, { normal: "opening_ofuda", ult: null });
  assert.equal(ensureRole(slots, "uf_run"), "uf_run");
  assert.deepEqual(slots.roles.uf_run, { normal: null, ult: "uf_run" });
});

test("slot-in: the command checks a move dry (exit 0) and refuses a bad one (exit 2) without touching the game", () => {
  const ok = spawnSync(process.execPath, [TOOL, "m1_1", "--from", move(), "--dry"], { encoding: "utf8" });
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /passes the contract/);
  const bad = move({ figure_h: 192 });
  mkdirSync(join(bad, "extra"), { recursive: true });
  const no = spawnSync(process.execPath, [TOOL, "m1_1", "--from", bad, "--dry"], { encoding: "utf8" });
  assert.equal(no.status, 2);
  assert.match(no.stderr, /REFUSED .*figure_h 192/);
});

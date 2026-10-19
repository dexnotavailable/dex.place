// Shared by tools/zhusha/derive.mjs and the tests: derives every slotted attack (the roles feel.json times as moves,
// in both forms) from public/assets/zhusha/<slot>/ with src/tesu/zhusha/derive.ts, and prints derived.json's text.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { deriveSlot } from "../../src/tesu/zhusha/derive.ts";
import { readPng } from "./slotin-lib.mjs";

/** The attack slots present in the game (every slot a move role plays, normal and ult form), sorted. */
export function attackSlots(repo) {
  const feel = JSON.parse(readFileSync(join(repo, "src/tesu/zhusha/feel.json"), "utf8"));
  const slots = JSON.parse(readFileSync(join(repo, "src/tesu/zhusha/slots.json"), "utf8"));
  const out = new Set();
  for (const role of Object.keys(feel.moves)) {
    const r = slots.roles[role];
    for (const id of [r?.normal, r?.ult]) if (id && existsSync(join(repo, "public/assets/zhusha", id, "anim.json"))) out.add(id);
  }
  return [...out].sort();
}

/** derived.json's content for the drawings as they are now. */
export function derivedFor(repo) {
  const slots = {};
  for (const id of attackSlots(repo)) {
    const dir = join(repo, "public/assets/zhusha", id);
    const def = JSON.parse(readFileSync(join(dir, "anim.json"), "utf8"));
    const imgs = def.frames.map((f) => {
      const p = readPng(readFileSync(join(dir, f.file)));
      return { w: p.w, h: p.h, data: p.rgba };
    });
    slots[id] = deriveSlot(id, def, imgs);
  }
  return {
    about: "Derived from the drawings by tools/zhusha/derive.mjs (src/tesu/zhusha/derive.ts); never edit by hand, re-run the tool after a slot-in. Per attack slot and drawing: the energy in front of her (area, how much is new: sweep), whether it is an active drawing, the hit boxes over it ([x0, y0, x1, y1] art px from the pivot, facing right, y negative up), how far her planted foot says she moved (root, art px), her ground contacts (feet).",
    slots,
  };
}

/** derived.json's text: one line per drawing, short arrays inline. */
export function derivedText(d) {
  const L = ["{", `  "about": ${JSON.stringify(d.about)},`, `  "slots": {`];
  const ids = Object.keys(d.slots);
  ids.forEach((id, si) => {
    const s = d.slots[id];
    L.push(`    ${JSON.stringify(id)}: {`);
    L.push(`      "slot": ${JSON.stringify(s.slot)}, "hash": ${JSON.stringify(s.hash)}, "ticks": ${JSON.stringify(s.ticks)},`);
    L.push(`      "hits": ${JSON.stringify(s.hits)},`);
    L.push(`      "frames": [`);
    s.frames.forEach((f, i) => L.push(`        ${JSON.stringify(f)}${i < s.frames.length - 1 ? "," : ""}`));
    L.push("      ]");
    L.push(`    }${si < ids.length - 1 ? "," : ""}`);
  });
  L.push("  }", "}");
  return `${L.join("\n")}\n`;
}

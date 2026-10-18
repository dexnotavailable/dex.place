// The slot-in checks (tools/zhusha/slot-in.mjs runs them; src/tesu/slotin.test.mjs proves them): what may go
// from a finished move folder (lanes/anim/moves/<slot>/final/) into public/assets/zhusha/<slot>/.
//
// Refused: anything not stage "pixel" or not 128 px (the game's own contract, src/tesu/zhusha/contract.ts),
// any drawing without its measured figure (`fig`, the kit's pose model) or whose figure is not 128 px, and
// anything that looks like an H3 render: an animated PNG (the takes are APNGs), an opaque frame (nothing keyed),
// a frame at a take's size, more than 256 colours (the master palette), a big file, a folder under the H3 tree.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { deflateSync, inflateSync } from "node:zlib";
import { FIG_TOL, FIGURE_H, validateAnim } from "../../src/tesu/zhusha/contract.ts";

/** Slots the game has (lanes/anim/SPRITE-CONTRACT.md); dropped by Dex: run_start, e_hold, uf_run_start, uf_run_stop. */
export const SLOTS = [
  "idle", "walk", "run", "run_stop", "jump_arc", "dash", "m1_1", "m1_2", "m1_3", "m1_4", "m1_1_ret", "m1_2_ret", "m1_3_ret",
  "guard_to_rest", "skill_q", "e_tap", "hurt", "ko_trip", "defeat", "respawn", "r_call", "r_flurry", "r_reveal", "transform",
  "opening_ofuda", "uf_idle", "uf_run", "uf_jump_arc", "uf_dash", "uf_m1_1", "uf_m1_2", "uf_m1_3", "uf_m1_4", "uf_m1_1_tail",
  "uf_m1_2_tail", "uf_m1_3_tail", "uf_skill_q", "uf_hurt", "uf_defeat",
];
export const DROPPED = ["run_start", "e_hold", "uf_run_start", "uf_run_stop"];

/** Limits for one drawing. */
export const LIMITS = { maxBytes: 200_000, maxSide: 512, maxColours: 256, minClear: 0.05 };
/** The H3 takes' frame sizes (768 x 1344 portrait, 1344 x 768 landscape). */
const TAKE_SIZES = [[768, 1344], [1344, 768]];

const SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

/** Reads a PNG's chunks and decodes 8-bit, non-interlaced images to RGBA. Throws on anything else. */
export function readPng(buf) {
  if (buf.length < 8 || !buf.subarray(0, 8).equals(SIG)) throw new Error("not a PNG");
  let p = 8, ihdr = null, plte = null, trns = null;
  const idat = [], types = [];
  while (p + 8 <= buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString("latin1", p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    types.push(type);
    if (type === "IHDR") ihdr = { w: data.readUInt32BE(0), h: data.readUInt32BE(4), depth: data[8], colour: data[9], interlace: data[12] };
    else if (type === "PLTE") plte = data;
    else if (type === "tRNS") trns = data;
    else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    p += 12 + len;
  }
  if (!ihdr) throw new Error("PNG without IHDR");
  const animated = types.includes("acTL") || types.includes("fcTL");
  const { w, h, depth, colour, interlace } = ihdr;
  if (depth !== 8) throw new Error(`PNG bit depth ${depth} (8-bit only)`);
  if (interlace) throw new Error("interlaced PNG");
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colour];
  if (!ch) throw new Error(`PNG colour type ${colour}`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * ch, out = Buffer.alloc(w * h * 4);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? line[i - ch] : 0, b = prev[i], c = i >= ch ? prev[i - ch] : 0;
      let v = line[i];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const q = a + b - c, pa = Math.abs(q - a), pb = Math.abs(q - b), pc = Math.abs(q - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      line[i] = v & 255;
    }
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4, s = x * ch;
      if (colour === 6) line.copy(out, o, s, s + 4);
      else if (colour === 2) { out[o] = line[s]; out[o + 1] = line[s + 1]; out[o + 2] = line[s + 2]; out[o + 3] = 255; }
      else if (colour === 0) { out[o] = out[o + 1] = out[o + 2] = line[s]; out[o + 3] = 255; }
      else if (colour === 4) { out[o] = out[o + 1] = out[o + 2] = line[s]; out[o + 3] = line[s + 1]; }
      else {
        const k = line[s];
        out[o] = plte?.[k * 3] ?? 0; out[o + 1] = plte?.[k * 3 + 1] ?? 0; out[o + 2] = plte?.[k * 3 + 2] ?? 0;
        out[o + 3] = trns && k < trns.length ? trns[k] : 255;
      }
    }
    prev = line;
  }
  return { w, h, rgba: out, animated, colour };
}

/** Writes an 8-bit RGBA PNG (fixtures, tests). */
export function writePng(w, h, rgba, { animated = false } = {}) {
  const crcT = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
  const crc = (b) => { let c = -1; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
  const chunk = (type, data) => {
    const t = Buffer.from(type, "latin1"), len = Buffer.alloc(4), c = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    c.writeUInt32BE(crc(Buffer.concat([t, data])));
    return Buffer.concat([len, t, data, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  const parts = [SIG, chunk("IHDR", ihdr)];
  if (animated) parts.push(chunk("acTL", Buffer.from([0, 0, 0, 1, 0, 0, 0, 0])));
  parts.push(chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0)));
  return Buffer.concat(parts);
}

/** One drawing's problems (empty: it may ship). */
export function checkDrawing(buf, name) {
  const bad = [];
  if (buf.length > LIMITS.maxBytes) bad.push(`${name}: ${buf.length} bytes (a 128 px drawing is under ${LIMITS.maxBytes})`);
  let img;
  try {
    img = readPng(buf);
  } catch (e) {
    return [...bad, `${name}: ${e.message}`];
  }
  if (img.animated) bad.push(`${name}: an animated PNG (an H3 take), not a drawing`);
  if (TAKE_SIZES.some(([w, h]) => img.w === w && img.h === h)) bad.push(`${name}: ${img.w} x ${img.h} is an H3 frame's size`);
  if (img.w > LIMITS.maxSide || img.h > LIMITS.maxSide) bad.push(`${name}: ${img.w} x ${img.h} px is too big for 128 px art (max ${LIMITS.maxSide})`);
  const n = img.w * img.h, cols = new Set();
  let clear = 0;
  for (let i = 0; i < n; i++) {
    const a = img.rgba[i * 4 + 3];
    if (a < 128) { clear++; continue; }
    if (cols.size <= LIMITS.maxColours) cols.add((img.rgba[i * 4] << 16) | (img.rgba[i * 4 + 1] << 8) | img.rgba[i * 4 + 2]);
  }
  if (clear / Math.max(1, n) < LIMITS.minClear) bad.push(`${name}: no transparent backdrop (an unkeyed render)`);
  if (cols.size > LIMITS.maxColours) bad.push(`${name}: more than ${LIMITS.maxColours} colours (not on the master palette)`);
  if (clear === n) bad.push(`${name}: empty`);
  return bad;
}

/** Is `dir` inside the H3 tree (takes, post, renders)? */
export function underH3(dir) {
  const d = resolve(dir).toLowerCase().split(sep).join("/");
  return /\/gen-method\/mass\/h3(\/|$)/.test(d) || /\/h3\/(takes|post|out|renders?)(\/|$)/.test(d);
}

/**
 * Checks a finished move folder for `slot`. Returns { ok, problems, def, files } (files: the drawings to copy,
 * in play order, plus anim.json).
 */
export function checkMove(slot, dir) {
  const problems = [];
  if (!SLOTS.includes(slot)) problems.push(DROPPED.includes(slot) ? `${slot}: dropped by Dex` : `${slot}: not a slot of hers`);
  if (underH3(dir)) problems.push(`${dir}: under the H3 tree; only a finished move folder (lanes/anim/moves/<slot>/final/) slots in`);
  const aj = join(dir, "anim.json");
  if (!existsSync(aj)) return { ok: false, problems: [...problems, `${dir}: no anim.json`], def: null, files: [] };
  let def = null;
  try {
    def = validateAnim(JSON.parse(readFileSync(aj, "utf8")), slot);
  } catch (e) {
    problems.push(e.message);
  }
  const files = [];
  if (def) {
    def.frames.forEach((f, i) => {
      if (f.fig === undefined) problems.push(`frame ${i} (${f.file}): no measured figure ("fig": the kit's skull-to-sole in art px, ${FIGURE_H} +- ${FIG_TOL})`);
      const p = join(dir, f.file);
      if (!existsSync(p)) { problems.push(`frame ${i}: ${f.file} missing`); return; }
      problems.push(...checkDrawing(readFileSync(p), f.file));
      files.push(f.file);
    });
    const [px, py] = def.pivot;
    const first = files[0] ? readPng(readFileSync(join(dir, files[0]))) : null;
    if (first && (px < 0 || py < 0 || px > first.w || py > first.h)) problems.push(`pivot [${px}, ${py}] is outside the ${first.w} x ${first.h} drawing`);
  }
  const extra = existsSync(dir) ? readdirSync(dir).filter((f) => f !== "anim.json" && !files.includes(f) && statSync(join(dir, f)).isFile()) : [];
  return { ok: problems.length === 0, problems, def, files: [...files, "anim.json"], extra };
}

/** Adds a role for a slot no role plays yet (slots.json); returns the role added or null. */
export function ensureRole(slots, slot) {
  const used = Object.values(slots.roles).some((r) => r.normal === slot || r.ult === slot);
  if (used) return null;
  const ult = slot.startsWith("uf_");
  slots.roles[slot] = { normal: ult ? null : slot, ult: ult ? slot : null };
  return slot;
}

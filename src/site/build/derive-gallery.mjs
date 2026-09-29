// Prep step for the gallery: smaller copies of each piece for responsive
// images (srcset), so phones never download the 2048px display file just to
// show a collage tile.
//
//   npm run gallery:derive            make any missing sizes, update the manifest
//   npm run gallery:derive -- --force remake every size
//
// Needs ImageMagick 7 (`magick` on PATH, or DEX_MAGICK=<path to magick.exe>).
// Run it after adding a piece to content/gallery/manifest.json; the build then
// checks that every listed size exists (src/site/build/content.ts).
//
// Dex's art rules (content/gallery/manifest.json): the copies are the same
// picture, only fewer pixels. Lossless WebP (every output pixel is exactly
// the resampled value, no colour change, no chroma subsampling), full frame
// (no crop), aspect kept, and the source's ICC profile carried over byte for
// byte (or none, when the source has none). Each copy is checked for that
// before the manifest lists it.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Candidate widths. A size is skipped when it is within 10% of the source width (the source itself is the top candidate). */
export const WIDTHS = [160, 384, 512, 560, 640, 960, 1280];

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const manifestFile = path.join(root, "content", "gallery", "manifest.json");
const publicDir = path.join(root, "public");
const MAGICK = process.env.DEX_MAGICK || "magick";
const force = process.argv.includes("--force");

const magick = (args) => execFileSync(MAGICK, args, { encoding: "utf8", maxBuffer: 64 << 20 });

/** RIFF chunks of a WebP file: [{ id, data }]. */
function chunks(file) {
  const buf = fs.readFileSync(file);
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WEBP") throw new Error(`${file} is not a WebP file`);
  const out = [];
  for (let at = 12; at + 8 <= buf.length; ) {
    const id = buf.toString("ascii", at, at + 4);
    const size = buf.readUInt32LE(at + 4);
    out.push({ id, data: buf.subarray(at + 8, at + 8 + size) });
    at += 8 + size + (size & 1);
  }
  return out;
}

const icc = (file) => chunks(file).find((c) => c.id === "ICCP")?.data ?? null;
const lossless = (file) => chunks(file).some((c) => c.id === "VP8L") && !chunks(file).some((c) => c.id === "VP8 ");

function stats(file) {
  const [w, h, r, g, b] = magick([file, "-format", "%w %h %[fx:mean.r] %[fx:mean.g] %[fx:mean.b]", "info:"]).trim().split(/\s+/).map(Number);
  return { w, h, mean: [r, g, b] };
}

export const variantPath = (src, width) => src.replace(/\.webp$/, `-${width}.webp`);

function derive(item) {
  const srcFile = path.join(publicDir, item.src);
  const source = stats(srcFile);
  if (source.w !== item.width || source.h !== item.height) {
    throw new Error(`${item.src} is ${source.w}x${source.h}, manifest says ${item.width}x${item.height}`);
  }
  const srcIcc = icc(srcFile);
  const made = [];
  for (const width of WIDTHS) {
    if (width >= item.width * 0.9) continue;
    const outFile = path.join(publicDir, variantPath(item.src, width));
    const fresh = fs.existsSync(outFile) && fs.statSync(outFile).mtimeMs >= fs.statSync(srcFile).mtimeMs;
    if (force || !fresh) {
      // Lanczos in the file's own (sRGB) encoding, like the display files and thumbnails.
      magick([srcFile, "-filter", "Lanczos", "-resize", `${width}x`,
        "-define", "webp:lossless=true", "-define", "webp:exact=true", "-define", "webp:method=6", "-quality", "100", outFile]);
    }
    // Verify before listing: size, aspect, lossless, ICC, colour.
    const out = stats(outFile);
    const wantH = Math.round((item.height * width) / item.width);
    if (out.w !== width || Math.abs(out.h - wantH) > 1) throw new Error(`${outFile}: ${out.w}x${out.h}, expected ${width}x${wantH}`);
    if (!lossless(outFile)) throw new Error(`${outFile} is not lossless WebP`);
    const outIcc = icc(outFile);
    if (Boolean(srcIcc) !== Boolean(outIcc) || (srcIcc && !srcIcc.equals(outIcc))) throw new Error(`${outFile}: ICC profile differs from ${item.src}`);
    const drift = Math.max(...out.mean.map((m, i) => Math.abs(m - source.mean[i]))) * 255;
    if (drift > 1) throw new Error(`${outFile}: mean colour drifts ${drift.toFixed(2)} levels from ${item.src}`);
    made.push({ width, bytes: fs.statSync(outFile).size, drift });
  }
  return made;
}

function main() {
  const text = fs.readFileSync(manifestFile, "utf8");
  const manifest = JSON.parse(text);
  const lines = [];
  // One ImageMagick at a time per piece keeps memory sane; pieces in parallel would need a pool.
  for (const item of manifest.items) {
    const made = derive(item);
    item.widths = made.map((m) => m.width);
    lines.push(`${item.id}  ${made.map((m) => `${m.width}w ${Math.round(m.bytes / 1024)}K`).join("  ")}`);
  }
  // Number lists (widths) on one line, like the rest of the hand-written file.
  const json = JSON.stringify(manifest, null, 2).replace(/\[\s*([\d,\s]+?)\s*\]/g, (_, list) => `[${list.split(/[\s,]+/).join(", ")}]`);
  const next = `${json}\n`;
  if (next !== text) fs.writeFileSync(manifestFile, next);
  console.log(lines.join(os.EOL));
  console.log(next !== text ? "manifest updated" : "manifest unchanged");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { PNG } from "pngjs";

const sourcePath = resolve(process.argv[2] ?? "design/reference/summer-2026-selected.png");
const implementationPath = resolve(process.argv[3] ?? "design/proof/home-desktop-brave.png");
const outputPath = resolve(process.argv[4] ?? "design/proof/comparison.png");

const source = PNG.sync.read(readFileSync(sourcePath));
const implementation = PNG.sync.read(readFileSync(implementationPath));

if (source.height !== implementation.height) {
  throw new Error(`Comparison inputs must share a height: ${source.height} != ${implementation.height}`);
}

const gutter = 24;
const comparison = new PNG({
  width: source.width + gutter + implementation.width,
  height: source.height,
  colorType: 6,
});

PNG.bitblt(source, comparison, 0, 0, source.width, source.height, 0, 0);
PNG.bitblt(
  implementation,
  comparison,
  0,
  0,
  implementation.width,
  implementation.height,
  source.width + gutter,
  0,
);

for (let x = source.width; x < source.width + gutter; x += 1) {
  for (let y = 0; y < comparison.height; y += 1) {
    const index = (comparison.width * y + x) << 2;
    comparison.data[index] = 216;
    comparison.data[index + 1] = 31;
    comparison.data[index + 2] = 58;
    comparison.data[index + 3] = 255;
  }
}

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, PNG.sync.write(comparison));
console.log(outputPath);

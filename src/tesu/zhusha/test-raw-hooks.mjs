// Node module hooks for the tests only: Vite's `?raw` imports (feel.json?raw) as a module whose default export is
// the file's text, so node --test can load the real controller (zhusha.test.mjs registers this file).
import { readFile } from "node:fs/promises";

export async function resolve(specifier, context, next) {
  if (specifier.endsWith("?raw")) {
    const url = new URL(specifier.slice(0, -4), context.parentURL);
    return { url: `${url.href}?raw`, shortCircuit: true };
  }
  return next(specifier, context);
}

export async function load(url, context, next) {
  if (url.endsWith("?raw")) {
    const text = await readFile(new URL(url.slice(0, -4)), "utf8");
    return { format: "module", source: `export default ${JSON.stringify(text)};`, shortCircuit: true };
  }
  return next(url, context);
}

// Tiny HTML string helpers for build-time rendering. DOM-free.

export function esc(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Two-digit counter text: 3 -> "03". */
export const pad2 = (n: number): string => String(n).padStart(2, "0");

/** Joins truthy class names. */
export const cx = (...names: (string | false | null | undefined)[]): string => names.filter(Boolean).join(" ");

/** Seeded PRNG (mulberry32) from a string, so decorative layouts are stable between builds. */
export function rng(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i += 1) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

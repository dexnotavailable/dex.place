import { test } from "node:test";
import assert from "node:assert/strict";
import { initSharpen } from "./motion/piece.ts";

// Exercise actual enhancement decisions: a cache hit must not launch a large
// uncached request, and a successful upgrade must leave other screen caps alone.
function fixture(t, { cached = false, saveData = false, now = 100, decodeFails = false } = {}) {
  const requests = [];
  const sources = ["phone", "desktop"].map((media) => ({
    media, srcset: "/gallery/05-512.webp 512w", hasAttribute: () => true,
  }));
  const img = {
    complete: true, naturalWidth: 512, currentSrc: "http://site.test/gallery/05-512.webp",
    srcset: "/gallery/05-512.webp 512w, /gallery/05-1280.webp 1280w, /gallery/05.webp 2048w",
    dataset: { bytes: "150000 900000 1800000" },
    parentElement: { querySelectorAll: () => sources },
    getBoundingClientRect: () => ({ width: 1000 }),
  };
  const values = {
    document: { querySelector: () => img },
    navigator: { connection: { saveData } },
    location: { href: "http://site.test/gallery/05/" },
    devicePixelRatio: 1,
    matchMedia: (media) => ({ matches: media === "desktop" }),
    performance: { now: () => now, getEntriesByName: () => [{
      transferSize: cached ? 0 : 150300, encodedBodySize: 150000,
      responseStart: 20, responseEnd: 30, requestStart: 10,
    }] },
    Image: class {
      set src(url) { requests.push(url); }
      decode() { return decodeFails ? Promise.reject(new Error("offline")) : Promise.resolve(); }
    },
  };
  for (const [name, value] of Object.entries(values)) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, value });
    t.after(() => previous ? Object.defineProperty(globalThis, name, previous) : delete globalThis[name]);
  }
  return { requests, sources };
}

test("piece sharpening: cached preview with unknown throughput keeps its cap", (t) => {
  const { requests } = fixture(t, { cached: true });
  initSharpen();
  assert.deepEqual(requests, []);
});

test("piece sharpening: Save-Data and late loads request no upgrade", (t) => {
  const { requests } = fixture(t, { saveData: true });
  initSharpen();
  assert.deepEqual(requests, []);
  navigator.connection.saveData = false;
  performance.now = () => 2100;
  initSharpen();
  assert.deepEqual(requests, []);
});

test("piece sharpening: decoded upgrade changes only the active screen source", async (t) => {
  const { requests, sources } = fixture(t);
  initSharpen();
  await Promise.resolve();
  assert.deepEqual(requests, ["http://site.test/gallery/05-1280.webp"]);
  assert.equal(sources[0].srcset, "/gallery/05-512.webp 512w");
  assert.equal(sources[1].srcset, "http://site.test/gallery/05-1280.webp 1280w");
});

test("piece sharpening: failed decode preserves the painted copy", async (t) => {
  const { sources } = fixture(t, { decodeFails: true });
  initSharpen();
  await Promise.resolve();
  assert.ok(sources.every((s) => s.srcset === "/gallery/05-512.webp 512w"));
});

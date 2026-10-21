// (Dex 10-21: the opening "lags like hell") an effect drawing fetched, decoded and cut into its cells off the main
// thread (fx/contract.ts fxCells); the page only pastes the cells on its atlas pages. One message per drawing:
// { n, url } in, { n, w, h, cells } or { n, error } out (the cells' pixels transferred, not copied).
import { fxCells } from "./contract.ts";

let scratch: OffscreenCanvas | null = null;
let g: OffscreenCanvasRenderingContext2D | null = null;

self.onmessage = async (e: MessageEvent<{ n: number; url: string }>) => {
  const { n, url } = e.data;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`could not load ${url} (HTTP ${res.status})`);
    const bmp = await createImageBitmap(await res.blob());
    const w = bmp.width, h = bmp.height;
    if (!scratch || !g) {
      scratch = new OffscreenCanvas(w, h);
      g = scratch.getContext("2d", { willReadFrequently: true })!;
    }
    scratch.width = w;
    scratch.height = h;
    g.clearRect(0, 0, w, h);
    g.drawImage(bmp, 0, 0);
    bmp.close();
    const cells = fxCells(g.getImageData(0, 0, w, h).data, w, h);
    (self as unknown as Worker).postMessage({ n, w, h, cells }, cells.map((c) => c.px.buffer as ArrayBuffer));
  } catch (err) {
    (self as unknown as Worker).postMessage({ n, error: err instanceof Error ? err.message : String(err) });
  }
};

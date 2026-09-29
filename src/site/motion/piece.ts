// Piece pages (render/gallery.ts piecePage): sharpen the big image when the
// line allows it.
// The markup starts every screen from the sharpest copy inside the slow-line
// byte budget (piecePhoneCap, pieceTabletCap, pieceDesktopCap: the <source>s
// with data-cap), so the art is on screen by 2.5 s even on a slow line, where
// the big landscapes are then soft on tablets and desktops. Once that copy has
// landed, this reads how fast it came (its own download) and, if a sharper
// copy would still be on screen by DEADLINE, fetches the sharpest such copy up
// to the one nearest what the screen shows (at most 2x: a 3x phone stops near
// 2x, as its cap does), decodes it off screen and only then swaps it in: the
// same box, so no layout shift and no blank frame. On a slow line nothing
// changes; the budget copy is what that line can show in time. Save-Data
// never sharpens.

/** Latest landing (ms after the page started loading) at which a sharper copy is still worth it: 2.5 s less decode and paint. */
const DEADLINE = 2000;

interface Connection {
  readonly saveData?: boolean;
  /** Mbps, as the browser estimates it. */
  readonly downlink?: number;
  readonly rtt?: number;
}

interface Copy {
  readonly url: string;
  readonly w: number;
  readonly bytes: number;
}

/** The line as the image's own download saw it: bytes per ms and round trip, or null when it came from a cache. */
function measured(url: string): { rate: number; rtt: number } | null {
  const e = performance.getEntriesByName(url, "resource")[0] as PerformanceResourceTiming | undefined;
  if (!e || !(e.transferSize > 0) || !(e.encodedBodySize > 0)) return null;
  const ms = e.responseEnd - e.responseStart;
  return { rate: ms > 0 ? e.encodedBodySize / ms : Infinity, rtt: Math.max(0, e.responseStart - e.requestStart) };
}

function sharpen(img: HTMLImageElement): void {
  const pic = img.parentElement;
  if (!pic || !img.naturalWidth) return;
  const sources = Array.from(pic.querySelectorAll<HTMLSourceElement>("source"));
  const active = sources.find((s) => !s.media || matchMedia(s.media).matches);
  if (!active?.hasAttribute("data-cap")) return;
  const conn = (navigator as Navigator & { connection?: Connection }).connection;
  if (conn?.saveData) return;
  const bytes = (img.dataset.bytes ?? "").split(" ").map(Number);
  const copies: Copy[] = img.srcset.split(",").map((c, i) => {
    const [url = "", w = ""] = c.trim().split(/\s+/);
    return { url: new URL(url, location.href).href, w: parseInt(w, 10), bytes: bytes[i] ?? NaN };
  });
  const now = copies.find((c) => c.url === img.currentSrc);
  if (!now || copies.some((c) => !(c.w > 0) || !(c.bytes > 0))) return;
  // What the screen shows: the drawn width in device pixels, at most 2x, and
  // the copy nearest it (a 1280 copy for 1338 px: 4% short, and half the bytes of the next).
  const need = img.getBoundingClientRect().width * Math.min(devicePixelRatio || 1, 2);
  const off = (c: Copy): number => Math.abs(Math.log(c.w / need));
  const top = copies.reduce((a, c) => (off(c) < off(a) ? c : a));
  // The line: this image's own download, else the browser's estimate, else assume it is fine.
  const line = measured(img.currentSrc) ?? (conn?.downlink ? { rate: conn.downlink * 125, rtt: conn.rtt ?? 0 } : { rate: Infinity, rtt: 0 });
  const start = performance.now();
  const pick = copies.filter((c) => c.w > now.w && c.w <= top.w && start + line.rtt + c.bytes / line.rate <= DEADLINE).pop();
  if (!pick) return;
  const probe = new Image();
  probe.src = pick.url;
  probe.decode().then(
    () => {
      // One candidate, same sizes: the box keeps its size, and the copy is already decoded.
      for (const s of sources) if (s.hasAttribute("data-cap")) s.srcset = `${pick.url} ${pick.w}w`;
    },
    () => {},
  );
}

export function initSharpen(): void {
  const img = document.querySelector<HTMLImageElement>("img.piece__img[data-bytes]");
  if (!img) return;
  if (img.complete) sharpen(img);
  else img.addEventListener("load", () => sharpen(img), { once: true });
}

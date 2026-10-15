// Zhusha's talisman (ofuda) in the world (the plan, section 4; CHECK-1 item 8): one size, always the anchor
// lock's, 4 x 10 px flat on her 96 px drawing and 8 x 20 on her 192 px one, drawn as pixels at the camera's
// scale every frame (never a smoothly scaled picture):
//
// - from the first frame of its fall to the anchor: the bones' bake (ofuda-flight.json, 60 Hz from T 0.67 to
//   16.6), a 6-point centreline with its visible width and which face shows, relative to her pivot; on her
//   hat (from the slap) it is moved onto the hat of the sprite actually drawn, so the hand-off cannot hop;
// - from the anchor on (and in all play): a live 6-point chain on the hat's tie point, its angle set by the
//   air she moves through (her walk's headwind lifts it toward the brim, her run streams it back over it),
//   the ambient wind's gusts, and her step's bob;
// - level of detail: from 0.9 x the whole drawing (the 192 face from 1.9 x), from 0.4 a paper body with a
//   darker edge, below that a 1 to 2 px speck whose glints still fire;
// - reduced motion: the bake is blended three-quarters of the way toward its own half-second average (the same
//   path and the same catch), the chain wobbles a quarter as much, glints are single drawings.

type RGB = [number, number, number];

interface Tex {
  w: number;
  h: number;
  px: (RGB | null)[];
}

interface Flight {
  tick0: number;
  n: number;
  modes: string;
  faces: string;
  pts: Float32Array;
  hw: Float32Array;
  depth: Float32Array;
}

/** A pose in world px: the centreline from the tie down, half-widths (world px), which face, behind her or not. */
export interface OfudaPose {
  pts: [number, number][];
  hw: number[];
  back: boolean;
  behind: boolean;
}

const SEGS = 5;
const SEG_LEN = 2;
const DEG = Math.PI / 180;
const FACE_ON_HW = 1.5;
/** The tie on her hat, from the drawn frame's head anchor (world px at 96, facing right). */
export const HAT_TIE: [number, number] = [2, -7];

const hex = (s: string): RGB => [parseInt(s.slice(1, 3), 16) / 255, parseInt(s.slice(3, 5), 16) / 255, parseInt(s.slice(5, 7), 16) / 255];
const GLINT_CORE = hex("#fff6c8"), GLINT_ARM = hex("#ffe891");
/** Far off it reads as gold (the plan: a gold body with a darker edge, a gold speck). */
const GOLD = hex("#f5d25c"), GOLD_EDGE = hex("#a8742a");

function decode(j: { tick0: number; modes: string; faces: string; pts: number[]; hw: number[]; depth: number[] }): Flight {
  const n = j.modes.length;
  const pts = new Float32Array(n * 12), hw = new Float32Array(n * 6), depth = new Float32Array(n);
  const p = new Array(12).fill(0), w = new Array(6).fill(0);
  let d = 0;
  for (let t = 0; t < n; t++) {
    for (let i = 0; i < 12; i++) { p[i] += j.pts[t * 12 + i]!; pts[t * 12 + i] = p[i] / 8; }
    for (let i = 0; i < 6; i++) { w[i] += j.hw[t * 6 + i]!; hw[t * 6 + i] = w[i] / 100; }
    d += j.depth[t]!;
    depth[t] = d / 10;
  }
  return { tick0: j.tick0, n, modes: j.modes, faces: j.faces, pts, hw, depth };
}

async function loadTex(url: string): Promise<Tex> {
  const img = new Image();
  img.src = url;
  await img.decode();
  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  const g = c.getContext("2d")!;
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height).data;
  const px: (RGB | null)[] = [];
  for (let i = 0; i < c.width * c.height; i++) px.push(d[i * 4 + 3]! < 128 ? null : [d[i * 4]! / 255, d[i * 4 + 1]! / 255, d[i * 4 + 2]! / 255]);
  return { w: c.width, h: c.height, px };
}

/** The mid-detail body: paper with a darker edge, two columns, as a tiny texture. */
const BODY: Tex = { w: 2, h: 5, px: [GOLD, GOLD_EDGE, GOLD, GOLD_EDGE, GOLD, GOLD_EDGE, GOLD, GOLD_EDGE, GOLD_EDGE, GOLD_EDGE] };

export class Ofuda {
  private flight: Flight | null = null;
  private tex: Record<"f96" | "b96" | "f192" | "b192", Tex> | null = null;
  /** Data and faces are in (the opening set waits for it). */
  readonly ready: Promise<boolean>;
  // the live chain: one angle per segment (from straight down, + toward her facing) and its rate
  private ang = new Float32Array(SEGS).fill(25 * DEG);
  private vel = new Float32Array(SEGS);
  private t = 0;
  private seeded = false;

  constructor(base = "/tesu/opening/") {
    this.ready = (async () => {
      try {
        const res = await fetch(base + "ofuda-flight.json");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        this.flight = decode(await res.json());
        const [f96, b96, f192, b192] = await Promise.all(["front-96", "back-96", "front-192", "back-192"].map((n) => loadTex(`${base}ofuda-${n}.png`)));
        this.tex = { f96: f96!, b96: b96!, f192: f192!, b192: b192! };
        return true;
      } catch (e) {
        console.warn("[opening] the talisman's data", e);
        return false;
      }
    })();
  }

  /** T at which the bake starts and ends. */
  get span(): [number, number] {
    const f = this.flight;
    return f ? [f.tick0 / 60, (f.tick0 + f.n - 1) / 60] : [Infinity, -Infinity];
  }

  /** The bake's mode at T (f free, h held, d drive, p pressed, l flip, a on the hat), or null outside it. */
  modeAt(T: number): string | null {
    const f = this.flight;
    if (!f) return null;
    const i = Math.round(T * 60) - f.tick0;
    return i < 0 || i >= f.n ? null : f.modes[i]!;
  }

  private frameAt(i: number, out: Float32Array, wout: Float32Array): void {
    const f = this.flight!;
    const k = Math.max(0, Math.min(f.n - 1, i));
    for (let j = 0; j < 12; j++) out[j] = f.pts[k * 12 + j]!;
    for (let j = 0; j < 6; j++) wout[j] = f.hw[k * 6 + j]!;
  }

  private a = new Float32Array(12);
  private b = new Float32Array(12);
  private wa = new Float32Array(6);
  private wb = new Float32Array(6);

  /**
   * The bake at T, with her pivot at (px, py). `tie`: where the hat's tie point is on the sprite drawn now
   * (from the slap on the bake is moved onto it). Null before the talisman enters the world's sky.
   */
  bakeAt(T: number, px: number, py: number, tie: [number, number] | null, reduced: boolean): OfudaPose | null {
    const f = this.flight;
    if (!f) return null;
    const x = T * 60 - f.tick0;
    if (x < 0) return null;
    const i = Math.min(f.n - 1, Math.floor(x)), u = Math.min(1, x - i);
    this.frameAt(i, this.a, this.wa);
    this.frameAt(i + 1, this.b, this.wb);
    const pts: [number, number][] = [], hw: number[] = [];
    for (let j = 0; j < 6; j++) {
      let ox = this.a[j * 2]! + (this.b[j * 2]! - this.a[j * 2]!) * u;
      let oy = this.a[j * 2 + 1]! + (this.b[j * 2 + 1]! - this.a[j * 2 + 1]!) * u;
      if (reduced) {
        // three-quarters of the way toward its own half-second average: a quarter of the flutter, the same path
        let sx = 0, sy = 0, n = 0;
        for (let k = i - 15; k <= i + 15; k++) {
          if (k < 0 || k >= f.n) continue;
          sx += f.pts[k * 12 + j * 2]!;
          sy += f.pts[k * 12 + j * 2 + 1]!;
          n++;
        }
        ox = ox * 0.25 + (sx / n) * 0.75;
        oy = oy * 0.25 + (sy / n) * 0.75;
      }
      pts.push([ox, oy]);
      hw.push(this.wa[j]! + (this.wb[j]! - this.wa[j]!) * u);
    }
    const mode = f.modes[i]!;
    if (tie && (mode === "p" || mode === "l" || mode === "a")) {
      const dx = tie[0] - px - pts[0]![0], dy = tie[1] - py - pts[0]![1];
      for (const p of pts) { p[0] += dx; p[1] += dy; }
    }
    for (const p of pts) { p[0] += px; p[1] += py; }
    return { pts, hw, back: f.faces[i] === "b", behind: f.depth[i]! > 0.5 };
  }

  /** Starts the live chain from a pose (the bake's last, so the hand-off cannot hop). */
  seed(p: OfudaPose, facing: number): void {
    for (let i = 0; i < SEGS; i++) {
      const dx = (p.pts[i + 1]![0] - p.pts[i]![0]) * facing, dy = p.pts[i + 1]![1] - p.pts[i]![1];
      this.ang[i] = Math.atan2(dx, dy);
      this.vel[i] = 0;
    }
    this.seeded = true;
  }

  /**
   * One tick of the live chain on the hat. back: the air speed past her from front to back (H/s: her own
   * speed plus a headwind); gust 0..1; bob: her step's phase (radians) while she walks, or null.
   */
  live(tie: [number, number], facing: number, back: number, gust: number, bob: number | null, reduced: boolean, dt = 1 / 60): OfudaPose {
    if (!this.seeded) this.seeded = true;
    this.t += dt;
    const amp = reduced ? 0.25 : 1;
    // the lock's hang: 25 degrees forward on her bangs; the air she moves through lifts it toward the brim
    // (her walk about 15 degrees) and, at a run, flips it up over the brim, streaming back
    const lift = 15 * Math.pow(Math.max(0, back) / 1.1, 1.35);
    const noise = (Math.sin(this.t * 7.1) * 0.6 + Math.sin(this.t * 12.3 + 1.3) * 0.3 + Math.sin(this.t * 19.7 + 0.4) * 0.15) * (3 + 9 * gust);
    const step = bob === null ? 0 : Math.sin(bob) * 3;
    const target = (25 - Math.min(140, lift) + (noise + step) * amp) * DEG;
    for (let i = 0; i < SEGS; i++) {
      // each joint answers the one above it a little late (the free end is the fastest part)
      const want = i === 0 ? target : this.ang[i - 1]! + (target - this.ang[i - 1]!) * 0.5 + Math.sin(this.t * 9 + i) * 2 * DEG * amp * gust;
      const acc = (want - this.ang[i]!) * (90 + i * 30) - this.vel[i]! * 11;
      this.vel[i] = this.vel[i]! + acc * dt;
      this.ang[i] = this.ang[i]! + this.vel[i]! * dt;
      if (i > 0) {
        const d = this.ang[i]! - this.ang[i - 1]!;
        if (Math.abs(d) > 25 * DEG) this.ang[i] = this.ang[i - 1]! + Math.sign(d) * 25 * DEG;
      }
    }
    const pts: [number, number][] = [[tie[0], tie[1]]];
    for (let i = 0; i < SEGS; i++) {
      const p = pts[i]!;
      pts.push([p[0] + Math.sin(this.ang[i]!) * SEG_LEN * facing, p[1] + Math.cos(this.ang[i]!) * SEG_LEN]);
    }
    // on the hat it is turned about 50 degrees to the camera: about 3 px wide at 96
    return { pts, hw: new Array(6).fill(FACE_ON_HW * 0.72), back: false, behind: false };
  }

  /**
   * Draws a pose as pixels. toFrame maps world px to frame px; scale is frame px per world px (the camera's
   * zoom on the play plane). glint: 0..1 through a glint (null: none). px(x, y, colour) fills one frame pixel.
   */
  draw(p: OfudaPose, toFrame: (x: number, y: number) => [number, number], scale: number, glint: number | null, reduced: boolean, px: (x: number, y: number, c: RGB) => void): void {
    const tex = this.tex;
    if (!tex) return;
    const F = p.pts.map((q) => toFrame(q[0], q[1]));
    const out = new Map<number, RGB>();
    const put = (x: number, y: number, c: RGB): void => { out.set((y + 32768) * 65536 + x + 32768, c); };
    if (scale < 0.4) {
      // a speck: 1 px, 2 where the paper is long enough to show
      const m = F[2]!, e = F[5]!;
      put(Math.floor(m[0]), Math.floor(m[1]), GOLD);
      if (Math.hypot(e[0] - F[0]![0], e[1] - F[0]![1]) >= 1.5) put(Math.floor(e[0]), Math.floor(e[1]), GOLD_EDGE);
    } else {
      const t: Tex = scale < 0.9 ? BODY : scale >= 1.9 ? (p.back ? tex.b192 : tex.f192) : (p.back ? tex.b96 : tex.f96);
      // the strip's face-on width is the texture's (world px: 4 at 96); the bake's half-width says how much of it faces us
      const wWorld = (q: number): number => 4 * Math.min(1, Math.max(0.15, q / FACE_ON_HW));
      const seg: number[] = [];
      let total = 0;
      for (let i = 0; i < 5; i++) {
        const l = Math.hypot(F[i + 1]![0] - F[i]![0], F[i + 1]![1] - F[i]![1]);
        seg.push(l);
        total += l;
      }
      const steps = Math.max(t.h, Math.ceil(total * 1.6) + 1);
      let si = 0, acc = 0;
      for (let j = 0; j < steps; j++) {
        const s = ((j + 0.5) / steps) * total;
        while (si < 4 && acc + seg[si]! < s) { acc += seg[si]!; si++; }
        const a = F[si]!, b = F[si + 1]!, l = Math.max(1e-6, seg[si]!);
        const u = Math.min(1, (s - acc) / l);
        const cx = a[0] + (b[0] - a[0]) * u, cy = a[1] + (b[1] - a[1]) * u;
        const tx = (b[0] - a[0]) / l, ty = (b[1] - a[1]) / l;
        const nx = -ty, ny = tx;
        const fs = (j + 0.5) / steps;
        const q = p.hw[Math.min(5, Math.floor(fs * 5))]! + (p.hw[Math.min(5, Math.floor(fs * 5) + 1)]! - p.hw[Math.min(5, Math.floor(fs * 5))]!) * ((fs * 5) % 1);
        const wf = Math.max(1, wWorld(q) * scale);
        const v = Math.min(t.h - 1, Math.floor(fs * t.h));
        const across = Math.max(1, Math.ceil(wf * 1.6));
        for (let k = 0; k < across; k++) {
          const au = (k + 0.5) / across;
          const c = t.px[v * t.w + Math.min(t.w - 1, Math.floor(au * t.w))];
          if (!c) continue;
          const off = (au - 0.5) * wf;
          put(Math.floor(cx + nx * off), Math.floor(cy + ny * off), c);
        }
      }
    }
    if (glint !== null) {
      // a 4-point star on the paper: 1 px core, arms growing and shrinking over five drawings
      const arms = reduced ? [3] : [1, 3, 5, 3, 1];
      const n = arms[Math.min(arms.length - 1, Math.floor(glint * arms.length))]!;
      const m = F[2]!;
      const gx = Math.floor(m[0]), gy = Math.floor(m[1]);
      for (let d = 1; d <= Math.ceil(n / 2); d++) {
        put(gx + d, gy, GLINT_ARM); put(gx - d, gy, GLINT_ARM); put(gx, gy + d, GLINT_ARM); put(gx, gy - d, GLINT_ARM);
      }
      put(gx, gy, GLINT_CORE);
    }
    for (const [k, c] of out) px((k % 65536) - 32768, Math.floor(k / 65536) - 32768, c);
  }
}

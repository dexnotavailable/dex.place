// The hall's people, drawn as simple readable figures in the world's palette until their
// finished sprites exist (Appendix F's looks): Hanko at the front desk (cream and vermilion,
// round glasses, a personal seal on a lanyard as big as her face), Archivist Seo (tall and
// thin, a wide black horsehair gat, a grey-blue scholar's robe, one book too many) and the
// hall cat. Anchored at the feet (Hanko: at the desk top, she sits behind it).

import { definePainter, type PaintCtx } from "../painter.ts";
import { P } from "../palette.ts";
import { clamp, tone } from "../raster.ts";

function ell(c: PaintCtx, cx: number, cy: number, rx: number, ry: number, col: (u: number, v: number, x: number, y: number) => number): void {
  const X0 = Math.floor(c.X(cx - rx)), X1 = Math.ceil(c.X(cx + rx)), Y0 = Math.floor(c.Y(cy - ry)), Y1 = Math.ceil(c.Y(cy + ry));
  for (let y = Y0; y < Y1; y++) for (let x = X0; x < X1; x++) {
    const u = (c.lx(x + 0.5) - cx) / rx, v = (c.ly(y + 0.5) - cy) / ry;
    const d = u * u + v * v;
    if (d > 1) continue;
    const k = col(u, v, x, y);
    if (k) c.buf.set(x, y, d > 0.82 && rx * c.d > 3 ? P.ink[0]! : k);
  }
}

function rectf(c: PaintCtx, x0: number, y0: number, x1: number, y1: number, col: (u: number, v: number, x: number, y: number) => number, outline = true): void {
  const X0 = Math.round(c.X(x0)), X1 = Math.round(c.X(x1)), Y0 = Math.round(c.Y(y0)), Y1 = Math.round(c.Y(y1));
  for (let y = Y0; y < Y1; y++) for (let x = X0; x < X1; x++) {
    if (outline && (x === X0 || x === X1 - 1 || y === Y0)) { c.buf.set(x, y, P.ink[0]!); continue; }
    const k = col((x - X0 + 0.5) / Math.max(1, X1 - X0), (y - Y0 + 0.5) / Math.max(1, Y1 - Y0), x, y);
    if (k) c.buf.set(x, y, k);
  }
}

function face(c: PaintCtx, cx: number, cy: number, r: number, glasses: boolean, blink: boolean, mouth: "smile" | "flat"): void {
  ell(c, cx, cy, r, r * 1.05, (u, _v, x, y) => tone(P.skin, u < -0.2 ? 0.05 : u < 0.4 ? 0.2 : 0.45, x, y, 0.3));
  const ey = cy + r * 0.05;
  for (const sx of [-0.38, 0.38]) {
    const ex = cx + sx * r;
    if (blink) rectf(c, ex - 2, ey, ex + 2, ey + 1, () => P.ink[0]!, false);
    else rectf(c, ex - 1, ey - 2, ex + 1, ey + 1, () => P.ink[0]!, false);
    if (glasses && c.d >= 0.5) {
      for (let a = 0; a < Math.PI * 2; a += 0.35) c.buf.set(Math.round(c.X(ex + Math.cos(a) * r * 0.3)), Math.round(c.Y(ey + Math.sin(a) * r * 0.3)), P.gold[3]!);
    }
  }
  const my = cy + r * 0.55;
  if (mouth === "smile") {
    rectf(c, cx - 2, my, cx + 3, my + 1, () => P.red[4]!, false);
    c.buf.set(Math.round(c.X(cx - 3)), Math.round(c.Y(my - 1)), P.red[4]!);
    c.buf.set(Math.round(c.X(cx + 3)), Math.round(c.Y(my - 1)), P.red[4]!);
  } else rectf(c, cx - 2, my, cx + 2, my + 1, () => P.skin[3]!, false);
}

export interface FolkP {
  frame?: number;
}

/** Hanko behind her desk (anchor: the desk top under her). Frames: idle, blink, stamp up, stamp down. */
export const hanko = definePainter<FolkP>("hanko", {
  bounds() {
    return [-34, -84, 40, 2];
  },
  paint(c, p) {
    const f = p.frame ?? 0;
    const bob = f === 1 ? 1 : 0;
    // coat: cream with vermilion collar and trim, sleeves tied back with a cord
    ell(c, 0, -14 + bob, 26, 22, (u, v, x, y) => {
      if (Math.abs(u) < 0.16 && v < 0.2) return tone(P.red, 0.3, x, y, 0.3);
      if (Math.abs(u + v * 0.8) < 0.08) return P.red[2]!; // the tasuki cord
      return tone(P.paper, u < -0.3 ? 0.1 : u < 0.4 ? 0.25 : 0.5, x, y, 0.3);
    });
    // the seal on its lanyard, as big as her face
    rectf(c, -9, -24 + bob, 9, -6 + bob, (u, v, x, y) => (u < 0.12 || u > 0.88 || v < 0.12 || v > 0.88 ? P.gold[2]! : tone(P.red, 0.25 + 0.2 * v, x, y, 0.3)));
    // the stamping arm
    const ax = 20, ay = f === 2 ? -44 : f === 3 ? -10 : -18;
    rectf(c, ax - 5, ay, ax + 5, -8 + bob, (u, _v, x, y) => tone(P.paper, u < 0.4 ? 0.2 : 0.45, x, y, 0.3));
    rectf(c, ax - 6, ay - 8, ax + 6, ay, (_u, v, x, y) => (v < 0.4 ? P.red[3]! : tone(P.timber, 0.4, x, y, 0.3)));
    // head: dark hair in a bun, round glasses, a smile
    ell(c, 0, -60 + bob, 15, 14, (_u, v, x, y) => tone(P.lacquer, v < -0.2 ? 0.55 : 0.75, x, y, 0.3));
    ell(c, 6, -76 + bob, 7, 6, (_u, _v, x, y) => tone(P.lacquer, 0.7, x, y, 0.3));
    face(c, 1, -52 + bob, 12, true, f === 1, "smile");
    rectf(c, -14, -66 + bob, 14, -60 + bob, (_u, _v, x, y) => tone(P.lacquer, 0.6, x, y, 0.3), false);
  },
});

/** Archivist Seo, standing in the reading nook (anchor: his feet). Frames: idle, blink, a page turned. */
export const seo = definePainter<FolkP>("seo", {
  bounds() {
    return [-44, -124, 44, 2];
  },
  paint(c, p) {
    const f = p.frame ?? 0;
    // robe: long, grey-blue, a dark sash
    rectf(c, -14, -78, 14, 0, (u, v, x, y) => (Math.abs(v - 0.28) < 0.03 ? P.lacquer[3]! : tone(P.blue, u < 0.3 ? 0.35 : u < 0.7 ? 0.55 : 0.75, x, y, 0.3)));
    rectf(c, -18, -6, 18, 0, (_u, _v, x, y) => tone(P.blue, 0.75, x, y, 0.3));
    // the book under his arm, and another in his hand (one too many)
    rectf(c, 10, -62, 26, -44, (u, _v, x, y) => (u < 0.18 ? P.gold[2]! : tone(P.red, 0.5, x, y, 0.3)));
    rectf(c, -26, -56 + (f === 2 ? -4 : 0), -8, -40 + (f === 2 ? -4 : 0), (u, _v, x, y) => (Math.abs(u - 0.5) < 0.06 ? P.paper[3]! : tone(P.paper, 0.15, x, y, 0.3)));
    // head, glasses on the tip of the nose, the tall gat with its wide brim
    face(c, 0, -90, 11, true, f === 1, "flat");
    rectf(c, -10, -112, 10, -98, (_u, _v, x, y) => tone(P.lacquer, 0.8, x, y, 0.3));
    rectf(c, -26, -100, 26, -97, (_u, _v, x, y) => tone(P.lacquer, 0.75, x, y, 0.3));
    rectf(c, -8, -98, -6, -84, () => P.lacquer[3]!, false);
    rectf(c, 6, -98, 8, -84, () => P.lacquer[3]!, false);
  },
});

/** The hall cat, asleep (anchor: the bench or floor under it). Frames: breathing in, out.
 *  (hall loop round 3, W2-12: a beige loaf with no ears or tail) a ginger tabby curled up side-on: its back lit
 *  from the room's lamps, stripes across it, its head down on its paws with both ears up, an eye shut, its tail
 *  wrapped round the front with a darker tip, its belly and the floor under it in shadow. */
export const cat = definePainter<FolkP>("cat", {
  bounds() {
    return [-24, -26, 28, 2];
  },
  paint(c, p) {
    const f = p.frame ?? 0;
    const rise = f === 1 ? 1 : 0;
    const set = (x: number, y: number, v: number): void => c.buf.set(Math.round(c.X(x)), Math.round(c.Y(y)), v);
    const FUR = P.timber;
    // the shadow under it
    for (let x = -17; x <= 19; x++) set(x, 0, P.umber[4]!);
    // the body: a curl, lit along the top and the left, stripes over the back
    const by = -8 - rise * 0.5, brx = 16, bry = 8 + rise * 0.5;
    const X0 = Math.floor(c.X(-brx - 1)), X1 = Math.ceil(c.X(brx + 1)), Y0 = Math.floor(c.Y(by - bry - 1)), Y1 = Math.ceil(c.Y(0));
    for (let y = Y0; y < Y1; y++) for (let x = X0; x < X1; x++) {
      const lx = c.lx(x + 0.5), ly = c.ly(y + 0.5);
      const u = lx / brx, v = (ly - by) / bry;
      const d = u * u + v * v;
      if (d > 1 || ly > -0.5) continue;
      const edge = d > 0.8;
      const stripe = v < 0.25 && Math.sin(lx * 0.75 + v * 1.5) > 0.55;
      let t = 0.22 + (v + 1) * 0.28 - (u < -0.3 && v < 0 ? 0.08 : 0) + (stripe ? 0.28 : 0);
      if (v < -0.7) t -= 0.12;
      if (edge && v > 0.1) t = 0.95;
      c.buf.set(x, y, edge && v > -0.2 ? P.umber[3]! : tone(FUR, clamp(t, 0, 1), x, y, 0.3));
    }
    // the head down on its front paws: a round head, both ears up, an eye shut, a pink nose
    const hx = 13, hy = -9 - rise * 0.5, hr = 6.5;
    const HX0 = Math.floor(c.X(hx - hr - 1)), HX1 = Math.ceil(c.X(hx + hr + 1)), HY0 = Math.floor(c.Y(hy - hr - 6)), HY1 = Math.ceil(c.Y(hy + hr));
    for (let y = HY0; y < HY1; y++) for (let x = HX0; x < HX1; x++) {
      const lx = c.lx(x + 0.5) - hx, ly = c.ly(y + 0.5) - hy;
      const head = Math.hypot(lx, ly * 1.1) < hr;
      // the ears: two triangles on the crown, the near one a little larger
      let ear = 0;
      for (const [ex, eh, ew] of [[-3, 5.5, 2.6], [3.2, 6.2, 2.8]] as const) {
        const t = (-hr * 0.55 - ly) / eh; // 0 at the ear's foot .. 1 at its tip
        if (t > 0 && t < 1 && Math.abs(lx - ex - t * 0.6) < ew * (1 - t)) ear = Math.abs(lx - ex - t * 0.6) < ew * (1 - t) * 0.45 && t < 0.6 ? 2 : 1;
      }
      if (!head && !ear) continue;
      if (ear === 2) { c.buf.set(x, y, P.skin[3]!); continue; }
      if (ear === 1) { c.buf.set(x, y, tone(FUR, lx < 0 ? 0.25 : 0.45, x, y, 0.3)); continue; }
      const rim = Math.hypot(lx, ly * 1.1) > hr - 1;
      const stripe = ly < -2 && Math.abs(lx + Math.sin(ly) * 0.5) < 0.6 && ly > -hr + 1;
      const t = 0.2 + (ly + hr) / (2 * hr) * 0.35 + (lx > 2 ? 0.08 : 0) + (stripe ? 0.3 : 0);
      c.buf.set(x, y, rim && ly > 0 ? P.umber[3]! : tone(FUR, clamp(t, 0, 1), x, y, 0.3));
    }
    // the shut eye (a short dark curve), the muzzle's pale fur, the nose
    set(hx + 1.5, hy - 0.5, P.umber[4]!); set(hx + 2.5, hy, P.umber[4]!); set(hx + 3.5, hy - 0.5, P.umber[4]!);
    set(hx + 4.5, hy + 2, P.paper[2]!); set(hx + 5.5, hy + 2, P.paper[2]!); set(hx + 5.5, hy + 1, P.skin[2]!);
    // the front paws, pale, tucked under the chin
    for (let x = 6; x <= 12; x++) set(x, -1, x > 10 ? P.paper[2]! : tone(FUR, 0.3, Math.round(c.X(x)), Math.round(c.Y(-1)), 0.3));
    // the tail: wrapped round the front from the rump, its tip darker
    for (let a = 0; a <= Math.PI * 1.05; a += 0.08) {
      const tx = -12 + Math.cos(Math.PI + a) * -1 * 14 * (a / Math.PI) - 2, ty = -2.2 + Math.sin(a) * 1.2;
      const tip = a > Math.PI * 0.85;
      const col = tip ? FUR[4]! : Math.sin(a * 9) > 0.5 ? FUR[3]! : FUR[2]!;
      set(tx, ty, col); set(tx, ty - 1, tip ? FUR[3]! : FUR[1]!); set(tx, ty + 1, P.umber[3]!);
    }
  },
});

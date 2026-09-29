// World camera. Follows the player like the old site did, at the new scale:
// a look-ahead toward the way she faces (she sits a little behind centre),
// feet low in the frame with the sky above (CAMERA.anchorY), a vertical dead
// zone so small hops don't bob the view, clamped to the room. Framing zones
// take over for vistas (a fixed composition, extra bars). Shake and the zoom
// punch behave like the lab's camera (same calls, so the lab's Feel and
// contract events drive it); the close-up zoom eases in for combat and hands
// the player to the 144 px render path (game.ts).
//
// Its position is float; what the renderer sees is whole pixels.

import { CAMERA, CLOSEUP_ZOOM, PRESENT, SCALE } from "../config.ts";

export interface FramingZone {
  /** Room-space trigger box (the player's feet inside it). */
  x0: number;
  x1: number;
  y0?: number;
  y1?: number;
  /** Where the view's centre goes (room px); omit an axis to keep following on it. */
  cx?: number;
  cy?: number;
  /** Cinematic bars while inside (share of view height per bar). */
  bars?: number;
  /** 0..1: how fully the zone takes over (default 1). */
  weight?: number;
  /** Feather in px at the zone's x edges (default 1.5 H). */
  feather?: number;
}

export class WorldCamera {
  x = 0;
  y = 0;
  private look = 0;
  private shakeAmp = 0;
  private shakeLeft = 0;
  private shakeTotal = 1;
  private offX = 0;
  private offY = 0;
  zoomSteps = 0;
  private zoomLeft = 0;
  reducedMotion = false;
  /** 0..1 close-up zoom level (eased). */
  closeup = 0;
  closeupTarget = 0;
  /** Current zone blend and bar size. */
  zoneWeight = 0;
  bars: number = PRESENT.bars.explore;
  barsTarget: number = PRESENT.bars.explore;
  /** Extra bars requested by the game (cut-ins, scroll to site). */
  extraBars = 0;
  zones: FramingZone[] = [];
  private vw = SCALE.viewW;
  private vh = SCALE.viewH;

  private target(tx: number, ty: number, facing: number, bounds: [number, number, number, number]): [number, number] {
    const gx = tx + this.look - this.vw / 2;
    let gy = ty - this.vh * CAMERA.anchorY;
    // zones
    let wSum = 0;
    let zx = 0;
    let zy = 0;
    let bars: number = PRESENT.bars.explore;
    for (const z of this.zones) {
      if (z.y0 !== undefined && ty < z.y0) continue;
      if (z.y1 !== undefined && ty > z.y1) continue;
      const fe = z.feather ?? SCALE.H * 1.5;
      const k = Math.min(1, Math.max(0, Math.min((tx - z.x0) / fe, (z.x1 - tx) / fe)));
      if (k <= 0) continue;
      const w = k * (z.weight ?? 1);
      wSum += w;
      zx += w * (z.cx !== undefined ? z.cx - this.vw / 2 : gx);
      zy += w * (z.cy !== undefined ? z.cy - this.vh / 2 : gy);
      if (z.bars !== undefined) bars = Math.max(bars, PRESENT.bars.explore + (z.bars - PRESENT.bars.explore) * k);
    }
    this.barsTarget = bars;
    void facing;
    void bounds;
    if (wSum > 0) {
      const w = Math.min(1, wSum);
      this.zoneWeight = w;
      return [gx + (zx / wSum - gx) * w, gy + (zy / wSum - gy) * w];
    }
    this.zoneWeight = 0;
    return [gx, gy];
  }

  snapTo(tx: number, ty: number, facing: number, bounds: [number, number, number, number]): void {
    this.look = facing * this.vw * CAMERA.lookahead * 0.5;
    const [gx, gy] = this.target(tx, ty, facing, bounds);
    this.x = gx;
    this.y = gy;
    this.clamp(bounds);
    this.bars = this.barsTarget;
  }

  /** One real-time tick (runs through hitstop so shake keeps going). */
  update(tx: number, ty: number, facing: number, bounds: [number, number, number, number], moving: boolean): void {
    const wantLook = facing * this.vw * CAMERA.lookahead * (moving ? 1 : 0.5);
    this.look += (wantLook - this.look) * CAMERA.lookaheadRate;
    const [gx, gy0] = this.target(tx, ty, facing, bounds);
    let gy = gy0;
    const dz = CAMERA.deadzoneY * SCALE.H;
    const dy = gy - this.y;
    if (this.zoneWeight < 0.01) {
      if (Math.abs(dy) < dz) gy = this.y;
      else gy = this.y + (dy - Math.sign(dy) * dz);
    }
    const fx = this.zoneWeight > 0 ? CAMERA.followX * 0.5 + CAMERA.zoneRate : CAMERA.followX;
    const fy = this.zoneWeight > 0 ? CAMERA.followY * 0.5 + CAMERA.zoneRate : CAMERA.followY;
    this.x += (gx - this.x) * (this.reducedMotion ? Math.min(1, fx * 1.6) : fx);
    this.y += (gy - this.y) * (this.reducedMotion ? Math.min(1, fy * 1.6) : fy);
    this.clamp(bounds);
    const bt = Math.max(this.barsTarget, this.extraBars);
    this.bars += Math.sign(bt - this.bars) * Math.min(Math.abs(bt - this.bars), PRESENT.bars.rate * 0.1);
    // close-up zoom eases in and out
    const ct = this.reducedMotion ? 0 : this.closeupTarget;
    this.closeup += (ct - this.closeup) * 0.08;
    if (Math.abs(ct - this.closeup) < 0.002) this.closeup = ct;

    if (this.shakeLeft > 0) {
      this.shakeLeft--;
      const k = this.shakeLeft / this.shakeTotal;
      const a = this.shakeAmp * k * (this.reducedMotion ? 0.35 : 1);
      this.offX = Math.round((Math.random() * 2 - 1) * a);
      this.offY = Math.round((Math.random() * 2 - 1) * a * 0.7);
    } else {
      this.offX = 0;
      this.offY = 0;
    }
    if (this.zoomLeft > 0 && --this.zoomLeft === 0) this.zoomSteps = 0;
  }

  private clamp(b: [number, number, number, number]): void {
    const [x0, y0, x1, y1] = b;
    this.x = x1 - x0 <= this.vw ? (x0 + x1 - this.vw) / 2 : Math.min(Math.max(this.x, x0), x1 - this.vw);
    this.y = y1 - y0 <= this.vh ? (y0 + y1 - this.vh) / 2 : Math.min(Math.max(this.y, y0), y1 - this.vh);
  }

  shake(amplitude: number, duration: number): void {
    if (amplitude >= this.shakeAmp * (this.shakeLeft / this.shakeTotal)) {
      this.shakeAmp = amplitude;
      this.shakeLeft = duration;
      this.shakeTotal = Math.max(1, duration);
    }
  }

  zoom(steps: number, duration: number): void {
    if (this.reducedMotion) return;
    this.zoomSteps = Math.max(this.zoomSteps, steps);
    this.zoomLeft = Math.max(this.zoomLeft, duration);
  }

  /** Combat zoom on/off: the view eases to CLOSEUP_ZOOM around the player. */
  setCloseup(on: boolean): void {
    this.closeupTarget = on ? 1 : 0;
  }

  /** Current close-up world zoom (1..CLOSEUP_ZOOM). */
  get closeupZoom(): number {
    return 1 + (CLOSEUP_ZOOM - 1) * this.closeup;
  }

  /** Integer view origin for this frame. */
  view(): [number, number] {
    return [Math.round(this.x) + this.offX, Math.round(this.y) + this.offY];
  }
}

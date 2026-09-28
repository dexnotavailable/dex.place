// Smooth follow in float space; what the renderer sees is always whole pixels.
// Shake is whole-pixel too. The zoom punch is an integer upscale step applied
// at present time (see Renderer.present), so no pixel ever changes size alone.

export interface CameraTuning {
  followX: number;
  followY: number;
  lookahead: number;
  lookaheadRate: number;
  deadzoneY: number;
  /** Where the target sits vertically, 0 = top, 1 = bottom. */
  anchorY: number;
}

export class Camera {
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

  constructor(private tuning: CameraTuning) {}

  snapTo(tx: number, ty: number, vw: number, vh: number, bounds: [number, number, number, number]): void {
    this.x = tx - vw / 2;
    this.y = ty - vh * this.tuning.anchorY;
    this.clamp(vw, vh, bounds);
  }

  /** One real-time tick (runs through hitstop so shake keeps going). */
  update(tx: number, ty: number, facing: number, vw: number, vh: number, bounds: [number, number, number, number], moving: boolean): void {
    const T = this.tuning;
    const wantLook = moving ? facing * T.lookahead : facing * T.lookahead * 0.35;
    this.look += (wantLook - this.look) * T.lookaheadRate;
    const gx = tx + this.look - vw / 2;
    let gy = ty - vh * T.anchorY;
    const dy = gy - this.y;
    if (Math.abs(dy) < T.deadzoneY) gy = this.y;
    else gy = this.y + (dy - Math.sign(dy) * T.deadzoneY);
    this.x += (gx - this.x) * T.followX;
    this.y += (gy - this.y) * T.followY;
    this.clamp(vw, vh, bounds);

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

  private clamp(vw: number, vh: number, b: [number, number, number, number]): void {
    const [x0, y0, x1, y1] = b;
    this.x = x1 - x0 <= vw ? (x0 + x1 - vw) / 2 : Math.min(Math.max(this.x, x0), x1 - vw);
    this.y = y1 - y0 <= vh ? (y0 + y1 - vh) / 2 : Math.min(Math.max(this.y, y0), y1 - vh);
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

  /** Integer view origin for this frame. */
  view(): [number, number] {
    return [Math.round(this.x) + this.offX, Math.round(this.y) + this.offY];
  }
}

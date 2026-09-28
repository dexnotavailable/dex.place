// Scene camera: a slow automatic drift across the pan range (there and back,
// eased at the ends) and manual panning with keys or drag. Its position is a
// float; each layer rounds its own offset to whole pixels (engine.layerOffset).

export class Camera {
  /** 0..span, in depth-1 pixels. */
  x = 0;
  span = 0;
  auto = true;
  period = 70;
  private phase = 0;
  private vel = 0;
  private idle = 99;
  /** Seconds without input before the auto drift resumes. */
  resumeAfter = 5;

  setSpan(span: number): void {
    const t = this.span > 0 ? this.x / this.span : 0.5;
    this.span = span;
    this.x = t * span;
    this.syncPhase();
  }

  center(): void {
    this.x = this.span / 2;
    this.syncPhase();
  }

  private syncPhase(): void {
    const t = this.span > 0 ? Math.min(1, Math.max(0, this.x / this.span)) : 0.5;
    const a = Math.acos(1 - 2 * t);
    // keep the current direction of travel
    this.phase = Math.sin(this.phase) >= 0 ? a : 2 * Math.PI - a;
  }

  /** dir: -1, 0, 1 from keys; drag: depth-1 pixels moved by a pointer this frame. */
  update(dt: number, dir: number, drag: number, reduced: boolean): void {
    const speed = Math.max(90, this.span / 3);
    if (dir !== 0 || drag !== 0) this.idle = 0;
    else this.idle += dt;
    const target = dir * speed;
    this.vel += (target - this.vel) * Math.min(1, dt * (dir !== 0 ? 6 : 8));
    if (Math.abs(this.vel) < 0.5 && dir === 0) this.vel = 0;
    this.x += this.vel * dt - drag;
    this.x = Math.min(this.span, Math.max(0, this.x));
    if (this.idle <= this.resumeAfter || this.vel !== 0) this.syncPhase();
    else if (this.auto && !reduced) {
      this.phase += (dt * 2 * Math.PI) / this.period;
      this.x = this.span * (0.5 - 0.5 * Math.cos(this.phase));
    }
  }

  /** Whole-pixel offset of a layer, relative to mid-pan (same rounding as GLSL layerOff). */
  offset(depth: number): number {
    const par = depth > 1e6 ? 0 : 1 / depth;
    return Math.floor(this.x * par + 0.5) - Math.floor((this.span / 2) * par + 0.5);
  }
}

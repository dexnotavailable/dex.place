// World camera. Follows the player like the old site did, at the new scale:
// a look-ahead toward the way she faces (she sits a little behind centre),
// feet low in the frame with the sky above, a vertical dead zone so small
// hops don't bob the view, clamped to the room. Outside, the view is the whole
// frame (19.2 x 10.8 H); interiors zoom in (viewZoom, set per room or area).
//
// Modes (WORLD-PLAN section 1), per room and per area:
//   locked  the room (or area) fits one screen and the view doesn't move
//   rail    follows x only (an optional vertical slack for rooms with a walkway)
//   free    follows both axes, with look-ahead (vertical rooms)
// plus framing zones (fixed compositions with extra bars), vista holds (a
// zone that takes over only after you've stood still for `hold` seconds, easing
// in whole pixels), the arena clamp (the view stays on the arena floor while
// the terminal summons) and an override (sitting: the camera holds on a view).
// Shake and the zoom punch behave like the lab's camera (same calls, so the
// lab's Feel and contract events drive it); the close-up zoom eases in for
// combat and hands the player to the 144 px render path (game.ts).
//
// Its position is float; what the renderer sees is whole pixels.
//
// View zoom: the world renders into FRAME (1536x864); `viewZoom` 1 shows all of it
// (outside), more zooms in about its centre (interiors). x, y and the clamp
// are for the zoomed view (vw x vh); view() returns the frame's top-left.
// design() is where the old 1280x720 camera would stand for this view, which
// is what backdrops (composed at 1280x720) are drawn with.

import { CAMERA, CLOSEUP_ZOOM, FRAME, PRESENT, SCALE } from "../config.ts";
import type { RoomCamera } from "./types.ts";

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
  /** Vista hold: the zone only takes over after the player has stood still this many seconds (2 in the plan). */
  hold?: number;
}

export class WorldCamera {
  x = 0;
  y = 0;
  private look = 0;
  private lookV = 0;
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
  /** The mode in force (room or area), set by the game each tick. */
  mode: RoomCamera = { mode: "free" };
  /** Seconds the player has stood still (vista holds). */
  still = 0;
  /** The arena clamp is active (the terminal is summoning). */
  arenaActive = false;
  /** Sitting and other holds: the view centres here (room px). */
  override: { cx: number; cy?: number; bars?: number } | null = null;
  /** The rail row for the current room (set on snap unless the room gives one). */
  private railRow: number | null = null;
  /** View zoom (1 = the whole frame), easing to viewZoomTarget; the game sets the target per room or area. */
  viewZoom = 1;
  viewZoomTarget = 1;
  get vw(): number {
    return FRAME.w / this.viewZoom;
  }
  get vh(): number {
    return FRAME.h / this.viewZoom;
  }

  get anchor(): number {
    return this.mode.anchor ?? CAMERA.anchorY;
  }

  /** Forget the rail row (a new room). */
  resetRail(): void {
    this.railRow = null;
  }

  private target(tx: number, ty: number, bounds: [number, number, number, number]): [number, number] {
    const m = this.mode;
    let gx = tx + this.look - this.vw / 2;
    let gy = ty - this.vh * this.anchor + this.lookV;
    if (m.mode === "locked") {
      const [x0, y0, x1, y1] = bounds;
      gx = m.at ? m.at[0] : (x0 + x1 - this.vw) / 2;
      gy = m.at ? m.at[1] : y1 - y0 <= this.vh ? (y0 + y1 - this.vh) / 2 : ty - this.vh * this.anchor;
    } else if (m.mode === "rail") {
      if (m.railY !== undefined) this.railRow = m.railY;
      if (this.railRow === null) this.railRow = ty - this.vh * this.anchor;
      // with slack, the row follows only once the feet leave anchor +- slack (and keeps where it moved to)
      const slack = (m.slack ?? 0) * SCALE.H;
      const want = ty - this.vh * this.anchor;
      if (slack > 0) {
        const d = want - this.railRow;
        if (Math.abs(d) > slack) this.railRow += d - Math.sign(d) * slack;
      }
      gy = this.railRow;
    }
    // zones (framing, vista holds) and the sitting override
    let wSum = 0;
    let zx = 0;
    let zy = 0;
    let bars: number = PRESENT.bars.explore;
    const zones = this.override ? [{ x0: -1e9, x1: 1e9, cx: this.override.cx, cy: this.override.cy, bars: this.override.bars, feather: 1 } as FramingZone] : this.zones;
    for (const z of zones) {
      if (z.y0 !== undefined && ty < z.y0) continue;
      if (z.y1 !== undefined && ty > z.y1) continue;
      if (z.hold !== undefined && this.still < z.hold) continue;
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
    if (wSum > 0) {
      const w = Math.min(1, wSum);
      this.zoneWeight = w;
      return [gx + (zx / wSum - gx) * w, gy + (zy / wSum - gy) * w];
    }
    this.zoneWeight = 0;
    return [gx, gy];
  }

  snapTo(tx: number, ty: number, facing: number, bounds: [number, number, number, number]): void {
    this.viewZoom = this.viewZoomTarget;
    this.look = facing * this.vw * CAMERA.lookahead * 0.5;
    this.lookV = 0;
    const [gx, gy] = this.target(tx, ty, bounds);
    this.x = gx;
    this.y = gy;
    this.clamp(bounds);
    this.bars = this.barsTarget;
  }

  /** One real-time tick (runs through hitstop so shake keeps going). */
  update(tx: number, ty: number, facing: number, bounds: [number, number, number, number], moving: boolean, vy = 0): void {
    // an area with its own zoom eases into it (a room change snaps, behind the door fade)
    this.viewZoom += (this.viewZoomTarget - this.viewZoom) * (this.reducedMotion ? 1 : 0.05);
    if (Math.abs(this.viewZoomTarget - this.viewZoom) < 0.002) this.viewZoom = this.viewZoomTarget;
    const wantLook = this.mode.mode === "locked" ? 0 : facing * this.vw * CAMERA.lookahead * (moving ? 1 : 0.5);
    this.look += (wantLook - this.look) * CAMERA.lookaheadRate;
    const wantV = this.mode.mode === "free" && this.mode.lookY ? Math.sign(vy) * Math.min(1, Math.abs(vy) / 4) * this.mode.lookY * SCALE.H : 0;
    this.lookV += (wantV - this.lookV) * CAMERA.lookaheadRate;
    const [gx, gy0] = this.target(tx, ty, bounds);
    let gy = gy0;
    const dz = CAMERA.deadzoneY * SCALE.H;
    const dy = gy - this.y;
    if (this.zoneWeight < 0.01 && this.mode.mode === "free") {
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
    let [x0, y0, x1, y1] = b;
    const a = this.mode.arena;
    if (a && this.arenaActive) {
      x0 = Math.max(x0, a.x0);
      x1 = Math.min(x1, a.x1);
    }
    this.x = x1 - x0 <= this.vw ? (x0 + x1 - this.vw) / 2 : Math.min(Math.max(this.x, x0), x1 - this.vw);
    // a room shorter than the view: outside, it sits on the frame's bottom (the extra is sky);
    // zoomed in (inside), it centres
    this.y = y1 - y0 <= this.vh ? (this.viewZoom > 1.001 ? (y0 + y1 - this.vh) / 2 : y1 - this.vh) : Math.min(Math.max(this.y, y0), y1 - this.vh);
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
    return 1 + (CAMERA_ZOOM - 1) * this.closeup;
  }

  /** Integer origin (top-left, room px) of the whole frame the renderer draws. */
  view(): [number, number] {
    return [Math.round(this.x - (FRAME.w - this.vw) / 2) + this.offX, Math.round(this.y - (FRAME.h - this.vh) / 2) + this.offY];
  }

  /**
   * Where the design camera (1280x720, what scenes and rooms were composed with) stands for
   * this frame, clamped the way it always was (so a backdrop's player-plane layers stay on the
   * room's geometry), and where that design view sits inside the frame (px from its top-left).
   * Short rooms keep the design view at the frame's bottom, so the extra height is sky.
   */
  design(b: [number, number, number, number]): { cam: [number, number]; at: [number, number] } {
    const [fx, fy] = this.view();
    const [x0, y0, x1, y1] = b;
    const dw = SCALE.viewW;
    const dh = SCALE.viewH;
    const cx = x1 - x0 <= dw ? Math.round((x0 + x1 - dw) / 2) : Math.round(Math.min(Math.max(fx + (FRAME.w - dw) / 2, x0), x1 - dw));
    const cy = y1 - y0 <= dh ? Math.round((y0 + y1 - dh) / 2) : Math.round(Math.min(Math.max(fy + (FRAME.h - dh), y0), y1 - dh));
    return { cam: [cx, cy], at: [cx - fx, cy - fy] };
  }
}

const CAMERA_ZOOM = CLOSEUP_ZOOM;

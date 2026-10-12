// The camera: follows her with a look-ahead, takes its framing (zoom, feet row, horizon)
// from tracks keyed to where she is (never to a clock), eases between them, snaps to an
// authored zoom level when it comes to rest, shakes and punches for hits, and cuts to the
// close band (2x, the 192 px render) on demand.

import { FRAME_H, INTERIOR_Y, ZOOMS, H } from "./config.ts";
import type { CamState } from "./render/view.ts";
import type { CamKey, CamTrack } from "./world/types.ts";

export const DEFAULT_KEY: Required<Omit<CamKey, "x" | "fixX" | "fixY" | "pin">> = {
  zoom: 1,
  anchor: 0.66,
  horizon: 0.38,
  lead: 0.07,
};

const smooth = (t: number): number => t * t * (3 - 2 * t);

export interface Framing {
  zoom: number;
  anchor: number;
  horizon: number;
  lead: number;
  fixX: number | null;
  fixY: number | null;
  /** A world x pinned to a fraction of the frame's width (resolved by the camera against its width). */
  pin: { x: number; at: number } | null;
}

/** Framing from the active tracks at x (tracks blend in over their first and last keys). */
export function framingAt(tracks: readonly CamTrack[], x: number, flags: (f: string) => boolean, y = 0): Framing {
  const out: Framing = { ...DEFAULT_KEY, fixX: null, fixY: null, pin: null };
  for (const t of tracks) {
    if (x < t.x0 || x > t.x1) continue;
    if ((t.y0 !== undefined && y < t.y0) || (t.y1 !== undefined && y > t.y1)) continue;
    // outdoor tracks without a band stay above the interiors' band
    if (t.y0 === undefined && y > INTERIOR_Y) continue;
    if (t.unless && flags(t.unless)) continue;
    if (t.when && !flags(t.when)) continue;
    const ks = t.keys;
    if (!ks.length) continue;
    let a = ks[0]!, b = ks[0]!, u = 0;
    if (x <= ks[0]!.x) { a = b = ks[0]!; }
    else if (x >= ks[ks.length - 1]!.x) { a = b = ks[ks.length - 1]!; }
    else {
      for (let i = 1; i < ks.length; i++) {
        if (ks[i]!.x >= x) {
          a = ks[i - 1]!; b = ks[i]!;
          u = smooth((x - a.x) / Math.max(1, b.x - a.x));
          break;
        }
      }
    }
    const mix = (k: keyof typeof DEFAULT_KEY): number => {
      const va = a[k] ?? out[k], vb = b[k] ?? out[k];
      return va + (vb - va) * u;
    };
    // zoom blends in log space, so a pull-back feels even
    const za = a.zoom ?? out.zoom, zb = b.zoom ?? out.zoom;
    out.zoom = Math.exp(Math.log(za) + (Math.log(zb) - Math.log(za)) * u);
    out.anchor = mix("anchor");
    out.horizon = mix("horizon");
    out.lead = mix("lead");
    const fx = a.fixX !== undefined && b.fixX !== undefined ? a.fixX + (b.fixX - a.fixX) * u : (u < 0.5 ? a.fixX : b.fixX) ?? null;
    out.fixX = fx;
    const fy = a.fixY !== undefined && b.fixY !== undefined ? a.fixY + (b.fixY - a.fixY) * u : (u < 0.5 ? a.fixY : b.fixY) ?? null;
    out.fixY = fy;
    out.pin = a.pin && b.pin
      ? { x: a.pin.x + (b.pin.x - a.pin.x) * u, at: a.pin.at + (b.pin.at - a.pin.at) * u }
      : (u < 0.5 ? a.pin : b.pin) ?? null;
  }
  return out;
}

export class Camera {
  cx = 0;
  cy = 0;
  zoom = 1;
  anchor = DEFAULT_KEY.anchor;
  horizon = DEFAULT_KEY.horizon;
  W = 1536;
  H = FRAME_H;
  /** 0..1 close band (R's dive and stamp, the opening's first frame). */
  closeup = 0;
  private closeTarget = 0;
  /** Hit punch (lens zoom added in the presenter). */
  punch = 0;
  private punchTarget = 0;
  private shakeAmp = 0;
  private shakeT = 0;
  shakeX = 0;
  shakeY = 0;
  /** Seconds the framing target has been still (for snapping to an authored level). */
  private still = 0;
  private lastTargetZoom = 1;
  private lookX = 0;
  reducedMotion = false;
  /** Count of held-level cuts (reduced motion), so the game can cross-fade them. */
  cuts = 0;
  /** The zoom the framing asks for (before snapping), for debug. */
  wantZoom = 1;
  /** Whether the frame is at an authored level (plates drawn 1:1). */
  atLevel = true;

  /** Snaps to a framing at once (spawns, reloads). */
  snap(px: number, py: number, f: Framing, facing: number): void {
    this.zoom = f.zoom;
    this.anchor = f.anchor;
    this.horizon = f.horizon;
    this.lookX = facing * f.lead * this.W / Math.min(1, this.zoom);
    this.cx = this.fixedX(f) ?? px + this.lookX;
    this.cy = f.fixY ?? py;
  }

  /** The framing's fixed camera x, if any (a pin uses the zoom the framing settles at). */
  private fixedX(f: Framing): number | null {
    if (f.pin) return f.pin.x - (f.pin.at - 0.5) * this.W / f.zoom;
    return f.fixX;
  }

  /** One 60 Hz tick. px, py: her feet. */
  update(px: number, py: number, facing: number, vx: number, f: Framing, dt = 1 / 60): void {
    // the close band overrides the framing's zoom
    this.closeup += (this.closeTarget - this.closeup) * (this.closeTarget > this.closeup ? 0.22 : 0.12);
    if (Math.abs(this.closeTarget - this.closeup) < 0.002) this.closeup = this.closeTarget;
    let want = f.zoom;
    // rest snapping: when the framing's zoom has not changed for a moment, settle on a level
    if (Math.abs(want - this.lastTargetZoom) > 1e-4) this.still = 0;
    else this.still += dt;
    this.lastTargetZoom = want;
    this.wantZoom = want;
    if (this.still > 0.25) want = nearestLevel(want);
    let zTarget = want * (1 - this.closeup) + 2 * this.closeup;
    if (this.reducedMotion) {
      // no zoom swings: the frame cuts between held levels (the game cross-fades the cut)
      zTarget = zTarget >= 1.5 ? 2 : zTarget > 0.3 ? 1 : 0.125;
      if (zTarget !== this.zoom) {
        this.zoom = zTarget;
        this.cuts++;
      }
    } else {
      // zoom eases in log space; a held framing settles within ~150 ms
      const lz = Math.log(this.zoom), lt = Math.log(zTarget);
      const rate = this.still > 0.25 ? 0.2 : 0.09;
      this.zoom = Math.abs(lt - lz) < 1e-4 ? zTarget : Math.exp(lz + (lt - lz) * rate);
    }
    this.atLevel = ZOOMS.some((z) => Math.abs(z - this.zoom) < 1e-4);
    this.anchor += (f.anchor - this.anchor) * 0.06;
    this.horizon += (f.horizon - this.horizon) * 0.06;
    // follow: a look-ahead toward her facing that grows at a run
    const zEff = Math.min(1, this.zoom);
    const lead = (f.lead * facing + 0.03 * Math.max(-1, Math.min(1, vx / 3.2))) * this.W / zEff;
    this.lookX += (lead - this.lookX) * 0.035;
    const fixed = this.fixedX(f);
    const tx = fixed ?? px + this.lookX;
    const ty = f.fixY ?? py;
    this.cx += (tx - this.cx) * (fixed !== null ? 0.05 : 0.1);
    // vertical: a dead zone so small hops do not move the frame
    const dz = 0.55 * H;
    const dy = ty - this.cy;
    if (f.fixY !== null) this.cy += dy * 0.05;
    else if (Math.abs(dy) > dz) this.cy += (dy - Math.sign(dy) * dz) * 0.12;
    else this.cy += dy * 0.01;
    // shake and punch
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const a = this.reducedMotion ? 0 : this.shakeAmp * Math.max(0, this.shakeT / 0.3);
      this.shakeX = Math.round((Math.random() * 2 - 1) * a);
      this.shakeY = Math.round((Math.random() * 2 - 1) * a);
    } else this.shakeX = this.shakeY = 0;
    this.punch += (this.punchTarget - this.punch) * (this.punchTarget > this.punch ? 0.35 : 0.09);
    this.punchTarget *= 0.8;
  }

  setCloseup(on: boolean): void {
    this.closeTarget = on ? 1 : 0;
  }

  // --- the lab's Feel calls these
  shake(amp: number, dur: number): void {
    this.shakeAmp = Math.max(this.shakeAmp * Math.max(0, this.shakeT / 0.3), amp);
    this.shakeT = Math.max(this.shakeT, dur / 60);
  }

  zoomPunch(steps: number): void {
    if (this.reducedMotion) return;
    this.punchTarget = Math.min(0.12, this.punchTarget + 0.035 * steps);
  }

  state(): CamState {
    return { cx: this.cx + this.shakeX, cy: this.cy + this.shakeY, zoom: this.zoom, anchor: this.anchor, horizon: this.horizon, W: this.W, H: this.H };
  }
}

/** The authored zoom level nearest to z (in log space). */
export function nearestLevel(z: number): number {
  let best: number = ZOOMS[0], d = Infinity;
  for (const l of ZOOMS) {
    const v = Math.abs(Math.log(l) - Math.log(z));
    if (v < d) { d = v; best = l; }
  }
  return best;
}

// The ult form after R (lane U, 10-19). Dex 10-19: "a killing machine standing still-ish on one frame, then warping
// position to position, summoning ghost blades." Still-ish: uf_idle holds one drawing (draw.ts asks idleIndex). The
// warps: each M1 of the form's chain blinks her to a spot around the target before it swings (ahead of it, the other
// side of it, above it, then back off for the finisher); with no foe in reach the target is a point ahead that moves on
// with her, so the chain carries her forward. The ghost blades: summoned around the target a moment before each hit and
// striking through it when the form's ghost hit lands (controller.ts hitboxes: the hit again `ghostDelay` later, longer,
// at 60%): this file places and times them, ultdraw.ts draws the stand-ins, the damage stays the controller's.
// Numbers: ult.json `form`.

import { H } from "../config.ts";
import type { MoveWorld, Zhusha } from "./controller.ts";
import { say, ULT, type UltCtx } from "./ult.ts";

/** A ghost blade: summoned at (x0, y0) pointing at the target, strikes through it to (x1, y1). Ticks on the form's clock. */
export interface Blade {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Summoned, strikes, gone. */
  born: number;
  at: number;
  end: number;
}

/** A warp's flash: where she left (out) or arrived (in), on the form's clock. */
export interface Flash {
  x: number;
  y: number;
  at: number;
  out: boolean;
}

/** What the form needs from the controller (controller.ts builds it once, with the R context). */
export interface FormCtx {
  z: Zhusha;
  bodyH: number;
  ghost(life: number): void;
  cue: UltCtx["cue"];
}

export class UltForm {
  /** Ticks since the game started (the form's own clock, advanced every tick). */
  clock = 0;
  blades: Blade[] = [];
  flashes: Flash[] = [];
  /** The chain's target: a foe, or the point ahead she is cutting toward. */
  target: { x: number; y: number; foe: boolean } | null = null;
  /** The foe she could warp to (game.ts: the court's champion while a bout runs), null for none. */
  foe: () => { x: number; y: number } | null = () => null;
  private pending: { x: number; y: number; face: 1 | -1; air: boolean; foe: boolean } | null = null;
  private cues: { at: number; key: string; v: number }[] = [];

  /** The drawing uf_idle holds (Dex 10-19: still-ish on one frame; r_reveal hands off to its first). */
  idleIndex(): number {
    return 0;
  }

  /**
   * An M1 of the form's chain starts (step 0-3): where she warps to and which way she faces, and the ghost blades its hits
   * summon. `hits`: the move's hit ticks; `ghostDelay`: how long after each the ghost hit lands (feel.json).
   */
  begin(c: FormCtx, step: number, hits: readonly number[], ghostDelay: number): void {
    const F = ULT.form, z = c.z, b = z.body, f = z.facing;
    const S = F.steps[Math.max(0, Math.min(F.steps.length - 1, step))]!;
    const foe = this.foe();
    const near = foe && Math.abs(foe.x - b.x) <= F.reach * H ? foe : null;
    let x: number, y: number, face: 1 | -1;
    if (near) {
      // around the foe: d points from her to it; `at` < 0 is her side of it, > 0 the far side (she turns back to it)
      const d: 1 | -1 = near.x >= b.x ? 1 : -1;
      this.target = { x: near.x, y: near.y, foe: true };
      x = near.x + d * S.at * H;
      y = near.y - S.up * H;
      face = x <= near.x ? 1 : -1;
    } else {
      // no foe: she cuts her way forward, the target a point ahead of where she lands
      const fwd = F.free[Math.min(F.free.length - 1, step)] ?? 1.4;
      x = b.x + f * fwd * H;
      y = b.y - S.up * 0.5 * H;
      face = f;
      this.target = { x: x + f * (F.ahead - 1) * H, y: b.y, foe: false };
    }
    this.pending = { x, y, face, air: S.up > 0, foe: !!near };
    // the blades: summoned before each hit, striking as its ghost lands, through the target's middle
    const T = this.target, n = S.blades, cx = T.x, cy = T.y - 0.55 * c.bodyH;
    const side = face;
    for (const h of hits) {
      const strike = this.clock + h + ghostDelay;
      for (let k = 0; k < n; k++) {
        // fanned over the upper half around the target, the first from behind it
        const deg = n === 1 ? -60 : -150 + (120 * k) / (n - 1);
        const a = (deg * Math.PI) / 180;
        const r = F.ring * H * (0.9 + 0.1 * ((k * 7) % 3));
        const px = cx + side * Math.cos(a) * r, py = cy + Math.sin(a) * r;
        this.blades.push({ x0: px, y0: py, x1: cx + (cx - px) * 0.55, y1: cy + (cy - py) * 0.55, born: strike - ghostDelay - F.summon, at: strike + k, end: strike + k + F.strike + F.fade });
      }
      this.cues.push({ at: strike - ghostDelay - F.summon, key: "blade", v: 0.7 }, { at: strike, key: "cut", v: 1 });
    }
  }

  /** Every tick, after the controller's: the pending warp (walls stop it), the blades' and flashes' clock, their cues. */
  tick(c: FormCtx, world: MoveWorld): void {
    const p = this.pending;
    if (p) {
      this.pending = null;
      const b = c.z.body;
      // with no foe she never blinks off a ledge: the warp shortens to where there is ground near her height, or stays
      if (!p.foe && world.groundBelow) {
        const ok = (x: number): boolean => { const g = world.groundBelow!(x, b.y - 2 * H); return !!g && g.y < b.y + 1.5 * H; };
        const k = [1, 0.66, 0.33].find((f) => ok(b.x + (p.x - b.x) * f));
        p.x = k === undefined ? b.x : b.x + (p.x - b.x) * k;
      }
      this.flashes.push({ x: b.x, y: b.y, at: this.clock, out: true });
      c.ghost(14);
      world.move(b, p.x - b.x, 0);
      if (p.y < b.y - 1) {
        world.move(b, 0, p.y - b.y);
        b.grounded = false;
        b.vy = 0;
      }
      c.z.facing = p.face;
      this.flashes.push({ x: b.x, y: b.y, at: this.clock, out: false });
      say(c, "warp", 0.9, "uf");
    }
    for (const q of this.cues) if (q.at === this.clock) say(c, q.key, q.v, "uf");
    this.clock++;
    this.cues = this.cues.filter((q) => q.at >= this.clock);
    this.blades = this.blades.filter((bl) => bl.end > this.clock);
    this.flashes = this.flashes.filter((fl) => fl.at + ULT.form.flash > this.clock);
  }

  /** The form ended (or she was defeated): nothing left hanging. */
  clear(): void {
    this.pending = null;
    this.blades = [];
    this.cues = [];
    this.target = null;
  }
}

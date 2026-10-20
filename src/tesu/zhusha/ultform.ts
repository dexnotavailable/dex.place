// The ult form after R (lane U, 10-19). Dex 10-19: "a killing machine standing still-ish on one frame ... summoning ghost
// blades"; then (after playing it) "the ult form doesn't need to TP her during the attack chain, just make the movement
// make sense". So: uf_idle holds one drawing (draw.ts asks idleIndex); the M1 chain moves her exactly as the normal chain
// does (controller.ts: the uf drawings' own planted-foot motion from combat's derive tool, the chain's lunges, m1_3's
// lock-on lunge toward a foe in reach); and each hit of the chain summons ghost blades: they appear around her (behind
// and above her shoulders) a moment before the hit and strike forward through her target when the form's ghost hit
// lands (controller.ts hitboxes: the hit again `ghostDelay` later, longer, at 60%). The target is the nearest foe in
// reach in front of her, else the point the swing lands on. This file times and places them (from where she is when
// they are summoned), ultdraw.ts draws the stand-ins, the damage stays the controller's. Numbers: ult.json `form`.

import type { WorldBox } from "../../lab/game/events.ts";
import { H } from "../config.ts";
import type { Zhusha } from "./controller.ts";
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

/** What the form needs from the controller (controller.ts builds it once, with the R context). */
export interface FormCtx {
  z: Zhusha;
  bodyH: number;
  cue: UltCtx["cue"];
  /** Her foes' bodies now (the controller's host.foes: the court's champion while a bout is on). */
  foes(): WorldBox[];
}

/** FX v2's ghost blade variants (yaw x tilt). */
const GHOSTS = ["ghost_blade_y0_t0", "ghost_blade_y50_t25", "ghost_blade_y90_t0", "ghost_blade_y0_t25", "ghost_blade_y50_t0", "ghost_blade_y90_t25"];

export class UltForm {
  /** Ticks since the game started (the form's own clock, advanced every tick). */
  clock = 0;
  blades: Blade[] = [];
  /** The last volley's target: a foe's middle, or the point her swing lands on. */
  target: { x: number; y: number; foe: boolean } | null = null;
  /** Volleys waiting to be summoned: when, how many blades, when they strike. */
  private volleys: { summon: number; strike: number; n: number }[] = [];
  private cues: { at: number; key: string; v: number }[] = [];

  /** FX v2's ghost blades are playing (ultdraw.ts leaves its stand-ins out), and which variant is next. */
  real = false;
  private ghostN = 0;

  /** The drawing uf_idle holds (Dex 10-19: still-ish on one frame; r_reveal hands off to its first). */
  idleIndex(): number {
    return 0;
  }

  /**
   * An M1 of the form's chain starts (step 0-3): the ghost blades its hits summon. `hits`: the move's hit ticks;
   * `ghostDelay`: how long after each the ghost hit lands (feel.json). Nothing moves her here: the chain does.
   */
  begin(step: number, hits: readonly number[], ghostDelay: number): void {
    const F = ULT.form;
    const n = F.blades[Math.max(0, Math.min(F.blades.length - 1, step))] ?? 1;
    for (const h of hits) {
      const strike = this.clock + h + ghostDelay;
      this.volleys.push({ summon: strike - ghostDelay - F.summon, strike, n });
      this.cues.push({ at: strike - ghostDelay - F.summon, key: "blade", v: 0.7 }, { at: strike, key: "cut", v: 1 });
    }
  }

  /** Where a volley strikes now: the nearest foe in reach in front of her (its middle), else where her swing lands. */
  private aim(c: FormCtx): { x: number; y: number; foe: boolean } {
    const F = ULT.form, b = c.z.body, f = c.z.facing;
    let best: { x: number; y: number; foe: boolean } | null = null;
    for (const fb of c.foes()) {
      const fx = fb.x + fb.w / 2, ahead = (fx - b.x) * f;
      if (ahead < -0.3 * H || ahead > F.reach * H) continue;
      if (!best || Math.abs(fx - b.x) < Math.abs(best.x - b.x)) best = { x: fx, y: fb.y + fb.h * 0.45, foe: true };
    }
    return best ?? { x: b.x + f * F.ahead * H, y: b.y - 0.55 * c.bodyH, foe: false };
  }

  /** Every tick, after the controller's: volleys summoned from where she is now, the blades' clock, their cues. */
  tick(c: FormCtx): void {
    const F = ULT.form;
    for (const v of this.volleys) {
      if (v.summon !== this.clock) continue;
      // fanned behind and above her shoulders (forward = her facing), each pointing through the target
      const b = c.z.body, f = c.z.facing, T = (this.target = this.aim(c));
      const ox = b.x, oy = b.y - 0.6 * c.bodyH;
      for (let k = 0; k < v.n; k++) {
        const deg = v.n === 1 ? -115 : -170 + (110 * k) / (v.n - 1);
        const a = (deg * Math.PI) / 180;
        const r = F.ring * H * (0.85 + 0.15 * ((k * 7) % 3) / 2);
        const px = ox + f * Math.cos(a) * r, py = oy + Math.sin(a) * r;
        this.blades.push({ x0: px, y0: py, x1: T.x + (T.x - px) * 0.35, y1: T.y + (T.y - py) * 0.35, born: this.clock, at: v.strike + k, end: v.strike + k + F.strike + F.fade });
        // (lane E 10-20) FX v2's ghost blade: it drops from above and stabs where the volley strikes (pivot = the ground
        // contact), its stab drawing on the strike; three yaws x two tilts in turn
        const id = GHOSTS[(this.ghostN++) % GHOSTS.length]!;
        const fx = c.z.fx;
        if (fx?.has(id)) {
          this.real = true;
          fx.play(id, { x: T.x + f * (k - (v.n - 1) / 2) * 0.35 * H, y: c.z.soleY, facing: f, delay: Math.max(0, v.strike + k - this.clock - 1) });
        }
      }
    }
    for (const q of this.cues) if (q.at === this.clock) say(c, q.key, q.v, "uf");
    this.clock++;
    this.volleys = this.volleys.filter((v) => v.summon >= this.clock);
    this.cues = this.cues.filter((q) => q.at >= this.clock);
    this.blades = this.blades.filter((bl) => bl.end > this.clock);
  }

  /** The form ended (or she was defeated): nothing left hanging. */
  clear(): void {
    this.volleys = [];
    this.blades = [];
    this.cues = [];
    this.target = null;
  }
}

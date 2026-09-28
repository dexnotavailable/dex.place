// Rare accents for amber-hollow. The engine's global gate allows up to 3 flash
// starts in any second; this scene wants its accents rarer and never bunched,
// so every emitter here also shares one minimum gap between starts. With a
// 0.6 s gap no rolling second can hold more than 2 starts.

import { FlashAccents, type FlashSpec } from "../../engine/index.ts";
import type { SimEnv } from "../../engine/types.ts";

/** One shared clock of the last accepted start (scene seconds). */
export class FlashSpacing {
  last = -1e9;
  constructor(readonly gap: number) {}
}

/** FlashAccents whose starts also respect a FlashSpacing shared with other emitters. */
export class SpacedFlashes extends FlashAccents {
  constructor(
    specs: FlashSpec[],
    private spacing: FlashSpacing,
  ) {
    super(specs);
  }

  override update(dt: number, env: SimEnv): void {
    const sp = this.spacing;
    // scene time can jump backwards (?t=, reload of a paused scene): forget the old start
    if (env.t < sp.last) sp.last = -1e9;
    super.update(dt, {
      ...env,
      flashGate: () => {
        if (env.t - sp.last < sp.gap) return false;
        if (!env.flashGate()) return false;
        sp.last = env.t;
        return true;
      },
    });
  }
}

// The crane's hook platform in the Hollow Mouth (lane R-B, B5): the runtime's
// carrier (it carries the rider, holds her controls while it moves, answers
// the call levers' call:0 / call:1) with the region's look: a steel grate
// slung on four chains from a sheave block and hook, hanging on the crane's
// cable. It also tells the crane (pixel matter) when it runs, so the winch
// drum turns and the warning lamp turns amber: signal "running" / "idle".

import type { PropCanvas, PropLayer, PropParams, PropRecipe, PropWorld } from "../../props-api.ts";
import { Carrier } from "../../props/kit.ts";
import { Cells, StubProp, type StubEngine, type TextureFactory } from "../../props/stub.ts";

const n = (H: number, k: number): number => Math.max(1, Math.round(H * k));

class CraneHook extends Carrier {
  private wasMoving = false;
  private crane: string;
  private cableTop: number;
  constructor(p: PropParams, tex: TextureFactory) {
    super(p, tex);
    this.crane = (p["crane"] as string) ?? "crane-frame";
    this.cableTop = (p["top"] as number) ?? this.y - this.H * 5;
    const H = this.H;
    const w = n(H, 1.7);
    const hgt = n(H, 1.3);
    const c = new Cells(w + 4, hgt + 4);
    const cx = Math.round((w + 4) / 2);
    const base = hgt + 2;
    // the grate: a steel deck with a toe rail, cross bars under it
    c.rect(2, base - n(H, 0.12), w, n(H, 0.12), "iron", { profile: "bevel", tone: 0 });
    for (let x = 4; x < w; x += n(H, 0.18)) c.rect(x, base - n(H, 0.1), 2, n(H, 0.08), "iron", { tone: -2, profile: "flat" });
    c.rect(2, base - n(H, 0.2), 3, n(H, 0.08), "iron", { tone: -1 });
    c.rect(w - 1, base - n(H, 0.2), 3, n(H, 0.08), "iron", { tone: -1 });
    // four chains up to the block (drawn as two leaning pairs)
    const top = base - hgt + n(H, 0.22);
    for (const [x0, x1] of [
      [4, cx - 3],
      [w - 1, cx + 3],
      [n(H, 0.35), cx - 1],
      [w - n(H, 0.35), cx + 1],
    ] as [number, number][])
      c.stroke([x0, base - n(H, 0.12), x1, top], 1.6, "iron", { tone: -1, piece: 1 });
    // the sheave block and the hook
    c.rect(cx - n(H, 0.1), top - n(H, 0.2), n(H, 0.2), n(H, 0.2), "iron", { profile: "bevel", tone: 1, piece: 2 });
    c.ellipse(cx, top - n(H, 0.12), n(H, 0.06), n(H, 0.06), "brass", { profile: "dome", piece: 2 });
    c.stroke([cx, top, cx + 3, top + n(H, 0.07), cx, top + n(H, 0.12), cx - 3, top + n(H, 0.08)], 2, "iron", { tone: 0, piece: 2 });
    // a strip of the route's red on the rail
    c.rect(w - n(H, 0.3), base - n(H, 0.19), n(H, 0.12), 3, "cloth", { tone: 0, piece: 3 });
    this.addCells(c, cx, base, "middle");
    this.blockTop = base - (top - n(H, 0.2));
  }
  private blockTop: number;

  update(w: PropWorld): void {
    super.update(w);
    if (this.moving !== this.wasMoving) {
      this.wasMoving = this.moving;
      w.signal(this.crane, this.moving ? "running" : "idle");
    }
  }

  draw(c: PropCanvas, layer: PropLayer): void {
    if (layer === "back") {
      // the cable from the crane's head sheave down to the block
      const x = Math.round(this.x);
      const y1 = Math.round(this.y - this.blockTop);
      c.rect(x - 1, Math.round(this.cableTop), 2, Math.max(0, y1 - Math.round(this.cableTop)), [0.16, 0.17, 0.19]);
      c.rect(x, Math.round(this.cableTop), 1, Math.max(0, y1 - Math.round(this.cableTop)), [0.3, 0.31, 0.33]);
      return;
    }
    StubProp.prototype.draw.call(this, c, layer);
  }
}

export const craneHook: PropRecipe = {
  name: "crane-hook",
  reason: "The crane's hook, the lift into the hollow: a steel grate on chains that carries you 32 H down the shaft in 10 s, called from either end.",
  build: (p, e) => new CraneHook(p, (e as StubEngine).texture),
};

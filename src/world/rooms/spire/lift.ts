// The spire lift's car (lane R-D; WORLD-PLAN C3 / D1): the runtime's carrier
// (its stops, eased keyed motion, the express stop behind lever:express, the
// held controls) in the spire's iron. An open cage: a riveted floor on a heavy
// frame, corner posts, a mesh back, a roof with its hoist, and an amber
// beacon on the roof that turns while it moves. It publishes its height every
// tick (storm.ts LIFT) so the counterweight can pass it the other way halfway.
//
// Placed as a stub-engine recipe ("spire-lift"), found next to the rooms.

import type { PropCanvas, PropLayer, PropLight, PropParams, PropRecipe, PropWorld } from "../../props-api.ts";
import { Carrier } from "../../props/kit.ts";
import { Cells, StubProp, type Part, type StubEngine, type TextureFactory } from "../../props/stub.ts";
import { LIFT } from "../../../pixel/props/spire/storm.ts";

const IRON = ["#07090d", "#10141b", "#1c2230", "#2e3746", "#4a5668"];
const IRON_DARK = ["#05070a", "#0b0e14", "#141922", "#1f2632", "#313b4a"];
const AMBER = ["#6a300c", "#b0601a", "#f2a040", "#ffd890", "#fff4d8"];
const RED = ["#3a1016", "#5e1c24", "#86282e", "#a83a3a", "#c85a4a"];

const n = (H: number, k: number): number => Math.max(1, Math.round(H * k));

class SpireLift extends Carrier {
  private cage: Part[] = [];
  private beacon: Part[] = [];
  private roofY: number;
  private carW: number;
  private roomTop: number;
  private spin = 0;
  /** The car's lamp, relative to its origin (px). */
  private lampAt: [number, number] = [0, 0];
  constructor(p: PropParams, tex: TextureFactory) {
    super(p, tex);
    const H = this.H;
    const W = n(H, Number(p["w"] ?? 3));
    this.carW = W;
    this.roomTop = Number(p["top"] ?? -99999);
    const Hc = n(H, 2.2);
    this.roofY = -Hc;
    const pad = 4;
    const cw = W + pad * 2, ch = Hc + n(H, 0.5) + pad * 2;
    const ax = Math.round(cw / 2), ay = Hc + pad;
    // the back (behind her): a solid kick panel to waist height, open mesh above it (the shaft and
    // the storm show through), a ribbed top rail
    const back = new Cells(cw, ch);
    const waist = n(H, 0.62);
    back.rect(pad + 3, ay - waist, W - 6, waist, "iron", { ramp: IRON_DARK, profile: "bevel", tone: 1 });
    for (let x = pad + 3 + n(H, 0.5); x < pad + W - 6; x += n(H, 0.5)) back.rect(x, ay - waist + 2, 1, waist - 3, "iron", { ramp: IRON_DARK, profile: "flat", tone: -1, piece: 1 });
    back.rect(pad + 3, ay - waist, W - 6, 1, "iron", { ramp: IRON, profile: "flat", tone: 2, piece: 1 });
    // the mesh: bars every 6 px both ways, lit on the planet side, nothing between them
    for (let x = pad + 6; x < pad + W - 4; x += 6) back.rect(x, ay - Hc + 4, 1, Hc - waist - 4, "iron", { ramp: IRON, profile: "flat", tone: 1, piece: 1 });
    for (let y = ay - Hc + 8; y < ay - waist; y += 6) back.rect(pad + 4, y, W - 8, 1, "iron", { ramp: IRON, profile: "flat", tone: 0, piece: 1 });
    back.rect(pad + 3, ay - Hc + 4, W - 6, 2, "iron", { ramp: IRON, profile: "bevel", tone: 1, piece: 2 });
    // the car's lamp: a caged bulkhead light on the back wall, warm, always on
    this.lampAt = [pad + Math.round(W * 0.18) - ax, ay - Hc + n(H, 0.42) - ay];
    back.rect(pad + Math.round(W * 0.18) - 3, ay - Hc + n(H, 0.32), 8, n(H, 0.2), "iron", { ramp: IRON, profile: "bevel", tone: 1, piece: 2 });
    back.rect(pad + Math.round(W * 0.18) - 1, ay - Hc + n(H, 0.32) + 2, 4, n(H, 0.2) - 4, "flame", { ramp: AMBER, emissive: true, tone: 2, piece: 3 });
    // a plate with the spire's mark
    back.rect(pad + Math.round(W * 0.7), ay - waist + n(H, 0.14), n(H, 0.3), n(H, 0.18), "iron", { ramp: IRON, profile: "bevel", tone: 1, piece: 2 });
    back.rect(pad + Math.round(W * 0.7) + 3, ay - waist + n(H, 0.14) + 3, n(H, 0.3) - 6, 2, "cloth", { ramp: RED, profile: "flat", piece: 3 });
    this.cage.push(...this.addCells(back, ax, ay, "back"));
    // the frame in front: floor, posts, roof, hoist, the route's red on the floor's edge
    const f = new Cells(cw, ch);
    f.rect(pad, ay - 2, W, n(H, 0.2) + 2, "iron", { ramp: IRON, profile: "bevel", piece: 2 });
    f.rect(pad, ay - 2, W, 1, "iron", { ramp: IRON, tone: 2, piece: 2 });
    f.rect(pad + 2, ay + n(H, 0.2), W - 4, n(H, 0.12), "iron", { ramp: IRON_DARK, profile: "bevel", piece: 3 });
    f.rect(pad + n(H, 0.3), ay + n(H, 0.06), n(H, 0.5), 2, "cloth", { ramp: RED, profile: "flat", piece: 2 });
    for (const x of [pad, pad + W - n(H, 0.1)]) {
      f.rect(x, ay - Hc, n(H, 0.1), Hc, "iron", { ramp: IRON, profile: "cylinder", piece: 4 });
      f.rect(x, ay - Hc, 1, Hc, "iron", { ramp: IRON, tone: 2, piece: 4 });
    }
    // diagonal braces in the corners of the open front, gusset plates where they meet the posts
    for (const [x0, dir] of [[pad + n(H, 0.1), 1], [pad + W - n(H, 0.1) - 1, -1]] as const) {
      for (let k = 0; k < n(H, 0.32); k++) f.rect(x0 + dir * k, ay - Hc + k, 2, 2, "iron", { ramp: IRON, profile: "flat", tone: 1, piece: 4 });
    }
    f.rect(pad - 2, ay - Hc - n(H, 0.12), W + 4, n(H, 0.14), "iron", { ramp: IRON, profile: "bevel", piece: 5 });
    f.rect(pad - 2, ay - Hc - n(H, 0.12), W + 4, 1, "iron", { ramp: IRON, tone: 2, piece: 5 });
    f.rect(Math.round(cw / 2) - n(H, 0.3), ay - Hc - n(H, 0.3), n(H, 0.6), n(H, 0.18), "iron", { ramp: IRON, profile: "bevel", piece: 6 });
    f.ellipse(Math.round(cw / 2), ay - Hc - n(H, 0.32), n(H, 0.1), n(H, 0.1), "iron", { ramp: IRON, profile: "dome", piece: 7 });
    // a waist rail across the open front
    f.rect(pad + n(H, 0.1), ay - n(H, 0.55), W - n(H, 0.2), 2, "iron", { ramp: IRON, profile: "cylinder", piece: 8 });
    this.cage.push(...this.addCells(f, ax, ay, "middle"));
    // the beacon on the roof (lit while moving)
    const bc = new Cells(cw, ch);
    bc.rect(pad + W - n(H, 0.4), ay - Hc - n(H, 0.26), n(H, 0.14), n(H, 0.12), "flame", { ramp: AMBER, emissive: true, piece: 9 });
    this.beacon = this.addCells(bc, ax, ay, "middle");
    this.layers = ["back", "middle", "light"];
  }
  update(w: PropWorld): void {
    super.update(w);
    LIFT.y = this.y;
    LIFT.live = true;
    LIFT.moving = this.moving;
    this.spin = this.moving ? (this.spin + 1) % 40 : 0;
    for (const b of this.beacon) b.visible = this.moving && this.spin < 26;
  }
  draw(c: PropCanvas, layer: PropLayer): void {
    const H = this.H;
    if (layer === "back") {
      // two hoist cables up out of the shaft
      const top = Math.round(this.roomTop);
      const y = Math.round(this.y + this.roofY - n(H, 0.3));
      if (y > top) for (const dx of [-n(H, 0.18), n(H, 0.16)]) c.rect(Math.round(this.x + dx), top, 2, y - top, [0.13, 0.15, 0.19]);
    }
    if (layer === "light") c.glow(this.x + this.lampAt[0], this.y + this.lampAt[1], H * 0.32, [1, 0.66, 0.34], 0.35);
    if (layer === "light" && this.moving && this.spin < 26) c.glow(this.x + this.carW / 2 - n(H, 0.33), this.y + this.roofY - n(H, 0.2), H * 0.5, [1, 0.62, 0.24], 0.45);
    StubProp.prototype.draw.call(this, c, layer);
  }
  lights(out: PropLight[]): void {
    const H = this.H;
    // the car's own lamp: a warm pool inside the cage, the one warm thing in the shaft
    out.push({ x: this.x + this.lampAt[0], y: this.y + this.lampAt[1], radius: H * 2.2, colour: [1, 0.7, 0.42], intensity: 0.55, height: H * 0.5 });
    if (this.moving && this.spin < 26) out.push({ x: this.x + this.carW / 2 - n(H, 0.33), y: this.y + this.roofY - n(H, 0.2), radius: H * 2.6, colour: [1, 0.6, 0.26], intensity: 0.8, height: H * 0.4 });
  }
}

export const spireLift: PropRecipe = {
  name: "spire-lift",
  reason: "The spire lift: it carries you from the waiting room up through the hollow's ceiling into the storm (and, once the express lever is thrown, straight to the Crown).",
  build: (p, e) => new SpireLift(p, (e as unknown as StubEngine).texture),
};

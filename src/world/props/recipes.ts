// Prop recipes for the world, on the stub engine (stub.ts). Each is a short
// recipe in code: shapes with height profiles into cells, pieces for parts
// that move or light up, a state machine, motion, light, collision, sound
// cues and the reason it exists. Everything is sized from H (the player's
// height), so props regenerate correctly if the locked height is nudged.
//
// These cover PIXEL-MATTER's "must have" list (boss terminal, donation box,
// map banner) and the pieces the test world needs. When the real engine in
// src/pixel lands, it registers its own recipes under the same names.

import type { Box, Interaction, PropHit, PropLight, PropParams, PropRecipe, PropWorld, PropCanvas, PropLayer } from "../props-api.ts";
import { Cells, rng, StubProp, type Part, type StubEngine, type TextureFactory } from "./stub.ts";

const n = (H: number, k: number): number => Math.max(1, Math.round(H * k));
const warm: [number, number, number] = [1, 0.74, 0.42];

type Ctor = new (p: PropParams, tex: TextureFactory) => StubProp;
const recipes: { name: string; reason: string; ctor: Ctor }[] = [];
function recipe(name: string, reason: string, ctor: Ctor): void {
  recipes.push({ name, reason, ctor });
}

export function registerStubRecipes(e: StubEngine): void {
  for (const r of recipes) {
    const rec: PropRecipe = { name: r.name, reason: r.reason, build: (p) => new r.ctor(p, e.texture) };
    e.register(rec);
  }
}

// --- light helpers ---------------------------------------------------------------

/** Stepped flicker 0..1 that never strobes: quarter steps, at least 0.2 s each. */
function flicker(t: number, seed: number, depth = 0.25): number {
  const k = Math.floor(t / 13 + seed * 7);
  const r = rng(k * 131 + seed * 977)();
  return 1 - depth * Math.floor(r * 4) / 4;
}

// ======================================================================================
// Lantern post: a stone lantern with a flame. Light source; a hit blows it out,
// it relights itself (restoring) a few seconds later.
// ======================================================================================
class LanternPost extends StubProp {
  readonly recipe = "lantern-post";
  readonly reason = "Lamplighters keep lights burning along the colossi's route so travellers can find their way.";
  readonly states = ["lit", "out", "restoring"] as const;
  private flame: Part[];
  private outFor = 0;
  private w: number;
  private h: number;
  constructor(p: PropParams, tex: TextureFactory) {
    super(p, tex, "lit");
    const H = this.H;
    const w = n(H, 0.3);
    const h = n(H, 0.95);
    this.w = w;
    this.h = h;
    const c = new Cells(w + 4, h + 2);
    const cx = (w + 4) / 2;
    const base = h + 1;
    // pedestal, shaft, fire box, roof and finial
    c.rect(cx - w / 2, base - n(H, 0.12), w, n(H, 0.12), "stone", { tone: -1 });
    c.rect(cx - n(H, 0.06), base - n(H, 0.5), n(H, 0.12), n(H, 0.38), "stone", { profile: "cylinder" });
    c.rect(cx - n(H, 0.12), base - n(H, 0.72), n(H, 0.24), n(H, 0.22), "stone", { tone: 0 });
    c.rect(cx - n(H, 0.07), base - n(H, 0.68), n(H, 0.14), n(H, 0.14), "iron", { tone: -2, profile: "flat" });
    c.poly([cx - n(H, 0.17), base - n(H, 0.72), cx + n(H, 0.17), base - n(H, 0.72), cx, base - n(H, 0.86)], "stone", { tone: 1 });
    c.rect(cx - 1, base - n(H, 0.93), 2, n(H, 0.07), "stone", { tone: 1 });
    c.grain(p.seed ?? 3, 0.5, 3);
    this.addCells(c, Math.round(cx), base);
    const f = new Cells(w + 4, h + 2);
    f.ellipse(cx, base - n(H, 0.6), n(H, 0.045), n(H, 0.06), "flame", { piece: 1, emissive: true, tone: 1 });
    f.rect(cx - 1, base - n(H, 0.63), 2, 2, "flame", { piece: 1, emissive: true, tone: 2 });
    this.flame = this.addCells(f, Math.round(cx), base, "middle");
    this.layers.push("light");
  }
  bounds(): Box {
    return { x: this.x - this.w / 2, y: this.y - this.h, w: this.w, h: this.h };
  }
  hit(h: PropHit, w: PropWorld): boolean {
    super.hit(h, w);
    if (this.state === "lit") {
      this.state = "out";
      this.outFor = 60 * 6;
      w.sound("gutter", 0.6, [this.x, this.y]);
      w.vfx("dust.kick", this.x, this.y - this.H * 0.6, h.dir[0] >= 0 ? 1 : -1);
    }
    return true;
  }
  update(w: PropWorld): void {
    super.update(w);
    if (this.state === "out" && --this.outFor <= 0) {
      this.state = "restoring";
      this.outFor = 40;
    } else if (this.state === "restoring" && --this.outFor <= 0) this.state = "lit";
    const on = this.state === "lit" || (this.state === "restoring" && this.t % 8 < 5);
    for (const f of this.flame) {
      f.visible = on;
      f.ox = Math.round(this.sp.x * 0.5);
      f.oy = this.t % 26 < 13 ? 0 : -1;
    }
  }
  draw(c: PropCanvas, layer: PropLayer): void {
    super.draw(c, layer);
    if (layer === "light" && this.state === "lit") c.glow(this.x, this.y - this.H * 0.6, this.H * 0.55, warm, 0.5 * flicker(this.t, 1));
  }
  lights(out: PropLight[]): void {
    if (this.state !== "lit") return;
    out.push({ x: this.x, y: this.y - this.H * 0.6, radius: this.H * 2.6, colour: warm, intensity: 0.85 * flicker(this.t, 1, 0.15), height: this.H * 0.3 });
  }
}
recipe("lantern-post", "lights along the route", LanternPost);

// ======================================================================================
// Donation box: at every shrine. E opens the donate panel; a small light and a
// chime when used. A top-donor plaque stands beside it (separate prop).
// ======================================================================================
class DonationBox extends StubProp {
  readonly recipe = "donation-box";
  readonly reason = "Travellers leave something for the lamplighters; Dex's donations, in the world.";
  readonly states = ["idle", "used"] as const;
  private usedFor = 0;
  private lamp: Part[];
  constructor(p: PropParams, tex: TextureFactory) {
    super(p, tex, "idle");
    const H = this.H;
    const w = n(H, 0.42);
    const hh = n(H, 0.62);
    const c = new Cells(w + 2, hh + 2);
    const base = hh + 1;
    c.rect(w / 2 - n(H, 0.05), base - n(H, 0.3), n(H, 0.1), n(H, 0.3), "wood", { tone: -1, profile: "cylinder" });
    c.rect(1, base - n(H, 0.56), w, n(H, 0.28), "wood", { tone: 0 });
    c.rect(1, base - n(H, 0.6), w, n(H, 0.05), "wood", { tone: 1 });
    // brass bands, slot and lock plate
    c.rect(1, base - n(H, 0.5), w, 1, "brass", { tone: 0 });
    c.rect(1, base - n(H, 0.34), w, 1, "brass", { tone: -1 });
    c.rect(w / 2 - n(H, 0.08), base - n(H, 0.58), n(H, 0.16), 1, "iron", { tone: -2, profile: "flat" });
    c.ascii(Math.round(w / 2) - 1, base - n(H, 0.45), ["bbb", "b.b", "bbb"], { b: ["brass", 1] });
    c.grain(p.seed ?? 9, 0.4, 2);
    this.addCells(c, Math.round((w + 2) / 2), base);
    const l = new Cells(w + 2, hh + 2);
    l.rect(w / 2 - 1, base - n(H, 0.44), 2, 2, "flame", { piece: 1, emissive: true, tone: 1 });
    this.lamp = this.addCells(l, Math.round((w + 2) / 2), base);
    this.layers.push("light");
  }
  bounds(): Box {
    return { x: this.x - this.H * 0.22, y: this.y - this.H * 0.62, w: this.H * 0.44, h: this.H * 0.62 };
  }
  interaction(): Interaction {
    return {
      radius: this.H * 0.8,
      label: "",
      use: (w) => {
        this.state = "used";
        this.usedFor = 120;
        w.sound("chime", 0.7, [this.x, this.y]);
        w.openPanel("donate");
      },
    };
  }
  hit(h: PropHit, w: PropWorld): boolean {
    this.sp.v += h.dir[0] * 1.2;
    w.sound("clink", 0.5, [this.x, this.y]);
    return true;
  }
  update(w: PropWorld): void {
    super.update(w);
    if (this.state === "used" && --this.usedFor <= 0) this.state = "idle";
    for (const p of this.parts) p.ox = Math.round(this.sp.x);
    for (const l of this.lamp) l.visible = this.state === "used";
  }
  draw(c: PropCanvas, layer: PropLayer): void {
    super.draw(c, layer);
    if (layer === "light" && this.state === "used") c.glow(this.x, this.y - this.H * 0.43, this.H * 0.4, warm, 0.35 * Math.min(1, this.usedFor / 40));
  }
  lights(out: PropLight[]): void {
    if (this.state === "used") out.push({ x: this.x, y: this.y - this.H * 0.43, radius: this.H * 1.4, colour: warm, intensity: 0.8 * Math.min(1, this.usedFor / 40), height: this.H * 0.2 });
  }
}
recipe("donation-box", "donations in the world", DonationBox);

// ======================================================================================
// Donor plaque: an easy view of top donors next to each box. Empty stays empty.
// ======================================================================================
class DonorPlaque extends StubProp {
  readonly recipe = "donor-plaque";
  readonly reason = "Top donors are named beside the boxes they gave at; nothing is ever faked.";
  readonly states = ["idle"] as const;
  constructor(p: PropParams, tex: TextureFactory) {
    super(p, tex, "idle");
    const H = this.H;
    const w = n(H, 0.36);
    const hh = n(H, 0.72);
    const c = new Cells(w + 2, hh + 2);
    const base = hh + 1;
    c.rect(w / 2 - n(H, 0.04), base - n(H, 0.42), n(H, 0.08), n(H, 0.42), "stone", { tone: -1 });
    c.rect(1, base - n(H, 0.7), w, n(H, 0.3), "stone", { tone: 0 });
    c.rect(3, base - n(H, 0.66), w - 4, n(H, 0.22), "brass", { tone: -1, profile: "flat" });
    for (let k = 0; k < 4; k++) c.rect(5, base - n(H, 0.62) + k * 4, w - 8 - (k % 2) * 4, 1, "brass", { tone: 1, profile: "flat" });
    c.grain(p.seed ?? 5, 0.4, 3, 0);
    this.addCells(c, Math.round((w + 2) / 2), base);
  }
  bounds(): Box {
    return { x: this.x - this.H * 0.18, y: this.y - this.H * 0.72, w: this.H * 0.36, h: this.H * 0.72 };
  }
  interaction(): Interaction {
    return { radius: this.H * 0.7, label: "", use: (w) => w.openPanel("donors") };
  }
}
recipe("donor-plaque", "top donors", DonorPlaque);

// ======================================================================================
// Map banner: rolled on a rod between two posts, held by a cord tied to a peg.
// Slash the cord and it unrolls (cloth); E then inspects the full map. The cut
// stays cut in the save.
// ======================================================================================
class MapBanner extends StubProp {
  readonly recipe = "map-banner";
  readonly reason = "The lamplighters' map of the route. Cutting its cord is how you open it; it is a map, not fast travel.";
  readonly states = ["rolled", "unrolling", "unrolled"] as const;
  private cloth: Part[];
  private roll: Part[];
  private cord: Part[];
  private unroll = 0;
  private bw: number;
  private bh: number;
  constructor(p: PropParams, tex: TextureFactory) {
    super(p, tex, "rolled");
    const H = this.H;
    const W = n(H, 1.1);
    const T = n(H, 1.45);
    this.bw = W;
    this.bh = T;
    // a small shrine noticeboard: two stout posts on stone feet, a little pitched roof over the rod
    const roofH = n(H, 0.22);
    const frame = new Cells(W + n(H, 0.3), T + roofH + 2);
    const ox = n(H, 0.15);
    const base = T + roofH + 1;
    const post = n(H, 0.09);
    frame.rect(ox, base - T, post, T, "wood", { profile: "cylinder", tone: -1 });
    frame.rect(ox + W - post, base - T, post, T, "wood", { profile: "cylinder", tone: -1 });
    frame.rect(ox - 2, base - n(H, 0.12), post + 4, n(H, 0.12), "stone", { tone: 0 });
    frame.rect(ox + W - post - 2, base - n(H, 0.12), post + 4, n(H, 0.12), "stone", { tone: 0 });
    frame.poly([0, base - T + 1, W + ox * 2, base - T + 1, W / 2 + ox + n(H, 0.1), base - T - roofH, W / 2 + ox - n(H, 0.1), base - T - roofH], "wood", { tone: -2 });
    frame.rect(0, base - T, W + ox * 2, 2, "wood", { tone: 1 });
    frame.rect(ox + W / 2 - 2, base - T - roofH - 3, 4, 4, "brass", { tone: 1 });
    frame.rect(ox + W - post - 3, base - n(H, 0.5), 3, 2, "iron", { tone: 0 });
    this.addCells(frame, Math.round((W + ox * 2) / 2), base, "back");
    // the banner cloth (full length), revealed row by row as it unrolls
    const bw = W - n(H, 0.2);
    const bl = T - n(H, 0.35);
    const cl = new Cells(bw, bl);
    const red = ["#2a0e10", "#471819", "#692624", "#8a3a31", "#a8543f"];
    cl.rect(0, 0, bw, bl, "cloth", { ramp: red, profile: "flat" });
    cl.rect(2, 2, bw - 4, 1, "gold", { tone: -1, profile: "flat" });
    cl.rect(2, bl - 3, bw - 4, 1, "gold", { tone: -1, profile: "flat" });
    // the route in thread: dock, plain, hollow, spire, chapel, as a line of knots
    const r = rng(41);
    let y = 6;
    let x = Math.round(bw * 0.3);
    const pts: number[] = [];
    while (y < bl - 6) {
      pts.push(x, y);
      x = Math.max(4, Math.min(bw - 5, x + Math.round((r() - 0.5) * bw * 0.5)));
      y += Math.round(bl / 7);
    }
    cl.stroke(pts, 1, "paper", { tone: -1 });
    for (let i = 0; i < pts.length; i += 2) cl.rect(pts[i]! - 1, pts[i + 1]! - 1, 3, 3, "gold", { tone: 1, profile: "flat" });
    cl.grain(12, 0.3, 2);
    this.cloth = this.addCells(cl, Math.round(bw / 2), -n(H, 0.12) + 0, "middle", { cloth: { free: "bottom", amount: 0 } });
    for (const c of this.cloth) c.dy = -T + 2 + n(H, 0.06);
    // the roll (a fat cylinder) and the cord
    const rl = new Cells(bw + 2, n(H, 0.12));
    rl.rect(0, 0, bw + 2, n(H, 0.12), "cloth", { ramp: red, profile: "cylinder" });
    rl.rect(0, Math.round(n(H, 0.12) / 2), bw + 2, 1, "gold", { tone: -1 });
    this.roll = this.addCells(rl, Math.round((bw + 2) / 2), 0, "middle");
    const cd = new Cells(n(H, 0.5), n(H, 0.5));
    cd.stroke([0, 0, n(H, 0.46), n(H, 0.46)], 1, "rope", { tone: 1 });
    this.cord = this.addCells(cd, 0, 0, "middle");
    const saved = typeof p.cut === "boolean" && p.cut;
    if (saved) {
      this.state = "unrolled";
      this.unroll = 1;
    }
    this.place();
  }
  private place(): void {
    const H = this.H;
    const T = this.bh;
    const top = -T + 2 + n(H, 0.06);
    const len = this.cloth[0]?.tex.h ?? 1;
    const shown = Math.round(len * this.unroll);
    for (const c of this.cloth) {
      c.visible = shown > 0;
      c.dy = top;
    }
    for (const r of this.roll) {
      r.dy = top + Math.max(0, shown - 2);
      r.visible = this.unroll < 0.999;
    }
    for (const c of this.cord) {
      c.visible = this.state === "rolled";
      c.dx = -Math.round(this.bw * 0.1);
      c.dy = top + 2;
    }
  }
  bounds(): Box {
    return { x: this.x - this.bw / 2, y: this.y - this.bh, w: this.bw, h: this.bh };
  }
  /** The cord: a small box the slash must cross. */
  private cordBox(): Box {
    const H = this.H;
    return { x: this.x - this.bw * 0.1, y: this.y - this.bh + n(H, 0.12), w: n(H, 0.5), h: n(H, 0.5) };
  }
  hit(h: PropHit, w: PropWorld): boolean {
    const cb = this.cordBox();
    const b = h.box;
    if (this.state === "rolled" && b.x < cb.x + cb.w && b.x + b.w > cb.x && b.y < cb.y + cb.h && b.y + b.h > cb.y) {
      this.state = "unrolling";
      w.save.set(`cut:${this.id}`, true);
      w.sound("cable-cut", 0.9, [this.x, this.y]);
      w.vfx("sparks.small", cb.x + cb.w / 2, cb.y + cb.h / 2, h.dir[0] >= 0 ? 1 : -1);
      return true;
    }
    if (this.state !== "rolled") {
      this.sp.v += h.dir[0] * 2.5;
      w.sound("cloth", 0.5, [this.x, this.y]);
      return true;
    }
    return false;
  }
  interaction(): Interaction | null {
    if (this.state !== "unrolled") return null;
    return { radius: this.H * 1.1, label: "", use: (w) => w.openPanel("map") };
  }
  update(w: PropWorld): void {
    super.update(w);
    if (this.state === "unrolling") {
      this.unroll = Math.min(1, this.unroll + (w.reduced ? 0.03 : 0.018) + this.unroll * 0.02);
      if (this.unroll >= 1) {
        this.state = "unrolled";
        this.sp.v += 2;
        w.sound("cloth", 0.7, [this.x, this.y]);
      }
    }
    // wind sway grows with the unrolled length; pushes from the player's dash/spins add to it
    let push = 0;
    for (const p of w.pushes) if (Math.abs(p.x - this.x) < p.r) push += p.s * Math.sign(this.x - p.x);
    this.sp.v += (w.wind * 0.05 + push * 0.2) * this.unroll;
    const sway = this.sp.x + (w.reduced ? 0 : Math.sin(this.t * 0.03) * Math.abs(w.wind) * 2);
    for (const c of this.cloth) if (c.cloth) c.cloth.amount = sway * 3 * this.unroll;
    this.place();
  }
  protected drawPart(c: PropCanvas, p: Part): void {
    if (this.cloth.includes(p)) {
      // only the unrolled rows
      const len = p.tex.h;
      const shown = Math.round(len * this.unroll);
      const bx = Math.round(this.x + p.dx);
      const by = Math.round(this.y + p.dy);
      for (let r = 0; r < shown; r++) {
        const k = r / len;
        const off = Math.round((p.cloth?.amount ?? 0) * k * k);
        c.cells(p.tex, bx + off, by + r, { sx: 0, sy: r, sw: p.tex.w, sh: 1 });
      }
      return;
    }
    super.drawPart(c, p);
  }
}
recipe("map-banner", "the map", MapBanner);

// ======================================================================================
// Bench: a rest place. E sits (checkpoint, full health).
// ======================================================================================
class Bench extends StubProp {
  readonly recipe = "bench";
  readonly reason = "A place to sit and look; resting here is your checkpoint.";
  readonly states = ["idle", "sitting"] as const;
  constructor(p: PropParams, tex: TextureFactory) {
    super(p, tex, "idle");
    const H = this.H;
    const w = n(H, 0.9);
    const hh = n(H, 0.32);
    const c = new Cells(w + 2, hh + 2);
    const base = hh + 1;
    c.rect(1, base - n(H, 0.26), w, n(H, 0.06), "wood", { tone: 1 });
    c.rect(3, base - n(H, 0.2), n(H, 0.05), n(H, 0.2), "wood", { tone: -1 });
    c.rect(w - 2 - n(H, 0.05), base - n(H, 0.2), n(H, 0.05), n(H, 0.2), "wood", { tone: -1 });
    c.rect(3, base - n(H, 0.12), w - 4, 1, "wood", { tone: -2 });
    c.grain(p.seed ?? 4, 0.5, 4);
    this.addCells(c, Math.round((w + 2) / 2), base, "back");
  }
  bounds(): Box {
    return { x: this.x - this.H * 0.45, y: this.y - this.H * 0.3, w: this.H * 0.9, h: this.H * 0.3 };
  }
  interaction(): Interaction {
    return { radius: this.H * 0.8, label: "", use: (w) => w.openPanel("rest", this.id) };
  }
}
recipe("bench", "rest", Bench);

// ======================================================================================
// Door: closed / opening / open. Leads to a room and spawn. Locked doors
// (latched on the far side) rattle; a latch prop on the far side releases them
// and the release persists in the save.
// ======================================================================================
class Door extends StubProp {
  readonly recipe = "door";
  readonly reason = "Rooms connect through ordinary doors; some open onto somewhere much bigger.";
  readonly states = ["closed", "opening", "open", "locked"] as const;
  private leaf: Part[];
  private open = 0;
  private rattle = 0;
  readonly to: { room: string; spawn: string } | null;
  readonly latch: string | null;
  readonly latchSide: boolean;
  private dw: number;
  private dh: number;
  constructor(p: PropParams, tex: TextureFactory) {
    super(p, tex, "closed");
    const H = this.H;
    this.to = (p.to as { room: string; spawn: string }) ?? null;
    // latch: the save flag that unlocks this door; latchSide: this is the side you release it from
    this.latch = (p.latch as string) ?? null;
    this.latchSide = !!p.latchSide;
    const dw = n(H, 0.62);
    const dh = n(H, 1.3);
    this.dw = dw;
    this.dh = dh;
    const style = (p.variant as string) ?? "wood";
    const fr = new Cells(dw + n(H, 0.2), dh + n(H, 0.14));
    const base = dh + n(H, 0.14) - 1;
    const fw = n(H, 0.08);
    const fm = style === "stone" ? "stone" : "wood";
    fr.rect(0, base - dh - fw, dw + fw * 2, fw, fm, { tone: 1 });
    fr.rect(0, base - dh, fw, dh, fm, { tone: 0 });
    fr.rect(dw + fw, base - dh, fw, dh, fm, { tone: 0 });
    fr.rect(fw, base - dh, dw, dh, "iron", { tone: -2, profile: "flat" });
    fr.rect(0, base, dw + fw * 2, 1, "stone", { tone: -1 });
    this.addCells(fr, Math.round((dw + fw * 2) / 2), base, "back");
    const lf = new Cells(dw, dh);
    const planks = style === "stone" ? "stone" : "wood";
    lf.rect(0, 0, dw, dh, planks, { tone: 0 });
    for (let x = n(H, 0.12); x < dw - 1; x += n(H, 0.13)) lf.rect(x, 1, 1, dh - 2, planks, { tone: -2, profile: "flat" });
    lf.rect(0, n(H, 0.18), dw, n(H, 0.04), "iron", { tone: -1 });
    lf.rect(0, dh - n(H, 0.24), dw, n(H, 0.04), "iron", { tone: -1 });
    lf.rect(dw - n(H, 0.14), Math.round(dh * 0.55), n(H, 0.06), n(H, 0.04), "brass", { tone: 1 });
    lf.grain(p.seed ?? 7, 0.45, 3);
    this.leaf = this.addCells(lf, Math.round(dw / 2), dh, "back");
    for (const l of this.leaf) l.dy = -dh;
    if (this.latch && !this.latchSide) this.state = "locked";
  }
  refresh(w: PropWorld): void {
    if (this.latch && !this.latchSide && this.state === "locked" && w.save.get(this.latch)) this.state = "closed";
  }
  bounds(): Box {
    return { x: this.x - this.dw / 2, y: this.y - this.dh, w: this.dw, h: this.dh };
  }
  interaction(): Interaction | null {
    if (this.state === "opening" || this.state === "open") return null;
    return {
      radius: this.H * 0.6,
      label: "",
      use: (w) => {
        this.refresh(w);
        if (this.state === "locked") {
          this.rattle = 24;
          w.sound("rattle", 0.8, [this.x, this.y]);
          return;
        }
        if (this.latch && this.latchSide && !w.save.get(this.latch)) {
          w.save.set(this.latch, true);
          w.sound("latch", 0.9, [this.x, this.y]);
        }
        this.state = "opening";
        w.sound("door", 0.8, [this.x, this.y]);
      },
    };
  }
  hit(h: PropHit, w: PropWorld): boolean {
    this.rattle = 10;
    w.sound("knock", 0.7, [this.x, this.y]);
    void h;
    return true;
  }
  /** True once when the door has finished opening (the room system then transitions). */
  justOpened = false;
  update(w: PropWorld): void {
    super.update(w);
    this.refresh(w);
    this.justOpened = false;
    if (this.state === "opening") {
      this.open = Math.min(1, this.open + 0.06);
      if (this.open >= 1) {
        this.state = "open";
        this.justOpened = true;
      }
    } else if (this.state === "closed" || this.state === "locked") this.open = Math.max(0, this.open - 0.05);
    const shake = this.rattle > 0 ? (this.rattle-- % 4 < 2 ? 1 : -1) : 0;
    for (const l of this.leaf) {
      // the leaf swings inward: it narrows in whole-pixel steps (drawn as a slice)
      l.ox = shake;
      l.opacity = 1;
    }
  }
  close(): void {
    this.state = this.latch && !this.latchSide ? "closed" : "closed";
    this.open = 0;
  }
  protected drawPart(c: PropCanvas, p: Part): void {
    if (this.leaf.includes(p) && this.open > 0) {
      const w = Math.max(1, Math.round(p.tex.w * (1 - this.open * 0.85)));
      c.cells(p.tex, Math.round(this.x + p.dx + p.ox), Math.round(this.y + p.dy), { sx: 0, sy: 0, sw: w, sh: p.tex.h });
      return;
    }
    super.drawPart(c, p);
  }
}
recipe("door", "doors", Door);
export { Door };

// ======================================================================================
// Grass and reeds: tufts that bend when walked through or swung near; a cut
// scatters them, and they grow back.
// ======================================================================================
class Tuft extends StubProp {
  readonly recipe: string = "grass";
  readonly reason: string = "Something alive at the player's feet, so the ground reacts.";
  readonly states = ["idle", "cut", "regrow"] as const;
  private blades: Part[];
  private cutFor = 0;
  private bend = 0;
  private tw: number;
  constructor(p: PropParams, tex: TextureFactory) {
    super(p, tex, "idle");
    const H = this.H;
    const reeds = p.variant === "reeds";
    const tw = n(H, reeds ? 0.5 : 0.4);
    const th = n(H, reeds ? 0.62 : 0.26);
    this.tw = tw;
    const c = new Cells(tw, th);
    const r = rng(p.seed ?? 21);
    const count = reeds ? 7 : 9;
    for (let i = 0; i < count; i++) {
      const x = Math.round(r() * (tw - 2)) + 1;
      const hgt = Math.round(th * (0.45 + r() * 0.55));
      const lean = Math.round((r() - 0.5) * 4);
      c.stroke([x, th - 1, x + lean, th - hgt], 1, "foliage", { tone: r() < 0.3 ? 1 : r() < 0.5 ? -1 : 0 });
      if (reeds && r() < 0.5) c.rect(x + lean - 1, th - hgt, 2, 3, "wood", { tone: 0 });
    }
    this.blades = this.addCells(c, Math.round(tw / 2), th, (p.layer as PropLayer) ?? "middle", { cloth: { free: "top", amount: 0 } });
  }
  bounds(): Box {
    return { x: this.x - this.tw / 2, y: this.y - this.H * 0.4, w: this.tw, h: this.H * 0.4 };
  }
  hit(h: PropHit, w: PropWorld): boolean {
    if (this.state !== "idle") return false;
    this.state = "cut";
    this.cutFor = 60 * 20;
    w.vfx("feathers", this.x, this.y - 6, h.dir[0] >= 0 ? 1 : -1);
    w.sound("grass", 0.5, [this.x, this.y]);
    return true;
  }
  update(w: PropWorld): void {
    super.update(w);
    if (this.state === "cut" && --this.cutFor <= 0) {
      this.state = "regrow";
      this.cutFor = 90;
    } else if (this.state === "regrow" && --this.cutFor <= 0) this.state = "idle";
    const pl = w.player;
    let target = w.reduced ? w.wind * 1.2 : w.wind * 2 + Math.sin(this.t * 0.05 + this.x * 0.01) * (0.6 + Math.abs(w.wind));
    if (Math.abs(pl.x - this.x) < this.tw * 0.8 && Math.abs(pl.y - this.y) < 8) target += Math.sign(pl.vx || this.x - pl.x) * 4;
    for (const p of w.pushes) if (Math.hypot(p.x - this.x, p.y - this.y) < p.r) target += Math.sign(this.x - p.x) * p.s * 3;
    this.bend += (target - this.bend) * 0.12;
    for (const b of this.blades) {
      b.visible = this.state !== "cut" || this.cutFor > 60 * 20 - 4;
      if (b.cloth) b.cloth.amount = this.bend;
      b.opacity = this.state === "regrow" ? 1 - this.cutFor / 90 : 1;
    }
  }
}
class Reeds extends Tuft {
  readonly recipe = "reeds";
  readonly reason = "Reeds at the water's edge, bending in the wind.";
}
recipe("grass", "grass", Tuft);
recipe("reeds", "reeds", Reeds);

// ======================================================================================
// Piling: an old dock post standing in the water; its top is a platform.
// ======================================================================================
class Piling extends StubProp {
  readonly recipe = "piling";
  readonly reason = "What is left of the pier that once went on; the way on is to hop post to post.";
  readonly states = ["idle"] as const;
  private pw: number;
  private depth: number;
  constructor(p: PropParams, tex: TextureFactory) {
    super(p, tex, "idle");
    const H = this.H;
    this.collision = "platform";
    const pw = n(H, (p.w as number) ?? 0.3);
    const depth = Math.max(4, Math.round((p.depth as number) ?? H * 0.5));
    this.pw = pw;
    this.depth = depth;
    const c = new Cells(pw, depth);
    c.rect(0, 0, pw, depth, "wood", { profile: "cylinder", tone: -1 });
    c.rect(0, 0, pw, 2, "wood", { tone: 1 });
    c.rect(0, depth - n(H, 0.08), pw, n(H, 0.08), "foliage", { tone: -1, profile: "flat" });
    c.grain(p.seed ?? 11, 0.5, 2);
    this.addCells(c, Math.round(pw / 2), 0);
  }
  bounds(): Box {
    return { x: this.x - this.pw / 2, y: this.y, w: this.pw, h: this.depth };
  }
  solids(): Box[] {
    return [{ x: this.x - this.pw / 2 - 2, y: this.y, w: this.pw + 4, h: 0 }];
  }
}
recipe("piling", "pilings", Piling);

// ======================================================================================
// Buoy: bobs on the water on its rope.
// ======================================================================================
class Buoy extends StubProp {
  readonly recipe = "buoy";
  readonly reason = "Marks the old channel; motion on still water.";
  readonly states = ["idle"] as const;
  constructor(p: PropParams, tex: TextureFactory) {
    super(p, tex, "idle");
    const H = this.H;
    const c = new Cells(n(H, 0.2), n(H, 0.3));
    c.ellipse(n(H, 0.1), n(H, 0.2), n(H, 0.09), n(H, 0.08), "cloth", { ramp: ["#2a1411", "#4a2019", "#6e3022", "#8f4a33"] });
    c.rect(n(H, 0.1) - 1, 0, 2, n(H, 0.12), "iron", { tone: 0 });
    c.rect(n(H, 0.02), n(H, 0.19), n(H, 0.16), 1, "paper", { tone: -1 });
    this.addCells(c, n(H, 0.1), n(H, 0.26));
  }
  bounds(): Box {
    return { x: this.x - this.H * 0.1, y: this.y - this.H * 0.3, w: this.H * 0.2, h: this.H * 0.3 };
  }
  update(w: PropWorld): void {
    super.update(w);
    const bob = w.reduced ? 0 : Math.round(Math.sin(this.t * 0.035) * 1.2 + Math.sin(this.t * 0.013) * 0.8);
    for (const p of this.parts) {
      p.oy = bob;
      p.ox = Math.round(this.sp.x);
    }
  }
}
recipe("buoy", "buoy", Buoy);

// ======================================================================================
// Standing stone: a weathered monolith, solid; its top is walkable.
// ======================================================================================
class StandingStone extends StubProp {
  readonly recipe = "standing-stone";
  readonly reason = "Old markers of the route; they give the plain something to climb.";
  readonly states = ["idle"] as const;
  private sw: number;
  private sh: number;
  constructor(p: PropParams, tex: TextureFactory) {
    super(p, tex, "idle");
    const H = this.H;
    this.collision = "solid";
    const sw = n(H, (p.w as number) ?? 0.55);
    const sh = n(H, (p.h as number) ?? 1.1);
    this.sw = sw;
    this.sh = sh;
    const c = new Cells(sw + 2, sh + 2);
    const r = rng(p.seed ?? 31);
    const lean = Math.round((r() - 0.5) * n(H, 0.1));
    const inset = Math.round(sw * 0.16);
    const chip = Math.max(2, Math.round(sw * 0.12));
    // tapered monolith: wide foot, narrower weathered top with chipped shoulders
    c.poly([0, sh + 1, sw + 1, sh + 1, sw - inset + lean + 1, Math.round(sh * 0.25), sw - inset + lean - 1, chip + 1, sw - inset - chip + lean, 1, inset + chip + lean, 1, inset + lean, chip, inset + lean - 2, Math.round(sh * 0.3)], "stone", { profile: "round" });
    c.grain(p.seed ?? 31, 0.6, 3);
    // weathering bands, a crack, moss on the shoulders, a carved lamplighter's mark
    for (let y = Math.round(sh * 0.45); y < sh; y += Math.round(sh * 0.22)) c.stroke([inset / 2, y, sw - inset / 2, y + Math.round((r() - 0.5) * 3)], 1, "stone", { tone: -2 });
    c.stroke([Math.round(sw * 0.6) + lean, 3, Math.round(sw * 0.52) + lean, Math.round(sh * 0.3), Math.round(sw * 0.66), Math.round(sh * 0.5)], 1, "stone", { tone: -2 });
    c.rect(inset + chip + lean, 1, sw - 2 * (inset + chip), 2, "foliage", { tone: 0, profile: "flat" });
    c.ascii(Math.round(sw / 2) - 1 + Math.round(lean / 2), Math.round(sh * 0.36), [".c.", "ccc", ".c.", ".c."], { c: ["stone", -2] });
    this.addCells(c, Math.round((sw + 2) / 2), sh + 1);
  }
  bounds(): Box {
    return { x: this.x - this.sw / 2, y: this.y - this.sh, w: this.sw, h: this.sh };
  }
  solids(): Box[] {
    return [{ x: this.x - this.sw / 2, y: this.y - this.sh + 2, w: this.sw, h: this.sh - 2 }];
  }
  hit(h: PropHit, w: PropWorld): boolean {
    w.vfx("dust.kick", h.box.x + h.box.w / 2, h.box.y + h.box.h / 2, h.dir[0] >= 0 ? -1 : 1);
    w.sound("stone", 0.6, [this.x, this.y]);
    return true;
  }
}
recipe("standing-stone", "standing stones", StandingStone);

// ======================================================================================
// Prayer flags on a line between two poles: the wind tears at them.
// ======================================================================================
class PrayerFlags extends StubProp {
  readonly recipe = "prayer-flags";
  readonly reason = "Wind-torn flags on the shrine line: the storm made visible.";
  readonly states = ["idle", "cut"] as const;
  private span: number;
  private flags: { part: Part; at: number; phase: number }[] = [];
  private poleH: number;
  constructor(p: PropParams, tex: TextureFactory) {
    super(p, tex, "idle");
    const H = this.H;
    this.span = Math.round((p.span as number) ?? H * 3);
    this.poleH = n(H, 1.5);
    const pole = new Cells(n(H, 0.06), this.poleH);
    pole.rect(0, 0, n(H, 0.06), this.poleH, "wood", { profile: "cylinder", tone: -1 });
    const [a] = this.addCells(pole, n(H, 0.03), this.poleH, "back");
    const [b] = this.addCells(pole, n(H, 0.03), this.poleH, "back");
    b!.dx += this.span;
    void a;
    const colours = [
      ["#3a1a1a", "#5e2826", "#86413a"],
      ["#1d2a36", "#2c4254", "#476478"],
      ["#3a3420", "#5e5430", "#857848"],
      ["#4c4a44", "#6e6b62", "#908c80"],
      ["#1f3222", "#2f4a32", "#48664a"],
    ];
    const count = Math.max(4, Math.round(this.span / (H * 0.32)));
    for (let i = 0; i < count; i++) {
      const fw = n(H, 0.16);
      const fh = n(H, 0.22);
      const c = new Cells(fw, fh);
      c.poly([0, 0, fw, 0, fw, fh, Math.round(fw / 2), fh - n(H, 0.05), 0, fh], "cloth", { ramp: colours[i % colours.length]!, profile: "flat" });
      c.grain(i * 7 + 3, 0.3, 2);
      const [part] = this.addCells(c, 0, 0, "middle", { cloth: { free: "bottom", amount: 0 } });
      this.flags.push({ part: part!, at: (i + 0.5) / count, phase: i * 1.7 });
    }
  }
  private sag(t: number): number {
    return Math.round(Math.sin(Math.PI * t) * this.H * 0.28);
  }
  bounds(): Box {
    return { x: this.x, y: this.y - this.poleH, w: this.span, h: this.poleH };
  }
  hit(h: PropHit, w: PropWorld): boolean {
    if (this.state === "cut") return false;
    const ly = this.y - this.poleH + this.H * 0.1 + this.H * 0.2;
    if (h.box.y > ly + 8 || h.box.y + h.box.h < ly - 12) return false;
    this.state = "cut";
    w.save.set(`cut:${this.id}`, true);
    w.sound("cable-cut", 0.7, [h.box.x, ly]);
    return true;
  }
  update(w: PropWorld): void {
    super.update(w);
    const top = -this.poleH + Math.round(this.H * 0.1);
    for (const f of this.flags) {
      const x = Math.round(this.span * f.at);
      f.part.dx = x;
      f.part.dy = top + (this.state === "cut" ? Math.min(this.poleH - 6, this.sag(f.at) + (this.t % 1000) * 0 + this.H * 1.1) : this.sag(f.at));
      const gust = w.reduced ? 0.4 : 0.6 + 0.4 * Math.sin(this.t * 0.11 + f.phase);
      if (f.part.cloth) f.part.cloth.amount = (this.state === "cut" ? 0 : w.wind * 6 * gust) + Math.sin(this.t * 0.2 + f.phase) * Math.abs(w.wind) * 2;
    }
  }
  draw(c: PropCanvas, layer: PropLayer): void {
    if (layer === "middle") {
      // the rope: a sagging line of 1 px rects
      const top = this.y - this.poleH + Math.round(this.H * 0.1);
      const steps = Math.max(8, Math.round(this.span / 3));
      if (this.state !== "cut")
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          c.rect(Math.round(this.x + this.span * t), top + this.sag(t), 3, 1, [0.36, 0.3, 0.24]);
        }
      else {
        c.rect(this.x, top, 2, Math.round(this.H * 0.9), [0.36, 0.3, 0.24]);
        c.rect(this.x + this.span - 1, top, 2, Math.round(this.H * 0.5), [0.36, 0.3, 0.24]);
      }
    }
    super.draw(c, layer);
  }
}
recipe("prayer-flags", "prayer flags", PrayerFlags);

// ======================================================================================
// Bones of something huge, half-buried (foreground or background).
// ======================================================================================
class Bones extends StubProp {
  readonly recipe = "bones";
  readonly reason = "Something huge died on the plain once; scale, and a quiet warning.";
  readonly states = ["idle"] as const;
  private bw: number;
  constructor(p: PropParams, tex: TextureFactory) {
    super(p, tex, "idle");
    const H = this.H;
    const size = (p.size as number) ?? 1;
    const bw = n(H, 2.4 * size);
    const bh = n(H, 1.3 * size);
    this.bw = bw;
    const c = new Cells(bw, bh);
    const r = rng(p.seed ?? 51);
    const boneRamp = ["#2e2b27", "#48443e", "#66615a", "#857f75", "#a39d90"];
    const earth = ["#150f0d", "#221917", "#2e221d", "#3d2e26"];
    // ribs: curved arcs rising out of the ground, tallest in the middle, leaning one way, tapering
    const ribs = 5 + Math.floor(r() * 3);
    for (let i = 0; i < ribs; i++) {
      const x0 = Math.round(bw * 0.12 + (i + r() * 0.3) * ((bw * 0.72) / ribs));
      const mid = 1 - Math.abs(i / (ribs - 1) - 0.45) * 1.3;
      const hgt = Math.round(bh * (0.35 + 0.55 * Math.max(0, mid)) * (0.8 + r() * 0.3));
      const bend = bw * (0.1 + r() * 0.05);
      const steps = 10;
      for (let k = 0; k < steps; k++) {
        const t0 = k / steps;
        const t1 = (k + 1) / steps;
        const px = (t: number): number => x0 + Math.sin(t * 1.9) * bend;
        const py = (t: number): number => bh - 1 - t * hgt;
        const wdt = Math.max(1, Math.round(n(H, 0.07 * size) * (1 - t0 * 0.7)));
        if (i % 3 === 2 && t0 > 0.7) break; // a broken one
        c.stroke([px(t0), py(t0), px(t1), py(t1)], wdt, "bone", { ramp: boneRamp, tone: k > 6 ? 1 : 0 });
      }
    }
    // the spine along the ground, and the earth it lies in
    c.stroke([0, bh - 2, bw * 0.5, bh - 4, bw - 1, bh - 3], Math.max(2, n(H, 0.08 * size)), "bone", { ramp: boneRamp, tone: -1 });
    c.ellipse(bw * 0.5, bh + n(H, 0.02), bw * 0.52, n(H, 0.12 * size), "stone", { ramp: earth, profile: "dome" });
    c.grain(p.seed ?? 51, 0.5, 2);
    this.addCells(c, Math.round(bw / 2), bh, (p.layer as PropLayer) ?? "back");
  }
  bounds(): Box {
    return { x: this.x - this.bw / 2, y: this.y - this.H * 1.3, w: this.bw, h: this.H * 1.3 };
  }
  hit(): boolean {
    return false;
  }
}
recipe("bones", "bones", Bones);

// ======================================================================================
// Offering bowl: a stone bowl with embers at the shrine.
// ======================================================================================
class OfferingBowl extends StubProp {
  readonly recipe = "offering-bowl";
  readonly reason = "Small offerings at the shrine; embers that stay warm.";
  readonly states = ["idle"] as const;
  constructor(p: PropParams, tex: TextureFactory) {
    super(p, tex, "idle");
    const H = this.H;
    const c = new Cells(n(H, 0.36), n(H, 0.3));
    c.rect(n(H, 0.12), n(H, 0.16), n(H, 0.12), n(H, 0.14), "stone", { tone: -1 });
    c.poly([0, n(H, 0.06), n(H, 0.36), n(H, 0.06), n(H, 0.28), n(H, 0.17), n(H, 0.08), n(H, 0.17)], "stone", { tone: 0 });
    c.rect(n(H, 0.06), n(H, 0.05), n(H, 0.24), 2, "flame", { emissive: true, piece: 1, tone: -1 });
    this.addCells(c, n(H, 0.18), n(H, 0.3));
    this.layers.push("light");
  }
  bounds(): Box {
    return { x: this.x - this.H * 0.18, y: this.y - this.H * 0.3, w: this.H * 0.36, h: this.H * 0.3 };
  }
  draw(c: PropCanvas, layer: PropLayer): void {
    super.draw(c, layer);
    if (layer === "light") c.glow(this.x, this.y - this.H * 0.26, this.H * 0.3, [1, 0.5, 0.2], 0.3 * flicker(this.t, 4, 0.3));
  }
  lights(out: PropLight[]): void {
    out.push({ x: this.x, y: this.y - this.H * 0.26, radius: this.H * 1.2, colour: [1, 0.5, 0.25], intensity: 0.45 * flicker(this.t, 4, 0.3), height: this.H * 0.1 });
  }
}
recipe("offering-bowl", "offering bowl", OfferingBowl);

// ======================================================================================
// Red floor line: the one quiet environmental hint that says "go right".
// ======================================================================================
class RedLine extends StubProp {
  readonly recipe = "red-line";
  readonly reason = "CANON: one quiet hint says go right: a muted red line on the floor.";
  readonly states = ["idle"] as const;
  private len: number;
  constructor(p: PropParams, tex: TextureFactory) {
    super(p, tex, "idle");
    this.len = Math.round((p.len as number) ?? this.H * 3);
    this.layers = ["decal"];
  }
  bounds(): Box {
    return { x: this.x, y: this.y - 2, w: this.len, h: 2 };
  }
  hit(): boolean {
    return false;
  }
  draw(c: PropCanvas, layer: PropLayer): void {
    if (layer !== "decal") return;
    // a thin line with a few breaks, fading out toward the start
    for (let x = 0; x < this.len; x += 1) {
      if ((x * 7919) % 53 < 3) continue;
      const k = Math.min(1, x / (this.len * 0.4));
      c.rect(this.x + x, this.y - 1, 1, 1, [0.46, 0.14, 0.13], 0.35 + 0.5 * k);
    }
  }
}
recipe("red-line", "hint", RedLine);

// ======================================================================================
// Registry counter with a bell and ledger: the dex account in the world.
// ======================================================================================
class Counter extends StubProp {
  readonly recipe = "counter";
  readonly reason = "The registry counter: dex account, the same state as on the website.";
  readonly states = ["idle", "ring"] as const;
  private bell: Part[];
  private ring = 0;
  private cw: number;
  constructor(p: PropParams, tex: TextureFactory) {
    super(p, tex, "idle");
    const H = this.H;
    this.collision = "platform";
    const cw = n(H, 1.6);
    const ch = n(H, 0.62);
    this.cw = cw;
    const c = new Cells(cw + 2, ch + 2);
    const base = ch + 1;
    c.rect(1, base - ch, cw, n(H, 0.07), "wood", { tone: 1 });
    c.rect(3, base - ch + n(H, 0.07), cw - 4, ch - n(H, 0.07), "wood", { tone: -1 });
    for (let x = 8; x < cw - 6; x += n(H, 0.3)) c.rect(x, base - ch + n(H, 0.14), n(H, 0.22), ch - n(H, 0.22), "wood", { tone: 0 });
    // ledger
    c.rect(n(H, 0.3), base - ch - n(H, 0.05), n(H, 0.32), n(H, 0.05), "paper", { tone: 0, profile: "flat" });
    c.rect(n(H, 0.3) + n(H, 0.16), base - ch - n(H, 0.05), 1, n(H, 0.05), "paper", { tone: -2, profile: "flat" });
    c.grain(p.seed ?? 14, 0.45, 3);
    this.addCells(c, Math.round((cw + 2) / 2), base, "back");
    const b = new Cells(n(H, 0.14), n(H, 0.14));
    b.ellipse(n(H, 0.07), n(H, 0.09), n(H, 0.06), n(H, 0.05), "brass", { tone: 1 });
    b.rect(n(H, 0.07) - 1, 0, 2, 3, "brass", { tone: 0 });
    this.bell = this.addCells(b, n(H, 0.07), n(H, 0.14), "back", { pivotRow: 0 });
    for (const bl of this.bell) {
      bl.dx += Math.round(cw * 0.3);
      bl.dy -= ch;
    }
  }
  bounds(): Box {
    return { x: this.x - this.cw / 2, y: this.y - this.H * 0.75, w: this.cw, h: this.H * 0.75 };
  }
  solids(): Box[] {
    return [{ x: this.x - this.cw / 2, y: this.y - this.H * 0.62, w: this.cw, h: 0 }];
  }
  interaction(): Interaction {
    return {
      radius: this.H * 1.1,
      label: "",
      use: (w) => {
        this.ring = 50;
        w.sound("bell", 0.7, [this.x, this.y]);
        w.openPanel("account");
      },
    };
  }
  hit(h: PropHit, w: PropWorld): boolean {
    this.ring = 60;
    this.sp.v += h.dir[0] * 1.5;
    w.sound("bell", 0.9, [this.x, this.y]);
    return true;
  }
  update(w: PropWorld): void {
    super.update(w);
    if (this.ring > 0) this.ring--;
    for (const b of this.bell) b.swing = this.ring > 0 ? Math.sin(this.ring * 0.5) * 0.25 * (this.ring / 60) : 0;
  }
}
recipe("counter", "registry counter", Counter);

// ======================================================================================
// Lectern with an open book: the archive's reading place. Pages flutter.
// ======================================================================================
class Lectern extends StubProp {
  readonly recipe = "lectern";
  readonly reason = "The archive's reading desk: real documentation, clearly separate from lore.";
  readonly states = ["idle"] as const;
  private page: Part[];
  constructor(p: PropParams, tex: TextureFactory) {
    super(p, tex, "idle");
    const H = this.H;
    const c = new Cells(n(H, 0.5), n(H, 0.72));
    c.rect(n(H, 0.21), n(H, 0.2), n(H, 0.08), n(H, 0.5), "wood", { profile: "cylinder", tone: -1 });
    c.rect(n(H, 0.1), n(H, 0.68), n(H, 0.3), n(H, 0.04), "wood", { tone: 0 });
    c.poly([0, n(H, 0.14), n(H, 0.5), n(H, 0.06), n(H, 0.5), n(H, 0.12), 0, n(H, 0.22)], "wood", { tone: 1 });
    c.poly([2, n(H, 0.12), n(H, 0.25), n(H, 0.08), n(H, 0.25), n(H, 0.12), 2, n(H, 0.16)], "paper", { tone: 1, profile: "flat" });
    c.grain(p.seed ?? 8, 0.4, 2, 0);
    this.addCells(c, n(H, 0.25), n(H, 0.72));
    const pg = new Cells(n(H, 0.22), n(H, 0.1));
    pg.poly([0, n(H, 0.06), n(H, 0.22), 0, n(H, 0.22), n(H, 0.04), 0, n(H, 0.1)], "paper", { tone: 2, profile: "flat" });
    this.page = this.addCells(pg, 0, 0, "middle", { pivotRow: n(H, 0.1) });
    for (const g of this.page) {
      g.dx = 0;
      g.dy = -n(H, 0.66);
    }
  }
  bounds(): Box {
    return { x: this.x - this.H * 0.25, y: this.y - this.H * 0.72, w: this.H * 0.5, h: this.H * 0.72 };
  }
  interaction(): Interaction {
    return { radius: this.H * 0.8, label: "", use: (w) => { w.sound("paper-open", 0.8, [this.x, this.y]); w.openPanel("archive"); } };
  }
  update(w: PropWorld): void {
    super.update(w);
    let push = 0;
    for (const p of w.pushes) if (Math.abs(p.x - this.x) < p.r) push += p.s;
    for (const g of this.page) g.swing = w.reduced ? 0 : Math.sin(this.t * 0.07) * 0.06 + push * 0.2 + this.sp.x * 0.05;
  }
}
recipe("lectern", "lectern", Lectern);

// ======================================================================================
// Bookshelf: tall shelves full of books and scrolls; its top is a platform.
// ======================================================================================
class Bookshelf extends StubProp {
  readonly recipe = "bookshelf";
  readonly reason = "The archive's shelves; climbable, like every good library.";
  readonly states = ["idle"] as const;
  private bw: number;
  private bh: number;
  constructor(p: PropParams, tex: TextureFactory) {
    super(p, tex, "idle");
    const H = this.H;
    this.collision = "platform";
    const bw = n(H, (p.w as number) ?? 1.2);
    const bh = n(H, (p.h as number) ?? 1.8);
    this.bw = bw;
    this.bh = bh;
    const c = new Cells(bw, bh);
    c.rect(0, 0, bw, bh, "wood", { tone: -2, profile: "flat" });
    c.rect(0, 0, n(H, 0.05), bh, "wood", { tone: 0 });
    c.rect(bw - n(H, 0.05), 0, n(H, 0.05), bh, "wood", { tone: 0 });
    const r = rng(p.seed ?? 61);
    const shelf = n(H, 0.36);
    const spines = [
      ["#2a1614", "#44221e", "#62322a"],
      ["#1a2230", "#2a3648", "#3e5068"],
      ["#2c2a1a", "#48442a", "#66603e"],
      ["#1e2a20", "#2e4030", "#445c46"],
      ["#6e685c", "#948c7a", "#b6ad96"],
    ];
    for (let y = shelf; y <= bh - 2; y += shelf) {
      c.rect(0, y - 2, bw, 3, "wood", { tone: 1 });
      let x = n(H, 0.06);
      while (x < bw - n(H, 0.08)) {
        const w = 2 + Math.floor(r() * 3);
        const hgt = Math.round(shelf * (0.55 + r() * 0.35));
        if (r() < 0.12) {
          x += w + 2;
          continue;
        }
        c.rect(x, y - 2 - hgt, w, hgt, "cloth", { ramp: spines[Math.floor(r() * spines.length)]!, profile: "cylinder" });
        x += w;
      }
    }
    c.rect(0, 0, bw, n(H, 0.05), "wood", { tone: 1 });
    this.addCells(c, Math.round(bw / 2), bh, "back");
  }
  bounds(): Box {
    return { x: this.x - this.bw / 2, y: this.y - this.bh, w: this.bw, h: this.bh };
  }
  solids(): Box[] {
    return [{ x: this.x - this.bw / 2, y: this.y - this.bh, w: this.bw, h: 0 }];
  }
  hit(h: PropHit, w: PropWorld): boolean {
    w.vfx("dust.kick", h.box.x + h.box.w / 2, h.box.y + h.box.h / 2, h.dir[0] >= 0 ? 1 : -1);
    w.sound("knock", 0.4, [this.x, this.y]);
    return true;
  }
}
recipe("bookshelf", "shelves", Bookshelf);

// ======================================================================================
// Candles: a cluster; flicker, light source; gutter out when hit, relight.
// ======================================================================================
class Candles extends StubProp {
  readonly recipe = "candles";
  readonly reason = "Candles in rows, kept lit by whoever passes; warm light for cozy rooms.";
  readonly states = ["lit", "out"] as const;
  private flames: Part[];
  private outFor = 0;
  constructor(p: PropParams, tex: TextureFactory) {
    super(p, tex, "lit");
    const H = this.H;
    const w = n(H, 0.36);
    const c = new Cells(w, n(H, 0.3));
    const f = new Cells(w, n(H, 0.3));
    const r = rng(p.seed ?? 71);
    for (let i = 0; i < 4; i++) {
      const x = 2 + Math.round((i / 3) * (w - 6));
      const h = n(H, 0.08 + r() * 0.14);
      c.rect(x, n(H, 0.3) - h, 3, h, "wax", { profile: "cylinder" });
      f.rect(x + 1, n(H, 0.3) - h - 3, 1, 3, "flame", { emissive: true, piece: 1, tone: 1 });
    }
    this.addCells(c, Math.round(w / 2), n(H, 0.3));
    this.flames = this.addCells(f, Math.round(w / 2), n(H, 0.3));
    this.layers.push("light");
  }
  bounds(): Box {
    return { x: this.x - this.H * 0.18, y: this.y - this.H * 0.3, w: this.H * 0.36, h: this.H * 0.3 };
  }
  hit(_h: PropHit, w: PropWorld): boolean {
    if (this.state === "lit") {
      this.state = "out";
      this.outFor = 60 * 5;
      w.sound("gutter", 0.5, [this.x, this.y]);
    }
    return true;
  }
  update(w: PropWorld): void {
    super.update(w);
    if (this.state === "out" && --this.outFor <= 0) this.state = "lit";
    for (const f of this.flames) {
      f.visible = this.state === "lit";
      f.oy = (this.t >> 3) % 3 === 0 ? -1 : 0;
    }
  }
  draw(c: PropCanvas, layer: PropLayer): void {
    super.draw(c, layer);
    if (layer === "light" && this.state === "lit") c.glow(this.x, this.y - this.H * 0.3, this.H * 0.5, warm, 0.32 * flicker(this.t, 2));
  }
  lights(out: PropLight[]): void {
    if (this.state === "lit") out.push({ x: this.x, y: this.y - this.H * 0.3, radius: this.H * 2.2, colour: warm, intensity: 0.7 * flicker(this.t, 2, 0.2), height: this.H * 0.2 });
  }
}
recipe("candles", "candles", Candles);

// ======================================================================================
// Hanging lamp on a chain: swings when hit, settles; a light source.
// ======================================================================================
class HangingLamp extends StubProp {
  readonly recipe = "hanging-lamp";
  readonly reason = "Lamps hung from the beams; they swing when struck and settle.";
  readonly states = ["idle", "swinging"] as const;
  private lamp: Part[];
  private chain: number;
  constructor(p: PropParams, tex: TextureFactory) {
    super(p, tex, "idle");
    const H = this.H;
    this.chain = Math.round((p.chain as number) ?? H * 0.8);
    this.sp.k = 0.018;
    this.sp.d = 0.985;
    const lw = n(H, 0.2);
    const lh = n(H, 0.28);
    const c = new Cells(lw, this.chain + lh);
    for (let y = 0; y < this.chain; y += 3) c.rect(Math.round(lw / 2) - 1, y, 2, 2, "iron", { tone: (y / 3) % 2 ? -1 : 0 });
    c.poly([2, this.chain, lw - 2, this.chain, lw, this.chain + 4, 0, this.chain + 4], "iron", { tone: 0 });
    c.rect(1, this.chain + 4, lw - 2, lh - 7, "glass", { tone: -1, profile: "flat" });
    c.rect(0, this.chain + lh - 3, lw, 3, "iron", { tone: -1 });
    c.rect(3, this.chain + 6, lw - 6, lh - 11, "flame", { emissive: true, piece: 1, tone: 0 });
    this.lamp = this.addCells(c, Math.round(lw / 2), 0, "middle", { pivotRow: 0 });
    this.layers.push("light");
  }
  bounds(): Box {
    return { x: this.x - this.H * 0.12, y: this.y, w: this.H * 0.24, h: this.chain + this.H * 0.28 };
  }
  private tip(): [number, number] {
    const a = this.sp.x * 0.02;
    return [this.x + Math.sin(a) * (this.chain + this.H * 0.14), this.y + Math.cos(a) * (this.chain + this.H * 0.14)];
  }
  hit(h: PropHit, w: PropWorld): boolean {
    this.sp.v += h.dir[0] * (h.heavy ? 3 : 1.8);
    this.state = "swinging";
    w.sound("chain", 0.6, [this.x, this.y]);
    return true;
  }
  update(w: PropWorld): void {
    super.update(w);
    for (const p of w.pushes) if (Math.hypot(p.x - this.x, p.y - (this.y + this.chain)) < p.r) this.sp.v += Math.sign(this.x - p.x) * p.s * 0.3;
    if (Math.abs(this.sp.x) < 0.05) this.state = "idle";
    for (const l of this.lamp) l.swing = this.sp.x * 0.02;
  }
  draw(c: PropCanvas, layer: PropLayer): void {
    super.draw(c, layer);
    if (layer === "light") {
      const [x, y] = this.tip();
      c.glow(x, y, this.H * 0.6, warm, 0.36 * flicker(this.t, 3));
    }
  }
  lights(out: PropLight[]): void {
    const [x, y] = this.tip();
    out.push({ x, y, radius: this.H * 3.2, colour: warm, intensity: 0.8 * flicker(this.t, 3, 0.15), height: this.H * 0.6 });
  }
}
recipe("hanging-lamp", "hanging lamp", HangingLamp);

// ======================================================================================
// Boss terminal: summons a warden. dormant -> woken (screen lights) ->
// summoning (beam and seal forming) -> cooling down. Bosses are out of scope
// for now: the summoning completes into a hook (world.onSummon) that the boss
// lane fills; without a boss it cools down and says nothing is there yet.
// ======================================================================================
class Terminal extends StubProp {
  readonly recipe = "terminal";
  readonly reason = "Every download in the world costs a fresh fight: the terminal calls a warden.";
  readonly states = ["dormant", "woken", "summoning", "cooling"] as const;
  private screen: Part[];
  private timer = 0;
  private tw: number;
  constructor(p: PropParams, tex: TextureFactory) {
    super(p, tex, "dormant");
    const H = this.H;
    const tw = n(H, 0.7);
    const th = n(H, 1.2);
    this.tw = tw;
    const c = new Cells(tw, th);
    c.poly([n(H, 0.1), th, tw - n(H, 0.1), th, tw - n(H, 0.18), n(H, 0.45), n(H, 0.18), n(H, 0.45)], "iron", { tone: -1 });
    c.rect(0, 0, tw, n(H, 0.5), "iron", { tone: 0 });
    c.rect(n(H, 0.06), n(H, 0.06), tw - n(H, 0.12), n(H, 0.34), "iron", { tone: -2, profile: "flat" });
    c.rect(n(H, 0.12), n(H, 0.62), tw - n(H, 0.24), 2, "brass", { tone: 0 });
    c.ascii(Math.round(tw / 2) - 3, n(H, 0.78), ["..g..", ".ggg.", "ggggg", ".ggg.", "..g.."], { g: ["brass", -1] });
    this.addCells(c, Math.round(tw / 2), th);
    const s = new Cells(tw, th);
    s.rect(n(H, 0.08), n(H, 0.08), tw - n(H, 0.16), n(H, 0.3), "glass", { emissive: true, piece: 1, ramp: ["#1c3a44", "#2e6474", "#5aa0ae", "#a6e0e6"] });
    for (let y = n(H, 0.12); y < n(H, 0.36); y += 3) s.rect(n(H, 0.12), y, Math.round((tw - n(H, 0.24)) * (0.4 + ((y * 37) % 7) / 10)), 1, "glass", { emissive: true, piece: 1, ramp: ["#6ec4d0", "#a6e0e6", "#e6fbff"] });
    this.screen = this.addCells(s, Math.round(tw / 2), th);
    this.layers.push("light");
  }
  bounds(): Box {
    return { x: this.x - this.tw / 2, y: this.y - this.H * 1.2, w: this.tw, h: this.H * 1.2 };
  }
  interaction(): Interaction | null {
    if (this.state !== "dormant" && this.state !== "woken") return null;
    return {
      radius: this.H * 0.9,
      label: "",
      use: (w) => {
        this.state = "summoning";
        this.timer = 150;
        w.sound("telegraph", 0.9, [this.x, this.y]);
        w.openPanel("summon", this.id);
      },
    };
  }
  update(w: PropWorld): void {
    super.update(w);
    const near = Math.abs(w.player.x - this.x) < this.H * 2.5;
    if (this.state === "dormant" && near) this.state = "woken";
    else if (this.state === "woken" && !near) this.state = "dormant";
    else if (this.state === "summoning" && --this.timer <= 0) {
      this.state = "cooling";
      this.timer = 60 * 6;
      w.openPanel("summoned", this.id);
    } else if (this.state === "cooling" && --this.timer <= 0) this.state = "dormant";
    for (const s of this.screen) {
      s.visible = this.state !== "dormant" && !(this.state === "cooling" && this.t % 40 < 20);
      s.oy = 0;
    }
  }
  draw(c: PropCanvas, layer: PropLayer): void {
    super.draw(c, layer);
    if (layer !== "light") return;
    if (this.state === "summoning") {
      const k = 1 - this.timer / 150;
      // beam: a column of light rising from the seal, stepped
      const bh = Math.round(this.H * 4 * k);
      for (let y = 0; y < bh; y += 2) c.rect(this.x - 1 - Math.round(k * 3), this.y - this.H * 1.2 - y, 2 + Math.round(k * 6), 1, [0.6, 0.9, 1], 0.5 * (1 - y / Math.max(1, bh)));
      c.glow(this.x, this.y - this.H * 0.9, this.H * (0.6 + k), [0.45, 0.85, 1], 0.4);
    } else if (this.state !== "dormant") c.glow(this.x, this.y - this.H * 0.95, this.H * 0.5, [0.45, 0.85, 1], 0.2);
  }
  lights(out: PropLight[]): void {
    if (this.state === "dormant") return;
    const k = this.state === "summoning" ? 1.4 : 0.55;
    out.push({ x: this.x, y: this.y - this.H * 0.95, radius: this.H * 2.4, colour: [0.5, 0.85, 1], intensity: k, height: this.H * 0.4 });
  }
}
recipe("terminal", "boss terminal", Terminal);

// ======================================================================================
// Artwork frame: one of Dex's pieces, shown on its own when you use it. The art
// itself is display only (never scenery or texture): the frame holds a soft
// light; E opens the piece in the gallery panel.
// ======================================================================================
class ArtworkFrame extends StubProp {
  readonly recipe = "artwork-frame";
  readonly reason = "Dex's illustrations, inspected one at a time (display only).";
  readonly states = ["idle"] as const;
  readonly art: string;
  private fw: number;
  private fh: number;
  constructor(p: PropParams, tex: TextureFactory) {
    super(p, tex, "idle");
    const H = this.H;
    this.art = (p.art as string) ?? "01";
    const fw = n(H, 1.1);
    const fh = n(H, 0.64);
    this.fw = fw;
    this.fh = fh;
    // the piece itself is never drawn into the world (display only): the frame holds a
    // dark velvet ground behind glass with a glint; E shows the piece on its own
    const c = new Cells(fw, fh);
    c.rect(0, 0, fw, fh, "gold", { tone: -1 });
    c.rect(2, 2, fw - 4, 1, "gold", { tone: 1, profile: "flat" });
    c.rect(3, 3, fw - 6, fh - 6, "cloth", { ramp: ["#0c0a0e", "#141118", "#1c1822", "#26202c"], profile: "flat" });
    c.stroke([Math.round(fw * 0.62), 5, Math.round(fw * 0.82), fh - 6], 1, "glass", { tone: 1 });
    c.stroke([Math.round(fw * 0.7), 5, Math.round(fw * 0.86), Math.round(fh * 0.55)], 1, "glass", { tone: 0 });
    this.addCells(c, Math.round(fw / 2), fh, "back");
    this.layers.push("light");
  }
  bounds(): Box {
    return { x: this.x - this.fw / 2, y: this.y - this.fh, w: this.fw, h: this.fh };
  }
  interaction(): Interaction {
    return { radius: this.H * 1.2, label: "", use: (w) => w.openPanel("gallery", this.art) };
  }
  hit(): boolean {
    return false;
  }
  draw(c: PropCanvas, layer: PropLayer): void {
    super.draw(c, layer);
    if (layer === "light") c.glow(this.x, this.y - this.fh / 2, this.fw * 0.7, [1, 0.94, 0.8], 0.14);
  }
}
recipe("artwork-frame", "artwork", ArtworkFrame);

// ======================================================================================
// Crate: stacked goods. Hits crack it (damaged), then it breaks into a low pile.
// ======================================================================================
class Crate extends StubProp {
  readonly recipe = "crate";
  readonly reason = "Stores for the house; something to break.";
  readonly states = ["idle", "damaged", "broken"] as const;
  private whole: Part[];
  private cracked: Part[];
  private rubble: Part[];
  private hp = 3;
  private s: number;
  constructor(p: PropParams, tex: TextureFactory) {
    super(p, tex, "idle");
    const H = this.H;
    const s = n(H, (p.size as number) ?? 0.42);
    this.s = s;
    this.collision = "platform";
    const mk = (cracks: boolean): Cells => {
      const c = new Cells(s, s);
      c.rect(0, 0, s, s, "wood", { tone: 0 });
      c.rect(0, 0, s, 2, "wood", { tone: 1 });
      c.stroke([1, 1, s - 2, s - 2], 1, "wood", { tone: -2 });
      c.rect(0, 0, 2, s, "wood", { tone: -1 });
      c.rect(s - 2, 0, 2, s, "wood", { tone: -1 });
      if (cracks) c.stroke([Math.round(s * 0.6), 2, Math.round(s * 0.45), Math.round(s * 0.5), Math.round(s * 0.7), s - 3], 1, "wood", { tone: -2 });
      c.grain(p.seed ?? 81, 0.4, 2);
      return c;
    };
    this.whole = this.addCells(mk(false), Math.round(s / 2), s);
    this.cracked = this.addCells(mk(true), Math.round(s / 2), s);
    const rb = new Cells(s + 6, Math.round(s * 0.35));
    const r = rng(p.seed ?? 81);
    for (let i = 0; i < 7; i++) rb.rect(Math.round(r() * (s + 2)), Math.round(r() * s * 0.2), 3 + Math.round(r() * 5), 2, "wood", { tone: Math.round(r() * 2 - 1) });
    this.rubble = this.addCells(rb, Math.round((s + 6) / 2), Math.round(s * 0.35));
  }
  bounds(): Box {
    return { x: this.x - this.s / 2, y: this.y - this.s, w: this.s, h: this.s };
  }
  solids(): Box[] {
    return this.state === "broken" ? [] : [{ x: this.x - this.s / 2, y: this.y - this.s, w: this.s, h: 0 }];
  }
  hit(h: PropHit, w: PropWorld): boolean {
    if (this.state === "broken") return false;
    this.hp -= h.heavy ? 2 : 1;
    this.sp.v += h.dir[0] * 1.5;
    w.sound("wood-hit", 0.7, [this.x, this.y]);
    w.vfx("dust.kick", this.x, this.y - this.s / 2, h.dir[0] >= 0 ? 1 : -1);
    if (this.hp <= 0) {
      this.state = "broken";
      w.sound("wood-break", 0.8, [this.x, this.y]);
    } else this.state = "damaged";
    return true;
  }
  update(w: PropWorld): void {
    super.update(w);
    for (const p of this.whole) p.visible = this.state === "idle";
    for (const p of this.cracked) p.visible = this.state === "damaged";
    for (const p of this.rubble) p.visible = this.state === "broken";
    for (const p of this.parts) p.ox = Math.round(this.sp.x);
  }
}
recipe("crate", "crates", Crate);

// ======================================================================================
// Lift: a platform on cables between two stops, with a counterweight. Stand on
// it and use (E) to ride; it keys between stops with easing.
// ======================================================================================
class Lift extends StubProp {
  readonly recipe = "lift";
  readonly reason = "The house's two floors are joined by an old goods lift.";
  readonly states = ["idle", "moving"] as const;
  private stops: number[];
  private at = 0;
  private from = 0;
  private to = 0;
  private k = 1;
  private lw: number;
  /** Motion this tick (the room carries whoever stands on it). */
  readonly mover = { dx: 0, dy: 0 };
  private top: number;
  private plat: Part[];
  constructor(p: PropParams, tex: TextureFactory) {
    super(p, tex, "idle");
    const H = this.H;
    this.collision = "platform";
    this.stops = (p.stops as number[]) ?? [p.y, p.y - H * 5];
    this.top = Math.min(...this.stops) - H * 1.6;
    const lw = n(H, 1.2);
    this.lw = lw;
    const c = new Cells(lw, n(H, 0.16));
    c.rect(0, 0, lw, n(H, 0.1), "iron", { tone: 0 });
    c.rect(0, 0, lw, 2, "iron", { tone: 1 });
    c.rect(2, n(H, 0.1), lw - 4, n(H, 0.06), "wood", { tone: -1 });
    for (let x = 4; x < lw - 4; x += 6) c.rect(x, 3, 1, n(H, 0.06), "iron", { tone: -2, profile: "flat" });
    this.plat = this.addCells(c, Math.round(lw / 2), 0);
    this.y = this.stops[0]!;
    this.to = this.from = this.at = 0;
  }
  bounds(): Box {
    return { x: this.x - this.lw / 2, y: this.top, w: this.lw, h: Math.max(...this.stops) - this.top + this.H * 0.2 };
  }
  solids(): Box[] {
    return [{ x: this.x - this.lw / 2, y: this.y, w: this.lw, h: 0 }];
  }
  interaction(): Interaction | null {
    if (this.state === "moving") return null;
    return {
      radius: this.H * 0.7,
      label: "",
      use: (w) => {
        this.from = this.at;
        this.to = (this.at + 1) % this.stops.length;
        this.k = 0;
        this.state = "moving";
        w.sound("lift-start", 0.8, [this.x, this.y]);
      },
    };
  }
  /** The prompt follows the platform. */
  get promptY(): number {
    return this.y;
  }
  update(w: PropWorld): void {
    super.update(w);
    const y0 = this.y;
    if (this.state === "moving") {
      const dist = Math.abs(this.stops[this.to]! - this.stops[this.from]!);
      this.k = Math.min(1, this.k + (this.H * 1.4) / 60 / Math.max(1, dist));
      const e = this.k < 0.5 ? 2 * this.k * this.k : 1 - Math.pow(-2 * this.k + 2, 2) / 2;
      this.y = Math.round(this.stops[this.from]! + (this.stops[this.to]! - this.stops[this.from]!) * e);
      if (this.k >= 1) {
        this.state = "idle";
        this.at = this.to;
        w.sound("lift-dock", 0.8, [this.x, this.y]);
      }
    }
    this.mover.dy = this.y - y0;
    for (const p of this.plat) p.oy = 0;
  }
  draw(c: PropCanvas, layer: PropLayer): void {
    if (layer === "middle") {
      // cables to the head frame, and the counterweight going the other way
      const cy = this.top;
      for (const dx of [-this.lw / 2 + 3, this.lw / 2 - 4]) c.rect(this.x + dx, cy, 1, this.y - cy, [0.2, 0.21, 0.24]);
      c.rect(this.x - this.lw / 2 - 4, cy - 4, this.lw + 8, 4, [0.16, 0.17, 0.2]);
      const span = Math.max(...this.stops) - Math.min(...this.stops);
      const cwY = Math.min(...this.stops) + (Math.max(...this.stops) - this.y) - span * 0.1;
      c.rect(this.x + this.lw / 2 + 6, cy, 1, cwY - cy, [0.2, 0.21, 0.24]);
      c.rect(this.x + this.lw / 2 + 3, cwY, 7, Math.round(this.H * 0.3), [0.18, 0.19, 0.22]);
    }
    super.draw(c, layer);
  }
}
recipe("lift", "lift", Lift);
export { Lift };

// ======================================================================================
// House front: a small stone house at the edge of the plain, a warm window,
// a pitched roof. Its door (a separate door prop) leads inside. Shelter.
// ======================================================================================
class HouseFront extends StubProp {
  readonly recipe = "house-front";
  readonly reason = "Shelter at the far side of the storm: a lit window you walk toward.";
  readonly states = ["idle"] as const;
  private hw: number;
  private hh: number;
  private lit: Part[];
  constructor(p: PropParams, tex: TextureFactory) {
    super(p, tex, "idle");
    const H = this.H;
    const hw = n(H, (p.w as number) ?? 4.2);
    const wallH = n(H, 2.2);
    const roofH = n(H, 1.3);
    const hh = wallH + roofH;
    this.hw = hw;
    this.hh = hh;
    const c = new Cells(hw + n(H, 0.5), hh + 2);
    const ox = n(H, 0.25);
    const base = hh + 1;
    // wall: coursed stone with a darker footing
    c.rect(ox, base - wallH, hw, wallH, "stone", { tone: 0, profile: "flat" });
    const course = n(H, 0.18);
    for (let y = base - wallH + course; y < base; y += course) c.rect(ox, y, hw, 1, "stone", { tone: -2, profile: "flat" });
    const r = rng(p.seed ?? 91);
    for (let y = base - wallH; y < base; y += course) {
      let x = ox + Math.round(r() * n(H, 0.3));
      while (x < ox + hw) {
        c.rect(x, y + 1, 1, course - 1, "stone", { tone: -2, profile: "flat" });
        x += n(H, 0.3) + Math.round(r() * n(H, 0.25));
      }
    }
    c.rect(ox, base - n(H, 0.2), hw, n(H, 0.2), "stone", { tone: -1 });
    // roof: dark slate, overhanging
    c.poly([0, base - wallH, hw + ox * 2, base - wallH, ox + hw / 2 + n(H, 0.4), base - hh, ox + hw / 2 - n(H, 0.4), base - hh], "iron", { tone: -1 });
    for (let y = base - hh + 4; y < base - wallH; y += 4) c.rect(0, y, hw + ox * 2, 1, "iron", { tone: -2, profile: "flat" });
    c.rect(0, base - wallH - 2, hw + ox * 2, 3, "wood", { tone: 0 });
    // chimney
    c.rect(ox + Math.round(hw * 0.72), base - hh - n(H, 0.2), n(H, 0.3), n(H, 0.7), "stone", { tone: 0 });
    // window frame (dark) where the warm light shows
    const wx = ox + Math.round(hw * 0.68);
    const wy = base - wallH + n(H, 0.55);
    c.rect(wx - 2, wy - 2, n(H, 0.62) + 4, n(H, 0.72) + 4, "wood", { tone: -1 });
    c.grain(p.seed ?? 91, 0.45, 3);
    this.addCells(c, Math.round((hw + ox * 2) / 2), base, "back");
    const lw = new Cells(hw + n(H, 0.5), hh + 2);
    lw.rect(wx, wy, n(H, 0.62), n(H, 0.72), "flame", { emissive: true, piece: 1, tone: 0, ramp: ["#6d3f1c", "#b4702e", "#e8a050", "#f8cf88"] });
    lw.rect(wx + Math.round(n(H, 0.62) / 2) - 1, wy, 2, n(H, 0.72), "wood", { piece: 1, tone: -2, profile: "flat" });
    lw.rect(wx, wy + Math.round(n(H, 0.72) * 0.45), n(H, 0.62), 2, "wood", { piece: 1, tone: -2, profile: "flat" });
    this.lit = this.addCells(lw, Math.round((hw + ox * 2) / 2), base, "back");
    for (const l of this.lit) l.lit = 0;
    this.layers.push("light");
  }
  bounds(): Box {
    return { x: this.x - this.hw / 2, y: this.y - this.hh, w: this.hw, h: this.hh };
  }
  hit(h: PropHit, w: PropWorld): boolean {
    w.vfx("dust.kick", h.box.x + h.box.w / 2, h.box.y + h.box.h / 2, h.dir[0] >= 0 ? -1 : 1);
    w.sound("stone", 0.5, [this.x, this.y]);
    return true;
  }
  private windowAt(): [number, number] {
    const H = this.H;
    return [this.x - this.hw / 2 - n(H, 0.25) + n(H, 0.25) + Math.round(this.hw * 0.68) + n(H, 0.31), this.y - n(H, 2.2) + n(H, 0.55) + n(H, 0.36)];
  }
  draw(c: PropCanvas, layer: PropLayer): void {
    super.draw(c, layer);
    if (layer === "light") {
      const [x, y] = this.windowAt();
      c.glow(x, y, this.H * 0.9, warm, 0.3 * flicker(this.t, 6, 0.2));
    }
  }
  lights(out: PropLight[]): void {
    const [x, y] = this.windowAt();
    out.push({ x, y, radius: this.H * 3, colour: warm, intensity: 0.7 * flicker(this.t, 6, 0.15), height: this.H * 0.8 });
  }
}
recipe("house-front", "house", HouseFront);

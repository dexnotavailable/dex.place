// The runtime's mechanism props, on the stub engine: the pieces the round
// needs to be walkable before the pixel-matter kit replaces them. Each one is
// a real object with states (not a trigger box), sized from H, and each keeps
// its save flags in the WORLD-PLAN section 11 names:
//
//   shrine     a shrine lantern (1.5 H): out, lit; E rests (shrine:<n>, the rest place)
//   lamp-post  a lamp post (2.5 H), dark until shrine:<n> is lit, then lit in sequence
//   lever      thrown by E; sets a flag (lever:culvert, lever:express), signals a prop
//   rope-bridge  a deck hauled up against the east post by a rope; slash the rope
//              (from the east bank) and the deck swings down and stays down (cut:<id>)
//   carrier    a moving floor between stops, keyed with easing at a speed in H/s:
//              the spire lift (with an express stop behind lever:express), the crane
//              hook, the ferry; it carries the rider and can hold the controls
//   boat       the moored ferry: E (once lever:culvert is set) sails you away (a door
//              protocol: justOpened, the room's doors table says where)
//
// The pixel-matter lanes replace the looks; the mechanics and flag names stay.

import type { Box, Interaction, PropHit, PropLight, PropParams, PropWorld, PropCanvas, PropLayer } from "../props-api.ts";
import { Cells, StubProp, type Part, type StubEngine, type TextureFactory } from "./stub.ts";

const n = (H: number, k: number): number => Math.max(1, Math.round(H * k));
const warm: [number, number, number] = [1, 0.74, 0.42];

function flicker(t: number, seed: number, depth = 0.2): number {
  const k = Math.floor(t / 13 + seed * 7);
  const x = Math.sin(k * 127.1 + seed * 311.7) * 43758.5453;
  return 1 - depth * Math.floor((x - Math.floor(x)) * 4) / 4;
}

// ======================================================================================
// Shrine lantern: out until you rest here; resting lights it for the save.
// ======================================================================================
class Shrine extends StubProp {
  readonly recipe = "shrine";
  readonly reason = "The storm blew the shrine lamps out; resting at one lights it again, so the next traveller can find the way.";
  readonly states = ["out", "lit"] as const;
  readonly n: number;
  private flame: Part[];
  private glass: Part[];
  private lightUp = 0;
  constructor(p: PropParams, tex: TextureFactory) {
    super(p, tex, "out");
    this.n = Number(p.n ?? 1);
    const H = this.H;
    const w = n(H, 0.42);
    const h = n(H, 1.5);
    const c = new Cells(w + 6, h + 2);
    const cx = (w + 6) / 2;
    const base = h + 1;
    c.rect(cx - w / 2, base - n(H, 0.14), w, n(H, 0.14), "stone", { tone: -1 });
    c.rect(cx - n(H, 0.07), base - n(H, 1.02), n(H, 0.14), n(H, 0.9), "stone", { profile: "cylinder" });
    c.rect(cx - n(H, 0.16), base - n(H, 1.3), n(H, 0.32), n(H, 0.3), "stone", { tone: 0 });
    c.poly([cx - n(H, 0.22), base - n(H, 1.3), cx + n(H, 0.22), base - n(H, 1.3), cx, base - n(H, 1.48)], "stone", { tone: 1 });
    c.grain(p.seed ?? 5, 0.5, 3);
    this.addCells(c, Math.round(cx), base);
    const g = new Cells(w + 6, h + 2);
    g.rect(cx - n(H, 0.1), base - n(H, 1.26), n(H, 0.2), n(H, 0.22), "iron", { tone: -2, profile: "flat", piece: 1 });
    this.glass = this.addCells(g, Math.round(cx), base);
    const f = new Cells(w + 6, h + 2);
    f.ellipse(cx, base - n(H, 1.15), n(H, 0.05), n(H, 0.07), "flame", { piece: 2, emissive: true, tone: 1 });
    this.flame = this.addCells(f, Math.round(cx), base);
    this.layers.push("light");
    if (p.lit) this.state = "lit";
  }
  bounds(): Box {
    return { x: this.x - this.H * 0.21, y: this.y - this.H * 1.5, w: this.H * 0.42, h: this.H * 1.5 };
  }
  interaction(): Interaction {
    return {
      radius: this.H * 0.8,
      label: "",
      use: (w) => {
        if (this.state !== "lit") {
          this.state = "lit";
          this.lightUp = 40;
          w.sound("chime", 0.6, [this.x, this.y]);
        }
        w.openPanel("rest", `shrine:${this.n}`);
      },
    };
  }
  update(w: PropWorld): void {
    super.update(w);
    if (this.state === "out" && w.save.get(`shrine:${this.n}`)) this.state = "lit";
    if (this.lightUp > 0) this.lightUp--;
    for (const f of this.flame) {
      f.visible = this.state === "lit" && (this.lightUp === 0 || this.lightUp % 6 < 4);
      f.oy = this.t % 26 < 13 ? 0 : -1;
    }
    for (const g of this.glass) g.visible = this.state !== "lit";
  }
  draw(c: PropCanvas, layer: PropLayer): void {
    super.draw(c, layer);
    if (layer === "light" && this.state === "lit") c.glow(this.x, this.y - this.H * 1.15, this.H * 0.6, warm, 0.5 * flicker(this.t, this.n));
  }
  lights(out: PropLight[]): void {
    if (this.state !== "lit") return;
    out.push({ x: this.x, y: this.y - this.H * 1.15, radius: this.H * 3, colour: warm, intensity: 0.9 * flicker(this.t, this.n, 0.12), height: this.H * 0.4 });
  }
}

// ======================================================================================
// Lamp post: dark until its shrine is lit; then it comes on after its place in the line.
// ======================================================================================
class LampPost extends StubProp {
  readonly recipe = "lamp-post";
  readonly reason = "Lamp posts along the colossi's route; lighting a shrine lights them toward the next one, as if they share one wick.";
  readonly states = ["off", "lit"] as const;
  private flame: Part[];
  private readonly shrine: number;
  private readonly order: number;
  private wait = -1;
  constructor(p: PropParams, tex: TextureFactory) {
    super(p, tex, "off");
    this.shrine = Number(p.shrine ?? 1);
    this.order = Number(p.order ?? 0);
    const H = this.H;
    const h = n(H, 2.5);
    const w = n(H, 0.5);
    const c = new Cells(w + 4, h + 2);
    const cx = Math.round((w + 4) / 2);
    const base = h + 1;
    c.rect(cx - n(H, 0.1), base - n(H, 0.12), n(H, 0.2), n(H, 0.12), "iron", { tone: -1 });
    c.rect(cx - 1, base - n(H, 2.2), 3, n(H, 2.1), "iron", { profile: "cylinder" });
    c.rect(cx - n(H, 0.13), base - n(H, 2.45), n(H, 0.26), n(H, 0.26), "iron", { tone: 0 });
    c.rect(cx - n(H, 0.08), base - n(H, 2.4), n(H, 0.16), n(H, 0.16), "glass", { tone: -1, profile: "flat" });
    this.addCells(c, cx, base);
    const f = new Cells(w + 4, h + 2);
    f.rect(cx - n(H, 0.07), base - n(H, 2.39), n(H, 0.14), n(H, 0.14), "flame", { emissive: true, piece: 1, tone: 1 });
    this.flame = this.addCells(f, cx, base);
    this.layers.push("light");
    if (p.lit) this.state = "lit";
  }
  bounds(): Box {
    return { x: this.x - this.H * 0.15, y: this.y - this.H * 2.5, w: this.H * 0.3, h: this.H * 2.5 };
  }
  update(w: PropWorld): void {
    super.update(w);
    if (this.state === "off" && w.save.get(`shrine:${this.shrine}`)) {
      if (this.wait < 0) this.wait = Math.round(this.order * 0.35 * 60) + 20;
      else if (--this.wait <= 0) {
        this.state = "lit";
        w.sound("clink", 0.25, [this.x, this.y]);
      }
    }
    for (const f of this.flame) f.visible = this.state === "lit";
  }
  /** Built already lit (the save says so): no sequence. */
  receive(msg: string): void {
    if (msg === "lit") this.state = "lit";
  }
  draw(c: PropCanvas, layer: PropLayer): void {
    super.draw(c, layer);
    if (layer === "light" && this.state === "lit") c.glow(this.x, this.y - this.H * 2.32, this.H * 0.5, warm, 0.4 * flicker(this.t, this.order + 3));
  }
  lights(out: PropLight[]): void {
    if (this.state === "lit") out.push({ x: this.x, y: this.y - this.H * 2.32, radius: this.H * 3.2, colour: warm, intensity: 0.7 * flicker(this.t, this.order + 3, 0.1), height: this.H * 1.2 });
  }
}

// ======================================================================================
// Lever: E throws it. Sets its flag (saved), signals a prop, stays thrown if permanent.
// ======================================================================================
class Lever extends StubProp {
  readonly recipe = "lever";
  readonly reason = "Machinery people left along the route: a lever lifts a gate, calls a hook, or sends the lift up without stopping.";
  readonly states = ["up", "down"] as const;
  private readonly flag: string | null;
  private readonly permanent: boolean;
  private readonly target: string | null;
  private readonly msg: string;
  private angle = -0.6;
  constructor(p: PropParams, tex: TextureFactory) {
    super(p, tex, "up");
    this.flag = (p.flag as string) ?? null;
    this.permanent = !!p.permanent;
    this.target = (p.target as string) ?? null;
    this.msg = (p.msg as string) ?? "call";
    const H = this.H;
    const c = new Cells(n(H, 0.5), n(H, 0.3));
    c.rect(0, n(H, 0.1), n(H, 0.5), n(H, 0.2), "iron", { tone: 0, profile: "bevel" });
    c.rect(n(H, 0.08), n(H, 0.14), n(H, 0.34), n(H, 0.04), "iron", { tone: -2, profile: "flat" });
    this.addCells(c, n(H, 0.25), n(H, 0.3));
    if (p.down) this.state = "down";
  }
  bounds(): Box {
    return { x: this.x - this.H * 0.3, y: this.y - this.H * 0.9, w: this.H * 0.6, h: this.H * 0.9 };
  }
  interaction(): Interaction | null {
    if (this.permanent && this.state === "down") return null;
    return {
      radius: this.H * 0.7,
      label: "",
      use: (w) => {
        this.state = this.state === "up" || this.permanent ? "down" : "up";
        if (this.flag) w.save.set(this.flag, true);
        if (this.target) w.signal(this.target, this.msg);
        w.sound("latch", 0.9, [this.x, this.y]);
      },
    };
  }
  update(w: PropWorld): void {
    super.update(w);
    if (this.permanent && this.flag && w.save.get(this.flag)) this.state = "down";
    const want = this.state === "down" ? 0.6 : -0.6;
    this.angle += (want - this.angle) * 0.2;
  }
  draw(c: PropCanvas, layer: PropLayer): void {
    super.draw(c, layer);
    if (layer !== "middle") return;
    const H = this.H;
    const len = H * 0.7;
    const bx = this.x;
    const by = this.y - H * 0.22;
    const steps = Math.round(len / 2);
    for (let i = 0; i <= steps; i++) {
      const k = i / steps;
      c.rect(Math.round(bx + Math.sin(this.angle) * len * k), Math.round(by - Math.cos(this.angle) * len * k), 3, 2, [0.28, 0.3, 0.34]);
    }
    c.rect(Math.round(bx + Math.sin(this.angle) * len) - 3, Math.round(by - Math.cos(this.angle) * len) - 3, 7, 6, [0.55, 0.16, 0.14]);
  }
}

// ======================================================================================
// Rope bridge: the deck stands hauled up against the east post by a rope. A slash
// through the rope (you can only reach it from the east bank) lets it swing down
// across the channel, and it stays down for the save.
// ======================================================================================
class RopeBridge extends StubProp {
  readonly recipe = "rope-bridge";
  readonly reason = "A lowering bridge over the reed channel, hauled up from the far side: cut it once and the slow wade is behind you for good.";
  readonly states = ["raised", "swinging", "lowered"] as const;
  /** Deck angle: pi/2 raised (standing against the east post), 0 lowered. */
  private a = Math.PI / 2;
  private va = 0;
  private readonly span: number;
  private readonly postH: number;
  constructor(p: PropParams, tex: TextureFactory) {
    super(p, tex, "raised");
    this.span = Number(p.span ?? this.H * 6);
    this.postH = n(this.H, 1.9);
    this.collision = "platform";
    if (p.cut) {
      this.state = "lowered";
      this.a = 0;
    }
    this.layers = ["middle"];
  }
  /** The east post's x (the hinge). The prop's x is the west end of the span. */
  private get hx(): number {
    return this.x + this.span;
  }
  bounds(): Box {
    return { x: this.x, y: this.y - this.span - this.H * 0.5, w: this.span + this.H * 0.3, h: this.span + this.H * 0.5 };
  }
  solids(): Box[] {
    return this.state === "lowered" ? [{ x: this.x - 2, y: this.y, w: this.span + 4, h: 0 }] : [];
  }
  /** The rope: from the post top down to the deck's top end. */
  private ropeBox(): Box {
    const topX = this.hx - Math.cos(this.a) * this.span;
    return { x: Math.min(topX, this.hx) - 4, y: this.y - this.postH, w: Math.abs(this.hx - topX) + this.H * 0.4, h: this.postH };
  }
  hit(h: PropHit, w: PropWorld): boolean {
    if (this.state !== "raised") return false;
    const r = this.ropeBox();
    const b = h.box;
    if (b.x < r.x + r.w && b.x + b.w > r.x && b.y < r.y + r.h && b.y + b.h > r.y) {
      this.state = "swinging";
      this.va = -0.01;
      w.save.set(`cut:${this.id}`, true);
      w.sound("cable-cut", 0.9, [this.hx, this.y - this.postH]);
      return true;
    }
    return false;
  }
  update(w: PropWorld): void {
    super.update(w);
    if (this.state === "swinging") {
      this.va -= 0.0045 * Math.cos(this.a) + 0.001;
      this.a += this.va;
      if (this.a <= 0) {
        this.a = 0;
        if (Math.abs(this.va) > 0.02) {
          this.va = -this.va * 0.25;
          w.sound("wood-hit", 0.8, [this.x + this.span / 2, this.y]);
        } else {
          this.va = 0;
          this.state = "lowered";
        }
      }
    }
  }
  draw(c: PropCanvas, layer: PropLayer): void {
    if (layer !== "middle") return;
    const H = this.H;
    // east post
    c.rect(this.hx, this.y - this.postH, n(H, 0.14), this.postH + n(H, 0.4), [0.26, 0.19, 0.13]);
    c.rect(this.x - n(H, 0.14), this.y - n(H, 0.3), n(H, 0.14), n(H, 0.7), [0.22, 0.16, 0.11]);
    // deck, planks along the angle from the hinge
    const steps = Math.ceil(this.span / 3);
    for (let i = 0; i <= steps; i++) {
      const k = i / steps;
      const px = this.hx - Math.cos(this.a) * this.span * k;
      const py = this.y - Math.sin(this.a) * this.span * k;
      c.rect(Math.round(px) - 1, Math.round(py) - 1, 4, n(H, 0.12), i % 6 === 0 ? [0.2, 0.14, 0.1] : [0.36, 0.26, 0.17]);
    }
    // rope, while it holds
    if (this.state === "raised") {
      const tx = this.hx - Math.cos(this.a) * this.span;
      const ty = this.y - Math.sin(this.a) * this.span;
      const sx = this.hx + 2;
      const sy = this.y - this.postH;
      const len = Math.max(Math.abs(tx - sx), Math.abs(ty - sy));
      for (let i = 0; i <= len; i += 2) c.rect(Math.round(sx + ((tx - sx) * i) / len), Math.round(sy + ((ty - sy) * i) / len), 2, 2, [0.5, 0.4, 0.28]);
    }
  }
}

// ======================================================================================
// Carrier: a moving floor between stops with keyed, eased motion at a speed in H/s.
// Stops may need a flag (the express stop needs lever:express). E while standing on it
// goes on; call:<i> / go:<i> signals send it to a stop.
// ======================================================================================
interface Stop {
  x: number;
  y: number;
  /** The stop is only served once this save flag is set (the express stop: lever:express). */
  flag?: string;
  /** Average speed in H/s for trips to this stop (the express runs faster). */
  speed?: number;
}

class Carrier extends StubProp {
  readonly recipe = "carrier";
  readonly reason = "Moving floors carry you where walking can't: the crane hook into the hollow, the spire lift, the ferry across the lake.";
  readonly states = ["idle", "moving"] as const;
  private stops: Stop[];
  at = 0;
  private from = 0;
  private to = 0;
  private k = 1;
  private readonly speed: number;
  private readonly cw: number;
  private readonly variant: string;
  readonly holdsRider: boolean;
  readonly mover = { dx: 0, dy: 0 };
  private readonly top: number;
  private delay = 0;
  private pending = -1;
  constructor(p: PropParams, tex: TextureFactory) {
    super(p, tex, "idle");
    this.collision = "platform";
    this.stops = (p.stops as Stop[]) ?? [{ x: p.x, y: p.y }];
    this.speed = Number(p.speed ?? 2);
    this.cw = n(this.H, Number(p.w ?? 1.4));
    this.variant = (p.variant as string) ?? "lift";
    this.holdsRider = p.hold !== false;
    this.top = (p.top as number) ?? Math.min(...this.stops.map((s) => s.y)) - this.H * 2;
    this.x = this.stops[0]!.x;
    this.y = this.stops[0]!.y;
    this.layers = ["back", "middle"];
  }
  get moving(): boolean {
    return this.state === "moving";
  }
  bounds(): Box {
    return { x: this.x - this.cw / 2, y: this.y - this.H * 0.3, w: this.cw, h: this.H * 0.5 };
  }
  solids(): Box[] {
    return [{ x: this.x - this.cw / 2, y: this.y, w: this.cw, h: 0 }];
  }
  private ok(i: number, w: PropWorld): boolean {
    const f = this.stops[i]?.flag;
    return !!this.stops[i] && (!f || w.save.get(f));
  }
  /** Where E goes from here: from the first stop to the furthest available one; from anywhere else back to the first. */
  private next(w: PropWorld): number {
    if (this.at !== 0) return 0;
    for (let i = this.stops.length - 1; i > 0; i--) if (this.ok(i, w)) return i;
    return 0;
  }
  interaction(): Interaction | null {
    if (this.state === "moving" || this.stops.length < 2) return null;
    return { radius: this.cw * 0.6, label: "", use: (w) => this.goStop(this.next(w), w) };
  }
  snapStop(i: number): void {
    const s = this.stops[i];
    if (!s) return;
    this.at = this.from = this.to = i;
    this.k = 1;
    this.x = s.x;
    this.y = s.y;
    this.state = "idle";
  }
  goStop(i: number, w: PropWorld, delay = 0): void {
    if (i === this.at && this.state !== "moving") return;
    if (!this.ok(i, w)) return;
    if (delay > 0) {
      this.pending = i;
      this.delay = delay;
      return;
    }
    this.from = this.at;
    this.to = i;
    this.k = 0;
    this.state = "moving";
    w.sound("lift-start", 0.7, [this.x, this.y]);
  }
  receive(msg: string, w: PropWorld): void {
    const [cmd, arg] = msg.split(":");
    if (cmd === "call" || cmd === "go") {
      const i = arg === undefined ? this.next(w) : Number(arg);
      if (this.state === "moving") return;
      this.goStop(i, w, cmd === "go" ? 36 : 0);
    }
  }
  update(w: PropWorld): void {
    super.update(w);
    const x0 = this.x;
    const y0 = this.y;
    if (this.pending >= 0 && --this.delay <= 0) {
      const i = this.pending;
      this.pending = -1;
      this.goStop(i, w);
    }
    if (this.state === "moving") {
      const a = this.stops[this.from]!;
      const b = this.stops[this.to]!;
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      // eased keyframe: the average speed over the trip is `speed` H/s
      this.k = Math.min(1, this.k + ((b.speed ?? this.speed) * this.H) / 60 / Math.max(1, dist));
      const e = this.k < 0.5 ? 2 * this.k * this.k : 1 - Math.pow(-2 * this.k + 2, 2) / 2;
      this.x = Math.round(a.x + (b.x - a.x) * e);
      this.y = Math.round(a.y + (b.y - a.y) * e);
      if (this.k >= 1) {
        this.state = "idle";
        this.at = this.to;
        w.sound("lift-dock", 0.7, [this.x, this.y]);
      }
    }
    this.mover.dx = this.x - x0;
    this.mover.dy = this.y - y0;
  }
  draw(c: PropCanvas, layer: PropLayer): void {
    const H = this.H;
    const x0 = Math.round(this.x - this.cw / 2);
    const y = Math.round(this.y);
    if (layer === "back" && this.variant !== "boat") {
      // cables to the head frame
      const top = Math.round(this.variant === "hook" ? this.top : Math.min(this.top, y - H * 2));
      if (this.variant === "hook") c.rect(Math.round(this.x), top, 2, y - top - n(H, 0.5), [0.2, 0.21, 0.24]);
      else for (const dx of [3, this.cw - 4]) c.rect(x0 + dx, top, 1, y - top, [0.2, 0.21, 0.24]);
    }
    if (layer !== "middle") return;
    if (this.variant === "boat") {
      c.rect(x0, y, this.cw, n(H, 0.12), [0.32, 0.23, 0.16]);
      c.rect(x0 + 3, y + n(H, 0.12), this.cw - 6, n(H, 0.16), [0.22, 0.15, 0.1]);
      c.rect(x0 + 8, y + n(H, 0.28), this.cw - 16, n(H, 0.06), [0.15, 0.1, 0.07]);
      c.rect(x0 + Math.round(this.cw * 0.7), y - n(H, 0.9), 2, n(H, 0.9), [0.28, 0.2, 0.14]);
      return;
    }
    if (this.variant === "hook") {
      c.rect(Math.round(this.x) - n(H, 0.12), y - n(H, 0.5), n(H, 0.24), n(H, 0.12), [0.3, 0.31, 0.35]);
      c.rect(Math.round(this.x) - 1, y - n(H, 0.4), 3, n(H, 0.4), [0.24, 0.25, 0.29]);
    }
    c.rect(x0, y, this.cw, n(H, 0.1), [0.3, 0.32, 0.37]);
    c.rect(x0, y, this.cw, 1, [0.46, 0.48, 0.52]);
    c.rect(x0 + 2, y + n(H, 0.1), this.cw - 4, n(H, 0.08), [0.2, 0.15, 0.11]);
    if (this.variant === "lift") {
      c.rect(x0, y - n(H, 1.9), 2, n(H, 1.9), [0.22, 0.23, 0.27]);
      c.rect(x0 + this.cw - 2, y - n(H, 1.9), 2, n(H, 1.9), [0.22, 0.23, 0.27]);
      c.rect(x0, y - n(H, 1.9), this.cw, 2, [0.22, 0.23, 0.27]);
    }
  }
}

// ======================================================================================
// Boat: the moored ferry. Locked (a sleepy wave) until the culvert is open; then E
// boards and the room's doors table sends you on the ride.
// ======================================================================================
class Boat extends StubProp {
  readonly recipe = "boat";
  readonly reason = "The ferry: asleep at its mooring until the culvert opens, then the short way to the hollow across the lake.";
  readonly states = ["moored", "boarding"] as const;
  private readonly flag: string | null;
  private readonly bw: number;
  justOpened = false;
  private board = 0;
  constructor(p: PropParams, tex: TextureFactory) {
    super(p, tex, "moored");
    this.flag = (p.flag as string) ?? null;
    this.bw = n(this.H, Number(p.w ?? 1.8));
    this.collision = "none";
    this.layers = ["middle"];
  }
  bounds(): Box {
    return { x: this.x - this.bw / 2, y: this.y - this.H * 0.4, w: this.bw, h: this.H * 0.8 };
  }
  interaction(): Interaction | null {
    if (this.state !== "moored") return null;
    return {
      radius: this.bw * 0.7,
      label: "",
      use: (w) => {
        if (this.flag && !w.save.get(this.flag)) {
          this.sp.v += 1.2;
          w.sound("rattle", 0.4, [this.x, this.y]);
          return;
        }
        this.state = "boarding";
        this.board = 20;
        w.sound("wood-hit", 0.5, [this.x, this.y]);
      },
    };
  }
  update(w: PropWorld): void {
    super.update(w);
    this.justOpened = false;
    if (this.state === "boarding" && --this.board <= 0) {
      this.justOpened = true;
      this.state = "moored";
    }
  }
  /** Doors close behind you (the room system calls this on entry). */
  close(): void {
    this.state = "moored";
  }
  draw(c: PropCanvas, layer: PropLayer): void {
    if (layer !== "middle") return;
    const H = this.H;
    const bob = Math.round(Math.sin(this.t * 0.04) * 1.2 + this.sp.x);
    const x0 = Math.round(this.x - this.bw / 2);
    const y = Math.round(this.y) + bob;
    c.rect(x0, y, this.bw, n(H, 0.12), [0.32, 0.23, 0.16]);
    c.rect(x0 + 3, y + n(H, 0.12), this.bw - 6, n(H, 0.14), [0.22, 0.15, 0.1]);
    c.rect(x0 + Math.round(this.bw * 0.7), y - n(H, 0.9), 2, n(H, 0.9), [0.28, 0.2, 0.14]);
  }
}

const KIT: [string, string, new (p: PropParams, tex: TextureFactory) => StubProp][] = [
  ["shrine", "shrines", Shrine],
  ["lamp-post", "lamp posts", LampPost],
  ["lever", "levers", Lever],
  ["rope-bridge", "rope bridge", RopeBridge],
  ["carrier", "moving floors", Carrier],
  ["boat", "ferry", Boat],
];

export function registerKit(e: StubEngine): void {
  for (const [name, reason, Ctor] of KIT) e.register({ name, reason, build: (p) => new Ctor(p, e.texture) });
}

export { Carrier, Shrine, LampPost, Lever, RopeBridge, Boat };

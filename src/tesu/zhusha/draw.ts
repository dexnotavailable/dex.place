// Drawing Zhusha: a role's pixel art when its slot exists (anims.ts), else the white box
// (Dex: "until traced pixel art exists for a move she is a white bounding box for that move";
// the procedural squash, stretch and lean live in controller.ts). Also her R's flame and line,
// and the dash's afterimages.
//
// One path at every zoom (Dex 10-18): 128 px art drawn nearest-neighbour at her drawn height,
// H x charScale (feel.json), on the play plane's transform, so the close band shows the same
// drawing larger. The white box stands at the same drawn height.

import type { RGB } from "../../lab/engine/renderer.ts";
import type { WorldRenderer } from "../../world/render/renderer.ts";
import { H } from "../config.ts";
import { drawArt, SLOTS, type AnimSet, type Slot } from "./anims.ts";
import { clipAtRoot, drawingIndex, moveToClip } from "./contract.ts";
import { ART_PX, BODY_H, FEEL, type AnimState, type Zhusha } from "./controller.ts";
import { IdlePlayer, seeded } from "./idle.ts";
import type { PlayView } from "./units.ts";

const hex = (s: string): RGB => [parseInt(s.slice(1, 3), 16) / 255, parseInt(s.slice(3, 5), 16) / 255, parseInt(s.slice(5, 7), 16) / 255];
const INK = hex("#1b1922"), PAPER = hex("#fbf8f1"), HURT = hex("#ffd2c8"), VERM = hex("#d8232c"), GOLD = hex("#f5d25c");
const SMOKE_LITE = hex("#a39cab"), SMOKE = hex("#6b6372"), SMOKE_DARK = hex("#3b3440");
const AZURE = hex("#6fc8ff"), AZURE_DEEP = hex("#2a6fb8"), FLAME = hex("#ffb347"), FLAME_CORE = hex("#fff4c8"), FLAME_EDGE = hex("#e2542a");

/**
 * (lane C 10-19, Dex: "the run cycle a tad faster") Her run's playback rate, both forms, when it plays by time (no
 * root-motion marks). Her speeds stay 9 / 11 m/s (feel.json run); only the drawings turn over faster.
 */
export const RUN_RATE = 1.15;

/** Moves whose clip is retimed so its hit drawing lands on the move's hit tick. */
const MOVES = new Set(["m1_1", "m1_2", "m1_3", "m1_4", "skill_q", "e_tap"]);

export interface Shown {
  slot: Slot;
  index: number;
}

export class ZhushaDraw {
  readonly anims: AnimSet;
  /** The idle variant player per idle slot, and how many idles have started (each draws a fresh seed). */
  private idle = new Map<string, { player: IdlePlayer; lastT: number }>();
  private idleSerial = 0;

  constructor(anims: AnimSet) {
    this.anims = anims;
  }

  /** Lets the controller ask whether a drawing exists for a role, its marks, and whether its clip has played out. */
  bind(z: Zhusha): void {
    z.hasRole = (role, ult) => !!this.anims.forRole(role, ult);
    z.clipOf = (role, ult) => this.anims.forRole(role, ult)?.slot.def ?? null;
    z.clipDone = (a, ult) => {
      const r = this.anims.forRole(a.role, ult);
      if (!r) return true;
      return this.clipTime(a, r.slot, z) >= r.slot.total - 1;
    };
  }

  /** The clip's tick for this anim state (moves retimed to their hit, R's beats fitted to their length, jump_arc in phases). */
  private clipTime(a: AnimState, slot: Slot, z: Zhusha): number {
    const U = FEEL.ult;
    const fit = (len: number): number => (a.t / Math.max(1, len)) * slot.total;
    if (MOVES.has(a.role)) return moveToClip(a.t, a.hitAt, a.clipHitAt !== undefined ? a.clipHitAt : (slot.hitTicks[0] ?? null));
    // a walk / run cycle with root motion plays by the distance covered: her feet stay planted at any speed
    if ((a.role === "run" || a.role === "walk") && slot.marks.root) return clipAtRoot(slot.def.frames, slot.marks.root, (a.dist ?? 0) / ART_PX);
    switch (a.role) {
      case "run": return a.t * RUN_RATE;
      case "r_call": return fit(U.callTicks);
      case "r_flurry": return fit(U.flurryTicks);
      case "transform": return fit(U.transformTicks);
      case "r_reveal": return fit(U.revealTicks);
      case "uf_exit": return fit(U.exitTicks);
      case "jump": {
        const segs = slot.def.segments;
        // the apex drawing (a drawing's `apex` mark, else segments[0], else slots.json's share)
        const apex = slot.marks.apex ?? SLOTS.jumpArc.apex * slot.total;
        const contact = segs ? slot.starts[segs[1]]! : SLOTS.jumpArc.contact * slot.total;
        const j = z.jumpPhase();
        if (j.phase === "rise") return Math.min(apex, j.t);
        if (j.phase === "fall") return Math.min(contact - 1, apex + z.fallT);
        return contact + j.t;
      }
      default: return a.t;
    }
  }

  /** The drawing she shows now, or null for the white box. */
  shown(z: Zhusha): Shown | null {
    const a = z.anim;
    if (a.hidden && a.role !== "r_flurry") return null;
    const r = this.anims.forRole(a.role, z.ultForm || a.role === "uf_exit");
    if (!r) return null;
    const slot = r.slot;
    let t = this.clipTime(a, slot, z);
    if (r.def.reverse) t = slot.total - 1 - t;
    if (a.role === "idle" && slot.def.idle_variant) return { slot, index: this.idleIndex(slot, t) };
    const loop = (slot.loop || (a.role === "run" || a.role === "walk") && !!slot.marks.root) && !MOVES.has(a.role) && !r.def.hold;
    return { slot, index: drawingIndex(slot.starts, slot.total, t, loop) };
  }

  /** The idle variant player (idle.ts): the base loop forward and back, now and then the whole take. */
  private idleIndex(slot: Slot, t: number): number {
    let s = this.idle.get(slot.id);
    if (!s || t < s.lastT) {
      // a new idle: a fresh (deterministic) seed so the variety differs from one rest to the next
      s = { player: new IdlePlayer(slot.def.frames.map((f) => f.ticks), slot.def.idle_variant!, seeded(0x5eed + this.idleSerial++ * 7919)), lastT: t };
      this.idle.set(slot.id, s);
    }
    s.lastT = t;
    return s.player.at(t).index;
  }

  /** Her head from the soles (world px, facing right) for the hat's talisman. */
  head(z: Zhusha): [number, number] {
    const s = this.shown(z);
    const h = s?.slot.drawings[s.index]?.head;
    return h ? [h[0] * ART_PX, h[1] * ART_PX] : z.headFromBox();
  }

  /**
   * Draws her in world space on the play plane's transform for this pass (`view`: its scale, focus and
   * mirror, as game.ts set it). A drawing is drawn at H x charScale at every zoom (anims.ts drawArt).
   */
  draw(r: WorldRenderer, z: Zhusha, view: PlayView): void {
    this.figure(r, z, view);
    if (z.smoke) this.cloud(r, z.smoke);
  }

  private figure(r: WorldRenderer, z: Zhusha, view: PlayView): void {
    const b = z.body;
    if (z.ink >= 1) return;
    const opacity = z.ink > 0 ? 1 - z.ink : z.invuln > 0 && z.state === "free" && Math.floor(z.invuln / 4) % 2 === 0 ? 0.55 : 1;
    for (const g of z.ghosts) this.ghost(r, g.x, g.y, g.lean, g.life / g.max, g.ult);
    if (z.streak) this.streak(r, z);
    if (z.anim.flame > 0.05) {
      this.flame(r, z);
      if (z.anim.flame >= 1) return;
    }
    const s = this.shown(z);
    if (!s) {
      if (!z.anim.hidden) this.box(r, z, opacity);
      return;
    }
    const tint: [number, number, number, number] | undefined = z.flash > 0 ? [1, 0.35, 0.4, z.flash > 5 ? 0.8 : 0.4] : undefined;
    drawArt(r, view, s.slot, s.index, b.x, b.y, z.facing < 0, ART_PX, { tint, opacity });
  }

  /** A solid quad centred at (x, y), w x h, rotated. */
  private quad(r: WorldRenderer, x: number, y: number, w: number, h: number, rot: number, c: RGB, opacity = 1): void {
    r.vfx({
      type: 0, t: 0, seed: 0, over: 1, p0: [opacity, 0, 0, 0], p1: [0, 0, 0, 0], core: c, main: c, edge: c,
      x: Math.round(x), y: Math.round(y), rot, sx: 1, sy: 1, ext: [-w / 2, -h / 2, w / 2, h / 2],
    });
  }

  /**
   * The white box: her body as horizontal slices (so a lean shears it in whole pixels), an ink
   * outline, the eye on her facing side, the hat a size too big. The talisman on the hat is the
   * world's (game.ts draws it live on the head anchor). In the form: an azure edge and gold strips.
   */
  private box(r: WorldRenderer, z: Zhusha, opacity: number): void {
    const b = z.body, p = z.pose, f = z.facing;
    const w = FEEL.body.boxW * BODY_H * p.sx.v, h = BODY_H * p.sy.v;
    const lean = p.lean.v, rot = p.rot.v, oy = p.oy.v;
    const form = z.ultForm || (z.state === "ult" && (z.ultPhase === "transform" || z.ultPhase === "reveal"));
    const cx = b.x, cyFeet = b.y + oy;
    // a local point (x right of her centre, y up from her soles) to world: shear by the lean, rotate about the box's middle
    const mid = h / 2;
    const cr = Math.cos(rot), sr = Math.sin(rot);
    const at = (lx: number, ly: number): [number, number] => {
      const sx = lx + lean * ly;
      const dy = ly - mid;
      // rotation in screen space (y down): x' = x cos - y sin, y' = x sin + y cos, with y = -dy
      const X = sx * cr + dy * sr;
      const Y = sx * sr - dy * cr;
      return [cx + X, cyFeet - mid + Y];
    };
    const body = form ? AZURE_DEEP : INK;
    const fill = z.flash > 0 && z.flash % 4 < 2 ? HURT : PAPER;
    const o = 2;
    if (form) {
      // the form's azure edge, one px outside the ink
      const n = 8, sh = h / n;
      for (let i = 0; i < n; i++) {
        const [x, y] = at(0, sh * (i + 0.5));
        this.quad(r, x, y, w + 2 * o + 4, sh + 1, rot, AZURE, opacity);
      }
      const [tx, ty] = at(0, h + o + 1);
      this.quad(r, tx, ty, w + 2 * o + 4, 2, rot, AZURE, opacity);
    }
    const n = 8, sh = h / n;
    for (let i = 0; i < n; i++) {
      const [x, y] = at(0, sh * (i + 0.5));
      this.quad(r, x, y, w + 2 * o, sh + 1, rot, body, opacity);
    }
    {
      const [x, y] = at(0, h + o / 2);
      this.quad(r, x, y, w + 2 * o, o, rot, body, opacity);
      const [x2, y2] = at(0, -o / 2);
      this.quad(r, x2, y2, w + 2 * o, o, rot, body, opacity);
    }
    for (let i = 0; i < n; i++) {
      const [x, y] = at(0, sh * (i + 0.5));
      this.quad(r, x, y, w, sh + 1, rot, fill, opacity);
    }
    if (form) {
      // talisman strips down her front and back
      for (const k of [-0.25, 0.25]) {
        const [x, y] = at(k * w, h * 0.52);
        this.quad(r, x, y, Math.max(2, w * 0.14), h * 0.38, rot, GOLD, opacity);
      }
    }
    // the eye on her facing side
    {
      const [x, y] = at(f * w * 0.25, h * 0.82);
      this.quad(r, x, y, Math.max(2, w * 0.16), Math.max(2, h * 0.05), rot, form ? AZURE : INK, opacity);
    }
    // the hat: a wide black brim, a vermilion crown, a gold knob
    {
      const [x, y] = at(0, h + o + 2);
      this.quad(r, x, y, w * 1.75, Math.max(3, BODY_H * 0.05), rot, INK, opacity);
      const [x2, y2] = at(-f * w * 0.04, h + o + 2 + BODY_H * 0.06);
      this.quad(r, x2, y2, w * 0.8, Math.max(4, BODY_H * 0.08), rot, VERM, opacity);
      const [x3, y3] = at(-f * w * 0.04, h + o + 2 + BODY_H * 0.12);
      this.quad(r, x3, y3, 4, 3, rot, GOLD, opacity);
    }
  }

  /** R's flame (rising, at the zenith, diving): a tapered column of fire in hard bands. */
  private flame(r: WorldRenderer, z: Zhusha): void {
    const b = z.body, p = z.pose, k = z.anim.flame;
    const w = FEEL.body.boxW * BODY_H * 1.1 * p.sx.v, h = BODY_H * p.sy.v;
    const flick = (i: number): number => Math.sin(z.t * 0.9 + i * 1.7) * 2;
    const n = 10;
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n;
      const ww = w * (1 - u * 0.75) + flick(i);
      const y = b.y - u * h;
      this.quad(r, b.x + flick(i + 3) * 0.5, y, ww + 6, h / n + 1, 0, FLAME_EDGE, k);
      this.quad(r, b.x + flick(i + 3) * 0.5, y, ww, h / n + 1, 0, FLAME, k);
      this.quad(r, b.x + flick(i + 3) * 0.5, y, ww * 0.45, h / n + 1, 0, FLAME_CORE, k);
    }
  }

  /** R's smoke: banded puffs rolling out from where she landed, thinning into the transform. */
  private cloud(r: WorldRenderer, sm: { x: number; y: number; t: number; life: number }): void {
    const u = sm.t / sm.life;
    const n = 11;
    for (let i = 0; i < n; i++) {
      const a = Math.sin(i * 91.7) * 43758.5453, c = Math.sin(i * 27.3) * 12345.678;
      const ra = a - Math.floor(a), rc = c - Math.floor(c);
      const spread = 0.35 + 0.9 * Math.min(1, u * 2.2);
      const x = sm.x + (ra - 0.5) * 2.4 * H * spread;
      const y = sm.y - (0.15 + rc * 1.1) * H * (0.6 + 0.4 * spread) - u * 0.3 * H;
      const R1 = (0.38 + rc * 0.3) * H * (0.8 + 0.5 * Math.min(1, u * 3));
      r.vfx({
        type: 6, t: Math.min(1, u * 1.15), seed: i, over: 1,
        p0: [R1 * 0.7, R1, 0.85, 0], p1: [0, 0, 0, 0],
        core: SMOKE_LITE, main: SMOKE, edge: SMOKE_DARK,
        x: Math.round(x), y: Math.round(y), rot: 0, sx: 1, sy: 1, ext: [-R1 - 2, -R1 - 2, R1 + 2, R1 + 2],
      });
    }
  }

  /** The dive's line from the zenith to her, thinning as it fades. */
  private streak(r: WorldRenderer, z: Zhusha): void {
    const s = z.streak!;
    const dx = s.x1 - s.x0, dy = s.y1 - s.y0;
    const len = Math.hypot(dx, dy);
    if (len < 2) return;
    const rot = Math.atan2(dy, dx);
    const life = s.life / 36;
    const th = Math.max(2, 14 * life);
    const cx = (s.x0 + s.x1) / 2, cy = (s.y0 + s.y1) / 2;
    this.quad(r, cx, cy, len, th + 4, rot, AZURE, Math.min(1, life * 1.4));
    this.quad(r, cx, cy, len, th, rot, FLAME_CORE, Math.min(1, life * 1.4));
  }

  /** An afterimage: the box's outline in azure, dithering away. */
  private ghost(r: WorldRenderer, x: number, y: number, lean: number, life: number, ult: boolean): void {
    const w = FEEL.body.boxW * BODY_H, h = BODY_H, n = 6, sh = h / n;
    const c = ult ? AZURE : AZURE_DEEP;
    for (let i = 0; i < n; i++) {
      const ly = sh * (i + 0.5);
      const cx = x + lean * ly;
      this.quad(r, cx - w / 2, y - ly, 2, sh + 1, 0, c, life * 0.8);
      this.quad(r, cx + w / 2, y - ly, 2, sh + 1, 0, c, life * 0.8);
    }
    this.quad(r, x + lean * h, y - h, w + 2, 2, 0, c, life * 0.8);
    this.quad(r, x, y, w + 2, 2, 0, c, life * 0.8);
  }
}

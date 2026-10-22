// Drawing Zhusha: a role's pixel art when its slot exists (anims.ts), else the white box
// (Dex: "until traced pixel art exists for a move she is a white bounding box for that move";
// the procedural squash, stretch and lean live in controller.ts), and the dash's afterimages. R's and
// the ult form's stand-ins (the letter, the dive, the smoke, the ghost blades) are ultdraw.ts's.
//
// One path at every zoom (Dex 10-18): 128 px art drawn nearest-neighbour at her drawn height,
// H x charScale (feel.json), on the play plane's transform, so the close band shows the same
// drawing larger. The white box stands at the same drawn height.

import type { RGB } from "../../lab/engine/renderer.ts";
import type { WorldRenderer } from "../../world/render/renderer.ts";
import { drawArt, SLOTS, type AnimSet, type Slot } from "./anims.ts";
import { clipAtRoot, drawingIndex, windupClip } from "./contract.ts";
import { ART_PX, BODY_H, FEEL, type AnimState, type Zhusha } from "./controller.ts";
import { IdlePlayer, seeded } from "./idle.ts";
import { lipAt, type Lip } from "./lip.ts";
import type { DiveSplash } from "./timing.ts";
import { drawDiveBlur, drawUltBack, drawUltFront } from "./ultdraw.ts";
import type { PlayView } from "./units.ts";

const hex = (s: string): RGB => [parseInt(s.slice(1, 3), 16) / 255, parseInt(s.slice(3, 5), 16) / 255, parseInt(s.slice(5, 7), 16) / 255];
const INK = hex("#1b1922"), PAPER = hex("#fbf8f1"), HURT = hex("#ffd2c8"), VERM = hex("#d8232c"), GOLD = hex("#f5d25c");
const AZURE = hex("#6fc8ff"), AZURE_DEEP = hex("#2a6fb8");

/**
 * Her run's playback rate when it plays by time (no root-motion marks), per form: feel.json run.playRate (Dex 10-20:
 * the normal run ~15% faster, 1.32) and run.ultPlayRate (1.15, lane C 10-19). Her speeds stay 9 / 11 m/s; only the
 * drawings turn over faster.
 */
export const runRate = (ult: boolean): number => (ult ? FEEL.run.ultPlayRate : FEEL.run.playRate);

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
    z.clipAt = (a, ult) => {
      const r = this.anims.forRole(a.role, ult);
      return r ? { slot: r.slot.id, t: this.clipTime(a, r.slot, z), total: r.slot.total } : null;
    };
    z.clipDone = (a, ult) => {
      const r = this.anims.forRole(a.role, ult);
      if (!r) return true;
      return this.clipTime(a, r.slot, z) >= r.slot.total - 1;
    };
  }

  /** The clip's tick for this anim state (moves retimed to their hit, jump_arc in phases; R's clips play 1:1, ult.ts times them). */
  private clipTime(a: AnimState, slot: Slot, z: Zhusha): number {
    const U = FEEL.ult;
    const fit = (len: number): number => (a.t / Math.max(1, len)) * slot.total;
    // (cutoffs r5) a squeezed windup shows every drawing it can, the smear into the hit last (contract.ts windupClip)
    if (MOVES.has(a.role)) return windupClip(a.t, a.hitAt, a.clipHitAt !== undefined ? a.clipHitAt : (slot.hitTicks[0] ?? null), slot.starts);
    // a walk / run cycle with root motion plays by the distance covered: her feet stay planted at any speed
    if ((a.role === "run" || a.role === "walk") && slot.marks.root) return clipAtRoot(slot.def.frames, slot.marks.root, (a.dist ?? 0) / ART_PX);
    switch (a.role) {
      case "run": return a.t * runRate(z.ultForm);
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
    if (a.hidden) return null;
    const r = this.anims.forRole(a.role, z.ultForm || a.role === "uf_exit");
    if (!r) return null;
    const slot = r.slot;
    let t = this.clipTime(a, slot, z);
    if (r.def.reverse) t = slot.total - 1 - t;
    // a role that holds one drawing of its slot (R's stop and dive: her jump's)
    if (r.def.frame !== undefined) return { slot, index: Math.max(0, Math.min(slot.def.frames.length - 1, r.def.frame)) };
    // the ult form stands still-ish on one drawing (Dex 10-19; ultform.ts)
    if (a.role === "idle" && z.ultForm) return { slot, index: z.uf.idleIndex() };
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
    // her drawing sits FEEL.draw.dip art px low (the hat's talisman goes with it)
    return h ? [h[0] * ART_PX, (h[1] + this.dip) * ART_PX] : z.headFromBox();
  }

  /** Her drawing's dip into the ground, art px (feel.json draw.dip; tools set 0 to see her as before). */
  dip = FEEL.draw.dip;

  /** The ground's y at or below (x, y) (game.ts: the world's collision), for drawing her behind its front edge. */
  groundAt: ((x: number, y: number) => number | null) | null = null;

  /** Where her drawing stops (world y): the lowest ground under her feet while she stands on something, else none. */
  private clipY(z: Zhusha, view: PlayView): number | null {
    const b = z.body;
    if (!b.grounded || view.mirror !== null || !this.groundAt) return null;
    const w = FEEL.draw.foot * BODY_H;
    let low: number | null = null;
    for (const x of [b.x - w, b.x, b.x + w]) {
      const g = this.groundAt(x, b.y - 0.25 * BODY_H);
      // ground far below her (a ledge's edge, the void) is not under her feet
      if (g !== null && g < b.y + 0.5 * BODY_H) low = Math.max(low ?? g, g);
    }
    return low;
  }

  /**
   * Where the floor under the dive's splash ends (lip.ts), art px from her pivot facing her way: probed across the
   * drawing's width from her soles; it ends where the floor jumps more than the splash's `tol` from one probe to the
   * next (a ledge's drop, a wall, a step) or there is none. Null: no ground to ask.
   */
  private lip(z: Zhusha, s: Shown, sp: DiveSplash): Lip | null {
    const d = s.slot.drawings[s.index];
    if (!d || !this.groundAt) return null;
    const b = z.body, f = z.facing, at = this.groundAt;
    // asked from over the band above the floor found a probe before (a step up or a slope rising into it is found, not
    // the floor under it)
    const floorY = (k: number, near: number | null): number | null => at(b.x + f * k * ART_PX, (near ?? b.y) - (sp.band + 2 * sp.tol) * ART_PX);
    return lipAt(floorY, d.off[0], d.off[0] + d.r[2], sp.keep, sp.tol * ART_PX);
  }

  /**
   * Draws her in world space on the play plane's transform for this pass (`view`: its scale, focus and
   * mirror, as game.ts set it). A drawing is drawn at H x charScale at every zoom (anims.ts drawArt).
   */
  draw(r: WorldRenderer, z: Zhusha, view: PlayView): void {
    drawUltBack(r, z);
    this.figure(r, z, view);
    drawUltFront(r, z);
  }

  private figure(r: WorldRenderer, z: Zhusha, view: PlayView): void {
    const b = z.body;
    if (z.ink >= 1) return;
    const opacity = z.ink > 0 ? 1 - z.ink : z.invuln > 0 && z.state === "free" && Math.floor(z.invuln / 4) % 2 === 0 ? 0.55 : 1;
    for (const g of z.ghosts) this.ghost(r, g.x, g.y, g.lean, g.life / g.max, g.ult);
    // R's dive: she is a vertical blur (ultdraw.ts)
    if (z.anim.flame >= 1) {
      drawDiveBlur(r, z, BODY_H);
      return;
    }
    const s = this.shown(z);
    if (!s) {
      if (!z.anim.hidden) this.box(r, z, opacity);
      return;
    }
    const tint: [number, number, number, number] | undefined = z.flash > 0 ? [1, 0.35, 0.4, z.flash > 5 ? 0.8 : 0.4] : undefined;
    // (dive 10-21) the chop's floor splash stops where the floor under it ends
    const sp = z.diveSplash, lip = sp && s.index >= sp.from && s.index <= sp.to ? this.lip(z, s, sp) : null;
    // (Dex 10-20) a few art px low, and behind the ground's front edge: visual only (her body and hit boxes stay put)
    drawArt(r, view, s.slot, s.index, b.x, b.y + this.dip * ART_PX, z.facing < 0, ART_PX, { tint, opacity, clipY: this.clipY(z, view), lip: lip && sp ? { lip, band: sp.band } : null });
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
    const form = z.ultForm || (z.state === "ult" && z.ultPhase === "reveal");
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

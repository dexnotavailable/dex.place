// Destruction with weight (GDK 5.6, Appendix G; brief: "give hits weight and add a support
// rule"). Her hits on a prop stop the world for a moment, flash it, shake the frame a
// little, kick up dust and play its material's sound; a prop that breaks comes apart into
// its own pixels (the chunk painter), and every piece falls, bounces and settles on real
// ground. The support rule: anything standing on or hanging from a prop that goes falls
// with it, and so do pieces resting on it; nothing is ever left floating.
//
// Classes: cosmetic props come back when she has gone (about 28 H away, or another band);
// session props stay broken until a reload; permanent ones stay changed on this device (a
// saved flag); protected things (the service objects and the people) only go "tink".
// R's nuke breaks everything breakable within 6 H and leaves embers.
//
// How far each of her hits destroys (Dex 10-19), from the hit's break (feel.json): a sword hit breaks what its boxes
// touch, one HP at a time, its pieces thrown by its force (the m1 chain stays local); the Q and the E carry a reach: every
// cosmetic or session prop in it goes at once whatever its HP, the destruction travelling out from where she struck
// (the Q's wave across a big area in its direction, the E's beam almost at once along a band in front), pieces thrown
// hard (the Q high, the E flat along the beam).

import type { HitBox } from "../lab/contracts.ts";
import type { Vfx } from "../lab/engine/vfx.ts";
import { overlap, type WorldBox } from "../lab/game/events.ts";
import type { Zhusha as Player, ZHit } from "./zhusha/controller.ts";
import { ctxFor, painter } from "./art/painter.ts";
import { pieceOf } from "./art/painters/props.ts";
import { IdxBuf } from "./art/raster.ts";
import { H } from "./config.ts";
import type { PropDef, SpriteDef, Usable } from "./world/types.ts";

const GRAVITY = 0.42;
const FALL_MAX = 9;
/** A fall longer than this breaks a cosmetic or session prop when it lands. */
const BREAK_FALL = 0.6 * H;
/** She has left the region: cosmetic props come back. */
const RESET_DIST = 28 * H;

interface Piece {
  def: SpriteDef;
  dx: number;
  dy: number;
  vx: number;
  vy: number;
  /** Its pixels' box, level-1 px from the prop's anchor. */
  box: [number, number, number, number];
  rest: boolean;
  /** The prop it rests on, if any (it falls again when that one goes). */
  on: Live | null;
  bounced: number;
}

interface Live {
  d: PropDef;
  sprite: SpriteDef;
  state: "intact" | "falling" | "broken";
  x: number;
  y: number;
  vy: number;
  hp: number;
  flash: number;
  fallFrom: number;
  on: Live | null;
  bounds: [number, number, number, number];
  pieces: Piece[];
}

export interface PropsHost {
  readonly player: Player;
  readonly vfx: Vfx;
  readonly feel: { freeze(ticks: number): void; sound(id: string, volume?: number): void };
  readonly camera: { shake(amplitude: number, duration: number): void };
  /** The ground's y at or below y at x, or null when there is none. */
  ground(x: number, y: number): number | null;
  addSprite(s: SpriteDef): void;
  removeSprite(id: string): void;
  setFlag(f: string, on?: boolean): void;
  hasFlag(f: string): boolean;
  /** Protected things she can hit with a "tink": the service objects. */
  usables(): readonly Usable[];
  /** The world's bottom (pieces that fall past it are gone). */
  bottom: number;
}

export class Props {
  private list: Live[] = [];
  private byId = new Map<string, Live>();
  private host: PropsHost;
  /** Debug and tests. */
  broken = 0;
  /** Breaks on their way (a Q / E wave reaching a prop a few ticks after the blow), by tick. */
  private pending: { l: Live; at: number; dir: number; force: number; lift: number }[] = [];
  private clock = 0;

  constructor(host: PropsHost, defs: readonly PropDef[], sprite: (id: string) => SpriteDef) {
    this.host = host;
    for (const d of defs) {
      const s = sprite(`prop:${d.id}`);
      const live: Live = { d, sprite: s, state: "intact", x: d.x, y: d.y, vy: 0, hp: d.hp ?? 1, flash: 0, fallFrom: d.y, on: null, bounds: painter(d.kind).bounds(d.p), pieces: [] };
      this.list.push(live);
      this.byId.set(d.id, live);
    }
    for (const l of this.list) l.on = l.d.on ? this.byId.get(l.d.on) ?? null : null;
    // permanent changes stay on this device
    for (const l of this.list) if (l.d.cls === "permanent" && host.hasFlag(`broke:${l.d.id}`)) { l.state = "broken"; l.sprite.hidden = true; }
  }

  /** One simulation tick: falling props and pieces, flashes, and props coming back. */
  tick(): void {
    const b = this.host.player.body;
    this.clock++;
    if (this.pending.length) {
      const due = this.pending.filter((q) => q.at <= this.clock);
      this.pending = this.pending.filter((q) => q.at > this.clock);
      for (const q of due) if (q.l.state === "intact" || q.l.state === "falling") this.breakProp(q.l, q.dir, q.force, q.lift, true);
    }
    for (const l of this.list) {
      if (l.flash > 0 && --l.flash === 0) l.sprite.white = 0;
      if (l.state === "falling") this.fall(l);
      for (const pc of l.pieces) if (!pc.rest) this.drop(l, pc);
      if (l.pieces.length) l.pieces = l.pieces.filter((pc) => {
        if (l.y + pc.dy > this.host.bottom) { this.host.removeSprite(pc.def.id); return false; }
        return true;
      });
      // cosmetic props come back once she has left them behind
      if (l.d.cls === "cosmetic" && (l.state !== "intact" || l.x !== l.d.x || l.y !== l.d.y) && (Math.abs(b.x - l.d.x) > RESET_DIST || Math.abs(b.y - l.d.y) > 40 * H)) this.reset(l);
    }
  }

  /** Her hits this tick: props in reach take them (each once per swing); protected things go "tink". */
  takeHits(p: Player): void {
    const hits = p.hitboxes();
    if (!hits.length) return;
    for (const { box, hb } of hits) {
      if (hb.group === "r") this.nuke(p, hb);
      const brk = (hb as ZHit).brk;
      for (const l of this.list) {
        if (l.state === "broken") continue;
        const ov = overlap(box, this.boxOf(l));
        if (!ov) continue;
        // a reach (the Q, the E) obliterates what is breakable in it: never the protected or the permanent ones
        if (brk?.area && (l.d.cls === "protected" || l.d.cls === "permanent")) continue;
        if (!this.once(p, hb, l)) continue;
        if (brk?.reach && l.d.cls !== "protected") this.obliterate(l, brk);
        else this.hit(l, hb, p.facing, ov);
      }
      if (brk?.area) continue;
      for (const u of this.host.usables()) {
        if (u.action.kind !== "panel" && u.action.kind !== "say") continue;
        const ov = overlap(box, { x: u.x0, y: u.y0, w: u.x1 - u.x0, h: u.y1 - u.y0 });
        if (!ov || !this.once(p, hb, u)) continue;
        // protected: the sword passes with a "tink"
        this.host.feel.sound("tink", 0.8);
        this.host.vfx.spawn("sparks.hit", { x: ov.x + ov.w / 2, y: ov.y + ov.h / 2, facing: p.facing });
      }
    }
  }

  private once(p: Player, hb: HitBox, key: object): boolean {
    const group = hb.group ?? `f${p.clip.index}`;
    let set = p.clip.hitGroups.get(group);
    if (!set) p.clip.hitGroups.set(group, (set = new Set()));
    if (set.has(key)) return false;
    set.add(key);
    return true;
  }

  private boxOf(l: Live): WorldBox {
    const [x0, y0, x1, y1] = l.bounds;
    return { x: l.x + x0, y: l.y + y0, w: x1 - x0, h: y1 - y0 };
  }

  private hit(l: Live, hb: HitBox, dir: number, ov: WorldBox): void {
    const m = l.d.material;
    if (l.d.cls === "protected") {
      this.host.feel.sound("tink", 0.8);
      this.host.vfx.spawn("sparks.hit", { x: ov.x + ov.w / 2, y: ov.y + ov.h / 2, facing: dir });
      return;
    }
    // the weight: a short stop, a flash, a nudge of the frame
    this.host.feel.freeze(Math.max(3, Math.min(8, hb.hitstop + 1)));
    l.sprite.white = 1;
    l.flash = 2;
    l.hp -= 1;
    if (l.hp > 0) {
      this.host.feel.sound(`${m}.hit`);
      this.host.vfx.spawn("dust.kick", { x: l.x, y: this.bottomOf(l), facing: dir });
      this.host.camera.shake(1.5, 6);
      return;
    }
    const brk = (hb as ZHit).brk;
    this.breakProp(l, dir, brk?.force ?? (hb.heavy ? 1.5 : 1), brk?.lift ?? 1);
  }

  /**
   * The Q's / E's destruction reaching a prop: it goes whatever its HP, when the wave gets there (distance from where
   * she struck / the wave's speed), thrown away from her, harder the closer it stood.
   */
  private obliterate(l: Live, brk: NonNullable<ZHit["brk"]>): void {
    const [x0, , x1] = l.bounds;
    const d = Math.abs(l.x + (x0 + x1) / 2 - brk.ox);
    const len = Math.max(H, (brk.reach?.[2] ?? 6) * H);
    const delay = brk.wave ? Math.floor(d / (brk.wave * H)) : 0;
    const force = (brk.force ?? 2) * (1 - 0.4 * Math.min(1, d / len));
    const q = { l, at: this.clock + delay, dir: brk.dir, force, lift: brk.lift ?? 1 };
    if (delay <= 0) this.breakProp(l, q.dir, q.force, q.lift, false);
    else this.pending.push(q);
  }

  /** It comes apart into its own pieces, which fly from the blow and fall (lift: their upward share; quiet: part of a wave). */
  private breakProp(l: Live, dir: number, force = 1, lift = 1, quiet = false): void {
    l.state = "broken";
    l.sprite.hidden = true;
    l.sprite.white = 0;
    this.broken++;
    const m = l.d.material;
    const base = this.bottomOf(l);
    this.host.feel.sound(`${m}.break`, quiet ? 0.6 : 1);
    if (!quiet) this.host.camera.shake(Math.min(6, 2.5 * force), 10);
    this.host.vfx.spawn("dust.kick", { x: l.x, y: base, facing: dir });
    this.host.vfx.spawn(m === "paper" ? "feathers" : m === "metal" ? "sparks.heavy" : "debris.stone", { x: l.x, y: (l.y + this.boxOf(l).y + base) / 2, facing: dir });
    if (l.d.cls === "permanent") this.host.setFlag(`broke:${l.d.id}`, true);
    // the pieces: the prop's own pixels, cut into ragged cells
    // big props break into more pieces (about one per 40 x 40 px), never fewer than asked
    const [px0, py0, px1, py1] = l.bounds;
    const n = Math.min(12, Math.max(l.d.pieces ?? 4, Math.round(((px1 - px0) * (py1 - py0)) / 1600)));
    const cut = (l.sprite.seed % 9973) + 7;
    const boxes = this.pieceBoxes(l, n, cut);
    const [bx0, , bx1] = l.bounds;
    const cx = (bx0 + bx1) / 2, hw = Math.max(1, (bx1 - bx0) / 2);
    boxes.forEach((box, i) => {
      if (!box) return;
      const id = `chunk:${l.d.id}:${i}`;
      const def: SpriteDef = { id, plane: "play", kind: "chunk", x: l.x, y: l.y, p: { of: l.d.kind, op: l.d.p, i, n, cut }, seed: l.sprite.seed, frames: 1, frame: 0 };
      this.host.removeSprite(id);
      this.host.addSprite(def);
      const side = ((box[0] + box[2]) / 2 - cx) / hw;
      const r1 = hashf(i, cut), r2 = hashf(i + 17, cut);
      l.pieces.push({
        def, dx: 0, dy: 0,
        vx: (dir * (0.8 + 1.6 * r1) + side * 1.6) * force,
        vy: -(1.6 + 3 * r2) * force * lift,
        box, rest: false, on: null, bounced: 0,
      });
    });
    // the support rule: whatever stood on it or hung from it falls now, and so do pieces resting on it
    for (const o of this.list) {
      if (o.on === l && o.state === "intact") this.startFall(o);
      for (const pc of o.pieces) if (pc.on === l) { pc.rest = false; pc.on = null; }
    }
  }

  private startFall(l: Live): void {
    l.state = "falling";
    l.vy = 0;
    l.fallFrom = this.bottomOf(l);
    l.on = null;
    // whatever stood on this one falls with it, and so do pieces resting on it
    for (const o of this.list) {
      if (o.on === l && o.state === "intact") this.startFall(o);
      for (const pc of o.pieces) if (pc.on === l) { pc.rest = false; pc.on = null; }
    }
  }

  private bottomOf(l: Live): number {
    return l.y + l.bounds[3];
  }

  /** The top of an intact prop under x (pieces and props can rest on it). */
  private propTop(x: number, below: number, not: Live): { y: number; l: Live } | null {
    let best: { y: number; l: Live } | null = null;
    for (const o of this.list) {
      if (o === not || o.state !== "intact" || o.d.hangs) continue;
      const [x0, y0, x1] = o.bounds;
      if (x < o.x + x0 + 2 || x > o.x + x1 - 2) continue;
      const top = o.y + y0 + 1;
      if (top < below - 1) continue;
      if (!best || top < best.y) best = { y: top, l: o };
    }
    return best;
  }

  private fall(l: Live): void {
    const prevBottom = this.bottomOf(l);
    l.vy = Math.min(FALL_MAX, l.vy + GRAVITY);
    l.y += l.vy;
    const bottom = this.bottomOf(l);
    const g = this.host.ground(l.x, prevBottom - 1);
    const t = this.propTop(l.x, prevBottom, l);
    const land = t && (g === null || t.y <= g) ? t.y : g;
    if (land !== null && bottom >= land) {
      l.y += land - bottom;
      const dist = land - l.fallFrom;
      l.vy = 0;
      if (dist > BREAK_FALL && (l.d.cls === "cosmetic" || l.d.cls === "session")) {
        this.breakProp(l, Math.sign(l.x - this.host.player.body.x) || 1, 0.7);
      } else {
        l.state = "intact";
        l.on = t && t.y === land ? t.l : null;
        this.host.feel.sound("thud", 0.5);
        this.host.vfx.spawn("dust.land", { x: l.x, y: land, facing: 1 });
      }
    }
    l.sprite.x = l.x;
    l.sprite.y = l.y;
    if (l.y > this.host.bottom) { l.state = "broken"; l.sprite.hidden = true; }
  }

  private drop(l: Live, pc: Piece): void {
    const prevBottom = l.y + pc.dy + pc.box[3];
    pc.vy = Math.min(FALL_MAX, pc.vy + GRAVITY);
    pc.dx += pc.vx;
    pc.dy += pc.vy;
    pc.vx *= 0.995;
    const cx = l.x + pc.dx + (pc.box[0] + pc.box[2]) / 2;
    const bottom = l.y + pc.dy + pc.box[3];
    if (pc.vy > 0) {
      const g = this.host.ground(cx, prevBottom - 1);
      const t = this.propTop(cx, prevBottom, l);
      const land = t && (g === null || t.y <= g) ? t.y : g;
      if (land !== null && bottom >= land) {
        pc.dy += land - bottom;
        if (pc.vy > 1.8 && pc.bounced < 3) {
          // a bounce: it loses most of its speed each time
          pc.bounced++;
          if (pc.bounced === 1) {
            this.host.vfx.spawn("dust.land", { x: cx, y: land, facing: 1 });
            this.host.feel.sound("debris", 0.35);
          }
          pc.vy = -pc.vy * 0.32;
          pc.vx *= 0.55;
        } else {
          pc.vy = 0;
          pc.vx = 0;
          pc.rest = true;
          pc.on = t && t.y === land ? t.l : null;
        }
      }
    }
    pc.def.x = Math.round(l.x + pc.dx);
    pc.def.y = Math.round(l.y + pc.dy);
  }

  /** R's nuke: everything breakable within its reach (at least 6 H) goes, and embers drift for a while. */
  private nuke(p: Player, hb: HitBox): void {
    const b = p.body;
    if (!this.once(p, hb, this)) return;
    const rx = Math.max(6 * H, hb.w / 2), ry = Math.max(4 * H, hb.h);
    for (const l of this.list) {
      if (l.state === "broken" || l.d.cls === "protected" || l.d.cls === "permanent") continue;
      if (Math.abs(l.x - b.x) > rx || Math.abs(l.y - b.y) > ry) continue;
      this.breakProp(l, Math.sign(l.x - b.x) || p.facing, 1.6);
    }
    for (const k of [-3, -1.5, 0, 1.5, 3]) this.host.vfx.spawn("embers.gold", { x: b.x + k * H, y: b.y, facing: 1 });
  }

  /** The level-1 box of each piece's pixels (null for a piece with none). */
  private pieceBoxes(l: Live, n: number, cut: number): ([number, number, number, number] | null)[] {
    const [x0, y0, x1, y1] = l.bounds;
    const ox = Math.floor(x0), oy = Math.floor(y0);
    const w = Math.ceil(x1) - ox, h = Math.ceil(y1) - oy;
    const buf = new IdxBuf(w, h, ox, oy, 1);
    painter(l.d.kind).paint(ctxFor(buf, 1, 0, 0, l.sprite.seed), l.d.p);
    const out: ([number, number, number, number] | null)[] = Array.from({ length: n }, () => null);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (!buf.px[y * w + x]) continue;
        const lx = ox + x + 0.5, ly = oy + y + 0.5;
        const i = pieceOf(lx, ly, l.bounds, n, cut);
        const bx = out[i];
        if (!bx) out[i] = [lx - 0.5, ly - 0.5, lx + 0.5, ly + 0.5];
        else {
          bx[0] = Math.min(bx[0], lx - 0.5); bx[1] = Math.min(bx[1], ly - 0.5);
          bx[2] = Math.max(bx[2], lx + 0.5); bx[3] = Math.max(bx[3], ly + 0.5);
        }
      }
    }
    return out;
  }

  /** Puts a cosmetic prop back as it was (she has left the region). */
  private reset(l: Live): void {
    for (const pc of l.pieces) this.host.removeSprite(pc.def.id);
    l.pieces = [];
    l.state = "intact";
    l.x = l.d.x;
    l.y = l.d.y;
    l.vy = 0;
    l.hp = l.d.hp ?? 1;
    l.on = l.d.on ? this.byId.get(l.d.on) ?? null : null;
    l.sprite.hidden = false;
    l.sprite.white = 0;
    l.sprite.x = l.x;
    l.sprite.y = l.y;
  }

  /** Debug and tests. */
  state(): Record<string, string> {
    const o: Record<string, string> = {};
    for (const l of this.list) o[l.d.id] = `${l.state}${l.pieces.length ? `:${l.pieces.filter((p) => p.rest).length}/${l.pieces.length}` : ""}`;
    return o;
  }

  /** Tools: the pieces still in the air (none should stay there). */
  airborne(): number {
    let n = 0;
    for (const l of this.list) {
      if (l.state === "falling") n++;
      for (const pc of l.pieces) if (!pc.rest) n++;
    }
    return n;
  }
}

function hashf(i: number, seed: number): number {
  let h = (i * 374761393 + seed * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

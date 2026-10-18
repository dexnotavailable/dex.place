// The cast in Tesu until their art exists (Dex 10-18: "white placeholder boxes at player height"): every
// world sprite listed in cast.json is drawn here instead of by its painter, as a plain white box standing at
// Zhusha's drawn height (H x charScale), with an ink outline and an eye on the side it faces; the code that
// drives the sprite (court.ts: frame, flip, hidden, the entrance's reveal, the hit's white) drives the box.
// When a character's 128 px art lands in public/assets/cast/<who>/<slot>/ (the same sprite contract as
// hers) and cast.json maps the sprite's frame to that slot, the art is drawn instead, at the same scale.

import castRaw from "./cast.json?raw";
import type { RGB } from "../../lab/engine/renderer.ts";
import type { WorldRenderer } from "../../world/render/renderer.ts";
import { SpriteRenderer } from "../render/sprites.ts";
import type { SpriteDef } from "../world/types.ts";
import { drawArt, loadSlot, type Slot } from "../zhusha/anims.ts";
import { drawingIndex } from "../zhusha/contract.ts";
import { ART_PX, BODY_H } from "../zhusha/controller.ts";
import type { PlayView } from "../zhusha/units.ts";
import { npcBox, npcSlot, validateCast, type CastEntry } from "./boxes.ts";

export const CAST = validateCast(JSON.parse(castRaw));

/** Cast slots present at build time: public/assets/cast/<who>/<slot>/anim.json. */
const PRESENT: [string, string][] = Object.keys(import.meta.glob("/public/assets/cast/*/*/anim.json"))
  .map((k) => k.split("/"))
  .map((p): [string, string] => [p[4] ?? "", p[5] ?? ""])
  .filter(([w, s]) => !!w && !!s);

const hex = (s: string): RGB => [parseInt(s.slice(1, 3), 16) / 255, parseInt(s.slice(3, 5), 16) / 255, parseInt(s.slice(5, 7), 16) / 255];
const INK = hex("#1b1922"), PAPER = hex("#fbf8f1"), HURT = hex("#ffd2c8");

/** Loads every present cast slot (key "who/slot"); a slot that fails its contract stays the box. */
export async function loadCast(r: WorldRenderer): Promise<Map<string, Slot>> {
  const out = new Map<string, Slot>();
  await Promise.all(PRESENT.map(async ([who, slot]) => {
    try {
      out.set(`${who}/${slot}`, await loadSlot(r, `/assets/cast/${who}/`, slot));
    } catch (e) {
      console.warn(`cast: ${who}/${slot} left as the box:`, e instanceof Error ? e.message : e);
    }
  }));
  return out;
}

export class NpcDraw {
  private readonly defs: { def: SpriteDef; e: CastEntry }[];
  private readonly ids: Set<string>;
  private readonly art: Map<string, Slot>;
  /** When each NPC's current slot started (a one-shot clip plays from there). */
  private readonly playing = new Map<string, { key: string; t0: number }>();

  constructor(art: Map<string, Slot>, sprites: readonly SpriteDef[]) {
    this.art = art;
    this.defs = sprites.filter((s) => CAST.npcs[s.id]).map((def) => ({ def, e: CAST.npcs[def.id]! }));
    this.ids = new Set(this.defs.map((d) => d.def.id));
  }

  /** Drawn here, not by the sprite renderer. */
  has(sp: SpriteDef): boolean {
    return this.ids.has(sp.id);
  }

  /**
   * Draws the NPCs on the play plane's transform for this pass (`view`, as game.ts set it); `reflection`:
   * the lake's mirrored pass (only those that reflect).
   */
  draw(r: WorldRenderer, view: PlayView, time: number, reflection = false): void {
    for (const { def, e } of this.defs) {
      if (def.hidden || def.plane !== "play" || (reflection && def.reflect === false)) continue;
      const pos = SpriteRenderer.position(def, time);
      const facing: 1 | -1 = pos.flip ? -1 : 1;
      const opacity = 1;
      const slotId = npcSlot(e, pos.frame);
      const slot = slotId ? this.art.get(`${e.who}/${slotId}`) : undefined;
      if (slot) {
        const key = `${e.who}/${slotId}`;
        let p = this.playing.get(def.id);
        if (!p || p.key !== key) this.playing.set(def.id, (p = { key, t0: time }));
        const t = slot.loop ? time * 60 : (time - p.t0) * 60;
        drawArt(r, view, slot, drawingIndex(slot.starts, slot.total, t, slot.loop), pos.x, pos.y, facing < 0, ART_PX, { opacity });
        continue;
      }
      this.playing.delete(def.id);
      this.box(r, def, e, pos.x, pos.y, pos.frame, facing, opacity);
    }
    r.flush();
  }

  /** The white box: horizontal slices (a lean shears it in whole pixels), ink outline, the eye on its facing side. */
  private box(r: WorldRenderer, def: SpriteDef, e: CastEntry, x: number, y: number, frame: number, facing: 1 | -1, opacity: number): void {
    const { w, h, lean } = npcBox(e, BODY_H, frame);
    const o = 2, n = 8, sh = h / n;
    const fill = (def.white ?? 0) > 0.5 ? HURT : PAPER;
    // the entrance's reveal: the share of its width shown, left to right on screen
    const left = x - w / 2 - o, reveal = Math.max(0, Math.min(1, def.reveal ?? 1));
    const right = left + (w + 2 * o) * reveal;
    if (right <= left) return;
    const span = (x0: number, x1: number, yy: number, hh: number, c: RGB): void => {
      const a = x0, b = Math.min(x1, right);
      if (b > a) r.rect(Math.round(a), Math.round(yy), Math.round(b) - Math.round(a), Math.max(1, Math.round(hh)), c, 1, opacity);
    };
    for (let i = 0; i < n; i++) {
      const dx = Math.round(lean * facing * sh * (i + 0.5));
      const y0 = y - sh * (i + 1), y1 = y - sh * i;
      const top = Math.round(y0), bot = Math.round(y1);
      span(x - w / 2 - o + dx, x + w / 2 + o + dx, top, bot - top, INK);
      span(x - w / 2 + dx, x + w / 2 + dx, top + (i === n - 1 ? o : 0), bot - top - (i === n - 1 ? o : 0) - (i === 0 ? o : 0), fill);
    }
    // the eye, near the front of the box on the side it faces
    const ew = Math.max(2, Math.round(0.05 * BODY_H)), eh = Math.max(2, Math.round(0.04 * BODY_H));
    const ex = x + facing * (w / 2 - Math.max(4, 0.09 * BODY_H)) + Math.round(lean * facing * h * 0.82) - ew / 2;
    span(ex, ex + ew, y - h * 0.82 - eh / 2, eh, INK);
  }
}

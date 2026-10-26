// Warning lights (lane R-D): caged beacons on the spire. They mark the
// catwalks' edges and the lift, and they talk:
//   blink    a slow amber pulse at a ledge's edge; it quickens through a
//            gust's tell (about 1.4 s ahead of the push), so even the lights
//            warn you
//   turning  a rotating amber beacon (the lift moving): a lit band sweeps
//            round the lens
//   red      while the arena summons (the Crown): a steady slow red pulse
//   off      dark lens
// A hit makes it spark and flicker (a few frames of dimming and back, never
// a strobe), then carry on. Never breaks (dents mend). The pulses are soft,
// stepped in quarters, and small; they are lamps, not flashes.
// Origin: the foot of its bracket (mount "floor": on the deck; "wall": the
// bracket's back plate; "hang": the top of its drop).

import "./materials.ts";
import { puff } from "../../kit.ts";
import { defineRecipe, type PropGlow, type PropLight } from "../../prop.ts";
import type { Part } from "../../part.ts";
import { STORM, gustNow } from "./storm.ts";

export interface WarningParams {
  mode: "blink" | "turning" | "red" | "off";
  mount: "floor" | "wall" | "hang";
  /** Seconds offset so a row of lights doesn't pulse in step. */
  phase: number;
  /** Goes red while the arena summons (the Crown's lights). */
  arena: boolean;
}

interface Refs {
  on: Part;
  red: Part;
  off: Part;
  band: Part;
  light: PropLight;
  glow: PropGlow;
  flick: number;
  lastLevel: number;
}

export const warningLight = defineRecipe<WarningParams, Refs>({
  id: "warningLight",
  breakage: "never",
  reason: "Beacons at the spire's ledges and the lift: they mark the edges in the storm, quicken ahead of each gust, turn while the lift moves and go red while the arena summons.",
  defaults: { mode: "blink", mount: "floor", phase: 0, arena: false },
  cues: ["metal.hit", "lamp.spark"],
  standard: { h: 0.62, parts: ["cage"], note: "a floor beacon on its post" },
  demo: {
    w: 6,
    variants: [
      { label: "turning (lift)", params: { mode: "turning" }, dx: 1.4 },
      { label: "red (arena)", params: { mode: "red" }, dx: 2.8 },
      { label: "wall", params: { mount: "wall" }, dx: -1.6, at: 1.4 },
    ],
    script: [
      { label: "blink, turning, red", wait: 2.4 },
      { label: "hit: sparks and a flicker, never breaks", hit: "slash", from: -0.7, wait: 1.5 },
      { label: "off", go: "off", wait: 0.6 },
    ],
  },
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const mount = p.mount;
    const cw = u(0.2), chh = u(0.2);
    const postH = mount === "floor" ? u(0.35) : mount === "hang" ? u(0.4) : 0;
    const W = Math.max(cw + 4, u(0.28)), Ht = chh + postH + 6;
    // the lens sits at the cage's centre; origin at the post's foot (or the drop's top)
    const lensY = mount === "hang" ? postH + 3 + (chh >> 1) : 3 + (chh >> 1);
    const cage = b.part("cage", { w: W, h: Ht, pivot: [W >> 1, mount === "hang" ? 0 : mount === "wall" ? lensY : Ht], at: [0, 0], layer: mount === "wall" ? "bg" : "mid", z: 8, collide: "none" });
    const cx = W >> 1;
    const cy0 = mount === "hang" ? postH + 3 : 3;
    // post / bracket / drop
    if (mount === "floor") {
      cage.rect(cx - 2, cy0 + chh, 4, postH, { mat: "spireIron", profile: "cylV" });
      cage.rect(cx - u(0.08), Ht - 3, u(0.16), 3, { mat: "spireIron", profile: "bevel", r: 1, depth: 2, piece: "foot" });
    } else if (mount === "hang") {
      cage.rect(cx - 1, 0, 2, postH + 3, { mat: "spireIronDark", profile: "cylV" });
    } else {
      cage.rect(0, cy0 + (chh >> 1) - 3, 4, 6, { mat: "spireIron", profile: "bevel", r: 1, depth: 2, piece: "plate" });
      cage.rect(3, cy0 + (chh >> 1) - 1, cx - (cw >> 1) - 2, 3, { mat: "spireIron", profile: "cylH", piece: "arm" });
    }
    // the cage: a cap, a base ring and three bars (the lens shows between them)
    cage.piece("cap");
    cage.roundRect(cx - (cw >> 1) - 1, cy0 - 3, cw + 2, 4, 2, { mat: "spireIron", profile: "dome", r: 2, depth: 2, z: 3 });
    cage.rect(cx - (cw >> 1) - 1, cy0 + chh - 2, cw + 2, 3, { mat: "spireIron", profile: "cylH", z: 3, piece: "ring" });
    for (const dx of [-(cw >> 1), 0, cw >> 1]) cage.rect(cx + dx - (dx === 0 ? 0 : dx > 0 ? 1 : 0), cy0, 1, chh - 1, { mat: "spireIronDark", profile: "flat", z: 4, piece: "bar" });
    // three lenses (on, red, off), swapped by visibility; a band for the turning beacon
    const lensLocalY = mount === "hang" ? cy0 + (chh >> 1) : mount === "wall" ? 0 : -Ht + cy0 + (chh >> 1);
    const layer = mount === "wall" ? "bg" : "mid";
    const lens = (name: string, mat: string, z: number): Part => {
      const l = b.part(name, { w: cw, h: chh - 2, pivot: [cw >> 1, (chh - 2) >> 1], at: [0, lensLocalY], layer, z, outline: 0, hittable: false });
      l.ellipse((cw - 1) / 2, (chh - 3) / 2, cw / 2 - 0.5, (chh - 2) / 2 - 0.2, { mat, profile: "dome", r: 3, noInk: true });
      l.rect(2, 1, 2, 1, { mat, mode: "paint", tone: 1 });
      return b.get(name);
    };
    const on = lens("lens-on", "lampAmber", 7);
    const red = lens("lens-red", "lampRed", 7);
    const off = lens("lens-off", "lampOff", 7);
    const bandP = b.part("band", { w: cw, h: chh - 2, pivot: [cw >> 1, (chh - 2) >> 1], at: [0, lensLocalY], layer, z: 7.5, outline: 0, hittable: false });
    bandP.rect(0, 0, 3, chh - 2, { mat: "lampAmber", noInk: true, tone: 1 });
    const band = b.get("band");
    const light = b.light({ at: [0, lensLocalY], colour: [1, 0.62, 0.28], radius: u(2.2), intensity: 0.9, height: u(0.3) });
    const glow = b.glow({ at: [0, lensLocalY], colour: [1, 0.55, 0.22], radius: u(0.4), intensity: 0.5, flat: 0.8 });
    return { on, red, off, band, light, glow, flick: 0, lastLevel: -1 };
  },
  initial: (c) => (c.params["mode"] === "off" ? "off" : "run"),
  states: {
    run: {
      update(c, dt) {
        const r = c.refs;
        const t = c.world.time + Number(c.params["phase"] ?? 0);
        const mode = c.params["arena"] && STORM.arena ? "red" : (c.params["mode"] as WarningParams["mode"]);
        let level: number;
        if (mode === "red") level = 0.55 + 0.45 * (Math.sin(t * 2.4) > 0 ? 1 : 0.5);
        else if (mode === "turning") level = 0.75;
        else {
          // the blink quickens through a gust's tell
          const g = gustNow(c.world.time);
          const per = 1.3 - 0.65 * g.tell;
          const ph = (t % per) / per;
          level = ph < 0.3 ? 1 : ph < 0.42 ? 0.5 : 0.12;
        }
        if (r.flick > 0) {
          r.flick -= dt;
          level *= Math.floor(r.flick * 20) % 2 === 0 ? 0.25 : 1;
        }
        level = Math.round(level * 4) / 4;
        const lit = level > 0.2;
        r.on.visible = lit && mode !== "red";
        r.red.visible = lit && mode === "red";
        r.off.visible = !lit;
        r.band.visible = mode === "turning" && !c.world.reduced;
        if (mode === "turning") r.band.offX = Math.round(((t * 1.6) % 1) * (r.on.grid.w - 3)) - (r.on.grid.w >> 1) + 1;
        const colour: [number, number, number] = mode === "red" ? [1, 0.2, 0.24] : [1, 0.62, 0.28];
        r.light.colour = colour;
        r.glow.colour = colour;
        r.light.level = level * (c.world.reduced ? 0.7 : 1);
        r.glow.level = level * 0.8;
      },
      hit(c, h) {
        if (h.hit.type === "wind") return;
        c.damage(h.hit);
        c.refs.flick = 0.5;
        const [x, y] = [c.x, c.y - c.params.H * 0.4];
        puff(c.world, "spark", x, y, 8, [h.hit.dir[0], -1], { speed: 1 });
        c.sound("lamp.spark", 0.6);
      },
    },
    off: {
      enter(c) {
        const r = c.refs;
        r.on.visible = r.red.visible = r.band.visible = false;
        r.off.visible = true;
        r.light.level = 0;
        r.glow.level = 0;
      },
      hit(c, h) {
        if (h.hit.type !== "wind") c.damage(h.hit);
      },
    },
  },
  actions: {
    on: () => "run",
    off: () => "off",
  },
});

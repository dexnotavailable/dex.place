// The Crown's arena (lane R-D; WORLD-PLAN D3): the floor seals and the
// terminal's roster.
//
//   arenaSeals      five seal plates set into the arena floor's face, 10 H
//                   across: dark (iron medallions inlaid with old brass), glowing (the
//                   terminal is awake: a slow red pulse), forming (it summons:
//                   they light one after another and columns of red rise
//                   from them), held (the seal holds), spent (it cools down:
//                   they fade through smoke to dark). It is also the arena's
//                   hand: it follows the boss terminal's states, rolls the
//                   arena shutters down while it summons and up again after,
//                   and turns the warning lights red (STORM.arena).
//   terminalRoster  the terminal's screen, while it is awake: the real
//                   product list from the site's downloads data (dexClient,
//                   and dexCode, which dexClient installs), nothing invented.
//                   While it cools down after a summons it says plainly that
//                   the download is on the website below. It draws over the
//                   kit terminal's screen (bossTerminal is P0's; this sits on
//                   it at the same origin).
//
// Nothing here fakes a fight or a download: no warden forms (bosses are out
// of scope), the runtime's panel links the website.

import "./materials.ts";
import { F_NOINK } from "../../cells.ts";
import { resolveMat, textPixels } from "../../materials.ts";
import { P_FADE, P_RISE, P_DRAG } from "../../bodies.ts";
import { defineRecipe, type Prop, type PropGlow, type PropLight } from "../../prop.ts";
import type { Part } from "../../part.ts";
import { downloads } from "../../../site/data/downloads.ts";
import { STORM } from "./storm.ts";

// ------------------------------------------------------------------------------------
// the seals

export interface SealParams {
  /** Seal spacing in H (five seals: -2, -1, 0, 1, 2 spacings from the origin). */
  spacing: number;
  /** Depth below the floor's surface of the seals' centres, H. */
  below: number;
  /** The terminal it answers to, and the shutters it closes. */
  terminal: string;
  shutters: string[];
}

interface SealRefs {
  seals: Part[];
  lights: PropLight[];
  beams: PropGlow[];
  level: number[];
  terminalState: string;
  since: number;
}

/**
 * A seal plate set into the arena floor's face: a square iron plate bolted flush at its corners, a
 * round medallion in it (a bronze bezel lit on its upper left, a recessed dark field, the seal's ring
 * and five spokes inlaid). Lit, the inlay and the bezel burn red. A medallion, not a ring of lines:
 * it reads as a thing built into the floor, never as water rippling on a wall.
 */
function drawSeal(p: Part, lit: boolean): void {
  const g = p.grid;
  g.clearAll();
  const plate = resolveMat("spireIron").id;
  const field = resolveMat(lit ? "seal" : "spireIronDark").id;
  const rim = resolveMat(lit ? "seal" : "bronze").id;
  const cx = g.w / 2, cy = g.h / 2, R = Math.min(g.w, g.h) / 2 - 2;
  for (let y = 0; y < g.h; y++)
    for (let x = 0; x < g.w; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      const d = Math.hypot(dx, dy) / R;
      const a = Math.atan2(dy, dx);
      let m = plate, tone = 0, flags = 0;
      // the backing plate: a lit top edge and planet-side edge, a dark foot, bolts at its corners
      if (y === 0 || x === 0) tone = 1;
      else if (y === g.h - 1 || x === g.w - 1) tone = -1;
      const corner = (x === 2 || x === g.w - 3) && (y === 2 || y === g.h - 3);
      if (corner) tone = 1;
      if (d <= 1.0 && d > 0.8) {
        // the bezel
        m = rim;
        tone = dx + dy < -2 ? 1 : dx + dy > 2 ? -1 : 0;
        if (lit) flags = F_NOINK;
      } else if (d <= 0.8) {
        m = field;
        tone = lit ? -1 : d > 0.66 ? -1 : 0;
        const spoke = ((a / (Math.PI * 2)) * 5 + 5.25) % 1 < 0.16;
        if (Math.abs(d - 0.48) < 0.1 || (d < 0.48 && d > 0.2 && spoke) || d < 0.16) {
          m = rim;
          tone = lit ? 1 : 0;
        }
        if (lit) flags = F_NOINK;
      }
      g.setRaw(g.inner(x, y), m, tone, 1, lit ? 1 : 2, flags, 999);
    }
  p.tag["lit"] = lit;
}

export const arenaSeals = defineRecipe<SealParams, SealRefs>({
  id: "arenaSeals",
  breakage: "never",
  reason: "The Crown's floor seals: where every summons is called (a ring of five that lights one after another); they follow the terminal, roll the arena shutters down while it summons, and turn the lights red.",
  defaults: { spacing: 2.5, below: 0.38, terminal: "terminal", shutters: [] },
  cues: ["seal.form", "seal.spent"],
  demo: {
    w: 14,
    script: [
      { label: "dark", wait: 0.6 },
      { label: "glowing (the terminal wakes)", go: "glowing", wait: 1.5 },
      { label: "forming (it summons)", go: "forming", wait: 3 },
      { label: "held", go: "held", wait: 1.5 },
      { label: "spent (it cools down)", go: "spent", wait: 3 },
    ],
  },
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const sw = u(0.5), sh = u(0.5);
    const seals: Part[] = [];
    const lights: PropLight[] = [];
    const beams: PropGlow[] = [];
    for (let k = 0; k < 5; k++) {
      const dx = Math.round((k - 2) * u(p.spacing));
      const name = `seal${k}`;
      b.part(name, { w: sw, h: sh, pivot: [sw >> 1, sh >> 1], at: [dx, u(p.below)], layer: "mid", z: -3, outline: 0, hittable: false });
      const part = b.get(name);
      drawSeal(part, false);
      seals.push(part);
      const L = b.light({ at: [dx, -u(0.3)], colour: [1, 0.22, 0.3], radius: u(2.2), intensity: 0.9, height: u(0.4), flicker: 0.15 });
      L.level = 0;
      lights.push(L);
      const B = b.glow({ kind: "beam", at: [dx, 0], to: [0, -u(3.2)], colour: [1, 0.25, 0.32], radius: u(0.35), width1: u(0.12), intensity: 0.6, flicker: 0.2 });
      B.level = 0;
      beams.push(B);
    }
    return { seals, lights, beams, level: [0, 0, 0, 0, 0], terminalState: "", since: 0 };
  },
  initial: "dark",
  states: {
    dark: {
      enter: (c) => settle(c, 0, 0),
      update: (c, dt) => follow(c, dt),
    },
    glowing: {
      enter: (c) => settle(c, 0.35, 0),
      update(c, dt) {
        const r = c.refs;
        const pulse = 0.25 + 0.15 * (Math.sin(c.world.time * 2.2) > 0 ? 1 : 0);
        for (let k = 0; k < 5; k++) r.lights[k]!.level = pulse * (c.world.reduced ? 0.7 : 1);
        follow(c, dt);
      },
    },
    forming: {
      sound: "seal.form",
      enter(c) {
        shutters(c, "close");
        STORM.arena = true;
      },
      update(c, dt) {
        const r = c.refs;
        // one after another, 0.4 s apart, each fading up over 0.3 s (stepped)
        for (let k = 0; k < 5; k++) {
          const f = Math.max(0, Math.min(1, (c.t - k * 0.4) / 0.3));
          const lv = Math.round(f * 4) / 4;
          if (lv > 0 && !r.seals[k]!.tag["lit"]) {
            drawSeal(r.seals[k]!, true);
            c.sound("seal.form", 0.5);
            const [x, y] = [c.x + r.seals[k]!.x, c.y];
            for (let i = 0; i < 8; i++) c.world.particles.spawn({ x: x + (c.rand() - 0.5) * c.params.H * 0.6, y: y - 1, vx: 0, vy: -c.params.H * (0.6 + c.rand()), life: 0.9, rgb: [255, 110, 120], flags: P_RISE | P_FADE | P_DRAG });
          }
          r.lights[k]!.level = lv;
          r.beams[k]!.level = lv * 0.8;
        }
        follow(c, dt);
      },
    },
    held: {
      enter(c) {
        settle(c, 1, 0.8);
        STORM.arena = true;
      },
      update: (c, dt) => follow(c, dt),
    },
    spent: {
      sound: "seal.spent",
      enter(c) {
        STORM.arena = false;
        shutters(c, "open");
      },
      update(c, dt) {
        const r = c.refs;
        const f = Math.max(0, 1 - c.t / 2.4);
        const lv = Math.round(f * 4) / 4;
        for (let k = 0; k < 5; k++) {
          r.lights[k]!.level = lv;
          r.beams[k]!.level = lv * 0.5;
          if (lv <= 0.25 && r.seals[k]!.tag["lit"]) {
            drawSeal(r.seals[k]!, false);
            const [x, y] = [c.x + r.seals[k]!.x, c.y];
            for (let i = 0; i < 5; i++) c.world.particles.spawn({ x: x + (c.rand() - 0.5) * c.params.H * 0.5, y: y - 2, vx: 0, vy: -c.params.H * 0.4, life: 1.4, rgb: [70, 64, 72], flags: P_RISE | P_FADE | P_DRAG });
          }
        }
        if (c.t > 2.6) {
          c.go("dark");
          return;
        }
        follow(c, dt);
      },
    },
  },
});

function settle(c: Prop<SealRefs>, light: number, beam: number): void {
  const r = c.refs;
  for (let k = 0; k < 5; k++) {
    if (light >= 1 && !r.seals[k]!.tag["lit"]) drawSeal(r.seals[k]!, true);
    if (light < 0.5 && r.seals[k]!.tag["lit"]) drawSeal(r.seals[k]!, false);
    r.lights[k]!.level = light;
    r.beams[k]!.level = beam;
  }
}

function shutters(c: Prop<SealRefs>, act: "open" | "close"): void {
  for (const id of (c.params["shutters"] as string[]) ?? []) c.world.find(id)?.act(act);
}

/** Follow the terminal: woken -> glowing, summoning -> forming, summoned -> held, cooldown -> spent, dormant -> dark. */
function follow(c: Prop<SealRefs>, dt: number): void {
  const r = c.refs;
  r.since += dt;
  const t = c.world.find(String(c.params["terminal"] ?? "terminal"));
  if (!t) return;
  if (t.state === r.terminalState) return;
  r.terminalState = t.state;
  const want: Record<string, string> = { dormant: "dark", woken: "glowing", summoning: "forming", summoned: "held", cooldown: "spent" };
  const next = want[t.state];
  if (!next || next === c.state) return;
  if (next === "dark" && c.state === "spent") return;
  if (next === "dark" || next === "glowing") {
    STORM.arena = false;
    if (c.state === "forming" || c.state === "held") shutters(c, "open");
  }
  c.go(next);
}

// ------------------------------------------------------------------------------------
// the terminal's roster

interface RosterRefs {
  screen: Part;
  mode: string;
  key: number;
}

/** The real products, from the site's downloads data (never invented). */
export function rosterLines(): { name: string; ready: boolean }[] {
  return downloads.map((d) => ({ name: d.name.toUpperCase(), ready: d.file !== null }));
}

export const terminalRoster = defineRecipe<{ terminal: string }, RosterRefs>({
  id: "terminalRoster",
  breakage: "never",
  reason: "The terminal's screen while it is awake: the real products you can summon a fight for (from the downloads list), and afterwards one honest line that the download is on the website below.",
  defaults: { terminal: "terminal" },
  build(b) {
    // the kit terminal's screen rectangle (bossTerminal, section 1 size 1.4 x 1.0 H, details at 0.78)
    const u = (f: number): number => b.u(f * 0.78);
    const Ht = b.u(1.4);
    const bzW = u(0.92), bzH = u(0.44), bzY = u(0.2);
    const sw = bzW - 10, sh = bzH - 10;
    b.part("screen", { w: sw, h: sh, pivot: [Math.floor(sw / 2), sh], at: [0, -(Ht - (bzY + 5 + sh))], layer: "mid", z: 11, outline: 0, hittable: false });
    const screen = b.get("screen");
    screen.visible = false;
    return { screen, mode: "", key: -1 };
  },
  initial: "idle",
  states: {
    idle: {
      update(c) {
        const r = c.refs;
        const t = c.world.find(String(c.params["terminal"] ?? "terminal"));
        const st = t?.state ?? "dormant";
        const mode = st === "woken" ? "list" : st === "cooldown" ? "site" : "off";
        r.screen.visible = mode !== "off";
        if (mode === "off") return;
        const blink = Math.floor(c.world.time * 2) % 2;
        // more products than rows: the list pages every 3 s (nothing is ever dropped)
        const page = Math.floor(c.world.time / 3);
        const key = (mode === "list" ? 0 : 10) + blink + 100 * (mode === "list" ? page : 0);
        if (key === r.key && mode === r.mode) return;
        r.key = key;
        r.mode = mode;
        drawRoster(r.screen, mode, blink === 0, page);
      },
    },
  },
});

function drawRoster(p: Part, mode: string, caret: boolean, page = 0): void {
  const g = p.grid;
  g.clearAll();
  const bg = resolveMat("screen").id;
  const amber = resolveMat("glyph").id, red = resolveMat("seal").id;
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) g.setRaw(g.inner(x, y), bg, y === 0 ? 1 : 0, 1, 1, F_NOINK, 999);
  const put = (x: number, y: number, m: number, tone = 0): void => {
    const i = g.inner(x, y);
    if (i >= 0 && x >= 0 && y >= 0 && x < g.w && y < g.h) g.setRaw(i, m, tone, 2, 1, F_NOINK, 999);
  };
  const text = (s: string, x: number, y: number, m: number, tone = 0): void => {
    for (const [a, b] of textPixels(s).pts) put(x + a, y + b, m, tone);
  };
  if (mode === "list") {
    // the real products, one per row, the ones with a download first: a steady caret on each one you can
    // summon for (it brightens on the blink), none on the dimmed ones; if they don't all fit, the rows page
    const lines = rosterLines().sort((a, b) => Number(b.ready) - Number(a.ready));
    const rows = Math.max(1, Math.floor((g.h - 2) / 7));
    const pages = Math.max(1, Math.ceil(lines.length / rows));
    const first = (page % pages) * rows;
    lines.slice(first, first + rows).forEach((line, k) => {
      const y = 2 + k * 7;
      if (line.ready) for (let j = 0; j < 3; j++) put(2 + (j === 1 ? 1 : 0), y + 1 + j, amber, caret ? 1 : 0);
      text(line.name, 6, y, amber, line.ready ? 0 : -1);
    });
  } else {
    // the honest line: the download is on the website below
    text("SITE BELOW", 2, 2, red, 0);
    if (caret) {
      const cx = Math.floor(g.w / 2);
      for (let j = 0; j < 4; j++) put(cx, 9 + j, red, 1);
      put(cx - 1, 11, red, 1);
      put(cx + 1, 11, red, 1);
      put(cx - 2, 10, red, 0);
      put(cx + 2, 10, red, 0);
    }
  }
}

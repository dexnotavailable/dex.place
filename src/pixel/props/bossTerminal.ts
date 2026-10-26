// The boss terminal: a dispatch console at the top of the spire. E wakes it
// (the screen lights, glyphs scroll in), E again summons: the floor seal
// assembles pixel by pixel, a beam rises and the room turns red; the warden
// would form here (bosses are out of scope: the terminal emits the event and
// waits). After the fight the host calls cooldown: the seal sweeps away and
// the screen counts down to dormant. Every visit is a fresh fight.
// Hits dent the iron and spark, glitch the screen; it mends.
// Origin: floor, centre.

import { F_NOINK } from "../cells.ts";
import { resolveMat, textPixels } from "../materials.ts";
import { P_ADD, P_DRAG } from "../bodies.ts";
import { defineRecipe, type Prop, type PropGlow, type PropLight } from "../prop.ts";
import type { Part } from "../part.ts";
import type { Rope } from "../motion.ts";
import { hash2 } from "../util.ts";

type GlyphMode = "standby" | "awake" | "summon" | "cooldown";

interface Refs {
  body: Part;
  glyphs: Part;
  crest: Part;
  seal: Part;
  screenLight: PropLight;
  sealLight: PropLight;
  beam: PropGlow;
  ring: PropGlow;
  screenGlow: PropGlow;
  cables: Rope[];
  mode: GlyphMode;
  glitch: number;
  deny: number;
  modeT: number;
}

const GLYPH_SET = ":+-/01.:'";

function drawGlyphs(c: Prop<Refs>, p: Part): void {
  const R = c.refs;
  const g = p.grid;
  g.clearAll();
  const t = R.modeT;
  const amber = resolveMat("glyph").id, red = resolveMat("seal").id;
  const put = (x: number, y: number, m: number, tone = 0): void => {
    const i = g.inner(x, y);
    if (i >= 0) g.setRaw(i, m, tone, 1, 1, F_NOINK, 1);
  };
  const text = (s: string, x: number, y: number, m: number, tone = 0): void => {
    for (const [a, b] of textPixels(s).pts) if (y + b >= 1 && y + b < g.h - 1) put(x + a, y + b, m, tone);
  };
  if (R.glitch > 0) {
    for (let k = 0; k < g.w * g.h * 0.18; k++) {
      const x = Math.floor(hash2(k, Math.floor(c.world.time * 30), 3) * g.w), y = Math.floor(hash2(k, Math.floor(c.world.time * 30), 9) * g.h);
      put(x, y, R.mode === "summon" || R.mode === "cooldown" ? red : amber, -1 + (k % 3));
    }
    return;
  }
  switch (R.mode) {
    case "standby":
      if ((t * 0.8) % 1 < 0.5) put(g.w - 4, g.h - 4, amber, -1);
      break;
    case "awake": {
      // header bar, then scrolling rows of glyphs
      for (let x = 2; x < g.w - 2; x++) put(x, 2, amber, x < 10 ? 1 : 0);
      const scroll = Math.floor(t * 9);
      for (let row = 0; row < 8; row++) {
        const y = 6 + row * 7 - (scroll % 7);
        const line = Math.floor(scroll / 7) + row;
        let s = "";
        for (let k = 0; k < Math.floor((g.w - 4) / 4); k++) s += GLYPH_SET[Math.floor(hash2(line, k, 5) * GLYPH_SET.length)]!;
        text(s.slice(0, 2 + Math.floor(hash2(line, 1, 7) * (s.length - 2))), 2, y, amber, row === 7 ? 1 : 0);
      }
      if ((t * 2) % 1 < 0.5) put(g.w - 4, g.h - 3, amber, 1);
      break;
    }
    case "summon": {
      // the warden's seal on screen, and a filling bar
      const cx = g.w / 2, cy = g.h / 2 - 2, r = Math.min(g.w, g.h) * 0.32;
      const pulse = (Math.sin(t * 10) + 1) / 2;
      for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
        const d = Math.hypot(x + 0.5 - cx, (y + 0.5 - cy) * 1.1);
        if (Math.abs(d - r) < 1.1 || (d < r && (Math.abs(x + 0.5 - cx) < 1 || Math.abs(y + 0.5 - cy) < 1))) put(x, y, red, pulse > 0.5 ? 1 : 0);
      }
      const fill = Math.min(1, t / 2.4);
      for (let x = 3; x < 3 + (g.w - 6) * fill; x++) put(x, g.h - 3, red, 1);
      break;
    }
    case "cooldown": {
      const left = Math.max(0, 1 - t / 8);
      text("--", 3, 3, red, -1);
      for (let x = 3; x < 3 + (g.w - 6) * left; x++) put(x, g.h - 4, red, (t * 1.5) % 1 < 0.5 ? 0 : -1);
      break;
    }
  }
  if (R.deny > 0) for (let x = 1; x < g.w - 1; x++) { put(x, 1, red, 1); put(x, g.h - 2, red, 1); }
}

function drawSeal(p: Part, H: number): void {
  const g = p.grid;
  const seal = resolveMat("seal").id;
  const cx = g.w / 2, cy = g.h / 2, rx = g.w / 2 - 2, ry = g.h / 2 - 1.5;
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
      const d = Math.hypot(nx, ny);
      const a = Math.atan2(ny, nx);
      let on = false, tone = 0;
      if (Math.abs(d - 1) < 1.6 / ry) { on = true; tone = 0; }
      else if (Math.abs(d - 0.7) < 0.9 / ry) { on = true; tone = -1; }
      else if (d < 0.97 && d > 0.74) {
        // glyph ticks between the rings
        const k = ((a / (Math.PI * 2)) * Math.round(H * 0.45) + 100) % 1;
        if (k < 0.12) { on = true; tone = -1; }
      } else if (d < 0.3 && (Math.abs(nx) < 0.5 / rx * 2 || Math.abs(ny) < 0.8 / ry)) { on = true; tone = 0; }
      if (on) g.setRaw(g.inner(x, y), seal, tone, 1, 1, F_NOINK, 1);
    }
  }
}

function setMode(c: Prop<Refs>, m: GlyphMode): void {
  c.refs.mode = m;
  c.refs.modeT = 0;
}

export const bossTerminal = defineRecipe<Record<string, unknown>, Refs>({
  id: "bossTerminal",
  breakage: "never",
  reason: "Downloads in the world: every product visit is summoned here as a fresh warden fight; win, and the product's menu opens.",
  demo: {
    w: 6, indoor: true,
    script: [
      { label: "dormant", wait: 1 },
      { label: "E: woken (the screen lights)", use: true, from: -0.9, wait: 2 },
      { label: "E: summoning (seal forms, beam rises)", use: true, from: -0.9, wait: 3.5 },
      { label: "host: cooldown", go: "cooldown", wait: 3 },
      { label: "hit: dents, sparks, glitch, never breaks", hit: "slash", from: -1.0, wait: 2 },
    ],
  },
  defaults: {},
  use: { reach: 0.9, prompt: "use" },
  standard: { w: 1.0, h: 1.4, parts: ["terminal"], note: "boss terminal" },
  build(b, p) {
    // WORLD-PLAN section 1: 1.4 H tall, 1.0 H wide; the details keep the proof's proportions at 0.78
    const u = (f: number): number => b.u(f * 0.78);
    const W = b.u(1.0), Ht = b.u(1.4);
    const cx = Math.floor(W / 2);
    const t = b.part("terminal", { w: W, h: Ht, pivot: [cx, Ht], at: [0, 0], layer: "mid", z: 8, collide: "solid" });
    // stepped plinth
    t.piece("plinth");
    t.rect(0, Ht - u(0.12), W, u(0.12), { mat: "stoneDark", profile: "bevel", r: 3, depth: 4 });
    t.rect(u(0.1), Ht - u(0.24), W - u(0.2), u(0.13), { mat: "stoneDark", profile: "bevel", r: 3, depth: 5, z: 1, piece: "plinth2" });
    t.speckle({ amount: 0.1, seed: p.seed, tone: -1, region: { x0: 0, y0: Ht - u(0.24), x1: W, y1: Ht } });
    // iron body, tapering
    t.piece("body");
    const bodyTop = u(0.62), bodyBot = Ht - u(0.24);
    t.poly([cx - u(0.26), bodyTop, cx + u(0.26), bodyTop, cx + u(0.33), bodyBot, cx - u(0.33), bodyBot], { mat: "iron", profile: "bevel", r: 4, depth: 5 });
    for (const s of [-1, 1]) t.stroke([cx + s * u(0.22), bodyTop + 3, cx + s * u(0.28), bodyBot - 2], 2, { mat: "brass", z: 5, piece: "trim" });
    // vents and the engraved seal panel
    for (let k = 0; k < 3; k++) t.rect(cx - u(0.14), bodyTop + u(0.1) + k * 5, u(0.28), 2, { mat: "soot", profile: "flat", noInk: true, piece: "vent" });
    t.roundRect(cx - u(0.13), bodyTop + u(0.32), u(0.26), u(0.36), 3, { mat: "iron", profile: "sunk", r: 3, depth: 2, z: 5, piece: "panel" });
    t.ornament(cx - 4, bodyTop + u(0.32) + u(0.1), `
      ..###..
      .#...#.
      #..#..#
      #.###.#
      #..#..#
      .#...#.
      ..###..
    `, { "#": { mat: "brass", tone: 0 } }, { profile: "flat", z: 5, piece: "mark" });
    t.rivets([[cx - u(0.3), bodyBot - 4], [cx + u(0.3), bodyBot - 4], [cx - u(0.24), bodyTop + 4], [cx + u(0.24), bodyTop + 4]], { mat: "brass", r: 1.2, z: 6 });
    // screen bezel
    t.piece("bezel");
    const bzW = u(0.92), bzH = u(0.44), bzY = u(0.2);
    t.roundRect(cx - bzW / 2, bzY, bzW, bzH, 4, { mat: "iron", profile: "bevel", r: 3, depth: 5, z: 3 });
    t.roundRect(cx - bzW / 2, bzY, bzW, bzH, 4, { mat: "brass", mode: "paint", paint: (_x, _y, d) => (d < 1.5 ? "brass" : null) });
    // neck between bezel and body
    t.rect(cx - u(0.12), bzY + bzH - 2, u(0.24), bodyTop - bzY - bzH + 4, { mat: "iron", profile: "cylV", z: 2, piece: "neck" });
    // crest: the dispatch seal on top
    t.piece("crest");
    t.ring(cx, u(0.11), u(0.06), u(0.1), { mat: "brass", profile: "dome", r: 2, z: 4 });
    t.poly([cx - 2, u(0.02), cx + 2, u(0.02), cx + 1, -1 + 1, cx - 1, 1], { mat: "brass", profile: "cylV", z: 4 });
    t.rect(cx - 1, u(0.02), 3, u(0.09), { mat: "brass", profile: "cylV", z: 5 });
    b.get("terminal").tag["heal"] = true;
    // screen glass and its glyph layer
    const sw = bzW - 10, sh = bzH - 10;
    const scr = b.part("screen", { w: sw, h: sh, pivot: [Math.floor(sw / 2), sh], at: [0, -(Ht - (bzY + 5 + sh))], layer: "mid", z: 9 });
    scr.rect(0, 0, sw, sh, { mat: "screen", profile: "dome", r: Math.floor(sh / 2), depth: 3 });
    scr.rect(1, 1, sw - 2, 1, { mat: "screen", mode: "paint", tone: 1 });
    b.part("glyphs", { w: sw, h: sh, pivot: [Math.floor(sw / 2), sh], at: [0, -(Ht - (bzY + 5 + sh))], layer: "mid", z: 10, outline: 0, hittable: false });
    // crest glow ring (lights when woken)
    const cr = b.part("crest", { w: u(0.22), h: u(0.22), pivot: [Math.floor(u(0.22) / 2), Math.floor(u(0.22) / 2)], at: [0, -(Ht - u(0.11))], layer: "mid", z: 10, outline: 0, hittable: false });
    cr.ring(u(0.11), u(0.11), u(0.065) - 0.5, u(0.08), { mat: "seal", profile: "flat" });
    // the floor seal (decal on the ground) and the summoning light
    const sealW = u(3.2), sealH = 13;
    b.part("seal", { w: sealW, h: sealH, pivot: [Math.floor(sealW / 2), 0], at: [0, 1], layer: "decal", z: 1, outline: 0, hittable: false, mask: "ground" });
    const sealPart = b.get("seal");
    sealPart.dissolve = 1;
    sealPart.visible = false;
    const crestPart = b.get("crest");
    crestPart.dissolve = 1;
    crestPart.visible = false;
    const screenLight = b.light({ at: [0, -(Ht - bzY - bzH / 2)], colour: [1, 0.64, 0.32], radius: u(1.7), intensity: 0.8, height: u(0.5), flicker: 0.15 });
    const sealLight = b.light({ at: [0, -u(0.4)], colour: [1, 0.22, 0.3], radius: u(3.6), intensity: 1.1, height: u(0.4), flicker: 0.2 });
    const beam = b.glow({ kind: "beam", at: [0, 4], to: [0, -u(5)], colour: [1, 0.25, 0.32], radius: u(1.1), width1: u(0.35), intensity: 0.7, flicker: 0.25 });
    const ring = b.glow({ kind: "ring", at: [0, 7], colour: [1, 0.3, 0.36], radius: u(1.55), flat: 0.1, thick: 3, intensity: 0.45 });
    const screenGlow = b.glow({ kind: "disc", at: [0, -(Ht - bzY - bzH / 2)], colour: [1, 0.55, 0.25], radius: u(0.55), flat: 0.7, intensity: 0.35 });
    for (const L of [screenLight, sealLight]) L.level = 0;
    for (const G of [beam, ring, screenGlow]) G.level = 0;
    // cables from the back of the body to the floor
    const cables: Rope[] = [];
    for (const s of [-1, 1]) {
      const { rope, part } = b.rope(`cable${s}`, { from: [s * u(0.2), -u(0.9)], to: [s * u(0.95), -2], segments: 12, slack: 1.12, mat: "lead", width: 3, pinStart: true, pinEnd: true, layer: "mid", reach: u(0.4) });
      part.z = 6;
      cables.push(rope);
    }
    return {
      body: b.get("terminal"), glyphs: b.get("glyphs"), crest: b.get("crest"), seal: b.get("seal"), screenLight, sealLight, beam, ring, screenGlow, cables,
      mode: "standby", glitch: 0, deny: 0, modeT: 0,
    };
  },
  initial: "dormant",
  states: {
    dormant: {
      enter(c) {
        setMode(c, "standby");
        fade(c, 0, 0, 0, 1);
      },
      update: (c, dt) => tick(c, dt),
      hit: (c, h) => hurt(c, h.hit),
      use: () => "woken",
    },
    woken: {
      sound: "terminal.wake",
      enter(c) {
        setMode(c, "awake");
        const gp = c.refs.glyphs;
        gp.dissolveMode = 2;
        gp.dissolve = 1;
        c.world.tweens.add({ target: gp, key: "dissolve", to: 0, dur: 0.6, ease: "outCubic" });
        fade(c, 1, 0, 0, 1);
      },
      update: (c, dt) => tick(c, dt),
      hit: (c, h) => hurt(c, h.hit),
      use: () => "summoning",
      after: [14, "dormant"],
    },
    summoning: {
      sound: "terminal.summon",
      enter(c) {
        setMode(c, "summon");
        const s = c.refs.seal;
        s.dissolveMode = 1;
        s.dissolve = 1;
        c.world.tweens.add({ target: s, key: "dissolve", to: 0, dur: 2, ease: "inOutSine" });
        fade(c, 0.7, 1, 1, 2);
        c.emit({ type: "summon", stage: "begin", x: c.x, y: c.y });
        c.emit({ type: "shake", amplitude: 2, duration: 0.6 });
      },
      update(c, dt) {
        tick(c, dt);
        // motes rise into the beam
        if (c.rand() < dt * 30) {
          const x = c.x + (c.rand() - 0.5) * c.params.H * 2.6;
          c.world.particles.spawn({ x, y: c.y + 2, vx: (c.x - x) * 0.3, vy: -c.params.H * (0.8 + c.rand()), life: 0.8 + c.rand() * 0.6, rgb: [255, 120, 130], flags: P_ADD | P_DRAG });
        }
      },
      hit: (c, h) => hurt(c, h.hit),
      after: [2.4, "summoned"],
    },
    summoned: {
      enter(c) {
        c.emit({ type: "warden", action: "form", x: c.x, y: c.y });
      },
      update: (c, dt) => tick(c, dt),
      hit: (c, h) => hurt(c, h.hit),
      use(c) {
        c.refs.deny = 0.4;
        c.sound("terminal.deny", 0.6);
      },
      after: [20, "cooldown"],
    },
    cooldown: {
      sound: "terminal.cool",
      enter(c) {
        setMode(c, "cooldown");
        const s = c.refs.seal;
        s.dissolveMode = 2;
        c.world.tweens.add({ target: s, key: "dissolve", to: 1, dur: 2.6, ease: "inOutSine" });
        fade(c, 0.35, 0, 0, 2.5);
      },
      update: (c, dt) => tick(c, dt),
      hit: (c, h) => hurt(c, h.hit),
      use(c) {
        c.refs.deny = 0.4;
        c.sound("terminal.deny", 0.6);
      },
      after: [8, "dormant"],
    },
  },
});

/** Tween the lights: screen, seal (beam, ring, red light), crest glow. */
function fade(c: Prop<Refs>, screen: number, seal: number, beam: number, dur: number): void {
  const R = c.refs;
  const tw = c.world.tweens;
  tw.add({ target: R.screenLight, key: "level", to: screen, dur: dur * 0.4 });
  tw.add({ target: R.screenGlow, key: "level", to: screen, dur: dur * 0.4 });
  tw.add({ target: R.sealLight, key: "level", to: seal, dur });
  tw.add({ target: R.ring, key: "level", to: seal, dur });
  tw.add({ target: R.beam, key: "level", to: beam, dur, ease: "inCubic" });
  const cr = R.crest;
  cr.dissolveMode = 0;
  tw.add({ target: cr, key: "dissolve", to: screen > 0 ? 0 : 1, dur: dur * 0.5 });
}

function tick(c: Prop<Refs>, dt: number): void {
  const R = c.refs;
  R.modeT += dt;
  R.glitch = Math.max(0, R.glitch - dt);
  R.deny = Math.max(0, R.deny - dt);
  // screen colour follows the mode
  R.screenLight.colour = R.mode === "summon" || R.mode === "cooldown" ? [1, 0.3, 0.32] : [1, 0.64, 0.32];
  R.screenGlow.colour = R.screenLight.colour;
  // redraw only when the picture changes: the standby cursor blinks, the rest animate at 15 Hz
  const key = R.glitch > 0 ? -1 - c.world.stats.steps : R.mode === "standby" ? ((R.modeT * 0.8) % 1 < 0.5 ? 1 : 0) + (R.deny > 0 ? 2 : 0) : Math.floor(c.world.time * 15) * 4 + (R.deny > 0 ? 1 : 0);
  if (key !== R.glyphs.tag["key"]) {
    R.glyphs.tag["key"] = key;
    drawGlyphs(c, R.glyphs);
  }
  if (R.seal.grid.count === 0) drawSeal(R.seal, c.params.H);
  R.seal.visible = R.seal.dissolve < 0.999;
  R.crest.visible = R.crest.dissolve < 0.999;
  R.beam.radius = c.params.H * (1.05 + Math.sin(c.world.time * 6) * 0.08);
}

function hurt(c: Prop<Refs>, hit: import("../hits.ts").Hit): void {
  const R = c.refs;
  if (hit.type !== "wind") {
    c.damage(hit, ["terminal", "screen"]);
    R.glitch = 0.35;
  }
  for (const r of R.cables) r.push(hit.shape.kind === "point" ? hit.shape.x : c.x, c.y - c.params.H * 0.4, c.params.H * 2, hit.dir[0] * 3, -2);
}

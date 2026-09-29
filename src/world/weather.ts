// Weather and time. States: serene, mist, overcast, rain, storm, after (the
// clearing after a storm). A room's program says which state holds where
// (zones along the room's width), so walking across the plain takes you from
// mist into a storm; interiors inherit the outdoor weather and hear it
// through the walls. Parameters ease toward the target slowly, so weather
// changes read as weather, not as a switch.
//
// Outputs: uniforms every backdrop layer can read (rain, wind, mist, dark,
// flash, overcast, after, bolt), sprite lighting changes, lightning strikes
// (through the global flash gate: at most 3 flash starts in any second, 1 per
// 2 s in reduced motion) with thunder after a distance delay, and wind that
// pushes cloth, grass and flames.

import { f } from "../scenes/engine/layers.ts";
import { mist } from "../scenes/engine/layers.ts";
import type { Hex } from "../scenes/engine/palette.ts";
import type { BuildCtx, LayerDef, LightOut, SceneDef } from "../scenes/engine/types.ts";
import type { WeatherUniforms, WorldLayer } from "./backdrop/engine.ts";
import type { Lighting, RGB } from "./render/renderer.ts";

export type WeatherState = "serene" | "mist" | "overcast" | "rain" | "storm" | "after";
export type TimeOfDay = "day" | "dusk" | "night";

export interface WeatherParams {
  rain: number;
  wind: number;
  mist: number;
  dark: number;
  overcast: number;
  /** Lightning starts per minute (before the flash gate). */
  lightning: number;
  gust: number;
  after: number;
}

export const STATES: Record<WeatherState, WeatherParams> = {
  serene: { rain: 0, wind: 0.08, mist: 0.12, dark: 0, overcast: 0, lightning: 0, gust: 0.1, after: 0 },
  mist: { rain: 0, wind: 0.05, mist: 0.95, dark: 0.08, overcast: 0.35, lightning: 0, gust: 0.05, after: 0 },
  overcast: { rain: 0, wind: 0.35, mist: 0.35, dark: 0.22, overcast: 0.85, lightning: 0, gust: 0.3, after: 0 },
  rain: { rain: 0.55, wind: 0.5, mist: 0.3, dark: 0.42, overcast: 1, lightning: 1.2, gust: 0.45, after: 0 },
  storm: { rain: 1, wind: 0.95, mist: 0.25, dark: 0.72, overcast: 1, lightning: 10, gust: 0.9, after: 0 },
  after: { rain: 0, wind: 0.12, mist: 0.45, dark: 0.06, overcast: 0.35, lightning: 0, gust: 0.1, after: 1 },
};

export interface WeatherZone {
  /** Room-width fractions. */
  x0: number;
  x1: number;
  state: WeatherState;
}

export interface WeatherProgram {
  /** One state for the whole room... */
  state?: WeatherState;
  /** ...or zones along the room (blended over `feather` of the width at their edges). */
  zones?: WeatherZone[];
  feather?: number;
  /** Inside: keeps the outdoor weather (heard through walls, seen through windows). */
  interior?: boolean;
  time: TimeOfDay;
}

export interface Strike {
  /** Room-space x of the bolt (for light and thunder). */
  x: number;
  seed: number;
  age: number;
  dur: number;
  level: number;
  double: boolean;
  /** Seconds until the thunder arrives. */
  thunderIn: number;
  heard: boolean;
  bolt: boolean;
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export class Weather {
  p: WeatherParams = { ...STATES.serene };
  /** Last outdoor parameters (interiors keep them). */
  private outdoor: WeatherParams = { ...STATES.serene };
  time: TimeOfDay = "day";
  interior = false;
  wind = 0;
  flash = 0;
  strikes: Strike[] = [];
  seconds = 0;
  /** State name nearest the current mix (debug). */
  label: WeatherState = "serene";
  onThunder: (strength: number, distance: number) => void = () => {};
  /** Programs replaced for a visit (the storm passes while you're indoors). */
  overrides = new Map<string, WeatherProgram>();

  constructor(private gate: () => boolean) {}

  /** Target parameters for a program at room-x fraction u. */
  target(prog: WeatherProgram, u: number): { p: WeatherParams; label: WeatherState } {
    if (prog.zones && prog.zones.length) {
      const fe = prog.feather ?? 0.06;
      let wsum = 0;
      const acc: WeatherParams = { rain: 0, wind: 0, mist: 0, dark: 0, overcast: 0, lightning: 0, gust: 0, after: 0 };
      let best = prog.zones[0]!.state;
      let bw = -1;
      for (const z of prog.zones) {
        const w = Math.max(0, Math.min(1, Math.min((u - z.x0 + fe) / (2 * fe), (z.x1 - u + fe) / (2 * fe))));
        if (w <= 0) continue;
        const s = STATES[z.state];
        for (const k of Object.keys(acc) as (keyof WeatherParams)[]) acc[k] += s[k] * w;
        wsum += w;
        if (w > bw) {
          bw = w;
          best = z.state;
        }
      }
      if (wsum > 0) for (const k of Object.keys(acc) as (keyof WeatherParams)[]) acc[k] /= wsum;
      return { p: acc, label: best };
    }
    const s = prog.state ?? "serene";
    return { p: { ...STATES[s] }, label: s };
  }

  /** Snap straight to a program (room entry, no easing). */
  snap(prog: WeatherProgram, u: number): void {
    this.interior = !!prog.interior;
    this.time = prog.time;
    if (prog.interior) {
      this.p = { ...this.outdoor };
      return;
    }
    const t = this.target(prog, u);
    this.p = t.p;
    this.outdoor = { ...t.p };
    this.label = t.label;
  }

  update(dt: number, prog: WeatherProgram, u: number, roomW: number, viewX: number, reduced: boolean): void {
    this.seconds += dt;
    this.interior = !!prog.interior;
    this.time = prog.time;
    if (!prog.interior) {
      const t = this.target(prog, u);
      this.label = t.label;
      const k = Math.min(1, dt * 0.35);
      for (const key of Object.keys(this.p) as (keyof WeatherParams)[]) this.p[key] = lerp(this.p[key], t.p[key], k);
      this.outdoor = { ...this.p };
    }
    // wind: a base from the weather plus slow gusts (whole-number-free; props quantise)
    const g = this.p.gust;
    const gustN = Math.sin(this.seconds * 0.37) * 0.5 + Math.sin(this.seconds * 1.13 + 1.7) * 0.3 + Math.sin(this.seconds * 2.9 + 0.4) * 0.2;
    this.wind = this.p.wind * (0.75 + 0.25 * gustN * g * 2) * (reduced ? 0.6 : 1);
    // lightning (outdoors: strikes; indoors: still flashes through the windows)
    const rate = this.p.lightning * (reduced ? 0.4 : 1);
    if (rate > 0 && Math.random() < (rate / 60) * dt && this.gate()) {
      const dist = 0.3 + Math.random() * 0.7;
      const double = !reduced && Math.random() < 0.35;
      this.strikes.push({
        x: viewX + (0.1 + Math.random() * 0.8) * 1280,
        seed: Math.floor(Math.random() * 9999),
        age: 0,
        dur: Math.max(0.18, (double ? 0.5 : 0.3) * (reduced ? 1.8 : 1)),
        level: 0,
        double,
        thunderIn: 0.4 + dist * 2.6,
        heard: false,
        bolt: Math.random() < 0.75,
      });
    }
    let fl = 0;
    for (const s of this.strikes) {
      s.age += dt;
      const t = s.age / s.dur;
      // stepped in quarters, never shorter than 0.18 s; a double strike pulses twice
      let e = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85;
      if (s.double && t > 0.35 && t < 0.55) e *= 0.35;
      s.level = Math.max(0, Math.ceil(Math.min(1, e) * 4) / 4) * (reduced ? 0.6 : 1);
      fl = Math.max(fl, s.level);
      if (!s.heard && s.age >= s.thunderIn) {
        s.heard = true;
        this.onThunder(0.6 + (1 - s.thunderIn / 3) * 0.4, s.thunderIn);
      }
    }
    this.strikes = this.strikes.filter((s) => s.age < s.dur || !s.heard);
    this.flash = fl;
    void roomW;
  }

  uniforms(camX: number, horizon: number): WeatherUniforms {
    const live = this.strikes.find((s) => s.level > 0 && s.bolt);
    return {
      rain: this.p.rain,
      wind: this.wind,
      mist: this.p.mist,
      dark: this.p.dark,
      flash: this.flash,
      time: this.seconds,
      overcast: this.p.overcast,
      after: this.p.after,
      bolt: live ? [Math.round(live.x - camX), live.seed, live.level, horizon] : [0, 0, 0, 0],
    };
  }

  /** Flash lights for the backdrop (screen space), so clouds and rock light up. */
  flashLights(camX: number): LightOut[] {
    return this.strikes
      .filter((s) => s.level > 0)
      .map((s) => ({ x: s.x - camX, y: 60, radius: 900, intensity: s.level * 0.9, colour: [0.82, 0.84, 1] as [number, number, number] }));
  }

  /**
   * Sprite lighting for the room under this weather and time. `subject` is the
   * player: lightning lights the world (props, terrain, the backdrop) but not
   * her, so she stays readable through a strike: no key or ambient surge,
   * only a faint cool edge on the rim (at most +0.12, a quarter of the way to
   * the strike's colour).
   */
  lighting(base: Lighting, subject = false): Lighting {
    const p = this.p;
    const tod = this.time === "dusk" ? 0.85 : this.time === "night" ? 0.6 : 1;
    const inside = this.interior ? 0.35 : 1;
    const dark = p.dark * inside;
    const mul = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];
    const storm: RGB = [0.78, 0.84, 1];
    const tint = (c: RGB): RGB => [lerp(c[0], c[0] * storm[0], dark), lerp(c[1], c[1] * storm[1], dark), lerp(c[2], c[2] * storm[2], dark)];
    const fl = this.flash * (this.interior ? 0.35 : 1);
    if (subject) {
      const e = fl * 0.25;
      return {
        ...base,
        ambient: tint(mul(base.ambient, (1 - dark * 0.3) * tod)),
        keyColour: tint(mul(base.keyColour, (1 - dark * 0.7 - p.overcast * 0.15 * inside) * tod)),
        rimColour: e > 0 ? [lerp(base.rimColour[0], 0.9, e), lerp(base.rimColour[1], 0.92, e), lerp(base.rimColour[2], 1, e)] : base.rimColour,
        rimIntensity: base.rimIntensity * (1 - dark * 0.3) + fl * 0.12,
      };
    }
    return {
      ...base,
      ambient: tint(mul(base.ambient, (1 - dark * 0.3) * tod + fl * 0.5)),
      keyColour: tint(mul(base.keyColour, (1 - dark * 0.7 - p.overcast * 0.15 * inside) * tod + fl * 0.8)),
      rimColour: fl > 0 ? [lerp(base.rimColour[0], 0.9, fl), lerp(base.rimColour[1], 0.92, fl), lerp(base.rimColour[2], 1, fl)] : base.rimColour,
      rimIntensity: base.rimIntensity * (1 - dark * 0.3) + fl * 0.6,
    };
  }
}

// --- backdrop layers ---------------------------------------------------------------

const WX_RAMPS: Record<string, Hex[]> = {
  wxrain: ["#5c6a78", "#7d8b98", "#a3aeb8", "#cfd6de"],
  wxmist: ["#4e5a62", "#66737a", "#808b90", "#9ba4a6"],
  wxbolt: ["#9fa6d8", "#cfd2f4", "#f4f5ff"],
};

function rainBody(o: { cw: number; len: number; speed: number; alpha: number; dens: number; seed: number; shade: number }): string {
  return /* glsl */ `
vec4 layer(vec2 p, vec2 s) {
  float rain = uWx.x;
  if (rain <= 0.01) return vec4(0.0);
  float slant = clamp(uWx.y, -1.0, 1.0) * 0.45;
  float t = floor(uWx2.y * ${f(o.speed)});
  vec2 q = vec2(p.x - floor(p.y * slant), p.y);
  float col = floor(q.x / ${f(o.cw)});
  float h = hash2(vec2(col, ${f(o.seed)}));
  if (h > rain * ${f(o.dens)}) return vec4(0.0);
  float xo = floor(hash2(vec2(col, ${f(o.seed + 3)})) * ${f(o.cw - 1)});
  if (floor(q.x - col * ${f(o.cw)}) != xo) return vec4(0.0);
  float per = ${f(o.len * 6)} + floor(h * ${f(o.len * 5)});
  float y = mod(q.y + t * (0.8 + 0.4 * h) + h * 997.0, per);
  if (y > ${f(o.len)}) return vec4(0.0);
  float lit = ${f(o.shade)} + uWx2.x * 0.5 + sceneLight(s, uDepth) * 0.5;
  vec3 c = ramp(R_WXRAIN, lit, p, 0.0);
  float a = ${f(o.alpha)} * (y < ${f(o.len * 0.5)} ? 1.0 : 0.6);
  return vec4(c, a);
}`;
}

const BOLT_BODY = /* glsl */ `
vec4 layer(vec2 p, vec2 s) {
  if (uBolt.z <= 0.0) return vec4(0.0);
  float bottom = uBolt.w;
  if (s.y > bottom) return vec4(0.0);
  // a jagged stepped path from the top down to the horizon, 12 px segments
  float seg = floor(s.y / 12.0);
  float fy = fract(s.y / 12.0);
  float xa = uBolt.x + (hash2(vec2(seg, uBolt.y)) - 0.5) * 38.0 + seg * (hash2(vec2(uBolt.y, 5.0)) - 0.5) * 6.0;
  float xb = uBolt.x + (hash2(vec2(seg + 1.0, uBolt.y)) - 0.5) * 38.0 + (seg + 1.0) * (hash2(vec2(uBolt.y, 5.0)) - 0.5) * 6.0;
  float x = floor(mix(xa, xb, fy) + 0.5);
  float d = abs(s.x - x);
  // a branch now and then
  float bseg = floor(hash2(vec2(uBolt.y, 9.0)) * 10.0) + 3.0;
  if (seg > bseg && seg < bseg + 4.0) {
    float bx = x + (s.y - bseg * 12.0) * (hash2(vec2(uBolt.y, 11.0)) > 0.5 ? 0.9 : -0.9);
    d = min(d, abs(s.x - floor(bx + 0.5)) + 0.5);
  }
  if (d > 1.5) return vec4(0.0);
  vec3 c = ramp(R_WXBOLT, d < 0.6 ? 0.99 : 0.4, p, 0.0);
  return vec4(c, uBolt.z * (d < 0.6 ? 1.0 : 0.5));
}`;

const GRADE_BODY = /* glsl */ `
vec4 layer(vec2 p, vec2 s) {
  // a flat multiply toward cold storm light (no dither, no gradient)
  float d = uWx.w;
  vec3 m = mix(vec3(1.0), vec3(0.42, 0.47, 0.6), d);
  m = mix(m, vec3(1.0), uWx2.x * 0.35);
  return vec4(m, 1.0);
}`;

const FLASH_BODY = /* glsl */ `
vec4 layer(vec2 p, vec2 s) {
  if (uWx2.x <= 0.0) return vec4(0.0);
  // the sky lights up in stepped bands, strongest at the top
  float k = floor((1.0 - s.y / uRes.y) * 4.0) / 4.0;
  return vec4(vec3(0.62, 0.66, 0.86), uWx2.x * (0.1 + 0.22 * k));
}`;

export interface WeatherLayerOpts {
  /** Screen row of the horizon (where bolts end). */
  horizon: number;
  /** Mist band (layer y range) near the player plane. */
  mistBand: [number, number];
}

/** The world's weather layers, appended to a scene's own. */
export function weatherLayers(ctx: BuildCtx, o: WeatherLayerOpts): LayerDef[] {
  const { W, H, u } = ctx;
  const wide = ctx.panWidth(2.2);
  const L: WorldLayer[] = [];
  L.push({ kind: "glsl", name: "wx-flash", depth: Infinity, blend: "add", body: FLASH_BODY, pass: "back", bounds: { y0: 0, y1: o.horizon } } as WorldLayer);
  L.push({ kind: "glsl", name: "wx-bolt", depth: 60, fog: 0.2, body: BOLT_BODY, bounds: { y0: 0, y1: o.horizon + 1 } } as WorldLayer);
  L.push({ kind: "glsl", name: "wx-rain-far", depth: 9, fog: 0.35, body: rainBody({ cw: 5, len: 7 * u, speed: 260 * u, alpha: 0.4, dens: 0.55, seed: 11, shade: 0.35 }) } as WorldLayer);
  const m = mist({
    name: "wx-mist",
    depth: 2.2,
    y0: o.mistBand[0],
    y1: o.mistBand[1],
    sx: 120 * u,
    sy: 9 * u,
    drift: -8,
    evolve: 0.05,
    cover: 0.62,
    warp: 1.6,
    levels: 3,
    alpha: 0.72,
    edgeDither: 0.35,
    row: "wxmist",
    tone: 0.45,
    tonePerLevel: 0.15,
    tint: 0.55,
    lightGain: 1,
  }) as WorldLayer;
  m.wx = (w) => w.mist;
  void wide;
  L.push(m);
  L.push({ kind: "glsl", name: "wx-grade", depth: 1, worldBlend: "mul", body: GRADE_BODY, pass: "back", wx: (w) => (w.dark > 0.01 || w.flash > 0 ? 1 : 0) } as WorldLayer);
  L.push({ kind: "glsl", name: "wx-rain-near", depth: 0.8, pass: "front", body: rainBody({ cw: 11, len: 16 * u, speed: 520 * u, alpha: 0.55, dens: 0.5, seed: 29, shade: 0.55 }) } as WorldLayer);
  void W;
  void H;
  return L;
}

/** A scene with the world's weather added: its ramps and layers. The grade and rain sit after the scene's own back layers. */
export function withWeather(def: SceneDef, o: (ctx: BuildCtx) => WeatherLayerOpts): SceneDef {
  return {
    ...def,
    palette: { ...WX_RAMPS, ...def.palette },
    build: (ctx) => {
      const out = def.build(ctx);
      const wx = weatherLayers(ctx, o(ctx));
      const skyAt = Math.max(0, out.findIndex((l) => l.name === "sky"));
      const figAt = (): number => {
        const i = out.findIndex((l) => l.kind === "character");
        return i < 0 ? out.length : i;
      };
      for (const l of wx) {
        const w = l as WorldLayer;
        if (w.name === "wx-flash") out.splice(skyAt + 1, 0, l);
        else if (w.name === "wx-grade") out.splice(figAt(), 0, l);
        else if (w.pass === "front") out.splice(Math.min(out.length, figAt() + 1), 0, l);
        else {
          // painter's order behind the player plane: before the first scene layer nearer than it
          const f = figAt();
          const at = out.findIndex((x, i) => i > skyAt && i < f && Number.isFinite(x.depth) && x.depth < l.depth && x.depth >= 1 && !(x.kind === "glsl" && x.usesReflection));
          out.splice(at < 0 ? f : at, 0, l);
        }
      }
      return out;
    },
  };
}

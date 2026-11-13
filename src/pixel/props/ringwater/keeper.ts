// The keeper (WORLD-PLAN section 2): the one resident who speaks, twice in the
// whole round. At the lodge she stands behind the registry counter over her
// ledger (working); the bell or E makes her look up (acknowledging). E on her
// the first time gets her first line, once per save (`greeted` is persisted;
// the host mirrors it as keeper:greeted). After the round she is away from
// the lodge and sits on the bench at Pier's End with two cups, one set down
// beside her; sit with her (or E) and she says her second line.
//
// pose "lodge": working / acknowledging / speaking / away
// pose "pier":  absent (until the evening after the round) / sitting / speaking
//
// She is drawn in cells like every prop (stand-in scale, 0.95 H, muted so the
// player stays the brightest thing), never breaks and ignores hits except for
// a start. Her words are the plan's, in the 3x5 font, lit by nothing (a small
// dark card above her head). Origin: her feet (lodge) or the bench seat's
// middle at floor level (pier).

import "./materials.ts";
import { textPixels } from "../../materials.ts";
import { defineRecipe, type Prop } from "../../prop.ts";
import type { Part } from "../../part.ts";

export interface KeeperParams {
  pose: "lodge" | "pier";
  /** Her two lines (WORLD-PLAN section 2). */
  first: string;
  second: string;
}

interface Refs {
  body: Part;
  head: Part;
  arm: Part;
  cup: Part | null;
  speech: Part;
  pier: boolean;
  /** Sat-beside timer and whether the second line was said this visit. */
  near: number;
  said: boolean;
}

const LINES = { first: "Storm took the lamps again.", second: "There they go." };

export const keeper = defineRecipe<KeeperParams, Refs>({
  id: "keeper",
  breakage: "never",
  reason: "The keeper tends the dock's lamp and the lodge's counter; she is the one person who speaks, twice, and the round ends with her and two cups at Pier's End.",
  defaults: { pose: "lodge", first: LINES.first, second: LINES.second },
  use: { reach: 0.7, prompt: "" },
  persist: ["greeted"],
  cues: ["keeper.look", "keeper.speak"],
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const pier = p.pose === "pier";
    const Ht = u(0.92);
    const W = u(0.5);
    const cx = W >> 1;
    const seatH = 0.28;
    /** Grid row of a height above her feet (in H). */
    const Y = (h: number): number => Ht - u(h);
    const face = pier ? 1 : -1;
    /** Grid column of an x offset in H, toward where she faces. */
    const X = (d: number): number => cx + Math.round(face * u(d));
    // the body: an A-line skirt with an apron (standing), or a lap and shins (seated); a
    // bodice with sloped shoulders; the shawl over them, longer at her back
    const body = b.part("body", { w: W, h: Ht, pivot: [cx, Ht], at: [0, 0], layer: pier ? "mid" : "bg", z: pier ? 8 : 5 });
    const waist = 0.56;
    if (pier) {
      // seated: hips on the seat, the lap forward, shins down to the floor, feet together
      body.poly([X(-0.1), Y(seatH + 0.02), X(0.2), Y(seatH + 0.02), X(0.22), Y(seatH - 0.06), X(-0.12), Y(seatH - 0.04)], { mat: "ringDress", profile: "dome", r: 4, piece: "lap" });
      body.poly([X(0.13), Y(seatH - 0.02), X(0.22), Y(seatH - 0.02), X(0.2), Y(0.04), X(0.12), Y(0.04)], { mat: "ringDress", profile: "cylV", r: 3, piece: "shins" });
      body.roundRect(Math.min(X(0.1), X(0.25)), Y(0.035), u(0.15), u(0.035), 1, { mat: "leatherDark", profile: "bevel", r: 1, piece: "shoes" });
    } else {
      body.poly([X(-0.1), Y(waist), X(0.1), Y(waist), X(0.16), Y(0.05), X(-0.15), Y(0.04)], { mat: "ringDress", profile: "dome", r: 6, piece: "skirt" });
      // folds down the skirt
      for (const d of [-0.05, 0.04]) body.line(X(d), Y(waist - 0.08), X(d * 1.5), Y(0.07), { mat: "ringDress", mode: "paint", tone: -1 });
      body.poly([X(0.02), Y(waist - 0.01), X(0.11), Y(waist - 0.01), X(0.15), Y(0.12), X(0.03), Y(0.1)], { mat: "ringApron", profile: "bevel", r: 3, z: 1, piece: "apron" });
      body.roundRect(Math.min(X(-0.1), X(0.14)), Y(0.035), u(0.24), u(0.035), 1, { mat: "leatherDark", profile: "bevel", r: 1, piece: "shoes" });
    }
    const w0 = pier ? seatH + 0.04 : waist;
    // the bodice: narrow at the waist, a little stooped, sloped shoulders
    body.poly([X(-0.08), Y(w0), X(0.08), Y(w0), X(0.1), Y(w0 + 0.12), X(0.07), Y(w0 + 0.21), X(-0.02), Y(w0 + 0.235), X(-0.1), Y(w0 + 0.2), X(-0.11), Y(w0 + 0.1)], { mat: "ringDress", profile: "dome", r: 5, piece: "bodice" });
    body.rect(Math.min(X(-0.09), X(0.09)), Y(w0) - 1, u(0.18), 2, { mat: "ringApron", profile: "cylH", z: 2, piece: "tie" });
    // the shawl: over both shoulders, a long point down her back, fringed
    body.poly([X(0.08), Y(w0 + 0.22), X(-0.03), Y(w0 + 0.25), X(-0.12), Y(w0 + 0.19), X(-0.13), Y(w0 + 0.02), X(-0.07), Y(w0 + 0.08), X(0.06), Y(w0 + 0.12)], { mat: "ringShawl", profile: "dome", r: 5, z: 3, piece: "shawl" });
    for (let k = 0; k < 4; k++) body.pixels([[X(-0.13) + face * k * 2, Y(w0 + 0.02) + 1 + (k & 1)]], { mat: "ringShawl", z: 3, tone: -1 });
    body.speckle({ amount: 0.06, seed: p.seed, tone: -1, mats: ["ringDress", "ringShawl"] });
    // the neck
    body.rect(X(0.0) - 2, Y(w0 + 0.27), 4, u(0.04), { mat: "ringSkin", profile: "cylV", z: 1, piece: "neck" });
    // the head: grey hair pinned in a bun, a quiet face turned down to the ledger (or out over the water)
    const hw = u(0.22), hh = u(0.2);
    const hb = b.part("head", { w: hw, h: hh, pivot: [hw >> 1, hh - 1], parent: "body", at: [cx, Y(w0 + 0.255)], layer: pier ? "mid" : "bg", z: pier ? 9 : 6, smoothRotate: true });
    const hx = (hw >> 1) + Math.round(face * u(0.01));
    const hy = hh - u(0.085);
    hb.ellipse(hx, hy, u(0.068), u(0.078), { mat: "ringSkin", profile: "dome", r: 4, piece: "face" });
    // hair: over the crown and down the back of the head, swept back from the face
    hb.poly([hx + face * u(0.05), hy - u(0.06), hx + face * u(0.02), hy - u(0.085), hx - face * u(0.05), hy - u(0.08), hx - face * u(0.08), hy - u(0.02), hx - face * u(0.06), hy + u(0.05), hx - face * u(0.02), hy + u(0.02), hx + face * u(0.01), hy - u(0.04)], { mat: "ringHairGrey", profile: "dome", r: 4, z: 1, piece: "hair" });
    hb.circle(hx - face * u(0.075), hy - u(0.065), u(0.04), { mat: "ringHairGrey", profile: "dome", r: 3, z: 2, piece: "bun" });
    hb.line(hx - face * u(0.1), hy - u(0.1), hx - face * u(0.05), hy - u(0.04), { mat: "brass", z: 3, piece: "pin" });
    // an eye, a brow, the ear under the hair, a nose's edge
    hb.rect(hx + face * u(0.035), hy - 1, 1, 2, { mat: "ringInk", z: 3, piece: "eye" });
    hb.rect(hx + face * u(0.03) - (face < 0 ? 1 : 0), hy - 3, 2, 1, { mat: "ringHairGrey", z: 3, piece: "brow" });
    hb.pixels([[hx + face * u(0.068), hy + 1]], { mat: "ringSkin", z: 2, tone: 1 });
    hb.rect(hx - face * u(0.01), hy, 2, 2, { mat: "ringSkin", z: 2, tone: -1, piece: "ear" });
    // the working arm: forearm forward over the ledger with a pen (lodge), or holding her cup (pier)
    const aw = u(0.22), ah = u(0.1);
    const ab = b.part("arm", { w: aw, h: ah, pivot: [3, 3], parent: "body", at: [X(0.02), Y(w0 + 0.19)], layer: pier ? "mid" : "bg", z: pier ? 10 : 7, smoothRotate: true });
    ab.stroke([3, 3, 5, u(0.08), u(0.1), u(0.09)], [u(0.055), u(0.05), u(0.045)], { mat: "ringDress", profile: "cylV", piece: "sleeve" });
    ab.ellipse(u(0.13), u(0.085), u(0.028), u(0.024), { mat: "ringSkin", profile: "dome", r: 2, z: 1, piece: "hand" });
    if (!pier) ab.line(u(0.15), u(0.06), u(0.17), u(0.1), { mat: "ringInk", z: 2, piece: "pen" });
    if (face < 0) b.get("arm").flip = -1;
    // the cup in her hand (pier)
    let cup: Part | null = null;
    if (pier) {
      const cw = u(0.08), ch = u(0.08);
      const cb = b.part("cup", { w: cw + 3, h: ch, pivot: [cw >> 1, ch], parent: "arm", at: [u(0.13), u(0.08)], layer: "mid", z: 11 });
      cb.roundRect(0, 0, cw, ch, 2, { mat: "ringGlaze", profile: "cylV", piece: "cup" });
      cb.rect(0, Math.round(ch * 0.35), cw, 2, { mat: "ringGlazeBlue", mode: "paint" });
      cb.ring(cw + 1, ch >> 1, 1, 2.4, { mat: "ringGlaze", flat: 1, piece: "handle" });
      cup = b.get("cup");
    }
    // her line, on a small dark card above her head (hidden until she speaks)
    const line = (pier ? p.second : p.first).toUpperCase();
    const s = 2;
    const { pts, w: tw } = textPixels(line);
    const pad = 4;
    const SW = tw * s + pad * 2, SH = 5 * s + pad * 2;
    const sb = b.part("speech", { w: SW, h: SH + 3, pivot: [SW >> 1, SH + 3], parent: "body", at: [cx, Y(0.95) - u(0.42)], layer: "fg", parallax: 1, z: 20, lit: 0, outline: 0, hittable: false, visible: false });
    sb.rect(1, 0, SW - 2, SH, { mat: "ringSpeechBack", profile: "flat", noInk: true });
    sb.rect(0, 1, SW, SH - 2, { mat: "ringSpeechBack", profile: "flat", noInk: true });
    sb.rect((SW >> 1) - 2, SH, 4, 1, { mat: "ringSpeechBack", profile: "flat", noInk: true });
    sb.rect((SW >> 1) - 1, SH + 1, 2, 1, { mat: "ringSpeechBack", profile: "flat", noInk: true });
    for (const [x, y] of pts) sb.rect(pad + x * s, pad + y * s, s, s, { mat: "ringSpeech", profile: "flat", z: 1, noInk: true });
    return { body: b.get("body"), head: b.get("head"), arm: b.get("arm"), cup, speech: b.get("speech"), pier, near: 0, said: false };
  },
  initial: (c) => (c.params["pose"] === "pier" ? "absent" : "working"),
  states: {
    working: {
      enter: (c) => show(c, true),
      update(c) {
        // writing: the pen hand moves in small steps, the head bowed over the ledger
        const k = Math.floor(c.world.time * 2.2 + c.params.seed) % 6;
        c.refs.arm.offX = k < 3 ? k - 1 : 0;
        c.refs.arm.offY = k === 4 ? 1 : 0;
        c.refs.head.rot = 0.12;
      },
      use: (c) => (c.data["greeted"] ? "acknowledging" : "speaking"),
      hit: (c) => {
        c.refs.head.rot = -0.1;
        return "acknowledging";
      },
    },
    acknowledging: {
      sound: "keeper.look",
      enter: (c) => {
        c.refs.head.rot = -0.08;
        c.refs.arm.offX = 0;
      },
      use: (c) => (c.data["greeted"] ? undefined : "speaking"),
      after: [2.6, "working"],
      hit: () => undefined,
    },
    speaking: {
      sound: "keeper.speak",
      enter(c) {
        c.refs.speech.visible = true;
        c.refs.head.rot = c.refs.pier ? 0.05 : -0.08;
        if (c.refs.pier) c.refs.said = true;
        else c.data["greeted"] = true;
      },
      exit(c) {
        c.refs.speech.visible = false;
      },
      update(c) {
        // the card rises a pixel as it appears, then holds; then back to her ledger (or the bench)
        c.refs.speech.offY = c.t < 0.15 ? 1 : 0;
        if (c.t > 4.5) c.go(c.refs.pier ? "sitting" : "working");
      },
      hit: () => undefined,
    },
    away: {
      enter: (c) => show(c, false),
      hit: () => undefined,
    },
    absent: {
      enter: (c) => show(c, false),
      hit: () => undefined,
    },
    sitting: {
      enter: (c) => show(c, true),
      update(c, dt) {
        const r = c.refs;
        // she drinks now and then: the cup comes up, then down
        const k = (c.world.time + c.params.seed) % 9;
        r.arm.rot = k > 7.4 && k < 8.4 ? -0.5 : 0;
        r.head.rot = k > 7.4 && k < 8.4 ? -0.1 : 0.04;
        // sit with her a moment and she says her second line (once a visit)
        if (!r.said) {
          const near = c.world.actorsNear(c.x, c.y, c.params.H * 1.1, c.params.H * 0.6).some((a) => Math.abs(a.vx) < 1);
          r.near = near ? r.near + dt : 0;
          if (r.near > 1.5) c.go("speaking");
        }
      },
      use: () => "speaking",
      hit: () => undefined,
    },
  },
  demo: {
    w: 5,
    indoor: true,
    variants: [{ label: "at Pier's End after the round", params: { pose: "pier" }, dx: 2.2 }],
    script: [
      { label: "working at the ledger", wait: 1.4 },
      { label: "E: her first line, once", use: true, wait: 4.8 },
      { label: "E again: she only looks up", use: true, wait: 2.8 },
      { label: "pier: sitting with two cups", variant: "at Pier's End after the round", go: "sitting", wait: 1.6 },
      { label: "pier: her second line", variant: "at Pier's End after the round", use: true, wait: 4.8 },
    ],
  },
});

function show(c: Prop<Refs>, on: boolean): void {
  for (const p of c.parts) if (p.name !== "speech") p.visible = on;
  c.refs.speech.visible = false;
}

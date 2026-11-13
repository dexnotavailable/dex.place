// Broken armour (lane R-D): plates from wardens that fell here before, left
// lying on the spire's catwalks and the arena floor: a helm with its visor
// slit, a curved pauldron, a greave. They tell what the Crown is for without a
// word. A hit or a dash through them knocks them rattling along the deck;
// they hop, skid and stay where they land (inside `slide`, so they never go
// over an edge). Nothing breaks (dents mend). Origin: the pile's centre on
// the deck.

import "./materials.ts";
import { puff } from "../../kit.ts";
import { defineRecipe, type Prop } from "../../prop.ts";
import type { Part } from "../../part.ts";

export interface ArmourParams {
  /** Which pieces lie here (a subset of helm, pauldron, greave). */
  pieces: ("helm" | "pauldron" | "greave")[];
  /** How far (H) the pieces may skid either way from where they lie. */
  slide: [number, number];
}

interface Piece {
  part: Part;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  rest: number;
}

interface Refs {
  pieces: Piece[];
  moving: boolean;
}

export const brokenArmour = defineRecipe<ArmourParams, Refs>({
  id: "brokenArmour",
  breakage: "never",
  reason: "Plates from wardens that were fought here before: they say what the Crown is for without a word, and they rattle and skid when you hit or dash through them.",
  defaults: { pieces: ["helm", "pauldron", "greave"], slide: [-2, 2] },
  cues: ["armour.rattle", "armour.land"],
  demo: {
    w: 7,
    script: [
      { label: "lying where they fell", wait: 0.6 },
      { label: "slash: they skid and rattle", hit: "slash", from: -0.9, wait: 1.6 },
      { label: "dash through: scattered further", hit: "wind", from: -1.2, wait: 1.6 },
      { label: "Q: they hop and land somewhere new (they stay)", hit: "q", from: 0.4, wait: 2.4 },
    ],
  },
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const pieces: Piece[] = [];
    let x = -u(0.45);
    for (const kind of p.pieces) {
      if (kind === "helm") {
        const w = u(0.36), h = u(0.26);
        const hp = b.part("helm", { w, h, pivot: [w >> 1, h], at: [x, 0], layer: "mid", z: 6, smoothRotate: true });
        hp.ellipse(w / 2, h * 0.62, w / 2 - 1, h * 0.6, { mat: "wardenPlate", profile: "dome", r: 5 });
        hp.rect(0, h - 3, w, 3, { mat: "wardenPlate", mode: "erase" });
        hp.rect(w * 0.22, h * 0.48, w * 0.5, 2, { mat: "soot", profile: "sunk", r: 1, depth: 2, z: 3, piece: "visor", noInk: true });
        hp.rect(w / 2 - 1, 2, 2, h * 0.4, { mat: "wardenPlate", profile: "cylV", z: 3, piece: "crest", tone: 1 });
        hp.rivets([[3, h - 5], [w - 4, h - 5]], { mat: "bronze", r: 1 });
        pieces.push({ part: b.get("helm"), x, y: 0, vx: 0, vy: 0, rot: -0.2, vr: 0, rest: 0 });
        x += u(0.45);
      } else if (kind === "pauldron") {
        const w = u(0.44), h = u(0.18);
        const pp = b.part("pauldron", { w, h, pivot: [w >> 1, h], at: [x, 0], layer: "mid", z: 5, smoothRotate: true });
        for (let k = 0; k < 3; k++) pp.ellipse(w / 2, h - 1 - k * 3, w / 2 - 1 - k * 3, h * 0.9 - k * 3, { mat: "wardenPlate", profile: "dome", r: 4, z: k, piece: `lame${k}`, tone: k === 2 ? 1 : 0 });
        pp.rect(0, h - 2, w, 2, { mat: "wardenPlate", mode: "erase" });
        pp.rivets([[4, h - 4], [w - 5, h - 4], [w >> 1, h - 8]], { mat: "bronze", r: 1 });
        pieces.push({ part: b.get("pauldron"), x, y: 0, vx: 0, vy: 0, rot: 0.1, vr: 0, rest: 0 });
        x += u(0.5);
      } else {
        const w = u(0.56), h = u(0.12);
        const gp = b.part("greave", { w, h, pivot: [w >> 1, h], at: [x, 0], layer: "mid", z: 4, smoothRotate: true });
        gp.poly([0, h - 1, w, h - 1, w - 3, 2, u(0.12), 0, 3, 2], { mat: "wardenPlate", profile: "bevel", r: 3, depth: 4 });
        gp.rect(u(0.1), 3, w - u(0.2), 1, { mat: "wardenPlate", mode: "paint", tone: 1 });
        gp.rect(w - u(0.18), 2, 2, h - 3, { mat: "soot", mode: "paint" });
        pieces.push({ part: b.get("greave"), x, y: 0, vx: 0, vy: 0, rot: 0, vr: 0, rest: 0 });
        x += u(0.6);
      }
    }
    for (const q of pieces) {
      q.part.rot = q.rot;
      q.part.tag["heal"] = true;
    }
    return { pieces, moving: false };
  },
  initial: "still",
  states: {
    still: {
      hit: (c, h) => knock(c, h.hit),
    },
    skidding: {
      update(c, dt) {
        const H = c.params.H;
        const g = H * 17.5;
        const [lo, hi] = (c.params["slide"] as [number, number]) ?? [-2, 2];
        let any = false;
        for (const q of c.refs.pieces) {
          if (q.rest > 0.3) continue;
          any = true;
          q.vy += g * dt;
          q.x += q.vx * dt;
          q.y += q.vy * dt;
          q.rot += q.vr * dt;
          const home = q.part.x;
          const minX = lo * H - home, maxX = hi * H - home;
          if (q.x < minX) { q.x = minX; q.vx = Math.abs(q.vx) * 0.3; }
          if (q.x > maxX) { q.x = maxX; q.vx = -Math.abs(q.vx) * 0.3; }
          if (q.y >= 0) {
            if (q.vy > H * 0.8) {
              c.sound("armour.rattle", Math.min(1, q.vy / (H * 4)));
              puff(c.world, "spark", c.x + home + q.x, c.y - 1, 3, [0, -1], { speed: 0.5 });
            }
            q.y = 0;
            q.vy = -q.vy * 0.28;
            if (Math.abs(q.vy) < H * 0.3) q.vy = 0;
            q.vx *= Math.pow(0.02, dt);
            // settle flat: the nearest quarter turn a plate can lie on
            const flat = Math.round(q.rot / Math.PI) * Math.PI;
            q.vr = (flat - q.rot) * 6;
          } else q.vr *= Math.pow(0.4, dt);
          if (q.y === 0 && Math.abs(q.vx) < H * 0.05 && Math.abs(q.vy) < 1) q.rest += dt;
          else q.rest = 0;
          q.part.offX = Math.round(q.x);
          q.part.offY = Math.round(q.y);
          q.part.rot = q.rot;
        }
        if (!any) {
          c.sound("armour.land", 0.4);
          c.go("still");
          return;
        }
      },
      hit: (c, h) => knock(c, h.hit),
    },
  },
});

function knock(c: Prop<Refs>, hit: import("../../hits.ts").Hit): string {
  const H = c.params.H;
  const f = hit.type === "wind" ? 1.2 : hit.type === "slash" || hit.type === "point" ? 1.6 : hit.type === "heavy" ? 2.6 : 3.2;
  const lift = hit.type === "q" || hit.type === "r" ? 3.2 : hit.type === "heavy" ? 1.8 : 0.9;
  for (const q of c.refs.pieces) {
    const k = 0.6 + c.rand() * 0.8;
    q.vx += hit.dir[0] * H * f * k;
    q.vy = Math.min(q.vy, -H * lift * (0.5 + c.rand() * 0.5));
    q.vr += (c.rand() - 0.5) * 12;
    q.rest = 0;
  }
  if (hit.type !== "wind") {
    c.damage(hit);
    c.sound("armour.rattle", 0.8);
  }
  return "skidding";
}

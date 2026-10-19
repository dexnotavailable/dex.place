// The Prize Court's bouts (GDK 5.1): download = bout. The board's panel picks a prize, Bao
// strikes the gong, the champion poofs in (3 s or less), the bout runs, and the champion's
// HP never drops below a sliver except by the visitor's own last press, which starts the
// download inside that very input event (main.ts calls finishPress() from the handler),
// then the hit plays, the champion bows its own bow and poofs out, and a note settles.
//
// One template for every champion: HP and the sliver, the stagger and the finish glint, the
// download handler, the poof in and out, the bow slot and the note. A product authors only
// its look, its entrance, one trademark move and its bow (the ChampionDef below). Nobody
// dies here and she cannot lose: a champion's hit never takes her last point.

import type { HitBox } from "../lab/contracts.ts";
import type { Vfx } from "../lab/engine/vfx.ts";
import { overlap, type WorldBox } from "../lab/game/events.ts";
import type { Zhusha as Player, ZHit } from "./zhusha/controller.ts";
import { downloads, type DownloadEntry, type DownloadFile } from "../site/data/downloads.ts";
import { H } from "./config.ts";
import { gongFrame } from "./art/library/hall/index.ts";
import { BAO_X, GONG_X, LION_X, RING_X0, RING_X1 } from "./world/sections/court.ts";
import type { SpriteDef } from "./world/types.ts";

/** What a bout wins: the product picked on the board and the file its download is. */
export interface Prize {
  /** The plaque picked (dexCode's plaque installs through dexClient). */
  picked: DownloadEntry;
  /** The entry that owns the file (the same, or the one it installs through). */
  owner: DownloadEntry;
  file: DownloadFile;
}

/** The prize for a board plaque, or null when nothing real can be downloaded for it. */
export function prizeFor(id: string): Prize | null {
  const picked = downloads.find((d) => d.id === id);
  if (!picked) return null;
  const owner = picked.file ? picked : downloads.find((d) => d.id === picked.installedBy);
  if (!owner?.file) return null;
  return { picked, owner, file: owner.file };
}

/** A champion's own four pieces (and its numbers); everything else is the template's. */
interface ChampionDef {
  /** The product whose file it guards. */
  product: string;
  kind: string;
  hp: number;
  /** Body box relative to its feet, facing right (px). */
  body: { x: number; y: number; w: number; h: number };
  /** Half its length along the floor (keeps it inside the ring). */
  half: number;
  frames: { idle: [number, number]; blink: number; windup: number; move: number; flinch: number; stagger: number; bow: number; out: number };
  /** Where the glint sits over a staggered champion (facing right). */
  glint: [number, number];
}

/** dexClient's champion: a lion-dance Lion (a proposal). Entrance: it installs itself. Move: the Update Pounce. */
const LION: ChampionDef = {
  product: "dexclient",
  kind: "lion",
  hp: 120,
  body: { x: -170, y: -165, w: 345, h: 165 },
  half: 1.9 * H,
  frames: { idle: [0, 1], blink: 2, windup: 3, move: 4, flinch: 5, stagger: 6, bow: 7, out: 8 },
  glint: [1.15 * H, -1.85 * H],
};

export interface CourtHost {
  readonly player: Player;
  readonly vfx: Vfx;
  readonly feel: { freeze(ticks: number): void; sound(id: string, volume?: number): void };
  readonly camera: { shake(amplitude: number, duration: number): void };
  sprite(id: string): SpriteDef;
  setFlag(f: string, on?: boolean): void;
  /** Holds her controls for a number of ticks (the summoning's short cut). */
  freeze(ticks: number): void;
  /** The music's cues (piece 6 wires them to the stems). */
  cue(name: string): void;
  /** The note after the bow: "it's in your downloads". */
  celebrate(prize: Prize): void;
}

type State = "idle" | "gong" | "entrance" | "fight" | "stagger" | "finish" | "bow" | "out";

const SLIVER = 0.05;

export class Court {
  state: State = "idle";
  private t = 0;
  private def: ChampionDef = LION;
  private prize: Prize | null = null;
  hp = 0;
  /** The champion's feet, its facing (1 right), a hop's height. */
  private x = LION_X;
  private y = 0;
  private facing = -1;
  private ai = { phase: "walk" as "walk" | "windup" | "leap", t: 0, next: 80, from: 0, to: 0, hitHer: false };
  private flinch = 0;
  private white = 0;
  private cheer = 0;
  /** Ticks since Bao last struck the gong (null: the gong hangs still). */
  private struck: number | null = null;
  private hits = 0;

  private host: CourtHost;

  constructor(host: CourtHost) {
    this.host = host;
    this.y = host.sprite("champion").y;
  }

  /** A bout is on (the camera holds on the court, the board waits). */
  get busy(): boolean {
    return this.state !== "idle";
  }

  /** R is greyed out while the champion is staggered: the finish is one quick hit. */
  get ultLocked(): boolean {
    return this.state === "stagger" || this.state === "finish";
  }

  /** The board's pick: Bao strikes the gong and the champion comes out. */
  summon(prize: Prize): void {
    if (this.busy) return;
    this.prize = prize;
    this.def = LION; // one champion today; Yuki (dexCode's) comes with her own def
    this.hp = this.def.hp;
    this.x = LION_X;
    this.facing = -1;
    this.ai = { phase: "walk", t: 0, next: 70, from: 0, to: 0, hitHer: false };
    this.hits = 0;
    this.go("gong");
    this.host.setFlag("bout", true);
    // her R is full at the start of every bout
    this.host.player.ultCd = 0;
    this.host.freeze(30);
  }

  /** She left (through the door): the champion bows out at once, nothing is downloaded. */
  cancel(): void {
    if (!this.busy) return;
    this.hide();
    this.go("idle");
    this.host.setFlag("bout", false);
  }

  /**
   * The killing blow. Call this from the attack input's own event handler (J, Z, a click,
   * the attack button's release, Q or E): when the champion is staggered it returns the
   * file to download, and the caller starts that download right there, synchronously.
   */
  finishPress(): Prize | null {
    if (this.state !== "stagger" || !this.prize) return null;
    this.go("finish");
    return this.prize;
  }

  private go(s: State): void {
    this.state = s;
    this.t = 0;
  }

  private hide(): void {
    for (const id of ["champion", "install-bar", "glint", "champion-hp"]) this.host.sprite(id).hidden = true;
  }

  private bodyBox(): WorldBox {
    const b = this.def.body;
    const x = this.facing > 0 ? this.x + b.x : this.x - (b.x + b.w);
    return { x, y: this.y - this.hopY() + b.y, w: b.w, h: b.h };
  }

  private hopY(): number {
    if (this.ai.phase !== "leap" || this.state !== "fight") return 0;
    const u = Math.min(1, this.ai.t / 36);
    return Math.sin(u * Math.PI) * 1.3 * H;
  }

  /** One 60 Hz simulation tick (after her own update). */
  tick(): void {
    this.t++;
    // the gong swings on each strike and settles (env-hall's gong: gongFrame, 12 frames)
    if (this.struck !== null) {
      this.struck++;
      const f = gongFrame(this.struck);
      this.host.sprite("gong").frame = f;
      if (f === 0) this.struck = null;
    }
    const p = this.host.player;
    const s = this.state;
    if (s === "gong") this.tickGong();
    else if (s === "entrance") this.tickEntrance();
    else if (s === "fight") this.tickFight(p);
    else if (s === "stagger") this.tickStagger();
    else if (s === "finish") this.tickFinish();
    else if (s === "bow") {
      if (this.t >= 66) {
        this.go("out");
        this.host.cue("music:resolve");
      }
    } else if (s === "out") {
      if (this.t >= 84) {
        const c = this.center();
        this.host.vfx.spawn("burst.big", { x: c[0], y: c[1], facing: 1 });
        this.host.vfx.spawn("feathers", { x: c[0], y: c[1], facing: 1 });
        this.host.feel.sound("poof");
        this.hide();
        this.host.setFlag(`won-${this.prize!.picked.id}`, true);
        this.host.setFlag("bout", false);
        const prize = this.prize!;
        this.go("idle");
        this.host.celebrate(prize);
      }
    }
    this.pose(p);
  }

  private center(): [number, number] {
    return [this.x, this.y - 0.9 * H];
  }

  private tickGong(): void {
    if (this.t === 14) {
      // the strike: the gong booms, the court shakes a little, the arena theme swells in
      this.host.camera.shake(4, 16);
      this.host.vfx.spawn("ring.wide", { x: GONG_X, y: this.y - 1.45 * H, facing: 1 });
      this.host.feel.sound("gong");
      this.host.cue("music:arena");
      this.struck = 0;
      this.host.sprite("gong").frame = gongFrame(0);
    }
    if (this.t >= 30) {
      // the poof: paper scraps, ink and sparks, and the champion starts to install itself
      const c = this.center();
      this.host.vfx.spawn("burst.big", { x: c[0], y: c[1], facing: 1 });
      this.host.vfx.spawn("feathers", { x: c[0], y: c[1], facing: 1 });
      this.host.vfx.spawn("smoke.dark", { x: c[0], y: c[1], facing: 1 });
      this.host.vfx.spawn("embers.gold", { x: c[0], y: c[1], facing: 1 });
      this.host.feel.sound("poof");
      this.go("entrance");
      this.cheer = 140;
    }
  }

  private tickEntrance(): void {
    // the install bar sweeps the floor and the lion assembles along it, 0 to 100% (1.7 s)
    const span = 100;
    const k = Math.min(1, this.t / span);
    const champ = this.host.sprite("champion");
    champ.hidden = false;
    champ.reveal = k;
    const bar = this.host.sprite("install-bar");
    bar.hidden = this.t > span + 12;
    bar.frame = Math.min(10, Math.floor(k * 10 + 0.001));
    if (this.t === span) this.host.feel.sound("installed");
    if (this.t >= span + 16) {
      champ.reveal = 1;
      bar.hidden = true;
      this.host.sprite("champion-hp").hidden = false;
      this.go("fight");
      this.ai.next = 60;
    }
  }

  private tickFight(p: Player): void {
    const b = p.body;
    const def = this.def;
    const lo = RING_X0 + def.half, hi = RING_X1 - def.half;
    const ai = this.ai;
    ai.t++;
    if (ai.phase === "walk") {
      this.facing = b.x < this.x ? -1 : 1;
      // a lion-dance shuffle to a respectful distance
      const want = b.x - this.facing * 3.3 * H;
      const d = want - this.x;
      if (Math.abs(d) > 8) this.x += Math.sign(d) * Math.min(Math.abs(d), 1.1);
      if (ai.t >= ai.next) {
        ai.phase = "windup";
        ai.t = 0;
        this.host.vfx.spawn("ring.small", { x: this.x + this.facing * 1.2 * H, y: this.y, facing: this.facing });
        this.host.feel.sound("lion-windup");
      }
    } else if (ai.phase === "windup") {
      // the Update Pounce's tell: it rears up, mouth wide
      if (ai.t >= 34) {
        ai.phase = "leap";
        ai.t = 0;
        ai.from = this.x;
        ai.to = Math.min(hi, Math.max(lo, b.x - this.facing * 0.6 * H));
        ai.hitHer = false;
      }
    } else {
      const u = Math.min(1, ai.t / 36);
      this.x = ai.from + (ai.to - ai.from) * (u * u * (3 - 2 * u));
      if (!ai.hitHer && p.dead === 0) {
        const box = this.bodyBox();
        if (p.hurtboxes().some((hb) => overlap(hb, box))) {
          ai.hitHer = true;
          // she cannot lose: a champion never takes her last point
          p.hit(p.hp > 1 ? 1 : 0, this.facing, [4.5, -5]);
        }
      }
      if (ai.t >= 36) {
        ai.phase = "walk";
        ai.t = 0;
        ai.next = 100 + Math.floor(Math.random() * 60);
        this.host.vfx.spawn("dust.land", { x: this.x, y: this.y, facing: 1 });
        this.host.vfx.spawn("ring.dust", { x: this.x, y: this.y, facing: 1 });
        this.host.camera.shake(3, 10);
        this.host.feel.sound("lion-land");
      }
    }
    this.x = Math.min(hi, Math.max(lo, this.x));
    this.takeHits(p);
  }

  /** Her hits on the champion: each hitbox group once per swing; nothing but her press finishes it. */
  private takeHits(p: Player): void {
    const hits = p.hitboxes();
    if (!hits.length) return;
    const box = this.bodyBox();
    for (const { box: hb, hb: h } of hits) {
      // a reach that only breaks props (damage 0) never touches the champion
      if (h.damage <= 0 && h.group !== "r") continue;
      // R's nuke covers the whole court (the seal stamps the ring), wherever the champion is
      const ov = h.group === "r" ? { x: box.x + box.w * 0.3, y: box.y + box.h * 0.3, w: box.w * 0.4, h: box.h * 0.4 } : overlap(hb, box);
      if (!ov) continue;
      const group = h.group ?? `f${p.clip.index}`;
      let set = p.clip.hitGroups.get(group);
      if (!set) p.clip.hitGroups.set(group, (set = new Set()));
      if (set.has(this)) continue;
      set.add(this);
      p.clip.hit = true;
      this.damage(h, p.facing);
      this.host.vfx.spawn(h.hitVfx ?? "hit.light", { x: ov.x + ov.w / 2, y: ov.y + ov.h / 2, facing: p.facing });
      if (h.shake) this.host.camera.shake(h.shake.amplitude, h.shake.duration);
      if (this.state !== "fight") return;
    }
  }

  private damage(h: HitBox, dir: number): void {
    const floor = Math.ceil(this.def.hp * SLIVER);
    // R's nuke gets it there in one press; every hit and effect stops at the sliver
    this.hp = h.group === "r" ? floor : Math.max(floor, this.hp - h.damage);
    this.hits++;
    this.white = 2;
    // heavier hits read heavier (Dex 10-19): a longer flinch, and it is shoved back by the blow's weight (the Q's and
    // the E's reach shove it hardest)
    const reach = !!(h as ZHit).brk?.reach;
    this.flinch = h.heavy || reach ? 16 : 10;
    this.cheer = Math.max(this.cheer, 30);
    this.host.feel.freeze(h.hitstop);
    if (this.ai.phase !== "leap") this.x += dir * Math.min(reach ? 40 : h.heavy ? 26 : 10, Math.abs(h.knockback[0]) * 2);
    if (this.hp <= floor) {
      this.go("stagger");
      this.ai.phase = "walk";
      const c = this.center();
      this.host.vfx.spawn("flash.gold", { x: c[0], y: c[1], facing: 1 });
      this.host.feel.freeze(10);
      this.host.feel.sound("stagger");
      this.host.cue("music:hush");
    }
  }

  private tickStagger(): void {
    // no timer: it sways on one knee and the glint pulses until she presses
  }

  private tickFinish(): void {
    if (this.t === 1) {
      // the hit plays after the download has started: a one-frame flash, an ink splash
      const c = this.center();
      this.white = 2;
      this.host.vfx.spawn("flash.big", { x: c[0], y: c[1], facing: 1 });
      this.host.vfx.spawn("burst.red", { x: c[0], y: c[1], facing: 1 });
      this.host.vfx.spawn("smoke.dark", { x: c[0], y: c[1], facing: 1 });
      this.host.feel.freeze(8);
      this.host.camera.shake(6, 16);
      this.host.feel.sound("finish");
      // the win: the crowd cheers on the killing blow (approved crowd cheer; the blow itself has no approved sound yet)
      this.host.feel.sound("cheer");
      this.cheer = 150;
    }
    if (this.t >= 26) this.go("bow");
  }

  /** Sets the sprites for this tick: Bao, the stands, the champion, its glint and HP. */
  private pose(p: Player): void {
    const s = this.state;
    const f = this.def.frames;
    const bao = this.host.sprite("bao");
    if (s === "gong") {
      bao.flip = false;
      bao.frame = this.t < 14 ? 2 : 3;
    } else {
      bao.flip = p.body.x < BAO_X;
      bao.frame = s === "stagger" ? 4 : Math.floor(this.t / 50) % 2;
    }
    const stands = this.host.sprite("stands");
    if (this.cheer > 0) this.cheer--;
    stands.frame = s === "stagger" ? 3 : this.cheer > 0 ? 2 : Math.floor(this.t / 40) % 2;

    const champ = this.host.sprite("champion");
    if (s === "idle" || s === "gong") return;
    champ.x = this.x;
    champ.flip = this.facing < 0;
    champ.white = this.white > 0 ? 1 : 0;
    if (this.white > 0) this.white--;
    let fr: number = f.idle[Math.floor(this.t / 14) % 2]!;
    if (s === "entrance") fr = this.t > 100 ? f.windup : f.idle[0];
    else if (s === "fight") {
      if (this.flinch > 0) { fr = f.flinch; this.flinch--; }
      else if (this.ai.phase === "windup") fr = f.windup;
      else if (this.ai.phase === "leap") fr = f.move;
      else if (this.t % 170 > 160) fr = f.blink;
    } else if (s === "stagger" || s === "finish") fr = f.stagger;
    else if (s === "bow") fr = f.bow;
    else if (s === "out") fr = f.out;
    champ.frame = fr;
    champ.y = this.y - this.hopY();
    const hp = this.host.sprite("champion-hp");
    hp.x = this.x;
    hp.hidden = s === "entrance" || s === "bow" || s === "out" || champ.hidden === true;
    hp.frame = s === "finish" ? 0 : Math.max(1, Math.round((this.hp / this.def.hp) * 20));
    const g = this.host.sprite("glint");
    g.hidden = s !== "stagger";
    g.x = this.x + (this.facing > 0 ? this.def.glint[0] : -this.def.glint[0]) * 0.55;
    g.y = this.y + this.def.glint[1];
    g.frame = Math.floor(this.t / 8) % 4;
  }

  /** Debug and tests. */
  state_(): { state: State; hp: number; x: number; hits: number } {
    return { state: this.state, hp: this.hp, x: Math.round(this.x), hits: this.hits };
  }
}

// The regions' main themes (AUDIO.md, "keep it simple": no stem layering). After the opening, the music fades
// to the main theme of the place she is in. A place with no approved theme keeps what it plays today: Track 1
// while it sounds, then the placeholder score. Each theme streams from its encoded pair (an <audio> element, so
// the take is never decoded whole in memory), loops (its ending plays in full), and is gain-matched to Track 1
// (-17.5 LUFS against Track 1's -17.6).
//
// Every theme here is Dex-approved: best or ok in lanes/audio/VETTING.json, by source name (audio.test.mjs checks
// it). Dex's notes on them, in his words: hall-A1 "good for the hall"; piano-take2 "very good for serene scenes";
// drums-take1 "works standalone, sounds insane, good for grand parts"; second-take1 "very good for scenes that are
// bustling but calm". The Prize Court's arena-A2 has no note on the full take (AUDIO.md names it the arena): Dex
// to confirm by ear. Places not in the table wait for Dex's pick (the lane notebook's FOR DEX list).

/** A place's main theme: the encoded pair under /audio/ and the approved take behind it. */
export interface RegionTheme {
  /** Under /audio/, without the extension: the browser plays the pair's .opus, or its .m4a where Opus is not played. */
  file: string;
  /** The take's source name (its VETTING.json key, by file name). */
  source: string;
}

/** Place id -> theme. */
export const REGION_THEMES: Record<string, RegionTheme> = {
  kagami: { file: "regions/piano-take2", source: "piano-take2-clip-a-2m48.wav" },
  "ink-palace": { file: "regions/drums-take1", source: "drums-take1-clip-a-2m46.wav" },
  "hall-of-works": { file: "regions/hall-A1", source: "hall-A1_41f2e16c.wav" },
  "prize-court": { file: "regions/arena-A2", source: "arena-A2_630a4f22.wav" },
  shiraito: { file: "regions/second-take1", source: "second-take1-clip-a-2m38.wav" },
};

/** The crossfade between themes, and into a theme from Track 1, in seconds. */
export const THEME_FADE = 4;

interface PlaceBox {
  id: string;
  x0: number;
  x1: number;
  y0?: number;
  y1?: number;
}

/**
 * The place at (x, y), or null. A place with a y band wins when the point is in its band (the interiors, the
 * terraces, the harbour under the court). An open place (no band) only counts above the interior band, and only
 * when no band fits: the Prize Court's column runs down over Hoai Pho's harbour, so the harbour must win there.
 */
export function placeAt(places: readonly PlaceBox[], x: number, y: number, interiorY: number): string | null {
  let open: string | null = null;
  for (const p of places) {
    if (x < p.x0 || x > p.x1) continue;
    if (p.y0 !== undefined || p.y1 !== undefined) {
      if ((p.y0 !== undefined && y < p.y0) || (p.y1 !== undefined && y > p.y1)) continue;
      return p.id;
    }
    if (y < interiorY) open ??= p.id;
  }
  return open;
}

interface Playing {
  el: HTMLAudioElement;
  src: MediaElementAudioSourceNode;
  fade: GainNode;
}

/**
 * Plays the region's theme. One theme sounds at a time; a new place's theme fades in as the old one fades out.
 * `update` is called every tick with the place (or null) and whether the opening's cinema holds the music.
 */
export class RegionMusic {
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  private ext = "opus";
  /** The theme sounding (fading in or on): the place that asked for it, its file, and its element. */
  private on: { id: string; file: string; play: Playing } | null = null;
  /** The last thing asked for ("hold", a place id, or ""): the theme changes only when it does. */
  private key: string | null = null;

  /** A theme is set (fading in or on): the placeholder score keeps quiet. */
  get sounding(): boolean {
    return this.on !== null;
  }

  /** The place whose theme is set (debug and tests), or null. */
  get playing(): string | null {
    return this.on?.id ?? null;
  }

  attach(ctx: AudioContext, dest: AudioNode, ext: string): void {
    this.ctx = ctx;
    this.ext = ext;
    this.out = ctx.createGain();
    this.out.connect(dest);
  }

  /** Once per tick. `hold` (the press waits, or the opening's cinema runs) keeps every theme off. */
  update(placeId: string | null, hold: boolean): void {
    if (!this.ctx) return;
    const key = hold ? "hold" : placeId ?? "";
    if (key === this.key) return;
    this.key = key;
    this.play(hold || !placeId ? null : REGION_THEMES[placeId] ?? null, key);
  }

  private play(theme: RegionTheme | null, id: string): void {
    const ctx = this.ctx!, out = this.out!;
    const now = ctx.currentTime;
    // another place with the same theme: it keeps playing, unbroken
    if (theme && this.on?.file === theme.file) {
      this.on.id = id;
      return;
    }
    if (this.on) {
      this.retire(this.on.play, now);
      this.on = null;
    }
    if (!theme) return;
    const el = new Audio();
    el.loop = true;
    el.preload = "auto";
    el.src = `/audio/${theme.file}.${this.ext}`;
    const src = ctx.createMediaElementSource(el);
    const fade = ctx.createGain();
    fade.gain.setValueAtTime(0, now);
    // the fade-in starts when the stream is really playing (a slow load must not arrive at full level)
    el.addEventListener("playing", () => {
      const t = ctx.currentTime;
      fade.gain.cancelScheduledValues(t);
      fade.gain.setValueAtTime(0, t);
      fade.gain.linearRampToValueAtTime(1, t + THEME_FADE);
    }, { once: true });
    src.connect(fade);
    fade.connect(out);
    this.on = { id, file: theme.file, play: { el, src, fade } };
    void el.play().catch(() => {});
  }

  /** Fades a theme out, then releases its element (the stream and its buffers go with it). */
  private retire(p: Playing, now: number): void {
    const g = p.fade.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(0, now + THEME_FADE);
    window.setTimeout(() => {
      p.el.pause();
      p.el.removeAttribute("src");
      p.el.load();
      p.src.disconnect();
      p.fade.disconnect();
    }, (THEME_FADE + 0.5) * 1000);
  }

  /** The themes' level (1 = as set), reached over `secs`: the court's hush ducks the arena theme. */
  duck(to: number, secs: number): void {
    const ctx = this.ctx, out = this.out;
    if (!ctx || !out) return;
    const g = out.gain, now = ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(to, now + secs);
  }
}

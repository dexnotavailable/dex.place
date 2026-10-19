// The hand-off into the game: today's opening, started from the one event the page column sends.
//
// The website's side (motion/column.ts) ends at `dex:enter` with which way the visitor came in
// ("continue" at the top, the corner ofuda, back up from the website, or the jetty at the bottom). This file
// is the opening's side of that seam (the opening director's): it plays the opening (src/tesu/opening/: the
// conductor, Track 1, the heard clock, the bars and the captions) in the game screen. Ways 1-3 play the fall from
// T 0 (the paper the press's gust took falls back down through the sky to her); way 4, which already drifted the
// ofuda into the jetty scene, starts on bar 6 at the jetty, the paper coming in from the right to her catch.
//
// It also owns the opening's audio before the press: the AudioContext is made once "dex" has written itself
// (motion/quiet.ts: nothing heavy while the mark draws), suspended and silent, so Track 1's first piece decodes while
// the world loads, and any gesture on the page wakes it quietly.

import { BEATS } from "../../tesu/opening/beats.ts";
import { startT } from "../../tesu/opening/timeline.ts";
import { Conductor, makeAudio, readOpeningNote, type OpeningLink } from "../../tesu/opening/conductor.ts";
import { Track1 } from "../../tesu/opening/track.ts";
import { voiceFor } from "../../tesu/opening/voice.ts";
import { VOICE_FILES } from "../../tesu/opening/voice-files.ts";
import { afterMark } from "./quiet.ts";

export type Way = "continue" | "corner" | "top" | "bottom";

export interface EnterDetail {
  way: Way;
}

/** The event the website sends when the visitor goes into the game (on `document`). */
export const ENTER_EVENT = "dex:enter";

interface PlayableWorld {
  play?(link?: OpeningLink): void;
}

export interface OpeningHook {
  /** Inside any user gesture: wakes the audio, silently. */
  unlock(): void;
  /** The opening's own pieces are in (Track 1's first piece decoded, or no audio at all). */
  ready(): boolean;
  /** The website covers the game screen (the opening and its music hold until it is back in view). */
  covered(on: boolean): void;
  /** The opening is running (from the press to the hand-back). */
  running(): boolean;
}

export function initOpening(opts: { reduced: MediaQueryList; world: () => PlayableWorld | null }): OpeningHook {
  const root = document.documentElement;
  let audio: AudioContext | null = null;
  let track: Track1 | null = null;
  let trackIn = false;
  const wake = (): void => {
    if (audio || trackIn) return;
    audio = makeAudio();
    track = audio ? new Track1(audio, audio.destination) : null;
    // her lines load beside Track 1 (small files; a line not in by its time stays silent, its subtitle shows)
    if (audio) voiceFor(audio, VOICE_FILES);
    trackIn = !track;
    void track?.aReady.then(() => { trackIn = true; }, () => { trackIn = true; });
  };
  void afterMark().then(wake);
  let conductor: Conductor | null = null;

  document.addEventListener(ENTER_EVENT, (e) => {
    if (conductor) return;
    wake();
    const way = (e as CustomEvent<EnterDetail>).detail?.way ?? "continue";
    if (audio && audio.state === "suspended") void audio.resume();
    const c = new Conductor(audio, track, { doc: document, reduced: opts.reduced.matches, repeat: readOpeningNote().seen > 0, way, voice: audio ? voiceFor(audio, VOICE_FILES) : null });
    conductor = c;
    // (tools and checks read the running opening and the way in here)
    Object.assign(window, { __dexOpening: c, __dexWay: way });
    c.start();
    opts.world()?.play?.(c);
    root.classList.add("op-run", "op-cine");
    c.onFrame = (T) => {
      if (T >= BEATS.her.drop1) root.classList.remove("op-cine");
    };
    void startT;
    // the keyboard goes into the world (motion/world.ts)
    document.dispatchEvent(new CustomEvent("dex:toworld"));
  });

  return {
    unlock: () => {
      wake();
      if (audio && audio.state === "suspended") void audio.resume();
    },
    ready: () => trackIn,
    covered: (on) => conductor?.setCovered(on),
    running: () => !!conductor && !conductor.finished,
  };
}

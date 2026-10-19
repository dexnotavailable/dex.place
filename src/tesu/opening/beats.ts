// The opening's chart, revision 4 (the opening director, 10-18; plan: the director's notebook and OPENING.md's
// reconciled table). Authored here, numbers only: the runtime's timeline (timeline.ts) reads nothing else.
// Revision 3 was compiled from the old plan's BEATS.json and the bones' bake (tools/opening/_v3/compile.mjs, kept
// for history: running it would bring the old letter back).
//
// T is Track 1's time as heard (seconds from the press; the WAV's own time). Dex 10-16, the track as it is in the game:
//   0:00-0:17  calm: the lines, the sky, the ofuda falling on the wind through the clouds and the fog
//   0:18       the slap (bar 9's downbeat, 18.575): the slap starts the build
//   0:32       TESU (bar 16's downbeat, 32.418, where the highs open), with the volume lift into it
// and between them: she settles, walks on her own, the hush, the pickup, drop 1 (28.472: she runs, control
// returns), the crash (30.446: the whip-out), TESU on the widest frame. The old letter is gone.

export const BEATS = {
 "rev": "4 (2026-10-18, the opening director: the fall through the sky, the slap on 0:18, TESU on 0:32)",
 "schema": "dexplace.opening.beats/4",
 /** Track 1's bar lines as measured (lanes/opening/music/cue-map.json): bar 0 at 0.641. */
 "bars": [0.6406, 2.636, 4.6308, 6.626, 8.6216, 10.6156, 12.6092, 14.5996, 16.5892, 18.5748, 20.5568, 22.5404, 24.52, 26.498, 28.4724, 30.4464, 32.4176, 34.3844, 36.3508, 38.3148, 40.2796],
 "track": {
  "sampleRate": 48000,
  "seconds": 181.32,
  "seam": 40.277896,
  "aEnd": 1938139,
  "bFrom": 1928539,
  "fade": 0.01,
  "bLateT": 39,
  "bLateFadeFrom": 38.31,
  "files": {
   "a": ["/audio/opening/track1-a.opus", "/audio/opening/track1-a.m4a"],
   "b": ["/audio/opening/track1-b.opus", "/audio/opening/track1-b.m4a"]
  },
  "prime": { "opus": 0, "m4a": 0 },
  /**
   * Dex (vetting, 10-16): "Have the volume increase at 0:32, not too sudden but enough for the drop to hit way
   * harder." The music's level rises by `db` over [from, to] (a beat and a bit into bar 16) and stays up.
   */
  "lift": { "from": 31.432, "to": 32.4176, "db": 3.5 }
 },
 "camera": {
  /**
   * The authored camera to the walk, as keys on T (a monotone curve through them per channel, so it never
   * overshoots and eases where keys repeat): zoom (log), anchor (her feet row), horizon (eye-level row), alt (H:
   * how far above her feet the frame's middle is lifted; the fall's height), cx (H; `follow`: added to her x).
   * Before the press the world holds on the first key (the high sky behind "dex").
   */
  "keys": [
   { "T": 0, "zoom": 1, "anchor": 0.5, "horizon": 1.45, "alt": 34, "cx": 97.4, "follow": false },
   { "T": 0.641, "zoom": 1, "anchor": 0.5, "horizon": 1.45, "alt": 34, "cx": 97.4, "follow": false },
   { "T": 4.631, "zoom": 0.94, "anchor": 0.5, "horizon": 1.36, "alt": 24.5, "cx": 95.4, "follow": false },
   { "T": 8.622, "zoom": 0.84, "anchor": 0.5, "horizon": 1.18, "alt": 13.5, "cx": 92.9, "follow": false },
   { "T": 10.616, "zoom": 0.62, "anchor": 0.62, "horizon": 0.86, "alt": 5, "cx": 89.9, "follow": false },
   { "T": 12.609, "zoom": 0.5, "anchor": 0.8, "horizon": 0.64, "alt": 0, "cx": 88, "follow": false },
   { "T": 14.6, "zoom": 0.52, "anchor": 0.8, "horizon": 0.63, "alt": 0, "cx": 87.6, "follow": false },
   { "T": 16.589, "zoom": 2, "anchor": 0.66, "horizon": 0.27, "alt": 0, "cx": 87.4, "follow": false },
   { "T": 21.528, "zoom": 2, "anchor": 0.66, "horizon": 0.27, "alt": 0, "cx": 87.4, "follow": false },
   { "T": 23.2, "zoom": 1.1, "anchor": 0.66, "horizon": 0.28, "alt": 0, "cx": 1.3, "follow": true },
   { "T": 24.52, "zoom": 0.82, "anchor": 0.68, "horizon": 0.3, "alt": 0, "cx": 1.8, "follow": true },
   { "T": 28.472, "zoom": 0.76, "anchor": 0.68, "horizon": 0.31, "alt": 0, "cx": 2.2, "follow": true },
   { "T": 30.4464, "zoom": 0.62, "anchor": 0.68, "horizon": 0.33, "alt": 0, "cx": 3.4, "follow": true }
  ],
  /**
   * Way 4 (the bottom of the website: "experience the world we made"): the ofuda comes in from the right into
   * the jetty scene, as in the H3 catch; the opening starts on bar 6 (the orchestra) on her, then joins the keys.
   */
  "bottom": {
   "from": 12.609,
   "keys": [
    { "T": 12.609, "zoom": 1, "anchor": 0.68, "horizon": 0.3, "alt": 0, "cx": 89, "follow": false },
    { "T": 14.6, "zoom": 1.25, "anchor": 0.67, "horizon": 0.29, "alt": 0, "cx": 88, "follow": false },
    { "T": 16.589, "zoom": 2, "anchor": 0.66, "horizon": 0.27, "alt": 0, "cx": 87.4, "follow": false }
   ]
  },
  /** The whip-out on the crash, time-locked: from where the keys stand at its start to the widest frame on 0:32. */
  "whip": { "from": 30.4464, "to": 32.4176, "toZoom": 0.125, "exp": 2.2, "anchor": [0.68, 0.71], "horizon": [0.33, 0.5] },
  /** The widest frame: the lake on the left, the palace's west gate pinned at 0.8 of the width; TESU in the sky. */
  "widest": { "from": 32.4176, "zoom": 0.125, "anchor": 0.71, "horizon": 0.5, "pin": { "xH": 143, "at": 0.8 } },
  "easeIn": { "from": 36.3508, "to": 38.3148 },
  /** The widest frame lets go early only if she has run past the tunnel's first gate. */
  "releaseXH": 130.4,
  /** Reduced motion: held frames, cut (cross-faded) on these beats. `key`: the authored key it holds. */
  "reduced": [
   { "from": 0, "hold": "sky", "T": 0.641 },
   { "from": 8.622, "hold": "postcard", "T": 12.609 },
   { "from": 16.589, "hold": "close", "T": 16.589 },
   { "from": 21.528, "hold": "follow", "T": 24.52 },
   { "from": 32.4176, "hold": "widest", "T": 32.4176 },
   { "from": 36.3508, "hold": "follow", "T": 24.52 }
  ]
 },
 "her": {
  /** Dex 10-15: "start further back (left) to fit the running distance": 13.6 H west of the old catch (100), clear
   *  of the jetty's mooring posts (88.1 and 95.7: she stands still at the catch and at the pickup). */
  "catchXH": 86.4,
  "deckYH": 62,
  /** The catch (worker 1's opening_ofuda, 18 drawings): f007 the slap on bar 9; the paper reaches her in f001. */
  "clip": {
   "slot": "opening_ofuda",
   "slap": 18.5748,
   /** Ticks each drawing shows, retimed to the music: f001-f002 (the paper drifting in) slower, the rest as drawn. */
   "ticks": [8, 8, 9, 6, 6, 6, 6, 6, 8, 10, 10, 8, 8, 8, 9, 9, 14, 6],
   /** The drawings' first ticks as drawn (anim.json), so the clip shows drawing i at its own tick. */
   "starts": [0, 8, 12, 17, 23, 29, 35, 41, 47, 55, 65, 75, 83, 91, 99, 108, 117, 131],
   /** The paper in f001 (art px from her soles, facing right): where the world's paper hands over to the drawing. */
   "handoff": [36.9, -135],
   /** The paper's last world drawing is the tick before f001; from f001 to the slap it is the drawing's. */
   "handoffDrawing": 1,
   /** The hat stays jammed over her face (f010 held) until line 6's push mark, then she pushes it up (f011 on). */
   "jamDrawing": 10,
   "push": 20.495
  },
  /** After the push-up has played out (the clip's end + a breath): she walks on her own to the pickup. */
  "walkFrom": 21.698,
  "walkHPerS": 1.1,
  "pickup": 27.979,
  "xPickupH": 94.564,
  "drop1": 28.4724,
  "xBreakH": 94.6,
  /** Her run as the game has it (feel.json: 9 m/s = 5.085 H/s), so the hand-back keeps her speed. */
  "runHPerS": 5.085,
  "runAccel": { "s": 0.233, "h": 0.592 },
  "skid": 34.751,
  "stop": 34.951,
  "stopXH": 126.3,
  "gates": [32.6008, 33.3874, 34.1741]
 },
 /**
  * Her voice (Dex picked the takes by ear, 10-19: lanes/opening/VOICE-CUES.md; ElevenLabs "Mitsuki", Japanese) with a
  * subtitle for each line while it plays (Japanese + English). Lines 1-5 in the calm: line 1's speech from 0.25 s
  * (the press's gust), line 5 done by 18.40, equal gaps; line 6 (the joke) after the slap, from under the jammed
  * hat, the hat pushed up on its `push` mark. `at` = T the file starts; `speech` = the voice inside the file (s);
  * `len` = the file (never cut: it plays to its end). Laid out by lanes/opening/f19/voice_layout.py from the takes.
  */
 "voice": {
  /** The music ducks this much under a line's speech (in and out over `ramp` s): her voice over the build. */
  "duckDb": -3,
  "ramp": 0.25,
  "lines": [
   { "n": 1, "take": "op-line1-b", "at": 0.13, "len": 4.32, "speech": [0.12, 4.02], "jp": "風が何を運んでくるかなんて、誰にも選べない。", "en": "No one gets to choose what the wind brings." },
   { "n": 2, "take": "op-line2-b", "at": 4.182, "len": 5.36, "speech": [0.12, 5.0], "jp": "幸運。悪い知らせ。……知らない人の洗濯物。", "en": "Good luck. Bad news. …A stranger's laundry." },
   { "n": 3, "take": "op-line3-b", "at": 9.235, "len": 2.32, "speech": [0.1, 2.08], "jp": "ときどき――名前。", "en": "Sometimes — a name." },
   { "n": 4, "take": "op-line4-b", "at": 11.387, "len": 3.36, "speech": [0.08, 3.1], "jp": "選べるのは、それを掴むかどうかだけ。", "en": "All you get to choose is whether you catch it." },
   { "n": 5, "take": "op-line5-b", "at": 14.5, "len": 4.16, "speech": [0.14, 3.9], "jp": "掴んだなら、それはもう、あなたが背負うもの。", "en": "Once you've caught it, it's yours to carry." },
   { "n": 6, "take": "op-line6-b", "at": 18.715, "len": 5.2, "speech": [0.16, 4.9], "push": 1.78, "jp": "……まあ、私はたいてい、顔で受け止めるんだけど。", "en": "…Well, I usually catch it with my face." }
  ],
  /** The files (lane D encodes the approved takes): voice-<n>.opus, .m4a for Safari. */
  "dir": "/audio/opening/"
 },
 "title": { "text": "TESU", "at": 32.4176, "hold": 3.9332, "fade": 0.6, "maxWidth": 0.56, "after": "mid" },
 "ui": {
  "bars": { "vh": 11, "in": 0.3, "out": 0.25 },
  "skipTo": 27.49,
  "skipDip": 0.25,
  "chipFrom": 0.5,
  "chipHold": 4,
  "hintAfter": 4,
  "handBack": 38.3148,
  "markHold": 1.5,
  "markHoldReturn": 0.8,
  "slowAt": 20,
  "failAt": 60,
  "guardMs": 300
 },
 "ofuda": {
  /** The page's paper is snatched up out of the top by the press's gust (site, 0.9 s); it falls back in here. */
  "enters": 0.9,
  /** Sun glints on the paper as it turns (a 4-point star, five drawings). */
  "glints": [3.95, 10.42, 15.7],
  "hush": 24.52,
  "inhale": 27,
  /**
   * Its flight, way 1-3: where it is on the frame (shares of the width and height) on T, through the camera's
   * descent; a gentle pendulum sway and the east wind's gusts (dx, dy shares, over `dur` s) on top; from `blend`
   * it is drawn on to her hand-off point in the world.
   */
  "path": [
   { "T": 0.9, "fx": 0.68, "fy": -0.05 },
   { "T": 2.636, "fx": 0.6, "fy": 0.3 },
   { "T": 4.631, "fx": 0.53, "fy": 0.38 },
   { "T": 6.626, "fx": 0.47, "fy": 0.42 },
   { "T": 8.622, "fx": 0.45, "fy": 0.4 },
   { "T": 10.616, "fx": 0.5, "fy": 0.33 },
   { "T": 12.609, "fx": 0.57, "fy": 0.34 },
   { "T": 14.6, "fx": 0.55, "fy": 0.5 }
  ],
  "sway": { "amp": 0.022, "period": 2.6, "until": 15.4 },
  "gusts": [
   { "T": 3.2, "dur": 1.5, "dx": -0.06, "dy": -0.035 },
   { "T": 7.3, "dur": 1.8, "dx": -0.08, "dy": -0.05 },
   { "T": 13.2, "dur": 1.4, "dx": -0.04, "dy": -0.03 }
  ],
  "blend": [15.2, 17.8917],
  /** Way 4: it comes in from the right edge (the H3 catch) and drifts down to her. */
  "pathBottom": [
   { "T": 12.609, "fx": 1.04, "fy": 0.16 },
   { "T": 14.6, "fx": 0.86, "fy": 0.22 },
   { "T": 16.589, "fx": 0.74, "fy": 0.26 }
  ],
  "blendBottom": [15.6, 17.8917]
 },
 "hush": { "at": 24.52, "duckDb": -6, "over": 1 },
 "sfx": [
  { "T": 0, "id": "op.gust" },
  { "T": 4.631, "id": "op.paper-flutter" },
  { "T": 17.8917, "id": "op.catch" },
  { "T": 18.5748, "id": "op.slap" },
  { "T": 18.69, "id": "op.jam" },
  { "T": 20.495, "id": "op.brim" },
  { "T": 27, "id": "op.inhale" },
  { "T": 27.979, "id": "op.hatgrip" },
  { "T": 28.4724, "id": "op.burst" },
  { "T": 34.751, "id": "op.skid" }
 ]
} as const;

export type Beats = typeof BEATS;

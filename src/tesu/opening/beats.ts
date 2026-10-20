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
   * Before the press the world holds on the first key: inside the black slab (`ceiling`), behind "dex".
   * Rev 5 (Dex 10-19 18:34Z): the black loading screen is a slab above everything; the press drops the paper out of
   * it: zoom 0 = the page's own scale for the paper (her ofuda as the loader drew it; game.ts startZoom), the camera
   * plunges out of the slab on bar 0. Rev 6 (Dex 10-20: "I want it following the ofuda closely"): one brief glimpse
   * of the world far below (1.35 s), then close on the paper (it is drawn near the lens: ofuda.lens) all the way down
   * through the clouds, the world rushing past; close on her at the catch, easing out to way 4's close band by its
   * end. One continuous shot, no cut. Dex 10-21 ("it flashes the whole background"): the glimpse was a 1.1 s pulse
   * (zoom 1 to 0.16 to 4) and its way back in lifted the frame's top into the slab's black; now it eases out (1.3 s
   * keeps the frame's middle coming down, never back up), holds the world below for a moment (1.55-1.9) and eases back
   * in to the close ride by 3.1; the frame's top stays under the slab once it is out. The catch frames her a little
   * higher (feet at 0.69) so the paper's hand-off point sits where it rode.
   */
  "keys": [
   { "T": 0, "zoom": 0, "anchor": 0.5, "horizon": 1.45, "alt": 68.2, "cx": 97.4, "follow": false },
   { "T": 0.3, "zoom": 0, "anchor": 0.5, "horizon": 1.45, "alt": 68.2, "cx": 97.4, "follow": false },
   { "T": 0.641, "zoom": 0, "anchor": 0.5, "horizon": 1.45, "alt": 63.4, "cx": 97.2, "follow": false },
   { "T": 1, "zoom": 1.1, "anchor": 0.5, "horizon": 1.3, "alt": 57, "cx": 100, "follow": false },
   { "T": 1.3, "zoom": 0.26, "anchor": 0.8, "horizon": 1.0, "alt": 29, "cx": 102.5, "follow": false },
   { "T": 1.55, "zoom": 0.16, "anchor": 0.9, "horizon": 0.84, "alt": 0, "cx": 104, "follow": false },
   { "T": 1.9, "zoom": 0.17, "anchor": 0.88, "horizon": 0.86, "alt": 0, "cx": 105, "follow": false },
   { "T": 2.55, "zoom": 0.55, "anchor": 0.5, "horizon": 1.45, "alt": 52, "cx": 108, "follow": false },
   { "T": 3.1, "zoom": 4, "anchor": 0.5, "horizon": 1.45, "alt": 50.5, "cx": 110, "follow": false },
   { "T": 4.631, "zoom": 4, "anchor": 0.5, "horizon": 1.4, "alt": 44.5, "cx": 106.5, "follow": false },
   { "T": 6.626, "zoom": 4, "anchor": 0.5, "horizon": 1.35, "alt": 37, "cx": 103, "follow": false },
   { "T": 8.622, "zoom": 4, "anchor": 0.5, "horizon": 1.25, "alt": 29.5, "cx": 99.5, "follow": false },
   { "T": 10.616, "zoom": 4, "anchor": 0.5, "horizon": 1.1, "alt": 22, "cx": 96, "follow": false },
   { "T": 12.609, "zoom": 4, "anchor": 0.5, "horizon": 0.85, "alt": 14.5, "cx": 92.5, "follow": false },
   { "T": 14.6, "zoom": 3.5, "anchor": 0.55, "horizon": 0.55, "alt": 7.2, "cx": 89.5, "follow": false },
   { "T": 16.589, "zoom": 4, "anchor": 0.69, "horizon": 0.27, "alt": 0, "cx": 87.2, "follow": false },
   { "T": 22, "zoom": 2, "anchor": 0.66, "horizon": 0.27, "alt": 0, "cx": 87.4, "follow": false },
   { "T": 23.066, "zoom": 2, "anchor": 0.66, "horizon": 0.27, "alt": 0, "cx": 87.4, "follow": false },
   { "T": 24.6, "zoom": 1.1, "anchor": 0.66, "horizon": 0.28, "alt": 0, "cx": 1.3, "follow": true },
   { "T": 25.6, "zoom": 0.82, "anchor": 0.68, "horizon": 0.3, "alt": 0, "cx": 1.8, "follow": true },
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
   { "from": 0, "hold": "sky", "T": 1.55 },
   { "from": 8.622, "hold": "postcard", "T": 12.609, "key": { "zoom": 0.5, "anchor": 0.8, "horizon": 0.64, "cx": 88 } },
   { "from": 16.589, "hold": "close", "T": 16.589 },
   { "from": 23.066, "hold": "follow", "T": 25.6 },
   { "from": 32.4176, "hold": "widest", "T": 32.4176 },
   { "from": 36.3508, "hold": "follow", "T": 25.6 }
  ]
 },
 /**
  * The black loading screen as a slab above everything (Dex 10-19: "as if the black loading screen existed above
  * everything"): pure black above `altH` H over her feet. The paper hangs in it at the press and falls out of it.
  */
 "ceiling": { "altH": 66 },
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
   "handoff": [39.52, -136.2],
   /**
    * The clip's own paper in the hand-off drawing (f001; read-only, measured by lanes/opening/f19/band.py): 6 rows x 2
    * edges (its front to the eye) from its deep-gold end (the tie) to its cream end, art px from her soles facing right. The world's paper is
    * steered onto it in the fall's last `ofuda.steer` s, so f001 takes over a paper already in its place, angle, size,
    * shape and face (Dex 10-19: "you can't tell it went from a procedurally generated one to the one made by us").
    */
   "band": [[31.93, -130.19], [30.07, -132.81], [34.91, -131.18], [33.18, -133.6], [38.93, -133.19], [37.07, -135.81], [42.21, -135.39], [40.21, -138.19], [45.07, -138.29], [43.07, -141.1], [46.88, -141.16], [45.49, -143.11]],
   /** The paper's last world drawing is the tick before f001; from f001 to the slap it is the drawing's. */
   "handoffDrawing": 1,
   /** The hat stays jammed over her face (f010 held) until the take's えへへ, then she pushes it up (f011 on). */
   "jamDrawing": 10,
   "push": 22.033
  },
  /** After the push-up has played out (the clip's end + a breath): she walks on her own to the pickup (1.2 H/s). */
  "walkFrom": 23.236,
  "walkHPerS": 1.1,
  "pickup": 27.979,
  "xPickupH": 92.581,
  "drop1": 28.4724,
  "xBreakH": 92.617,
  /** Her run as the game has it (feel.json: 9 m/s = 5.085 H/s), so the hand-back keeps her speed. */
  "runHPerS": 5.085,
  "runAccel": { "s": 0.233, "h": 0.592 },
  "skid": 35.142,
  "stop": 35.342,
  "stopXH": 126.3,
  "gates": [32.9907, 33.7774, 34.564]
 },
 /**
  * Her voice: ONE continuous take (Dex 10-20: "it sounds so weird stitching sentences together"; lane D's
  * public/audio/opening/speech.*, its alignment speech.json), the game's own sound cue `take.cue` booked on the music's
  * clock at `take.at` (played whole, as recorded: no rate jitter), with a subtitle while each line speaks (Japanese +
  * English; `parts` in file seconds, copied from speech.json's parts). Lines 1-5 in the calm (line 1 on bar 0, as the
  * paper drops out of the black); line 6, the joke, is set up before the slap and the slap lands in its pause
  * ("……まあ、私はたいてい、" … SLAP … "顔で受け止めるんだけど。"): the hat stays jammed over her face through the
  * punch and comes up on the えへへ (her.clip.push). The music dips under each line.
  */
 "voice": {
  /** Track 1 dips this much under a line's speech (in and out over `ramp` s; the conductor's own gain stage). */
  "duckDb": -4,
  "ramp": 0.25,
  "take": { "cue": "op.speech", "at": 0.3, "len": 24.7465 },
  "lines": [
   { "n": 1, "parts": [{ "from": 0.32, "to": 2.48, "jp": "風が運ぶものは、選べない。", "en": "What the wind brings, you can't choose." }] },
   { "n": 2, "parts": [{ "from": 3.44, "to": 6.88, "jp": "幸運。凶報。誰かの洗濯物。", "en": "Good luck. Bad news. …Somebody's laundry." }] },
   { "n": 3, "parts": [{ "from": 7.44, "to": 9.12, "jp": "ときどき――名前。", "en": "Sometimes — a name." }] },
   { "n": 4, "parts": [{ "from": 9.84, "to": 12.16, "jp": "選べるのは、掴むかどうかだけ。", "en": "All you choose is whether to catch it." }] },
   { "n": 5, "parts": [{ "from": 12.88, "to": 15.12, "jp": "掴んだら、もう君が背負うもの。", "en": "Catch it, and it's yours to carry." }] },
   { "n": 6, "parts": [
    { "from": 16, "to": 18, "jp": "……まあ、私はたいてい、", "en": "…Well, I usually…" },
    { "from": 19.68, "to": 21.04, "jp": "顔で受け止めるんだけど。", "en": "catch it with my face." },
    { "from": 21.733, "to": 22, "jp": "えへへ。", "en": "Ehehe." }
   ] }
  ]
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
  /** Rev 5: the paper is the world's from the press on (it hangs where the page's loader left it, in the black). */
  "enters": 0,
  /** Sun glints on the paper as it turns (a 4-point star, five drawings). */
  "glints": [1.35, 3.95, 10.42, 15.7],
  /**
   * From here the falling paper turns into the whole paper over `stripFor` s (its shape and its texels, one into the
   * other), as it drops out of the black and comes at the lens.
   */
  "stripAt": 0.45,
  "stripFor": 0.5,
  /**
   * Dex 10-20: "following the ofuda closely". Near the lens it is drawn `h` of the frame's height long, whatever the
   * world's zoom: [T, how near (0..1)], eased between. It comes at the lens as it drops out of the black, rides the
   * whole fall there, and leaves it for her plane before the steer (her drawing's own size at the hand-off).
   */
  "lens": { "h": 0.2, "keys": [[0.3, 0], [1.1, 1], [15.4, 1], [17.5, 0]] },
  /** The fall's last seconds: steered onto the clip's paper in the hand-off drawing (her.clip.band). */
  "steer": 0.7,
  /** ... and over its last `turn` s before that it turns to lie the way the clip's paper lies (no fold at the steer). */
  "turn": 1.6,
  "hush": 24.52,
  "inhale": 27,
  /**
   * Its flight, way 1-3: where it is on the frame (shares of the width and height) on T, through the camera's
   * descent; a gentle pendulum sway and the east wind's gusts (dx, dy shares, over `dur` s) on top; from `blend`
   * it is drawn on to her hand-off point in the world. Dex 10-21 ("a little further up ... more consistent"): it rides
   * in the upper third (0.37 of the height) from the glimpse to the catch, the gusts lift it only a little, and the
   * blend starts once the catch's frame has her hand near that height (16), so it never dips on the way to her.
   */
  "path": [
   { "T": 0, "fx": 0.5, "fy": 0.6 },
   { "T": 0.641, "fx": 0.5, "fy": 0.64 },
   { "T": 1.55, "fx": 0.5, "fy": 0.37 },
   { "T": 3.1, "fx": 0.5, "fy": 0.37 },
   { "T": 4.631, "fx": 0.49, "fy": 0.37 },
   { "T": 6.626, "fx": 0.51, "fy": 0.37 },
   { "T": 8.622, "fx": 0.48, "fy": 0.37 },
   { "T": 10.616, "fx": 0.5, "fy": 0.37 },
   { "T": 12.609, "fx": 0.52, "fy": 0.37 },
   { "T": 14.6, "fx": 0.54, "fy": 0.37 }
  ],
  "sway": { "amp": 0.022, "period": 2.6, "until": 15.4 },
  "gusts": [
   { "T": 3.2, "dur": 1.5, "dx": -0.06, "dy": -0.02 },
   { "T": 7.3, "dur": 1.8, "dx": -0.08, "dy": -0.03 },
   { "T": 13.2, "dur": 1.4, "dx": -0.04, "dy": -0.018 }
  ],
  "blend": [16, 17.8917],
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
  { "T": 22.033, "id": "op.brim" },
  { "T": 27, "id": "op.inhale" },
  { "T": 27.979, "id": "op.hatgrip" },
  { "T": 28.4724, "id": "op.burst" },
  { "T": 35.142, "id": "op.skid" },
  // her speech, one take (the voice above: at its `take.at`)
  // (a long take: `len` s, never dropped for being late, opening.ts cueAction; `file`, its encoded pair, decoded with
  // Track 1's piece A before "continue", track.ts)
  { "T": 0.3, "id": "op.speech", "len": 24.7465, "file": "/audio/opening/speech" }
 ]
} as const;

export type Beats = typeof BEATS;

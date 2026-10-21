// The opening's timing (chart revision 4), checked without a browser: the slap on bar 9 and TESU on bar 16 (Dex's
// 0:18 and 0:32), her path from the new catch spot, the catch's drawings retimed to the music, the camera continuous
// from the high sky to the hand-back for every way in, the paper's flight on the frame and clear of the bars, the
// captions inside the calm, the fall's clouds where the camera sees them and out of every play frame; the heard
// clock, the "continue" rules, the effects booked ahead and the plate store's keep (unchanged).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BEATS, CLIP_AT, CLIP_END, HANDOFF_T, VOICE, barsAt, beatAt, cameraAt, captionAt, centreOf, clipAt, herPhase, herSpeedH, herXH, keysAt, mixShot, monotone, nextBarLine, paperBlendAt, paperLensAt, paperScreenAt, setStartZoom, startT, subtitleAt, widestShot } from "./opening/timeline.ts";
import { Opening, cueAction } from "./opening.ts";
import { TileStore } from "./plates/store.ts";
import { HeardClock, onGrid } from "./opening/clock.ts";
import { pressContinues } from "./opening/press.ts";
import { FALL_CLOUDS, REF, cloudBounds, fallPoint } from "./world/sections/opening-sky.ts";
import { fallSkyOf, fallSkyShare } from "./opening/fall-sky.ts";
import { PLANES } from "./world/types.ts";
import { planeXf } from "./render/view.ts";
import { fallVeils } from "./opening/sky.ts";

const near = (a, b, eps, what) => assert.ok(Math.abs(a - b) <= eps, `${what}: ${a} vs ${b} (±${eps})`);
const H = 96;
const world = () => ({ zoom: 0.5, anchor: 0.74, horizon: 0.4, lead: 0, fixX: null, pin: null });
const WINDOWS = [[1280, 720], [1366, 768], [1536, 864], [1920, 1080], [1920, 912], [1266, 585], [390, 844], [844, 390]];
const BARS = BEATS.ui.bars.vh / 100;
const camAt = (T, extra = {}) => cameraAt(T, { x: herXH(T) * H, W: 1280, H: 720, world, ...extra });

test("Dex's track: the slap on 0:18 (bar 9), TESU on 0:32 (bar 16) with the lift into it; her lines 1-5 in the calm, line 6 after the slap", async () => {
  near(BEATS.her.clip.slap, BEATS.bars[9], 1e-9, "the slap on bar 9");
  assert.equal(Math.floor(BEATS.her.clip.slap), 18);
  near(BEATS.title.at, BEATS.bars[16], 1e-9, "TESU on bar 16");
  assert.equal(Math.floor(BEATS.title.at), 32);
  near(BEATS.track.lift.to, BEATS.title.at, 0.001, "the lift peaks on TESU");
  assert.ok(BEATS.track.lift.db > 0 && BEATS.track.lift.from < BEATS.track.lift.to);
  near(BEATS.her.drop1, BEATS.bars[14], 1e-9, "drop 1");
  near(BEATS.camera.whip.from, BEATS.bars[15], 0.001, "the whip on the crash");
  near(BEATS.camera.whip.to, BEATS.title.at, 0.001, "the whip lands on 0:32");
  // her voice, ONE take (Dex 10-20: "stitching sentences together sounds weird"): lines 1-5 speak in the calm, one at a
  // time with a breath between; line 6 (the joke) is set up before the slap and the slap lands in its pause; the hat
  // comes up on its えへへ
  const v = VOICE, slap = BEATS.her.clip.slap;
  assert.equal(v.length, 6);
  assert.ok(v[0].from >= 0.2, "line 1 after the press's gust");
  for (let i = 1; i < 6; i++) assert.ok(v[i].from >= v[i - 1].to + 0.3, `line ${i + 1} after line ${i}, a breath between`);
  assert.ok(v[4].to < slap - 2, "lines 1-5 well before the slap");
  const six = v[5], setup = six.parts[0], punch = six.parts[1];
  assert.ok(setup.to < slap && punch.from > slap + 0.5, "the slap lands in line 6's pause, the punch after it");
  assert.ok(setup.to <= slap - 0.2, "a beat between the set-up and the slap");
  const ehehe = six.parts[2];
  assert.equal(ehehe.jp, "えへへ。");
  near(BEATS.her.clip.push, ehehe.from, 1e-3, "the push-up on the えへへ");
  assert.ok(BEATS.her.clip.push > punch.to, "the hat still jammed through the punch");
  assert.ok(BEATS.camera.keys.some((k) => Math.abs(k.T - CLIP_END) < 1e-3 && k.zoom === 2 && !k.follow), "the close band ends as the push-up does");
  assert.ok(BEATS.camera.reduced.some((r) => Math.abs(r.from - CLIP_END) < 1e-3 && r.hold === "follow"), "(reduced motion: cut to the follow then)");
  near(BEATS.sfx.find((c) => c.id === "op.brim").T, BEATS.her.clip.push, 1e-9, "the brim's sound on the push-up");
  // the take is the game's own cue, booked once on the music's clock at its start, played whole; its lines are lane
  // D's alignment (speech.json parts) as they are
  const k = BEATS.voice.take;
  assert.deepEqual(BEATS.sfx.filter((c) => c.id === k.cue).map((c) => c.T), [k.at], "booked once");
  assert.equal(BEATS.sfx.find((c) => c.id === k.cue).len, k.len, "the cue's length is the take's");
  assert.ok(!BEATS.sfx.some((c) => /^op\.(tight|line)\d/.test(c.id)), "the stitched lines are gone");
  const sp = JSON.parse(readFileSync(new URL("../../public/audio/opening/speech.json", import.meta.url), "utf8"));
  near(k.at, sp.start, 1e-9, "D's start");
  assert.equal(k.cue, sp.cue);
  const ours = BEATS.voice.lines.flatMap((l) => l.parts);
  assert.equal(ours.length, sp.parts.length);
  sp.parts.forEach((p, i) => {
    assert.deepEqual([ours[i].from, ours[i].to, ours[i].jp, ours[i].en], [p.start, p.end, p.jp, p.en], `part ${p.part}`);
    assert.ok(p.end <= k.len, `part ${p.part} inside the file`);
  });
  near(slap - k.at, (sp.pause[0] + sp.pause[1]) / 2, (sp.pause[1] - sp.pause[0]) / 2, "the slap inside the take's pause");
  // played as recorded (no rate jitter: the subtitles and the slap ride its timing), stopped by a skip
  const { CUES } = await import("./sound.ts");
  assert.equal(CUES[k.cue].exact, true);
  assert.equal(CUES[k.cue].rate, 1);
  assert.ok(!v.some((x) => x.parts.some((p) => /Emperor|letter|court/i.test(p.en))), "the old letter is gone");
  // the subtitles: the words being spoken (Japanese + English), none at the press, the punch hidden until it is said
  assert.equal(subtitleAt(0), null);
  for (const x of v) for (const p of x.parts) assert.deepEqual(subtitleAt((p.from + p.to) / 2), { n: x.n, jp: p.jp, en: p.en });
  assert.equal(subtitleAt(slap)?.en, setup.en, "the set-up hangs on screen through the slap");
  assert.equal(subtitleAt(punch.from)?.en, punch.en, "then the punch replaces it");
  assert.equal(subtitleAt(six.to + 1), null);
  assert.equal(captionAt(1), v[0].parts[0].en);
});

test("her path: further back (left), the solved walk, the run at the game's own speed, she stops on the terrace", () => {
  const h = BEATS.her;
  assert.ok(h.catchXH <= 88, "further back than the old catch (100)");
  // clear of the jetty's mooring posts while she stands (at the catch and at the pickup)
  for (const post of [88.1, 95.7]) {
    assert.ok(Math.abs(h.catchXH - post) > 0.8, `the catch clear of the post at ${post}`);
    assert.ok(Math.abs(h.xPickupH - post) > 0.8, `the pickup clear of the post at ${post}`);
  }
  assert.equal(herXH(0), h.catchXH);
  assert.equal(herXH(h.walkFrom - 0.01), h.catchXH);
  near(herXH(h.pickup), h.xPickupH, 1e-6, "x at the pickup");
  near(herXH(h.drop1), h.xBreakH, 1e-6, "x at the break");
  const walk = herSpeedH((h.walkFrom + h.pickup) / 2);
  assert.ok(walk >= 1 && walk <= 1.45, `a walk, not a run (${walk.toFixed(2)} H/s)`);
  near(herSpeedH(30), 9 / 1.77, 0.01, "the run (feel.json: 9 m/s)");
  [115, 119, 123].forEach((g, i) => near(herXH(h.gates[i]), g, 0.1, `gate ${i + 1}`));
  near(herXH(h.stop), h.stopXH, 1e-6, "she stops at the overlook");
  assert.equal(herPhase(h.stop + 1), "stand");
  let last = -Infinity;
  for (let T = 0; T < 40; T += 1 / 60) {
    const x = herXH(T);
    assert.ok(x >= last - 1e-9, `backwards at T ${T.toFixed(3)}`);
    last = x;
  }
});

test("the catch: worker 1's drawings retimed so f007 (the slap) starts on bar 9; f000 held until the paper reaches her", () => {
  const c = BEATS.her.clip;
  assert.equal(c.ticks.length, 18);
  assert.equal(c.starts.length, 18);
  near(CLIP_AT[7], c.slap, 1e-9, "f007 on the slap");
  assert.deepEqual(clipAt(c.slap), { index: 7, tick: c.starts[7] });
  assert.deepEqual(clipAt(c.slap - 1e-4), { index: 6, tick: c.starts[6] });
  assert.deepEqual(clipAt(0), { index: 0, tick: 0 });
  assert.deepEqual(clipAt(HANDOFF_T - 1e-4), { index: 0, tick: 0 });
  assert.deepEqual(clipAt(HANDOFF_T), { index: 1, tick: c.starts[1] });
  near(HANDOFF_T, c.slap - (8 + 9 + 4 * 6) / 60, 1e-9, "f001 starts 41 ticks before the slap");
  // as drawn, except the jam (f010) held until line 6's push mark, where the push-up (f011) starts
  for (let i = 1; i < 18; i++) if (i !== c.jamDrawing) near(CLIP_AT[i + 1] - CLIP_AT[i], c.ticks[i] / 60, 1e-9, `drawing ${i}`);
  near(CLIP_AT[c.jamDrawing + 1], c.push, 1e-9, "the push-up on the mark");
  assert.ok(CLIP_AT[c.jamDrawing + 1] - CLIP_AT[c.jamDrawing] >= c.ticks[c.jamDrawing] / 60 - 1e-9, "the jam held, never cut short");
  assert.equal(clipAt(CLIP_END), null);
  assert.ok(CLIP_END < BEATS.her.walkFrom, "she settles before she walks");
  // the clip's own drawing starts (anim.json), so the game shows drawing i at its own tick
  let t = 0;
  [8, 4, 5, 6, 6, 6, 6, 6, 8, 10, 10, 8, 8, 8, 9, 9, 14, 6].forEach((n, i) => { assert.equal(c.starts[i], t); t += n; });
});

test("the camera: high in the sky at the press, closing in on the paper as it drops (no glimpse of the world below), close on the paper down through the fall, close on her through the slap, the widest frame on 0:32, the hand-back", () => {
  const s0 = camAt(0);
  assert.ok(s0.horizon > 1.2, "the eye-level row below the frame: only sky");
  assert.ok(s0.anchor > 2, "her feet far below the frame");
  // the frame's middle, H above her feet
  const alt = (s) => ((s.anchor - 0.5) * 720) / s.zoom / H;
  // (Dex 10-20: "following the ofuda closely"; 10-21: it "still briefly shows the whole world right after following the
  // ofuda") no glimpse: from the press to the close ride the camera only closes in, never back out, and the world
  // below never enters the frame (its eye-level row stays under the frame) before the catch's descent
  let zPrev = 0;
  for (let T = 0; T <= BEATS.camera.keys.find((k) => k.zoom >= 4).T; T += 0.02) {
    const s = camAt(T);
    assert.ok(s.zoom >= zPrev - 1e-9, `zoomed back out at ${T.toFixed(2)}`);
    assert.ok(s.horizon > 1.2, `the world below in the frame at ${T.toFixed(2)}`);
    zPrev = s.zoom;
  }
  for (let T = 0; T < BEATS.bars[8]; T += 0.05) assert.ok(camAt(T).zoom >= 0.99, `wide at ${T.toFixed(2)}`);
  // then close, all the way down: the world rushes past (lower and lower) around the paper
  let prev = Infinity;
  const close = BEATS.camera.keys.find((k) => k.zoom >= 4).T;
  assert.ok(close < BEATS.bars[1] + 0.5, "close on the paper soon after bar 1");
  for (let T = close; T <= BEATS.bars[7]; T += 0.25) {
    const s = camAt(T);
    assert.ok(s.zoom >= 3, `close on the paper at ${T.toFixed(2)} (zoom ${s.zoom.toFixed(2)})`);
    assert.ok(alt(s) < prev, `still coming down at ${T.toFixed(2)}`);
    prev = alt(s);
  }
  assert.ok(alt(camAt(BEATS.bars[7])) < 0.2 * alt(camAt(BEATS.bars[1])), "most of the way down by bar 7");
  for (const T of [BEATS.bars[8], HANDOFF_T, BEATS.her.clip.slap]) {
    const s = camAt(T);
    assert.ok(s.zoom >= 3, `close on her through the catch and the slap at ${T} (zoom ${s.zoom.toFixed(2)})`);
    const col = 0.5 + ((herXH(T) * H - s.cx) * s.zoom) / 1280;
    assert.ok(col > 0.25 && col < 0.45, `she sits left of the middle, the paper's side open (${col.toFixed(3)})`);
  }
  // it eases back to the close band way 4 has, by its end
  near(camAt(BEATS.bars[10] + 2.1).zoom, 2, 1e-3, "the close band's end");
  const wide = camAt(BEATS.title.at + 0.001);
  assert.deepEqual(wide, widestShot(1280));
  near((143 * H - wide.cx) * wide.zoom + 640, 0.8 * 1280, 1e-6, "the palace's west gate pinned at 0.8");
  assert.equal(camAt(BEATS.ui.handBack), null);
  near(camAt(BEATS.ui.handBack - 1e-4).zoom, 0.5, 0.001, "eased in to the world's framing");
});

test("the camera never jumps, for every way in and every window: a tick apart it moves only by its own motion", () => {
  // (at the press the frame has the page's own scale: about 3 on a 1080 px screen, 1 on a small one)
  for (const z0 of [1, 3]) for (const way of ["continue", "bottom"]) {
    setStartZoom(z0);
    for (const [w, h] of WINDOWS) {
      let prev = null, pm = null;
      for (let T = startT(way); T < BEATS.ui.handBack - 1 / 60; T += 1 / 60) {
        const s = cameraAt(T, { x: herXH(T) * H, W: w, H: h, world, way });
        if (prev) {
          const dz = Math.abs(Math.log(s.zoom / prev.zoom));
          const stunt = way !== "bottom" && T > 0.3 && T < 3.15;
          assert.ok(dz < (stunt ? 0.12 : 0.06), `${way} ${w}x${h} T ${T.toFixed(3)}: zoom jumped ${dz.toFixed(3)}`);
          // how far the world under the frame's middle moves on the frame in a tick (shares of the frame; her feet
          // row is no measure when they are frames below it, as in the fall)
          const my = (s.anchor * h - ((prev.anchor * h - h / 2) * s.zoom) / prev.zoom - h / 2) / h;
          const mx = ((s.cx - prev.cx) * s.zoom) / w;
          // (the plunge out of the black slab and the close-in onto the paper, 0.3-3.1 s, are fast on purpose; the
          // close follow rushes the world past: smooth, never a cut)
          const lim = stunt ? 0.5 : 0.1;
          assert.ok(Math.abs(my) < lim && Math.abs(mx) < lim, `${way} ${w}x${h} T ${T.toFixed(3)}: the frame moved ${mx.toFixed(3)}, ${my.toFixed(3)} in one tick`);
          // and its motion changes smoothly: a cut would change it at once (the dive out of the black accelerates hard)
          const acc = stunt ? 0.15 : 0.06;
          if (pm) assert.ok(Math.abs(my - pm[1]) < acc && Math.abs(mx - pm[0]) < acc, `${way} ${w}x${h} T ${T.toFixed(3)}: the frame's motion jumped`);
          pm = [mx, my];
        }
        prev = s;
      }
    }
  }
  setStartZoom(1);
  const z = (T) => Math.log(camAt(T).zoom);
  const w = BEATS.camera.whip;
  assert.ok(Math.abs(z(w.from + 0.1) - z(w.from)) < Math.abs(z(w.to) - z(w.to - 0.1)), "accelerating into the crash");
});

test("way 4 (the jetty): from bar 6 on her, the paper in from the right; its own close band, joining the fall's keys at its end", () => {
  near(startT("bottom"), BEATS.bars[6], 0.001, "bar 6");
  assert.equal(startT("continue"), 0);
  assert.equal(startT("corner"), 0);
  assert.equal(startT("top"), 0);
  const b0 = cameraAt(startT("bottom"), { x: herXH(12.7) * H, W: 1280, H: 720, world, way: "bottom" });
  assert.ok(b0.anchor < 1 && b0.horizon < 1, "on the ground, not in the sky");
  // (as live: the close band at zoom 2 through the catch; ways 1-3 come in closer and ease out to it by its end)
  for (const T of [16.589, 18, 22]) near(cameraAt(T, { x: herXH(T) * H, W: 1280, H: 720, world, way: "bottom" }).zoom, 2, 1e-9, `way 4's close band at ${T}`);
  for (const T of [22.658, 24, 30]) {
    const a = cameraAt(T, { x: herXH(T) * H, W: 1280, H: 720, world, way: "bottom" }), c = camAt(T);
    near(a.zoom, c.zoom, 1e-9, `the same camera at ${T}`);
    near(a.cx, c.cx, 1e-6, `the same centre at ${T}`);
  }
  const p = paperScreenAt(startT("bottom"), "bottom");
  assert.ok(p[0] > 1, "it comes in from the right edge");
});

test("the camera, reduced motion: held frames, cut on their beats", () => {
  const r = (T) => cameraAt(T, { x: herXH(T) * H, W: 1280, H: 720, world, reduced: true });
  const holds = [];
  let prev = null;
  for (let T = 0; T < BEATS.ui.handBack; T += 0.1) {
    const s = r(T);
    // a held frame keeps its zoom, rows and (where it follows her) her place: its zoom and rows change only on a cut
    const k = JSON.stringify([s.zoom.toFixed(4), s.anchor.toFixed(4), s.horizon.toFixed(4)]);
    if (prev !== k) holds.push(T);
    prev = k;
  }
  assert.ok(holds.length <= BEATS.camera.reduced.length, `held frames only (${holds.length} changes at ${holds.map((t) => t.toFixed(1)).join(", ")})`);
  // reduced motion opens close on the paper in the sky, still (no glimpse); then the postcard (its own key:
  // the full-motion camera is in the sky then), the catch as the full-motion camera frames it
  near(r(1).zoom, 4, 1e-3, "close on the paper");
  near(r(10).zoom, 0.5, 1e-3, "the postcard");
  near(r(10).anchor, 0.8, 1e-3, "the postcard's feet row");
  near(r(18).zoom, camAt(BEATS.bars[8]).zoom, 1e-3, "the catch's frame");
  assert.equal(r(33).zoom, 0.125);
  assert.equal(r(BEATS.ui.handBack), null);
});

test("the paper: it falls back in from the top, keeps clear of the bars and the sides, reaches her hand-off on f001", () => {
  for (const way of ["continue", "bottom"]) {
    const t0 = way === "bottom" ? startT("bottom") : BEATS.ofuda.enters;
    assert.equal(paperScreenAt(t0 - 0.01, way), null, `${way}: not before it enters`);
    // rev 5: it hangs where the page's loader left it (under "dex", 0.6 down the screen) and drops from there
    if (way === "continue") assert.deepEqual(paperScreenAt(t0, way), [0.5, 0.6], "where the loader left it");
    for (let T = t0 + 1.7; T < HANDOFF_T; T += 1 / 30) {
      const [fx, fy] = paperScreenAt(T, way);
      if (paperBlendAt(T, way) > 0) continue;
      assert.ok(fy > BARS + 0.02 && fy < 1 - BARS - 0.02, `${way} T ${T.toFixed(2)}: under a bar (${fy.toFixed(3)})`);
      assert.ok(fx > 0.06 && fx < 0.94, `${way} T ${T.toFixed(2)}: off the side (${fx.toFixed(3)})`);
    }
    near(paperBlendAt(HANDOFF_T, way), 1, 1e-6, `${way}: on her hand-off point when the drawing takes it`);
  }
  // the east wind: it drifts right to left over the fall
  assert.ok(paperScreenAt(14, "continue")[0] < paperScreenAt(1.2, "continue")[0] + 0.07);
});

test("the fall's clouds: each where the camera sees it (on Dex's 1920 x 1080 frame), and none in any play frame", async () => {
  for (const c of FALL_CLOUDS) {
    const [x, y] = fallPoint(c.T, c.plane, c.fx, c.fy);
    const s = keysAt(c.T, BEATS.her.catchXH * H, REF.W, REF.H);
    const cam = { cx: s.cx, cy: BEATS.her.deckYH * H, zoom: s.zoom, anchor: s.anchor, horizon: s.horizon, W: REF.W, H: REF.H };
    const r = PLANES[c.plane].rate, xf = planeXf(cam, r);
    // (planeXf rounds its offsets to whole px)
    near((x * r * xf.g + xf.offX) / REF.W, c.fx, 0.002, `${c.id} across`);
    near((y * r * xf.g + xf.offY) / REF.H, c.fy, 0.002, `${c.id} down`);
    // the play frames at Kagami (zoom 1, the close band 2x and the catch's 4x (rev 6), a vista 0.5 at 1280 x 720; at
    // 1920 x 1080 zoom 1, 2 and 4):
    // the whole cloud (its painter's bounds, a deck's hanging masses too) is above their top edge. (They are hidden
    // outside the fall anyway, game.ts syncFall; the deck the camera breaks out under sits low enough to show at the
    // top of a 1080p vista at 0.5, which never shows them.)
    const low = cloudBounds(c.cloud)[3];
    for (const [W, Hf] of [[1280, 720], [1920, 1080]]) {
      for (const [zoom, anchor, horizon] of [[1, 0.66, 0.38], [2, 0.66, 0.27], [4, 0.74, 0.27], [0.5, 0.74, 0.4]]) {
        if (W > 1280 && zoom < 1) continue;
        // (the fall loop, round 1c) the deck and its receding layers, composed for the break-out and the postcard
        // (the camera down at the hold's own height; W1-8 / W1-9: the deck overhead, its underside receding into
        // the middle sky), lie in the play sky by design: they are hidden outside the fall (game.ts syncFall), so
        // only the close band they hand off to (the catch, the walk) must not see them (round 2: and every cloud
        // marked `low`, composed toward the horizon for the vast frame)
        if ((c.T >= 10 || c.low) && zoom < 2) continue;
        const pc = { cx: x, cy: BEATS.her.deckYH * H, zoom, anchor, horizon, W, H: Hf };
        const pxf = planeXf(pc, r);
        const foot = (y * r + low) * pxf.g + pxf.offY;
        assert.ok(foot < 0, `${c.id} shows in a ${W}x${Hf} play frame at zoom ${zoom} (its foot at row ${foot.toFixed(0)})`);
      }
    }
  }
  // the fog layers on the lens: only in the fall (the camera inside the thick one at 6.95 s), never on way 4 or with
  // reduced motion, and none while the camera closes in on the paper (they start on its first close key)
  assert.ok(fallVeils(6.95, 1280, 720, "continue", false).length > 0);
  assert.equal(fallVeils(6.95, 1280, 720, "bottom", false).length, 0);
  assert.equal(fallVeils(6.95, 1280, 720, "continue", true).length, 0);
  for (const T of [1.2, 1.35, 1.5]) assert.equal(fallVeils(T, 1920, 1080, "continue", false).length, 0, `a fog layer while it closes in at ${T}`);
  // (fall r3, W2-2) the thick passage rises past on the camera's fall (300-600 px per 0.4 s), leaving by the frame's top
  const thick = (T) => fallVeils(T, 1920, 1080, "continue", false).find((v) => v.alpha === 1);
  const a0 = thick(6.95), a1 = thick(7.35);
  assert.ok(a0 && a1 && a0.cy - a1.cy >= 300 && a0.cy - a1.cy <= 600, `thick fog travel ${a0 && a1 ? a0.cy - a1.cy : "none"}`);
  assert.equal(thick(8.6), undefined, "the thick fog has left the frame by 8.6");
});

test("the fall's sky: deep while high, eased into the place's own sky under the deck, gone by the break-out", () => {
  assert.equal(fallSkyShare(32), 1);
  assert.equal(fallSkyShare(18), 1);
  assert.equal(fallSkyShare(8), 0);
  assert.equal(fallSkyShare(5), 0);
  for (let l = 8; l < 18; l += 0.5) assert.ok(fallSkyShare(l + 0.5) >= fallSkyShare(l), "never shallower going up");
  const top = [0.47, 0.66, 0.81], mid = [0.84, 0.9, 0.88], low = [0.93, 0.96, 0.93];
  const hi = fallSkyOf(32, 1500, top, mid, low, [0, 0, 0], [280, 0.5, 0], [1, 1, 1]);
  const lo = fallSkyOf(7, 900, top, mid, low, [0, 0, 0], [280, 0.5, 0], [1, 1, 1]);
  // high up the zenith is the deep cobalt of Dex's sky ref, far deeper than the morning's
  assert.ok(hi.cols[3 + 2] < 0.75 && hi.cols[3] < 0.1, `deep overhead: ${[...hi.cols.slice(3, 6)].map((v) => v.toFixed(2))}`);
  // under the deck the stops are the place's own sky (nothing drawn: share 0)
  assert.equal(lo.share, 0);
  for (let i = 0; i < 3; i++) near(lo.cols[3 + i], top[i] + (mid[i] - top[i]) * (1 - Math.pow(Math.min(1, 1.3 / 0.95), 0.62)), 1e-6, "the place's zenith");
});

test("small pieces: the monotone curve never overshoots, mixShot in log space, a pin by the frame's width, the bars", () => {
  for (let t = 0; t <= 4; t += 0.05) {
    const v = monotone([0, 1, 2, 3, 4], [0, 1, 1, 5, 5], t);
    assert.ok(v >= -1e-9 && v <= 5 + 1e-9, `overshoot at ${t}`);
    if (t >= 1 && t <= 2) near(v, 1, 1e-9, "flat between equal keys");
  }
  const m = mixShot({ zoom: 0.5, anchor: 0, horizon: 0, cx: 0 }, { zoom: 2, anchor: 1, horizon: 1, cx: 10 }, 0.5);
  near(m.zoom, 1, 1e-9, "log midpoint");
  assert.equal(centreOf({ zoom: 0.5, anchor: 0, horizon: 0, lead: 0, fixX: null, pin: { x: 1000, at: 0.75 } }, 0, 800), 1000 - 0.25 * 1600);
  assert.equal(barsAt(0), 0);
  assert.deepEqual([0.05, 0.15, 0.25, 0.35].map((T) => barsAt(T)), [1 / 3, 2 / 3, 1, 1]);
  assert.equal(barsAt(BEATS.her.drop1 - 0.01), 1);
  assert.equal(barsAt(BEATS.her.drop1 + 0.1), 0.5);
  assert.equal(barsAt(BEATS.her.drop1 + 0.3), 0);
  assert.equal(barsAt(12.65, false, 12.609), 1 / 3, "way 4's bars from its own start");
  assert.equal(barsAt(12.95, false, 12.609), 1);
  near(beatAt(20), (BEATS.bars[10] - BEATS.bars[9]) / 4, 1e-9, "a beat (bar 9)");
  assert.equal(nextBarLine(28.4), BEATS.bars[14]);
});

/** A fake context whose output stamp lags currentTime by `inStamp` s and whose stated latency is base + output. */
function fakeCtx({ base = 0.01, output = 0.03, inStamp = 0, stamp = true } = {}) {
  const c = { t: 10, p: 1000, state: "running", baseLatency: base, outputLatency: output, sampleRate: 48000 };
  return {
    c,
    get currentTime() { return c.t; },
    get state() { return c.state; },
    get baseLatency() { return c.baseLatency; },
    get outputLatency() { return c.outputLatency; },
    getOutputTimestamp: stamp ? () => ({ contextTime: c.t - inStamp, performanceTime: c.p }) : undefined,
    advance(ms) { c.t += ms / 1000; c.p += ms; },
  };
}

test("the heard clock: only the latency the output stamp is missing is subtracted, never twice", () => {
  for (const inStamp of [0, 0.02, 0.04, 0.1]) {
    const ctx = fakeCtx({ inStamp });
    const clock = new HeardClock(ctx, () => ctx.c.p);
    clock.anchor(10, 0);
    for (let i = 0; i < 30; i++) { ctx.advance(16); clock.T(); }
    const L = 0.04;
    const expect = (ctx.c.t - 10) - Math.max(inStamp, L);
    near(clock.T(), expect, 0.002, `stamp already ${inStamp * 1000} ms behind`);
  }
  // no output stamp: currentTime minus the whole stated latency
  const ctx = fakeCtx({ stamp: false });
  const clock = new HeardClock(ctx, () => ctx.c.p);
  clock.anchor(10, 0);
  for (let i = 0; i < 10; i++) { ctx.advance(16); clock.T(); }
  near(clock.T(), ctx.c.t - 10 - 0.04, 0.002, "no stamp");
});

test("the heard clock: smooth (at most 1 ms a frame), re-anchors past 50 ms, holds while suspended, never backwards", () => {
  const ctx = fakeCtx({ inStamp: 0.04 });
  let p = 1000;
  const clock = new HeardClock(ctx, () => p);
  clock.anchor(10, 0);
  const step = (ms, ctxMs = ms) => { p += ms; ctx.c.p = p; ctx.c.t += ctxMs / 1000; return clock.T(); };
  let prev = step(16);
  for (let i = 0; i < 20; i++) prev = step(16);
  // the audio clock drifts 0.5 ms a frame slower than the page's: the picture follows by at most 1 ms a frame
  for (let i = 0; i < 20; i++) {
    const v = step(16, 15.5);
    assert.ok(v - prev <= 0.016 + 1e-9 && v - prev >= 0.016 - 0.001 - 1e-9, `nudged ${(v - prev - 0.016) * 1000} ms`);
    prev = v;
  }
  // a seek: re-anchored at once, and T jumps (the only time it may go anywhere but forward)
  ctx.c.t += 0.2;
  clock.anchor(ctx.c.t - 0.05, 27.49);
  const after = step(16);
  near(after, 27.49 + 0.05 + 0.016 - 0.04, 0.003, "after the seek");
  // suspended: T holds; resumed: it re-anchors and carries on
  ctx.c.state = "suspended";
  const held = step(16, 0);
  for (let i = 0; i < 10; i++) assert.equal(step(16, 0), held);
  ctx.c.state = "running";
  const back = step(16);
  near(back, held + 0.016, 0.003, "resumes where it held");
  // never backwards on its own
  let last = back;
  for (let i = 0; i < 50; i++) {
    const v = step(16, 16 - (i % 2) * 8);
    assert.ok(v >= last, "backwards");
    last = v;
  }
  near(onGrid(1.00001, 48000) * 48000 % 1, 0, 1e-6, "on the sample grid");
  assert.ok(onGrid(1.00001, 48000) >= 1.00001);
});

test("the page clock stands in without music, and pauses", () => {
  let p = 0;
  const clock = new HeardClock(null, () => p);
  clock.usePage(0);
  p = 500;
  near(clock.T(), 0.5, 1e-9, "page clock");
  clock.pausePage(true);
  p = 900;
  near(clock.T(), 0.5, 1e-9, "paused");
  clock.pausePage(false);
  p = 1000;
  near(clock.T(), 0.6, 1e-9, "resumed");
});

test("continue: a click on the letter pokes, the 300 ms guard, a press from before never counts, Space and Enter only, never on another control", () => {
  const base = { ready: true, readyAt: 1000, guardMs: 300, onStage: false, onOtherControl: false };
  assert.equal(pressContinues({ ...base, downAt: 1400 }), true);
  assert.equal(pressContinues({ ...base, downAt: 1400, onStage: true }), false, "the letter pokes");
  assert.equal(pressContinues({ ...base, downAt: 1200 }), false, "inside the guard");
  assert.equal(pressContinues({ ...base, downAt: 900 }), false, "began before the button");
  assert.equal(pressContinues({ ...base, ready: false, downAt: 1400 }), false, "not ready");
  assert.equal(pressContinues({ ...base, downAt: 1400, key: "Enter" }), true);
  assert.equal(pressContinues({ ...base, downAt: 1400, key: " " }), true);
  assert.equal(pressContinues({ ...base, downAt: 1400, key: "Escape" }), false, "Esc never starts it");
  assert.equal(pressContinues({ ...base, downAt: 1400, key: "Enter", repeat: true }), false, "auto-repeat");
  assert.equal(pressContinues({ ...base, downAt: 1400, key: "Enter", onOtherControl: true }), false, "the skip link's Enter");
});


test("the effects are scheduled ahead on the context's clock, through any output delay (must-fix 3)", () => {
  for (const latency of [0.01, 0.06, 0.3, 0.45]) {
    const ctx = { state: "running", currentTime: 10 };
    const t0 = 10.05;
    const calls = [];
    const host = {
      herX: () => 86.4 * H, moveTo() {}, pose() {}, touchedSince: () => false, inputTick: () => 0, release() {}, title() {}, titleAt() {},
      sfx: (id, at) => calls.push({ id, at, now: ctx.currentTime }), sfxCancel() {}, bed() {},
      framing: () => world(), frameW: () => 1280, frameH: () => 720, cut() {}, cine() {},
    };
    const link = {
      T: () => ctx.currentTime - t0 - latency, epoch: 0, reduced: false, repeat: false, music: true,
      ctxTimeOf: (T) => t0 + T, skip: () => false, input() {}, ctx,
    };
    const o = new Opening(host);
    o.start(link);
    while (ctx.currentTime < t0 + 36 + latency) {
      ctx.currentTime += 1 / 60;
      o.tick();
    }
    assert.equal(calls.length, BEATS.sfx.length, `latency ${latency}: every cue asked for once`);
    for (const c of BEATS.sfx) {
      const call = calls.find((k) => k.id === c.id);
      if (c.T === 0) continue; // the press's own gust: at once if the first tick is late
      near(call.at, t0 + c.T, 1e-9, `latency ${latency}: ${c.id} on its beat on the context's clock`);
      assert.ok(call.at - call.now >= 0.2, `latency ${latency}: ${c.id} asked for ${(call.at - call.now).toFixed(3)} s ahead`);
    }
  }
});

test("a late take still plays, that far into it; a late drum hit is still dropped (the speech, Dex 10-20)", async () => {
  const { startOf, CUES } = await import("./sound.ts");
  const k = BEATS.sfx.find((c) => c.id === "op.speech");
  assert.ok(CUES[k.id].exact && CUES[k.id].files[0] === k.file.replace(/^\/audio\//, ""), "the chart's take is the exact cue's file");
  // the rule in the opening: the take is booked on its (past) moment; an effect 0.3 s late is dropped
  for (const late of [0.5, 3]) assert.equal(cueAction(100 + late, 100, k.T, 0.27, k.len), "book", `take late ${late} s`);
  assert.equal(cueAction(100 + k.len + 0.01, 100, k.T, 0.27, k.len), "drop", "the take over");
  assert.equal(cueAction(100.3, 100, 4.631, 0.27), "drop", "a drum hit 0.3 s late");
  assert.equal(cueAction(100.1, 100, 0, 0.27), "now", "the press's gust a little late");
  assert.equal(cueAction(99.5, 100, 4.631, 0.27), "wait");
  // the rule in the sound engine: a take starts that far into the file; a booked hit late 0.3 s does not play
  for (const late of [0.5, 3]) assert.deepEqual(startOf(100, 100 + late, true, { len: k.len, rate: 1 }), { t: 100 + late, offset: late }, `take late ${late} s`);
  assert.deepEqual(startOf(100, 99.8, true, { len: k.len, rate: 1 }), { t: 100, offset: 0 }, "on time");
  assert.equal(startOf(100, 100 + k.len + 0.01, true, { len: k.len, rate: 1 }), null, "past its end");
  assert.equal(startOf(100, 100.3, true, null), null, "a drum hit late 0.3 s");
  assert.deepEqual(startOf(100, 100.03, true, null), { t: 100.03, offset: 0 }, "a hit a moment late");

  // through the opening: the first ticks after the press stall past the take's moment (the plates streaming)
  const run = (stall, opts = {}) => {
    const ctx = { state: "running", currentTime: 10 };
    const t0 = 10.05, calls = [];
    const host = {
      herX: () => 86.4 * H, moveTo() {}, pose() {}, touchedSince: () => false, inputTick: () => 0, release() {}, title() {}, titleAt() {},
      sfx: (id, at) => calls.push({ id, at, now: ctx.currentTime }), sfxCancel() {}, bed() {},
      framing: () => world(), frameW: () => 1280, frameH: () => 720, cut() {}, cine() {},
    };
    const from = opts.from ?? 0;
    const link = {
      T: () => from + ctx.currentTime - t0, epoch: 0, reduced: false, repeat: false, music: true, way: opts.way,
      ctxTimeOf: (T) => t0 + T - from, skip: () => false, input() {}, ctx,
    };
    const o = new Opening(host);
    if (opts.from) ctx.currentTime = t0;
    o.start(link);
    ctx.currentTime = t0 - from + k.T + stall;
    o.tick();
    return { calls, t0: t0 - from, ctx, o };
  };
  for (const stall of [0.5, 3]) {
    const { calls, t0 } = run(stall);
    const sp = calls.filter((c) => c.id === k.id);
    assert.equal(sp.length, 1, `stall ${stall}: the speech asked for`);
    near(sp[0].at, t0 + k.T, 1e-9, `stall ${stall}: booked on its moment (${stall} s ago: the engine starts it ${stall} s in)`);
  }
  {
    // a drum hit whose first tick comes 0.3 s late is still dropped
    const { calls, t0, ctx, o } = run(0);
    const f = BEATS.sfx.find((c) => c.id === "op.paper-flutter");
    ctx.currentTime = t0 + f.T + 0.3;
    o.tick();
    assert.ok(!calls.some((c) => c.id === f.id), "the flutter 0.3 s late: dropped");
  }
  {
    // started past the take's moment (a resumed or later start): the take, that far in; the earlier hits stay past
    const { calls, t0 } = run(0, { from: 10 });
    assert.deepEqual(calls.map((c) => c.id), [k.id], "only the take");
    near(calls[0].at, t0 + k.T, 1e-9, "on its moment (10 s in)");
    assert.equal(run(0, { from: 26 }).calls.length, 0, "past its end: nothing");
  }
  {
    // the page clock with a running context (Track 1 failed, or the context woke without the sound chip): placed on T
    const ctx = { state: "running", currentTime: 50 }, calls = [];
    let T = -0.05;
    const host = {
      herX: () => 86.4 * H, moveTo() {}, pose() {}, touchedSince: () => false, inputTick: () => 0, release() {}, title() {}, titleAt() {},
      sfx: (id, at) => calls.push({ id, at, now: ctx.currentTime }), sfxCancel() {}, bed() {},
      framing: () => world(), frameW: () => 1280, frameH: () => 720, cut() {}, cine() {},
    };
    const o = new Opening(host);
    o.start({ T: () => T, epoch: 0, reduced: false, repeat: false, music: false, ctxTimeOf: () => null, skip: () => false, input() {}, ctx });
    T = k.T + 2;
    ctx.currentTime += 2.35;
    o.tick();
    const sp = calls.filter((c) => c.id === k.id);
    assert.equal(sp.length, 1, "page clock: the speech asked for");
    near(sp[0].at, ctx.currentTime - 2, 1e-9, "page clock: on its moment by T (2 s in)");
  }
  // way 4 (the jetty, bar 6): no speech (Dex 10-19)
  assert.equal(run(0, { from: startT("bottom"), way: "bottom" }).calls.filter((c) => c.id === k.id).length, 0, "way 4: no speech");
});

test("the plate store keeps the opening's tiles until the camera is past them (must-fix 1)", () => {
  const store = new TileStore({ layers: 3, upload() {} }, { sync: true });
  const px = new Uint8Array(1);
  const put = (k, onScreen = false) => {
    const [id, lv, tx, ty] = k.split("|");
    if (onScreen) store.get(id, Number(lv), Number(tx), Number(ty), 0);
    else store.want(id, Number(lv), Number(tx), Number(ty), 30);
    store.finish(k, px, 0);
  };
  const A = "play|1|0|0", B = "play|1|1|0", C = "play|1|2|0";
  store.keepT = 5;
  store.keep(A, 10, 20);
  store.keep(B, 6, 8);
  store.keep(C, 30, 40);
  [A, B, C].forEach((k) => put(k));
  store.frame += 2;
  // a margin tile asked ahead may not take a kept tile's place
  put("play|1|9|9");
  assert.equal(store.layerOf("play|1|9|9"), undefined);
  assert.ok([A, B, C].every((k) => store.layerOf(k) >= 0), "every kept tile still there");
  // a tile on screen now takes the one kept for latest (TESU's at 30 before the walk's at 10)
  put("play|1|5|5", true);
  assert.equal(store.layerOf(C), undefined, "the latest kept tile gave way");
  assert.ok(store.layerOf(A) >= 0 && store.layerOf(B) >= 0);
  // past its span a kept tile is like any other (least recently used first)
  store.keepT = 9;
  store.frame += 2;
  put("play|1|7|7");
  assert.equal(store.layerOf(B), undefined, "B (needed to T 8) went at T 9");
  assert.ok(store.layerOf(A) >= 0, "A (needed from T 10) stays");
  store.clearKeep();
  assert.equal(store.keptLayers(), 0);
});

test("rev 5, the ofuda's two jobs: the hat paper's own colours with no line art or lettering, steered onto the clip's paper at the hand-off", async () => {
  const { STRIP, WorldPaper } = await import("./opening/paper.ts");
  const { COLORS, OFUDA_TEXTURE, EDGE_INDEX } = await import("../site/motion/pixel-loader.ts");
  // (a) its colours: the hat ofuda's own (the loader's exact crop) plus the clip paper's deep gold and cream, nothing else;
  // no dark edge colour anywhere (no line art), no lettering (no ink or red)
  const hat = new Set([...OFUDA_TEXTURE.front].filter(Boolean).map((c) => COLORS[c].join()));
  const extra = new Set(["157,108,54", "243,198,145"]);
  for (const c of STRIP.front) if (c) assert.ok(hat.has(COLORS[c].join()) || extra.has(COLORS[c].join()), `strip colour ${COLORS[c]}`);
  assert.ok(![...STRIP.front, ...OFUDA_TEXTURE.front].includes(EDGE_INDEX), "no line art");
  assert.equal(STRIP.w, 5);
  assert.equal(STRIP.h, 20);
  // (b) the hand-off: the band is the clip paper measured in f001 (12 nodes about its centre), and in the fall's last tick
  // the world's paper lies exactly on it, flat to the eye
  const band = BEATS.her.clip.band;
  assert.equal(band.length, 12);
  const mid = band.reduce((a, n) => [a[0] + n[0] / 12, a[1] + n[1] / 12], [0, 0]);
  near(mid[0], BEATS.her.clip.handoff[0], 0.6, "the band about the hand-off point (x)");
  near(mid[1], BEATS.her.clip.handoff[1], 0.6, "the band about the hand-off point (y)");
  const wp = new WorldPaper(0.66);
  wp.startFall();
  for (let i = 0; i < 200; i++) wp.fall(0, 0, { x: -18, gust: 0.5 });
  wp.toWhole();
  const nodes = band.map((n) => [100 + n[0] * 0.66, 200 + n[1] * 0.66]);
  const pose = wp.fall(100 + BEATS.her.clip.handoff[0] * 0.66, 200 + BEATS.her.clip.handoff[1] * 0.66, { x: -18, gust: 0.5 }, 1 / 60, { nodes, u: 1 });
  pose.pts.forEach((q, i) => { near(q[0], nodes[i][0], 1e-9); near(q[1], nodes[i][1], 1e-9); near(q[2], 0, 1e-9); });
  assert.equal(pose.tex, STRIP, "the whole paper by then");
  // the clip paper's grain over the last 0.3 s: the same colours, a few flecks; texel by texel
  const { STRIP_CLIP } = await import("./opening/paper.ts");
  for (const c of STRIP_CLIP.front) if (c) assert.ok(hat.has(COLORS[c].join()) || extra.has(COLORS[c].join()), `grain colour ${COLORS[c]}`);
  const differ = [...STRIP.front].filter((c, i) => c !== STRIP_CLIP.front[i]).length;
  assert.ok(differ > 5 && differ < 20, `subtle: ${differ} of 100 texels`);
  const g = wp.fall(0, 0, { x: -18, gust: 0.5 }, 1 / 60, { nodes, u: 1, grain: 0.5 });
  assert.equal(g.into?.to, STRIP_CLIP);
  // it turns into the whole paper as it drops out of the black, before the lens has it big
  const of = BEATS.ofuda;
  assert.ok(of.stripAt >= 0.3 && of.stripAt + of.stripFor <= of.lens.keys[1][0], "the turn: in the drop, before the lens");
});

test("the lens (Dex 10-20: following the ofuda closely): the page's size at the press, near the lens the whole way down, her drawing's size at the hand-off", async () => {
  const { WorldPaper, STRIP } = await import("./opening/paper.ts");
  const { OFUDA_TEXTURE } = await import("../site/motion/pixel-loader.ts");
  assert.equal(paperLensAt(0), 0, "the press: the page's own size");
  assert.equal(paperLensAt(0.3), 0);
  for (let T = 1.2; T < 15; T += 0.1) assert.equal(paperLensAt(T), 1, `near the lens at ${T.toFixed(1)}`);
  // off the lens before the grain and the last of the steer: the drawing takes over a paper at its own size
  assert.equal(paperLensAt(HANDOFF_T - 0.3), 0);
  for (let T = 12; T < 18; T += 0.5) assert.equal(paperLensAt(T, "bottom"), 0, "way 4: never");
  // drawn near the lens: lens.h frame px long, as square blocks of frame px on its own grid
  const wp = new WorldPaper(0.66);
  wp.startFall();
  wp.toWhole();
  wp.turn(1);
  for (let i = 0; i < 30; i++) wp.fall(0, 0, { x: 0, gust: 0 });
  const pose = wp.fall(0, 0, { x: 0, gust: 0 });
  // flat and upright for the measure
  pose.pts.forEach((q, i) => { q[0] = (i % 2 ? 1 : -1) * 2.5 * 0.66; q[1] = (Math.floor(i / 2) * 4 - 10) * 0.66; q[2] = 0; });
  const sizes = new Set();
  let y0 = Infinity, y1 = -Infinity;
  WorldPaper.draw(pose, (x, y) => [x * 2 + 640, y * 2 + 360], null, false, (x, y, c, s) => { sizes.add(s); y0 = Math.min(y0, y); y1 = Math.max(y1, y + s); }, { h: 200, w: 1 });
  assert.equal(sizes.size, 1);
  const B = [...sizes][0];
  near(B, Math.floor(200 / STRIP.h), 0, "an art px is a block of whole frame px");
  near(y1 - y0, 200, B + 1, "lens.h long");
  // and at w = 0, its own size (a frame px at a time)
  sizes.clear();
  WorldPaper.draw(pose, (x, y) => [x * 2 + 640, y * 2 + 360], null, false, (x, y, c, s) => sizes.add(s), { h: 200, w: 0 });
  assert.deepEqual([...sizes], [1]);
  // the turn from the loader's paper: at its start exactly the loader's look, at its end the whole paper's
  const t = new WorldPaper(0.66);
  t.startFall();
  for (let i = 0; i < 20; i++) t.fall(0, 0, { x: -18, gust: 0.5 });
  t.toWhole();
  t.turn(0);
  const a = t.fall(0, 0, { x: -18, gust: 0.5 });
  assert.equal(a.into?.to, OFUDA_TEXTURE);
  near(a.into.share, 1, 1e-9, "all the loader's texels");
  t.turn(1);
  const b = t.fall(0, 0, { x: -18, gust: 0.5 });
  assert.equal(b.tex, STRIP);
  assert.equal(b.into, undefined, "the whole paper");
});

test("the hand-off: the paper turns the clip paper's way before the steer, so it never folds one end through the other", async () => {
  const { WorldPaper } = await import("./opening/paper.ts");
  const band = BEATS.her.clip.band.map((n) => [100 + n[0] * 0.66, 200 + n[1] * 0.66]);
  const len = (P) => Math.hypot(P[10][0] + P[11][0] - P[0][0] - P[1][0], P[10][1] + P[11][1] - P[0][1] - P[1][1]) / 2;
  const L = len(band);
  // a paper lying the other way round from the clip's (its tie where the clip's tip is)
  const d = [band[10][0] + band[11][0] - band[0][0] - band[1][0], band[10][1] + band[11][1] - band[0][1] - band[1][1]];
  const dl = Math.hypot(d[0], d[1]), sn = d[0] / dl, cs = -d[1] / dl;
  const nodes = [];
  for (let r = 0; r <= 5; r++) for (let c = 0; c < 2; c++) {
    const x = c ? 3.5 : -3.5, y = (r * 13) / 5;
    nodes.push(x * cs - y * sn, x * sn + y * cs, 0);
  }
  const mx = band.reduce((s, n) => s + n[0] / 12, 0), my = band.reduce((s, n) => s + n[1] / 12, 0);
  const steered = (turn) => {
    const wp = new WorldPaper(0.66);
    wp.startFall(nodes);
    wp.toWhole();
    wp.turn(1);
    return wp.fall(mx, my, { x: 0, gust: 0 }, 1 / 60, { nodes: band, u: 0.5, turn });
  };
  assert.ok(len(steered(0).pts) < 0.3 * L, "(without the turn it would fold through its middle)");
  assert.ok(len(steered(1).pts) > 0.8 * L, `turned first, no fold: ${len(steered(1).pts).toFixed(1)} of ${L.toFixed(1)}`);
  assert.ok(BEATS.ofuda.turn > BEATS.ofuda.steer, "it turns before (and through) the steer");
});

test("rev 5, the black: the slab above everything, the paper hanging where the loader left it, the camera out of it on bar 0", () => {
  const C = BEATS.ceiling.altH;
  assert.ok(C > 40, "the slab far above the world");
  const k0 = BEATS.camera.keys[0];
  assert.equal(k0.zoom, 0, "at the page's own scale");
  assert.ok(k0.alt > C, "the frame starts inside the black");
  const plunged = BEATS.camera.keys.find((k) => Math.abs(k.T - BEATS.bars[0]) < 0.01);
  assert.ok(plunged && plunged.alt < C, "out of it on bar 0");
});

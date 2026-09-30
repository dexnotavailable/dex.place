"""Finite CPU source checks. No image/GPU/browser/app/native rendering."""
import json
import math
from pathlib import Path
import unittest

from n1_n2_fx import (CAPS, CLIPS, PALETTE, Contact, LiturgyFX, Strike,
                      beat_cues, hit_boxes, raster_bounds)
from raster_adapter import primitive_bounds, validate_mask_bytes


def bounds(points):
    return min(p[0] for p in points), max(p[0] for p in points)


class PhraseChecks(unittest.TestCase):
    def test_exact_width_and_mirror(self):
        for clip in CLIPS:
            b = hit_boxes(clip)
            lo, hi = min(x for x, y, w, h in b), max(x+w for x, y, w, h in b)
            self.assertAlmostEqual(hi-lo, 2.5)
            for px in (80, 144):
                self.assertAlmostEqual((hi-lo)*px, 200 if px == 80 else 360)
            self.assertEqual(hit_boxes(clip, facing=-1),
                             [(-x-w, y, w, h) for x, y, w, h in b])
            for box in b:
                r = raster_bounds(box, 80)
                self.assertLessEqual(r[0], box[0]*80)
                self.assertGreaterEqual(r[2], (box[0]+box[2])*80)

    def test_full_fill_and_ground_widths(self):
        for clip, expected in (("m1_1", 2.5), ("m1_2", 2.6)):
            fx = LiturgyFX()
            fx.emit_strike(Strike("a", clip, 7, (0, 0)))
            scene = fx.sample(7)
            body = [p for c in scene["commands"] if c["tag"].endswith("full-body")
                    for p in c["points"]]
            lo, hi = bounds(body)
            self.assertAlmostEqual(hi-lo, expected)
            dust = [p for c in scene["commands"] if c["tag"] == "ground-dust-2.9H"
                    for p in c["points"]]
            lo, hi = bounds(dust)
            self.assertAlmostEqual(hi-lo, 2.9)
            self.assertTrue(all(c["kind"] == "polygon" for c in scene["commands"]
                                if c["tag"].endswith("full-body")))
            if clip == "m1_1":
                furrow = [p for c in scene["commands"] if c["tag"] == "glass-furrow"
                          for p in c["points"]]
                a, b = bounds(furrow)
                self.assertAlmostEqual(b-a, 150/96)

    def test_decay_and_furrow_stage_ticks(self):
        fx = LiturgyFX()
        fx.emit_strike(Strike("n1", "m1_1", 0, (0, 0)))
        self.assertTrue(any("full-body" in c["tag"] for c in fx.sample(0)["commands"]))
        self.assertTrue(any("glass-leading" == c["tag"] for c in fx.sample(1)["commands"]))
        self.assertTrue(any("glass-shard" == c["tag"] for c in fx.sample(7)["commands"]))
        self.assertTrue(any("glass-furrow" == c["tag"] for c in fx.sample(12)["commands"]))
        self.assertTrue(any("furrow-shard" == c["tag"] for c in fx.sample(13)["commands"]))
        self.assertFalse(any(c["tag"] == "glass-shard" for c in fx.sample(17)["commands"]))
        self.assertEqual(fx.sample(25)["commands"], [])

    def test_contact_whiff_early_hold_and_group_dedup(self):
        fx = LiturgyFX()
        fx.emit_strike(Strike("a", "m1_1", 7, (0, 0)))
        self.assertFalse(any("contact" in c["tag"] for c in fx.sample(7)["commands"]))
        cue = fx.emit_contact(Contact("a", "m1_1", 8, "left", (-.8, -.3), 8))
        self.assertEqual(len(cue), 2)
        self.assertEqual(fx.emit_contact(Contact("a", "m1_1", 8, "left", (-.8, -.3), 8)), [])
        # Later target while actor frame8 stays frozen: wall age is already4.
        self.assertEqual(fx.emit_contact(Contact("a", "m1_1", 11, "right", (.8, -.3), 8)), [])
        self.assertEqual(len(fx.panes), 1)
        self.assertEqual(len(fx.contacts), 2)
        self.assertTrue(any(c["tag"] == "actual-contact-star" for c in fx.sample(11)["commands"]))
        with self.assertRaises(ValueError):
            fx.emit_contact(Contact("a", "m1_1", 12, "bad", (0, 0), 11))

    def test_wall_clock_progress_and_carry(self):
        fx = LiturgyFX()
        fx.emit_strike(Strike("n1", "m1_1", 7, (0, 0)))
        fx.sample(7)
        fx.emit_contact(Contact("n1", "m1_1", 8, "enemy", (.9, -.4), 9))
        # No new actor event during freeze; geometry still progresses on wall ticks.
        before = fx.sample(8)
        after = fx.sample(10)
        self.assertNotEqual(before["commands"], after["commands"])
        fx.emit_strike(Strike("n2", "m1_2", 24, (12/96, 0)))
        scene = fx.sample(24)
        self.assertTrue(any("m1_2-full" in c["tag"] for c in scene["commands"]))
        self.assertTrue(any(c["tag"] == "contact-pane" for c in scene["commands"]))
        self.assertEqual(scene["damage"], [])
        self.assertFalse(scene["fullscreen_flash"])

    def test_reduced_motion_flash_and_live_anchor(self):
        fx = LiturgyFX()
        fx.emit_strike(Strike("n2", "m1_2", 0, (0, 0)))
        fx.emit_contact(Contact("n2", "m1_2", 0, "target", (1, -.5), 7))
        scene = fx.sample(0, reduced_motion=True, reduce_flashing=True, live_tip_h=(-1, -.5),
                          active_instance="n2", active_root_h=(0, 0), active_actor_frame=7)
        self.assertFalse(any(c["tag"] in ("contact-shard", "gold-sliver", "rising-mote")
                             or c["color"] == "A5" for c in scene["commands"]))
        self.assertEqual(scene["lights"][0]["point_h"], (-1, -.5))
        self.assertEqual(scene["lights"][0]["anchor_source"], "live-tip")
        self.assertEqual(scene["lights"][0]["pass"], "back")
        self.assertEqual(fx.sample(1, live_tip_h=(1, -.5), active_instance="n2",
                         active_root_h=(0, 0), active_actor_frame=8)["lights"][0]["pass"], "front")

    def test_contact_pane_uses_contact_time_world_tip(self):
        fx = LiturgyFX()
        fx.emit_strike(Strike("a", "m1_1", 0, (.1, 0), tip_h=(.4, -.4)))
        fx.emit_contact(Contact("a", "m1_1", 1, "target", (.8, -.5), 9, (1.8, -1.4)))
        anchor = fx.sample(1)["pane_anchors"][0]
        self.assertEqual(anchor["point_h"], (1.8, -1.4))
        self.assertEqual(anchor["source"], "actual-contact-tip")

    def test_early_frozen_s1_keeps_rear_rim_pass(self):
        fx = LiturgyFX()
        fx.emit_strike(Strike("a", "m1_2", 0, (0, 0)))
        fx.emit_contact(Contact("a", "m1_2", 0, "enemy", (1, -.4), 7))
        for tick in range(4):
            scene = fx.sample(tick, active_instance="a", active_root_h=(0, 0),
                              active_actor_frame=7, live_tip_h=(-1, -.5))
            self.assertEqual(scene["lights"][0]["pass"], "back")
        scene = fx.sample(4, active_instance="a", active_root_h=(0, 0), active_actor_frame=8)
        self.assertEqual(scene["lights"][0]["pass"], "front")
        scene = fx.sample(5, active_instance="a", active_root_h=(0, 0), active_actor_frame=8,
                          live_tip_depth="back")
        self.assertEqual(scene["lights"][0]["pass"], "back")

    def test_sliver_life_colors_and_n2_outside_halves(self):
        for clip in CLIPS:
            fx = LiturgyFX()
            fx.emit_strike(Strike("a", clip, 0, (0, 0)))
            for age in range(5):
                slivers = [c for c in fx.sample(age)["commands"] if c["tag"] == "gold-sliver"]
                self.assertEqual(len(slivers), 2)
                if clip == "m1_1":
                    self.assertEqual({c["color"] for c in slivers}, {"G1", "G2"})
                else:
                    ys = [p[1] for c in slivers for p in c["points"]]
                    self.assertAlmostEqual(max(ys)-min(ys), .65)
                    self.assertEqual({c["layer"] for c in slivers}, {"front", "back"})
            self.assertFalse(any(c["tag"] == "gold-sliver" for c in fx.sample(5)["commands"]))

    def test_nearest_two_pane_lights_with_and_without_tip(self):
        fx = LiturgyFX()
        for i, distance in enumerate((10, 2, .1)):
            ident, tick = str(i), i*3
            fx.emit_strike(Strike(ident, "m1_1", tick, (0, 0)))
            fx.emit_contact(Contact(ident, "m1_1", tick, "target", (1, -.4), 8, (distance, 0)))
        scene = fx.sample(6, actor_root_h=(0, 0))
        self.assertEqual([l["point_h"] for l in scene["lights"] if l["kind"] == "pane"], [(.1, 0), (2, 0)])
        scene = fx.sample(25, actor_root_h=(0, 0))
        self.assertEqual(len(scene["lights"]), 2)
        scene = fx.sample(26, actor_root_h=(10, 0))
        self.assertEqual([l["point_h"] for l in scene["lights"]], [(10, 0), (2, 0)])

    def test_native_mask_validation_rejects_missing_body_and_rgba(self):
        validate_mask_bytes(bytes((255, 255, 0)), bytes((255, 255, 0)), bytes((255, 0, 0)))
        with self.assertRaises(ValueError):
            validate_mask_bytes(bytes((255, 255, 0)), bytes((255, 0, 0)), bytes((255, 0, 0)))
        with self.assertRaises(ValueError):
            validate_mask_bytes(bytes((255,)), bytes((255,)), bytes((255,)), body_mode="RGBA")
        with self.assertRaises(ValueError):
            validate_mask_bytes(bytes((255,)), bytes((255,)), bytes((128,)))

    def test_stroke_clipping_includes_thickness(self):
        left, top, right, bottom = primitive_bounds([(1, 2), (1, 6)], stroke_width=4)
        self.assertLess(left, 0)
        self.assertEqual(primitive_bounds([(1, 2), (1, 6)]), (1, 2, 1, 6))

    def test_caps_expiry_determinism_and_palette(self):
        def populate():
            fx = LiturgyFX()
            peak_commands = peak_points = 0
            for t in range(0, 180):
                if t % 10 == 0:
                    ident = f"hit-{t}"
                    fx.emit_strike(Strike(ident, "m1_1", t, (0, 0)))
                    for enemy in range(8):
                        fx.emit_contact(Contact(ident, "m1_1", t, str(enemy), (.8, -.4), 8))
                scene = fx.sample(t)
                peak_commands = max(peak_commands, scene["budget"]["commands"])
                peak_points = max(peak_points, scene["budget"]["points"])
                self.assertLessEqual(scene["budget"]["commands"], CAPS["commands"])
                self.assertLessEqual(scene["budget"]["points"], CAPS["points"])
                self.assertLessEqual(len(scene["lights"]), CAPS["lights"])
                self.assertLessEqual(len(fx.panes), CAPS["panes"])
                self.assertLessEqual(len(fx.retiring_panes), 2)
                for c in scene["commands"]:
                    self.assertIn(c["color"], PALETTE)
                    self.assertTrue(all(math.isfinite(v) for p in c["points"] for v in p))
                    if c["color"] == "A0":
                        self.assertIn("leading", c["tag"])
            empty = fx.sample(400)
            self.assertEqual(empty["commands"], [])
            self.assertEqual(empty["lights"], [])
            return scene, {"stress_peak_commands": peak_commands, "stress_peak_points": peak_points}
        self.assertEqual(populate(), populate())

    def test_actor_beat_cues_do_not_depend_on_contact(self):
        self.assertEqual(len(beat_cues("m1_1", 7)), 2)
        self.assertEqual(beat_cues("m1_1", 8), [])
        self.assertEqual(beat_cues("m1_2", 7)[0]["id"], "blade.swish.low")
        self.assertEqual(beat_cues("m1_2", 8)[0]["id"], "blade.swish.high")

    def test_monotonic_validation(self):
        fx = LiturgyFX()
        fx.sample(10)
        with self.assertRaises(ValueError):
            fx.sample(9)
        with self.assertRaises(ValueError):
            fx.emit_strike(Strike("x", "m1_1", 9, (0, 0)))
        with self.assertRaises(ValueError):
            fx.emit_strike(Strike("x", "m1_1", 10, (float("nan"), 0)))


if __name__ == "__main__":
    unittest.main()

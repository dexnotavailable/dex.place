"""Finite source-only integration checks against the pinned attacks inputs.

Loads only the planner's stdlib data exporter, never native/render/runtime code.
Synthetic collision fixtures are labeled and cannot be PREVIEW/visual proof.
"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path

from n1_n2_fx import CAPS
from planner_adapter import interface_receipt, phrase_scenes


def require(ok, message):
    if not ok:
        raise ValueError(message)


def run(plan_path, exporter_path):
    receipt = interface_receipt(plan_path)
    spec = importlib.util.spec_from_file_location("pinned_attack_exporter", exporter_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    plan = json.loads(plan_path.read_text(encoding="utf-8"))
    route = [("m1_1", 15), ("m1_2", 38)]
    results = []
    for height in (80, 144):
        for label, contacts in (("whiff", {}),
            ("contact", {"m1_1:n1": 9, "m1_2:n2": 8}),
            ("early-contact", {"m1_1:n1": 8, "m1_2:n2": 7})):
            packet = module.export_sequence(plan, height, route, contacts)
            points = {}
            for row in packet["ticks"]:
                key = row["clip"]+(":n1" if row["clip"] == "m1_1" else ":n2")
                if not row["frozen"] and row["actorTick"] == contacts.get(key):
                    # Geometry fixture, never observed target contact.
                    points[row["wallTick"]] = [{"target": "synthetic-test-victim",
                        "pointH": [row["rootH"][0]+(.9 if row["clip"] == "m1_1" else -.8), -.4]}]
            scenes = list(phrase_scenes(packet, collision_points=points,
                          evidence="synthetic-source-fixture", tail_ticks=168))
            group_cues = [c for s in scenes for c in s["cues"] if c.get("route") == "contact"]
            require(len(group_cues) == (0 if label == "whiff" else 4), "wrong conditional chime/push count")
            require(not scenes[-1]["commands"] and not scenes[-1]["lights"], "FX tail did not expire")
            require(all(not s["fullscreen_flash"] for s in scenes), "fullscreen flash appeared")
            for s in scenes:
                require(s["budget"]["commands"] <= CAPS["commands"], "primitive cap exceeded")
                require(s["budget"]["points"] <= CAPS["points"], "point cap exceeded")
                for clip in ("m1_1", "m1_2"):
                    if s["actor_clip"] == clip and s["active_hit_boxes_h"]:
                        boxes = s["active_hit_boxes_h"]
                        span = max(x+w for x, y, w, h in boxes)-min(x for x, y, w, h in boxes)
                        require(abs(span-2.5) < 1e-9, "current-root active union differs")
                if label == "whiff":
                    require(not any("contact" in c["tag"] for c in s["commands"]), "contact feedback on whiff")
            first_n2 = next(s for s in scenes if s["actor_clip"] == "m1_2")
            require(first_n2["actor_frame"] == 1, "seam skips first N2 drawing")
            if label != "whiff":
                require(any(c["tag"] == "contact-pane" for c in first_n2["commands"]), "N1 pane lost at seam")
                frozen = [s for s in scenes if s["actor_frozen"] and s["actor_clip"] == "m1_1"]
                require(frozen[0]["commands"] != frozen[-1]["commands"], "FX stalled on actor freeze")
            reduced = list(phrase_scenes(packet, collision_points=points, reduced_motion=True,
                                        reduce_flashing=True, evidence="synthetic-source-fixture"))
            require(not any(c["kind"] == "camera" for s in reduced for c in s["cues"]), "reduced camera push")
            require(not any(c["color"] == "A5" for s in reduced for c in s["commands"]), "white flashing reduction failed")
            results.append({"height": height, "route": label, "wall_ticks": packet["wallTicks"],
                "peak_commands": max(s["budget"]["commands"] for s in scenes),
                "peak_points": max(s["budget"]["points"] for s in scenes),
                "source_clocks_conditional_cues_caps_expiry": "pass"})
    return {"status": "pass", "kind": "synthetic-source-integration-checks", "interface": receipt,
            "planner_exporter_sha256": hashlib.sha256(exporter_path.read_bytes()).hexdigest(),
            "cases": results, "native_render": "not-run", "runtime": "not-run",
            "physical_cloth": "not-run", "visual_quality": "unverified"}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--plan", type=Path, required=True)
    parser.add_argument("--exporter", type=Path, required=True)
    parser.add_argument("--receipt", type=Path, required=True)
    args = parser.parse_args()
    result = run(args.plan, args.exporter)
    args.receipt.parent.mkdir(parents=True, exist_ok=True)
    args.receipt.write_text(json.dumps(result, indent=2)+"\n", encoding="utf-8")
    print(json.dumps(result))

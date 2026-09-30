"""Consume the attack planner's authored tick packet; never infer actual collisions.

Finite N1f1..15 -> N2f1..38 route only. Caller supplies actual collision and tip
anchors for a real render, or explicitly labels synthetic fixtures as source checks.
No renderer or external planner implementation is imported here.
"""
import hashlib
import json

from n1_n2_fx import CLIPS, Contact, LiturgyFX, Strike, beat_cues, hit_boxes


def validate_plan(plan):
    if plan.get("contract") != "rosace.choreography/1" or plan.get("sourceH") != 96:
        raise ValueError("rosace.choreography/1 with exact H96 basis required")
    for clip in plan["clips"]:
        if clip["id"] not in CLIPS:
            continue
        expected = CLIPS[clip["id"]]
        hit = clip["hits"][0]
        actual = tuple(tuple(v/96 for v in box) for box in hit["boxes"])
        if actual != expected["boxes"] or tuple(hit["active"]) != expected["active"]:
            raise ValueError("planner collision geometry/window differs; integrator reconciliation required")
        if hit["nominalContact"] != expected["contact"]:
            raise ValueError("planner contact cue beat differs")
    ids = {c["id"] for c in plan["clips"]}
    if not {"m1_1", "m1_2"}.issubset(ids):
        raise ValueError("N1/N2 planner clips required")
    return {"state": "source-interface-match", "id": plan["id"],
            "geometry_and_windows": "exact-match", "rendered": False}


def phrase_scenes(packet, *, collision_points=None, live_tips=None,
                  reduced_motion=False, reduce_flashing=False, evidence="authored-proposal",
                  tail_ticks=0, live_tip_depths=None):
    """Yield scenes plus contact/beat cues on exported wall ticks.

    collision_points is {wallTick:[{target,pointH}]}; this finite exporter accepts
    at most one collision tick per group and requires points on its contact plan.
    Input plans model one authored encounter; live multi-target gameplay uses
    LiturgyFX directly with actual actor frames. No contacts are guessed from boxes.
    live_tips is {wallTick:worldPointH}; omitted values remain labeled guide-only.
    """
    if packet.get("contract") != "rosace.choreography-ticks/1" or packet.get("fps") != 60:
        raise ValueError("planner tick contract/clock required")
    if not isinstance(tail_ticks, int) or not 0 <= tail_ticks <= 168:
        raise ValueError("finite tail must be0..168 wall ticks")
    if [list(r) for r in packet["route"]] != [["m1_1", 15], ["m1_2", 38]]:
        raise ValueError("this finite phrase requires earliest N1f15->N2f1 boundary")
    collision_points, live_tips = collision_points or {}, live_tips or {}
    live_tip_depths = live_tip_depths or {}
    rows = packet["ticks"]
    if [r["wallTick"] for r in rows] != list(range(1, len(rows)+1)):
        raise ValueError("planner wall clock gap/duplicate")
    contacts = packet.get("contactPlan", {})
    expected_contact_ticks = set()
    for row in rows:
        group = "n1" if row["clip"] == "m1_1" else "n2"
        key = row["clip"]+":"+group
        if not row["frozen"] and row["actorTick"] == contacts.get(key):
            expected_contact_ticks.add(row["wallTick"])
    if set(collision_points) != expected_contact_ticks:
        raise ValueError("actual/synthetic collision points must exactly cover planned contact ticks")
    fx = LiturgyFX()
    for row in rows:
        clip, actor, wall = row["clip"], row["actorTick"], row["wallTick"]
        if clip not in CLIPS:
            raise ValueError("unexpected clip")
        instance = packet["sourceId"]+":"+clip
        cues = []
        if not row["frozen"]:
            cues += beat_cues(clip, actor)
            if actor == CLIPS[clip]["strike"]:
                tip = live_tips.get(wall)
                relative_tip = (tip[0]-row["rootH"][0], tip[1]-row["rootH"][1]) if tip else None
                fx.emit_strike(Strike(instance, clip, wall, tuple(row["rootH"]), tip_h=relative_tip))
            for hit in collision_points.get(wall, []):
                cues += fx.emit_contact(Contact(instance, clip, wall, hit["target"],
                                                tuple(hit["pointH"]), actor, live_tips.get(wall)))
        if reduced_motion:
            cues = [c for c in cues if c["kind"] != "camera"]
        kwargs = {}
        if any(s.instance == instance for s in fx.strikes):
            kwargs = {"active_instance": instance, "active_root_h": tuple(row["rootH"]),
                      "active_actor_frame": actor}
        scene = fx.sample(wall, reduced_motion=reduced_motion, reduce_flashing=reduce_flashing,
                          live_tip_h=live_tips.get(wall), live_tip_depth=live_tip_depths.get(wall),
                          actor_root_h=tuple(row["rootH"]), **kwargs)
        scene["unresolved_cues"] = []
        if clip == "m1_1" and actor in (5, 6) and not reduce_flashing:
            tip = live_tips.get(wall)
            if tip:
                fx._put(scene, [tip, (tip[0], tip[1]+1/96)], "A5", "blade-glint-live-tip",
                        kind="line", priority=1)
                scene["budget"]["commands"] += 1
                scene["budget"]["points"] += 2
            else:
                scene["unresolved_cues"].append("blade-glint-needs-live-cutting-edge-tip")
        scene.update({"actor_clip": clip, "actor_frame": actor, "actor_frozen": row["frozen"],
                      "root_h": row["rootH"], "cues": cues, "evidence": evidence,
                      "collision_owner": "planner/controller",
                      "active_hit_boxes_h": hit_boxes(clip, tuple(row["rootH"]))
                      if not row["frozen"] and CLIPS[clip]["active"][0] <= actor <= CLIPS[clip]["active"][1]
                      else []})
        yield scene
    for wall in range(len(rows)+1, len(rows)+1+tail_ticks):
        scene = fx.sample(wall, reduced_motion=reduced_motion, reduce_flashing=reduce_flashing)
        scene.update({"actor_clip": rows[-1]["clip"], "actor_frame": rows[-1]["actorTick"],
                      "actor_frozen": False, "root_h": rows[-1]["rootH"], "cues": [],
                      "tail_only": True, "evidence": evidence, "active_hit_boxes_h": []})
        yield scene


def interface_receipt(path):
    raw = path.read_bytes()
    result = validate_plan(json.loads(raw))
    result["input_sha256"] = hashlib.sha256(raw).hexdigest()
    return result

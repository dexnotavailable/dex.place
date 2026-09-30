"""Delivery-only action authoring on an already prepared, isolated Rosace rig.

No startup, download, model inference, blend open/save or render is performed by
this module. The integrator calls build_action inside the sole delivery native
turn. It reuses hero_layer's evaluated-state/grip solving and existing Cloth.
"""
import copy
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[3]
sys.path.insert(0, str(HERE))
import author_sequence as A  # noqa: E402


def build_action(planner_path, tick_path):
    import bpy
    from mathutils import Vector

    sys.path.insert(0, str(REPO / "tools/pixel-pipeline"))
    sys.path.insert(0, str(REPO / "tools/motion-ai"))
    from rosace import posing
    import hero_layer as HL
    import rig_measure

    planner, motion = A.read(planner_path), A.read(HERE / "sequence.json")
    if A.sha(planner_path) != motion["plannerSha256"]:
        raise ValueError("native planner differs from reviewed source binding")
    A.validate(planner, motion)
    ticks = A.read(tick_path)
    if ticks["plannerSha256"] != A.sha(planner_path) or ticks["motionSha256"] != A.sha(HERE / "sequence.json"):
        raise ValueError("driver requires exact exported planner/motion bytes")
    if ticks["route"] not in ("earliest-chain", "n1-whiff-recovery"):
        raise ValueError("unsupported late-entry or mirrored route")
    arm, scene = posing.arm_obj(), bpy.context.scene
    if arm.animation_data and arm.animation_data.action:
        raise ValueError("prepare an isolated static rig; do not replace an existing action")
    height = float(arm.get("rosace_height", 0))
    if not 1 < height < 3:
        raise ValueError("rig must declare actual body height in metres")
    order = HL.j_order(arm)
    full_order = posing._hierarchy(arm)
    required = {"Root", "glaive", "grip_off", "grip_main", *order}
    for side in "LR":
        required.update({f"ik_hand.{side}", f"ik_foot.{side}", f"pole_arm.{side}",
                         f"pole_leg.{side}", f"J_Bip_{side}_ToeBase"})
    if not required.issubset(arm.pose.bones.keys()):
        raise ValueError("missing Rosace body/weapon/IK/toe contract")
    sources, recipes = {}, {}

    def capture_pose(p, left_weight=None):
        p = HL.resolve(copy.deepcopy(p), arm)
        posing.apply_pose(p)
        hands = p.get("hands", {})
        grips = arm["glaive"]["grips"]
        def slide(side, socket):
            h = hands.get(side, {})
            return grips.get(h.get("grip", socket), grips[socket]) - grips[socket] + h.get("slide", 0)
        info = {"slideR": slide("R", "grip_off"), "slideL": slide("L", "grip_main"),
                "wL": int("grip" in hands.get("L", {})) if left_weight is None else left_weight,
                "backR": hands.get("R", {}).get("back", [-1, 0, 0]),
                "backL": hands.get("L", {}).get("back", [1, 0, 0])}
        root_q = posing.eul_q(p.get("root", {}).get("rot", [0, 0, 0]))
        info["backR"], info["backL"] = [list(root_q @ Vector(info[k])) for k in ("backR", "backL")]
        return {"state": HL.capture(arm, order, info), "root": arm.pose.bones["Root"].matrix.copy(),
                "extras": {b.name: b.matrix_basis.copy() for b in arm.pose.bones if b.name not in required}}

    for name, rel in motion["sources"].items():
        sources[name] = capture_pose(A.read(REPO / rel))
    for name, spec in motion["recipes"].items():
        if "source" in spec:
            value = copy.deepcopy(sources[spec["source"]])
        elif "pose" in spec:
            value = capture_pose(A.read(HERE / spec["pose"]), spec["leftGrip"])
        elif "inherit" in spec:
            value = copy.deepcopy(recipes[spec["inherit"]])
        else:
            parts = [(sources[n]["state"], w) for n, w in spec["blend"]]
            # N1 blends have identical Root frames. Never quaternion-shortcut N2's turn.
            roots = [sources[n]["root"] for n, _ in spec["blend"]]
            if any(max(abs(x - y) for a, b in zip(roots[0], r) for x, y in zip(a, b)) > 1e-6 for r in roots[1:]):
                raise ValueError("body-state blend requires identical Root frames")
            value = copy.deepcopy(sources[spec["blend"][0][0]])
            value["state"] = HL.state_mix(parts)
            # Cloth/hair guide bones follow the dominant drawing. Physical free fabric
            # is solved later; no spring lag is represented as physical mesh proof.
            dominant = max(spec["blend"], key=lambda pair: pair[1])[0]
            value["extras"] = copy.deepcopy(sources[dominant]["extras"])
        value["state"]["wL"] = spec["leftGrip"]
        # HL captures bone-local Hips.location. Use the pose runtime's rest-axis
        # conversion for an actual world-Z sink; local z need not point upward.
        hips_rest = arm.pose.bones["J_Bip_C_Hips"].bone.matrix_local.to_3x3()
        value["state"]["hips"] += hips_rest.inverted() @ Vector((0, 0, -spec.get("sinkMeters", 0)))
        recipes[name] = value

    def pose_row(row, lock=True):
        value = sources["stance"] if row["recipe"] == "stance" else recipes[row["recipe"]]
        state = copy.deepcopy(value["state"])
        delta = Vector(motion["rootForward"]) * (row["rootForwardH"] * height)
        posing.reset(arm)
        for name, basis in value["extras"].items():
            arm.pose.bones[name].matrix_basis = basis
        root = value["root"].copy()
        root.translation += delta
        posing.set_bone_matrix(arm, "Root", root)
        for side in "LR":
            state["foot"][side].translation += delta
            state["poleL"][side] += delta
        HL.set_state(arm, order, state)
        # Reach variants are authored redraws, not interpolated raster frames. The
        # target is the actual current shaft; primary R/weapon transform stays fixed.
        reach = row.get("regripReach")
        if reach is not None:
            before = arm.pose.bones["J_Bip_L_Hand"].matrix.copy()
            posing.grip_hand(arm, "L", "grip_main", "tip", back=[1, 0, 0],
                             slide=motion["regrip"]["slideMeters"])
            posing.update()
            target = arm.pose.bones["ik_hand.L"].matrix.copy()
            t0, q0, s0 = before.decompose()
            t1, q1, _ = target.decompose()
            matrix = q0.slerp(q1, reach).to_matrix().to_4x4()
            matrix.translation = t0.lerp(t1, reach)
            posing.set_bone_matrix(arm, "ik_hand.L", matrix)
            for constraint in arm.pose.bones["J_Bip_L_LowerArm"].constraints:
                if constraint.name == "ik":
                    constraint.mute, constraint.influence = False, 1
            for constraint in arm.pose.bones["J_Bip_L_Hand"].constraints:
                if constraint.name == "ik_rot":
                    constraint.mute, constraint.influence = False, 1
            posing.curl_fingers(arm, "L", 20 + 45 * reach, 15 + 25 * reach)
            posing.update()
        if lock and row["clip"] in motion["plants"]:
            for plant in motion["plants"][row["clip"]]:
                if plant["from"] <= row["tick"] <= plant["to"]:
                    side = plant["side"]
                    toe = arm.pose.bones[f"J_Bip_{side}_ToeBase"].head.copy()
                    matrix = arm.pose.bones[f"ik_foot.{side}"].matrix.copy()
                    matrix.translation += plant_points[(row["clip"], side, plant["from"])] - toe
                    posing.set_bone_matrix(arm, f"ik_foot.{side}", matrix)
            posing.update()

    plant_points = {}
    for clip_id, spans in motion["plants"].items():
        clip = next(c for c in planner["clips"] if c["id"] == clip_id)
        for p in spans:
            anchor_clip = "m1_1" if p["anchor"].startswith("m1_1") or p["anchor"] == "stance" else "m1_2"
            ac = next(c for c in planner["clips"] if c["id"] == anchor_clip)
            cumulative = A.root_at(ac, p["anchorTick"])
            if anchor_clip == "m1_2":
                cumulative += A.root_at(planner["clips"][0], 15)
            row = {"recipe": p["anchor"], "rootForwardH": cumulative, "clip": anchor_clip,
                   "tick": p["anchorTick"], "regripReach": None}
            pose_row(row, lock=False)
            plant_points[(clip_id, p["side"], p["from"])] = arm.pose.bones[f"J_Bip_{p['side']}_ToeBase"].head.copy()

    rows = [{"frame": 0, "clip": "idle", "tick": 0, "recipe": "stance", "rootForwardH": 0,
             "regripReach": None}, *ticks["ticks"]]
    snapshots, measured, numeric_failures = [], [], []
    for row in rows:
        pose_row(row)
        # A released/reaching left palm is not required to lie on the shaft.
        weight = 0 if row["recipe"] == "stance" else motion["recipes"][row["recipe"]]["leftGrip"]
        metrics = rig_measure.measure(arm, grips=("R", "L") if weight == 1 else ("R",))
        residuals = {}
        for p in motion["plants"].get(row["clip"], []):
            if p["from"] <= row["tick"] <= p["to"]:
                side = p["side"]
                residuals[side] = (arm.pose.bones[f"J_Bip_{side}_ToeBase"].head -
                                   plant_points[(row["clip"], side, p["from"])]).length
        if any(value > 0.015 for value in residuals.values()):
            numeric_failures.append({"frame": row["frame"], "reason": "planted-toe-drift-over1.5cm"})
        if any(value > 1.5 for value in metrics["hand_gap_cm"].values()):
            numeric_failures.append({"frame": row["frame"], "reason": "active-grip-gap-over1.5cm"})
        if any(value > 1.5 for value in metrics["ankle_ik_cm"].values()):
            numeric_failures.append({"frame": row["frame"], "reason": "ankle-IK-reach-error-over1.5cm"})
        A.numeric_finite(metrics)
        measured.append(dict(row, rig=metrics, plantedToeResidualMeters=residuals))
        snapshots.append((row["frame"], {b.name: b.matrix.copy() for b in arm.pose.bones}))
    if ticks["route"] == "earliest-chain":
        a, b = snapshots[15][1], snapshots[16][1]
        seam_error = max(abs(x - y) for name in a for ra, rb in zip(a[name], b[name]) for x, y in zip(ra, rb))
        if seam_error > 1e-6:
            raise ValueError(f"actual N1f15->N2f1 seam matrices changed: {seam_error}")
    else:
        seam_error = None
    for bone in arm.pose.bones:
        for c in bone.constraints:
            if c.name in ("ik", "ik_rot"):
                c.mute = True
    arm.animation_data_create()
    action = bpy.data.actions.new("rosace_n1_n2_authored_motion_v1")
    arm.animation_data.action = action
    for frame, matrices in snapshots:
        for name in full_order:
            arm.pose.bones[name].matrix = matrices[name]
            posing.update()
        for name in full_order:
            pb = arm.pose.bones[name]
            for property_name in ("location", "rotation_quaternion", "scale"):
                pb.keyframe_insert(property_name, frame=frame)
    # Layered Action API is used by Blender5.1. Legacy fcurves is retained only
    # as a version-compatible path; absence of channels fails, never silently tweens.
    curves = []
    for layer in action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                curves.extend(bag.fcurves)
    if not curves and hasattr(action, "fcurves"):
        curves = list(action.fcurves)
    if not curves:
        raise ValueError("cannot find action curves to enforce stepped body exposure")
    for curve in curves:
        curve.extrapolation = "CONSTANT"
        for point in curve.keyframe_points:
            point.interpolation = "CONSTANT"
    scene.render.fps, scene.render.fps_base = 60, 1.0
    scene.frame_start, scene.frame_end = 0, rows[-1]["frame"]
    scene.frame_set(0)
    posing.update()
    # Evidence is written only to caller's private export path, never to source.
    result = {"contract": "rosace.native-driver/1", "status": "action-authored-physical-bake-pending",
              "plannerSha256": ticks["plannerSha256"], "motionSha256": ticks["motionSha256"],
              "fps": 60, "heightMeters": height, "first": 0, "last": rows[-1]["frame"],
              "boundaryMatrixMaxAbs": seam_error, "frames": measured,
              "numericGatesPassed": not numeric_failures, "numericFailures": numeric_failures,
              "limits": "rig measurements are diagnostic; actual grip/cloth/pixels/playback still required"}
    return result


def physical_bake(scene, output, frame_callback, end, driver_proof):
    """No restart at N1/N2. Caller renders a fixed frame/camera and never reposes.

    Existing installer intentionally requires the preserved R2 disk scene/hash
    and its private review/rosace/physics subtree. Integrator supplies current
    approved in-memory preparation; do not weaken that provenance check.
    """
    import importlib.util
    import bpy
    if driver_proof.get("contract") != "rosace.native-driver/1" or not driver_proof.get("numericGatesPassed"):
        raise ValueError("resolve actual driver toe/grip/reach guards before mesh-cloth bake")
    if driver_proof.get("first") != 0 or driver_proof.get("last") != end:
        raise ValueError("cloth trajectory differs from evaluated driver range")
    path = REPO / "tools/pixel-pipeline/next/cloth/setup.py"
    spec = importlib.util.spec_from_file_location("rosace_motion_existing_cloth", path)
    physics = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(physics)
    config = A.read(REPO / "art/rosace/next/cloth-physics.json")
    # The frozen inertia diagnostic had no floor collider. Add one only in the
    # isolated moving scene; retain its exact shared config bytes on disk.
    if "motion_collision_floor" in scene.objects:
        raise ValueError("do not stack an existing motion floor/collider")
    height = float(bpy.data.objects["rosace_rig"]["rosace_height"])
    radius = 4 * height
    mesh = bpy.data.meshes.new("motion_collision_floor")
    mesh.from_pydata([(-radius, -radius, 0), (radius, -radius, 0),
                      (radius, radius, 0), (-radius, radius, 0)], [], [(0, 1, 2, 3)])
    mesh.update()
    floor = bpy.data.objects.new("motion_collision_floor", mesh)
    floor["part"], floor.hide_render = "motion-floor", True
    scene.collection.objects.link(floor)
    config["colliderParts"] = [*config["colliderParts"], "motion-floor"]
    state = physics.install(scene, config, output, start=0, end=end)
    return physics.chronological_bake(scene, state, 0, end, frame_callback)

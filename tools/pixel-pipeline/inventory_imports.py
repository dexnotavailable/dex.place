"""Import-check every third-party input in the isolated Blender and write an inventory.

Driver (plain Python):
  python inventory_imports.py [--out D:/Dex/Projects/dex-place-art/rosace/build]
                              [--only id,id] [--md-only]
    runs one headless Blender per asset through blender_env.py, writes
    <out>/inventory/<asset>.json, then <out>/inventory.md from all JSON present
    (--md-only skips the imports and just rebuilds the markdown)
Blender side (called by the driver):
  blender.sh --python inventory_imports.py -- --kind vrm|glb|fbx|blend|bvh --file F --json J

Nothing here is written to the repo; inputs come from DEXPLACE_DOWNLOADS.
"""
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DOWNLOADS = os.environ.get("DEXPLACE_DOWNLOADS", r"D:\Dex\Inbox\Downloads\dexplace-character")
UAL2 = "quaternius/UAL2_Standard/Universal Animation Library 2[Standard]"
UAL1 = "quaternius/UAL1_Standard/Universal Animation Library[Standard]"

ASSETS = [
    ("seed-san", "vrm", "vrm/Seed-san.vrm"),
    ("hairsample-female", "vrm", "vrm/HairSample_Female.vrm"),
    ("ual2-glb", "glb", f"{UAL2}/Unreal-Godot/UAL2_Standard.glb"),
    ("ual2-rm-glb", "glb", f"{UAL2}/Unreal-Godot/UAL2_Standard_RM.glb"),
    ("ual2-fbx", "fbx", f"{UAL2}/Unity/UAL2_Standard.fbx"),
    ("ual2-mannequin-f-glb", "glb", f"{UAL2}/Female Mannequin/Unreal-Godot/Mannequin_F.glb"),
    ("ual2-mannequin-f-blend", "blend", f"{UAL2}/Female Mannequin/Mannequin_F.blend"),
    ("ual1-glb", "glb", f"{UAL1}/Unreal-Godot/UAL1_Standard.glb"),
    ("ual1-rm-glb", "glb", f"{UAL1}/Unreal-Godot/UAL1_Standard_RM.glb"),
    ("ual1-fbx", "fbx", f"{UAL1}/Unity/UAL1_Standard.fbx"),
    ("m2m-human-base", "glb", "mesh2motion/human-base-animations.glb"),
    ("m2m-human-addon", "glb", "mesh2motion/human-addon-animations.glb"),
    ("m2m-human-mocap", "glb", "mesh2motion/human-mocap-animations.glb"),
] + [(f"cmu-{t}", "bvh", f"cmu/bvh/{t}.bvh")
     for t in ["02_07", "02_08", "02_09"] + [f"88_{i:02d}" for i in range(1, 12)]]

FPS = 30  # scene rate used to turn glTF seconds into frames


# ----------------------------------------------------------------------------------------
# Blender side

def blender_main(argv):
    import bpy
    from mathutils import Vector

    def arg(name):
        return argv[argv.index(name) + 1]

    kind, path, out = arg("--kind"), arg("--file"), arg("--json")
    scene = bpy.context.scene
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob)
    scene.render.fps, scene.render.fps_base = FPS, 1.0
    info = {"kind": kind, "file": path, "size": os.path.getsize(path), "warnings": []}

    if kind == "vrm":
        if "vrm" not in dir(bpy.ops.import_scene):
            raise SystemExit("VRM add-on not enabled in this environment")
        before = scene.view_settings.view_transform
        bpy.ops.import_scene.vrm(filepath=path)
        info["view_transform_before_after"] = [before, scene.view_settings.view_transform]
    elif kind == "glb":
        bpy.ops.import_scene.gltf(filepath=path)
    elif kind == "fbx":
        bpy.ops.import_scene.fbx(filepath=path, use_anim=True)
    elif kind == "blend":
        bpy.ops.wm.open_mainfile(filepath=path, load_ui=False)
        scene = bpy.context.scene
    elif kind == "bvh":
        with open(path, encoding="utf-8", errors="replace") as f:
            head = f.read(200000)
        frames = int(head.split("Frames:")[1].split()[0])
        ftime = float(head.split("Frame Time:")[1].split()[0])
        info["bvh_frames"], info["bvh_frame_time"] = frames, ftime
        info["bvh_fps"] = round(1.0 / ftime, 3)
        info["bvh_seconds"] = round(frames * ftime, 3)
        info["bvh_note"] = ("cgspeed conversion: frame 1 is an added T-pose; units are CMU's "
                            "(1 unit = 0.0254/0.45 m, about 5.6 cm), not metres")
        bpy.ops.import_anim.bvh(filepath=path, update_scene_fps=True, update_scene_duration=True)
    info["scene_fps"] = scene.render.fps / scene.render.fps_base

    # meshes
    # bbox in REST pose over skinned meshes only (skips rig widgets and helper props such as
    # the UAL "Icosphere"), so the height is the body's, not whatever the first action poses
    all_arms = [ob for ob in scene.objects if ob.type == "ARMATURE"]
    for a_ob in all_arms:
        a_ob.data.pose_position = "REST"
    bpy.context.view_layer.update()
    deps = bpy.context.evaluated_depsgraph_get()

    def skinned(ob):
        return any(md.type == "ARMATURE" and md.object for md in ob.modifiers)

    meshes, lo, hi = [], Vector((1e9,) * 3), Vector((-1e9,) * 3)
    mesh_obs = [ob for ob in scene.objects if ob.type == "MESH"]
    measured = [ob for ob in mesh_obs if skinned(ob)] or mesh_obs
    for ob in mesh_obs:
        me = ob.data
        me.calc_loop_triangles()
        meshes.append({
            "name": ob.name, "verts": len(me.vertices), "tris": len(me.loop_triangles),
            "materials": [m.name for m in me.materials if m],
            "shape_keys": len(me.shape_keys.key_blocks) if me.shape_keys else 0,
            "vertex_groups": len(ob.vertex_groups), "skinned": skinned(ob),
        })
        if ob not in measured:
            continue
        ev = ob.evaluated_get(deps)
        for c in ev.bound_box:
            w = ev.matrix_world @ Vector(c)
            lo = Vector(map(min, lo, w))
            hi = Vector(map(max, hi, w))
    info["meshes"] = meshes
    if measured:
        info["mesh_bbox_m"] = {"min": [round(v, 4) for v in lo], "max": [round(v, 4) for v in hi],
                               "height": round(hi.z - lo.z, 4),
                               "measured": [ob.name for ob in measured], "pose": "rest"}
    for a_ob in all_arms:
        a_ob.data.pose_position = "POSE"
    bpy.context.view_layer.update()
    info["images"] = sorted({(im.name, im.size[0], im.size[1]) for im in bpy.data.images
                             if im.size[0] > 0})

    # armatures
    arms = [ob for ob in scene.objects if ob.type == "ARMATURE"]
    info["armatures"] = []
    for arm in arms:
        bones = arm.data.bones

        def walk(b, depth, acc):
            acc.append(("  " * depth) + b.name)
            for c in b.children:
                walk(c, depth + 1, acc)
            return acc

        tree = []
        for b in bones:
            if b.parent is None:
                walk(b, 0, tree)
        zs = [(arm.matrix_world @ v).z for b in bones for v in (b.head_local, b.tail_local)]
        entry = {"name": arm.name, "bone_count": len(bones), "bones_tree": tree,
                 "scale": [round(v, 4) for v in arm.scale],
                 "rest_bone_height": round(max(zs) - min(zs), 4) if zs else None}
        # rest-pose arm angle: T-pose ~0 deg, A-pose ~30-45 deg below horizontal
        for cand in ("upperarm_l", "upper_arm.l", "leftarm", "j_bip_l_upperarm", "l_upperarm",
                     "upperarm.l", "left_upper_arm"):
            b = next((x for x in bones if x.name.lower().replace(" ", "") == cand), None)
            if b:
                v = (arm.matrix_world.to_3x3() @ (b.tail_local - b.head_local)).normalized()
                entry["rest_left_upper_arm"] = {"bone": b.name, "deg_below_horizontal":
                                                round(math.degrees(math.asin(max(-1, min(1, -v.z)))), 1)}
                break
        info["armatures"].append(entry)

    # VRM specifics
    if kind == "vrm" and arms:
        ext = arms[0].data.vrm_addon_extension
        v = {"spec_version": ext.spec_version}
        human = {}
        if ext.spec_version == "1.0":
            for hb_name, hb in ext.vrm1.humanoid.human_bones.human_bone_name_to_human_bone().items():
                if hb.node.bone_name:
                    human[str(hb_name.value if hasattr(hb_name, "value") else hb_name)] = hb.node.bone_name
            exprs = ext.vrm1.expressions.all_name_to_expression_dict()
            v["expressions"] = sorted(n for n, e in exprs.items()
                                      if len(e.morph_target_binds) or len(e.material_color_binds)
                                      or len(e.texture_transform_binds))
            v["springs"] = len(ext.spring_bone1.springs)
            v["spring_joints"] = sum(len(s.joints) for s in ext.spring_bone1.springs)
            v["colliders"] = len(ext.spring_bone1.colliders)
            m = ext.vrm1.meta
            # the add-on keeps no license_url property (the file's licenseUrl is fixed to VPL 1.0)
            v["meta"] = {"name": m.vrm_name, "authors": [a.value for a in m.authors],
                         "copyright": m.copyright_information, "credit": m.credit_notation,
                         "commercial": m.commercial_usage, "modification": m.modification,
                         "redistribution": m.allow_redistribution,
                         "avatar_permission": m.avatar_permission,
                         "sexual": m.allow_excessively_sexual_usage,
                         "violent": m.allow_excessively_violent_usage,
                         "political_or_religious": m.allow_political_or_religious_usage}
        else:
            for hb in ext.vrm0.humanoid.human_bones:
                if hb.node.bone_name:
                    human[hb.bone] = hb.node.bone_name
            v["expressions"] = [g.name for g in ext.vrm0.blend_shape_master.blend_shape_groups]
            v["spring_groups"] = len(ext.vrm0.secondary_animation.bone_groups)
            m = ext.vrm0.meta
            v["meta"] = {"title": m.title, "author": m.author, "license": m.license_name}
        v["humanoid"] = human
        # proportions, from the humanoid head bone to the top of the meshes
        hb = human.get("head")
        if hb and meshes:
            head_z = (arms[0].matrix_world @ arms[0].data.bones[hb].head_local).z
            top = info["mesh_bbox_m"]["max"][2]
            v["head_bone_z"] = round(head_z, 4)
            v["headbone_to_crown_m"] = round(top - head_z, 4)
            v["height_over_headbone_to_crown"] = round(info["mesh_bbox_m"]["height"] / (top - head_z), 2)
        info["vrm"] = v

    # actions: name, length, and how far the root/hips travel (root motion or in place)
    acts = []
    arm = arms[0] if arms else None
    root = hips = None
    if arm:
        root = next((b for b in arm.pose.bones if b.parent is None), None)
        hips = next((b for b in arm.pose.bones
                     if any(k in b.name.lower() for k in ("pelvis", "hips", "hip"))), None)
        if arm.animation_data:
            for t in arm.animation_data.nla_tracks:
                t.mute = True
        else:
            arm.animation_data_create()
    for act in sorted(bpy.data.actions, key=lambda a: a.name):
        f0, f1 = act.frame_range
        a = {"name": act.name, "frames": [round(f0, 2), round(f1, 2)],
             "seconds": round((f1 - f0) / info["scene_fps"], 3)}
        if arm and kind != "vrm":
            try:
                arm.animation_data.action = act
                if getattr(act, "slots", None) and len(act.slots):
                    arm.animation_data.action_slot = act.slots[0]
                pts = {}
                for label, pb in (("root", root), ("hips", hips)):
                    if pb is None:
                        continue
                    # cgspeed CMU BVH: frame 1 is an added T-pose at the origin, skip it
                    scene.frame_set(int(math.floor(f0)) + (1 if kind == "bvh" else 0))
                    p0 = arm.matrix_world @ pb.head
                    scene.frame_set(int(math.ceil(f1)))
                    p1 = arm.matrix_world @ pb.head
                    pts[label] = [round(x, 3) for x in (p1 - p0)]
                a["travel_m"] = pts
            except Exception as e:  # noqa: BLE001 - report, don't hide
                a["travel_error"] = repr(e)
        acts.append(a)
    info["actions"] = acts
    info["root_bone"] = root.name if root else None
    info["hips_bone"] = hips.name if hips else None
    with open(out, "w", encoding="utf-8") as f:
        json.dump(info, f, indent=1, ensure_ascii=False)


# ----------------------------------------------------------------------------------------
# driver side

def driver(argv):
    import subprocess
    out = argv[argv.index("--out") + 1] if "--out" in argv else \
        r"D:\Dex\Projects\dex-place-art\rosace\build"
    jdir = os.path.join(out, "inventory")
    os.makedirs(jdir, exist_ok=True)
    only = set(argv[argv.index("--only") + 1].split(",")) if "--only" in argv else None
    sys.path.insert(0, HERE)
    import blender_env
    results = {}
    for aid, kind, rel in ASSETS:
        if only and aid not in only:
            continue
        path = os.path.join(DOWNLOADS, rel)
        jpath = os.path.join(jdir, aid + ".json")
        if os.path.isfile(jpath):
            os.remove(jpath)  # never report a stale result for a failed import
        r = blender_env.run(["--python", os.path.abspath(__file__), "--", "--kind", kind,
                             "--file", path, "--json", jpath],
                            capture_output=True, text=True, encoding="utf-8", errors="replace")
        log = (r.stdout or "") + (r.stderr or "")
        with open(os.path.join(jdir, aid + ".log"), "w", encoding="utf-8") as f:
            f.write(log)
        ok = r.returncode == 0 and os.path.isfile(jpath)
        print(f"{'ok ' if ok else 'ERR'} {aid}  (exit {r.returncode})")
        if ok:
            results[aid] = json.load(open(jpath, encoding="utf-8"))
    print("json written to", jdir)
    return results


# ----------------------------------------------------------------------------------------
# markdown summary (built from the JSON, so it can be regenerated with --md-only)

FAMILIES = [  # first match wins; "other" and unmatched clips are only counted
    ("other", ("zombie", "dance", "farm", "pistol", "swim", "sit", "fishing", "golf",
               "driving", "bow", "ladder", "climb", "pipe", "push", "consume", "chop", "tree",
               "talk", "phone", "lantern", "rail", "carry", "chest open", "crawl", "pickup",
               "pick up", "fixing", "throw", "cheer", "help", "insult", "salute", "turn",
               "greeting", "shivering", "sleeping", "confused", "reject", "nod", "angry",
               "yes", "lay", "interact", "listening")),
    ("combat", ("sword", "attack", "melee", "punch", "kick", "hook", "block", "shield",
                "blast", "defend", "fighting")),
    ("spell / power", ("spell", "levitate", "power up", "meditate")),
    ("movement", ("walk", "jog", "run", "sprint", "dash", "roll", "dodge", "slide", "strafe",
                  "crouch")),
    ("air / acrobatic", ("jump", "flip", "land", "glide", "fall", "flying")),
    ("hit / death", ("hit", "death", "knockback", "dizzy", "hurt")),
    ("idle / pose", ("idle", "tpose", "rest pose", "victory")),
]

NOTES = """\
- **VRM import changes colour management.** Importing a VRM switched the scene view
  transform from AgX to Standard (both VRMs). The pixel pipeline needs Raw, so any build
  script must set the view transform after the VRM import, not before.
- **All rigs rest in a T-pose** (left upper arm within 3 degrees of horizontal), so no A/T
  pose correction is needed between UAL, Mesh2Motion, CMU and either VRM.
- **UAL clip set is identical across GLB and FBX** (43 clips each). FBX action names carry an
  `Armature|Armature|` prefix. The `_RM` files move the `root` bone along -Y (Blender's
  forward); the plain files keep `root` still and only the pelvis drifts.
- **The free UAL2 Standard zip has no air attack, ground pound or spell.** Those come from
  Mesh2Motion's `human-addon-animations.glb` (Sword_Attack_Air_Vertical,
  Attack_Ground_Pound, Backflip, Land_Three_Point, Dodge_*, Run_Anime, Run_Female,
  Walk_Female) and UAL1 (Spell_Simple_*). Mesh2Motion also carries Sword_Regular_C_RM and
  Sword_Dash_RM.
- **Mesh2Motion clips sit on a 24 fps key grid** (lengths like 41.25 frames at 30 fps) and
  their lengths differ from the UAL copies of the same moves (Roll 1.833 s vs 1.467 s,
  Sword_Regular_C 1.667 s vs 2.0 s), so they are a different export. Prefer the UAL copy
  when both exist, and judge timing by eye either way.
- **Mannequin_F.blend** (UAL2 female mannequin) opens at 24 fps with a metarig plus a
  generated Rigify rig (382 bones). Opened with auto-run scripts disabled, so the Rigify UI
  script did not run.
- **Seed-san is not CC0.** VRM Public License 1.0, every usage flag allowed, credit
  required ("Seed-san model by VirtualCast, Inc."). Its body, outfit, robot arm and
  backpack share one `wear` mesh; the skin is the `body_bake` material. Humanoid bones use
  Rigify-style names (upper_arm.L).
- **HairSample_Female is CC0** (VRoid beta sample, VRM 0.0, exporter VRoidStudio-0.11.2).
  Separate Face / Body / Hair meshes, 42 face shape keys, J_Bip_* bone names, which match
  Retarget's `Vroid.py` preset directly.
- **CMU BVH (cgspeed 2010 conversion):** 120 fps, frame 1 is an added T-pose, units are
  CMU's (1 unit = 0.0254/0.45 m, about 5.6 cm), so scale by about 0.0564 before comparing
  with metre rigs. MotionBuilder bone names (Hips, LeftUpLeg, LeftArm...).
- **Retarget 5.2.0 works headless** (see `retarget-smoke.json` and `retarget-smoke/`):
  UAL2 Sword_Regular_C bound onto HairSample_Female with presets Vroid <- Unreal_Mannequin,
  55 constraints, right-arm direction matched within dot 0.999 on every sampled frame.
  Caveats: call convention in `tools/pixel-pipeline/retarget_smoke.py`; with default
  options the VRM's hip height does not follow the source (the lunge crouch is lost) and the
  source rig is rescaled to fit. Configure both in the real retarget step.
"""


def _family(name):
    low = name.lower().replace("_", " ")
    for fam, keys in FAMILIES:
        if any(k in low for k in keys):
            return fam
    return None


def _cmu_descriptions():
    path = os.path.join(DOWNLOADS, "cmu", "bvh", "cmu-mocap-index-text.txt")
    out = {}
    if os.path.isfile(path):
        for line in open(path, encoding="utf-8", errors="replace"):
            parts = line.strip().split("\t", 1)
            if len(parts) == 2 and "_" in parts[0]:
                out[parts[0]] = parts[1].strip()
    return out


def write_markdown(out, jdir):
    import datetime
    res = {}
    for aid, kind, rel in ASSETS:
        p = os.path.join(jdir, aid + ".json")
        res[aid] = (kind, rel, json.load(open(p, encoding="utf-8")) if os.path.isfile(p) else None)
    ext_versions = {}
    ext_root = os.path.join(os.environ.get("DEXPLACE_BLENDER_ROOT", r"D:\Dex\Tools\blender-dexplace"),
                            "extensions", "user_default")
    for ext in ("vrm", "retarget"):
        mf = os.path.join(ext_root, ext, "blender_manifest.toml")
        if os.path.isfile(mf):
            for line in open(mf, encoding="utf-8"):
                if line.startswith("version"):
                    ext_versions[ext] = line.split("=")[1].strip().strip('"')
    L = ["# Rosace third-party inventory", "",
         f"Generated {datetime.date.today().isoformat()} by `tools/pixel-pipeline/"
         "inventory_imports.py`: every download imported headless in the isolated Blender "
         "5.1.2 (`blender_env.py`), extensions "
         + ", ".join(f"{k} {v}" for k, v in ext_versions.items()) + ". Per-asset detail "
         "(full bone trees, every clip, meshes, images) is in `inventory/<asset>.json`, "
         "Blender logs in `inventory/<asset>.log`. Licences and hashes: "
         "`tools/pixel-pipeline/THIRD_PARTY.md` in the repo.", "",
         "## Import check", "",
         "Height is the rest-pose bounding box of the skinned meshes (metres). Rest pose is the "
         "left upper arm's angle below horizontal (0 = T-pose).", "",
         "| asset | kind | result | armature (bones) | rest pose | height m | clips | fps |",
         "|---|---|---|---|---|---|---|---|"]
    for aid, (kind, rel, d) in res.items():
        if d is None:
            L.append(f"| {aid} | {kind} | **FAILED / not run** | | | | | |")
            continue
        arms = "; ".join(f"{a['name']} ({a['bone_count']})" for a in d["armatures"])
        pose = "; ".join(f"{a['rest_left_upper_arm']['deg_below_horizontal']} deg"
                         for a in d["armatures"] if a.get("rest_left_upper_arm")) or "-"
        h = d.get("mesh_bbox_m", {}).get("height", "-") if d.get("meshes") else "no mesh"
        n = len(d["actions"]) if kind != "vrm" else 0
        fps = round(d.get("bvh_fps") or d["scene_fps"], 2)
        L.append(f"| {aid} | {kind} | ok | {arms} | {pose} | {h} | {n} | {fps} |")

    L += ["", "## Base bodies (VRM)", ""]
    for aid in ("hairsample-female", "seed-san"):
        kind, rel, d = res[aid]
        if not d:
            continue
        v = d["vrm"]
        meshes = ", ".join(f"{m['name']} {m['verts']}v/{m['shape_keys']}sk" for m in d["meshes"])
        L += [f"**{aid}** (`{rel}`): VRM {v['spec_version']}, {len(v['humanoid'])} humanoid bones "
              f"mapped, {d['armatures'][0]['bone_count']} bones total, height "
              f"{d['mesh_bbox_m']['height']} m. Meshes: {meshes}. Expressions: "
              f"{', '.join(v['expressions'])}. Meta: `{json.dumps(v['meta'], ensure_ascii=False)}`.", ""]

    L += ["## Motion clips by family", "",
          "Seconds at 30 fps. `RM` = root-motion travel of the `root` bone in metres (x, y, z; "
          "-y is forward) from the root-motion file or the clip's own `_RM` variant. Clips "
          "outside these families (farming, zombie, pistol, swimming...) are only counted; "
          "the JSON lists them all.", ""]
    motion_sets = [("UAL2 Standard (CC0)", "ual2-glb", "ual2-rm-glb"),
                   ("UAL1 Standard (CC0)", "ual1-glb", "ual1-rm-glb"),
                   ("Mesh2Motion human-base (CC0 per repo)", "m2m-human-base", None),
                   ("Mesh2Motion human-addon (CC0 per repo)", "m2m-human-addon", None),
                   ("Mesh2Motion human-mocap (CC0 per repo)", "m2m-human-mocap", None)]
    for title, aid, rm_aid in motion_sets:
        d = res[aid][2]
        if not d:
            continue
        rm = {}
        if rm_aid and res[rm_aid][2]:
            rm = {a["name"]: a.get("travel_m", {}).get("root") for a in res[rm_aid][2]["actions"]}
        groups, other = {}, 0
        for a in d["actions"]:
            fam = _family(a["name"])
            if fam in (None, "other"):
                other += 1
                continue
            root_t = rm.get(a["name"]) or a.get("travel_m", {}).get("root")
            tag = ""
            if root_t and any(abs(x) > 0.05 for x in root_t):
                tag = f" RM({', '.join(f'{x:g}' for x in root_t)})"
            groups.setdefault(fam, []).append(f"{a['name']} {a['seconds']:g}s{tag}")
        L += [f"**{title}**: {len(d['actions'])} clips, "
              f"{other} outside the families below.", ""]
        for fam, _ in FAMILIES:
            if fam in groups:
                L.append(f"- {fam}: " + "; ".join(groups[fam]))
        L.append("")

    desc = _cmu_descriptions()
    unit = 0.0254 / 0.45
    L += ["## CMU BVH trials", "",
          "120 fps. Travel is the hips' displacement from frame 2 to the end, converted to "
          "metres (x 0.0564).", "",
          "| trial | description | seconds | frames | hips travel m |", "|---|---|---|---|---|"]
    for aid, (kind, rel, d) in res.items():
        if kind != "bvh" or not d:
            continue
        t = d["actions"][0].get("travel_m", {}).get("hips") if d["actions"] else None
        tm = ", ".join(f"{x * unit:.2f}" for x in t) if t else "-"
        trial = aid[4:]
        L.append(f"| {trial} | {desc.get(trial, '')} | {d['bvh_seconds']} | {d['bvh_frames']} | {tm} |")

    L += ["", "## Findings", "", NOTES]
    path = os.path.join(out, "inventory.md")
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(L))
    print("markdown written to", path)


if __name__ == "__main__":
    try:
        import bpy  # noqa: F401
        IN_BLENDER = True
    except ImportError:
        IN_BLENDER = False
    if IN_BLENDER:
        blender_main(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
    else:
        args = sys.argv[1:]
        out_dir = args[args.index("--out") + 1] if "--out" in args else \
            r"D:\Dex\Projects\dex-place-art\rosace\build"
        if "--md-only" not in args:
            driver(args)
        write_markdown(out_dir, os.path.join(out_dir, "inventory"))

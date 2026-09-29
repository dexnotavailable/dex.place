"""Face pass for the v2 head (face lane): the construction reference a face stamp is placed on.

Runs inside the isolated Blender (blender_env.py). For one rendered still it re-poses the build
with the SAME camera, canvas and anchor as the still's meta.json and writes, next to it:

  facepass.json   projected landmarks of the human-authored MMD head (射当ユウキ) at sprite scale:
                  the source's own eye, iris, brow, lash, mouth meshes (the never-rendered
                  `head_ref` collection) as point clouds per side, plus the chin, nose tip and the
                  head's screen axes. These say WHERE the head's designed features sit in this
                  pose (WF-P02: the 3D supplies position, turn and tilt); they never supply pixels.
  facewin.png     the head skin alone (every other object hidden), rendered as the id pass at the
                  still's supersampling: the face window before hair covers it. The stamp step
                  uses it to tell a hair strand crossing the face (inside the window) from hair
                  beside the face (outside it).

  python tools/pixel-pipeline/blender_env.py run --python-exit-code 1 \
      --python tools/pixel-pipeline/author_faces_pass.py -- \
      --blend D:/Dex/Projects/dex-place-art/rosace/build/lanes/face.blend \
      --pose art/rosace/poses/idle_hero.json --still <render>/<still>/px144 [--still ...px80]

Reads only the blend; writes only into the --still folders.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402
from mathutils import Vector as V  # noqa: E402

from rosace import common, materials, posing, render  # noqa: E402

argv = common.args_after_dashes(sys.argv)
BLEND = common.arg(argv, "--blend", None)
POSE = common.arg(argv, "--pose", None)
STILLS = [argv[i + 1] for i, a in enumerate(argv) if a == "--still"]
REFS = ("ref_eyes", "ref_eyes_white", "ref_eyes_highlight", "ref_eyeblow", "ref_eyelid", "ref_eyelush",
        "ref_mouth")


def evaluated_points(ob):
    """posed world positions and rest-local positions of every vertex"""
    dg = bpy.context.evaluated_depsgraph_get()
    ev = ob.evaluated_get(dg)
    me = ev.to_mesh()
    world = [ob.matrix_world @ v.co for v in me.vertices]
    ev.to_mesh_clear()
    rest = [v.co.copy() for v in ob.data.vertices]
    return world, rest


def main():
    assert BLEND and POSE and STILLS, "--blend, --pose and at least one --still"
    bpy.ops.wm.open_mainfile(filepath=BLEND)
    sc = bpy.context.scene
    materials.rebind()
    render.setup_engine(sc)
    pose_meta = posing.apply_pose_file(POSE)
    bpy.context.view_layer.update()
    arm = posing.arm_obj()
    pb = arm.pose.bones
    M = arm.matrix_world
    head = pb["J_Bip_C_Head"]
    Mh = M @ head.matrix
    rest_inv = head.bone.matrix_local.inverted()
    R3 = Mh.to_3x3() @ rest_inv.to_3x3()          # rest -> posed rotation of the head
    hs = bpy.data.objects["head_skin"]
    hs_world, hs_rest = evaluated_points(hs)
    # rest-space landmarks of the head skin (the model faces -Y at rest, +Z up)
    front = [i for i, p in enumerate(hs_rest) if abs(p.x) < 0.012]
    eye_rest = [arm.data.bones[f"J_Adj_{s}_FaceEye"].head_local for s in "LR"]   # rest, armature space
    eyes_z = sum(e.z for e in eye_rest) / 2
    # the chin: the lowest midline vertex that is still forward of the eyes' depth minus 2 cm (the neck's
    # front sits 6 cm further back and lower; without the depth gate the neck wins)
    chin_i = min((i for i in front if hs_rest[i].y < eye_rest[0].y + 0.02), key=lambda i: hs_rest[i].z)
    nose_i = min((i for i in front if hs_rest[i].z < hs_rest[chin_i].z + 0.8 * (eyes_z - hs_rest[chin_i].z)),
                 key=lambda i: hs_rest[i].y)
    refs = {n: evaluated_points(bpy.data.objects[n]) for n in REFS if n in bpy.data.objects}
    for still in STILLS:
        meta = json.load(open(os.path.join(still, "meta.json")))
        px, ss = meta["px"], meta["ss"]
        shot = render.setup_shot(sc, px, yaw=meta["yaw"], elev=meta["elev"], ss=ss,
                                 canvas=meta["canvas"], anchor=meta["anchor"])
        bpy.context.view_layer.update()
        cam = sc.camera
        cam_back = (cam.matrix_world.to_3x3() @ V((0, 0, 1))).normalized()
        right = (cam.matrix_world.to_3x3() @ V((1, 0, 0))).normalized()
        up = (cam.matrix_world.to_3x3() @ V((0, 1, 0))).normalized()

        def P(p):
            x, y, z = render.project(sc, p)
            return [round(x / ss, 3), round(y / ss, 3), round(z, 4)]

        def axis(v):
            w = (R3 @ v).normalized()
            return [round(w.dot(right), 4), round(-w.dot(up), 4), round(w.dot(cam_back), 4)]

        out = {"_doc": "author_faces_pass.py: projected MMD head landmarks, sprite px (x right, y down, "
                       "z = camera depth); sides L/R are the model's own left/right",
               "still": still, "pose": pose_meta.get("name"), "px": px, "ss": ss,
               "canvas": meta["canvas"], "anchor": meta["anchor"],
               "axes": {"fwd": axis(V((0, -1, 0))), "up": axis(V((0, 0, 1))), "left": axis(V((1, 0, 0)))},
               "chin": P(hs_world[chin_i]), "nose": P(hs_world[nose_i]),
               "eye_bones": {s: P(M @ pb[f"J_Adj_{s}_FaceEye"].head) for s in "LR"},
               "refs": {}}
        for n, (world, rest) in refs.items():
            sides = {}
            for s, sign in (("L", 1), ("R", -1)):
                pts = [P(w) for w, r in zip(world, rest) if r.x * sign > 0]
                if pts:
                    sides[s] = pts
            if n == "ref_mouth":
                sides = {"C": [P(w) for w in world]}
            out["refs"][n] = sides
        json.dump(out, open(os.path.join(still, "facepass.json"), "w"), indent=0)
        # the face window: head skin alone, id pass
        hidden = []
        for o in sc.objects:
            if o.type == "MESH" and o.name != "head_skin" and not o.hide_render:
                o.hide_render = True
                hidden.append(o)
        materials.set_pass("id")
        sc.render.filepath = os.path.join(still, "facewin.png")
        bpy.ops.render.render(write_still=True)
        materials.set_pass("beauty")
        for o in hidden:
            o.hide_render = False
        print("FACEPASS", still, "chin", out["chin"], "nose", out["nose"])


main()

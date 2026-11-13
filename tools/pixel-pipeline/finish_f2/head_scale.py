"""Route F2 ("proportions for pixel appeal"): scale Rosace's head after the build, at pose time.

The skull, face and hair scale together as one uniform factor `head` about the head joint (the top of the
neck, J_Bip_C_Head's head, level with the mouth at rest). Everything skinned to the head's bone subtree comes
with it: head_skin, the MMD face features (ref_eyes*, ref_mouth, ...: facepass projects them, so the stamps
re-anchor on the bigger face), the hair cap and the clump roots, the veil, the side locks and the crown pin. Hair
weighted to bones outside the subtree (the long back clumps and the tail) keeps its length; the weights blend
the join.

The neck is adjusted so the join stays clean: its width grows by `neck_w` of the head's gain (0.4: a 1.20 head
gets a 1.08 neck, so the neck doesn't read as a stalk), and its length is `neck_l` (1.0 = unchanged). The head's
own scale is divided by the neck's, so the head ends up exactly `head` in every axis (the neck and head bones
share their roll; their long axes are 3.9 degrees apart at rest).

`fit_h` (default on) keeps the figure height H = 144 px fixed: rosace_height is raised by the crown's rise, so
the camera's ppm shrinks and the body loses the same share the head gains (a 1.20 head: the crown rises
5.7 cm = +3.2 %, the body renders 3.1 % smaller, the head +16 % in px). Off, the body keeps its px and she
gets taller.

Nothing here writes a .blend. The Blender side is installed by bl_run.py around an unchanged pipeline script
(gh_render.py, author_faces_pass.py, render_rosace.py): posing.apply_pose becomes the figure-pose lane's
applier (rosace_v2/figure_pose.apply_pose, used read-only; identical to posing.py on the canonical poses,
PS-P22) with the head/neck scales injected into the pose's `bones` scales stage (before the drape), then H is
refit.
"""
import copy
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
PIPE = os.path.dirname(HERE)
HEAD, NECK = "J_Bip_C_Head", "J_Bip_C_Neck"
DEFAULT = {"head": 1.0, "neck_w": 0.4, "neck_l": 1.0, "fit_h": True}


def cfg_from(d):
    c = dict(DEFAULT)
    c.update({k: v for k, v in (d or {}).items() if v is not None})
    return c


def neck_scale(c):
    w = 1.0 + (c["head"] - 1.0) * c["neck_w"]
    return (w, c["neck_l"], w)          # bone-local x, y (along the bone), z


def inject(P, c):
    """a copy of pose dict P with the head/neck scales composed onto any scale it already has"""
    P = copy.deepcopy(P)
    if abs(c["head"] - 1.0) < 1e-9 and abs(c["neck_l"] - 1.0) < 1e-9:
        return P
    nw = neck_scale(c)
    hs = (c["head"] / nw[0], c["head"] / nw[1], c["head"] / nw[2])
    B = P.setdefault("bones", {})
    for bn, k in ((NECK, nw), (HEAD, hs)):
        old = B.get(bn + ".scale", 1.0)
        old = old if isinstance(old, (list, tuple)) else (old, old, old)
        B[bn + ".scale"] = [round(a * b, 6) for a, b in zip(old, k)]
    return P


# ------------------------------------------------------------------------------------------- Blender side
def crown_factor(c):
    """the rest crown height ratio after the scale: (pivot' + (top - pivot) * head) / top, with pivot' the head
    joint moved by the neck length"""
    import bpy
    arm = bpy.data.objects["rosace_rig"]
    B = arm.data.bones
    hs = bpy.data.objects["head_skin"]
    top = max((hs.matrix_world @ v.co).z for v in hs.data.vertices)
    zn, zh = B[NECK].head_local.z, B[HEAD].head_local.z
    zh2 = zn + (zh - zn) * c["neck_l"]
    return (zh2 + (top - zh) * c["head"]) / top, top


def install(c):
    """patch rosace.posing.apply_pose (and so apply_pose_file) in this Blender process"""
    sys.path.insert(0, PIPE)
    sys.path.insert(0, os.path.join(PIPE, "rosace_v2"))
    from rosace import posing
    import figure_pose
    state = {}

    def apply_pose(P):
        import bpy
        meta = figure_pose.apply_pose(inject(P, c))
        arm = bpy.data.objects["rosace_rig"]
        if "h0" not in state:
            state["h0"] = float(arm.get("rosace_height", 1.7))
        f, top = crown_factor(c)
        if c["fit_h"]:
            arm["rosace_height"] = state["h0"] * f
        bpy.context.view_layer.update()
        print("F2_HEAD", {"cfg": c, "crown_factor": round(f, 5), "crown_rest_m": round(top, 4),
                          "rosace_height": round(float(arm["rosace_height"]), 5)}, flush=True)
        meta = dict(meta)
        meta["f2"] = {"cfg": c, "crown_factor": f}
        return meta
    posing.apply_pose = apply_pose
    return apply_pose

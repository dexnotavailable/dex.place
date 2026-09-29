"""Checks for the v2 base: neck-seam close-ups, hero-pose deformation, jiggle settle test.

Two halves, like base_search.py:

1. Inside the isolated Blender (opens a .blend read-only; never saves):
     blender.ps1 --python check_rosace_v2.py '--' --blend <rosace_v2.blend|rosace.blend> --name v2
         --out <dir> --mode closeup|poses|jiggle [--poses a.json,b.json]
   Renders with the pipeline's own toon skin (rosace/materials.py, rosace/render.py camera and
   light). Only 'body' and 'head_skin' are shown (plus the glaive in poses), so v1 and v2 compare
   bare. Pose files go through tools/motion-ai/hero_layer.resolve then rosace/posing.apply_pose,
   exactly as the motion lane poses the rig.

2. Outside Blender (numpy + Pillow): python check_rosace_v2.py --sheets <dir>
   Builds closeup.png, poses_hi.png, poses_px144.png, jiggle.png from the raw renders.
"""
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
POSES = os.path.join(REPO, "art", "rosace", "poses")
DEFAULT_POSES = [
    "motion/n1_coil_r3.json", "motion/n5_coil_r3c.json", "motion/n1_contact_r3b.json",
    "motion/n1_strike_r3c.json", "motion/n5_kneel_r3c.json", "motion/n5_release_r3c.json",
    "idle_hero.json", "n1_contact.json", "n2_pivot.json", "q_stamp.json",
]
SS = 4

try:
    import bpy  # noqa: F401
    IN_BLENDER = True
except ImportError:
    IN_BLENDER = False


# --------------------------------------------------------------------------- Blender half
def b_main():
    import argparse
    import bpy
    from mathutils import Vector as V
    sys.path.insert(0, HERE)
    sys.path.insert(0, os.path.join(REPO, "tools", "motion-ai"))
    from rosace import materials, posing, render

    argv = sys.argv[sys.argv.index("--") + 1:]
    ap = argparse.ArgumentParser()
    ap.add_argument("--blend", required=True)
    ap.add_argument("--name", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--mode", required=True, choices=["closeup", "poses", "jiggle"])
    ap.add_argument("--poses", default=",".join(DEFAULT_POSES))
    ap.add_argument("--ortho", type=float, default=0.42, help="closeup frame size (m)")
    ap.add_argument("--tag", default="neck")
    ap.add_argument("--hi-px", type=int, default=640, help="figure height of the hi-res pose renders")
    ap.add_argument("--no-ao", action="store_true", help="diagnostic: flat 'ao' attribute")
    ap.add_argument("--pose", default="", help="closeup: apply this pose file first")
    ap.add_argument("--centre", default="", help="closeup: x,y,z frame centre (default: the neck)")
    ap.add_argument("--dqs", action="store_true", help="experiment: dual-quaternion skinning on the body")
    a = ap.parse_args(argv)
    out = os.path.join(a.out, "raw", a.name)
    os.makedirs(out, exist_ok=True)
    bpy.ops.wm.open_mainfile(filepath=a.blend, load_ui=False)
    sc = bpy.context.scene
    arm = bpy.data.objects["rosace_rig"]
    show = {"body", "head_skin"}
    for o in bpy.data.objects:
        if o.type == "MESH":
            keep = o.name in show or (a.mode == "poses" and o.name.startswith("glaive"))
            o.hide_render = not keep
    render.setup_engine(sc)
    materials.set_pass("beauty")
    if a.dqs:
        for m in bpy.data.objects["body"].modifiers:
            if m.type == "ARMATURE":
                m.use_deform_preserve_volume = True
    if a.no_ao:
        for o in bpy.data.objects:
            if o.type == "MESH" and "ao" in o.data.attributes:
                at = o.data.attributes["ao"]
                at.data.foreach_set("value", [1.0] * len(at.data))

    def shot(path, px, yaw, elev, ss):
        render.setup_shot(sc, px, yaw=yaw, elev=elev, ss=ss)
        sc.render.filepath = path
        bpy.ops.render.render(write_still=True)

    if a.mode == "closeup":
        # neck seam: a tight ortho frame on the neck, four views, three key-light directions
        cam, sun = render.ensure_camera(sc)
        hm = arm["head_metrics"]
        c = V((0.0, hm["neck"][1], (hm["chin"] + hm["neck"][2]) / 2))
        if a.pose:
            import hero_layer
            P = hero_layer.resolve(json.load(open(os.path.join(POSES, a.pose), encoding="utf-8")))
            for k in [k for k in P.get("bones", {}) if k.split(".")[0] not in arm.pose.bones]:
                P["bones"].pop(k)
            posing.apply_pose(P)
            posing.update()
        if a.centre:
            c = V([float(x) for x in a.centre.split(",")])
        lights = {"key": render.LIGHT_CAM, "top": V((0.1, 0.9, 0.3)).normalized(),
                  "low": V((-0.6, -0.2, 0.75)).normalized()}
        for view, yaw, elev in (("front", 0, 0), ("3q", 40, 5), ("side", 90, 0), ("back", 180, 5),
                                ("under", 25, -25)):
            back, right, up, fwd = render.camera_frame(yaw, elev)
            cam.location = c + back * render.CAM_DIST
            cam.rotation_mode = "QUATERNION"
            cam.rotation_quaternion = fwd.to_track_quat("-Z", "Y")
            cam.data.ortho_scale = a.ortho
            cam.data.clip_end = render.CAM_DIST * 2 + 10
            sc.render.resolution_x = sc.render.resolution_y = 900
            for ln, L in lights.items():
                d = (right * L.x + up * L.y + back * L.z).normalized()
                sun.rotation_mode = "QUATERNION"
                sun.rotation_quaternion = (-d).to_track_quat("-Z", "Y")
                materials.set_spec_half((L + V((0, 0, 1))).normalized())
                materials.set_depth_range(render.CAM_DIST - 3.0, render.CAM_DIST + 3.0)
                sc.render.filepath = os.path.join(out, f"{a.tag}_{view}_{ln}.png")
                bpy.ops.render.render(write_still=True)
        return

    if a.mode == "poses":
        import hero_layer
        meta = {}
        for pf in a.poses.split(","):
            P = json.load(open(os.path.join(POSES, pf), encoding="utf-8"))
            P = hero_layer.resolve(P)
            # outfit chain bones (sleeves, tabard, ...) are not on the bare v2 rig yet
            dropped = [k for k in P.get("bones", {}) if k.split(".")[0] not in arm.pose.bones]
            for k in dropped:
                P["bones"].pop(k)
            m = posing.apply_pose(P)
            posing.update()
            cam = P.get("camera", {})
            yaw, elev = cam.get("yaw", 60.0), cam.get("elev", 10.0)
            nm = os.path.splitext(os.path.basename(pf))[0]
            for view, (y, e) in (("cam", (yaw, elev)), ("front", (15.0, 5.0))):
                shot(os.path.join(out, f"{nm}_{view}_hi.png"), a.hi_px, y, e, 1)
                if a.hi_px == 640:
                    shot(os.path.join(out, f"{nm}_{view}_px144.png"), 144, y, e, SS)
            meta[nm] = {"yaw": yaw, "elev": elev, "name": m["name"], "dropped": dropped}
        json.dump(meta, open(os.path.join(out, "poses.json"), "w"), indent=1)
        return

    if a.mode == "jiggle":
        from rosace_v2 import jiggle
        posing.reset(arm)
        arm.animation_data_create()
        arm.animation_data.action = bpy.data.actions.new("jiggle_test")
        pb = arm.pose.bones
        hips = pb["J_Bip_C_Hips"]
        ch = pb["J_Bip_C_Chest"]
        # 1-40: fall and land (hips drop 12 cm in 6 frames, dead stop); 41-120: run bob at
        # 2.5 Hz with a 4 cm bounce and a torso twist; 121-160: hold still (settle)
        F = 160
        for f in range(1, F + 1):
            if f <= 40:
                t = min(1.0, max(0.0, (f - 6) / 6.0))
                z = 0.12 * (1 - t * t)
                rz = 0.0
            elif f <= 120:
                ph = (f - 40) / 60.0 * 2 * math.pi * 2.5
                z = 0.04 * abs(math.sin(ph))
                rz = 6.0 * math.sin(ph / 2)
            else:
                z, rz = 0.0, 0.0
            hips.location = hips.bone.matrix_local.to_3x3().inverted() @ V((0, 0, z))
            hips.keyframe_insert("location", frame=f)
            posing.set_world_rel(arm, "J_Bip_C_Chest", posing.eul_q((0, 0, rz)))
            ch.keyframe_insert("rotation_quaternion", frame=f)
        sc.frame_start, sc.frame_end = 1, F
        sim = jiggle.bake(arm, 1, F)
        rec = {}
        for f, bones in sim.items():
            rec[f] = {n: [(x - t).length for x, t, h in [v]][0] for n, v in bones.items()}
        json.dump({"settings": jiggle.settings(arm), "offset_m": rec}, open(os.path.join(out, "jiggle.json"), "w"))
        # side-view 144 px strip through the landing and the first bob
        for f in list(range(6, 40, 2)) + [60, 64, 68, 72]:
            sc.frame_set(f)
            render.setup_shot(sc, 144, yaw=90.0, elev=0.0, ss=SS, canvas=(80, 176), anchor=(40, 166))
            sc.render.filepath = os.path.join(out, f"jig_{f:03d}.png")
            bpy.ops.render.render(write_still=True)
        return


# --------------------------------------------------------------------------- sheets half
def pixelate(path, ss=SS, outline=(24, 16, 50)):
    import numpy as np
    from PIL import Image
    im = np.asarray(Image.open(path).convert("RGBA")).astype(np.int32)
    h, w = im.shape[:2]
    H2, W2 = h // ss, w // ss
    blk = im[:H2 * ss, :W2 * ss].reshape(H2, ss, W2, ss, 4).transpose(0, 2, 1, 3, 4).reshape(H2, W2, ss * ss, 4)
    out = np.zeros((H2, W2, 4), np.uint8)
    for y in range(H2):
        for x in range(W2):
            b = blk[y, x]
            on = b[b[:, 3] > 127]
            if len(on) * 2 < ss * ss:
                continue
            keys, cnt = np.unique(on[:, :3], axis=0, return_counts=True)
            out[y, x, :3] = keys[cnt.argmax()]
            out[y, x, 3] = 255
    al = out[..., 3] > 0
    ring = np.zeros_like(al)
    ring[1:] |= al[:-1]
    ring[:-1] |= al[1:]
    ring[:, 1:] |= al[:, :-1]
    ring[:, :-1] |= al[:, 1:]
    ring &= ~al
    out[ring] = outline + (255,)
    return Image.fromarray(out)


def _label(img, text, bg=(24, 22, 34), pad=20):
    from PIL import Image, ImageDraw
    c = Image.new("RGBA", (img.width, img.height + pad), bg + (255,))
    c.alpha_composite(img, (0, pad))
    ImageDraw.Draw(c).text((5, 4), text, fill=(235, 232, 245, 255))
    return c


def _on_bg(img, bg=(24, 22, 34)):
    from PIL import Image
    c = Image.new("RGBA", img.size, bg + (255,))
    c.alpha_composite(img.convert("RGBA"))
    return c


def _grid(tiles, cols, bg=(24, 22, 34)):
    from PIL import Image
    W = max(t.width for t in tiles)
    H = max(t.height for t in tiles)
    rows = (len(tiles) + cols - 1) // cols
    S = Image.new("RGBA", (W * cols, H * rows), bg + (255,))
    for i, t in enumerate(tiles):
        S.alpha_composite(t, ((i % cols) * W, (i // cols) * H))
    return S


def _fit(img, h):
    from PIL import Image
    return img.resize((max(1, round(img.width * h / img.height)), h), Image.LANCZOS)


def sheets(d):
    from PIL import Image, ImageDraw
    raw = os.path.join(d, "raw")
    names = sorted(os.listdir(raw))
    # neck close-ups
    for nm in names:
        for tag in sorted({f.split("_")[0] for f in os.listdir(os.path.join(raw, nm)) if f.startswith(("neck", "seam"))}):
            files = sorted(f for f in os.listdir(os.path.join(raw, nm)) if f.startswith(tag + "_"))
            tiles = [_label(_fit(_on_bg(Image.open(os.path.join(raw, nm, f))), 360), f[len(tag) + 1:-4]) for f in files]
            _grid(tiles, 3).save(os.path.join(d, f"{tag}_{nm}.png"))
    # poses: per pose, v1 | v2 side by side (hi-res and 144 px x3)
    pose_sets = [nm for nm in names if os.path.exists(os.path.join(raw, nm, "poses.json"))]
    if pose_sets:
        order = list(json.load(open(os.path.join(raw, pose_sets[-1], "poses.json"))))
        for kind in ("hi", "px144"):
            tiles = []
            for p in order:
                for view in ("cam", "front"):
                    row = []
                    for nm in pose_sets:
                        f = os.path.join(raw, nm, f"{p}_{view}_{kind}.png")
                        if not os.path.exists(f):
                            continue
                        im = pixelate(f) if kind == "px144" else Image.open(f)
                        if kind == "px144":
                            im = im.resize((im.width * 3, im.height * 3), Image.NEAREST)
                        row.append(_label(_fit(_on_bg(im), 520), f"{nm} {p} {view}"))
                    if row:
                        W = sum(r.width for r in row)
                        t = Image.new("RGBA", (W, row[0].height), (24, 22, 34, 255))
                        x = 0
                        for r in row:
                            t.alpha_composite(r, (x, 0))
                            x += r.width
                        tiles.append(t)
            _grid(tiles, 2).save(os.path.join(d, f"poses_{kind}.png"))
    # jiggle
    for nm in names:
        jf = os.path.join(raw, nm, "jiggle.json")
        if not os.path.exists(jf):
            continue
        J = json.load(open(jf))
        rec = {int(k): v for k, v in J["offset_m"].items()}
        frames = sorted(rec)
        bones = sorted(rec[frames[0]])
        W, H, pad = 1200, 420, 40
        img = Image.new("RGBA", (W, H), (24, 22, 34, 255))
        dr = ImageDraw.Draw(img)
        ymax = max(max(v.values()) for v in rec.values()) or 1e-3
        cols = [(240, 150, 170), (250, 200, 120), (140, 200, 250), (160, 230, 160), (200, 160, 250), (230, 230, 230)]
        for i, b in enumerate(bones):
            pts = [(pad + (f - frames[0]) / (frames[-1] - frames[0]) * (W - 2 * pad),
                    H - pad - rec[f][b] / ymax * (H - 2 * pad)) for f in frames]
            dr.line(pts, fill=cols[i % len(cols)] + (255,), width=2)
            dr.text((pad + 10, 10 + 14 * i), f"{b} ({J['settings'][[k for k, v in J['settings'].items() if b in v['bones']][0]]['omega']} rad/f)",
                    fill=cols[i % len(cols)] + (255,))
        for f in (6, 12, 40, 120):
            x = pad + (f - frames[0]) / (frames[-1] - frames[0]) * (W - 2 * pad)
            dr.line([(x, pad), (x, H - pad)], fill=(90, 90, 110, 255))
        dr.text((W - 520, 10), f"tip lag (m, max {ymax:.3f}); land f6-12, run bob f40-120, hold f120-160 (60 fps)",
                fill=(235, 232, 245, 255))
        strip = [f for f in sorted(os.listdir(os.path.join(raw, nm))) if f.startswith("jig_")]
        tiles = [_label(pixelate(os.path.join(raw, nm, f)).resize((80 * 3, 176 * 3), Image.NEAREST), f[4:7]) for f in strip]
        S = _grid(tiles, 11)
        out = Image.new("RGBA", (max(W, S.width), H + S.height), (24, 22, 34, 255))
        out.alpha_composite(img, (0, 0))
        out.alpha_composite(S, (0, H))
        out.save(os.path.join(d, f"jiggle_{nm}.png"))


if __name__ == "__main__":
    if IN_BLENDER:
        b_main()
    else:
        sheets(sys.argv[sys.argv.index("--sheets") + 1])

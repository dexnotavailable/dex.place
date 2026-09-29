"""Render Rosace passes at a target character height (stills and animation share this).

Scale: pixels-per-metre comes from the model's rest height (skull top to sole, weapon and
hair volume excluded, stored on the rig as 'rosace_height'), so every pose and frame of a
given size uses the same pixel scale.  Screen frame: the camera orbits her; the key light
and the specular half vector are fixed in camera space (Guilty Gear style per-character
light), so the lighting reads the same in every shot.
"""
import json
import math
import os

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Matrix, Vector

from . import materials

V = Vector
LIGHT_CAM = V((0.50, 0.62, 0.60)).normalized()   # upper front, from the side she faces (screen right)
CAM_DIST = 12.0


def setup_engine(sc):
    R = sc.render
    try:
        R.engine = "BLENDER_EEVEE"
    except TypeError:
        R.engine = "BLENDER_EEVEE_NEXT"
    R.filter_size = 0.0
    R.dither_intensity = 0.0
    R.film_transparent = True
    R.resolution_percentage = 100
    R.image_settings.file_format = "PNG"
    R.image_settings.color_mode = "RGBA"
    R.image_settings.color_depth = "8"
    sc.eevee.taa_render_samples = 1
    sc.view_settings.view_transform = "Raw"
    sc.view_settings.look = "None"
    sc.view_settings.exposure = 0.0
    sc.view_settings.gamma = 1.0
    sc.display_settings.display_device = "sRGB"
    if sc.world is None:
        sc.world = bpy.data.worlds.new("w")
    sc.world.use_nodes = True
    bg = next((n for n in sc.world.node_tree.nodes if n.type == "BACKGROUND"), None)
    if bg:
        bg.inputs[1].default_value = 0.0


def camera_frame(yaw_deg, elev_deg):
    """yaw 0 = camera in front of her (she faces -Y); 90 = camera on her right (-X side), so
    she faces screen-right. Returns (back, right, up, fwd) unit vectors in world."""
    a, e = math.radians(yaw_deg), math.radians(elev_deg)
    # horizontal direction from her to the camera
    h = V((-math.sin(a), -math.cos(a), 0.0))
    back = (h * math.cos(e) + V((0, 0, math.sin(e)))).normalized()
    fwd = -back
    right = fwd.cross(V((0, 0, 1))).normalized()
    up = right.cross(fwd).normalized()
    return back, right, up, fwd


def ensure_camera(sc):
    cam = sc.objects.get("render_cam")
    if cam is None:
        cd = bpy.data.cameras.new("render_cam")
        cd.type = "ORTHO"
        cam = bpy.data.objects.new("render_cam", cd)
        sc.collection.objects.link(cam)
    sc.camera = cam
    sun = sc.objects.get("key_light")
    if sun is None:
        ld = bpy.data.lights.new("key_light", "SUN")
        ld.energy = math.pi
        ld.angle = 0.0
        ld.use_shadow = False
        sun = bpy.data.objects.new("key_light", ld)
        sc.collection.objects.link(sun)
    return cam, sun


def render_objects(sc):
    return [o for o in sc.objects if o.type == "MESH" and not o.hide_render]


def projected_bounds(sc, cam, obs, right, up):
    dg = bpy.context.evaluated_depsgraph_get()
    xs, ys = [], []
    for ob in obs:
        ev = ob.evaluated_get(dg)
        me = ev.to_mesh()
        M = ob.matrix_world
        for v in me.vertices:
            p = M @ v.co
            xs.append(p.dot(right))
            ys.append(p.dot(up))
        ev.to_mesh_clear()
    return min(xs), max(xs), min(ys), max(ys)


def setup_shot(sc, px, yaw=60.0, elev=10.0, ss=1, canvas=None, anchor=None, pad=6, height=None, frames=None):
    """Place camera and light; size the canvas to fit everything visible (or use canvas).
    Returns shot metadata (ppm, canvas, camera basis, anchor pixel of the world origin)."""
    arm = sc.objects.get("rosace_rig")
    H = height or (arm["rosace_height"] if arm and "rosace_height" in arm else 1.7)
    ppm = px / H
    cam, sun = ensure_camera(sc)
    back, right, up, fwd = camera_frame(yaw, elev)
    obs = render_objects(sc)
    if frames:
        bs = []
        for f in frames:
            sc.frame_set(f)
            bs.append(projected_bounds(sc, cam, obs, right, up))
        x0, x1 = min(b[0] for b in bs), max(b[1] for b in bs)
        y0, y1 = min(b[2] for b in bs), max(b[3] for b in bs)
        sc.frame_set(frames[0])
    else:
        x0, x1, y0, y1 = projected_bounds(sc, cam, obs, right, up)
    if canvas is None:
        W = int(math.ceil((x1 - x0) * ppm)) + 2 * pad
        Hc = int(math.ceil((y1 - y0) * ppm)) + 2 * pad
        # origin (between her feet) lands on an integer pixel
        ax = int(math.floor((0.0 - x0) * ppm)) + pad
        ay = int(math.floor((y1 - 0.0) * ppm)) + pad
    else:
        W, Hc = canvas
        ax, ay = anchor
    # camera centre such that world origin projects to pixel (ax, ay) corner
    cx = (W / 2.0 - ax) / ppm
    cy = (ay - Hc / 2.0) / ppm
    target = right * cx + up * cy
    cam.location = target + back * CAM_DIST
    cam.rotation_mode = "QUATERNION"
    cam.rotation_quaternion = fwd.to_track_quat("-Z", "Y")
    cam.data.ortho_scale = max(W, Hc) / ppm
    cam.data.clip_start = 0.1
    cam.data.clip_end = CAM_DIST * 2 + 10
    sc.render.resolution_x = W * ss
    sc.render.resolution_y = Hc * ss
    # light fixed in camera space
    # (cam.matrix_world is stale until the depsgraph updates, so use the basis directly)
    light_to = (right * LIGHT_CAM.x + up * LIGHT_CAM.y + back * LIGHT_CAM.z).normalized()
    sun.rotation_mode = "QUATERNION"
    sun.rotation_quaternion = (-light_to).to_track_quat("-Z", "Y")
    h = (LIGHT_CAM + V((0, 0, 1))).normalized()
    materials.set_spec_half(h)
    materials.set_depth_range(CAM_DIST - 3.0, CAM_DIST + 3.0)
    return {"px": px, "ss": ss, "ppm": ppm, "height_m": H, "canvas": [W, Hc], "anchor": [ax, ay],
            "yaw": yaw, "elev": elev, "light_cam": list(LIGHT_CAM),
            "depth_range": [CAM_DIST - 3.0, CAM_DIST + 3.0],
            "cam": {"loc": list(cam.location), "right": list(right), "up": list(up), "fwd": list(fwd)}}


def project(sc, p):
    co = world_to_camera_view(sc, sc.camera, p)
    W, H = sc.render.resolution_x, sc.render.resolution_y
    return [co.x * W, (1.0 - co.y) * H, co.z]


def render_passes(sc, out_dir, passes=("beauty", "albedo", "id", "normal", "depth"), frames=None):
    """Render each pass. frames=None -> current frame as still '<pass>.png';
    otherwise '<pass>/####.png' for each frame."""
    os.makedirs(out_dir, exist_ok=True)
    for p in passes:
        materials.set_pass(p)
        if frames is None:
            sc.render.filepath = os.path.join(out_dir, f"{p}.png")
            bpy.ops.render.render(write_still=True)
        else:
            d = os.path.join(out_dir, p)
            os.makedirs(d, exist_ok=True)
            for f in frames:
                sc.frame_set(f)
                sc.render.filepath = os.path.join(d, f"{f:04d}.png")
                bpy.ops.render.render(write_still=True)
    materials.set_pass("beauty")


def material_table():
    P = materials.palette()
    return {name: {"id": cfg["id"], "ramp": cfg["ramp"], "line": cfg["line"], "selout": cfg["selout"],
                   "inner": cfg["inner"], "spec": cfg.get("spec", {}).get("code")}
            for name, cfg in P["materials"].items()}


def write_meta(path, shot, extra=None):
    meta = dict(shot)
    meta["materials"] = material_table()
    meta["colors"] = materials.palette()["colors"]
    meta["parts"] = {o.get("part", o.name): o.pass_index for o in bpy.context.scene.objects
                     if o.type == "MESH"}
    if extra:
        meta.update(extra)
    with open(path, "w") as f:
        json.dump(meta, f, indent=1)

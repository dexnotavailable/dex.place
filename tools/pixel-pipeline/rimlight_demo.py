"""Runtime-lighting proof: light the baked sprite from its exported normal map (numpy only).

Normal map convention: RGB = camera-space normal * 0.5 + 0.5, x right, y up, z toward viewer
(OpenGL style). Outline pixels carry an outward normal so rims land on the silhouette.

usage: python rimlight_demo.py <out_dir> [tag] [frame]
writes <out_dir>/rimlight_demo_x4.png, rimlight_orbit.gif, rimlight_attack_x3.gif
"""
import json
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

d = sys.argv[1]
tag = sys.argv[2] if len(sys.argv) > 2 else "final"
FR = int(sys.argv[3]) if len(sys.argv) > 3 else 9
info = json.load(open(os.path.join(d, f"{tag}_strip.json")))
cw, ch = info["frame_size"]
frames = info["frames"]
S = np.asarray(Image.open(os.path.join(d, f"{tag}_sprite_strip_charonly.png")).convert("RGBA")).astype(float)
N = np.asarray(Image.open(os.path.join(d, f"{tag}_normal_strip.png")).convert("RGBA")).astype(float)
A = np.asarray(Image.open(os.path.join(d, f"{tag}_albedo_strip.png")).convert("RGBA")).astype(float)
BG = np.array([112, 112, 118], float)


def cut(arr, i):
    return arr[:, i * cw:(i + 1) * cw]


def normals(nm):
    n = nm[..., :3] / 255.0 * 2 - 1
    n /= np.linalg.norm(n, axis=-1, keepdims=True) + 1e-6
    return n, nm[..., 3] > 0


def rim(sprite, nm, L, color, strength=(0.75, 0.38), thresholds=(0.55, 0.30)):
    """pixel-art rim: two hard steps of n.L for light coming from the side/back"""
    n, a = normals(nm)
    L = np.asarray(L, float)
    L /= np.linalg.norm(L)
    nl = (n * L).sum(-1)
    out = sprite.copy()
    col = np.asarray(color, float)
    s1 = a & (nl > thresholds[0])
    s2 = a & (nl > thresholds[1]) & ~s1
    for sel, k in ((s1, strength[0]), (s2, strength[1])):
        out[sel, :3] = out[sel, :3] * (1 - k) + col * k
    return out


def relight(albedo, nm, L, color, ambient=0.28):
    """full relight: flat albedo x quantised Lambert (3 steps) with a coloured light"""
    n, a = normals(nm)
    L = np.asarray(L, float)
    L /= np.linalg.norm(L)
    nl = np.clip((n * L).sum(-1), 0, 1)
    q = np.digitize(nl, [0.15, 0.5, 0.85]) / 3.0
    light = ambient + (1 - ambient) * q[..., None] * (np.asarray(color, float) / 255.0)
    out = albedo.copy()
    out[..., :3] = np.clip(albedo[..., :3] * light, 0, 255)
    out[~a, 3] = 0
    return out


def on_bg(rgba):
    a = rgba[..., 3:4] / 255.0
    return (rgba[..., :3] * a + BG * (1 - a)).astype(np.uint8)


i = frames.index(FR)
spr, nm, alb = cut(S, i), cut(N, i), cut(A, i)
RED, CYAN, WARM = (255, 70, 60), (90, 230, 255), (255, 190, 120)
panels = [("baked toon sprite", spr),
          ("+ red rim, enemy fire behind-right", rim(spr, nm, (0.85, 0.15, -0.5), RED)),
          ("+ cyan rim from the left", rim(spr, nm, (-0.9, 0.25, -0.35), CYAN)),
          ("full relight: warm light from below", relight(alb, nm, (0.2, -0.8, 0.55), WARM)),
          ("normal map", nm)]
# crop the panels to this frame's character bounds
ys, xs = np.nonzero(spr[..., 3] > 0)
bx0, bx1, by0, by1 = max(0, xs.min() - 3), min(cw, xs.max() + 4), max(0, ys.min() - 3), min(ch, ys.max() + 4)
panels = [(nme, p[by0:by1, bx0:bx1]) for nme, p in panels]
pw, ph = bx1 - bx0, by1 - by0
Z = 4 if ph < 150 else 2
try:
    font = ImageFont.load_default(size=20)
except TypeError:
    font = ImageFont.load_default()
sheet = Image.new("RGB", (len(panels) * (pw * Z + 12) + 12, ph * Z + 44), (24, 24, 28))
dr = ImageDraw.Draw(sheet)
for k, (name, p) in enumerate(panels):
    im = Image.fromarray(on_bg(p)).resize((pw * Z, ph * Z), Image.NEAREST)
    x = 12 + k * (pw * Z + 12)
    sheet.paste(im, (x, 38))
    dr.text((x, 8), name, fill=(230, 220, 160), font=font)
sheet.save(os.path.join(d, f"rimlight_demo_x{Z}.png"))

# light orbiting a held frame
orbit = []
for k in range(24):
    th = 2 * math.pi * k / 24
    L = (math.cos(th), math.sin(th), -0.35)
    p = rim(spr, nm, L, RED if math.cos(th) > 0 else CYAN)
    orbit.append(Image.fromarray(on_bg(p[by0:by1, bx0:bx1])).resize((pw * Z, ph * Z), Image.NEAREST))
orbit[0].save(os.path.join(d, "rimlight_orbit.gif"), save_all=True, append_images=orbit[1:], duration=60, loop=0)

# whole attack lit by a fixed red rim from behind-right (the lighting follows the animation)
att = []
for j in range(len(frames)):
    p = rim(cut(S, j), cut(N, j), (0.85, 0.15, -0.5), RED)
    att.append(Image.fromarray(on_bg(p)).resize((cw * 3, ch * 3), Image.NEAREST))
dur = [20] * len(att)
dur[0] += 120
dur[-1] += 250
att[0].save(os.path.join(d, "rimlight_attack_x3.gif"), save_all=True, append_images=att[1:], duration=dur, loop=0)
print("wrote rim demo to", d)

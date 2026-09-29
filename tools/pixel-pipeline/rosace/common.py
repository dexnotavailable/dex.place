"""Shared paths, palette access and small maths for the Rosace build (runs inside Blender).

Coordinate convention for the model (VRM's, kept so retargeting stays simple):
  +Z up, she faces -Y, her left is +X. Units are metres of the base VRM, restyled.
"""
import json
import math
import os

HERE = os.path.dirname(os.path.abspath(__file__))
PIPE = os.path.dirname(HERE)                                   # tools/pixel-pipeline
REPO = os.path.dirname(os.path.dirname(PIPE))                  # dex.place
ART = os.path.join(REPO, "art", "rosace")
PALETTE_JSON = os.path.join(ART, "palette.json")
POSES_DIR = os.path.join(ART, "poses")
DOWNLOADS = os.environ.get("DEXPLACE_DOWNLOADS", r"D:\Dex\Inbox\Downloads\dexplace-character")
BASE_VRM = os.path.join(DOWNLOADS, "vrm", "HairSample_Female.vrm")
BUILD = os.environ.get("ROSACE_BUILD", r"D:\Dex\Projects\dex-place-art\rosace\build")
REVIEW = os.path.join(REPO, "review", "rosace")


def load_palette():
    with open(PALETTE_JSON, encoding="utf-8") as f:
        return json.load(f)


def hex2rgb(h):
    return tuple(int(h[i:i + 2], 16) / 255.0 for i in (1, 3, 5))


def smoothstep(e0, e1, x):
    t = max(0.0, min(1.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


def gauss(x, c, s):
    return math.exp(-0.5 * ((x - c) / s) ** 2)


def lerp(a, b, t):
    return a + (b - a) * t


def args_after_dashes(argv):
    return argv[argv.index("--") + 1:] if "--" in argv else []


def arg(argv, name, default=None, cast=str):
    if name in argv:
        i = argv.index(name)
        if cast is bool:
            return True
        return cast(argv[i + 1])
    return default

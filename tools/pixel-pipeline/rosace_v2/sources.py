"""Third-party inputs for the v2 base (see ../THIRD_PARTY.md for the licence quotes)."""
import hashlib
import os

BASES = os.environ.get("ROSACE_BASES", r"D:\Dex\Projects\dex-place-art\rosace\bases")

SOURCES = {
    "siroino": {
        "path": os.path.join(BASES, "siroino", "SiroinoSotai_1.0", "SiroinoSotai.blend"),
        "sha256": "d5bc3c6031d0f095c6ae509b19a71c3e2b33f3f9f1f43fbc4dc5b1132d7dd677",
        "objects": ("Armature", "SiroinoSotai_PC"),
        "credit": "SiroinoSotai by しろいの (CC0 1.0, BOOTH 8268676)",
    },
    "primero": {
        "path": os.path.join(BASES, "primero", "MMD用女性素体", "mmdBodyWoman.blend"),
        "sha256": "ff62d62fa0e30c2dfc805136cb1b6f942416722c76e325ae3b8ca71073f3609e",
        "objects": ("00_Rig", "01_Body", "02_Eyes", "02_Eyes_Highlight", "02_Eyes_White", "03_Eyeblow",
                    "03_Eyelid", "03_Eyelush", "04_Mouth", "04_Tongue", "04_Tooth"),
        "credit": "MMD用女性素体 by 射当ユウキ (プリメロ工房, BOOTH 1958825)",
    },
}


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def verify(name):
    s = SOURCES[name]
    got = sha256(s["path"])
    if got != s["sha256"]:
        raise SystemExit(f"{name}: sha256 mismatch {got} != {s['sha256']} ({s['path']})")
    return s["path"]


def append(path, names):
    """append objects (and everything they use) from a .blend without opening it"""
    with __import__("bpy").data.libraries.load(path, link=False) as (src, dst):
        dst.objects = [n for n in src.objects if n in names]
    import bpy
    out = {}
    for ob in dst.objects:
        if ob is None:
            continue
        bpy.context.scene.collection.objects.link(ob)
        out[ob.name] = ob
    return out

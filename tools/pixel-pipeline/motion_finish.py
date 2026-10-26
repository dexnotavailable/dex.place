"""Motion frames finish (Integrate step, 2026-09-29): the part of the stills' lane passes a motion
frame can take without the stills-only inputs (light/depth2 passes, face pass, grip landmarks).

  python tools/pixel-pipeline/motion_finish.py --dir <motion-ai>/renders/<name>/px<N> [--config art/rosace/integrated.json]

Per sprite_####.png (rosace_post.py --frames output, smear already on), using sprite_####_id.png:
  1. retone by ramp index: each material the shading preset lists 'tones' for (stocking, boot, and the
     ones whose tones equal the build ramp, which do not change) takes the preset's tone at the same
     ramp index, and its spec code takes the preset's 'spec'. This is how the stills' shading stage
     turns the build's indigo stockings into the K ramp; the frames get the colours, not the re-banded
     terminators (those need the light pass, which the motion renders do not write).
  2. the preset's palette remap (rosace_shade_stills.remap)
  3. the hair lane's hue trial on hair pixels (integrated.json 'hair_hue_base')
The raw frame is kept as sprite_####_raw.png, so a rerun starts from it. Faces, hands, outfit and hair
pixel passes are stills-only today (PIPELINE.md 3.6g, 'Motion').
"""
import argparse
import glob
import json
import os
import shutil
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)


def rgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def finish(d, cfg):
    import hair_px
    import rosace_shade_stills
    st = cfg["stills"]
    P = json.load(open(os.path.join(REPO, st["shading"]), encoding="utf-8")) if st.get("shading") else {}
    meta = json.load(open(os.path.join(d, "meta.json")))
    pal = meta["colors"]
    n = 0
    for sp in sorted(glob.glob(os.path.join(d, "sprite_[0-9][0-9][0-9][0-9].png"))):
        raw = sp[:-4] + "_raw.png"
        if not os.path.exists(raw):
            shutil.copyfile(sp, raw)
        img = np.array(Image.open(raw).convert("RGBA"))
        ids = np.array(Image.open(sp[:-4] + "_id.png").convert("RGBA"))
        out = img.copy()
        for name, mcfg in (P.get("materials") or {}).items():
            m = meta["materials"].get(name)
            tones = mcfg.get("tones")
            if not m or not tones or mcfg.get("mode"):      # gold's 'trim2' is an edge rule, not a ramp
                continue
            on = (ids[..., 3] > 0) & (ids[..., 0] == m["id"]) & (img[..., 3] > 0)
            pairs = list(zip(m["ramp"], tones))
            if m.get("spec") and mcfg.get("spec"):
                pairs.append((m["spec"], mcfg["spec"]))
            done = {}
            for src, dst in pairs:
                if src in done or src not in pal or dst not in pal:
                    continue
                done[src] = dst
                sel = on & (img[..., :3] == rgb(pal[src])).all(-1)
                out[sel, :3] = rgb(pal[dst])
        Image.fromarray(out).save(sp)
        rosace_shade_stills.remap(sp, P.get("colors"))
        if st.get("hair_px") and "hue" in hair_px.PRESETS[st["hair_px"]["preset"]]["steps"]:
            im = np.array(Image.open(sp).convert("RGBA"))
            hair = (ids[..., 3] > 0) & (ids[..., 0] == meta["materials"]["hair"]["id"]) & (im[..., 3] > 0)
            colors = P.get("colors") or {}
            for c in ("I1", "I2", "I3"):
                hexc = colors.get(c) or pal[c]
                sel = hair & (im[..., :3] == rgb(hexc)).all(-1)
                base = hexc if st.get("hair_hue_base", "remapped") == "remapped" else pal[c]
                im[sel, :3] = hair_px.hue_shift(base, 0.028, 0.90)
            Image.fromarray(im).save(sp)
        n += 1
    return n


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", required=True)
    ap.add_argument("--config", default=os.path.join(REPO, "art", "rosace", "integrated.json"))
    a = ap.parse_args()
    print("motion_finish", a.dir, finish(a.dir, json.load(open(a.config, encoding="utf-8"))), "frames")

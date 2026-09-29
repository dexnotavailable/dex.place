"""Stick-figure preview of a BVH as MP4 + GIF (+ an optional contact sheet PNG), with a proxy glaive.

  python tools/motion-ai/motion_preview.py clip.bvh --out review/motion/previews/clip \
      [--sheet] [--every 4] [--title "N1 v2"] [--no-gif] [--glaive 2.3]

Writes <out>.mp4 (H.264, the source fps), <out>.gif (half size) and, with --sheet, <out>_sheet.png
(side view every --every frames, frame numbers printed). Needs numpy, pillow and ffmpeg
(D:/Dex/Tools/ffmpeg-9.0.1-full_build/bin, or $DEXPLACE_FFMPEG).

Three panels, all in fixed world framing (the camera never follows), so root motion and foot
sliding show as they are:
  SIDE  looking along the character's -X: horizontal = world Z (her facing at heading 0 = right),
        up = Y. This is the plane the game sprites show.
  FRONT looking along -Z: horizontal = X.
  TOP   looking down: horizontal = X, vertical = Z (up the panel = her start facing). Spins read here.

Colours: left side blue, right side orange, centre grey. Feet turn red while planted (the same
test motion_qc.py uses). The glaive is a PROXY, not tracked by any model: when the wrists are
0.15-0.85 m apart it is drawn along the right-wrist -> left-wrist line, the butt 0.35 m behind the
right wrist and the tip at --glaive metres total (default 2.3 m = 1.35 H on the 1.76 m SOMA
body). One-handed stretches get no glaive.
"""
import argparse
import os
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
from bvh_tools import Bvh  # noqa: E402

FFMPEG = os.environ.get("DEXPLACE_FFMPEG", r"D:\Dex\Tools\ffmpeg-9.0.1-full_build\bin\ffmpeg.exe")
FOOT = ("LeftFoot", "LeftToeBase", "RightFoot", "RightToeBase")
SKIP_PREFIX = ("LeftHandThumb", "LeftHandIndex", "LeftHandRing", "LeftHandPinky",
               "RightHandThumb", "RightHandIndex", "RightHandRing", "RightHandPinky",
               "LeftEye", "RightEye", "Jaw")


def colour(name):
    n = name.lower()
    if n.startswith("left"):
        return (40, 90, 220)
    if n.startswith("right"):
        return (235, 120, 20)
    return (90, 90, 90)


def planted_mask(P, names, fps):
    m = np.zeros((len(P), len(names)), bool)
    for jn in FOOT:
        if jn not in names:
            continue
        j = names.index(jn)
        p = P[:, j]
        rest = np.percentile(p[:, 1], 5)
        vy = np.abs(np.gradient(p[:, 1]) * fps)
        m[:, j] = (p[:, 1] < rest + 2.5) & (vy < 20)
    return m


def glaive(P, names, length_cm):
    """(F, 2, 3) butt/tip or NaN where one-handed."""
    r, l = P[:, names.index("RightHand")], P[:, names.index("LeftHand")]
    d = l - r
    dist = np.linalg.norm(d, axis=-1, keepdims=True)
    u = d / np.maximum(dist, 1e-6)
    butt = r - u * 35.0
    tip = butt + u * length_cm
    g = np.stack([butt, tip], 1)
    ok = (dist[:, 0] >= 15) & (dist[:, 0] <= 85)
    g[~ok] = np.nan
    return g


def render(bvh_path, title="", glaive_m=2.3, panel_h=420):
    b = Bvh(bvh_path)
    P = b.positions()
    names = b.names
    F = len(P)
    keep = [j for j, n in enumerate(names)
            if n != "Root" and not n.endswith("_end") and not n.startswith(SKIP_PREFIX)]
    bones = [(b.parents[j], j) for j in keep if b.parents[j] >= 0 and names[b.parents[j]] != "Root"]
    G = glaive(P, names, glaive_m * 100)
    plant = planted_mask(P, names, b.fps)
    hips = names.index("Hips")

    allp = np.concatenate([P[:, keep].reshape(-1, 3), G[~np.isnan(G[:, 0, 0])].reshape(-1, 3)], 0)
    lo, hi = allp.min(0), allp.max(0)
    lo[1] = min(lo[1], 0.0)
    pad = 20.0
    lo, hi = lo - pad, hi + pad

    # scale so the tallest extent fits the panel; horizontal extents set panel widths
    s_main = (panel_h - 40) / (hi[1] - lo[1])
    s_top = min(s_main, (panel_h - 40) / max(1.0, hi[2] - lo[2]))  # top view gets its own scale
    views = {
        "SIDE": (2, 1, +1, -1),   # horiz axis, vert axis, horiz sign, vert sign (screen y down)
        "FRONT": (0, 1, -1, -1),  # looking along -Z from the front: her left (+X) on screen right? mirror so it reads as facing us
        "TOP": (0, 2, -1, -1),
    }
    scale = {"SIDE": s_main, "FRONT": s_main, "TOP": s_top}
    widths = {k: int((hi[h] - lo[h]) * scale[k]) + 40 for k, (h, v, _, _) in views.items()}
    widths = {k: max(w, 160) for k, w in widths.items()}
    W = sum(widths.values())
    H = panel_h + 26
    frames, hips_x = [], []
    for f in range(F):
        img = Image.new("RGB", (W, H), (250, 250, 247))
        d = ImageDraw.Draw(img)
        x0 = 0
        for vname, (ha, va, hs, vs) in views.items():
            w = widths[vname]
            s = scale[vname]

            def px(p, ha=ha, va=va, hs=hs, vs=vs, x0=x0, w=w, s=s):
                hx = (p[ha] - lo[ha]) if hs > 0 else (hi[ha] - p[ha])
                vy = (hi[va] - p[va]) if vs < 0 else (p[va] - lo[va])
                return (x0 + 20 + hx * s, 26 + 20 + vy * s)

            d.rectangle([x0, 26, x0 + w - 1, H - 1], outline=(215, 215, 210))
            if vname == "SIDE":
                hips_x.append(px(P[f, hips])[0])
            d.text((x0 + 6, 30), vname, fill=(120, 120, 120))
            if va == 1:  # floor line + 50 cm ticks
                y = px(np.array([0, 0, 0.0]))[1]
                d.line([(x0, y), (x0 + w, y)], fill=(170, 170, 160))
                for t in np.arange(np.ceil(lo[ha] / 50) * 50, hi[ha], 50):
                    q = np.zeros(3); q[ha] = t
                    xx = px(q)[0]
                    d.line([(xx, y), (xx, y + 5)], fill=(150, 150, 140))
                # hips trail
                trail = [px(P[k, hips]) for k in range(max(0, f - 20), f + 1)]
                if len(trail) > 1:
                    d.line(trail, fill=(200, 200, 200), width=1)
            g = G[f]
            if not np.isnan(g[0, 0]):
                a, c = px(g[0]), px(g[1])
                d.line([a, c], fill=(120, 60, 150), width=3)
                d.ellipse([c[0] - 4, c[1] - 4, c[0] + 4, c[1] + 4], fill=(170, 60, 200))
            for p_, j in bones:
                d.line([px(P[f, p_]), px(P[f, j])], fill=colour(names[j]), width=3)
            hp = px(P[f, names.index("Head")])
            d.ellipse([hp[0] - 7, hp[1] - 7, hp[0] + 7, hp[1] + 7], outline=(90, 90, 90), width=2)
            for jn in FOOT:
                if jn in names and plant[f, names.index(jn)]:
                    q = px(P[f, names.index(jn)])
                    d.ellipse([q[0] - 4, q[1] - 4, q[0] + 4, q[1] + 4], fill=(220, 30, 30))
            x0 += w
        d.text((6, 6), f"{title or Path(bvh_path).stem}   frame {f:3d}/{F - 1}   t={f / b.fps:5.2f}s   "
                        f"(glaive = proxy from wrists)", fill=(0, 0, 0))
        frames.append(img)
    render.hips_x = hips_x
    return frames, b.fps


def write_video(frames, fps, out_mp4, out_gif=None):
    W, H = frames[0].size
    W2, H2 = W - W % 2, H - H % 2
    cmd = [FFMPEG, "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W2}x{H2}",
           "-r", f"{fps:g}", "-i", "-", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", str(out_mp4)]
    pr = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for im in frames:
        pr.stdin.write(im.crop((0, 0, W2, H2)).tobytes())
    pr.stdin.close()
    pr.wait()
    if out_gif:
        vf = f"fps={min(fps, 30):g},scale={W2 // 2}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=32[p];[b][p]paletteuse=dither=none"
        subprocess.run([FFMPEG, "-y", "-loglevel", "error", "-i", str(out_mp4), "-vf", vf, "-loop", "0", str(out_gif)],
                       check=True)


def write_sheet(frames, out_png, every=4, cols=8, marks=()):
    idx = list(range(0, len(frames), every))
    if idx[-1] != len(frames) - 1:
        idx.append(len(frames) - 1)
    idx = sorted(set(idx) | {m for m in marks if 0 <= m < len(frames)})
    # side panel only: crop the first panel region (its width is the first views width)
    first = frames[0]
    # find the SIDE panel right edge: first vertical outline after x=0
    arr = np.asarray(first)
    row = arr[first.size[1] - 2]
    edges = [x for x in range(2, first.size[0]) if tuple(row[x]) == (215, 215, 210)]
    side_w = edges[0] + 1 if edges else first.size[0]
    ch = first.size[1] - 26
    hx = getattr(render, "hips_x", None)
    cw = min(side_w, int(ch * 1.1))  # travelling moves: a window that follows the hips
    rows = (len(idx) + cols - 1) // cols
    sheet = Image.new("RGB", (cw * min(cols, len(idx)), ch * rows + 20), "white")
    d = ImageDraw.Draw(sheet)
    for k, f in enumerate(idx):
        cx = hx[f] if hx else side_w / 2
        x0 = int(min(max(0, cx - cw / 2), side_w - cw))
        tile = frames[f].crop((x0, 26, x0 + cw, first.size[1]))
        x, y = (k % cols) * cw, 20 + (k // cols) * ch
        sheet.paste(tile, (x, y))
        ImageDraw.Draw(sheet).text((x + 60, y + 4), f"f{f}", fill=(200, 0, 0) if f in marks else (0, 0, 0))
    d.text((4, 4), "side view (tiles follow the hips; floor ticks every 50 cm stay fixed in the world)", fill=(0, 0, 0))
    sheet.save(out_png)


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("bvh")
    p.add_argument("--out", required=True, help="output stem (no extension)")
    p.add_argument("--title", default="")
    p.add_argument("--glaive", type=float, default=2.3, help="proxy glaive length, metres")
    p.add_argument("--no-gif", action="store_true")
    p.add_argument("--sheet", action="store_true")
    p.add_argument("--every", type=int, default=4)
    p.add_argument("--mark", default="", help="comma list of frames to include/highlight on the sheet")
    a = p.parse_args()
    out = Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    frames, fps = render(a.bvh, a.title, a.glaive)
    # append, not with_suffix: stems like "x0.6_s1_00" contain a dot (with_suffix clobbered them)
    write_video(frames, fps, out.with_name(out.name + ".mp4"), None if a.no_gif else out.with_name(out.name + ".gif"))
    if a.sheet:
        marks = [int(x) for x in a.mark.split(",") if x.strip()]
        write_sheet(frames, out.with_name(out.name + "_sheet.png"), a.every, marks=marks)
    print(f"PREVIEW {out}.mp4 frames={len(frames)} fps={fps:g}")


if __name__ == "__main__":
    main()

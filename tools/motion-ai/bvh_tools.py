"""Read any BVH, run forward kinematics, print a summary, and draw stick-figure contact sheets.

Needs only numpy + pillow (both venvs have them):

  python tools/motion-ai/bvh_tools.py info  clip.bvh
  python tools/motion-ai/bvh_tools.py sheet clip.bvh out.png [--every 10] [--mark 79,134]
                                            [--view side|front|both] [--scale 2]

"side" looks along the character's X axis (horizontal = Z, the facing direction at heading 0;
up = Y): the plane our side-view sprites show. "front" looks along Z. Left-side bones are
drawn blue, right-side orange, centre line grey; --mark frames get a red label.
Positions are reported in the file's units (Kimodo and gemx_to_bvh both write centimetres).
"""
import argparse
import json
import sys

import numpy as np


class Bvh:
    def __init__(self, path):
        self.names, self.parents, self.offsets, self.channels = [], [], [], []
        with open(path, encoding="utf-8") as f:
            tokens = f.read().split()
        i, stack = 0, []
        while tokens[i] != "MOTION":
            t = tokens[i]
            if t in ("ROOT", "JOINT"):
                self.names.append(tokens[i + 1])
                self.parents.append(stack[-1] if stack else -1)
                self.offsets.append(None)
                self.channels.append([])
                stack.append(len(self.names) - 1)
                i += 2
            elif t == "End":  # End Site: keep as a leaf with no channels
                self.names.append(self.names[stack[-1]] + "_end")
                self.parents.append(stack[-1])
                self.offsets.append(None)
                self.channels.append([])
                stack.append(len(self.names) - 1)
                i += 2
            elif t == "OFFSET":
                self.offsets[stack[-1]] = [float(x) for x in tokens[i + 1:i + 4]]
                i += 4
            elif t == "CHANNELS":
                n = int(tokens[i + 1])
                self.channels[stack[-1]] = tokens[i + 2:i + 2 + n]
                i += 2 + n
            elif t == "}":
                stack.pop()
                i += 1
            else:
                i += 1
        self.n_frames = int(tokens[i + 2])
        self.frame_time = float(tokens[i + 5])
        n_ch = sum(len(c) for c in self.channels)
        vals = np.array(tokens[i + 6:i + 6 + self.n_frames * n_ch], dtype=np.float64)
        self.motion = vals.reshape(self.n_frames, n_ch)
        self.offsets = np.array(self.offsets)
        self.parents = np.array(self.parents)

    @property
    def fps(self):
        return 1.0 / self.frame_time

    def positions(self):
        """(frames, joints, 3) world positions."""
        F, J = self.n_frames, len(self.names)
        glob_r = np.zeros((F, J, 3, 3))
        glob_p = np.zeros((F, J, 3))
        col = 0
        for j in range(J):
            local_p = np.tile(self.offsets[j], (F, 1))
            local_r = np.tile(np.eye(3), (F, 1, 1))
            for ch in self.channels[j]:
                v = self.motion[:, col]
                col += 1
                if ch.endswith("position"):
                    # Position channels are absolute (they replace OFFSET), as Blender's
                    # importer reads them; Kimodo and GEM-X exports rely on this.
                    local_p[:, "XYZ".index(ch[0])] = v
                else:
                    local_r = local_r @ _axis_rot(ch[0], np.radians(v))
            p = self.parents[j]
            if p < 0:
                glob_r[:, j], glob_p[:, j] = local_r, local_p
            else:
                glob_r[:, j] = glob_r[:, p] @ local_r
                glob_p[:, j] = glob_p[:, p] + np.einsum("fij,fj->fi", glob_r[:, p], local_p)
        return glob_p


def _axis_rot(axis, a):
    c, s = np.cos(a), np.sin(a)
    m = np.zeros((len(a), 3, 3))
    i = "XYZ".index(axis)
    j, k = (i + 1) % 3, (i + 2) % 3  # cyclic, so Y gets the right sign (fixed 2026-09-29)
    m[:, i, i] = 1
    m[:, j, j], m[:, j, k], m[:, k, j], m[:, k, k] = c, -s, s, c
    return m


def info(path):
    b = Bvh(path)
    P = b.positions()
    hips = b.names.index("Hips") if "Hips" in b.names else 0
    out = {
        "file": path,
        "joints": len(b.names),
        "joints_with_channels": sum(1 for c in b.channels if c),
        "frames": b.n_frames,
        "fps": round(b.fps, 3),
        "seconds": round(b.n_frames / b.fps, 3),
        "hips_start": P[0, hips].round(2).tolist(),
        "hips_end": P[-1, hips].round(2).tolist(),
        "hips_height_min_max": [round(P[:, hips, 1].min(), 2), round(P[:, hips, 1].max(), 2)],
        "lowest_point": round(P[:, :, 1].min(), 2),
        "height_frame0": round(P[0, :, 1].max() - P[0, :, 1].min(), 2),
        "names": b.names,
    }
    return out


def sheet(path, out_png, every=10, marks=(), view="both", scale=2.0):
    from PIL import Image, ImageDraw

    b = Bvh(path)
    P = b.positions()
    frames = list(range(0, b.n_frames, every))
    if frames[-1] != b.n_frames - 1:
        frames.append(b.n_frames - 1)
    for m in marks:
        if 0 <= m < b.n_frames and m not in frames:
            frames.append(m)
    frames.sort()
    views = ["side", "front"] if view == "both" else [view]
    axes = {"side": (2, 1), "front": (0, 1)}  # (horizontal, vertical) world axes
    height = P[:, :, 1].max() - min(0.0, P[:, :, 1].min())
    cell = int(height * scale * 1.15) + 20
    cols = min(len(frames), 10)
    rows_per_view = (len(frames) + cols - 1) // cols
    img = Image.new("RGB", (cols * cell, rows_per_view * len(views) * cell + 24), "white")
    d = ImageDraw.Draw(img)
    d.text((6, 6), f"{path}  {b.n_frames} f @ {b.fps:.0f} fps  views: {', '.join(views)}", fill="black")

    def colour(name):
        n = name.lower()
        if n.startswith("left") or n.startswith("l_") or n.endswith("_l"):
            return (40, 90, 220)
        if n.startswith("right") or n.startswith("r_") or n.endswith("_r"):
            return (235, 120, 20)
        return (90, 90, 90)

    for vi, v in enumerate(views):
        h_ax, v_ax = axes[v]
        for k, f in enumerate(frames):
            cx = (k % cols) * cell
            cy = 24 + (vi * rows_per_view + k // cols) * cell
            hips_h = P[f, 0 if "Hips" not in b.names else b.names.index("Hips"), h_ax]
            def to_px(p):
                return (cx + cell / 2 + (p[h_ax] - hips_h) * scale, cy + cell - 12 - p[v_ax] * scale)
            d.line([(cx, cy + cell - 12), (cx + cell, cy + cell - 12)], fill=(200, 200, 200))
            for j, par in enumerate(b.parents):
                if par < 0 or "Root" == b.names[par]:
                    continue
                d.line([to_px(P[f, par]), to_px(P[f, j])], fill=colour(b.names[j]), width=2)
            d.text((cx + 4, cy + 2), f"{v[0]} {f}", fill=(200, 0, 0) if f in marks else (0, 0, 0))
            d.rectangle([cx, cy, cx + cell - 1, cy + cell - 1], outline=(225, 225, 225))
    img.save(out_png)
    return out_png


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    pi = sub.add_parser("info")
    pi.add_argument("bvh")
    pi.add_argument("--names", action="store_true")
    ps = sub.add_parser("sheet")
    ps.add_argument("bvh")
    ps.add_argument("png")
    ps.add_argument("--every", type=int, default=10)
    ps.add_argument("--mark", default="")
    ps.add_argument("--view", choices=("side", "front", "both"), default="both")
    ps.add_argument("--scale", type=float, default=2.0, help="pixels per file unit (cm)")
    a = p.parse_args()
    if a.cmd == "info":
        r = info(a.bvh)
        if not a.names:
            r.pop("names")
        print(json.dumps(r))
    else:
        marks = [int(x) for x in a.mark.split(",") if x.strip()]
        print(sheet(a.bvh, a.png, a.every, marks, a.view, a.scale))


if __name__ == "__main__":
    sys.exit(main())

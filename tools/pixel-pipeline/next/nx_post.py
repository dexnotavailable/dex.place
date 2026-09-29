"""Isolated R2 finish replay on existing or delivery-rendered raw passes.

No Blender/GPU invocation. The source raw tree and all promoted outputs are
read-only. Every run copies just raw pass inputs to its own workspace, proves the
unchanged d9 finish at 0 pixels against an explicit preserved reference.
This proves the postprocessor, not a fresh 3D rebuild or runtime integration.
"""
import argparse
import hashlib
import json
import shutil
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

PIPE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PIPE / "drive9"))
import d9_post as D9  # noqa: E402
import judge_sheets as JS  # noqa: E402

RAW_FILES = ("beauty.png", "depth.png", "id.png", "light.png", "meta.json",
             "noise.png", "normal.png", "facepass.json", "landmarks.json")
SHOTS = ("idle", "n1", "q", "back")


def read_image(path):
    return np.asarray(Image.open(path).convert("RGBA")).copy()


def difference(left, right):
    a, b = read_image(left), read_image(right)
    if a.shape != b.shape:
        raise AssertionError(f"shape mismatch: {left} {a.shape} vs {right} {b.shape}")
    return int(np.any(a != b, axis=2).sum())


def labels(raw, meta, finish):
    idm, hi = D9.paint(str(raw), meta, finish)
    normals = np.asarray(Image.open(raw / "normal.png").convert("RGB"), float) / 255 * 2 - 1
    depth = np.asarray(Image.open(raw / "depth.png").convert("RGB"), float)[..., 0] / 255
    return D9.F1.downsample(meta, idm, hi, normals, depth,
                            finish["presets"]["D1"]["aa"])[:3]


def save_sprite(image, directory):
    sprite = Image.fromarray(image)
    sprite.save(directory / "still.png")
    sprite.resize((sprite.width * 3, sprite.height * 3), Image.Resampling.NEAREST).save(
        directory / "still_x3.png")
    JS.f1_grounded(str(directory)).save(directory / "still_ground.png")


def blind_pair(control, candidate, out, scale, reverse):
    panels = [Image.open(p / "still_ground.png").convert("RGBA") for p in (control, candidate)]
    if reverse:
        panels.reverse()
    width = max(p.width for p in panels)
    height = max(p.height for p in panels)
    sheet = Image.new("RGB", (2 * (width * scale + 16), height * scale + 34), "#212126")
    draw = ImageDraw.Draw(sheet)
    for i, panel in enumerate(panels):
        panel = panel.resize((panel.width * scale, panel.height * scale), Image.Resampling.NEAREST)
        x = i * (width * scale + 16) + 8
        draw.text((x, 5), "AB"[i], fill="#bcb49b")
        sheet.paste(panel, (x, 25), panel)
    sheet.save(out)


def run(root, output, reference=None):
    root, output = root.resolve(), output.resolve()
    reference = (reference or root).resolve()
    if output == root or root in output.parents or output in root.parents:
        raise ValueError("output must be separate from the preserved raw tree")
    if output == reference or reference in output.parents or output in reference.parents:
        raise ValueError("output must be separate from the preserved reference tree")
    if output.exists():
        raise ValueError("use a fresh output directory; no experiment is overwritten")
    finish_path = PIPE / "drive9" / "r2_finish.json"
    finish = D9.load_finish(str(finish_path))
    output.mkdir(parents=True)
    report = {"scope": "postprocess-only; fresh Blender/native proof pending",
              "root": str(root), "reference": str(reference), "shots": [],
              "control_zero_px": False, "ready_for_visual_review": False}
    for shot in SHOTS:
        for px in (144, 80):
            source = root / shot / f"px{px}"
            raw = output / "raw" / shot / f"px{px}"
            raw.mkdir(parents=True)
            fingerprints = {}
            for name in RAW_FILES:
                path = source / name
                if not path.exists():
                    if name in ("facepass.json", "landmarks.json"):
                        continue
                    raise FileNotFoundError(path)
                shutil.copyfile(path, raw / name)
                fingerprints[name] = hashlib.sha256(path.read_bytes()).hexdigest()
            D9.process(str(raw), finish, "D1", "control", big_eyes=True)
            control = raw / "control"
            differences = {f: difference(control / f, reference / shot / f"px{px}" / "R2" / f)
                           for f in ("still.png", "still_ground.png")}
            if any(differences.values()):
                report["failure"] = {"shot": shot, "px": px, "differences": differences}
                (output / "proof.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
                raise AssertionError(f"control differs from promoted R2: {report['failure']}")
            candidate = output / "stills" / shot / f"px{px}"
            shutil.copytree(control, candidate)
            image = read_image(candidate / "still.png")
            original = image.copy()
            mask = np.zeros(image.shape[:2], bool)
            Image.fromarray(mask.astype(np.uint8) * 255).save(candidate / "pass_mask.png")
            change = np.any(image != original, axis=2)
            row = {"shot": shot, "px": px, "control_changed_px": differences,
                   "candidate_changed_px": int(change.sum()),
                   "outside_mask_px": int((change & ~mask).sum()),
                   "silhouette_changed_px": int((image[..., 3] != original[..., 3]).sum()),
                   "raw_sha256": fingerprints}
            if row["outside_mask_px"] or row["silhouette_changed_px"]:
                raise AssertionError(row)
            report["shots"].append(row)
    report["control_zero_px"] = True
    report["ready_for_visual_review"] = False
    sheets = output / "blind"
    sheets.mkdir()
    # One assignment for every shot/scale; the critic never receives this key.
    reverse = True
    key = {"A": "replayed control", "B": "replayed control"}
    (output / "key.json").write_text(json.dumps(key, indent=2), encoding="utf-8")
    for shot in SHOTS:
        for px in (144, 80):
            for scale in (1, 3):
                blind_pair(output / "raw" / shot / f"px{px}" / "control",
                           output / "stills" / shot / f"px{px}",
                           sheets / f"{shot}_{px}_x{scale}.png", scale, reverse)
    (output / "proof.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps({"control_zero_px": True, "images": len(report["shots"]) * 2,
                      "changed": [{"shot": r["shot"], "px": r["px"],
                                   "px_changed": r["candidate_changed_px"]}
                                  for r in report["shots"]], "proof": str(output / "proof.json")}))
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--reference", type=Path,
                        help="preserved R2 tree; required for meaningful fresh-render comparison")
    args = parser.parse_args()
    run(args.root, args.out, args.reference)

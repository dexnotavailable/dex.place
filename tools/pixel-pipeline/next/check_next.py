"""Focused nonrendering guards for the isolated candidate and rollback receipt."""
import argparse
import ast
import hashlib
import json
from pathlib import Path


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def changes(before, after, prefix=()):
    if isinstance(before, dict) and isinstance(after, dict):
        result = []
        for key in sorted(set(before) | set(after)):
            if key not in before or key not in after:
                result.append(".".join(prefix + (key,)))
            else:
                result.extend(changes(before[key], after[key], prefix + (key,)))
        return result
    return [] if before == after else [".".join(prefix)]


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--lane", type=Path, required=True)
    args = p.parse_args()
    pipe = Path(__file__).resolve().parents[1]
    repo = pipe.parents[1]
    original = json.loads((pipe / "drive9/r2_model.json").read_text(encoding="utf-8-sig"))
    candidate = json.loads((repo / "art/rosace/next/headtilt8_model.json").read_text(encoding="utf-8-sig"))
    original.pop("_doc", None)
    candidate.pop("_doc", None)
    diff = changes(original, candidate)
    if diff != ["poses.idle_appeal.figure.look.tilt"]:
        raise AssertionError(f"candidate changes more than one variable: {diff}")
    if original["poses"]["idle_appeal"]["figure"]["look"]["tilt"] != 16:
        raise AssertionError("unexpected baseline head tilt")
    if candidate["poses"]["idle_appeal"]["figure"]["look"]["tilt"] != 8:
        raise AssertionError("unexpected candidate head tilt")
    for path in Path(__file__).parent.glob("*.py"):
        ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    rollback_path = args.lane / "ROLLBACK.json"
    manifest = json.loads(rollback_path.read_text(encoding="utf-8-sig"))
    originals = {r["original"] for r in manifest["files"]}
    root = Path(manifest["sourceRepo"])
    folders = ("art/rosace", "tools/pixel-pipeline", "tools/art-construct",
               "tools/motion-ai", "docs/character")
    for folder in folders:
        if not (root / folder).is_dir():
            raise FileNotFoundError(root / folder)
        for path in (root / folder).rglob("*"):
            if path.is_file() and "__pycache__" not in path.parts and path.suffix != ".pyc":
                if str(path.resolve()) not in originals:
                    raise AssertionError(f"source missing from rollback: {path}")
    state = ("art/rosace/drive9.json", "art/rosace/integrated.json", "art/rosace/figure/shape.json",
             "art/rosace/poses/idle_appeal.json", "art/rosace/poses/back_appeal.json",
             "art/rosace/poses/n1_contact.json", "art/rosace/poses/q_stamp.json")
    for name in state:
        if str((root / name).resolve()) not in originals:
            raise AssertionError(f"state map missing from rollback: {name}")
    raw_names = ("beauty.png", "depth.png", "id.png", "light.png", "meta.json", "noise.png", "normal.png")
    raw = Path("D:/Dex/Projects/dex-place-art/rosace/build/lanes/drive9/raw/R2")
    for shot in ("idle", "n1", "q", "back"):
        for px in (144, 80):
            for name in (*raw_names, "R2/still.png", "R2/still_ground.png"):
                if str((raw / shot / f"px{px}" / name).resolve()) not in originals:
                    raise AssertionError(f"render input/output missing from rollback: {shot}/{px}/{name}")
    for row in manifest["files"]:
        if digest(row["backup"]) != row["sha256"]:
            raise AssertionError(f"backup hash mismatch: {row['backup']}")
    notice = json.loads((args.lane / "PREVIEW.json").read_text(encoding="utf-8-sig"))
    for key, value in notice["assetHashes"].items():
        if digest(notice[key]) != value:
            raise AssertionError(f"preview image hash mismatch: {key}")
    proof_path = Path(notice["candidateImage"]).parents[3] / "proof.json"
    proof = json.loads(proof_path.read_text(encoding="utf-8-sig"))
    rows = proof["shots"]
    expected = {(s, n) for s in ("idle", "n1", "q", "back") for n in (144, 80)}
    if len(rows) != 8 or {(r["shot"], r["px"]) for r in rows} != expected:
        raise AssertionError("incomplete trial proof")
    if not proof["control_zero_px"] or any(any(r["control_changed_px"].values())
           or r["outside_mask_px"] or r["silhouette_changed_px"] for r in rows):
        raise AssertionError("trial guards failed")
    result = {"source_single_variable": diff, "python_ast": "pass", "backup_files": len(manifest["files"]),
              "backup_hashes": "pass", "coverage": "complete-required-source-state-raw",
              "preview_hashes": "pass", "trial_control_images_zero_px": 16,
              "limits": "no Blender/native/motion acceptance; collar rejected; headtilt unrendered"}
    check_path = repo / "review/rosace/art/next/SOURCE-CHECKS.json"
    check_path.parent.mkdir(parents=True, exist_ok=True)
    check_path.write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps(result))


if __name__ == "__main__":
    main()

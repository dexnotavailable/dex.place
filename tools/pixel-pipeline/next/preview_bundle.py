"""Preserve exact local R2 state and publish inspected own-art comparisons.

No canonical files are changed. Private blends/source copies live in ignored
review, and no third-party reference images are copied into this bundle.
"""
import argparse
import hashlib
import json
import shutil
import subprocess
from datetime import datetime, timedelta, timezone
from pathlib import Path

from PIL import Image, ImageDraw


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--source", type=Path, required=True)
    p.add_argument("--worktree", type=Path, required=True)
    p.add_argument("--trial", type=Path, required=True)
    p.add_argument("--lane", type=Path, required=True)
    p.add_argument("--preview-id", required=True)
    p.add_argument("--critic-record", type=Path, required=True)
    args = p.parse_args()
    proof = json.loads((args.trial / "proof.json").read_text(encoding="utf-8"))
    expected = {(shot, px) for shot in ("idle", "n1", "q", "back") for px in (144, 80)}
    rows = proof.get("shots", [])
    if len(rows) != 8 or {(r["shot"], r["px"]) for r in rows} != expected:
        raise ValueError("trial proof must contain exactly eight distinct shot/size rows")
    if not proof.get("control_zero_px") or any(
            set(r["control_changed_px"]) != {"still.png", "still_ground.png"}
            or any(r["control_changed_px"].values()) or r["outside_mask_px"]
            or r["silhouette_changed_px"] for r in rows):
        raise ValueError("trial replay/mask/silhouette evidence failed")
    critic = json.loads(args.critic_record.read_text(encoding="utf-8"))
    if critic.get("previewId") != args.preview_id or not critic.get("verdict"):
        raise ValueError("critic evidence must be explicitly bound to this preview id")
    source_folders = ("art/rosace", "tools/pixel-pipeline", "tools/art-construct",
                      "tools/motion-ai", "docs/character")
    required_state = ("art/rosace/drive9.json", "art/rosace/integrated.json",
                      "art/rosace/figure/shape.json", "art/rosace/poses/idle_appeal.json",
                      "art/rosace/poses/back_appeal.json", "art/rosace/poses/n1_contact.json",
                      "art/rosace/poses/q_stamp.json")
    for folder in source_folders:
        if not (args.source / folder).is_dir():
            raise FileNotFoundError(args.source / folder)
    for name in required_state:
        if not (args.source / name).is_file():
            raise FileNotFoundError(args.source / name)
    bundle = args.trial.parent / "rollback-r2-20260930"
    manifest_path = args.lane / "ROLLBACK.json"
    if manifest_path.exists():
        raise ValueError("verified rollback manifest exists; never overwrite it")
    bundle.mkdir(parents=True, exist_ok=True)
    records = []

    def preserve(source, target):
        target.parent.mkdir(parents=True, exist_ok=True)
        digest = sha(source)
        if target.exists():
            if sha(target) != digest:
                raise AssertionError(f"prior backup differs; never overwrite {target}")
        else:
            shutil.copyfile(source, target)
        if sha(target) != digest or sha(source) != digest:
            raise AssertionError(f"unstable/mismatched backup {source}")
        records.append({"original": str(source.resolve()), "backup": str(target.resolve()),
                        "sha256": digest, "bytes": source.stat().st_size})

    for folder in source_folders:
        for source in sorted((args.source / folder).rglob("*")):
            if source.is_file() and "__pycache__" not in source.parts and source.suffix != ".pyc":
                preserve(source, bundle / "source" / source.relative_to(args.source))
    art_build = Path("D:/Dex/Projects/dex-place-art/rosace/build")
    for name in ("rosace.blend", "rosace_build.json", "rosace_pre_drive9.blend",
                 "rosace_pre_drive9_build.json"):
        preserve(art_build / name, bundle / "build" / name)
    raw = art_build / "lanes/drive9/raw/R2"
    raw_names = ("beauty.png", "depth.png", "id.png", "light.png", "meta.json", "noise.png",
                 "normal.png", "facepass.json", "landmarks.json")
    for shot in ("idle", "n1", "q", "back"):
        for px in (144, 80):
            part = Path(shot) / f"px{px}"
            for name in raw_names:
                source = raw / part / name
                if source.exists():
                    preserve(source, bundle / "raw/R2" / part / name)
                elif name not in ("facepass.json", "landmarks.json"):
                    raise FileNotFoundError(source)
            for name in ("still.png", "still_x3.png", "still_ground.png", "sil.png", "post.json"):
                preserve(raw / part / "R2" / name, bundle / "raw/R2" / part / "R2" / name)
    git_head = lambda repo: subprocess.check_output(
        ["git", "-C", str(repo), "rev-parse", "HEAD"], text=True).strip()
    timestamp = datetime.now(timezone(timedelta(hours=7))).isoformat()
    manifest = {"id": "rosace-r2-rollback-20260930", "timestamp": timestamp,
                "baseline": "Claude promoted drive9 round2, 5.78; target remains9",
                "sourceRepo": str(args.source), "integrationHead": git_head(args.source),
                "sourceHead": git_head(args.worktree), "dirtySourcePreserved": True,
                "bundle": str(bundle), "hashVerified": True, "files": records,
                "coverage": {"requiredFolders": list(source_folders),
                             "requiredStateMaps": list(required_state),
                             "requiredRawInputs": [n for n in raw_names if n not in ("facepass.json", "landmarks.json")],
                             "optionalRawInputs": ["facepass.json", "landmarks.json"],
                             "complete": True},
                "canonicalReplacement": False,
                "restoreProcedure": [
                    "Current candidate is separate; rejection requires no canonical restore because no canonical file/mapping was changed.",
                    "Mark this preview/submission rejected; retain candidate artifacts and this hash-verified bundle.",
                    "If a later delivery replaces canonical art: delivery first stops the specific consumer under its exclusive gate, then uses its receipt changed-file list.",
                    "For each changed canonical source/asset/state-map path, locate original/backup in this manifest, verify backup SHA256, copy backup to exact original path, and verify restored SHA256.",
                    "Restore dependent state mappings (art/rosace/drive9.json, integrated.json, figure/shape.json, poses and changed pipeline selectors) from the same manifest; do not reset or overwrite unrelated dirty work.",
                    "Delivery rebuilds affected exports from preserved R2 source or restores backed-up exports, verifies pixel hashes and native consumer mappings, then records restoration in the delivery receipt.",
                    "Never force reset/push, prune or delete the baseline; publish/main restoration remains delivery-owned."
                ]}
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    preview = args.trial / "preview"
    preview.mkdir()
    baseline = args.trial / "raw/idle/px144/control/still_ground.png"
    candidate = args.trial / "stills/idle/px144/still_ground.png"
    for scale in (1, 3):
        images = [Image.open(x).convert("RGBA") for x in (baseline, candidate)]
        width, height = images[0].size
        sheet = Image.new("RGB", (2 * (width * scale + 24), height * scale + 42), "#212126")
        draw = ImageDraw.Draw(sheet)
        for i, im in enumerate(images):
            x = i * (width * scale + 24) + 12
            draw.text((x, 8), ("Claude / R2 baseline", "Collar-only trial")[i], fill="#d9d4c5")
            im = im.resize((width * scale, height * scale), Image.Resampling.NEAREST)
            sheet.paste(im, (x, 32), im)
        sheet.save(preview / f"idle-comparison-x{scale}.png")
    images = {"baselineImage": baseline, "candidateImage": candidate,
              "comparisonImage": preview / "idle-comparison-x3.png",
              "nativeComparisonImage": preview / "idle-comparison-x1.png"}
    notice = {"id": args.preview_id, "status": "preview-ready", "timestamp": timestamp,
              "owner": "rosace", "sourceHead": git_head(args.worktree),
              "candidateSource": "worktree changes over sourceHead; scoped commit pending",
              "change": "Existing authored collar-cross glyph restored on R2 finish only; no other art changes",
              "observedChecks": ["Bound critic record reports actual own-pixel review; all16 control images0px validated",
                                 "Mask/silhouette guards pass; independent blind verdict bound below",
                                 "Experimental trial retained; not promoted or deployed"],
              "criticVerdict": critic["verdict"],
              "evidence": {"proof": str(args.trial / "proof.json"),
                           "proofSha256": sha(args.trial / "proof.json"),
                           "criticRecord": str(args.critic_record),
                           "criticSha256": sha(args.critic_record)},
              "rollbackManifest": str(manifest_path), "rollbackHashVerified": True,
              "assetHashes": {k: sha(v) for k, v in images.items()},
              **{k: str(v.resolve()) for k, v in images.items()}}
    (args.lane / "PREVIEW.json").write_text(json.dumps(notice, indent=2), encoding="utf-8")
    print(json.dumps({"preview": notice["id"], "backupFiles": len(records),
                      "backupBytes": sum(r["bytes"] for r in records),
                      "hashVerified": True, "manifest": str(manifest_path)}))


if __name__ == "__main__":
    main()

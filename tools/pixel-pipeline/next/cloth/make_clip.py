"""Finish actual native cloth diagnostic frames into a viewable moving GIF."""
import argparse
import hashlib
import json
import sys
from pathlib import Path

from PIL import Image

PIPE = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PIPE / "drive9"))
import d9_post as D9  # noqa: E402


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--root", type=Path, required=True)
    args = p.parse_args()
    root = args.root.resolve()
    repo = PIPE.parents[1]
    if not (repo / "review/rosace/physics").resolve() in root.parents:
        raise ValueError("finish only this lane's private physics diagnostic")
    manifest = json.loads((root / "frames.json").read_text(encoding="utf-8"))
    if len(manifest["exports"]) != 31 or [r["frame"] for r in manifest["exports"]] != list(range(0, 121, 4)):
        raise ValueError("moving diagnostic must contain all declared chronological draws")
    for row in manifest["exports"]:
        raw = Path(row["raw"]).resolve()
        expected = (root / "frames" / f"f{row['frame']:04d}" / "px80").resolve()
        if raw != expected or root not in raw.parents:
            raise ValueError("manifest raw path does not match private frame destination")
        meta = json.loads((raw / "meta.json").read_text(encoding="utf-8"))
        if meta.get("frame") != row["frame"] or meta.get("cloth", {}).get("mode") != manifest["physics"]:
            raise ValueError("native frame provenance differs from diagnostic manifest")
    finish = D9.load_finish(str(PIPE / "drive9/r2_finish.json"))
    frames, evidence = [], []
    for row in manifest["exports"]:
        raw = Path(row["raw"])
        D9.process(str(raw), finish, "D1", "R2", True)
        path = raw / "R2/still_ground.png"
        sprite = Image.open(path).convert("RGBA")
        canvas = Image.new("RGBA", sprite.size, "#212126")
        canvas.alpha_composite(sprite)
        frames.append(canvas.convert("RGB"))
        evidence.append({"frame": row["frame"], "image": str(path),
                         "sha256": hashlib.sha256(path.read_bytes()).hexdigest()})
    if len({image.size for image in frames}) != 1:
        raise ValueError("diagnostic framing changes across frames")
    path = root / "cloth-diagnostic.gif"
    frames[0].save(path, save_all=True, append_images=frames[1:], duration=[60, 70, 70] * 10 + [60],
                   loop=0, disposal=2, optimize=False)
    with Image.open(path) as encoded:
        delays = []
        for index in range(encoded.n_frames):
            encoded.seek(index)
            delays.append(encoded.info["duration"])
    (root / "moving-proof.json").write_text(json.dumps({"mode": manifest["physics"],
        "gif": str(path), "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "frames": evidence, "solverHz": 60, "targetDrawHz": 15,
        "encodedFrames": len(delays), "encodedDelaysMs": delays,
        "encodedDurationMs": sum(delays), "endpointDrawRetained": True,
        "limits": "actual moving pixels produced; human/critic playback, loops/transitions and gameplay clips unaccepted"}, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()

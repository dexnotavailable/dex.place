"""Finite seated-grip visibility variants; original H1 wrappers stay frozen."""
import sys
import json
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import nx_hands_blender as H1  # noqa: E402
import grip_staging_recipe as S  # noqa: E402


def main():
    argv = sys.argv[sys.argv.index("--") + 1:]
    angle = float(H1.argument(argv, "--grip-turn", "0"))
    if angle not in S.ALLOWED:
        raise ValueError("grip turn must be 0,30,-80 degrees")
    scale = float(H1.argument(argv, "--hand-scale", "1.0"))
    if angle != 0 and scale != 1.3:
        raise ValueError("changed grip stage has native H1 1.30 geometry as parent")
    original = H1.hand_recipe
    S.ANGLE = angle
    H1.hand_recipe = S
    try:
        H1.main()
        output = Path(H1.argument(argv, "--out"))
        for px in (144, 80):
            directory = output / "idle" / f"px{px}"
            path = directory / "haft_grips.json"
            if path.exists():
                metrics = json.loads(path.read_text(encoding="utf-8"))
                (directory / "grip_stage.json").write_text(json.dumps({
                    "angle": angle, "parent": "Claude R2" if scale == 1.0 else "native H1 hand geometry1.30",
                    "changedField": "hands.L.back", "handScale": scale,
                    "actualNativeBackFacing": metrics["grips"]["L"]["back_facing"],
                    "actualSyntheticGapCm": metrics["grips"]["L"]["gap_cm"],
                    "limits": "visibility/contact still requires actual pixels"}, indent=2), encoding="utf-8")
    finally:
        H1.hand_recipe = original
        S.ANGLE = 0.0


if __name__ == "__main__":
    main()

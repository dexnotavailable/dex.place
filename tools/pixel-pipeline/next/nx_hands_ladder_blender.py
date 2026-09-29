"""Finite extension of reviewed H1; only the scale recipe changes in this process.

Delivery-only native route. All H1 model/pose/grip/setting/hash/save guards remain
active. Original H1 files and the current 1.30 delivery tree remain untouched.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import hand_ladder_recipe  # noqa: E402
import nx_hands_blender as H1  # noqa: E402


def main():
    original_recipe = H1.hand_recipe
    H1.hand_recipe = hand_ladder_recipe
    try:
        H1.main()
    finally:
        H1.hand_recipe = original_recipe


if __name__ == "__main__":
    main()

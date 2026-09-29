"""Source-only discriminating topology/pin/contract checks, no physics proof."""
import ast
import copy
import json
import math
import io
from pathlib import Path
from PIL import Image

import contract as C


def main():
    repo = Path(__file__).resolve().parents[4]
    config = json.loads((repo / "art/rosace/next/cloth-physics.json").read_text(encoding="utf-8"))
    assert C.validate(config)
    # Original authored topology: open33x25 tabard; select only waist row.
    vertices = [(x * 0.01, 0.0, 1.2 - y * 0.02) for y in range(33) for x in range(25)]
    faces = [[y * 25 + x, y * 25 + x + 1, (y + 1) * 25 + x + 1, (y + 1) * 25 + x]
             for y in range(32) for x in range(24)]
    pins = C.seam_indices(vertices, C.boundary_vertices(faces), "top-boundary", 0.004)
    assert pins == list(range(25)) and not set(pins) & set(range(800, 825))
    # Sleeve ring is tilted: height/projection cutoffs could lose individual
    # seam vertices. Topological loop selection must retain every30root vertex.
    vertices = [(row * 0.02 + 0.128 + 0.006 * math.sin(2 * math.pi * column / 30),
                 0.05 * math.cos(2 * math.pi * column / 30),
                 0.05 * math.sin(2 * math.pi * column / 30))
                for row in range(23) for column in range(30)]
    faces = [[row * 30 + column, row * 30 + (column + 1) % 30,
              (row + 1) * 30 + (column + 1) % 30, (row + 1) * 30 + column]
             for row in range(22) for column in range(30)]
    components = C.boundary_components(faces)
    assert len(components) == 2
    pins = C.seam_indices(vertices, C.boundary_vertices(faces), "upper-arm-opening", 0.004,
                          (0, 0, 0), (1, 0, 0), components)
    assert pins == list(range(30)) and not set(pins) & set(range(660, 690))
    for key, value in (("use_dynamic_mesh", True),):
        bad = copy.deepcopy(config)
        bad["settings"][key] = value
        try:
            C.validate(bad)
        except ValueError:
            pass
        else:
            raise AssertionError("free fabric's animated rest target accepted")
    for path in Path(__file__).parent.glob("*.py"):
        ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    # Exercise the actual installed GIF encoder's centisecond clock; 66/67ms
    # delays would silently truncate and speed up this moving diagnostic.
    stream = io.BytesIO()
    colors = [Image.new("RGB", (2, 2), color) for color in ("red", "green", "blue")]
    colors[0].save(stream, format="GIF", save_all=True, append_images=colors[1:],
                   duration=[60, 70, 70], loop=0, optimize=False)
    stream.seek(0)
    with Image.open(stream) as encoded:
        delays = []
        for index in range(encoded.n_frames):
            encoded.seek(index)
            delays.append(encoded.info["duration"])
    assert delays == [60, 70, 70] and sum(delays) == 200
    print(json.dumps({"tabard_top25_only": True, "sleeve_full_root30_only": True,
                      "hems_free": True, "dynamic_rest_rejected": True,
                      "syntax": "pass", "actual_gif_centisecond_timing": delays,
                      "limits": "not Blender/physics/pixel/playback proof"}))


if __name__ == "__main__":
    main()

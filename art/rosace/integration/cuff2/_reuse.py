"""Read-only loading of the existing guarded C1 adapter/post primitives."""
import importlib.util
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[4]
C1 = REPO / "art/rosace/specialists/refinement"


def load(name):
    spec = importlib.util.spec_from_file_location("cuff2_reused_"+name, C1/(name+".py"))
    module = importlib.util.module_from_spec(spec)
    prior_path = sys.path[:]
    try:
        if name == "cuff_blender":
            sys.path.insert(0, str(C1))
        spec.loader.exec_module(module)
    finally:
        sys.path[:] = prior_path
    return module

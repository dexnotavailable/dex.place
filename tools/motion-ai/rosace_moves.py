"""Rosace's moves as Kimodo inputs: key poses from MOVESET.md -> constraints JSON -> Kimodo -> BVH.

Run in the Kimodo venv:

  D:/Dex/Tools/venvs/kimodo/Scripts/python.exe tools/motion-ai/rosace_moves.py keys  [move ...]
      solve every key pose, write <raw>/_keys/<move>_keys.bvh (one frame per key) + residuals
  D:/Dex/Tools/venvs/kimodo/Scripts/python.exe tools/motion-ai/rosace_moves.py build [move ...]
      write one constraints JSON per variant into <raw>/_constraints/
  D:/Dex/Tools/venvs/kimodo/Scripts/python.exe tools/motion-ai/rosace_moves.py gen   [move ...] [--samples 3]
      build, then run kimodo_gen.py for every variant into <raw>/<move>/

<raw> = D:/Dex/Projects/dex-place-art/rosace/motion-ai/raw (override with --raw).

Timing. MOVESET gives 60 fps game frames. Kimodo runs at 30 fps. Two tempos per move:
  study  MOVESET frame N -> Kimodo frame N (2x slower than the game): room for the model to
         make natural motion; our retime step compresses it later.
  game   MOVESET frame N -> Kimodo frame N/2 (real game speed).
Every clip gets a still pre-roll (PRE frames) and a tail, so frame 0 of the move is at PRE.
The key frame of every named drawing (A2, C1, ...) lands in the sidecar JSON, so retiming knows
where the key drawings are.

Constraint modes:
  full  every joint pinned at each key, with Kimodo's post-processing (foot cleanup + exact
        key snapping). Measured: hits keys to ~0.5 cm but the snap makes one-frame pops.
  soft  the same keys without post-processing: keys land within ~7 cm, no pops.
  ee    wrists, ankles and hips pinned (Kimodo chooses the spine, elbows, knees, head),
        with post-processing
  text  the move's TEXT prompt + only the opening stance (and the root path where the move has
        one): the model invents the move (study tempo only)
  textee  the TEXT prompt + the ee keys: the text steers the in-betweens (study tempo only)
Text needs Kimodo's text encoder (Llama 3 8B via LLM2Vec, installed 2026-09-29, SETUP.md
"Text prompts"); it runs on the CPU by default and adds ~16 s of loading per run.

"""
import argparse
import json
import subprocess
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from rosace_keys import (Pose, constraint_entries, grip, root2d_entry, solve)  # noqa: E402

HERE = Path(__file__).resolve().parent
KIMODO_PY = r"D:\Dex\Tools\venvs\kimodo\Scripts\python.exe"
RAW = Path(r"D:\Dex\Projects\dex-place-art\rosace\motion-ai\raw")
BASE_NPZ = Path(r"D:\Dex\Projects\dex.place\review\motion\_runs\kimodo_smoke_notext.npz")  # frame 0: relaxed stand
PRE, TAIL = 12, 14

H = 1.76  # SOMA body height, m
PX = H / 96  # one MOVESET pixel (96 px = H) in metres

# ---------------------------------------------------------------- shared poses (her frame)
FEET_STANCE = {"L": [0.11, 0.06], "R": [-0.12, -0.08]}
FEET_WIDE = {"L": [0.13, 0.28], "R": [-0.13, -0.26]}
FEET_LUNGE = {"L": [0.13, 0.42], "R": [-0.13, -0.30]}

STANCE = Pose([0, 0.97, 0], hands={"R": [-0.27, 1.02, 0.10]}, feet=FEET_STANCE, name="stance")
READY = Pose([0, 0.92, 0], lean=8, hands=grip([-0.08, 1.02, 0.30], [0.1, 0.45, 0.9]), feet=FEET_WIDE, name="ready")

MOVES = {}


def move(name, text, keys, total, root=None, heading=None, tempos=("study", "game"), modes=("full", "soft", "ee"),
         notes=""):
    """keys: list of (movement_frame_60fps, label, Pose). root/heading: optional f(frame60)->[x,z]/deg."""
    MOVES[name] = dict(text=text, keys=keys, total=total, root=root, heading=heading, tempos=tempos,
                       modes=modes, notes=notes)


# ---------------------------------------------------------------- idle (processional stance)
move("idle", "A person stands still holding a tall staff upright at their right side, breathing calmly.",
     [(0, "stance", STANCE), (60, "stance", STANCE), (120, "stance", STANCE)], 120,
     root=lambda f: [0.0, 0.0], tempos=("study",), modes=("full", "ee"),
     notes="stance keyed at start/middle/end; root pinned at the origin")

# ---------------------------------------------------------------- run
RUN_V = 3.6  # m/s


def run_root(f):  # f in 60 fps frames; accelerate over the first 12 f
    t = f / 60
    z = RUN_V * (t - 0.1) if t > 0.2 else RUN_V * t * t / 0.4
    return [0.0, z]


RUN_CARRY = [(f, "carry", Pose([0, 0.93, run_root(f)[1]], lean=10, hands={"R": [-0.25, 0.95, -0.05]}))
             for f in range(24, 181, 24)]
move("run", "A person runs forward at a steady pace carrying a long polearm low in the right hand.",
     [(0, "stance", STANCE)] + RUN_CARRY, 180, root=run_root, heading=lambda f: 0.0, tempos=("study",),
     modes=("free", "carry"),
     notes="free: only the root path (3.6 m/s) and the first stance; carry: + right wrist at the hip every 24 f")

# ---------------------------------------------------------------- N1 Kyrie
N1 = [
    (0, "stance", STANCE),
    (5, "A2 coil", Pose([0, 0.84, -0.08], lean=18, twist=-35,
                        hands=grip([-0.30, 0.80, -0.08], [0.05, -0.40, -1.0]), feet=FEET_WIDE)),
    (8, "S1 scoop", Pose([0, 0.82, 0.06], lean=28, twist=-10,
                         hands=grip([-0.12, 0.72, 0.18], [0.0, -0.42, 0.91]), feet=FEET_WIDE)),
    (9, "C1 contact", Pose([0, 0.92, 0.15], lean=-4, twist=10,
                           hands=grip([0.0, 1.30, 0.45], [0.05, 0.80, 0.60]), feet=FEET_LUNGE)),
    (15, "F2 over head", Pose([0, 0.95, 0.22], lean=-10, twist=5,
                              hands=grip([0.0, 1.88, 0.08], [0.0, 0.45, -0.90]), feet=FEET_LUNGE)),
    (33, "R3 stance", STANCE.moved(dz=0.22)),
]
move("n1", "A person holding a long glaive in both hands drops their weight back, dips the blade low "
           "behind them, then scoops it along the floor and swings it up high in front with a step forward.",
     N1, 33)

# ---------------------------------------------------------------- N3 Sanctus
N3 = [
    (0, "ready", READY),
    (6, "A2 upright", Pose([0, 0.95, 0], hands={"R": [-0.04, 1.24, 0.33], "L": [0.10, 1.12, 0.18]}, feet=FEET_WIDE)),
    (9, "C1 twirl 1", Pose([0, 0.94, 0.07], lean=6, hands={"R": [-0.04, 1.32, 0.52]}, feet=FEET_WIDE)),
    (11, "T1 grip slide", Pose([0, 0.95, 0.07], hands={"R": [-0.03, 1.25, 0.36], "L": [0.06, 1.33, 0.32]}, feet=FEET_WIDE)),
    (14, "C2 twirl 2", Pose([0, 0.94, 0.14], lean=6, hands={"R": [-0.02, 1.42, 0.52]}, feet=FEET_WIDE)),
    (18, "K1 coil (toes)", Pose([0, 1.03, 0.14], lean=-12, twist=-10,
                                hands=grip([-0.12, 1.78, -0.12], [0.3, 0.55, 0.8]), feet=FEET_STANCE, toes=True)),
    (22, "C3 twirl 3", Pose([0, 0.90, 0.21], lean=8, hands=grip([-0.02, 1.45, 0.50], [0.2, 0.3, 0.95]), feet=FEET_WIDE)),
    (31, "F2 raised high", Pose([0, 0.95, 0.21], lean=-6, hands=grip([0.0, 1.92, 0.15], [0.3, 0.9, 0.3]), feet=FEET_WIDE)),
    (55, "ready", READY.moved(dz=0.21)),
]
move("n3", "A person twirls a long staff like a baton in front of their chest three times, rising onto "
           "their toes before the third twirl, then raises it high.", N3, 55,
     notes="the twirls themselves are prop spins keyed on the glaive later; the body only gets the hand path")

# ---------------------------------------------------------------- N5 Agnus Dei
CROUCH = {"L": [0.28, 0.20], "R": [-0.28, -0.22]}
N5_COIL = Pose([0, 0.64, -0.08], yaw=-130, lean=22, twist=-30,
               hands=grip([-0.36, 0.82, -0.18], [-0.35, 0.0, -1.0]), feet=CROUCH, name="A3 coil")
KNEEL = Pose([0, 0.56, 0.12], lean=4, hands=grip([-0.02, 1.10, 0.36], [0.0, 1.0, 0.05]),
             feet={"L": [0.12, 0.40], "R": [-0.12, 0.10, -0.38]}, knee={"R": [-0.13, 0.08, 0.02]}, name="kneel")


def n5_keys(long_turn):
    s = 1 if not long_turn else -1  # long turn: unwind the other way round (210 deg instead of 130)
    coil = N5_COIL.moved(yaw=-130 if not long_turn else 230)
    return [
        (0, "ready", READY),
        (4, "A1 yank", Pose([0, 0.90, -0.02], yaw=-30 if s > 0 else 30, lean=10, twist=-20,
                            hands=grip([-0.30, 1.00, -0.22], [-0.2, -0.2, -1.0]), feet=FEET_WIDE)),
        (8, "A2 back-arc", Pose([0, 0.86, -0.05], yaw=-80 if s > 0 else 110, lean=8, twist=-20,
                                hands=grip([-0.20, 1.70, -0.25], [-0.2, 0.4, -0.9]), feet=CROUCH)),
        (9, "A3 coil", coil),
        (22, "A3 coil (held)", coil),
        (23, "A4 unwind", Pose([0, 0.70, -0.06], yaw=-60 if s > 0 else 170, lean=18, twist=-50,
                               hands=grip([-0.42, 0.90, -0.10], [-0.5, 0.0, -0.85]), feet=CROUCH)),
        (28, "S2 sweep", Pose([0, 0.76, 0.0], yaw=-20 if s > 0 else 80, lean=14, twist=-15,
                              hands=grip([-0.30, 0.95, 0.35], [-0.9, 0.0, 0.45]), feet=CROUCH)),
        (30, "C1 contact", Pose([0, 0.80, 0.05], yaw=0, lean=10, twist=5,
                                hands=grip([0.05, 1.02, 0.55], [0.45, -0.05, 0.9]), feet=FEET_LUNGE)),
        (37, "C1 held", Pose([0, 0.78, 0.07], yaw=0, lean=10, twist=10,
                             hands=grip([0.10, 1.00, 0.55], [0.55, -0.05, 0.85]), feet=FEET_LUNGE)),
        (47, "F2 kneel", KNEEL.moved(dz=0.03)),
        (67, "K1 amen kneel (held)", KNEEL.moved(dz=0.03)),
        (94, "R3 stance", STANCE.moved(dz=0.10)),
    ]


move("n5", "A person yanks a long glaive back, winds it up behind them into a deep crouch, holds the coil, "
           "then unwinds in one snap into a full spinning sweep and sinks into a kneel with the glaive upright.",
     n5_keys(False), 94, notes="short turn: coil faces -130 deg, unwinds through ~130 deg")
move("n5long", MOVES["n5"]["text"], n5_keys(True), 94,
     notes="long turn: same coil pose reached the other way round, unwinds through ~230 deg")

# ---------------------------------------------------------------- Q Nave
OVERHEAD = {"R": [-0.30, 1.95, 0.05], "L": [0.30, 1.95, 0.05]}
PLANT = Pose([0, 0.86, 0.0], lean=12, hands={"R": [-0.05, 1.02, 0.44], "L": [-0.03, 1.28, 0.46]}, feet=FEET_WIDE)
Q = [
    (0, "stance", STANCE),
    (6, "Q2 lifted overhead", Pose([0, 0.98, 0], hands=OVERHEAD, feet=FEET_STANCE)),
    (13, "T twirl (toes)", Pose([0, 1.05, 0], lean=-4, hands={"R": [-0.18, 2.02, 0.10], "L": [0.18, 2.0, -0.02]},
                               feet=FEET_STANCE, toes=True)),
    (20, "T twirl end (toes)", Pose([0, 1.05, 0], lean=-4, hands={"R": [-0.28, 2.0, -0.02], "L": [0.26, 1.98, 0.10]},
                                    feet=FEET_STANCE, toes=True)),
    (22, "Q3 stretch", Pose([0, 1.04, 0], lean=-6, hands={"R": [-0.05, 1.55, 0.36], "L": [-0.04, 1.86, 0.36]},
                            feet=FEET_STANCE, toes=True)),
    (24, "Q5 stamp contact", PLANT),
    (29, "Q5 held", PLANT),
    (34, "Q7 benediction", Pose([0, 0.96, 0], lean=2, hands={"L": [0.02, 1.26, 0.45], "R": [-0.18, 1.56, 0.30]},
                                feet=FEET_WIDE)),
    (63, "Q7 held", Pose([0, 0.96, 0], lean=2, hands={"L": [0.02, 1.26, 0.45], "R": [-0.18, 1.58, 0.30]},
                         feet=FEET_WIDE)),
    (81, "Q10 stance", STANCE),
]
move("q", "A person lifts a long staff flat above their head and spins it overhead while rising onto their "
          "toes, then snaps it upright and stamps its end into the ground, and holds a calm pose with "
          "the other hand raised in blessing.", Q, 81)

# ---------------------------------------------------------------- dash (Procession) and Aspersion
DASH_Z = [(0, 0.0), (3, 0.0), (9, 110 * PX), (17, 168 * PX), (23, 176 * PX)]


def interp(pts, f):
    xs, ys = zip(*pts)
    return float(np.interp(f, xs, ys))


def dash_root(f):
    return [0.0, interp(DASH_Z, f)]


def dash_heading(f):  # pirouette: 0 -> 360 over f4-17
    return interp([(0, 0), (4, 0), (9, 180), (17, 360), (99, 360)], f)


DASH_KEYS = [
    (0, "stance", STANCE),
    (2, "D1 lean in", Pose([0, 0.90, 0.0], lean=24, hands={"R": [-0.26, 0.92, -0.25]}, feet=FEET_WIDE)),
    (18, "D6 brake", Pose([0, 0.88, 168 * PX], yaw=360, lean=-14, hands={"R": [-0.30, 1.0, 0.05]},
                          feet={"L": [0.12, 0.35], "R": [-0.12, -0.30]})),
    (23, "D7 settle", STANCE.moved(dz=176 * PX, yaw=360)),
]
move("dash", "A person dashes forward in a gliding pirouette, spinning once around while sliding, then "
             "skids to a stop leaning back.", DASH_KEYS, 23, root=dash_root, heading=dash_heading,
     notes="root path and heading every frame (1.83 H travel, one 360 deg turn over f4-17)")

ASP_Z0 = 168 * PX  # Aspersion starts from dash f17 (facing front again, still moving)


def asp_root(f):  # f counted from the start of the combined clip; dash for f<17
    if f <= 17:
        return dash_root(f)
    g = f - 17
    return [0.0, ASP_Z0 + interp([(0, 0), (3, 40 * PX), (9, 120 * PX), (15, 128 * PX), (99, 128 * PX)], g)]


def asp_heading(f):
    return dash_heading(f) if f <= 17 else 360.0


def z(f):
    return asp_root(f)[1]


ASP = [
    (0, "stance", STANCE),
    (2, "D1 lean in", DASH_KEYS[1][2]),
    (17 + 2, "A1 sliding low", Pose([0, 0.80, z(19)], yaw=360, lean=22,
                                     hands=grip([-0.30, 0.90, -0.12], [-0.2, -0.1, -1.0]), feet=FEET_LUNGE)),
    (17 + 6, "P1 pass extended", Pose([0, 0.78, z(23)], yaw=360, lean=24, twist=15,
                                       hands=grip([0.05, 1.12, 0.58], [0.45, 0.05, 0.9]), feet=FEET_LUNGE)),
    (17 + 13, "W1 onto shoulder", Pose([0, 0.93, z(30)], yaw=360, lean=0,
                                        hands={"R": [-0.20, 1.48, 0.12]}, feet=FEET_WIDE)),
    (17 + 22, "V1 verdict", Pose([0, 0.97, z(39)], yaw=360, lean=-2, hands={"R": [-0.20, 1.50, 0.10]},
                                  feet=FEET_STANCE)),
    (17 + 41, "R2 stance", STANCE.moved(dz=z(58), yaw=360)),
]
move("dash_attack", "A person dashes forward spinning once, then slides low and cuts straight through with a "
                    "long glaive held in both hands, and walks on with the glaive resting on the shoulder.",
     ASP, 58, root=asp_root, heading=asp_heading,
     notes="dash f0-17 then Aspersion f1-41 (starts at dash f17); root + heading every frame")


# ---------------------------------------------------------------- build
def frame_map(f60, tempo):
    return PRE + (int(round(f60)) if tempo == "study" else int(round(f60 / 2)))


def build_variant(name, tempo, mode, solved):
    m = MOVES[name]
    keys = m["keys"]
    total = frame_map(m["total"], tempo) + TAIL
    entries, keymap = [], []
    use = []
    for (f60, label, _), aa, rp in zip(keys, solved["aa"], solved["root"]):
        fr = frame_map(f60, tempo)
        if use and use[-1][0] == fr:  # two keys collapse into one frame at game tempo: keep the later
            use.pop()
        use.append((fr, label, aa, rp))
    # the pre-roll holds the first pose; the tail holds the last
    first = use[0]
    use = [(0, first[1] + " (pre-roll)", first[2], first[3])] + use
    last = use[-1]
    use.append((total - 1, last[1] + " (tail)", last[2], last[3]))
    import torch

    carry_only = mode == "carry"
    if mode in ("full", "soft", "ee", "carry"):
        kmode = "full" if mode in ("full", "soft") else "ee"
        if carry_only:
            # stance at the start in full, the carry keys as right-hand-only end effectors
            e0 = constraint_entries([use[0][0], use[1][0]], torch.stack([use[0][2], use[1][2]]),
                                    torch.stack([use[0][3], use[1][3]]), "full")
            rest = use[2:-1]
            e1 = [dict(type="right-hand", frame_indices=[u[0] for u in rest],
                       local_joints_rot=torch.stack([u[2] for u in rest]).tolist(),
                       root_positions=torch.stack([u[3] for u in rest]).tolist())]
            entries += e0 + e1
        else:
            entries += constraint_entries([u[0] for u in use], torch.stack([u[2] for u in use]),
                                          torch.stack([u[3] for u in use]), kmode)
    elif mode == "textee":
        entries += constraint_entries([u[0] for u in use], torch.stack([u[2] for u in use]),
                                      torch.stack([u[3] for u in use]), "ee")
    elif mode in ("free", "text"):
        entries += constraint_entries([use[0][0], use[1][0]], torch.stack([use[0][2], use[1][2]]),
                                      torch.stack([use[0][3], use[1][3]]), "full")
    if m["root"] is not None:
        frames = list(range(total))
        scale = 1 if tempo == "study" else 2
        f60 = [max(0, (fr - PRE)) * scale for fr in frames]
        xz = [m["root"](min(f, m["total"])) for f in f60]
        hd = [m["heading"](min(f, m["total"])) for f in f60] if m["heading"] else None
        # the key poses already pin the root on their frames; the path fills the rest
        keyed = {u[0] for u in use} if mode in ("full", "soft", "ee", "textee") else set()
        keep = [i for i in frames if i not in keyed]
        entries.append(root2d_entry(keep, [xz[i] for i in keep], [hd[i] for i in keep] if hd else None))
    keymap = [{"frame": u[0], "label": u[1]} for u in use]
    return entries, total, keymap


def solve_move(name, base77, verbose=False):
    poses = []
    for f60, label, p in MOVES[name]["keys"]:
        q = Pose(**{**p.__dict__, "name": label})
        poses.append(q)
    aa, root, pos, rep = solve(poses, base77, verbose=verbose)
    return {"aa": aa, "root": root, "pos": pos, "report": rep}


def cmd_keys(names, raw):
    import torch
    from kimodo.exports.bvh import save_motion_bvh
    from kimodo.geometry import axis_angle_to_matrix
    from rosace_keys import SOMASkeleton30

    from rosace_keys import base_pose_77_npz
    base77 = base_pose_77_npz(BASE_NPZ)
    out = raw / "_keys"
    out.mkdir(parents=True, exist_ok=True)
    s30 = SOMASkeleton30()
    for n in names:
        sol = solve_move(n, base77)
        R77 = s30.to_SOMASkeleton77(axis_angle_to_matrix(sol["aa"]))
        save_motion_bvh(str(out / f"{n}_keys.bvh"), R77, sol["root"], skeleton=s30.somaskel77, fps=30)
        worst = max((max(r["residual_cm"].values()) if r["residual_cm"] else 0) for r in sol["report"])
        (out / f"{n}_keys.json").write_text(json.dumps(sol["report"], indent=1), encoding="utf-8")
        print(f"KEYS {n}: {len(sol['report'])} poses, worst target residual {worst} cm")
        for r in sol["report"]:
            bad = {k: v for k, v in r["residual_cm"].items() if v > 3}
            if bad:
                print("   ", r["pose"], bad)


TEXT_MODES = ("text", "textee")


def variants(name, with_text=True):
    m = MOVES[name]
    v = [(t, md) for t in m["tempos"] for md in m["modes"]]
    if with_text:  # text runs: study tempo only (the prompt describes natural-speed motion)
        v += [("study", md) for md in TEXT_MODES]
    return v


def cmd_build(names, raw):
    from rosace_keys import base_pose_77_npz
    base77 = base_pose_77_npz(BASE_NPZ)
    outdir = raw / "_constraints"
    outdir.mkdir(parents=True, exist_ok=True)
    built = []
    for n in names:
        sol = solve_move(n, base77)
        for tempo, mode in variants(n):
            entries, total, keymap = build_variant(n, tempo, mode, sol)
            stem = f"{n}_{tempo}_{mode}"
            (outdir / f"{stem}.json").write_text(json.dumps(entries), encoding="utf-8")
            meta = {"move": n, "tempo": tempo, "mode": mode, "frames": total, "pre_roll": PRE,
                    "text_prompt": MOVES[n]["text"], "text_used": mode in TEXT_MODES, "notes": MOVES[n]["notes"], "keys": keymap,
                    "ik_residual_cm": sol["report"]}
            (outdir / f"{stem}.meta.json").write_text(json.dumps(meta, indent=1), encoding="utf-8")
            built.append((n, stem, total))
            print(f"BUILD {stem}: {total} frames, {len(keymap)} keys")
    return built


def cmd_gen(names, raw, samples, seed, steps, device, only_modes=None):
    built = cmd_build(names, raw)
    if only_modes:
        built = [b for b in built if b[1].rsplit("_", 1)[1] in only_modes]
    for n, stem, total in built:
        outdir = raw / n
        outdir.mkdir(parents=True, exist_ok=True)
        cmd = [KIMODO_PY, str(HERE / "kimodo_gen.py"), "--constraints", str(raw / "_constraints" / f"{stem}.json"),
               "--frames", str(total), "--samples", str(samples), "--seed", str(seed), "--steps", str(steps),
               "--out", str(outdir / f"{stem}_s{seed}"), "--device", device]
        if stem.endswith("_soft"):
            cmd.append("--no-postprocess")
        if stem.rsplit("_", 1)[1] in TEXT_MODES:
            cmd += ["--text", MOVES[n]["text"]]
        r = subprocess.run(cmd, capture_output=True, text=True)
        line = [l for l in r.stdout.splitlines() if l.startswith("KIMODO_GEN")]
        if r.returncode or not line:
            print(f"FAIL {stem}\n{r.stdout[-1500:]}\n{r.stderr[-3000:]}")
            continue
        rep = json.loads(line[0][len("KIMODO_GEN "):])
        print(f"GEN {stem}: {rep['samples']} samples, {rep['seconds_generate']} s, "
              f"key err {rep.get('constraint_error_cm')}")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("cmd", choices=("keys", "build", "gen", "list"))
    p.add_argument("moves", nargs="*")
    p.add_argument("--raw", default=str(RAW))
    p.add_argument("--samples", type=int, default=3)
    p.add_argument("--seed", type=int, default=1)
    p.add_argument("--steps", type=int, default=100)
    p.add_argument("--device", default="cuda:0")
    p.add_argument("--modes", default="", help="comma list: only generate these modes")
    a = p.parse_args()
    names = a.moves or list(MOVES)
    raw = Path(a.raw)
    if a.cmd == "list":
        for n in names:
            print(n, variants(n), MOVES[n]["total"])
    elif a.cmd == "keys":
        cmd_keys(names, raw)
    elif a.cmd == "build":
        cmd_build(names, raw)
    else:
        cmd_gen(names, raw, a.samples, a.seed, a.steps, a.device, [m for m in a.modes.split(",") if m])


if __name__ == "__main__":
    main()

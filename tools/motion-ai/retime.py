"""Retime + push: rebuild an AI-generated motion from a timing sheet (pose-to-pose, holds, snaps,
overshoot, exaggeration, stepped exposure). Pure numpy; runs in any Python with numpy + Pillow.

  python tools/motion-ai/retime.py build tools/motion-ai/timing/n1.json          # -> npz + json + stick GIF
  python tools/motion-ai/retime.py build tools/motion-ai/timing/n1.json --raw-too # also the untouched clip
  python tools/motion-ai/retime.py keys  <motion.npz> [--meta <sidecar.meta.json>] # find key poses
  python tools/motion-ai/retime.py init  <motion.npz> --meta <sidecar> --move n1 --out timing/n1_new.json
  python tools/motion-ai/retime.py preview <a.npz> [<b.npz> ...] --gif out.gif

Input motion: a Kimodo / GEM-X NPZ (SOMA77, 30 fps, local_rot_mats + root_positions; skeleton in
soma77.json). Output: the same layout at 60 fps game frames (frame 0 = the pose before the input,
frame N = MOVESET fN), plus per-frame bookkeeping (which drawing, which source time, foot
contacts, glaive hints) that blender_apply.py turns into an action on the rig.

The model of a move (RETIME.md explains it for tuning):
  keys      named key poses picked from the source (by its sidecar label or frame), each placed
            on a game frame, with a hold (a true freeze), an easing curve into it, and optional
            push (exaggeration), add (extra twist/lean/crouch), settle (overshoot + rebound after
            landing) and glaive hint.
  between   by default the SOURCE's own in-betweens are replayed on our clock (a time warp), so
            the AI's arcs survive (a 230-degree spin stays a spin); path "pose" slerps key to key
            instead.
  exposure  which frames get a new drawing: MOVESET's drawing table, or on 1s / 2s / 3s. Every
            other frame repeats the last drawing (the pixel look: no in-betweens between keys).
"""
import argparse
import json
import math
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import quat as Q  # noqa: E402

RAW = Path(r"D:\Dex\Projects\dex-place-art\rosace\motion-ai\raw")
OUT_DATA = Path(r"D:\Dex\Projects\dex-place-art\rosace\motion-ai\retimed")
OUT_REVIEW = HERE.parents[1] / "review" / "motion" / "retime"

SKEL = json.loads((HERE / "soma77.json").read_text())
NAMES = SKEL["names"]
PARENTS = np.array(SKEL["parents"])
OFFSETS = np.array(SKEL["offsets"], float)
IDX = {n: i for i, n in enumerate(NAMES)}
SRC_FPS = 30.0
GAME_FPS = 60.0
ANKLE_FLOOR = 0.067      # SOMA ankle height when standing flat (rest: hips 1.005 m over the lowest joint)
TOE_FLOOR = 0.016

CHAINS = {
    "hips": ["Hips"],                     # tilt only; heading is the separate "yaw" channel
    "spine": ["Spine1", "Spine2", "Chest"],
    "neck": ["Neck1", "Neck2", "Head"],
    "arm_L": ["LeftShoulder", "LeftArm", "LeftForeArm", "LeftHand"],
    "arm_R": ["RightShoulder", "RightArm", "RightForeArm", "RightHand"],
    "leg_L": ["LeftLeg", "LeftShin", "LeftFoot", "LeftToeBase"],
    "leg_R": ["RightLeg", "RightShin", "RightFoot", "RightToeBase"],
}
GROUPS = {"arms": ["arm_L", "arm_R"], "legs": ["leg_L", "leg_R"], "torso": ["hips", "spine", "neck"],
          "body": list(CHAINS)}
SCALARS = ("yaw", "root_y", "root_xz")          # push channels that are not joint chains
ADD_KEYS = ("twist", "lean", "side", "yaw", "crouch", "head_turn", "head_nod", "rot")


# ---------------------------------------------------------------------------- source motion
class Motion:
    """A SOMA77 clip: local quats (hips entry = tilt only), unwrapped hips heading psi, root."""

    def __init__(self, local_q, root, sroot, fps, labels=None):
        self.fps = fps
        self.q = Q.positive(local_q.copy())
        psi, tilt = Q.split_yaw(self.q[:, 0])
        self.psi = np.unwrap(psi)
        self.q[:, 0] = tilt
        # keep neighbouring quats in one hemisphere so slerp between frames is short
        for t in range(1, len(self.q)):
            flip = np.sum(self.q[t] * self.q[t - 1], -1) < 0
            self.q[t, flip] *= -1
        self.root = root.astype(float)
        self.sroot = sroot.astype(float)
        self.labels = labels or []
        self.n = len(self.q)

    @classmethod
    def load(cls, npz, meta=None):
        d = np.load(npz)
        lq = Q.from_mat(d["local_rot_mats"])
        root = d["root_positions"]
        sroot = d["smooth_root_pos"] if "smooth_root_pos" in d.files else root
        labels = []
        if meta:
            labels = json.loads(Path(meta).read_text()).get("keys", [])
        return cls(lq, root, sroot, SRC_FPS, labels)

    def frame_of(self, src):
        """a key's source: a frame number or a sidecar label ('A2 coil'); '+n' / '-n' suffix offsets"""
        if isinstance(src, (int, float)):
            return float(src)
        off = 0.0
        for sep in ("+", "-"):
            if sep in src[1:]:
                i = src.rindex(sep)
                try:
                    off = float(src[i:])
                    src = src[:i].strip()
                except ValueError:
                    pass
                break
        for k in self.labels:
            if k["label"] == src:
                return float(k["frame"]) + off
        raise KeyError(f"no source key labelled {src!r}; labels: {[k['label'] for k in self.labels]}")

    def sample(self, tau):
        """pose at fractional source frame tau (clamped to the clip)"""
        tau = float(np.clip(tau, 0, self.n - 1))
        i0 = int(math.floor(tau))
        i1 = min(i0 + 1, self.n - 1)
        a = tau - i0
        return {"q": Q.slerp(self.q[i0], self.q[i1], a),
                "psi": self.psi[i0] * (1 - a) + self.psi[i1] * a,
                "root": self.root[i0] * (1 - a) + self.root[i1] * a,
                "sroot": self.sroot[i0] * (1 - a) + self.sroot[i1] * a}


def copy_pose(p):
    return {k: (v.copy() if isinstance(v, np.ndarray) else v) for k, v in p.items()}


def fk(q_local, root, psi=None):
    """local quats (J,4) (+ hips heading psi if q[0] is tilt only) -> global quats, positions"""
    q = q_local.copy()
    if psi is not None:
        q[0] = Q.join_yaw(psi, q[0])
    J = len(NAMES)
    g = np.zeros((J, 4))
    p = np.zeros((J, 3))
    for j in range(J):
        par = PARENTS[j]
        if par < 0:
            g[j] = q[j]
            p[j] = root
        else:
            g[j] = Q.mul(g[par], q[j])
            p[j] = p[par] + Q.rotate(g[par], OFFSETS[j])
    return g, p


# ---------------------------------------------------------------------------- easing
def ease(spec, u, n_frames):
    """u in [0, 1] across a transition of n_frames frames -> eased progress (may leave [0, 1])"""
    name, par = (spec, None) if isinstance(spec, str) else (spec[0], spec[1] if len(spec) > 1 else None)
    if name == "linear":
        return u
    if name == "in":
        return u ** (par or 2)
    if name == "out":
        return 1 - (1 - u) ** (par or 2)
    if name == "in_out":
        return u * u * (3 - 2 * u)
    if name == "hold":                      # step: nothing moves until the key frame
        return 1.0 if u >= 1 else 0.0
    if name in ("snap", "snap_out"):        # hold, then arrive in the last `par` frames (default 2)
        k = min(1.0, (par or 2) / max(n_frames, 1))
        v = float(np.clip((u - (1 - k)) / k, 0, 1))
        return 1 - (1 - v) ** 2 if name == "snap_out" else v
    if name == "back_out":                  # arrive, go past, come back: lands exactly on the key
        s = 1.70158 if par is None else par
        v = u - 1
        return 1 + (s + 1) * v ** 3 + s * v ** 2
    if name == "back_in":                   # dip the other way first (anticipation), then go
        s = 1.70158 if par is None else par
        return (s + 1) * u ** 3 - s * u ** 2
    raise ValueError(f"unknown ease {spec!r}")


def settle_curve(t, amount, frames):
    """overshoot at the key frame, a small rebound, then rest (t = frames since the key)"""
    if t < 0 or t > frames or frames <= 0:
        return 0.0
    x = t / frames
    return amount * math.exp(-3 * x) * math.cos(1.5 * math.pi * x)


# ---------------------------------------------------------------------------- push / add
def chain_joints(name):
    if name in CHAINS:
        return [IDX[j] for j in CHAINS[name]]
    if name in GROUPS:
        return [IDX[j] for c in GROUPS[name] for j in CHAINS[c]]
    if name in IDX:
        return [IDX[name]]
    raise KeyError(f"unknown chain / joint {name!r}")


def expand_push(push):
    """{'arms': 1.2, 'arm_R': 1.4, ...} -> per-joint multipliers (J,) and scalar channels"""
    m = np.ones(len(NAMES))
    sc = {k: 1.0 for k in SCALARS}
    if not push:
        return m, sc
    order = sorted(push.items(), key=lambda kv: (kv[0] not in GROUPS, kv[0] not in CHAINS))
    for k, v in order:                      # groups first, then chains, then joints override
        if k in SCALARS:
            sc[k] = float(v)
        else:
            for j in chain_joints(k):
                m[j] = float(v)
    return m, sc


def apply_push(p, ref, m, sc):
    out = copy_pose(p)
    rel = Q.mul(Q.inv(ref["q"]), p["q"])
    out["q"] = Q.normalize(Q.mul(ref["q"], Q.power(rel, m)))
    out["psi"] = ref["psi"] + (p["psi"] - ref["psi"]) * sc["yaw"]
    r = out["root"].copy()
    r[1] = ref["root"][1] + (p["root"][1] - ref["root"][1]) * sc["root_y"]
    for a in (0, 2):
        r[a] = ref["root"][a] + (p["root"][a] - ref["root"][a]) * sc["root_xz"]
        out["sroot"][a] = ref["sroot"][a] + (p["sroot"][a] - ref["sroot"][a]) * sc["root_xz"]
    out["root"] = r
    return out


def add_vector(add):
    """additive offsets as one flat vector so they interpolate like everything else"""
    v = {"twist": 0.0, "lean": 0.0, "side": 0.0, "yaw": 0.0, "crouch": 0.0, "head_turn": 0.0,
         "head_nod": 0.0}
    rot = {}
    for k, val in (add or {}).items():
        if k == "rot":
            rot = {j: np.array(e, float) for j, e in val.items()}
        elif k in v:
            v[k] = float(val)
        else:
            raise KeyError(f"unknown add channel {k!r}; use one of {ADD_KEYS}")
    return v, rot


def apply_add(p, v, rot):
    out = copy_pose(p)
    q = out["q"]
    X, Y, Z = np.eye(3)
    sp = [IDX[j] for j in CHAINS["spine"]]
    for axis, key in ((Y, "twist"), (X, "lean"), (Z, "side")):
        if v[key]:
            r = Q.from_axis_angle(axis, v[key] / len(sp))
            for j in sp:
                q[j] = Q.mul(q[j], r)
    for axis, key in ((Y, "head_turn"), (X, "head_nod")):
        if v[key]:
            r = Q.from_axis_angle(axis, v[key] / 2)
            for j in (IDX["Neck1"], IDX["Head"]):
                q[j] = Q.mul(q[j], r)
    for jn, e in rot.items():
        j = IDX[jn]
        r = Q.mul(Q.mul(Q.from_axis_angle(Z, e[2]), Q.from_axis_angle(Y, e[1])), Q.from_axis_angle(X, e[0]))
        q[j] = Q.mul(q[j], r)
    out["psi"] = out["psi"] + math.radians(v["yaw"])
    out["root"] = out["root"] + np.array([0.0, v["crouch"] / 100.0, 0.0])
    return out


def lerp_dict(a, b, u):
    return {k: a[k] + (b[k] - a[k]) * u for k in a}


def lerp_rot(a, b, u):
    keys = set(a) | set(b)
    z = np.zeros(3)
    return {k: a.get(k, z) + (b.get(k, z) - a.get(k, z)) * u for k in keys}


def overshoot(p, frm, to, x):
    """push pose p further along the move frm -> to by fraction x of that move"""
    if abs(x) < 1e-6:
        return p
    out = copy_pose(p)
    D = Q.mul(to["q"], Q.inv(frm["q"]))
    out["q"] = Q.normalize(Q.mul(Q.power(D, x), p["q"]))
    out["psi"] = p["psi"] + (to["psi"] - frm["psi"]) * x
    out["root"] = p["root"].copy()
    out["root"][1] += (to["root"][1] - frm["root"][1]) * x
    return out


# ---------------------------------------------------------------------------- the sheet
GLAIVE_UPRIGHT = [0.0, 1.0, 0.12]      # her frame: Y up, +Z her forward, +X her left


def glaive_hint(spec):
    """'hands' (from the two hands) | 'upright' | [x, y, z] in her frame -> (w_hands, dir)"""
    if spec in (None, "hands"):
        return 1.0, np.array(GLAIVE_UPRIGHT)
    if spec == "upright":
        return 0.0, np.array(GLAIVE_UPRIGHT)
    return 0.0, np.array(spec, float)


class Sheet:
    def __init__(self, path_or_dict, raw_root=RAW):
        if isinstance(path_or_dict, dict):
            self.d = path_or_dict
            self.path = None
        else:
            self.path = Path(path_or_dict)
            self.d = json.loads(self.path.read_text(encoding="utf-8"))
        d = self.d
        src = d["source"]
        base = Path(src.get("root", raw_root))
        self.src_npz = base / src["npz"]
        self.src_meta = (base / src["meta"]) if src.get("meta") else None
        self.motion = Motion.load(self.src_npz, self.src_meta)
        self.length = int(d["length"])
        self.name = d.get("name") or (self.path.stem if self.path else "sheet")
        self.keys = sorted((dict(k) for k in d["keys"]), key=lambda k: k["frame"])
        for k in self.keys:
            k["_src"] = self.motion.frame_of(k["src"])
            k["_hold"] = int(k.get("hold", 0))
            k["_push"] = expand_push(k.get("push"))
            k["_add"] = add_vector(k.get("add"))
            k["_glaive"] = glaive_hint(k.get("glaive", d.get("glaive_default", "hands")))
        for a, b in zip(self.keys, self.keys[1:]):
            if b["frame"] <= a["frame"] + a["_hold"]:
                raise ValueError(f"key {b['name']!r} at f{b['frame']} starts inside {a['name']!r}'s hold "
                                 f"(f{a['frame']}-f{a['frame'] + a['_hold']})")
        ref_name = d.get("push_ref")
        ref_key = next((k for k in self.keys if k["name"] == ref_name), self.keys[0])
        self.ref = self.motion.sample(ref_key["_src"])
        self.key_pose = [self.dressed(self.motion.sample(k["_src"]), k["_push"], k["_add"]) for k in self.keys]

    def dressed(self, p, push, add):
        m, sc = push
        v, rot = add
        return apply_add(apply_push(p, self.ref, m, sc), v, rot)

    # -- one continuous frame (no exposure yet)
    def at(self, f):
        K = self.keys
        path = self.d.get("path", "source")
        if f <= K[0]["frame"]:
            i, u, ue = 0, 1.0, 1.0
            seg = None
        else:
            seg = None
            i = len(K) - 1
            u = ue = 1.0
            for j, k in enumerate(K):
                if f <= k["frame"] + k["_hold"] and f >= k["frame"]:
                    i, seg = j, None
                    break
                if j > 0 and K[j - 1]["frame"] + K[j - 1]["_hold"] < f < k["frame"]:
                    a = K[j - 1]
                    e0 = a["frame"] + a["_hold"]
                    n = k["frame"] - e0
                    u = (f - e0) / n
                    ue = ease(k.get("ease", self.d.get("ease_default", "in_out")), u, n)
                    i, seg = j, (a, k)
                    break
        k = K[i]
        self._prog = (i, i, 1.0) if seg is None else (i - 1, i, float(np.clip(ue, 0, 1)))
        if seg is None:
            p = self.key_pose[i]
            tau = k["_src"]
            wv = k["_glaive"]
        else:
            a, k = seg
            pa, pk = self.key_pose[i - 1], self.key_pose[i]
            uc = float(np.clip(ue, 0, 1))
            kpath = k.get("path", path)
            if kpath == "pose":
                p = {"q": Q.slerp(pa["q"], pk["q"], uc), "psi": pa["psi"] + (pk["psi"] - pa["psi"]) * uc,
                     "root": pa["root"] + (pk["root"] - pa["root"]) * uc,
                     "sroot": pa["sroot"] + (pk["sroot"] - pa["sroot"]) * uc}
                tau = a["_src"] + (k["_src"] - a["_src"]) * uc
            else:
                tau = a["_src"] + (k["_src"] - a["_src"]) * uc
                src = self.motion.sample(tau)
                m = (a["_push"][0] + (k["_push"][0] - a["_push"][0]) * uc,
                     lerp_dict(a["_push"][1], k["_push"][1], uc))
                ad = (lerp_dict(a["_add"][0], k["_add"][0], uc), lerp_rot(a["_add"][1], k["_add"][1], uc))
                p = self.dressed(src, m, ad)
            if ue > 1:
                p = overshoot(p, pa, pk, ue - 1)
            elif ue < 0:
                p = overshoot(p, pa, pk, ue)
            wa, da = a["_glaive"]
            wk, dk = k["_glaive"]
            wv = (wa + (wk - wa) * uc, da + (dk - da) * uc)
        # settles of any key whose window covers f
        for j, kk in enumerate(K):
            st = kk.get("settle")
            if st and j > 0:
                x = settle_curve(f - kk["frame"], st.get("amount", 0.12), st.get("frames", 6))
                if x:
                    p = overshoot(p, self.key_pose[j - 1], self.key_pose[j], x)
        return p, tau, wv

    # -- exposure: which frames carry a new drawing
    def exposure(self):
        ex = self.d.get("exposure", {"mode": "ones"})
        mode = ex["mode"] if isinstance(ex, dict) else ex
        F = self.length + 1
        sample = np.arange(F)
        names = [""] * F
        if mode == "drawings":
            starts = []
            for dr in ex["drawings"]:
                nm, s0, hold = dr[0], int(dr[1]), int(dr[2])
                at = int(dr[3]) if len(dr) > 3 else s0
                starts.append((s0, hold, nm, at))
            for f in range(F):
                cur = None
                for s0, hold, nm, at in starts:
                    if s0 <= f:
                        cur = (nm, at)
                if cur is None:
                    sample[f], names[f] = 0, "pre"
                else:
                    names[f], sample[f] = cur[0], cur[1]
        elif mode in ("ones", "twos", "threes"):
            step = {"ones": 1, "twos": 2, "threes": 3}[mode]
            anchors = set()
            for k in self.keys:
                anchors.add(k["frame"])
                anchors.add(k["frame"] + k["_hold"] + 1)
            S = set()
            srt = sorted(a for a in anchors if a <= self.length)
            for a, b in zip(srt, srt[1:] + [self.length + 1]):
                S.update(range(a, b, step))
            S.add(0)
            S = sorted(S)
            for f in range(F):
                s = max(x for x in S if x <= f)
                sample[f] = s
                names[f] = f"d{s}"
        else:
            raise ValueError(f"unknown exposure mode {mode!r}")
        return sample, names

    def build(self):
        F = self.length + 1
        cont, prog = [], []
        for f in range(F):
            cont.append(self.at(f))
            prog.append(self._prog)
        prog = np.array(prog, float)
        # continuous FK (for contacts and glaive hints)
        J = len(NAMES)
        pos = np.zeros((F, J, 3))
        glob_q = np.zeros((F, J, 4))
        loc = np.zeros((F, J, 4))
        root = np.zeros((F, 3))
        sroot = np.zeros((F, 3))
        tau = np.zeros(F)
        gw = np.zeros(F)
        gd = np.zeros((F, 3))
        for f, (p, t, (w, dvec)) in enumerate(cont):
            g, x = fk(p["q"], p["root"], p["psi"])
            lq = p["q"].copy()
            lq[0] = Q.join_yaw(p["psi"], p["q"][0])
            pos[f], glob_q[f], loc[f], root[f], sroot[f], tau[f] = x, g, lq, p["root"], p["sroot"], t
            gw[f] = w
            # glaive override direction is in her frame: turn it with her heading
            c, s = math.cos(p["psi"]), math.sin(p["psi"])
            gd[f] = [c * dvec[0] + s * dvec[2], dvec[1], -s * dvec[0] + c * dvec[2]]
        contacts = foot_contacts(pos)
        gw, gd = glaive_track(pos, gw, gd)
        sample, names = self.exposure()
        pick = lambda a: a[sample]  # noqa: E731
        return {
            "local_q": pick(loc), "root": pick(root), "sroot": pick(sroot), "pos": pick(pos),
            "global_q": pick(glob_q), "tau": pick(tau), "sample": sample, "drawing": names,
            "contacts": pick(contacts), "glaive_w": pick(gw), "glaive_dir": pick(gd),
            "cont_pos": pos, "cont_root": root, "cont_sroot": sroot,
            # which keys a frame sits between and the eased progress (the hero layer blends on it)
            "key_a": pick(prog[:, 0]).astype(int), "key_b": pick(prog[:, 1]).astype(int), "key_u": pick(prog[:, 2]),
            "key_names": [k["name"] for k in self.keys], "key_frames": [int(k["frame"]) for k in self.keys],
        }


GRIP_SPACING = 0.44     # the key poses hold the haft with the wrists 0.44 m apart (rosace_keys.py)


def glaive_track(pos, hint_w, hint_dir):
    """Final haft direction per continuous frame (SOMA axes, butt -> tip) and how much the left
    hand is on it. Two-handed direction = right wrist -> left wrist, trusted only when the wrists
    sit near the authored grip spacing; frames where they don't (a regrip mid-swing, hands
    crossing) take the direction slerped between the nearest trusted frames. Then the sheet's
    one-hand hint ('upright' etc.) is blended in by its weight."""
    F = len(pos)
    v = pos[:, IDX["LeftHand"]] - pos[:, IDX["RightHand"]]
    dist = np.linalg.norm(v, axis=1)
    d2 = v / np.maximum(dist, 1e-6)[:, None]
    conf = np.clip(1 - np.abs(dist - GRIP_SPACING) / 0.18, 0, 1)
    good = np.where(conf >= 0.5)[0]
    dirs = d2.copy()
    if len(good):
        for f in range(F):
            if conf[f] >= 0.5:
                continue
            a = good[good < f]
            b = good[good > f]
            if len(a) and len(b):
                fa, fb = a[-1], b[0]
                qa = Q.normalize(np.concatenate([[1.0], np.zeros(3)]))
                # rotate d(fa) toward d(fb) by the fraction of the gap
                ax = np.cross(d2[fa], d2[fb])
                ang = math.atan2(np.linalg.norm(ax), float(np.dot(d2[fa], d2[fb])))
                if np.linalg.norm(ax) > 1e-6:
                    qa = Q.from_axis_angle(ax, math.degrees(ang) * (f - fa) / (fb - fa))
                dirs[f] = Q.rotate(qa, d2[fa])
            else:
                dirs[f] = d2[a[-1] if len(a) else b[0]]
    two = np.clip((0.75 - dist) / 0.2, 0, 1) * np.maximum(conf, 0.5)
    w = hint_w * np.clip(two * 2, 0, 1)
    out = np.zeros((F, 3))
    for f in range(F):
        x = dirs[f] * hint_w[f] + hint_dir[f] / max(np.linalg.norm(hint_dir[f]), 1e-6) * (1 - hint_w[f])
        out[f] = x / max(np.linalg.norm(x), 1e-6)
    return w, out


def foot_contacts(pos, fps=GAME_FPS):
    """planted feet on a continuous clip: low and slow (ankle or toe)"""
    F = len(pos)
    out = np.zeros((F, 2), bool)
    for s, side in enumerate(("Left", "Right")):
        a = pos[:, IDX[f"{side}Foot"]]
        t = pos[:, IDX[f"{side}ToeBase"]]
        low = (a[:, 1] < ANKLE_FLOOR + 0.035) | (t[:, 1] < TOE_FLOOR + 0.03)
        pt = np.where((a[:, 1] - ANKLE_FLOOR < t[:, 1] - TOE_FLOOR)[:, None], a, t)
        v = np.zeros(F)
        v[1:] = np.linalg.norm(np.diff(pt[:, [0, 2]], axis=0), axis=1) * fps
        v[0] = v[1] if F > 1 else 0
        out[:, s] = low & (v < 0.45)
    # close 1-frame gaps and drop 1-frame blips
    for s in range(2):
        c = out[:, s].copy()
        for f in range(1, F - 1):
            if not c[f] and c[f - 1] and c[f + 1]:
                out[f, s] = True
            if c[f] and not c[f - 1] and not c[f + 1]:
                out[f, s] = False
    return out


# ---------------------------------------------------------------------------- outputs
def write(res, sheet, out_npz):
    out_npz = Path(out_npz)
    out_npz.parent.mkdir(parents=True, exist_ok=True)
    F = len(res["sample"])
    np.savez_compressed(
        out_npz,
        local_rot_mats=Q.to_mat(res["local_q"]).astype(np.float32),
        root_positions=res["root"].astype(np.float32),
        smooth_root_pos=res["sroot"].astype(np.float32),
        posed_joints=res["pos"].astype(np.float32),
        sample_frame=res["sample"].astype(np.int32),
        source_time=res["tau"].astype(np.float32),
        contacts=res["contacts"],
        glaive_w=res["glaive_w"].astype(np.float32),
        glaive_dir=res["glaive_dir"].astype(np.float32),
        drawing=np.array(res["drawing"]),
        key_a=res["key_a"].astype(np.int32), key_b=res["key_b"].astype(np.int32),
        key_u=res["key_u"].astype(np.float32), key_names=np.array(res["key_names"]),
        key_frames=np.array(res["key_frames"], np.int32),
    )
    # root motion the engine should apply (RUNTIME-CONTRACT rootMotion), from the smoothed root,
    # facing-relative (+ = her forward = +Z at heading 0), metres on the SOMA body
    fwd = res["sroot"][:, 2]
    info = {
        "sheet": str(sheet.path) if sheet.path else None,
        "source_npz": str(sheet.src_npz),
        "fps": GAME_FPS,
        "frames": F,
        "keys": [{"name": k["name"], "frame": k["frame"], "hold": k["_hold"], "src": k["_src"],
                  "ease": k.get("ease", sheet.d.get("ease_default", "in_out"))} for k in sheet.keys],
        "per_frame": [{"f": f, "drawing": res["drawing"][f], "sample": int(res["sample"][f]),
                       "src": round(float(res["tau"][f]), 3),
                       "contacts": [bool(c) for c in res["contacts"][f]],
                       "root_fwd_m": round(float(fwd[f] - fwd[0]), 4)} for f in range(F)],
        "drawings": len(set(int(s) for s in res["sample"])),
    }
    out_npz.with_suffix(".json").write_text(json.dumps(info, indent=1))
    return info


def raw_sheet(sheet_dict):
    """the untouched clip on the same clock: every source frame shown once at 60 fps (study tempo
    puts MOVESET fN at source frame pre_roll + N, so the keys land on the same frames), no holds,
    no push, no stepping. This is the honest 'raw generated' baseline."""
    d = json.loads(json.dumps(sheet_dict))
    root = Path(d["source"].get("root", RAW))
    meta = json.loads((root / d["source"]["meta"]).read_text())
    m = Motion.load(root / d["source"]["npz"], root / d["source"]["meta"])
    pre = int(meta.get("pre_roll", 0))
    L = int(d["length"])
    # identity clock: game frame f shows source frame pre + f. Keys are kept only for their
    # glaive hints, moved to their source frame so the warp stays exactly linear.
    keys, seen = [], set()
    for k in d["keys"]:
        f = round(m.frame_of(k["src"])) - pre
        if 0 < f < L and f not in seen:
            seen.add(f)
            keys.append({"name": k["name"], "src": pre + f, "frame": f, "ease": "linear",
                         **({"glaive": k["glaive"]} if "glaive" in k else {})})
    first = d["keys"][0]
    last = d["keys"][-1]
    keys = ([{"name": "start", "src": pre, "frame": 0, "ease": "linear",
              **({"glaive": first["glaive"]} if "glaive" in first else {})}] + keys +
            [{"name": "end", "src": pre + L, "frame": L, "ease": "linear",
              **({"glaive": last["glaive"]} if "glaive" in last else {})}])
    d["keys"] = keys
    d["exposure"] = {"mode": "ones"}
    d.pop("push_ref", None)
    d["name"] = d.get("name", "move") + "_raw"
    return d


# ---------------------------------------------------------------------------- key extraction
def find_keys(m, min_gap=3):
    """candidate key poses on a source clip: extremes (the body momentarily stops: minima of joint
    speed) and strikes (maxima of hand speed). Returns list of (frame, kind, score)."""
    F = m.n
    pos = np.array([fk(m.q[f], m.root[f], m.psi[f])[1] for f in range(F)])
    body = [IDX[j] for c in ("spine", "neck", "arm_L", "arm_R", "leg_L", "leg_R") for j in CHAINS[c]]
    rel = pos - pos[:, :1]
    v = np.zeros(F)
    v[1:] = np.linalg.norm(np.diff(rel[:, body], axis=0), axis=2).mean(1) * m.fps
    v[0] = v[1]
    v = np.convolve(np.pad(v, 1, mode="edge"), np.ones(3) / 3, mode="valid")
    hands = [IDX["LeftHand"], IDX["RightHand"]]
    hv = np.zeros(F)
    hv[1:] = np.linalg.norm(np.diff(rel[:, hands], axis=0), axis=2).max(1) * m.fps
    hv[0] = hv[1]
    out = []
    for f in range(1, F - 1):
        if v[f] <= v[f - 1] and v[f] < v[f + 1]:
            out.append((f, "extreme", float(v[f])))
        if hv[f] >= hv[f - 1] and hv[f] > hv[f + 1] and hv[f] > np.percentile(hv, 75):
            out.append((f, "strike", float(hv[f])))
    out.sort()
    keep = []
    for f, kind, s in out:
        if keep and f - keep[-1][0] < min_gap and keep[-1][1] == kind:
            if (kind == "extreme" and s < keep[-1][2]) or (kind == "strike" and s > keep[-1][2]):
                keep[-1] = (f, kind, s)
            continue
        keep.append((f, kind, s))
    return keep, v, hv


# ---------------------------------------------------------------------------- stick preview
BONES = [(IDX[n], PARENTS[IDX[n]]) for n in NAMES if PARENTS[IDX[n]] >= 0 and not any(
    s in n for s in ("Thumb", "Index", "Middle", "Ring", "Pinky", "Eye", "Jaw", "End"))]
GRIP_OFF_TO_TIP = 1.52   # Rosace glaive: grip_off 0.855 m from the butt, 2.376 m long (SOMA-scaled)
GRIP_OFF_TO_BUTT = 0.93


def cam_axes(yaw=60.0, elev=8.0):
    """the pixel render's camera (rosace/render.py camera_frame) in SOMA axes (Y up, faces +Z)"""
    a, e = math.radians(yaw), math.radians(elev)
    # Blender frame: she faces -Y, left +X. SOMA -> Blender: (x, y, z) -> (x, -z, y)
    h = np.array([-math.sin(a), -math.cos(a), 0.0])
    back = h * math.cos(e) + np.array([0, 0, math.sin(e)])
    back /= np.linalg.norm(back)
    fwd = -back
    right = np.cross(fwd, [0, 0, 1.0])
    right /= np.linalg.norm(right)
    up = np.cross(right, fwd)
    to_soma = lambda v: np.array([v[0], v[2], -v[1]])  # noqa: E731
    return to_soma(right), to_soma(up)


def glaive_line(pos, w, gdir):
    pr = (pos[IDX["RightHand"]] + pos[IDX["RightHandMiddle1"]]) / 2
    d = gdir / max(np.linalg.norm(gdir), 1e-6)
    return pr - d * GRIP_OFF_TO_BUTT * 0.94, pr + d * GRIP_OFF_TO_TIP * 0.94


def stick_frames(clips, labels, scale=2, px=144, yaw=60.0, elev=8.0, in_place=True, f_offset=0):
    from PIL import Image, ImageDraw
    right, up = cam_axes(yaw, elev)
    ppm = px / 1.76
    projs = []
    for c in clips:
        P = c["pos"].copy()
        if in_place:
            P[:, :, [0, 2]] -= c["sroot"][:, None, [0, 2]]
        projs.append(P)
    allp = np.concatenate([p.reshape(-1, 3) for p in projs])
    xs, ys = allp @ right, allp @ up
    x0, x1 = xs.min() - 0.25, xs.max() + 0.25
    y0, y1 = min(ys.min(), 0) - 0.1, max(ys.max(), 2.3) + 0.1
    W, H = int((x1 - x0) * ppm), int((y1 - y0) * ppm) + 12
    n = max(len(c["pos"]) for c in clips)
    frames = []
    for f in range(n):
        im = Image.new("RGB", (W * len(clips), H), (24, 24, 32))
        dr = ImageDraw.Draw(im)
        for ci, (c, P) in enumerate(zip(clips, projs)):
            ff = min(f, len(P) - 1)
            ox = ci * W

            def sp(v):
                return (ox + (v @ right - x0) * ppm, H - 12 - (v @ up - y0) * ppm)
            dr.line([sp(np.array([x0 + 0.3, 0, 0]) * 0), sp(np.array([0, 0, 0]))], fill=(24, 24, 32))
            gy = H - 12 - (0 - y0) * ppm
            dr.line([(ox, gy), (ox + W, gy)], fill=(70, 70, 90))
            for j, pj in BONES:
                n_ = NAMES[j]
                col = (120, 170, 255) if n_.startswith("Left") else (255, 130, 120) if n_.startswith("Right") \
                    else (230, 230, 230)
                dr.line([sp(P[ff, pj]), sp(P[ff, j])], fill=col, width=2)
            b, t = glaive_line(P[ff], c["glaive_w"][ff], c["glaive_dir"][ff])
            dr.line([sp(b), sp(t)], fill=(250, 220, 120), width=1)
            dr.ellipse([sp(t)[0] - 2, sp(t)[1] - 2, sp(t)[0] + 2, sp(t)[1] + 2], fill=(250, 250, 255))
            for s in range(2):
                if c["contacts"][ff, s]:
                    a = sp(P[ff, IDX["LeftFoot" if s == 0 else "RightFoot"]])
                    dr.rectangle([a[0] - 2, a[1] - 2, a[0] + 2, a[1] + 2], outline=(120, 255, 140))
            lab = f"{labels[ci]}  f{ff + f_offset:02d} {c['drawing'][ff]}"
            dr.text((ox + 4, 3), lab, fill=(220, 220, 220))
        if scale != 1:
            im = im.resize((im.width * scale, im.height * scale), Image.NEAREST)
        frames.append(im)
    return frames


def stick_sheet(clips, labels, frames_idx, path, scale=2, **kw):
    """rows = clips, columns = the given frames (e.g. every new drawing of the retimed clip)"""
    from PIL import Image, ImageDraw
    cols = []
    for f in frames_idx:
        row_ims = [stick_frames([{k: (v[min(f, len(v) - 1):min(f, len(v) - 1) + 1] if k != "drawing" else
                                      [v[min(f, len(v) - 1)]]) for k, v in c.items()}], [lab], scale=scale, f_offset=f, **kw)[0]
                   for c, lab in zip(clips, labels)]
        cols.append(row_ims)
    w, h = cols[0][0].size
    sheet = Image.new("RGB", (w * len(cols), h * len(clips)), (0, 0, 0))
    d = ImageDraw.Draw(sheet)
    for ci, col in enumerate(cols):
        for ri, im in enumerate(col):
            sheet.paste(im, (ci * w, ri * h))
            d.text((ci * w + 4, ri * h + h - 12), f"f{frames_idx[ci]}", fill=(255, 255, 120))
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    sheet.save(path)
    return path


def save_gif(frames, path, fps=60):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    # GIF delays are in 10 ms units; 60 fps -> alternate 20/10 ms so the average is 16.7 ms
    dur = [20 if i % 3 != 2 else 10 for i in range(len(frames))] if fps == 60 else [int(1000 / fps)] * len(frames)
    frames[0].save(path, save_all=True, append_images=frames[1:], duration=dur, loop=0, disposal=1)


def load_result(npz):
    d = np.load(npz)
    return {"pos": d["posed_joints"], "sroot": d["smooth_root_pos"], "glaive_w": d["glaive_w"],
            "glaive_dir": d["glaive_dir"], "contacts": d["contacts"], "drawing": [str(x) for x in d["drawing"]]}


# ---------------------------------------------------------------------------- CLI
def cmd_build(a):
    sheet = Sheet(a.sheet, Path(a.raw))
    out_dir = Path(a.out) if a.out else OUT_DATA
    name = sheet.name
    res = sheet.build()
    info = write(res, sheet, out_dir / f"{name}.npz")
    clips, labels = [res], [name]
    if a.raw_too:
        rs = Sheet(raw_sheet(sheet.d), Path(a.raw))
        rres = rs.build()
        write(rres, rs, out_dir / f"{rs.name}.npz")
        clips, labels = [rres, res], [rs.name, name]
    if not a.no_preview:
        gif = Path(a.preview_dir or OUT_REVIEW) / f"{name}_stick.gif"
        save_gif(stick_frames(clips, labels, scale=a.scale), gif)
        starts = sorted(set(int(x) for x in res["sample"]))
        png = stick_sheet(clips, labels, starts, gif.with_name(f"{name}_stick_sheet.png"), scale=1)
        print("preview", gif, png)
    print(f"{name}: {info['frames']} frames, {info['drawings']} drawings -> {out_dir / (name + '.npz')}")
    for k in info["keys"]:
        print(f"  f{k['frame']:>3} hold {k['hold']:>2}  src {k['src']:6.1f}  {k['name']}  ease={k['ease']}")


def cmd_keys(a):
    m = Motion.load(a.npz, a.meta)
    keep, v, hv = find_keys(m)
    lab = {k["frame"]: k["label"] for k in m.labels}
    print(f"{a.npz}: {m.n} frames @ {m.fps:.0f} fps")
    print(" frame  kind      speed   nearest sidecar label")
    for f, kind, s in keep:
        near = min(lab, key=lambda x: abs(x - f)) if lab else None
        nl = f"{lab[near]} (f{near})" if near is not None and abs(near - f) <= 2 else ""
        print(f" {f:5d}  {kind:8s} {s:6.2f}   {nl}")


def cmd_init(a):
    m = Motion.load(a.npz, a.meta)
    meta = json.loads(Path(a.meta).read_text())
    pre = int(meta.get("pre_roll", 0))
    keys = []
    for k in meta["keys"]:
        if "pre-roll" in k["label"] or "tail" in k["label"]:
            continue
        keys.append({"name": k["label"], "src": k["label"], "frame": int(k["frame"]) - pre, "hold": 0,
                     "ease": "in_out"})
    try:
        npz_rel = str(Path(a.npz).resolve().relative_to(RAW)).replace("\\", "/")
        meta_rel = str(Path(a.meta).resolve().relative_to(RAW)).replace("\\", "/")
    except ValueError:
        npz_rel, meta_rel = str(a.npz), str(a.meta)
    sheet = {"name": a.move, "move": a.move, "length": max(k["frame"] for k in keys),
             "source": {"npz": npz_rel, "meta": meta_rel}, "push_ref": keys[0]["name"],
             "keys": keys, "exposure": {"mode": "twos"}}
    Path(a.out).write_text(json.dumps(sheet, indent=1))
    print("wrote", a.out, "with", len(keys), "keys from the sidecar;", m.n, "source frames")


def cmd_preview(a):
    clips = [load_result(p) for p in a.npz]
    save_gif(stick_frames(clips, [Path(p).stem for p in a.npz], scale=a.scale), a.gif)
    print("preview", a.gif)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    b = sub.add_parser("build")
    b.add_argument("sheet")
    b.add_argument("--out", default=None)
    b.add_argument("--raw", default=str(RAW))
    b.add_argument("--raw-too", action="store_true")
    b.add_argument("--no-preview", action="store_true")
    b.add_argument("--preview-dir", default=None)
    b.add_argument("--scale", type=int, default=2)
    k = sub.add_parser("keys")
    k.add_argument("npz")
    k.add_argument("--meta", default=None)
    i = sub.add_parser("init")
    i.add_argument("npz")
    i.add_argument("--meta", required=True)
    i.add_argument("--move", required=True)
    i.add_argument("--out", required=True)
    p = sub.add_parser("preview")
    p.add_argument("npz", nargs="+")
    p.add_argument("--gif", required=True)
    p.add_argument("--scale", type=int, default=2)
    a = ap.parse_args()
    {"build": cmd_build, "keys": cmd_keys, "init": cmd_init, "preview": cmd_preview}[a.cmd](a)


if __name__ == "__main__":
    main()

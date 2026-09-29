"""Author Rosace key poses as Kimodo constraints: describe a pose in plain numbers, solve it with IK.

Run in the Kimodo venv. Imported by rosace_moves.py; no command line of its own.

A key pose (`Pose`) is written in HER frame, the way the MOVESET describes drawings:
  root   hips position in world metres [x, y, z]; y is hip height (standing ~0.97 m on the
         1.76 m SOMA body Kimodo uses; the glaive is 2.3 m = 1.35 H at that scale)
  yaw    facing in degrees (0 = world +Z = screen right in the side view; Kimodo's heading)
  lean   forward pitch of the hips in degrees (negative = arched back)
  twist  extra yaw of the chest relative to the hips (the "wind")
  hands  {"R": [x, y, z], "L": [...]}: wrist targets relative to the hips' floor point, in her
         frame (x = her left, y = absolute height, z = her forward). Leave a hand out to let it
         hang free. `grip(c, d)` fills both hands for a two-handed glaive grip: centre `c`,
         direction `d` toward the blade, the right (rear) hand nearer the butt.
  feet   {"L": [x, z] or [x, y, z], "R": ...} ankle targets in her frame; y defaults to the
         standing ankle height (6.2 cm). `toes=True` lifts both heels (on her toes).
  knee   {"R": [x, y, z]}: knee targets (a kneel)

The solver (Adam on axis-angle joint rotations of Kimodo's 30-joint SOMA skeleton, identity =
T-pose with world-aligned axes) pulls wrists, ankles and knees to their targets while staying
close to a relaxed standing base pose. Elbows and knees are held to hinge-like bends, joints
stay above the floor. It reports the residual per target, so an unreachable pose shows up as a
number rather than a silent miss.
"""
import math
from dataclasses import dataclass, field

import numpy as np
import torch

from kimodo.geometry import axis_angle_to_matrix, matrix_to_axis_angle
from kimodo.skeleton import SOMASkeleton30, SOMASkeleton77
from kimodo.skeleton.registry import build_skeleton

SK = build_skeleton(30)
NAMES = list(SK.bone_order_names)
IDX = {n: i for i, n in enumerate(NAMES)}
ANKLE_Y = 0.062
GLAIVE_M = 2.3
GRIP_SPACING = 0.44


def base_pose_77_npz(path):
    d = np.load(path)
    return torch.from_numpy(d["local_rot_mats"][0]).float()


def ry(deg):
    a = math.radians(deg)
    return np.array([[math.cos(a), 0, math.sin(a)], [0, 1, 0], [-math.sin(a), 0, math.cos(a)]])


def rx(deg):
    a = math.radians(deg)
    return np.array([[1, 0, 0], [0, math.cos(a), -math.sin(a)], [0, math.sin(a), math.cos(a)]])


def grip(c, d, spacing=GRIP_SPACING):
    """Two-handed grip on the haft: centre c, direction d (toward the blade). Right hand rear."""
    c, d = np.asarray(c, float), np.asarray(d, float)
    d = d / np.linalg.norm(d)
    return {"R": (c - d * spacing / 2).tolist(), "L": (c + d * spacing / 2).tolist()}


@dataclass
class Pose:
    root: list
    yaw: float = 0.0
    lean: float = 0.0
    twist: float = 0.0
    hands: dict = field(default_factory=dict)
    feet: dict = field(default_factory=dict)
    knee: dict = field(default_factory=dict)
    toes: bool = False
    name: str = ""

    def moved(self, dz=0.0, dx=0.0, **kw):
        """Copy with the root shifted in world XZ and any field replaced."""
        d = dict(self.__dict__)
        d["root"] = [self.root[0] + dx, self.root[1], self.root[2] + dz]
        d.update(kw)
        return Pose(**d)


def _to_world(pose, local):
    local = np.asarray(local, float)
    R = ry(pose.yaw)
    xz = R @ np.array([local[0], 0.0, local[2]])
    return np.array([pose.root[0] + xz[0], local[1], pose.root[2] + xz[2]])


def targets(pose):
    t = {}
    for side, p in pose.hands.items():
        t[f"{'Right' if side == 'R' else 'Left'}Hand"] = _to_world(pose, p)
    for side, p in pose.feet.items():
        p = list(p)
        if len(p) == 2:
            p = [p[0], 0.15 if pose.toes else ANKLE_Y, p[1]]
        t[f"{'Right' if side == 'R' else 'Left'}Foot"] = _to_world(pose, p)
    for side, p in pose.knee.items():
        t[f"{'Right' if side == 'R' else 'Left'}Shin"] = _to_world(pose, p)
    return t


# per-joint pull toward the base pose (bigger = stiffer)
REG = {n: 0.02 for n in NAMES}
REG.update({"Spine1": 0.05, "Spine2": 0.05, "Chest": 0.05, "Neck1": 0.2, "Neck2": 0.2, "Head": 0.2,
            "Jaw": 5, "LeftEye": 5, "RightEye": 5, "LeftShoulder": 0.15, "RightShoulder": 0.15,
            "LeftHand": 0.4, "RightHand": 0.4, "LeftHandThumbEnd": 5, "LeftHandMiddleEnd": 5,
            "RightHandThumbEnd": 5, "RightHandMiddleEnd": 5, "LeftArm": 0.005, "RightArm": 0.005,
            "LeftForeArm": 0.005, "RightForeArm": 0.005, "LeftLeg": 0.01, "RightLeg": 0.01,
            "LeftShin": 0.01, "RightShin": 0.01, "LeftFoot": 0.1, "RightFoot": 0.1,
            "LeftToeBase": 0.5, "RightToeBase": 0.5})


def solve(poses, base77, iters=700, verbose=False):
    """Solve a list of Poses at once. Returns (local_aa30 (N,30,3), root (N,3), report list)."""
    N = len(poses)
    base30 = SOMASkeleton30().from_SOMASkeleton77(base77[None])[0]  # (30,3,3)
    base_aa = matrix_to_axis_angle(base30)  # (30,3)
    aa = base_aa[None].repeat(N, 1, 1).clone()
    root_R = []
    for p in poses:
        R0 = ry(p.yaw) @ rx(p.lean)
        root_R.append(torch.tensor(R0, dtype=torch.float32))
    root_R = torch.stack(root_R)
    aa[:, 0] = matrix_to_axis_angle(root_R)
    # spread the twist over the three spine joints as the starting guess
    for i, p in enumerate(poses):
        for j in ("Spine1", "Spine2", "Chest"):
            tw = torch.tensor(ry(p.twist / 3), dtype=torch.float32)
            aa[i, IDX[j]] = matrix_to_axis_angle(tw @ axis_angle_to_matrix(aa[i, IDX[j]]))
    # crouches: start with bent knees (thigh forward, shin back) so the solver doesn't fold a leg
    # sideways into a local minimum
    for i, p in enumerate(poses):
        k = float(np.clip(1.6 * (0.97 - p.root[1]) / 0.4, 0.0, 2.2))
        for side in ("Left", "Right"):
            aa[i, IDX[side + "Shin"]] = torch.tensor([k, 0.0, 0.0])
            aa[i, IDX[side + "Leg"]] = torch.tensor([-0.5 * k, 0.0, 0.0])
    prior = aa.clone()
    prior[:, [IDX["LeftShin"], IDX["RightShin"], IDX["LeftLeg"], IDX["RightLeg"]]] =         base_aa[[IDX["LeftShin"], IDX["RightShin"], IDX["LeftLeg"], IDX["RightLeg"]]]
    aa = aa.requires_grad_(True)
    rootpos = torch.tensor([p.root for p in poses], dtype=torch.float32)
    tlist = [targets(p) for p in poses]
    tgt_idx, tgt_pos, tgt_w = [], [], []
    for i, t in enumerate(tlist):
        for jn, pos in t.items():
            tgt_idx.append((i, IDX[jn]))
            tgt_pos.append(pos)
            tgt_w.append(0.6 if jn.endswith("Shin") else 1.0)
    ti = torch.tensor(tgt_idx) if tgt_idx else torch.zeros((0, 2), dtype=torch.long)
    tp = torch.tensor(np.array(tgt_pos), dtype=torch.float32) if tgt_pos else torch.zeros((0, 3))
    tw = torch.tensor(tgt_w)
    regw = torch.tensor([REG[n] for n in NAMES])
    chest_yaw = torch.tensor([math.radians(p.yaw + p.twist) for p in poses])
    toes = torch.tensor([1.0 if p.toes else 0.0 for p in poses])
    # feet flat unless on toes: toe joint height target
    opt = torch.optim.Adam([aa], lr=0.03)
    Lf, Rf = IDX["LeftFoot"], IDX["RightFoot"]
    Lt, Rt = IDX["LeftToeBase"], IDX["RightToeBase"]
    for it in range(iters):
        opt.zero_grad()
        R = axis_angle_to_matrix(aa)
        g, pos, _ = SK.fk(R, rootpos)
        loss = 0.0
        if len(ti):
            e = pos[ti[:, 0], ti[:, 1]] - tp
            loss = loss + 200.0 * (tw * (e ** 2).sum(-1)).sum()
        loss = loss + (regw[None, :, None] * (aa - prior) ** 2).sum()
        # root orientation close to yaw/lean spec
        loss = loss + 50.0 * ((aa[:, 0] - prior[:, 0]) ** 2).sum()
        # chest facing
        f = g[:, IDX["Chest"]] @ torch.tensor([0.0, 0.0, 1.0])
        cy = torch.atan2(f[:, 0], f[:, 2])
        loss = loss + 2.0 * (1 - torch.cos(cy - chest_yaw)).sum()
        # head upright-ish
        hu = g[:, IDX["Head"]] @ torch.tensor([0.0, 1.0, 0.0])
        loss = loss + 1.0 * (1 - hu[:, 1]).sum()
        # hinges: elbows bend forward about local Y (left <= 0, right >= 0), knees about local X (>= 0)
        le, re = aa[:, IDX["LeftForeArm"]], aa[:, IDX["RightForeArm"]]
        loss = loss + 5.0 * (le[:, 2] ** 2 + re[:, 2] ** 2).sum() + 1.0 * (le[:, 0] ** 2 + re[:, 0] ** 2).sum()
        loss = loss + 20.0 * (torch.relu(le[:, 1]) ** 2 + torch.relu(-re[:, 1]) ** 2).sum()
        for kn in ("LeftShin", "RightShin"):
            k = aa[:, IDX[kn]]
            loss = loss + 5.0 * (k[:, 1] ** 2 + k[:, 2] ** 2).sum() + 20.0 * (torch.relu(-k[:, 0]) ** 2).sum()
        # no corkscrew limbs: limit twist about the bone axis (thigh: local Y, upper arm: local X)
        for lg in ("LeftLeg", "RightLeg"):
            loss = loss + 30.0 * (torch.relu(aa[:, IDX[lg], 1].abs() - 0.5) ** 2).sum()
        for am in ("LeftArm", "RightArm"):
            loss = loss + 10.0 * (torch.relu(aa[:, IDX[am], 0].abs() - 1.2) ** 2).sum()
        # floor and flat feet
        loss = loss + 500.0 * (torch.relu(0.005 - pos[..., 1]) ** 2).sum()
        for fj, tj in ((Lf, Lt), (Rf, Rt)):
            planted = pos[:, fj, 1] < 0.1
            flat = (pos[:, tj, 1] - 0.011) ** 2
            loss = loss + 50.0 * (flat * planted.float() * (1 - toes)).sum()
        loss.backward()
        opt.step()
    with torch.no_grad():
        R = axis_angle_to_matrix(aa)
        g, pos, _ = SK.fk(R, rootpos)
    report = []
    for i, t in enumerate(tlist):
        res = {jn: round(float(np.linalg.norm(pos[i, IDX[jn]].numpy() - p)) * 100, 1) for jn, p in t.items()}
        report.append({"pose": poses[i].name, "residual_cm": res})
        if verbose:
            print(poses[i].name, res)
    return aa.detach(), rootpos, pos.detach(), report


def constraint_entries(frames, aa, rootpos, mode):
    """Kimodo constraint dicts for keyed frames. mode: 'full' (every joint) or 'ee' (hands+feet+hips)."""
    fr = [int(f) for f in frames]
    base = {"frame_indices": fr, "local_joints_rot": aa.tolist(), "root_positions": rootpos.tolist()}
    if mode == "full":
        return [dict(type="fullbody", **base)]
    return [dict(type="end-effector", joint_names=["LeftHand", "RightHand", "LeftFoot", "RightFoot"], **base)]


def root2d_entry(frames, xz, yaw_deg=None):
    e = {"type": "root2d", "frame_indices": [int(f) for f in frames], "smooth_root_2d": [list(map(float, p)) for p in xz]}
    if yaw_deg is not None:
        e["global_root_heading"] = [[math.cos(math.radians(y)), math.sin(math.radians(y))] for y in yaw_deg]
    return e

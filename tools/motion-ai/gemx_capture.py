"""Video -> 3D body motion with NVIDIA GEM-X (SOMA), on native Windows. Writes NPZ + BVH.

Run with the GEM-X venv (see SETUP.md):

  D:/Dex/Tools/venvs/gemx/Scripts/python.exe tools/motion-ai/gemx_capture.py \
      --video review/motion/_samples/muybridge_clubs_30fps.mp4 --out review/motion/_runs/gemx_smoke

Pipeline (NVIDIA's scripts/demo/demo_soma.py, minus its Linux-only EGL/Open3D mesh renders):
YOLOX person detection + ByteTrack -> ViTPose 77 2D keypoints -> SAM 3D Body image features
-> GEM-X regression -> SOMA body parameters per frame. Then our conversion:

  <out>/hpe_results.pt       GEM-X's raw prediction (torch)
  <out>/0_kp2d77_overlay.mp4 2D keypoints drawn on the video: check limb swaps here first
  <out>/motion_soma.npz      local_rot_mats (T,77,3,3), root_positions (T,3) m, joints (T,77,3) m,
                             fps, subject_hip_height (m); the same convention Kimodo uses
  <out>/motion.bvh           via soma_to_bvh.py in the Kimodo venv (same skeleton as Kimodo)
  <out>/report.json          timings, peak VRAM, frame count, warnings

Input video is resampled to 30 fps by GEM-X itself. Use fixed-camera footage (--static-cam is
the default): GEM-X's public code has no working camera tracker (issue #24) and silently
treats a moving camera as fixed anyway.
"""
import argparse
import json
import os
import subprocess
import sys
import time
from pathlib import Path

GEMX_ROOT = Path(os.environ.get("DEXPLACE_GEMX_SRC", r"D:\Dex\Tools\src\GEM-X"))
KIMODO_PY = Path(os.environ.get("DEXPLACE_KIMODO_PY", r"D:\Dex\Tools\venvs\kimodo\Scripts\python.exe"))
HERE = Path(__file__).resolve().parent


def parse_args():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--video", required=True)
    p.add_argument("--out", required=True, help="output folder")
    p.add_argument("--moving-cam", action="store_true", help="don't declare a static camera (see #24)")
    p.add_argument("--tpose-rest", action="store_true", help="BVH rest = standard T-pose")
    p.add_argument("--no-bvh", action="store_true")
    return p.parse_args()


def main():
    a = parse_args()
    video = Path(a.video).resolve()
    out = Path(a.out).resolve()
    out.mkdir(parents=True, exist_ok=True)
    os.chdir(GEMX_ROOT)  # GEM-X resolves inputs/ and configs/ relative to its repo root
    sys.path.insert(0, str(GEMX_ROOT))
    os.environ.setdefault("HF_HUB_OFFLINE", "1")
    # YOLOX's ONNX detector is cached under $TORCH_HOME/hub/checkpoints; keep it with our weights
    os.environ["TORCH_HOME"] = os.environ.get("DEXPLACE_TORCH_HOME", r"D:\Dex\Models\torch")
    # SOMA skins with NVIDIA Warp, whose kernel cache defaults to %LOCALAPPDATA% on C:
    os.environ.setdefault("WARP_CACHE_PATH", r"D:\Dex\Caches\warp")

    import numpy as np
    import torch  # noqa: F401  (loads torch's CUDA 12 / cuDNN 9 DLLs before onnxruntime-gpu 1.23)
    from hydra import compose, initialize_config_dir

    import scripts.demo.demo_soma as demo  # NVIDIA's demo module; we reuse its steps
    from gem.utils.kp2d_utils import render_2d_keypoints
    from gem.utils.net_utils import detach_to_cpu

    torch.cuda.reset_peak_memory_stats()
    t = {}
    overrides = ["exp=gem_soma_regression", f"video_name={video.stem}", f"video_path={video.as_posix()}",
                 f"output_root={out.parent.as_posix()}", f"output_dir={out.as_posix()}",
                 f"static_cam={str(not a.moving_cam).lower()}", "verbose=false", "render_mhr=false",
                 "use_wandb=false", "task=test"]
    with initialize_config_dir(version_base="1.3", config_dir=str(GEMX_ROOT / "configs")):
        cfg = compose(config_name="demo_soma", overrides=overrides)
    Path(cfg.preprocess_dir).mkdir(parents=True, exist_ok=True)
    t0 = time.perf_counter()
    demo._copy_video_if_needed(cfg)
    demo.run_preprocess(cfg)
    t["preprocess"] = time.perf_counter() - t0
    import cv2

    fps = int(cv2.VideoCapture(cfg.video_path).get(cv2.CAP_PROP_FPS) + 0.5) or 30
    render_2d_keypoints(video_path=cfg.video_path, vitpose_path=cfg.paths.vitpose, bbx_path=cfg.paths.bbx,
                        output_path=str(out / "0_kp2d77_overlay.mp4"), fps=fps)

    t0 = time.perf_counter()
    data = demo.load_data_dict(cfg)
    import hydra

    model = hydra.utils.instantiate(cfg.model, _recursive_=False)
    model.load_pretrained_model(demo.resolve_ckpt_path(cfg))
    model = model.eval().cuda()
    with torch.no_grad():
        pred = model.predict(data, static_cam=cfg.static_cam, postproc=True)
    pred = detach_to_cpu(pred)
    torch.save({k: v for k, v in pred.items() if k != "net_outputs"}, out / "hpe_results.pt")
    t["predict"] = time.perf_counter() - t0

    # ---- SOMA parameters -> Kimodo-convention local rotations + hips path -------------------
    bp = pred["body_params_global"]
    from gem.utils.soma_utils.soma_layer import SomaLayer

    poses = _poses77(bp)  # (T, 77, 3) axis-angle: [global_orient, body_pose...]
    T = poses.shape[0]
    layer = model.body_model if hasattr(model, "body_model") else SomaLayer("inputs/soma_assets", low_lod=True)
    ident = bp["identity_coeffs"].cuda().reshape(1, T, -1) if bp["identity_coeffs"].ndim == 2 else bp["identity_coeffs"].cuda()[None].repeat(1, T, 1)
    scale = bp.get("scale_params")
    if scale is not None:
        scale = scale.cuda().reshape(1, T, -1) if scale.ndim == 2 else scale.cuda()[None].repeat(1, T, 1)
    with torch.no_grad():
        joints = layer.temporal_forward(poses.cuda()[None], ident, scale, bp["transl"].cuda()[None],
                                        return_joints_only=True)["joints"][0].cpu()
        rest = layer.temporal_forward(torch.zeros_like(poses).cuda()[None], ident, scale,
                                      torch.zeros_like(bp["transl"]).cuda()[None],
                                      return_joints_only=True)["joints"][0, 0].cpu()
    rotmats = axis_angle_to_matrix(poses.float())
    subject_hip_height = float(rest[0, 1] - rest[:, 1].min())
    npz = out / "motion_soma.npz"
    np.savez(npz, local_rot_mats=rotmats.numpy(), root_positions=joints[:, 0].numpy(), joints=joints.numpy(),
             fps=np.float32(fps), subject_hip_height=np.float32(subject_hip_height))

    report = {
        "video": str(video), "frames": T, "fps": fps, "static_cam": cfg.static_cam,
        "seconds": {k: round(v, 1) for k, v in t.items()},
        "peak_vram_mib_torch": round(torch.cuda.max_memory_allocated() / 2**20, 1),
        "gpu": torch.cuda.get_device_name(0), "torch": torch.__version__,
        "body_param_keys": {k: list(v.shape) for k, v in bp.items()},
        "subject_hip_height_m": round(subject_hip_height, 3),
        "joints_y_range_m": [round(float(joints[..., 1].min()), 3), round(float(joints[..., 1].max()), 3)],
        "hips_start_m": joints[0, 0].numpy().round(3).tolist(), "hips_end_m": joints[-1, 0].numpy().round(3).tolist(),
        "files": [str(npz), str(out / "hpe_results.pt"), str(out / "0_kp2d77_overlay.mp4")],
    }
    if not a.no_bvh:
        cmd = [str(KIMODO_PY), str(HERE / "soma_to_bvh.py"), str(npz), str(out / "motion.bvh")]
        if a.tpose_rest:
            cmd.append("--tpose-rest")
        r = subprocess.run(cmd, capture_output=True, text=True)
        report["bvh"] = r.stdout.strip() or r.stderr.strip()[-2000:]
        if r.returncode == 0:
            report["files"].append(str(out / "motion.bvh"))
    (out / "report.json").write_text(json.dumps(report, indent=1), encoding="utf-8")
    print("GEMX_CAPTURE " + json.dumps(report))


def _poses77(bp):
    import torch

    if "poses" in bp:
        p = bp["poses"]
    else:
        p = torch.cat([bp["global_orient"], bp["body_pose"]], dim=-1)
    return p.reshape(p.shape[0], -1, 3)


def axis_angle_to_matrix(aa):
    """(..., 3) axis-angle -> (..., 3, 3) rotation matrices (Rodrigues; avoids pytorch3d)."""
    import torch

    angle = aa.norm(dim=-1, keepdim=True).clamp_min(1e-8)
    x, y, z = (aa / angle).unbind(-1)
    c, s = torch.cos(angle[..., 0]), torch.sin(angle[..., 0])
    C = 1 - c
    return torch.stack([c + x * x * C, x * y * C - z * s, x * z * C + y * s,
                        y * x * C + z * s, c + y * y * C, y * z * C - x * s,
                        z * x * C - y * s, z * y * C + x * s, c + z * z * C], -1).reshape(*aa.shape[:-1], 3, 3)


if __name__ == "__main__":
    main()

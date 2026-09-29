"""Generate body motion with NVIDIA Kimodo (SOMA v1.1) and write NPZ + BVH + a run report.

Run with the Kimodo venv (see SETUP.md):

  D:/Dex/Tools/venvs/kimodo/Scripts/python.exe tools/motion-ai/kimodo_gen.py \
      --constraints D:/Dex/Tools/src/kimodo/kimodo/assets/demo/examples/kimodo-soma-rp/03_full_body_keyframes/constraints.json \
      --duration 5 --seed 43 --out review/motion/_runs/kimodo_smoke_notext

Constraint JSON format: Kimodo's docs/source/user_guide/constraints.md (types fullbody,
left-hand/right-hand/left-foot/right-foot, end-effector, root2d; Y-up metres; frame indices
must be < frame count, which this wrapper checks). Use --device cpu when the GPU is busy
(measured 1.9 steps/s on CPU vs 0.8 to 18 on a shared/free 4090; see SETUP.md).

Outputs, all sharing the --out stem:
  <stem>.bvh   SOMA 77-joint skeleton, centimetres, Y-up, 30 fps (skeleton in SETUP.md)
  <stem>.npz   Kimodo's own arrays (joint positions in metres, rotations, foot contacts)
  <stem>.json  what was run: model + revision, seed, inputs, frames, peak VRAM, seconds

Text prompts. Kimodo's text encoder is LLM2Vec (two McGill-NLP LoRA adapters) on
Meta-Llama-3-8B-Instruct. The weights sit in a Hugging Face cache on D: (SETUP.md), filed under
the official repo id `meta-llama/Meta-Llama-3-8B-Instruct` because LLM2Vec picks its Llama 3
chat template by that id. This script points Hugging Face at that cache and goes offline for
its own process only; nothing machine-wide changes.

  --text "a woman walks calmly forward"    text-conditioned (loads the 16 GB encoder)
  (no --text)                              constraints only: --text-encoder none, a stand-in
                                           returning the all-zero features Kimodo itself uses
                                           for an empty prompt; Kimodo was trained with text
                                           dropped for guidance, so this is its own "no text"
                                           mode (NVIDIA benchmarks it as `constraints_notext`)
  --text-device cpu|cuda|auto   where the encoder runs. Default cpu: ~15 s to load, ~1 s per
                         prompt, ~16 GB RAM, no VRAM (the GPU is shared with the local LLM
                         server). cuda takes ~15.6 GB VRAM; auto = cuda only if >= 20 GiB is
                         free at start (the LLM server can grab it back mid-run)
  --text-encoder url     use a running `kimodo_textencoder` server at $TEXT_ENCODER_URL
Text and constraints combine: --text plus --constraints steers the in-between motion.
"""
import argparse
import json
import os
import sys
import time
from pathlib import Path

MODELS_DIR = os.environ.get("DEXPLACE_KIMODO_CHECKPOINTS", r"D:\Dex\Models\kimodo")
MODEL_NAME = "Kimodo-SOMA-RP-v1.1"
MODEL_REVISION = "6c9233af1180b8151e3c4703477104af5dce9dd5"  # HF commit downloaded 2026-09-28

# Hugging Face cache holding the text encoder (SETUP.md "Text prompts"). The machine-wide
# HF_HOME points elsewhere (D:\Dex\AI\HuggingFace); we override it for this process only.
HF_HOME_DIR = os.environ.get("DEXPLACE_HF_HOME", r"D:\Dex\Models\hf")
TEXT_ENCODER_REPOS = {  # repo id -> revision present in the cache (its refs/main)
    # bytes downloaded from the ungated NousResearch mirror, sha256-identical to Meta's files
    "meta-llama/Meta-Llama-3-8B-Instruct": "8afb486c1db24fe5011ec46dfbe5b5dccdb575c2",
    "McGill-NLP/LLM2Vec-Meta-Llama-3-8B-Instruct-mntp": "31474e395ada192e8ed1586db6be79fb3b70c9c0",
    "McGill-NLP/LLM2Vec-Meta-Llama-3-8B-Instruct-mntp-supervised": "baa8ebf04a1c2500e61288e7dad65e8ae42601a7",
}
GPU_FREE_GIB_FOR_TEXT = 20.0  # bf16 Llama 3 8B is ~15 GiB of weights, plus working room


def parse_args():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--text", "--prompt", dest="prompt", default="",
                   help="text prompt (loads the local Llama 3 encoder unless --text-encoder url)")
    p.add_argument("--text-encoder", choices=("none", "local", "url"), default=None,
                   help="default: local when --text is given, else none")
    p.add_argument("--text-device", choices=("cpu", "cuda", "auto"), default="cpu",
                   help="where the text encoder runs (default cpu; auto = cuda if >= 20 GiB VRAM free)")
    p.add_argument("--constraints", default=None, help="Kimodo constraints JSON (list of constraint objects)")
    p.add_argument("--duration", type=float, default=None, help="seconds (30 fps)")
    p.add_argument("--frames", type=int, default=None, help="frame count; overrides --duration (max 300)")
    p.add_argument("--seed", type=int, default=0)
    p.add_argument("--steps", type=int, default=100, help="DDIM denoising steps")
    p.add_argument("--samples", type=int, default=1, help="variations; files get _00, _01 ... suffixes")
    p.add_argument("--cfg", type=float, nargs=2, default=(2.0, 2.0), metavar=("TEXT", "CONSTRAINT"),
                   help="separated classifier-free guidance weights (Kimodo default 2 2)")
    p.add_argument("--heading", type=float, default=0.0, help="initial facing, radians (0 = +Z)")
    p.add_argument("--no-postprocess", action="store_true",
                   help="skip foot-skate cleanup (auto-skipped if motion_correction is not built)")
    p.add_argument("--tpose-rest", action="store_true",
                   help="BVH rest pose = standard T-pose (easier retargeting) instead of the SEED rest pose")
    p.add_argument("--out", required=True, help="output stem, e.g. review/motion/_runs/n1_try")
    p.add_argument("--device", default="cuda:0")
    return p.parse_args()


class NullTextEncoder:
    """Stand-in for the gated Llama 3 encoder: every prompt must be empty.

    Returns zeros with length 0, exactly what Kimodo._generate writes for an empty prompt
    (text_feat[empty] = 0 and a zero-length pad mask), so no information is invented.
    """

    llm_dim = 4096

    def __call__(self, texts):
        if isinstance(texts, str):
            texts = [texts]
        if any(t.strip() for t in texts):
            raise RuntimeError("--text-encoder none cannot encode a non-empty prompt")
        import torch

        return torch.zeros(len(texts), 1, self.llm_dim), [0] * len(texts)

    def to(self, *args, **kwargs):
        return self


def route_hf_env():
    """Point Hugging Face at our D: cache, offline, for this process only (before any HF import)."""
    hub = os.path.join(HF_HOME_DIR, "hub")
    os.environ["HF_HOME"] = HF_HOME_DIR
    os.environ["HF_HUB_CACHE"] = hub
    os.environ["HUGGINGFACE_CACHE_DIR"] = hub  # Kimodo's LLM2VecEncoder passes this as cache_dir
    os.environ.pop("TRANSFORMERS_CACHE", None)  # machine-wide legacy var would win over HF_HUB_CACHE
    os.environ["HF_HUB_OFFLINE"] = "1"  # never reach out once weights are local
    os.environ["TRANSFORMERS_OFFLINE"] = "1"
    os.environ["HF_HUB_DISABLE_IMPLICIT_TOKEN"] = "1"  # the cache needs no token; never send one
    os.environ["HF_HUB_DISABLE_TELEMETRY"] = "1"
    return hub


def check_text_encoder_cache(hub):
    if "TEXT_ENCODERS_DIR" in os.environ:
        return  # user pointed Kimodo at plain folders instead
    missing = [r for r in TEXT_ENCODER_REPOS
               if not os.path.isfile(os.path.join(hub, "models--" + r.replace("/", "--"), "refs", "main"))]
    if missing:
        sys.exit(f"text encoder weights missing from {hub}: {', '.join(missing)} (SETUP.md 'Text prompts')")


def pick_text_device(choice, gen_device, torch):
    if os.environ.get("TEXT_ENCODER_DEVICE"):
        return os.environ["TEXT_ENCODER_DEVICE"], "TEXT_ENCODER_DEVICE env"
    if choice != "auto":
        return choice, "--text-device"
    if not str(gen_device).startswith("cuda") or not torch.cuda.is_available():
        return "cpu", "generation runs on cpu"
    free_gib = torch.cuda.mem_get_info()[0] / 2**30
    if free_gib >= GPU_FREE_GIB_FOR_TEXT:
        return "cuda", f"{free_gib:.1f} GiB VRAM free"
    return "cpu", f"only {free_gib:.1f} GiB VRAM free (< {GPU_FREE_GIB_FOR_TEXT:.0f})"


def main():
    a = parse_args()
    if a.text_encoder is None:
        a.text_encoder = "local" if a.prompt.strip() else "none"
    if a.text_encoder == "none" and a.prompt.strip():
        sys.exit("--text needs --text-encoder local or url, not none")
    if a.frames is None and a.duration is None:
        sys.exit("give --duration or --frames")

    os.environ.setdefault("CHECKPOINT_DIR", MODELS_DIR)
    hub = route_hf_env()
    if a.text_encoder == "local":
        os.environ["TEXT_ENCODER_MODE"] = "local"
        check_text_encoder_cache(hub)
    elif a.text_encoder == "url":
        os.environ["TEXT_ENCODER_MODE"] = "api"

    import numpy as np
    import torch

    text_device, text_device_why = None, None
    if a.text_encoder == "local":
        text_device, text_device_why = pick_text_device(a.text_device, a.device, torch)
        os.environ["TEXT_ENCODER_DEVICE"] = text_device
        print(f"text encoder on {text_device} ({text_device_why})")
        if text_device == "cpu":
            try:
                import psutil

                avail = psutil.virtual_memory().available / 2**30
                if avail < 18:
                    print(f"warning: only {avail:.1f} GiB RAM available; the encoder needs ~16 GiB")
            except ImportError:
                pass

    from kimodo import load_model
    from kimodo.constraints import load_constraints_lst
    from kimodo.exports.bvh import save_motion_bvh
    from kimodo.exports.motion_io import save_kimodo_npz
    from kimodo.skeleton import SOMASkeleton30, global_rots_to_local_rots
    from kimodo.tools import seed_everything

    postprocess = not a.no_postprocess
    if postprocess:
        try:
            import motion_correction  # noqa: F401
        except ImportError:
            postprocess = False
            print("motion_correction not built: foot-skate cleanup skipped")

    torch.cuda.reset_peak_memory_stats() if torch.cuda.is_available() else None
    t0 = time.perf_counter()
    model = load_model(
        MODEL_NAME,
        device=a.device,
        default_family="Kimodo",
        text_encoder=NullTextEncoder() if a.text_encoder == "none" else None,
    )
    t_load = time.perf_counter() - t0

    fps = float(model.fps)
    n_frames = a.frames if a.frames is not None else int(round(a.duration * fps))
    if not 1 <= n_frames <= 300:
        sys.exit(f"frames must be 1..300 (10 s at 30 fps); got {n_frames}")

    if a.constraints:
        # A frame index past the clip end crashes on GPU as an opaque "device-side assert".
        raw = json.loads(Path(a.constraints).read_text(encoding="utf-8"))
        last = max((max(c["frame_indices"]) for c in raw if c.get("frame_indices")), default=-1)
        if last >= n_frames:
            sys.exit(f"constraints reach frame {last} but the clip has {n_frames} frames "
                     f"(use --frames {last + 1} or more)")
    constraints = load_constraints_lst(a.constraints, model.skeleton) if a.constraints else []
    seed_everything(a.seed)

    t1 = time.perf_counter()
    out = model(
        a.prompt,
        n_frames,
        num_denoising_steps=a.steps,
        constraint_lst=constraints,
        cfg_weight=list(a.cfg),
        cfg_type="separated",
        num_samples=a.samples,
        first_heading_angle=torch.tensor([a.heading] * a.samples),
        post_processing=postprocess,
        return_numpy=True,
    )
    t_gen = time.perf_counter() - t1
    peak = torch.cuda.max_memory_allocated() / 2**20 if torch.cuda.is_available() else 0.0

    skel = model.skeleton
    if isinstance(skel, SOMASkeleton30):
        skel = skel.somaskel77.to(a.device)  # output is already expanded to 77 joints

    stem = Path(a.out)
    stem.parent.mkdir(parents=True, exist_ok=True)
    n = int(out["posed_joints"].shape[0])
    written = []
    for i in range(n):
        tag = "" if n == 1 else f"_{i:02d}"
        one = {k: (v[i] if hasattr(v, "shape") and v.ndim > 0 and v.shape[0] == n else v) for k, v in out.items()}
        npz = stem.with_name(stem.name + tag + ".npz")
        save_kimodo_npz(str(npz), one)
        pos = torch.from_numpy(one["posed_joints"]).to(a.device)
        rot = torch.from_numpy(one["global_rot_mats"]).to(a.device)
        bvh = stem.with_name(stem.name + tag + ".bvh")
        save_motion_bvh(str(bvh), global_rots_to_local_rots(rot, skel), pos[:, skel.root_idx, :],
                        skeleton=skel, fps=fps, standard_tpose=a.tpose_rest)
        written += [str(npz), str(bvh)]

    # How closely each sample hits what we pinned: mean / max joint distance (cm) on the keyed
    # frames of fullbody + end-effector constraints, and hips-vs-path distance for root2d.
    names77 = list(skel.bone_order_names)
    names_c = list(model.skeleton.bone_order_names)
    map_c = torch.tensor([names77.index(n) for n in names_c])
    key_err, path_err = [], []
    PJ = torch.from_numpy(out["posed_joints"]).float()  # (S, T, 77, 3) or (T, 77, 3)
    if PJ.ndim == 3:
        PJ = PJ[None]
    for c in constraints:
        fi = c.frame_indices.long().cpu()
        if hasattr(c, "global_joints_positions"):
            tgt = c.global_joints_positions.float().cpu()  # (K, 30, 3)
            joints = getattr(c, "pos_indices", None)
            joints = joints.cpu() if joints is not None else torch.arange(tgt.shape[1])
            got = PJ[:, fi][:, :, map_c][:, :, joints]
            d = (got - tgt[None][:, :, joints]).norm(dim=-1) * 100
            key_err.append(d.reshape(d.shape[0], -1))
        elif hasattr(c, "smooth_root_2d"):
            got = PJ[:, fi][:, :, skel.root_idx][..., [0, 2]]
            d = (got - c.smooth_root_2d.float().cpu()[None]).norm(dim=-1) * 100
            path_err.append(d)
    cerr = {}
    if key_err:
        k = torch.cat(key_err, 1)
        cerr["keys_mean_max"] = [[round(float(x.mean()), 1), round(float(x.max()), 1)] for x in k]
    if path_err:
        p_ = torch.cat(path_err, 1)
        cerr["path_mean_max"] = [[round(float(x.mean()), 1), round(float(x.max()), 1)] for x in p_]

    report = {
        "constraint_error_cm": cerr,
        "model": MODEL_NAME,
        "model_revision": MODEL_REVISION,
        "checkpoint_dir": os.environ["CHECKPOINT_DIR"],
        "text_encoder": a.text_encoder,
        "text_encoder_device": text_device,
        "text_encoder_device_reason": text_device_why,
        "text_encoder_repos": TEXT_ENCODER_REPOS if a.text_encoder == "local" else None,
        "hf_hub_cache": hub,
        "prompt": a.prompt,
        "constraints": a.constraints,
        "constraint_types": [type(c).__name__ for c in constraints],
        "frames": n_frames,
        "fps": fps,
        "seed": a.seed,
        "steps": a.steps,
        "cfg_text_constraint": list(a.cfg),
        "heading_rad": a.heading,
        "postprocess": postprocess,
        "bvh_rest": "standard_tpose" if a.tpose_rest else "seed_rest",
        "samples": n,
        "seconds_load": round(t_load, 2),
        "seconds_generate": round(t_gen, 2),
        "peak_vram_mib_torch": round(peak, 1),
        "gpu": torch.cuda.get_device_name(0) if torch.cuda.is_available() else None,
        "torch": torch.__version__,
        "files": written,
        "joint_names": list(skel.bone_order_names),
    }
    stem.with_name(stem.name + ".json").write_text(json.dumps(report, indent=1), encoding="utf-8")
    print("KIMODO_GEN " + json.dumps({k: v for k, v in report.items() if k != "joint_names"}))


if __name__ == "__main__":
    main()

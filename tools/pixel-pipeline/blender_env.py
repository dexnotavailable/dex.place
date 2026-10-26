"""Isolated, headless Blender for the dex.place character pipeline.

Dex's own Blender preferences and add-ons (including the generative ones: stablegen,
higgsfield, meshy) must never load in this pipeline, and nothing here may write to his
%APPDATA% Blender folders. Every run goes through this file (directly, or via the
blender.ps1 / blender.sh shims next to it).

Isolation detail that matters: when a BLENDER_USER_* override points at a folder that does
not exist, Blender silently falls back to the default %APPDATA% folder (measured on 5.1.2:
Dex's userpref.blend and his scripts/addons loaded). So every folder is created before launch,
and BLENDER_USER_RESOURCES points at the same root as a second guard.

usage:
  python blender_env.py run [blender args...]   headless Blender in the isolated env
                                                 (-b always; --offline-mode and
                                                 --disable-autoexec unless overridden)
  python blender_env.py setup                    download the pinned extensions (sha256
                                                 checked) and install+enable them
  python blender_env.py check                    print and assert the isolation state

Environment overrides: DEXPLACE_BLENDER_ROOT, DEXPLACE_BLENDER_EXE,
DEXPLACE_DOWNLOADS (where extension zips are cached).
"""
import hashlib
import json
import os
import subprocess
import sys
import urllib.request

ROOT = os.environ.get("DEXPLACE_BLENDER_ROOT", r"D:\Dex\Tools\blender-dexplace")
BLENDER = os.environ.get(
    "DEXPLACE_BLENDER_EXE", r"C:\Program Files\Blender Foundation\Blender 5.1\blender.exe")
DOWNLOADS = os.environ.get(
    "DEXPLACE_DOWNLOADS", r"D:\Dex\Inbox\Downloads\dexplace-character")
EXPECTED_VERSION = "5.1.2"

USER_DIRS = {
    "BLENDER_USER_CONFIG": "config",
    "BLENDER_USER_SCRIPTS": "scripts",
    "BLENDER_USER_EXTENSIONS": "extensions",
    "BLENDER_USER_DATAFILES": "datafiles",
}

# Pinned extensions (extensions.blender.org API, 2026-09-28). Only these get installed.
EXTENSIONS = [
    {
        "id": "vrm",
        "version": "4.7.2",
        "url": "https://extensions.blender.org/download/sha256:e85588660bfbb4099910a86803fa87dc8348e65541a4ccdcaf40c538f60027dc/add-on-vrm-v4.7.2.zip",
        "sha256": "e85588660bfbb4099910a86803fa87dc8348e65541a4ccdcaf40c538f60027dc",
        "size": 1643935,
    },
    {
        # KBS-DEV fork of Expy Kit + AnimAide; bone-map presets for Unreal Mannequin (the UAL
        # rig), VRoid, Rigify metarig (Seed-san), Mixamo and MMD. GPL-3.0-or-later.
        "id": "retarget",
        "version": "5.2.0",
        "url": "https://extensions.blender.org/download/sha256:521ec8ff5c2373893ea8022b3f71d27ed191fb73f3a5634cac31585e0dcb7af3/add-on-retarget-v5.2.0.zip",
        "sha256": "521ec8ff5c2373893ea8022b3f71d27ed191fb73f3a5634cac31585e0dcb7af3",
        "size": 225631,
    },
]
# Considered, not installed: MMD Tools 4.5.14 (GPL-3.0-or-later, 803,729 B,
# sha256 ed3b78184ae9862be0df04e2e147803d011ad067edd8c31029c92fb719e19a6f). Only needed for
# VMD/PMX sources, and none are in the current batch. Add it here if that changes.

# Substrings of module names that must never be loaded in this environment.
FORBIDDEN = ("stablegen", "higgsfield", "meshy", "blender_mcp", "retopoflow", "ucupaint")


def isolated_env():
    env = dict(os.environ)
    for key in list(env):
        # system-level overrides could inject scripts/extensions from elsewhere
        if key.startswith("BLENDER_SYSTEM_") or key.startswith("BLENDER_USER_"):
            env.pop(key)
    os.makedirs(ROOT, exist_ok=True)
    env["BLENDER_USER_RESOURCES"] = ROOT
    for key, sub in USER_DIRS.items():
        path = os.path.join(ROOT, sub)
        os.makedirs(path, exist_ok=True)
        env[key] = path
    os.makedirs(os.path.join(ROOT, "extensions", "user_default"), exist_ok=True)
    return env


def blender_cmd(args):
    args = list(args)
    head = [BLENDER]
    if "-b" not in args and "--background" not in args:
        head.append("-b")
    if "--online-mode" not in args and "--offline-mode" not in args:
        head.append("--offline-mode")
    if not any(a in ("-y", "--enable-autoexec", "-Y", "--disable-autoexec") for a in args):
        head.append("--disable-autoexec")  # third-party .blend files never run embedded scripts
    if any(a in ("--python", "-P", "--python-expr") for a in args) and "--python-exit-code" not in args:
        head += ["--python-exit-code", "1"]
    # -c/--command consumes the rest of the line, so our flags must come first
    return head + args


def run(args, **kw):
    if not os.path.isfile(BLENDER):
        sys.exit(f"blender not found: {BLENDER}")
    return subprocess.run(blender_cmd(args), env=isolated_env(), **kw)


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def fetch(url, dest, sha256):
    if os.path.isfile(dest) and sha256_file(dest) == sha256:
        return dest
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    tmp = dest + ".part"
    req = urllib.request.Request(url, headers={"User-Agent": "dexplace-pixel-pipeline"})
    with urllib.request.urlopen(req) as r, open(tmp, "wb") as f:
        while True:
            chunk = r.read(1 << 20)
            if not chunk:
                break
            f.write(chunk)
    got = sha256_file(tmp)
    if got != sha256:
        os.remove(tmp)
        sys.exit(f"sha256 mismatch for {url}: {got}")
    os.replace(tmp, dest)
    return dest


CHECK_EXPR = r"""
import bpy, sys, json, addon_utils
prefs = bpy.context.preferences
info = {
    "version": bpy.app.version_string,
    "config": bpy.utils.user_resource('CONFIG'),
    "scripts": bpy.utils.user_resource('SCRIPTS'),
    "extensions": bpy.utils.user_resource('EXTENSIONS'),
    "script_paths": bpy.utils.script_paths(),
    "repos": [[r.module, r.directory, r.enabled] for r in prefs.extensions.repos],
    "enabled_addons": sorted(a.module for a in prefs.addons),
    "loaded_modules": sorted({n.split(".")[0] if not n.startswith("bl_ext.") else ".".join(n.split(".")[:3])
                              for n, m in list(sys.modules.items())
                              if any(k in (getattr(m, "__file__", None) or "").replace("\\", "/").lower()
                                     for k in ("/addons", "/extensions/"))}),
    "vrm_import_op": "vrm" in dir(bpy.ops.import_scene),
}
print("DEXPLACE_CHECK " + json.dumps(info))
"""


def check():
    r = run(["--python-expr", CHECK_EXPR], capture_output=True, text=True, encoding="utf-8",
            errors="replace")
    line = next((l for l in r.stdout.splitlines() if l.startswith("DEXPLACE_CHECK ")), None)
    if not line:
        print(r.stdout, r.stderr)
        sys.exit("check failed: no report from Blender")
    info = json.loads(line[len("DEXPLACE_CHECK "):])
    appdata = os.path.normcase(os.environ.get("APPDATA", "C:\\Users"))
    problems = []
    if info["version"] != EXPECTED_VERSION:
        problems.append(f"blender version {info['version']} != {EXPECTED_VERSION}")
    for key in ("config", "scripts", "extensions"):
        if not os.path.normcase(os.path.abspath(info[key])).startswith(os.path.normcase(ROOT)):
            problems.append(f"{key} dir outside isolated root: {info[key]}")
    for p in info["script_paths"]:
        if os.path.normcase(os.path.abspath(p)).startswith(appdata):
            problems.append(f"script path from Dex's profile: {p}")
    for m in info["loaded_modules"] + info["enabled_addons"]:
        if any(bad in m.lower() for bad in FORBIDDEN):
            problems.append(f"forbidden module loaded: {m}")
    noise = [l for l in (r.stdout + r.stderr).splitlines()
             if any(bad in l.lower() for bad in FORBIDDEN + ("amplitude",))]
    problems += [f"forbidden add-on output: {l}" for l in noise]
    print(json.dumps(info, indent=1))
    if problems:
        print("\n".join("PROBLEM: " + p for p in problems))
        sys.exit(1)
    print("isolation OK")
    return info


def setup():
    isolated_env()
    for ext in EXTENSIONS:
        name = os.path.basename(ext["url"])
        path = fetch(ext["url"], os.path.join(DOWNLOADS, "blender-extensions", name), ext["sha256"])
        r = run(["-c", "extension", "install-file", "-r", "user_default", "--enable", path])
        if r.returncode:
            sys.exit(f"install failed for {name} (exit {r.returncode})")
    info = check()
    enabled = set(info["enabled_addons"])
    missing = [e["id"] for e in EXTENSIONS if f"bl_ext.user_default.{e['id']}" not in enabled]
    if missing:
        sys.exit(f"not enabled after install: {missing}")
    print("setup OK:", ", ".join(f"{e['id']} {e['version']}" for e in EXTENSIONS))


def main():
    if len(sys.argv) < 2 or sys.argv[1] not in ("run", "setup", "check"):
        sys.exit(__doc__)
    cmd, rest = sys.argv[1], sys.argv[2:]
    if cmd == "run":
        sys.exit(run(rest).returncode)
    if cmd == "setup":
        setup()
    else:
        check()


if __name__ == "__main__":
    main()

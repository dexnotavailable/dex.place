"""Source-only submission; delivery executes later after independent review.

Use actual925 Cuff2/H1 preparation. Stop before the first144 image, never
rerender/post/bake/save. A private JSON diagnostic is not an art acceptance.
"""
import argparse
import hashlib
import importlib
import json
import subprocess
import sys
import traceback
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[3]
PIPE = REPO/"tools/pixel-pipeline"
C2 = REPO/"art/rosace/integration/cuff2"
_bootstrap_path=sys.path[:]
try:
    sys.path.insert(0,str(HERE))
    from probe_math import check_shot
finally:
    sys.path[:]=_bootstrap_path


class DiagnosticStop(Exception):
    pass


class OpsGuard:
    def __init__(self, original):
        self.original,self.attempts = original,[]

    def __getattr__(self, namespace):
        owner = self
        original = getattr(self.original,namespace)
        class Namespace:
            def __getattr__(self, name):
                forbidden = (namespace=="render" and name in ("render","opengl")) or name.startswith("save") or "bake" in name or name=="screenshot"
                if forbidden:
                    def refuse(*args,**kwargs):
                        owner.attempts.append(namespace+"."+name)
                        raise RuntimeError("zero-image probe forbids "+namespace+"."+name)
                    return refuse
                return getattr(original,name)
        return Namespace()


def verify_bindings(binding):
    for name,digest in binding["sourceHashes"].items():
        if hashlib.sha256((REPO/name).read_bytes()).hexdigest()!=digest:
            raise ValueError("frozen925 source differs: "+name)
    for row in binding["inputs"]:
        if hashlib.sha256(Path(row["path"]).read_bytes()).hexdigest()!=row["sha256"]:
            raise ValueError("frozen input differs: "+row["role"])
    if json.loads(Path(binding["shapePath"]).read_text())["current"]!="S7":
        raise ValueError("frozen S7 source identity differs")


def frozen_frame(binding, c1):
    import numpy as np
    from PIL import Image
    root = Path(binding["originalRawRoot"])/"cuff2/idle/px144"
    visibility=c1.visible_hand(root)
    finding=json.loads(Path(next(row["path"] for row in binding["inputs"] if row["role"]=="root-visibility-finding")).read_text())
    expected=next(row["cuff2"] for row in finding["rows"] if row["px"]==144)
    if visibility!=expected:
        raise ValueError("frozen144 categorical visibility differs from root finding")
    return {"meta":json.loads((root/"meta.json").read_text()),
            "trial":json.loads((root/"cuff2_trial.json").read_text()),
            "id":np.asarray(Image.open(root/"id.png").convert("RGBA")),
            "depth2":np.asarray(Image.open(root/"depth2.png").convert("RGBA")),
            "native_visibility":visibility}


def execute(T,H,R,C,bpy,argv,frozen,capture,snapshot_factory):
    """Injection is for CPU fixtures; the native entry supplies actual modules."""
    prior_path,prior_argv = sys.path[:],sys.argv
    hooks,state = [],{"passCalls":0,"geometryCalls":0,"shotCalls":0}
    guard = OpsGuard(bpy.ops)
    stop = DiagnosticStop("first144 diagnostic captured")
    snapshots = []

    def remember(obj,key):
        if not any(owner is obj and name==key for owner,name,_ in hooks):
            hooks.append((obj,key,getattr(obj,key)))
        return getattr(obj,key)

    original_library = remember(H,"library")
    original_install = remember(C,"install")
    remember(bpy,"ops")

    def install(enabled):
        if enabled is not True or state["geometryCalls"]:
            raise ValueError("one actual enabled C2 installation required")
        state["geometryCalls"]+=1
        handle,geometry = original_install(enabled)
        state.update(handle=handle,geometry=geometry)
        if handle:
            state["copyName"]=handle[2].name
        return handle,geometry

    def library(path,name):
        driver=original_library(path,name)
        if path.resolve()!=(PIPE/"drive9/d9_blender.py").resolve():
            return driver
        for obj,key in ((driver.figure_pose,"apply_pose"),(driver.posing,"apply_pose"),
                        (driver.posing,"grip_hand"),(driver.posing,"hand_rest"),
                        (driver.head_scale,"install"),(driver,"f1_module"),(driver,"PASSES")):
            remember(obj,key)
        setup = remember(driver.render,"setup_shot")
        remember(driver.render,"render_passes")
        def shot(scene,px,**kwargs):
            if state["shotCalls"] or px!=144:
                raise ValueError("only first144 scene may be prepared")
            state["shotCalls"]+=1
            snapshots.append(snapshot_factory(scene,driver,bpy))
            actual=setup(scene,px,**kwargs)
            check_shot(actual,frozen["meta"])
            state["shot"]=actual
            return actual
        def first_pass(scene,directory,passes,frames=None):
            state["passCalls"]+=1
            if state["passCalls"]!=1 or state["geometryCalls"]!=1 or frames is not None or "depth2" not in passes or bpy.ops is not guard:
                raise ValueError("unexpected first render boundary")
            state["diagnostic"] = capture(scene,state["shot"],driver,bpy,frozen,state["geometry"])
            raise stop
        driver.render.setup_shot,driver.render.render_passes = shot,first_pass
        return driver

    H.library,C.install,bpy.ops = library,install,guard
    caught = False
    try:
        try:
            T.main(argv,hands=H,recipe=R,adapter=C,bpy_module=bpy)
        except DiagnosticStop as error:
            if error is not stop or "diagnostic" not in state:
                raise
            caught=True
        if not caught:
            raise RuntimeError("expected zero-image diagnostic boundary was not reached")
    finally:
        cleanup_errors=[]
        for snapshot in reversed(snapshots):
            try:
                snapshot.restore()
            except BaseException as error:
                cleanup_errors.append(str(error))
        for obj,key,original in reversed(hooks):
            try:
                setattr(obj,key,original)
            except BaseException as error:
                cleanup_errors.append(str(error))
        sys.path[:],sys.argv = prior_path,prior_argv
        if cleanup_errors:
            raise RuntimeError("probe cleanup failed: "+"; ".join(cleanup_errors))
    if guard.attempts or any(getattr(obj,key) is not original for obj,key,original in hooks):
        raise RuntimeError("forbidden operation attempted or exact hook restoration failed")
    handle=state.get("handle")
    if handle and (handle[0].data is not handle[1] or bpy.data.meshes.get(state["copyName"]) is not None):
        raise RuntimeError("C2 copied-mesh restoration/removal incomplete")
    return dict(state["diagnostic"],nativeRenderedImages=0,renderSaveBakeCalls=0,
                firstCamera144Only=True,exactHookAndCopiedMeshCleanup=True,
                forbiddenAttempts=guard.attempts)


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--out",type=Path,required=True)
    args=parser.parse_args()
    output=args.out.resolve()
    allowed=(REPO/"review/rosace/integration/hand_visibility_probe").resolve()
    if allowed not in output.parents or output.exists():
        raise ValueError("fresh private executing-worktree diagnostic output required")
    entry=REPO/"review/rosace/integration/cuff2/hand_visibility_probe-zero-image-20260930"
    if entry.exists():
        raise ValueError("fresh existing-C2-guard-compatible private entry output required")
    binding=json.loads((HERE/"input-bindings.json").read_text())
    report={"schema":"rosace.hand-visibility-probe/1","status":"failed","nativeRenderedImages":0,
            "renderSource":binding["renderSource"],"inputBindingsSha256":hashlib.sha256((HERE/"input-bindings.json").read_bytes()).hexdigest(),
            "probeSourceHead":subprocess.check_output(["git","-C",str(REPO),"rev-parse","HEAD"],text=True).strip(),
            "probeCodeHashes":{path.name:hashlib.sha256(path.read_bytes()).hexdigest() for path in sorted(HERE.glob("*.py"))},
            "causeEstablished":False,"appearanceAccepted":False}
    prior_path=sys.path[:]
    failure=None
    try:
        verify_bindings(binding)
        sys.path[:0]=[str(HERE),str(C2),str(PIPE/"next")]
        T,H,R,C=(importlib.import_module(name) for name in ("cuff2_trial","nx_hands_blender","reconstruction_recipe","cuff2_blender"))
        for component,relative in ((T,"art/rosace/integration/cuff2/cuff2_trial.py"),(H,"tools/pixel-pipeline/next/nx_hands_blender.py"),
                                   (R,"tools/pixel-pipeline/next/reconstruction_recipe.py"),(C,"art/rosace/integration/cuff2/cuff2_blender.py")):
            if Path(component.__file__).resolve()!=(REPO/relative).resolve():
                raise ValueError("unexpected cached preparation module: "+relative)
        c1=importlib.import_module("_reuse").load("cuff_native_post")
        frozen=frozen_frame(binding,c1)
        import bpy
        from probe_native import capture
        from probe_shot import ShotSnapshot
        argv=["--cuff-mode","cuff2","--hand-scale","1.3","--shots","idle","--px","144,80","--ss","4","--head","1.10",
              "--blend",binding["blendPath"],"--r2",str(PIPE/"drive9/r2_model.json"),"--out",str(entry)]
        result=execute(T,H,R,C,bpy,argv,frozen,capture,ShotSnapshot)
        if any(path.is_file() for path in entry.rglob("*")):
            raise RuntimeError("zero-image entry unexpectedly wrote a pipeline file")
        report.update(result,status="diagnostic-captured; cause remains for independent interpretation")
    except BaseException as error:
        failure=error
        report.update(errorType=type(error).__name__,error=str(error)[:2000],trace=traceback.format_exc(limit=8)[-6000:])
    finally:
        sys.path[:]=prior_path
        try:
            verify_bindings(binding)
            report["frozenInputsUnchanged"]=True
            if subprocess.check_output(["git","-C",str(REPO),"rev-parse","HEAD"],text=True).strip()!=report["probeSourceHead"]:
                raise ValueError("probe source HEAD changed during diagnostic")
        except BaseException as error:
            failure=error
            report.update(status="failed",frozenInputsUnchanged=False,error=str(error)[:2000])
        try:
            text=json.dumps(report,indent=2,allow_nan=False)
        except (ValueError,TypeError) as error:
            failure=error
            report={"status":"failed","nativeRenderedImages":0,"error":"nonserializable/nonfinite diagnostic: "+str(error)[:2000]}
            text=json.dumps(report)
        if len(text.encode())>8*1024*1024:
            failure=RuntimeError("bounded diagnostic JSON size exceeded")
            report={"status":"failed","nativeRenderedImages":0,"error":str(failure)}
            text=json.dumps(report)
        output.mkdir(parents=True)
        (output/"diagnostic.json").write_text(text,encoding="utf-8",newline="\n")
    print(json.dumps({"diagnostic":str(output/"diagnostic.json"),"nativeRenderedImages":0,"status":report["status"]}))
    if failure:
        raise SystemExit(1)


if __name__=="__main__":
    main()

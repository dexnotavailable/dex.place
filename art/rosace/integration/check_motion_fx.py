"""Meaningful clock/channel/scene/playback corruption fixtures; no native render."""
import copy
import json
import sys
import tempfile
from pathlib import Path
from types import SimpleNamespace
from PIL import Image

HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
import motion_fx_contract as C
import native_motion_channels as channels
import n1_n2_post as post
sys.path.insert(0,str(C.REPO/"art/rosace/specialists/motion"))
import author_sequence as A

root=C.REPO/"review/rosace/integration"
root.mkdir(parents=True,exist_ok=True)
with tempfile.TemporaryDirectory(dir=root) as temporary:
    work=Path(temporary)
    packet=A.export(C.REPO/"art/rosace/specialists/attacks/n1-n2.json",work/"ticks.json")
    plain,contact=C.playback(packet),C.playback(packet,True)
    assert plain["durationTicks"]==77 and contact["durationTicks"]==83
    for f in (9,23):
        rows=[r for r in contact["ticks"] if r["simulationFrame"]==f]
        assert len(rows)==4 and [r["frozen"] for r in rows]==[False,True,True,True]
        assert sum(r["emitContact"] for r in rows)==1 and {r["fxTick"] for r in rows}=={f}
    assert [r["simulationFrame"] for r in contact["ticks"] if not r["frozen"]]==list(range(1,78))
    bad=copy.deepcopy(packet);bad["ticks"][15]["rootForwardH"]+=.01
    try: C.validate_ticks(bad)
    except ValueError: pass
    else: raise AssertionError("seam root corruption accepted")
    try: C.validate_binding({"contract":"rosace.motion-body/1","state":"pending"})
    except ValueError: pass
    else: raise AssertionError("unrendered body accepted")
    parts=[({"Head":{"scale":[1.1]*3,"location":[.1,0,0]}},.25),
           ({"Head":{"scale":[1.3]*3,"location":[.3,0,0]}},.75)]
    mixed=channels.mix_channels(parts)
    assert all(abs(v-1.25)<1e-9 for v in mixed["Head"]["scale"])
    assert abs(mixed["Head"]["location"][0]-.25)<1e-9
    # Call the actual temporary bridge and ensure both success/error restore hooks.
    for fail in (False,True):
        bone=SimpleNamespace(scale=[1.1]*3,location=[.05,0,0])
        arm=SimpleNamespace(pose=SimpleNamespace(bones={"Head":bone}))
        def old_set(a,order,state):
            assert list(a.pose.bones["Head"].scale)==[1.1]*3
            assert list(a.pose.bones["Head"].location)==[.05,0,0]
        HL=SimpleNamespace(capture=lambda *args:{},state_mix=lambda *args:{},set_state=old_set)
        posing=SimpleNamespace(grip_hand=lambda *args:None,hand_rest=lambda *args:None,update=lambda:None)
        measure=SimpleNamespace(measure=lambda *args:{})
        originals=(HL.capture,HL.state_mix,HL.set_state,posing.grip_hand,posing.hand_rest,measure.measure)
        try:
            with channels.bridge(HL,posing,measure,arm,1.3):
                st=HL.capture(arm,["Head"],{})
                bone.scale=[1]*3;bone.location=[0]*3
                HL.set_state(arm,["Head"],st)
                if fail: raise RuntimeError("fixture exception")
        except RuntimeError:
            assert fail
        assert originals==(HL.capture,HL.state_mix,HL.set_state,posing.grip_hand,posing.hand_rest,measure.measure)
    metas=[{"ss":4,"px":80,"anchor":[240,280],"anchors":{"root":[960,1120,12],
        "glaive_tip":[1280,880,11],"depth_plane":[960,900,12]},
        "nativeIdentity":{"simulationFrame":f,"evidence":"synthetic source fixture"}} for f in range(1,78)]
    whiff,hit=post.scenes(packet,metas,False),post.scenes(packet,metas,True)
    assert [s["simulationFrame"] for s in hit if s["contact"]]==[9,23]
    assert not any(s["contact"] or s["pane_anchors"] for s in whiff)
    assert len([c for s in hit for c in s["cues"] if c.get("id","").startswith("glass.chime")])==2
    assert all(s["tipDepthLayer"]=="front" for s in hit)
    paths={}
    for f in range(1,78):
        p=work/f"f{f}.png"
        Image.new("RGBA",(8,8),(f if f%3==0 else f-f%3,20,40,255)).save(p)
        paths[f]=p
    replay=post.encode_preview(paths,contact,work/"contact.png")
    assert replay["durationMs"]==1383 and replay["durationTicks"]==83
print(json.dumps({"sourceChecks":"pass","clock":"77/83ticks; whole-simulation holds reuse epochs/events",
    "channels":"scale/location capture, blend, solve-order and restoration exercised",
    "FX":"simulation-clock contact/whiff and native-depth interface exercised with labelled synthetic data",
    "preview":"lossless APNG complete pixel and delay readback;1383ms contact schedule",
    "nativeExecuted":False,"currentBodyBinding":"pending actual construction result"}))

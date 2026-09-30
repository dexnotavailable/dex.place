"""Temporary complete body-channel bridge around the exact motion producer."""
import contextlib
import copy
import math


def mix_channels(parts):
    total=sum(w for _,w in parts)
    if not math.isfinite(total) or total<=0 or any(w<0 for _,w in parts):
        raise ValueError("positive finite construction blend required")
    names=set(parts[0][0])
    if any(set(channels)!=names for channels,_ in parts):
        raise ValueError("body channel names differ between sources")
    return {n:{k:[sum(c[n][k][i]*w for c,w in parts)/total for i in range(3)]
               for k in ("scale","location")} for n in names}


@contextlib.contextmanager
def bridge(HL, posing, rig_measure, arm, hand_scale):
    old_capture,old_mix,old_set=HL.capture,HL.state_mix,HL.set_state
    old_grip,old_rest,old_measure=posing.grip_hand,posing.hand_rest,rig_measure.measure
    expected=[]
    def capture(a,order,info):
        st=old_capture(a,order,info)
        st["constructionChannels"]={n:{"scale":list(a.pose.bones[n].scale),
            "location":list(a.pose.bones[n].location)} for n in order}
        return st
    def state_mix(parts):
        st=old_mix(parts)
        st["constructionChannels"]=mix_channels([(s["constructionChannels"],w) for s,w in parts])
        return st
    def set_state(a,order,st,*args,**kwargs):
        for n,channels in st["constructionChannels"].items():
            a.pose.bones[n].scale=channels["scale"]
            if n!="J_Bip_C_Hips": a.pose.bones[n].location=channels["location"]
        posing.update()
        return old_set(a,order,st,*args,**kwargs)
    def grip(a,side,socket,thumb="tip",back=None,slide=0.0):
        # Exact H1 scaled rest grip center; do not offset the weapon to hide a gap.
        if any(abs(a.matrix_world[i][j]-(1 if i==j else 0))>1e-6 for i in range(4) for j in range(4)):
            raise ValueError("scaled grip requires canonical identity armature")
        ancestor=a.pose.bones[f"J_Bip_{side}_Hand"].parent
        while ancestor:
            if any(abs(v-1)>1e-3 for v in ancestor.matrix.to_scale()):
                raise ValueError("scaled hand grip requires unit ancestors")
            ancestor=ancestor.parent
        def rest(obj,s):
            matrix,head,forward,palm,point=old_rest(obj,s)
            return matrix,head,forward,palm,head+(point-head)*hand_scale if s==side else point
        posing.hand_rest=rest
        try: return old_grip(a,side,socket,thumb,back,slide)
        finally: posing.hand_rest=old_rest
    def measure(a,*args,**kwargs):
        result=old_measure(a,*args,**kwargs)
        expected.append({b.name:b.matrix.copy() for b in a.pose.bones})
        return result
    HL.capture,HL.state_mix,HL.set_state=capture,state_mix,set_state
    posing.grip_hand,rig_measure.measure=grip,measure
    try: yield expected
    finally:
        HL.capture,HL.state_mix,HL.set_state=old_capture,old_mix,old_set
        posing.grip_hand,posing.hand_rest,rig_measure.measure=old_grip,old_rest,old_measure


def verify_keyed(scene,arm,expected,posing):
    if len(expected)!=78: raise ValueError("full pre-key native snapshots missing")
    rows=[]
    for f,matrices in enumerate(expected):
        scene.frame_set(f)
        posing.update()
        error=max(abs(x-y) for n,m in matrices.items()
            for a,b in zip(m,arm.pose.bones[n].matrix) for x,y in zip(a,b))
        if not math.isfinite(error) or error>1e-6:
            raise ValueError(f"post-key evaluated body matrices differ at{f}: {error}")
        rows.append({"frame":f,"matrixMaxAbs":error,
            "headScale":list(arm.pose.bones["J_Bip_C_Head"].scale),
            "neckScale":list(arm.pose.bones["J_Bip_C_Neck"].scale)})
    scene.frame_set(0)
    posing.update()
    return {"status":"exact evaluated action matches pre-key solve", "frames":rows,"tolerance":1e-6}

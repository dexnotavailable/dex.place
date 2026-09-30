"""Four matched idle stills through the unchanged closed R2/native driver."""
import copy
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[3]
PIPE = REPO / 'tools/pixel-pipeline'
_path = sys.path[:]
try:
    sys.path.insert(0, str(HERE)); sys.path.insert(0, str(PIPE / 'next'))
    import nx_hands_blender as H
    import fh1_native as C
    import fh1_inputs as INPUTS
    import fh1_binding as BINDING
finally:
    sys.path[:] = _path


def arguments(argv=None):
    if argv is not None: return list(argv)
    raw = sys.argv[1:]
    if '--' in raw: return raw[raw.index('--')+1:]
    if any(v in raw for v in ('--python', '--factory-startup', '--python-exit-code')):
        raise ValueError('Blender script arguments require actual -- separator')
    return raw


def main(argv=None):
    argv = arguments(argv)
    mode = H.argument(argv, '--fh1-mode')
    if mode not in ('control', 'FH1') or H.argument(argv, '--hand-scale') != '1.0' or H.argument(argv, '--shots') != 'idle':
        raise ValueError('explicit control/FH1, hand1.0 and idle-only batch required')
    output = Path(H.argument(argv, '--out')).resolve()
    if (REPO / 'review/rosace/integration/fh1_head').resolve() not in output.parents or output.exists():
        raise ValueError('fresh executing-worktree private FH1 output required')
    binding = dict(INPUTS.verify(), **BINDING.verify())
    original_library = H.library; original_argv = sys.argv; original_path = sys.path[:]
    state = {}; faces = []

    def library(path, name):
        module = original_library(path, name)
        if path.resolve() != (PIPE / 'drive9/d9_blender.py').resolve(): return module
        previous = (module.head_scale.install, module.posing.anchors, module.posing.apply_pose, module.f1_module)
        state['restore'] = (module, previous)
        state['outerHooks']=(module.PASSES,module.figure_pose.apply_pose,module.posing.grip_hand,module.posing.hand_rest)
        prior_install, prior_anchors, prior_apply, prior_f1 = previous

        def install(cfg):
            result = prior_install(cfg)
            state['candidate'] = C.install(mode == 'FH1', output / 'fh1-install.json')
            return result

        def anchors(scene, px):
            result = prior_anchors(scene, px)
            if mode == 'control': return result
            original = {s: copy.deepcopy(result[f'eye_{s}']) for s in 'LR'}
            place = C.placement(state['candidate'], scene)
            for side in 'LR': result[f'eye_{side}'] = place['eyes'][side] + [original[side][3]]
            result['fh1_rig_eye_anchors'] = original; result['fh1_eye_placement'] = place['eyes']
            result['fh1_anchor_role'] = 'original field geometry placement only; actual eye bones/pose/facing unchanged'
            return result

        def f1():
            component = prior_f1(); prior_face = component.facepass
            faces.append((component, prior_face))
            def face(scene, meta, directory):
                prior_face(scene, meta, directory)
                candidate = state['candidate']
                if mode == 'FH1':
                    fp_path = Path(directory, 'facepass.json'); fp = json.loads(fp_path.read_text(encoding='utf-8'))
                    place = C.placement(candidate, scene)
                    fp['fh1_source_heuristic_nose_chin'] = {k: fp[k] for k in ('nose', 'chin')}
                    for k in ('nose', 'chin'):
                        fp[k] = [round(v/meta['ss'],3) if i<2 else round(v,4) for i,v in enumerate(place[k])]
                    fp['fh1_eye_placement'] = {s: [round(v/meta['ss'],3) if i<2 else round(v,4) for i,v in enumerate(p)] for s,p in place['eyes'].items()}
                    fp['fh1_landmark_role'] = 'original semantic vertex IDs projected from native evaluated candidate; original actual eye bones retained'
                    fp_path.write_bytes((json.dumps(fp, indent=2)+'\n').encode('utf-8'))
                import bpy
                rig = bpy.data.objects['rosace_rig']
                record = {'mode': mode, 'geometry': candidate['report'], 'px': meta['px'], 'sourceInputBinding': binding,
                          'evaluatedBoneMatrices': {b.name: [list(r) for r in b.matrix] for b in rig.pose.bones},
                          'headMetrics': C.P.plain(rig['head_metrics']), 'finish': 'exact unchanged R2 ramps/stamps/expressions',
                          'cuffC1Included': False, 'bodyPoseChanged': False, 'eyeRigChanged': False, 'W2OrReconstructionIncluded': False,
                          'limits': '144 orbital/cheek/jaw and80 feature separation/fringe clearance require actual pixels; encoded preservation proves no unchanged decoded shading or art9'}
                Path(directory, 'fh1-trial.json').write_bytes((json.dumps(record, indent=2, allow_nan=False)+'\n').encode('utf-8'))
            component.facepass = face
            return component
        module.head_scale.install, module.posing.anchors, module.f1_module = install, anchors, f1
        return module

    H.library = library
    try:
        sys.argv = [str(__file__), '--', *argv]
        H.main()
    finally:
        H.library = original_library
        for component, prior_face in reversed(faces): component.facepass = prior_face
        if 'restore' in state:
            module, previous = state['restore']
            module.head_scale.install, module.posing.anchors, module.posing.apply_pose, module.f1_module = previous
            module.PASSES,module.figure_pose.apply_pose,module.posing.grip_hand,module.posing.hand_rest=state['outerHooks']
        try:
            C.restore(state.get('candidate'))
        finally:
            sys.argv = original_argv; sys.path[:] = original_path
            checks={'library':H.library is original_library,'sysArgv':sys.argv is original_argv,'sysPath':sys.path==original_path,
                    'facepass':all(component.facepass is prior for component,prior in faces)}
            if 'restore' in state:
                module,previous=state['restore']
                checks.update(install=module.head_scale.install is previous[0],anchors=module.posing.anchors is previous[1],applyPose=module.posing.apply_pose is previous[2],f1=module.f1_module is previous[3])
                outer=state['outerHooks']
                checks.update(passes=module.PASSES is outer[0],figureApply=module.figure_pose.apply_pose is outer[1],grip=module.posing.grip_hand is outer[2],handRest=module.posing.hand_rest is outer[3])
            candidate=state.get('candidate')
            C.write(output/'fh1-cleanup.json',{'mode':mode,'hooksRestoredExact':all(checks.values()),'restorations':checks,
                    'candidateReturned':candidate is not None,'ownedCleanup':candidate.get('cleanup') if candidate else None,
                    'limits':'failed install retains its own partial-install cleanup diagnostic; no actual data or art inferred from missing returned state'})
            if not all(checks.values()): raise AssertionError('FH1 actual wrapper hook/argv/path identity restoration failed')


if __name__ == '__main__': main()

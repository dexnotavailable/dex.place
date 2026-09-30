"""Exercise FC1 main's real hook/finally lifecycle without native execution.

A fake driver owns the same shared hook topology as d9/head_scale, including
an already nested caller function. Mesh/render calls are bounded injected
events; they prove restoration only, never Blender or rendered anatomy.
"""
import json
import sys
import types
import unittest
from unittest.mock import patch

import facecage_trial as T


class CleanupGuards(unittest.TestCase):
    def run_case(self,mode,failure):
        token = object()
        def nested_caller(pose):
            return token,pose
        def caller_anchors(*args):
            return token
        def caller_f1():
            return token
        posing = types.SimpleNamespace(apply_pose=nested_caller,anchors=caller_anchors)
        install_calls,cleanup_calls = [],[]
        def caller_install(cfg):
            install_calls.append(cfg)
            def installed_head_pose(pose):
                return "headscale",pose
            posing.apply_pose = installed_head_pose
            if failure=="installer":
                raise RuntimeError("installer exception after changing shared apply_pose")
            return token
        module = types.SimpleNamespace(posing=posing,
            head_scale=types.SimpleNamespace(install=caller_install),f1_module=caller_f1)
        def caller_library(path,name):
            return module
        def cage_install(enabled):
            self.assertEqual(enabled,mode=="facecage1")
            if failure=="cage":
                raise RuntimeError("cage constructor exception")
            return {"handles":[],"report":{"enabled":enabled}}
        def cage_restore(state):
            cleanup_calls.append(state)
            if failure=="cleanup":
                raise RuntimeError("cleanup exception")
        def enclosing_hand_main():
            driver = T.H.library(T.PIPE/"drive9/d9_blender.py","fixture")
            self.assertIsNot(driver.head_scale.install,caller_install)
            if failure=="preinstall":
                raise RuntimeError("driver exception before install")
            driver.head_scale.install({"head":1.10})
            self.assertIsNot(driver.posing.apply_pose,nested_caller)
            if failure=="render":
                raise RuntimeError("render exception after construction")
        argv = ["fixture","--","--facecage-mode",mode,"--hand-scale","1.0",
            "--shots","idle,back","--out",str(T.REPO/"review/rosace/specialists/refinement/facecage/cleanup-fixture"/mode)]
        with patch.object(sys,"argv",argv),patch.object(T.H,"library",caller_library),patch.object(T.H,"main",enclosing_hand_main),patch.object(T.C,"install",cage_install),patch.object(T.C,"restore",cage_restore):
            if failure:
                with self.assertRaises(RuntimeError):
                    T.main()
            else:
                T.main()
            self.assertIs(T.H.library,caller_library)
            self.assertIs(module.head_scale.install,caller_install)
            self.assertIs(module.posing.anchors,caller_anchors)
            self.assertIs(module.f1_module,caller_f1)
            self.assertIs(module.posing.apply_pose,nested_caller)
            self.assertEqual(module.posing.apply_pose("sentinel"),(token,"sentinel"))
        self.assertEqual(len(cleanup_calls),1)
        self.assertEqual(len(install_calls),0 if failure=="preinstall" else 1)

    def test_success_restores_prior_nested_caller_both_modes(self):
        for mode in ("control","facecage1"):
            with self.subTest(mode=mode):
                self.run_case(mode,None)

    def test_exception_boundaries_restore_prior_nested_caller_both_modes(self):
        for mode in ("control","facecage1"):
            for failure in ("preinstall","installer","cage","render","cleanup"):
                with self.subTest(mode=mode,failure=failure):
                    self.run_case(mode,failure)


if __name__=="__main__":
    result = unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(CleanupGuards))
    print(json.dumps({"kind":"real FC1 wrapper lifecycle with injected driver/mesh/render events",
        "tests":result.testsRun,"scenarios":12,"pass":result.wasSuccessful(),"nativeExecuted":False}))
    raise SystemExit(0 if result.wasSuccessful() else 1)

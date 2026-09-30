"""Actual lazy imports and in-memory authored face functions, no raw finishing.

Clear source paths and real module caches, load actual C1 through actual _reuse,
then exercise Cuff2's scoped search-path context. No fake finish dependencies.
"""
import hashlib
import importlib
import json
import sys
import unittest
from pathlib import Path

import numpy as np
from PIL import Image
import cuff2_native_post as POST
from _reuse import load

HERE = Path(__file__).resolve().parent
NAMES = ("d9_post", "f1_post", "r3_post", "r4_post", "r5_post", "wh2_px", "judge_sheets", "sheets_f3", "finish_metrics", "pixel_metrics")


class FinishBootstrap(unittest.TestCase):
    def clean(self):
        self.prior_path = sys.path[:]
        self.prior_modules = {name: sys.modules.get(name) for name in NAMES}
        source_root = str(POST.REPO.resolve()).lower()
        sys.path[:] = [path for path in sys.path if not str(Path(path or ".").resolve()).lower().startswith(source_root)]
        for name in NAMES:
            sys.modules.pop(name, None)
        self.clean_path = sys.path[:]
        c1 = load("cuff_native_post")
        self.assertEqual(sys.path, self.clean_path)
        self.assertNotIn("wh2_px", sys.modules)
        self.assertNotIn("judge_sheets", sys.modules)
        return c1

    def restore(self):
        sys.path[:] = self.prior_path
        for name, original in self.prior_modules.items():
            if original is None:
                sys.modules.pop(name, None)
            else:
                sys.modules[name] = original

    def fixture(self):
        alpha = np.zeros((32,32), bool)
        alpha[7:25,7:25] = True
        mat, part = np.zeros((32,32), np.uint8), np.zeros((32,32), np.uint8)
        mat[alpha], part[alpha] = 1, 1
        mat[7:10,7:25] = 5
        meta = {"px":80,"ss":1,"anchor":[16,29],"parts":{"head":1,"body":2},
                "materials":{"skin":{"id":1},"hair":{"id":5},"boot":{"id":9}}}
        eyes = {"L":[[11,12,1],[13,12,1],[13,13,1],[11,13,1]],
                "R":[[19,12,1],[21,12,1],[21,13,1],[19,13,1]]}
        fp = {"refs":{"ref_eyes":eyes,"ref_eyes_white":eyes},"nose":[17,17,1],"chin":[17,23,1]}
        out = np.zeros((32,32,4), float)
        out[alpha,3] = 255
        for row in range(32):
            out[row,alpha[row],:3] = (220-row,180-row,160-row)
        out[mat==5,:3] = (40,35,65)
        return out, alpha, mat, part, meta, fp

    def test_actual_clean_face_and_judging_lazy_closure(self):
        c1 = self.clean()
        try:
            # Discriminating negative control: actual lazy stamp import fails
            # before the scoped bootstrap, even though C1/D/F1 loaded cleanly.
            with self.assertRaises(ModuleNotFoundError):
                c1.D.stamp_face(*self.fixture(),"idle_hero",{},None)
            with POST.finish_imports():
                out,alpha,mat,part,meta,fp = self.fixture()
                r2 = json.loads((POST.PIPE/"drive9/r2_faces.json").read_text())
                faces = c1.D.faces_table(True,r2)
                changed, report, _ = c1.D.stamp_face(out,alpha,mat,part,meta,fp,"idle_hero",faces,r2)
                self.assertGreater(int(changed.sum()),0)
                self.assertIn("_S",report)
                canvas = report["_S"]
                hair = np.unique(out[mat==5,:3],axis=0)
                c1.D.r2_brows(out,canvas,faces,report,"80",hair,np.zeros(alpha.shape,bool))
                c1.F1.FaceCanvas(alpha,mat,part,meta,fp)
                f1_changed,_ = c1.F1.stamp_face(out.copy(),alpha,mat,part,meta,fp,"idle_hero")
                self.assertGreater(int(f1_changed.sum()),0)
                finish = c1.D.load_finish(str(POST.PIPE/"drive9/r2_finish.json"))
                finish["r3"] = {"face":{"blush":False}}
                c1.D.R3.face_extras(out.copy(),alpha,mat,part,meta,{1:"skin",5:"hair"},finish,report,canvas,np.zeros(alpha.shape,bool))
                js = importlib.import_module("judge_sheets")
                for name, relative in (("wh2_px","tools/art-construct/wh2_px.py"),
                                       ("judge_sheets","tools/pixel-pipeline/finish_judge/judge_sheets.py"),
                                       ("sheets_f3","tools/pixel-pipeline/finish_f3/sheets_f3.py"),
                                       ("finish_metrics","tools/art-construct/finish_metrics.py"),
                                       ("pixel_metrics","tools/art-construct/pixel_metrics.py")):
                    self.assertEqual(Path(sys.modules[name].__file__).resolve(),(POST.REPO/relative).resolve())
                # Execute the real contact-shadow helper with an in-memory PNG
                # stream. It reads authored config, never actual rendered raw.
                import io
                stream=io.BytesIO()
                Image.fromarray(out.astype(np.uint8)).save(stream,format="PNG")
                stream.seek(0)
                grounded=js.chain_ground(stream,np.zeros(alpha.shape,bool),meta)
                self.assertEqual(grounded.size,(32,32))
            self.assertEqual(sys.path,self.clean_path)
        finally:
            self.restore()

    def test_actual_lazy_import_failure_restores_exact_prior_search_path(self):
        self.clean()
        try:
            # Real nested imports alter sys.path; finally must undo those too.
            with self.assertRaisesRegex(RuntimeError,"after actual lazy imports"):
                with POST.finish_imports():
                    importlib.import_module("wh2_px")
                    importlib.import_module("judge_sheets")
                    raise RuntimeError("after actual lazy imports")
            self.assertEqual(sys.path,self.clean_path)
        finally:
            self.restore()


def main():
    import check_cuff2 as original
    suite=unittest.TestSuite(unittest.defaultTestLoader.loadTestsFromTestCase(cls) for cls in
        (original.Geometry,original.WrapperCleanup,original.ModifierRNADescriptors,original.NativeReceiptGuards,FinishBootstrap))
    result=unittest.TextTestRunner(verbosity=2).run(suite)
    source_paths=[HERE/"cuff2_native_post.py",HERE/"check_post_bootstrap.py",HERE/"check_cuff2.py",HERE/"_reuse.py",
                  POST.REPO/"art/rosace/specialists/refinement/cuff_native_post.py",
                  POST.PIPE/"drive9/d9_post.py",POST.PIPE/"finish_f1/f1_post.py",
                  POST.PIPE/"drive9/r3_post.py",POST.PIPE/"drive9/r4_post.py",POST.PIPE/"drive9/r5_post.py",
                  POST.REPO/"tools/art-construct/wh2_px.py",POST.PIPE/"finish_judge/judge_sheets.py",
                  POST.PIPE/"finish_f3/sheets_f3.py",POST.REPO/"tools/art-construct/finish_metrics.py",
                  POST.REPO/"tools/art-construct/pixel_metrics.py",POST.PIPE/"drive9/r2_finish.json",
                  POST.PIPE/"drive9/d9_finish.json",POST.PIPE/"drive9/r2_faces.json",POST.PIPE/"finish_f1/f1.json",
                  POST.PIPE/"finish_f2/faces_f2.json",POST.REPO/"art/rosace/faces/wh2.json",
                  POST.REPO/"art/rosace/palette.json",POST.REPO/"art/rosace/overrides/global/shading_r3g.json"]
    report={"schema":"rosace.cuff2.post-bootstrap.cpu/1","sourceBase":"925ee69072034408f34c25984f88afc20a65b064",
            "tests":result.testsRun,"passed":result.wasSuccessful(),"nativeExecuted":False,"actualRawPostExecuted":False,
            "coverage":"21 unchanged construction/wrapper/RNA/native guards plus2 actual lazy-import closure fixtures",
            "method":"real _reuse loading, clean source paths and module caches, actual lazy face helpers on synthetic arrays and actual judging import closure",
            "sourceHashes":{str(path.relative_to(POST.REPO)):hashlib.sha256(path.read_bytes()).hexdigest() for path in source_paths}}
    (HERE/"post-bootstrap-cpu-report.json").write_text(json.dumps(report,indent=2),encoding="utf-8",newline="\n")
    print(json.dumps(report))
    return 0 if result.wasSuccessful() else 1


if __name__=="__main__":
    raise SystemExit(main())

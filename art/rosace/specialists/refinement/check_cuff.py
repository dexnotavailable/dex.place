"""CPU rejection/preservation fixtures, not Blender/native proof."""
import json
import math
import unittest

import cuff_geometry as G


def fixture(length=0.60):
    points = []
    for row in range(G.ROWS+1):
        t = row/G.ROWS
        for column in range(G.COLUMNS):
            phi = 2*math.pi*column/G.COLUMNS
            bottom = max(0,-math.sin(phi))
            end = length-0.065+0.225*bottom**1.3
            a = 0.128+(end-0.128)*t
            radius = 0.055+0.08*t*t
            points.append((a,-math.cos(phi)*radius,math.sin(phi)*radius))
    return tuple(points), tuple(G.loft_faces()), (1.0,0.0,0.0)


class CuffGuards(unittest.TestCase):
    def test_disabled_skips_even_invalid_mesh(self):
        points = object()
        out, report = G.deform(points,None,None,False)
        self.assertIs(out,points)
        self.assertEqual(report["changedVertices"],0)

    def test_proximal_bell_and_cross_sector_fixed(self):
        points,faces,axis = fixture()
        out, report = G.deform(points,faces,axis,True)
        self.assertGreater(report["changedVertices"],0)
        self.assertGreaterEqual(report["minAxialGapRatio"],0.25)
        for i,(a,b) in enumerate(zip(points,out)):
            row,k = divmod(i,G.COLUMNS)
            if row <= 14 or math.sin(2*math.pi*k/G.COLUMNS) <= -0.35:
                self.assertEqual(a,b)
            self.assertEqual(a[1:],b[1:])
            self.assertGreaterEqual(a[0]-b[0],-1e-12)
            self.assertLessEqual(a[0]-b[0],0.055+1e-12)
        self.assertAlmostEqual(report["maxRetreatM"],0.055)
        self.assertEqual(points,fixture()[0])

    def test_sorted_faces_reversed_winding_permitted(self):
        points,faces,axis = fixture()
        a,_ = G.deform(points,faces,axis,True)
        b,_ = G.deform(points,tuple(tuple(reversed(f)) for f in reversed(faces)),axis,True)
        self.assertEqual(a,b)

    def test_bow_tie_rejected(self):
        points,faces,axis = fixture()
        face = faces[0]
        broken = ((face[0],face[2],face[1],face[3]),)+faces[1:]
        with self.assertRaisesRegex(ValueError,"bow-tie"):
            G.deform(points,broken,axis,True)

    def test_missing_or_duplicate_cell_rejected(self):
        points,faces,axis = fixture()
        for broken in (faces[:-1], (faces[1],)+faces[1:]):
            with self.assertRaises(ValueError):
                G.deform(points,broken,axis,True)

    def test_nonfinite_and_nonunit_rejected(self):
        points,faces,axis = fixture()
        for broken,ax in (((float("nan"),0,0),)+points[1:],axis), (points,(2,0,0)):
            with self.assertRaises(ValueError):
                G.deform(broken,faces,ax,True)

    def test_short_parent_rejects_fixed_retreat(self):
        with self.assertRaisesRegex(ValueError,"compresses/reverses"):
            G.deform(*fixture(0.28),True)

    def test_boolean_mode_required(self):
        with self.assertRaises(ValueError):
            G.deform(*fixture(),"cuff1")


if __name__ == "__main__":
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(CuffGuards)
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    print(json.dumps({"kind":"CPU construction guards only", "tests": result.testsRun,
        "passed": result.wasSuccessful(), "nativeExecuted":False}))
    raise SystemExit(0 if result.wasSuccessful() else 1)

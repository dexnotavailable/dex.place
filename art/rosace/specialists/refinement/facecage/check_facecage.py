"""Independent geometric rejection/normal fixtures; no native proof."""
import json
import math
import unittest
from unittest.mock import patch

import facecage_geometry as G


def cfg():
    return G.config(1.588,1.896,((.0506,-.0873,1.7027),(-.0506,-.0873,1.7027)),1.625)


class CageGuards(unittest.TestCase):
    def test_disabled_exact_noop(self):
        value = object()
        self.assertIs(G.move(value,None,False),value)

    def test_protected_neck_crown_back_exact(self):
        c = cfg()
        for p in ((.03,-.09,1.625),(.01,-.09,1.895),(.03,.01,1.70)):
            self.assertEqual(G.move(p,c),p)
            self.assertEqual(G.transport_normal(p,(.2,.3,.9),c),(.2,.3,.9))

    def test_bilateral_side_symmetry_and_orbital_lift(self):
        c = cfg()
        for z in (1.64,1.67,1.70,1.73):
            a,b = G.move((.050,-.09,z),c),G.move((-.050,-.09,z),c)
            self.assertAlmostEqual(a[0],-b[0])
            self.assertEqual(a[1:],b[1:])
            self.assertGreater(a[0],0)
        eye = G.move((.0506,-.0873,1.7027),c)
        self.assertGreater(eye[2]-1.7027,.012)
        jaw = G.move((.050,-.09,1.65),c)
        self.assertLess(jaw[0],.050)

    def test_positive_bounded_jacobian_and_displacement(self):
        c = cfg()
        for x in (-.10,-.05,0,.05,.10):
            for y in (-.11,-.09,-.06,-.02):
                for z in (1.63,1.65,1.68,1.70,1.72,1.75,1.79):
                    p = (x,y,z)
                    j = G.jacobian(p,c)
                    self.assertGreater(G.determinant(j),.35)
                    self.assertLess(G.determinant(j),2)
                    self.assertLessEqual(math.dist(p,G.move(p,c)),.17*c["span"])

    def test_normal_transport_affine_inverse_transpose(self):
        # Independent closed form for diag(2,1,.5): (nx/2,ny,2*nz).
        c = cfg()
        p,n = (.02,-.09,1.70),(.3,-.4,.8)
        with patch.object(G,"jacobian",return_value=((2.,0.,0.),(0.,1.,0.),(0.,0.,.5))):
            actual = G.transport_normal(p,n,c)
        expected = (.15,-.4,1.6)
        length = math.sqrt(sum(v*v for v in expected))
        for a,b in zip(actual,expected):
            self.assertAlmostEqual(a,b/length,places=12)

    def test_transported_normal_orthogonal_to_actual_cage_tangent(self):
        c = cfg()
        p,n = (.02,-.09,1.69),(0.,-1.,0.)
        norm = G.transport_normal(p,n,c)
        eps = 2e-5
        for t in ((1.,0.,0.),(0.,0.,1.)):
            a,b = G.move(tuple(p[i]-eps*t[i] for i in range(3)),c),G.move(tuple(p[i]+eps*t[i] for i in range(3)),c)
            tangent = [(b[i]-a[i])/(2*eps) for i in range(3)]
            self.assertAlmostEqual(sum(norm[i]*tangent[i] for i in range(3)),0,places=5)

    def test_triangle_validation_and_noop_refs(self):
        c = cfg()
        points = ((-.04,-.09,1.65),(.04,-.09,1.65),(.04,-.09,1.73),(-.04,-.09,1.73))
        candidate,report = G.validate(points,((0,1,2),(0,2,3)),c)
        self.assertEqual(report["changedVertices"],4)
        self.assertNotEqual(candidate,points)
        fixed = ((0,0,1.60),(.01,0,1.60),(0,0,1.61))
        out,report = G.validate(fixed,((0,1,2),),c,require_change=False)
        self.assertEqual(out,fixed)
        self.assertEqual(report["changedVertices"],0)

    def test_invalid_landmarks_points_and_degenerate_triangle_reject(self):
        with self.assertRaises(ValueError):
            G.config(1.588,1.896,((.05,-.09,1.70),(-.05,-.09,1.70)),1.70)
        with self.assertRaises(ValueError):
            G.move((float("nan"),0,0),cfg())
        with self.assertRaises(ValueError):
            G.validate(((0,-.09,1.7),)*3,((0,1,2),),cfg())


if __name__=="__main__":
    result = unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(CageGuards))
    print(json.dumps({"kind":"CPU geometric/normal safety only","tests":result.testsRun,"pass":result.wasSuccessful(),"nativeExecuted":False}))
    raise SystemExit(0 if result.wasSuccessful() else 1)

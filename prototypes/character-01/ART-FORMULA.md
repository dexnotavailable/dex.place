# Character art formula (character-01)

The first pass assembled the body from capsules and polygons, and it read as sticks.
This formula replaces that assembly. Every frame runs the same pipeline:

pose -> skeleton (IK) -> landmark contours -> silhouette -> values -> form -> details -> secondary motion

## 1. Proportion canon

- About 6.2 heads tall. The head is drawn 1.3x larger than the body maths suggests (`HK`),
  because at pixel scale the face has to carry the appeal (see the reference sprites).
- Legs are about 52% of the body. The shin is nearly as long as the thigh.
- `K = 1.2` sets pixel density: the figure is ~160px tall at native 640x360.

## 2. Silhouette: one contour per mass

- Each mass (leg, arm, torso, face, bangs, skirt, capelet, hair strand, cape panel) is one
  closed outline through named landmarks bound to bones: `(bone, t along bone, offset across)`.
- Joint landmarks (knee, elbow) sit on the bisector of the two bones, so bends stay round.
- Landmarks are joined with a centripetal Catmull-Rom spline. A sharp flag keeps real
  corners (hem teeth, heel, chin, tattered edges).
- Curve rules baked into the `FIG` tables: alternate the bulges (outer thigh high, inner
  low; calf high at the back), keep the shin front straight against the curved calf, and
  taper into every joint.

## 3. Pose rule

Key poses keep the front contour clear, from neck to bust, waist, belly, thigh, knee and
shin. Arms and the blade go behind, above, or across the legs, not across the torso's profile.

## 4. Value bands

- Dark: hair, cape, sleeves, corset, socks.
- Mid: skirt (slate), so the hip flare separates from the cape.
- Light: skin, blouse.
- Red only on eyes, tie, ribbons, trims, blade and halo.

Check the silhouette panel first, then the value panel, then colour.

## 5. Form

- Two-tone cel shading plus a highlight, lit from the front-top in facing space.
- Hue-shifted ramps: warm skin shadows, blue sheen on black hair, wine-black cape.
- Cast shadows come from the real shapes: skirt on thighs, bangs on face, head on neck,
  capelet on blouse.

## 6. Lines

Every material has its own outline colour. The lit side gets a softer outline (sel-out).
Inner lines appear only where one mass overlaps another.

## 7. Details are stamps

Eyes, mouth and blush are hand-placed pixel stamps positioned on rotated anchors. They are
never scaled or deformed, so they stay crisp in every pose.

## 8. Secondary motion

Hair, cape panels, ribbon and tie are verlet chains in world space. The skirt hem and chest
are damped springs that respond to real acceleration.

## Knobs

- `FIG` in `src/30-rig.js`: every landmark number (the figure itself).
- `K`, `HK`: pixel density and head scale.
- `COSTUMES`: value variants.
- `tools/formula-sheet.html`: renders rig / silhouette / values / final side by side for
  any pose. Use it after every change.

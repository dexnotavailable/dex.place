// The camera of the opening corridor (GDK 3.9, Appendix C): framing keyed to her x.
// While the opening runs, the reveal: the close band on her face at the catch, the
// pull-back along the jetty, the framed gates (two since torii-1021) and the terrace's approach passed at about 1/2, 1/3 and 1/4, the
// widest frame (1/8) on the viewing terrace, then easing back in over the tunnel's first
// gates. Afterwards the corridor keeps a gentler vista (1/2) on the terrace.

import { h } from "../../config.ts";
import type { WorldBuilder } from "../build.ts";

export function openingCamera(b: WorldBuilder): void {
  // Kagami: the lake fills the frame (a high camera, the horizon high up)
  b.track({ id: "kagami", x0: 0, x1: h(112), keys: [
    { x: h(0), anchor: 0.68, horizon: 0.28 },
    { x: h(104), anchor: 0.68, horizon: 0.28 },
    { x: h(112), anchor: 0.68, horizon: 0.34 },
  ] });
  // Gate Road and the forecourt: an ordinary frame, the overlook drops the ground line
  b.track({ id: "gate-road", x0: h(112), x1: h(150), keys: [
    { x: h(112), anchor: 0.68, horizon: 0.34 },
    { x: h(121), anchor: 0.7, horizon: 0.36 },
    { x: h(124.6), zoom: 0.5, anchor: 0.74, horizon: 0.4 },
    { x: h(128.6), zoom: 0.5, anchor: 0.74, horizon: 0.4 },
    { x: h(131.5), zoom: 1, anchor: 0.68, horizon: 0.38 },
    { x: h(150), anchor: 0.68, horizon: 0.38 },
  ] });
  // the reveal, while the opening runs
  b.track({ id: "reveal", x0: h(96), x1: h(140), when: "opening", keys: [
    { x: h(99.6), zoom: 2, anchor: 0.62, horizon: 0.27, lead: 0 },
    { x: h(101.6), zoom: 1.5, anchor: 0.64, horizon: 0.27, lead: 0.02 },
    { x: h(104.2), zoom: 1.1, anchor: 0.66, horizon: 0.28, lead: 0.04 },
    { x: h(107), zoom: 1, anchor: 0.68, horizon: 0.28, lead: 0.04 },
    { x: h(110), zoom: 0.8, anchor: 0.68, horizon: 0.3, lead: 0.02 },
    { x: h(115), zoom: 0.5, anchor: 0.67, horizon: 0.33, lead: 0 },
    { x: h(119), zoom: 1 / 3, anchor: 0.65, horizon: 0.36, lead: 0 },
    { x: h(123), zoom: 0.25, anchor: 0.68, horizon: 0.42, lead: 0 },
    // the widest frame: the lake on the left, the palace on the right (its west gate pinned at
    // four fifths of the frame's width, so a narrow screen crops the palace's far side, never
    // the sky the title needs), TESU written into the sky between them, dead centre
    { x: h(124.8), zoom: 0.125, anchor: 0.71, horizon: 0.5, lead: 0, pin: { x: h(143), at: 0.8 } },
    { x: h(128.6), zoom: 0.125, anchor: 0.71, horizon: 0.5, lead: 0, pin: { x: h(143), at: 0.8 } },
    { x: h(130.8), zoom: 0.45, anchor: 0.64, horizon: 0.4, lead: 0.03 },
    { x: h(133.6), zoom: 1, anchor: 0.68, horizon: 0.38, lead: 0.07 },
  ] });
}

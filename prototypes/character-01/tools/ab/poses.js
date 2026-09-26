var POSES = {
  idle: mkPose({ rx:-2, hp:0.16, sp:-0.09, hd:0.14, fx:7, ft:0.45, bx:-3, fa:1.9, fr:0.98, bd:2.78, gp:11, ba:1.75, br:0.62, be:1, hb:1, yaw:0 }),
  stance: mkPose({ ry:-58, sp:0.3, hd:-0.05, fx:15, bx:-15, bt:0.5, gr:1, g2:1, fa:0.95, fr:0.62, ba:0.95, br:0.7, bd:0.32, fc:1, yaw:0 }),
  idleQ: mkPose({ yaw:1, rx:0.5, hp:0.07, sp:-0.04, hd:0.12, fx:-3.5, ft:0, bx:8.5, bt:0.35, fa:1.72, fr:0.98, bd:2.72, gp:11, ba:1.25, br:0.56, be:1, hb:1 }),
  stanceQ: mkPose({ yaw:0.6, ry:-58, sp:0.28, hd:-0.05, fx:-12, bx:16, bt:0.5, ft:0, gr:1, g2:1, fa:0.95, fr:0.62, ba:0.95, br:0.7, bd:0.32, fc:1 }),
};
POSES.idleQ2 = mkPose({ yaw:1, rx:0.5, hp:0.1, sp:-0.05, hd:0.12, fx:-2, ft:0, bx:9, bt:0.3, fa:1.62, fr:0.76, fe:1, hf:1, gr:2, bz:0, ba:1.39, br:0.84, be:-1, bd:0.6, gp:10 });
POSES.idleQ5 = mkPose({ yaw:1, rx:-2.8, ry:-68.2, hp:0.15, sp:-0.12, hd:0.2, fx:-1.5, ft:0, bx:9.5, by:0, bt:0.5, fa:1.55, fr:0.72, fe:1, hf:1, gr:2, bz:0, ba:1.32, br:0.84, be:-1, bd:0.62, gp:10 });
POSES.idleQ5b = mkPose({ yaw:1, rx:-5, ry:-67.6, hp:0.24, sp:-0.2, hd:0.3, fx:-1, ft:0, bx:4.5, by:0, bt:0.65, kb:-1, fa:1.5, fr:0.7, fe:1, hf:1, gr:2, bz:0, ba:1.3, br:0.84, be:-1, bd:0.62, gp:10 });
POSES.idleQ5c = mkPose({ yaw:1, rx:-4.2, ry:-67.8, hp:0.22, sp:-0.18, hd:0.28, fx:-2, ft:0, bx:9, by:0, bt:0.55, fa:1.5, fr:0.7, fe:1, hf:1, gr:2, bz:0, ba:1.3, br:0.84, be:-1, bd:0.62, gp:10 });
// action poses to check the formula beyond idle
POSES.runQ = mkPose({ yaw:0.35, ry:-64, sp:0.26, hd:-0.1, fx:17, fy:0, ft:-0.1, bx:-17, by:-9, bt:0.9, kb:1, fa:2.55, fr:0.95, bd:3.0, gp:11, ba:0.45, br:0.72, be:1, fc:1 });
POSES.slashQ = mkPose({ yaw:0.55, rx:4, ry:-60, hp:0.05, sp:0.34, hd:-0.08, fx:20, ft:0, bx:-14, bt:0.55, fa:0.35, fr:0.98, bd:0.55, gp:11, ba:1.9, br:0.7, be:1, fc:4 });
POSES.windQ = mkPose({ yaw:0.7, rx:-3, ry:-62, hp:-0.06, sp:-0.2, hd:0.1, fx:12, bx:-12, bt:0.3, fa:-2.3, fr:0.85, fe:-1, bd:-2.2, gp:11, ba:1.2, br:0.7, fc:1 });
POSES.crouchQ = mkPose({ yaw:0.5, ry:-44, rx:2, sp:0.62, hd:-0.42, fx:16, ft:0, bx:-18, by:0, bt:0.9, fa:0.25, fr:0.9, bd:-0.55, gp:11, ba:1.25, br:0.95, be:-1, hb:0, fc:1 });

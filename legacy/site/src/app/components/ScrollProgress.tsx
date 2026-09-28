import { motion, useReducedMotion, useScroll, useSpring } from "motion/react";
import { useSeason } from "./season";

export function ScrollProgress() {
  const { season } = useSeason();
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 180,
    damping: 28,
    mass: 0.28,
  });

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-16 z-[60] h-[2px] bg-black/10">
      <motion.div
        className="h-full origin-left"
        style={{
          scaleX: reduceMotion ? scrollYProgress : smoothProgress,
          background: season.accent,
          boxShadow: `0 0 14px ${season.glow}`,
        }}
      />
    </div>
  );
}

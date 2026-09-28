import { useEffect, useState, type RefObject } from "react";

const clamp = (value: number) => Math.max(0, Math.min(1, value));

export function useSectionProgress(ref: RefObject<HTMLElement | null>) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let frame = 0;

    const measure = () => {
      frame = 0;
      const element = ref.current;
      if (!element) return;

      const rect = element.getBoundingClientRect();
      const travel = Math.max(1, element.offsetHeight - window.innerHeight);
      setProgress(clamp(-rect.top / travel));
    };

    const requestMeasure = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("scroll", requestMeasure, { passive: true });
    window.addEventListener("resize", requestMeasure);

    return () => {
      window.removeEventListener("scroll", requestMeasure);
      window.removeEventListener("resize", requestMeasure);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [ref]);

  return progress;
}

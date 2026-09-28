import { useEffect, useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";
import { useSeason } from "./season";

const stages = [
  {
    id: "weapon-line",
    title: "weapon line",
    note: "isolated weapon line art",
    src: "/assets/portfolio/towaki/01-weapon-line.webp",
    duration: 1700,
  },
  {
    id: "merged-line",
    title: "full line",
    note: "character and weapon line art combined",
    src: "/assets/portfolio/towaki/02-merged-line.webp",
    duration: 2100,
  },
  {
    id: "render",
    title: "render",
    note: "colored character and weapon",
    src: "/assets/portfolio/towaki/03-render.webp",
    duration: 2200,
  },
  {
    id: "gesture",
    title: "gesture",
    note: "brush marks added over the render",
    src: "/assets/portfolio/towaki/04-marks.webp",
    duration: 2300,
  },
  {
    id: "poster",
    title: "poster",
    note: "final pink poster",
    src: "/assets/portfolio/towaki/05-final.webp",
    duration: 3600,
  },
] as const;

export function TowakiBuildViewer() {
  const { season } = useSeason();
  const reduceMotion = useReducedMotion();
  const [activeIndex, setActiveIndex] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);
  const activeStage = stages[activeIndex];
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const smoothX = useSpring(pointerX, { stiffness: 180, damping: 25 });
  const smoothY = useSpring(pointerY, { stiffness: 180, damping: 25 });
  const imageX = useTransform(smoothX, [-1, 1], [-7, 7]);
  const imageY = useTransform(smoothY, [-1, 1], [-5, 5]);

  useEffect(() => {
    if (reduceMotion) {
      setActiveIndex(stages.length - 1);
      return;
    }
    if (!autoPlay) return;

    const timer = window.setTimeout(() => {
      setActiveIndex((current) => (current + 1) % stages.length);
    }, activeStage.duration);

    return () => window.clearTimeout(timer);
  }, [activeIndex, activeStage.duration, autoPlay, reduceMotion]);

  const moveArtwork = (event: React.PointerEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    pointerX.set(((event.clientX - rect.left) / rect.width) * 2 - 1);
    pointerY.set(((event.clientY - rect.top) / rect.height) * 2 - 1);
  };

  const resetArtwork = () => {
    pointerX.set(0);
    pointerY.set(0);
  };

  const advanceStage = () => {
    setAutoPlay(false);
    setActiveIndex((current) => (current + 1) % stages.length);
  };

  const selectStage = (index: number) => {
    setAutoPlay(false);
    setActiveIndex(index);
  };

  return (
    <article className="flex h-full min-h-0 flex-col overflow-hidden rounded-[3px] border border-black bg-[#111111] text-white">
      <header className="flex h-11 shrink-0 items-center justify-between gap-4 border-b border-white/12 px-3 md:px-4">
        <div
          className="truncate text-[8px] font-bold uppercase text-white/48"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          source / TOWAKI.PSD / 2 line stacks
        </div>
        <div
          className="shrink-0 text-[8px] font-bold uppercase"
          style={{ color: season.accent, fontFamily: "'JetBrains Mono', monospace" }}
        >
          2160 x 3840
        </div>
      </header>

      <div className="relative min-h-0 flex-1 overflow-hidden bg-white">
        <button
          type="button"
          aria-label={`Advance TOWAKI artwork build from ${activeStage.title}`}
          onClick={advanceStage}
          onPointerMove={moveArtwork}
          onPointerLeave={resetArtwork}
          className="absolute inset-0 overflow-hidden text-left outline-none focus-visible:ring-2 focus-visible:ring-inset"
        >
          <AnimatePresence initial={false} mode="sync">
            <motion.img
              key={activeStage.src}
              src={activeStage.src}
              alt={`TOWAKI artwork ${activeStage.title} stage`}
              draggable={false}
              decoding="async"
              className="absolute inset-[-8px] h-[calc(100%+16px)] w-[calc(100%+16px)] select-none object-contain"
              style={{ x: imageX, y: imageY }}
              initial={reduceMotion ? false : { opacity: 0, scale: 1.045, filter: "contrast(1.2)" }}
              animate={{ opacity: 1, scale: 1.012, filter: "contrast(1)" }}
              exit={{ opacity: 0, scale: 0.985 }}
              transition={{ duration: reduceMotion ? 0.01 : 0.58, ease: [0.16, 1, 0.3, 1] }}
            />
          </AnimatePresence>

          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_54%,rgba(0,0,0,0.76)_100%)]" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-5 p-4 md:p-5">
            <div>
              <div
                className="text-[8px] font-bold uppercase text-white/48"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                stage {String(activeIndex + 1).padStart(2, "0")}
              </div>
              <h3
                className="mt-1 text-[26px] font-bold leading-none md:text-[34px]"
                style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "0" }}
              >
                TOWAKI
              </h3>
              <p className="mt-1 text-[9px] text-white/62 md:text-[10px]">{activeStage.note}</p>
            </div>
            <div
              className="shrink-0 text-[8px] font-bold uppercase text-white/64"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              {activeStage.title}
            </div>
          </div>
        </button>
      </div>

      <div className="grid h-[74px] shrink-0 grid-cols-5 border-t border-white/12 bg-[#111111]">
        {stages.map((stage, index) => {
          const active = index === activeIndex;
          return (
            <button
              key={stage.id}
              type="button"
              onClick={() => selectStage(index)}
              aria-label={`Show TOWAKI ${stage.title} stage`}
              aria-pressed={active}
              className={`group relative min-w-0 overflow-hidden px-2 text-left outline-none transition-colors hover:bg-white/[0.06] focus-visible:ring-2 focus-visible:ring-inset ${
                index > 0 ? "border-l border-white/10" : ""
              }`}
            >
              {active && (
                <motion.span
                  layoutId="towaki-stage-active"
                  className="absolute inset-x-0 top-0 h-[3px]"
                  style={{ background: season.accent }}
                  transition={{ type: "spring", stiffness: 380, damping: 34 }}
                />
              )}
              <span
                className="block text-[7px] font-bold text-white/28"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <span
                className={`mt-1 block truncate text-[8px] font-bold uppercase md:text-[9px] ${
                  active ? "text-white" : "text-white/48"
                }`}
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                {stage.title}
              </span>
              {active && autoPlay && !reduceMotion && (
                <motion.span
                  key={`towaki-progress-${stage.id}`}
                  className="absolute inset-x-2 bottom-2 h-px origin-left bg-white/35"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: stage.duration / 1000, ease: "linear" }}
                />
              )}
            </button>
          );
        })}
      </div>
    </article>
  );
}

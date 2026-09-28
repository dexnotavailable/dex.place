import { useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";
import { useSeason } from "./season";

const shots = [
  { id: "01", src: "/assets/portfolio/vuc-menh/shot-01.webp", note: "environment" },
  { id: "12", src: "/assets/portfolio/vuc-menh/shot-12.webp", note: "line art" },
  { id: "13", src: "/assets/portfolio/vuc-menh/shot-13.webp", note: "final color" },
  { id: "14", src: "/assets/portfolio/vuc-menh/shot-14.webp", note: "split frame" },
  { id: "15", src: "/assets/portfolio/vuc-menh/shot-15.webp", note: "line art" },
  { id: "18", src: "/assets/portfolio/vuc-menh/shot-18.webp", note: "rough frame" },
  { id: "19", src: "/assets/portfolio/vuc-menh/shot-19.webp", note: "line art" },
  { id: "20", src: "/assets/portfolio/vuc-menh/shot-20.webp", note: "final color" },
  { id: "21", src: "/assets/portfolio/vuc-menh/shot-21.webp", note: "rough frame" },
  { id: "22", src: "/assets/portfolio/vuc-menh/shot-22.webp", note: "line art" },
  { id: "23", src: "/assets/portfolio/vuc-menh/shot-23.webp", note: "final color" },
] as const;

export function VucMenhViewer() {
  const { season } = useSeason();
  const reduceMotion = useReducedMotion();
  const [activeIndex, setActiveIndex] = useState(2);
  const activeShot = shots[activeIndex];
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const smoothX = useSpring(pointerX, { stiffness: 180, damping: 24 });
  const smoothY = useSpring(pointerY, { stiffness: 180, damping: 24 });
  const imageX = useTransform(smoothX, [-1, 1], [-8, 8]);
  const imageY = useTransform(smoothY, [-1, 1], [-5, 5]);

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    pointerX.set((event.clientX - rect.left) / rect.width * 2 - 1);
    pointerY.set((event.clientY - rect.top) / rect.height * 2 - 1);
  };

  const resetPointer = () => {
    pointerX.set(0);
    pointerY.set(0);
  };

  const advanceShot = () => {
    setActiveIndex((current) => (current + 1) % shots.length);
  };

  const selectShot = (index: number) => {
    setActiveIndex(index);
  };

  return (
    <article className="flex h-full min-h-0 flex-col overflow-hidden rounded-[3px] border border-black bg-[#090909] text-white">
      <header className="flex h-11 shrink-0 items-center justify-between gap-4 border-b border-white/12 px-4">
        <div
          className="text-[8px] font-bold uppercase text-white/48"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          11 PSD shots
        </div>
        <div
          className="text-[8px] font-bold uppercase"
          style={{ color: season.accent, fontFamily: "'JetBrains Mono', monospace" }}
        >
          shot {activeShot.id} / {activeShot.note}
        </div>
      </header>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <button
          type="button"
          aria-label={`Show next VỰC MỆNH shot after shot ${activeShot.id}`}
          onClick={advanceShot}
          onPointerMove={handlePointerMove}
          onPointerLeave={resetPointer}
          className="absolute inset-0 overflow-hidden bg-[#0d0d0e] text-left outline-none focus-visible:ring-2 focus-visible:ring-inset"
        >
          <div className="season-ink-grid absolute inset-0 opacity-10" />
          <div className="absolute inset-0" style={{ background: season.atmosphere, opacity: 0.13 }} />
          <AnimatePresence initial={false} mode="wait">
            <motion.img
              key={activeShot.src}
              src={activeShot.src}
              alt={`VỰC MỆNH music video artwork, shot ${activeShot.id}`}
              draggable={false}
              decoding="async"
              className="absolute inset-[-10px] h-[calc(100%+20px)] w-[calc(100%+20px)] select-none object-contain"
              style={{ x: imageX, y: imageY }}
              initial={reduceMotion ? false : { opacity: 0, scale: 1.035, filter: "contrast(1.25)" }}
              animate={{ opacity: 1, scale: 1, filter: "contrast(1)" }}
              exit={{ opacity: 0, scale: 0.985 }}
              transition={{ duration: 0.48, ease: [0.16, 1, 0.3, 1] }}
            />
          </AnimatePresence>
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_52%,rgba(0,0,0,0.78)_100%)]" />

          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-5 p-4 md:p-5">
            <div>
              <div
                className="text-[8px] font-bold uppercase text-white/45"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                MV ARTWORK
              </div>
              <h3
                className="mt-1 text-[26px] font-bold leading-none md:text-[34px]"
                style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "0" }}
              >
                VỰC MỆNH
              </h3>
            </div>
            <div
              className="text-right text-[8px] font-bold uppercase text-white/60"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              {String(activeIndex + 1).padStart(2, "0")} / {String(shots.length).padStart(2, "0")}
            </div>
          </div>
        </button>
      </div>

      <div
        className="vnmc-frame-rail flex h-[70px] shrink-0 gap-1.5 overflow-x-auto border-t border-white/12 bg-[#111111] p-1.5"
        role="group"
        aria-label="VỰC MỆNH PSD shot gallery"
      >
        {shots.map((shot, index) => {
          const active = index === activeIndex;
          return (
            <button
              key={shot.id}
              type="button"
              onClick={() => selectShot(index)}
              aria-label={`Show VỰC MỆNH shot ${shot.id}`}
              aria-pressed={active}
              className="group relative aspect-video h-full shrink-0 overflow-hidden rounded-[2px] border bg-black outline-none focus-visible:ring-2"
              style={{ borderColor: active ? season.accent : "rgba(255,255,255,0.14)" }}
            >
              <img
                src={shot.src}
                alt=""
                aria-hidden="true"
                loading="lazy"
                decoding="async"
                className={`h-full w-full object-cover transition duration-300 ${
                  active ? "opacity-100" : "opacity-42 grayscale group-hover:opacity-100 group-hover:grayscale-0"
                }`}
              />
              <span
                className="absolute bottom-1 left-1 bg-black/72 px-1 text-[6px] font-bold text-white"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                {shot.id}
              </span>
              {active && <span className="absolute inset-x-0 bottom-0 h-0.5" style={{ background: season.accent }} />}
            </button>
          );
        })}
      </div>
    </article>
  );
}

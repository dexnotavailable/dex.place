import { useEffect, useState } from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";
import { DEX_ARTWORK } from "../data/dexArtwork";
import { useSeason } from "./season";

const flatLayerIds = new Set([
  "layer-03",
  "layer-04",
  "layer-05",
  "layer-06",
  "layer-07",
  "layer-08",
  "layer-09",
  "layer-10",
  "layer-11",
  "layer-15",
  "layer-18",
  "layer-23",
]);

const renderedLayerIds = new Set(
  DEX_ARTWORK.layers
    .filter((layer) => layer.sourceOrder >= 3 && layer.sourceOrder <= 23)
    .map((layer) => layer.id)
);

const finalLayerIds = new Set(
  DEX_ARTWORK.layers
    .filter((layer) => layer.sourceOrder > 0)
    .map((layer) => layer.id)
);

const stages = [
  {
    id: "lineart",
    title: "lineart",
    note: "the full drawing on white",
    background: "#f8f8f6",
    layerIds: new Set(["layer-23"]),
    duration: 1900,
  },
  {
    id: "flats",
    title: "flat color",
    note: "base colors for the skin, suit, hair, and tie",
    background: "#f4f3f1",
    layerIds: flatLayerIds,
    duration: 2200,
  },
  {
    id: "render",
    title: "rendering",
    note: "shading, texture, and material detail",
    background: "#ececef",
    layerIds: renderedLayerIds,
    duration: 2400,
  },
  {
    id: "effects",
    title: "extra effects",
    note: "dark background and cyan marks",
    background: "#050506",
    layerIds: finalLayerIds,
    duration: 3600,
  },
] as const;

export function ArtworkSource() {
  const { season } = useSeason();
  const reduceMotion = useReducedMotion();
  const [activeIndex, setActiveIndex] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);
  const activeStage = stages[activeIndex];
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const smoothX = useSpring(pointerX, { stiffness: 170, damping: 24 });
  const smoothY = useSpring(pointerY, { stiffness: 170, damping: 24 });
  const artX = useTransform(smoothX, [-1, 1], [-5, 5]);
  const artY = useTransform(smoothY, [-1, 1], [-3, 3]);
  const effectsX = useTransform(smoothX, [-1, 1], [-15, 15]);
  const effectsY = useTransform(smoothY, [-1, 1], [-9, 9]);

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

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    pointerX.set((event.clientX - rect.left) / rect.width * 2 - 1);
    pointerY.set((event.clientY - rect.top) / rect.height * 2 - 1);
  };

  const resetPointer = () => {
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
    <article className="relative h-full overflow-hidden rounded-[3px] border border-black bg-[#050506] text-white">
      <motion.div
        className="absolute inset-0"
        animate={{ backgroundColor: activeStage.background }}
        transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
      />
      <motion.div
        className="absolute inset-0"
        style={{ background: season.atmosphere }}
        animate={{ opacity: activeStage.id === "effects" ? 0.28 : 0 }}
        transition={{ duration: 0.7 }}
      />
      <div
        className={`season-ink-grid absolute inset-0 transition-opacity duration-700 ${
          activeStage.id === "effects" ? "opacity-[0.04]" : "opacity-35"
        }`}
      />

      <header className="absolute inset-x-0 top-0 z-30 flex h-10 items-center justify-between gap-4 border-b border-black/12 bg-white/72 px-3 text-black backdrop-blur-md md:px-4">
        <div
          className="text-[8px] font-bold uppercase text-black/45"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          character concept / {DEX_ARTWORK.source} / {DEX_ARTWORK.paintLayers} layers
        </div>
        <div
          className="text-[8px] font-bold uppercase"
          style={{ color: season.accent, fontFamily: "'JetBrains Mono', monospace" }}
        >
          {String(activeIndex + 1).padStart(2, "0")} / {String(stages.length).padStart(2, "0")}
        </div>
      </header>

      <button
        type="button"
        aria-label={`Advance dex artwork build from ${activeStage.title}`}
        onClick={advanceStage}
        onPointerMove={handlePointerMove}
        onPointerLeave={resetPointer}
        className="absolute inset-x-0 bottom-[76px] top-10 overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-inset"
      >
        {DEX_ARTWORK.layers.slice(1).map((layer) => {
          const visible = activeStage.layerIds.has(layer.id);
          const effectLayer = layer.sourceOrder <= 2 || layer.sourceOrder >= 24;
          return (
            <motion.img
              key={layer.id}
              src={layer.file}
              alt=""
              aria-hidden="true"
              draggable={false}
              decoding="async"
              className="pointer-events-none absolute inset-0 h-full w-full select-none object-contain"
              style={{
                x: effectLayer ? effectsX : artX,
                y: effectLayer ? effectsY : artY,
              }}
              initial={false}
              animate={{
                opacity: visible ? 1 : 0,
                scale: visible && effectLayer && activeStage.id === "effects" ? 1.012 : 1,
              }}
              transition={{ duration: reduceMotion ? 0.01 : 0.62, ease: [0.16, 1, 0.3, 1] }}
            />
          );
        })}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.76))] px-4 pb-4 pt-14 text-left text-white md:px-5">
          <div
            className="text-[8px] font-bold uppercase text-white/48"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            stage {String(activeIndex + 1).padStart(2, "0")}
          </div>
          <div className="mt-1 flex items-end justify-between gap-4">
            <div>
              <h3
                className="text-[24px] font-bold leading-none md:text-[30px]"
                style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "0" }}
              >
                {activeStage.title}
              </h3>
              <p className="mt-1 text-[9px] text-white/60 md:text-[10px]">{activeStage.note}</p>
            </div>
            <div
              className="hidden text-[8px] font-bold uppercase text-white/45 sm:block"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              {DEX_ARTWORK.canvas.width} x {DEX_ARTWORK.canvas.height}
            </div>
          </div>
        </div>
      </button>

      <div className="absolute inset-x-0 bottom-0 z-30 grid h-[76px] grid-cols-4 border-t border-black/15 bg-white text-black">
        {stages.map((stage, index) => {
          const active = index === activeIndex;
          return (
            <button
              key={stage.id}
              type="button"
              onClick={() => selectStage(index)}
              aria-pressed={active}
              aria-label={`Show ${stage.title} stage`}
              className={`group relative min-w-0 overflow-hidden px-2 text-left outline-none transition-colors hover:bg-black/[0.04] focus-visible:ring-2 focus-visible:ring-inset ${
                index > 0 ? "border-l border-black/12" : ""
              }`}
            >
              {active && (
                <motion.span
                  layoutId="dex-art-stage"
                  className="absolute inset-x-0 top-0 h-[3px]"
                  style={{ background: season.accent }}
                  transition={{ type: "spring", stiffness: 380, damping: 34 }}
                />
              )}
              <span
                className="block text-[7px] font-bold text-black/30"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <span
                className={`mt-1 block truncate text-[8px] font-bold uppercase md:text-[9px] ${
                  active ? "text-black" : "text-black/48"
                }`}
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                {stage.title}
              </span>
              {active && autoPlay && !reduceMotion && (
                <motion.span
                  key={`dex-stage-progress-${stage.id}`}
                  className="absolute inset-x-2 bottom-2 h-px origin-left bg-black/32"
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

import { useState } from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";
import { VNMC_BANNER } from "../data/vnmcBanner";
import { Particles } from "./Particles";
import { useSeason } from "./season";
import { VnmcMotionArtwork } from "./VnmcMotionArtwork";

const cameraOffset = (focus: number, zoom: number) => {
  const proposed = (0.5 - focus) * zoom;
  const edge = (zoom - 1) / 2;
  return Math.max(-edge, Math.min(edge, proposed));
};

export function VnmcBannerViewer() {
  const { season } = useSeason();
  const reduceMotion = useReducedMotion();
  const [activeStop, setActiveStop] = useState(1);
  const [freeScan, setFreeScan] = useState(false);
  const activeGroup = VNMC_BANNER.characterGroups[activeStop];
  const cameraX = useMotionValue(activeGroup.camera.x);
  const cameraY = useMotionValue(activeGroup.camera.y);
  const cameraZoom = useMotionValue(activeGroup.camera.zoom);
  const frameWidth = useMotionValue(activeGroup.camera.frame);
  const windRawX = useMotionValue(0);
  const windRawY = useMotionValue(0);
  const spring = { stiffness: 135, damping: 24, mass: 0.72 };
  const smoothX = useSpring(cameraX, spring);
  const smoothY = useSpring(cameraY, spring);
  const smoothZoom = useSpring(cameraZoom, { stiffness: 120, damping: 24, mass: 0.8 });
  const smoothFrame = useSpring(frameWidth, spring);
  const windX = useSpring(windRawX, { stiffness: 90, damping: 20, mass: 0.72 });
  const windY = useSpring(windRawY, { stiffness: 90, damping: 20, mass: 0.72 });
  const visualX = reduceMotion ? cameraX : smoothX;
  const visualY = reduceMotion ? cameraY : smoothY;
  const visualZoom = reduceMotion ? cameraZoom : smoothZoom;
  const visualFrame = reduceMotion ? frameWidth : smoothFrame;
  const imageX = useTransform(
    [visualX, visualZoom],
    ([x, zoom]) => `${cameraOffset(Number(x), Number(zoom)) * 100}%`
  );
  const imageY = useTransform(
    [visualY, visualZoom],
    ([y, zoom]) => `${cameraOffset(Number(y), Number(zoom)) * 100}%`
  );
  const viewfinderLeft = useTransform(visualX, (value) => `${value * 100}%`);
  const viewfinderWidth = useTransform(visualFrame, (value) => `${value * 100}%`);

  const scanComposition = (event: React.PointerEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const nextX = Math.max(0.1, Math.min(0.9, (event.clientX - rect.left) / rect.width));
    const nextY = Math.max(0.2, Math.min(0.8, (event.clientY - rect.top) / rect.height));
    cameraX.set(nextX);
    cameraY.set(nextY);
    cameraZoom.set(1.16);
    frameWidth.set(0.25);
    windRawX.set((nextX - 0.5) * 18);
    windRawY.set((nextY - 0.5) * 12);
    setFreeScan(true);
  };

  const settleWind = () => {
    windRawX.set(0);
    windRawY.set(0);
  };

  const scanTimeline = (event: React.PointerEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const halfFrame = frameWidth.get() / 2;
    const nextX = Math.max(
      halfFrame,
      Math.min(1 - halfFrame, (event.clientX - rect.left) / rect.width)
    );
    cameraX.set(nextX);
    setFreeScan(true);
  };

  const setCamera = (index: number) => {
    const { camera } = VNMC_BANNER.characterGroups[index];
    cameraX.set(camera.x);
    cameraY.set(camera.y);
    cameraZoom.set(camera.zoom);
    frameWidth.set(camera.frame);
  };

  const advanceFocus = () => {
    const next = (activeStop + 1) % VNMC_BANNER.characterGroups.length;
    setActiveStop(next);
    setFreeScan(false);
    setCamera(next);
  };

  const selectGroup = (index: number) => {
    setActiveStop(index);
    setFreeScan(false);
    setCamera(index);
  };

  return (
    <article className="flex h-full min-h-0 flex-col overflow-hidden rounded-[3px] border border-black bg-[#080808] text-white">
      <header className="flex h-11 shrink-0 items-center justify-between gap-4 border-b border-white/12 px-3 md:px-4">
        <div
          className="truncate text-[8px] font-bold uppercase text-white/48"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          source / CONVERGENCE / PSD
        </div>
        <div
          className="shrink-0 text-[8px] font-bold uppercase"
          style={{ color: season.accent, fontFamily: "'JetBrains Mono', monospace" }}
        >
          {freeScan ? "manual view" : `${activeGroup.title} / ${activeGroup.layers} layers`}
        </div>
      </header>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <button
          type="button"
          onClick={advanceFocus}
          onPointerMove={scanComposition}
          onPointerLeave={settleWind}
          aria-label="Explore the Convergence composition"
          className="absolute inset-0 overflow-hidden bg-black text-left outline-none focus-visible:ring-2 focus-visible:ring-inset"
        >
          <VnmcMotionArtwork
            alt="Convergence, the 2026 VNMC full cast artwork"
            className="absolute inset-0"
            style={{
              x: imageX,
              y: imageY,
              transformOrigin: "50% 50%",
              scale: visualZoom,
            }}
            windX={windX}
            windY={windY}
          />
          <Particles
            density={58}
            intensity={0.64}
            className="z-[1] opacity-45 mix-blend-screen"
          />
          <div className="season-ink-grid pointer-events-none absolute inset-0 z-[2] opacity-[0.025]" />
          <div className="pointer-events-none absolute inset-0 z-[2] bg-[linear-gradient(180deg,rgba(0,0,0,0.04)_32%,rgba(0,0,0,0.82)_100%)]" />

          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[3] flex items-end justify-between gap-5 p-4 md:p-5">
            <div>
              <div
                className="text-[8px] font-bold uppercase text-white/48"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                {VNMC_BANNER.psdEntries} PSD entries / {VNMC_BANNER.renderLayers} render layers
              </div>
              <h3
                className="mt-1 text-[24px] font-bold leading-none md:text-[34px]"
                style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "0" }}
              >
                CONVERGENCE
              </h3>
            </div>
            <div
              className="hidden shrink-0 text-right text-[8px] font-bold uppercase text-white/58 sm:block"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              {VNMC_BANNER.canvas}
            </div>
          </div>
        </button>
      </div>

      <div
        onPointerMove={scanTimeline}
        className="relative h-[92px] shrink-0 overflow-hidden border-t border-white/12 bg-[#111111] p-1.5"
      >
        <img
          src={VNMC_BANNER.asset}
          alt=""
          aria-hidden="true"
          draggable={false}
          loading="lazy"
          decoding="async"
          className="h-full w-full select-none object-cover opacity-48 grayscale transition duration-500 hover:opacity-72 hover:grayscale-0"
        />
        <motion.span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-1.5 top-1.5 border bg-white/[0.04] shadow-[0_0_0_1px_rgba(0,0,0,0.45)]"
          style={{
            left: viewfinderLeft,
            width: viewfinderWidth,
            x: "-50%",
            borderColor: season.accent,
          }}
        />

        <div className="absolute inset-x-2 bottom-2 grid grid-cols-5 gap-1">
          {VNMC_BANNER.characterGroups.map((group, index) => {
            const active = index === activeStop && !freeScan;
            return (
              <button
                key={group.id}
                type="button"
                onClick={() => selectGroup(index)}
                aria-label={`Focus ${group.title}, ${group.layers} source layers`}
                aria-pressed={active}
                className="group relative min-w-0 overflow-hidden border-t border-white/20 pt-2 text-left outline-none transition hover:border-white/65 focus-visible:ring-2 focus-visible:ring-inset"
              >
                {active && (
                  <motion.span
                    layoutId="vnmc-banner-group-active"
                    className="absolute inset-x-0 top-0 h-[2px]"
                    style={{ background: season.accent }}
                    transition={{ type: "spring", stiffness: 380, damping: 34 }}
                  />
                )}
                <span
                  className={`block truncate text-[6px] font-bold uppercase sm:text-[7px] ${
                    active ? "text-white" : "text-white/58 group-hover:text-white"
                  }`}
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {group.title}
                </span>
                <span
                  className="mt-1 hidden truncate text-[6px] font-bold uppercase text-white/35 sm:block"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {group.parts.join(" / ")}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </article>
  );
}

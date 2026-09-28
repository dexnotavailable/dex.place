import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import { DEX_ARTWORK } from "../data/dexArtwork";
import { ArtworkSource } from "./ArtworkSource";
import { SectionHeader } from "./SectionHeader";
import { TowakiBuildViewer } from "./TowakiBuildViewer";
import { VnmcBannerViewer } from "./VnmcBannerViewer";
import { VnmcLanFeature } from "./VnmcLanFeature";
import { VucMenhViewer } from "./VucMenhViewer";
import { useSeason } from "./season";

type PortfolioFilter = "ALL" | "EVENT" | "ART" | "GAME" | "TOOL" | "SITE" | "EXP";
type FeatureId = "vnmc" | "artwork" | "vuc-menh" | "towaki" | "vnmc-banner";
type FocusSide = "left" | "right";
type PortfolioCategory = Exclude<PortfolioFilter, "ALL">;

interface FeatureEntry {
  id: FeatureId;
  kind: "feature";
  cat: Extract<PortfolioCategory, "EVENT" | "ART">;
  title: string;
  meta: string;
  image: string;
  focus: FocusSide;
}

interface PlaceholderEntry {
  id: string;
  kind: "placeholder";
  cat: Exclude<PortfolioCategory, "EVENT" | "ART">;
  title: string;
  meta: string;
  number: string;
}

type PortfolioEntry = FeatureEntry | PlaceholderEntry;

const filters: PortfolioFilter[] = ["ALL", "EVENT", "ART"];

const entries: PortfolioEntry[] = [
  {
    id: "vnmc",
    kind: "feature",
    cat: "EVENT",
    title: "VNMC LAN",
    meta: "Hanoi / 21 Jun 2026",
    image: "/assets/portfolio/vnmc-lan/dex-host-stage.jpg",
    focus: "left",
  },
  {
    id: "vnmc-banner",
    kind: "feature",
    cat: "ART",
    title: "CONVERGENCE",
    meta: "full cast artwork / 15360 x 8640 PSD",
    image: "/assets/portfolio/vnmc-banner-2026/banner.webp",
    focus: "right",
  },
  {
    id: "vuc-menh",
    kind: "feature",
    cat: "ART",
    title: "VỰC MỆNH",
    meta: "11 PSD shots / MV artwork",
    image: "/assets/portfolio/vuc-menh/shot-13.webp",
    focus: "left",
  },
  {
    id: "towaki",
    kind: "feature",
    cat: "ART",
    title: "TOWAKI",
    meta: "2 line stacks / 5 build stages",
    image: "/assets/portfolio/towaki/05-final.webp",
    focus: "right",
  },
  {
    id: "artwork",
    kind: "feature",
    cat: "ART",
    title: "dex character concept",
    meta: `${DEX_ARTWORK.paintLayers}-layer PSD / character study`,
    image: DEX_ARTWORK.composites.dark,
    focus: "right",
  },
];

const boardTransition = {
  type: "spring" as const,
  stiffness: 310,
  damping: 34,
  mass: 0.82,
};

const leftRailPlacements = [
  "lg:col-start-9 lg:row-start-1",
  "lg:col-start-11 lg:row-start-1",
  "lg:col-start-9 lg:row-start-2",
  "lg:col-start-11 lg:row-start-2",
  "lg:col-start-9 lg:row-start-3",
  "lg:col-start-11 lg:row-start-3",
  "lg:col-start-9 lg:row-start-4",
  "lg:col-start-11 lg:row-start-4",
];

const rightRailPlacements = [
  "lg:col-start-1 lg:row-start-1",
  "lg:col-start-3 lg:row-start-1",
  "lg:col-start-1 lg:row-start-2",
  "lg:col-start-3 lg:row-start-2",
  "lg:col-start-1 lg:row-start-3",
  "lg:col-start-3 lg:row-start-3",
  "lg:col-start-1 lg:row-start-4",
  "lg:col-start-3 lg:row-start-4",
];

function featureSize(id: FeatureId, activeId: FeatureId | null) {
  if (activeId === id) {
    if (id === "vuc-menh" || id === "vnmc-banner") {
      return "col-span-2 row-span-5 md:col-span-6 md:row-span-5 lg:col-span-8 lg:row-span-4";
    }
    return "col-span-2 row-span-8 md:col-span-6 md:row-span-6 lg:col-span-8 lg:row-span-4";
  }

  if (activeId) {
    return "col-span-1 row-span-1 md:col-span-2 lg:col-span-2";
  }

  if (id === "vnmc") return "col-span-1 row-span-2 md:col-span-2 lg:col-span-5";
  if (id === "artwork") return "col-span-1 row-span-2 md:col-span-2 lg:col-span-3";
  if (id === "towaki") return "col-span-1 row-span-2 md:col-span-2 lg:col-span-3";
  if (id === "vnmc-banner") return "col-span-2 row-span-1 md:col-span-4 md:row-span-2 lg:col-span-7";
  return "col-span-2 row-span-1 md:col-span-2 md:row-span-2 lg:col-span-4";
}

function activePlacement(side: FocusSide) {
  return side === "left"
    ? "z-10 lg:col-start-1 lg:row-start-1"
    : "z-10 lg:col-start-5 lg:row-start-1";
}

function compressedPlacement(side: FocusSide, index: number) {
  const placements = side === "left" ? leftRailPlacements : rightRailPlacements;
  return placements[index] ?? "";
}

function placeholderSize(activeId: FeatureId | null) {
  return activeId
    ? "col-span-1 row-span-1 md:col-span-2 lg:col-span-2"
    : "col-span-1 row-span-1 md:col-span-2 lg:col-span-2";
}

interface FeatureCardProps {
  entry: FeatureEntry;
  compressed: boolean;
  accent: string;
  onOpen: (event: ReactMouseEvent<HTMLButtonElement>) => void;
}

function FeatureCard({ entry, compressed, accent, onOpen }: FeatureCardProps) {
  const isArtwork = entry.id === "artwork";
  const isPortrait = entry.id === "towaki";
  const hasLongTitle = entry.id === "vnmc-banner";

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-expanded={false}
      aria-controls={`portfolio-detail-${entry.id}`}
      className="group relative h-full w-full overflow-hidden rounded-[3px] border border-black/20 bg-[#111111] text-left text-white outline-none transition-colors hover:border-black focus-visible:ring-2 focus-visible:ring-offset-2"
      style={{ outlineColor: accent }}
    >
      <img
        src={entry.image}
        alt=""
        aria-hidden="true"
        draggable={false}
        loading="lazy"
        decoding="async"
        className={`absolute inset-0 h-full w-full transition duration-700 group-hover:scale-[1.035] ${
          isArtwork
            ? "object-contain object-right"
            : isPortrait
              ? "object-cover object-[center_34%]"
              : "object-cover"
        } ${compressed ? "opacity-55 grayscale" : "opacity-90"}`}
      />
      <div
        className={`absolute inset-0 ${
          isArtwork
            ? "bg-[linear-gradient(90deg,rgba(0,0,0,0.92)_0%,rgba(0,0,0,0.35)_58%,rgba(0,0,0,0.04)_100%)]"
            : "bg-[linear-gradient(180deg,rgba(0,0,0,0.06)_20%,rgba(0,0,0,0.84)_100%)]"
        }`}
      />
      {isArtwork && <div className="absolute inset-0 opacity-20 [background-size:18px_18px] [background-image:linear-gradient(45deg,#fff_25%,transparent_25%),linear-gradient(-45deg,#fff_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#fff_75%),linear-gradient(-45deg,transparent_75%,#fff_75%)]" />}

      <motion.span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-1"
        style={{ background: accent }}
        initial={false}
        animate={{ scaleY: compressed ? 0.34 : 1 }}
        transition={boardTransition}
      />

      <div className={`relative flex h-full flex-col justify-between ${compressed ? "p-3" : "p-4 md:p-5"}`}>
        <div className="flex items-start">
          <span
            className="rounded-[2px] border border-white/25 bg-black/35 px-2 py-1 text-[8px] font-bold uppercase text-white/75 backdrop-blur-sm"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            {entry.cat}
          </span>
        </div>

        <div>
          <div
            className={`break-words font-bold leading-[1.02] ${
              compressed
                ? "text-[11px]"
                : hasLongTitle
                  ? "text-[22px] md:text-[30px]"
                  : "text-[26px] md:text-[34px]"
            }`}
            style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "0" }}
          >
            {entry.title}
          </div>
          {!compressed && (
            <div
              className="mt-2 text-[9px] font-bold uppercase text-white/55"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              {entry.meta}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

interface PlaceholderCardProps {
  entry: PlaceholderEntry;
  compressed: boolean;
  accent: string;
}

function PlaceholderCard({ entry, compressed, accent }: PlaceholderCardProps) {
  return (
    <article className="group relative h-full overflow-hidden rounded-[3px] border border-black/15 bg-[#f4f5f7]">
      <div className="season-ink-grid absolute inset-0 opacity-55" />
      <div
        className="absolute inset-y-0 left-0 w-[3px] origin-bottom scale-y-0 transition-transform duration-500 group-hover:scale-y-100"
        style={{ background: accent }}
      />
      <div
        className={`absolute right-3 top-2 font-bold text-black/[0.06] transition duration-500 group-hover:text-black/[0.12] ${
          compressed ? "text-[30px]" : "text-[42px]"
        }`}
        style={{ fontFamily: "'Rubik Mono One', sans-serif" }}
        aria-hidden="true"
      >
        {entry.number}
      </div>
      <div className="relative flex h-full flex-col justify-between p-3">
        <span
          className="w-fit rounded-[2px] border border-black/20 bg-white/70 px-1.5 py-0.5 text-[7px] font-bold uppercase text-black/55"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          {entry.cat}
        </span>
        <div>
          <h4
            className={`font-bold leading-tight text-[#111111] ${compressed ? "text-[12px]" : "text-[14px]"}`}
            style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "0" }}
          >
            {entry.title}
          </h4>
          {!compressed && (
            <div
              className="mt-1 text-[7px] font-bold uppercase text-black/35"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              {entry.meta}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

export function Portfolio() {
  const { season } = useSeason();
  const reduceMotion = useReducedMotion();
  const [filter, setFilter] = useState<PortfolioFilter>("ALL");
  const [activeId, setActiveId] = useState<FeatureId | null>(null);
  const preservedScrollY = useRef<number | null>(null);
  const focusMode = activeId !== null;

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        preservedScrollY.current = window.scrollY;
        setActiveId(null);
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  useLayoutEffect(() => {
    if (!focusMode) return;
    const htmlAnchor = document.documentElement.style.overflowAnchor;
    const bodyAnchor = document.body.style.overflowAnchor;
    document.documentElement.style.overflowAnchor = "none";
    document.body.style.overflowAnchor = "none";
    return () => {
      document.documentElement.style.overflowAnchor = htmlAnchor;
      document.body.style.overflowAnchor = bodyAnchor;
    };
  }, [focusMode]);

  useLayoutEffect(() => {
    const targetY = preservedScrollY.current;
    if (targetY === null) return;

    window.scrollTo({ top: targetY, behavior: "instant" });
    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      window.scrollTo({ top: targetY, behavior: "instant" });
      secondFrame = window.requestAnimationFrame(() => {
        window.scrollTo({ top: targetY, behavior: "instant" });
        preservedScrollY.current = null;
      });
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
    };
  }, [activeId, filter]);

  const filteredEntries = filter === "ALL" ? entries : entries.filter((entry) => entry.cat === filter);
  const focusedEntry = activeId
    ? filteredEntries.find((entry): entry is FeatureEntry => entry.kind === "feature" && entry.id === activeId)
    : undefined;
  const focusSide = focusedEntry?.focus ?? "left";
  const visibleEntries = filteredEntries;
  const compressedEntries = activeId ? visibleEntries.filter((entry) => entry.id !== activeId) : [];

  const setPortfolioFilter = (nextFilter: PortfolioFilter) => {
    preservedScrollY.current = window.scrollY;
    setFilter(nextFilter);
    setActiveId(null);
  };

  const collapseFromSurface = (event: ReactMouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("button, a, input, [data-portfolio-keep-open]")) return;
    preservedScrollY.current = window.scrollY;
    setActiveId(null);
  };

  return (
    <section
      id="portfolio"
      style={{ overflowAnchor: "none" }}
      className={`relative scroll-mt-20 overflow-x-clip border-b border-black/10 bg-white transition-[padding] duration-500 ${
        activeId ? "py-10 md:py-12" : "py-16 md:py-20"
      }`}
    >
      <div className="mx-auto max-w-[1440px] px-5 md:px-10">
        <SectionHeader
          code="PORTFOLIO"
          title="work"
          sub={activeId ? undefined : "Events, illustrations, and process files. Click one to open it."}
          accent={season.accent}
          action={
            <div
              className="flex w-full gap-1 overflow-x-auto rounded-[4px] border border-black/15 bg-[#f2f3f5] p-1 md:w-auto"
              role="group"
              aria-label="Filter portfolio"
            >
              {filters.map((item) => {
                const active = item === filter;
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setPortfolioFilter(item)}
                    aria-pressed={active}
                    className="relative h-8 min-w-0 flex-1 overflow-hidden rounded-[2px] px-1.5 text-[8px] font-bold uppercase text-black/50 outline-none transition hover:text-black focus-visible:ring-2 md:min-w-[46px] md:flex-none md:px-2.5 md:text-[9px]"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    {active && (
                      <motion.span
                        layoutId="portfolio-filter-active"
                        className="absolute inset-0 rounded-[2px]"
                        style={{ background: season.accent }}
                        transition={boardTransition}
                      />
                    )}
                    <span className={`relative ${active ? "text-white" : ""}`}>{item}</span>
                  </button>
                );
              })}
            </div>
          }
        />

        <LayoutGroup id="portfolio-focus-board">
          <motion.div
            layout
            data-portfolio-board
            className="relative isolate grid w-full max-w-full grid-flow-dense auto-rows-[132px] grid-cols-2 gap-2 overflow-x-clip md:auto-rows-[138px] md:grid-cols-6 md:gap-3 lg:grid-cols-12"
          >
            <AnimatePresence initial={false} mode="popLayout">
              {visibleEntries.map((entry) => {
                const isFeature = entry.kind === "feature";
                const isActive = isFeature && activeId === entry.id;
                const compressed = activeId !== null && !isActive;
                const compressedIndex = compressedEntries.findIndex((item) => item.id === entry.id);
                const placement = isActive
                  ? activePlacement(focusSide)
                  : compressed
                    ? compressedPlacement(focusSide, compressedIndex)
                    : "";

                return (
                  <motion.div
                    layout
                    layoutId={`portfolio-cell-${entry.id}`}
                    key={entry.id}
                    data-portfolio-entry={entry.id}
                    className={`relative min-h-0 min-w-0 ${placement} ${compressed ? "hidden lg:block" : ""} ${
                      isFeature ? featureSize(entry.id, activeId) : placeholderSize(activeId)
                    }`}
                    initial={reduceMotion ? false : { opacity: 0, scale: 0.96, y: 14 }}
                    animate={{ opacity: compressed ? 0.78 : 1, scale: 1, y: 0 }}
                    exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: -10 }}
                    transition={reduceMotion ? { duration: 0.01 } : boardTransition}
                  >
                    {isFeature ? (
                      isActive ? (
                        <article
                          id={`portfolio-detail-${entry.id}`}
                          onClick={collapseFromSurface}
                          className="relative h-full overflow-hidden rounded-[3px] bg-white shadow-[0_18px_60px_rgba(17,17,17,0.16)]"
                        >
                          {entry.id === "vnmc" ? (
                            <VnmcLanFeature />
                          ) : entry.id === "artwork" ? (
                            <ArtworkSource />
                          ) : entry.id === "vuc-menh" ? (
                            <VucMenhViewer />
                          ) : entry.id === "towaki" ? (
                            <TowakiBuildViewer />
                          ) : (
                            <VnmcBannerViewer />
                          )}
                        </article>
                      ) : (
                        <FeatureCard
                          entry={entry}
                          compressed={compressed}
                          accent={season.accent}
                          onOpen={(event) => {
                            event.currentTarget.blur();
                            preservedScrollY.current = window.scrollY;
                            setActiveId(entry.id);
                          }}
                        />
                      )
                    ) : (
                      <PlaceholderCard entry={entry} compressed={compressed} accent={season.accent} />
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        </LayoutGroup>
      </div>
    </section>
  );
}

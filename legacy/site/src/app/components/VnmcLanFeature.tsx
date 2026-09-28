import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Disc3, Globe2, Play } from "lucide-react";
import { useSeason } from "./season";

const frames = [
  {
    src: "/assets/portfolio/vnmc-lan/dex-host-stage.jpg",
    label: "Dex on mic",
    note: "host / MC",
    alt: "Dex hosting VNMC SHOWDOWN on stage with white hair and a microphone",
  },
  {
    src: "/assets/portfolio/vnmc-lan/event-group.jpg",
    label: "The room",
    note: "players + crew",
    alt: "VNMC SHOWDOWN players, staff, and audience gathered on the theatre stage",
  },
  {
    src: "/assets/portfolio/vnmc-lan/shot-12.webp",
    label: "Shot 12",
    note: "line art",
    alt: "Line art frame from the VUC MENH Grand Finals tiebreaker music video",
  },
  {
    src: "/assets/portfolio/vnmc-lan/shot-01.webp",
    label: "Shot 01",
    note: "environment",
    alt: "Landscape frame from the VUC MENH Grand Finals tiebreaker music video",
  },
  {
    src: "/assets/portfolio/vnmc-lan/shot-13.webp",
    label: "Shot 13",
    note: "final frame",
    alt: "Purple and green finished frame from the VUC MENH music video",
  },
  {
    src: "/assets/portfolio/vnmc-lan/shot-19.webp",
    label: "Shot 19",
    note: "line art",
    alt: "Red and black action line art from the VUC MENH music video",
  },
  {
    src: "/assets/portfolio/vnmc-lan/shot-20.webp",
    label: "Shot 20",
    note: "final frame",
    alt: "Finished red character close-up from the VUC MENH music video",
  },
  {
    src: "/assets/portfolio/vnmc-lan/shot-23.webp",
    label: "Shot 23",
    note: "final frame",
    alt: "Finished emotional character close-up from the VUC MENH music video",
  },
];

const program = [
  {
    name: "KYO RHYTHM GAME MEET / KRGM",
    hosts: "Lily",
    group: "Rhythm Game Vietnam / RGVN",
  },
  {
    name: "THE MASKED DUEL",
    hosts: "Kura + Astrial",
    group: "Vietnam Niche Corporation",
  },
  {
    name: "VNMC SHOWDOWN HANOI 2026",
    hosts: "Dex + Siv",
    group: "VNMC",
  },
];

const stats = [
  ["21 JUN 2026", "event date"],
  ["~200", "people"],
  ["~80M VND", "budget"],
  ["03", "programs"],
];

const links = [
  {
    label: "Finals VOD",
    href: "https://www.youtube.com/watch?v=x9IS0sv3NcY",
    icon: Play,
  },
  {
    label: "Website",
    href: "https://vnmc.net/",
    icon: Globe2,
  },
  {
    label: "Beatmap",
    href: "https://osu.ppy.sh/beatmapsets/2573138#mania/5728733",
    icon: Disc3,
  },
];

export function VnmcLanFeature() {
  const { season } = useSeason();
  const reduceMotion = useReducedMotion();
  const [activeIndex, setActiveIndex] = useState(0);
  const activeFrame = frames[activeIndex];

  return (
    <motion.article
      id="vnmc-lan"
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-[3px] border border-black bg-white text-[#111111]"
      initial={reduceMotion ? false : { opacity: 0, scale: 0.99 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
    >
      <header className="flex h-10 shrink-0 items-center justify-between gap-3 border-b border-black px-3 pr-14 md:px-4 md:pr-14">
        <div
          className="flex items-center gap-2 text-[8px] font-bold uppercase"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          <span className="h-2 w-2 rounded-full" style={{ background: season.accent }} />
          community event / june 2026
        </div>
        <div
          className="hidden text-[8px] font-bold uppercase text-black/40 sm:block"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          RẠP ĐẠI NAM / HANOI
        </div>
      </header>

      <div className="grid min-h-0 flex-1 md:grid-cols-[minmax(0,1.18fr)_minmax(280px,0.82fr)]">
        <div className="flex min-h-0 flex-col border-b border-black md:border-b-0 md:border-r">
          <button
            id="vnmc-active-frame"
            type="button"
            aria-label={`Show next VNMC frame after ${activeFrame.label}`}
            onClick={() => setActiveIndex((current) => (current + 1) % frames.length)}
            className="relative min-h-[250px] flex-1 overflow-hidden bg-black text-left outline-none focus-visible:ring-2 focus-visible:ring-inset"
          >
            <AnimatePresence initial={false} mode="wait">
              <motion.img
                key={activeFrame.src}
                src={activeFrame.src}
                alt={activeFrame.alt}
                loading="lazy"
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover"
                initial={reduceMotion ? false : { opacity: 0, scale: 1.025, filter: "contrast(1.25)" }}
                animate={{ opacity: 1, scale: 1, filter: "contrast(1)" }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
              />
            </AnimatePresence>
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_54%,rgba(0,0,0,0.78))]" />
            {!reduceMotion && (
              <motion.div
                key={`vnmc-scan-${activeIndex}`}
                className="pointer-events-none absolute inset-x-0 top-0 h-px"
                style={{ background: season.accent }}
                initial={{ y: 0, opacity: 0 }}
                animate={{ y: 320, opacity: [0, 0.85, 0] }}
                transition={{ duration: 0.9, ease: "linear" }}
              />
            )}
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-3 text-white md:p-4">
              <div>
                <div
                  className="text-[7px] font-bold uppercase text-white/50"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  frame {String(activeIndex + 1).padStart(2, "0")} / {String(frames.length).padStart(2, "0")}
                </div>
                <div className="mt-1 text-[16px] font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  {activeFrame.label}
                </div>
              </div>
              <span
                className="rounded-[2px] border border-white/25 bg-black/40 px-2 py-1 text-[7px] font-bold uppercase backdrop-blur-sm"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                {activeFrame.note}
              </span>
            </div>
          </button>

          <div
            className="vnmc-frame-rail flex h-[58px] shrink-0 gap-1.5 overflow-x-auto border-t border-black bg-[#ededed] p-1.5"
            role="group"
            aria-label="VNMC event and music video frames"
          >
            {frames.map((frame, index) => {
              const active = index === activeIndex;
              return (
                <button
                  key={frame.src}
                  type="button"
                  aria-label={`Show ${frame.label}`}
                  aria-pressed={active}
                  aria-controls="vnmc-active-frame"
                  onClick={() => setActiveIndex(index)}
                  onFocus={() => setActiveIndex(index)}
                  onPointerEnter={() => setActiveIndex(index)}
                  className="group relative aspect-video h-full shrink-0 overflow-hidden rounded-[2px] border bg-black outline-none focus-visible:ring-2"
                  style={{ borderColor: active ? season.accent : "rgba(17,17,17,0.22)" }}
                >
                  <img
                    src={frame.src}
                    alt=""
                    aria-hidden="true"
                    loading="lazy"
                    decoding="async"
                    className={`h-full w-full object-cover transition duration-300 ${active ? "opacity-100" : "opacity-52 grayscale group-hover:opacity-100 group-hover:grayscale-0"}`}
                  />
                  <span
                    className="absolute bottom-0.5 left-0.5 bg-black/70 px-1 text-[6px] font-bold text-white"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex min-h-0 flex-col justify-between overflow-hidden p-4 md:p-4 lg:p-5">
          <div>
            <div
              className="text-[8px] font-bold uppercase"
              style={{ color: season.accent, fontFamily: "'JetBrains Mono', monospace" }}
            >
              EVENT LEAD / MAIN HOST
            </div>
            <h3
              className="mt-2 text-[34px] font-bold leading-none lg:text-[40px]"
              style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "0" }}
            >
              VNMC LAN
            </h3>
            <p className="mt-3 text-[14px] font-bold leading-snug text-black/75">
              VNMC LAN was the largest rhythm game event held in Vietnam: one day
              at Rạp Đại Nam in Hanoi, with about 200 people and three community-run
              programs.
            </p>
            <p className="mt-3 text-[10px] leading-relaxed text-black/55 lg:text-[11px]">
              I organized and funded the event, hosted VNMC SHOWDOWN with Siv, and
              helped run the technical side. Siv handled the venue, staff network,
              and community connections.
            </p>

            <div className="mt-3 grid grid-cols-2 border-y border-black/10">
              <div className="border-r border-black/10 py-2 pr-2">
                <div
                  className="text-[7px] font-bold uppercase text-black/35"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  what i did
                </div>
                <p className="mt-1 text-[9px] font-semibold leading-snug text-black/60">
                  Planning, funding, MC, commentary, live tech, website design and code.
                </p>
              </div>
              <div className="py-2 pl-2">
                <div
                  className="text-[7px] font-bold uppercase text-black/35"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  finals tiebreaker
                </div>
                <p className="mt-1 text-[9px] leading-snug text-black/55">
                  Composition, vocals, and most of the MV line art.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {links.map((link) => {
              const Icon = link.icon;
              return (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group/link inline-flex h-8 items-center gap-1.5 rounded-[2px] border border-black/18 px-2 text-[8px] font-bold uppercase text-black/60 transition hover:border-black hover:bg-black hover:text-white focus-visible:ring-2 focus-visible:ring-offset-2"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  <Icon size={11} className="transition-transform group-hover/link:rotate-12" />
                  {link.label}
                </a>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid shrink-0 grid-cols-3 border-t border-black bg-[#111111] text-white">
        {program.map((slot, index) => (
          <div key={slot.name} className={`min-w-0 p-2.5 ${index > 0 ? "border-l border-white/12" : ""}`}>
            <div className="text-[9px] font-bold leading-tight md:text-[10px]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              {slot.name}
            </div>
            <div
              className="mt-1 truncate text-[6px] font-bold uppercase text-white/35"
              title={slot.group}
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              {slot.group}
            </div>
            <div
              className="mt-2 text-[6px] font-bold uppercase text-white/65"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              hosted by {slot.hosts}
            </div>
          </div>
        ))}
      </div>

      <div className="grid h-[54px] shrink-0 grid-cols-4 border-t border-black">
        {stats.map(([value, label], index) => (
          <div key={label} className={`min-w-0 px-2 py-2 ${index > 0 ? "border-l border-black" : ""}`}>
            <div className="truncate text-[14px] font-bold md:text-[16px]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              {value}
            </div>
            <div
              className="mt-0.5 truncate text-[6px] font-bold uppercase text-black/38"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              {label}
            </div>
          </div>
        ))}
      </div>
    </motion.article>
  );
}

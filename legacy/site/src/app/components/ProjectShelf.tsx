import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Archive, Download, ExternalLink } from "lucide-react";
import { KineticButton } from "./KineticControl";
import { Particles } from "./Particles";
import { SectionHeader } from "./SectionHeader";
import { StatusPill } from "./StatusPill";
import { SEASONS, SEASON_ORDER, useSeason, type SeasonKey } from "./season";

const tabs: { key: SeasonKey | "archive"; label: string }[] = [
  ...SEASON_ORDER.map((key) => ({ key, label: SEASONS[key].label })),
  { key: "archive", label: "ARCHIVE" },
];

type ProjectStatus = "Draft" | "Prototype" | "Client";

interface Project {
  code: string;
  name: string;
  tag: string;
  desc: string;
  status: ProjectStatus;
}

const projectsBySeason: Record<SeasonKey, Project[]> = {
  summer26: [
    {
      code: "S26-01",
      name: "REDLINE BREACH",
      tag: "game",
      desc: "A game project currently in development.",
      status: "Prototype",
    },
    {
      code: "S26-02",
      name: "dexCode",
      tag: "tool",
      desc: "A local coding workspace I am building for my own PC.",
      status: "Prototype",
    },
    {
      code: "S26-03",
      name: "dexClient",
      tag: "app",
      desc: "A desktop launcher for my games, tools, and releases.",
      status: "Prototype",
    },
  ],
  autumn26: [],
  winter26: [],
  spring27: [],
};

function makeProjects(seasonKey: SeasonKey | "archive") {
  return seasonKey === "archive"
    ? SEASON_ORDER.flatMap((key) => projectsBySeason[key])
    : projectsBySeason[seasonKey];
}

export function ProjectShelf() {
  const { season, setSeason } = useSeason();
  const reduceMotion = useReducedMotion();
  const [tab, setTab] = useState<SeasonKey | "archive">(season.key);
  const activeSeason = tab === "archive" ? null : SEASONS[tab];
  const activeAccent = activeSeason?.accent ?? "#111111";
  const projects = makeProjects(tab);

  const handleTab = (next: SeasonKey | "archive") => {
    setTab(next);
    if (next !== "archive") setSeason(next);
  };

  return (
    <section
      id="projects"
      className="relative scroll-mt-20 overflow-hidden border-b border-black/10 bg-[#f3f4f6] py-16 md:py-24"
    >
      <Particles density={55} intensity={0.58} className="opacity-55" />
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{ background: activeSeason?.atmosphere ?? season.atmosphere }}
      />

      <div className="relative mx-auto max-w-[1440px] px-5 md:px-10">
        <SectionHeader
          code="PROJECTS"
          title="projects"
          sub="The main things I am working on, grouped by season."
          accent={season.accent}
          action={
            <KineticButton
              label="All seasons"
              accent={season.accent}
              compact
              icon={<Archive size={14} />}
              onClick={() => handleTab("archive")}
            />
          }
        />

        <div className="cut-control mb-8 overflow-hidden border border-black/15 bg-white">
          <div className="relative min-h-[250px] p-5 md:p-8">
            <div className="season-ink-grid absolute inset-0 opacity-70" />
            <div
              className="absolute bottom-0 right-0 top-0 w-[34%] opacity-15"
              style={{
                background: activeAccent,
                clipPath: "polygon(42% 0, 100% 0, 100% 100%, 0 100%)",
              }}
            />

            <AnimatePresence initial={false} mode="wait">
              <motion.div
                key={tab}
                className="relative z-10 grid min-h-[205px] gap-8 md:grid-cols-[1.2fr_0.8fr] md:items-end"
                initial={reduceMotion ? false : { opacity: 0, y: 20, clipPath: "inset(0 0 100% 0)" }}
                animate={{ opacity: 1, y: 0, clipPath: "inset(0 0 0% 0)" }}
                exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -12, clipPath: "inset(100% 0 0 0)" }}
                transition={{ duration: 0.44, ease: [0.16, 1, 0.3, 1] }}
              >
                <div>
                  <div
                    className="mb-4 flex items-center gap-3 text-[9px] font-bold uppercase text-black/50"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    <span style={{ color: activeAccent }}>SEASON</span>
                    <span className="h-px w-8 bg-black/25" />
                    <span>{tab === "archive" ? "ALL SEASONS" : activeSeason?.label}</span>
                  </div>
                  <h3
                    className="text-[48px] leading-[0.84] text-[#111111] sm:text-[72px] md:text-[96px] lg:text-[112px]"
                    style={{ fontFamily: "'Rubik Mono One', sans-serif", letterSpacing: "0" }}
                  >
                    {tab === "archive" ? "ALL" : activeSeason?.short}
                  </h3>
                  <p
                    className="mt-5 text-[10px] font-bold uppercase text-black/45"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    {projects.length > 0
                      ? `${activeSeason?.tag ?? "every season"} / ${projects.length} projects`
                      : "no projects here yet"}
                  </p>
                </div>

                <div className="grid grid-cols-3 border-y border-black/10 bg-white/65">
                  {[
                    ["projects", String(projects.length).padStart(2, "0")],
                    ["period", tab === "archive" ? "all" : activeSeason?.code ?? "all"],
                    ["status", projects.length > 0 ? "current" : "empty"],
                  ].map(([label, value], statIndex) => (
                    <motion.div
                      key={label}
                      className="border-l border-black/10 px-3 py-5 first:border-l-0 md:px-5"
                      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: statIndex * 0.05, duration: 0.32 }}
                    >
                      <div
                        className="text-[8px] font-bold uppercase text-black/35"
                        style={{ fontFamily: "'JetBrains Mono', monospace" }}
                      >
                        {label}
                      </div>
                      <div
                        className="mt-2 truncate text-[20px] font-bold text-[#111111] md:text-[26px]"
                        style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                      >
                        {value}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="flex gap-1 overflow-x-auto border-t border-black/10 bg-white p-2">
            {tabs.map((item) => {
              const active = item.key === tab;
              const itemAccent = item.key === "archive" ? "#111111" : SEASONS[item.key].accent;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => handleTab(item.key)}
                  aria-pressed={active}
                  className="cut-control relative shrink-0 overflow-hidden border border-transparent px-3 py-2 text-[9px] font-bold uppercase text-black/55 transition hover:border-black/15 hover:text-black"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {active && (
                    <motion.span
                      layoutId="season-tab-active"
                      className="absolute inset-0"
                      style={{ background: itemAccent }}
                      transition={{ type: "spring", stiffness: 360, damping: 32 }}
                    />
                  )}
                  <span className={`relative z-10 ${active ? "text-white" : ""}`}>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <motion.div layout className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence initial={false} mode="popLayout">
            {projects.length === 0 ? (
              <motion.div
                key={`${tab}-empty`}
                className="col-span-full border border-black/12 bg-white px-5 py-12 text-center"
                initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <p
                  className="text-[15px] font-semibold text-black/65"
                  style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                >
                  Nothing here yet.
                </p>
              </motion.div>
            ) : projects.map((project, index) => (
              <motion.article
                key={project.code}
                layout
                className="interactive-card cut-control group relative overflow-hidden border border-black/12 bg-white"
                initial={reduceMotion ? false : { opacity: 0, y: 22, rotate: index % 2 === 0 ? -1.5 : 1.5 }}
                animate={{ opacity: 1, y: 0, rotate: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -12 }}
                transition={{ duration: 0.38, delay: reduceMotion ? 0 : index * 0.045 }}
              >
                <div className="relative aspect-[4/5] overflow-hidden border-b border-black/10">
                  <div
                    className="absolute inset-0 transition duration-700 group-hover:scale-110"
                    style={{
                      background: `linear-gradient(145deg, #ffffff 0%, ${activeAccent}22 58%, #e8e9ec 100%)`,
                    }}
                  />
                  <div className="season-ink-grid absolute inset-0 opacity-60" />
                  <div className="absolute inset-x-0 top-0 flex items-center justify-between p-3">
                    <span
                      className="text-[9px] font-bold uppercase text-black/70"
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      {project.code}
                    </span>
                    <StatusPill status={project.status} />
                  </div>
                  <div
                    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[74px] font-bold text-black/[0.08] transition duration-500 group-hover:rotate-12 group-hover:scale-125"
                    style={{ fontFamily: "'Rubik Mono One', sans-serif" }}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </div>
                  <div className="absolute inset-x-0 bottom-0 p-4">
                    <div
                      className="mb-1 text-[9px] font-semibold uppercase text-black/45"
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      {project.tag}
                    </div>
                    <h3
                      className="text-[21px] font-bold leading-none text-[#111111]"
                      style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "0" }}
                    >
                      {project.name}
                    </h3>
                  </div>
                </div>

                <div className="flex flex-col gap-4 p-4">
                  <p className="text-[12px] leading-relaxed text-black/52">{project.desc}</p>
                  <div className="flex items-center justify-between">
                    <span
                      className="text-[9px] font-bold uppercase"
                      style={{ color: activeAccent, fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      in development
                    </span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        disabled
                        aria-label={`${project.name} is not published yet`}
                        title="Not published yet"
                        className="cut-control grid h-8 w-8 cursor-not-allowed place-items-center border border-black/10 text-black/25"
                      >
                        <ExternalLink size={13} />
                      </button>
                      <button
                        type="button"
                        disabled
                        aria-label={`${project.name} download is not published yet`}
                        title="Not published yet"
                        className="cut-control grid h-8 w-8 cursor-not-allowed place-items-center text-black/35"
                        style={{ background: activeAccent + "70" }}
                      >
                        <Download size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.article>
            ))}
          </AnimatePresence>
        </motion.div>
      </div>
    </section>
  );
}

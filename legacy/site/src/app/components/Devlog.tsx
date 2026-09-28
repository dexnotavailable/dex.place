import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowUpRight, FileText, Rows3 } from "lucide-react";
import { KineticButton } from "./KineticControl";
import { SectionHeader } from "./SectionHeader";
import { useSeason } from "./season";
import { Reveal } from "./Reveal";

const entries = [
  {
    date: "SUMMER 2026",
    tag: "SITE",
    project: "dex",
    title: "site notes",
    body: "How this portfolio is built, hosted, and updated.",
  },
  {
    date: "JUNE 2026",
    tag: "EVENT",
    project: "VNMC LAN",
    title: "event notes",
    body: "Planning, funding, production, website work, and what I handled on the day.",
  },
  {
    date: "SUMMER 2026",
    tag: "ART",
    project: "CONVERGENCE",
    title: "artwork notes",
    body: "The cast illustration, its PSD structure, and the way it moves on this site.",
  },
  {
    date: "ONGOING",
    tag: "PROCESS",
    project: "general",
    title: "tools and process",
    body: "Where AI helped, what I made myself, references, experiments, and things that went wrong.",
  },
];

export function Devlog() {
  const { season } = useSeason();
  const reduceMotion = useReducedMotion();
  const [showDetails, setShowDetails] = useState(true);

  return (
    <section id="documentation" className="scroll-mt-20 border-b border-black/10 bg-[#f3f4f6] py-16 md:py-24">
      <div className="mx-auto max-w-[1440px] px-5 md:px-10">
        <SectionHeader
          code="NOTES"
          title="documentation"
          sub="Notes on how the work was made. AI help is credited where it was used."
          accent={season.accent}
          action={
            <KineticButton
              label={showDetails ? "Hide details" : "Show details"}
              accent={season.accent}
              compact
              icon={<Rows3 size={14} />}
              onClick={() => setShowDetails((value) => !value)}
            />
          }
        />

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {entries.map((e, index) => (
            <Reveal key={e.title} delay={index * 0.06} className="h-full">
              <article className="interactive-card cut-control group flex h-full items-start gap-5 border border-black/12 bg-white p-5 md:p-6">
              <div
                className="grid h-12 w-12 shrink-0 place-items-center rounded-sm border"
                style={{
                  borderColor: season.accent + "55",
                  background: season.accent + "10",
                  color: season.accent,
                }}
              >
                <FileText size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div
                  className="flex flex-wrap items-center gap-2 text-[9px] font-bold uppercase text-black/45"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  <span style={{ color: season.accent }}>{e.date}</span>
                  <span className="h-px w-4 bg-black/20" />
                  <span>{e.tag}</span>
                  <span className="h-1 w-1 bg-black/30" />
                  <span className="text-black/65">{e.project}</span>
                </div>
                <h3
                  className="mt-2 text-[#111111]"
                  style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontWeight: 600,
                    fontSize: 20,
                    lineHeight: 1.15,
                    letterSpacing: "0",
                  }}
                >
                  {e.title}
                </h3>
                <AnimatePresence initial={false}>
                  {showDetails && (
                    <motion.p
                      initial={reduceMotion ? false : { opacity: 0, height: 0, y: -6 }}
                      animate={{ opacity: 1, height: "auto", y: 0 }}
                      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0, y: -6 }}
                      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                      className="mt-2 overflow-hidden text-[13px] leading-relaxed text-black/52"
                    >
                      {e.body}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
              <ArrowUpRight
                size={18}
                className="mt-1 shrink-0 text-black/35 transition group-hover:-translate-y-1 group-hover:translate-x-1 group-hover:text-black"
              />
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

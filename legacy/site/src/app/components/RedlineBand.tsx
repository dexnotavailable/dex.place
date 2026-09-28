import { Gamepad2 } from "lucide-react";
import { KineticLink } from "./KineticControl";
import { Particles } from "./Particles";
import { useSeason } from "./season";
import { StatusPill } from "./StatusPill";

export function RedlineBand() {
  const { season } = useSeason();

  return (
    <section className="relative overflow-hidden border-b border-white/10 bg-black">
      <div className="relative mx-auto grid max-w-[1440px] grid-cols-1 md:grid-cols-[1.1fr_1fr]">
        <div className="redline-media group relative min-h-[380px] overflow-hidden md:min-h-[560px]">
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(135deg, rgba(255,255,255,0.06), ${season.accent}24 42%, rgba(0,0,0,0.96))`,
            }}
          />
          <div
            className="absolute inset-0 opacity-50"
            style={{
              backgroundImage:
                "repeating-linear-gradient(0deg, rgba(255,255,255,0.045) 0 1px, transparent 1px 4px)",
            }}
          />
          <Particles density={70} />
          <div className="absolute left-6 top-6 flex items-center gap-2">
            <StatusPill status="Draft" />
            <span
              className="rounded-sm border border-white/20 bg-black/50 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white/70"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              game / {season.code}
            </span>
          </div>
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[120px] font-bold text-white/10 transition duration-700 group-hover:scale-125 group-hover:rotate-12 md:text-[180px]"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            01
          </div>
          <div
            className="absolute bottom-6 left-6 text-[10px] font-bold uppercase tracking-[0.3em] text-white/60"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            screenshots will be added later
          </div>
        </div>

        <div className="relative flex flex-col justify-center border-t border-white/10 bg-[#0b0b0c] p-8 md:border-l md:border-t-0 md:p-14">
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{ background: season.atmosphere }}
          />
          <div className="relative">
            <div
              className="mb-3 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.28em]"
              style={{ color: season.accent, fontFamily: "'JetBrains Mono', monospace" }}
            >
              CURRENT GAME
              <span className="h-px w-8" style={{ background: season.accent, opacity: 0.45 }} />
            </div>
            <h2
              className="text-white"
              style={{
                fontFamily: "'Rubik Mono One', sans-serif",
                fontSize: "clamp(40px, 5.5vw, 76px)",
                lineHeight: 0.9,
              }}
            >
              REDLINE
              <br />
              <span style={{ color: season.accent }}>BREACH</span>
            </h2>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-white/65">
              A game project I am currently building. Screenshots, notes, and a public
              build will be added when they are ready.
            </p>

            <div className="mt-8 grid grid-cols-3 gap-4 border-y border-white/10 py-5">
              {[
                ["type", "game"],
                ["status", "in dev"],
                ["build", "private"],
              ].map(([label, value]) => (
                <div key={label}>
                  <div
                    className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    {label}
                  </div>
                  <div
                    className="mt-1 text-white"
                    style={{
                      fontFamily: "'Space Grotesk', sans-serif",
                      fontWeight: 700,
                      fontSize: 26,
                    }}
                  >
                    {value}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <KineticLink label="More projects" href="#projects" accent={season.accent} />
              <button
                type="button"
                disabled
                title="No public build yet"
                className="cut-control flex h-14 cursor-not-allowed items-center gap-2 border border-white/20 px-5 text-[11px] font-bold uppercase text-white/35"
              >
                <Gamepad2 size={14} /> No public build
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

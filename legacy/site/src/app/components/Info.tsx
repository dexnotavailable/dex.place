import { DexMark } from "./DexMark";
import { useSeason } from "./season";
import { Reveal } from "./Reveal";

export function Info() {
  const { season } = useSeason();
  return (
    <section id="info" className="relative scroll-mt-20 border-b border-black/10 bg-white">
      <div
        className="flex h-9 items-center border-b border-black/10 px-5 text-[8px] font-bold uppercase text-black/40 md:px-10"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        <span style={{ color: season.accent }}>01</span>
        <span className="mx-3 h-px w-6 bg-black/20" />
        info / about
      </div>
      <div className="mx-auto grid max-w-[1440px] grid-cols-1 gap-10 px-5 py-16 md:grid-cols-[1fr_1.4fr] md:px-10 md:py-24">
        <Reveal>
          <div
            className="mb-3 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.28em]"
            style={{ color: season.accent, fontFamily: "'JetBrains Mono', monospace" }}
          >
            ABOUT
            <span className="h-px w-8" style={{ background: season.accent, opacity: 0.4 }} />
          </div>
          <h2
            className="text-[#111111]"
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 700,
              fontSize: 42,
              lineHeight: 0.95,
              letterSpacing: "0",
            }}
          >
            hi, im <DexMark size={62} />.
          </h2>
        </Reveal>
        <Reveal delay={0.08}>
          <p
            className="max-w-2xl text-black/78"
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 24,
              lineHeight: 1.4,
              letterSpacing: "0",
            }}
          >
            hi, im dex. i make games, tools, art, websites, and whatever else
            catches my attention.
            <br />
            <span className="text-black/45">thats it, basically.</span>
          </p>

          <div className="mt-8 grid grid-cols-2 border-t border-black/10 pt-6 sm:grid-cols-4">
            {[
              ["current season", season.code],
              ["main projects", "03"],
              ["site", "dex.place"],
              ["work", "art + code"],
            ].map(([l, v]) => (
              <div key={l} className="info-stat border-l border-black/10 px-4 first:border-l-0 first:pl-0">
                <div
                  className="text-[9px] font-bold uppercase text-black/40"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {l}
                </div>
                <div
                  className="mt-1 text-[#111111]"
                  style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontWeight: 700,
                    fontSize: 32,
                    letterSpacing: "0",
                  }}
                >
                  {v}
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

import { SEASONS, SEASON_ORDER, useSeason } from "./season";

export function SeasonSwitcher() {
  const { season, setSeason } = useSeason();
  return (
    <div
      className="fixed bottom-5 left-1/2 z-40 hidden -translate-x-1/2 items-center gap-1 rounded-sm border border-white/15 bg-black/80 p-1 shadow-2xl backdrop-blur-xl md:flex"
      style={{ boxShadow: `0 10px 40px ${season.glow}` }}
    >
      <span
        className="hidden px-3 text-[10px] font-bold uppercase tracking-[0.24em] text-white/40 md:inline"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        weather //
      </span>
      {SEASON_ORDER.map((k) => {
        const s = SEASONS[k];
        const active = season.key === k;
        return (
          <button
            key={k}
            onClick={() => setSeason(k)}
            className="flex items-center gap-2 rounded-sm px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em] transition"
            style={{
              color: active ? "#000" : "rgba(255,255,255,0.65)",
              background: active ? s.accent : "transparent",
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: active ? "#000" : s.accent }}
            />
            {s.short}
          </button>
        );
      })}
    </div>
  );
}

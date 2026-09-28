import { useSeason } from "./season";

type Status = "Draft" | "Prototype" | "Playable" | "Client" | "Coming soon" | "Installed" | "Community";

const styleMap: Record<Status, { color: string; border: string; bg: string }> = {
  Draft: { color: "#a1a1aa", border: "#a1a1aa55", bg: "#a1a1aa12" },
  Prototype: { color: "#f0a020", border: "#f0a02055", bg: "#f0a02015" },
  Playable: { color: "#4ade80", border: "#4ade8055", bg: "#4ade8015" },
  Client: { color: "#ffffff", border: "#ffffff40", bg: "#ffffff10" },
  "Coming soon": { color: "#a1a1aa", border: "#a1a1aa55", bg: "#a1a1aa15" },
  Installed: { color: "#6ab8ff", border: "#6ab8ff55", bg: "#6ab8ff15" },
  Community: { color: "#dc1f33", border: "#dc1f3355", bg: "#dc1f3315" },
};

export function StatusPill({ status, seasonal }: { status: Status; seasonal?: boolean }) {
  const { season } = useSeason();
  const s = seasonal
    ? { color: season.accent, border: season.accent + "55", bg: season.accent + "15" }
    : styleMap[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em]"
      style={{
        color: s.color,
        borderColor: s.border,
        background: s.bg,
        fontFamily: "'JetBrains Mono', monospace",
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />
      {status}
    </span>
  );
}

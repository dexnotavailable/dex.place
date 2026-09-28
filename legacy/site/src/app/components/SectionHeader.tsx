import { Reveal } from "./Reveal";

interface Props {
  code: string;
  title: string;
  sub?: string;
  action?: React.ReactNode;
  accent?: string;
  tone?: "light" | "dark";
}

export function SectionHeader({
  code,
  title,
  sub,
  action,
  accent = "#111111",
  tone = "light",
}: Props) {
  const titleColor = tone === "dark" ? "text-white" : "text-[#111111]";
  const subColor = tone === "dark" ? "text-white/55" : "text-black/55";

  return (
    <Reveal className="mb-8 md:mb-10" amount={0.35}>
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div
            className="mb-3 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.28em]"
            style={{ fontFamily: "'JetBrains Mono', monospace", color: accent }}
          >
            <span>{code}</span>
            <span className="h-px w-8" style={{ background: accent, opacity: 0.4 }} />
          </div>
          <h2
            className={`${titleColor} text-[32px] md:text-[48px]`}
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 700,
              lineHeight: 0.95,
              letterSpacing: "0",
            }}
          >
            {title}
          </h2>
          {sub && <p className={`mt-3 max-w-xl text-[14px] ${subColor}`}>{sub}</p>}
        </div>
        {action && <div>{action}</div>}
      </div>
    </Reveal>
  );
}

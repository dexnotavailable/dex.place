import { DexMark } from "./DexMark";
import { useSeason } from "./season";

export function Footer() {
  const { season } = useSeason();
  const columns = [
    {
      t: "SITE",
      l: [
        { label: "About", href: "#info" },
        { label: "Projects", href: "#projects" },
        { label: "Portfolio", href: "#portfolio" },
      ],
    },
    {
      t: "WORK",
      l: [
        { label: "REDLINE BREACH", href: "#projects" },
        { label: "dexCode", href: "#projects" },
        { label: "dexClient", href: "#projects" },
      ],
    },
    {
      t: "LINKS",
      l: [
        { label: "VNMC", href: "https://vnmc.net/", external: true },
        { label: "Ko-fi", href: "https://ko-fi.com/dexdonation", external: true },
        {
          label: "VNMC finals",
          href: "https://www.youtube.com/watch?v=x9IS0sv3NcY",
          external: true,
        },
      ],
    },
  ];

  return (
    <footer className="relative border-t border-white/10 bg-black">
      <div className="mx-auto max-w-[1440px] px-5 py-14 md:px-10">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-5">
          <div className="col-span-2">
            <div className="flex items-center gap-2">
              <DexMark size={44} />
            </div>
            <p className="mt-4 max-w-xs text-[13px] leading-relaxed text-white/50">
              games, tools, art, events, and notes by dex.
            </p>
          </div>

          {columns.map((column) => (
            <div key={column.t}>
              <div
                className="mb-4 text-[10px] font-bold uppercase tracking-[0.24em]"
                style={{ color: season.accent, fontFamily: "'JetBrains Mono', monospace" }}
              >
                {column.t}
              </div>
              <ul className="space-y-2">
                {column.l.map((item) => (
                  <li key={item.label}>
                    <a
                      href={item.href}
                      target={item.external ? "_blank" : undefined}
                      rel={item.external ? "noopener noreferrer" : undefined}
                      className="text-[13px] text-white/60 transition hover:text-white"
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div
          className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-white/10 pt-6 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40 md:flex-row md:items-center"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: season.accent }} />
              {season.label}
            </span>
            <span className="h-px w-6 bg-white/20" />
            <span>made by dex</span>
          </div>
          <span>dex.place</span>
        </div>
      </div>
    </footer>
  );
}

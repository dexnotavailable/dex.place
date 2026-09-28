import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Download, LogIn, Menu, Search, X } from "lucide-react";
import { DexMark } from "./DexMark";
import { KineticLink } from "./KineticControl";
import { useSeason } from "./season";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";

const items = [
  { label: "Info", href: "#info", code: "01" },
  { label: "Projects", href: "#projects", code: "02" },
  { label: "Portfolio", href: "#portfolio", code: "03" },
  { label: "Notes", href: "#documentation", code: "04" },
];

const switcherItems = [
  ...items,
  { label: "Support", href: "#support", code: "05" },
];

export function Nav() {
  const { season } = useSeason();
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [activeHref, setActiveHref] = useState("#top");
  const navigationIntentRef = useRef<string | null>(null);
  const navigationReleaseTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const targets = switcherItems
      .map((item) => document.querySelector(item.href))
      .filter((target): target is Element => Boolean(target));
    const intersections = new Map(targets.map((target) => [target, 0]));

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          intersections.set(entry.target, entry.isIntersecting ? entry.intersectionRatio : 0);
        }

        const intentHref = navigationIntentRef.current;
        if (intentHref) {
          const intentTarget = document.querySelector(intentHref);
          if (!intentTarget) {
            navigationIntentRef.current = null;
          } else {
            const scrollMarginTop = Number.parseFloat(
              window.getComputedStyle(intentTarget).scrollMarginTop
            );
            const settledTop = Number.isFinite(scrollMarginTop) ? scrollMarginTop : 64;
            const targetTop = intentTarget.getBoundingClientRect().top;

            if (Math.abs(targetTop - settledTop) <= 12) {
              navigationIntentRef.current = null;
            } else {
              return;
            }
          }
        }

        const active = [...intersections.entries()].sort((a, b) => b[1] - a[1])[0];

        if (active && active[1] > 0 && active[0].id) setActiveHref(`#${active[0].id}`);
      },
      {
        rootMargin: "-18% 0px -66% 0px",
        threshold: [0, 0.15, 0.35, 0.6],
      }
    );

    for (const target of targets) observer.observe(target);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const releaseNavigationIntent = () => {
      navigationIntentRef.current = null;
      if (navigationReleaseTimerRef.current !== null) {
        window.clearTimeout(navigationReleaseTimerRef.current);
        navigationReleaseTimerRef.current = null;
      }
    };
    const releaseOnManualKey = (event: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"].includes(event.key)) {
        releaseNavigationIntent();
      }
    };

    window.addEventListener("wheel", releaseNavigationIntent, { passive: true });
    window.addEventListener("touchstart", releaseNavigationIntent, { passive: true });
    window.addEventListener("scrollend", releaseNavigationIntent);
    window.addEventListener("keydown", releaseOnManualKey);
    return () => {
      window.removeEventListener("wheel", releaseNavigationIntent);
      window.removeEventListener("touchstart", releaseNavigationIntent);
      window.removeEventListener("scrollend", releaseNavigationIntent);
      window.removeEventListener("keydown", releaseOnManualKey);
      releaseNavigationIntent();
    };
  }, []);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;
      const wantsSwitcher =
        (!isTyping && event.key === "/") ||
        ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k");

      if (!wantsSwitcher) return;
      event.preventDefault();
      setSwitcherOpen(true);
    };

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  const activate = (href: string) => {
    navigationIntentRef.current = href;
    if (navigationReleaseTimerRef.current !== null) {
      window.clearTimeout(navigationReleaseTimerRef.current);
    }
    navigationReleaseTimerRef.current = window.setTimeout(() => {
      navigationIntentRef.current = null;
      navigationReleaseTimerRef.current = null;
    }, 2200);
    setActiveHref(href);
    setOpen(false);
    setSwitcherOpen(false);
  };

  return (
    <Dialog open={switcherOpen} onOpenChange={setSwitcherOpen}>
      <header className="sticky top-0 z-50 border-b border-black/10 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-5 md:px-10">
          <div className="flex items-center gap-8">
            <a href="#top" aria-label="dex home" onClick={() => activate("#top")} className="flex items-center gap-2">
              <DexMark size={38} />
            </a>
            <nav className="hidden items-center gap-1 md:flex" aria-label="Primary navigation">
              {items.map((item) => {
                const active = activeHref === item.href;
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={() => activate(item.href)}
                    aria-current={active ? "location" : undefined}
                    className={`cut-control relative px-3 py-2 text-[12px] font-semibold uppercase transition ${
                      active ? "bg-black/[0.05] text-black" : "text-black/55 hover:bg-black/[0.04] hover:text-black"
                    }`}
                    style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                  >
                    {item.label}
                    {active && (
                      <motion.span
                        layoutId="nav-active-line"
                        className="absolute inset-x-3 -bottom-[1px] h-[2px]"
                        style={{ background: season.accent, boxShadow: `0 0 12px ${season.glow}` }}
                        transition={{ type: "spring", stiffness: 420, damping: 34 }}
                      />
                    )}
                  </a>
                );
              })}
            </nav>
          </div>

          <div className="hidden items-center gap-2 md:flex">
            <DialogTrigger asChild>
              <button
                type="button"
                aria-label="Open section switcher"
                title="Open section switcher"
                className="cut-control grid h-9 w-9 place-items-center border border-black/15 bg-white text-black/65 transition hover:border-black hover:bg-black hover:text-white"
              >
                <Search size={15} />
              </button>
            </DialogTrigger>
            <button
              type="button"
              disabled
              title="Dex profiles are planned, not live yet"
              className="cut-control flex h-9 cursor-not-allowed items-center gap-2 border border-black/15 px-3 text-[11px] font-semibold uppercase text-black/35"
            >
              <LogIn size={13} /> Sign In
            </button>
            <KineticLink
              label="Download dexClient"
              accent={season.accent}
              href="/downloads/dexClient-Setup-0.1.0.exe"
              download="dexClient-Setup-0.1.0.exe"
              compact
              icon={<Download size={14} />}
            />
          </div>

          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            className="cut-control grid h-9 w-9 place-items-center border border-black/15 text-black md:hidden"
          >
            {open ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden border-t border-black/10 bg-white md:hidden"
            >
              <nav className="flex flex-col gap-1 px-5 py-4" aria-label="Mobile navigation">
                {items.map((item) => {
                  const active = activeHref === item.href;
                  return (
                    <a
                      key={item.href}
                      href={item.href}
                      onClick={() => activate(item.href)}
                      className="cut-control flex items-center justify-between px-3 py-3 text-[12px] font-semibold uppercase text-black/70"
                      style={{
                        color: active ? season.accent : undefined,
                        background: active ? season.accent + "10" : undefined,
                        fontFamily: "'Space Grotesk', sans-serif",
                      }}
                    >
                      {item.label}
                      <span className="text-[9px] text-black/30" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                        {item.code}
                      </span>
                    </a>
                  );
                })}
                <div className="mt-3 flex flex-col gap-2 border-t border-black/10 pt-3">
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      setSwitcherOpen(true);
                    }}
                    className="cut-control flex h-10 items-center justify-center gap-2 border border-black/20 px-3 text-[11px] font-semibold uppercase text-black"
                  >
                    <Search size={13} /> Search
                  </button>
                  <button
                    type="button"
                    disabled
                    className="cut-control flex h-10 cursor-not-allowed items-center justify-center gap-2 border border-black/15 px-3 text-[11px] font-semibold uppercase text-black/35"
                  >
                    <LogIn size={13} /> Sign In
                  </button>
                  <a
                    href="/downloads/dexClient-Setup-0.1.0.exe"
                    download="dexClient-Setup-0.1.0.exe"
                    className="cut-control flex h-10 items-center justify-center gap-2 border border-black/20 px-4 text-[11px] font-bold uppercase text-black transition hover:bg-black hover:text-white"
                  >
                    <Download size={13} /> Download dexClient
                  </a>
                </div>
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <DialogContent
        onCloseAutoFocus={(event) => event.preventDefault()}
        className="z-[80] max-w-[560px] gap-0 overflow-hidden rounded-none border-black/20 bg-white p-0 text-black shadow-[18px_22px_0_rgba(0,0,0,0.16)] [&_[data-slot=dialog-overlay]]:z-[70]"
      >
        <div className="season-ink-grid border-b border-black/10 p-6">
          <div
            className="text-[10px] font-bold uppercase tracking-[0.22em]"
            style={{ color: season.accent, fontFamily: "'JetBrains Mono', monospace" }}
          >
            SECTIONS
          </div>
          <DialogTitle
            className="mt-3 text-[30px] font-bold leading-none"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            go to
          </DialogTitle>
          <DialogDescription className="sr-only">Navigate to a section of the dex site.</DialogDescription>
        </div>
        <div className="p-2">
          {switcherItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={() => activate(item.href)}
              className="cut-control group flex items-center justify-between border border-transparent px-4 py-4 transition hover:border-black/10 hover:bg-black/[0.04]"
            >
              <span className="text-[17px] font-semibold text-black/75 transition group-hover:text-black" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                {item.label}
              </span>
              <span
                className="text-[10px] font-bold text-black/25 transition group-hover:text-black/60"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                {item.code}
              </span>
            </a>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

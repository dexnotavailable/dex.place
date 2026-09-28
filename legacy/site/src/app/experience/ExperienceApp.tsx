import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from "react-router";
import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import CloseRounded from "@mui/icons-material/CloseRounded";
import ReplayRounded from "@mui/icons-material/ReplayRounded";
import { ART_STAGES, DexArtworkStage, TowakiArtworkStage } from "./ArtworkStages";
import { YukiMorph, type YukiMode } from "./YukiMorph";
import { useSectionProgress } from "./useSectionProgress";

const SP13_STAGES = [
  {
    label: "TERRAIN",
    src: "/assets/projects/sp13/dawnward-terrain.png",
    note: "raw literal-block basin",
  },
  {
    label: "PLAN",
    src: "/assets/projects/sp13/dawnward-survey.png",
    note: "survey grid and ghost plan",
  },
  {
    label: "BUILD",
    src: "/assets/projects/sp13/dawnward-construction.png",
    note: "literal cubic construction",
  },
  {
    label: "VISION",
    src: "/assets/projects/sp13/vision/dawnward-vision.png",
    note: "Dawnward Basinlands vision",
  },
] as const;

const HOME_CHAPTERS = [
  ["dexcode", "dexCode"],
  ["sp13", "SP13"],
  ["artwork", "Artwork"],
  ["vnmc", "VNMC LAN"],
] as const;

const INDEX_ITEMS = [
  {
    group: "CURRENT / SUMMER 2026",
    number: "01",
    title: "dexCode",
    state: "PREVIEW",
    href: "/projects/dexcode",
    preview: "/assets/hero/wet-ink-observatory.png",
  },
  {
    group: "CURRENT / SUMMER 2026",
    number: "02",
    title: "SP13",
    state: "VISION",
    href: "/projects/sp13",
    preview: "/assets/projects/sp13/dawnward-construction.png",
  },
  {
    group: "ART",
    number: "03",
    title: "DEX / TOWAKI",
    state: "PROCESS",
    href: "/art",
    preview: "/assets/portfolio/towaki/05-final.webp",
  },
  {
    group: "ARCHIVE",
    number: "04",
    title: "VNMC LAN",
    state: "HANOI · 2026",
    href: "/archive/vnmc-lan",
    preview: "/assets/portfolio/vnmc-lan/event-group.jpg",
  },
] as const;

export function ExperienceApp() {
  return (
    <BrowserRouter>
      <ExperienceRouter />
    </BrowserRouter>
  );
}

function ExperienceRouter() {
  const location = useLocation();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const previousPath = useRef(location.pathname);
  const [indexOpen, setIndexOpen] = useState(false);
  const [introDone, setIntroDone] = useState(() => {
    if (location.pathname !== "/") return true;
    return window.sessionStorage.getItem("dex:intro-seen") === "1";
  });
  const [introRun, setIntroRun] = useState(0);

  useEffect(() => {
    const previous = previousPath.current;
    if (previous === "/" && location.pathname !== "/") {
      window.sessionStorage.setItem("dex:home-scroll", String(window.scrollY));
      window.sessionStorage.setItem("dex:restore-home", "1");
      window.scrollTo({ top: 0 });
    } else if (previous !== location.pathname) {
      window.scrollTo({ top: 0 });
    }
    previousPath.current = location.pathname;
    setIndexOpen(false);
    document.title = location.pathname === "/" ? "dex — summer 2026" : `dex — ${routeTitle(location.pathname)}`;
  }, [location.pathname]);

  useEffect(() => {
    if (location.pathname !== "/") setIntroDone(true);
  }, [location.pathname]);

  const completeIntro = () => {
    window.sessionStorage.setItem("dex:intro-seen", "1");
    setIntroDone(true);
  };

  const replayIntro = () => {
    navigate("/");
    window.scrollTo({ top: 0 });
    setIntroRun((value) => value + 1);
    setIntroDone(false);
    setIndexOpen(false);
  };

  return (
    <div className="dex-experience" data-route={location.pathname}>
      <PersistentChrome
        visible={introDone}
        onOpenIndex={() => setIndexOpen(true)}
        onReplay={replayIntro}
      />

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={location.pathname}
          className="route-frame"
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.28, ease: [0.16, 1, 0.3, 1] }}
        >
          <RouteFocus pathname={location.pathname} />
          <Routes location={location}>
            <Route path="/" element={<HomeExperience />} />
            <Route path="/projects/dexcode" element={<DexCodeRecord />} />
            <Route path="/projects/sp13" element={<Sp13Record />} />
            <Route path="/art" element={<ArtIndex />} />
            <Route path="/art/:slug" element={<ArtworkRecord />} />
            <Route path="/archive" element={<ArchiveIndex />} />
            <Route path="/archive/vnmc-lan" element={<VnmcLanRecord />} />
            <Route path="/index" element={<DirectoryPage />} />
            <Route path="/info" element={<InfoPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {indexOpen && (
          <IndexOverlay onClose={() => setIndexOpen(false)} onReplay={replayIntro} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!introDone && location.pathname === "/" && (
          <Intro key={introRun} onComplete={completeIntro} />
        )}
      </AnimatePresence>
    </div>
  );
}

function RouteFocus({ pathname }: { pathname: string }) {
  useEffect(() => {
    if (pathname === "/") return;
    const frame = window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(".route-frame main h1")?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  return null;
}

function routeTitle(pathname: string) {
  if (pathname.includes("dexcode")) return "dexCode";
  if (pathname.includes("sp13")) return "SP13";
  if (pathname.includes("vnmc")) return "VNMC LAN";
  if (pathname.startsWith("/art")) return "art";
  if (pathname.startsWith("/archive")) return "archive";
  if (pathname.startsWith("/index")) return "index";
  return "summer 2026";
}

function Intro({ onComplete }: { onComplete: () => void }) {
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const sources = [
      "/assets/hero/wet-ink-observatory.png",
      "/assets/projects/dexcode/yuki/idle.png",
      "/assets/hero/brush/ink-arc.webp",
    ];
    let cancelled = false;
    const start = performance.now();
    const preload = sources.map(
      (source) =>
        new Promise<void>((resolve) => {
          const image = new Image();
          image.onload = () => resolve();
          image.onerror = () => resolve();
          image.src = source;
        }),
    );

    Promise.all(preload).then(() => {
      const elapsed = performance.now() - start;
      const minimum = reduceMotion ? 80 : 2050;
      window.setTimeout(() => {
        if (!cancelled) onComplete();
      }, Math.max(0, minimum - elapsed));
    });

    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onComplete();
    };
    window.addEventListener("keydown", escape);
    return () => {
      cancelled = true;
      window.removeEventListener("keydown", escape);
    };
  }, [onComplete, reduceMotion]);

  return (
    <motion.div
      className="intro"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduceMotion ? 0.01 : 0.72, ease: [0.7, 0, 0.84, 0] }}
    >
      <div className="intro__mark" aria-label="dex">
        <img src="/assets/brand/dex-mark-black.svg" alt="dex" />
        <span aria-hidden="true" />
      </div>
      <img className="intro__splash" src="/assets/hero/brush/ink-arc.webp" alt="" aria-hidden="true" />
      <button type="button" onClick={onComplete} aria-label="Skip introduction">SKIP</button>
    </motion.div>
  );
}

interface ChromeProps {
  visible: boolean;
  onOpenIndex: () => void;
  onReplay: () => void;
}

function PersistentChrome({ visible, onOpenIndex, onReplay }: ChromeProps) {
  const location = useLocation();
  const onHome = location.pathname === "/";
  const [activeChapter, setActiveChapter] = useState(0);

  useEffect(() => {
    if (!onHome) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const midpoint = window.innerHeight * 0.5;
      let nearest = 0;
      let distance = Number.POSITIVE_INFINITY;
      HOME_CHAPTERS.forEach(([id], index) => {
        const element = document.getElementById(id);
        if (!element) return;
        const bounds = element.getBoundingClientRect();
        const candidate = Math.abs(bounds.top + Math.min(bounds.height, window.innerHeight) * 0.5 - midpoint);
        if (candidate < distance) {
          nearest = index;
          distance = candidate;
        }
      });
      setActiveChapter((current) => (current === nearest ? current : nearest));
    };
    const requestMeasure = () => {
      if (!frame) frame = window.requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", requestMeasure, { passive: true });
    window.addEventListener("resize", requestMeasure);
    return () => {
      window.removeEventListener("scroll", requestMeasure);
      window.removeEventListener("resize", requestMeasure);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [onHome]);

  if (!visible) return null;

  const seek = (id: string) => {
    if (!onHome) return;
    window.history.pushState({ dexChapter: id }, "", `/#${id}`);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(id)?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  };

  return (
    <header className="site-chrome">
      <Link to="/" className="site-chrome__mark" aria-label="Return to current exhibition">
        <img src="/assets/brand/dex-mark-white.svg" alt="dex" />
      </Link>

      {onHome && (
        <nav className="chapter-rail" aria-label="Summer 2026 chapters">
          <span>{String(activeChapter + 1).padStart(2, "0")} / 04</span>
          {HOME_CHAPTERS.map(([id, label], index) => (
            <button
              key={id}
              type="button"
              onClick={() => seek(id)}
              aria-label={`Go to ${label}`}
              aria-current={activeChapter === index ? "step" : undefined}
            />
          ))}
        </nav>
      )}

      <div className="site-chrome__actions">
        <button type="button" className="site-chrome__replay" onClick={onReplay} aria-label="Replay introduction">
          <ReplayRounded fontSize="small" />
        </button>
        <button
          type="button"
          className="site-chrome__index"
          onClick={onOpenIndex}
          aria-label="Open site index"
        >
          INDEX
        </button>
      </div>
    </header>
  );
}

function HomeExperience() {
  const location = useLocation();

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (location.hash) {
        document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: "auto", block: "start" });
      } else if (window.sessionStorage.getItem("dex:restore-home") === "1") {
        const stored = Number(window.sessionStorage.getItem("dex:home-scroll") ?? 0);
        window.scrollTo({ top: stored });
      }
      window.sessionStorage.removeItem("dex:restore-home");
    });
    return () => window.cancelAnimationFrame(frame);
  }, [location.hash]);

  return (
    <main className="home-exhibition">
      <DexCodeChapter />
      <Sp13Chapter />
      <ArtworkChapter />
      <VnmcChapter />
      <ClosingField />
    </main>
  );
}

function DexCodeChapter() {
  const section = useRef<HTMLElement>(null);
  const progress = useSectionProgress(section);
  const [focused, setFocused] = useState(false);
  const mode: YukiMode = progress < 0.2 ? "orb" : progress < 0.7 ? "app" : "music";

  return (
    <section id="dexcode" ref={section} className="guided-chapter dexcode-chapter">
      <div className="chapter-sticky dexcode-stage">
        <img
          src="/assets/hero/wet-ink-observatory.png"
          className="dexcode-stage__world"
          alt=""
          aria-hidden="true"
          style={{ opacity: 0.78 + progress * 0.12 }}
        />
        <img src="/assets/hero/brush/motion-streaks.webp" className="weather-streak weather-streak--one" alt="" aria-hidden="true" />
        <img src="/assets/hero/brush/ink-arc.webp" className="dexcode-stage__ink" alt="" aria-hidden="true" />
        <img src="/assets/brand/dex-mark-white.svg" className="dexcode-stage__signature" alt="" aria-hidden="true" />

        <div className="dexcode-stage__meta">
          <span>SUMMER 2026</span>
          <span>01 / 04</span>
        </div>

        <YukiMorph mode={mode} focused={focused} onFocusedChange={setFocused} />

        <div className="chapter-hint" aria-hidden="true">
          <span>SCROLL TO TRANSFORM</span>
          <i />
        </div>
      </div>
    </section>
  );
}

function Sp13Chapter() {
  const section = useRef<HTMLElement>(null);
  const progress = useSectionProgress(section);
  const [manualStage, setManualStage] = useState<number | null>(null);
  const automaticStage = Math.min(3, Math.floor(progress * 4));
  const stage = manualStage ?? automaticStage;

  useEffect(() => {
    if (progress < 0.03 || progress > 0.97) setManualStage(null);
  }, [progress]);

  return (
    <section id="sp13" ref={section} className="guided-chapter sp13-chapter">
      <div className={`chapter-sticky sp13-stage ${progress > 0.94 ? "is-withdrawing" : ""}`}>
        <div className="sp13-stage__media">
          {SP13_STAGES.map((item, index) => (
            <img
              key={`${item.label}-${item.src}`}
              src={item.src}
              alt={index === stage ? `SP13 ${item.note}` : ""}
              aria-hidden={index !== stage}
              className={index === stage ? "is-visible" : ""}
              loading="lazy"
              decoding="async"
            />
          ))}
          <div className="sp13-stage__veil" />
        </div>

        <Link to="/projects/sp13" className="sp13-stage__title">
          <span>SUMMER 2026</span>
          <strong role="heading" aria-level={2}>SP13</strong>
          <em>VISION · IN DEVELOPMENT</em>
        </Link>

        <div className="sp13-stage__rail" role="group" aria-label="SP13 vision states">
          {SP13_STAGES.map((item, index) => (
            <button
              key={item.label}
              type="button"
              aria-pressed={stage === index}
              onClick={() => setManualStage(index)}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{item.label}</strong>
            </button>
          ))}
        </div>

        <div className="sp13-stage__line" aria-hidden="true" />
      </div>
    </section>
  );
}

function ArtworkChapter() {
  const section = useRef<HTMLElement>(null);
  const progress = useSectionProgress(section);
  const [manualStage, setManualStage] = useState<number | null>(null);
  const stage = manualStage ?? Math.min(3, Math.floor(progress * 4));

  useEffect(() => {
    if (progress < 0.03 || progress > 0.97) setManualStage(null);
  }, [progress]);

  return (
    <section id="artwork" ref={section} className="guided-chapter artwork-chapter">
      <div className="chapter-sticky artwork-stage-home">
        <DexArtworkStage stage={stage} onStageChange={setManualStage} />
        <Link to="/art/dex" className="artwork-stage-home__record">OPEN ARTWORK RECORD</Link>
      </div>
    </section>
  );
}

function VnmcChapter() {
  return (
    <section id="vnmc" className="vnmc-chapter">
      <div className="vnmc-chapter__sticky">
        <img src="/assets/portfolio/vnmc-banner-2026/banner.webp" alt="The 2026 VNMC cast artwork" />
        <div className="vnmc-chapter__shade" />
        <Link to="/archive/vnmc-lan" className="vnmc-chapter__title">
          <span>ARCHIVE · HANOI · 2026</span>
          <strong role="heading" aria-level={2}>VNMC LAN</strong>
        </Link>
        <div className="vnmc-chapter__timeline" aria-hidden="true" />
      </div>
    </section>
  );
}

function ClosingField() {
  return (
    <footer className="closing-field">
      <img src="/assets/brand/dex-mark-white.svg" alt="dex" />
      <div>
        <Link to="/info">INFO</Link>
        <Link to="/index">INDEX</Link>
      </div>
    </footer>
  );
}

function IndexOverlay({ onClose, onReplay }: { onClose: () => void; onReplay: () => void }) {
  const [preview, setPreview] = useState(INDEX_ITEMS[0].preview);
  const overlay = useRef<HTMLElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const openedAt = `${window.location.pathname}${window.location.hash}`;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab" || !overlay.current) return;
      const focusable = Array.from(
        overlay.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), [tabindex]:not([tabindex='-1'])"),
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      if (`${window.location.pathname}${window.location.hash}` === openedAt) previousFocus?.focus();
    };
  }, [onClose]);

  return (
    <motion.aside
      ref={overlay}
      className="index-overlay"
      initial={reduceMotion ? false : { clipPath: "inset(0 0 100% 0)" }}
      animate={{ clipPath: "inset(0 0 0 0)" }}
      exit={{ clipPath: "inset(0 0 100% 0)" }}
      transition={{ duration: reduceMotion ? 0 : 0.62, ease: [0.16, 1, 0.3, 1] }}
      role="dialog"
      aria-modal="true"
      aria-label="Site index"
    >
      <img src={preview} className="index-overlay__preview" alt="" aria-hidden="true" />
      <div className="index-overlay__shade" />
      <header>
        <img src="/assets/brand/dex-mark-white.svg" alt="dex" />
        <button ref={closeButton} type="button" onClick={onClose} aria-label="Close index"><CloseRounded /></button>
      </header>

      <nav>
        {INDEX_ITEMS.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            onPointerEnter={() => setPreview(item.preview)}
            onFocus={() => setPreview(item.preview)}
            onClick={onClose}
          >
            <span>{item.group}</span>
            <i>{item.number}</i>
            <strong>{item.title}</strong>
            <em>{item.state}</em>
          </Link>
        ))}
      </nav>

      <footer>
        <button type="button" onClick={onReplay}><ReplayRounded fontSize="small" /> REPLAY</button>
        <Link to="/info" onClick={onClose}>INFO</Link>
      </footer>
    </motion.aside>
  );
}

function RecordShell({ eyebrow, title, state, children }: {
  eyebrow: string;
  title: string;
  state: string;
  children: ReactNode;
}) {
  return (
    <main className="record-page">
      <header className="record-page__header">
        <Link to="/" aria-label="Return to the Summer 2026 exhibition"><ArrowBackRounded /></Link>
        <div>
          <span>{eyebrow}</span>
          <h1 tabIndex={-1}>{title}</h1>
        </div>
        <em>{state}</em>
      </header>
      {children}
    </main>
  );
}

function DexCodeRecord() {
  const [focused, setFocused] = useState(true);
  return (
    <RecordShell eyebrow="SUMMER 2026" title="dexCode" state="PREVIEW · IN DEVELOPMENT">
      <section className="dexcode-record">
        <img src="/assets/hero/wet-ink-observatory.png" alt="" aria-hidden="true" />
        <YukiMorph mode="app" focused={focused} onFocusedChange={setFocused} />
      </section>
      <section className="record-notes">
        <div><span>STATE</span><strong>INTERACTIVE PREVIEW</strong></div>
        <div><span>SURFACES</span><strong>CHAT · MUSIC · SITE ACTIONS</strong></div>
        <div><span>BOUNDARY</span><strong>BROWSER-LOCAL / ALLOWLISTED</strong></div>
      </section>
    </RecordShell>
  );
}

function Sp13Record() {
  const [stage, setStage] = useState(0);
  return (
    <RecordShell eyebrow="SUMMER 2026" title="SP13" state="VISION · IN DEVELOPMENT">
      <section className="sp13-record">
        <div className="sp13-record__media">
          {SP13_STAGES.map((item, index) => (
            <img
              key={`${item.label}-record`}
              src={item.src}
              alt={index === stage ? `SP13 ${item.note}` : ""}
              aria-hidden={index !== stage}
              className={index === stage ? "is-visible" : ""}
            />
          ))}
        </div>
        <div className="sp13-record__controls">
          {SP13_STAGES.map((item, index) => (
            <button key={item.label} type="button" aria-pressed={stage === index} onClick={() => setStage(index)}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{item.label}</strong>
              <em>{item.note}</em>
            </button>
          ))}
        </div>
      </section>
      <section className="sp13-current-proof">
        <img src="/assets/projects/sp13/vision/current-overview.png" alt="Current literal-block SP13 Unity world proof" />
        <div><span>CURRENT BUILD</span><strong>literal cubic terrain · logistics routes · construction state</strong></div>
      </section>
    </RecordShell>
  );
}

function ArtIndex() {
  return (
    <RecordShell eyebrow="ART" title="Artwork" state="PROCESS INDEX">
      <section className="art-index">
        <Link to="/art/dex">
          <img src="/assets/art/dex/source-composite.webp" alt="Dex character artwork" />
          <span>01</span><strong>DEX</strong><em>LINE · COLOR · SHADE · EFFECTS</em>
        </Link>
        <Link to="/art/towaki">
          <img src="/assets/portfolio/towaki/05-final.webp" alt="Towaki character artwork" />
          <span>02</span><strong>TOWAKI</strong><em>LINE · COLOR · SHADE · EFFECTS</em>
        </Link>
      </section>
    </RecordShell>
  );
}

function ArtworkRecord() {
  const { slug } = useParams();
  const [stage, setStage] = useState(0);
  const towaki = slug === "towaki";

  if (slug !== "dex" && slug !== "towaki") return <Navigate to="/art" replace />;

  return (
    <RecordShell eyebrow="ARTWORK" title={towaki ? "TOWAKI" : "DEX"} state={ART_STAGES[stage]}>
      <section className="artwork-record">
        {towaki ? (
          <TowakiArtworkStage stage={stage} onStageChange={setStage} />
        ) : (
          <DexArtworkStage stage={stage} onStageChange={setStage} />
        )}
      </section>
    </RecordShell>
  );
}

function ArchiveIndex() {
  return (
    <RecordShell eyebrow="ARCHIVE" title="Records" state="DOCUMENTARY INDEX">
      <section className="archive-index">
        <Link to="/archive/vnmc-lan">
          <img src="/assets/portfolio/vnmc-lan/event-group.jpg" alt="VNMC LAN players, staff, and audience on stage" />
          <div><span>HANOI · 21 JUN 2026</span><strong>VNMC LAN</strong><em>EVENT · MEDIA · DOCUMENTATION</em></div>
        </Link>
      </section>
    </RecordShell>
  );
}

const vnmcFrames = [
  { src: "event-group.jpg", label: "THE ROOM", alt: "VNMC LAN players, staff, and audience on stage" },
  { src: "dex-host-stage.jpg", label: "DEX ON MIC", alt: "Dex hosting VNMC SHOWDOWN on stage" },
  { src: "shot-12.webp", label: "VỰC MỆNH · LINE", alt: "Line-art frame from the VỰC MỆNH finals tiebreaker music video" },
  { src: "shot-01.webp", label: "VỰC MỆNH · WORLD", alt: "Landscape frame from the VỰC MỆNH finals tiebreaker music video" },
  { src: "shot-13.webp", label: "VỰC MỆNH · FINAL 13", alt: "Purple and green finished frame from the VỰC MỆNH music video" },
  { src: "shot-19.webp", label: "VỰC MỆNH · LINE 19", alt: "Red and black action line art from the VỰC MỆNH music video" },
  { src: "shot-20.webp", label: "VỰC MỆNH · FINAL 20", alt: "Finished red character close-up from the VỰC MỆNH music video" },
  { src: "shot-23.webp", label: "VỰC MỆNH · FINAL 23", alt: "Finished emotional character close-up from the VỰC MỆNH music video" },
] as const;

const vnmcPrograms = [
  { title: "KYO RHYTHM GAME MEET / KRGM", group: "RHYTHM GAME VIETNAM / RGVN", host: "LILY" },
  { title: "THE MASKED DUEL", group: "VIETNAM NICHE CORPORATION", host: "KURA + ASTRIAL" },
  { title: "VNMC SHOWDOWN HANOI 2026", group: "VNMC", host: "DEX + SIV" },
] as const;

function VnmcLanRecord() {
  const [active, setActive] = useState(0);
  const frame = vnmcFrames[active];
  return (
    <RecordShell eyebrow="ARCHIVE · HANOI · 2026" title="VNMC LAN" state="DOCUMENTARY RECORD">
      <section className="vnmc-record">
        <div className="vnmc-record__media">
          <img src={`/assets/portfolio/vnmc-lan/${frame.src}`} alt={frame.alt} />
          <span>{frame.label}</span>
        </div>
        <div className="vnmc-record__rail">
          {vnmcFrames.map((item, index) => (
            <button
              key={item.src}
              type="button"
              aria-label={`Show ${item.label}`}
              aria-pressed={active === index}
              onClick={() => setActive(index)}
            >
              <img src={`/assets/portfolio/vnmc-lan/${item.src}`} alt="" aria-hidden="true" />
              <span>{String(index + 1).padStart(2, "0")}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="vnmc-document">
        <div><span>DATE</span><strong>21 JUN 2026</strong></div>
        <div><span>ROOM</span><strong>RẠP ĐẠI NAM · HANOI</strong></div>
        <div><span>ATTENDANCE</span><strong>~200 PEOPLE</strong></div>
        <div><span>BUDGET</span><strong>~80M VND · 03 PROGRAMS</strong></div>
        <p>
          One community-run day joining KYO Rhythm Game Meet, The Masked Duel, and VNMC Showdown.
          Dex organized and funded the event, hosted VNMC SHOWDOWN with Siv, and helped run the live technical side.
          Siv handled the venue, staff network, and community connections.
        </p>
        <nav>
          <a href="https://www.youtube.com/watch?v=x9IS0sv3NcY" target="_blank" rel="noreferrer">FINALS VOD</a>
          <a href="https://vnmc.net/" target="_blank" rel="noreferrer">VNMC.NET</a>
          <a href="https://osu.ppy.sh/beatmapsets/2573138#mania/5728733" target="_blank" rel="noreferrer">BEATMAP</a>
        </nav>
      </section>

      <section className="vnmc-ledger" aria-labelledby="vnmc-program-title">
        <header>
          <span id="vnmc-program-title">PROGRAM</span>
          <strong>03 / COMMUNITY RUN</strong>
        </header>
        {vnmcPrograms.map((program, index) => (
          <article key={program.title}>
            <i>{String(index + 1).padStart(2, "0")}</i>
            <strong>{program.title}</strong>
            <span>{program.group}</span>
            <em>HOSTED BY {program.host}</em>
          </article>
        ))}
      </section>

      <section className="vnmc-credits" aria-label="VNMC LAN credits">
        <div><span>DEX</span><strong>PLANNING · FUNDING · HOST · COMMENTARY · LIVE TECH · WEBSITE</strong></div>
        <div><span>SIV</span><strong>VENUE · STAFF NETWORK · COMMUNITY CONNECTIONS</strong></div>
        <div><span>VỰC MỆNH</span><strong>FINALS TIEBREAKER · COMPOSITION · VOCALS · MOST MV LINE ART</strong></div>
      </section>
    </RecordShell>
  );
}

function DirectoryPage() {
  return (
    <RecordShell eyebrow="INDEX" title="Everything" state="SUMMER 2026">
      <section className="directory-page">
        {INDEX_ITEMS.map((item) => (
          <Link key={item.href} to={item.href}>
            <span>{item.group}</span><i>{item.number}</i><strong>{item.title}</strong><em>{item.state}</em>
          </Link>
        ))}
      </section>
    </RecordShell>
  );
}

function InfoPage() {
  return (
    <RecordShell eyebrow="INFO" title="dex" state="CREATOR · SUMMER 2026">
      <section className="info-page">
        <p>games, tools, artwork, and community records.</p>
        <div><span>CURRENT</span><strong>dexCode · SP13</strong></div>
        <div><span>ARCHIVE</span><strong>VNMC LAN · ARTWORK</strong></div>
      </section>
    </RecordShell>
  );
}

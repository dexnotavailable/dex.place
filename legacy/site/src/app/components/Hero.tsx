import {
  useEffect,
  useMemo,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  type PanInfo,
} from "motion/react";
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
} from "lucide-react";
import { Particles } from "./Particles";
import { useSeason } from "./season";

interface ProjectFrame {
  src: string;
  alt: string;
  label: string;
  position: string;
  mobilePosition?: string;
  scale?: number;
}

interface FeaturedProject {
  id: string;
  title: string;
  state: string;
  tone: "light" | "dark";
  frames: ProjectFrame[];
}

const PROJECT_DURATION = 11_500;
const FRAME_DURATION = 2_800;
const DEXCODE_PROMPT = "keep watching while i open another app.";

const projects: FeaturedProject[] = [
  {
    id: "dexcode",
    title: "dexCode",
    state: "local build",
    tone: "light",
    frames: [
      {
        src: "/assets/projects/dexcode/home.png",
        alt: "The dexCode Yuki home workspace",
        label: "workspace",
        position: "50% 46%",
        mobilePosition: "58% 46%",
        scale: 1.025,
      },
      {
        src: "/assets/projects/dexcode/conversation.png",
        alt: "A populated dexCode conversation and focused composer",
        label: "response",
        position: "54% 50%",
        mobilePosition: "66% 50%",
        scale: 1.055,
      },
      {
        src: "/assets/projects/dexcode/settings.png",
        alt: "The dexCode appearance settings menu",
        label: "settings",
        position: "50% 49%",
        mobilePosition: "53% 49%",
        scale: 1.035,
      },
    ],
  },
  {
    id: "dexsmp",
    title: "dexSMP",
    state: "hosted world",
    tone: "dark",
    frames: [
      {
        src: "/assets/projects/dexsmp/spawn.png",
        alt: "The live dexSMP forest spawn",
        label: "spawn",
        position: "50% 51%",
        mobilePosition: "58% 51%",
        scale: 1.05,
      },
      {
        src: "/assets/projects/dexsmp/world-map.png",
        alt: "A rendered overview of the dexSMP world",
        label: "world",
        position: "50% 52%",
        mobilePosition: "55% 50%",
        scale: 1.12,
      },
      {
        src: "/assets/projects/dexsmp/arena-overview.jpg",
        alt: "The dark dexSMP test arena viewed from the stands",
        label: "arena",
        position: "50% 50%",
        mobilePosition: "50% 50%",
        scale: 1.06,
      },
      {
        src: "/assets/projects/dexsmp/arena-entry.jpg",
        alt: "The entrance floor of the dexSMP test arena",
        label: "arena floor",
        position: "50% 50%",
        mobilePosition: "50% 50%",
        scale: 1.075,
      },
    ],
  },
  {
    id: "sp13",
    title: "SP13",
    state: "coming soon",
    tone: "dark",
    frames: [
      {
        src: "/assets/projects/sp13/turntable-menu.png",
        alt: "The SP13 voxel kingdom turntable menu",
        label: "preview",
        position: "50% 50%",
        mobilePosition: "54% 50%",
        scale: 1.035,
      },
    ],
  },
];

function normalizeIndex(value: number) {
  return (value + projects.length) % projects.length;
}

export function Hero() {
  const [projectIndex, setProjectIndex] = useState(0);
  const [frameIndex, setFrameIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [paused, setPaused] = useState(false);
  const [typedPrompt, setTypedPrompt] = useState("");
  const reduceMotion = useReducedMotion();
  const { season } = useSeason();
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const sceneX = useSpring(rawX, { stiffness: 90, damping: 24, mass: 0.72 });
  const sceneY = useSpring(rawY, { stiffness: 90, damping: 24, mass: 0.72 });

  const project = projects[projectIndex];
  const frame = project.frames[frameIndex] ?? project.frames[0];
  const lightScene = project.tone === "light";

  const allSources = useMemo(
    () => projects.flatMap((item) => item.frames.map((itemFrame) => itemFrame.src)),
    []
  );

  useEffect(() => {
    for (const src of allSources) {
      const image = new Image();
      image.src = src;
    }
  }, [allSources]);

  useEffect(() => {
    setFrameIndex(0);
  }, [projectIndex]);

  useEffect(() => {
    if (paused || reduceMotion || project.frames.length < 2) return;
    const timer = window.setTimeout(() => {
      setFrameIndex((value) => (value + 1) % project.frames.length);
    }, FRAME_DURATION);
    return () => window.clearTimeout(timer);
  }, [frameIndex, paused, project.frames.length, projectIndex, reduceMotion]);

  useEffect(() => {
    if (paused || reduceMotion) return;
    const timer = window.setTimeout(() => {
      setDirection(1);
      setProjectIndex((value) => normalizeIndex(value + 1));
    }, PROJECT_DURATION);
    return () => window.clearTimeout(timer);
  }, [paused, projectIndex, reduceMotion]);

  useEffect(() => {
    if (project.id !== "dexcode" || frameIndex !== 0) {
      setTypedPrompt("");
      return;
    }
    if (reduceMotion) {
      setTypedPrompt(DEXCODE_PROMPT);
      return;
    }

    let cursor = 0;
    let interval = 0;
    setTypedPrompt("");
    const delay = window.setTimeout(() => {
      interval = window.setInterval(() => {
        cursor += 1;
        setTypedPrompt(DEXCODE_PROMPT.slice(0, cursor));
        if (cursor >= DEXCODE_PROMPT.length) window.clearInterval(interval);
      }, 34);
    }, 440);

    return () => {
      window.clearTimeout(delay);
      window.clearInterval(interval);
    };
  }, [frameIndex, project.id, reduceMotion]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable
      ) {
        return;
      }

      if (event.key === "ArrowLeft") selectProject(projectIndex - 1, -1);
      if (event.key === "ArrowRight") selectProject(projectIndex + 1, 1);
      if (event.key === " ") {
        event.preventDefault();
        setPaused((value) => !value);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const selectProject = (next: number, nextDirection?: number) => {
    const normalized = normalizeIndex(next);
    setDirection(nextDirection ?? (normalized > projectIndex ? 1 : -1));
    setProjectIndex(normalized);
  };

  const moveScene = (event: ReactPointerEvent<HTMLElement>) => {
    if (reduceMotion) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    rawX.set(x * -14);
    rawY.set(y * -9);
  };

  const resetScene = () => {
    rawX.set(0);
    rawY.set(0);
  };

  const finishDrag = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const committed = Math.abs(info.offset.x) > 80 || Math.abs(info.velocity.x) > 520;
    if (!committed) return;
    if (info.offset.x < 0) selectProject(projectIndex + 1, 1);
    else selectProject(projectIndex - 1, -1);
  };

  const projectMotion = reduceMotion
    ? { initial: false as const, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: {
          opacity: 0,
          x: direction * 80,
          clipPath:
            direction > 0
              ? "polygon(12% 0, 100% 0, 88% 100%, 0 100%)"
              : "polygon(0 0, 88% 0, 100% 100%, 12% 100%)",
        },
        animate: {
          opacity: 1,
          x: 0,
          clipPath: "polygon(0 0, 100% 0, 100% 100%, 0 100%)",
        },
        exit: {
          opacity: 0,
          x: direction * -60,
          clipPath:
            direction > 0
              ? "polygon(0 0, 88% 0, 100% 100%, 12% 100%)"
              : "polygon(12% 0, 100% 0, 88% 100%, 0 100%)",
        },
      };

  return (
    <section
      id="top"
      aria-label="Featured projects"
      className="relative h-[calc(100svh-88px)] min-h-[480px] overflow-hidden border-b border-black/10 bg-black"
      onPointerMove={moveScene}
      onPointerLeave={resetScene}
    >
      <motion.div
        className="absolute inset-0 touch-pan-y overflow-hidden"
        drag={reduceMotion ? false : "x"}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.08}
        onDragEnd={finishDrag}
      >
        <AnimatePresence initial={false} mode="sync" custom={direction}>
          <motion.div
            key={project.id}
            className="absolute inset-0 overflow-hidden"
            {...projectMotion}
            transition={{ duration: 0.78, ease: [0.16, 1, 0.3, 1] }}
          >
            <AnimatePresence initial={false} mode="sync">
              <motion.div
                key={frame.src}
                className="absolute inset-[-2%] overflow-hidden"
                initial={
                  reduceMotion
                    ? false
                    : {
                        opacity: 0,
                        scale: 1.075,
                        clipPath: "inset(0 100% 0 0)",
                      }
                }
                animate={{ opacity: 1, scale: 1, clipPath: "inset(0 0% 0 0)" }}
                exit={
                  reduceMotion
                    ? { opacity: 0 }
                    : {
                        opacity: 0,
                        scale: 1.035,
                        clipPath: "inset(0 0 0 100%)",
                      }
                }
                transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
              >
                <motion.img
                  src={frame.src}
                  alt={frame.alt}
                  draggable={false}
                  className={`hero-project-media h-full w-full select-none object-cover ${
                    project.id === "sp13"
                      ? "grayscale brightness-[0.27] contrast-[1.12]"
                      : ""
                  }`}
                  style={{
                    x: sceneX,
                    y: sceneY,
                    scale: frame.scale ?? 1,
                    objectPosition: frame.position,
                    ["--mobile-position" as string]: frame.mobilePosition ?? frame.position,
                  }}
                />
              </motion.div>
            </AnimatePresence>

            {project.id === "sp13" && (
              <div className="pointer-events-none absolute inset-0 bg-black/34" />
            )}

            <div
              className={`pointer-events-none absolute inset-0 ${
                lightScene
                  ? "bg-[linear-gradient(180deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0)_43%,rgba(0,0,0,0.78)_100%)]"
                  : "bg-[linear-gradient(180deg,rgba(0,0,0,0.22)_0%,rgba(0,0,0,0)_42%,rgba(0,0,0,0.84)_100%)]"
              }`}
            />

            <AnimatePresence>
              {project.id === "dexcode" && frameIndex === 0 && (
                <motion.div
                  className="pointer-events-none absolute left-5 right-5 top-[57%] z-20 w-auto border border-[#e31f3d]/45 bg-white/94 px-3 py-2 text-[10px] text-black shadow-[0_16px_40px_rgba(0,0,0,0.12)] backdrop-blur-md md:left-1/2 md:right-auto md:top-[58%] md:w-[48%] md:-translate-x-1/2 md:px-4 md:py-3 md:text-[12px]"
                  initial={reduceMotion ? false : { opacity: 0, y: 14, scale: 0.985 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 1.01 }}
                  transition={{ duration: 0.36 }}
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  <span className="mr-2 text-[#e31f3d]">&gt;</span>
                  {typedPrompt}
                  <span className="hero-typing-caret ml-0.5 inline-block h-[1em] w-px bg-[#e31f3d] align-[-2px]" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </AnimatePresence>
      </motion.div>

      <Particles density={82} intensity={0.72} className="z-10 opacity-55 mix-blend-screen" />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between p-5 md:p-8">
        <div
          className={`text-[9px] font-bold uppercase ${
            lightScene ? "text-black/58" : "text-white/72"
          }`}
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          {String(projectIndex + 1).padStart(2, "0")} / {String(projects.length).padStart(2, "0")}
        </div>
        <AnimatePresence initial={false} mode="wait">
          <motion.div
            key={`${project.id}-${frame.label}`}
            className={`text-[9px] font-bold uppercase ${
              lightScene ? "text-black/52" : "text-white/62"
            }`}
            initial={reduceMotion ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            {frame.label}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 px-5 pb-[98px] md:px-9 md:pb-[112px] lg:px-12">
        <AnimatePresence initial={false} mode="wait">
          <motion.div
            key={project.id}
            className="max-w-[760px] text-white"
            initial={reduceMotion ? false : { opacity: 0, y: 48 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -28 }}
            transition={{ duration: 0.58, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
            aria-live="polite"
          >
            <div
              className="mb-2 flex items-center gap-3 text-[9px] font-bold uppercase text-white/68"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              <span className="h-2 w-2" style={{ background: season.accent }} />
              {project.state}
            </div>
            <a
              href="#projects"
              className="pointer-events-auto group inline-flex items-end gap-3 text-white outline-none"
              aria-label={`View ${project.title} in the projects section`}
            >
              <h1
                className="text-[48px] font-bold leading-[0.88] sm:text-[64px] md:text-[82px]"
                style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "0" }}
              >
                {project.title}
              </h1>
              <ArrowUpRight
                className="mb-1.5 opacity-55 transition duration-300 group-hover:-translate-y-1 group-hover:translate-x-1 group-hover:opacity-100"
                size={22}
              />
            </a>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-30 border-t border-white/20 bg-black/52 backdrop-blur-xl">
        <div className="mx-auto flex h-[76px] max-w-[1440px] items-center gap-3 px-5 md:h-[88px] md:px-9 lg:px-12">
          <div className="flex min-w-0 flex-1 items-stretch overflow-hidden">
            {projects.map((item, index) => {
              const active = index === projectIndex;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectProject(index)}
                  aria-pressed={active}
                  className="group relative flex min-w-0 flex-1 items-center gap-1 px-1 text-left text-white sm:gap-3 sm:px-2 md:px-4"
                >
                  <span
                    className={`hidden text-[9px] font-bold transition sm:inline ${
                      active ? "text-white" : "text-white/32 group-hover:text-white/62"
                    }`}
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span
                    className={`min-w-0 whitespace-nowrap text-[11px] font-semibold transition sm:text-[13px] md:text-[15px] ${
                      active ? "text-white" : "text-white/45 group-hover:text-white/78"
                    }`}
                    style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                  >
                    {item.title}
                  </span>
                  <span className="absolute inset-x-1 bottom-0 h-px bg-white/14 sm:inset-x-2 md:inset-x-4">
                    {active && (
                      <motion.span
                        key={`${item.id}-${paused}`}
                        className="block h-full origin-left"
                        style={{ background: season.accent }}
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: paused || reduceMotion ? 0.12 : 1 }}
                        transition={{ duration: paused || reduceMotion ? 0.2 : PROJECT_DURATION / 1000, ease: "linear" }}
                      />
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="ml-1 flex shrink-0 items-center border-l border-white/16 pl-1 sm:gap-1 sm:pl-3 md:ml-3 md:pl-5">
            <button
              type="button"
              onClick={() => selectProject(projectIndex - 1, -1)}
              aria-label="Previous project"
              title="Previous project"
              className="grid h-8 w-8 place-items-center rounded-full text-white/62 transition hover:bg-white hover:text-black focus-visible:bg-white focus-visible:text-black md:h-9 md:w-9"
            >
              <ChevronLeft size={17} />
            </button>
            <button
              type="button"
              onClick={() => setPaused((value) => !value)}
              aria-label={paused ? "Play project reel" : "Pause project reel"}
              title={paused ? "Play project reel" : "Pause project reel"}
              className="grid h-8 w-8 place-items-center rounded-full text-white/62 transition hover:bg-white hover:text-black focus-visible:bg-white focus-visible:text-black md:h-9 md:w-9"
            >
              {paused ? <Play size={15} /> : <Pause size={15} />}
            </button>
            <button
              type="button"
              onClick={() => selectProject(projectIndex + 1, 1)}
              aria-label="Next project"
              title="Next project"
              className="grid h-8 w-8 place-items-center rounded-full text-white/62 transition hover:bg-white hover:text-black focus-visible:bg-white focus-visible:text-black md:h-9 md:w-9"
            >
              <ChevronRight size={17} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

import { useEffect, useRef, useState, type FormEvent, type PointerEvent } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useReducedMotion } from "motion/react";
import AddRounded from "@mui/icons-material/AddRounded";
import ArrowUpwardRounded from "@mui/icons-material/ArrowUpwardRounded";
import CloseRounded from "@mui/icons-material/CloseRounded";
import OpenInNewRounded from "@mui/icons-material/OpenInNewRounded";
import PauseRounded from "@mui/icons-material/PauseRounded";
import PlayArrowRounded from "@mui/icons-material/PlayArrowRounded";

export type YukiMode = "orb" | "app" | "music";

interface YukiMorphProps {
  mode: YukiMode;
  focused?: boolean;
  onFocusedChange?: (focused: boolean) => void;
  className?: string;
}

type YukiExpression = "idle" | "thinking" | "talking";

const expressionAssets: Record<YukiExpression, string> = {
  idle: "/assets/projects/dexcode/yuki/idle.png",
  thinking: "/assets/projects/dexcode/yuki/thinking.png",
  talking: "/assets/projects/dexcode/yuki/talking.png",
};

function scrollToChapter(id: string) {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.getElementById(id)?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
}

export function YukiMorph({ mode, focused = false, onFocusedChange, className = "" }: YukiMorphProps) {
  const root = useRef<HTMLDivElement>(null);
  const portrait = useRef<HTMLButtonElement>(null);
  const timers = useRef<number[]>([]);
  const reduceMotion = useReducedMotion();
  const [query, setQuery] = useState("");
  const [expression, setExpression] = useState<YukiExpression>("idle");
  const [surface, setSurface] = useState<"conversation" | "music">(
    mode === "music" ? "music" : "conversation",
  );
  const [playing, setPlaying] = useState(false);
  const [reply, setReply] = useState("try rain, embers, music, SP13, artwork, or YouTube");
  const [externalLink, setExternalLink] = useState<string | null>(null);

  const effectiveSurface = mode === "music" ? "music" : surface;
  const expanded = mode !== "orb" || focused;
  const shellClass = `yuki-morph yuki-morph--${
    expanded ? (effectiveSurface === "music" ? "music" : "app") : "orb"
  } ${focused ? "is-focused" : ""} ${className}`;

  useGSAP(
    () => {
      if (!root.current) return;
      if (reduceMotion) {
        gsap.set(root.current, { clearProps: "transform" });
        return;
      }
      gsap.fromTo(
        root.current,
        { scale: expanded ? 0.985 : 0.94 },
        {
          scale: 1,
          duration: expanded ? 0.44 : 0.32,
          ease: expanded ? "back.out(1.8)" : "power3.out",
          clearProps: "scale",
        },
      );
    },
    { dependencies: [expanded, effectiveSurface, reduceMotion], scope: root },
  );

  useEffect(
    () => () => {
      timers.current.forEach((timer) => window.clearTimeout(timer));
    },
    [],
  );

  const schedule = (callback: () => void, delay: number) => {
    const timer = window.setTimeout(callback, delay);
    timers.current.push(timer);
  };

  const movePortrait = (event: PointerEvent<HTMLButtonElement>) => {
    if (reduceMotion || !portrait.current) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 10;
    const y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 10;
    gsap.to(portrait.current.querySelector("img"), {
      x,
      y,
      duration: 0.24,
      ease: "power2.out",
      overwrite: true,
    });
  };

  const settlePortrait = () => {
    if (reduceMotion || !portrait.current) return;
    gsap.to(portrait.current.querySelector("img"), {
      x: 0,
      y: 0,
      duration: 0.52,
      ease: "elastic.out(1, 0.55)",
      overwrite: true,
    });
  };

  const runAction = (raw: string) => {
    const command = raw.trim().toLowerCase();
    setExternalLink(null);

    if (command.includes("rain") || command.includes("storm")) {
      document.documentElement.dataset.atmosphere = "rain";
      setReply("summer storm restored. the type stays put; the weather moves.");
    } else if (command.includes("ember") || command.includes("fire") || command.includes("spark")) {
      document.documentElement.dataset.atmosphere = "embers";
      setReply("embers are live. restrained enough to keep the page readable.");
    } else if (command.includes("white") || command.includes("paper") || command.includes("light")) {
      document.documentElement.dataset.atmosphere = "paper";
      setReply("paper wash armed for this chapter. the archive remains untouched.");
    } else if (command.includes("music") || command.includes("track") || command.includes("play")) {
      setSurface("music");
      setPlaying(true);
      setReply("the composer became the player. same object, different state.");
    } else if (command.includes("sp13") || command.includes("world")) {
      setReply("moving the line into the survey grid.");
      schedule(() => scrollToChapter("sp13"), 420);
    } else if (command.includes("art") || command.includes("draw")) {
      setReply("taking the line into its four registered stages.");
      schedule(() => scrollToChapter("artwork"), 420);
    } else if (command.includes("youtube")) {
      setReply("external navigation stays explicit. open YouTube when you want.");
      setExternalLink("https://www.youtube.com/");
    } else {
      setReply("i can bend this preview: rain, embers, paper, music, SP13, artwork, or YouTube.");
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!query.trim()) return;
    setExpression("thinking");
    const next = query;
    setQuery("");
    schedule(() => {
      runAction(next);
      setExpression("talking");
      schedule(() => setExpression("idle"), 850);
    }, 520);
  };

  return (
    <div ref={root} className={shellClass} data-testid="yuki-morph">
      <button
        ref={portrait}
        type="button"
        className="yuki-orb"
        aria-label={expanded ? "Keep dexCode open" : "Open the dexCode preview"}
        onClick={() => onFocusedChange?.(true)}
        onDoubleClick={() => onFocusedChange?.(true)}
        onPointerDown={() => {
          if (!reduceMotion) gsap.to(root.current, { scale: 0.965, duration: 0.08 });
        }}
        onPointerUp={() => {
          if (!reduceMotion) gsap.to(root.current, { scale: 1, duration: 0.42, ease: "back.out(2)" });
        }}
        onPointerMove={movePortrait}
        onPointerLeave={settlePortrait}
      >
        <img src={expressionAssets[expression]} alt="Yuki, the dexCode companion" draggable={false} />
        <span className="yuki-orb__status" aria-hidden="true" />
      </button>

      <section className="yuki-panel" aria-hidden={!expanded}>
        <header className="yuki-panel__header">
          <span>SUMMER 2026</span>
          <span>PREVIEW · IN DEVELOPMENT</span>
          {focused && (
            <button type="button" onClick={() => onFocusedChange?.(false)} aria-label="Close dexCode focus mode">
              <CloseRounded fontSize="small" />
            </button>
          )}
        </header>

        <div className="yuki-panel__identity">
          <h1>dexCode</h1>
          <span>{effectiveSurface === "music" ? "MUSIC SURFACE" : "SITE SURFACE"}</span>
        </div>

        <div className="yuki-display" aria-live="polite">
          {effectiveSurface === "music" ? (
            <div className="yuki-player">
              <img src="/assets/portfolio/towaki/05-final.webp" alt="Towaki artwork used as the preview track cover" />
              <div className="yuki-player__meta">
                <span>PLAYER PREVIEW</span>
                <strong>summer rain / preview</strong>
                <div className="yuki-player__timeline" aria-hidden="true">
                  <span style={{ width: playing ? "62%" : "36%" }} />
                </div>
              </div>
              <button
                type="button"
                className="yuki-player__toggle"
                aria-label={playing ? "Pause player preview animation" : "Play player preview animation"}
                onClick={() => setPlaying((value) => !value)}
              >
                {playing ? <PauseRounded /> : <PlayArrowRounded />}
              </button>
            </div>
          ) : (
            <p>{expression === "thinking" ? "thinking…" : reply}</p>
          )}

          {externalLink && (
            <a href={externalLink} target="_blank" rel="noreferrer" className="yuki-external">
              OPEN YOUTUBE <OpenInNewRounded fontSize="inherit" />
            </a>
          )}
        </div>

        <form className="yuki-composer" onSubmit={submit}>
          <button
            type="button"
            aria-label="Return to conversation surface"
            onClick={() => setSurface("conversation")}
          >
            <AddRounded />
          </button>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => onFocusedChange?.(true)}
            placeholder="do anything"
            aria-label="Ask the dexCode website preview to change the page"
          />
          <button type="submit" aria-label="Send website preview command" disabled={!query.trim()}>
            <ArrowUpwardRounded />
          </button>
        </form>
      </section>
    </div>
  );
}

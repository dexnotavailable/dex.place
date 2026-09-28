import { createContext, useContext } from "react";

export type SeasonKey = "summer26" | "autumn26" | "winter26" | "spring27";

export interface SeasonDef {
  key: SeasonKey;
  label: string;
  short: string;
  code: string;
  accent: string;
  accentSoft: string;
  accentDeep: string;
  particle: string;
  glow: string;
  atmosphere: string;
  tag: string;
}

export const SEASONS: Record<SeasonKey, SeasonDef> = {
  summer26: {
    key: "summer26",
    label: "SUMMER 2026",
    short: "SUMMER",
    code: "S26",
    accent: "#e31f3d",
    accentSoft: "#ff526a",
    accentDeep: "#480712",
    particle: "rgba(227,31,61,0.48)",
    glow: "rgba(227,31,61,0.28)",
    atmosphere:
      "linear-gradient(116deg, transparent 0 53%, rgba(227,31,61,0.13) 53% 54%, transparent 54% 67%, rgba(227,31,61,0.05) 67% 68%, transparent 68% 100%)",
    tag: "red / white",
  },
  autumn26: {
    key: "autumn26",
    label: "AUTUMN 2026",
    short: "AUTUMN",
    code: "A26",
    accent: "#c77922",
    accentSoft: "#e6a24f",
    accentDeep: "#38200a",
    particle: "rgba(199,121,34,0.48)",
    glow: "rgba(199,121,34,0.26)",
    atmosphere:
      "linear-gradient(116deg, transparent 0 53%, rgba(199,121,34,0.14) 53% 54%, transparent 54% 67%, rgba(72,65,58,0.06) 67% 68%, transparent 68% 100%)",
    tag: "orange / grey",
  },
  winter26: {
    key: "winter26",
    label: "WINTER 2026",
    short: "WINTER",
    code: "W26",
    accent: "#1478ff",
    accentSoft: "#61a7ff",
    accentDeep: "#071f43",
    particle: "rgba(20,120,255,0.42)",
    glow: "rgba(20,120,255,0.26)",
    atmosphere:
      "linear-gradient(116deg, transparent 0 53%, rgba(20,120,255,0.13) 53% 54%, transparent 54% 67%, rgba(20,120,255,0.05) 67% 68%, transparent 68% 100%)",
    tag: "blue / white",
  },
  spring27: {
    key: "spring27",
    label: "SPRING 2027",
    short: "SPRING",
    code: "SP27",
    accent: "#ed6b9a",
    accentSoft: "#f8a4c1",
    accentDeep: "#2a1220",
    particle: "rgba(237,107,154,0.46)",
    glow: "rgba(237,107,154,0.25)",
    atmosphere:
      "linear-gradient(116deg, transparent 0 53%, rgba(237,107,154,0.13) 53% 54%, transparent 54% 67%, rgba(99,166,117,0.06) 67% 68%, transparent 68% 100%)",
    tag: "pink / green",
  },
};

export const SEASON_ORDER: SeasonKey[] = [
  "summer26",
  "autumn26",
  "winter26",
  "spring27",
];

export const SeasonContext = createContext<{
  season: SeasonDef;
  setSeason: (k: SeasonKey) => void;
}>({
  season: SEASONS.summer26,
  setSeason: () => {},
});

export const useSeason = () => useContext(SeasonContext);

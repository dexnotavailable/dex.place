export interface VnmcBannerCharacterGroup {
  id: string;
  title: string;
  focus: number;
  camera: {
    x: number;
    y: number;
    zoom: number;
    frame: number;
  };
  layers: number;
  parts: readonly string[];
}

export interface VnmcBannerCompositionGroup {
  source: string;
  label: string;
}

export const VNMC_BANNER = {
  sourceFile: "VNMC BANNER 2026.PSD",
  asset: "/assets/portfolio/vnmc-banner-2026/banner.webp",
  canvas: "15360 x 8640",
  psdEntries: 155,
  renderLayers: 113,
  characterGroups: [
    {
      id: "director",
      title: "DIRECTOR",
      focus: 0.11,
      camera: { x: 0.2, y: 0.27, zoom: 1.82, frame: 0.15 },
      layers: 17,
      parts: ["face", "hair", "suit", "coat"],
    },
    {
      id: "towaki",
      title: "TOWAKI",
      focus: 0.39,
      camera: { x: 0.39, y: 0.54, zoom: 1.48, frame: 0.19 },
      layers: 22,
      parts: ["face", "dress", "hair", "body", "ribbon"],
    },
    {
      id: "kaizen",
      title: "KAIZEN",
      focus: 0.6,
      camera: { x: 0.6, y: 0.56, zoom: 1.55, frame: 0.17 },
      layers: 15,
      parts: ["face", "clothing", "hair"],
    },
    {
      id: "yosemite",
      title: "YOSEMITE",
      focus: 0.76,
      camera: { x: 0.76, y: 0.22, zoom: 1.42, frame: 0.21 },
      layers: 23,
      parts: ["face", "hair", "shirt", "jackets", "hand"],
    },
    {
      id: "ena",
      title: "ENA",
      focus: 0.86,
      camera: { x: 0.8, y: 0.46, zoom: 1.75, frame: 0.15 },
      layers: 19,
      parts: ["cape", "face", "suit", "hair"],
    },
  ] satisfies readonly VnmcBannerCharacterGroup[],
  compositionGroups: [
    { source: "Group 85", label: "backdrop blockout" },
    { source: "Paint Layer 93", label: "upper ink sweep" },
    { source: "Group 89", label: "atmospheric shadows" },
    { source: "Group 88", label: "ground shadows" },
    { source: "Group 87", label: "motion streaks" },
    { source: "Group 86", label: "kaizen shadow pass" },
    { source: "Paint Layer 92", label: "red accent cuts" },
    { source: "Paint Layer 24", label: "ground linework" },
    { source: "Paint Layer 91", label: "foreground shadow" },
    { source: "Paint Layer 4", label: "hidden composition guide" },
  ] satisfies readonly VnmcBannerCompositionGroup[],
} as const;

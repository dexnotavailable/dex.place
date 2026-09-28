export interface DexArtworkLayer {
  id: string;
  name: string;
  parent: "Group 22" | null;
  opacity: number;
  file: string;
  sourceOrder: number;
}

export const DEX_ARTWORK = {
  source: "dex.psd",
  canvas: { width: 2160, height: 3840 },
  render: { width: 1080, height: 1920 },
  paintLayers: 27,
  group: "Group 22" as const,
  composites: {
    dark: "/assets/art/dex/composite.webp",
    source: "/assets/art/dex/source-composite.webp",
  },
  layers: [
    { id: "layer-00", name: "Background", parent: null, opacity: 100, file: "/assets/art/dex/layers/00-background.webp", sourceOrder: 0 },
    { id: "layer-01", name: "Paint Layer 24", parent: null, opacity: 100, file: "/assets/art/dex/layers/01-paint-layer-24.webp", sourceOrder: 1 },
    { id: "layer-02", name: "Paint Layer 25", parent: null, opacity: 20, file: "/assets/art/dex/layers/02-paint-layer-25.webp", sourceOrder: 2 },
    { id: "layer-03", name: "Paint Layer 6", parent: "Group 22", opacity: 100, file: "/assets/art/dex/layers/03-paint-layer-6.webp", sourceOrder: 3 },
    { id: "layer-04", name: "Paint Layer 8", parent: "Group 22", opacity: 38, file: "/assets/art/dex/layers/04-paint-layer-8.webp", sourceOrder: 4 },
    { id: "layer-05", name: "Paint Layer 9", parent: "Group 22", opacity: 42, file: "/assets/art/dex/layers/05-paint-layer-9.webp", sourceOrder: 5 },
    { id: "layer-06", name: "Paint Layer 7", parent: "Group 22", opacity: 100, file: "/assets/art/dex/layers/06-paint-layer-7.webp", sourceOrder: 6 },
    { id: "layer-07", name: "Paint Layer 5", parent: "Group 22", opacity: 100, file: "/assets/art/dex/layers/07-paint-layer-5.webp", sourceOrder: 7 },
    { id: "layer-08", name: "Paint Layer 10", parent: "Group 22", opacity: 28, file: "/assets/art/dex/layers/08-paint-layer-10.webp", sourceOrder: 8 },
    { id: "layer-09", name: "Paint Layer 12", parent: "Group 22", opacity: 24, file: "/assets/art/dex/layers/09-paint-layer-12.webp", sourceOrder: 9 },
    { id: "layer-10", name: "Paint Layer 11", parent: "Group 22", opacity: 64, file: "/assets/art/dex/layers/10-paint-layer-11.webp", sourceOrder: 10 },
    { id: "layer-11", name: "Paint Layer 4", parent: "Group 22", opacity: 100, file: "/assets/art/dex/layers/11-paint-layer-4.webp", sourceOrder: 11 },
    { id: "layer-12", name: "Paint Layer 13", parent: "Group 22", opacity: 27, file: "/assets/art/dex/layers/12-paint-layer-13.webp", sourceOrder: 12 },
    { id: "layer-13", name: "Paint Layer 14", parent: "Group 22", opacity: 16, file: "/assets/art/dex/layers/13-paint-layer-14.webp", sourceOrder: 13 },
    { id: "layer-14", name: "Paint Layer 15", parent: "Group 22", opacity: 17, file: "/assets/art/dex/layers/14-paint-layer-15.webp", sourceOrder: 14 },
    { id: "layer-15", name: "Paint Layer 3", parent: "Group 22", opacity: 100, file: "/assets/art/dex/layers/15-paint-layer-3.webp", sourceOrder: 15 },
    { id: "layer-16", name: "Paint Layer 16", parent: "Group 22", opacity: 12, file: "/assets/art/dex/layers/16-paint-layer-16.webp", sourceOrder: 16 },
    { id: "layer-17", name: "Paint Layer 17", parent: "Group 22", opacity: 11, file: "/assets/art/dex/layers/17-paint-layer-17.webp", sourceOrder: 17 },
    { id: "layer-18", name: "Paint Layer 2", parent: "Group 22", opacity: 100, file: "/assets/art/dex/layers/18-paint-layer-2.webp", sourceOrder: 18 },
    { id: "layer-19", name: "Paint Layer 18", parent: "Group 22", opacity: 38, file: "/assets/art/dex/layers/19-paint-layer-18.webp", sourceOrder: 19 },
    { id: "layer-20", name: "Paint Layer 19", parent: "Group 22", opacity: 38, file: "/assets/art/dex/layers/20-paint-layer-19.webp", sourceOrder: 20 },
    { id: "layer-21", name: "Paint Layer 20", parent: "Group 22", opacity: 35, file: "/assets/art/dex/layers/21-paint-layer-20.webp", sourceOrder: 21 },
    { id: "layer-22", name: "Paint Layer 21", parent: "Group 22", opacity: 100, file: "/assets/art/dex/layers/22-paint-layer-21.webp", sourceOrder: 22 },
    { id: "layer-23", name: "Paint Layer 1", parent: "Group 22", opacity: 100, file: "/assets/art/dex/layers/23-paint-layer-1.webp", sourceOrder: 23 },
    { id: "layer-24", name: "Paint Layer 23", parent: null, opacity: 100, file: "/assets/art/dex/layers/24-paint-layer-23.webp", sourceOrder: 24 },
    { id: "layer-25", name: "Paint Layer 26", parent: null, opacity: 4, file: "/assets/art/dex/layers/25-paint-layer-26.webp", sourceOrder: 25 },
    { id: "layer-26", name: "Paint Layer 27", parent: null, opacity: 14, file: "/assets/art/dex/layers/26-paint-layer-27.webp", sourceOrder: 26 },
  ] satisfies DexArtworkLayer[],
};

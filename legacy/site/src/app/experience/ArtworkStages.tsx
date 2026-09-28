import { DEX_ARTWORK } from "../data/dexArtwork";

export const ART_STAGES = ["LINE", "COLOR", "SHADE", "EFFECTS"] as const;

const flatLayerIds = new Set([
  "layer-03",
  "layer-04",
  "layer-05",
  "layer-06",
  "layer-07",
  "layer-08",
  "layer-09",
  "layer-10",
  "layer-11",
  "layer-15",
  "layer-18",
  "layer-23",
]);

const shadeLayerIds = new Set(
  DEX_ARTWORK.layers
    .filter((layer) => layer.sourceOrder >= 3 && layer.sourceOrder <= 23)
    .map((layer) => layer.id),
);

const effectLayerIds = new Set(
  DEX_ARTWORK.layers.filter((layer) => layer.sourceOrder > 0).map((layer) => layer.id),
);

const lineLayerIds = new Set(["layer-23"]);

const stageLayerSets = [lineLayerIds, flatLayerIds, shadeLayerIds, effectLayerIds];

interface ArtworkStageProps {
  stage: number;
  onStageChange: (stage: number) => void;
  compact?: boolean;
  showTitle?: boolean;
}

export function DexArtworkStage({
  stage,
  onStageChange,
  compact = false,
  showTitle = true,
}: ArtworkStageProps) {
  const visibleLayers = stageLayerSets[stage] ?? effectLayerIds;
  const background = stage === 3 ? "#050506" : stage === 2 ? "#e8e8e8" : "#f6f5f2";

  return (
    <div className={`art-stage ${compact ? "art-stage--compact" : ""}`} style={{ background }}>
      <div className="art-stage__canvas" data-stage={ART_STAGES[stage]}>
        {DEX_ARTWORK.layers.slice(1).map((layer) => (
          <img
            key={layer.id}
            src={layer.file}
            alt=""
            aria-hidden="true"
            loading={stage > 1 ? "lazy" : "eager"}
            decoding="async"
            className={visibleLayers.has(layer.id) ? "is-visible" : ""}
            draggable={false}
          />
        ))}
      </div>

      {showTitle && (
        <div className="art-stage__title">
          <span>DEX.PSD · 27 PAINT LAYERS</span>
          <strong role="heading" aria-level={2}>DEX</strong>
        </div>
      )}

      <StageRail stage={stage} onStageChange={onStageChange} />
    </div>
  );
}

const towakiSources = [
  "/assets/portfolio/towaki/02-merged-line.webp",
  "/assets/portfolio/towaki/03-render.webp",
  "/assets/portfolio/towaki/04-final.webp",
  "/assets/portfolio/towaki/05-final.webp",
];

export function TowakiArtworkStage({
  stage,
  onStageChange,
  compact = false,
  showTitle = true,
}: ArtworkStageProps) {
  const source = towakiSources[stage] ?? towakiSources[3];

  return (
    <div className={`art-stage art-stage--towaki ${compact ? "art-stage--compact" : ""}`}>
      <div className="art-stage__towaki-frame">
        <img src={source} alt={`Towaki artwork ${ART_STAGES[stage].toLowerCase()} stage`} draggable={false} />
      </div>
      {showTitle && (
        <div className="art-stage__title">
          <span>TOWAKI.PSD · REGISTERED BUILD</span>
          <strong role="heading" aria-level={2}>TOWAKI</strong>
        </div>
      )}
      <StageRail stage={stage} onStageChange={onStageChange} />
    </div>
  );
}

function StageRail({ stage, onStageChange }: Pick<ArtworkStageProps, "stage" | "onStageChange">) {
  return (
    <div className="art-stage__rail" role="group" aria-label="Artwork build stages">
      {ART_STAGES.map((label, index) => (
        <button
          key={label}
          type="button"
          aria-pressed={stage === index}
          onClick={() => onStageChange(index)}
        >
          <span>{String(index + 1).padStart(2, "0")}</span>
          <strong>{label}</strong>
          {stage === index && <i style={{ width: `${100 / ART_STAGES.length}%` }} aria-hidden="true" />}
        </button>
      ))}
    </div>
  );
}
